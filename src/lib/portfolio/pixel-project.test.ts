import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { strToU8, zipSync } from "fflate";
import { createPixels, writePixel } from "./pixel-board.ts";
import {
  PIXEL_PROJECT_MAX_BYTES,
  PixelProjectError,
  decodePixelProject,
  encodePixelProject,
  pixelProjectFileName,
  pixelProjectTabName,
  type PixelProject,
} from "./pixel-project.ts";

function project(patch: Partial<PixelProject> = {}): PixelProject {
  const pixels = createPixels(2, 2);
  writePixel(pixels, { width: 2, height: 2 }, 0, 0, { r: 1, g: 2, b: 3, a: 255 });
  writePixel(pixels, { width: 2, height: 2 }, 1, 1, { r: 9, g: 8, b: 7, a: 0 });
  return {
    version: 1,
    name: "キャンバス",
    width: 2,
    height: 2,
    active: 0,
    alphaOn: true,
    alphaUsed: true,
    extracted: false,
    used: [{ r: 1, g: 2, b: 3, a: 255 }],
    color: 12,
    zoom: 4,
    panX: 3,
    panY: -2,
    symmetry: { x0: 0, y0: 0, x1: 1, y1: 0 },
    selection: { kind: "rect", rect: { x: 0, y: 0, w: 2, h: 1 } },
    originName: "character.png",
    originId: "img-1",
    layers: [
      {
        name: "レイヤー1",
        visible: true,
        opacity: 80,
        kind: "pixel",
        x: 0,
        y: 0,
        width: 2,
        height: 2,
        pixels,
        rest: null,
      },
    ],
    ...patch,
  };
}

describe("pixel project file", () => {
  it("round-trips layers, clear-pixel RGB, and tab state without touching the source", async () => {
    const doc = project();
    const source = doc.layers[0]!.pixels;
    const before = new Uint8ClampedArray(source);
    const bytes = await encodePixelProject(doc);
    source[0] = 99;
    assert.equal(bytes[0], 0x50);
    assert.equal(bytes[1], 0x4b);
    const frozen = new Uint8Array(bytes);
    const back = await decodePixelProject(bytes);
    assert.deepEqual(bytes, frozen);
    assert.equal(source[0], 99);
    assert.deepEqual(before.subarray(0, 4), new Uint8ClampedArray([1, 2, 3, 255]));
    const pixel = back.layers[0]!;
    assert.equal(pixel.kind, "pixel");
    assert.equal(pixel.opacity, 80);
    assert.deepEqual(Array.from(pixel.pixels.subarray(0, 4)), [1, 2, 3, 255]);
    assert.deepEqual(Array.from(pixel.pixels.subarray(12, 16)), [9, 8, 7, 0]);
    assert.equal(back.width, 2);
    assert.equal(back.active, 0);
    assert.equal(back.color, 12);
    assert.equal(back.zoom, 4);
    assert.equal(back.panX, 3);
    assert.equal(back.panY, -2);
    assert.deepEqual(back.symmetry, { x0: 0, y0: 0, x1: 1, y1: 0 });
    assert.deepEqual(back.selection, { kind: "rect", rect: { x: 0, y: 0, w: 2, h: 1 } });
    assert.equal(back.originName, "character.png");
    assert.equal(back.originId, "img-1");
    assert.deepEqual(back.used, [{ r: 1, g: 2, b: 3, a: 255 }]);
    const again = await decodePixelProject(await encodePixelProject(back));
    assert.deepEqual(Array.from(again.layers[0]!.pixels), Array.from(back.layers[0]!.pixels));
  });

  it("keeps an image layer, its guides, order, and a pixel rest plane", async () => {
    const photo = createPixels(3, 2);
    writePixel(photo, { width: 3, height: 2 }, 0, 0, { r: 20, g: 30, b: 40, a: 255 });
    writePixel(photo, { width: 3, height: 2 }, 2, 1, { r: 4, g: 5, b: 6, a: 0 });
    writePixel(photo, { width: 3, height: 2 }, 1, 0, { r: 255, g: 0, b: 128, a: 255 });
    const canvas = createPixels(2, 2);
    writePixel(canvas, { width: 2, height: 2 }, 0, 0, { r: 7, g: 0, b: 0, a: 255 });
    const restPixels = createPixels(4, 2);
    writePixel(restPixels, { width: 4, height: 2 }, 3, 1, { r: 8, g: 9, b: 10, a: 0 });
    const doc = project({
      active: 0,
      layers: [
        {
          name: "下絵",
          visible: false,
          opacity: 40,
          kind: "image",
          x: 5,
          y: -2,
          width: 3,
          height: 2,
          pixels: photo,
          rest: null,
        },
        {
          name: "レイヤー2",
          visible: true,
          opacity: 100,
          kind: "pixel",
          x: 9,
          y: 9,
          width: 2,
          height: 2,
          pixels: canvas,
          rest: { x: -1, y: 2, width: 4, height: 2, pixels: restPixels },
        },
      ],
    });
    const back = await decodePixelProject(await encodePixelProject(doc));
    assert.equal(back.layers.length, 2);
    const image = back.layers[0]!;
    assert.equal(image.kind, "image");
    assert.equal(image.visible, false);
    assert.equal(image.opacity, 40);
    assert.equal(image.x, 5);
    assert.equal(image.y, -2);
    assert.equal(image.rest, null);
    assert.deepEqual(Array.from(image.pixels.subarray(0, 4)), [20, 30, 40, 255]);
    assert.deepEqual(Array.from(image.pixels.subarray(4, 8)), [255, 0, 128, 255]);
    assert.deepEqual(Array.from(image.pixels.subarray(20, 24)), [4, 5, 6, 0]);
    const pixel = back.layers[1]!;
    assert.equal(pixel.kind, "pixel");
    assert.equal(pixel.x, 0);
    assert.equal(pixel.y, 0);
    assert.deepEqual(Array.from(pixel.pixels.subarray(0, 4)), [7, 0, 0, 255]);
    assert.equal(pixel.rest?.x, -1);
    assert.equal(pixel.rest?.y, 2);
    assert.deepEqual(Array.from(pixel.rest!.pixels.subarray(28, 32)), [8, 9, 10, 0]);
    assert.equal(restPixels[28], 8);
  });

  it("round-trips a lasso mask and rejects a mask that does not match", async () => {
    const doc = project({
      selection: { kind: "lasso", mask: new Uint8Array([0, 1, 1, 0]), bounds: { x: 0, y: 0, w: 2, h: 2 } },
    });
    const back = await decodePixelProject(await encodePixelProject(doc));
    assert.equal(back.selection?.kind, "lasso");
    if (back.selection?.kind !== "lasso") return;
    assert.deepEqual(Array.from(back.selection.mask), [0, 1, 1, 0]);
    assert.deepEqual(back.selection.bounds, { x: 0, y: 0, w: 2, h: 2 });

    const broken = await encodePixelProject(project());
    const files = zipSync({ "manifest.json": strToU8("{"), "layers/0.png": new Uint8Array([1]) });
    await assert.rejects(() => decodePixelProject(files), (error: unknown) => error instanceof PixelProjectError && error.message === "プロジェクトの内容が壊れています");
    assert.ok(broken.length > 4);
  });

  it("rejects a newer version, a non-project, a size mismatch, and a huge file", async () => {
    const newer = zipSync({
      "manifest.json": strToU8(JSON.stringify({ format: "pdxpixel", version: 2, canvas: { width: 1, height: 1 }, layers: [] })),
    });
    await assert.rejects(() => decodePixelProject(newer), (error: unknown) => error instanceof PixelProjectError && error.message === "このプロジェクトは新しい形式です");

    const other = zipSync({
      "manifest.json": strToU8(JSON.stringify({ format: "png", version: 1 })),
    });
    await assert.rejects(() => decodePixelProject(other), (error: unknown) => error instanceof PixelProjectError && error.message === "このファイルはプロジェクト形式ではありません");
    await assert.rejects(() => decodePixelProject(new Uint8Array([1, 2, 3, 4])), (error: unknown) => error instanceof PixelProjectError && error.message === "このファイルはプロジェクト形式ではありません");

    const good = await encodePixelProject(project());
    const unpacked = zipSync({
      "manifest.json": strToU8(
        JSON.stringify({
          format: "pdxpixel",
          version: 1,
          canvas: { width: 2, height: 2 },
          layers: [{ name: "レイヤー1", visible: true, opacity: 100, kind: "pixel", width: 2, height: 2, png: "layers/0.png", rest: null }],
        }),
      ),
      "layers/0.png": good.subarray(0, 8),
    });
    await assert.rejects(() => decodePixelProject(unpacked), (error: unknown) => error instanceof PixelProjectError && error.message === "プロジェクトの内容が壊れています");

    const huge = new Uint8Array(PIXEL_PROJECT_MAX_BYTES + 1);
    huge[0] = 0x50;
    huge[1] = 0x4b;
    await assert.rejects(() => decodePixelProject(huge), (error: unknown) => error instanceof PixelProjectError && error.message === "ファイルが大きすぎます");
  });

  it("names the file from the tab or the source image, and the tab from the file", () => {
    assert.equal(pixelProjectFileName("character.png"), "character.pdxpixel");
    assert.equal(pixelProjectFileName("folder/キャラ（1）.pdxpixel"), "キャラ（1）.pdxpixel");
    assert.equal(pixelProjectFileName("bad:name?.png"), "badname.pdxpixel");
    assert.equal(pixelProjectTabName("character.pdxpixel", []), "character");
    assert.equal(pixelProjectTabName("character.pdxpixel", ["character"]), "character（1）");
  });
});
