import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/photobooth/route";
import { streamImagegenStyles } from "../services/imagegen-api";
import { DEFAULT_IMAGE_MODEL } from "../lib/image-models";
import { formatSseChunk } from "../lib/sse";

const imageDataUrl = "data:image/png;base64,aGVsbG8=";
const styles = ["knitted"] as const;

function response(text: string, lineEnding: string, bytewise: boolean) {
  const bytes = new TextEncoder().encode(text.replace(/\n/g, lineEnding));
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      if (bytewise) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      } else {
        controller.enqueue(bytes);
      }
      controller.close();
    },
  }), { headers: { "Content-Type": "text/event-stream" } });
}

for (const [name, newline] of [["LF", "\n"], ["CRLF", "\r\n"], ["CR", "\r"]]) {
  for (const bytewise of [false, true]) {
    test(`client handles ${name} framing, bytewise=${bytewise}`, async (t) => {
      const received: Array<[string, Record<string, unknown>]> = [];
      const text = formatSseChunk("style-final", { styleId: "knitted", imageDataUrl, label: "café 東" })
        + formatSseChunk("session-complete", {});
      t.mock.method(globalThis, "fetch", async () => response(text, newline, bytewise));
      await streamImagegenStyles({
        model: DEFAULT_IMAGE_MODEL, imageDataUrl, styleIds: [...styles],
        onEvent: (name, value) => received.push([name, value]),
      });
      assert.deepEqual(received, [
        ["style-final", { styleId: "knitted", imageDataUrl, label: "café 東" }],
        ["session-complete", {}],
      ]);
    });

    test(`server relays ${name} framing, bytewise=${bytewise}`, async (t) => {
      const previous = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "synthetic-test-key";
      t.after(() => {
        if (previous === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = previous;
      });
      t.mock.method(globalThis, "fetch", async () => response(
        formatSseChunk("image_edit.partial_image", { b64_json: "cGFydGlhbA==" })
          + formatSseChunk("image_edit.completed", { b64_json: "aGVsbG8=" }),
        newline, bytewise,
      ));
      const result = await POST(new NextRequest("http://localhost/api/photobooth", {
        method: "POST", body: JSON.stringify({ imageDataUrl, styleIds: styles }),
      }));
      const text = await result.text();
      assert.match(text, /event: style-partial/);
      assert.match(text, /event: style-final/);
      assert.match(text, /event: session-complete/);
      assert.doesNotMatch(text, /event: style-error/);
    });
  }
}

test("client accepts mixed legal line endings without creating extra events", async (t) => {
  const received: string[] = [];
  const text = ": heartbeat\r\r"
    + "event: style-start\r\ndata: {\"styleId\":\"knitted\"}\n\n"
    + "event: session-complete\rdata: {}\r\r";
  t.mock.method(globalThis, "fetch", async () => response(text, "\n", true));
  await streamImagegenStyles({ model: DEFAULT_IMAGE_MODEL, imageDataUrl, styleIds: [...styles], onEvent: name => received.push(name) });
  assert.deepEqual(received, ["style-start", "session-complete"]);
});
