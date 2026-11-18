import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { gifSaveEvents, resetGifSaveLog, runGifExportSave, type GifSaveHandle } from "./gif-save.ts";

function recording(fail?: "write" | "close" | "create"): { handle: GifSaveHandle; blobs: Blob[] } {
  const blobs: Blob[] = [];
  return {
    blobs,
    handle: {
      async createWritable() {
        if (fail === "create") throw new DOMException("createWritable failed", "InvalidStateError");
        return {
          async write(blob: Blob) {
            if (fail === "write") throw new DOMException("write failed", "InvalidStateError");
            blobs.push(blob);
          },
          async close() {
            if (fail === "close") throw new DOMException("close failed", "InvalidStateError");
          },
          async abort() {},
        };
      },
    },
  };
}

function harness(open: NonNullable<Parameters<typeof runGifExportSave>[0]["open"]>, render: (id: number) => Promise<Uint8Array>, signal = new AbortController()) {
  return runGifExportSave({
    suggestedName: "secret-token.png",
    open,
    signal: signal.signal,
    stop: () => signal.abort(),
    render,
  });
}

describe("gif save", () => {
  beforeEach(() => resetGifSaveLog());

  it("opens the dialog before rendering and writes a fresh gif blob ten times", async () => {
    for (let n = 0; n < 10; n += 1) {
      const bytes = new Uint8Array([n, 71, 73, 70, 56, 57, 97]);
      const saved = recording();
      let opened = false;
      const order: string[] = [];
      let release: (handle: GifSaveHandle) => void = () => {};
      const dialog = new Promise<GifSaveHandle>((resolve) => {
        release = resolve;
      });
      const pending = harness(
        (options) => {
          opened = true;
          order.push("open");
          assert.equal(options.suggestedName, "secret-token.gif");
          assert.deepEqual(options.types?.[0]?.accept["image/gif"], [".gif"]);
          return dialog;
        },
        async () => {
          order.push("render");
          return bytes;
        },
      );
      assert.equal(opened, true);
      assert.deepEqual(order, ["open", "render"]);
      release(saved.handle);
      assert.equal(await pending, "saved");
      assert.equal(saved.blobs.length, 1);
      const blob = saved.blobs[0];
      assert.ok(blob);
      assert.equal(blob.type, "image/gif");
      assert.equal(blob.size, bytes.byteLength);
      assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
    }
    const dumped = JSON.stringify(gifSaveEvents());
    assert.equal(dumped.includes("secret-token"), false);
    const successes = gifSaveEvents().filter((event) => event.stage === "保存成功");
    assert.equal(successes.length, 10);
    assert.ok(successes.every((event) => event.bytes === 7 && event.mime === "image/gif" && event.worker === "none" && event.encoder === "gifenc:new"));
    assert.equal(new Set(successes.map((event) => event.id)).size, 10);
  });

  it("treats a dialog cancel as cancel, then saves again", async () => {
    const skipped = recording();
    let rendered = false;
    const cancelled = await harness(
      () => Promise.reject(new DOMException("The user aborted a request.", "AbortError")),
      async () => {
        rendered = true;
        return new Uint8Array([1, 2, 3, 4]);
      },
    );
    assert.equal(cancelled, "cancelled");
    assert.equal(skipped.blobs.length, 0);
    assert.equal(rendered, true);
    const stages = gifSaveEvents().map((event) => event.stage);
    assert.ok(stages.includes("保存キャンセル"));
    assert.equal(stages.includes("保存成功"), false);
    assert.equal(stages.includes("保存失敗"), false);

    const saved = recording();
    const again = await harness(
      async () => saved.handle,
      async () => new Uint8Array([4, 5, 6, 7]),
    );
    assert.equal(again, "saved");
    assert.equal(saved.blobs.length, 1);
    assert.equal(saved.blobs[0]?.size, 4);
  });

  it("does not report a gesture rejection or a write failure as cancel, and the next save still runs", async () => {
    let rendered = false;
    await assert.rejects(
      () =>
        harness(
          () => {
            throw new DOMException("Must be handling a user gesture to show a file picker.", "SecurityError");
          },
          async () => {
            rendered = true;
            return new Uint8Array([1, 2, 3, 4]);
          },
        ),
      (error: unknown) => error instanceof DOMException && error.name === "SecurityError",
    );
    assert.equal(rendered, false);
    assert.equal(gifSaveEvents().some((event) => event.stage === "保存失敗" && event.errorName === "SecurityError"), true);

    const blocked = recording();
    let stopped = false;
    await assert.rejects(
      () =>
        runGifExportSave({
          suggestedName: "secret-token.png",
          open: async () => {
            throw new DOMException("User activation required.", "NotAllowedError");
          },
          signal: new AbortController().signal,
          stop: () => {
            stopped = true;
          },
          render: async () => new Uint8Array([1, 2, 3, 4]),
        }),
      (error: unknown) => error instanceof DOMException && error.name === "NotAllowedError",
    );
    assert.equal(stopped, true);
    assert.equal(blocked.blobs.length, 0);

    const broken = recording("write");
    await assert.rejects(
      () => harness(async () => broken.handle, async () => new Uint8Array([8, 8, 8, 8])),
      (error: unknown) => error instanceof DOMException && error.name === "InvalidStateError",
    );
    assert.equal(broken.blobs.length, 0);
    assert.equal(gifSaveEvents().some((event) => event.stage === "保存失敗" && event.errorName === "InvalidStateError"), true);

    const closed = recording("close");
    await assert.rejects(() => harness(async () => closed.handle, async () => new Uint8Array([3, 3, 3, 3])));
    const created = recording("create");
    await assert.rejects(() => harness(async () => created.handle, async () => new Uint8Array([3, 3, 3, 3])));

    const saved = recording();
    assert.equal(await harness(async () => saved.handle, async () => new Uint8Array([9, 9, 9, 9])), "saved");
    assert.equal(saved.blobs[0]?.type, "image/gif");
  });

  it("writes nothing for an empty encode, a progress cancel, or a missing dialog", async () => {
    const empty = recording();
    await assert.rejects(
      () => harness(async () => empty.handle, async () => new Uint8Array()),
      /empty gif/,
    );
    assert.equal(empty.blobs.length, 0);

    const signal = new AbortController();
    const dropped = recording();
    const cancelled = await runGifExportSave({
      suggestedName: "secret-token.png",
      open: async () => dropped.handle,
      signal: signal.signal,
      stop: () => signal.abort(),
      render: async () => {
        signal.abort();
        throw new DOMException("The operation was aborted.", "AbortError");
      },
    });
    assert.equal(cancelled, "cancelled");
    assert.equal(dropped.blobs.length, 0);

    const missing = await runGifExportSave({
      suggestedName: "secret-token.png",
      open: null,
      signal: new AbortController().signal,
      stop: () => {},
      render: async () => new Uint8Array([1, 2, 3, 4]),
    });
    assert.equal(missing, "unsupported");
    assert.equal(gifSaveEvents().some((event) => event.method === "none" && event.stage === "保存失敗"), true);
  });
});
