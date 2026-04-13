import { NextRequest } from "next/server";
import {
  OPENAI_IMAGE_INPUT_FIDELITY,
  OPENAI_IMAGE_MODEL,
  OPENAI_IMAGE_OUTPUT_FORMAT,
  OPENAI_IMAGE_OUTPUT_REQUIREMENTS,
  OPENAI_IMAGE_PARTIAL_IMAGES,
  OPENAI_IMAGE_QUALITY,
  OPENAI_IMAGE_SIZE,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_PHOTOBOOTH_REQUEST_BODY_BYTES,
  MAX_STYLE_ID_INPUT_COUNT,
  PHOTOBOOTH_SUPPORTED_IMAGE_TYPES,
} from "@/lib/constants";
import { normalizePhotoboothStyleIds } from "@/lib/photobooth-style-utils";
import {
  findPhotoboothStyle,
  PHOTOBOOTH_STYLES,
  type PhotoboothStyleId,
} from "@/lib/photobooth-styles";
import { formatSseChunk, parseSseChunk } from "@/lib/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RequestPayload = {
  imageDataUrl?: unknown;
  styleIds?: unknown;
};

type EmitFn = (event: string, data: Record<string, unknown>) => Promise<void>;

type StreamPayload = Record<string, unknown>;

type ImageDimensions = {
  width: number;
  height: number;
};

type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; status: number };

const SUPPORTED_IMAGE_MIME_TYPES = new Set<string>(
  PHOTOBOOTH_SUPPORTED_IMAGE_TYPES,
);

const normalizeImageMimeType = (mimeType: string) =>
  mimeType.toLowerCase() === "image/jpg" ? "image/jpeg" : mimeType.toLowerCase();

const getBase64DecodedByteLength = (base64: string) => {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
};

const readPngDimensions = (buffer: Buffer): ImageDimensions | null => {
  if (
    buffer.length < 24 ||
    buffer.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

const readJpegDimensions = (buffer: Buffer): ImageDimensions | null => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return null;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2) return null;

    const segmentStart = offset + 2;
    const segmentEnd = offset + segmentLength;
    if (segmentEnd > buffer.length) return null;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      if (segmentStart + 5 > buffer.length) return null;
      return {
        height: buffer.readUInt16BE(segmentStart + 1),
        width: buffer.readUInt16BE(segmentStart + 3),
      };
    }

    offset = segmentEnd;
  }

  return null;
};

const readWebpDimensions = (buffer: Buffer): ImageDimensions | null => {
  if (
    buffer.length < 16 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }

  const chunkType = buffer.toString("ascii", 12, 16);
  if (chunkType === "VP8X") {
    if (buffer.length < 30) return null;
    return {
      width: buffer.readUIntLE(24, 3) + 1,
      height: buffer.readUIntLE(27, 3) + 1,
    };
  }

  if (chunkType === "VP8L") {
    if (buffer.length < 25 || buffer[20] !== 0x2f) return null;
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];

    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }

  if (
    chunkType === "VP8 " &&
    buffer.length >= 30 &&
    buffer[23] === 0x9d &&
    buffer[24] === 0x01 &&
    buffer[25] === 0x2a
  ) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  return null;
};

const readImageDimensions = (
  buffer: Buffer,
  mimeType: string,
): ImageDimensions | null => {
  if (mimeType === "image/png") return readPngDimensions(buffer);
  if (mimeType === "image/jpeg") return readJpegDimensions(buffer);
  if (mimeType === "image/webp") return readWebpDimensions(buffer);
  return null;
};

function validateImageDataUrl(value: unknown): ValidationResult<string> {
  if (typeof value !== "string") {
    return {
      ok: false,
      message: "imageDataUrl must be a base64 image data URL",
      status: 400,
    };
  }

  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!match || match[2].length % 4 !== 0) {
    return {
      ok: false,
      message: "imageDataUrl must be a valid base64 image data URL",
      status: 400,
    };
  }

  const mimeType = normalizeImageMimeType(match[1]);
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      message: "Image must be a PNG, JPEG, or WebP file",
      status: 400,
    };
  }

  const base64 = match[2];
  const decodedByteLength = getBase64DecodedByteLength(base64);
  if (decodedByteLength > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      ok: false,
      message: "Image is too large",
      status: 413,
    };
  }

  const imageBuffer = Buffer.from(base64, "base64");
  if (!imageBuffer.length || imageBuffer.length !== decodedByteLength) {
    return {
      ok: false,
      message: "imageDataUrl must be a valid base64 image data URL",
      status: 400,
    };
  }

  const dimensions = readImageDimensions(imageBuffer, mimeType);
  if (!dimensions || !dimensions.width || !dimensions.height) {
    return {
      ok: false,
      message: "Image dimensions could not be verified",
      status: 400,
    };
  }

  if (dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    return {
      ok: false,
      message: "Image dimensions are too large",
      status: 413,
    };
  }

  return {
    ok: true,
    value: `data:${mimeType};base64,${base64}`,
  };
}

async function readJsonPayload(
  request: NextRequest,
): Promise<ValidationResult<RequestPayload>> {
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_PHOTOBOOTH_REQUEST_BODY_BYTES
  ) {
    return {
      ok: false,
      message: "Request body is too large",
      status: 413,
    };
  }

  if (!request.body) {
    return {
      ok: false,
      message: "Invalid request body",
      status: 400,
    };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bodyBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bodyBytes += value.byteLength;
    if (bodyBytes > MAX_PHOTOBOOTH_REQUEST_BODY_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // The response below is still the useful failure signal.
      }
      return {
        ok: false,
        message: "Request body is too large",
        status: 413,
      };
    }

    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();

  try {
    return {
      ok: true,
      value: JSON.parse(body) as RequestPayload,
    };
  } catch {
    return {
      ok: false,
      message: "Invalid request body",
      status: 400,
    };
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r/g, "");

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      await relayOpenAiSseChunk(chunk, styleId, emit);

      boundary = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode();
  const remaining = buffer.trim();
  if (remaining) {
    await relayOpenAiSseChunk(remaining, styleId, emit);
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
      model: OPENAI_IMAGE_MODEL,
      prompt: `${style.prompt}\n\n${OPENAI_IMAGE_OUTPUT_REQUIREMENTS}`,
      images: [{ image_url: imageDataUrl }],
      size: OPENAI_IMAGE_SIZE,
      quality: OPENAI_IMAGE_QUALITY,
      output_format: OPENAI_IMAGE_OUTPUT_FORMAT,
      input_fidelity: OPENAI_IMAGE_INPUT_FIDELITY,
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

  const bodyResult = await readJsonPayload(request);
  if (!bodyResult.ok) {
    return Response.json(
      { error: { message: bodyResult.message } },
      { status: bodyResult.status }
    );
  }
  const payload = bodyResult.value;

  if (
    Array.isArray(payload.styleIds) &&
    payload.styleIds.length > MAX_STYLE_ID_INPUT_COUNT
  ) {
    return Response.json(
      { error: { message: "Too many styleIds were provided" } },
      { status: 413 }
    );
  }

  const imageResult = validateImageDataUrl(payload.imageDataUrl);
  if (!imageResult.ok) {
    return Response.json(
      { error: { message: imageResult.message } },
      { status: imageResult.status }
    );
  }
  const imageDataUrl = imageResult.value;

  const styleIds = normalizePhotoboothStyleIds(payload.styleIds);
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
