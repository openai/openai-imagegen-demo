import { IMAGEGEN_API_ROUTE } from "@/lib/constants";
import { parseSseChunk } from "@/lib/sse";
import type { PhotoboothStyleId } from "@/lib/photobooth-styles";

export interface HttpError<T = unknown> extends Error {
  status: number;
  payload: T;
}

const parseJson = async <T = unknown>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
};

const buildHttpError = <T>(response: Response, payload: T): HttpError<T> => {
  const message =
    (payload as { error?: { message?: string } })?.error?.message ||
    response.statusText ||
    "Request failed";
  const error = new Error(message) as HttpError<T>;
  error.status = response.status;
  error.payload = payload;
  return error;
};

export type ImagegenStreamEventName =
  | "session-start"
  | "style-start"
  | "style-partial"
  | "style-final"
  | "style-error"
  | "session-error"
  | "session-complete";

export interface StreamImagegenRequest {
  imageDataUrl: string;
  styleIds: PhotoboothStyleId[];
  signal?: AbortSignal;
  onEvent: (
    eventName: ImagegenStreamEventName,
    payload: Record<string, unknown>
  ) => void;
}

export const streamImagegenStyles = async ({
  imageDataUrl,
  styleIds,
  signal,
  onEvent,
}: StreamImagegenRequest): Promise<void> => {
  const response = await fetch(IMAGEGEN_API_ROUTE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl, styleIds }),
    signal,
  });

  if (!response.ok) {
    const payload = await parseJson(response);
    throw buildHttpError(response, payload);
  }

  if (!response.body) {
    throw new Error("No stream body returned by server.");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const payload = await parseJson<{
      results?: Array<{
        styleId?: string;
        label?: string;
        imageUrl?: string | null;
        error?: string | null;
      }>;
    }>(response);

    for (const result of payload.results ?? []) {
      if (typeof result.imageUrl === "string" && result.imageUrl) {
        onEvent("style-final", {
          styleId: result.styleId,
          label: result.label,
          imageDataUrl: result.imageUrl,
        });
      } else {
        onEvent("style-error", {
          styleId: result.styleId,
          message: result.error ?? "Style generation failed.",
        });
      }
    }

    onEvent("session-complete", {});
    return;
  }

  const reader = response.body.getReader();
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
      if (parsed && parsed.data !== "[DONE]") {
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(parsed.data) as Record<string, unknown>;
        } catch {
          payload = { message: parsed.data };
        }
        onEvent(parsed.eventName as ImagegenStreamEventName, payload);
      }

      boundary = buffer.indexOf("\n\n");
    }
  }

  const remaining = buffer.trim();
  if (remaining) {
    const parsed = parseSseChunk(remaining);
    if (parsed && parsed.data !== "[DONE]") {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(parsed.data) as Record<string, unknown>;
      } catch {
        payload = { message: parsed.data };
      }
      onEvent(parsed.eventName as ImagegenStreamEventName, payload);
    }
  }
};
