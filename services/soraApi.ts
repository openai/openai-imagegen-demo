import type { GeneratedImageSuggestion } from "@/types/generated";

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
  } catch (error) {
    console.error("Failed to parse JSON", error);
    return {} as T;
  }
};

const buildHttpError = <T>(response: Response, payload: T): HttpError<T> => {
  const message = (payload as { error?: { message?: string } })?.error?.message
    || response.statusText
    || "Request failed";
  const error = new Error(message) as HttpError<T>;
  error.status = response.status;
  error.payload = payload;
  return error;
};

const ensureOk = async <T = unknown>(response: Response): Promise<void> => {
  if (response.ok) return;
  const payload = await parseJson<T>(response);
  throw buildHttpError(response, payload);
};

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const { result } = reader;
    if (typeof result === "string") {
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    } else if (result instanceof ArrayBuffer) {
      const bytes = new Uint8Array(result);
      let binary = "";
      bytes.forEach((b) => {
        binary += String.fromCharCode(b);
      });
      resolve(btoa(binary));
    } else {
      reject(new Error("Unsupported file format"));
    }
  };
  reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
  reader.readAsDataURL(file);
});

export const requestVideoTitle = async <T = unknown>(prompt: string): Promise<T> => {
  const response = await fetch(`${API_BASE}/video-title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  await ensureOk(response);
  return parseJson<T>(response);
};

export interface CreateVideoOptions {
  prompt: string;
  model: string;
  size: string;
  seconds: string | number;
  imageFile?: File | null;
}

export const createVideo = async <T = unknown>({
  prompt,
  model,
  size,
  seconds,
  imageFile,
}: CreateVideoOptions): Promise<T> => {
  let imagePayload: Record<string, string> | null = null;
  if (imageFile) {
    const base64 = await fileToBase64(imageFile);
    imagePayload = {
      data: base64,
      mimeType: imageFile.type || "application/octet-stream",
      name: imageFile.name || "uploaded-image",
    };
  }

  const response = await fetch(`${API_BASE}/generate-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model, size, seconds, image: imagePayload }),
  });
  const payload = await parseJson<T>(response);
  if (!response.ok) {
    throw buildHttpError(response, payload);
  }
  return payload;
};

export interface RemixVideoOptions {
  videoId: string;
  prompt: string;
  model: string;
  size: string;
  seconds: string | number;
}

export const remixVideo = async <T = unknown>({
  videoId,
  prompt,
  model,
  size,
  seconds,
}: RemixVideoOptions): Promise<T> => {
  const response = await fetch(`${API_BASE}/remix-video`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, prompt, model, size, seconds }),
  });
  const payload = await parseJson<T>(response);
  if (!response.ok) {
    throw buildHttpError(response, payload);
  }
  return payload;
};

export interface FetchVideoOptions {
  videoId: string;
}

export const fetchVideo = async <T = unknown>({ videoId }: FetchVideoOptions): Promise<T> => {
  const response = await fetch(`${API_BASE}/videos/${encodeURIComponent(videoId)}`);
  await ensureOk(response);
  return parseJson<T>(response);
};

export interface FetchVideoContentOptions extends FetchVideoOptions {
  variant?: string | null;
}

export const fetchVideoContent = async ({
  videoId,
  variant,
}: FetchVideoContentOptions): Promise<Blob> => {
  const query = variant ? `?variant=${encodeURIComponent(variant)}` : "";
  const response = await fetch(`${API_BASE}/videos/${encodeURIComponent(videoId)}/content${query}`);
  if (!response.ok) {
    const payload = await parseJson(response);
    throw buildHttpError(response, payload);
  }
  return response.blob();
};

export interface GenerateImagesRequest {
  prompt: string;
  size?: string;
  count?: number;
  model?: string;
}

export interface GenerateImagesResponse {
  images: GeneratedImageSuggestion[];
}

export const generateImages = async ({
  prompt,
  size,
  count,
  model,
}: GenerateImagesRequest): Promise<GeneratedImageSuggestion[]> => {
  const response = await fetch(`${API_BASE}/generate-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, size, count, model }),
  });
  const payload = await parseJson<GenerateImagesResponse>(response);
  if (!response.ok) {
    throw buildHttpError(response, payload);
  }
  return Array.isArray(payload.images) ? payload.images : [];
};

export interface SuggestPromptRequest {
  prompt?: string;
  seconds?: string | number;
  model?: string;
  size?: string;
}

export interface SuggestPromptResponse {
  prompt: string;
}

export const suggestVideoPrompt = async (
  params: SuggestPromptRequest,
): Promise<string> => {
  const response = await fetch(`${API_BASE}/suggest-prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const payload = await parseJson<SuggestPromptResponse>(response);
  if (!response.ok) {
    throw buildHttpError(response, payload);
  }
  return typeof payload.prompt === "string" ? payload.prompt.trim() : "";
};

export interface GeneratePhotoboothRequest {
  imageDataUrl: string;
  styleIds: string[];
}

export interface PhotoboothStyleResult {
  styleId: string;
  label: string;
  imageUrl: string | null;
  error: string | null;
}

export interface GeneratePhotoboothResponse {
  styles: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  results: PhotoboothStyleResult[];
}

export const generatePhotoboothStyles = async ({
  imageDataUrl,
  styleIds,
}: GeneratePhotoboothRequest): Promise<GeneratePhotoboothResponse> => {
  const response = await fetch(`${API_BASE}/photobooth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageDataUrl, styleIds }),
  });
  const payload = await parseJson<GeneratePhotoboothResponse>(response);
  if (!response.ok) {
    throw buildHttpError(response, payload);
  }
  return payload;
};

export { ensureOk };
