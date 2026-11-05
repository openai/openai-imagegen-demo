export const IMAGE_MODELS = [
  {
    id: "gpt-image-2.6-sunburst",
    label: "gpt-image-2.6-sunburst",
  },
  {
    id: "gpt-image-2.6-flare",
    label: "gpt-image-2.6-flare",
  },
  {
    id: "gpt-image-2.5-sunburst",
    label: "gpt-image-2.5-sunburst",
  },
  {
    id: "gpt-image-2.5-flare",
    label: "gpt-image-2.5-flare",
  },
  {
    id: "gpt-image-2",
    label: "gpt-image-2",
  },
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];

export const DEFAULT_IMAGE_MODEL: ImageModelId = "gpt-image-2.5-flare";

export const isImageModelId = (value: unknown): value is ImageModelId =>
  IMAGE_MODELS.some((model) => model.id === value);

export const IMAGE_COMPLEXITIES = ["low", "medium", "high"] as const;

export type ImageComplexity = (typeof IMAGE_COMPLEXITIES)[number];

export const DEFAULT_IMAGE_COMPLEXITY: ImageComplexity = "high";

export const isImageComplexity = (value: unknown): value is ImageComplexity =>
  IMAGE_COMPLEXITIES.some((complexity) => complexity === value);

export const supportsImageComplexity = (model: ImageModelId): boolean =>
  model === "gpt-image-2.6-sunburst" || model === "gpt-image-2.6-flare";
