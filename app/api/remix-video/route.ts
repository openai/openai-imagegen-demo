import OpenAI from "openai";
import {
  coerceVideoModel,
  coerceVideoSeconds,
  coerceVideoSize,
  describeError,
  isRecord,
  normalizeVideoResponse,
  resolveErrorStatus,
  VideoRequestPayload,
} from "@/lib/sora";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const message = "OPENAI_API_KEY is not configured";
    return Response.json({ error: { message } }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return Response.json({ error: { message: "Invalid JSON payload" } }, { status: 400 });
  }

  const payload = isRecord(rawPayload) ? rawPayload : {};

  const videoId = typeof payload.videoId === "string" ? payload.videoId.trim() : "";
  if (!videoId) {
    return Response.json({ error: { message: "videoId is required" } }, { status: 400 });
  }

  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  if (!prompt) {
    return Response.json({ error: { message: "Prompt is required" } }, { status: 400 });
  }

  const fallback: VideoRequestPayload = {
    prompt,
    model: coerceVideoModel(typeof payload.model === "string" ? payload.model : null),
    size: coerceVideoSize(typeof payload.size === "string" ? payload.size : null),
    seconds: coerceVideoSeconds(payload.seconds != null ? String(payload.seconds) : null),
  };

  try {
    const video = await client.post(`/videos/${videoId}/remix`, {
      body: { prompt },
    });
    const normalized = normalizeVideoResponse(video, fallback);
    return Response.json(normalized);
  } catch (error) {
    const message = describeError(error, "Failed to remix video");
    const status = resolveErrorStatus(error);
    return Response.json({ error: { message } }, { status });
  }
}
