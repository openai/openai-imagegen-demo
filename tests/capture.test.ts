import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { usePhotoboothCapture } from "../hooks/use-photobooth-capture";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

for (const exit of ["unmount", "reset", "replace"] as const) {
  test(`stops a pending camera stream after ${exit}`, async (t) => {
    const requests: Array<(stream: MediaStream) => void> = [];
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { mediaDevices: { getUserMedia: () => new Promise<MediaStream>((resolve) => requests.push(resolve)) } },
    });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
      else Reflect.deleteProperty(globalThis, "navigator");
    });
    const stop = t.mock.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    let capture!: ReturnType<typeof usePhotoboothCapture>;
    function Harness() {
      capture = usePhotoboothCapture();
      return null;
    }
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(createElement(Harness)); });
    try {
      let pending!: Promise<void>;
      act(() => { pending = capture.startCamera(); });
      if (exit === "unmount") await act(async () => renderer.unmount());
      if (exit === "reset") act(() => capture.resetCapture());
      let replacement: Promise<void> | undefined;
      if (exit === "replace") act(() => { replacement = capture.startCamera(); });
      await act(async () => { requests[0](stream); await pending; });
      assert.equal(stop.mock.callCount(), 1);
      if (exit !== "unmount") assert.equal(capture.cameraStream, null);
      if (replacement) {
        const newerStop = t.mock.fn();
        const newer = { getTracks: () => [{ stop: newerStop }] } as unknown as MediaStream;
        await act(async () => { requests[1](newer); await replacement; });
        assert.equal(capture.cameraStream, newer);
        assert.equal(newerStop.mock.callCount(), 0);
        await act(async () => renderer.unmount());
        assert.equal(newerStop.mock.callCount(), 1);
      }
    } finally {
      await act(async () => renderer.unmount());
    }
  });
}
