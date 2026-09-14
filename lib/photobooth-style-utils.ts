import { MAX_SELECTED_STYLES } from "@/lib/constants";
import {
  findPhotoboothStyle,
  type PhotoboothStyleId,
} from "@/lib/photobooth-styles";

export const normalizePhotoboothStyleIds = (
  rawStyleIds: unknown,
  maxStyles = MAX_SELECTED_STYLES,
): PhotoboothStyleId[] => {
  if (!Array.isArray(rawStyleIds) || maxStyles <= 0) {
    return [];
  }

  const styleIds = rawStyleIds
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  const uniqueStyleIds = Array.from(new Set(styleIds));

  return uniqueStyleIds.filter(
    (styleId): styleId is PhotoboothStyleId =>
      Boolean(findPhotoboothStyle(styleId)),
  ).slice(0, maxStyles);
};
