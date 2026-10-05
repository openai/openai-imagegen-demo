import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/photobooth/route";
import { formatSseChunk } from "../lib/sse";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Response stream remained open after abort")), 500);
    })]);
  } finally { clearTimeout(timer); }
}
function request(signal: AbortSignal) {
  return new NextRequest("http://localhost/api/photobooth", {
    method: "POST", signal,
    body: JSON.stringify({ imageDataUrl: "data:image/png;base64,aGVsbG8=", styleIds: ["knitted"] }),
  });
}
async function drain(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let text = "";
  const decoder = new TextDecoder();
  while (true) {
    const item = await reader.read();
    if (item.done) return text + decoder.decode();
    text += decoder.decode(item.value, { stream: true });
  }
}

for (const stage of ["before-request", "during-fetch", "during-stream"]) {
  test(`request abort closes response during ${stage}`, async (t) => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "synthetic-test-key";
    t.after(() => {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    });
    const started = deferred();
    let upstreamSignal: AbortSignal | undefined;
    t.mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, options: RequestInit = {}) => {
      const signal = options.signal as AbortSignal;
      upstreamSignal = signal;
      started.resolve();
      if (stage === "during-stream") {
        return new Response(new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(formatSseChunk("image_edit.partial_image", { b64_json: "cGFydGlhbA==" })));
            signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
          },
        }), { headers: { "Content-Type": "text/event-stream" } });
      }
      return await new Promise<Response>((_resolve, reject) => {
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    });
    const abort = new AbortController();
    if (stage === "before-request") abort.abort();
    const response = await POST(request(abort.signal));
    const reader = response.body!.getReader();
    try {
      await bounded(started.promise);
      if (stage === "during-stream") {
        let prefix = "";
        while (!prefix.includes("style-partial")) {
          const item = await bounded(reader.read());
          assert.equal(item.done, false);
          prefix += new TextDecoder().decode(item.value);
        }
      }
      abort.abort();
      const suffix = await bounded(drain(reader));
      assert.equal(upstreamSignal!.aborted, true);
      assert.doesNotMatch(suffix, /event: session-complete|event: style-final/);
    } finally {
      abort.abort();
      await reader.cancel();
      reader.releaseLock();
    }
  });
}

test("consumer cancellation aborts upstream without double-closing", async (t) => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
  const started = deferred(), stopped = deferred();
  let upstreamSignal: AbortSignal | undefined;
  t.mock.method(globalThis, "fetch", async (_url: RequestInfo | URL, options: RequestInit = {}) => {
    upstreamSignal = options.signal as AbortSignal;
    started.resolve();
    return await new Promise<Response>((_resolve, reject) => {
      upstreamSignal!.addEventListener("abort", () => { stopped.resolve(); reject(upstreamSignal!.reason); }, { once: true });
    });
  });
  const response = await POST(request(new AbortController().signal));
  await bounded(started.promise);
  await bounded(response.body!.cancel());
  await bounded(stopped.promise);
  assert.equal(upstreamSignal!.aborted, true);
});


test("abort racing a completed session does not close the stream twice", async (t) => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  t.after(() => {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  });
  t.mock.method(globalThis, "fetch", async () => Response.json({ data: [{ b64_json: "aGVsbG8=" }] }));
  const abort = new AbortController();
  const response = await POST(request(abort.signal));
  const reader = response.body!.getReader();
  let text = "";
  try {
    while (!text.includes("event: session-complete")) {
      const item = await bounded(reader.read());
      assert.equal(item.done, false);
      text += new TextDecoder().decode(item.value);
    }
    abort.abort();
    assert.equal(await bounded(drain(reader)), "");
    assert.match(text, /event: style-final/);
    assert.equal((text.match(/event: session-complete/g) ?? []).length, 1);
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
});
