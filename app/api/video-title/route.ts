import { NextResponse } from "next/server";
import OpenAI from "openai";
import { describeError, resolveErrorStatus } from "@/lib/sora";
import { TITLE_MODEL } from "@/utils/titles";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const message = "OPENAI_API_KEY is not configured";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  const prompt =
    typeof (payload as { prompt?: unknown })?.prompt === "string"
      ? (payload as { prompt: string }).prompt.trim()
      : "";
  if (!prompt) {
    return NextResponse.json(
      { error: { message: "Prompt is required" } },
      { status: 400 }
    );
  }

  try {
    const response = await client.responses.create({
      model: TITLE_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Propose a short reel-style title for this video prompt (don't include quotes around the title): ${prompt}`,
            },
          ],
        },
      ],
      max_output_tokens: 80,
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = describeError(error, "Failed to generate title");
    const status = resolveErrorStatus(error);
    return NextResponse.json({ error: { message } }, { status });
  }
}
