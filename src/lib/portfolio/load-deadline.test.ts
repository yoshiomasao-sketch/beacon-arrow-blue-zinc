import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confirmAudioHeader, loadPercent, withDeadline } from "./load-deadline.ts";

describe("load percent", () => {
  it("rounds 9 of 33 voices to 27 percent and cannot do that for the liquid kit", () => {
    assert.equal(loadPercent(9, 33), 27);
    assert.equal(loadPercent(8, 33), 24);
    assert.equal(loadPercent(10, 33), 30);
    assert.equal(loadPercent(3, 13), 23);
    assert.equal(loadPercent(4, 13), 31);
    assert.equal(loadPercent(13, 46), 28);
    assert.equal(loadPercent(0, 0), 0);
  });
});

describe("deadline", () => {
  it("times out a file that never settles and ignores a late success", async () => {
    let release: (value: boolean) => void = () => undefined;
    const hung = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    const result = await withDeadline(hung, 30);
    assert.deepEqual(result, { ok: false, timeout: true });
    release(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(result, { ok: false, timeout: true });
  });

  it("returns the value when the file finishes first", async () => {
    const result = await withDeadline(Promise.resolve("ready"), 200);
    assert.deepEqual(result, { ok: true, value: "ready" });
  });
});

describe("audio header", () => {
  it("accepts an audio response and cancels the rest of the body", async () => {
    let cancelled = false;
    const result = await confirmAudioHeader("voice.wav", 200, async () => {
      return new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]), {
        status: 206,
        headers: { "content-type": "application/octet-stream" },
      });
    });
    assert.equal(result, "ok");
    const typed = await confirmAudioHeader("voice.wav", 200, async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4]));
          controller.close();
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(stream, { status: 200, headers: { "content-type": "audio/wav" } });
    });
    assert.equal(typed, "ok");
    assert.equal(cancelled, true);
  });

  it("does not treat html or a hung request as success", async () => {
    const html = await confirmAudioHeader("missing.wav", 200, async () => {
      return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
    });
    assert.equal(html, "fail");
    const hung = await confirmAudioHeader("slow.wav", 30, () => new Promise<Response>(() => undefined));
    assert.equal(hung, "timeout");
  });
});
