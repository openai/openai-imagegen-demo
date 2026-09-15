export const IMAGE_MODELS = [
  {
    id: "gpt-image-2.5-sunburst",
    label: "GPT Image 2.5 · Sunburst",
  },
  {
    id: "gpt-image-2.5-flare",
    label: "GPT Image 2.5 · Flare",
  },
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
  },
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];

export const DEFAULT_IMAGE_MODEL: ImageModelId = "gpt-image-2.5-flare";

export const isImageModelId = (value: unknown): value is ImageModelId =>
  IMAGE_MODELS.some((model) => model.id === value);
