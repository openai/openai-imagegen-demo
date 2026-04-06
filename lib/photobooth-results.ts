import { PHOTOBOOTH_STYLES } from "@/lib/photobooth-styles";
import type { PhotoboothStyleId } from "@/lib/photobooth-styles";
import type { ResultCard } from "@/types/photobooth";

export const buildInitialResultCards = (
  styleIds: PhotoboothStyleId[],
): ResultCard[] =>
  styleIds.map((styleId) => {
    const style = PHOTOBOOTH_STYLES.find((entry) => entry.id === styleId);

    return {
      styleId,
      label: style?.label ?? styleId,
      status: "queued",
      partialImageUrl: null,
      finalImageUrl: null,
      error: null,
    };
  });

