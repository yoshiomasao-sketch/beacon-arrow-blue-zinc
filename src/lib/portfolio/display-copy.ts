/**
 * A still PNG of one image's current static look, plus a separate copy of its edit data.
 * The original file is never changed. Animation frames and editing chrome are not painted.
 */

import { normalizeEffectMarkers, type EffectMarker } from "./effect-marker.ts";
import { normalizeImagePlay } from "./image-play.ts";
import { normalizeLiquidHides, normalizeLiquidRanges, type LiquidHide, type LiquidRange } from "./liquid.ts";
import { paintDotCanvas, recipeIsPlain, type DotRecipe } from "./dot-recipe.ts";
import { normalizeMemo } from "./logic.ts";
import { normalizePuruMarkers, type PuruMarker } from "./purupuru.ts";
import type { DisplayScale, ImageMeta, ImagePlay } from "./types.ts";
import { normalizeVectorMarkers, VECTOR_VIBE, type VectorMarker } from "./vector-marker.ts";

/** Marker lists captured when the button was pressed. Empty means none, not "use an older save". */
export type DisplayCopyLive = {
  puru: readonly PuruMarker[];
  vectors: readonly VectorMarker[];
  effects: readonly EffectMarker[];
  liquid: readonly LiquidRange[];
  liquidHide: readonly LiquidHide[];
};

export type ClonedDisplayEdits = {
  memo: string;
  favorite: boolean;
  scale: DisplayScale;
  tagIds: string[];
  puru?: { markers: PuruMarker[] };
  vectors?: { vibe: number; markers: VectorMarker[] };
  effects?: { markers: EffectMarker[] };
  play?: ImagePlay;
};

/** Visible ink is baked. Hidden ink stays an editable layer. No ink does nothing. */
export function inkCopyPlan(visible: boolean, hasInk: boolean): "bake" | "keep-hidden" | "none" {
  if (!hasInk) return "none";
  return visible ? "bake" : "keep-hidden";
}

function stemOf(name: string): string {
  const trimmed = name.trim() || "無題";
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return trimmed;
  return trimmed.slice(0, dot);
}

/** `original.png` → `original_表示状態.png`, then `_2`, `_3`, without reusing a taken name. */
export function displayCopyFileName(name: string, taken: readonly string[]): string {
  const used = new Set(taken);
  const stem = stemOf(name);
  const first = `${stem}_表示状態.png`;
  if (!used.has(first)) return first;
  for (let index = 2; index < 10000; index += 1) {
    const next = `${stem}_表示状態_${index}.png`;
    if (!used.has(next)) return next;
  }
  return `${stem}_表示状態_${used.size + 2}.png`;
}

/** `original.png` → `original_ドット.png`, then `_2`, without reusing a name in the same folder. */
export function dotCopyFileName(name: string, taken: readonly string[]): string {
  const used = new Set(taken);
  const stem = stemOf(name);
  const first = `${stem}_ドット.png`;
  if (!used.has(first)) return first;
  for (let index = 2; index < 10000; index += 1) {
    const next = `${stem}_ドット_${index}.png`;
    if (!used.has(next)) return next;
  }
  return `${stem}_ドット_${used.size + 2}.png`;
}

/** A still made by ドットバイドット. Ordinary photos do not match. */
export function isDotStillName(name: string | null | undefined): boolean {
  if (!name) return false;
  return /_ドット(?:_\d+)?\.png$/i.test(name.trim());
}

function reseed<T extends { id?: number }>(items: readonly T[]): T[] {
  return structuredClone(items).map((item, index) => {
    item.id = index + 1;
    return item;
  });
}

function stoppedPlay(): ImagePlay {
  return {
    kind: null,
    speed: "normal",
    reverse: false,
    zoom: false,
    twist: false,
    zoomPace: "normal",
    twistPace: "normal",
    tilt: null,
    vector: false,
    effect: false,
    effects: [],
    voiceId: null,
    rate: 1,
    volume: 100,
    liquid: [],
    liquidHide: [],
  };
}

/**
 * New objects for the duplicate. Marker positions stay in the same fractions of the picture.
 * Ids are renumbered so the copy is not the source's record. Dot settings are left out:
 * the pixels already contain the mosaic, and turning it on again would mosaic twice.
 */
export function cloneDisplayEdits(source: ImageMeta, live: DisplayCopyLive): ClonedDisplayEdits {
  const puru = normalizePuruMarkers({ markers: reseed(live.puru) });
  const vectors = normalizeVectorMarkers({ vibe: VECTOR_VIBE, markers: reseed(live.vectors) });
  const effects = normalizeEffectMarkers(reseed(live.effects));
  const saved = source.play ? structuredClone(source.play) : null;
  const liquid = normalizeLiquidRanges(reseed(live.liquid));
  const liquidHide = normalizeLiquidHides(reseed(live.liquidHide));
  const playSeed = saved ?? (liquid.length > 0 || liquidHide.length > 0 ? stoppedPlay() : null);
  const play = playSeed
    ? normalizeImagePlay({
        ...playSeed,
        effects: reseed(playSeed.effects),
        liquid,
        liquidHide,
      })
    : null;
  const scale: DisplayScale = source.scale === 2 || source.scale === 3 ? source.scale : 1;
  return {
    memo: normalizeMemo(source.memo),
    favorite: false,
    scale,
    tagIds: [...source.tagIds],
    ...(puru && puru.length > 0 ? { puru: { markers: puru } } : {}),
    ...(vectors && vectors.length > 0 ? { vectors: { vibe: VECTOR_VIBE, markers: vectors } } : {}),
    ...(effects && effects.length > 0 ? { effects: { markers: effects } } : {}),
    ...(play ? { play } : {}),
  };
}

/** Original pixels, then the mosaic, then the visible pen. No screen size and no editing chrome. */
export async function composeDisplayPng(input: {
  image: CanvasImageSource;
  width: number;
  height: number;
  dotCols: number | null;
  dotColors?: number | null;
  /** Extra dot processing. Omitted or plain keeps the legacy mosaic. */
  recipe?: DotRecipe | null;
  ink: CanvasImageSource | null;
}): Promise<Blob> {
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(input.height));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("canvas");
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(input.image, 0, 0, width, height);
  if (input.dotCols != null || input.dotColors != null || (input.recipe != null && !recipeIsPlain(input.recipe))) {
    paintDotCanvas(ctx, input.dotCols, input.dotColors ?? null, input.recipe ?? null);
  }
  if (input.ink) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(input.ink, 0, 0, width, height);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((next) => resolve(next), "image/png"));
  if (!blob || blob.size < 1) throw new Error("png");
  return blob;
}
