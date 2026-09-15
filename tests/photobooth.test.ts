import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { POST } from "../app/api/photobooth/route";
import { DEFAULT_IMAGE_MODEL, IMAGE_MODELS } from "../lib/image-models";
import { loadPhotoboothRequest, clearPhotoboothRequest, savePhotoboothRequest } from "../lib/photobooth-session";
import { normalizePhotoboothStyleIds } from "../lib/photobooth-style-utils";
import { streamImagegenStyles } from "../services/imagegen-api";
import { formatSseChunk } from "../lib/sse";
import { middleware } from "../middleware";

const imageDataUrl = "data:image/png;base64,aGVsbG8=";
const styleIds = ["knitted"] as const;
const request = (body: unknown) => new NextRequest("http://localhost/api/photobooth", {
  method: "POST", body: JSON.stringify(body),
});

test("origin check accepts the browser-facing loopback host and rejects foreign origins", () => {
  for (const origin of ["http://127.0.0.1:3000", "https://unrelated.example"]) {
    const response = middleware(new NextRequest("http://localhost:3000/api/photobooth", {
      method: "POST",
      headers: { host: "127.0.0.1:3000", origin, "Content-Type": "application/json" },
    }));
    assert.equal(response.status, origin.startsWith("http://127.0.0.1") ? 200 : 403);
  }
});

test("reject malformed request bodies and unrecognized models before calling OpenAI", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected upstream request"); });
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  try {
    for (const body of [null, [], "invalid", { imageDataUrl, styleIds, model: "arbitrary-model" }]) {
      const response = await POST(request(body));
      assert.equal(response.status, 400);
      assert.ok((await response.json()).error.message);
    }
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("route forwards each selected variant, defaults legacy requests, and detects incomplete upstream streams", async (t) => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  let upstreamBody: Record<string, unknown> = {};
  let complete = true;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    upstreamBody = JSON.parse(String(init?.body));
    return new Response(complete
      ? formatSseChunk("image_edit.completed", { b64_json: "aGVsbG8=" })
      : formatSseChunk("image_edit.partial_image", { b64_json: "aGVsbG8=" }),
      { headers: { "Content-Type": "text/event-stream" } });
  });
  try {
    for (const model of [...IMAGE_MODELS.map((entry) => entry.id), undefined]) {
      const response = await POST(request({ imageDataUrl, styleIds, model }));
      const events = await response.text();
      assert.equal(upstreamBody.model, model ?? DEFAULT_IMAGE_MODEL);
      assert.deepEqual(upstreamBody.images, [{ image_url: imageDataUrl }]);
      assert.match(events, /event: style-final/);
      assert.match(events, /event: session-complete/);
    }
    complete = false;
    const events = await (await POST(request({ imageDataUrl, styleIds }))).text();
    assert.match(events, /event: style-error/);
    assert.match(events, /before a final image/);
    assert.doesNotMatch(events, /event: style-final/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("client sends chosen model, handles split SSE events, and reports truncated/error responses", async (t) => {
  let body = "";
  const events: string[] = [];
  const encoder = new TextEncoder();
  let response = new Response(new ReadableStream({ start(controller) {
    const text = formatSseChunk("style-final", { styleId: "knitted", imageDataUrl }) + formatSseChunk("session-complete", {});
    for (const character of text) controller.enqueue(encoder.encode(character));
    controller.close();
  } }), { headers: { "Content-Type": "text/event-stream" } });
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => { body = String(init?.body); return response; });
  const args = { imageDataUrl, styleIds: [...styleIds], model: IMAGE_MODELS[1].id, onEvent: (event: string) => events.push(event) };
  await streamImagegenStyles(args);
  assert.equal(JSON.parse(body).model, "gpt-image-2.5-flare");
  assert.deepEqual(events, ["style-final", "session-complete"]);
  response = new Response(formatSseChunk("style-start", { styleId: "knitted" }), { headers: { "Content-Type": "text/event-stream" } });
  await assert.rejects(streamImagegenStyles(args), /Connection closed before generation finished/);
  response = new Response(formatSseChunk("session-error", { message: "Upstream unavailable" }), { headers: { "Content-Type": "text/event-stream" } });
  await assert.rejects(streamImagegenStyles(args), /Upstream unavailable/);
  response = Response.json({ error: "Forbidden - invalid Origin/Referer" }, { status: 403 });
  await assert.rejects(streamImagegenStyles(args), /Forbidden - invalid Origin/);
});

test("session preserves selected model, migrates old sessions, and tolerates blocked storage", () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  let value: string | null = null;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: () => value, setItem: (_key: string, raw: string) => { value = raw; }, removeItem: () => { value = null; },
  } });
  try {
    for (const { id: model } of IMAGE_MODELS) {
      assert.equal(savePhotoboothRequest({ imageDataUrl, styleIds: [...styleIds], model }), true);
      assert.equal(loadPhotoboothRequest()?.model, model);
    }
    value = JSON.stringify({ imageDataUrl, styleIds });
    assert.equal(loadPhotoboothRequest()?.model, DEFAULT_IMAGE_MODEL);
    value = JSON.stringify({ imageDataUrl, styleIds, model: "invalid" });
    assert.equal(loadPhotoboothRequest(), null);
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("Storage blocked"); } });
    assert.equal(loadPhotoboothRequest(), null);
    assert.doesNotThrow(clearPhotoboothRequest);
  } finally {
    for (const [key, descriptor] of [["window", originalWindow], ["sessionStorage", originalStorage]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("invalid styles do not consume the selection limit", () => {
  assert.deepEqual(normalizePhotoboothStyleIds(["bad1", "bad2", "bad3", "bad4", "knitted"]), ["knitted"]);
});

test("a completed upstream image remains successful if its connection subsequently fails", async (t) => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  const encoder = new TextEncoder();
  let reads = 0;
  t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({
    pull(controller) {
      if (reads++ === 0) {
        controller.enqueue(encoder.encode(formatSseChunk("image_edit.completed", { b64_json: "aGVsbG8=" })));
      } else {
        controller.error(new TypeError("network error"));
      }
    },
  }), { headers: { "Content-Type": "text/event-stream" } }));
  try {
    const body = await (await POST(request({ imageDataUrl, styleIds }))).text();
    assert.match(body, /event: style-final/);
    assert.doesNotMatch(body, /event: style-error/);
    assert.match(body, /event: session-complete/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("forwards image payloads larger than the former 16 MiB cap unchanged", async (t) => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  const largeImage = "data:image/png;base64," + "a".repeat(17 * 1024 * 1024);
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    assert.deepEqual(JSON.parse(String(init?.body)).images, [{ image_url: largeImage }]);
    return new Response(formatSseChunk("image_edit.completed", { b64_json: "aGVsbG8=" }), {
      headers: { "Content-Type": "text/event-stream" },
    });
  });
  try {
    const response = await POST(request({ imageDataUrl: largeImage, styleIds }));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /event: style-final/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("client treats session completion as terminal and cancels the reader", async (t) => {
  const encoder = new TextEncoder();
  for (const trailingEvent of [false, true]) {
    let reads = 0;
    let cancelled = false;
    const events: string[] = [];
    const response = new Response(new ReadableStream({
      pull(controller) {
        if (reads++ > 0) {
          controller.error(new TypeError("late network error"));
          return;
        }
        const body = formatSseChunk("style-final", { styleId: "knitted", imageDataUrl })
          + formatSseChunk("session-complete", {})
          + (trailingEvent ? formatSseChunk("session-error", { message: "late server error" }) : "");
        controller.enqueue(encoder.encode(body));
      },
      cancel() { cancelled = true; },
    }, { highWaterMark: 0 }), { headers: { "Content-Type": "text/event-stream" } });
    t.mock.method(globalThis, "fetch", async () => response);
    await streamImagegenStyles({
      model: DEFAULT_IMAGE_MODEL, imageDataUrl, styleIds: [...styleIds],
      onEvent: (event) => events.push(event),
    });
    assert.deepEqual(events, ["style-final", "session-complete"]);
    assert.equal(reads, 1);
    assert.equal(cancelled, true);
  }
});
