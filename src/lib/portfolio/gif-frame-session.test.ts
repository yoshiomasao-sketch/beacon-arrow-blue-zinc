import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GIFEncoder } from "gifenc/dist/gifenc.esm.js";
import { frameAddOutcome, dragFrameName, framePngName, GIF_FRAME_DRAG, nextFrameIndex, openGifFrameSession, placeFrameDrag, readGifFrameDrag, thumbBox, writeGifFrameDrag, type FrameDragSink, type GifFramePainter } from "./gif-frame-session.ts";

function sampleGif(): Uint8Array {
  const gif = GIFEncoder();
  const palette = [
    [255, 0, 0],
    [0, 0, 255],
    [0, 0, 0],
  ];
  gif.writeFrame(Uint8Array.from([0, 0, 0, 0]), 2, 2, { palette, delay: 50, dispose: 2, colorDepth: 2 } as never);
  gif.writeFrame(Uint8Array.from([1, 1, 1, 1]), 2, 2, { palette, delay: 70, dispose: 1, colorDepth: 2 } as never);
  gif.finish();
  return gif.bytes();
}

function painter(revoked: string[], abort?: AbortController): GifFramePainter & { calls: number } {
  const api = {
    calls: 0,
    async thumbUrl() {
      api.calls += 1;
      if (api.calls === 2) abort?.abort();
      return `blob:${api.calls}`;
    },
    async pngBlob(rgba: Uint8ClampedArray) {
      return new Blob([new Uint8Array(rgba)]);
    },
    revoke(url: string) {
      revoked.push(url);
    },
  };
  return api;
}

describe("gif frame session", () => {
  it("sizes a thumb inside the long edge without growing a small frame", () => {
    assert.deepEqual(thumbBox(800, 400, 240), { width: 240, height: 120 });
    assert.deepEqual(thumbBox(20, 10, 240), { width: 20, height: 10 });
    assert.deepEqual(thumbBox(1, 500, 240), { width: 1, height: 240 });
  });

  it("names an extracted frame without touching the gif name", () => {
    assert.equal(framePngName("dance.gif", 0), "dance_frame_01.png");
    assert.equal(framePngName("a/b/Clip.GIF", 11), "Clip_frame_12.png");
    assert.equal(framePngName("  ", 0), "無題_frame_01.png");
    assert.equal(dragFrameName(0), "GIF_Frame_001.png");
    assert.equal(dragFrameName(11), "GIF_Frame_012.png");
    assert.equal(nextFrameIndex(0, -1, 5), 0);
    assert.equal(nextFrameIndex(4, 1, 5), 4);
    assert.equal(nextFrameIndex(2, 1, 5), 3);
  });

  it("copies a gif frame identity onto a drag without moving the source", () => {
    const data = new Map<string, string>();
    const sink = {
      effectAllowed: "",
      setData(type: string, value: string) {
        data.set(type, value);
      },
    };
    assert.equal(writeGifFrameDrag(sink, { itemId: "gif-1", index: 2, name: "dance.gif" }), true);
    assert.equal(sink.effectAllowed, "copy");
    assert.equal(data.get("text/plain"), "GIF_Frame_003.png");
    assert.deepEqual(readGifFrameDrag(data.get(GIF_FRAME_DRAG) ?? ""), { itemId: "gif-1", index: 2, name: "dance.gif" });
    assert.equal(readGifFrameDrag("{"), null);
    assert.equal(readGifFrameDrag(JSON.stringify({ itemId: "", index: 1 })), null);
    assert.equal(writeGifFrameDrag(sink, { itemId: "gif-1", index: 1.5, name: "dance.gif" }), false);
  });

  it("offers the composited png and does not replace a bitmap the browser already attached", () => {
    const png = new File([Uint8Array.from([1, 2, 3, 4])], "GIF_Frame_003.png", { type: "image/png" });
    const files: File[] = [];
    const data = new Map<string, string>();
    const sink: FrameDragSink = {
      effectAllowed: "",
      files,
      setData(type, value) {
        data.set(type, value);
      },
      items: {
        add(file) {
          files.push(file);
        },
      },
    };
    assert.equal(placeFrameDrag(sink, png, "blob:http://local/frame"), true);
    assert.equal(sink.effectAllowed, "copy");
    assert.equal(files[0], png);
    assert.equal(data.get("text/plain"), "GIF_Frame_003.png");
    assert.equal(data.get("DownloadURL"), "image/png:GIF_Frame_003.png:blob:http://local/frame");
    assert.equal(data.has("application/x-komacho-shot"), false);
    const native = new File([Uint8Array.from([9])], "image.png", { type: "image/png" });
    const kept: File[] = [native];
    const again: FrameDragSink = {
      effectAllowed: "",
      files: kept,
      setData() {},
      items: {
        add() {
          throw new Error("should not replace");
        },
      },
    };
    assert.equal(placeFrameDrag(again, png, null), true);
    assert.deepEqual(kept, [native]);
    const blocked: FrameDragSink = {
      effectAllowed: "",
      setData() {},
      items: {
        add() {
          throw new Error("blocked");
        },
      },
    };
    assert.equal(placeFrameDrag(blocked, png, null), false);
    const dataUrl = "data:image/png;base64,AAAA";
    const named: File[] = [];
    const namedData = new Map<string, string>();
    assert.equal(
      placeFrameDrag(
        {
          effectAllowed: "",
          files: named,
          setData(type, value) {
            namedData.set(type, value);
          },
          items: {
            add(file) {
              named.push(file);
            },
          },
        },
        png,
        dataUrl,
      ),
      true,
    );
    assert.equal(namedData.get("DownloadURL"), `image/png:${png.name}:${dataUrl}`);
    assert.equal(named[0], png);
    const keptFile: File[] = [];
    assert.equal(
      placeFrameDrag(
        {
          effectAllowed: "",
          files: keptFile,
          setData(type) {
            if (type === "DownloadURL") throw new Error("too long");
          },
          items: {
            add(file) {
              keptFile.push(file);
            },
          },
        },
        png,
        dataUrl,
      ),
      true,
    );
    assert.equal(keptFile[0], png);
  });

  it("tells a folder add apart from the parent-folder chooser", () => {
    assert.equal(frameAddOutcome(3, 4, false), "added");
    assert.equal(frameAddOutcome(3, 3, true), "choose-folder");
    assert.equal(frameAddOutcome(3, 3, false), "unchanged");
  });

  it("lists composited frames in play order and paints one png by walking again", async () => {
    const revoked: string[] = [];
    const session = openGifFrameSession(sampleGif(), painter(revoked));
    const thumbs: { index: number; delayMs: number; url: string }[] = [];
    const listed = await session.list((thumb) => thumbs.push(thumb));
    assert.equal(listed.failed, false);
    assert.equal(listed.aborted, false);
    assert.deepEqual(
      thumbs.map((thumb) => [thumb.index, thumb.delayMs, thumb.url]),
      [
        [0, 50, "blob:1"],
        [1, 70, "blob:2"],
      ],
    );
    const first = await session.png(0);
    const second = await session.png(1);
    assert.equal(first?.width, 2);
    assert.equal(first?.height, 2);
    const red = new Uint8Array(await first!.blob.arrayBuffer());
    const blue = new Uint8Array(await second!.blob.arrayBuffer());
    assert.deepEqual([red[0], red[1], red[2], red[3]], [255, 0, 0, 255]);
    assert.deepEqual([blue[0], blue[1], blue[2], blue[3]], [0, 0, 255, 255]);
    session.release();
    assert.equal(session.released, true);
    assert.deepEqual(red.slice(0, 4), Uint8Array.from([255, 0, 0, 255]));
    assert.equal(await session.png(0), null);
  });

  it("stops a cancelled walk, revokes the unpublished url, and revokes the rest once", async () => {
    const revoked: string[] = [];
    const ac = new AbortController();
    const session = openGifFrameSession(sampleGif(), painter(revoked, ac));
    const published: string[] = [];
    const listed = await session.list((thumb) => published.push(thumb.url), ac.signal);
    assert.equal(listed.aborted, true);
    assert.deepEqual(published, ["blob:1"]);
    assert.deepEqual(revoked, ["blob:2"]);
    session.release();
    session.release();
    assert.deepEqual(revoked, ["blob:2", "blob:1"]);
  });

  it("starts a later session with its own urls", async () => {
    const firstRevoked: string[] = [];
    const secondRevoked: string[] = [];
    const first = openGifFrameSession(sampleGif(), painter(firstRevoked));
    const second = openGifFrameSession(sampleGif(), painter(secondRevoked));
    await first.list(() => undefined);
    first.release();
    const thumbs: string[] = [];
    await second.list((thumb) => thumbs.push(thumb.url));
    assert.deepEqual(thumbs, ["blob:1", "blob:2"]);
    assert.deepEqual(secondRevoked, []);
    second.release();
    assert.deepEqual(secondRevoked, ["blob:2", "blob:1"]);
    assert.deepEqual(firstRevoked, ["blob:2", "blob:1"]);
  });
});
