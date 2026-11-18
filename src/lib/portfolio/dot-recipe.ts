/**
 * Dot-picture recipe. The stored file is never written.
 *
 * Order: source → tone → outline → marker falloff → cells → palette / dither.
 * Overlaps use the highest priority circle only. Its falloff eases back to the
 * global settings at the rim. Marker sliders are not blended with each other.
 * Internal line detection is not implemented.
 */

import { DOT_COLOR_DEFAULT, DOT_DEFAULT, applyDotFilter, averageCells, cellSpan, dotView, mapCells, paletteFromCells, snapDotColors, snapDotCols, type DotField } from "./dot-filter.ts";
import type { DotBias, DotDitherName, DotLineColor, DotMarker, DotPaletteName, ImageDot } from "./types.ts";

export const DOT_SAMPLE_CAP = 640;
export const DOT_SAMPLE_LIVE_CAP = 480;

export type DotRecipe = {
  gray: boolean;
  levelsOn: boolean;
  levels: number;
  brightness: number;
  brightnessOn: boolean;
  contrast: number;
  contrastOn: boolean;
  palette: DotPaletteName;
  dither: DotDitherName;
  ditherStrength: number;
  ditherStrengthOn: boolean;
  bayerSize: 2 | 4 | 8;
  outline: boolean;
  outlineWidth: number;
  outlineColor: DotLineColor;
  outlineHex: string;
  samplePos: DotBias;
  sampleWeight: number;
  sampleWeightOn: boolean;
  density: number;
  densityOn: boolean;
  sampleContrast: number;
  sampleContrastOn: boolean;
  blackLine: number;
  blackLineOn: boolean;
  /** True keeps source alpha. False turns every partial alpha opaque and leaves clear pixels clear. */
  alphaOn: boolean;
  markers: DotMarker[];
};

export type DotPatch = {
  show?: boolean;
  on?: boolean;
  cols?: number;
  colors?: number;
  colorOn?: boolean;
  gray?: boolean;
  levelsOn?: boolean;
  levels?: number;
  brightness?: number;
  brightnessOn?: boolean;
  contrast?: number;
  contrastOn?: boolean;
  palette?: DotPaletteName;
  dither?: DotDitherName;
  ditherStrength?: number;
  ditherStrengthOn?: boolean;
  bayerSize?: number;
  outline?: boolean;
  outlineWidth?: number;
  outlineColor?: DotLineColor;
  outlineHex?: string;
  samplePos?: DotBias;
  sampleWeight?: number;
  sampleWeightOn?: boolean;
  density?: number;
  densityOn?: boolean;
  sampleContrast?: number;
  sampleContrastOn?: boolean;
  blackLine?: number;
  blackLineOn?: boolean;
  alphaOn?: boolean;
  markers?: DotMarker[];
};

export type DotImage = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
};

const DEFAULT_LEVELS = 8;
const DEFAULT_STRENGTH = 70;
const DEFAULT_LINE = 100;
/** Posterize stops. 256 is the GBA preset and is not rounded down to 64. */
export const DOT_LEVEL_STOPS = [2, 4, 8, 16, 32, 64, 256] as const;

/** Nearest stop. A tie stays on the lower stop. */
export function snapDotLevels(value: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LEVELS;
  let best: number = DOT_LEVEL_STOPS[0];
  let bestDistance = Math.abs(value - best);
  for (const stop of DOT_LEVEL_STOPS) {
    const distance = Math.abs(value - stop);
    if (distance < bestDistance) {
      best = stop;
      bestDistance = distance;
    }
  }
  return best;
}

export function dotLevelIndex(value: number): number {
  const index = DOT_LEVEL_STOPS.indexOf(snapDotLevels(value) as (typeof DOT_LEVEL_STOPS)[number]);
  return index < 0 ? 2 : index;
}

export type GamePresetId = "gb" | "sgb" | "gbc" | "gba" | "ds4" | "ds" | "3ds";

export type GamePreset = {
  id: GamePresetId;
  label: string;
  cols: number;
  /** False leaves the saved color count and skips reduction. */
  colorOn: boolean;
  colors: number | null;
  /** False leaves the saved step count and skips posterize. */
  levelsOn: boolean;
  levels: number | null;
  palette: "gray" | "normal";
  /** False turns 半透明なし on. True keeps source alpha. Null leaves that switch alone. */
  alphaOn: boolean | null;
  dither: DotDitherName;
  /** Used only for Bayer. Null leaves the saved strength and matrix size. */
  ditherStrength: number | null;
  bayerSize: 2 | 4 | 8 | null;
};

export const GAME_PRESETS: readonly GamePreset[] = [
  { id: "gb", label: "GB", cols: 64, colorOn: true, colors: 4, levelsOn: true, levels: 4, palette: "gray", alphaOn: false, dither: "bayer", ditherStrength: 25, bayerSize: 4 },
  { id: "sgb", label: "SGB", cols: 64, colorOn: true, colors: 4, levelsOn: true, levels: 4, palette: "normal", alphaOn: false, dither: "bayer", ditherStrength: 25, bayerSize: 4 },
  { id: "gbc", label: "GBC", cols: 64, colorOn: true, colors: 8, levelsOn: true, levels: 32, palette: "normal", alphaOn: false, dither: "bayer", ditherStrength: 25, bayerSize: 8 },
  { id: "gba", label: "GBA", cols: 64, colorOn: true, colors: 16, levelsOn: true, levels: 256, palette: "normal", alphaOn: true, dither: "off", ditherStrength: null, bayerSize: null },
  { id: "ds4", label: "DS(4bit)", cols: 96, colorOn: true, colors: 16, levelsOn: false, levels: null, palette: "normal", alphaOn: true, dither: "off", ditherStrength: null, bayerSize: null },
  { id: "ds", label: "DS(8bit)", cols: 96, colorOn: true, colors: 256, levelsOn: false, levels: null, palette: "normal", alphaOn: true, dither: "off", ditherStrength: null, bayerSize: null },
  { id: "3ds", label: "3DS", cols: 128, colorOn: false, colors: null, levelsOn: false, levels: null, palette: "normal", alphaOn: true, dither: "off", ditherStrength: null, bayerSize: null },
];

export function gamePresetById(id: string): GamePreset | null {
  return GAME_PRESETS.find((preset) => preset.id === id) ?? null;
}

/** The machine's listed values. A missing color or step count is left as saved, and its switch follows the preset. */
export function gamePresetPatch(id: GamePresetId, show: boolean): DotPatch {
  const preset = gamePresetById(id);
  if (!preset) return {};
  const patch: DotPatch = {
    show,
    on: true,
    cols: preset.cols,
    colorOn: preset.colorOn,
    levelsOn: preset.levelsOn,
    palette: preset.palette,
    gray: false,
  };
  if (preset.colors != null) patch.colors = preset.colors;
  if (preset.levels != null) patch.levels = preset.levels;
  if (preset.alphaOn != null) patch.alphaOn = preset.alphaOn;
  patch.dither = preset.dither;
  if (preset.dither === "bayer" && preset.ditherStrength != null && preset.bayerSize != null) {
    patch.ditherStrength = preset.ditherStrength;
    patch.ditherStrengthOn = true;
    patch.bayerSize = preset.bayerSize;
  }
  return patch;
}

/** Empty when the live numbers are not one of the seven machines. */
export function matchingGamePreset(input: {
  cols: number;
  colors: number;
  levels: number;
  palette: DotPaletteName;
  gray: boolean;
  mosaic: boolean;
  colorOn: boolean;
  levelsOn: boolean;
  alphaOn: boolean;
  dither: DotDitherName;
  ditherStrength: number;
  bayerSize: 2 | 4 | 8;
  ditherStrengthOn: boolean;
}): GamePresetId | "" {
  if (!input.mosaic) return "";
  const mode = input.palette === "gray" || (input.palette === "normal" && input.gray) ? "gray" : input.palette === "normal" ? "normal" : "";
  if (!mode) return "";
  const hit = GAME_PRESETS.find((preset) => {
    if (preset.cols !== input.cols || preset.palette !== mode) return false;
    if (preset.colorOn !== input.colorOn || preset.levelsOn !== input.levelsOn) return false;
    if (preset.colorOn && preset.colors !== input.colors) return false;
    if (preset.levelsOn && preset.levels !== input.levels) return false;
    if (preset.alphaOn != null && preset.alphaOn !== input.alphaOn) return false;
    if (preset.dither !== input.dither) return false;
    if (preset.dither === "bayer") {
      if (preset.ditherStrength !== input.ditherStrength || preset.bayerSize !== input.bayerSize) return false;
      if (!input.ditherStrengthOn) return false;
    }
    return true;
  });
  return hit?.id ?? "";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(Math.round(value), min, max) : fallback;
}

function flag(value: unknown): boolean {
  return value !== false;
}

/** Slider switches default to on. Off keeps the stored number and skips that one effect. */
export function appliedRecipe(recipe: DotRecipe): DotRecipe {
  if (
    recipe.brightnessOn &&
    recipe.contrastOn &&
    recipe.ditherStrengthOn &&
    recipe.sampleWeightOn &&
    recipe.densityOn &&
    recipe.sampleContrastOn &&
    recipe.blackLineOn
  ) {
    return recipe;
  }
  return {
    ...recipe,
    brightness: recipe.brightnessOn ? recipe.brightness : 0,
    contrast: recipe.contrastOn ? recipe.contrast : 0,
    ditherStrength: recipe.ditherStrengthOn ? recipe.ditherStrength : 0,
    sampleWeight: recipe.sampleWeightOn ? recipe.sampleWeight : 0,
    density: recipe.densityOn ? recipe.density : 0,
    sampleContrast: recipe.sampleContrastOn ? recipe.sampleContrast : 0,
    blackLine: recipe.blackLineOn ? recipe.blackLine : 0,
  };
}

function biasOf(value: unknown): DotBias {
  return value === "tl" || value === "br" || value === "center" ? value : "center";
}

function paletteOf(value: unknown): DotPaletteName {
  return value === "gray" || value === "green" || value === "sepia" || value === "normal" ? value : "normal";
}

function ditherOf(value: unknown): DotDitherName {
  return value === "floyd" || value === "bayer" || value === "atkinson" || value === "off" ? value : "off";
}

function lineOf(value: unknown): DotLineColor {
  return value === "white" || value === "custom" || value === "black" ? value : "black";
}

function bayerOf(value: unknown): 2 | 4 | 8 {
  return value === 2 || value === 8 ? value : 4;
}

function hexOf(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : "#000000";
}

export function emptyDotRecipe(): DotRecipe {
  return {
    gray: false,
    levelsOn: false,
    levels: DEFAULT_LEVELS,
    brightness: 0,
    brightnessOn: true,
    contrast: 0,
    contrastOn: true,
    palette: "normal",
    dither: "off",
    ditherStrength: DEFAULT_STRENGTH,
    ditherStrengthOn: true,
    bayerSize: 4,
    outline: false,
    outlineWidth: 1,
    outlineColor: "black",
    outlineHex: "#000000",
    samplePos: "center",
    sampleWeight: 0,
    sampleWeightOn: true,
    density: 0,
    densityOn: true,
    sampleContrast: 0,
    sampleContrastOn: true,
    blackLine: DEFAULT_LINE,
    blackLineOn: true,
    alphaOn: true,
    markers: [],
  };
}

export function normalizeDotMarker(raw: unknown, index: number): DotMarker | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<DotMarker>;
  if (typeof row.id !== "string" || !row.id) return null;
  const name = typeof row.name === "string" ? row.name.replace(/\s+/g, " ").trim().slice(0, 24) : "";
  return {
    id: row.id.slice(0, 40),
    name: name || `円${index + 1}`,
    u: typeof row.u === "number" && Number.isFinite(row.u) ? clamp(row.u, 0, 1) : 0.5,
    v: typeof row.v === "number" && Number.isFinite(row.v) ? clamp(row.v, 0, 1) : 0.5,
    r: typeof row.r === "number" && Number.isFinite(row.r) ? clamp(row.r, 0.04, 0.48) : 0.18,
    priority: num(row.priority, index + 1, 0, 9999),
    crisp: num(row.crisp, 40, 0, 100),
    density: num(row.density, 0, -100, 100),
    contrast: num(row.contrast, 0, -100, 100),
    line: num(row.line, 40, 0, 100),
    bias: biasOf(row.bias),
  };
}

export function dotRecipe(dot: ImageDot | null | undefined): DotRecipe {
  const base = emptyDotRecipe();
  if (!dot) return base;
  const markers = Array.isArray(dot.markers)
    ? dot.markers.flatMap((marker, index) => {
        const next = normalizeDotMarker(marker, index);
        return next ? [next] : [];
      })
    : [];
  return {
    gray: dot.gray === true,
    levelsOn: dot.levelsOn === true,
    levels: snapDotLevels(typeof dot.levels === "number" ? dot.levels : DEFAULT_LEVELS),
    brightness: num(dot.brightness, 0, -100, 100),
    brightnessOn: flag(dot.brightnessOn),
    contrast: num(dot.contrast, 0, -100, 100),
    contrastOn: flag(dot.contrastOn),
    palette: paletteOf(dot.palette),
    dither: ditherOf(dot.dither),
    ditherStrength: num(dot.ditherStrength, DEFAULT_STRENGTH, 0, 100),
    ditherStrengthOn: flag(dot.ditherStrengthOn),
    bayerSize: bayerOf(dot.bayerSize),
    outline: dot.outline === true,
    outlineWidth: num(dot.outlineWidth, 1, 1, 8),
    outlineColor: lineOf(dot.outlineColor),
    outlineHex: hexOf(dot.outlineHex),
    samplePos: biasOf(dot.samplePos),
    sampleWeight: num(dot.sampleWeight, 0, 0, 100),
    sampleWeightOn: flag(dot.sampleWeightOn),
    density: num(dot.density, 0, -100, 100),
    densityOn: flag(dot.densityOn),
    sampleContrast: num(dot.sampleContrast, 0, -100, 100),
    sampleContrastOn: flag(dot.sampleContrastOn),
    blackLine: num(dot.blackLine, DEFAULT_LINE, 0, 100),
    blackLineOn: flag(dot.blackLineOn),
    alphaOn: flag(dot.alphaOn),
    markers,
  };
}

/** True when the extra processing cannot change a legacy mosaic. */
export function recipeIsPlain(recipe: DotRecipe): boolean {
  const live = appliedRecipe(recipe);
  return (
    !live.gray &&
    !live.levelsOn &&
    live.brightness === 0 &&
    live.contrast === 0 &&
    live.palette === "normal" &&
    (live.dither === "off" || live.ditherStrength <= 0) &&
    !live.outline &&
    live.sampleWeight === 0 &&
    live.density === 0 &&
    live.sampleContrast === 0 &&
    live.blackLine === 0 &&
    live.alphaOn &&
    live.markers.length === 0
  );
}

export function recipeKey(recipe: DotRecipe): string {
  const live = appliedRecipe(recipe);
  if (recipeIsPlain(live)) return "";
  return JSON.stringify([
    live.gray,
    live.levelsOn,
    live.levels,
    live.brightness,
    live.contrast,
    live.palette,
    live.dither,
    live.ditherStrength,
    live.bayerSize,
    live.outline,
    live.outlineWidth,
    live.outlineColor,
    live.outlineHex,
    live.samplePos,
    live.sampleWeight,
    live.density,
    live.sampleContrast,
    live.blackLine,
    live.alphaOn,
    live.markers,
  ]);
}

function attachRecipe(base: ImageDot, recipe: DotRecipe): ImageDot {
  const next: ImageDot = { ...base };
  if (recipe.gray) next.gray = true;
  if (recipe.levelsOn) next.levelsOn = true;
  if (recipe.levels !== DEFAULT_LEVELS) next.levels = recipe.levels;
  if (recipe.brightness !== 0) next.brightness = recipe.brightness;
  if (!recipe.brightnessOn) next.brightnessOn = false;
  if (recipe.contrast !== 0) next.contrast = recipe.contrast;
  if (!recipe.contrastOn) next.contrastOn = false;
  if (recipe.palette !== "normal") next.palette = recipe.palette;
  if (recipe.dither !== "off") next.dither = recipe.dither;
  if (recipe.ditherStrength !== DEFAULT_STRENGTH) next.ditherStrength = recipe.ditherStrength;
  if (!recipe.ditherStrengthOn) next.ditherStrengthOn = false;
  if (recipe.bayerSize !== 4) next.bayerSize = recipe.bayerSize;
  if (recipe.outline) next.outline = true;
  if (recipe.outlineWidth !== 1) next.outlineWidth = recipe.outlineWidth;
  if (recipe.outlineColor !== "black") next.outlineColor = recipe.outlineColor;
  if (recipe.outlineHex !== "#000000") next.outlineHex = recipe.outlineHex;
  if (recipe.samplePos !== "center") next.samplePos = recipe.samplePos;
  if (recipe.sampleWeight !== 0) next.sampleWeight = recipe.sampleWeight;
  if (!recipe.sampleWeightOn) next.sampleWeightOn = false;
  if (recipe.density !== 0) next.density = recipe.density;
  if (!recipe.densityOn) next.densityOn = false;
  if (recipe.sampleContrast !== 0) next.sampleContrast = recipe.sampleContrast;
  if (!recipe.sampleContrastOn) next.sampleContrastOn = false;
  if (recipe.blackLine !== DEFAULT_LINE) next.blackLine = recipe.blackLine;
  if (!recipe.blackLineOn) next.blackLineOn = false;
  if (!recipe.alphaOn) next.alphaOn = false;
  if (recipe.markers.length > 0) next.markers = recipe.markers.map((marker) => ({ ...marker }));
  return next;
}

/** Merge a patch onto a saved dot. Missing recipe fields stay. Defaults are omitted. */
export function mergeDot(existing: ImageDot | null | undefined, patch: DotPatch): ImageDot {
  const recipe = dotRecipe(existing);
  if (patch.gray !== undefined) recipe.gray = patch.gray === true;
  if (patch.levelsOn !== undefined) recipe.levelsOn = patch.levelsOn === true;
  if (patch.levels !== undefined) recipe.levels = snapDotLevels(typeof patch.levels === "number" ? patch.levels : DEFAULT_LEVELS);
  if (patch.brightness !== undefined) recipe.brightness = num(patch.brightness, 0, -100, 100);
  if (patch.brightnessOn !== undefined) recipe.brightnessOn = patch.brightnessOn === true;
  if (patch.contrast !== undefined) recipe.contrast = num(patch.contrast, 0, -100, 100);
  if (patch.contrastOn !== undefined) recipe.contrastOn = patch.contrastOn === true;
  if (patch.palette !== undefined) recipe.palette = paletteOf(patch.palette);
  if (patch.dither !== undefined) recipe.dither = ditherOf(patch.dither);
  if (patch.ditherStrength !== undefined) recipe.ditherStrength = num(patch.ditherStrength, DEFAULT_STRENGTH, 0, 100);
  if (patch.ditherStrengthOn !== undefined) recipe.ditherStrengthOn = patch.ditherStrengthOn === true;
  if (patch.bayerSize !== undefined) recipe.bayerSize = bayerOf(patch.bayerSize);
  if (patch.outline !== undefined) recipe.outline = patch.outline === true;
  if (patch.outlineWidth !== undefined) recipe.outlineWidth = num(patch.outlineWidth, 1, 1, 8);
  if (patch.outlineColor !== undefined) recipe.outlineColor = lineOf(patch.outlineColor);
  if (patch.outlineHex !== undefined) recipe.outlineHex = hexOf(patch.outlineHex);
  if (patch.samplePos !== undefined) recipe.samplePos = biasOf(patch.samplePos);
  if (patch.sampleWeight !== undefined) recipe.sampleWeight = num(patch.sampleWeight, 0, 0, 100);
  if (patch.sampleWeightOn !== undefined) recipe.sampleWeightOn = patch.sampleWeightOn === true;
  if (patch.density !== undefined) recipe.density = num(patch.density, 0, -100, 100);
  if (patch.densityOn !== undefined) recipe.densityOn = patch.densityOn === true;
  if (patch.sampleContrast !== undefined) recipe.sampleContrast = num(patch.sampleContrast, 0, -100, 100);
  if (patch.sampleContrastOn !== undefined) recipe.sampleContrastOn = patch.sampleContrastOn === true;
  if (patch.blackLine !== undefined) recipe.blackLine = num(patch.blackLine, 0, 0, 100);
  if (patch.blackLineOn !== undefined) recipe.blackLineOn = patch.blackLineOn === true;
  if (patch.alphaOn !== undefined) recipe.alphaOn = patch.alphaOn === true;
  if (patch.markers !== undefined) {
    recipe.markers = patch.markers.flatMap((marker, index) => {
      const next = normalizeDotMarker(marker, index);
      return next ? [next] : [];
    });
  }
  const view = dotView(existing ?? undefined);
  const base: ImageDot = {
    show: patch.show !== undefined ? patch.show === true : view.show,
    on: patch.on !== undefined ? patch.on === true : view.mosaic,
    cols: snapDotCols(patch.cols ?? existing?.cols ?? DOT_DEFAULT),
    colors: snapDotColors(patch.colors ?? existing?.colors ?? DOT_COLOR_DEFAULT),
    colorOn: patch.colorOn !== undefined ? patch.colorOn === true : view.colorOn,
  };
  return attachRecipe(base, recipe);
}

export function sameDot(a: ImageDot, b: ImageDot): boolean {
  return JSON.stringify(mergeDot(a, {})) === JSON.stringify(mergeDot(b, {}));
}

/** Extra fields worth keeping on an older record. Empty when the record is legacy. */
export function storedDotExtras(raw: unknown): Partial<ImageDot> | null {
  if (!raw || typeof raw !== "object") return null;
  const recipe = dotRecipe(raw as ImageDot);
  const attached = attachRecipe({ show: false, on: false, cols: 16, colors: 512, colorOn: false }, recipe);
  const extra: Partial<ImageDot> = { ...attached };
  delete extra.show;
  delete extra.on;
  delete extra.cols;
  delete extra.colors;
  delete extra.colorOn;
  return Object.keys(extra).length > 0 ? extra : null;
}

export function newDotMarker(index: number, priority: number): DotMarker {
  return {
    id: `dot-${Date.now().toString(36)}-${index}-${Math.floor(Math.random() * 1000)}`,
    name: `円${index}`,
    u: 0.5,
    v: 0.5,
    r: 0.18,
    priority,
    crisp: 40,
    density: 0,
    contrast: 0,
    line: 40,
    bias: "center",
  };
}

function toneIsPlain(recipe: DotRecipe): boolean {
  return !usesGrayTone(recipe) && !recipe.levelsOn && recipe.brightness === 0 && recipe.contrast === 0;
}

function localIsPlain(recipe: DotRecipe): boolean {
  return recipe.sampleWeight === 0 && recipe.density === 0 && recipe.sampleContrast === 0 && recipe.blackLine === 0 && recipe.markers.length === 0;
}

function channel(value: number): number {
  return clamp(Math.round(value), 0, 255);
}

/** Grayscale is one palette, not a second pass. An explicit green or sepia palette wins over the old switch. */
function usesGrayTone(recipe: DotRecipe): boolean {
  return recipe.palette === "gray" || (recipe.gray && recipe.palette === "normal");
}

function applyTone(pixels: Uint8ClampedArray, recipe: DotRecipe): void {
  if (toneIsPlain(recipe)) return;
  const bright = (recipe.brightness / 100) * 255;
  const contrast = 1 + recipe.contrast / 100;
  const steps = snapDotLevels(recipe.levels);
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] ?? 0;
    if (alpha <= 0) continue;
    let red = (pixels[index] ?? 0) + bright;
    let green = (pixels[index + 1] ?? 0) + bright;
    let blue = (pixels[index + 2] ?? 0) + bright;
    red = (red - 128) * contrast + 128;
    green = (green - 128) * contrast + 128;
    blue = (blue - 128) * contrast + 128;
    if (usesGrayTone(recipe)) {
      const lum = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      red = lum;
      green = lum;
      blue = lum;
    }
    if (recipe.levelsOn) {
      red = Math.round(clamp(red, 0, 255) / 255 * (steps - 1)) / (steps - 1) * 255;
      green = Math.round(clamp(green, 0, 255) / 255 * (steps - 1)) / (steps - 1) * 255;
      blue = Math.round(clamp(blue, 0, 255) / 255 * (steps - 1)) / (steps - 1) * 255;
    }
    pixels[index] = channel(red);
    pixels[index + 1] = channel(green);
    pixels[index + 2] = channel(blue);
  }
}

function dilateAlpha(alpha: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  let current = alpha;
  const passes = Math.max(1, Math.min(8, Math.round(radius)));
  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Uint8Array(current.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let max = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) continue;
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = x + dx;
            if (xx < 0 || xx >= width) continue;
            const value = current[yy * width + xx] ?? 0;
            if (value > max) max = value;
          }
        }
        next[y * width + x] = max;
      }
    }
    current = next;
  }
  return current;
}

function outlineRgb(recipe: DotRecipe): [number, number, number] {
  if (recipe.outlineColor === "white") return [255, 255, 255];
  if (recipe.outlineColor === "custom") {
    const match = /^#([0-9a-f]{6})$/i.exec(recipe.outlineHex);
    if (match?.[1]) {
      const value = Number.parseInt(match[1], 16);
      return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
    }
  }
  return [0, 0, 0];
}

function applyOutline(pixels: Uint8ClampedArray, width: number, height: number, recipe: DotRecipe): void {
  if (!recipe.outline) return;
  const alpha = new Uint8Array(width * height);
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = (pixels[index * 4 + 3] ?? 0) > 16 ? 255 : 0;
  }
  const grown = dilateAlpha(alpha, width, height, recipe.outlineWidth);
  const [red, green, blue] = outlineRgb(recipe);
  for (let index = 0; index < alpha.length; index += 1) {
    const at = index * 4;
    if ((pixels[at + 3] ?? 0) !== 0) continue;
    if ((grown[index] ?? 0) <= 0) continue;
    pixels[at] = red;
    pixels[at + 1] = green;
    pixels[at + 2] = blue;
    pixels[at + 3] = 255;
  }
}

function smooth(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Highest priority circle that covers this pixel, with a soft rim. */
export function markerAt(
  x: number,
  y: number,
  width: number,
  height: number,
  markers: readonly DotMarker[],
): { marker: DotMarker | null; fall: number } {
  let best: DotMarker | null = null;
  let bestKey = Number.NEGATIVE_INFINITY;
  let fall = 0;
  const minSide = Math.min(width, height);
  const px = x + 0.5;
  const py = y + 0.5;
  for (const marker of markers) {
    const radius = marker.r * minSide;
    if (radius <= 0) continue;
    const dist = Math.hypot(px - marker.u * width, py - marker.v * height);
    if (dist >= radius) continue;
    const nextFall = smooth(1 - dist / radius);
    if (nextFall <= 0) continue;
    const key = marker.priority + nextFall * 0.001;
    if (key > bestKey) {
      bestKey = key;
      best = marker;
      fall = nextFall;
    }
  }
  return { marker: best, fall };
}

function biasWeight(nx: number, ny: number, pos: DotBias, amount: number): number {
  if (amount <= 0) return 1;
  const t = amount / 100;
  let bias = 1;
  if (pos === "center") bias = Math.max(0, 1 - Math.hypot(nx - 0.5, ny - 0.5) * 2);
  else if (pos === "tl") bias = (1 - nx) * (1 - ny);
  else bias = nx * ny;
  return (1 - t) + t * (0.08 + 0.92 * bias);
}

function localColor(red: number, green: number, blue: number, density: number, contrast: number, line: number, crisp: number): [number, number, number] {
  if (density === 0 && contrast === 0 && line === 0 && crisp === 0) return [red, green, blue];
  const gainContrast = 1 + (contrast + crisp * 0.85) / 100;
  let r = (red - 128) * gainContrast + 128;
  let g = (green - 128) * gainContrast + 128;
  let b = (blue - 128) * gainContrast + 128;
  const gain = 1 + density / 100;
  r *= gain;
  g *= gain;
  b *= gain;
  if (line > 0) {
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < 110) {
      const pull = (line / 100) * (1 - lum / 110);
      r *= 1 - pull;
      g *= 1 - pull;
      b *= 1 - pull;
    }
  }
  return [channel(r), channel(g), channel(b)];
}

function coversMarker(marker: DotMarker, x: number, y: number, width: number, height: number): boolean {
  const radius = marker.r * Math.min(width, height);
  if (radius <= 0) return false;
  return Math.hypot(x + 0.5 - marker.u * width, y + 0.5 - marker.v * height) < radius;
}

/** A mosaic cell keeps a marker only when every pixel of that cell is inside it. */
function cellOwner(x0: number, y0: number, x1: number, y1: number, width: number, height: number, markers: readonly DotMarker[]): DotMarker | null {
  if (x1 <= x0 || y1 <= y0) return null;
  const corners: [number, number][] = [
    [x0, y0],
    [x1 - 1, y0],
    [x0, y1 - 1],
    [x1 - 1, y1 - 1],
  ];
  let best: DotMarker | null = null;
  let bestKey = Number.NEGATIVE_INFINITY;
  const cx = Math.min(width - 1, Math.max(0, Math.floor((x0 + x1) / 2)));
  const cy = Math.min(height - 1, Math.max(0, Math.floor((y0 + y1) / 2)));
  for (const marker of markers) {
    if (!corners.every(([x, y]) => coversMarker(marker, x, y, width, height))) continue;
    const hit = markerAt(cx, cy, width, height, [marker]);
    const key = marker.priority + hit.fall * 0.001;
    if (key > bestKey) {
      bestKey = key;
      best = marker;
    }
  }
  return best;
}

function sampleCells(pixels: Uint8ClampedArray, width: number, height: number, cols: number, recipe: DotRecipe): { field: DotField; region: Uint8Array } {
  const plain = localIsPlain(recipe);
  const base = averageCells(pixels, width, height, cols);
  const region = new Uint8Array(base.cols * base.rows);
  if (plain) return { field: base, region };
  const rgba = new Uint8ClampedArray(base.cols * base.rows * 4);
  for (let row = 0; row < base.rows; row += 1) {
    const [y0, y1] = cellSpan(row, base.rows, height);
    for (let col = 0; col < base.cols; col += 1) {
      const [x0, x1] = cellSpan(col, base.cols, width);
      const owner = cellOwner(x0, y0, x1, y1, width, height, recipe.markers);
      const slotIndex = row * base.cols + col;
      if (owner) region[slotIndex] = recipe.markers.indexOf(owner) + 1;
      let red = 0;
      let green = 0;
      let blue = 0;
      let weight = 0;
      let alpha = 0;
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const at = (y * width + x) * 4;
          const cover = pixels[at + 3] ?? 0;
          count += 1;
          alpha += cover;
          if (cover <= 0) continue;
          const hit = owner ? markerAt(x, y, width, height, [owner]) : { marker: null, fall: 0 };
          const fall = hit.fall;
          const marker = hit.marker;
          const density = marker ? lerp(recipe.density, marker.density, fall) : recipe.density;
          const contrast = marker ? lerp(recipe.sampleContrast, marker.contrast, fall) : recipe.sampleContrast;
          const line = marker ? lerp(recipe.blackLine, marker.line, fall) : recipe.blackLine;
          const crisp = marker ? marker.crisp * fall : 0;
          const pos = marker ? marker.bias : recipe.samplePos;
          const amount = marker ? lerp(recipe.sampleWeight, 100, fall) : recipe.sampleWeight;
          const [r, g, b] = localColor(pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0, density, contrast, line, crisp);
          const spanX = Math.max(1, x1 - x0);
          const spanY = Math.max(1, y1 - y0);
          const nx = (x - x0 + 0.5) / spanX;
          const ny = (y - y0 + 0.5) / spanY;
          const scale = cover * biasWeight(nx, ny, pos, amount);
          red += r * scale;
          green += g * scale;
          blue += b * scale;
          weight += scale;
        }
      }
      const slot = slotIndex * 4;
      if (count < 1 || alpha <= 0 || weight <= 0) continue;
      rgba[slot] = Math.round(red / weight);
      rgba[slot + 1] = Math.round(green / weight);
      rgba[slot + 2] = Math.round(blue / weight);
      rgba[slot + 3] = Math.round(alpha / count);
    }
  }
  return { field: { cols: base.cols, rows: base.rows, rgba }, region };
}

function tint(red: number, green: number, blue: number, palette: DotPaletteName): [number, number, number] {
  if (palette === "normal") return [red, green, blue];
  const lum = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  if (palette === "gray") return [channel(lum), channel(lum), channel(lum)];
  if (palette === "green") return [channel(lum * 0.45), channel(Math.min(255, lum * 0.92 + 18)), channel(lum * 0.38)];
  return [
    channel(Math.min(255, 0.393 * red + 0.769 * green + 0.189 * blue)),
    channel(Math.min(255, 0.349 * red + 0.686 * green + 0.168 * blue)),
    channel(Math.min(255, 0.272 * red + 0.534 * green + 0.131 * blue)),
  ];
}

function tintField(field: DotField, palette: DotPaletteName): void {
  if (palette === "normal" || palette === "gray") return;
  const data = field.rgba;
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) <= 0) continue;
    const [red, green, blue] = tint(data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0, palette);
    data[index] = red;
    data[index + 1] = green;
    data[index + 2] = blue;
  }
}

function bayerMatrix(size: 2 | 4 | 8): number[] {
  let current = [0, 2, 3, 1];
  let n = 2;
  while (n < size) {
    const nextN = n * 2;
    const next = new Array<number>(nextN * nextN);
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        const value = current[y * n + x] ?? 0;
        next[y * nextN + x] = value * 4;
        next[y * nextN + x + n] = value * 4 + 2;
        next[(y + n) * nextN + x] = value * 4 + 3;
        next[(y + n) * nextN + x + n] = value * 4 + 1;
      }
    }
    current = next;
    n = nextN;
  }
  return current;
}

function nearest(red: number, green: number, blue: number, palette: readonly { r: number; g: number; b: number }[]): { r: number; g: number; b: number } {
  let best = palette[0] ?? { r: 0, g: 0, b: 0 };
  let bestD = Number.POSITIVE_INFINITY;
  for (const color of palette) {
    const distance = (color.r - red) ** 2 + (color.g - green) ** 2 + (color.b - blue) ** 2;
    if (distance < bestD) {
      bestD = distance;
      best = color;
      if (distance === 0) break;
    }
  }
  return best;
}

function spread(err: Float64Array, width: number, height: number, x: number, y: number, dx: number, dy: number, amount: number, alpha: Uint8Array, region: Uint8Array | null): void {
  const xx = x + dx;
  const yy = y + dy;
  if (xx < 0 || yy < 0 || xx >= width || yy >= height) return;
  if ((alpha[yy * width + xx] ?? 0) <= 0) return;
  if (region && (region[yy * width + xx] ?? 0) !== (region[y * width + x] ?? 0)) return;
  err[yy * width + xx] = (err[yy * width + xx] ?? 0) + amount;
}

function diffuse(field: DotField, palette: readonly { r: number; g: number; b: number }[], recipe: DotRecipe, region: Uint8Array | null): void {
  const { cols, rows, rgba } = field;
  const strength = recipe.ditherStrength / 100;
  if (palette.length === 0 || strength <= 0 || recipe.dither === "off") {
    mapCells(field, palette);
    return;
  }
  const alpha = new Uint8Array(cols * rows);
  for (let index = 0; index < alpha.length; index += 1) alpha[index] = (rgba[index * 4 + 3] ?? 0) > 0 ? 1 : 0;
  const errR = new Float64Array(cols * rows);
  const errG = new Float64Array(cols * rows);
  const errB = new Float64Array(cols * rows);
  const matrix = recipe.dither === "bayer" ? bayerMatrix(recipe.bayerSize) : null;
  const size = recipe.bayerSize;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const index = y * cols + x;
      const at = index * 4;
      if ((alpha[index] ?? 0) <= 0) continue;
      let red = (rgba[at] ?? 0) + (errR[index] ?? 0);
      let green = (rgba[at + 1] ?? 0) + (errG[index] ?? 0);
      let blue = (rgba[at + 2] ?? 0) + (errB[index] ?? 0);
      if (matrix) {
        const threshold = (matrix[(y % size) * size + (x % size)] ?? 0) / (size * size) - 0.5;
        const amp = strength * 64;
        red += threshold * amp;
        green += threshold * amp;
        blue += threshold * amp;
      }
      const color = nearest(channel(red), channel(green), channel(blue), palette);
      rgba[at] = color.r;
      rgba[at + 1] = color.g;
      rgba[at + 2] = color.b;
      if (!matrix) {
        const er = (red - color.r) * strength;
        const eg = (green - color.g) * strength;
        const eb = (blue - color.b) * strength;
        const kernel =
          recipe.dither === "atkinson"
            ? [
                [1, 0, 1 / 8],
                [2, 0, 1 / 8],
                [-1, 1, 1 / 8],
                [0, 1, 1 / 8],
                [1, 1, 1 / 8],
                [0, 2, 1 / 8],
              ]
            : [
                [1, 0, 7 / 16],
                [-1, 1, 3 / 16],
                [0, 1, 5 / 16],
                [1, 1, 1 / 16],
              ];
        for (const [dx, dy, share] of kernel) {
          spread(errR, cols, rows, x, y, dx ?? 0, dy ?? 0, er * (share ?? 0), alpha, region);
          spread(errG, cols, rows, x, y, dx ?? 0, dy ?? 0, eg * (share ?? 0), alpha, region);
          spread(errB, cols, rows, x, y, dx ?? 0, dy ?? 0, eb * (share ?? 0), alpha, region);
        }
      }
    }
  }
}

function reduceField(field: DotField, colors: number, recipe: DotRecipe, region: Uint8Array | null = null): void {
  tintField(field, recipe.palette);
  const palette = paletteFromCells([field], snapDotColors(colors));
  if (recipe.dither === "off" || recipe.ditherStrength <= 0) mapCells(field, palette);
  else diffuse(field, palette, recipe, region);
}

function applyLocalPixels(pixels: Uint8ClampedArray, width: number, height: number, recipe: DotRecipe): void {
  if (localIsPlain(recipe)) return;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      if ((pixels[at + 3] ?? 0) <= 0) continue;
      const hit = markerAt(x, y, width, height, recipe.markers);
      const marker = hit.marker;
      const fall = hit.fall;
      const density = marker ? lerp(recipe.density, marker.density, fall) : recipe.density;
      const contrast = marker ? lerp(recipe.sampleContrast, marker.contrast, fall) : recipe.sampleContrast;
      const line = marker ? lerp(recipe.blackLine, marker.line, fall) : recipe.blackLine;
      const crisp = marker ? marker.crisp * fall : 0;
      const [red, green, blue] = localColor(pixels[at] ?? 0, pixels[at + 1] ?? 0, pixels[at + 2] ?? 0, density, contrast, line, crisp);
      pixels[at] = red;
      pixels[at + 1] = green;
      pixels[at + 2] = blue;
    }
  }
}

/**
 * One frame of the dot pipeline. `cols` null skips the mosaic.
 * `colors` null skips reduction. Alpha 0 never contributes its RGB.
 */
export function renderDotImage(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  cols: number | null,
  colors: number | null,
  recipe: DotRecipe,
): DotImage {
  recipe = appliedRecipe(recipe);
  const source = new Uint8ClampedArray(pixels);
  applyTone(source, recipe);
  applyOutline(source, width, height, recipe);
  if (cols != null) {
    const sampled = sampleCells(source, width, height, cols, recipe);
    if (colors != null) reduceField(sampled.field, colors, recipe, sampled.region);
    else tintField(sampled.field, recipe.palette);
    return presentDot(sampled.field.cols, sampled.field.rows, sampled.field.rgba, recipe.alphaOn);
  }
  applyLocalPixels(source, width, height, recipe);
  if (colors != null) reduceField({ cols: width, rows: height, rgba: source }, colors, recipe);
  else tintField({ cols: width, rows: height, rgba: source }, recipe.palette);
  return presentDot(width, height, source, recipe.alphaOn);
}

/** Output-only. Alpha 0 stays clear. Any higher alpha becomes opaque. RGB and the caller's buffer stay put. */
function presentDot(width: number, height: number, rgba: Uint8ClampedArray, keepAlpha: boolean): DotImage {
  if (keepAlpha) return { width, height, rgba };
  const stepped = new Uint8ClampedArray(rgba);
  for (let index = 3; index < stepped.length; index += 4) {
    if ((stepped[index] ?? 0) > 0) stepped[index] = 255;
  }
  return { width, height, rgba: stepped };
}

/** Paint a recipe onto a canvas. A plain recipe uses the legacy mosaic so old pictures stay put. */
export function paintDotCanvas(
  ctx: CanvasRenderingContext2D,
  cols: number | null,
  colors: number | null,
  recipe: DotRecipe | null,
): void {
  if (!recipe || recipeIsPlain(recipe)) {
    applyDotFilter(ctx, cols, colors);
    return;
  }
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  if (width < 1 || height < 1) return;
  const image = ctx.getImageData(0, 0, width, height);
  const out = renderDotImage(image.data, width, height, cols, colors, recipe);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = false;
  if (out.width === width && out.height === height) {
    ctx.putImageData(new ImageData(new Uint8ClampedArray(out.rgba), width, height), 0, 0);
    return;
  }
  const small = document.createElement("canvas");
  small.width = out.width;
  small.height = out.height;
  const sample = small.getContext("2d", { alpha: true });
  if (!sample) return;
  sample.putImageData(new ImageData(new Uint8ClampedArray(out.rgba), out.width, out.height), 0, 0);
  ctx.drawImage(small, 0, 0, width, height);
}
