export const TITLE_MODEL = "gpt-4.1-mini" as const;

type NestedContent = string | { text?: NestedContent; content?: NestedContent; value?: NestedContent } | NestedContent[] | null | undefined;

type TitleResponse = {
  output_text?: string[];
  output?: NestedContent[];
  choices?: Array<{ message?: { content?: NestedContent } }>;
  text?: string | null;
  result?: string | null;
};

const gatherContent = (content: NestedContent): string => {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(gatherContent).filter(Boolean).join(" ");
  }
  if (typeof content === "object") {
    if ("text" in content) return gatherContent(content.text);
    if ("content" in content) return gatherContent(content.content);
    if ("value" in content) return gatherContent(content.value);
  }
  return "";
};

export const extractTitleFromResponse = (payload: TitleResponse | null | undefined): string => {
  if (!payload) return "";
  if (Array.isArray(payload.output_text) && payload.output_text.length) {
    return payload.output_text.join(" ").trim();
  }

  if (Array.isArray(payload.output)) {
    for (const node of payload.output) {
      const text = gatherContent(node);
      if (text.trim()) return text.trim();
    }
  }

  const choice = payload?.choices?.[0]?.message?.content;
  const choiceText = gatherContent(choice);
  if (choiceText.trim()) return choiceText.trim();

  const fallback = [payload?.text, payload?.result]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
  return fallback.trim();
};
