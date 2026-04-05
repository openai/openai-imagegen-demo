import { NextRequest } from "next/server";
import {
  findPhotoboothStyle,
  PHOTOBOOTH_STYLES,
  type PhotoboothStyleId,
} from "@/lib/photobooth-styles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RequestPayload = {
  imageDataUrl?: unknown;
  styleIds?: unknown;
};

type EmitFn = (event: string, data: Record<string, unknown>) => Promise<void>;

type StreamPayload = Record<string, unknown>;

const MAX_STYLES = 4;

function isValidDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.includes(";base64,")
  );
}

function parseSseChunk(rawChunk: string) {
  const lines = rawChunk.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!dataLines.length) return null;
  return { eventName, data: dataLines.join("\n") };
}

function normalizeStyleIds(raw: unknown): PhotoboothStyleId[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  const deduped = Array.from(new Set(ids)).slice(0, MAX_STYLES);
  return deduped.filter((id): id is PhotoboothStyleId => Boolean(findPhotoboothStyle(id)));
}

function toDataUrl(base64: string, outputFormat?: unknown): string {
  const format =
    typeof outputFormat === "string" && outputFormat.trim()
      ? outputFormat.trim().toLowerCase()
      : "png";
  const normalized = format === "jpg" ? "jpeg" : format;
  return `data:image/${normalized};base64,${base64}`;
}

async function relayOpenAiStream(
  stream: ReadableStream<Uint8Array>,
  styleId: PhotoboothStyleId,
  emit: EmitFn
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r/g, "");

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const parsed = parseSseChunk(chunk);
      if (parsed) {
        const { eventName, data } = parsed;
        if (data !== "[DONE]") {
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
            }
          } else if (eventType === "error" || eventName === "error") {
            const message =
              typeof payload.message === "string"
                ? payload.message
                : "OpenAI stream error.";
            throw new Error(message);
          }
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
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
    signal,
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: `${style.prompt}\n\nOutput requirements: portrait orientation (2:3 aspect ratio), preserve the exact people, poses, facial expressions, and scene composition as faithfully as possible.`,
      images: [{ image_url: imageDataUrl }],
      size: "1024x1536",
      quality: "high",
      output_format: "png",
      input_fidelity: "high",
      stream: true,
      partial_images: 2,
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
    await relayOpenAiStream(response.body, style.id, emit);
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
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      {
        error: { message: "OPENAI_API_KEY is not configured" },
      },
      { status: 500 }
    );
  }

  let payload: RequestPayload;
  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return Response.json(
      { error: { message: "Invalid request body" } },
      { status: 400 }
    );
  }

  if (!isValidDataUrl(payload.imageDataUrl)) {
    return Response.json(
      { error: { message: "imageDataUrl must be a valid base64 image data URL" } },
      { status: 400 }
    );
  }
  const imageDataUrl = payload.imageDataUrl;

  const styleIds = normalizeStyleIds(payload.styleIds);
  if (!styleIds.length) {
    return Response.json(
      { error: { message: "At least one valid styleId is required" } },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const upstreamAbortController = new AbortController();
  const onAbort = () => upstreamAbortController.abort();
  request.signal.addEventListener("abort", onAbort);

  let writeQueue = Promise.resolve();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: EmitFn = async (event, data) => {
        if (upstreamAbortController.signal.aborted) return;
        const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        writeQueue = writeQueue.then(() => {
          if (!upstreamAbortController.signal.aborted) {
            controller.enqueue(encoder.encode(chunk));
          }
        });
        await writeQueue;
      };

      try {
        await emit("session-start", {
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
    styles: PHOTOBOOTH_STYLES.map(({ id, label, description }) => ({
      id,
      label,
      description,
    })),
  });
}
