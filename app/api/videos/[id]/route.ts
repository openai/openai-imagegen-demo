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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const message = "OPENAI_API_KEY is not configured";
    return Response.json({ error: { message } }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });

  const { id } = await params;
  const videoId = typeof id === "string" ? id.trim() : "";
  if (!videoId) {
    return Response.json(
      { error: { message: "Video id is required" } },
      { status: 400 }
    );
  }

  try {
    const video = await client.get(`/videos/${videoId}`);
    const videoRecord = isRecord(video) ? video : {};

    const prompt =
      typeof videoRecord.prompt === "string" && videoRecord.prompt.trim()
        ? videoRecord.prompt.trim()
        : "";

    const fallback: VideoRequestPayload = {
      prompt,
      model: coerceVideoModel(
        typeof videoRecord.model === "string" ? videoRecord.model : null
      ),
      size: coerceVideoSize(
        typeof videoRecord.size === "string" ? videoRecord.size : null
      ),
      seconds: coerceVideoSeconds(
        videoRecord.seconds !== undefined && videoRecord.seconds !== null
          ? String(videoRecord.seconds)
          : null
      ),
    };

    const normalized = normalizeVideoResponse(video, fallback);
    return Response.json(normalized);
  } catch (error) {
    const message = describeError(error, "Failed to fetch video");
    const status = resolveErrorStatus(error);
    return Response.json({ error: { message } }, { status });
  }
}
