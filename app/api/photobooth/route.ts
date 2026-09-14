import { NextRequest } from "next/server";
import {
  OPENAI_IMAGE_OUTPUT_FORMAT,
  OPENAI_IMAGE_OUTPUT_REQUIREMENTS,
  OPENAI_IMAGE_PARTIAL_IMAGES,
  OPENAI_IMAGE_QUALITY,
  OPENAI_IMAGE_SIZE,
} from "@/lib/constants";
import { normalizePhotoboothStyleIds } from "@/lib/photobooth-style-utils";
import {
  findPhotoboothStyle,
  PHOTOBOOTH_STYLES,
  type PhotoboothStyleId,
} from "@/lib/photobooth-styles";
import { formatSseChunk, parseSseChunk } from "@/lib/sse";
import { DEFAULT_IMAGE_MODEL, IMAGE_MODELS, isImageModelId, type ImageModelId } from "@/lib/image-models";
import { isSupportedImageDataUrl, MAX_REQUEST_BODY_BYTES } from "@/lib/image-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RequestPayload = {
  model?: unknown;
  imageDataUrl?: unknown;
  styleIds?: unknown;
};

type EmitFn = (event: string, data: Record<string, unknown>) => Promise<void>;

type StreamPayload = Record<string, unknown>;

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; status: number };

async function readJsonPayload(
  request: NextRequest,
): Promise<ValidationResult<RequestPayload>> {
  const tooLarge = { ok: false, message: "Request body exceeds the 16 MiB limit", status: 413 } as const;
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BODY_BYTES) {
    await request.body?.cancel().catch(() => {});
    return tooLarge;
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, message: "Invalid request body", status: 400 };
  try {
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REQUEST_BODY_BYTES) return tooLarge;
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    const value: unknown = JSON.parse(chunks.join(""));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, message: "Request body must be a JSON object", status: 400 };
    }
    return {
      ok: true,
      value: value as RequestPayload,
    };
  } catch {
    return {
      ok: false,
      message: "Invalid request body",
      status: 400,
    };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function toDataUrl(base64: string, outputFormat?: unknown): string {
  const format =
    typeof outputFormat === "string" && outputFormat.trim()
      ? outputFormat.trim().toLowerCase()
      : "png";
  const normalized = format === "jpg" ? "jpeg" : format;
  return `data:image/${normalized};base64,${base64}`;
}

async function relayOpenAiSseChunk(
  chunk: string,
  styleId: PhotoboothStyleId,
  emit: EmitFn,
) {
  const parsed = parseSseChunk(chunk);
  if (!parsed || parsed.data === "[DONE]") return;

  const { eventName, data } = parsed;
  let payload: StreamPayload;
  try {
    payload = JSON.parse(data) as StreamPayload;
  } catch {
    payload = { message: data };
  }

  const eventType =
    typeof payload.type === "string" ? payload.type : eventName;

  if (eventType === "image_edit.partial_image") {
    const b64 = payload.b64_json;
    if (typeof b64 === "string" && b64) {
      await emit("style-partial", {
        styleId,
        imageDataUrl: toDataUrl(b64, payload.output_format),
        partialIndex:
          typeof payload.partial_image_index === "number"
            ? payload.partial_image_index
            : null,
      });
    }
  } else if (eventType === "image_edit.completed") {
    const b64 = payload.b64_json;
    if (typeof b64 === "string" && b64) {
      await emit("style-final", {
        styleId,
        imageDataUrl: toDataUrl(b64, payload.output_format),
      });
      return true;
    }
  } else if (eventType === "error" || eventName === "error") {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : "OpenAI stream error.";
    throw new Error(message);
  }
}

async function relayOpenAiStream(
  stream: ReadableStream<Uint8Array>,
  styleId: PhotoboothStyleId,
  emit: EmitFn
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r/g, "");

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        if (await relayOpenAiSseChunk(chunk, styleId, emit)) return;

        boundary = buffer.indexOf("\n\n");
      }
    }

    buffer += decoder.decode();
    const remaining = buffer.trim();
    if (remaining) {
      await relayOpenAiSseChunk(remaining, styleId, emit);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function isAbortError(error: unknown) {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }
  return error instanceof Error && error.name === "AbortError";
}

async function runStyleEdit(
  styleId: PhotoboothStyleId,
  model: ImageModelId,
  imageDataUrl: string,
  apiKey: string,
  emit: EmitFn,
  signal: AbortSignal
) {
  const style = findPhotoboothStyle(styleId);
  if (!style) return;

  await emit("style-start", {
    styleId: style.id,
    label: style.label,
  });

  const endpointBase =
    process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const endpoint = `${endpointBase.replace(/\/$/, "")}/images/edits`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const organization = process.env.OPENAI_ORG_ID?.trim();
  if (organization) {
    headers["OpenAI-Organization"] = organization;
  }
  const project = process.env.OPENAI_PROJECT_ID?.trim();
  if (project) {
    headers["OpenAI-Project"] = project;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    signal: AbortSignal.any([signal, AbortSignal.timeout(240_000)]),
    body: JSON.stringify({
      model,
      prompt: `${style.prompt}\n\n${OPENAI_IMAGE_OUTPUT_REQUIREMENTS}`,
      images: [{ image_url: imageDataUrl }],
      size: OPENAI_IMAGE_SIZE,
      quality: OPENAI_IMAGE_QUALITY,
      output_format: OPENAI_IMAGE_OUTPUT_FORMAT,
      stream: true,
      partial_images: OPENAI_IMAGE_PARTIAL_IMAGES,
    }),
  });

  if (!response.ok) {
    let message = `OpenAI request failed (${response.status}).`;
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      if (typeof payload.error?.message === "string" && payload.error.message) {
        message = payload.error.message;
      }
    } catch {
      // Ignore parse failures; keep generic message.
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream") && response.body) {
    let receivedFinal = false;
    await relayOpenAiStream(response.body, style.id, async (event, data) => {
      if (event === "style-final") receivedFinal = true;
      await emit(event, data);
    });
    if (!receivedFinal) throw new Error("Image stream ended before a final image was returned.");
    return;
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; output_format?: string }>;
  };
  const first = payload.data?.[0];
  if (first?.b64_json) {
    await emit("style-final", {
      styleId: style.id,
      imageDataUrl: toDataUrl(first.b64_json, first.output_format),
    });
    return;
  }
  throw new Error("No image was returned for this style.");
}

export async function POST(request: NextRequest) {
  const bodyResult = await readJsonPayload(request);
  if (!bodyResult.ok) {
    return Response.json(
      { error: { message: bodyResult.message } },
      { status: bodyResult.status }
    );
  }
  const payload = bodyResult.value;
  const model = payload.model === undefined ? DEFAULT_IMAGE_MODEL : payload.model;
  if (!isImageModelId(model)) {
    return Response.json(
      { error: { message: "Select a supported image model: Sunburst or Flare." } },
      { status: 400 },
    );
  }

  if (!isSupportedImageDataUrl(payload.imageDataUrl)) {
    return Response.json(
      { error: { message: "Use a valid base64 PNG, JPEG, or WebP image of at most 10 MiB." } },
      { status: 400 }
    );
  }
  const imageDataUrl = payload.imageDataUrl;

  const styleIds = normalizePhotoboothStyleIds(payload.styleIds);
  if (!styleIds.length) {
    return Response.json(
      { error: { message: "At least one valid styleId is required" } },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        error: { message: "OPENAI_API_KEY is not configured" },
      },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const upstreamAbortController = new AbortController();
  const onAbort = () => upstreamAbortController.abort();
  request.signal.addEventListener("abort", onAbort);
  if (request.signal.aborted) onAbort();

  let writeQueue = Promise.resolve();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: EmitFn = async (event, data) => {
        if (upstreamAbortController.signal.aborted) return;
        const chunk = formatSseChunk(event, data);
        writeQueue = writeQueue.then(() => {
          if (!upstreamAbortController.signal.aborted) {
            controller.enqueue(encoder.encode(chunk));
          }
        });
        await writeQueue;
      };

      try {
        await emit("session-start", {
          model,
          styles: styleIds
            .map((id) => findPhotoboothStyle(id))
            .filter(
              (
                style
              ): style is NonNullable<ReturnType<typeof findPhotoboothStyle>> =>
                Boolean(style)
            )
            .map((style) => ({
              id: style.id,
              label: style.label,
              description: style.description,
            })),
        });

        const jobs = styleIds.map(async (styleId) => {
          try {
            await runStyleEdit(
              styleId,
              model,
              imageDataUrl,
              apiKey,
              emit,
              upstreamAbortController.signal
            );
          } catch (error) {
            if (upstreamAbortController.signal.aborted || isAbortError(error)) {
              return;
            }

            await emit("style-error", {
              styleId,
              message:
                error instanceof Error && error.message
                  ? error.message
                  : "Style generation failed.",
            });
          }
        });

        await Promise.allSettled(jobs);

        if (!upstreamAbortController.signal.aborted) {
          await emit("session-complete", {});
          await writeQueue;
          controller.close();
        }
      } catch (error) {
        if (!upstreamAbortController.signal.aborted) {
          try {
            await emit("session-error", {
              message:
                error instanceof Error && error.message
                  ? error.message
                  : "Unexpected streaming error.",
            });
            await writeQueue;
            controller.close();
          } catch {
            controller.error(error);
          }
        }
      } finally {
        request.signal.removeEventListener("abort", onAbort);
      }
    },
    cancel() {
      upstreamAbortController.abort();
      request.signal.removeEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET() {
  return Response.json({
    models: IMAGE_MODELS,
    defaultModel: DEFAULT_IMAGE_MODEL,
    styles: PHOTOBOOTH_STYLES.map(({ id, label, description }) => ({
      id,
      label,
      description,
    })),
  });
}
