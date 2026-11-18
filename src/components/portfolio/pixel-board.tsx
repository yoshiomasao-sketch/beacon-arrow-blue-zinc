import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { readKvString, readPixels, writeKv } from "@/lib/portfolio/db";
import { placeOpacityPanel } from "@/lib/portfolio/canvas";
import { isDotStillName } from "@/lib/portfolio/display-copy";
import { GIF_FRAME_DRAG, openGifFrameSession, readGifFrameDrag } from "@/lib/portfolio/gif-frame-session";
import { browserFramePainter } from "@/lib/portfolio/gif-frame-paint";
import { OWN_FILE_DRAG, SHOT_DRAG } from "@/lib/portfolio/export-file";
import {
  ALPHA_PERCENTS,
  PIXEL_BACKDROP_KEY,
  PIXEL_CLEAR,
  PIXEL_DEFAULT_INDEX,
  PIXEL_PALETTE,
  PIXEL_PNG_KEY,
  PIXEL_SIZE_KEY,
  PIXEL_TABS_KEY,
  PIXEL_INK_KEY,
  PIXEL_ZOOM_MAX,
  PIXEL_ZOOM_MIN,
  alphaByte,
  alphaSwatch,
  bakeOpaque,
  blitContain,
  bresenham,
  commitPerfectPixel,
  canvasHasInk,
  canvasAnchorOffset,
  canvasPreviewFrame,
  clampCanvasEdge,
  clampZoom,
  clearPixels,
  clearSelection,
  clipHas,
  clonePixelSelection,
  clampWarpScale,
  collectUsedColors,
  colorCss,
  approxColorBands,
  compositePixelLayers,
  createPixels,
  cropPixelCanvas,
  duplicatePixelTabName,
  PIXEL_TAB_NAME_MAX,
  fillRect,
  fillSelection,
  flipSelectionHorizontal,
  mirrorSelectionHorizontal,
  invertPixelSelection,
  clampFollowMenu,
  commitFloatMove,
  containFit,
  encodePixelInk,
  fitPixelHeight,
  fitPixelSquare,
  importCanvasSize,
  fitPixelZoom,
  floodAlpha,
  floodRgb,
  hasPartialAlpha,
  isPaletteMono,
  isPixelSize,
  inkKey,
  colorSelectMask,
  copyPixelSelection,
  lassoMask,
  magicWandMask,
  applyPixelGradient,
  gradientSpanCells,
  scalePixelsNearest,
  encodeRgbaPng,
  decodeRgbaPng,
  isPixelExportScale,
  clampLayerOpacity,
  projectImagePlane,
  pixelLayerPlane,
  shiftContentPlane,
  rebasePixelRest,
  stampGuideBrush,
  moveImageSelection,
  commitCanvasDiff,
  GUIDE_PEN_SIZES,
  type ImagePlane,
  type PixelLayerKind,
  mergeVisiblePair,
  movePixels,
  moveSelectionPixels,
  moveLayerIndex,
  moveTabOrder,
  nearestAlphaPercent,
  nextPixelLayerName,
  replaceRgb,
  paletteIndex,
  pastedSelection,
  panAfterZoom,
  pixelBackdrop,
  pixelRect,
  parsePixelInk,
  paintEllipse,
  notePerfectStep,
  clipAxisLine,
  symmetricStampCells,
  symmetryAxisOf,
  PIXEL_PALETTE_ORDER,
  placeSlice,
  previewAlpha,
  readPixel,
  rememberDrop,
  rememberColor,
  selectionBox,
  selectionHas,
  selectionGridEdges,
  slideLasso,
  slideRect,
  splitUsedColors,
  stampLayerPixels,
  stampPixelClip,
  shiftPixelSelection,
  unionOpaqueBounds,
  usedSwatchOrder,
  usesOffCube,
  warpCorners,
  warpRotateHandles,
  warpLockedScales,
  warpEdge,
  warpLocal,
  warpPixels,
  warpSetHeight,
  warpSetWidth,
  warpSinCos,
  resizePixelCanvas,
  writeAlpha,
  writePixel,
  writeRgb,
  type PixelBackdrop,
  type PixelClip,
  type PixelColor,
  type InkPick,
  type PixelSelection,
  type PixelGrid,
  type PixelSize,
  type CanvasAnchor,
  type TrimBounds,
  type SymmetryAxis,
} from "@/lib/portfolio/pixel-board";
import {
  PixelProjectError,
  decodePixelProject,
  encodePixelProject,
  pixelProjectFileName,
  pixelProjectTabName,
  PIXEL_PROJECT_MAX_BYTES,
  type PixelProject,
} from "@/lib/portfolio/pixel-project";
import { composeSheet, integerPixelFit, sliceFrame, splitPlan } from "@/lib/portfolio/sprite-sheet";
import { notify, addPixelScaled } from "@/lib/portfolio/store";
import { TAG_DRAG } from "@/lib/portfolio/types";

type PixelTool = "pen" | "eraser" | "fill" | "grad" | "ellipse" | "symmetry" | "dropper" | "replace" | "select" | "move" | "paste" | "warp";
type WarpHandle = "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w" | "move" | "rotate";

type WarpPeer = { id: string; base: Uint8ClampedArray; image: boolean };
type FloatPeer = { id: string; base: Uint8ClampedArray; clip: PixelClip; image: boolean; rest: ImagePlane | null };
type MovePeer = { id: string; kind: "pixel" | "image"; plane: ImagePlane | null };

type WarpLive = {
  tabId: string;
  base: Uint8ClampedArray;
  beforeSelect: PixelSelection | null;
  clip: PixelClip;
  ox: number;
  oy: number;
  cx: number;
  cy: number;
  scaleX: number;
  scaleY: number;
  degrees: number;
  filter: "nearest" | "bilinear";
  lock: boolean;
  scope: "selection" | "canvas";
  peers: WarpPeer[];
};

type FloatLive = {
  mode: "menu" | "tool";
  layerId: string;
  base: Uint8ClampedArray;
  beforeSelect: PixelSelection;
  clip: PixelClip;
  x: number;
  y: number;
  image: boolean;
  peers: FloatPeer[];
};

type ColorPick = InkPick;

type CanvasLive = {
  tabId: string;
  base: Uint8ClampedArray;
  width: number;
  height: number;
  nextW: number;
  nextH: number;
  ax: CanvasAnchor;
  ay: CanvasAnchor;
  beforeSelect: PixelSelection | null;
};

type CanvasDraft = {
  widthText: string;
  heightText: string;
  nextW: number;
  nextH: number;
  ax: CanvasAnchor;
  ay: CanvasAnchor;
};

type TrimLive = {
  tabId: string;
  base: Uint8ClampedArray;
  width: number;
  height: number;
  bounds: TrimBounds;
  beforeSelect: PixelSelection | null;
};

type CanvasDim = { width: number; height: number };
type SheetDraft = {
  name: string;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  cols: number;
  rows: number;
};
type PixelOrigin = { id: string | null; name: string } | null;
type PixelAsk =
  | { kind: "blank"; size: PixelSize }
  | { kind: "import"; width: number; height: number; rgba: Uint8ClampedArray; dotFit: boolean; origin: PixelOrigin }
  | { kind: "close"; id: string; last: boolean }
  | { kind: "project"; name: string };

type PixelLayer = {
  id: string;
  name: string;
  visible: boolean;
  /** 0–100. Display only. The pixel buffer stays as it was painted. */
  opacity: number;
  kind: PixelLayerKind;
  /** Canvas cell of an image plane's top-left. Pixel layers stay at 0. */
  x: number;
  y: number;
  imgW: number;
  imgH: number;
  pixels: Uint8ClampedArray;
  png: string;
  /** Pixel-layer picture that sticks out of the canvas. Null when `pixels` is the whole layer. */
  rest: ImagePlane | null;
  restPng: string;
};

type TabLive = {
  id: string;
  name: string;
  size: PixelSize;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  layers: PixelLayer[];
  activeLayerId: string;
  alphaOn: boolean;
  alphaUsed: boolean;
  extracted: boolean;
  used: PixelColor[];
  color: ColorPick;
  zoom: number | null;
  panX: number;
  panY: number;
  png: string;
  pngDirty: boolean;
  select: PixelSelection | null;
  symmetry: SymmetryAxis | null;
  /** Library image this canvas was opened from. Null when the canvas has no source image. */
  origin: PixelOrigin;
  /** Last project file name. The writable handle stays in memory and is not stored here. */
  projectName: string;
};

type LayerRow = { id: string; name: string; visible: boolean; opacity: number; kind: PixelLayerKind };
type DocSnap = {
  activeLayerId: string;
  layers: { id: string; name: string; visible: boolean; opacity: number; kind: PixelLayerKind; x: number; y: number; imgW: number; imgH: number; pixels: Uint8ClampedArray; rest: ImagePlane | null }[];
  origin: PixelOrigin;
};
type DocHistory = { undo: DocSnap[]; redo: DocSnap[] };

const TOOLS: { id: PixelTool; label: string }[] = [
  { id: "pen", label: "ペン" },
  { id: "eraser", label: "消しゴム" },
  { id: "fill", label: "塗りつぶし" },
  { id: "grad", label: "グラデ" },
  { id: "ellipse", label: "円・楕円" },
  { id: "symmetry", label: "対称定規" },
  { id: "dropper", label: "スポイト" },
  { id: "replace", label: "色置換" },
  { id: "select", label: "範囲選択" },
  { id: "move", label: "移動" },
];

const SELECT_KIND_LABEL = { rect: "矩形", lasso: "投げ縄", wand: "マジックワンド", color: "色指定選択" } as const;

/** Nine anchors. The extra odd pixel stays on the right and the bottom. */
const CANVAS_ANCHORS: { ax: CanvasAnchor; ay: CanvasAnchor; label: string }[] = [
  { ax: 0, ay: 0, label: "左上" },
  { ax: 1, ay: 0, label: "上中央" },
  { ax: 2, ay: 0, label: "右上" },
  { ax: 0, ay: 1, label: "左中央" },
  { ax: 1, ay: 1, label: "中央" },
  { ax: 2, ay: 1, label: "右中央" },
  { ax: 0, ay: 2, label: "左下" },
  { ax: 1, ay: 2, label: "下中央" },
  { ax: 2, ay: 2, label: "右下" },
];

function readCanvasEdge(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  return clampCanvasEdge(Number(text));
}

/** View shared by every tab, and kept when pixel mode is closed and opened again. */
const pixelView = { zoom: null as number | null, panX: 0, panY: 0, dock: null as number | null };
/** Layer list width. Kept when pixel mode is closed and opened again. */
let pixelLayerWidth = 272;
/** Pen color and eyedropper history. Shared across tabs, and kept when pixel mode closes. */
const pixelInk = { color: PIXEL_DEFAULT_INDEX as ColorPick, drops: [] as ColorPick[] };
let pixelInkLoaded = false;
let pixelTail: Promise<void> = Promise.resolve();
let inkTail: Promise<void> = Promise.resolve();
let inkTimer = 0;

function flushPixelInk() {
  if (typeof window === "undefined" || !pixelInkLoaded) return;
  window.clearTimeout(inkTimer);
  inkTimer = 0;
  const payload = encodePixelInk(pixelInk.color, pixelInk.drops);
  const job = inkTail.catch(() => undefined).then(() => writeKv(PIXEL_INK_KEY, payload));
  inkTail = job.then(
    () => undefined,
    () => undefined,
  );
}

function schedulePixelInk() {
  if (typeof window === "undefined") return;
  window.clearTimeout(inkTimer);
  inkTimer = window.setTimeout(flushPixelInk, 200);
}

/** Copied pixels shared by every pixel tab. Closing a tab does not clear it. */
const pixelClipboard: { clip: PixelClip | null } = { clip: null };

if (typeof window !== "undefined") window.addEventListener("pagehide", flushPixelInk);
function nextTabName(names: readonly string[]): string {
  let max = 0;
  for (const name of names) {
    const match = /^キャンバス(\d+)$/.exec(name);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `キャンバス${max + 1}`;
}

function layerId(): string {
  return `lay-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9)}`;
}

function makeLayer(width: number, height: number, names: readonly string[] = [], pixels?: Uint8ClampedArray): PixelLayer {
  return {
    id: layerId(),
    name: nextPixelLayerName(names),
    visible: true,
    opacity: 100,
    kind: "pixel",
    x: 0,
    y: 0,
    imgW: width,
    imgH: height,
    pixels: pixels ?? createPixels(width, height),
    png: "",
    rest: null,
    restPng: "",
  };
}

function makeImageLayer(width: number, height: number, pixels: Uint8ClampedArray, name: string): PixelLayer {
  return {
    id: layerId(),
    name: name.trim().slice(0, 24) || "画像",
    visible: true,
    opacity: 100,
    kind: "image",
    x: 0,
    y: 0,
    imgW: width,
    imgH: height,
    pixels,
    png: "",
    rest: null,
    restPng: "",
  };
}

function toPlane(layer: PixelLayer): ImagePlane {
  return { x: layer.x, y: layer.y, width: layer.imgW, height: layer.imgH, pixels: layer.pixels };
}

function cloneRest(rest: ImagePlane | null | undefined): ImagePlane | null {
  if (!rest || rest.width < 1 || rest.height < 1 || rest.pixels.length < rest.width * rest.height * 4) return null;
  return { x: rest.x, y: rest.y, width: rest.width, height: rest.height, pixels: new Uint8ClampedArray(rest.pixels) };
}

function makeTab(size: PixelSize, names: readonly string[] = []): TabLive {
  const layer = makeLayer(size, size);
  layer.name = "レイヤー1";
  return {
    id: `pix-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9)}`,
    name: nextTabName(names),
    size,
    width: size,
    height: size,
    pixels: layer.pixels,
    layers: [layer],
    activeLayerId: layer.id,
    alphaOn: true,
    alphaUsed: false,
    extracted: false,
    used: [],
    color: PIXEL_DEFAULT_INDEX,
    zoom: null,
    panX: 0,
    panY: 0,
    png: "",
    pngDirty: true,
    select: null,
    symmetry: null,
    origin: null,
    projectName: "",
  };
}

function soloLayers(pixels: Uint8ClampedArray, name = "レイヤー1"): { layers: PixelLayer[]; activeLayerId: string } {
  const layer = makeLayer(1, 1, [], pixels);
  layer.name = name;
  return { layers: [layer], activeLayerId: layer.id };
}

function cloneOrigin(origin: PixelOrigin): PixelOrigin {
  if (!origin) return null;
  const name = origin.name.trim();
  const id = origin.id && origin.id.trim() ? origin.id : null;
  if (!name && !id) return null;
  return { id, name };
}

function isRgbPick(value: ColorPick): value is { r: number; g: number; b: number } {
  return typeof value === "object";
}

function recallPixel(): Promise<{ size: PixelSize; png: string; backdrop: PixelBackdrop; tabsRaw: string; inkRaw: string }> {
  const job = pixelTail.catch(() => undefined).then(async () => {
    const raw = await readKvString(PIXEL_SIZE_KEY, "64");
    const png = await readKvString(PIXEL_PNG_KEY, "");
    const tabsRaw = await readKvString(PIXEL_TABS_KEY, "");
    const inkRaw = await readKvString(PIXEL_INK_KEY, "");
    const backdrop = pixelBackdrop(await readKvString(PIXEL_BACKDROP_KEY, "checker"));
    const size = Number(raw);
    return { size: isPixelSize(size) ? size : 64, png, backdrop, tabsRaw, inkRaw };
  });
  pixelTail = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

function pngBlobRect(data: Uint8ClampedArray, width: number, height: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob && blob.size > 0 ? blob : null), "image/png"));
}

function pngBlob(data: Uint8ClampedArray, size: number): Promise<Blob | null> {
  return pngBlobRect(data, size, size);
}

async function encodePng(data: Uint8ClampedArray, width: number, height = width): Promise<string> {
  const blob = await pngBlobRect(data, width, height);
  if (!blob) return "";
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

function decodePng(base64: string, width: number, height = width): Promise<Uint8ClampedArray | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      if (naturalW < 1 || naturalH < 1) {
        resolve(null);
        return;
      }
      const scratch = document.createElement("canvas");
      scratch.width = naturalW;
      scratch.height = naturalH;
      const ctx = scratch.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const src = ctx.getImageData(0, 0, naturalW, naturalH).data;
      if (naturalW === width && naturalH === height) {
        resolve(new Uint8ClampedArray(src));
        return;
      }
      resolve(width === height ? blitContain(src, naturalW, naturalH, width) : null);
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/png;base64,${base64}`;
  });
}

async function rgbaFromBlob(blob: Blob): Promise<{ width: number; height: number; rgba: Uint8ClampedArray } | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    if (bitmap.width < 1 || bitmap.height < 1) return null;
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, rgba: new Uint8ClampedArray(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data) };
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

const IMAGE_PLANE_MAX = 4096;

async function readImageExact(blob: Blob): Promise<{ width: number; height: number; rgba: Uint8ClampedArray } | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    const decoded = await decodeRgbaPng(bytes);
    if (decoded) return { width: decoded.width, height: decoded.height, rgba: decoded.rgba };
  }
  return rgbaFromBlob(new Blob([bytes], { type: blob.type || "application/octet-stream" }));
}

function cellAt(clientX: number, clientY: number, canvas: HTMLCanvasElement, width: number, height: number): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * width);
  const y = Math.floor(((clientY - rect.top) / rect.height) * height);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  return { x, y };
}

function cellAtOpen(clientX: number, clientY: number, canvas: HTMLCanvasElement, width: number, height: number): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1 || width < 1 || height < 1) return null;
  return {
    x: Math.floor(((clientX - rect.left) / rect.width) * width),
    y: Math.floor(((clientY - rect.top) / rect.height) * height),
  };
}

function pointAtOpen(clientX: number, clientY: number, canvas: HTMLCanvasElement, width: number, height: number): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1 || width < 1 || height < 1) return null;
  return {
    x: ((clientX - rect.left) / rect.width) * width,
    y: ((clientY - rect.top) / rect.height) * height,
  };
}

function cellAtClamped(clientX: number, clientY: number, canvas: HTMLCanvasElement, width: number, height: number): { x: number; y: number } | null {
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1 || width < 1 || height < 1) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * width);
  const y = Math.floor(((clientY - rect.top) / rect.height) * height);
  return { x: Math.max(0, Math.min(width - 1, x)), y: Math.max(0, Math.min(height - 1, y)) };
}

function isInternalDrag(types: readonly string[]): boolean {
  return types.includes(SHOT_DRAG) || types.includes(OWN_FILE_DRAG) || types.includes(TAG_DRAG) || types.includes(GIF_FRAME_DRAG);
}

function imageFilesFrom(transfer: DataTransfer): File[] {
  return Array.from(transfer.files).filter((file) => file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name));
}

function RgbaThumb({ rgba, width, height, zoom }: { rgba: Uint8ClampedArray; width: number; height: number; zoom: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  }, [rgba, width, height]);
  return <canvas ref={ref} width={width} height={height} style={{ width: Math.max(1, width * zoom), height: Math.max(1, height * zoom) }} />;
}

type SaveHandle = {
  name?: string;
  getFile?: () => Promise<File>;
  createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
};

function pngSavePicker():
  | ((options: { suggestedName?: string; types?: { description?: string; accept: Record<string, string[]> }[] }) => Promise<SaveHandle>)
  | null {
  const host = window as Window & {
    showSaveFilePicker?: (options: { suggestedName?: string; types?: { description?: string; accept: Record<string, string[]> }[] }) => Promise<SaveHandle>;
  };
  return typeof host.showSaveFilePicker === "function" ? host.showSaveFilePicker.bind(host) : null;
}

function projectOpenPicker():
  | ((options: { multiple?: boolean; types?: { description?: string; accept: Record<string, string[]> }[] }) => Promise<SaveHandle[]>)
  | null {
  const host = window as Window & {
    showOpenFilePicker?: (options: { multiple?: boolean; types?: { description?: string; accept: Record<string, string[]> }[] }) => Promise<SaveHandle[]>;
  };
  return typeof host.showOpenFilePicker === "function" ? host.showOpenFilePicker.bind(host) : null;
}

const PROJECT_FILE_TYPE = { description: "ピクセルプロジェクト", accept: { "application/octet-stream": [".pdxpixel"] } };

export function PixelBoard() {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const overviewRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const selectMenuRef = useRef<HTMLDivElement>(null);
  const floatMenuRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const seed = useRef<TabLive | null>(null);
  if (!seed.current) seed.current = makeTab(64);
  const tabsRef = useRef<TabLive[]>([seed.current]);
  const activeIdRef = useRef(seed.current.id);
  const pixelsRef = useRef<Uint8ClampedArray>(seed.current.pixels);
  const histories = useRef(new Map<string, DocHistory>());
  const sizeRef = useRef<number>(64);
  const heightRef = useRef<number>(64);
  const spanRef = useRef<PixelGrid>({ width: 64, height: 64 });
  const readyRef = useRef(false);
  const toolRef = useRef<PixelTool>("pen");
  const colorRef = useRef<ColorPick>(pixelInk.color);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const strokePoints = useRef<{ x: number; y: number }[]>([]);
  const strokeBefore = useRef<Uint8ClampedArray | null>(null);
  const askRef = useRef<PixelAsk | null>(null);
  const saveTimer = useRef(0);
  const alphaEditRef = useRef(false);
  const alphaStepRef = useRef<number>(50);
  const alphaOnRef = useRef(true);
  const alphaUsedRef = useRef(false);
  const extractedRef = useRef(false);
  const usedRef = useRef<PixelColor[]>([]);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const panDrag = useRef<{ id: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const [size, setSize] = useState(64);
  const [height, setHeight] = useState(64);
  const [canvasSize, setCanvasSize] = useState<CanvasLive | null>(null);
  const [canvasDraft, setCanvasDraft] = useState<CanvasDraft | null>(null);
  const [trim, setTrim] = useState<TrimLive | null>(null);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<PixelTool>("pen");
  const [colorId, setColorId] = useState<ColorPick>(pixelInk.color);
  const [drops, setDrops] = useState<ColorPick[]>(pixelInk.drops);
  const [grid, setGrid] = useState(true);
  const [perfect, setPerfect] = useState(false);
  const perfectRef = useRef(false);
  const [backdrop, setBackdrop] = useState<PixelBackdrop>("checker");
  const [zoomPick, setZoomPick] = useState<number | null>(pixelView.zoom);
  const [pan, setPan] = useState({ x: pixelView.panX, y: pixelView.panY });
  const [dockPx, setDockPx] = useState<number | null>(pixelView.dock);
  const [panning, setPanning] = useState(false);
  const [gifOver, setGifOver] = useState(false);
  const gifTake = useRef(Promise.resolve());
  const [space, setSpace] = useState(0);
  const [followBox, setFollowBox] = useState({ stageW: 0, stageH: 0, selectW: 0, selectH: 0, floatW: 0, floatH: 0 });
  const spaceRef = useRef(0);
  spaceRef.current = space;
  const [rev, setRev] = useState(0);
  const [ask, setAsk] = useState<PixelAsk | null>(null);
  const [sheet, setSheet] = useState<{ id: string; name: string }[]>([{ id: seed.current.id, name: seed.current.name }]);
  const [activeId, setActiveId] = useState(seed.current.id);
  const [alphaEdit, setAlphaEdit] = useState(false);
  const [alphaStep, setAlphaStep] = useState(50);
  const [alphaOn, setAlphaOn] = useState(true);
  const [alphaUsed, setAlphaUsed] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [used, setUsed] = useState<PixelColor[]>([]);
  const [selection, setSelection] = useState<PixelSelection | null>(null);
  const [selectKind, setSelectKind] = useState<"rect" | "lasso" | "wand" | "color">("rect");
  const [shapeOpen, setShapeOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [lassoDraft, setLassoDraft] = useState<{ x: number; y: number }[] | null>(null);
  const [gradLine, setGradLine] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [symmetry, setSymmetry] = useState<SymmetryAxis | null>(null);
  const [symmetryDraft, setSymmetryDraft] = useState<SymmetryAxis | null>(null);
  const [moveArmed, setMoveArmed] = useState(false);
  const [clip, setClip] = useState<PixelClip | null>(pixelClipboard.clip);
  const [paste, setPaste] = useState<{ x: number; y: number } | null>(null);
  const [floatMove, setFloatMove] = useState<FloatLive | null>(null);
  const [warp, setWarp] = useState<WarpLive | null>(null);
  const [warpText, setWarpText] = useState<{ field: string; text: string } | null>(null);
  const [tabOver, setTabOver] = useState<string | null>(null);
  const [tabMenu, setTabMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [layerRows, setLayerRows] = useState<LayerRow[]>(() => (seed.current?.layers ?? []).map((layer) => ({ id: layer.id, name: layer.name, visible: layer.visible, opacity: layer.opacity, kind: layer.kind })));
  const [activeLayerId, setActiveLayerId] = useState(seed.current.activeLayerId);
  const [layerWidth, setLayerWidth] = useState(pixelLayerWidth);
  const [guideSize, setGuideSize] = useState(1);
  const guideSizeRef = useRef(1);
  guideSizeRef.current = guideSize;
  const opacityDrag = useRef<{ id: string; armed: boolean } | null>(null);
  const [layerGap, setLayerGap] = useState<number | null>(null);
  const [layerDragId, setLayerDragId] = useState<string | null>(null);
  const [layerMenu, setLayerMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [tabRenameId, setTabRenameId] = useState<string | null>(null);
  const [opacityOpenId, setOpacityOpenId] = useState<string | null>(null);
  const [opacityPos, setOpacityPos] = useState<{ x: number; y: number } | null>(null);
  const renameIdRef = useRef<string | null>(null);
  renameIdRef.current = renameId;
  const layerWidthRef = useRef(pixelLayerWidth);
  layerWidthRef.current = layerWidth;
  const renameCancel = useRef(false);
  const swallowClickRef = useRef(false);
  const commitNameRef = useRef<(id: string, value: string) => void>(() => undefined);
  const layerDrag = useRef<{ id: string; y: number; moved: boolean; pointer: number } | null>(null);
  const moveRef = useRef<{ pointer: number; layerId: string; kind: "pixel" | "image"; x: number; y: number; dx: number; dy: number; plane: ImagePlane | null; peers: MovePeer[] } | null>(null);
  const multiRefRef = useRef<Set<string>>(new Set());
  const [multiRef, setMultiRef] = useState<string[]>([]);
  const [layerMoving, setLayerMoving] = useState(false);
  const suppressLayerClick = useRef(false);
  const layerListRef = useRef<HTMLDivElement>(null);
  const [histRev, setHistRev] = useState(0);
  const tabDrag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const tabOverRef = useRef<string | null>(null);
  const suppressTabClick = useRef(false);
  const tabRenameIdRef = useRef<string | null>(null);
  tabRenameIdRef.current = tabRenameId;
  const tabRenameCancel = useRef(false);
  const swallowTabClickRef = useRef(false);
  const commitTabNameRef = useRef<(id: string, value: string) => void>(() => undefined);
  const openTabRef = useRef<(id: string) => void>(() => undefined);
  const [sheetDraft, setSheetDraft] = useState<SheetDraft | null>(null);
  const [pack, setPack] = useState<{ cols: number; frames: { id: string; width: number; height: number; rgba: Uint8ClampedArray; durationMs: null; flipX: false; flipY: false }[] } | null>(null);
  const packHint = useRef(4);
  const sheetInput = useRef<HTMLInputElement>(null);
  const saveLock = useRef(false);
  const folderLock = useRef(false);
  const projectLock = useRef(false);
  const projectLinks = useRef(new Map<string, { name: string; handle: SaveHandle }>());
  const projectSaveRef = useRef<{ tabId: string; bytes: Uint8Array; name: string } | null>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  askRef.current = ask;
  toolRef.current = tool;
  colorRef.current = colorId;
  pixelInk.color = colorId;
  pixelInk.drops = drops;
  const dropsRef = useRef(drops);
  dropsRef.current = drops;
  const inkTouched = useRef(false);
  alphaEditRef.current = alphaEdit;
  perfectRef.current = perfect;
  alphaStepRef.current = alphaStep;
  alphaOnRef.current = alphaOn;
  alphaUsedRef.current = alphaUsed;
  extractedRef.current = extracted;
  usedRef.current = used;
  const zoomPickRef = useRef<number | null>(null);
  zoomPickRef.current = zoomPick;
  const zoom = zoomPick ?? fitPixelZoom(space, Math.max(size, height));
  zoomRef.current = zoom;
  panRef.current = pan;
  const selectionRef = useRef<PixelSelection | null>(null);
  selectionRef.current = selection;
  const selectKindRef = useRef<"rect" | "lasso" | "wand" | "color">("rect");
  selectKindRef.current = selectKind;
  const selectToolRef = useRef<HTMLButtonElement | null>(null);
  const selectKindMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectKindPos, setSelectKindPos] = useState<{ x: number; y: number } | null>(null);
  const selectMaskRef = useRef<HTMLCanvasElement>(null);
  const selectHistories = useRef(new Map<string, { undo: (PixelSelection | null)[]; redo: (PixelSelection | null)[] }>());
  const moveArmedRef = useRef(false);
  moveArmedRef.current = moveArmed;
  const pasteRef = useRef<{ x: number; y: number } | null>(null);
  pasteRef.current = paste;
  const floatMoveRef = useRef<FloatLive | null>(null);
  floatMoveRef.current = floatMove;
  const floatDrag = useRef<{ pointer: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const pasteDrag = useRef<{ pointer: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const warpRef = useRef<WarpLive | null>(null);
  warpRef.current = warp;
  const canvasRef = useRef<CanvasLive | null>(null);
  canvasRef.current = canvasSize;
  const canvasPreviewRef = useRef<HTMLCanvasElement | null>(null);
  const trimRef = useRef<TrimLive | null>(null);
  trimRef.current = trim;
  const dimHistories = useRef(new Map<string, { undo: CanvasDim[]; redo: CanvasDim[] }>());
  const warpDrag = useRef<{ pointer: number; kind: WarpHandle; cx: number; cy: number; scaleX: number; scaleY: number; degrees: number; startX: number; startY: number; lock: boolean } | null>(null);
  const selectDrag = useRef<
    | { kind: "new"; x: number; y: number; moved: boolean; pointer: number }
    | { kind: "lasso"; points: { x: number; y: number }[]; before: PixelSelection | null; moved: boolean; pointer: number }
    | { kind: "box"; x: number; y: number; origin: PixelSelection; pointer: number }
    | { kind: "pixels"; x: number; y: number; origin: PixelSelection; base: Uint8ClampedArray; pointer: number; plane?: ImagePlane }
    | null
  >(null);
  const gradDrag = useRef<{ x: number; y: number; x1: number; y1: number; pointer: number } | null>(null);
  const ellipseDrag = useRef<{ x: number; y: number; pointer: number; before: Uint8ClampedArray } | null>(null);
  const symmetryRef = useRef<SymmetryAxis | null>(null);
  const symmetryDrag = useRef<{ x: number; y: number; pointer: number; moved: boolean } | null>(null);
  const abandonEllipseRef = useRef<(repaint: boolean) => void>(() => undefined);

  const currentTab = () => tabsRef.current.find((tab) => tab.id === activeIdRef.current) ?? null;

  const activeImage = () => {
    const tab = currentTab();
    if (!tab) return null;
    const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
    return layer && layer.kind === "image" ? layer : null;
  };

  const replaceMultiRef = (ids: string[]) => {
    multiRefRef.current = new Set(ids);
    setMultiRef(ids);
  };

  const clearMultiRef = () => {
    if (multiRefRef.current.size === 0) return;
    replaceMultiRef([]);
  };

  const toggleMultiRef = (id: string) => {
    const tab = currentTab();
    if (!tab || id === tab.activeLayerId) return;
    if (!tab.layers.some((layer) => layer.id === id)) return;
    const next = new Set(multiRefRef.current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    replaceMultiRef([...next]);
  };

  const editTargets = (): PixelLayer[] => {
    const tab = currentTab();
    if (!tab) return [];
    const active = tab.layers.find((layer) => layer.id === tab.activeLayerId);
    const extra = tab.layers.filter((layer) => layer.id !== tab.activeLayerId && multiRefRef.current.has(layer.id));
    return active ? [active, ...extra] : extra;
  };

  const buffersDiffer = (left: Uint8ClampedArray, right: Uint8ClampedArray) => {
    if (left.length !== right.length) return true;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) return true;
    }
    return false;
  };

  const selectionSource = () => {
    const tab = currentTab();
    const image = activeImage();
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    const alone = image ? projectImagePlane(toPlane(image), widthNow, heightNow) : pixelsRef.current;
    if (!tab) return alone;
    const ids = new Set<string>([tab.activeLayerId]);
    for (const id of multiRefRef.current) ids.add(id);
    if (ids.size <= 1) return alone;
    const chosen = tab.layers.filter((layer) => ids.has(layer.id) && layer.visible);
    if (chosen.length <= 1) return alone;
    return compositePixelLayers(chosen, widthNow, heightNow, image ? null : { id: tab.activeLayerId, pixels: pixelsRef.current }, { guides: true });
  };

  const applyPlane = (layer: PixelLayer, plane: ImagePlane) => {
    layer.pixels = plane.pixels;
    layer.x = plane.x;
    layer.y = plane.y;
    layer.imgW = plane.width;
    layer.imgH = plane.height;
    layer.png = "";
    const tab = currentTab();
    if (tab) tab.pngDirty = true;
  };

  const layerSnap = (beforePixels: Uint8ClampedArray | null) => {
    const tab = currentTab();
    if (!tab) return [];
    const active = tab.activeLayerId;
    const activeLayer = tab.layers.find((entry) => entry.id === active);
    const useBefore = Boolean(beforePixels) && activeLayer?.kind !== "image";
    return tab.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      kind: layer.kind,
      x: layer.x,
      y: layer.y,
      imgW: layer.imgW,
      imgH: layer.imgH,
      pixels: new Uint8ClampedArray(useBefore && layer.id === active && beforePixels ? beforePixels : layer.pixels),
      rest: cloneRest(layer.rest),
    }));
  };

  const pixelPartial = (tab: TabLive | null) => {
    if (!tab) return hasPartialAlpha(pixelsRef.current);
    return tab.layers.some((layer) => layer.kind !== "image" && hasPartialAlpha(layer.id === tab.activeLayerId && layer.kind === "pixel" ? pixelsRef.current : layer.pixels));
  };

  const historyOf = (id: string) => {
    const found = histories.current.get(id);
    if (found) return found;
    const next: DocHistory = { undo: [], redo: [] };
    histories.current.set(id, next);
    return next;
  };

  const selectHistoryOf = (id: string) => {
    const found = selectHistories.current.get(id);
    if (found) return found;
    const next = { undo: [] as (PixelSelection | null)[], redo: [] as (PixelSelection | null)[] };
    selectHistories.current.set(id, next);
    return next;
  };

  const dimHistoryOf = (id: string) => {
    const found = dimHistories.current.get(id);
    if (found) return found;
    const next = { undo: [] as CanvasDim[], redo: [] as CanvasDim[] };
    dimHistories.current.set(id, next);
    return next;
  };

  const assignGrid = (width: number, height: number) => {
    sizeRef.current = width;
    heightRef.current = height;
    spanRef.current = { width, height };
    setSize(width);
    setHeight(height);
    const tab = currentTab();
    if (!tab) return;
    tab.width = width;
    tab.height = height;
    if (width === height && isPixelSize(width)) tab.size = width;
  };

  const syncLayers = () => {
    const tab = currentTab();
    if (!tab) {
      setLayerRows([]);
      setActiveLayerId("");
      return;
    }
    setActiveLayerId(tab.activeLayerId);
    setLayerRows(tab.layers.map((layer) => ({ id: layer.id, name: layer.name, visible: layer.visible, opacity: layer.opacity, kind: layer.kind })));
  };

  const bindActive = (next: Uint8ClampedArray) => {
    pixelsRef.current = next;
    const tab = currentTab();
    if (!tab) return;
    tab.pixels = next;
    const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
    if (layer && layer.kind !== "image") layer.pixels = next;
  };

  const layerVisible = () => {
    const tab = currentTab();
    if (!tab) return true;
    const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
    return !layer || layer.visible;
  };

  const denyHidden = () => {
    if (layerVisible()) return false;
    notify("このレイヤーは非表示です。目のアイコンで表示してから編集してください。");
    return true;
  };

  const stackView = () => {
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    const tab = currentTab();
    let override = pixelsRef.current;
    const warpNow = warpRef.current;
    if (warpNow && warpNow.tabId === activeIdRef.current && warpNow.base.length === widthNow * heightNow * 4) {
      override = warpPixels(warpNow.base, spanRef.current, warpNow.clip, warpNow.ox, warpNow.oy, warpNow, warpNow.scope === "selection" ? warpNow.beforeSelect : null).data;
    }
    const moving = moveRef.current;
    if (!tab || tab.layers.length === 0) return override;
    const activeLayer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
    const floatNow = floatMoveRef.current;
    let layers = tab.layers;
    if (floatNow && floatNow.base.length === widthNow * heightNow * 4) {
      const preview = new Uint8ClampedArray(floatNow.base);
      clearSelection(preview, spanRef.current, floatNow.beforeSelect, "rgba");
      stampPixelClip(preview, spanRef.current, floatNow.clip, floatNow.x, floatNow.y);
      const floatLayer = tab.layers.find((layer) => layer.id === floatNow.layerId);
      if (floatNow.image && floatLayer && floatLayer.kind === "image") {
        const source = toPlane(floatLayer);
        const shown = commitCanvasDiff(
          { ...source, pixels: new Uint8ClampedArray(source.pixels) },
          projectImagePlane(source, widthNow, heightNow),
          preview,
          widthNow,
          heightNow,
        );
        layers = tab.layers.map((layer) =>
          layer.id === floatLayer.id ? { ...layer, pixels: shown.pixels, x: shown.x, y: shown.y, imgW: shown.width, imgH: shown.height } : layer,
        );
      } else if (floatLayer && floatLayer.kind !== "image" && floatLayer.id === tab.activeLayerId) override = preview;
      else if (floatLayer && floatLayer.kind !== "image") {
        layers = tab.layers.map((layer) => (layer.id === floatLayer.id ? { ...layer, pixels: preview } : layer));
      }
    }
    if (moving && moving.layerId === tab.activeLayerId && moving.kind === "pixel" && moving.plane && activeLayer && activeLayer.kind !== "image" && !floatNow) {
      override = projectImagePlane({ ...moving.plane, x: moving.plane.x + moving.dx, y: moving.plane.y + moving.dy }, widthNow, heightNow);
    }
    if (floatNow?.peers.length) {
      const peerPreview = new Map<string, Uint8ClampedArray>();
      for (const peer of floatNow.peers) {
        const preview = new Uint8ClampedArray(peer.base);
        clearSelection(preview, spanRef.current, floatNow.beforeSelect, "rgba");
        stampPixelClip(preview, spanRef.current, peer.clip, floatNow.x, floatNow.y);
        peerPreview.set(peer.id, preview);
      }
      layers = layers.map((layer) => {
        const preview = peerPreview.get(layer.id);
        if (!preview) return layer;
        if (layer.kind === "image") return { ...layer, kind: "pixel" as const, pixels: preview };
        return { ...layer, pixels: preview };
      });
    }
    if (warpNow && warpNow.tabId === activeIdRef.current && warpNow.peers.length > 0) {
      const peerPreview = new Map<string, Uint8ClampedArray>();
      for (const peer of warpNow.peers) {
        let clip = warpNow.clip;
        let ox = warpNow.ox;
        let oy = warpNow.oy;
        if (warpNow.scope === "selection" && warpNow.beforeSelect) {
          const copied = copyPixelSelection(peer.base, spanRef.current, warpNow.beforeSelect);
          if (!copied) continue;
          clip = copied;
          const box = selectionBox(warpNow.beforeSelect);
          ox = box.x;
          oy = box.y;
        } else {
          const mask = new Uint8Array(widthNow * heightNow);
          mask.fill(1);
          clip = { w: widthNow, h: heightNow, rgba: peer.base, mask };
          ox = 0;
          oy = 0;
        }
        peerPreview.set(peer.id, warpPixels(peer.base, spanRef.current, clip, ox, oy, warpNow, warpNow.scope === "selection" ? warpNow.beforeSelect : null).data);
      }
      layers = layers.map((layer) => {
        const preview = peerPreview.get(layer.id);
        if (!preview) return layer;
        if (layer.kind === "image") return { ...layer, kind: "pixel" as const, pixels: preview };
        return { ...layer, pixels: preview };
      });
    }
    if (moving?.peers.length) {
      layers = layers.map((layer) => {
        const peer = moving.peers.find((entry) => entry.id === layer.id);
        if (!peer) return layer;
        if (peer.kind === "image") return { ...layer, x: layer.x + moving.dx, y: layer.y + moving.dy };
        if (!peer.plane) return layer;
        return { ...layer, pixels: projectImagePlane({ ...peer.plane, x: peer.plane.x + moving.dx, y: peer.plane.y + moving.dy }, widthNow, heightNow) };
      });
    }
    const pixelEdit = (!activeLayer || activeLayer.kind !== "image") && !(floatNow && floatNow.image);
    const shownLayers = moving && moving.kind === "image"
      ? layers.map((layer) => (layer.id === moving.layerId ? { ...layer, x: layer.x + moving.dx, y: layer.y + moving.dy } : layer))
      : layers;
    return compositePixelLayers(shownLayers, widthNow, heightNow, pixelEdit ? { id: tab.activeLayerId, pixels: override } : null);
  };

  const pushHistory = (beforePixels: Uint8ClampedArray, beforeSelect: PixelSelection | null) => {
    const id = activeIdRef.current;
    const tab = currentTab();
    if (!id || !tab) return;
    const hist = historyOf(id);
    const active = tab.activeLayerId;
    hist.undo.push({
      activeLayerId: active,
      origin: cloneOrigin(tab.origin),
      layers: layerSnap(beforePixels),
    });
    if (hist.undo.length > 40) hist.undo.shift();
    hist.redo = [];
    const dims = dimHistoryOf(id);
    dims.undo.push({ width: sizeRef.current, height: heightRef.current });
    if (dims.undo.length > 40) dims.undo.shift();
    dims.redo = [];
    const bag = selectHistoryOf(id);
    bag.undo.push(clonePixelSelection(beforeSelect));
    if (bag.undo.length > 40) bag.undo.shift();
    bag.redo = [];
    setHistRev((value) => value + 1);
  };

  const rememberEdit = () => {
    pushHistory(new Uint8ClampedArray(pixelsRef.current), selectionRef.current);
  };

  const applyHistory = (snap: DocSnap, select: PixelSelection | null | undefined, dim: CanvasDim) => {
    const tab = currentTab();
    if (!tab || snap.layers.length === 0) return;
    const keptVisible = new Map(tab.layers.map((layer) => [layer.id, layer.visible]));
    const layers: PixelLayer[] = snap.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: keptVisible.has(layer.id) ? keptVisible.get(layer.id)! : layer.visible,
      opacity: clampLayerOpacity(layer.opacity ?? 100),
      kind: layer.kind === "image" ? "image" : "pixel",
      x: layer.kind === "image" ? layer.x : 0,
      y: layer.kind === "image" ? layer.y : 0,
      imgW: layer.kind === "image" ? layer.imgW : dim.width,
      imgH: layer.kind === "image" ? layer.imgH : dim.height,
      pixels: new Uint8ClampedArray(layer.pixels),
      png: "",
      rest: layer.kind === "image" ? null : cloneRest(layer.rest),
      restPng: "",
    }));
    const active = layers.find((layer) => layer.id === snap.activeLayerId) ?? layers[0];
    const pixelTarget = active && active.kind !== "image" ? active : layers.find((layer) => layer.kind !== "image");
    if (!active || !pixelTarget || pixelTarget.pixels.length !== dim.width * dim.height * 4) return;
    if (active.kind === "image" && active.pixels.length !== active.imgW * active.imgH * 4) return;
    const previousActive = tab.activeLayerId;
    assignGrid(dim.width, dim.height);
    tab.layers = layers;
    tab.activeLayerId = active.id;
    tab.pixels = pixelTarget.pixels;
    pixelsRef.current = pixelTarget.pixels;
    tab.origin = cloneOrigin(snap.origin);
    tab.pngDirty = true;
    if (select !== undefined) rememberSelection(select);
    if (active.id !== previousActive) clearMultiRef();
    else {
      const live = new Set(layers.map((layer) => layer.id));
      const kept = [...multiRefRef.current].filter((id) => live.has(id) && id !== active.id);
      if (kept.length !== multiRefRef.current.size) replaceMultiRef(kept);
    }
    const partial = pixelPartial(tab);
    alphaUsedRef.current = partial;
    tab.alphaUsed = partial;
    setAlphaUsed(partial);
    if (extractedRef.current) refreshUsed();
    syncLayers();
    paint();
    scheduleSave();
    setHistRev((value) => value + 1);
  };

  const captureDoc = (): DocSnap | null => {
    const tab = currentTab();
    if (!tab) return null;
    const active = tab.activeLayerId;
    return {
      activeLayerId: active,
      origin: cloneOrigin(tab.origin),
      layers: layerSnap(null),
    };
  };

  const undoPixels = () => {
    if (warpRef.current || canvasRef.current || trimRef.current || floatMoveRef.current?.mode === "menu") return;
    abandonEllipseRef.current(true);
    symmetryDrag.current = null;
    setSymmetryDraft(null);
    if (pasteRef.current) cancelPaste();
    const id = activeIdRef.current;
    if (!id || !readyRef.current || askRef.current) return;
    const history = historyOf(id);
    if (history.undo.length === 0) return;
    const current = captureDoc();
    const prev = history.undo.pop();
    if (!current || !prev) return;
    history.redo.push(current);
    const dims = dimHistoryOf(id);
    const prevDim = dims.undo.pop() ?? { width: sizeRef.current, height: heightRef.current };
    dims.redo.push({ width: sizeRef.current, height: heightRef.current });
    const bag = selectHistoryOf(id);
    const prevSelect = bag.undo.length > 0 ? bag.undo.pop() : undefined;
    if (prevSelect !== undefined) bag.redo.push(clonePixelSelection(selectionRef.current));
    applyHistory(prev, prevSelect === undefined ? undefined : prevSelect, prevDim);
  };

  const redoPixels = () => {
    if (warpRef.current || canvasRef.current || trimRef.current || floatMoveRef.current?.mode === "menu") return;
    abandonEllipseRef.current(true);
    symmetryDrag.current = null;
    setSymmetryDraft(null);
    if (pasteRef.current) cancelPaste();
    const id = activeIdRef.current;
    if (!id || !readyRef.current || askRef.current) return;
    const history = historyOf(id);
    if (history.redo.length === 0) return;
    const current = captureDoc();
    const next = history.redo.pop();
    if (!current || !next) return;
    history.undo.push(current);
    const dims = dimHistoryOf(id);
    const nextDim = dims.redo.pop() ?? { width: sizeRef.current, height: heightRef.current };
    dims.undo.push({ width: sizeRef.current, height: heightRef.current });
    const bag = selectHistoryOf(id);
    const nextSelect = bag.redo.length > 0 ? bag.redo.pop() : undefined;
    if (nextSelect !== undefined) bag.undo.push(clonePixelSelection(selectionRef.current));
    applyHistory(next, nextSelect === undefined ? undefined : nextSelect, nextDim);
  };

  const syncSheet = () => {
    setSheet(tabsRef.current.map((tab) => ({ id: tab.id, name: tab.name })));
    setActiveId(activeIdRef.current);
  };

  const storeActive = () => {
    const tab = currentTab();
    if (!tab) return;
    const activeLayer = tab.layers.find((layer) => layer.id === tab.activeLayerId);
    if (activeLayer && activeLayer.kind !== "image") {
      tab.pixels = pixelsRef.current;
      activeLayer.pixels = pixelsRef.current;
    }
    tab.width = sizeRef.current;
    tab.height = heightRef.current;
    if (sizeRef.current === heightRef.current && isPixelSize(sizeRef.current)) tab.size = sizeRef.current;
    tab.alphaOn = alphaOnRef.current;
    const partial = pixelPartial(tab);
    tab.alphaUsed = partial;
    alphaUsedRef.current = partial;
    tab.extracted = extractedRef.current;
    tab.used = usedRef.current;
    tab.select = selectionRef.current;
    tab.symmetry = symmetryRef.current;
    tab.pngDirty = true;
  };

  const showTab = (tab: TabLive) => {
    if (floatMoveRef.current) {
      floatDrag.current = null;
      floatMoveRef.current = null;
      setFloatMove(null);
    }
    abandonEllipseRef.current(false);
    symmetryDrag.current = null;
    setSymmetryDraft(null);
    activeIdRef.current = tab.id;
    pixelsRef.current = tab.pixels;
    sizeRef.current = tab.width;
    heightRef.current = tab.height;
    spanRef.current = { width: tab.width, height: tab.height };
    alphaOnRef.current = tab.alphaOn;
    alphaUsedRef.current = tab.alphaUsed;
    extractedRef.current = tab.extracted;
    usedRef.current = tab.used;
    setSize(tab.width);
    setHeight(tab.height);
    setAlphaOn(tab.alphaOn);
    setAlphaUsed(tab.alphaUsed);
    setExtracted(tab.extracted);
    setUsed(tab.used);
    setAlphaEdit(false);
    alphaEditRef.current = false;
    selectionRef.current = tab.select;
    setSelection(tab.select);
    symmetryRef.current = tab.symmetry;
    setSymmetry(tab.symmetry);
    moveArmedRef.current = false;
    setMoveArmed(false);
    clearMultiRef();
    setActiveId(tab.id);
    syncLayers();
    setRev((value) => value + 1);
  };

  const paintOverview = (pixels: Uint8ClampedArray, viewW: number, viewH: number) => {
    const node = overviewRef.current;
    if (!node || viewW < 1 || viewH < 1 || pixels.length !== viewW * viewH * 4) return;
    if (node.width !== viewW) node.width = viewW;
    if (node.height !== viewH) node.height = viewH;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), viewW, viewH), 0, 0);
    const fit = integerPixelFit(256, 256, viewW, viewH);
    node.style.width = `${fit.width}px`;
    node.style.height = `${fit.height}px`;
  };

  const paint = () => {
    const canvas = viewRef.current;
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    const data = pixelsRef.current;
    if (!canvas || widthNow < 1 || heightNow < 1) return;
    const span = spanRef.current;
    const canvasNow = canvasRef.current;
    const preview = canvasNow && canvasNow.tabId === activeIdRef.current ? canvasPreviewFrame(canvasNow.width, canvasNow.height, canvasNow.nextW, canvasNow.nextH, canvasNow.ax, canvasNow.ay) : null;
    const viewW = preview ? preview.viewW : widthNow;
    const viewH = preview ? preview.viewH : heightNow;
    if (data.length !== widthNow * heightNow * 4 && !preview) return;
    if (canvas.width !== viewW || canvas.height !== viewH) {
      canvas.width = viewW;
      canvas.height = viewH;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (preview && canvasNow) {
      const shown = new Uint8ClampedArray(viewW * viewH * 4);
      const stack = stackView();
      for (let y = 0; y < canvasNow.height; y += 1) {
        const from = y * canvasNow.width * 4;
        const row = Math.min(stack.length - from, canvasNow.width * 4);
        if (row > 0) shown.set(stack.subarray(from, from + row), ((preview.oldY + y) * viewW + preview.oldX) * 4);
      }
      ctx.putImageData(new ImageData(shown, viewW, viewH), 0, 0);
      paintOverview(shown, viewW, viewH);
      return;
    }
    if (data.length !== widthNow * heightNow * 4) return;
    const stack = stackView();
    if (stack.length !== widthNow * heightNow * 4) return;
    const layered = currentTab();
    const guidesOn = layered?.layers.some((layer) => layer.kind === "image" && layer.visible) ?? false;
    const partial = pixelPartial(layered);
    const shown = guidesOn ? stack : alphaEditRef.current ? previewAlpha(stack, span) : partial && !alphaOnRef.current ? bakeOpaque(stack) : stack;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(shown), widthNow, heightNow), 0, 0);
    paintOverview(stack, widthNow, heightNow);
  };

  const abandonEllipse = (repaint: boolean) => {
    const drag = ellipseDrag.current;
    if (!drag) return;
    ellipseDrag.current = null;
    pixelsRef.current = drag.before;
    const tab = currentTab();
    if (tab) {
      tab.pixels = drag.before;
      const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
      if (layer) layer.pixels = drag.before;
    }
    if (repaint) paint();
    scheduleSave();
  };
  abandonEllipseRef.current = abandonEllipse;

  const persist = () => {
    if (!readyRef.current) return Promise.resolve();
    storeActive();
    const tabs = tabsRef.current.map((tab) => ({ ...tab }));
    const active = activeIdRef.current;
    const job = pixelTail.catch(() => undefined).then(async () => {
      const saved = [];
      for (const tab of tabs) {
        const live = tabsRef.current.find((entry) => entry.id === tab.id) ?? tab;
        if (live.pngDirty || !live.png || live.layers.some((layer) => !layer.png || (layer.rest != null && !layer.restPng))) {
          const layerSaved = [];
          for (const layer of live.layers) {
            if (layer.kind === "image") {
              const bytes = await encodeRgbaPng(layer.pixels, layer.imgW, layer.imgH);
              layer.png = bytes ? bytesToBase64(bytes) : "";
              layer.rest = null;
              layer.restPng = "";
            } else {
              const png = await encodePng(layer.pixels, live.width, live.height);
              if (png) layer.png = png;
              if (layer.rest && layer.rest.width > 0 && layer.rest.height > 0) {
                const restBytes = await encodeRgbaPng(layer.rest.pixels, layer.rest.width, layer.rest.height);
                layer.restPng = restBytes ? bytesToBase64(restBytes) : "";
              } else {
                layer.rest = null;
                layer.restPng = "";
              }
            }
            layerSaved.push({
              id: layer.id,
              name: layer.name,
              visible: layer.visible,
              opacity: layer.opacity,
              kind: layer.kind,
              x: layer.x,
              y: layer.y,
              imgW: layer.imgW,
              imgH: layer.imgH,
              png: layer.png,
              restX: layer.rest?.x ?? 0,
              restY: layer.rest?.y ?? 0,
              restW: layer.rest?.width ?? 0,
              restH: layer.rest?.height ?? 0,
              restPng: layer.restPng,
            });
          }
          const flat = compositePixelLayers(live.layers, live.width, live.height, null, { guides: false });
          const png = await encodePng(flat, live.width, live.height);
          if (png) {
            live.png = png;
            live.pngDirty = false;
          }
          saved.push({
            id: live.id,
            name: live.name,
            size: live.size,
            width: live.width,
            height: live.height,
            png: live.png,
            alphaOn: live.alphaOn,
            alphaUsed: live.alphaUsed,
            extracted: live.extracted,
            zoom: live.zoom,
            panX: live.panX,
            panY: live.panY,
            symmetry: live.symmetry,
            activeLayerId: live.activeLayerId,
            originId: live.origin?.id ?? null,
            originName: live.origin?.name ?? "",
            projectName: live.projectName,
            layers: layerSaved,
          });
          continue;
        }
        saved.push({
          id: live.id,
          name: live.name,
          size: live.size,
          width: live.width,
          height: live.height,
          png: live.png,
          alphaOn: live.alphaOn,
          alphaUsed: live.alphaUsed,
          extracted: live.extracted,
          zoom: live.zoom,
          panX: live.panX,
          panY: live.panY,
          symmetry: live.symmetry,
          activeLayerId: live.activeLayerId,
          originId: live.origin?.id ?? null,
          originName: live.origin?.name ?? "",
          projectName: live.projectName,
          layers: live.layers.map((layer) => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            kind: layer.kind,
            x: layer.x,
            y: layer.y,
            imgW: layer.imgW,
            imgH: layer.imgH,
            png: layer.png,
            restX: layer.rest?.x ?? 0,
            restY: layer.rest?.y ?? 0,
            restW: layer.rest?.width ?? 0,
            restH: layer.rest?.height ?? 0,
            restPng: layer.restPng,
          })),
        });
      }
      await writeKv(PIXEL_TABS_KEY, JSON.stringify({ active, tabs: saved }));
      const current = saved.find((tab) => tab.id === active) ?? saved[0];
      if (!current?.png) return;
      await writeKv(PIXEL_SIZE_KEY, String(current.size));
      await writeKv(PIXEL_PNG_KEY, current.png);
    });
    pixelTail = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const scheduleSave = () => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persistRef.current();
    }, 200);
  };

  useLayoutEffect(() => {
    paint();
  }, [size, height, rev, ready, alphaEdit, alphaOn, alphaUsed, canvasSize, trim, floatMove]);

  useEffect(() => {
    if (!canvasDraft) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setCanvasDraft(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canvasDraft]);

  useLayoutEffect(() => {
    if (tool !== "select") return;
    const place = () => {
      const anchor = selectToolRef.current;
      const menu = selectKindMenuRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const width = menu?.offsetWidth ?? 108;
      const height = menu?.offsetHeight ?? 132;
      const margin = 8;
      let x = rect.right + 4;
      let y = rect.top;
      if (x + width > window.innerWidth - margin) x = Math.max(margin, rect.left - width - 4);
      if (y + height > window.innerHeight - margin) y = Math.max(margin, window.innerHeight - margin - height);
      if (y < margin) y = margin;
      setSelectKindPos((current) => (current && Math.abs(current.x - x) < 0.5 && Math.abs(current.y - y) < 0.5 ? current : { x, y }));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [tool, shapeOpen]);

  useEffect(() => {
    if (!shapeOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".pixel-select-kinds")) return;
      if (target.closest("[data-pixel-tool='select']")) return;
      setShapeOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [shapeOpen]);

  useLayoutEffect(() => {
    const node = canvasPreviewRef.current;
    if (!node || !canvasDraft) return;
    const oldW = sizeRef.current;
    const oldH = heightRef.current;
    const nextW = canvasDraft.nextW;
    const nextH = canvasDraft.nextH;
    const frame = canvasPreviewFrame(oldW, oldH, nextW, nextH, canvasDraft.ax, canvasDraft.ay);
    const scale = Math.max(1, Math.min(8, Math.floor(240 / Math.max(frame.viewW, frame.viewH, 1))));
    node.width = Math.max(1, frame.viewW * scale);
    node.height = Math.max(1, frame.viewH * scale);
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, node.width, node.height);
    ctx.fillStyle = "#241c16";
    ctx.fillRect(0, 0, node.width, node.height);
    for (let y = 0; y < nextH; y += 1) {
      for (let x = 0; x < nextW; x += 1) {
        ctx.fillStyle = ((x + y) & 1) === 0 ? "#bdbdbd" : "#8e8e8e";
        ctx.fillRect((frame.nextX + x) * scale, (frame.nextY + y) * scale, scale, scale);
      }
    }
    const stack = stackView();
    if (stack.length >= oldW * oldH * 4 && oldW > 0 && oldH > 0) {
      const image = ctx.createImageData(oldW, oldH);
      image.data.set(stack.subarray(0, oldW * oldH * 4));
      const scratch = document.createElement("canvas");
      scratch.width = oldW;
      scratch.height = oldH;
      scratch.getContext("2d")?.putImageData(image, 0, 0);
      ctx.drawImage(scratch, frame.oldX * scale, frame.oldY * scale, oldW * scale, oldH * scale);
    }
    const left = Math.max(frame.oldX, frame.nextX);
    const top = Math.max(frame.oldY, frame.nextY);
    const right = Math.min(frame.oldX + oldW, frame.nextX + nextW);
    const bottom = Math.min(frame.oldY + oldH, frame.nextY + nextH);
    ctx.fillStyle = "rgba(255, 70, 70, 0.38)";
    const wash = (x: number, y: number, w: number, h: number) => {
      if (w > 0 && h > 0) ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
    };
    wash(frame.oldX, frame.oldY, oldW, Math.max(0, top - frame.oldY));
    wash(frame.oldX, bottom, oldW, Math.max(0, frame.oldY + oldH - bottom));
    wash(frame.oldX, top, Math.max(0, left - frame.oldX), Math.max(0, bottom - top));
    wash(right, top, Math.max(0, frame.oldX + oldW - right), Math.max(0, bottom - top));
    ctx.strokeStyle = "#7df0ff";
    ctx.lineWidth = 1;
    ctx.strokeRect(frame.nextX * scale + 0.5, frame.nextY * scale + 0.5, Math.max(1, nextW * scale - 1), Math.max(1, nextH * scale - 1));
  }, [canvasDraft, size, height, rev]);

  useLayoutEffect(() => {
    const node = selectMaskRef.current;
    if (!node) return;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    const scale = Math.max(1, zoom);
    const resizing = canvasSize && canvasSize.tabId === activeId ? canvasSize : null;
    const trimming = trim && trim.tabId === activeId ? trim : null;
    const preview = resizing ? canvasPreviewFrame(resizing.width, resizing.height, resizing.nextW, resizing.nextH, resizing.ax, resizing.ay) : null;
    const viewW = preview ? preview.viewW : size;
    const viewH = preview ? preview.viewH : height;
    const edgeW = viewW * scale;
    const edgeH = viewH * scale;
    if (node.width !== edgeW) node.width = edgeW;
    if (node.height !== edgeH) node.height = edgeH;
    ctx.clearRect(0, 0, edgeW, edgeH);
    ctx.lineWidth = scale <= 3 ? 1 : 2;
    ctx.strokeStyle = "#ffe14a";
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    const floatOutline = floatMove
      ? shiftPixelSelection(
          floatMove.beforeSelect,
          floatMove.x - (floatMove.clip.x ?? 0),
          floatMove.y - (floatMove.clip.y ?? 0),
          { width: size, height },
          { width: size, height },
        )
      : selection;
    const edges = (warp && warp.tabId === activeId) || resizing || trimming ? [] : selectionGridEdges(floatOutline, { width: size, height });
    if (edges.length > 0) {
      ctx.beginPath();
      for (const segment of edges) {
        ctx.moveTo(segment.x0 * scale, segment.y0 * scale);
        ctx.lineTo(segment.x1 * scale, segment.y1 * scale);
      }
      ctx.stroke();
    }
    if (lassoDraft && lassoDraft.length > 0) {
      ctx.beginPath();
      const first = lassoDraft[0];
      if (first) ctx.moveTo((first.x + 0.5) * scale, (first.y + 0.5) * scale);
      for (let index = 1; index < lassoDraft.length; index += 1) {
        const point = lassoDraft[index];
        if (point) ctx.lineTo((point.x + 0.5) * scale, (point.y + 0.5) * scale);
      }
      if (lassoDraft.length > 1 && first) ctx.lineTo((first.x + 0.5) * scale, (first.y + 0.5) * scale);
      ctx.stroke();
    }
    if (gradLine) {
      const cells = gradientSpanCells({ width: size, height }, gradLine.x0, gradLine.y0, gradLine.x1, gradLine.y1, selection);
      ctx.fillStyle = "rgba(255, 214, 0, 0.72)";
      for (const cell of cells) ctx.fillRect(cell.x * scale, cell.y * scale, scale, scale);
    }
    const guide = symmetryDraft ?? symmetry;
    if (guide) {
      const span = clipAxisLine(guide, { width: size, height });
      if (span) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([Math.max(3, scale), Math.max(2, Math.round(scale * 0.7))]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#2ee6ff";
        ctx.lineCap = "butt";
        ctx.moveTo(span.x0 * scale, span.y0 * scale);
        ctx.lineTo(span.x1 * scale, span.y1 * scale);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (paste && clip) {
      const preview = document.createElement("canvas");
      preview.width = clip.w;
      preview.height = clip.h;
      const pixels = preview.getContext("2d")?.createImageData(clip.w, clip.h);
      if (pixels) {
        for (let index = 0; index < clip.mask.length; index += 1) {
          if (clip.mask[index] !== 1) continue;
          pixels.data[index * 4] = clip.rgba[index * 4] ?? 0;
          pixels.data[index * 4 + 1] = clip.rgba[index * 4 + 1] ?? 0;
          pixels.data[index * 4 + 2] = clip.rgba[index * 4 + 2] ?? 0;
          pixels.data[index * 4 + 3] = clip.rgba[index * 4 + 3] ?? 0;
        }
        preview.getContext("2d")?.putImageData(pixels, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(preview, paste.x * scale, paste.y * scale, clip.w * scale, clip.h * scale);
      }
      const landed = pastedSelection(clip, paste.x, paste.y, { width: size, height });
      const outline = selectionGridEdges(landed, { width: size, height });
      if (outline.length > 0) {
        ctx.beginPath();
        ctx.setLineDash([Math.max(2, scale), Math.max(2, scale)]);
        ctx.strokeStyle = "#7dffb3";
        ctx.lineWidth = scale <= 3 ? 1 : 2;
        for (const segment of outline) {
          ctx.moveTo(segment.x0 * scale, segment.y0 * scale);
          ctx.lineTo(segment.x1 * scale, segment.y1 * scale);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (warp && warp.tabId === activeId) {
      const corners = warpCorners(warp.clip, warp);
      const handles = [
        corners[0]!,
        corners[1]!,
        corners[2]!,
        corners[3]!,
        { x: (corners[0]!.x + corners[1]!.x) / 2, y: (corners[0]!.y + corners[1]!.y) / 2 },
        { x: (corners[1]!.x + corners[2]!.x) / 2, y: (corners[1]!.y + corners[2]!.y) / 2 },
        { x: (corners[2]!.x + corners[3]!.x) / 2, y: (corners[2]!.y + corners[3]!.y) / 2 },
        { x: (corners[3]!.x + corners[0]!.x) / 2, y: (corners[3]!.y + corners[0]!.y) / 2 },
      ];
      ctx.beginPath();
      ctx.strokeStyle = "#7df0ff";
      ctx.lineWidth = 1;
      corners.forEach((corner, index) => {
        const x = corner.x * scale;
        const y = corner.y * scale;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "#7df0ff";
      for (const handle of handles) ctx.fillRect(handle.x * scale - 3, handle.y * scale - 3, 6, 6);
      const spins = warpRotateHandles(warp.clip, warp, 26 / Math.max(1, scale));
      ctx.strokeStyle = "#ffe14a";
      ctx.lineWidth = 2;
      for (const handle of spins) {
        ctx.beginPath();
        ctx.arc(handle.x * scale, handle.y * scale, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (resizing && preview) {
      ctx.fillStyle = "rgba(125, 240, 255, 0.18)";
      for (let y = 0; y < resizing.nextH; y += 1) {
        for (let x = 0; x < resizing.nextW; x += 1) {
          const ox = preview.nextX + x - preview.oldX;
          const oy = preview.nextY + y - preview.oldY;
          if (ox >= 0 && oy >= 0 && ox < resizing.width && oy < resizing.height) continue;
          ctx.fillRect((preview.nextX + x) * scale, (preview.nextY + y) * scale, scale, scale);
        }
      }
      ctx.fillStyle = "rgba(255, 70, 70, 0.38)";
      for (let y = 0; y < resizing.height; y += 1) {
        for (let x = 0; x < resizing.width; x += 1) {
          const nx = preview.oldX + x - preview.nextX;
          const ny = preview.oldY + y - preview.nextY;
          if (nx >= 0 && ny >= 0 && nx < resizing.nextW && ny < resizing.nextH) continue;
          ctx.fillRect((preview.oldX + x) * scale, (preview.oldY + y) * scale, scale, scale);
        }
      }
      ctx.strokeStyle = "#7df0ff";
      ctx.lineWidth = 1;
      ctx.strokeRect(preview.nextX * scale + 0.5, preview.nextY * scale + 0.5, Math.max(1, resizing.nextW * scale - 1), Math.max(1, resizing.nextH * scale - 1));
    }
    if (trimming) {
      const box = trimming.bounds;
      ctx.fillStyle = "rgba(255, 70, 70, 0.38)";
      if (box.top > 0) ctx.fillRect(0, 0, viewW * scale, box.top * scale);
      if (box.bottom > 0) ctx.fillRect(0, (box.y + box.h) * scale, viewW * scale, box.bottom * scale);
      if (box.left > 0) ctx.fillRect(0, box.y * scale, box.left * scale, box.h * scale);
      if (box.right > 0) ctx.fillRect((box.x + box.w) * scale, box.y * scale, box.right * scale, box.h * scale);
      ctx.strokeStyle = "#7df0ff";
      ctx.lineWidth = 1;
      ctx.strokeRect(box.x * scale + 0.5, box.y * scale + 0.5, Math.max(1, box.w * scale - 1), Math.max(1, box.h * scale - 1));
    }
  }, [selection, lassoDraft, gradLine, symmetry, symmetryDraft, paste, clip, warp, canvasSize, trim, activeId, size, height, zoom, floatMove]);

  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => {
      const next = Math.max(0, Math.min(node.clientWidth, node.clientHeight) - 32);
      setSpace((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const next = {
        stageW: stage.clientWidth,
        stageH: stage.clientHeight,
        selectW: selectMenuRef.current?.offsetWidth ?? 0,
        selectH: selectMenuRef.current?.offsetHeight ?? 0,
        floatW: floatMenuRef.current?.offsetWidth ?? 0,
        floatH: floatMenuRef.current?.offsetHeight ?? 0,
      };
      setFollowBox((current) =>
        current.stageW === next.stageW &&
        current.stageH === next.stageH &&
        current.selectW === next.selectW &&
        current.selectH === next.selectH &&
        current.floatW === next.floatW &&
        current.floatH === next.floatH
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const selectMenuOn = Boolean(selection && tool === "select" && !selecting && !paste && !warp && !(canvasSize && canvasSize.tabId === activeId) && !(trim && trim.tabId === activeId) && !floatMove);
  const floatMenuOn = floatMove?.mode === "menu";
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const next = {
      stageW: stage.clientWidth,
      stageH: stage.clientHeight,
      selectW: selectMenuRef.current?.offsetWidth ?? 0,
      selectH: selectMenuRef.current?.offsetHeight ?? 0,
      floatW: floatMenuRef.current?.offsetWidth ?? 0,
      floatH: floatMenuRef.current?.offsetHeight ?? 0,
    };
    setFollowBox((current) =>
      current.stageW === next.stageW &&
      current.stageH === next.stageH &&
      current.selectW === next.selectW &&
      current.selectH === next.selectH &&
      current.floatW === next.floatW &&
      current.floatH === next.floatH
        ? current
        : next,
    );
  }, [selectMenuOn, floatMenuOn, activeId, canvasSize, trim, selection, tool, selecting, paste, warp, floatMove]);

  useEffect(() => {
    pixelView.zoom = zoomPick;
    pixelView.panX = pan.x;
    pixelView.panY = pan.y;
    pixelView.dock = dockPx;
  }, [zoomPick, pan.x, pan.y, dockPx]);

  useEffect(() => {
    if (zoomPickRef.current !== null || space < 1) return;
    const fitted = fitPixelZoom(space, Math.max(sizeRef.current, heightRef.current));
    zoomPickRef.current = fitted;
    setZoomPick(fitted);
  }, [space]);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!readyRef.current || event.deltaY === 0) return;
      event.preventDefault();
      const current = zoomRef.current;
      const next = clampZoom(current + (event.deltaY < 0 ? 1 : -1));
      if (next === current) return;
      const stage = stageRef.current;
      if (stage) {
        const stageRect = stage.getBoundingClientRect();
        const centerX = stageRect.left + stageRect.width / 2;
        const centerY = stageRect.top + stageRect.height / 2;
        const oldW = sizeRef.current * current;
        const oldH = heightRef.current * current;
        const newW = sizeRef.current * next;
        const newH = heightRef.current * next;
        const originX = centerX - oldW / 2 + panRef.current.x;
        const originY = centerY - oldH / 2 + panRef.current.y;
        const panX = panAfterZoom(panRef.current.x, event.clientX, originX, oldW, newW, centerX);
        const panY = panAfterZoom(panRef.current.y, event.clientY, originY, oldH, newH, centerY);
        panRef.current = { x: panX, y: panY };
        setPan({ x: panX, y: panY });
      }
      zoomRef.current = next;
      zoomPickRef.current = next;
      setZoomPick(next);
      scheduleSave();
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    let alive = true;
    void recallPixel().then(async (saved) => {
      if (!alive) return;
      const loaded: TabLive[] = [];
      let active = "";
      let parsed: { active?: unknown; tabs?: unknown } | null = null;
      if (saved.tabsRaw) {
        try {
          const value = JSON.parse(saved.tabsRaw) as unknown;
          if (value && typeof value === "object") parsed = value as { active?: unknown; tabs?: unknown };
        } catch {
          parsed = null;
        }
      }
      const rows = parsed && Array.isArray(parsed.tabs) ? parsed.tabs : [];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const record = row as Partial<TabLive> & {
          png?: unknown;
          width?: unknown;
          height?: unknown;
          layers?: unknown;
          activeLayerId?: unknown;
          originId?: unknown;
          originName?: unknown;
          projectName?: unknown;
        };
        const size = typeof record.size === "number" && isPixelSize(record.size) ? record.size : 64;
        const width = clampCanvasEdge(typeof record.width === "number" ? record.width : size) ?? size;
        const height = clampCanvasEdge(typeof record.height === "number" ? record.height : size) ?? size;
        const name = typeof record.name === "string" && record.name.trim() ? record.name.trim().slice(0, 24) : nextTabName(loaded.map((tab) => tab.name));
        const layers: PixelLayer[] = [];
        if (Array.isArray(record.layers)) {
          for (const entry of record.layers) {
            if (!entry || typeof entry !== "object") continue;
            const layer = entry as {
              id?: unknown;
              name?: unknown;
              visible?: unknown;
              png?: unknown;
              opacity?: unknown;
              kind?: unknown;
              x?: unknown;
              y?: unknown;
              imgW?: unknown;
              imgH?: unknown;
              restX?: unknown;
              restY?: unknown;
              restW?: unknown;
              restH?: unknown;
              restPng?: unknown;
            };
            const png = typeof layer.png === "string" ? layer.png : "";
            const kind: PixelLayerKind = layer.kind === "image" ? "image" : "pixel";
            const opacity = clampLayerOpacity(typeof layer.opacity === "number" ? layer.opacity : 100);
            const layerName = typeof layer.name === "string" && layer.name.trim() ? layer.name.trim().slice(0, 24) : nextPixelLayerName(layers.map((item) => item.name));
            if (kind === "image") {
              const imgW = typeof layer.imgW === "number" && layer.imgW > 0 && layer.imgW <= IMAGE_PLANE_MAX ? Math.round(layer.imgW) : 0;
              const imgH = typeof layer.imgH === "number" && layer.imgH > 0 && layer.imgH <= IMAGE_PLANE_MAX ? Math.round(layer.imgH) : 0;
              if (imgW < 1 || imgH < 1) continue;
              let data = createPixels(imgW, imgH);
              const bytes = png ? base64ToBytes(png) : null;
              if (bytes) {
                const decoded = await decodeRgbaPng(bytes);
                if (!alive) return;
                if (decoded && decoded.width === imgW && decoded.height === imgH) data = decoded.rgba;
              }
              layers.push({
                id: typeof layer.id === "string" && layer.id ? layer.id : layerId(),
                name: layerName,
                visible: layer.visible !== false,
                opacity,
                kind,
                x: typeof layer.x === "number" && Number.isFinite(layer.x) ? Math.round(layer.x) : 0,
                y: typeof layer.y === "number" && Number.isFinite(layer.y) ? Math.round(layer.y) : 0,
                imgW,
                imgH,
                pixels: data,
                png,
                rest: null,
                restPng: "",
              });
              continue;
            }
            let data = createPixels(width, height);
            if (png) {
              const decoded = await decodePng(png, width, height);
              if (!alive) return;
              if (decoded && decoded.length === width * height * 4) data = decoded;
            }
            const restW = typeof layer.restW === "number" && layer.restW > 0 && layer.restW <= 8192 ? Math.round(layer.restW) : 0;
            const restH = typeof layer.restH === "number" && layer.restH > 0 && layer.restH <= 8192 ? Math.round(layer.restH) : 0;
            const restPng = typeof layer.restPng === "string" ? layer.restPng : "";
            let rest: ImagePlane | null = null;
            if (restW >= 1 && restH >= 1 && restPng) {
              const restBytes = base64ToBytes(restPng);
              if (restBytes) {
                const decodedRest = await decodeRgbaPng(restBytes);
                if (!alive) return;
                if (decodedRest && decodedRest.width === restW && decodedRest.height === restH) {
                  rest = {
                    x: typeof layer.restX === "number" && Number.isFinite(layer.restX) ? Math.round(layer.restX) : 0,
                    y: typeof layer.restY === "number" && Number.isFinite(layer.restY) ? Math.round(layer.restY) : 0,
                    width: restW,
                    height: restH,
                    pixels: decodedRest.rgba,
                  };
                }
              }
            }
            layers.push({
              id: typeof layer.id === "string" && layer.id ? layer.id : layerId(),
              name: layerName,
              visible: layer.visible !== false,
              opacity,
              kind: "pixel",
              x: 0,
              y: 0,
              imgW: width,
              imgH: height,
              pixels: data,
              png,
              rest,
              restPng: rest ? restPng : "",
            });
          }
        }
        if (layers.length === 0) {
          let data = createPixels(width, height);
          const png = typeof record.png === "string" ? record.png : "";
          if (png) {
            const decoded = await decodePng(png, width, height);
            if (!alive) return;
            if (decoded && decoded.length === width * height * 4) data = decoded;
          }
          const solo = soloLayers(data);
          solo.layers[0]!.png = png;
          layers.push(solo.layers[0]!);
        }
        if (!layers.some((layer) => layer.kind !== "image")) layers.push(makeLayer(width, height));
        const activeLayer = layers.find((layer) => layer.id === record.activeLayerId) ?? layers[0]!;
        const pixelTarget = activeLayer.kind !== "image" ? activeLayer : (layers.find((layer) => layer.kind !== "image") ?? activeLayer);
        const data = pixelTarget.pixels;
        const art = layers.filter((layer) => layer.kind !== "image");
        const extracted = record.extracted === true || art.some((layer) => usesOffCube(layer.pixels));
        const alphaUsed = record.alphaUsed === true || art.some((layer) => hasPartialAlpha(layer.pixels));
        const originName = typeof record.originName === "string" ? record.originName.trim() : "";
        const originId = typeof record.originId === "string" && record.originId ? record.originId : null;
        loaded.push({
          id: typeof record.id === "string" && record.id ? record.id : `pix-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9)}`,
          name,
          size,
          width,
          height,
          pixels: data,
          layers,
          activeLayerId: activeLayer.id,
          alphaOn: record.alphaOn !== false,
          alphaUsed,
          extracted,
          used: extracted ? collectUsedColors(compositePixelLayers(layers, width, height, null, { guides: false }), { width, height }) : [],
          color: PIXEL_DEFAULT_INDEX,
          zoom: typeof record.zoom === "number" ? clampZoom(record.zoom) : null,
          panX: typeof record.panX === "number" && Number.isFinite(record.panX) ? record.panX : 0,
          panY: typeof record.panY === "number" && Number.isFinite(record.panY) ? record.panY : 0,
          png: typeof record.png === "string" ? record.png : "",
          pngDirty: false,
          select: null,
          symmetry: symmetryAxisOf(record.symmetry),
          origin: originName || originId ? { id: originId, name: originName } : null,
          projectName: typeof record.projectName === "string" ? record.projectName.replace(/[/\\]/g, "").slice(0, 120) : "",
        });
      }
      if (loaded.length === 0) {
        let data = createPixels(saved.size);
        if (saved.png) {
          const decoded = await decodePng(saved.png, saved.size);
          if (!alive) return;
          if (decoded && decoded.length === saved.size * saved.size * 4) data = decoded;
        }
        const extracted = usesOffCube(data);
        const alphaUsed = hasPartialAlpha(data);
        const tab = makeTab(saved.size);
        tab.name = "キャンバス1";
        const solo = soloLayers(data);
        solo.layers[0]!.png = saved.png;
        tab.layers = solo.layers;
        tab.activeLayerId = solo.activeLayerId;
        tab.pixels = data;
        tab.extracted = extracted;
        tab.used = extracted ? collectUsedColors(data, saved.size) : [];
        tab.alphaUsed = alphaUsed;
        tab.alphaOn = true;
        tab.png = saved.png;
        tab.pngDirty = false;
        loaded.push(tab);
      }
      if (!alive) return;
      active = typeof parsed?.active === "string" && loaded.some((tab) => tab.id === parsed?.active) ? parsed.active : (loaded[0]?.id ?? "");
      tabsRef.current = loaded;
      const first = loaded.find((tab) => tab.id === active) ?? loaded[0];
      if (!first) return;
      readyRef.current = true;
      setBackdrop(saved.backdrop);
      setReady(true);
      showTab(first);
      if (!pixelInkLoaded && !inkTouched.current) {
        const ink = parsePixelInk(saved.inkRaw);
        if (ink.color) {
          colorRef.current = ink.color;
          pixelInk.color = ink.color;
          setColorId(ink.color);
        }
        if (ink.drops.length > 0) {
          dropsRef.current = ink.drops;
          pixelInk.drops = ink.drops;
          setDrops(ink.drops);
        }
      }
      pixelInkLoaded = true;
      if (inkTouched.current) flushPixelInk();
      syncSheet();
    });
    return () => {
      alive = false;
      window.clearTimeout(saveTimer.current);
      void persistRef.current();
      flushPixelInk();
    };
  }, []);

  const activeColor = (): PixelColor => {
    if (toolRef.current === "eraser" || colorRef.current === "clear") return PIXEL_CLEAR;
    if (isRgbPick(colorRef.current)) return { r: colorRef.current.r, g: colorRef.current.g, b: colorRef.current.b, a: 255 };
    return PIXEL_PALETTE[colorRef.current] ?? PIXEL_PALETTE[PIXEL_DEFAULT_INDEX]!;
  };

  const ellipseInk = () => {
    if (alphaEditRef.current) return { mode: "alpha" as const, alpha: alphaByte(alphaStepRef.current) };
    return { mode: "rgba" as const, color: activeColor() };
  };

  const previewEllipse = (x1: number, y1: number) => {
    const drag = ellipseDrag.current;
    if (!drag) return;
    const next = new Uint8ClampedArray(drag.before);
    paintEllipse(next, spanRef.current, drag.x, drag.y, x1, y1, ellipseInk(), selectionRef.current);
    pixelsRef.current = next;
    const tab = currentTab();
    if (tab) tab.pixels = next;
    paint();
  };

  const noteUsed = (color: PixelColor) => {
    if (!extractedRef.current || color.a <= 0) return;
    const next = rememberColor(usedRef.current, color);
    if (next.length === usedRef.current.length) return;
    usedRef.current = next;
    const tab = currentTab();
    if (tab) tab.used = next;
    setUsed(next);
  };

  const noteAlpha = () => {
    if (alphaUsedRef.current) return;
    alphaUsedRef.current = true;
    alphaOnRef.current = true;
    const tab = currentTab();
    if (tab) {
      tab.alphaUsed = true;
      tab.alphaOn = true;
    }
    setAlphaUsed(true);
    setAlphaOn(true);
  };

  const stamp = (x: number, y: number) => {
    const span = spanRef.current;
    const selected = selectionRef.current;
    const image = activeImage();
    if (image) {
      const color = toolRef.current === "eraser" || colorRef.current === "clear" ? PIXEL_CLEAR : activeColor();
      const ink = color.a <= 0 ? PIXEL_CLEAR : { r: color.r, g: color.g, b: color.b, a: 255 };
      applyPlane(image, stampGuideBrush(toPlane(image), x, y, ink, guideSizeRef.current, sizeRef.current, heightRef.current, selected));
      return;
    }
    if (selected && !selectionHas(selected, x, y, span)) return;
    if (alphaEditRef.current) {
      const alpha = toolRef.current === "eraser" ? 255 : alphaByte(alphaStepRef.current);
      if (writeAlpha(pixelsRef.current, spanRef.current, x, y, alpha) && alpha < 255) noteAlpha();
      return;
    }
    const color = activeColor();
    if (color.a <= 0) writePixel(pixelsRef.current, spanRef.current, x, y, PIXEL_CLEAR);
    else writeRgb(pixelsRef.current, spanRef.current, x, y, color);
    noteUsed(color);
  };

  const drawDot = (x: number, y: number) => {
    if (activeImage()) {
      stamp(x, y);
      return;
    }
    const mirroring = symmetryRef.current && (toolRef.current === "pen" || toolRef.current === "eraser");
    if (mirroring) {
      drawMirroredDot(x, y);
      return;
    }
    const before = strokeBefore.current;
    if (before && perfectRef.current && toolRef.current === "pen") {
      commitPerfectPixel(strokePoints.current, pixelsRef.current, before, spanRef.current, { x, y }, stamp);
      return;
    }
    stamp(x, y);
  };

  const drawMirroredDot = (x: number, y: number) => {
    const before = strokeBefore.current;
    const axis = symmetryRef.current;
    if (!before || !axis) {
      stamp(x, y);
      return;
    }
    if (perfectRef.current && toolRef.current === "pen") notePerfectStep(strokePoints.current, { x, y });
    else {
      const prev = strokePoints.current[strokePoints.current.length - 1];
      if (!prev || prev.x !== x || prev.y !== y) strokePoints.current.push({ x, y });
    }
    const data = pixelsRef.current;
    if (data.length !== before.length) return;
    data.set(before);
    const tab = currentTab();
    if (tab) tab.pixels = data;
    const span = spanRef.current;
    const sel = selectionRef.current;
    const cells = symmetricStampCells(strokePoints.current, axis, span, sel ? (px, py) => selectionHas(sel, px, py, span) : null);
    for (const cell of cells) stamp(cell.x, cell.y);
  };

  const refreshUsed = () => {
    if (!extractedRef.current) return;
    const tab = currentTab();
    const span = spanRef.current;
    const flat = tab
      ? compositePixelLayers(tab.layers, sizeRef.current, heightRef.current, activeImage() ? null : { id: tab.activeLayerId, pixels: pixelsRef.current }, { guides: false })
      : pixelsRef.current;
    const colors = collectUsedColors(flat, span);
    usedRef.current = colors;
    if (tab) tab.used = colors;
    setUsed(colors);
  };

  const rememberSelection = (next: PixelSelection | null) => {
    selectionRef.current = next;
    const tab = currentTab();
    if (tab) tab.select = next;
    setSelection(next);
  };

  const applySelectDrag = (
    drag: NonNullable<(typeof selectDrag)["current"]>,
    cell: { x: number; y: number },
  ) => {
    const span = spanRef.current;
    if (drag.kind === "new") {
      drag.moved = true;
      const rect = pixelRect(drag.x, drag.y, cell.x, cell.y, span);
      rememberSelection(rect ? { kind: "rect", rect } : null);
      return;
    }
    if (drag.kind === "lasso") {
      const last = drag.points[drag.points.length - 1];
      if (!last || (last.x === cell.x && last.y === cell.y)) return;
      const line = bresenham(last.x, last.y, cell.x, cell.y);
      for (let index = 1; index < line.length; index += 1) {
        const point = line[index];
        if (point) drag.points.push(point);
      }
      drag.moved = true;
      setLassoDraft(drag.points.slice());
      return;
    }
    if (drag.kind === "box") {
      const dx = cell.x - drag.x;
      const dy = cell.y - drag.y;
      if (drag.origin.kind === "rect") rememberSelection({ kind: "rect", rect: slideRect(drag.origin.rect, dx, dy, span) });
      else rememberSelection(slideLasso(drag.origin, dx, dy, span));
      return;
    }
    const dx = cell.x - drag.x;
    const dy = cell.y - drag.y;
    if (drag.plane) {
      const image = activeImage();
      if (!image) return;
      const moved = moveImageSelection(drag.plane, drag.origin, dx, dy, sizeRef.current, heightRef.current);
      applyPlane(image, moved.plane);
      rememberSelection(moved.selection);
      paint();
      return;
    }
    const preview = new Uint8ClampedArray(drag.base);
    const next = moveSelectionPixels(preview, span, drag.origin, dx, dy, alphaEditRef.current ? "alpha" : "rgba");
    pixelsRef.current = preview;
    rememberSelection(next);
    paint();
  };

  const finishSelect = (pointerId: number) => {
    const drag = selectDrag.current;
    if (!drag || drag.pointer !== pointerId) return false;
    selectDrag.current = null;
    setSelecting(false);
    if (drag.kind === "lasso") {
      setLassoDraft(null);
      const next = drag.moved ? lassoMask(drag.points, spanRef.current) : null;
      if (drag.moved || drag.before) pushHistory(new Uint8ClampedArray(pixelsRef.current), drag.before);
      rememberSelection(next);
      return true;
    }
    if (drag.kind === "new" && !drag.moved) {
      rememberSelection(null);
      return true;
    }
    if (drag.kind === "pixels") {
      moveArmedRef.current = false;
      setMoveArmed(false);
      const image = drag.plane ? activeImage() : null;
      if (drag.plane && image) {
        const after = toPlane(image);
        const sameGrid = after.x === drag.plane.x && after.y === drag.plane.y && after.width === drag.plane.width && after.height === drag.plane.height && after.pixels.length === drag.plane.pixels.length;
        let changed = !sameGrid;
        if (!changed) {
          for (let index = 0; index < after.pixels.length; index += 1) {
            if (after.pixels[index] !== drag.plane.pixels[index]) {
              changed = true;
              break;
            }
          }
        }
        if (changed) {
          applyPlane(image, drag.plane);
          pushHistory(new Uint8ClampedArray(pixelsRef.current), drag.origin);
          applyPlane(image, after);
        }
        const tab = currentTab();
        if (tab) tab.pngDirty = true;
        paint();
        scheduleSave();
        return true;
      }
      const tab = currentTab();
      let changed = false;
      const before = drag.base;
      const after = pixelsRef.current;
      if (before.length === after.length) {
        for (let index = 0; index < before.length; index += 1) {
          if (before[index] !== after[index]) {
            changed = true;
            break;
          }
        }
      }
      if (changed) pushHistory(before, drag.origin);
      if (tab) {
        tab.pixels = pixelsRef.current;
        const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
        if (layer) layer.pixels = pixelsRef.current;
        tab.select = selectionRef.current;
        tab.pngDirty = true;
      }
      if (!alphaEditRef.current) refreshUsed();
      else {
        const partial = hasPartialAlpha(pixelsRef.current);
        alphaUsedRef.current = partial;
        if (tab) tab.alphaUsed = partial;
        setAlphaUsed(partial);
      }
      scheduleSave();
      return true;
    }
    const tab = currentTab();
    if (tab) tab.select = selectionRef.current;
    return true;
  };

  const chooseColor = (pick: ColorPick) => {
    inkTouched.current = true;
    colorRef.current = pick;
    pixelInk.color = pick;
    setColorId(pick);
    schedulePixelInk();
  };

  const noteDrop = (pick: ColorPick) => {
    const next = rememberDrop(dropsRef.current, pick);
    dropsRef.current = next;
    pixelInk.drops = next;
    setDrops(next);
    schedulePixelInk();
  };

  const sampleAt = (cell: { x: number; y: number }) => {
    const pixel = readPixel(stackView(), spanRef.current, cell.x, cell.y);
    if (alphaEditRef.current) {
      const step = nearestAlphaPercent(pixel.a);
      if (step != null) setAlphaStep(step);
      return;
    }
    const pick: ColorPick = pixel.a <= 0 ? "clear" : (paletteIndex(pixel) ?? { r: pixel.r, g: pixel.g, b: pixel.b });
    chooseColor(pick);
    noteDrop(pick);
  };

  const editImageView = (mutate: (data: Uint8ClampedArray) => void) => {
    const image = activeImage();
    if (!image) return false;
    const width = sizeRef.current;
    const height = heightRef.current;
    const before = projectImagePlane(toPlane(image), width, height);
    const after = new Uint8ClampedArray(before);
    mutate(after);
    let changed = false;
    for (let index = 0; index < before.length; index += 1) {
      if (before[index] !== after[index]) {
        changed = true;
        break;
      }
    }
    if (!changed) return true;
    rememberEdit();
    applyPlane(image, commitCanvasDiff(toPlane(image), before, after, width, height));
    paint();
    scheduleSave();
    return true;
  };

  const copyPixels = () => {
    const selectionNow = selectionRef.current;
    if (!selectionNow) return;
    const image = activeImage();
    const data = image ? projectImagePlane(toPlane(image), sizeRef.current, heightRef.current) : pixelsRef.current;
    const next = copyPixelSelection(data, spanRef.current, selectionNow);
    if (!next) return;
    pixelClipboard.clip = next;
    setClip(next);
  };

  const cutPixels = () => {
    if (denyHidden()) return;
    const selectionNow = selectionRef.current;
    if (!selectionNow) return;
    const image = activeImage();
    const source = image ? projectImagePlane(toPlane(image), sizeRef.current, heightRef.current) : pixelsRef.current;
    const next = copyPixelSelection(source, spanRef.current, selectionNow);
    if (!next) return;
    pixelClipboard.clip = next;
    setClip(next);
    clearTargetsSelection(selectionNow);
  };

  const pasteHome = (nextClip: PixelClip) => {
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    const rawX = typeof nextClip.x === "number" ? nextClip.x : Math.round((widthNow - nextClip.w) / 2);
    const rawY = typeof nextClip.y === "number" ? nextClip.y : Math.round((heightNow - nextClip.h) / 2);
    return {
      x: Math.max(-nextClip.w + 1, Math.min(widthNow - 1, rawX)),
      y: Math.max(-nextClip.h + 1, Math.min(heightNow - 1, rawY)),
    };
  };

  const beginPaste = () => {
    if (floatMoveRef.current || pasteRef.current || warpRef.current || canvasRef.current || trimRef.current) return;
    if (denyHidden()) return;
    const nextClip = pixelClipboard.clip;
    if (!nextClip) return;
    const next = pasteHome(nextClip);
    pasteRef.current = next;
    setPaste(next);
  };

  const cancelPaste = () => {
    pasteDrag.current = null;
    pasteRef.current = null;
    setPaste(null);
  };

  const endFloat = () => {
    floatDrag.current = null;
    floatMoveRef.current = null;
    setFloatMove(null);
  };

  const beginFloat = (mode: "menu" | "tool") => {
    if (floatMoveRef.current || pasteRef.current || warpRef.current || trimRef.current || canvasRef.current) return;
    const selectionNow = selectionRef.current;
    if (!selectionNow) return;
    if (denyHidden()) return;
    const tab = currentTab();
    const layer = tab?.layers.find((entry) => entry.id === tab.activeLayerId);
    if (!tab || !layer) return;
    const image = layer.kind === "image";
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    const base = image ? projectImagePlane(toPlane(layer), widthNow, heightNow) : new Uint8ClampedArray(pixelsRef.current);
    const clip = copyPixelSelection(base, spanRef.current, selectionNow);
    const beforeSelect = clonePixelSelection(selectionNow);
    if (!clip || !beforeSelect) return;
    moveArmedRef.current = false;
    setMoveArmed(false);
    const peers: FloatPeer[] = [];
    for (const other of editTargets()) {
      if (other.id === layer.id) continue;
      const otherImage = other.kind === "image";
      const otherBase = otherImage ? projectImagePlane(toPlane(other), widthNow, heightNow) : new Uint8ClampedArray(other.pixels);
      const otherClip = copyPixelSelection(otherBase, spanRef.current, selectionNow);
      if (!otherClip) continue;
      peers.push({ id: other.id, base: otherBase, clip: otherClip, image: otherImage, rest: otherImage ? null : cloneRest(other.rest) });
    }
    const next: FloatLive = { mode, layerId: layer.id, base, beforeSelect, clip, x: clip.x ?? 0, y: clip.y ?? 0, image, peers };
    floatMoveRef.current = next;
    setFloatMove(next);
    paint();
  };

  const commitFloatPeers = (float: FloatLive) => {
    const tab = currentTab();
    if (!tab || float.peers.length === 0) return false;
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    let wrote = false;
    for (const peer of float.peers) {
      const other = tab.layers.find((entry) => entry.id === peer.id);
      if (!other || other.id === float.layerId) continue;
      if (peer.image && other.kind === "image") {
        const after = new Uint8ClampedArray(peer.base);
        clearSelection(after, spanRef.current, float.beforeSelect, "rgba");
        stampPixelClip(after, spanRef.current, peer.clip, float.x, float.y);
        if (!buffersDiffer(peer.base, after)) continue;
        applyPlane(other, commitCanvasDiff(toPlane(other), peer.base, after, widthNow, heightNow));
        wrote = true;
        continue;
      }
      if (other.kind === "image") continue;
      const placed = commitFloatMove(peer.base, peer.rest, widthNow, heightNow, float.beforeSelect, peer.clip, float.x, float.y);
      other.pixels = placed.pixels;
      other.rest = placed.rest;
      other.restPng = "";
      other.png = "";
      wrote = true;
    }
    if (wrote) tab.pngDirty = true;
    return wrote;
  };

  const confirmFloat = () => {
    const float = floatMoveRef.current;
    if (!float) return;
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    const span = spanRef.current;
    const dx = float.x - (float.clip.x ?? 0);
    const dy = float.y - (float.clip.y ?? 0);
    const nextSelect = shiftPixelSelection(float.beforeSelect, dx, dy, span, span);
    const moved = dx !== 0 || dy !== 0;
    const tab = currentTab();
    const layer = tab?.layers.find((entry) => entry.id === float.layerId);
    if (!tab || !layer) {
      endFloat();
      return;
    }
    if (float.image) {
      if (layer.kind !== "image") {
        endFloat();
        return;
      }
      const plane = toPlane(layer);
      const aligned = plane.x === 0 && plane.y === 0 && plane.width === widthNow && plane.height === heightNow;
      const placed = commitFloatMove(float.base, aligned ? null : plane, widthNow, heightNow, float.beforeSelect, float.clip, float.x, float.y);
      const nextPlane = placed.rest ?? { x: 0, y: 0, width: widthNow, height: heightNow, pixels: placed.pixels };
      let changed = nextPlane.x !== plane.x || nextPlane.y !== plane.y || nextPlane.width !== plane.width || nextPlane.height !== plane.height || nextPlane.pixels.length !== plane.pixels.length;
      if (!changed) {
        for (let index = 0; index < nextPlane.pixels.length; index += 1) {
          if (nextPlane.pixels[index] !== plane.pixels[index]) {
            changed = true;
            break;
          }
        }
      }
      if (changed || moved) pushHistory(new Uint8ClampedArray(pixelsRef.current), float.beforeSelect);
      if (changed) applyPlane(layer, nextPlane);
      const peersWrote = changed || moved ? commitFloatPeers(float) : false;
      rememberSelection(nextSelect);
      endFloat();
      paint();
      if (changed || peersWrote) scheduleSave();
      return;
    }
    if (layer.kind === "image") {
      endFloat();
      return;
    }
    const placed = commitFloatMove(float.base, layer.rest, widthNow, heightNow, float.beforeSelect, float.clip, float.x, float.y);
    let changed = placed.pixels.length !== float.base.length;
    if (!changed) {
      for (let index = 0; index < placed.pixels.length; index += 1) {
        if (placed.pixels[index] !== float.base[index]) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) {
      const beforeRest = layer.rest;
      const afterRest = placed.rest;
      if (Boolean(beforeRest) !== Boolean(afterRest)) changed = true;
      else if (beforeRest && afterRest && (beforeRest.x !== afterRest.x || beforeRest.y !== afterRest.y || beforeRest.width !== afterRest.width || beforeRest.height !== afterRest.height || beforeRest.pixels.length !== afterRest.pixels.length)) changed = true;
      else if (beforeRest && afterRest) {
        for (let index = 0; index < afterRest.pixels.length; index += 1) {
          if (afterRest.pixels[index] !== beforeRest.pixels[index]) {
            changed = true;
            break;
          }
        }
      }
    }
    if (changed || moved) pushHistory(new Uint8ClampedArray(pixelsRef.current), float.beforeSelect);
    if (changed) {
      layer.pixels = placed.pixels;
      layer.rest = placed.rest;
      layer.restPng = "";
      layer.png = "";
      if (tab.activeLayerId === layer.id) {
        pixelsRef.current = placed.pixels;
        tab.pixels = placed.pixels;
      }
      tab.pngDirty = true;
    }
    const peersWrote = changed || moved ? commitFloatPeers(float) : false;
    rememberSelection(nextSelect);
    endFloat();
    const partial = tab.layers.some((entry) => hasPartialAlpha(entry.kind !== "image" && entry.id === tab.activeLayerId ? pixelsRef.current : entry.pixels));
    alphaUsedRef.current = partial;
    tab.alphaUsed = partial;
    setAlphaUsed(partial);
    if (!alphaEditRef.current) refreshUsed();
    paint();
    if (changed || peersWrote) scheduleSave();
  };
  const confirmFloatRef = useRef(confirmFloat);
  confirmFloatRef.current = confirmFloat;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const float = floatMoveRef.current;
      if (!float || float.mode !== "tool" || event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".pixel-frame") || target.closest(".pixel-select-menu")) return;
      const control = target.closest("button, input, select, textarea, a");
      if (!(control instanceof Element)) return;
      if (!control.closest(".pixel-pane, .pixel-select-kinds, .pixel-tab-menu, .pixel-layer-menu, .pixel-opacity-pop")) return;
      if (control.getAttribute("data-pixel-tool") === "move") return;
      confirmFloatRef.current();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, []);

  const cancelFloat = () => {
    const float = floatMoveRef.current;
    if (!float) return;
    rememberSelection(float.beforeSelect);
    endFloat();
    paint();
  };

  const grabFloat = (pointerId: number, clientX: number, clientY: number) => {
    const float = floatMoveRef.current;
    const canvas = viewRef.current;
    if (!float || !canvas) return false;
    const open = cellAtOpen(clientX, clientY, canvas, sizeRef.current, heightRef.current);
    if (!open || !clipHas(float.clip, float.x, float.y, open.x, open.y)) return false;
    try {
      canvas.setPointerCapture(pointerId);
    } catch {
      /* the drag still ends on pointerup */
    }
    floatDrag.current = { pointer: pointerId, x: open.x, y: open.y, ox: float.x, oy: float.y };
    return true;
  };

  const placeFloat = (x: number, y: number) => {
    const float = floatMoveRef.current;
    if (!float || (float.x === x && float.y === y)) return;
    const next = { ...float, x, y };
    floatMoveRef.current = next;
    setFloatMove(next);
    paint();
  };

  const confirmPaste = () => {
    const float = pasteRef.current;
    const nextClip = pixelClipboard.clip;
    if (!float || !nextClip) return;
    if (denyHidden()) return;
    if (activeImage()) {
      editImageView((data) => stampPixelClip(data, spanRef.current, nextClip, float.x, float.y, selectionRef.current));
      pasteDrag.current = null;
      pasteRef.current = null;
      setPaste(null);
      return;
    }
    pasteDrag.current = null;
    const span = spanRef.current;
    const before = new Uint8ClampedArray(pixelsRef.current);
    const beforeSelect = clonePixelSelection(selectionRef.current);
    const next = new Uint8ClampedArray(before);
    stampPixelClip(next, span, nextClip, float.x, float.y, selectionRef.current);
    let changed = false;
    for (let index = 0; index < next.length; index += 1) {
      if (next[index] !== before[index]) {
        changed = true;
        break;
      }
    }
    pasteRef.current = null;
    setPaste(null);
    if (!changed) return;
    pixelsRef.current = next;
    const tab = currentTab();
    if (tab) {
      tab.pixels = next;
      const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
      if (layer) layer.pixels = next;
      tab.pngDirty = true;
    }
    pushHistory(before, beforeSelect);
    const partial = hasPartialAlpha(next);
    alphaUsedRef.current = partial;
    if (tab) tab.alphaUsed = partial;
    setAlphaUsed(partial);
    if (!alphaEditRef.current) refreshUsed();
    paint();
    scheduleSave();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (renameIdRef.current || tabRenameIdRef.current) return;
    if (event.button === 1) {
      event.preventDefault();
      return;
    }
    const editing = pasteRef.current != null || floatMoveRef.current?.mode === "menu" || (warpRef.current != null && warpRef.current.tabId === activeIdRef.current) || (trimRef.current != null && trimRef.current.tabId === activeIdRef.current);
    if (editing && event.button !== 0) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (floatMoveRef.current && event.button === 0) {
      event.preventDefault();
      event.stopPropagation();
      grabFloat(event.pointerId, event.clientX, event.clientY);
      return;
    }
    if (warpRef.current && warpRef.current.tabId === activeIdRef.current && event.button === 0) {
      event.preventDefault();
      event.stopPropagation();
      if (!readyRef.current || panDrag.current) return;
      const canvas = viewRef.current;
      const point = canvas ? pointAtOpen(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current) : null;
      if (!canvas || !point) return;
      const current = warpRef.current;
      const rect = canvas.getBoundingClientRect();
      const hit = (10 / rect.width) * sizeRef.current;
      const corners = warpCorners(current.clip, current);
      const mids = [
        { kind: "n" as const, x: (corners[0]!.x + corners[1]!.x) / 2, y: (corners[0]!.y + corners[1]!.y) / 2 },
        { kind: "e" as const, x: (corners[1]!.x + corners[2]!.x) / 2, y: (corners[1]!.y + corners[2]!.y) / 2 },
        { kind: "s" as const, x: (corners[2]!.x + corners[3]!.x) / 2, y: (corners[2]!.y + corners[3]!.y) / 2 },
        { kind: "w" as const, x: (corners[3]!.x + corners[0]!.x) / 2, y: (corners[3]!.y + corners[0]!.y) / 2 },
      ];
      const points: { kind: WarpHandle; x: number; y: number }[] = [
        { kind: "nw", ...corners[0]! },
        { kind: "ne", ...corners[1]! },
        { kind: "se", ...corners[2]! },
        { kind: "sw", ...corners[3]! },
        ...mids,
        ...warpRotateHandles(current.clip, current, (26 / rect.width) * sizeRef.current).map((handle) => ({ kind: "rotate" as const, ...handle })),
      ];
      let kind: WarpHandle | null = null;
      let best = hit;
      for (const handle of points) {
        const distance = Math.hypot(point.x - handle.x, point.y - handle.y);
        if (distance <= best) {
          best = distance;
          kind = handle.kind;
        }
      }
      if (kind == null) {
        const local = warpLocal(current.clip, current, point.x, point.y);
        if (local.x >= 0 && local.y >= 0 && local.x <= current.clip.w && local.y <= current.clip.h) kind = "move";
      }
      if (kind == null) return;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* the move still ends on pointerup */
      }
      warpDrag.current = {
        pointer: event.pointerId,
        kind,
        cx: current.cx,
        cy: current.cy,
        scaleX: current.scaleX,
        scaleY: current.scaleY,
        degrees: current.degrees,
        startX: point.x,
        startY: point.y,
        lock: current.lock,
      };
      return;
    }
    const blocked = (canvasRef.current && canvasRef.current.tabId === activeIdRef.current) || (trimRef.current && trimRef.current.tabId === activeIdRef.current);
    if (blocked && (event.button === 0 || event.button === 2)) {
      event.preventDefault();
      return;
    }
    if (pasteRef.current && pixelClipboard.clip && event.button === 0) {
      event.preventDefault();
      event.stopPropagation();
      if (!readyRef.current || panDrag.current) return;
      const canvas = viewRef.current;
      if (!canvas) return;
      const open = cellAtOpen(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
      if (!open || !clipHas(pixelClipboard.clip, pasteRef.current.x, pasteRef.current.y, open.x, open.y)) return;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* the move still ends on pointerup */
      }
      pasteDrag.current = { pointer: event.pointerId, x: open.x, y: open.y, ox: pasteRef.current.x, oy: pasteRef.current.y };
      return;
    }
    if (event.button === 2) {
      event.preventDefault();
      event.stopPropagation();
      if (!readyRef.current || panDrag.current) return;
      const canvas = viewRef.current;
      if (!canvas) return;
      const cell = cellAt(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
      if (!cell) return;
      sampleAt(cell);
      return;
    }
    if (event.button !== 0 || !readyRef.current || panDrag.current) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = viewRef.current;
    if (!canvas) return;
    const cell = cellAt(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
    if (!cell) return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* the stroke still ends on pointerup */
    }
    if (toolRef.current === "dropper") {
      sampleAt(cell);
      return;
    }
    if (toolRef.current === "move") {
      if (selectionRef.current) {
        if (!floatMoveRef.current) beginFloat("tool");
        grabFloat(event.pointerId, event.clientX, event.clientY);
        return;
      }
      if (denyHidden()) return;
      const tab = currentTab();
      const layer = tab?.layers.find((entry) => entry.id === tab.activeLayerId);
      if (!tab || !layer) return;
      if (layer.kind === "image") {
        moveRef.current = { pointer: event.pointerId, layerId: layer.id, kind: "image", x: cell.x, y: cell.y, dx: 0, dy: 0, plane: null, peers: movePeers(layer.id) };
      } else {
        moveRef.current = {
          pointer: event.pointerId,
          layerId: layer.id,
          kind: "pixel",
          x: cell.x,
          y: cell.y,
          dx: 0,
          dy: 0,
          plane: pixelLayerPlane(pixelsRef.current, sizeRef.current, heightRef.current, layer.rest),
          peers: movePeers(layer.id),
        };
      }
      setLayerMoving(true);
      return;
    }
    const imageNow = activeImage();
    if (imageNow && toolRef.current !== "pen" && toolRef.current !== "eraser" && toolRef.current !== "select") {
      notify("画像レイヤーでは、ペン・消しゴム・移動・範囲の移動が使えます。通常レイヤーには描きません。");
      return;
    }
    const movingPixels = toolRef.current === "select" && moveArmedRef.current && selectionRef.current != null && selectionHas(selectionRef.current, cell.x, cell.y, spanRef.current);
    if ((toolRef.current !== "select" && toolRef.current !== "symmetry") || movingPixels) {
      if (denyHidden()) return;
    }
    if (toolRef.current === "select") {
      const current = selectionRef.current;
      const inside = current ? selectionHas(current, cell.x, cell.y, spanRef.current) : false;
      if (inside && current && moveArmedRef.current) {
        const image = activeImage();
        selectDrag.current = {
          kind: "pixels",
          x: cell.x,
          y: cell.y,
          origin: clonePixelSelection(current) ?? current,
          base: image ? new Uint8ClampedArray(0) : new Uint8ClampedArray(pixelsRef.current),
          plane: image ? { x: image.x, y: image.y, width: image.imgW, height: image.imgH, pixels: new Uint8ClampedArray(image.pixels) } : undefined,
          pointer: event.pointerId,
        };
        return;
      }
      const picked = selectionSource();
      if (selectKindRef.current === "wand") {
        const before = clonePixelSelection(current);
        const next = magicWandMask(picked, spanRef.current, cell.x, cell.y);
        pushHistory(new Uint8ClampedArray(pixelsRef.current), before);
        rememberSelection(next);
        return;
      }
      if (selectKindRef.current === "color") {
        const before = clonePixelSelection(current);
        const next = colorSelectMask(picked, spanRef.current, cell.x, cell.y);
        pushHistory(new Uint8ClampedArray(pixelsRef.current), before);
        rememberSelection(next);
        return;
      }
      if (inside && current) {
        selectDrag.current = { kind: "box", x: cell.x, y: cell.y, origin: clonePixelSelection(current) ?? current, pointer: event.pointerId };
        return;
      }
      if (selectKindRef.current === "lasso") {
        selectDrag.current = { kind: "lasso", points: [{ x: cell.x, y: cell.y }], before: clonePixelSelection(current), moved: false, pointer: event.pointerId };
        setSelecting(true);
        if (current) rememberSelection(null);
        setLassoDraft([{ x: cell.x, y: cell.y }]);
        return;
      }
      selectDrag.current = { kind: "new", x: cell.x, y: cell.y, moved: false, pointer: event.pointerId };
      setSelecting(true);
      return;
    }
    if (toolRef.current === "grad") {
      gradDrag.current = { x: cell.x, y: cell.y, x1: cell.x, y1: cell.y, pointer: event.pointerId };
      setGradLine({ x0: cell.x, y0: cell.y, x1: cell.x, y1: cell.y });
      return;
    }
    if (toolRef.current === "ellipse") {
      ellipseDrag.current = { x: cell.x, y: cell.y, pointer: event.pointerId, before: new Uint8ClampedArray(pixelsRef.current) };
      previewEllipse(cell.x, cell.y);
      return;
    }
    if (toolRef.current === "symmetry") {
      symmetryDrag.current = { x: cell.x, y: cell.y, pointer: event.pointerId, moved: false };
      setSymmetryDraft(null);
      return;
    }
    if (toolRef.current === "fill") {
      const before = new Uint8ClampedArray(pixelsRef.current);
      let painted = 0;
      if (alphaEditRef.current) {
        painted = floodAlpha(pixelsRef.current, spanRef.current, cell.x, cell.y, alphaByte(alphaStepRef.current), selectionRef.current);
        if (painted > 0) noteAlpha();
      } else {
        const color = activeColor();
        painted = floodRgb(pixelsRef.current, spanRef.current, cell.x, cell.y, color, selectionRef.current);
        if (painted > 0) noteUsed(color);
      }
      if (painted > 0) pushHistory(before, selectionRef.current);
      paint();
      scheduleSave();
      return;
    }
    if (toolRef.current === "replace") {
      const color = activeColor();
      if (color.a <= 0) return;
      const before = new Uint8ClampedArray(pixelsRef.current);
      const painted = replaceRgb(pixelsRef.current, spanRef.current, cell.x, cell.y, color, selectionRef.current);
      if (painted <= 0) return;
      pushHistory(before, selectionRef.current);
      noteUsed(color);
      const tab = currentTab();
      if (tab) tab.pngDirty = true;
      paint();
      scheduleSave();
      return;
    }
    drawingRef.current = true;
    lastRef.current = cell;
    strokePoints.current = [];
    const mirroring = Boolean(symmetryRef.current) && (toolRef.current === "pen" || toolRef.current === "eraser");
    strokeBefore.current =
      mirroring || (perfectRef.current && toolRef.current === "pen") ? new Uint8ClampedArray(pixelsRef.current) : null;
    rememberEdit();
    drawDot(cell.x, cell.y);
    paint();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const moving = moveRef.current;
    if (moving && moving.pointer === event.pointerId) {
      const canvas = viewRef.current;
      if (!canvas) return;
      const open = cellAtOpen(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
      if (!open) return;
      const dx = open.x - moving.x;
      const dy = open.y - moving.y;
      if (dx === moving.dx && dy === moving.dy) return;
      moving.dx = dx;
      moving.dy = dy;
      paint();
      return;
    }
    if (warpDrag.current && warpDrag.current.pointer === event.pointerId) {
      moveWarp(event);
      return;
    }
    const floating = pasteDrag.current;
    if (floating && floating.pointer === event.pointerId) {
      const canvas = viewRef.current;
      if (!canvas || !pasteRef.current) return;
      const open = cellAtOpen(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
      if (!open) return;
      const next = { x: floating.ox + open.x - floating.x, y: floating.oy + open.y - floating.y };
      pasteRef.current = next;
      setPaste(next);
      return;
    }
    const lifting = floatDrag.current;
    if (lifting && lifting.pointer === event.pointerId) {
      const canvas = viewRef.current;
      if (!canvas || !floatMoveRef.current) return;
      const open = cellAtOpen(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
      if (!open) return;
      placeFloat(lifting.ox + open.x - lifting.x, lifting.oy + open.y - lifting.y);
      return;
    }
    const symmetryDragNow = symmetryDrag.current;
    if (symmetryDragNow && symmetryDragNow.pointer === event.pointerId) {
      const canvas = viewRef.current;
      if (!canvas) return;
      const cell = cellAtClamped(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
      if (!cell || (cell.x === symmetryDragNow.x && cell.y === symmetryDragNow.y)) return;
      symmetryDragNow.moved = true;
      setSymmetryDraft({ x0: symmetryDragNow.x, y0: symmetryDragNow.y, x1: cell.x, y1: cell.y });
      return;
    }
    const ellipse = ellipseDrag.current;
    if (ellipse && ellipse.pointer === event.pointerId) {
      const canvas = viewRef.current;
      if (!canvas) return;
      const cell = cellAtClamped(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
      if (!cell) return;
      previewEllipse(cell.x, cell.y);
      return;
    }
    const grad = gradDrag.current;
    if (grad && grad.pointer === event.pointerId) {
      const canvas = viewRef.current;
      if (!canvas) return;
      const cell = cellAt(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
      if (!cell || (cell.x === grad.x1 && cell.y === grad.y1)) return;
      grad.x1 = cell.x;
      grad.y1 = cell.y;
      setGradLine({ x0: grad.x, y0: grad.y, x1: cell.x, y1: cell.y });
      return;
    }
    const drag = selectDrag.current;
    if (drag && drag.pointer === event.pointerId) {
      const canvas = viewRef.current;
      if (!canvas) return;
      const cell = drag.kind === "lasso" ? cellAtClamped(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current) : cellAt(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
      if (!cell) return;
      applySelectDrag(drag, cell);
      return;
    }
    if (!drawingRef.current || panDrag.current) return;
    const canvas = viewRef.current;
    if (!canvas) return;
    const native = event.nativeEvent;
    const samples = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
    const points = samples.length > 0 ? samples : [native];
    let changed = false;
    for (const point of points) {
      const cell = cellAt(point.clientX, point.clientY, canvas, sizeRef.current, heightRef.current);
      if (!cell) continue;
      const last = lastRef.current ?? cell;
      for (const step of bresenham(last.x, last.y, cell.x, cell.y)) drawDot(step.x, step.y);
      lastRef.current = cell;
      changed = true;
    }
    if (changed) paint();
  };

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 1 || !readyRef.current) return;
    if (pasteRef.current || warpRef.current || trimRef.current) return;
    abandonEllipse(true);
    symmetryDrag.current = null;
    setSymmetryDraft(null);
    event.preventDefault();
    event.stopPropagation();
    drawingRef.current = false;
    lastRef.current = null;
    panDrag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: panRef.current.x, panY: panRef.current.y };
    setPanning(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the drag still ends on pointerup */
    }
  };

  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDrag.current;
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    const next = { x: drag.panX + (event.clientX - drag.x), y: drag.panY + (event.clientY - drag.y) };
    panRef.current = next;
    setPan(next);
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panDrag.current?.id !== event.pointerId) return;
    panDrag.current = null;
    setPanning(false);
    scheduleSave();
  };

  const chooseBackdrop = (next: PixelBackdrop) => {
    setBackdrop(next);
    const job = pixelTail.catch(() => undefined).then(() => writeKv(PIXEL_BACKDROP_KEY, next));
    pixelTail = job.then(
      () => undefined,
      () => undefined,
    );
  };

  const finishSymmetry = (pointerId: number, clientX: number, clientY: number) => {
    const drag = symmetryDrag.current;
    if (!drag || drag.pointer !== pointerId) return false;
    symmetryDrag.current = null;
    setSymmetryDraft(null);
    const canvas = viewRef.current;
    const cell = canvas ? cellAtClamped(clientX, clientY, canvas, sizeRef.current, heightRef.current) : null;
    const placed = drag.moved && cell && (cell.x !== drag.x || cell.y !== drag.y);
    if (!placed) {
      if (!drag.moved && symmetryRef.current) {
        symmetryRef.current = null;
        const tab = currentTab();
        if (tab) tab.symmetry = null;
        setSymmetry(null);
        scheduleSave();
      }
      return true;
    }
    const axis = { x0: drag.x, y0: drag.y, x1: cell.x, y1: cell.y };
    symmetryRef.current = axis;
    const tab = currentTab();
    if (tab) tab.symmetry = axis;
    setSymmetry(axis);
    scheduleSave();
    return true;
  };

  const finishEllipse = (pointerId: number, clientX: number, clientY: number) => {
    const drag = ellipseDrag.current;
    if (!drag || drag.pointer !== pointerId) return false;
    ellipseDrag.current = null;
    const canvas = viewRef.current;
    const cell = canvas ? cellAtClamped(clientX, clientY, canvas, sizeRef.current, heightRef.current) : null;
    if (!cell) {
      pixelsRef.current = drag.before;
      const tab = currentTab();
      if (tab) {
        tab.pixels = drag.before;
        const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
        if (layer) layer.pixels = drag.before;
      }
      paint();
      scheduleSave();
      return true;
    }
    const next = new Uint8ClampedArray(drag.before);
    const ink = ellipseInk();
    const changed = paintEllipse(next, spanRef.current, drag.x, drag.y, cell.x, cell.y, ink, selectionRef.current);
    if (changed <= 0) {
      pixelsRef.current = drag.before;
      const tab = currentTab();
      if (tab) {
        tab.pixels = drag.before;
        const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
        if (layer) layer.pixels = drag.before;
      }
      paint();
      scheduleSave();
      return true;
    }
    pixelsRef.current = next;
    pushHistory(drag.before, selectionRef.current);
    if (ink.mode === "alpha") {
      if (ink.alpha < 255) noteAlpha();
    } else if (ink.color.a > 0) noteUsed(ink.color);
    const tab = currentTab();
    if (tab) {
      tab.pixels = next;
      const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
      if (layer) layer.pixels = next;
      tab.pngDirty = true;
    }
    paint();
    scheduleSave();
    return true;
  };

  const finishGrad = (pointerId: number, clientX: number, clientY: number) => {
    const drag = gradDrag.current;
    if (!drag || drag.pointer !== pointerId) return false;
    gradDrag.current = null;
    setGradLine(null);
    const canvas = viewRef.current;
    const cell = canvas ? cellAt(clientX, clientY, canvas, sizeRef.current, heightRef.current) : null;
    const endX = cell?.x ?? drag.x1;
    const endY = cell?.y ?? drag.y1;
    const before = new Uint8ClampedArray(pixelsRef.current);
    const changed = applyPixelGradient(pixelsRef.current, spanRef.current, drag.x, drag.y, endX, endY, selectionRef.current);
    if (!changed) return true;
    pushHistory(before, selectionRef.current);
    const mid = readPixel(pixelsRef.current, spanRef.current, (drag.x + endX) / 2, (drag.y + endY) / 2);
    if (mid.a > 0) noteUsed({ r: mid.r, g: mid.g, b: mid.b, a: 255 });
    const tab = currentTab();
    if (tab) tab.pngDirty = true;
    paint();
    scheduleSave();
    return true;
  };

  const movePeers = (activeId: string): MovePeer[] =>
    editTargets()
      .filter((layer) => layer.id !== activeId)
      .map((layer) => ({
        id: layer.id,
        kind: layer.kind === "image" ? "image" : "pixel",
        plane: layer.kind === "image" ? null : pixelLayerPlane(layer.pixels, sizeRef.current, heightRef.current, layer.rest),
      }));

  const applyMovePeers = (drag: { dx: number; dy: number; peers: MovePeer[] }) => {
    const tab = currentTab();
    if (!tab || drag.peers.length === 0) return;
    for (const peer of drag.peers) {
      const layer = tab.layers.find((entry) => entry.id === peer.id);
      if (!layer) continue;
      if (peer.kind === "image" && layer.kind === "image") {
        layer.x += drag.dx;
        layer.y += drag.dy;
        layer.png = "";
        continue;
      }
      if (layer.kind === "image" || !peer.plane) continue;
      const next = shiftContentPlane(peer.plane, drag.dx, drag.dy, sizeRef.current, heightRef.current);
      layer.pixels = next.pixels;
      layer.rest = next.rest;
      layer.restPng = "";
      layer.png = "";
    }
    tab.pngDirty = true;
  };

  const finishLayerMove = (pointerId: number | null, commit: boolean) => {
    const drag = moveRef.current;
    if (!drag || (pointerId != null && drag.pointer !== pointerId)) return false;
    moveRef.current = null;
    setLayerMoving(false);
    const tab = currentTab();
    const layer = tab?.layers.find((entry) => entry.id === drag.layerId);
    if (!commit || !tab || !layer || layer.id !== tab.activeLayerId || (drag.dx === 0 && drag.dy === 0)) {
      paint();
      return true;
    }
    if (layer.kind === "image") {
      pushHistory(new Uint8ClampedArray(pixelsRef.current), selectionRef.current);
      layer.x += drag.dx;
      layer.y += drag.dy;
      layer.png = "";
      applyMovePeers(drag);
      tab.pngDirty = true;
      paint();
      scheduleSave();
      return true;
    }
    if (!drag.plane) {
      paint();
      return true;
    }
    const next = shiftContentPlane(drag.plane, drag.dx, drag.dy, sizeRef.current, heightRef.current);
    pushHistory(new Uint8ClampedArray(pixelsRef.current), selectionRef.current);
    pixelsRef.current = next.pixels;
    layer.pixels = next.pixels;
    layer.rest = next.rest;
    layer.restPng = "";
    layer.png = "";
    tab.pixels = next.pixels;
    tab.pngDirty = true;
    applyMovePeers(drag);
    const partial = pixelPartial(tab);
    alphaUsedRef.current = partial;
    tab.alphaUsed = partial;
    setAlphaUsed(partial);
    if (extractedRef.current) refreshUsed();
    paint();
    scheduleSave();
    return true;
  };

  const endStroke = (event?: ReactPointerEvent<HTMLCanvasElement>) => {
    if (finishLayerMove(event ? event.pointerId : null, true)) return;
    if (warpDrag.current && (!event || warpDrag.current.pointer === event.pointerId)) {
      warpDrag.current = null;
      return;
    }
    if (pasteDrag.current && (!event || pasteDrag.current.pointer === event.pointerId)) {
      pasteDrag.current = null;
      return;
    }
    if (floatDrag.current && (!event || floatDrag.current.pointer === event.pointerId)) {
      floatDrag.current = null;
      return;
    }
    if (event && finishSymmetry(event.pointerId, event.clientX, event.clientY)) return;
    if (event && finishEllipse(event.pointerId, event.clientX, event.clientY)) return;
    if (event && finishGrad(event.pointerId, event.clientX, event.clientY)) return;
    if (event && finishSelect(event.pointerId)) return;
    strokeBefore.current = null;
    strokePoints.current = [];
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    strokeBefore.current = null;
    strokePoints.current = [];
    scheduleSave();
  };

  const cancelStroke = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (finishLayerMove(event.pointerId, false)) return;
    if (warpDrag.current?.pointer === event.pointerId) {
      warpDrag.current = null;
      return;
    }
    if (pasteDrag.current?.pointer === event.pointerId) {
      pasteDrag.current = null;
      return;
    }
    if (floatDrag.current?.pointer === event.pointerId) {
      floatDrag.current = null;
      return;
    }
    if (symmetryDrag.current?.pointer === event.pointerId) {
      symmetryDrag.current = null;
      setSymmetryDraft(null);
      return;
    }
    if (ellipseDrag.current?.pointer === event.pointerId) {
      abandonEllipse(true);
      return;
    }
    if (gradDrag.current?.pointer === event.pointerId) {
      gradDrag.current = null;
      setGradLine(null);
      return;
    }
    const drag = selectDrag.current;
    if (drag && drag.pointer === event.pointerId) {
      selectDrag.current = null;
      setSelecting(false);
      if (drag.kind === "lasso") {
        setLassoDraft(null);
        rememberSelection(drag.before);
        return;
      }
      if (drag.kind === "pixels") {
        if (drag.plane) {
          const image = activeImage();
          if (image) applyPlane(image, drag.plane);
        } else {
          const tab = currentTab();
          if (tab) pixelsRef.current = tab.pixels;
        }
        rememberSelection(drag.origin);
        setRev((value) => value + 1);
      }
      return;
    }
    endStroke();
  };

  const publishWarp = (next: WarpLive) => {
    warpRef.current = next;
    setWarp(next);
    paint();
  };

  const beginWarp = () => {
    if (pasteRef.current || warpRef.current || canvasRef.current || trimRef.current) return;
    if (denyHidden()) return;
    if (activeImage()) {
      notify("画像レイヤーでは変形できません。通常レイヤーを選んでください。キャンバスは変えていません。");
      return;
    }
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    const data = pixelsRef.current;
    const selectionNow = selectionRef.current;
    const tabId = activeIdRef.current;
    if (!tabId) return;
    let clip: PixelClip | null = null;
    let ox = 0;
    let oy = 0;
    let scope: WarpLive["scope"] = "canvas";
    if (selectionNow) {
      clip = copyPixelSelection(data, spanRef.current, selectionNow);
      if (!clip) return;
      const box = selectionBox(selectionNow);
      ox = box.x;
      oy = box.y;
      scope = "selection";
    } else {
      const mask = new Uint8Array(widthNow * heightNow);
      mask.fill(1);
      clip = { w: widthNow, h: heightNow, rgba: new Uint8ClampedArray(data), mask };
    }
    const peers: WarpPeer[] = [];
    const tab = currentTab();
    if (tab) {
      for (const layer of editTargets()) {
        if (layer.id === tab.activeLayerId) continue;
        peers.push({
          id: layer.id,
          image: layer.kind === "image",
          base: layer.kind === "image" ? projectImagePlane(toPlane(layer), widthNow, heightNow) : new Uint8ClampedArray(layer.pixels),
        });
      }
    }
    setWarpText(null);
    publishWarp({
      tabId,
      base: new Uint8ClampedArray(data),
      beforeSelect: clonePixelSelection(selectionNow),
      clip,
      ox,
      oy,
      cx: ox + clip.w / 2,
      cy: oy + clip.h / 2,
      scaleX: 1,
      scaleY: 1,
      degrees: 0,
      filter: "nearest",
      lock: false,
      scope,
      peers,
    });
  };

  const cancelWarp = () => {
    warpDrag.current = null;
    warpRef.current = null;
    setWarp(null);
    setWarpText(null);
    paint();
  };

  const beginCanvas = () => {
    if (pasteRef.current || warpRef.current || canvasRef.current || trimRef.current) return;
    if (canvasDraft) {
      setCanvasDraft(null);
      return;
    }
    if (activeImage()) {
      notify("画像レイヤーを選択中はキャンバスサイズを変えません。通常レイヤーを選んでください。");
      return;
    }
    const tabId = activeIdRef.current;
    if (!tabId) return;
    setCanvasDraft({
      widthText: String(sizeRef.current),
      heightText: String(heightRef.current),
      nextW: sizeRef.current,
      nextH: heightRef.current,
      ax: 1,
      ay: 1,
    });
  };

  const cancelCanvas = () => {
    canvasRef.current = null;
    setCanvasSize(null);
    setCanvasDraft(null);
    paint();
  };

  const confirmCanvas = () => {
    const current = canvasRef.current;
    if (!current || current.tabId !== activeIdRef.current) return;
    const widthNow = current.width;
    const heightNow = current.height;
    if (current.base.length !== widthNow * heightNow * 4) return;
    const next = resizePixelCanvas(current.base, widthNow, heightNow, current.nextW, current.nextH, current.ax, current.ay);
    let changed = current.nextW !== widthNow || current.nextH !== heightNow;
    if (!changed) {
      for (let index = 0; index < next.length; index += 1) {
        if (next[index] !== current.base[index]) {
          changed = true;
          break;
        }
      }
    }
    const ox = canvasAnchorOffset(widthNow, current.nextW, current.ax);
    const oy = canvasAnchorOffset(heightNow, current.nextH, current.ay);
    canvasRef.current = null;
    setCanvasSize(null);
    setCanvasDraft(null);
    if (!changed) {
      paint();
      return;
    }
    pushHistory(current.base, current.beforeSelect);
    const tab = currentTab();
    if (tab) {
      for (const layer of tab.layers) {
        if (layer.kind === "image") {
          layer.x += ox;
          layer.y += oy;
          layer.png = "";
          continue;
        }
        const source = layer.id === tab.activeLayerId ? current.base : layer.pixels;
        if (layer.rest) {
          const placed = rebasePixelRest(source, widthNow, heightNow, layer.rest, current.nextW, current.nextH, ox, oy);
          layer.pixels = placed.pixels;
          layer.rest = placed.rest;
          layer.restPng = "";
        } else {
          layer.pixels = resizePixelCanvas(source, widthNow, heightNow, current.nextW, current.nextH, current.ax, current.ay);
        }
        layer.imgW = current.nextW;
        layer.imgH = current.nextH;
        layer.png = "";
      }
      const active = tab.layers.find((layer) => layer.id === tab.activeLayerId);
      const pixelTarget = active && active.kind !== "image" ? active : tab.layers.find((layer) => layer.kind !== "image");
      if (pixelTarget) {
        pixelsRef.current = pixelTarget.pixels;
        tab.pixels = pixelTarget.pixels;
      }
      tab.pngDirty = true;
    }
    assignGrid(current.nextW, current.nextH);
    rememberSelection(shiftPixelSelection(current.beforeSelect, ox, oy, { width: widthNow, height: heightNow }, { width: current.nextW, height: current.nextH }));
    const partial = hasPartialAlpha(next);
    alphaUsedRef.current = partial;
    if (tab) tab.alphaUsed = partial;
    setAlphaUsed(partial);
    if (!alphaEditRef.current) refreshUsed();
    paint();
    scheduleSave();
  };

  const applyCanvasDraft = () => {
    const draft = canvasDraft;
    const tabId = activeIdRef.current;
    if (!draft || !tabId) return;
    const nextW = readCanvasEdge(draft.widthText);
    const nextH = readCanvasEdge(draft.heightText);
    if (nextW == null || nextH == null) return;
    if (pasteRef.current || warpRef.current || trimRef.current) return;
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    if (pixelsRef.current.length !== widthNow * heightNow * 4) return;
    canvasRef.current = {
      tabId,
      base: new Uint8ClampedArray(pixelsRef.current),
      width: widthNow,
      height: heightNow,
      nextW,
      nextH,
      ax: draft.ax,
      ay: draft.ay,
      beforeSelect: clonePixelSelection(selectionRef.current),
    };
    confirmCanvas();
  };

  const beginTrim = () => {
    if (pasteRef.current || warpRef.current || canvasRef.current || trimRef.current) return;
    if (activeImage()) {
      notify("画像レイヤーを選択中はトリミングしません。通常レイヤーを選んでください。");
      return;
    }
    const tabId = activeIdRef.current;
    if (!tabId) return;
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    const data = pixelsRef.current;
    if (data.length !== widthNow * heightNow * 4) return;
    const tab = currentTab();
    const buffers = tab ? tab.layers.filter((layer) => layer.kind !== "image").map((layer) => (layer.id === tab.activeLayerId ? data : layer.pixels)) : [data];
    const bounds = unionOpaqueBounds(buffers, spanRef.current);
    if (!bounds) {
      notify("画像内にトリミング対象となるピクセルがありません");
      return;
    }
    const next = {
      tabId,
      base: new Uint8ClampedArray(data),
      width: widthNow,
      height: heightNow,
      bounds,
      beforeSelect: clonePixelSelection(selectionRef.current),
    };
    trimRef.current = next;
    setTrim(next);
    paint();
  };

  const cancelTrim = () => {
    trimRef.current = null;
    setTrim(null);
    paint();
  };

  const confirmTrim = () => {
    const current = trimRef.current;
    if (!current || current.tabId !== activeIdRef.current) return;
    const widthNow = current.width;
    const heightNow = current.height;
    if (current.base.length !== widthNow * heightNow * 4) return;
    const box = current.bounds;
    const next = cropPixelCanvas(current.base, widthNow, heightNow, box.x, box.y, box.w, box.h);
    const changed = box.left !== 0 || box.right !== 0 || box.top !== 0 || box.bottom !== 0;
    trimRef.current = null;
    setTrim(null);
    if (!changed || next.length !== box.w * box.h * 4) {
      paint();
      return;
    }
    pushHistory(current.base, current.beforeSelect);
    const tab = currentTab();
    if (tab) {
      for (const layer of tab.layers) {
        if (layer.kind === "image") {
          layer.x -= box.x;
          layer.y -= box.y;
          layer.png = "";
          continue;
        }
        const source = layer.id === tab.activeLayerId ? current.base : layer.pixels;
        if (layer.rest) {
          const placed = rebasePixelRest(source, widthNow, heightNow, layer.rest, box.w, box.h, -box.x, -box.y);
          layer.pixels = placed.pixels;
          layer.rest = placed.rest;
          layer.restPng = "";
        } else {
          layer.pixels = cropPixelCanvas(source, widthNow, heightNow, box.x, box.y, box.w, box.h);
        }
        layer.imgW = box.w;
        layer.imgH = box.h;
        layer.png = "";
      }
      const active = tab.layers.find((layer) => layer.id === tab.activeLayerId);
      const pixelTarget = active && active.kind !== "image" ? active : tab.layers.find((layer) => layer.kind !== "image");
      if (pixelTarget) {
        pixelsRef.current = pixelTarget.pixels;
        tab.pixels = pixelTarget.pixels;
      }
      tab.pngDirty = true;
    }
    assignGrid(box.w, box.h);
    rememberSelection(shiftPixelSelection(current.beforeSelect, -box.left, -box.top, { width: widthNow, height: heightNow }, { width: box.w, height: box.h }));
    const partial = hasPartialAlpha(next);
    alphaUsedRef.current = partial;
    if (tab) tab.alphaUsed = partial;
    setAlphaUsed(partial);
    if (!alphaEditRef.current) refreshUsed();
    paint();
    scheduleSave();
  };

  const confirmWarp = () => {
    const current = warpRef.current;
    if (!current || current.tabId !== activeIdRef.current) return;
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    if (current.base.length !== widthNow * heightNow * 4) return;
    warpDrag.current = null;
    const result = warpPixels(current.base, spanRef.current, current.clip, current.ox, current.oy, current, current.scope === "selection" ? current.beforeSelect : null);
    let changed = buffersDiffer(current.base, result.data);
    const peerResults: { peer: WarpPeer; data: Uint8ClampedArray }[] = [];
    for (const peer of current.peers) {
      let clip = current.clip;
      let ox = current.ox;
      let oy = current.oy;
      if (current.scope === "selection" && current.beforeSelect) {
        const copied = copyPixelSelection(peer.base, spanRef.current, current.beforeSelect);
        if (!copied) continue;
        clip = copied;
        const box = selectionBox(current.beforeSelect);
        ox = box.x;
        oy = box.y;
      } else {
        const mask = new Uint8Array(widthNow * heightNow);
        mask.fill(1);
        clip = { w: widthNow, h: heightNow, rgba: peer.base, mask };
        ox = 0;
        oy = 0;
      }
      const warped = warpPixels(peer.base, spanRef.current, clip, ox, oy, current, current.scope === "selection" ? current.beforeSelect : null);
      if (buffersDiffer(peer.base, warped.data)) peerResults.push({ peer, data: warped.data });
    }
    const nextSelect = current.scope === "selection" ? result.selection : current.beforeSelect;
    warpRef.current = null;
    setWarp(null);
    setWarpText(null);
    if (!changed && peerResults.length === 0 && current.scope !== "selection") {
      paint();
      return;
    }
    if (!changed && peerResults.length === 0 && current.scope === "selection") {
      rememberSelection(nextSelect);
      paint();
      return;
    }
    const tab = currentTab();
    if (changed) {
      pixelsRef.current = result.data;
      if (tab) {
        tab.pixels = result.data;
        const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
        if (layer && layer.kind !== "image") layer.pixels = result.data;
        tab.pngDirty = true;
      }
    }
    if (changed || peerResults.length > 0) pushHistory(current.base, current.beforeSelect);
    if (tab) {
      for (const job of peerResults) {
        const layer = tab.layers.find((entry) => entry.id === job.peer.id);
        if (!layer) continue;
        if (job.peer.image && layer.kind === "image") applyPlane(layer, commitCanvasDiff(toPlane(layer), job.peer.base, job.data, widthNow, heightNow));
        else if (layer.kind !== "image") {
          layer.pixels = job.data;
          layer.png = "";
        }
      }
      if (peerResults.length > 0) tab.pngDirty = true;
    }
    rememberSelection(nextSelect);
    const partial = hasPartialAlpha(result.data);
    alphaUsedRef.current = partial;
    if (tab) tab.alphaUsed = partial;
    setAlphaUsed(partial);
    if (!alphaEditRef.current) refreshUsed();
    paint();
    scheduleSave();
  };

  const moveWarp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = warpDrag.current;
    const current = warpRef.current;
    const canvas = viewRef.current;
    if (!drag || !current || !canvas || drag.pointer !== event.pointerId) return;
    const point = pointAtOpen(event.clientX, event.clientY, canvas, sizeRef.current, heightRef.current);
    if (!point) return;
    if (drag.kind === "move") {
      const dx = Math.round(point.x - drag.startX);
      const dy = Math.round(point.y - drag.startY);
      publishWarp({ ...current, cx: drag.cx + dx, cy: drag.cy + dy });
      return;
    }
    if (drag.kind === "rotate") {
      const start = Math.atan2(drag.startY - drag.cy, drag.startX - drag.cx);
      const now = Math.atan2(point.y - drag.cy, point.x - drag.cx);
      const degrees = Math.round(drag.degrees + ((now - start) * 180) / Math.PI);
      if (!Number.isFinite(degrees)) return;
      publishWarp({ ...current, degrees });
      return;
    }
    const { sin, cos } = warpSinCos(drag.degrees);
    const dx = point.x - drag.cx;
    const dy = point.y - drag.cy;
    const unX = dx * cos + dy * sin;
    const unY = -dx * sin + dy * cos;
    const alongX = Math.abs(unX) / (current.clip.w / 2);
    const alongY = Math.abs(unY) / (current.clip.h / 2);
    let scaleX = drag.scaleX;
    let scaleY = drag.scaleY;
    const corner = drag.kind === "nw" || drag.kind === "ne" || drag.kind === "se" || drag.kind === "sw";
    if (corner) {
      const locked = warpLockedScales(current.clip.w, current.clip.h, drag.scaleX, drag.scaleY, unX, unY);
      scaleX = locked.scaleX;
      scaleY = locked.scaleY;
    } else if (drag.kind === "e" || drag.kind === "w") {
      scaleX = alongX;
      if (drag.lock) scaleY = alongX;
    } else {
      scaleY = alongY;
      if (drag.lock) scaleX = alongY;
    }
    publishWarp({
      ...current,
      scaleX: clampWarpScale(current.clip.w, scaleX),
      scaleY: clampWarpScale(current.clip.h, scaleY),
    });
  };

  const askWipe = () => {
    if (!readyRef.current || askRef.current || warpRef.current || canvasRef.current || trimRef.current) return;
    if (denyHidden()) return;
    const tab = currentTab();
    if (!tab) return;
    const selectionNow = selectionRef.current;
    const mode = alphaEditRef.current ? "alpha" : "rgba";
    type WipeJob =
      | { kind: "image"; layer: PixelLayer; before: Uint8ClampedArray; after: Uint8ClampedArray }
      | { kind: "pixel"; layer: PixelLayer; after: Uint8ClampedArray; clearRest: boolean };
    const jobs: WipeJob[] = [];
    for (const layer of editTargets()) {
      if (layer.kind === "image") {
        const before = projectImagePlane(toPlane(layer), sizeRef.current, heightRef.current);
        const after = new Uint8ClampedArray(before);
        clearSelection(after, spanRef.current, selectionNow, "rgba");
        if (buffersDiffer(before, after)) jobs.push({ kind: "image", layer, before, after });
        continue;
      }
      const source = layer.id === tab.activeLayerId ? pixelsRef.current : layer.pixels;
      const after = new Uint8ClampedArray(source);
      clearSelection(after, spanRef.current, selectionNow, mode);
      const clearRest = !selectionNow && mode === "rgba";
      if (buffersDiffer(source, after) || (clearRest && layer.rest != null) || layer.id === tab.activeLayerId) jobs.push({ kind: "pixel", layer, after, clearRest });
    }
    if (jobs.length === 0) return;
    rememberEdit();
    for (const job of jobs) {
      if (job.kind === "image") {
        applyPlane(job.layer, commitCanvasDiff(toPlane(job.layer), job.before, job.after, sizeRef.current, heightRef.current));
        continue;
      }
      job.layer.pixels = job.after;
      job.layer.png = "";
      if (job.clearRest) {
        job.layer.rest = null;
        job.layer.restPng = "";
      }
      if (job.layer.id === tab.activeLayerId) {
        pixelsRef.current = job.after;
        tab.pixels = job.after;
      }
    }
    tab.pngDirty = true;
    const partial = pixelPartial(tab);
    alphaUsedRef.current = partial;
    tab.alphaUsed = partial;
    setAlphaUsed(partial);
    if (!alphaEditRef.current) refreshUsed();
    paint();
    scheduleSave();
  };

  const beginSplit = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const pane = paneRef.current;
    const dock = event.currentTarget.nextElementSibling;
    if (!pane || !(dock instanceof HTMLElement)) return;
    const startY = event.clientY;
    const startH = dock.getBoundingClientRect().height;
    const move = (pointer: PointerEvent) => {
      const paneH = pane.getBoundingClientRect().height;
      const next = Math.round(startH + (startY - pointer.clientY));
      const clamped = Math.max(112, Math.min(Math.max(112, paneH - 140), next));
      setDockPx(clamped);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const clearTargetsSelection = (selectionNow: PixelSelection) => {
    const tab = currentTab();
    if (!tab) return;
    const mode = alphaEditRef.current ? "alpha" : "rgba";
    type ClearJob =
      | { kind: "image"; layer: PixelLayer; before: Uint8ClampedArray; after: Uint8ClampedArray }
      | { kind: "pixel"; layer: PixelLayer; after: Uint8ClampedArray };
    const jobs: ClearJob[] = [];
    for (const layer of editTargets()) {
      if (layer.kind === "image") {
        const before = projectImagePlane(toPlane(layer), sizeRef.current, heightRef.current);
        const after = new Uint8ClampedArray(before);
        clearSelection(after, spanRef.current, selectionNow, "rgba");
        if (buffersDiffer(before, after)) jobs.push({ kind: "image", layer, before, after });
        continue;
      }
      const source = layer.id === tab.activeLayerId ? pixelsRef.current : layer.pixels;
      const after = new Uint8ClampedArray(source);
      clearSelection(after, spanRef.current, selectionNow, mode);
      if (buffersDiffer(source, after) || layer.id === tab.activeLayerId) jobs.push({ kind: "pixel", layer, after });
    }
    if (jobs.length === 0) return;
    rememberEdit();
    for (const job of jobs) {
      if (job.kind === "image") {
        applyPlane(job.layer, commitCanvasDiff(toPlane(job.layer), job.before, job.after, sizeRef.current, heightRef.current));
        continue;
      }
      job.layer.pixels = job.after;
      job.layer.png = "";
      if (job.layer.id === tab.activeLayerId) {
        pixelsRef.current = job.after;
        tab.pixels = job.after;
      }
    }
    tab.pngDirty = true;
    const partial = pixelPartial(tab);
    if (alphaEditRef.current && partial) noteAlpha();
    alphaUsedRef.current = partial;
    tab.alphaUsed = partial;
    tab.alphaOn = alphaOnRef.current;
    setAlphaUsed(partial);
    setAlphaOn(alphaOnRef.current);
    if (!alphaEditRef.current) refreshUsed();
    paint();
    scheduleSave();
  };

  const invertSelectionMask = () => {
    const current = selectionRef.current;
    if (!current) return;
    const next = invertPixelSelection(current, spanRef.current);
    pushHistory(new Uint8ClampedArray(pixelsRef.current), current);
    rememberSelection(next);
  };

  const deleteSelectionMask = () => {
    const current = selectionRef.current;
    if (!current) return;
    pushHistory(new Uint8ClampedArray(pixelsRef.current), current);
    rememberSelection(null);
  };

  const runSelection = (action: "clear" | "fill") => {
    const rect = selectionRef.current;
    if (!rect) return;
    if (denyHidden()) return;
    if (action === "clear") {
      clearTargetsSelection(rect);
      return;
    }
    if (activeImage()) {
      editImageView((data) => {
        fillSelection(data, spanRef.current, rect, activeColor(), "rgba");
      });
      return;
    }
    rememberEdit();
    if (alphaEditRef.current) fillSelection(pixelsRef.current, spanRef.current, rect, { r: 0, g: 0, b: 0, a: alphaByte(alphaStepRef.current) }, "alpha");
    else fillSelection(pixelsRef.current, spanRef.current, rect, activeColor(), "rgba");
    const partial = hasPartialAlpha(pixelsRef.current);
    if (alphaEditRef.current && partial) noteAlpha();
    alphaUsedRef.current = partial;
    const tab = currentTab();
    if (tab) {
      tab.pixels = pixelsRef.current;
      const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
      if (layer) layer.pixels = pixelsRef.current;
      tab.alphaUsed = partial;
      tab.alphaOn = alphaOnRef.current;
      tab.pngDirty = true;
    }
    setAlphaUsed(partial);
    setAlphaOn(alphaOnRef.current);
    if (!alphaEditRef.current) refreshUsed();
    paint();
    scheduleSave();
  };

  const flipHorizontal = () => {
    if (!readyRef.current || askRef.current || warpRef.current || canvasRef.current || trimRef.current || floatMoveRef.current?.mode === "menu") return;
    if (floatMoveRef.current) confirmFloat();
    if (denyHidden()) return;
    const selectionNow = selectionRef.current;
    const tab = currentTab();
    if (!tab) return;
    abandonEllipse(true);
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    const span = spanRef.current;
    type FlipJob =
      | { kind: "canvas"; layer: PixelLayer; before: Uint8ClampedArray; after: Uint8ClampedArray; image: boolean }
      | { kind: "plane"; layer: PixelLayer; placed: { pixels: Uint8ClampedArray; rest: ImagePlane | null } }
      | { kind: "imagePlane"; layer: PixelLayer; pixels: Uint8ClampedArray };
    const jobs: FlipJob[] = [];
    for (const layer of editTargets()) {
      if (selectionNow) {
        const image = layer.kind === "image";
        const source = image ? projectImagePlane(toPlane(layer), widthNow, heightNow) : layer.id === tab.activeLayerId ? pixelsRef.current : layer.pixels;
        const after = new Uint8ClampedArray(source);
        if (!flipSelectionHorizontal(after, span, selectionNow) || !buffersDiffer(source, after)) continue;
        jobs.push({ kind: "canvas", layer, before: image ? source : after, after, image });
      } else if (layer.kind === "image") {
        if (layer.imgW < 1 || layer.imgH < 1 || layer.pixels.length < layer.imgW * layer.imgH * 4) continue;
        const trial = new Uint8ClampedArray(layer.pixels);
        if (!flipSelectionHorizontal(trial, { width: layer.imgW, height: layer.imgH }, null)) continue;
        jobs.push({ kind: "imagePlane", layer, pixels: trial });
      } else {
        const source = layer.id === tab.activeLayerId ? pixelsRef.current : layer.pixels;
        const plane = pixelLayerPlane(source, widthNow, heightNow, layer.rest);
        if (!flipSelectionHorizontal(plane.pixels, { width: plane.width, height: plane.height }, null)) continue;
        jobs.push({ kind: "plane", layer, placed: shiftContentPlane(plane, 0, 0, widthNow, heightNow) });
      }
    }
    if (jobs.length > 0) {
      rememberEdit();
      for (const job of jobs) {
        if (job.kind === "canvas") {
          if (job.image) applyPlane(job.layer, commitCanvasDiff(toPlane(job.layer), job.before, job.after, widthNow, heightNow));
          else {
            job.layer.pixels = job.after;
            job.layer.png = "";
            if (job.layer.id === tab.activeLayerId) {
              pixelsRef.current = job.after;
              tab.pixels = job.after;
            }
          }
        } else if (job.kind === "imagePlane") {
          job.layer.pixels = job.pixels;
          job.layer.png = "";
        } else {
          job.layer.pixels = job.placed.pixels;
          job.layer.rest = job.placed.rest;
          job.layer.restPng = "";
          job.layer.png = "";
          if (job.layer.id === tab.activeLayerId) {
            pixelsRef.current = job.placed.pixels;
            tab.pixels = job.placed.pixels;
          }
        }
      }
      tab.pngDirty = true;
    }
    if (selectionNow) rememberSelection(mirrorSelectionHorizontal(selectionNow, span));
    if (jobs.length === 0 && !selectionNow) return;
    const partial = pixelPartial(tab);
    alphaUsedRef.current = partial;
    tab.alphaUsed = partial;
    setAlphaUsed(partial);
    if (!alphaEditRef.current) refreshUsed();
    paint();
    if (jobs.length > 0) scheduleSave();
  };

  const stageBlob = async (blob: Blob, name?: string, sourceId?: string | null) => {
    if (askRef.current?.kind === "blank") {
      notify("キャンバスの確認が終わるまで、画像は取り込みません。ピクセルキャンバスは変えていません。");
      return;
    }
    const decoded = await rgbaFromBlob(blob);
    if (!decoded) {
      notify("この画像は読み取れません。ピクセルキャンバスは変えていません。");
      return;
    }
    const originName = name?.trim() ?? "";
    setAsk({
      kind: "import",
      width: decoded.width,
      height: decoded.height,
      rgba: decoded.rgba,
      dotFit: isDotStillName(name),
      origin: originName || sourceId ? { id: sourceId ?? null, name: originName } : null,
    });
  };

  const stageLibrary = async (imageId: string, name?: string) => {
    const blob = await readPixels(imageId, "original");
    if (!blob || blob.size < 1) {
      notify("この画像は読み取れません。ピクセルキャンバスは変えていません。");
      return;
    }
    await stageBlob(blob, name, imageId);
  };

  const exportPixels = () => {
    const tab = currentTab();
    const widthNow = sizeRef.current;
    const heightNow = heightRef.current;
    let override = pixelsRef.current;
    const warpNow = warpRef.current;
    const image = activeImage();
    if (!image && warpNow && warpNow.tabId === activeIdRef.current && warpNow.base.length === widthNow * heightNow * 4) {
      override = warpPixels(warpNow.base, spanRef.current, warpNow.clip, warpNow.ox, warpNow.oy, warpNow, warpNow.scope === "selection" ? warpNow.beforeSelect : null).data;
    }
    const flat = tab
      ? compositePixelLayers(tab.layers, widthNow, heightNow, image ? null : { id: tab.activeLayerId, pixels: override }, { guides: false })
      : override;
    const partial = pixelPartial(tab);
    return partial && !alphaOnRef.current ? bakeOpaque(flat) : flat;
  };

  const copyPng = async () => {
    if (!readyRef.current) {
      notify("ピクセルキャンバスの準備ができるまでコピーできません。");
      return;
    }
    const clip = navigator.clipboard;
    if (!clip || typeof clip.write !== "function" || typeof ClipboardItem === "undefined") {
      notify("この環境では画像をクリップボードにコピーできません。ピクセルキャンバスの内容は変えていません。");
      return;
    }
    const pending = pngBlobRect(exportPixels(), sizeRef.current, heightRef.current).then((blob) => {
      if (!blob) throw new Error("empty");
      return blob;
    });
    try {
      await clip.write([new ClipboardItem({ "image/png": pending as unknown as Blob })]);
      notify("ピクセルキャンバスをコピーしました。");
    } catch {
      notify("クリップボードへのコピーに失敗しました。ピクセルキャンバスの内容は変えていません。");
    }
  };

  const savePng = async () => {
    if (saveLock.current) return;
    if (!readyRef.current) {
      notify("ピクセルキャンバスの準備ができるまで保存できません。");
      return;
    }
    const pick = pngSavePicker();
    if (!pick) {
      notify("この環境では保存先を選べません。ピクセルキャンバスの内容は変えていません。");
      return;
    }
    saveLock.current = true;
    const pending = pngBlobRect(exportPixels(), sizeRef.current, heightRef.current);
    try {
      let handle: SaveHandle;
      try {
        handle = await pick({
          suggestedName: `pixel-${sizeRef.current}x${heightRef.current}.png`,
          types: [{ description: "PNG", accept: { "image/png": [".png"] } }],
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        notify("保存先を選べませんでした。ピクセルキャンバスの内容は変えていません。");
        return;
      }
      const blob = await pending;
      if (!blob) {
        notify("ピクセルキャンバスを画像にできませんでした。内容は変えていません。");
        return;
      }
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      notify("ピクセルキャンバスを保存しました。");
    } catch {
      notify("ピクセルキャンバスを保存できませんでした。内容は変えていません。");
    } finally {
      saveLock.current = false;
    }
  };

  /** Visible layers only. A warp, resize, or trim preview is not baked in. */
  const folderPixels = () => {
    const width = sizeRef.current;
    const height = heightRef.current;
    const tab = currentTab();
    const activePixels = pixelsRef.current;
    if (!tab || tab.layers.length === 0) return activePixels;
    const pixelVisible = tab.layers.filter((layer) => layer.visible && layer.kind !== "image");
    if (pixelVisible.length === 1) {
      const only = pixelVisible[0];
      if (only && only.opacity >= 100) {
        const src = only.id === tab.activeLayerId ? activePixels : only.pixels;
        if (src && src.length >= width * height * 4) return src;
      }
    }
    return compositePixelLayers(tab.layers, width, height, activeImage() ? null : { id: tab.activeLayerId, pixels: activePixels }, { guides: false });
  };

  const addToFolder = async (scale: number) => {
    if (folderLock.current) {
      notify("拡大画像を追加しています。");
      return;
    }
    folderLock.current = true;
    try {
      if (!readyRef.current) {
        notify("ピクセルキャンバスの準備ができるまでフォルダには追加できません。");
        return;
      }
      if (!isPixelExportScale(scale)) {
        notify("拡大画像を作れなかったので、フォルダには追加していません。");
        return;
      }
      const tab = currentTab();
      const width = sizeRef.current;
      const height = heightRef.current;
      if (!tab || width < 1 || height < 1) {
        notify("拡大画像を作れなかったので、フォルダには追加していません。");
        return;
      }
      const scaled = scalePixelsNearest(folderPixels(), width, height, scale);
      const outW = width * scale;
      const outH = height * scale;
      if (scaled.length < outW * outH * 4) {
        notify("拡大画像を作れなかったので、フォルダには追加していません。");
        return;
      }
      const bytes = await encodeRgbaPng(scaled, outW, outH);
      if (!bytes) {
        notify("拡大画像を作れなかったので、フォルダには追加していません。");
        return;
      }
      const origin = tab.origin;
      await addPixelScaled({
        png: new Blob([new Uint8Array(bytes)], { type: "image/png" }),
        sourceId: origin?.id ?? null,
        baseName: origin?.name || tab.name || "pixel",
        scale,
      });
    } catch {
      notify("拡大画像を作れなかったので、フォルダには追加していません。");
    } finally {
      folderLock.current = false;
    }
  };

  const projectDocFromTab = (tab: TabLive): PixelProject => {
    const live = tab.id === activeIdRef.current;
    const width = live ? sizeRef.current : tab.width;
    const height = live ? heightRef.current : tab.height;
    const layers = tab.layers.map((layer) => {
      const planeW = layer.kind === "image" ? layer.imgW : width;
      const planeH = layer.kind === "image" ? layer.imgH : height;
      const source = layer.kind !== "image" && live && layer.id === tab.activeLayerId ? pixelsRef.current : layer.pixels;
      const need = planeW * planeH * 4;
      const pixels = source.length >= need ? new Uint8ClampedArray(source.subarray(0, need)) : createPixels(planeW, planeH);
      return {
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        kind: layer.kind,
        x: layer.kind === "image" ? layer.x : 0,
        y: layer.kind === "image" ? layer.y : 0,
        width: planeW,
        height: planeH,
        pixels,
        rest: layer.kind === "image" ? null : cloneRest(layer.rest),
      };
    });
    const active = Math.max(0, tab.layers.findIndex((layer) => layer.id === tab.activeLayerId));
    const symmetry = live ? symmetryRef.current : tab.symmetry;
    return {
      version: 1,
      name: tab.name,
      width,
      height,
      active,
      alphaOn: live ? alphaOnRef.current : tab.alphaOn,
      alphaUsed: live ? alphaUsedRef.current : tab.alphaUsed,
      extracted: live ? extractedRef.current : tab.extracted,
      used: (live ? usedRef.current : tab.used).map((color) => ({ r: color.r, g: color.g, b: color.b, a: color.a })),
      color: live ? colorRef.current : tab.color,
      zoom: live ? zoomPickRef.current : tab.zoom,
      panX: live ? panRef.current.x : tab.panX,
      panY: live ? panRef.current.y : tab.panY,
      symmetry: symmetry ? { ...symmetry } : null,
      selection: clonePixelSelection(live ? selectionRef.current : tab.select),
      originName: tab.origin?.name ?? "",
      originId: tab.origin?.id ?? null,
      layers,
    };
  };

  const rememberProject = (tabId: string, name: string, handle: SaveHandle | null) => {
    const tab = tabsRef.current.find((entry) => entry.id === tabId);
    if (!tab) return;
    tab.projectName = name;
    if (handle) projectLinks.current.set(tabId, { name, handle });
    scheduleSave();
  };

  const writeProjectBytes = async (tabId: string, bytes: Uint8Array, suggested: string, handle: SaveHandle | null) => {
    let target = handle;
    let name = suggested;
    if (!target) {
      const pick = pngSavePicker();
      if (!pick) {
        const blob = new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = suggested;
        link.click();
        URL.revokeObjectURL(url);
        rememberProject(tabId, suggested, null);
        notify("プロジェクトを保存しました。");
        return;
      }
      try {
        target = await pick({ suggestedName: suggested, types: [PROJECT_FILE_TYPE] });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        notify("保存先を選べませんでした。キャンバスの内容は変えていません。");
        return;
      }
      if (target.name) name = target.name;
    }
    try {
      const writable = await target.createWritable();
      await writable.write(new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }));
      await writable.close();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("プロジェクトを保存できませんでした。キャンバスの内容は変えていません。");
      return;
    }
    rememberProject(tabId, name, target);
    notify("プロジェクトを保存しました。");
  };

  const saveProject = async () => {
    if (projectLock.current) return;
    if (!readyRef.current) {
      notify("ピクセルキャンバスの準備ができるまで保存できません。");
      return;
    }
    if (askRef.current) return;
    const tab = currentTab();
    if (!tab) return;
    const doc = projectDocFromTab(tab);
    const suggested = pixelProjectFileName(tab.projectName || tab.origin?.name || tab.name);
    projectLock.current = true;
    try {
      const bytes = await encodePixelProject(doc);
      const link = projectLinks.current.get(tab.id);
      if (link?.handle) {
        projectSaveRef.current = { tabId: tab.id, bytes, name: link.name || suggested };
        setAsk({ kind: "project", name: link.name || suggested });
        return;
      }
      await writeProjectBytes(tab.id, bytes, suggested, null);
    } catch (error) {
      const message = error instanceof PixelProjectError ? error.message : "プロジェクトを保存できませんでした";
      notify(`${message}。キャンバスの内容は変えていません。`);
    } finally {
      if (!projectSaveRef.current) projectLock.current = false;
    }
  };

  const finishProjectAsk = () => {
    projectSaveRef.current = null;
    projectLock.current = false;
    setAsk(null);
  };

  const overwriteSavedProject = async () => {
    const pending = projectSaveRef.current;
    const link = pending ? projectLinks.current.get(pending.tabId) : null;
    if (!pending || !link?.handle) {
      finishProjectAsk();
      return;
    }
    setAsk(null);
    try {
      await writeProjectBytes(pending.tabId, pending.bytes, link.name, link.handle);
    } finally {
      projectSaveRef.current = null;
      projectLock.current = false;
    }
  };

  const saveProjectElsewhere = async () => {
    const pending = projectSaveRef.current;
    if (!pending) {
      finishProjectAsk();
      return;
    }
    setAsk(null);
    try {
      await writeProjectBytes(pending.tabId, pending.bytes, pixelProjectFileName(pending.name), null);
    } finally {
      projectSaveRef.current = null;
      projectLock.current = false;
    }
  };

  const tabFromProject = (doc: PixelProject, tabName: string, fileName: string): TabLive => {
    const width = doc.width;
    const height = doc.height;
    const layers: PixelLayer[] = doc.layers.map((layer) => {
      if (layer.kind === "image") {
        return {
          id: layerId(),
          name: layer.name.slice(0, 24) || "画像",
          visible: layer.visible,
          opacity: clampLayerOpacity(layer.opacity),
          kind: "image",
          x: layer.x,
          y: layer.y,
          imgW: layer.width,
          imgH: layer.height,
          pixels: layer.pixels,
          png: "",
          rest: null,
          restPng: "",
        };
      }
      return {
        id: layerId(),
        name: layer.name.slice(0, 24) || nextPixelLayerName([]),
        visible: layer.visible,
        opacity: clampLayerOpacity(layer.opacity),
        kind: "pixel",
        x: 0,
        y: 0,
        imgW: width,
        imgH: height,
        pixels: layer.pixels.length >= width * height * 4 ? layer.pixels : createPixels(width, height),
        png: "",
        rest: cloneRest(layer.rest),
        restPng: "",
      };
    });
    if (!layers.some((layer) => layer.kind !== "image")) layers.push(makeLayer(width, height));
    const index = doc.active >= 0 && doc.active < doc.layers.length ? doc.active : 0;
    const active = layers[index] ?? layers[0]!;
    const pixelTarget = active.kind !== "image" ? active : (layers.find((layer) => layer.kind !== "image") ?? active);
    const originName = doc.originName.trim();
    const square: PixelSize = width === height && isPixelSize(width) ? width : 64;
    return {
      id: `pix-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9)}`,
      name: tabName,
      size: square,
      width,
      height,
      pixels: pixelTarget.pixels,
      layers,
      activeLayerId: active.id,
      alphaOn: doc.alphaOn,
      alphaUsed: doc.alphaUsed,
      extracted: doc.extracted,
      used: doc.used.map((color) => ({ ...color })),
      color: doc.color,
      zoom: doc.zoom,
      panX: doc.panX,
      panY: doc.panY,
      png: "",
      pngDirty: true,
      select: clonePixelSelection(doc.selection),
      symmetry: doc.symmetry ? { ...doc.symmetry } : null,
      origin: originName || doc.originId ? { id: doc.originId, name: originName } : null,
      projectName: fileName,
    };
  };

  const ingestProject = async (file: File, handle: SaveHandle | null) => {
    if (file.size > PIXEL_PROJECT_MAX_BYTES) {
      notify("ファイルが大きすぎます。開いているタブは変えていません。");
      return;
    }
    let doc: PixelProject;
    try {
      doc = await decodePixelProject(new Uint8Array(await file.arrayBuffer()));
    } catch (error) {
      const message = error instanceof PixelProjectError ? error.message : "プロジェクトの内容が壊れています";
      notify(`${message}。開いているタブは変えていません。`);
      return;
    }
    if (!readyRef.current) return;
    const fileName = file.name.trim() || handle?.name || "pixel.pdxpixel";
    const taken = tabsRef.current.map((entry) => entry.name);
    const stored = doc.name.trim().slice(0, PIXEL_TAB_NAME_MAX);
    const tabName = stored ? (taken.includes(stored) ? duplicatePixelTabName(stored, taken) : stored) : pixelProjectTabName(fileName, taken);
    const tab = tabFromProject(doc, tabName, fileName);
    storeActive();
    tabsRef.current = [...tabsRef.current, tab];
    if (handle?.createWritable) projectLinks.current.set(tab.id, { name: handle.name || fileName, handle });
    showTab(tab);
    if (doc.zoom != null) {
      const next = clampZoom(doc.zoom);
      setZoomPick(next);
      setPan({ x: doc.panX, y: doc.panY });
    } else {
      fitCanvas();
    }
    chooseColor(doc.color);
    syncSheet();
    scheduleSave();
    notify("プロジェクトを新しいタブで開きました。");
  };

  const openProject = async () => {
    if (projectLock.current || askRef.current) return;
    if (!readyRef.current) {
      notify("ピクセルキャンバスの準備ができるまで読み込めません。");
      return;
    }
    const pick = projectOpenPicker();
    if (!pick) {
      projectFileRef.current?.click();
      return;
    }
    projectLock.current = true;
    try {
      let handle: SaveHandle;
      try {
        const handles = await pick({ multiple: false, types: [PROJECT_FILE_TYPE] });
        const first = handles[0];
        if (!first?.getFile) {
          notify("プロジェクトを読み込めませんでした。開いているタブは変えていません。");
          return;
        }
        handle = first;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        notify("プロジェクトを読み込めませんでした。開いているタブは変えていません。");
        return;
      }
      const file = await handle.getFile!();
      await ingestProject(file, handle);
    } catch {
      notify("プロジェクトを読み込めませんでした。開いているタブは変えていません。");
    } finally {
      projectLock.current = false;
    }
  };

  const actionsRef = useRef({ copy: copyPng, save: savePng, file: stageBlob, library: stageLibrary, folder: addToFolder, projectSave: saveProject, projectOpen: openProject });
  actionsRef.current = { copy: copyPng, save: savePng, file: stageBlob, library: stageLibrary, folder: addToFolder, projectSave: saveProject, projectOpen: openProject };

  useEffect(() => {
    const onSave = () => void actionsRef.current.save();
    const onCopy = () => void actionsRef.current.copy();
    const onFile = (event: Event) => {
      const file = (event as CustomEvent<{ file?: Blob & { name?: string } }>).detail?.file;
      if (file) void actionsRef.current.file(file, file.name);
    };
    const onLibrary = (event: Event) => {
      const detail = (event as CustomEvent<{ imageId?: string; name?: string }>).detail;
      if (detail?.imageId) void actionsRef.current.library(detail.imageId, detail.name);
    };
    const onFolder = (event: Event) => {
      const scale = (event as CustomEvent<{ scale?: number }>).detail?.scale;
      if (typeof scale === "number") void actionsRef.current.folder(scale);
    };
    const onProjectSave = () => void actionsRef.current.projectSave();
    const onProjectOpen = () => void actionsRef.current.projectOpen();
    window.addEventListener("komacho-pixel-save", onSave);
    window.addEventListener("komacho-pixel-copy", onCopy);
    window.addEventListener("komacho-pixel-file", onFile);
    window.addEventListener("komacho-pixel-library", onLibrary);
    window.addEventListener("komacho-pixel-folder", onFolder);
    window.addEventListener("komacho-pixel-project-save", onProjectSave);
    window.addEventListener("komacho-pixel-project-open", onProjectOpen);
    return () => {
      window.removeEventListener("komacho-pixel-save", onSave);
      window.removeEventListener("komacho-pixel-copy", onCopy);
      window.removeEventListener("komacho-pixel-file", onFile);
      window.removeEventListener("komacho-pixel-library", onLibrary);
      window.removeEventListener("komacho-pixel-folder", onFolder);
      window.removeEventListener("komacho-pixel-project-save", onProjectSave);
      window.removeEventListener("komacho-pixel-project-open", onProjectOpen);
    };
  }, []);

  const fitDotView = (canvasSize: number, imageWidth: number, imageHeight: number) => {
    const placed = containFit(imageWidth, imageHeight, canvasSize);
    const stage = stageRef.current;
    const stageHeight = stage ? Math.max(0, stage.clientHeight - 32) : 0;
    const next = fitPixelHeight(stageHeight, placed.dh);
    zoomRef.current = next;
    zoomPickRef.current = next;
    setZoomPick(next);
    panRef.current = { x: 0, y: 0 };
    setPan({ x: 0, y: 0 });
    const tab = currentTab();
    if (tab) {
      tab.zoom = next;
      tab.panX = 0;
      tab.panY = 0;
    }
  };

  const fitCanvas = () => {
    const fitted = fitPixelZoom(spaceRef.current, Math.max(sizeRef.current, heightRef.current));
    zoomPickRef.current = fitted;
    setZoomPick(fitted);
    panRef.current = { x: 0, y: 0 };
    setPan({ x: 0, y: 0 });
  };

  const confirmAsk = () => {
    const current = askRef.current;
    if (!current || !readyRef.current) return;
    if (current.kind === "project") return;
    if (current.kind === "close") {
      const list = tabsRef.current;
      if (list.length <= 1) {
        const only = list[0];
        if (only) {
          histories.current.set(only.id, { undo: [], redo: [] });
          selectHistories.current.set(only.id, { undo: [], redo: [] });
          dimHistories.current.set(only.id, { undo: [], redo: [] });
          setHistRev((value) => value + 1);
          const blank = createPixels(only.width, only.height);
          const solo = soloLayers(blank);
          only.layers = solo.layers;
          only.activeLayerId = solo.activeLayerId;
          only.pixels = blank;
          only.alphaOn = true;
          only.alphaUsed = false;
          only.extracted = false;
          only.used = [];
          only.zoom = null;
          only.panX = 0;
          only.panY = 0;
          only.png = "";
          only.pngDirty = true;
          only.select = null;
          only.origin = null;
          only.projectName = "";
          projectLinks.current.delete(only.id);
          showTab(only);
          chooseColor(PIXEL_DEFAULT_INDEX);
        }
      } else {
        const index = list.findIndex((tab) => tab.id === current.id);
        const next = list.filter((tab) => tab.id !== current.id);
        histories.current.delete(current.id);
        selectHistories.current.delete(current.id);
        dimHistories.current.delete(current.id);
        projectLinks.current.delete(current.id);
        tabsRef.current = next;
        if (current.id === activeIdRef.current) {
          const pick = next[Math.max(0, index - 1)] ?? next[0];
          if (pick) {
            showTab(pick);
            fitCanvas();
          }
        }
      }
      syncSheet();
      setAsk(null);
      scheduleSave();
      return;
    }
    if (current.kind === "blank") {
      if (current.size !== sizeRef.current || current.size !== heightRef.current) {
        const id = activeIdRef.current;
        if (id) histories.current.set(id, { undo: [], redo: [] });
        if (id) selectHistories.current.set(id, { undo: [], redo: [] });
        if (id) dimHistories.current.set(id, { undo: [], redo: [] });
        setHistRev((value) => value + 1);
      } else rememberEdit();
      assignGrid(current.size, current.size);
      const pixels = createPixels(current.size);
      const tab = currentTab();
      if (tab) {
        const solo = soloLayers(pixels);
        tab.layers = solo.layers;
        tab.activeLayerId = solo.activeLayerId;
        tab.pixels = pixels;
        tab.pngDirty = true;
        tab.origin = null;
      }
      pixelsRef.current = pixels;
      extractedRef.current = false;
      usedRef.current = [];
      alphaUsedRef.current = false;
      alphaOnRef.current = true;
      alphaEditRef.current = false;
      setExtracted(false);
      setUsed([]);
      setAlphaUsed(false);
      setAlphaOn(true);
      setAlphaEdit(false);
      chooseColor(PIXEL_DEFAULT_INDEX);
      rememberSelection(null);
    } else {
      const data = blitContain(current.rgba, current.width, current.height, sizeRef.current);
      rememberEdit();
      const colors = collectUsedColors(data, spanRef.current);
      const tab = currentTab();
      if (tab) {
        const solo = soloLayers(data);
        tab.layers = solo.layers;
        tab.activeLayerId = solo.activeLayerId;
        tab.pixels = data;
        tab.pngDirty = true;
        tab.origin = cloneOrigin(current.origin);
      }
      pixelsRef.current = data;
      extractedRef.current = true;
      usedRef.current = colors;
      const partial = hasPartialAlpha(data);
      alphaUsedRef.current = partial || alphaUsedRef.current;
      if (partial) alphaOnRef.current = true;
      setExtracted(true);
      setUsed(colors);
      setAlphaUsed(alphaUsedRef.current);
      setAlphaOn(alphaOnRef.current);
      alphaEditRef.current = false;
      setAlphaEdit(false);
      rememberSelection(null);
      const first = colors[0];
      if (first) chooseColor({ r: first.r, g: first.g, b: first.b });
      if (current.dotFit) fitDotView(sizeRef.current, current.width, current.height);
    }
    storeActive();
    clearMultiRef();
    syncLayers();
    setAsk(null);
    setRev((value) => value + 1);
    scheduleSave();
  };

  const dismissAsk = () => {
    if (askRef.current?.kind === "project") {
      projectSaveRef.current = null;
      projectLock.current = false;
    }
    setAsk(null);
  };

  const confirmImportAsNew = () => {
    const current = askRef.current;
    if (!current || current.kind !== "import" || !readyRef.current) return;
    const square = importCanvasSize(current.width, current.height);
    if (!square) {
      notify("この画像のサイズでは新しいキャンバスを作れません。今のキャンバスは変えていません。");
      return;
    }
    const data = blitContain(current.rgba, current.width, current.height, square);
    storeActive();
    const tab = makeTab(square, tabsRef.current.map((entry) => entry.name));
    const colors = collectUsedColors(data, square);
    const solo = soloLayers(data);
    tab.layers = solo.layers;
    tab.activeLayerId = solo.activeLayerId;
    tab.pixels = data;
    tab.extracted = true;
    tab.used = colors;
    tab.alphaUsed = hasPartialAlpha(data);
    tab.alphaOn = true;
    tab.pngDirty = true;
    tab.origin = cloneOrigin(current.origin);
    tabsRef.current = [...tabsRef.current, tab];
    showTab(tab);
    if (current.dotFit) fitDotView(square, current.width, current.height);
    syncSheet();
    setAsk(null);
    scheduleSave();
  };

  const openTab = (id: string) => {
    if (!readyRef.current || askRef.current || id === activeIdRef.current) return;
    if (floatMoveRef.current?.mode === "menu") return;
    if (floatMoveRef.current) confirmFloat();
    storeActive();
    const tab = tabsRef.current.find((entry) => entry.id === id);
    if (!tab) return;
    showTab(tab);
    fitCanvas();
  };
  openTabRef.current = openTab;

  useEffect(() => {
    const end = () => setGifOver(false);
    window.addEventListener("dragend", end);
    return () => window.removeEventListener("dragend", end);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      if (tabRenameIdRef.current || renameIdRef.current) return;
      if (!readyRef.current || askRef.current) return;
      if (pasteRef.current || warpRef.current || trimRef.current || floatMoveRef.current) return;
      if (document.querySelector("[role='dialog'][data-state='open'], [role='alertdialog']")) return;
      const tabs = tabsRef.current;
      const index = tabs.findIndex((tab) => tab.id === activeIdRef.current);
      if (index < 0) return;
      const next = event.key === "ArrowUp" ? index - 1 : index + 1;
      event.preventDefault();
      const id = tabs[next]?.id;
      if (!id) return;
      openTabRef.current(id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!tabMenu) return;
    const close = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".pixel-tab-menu")) return;
      setTabMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTabMenu(null);
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [tabMenu]);

  useEffect(() => {
    if (!layerMenu) return;
    const close = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".pixel-layer-menu")) return;
      setLayerMenu(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLayerMenu(null);
    };
    window.addEventListener("pointerdown", close, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", close, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [layerMenu]);

  const reorderTab = (id: string, beforeId: string | null) => {
    if (!beforeId || askRef.current) return;
    const next = moveTabOrder(tabsRef.current, id, beforeId);
    if (!next) return;
    tabsRef.current = next;
    syncSheet();
    scheduleSave();
  };

  const tabUnder = (x: number, y: number) => {
    const hit = document.elementFromPoint(x, y);
    const node = hit instanceof Element ? hit.closest("[data-pixel-tab]") : null;
    return node instanceof HTMLElement ? (node.dataset.pixelTab ?? null) : null;
  };

  const onTabNameDown = (event: ReactPointerEvent<HTMLButtonElement>, id: string) => {
    if (event.button !== 0 || askRef.current || tabRenameIdRef.current) return;
    suppressTabClick.current = false;
    tabDrag.current = { id, x: event.clientX, y: event.clientY, moved: false };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer still ends on pointerup */
    }
  };

  const onTabNameMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = tabDrag.current;
    if (!drag || drag.id !== event.currentTarget.dataset.pixelName) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
    drag.moved = true;
    const over = tabUnder(event.clientX, event.clientY);
    tabOverRef.current = over;
    setTabOver((current) => (current === over ? current : over));
  };

  const onTabNameUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = tabDrag.current;
    const before = tabOverRef.current ?? tabUnder(event.clientX, event.clientY);
    tabDrag.current = null;
    tabOverRef.current = null;
    setTabOver(null);
    if (!drag || drag.id !== event.currentTarget.dataset.pixelName) return;
    if (!drag.moved) return;
    suppressTabClick.current = true;
    reorderTab(drag.id, before);
  };

  const commitTabName = (id: string, value: string) => {
    if (tabRenameCancel.current) {
      tabRenameCancel.current = false;
      setTabRenameId(null);
      return;
    }
    const tab = tabsRef.current.find((entry) => entry.id === id);
    const name = value.trim().slice(0, PIXEL_TAB_NAME_MAX);
    setTabRenameId(null);
    if (!tab || !name || name === tab.name) return;
    tab.name = name;
    syncSheet();
    scheduleSave();
  };
  commitTabNameRef.current = commitTabName;

  const beginTabRename = (id: string) => {
    if (!readyRef.current || askRef.current) return;
    tabDrag.current = null;
    tabOverRef.current = null;
    setTabOver(null);
    setTabMenu(null);
    setTabRenameId(id);
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const id = tabRenameIdRef.current;
      if (!id) {
        swallowTabClickRef.current = false;
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest("input.pixel-tab-name")) return;
      const input = document.querySelector<HTMLInputElement>("input.pixel-tab-name");
      if (!input) return;
      swallowTabClickRef.current = true;
      event.preventDefault();
      event.stopPropagation();
      commitTabNameRef.current(id, input.value);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      const input = document.querySelector<HTMLInputElement>("input.pixel-tab-name");
      const inside = target instanceof Element && !!target.closest("input.pixel-tab-name");
      if (input && !inside && tabRenameIdRef.current) {
        swallowTabClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        commitTabNameRef.current(tabRenameIdRef.current, input.value);
        return;
      }
      if (!swallowTabClickRef.current) return;
      swallowTabClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("click", onClick, true);
    };
  }, []);

  const addTab = () => {
    if (!readyRef.current || askRef.current) return;
    storeActive();
    const edge = isPixelSize(sizeRef.current) && sizeRef.current === heightRef.current ? sizeRef.current : 64;
    const tab = makeTab(edge, tabsRef.current.map((entry) => entry.name));
    tabsRef.current = [...tabsRef.current, tab];
    showTab(tab);
    syncSheet();
    scheduleSave();
  };

  const duplicateTab = (id: string) => {
    if (!readyRef.current || askRef.current) return;
    storeActive();
    const source = tabsRef.current.find((entry) => entry.id === id);
    if (!source) return;
    const layers = source.layers.map((layer) => ({
      id: layerId(),
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      kind: layer.kind,
      x: layer.x,
      y: layer.y,
      imgW: layer.imgW,
      imgH: layer.imgH,
      pixels: new Uint8ClampedArray(layer.kind === "image" ? layer.pixels : layer.id === source.activeLayerId ? source.pixels : layer.pixels),
      png: "",
      rest: cloneRest(layer.rest),
      restPng: "",
    }));
    const active = layers[Math.max(0, source.layers.findIndex((layer) => layer.id === source.activeLayerId))] ?? layers[0];
    const pixelCopy = active && active.kind !== "image" ? active : layers.find((layer) => layer.kind !== "image");
    const copy: TabLive = {
      id: `pix-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9)}`,
      name: duplicatePixelTabName(source.name, tabsRef.current.map((entry) => entry.name)),
      size: source.size,
      width: source.width,
      height: source.height,
      pixels: pixelCopy?.pixels ?? new Uint8ClampedArray(source.pixels),
      layers,
      activeLayerId: active?.id ?? "",
      alphaOn: source.alphaOn,
      alphaUsed: source.alphaUsed,
      extracted: source.extracted,
      used: source.used.map((color) => ({ ...color })),
      color: source.color,
      zoom: source.zoom,
      panX: source.panX,
      panY: source.panY,
      png: "",
      pngDirty: true,
      select: clonePixelSelection(source.select),
      symmetry: source.symmetry ? { ...source.symmetry } : null,
      origin: cloneOrigin(source.origin),
      projectName: "",
    };
    const index = tabsRef.current.findIndex((entry) => entry.id === id);
    const next = tabsRef.current.slice();
    next.splice(index + 1, 0, copy);
    tabsRef.current = next;
    showTab(copy);
    fitCanvas();
    syncSheet();
    scheduleSave();
  };

  const openSheet = async (blob: Blob, name: string) => {
    if (!readyRef.current || askRef.current) return;
    const decoded = await rgbaFromBlob(blob);
    if (!decoded) {
      notify("スプライトシートを読めません。キャンバスは変えていません。");
      return;
    }
    setSheetDraft({ name, width: decoded.width, height: decoded.height, rgba: decoded.rgba, cols: 4, rows: 2 });
  };

  const confirmSheet = () => {
    if (!sheetDraft || !readyRef.current) return;
    const plan = splitPlan(sheetDraft.width, sheetDraft.height, sheetDraft.cols, sheetDraft.rows);
    if (!plan.ok) return;
    const square = fitPixelSquare(plan.frameW, plan.frameH);
    if (!square) {
      notify("分割後の画像が256を超えるため、キャンバスには入れていません。");
      return;
    }
    const base = sheetDraft.name.replace(/\.[^.]+$/, "").trim().slice(0, 10) || "シート";
    storeActive();
    const names = tabsRef.current.map((entry) => entry.name);
    const added: TabLive[] = [];
    for (let row = 0; row < sheetDraft.rows; row += 1) {
      for (let col = 0; col < sheetDraft.cols; col += 1) {
        const slice = sliceFrame(sheetDraft.rgba, sheetDraft.width, plan.frameW, plan.frameH, col, row);
        const pixels = placeSlice(slice, plan.frameW, plan.frameH, square);
        const tab = makeTab(square, names);
        tab.name = `${base} ${row + 1}-${col + 1}`.slice(0, 24);
        const solo = soloLayers(pixels);
        tab.layers = solo.layers;
        tab.activeLayerId = solo.activeLayerId;
        tab.pixels = pixels;
        tab.extracted = usesOffCube(pixels);
        tab.used = tab.extracted ? collectUsedColors(pixels, square) : [];
        tab.alphaUsed = hasPartialAlpha(pixels);
        tab.alphaOn = true;
        tab.pngDirty = true;
        added.push(tab);
        names.push(tab.name);
      }
    }
    tabsRef.current = [...tabsRef.current, ...added];
    const first = added[0];
    if (first) showTab(first);
    syncSheet();
    packHint.current = sheetDraft.cols;
    setSheetDraft(null);
    scheduleSave();
  };

  const openPack = () => {
    if (!readyRef.current || askRef.current) return;
    storeActive();
    const frames = tabsRef.current.map((tab) => ({
      id: tab.id,
      width: tab.width,
      height: tab.height,
      rgba: compositePixelLayers(
        tab.layers,
        tab.width,
        tab.height,
        tab.id === activeIdRef.current && tab.layers.find((layer) => layer.id === tab.activeLayerId)?.kind !== "image"
          ? { id: tab.activeLayerId, pixels: pixelsRef.current }
          : null,
        { guides: false },
      ),
      durationMs: null as null,
      flipX: false as const,
      flipY: false as const,
    }));
    if (frames.length === 0) return;
    setPack({ cols: Math.max(1, Math.min(frames.length, packHint.current || frames.length)), frames });
  };

  const savePacked = async () => {
    if (!pack) return;
    const built = composeSheet({ frames: pack.frames, layout: "wrap", columns: pack.cols });
    const pick = pngSavePicker();
    if (!pick) {
      notify("この環境では保存先を選べません。キャンバスは変えていません。");
      return;
    }
    const blob = await pngBlobRect(built.rgba, built.width, built.height);
    if (!blob) {
      notify("シートを画像にできませんでした。キャンバスは変えていません。");
      return;
    }
    try {
      const handle = await pick({
        suggestedName: "sprite-sheet.png",
        types: [{ description: "PNG", accept: { "image/png": [".png"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      notify("スプライトシートを保存しました。元のタブは変えていません。");
      setPack(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("シートを保存できませんでした。キャンバスは変えていません。");
    }
  };

  const askClose = (id: string) => {
    if (!readyRef.current || askRef.current) return;
    const tab = tabsRef.current.find((entry) => entry.id === id);
    if (!tab) return;
    if (!tab.layers.some((layer) => canvasHasInk(tab.id === activeIdRef.current && layer.id === tab.activeLayerId ? pixelsRef.current : layer.pixels))) {
      askRef.current = { kind: "close", id, last: tabsRef.current.length <= 1 };
      confirmAsk();
      return;
    }
    setAsk({ kind: "close", id, last: tabsRef.current.length <= 1 });
  };

  const onDrop = (event: ReactDragEvent<HTMLElement>) => {
    const types = Array.from(event.dataTransfer.types);
    if (types.includes(GIF_FRAME_DRAG)) {
      event.preventDefault();
      event.stopPropagation();
      setGifOver(false);
      notify("キャンバスにドロップしてください。今のキャンバスとフレーム一覧は変えていません。");
      return;
    }
    if (isInternalDrag(types)) return;
    event.preventDefault();
    event.stopPropagation();
    const files = imageFilesFrom(event.dataTransfer);
    if (files.length === 0) {
      notify("このドロップからは画像を読み取れません。ピクセルキャンバスは変えていません。");
      return;
    }
    void addImageLayers(files);
  };

  const addImageLayers = async (files: File[]) => {
    if (!readyRef.current || askRef.current) {
      notify("キャンバスの確認が終わるまで、画像レイヤーは追加しません。");
      return;
    }
    if (warpRef.current || canvasRef.current || trimRef.current || pasteRef.current) {
      notify("確定が終わるまで、画像レイヤーは追加しません。");
      return;
    }
    const tabId = currentTab()?.id;
    if (!tabId) return;
    const prepared: { name: string; width: number; height: number; rgba: Uint8ClampedArray }[] = [];
    for (const file of files) {
      const decoded = await readImageExact(file);
      if (!decoded) {
        notify(`「${file.name || "画像"}」は読み取れません。ほかの画像はそのままです。`);
        continue;
      }
      if (decoded.width > IMAGE_PLANE_MAX || decoded.height > IMAGE_PLANE_MAX) {
        notify(`「${file.name || "画像"}」は大きすぎるので、画像レイヤーには入れていません。`);
        continue;
      }
      prepared.push({ name: file.name.replace(/\.[^.]+$/, "").trim(), width: decoded.width, height: decoded.height, rgba: decoded.rgba });
    }
    const live = tabsRef.current.find((entry) => entry.id === tabId);
    if (!live || prepared.length === 0) return;
    if (activeIdRef.current === tabId) pushHistory(new Uint8ClampedArray(pixelsRef.current), selectionRef.current);
    for (const image of prepared) {
      const layer = makeImageLayer(image.width, image.height, image.rgba, image.name);
      const index = Math.max(0, live.layers.findIndex((entry) => entry.id === live.activeLayerId));
      live.layers.splice(index, 0, layer);
      live.activeLayerId = layer.id;
    }
    live.pngDirty = true;
    if (activeIdRef.current === tabId) {
      syncLayers();
      paint();
    }
    scheduleSave();
  };

  const beginOpacity = (id: string) => {
    opacityDrag.current = { id, armed: false };
  };

  const changeOpacity = (id: string, value: number) => {
    const tab = currentTab();
    if (!tab) return;
    const layer = tab.layers.find((entry) => entry.id === id);
    if (!layer) return;
    const next = clampLayerOpacity(value);
    if (next === layer.opacity) return;
    const drag = opacityDrag.current;
    if (!drag || drag.id !== id || !drag.armed) {
      pushHistory(new Uint8ClampedArray(pixelsRef.current), selectionRef.current);
      opacityDrag.current = { id, armed: true };
    }
    layer.opacity = next;
    tab.pngDirty = true;
    syncLayers();
    paint();
  };

  const endOpacity = () => {
    if (opacityDrag.current?.armed) scheduleSave();
    opacityDrag.current = null;
  };

  const opacityPopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editing = paste != null || (floatMove != null && floatMove.mode === "menu") || (warp != null && warp.tabId === activeId) || (trim != null && trim.tabId === activeId);
    if (!editing) return;
    const allowed = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      if (target.closest(".pixel-select-menu")) return true;
      if (target.closest(".pixel-frame")) return true;
      return false;
    };
    const block = (event: Event) => {
      if (allowed(event.target)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest(".pixel-pane, .pixel-select-kinds, .pixel-tab-menu, .pixel-layer-menu, .pixel-opacity-pop")) return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("pointerdown", block, true);
    window.addEventListener("click", block, true);
    window.addEventListener("contextmenu", block, true);
    return () => {
      window.removeEventListener("pointerdown", block, true);
      window.removeEventListener("click", block, true);
      window.removeEventListener("contextmenu", block, true);
    };
  }, [paste, warp, trim, activeId, floatMove]);

  useEffect(() => {
    if (!opacityOpenId) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(".pixel-opacity-pop, .pixel-layer-opacity-mini")) return;
      setOpacityOpenId(null);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
  }, [opacityOpenId]);

  useEffect(() => {
    return () => {
      if (opacityDrag.current?.armed) scheduleSave();
      opacityDrag.current = null;
    };
  }, [opacityOpenId]);

  useLayoutEffect(() => {
    if (!opacityOpenId) return;
    const place = () => {
      if (!layerRows.some((layer) => layer.id === opacityOpenId)) {
        setOpacityOpenId(null);
        return;
      }
      const anchor = document.querySelector(`[data-opacity-for="${CSS.escape(opacityOpenId)}"]`);
      const pop = opacityPopRef.current;
      if (!(anchor instanceof HTMLElement) || !pop) return;
      const rect = anchor.getBoundingClientRect();
      const margin = 8;
      const next = placeOpacityPanel(
        { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
        { w: pop.offsetWidth, h: pop.offsetHeight },
        { left: margin, top: margin, right: window.innerWidth - margin, bottom: window.innerHeight - margin },
      );
      setOpacityPos((current) => (current && Math.abs(current.x - next.x) < 0.5 && Math.abs(current.y - next.y) < 0.5 ? current : next));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [opacityOpenId, layerRows]);

  const takeGifFrame = (raw: string) => {
    const job = gifTake.current.catch(() => undefined).then(async () => {
      if (!readyRef.current || askRef.current) {
        notify("キャンバスの確認が終わるまで、フレームは取り込みません。今のキャンバスは変えていません。");
        return;
      }
      const drag = readGifFrameDrag(raw);
      if (!drag) {
        notify("このフレームは読めません。キャンバスは変えていません。");
        return;
      }
      const blob = await readPixels(drag.itemId, "original");
      if (!blob) {
        notify("元のGIFを読めません。フレーム一覧とキャンバスは変えていません。");
        return;
      }
      const session = openGifFrameSession(new Uint8Array(await blob.arrayBuffer()), browserFramePainter());
      try {
        const png = await session.png(drag.index);
        if (!png) {
          notify("このフレームは読み出せません。キャンバスは変えていません。");
          return;
        }
        const decoded = await rgbaFromBlob(png.blob);
        if (!decoded) {
          notify("このフレームは読めません。キャンバスは変えていません。");
          return;
        }
        const square = importCanvasSize(decoded.width, decoded.height);
        if (!square) {
          notify("このフレームのサイズでは新しいキャンバスを作れません。今のキャンバスは変えていません。");
          return;
        }
        const data = blitContain(decoded.rgba, decoded.width, decoded.height, square);
        storeActive();
        const tab = makeTab(square, tabsRef.current.map((entry) => entry.name));
        const colors = collectUsedColors(data, square);
        const solo = soloLayers(data);
        tab.layers = solo.layers;
        tab.activeLayerId = solo.activeLayerId;
        tab.pixels = data;
        tab.extracted = true;
        tab.used = colors;
        tab.alphaUsed = hasPartialAlpha(data);
        tab.alphaOn = true;
        tab.pngDirty = true;
        tabsRef.current = [...tabsRef.current, tab];
        showTab(tab);
        fitCanvas();
        tab.zoom = zoomPickRef.current;
        tab.panX = 0;
        tab.panY = 0;
        syncSheet();
        scheduleSave();
      } finally {
        session.release();
      }
    });
    gifTake.current = job.then(
      () => undefined,
      () => undefined,
    );
  };

  const touchLayer = () => {
    const tab = currentTab();
    if (!tab) return null;
    const layer = tab.layers.find((entry) => entry.id === tab.activeLayerId);
    if (layer && layer.kind !== "image") {
      layer.pixels = pixelsRef.current;
      tab.pixels = pixelsRef.current;
    }
    tab.pngDirty = true;
    return tab;
  };

  const selectLayer = (id: string) => {
    if (floatMoveRef.current) return;
    const tab = touchLayer();
    if (!tab || tab.activeLayerId === id) return;
    const layer = tab.layers.find((entry) => entry.id === id);
    if (!layer) return;
    tab.activeLayerId = id;
    if (layer.kind !== "image") {
      tab.pixels = layer.pixels;
      pixelsRef.current = layer.pixels;
    }
    clearMultiRef();
    syncLayers();
    paint();
    scheduleSave();
  };

  const addLayer = () => {
    if (!readyRef.current || askRef.current || warpRef.current || canvasRef.current || trimRef.current || pasteRef.current) return;
    const tab = touchLayer();
    if (!tab) return;
    pushHistory(new Uint8ClampedArray(pixelsRef.current), selectionRef.current);
    const layer = makeLayer(sizeRef.current, heightRef.current, tab.layers.map((entry) => entry.name));
    const index = Math.max(0, tab.layers.findIndex((entry) => entry.id === tab.activeLayerId));
    tab.layers.splice(index, 0, layer);
    tab.activeLayerId = layer.id;
    tab.pixels = layer.pixels;
    pixelsRef.current = layer.pixels;
    clearMultiRef();
    syncLayers();
    paint();
    scheduleSave();
  };

  const deleteLayer = (id: string) => {
    const tab = touchLayer();
    if (!tab || tab.layers.length <= 1) return;
    const index = tab.layers.findIndex((entry) => entry.id === id);
    const layer = tab.layers[index];
    if (index < 0 || !layer) return;
    if (layer.kind !== "image" && tab.layers.filter((entry) => entry.kind !== "image").length <= 1) {
      notify("通常レイヤーは最後の1枚を消せません。");
      return;
    }
    pushHistory(new Uint8ClampedArray(pixelsRef.current), selectionRef.current);
    const removedActive = layer.id === tab.activeLayerId;
    const heldPixels = layer.kind !== "image" && pixelsRef.current === layer.pixels;
    tab.layers.splice(index, 1);
    if (removedActive) {
      const next = tab.layers[Math.min(index, tab.layers.length - 1)];
      if (next) tab.activeLayerId = next.id;
      clearMultiRef();
    } else if (multiRefRef.current.has(id)) {
      replaceMultiRef([...multiRefRef.current].filter((entry) => entry !== id));
    }
    const activeNow = tab.layers.find((entry) => entry.id === tab.activeLayerId);
    if (activeNow && activeNow.kind !== "image") {
      tab.pixels = activeNow.pixels;
      pixelsRef.current = activeNow.pixels;
    } else if (heldPixels) {
      const pixelTarget = tab.layers.find((entry) => entry.kind !== "image");
      if (pixelTarget) {
        tab.pixels = pixelTarget.pixels;
        pixelsRef.current = pixelTarget.pixels;
      }
    }
    syncLayers();
    paint();
    scheduleSave();
  };

  const toggleLayer = (id: string) => {
    const tab = touchLayer();
    if (!tab) return;
    const layer = tab.layers.find((entry) => entry.id === id);
    if (!layer) return;
    layer.visible = !layer.visible;
    syncLayers();
    paint();
    scheduleSave();
  };

  const commitLayerName = (id: string, value: string) => {
    if (renameCancel.current) {
      renameCancel.current = false;
      setRenameId(null);
      return;
    }
    const tab = currentTab();
    const layer = tab?.layers.find((entry) => entry.id === id);
    const name = value.trim().slice(0, 24);
    setRenameId(null);
    if (!tab || !layer || !name || name === layer.name) return;
    touchLayer();
    pushHistory(new Uint8ClampedArray(pixelsRef.current), selectionRef.current);
    layer.name = name;
    syncLayers();
    scheduleSave();
  };
  commitNameRef.current = commitLayerName;

  const beginLayerRename = (id: string) => {
    layerDrag.current = null;
    setLayerDragId(null);
    setLayerGap(null);
    setOpacityOpenId(null);
    setRenameId(id);
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const id = renameIdRef.current;
      if (!id) {
        swallowClickRef.current = false;
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest("input.pixel-layer-name")) return;
      const input = document.querySelector<HTMLInputElement>("input.pixel-layer-name");
      if (!input) return;
      swallowClickRef.current = true;
      event.preventDefault();
      event.stopPropagation();
      commitNameRef.current(id, input.value);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      const input = document.querySelector<HTMLInputElement>("input.pixel-layer-name");
      const inside = target instanceof Element && !!target.closest("input.pixel-layer-name");
      if (input && !inside && renameIdRef.current) {
        swallowClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        commitNameRef.current(renameIdRef.current, input.value);
        return;
      }
      if (!swallowClickRef.current) return;
      swallowClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("click", onClick, true);
    };
  }, []);

  const mergeDown = () => {
    const tab = touchLayer();
    if (!tab) return;
    const index = tab.layers.findIndex((entry) => entry.id === tab.activeLayerId);
    const upper = tab.layers[index];
    const lower = tab.layers[index + 1];
    if (!upper || !lower) return;
    if (upper.kind === "image" || lower.kind === "image") {
      notify("画像レイヤーは通常レイヤーと結合できません。");
      return;
    }
    pushHistory(new Uint8ClampedArray(upper.pixels), selectionRef.current);
    const merged = mergeVisiblePair(upper.pixels, upper.visible, lower.pixels, lower.visible);
    lower.pixels = merged.pixels;
    lower.visible = merged.visible;
    lower.png = "";
    tab.layers.splice(index, 1);
    tab.activeLayerId = lower.id;
    tab.pixels = lower.pixels;
    pixelsRef.current = lower.pixels;
    syncLayers();
    paint();
    scheduleSave();
  };

  const stampDown = () => {
    const tab = touchLayer();
    if (!tab) return;
    const index = tab.layers.findIndex((entry) => entry.id === tab.activeLayerId);
    const upper = tab.layers[index];
    const lower = tab.layers[index + 1];
    if (!upper || !lower) return;
    if (upper.kind === "image" || lower.kind === "image") {
      notify("画像レイヤーは通常レイヤーに転写できません。");
      return;
    }
    pushHistory(new Uint8ClampedArray(upper.pixels), selectionRef.current);
    lower.pixels = stampLayerPixels(lower.pixels, upper.pixels);
    lower.png = "";
    syncLayers();
    paint();
    scheduleSave();
  };

  const layerGapAt = (clientY: number) => {
    const list = layerListRef.current;
    if (!list) return 0;
    const rows = [...list.querySelectorAll<HTMLElement>("[data-layer-id]")];
    for (let index = 0; index < rows.length; index += 1) {
      const rect = rows[index]!.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return rows.length;
  };

  const onLayerDown = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0 || renameIdRef.current) return;
    const target = event.target;
    if (target instanceof Element) {
      if (target.closest(".pixel-layer-opacity, .pixel-layer-opacity-mini, .pixel-opacity-pop, .pixel-layer-ref")) return;
      if (target.closest("button, input") && !target.closest(".pixel-layer-label")) return;
    }
    suppressLayerClick.current = false;
    const pointer = event.pointerId;
    layerDrag.current = { id, y: event.clientY, moved: false, pointer };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer still ends on pointerup */
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return;
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      if (!layerDrag.current || layerDrag.current.pointer !== pointer) return;
      finishLayerDrag(ev, ev.type !== "pointercancel");
    };
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
  };

  const onLayerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = layerDrag.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    if (!drag.moved && Math.abs(event.clientY - drag.y) < 4) return;
    if (!drag.moved) {
      drag.moved = true;
      setLayerDragId(drag.id);
    }
    event.preventDefault();
    const gap = layerGapAt(event.clientY);
    setLayerGap((current) => (current === gap ? current : gap));
  };

  const finishLayerDrag = (event: { clientY: number }, commit: boolean) => {
    const drag = layerDrag.current;
    layerDrag.current = null;
    setLayerGap(null);
    setLayerDragId(null);
    if (!drag) return;
    if (!drag.moved || !commit) {
      if (!drag.moved && commit) selectLayer(drag.id);
      return;
    }
    if (floatMoveRef.current?.mode === "tool") confirmFloat();
    if (floatMoveRef.current) return;
    suppressLayerClick.current = true;
    window.setTimeout(() => {
      suppressLayerClick.current = false;
    }, 0);
    const tab = touchLayer();
    if (!tab) return;
    const from = tab.layers.findIndex((entry) => entry.id === drag.id);
    const next = moveLayerIndex(tab.layers, from, layerGapAt(event.clientY));
    if (!next) return;
    pushHistory(new Uint8ClampedArray(pixelsRef.current), selectionRef.current);
    tab.layers = next;
    syncLayers();
    paint();
    scheduleSave();
  };

  const onLayerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    finishLayerDrag(event, true);
  };

  const onLayerCancel = () => {
    layerDrag.current = null;
    setLayerGap(null);
    setLayerDragId(null);
  };

  const beginLayerWidth = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startW = layerWidthRef.current;
    const move = (pointer: PointerEvent) => {
      const next = Math.round(startW + (startX - pointer.clientX));
      const clamped = Math.max(256, Math.min(320, next));
      pixelLayerWidth = clamped;
      layerWidthRef.current = clamped;
      setLayerWidth(clamped);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };

  const chosen = colorId === "clear" ? null : isRgbPick(colorId) ? { r: colorId.r, g: colorId.g, b: colorId.b, a: 255 } : (PIXEL_PALETTE[colorId] ?? PIXEL_PALETTE[PIXEL_DEFAULT_INDEX]!);
  const liveCanvas = canvasSize && canvasSize.tabId === activeId ? canvasSize : null;
  const previewFrame = liveCanvas ? canvasPreviewFrame(liveCanvas.width, liveCanvas.height, liveCanvas.nextW, liveCanvas.nextH, liveCanvas.ax, liveCanvas.ay) : null;
  const viewW = previewFrame ? previewFrame.viewW : size;
  const viewH = previewFrame ? previewFrame.viewH : height;
  const frameW = viewW * zoom;
  const frameH = viewH * zoom;
  const frame = Math.max(frameW, frameH);
  const paletteView = useMemo(() => (extracted ? splitUsedColors(used) : null), [extracted, used]);
  const rampSource = chosen ? { r: chosen.r, g: chosen.g, b: chosen.b } : { r: 0, g: 0, b: 0 };
  const approxBands = useMemo(() => approxColorBands(rampSource), [rampSource.r, rampSource.g, rampSource.b]);
  const usedColors = paletteView ? usedSwatchOrder([...paletteView.primary, ...paletteView.more]) : [];
  const historyNow = histories.current.get(activeId);
  const canUndo = histRev >= 0 && (historyNow?.undo.length ?? 0) > 0;
  const canRedo = histRev >= 0 && (historyNow?.redo.length ?? 0) > 0;
  const rgbOn = (color: PixelColor) => {
    if (isRgbPick(colorId)) return colorId.r === color.r && colorId.g === color.g && colorId.b === color.b;
    if (typeof colorId === "number") {
      const cube = PIXEL_PALETTE[colorId];
      return cube != null && cube.r === color.r && cube.g === color.g && cube.b === color.b;
    }
    return false;
  };
  const alphaChip = alphaSwatch(alphaStep);
  const sheetPlan = sheetDraft ? splitPlan(sheetDraft.width, sheetDraft.height, sheetDraft.cols, sheetDraft.rows) : null;
  const sheetSquare = sheetPlan?.ok ? fitPixelSquare(sheetPlan.frameW, sheetPlan.frameH) : null;
  const sheetCells = sheetDraft && sheetPlan?.ok ? sheetDraft.cols * sheetDraft.rows : 0;
  const packedSheet = useMemo(
    () => (pack ? composeSheet({ frames: pack.frames, layout: "wrap", columns: pack.cols }) : null),
    [pack],
  );
  const packedRows = pack ? Math.ceil(pack.frames.length / Math.max(1, pack.cols)) : 0;
  const packedMixed = pack ? pack.frames.some((frame) => frame.width !== pack.frames[0]?.width || frame.height !== pack.frames[0]?.height) : false;
  const box = selection ? selectionBox(selection) : null;
  const selLeft = box ? pan.x - frameW / 2 + box.x * zoom : 0;
  const selTop = box ? pan.y - frameH / 2 + box.y * zoom : 0;
  const selectPlace = box
    ? clampFollowMenu(selLeft, selTop + box.h * zoom, followBox.stageW, followBox.stageH, followBox.selectW, followBox.selectH)
    : null;
  const pasteRawLeft = paste ? pan.x - frameW / 2 + paste.x * zoom : 0;
  const pasteRawTop = paste ? pan.y - frameH / 2 + paste.y * zoom : 0;
  const pasteLeft = Math.max(-frameW / 2, Math.min(frameW / 2 - 96, pasteRawLeft));
  const pasteTop = Math.max(-frameH / 2, Math.min(frameH / 2 - 32, pasteRawTop));
  const pasteBelow = paste ? pasteRawTop < 36 : false;
  const liveFloat = floatMove && floatMove.mode === "menu" ? floatMove : null;
  const floatRawLeft = liveFloat ? pan.x - frameW / 2 + liveFloat.x * zoom : 0;
  const floatRawTop = liveFloat ? pan.y - frameH / 2 + liveFloat.y * zoom : 0;
  const floatPlace = liveFloat
    ? clampFollowMenu(floatRawLeft, floatRawTop + liveFloat.clip.h * zoom, followBox.stageW, followBox.stageH, followBox.floatW, followBox.floatH)
    : null;
  const liveWarp = warp && warp.tabId === activeId ? warp : null;
  const warpQuad = liveWarp ? warpCorners(liveWarp.clip, liveWarp) : null;
  const warpRawLeft = warpQuad ? pan.x - frameW / 2 + Math.min(...warpQuad.map((corner) => corner.x)) * zoom : 0;
  const warpRawTop = warpQuad ? pan.y - frameH / 2 + Math.min(...warpQuad.map((corner) => corner.y)) * zoom : 0;
  const warpLeft = Math.max(-frameW / 2, Math.min(frameW / 2 - 120, warpRawLeft));
  const warpTop = Math.max(-frameH / 2, Math.min(frameH / 2 - 32, warpRawTop));
  const warpBelow = liveWarp ? warpRawTop < 36 : false;
  const liveTrim = trim && trim.tabId === activeId ? trim : null;
  const trimRawLeft = liveTrim ? pan.x - frameW / 2 + liveTrim.bounds.x * zoom : 0;
  const trimRawTop = liveTrim ? pan.y - frameH / 2 + liveTrim.bounds.y * zoom : 0;
  const trimLeft = Math.max(-frameW / 2, Math.min(frameW / 2 - 168, trimRawLeft));
  const trimTop = Math.max(-frameH / 2, Math.min(frameH / 2 - 32, trimRawTop));
  const trimBelow = liveTrim ? trimRawTop < 36 : false;
  const draftWidth = canvasDraft ? readCanvasEdge(canvasDraft.widthText) : null;
  const draftHeight = canvasDraft ? readCanvasEdge(canvasDraft.heightText) : null;

  return (
    <section
      ref={paneRef}
      className={["canvas-pane", "pixel-pane", panning ? "is-panning" : "", layerMoving ? "is-layer-moving" : ""].filter(Boolean).join(" ")}
      data-tool={tool}
      aria-label="ピクセル"
      onPointerDown={(event) => event.stopPropagation()}
      onDragOver={(event) => {
        const types = Array.from(event.dataTransfer.types);
        if (types.includes(GIF_FRAME_DRAG)) {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "none";
          return;
        }
        if (isInternalDrag(types)) return;
        event.preventDefault();
      }}
      onDrop={onDrop}
    >
      <input
        ref={projectFileRef}
        type="file"
        accept=".pdxpixel,application/octet-stream"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file || projectLock.current) return;
          projectLock.current = true;
          void ingestProject(file, null).finally(() => {
            projectLock.current = false;
          });
        }}
      />
      <div className="pixel-work">
      <div className="pixel-toolrail" role="toolbar" aria-label="編集ツール">
        {TOOLS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            ref={entry.id === "select" ? selectToolRef : undefined}
            className={[tool === entry.id ? "is-on" : "", entry.id === "move" ? "is-move" : ""].filter(Boolean).join(" ") || undefined}
            aria-pressed={tool === entry.id}
            data-pixel-tool={entry.id}
            onClick={() => {
              moveRef.current = null;
              setLayerMoving(false);
              abandonEllipse(true);
              symmetryDrag.current = null;
              setSymmetryDraft(null);
              if (entry.id === "select") {
                toolRef.current = "select";
                setTool("select");
                setShapeOpen(true);
                return;
              }
              setShapeOpen(false);
              setTool(entry.id);
              if (entry.id === "move" && selectionRef.current && !floatMoveRef.current) beginFloat("tool");
            }}
          >
            {entry.id === "move" ? (
              <svg className="pixel-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2.75v18.5M2.75 12h18.5" />
                <path d="M12 2.75 9.1 5.65M12 2.75l2.9 2.9M12 21.25 9.1 18.35M12 21.25l2.9-2.9M2.75 12l2.9-2.9M2.75 12l2.9 2.9M21.25 12l-2.9-2.9M21.25 12l-2.9 2.9" />
              </svg>
            ) : null}
            {entry.label}
          </button>
        ))}
        <button
          type="button"
          className={tool === "warp" || liveWarp ? "is-on" : undefined}
          aria-pressed={tool === "warp" || !!liveWarp}
          disabled={!ready || ask !== null || paste !== null || liveCanvas !== null || liveTrim !== null}
          onClick={() => {
            if (pasteRef.current || canvasRef.current || trimRef.current) return;
            abandonEllipse(true);
            symmetryDrag.current = null;
            setSymmetryDraft(null);
            setTool("warp");
            if (!warpRef.current) beginWarp();
          }}
        >
          変形
        </button>
      </div>
      <div className="pixel-center">
      <div
        className={gifOver ? "pixel-stage is-frame-drop" : "pixel-stage"}
        ref={stageRef}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onAuxClick={(event) => event.preventDefault()}
        onDragEnter={(event) => {
          if (!Array.from(event.dataTransfer.types).includes(GIF_FRAME_DRAG)) return;
          event.preventDefault();
          event.stopPropagation();
          setGifOver(true);
        }}
        onDragOver={(event) => {
          if (!Array.from(event.dataTransfer.types).includes(GIF_FRAME_DRAG)) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
          if (!gifOver) setGifOver(true);
        }}
        onDragLeave={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && event.currentTarget.contains(next)) return;
          setGifOver(false);
        }}
        onDrop={(event) => {
          if (!Array.from(event.dataTransfer.types).includes(GIF_FRAME_DRAG)) return;
          event.preventDefault();
          event.stopPropagation();
          setGifOver(false);
          takeGifFrame(event.dataTransfer.getData(GIF_FRAME_DRAG));
        }}
      >
        {gifOver ? <p className="pixel-drop-hint">ドロップすると新しいキャンバスになります</p> : null}
        <div
          className="pixel-frame"
          ref={frameRef}
          style={{
            width: frameW,
            height: frameH,
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
            ["--pixel-zoom" as string]: `${zoom}px`,
          }}
        >
          <div className={backdrop === "checker" ? "pixel-checker" : `pixel-checker is-${backdrop}`} aria-hidden="true" />
          <canvas
            ref={viewRef}
            width={viewW}
            height={viewH}
            aria-label="ピクセルキャンバス"
            style={{ width: frameW, height: frameH }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={cancelStroke}
            onContextMenu={(event) => {
              event.preventDefault();
            }}
          />
          {grid ? <div className="pixel-grid" aria-hidden="true" /> : null}
          {selection || lassoDraft || gradLine || symmetry || symmetryDraft || paste || warp || liveCanvas || liveTrim ? (
            <canvas ref={selectMaskRef} className="pixel-select-mask" aria-hidden="true" />
          ) : null}
        </div>
        {selection && tool === "select" && !selecting && !paste && !warp && !liveCanvas && !liveTrim && !floatMove && selectPlace ? (
          <div
            ref={selectMenuRef}
            className="pixel-select-menu is-follow"
            style={{
              left: `calc(50% + ${selectPlace.left}px)`,
              top: `calc(50% + ${selectPlace.top}px)`,
            }}
            role="menu"
            aria-label="選択範囲"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => runSelection("clear")}>
              消去
            </button>
            <button type="button" onClick={() => runSelection("fill")}>
              塗りつぶし
            </button>
            <button
              type="button"
              onClick={() => {
                setShapeOpen(false);
                beginFloat("menu");
              }}
            >
              移動
            </button>
            <button
              type="button"
              onClick={() => {
                setShapeOpen(false);
                beginWarp();
              }}
            >
              変形
            </button>
            <button type="button" onClick={copyPixels}>
              コピー
            </button>
            <button type="button" onClick={cutPixels}>
              切り取り
            </button>
            <button type="button" onClick={invertSelectionMask}>
              範囲反転
            </button>
            <button type="button" onClick={deleteSelectionMask}>
              範囲削除
            </button>
          </div>
        ) : null}
        {liveFloat && floatPlace ? (
          <div
            ref={floatMenuRef}
            className="pixel-select-menu is-follow"
            style={{
              left: `calc(50% + ${floatPlace.left}px)`,
              top: `calc(50% + ${floatPlace.top}px)`,
            }}
            role="menu"
            aria-label="選択範囲の移動"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={confirmFloat}>
              決定
            </button>
            <button type="button" onClick={cancelFloat}>
              キャンセル
            </button>
          </div>
        ) : null}
        {paste ? (
          <div
            className={pasteBelow ? "pixel-select-menu is-below" : "pixel-select-menu"}
            style={{
              left: `calc(50% + ${pasteLeft}px)`,
              top: `calc(50% + ${pasteBelow ? pasteTop + (clip?.h ?? 0) * zoom : pasteTop}px)`,
            }}
            role="menu"
            aria-label="貼り付け"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={confirmPaste}>
              決定
            </button>
            <button type="button" onClick={cancelPaste}>
              キャンセル
            </button>
          </div>
        ) : null}
        {liveWarp ? (
          <div
            className={warpBelow ? "pixel-select-menu is-below" : "pixel-select-menu"}
            style={{
              left: `calc(50% + ${warpLeft}px)`,
              top: `calc(50% + ${warpTop}px)`,
            }}
            role="menu"
            aria-label="変形"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span>{liveWarp.scope === "selection" ? "選択範囲" : "画像全体"}</span>
            <button type="button" onClick={confirmWarp}>
              確定
            </button>
            <button type="button" onClick={cancelWarp}>
              キャンセル
            </button>
          </div>
        ) : null}
        {liveTrim ? (
          <div
            className={trimBelow ? "pixel-select-menu is-below" : "pixel-select-menu"}
            style={{
              left: `calc(50% + ${trimLeft}px)`,
              top: `calc(50% + ${trimTop}px)`,
            }}
            role="menu"
            aria-label="透明余白のトリミング"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span>
              {liveTrim.width}×{liveTrim.height} → {liveTrim.bounds.w}×{liveTrim.bounds.h}
            </span>
            <button type="button" onClick={confirmTrim}>
              確定
            </button>
            <button type="button" onClick={cancelTrim}>
              キャンセル
            </button>
          </div>
        ) : null}
      </div>
      <div className="pixel-split" role="separator" aria-orientation="horizontal" aria-label="キャンバスとメニューの境界" onPointerDown={beginSplit} />
      <div className="pixel-dock" style={dockPx != null ? { minHeight: dockPx } : undefined}>
        <div className="pixel-tool-rows">
          <div className="pixel-tools pixel-menu-line" role="toolbar" aria-label="編集操作">
            <button type="button" disabled={!ready || ask !== null || !canUndo || liveWarp !== null || canvasDraft !== null || liveTrim !== null} onClick={undoPixels}>
              アンドゥ
            </button>
            <button type="button" disabled={!ready || ask !== null || !canRedo || liveWarp !== null || canvasDraft !== null || liveTrim !== null} onClick={redoPixels}>
              リドゥ
            </button>
            <button type="button" disabled={!ready || ask !== null || liveWarp !== null || canvasDraft !== null || liveTrim !== null} onClick={askWipe}>
              全消去
            </button>
            <button type="button" disabled={!ready || ask !== null || liveWarp !== null || canvasDraft !== null || liveTrim !== null} onClick={flipHorizontal}>
              左右反転
            </button>
            <button
              type="button"
              disabled={!clip || paste !== null || liveWarp !== null || liveCanvas !== null || liveTrim !== null}
              onClick={() => {
                if (!pixelClipboard.clip || pasteRef.current || warpRef.current || canvasRef.current || trimRef.current) return;
                abandonEllipse(true);
                symmetryDrag.current = null;
                setSymmetryDraft(null);
                beginPaste();
              }}
            >
              ペースト
            </button>
            <button
              type="button"
              className={liveTrim ? "is-on" : undefined}
              aria-pressed={!!liveTrim}
              disabled={!ready || ask !== null || paste !== null || liveWarp !== null || canvasDraft !== null}
              onClick={() => {
                if (pasteRef.current || warpRef.current || canvasRef.current || trimRef.current) return;
                abandonEllipse(true);
                symmetryDrag.current = null;
                setSymmetryDraft(null);
                beginTrim();
              }}
            >
              透明余白をトリミング
            </button>
            <div className="pixel-zoom" role="group" aria-label="表示倍率">
              <button
                type="button"
                disabled={zoom <= PIXEL_ZOOM_MIN}
                onClick={() => {
                  const next = Math.max(PIXEL_ZOOM_MIN, zoom - 1);
                  zoomPickRef.current = next;
                  setZoomPick(next);
                  scheduleSave();
                }}
              >
                −
              </button>
              <span>×{zoom}</span>
              <button
                type="button"
                disabled={zoom >= PIXEL_ZOOM_MAX}
                onClick={() => {
                  const next = Math.min(PIXEL_ZOOM_MAX, zoom + 1);
                  zoomPickRef.current = next;
                  setZoomPick(next);
                  scheduleSave();
                }}
              >
                ＋
              </button>
              <button
                type="button"
                onClick={() => {
                  fitCanvas();
                  scheduleSave();
                }}
              >
                画面フィット
              </button>
            </div>
            <span className="pixel-menu-gap" aria-hidden="true" />
            <div className="pixel-zoom pixel-ground" role="group" aria-label="下地">
              <span className="pixel-ground-label">下地</span>
              <button type="button" className={backdrop === "checker" ? "is-on" : undefined} aria-pressed={backdrop === "checker"} aria-label="背景を市松模様にする" onClick={() => chooseBackdrop("checker")}>
                透明
              </button>
              {(
                [
                  ["white", "白"],
                  ["green", "緑"],
                  ["black", "黒"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" className={backdrop === id ? "is-on" : undefined} aria-pressed={backdrop === id} onClick={() => chooseBackdrop(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="pixel-tools pixel-menu-line" role="toolbar" aria-label="描画設定">
            <button type="button" className={perfect ? "is-on" : undefined} aria-pressed={perfect} onClick={() => setPerfect((current) => !current)}>
              ピクセルパーフェクト {perfect ? "ON" : "OFF"}
            </button>
            <button type="button" className={alphaEdit ? "is-on" : undefined} aria-pressed={alphaEdit} onClick={() => setAlphaEdit((current) => !current)}>
              透明度
            </button>
            {alphaUsed ? (
              <button
                type="button"
                className={alphaOn ? "is-on" : undefined}
                aria-pressed={alphaOn}
                onClick={() => {
                  const next = !alphaOnRef.current;
                  alphaOnRef.current = next;
                  const tab = currentTab();
                  if (tab) tab.alphaOn = next;
                  setAlphaOn(next);
                  setRev((value) => value + 1);
                  scheduleSave();
                }}
              >
                透明度反映 {alphaOn ? "ON" : "OFF"}
              </button>
            ) : null}
            <button type="button" className={grid ? "is-on" : undefined} aria-pressed={grid} onClick={() => setGrid((current) => !current)}>
              グリッド
            </button>
          </div>
          <div className="pixel-tools pixel-menu-line" role="toolbar" aria-label="キャンバス">
            <button
              type="button"
              disabled={!ready || ask !== null || canvasDraft !== null || liveWarp !== null || liveTrim !== null}
              onClick={() => {
                const edge = isPixelSize(size) && size === height ? size : 64;
                setAsk({ kind: "blank", size: edge });
              }}
            >
              リセット
            </button>
            <button
              type="button"
              className={canvasDraft ? "is-on" : undefined}
              aria-pressed={!!canvasDraft}
              disabled={!ready || ask !== null || paste !== null || liveWarp !== null || liveTrim !== null}
              onClick={() => {
                if (pasteRef.current || warpRef.current || canvasRef.current || trimRef.current) return;
                abandonEllipse(true);
                symmetryDrag.current = null;
                setSymmetryDraft(null);
                beginCanvas();
              }}
            >
              キャンバスサイズ
            </button>
            <span className="pixel-size-readout" aria-live="polite">
              {size}×{height}
            </span>
          </div>
          {liveWarp ? (
            <div className="pixel-tools pixel-warp">
              <span>{liveWarp.scope === "selection" ? "選択範囲" : "画像全体"}</span>
              {(
                [
                  ["width", "幅", String(warpEdge(liveWarp.clip.w, liveWarp.scaleX))],
                  ["height", "高さ", String(warpEdge(liveWarp.clip.h, liveWarp.scaleY))],
                  ["scaleX", "横倍", String(Math.round(liveWarp.scaleX * 100) / 100)],
                  ["scaleY", "縦倍", String(Math.round(liveWarp.scaleY * 100) / 100)],
                  ["degrees", "角度", String(liveWarp.degrees)],
                ] as const
              ).map(([field, label, value]) => (
                <label key={field}>
                  {label}
                  <input
                    type="number"
                    step={field === "scaleX" || field === "scaleY" ? "0.1" : "1"}
                    aria-label={`変形の${label}`}
                    value={warpText?.field === field ? warpText.text : value}
                    onFocus={() => setWarpText({ field, text: value })}
                    onChange={(event) => {
                      const text = event.target.value;
                      setWarpText({ field, text });
                      const parsed = Number(text);
                      if (!Number.isFinite(parsed) || !warpRef.current) return;
                      const current = warpRef.current;
                      if (field === "width") {
                        const scales = warpSetWidth(current.clip, current.scaleY, parsed, current.lock);
                        publishWarp({ ...current, ...scales });
                      } else if (field === "height") {
                        const scales = warpSetHeight(current.clip, current.scaleX, parsed, current.lock);
                        publishWarp({ ...current, ...scales });
                      } else if (field === "scaleX") {
                        const scaleX = clampWarpScale(current.clip.w, parsed);
                        publishWarp({ ...current, scaleX, scaleY: current.lock ? clampWarpScale(current.clip.h, scaleX) : current.scaleY });
                      } else if (field === "scaleY") {
                        const scaleY = clampWarpScale(current.clip.h, parsed);
                        publishWarp({ ...current, scaleY, scaleX: current.lock ? clampWarpScale(current.clip.w, scaleY) : current.scaleX });
                      } else {
                        publishWarp({ ...current, degrees: parsed });
                      }
                    }}
                    onBlur={() => setWarpText(null)}
                  />
                </label>
              ))}
              <button type="button" className={liveWarp.lock ? "is-on" : undefined} aria-pressed={liveWarp.lock} onClick={() => {
                const current = warpRef.current;
                if (!current) return;
                publishWarp({ ...current, lock: !current.lock, scaleY: current.lock ? current.scaleY : clampWarpScale(current.clip.h, current.scaleX) });
              }}>
                縦横比固定
              </button>
              <button type="button" onClick={() => { const current = warpRef.current; if (current) publishWarp({ ...current, degrees: 90 }); }}>90°</button>
              <button type="button" onClick={() => { const current = warpRef.current; if (current) publishWarp({ ...current, degrees: 180 }); }}>180°</button>
              <button type="button" onClick={() => { const current = warpRef.current; if (current) publishWarp({ ...current, degrees: 270 }); }}>270°</button>
              <label>
                補間
                <select
                  aria-label="変形の補間"
                  value={liveWarp.filter}
                  onChange={(event) => {
                    const current = warpRef.current;
                    if (!current) return;
                    publishWarp({ ...current, filter: event.target.value === "bilinear" ? "bilinear" : "nearest" });
                  }}
                >
                  <option value="nearest">最近傍</option>
                  <option value="bilinear">滑らか</option>
                </select>
              </label>
            </div>
          ) : null}
          {liveTrim ? (
            <div className="pixel-tools pixel-trim">
              <span>
                {liveTrim.width}×{liveTrim.height} → {liveTrim.bounds.w}×{liveTrim.bounds.h}
              </span>
              <span>左 {liveTrim.bounds.left}</span>
              <span>右 {liveTrim.bounds.right}</span>
              <span>上 {liveTrim.bounds.top}</span>
              <span>下 {liveTrim.bounds.bottom}</span>
            </div>
          ) : null}
        </div>
        <div className="pixel-bottom">
          <div className="pixel-colors">
            {alphaEdit ? (
              <div className="pixel-color-head">
                <span className="pixel-current" style={{ background: colorCss(alphaChip) }} aria-hidden="true" />
                <span className="pixel-current-name">透明度 {alphaStep}%</span>
              </div>
            ) : (
              <div className="pixel-color-head">
                <button type="button" className={colorId === "clear" ? "pixel-clear is-on" : "pixel-clear"} aria-pressed={colorId === "clear"} aria-label="透明" onClick={() => chooseColor("clear")}>
                  透明
                </button>
                <span className="pixel-current" style={chosen ? { background: colorCss(chosen) } : undefined} aria-hidden="true" />
                <span className="pixel-current-name">{chosen ? `RGB ${chosen.r} ${chosen.g} ${chosen.b}` : "透明"}</span>
              </div>
            )}
            <div className="pixel-palette-row">
            <div className="pixel-palette-main">
            <div className="pixel-palette-scroll">
              {alphaEdit ? (
                <div className="pixel-swatches is-alpha" role="listbox" aria-label="透明度">
                  {ALPHA_PERCENTS.map((percent) => {
                    const swatch = alphaSwatch(percent);
                    return (
                      <button
                        key={percent}
                        type="button"
                        role="option"
                        aria-selected={alphaStep === percent}
                        aria-label={`透明度 ${percent}%`}
                        className={alphaStep === percent ? "is-on" : undefined}
                        style={{ background: colorCss(swatch) }}
                        onClick={() => setAlphaStep(percent)}
                      />
                    );
                  })}
                </div>
              ) : usedColors.length > 0 && paletteView ? (
                <>
                  <div className="pixel-swatches is-used" role="listbox" aria-label="使用色">
                    {usedColors.map((color) => {
                      const on = rgbOn(color);
                      return (
                        <button
                          key={`${color.r}-${color.g}-${color.b}`}
                          type="button"
                          role="option"
                          aria-selected={on}
                          aria-label={`色 ${color.r} ${color.g} ${color.b}`}
                          className={on ? "is-on" : undefined}
                          style={{ background: colorCss(color) }}
                          onClick={() => chooseColor({ r: color.r, g: color.g, b: color.b })}
                        />
                      );
                    })}
                  </div>
                  <div className="pixel-palette-gap" aria-hidden="true" />
                  <div className="pixel-swatches" role="listbox" aria-label="追加色">
                    {paletteView.extra.filter((color) => isPaletteMono(color) == null).map((color) => {
                      const index = paletteIndex(color);
                      const on = index != null && colorId === index;
                      return (
                        <button
                          key={`x-${color.r}-${color.g}-${color.b}`}
                          type="button"
                          role="option"
                          aria-selected={on}
                          aria-label={`色 ${color.r} ${color.g} ${color.b}`}
                          className={on ? "is-on" : undefined}
                          style={{ background: colorCss(color) }}
                          onClick={() => {
                            if (index != null) chooseColor(index);
                          }}
                        />
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="pixel-swatches" role="listbox" aria-label="512色">
                  {PIXEL_PALETTE_ORDER.map((index) => {
                    const color = PIXEL_PALETTE[index];
                    if (!color) return null;
                    return (
                      <button
                        key={index}
                        type="button"
                        role="option"
                        aria-selected={colorId === index}
                        aria-label={`色 ${color.r} ${color.g} ${color.b}`}
                        className={colorId === index ? "is-on" : undefined}
                        style={{ background: colorCss(color) }}
                        onClick={() => chooseColor(index)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
            {drops.length > 0 ? (
            <div className="pixel-drops" role="listbox" aria-label="スポイト履歴">
              {drops.map((pick) => {
                const swatch = pick === "clear" ? null : isRgbPick(pick) ? { r: pick.r, g: pick.g, b: pick.b, a: 255 } : (PIXEL_PALETTE[pick] ?? null);
                const on = inkKey(pick) === inkKey(colorId);
                return (
                  <button
                    key={inkKey(pick)}
                    type="button"
                    role="option"
                    aria-selected={on}
                    aria-label={pick === "clear" || !swatch ? "履歴 透明" : `履歴 ${swatch.r} ${swatch.g} ${swatch.b}`}
                    className={[pick === "clear" ? "is-clear" : "", on ? "is-on" : ""].filter(Boolean).join(" ") || undefined}
                    style={swatch ? { background: colorCss(swatch) } : undefined}
                    onClick={() => chooseColor(pick)}
                  />
                );
              })}
            </div>
            ) : null}
            </div>
            <div className="pixel-approx" role="listbox" aria-label="近似値カラーパレット">
              <div className="pixel-approx-grid">
                {approxBands.white.map((color, index) => (
                  <button
                    key={`w-${index}`}
                    type="button"
                    role="option"
                    aria-label={`白方向 ${color.r} ${color.g} ${color.b}`}
                    style={{ background: colorCss({ ...color, a: 255 }) }}
                    onClick={() => {
                      const indexOnCube = paletteIndex(color);
                      chooseColor(indexOnCube != null ? indexOnCube : color);
                    }}
                  />
                ))}
                <span className="pixel-approx-pad" aria-hidden="true" />
                <span className="pixel-approx-pad" aria-hidden="true" />
                <span className="pixel-approx-pad" aria-hidden="true" />
                <button
                  type="button"
                  role="option"
                  className={chosen ? "is-current" : "is-current is-clear"}
                  aria-selected="true"
                  aria-label={chosen ? `現在の色 ${chosen.r} ${chosen.g} ${chosen.b}` : "現在の色 透明"}
                  style={chosen ? { background: colorCss(chosen) } : undefined}
                  onClick={() => chooseColor(colorId)}
                />
                <span className="pixel-approx-pad" aria-hidden="true" />
                <span className="pixel-approx-pad" aria-hidden="true" />
                <span className="pixel-approx-pad" aria-hidden="true" />
                {approxBands.black.map((color, index) => (
                  <button
                    key={`b-${index}`}
                    type="button"
                    role="option"
                    aria-label={`黒方向 ${color.r} ${color.g} ${color.b}`}
                    style={{ background: colorCss({ ...color, a: 255 }) }}
                    onClick={() => {
                      const indexOnCube = paletteIndex(color);
                      chooseColor(indexOnCube != null ? indexOnCube : color);
                    }}
                  />
                ))}
              </div>
            </div>
            </div>
          </div>

        </div>
      </div>
      </div>
      <div className="pixel-layer-split" role="separator" aria-orientation="vertical" aria-label="レイヤー一覧の幅" onPointerDown={beginLayerWidth} />
      <div className="pixel-side" style={{ width: Math.max(256, layerWidth) }}>
      <div className="pixel-overview" aria-label="全体プレビュー">
        <canvas ref={overviewRef} className="pixel-overview-canvas" width={size} height={height} aria-label="キャンバス全体のプレビュー" />
      </div>
      <aside className="pixel-layers" aria-label="レイヤー">
        <div className="pixel-layer-head">
          <span>レイヤー</span>
          <button type="button" onClick={addLayer} disabled={!ready || ask !== null || paste !== null || liveWarp !== null || liveCanvas !== null || liveTrim !== null}>
            追加
          </button>
        </div>
        {layerRows.find((layer) => layer.id === activeLayerId)?.kind === "image" ? (
          <>
            <p className="pixel-layer-note">画像レイヤーは完成画像に入りません</p>
            <div className="pixel-guide-size" role="group" aria-label="ガイド線の太さ">
              {GUIDE_PEN_SIZES.map((size) => (
                <button key={size} type="button" className={guideSize === size ? "is-on" : undefined} aria-pressed={guideSize === size} onClick={() => setGuideSize(size)}>
                  {size}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <div className="pixel-layer-list" ref={layerListRef}>
          {layerRows.map((layer, index) => (
            <div
              key={layer.id}
              data-layer-id={layer.id}
              className={["pixel-layer", layer.id === activeLayerId ? "is-on" : "", layer.kind === "image" ? "is-image" : "", layer.id === layerDragId ? "is-dragging" : ""].filter(Boolean).join(" ")}
              onPointerDown={(event) => onLayerDown(event, layer.id)}
              onPointerMove={onLayerMove}
              onPointerUp={onLayerUp}
              onPointerCancel={onLayerCancel}
              onDoubleClick={(event) => {
                const hit = document.elementFromPoint(event.clientX, event.clientY);
                if (!(hit instanceof Element) || !hit.closest(".pixel-layer-label")) return;
                event.preventDefault();
                event.stopPropagation();
                beginLayerRename(layer.id);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (floatMoveRef.current) return;
                selectLayer(layer.id);
                setLayerMenu({ id: layer.id, x: event.clientX, y: event.clientY });
              }}
            >
              {layerGap === index ? <span className="pixel-layer-gap" /> : null}
              <button
                type="button"
                className={layer.visible ? "pixel-layer-eye is-on" : "pixel-layer-eye"}
                aria-label={layer.visible ? `${layer.name}を非表示` : `${layer.name}を表示`}
                aria-pressed={layer.visible}
                onClick={() => toggleLayer(layer.id)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  {layer.visible ? (
                    <>
                      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  ) : (
                    <path d="M3 4l18 16M9.5 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3.2 3.6M6.1 7.8A18 18 0 0 0 2 12s3.5 6 10 6a11 11 0 0 0 4.2-.8" />
                  )}
                </svg>
              </button>
              <label className="pixel-layer-ref" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  aria-label={`${layer.name}を複数参照`}
                  checked={layer.id !== activeLayerId && multiRef.includes(layer.id)}
                  disabled={layer.id === activeLayerId}
                  onChange={() => toggleMultiRef(layer.id)}
                />
              </label>
              {renameId === layer.id ? (
                <input
                  className="pixel-layer-name"
                  defaultValue={layer.name}
                  aria-label="レイヤー名"
                  maxLength={24}
                  autoFocus
                  spellCheck={false}
                  onPointerDown={(event) => event.stopPropagation()}
                  onFocus={(event) => {
                    const input = event.currentTarget;
                    if (input.dataset.picked === "1") return;
                    input.dataset.picked = "1";
                    input.select();
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.nativeEvent.isComposing || event.key === "Process") return;
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitLayerName(layer.id, event.currentTarget.value);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      renameCancel.current = true;
                      setRenameId(null);
                    }
                  }}
                  onBlur={(event) => commitLayerName(layer.id, event.currentTarget.value)}
                />
              ) : (
                <button
                  type="button"
                  className="pixel-layer-label"
                  onMouseDown={(event) => {
                    if (event.detail > 1) event.preventDefault();
                  }}
                  onClick={(event) => {
                    if (suppressLayerClick.current) {
                      suppressLayerClick.current = false;
                      event.preventDefault();
                      return;
                    }
                    if (event.detail > 1) {
                      beginLayerRename(layer.id);
                      return;
                    }
                    selectLayer(layer.id);
                  }}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    beginLayerRename(layer.id);
                  }}
                >
                  {layer.name}
                </button>
              )}
              {layer.kind === "image" ? <span className="pixel-layer-badge">画像</span> : null}
              <button type="button" className="pixel-layer-x" aria-label={`${layer.name}を削除`} disabled={layerRows.length <= 1} onClick={() => deleteLayer(layer.id)}>
                ×
              </button>
              <button
                type="button"
                className={opacityOpenId === layer.id ? "pixel-layer-opacity-mini is-open" : "pixel-layer-opacity-mini"}
                data-opacity-for={layer.id}
                aria-expanded={opacityOpenId === layer.id}
                aria-label={`${layer.name}の不透明度`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpacityPos(null);
                  setOpacityOpenId((current) => (current === layer.id ? null : layer.id));
                }}
              >
                {layer.opacity}%
              </button>
            </div>
          ))}
          {layerGap === layerRows.length ? <span className="pixel-layer-gap" /> : null}
        </div>
        {opacityOpenId
          ? createPortal(
              <div
                ref={opacityPopRef}
                className="pixel-opacity-pop"
                role="dialog"
                aria-label="不透明度"
                style={{
                  left: opacityPos?.x ?? 0,
                  top: opacityPos?.y ?? 0,
                  visibility: opacityPos ? "visible" : "hidden",
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="pixel-opacity-pop-head">
                  <span>不透明度</span>
                  <span>{layerRows.find((entry) => entry.id === opacityOpenId)?.opacity ?? 0}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={layerRows.find((entry) => entry.id === opacityOpenId)?.opacity ?? 100}
                  aria-label="不透明度"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    beginOpacity(opacityOpenId);
                  }}
                  onInput={(event) => changeOpacity(opacityOpenId, Number(event.currentTarget.value))}
                  onChange={(event) => changeOpacity(opacityOpenId, Number(event.currentTarget.value))}
                  onPointerUp={endOpacity}
                  onBlur={endOpacity}
                />
              </div>,
              document.body,
            )
          : null}
      </aside>
        <div className="pixel-tab-col">
          <input
            ref={sheetInput}
            type="file"
            accept="image/png,image/gif,image/webp,image/jpeg,.png,.gif,.webp,.jpg,.jpeg"
            hidden
            aria-label="スプライトシートを読み込む"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void openSheet(file, file.name);
            }}
          />
          <div
            className="pixel-sheet-well"
            onDragOver={(event) => {
              if (isInternalDrag(Array.from(event.dataTransfer.types))) return;
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              if (isInternalDrag(Array.from(event.dataTransfer.types))) return;
              event.preventDefault();
              event.stopPropagation();
              const file = imageFilesFrom(event.dataTransfer)[0];
              if (!file) {
                notify("シートとして読める画像がありません。キャンバスは変えていません。");
                return;
              }
              void openSheet(file, file.name);
            }}
          >
            シートをドロップ
          </div>
          <div className="pixel-tab-board">
            <div className="pixel-tab-head">
              <p>キャンバス</p>
              <button type="button" disabled={!ready || ask !== null} onClick={() => sheetInput.current?.click()}>
                シート
              </button>
              <button type="button" disabled={!ready || ask !== null || sheet.length === 0} onClick={openPack}>
                再構成
              </button>
              <button type="button" disabled={!ready || ask !== null} onClick={addTab}>
                追加
              </button>
            </div>
            <aside className="pixel-tabs" aria-label="キャンバス">
            {sheet.map((tab) => (
              <div
                key={tab.id}
                className={["pixel-tab", tab.id === activeId ? "is-on" : "", tab.id === tabOver ? "is-drop" : ""].filter(Boolean).join(" ")}
                data-pixel-tab={tab.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!ready || ask) return;
                  const width = 132;
                  const height = 40;
                  const x = Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8));
                  const y = Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8));
                  setTabMenu({ id: tab.id, x, y });
                }}
                onDoubleClick={(event) => {
                  const hit = document.elementFromPoint(event.clientX, event.clientY);
                  if (!(hit instanceof Element) || !hit.closest(".pixel-tab-label")) return;
                  event.preventDefault();
                  event.stopPropagation();
                  beginTabRename(tab.id);
                }}
              >
                {tabRenameId === tab.id ? (
                  <input
                    className="pixel-tab-name"
                    defaultValue={tab.name}
                    aria-label="タブ名"
                    maxLength={PIXEL_TAB_NAME_MAX}
                    autoFocus
                    spellCheck={false}
                    onPointerDown={(event) => event.stopPropagation()}
                    onFocus={(event) => {
                      const input = event.currentTarget;
                      if (input.dataset.picked === "1") return;
                      input.dataset.picked = "1";
                      input.select();
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.nativeEvent.isComposing || event.key === "Process") return;
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitTabName(tab.id, event.currentTarget.value);
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        tabRenameCancel.current = true;
                        setTabRenameId(null);
                      }
                    }}
                    onBlur={(event) => commitTabName(tab.id, event.currentTarget.value)}
                  />
                ) : (
                  <button
                    type="button"
                    className="pixel-tab-label"
                    data-pixel-name={tab.id}
                    aria-pressed={tab.id === activeId}
                    onPointerDown={(event) => onTabNameDown(event, tab.id)}
                    onPointerMove={onTabNameMove}
                    onPointerUp={onTabNameUp}
                    onMouseDown={(event) => {
                      if (event.detail > 1) event.preventDefault();
                    }}
                    onClick={(event) => {
                      if (suppressTabClick.current) {
                        suppressTabClick.current = false;
                        return;
                      }
                      if (event.detail > 1) {
                        beginTabRename(tab.id);
                        return;
                      }
                      openTab(tab.id);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      beginTabRename(tab.id);
                    }}
                  >
                    {tab.name}
                  </button>
                )}
                <span className="pixel-tab-size">{(() => {
                  const live = tabsRef.current.find((entry) => entry.id === tab.id);
                  return live ? `${live.width}×${live.height}` : "";
                })()}</span>
                <button type="button" className="pixel-tab-x" aria-label={`${tab.name}を閉じる`} disabled={ask !== null} onClick={() => askClose(tab.id)} onDoubleClick={(event) => event.stopPropagation()}>
                  ×
                </button>
              </div>
            ))}
            </aside>
          </div>
        </div>
      </div>
      </div>
      {layerMenu
        ? createPortal(
            <div
              className="pixel-layer-menu"
              role="menu"
              aria-label="レイヤー操作"
              style={{ left: layerMenu.x, top: layerMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                type="button"
                role="menuitem"
                disabled={(() => {
                  const index = layerRows.findIndex((layer) => layer.id === layerMenu.id);
                  const upper = layerRows[index];
                  const lower = layerRows[index + 1];
                  return index < 0 || index >= layerRows.length - 1 || upper?.kind === "image" || lower?.kind === "image";
                })()}
                onClick={() => {
                  setLayerMenu(null);
                  mergeDown();
                }}
              >
                下のレイヤーと結合
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={(() => {
                  const index = layerRows.findIndex((layer) => layer.id === layerMenu.id);
                  const upper = layerRows[index];
                  const lower = layerRows[index + 1];
                  return index < 0 || index >= layerRows.length - 1 || upper?.kind === "image" || lower?.kind === "image";
                })()}
                onClick={() => {
                  setLayerMenu(null);
                  stampDown();
                }}
              >
                下のレイヤーに転写
              </button>
            </div>,
            document.body,
          )
        : null}
      {tabMenu
        ? createPortal(
            <div
              className="pixel-tab-menu"
              role="menu"
              aria-label="タブ"
              style={{ left: tabMenu.x, top: tabMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const id = tabMenu.id;
                  setTabMenu(null);
                  duplicateTab(id);
                }}
              >
                タブを複製
              </button>
            </div>,
            document.body,
          )
        : null}
      {tool === "select" && shapeOpen
        ? createPortal(
            <div
              ref={selectKindMenuRef}
              className="pixel-select-kinds"
              role="menu"
              aria-label="選択範囲の形状"
              style={{ left: selectKindPos?.x ?? -9999, top: selectKindPos?.y ?? 0 }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {(
                [
                  ["rect", "矩形"],
                  ["lasso", "投げ縄"],
                  ["wand", "マジックワンド"],
                  ["color", "色指定選択"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitemradio"
                  className={selectKind === kind ? "is-on" : undefined}
                  aria-checked={selectKind === kind}
                  onClick={() => {
                    setTool("select");
                    setSelectKind(kind);
                    setShapeOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
      {canvasDraft
        ? createPortal(
            <div className="canvas-flip-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) setCanvasDraft(null); }}>
              <div className="canvas-flip-dialog pixel-canvas-dialog" role="dialog" aria-modal="true" aria-labelledby="pixel-canvas-title" onPointerDown={(event) => event.stopPropagation()}>
                <p id="pixel-canvas-title">キャンバスサイズ</p>
                <p className="pixel-canvas-lead">
                  {size}×{height} → {canvasDraft.nextW}×{canvasDraft.nextH}
                </p>
                <div className="pixel-canvas-fields">
                  <label>
                    横幅
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="キャンバスの横幅"
                      value={canvasDraft.widthText}
                      onChange={(event) => {
                        const text = event.target.value;
                        const edge = readCanvasEdge(text);
                        setCanvasDraft((current) => (current ? { ...current, widthText: text, nextW: edge ?? current.nextW } : current));
                      }}
                    />
                  </label>
                  <label>
                    縦幅
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label="キャンバスの縦幅"
                      value={canvasDraft.heightText}
                      onChange={(event) => {
                        const text = event.target.value;
                        const edge = readCanvasEdge(text);
                        setCanvasDraft((current) => (current ? { ...current, heightText: text, nextH: edge ?? current.nextH } : current));
                      }}
                    />
                  </label>
                </div>
                {draftWidth == null || draftHeight == null ? <p className="pixel-canvas-note">1から256までの整数で指定してください。</p> : null}
                <div className="pixel-canvas-anchors" role="group" aria-label="元画像の配置位置">
                  {CANVAS_ANCHORS.map((anchor) => {
                    const on = canvasDraft.ax === anchor.ax && canvasDraft.ay === anchor.ay;
                    return (
                      <button
                        key={anchor.label}
                        type="button"
                        className={on ? "is-on" : undefined}
                        aria-pressed={on}
                        onClick={() => setCanvasDraft((current) => (current ? { ...current, ax: anchor.ax, ay: anchor.ay } : current))}
                      >
                        {anchor.label}
                      </button>
                    );
                  })}
                </div>
                <div className="pixel-canvas-preview">
                  <canvas ref={canvasPreviewRef} aria-label="変更後のキャンバスのプレビュー" />
                </div>
                <div className="canvas-flip-actions">
                  <button type="button" onClick={() => setCanvasDraft(null)}>
                    キャンセル
                  </button>
                  <button type="button" className="is-run" disabled={draftWidth == null || draftHeight == null} onClick={applyCanvasDraft}>
                    適用
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {ask
        ? createPortal(
            <div className="canvas-flip-overlay" onPointerDown={(event) => event.target === event.currentTarget && dismissAsk()}>
              <div
                className="canvas-flip-dialog pixel-ask-dialog"
                role="alertdialog"
                aria-modal="true"
                onPointerDown={(event) => event.stopPropagation()}
              >
                {ask.kind === "blank" ? (
                  <p>新しいキャンバスを作成すると、現在の描画内容は消去されます。よろしいですか？</p>
                ) : ask.kind === "close" ? (
                  <p>{ask.last ? "最後のキャンバスです。描いた内容を破棄して空にしますか？" : "このキャンバスを閉じます。描いた内容は破棄されます。よろしいですか？"}</p>
                ) : ask.kind === "project" ? (
                  <p>{`「${ask.name}」に上書きしますか？`}</p>
                ) : (
                  <>
                    <p>画像をキャンバスに取り込みますか？</p>
                    <p>「キャンバスサイズに合わせてドット化する」は、現在の描画内容を消去して画像を取り込みます。</p>
                    <p>「新しいキャンバスとしてドット化する」は、今のキャンバスを残したまま、別のタブに追加します。</p>
                  </>
                )}
                <div className={ask.kind === "import" || ask.kind === "project" ? "canvas-flip-actions is-import" : "canvas-flip-actions"}>
                  <button type="button" onClick={dismissAsk}>
                    キャンセル
                  </button>
                  {ask.kind === "import" ? (
                    <button type="button" className="is-alt" onClick={confirmImportAsNew}>
                      新しいキャンバスとしてドット化する
                    </button>
                  ) : null}
                  {ask.kind === "project" ? (
                    <button type="button" className="is-alt" onClick={() => void saveProjectElsewhere()}>
                      別名で保存
                    </button>
                  ) : null}
                  {ask.kind === "project" ? (
                    <button type="button" className="is-run" onClick={() => void overwriteSavedProject()}>
                      上書きする
                    </button>
                  ) : (
                    <button type="button" className="is-run" onClick={confirmAsk}>
                      {ask.kind === "blank" ? "作成" : ask.kind === "close" ? "閉じる" : "キャンバスサイズに合わせてドット化する"}
                    </button>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {sheetDraft
        ? createPortal(
            <div className="canvas-flip-overlay" onPointerDown={(event) => event.target === event.currentTarget && setSheetDraft(null)}>
              <div className="canvas-flip-dialog sprite-split" role="dialog" aria-modal="true" aria-labelledby="pixel-sheet-title" onPointerDown={(event) => event.stopPropagation()}>
                <p id="pixel-sheet-title">スプライトシートを分割して、新しいキャンバスタブに追加します。今あるタブと元の画像は変えません。</p>
                <p>
                  全体 {sheetDraft.width}×{sheetDraft.height}
                  {sheetPlan?.ok ? ` ・ 1マス ${sheetPlan.frameW}×${sheetPlan.frameH}` : ""}
                  {sheetSquare ? ` ・ キャンバス ${sheetSquare}×${sheetSquare}` : ""}
                </p>
                <div className="sprite-transport">
                  <label className="sprite-field">
                    列
                    <input
                      type="number"
                      min={1}
                      aria-label="分割の列数"
                      value={sheetDraft.cols}
                      onChange={(event) => setSheetDraft({ ...sheetDraft, cols: Math.max(1, Math.round(Number(event.target.value)) || 1) })}
                    />
                  </label>
                  <label className="sprite-field">
                    行
                    <input
                      type="number"
                      min={1}
                      aria-label="分割の行数"
                      value={sheetDraft.rows}
                      onChange={(event) => setSheetDraft({ ...sheetDraft, rows: Math.max(1, Math.round(Number(event.target.value)) || 1) })}
                    />
                  </label>
                </div>
                {sheetPlan?.ok && (sheetPlan.remW > 0 || sheetPlan.remH > 0) ? (
                  <p>{`端数があります。右 ${sheetPlan.remW}px、下 ${sheetPlan.remH}px は分割に含めません。画像は拡大縮小しません。`}</p>
                ) : null}
                {sheetPlan?.ok && sheetSquare && (sheetSquare !== sheetPlan.frameW || sheetSquare !== sheetPlan.frameH) ? (
                  <p>{`キャンバスは32刻みの正方形です。${sheetPlan.frameW}×${sheetPlan.frameH}は左上に置き、余ったマスは透明のままにします。`}</p>
                ) : null}
                {sheetPlan && !sheetPlan.ok ? <p>{sheetPlan.reason}</p> : null}
                {sheetPlan?.ok && sheetCells > 64 ? <p>プレビューは64マスまでです。確定すると全マスをタブにします。</p> : null}
                {sheetPlan?.ok ? (
                  <div className="sprite-split-preview" style={{ gridTemplateColumns: `repeat(${Math.min(sheetDraft.cols, 8)}, max-content)` }}>
                    {Array.from({ length: Math.min(sheetCells, 64) }, (_, index) => {
                      const col = index % sheetDraft.cols;
                      const row = Math.floor(index / sheetDraft.cols);
                      const rgba = sliceFrame(sheetDraft.rgba, sheetDraft.width, sheetPlan.frameW, sheetPlan.frameH, col, row);
                      const zoom = Math.max(1, Math.min(3, Math.floor(48 / Math.max(sheetPlan.frameW, sheetPlan.frameH))));
                      return <RgbaThumb key={`${col}-${row}`} rgba={rgba} width={sheetPlan.frameW} height={sheetPlan.frameH} zoom={zoom} />;
                    })}
                  </div>
                ) : null}
                <div className="canvas-flip-actions">
                  <button type="button" onClick={() => setSheetDraft(null)}>
                    キャンセル
                  </button>
                  <button type="button" className="is-run" disabled={!sheetPlan?.ok || !sheetSquare} onClick={confirmSheet}>
                    {sheetPlan?.ok && (sheetPlan.remW > 0 || sheetPlan.remH > 0) ? "端数を除いて分割" : "分割してタブにする"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {pack && packedSheet
        ? createPortal(
            <div className="canvas-flip-overlay" onPointerDown={(event) => event.target === event.currentTarget && setPack(null)}>
              <div className="canvas-flip-dialog sprite-split" role="dialog" aria-modal="true" aria-labelledby="pixel-pack-title" onPointerDown={(event) => event.stopPropagation()}>
                <p id="pixel-pack-title">タブを1枚のスプライトシートにします。タブ自体は消しません。</p>
                <p>
                  {pack.frames.length}枚 ・ {packedSheet.cols}列×{packedSheet.rows}行 ・ {packedSheet.width}×{packedSheet.height}
                  {packedSheet.cellW !== packedSheet.width || packedSheet.cellH !== packedSheet.height ? ` ・ 1マス ${packedSheet.cellW}×${packedSheet.cellH}` : ""}
                </p>
                <div className="sprite-transport">
                  <label className="sprite-field">
                    列
                    <input
                      type="number"
                      min={1}
                      max={pack.frames.length}
                      aria-label="再構成の列数"
                      value={pack.cols}
                      onChange={(event) => setPack({ ...pack, cols: Math.max(1, Math.min(pack.frames.length, Math.round(Number(event.target.value)) || 1)) })}
                    />
                  </label>
                  <label className="sprite-field">
                    行
                    <input
                      type="number"
                      min={1}
                      max={pack.frames.length}
                      aria-label="再構成の行数"
                      value={packedRows}
                      onChange={(event) => {
                        const rows = Math.max(1, Math.min(pack.frames.length, Math.round(Number(event.target.value)) || 1));
                        setPack({ ...pack, cols: Math.max(1, Math.ceil(pack.frames.length / rows)) });
                      }}
                    />
                  </label>
                </div>
                <p>画像は拡大縮小しません。タブの並び順のまま、左上から配置します。</p>
                {packedMixed ? <p>サイズが違うタブは、いちばん大きいキャンバスに合わせます。余った部分は透明です。</p> : null}
                {packedRows * pack.cols > pack.frames.length ? <p>最後の行に足りないマスは透明のままです。</p> : null}
                <div className="sprite-split-preview">
                  <RgbaThumb rgba={packedSheet.rgba} width={packedSheet.width} height={packedSheet.height} zoom={Math.max(1, Math.min(3, Math.floor(240 / Math.max(packedSheet.width, packedSheet.height))))} />
                </div>
                <div className="canvas-flip-actions">
                  <button type="button" onClick={() => setPack(null)}>
                    キャンセル
                  </button>
                  <button type="button" className="is-run" onClick={() => void savePacked()}>
                    PNGで保存
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
