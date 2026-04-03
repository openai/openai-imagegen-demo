import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  coerceVideoModel,
  coerceVideoSeconds,
  coerceVideoSize,
  describeError,
  resolveErrorStatus,
} from "@/lib/sora";

const PROMPT_MODEL = "gpt-4.1-mini";

interface SuggestPromptPayload {
  prompt?: unknown;
  model?: unknown;
  size?: unknown;
  seconds?: unknown;
}

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const gatherText = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(gatherText).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    const node = value as {
      text?: unknown;
      content?: unknown;
      value?: unknown;
    };
    if (node.text !== undefined) return gatherText(node.text);
    if (node.content !== undefined) return gatherText(node.content);
    if (node.value !== undefined) return gatherText(node.value);
  }
  return "";
};

const extractTextFromResponse = (response: unknown): string => {
  const output = (response as { output_text?: string[] }).output_text;
  if (Array.isArray(output) && output.length) {
    return output.join(" ");
  }

  const generic = gatherText((response as { output?: unknown }).output);
  if (generic.trim()) return generic;

  const choiceContent = gatherText(
    (response as { choices?: Array<{ message?: { content?: unknown } }> })
      .choices?.[0]?.message?.content,
  );
  if (choiceContent.trim()) return choiceContent;

  return (
    gatherText((response as { text?: unknown }).text)
    || gatherText((response as { result?: unknown }).result)
  );
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const message = "OPENAI_API_KEY is not configured";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });

  let payload: SuggestPromptPayload;
  try {
    payload = (await request.json()) as SuggestPromptPayload;
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON payload" } }, { status: 400 });
  }

  const existingPrompt = readString(payload.prompt);
  const model = coerceVideoModel(readString(payload.model));
  const size = coerceVideoSize(readString(payload.size));
  const seconds = coerceVideoSeconds(readString(payload.seconds));

  const contextLines = [
    `Target model: ${model}`,
    `Frame size: ${size}`,
    `Duration: ${seconds} seconds`,
  ];

  if (existingPrompt) {
    contextLines.push(`Existing prompt: ${existingPrompt}`);
  }

  try {
    const response = await client.responses.create({
      model: PROMPT_MODEL,
      max_output_tokens: 200,
      temperature: 0.8,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a creative director crafting vivid video prompts for the OpenAI Sora model. Respond with a single prompt, without additional commentary.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Context for the video prompt:\n${contextLines.join("\n")}`,
            },
          ],
        },
      ],
    });

    const suggestion = extractTextFromResponse(response).trim();
    if (!suggestion) {
      return NextResponse.json(
        { error: { message: "Prompt suggestion unavailable. Try again." } },
        { status: 502 },
      );
    }

    return NextResponse.json({ prompt: suggestion });
  } catch (error) {
    const message = describeError(error, "Failed to generate prompt suggestion");
    const status = resolveErrorStatus(error);
    return NextResponse.json({ error: { message } }, { status });
  }
}
