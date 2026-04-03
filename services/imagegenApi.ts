export interface HttpError<T = unknown> extends Error {
  status: number;
  payload: T;
}

const API_BASE = "/api" as const;

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
  styleIds: string[];
  signal?: AbortSignal;
  onEvent: (
    eventName: ImagegenStreamEventName,
    payload: Record<string, unknown>
  ) => void;
}

type SseChunk = {
  eventName: string;
  data: string;
};

const parseSseChunk = (rawChunk: string): SseChunk | null => {
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
};

export const streamImagegenStyles = async ({
  imageDataUrl,
  styleIds,
  signal,
  onEvent,
}: StreamImagegenRequest): Promise<void> => {
  const response = await fetch(`${API_BASE}/photobooth`, {
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
