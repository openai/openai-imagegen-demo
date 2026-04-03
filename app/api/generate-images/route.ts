import { NextResponse } from "next/server";
import OpenAI from "openai";
import { describeError, resolveErrorStatus } from "@/lib/sora";
import type { GeneratedImageSuggestion } from "@/types/generated";

const IMAGE_MODEL_FALLBACK = "gpt-image-1";
const ALLOWED_IMAGE_MODELS = new Set<string>(["gpt-image-1"]);
const MAX_IMAGE_COUNT = 4;
const DEFAULT_IMAGE_COUNT = 3;

type ImageSize = OpenAI.Images.ImageGenerateParams["size"];

const DEFAULT_IMAGE_SIZE: ImageSize = "1024x1024";
const ALLOWED_IMAGE_SIZES = new Set<ImageSize>([
  "256x256",
  "512x512",
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1024x1792",
  "1792x1024",
  "auto",
]);

interface GenerateImagesPayload {
  prompt?: unknown;
  size?: unknown;
  count?: unknown;
  model?: unknown;
}

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const readNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const coerceImageCount = (value: unknown): number => {
  const parsed = readNumber(value);
  if (parsed === null) return DEFAULT_IMAGE_COUNT;
  if (parsed <= 1) return 1;
  if (parsed >= MAX_IMAGE_COUNT) return MAX_IMAGE_COUNT;
  return Math.round(parsed);
};

const coerceImageModel = (value: unknown): string => {
  const candidate = readString(value);
  if (!candidate) return IMAGE_MODEL_FALLBACK;
  if (ALLOWED_IMAGE_MODELS.has(candidate)) return candidate;
  return IMAGE_MODEL_FALLBACK;
};

const coerceImageSize = (value: unknown): ImageSize => {
  const candidate = readString(value);
  if (!candidate) return DEFAULT_IMAGE_SIZE;
  if (ALLOWED_IMAGE_SIZES.has(candidate as ImageSize)) {
    return candidate as ImageSize;
  }
  return DEFAULT_IMAGE_SIZE;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const message = "OPENAI_API_KEY is not configured";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });

  let rawPayload: GenerateImagesPayload;
  try {
    rawPayload = (await request.json()) as GenerateImagesPayload;
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  const prompt = readString(rawPayload.prompt);
  if (!prompt) {
    return NextResponse.json(
      { error: { message: "Prompt is required" } },
      { status: 400 }
    );
  }

  const size = coerceImageSize(rawPayload.size);
  const count = coerceImageCount(rawPayload.count);
  const model = coerceImageModel(rawPayload.model);

  try {
    const generation = await client.images.generate({
      model,
      prompt,
      size,
      quality: "high",
      n: count,
    });

    const suggestions = (generation.data ?? []).reduce<
      GeneratedImageSuggestion[]
    >((acc, entry, index) => {
      const base64 = entry.b64_json ?? null;
      const url = base64
        ? `data:image/png;base64,${base64}`
        : readString(entry.url);
      if (!url) return acc;
      acc.push({
        id: `generated-${Date.now()}-${index}`,
        url,
        base64,
        description: prompt,
      });
      return acc;
    }, []);

    return NextResponse.json({ images: suggestions });
  } catch (error) {
    const message = describeError(error, "Failed to generate images");
    const status = resolveErrorStatus(error);
    return NextResponse.json({ error: { message } }, { status });
  }
}
