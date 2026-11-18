/**
 * One Pixel-mode tab as a single `.pdxpixel` file.
 * Version 1 is a ZIP: manifest.json plus RGBA PNGs. Clear pixels keep their RGB.
 * The archive is self-contained. Nothing points at an external image.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped, type Zippable } from "fflate";
import {
  PIXEL_CANVAS_MAX,
  PIXEL_CANVAS_MIN,
  PIXEL_DEFAULT_INDEX,
  PIXEL_TAB_NAME_MAX,
  PIXEL_ZOOM_MAX,
  PIXEL_ZOOM_MIN,
  clampLayerOpacity,
  clonePixelSelection,
  decodeRgbaPng,
  duplicatePixelTabName,
  encodeRgbaPng,
  nextPixelLayerName,
  parseInkPick,
  symmetryAxisOf,
  type ImagePlane,
  type InkPick,
  type PixelColor,
  type PixelLayerKind,
  type PixelSelection,
  type SymmetryAxis,
} from "./pixel-board.ts";

export const PIXEL_PROJECT_VERSION = 1;
export const PIXEL_PROJECT_FORMAT = "pdxpixel";
/** Compressed file. Larger files are refused before they are unpacked. */
export const PIXEL_PROJECT_MAX_BYTES = 48 * 1024 * 1024;
const PROJECT_MAX_ENTRIES = 200;
const PROJECT_MAX_UNPACKED = 64 * 1024 * 1024;
const PROJECT_MAX_LAYERS = 64;
const PROJECT_PLANE_MAX = 8192;

export class PixelProjectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PixelProjectError";
  }
}

export type PixelProjectLayer = {
  name: string;
  visible: boolean;
  opacity: number;
  kind: PixelLayerKind;
  x: number;
  y: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  rest: ImagePlane | null;
};

/** Editing state of one Pixel tab. Buffers are copies. */
export type PixelProject = {
  version: 1;
  name: string;
  width: number;
  height: number;
  active: number;
  alphaOn: boolean;
  alphaUsed: boolean;
  extracted: boolean;
  used: PixelColor[];
  color: InkPick;
  zoom: number | null;
  panX: number;
  panY: number;
  symmetry: SymmetryAxis | null;
  selection: PixelSelection | null;
  originName: string;
  originId: string | null;
  layers: PixelProjectLayer[];
};

const NOT_PROJECT = "このファイルはプロジェクト形式ではありません";
const NEWER = "このプロジェクトは新しい形式です";
const BROKEN = "プロジェクトの内容が壊れています";
const TOO_BIG = "ファイルが大きすぎます";
const SAVE_FAILED = "プロジェクトを保存できませんでした";

function fail(message: string): never {
  throw new PixelProjectError(message);
}

function isSafePath(path: string): boolean {
  if (!path || path.length > 80) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("..") || path.includes("\0")) return false;
  return /^[A-Za-z0-9._/-]+$/.test(path);
}

function intIn(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

function copyRgba(data: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray | null {
  const need = width * height * 4;
  if (data.length < need) return null;
  return new Uint8ClampedArray(data.subarray(0, need));
}

function tightMaskBounds(mask: Uint8Array, width: number, height: number): { x: number; y: number; w: number; h: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const bit = mask[y * width + x];
      if (bit !== 0 && bit !== 1) return null;
      if (bit !== 1) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** `character.png` → `character.pdxpixel`. The stem is the suggested file name. */
export function pixelProjectFileName(source: string): string {
  const base = source.trim().split(/[/\\]/).pop() ?? "";
  const stem = base.replace(/\.(pdxpixel|png|jpe?g|gif|webp|bmp)$/i, "").replace(/[:"*?<>|\u0000-\u001f]/g, "").trim();
  return `${(stem || "pixel").slice(0, 80)}.pdxpixel`;
}

/** Tab title from a project file name. A name already in use gets `（1）`. */
export function pixelProjectTabName(fileName: string, taken: readonly string[]): string {
  const baseName = fileName.trim().split(/[/\\]/).pop() ?? "";
  const stem = baseName.replace(/\.pdxpixel$/i, "").trim();
  const base = (stem || "キャンバス").slice(0, PIXEL_TAB_NAME_MAX);
  if (!taken.includes(base)) return base;
  return duplicatePixelTabName(base, taken);
}

export async function encodePixelProject(doc: PixelProject): Promise<Uint8Array> {
  const width = intIn(doc.width, PIXEL_CANVAS_MIN, PIXEL_CANVAS_MAX);
  const height = intIn(doc.height, PIXEL_CANVAS_MIN, PIXEL_CANVAS_MAX);
  if (width == null || height == null) fail(SAVE_FAILED);
  if (!Array.isArray(doc.layers) || doc.layers.length < 1 || doc.layers.length > PROJECT_MAX_LAYERS) fail(SAVE_FAILED);
  const files: Zippable = {};
  const layers: {
    name: string;
    visible: boolean;
    opacity: number;
    kind: PixelLayerKind;
    x: number;
    y: number;
    width: number;
    height: number;
    png: string;
    rest: { x: number; y: number; width: number; height: number; png: string } | null;
  }[] = [];
  for (let index = 0; index < doc.layers.length; index += 1) {
    const layer = doc.layers[index]!;
    const kind: PixelLayerKind = layer.kind === "image" ? "image" : "pixel";
    const planeW = kind === "image" ? layer.width : width;
    const planeH = kind === "image" ? layer.height : height;
    if (intIn(planeW, 1, PROJECT_PLANE_MAX) == null || intIn(planeH, 1, PROJECT_PLANE_MAX) == null) fail(SAVE_FAILED);
    const pixels = copyRgba(layer.pixels, planeW, planeH);
    if (!pixels) fail(SAVE_FAILED);
    const png = await encodeRgbaPng(pixels, planeW, planeH);
    if (!png) fail(SAVE_FAILED);
    const pngName = `layers/${index}.png`;
    files[pngName] = [png, { level: 0 }];
    let rest: { x: number; y: number; width: number; height: number; png: string } | null = null;
    if (kind === "pixel" && layer.rest) {
      const restW = intIn(layer.rest.width, 1, PROJECT_PLANE_MAX);
      const restH = intIn(layer.rest.height, 1, PROJECT_PLANE_MAX);
      const restX = intIn(layer.rest.x, -1_000_000, 1_000_000);
      const restY = intIn(layer.rest.y, -1_000_000, 1_000_000);
      const restPixels = restW != null && restH != null ? copyRgba(layer.rest.pixels, restW, restH) : null;
      if (restW == null || restH == null || restX == null || restY == null || !restPixels) fail(SAVE_FAILED);
      const restPng = await encodeRgbaPng(restPixels, restW, restH);
      if (!restPng) fail(SAVE_FAILED);
      const restName = `layers/${index}.rest.png`;
      files[restName] = [restPng, { level: 0 }];
      rest = { x: restX, y: restY, width: restW, height: restH, png: restName };
    }
    const originX = kind === "image" ? intIn(layer.x, -1_000_000, 1_000_000) : 0;
    const originY = kind === "image" ? intIn(layer.y, -1_000_000, 1_000_000) : 0;
    if (originX == null || originY == null) fail(SAVE_FAILED);
    layers.push({
      name: layer.name.trim().slice(0, PIXEL_TAB_NAME_MAX) || nextPixelLayerName(layers.map((item) => item.name)),
      visible: layer.visible !== false,
      opacity: clampLayerOpacity(layer.opacity),
      kind,
      x: originX,
      y: originY,
      width: planeW,
      height: planeH,
      png: pngName,
      rest,
    });
  }
  const active = intIn(doc.active, 0, layers.length - 1) ?? 0;
  let selection: { kind: "rect"; x: number; y: number; w: number; h: number } | { kind: "lasso"; x: number; y: number; w: number; h: number } | null = null;
  const picked = clonePixelSelection(doc.selection);
  if (picked?.kind === "rect") {
    const rect = picked.rect;
    if (intIn(rect.x, 0, width - 1) == null || intIn(rect.y, 0, height - 1) == null || rect.w < 1 || rect.h < 1 || rect.x + rect.w > width || rect.y + rect.h > height) {
      fail(SAVE_FAILED);
    }
    selection = { kind: "rect", x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  } else if (picked?.kind === "lasso") {
    if (picked.mask.length !== width * height) fail(SAVE_FAILED);
    const bounds = tightMaskBounds(picked.mask, width, height);
    if (!bounds) fail(SAVE_FAILED);
    files["selection.bin"] = [new Uint8Array(picked.mask), { level: 0 }];
    selection = { kind: "lasso", x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h };
  }
  const color = parseInkPick(doc.color) ?? PIXEL_DEFAULT_INDEX;
  const symmetry = doc.symmetry ? symmetryAxisOf(doc.symmetry) : null;
  const zoom = doc.zoom == null ? null : intIn(doc.zoom, PIXEL_ZOOM_MIN, PIXEL_ZOOM_MAX);
  if (doc.zoom != null && zoom == null) fail(SAVE_FAILED);
  const manifest = {
    format: PIXEL_PROJECT_FORMAT,
    version: PIXEL_PROJECT_VERSION,
    name: typeof doc.name === "string" ? doc.name.trim().slice(0, PIXEL_TAB_NAME_MAX) : "",
    canvas: { width, height },
    active,
    alphaOn: doc.alphaOn !== false,
    alphaUsed: doc.alphaUsed === true,
    extracted: doc.extracted === true,
    used: (Array.isArray(doc.used) ? doc.used : []).slice(0, 512).map((color) => ({
      r: color.r & 255,
      g: color.g & 255,
      b: color.b & 255,
      a: color.a & 255,
    })),
    color,
    zoom,
    panX: Number.isFinite(doc.panX) ? Math.max(-1_000_000, Math.min(1_000_000, doc.panX)) : 0,
    panY: Number.isFinite(doc.panY) ? Math.max(-1_000_000, Math.min(1_000_000, doc.panY)) : 0,
    symmetry,
    selection,
    origin: {
      id: doc.originId && doc.originId.trim() ? doc.originId.trim().slice(0, 80) : null,
      name: typeof doc.originName === "string" ? doc.originName.trim().slice(0, 120) : "",
    },
    layers,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest));
  const zipped = zipSync(files);
  if (zipped.length > PIXEL_PROJECT_MAX_BYTES) fail(TOO_BIG);
  return zipped;
}

function readUsed(value: unknown): PixelColor[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 512) fail(BROKEN);
  return value.map((entry) => {
    if (!entry || typeof entry !== "object") fail(BROKEN);
    const row = entry as { r?: unknown; g?: unknown; b?: unknown; a?: unknown };
    const r = intIn(row.r, 0, 255);
    const g = intIn(row.g, 0, 255);
    const b = intIn(row.b, 0, 255);
    const a = row.a == null ? 255 : intIn(row.a, 0, 255);
    if (r == null || g == null || b == null || a == null) fail(BROKEN);
    return { r, g, b, a };
  });
}

function readSelection(value: unknown, width: number, height: number, files: Unzipped): PixelSelection | null {
  if (value == null) return null;
  if (typeof value !== "object") fail(BROKEN);
  const row = value as { kind?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown };
  const x = intIn(row.x, -1_000_000, 1_000_000);
  const y = intIn(row.y, -1_000_000, 1_000_000);
  const w = intIn(row.w, 1, PROJECT_PLANE_MAX);
  const h = intIn(row.h, 1, PROJECT_PLANE_MAX);
  if (x == null || y == null || w == null || h == null) fail(BROKEN);
  if (row.kind === "rect") {
    if (x < 0 || y < 0 || x + w > width || y + h > height) fail(BROKEN);
    return { kind: "rect", rect: { x, y, w, h } };
  }
  if (row.kind === "lasso") {
    const mask = files["selection.bin"];
    if (!mask || mask.length !== width * height) fail(BROKEN);
    const copy = new Uint8Array(mask);
    const bounds = tightMaskBounds(copy, width, height);
    if (!bounds || bounds.x !== x || bounds.y !== y || bounds.w !== w || bounds.h !== h) fail(BROKEN);
    return { kind: "lasso", mask: copy, bounds };
  }
  fail(BROKEN);
}

async function readPlane(files: Unzipped, path: string, width: number, height: number): Promise<Uint8ClampedArray> {
  if (!isSafePath(path)) fail(BROKEN);
  const bytes = files[path];
  if (!bytes) fail(BROKEN);
  const decoded = await decodeRgbaPng(bytes);
  if (!decoded || decoded.width !== width || decoded.height !== height) fail(BROKEN);
  return new Uint8ClampedArray(decoded.rgba);
}

export async function decodePixelProject(bytes: Uint8Array): Promise<PixelProject> {
  if (bytes.length > PIXEL_PROJECT_MAX_BYTES) fail(TOO_BIG);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) fail(NOT_PROJECT);
  let files: Unzipped;
  try {
    files = unzipSync(new Uint8Array(bytes));
  } catch {
    fail(BROKEN);
  }
  const paths = Object.keys(files);
  if (paths.length > PROJECT_MAX_ENTRIES) fail(TOO_BIG);
  if (paths.some((path) => !isSafePath(path))) fail(BROKEN);
  let unpacked = 0;
  for (const path of paths) {
    unpacked += files[path]!.length;
    if (unpacked > PROJECT_MAX_UNPACKED) fail(TOO_BIG);
  }
  const manifestBytes = files["manifest.json"];
  if (!manifestBytes) fail(NOT_PROJECT);
  let manifest: unknown;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as unknown;
  } catch {
    fail(BROKEN);
  }
  if (!manifest || typeof manifest !== "object") fail(BROKEN);
  const row = manifest as {
    format?: unknown;
    version?: unknown;
    name?: unknown;
    canvas?: { width?: unknown; height?: unknown };
    active?: unknown;
    alphaOn?: unknown;
    alphaUsed?: unknown;
    extracted?: unknown;
    used?: unknown;
    color?: unknown;
    zoom?: unknown;
    panX?: unknown;
    panY?: unknown;
    symmetry?: unknown;
    selection?: unknown;
    origin?: { id?: unknown; name?: unknown };
    layers?: unknown;
  };
  if (typeof row.version === "number" && row.version > PIXEL_PROJECT_VERSION) fail(NEWER);
  if (row.format !== PIXEL_PROJECT_FORMAT || row.version !== PIXEL_PROJECT_VERSION) fail(NOT_PROJECT);
  const width = intIn(row.canvas?.width, PIXEL_CANVAS_MIN, PIXEL_CANVAS_MAX);
  const height = intIn(row.canvas?.height, PIXEL_CANVAS_MIN, PIXEL_CANVAS_MAX);
  if (width == null || height == null || !Array.isArray(row.layers)) fail(BROKEN);
  if (row.layers.length < 1 || row.layers.length > PROJECT_MAX_LAYERS) fail(BROKEN);
  const layers: PixelProjectLayer[] = [];
  for (let index = 0; index < row.layers.length; index += 1) {
    const entry = row.layers[index];
    if (!entry || typeof entry !== "object") fail(BROKEN);
    const layer = entry as {
      name?: unknown;
      visible?: unknown;
      opacity?: unknown;
      kind?: unknown;
      x?: unknown;
      y?: unknown;
      width?: unknown;
      height?: unknown;
      png?: unknown;
      rest?: unknown;
    };
    if (layer.visible != null && typeof layer.visible !== "boolean") fail(BROKEN);
    if (layer.opacity != null && (typeof layer.opacity !== "number" || !Number.isFinite(layer.opacity))) fail(BROKEN);
    const kind: PixelLayerKind = layer.kind == null ? "pixel" : layer.kind === "image" ? "image" : layer.kind === "pixel" ? "pixel" : fail(BROKEN);
    const planeW = kind === "image" ? intIn(layer.width, 1, PROJECT_PLANE_MAX) : width;
    const planeH = kind === "image" ? intIn(layer.height, 1, PROJECT_PLANE_MAX) : height;
    if (kind === "pixel" && layer.width != null && layer.width !== width) fail(BROKEN);
    if (kind === "pixel" && layer.height != null && layer.height !== height) fail(BROKEN);
    if (planeW == null || planeH == null) fail(BROKEN);
    if (layer.png !== `layers/${index}.png`) fail(BROKEN);
    const pixels = await readPlane(files, `layers/${index}.png`, planeW, planeH);
    let rest: ImagePlane | null = null;
    if (layer.rest != null) {
      if (kind === "image" || typeof layer.rest !== "object") fail(BROKEN);
      const extra = layer.rest as { x?: unknown; y?: unknown; width?: unknown; height?: unknown; png?: unknown };
      const restW = intIn(extra.width, 1, PROJECT_PLANE_MAX);
      const restH = intIn(extra.height, 1, PROJECT_PLANE_MAX);
      const restX = intIn(extra.x, -1_000_000, 1_000_000);
      const restY = intIn(extra.y, -1_000_000, 1_000_000);
      if (restW == null || restH == null || restX == null || restY == null || extra.png !== `layers/${index}.rest.png`) fail(BROKEN);
      rest = { x: restX, y: restY, width: restW, height: restH, pixels: await readPlane(files, extra.png, restW, restH) };
    }
    const originX = kind === "image" ? intIn(layer.x, -1_000_000, 1_000_000) : 0;
    const originY = kind === "image" ? intIn(layer.y, -1_000_000, 1_000_000) : 0;
    if (originX == null || originY == null) fail(BROKEN);
    const name = typeof layer.name === "string" && layer.name.trim() ? layer.name.trim().slice(0, PIXEL_TAB_NAME_MAX) : nextPixelLayerName(layers.map((item) => item.name));
    layers.push({
      name,
      visible: layer.visible !== false,
      opacity: clampLayerOpacity(typeof layer.opacity === "number" ? layer.opacity : 100),
      kind,
      x: originX,
      y: originY,
      width: planeW,
      height: planeH,
      pixels,
      rest,
    });
  }
  const active = intIn(row.active, 0, layers.length - 1);
  if (row.active != null && active == null) fail(BROKEN);
  const selection = "selection" in row ? readSelection(row.selection ?? null, width, height, files) : null;
  let symmetry: SymmetryAxis | null = null;
  if ("symmetry" in row && row.symmetry != null) {
    symmetry = symmetryAxisOf(row.symmetry);
    if (!symmetry) fail(BROKEN);
    if ([symmetry.x0, symmetry.y0, symmetry.x1, symmetry.y1].some((coord) => Math.abs(coord) > 1_000_000)) fail(BROKEN);
  }
  let color: InkPick = PIXEL_DEFAULT_INDEX;
  if ("color" in row && row.color != null) {
    const picked = parseInkPick(row.color);
    if (picked == null) fail(BROKEN);
    color = picked;
  }
  const zoom = row.zoom == null ? null : intIn(row.zoom, PIXEL_ZOOM_MIN, PIXEL_ZOOM_MAX);
  if (row.zoom != null && zoom == null) fail(BROKEN);
  const panX = row.panX == null ? 0 : row.panX;
  const panY = row.panY == null ? 0 : row.panY;
  if (typeof panX !== "number" || typeof panY !== "number" || !Number.isFinite(panX) || !Number.isFinite(panY) || Math.abs(panX) > 1_000_000 || Math.abs(panY) > 1_000_000) fail(BROKEN);
  const origin = row.origin;
  const originId = origin && typeof origin.id === "string" && origin.id.trim() ? origin.id.trim().slice(0, 80) : null;
  const originName = origin && typeof origin.name === "string" ? origin.name.trim().slice(0, 120) : "";
  if (origin != null && typeof origin !== "object") fail(BROKEN);
  return {
    version: 1,
    name: typeof row.name === "string" ? row.name.trim().slice(0, PIXEL_TAB_NAME_MAX) : "",
    width,
    height,
    active: active ?? 0,
    alphaOn: row.alphaOn !== false,
    alphaUsed: row.alphaUsed === true,
    extracted: row.extracted === true,
    used: readUsed(row.used),
    color,
    zoom,
    panX,
    panY,
    symmetry,
    selection,
    originName,
    originId,
    layers,
  };
}
