import type { PhotoboothStyleId } from "@/lib/photobooth-styles";
import type { ImageModelId } from "@/lib/image-models";

export type SelectedImage = {
  dataUrl: string;
  source: "camera" | "upload";
};

export type PhotoboothRequestPayload = {
  model: ImageModelId;
  imageDataUrl: string;
  styleIds: PhotoboothStyleId[];
};

export type ResultStatus = "queued" | "streaming" | "done" | "error";

export type ResultCard = {
  styleId: PhotoboothStyleId;
  label: string;
  status: ResultStatus;
  partialImageUrl: string | null;
  finalImageUrl: string | null;
  error: string | null;
};

export type ResultPreviewState = {
  label: string;
  imageUrl: string;
  styleId: PhotoboothStyleId;
} | null;
