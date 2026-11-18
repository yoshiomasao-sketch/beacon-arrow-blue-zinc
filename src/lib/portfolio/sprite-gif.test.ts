import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openGifReader } from "./gif-decode.ts";
import { clampGifScale, encodeSpriteGif, spriteGifOutputSize } from "./sprite-gif.ts";
import { playbackTimeline, type SpriteDoc, type SpriteFrame } from "./sprite-sheet.ts";

function solid(id: string, rgba: [number, number, number, number], durationMs: number | null): SpriteFrame {
  const data = new Uint8ClampedArray(4);
  data.set(rgba);
  return { id, width: 1, height: 1, rgba: data, durationMs, flipX: false, flipY: false };
}

function doc(frames: SpriteFrame[], patch: Partial<SpriteDoc> = {}): SpriteDoc {
  return {
    name: "スプライト",
    fps: 10,
    speed: 1,
    loop: "infinite",
    loopCount: 3,
    order: "forward",
    startFrame: 1,
    endFrame: frames.length,
    layout: "row",
    columns: 4,
    zoom: 2,
    previewZoom: 2,
    background: "checker",
    solid: "#000000",
    frames,
    slices: [],
    nines: [],
    ...patch,
  };
}

/** Graphic Control Extension delays, in centiseconds, in the order gifenc wrote them. */
function gifDelays(bytes: Uint8Array): number[] {
  const delays: number[] = [];
  for (let index = 0; index < bytes.length - 6; index += 1) {
    if (bytes[index] !== 0x21 || bytes[index + 1] !== 0xf9 || bytes[index + 2] !== 0x04) continue;
    delays.push((bytes[index + 4] ?? 0) + ((bytes[index + 5] ?? 0) << 8));
  }
  return delays;
}

describe("sprite gif", () => {
  it("writes the same frame timing and order the preview timeline uses", () => {
    const frames = [solid("a", [255, 0, 0, 255], 200), solid("b", [0, 255, 0, 255], null), solid("c", [0, 0, 255, 255], 80)];
    const forward = doc(frames);
    const forwardBytes = encodeSpriteGif(forward);
    assert.ok(forwardBytes);
    assert.deepEqual(
      gifDelays(forwardBytes),
      playbackTimeline(forward).map((step) => step.ms / 10),
    );
    const reverse = doc(frames, { order: "reverse", speed: 2, startFrame: 1, endFrame: 2 });
    const reverseBytes = encodeSpriteGif(reverse);
    assert.ok(reverseBytes);
    assert.deepEqual(
      gifDelays(reverseBytes),
      playbackTimeline(reverse).map((step) => step.ms / 10),
    );
  });

  it("keeps timing and order when the GIF is scaled, and blocks a frame that would be too large", () => {
    assert.equal(clampGifScale(0), 1);
    assert.equal(clampGifScale(12.4), 12);
    assert.deepEqual(spriteGifOutputSize(8, 4, 3), { width: 24, height: 12, scale: 3 });
    assert.equal(spriteGifOutputSize(2000, 8, 12), null);
    const frames = [solid("a", [255, 0, 0, 255], 200), solid("b", [0, 0, 255, 255], 80)];
    const source = doc(frames, { order: "reverse", loop: "once" });
    const before = frames.map((frame) => [...frame.rgba]);
    const bytes = encodeSpriteGif(source, 4);
    assert.ok(bytes);
    assert.deepEqual(frames.map((frame) => [...frame.rgba]), before);
    assert.deepEqual(gifDelays(bytes), playbackTimeline(source).map((step) => step.ms / 10));
    const reader = openGifReader(bytes);
    assert.equal(reader.width, 4);
    assert.equal(reader.height, 4);
    const first = reader.next();
    assert.ok(first);
    assert.equal(first.delayMs, 80);
    assert.deepEqual([...first.rgba], new Array(16).fill([0, 0, 255, 255]).flat());
    const huge = solid("big", [1, 2, 3, 255], 100);
    huge.width = 2000;
    huge.height = 8;
    huge.rgba = new Uint8ClampedArray(2000 * 8 * 4);
    assert.equal(encodeSpriteGif(doc([huge], { endFrame: 1 }), 12), null);
    assert.equal(huge.width, 2000);
  });

  it("copies each pixel into a sharp block and keeps a transparent pixel empty", () => {
    const frame = solid("a", [0, 0, 0, 0], 100);
    frame.width = 2;
    frame.height = 1;
    frame.rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]);
    const bytes = encodeSpriteGif(doc([frame], { endFrame: 1 }), 2);
    assert.ok(bytes);
    const picture = openGifReader(bytes).next();
    assert.ok(picture);
    assert.equal(picture.width, 4);
    assert.equal(picture.height, 2);
    const pixel = (x: number, y: number) => [...picture.rgba.subarray((y * 4 + x) * 4, (y * 4 + x) * 4 + 4)];
    assert.deepEqual(pixel(0, 0), [255, 0, 0, 255]);
    assert.deepEqual(pixel(1, 1), [255, 0, 0, 255]);
    assert.deepEqual(pixel(2, 0), [0, 0, 0, 0]);
    assert.deepEqual(pixel(3, 1), [0, 0, 0, 0]);
    assert.deepEqual([...frame.rgba], [255, 0, 0, 255, 0, 0, 0, 0]);
  });
});
