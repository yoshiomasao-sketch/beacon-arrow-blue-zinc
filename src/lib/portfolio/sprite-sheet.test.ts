import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adoptFrames,
  cellRgba,
  composeSheet,
  fittedSize,
  integerPixelFit,
  enlargedPixelView,
  isSmallPixelArt,
  frameSizeReason,
  gifRepeatCount,
  holdMs,
  clampHoldMs,
  fpsHoldMs,
  orderedIndexes,
  playbackFrames,
  playbackTimeline,
  playbackPreviewSteps,
  playbackStopIndex,
  scaleNearest,
  shiftFrames,
  sliceFrame,
  splitPlan,
  spriteSettings,
  composeOnionPreview,
  emptyOnionSkin,
  encodeOnionSkin,
  onionAlphaScale,
  onionLayers,
  parseOnionSkin,
  deleteSpriteFrames,
  duplicateSpriteFrames,
  framePivot,
  frameSheetPivot,
  pivotFromVisual,
  presetPivot,
  readPivot,
  visualPivot,
  moveSpriteFrames,
  pickSpriteFrames,
  emptySpritePick,
  pushSpriteHistory,
  undoSpriteHistory,
  redoSpriteHistory,
  emptySpriteFrameHistory,
  emptySpriteDocHistory,
  moveSlice,
  nextSliceNumber,
  nineBands,
  nineSliceRgba,
  pixelRect,
  readNines,
  setNineMargin,
  placeSlice,
  pushSpriteEdit,
  readSlices,
  redoSpriteDoc,
  resizeSlice,
  slicePixels,
  slicePivot,
  sliceSheetPivot,
  undoSpriteDoc,
  reorderFrame,
  type SpriteDoc,
  type SpriteFrame,
} from "./sprite-sheet.ts";

function solid(id: string, width: number, height: number, rgba: [number, number, number, number], durationMs: number | null = null): SpriteFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) data.set(rgba, i * 4);
  return { id, width, height, rgba: data, durationMs, flipX: false, flipY: false };
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
    endFrame: frames.length || 1,
    layout: "row",
    columns: 4,
    zoom: 8,
    previewZoom: 3,
    background: "checker",
    solid: "#000000",
    frames,
    slices: [],
    nines: [],
    ...patch,
  };
}

describe("sprite sheet", () => {
  it("rejects frames larger than 256 and accepts exact pixels", () => {
    assert.equal(frameSizeReason(256, 256), null);
    assert.match(frameSizeReason(257, 16) ?? "", /257×16/);
    assert.match(frameSizeReason(16, 300) ?? "", /16×300/);
  });

  it("uses one timeline for preview and gif, with per-frame duration winning over fps", () => {
    const frames = [solid("a", 2, 2, [1, 2, 3, 255], 200), solid("b", 2, 2, [4, 5, 6, 255])];
    const timeline = playbackTimeline(doc(frames, { fps: 10, speed: 1 }));
    assert.deepEqual(timeline, [
      { index: 0, ms: 200 },
      { index: 1, ms: 100 },
    ]);
    assert.equal(holdMs({ durationMs: null }, 10, 2), 50);
    assert.equal(holdMs({ durationMs: 80 }, 10, 4), 20);
    const played = playbackFrames(doc(frames));
    assert.deepEqual(
      played.steps.map((step) => step.ms),
      timeline.map((step) => step.ms),
    );
  });

  it("keeps a frame's own hold when fps changes and snaps new holds to 10ms", () => {
    assert.equal(fpsHoldMs(10), 100);
    assert.equal(fpsHoldMs(12), 80);
    assert.equal(fpsHoldMs(60), 20);
    assert.equal(clampHoldMs(155), 160);
    assert.equal(clampHoldMs(6), 10);
    assert.equal(clampHoldMs(9000), 5000);
    assert.equal(clampHoldMs(Number.NaN), 100);
    const frames = [
      solid("a", 1, 1, [1, 0, 0, 255], 100),
      solid("b", 1, 1, [0, 1, 0, 255], 150),
      solid("c", 1, 1, [0, 0, 1, 255], 250),
      solid("d", 1, 1, [1, 1, 0, 255], 100),
    ];
    assert.deepEqual(
      playbackTimeline(doc(frames, { fps: 12 })).map((step) => step.ms),
      [100, 150, 250, 100],
    );
    assert.deepEqual(
      playbackTimeline(doc(frames, { fps: 24 })).map((step) => step.ms),
      [100, 150, 250, 100],
    );
  });

  it("plays forward, reverse, and ping-pong inside the chosen range", () => {
    assert.deepEqual(orderedIndexes([0, 1, 2, 3], "forward"), [0, 1, 2, 3]);
    assert.deepEqual(orderedIndexes([0, 1, 2, 3], "reverse"), [3, 2, 1, 0]);
    assert.deepEqual(orderedIndexes([0, 1, 2, 3], "pingpong"), [0, 1, 2, 3, 2, 1]);
    assert.deepEqual(orderedIndexes([0, 1], "pingpong"), [0, 1, 0]);
    const frames = [solid("a", 1, 1, [1, 0, 0, 255], 100), solid("b", 1, 1, [0, 1, 0, 255], 150), solid("c", 1, 1, [0, 0, 1, 255], 250), solid("d", 1, 1, [1, 1, 0, 255], 80)];
    const forward = playbackPreviewSteps(doc(frames));
    assert.deepEqual(forward.map((step) => step.index), [0, 1, 2, 3]);
    assert.deepEqual(forward.map((step) => step.ms), [100, 150, 250, 80]);
    const reverse = playbackPreviewSteps(doc(frames, { order: "reverse" }));
    assert.deepEqual(reverse.map((step) => [step.index, step.ms]), [[3, 80], [2, 250], [1, 150], [0, 100]]);
    const bounce = playbackPreviewSteps(doc(frames, { order: "pingpong" }));
    assert.deepEqual(bounce.map((step) => step.index), [0, 1, 2, 3, 2, 1]);
    assert.deepEqual(bounce.map((step) => step.ms), [100, 150, 250, 80, 250, 150]);
    const two = [frames[0]!, frames[1]!];
    assert.deepEqual(playbackTimeline(doc(two, { order: "pingpong" })).map((step) => step.index), [0, 1, 0]);
    assert.deepEqual(playbackPreviewSteps(doc(two, { order: "pingpong" })).map((step) => step.index), [0, 1]);
    assert.equal(playbackStopIndex(bounce, "pingpong"), 0);
    assert.equal(playbackStopIndex(reverse, "reverse"), 0);
    assert.equal(playbackStopIndex(forward, "forward"), 3);
    assert.deepEqual(
      playbackTimeline(doc(frames, { startFrame: 2, endFrame: 3, order: "reverse" })).map((step) => step.index),
      [2, 1],
    );
  });

  it("maps loop counts onto gif repeat without treating one play as forever", () => {
    assert.equal(gifRepeatCount("infinite", 4), 0);
    assert.equal(gifRepeatCount("once", 4), -1);
    assert.equal(gifRepeatCount("count", 1), -1);
    assert.equal(gifRepeatCount("count", 3), 2);
  });

  it("packs a sheet without scaling and keeps animation order independent of wrap", () => {
    const frames = [
      solid("a", 2, 1, [10, 0, 0, 255]),
      solid("b", 1, 2, [0, 20, 0, 255]),
      solid("c", 2, 2, [0, 0, 30, 255]),
    ];
    const row = composeSheet(doc(frames, { layout: "row" }));
    assert.equal(row.cols, 3);
    assert.equal(row.rows, 1);
    assert.equal(row.cellW, 2);
    assert.equal(row.cellH, 2);
    assert.equal(row.width, 6);
    assert.equal(row.height, 2);
    assert.equal(row.rgba[3], 255);
    assert.equal(row.rgba[(1 * 6 + 2) * 4 + 1], 20);
    const wrapped = composeSheet(doc(frames, { layout: "wrap", columns: 2 }));
    assert.deepEqual({ cols: wrapped.cols, rows: wrapped.rows, width: wrapped.width, height: wrapped.height }, { cols: 2, rows: 2, width: 4, height: 4 });
    assert.deepEqual(
      playbackTimeline(doc(frames, { layout: "column" })).map((step) => step.index),
      [0, 1, 2],
    );
  });

  it("flips only the playback cell and leaves a transparent margin", () => {
    const frame = solid("a", 2, 1, [0, 0, 0, 0]);
    frame.rgba.set([9, 8, 7, 255], 0);
    frame.flipX = true;
    const cell = cellRgba(frame, 2, 2);
    assert.equal(cell[3], 0);
    assert.equal(cell[7], 255);
    assert.equal(cell[4], 9);
    assert.equal(cell[(1 * 2) * 4 + 3], 0);
  });

  it("fits a large gif frame inside 256 and copies the nearest pixel with its alpha", () => {
    assert.deepEqual(fittedSize(256, 256), { width: 256, height: 256 });
    assert.deepEqual(fittedSize(10, 20), { width: 10, height: 20 });
    assert.deepEqual(fittedSize(720, 720), { width: 256, height: 256 });
    assert.deepEqual(fittedSize(300, 100), { width: 256, height: 85 });
    assert.deepEqual(fittedSize(257, 10), { width: 256, height: 10 });
    const src = new Uint8ClampedArray([255, 0, 0, 128, 0, 0, 255, 64]);
    assert.deepEqual([...scaleNearest(src, 2, 1, 1, 1)], [0, 0, 255, 64]);
    assert.equal(scaleNearest(src, 2, 1, 2, 1), src);
    const block = scaleNearest(new Uint8ClampedArray([1, 2, 3, 4]), 1, 1, 3, 3);
    for (let index = 0; index < 9; index += 1) assert.deepEqual([...block.subarray(index * 4, index * 4 + 4)], [1, 2, 3, 4]);
    assert.deepEqual(integerPixelFit(256, 256, 32, 32), { scale: 8, width: 256, height: 256, x: 0, y: 0, integer: true });
    assert.deepEqual(integerPixelFit(256, 256, 64, 64), { scale: 4, width: 256, height: 256, x: 0, y: 0, integer: true });
    assert.deepEqual(integerPixelFit(256, 256, 128, 128), { scale: 2, width: 256, height: 256, x: 0, y: 0, integer: true });
    assert.deepEqual(integerPixelFit(256, 256, 256, 256), { scale: 1, width: 256, height: 256, x: 0, y: 0, integer: true });
    const wide = integerPixelFit(256, 256, 200, 100);
    assert.equal(wide.scale, 1);
    assert.equal(wide.width, 200);
    assert.equal(wide.height, 100);
    assert.equal(wide.x, 28);
    assert.equal(wide.y, 78);
    assert.equal(wide.integer, true);
    assert.deepEqual(integerPixelFit(32, 32, 16, 16), { scale: 2, width: 32, height: 32, x: 0, y: 0, integer: true });
    assert.deepEqual(integerPixelFit(64, 64, 16, 16), { scale: 4, width: 64, height: 64, x: 0, y: 0, integer: true });
    assert.deepEqual(integerPixelFit(96, 96, 16, 16), { scale: 6, width: 96, height: 96, x: 0, y: 0, integer: true });
    assert.deepEqual(integerPixelFit(128, 128, 16, 16), { scale: 8, width: 128, height: 128, x: 0, y: 0, integer: true });
    const partial = integerPixelFit(100, 90, 32, 32);
    assert.equal(partial.scale, 2);
    assert.equal(partial.width, 64);
    assert.equal(partial.height, 64);
    assert.equal(partial.integer, true);
    assert.ok(partial.width <= 100 && partial.height <= 90);
    const shrink = integerPixelFit(30, 20, 60, 40);
    assert.equal(shrink.integer, false);
    assert.ok(shrink.scale < 1);
    assert.ok(Math.abs(shrink.width - 30) < 0.001);
    assert.ok(Math.abs(shrink.height - 20) < 0.001);
    assert.equal(enlargedPixelView(32, 32, 160, 160, false), true);
    assert.equal(isSmallPixelArt(32, 32), true);
    assert.equal(isSmallPixelArt(256, 128), true);
    assert.equal(isSmallPixelArt(257, 100), false);
    assert.equal(enlargedPixelView(32, 32, 40, 40, false), true);
    assert.equal(enlargedPixelView(32, 32, 20, 20, true), true);
    assert.equal(enlargedPixelView(32, 32, 20, 20, false), true);
    assert.equal(enlargedPixelView(4000, 3000, 800, 600, false), false);
    assert.equal(enlargedPixelView(64, 64, 128, 128, false), true);
    assert.equal(enlargedPixelView(64, 64, 100, 100, false), true);
    assert.equal(enlargedPixelView(200, 100, 100, 80, false), true);
    assert.equal(enlargedPixelView(800, 600, 900, 700, false), false);
    assert.equal(enlargedPixelView(800, 600, 2000, 1500, false), true);
    assert.equal(enlargedPixelView(32, 32, 0, 100, false), false);
  });

  it("splits with a remainder instead of stretching, and copies one cell", () => {
    assert.deepEqual(splitPlan(32, 16, 2, 1), { ok: true, frameW: 16, frameH: 16, remW: 0, remH: 0, usedW: 32, usedH: 16 });
    assert.deepEqual(splitPlan(31, 16, 2, 1), { ok: true, frameW: 15, frameH: 16, remW: 1, remH: 0, usedW: 30, usedH: 16 });
    assert.equal(splitPlan(512, 256, 1, 1).ok, false);
    assert.equal(splitPlan(8, 8, 9, 1).ok, false);
    const src = new Uint8ClampedArray(4 * 2 * 4);
    src.set([5, 6, 7, 8], 8);
    const slice = sliceFrame(src, 4, 2, 1, 1, 0);
    assert.deepEqual([...slice.subarray(0, 4)], [5, 6, 7, 8]);
  });

  it("packs different frame sizes into the max cell without scaling", () => {
    const small = solid("a", 1, 1, [9, 0, 0, 200]);
    const wide = solid("b", 2, 1, [0, 8, 0, 255]);
    const sheet = composeSheet(doc([small, wide], { layout: "wrap", columns: 2 }));
    assert.equal(sheet.cellW, 2);
    assert.equal(sheet.cellH, 1);
    assert.equal(sheet.width, 4);
    assert.equal(sheet.height, 1);
    assert.equal(sheet.rgba[0], 9);
    assert.equal(sheet.rgba[3], 200);
    assert.equal(sheet.rgba[7], 0);
    assert.equal(sheet.rgba[8], 0);
    assert.equal(sheet.rgba[9], 8);
  });

  it("shifts a selection without dropping frames and keeps new frames inside an open range", () => {
    const frames = [solid("a", 1, 1, [1, 0, 0, 255]), solid("b", 1, 1, [0, 1, 0, 255]), solid("c", 1, 1, [0, 0, 1, 255])];
    assert.deepEqual(
      shiftFrames(frames, ["a", "b"], 1).map((frame) => frame.id),
      ["c", "a", "b"],
    );
    const grown = adoptFrames(doc(frames, { endFrame: 3 }), frames.concat(solid("d", 1, 1, [2, 2, 2, 255])));
    assert.equal(grown.endFrame, 4);
    const limited = adoptFrames(doc(frames, { endFrame: 2 }), frames.concat(solid("d", 1, 1, [2, 2, 2, 255])));
    assert.equal(limited.endFrame, 2);
    const settings = spriteSettings(grown);
    assert.equal(settings.frameCount, 4);
    assert.equal(settings.frames[3]?.playbackMs, 100);
    assert.equal(settings.columns, 4);
  });

  it("stacks onion skins without changing frame pixels or exports", () => {
    const frames = [
      solid("a", 1, 1, [200, 20, 20, 255]),
      solid("b", 1, 1, [0, 0, 0, 0]),
      solid("c", 1, 1, [20, 40, 200, 255]),
      solid("d", 1, 1, [0, 180, 0, 255]),
    ];
    const before = frames.map((frame) => [...frame.rgba]);
    const skin = { ...emptyOnionSkin(), on: true, before: 3, after: 3, beforeOpacity: 25, afterOpacity: 50 };
    assert.deepEqual(
      onionLayers(4, 0, 3, 1).map((layer) => layer.index),
      [1],
    );
    assert.deepEqual(
      onionLayers(4, 3, 1, 3).map((layer) => layer.index),
      [2],
    );
    assert.deepEqual(
      onionLayers(4, 1, 2, 2).map((layer) => `${layer.side}:${layer.index}:${layer.distance}`),
      ["before:0:1", "after:3:2", "after:2:1"],
    );
    assert.equal(onionAlphaScale(25, 1), 0.25);
    assert.ok(Math.abs(onionAlphaScale(25, 2) - 0.175) < 1e-9);
    assert.ok(Math.abs(onionAlphaScale(25, 3) - 0.1) < 1e-9);
    assert.equal(onionAlphaScale(0, 1), 0);
    const nextOnly = composeOnionPreview(frames, 1, 1, 1, { ...skin, before: 0, after: 1, afterOpacity: 50 }, false);
    assert.ok(nextOnly);
    assert.equal(nextOnly[3], 128);
    assert.ok(nextOnly[2] > nextOnly[0]);
    const prevOnly = composeOnionPreview(frames, 1, 1, 1, { ...skin, before: 1, after: 0, beforeOpacity: 100 }, false);
    assert.ok(prevOnly);
    assert.equal(prevOnly[3], 255);
    assert.ok(prevOnly[0] > prevOnly[2]);
    const gap = [
      solid("far", 1, 1, [0, 180, 0, 255]),
      solid("gap", 1, 1, [0, 0, 0, 0]),
      solid("now", 1, 1, [0, 0, 0, 0]),
    ];
    const distant = composeOnionPreview(gap, 2, 1, 1, { ...emptyOnionSkin(), on: true, before: 2, after: 0, beforeOpacity: 100 }, false);
    assert.ok(distant);
    assert.equal(distant[3], Math.round(255 * 0.7));
    const covered = solid("now", 1, 1, [10, 180, 30, 255]);
    const shown = composeOnionPreview([frames[0]!, covered, frames[2]!], 1, 1, 1, { ...skin, beforeOpacity: 100, afterOpacity: 100 }, false);
    assert.deepEqual([...(shown ?? [])], [10, 180, 30, 255]);
    const plain = composeOnionPreview(frames, 1, 1, 1, skin, true);
    assert.deepEqual([...(plain ?? [])], [...cellRgba(frames[1]!, 1, 1)]);
    const off = composeOnionPreview(frames, 1, 1, 1, { ...skin, on: false }, false);
    assert.deepEqual([...(off ?? [])], [...cellRgba(frames[1]!, 1, 1)]);
    assert.deepEqual(frames.map((frame) => [...frame.rgba]), before);
    const settings = spriteSettings(doc(frames));
    assert.equal(JSON.stringify(settings).includes("beforeOpacity"), false);
    const saved = encodeOnionSkin(skin);
    assert.deepEqual(parseOnionSkin(saved), {
      on: true,
      before: 3,
      after: 3,
      beforeOpacity: 25,
      afterOpacity: 50,
    });
    assert.deepEqual(parseOnionSkin("nope"), emptyOnionSkin());
    assert.equal(parseOnionSkin(JSON.stringify({ on: true, before: 9, after: -2, beforeOpacity: 400, afterOpacity: 0 })).before, 3);
    assert.equal(parseOnionSkin(JSON.stringify({ on: true, before: 0, after: 0, beforeOpacity: 0, afterOpacity: 0 })).before, 0);
  });

  it("selects frames like a file list and keeps the edited frame still", () => {
    const order = ["a", "b", "c", "d"];
    const single = pickSpriteFrames(order, emptySpritePick(), "b", "single");
    assert.deepEqual(single, { ids: ["b"], anchorId: "b", activeId: "b" });
    const added = pickSpriteFrames(order, single, "d", "toggle");
    assert.deepEqual(added.ids, ["b", "d"]);
    assert.equal(added.anchorId, "d");
    assert.equal(added.activeId, "b");
    const ranged = pickSpriteFrames(order, added, "a", "range");
    assert.deepEqual(ranged.ids, ["a", "b", "c", "d"]);
    assert.equal(ranged.anchorId, "d");
    assert.equal(ranged.activeId, "b");
    const removed = pickSpriteFrames(order, ranged, "b", "toggle");
    assert.deepEqual(removed.ids, ["a", "c", "d"]);
    assert.equal(removed.anchorId, "b");
    assert.equal(removed.activeId, "b");
    const again = pickSpriteFrames(order, removed, "c", "single");
    assert.deepEqual(again, { ids: ["c"], anchorId: "c", activeId: "c" });
  });

  it("duplicates after the selection, deletes without emptying, and moves a block", () => {
    const frames = [
      solid("a", 1, 1, [1, 0, 0, 255]),
      solid("b", 1, 1, [0, 2, 0, 255]),
      solid("c", 1, 1, [0, 0, 3, 255]),
      solid("d", 1, 1, [4, 0, 0, 128]),
    ];
    frames[0]!.flipX = true;
    frames[1]!.durationMs = 40;
    let n = 0;
    const copied = duplicateSpriteFrames(frames, ["b", "d"], () => `copy-${n++}`);
    assert.deepEqual(copied.frames.map((frame) => frame.id), ["a", "b", "c", "d", "copy-0", "copy-1"]);
    assert.deepEqual(copied.copyIds, ["copy-0", "copy-1"]);
    assert.equal(copied.frames[4]?.durationMs, 40);
    assert.equal(copied.frames[5]?.rgba[3], 128);
    copied.frames[4]!.rgba[1] = 9;
    assert.equal(frames[1]!.rgba[1], 2);
    const one = duplicateSpriteFrames(frames, ["b"], () => "b2");
    assert.deepEqual(one.frames.map((frame) => frame.id), ["a", "b", "b2", "c", "d"]);
    assert.deepEqual(deleteSpriteFrames(frames, ["a"], "b").map((frame) => frame.id), ["b", "c", "d"]);
    assert.deepEqual(deleteSpriteFrames(frames, ["a", "b", "c", "d"], "c").map((frame) => frame.id), ["c"]);
    assert.deepEqual(deleteSpriteFrames(frames, ["a", "b", "c", "d"], null).map((frame) => frame.id), ["a"]);
    assert.deepEqual(deleteSpriteFrames([frames[0]!], ["a"], "a").map((frame) => frame.id), ["a"]);
    assert.deepEqual(
      moveSpriteFrames(frames, ["b", "c"], { id: "d", place: "after" }).map((frame) => frame.id),
      ["a", "d", "b", "c"],
    );
    assert.deepEqual(
      moveSpriteFrames(frames, ["d"], { id: "b", place: "before" }).map((frame) => frame.id),
      ["a", "d", "b", "c"],
    );
    assert.deepEqual(
      moveSpriteFrames(frames, ["b", "c"], { id: "b", place: "before" }).map((frame) => frame.id),
      ["a", "b", "c", "d"],
    );
    assert.deepEqual(reorderFrame(frames, "a", "c").map((frame) => frame.id), ["b", "c", "a", "d"]);
    const history = pushSpriteHistory(emptySpriteFrameHistory(), frames);
    const undone = undoSpriteHistory(history, copied.frames);
    assert.ok(undone);
    assert.deepEqual(undone.frames.map((frame) => frame.id), ["a", "b", "c", "d"]);
    assert.equal(undone.frames[0]?.flipX, true);
    undone.frames[0]!.rgba[0] = 50;
    assert.equal(frames[0]!.rgba[0], 1);
    const redone = redoSpriteHistory(undone.history, undone.frames);
    assert.ok(redone);
    assert.deepEqual(redone.frames.map((frame) => frame.id), ["a", "b", "c", "d", "copy-0", "copy-1"]);
    assert.equal(undoSpriteHistory(emptySpriteFrameHistory(), frames), null);
  });

  it("keeps a pivot on the frame, not in the pixels", () => {
    const wide = solid("a", 4, 2, [9, 0, 0, 255]);
    const tall = solid("b", 2, 4, [0, 8, 0, 255]);
    assert.deepEqual(framePivot(wide), { x: 2, y: 1 });
    assert.equal(readPivot(null), undefined);
    assert.equal(readPivot({ x: Number.POSITIVE_INFINITY, y: 1 }), undefined);
    assert.deepEqual(readPivot({ x: -4, y: 9 }), { x: -4, y: 9 });
    assert.deepEqual(presetPivot(4, 2, "nw"), { x: 0, y: 0 });
    assert.deepEqual(presetPivot(4, 2, "n"), { x: 2, y: 0 });
    assert.deepEqual(presetPivot(4, 2, "ne"), { x: 4, y: 0 });
    assert.deepEqual(presetPivot(4, 2, "w"), { x: 0, y: 1 });
    assert.deepEqual(presetPivot(4, 2, "c"), { x: 2, y: 1 });
    assert.deepEqual(presetPivot(4, 2, "e"), { x: 4, y: 1 });
    assert.deepEqual(presetPivot(4, 2, "sw"), { x: 0, y: 2 });
    assert.deepEqual(presetPivot(4, 2, "s"), { x: 2, y: 2 });
    assert.deepEqual(presetPivot(4, 2, "se"), { x: 4, y: 2 });
    wide.pivot = { x: -3, y: 8 };
    wide.flipX = true;
    assert.deepEqual(framePivot(wide), { x: -3, y: 8 });
    assert.deepEqual(visualPivot(wide), { x: 7, y: 8 });
    assert.deepEqual(pivotFromVisual(wide, 7, 8), { x: -3, y: 8 });
    const pixels = [...wide.rgba];
    const bare = composeSheet(doc([wide, tall]));
    const marked = composeSheet(doc([{ ...wide, pivot: { x: 1, y: 0 } }, { ...tall, pivot: { x: 0, y: 4 } }]));
    assert.deepEqual([...bare.rgba], [...marked.rgba]);
    assert.deepEqual([...wide.rgba], pixels);
    assert.deepEqual(frameSheetPivot(wide, 0, 0, bare.cellW, bare.cellH), { x: -3, y: 8 });
    assert.deepEqual(frameSheetPivot(tall, 1, 0, bare.cellW, bare.cellH), { x: bare.cellW + 1, y: 2 });
    const settings = spriteSettings(doc([wide, tall], { layout: "row" }));
    assert.deepEqual(settings.frames[0]?.pivot, { x: -3, y: 8 });
    assert.deepEqual(settings.frames[1]?.pivot, { x: 1, y: 2 });
    assert.deepEqual(settings.frames[1]?.sheetPivot, { x: bare.cellW + 1, y: 2 });
    const copied = duplicateSpriteFrames([wide, tall], ["a"], () => "a2");
    assert.deepEqual(copied.frames[1]?.pivot, { x: -3, y: 8 });
    assert.notEqual(copied.frames[1]?.rgba, wide.rgba);
    const moved = moveSpriteFrames(copied.frames, ["a"], { id: "b", place: "after" });
    assert.equal(moved.find((frame) => frame.id === "a")?.pivot?.x, -3);
    const dropped = deleteSpriteFrames(copied.frames, ["a"], "b");
    assert.equal(dropped.some((frame) => frame.id === "a"), false);
    assert.equal(dropped.find((frame) => frame.id === "a2")?.pivot?.y, 8);
    const history = pushSpriteHistory(emptySpriteFrameHistory(), [wide, tall]);
    const shifted = [wide, tall].map((frame) => ({ ...frame, pivot: { x: 0, y: frame.height } }));
    const undone = undoSpriteHistory(history, shifted);
    assert.ok(undone);
    assert.equal(undone.history.undo.length, 0);
    assert.equal(undone.history.redo.length, 1);
    assert.deepEqual(undone.frames[0]?.pivot, { x: -3, y: 8 });
    assert.equal(undone.frames[1]?.pivot, undefined);
    const redone = redoSpriteHistory(undone.history, undone.frames);
    assert.ok(redone);
    assert.deepEqual(redone.frames.map((frame) => frame.pivot), [{ x: 0, y: 2 }, { x: 0, y: 4 }]);
  });

  it("keeps slices off the pixels and undoes them without touching frames", () => {
    assert.deepEqual(readSlices(undefined), []);
    assert.deepEqual(readSlices([{ id: "s", number: 2, name: "  足  ", x: 1.2, y: 0, width: 2, height: 2 }]), [
      { id: "s", number: 2, name: "足", x: 1, y: 0, width: 2, height: 2, pivot: null },
    ]);
    const sheet = new Uint8ClampedArray(8 * 4 * 4);
    sheet.set([255, 0, 0, 255], 0);
    sheet.set([0, 0, 0, 0], (8 + 2) * 4);
    const slice = { id: "a", number: 1, name: "Slice 1", x: 0, y: 0, width: 2, height: 1, pivot: null as { x: number; y: number } | null };
    const cut = slicePixels(sheet, 8, 4, slice);
    assert.ok(cut);
    assert.equal(cut.length, 8);
    assert.deepEqual([...cut.slice(0, 4)], [255, 0, 0, 255]);
    assert.deepEqual([...cut.slice(4, 8)], [0, 0, 0, 0]);
    assert.equal(sheet[0], 255);
    assert.equal(slicePixels(sheet, 8, 4, { ...slice, x: 7, width: 2 }), null);
    assert.deepEqual(pixelRect(0.2, 0.2, 0.2, 0.2, 8, 4), { x: 0, y: 0, width: 1, height: 1 });
    assert.deepEqual(pixelRect(1.1, 0, 3.2, 2, 8, 4), { x: 1, y: 0, width: 3, height: 2 });
    assert.deepEqual(pixelRect(-4, -4, 1, 1, 8, 4), { x: 0, y: 0, width: 1, height: 1 });
    const moved = moveSlice({ ...slice, x: 1, y: 1, width: 3, height: 2 }, -5, 9, 8, 4);
    assert.deepEqual({ x: moved.x, y: moved.y }, { x: 0, y: 2 });
    const grown = resizeSlice(slice, "se", 4, 2, 8, 4);
    assert.deepEqual({ x: grown.x, y: grown.y, width: grown.width, height: grown.height }, { x: 0, y: 0, width: 6, height: 3 });
    const blocked = resizeSlice({ ...slice, x: 6, width: 2 }, "e", 8, 0, 8, 4);
    assert.equal(blocked.x + blocked.width, 8);
    const placed = placeSlice(slice, 9, -3, 2, 2, 8, 4);
    assert.deepEqual(placed && { x: placed.x, y: placed.y, width: placed.width, height: placed.height }, { x: 6, y: 0, width: 2, height: 2 });
    assert.equal(placeSlice(slice, 0, 0, 9, 1, 8, 4), null);
    assert.deepEqual(slicePivot(slice), { x: 1, y: 0.5 });
    const foot = { ...slice, pivot: { x: 0, y: 1 } };
    const slid = moveSlice(foot, 2, 0, 8, 4);
    assert.deepEqual(slid.pivot, { x: 0, y: 1 });
    assert.deepEqual(sliceSheetPivot(slid), { x: 2, y: 1 });
    const second = { ...slice, id: "b", number: nextSliceNumber([slice]), name: "Slice 2", x: 0, y: 0 };
    assert.equal(second.number, 2);
    assert.equal(second.name, slice.name ? "Slice 2" : "");
    const frames = [solid("f", 1, 1, [1, 2, 3, 255])];
    const frameHistory = pushSpriteEdit(emptySpriteDocHistory(), { kind: "frames", frames });
    const frameUndo = undoSpriteDoc(frameHistory, { frames: [], slices: [slice] });
    assert.ok(frameUndo?.edit.kind === "frames");
    if (frameUndo?.edit.kind === "frames") {
      assert.equal(frameUndo.edit.frames[0]?.id, "f");
      assert.equal(frameUndo.edit.frames[0]?.rgba[0], 1);
    }
    const sliceHistory = pushSpriteEdit(frameUndo!.history, { kind: "slices", slices: [] });
    const sliceUndo = undoSpriteDoc(sliceHistory, { frames, slices: [slice, second] });
    assert.ok(sliceUndo?.edit.kind === "slices");
    if (sliceUndo?.edit.kind === "slices") assert.deepEqual(sliceUndo.edit.slices, []);
    const sliceRedo = redoSpriteDoc(sliceUndo!.history, { frames, slices: [] });
    assert.ok(sliceRedo?.edit.kind === "slices");
    if (sliceRedo?.edit.kind === "slices") assert.deepEqual(sliceRedo.edit.slices.map((item) => item.id), ["a", "b"]);
    const settings = spriteSettings(doc(frames, { slices: [foot] }));
    assert.deepEqual(settings.slices[0]?.pivot, { x: 0, y: 1 });
    assert.equal(JSON.stringify(settings.frames[0]).includes("rgba"), false);
  });

  it("keeps 9-slice corners and shrinks them only when the output is too small", () => {
    const width = 3;
    const height = 3;
    const src = new Uint8ClampedArray(width * height * 4);
    const put = (x: number, y: number, r: number, g: number, b: number, a: number) => {
      const at = (y * width + x) * 4;
      src[at] = r;
      src[at + 1] = g;
      src[at + 2] = b;
      src[at + 3] = a;
    };
    put(0, 0, 255, 0, 0, 255);
    put(1, 0, 0, 255, 0, 255);
    put(2, 0, 10, 0, 0, 255);
    put(0, 1, 0, 0, 255, 128);
    put(1, 1, 255, 255, 255, 255);
    put(2, 1, 0, 0, 20, 0);
    put(0, 2, 30, 0, 0, 255);
    put(1, 2, 0, 40, 0, 255);
    put(2, 2, 50, 0, 0, 255);
    const before = [...src];
    const margins = { left: 1, right: 1, top: 1, bottom: 1, filter: "nearest" as const };
    const grown = nineSliceRgba(src, width, height, margins, 5, 5);
    assert.ok(grown);
    const at = (x: number, y: number) => [...grown.slice((y * 5 + x) * 4, (y * 5 + x) * 4 + 4)];
    assert.deepEqual(at(0, 0), [255, 0, 0, 255]);
    assert.deepEqual(at(2, 0), [0, 255, 0, 255]);
    assert.deepEqual(at(4, 0), [10, 0, 0, 255]);
    assert.deepEqual(at(0, 2), [0, 0, 255, 128]);
    assert.deepEqual(at(2, 2), [255, 255, 255, 255]);
    assert.deepEqual(at(4, 4), [50, 0, 0, 255]);
    assert.deepEqual([...src], before);
    const same = nineSliceRgba(src, width, height, { ...margins, filter: "bilinear" }, 3, 3);
    assert.ok(same);
    assert.deepEqual([...same], [...src]);
    const tight = nineBands(3, 0, 3, 4);
    assert.equal(tight.some((band) => band.outSize < 0), false);
    assert.equal(tight.reduce((sum, band) => sum + band.outSize, 0), 4);
    assert.equal(tight.some((band) => band.srcSize === 0), false);
    const blocked = setNineMargin(
      { frameId: "a", left: 1, right: 1, top: 1, bottom: 1, filter: "nearest", previewWidth: 3, previewHeight: 3 },
      3,
      3,
      "left",
      9,
    );
    assert.equal(blocked.left, 2);
    assert.equal(blocked.right, 1);
    assert.equal(nineSliceRgba(src, width, height, margins, 0, 4), null);
    assert.deepEqual(readNines(undefined), []);
    assert.equal(readNines([{ frameId: "a", left: 2, right: -4, filter: "bilinear", previewWidth: 12, previewHeight: 8 }])[0]?.filter, "bilinear");
    const settings = spriteSettings(doc([], { nines: readNines([{ frameId: "a", left: 2, right: 2, top: 1, bottom: 1, filter: "nearest", previewWidth: 12, previewHeight: 8 }]) }));
    assert.equal(settings.nines[0]?.left, 2);
    assert.equal(JSON.stringify(settings.nines).includes("rgba"), false);
  });
});
