import {
  MAX_SELECTED_STYLES,
  MAX_STYLE_ID_INPUT_COUNT,
} from "@/lib/constants";
import {
  findPhotoboothStyle,
  type PhotoboothStyleId,
} from "@/lib/photobooth-styles";

export const normalizePhotoboothStyleIds = (
  rawStyleIds: unknown,
  maxStyles = MAX_SELECTED_STYLES,
  maxInputCount = MAX_STYLE_ID_INPUT_COUNT,
): PhotoboothStyleId[] => {
  if (!Array.isArray(rawStyleIds) || maxStyles <= 0 || maxInputCount <= 0) {
    return [];
  }

  const normalized: PhotoboothStyleId[] = [];
  const seen = new Set<string>();
  let inspected = 0;

  for (const value of rawStyleIds) {
    if (normalized.length >= maxStyles || inspected >= maxInputCount) break;
    inspected += 1;

    if (typeof value !== "string") continue;

    const styleId = value.trim();
    if (!styleId || seen.has(styleId)) continue;
    seen.add(styleId);

    const style = findPhotoboothStyle(styleId);
    if (style) {
      normalized.push(style.id);
    }
  }

  return normalized;
};
