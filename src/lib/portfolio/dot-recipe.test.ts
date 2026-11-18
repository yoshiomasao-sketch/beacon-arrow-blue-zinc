import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { averageCells } from "./dot-filter.ts";
import { dotLevelIndex, dotRecipe, emptyDotRecipe, gamePresetById, gamePresetPatch, markerAt, matchingGamePreset, mergeDot, recipeIsPlain, recipeKey, renderDotImage, sameDot, snapDotLevels } from "./dot-recipe.ts";

describe("dot recipe", () => {
  it("keeps a legacy mosaic when the recipe is plain", () => {
    const pixels = new Uint8ClampedArray([
      200, 0, 0, 255, 0, 0, 0, 0,
      0, 0, 200, 255, 10, 20, 30, 0,
    ]);
    const recipe = emptyDotRecipe();
    recipe.blackLine = 0;
    assert.equal(recipeIsPlain(recipe), true);
    const out = renderDotImage(pixels, 2, 2, 16, null, recipe);
    const legacy = averageCells(pixels, 2, 2, 16);
    assert.equal(out.width, legacy.cols);
    assert.equal(out.height, legacy.rows);
    assert.deepEqual(out.rgba, legacy.rgba);
    assert.equal(out.rgba[0], 200);
    assert.equal(out.rgba[3], 255);
    assert.equal(out.rgba[7], 0);
  });

  it("does not let a clear pixel tint the average", () => {
    const pixels = new Uint8ClampedArray(8 * 4);
    pixels[0] = 0;
    pixels[1] = 255;
    pixels[2] = 0;
    pixels[3] = 0;
    const out = renderDotImage(pixels, 8, 1, 16, null, emptyDotRecipe());
    assert.equal(out.rgba[3], 0);
    assert.equal(out.rgba[0], 0);
  });

  it("caps the whole picture at the requested color count", () => {
    const pixels = new Uint8ClampedArray(4 * 4);
    const paint = (index: number, rgba: [number, number, number, number]) => {
      pixels[index * 4] = rgba[0];
      pixels[index * 4 + 1] = rgba[1];
      pixels[index * 4 + 2] = rgba[2];
      pixels[index * 4 + 3] = rgba[3];
    };
    paint(0, [255, 0, 0, 255]);
    paint(1, [0, 255, 0, 255]);
    paint(2, [0, 0, 255, 255]);
    paint(3, [255, 255, 0, 0]);
    const recipe = emptyDotRecipe();
    recipe.dither = "floyd";
    recipe.ditherStrength = 100;
    const out = renderDotImage(pixels, 4, 1, 16, 2, recipe);
    const colors = new Set<string>();
    for (let index = 0; index < out.rgba.length; index += 4) {
      if ((out.rgba[index + 3] ?? 0) <= 0) {
        assert.equal(out.rgba[index], 0);
        continue;
      }
      colors.add(`${out.rgba[index]},${out.rgba[index + 1]},${out.rgba[index + 2]}`);
    }
    assert.ok(colors.size <= 2);
    assert.equal(out.rgba[15], 0);
  });

  it("draws an outline only beside opaque pixels", () => {
    const pixels = new Uint8ClampedArray(5 * 5 * 4);
    const at = 2 * 5 + 2;
    pixels[at * 4] = 255;
    pixels[at * 4 + 3] = 255;
    const recipe = emptyDotRecipe();
    recipe.blackLine = 0;
    recipe.outline = true;
    recipe.outlineWidth = 1;
    const out = renderDotImage(pixels, 5, 5, null, null, recipe);
    const center = out.rgba[at * 4];
    assert.equal(center, 255);
    assert.equal(out.rgba[at * 4 + 3], 255);
    const neighbor = (1 * 5 + 2) * 4;
    assert.equal(out.rgba[neighbor + 3], 255);
    assert.equal(out.rgba[neighbor], 0);
    assert.equal(out.rgba[3], 0);
  });

  it("grayscales without touching alpha", () => {
    const pixels = new Uint8ClampedArray([20, 80, 200, 128]);
    const recipe = emptyDotRecipe();
    recipe.gray = true;
    const out = renderDotImage(pixels, 1, 1, null, null, recipe);
    assert.equal(out.rgba[0], out.rgba[1]);
    assert.equal(out.rgba[1], out.rgba[2]);
    assert.equal(out.rgba[3], 128);
  });

  it("uses grayscale as a palette and does not stack it on green", () => {
    const pixels = new Uint8ClampedArray([20, 80, 200, 128]);
    const legacy = emptyDotRecipe();
    legacy.gray = true;
    const palette = emptyDotRecipe();
    palette.palette = "gray";
    const grayed = renderDotImage(pixels, 1, 1, null, null, legacy);
    const fromPalette = renderDotImage(pixels, 1, 1, null, null, palette);
    assert.deepEqual([...fromPalette.rgba], [...grayed.rgba]);
    const both = emptyDotRecipe();
    both.gray = true;
    both.palette = "gray";
    assert.deepEqual([...renderDotImage(pixels, 1, 1, null, null, both).rgba], [...grayed.rgba]);
    const green = emptyDotRecipe();
    green.gray = true;
    green.palette = "green";
    const tinted = renderDotImage(pixels, 1, 1, null, null, green);
    assert.notEqual(tinted.rgba[0], tinted.rgba[1]);
    assert.equal(tinted.rgba[3], 128);
    const saved = mergeDot({ on: true, cols: 32, colors: 8, gray: true, brightness: 12 }, { palette: "sepia", gray: false });
    assert.equal(saved.palette, "sepia");
    assert.equal(saved.gray, undefined);
    assert.equal(saved.brightness, 12);
    assert.equal(saved.colors, 8);
  });

  it("lets the higher priority marker win an overlap", () => {
    const pixels = new Uint8ClampedArray(4 * 4);
    pixels[0] = 255;
    pixels[1] = 255;
    pixels[2] = 255;
    pixels[3] = 255;
    const low = markerAt(0, 0, 1, 1, [
      { id: "a", name: "a", u: 0.5, v: 0.5, r: 0.48, priority: 1, crisp: 0, density: -100, contrast: 0, line: 0, bias: "center" },
      { id: "b", name: "b", u: 0.5, v: 0.5, r: 0.48, priority: 5, crisp: 0, density: 0, contrast: 0, line: 0, bias: "center" },
    ]);
    assert.equal(low.marker?.id, "b");
    const recipe = emptyDotRecipe();
    recipe.markers = [
      { id: "a", name: "a", u: 0.5, v: 0.5, r: 0.48, priority: 1, crisp: 0, density: -100, contrast: 0, line: 0, bias: "center" },
      { id: "b", name: "b", u: 0.5, v: 0.5, r: 0.48, priority: 5, crisp: 0, density: 0, contrast: 0, line: 0, bias: "center" },
    ];
    const out = renderDotImage(pixels, 1, 1, 16, null, recipe);
    assert.ok((out.rgba[0] ?? 0) > 200);
  });

  it("does not let a circle change a mosaic cell that sticks out of it", () => {
    const pixels = new Uint8ClampedArray(32 * 32 * 4);
    pixels.fill(255);
    const recipe = emptyDotRecipe();
    recipe.markers = [{ id: "m", name: "m", u: 0, v: 0, r: 1 / 32, priority: 1, crisp: 0, density: -100, contrast: 0, line: 0, bias: "center" }];
    const out = renderDotImage(pixels, 32, 32, 16, null, recipe);
    assert.equal(out.width, 16);
    assert.equal(out.rgba[0], 255);
    assert.equal(out.rgba[4], 255);
  });

  it("applies a circle only to mosaic cells that sit completely inside it", () => {
    const pixels = new Uint8ClampedArray(32 * 32 * 4);
    pixels.fill(255);
    const recipe = emptyDotRecipe();
    recipe.markers = [{ id: "m", name: "m", u: 0, v: 0, r: 3 / 32, priority: 1, crisp: 0, density: -100, contrast: 0, line: 0, bias: "center" }];
    const out = renderDotImage(pixels, 32, 32, 16, null, recipe);
    assert.ok((out.rgba[0] ?? 255) < 200);
    assert.equal(out.rgba[4], 255);
    assert.equal(out.rgba[8 * 4], 255);
  });

  it("keeps a half-clear pixel through dither", () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 128, 200, 10, 10, 255]);
    const recipe = emptyDotRecipe();
    recipe.blackLine = 0;
    recipe.dither = "floyd";
    recipe.ditherStrength = 80;
    const out = renderDotImage(pixels, 2, 1, null, 2, recipe);
    assert.equal(out.rgba[3], 128);
    assert.equal(out.rgba[7], 255);
    assert.ok((out.rgba[0] ?? 0) + (out.rgba[1] ?? 0) + (out.rgba[2] ?? 0) > 0);
  });

  it("round-trips extra settings without dropping a later column change", () => {
    const saved = mergeDot(undefined, {
      on: true,
      show: true,
      cols: 64,
      colors: 8,
      gray: true,
      markers: [{ id: "m", name: "目", u: 0.4, v: 0.4, r: 0.1, priority: 1, crisp: 20, density: 0, contrast: 0, line: 10, bias: "br" }],
    });
    const next = mergeDot(saved, { cols: 32 });
    assert.equal(next.cols, 32);
    assert.equal(next.colors, 8);
    assert.equal(next.gray, true);
    assert.equal(next.markers?.[0]?.name, "目");
    assert.equal(sameDot(saved, mergeDot(saved, {})), true);
    assert.equal(recipeIsPlain(dotRecipe({ on: true, cols: 16 })), false);
    assert.equal(dotRecipe({ on: true, cols: 16 }).blackLine, 100);
    assert.equal(recipeIsPlain(dotRecipe({ on: true, cols: 16, blackLine: 0 })), true);
    assert.equal(emptyDotRecipe().blackLine, 100);
    assert.equal(mergeDot(undefined, { on: true }).blackLine, undefined);
    assert.equal(mergeDot(undefined, { blackLine: 0 }).blackLine, 0);
    const ink = new Uint8ClampedArray([40, 40, 40, 255, 200, 200, 200, 255]);
    const inked = renderDotImage(ink, 2, 1, null, null, emptyDotRecipe());
    assert.equal(inked.rgba[0], 15);
    assert.equal(inked.rgba[4], 200);
  });

  it("skips a slider that is off and keeps the number", () => {
    const pixels = new Uint8ClampedArray([40, 50, 60, 255]);
    const plain = emptyDotRecipe();
    plain.blackLine = 0;
    const plainOut = renderDotImage(pixels, 1, 1, null, null, plain);
    const bright = emptyDotRecipe();
    bright.brightness = 80;
    const lit = renderDotImage(pixels, 1, 1, null, null, bright);
    assert.notEqual(lit.rgba[0], plainOut.rgba[0]);
    const off = emptyDotRecipe();
    off.brightness = 80;
    off.contrast = 40;
    off.brightnessOn = false;
    const contrastOnly = emptyDotRecipe();
    contrastOnly.contrast = 40;
    assert.deepEqual(renderDotImage(pixels, 1, 1, null, null, off).rgba, renderDotImage(pixels, 1, 1, null, null, contrastOnly).rgba);
    assert.equal(off.brightness, 80);
    assert.equal(off.contrast, 40);
    const bothOff = emptyDotRecipe();
    bothOff.brightness = 80;
    bothOff.brightnessOn = false;
    bothOff.contrast = 40;
    bothOff.contrastOn = false;
    bothOff.blackLine = 0;
    assert.equal(recipeIsPlain(bothOff), true);
    assert.deepEqual(renderDotImage(pixels, 1, 1, null, null, bothOff).rgba, plainOut.rgba);
    const saved = mergeDot({ on: true, cols: 32, brightness: 30, contrast: 10 }, { brightnessOn: false });
    assert.equal(saved.brightness, 30);
    assert.equal(saved.contrast, 10);
    assert.equal(saved.brightnessOn, false);
    assert.equal(saved.contrastOn, undefined);
    const again = mergeDot(saved, { brightnessOn: true });
    assert.equal(again.brightness, 30);
    assert.equal(again.brightnessOn, undefined);
    assert.equal(dotRecipe({ on: true, cols: 16, brightness: 30 }).brightnessOn, true);
    assert.equal(dotRecipe(saved).brightness, 30);
    assert.equal(dotRecipe(saved).brightnessOn, false);
  });

  it("makes partial alpha opaque and keeps clear pixels clear", () => {
    const pixels = new Uint8ClampedArray([
      10, 20, 30, 255,
      40, 50, 60, 80,
      70, 80, 90, 1,
      0, 255, 0, 0,
    ]);
    const copy = new Uint8ClampedArray(pixels);
    const keep = emptyDotRecipe();
    keep.blackLine = 0;
    const kept = renderDotImage(pixels, 4, 1, null, null, keep);
    assert.equal(kept.width, 4);
    assert.equal(kept.height, 1);
    assert.deepEqual([kept.rgba[3], kept.rgba[7], kept.rgba[11], kept.rgba[15]], [255, 80, 1, 0]);
    const flat = emptyDotRecipe();
    flat.blackLine = 0;
    flat.alphaOn = false;
    const stepped = renderDotImage(pixels, 4, 1, null, null, flat);
    assert.equal(stepped.width, kept.width);
    assert.equal(stepped.height, kept.height);
    assert.equal(stepped.rgba[0], 10);
    assert.equal(stepped.rgba[3], 255);
    assert.equal(stepped.rgba[4], 40);
    assert.equal(stepped.rgba[7], 255);
    assert.equal(stepped.rgba[8], 70);
    assert.equal(stepped.rgba[11], 255);
    assert.equal(stepped.rgba[12], 0);
    assert.equal(stepped.rgba[13], 255);
    assert.equal(stepped.rgba[14], 0);
    assert.equal(stepped.rgba[15], 0);
    const alphas = new Set<number>();
    for (let index = 3; index < stepped.rgba.length; index += 4) alphas.add(stepped.rgba[index] ?? 0);
    assert.deepEqual([...alphas].sort((a, b) => a - b), [0, 255]);
    assert.deepEqual(Array.from(pixels), Array.from(copy));
    const again = renderDotImage(pixels, 4, 1, null, null, keep);
    assert.deepEqual([again.rgba[3], again.rgba[7], again.rgba[11], again.rgba[15]], [255, 80, 1, 0]);
    assert.equal(recipeIsPlain(keep), true);
    assert.equal(recipeIsPlain(flat), false);
    assert.notEqual(recipeKey(keep), recipeKey(flat));
    const saved = mergeDot({ on: true, cols: 32, colors: 8 }, { alphaOn: false });
    assert.equal(saved.alphaOn, false);
    assert.equal(saved.colors, 8);
    assert.equal(dotRecipe(saved).alphaOn, false);
    const restored = mergeDot(saved, { alphaOn: true });
    assert.equal(restored.alphaOn, undefined);
    assert.equal(dotRecipe(restored).alphaOn, true);
    assert.equal(sameDot(saved, mergeDot(saved, {})), true);
  });

  it("applies a game preset without touching the other settings", () => {
    const base = {
      on: false,
      cols: 256,
      colors: 512,
      colorOn: false,
      show: true,
      dither: "floyd" as const,
      ditherStrength: 40,
      brightness: 12,
      contrast: 7,
      alphaOn: true,
      outline: true,
      sampleWeight: 20,
    };
    const gb = mergeDot(base, gamePresetPatch("gb", true));
    assert.equal(gb.cols, 64);
    assert.equal(gb.colors, 4);
    assert.equal(gb.levels, 4);
    assert.equal(gb.levelsOn, true);
    assert.equal(gb.on, true);
    assert.equal(gb.colorOn, true);
    assert.equal(gb.palette, "gray");
    assert.equal(gb.gray, undefined);
    assert.equal(gb.dither, "bayer");
    assert.equal(gb.ditherStrength, 25);
    assert.equal(dotRecipe(gb).bayerSize, 4);
    assert.equal(dotRecipe(gb).ditherStrengthOn, true);
    assert.equal(gb.brightness, 12);
    assert.equal(gb.contrast, 7);
    assert.equal(gb.alphaOn, false);
    assert.equal(gb.outline, true);
    assert.equal(gb.sampleWeight, 20);
    assert.equal(matchingGamePreset({ cols: 64, colors: 4, levels: 4, palette: "gray", gray: false, mosaic: true, colorOn: true, levelsOn: true, alphaOn: false, dither: "bayer", ditherStrength: 25, bayerSize: 4, ditherStrengthOn: true }), "gb");
    assert.equal(matchingGamePreset({ cols: 64, colors: 4, levels: 4, palette: "gray", gray: false, mosaic: true, colorOn: true, levelsOn: true, alphaOn: true, dither: "bayer", ditherStrength: 25, bayerSize: 4, ditherStrengthOn: true }), "");
    assert.equal(matchingGamePreset({ cols: 64, colors: 4, levels: 4, palette: "gray", gray: false, mosaic: true, colorOn: true, levelsOn: true, alphaOn: false, dither: "floyd", ditherStrength: 25, bayerSize: 4, ditherStrengthOn: true }), "");
    const sgb = mergeDot(gb, gamePresetPatch("sgb", true));
    assert.equal(sgb.cols, 64);
    assert.equal(sgb.colors, 4);
    assert.equal(sgb.levels, 4);
    assert.equal(sgb.levelsOn, true);
    assert.equal(sgb.palette, undefined);
    assert.equal(dotRecipe(sgb).palette, "normal");
    assert.equal(sgb.dither, "bayer");
    assert.equal(sgb.ditherStrength, 25);
    assert.equal(dotRecipe(sgb).bayerSize, 4);
    assert.equal(sgb.brightness, 12);
    assert.equal(sgb.alphaOn, false);
    assert.equal(matchingGamePreset({ cols: 64, colors: 4, levels: 4, palette: "normal", gray: false, mosaic: true, colorOn: true, levelsOn: true, alphaOn: false, dither: "bayer", ditherStrength: 25, bayerSize: 4, ditherStrengthOn: true }), "sgb");
    const gbc = mergeDot(sgb, gamePresetPatch("gbc", true));
    assert.equal(gbc.cols, 64);
    assert.equal(gbc.colors, 8);
    assert.equal(gbc.levels, 32);
    assert.equal(gbc.colorOn, true);
    assert.equal(gbc.levelsOn, true);
    assert.equal(gbc.palette, undefined);
    assert.equal(dotRecipe(gbc).palette, "normal");
    assert.equal(gbc.brightness, 12);
    assert.equal(gbc.alphaOn, false);
    assert.equal(gbc.dither, "bayer");
    assert.equal(gbc.ditherStrength, 25);
    assert.equal(dotRecipe(gbc).bayerSize, 8);
    const gba = mergeDot(gbc, gamePresetPatch("gba", true));
    assert.equal(gba.alphaOn, undefined);
    assert.equal(dotRecipe(gba).alphaOn, true);
    assert.equal(dotRecipe(gba).dither, "off");
    assert.equal(gba.cols, 64);
    assert.equal(gba.colors, 16);
    assert.equal(gba.levels, 256);
    assert.equal(gba.colorOn, true);
    assert.equal(gba.levelsOn, true);
    assert.equal(gba.palette, undefined);
    const ds = mergeDot(gba, gamePresetPatch("ds", true));
    assert.equal(ds.cols, 96);
    assert.equal(ds.colors, 256);
    assert.equal(gamePresetById("ds")?.label, "DS(8bit)");
    const ds4 = mergeDot(ds, gamePresetPatch("ds4", true));
    assert.equal(ds4.cols, 96);
    assert.equal(ds4.colors, 16);
    assert.equal(ds4.colorOn, true);
    assert.equal(dotRecipe(ds4).levelsOn, false);
    assert.equal(dotRecipe(ds4).levels, 256);
    assert.equal(dotRecipe(ds4).palette, "normal");
    assert.equal(dotRecipe(ds4).alphaOn, true);
    assert.equal(dotRecipe(ds4).dither, "off");
    assert.equal(ds4.brightness, 12);
    const dsAgain = mergeDot(ds4, gamePresetPatch("ds", true));
    assert.equal(dsAgain.colors, 256);
    assert.equal(dsAgain.cols, 96);
    assert.equal(dotRecipe(dsAgain).dither, "off");
    assert.equal(dotRecipe(dsAgain).alphaOn, true);
    assert.equal(ds.levels, 256);
    assert.equal(ds.colorOn, true);
    assert.equal(ds.levelsOn, undefined);
    assert.equal(dotRecipe(ds).levelsOn, false);
    assert.equal(dotRecipe(ds).alphaOn, true);
    assert.equal(dotRecipe(ds).dither, "off");
    assert.equal(ds.brightness, 12);
    assert.equal(ds.contrast, 7);
    const nudged = mergeDot(ds, { brightness: 30 });
    assert.equal(nudged.cols, 96);
    assert.equal(nudged.colors, 256);
    assert.equal(nudged.levels, 256);
    assert.equal(nudged.colorOn, true);
    assert.equal(dotRecipe(nudged).levelsOn, false);
    assert.equal(nudged.brightness, 30);
    assert.equal(dotRecipe(nudged).dither, "off");
    assert.equal(dotRecipe(nudged).alphaOn, true);
    assert.equal(matchingGamePreset({ cols: 64, colors: 8, levels: 32, palette: "normal", gray: false, mosaic: true, colorOn: true, levelsOn: true, alphaOn: false, dither: "bayer", ditherStrength: 25, bayerSize: 8, ditherStrengthOn: true }), "gbc");
    assert.equal(matchingGamePreset({ cols: 64, colors: 16, levels: 256, palette: "normal", gray: false, mosaic: true, colorOn: true, levelsOn: true, alphaOn: true, dither: "off", ditherStrength: 55, bayerSize: 8, ditherStrengthOn: true }), "gba");
    assert.equal(matchingGamePreset({ cols: 64, colors: 16, levels: 256, palette: "normal", gray: false, mosaic: true, colorOn: true, levelsOn: true, alphaOn: false, dither: "off", ditherStrength: 55, bayerSize: 8, ditherStrengthOn: true }), "");
    const handheld = mergeDot(nudged, gamePresetPatch("3ds", true));
    assert.equal(handheld.cols, 128);
    assert.equal(handheld.colors, 256);
    assert.equal(handheld.colorOn, false);
    assert.equal(handheld.levels, 256);
    assert.equal(dotRecipe(handheld).levelsOn, false);
    assert.equal(dotRecipe(handheld).palette, "normal");
    assert.equal(dotRecipe(handheld).alphaOn, true);
    assert.equal(dotRecipe(handheld).dither, "off");
    assert.equal(handheld.brightness, 30);
    assert.equal(matchingGamePreset({ cols: 128, colors: 256, levels: 256, palette: "normal", gray: false, mosaic: true, colorOn: false, levelsOn: false, alphaOn: true, dither: "off", ditherStrength: 70, bayerSize: 4, ditherStrengthOn: true }), "3ds");
    assert.equal(matchingGamePreset({ cols: 96, colors: 16, levels: 256, palette: "normal", gray: false, mosaic: true, colorOn: true, levelsOn: false, alphaOn: true, dither: "off", ditherStrength: 70, bayerSize: 4, ditherStrengthOn: true }), "ds4");
    assert.equal(matchingGamePreset({ cols: 96, colors: 256, levels: 256, palette: "normal", gray: false, mosaic: true, colorOn: true, levelsOn: false, alphaOn: true, dither: "off", ditherStrength: 70, bayerSize: 4, ditherStrengthOn: true }), "ds");
    assert.equal(matchingGamePreset({ cols: 80, colors: 16, levels: 64, palette: "normal", gray: false, mosaic: true, colorOn: true, levelsOn: true, alphaOn: true, dither: "off", ditherStrength: 70, bayerSize: 4, ditherStrengthOn: true }), "");
    const ramp = new Uint8ClampedArray(256 * 4);
    for (let index = 0; index < 256; index += 1) {
      ramp[index * 4] = index;
      ramp[index * 4 + 1] = index;
      ramp[index * 4 + 2] = index;
      ramp[index * 4 + 3] = 255;
    }
    const stepsOf = (levels: number) => {
      const recipe = emptyDotRecipe();
      recipe.blackLine = 0;
      recipe.levelsOn = true;
      recipe.levels = levels;
      const out = renderDotImage(ramp, 256, 1, null, null, recipe);
      const found = new Set<number>();
      for (let index = 0; index < out.rgba.length; index += 4) found.add(out.rgba[index] ?? 0);
      return found.size;
    };
    assert.equal(stepsOf(2), 2);
    assert.equal(stepsOf(4), 4);
    assert.equal(stepsOf(8), 8);
    assert.equal(stepsOf(16), 16);
    assert.equal(stepsOf(32), 32);
    assert.equal(stepsOf(64), 64);
    assert.equal(stepsOf(256), 256);
    assert.equal(snapDotLevels(256), 256);
    assert.equal(dotLevelIndex(256), 6);
    assert.equal(snapDotLevels(1), 2);
    assert.equal(snapDotLevels(3), 2);
    assert.equal(snapDotLevels(12), 8);
    assert.equal(snapDotLevels(24), 16);
    assert.equal(snapDotLevels(32), 32);
    assert.equal(snapDotLevels(48), 32);
    assert.equal(dotLevelIndex(2), 0);
    assert.equal(dotLevelIndex(4), 1);
    assert.equal(dotLevelIndex(8), 2);
    assert.equal(dotLevelIndex(16), 3);
    assert.equal(dotLevelIndex(32), 4);
    assert.equal(dotLevelIndex(64), 5);
    assert.equal(dotRecipe({ on: true, cols: 16, levels: 32 }).levels, 32);
    const soft = new Uint8ClampedArray([10, 20, 30, 80]);
    const leveled = emptyDotRecipe();
    leveled.levelsOn = true;
    leveled.levels = 2;
    assert.equal(renderDotImage(soft, 1, 1, null, null, leveled).rgba[3], 80);
  });
});
