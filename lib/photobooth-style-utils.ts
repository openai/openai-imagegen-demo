import { MAX_SELECTED_STYLES } from "@/lib/constants";
import {
  findPhotoboothStyle,
  type PhotoboothStyleId,
} from "@/lib/photobooth-styles";

export const normalizePhotoboothStyleIds = (
  rawStyleIds: unknown,
  maxStyles = MAX_SELECTED_STYLES,
): PhotoboothStyleId[] => {
  if (!Array.isArray(rawStyleIds)) return [];

  const styleIds = rawStyleIds
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  const uniqueStyleIds = Array.from(new Set(styleIds)).slice(0, maxStyles);

  return uniqueStyleIds.filter(
    (styleId): styleId is PhotoboothStyleId => Boolean(findPhotoboothStyle(styleId)),
  );
};

