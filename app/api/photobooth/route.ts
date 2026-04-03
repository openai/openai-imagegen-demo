import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import {
  findPhotoboothStyle,
  PHOTOBOOTH_STYLES,
  type PhotoboothStyleId,
} from "@/lib/photobooth-styles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type RequestPayload = {
  imageDataUrl?: unknown;
  styleIds?: unknown;
};

type StyleGenerationResult = {
  styleId: PhotoboothStyleId;
  label: string;
  imageUrl: string | null;
  error: string | null;
};

const MAX_STYLES = 8;

function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const [, mimeType, base64] = match;
  if (!mimeType || !base64) return null;
  return { mimeType, base64 };
}

function extensionFromMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function normalizeStyleIds(raw: unknown): PhotoboothStyleId[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  const deduped = Array.from(new Set(ids)).slice(0, MAX_STYLES);
  return deduped.filter((id): id is PhotoboothStyleId => Boolean(findPhotoboothStyle(id)));
}

function readImageOutput(output: unknown): { imageUrl: string | null; error: string | null } {
  const response = output as { data?: Array<{ b64_json?: unknown; url?: unknown }> };
  const first = response.data?.[0];
  if (!first) {
    return { imageUrl: null, error: "No image returned for this style." };
  }

  if (typeof first.b64_json === "string" && first.b64_json) {
    return { imageUrl: `data:image/png;base64,${first.b64_json}`, error: null };
  }

  if (typeof first.url === "string" && first.url) {
    return { imageUrl: first.url, error: null };
  }

  return { imageUrl: null, error: "No image data returned for this style." };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: { message: "OPENAI_API_KEY is not configured" } },
      { status: 500 }
    );
  }

  const client = new OpenAI({ apiKey });

  let payload: RequestPayload;
  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  const imageDataUrl =
    typeof payload.imageDataUrl === "string" ? payload.imageDataUrl.trim() : "";
  if (!imageDataUrl) {
    return NextResponse.json(
      { error: { message: "imageDataUrl is required" } },
      { status: 400 }
    );
  }

  const styleIds = normalizeStyleIds(payload.styleIds);
  if (!styleIds.length) {
    return NextResponse.json(
      { error: { message: "At least one valid styleId is required" } },
      { status: 400 }
    );
  }

  const parsed = parseImageDataUrl(imageDataUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: { message: "imageDataUrl must be a base64 data URL" } },
      { status: 400 }
    );
  }

  const { mimeType, base64 } = parsed;
  const buffer = Buffer.from(base64, "base64");
  const extension = extensionFromMime(mimeType);

  const sharedRequirements =
    "Output requirements: portrait orientation (2:3), photoreal quality, preserve the exact people, face identity, body pose, expression, and original framing. Do not add extra people or remove subjects.";

  const results: StyleGenerationResult[] = [];

  for (const styleId of styleIds) {
    const style = findPhotoboothStyle(styleId);
    if (!style) continue;

    try {
      const imageFile = await toFile(buffer, `photobooth-source.${extension}`, {
        type: mimeType,
      });

      const response = await client.images.edit({
        model: "gpt-image-1",
        image: imageFile,
        prompt: `${style.prompt}\n\n${sharedRequirements}`,
        size: "1024x1536",
        quality: "high",
      });

      const output = readImageOutput(response);
      results.push({
        styleId: style.id,
        label: style.label,
        imageUrl: output.imageUrl,
        error: output.error,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to generate this style.";
      results.push({
        styleId: style.id,
        label: style.label,
        imageUrl: null,
        error: message,
      });
    }
  }

  const availableStyles = PHOTOBOOTH_STYLES.map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));

  return NextResponse.json({
    styles: availableStyles,
    results,
  });
}
