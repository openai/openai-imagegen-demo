export type ParsedSseChunk = {
  eventName: string;
  data: string;
};

export const parseSseChunk = (rawChunk: string): ParsedSseChunk | null => {
  const lines = rawChunk.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!dataLines.length) return null;

  return {
    eventName,
    data: dataLines.join("\n"),
  };
};

export const formatSseChunk = (
  eventName: string,
  payload: Record<string, unknown>,
) => `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;


/** Decode UTF-8 and normalize SSE line endings across network chunks. */
export class SseTextDecoder {
  private readonly decoder = new TextDecoder();
  private previousCarriageReturn = false;

  decode(value?: Uint8Array, options?: TextDecodeOptions): string {
    const text = this.decoder.decode(value, options);
    if (!text) return text;

    // A CR was already emitted as LF. Suppress only its optional paired LF.
    const continued = this.previousCarriageReturn && text.startsWith("\n")
      ? text.slice(1)
      : text;
    this.previousCarriageReturn = text.endsWith("\r");
    return continued.replace(/\r\n?/g, "\n");
  }
}
