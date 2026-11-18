import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PIXEL_CLEAR,
  PIXEL_DEFAULT_INDEX,
  PIXEL_PALETTE,
  PIXEL_SIZES,
  blitContain,
  bresenham,
  containFit,
  createPixels,
  approxColorBands,
  exportFrame,
  fitPixelZoom,
  fitPixelHeight,
  fitPixelSquare,
  importCanvasSize,
  floodFill,
  isPixelSize,
  nearestAlphaPercent,
  paletteIndex,
  pixelBackdrop,
  pixelRect,
  placeSlice,
  readPixel,
  samePixel,
  slideRect,
  writePixel,
  alphaByte,
  alphaSwatch,
  bakeOpaque,
  canvasHasInk,
  clampZoom,
  clearPixels,
  collectUsedColors,
  fillRect,
  floodAlpha,
  floodRgb,
  hasPartialAlpha,
  isPaletteMono,
  movePixels,
  lassoMask,
  magicWandMask,
  colorSelectMask,
  replaceRgb,
  commitPerfectPixel,
  applyPixelGradient,
  gradientSpanCells,
  selectionGridEdges,
  slideLasso,
  clearSelection,
  clonePixelSelection,
  fillSelection,
  moveSelectionPixels,
  selectionHas,
  invertPixelSelection,
  clampFollowMenu,
  moveTabOrder,
  notePixelHistory,
  panAfterZoom,
  PIXEL_PALETTE_ORDER,
  previewAlpha,
  redoPixelHistory,
  rememberColor,
  rememberDrop,
  inkKey,
  parsePixelInk,
  encodePixelInk,
  ellipseOutline,
  paintEllipse,
  reflectPixel,
  clipAxisLine,
  symmetricStampCells,
  symmetryAxisOf,
  flipSelectionHorizontal,
  mirrorSelectionHorizontal,
  clipHas,
  copyPixelSelection,
  duplicatePixelTabName,
  emptyPixelHistory,
  pastedSelection,
  stampPixelClip,
  commitFloatMove,
  undoPixelHistory,
  warpPixels,
  warpEdge,
  warpCorners,
  warpRotateHandles,
  warpLockedScales,
  warpSetWidth,
  canvasAnchorOffset,
  canvasPreviewFrame,
  clampCanvasEdge,
  resizePixelCanvas,
  shiftPixelSelection,
  opaquePixelBounds,
  cropPixelCanvas,
  PIXEL_DROP_CAP,
  splitUsedColors,
  usedSwatchOrder,
  usesOffCube,
  writeAlpha,
  writeRgb,
  PIXEL_PRIMARY_CAP,
  blendPixelOver,
  scalePixelsNearest,
  pixelExportFileName,
  encodeRgbaPng,
  isPixelExportScale,
  compositePixelLayers,
  mergeVisiblePair,
  stampLayerPixels,
  nextPixelLayerName,
  unionOpaqueBounds,
  moveLayerIndex,
  blendPixelOverOpacity,
  projectImagePlane,
  stampGuideBrush,
  moveImageSelection,
  selectionCoversCanvas,
  decodeRgbaPng,
  clampLayerOpacity,
  pixelLayerPlane,
  shiftContentPlane,
  rebasePixelRest,
} from "./pixel-board.ts";

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function solid(width: number, height: number, color: { r: number; g: number; b: number; a: number }): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = color.r;
    data[i * 4 + 1] = color.g;
    data[i * 4 + 2] = color.b;
    data[i * 4 + 3] = color.a;
  }
  return data;
}

describe("pixel board", () => {
  it("offers square sizes from 32 to 256 in steps of 32", () => {
    assert.deepEqual(PIXEL_SIZES, [32, 64, 96, 128, 160, 192, 224, 256]);
    assert.equal(isPixelSize(64), true);
    assert.equal(isPixelSize(48), false);
    assert.equal(isPixelSize(256), true);
    assert.equal(isPixelSize(512), false);
    assert.equal(pixelBackdrop("white"), "white");
    assert.equal(pixelBackdrop("green"), "green");
    assert.equal(pixelBackdrop("black"), "black");
    assert.equal(pixelBackdrop("checker"), "checker");
    assert.equal(pixelBackdrop(""), "checker");
  });

  it("places a sheet slice at the top-left without scaling", () => {
    assert.equal(fitPixelSquare(20, 16), 32);
    assert.equal(fitPixelSquare(32, 32), 32);
    assert.equal(fitPixelSquare(256, 1), 256);
    assert.equal(fitPixelSquare(257, 8), null);
    assert.equal(importCanvasSize(20, 16), 32);
    assert.equal(importCanvasSize(33, 10), 64);
    assert.equal(importCanvasSize(256, 256), 256);
    assert.equal(importCanvasSize(257, 8), 256);
    assert.equal(importCanvasSize(400, 800), 256);
    assert.equal(importCanvasSize(0, 10), null);
    assert.equal(importCanvasSize(Number.NaN, 10), null);
    const src = solid(4, 2, { r: 10, g: 20, b: 30, a: 255 });
    const copy = new Uint8ClampedArray(src);
    const fitted = blitContain(src, 4, 2, importCanvasSize(4, 2) ?? 0);
    assert.notEqual(fitted, src);
    assert.deepEqual(Array.from(src), Array.from(copy));
    assert.equal(fitted.length, 32 * 32 * 4);
    const slice = new Uint8ClampedArray(2 * 1 * 4);
    slice.set([9, 8, 7, 128, 1, 2, 3, 64]);
    const placed = placeSlice(slice, 2, 1, 32);
    assert.equal(placed.length, 32 * 32 * 4);
    assert.deepEqual(Array.from(placed.subarray(0, 8)), [9, 8, 7, 128, 1, 2, 3, 64]);
    assert.equal(placed[8], 0);
    assert.equal(placed[32 * 4 + 3], 0);
  });

  it("keeps a 512-color opaque cube and a separate clear color", () => {
    assert.equal(PIXEL_PALETTE.length, 512);
    assert.equal(new Set(PIXEL_PALETTE.map((color) => `${color.r},${color.g},${color.b},${color.a}`)).size, 512);
    assert.ok(PIXEL_PALETTE.every((color) => color.a === 255));
    assert.deepEqual(PIXEL_PALETTE[PIXEL_DEFAULT_INDEX], { r: 219, g: 36, b: 36, a: 255 });
    assert.deepEqual(PIXEL_CLEAR, { r: 0, g: 0, b: 0, a: 0 });
  });

  it("draws a continuous line with no skipped cells", () => {
    const flat = bresenham(0, 0, 5, 0);
    assert.deepEqual(
      flat.map((point) => point.x),
      [0, 1, 2, 3, 4, 5],
    );
    const diagonal = bresenham(0, 0, 7, 3);
    assert.equal(diagonal[0]?.x, 0);
    assert.equal(diagonal.at(-1)?.x, 7);
    assert.equal(diagonal.at(-1)?.y, 3);
    for (let i = 1; i < diagonal.length; i += 1) {
      assert.equal(chebyshev(diagonal[i - 1]!, diagonal[i]!), 1);
    }
  });

  it("floods only the 4-connected region, including transparency", () => {
    const size = 4;
    const data = createPixels(size);
    writePixel(data, size, 1, 0, { r: 1, g: 0, b: 0, a: 255 });
    writePixel(data, size, 0, 1, { r: 1, g: 0, b: 0, a: 255 });
    const blue = { r: 0, g: 0, b: 255, a: 255 };
    const painted = floodFill(data, size, 0, 0, blue);
    assert.equal(painted, 1);
    assert.ok(samePixel(readPixel(data, size, 0, 0), blue));
    assert.equal(readPixel(data, size, 1, 1).a, 0);
    assert.equal(readPixel(data, size, 3, 3).a, 0);
    const rest = floodFill(data, size, 3, 3, blue);
    assert.equal(rest, 13);
    assert.equal(readPixel(data, size, 1, 0).r, 1);
    assert.equal(floodFill(data, size, 0, 0, blue), 0);
  });

  it("fits inside the square without upscaling and leaves transparent margins", () => {
    const wide = containFit(200, 100, 64);
    assert.ok(wide.scale < 1);
    assert.ok(wide.scale <= 1);
    assert.equal(wide.dw, 64);
    assert.equal(wide.dh, 32);
    assert.equal(wide.ox, 0);
    assert.equal(wide.oy, 16);

    const small = containFit(20, 10, 64);
    assert.equal(small.scale, 1);
    assert.equal(small.dw, 20);
    assert.equal(small.dh, 10);
    assert.equal(small.ox, 22);
    assert.equal(small.oy, 27);

    const red = { r: 200, g: 10, b: 10, a: 255 };
    const src = solid(10, 10, red);
    const fitted = blitContain(src, 10, 10, 32);
    const frame = exportFrame(fitted, 32);
    assert.equal(frame.width, 32);
    assert.equal(frame.height, 32);
    assert.equal(frame.rgba.length, 32 * 32 * 4);
    assert.equal(readPixel(fitted, 32, 0, 0).a, 0);
    assert.ok(samePixel(readPixel(fitted, 32, 11, 11), red));
    let opaque = 0;
    for (let i = 3; i < fitted.length; i += 4) if ((fitted[i] ?? 0) > 0) opaque += 1;
    assert.equal(opaque, 100);
  });

  it("keeps a transparent source cell transparent and does not enlarge it", () => {
    const src = solid(2, 2, { r: 0, g: 180, b: 20, a: 255 });
    src[3] = 0;
    const fitted = blitContain(src, 2, 2, 8);
    assert.equal(readPixel(fitted, 8, 0, 0).a, 0);
    assert.equal(readPixel(fitted, 8, 3, 3).a, 0);
    assert.equal(readPixel(fitted, 8, 4, 3).a, 255);
    assert.equal(readPixel(fitted, 8, 4, 3).g, 180);
    assert.equal(readPixel(fitted, 8, 5, 3).a, 0);
    assert.equal(containFit(2, 2, 8).scale, 1);
  });

  it("uses an integer display zoom and never changes the pixel count", () => {
    assert.equal(fitPixelZoom(100, 64), 1);
    assert.equal(fitPixelZoom(512, 64), 8);
    assert.equal(fitPixelZoom(10000, 32), 32);
    assert.equal(fitPixelHeight(400, 64), 6);
    assert.equal(fitPixelHeight(40, 64), 1);
    assert.equal(fitPixelHeight(2000, 10), 32);
    assert.equal(fitPixelHeight(0, 64), 1);
    const tiny = new Uint8ClampedArray([
      9, 8, 7, 255, 1, 2, 3, 255,
      4, 5, 6, 0, 10, 11, 12, 255,
    ]);
    const placed = blitContain(tiny, 2, 2, 64);
    const fit = containFit(2, 2, 64);
    assert.equal(fit.dw, 2);
    assert.equal(fit.dh, 2);
    const at = (fit.oy * 64 + fit.ox) * 4;
    assert.equal(placed[at], 9);
    assert.equal(placed[at + 1], 8);
    assert.equal(placed[at + 3], 255);
    assert.equal(placed[at + 4], 1);
    assert.equal(placed[(fit.oy + 1) * 64 * 4 + fit.ox * 4 + 3], 0);
    const data = createPixels(64);
    writePixel(data, 64, 3, 4, { r: 1, g: 2, b: 3, a: 255 });
    const frame = exportFrame(data, 64);
    assert.equal(frame.width, 64);
    assert.equal(frame.height, 64);
    assert.equal(readPixel(frame.rgba, 64, 3, 4).b, 3);
  });

  it("extracts painted RGB once and ignores clear cells", () => {
    const data = createPixels(3);
    writePixel(data, 3, 0, 0, { r: 10, g: 20, b: 30, a: 0 });
    writePixel(data, 3, 1, 0, { r: 10, g: 20, b: 30, a: 80 });
    writePixel(data, 3, 2, 0, { r: 10, g: 20, b: 30, a: 200 });
    writePixel(data, 3, 0, 1, { r: 1, g: 2, b: 3, a: 255 });
    writePixel(data, 3, 1, 1, { r: 1, g: 2, b: 3, a: 255 });
    writePixel(data, 3, 2, 1, { r: 10, g: 20, b: 30, a: 255 });
    const used = collectUsedColors(data, 3);
    assert.equal(used.length, 2);
    assert.deepEqual(used[0], { r: 10, g: 20, b: 30, a: 255 });
    assert.deepEqual(used[1], { r: 1, g: 2, b: 3, a: 255 });
    assert.equal(usesOffCube(data), true);
    const split = splitUsedColors(used);
    assert.equal(split.primary.length, 2);
    assert.equal(split.more.length, 0);
    assert.equal(split.extra.length, PIXEL_PALETTE.length);
    assert.equal(split.extra.some((color) => color.r === 10 && color.g === 20 && color.b === 30), false);
    const again = rememberColor(used, { r: 9, g: 9, b: 9, a: 255 });
    assert.equal(again.length, 3);
    assert.equal(rememberColor(again, { r: 9, g: 9, b: 9, a: 128 }).length, 3);
    const many = Array.from({ length: PIXEL_PRIMARY_CAP + 2 }, (_, index) => ({
      r: index & 255,
      g: (index >> 8) & 255,
      b: 3,
      a: 255,
    }));
    const capped = splitUsedColors(many);
    assert.equal(capped.primary.length, PIXEL_PRIMARY_CAP);
    assert.equal(capped.more.length, 2);
    assert.equal(capped.more[1]?.r, 1);
    assert.equal(capped.more[1]?.g, 1);
    assert.equal(capped.more[1]?.b, 3);
    assert.equal(capped.extra.length, PIXEL_PALETTE.length);
  });

  it("keeps RGB when only the alpha changes", () => {
    const data = createPixels(2);
    writePixel(data, 2, 0, 0, { r: 40, g: 50, b: 60, a: 255 });
    assert.equal(alphaByte(10), 230);
    assert.equal(alphaByte(50), 128);
    assert.equal(alphaByte(90), 26);
    assert.ok(alphaSwatch(90).b < alphaSwatch(10).b);
    assert.equal(writeAlpha(data, 2, 0, 0, alphaByte(50)), true);
    assert.deepEqual(readPixel(data, 2, 0, 0), { r: 40, g: 50, b: 60, a: 128 });
    assert.equal(writeAlpha(data, 2, 1, 1, 128), false);
    assert.equal(readPixel(data, 2, 1, 1).a, 0);
    const painted = floodAlpha(data, 2, 0, 0, alphaByte(90));
    assert.equal(painted, 1);
    assert.deepEqual(readPixel(data, 2, 0, 0), { r: 40, g: 50, b: 60, a: alphaByte(90) });
    assert.equal(hasPartialAlpha(data), true);
    assert.equal(canvasHasInk(data), true);
    const flat = bakeOpaque(data);
    assert.equal(readPixel(flat, 2, 0, 0).a, 255);
    assert.equal(readPixel(flat, 2, 0, 0).r, 40);
    assert.equal(readPixel(data, 2, 0, 0).a, alphaByte(90));
    assert.equal(readPixel(flat, 2, 1, 1).a, 0);
    const ghost = previewAlpha(data, 2);
    assert.equal(readPixel(data, 2, 0, 0).r, 40);
    assert.ok(readPixel(ghost, 2, 0, 0).b > readPixel(ghost, 2, 0, 0).r);
    assert.equal(readPixel(ghost, 2, 1, 1).a, 0);
  });

  it("snaps a selection to whole pixels and keeps edits inside it", () => {
    assert.deepEqual(pixelRect(0.2, 0.4, 2.1, 1.2, 4), { x: 0, y: 0, w: 3, h: 2 });
    assert.equal(pixelRect(-4, -4, -1, -1, 4)?.x, 0);
    const data = createPixels(4);
    writePixel(data, 4, 0, 0, { r: 9, g: 8, b: 7, a: 255 });
    writePixel(data, 4, 1, 0, { r: 9, g: 8, b: 7, a: 200 });
    writePixel(data, 4, 3, 3, { r: 1, g: 2, b: 3, a: 255 });
    const rect = pixelRect(0, 0, 1, 0, 4)!;
    clearPixels(data, 4, rect, "rgba");
    assert.equal(readPixel(data, 4, 0, 0).a, 0);
    assert.equal(readPixel(data, 4, 1, 0).a, 0);
    assert.equal(readPixel(data, 4, 3, 3).r, 1);
    const alpha = createPixels(3);
    writePixel(alpha, 3, 0, 0, { r: 4, g: 5, b: 6, a: 128 });
    writePixel(alpha, 3, 1, 0, { r: 4, g: 5, b: 6, a: 255 });
    clearPixels(alpha, 3, null, "alpha");
    assert.deepEqual(readPixel(alpha, 3, 0, 0), { r: 4, g: 5, b: 6, a: 255 });
    assert.equal(readPixel(alpha, 3, 2, 2).a, 0);
    fillRect(alpha, 3, pixelRect(0, 0, 2, 0, 3)!, { r: 0, g: 0, b: 0, a: 26 }, "alpha");
    assert.equal(readPixel(alpha, 3, 0, 0).a, 26);
    assert.equal(readPixel(alpha, 3, 0, 0).r, 4);
    assert.equal(readPixel(alpha, 3, 2, 0).a, 0);
    const moved = createPixels(4);
    writePixel(moved, 4, 0, 0, { r: 10, g: 0, b: 0, a: 255 });
    writePixel(moved, 4, 1, 0, { r: 0, g: 10, b: 0, a: 255 });
    const next = movePixels(moved, 4, pixelRect(0, 0, 1, 0, 4)!, 1, 0, "rgba");
    assert.deepEqual(next, { x: 1, y: 0, w: 2, h: 1 });
    assert.equal(readPixel(moved, 4, 0, 0).a, 0);
    assert.equal(readPixel(moved, 4, 1, 0).r, 10);
    assert.equal(readPixel(moved, 4, 2, 0).g, 10);
    assert.deepEqual(slideRect({ x: 2, y: 2, w: 2, h: 2 }, 5, -9, 4), { x: 2, y: 0, w: 2, h: 2 });
    const off = createPixels(3);
    writePixel(off, 3, 2, 0, { r: 3, g: 3, b: 3, a: 255 });
    movePixels(off, 3, pixelRect(2, 0, 2, 0, 3)!, 2, 0, "rgba");
    assert.equal(readPixel(off, 3, 2, 0).a, 0);
    assert.equal(canvasHasInk(off), false);
    const ghost = createPixels(3);
    writePixel(ghost, 3, 0, 0, { r: 8, g: 0, b: 0, a: 26 });
    writePixel(ghost, 3, 1, 0, { r: 0, g: 8, b: 0, a: 255 });
    movePixels(ghost, 3, pixelRect(0, 0, 0, 0, 3)!, 1, 0, "alpha");
    assert.deepEqual(readPixel(ghost, 3, 0, 0), { r: 8, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(ghost, 3, 1, 0), { r: 0, g: 8, b: 0, a: 26 });
    assert.equal(nearestAlphaPercent(255), null);
    assert.equal(nearestAlphaPercent(0), null);
    assert.equal(nearestAlphaPercent(128), 50);
    assert.equal(paletteIndex({ r: 219, g: 36, b: 36 }), PIXEL_DEFAULT_INDEX);
    assert.equal(paletteIndex({ r: 1, g: 2, b: 3 }), null);
    const lasso = lassoMask(
      [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 3 },
        { x: 1, y: 3 },
      ],
      8,
    );
    assert.equal(lasso?.kind, "lasso");
    if (lasso?.kind !== "lasso") return;
    assert.equal(selectionHas(lasso, 2, 2, 8), true);
    const outline = selectionGridEdges(lasso, 8);
    const hasEdge = (x0: number, y0: number, x1: number, y1: number) =>
      outline.some((edge) => edge.x0 === x0 && edge.y0 === y0 && edge.x1 === x1 && edge.y1 === y1);
    assert.equal(hasEdge(2, 1, 3, 1), true);
    assert.equal(hasEdge(2, 2, 3, 2), false);
    assert.equal(hasEdge(2, 2, 2, 3), false);
    assert.equal(selectionHas(lasso, 0, 0, 8), false);
    assert.equal(selectionHas(lasso, 1, 1, 8), true);
    assert.equal(selectionHas(lasso, 4, 2, 8), true);
    const curve = lassoMask(
      [
        { x: 2, y: 0 },
        { x: 4, y: 1 },
        { x: 3, y: 3 },
        { x: 1, y: 2 },
      ],
      6,
    );
    assert.equal(curve?.kind, "lasso");
    const block = selectionGridEdges({ kind: "rect", rect: { x: 1, y: 1, w: 2, h: 2 } }, 6);
    const blockHas = (x0: number, y0: number, x1: number, y1: number) =>
      block.some((edge) => edge.x0 === x0 && edge.y0 === y0 && edge.x1 === x1 && edge.y1 === y1);
    assert.equal(blockHas(1, 1, 2, 1), true);
    assert.equal(blockHas(1, 2, 2, 2), false);
    assert.equal(blockHas(2, 1, 2, 2), false);
    assert.equal(block.length, 8);
    const picture = createPixels(8);
    writePixel(picture, 8, 2, 2, { r: 9, g: 1, b: 1, a: 255 });
    writePixel(picture, 8, 0, 0, { r: 3, g: 3, b: 3, a: 255 });
    writePixel(picture, 8, 2, 2, { r: 9, g: 1, b: 1, a: 120 });
    clearSelection(picture, 8, lasso, "alpha");
    assert.equal(readPixel(picture, 8, 2, 2).a, 255);
    assert.equal(readPixel(picture, 8, 2, 2).r, 9);
    assert.equal(readPixel(picture, 8, 0, 0).a, 255);
    writePixel(picture, 8, 2, 2, { r: 9, g: 1, b: 1, a: 255 });
    clearSelection(picture, 8, lasso, "rgba");
    assert.equal(readPixel(picture, 8, 2, 2).a, 0);
    assert.equal(readPixel(picture, 8, 0, 0).r, 3);
    fillSelection(picture, 8, lasso, { r: 0, g: 8, b: 0, a: 255 }, "rgba");
    assert.equal(readPixel(picture, 8, 2, 2).g, 8);
    assert.equal(readPixel(picture, 8, 0, 0).r, 3);
    const slid = slideLasso(lasso, 10, 0, 8);
    assert.equal(slid.kind === "lasso" && slid.bounds.w === lasso.bounds.w && slid.bounds.x === 8 - lasso.bounds.w, true);
    const moving = createPixels(8);
    writePixel(moving, 8, 2, 2, { r: 4, g: 0, b: 0, a: 255 });
    writePixel(moving, 8, 0, 0, { r: 7, g: 7, b: 7, a: 255 });
    const movedLasso = moveSelectionPixels(moving, 8, lasso, 1, 0, "rgba");
    assert.equal(readPixel(moving, 8, 2, 2).a, 0);
    assert.equal(readPixel(moving, 8, 3, 2).r, 4);
    assert.equal(readPixel(moving, 8, 0, 0).r, 7);
    assert.equal(movedLasso?.kind === "lasso" && selectionHas(movedLasso, 3, 2, 8), true);
    const faded = createPixels(8);
    const dot = new Uint8Array(64);
    dot[2 * 8 + 2] = 1;
    const one = { kind: "lasso" as const, mask: dot, bounds: { x: 2, y: 2, w: 1, h: 1 } };
    writePixel(faded, 8, 2, 2, { r: 5, g: 0, b: 0, a: 40 });
    writePixel(faded, 8, 3, 2, { r: 1, g: 2, b: 3, a: 255 });
    moveSelectionPixels(faded, 8, one, 1, 0, "alpha");
    assert.equal(readPixel(faded, 8, 2, 2).a, 255);
    assert.equal(readPixel(faded, 8, 2, 2).r, 5);
    assert.equal(readPixel(faded, 8, 3, 2).a, 40);
    assert.equal(readPixel(faded, 8, 3, 2).r, 1);
  });

  it("selects only the 4-connected region of one color", () => {
    const size = 6;
    const data = createPixels(size);
    const paint = (x: number, y: number, color: { r: number; g: number; b: number; a: number }) => writePixel(data, size, x, y, color);
    const red = { r: 200, g: 10, b: 10, a: 255 };
    const green = { r: 10, g: 180, b: 20, a: 255 };
    const redSoft = { r: 200, g: 10, b: 10, a: 128 };
    paint(1, 1, red);
    paint(2, 1, red);
    paint(1, 2, red);
    paint(2, 2, red);
    paint(4, 1, red);
    paint(2, 3, green);
    paint(3, 3, red);
    paint(3, 4, red);
    paint(0, 4, redSoft);
    paint(1, 4, red);
    const before = new Uint8ClampedArray(data);
    const region = magicWandMask(data, size, 2, 1);
    assert.equal(region?.kind, "lasso");
    if (region?.kind !== "lasso") return;
    assert.deepEqual(data, before);
    assert.equal(selectionHas(region, 1, 1, size), true);
    assert.equal(selectionHas(region, 2, 2, size), true);
    assert.equal(selectionHas(region, 3, 3, size), false);
    assert.equal(selectionHas(region, 4, 1, size), false);
    assert.equal(selectionHas(region, 2, 3, size), false);
    assert.equal(selectionHas(region, 3, 4, size), false);
    assert.equal(selectionHas(region, 1, 4, size), false);
    assert.equal(selectionHas(region, 0, 4, size), false);
    const diagonal = magicWandMask(data, size, 3, 4);
    assert.equal(diagonal && selectionHas(diagonal, 3, 4, size), true);
    assert.equal(diagonal && selectionHas(diagonal, 3, 3, size), true);
    assert.equal(diagonal && selectionHas(diagonal, 2, 2, size), false);
    assert.equal(diagonal && selectionHas(diagonal, 2, 3, size), false);
    assert.equal(diagonal && selectionHas(diagonal, 4, 1, size), false);
    const soft = magicWandMask(data, size, 0, 4);
    assert.equal(soft && selectionHas(soft, 0, 4, size), true);
    assert.equal(soft && selectionHas(soft, 1, 4, size), false);
    const hole = createPixels(5);
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        if (x === 1 && y === 1) continue;
        writePixel(hole, 5, x + 1, y + 1, red);
      }
    }
    writePixel(hole, 5, 2, 2, green);
    const ring = magicWandMask(hole, 5, 1, 1);
    assert.equal(ring && selectionHas(ring, 1, 1, 5), true);
    assert.equal(ring && selectionHas(ring, 3, 3, 5), true);
    assert.equal(ring && selectionHas(ring, 2, 2, 5), false);
    assert.equal(ring && selectionHas(ring, 1, 2, 5), true);
    const edges = selectionGridEdges(ring, 5);
    const shares = edges.some((edge) => edge.x0 === 1 && edge.y0 === 2 && edge.x1 === 2 && edge.y1 === 2);
    assert.equal(shares, false);
    const around = createPixels(4);
    for (let x = 0; x < 4; x += 1) writePixel(around, 4, x, 0, red);
    writePixel(around, 4, 3, 1, red);
    for (let x = 0; x < 4; x += 1) writePixel(around, 4, x, 2, red);
    const wrapped = magicWandMask(around, 4, 0, 0);
    let count = 0;
    if (wrapped?.kind === "lasso") {
      for (let index = 0; index < wrapped.mask.length; index += 1) if (wrapped.mask[index] === 1) count += 1;
    }
    assert.equal(count, 9);
    const clear = createPixels(3);
    writePixel(clear, 3, 0, 0, { r: 4, g: 5, b: 6, a: 0 });
    writePixel(clear, 3, 1, 0, { r: 9, g: 9, b: 9, a: 0 });
    writePixel(clear, 3, 2, 0, { r: 1, g: 2, b: 3, a: 255 });
    writePixel(clear, 3, 0, 1, { r: 1, g: 2, b: 3, a: 80 });
    const empty = magicWandMask(clear, 3, 0, 0);
    assert.equal(empty && selectionHas(empty, 0, 0, 3), true);
    assert.equal(empty && selectionHas(empty, 1, 0, 3), true);
    assert.equal(empty && selectionHas(empty, 2, 0, 3), false);
    assert.equal(empty && selectionHas(empty, 0, 1, 3), false);
    assert.equal(readPixel(clear, 3, 0, 0).r, 4);
    if (!region) return;
    const edited = new Uint8ClampedArray(data);
    clearSelection(edited, size, region, "rgba");
    assert.equal(readPixel(edited, size, 2, 1).a, 0);
    assert.equal(readPixel(edited, size, 4, 1).r, 200);
    fillSelection(edited, size, region, green, "rgba");
    assert.equal(readPixel(edited, size, 1, 2).g, 180);
    assert.equal(readPixel(edited, size, 4, 1).r, 200);
    const moved = moveSelectionPixels(edited, size, region, 1, 0, "rgba");
    assert.equal(readPixel(edited, size, 1, 2).a, 0);
    assert.equal(readPixel(edited, size, 2, 2).g, 180);
    assert.equal(moved && selectionHas(moved, 2, 2, size), true);
    assert.equal(moved && selectionHas(moved, 3, 1, size), true);
    assert.equal(moved && selectionHas(moved, 5, 1, size), false);
    assert.equal(readPixel(edited, size, 4, 1).r, 200);
    const full = createPixels(32);
    for (let index = 0; index < full.length; index += 4) {
      full[index] = index % 3 === 0 ? 8 : 1;
      full[index + 3] = 255;
    }
    const picked = magicWandMask(full, 32, 0, 0);
    let pickedCount = 0;
    const seen = new Uint8Array(32 * 32);
    const stack = [0, 0];
    const target = readPixel(full, 32, 0, 0);
    while (stack.length > 0) {
      const py = stack.pop() ?? 0;
      const px = stack.pop() ?? 0;
      if (px < 0 || py < 0 || px >= 32 || py >= 32 || seen[py * 32 + px]) continue;
      seen[py * 32 + px] = 1;
      if (!samePixel(readPixel(full, 32, px, py), target)) continue;
      pickedCount += 1;
      stack.push(px - 1, py, px + 1, py, px, py - 1, px, py + 1);
    }
    let maskCount = 0;
    if (picked?.kind === "lasso") {
      for (let index = 0; index < picked.mask.length; index += 1) if (picked.mask[index] === 1) maskCount += 1;
    }
    assert.equal(maskCount, pickedCount);
    assert.equal(magicWandMask(data, size, -1, 0), null);
  });

  it("keeps a follow menu under the selection and inside the stage", () => {
    const fitted = clampFollowMenu(10, 20, 400, 300, 120, 40);
    assert.deepEqual(fitted, { left: 10, top: 24 });
    const low = clampFollowMenu(10, 140, 400, 300, 120, 40);
    assert.equal(low.left, 10);
    assert.equal(low.top, 300 / 2 - 6 - 40);
    const lifted = clampFollowMenu(10, 40, 400, 300, 120, 40);
    assert.equal(lifted.top, 44);
    const wide = clampFollowMenu(180, 0, 400, 300, 120, 40);
    assert.equal(wide.left, 400 / 2 - 6 - 120);
    assert.equal(wide.top, 4);
    const unmeasured = clampFollowMenu(10, 140, 400, 300, 0, 0);
    assert.deepEqual(unmeasured, { left: 10, top: 144 });
  });

  it("inverts a selection mask without turning a solid remainder into a lasso", () => {
    const size = 4;
    const rect = { kind: "rect" as const, rect: { x: 0, y: 0, w: 2, h: 4 } };
    const inverted = invertPixelSelection(rect, size);
    assert.equal(inverted?.kind, "rect");
    if (inverted?.kind !== "rect") return;
    assert.deepEqual(inverted.rect, { x: 2, y: 0, w: 2, h: 4 });
    const hole = { kind: "rect" as const, rect: { x: 1, y: 1, w: 1, h: 1 } };
    const around = invertPixelSelection(hole, size);
    assert.equal(around?.kind, "lasso");
    assert.equal(around ? selectionHas(around, 1, 1, size) : true, false);
    assert.equal(around ? selectionHas(around, 0, 0, size) : false, true);
    assert.equal(around ? selectionHas(around, 3, 3, size) : false, true);
    const pixels = createPixels(size);
    writePixel(pixels, size, 0, 0, { r: 9, g: 8, b: 7, a: 255 });
    const again = invertPixelSelection(rect, size);
    assert.equal(readPixel(pixels, size, 0, 0).r, 9);
    assert.equal(again?.kind, "rect");
  });

  it("selects every pixel of the clicked color, including ones that do not touch", () => {
    const size = 6;
    const data = createPixels(size);
    const red = { r: 200, g: 10, b: 10, a: 255 };
    const green = { r: 10, g: 180, b: 20, a: 255 };
    const redSoft = { r: 200, g: 10, b: 10, a: 128 };
    writePixel(data, size, 1, 1, red);
    writePixel(data, size, 4, 1, red);
    writePixel(data, size, 5, 5, red);
    writePixel(data, size, 2, 3, green);
    writePixel(data, size, 0, 4, redSoft);
    const before = new Uint8ClampedArray(data);
    const picked = colorSelectMask(data, size, 4, 1);
    assert.equal(picked?.kind, "lasso");
    if (picked?.kind !== "lasso") return;
    assert.deepEqual(data, before);
    assert.equal(selectionHas(picked, 1, 1, size), true);
    assert.equal(selectionHas(picked, 4, 1, size), true);
    assert.equal(selectionHas(picked, 5, 5, size), true);
    assert.equal(selectionHas(picked, 2, 3, size), false);
    assert.equal(selectionHas(picked, 0, 4, size), false);
    assert.equal(selectionHas(picked, 0, 0, size), false);
    const edges = selectionGridEdges(picked, size);
    assert.equal(edges.length, 12);
    writePixel(data, size, 2, 1, red);
    const joined = colorSelectMask(data, size, 1, 1);
    const joinedEdges = selectionGridEdges(joined, size);
    const between = joinedEdges.some((edge) => edge.x0 === 2 && edge.y0 === 1 && edge.x1 === 2 && edge.y1 === 2);
    assert.equal(between, false);
    assert.equal(joined && selectionHas(joined, 5, 5, size), true);
    const soft = colorSelectMask(data, size, 0, 4);
    assert.equal(soft && selectionHas(soft, 0, 4, size), true);
    assert.equal(soft && selectionHas(soft, 1, 1, size), false);
    const clear = createPixels(3);
    writePixel(clear, 3, 0, 0, { r: 4, g: 5, b: 6, a: 0 });
    writePixel(clear, 3, 2, 2, { r: 9, g: 9, b: 9, a: 0 });
    writePixel(clear, 3, 1, 1, red);
    const empty = colorSelectMask(clear, 3, 0, 0);
    assert.equal(empty && selectionHas(empty, 0, 0, 3), true);
    assert.equal(empty && selectionHas(empty, 2, 2, 3), true);
    assert.equal(empty && selectionHas(empty, 1, 1, 3), false);
    assert.equal(readPixel(clear, 3, 0, 0).r, 4);
    const edited = new Uint8ClampedArray(data);
    clearSelection(edited, size, picked, "rgba");
    assert.equal(readPixel(edited, size, 1, 1).a, 0);
    assert.equal(readPixel(edited, size, 5, 5).a, 0);
    assert.equal(readPixel(edited, size, 2, 3).g, 180);
    assert.equal(readPixel(edited, size, 0, 4).a, 128);
    fillSelection(edited, size, picked, green, "rgba");
    assert.equal(readPixel(edited, size, 4, 1).g, 180);
    assert.equal(readPixel(edited, size, 2, 3).r, 10);
    const moved = moveSelectionPixels(edited, size, picked, 0, 1, "rgba");
    assert.equal(readPixel(edited, size, 4, 1).a, 0);
    assert.equal(readPixel(edited, size, 4, 2).g, 180);
    assert.equal(readPixel(edited, size, 2, 3).g, 180);
    assert.equal(moved && selectionHas(moved, 4, 2, size), true);
    assert.equal(moved && selectionHas(moved, 1, 2, size), true);
    assert.equal(moved && selectionHas(moved, 4, 1, size), false);
    assert.equal(colorSelectMask(data, size, -1, 0), null);
    const wand = magicWandMask(data, size, 4, 1);
    let wandCount = 0;
    let colorCount = 0;
    if (wand?.kind === "lasso") for (let index = 0; index < wand.mask.length; index += 1) if (wand.mask[index] === 1) wandCount += 1;
    for (let index = 0; index < picked.mask.length; index += 1) if (picked.mask[index] === 1) colorCount += 1;
    assert.equal(wandCount, 1);
    assert.equal(colorCount, 3);
  });

  it("replaces one RGB everywhere and keeps each pixel's alpha", () => {
    const size = 6;
    const data = createPixels(size);
    const red = { r: 200, g: 10, b: 10, a: 255 };
    const green = { r: 0, g: 180, b: 20 };
    writePixel(data, size, 1, 1, red);
    writePixel(data, size, 5, 4, { r: 200, g: 10, b: 10, a: 128 });
    writePixel(data, size, 3, 2, { r: 200, g: 10, b: 10, a: 0 });
    writePixel(data, size, 2, 2, { r: 8, g: 8, b: 40, a: 255 });
    const before = new Uint8ClampedArray(data);
    assert.equal(replaceRgb(data, size, 0, 0, green, null), 0);
    assert.deepEqual(data, before);
    assert.equal(replaceRgb(data, size, 3, 2, green, null), 0);
    assert.equal(readPixel(data, size, 3, 2).a, 0);
    assert.equal(replaceRgb(data, size, 1, 1, { r: 200, g: 10, b: 10 }, null), 0);
    assert.equal(readPixel(data, size, 5, 4).a, 128);
    const painted = replaceRgb(data, size, 1, 1, green, null);
    assert.equal(painted, 2);
    assert.deepEqual(readPixel(data, size, 1, 1), { r: 0, g: 180, b: 20, a: 255 });
    assert.deepEqual(readPixel(data, size, 5, 4), { r: 0, g: 180, b: 20, a: 128 });
    assert.deepEqual(readPixel(data, size, 3, 2), { r: 200, g: 10, b: 10, a: 0 });
    assert.deepEqual(readPixel(data, size, 2, 2), { r: 8, g: 8, b: 40, a: 255 });
    const limited = createPixels(size);
    writePixel(limited, size, 0, 0, red);
    writePixel(limited, size, 4, 1, red);
    writePixel(limited, size, 5, 5, red);
    writePixel(limited, size, 1, 1, { r: 1, g: 2, b: 3, a: 200 });
    const rect = { kind: "rect" as const, rect: { x: 0, y: 0, w: 2, h: 2 } };
    assert.equal(replaceRgb(limited, size, 4, 1, green, rect), 1);
    assert.deepEqual(readPixel(limited, size, 0, 0), { r: 0, g: 180, b: 20, a: 255 });
    assert.deepEqual(readPixel(limited, size, 4, 1), red);
    assert.deepEqual(readPixel(limited, size, 5, 5), red);
    assert.deepEqual(readPixel(limited, size, 1, 1), { r: 1, g: 2, b: 3, a: 200 });
    const mask = new Uint8Array(size * size);
    mask[1 * size + 4] = 1;
    const lasso = { kind: "lasso" as const, mask, bounds: { x: 4, y: 1, w: 1, h: 1 } };
    const maskBefore = new Uint8Array(mask);
    assert.equal(replaceRgb(limited, size, 5, 5, { r: 9, g: 9, b: 9 }, lasso), 1);
    assert.deepEqual(readPixel(limited, size, 4, 1), { r: 9, g: 9, b: 9, a: 255 });
    assert.deepEqual(readPixel(limited, size, 5, 5), red);
    assert.deepEqual(readPixel(limited, size, 0, 0), { r: 0, g: 180, b: 20, a: 255 });
    assert.deepEqual(mask, maskBefore);
    assert.equal(replaceRgb(limited, size, -1, 0, green, null), 0);
  });

  it("keeps the alpha layer when RGB is repainted", () => {
    const data = createPixels(3);
    writePixel(data, 3, 1, 1, { r: 200, g: 10, b: 10, a: 128 });
    writeRgb(data, 3, 1, 1, { r: 10, g: 20, b: 200 });
    assert.deepEqual(readPixel(data, 3, 1, 1), { r: 10, g: 20, b: 200, a: 128 });
    writeRgb(data, 3, 0, 0, { r: 1, g: 2, b: 3 });
    assert.deepEqual(readPixel(data, 3, 0, 0), { r: 1, g: 2, b: 3, a: 255 });
    assert.equal(floodRgb(data, 3, 1, 1, { r: 0, g: 255, b: 0, a: 255 }), 1);
    assert.deepEqual(readPixel(data, 3, 1, 1), { r: 0, g: 255, b: 0, a: 128 });
    assert.deepEqual(readPixel(data, 3, 0, 0), { r: 1, g: 2, b: 3, a: 255 });
    fillRect(data, 3, { x: 1, y: 1, w: 1, h: 1 }, { r: 5, g: 6, b: 7, a: 255 }, "rgba");
    assert.deepEqual(readPixel(data, 3, 1, 1), { r: 5, g: 6, b: 7, a: 128 });
    fillRect(data, 3, { x: 1, y: 1, w: 1, h: 1 }, PIXEL_CLEAR, "rgba");
    assert.deepEqual(readPixel(data, 3, 1, 1), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(
      moveTabOrder([{ id: "a" }, { id: "b" }, { id: "c" }], "c", "a")?.map((tab) => tab.id),
      ["c", "a", "b"],
    );
    assert.equal(moveTabOrder([{ id: "a" }, { id: "b" }], "a", "a"), null);
    assert.equal(moveTabOrder([{ id: "a" }], "a", "missing"), null);
  });

  it("zooms around the cursor without leaving the allowed range", () => {
    assert.equal(clampZoom(0), 1);
    assert.equal(clampZoom(40), 32);
    assert.equal(clampZoom(8.2), 8);
    const pan = panAfterZoom(0, 80, 80, 40, 80, 100);
    assert.equal(pan, 20);
    const center = panAfterZoom(0, 100, 80, 40, 80, 100);
    assert.equal(center, 0);
    assert.equal(PIXEL_PRIMARY_CAP, 256);
  });

  it("builds 14 even steps to white and black around the current color", () => {
    const bands = approxColorBands({ r: 219, g: 36, b: 36 });
    assert.equal(bands.white.length, 14);
    assert.equal(bands.black.length, 14);
    assert.deepEqual(bands.white[6], { r: 255, g: 255, b: 255 });
    assert.deepEqual(bands.white[13], { r: 237, g: 146, b: 146 });
    assert.deepEqual(bands.black[0], { r: 203, g: 33, b: 33 });
    assert.deepEqual(bands.black[13], { r: 0, g: 0, b: 0 });
    assert.deepEqual(approxColorBands({ r: 10, g: 20, b: 30 }).white[6], { r: 255, g: 255, b: 255 });
    assert.deepEqual(approxColorBands({ r: 255, g: 255, b: 255 }).white[6], { r: 255, g: 255, b: 255 });
    assert.deepEqual(approxColorBands({ r: 0, g: 0, b: 0 }).black[13], { r: 0, g: 0, b: 0 });
  });

  it("pins white then black and does not repeat them", () => {
    assert.equal(PIXEL_PALETTE_ORDER.length, 512);
    assert.equal(new Set(PIXEL_PALETTE_ORDER).size, 512);
    const white = PIXEL_PALETTE[PIXEL_PALETTE_ORDER[0] ?? -1];
    const black = PIXEL_PALETTE[PIXEL_PALETTE_ORDER[1] ?? -1];
    assert.deepEqual(white, { r: 255, g: 255, b: 255, a: 255 });
    assert.deepEqual(black, { r: 0, g: 0, b: 0, a: 255 });
    const used = usedSwatchOrder([
      { r: 255, g: 255, b: 255, a: 255 },
      { r: 10, g: 20, b: 30, a: 255 },
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 10, g: 20, b: 30, a: 128 },
    ]);
    assert.deepEqual(used[0], { r: 255, g: 255, b: 255, a: 255 });
    assert.deepEqual(used[1], { r: 0, g: 0, b: 0, a: 255 });
    assert.equal(used.filter((color) => isPaletteMono(color) === "white").length, 1);
    assert.equal(used.filter((color) => isPaletteMono(color) === "black").length, 1);
    assert.equal(used.filter((color) => color.r === 10).length, 1);
    const sorted = usedSwatchOrder([
      { r: 0, g: 0, b: 255, a: 255 },
      { r: 255, g: 180, b: 180, a: 255 },
      { r: 80, g: 0, b: 0, a: 255 },
      { r: 255, g: 128, b: 0, a: 255 },
      { r: 0, g: 255, b: 0, a: 255 },
      { r: 128, g: 128, b: 128, a: 255 },
      { r: 255, g: 255, b: 0, a: 255 },
    ]);
    assert.deepEqual(
      sorted.map((color) => [color.r, color.g, color.b]),
      [
        [255, 255, 255],
        [0, 0, 0],
        [80, 0, 0],
        [255, 180, 180],
        [255, 128, 0],
        [255, 255, 0],
        [0, 255, 0],
        [0, 0, 255],
        [128, 128, 128],
      ],
    );
  });

  it("undoes one edit and drops redo after a new edit", () => {
    const history = emptyPixelHistory();
    const first = new Uint8ClampedArray([1]);
    const second = new Uint8ClampedArray([2]);
    const third = new Uint8ClampedArray([3]);
    notePixelHistory(history, first);
    assert.equal(undoPixelHistory(history, second)?.[0], 1);
    assert.equal(redoPixelHistory(history, first)?.[0], 2);
    notePixelHistory(history, second);
    assert.equal(history.redo.length, 0);
    assert.equal(undoPixelHistory(history, third)?.[0], 2);
    assert.equal(undoPixelHistory(emptyPixelHistory(), first), null);
  });

  it("recolors only the middle dot of a straight 3-dot line", () => {
    const data = createPixels(6);
    writePixel(data, 6, 1, 2, { r: 255, g: 0, b: 0, a: 255 });
    writePixel(data, 6, 2, 2, { r: 0, g: 0, b: 0, a: 90 });
    writePixel(data, 6, 3, 2, { r: 0, g: 0, b: 255, a: 255 });
    assert.equal(applyPixelGradient(data, 6, 1, 2, 3, 2), true);
    assert.deepEqual(readPixel(data, 6, 2, 2), { r: 128, g: 0, b: 128, a: 90 });
    assert.deepEqual(readPixel(data, 6, 1, 2), { r: 255, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(data, 6, 3, 2), { r: 0, g: 0, b: 255, a: 255 });
    writePixel(data, 6, 1, 1, { r: 0, g: 0, b: 0, a: 255 });
    writePixel(data, 6, 2, 2, { r: 10, g: 10, b: 10, a: 0 });
    writePixel(data, 6, 3, 3, { r: 0, g: 0, b: 40, a: 255 });
    assert.equal(applyPixelGradient(data, 6, 1, 1, 3, 3), true);
    assert.deepEqual(readPixel(data, 6, 2, 2), { r: 0, g: 0, b: 20, a: 0 });
    writePixel(data, 6, 0, 4, { r: 255, g: 0, b: 0, a: 255 });
    writePixel(data, 6, 0, 5, { r: 0, g: 255, b: 0, a: 40 });
    assert.equal(applyPixelGradient(data, 6, 0, 4, 0, 5), false);
    assert.equal(readPixel(data, 6, 0, 5).g, 255);
    writePixel(data, 6, 4, 0, { r: 0, g: 0, b: 0, a: 255 });
    writePixel(data, 6, 4, 1, { r: 9, g: 9, b: 9, a: 200 });
    writePixel(data, 6, 4, 2, { r: 0, g: 0, b: 80, a: 255 });
    assert.equal(applyPixelGradient(data, 6, 4, 0, 4, 2), true);
    assert.deepEqual(readPixel(data, 6, 4, 1), { r: 0, g: 0, b: 40, a: 200 });
    assert.equal(readPixel(data, 6, 4, 0).b, 0);
    assert.equal(readPixel(data, 6, 4, 2).b, 80);
    assert.equal(applyPixelGradient(data, 6, 4, 0, 4, 2), false);
    assert.equal(applyPixelGradient(data, 6, 0, 0, 4, 0), false);
    assert.equal(applyPixelGradient(data, 6, 0, 0, 2, 1), false);
  });

  it("spreads a gradient across every cell between the ends", () => {
    const data = createPixels(6);
    writePixel(data, 6, 0, 0, { r: 0, g: 0, b: 0, a: 255 });
    writePixel(data, 6, 4, 0, { r: 255, g: 0, b: 0, a: 255 });
    for (let x = 1; x <= 3; x += 1) writePixel(data, 6, x, 0, { r: 0, g: 0, b: 0, a: 200 });
    assert.deepEqual(
      gradientSpanCells(6, 0, 0, 4, 0).map((cell) => cell.x),
      [1, 2, 3],
    );
    assert.equal(applyPixelGradient(data, 6, 0, 0, 4, 0), true);
    assert.deepEqual(readPixel(data, 6, 0, 0), { r: 0, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(data, 6, 4, 0), { r: 255, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(data, 6, 1, 0), { r: 64, g: 0, b: 0, a: 200 });
    assert.deepEqual(readPixel(data, 6, 2, 0), { r: 128, g: 0, b: 0, a: 200 });
    assert.deepEqual(readPixel(data, 6, 3, 0), { r: 191, g: 0, b: 0, a: 200 });
    const limited = createPixels(6);
    writePixel(limited, 6, 0, 1, { r: 0, g: 0, b: 0, a: 255 });
    writePixel(limited, 6, 1, 1, { r: 0, g: 0, b: 0, a: 255 });
    writePixel(limited, 6, 2, 1, { r: 0, g: 0, b: 0, a: 255 });
    writePixel(limited, 6, 3, 1, { r: 0, g: 0, b: 0, a: 255 });
    writePixel(limited, 6, 4, 1, { r: 255, g: 0, b: 0, a: 255 });
    const only = { kind: "rect" as const, rect: { x: 2, y: 1, w: 1, h: 1 } };
    assert.deepEqual(
      gradientSpanCells(6, 0, 1, 4, 1, only).map((cell) => [cell.x, cell.y]),
      [[2, 1]],
    );
    assert.equal(applyPixelGradient(limited, 6, 0, 1, 4, 1, only), true);
    assert.deepEqual(readPixel(limited, 6, 1, 1), { r: 0, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(limited, 6, 2, 1), { r: 128, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(limited, 6, 3, 1), { r: 0, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(limited, 6, 0, 1), { r: 0, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(limited, 6, 4, 1), { r: 255, g: 0, b: 0, a: 255 });
  });

  it("removes a diagonal jaggy without eating corners, stairs, or old pixels", () => {
    const size = 8;
    const red = { r: 200, g: 10, b: 10 };
    const draw = (steps: { x: number; y: number }[], seed?: (data: Uint8ClampedArray) => void) => {
      const data = createPixels(size);
      seed?.(data);
      const before = new Uint8ClampedArray(data);
      const points: { x: number; y: number }[] = [];
      for (const step of steps) {
        commitPerfectPixel(points, data, before, size, step, (x, y) => writeRgb(data, size, x, y, red));
      }
      return data;
    };
    const on = (data: Uint8ClampedArray, x: number, y: number) => readPixel(data, size, x, y).r === 200;
    const wobble = draw([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ]);
    assert.equal(on(wobble, 0, 0), true);
    assert.equal(on(wobble, 1, 1), true);
    assert.equal(on(wobble, 2, 2), true);
    assert.equal(on(wobble, 3, 2), true);
    assert.equal(on(wobble, 1, 0), false);
    assert.equal(on(wobble, 2, 1), false);
    assert.equal(readPixel(wobble, size, 1, 0).a, 0);
    const corner = draw([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
    ]);
    assert.equal(on(corner, 2, 0), true);
    assert.equal(on(corner, 2, 2), true);
    const short = draw([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
    assert.equal(on(short, 0, 0) && on(short, 1, 0) && on(short, 1, 1), true);
    const stair = draw(bresenham(0, 0, 6, 2));
    for (const step of bresenham(0, 0, 6, 2)) assert.equal(on(stair, step.x, step.y), true);
    const hook = draw([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
    ]);
    assert.equal(on(hook, 1, 0), true);
    assert.equal(on(hook, 0, 2), true);
    const kept = draw(
      [
        { x: 0, y: 4 },
        { x: 1, y: 4 },
        { x: 1, y: 5 },
        { x: 2, y: 5 },
      ],
      (data) => {
        writePixel(data, size, 1, 4, { r: 4, g: 5, b: 6, a: 90 });
        writePixel(data, size, 0, 4, { r: 8, g: 8, b: 8, a: 128 });
        writePixel(data, size, 7, 7, { r: 1, g: 1, b: 1, a: 40 });
      },
    );
    assert.deepEqual(readPixel(kept, size, 1, 4), { r: 4, g: 5, b: 6, a: 90 });
    assert.deepEqual(readPixel(kept, size, 0, 4), { r: 200, g: 10, b: 10, a: 128 });
    assert.equal(on(kept, 1, 5), true);
    assert.equal(on(kept, 2, 5), true);
    assert.deepEqual(readPixel(kept, size, 7, 7), { r: 1, g: 1, b: 1, a: 40 });
    const dot = draw([{ x: 3, y: 3 }]);
    assert.equal(on(dot, 3, 3), true);
  });

  it("keeps eyedropper history newest-first, unique, and capped", () => {
    const red = { r: 200, g: 10, b: 10 };
    const blue = { r: 10, g: 20, b: 200 };
    const cube = PIXEL_PALETTE[PIXEL_DEFAULT_INDEX]!;
    let history = rememberDrop([], red);
    history = rememberDrop(history, blue);
    history = rememberDrop(history, "clear");
    assert.deepEqual(history, ["clear", blue, red]);
    history = rememberDrop(history, red);
    assert.deepEqual(history, [red, "clear", blue]);
    history = rememberDrop(history, { r: cube.r, g: cube.g, b: cube.b });
    history = rememberDrop(history, PIXEL_DEFAULT_INDEX);
    assert.equal(history.filter((pick) => inkKey(pick) === inkKey(PIXEL_DEFAULT_INDEX)).length, 1);
    assert.equal(inkKey(history[0]!), inkKey(PIXEL_DEFAULT_INDEX));
    let many = [] as typeof history;
    for (let index = 0; index < PIXEL_DROP_CAP + 5; index += 1) many = rememberDrop(many, { r: index, g: 0, b: 1 });
    assert.equal(many.length, PIXEL_DROP_CAP);
    assert.deepEqual(many[0], { r: PIXEL_DROP_CAP + 4, g: 0, b: 1 });
    assert.deepEqual(many[many.length - 1], { r: 5, g: 0, b: 1 });
    const saved = encodePixelInk(blue, history);
    const parsed = parsePixelInk(saved);
    assert.deepEqual(parsed.color, blue);
    assert.deepEqual(parsed.drops, history);
    assert.deepEqual(parsePixelInk("nope"), { color: null, drops: [] });
    const messy = parsePixelInk(JSON.stringify({ color: { r: 1, g: 2, b: 3 }, drops: ["clear", "clear", { r: 1, g: 2, b: 3 }, { r: 9 }, 9999] }));
    assert.deepEqual(messy.drops, ["clear", { r: 1, g: 2, b: 3 }]);
  });

  it("mirrors a cell across a vertical, horizontal, or diagonal ruler", () => {
    const vertical = { x0: 5, y0: 0, x1: 5, y1: 10 };
    const horizontal = { x0: 0, y0: 5, x1: 10, y1: 5 };
    const diagonal = { x0: 0, y0: 0, x1: 6, y1: 6 };
    assert.deepEqual(reflectPixel(3, 4, vertical), { x: 7, y: 4 });
    assert.deepEqual(reflectPixel(5, 4, vertical), { x: 5, y: 4 });
    assert.deepEqual(reflectPixel(6, 1, vertical), { x: 4, y: 1 });
    assert.deepEqual(reflectPixel(3, 2, horizontal), { x: 3, y: 8 });
    assert.deepEqual(reflectPixel(0, 2, diagonal), { x: 2, y: 0 });
    assert.deepEqual(reflectPixel(2, 2, diagonal), { x: 2, y: 2 });
    assert.equal(reflectPixel(1, 1, { x0: 4, y0: 4, x1: 4, y1: 4 }), null);
    assert.deepEqual(reflectPixel(3, 4, vertical), reflectPixel(3, 4, vertical));
    const oblique = { x0: 0, y0: 2, x1: 8, y1: 5 };
    const mirrored = reflectPixel(2, 8, oblique);
    assert.ok(mirrored);
    assert.deepEqual(reflectPixel(2, 8, oblique), mirrored);
    const ax = oblique.x0 + 0.5;
    const ay = oblique.y0 + 0.5;
    const dx = oblique.x1 - oblique.x0;
    const dy = oblique.y1 - oblique.y0;
    const midX = (2 + 0.5 + mirrored.x + 0.5) / 2;
    const midY = (8 + 0.5 + mirrored.y + 0.5) / 2;
    const distance = Math.abs(dx * (ay - midY) - dy * (ax - midX)) / Math.hypot(dx, dy);
    assert.ok(distance < 0.6);
    assert.equal(symmetryAxisOf(null), null);
    assert.equal(symmetryAxisOf({ x0: 1, y0: 2, x1: 1, y1: 2 }), null);
    assert.equal(symmetryAxisOf({ x0: 1.5, y0: 2, x1: 3, y1: 4 }), null);
    assert.deepEqual(symmetryAxisOf({ x0: 1, y0: 2, x1: 4, y1: 6 }), { x0: 1, y0: 2, x1: 4, y1: 6 });
    const clipped = clipAxisLine(vertical, 16);
    assert.ok(clipped);
    assert.ok(Math.abs(clipped.x0 - 5.5) < 1e-6);
    assert.ok(Math.abs(clipped.x1 - 5.5) < 1e-6);
    assert.equal(Math.min(clipped.y0, clipped.y1), 0);
    assert.equal(Math.max(clipped.y0, clipped.y1), 16);
  });

  it("stamps a stroke once on each side and clips each side to the selection", () => {
    const axis = { x0: 4, y0: 0, x1: 4, y1: 8 };
    const stroke = [
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ];
    const both = symmetricStampCells(stroke, axis, 16, null);
    const keys = both.map((point) => `${point.x},${point.y}`);
    assert.deepEqual(keys.filter((key, index) => keys.indexOf(key) !== index), []);
    for (const point of stroke) assert.ok(keys.includes(`${point.x},${point.y}`));
    assert.ok(keys.includes("7,2"));
    assert.ok(keys.includes("6,2"));
    assert.ok(keys.includes("5,2"));
    assert.equal(keys.includes("4,2"), false);
    const selection = (x: number) => x >= 1 && x <= 5;
    const clipped = symmetricStampCells(stroke, axis, 16, selection);
    const clippedKeys = clipped.map((point) => `${point.x},${point.y}`);
    assert.deepEqual(clippedKeys.sort(), ["1,2", "2,2", "3,2", "5,2"]);
    const gapped = symmetricStampCells(
      [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 3, y: 2 },
        { x: 6, y: 2 },
      ],
      axis,
      16,
      (x, y) => !(x === 3 && y === 2),
    );
    assert.equal(gapped.some((point) => point.x === 3 && point.y === 2), false);
    assert.equal(gapped.some((point) => point.x === 4 && point.y === 2), false);
    assert.equal(gapped.some((point) => point.x === 5 && point.y === 2), false);
    assert.ok(gapped.some((point) => point.x === 7 && point.y === 1));
    assert.ok(gapped.some((point) => point.x === 2 && point.y === 2));
    const bridged = symmetricStampCells(
      [
        { x: 3, y: 4 },
        { x: 4, y: 5 },
      ],
      { x0: 0, y0: 0, x1: -4, y1: -6 },
      16,
      null,
    );
    assert.ok(bridged.some((point) => point.x === 3 && point.y === 5));
  });

  it("draws a stable 1px ellipse outline and clips it like a pen", () => {
    const setOf = (points: { x: number; y: number }[]) => points.map((point) => `${point.x},${point.y}`).sort();
    const circle = ellipseOutline(0, 0, 16, 16);
    assert.deepEqual(setOf(circle), setOf(ellipseOutline(16, 16, 0, 0)));
    const on = new Set(setOf(circle));
    assert.equal(on.has("0,8"), true);
    assert.equal(on.has("16,8"), true);
    assert.equal(on.has("8,0"), true);
    assert.equal(on.has("8,16"), true);
    assert.equal(on.has("8,8"), false);
    assert.equal(on.has("0,0"), false);
    assert.ok(on.size < 80);
    const wide = ellipseOutline(0, 2, 16, 6);
    const wideOn = new Set(setOf(wide));
    assert.equal(wideOn.has("0,4"), true);
    assert.equal(wideOn.has("16,4"), true);
    assert.equal(wideOn.has("8,4"), false);
    const tall = ellipseOutline(3, 0, 7, 14);
    const tallOn = new Set(setOf(tall));
    assert.equal(tallOn.has("5,0"), true);
    assert.equal(tallOn.has("5,14"), true);
    assert.equal(tallOn.has("5,7"), false);
    assert.deepEqual(ellipseOutline(4, 4, 4, 4), [{ x: 4, y: 4 }]);
    assert.deepEqual(setOf(ellipseOutline(1, 2, 5, 2)), ["1,2", "2,2", "3,2", "4,2", "5,2"]);
    assert.deepEqual(setOf(ellipseOutline(3, 1, 3, 4)), ["3,1", "3,2", "3,3", "3,4"]);
    const ink = { r: 10, g: 20, b: 30, a: 255 };
    const size = 18;
    const data = createPixels(size);
    writePixel(data, size, 8, 0, { r: 1, g: 2, b: 3, a: 80 });
    const painted = paintEllipse(data, size, 0, 0, 16, 16, { mode: "rgba", color: ink }, null);
    assert.ok(painted > 0);
    assert.deepEqual(readPixel(data, size, 8, 0), { r: 10, g: 20, b: 30, a: 80 });
    assert.deepEqual(readPixel(data, size, 8, 8), PIXEL_CLEAR);
    assert.equal(paintEllipse(data, size, 0, 0, 16, 16, { mode: "rgba", color: ink }, null), 0);
    const clipped = createPixels(size);
    const selection = { kind: "rect" as const, rect: { x: 0, y: 0, w: 4, h: 18 } };
    const inside = paintEllipse(clipped, size, 0, 0, 16, 16, { mode: "rgba", color: ink }, selection);
    assert.ok(inside > 0);
    assert.equal(readPixel(clipped, size, 16, 8).a, 0);
    assert.equal(readPixel(clipped, size, 0, 8).a, 255);
    const alpha = createPixels(size);
    writePixel(alpha, size, 4, 4, { r: 9, g: 8, b: 7, a: 200 });
    assert.equal(paintEllipse(alpha, size, 4, 4, 4, 4, { mode: "alpha", alpha: 40 }, null), 1);
    assert.deepEqual(readPixel(alpha, size, 4, 4), { r: 9, g: 8, b: 7, a: 40 });
    const erased = createPixels(size);
    writePixel(erased, size, 2, 2, ink);
    assert.equal(paintEllipse(erased, size, 2, 2, 2, 2, { mode: "rgba", color: PIXEL_CLEAR }, null), 1);
    assert.equal(readPixel(erased, size, 2, 2).a, 0);
  });

  it("flips a selection horizontally without touching the outside", () => {
    const size = 6;
    const data = createPixels(size);
    writePixel(data, size, 0, 1, { r: 9, g: 0, b: 0, a: 255 });
    writePixel(data, size, 1, 1, { r: 0, g: 0, b: 0, a: 0 });
    writePixel(data, size, 2, 1, { r: 10, g: 20, b: 30, a: 80 });
    writePixel(data, size, 3, 1, { r: 4, g: 5, b: 6, a: 255 });
    const rect = { kind: "rect" as const, rect: { x: 1, y: 1, w: 3, h: 1 } };
    const before = clonePixelSelection(rect);
    assert.equal(flipSelectionHorizontal(data, size, rect), true);
    assert.deepEqual(readPixel(data, size, 0, 1), { r: 9, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(data, size, 1, 1), { r: 4, g: 5, b: 6, a: 255 });
    assert.deepEqual(readPixel(data, size, 2, 1), { r: 10, g: 20, b: 30, a: 80 });
    assert.deepEqual(readPixel(data, size, 3, 1), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(rect, before);
    assert.equal(flipSelectionHorizontal(data, size, rect), true);
    assert.deepEqual(readPixel(data, size, 1, 1), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(data, size, 2, 1), { r: 10, g: 20, b: 30, a: 80 });
    assert.deepEqual(readPixel(data, size, 3, 1), { r: 4, g: 5, b: 6, a: 255 });
    const narrow = createPixels(size);
    writePixel(narrow, size, 2, 2, { r: 1, g: 2, b: 3, a: 255 });
    assert.equal(flipSelectionHorizontal(narrow, size, { kind: "rect", rect: { x: 2, y: 0, w: 1, h: 4 } }), false);
    assert.deepEqual(readPixel(narrow, size, 2, 2), { r: 1, g: 2, b: 3, a: 255 });
  });

  it("flips an irregular mask in place and a blank selection flips the canvas", () => {
    const size = 5;
    const data = createPixels(size);
    writePixel(data, size, 0, 0, { r: 1, g: 0, b: 0, a: 255 });
    writePixel(data, size, 1, 0, { r: 0, g: 2, b: 0, a: 255 });
    writePixel(data, size, 2, 0, { r: 0, g: 0, b: 3, a: 255 });
    writePixel(data, size, 1, 1, { r: 8, g: 8, b: 8, a: 80 });
    const mask = new Uint8Array(size * size);
    mask[0] = 1;
    mask[1] = 1;
    mask[size + 1] = 1;
    const selection = { kind: "lasso" as const, mask, bounds: { x: 0, y: 0, w: 2, h: 2 } };
    assert.equal(flipSelectionHorizontal(data, size, selection), true);
    assert.deepEqual(readPixel(data, size, 0, 0), { r: 0, g: 2, b: 0, a: 255 });
    assert.deepEqual(readPixel(data, size, 1, 0), { r: 1, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(data, size, 0, 1), { r: 8, g: 8, b: 8, a: 80 });
    assert.deepEqual(readPixel(data, size, 1, 1), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(data, size, 2, 0), { r: 0, g: 0, b: 3, a: 255 });
    const mirrored = mirrorSelectionHorizontal(selection, size);
    assert.equal(mirrored.kind, "lasso");
    if (mirrored.kind === "lasso") {
      assert.equal(mirrored.mask[0], 1);
      assert.equal(mirrored.mask[1], 1);
      assert.equal(mirrored.mask[size], 1);
      assert.equal(mirrored.mask[size + 1], 0);
    }
    const flippedBack = createPixels(size);
    writePixel(flippedBack, size, 0, 0, { r: 0, g: 2, b: 0, a: 255 });
    writePixel(flippedBack, size, 1, 0, { r: 1, g: 0, b: 0, a: 255 });
    writePixel(flippedBack, size, 0, 1, { r: 8, g: 8, b: 8, a: 80 });
    writePixel(flippedBack, size, 2, 0, { r: 0, g: 0, b: 3, a: 255 });
    assert.equal(flipSelectionHorizontal(flippedBack, size, mirrored), true);
    assert.deepEqual(readPixel(flippedBack, size, 0, 0), { r: 1, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(flippedBack, size, 1, 0), { r: 0, g: 2, b: 0, a: 255 });
    assert.deepEqual(readPixel(flippedBack, size, 1, 1), { r: 8, g: 8, b: 8, a: 80 });
    assert.deepEqual(readPixel(flippedBack, size, 2, 0), { r: 0, g: 0, b: 3, a: 255 });
    const canvas = createPixels(2);
    writePixel(canvas, 2, 0, 0, { r: 1, g: 0, b: 0, a: 255 });
    writePixel(canvas, 2, 1, 0, { r: 2, g: 0, b: 0, a: 200 });
    writePixel(canvas, 2, 0, 1, { r: 3, g: 0, b: 0, a: 10 });
    writePixel(canvas, 2, 1, 1, { r: 4, g: 0, b: 0, a: 0 });
    assert.equal(flipSelectionHorizontal(canvas, 2, null), true);
    assert.equal(canvas.length, 16);
    assert.deepEqual(readPixel(canvas, 2, 0, 0), { r: 2, g: 0, b: 0, a: 200 });
    assert.deepEqual(readPixel(canvas, 2, 1, 0), { r: 1, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(canvas, 2, 0, 1), { r: 4, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(canvas, 2, 1, 1), { r: 3, g: 0, b: 0, a: 10 });
    assert.equal(flipSelectionHorizontal(canvas, 2, null), true);
    assert.deepEqual(readPixel(canvas, 2, 0, 0), { r: 1, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(canvas, 2, 1, 1), { r: 4, g: 0, b: 0, a: 0 });
  });

  it("names duplicated pixel tabs without colliding", () => {
    assert.equal(duplicatePixelTabName("キャラクター", ["キャラクター"]), "キャラクター（1）");
    assert.equal(duplicatePixelTabName("キャラクター", ["キャラクター", "キャラクター（1）"]), "キャラクター（2）");
    assert.equal(duplicatePixelTabName("キャラクター（1）", ["キャラクター（1）"]), "キャラクター（2）");
    assert.equal(duplicatePixelTabName("キャラクター（1）", ["キャラクター（1）", "キャラクター（2）"]), "キャラクター（3）");
    assert.equal(duplicatePixelTabName("キャラクター（2）", ["キャラクター（2）"]), "キャラクター（1）");
    assert.equal(duplicatePixelTabName("  ", []), "キャンバス（1）");
  });

  it("copies a selection without touching the source and stamps transparency inside the mask", () => {
    const size = 4;
    const canvas = createPixels(size);
    writePixel(canvas, size, 1, 1, { r: 255, g: 0, b: 0, a: 255 });
    writePixel(canvas, size, 2, 1, { r: 0, g: 0, b: 0, a: 0 });
    writePixel(canvas, size, 0, 0, { r: 9, g: 9, b: 9, a: 255 });
    const before = [...canvas];
    const rect = copyPixelSelection(canvas, size, { kind: "rect", rect: { x: 1, y: 1, w: 2, h: 1 } });
    assert.ok(rect);
    assert.equal(rect.w, 2);
    assert.equal(rect.h, 1);
    assert.deepEqual([...rect.mask], [1, 1]);
    assert.deepEqual([...rect.rgba.slice(0, 4)], [255, 0, 0, 255]);
    assert.deepEqual([...rect.rgba.slice(4, 8)], [0, 0, 0, 0]);
    assert.deepEqual([...canvas], before);
    const mask = new Uint8Array(size * size);
    mask[1 * size + 1] = 1;
    mask[2 * size + 2] = 1;
    const lasso = copyPixelSelection(canvas, size, { kind: "lasso", mask, bounds: { x: 1, y: 1, w: 2, h: 2 } });
    assert.ok(lasso);
    assert.equal(lasso.mask[0], 1);
    assert.equal(lasso.mask[lasso.w + 1], 1);
    assert.equal(lasso.mask[1], 0);
    const dest = createPixels(size);
    writePixel(dest, size, 0, 0, { r: 1, g: 2, b: 3, a: 255 });
    writePixel(dest, size, 1, 0, { r: 4, g: 5, b: 6, a: 255 });
    const history = emptyPixelHistory();
    const snapshot = new Uint8ClampedArray(dest);
    stampPixelClip(dest, size, rect, -1, 0);
    notePixelHistory(history, snapshot);
    assert.deepEqual(readPixel(dest, size, 0, 0), { r: 1, g: 2, b: 3, a: 255 });
    assert.deepEqual(readPixel(dest, size, 1, 0), { r: 4, g: 5, b: 6, a: 255 });
    const landed = pastedSelection(rect, -1, 0, size);
    assert.deepEqual(landed, { kind: "rect", rect: { x: 0, y: 0, w: 1, h: 1 } });
    const lassoLanded = pastedSelection(lasso, 3, 3, size);
    assert.equal(lassoLanded?.kind, "lasso");
    if (lassoLanded?.kind === "lasso") assert.equal(lassoLanded.mask[3 * size + 3], 1);
    assert.equal(pastedSelection(rect, 8, 8, size), null);
    assert.equal(clipHas(rect, -1, 0, 0, 0), true);
    assert.equal(clipHas(rect, -1, 0, 1, 0), false);
    const undone = undoPixelHistory(history, new Uint8ClampedArray(dest));
    assert.ok(undone);
    assert.deepEqual(readPixel(undone, size, 0, 0), { r: 1, g: 2, b: 3, a: 255 });
    assert.deepEqual([...canvas], before);
  });

  it("rotates and scales a clip without touching the source or the outside", () => {
    const size = 4;
    const canvas = createPixels(size);
    writePixel(canvas, size, 0, 0, { r: 1, g: 0, b: 0, a: 255 });
    writePixel(canvas, size, 1, 0, { r: 2, g: 0, b: 0, a: 255 });
    writePixel(canvas, size, 0, 1, { r: 3, g: 0, b: 0, a: 128 });
    writePixel(canvas, size, 1, 1, { r: 4, g: 0, b: 0, a: 0 });
    writePixel(canvas, size, 3, 3, { r: 9, g: 9, b: 9, a: 255 });
    const before = [...canvas];
    const clip = copyPixelSelection(canvas, size, { kind: "rect", rect: { x: 0, y: 0, w: 2, h: 2 } });
    assert.ok(clip);
    const turned = warpPixels(canvas, size, clip, 0, 0, { cx: 1, cy: 1, scaleX: 1, scaleY: 1, degrees: 90, filter: "nearest" });
    assert.deepEqual(readPixel(turned.data, size, 0, 0), { r: 3, g: 0, b: 0, a: 128 });
    assert.deepEqual(readPixel(turned.data, size, 1, 0), { r: 1, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(turned.data, size, 0, 1), { r: 4, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(turned.data, size, 1, 1), { r: 2, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(turned.data, size, 3, 3), { r: 9, g: 9, b: 9, a: 255 });
    assert.equal(turned.selection?.kind, "rect");
    const spun = warpPixels(canvas, size, clip, 0, 0, { cx: 1, cy: 1, scaleX: 1, scaleY: 1, degrees: 180, filter: "nearest" });
    assert.deepEqual(readPixel(spun.data, size, 0, 0), { r: 4, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(spun.data, size, 1, 1), { r: 1, g: 0, b: 0, a: 255 });
    const right = warpPixels(canvas, size, clip, 0, 0, { cx: 1, cy: 1, scaleX: 1, scaleY: 1, degrees: 270, filter: "nearest" });
    assert.deepEqual(readPixel(right.data, size, 1, 0), { r: 4, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(right.data, size, 0, 1), { r: 1, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(right.data, size, 1, 1), { r: 3, g: 0, b: 0, a: 128 });
    const smooth = warpPixels(canvas, size, clip, 0, 0, { cx: 1, cy: 1, scaleX: 1, scaleY: 1, degrees: 0, filter: "bilinear" });
    assert.deepEqual(readPixel(smooth.data, size, 0, 0), { r: 1, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(smooth.data, size, 0, 1), { r: 3, g: 0, b: 0, a: 128 });
    const dot = copyPixelSelection(canvas, size, { kind: "rect", rect: { x: 3, y: 3, w: 1, h: 1 } });
    assert.ok(dot);
    const grown = warpPixels(canvas, size, dot, 3, 3, { cx: 3.5, cy: 3.5, scaleX: 2, scaleY: 2, degrees: 0, filter: "nearest" });
    assert.deepEqual(readPixel(grown.data, size, 3, 3), { r: 9, g: 9, b: 9, a: 255 });
    assert.deepEqual(readPixel(grown.data, size, 2, 2), { r: 9, g: 9, b: 9, a: 255 });
    assert.deepEqual(readPixel(grown.data, size, 0, 0), { r: 1, g: 0, b: 0, a: 255 });
    const shifted = warpPixels(canvas, size, clip, 0, 0, { cx: 3, cy: 1, scaleX: 1, scaleY: 1, degrees: 0, filter: "nearest" });
    assert.deepEqual(readPixel(shifted.data, size, 0, 0), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(shifted.data, size, 3, 0), { r: 2, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(shifted.data, size, 3, 3), { r: 9, g: 9, b: 9, a: 255 });
    const mask = new Uint8Array(size * size);
    mask[0] = 1;
    const lasso = copyPixelSelection(canvas, size, { kind: "lasso", mask, bounds: { x: 0, y: 0, w: 1, h: 1 } });
    assert.ok(lasso);
    const moved = warpPixels(canvas, size, lasso, 0, 0, { cx: 2.5, cy: 0.5, scaleX: 1, scaleY: 1, degrees: 0, filter: "nearest" });
    assert.deepEqual(readPixel(moved.data, size, 0, 0), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(moved.data, size, 2, 0), { r: 1, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(moved.data, size, 1, 0), { r: 2, g: 0, b: 0, a: 255 });
    assert.equal(moved.selection?.kind, "rect");
    const linked = warpSetWidth(clip, 1, 4, true);
    assert.equal(warpEdge(clip.w, linked.scaleX), 4);
    assert.equal(warpEdge(clip.h, linked.scaleY), 4);
    assert.deepEqual([...canvas], before);
  });

  it("keeps corner scales locked and parks rotate handles outside the corners", () => {
    const clip = { w: 10, h: 6, rgba: new Uint8ClampedArray(0), mask: new Uint8Array(0) };
    const warp = { cx: 20, cy: 15, scaleX: 2, scaleY: 1, degrees: 0, filter: "nearest" as const };
    const locked = warpLockedScales(clip.w, clip.h, warp.scaleX, warp.scaleY, 20, 6);
    assert.ok(Math.abs(locked.scaleX / locked.scaleY - warp.scaleX / warp.scaleY) < 1e-9);
    const same = warpLockedScales(clip.w, clip.h, 2, 1, 10, 3);
    assert.ok(Math.abs(same.scaleX - 2) < 1e-9);
    assert.ok(Math.abs(same.scaleY - 1) < 1e-9);
    const corners = warpCorners(clip, warp);
    const handles = warpRotateHandles(clip, warp, 8);
    assert.equal(handles.length, 4);
    handles.forEach((handle, index) => {
      const corner = corners[index]!;
      const gap = Math.hypot(handle.x - corner.x, handle.y - corner.y);
      assert.ok(Math.abs(gap - 8) < 1e-9);
      const out = Math.hypot(handle.x - warp.cx, handle.y - warp.cy);
      const box = Math.hypot(corner.x - warp.cx, corner.y - warp.cy);
      assert.ok(out > box);
    });
  });

  it("resizes the canvas without resampling and keeps the odd pixel on the end edge", () => {
    const oldW = 4;
    const oldH = 2;
    const canvas = createPixels(oldW, oldH);
    writePixel(canvas, { width: oldW, height: oldH }, 0, 0, { r: 1, g: 2, b: 3, a: 128 });
    writePixel(canvas, { width: oldW, height: oldH }, 3, 1, { r: 9, g: 0, b: 0, a: 0 });
    const clearAt = (1 * oldW + 3) * 4;
    canvas[clearAt + 1] = 7;
    const before = [...canvas];
    assert.equal(canvasAnchorOffset(4, 7, 1), 1);
    assert.equal(canvasAnchorOffset(4, 3, 1), -1);
    assert.equal(clampCanvasEdge(0), null);
    assert.equal(clampCanvasEdge(1.5), null);
    assert.equal(clampCanvasEdge(256), 256);
    const grown = resizePixelCanvas(canvas, oldW, oldH, 7, 2, 1, 0);
    assert.equal(grown.length, 7 * 2 * 4);
    assert.deepEqual(readPixel(grown, { width: 7, height: 2 }, 1, 0), { r: 1, g: 2, b: 3, a: 128 });
    assert.deepEqual(readPixel(grown, { width: 7, height: 2 }, 0, 0), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(grown, { width: 7, height: 2 }, 4, 1), { r: 9, g: 7, b: 0, a: 0 });
    assert.equal(grown[(1 * 7 + 4) * 4 + 1], 7);
    const tall = resizePixelCanvas(canvas, oldW, oldH, 4, 5, 0, 1);
    assert.deepEqual(readPixel(tall, { width: 4, height: 5 }, 0, 1), { r: 1, g: 2, b: 3, a: 128 });
    assert.deepEqual(readPixel(tall, { width: 4, height: 5 }, 0, 0), { r: 0, g: 0, b: 0, a: 0 });
    const corner = resizePixelCanvas(canvas, oldW, oldH, 6, 4, 2, 2);
    assert.deepEqual(readPixel(corner, { width: 6, height: 4 }, 2, 2), { r: 1, g: 2, b: 3, a: 128 });
    const cropped = resizePixelCanvas(canvas, oldW, oldH, 3, 2, 1, 0);
    assert.deepEqual(readPixel(cropped, { width: 3, height: 2 }, 0, 0), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(cropped, { width: 3, height: 2 }, 2, 1), { r: 9, g: 7, b: 0, a: 0 });
    const frame = canvasPreviewFrame(4, 2, 3, 2, 1, 0);
    assert.equal(frame.viewW, 4);
    assert.equal(frame.oldX, 0);
    assert.equal(frame.nextX, 1);
    const anchors = [0, 1, 2] as const;
    for (const ax of anchors) {
      for (const ay of anchors) {
        const next = resizePixelCanvas(canvas, oldW, oldH, 6, 4, ax, ay);
        const ox = canvasAnchorOffset(oldW, 6, ax);
        const oy = canvasAnchorOffset(oldH, 4, ay);
        assert.deepEqual(readPixel(next, { width: 6, height: 4 }, ox, oy), { r: 1, g: 2, b: 3, a: 128 });
      }
    }
    const selection = shiftPixelSelection({ kind: "rect", rect: { x: 0, y: 0, w: 2, h: 1 } }, 1, 0, { width: 4, height: 2 }, { width: 7, height: 2 });
    assert.deepEqual(selection, { kind: "rect", rect: { x: 1, y: 0, w: 2, h: 1 } });
    assert.deepEqual([...canvas], before);
  });

  it("trims only fully clear margins and keeps semi-transparent pixels and hidden RGB", () => {
    const width = 5;
    const height = 4;
    const canvas = createPixels(width, height);
    writePixel(canvas, { width, height }, 0, 0, { r: 9, g: 7, b: 1, a: 0 });
    const outside = (0 * width + 0) * 4;
    canvas[outside] = 9;
    canvas[outside + 1] = 7;
    canvas[outside + 2] = 1;
    writePixel(canvas, { width, height }, 1, 1, { r: 1, g: 2, b: 3, a: 128 });
    writePixel(canvas, { width, height }, 2, 1, { r: 0, g: 0, b: 0, a: 0 });
    const inside = (1 * width + 2) * 4;
    canvas[inside] = 8;
    canvas[inside + 1] = 8;
    canvas[inside + 2] = 8;
    writePixel(canvas, { width, height }, 3, 2, { r: 4, g: 5, b: 6, a: 1 });
    const before = [...canvas];
    assert.equal(opaquePixelBounds(createPixels(width, height), { width, height }), null);
    const bounds = opaquePixelBounds(canvas, { width, height });
    assert.deepEqual(bounds, { x: 1, y: 1, w: 3, h: 2, left: 1, right: 1, top: 1, bottom: 1 });
    const trimmed = cropPixelCanvas(canvas, width, height, bounds!.x, bounds!.y, bounds!.w, bounds!.h);
    assert.equal(trimmed.length, 3 * 2 * 4);
    assert.deepEqual(readPixel(trimmed, { width: 3, height: 2 }, 0, 0), { r: 1, g: 2, b: 3, a: 128 });
    assert.deepEqual(readPixel(trimmed, { width: 3, height: 2 }, 1, 0), { r: 8, g: 8, b: 8, a: 0 });
    assert.deepEqual(readPixel(trimmed, { width: 3, height: 2 }, 2, 1), { r: 4, g: 5, b: 6, a: 1 });
    const full = opaquePixelBounds(trimmed, { width: 3, height: 2 });
    assert.deepEqual(full, { x: 0, y: 0, w: 3, h: 2, left: 0, right: 0, top: 0, bottom: 0 });
    const tight = createPixels(2, 2);
    writePixel(tight, 2, 0, 0, { r: 1, g: 0, b: 0, a: 255 });
    writePixel(tight, 2, 1, 1, { r: 0, g: 0, b: 1, a: 255 });
    assert.deepEqual(opaquePixelBounds(tight, 2), { x: 0, y: 0, w: 2, h: 2, left: 0, right: 0, top: 0, bottom: 0 });
    const one = cropPixelCanvas(canvas, width, height, 1, 1, 1, 1);
    assert.deepEqual(readPixel(one, 1, 0, 0), { r: 1, g: 2, b: 3, a: 128 });
    assert.deepEqual([...canvas], before);
  });
});

describe("pixel layers", () => {
  it("names layers in order and composites front over back without hiding clear pixels", () => {
    assert.equal(nextPixelLayerName([]), "レイヤー1");
    assert.equal(nextPixelLayerName(["レイヤー1", "髪"]), "レイヤー2");
    assert.equal(nextPixelLayerName(["レイヤー2", "レイヤー9"]), "レイヤー10");
    const size = 2;
    const back = createPixels(size);
    const front = createPixels(size);
    writePixel(back, size, 0, 0, { r: 0, g: 0, b: 255, a: 255 });
    writePixel(back, size, 1, 0, { r: 0, g: 255, b: 0, a: 255 });
    writePixel(front, size, 0, 0, { r: 255, g: 0, b: 0, a: 128 });
    writePixel(front, size, 1, 1, { r: 255, g: 255, b: 0, a: 255 });
    const beforeBack = [...back];
    const flat = compositePixelLayers(
      [
        { id: "front", visible: true, pixels: front },
        { id: "back", visible: true, pixels: back },
      ],
      size,
      size,
    );
    const over = readPixel(flat, size, 0, 0);
    assert.ok(over.r > 100 && over.r < 160);
    assert.ok(over.b > 100 && over.b < 160);
    assert.equal(over.a, 255);
    assert.deepEqual(readPixel(flat, size, 1, 0), { r: 0, g: 255, b: 0, a: 255 });
    assert.deepEqual(readPixel(flat, size, 1, 1), { r: 255, g: 255, b: 0, a: 255 });
    const hidden = compositePixelLayers(
      [
        { id: "front", visible: false, pixels: front },
        { id: "back", visible: true, pixels: back },
      ],
      size,
      size,
      { id: "front", pixels: front },
    );
    assert.deepEqual(readPixel(hidden, size, 0, 0), { r: 0, g: 0, b: 255, a: 255 });
    assert.deepEqual(readPixel(hidden, size, 1, 1), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual([...back], beforeBack);
  });

  it("merges visibility into the lower layer and stamps without deleting the source", () => {
    const size = 1;
    const upper = createPixels(size);
    const lower = createPixels(size);
    writePixel(upper, size, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
    writePixel(lower, size, 0, 0, { r: 0, g: 0, b: 255, a: 255 });
    const merged = mergeVisiblePair(upper, true, lower, true);
    assert.equal(merged.visible, true);
    assert.deepEqual(readPixel(merged.pixels, size, 0, 0), { r: 255, g: 0, b: 0, a: 255 });
    const hiddenUpper = mergeVisiblePair(upper, false, lower, true);
    assert.deepEqual(readPixel(hiddenUpper.pixels, size, 0, 0), { r: 0, g: 0, b: 255, a: 255 });
    const hiddenLower = mergeVisiblePair(upper, true, lower, false);
    assert.equal(hiddenLower.visible, true);
    assert.deepEqual(readPixel(hiddenLower.pixels, size, 0, 0), { r: 255, g: 0, b: 0, a: 255 });
    const bothHidden = mergeVisiblePair(upper, false, lower, false);
    assert.equal(bothHidden.visible, false);
    assert.deepEqual(readPixel(bothHidden.pixels, size, 0, 0), { r: 255, g: 0, b: 0, a: 255 });
    const stamped = stampLayerPixels(lower, upper);
    assert.deepEqual(readPixel(stamped, size, 0, 0), { r: 255, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(lower, size, 0, 0), { r: 0, g: 0, b: 255, a: 255 });
    assert.deepEqual(readPixel(upper, size, 0, 0), { r: 255, g: 0, b: 0, a: 255 });
    const clear = createPixels(size);
    blendPixelOver(clear, createPixels(size));
    assert.deepEqual(readPixel(clear, size, 0, 0), { r: 0, g: 0, b: 0, a: 0 });
  });

  it("reorders layers without mixing their pixels and unions trim bounds", () => {
    const layers = ["a", "b", "c"];
    assert.deepEqual(moveLayerIndex(layers, 0, 0), null);
    assert.deepEqual(moveLayerIndex(layers, 0, 1), null);
    assert.deepEqual(moveLayerIndex(layers, 0, 3), ["b", "c", "a"]);
    assert.deepEqual(moveLayerIndex(layers, 2, 0), ["c", "a", "b"]);
    assert.equal(moveLayerIndex(layers, 5, 0), null);
    const size = 4;
    const hair = createPixels(size);
    const body = createPixels(size);
    writePixel(hair, size, 0, 1, { r: 1, g: 0, b: 0, a: 255 });
    writePixel(body, size, 3, 2, { r: 0, g: 1, b: 0, a: 10 });
    assert.deepEqual(unionOpaqueBounds([hair, body], size), { x: 0, y: 1, w: 4, h: 2, left: 0, right: 0, top: 1, bottom: 1 });
    assert.equal(unionOpaqueBounds([createPixels(size)], size), null);
  });

  it("keeps an irregular mask and its origin when copying, including clear cells", () => {
    const size = 4;
    const canvas = createPixels(size);
    writePixel(canvas, size, 1, 1, { r: 9, g: 0, b: 0, a: 0 });
    const mask = new Uint8Array(size * size);
    mask[1 * size + 1] = 1;
    mask[1 * size + 2] = 1;
    const clip = copyPixelSelection(canvas, size, { kind: "lasso", mask, bounds: { x: 1, y: 1, w: 2, h: 1 } });
    assert.ok(clip);
    assert.equal(clip.x, 1);
    assert.equal(clip.y, 1);
    assert.deepEqual([...clip.mask], [1, 1]);
    assert.equal(clip.rgba[3], 0);
    const dest = createPixels(size);
    writePixel(dest, size, 1, 1, { r: 1, g: 2, b: 3, a: 255 });
    stampPixelClip(dest, size, clip, clip.x ?? 0, clip.y ?? 0);
    assert.deepEqual(readPixel(dest, size, 1, 1), { r: 1, g: 2, b: 3, a: 255 });
    assert.deepEqual(readPixel(dest, size, 0, 0), { r: 0, g: 0, b: 0, a: 0 });
  });

  it("pastes opaque and partial alpha, and leaves clear cells and the outside alone", () => {
    const size = 4;
    const dest = createPixels(size);
    writePixel(dest, size, 0, 0, { r: 0, g: 0, b: 255, a: 255 });
    writePixel(dest, size, 1, 0, { r: 0, g: 0, b: 255, a: 255 });
    writePixel(dest, size, 2, 0, { r: 0, g: 0, b: 255, a: 255 });
    const rgba = new Uint8ClampedArray(3 * 4);
    rgba.set([255, 0, 0, 255], 0);
    rgba.set([255, 0, 0, 128], 4);
    rgba.set([0, 0, 0, 0], 8);
    const clip = { w: 3, h: 1, rgba, mask: new Uint8Array([1, 1, 1]) };
    const limit = { kind: "rect" as const, rect: { x: 0, y: 0, w: 2, h: 1 } };
    stampPixelClip(dest, size, clip, 0, 0, limit);
    assert.deepEqual(readPixel(dest, size, 0, 0), { r: 255, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(dest, size, 1, 0), { r: 128, g: 0, b: 127, a: 255 });
    assert.deepEqual(readPixel(dest, size, 2, 0), { r: 0, g: 0, b: 255, a: 255 });
  });

  it("keeps a flood and a gradient inside an irregular selection", () => {
    const size = 4;
    const data = createPixels(size);
    for (let y = 0; y < size; y += 1) writePixel(data, size, 0, y, { r: 1, g: 0, b: 0, a: 255 });
    writePixel(data, size, 1, 0, { r: 1, g: 0, b: 0, a: 255 });
    const mask = new Uint8Array(size * size);
    mask[0] = 1;
    mask[size] = 1;
    const lasso = { kind: "lasso" as const, mask, bounds: { x: 0, y: 0, w: 1, h: 2 } };
    const blue = { r: 0, g: 0, b: 255, a: 255 };
    assert.equal(floodRgb(data, size, 1, 0, blue, lasso), 0);
    assert.equal(floodRgb(data, size, 0, 0, blue, lasso), 2);
    assert.deepEqual(readPixel(data, size, 0, 0), blue);
    assert.deepEqual(readPixel(data, size, 0, 1), blue);
    assert.deepEqual(readPixel(data, size, 0, 2), { r: 1, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(data, size, 1, 0), { r: 1, g: 0, b: 0, a: 255 });
    const line = createPixels(size);
    writePixel(line, size, 0, 1, { r: 0, g: 0, b: 0, a: 255 });
    writePixel(line, size, 1, 1, { r: 0, g: 0, b: 0, a: 255 });
    writePixel(line, size, 2, 1, { r: 255, g: 0, b: 0, a: 255 });
    const miss = { kind: "rect" as const, rect: { x: 0, y: 0, w: 1, h: 1 } };
    assert.equal(applyPixelGradient(line, size, 0, 1, 2, 1, miss), false);
    assert.deepEqual(readPixel(line, size, 1, 1), { r: 0, g: 0, b: 0, a: 255 });
    assert.equal(applyPixelGradient(line, size, 0, 1, 2, 1, { kind: "rect", rect: { x: 1, y: 1, w: 1, h: 1 } }), true);
    assert.deepEqual(readPixel(line, size, 1, 1), { r: 128, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(line, size, 0, 1), { r: 0, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(line, size, 2, 1), { r: 255, g: 0, b: 0, a: 255 });
  });

  it("floats a selection without erasing the destination until the opaque cells land", () => {
    const size = 4;
    const base = createPixels(size);
    writePixel(base, size, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
    writePixel(base, size, 0, 1, { r: 0, g: 0, b: 0, a: 0 });
    writePixel(base, size, 2, 0, { r: 0, g: 0, b: 255, a: 255 });
    writePixel(base, size, 2, 1, { r: 0, g: 255, b: 0, a: 255 });
    const selection = { kind: "rect" as const, rect: { x: 0, y: 0, w: 1, h: 2 } };
    const clip = copyPixelSelection(base, size, selection);
    assert.ok(clip);
    const placed = commitFloatMove(base, null, size, size, selection, clip, 2, 0);
    assert.deepEqual(readPixel(placed.pixels, size, 0, 0), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(placed.pixels, size, 2, 0), { r: 255, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(placed.pixels, size, 2, 1), { r: 0, g: 255, b: 0, a: 255 });
    assert.deepEqual(readPixel(base, size, 0, 0), { r: 255, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(base, size, 2, 0), { r: 0, g: 0, b: 255, a: 255 });
    const off = commitFloatMove(base, null, size, size, selection, clip, -1, 0);
    assert.equal(readPixel(off.pixels, size, 0, 0).a, 0);
    assert.ok(off.rest);
    assert.equal(off.rest.x, -1);
    const lx = -1 - off.rest.x;
    const ly = 0 - off.rest.y;
    const at = (ly * off.rest.width + lx) * 4;
    assert.equal(off.rest.pixels[at], 255);
    assert.equal(off.rest.pixels[at + 3], 255);
    assert.deepEqual(readPixel(base, size, 2, 0), { r: 0, g: 0, b: 255, a: 255 });
  });
});

describe("pixel folder export", () => {
  it("scales with nearest neighbor and keeps clear RGB", () => {
    const width = 2;
    const height = 1;
    const canvas = createPixels(width, height);
    writePixel(canvas, { width, height }, 1, 0, { r: 1, g: 2, b: 3, a: 128 });
    canvas[0] = 10;
    canvas[1] = 20;
    canvas[2] = 30;
    canvas[3] = 0;
    const scaled = scalePixelsNearest(canvas, width, height, 2);
    assert.equal(scaled.length, 4 * 2 * 4);
    assert.deepEqual([...scaled.subarray(0, 4)], [10, 20, 30, 0]);
    assert.deepEqual([...scaled.subarray(4, 8)], [10, 20, 30, 0]);
    assert.deepEqual(readPixel(scaled, { width: 4, height: 2 }, 2, 0), { r: 1, g: 2, b: 3, a: 128 });
    assert.deepEqual(readPixel(scaled, { width: 4, height: 2 }, 3, 1), { r: 1, g: 2, b: 3, a: 128 });
    assert.equal(scalePixelsNearest(canvas, width, height, 0).length, 0);
    assert.equal(isPixelExportScale(1), true);
    assert.equal(isPixelExportScale(7), false);
  });

  it("names scaled copies without overwriting a taken name", () => {
    assert.equal(pixelExportFileName("character.png", 2, []), "character_2x.png");
    assert.equal(pixelExportFileName("character.png", 4, ["character_4x.png"]), "character_4x_2.png");
    assert.equal(pixelExportFileName("character.png", 8, ["character_8x.png", "character_8x_2.png"]), "character_8x_3.png");
    assert.equal(pixelExportFileName("pixel", 1, []), "pixel_1x.png");
    assert.equal(pixelExportFileName("  ", 2, []), "pixel_2x.png");
  });

  it("writes a png that still stores the clear pixel's RGB", async () => {
    const width = 2;
    const height = 1;
    const canvas = createPixels(width, height);
    canvas[0] = 9;
    canvas[1] = 8;
    canvas[2] = 7;
    canvas[3] = 0;
    writePixel(canvas, { width, height }, 1, 0, { r: 4, g: 5, b: 6, a: 128 });
    const png = await encodeRgbaPng(canvas, width, height);
    assert.ok(png);
    assert.equal(png[0], 137);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    assert.equal(view.getUint32(16), 2);
    assert.equal(view.getUint32(20), 1);
    let offset = 8;
    let idat: Uint8Array | null = null;
    while (offset + 8 <= png.length) {
      const length = view.getUint32(offset);
      const type = String.fromCharCode(png[offset + 4]!, png[offset + 5]!, png[offset + 6]!, png[offset + 7]!);
      const data = png.subarray(offset + 8, offset + 8 + length);
      if (type === "IDAT") idat = data;
      offset += 12 + length;
      if (type === "IEND") break;
    }
    assert.ok(idat);
    const { inflateSync } = await import("node:zlib");
    const raw = inflateSync(idat);
    assert.equal(raw[0], 0);
    assert.deepEqual([...raw.subarray(1, 5)], [9, 8, 7, 0]);
    assert.deepEqual([...raw.subarray(5, 9)], [4, 5, 6, 128]);
  });
});

describe("pixel layer opacity and image planes", () => {
  it("fades a layer without rewriting its pixels and restores them at 100", () => {
    const size = 1;
    const back = createPixels(size);
    const front = createPixels(size);
    writePixel(back, size, 0, 0, { r: 0, g: 0, b: 255, a: 255 });
    writePixel(front, size, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
    const before = [...front];
    const faded = compositePixelLayers(
      [
        { id: "front", visible: true, pixels: front, opacity: 50 },
        { id: "back", visible: true, pixels: back, opacity: 100 },
      ],
      size,
      size,
    );
    const over = readPixel(faded, size, 0, 0);
    assert.ok(over.r > 100 && over.r < 160);
    assert.ok(over.b > 100 && over.b < 160);
    assert.equal(over.a, 255);
    assert.deepEqual([...front], before);
    const hidden = compositePixelLayers(
      [
        { id: "front", visible: true, pixels: front, opacity: 0 },
        { id: "back", visible: true, pixels: back },
      ],
      size,
      size,
    );
    assert.deepEqual(readPixel(hidden, size, 0, 0), { r: 0, g: 0, b: 255, a: 255 });
    const full = compositePixelLayers(
      [
        { id: "front", visible: true, pixels: front, opacity: 100 },
        { id: "back", visible: true, pixels: back },
      ],
      size,
      size,
    );
    assert.deepEqual(readPixel(full, size, 0, 0), { r: 255, g: 0, b: 0, a: 255 });
    assert.equal(clampLayerOpacity(140), 100);
    assert.equal(clampLayerOpacity(-4), 0);
    const direct = createPixels(size);
    writePixel(direct, size, 0, 0, { r: 0, g: 0, b: 255, a: 255 });
    blendPixelOverOpacity(direct, front, 50);
    assert.deepEqual([...front], before);
  });

  it("keeps a reference image out of the finished picture and on the canvas preview", () => {
    const canvas = 3;
    const image = createPixels(2, 2);
    writePixel(image, 2, 1, 0, { r: 9, g: 8, b: 7, a: 0 });
    writePixel(image, 2, 0, 0, { r: 255, g: 0, b: 0, a: 255 });
    const imageBefore = [...image];
    const dot = createPixels(canvas);
    writePixel(dot, canvas, 2, 2, { r: 0, g: 0, b: 255, a: 255 });
    const layers = [
      { id: "guide", visible: true, kind: "image" as const, pixels: image, opacity: 100, x: 1, y: 1, imgW: 2, imgH: 2 },
      { id: "dot", visible: true, kind: "pixel" as const, pixels: dot, opacity: 100 },
    ];
    const finished = compositePixelLayers(layers, canvas, canvas, null, { guides: false });
    assert.deepEqual(readPixel(finished, canvas, 1, 1), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(finished, canvas, 2, 2), { r: 0, g: 0, b: 255, a: 255 });
    const preview = compositePixelLayers(layers, canvas, canvas);
    assert.deepEqual(readPixel(preview, canvas, 1, 1), { r: 255, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(preview, canvas, 2, 1), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(preview, canvas, 2, 2), { r: 0, g: 0, b: 255, a: 255 });
    assert.deepEqual([...image], imageBefore);
    const projected = projectImagePlane({ x: 1, y: 1, width: 2, height: 2, pixels: image }, canvas, canvas);
    assert.deepEqual(readPixel(projected, canvas, 2, 1), { r: 9, g: 8, b: 7, a: 0 });
    const hiddenGuide = compositePixelLayers(layers.map((layer) => (layer.id === "guide" ? { ...layer, visible: false } : layer)), canvas, canvas);
    assert.deepEqual(readPixel(hiddenGuide, canvas, 1, 1), { r: 0, g: 0, b: 0, a: 0 });
  });

  it("paints a guide without touching pixels outside the brush, then erases it", () => {
    const plane = { x: 0, y: 0, width: 4, height: 4, pixels: createPixels(4) };
    writePixel(plane.pixels, 4, 0, 0, { r: 1, g: 2, b: 3, a: 0 });
    const drawn = stampGuideBrush(plane, 2, 2, { r: 4, g: 5, b: 6, a: 255 }, 1, 4, 4);
    assert.deepEqual(readPixel(drawn.pixels, 4, 2, 2), { r: 4, g: 5, b: 6, a: 255 });
    assert.deepEqual(readPixel(drawn.pixels, 4, 1, 2), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(drawn.pixels, 4, 0, 0), { r: 1, g: 2, b: 3, a: 0 });
    assert.equal(drawn.pixels, plane.pixels);
    const thick = stampGuideBrush(plane, 1, 1, { r: 8, g: 0, b: 0, a: 255 }, 3, 4, 4);
    assert.deepEqual(readPixel(thick.pixels, 4, 0, 0), { r: 8, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(thick.pixels, 4, 2, 2), { r: 8, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(thick.pixels, 4, 3, 3), { r: 0, g: 0, b: 0, a: 0 });
    const erased = stampGuideBrush(thick, 1, 1, { r: 0, g: 0, b: 0, a: 0 }, 1, 4, 4);
    assert.deepEqual(readPixel(erased.pixels, 4, 1, 1), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(erased.pixels, 4, 0, 0), { r: 8, g: 0, b: 0, a: 255 });
  });

  it("moves a masked selection inside the image and slides the whole plane when the canvas is selected", () => {
    const canvas = 4;
    const pixels = createPixels(3, 3);
    writePixel(pixels, 3, 0, 0, { r: 9, g: 1, b: 1, a: 0 });
    writePixel(pixels, 3, 1, 0, { r: 2, g: 3, b: 4, a: 255 });
    writePixel(pixels, 3, 2, 2, { r: 5, g: 0, b: 0, a: 255 });
    const plane = { x: 1, y: 0, width: 3, height: 3, pixels };
    const off = readPixel(projectImagePlane(plane, canvas, canvas), canvas, 0, 0);
    assert.deepEqual(off, { r: 0, g: 0, b: 0, a: 0 });
    const mask = new Uint8Array(canvas * canvas);
    mask[0 * canvas + 1] = 1;
    mask[0 * canvas + 2] = 1;
    const moved = moveImageSelection(plane, { kind: "lasso", mask, bounds: { x: 1, y: 0, w: 2, h: 1 } }, 0, 1, canvas, canvas);
    const view = projectImagePlane(moved.plane, canvas, canvas);
    assert.deepEqual(readPixel(view, canvas, 1, 0), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(view, canvas, 1, 1), { r: 9, g: 1, b: 1, a: 0 });
    assert.deepEqual(readPixel(view, canvas, 2, 1), { r: 2, g: 3, b: 4, a: 255 });
    assert.deepEqual(readPixel(view, canvas, 3, 2), { r: 5, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(pixels, 3, 2, 2), { r: 5, g: 0, b: 0, a: 255 });
    const full = moveImageSelection(plane, { kind: "rect", rect: { x: 0, y: 0, w: canvas, h: canvas } }, 2, -1, canvas, canvas);
    assert.equal(selectionCoversCanvas(full.selection, canvas, canvas), true);
    assert.equal(full.plane.x, 3);
    assert.equal(full.plane.y, -1);
    assert.equal(full.plane.pixels, pixels);
  });

  it("reads back the clear pixel RGB written into a png", async () => {
    const canvas = createPixels(2, 1);
    canvas[0] = 9;
    canvas[1] = 8;
    canvas[2] = 7;
    canvas[3] = 0;
    writePixel(canvas, { width: 2, height: 1 }, 1, 0, { r: 4, g: 5, b: 6, a: 128 });
    const png = await encodeRgbaPng(canvas, 2, 1);
    assert.ok(png);
    const decoded = await decodeRgbaPng(png);
    assert.ok(decoded);
    assert.equal(decoded.width, 2);
    assert.deepEqual([...decoded.rgba.subarray(0, 4)], [9, 8, 7, 0]);
    assert.deepEqual([...decoded.rgba.subarray(4, 8)], [4, 5, 6, 128]);
  });
});

describe("pixel layer move", () => {
  it("slides every pixel by whole cells, including clear RGB, and keeps the source", () => {
    const canvas = createPixels(4);
    writePixel(canvas, 4, 0, 0, { r: 1, g: 2, b: 3, a: 255 });
    writePixel(canvas, 4, 1, 1, { r: 9, g: 8, b: 7, a: 0 });
    const other = new Uint8ClampedArray(canvas);
    const snapshot = new Uint8ClampedArray(canvas);
    const moved = shiftContentPlane(pixelLayerPlane(canvas, 4, 4, null), 1, 0, 4, 4);
    assert.deepEqual(canvas, snapshot);
    assert.deepEqual(other, snapshot);
    assert.deepEqual(readPixel(moved.pixels, 4, 0, 0), { r: 0, g: 0, b: 0, a: 0 });
    assert.deepEqual(readPixel(moved.pixels, 4, 1, 0), { r: 1, g: 2, b: 3, a: 255 });
    assert.deepEqual(readPixel(moved.pixels, 4, 2, 1), { r: 9, g: 8, b: 7, a: 0 });
    assert.ok(moved.rest);
    assert.equal(moved.rest.x, 1);
    assert.equal(moved.rest.y, 0);
    assert.deepEqual(readPixel(moved.rest.pixels, 4, 1, 1), { r: 9, g: 8, b: 7, a: 0 });
    const back = shiftContentPlane(pixelLayerPlane(moved.pixels, 4, 4, moved.rest), -1, 0, 4, 4);
    assert.equal(back.rest, null);
    assert.deepEqual(back.pixels, snapshot);
  });

  it("keeps a dot that left the canvas and a new dot drawn after the move", () => {
    const canvas = createPixels(4);
    writePixel(canvas, 4, 1, 1, { r: 1, g: 2, b: 3, a: 255 });
    const moved = shiftContentPlane(pixelLayerPlane(canvas, 4, 4, null), 4, 0, 4, 4);
    assert.ok(moved.rest);
    assert.deepEqual(readPixel(moved.pixels, 4, 1, 1), { r: 0, g: 0, b: 0, a: 0 });
    const edited = new Uint8ClampedArray(moved.pixels);
    writePixel(edited, 4, 0, 0, { r: 8, g: 0, b: 0, a: 255 });
    const back = shiftContentPlane(pixelLayerPlane(edited, 4, 4, moved.rest), -4, 0, 4, 4);
    assert.deepEqual(readPixel(back.pixels, 4, 1, 1), { r: 1, g: 2, b: 3, a: 255 });
    assert.ok(back.rest);
    assert.equal(back.rest.x, -4);
    assert.deepEqual(readPixel(back.rest.pixels, { width: back.rest.width, height: back.rest.height }, 0, 0), { r: 8, g: 0, b: 0, a: 255 });
    assert.deepEqual(readPixel(moved.rest.pixels, 4, 1, 1), { r: 1, g: 2, b: 3, a: 255 });
  });

  it("brings an off-canvas dot back when the canvas grows and does not resample it", () => {
    const canvas = createPixels(4);
    writePixel(canvas, 4, 1, 1, { r: 4, g: 5, b: 6, a: 255 });
    const moved = shiftContentPlane(pixelLayerPlane(canvas, 4, 4, null), 4, 0, 4, 4);
    assert.ok(moved.rest);
    const grown = rebasePixelRest(moved.pixels, 4, 4, moved.rest, 8, 4, 0, 0);
    assert.deepEqual(readPixel(grown.pixels, { width: 8, height: 4 }, 5, 1), { r: 4, g: 5, b: 6, a: 255 });
    assert.deepEqual(readPixel(moved.rest.pixels, 4, 1, 1), { r: 4, g: 5, b: 6, a: 255 });
  });
});
