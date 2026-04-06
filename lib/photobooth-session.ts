import { PHOTOBOOTH_SESSION_STORAGE_KEY } from "@/lib/constants";
import { normalizePhotoboothStyleIds } from "@/lib/photobooth-style-utils";
import type { PhotoboothRequestPayload } from "@/types/photobooth";

const hasSessionStorage = () => typeof window !== "undefined";

export const savePhotoboothRequest = (request: PhotoboothRequestPayload) => {
  if (!hasSessionStorage()) return;
  sessionStorage.setItem(PHOTOBOOTH_SESSION_STORAGE_KEY, JSON.stringify(request));
};

export const loadPhotoboothRequest = (): PhotoboothRequestPayload | null => {
  if (!hasSessionStorage()) return null;

  const raw = sessionStorage.getItem(PHOTOBOOTH_SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      imageDataUrl?: unknown;
      styleIds?: unknown;
    };

    if (
      !parsed ||
      typeof parsed.imageDataUrl !== "string" ||
      !parsed.imageDataUrl.startsWith("data:image/") ||
      !parsed.imageDataUrl.includes(";base64,")
    ) {
      return null;
    }

    const styleIds = normalizePhotoboothStyleIds(parsed.styleIds);
    if (!styleIds.length) return null;

    return {
      imageDataUrl: parsed.imageDataUrl,
      styleIds,
    };
  } catch {
    return null;
  }
};

export const clearPhotoboothRequest = () => {
  if (!hasSessionStorage()) return;
  sessionStorage.removeItem(PHOTOBOOTH_SESSION_STORAGE_KEY);
};
