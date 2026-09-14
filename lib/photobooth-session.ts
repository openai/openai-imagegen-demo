import { PHOTOBOOTH_SESSION_STORAGE_KEY } from "@/lib/constants";
import { normalizePhotoboothStyleIds } from "@/lib/photobooth-style-utils";
import { DEFAULT_IMAGE_MODEL, isImageModelId } from "@/lib/image-models";
import { isSupportedImageDataUrl } from "@/lib/image-input";
import type { PhotoboothRequestPayload } from "@/types/photobooth";

const hasSessionStorage = () => typeof window !== "undefined";

export const savePhotoboothRequest = (request: PhotoboothRequestPayload) => {
  if (!hasSessionStorage()) return false;

  try {
    sessionStorage.setItem(PHOTOBOOTH_SESSION_STORAGE_KEY, JSON.stringify(request));
    return true;
  } catch {
    return false;
  }
};

export const loadPhotoboothRequest = (): PhotoboothRequestPayload | null => {
  if (!hasSessionStorage()) return null;

  try {
    const raw = sessionStorage.getItem(PHOTOBOOTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      model?: unknown;
      imageDataUrl?: unknown;
      styleIds?: unknown;
    };

    if (
      !parsed ||
      !isSupportedImageDataUrl(parsed.imageDataUrl)
    ) {
      return null;
    }

    const styleIds = normalizePhotoboothStyleIds(parsed.styleIds);
    if (!styleIds.length) return null;
    const model = parsed.model === undefined ? DEFAULT_IMAGE_MODEL : parsed.model;
    if (!isImageModelId(model)) return null;

    return {
      model,
      imageDataUrl: parsed.imageDataUrl,
      styleIds,
    };
  } catch {
    return null;
  }
};

export const clearPhotoboothRequest = () => {
  if (!hasSessionStorage()) return;
  try {
    sessionStorage.removeItem(PHOTOBOOTH_SESSION_STORAGE_KEY);
  } catch {
    // Storage can be unavailable; users should still be able to return home.
  }
};
