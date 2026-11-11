import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileFromOriginal, offerOriginal, OWN_FILE_DRAG, SHOT_DRAG, writeOriginalDrag, type OriginalDragSink } from "./export-file.ts";

describe("original drag payload", () => {
  it("passes the original bytes and mime through unchanged", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 9]);
    const blob = new Blob([bytes], { type: "image/png" });
    const file = fileFromOriginal({ name: "夕景.png", mime: "image/png", addedAt: 1_700_000_000_000 }, blob);
    assert.equal(file.type, "image/png");
    assert.equal(file.name, "夕景.png");
    assert.equal(file.size, bytes.byteLength);
    assert.equal(file.lastModified, 1_700_000_000_000);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
    const sink: OriginalDragSink & { data: Map<string, string>; added: File | null; cleared: boolean } = {
      effectAllowed: "",
      data: new Map(),
      added: null,
      cleared: false,
      setData(type, value) {
        this.data.set(type, value);
      },
      items: {
        clear() {
          sink.cleared = true;
        },
        add(next) {
          sink.added = next;
        },
      },
    };
    writeOriginalDrag(sink, "shot-1", file, "blob:http://local/original");
    assert.equal(sink.effectAllowed, "copy");
    assert.equal(sink.cleared, false);
    assert.equal(sink.data.get(SHOT_DRAG), "shot-1");
    assert.equal(sink.data.get(OWN_FILE_DRAG), "shot-1");
    assert.equal(sink.data.get("text/plain"), "夕景.png");
    assert.equal(sink.data.get("DownloadURL"), "image/png:夕景.png:blob:http://local/original");
    assert.equal(sink.added, file);
  });

  it("keeps a jpeg name and does not invent a png", () => {
    const file = fileFromOriginal({ name: "scan", mime: "image/jpeg", addedAt: 0 }, new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }));
    assert.equal(file.name, "scan.jpg");
    assert.equal(file.type, "image/jpeg");
    assert.equal(file.size, 3);
  });

  it("reuses a file already built from the same stored image", async () => {
    const bytes = new Uint8Array([9, 8, 7, 6]);
    const first = offerOriginal(
      { id: "same-shot", name: "花", mime: "image/png", addedAt: 20 },
      new Blob([bytes], { type: "image/png" }),
    );
    const second = offerOriginal(
      { id: "same-shot", name: "花", mime: "image/png", addedAt: 20 },
      new Blob([bytes], { type: "image/png" }),
    );
    assert.equal(second, first);
    assert.equal(first.name, "花.png");
    assert.equal(first.type, "image/png");
    assert.deepEqual(new Uint8Array(await first.arrayBuffer()), bytes);
  });
});
