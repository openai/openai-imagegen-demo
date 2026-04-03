import OpenAI from "openai";
import { describeError, resolveErrorStatus } from "@/lib/sora";

const asVariant = (value: string | null): "video" | "thumbnail" | "spritesheet" | undefined => {
  if (!value) return undefined;
  if (value === "video" || value === "thumbnail" || value === "spritesheet") {
    return value;
  }
  return undefined;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const message = "OPENAI_API_KEY is not configured";
    return Response.json({ error: { message } }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });

  const { id } = await params;
  const videoId = typeof id === "string" ? id.trim() : "";
  if (!videoId) {
    return Response.json({ error: { message: "Video id is required" } }, { status: 400 });
  }

  const url = new URL(request.url);
  const variant = asVariant(url.searchParams.get("variant"));

  try {
    const request = client.get(`/videos/${videoId}/content`, {
      query: variant ? { variant } : undefined,
      headers: { Accept: "application/binary" },
      __binaryResponse: true,
    });

    const apiResponse = await request.asResponse();

    const arrayBuffer = await apiResponse.arrayBuffer();
    const contentType = apiResponse.headers.get("content-type")
      || (variant === "thumbnail" ? "image/png" : "video/mp4");

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    const message = describeError(error, "Failed to fetch video content");
    const status = resolveErrorStatus(error);
    return Response.json({ error: { message } }, { status });
  }
}
