import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assetPhase, createAssetBook, ensureAssets, resetAssetBook, snapshotAssets } from "./media-book.ts";

describe("media book", () => {
  it("skips ready files, retries only failures, and shares one flight", async () => {
    const book = createAssetBook();
    let calls = 0;
    const first = await ensureAssets(book, ["a", "b"], async (id) => {
      calls += 1;
      return id === "a";
    });
    assert.equal(first.ready, false);
    assert.deepEqual(first.failed, ["b"]);
    assert.equal(first.done, 2);
    assert.equal(calls, 2);
    assert.equal(assetPhase(book, "a"), "ready");
    assert.equal(assetPhase(book, "b"), "failed");

    let release: (ok: boolean) => void = () => undefined;
    const gate = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    let secondCalls = 0;
    const left = ensureAssets(book, ["a", "b"], () => {
      secondCalls += 1;
      return gate;
    });
    const right = ensureAssets(book, ["a", "b"], () => {
      secondCalls += 1;
      return gate;
    });
    await Promise.resolve();
    assert.equal(secondCalls, 1);
    release(true);
    const [doneLeft, doneRight] = await Promise.all([left, right]);
    assert.equal(doneLeft.ready, true);
    assert.equal(doneRight.ready, true);
    assert.equal(secondCalls, 1);
    assert.equal(calls, 2);

    await ensureAssets(book, ["a", "b"], async () => {
      calls += 1;
      return true;
    });
    assert.equal(calls, 2);
  });

  it("reports settled counts and caps how many loads run at once", async () => {
    const book = createAssetBook();
    const seen: number[] = [];
    let active = 0;
    let max = 0;
    const gates: Array<() => void> = [];
    const pending = ensureAssets(
      book,
      ["a", "b", "c", "d"],
      () => {
        active += 1;
        max = Math.max(max, active);
        return new Promise<boolean>((resolve) => {
          gates.push(() => {
            active -= 1;
            resolve(true);
          });
        });
      },
      { concurrency: 2, onProgress: (job) => seen.push(job.done) },
    );
    let guard = 0;
    while (seen.at(-1) !== 4) {
      if (gates.length === 0) {
        await Promise.resolve();
        guard += 1;
        assert.ok(guard < 30);
        continue;
      }
      guard = 0;
      assert.ok(active <= 2);
      gates.shift()?.();
    }
    const job = await pending;
    assert.equal(max, 2);
    assert.equal(job.done, 4);
    assert.equal(job.ready, true);
    assert.equal(seen[0], 0);
    assert.deepEqual(snapshotAssets(book, ["a", "b", "c", "d"]).failed, []);
  });

  it("drops a stale result after the book is reset", async () => {
    const book = createAssetBook();
    let release: (ok: boolean) => void = () => undefined;
    const gate = new Promise<boolean>((resolve) => {
      release = resolve;
    });
    const pending = ensureAssets(book, ["a"], () => gate);
    await Promise.resolve();
    resetAssetBook(book);
    release(true);
    const job = await pending;
    assert.equal(assetPhase(book, "a"), "idle");
    assert.equal(job.ready, false);
    assert.equal(job.done, 0);
  });
});
