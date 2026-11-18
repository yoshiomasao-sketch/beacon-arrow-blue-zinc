import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOT_COLOR_DEFAULT, DOT_COLOR_MAX, DOT_COLOR_MIN, DOT_COLOR_STEP, DOT_DEFAULT, DOT_MAX, DOT_MIN, DOT_STEP, activeDot, averageCells, cellSpan, dotColorIndex, dotColorStops, dotGrid, dotView, limitCellColors, quantizePixels, snapDotCols, snapDotColors } from "./dot-filter.ts";

function pixel(width: number, x: number, y: number, rgba: [number, number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * 2 * 4);
  const at = (y * width + x) * 4;
  data[at] = rgba[0];
  data[at + 1] = rgba[1];
  data[at + 2] = rgba[2];
  data[at + 3] = rgba[3];
  return data;
}

describe("dot filter", () => {
  it("snaps the column count and keeps the picture aspect", () => {
    assert.equal(DOT_MIN, 16);
    assert.equal(DOT_MAX, 256);
    assert.equal(DOT_STEP, 16);
    assert.equal(DOT_DEFAULT, 256);
    const cols = [];
    for (let value = DOT_MIN; value <= DOT_MAX; value += DOT_STEP) cols.push(value);
    assert.deepEqual(cols, [16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256]);
    for (const value of cols) assert.equal(snapDotCols(value), value);
    assert.equal(snapDotCols(64), 64);
    assert.equal(snapDotCols(8), 16);
    assert.equal(snapDotCols(24), 32);
    assert.equal(snapDotCols(12), 16);
    assert.equal(snapDotCols(1), 16);
    assert.equal(snapDotCols(999), 256);
    assert.equal(snapDotCols(Number.NaN), 256);
    const wide = dotGrid(100, 50, 64);
    assert.equal(wide.cols, 64);
    assert.equal(wide.rows, 32);
    assert.equal(100 / wide.cols, 50 / wide.rows);
    const awkward = dotGrid(100, 40, 16);
    assert.equal(awkward.cols, 16);
    assert.equal(awkward.rows, 6);
    assert.equal(dotGrid(10, 10, 256).cols, 10);
  });

  it("uses the same cell edges for every frame of one picture", () => {
    const first = Array.from({ length: 8 }, (_, index) => cellSpan(index, 8, 64));
    const second = Array.from({ length: 8 }, (_, index) => cellSpan(index, 8, 64));
    assert.deepEqual(first, second);
    assert.equal(first[0]?.[0], 0);
    assert.equal(first[7]?.[1], 64);
    assert.deepEqual(dotGrid(720, 480, 64), dotGrid(720, 480, 64));
  });

  it("averages opaque cells and ignores the color stored in clear pixels", () => {
    const split = new Uint8ClampedArray([
      200, 0, 0, 255, 0, 0, 200, 255,
    ]);
    const halves = averageCells(split, 2, 1, 16);
    assert.equal(halves.cols, 2);
    assert.equal(halves.rows, 1);
    assert.equal(halves.rgba[0], 200);
    assert.equal(halves.rgba[2], 0);
    assert.equal(halves.rgba[4], 0);
    assert.equal(halves.rgba[6], 200);
    assert.equal(halves.rgba[3], 255);
    assert.equal(halves.rgba[7], 255);

    const width = 32;
    const fringe = new Uint8ClampedArray(width * 4);
    fringe[0] = 255;
    fringe[3] = 255;
    fringe[4] = 0;
    fringe[5] = 255;
    fringe[7] = 0;
    const mixed = averageCells(fringe, width, 1, 16);
    assert.equal(mixed.cols, 16);
    assert.equal(mixed.rgba[0], 255);
    assert.equal(mixed.rgba[1], 0);
    assert.equal(mixed.rgba[2], 0);
    assert.equal(mixed.rgba[3], 128);

    const clear = pixel(2, 0, 0, [0, 255, 0, 0]);
    const blank = averageCells(clear, 2, 1, 16);
    assert.equal(blank.rgba[3], 0);
  });

  it("caps opaque colors and leaves clear cells out of the palette", () => {
    assert.equal(DOT_COLOR_MIN, 16);
    assert.equal(DOT_COLOR_MAX, 512);
    assert.equal(DOT_COLOR_STEP, 8);
    assert.equal(DOT_COLOR_DEFAULT, 512);
    const lows = [2, 4, 8, 12, 16, 24, 32, 40, 48, 56];
    const highs = [64, 128, 256, 512];
    const stops = dotColorStops();
    assert.deepEqual(stops, [...lows, ...highs]);
    for (let index = 1; index < stops.length; index += 1) {
      assert.equal(dotColorIndex(stops[index] ?? 0) - dotColorIndex(stops[index - 1] ?? 0), 1);
    }
    for (const value of lows) assert.equal(snapDotColors(value), value);
    for (const value of highs) assert.equal(snapDotColors(value), value);
    assert.equal(snapDotColors(72), 64);
    assert.equal(snapDotColors(96), 128);
    assert.equal(snapDotColors(300), 256);
    assert.equal(snapDotColors(400), 512);
    assert.equal(snapDotColors(256), 256);
    assert.equal(snapDotColors(512), 512);
    assert.equal(snapDotColors(16), 16);
    assert.equal(snapDotColors(12), 12);
    assert.equal(snapDotColors(8), 8);
    assert.equal(snapDotColors(4), 4);
    assert.equal(snapDotColors(2), 2);
    assert.equal(snapDotColors(11), 12);
    assert.equal(snapDotColors(1), 2);
    assert.equal(snapDotColors(3), 4);
    assert.equal(snapDotColors(20), 24);
    assert.equal(snapDotColors(24), 24);
    assert.equal(snapDotColors(32), 32);
    assert.equal(snapDotColors(40), 40);
    assert.equal(snapDotColors(48), 48);
    assert.equal(snapDotColors(56), 56);
    assert.equal(snapDotColors(60), 64);
    assert.equal(snapDotColors(520), 512);
    assert.equal(snapDotColors(999), 512);
    assert.equal(snapDotColors(Number.NaN), 512);
    assert.deepEqual(dotView(undefined), { show: false, mosaic: true, colorOn: true, cols: 256, colors: 512 });
    assert.deepEqual(dotView({ on: false, colorOn: false, cols: 64, colors: 256 }), {
      show: false,
      mosaic: false,
      colorOn: false,
      cols: 64,
      colors: 256,
    });
    assert.deepEqual(dotView({ on: true, cols: 80, colors: 32, colorOn: false }), {
      show: true,
      mosaic: true,
      colorOn: false,
      cols: 80,
      colors: 32,
    });
    assert.deepEqual(activeDot(undefined), { cols: null, colors: null });
    assert.deepEqual(activeDot({ on: true }), { cols: 256, colors: 512 });
    assert.deepEqual(activeDot({ colorOn: true }), { cols: 256, colors: 512 });
    assert.deepEqual(activeDot({ on: true, cols: 64, colors: 256, colorOn: false }), { cols: 64, colors: null });
    assert.deepEqual(activeDot({ on: true, cols: 40, colors: 40 }), { cols: 48, colors: 40 });
    assert.deepEqual(activeDot({ on: false, cols: 80, colors: 128, colorOn: true }), { cols: null, colors: 128 });
    assert.deepEqual(activeDot({ on: false, cols: 40, colors: 80, colorOn: true }), { cols: null, colors: 64 });
    assert.deepEqual(activeDot({ on: true, cols: 40, colors: 40, colorOn: true }), { cols: 48, colors: 40 });
    assert.deepEqual(activeDot({ show: false, on: true, colorOn: true, cols: 64, colors: 128 }), { cols: null, colors: null });
    assert.deepEqual(activeDot({ show: true, on: true, colorOn: false, cols: 64, colors: 128 }), { cols: 64, colors: null });
    assert.deepEqual(activeDot({ show: true, on: false, colorOn: true, cols: 32, colors: 80 }), { cols: null, colors: 64 });
    assert.deepEqual(activeDot({ show: true, on: false, colorOn: false, cols: 64, colors: 256 }), { cols: null, colors: null });
    assert.deepEqual(activeDot({ show: false, on: false, colorOn: false }), { cols: null, colors: null });

    const data = new Uint8ClampedArray(4 * 4);
    const paint = (index: number, rgba: [number, number, number, number]) => {
      data[index * 4] = rgba[0];
      data[index * 4 + 1] = rgba[1];
      data[index * 4 + 2] = rgba[2];
      data[index * 4 + 3] = rgba[3];
    };
    paint(0, [255, 0, 0, 255]);
    paint(1, [255, 0, 0, 255]);
    paint(2, [0, 0, 255, 255]);
    paint(3, [0, 255, 0, 0]);
    const field = averageCells(data, 4, 1, 8);
    assert.equal(field.cols, 4);
    limitCellColors(field, 2);
    const opaque = new Set<string>();
    for (let index = 0; index < 4; index += 1) {
      const slot = index * 4;
      if ((field.rgba[slot + 3] ?? 0) <= 0) continue;
      opaque.add(`${field.rgba[slot]},${field.rgba[slot + 1]},${field.rgba[slot + 2]}`);
    }
    assert.ok(opaque.size <= 2);
    assert.equal(field.rgba[0], field.rgba[4]);
    assert.equal(field.rgba[1], field.rgba[5]);
    assert.equal(field.rgba[2], field.rgba[6]);
    assert.equal(field.rgba[15], 0);

    const kept = averageCells(data, 4, 1, 8);
    limitCellColors(kept, 256);
    assert.equal(kept.rgba[0], 255);
    assert.equal(kept.rgba[8], 0);
    assert.equal(kept.rgba[10], 255);
    assert.equal(kept.rgba[15], 0);

    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 0, 255, 255,
      0, 255, 0, 0,
    ]);
    quantizePixels(pixels, 3, 1, 1);
    assert.equal(pixels.length, 12);
    assert.equal(pixels[11], 0);
    assert.equal(pixels[0], pixels[4]);
    assert.equal(pixels[1], pixels[5]);
    assert.equal(pixels[2], pixels[6]);
  });

  it("inks only a near-black slot when the palette has 8 colors or fewer", () => {
    const fill = (width: number, height: number, paint: (x: number, y: number) => [number, number, number, number]) => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const [r, g, b, a] = paint(x, y);
          const index = (y * width + x) * 4;
          data[index] = r;
          data[index + 1] = g;
          data[index + 2] = b;
          data[index + 3] = a;
        }
      }
      return data;
    };
    const colorsOf = (data: Uint8ClampedArray) => {
      const found = new Set<string>();
      for (let index = 0; index < data.length; index += 4) {
        if ((data[index + 3] ?? 0) <= 0) continue;
        found.add(`${data[index]},${data[index + 1]},${data[index + 2]}`);
      }
      return found;
    };
    const outline = fill(8, 8, (x, y) => (x === 0 || y === 0 || x === 7 || y === 7 ? [16, 14, 12, 255] : [240, 220, 200, 255]));
    const outlined = { cols: 8, rows: 8, rgba: outline.slice() };
    limitCellColors(outlined, 8);
    assert.equal(outlined.rgba[3], 255);
    assert.equal(outlined.rgba[0], 0);
    assert.equal(outlined.rgba[1], 0);
    assert.equal(outlined.rgba[2], 0);
    assert.equal(outlined.rgba[(3 * 8 + 3) * 4], 240);
    assert.ok(colorsOf(outlined.rgba).size <= 8);

    const vivid = fill(4, 4, (x, y) => {
      const swatch: [number, number, number][] = [
        [220, 30, 40],
        [240, 220, 20],
        [20, 200, 220],
        [220, 40, 200],
      ];
      const color = swatch[(y * 4 + x) % 4] ?? [220, 30, 40];
      return [color[0], color[1], color[2], 255];
    });
    const vividField = { cols: 4, rows: 4, rgba: vivid.slice() };
    limitCellColors(vividField, 4);
    assert.equal(colorsOf(vividField.rgba).has("0,0,0"), false);

    const blue = fill(8, 8, (x) => (x < 6 ? [0, 0, 90, 255] : [250, 250, 250, 255]));
    const blueField = { cols: 8, rows: 8, rgba: blue.slice() };
    limitCellColors(blueField, 4);
    assert.equal(colorsOf(blueField.rgba).has("0,0,0"), false);
    assert.equal(blueField.rgba[2], 90);

    const open = fill(8, 8, (x, y) => (x === 0 || y === 0 || x === 7 || y === 7 ? [16, 14, 12, 255] : [240, 220, 200, 255]));
    const wide = { cols: 8, rows: 8, rgba: open.slice() };
    limitCellColors(wide, 16);
    assert.equal(wide.rgba[0], 16);
    assert.equal(wide.rgba[1], 14);
    assert.equal(wide.rgba[2], 12);

    const clear = fill(4, 2, (x, y) => (y === 0 ? [16, 14, 12, x === 0 ? 0 : 255] : [240, 220, 200, 255]));
    const clearField = { cols: 4, rows: 2, rgba: clear.slice() };
    const before = [clearField.rgba[0], clearField.rgba[1], clearField.rgba[2], clearField.rgba[3]];
    limitCellColors(clearField, 4);
    assert.deepEqual([clearField.rgba[0], clearField.rgba[1], clearField.rgba[2], clearField.rgba[3]], before);
    assert.equal(clearField.rgba[4], 0);
    assert.equal(clearField.rgba[5], 0);
    assert.equal(clearField.rgba[6], 0);
  });
});
