import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { readKvString, readPixels, writeKv } from "@/lib/portfolio/db";
import { browserFramePainter } from "@/lib/portfolio/gif-frame-paint";
import { GIF_FRAME_DRAG, openGifFrameSession, readGifFrameDrag } from "@/lib/portfolio/gif-frame-session";
import { gifSavePicker } from "@/lib/portfolio/gif-save";
import { clampGifScale, encodeSpriteGif, SPRITE_GIF_SCALES, spriteGifOutputSize } from "@/lib/portfolio/sprite-gif";
import {
  SPRITE_DOC_KEY,
  SPRITE_ONION_KEY,
  adoptFrames,
  cellSize,
  clampFps,
  clampHoldMs,
  clampSpeed,
  composeOnionPreview,
  composeSheet,
  emptyOnionSkin,
  emptySpriteDoc,
  encodeOnionSkin,
  fittedSize,
  frameSizeReason,
  fpsHoldMs,
  framePivot,
  holdMs,
  integerPixelFit,
  moveSlice,
  nextSliceNumber,
  nineSliceRgba,
  pixelRect,
  placeSlice,
  playbackPreviewSteps,
  playbackStopIndex,
  playbackTimeline,
  reorderFrame,
  scaleNearest,
  setNineMargin,
  setNinePreviewSize,
  sheetGrid,
  shiftFrames,
  sliceFrame,
  splitPlan,
  spriteSettings,
  parseOnionSkin,
  PIVOT_PRESETS,
  pivotFromVisual,
  presetPivot,
  readPivot,
  readNines,
  readSlices,
  resizeSlice,
  slicePixels,
  slicePivot,
  visualPivot,
  defaultNine,
  deleteSpriteFrames,
  duplicateSpriteFrames,
  emptySpriteDocHistory,
  moveSpriteFrames,
  pickSpriteFrames,
  pushSpriteEdit,
  redoSpriteDoc,
  sameSpriteFrames,
  sameSpriteSlices,
  undoSpriteDoc,
  type NineEdge,
  type NineSlice,
  type OnionSkin,
  type SliceEdge,
  type SpriteDoc,
  type SpriteDocHistory,
  type SpriteDropPlace,
  type SpriteFrame,
  type SpriteLoop,
  type SpriteOrder,
  type SpritePivot,
  type SpriteSlice,
  type SheetLayout,
  type SpriteBackground,
} from "@/lib/portfolio/sprite-sheet";
import { notify } from "@/lib/portfolio/store";
import { OWN_FILE_DRAG, SHOT_DRAG } from "@/lib/portfolio/export-file";
import { TAG_DRAG } from "@/lib/portfolio/types";

type Transport = "stop" | "play" | "pause";

type SplitAsk = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  cols: number;
  rows: number;
};

type ShrinkAsk = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  origin: string;
};

let spriteTail: Promise<void> = Promise.resolve();

function spriteId(): string {
  return crypto.randomUUID();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return btoa(binary);
}

function pngBlob(data: Uint8ClampedArray, width: number, height: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob && blob.size > 0 ? blob : null), "image/png"));
}

async function encodePng(data: Uint8ClampedArray, width: number, height: number): Promise<string> {
  const blob = await pngBlob(data, width, height);
  if (!blob) return "";
  return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
}

function decodePng(base64: string): Promise<{ width: number; height: number; rgba: Uint8ClampedArray } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (width < 1 || height < 1) {
        resolve(null);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve({ width, height, rgba: new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data) });
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/png;base64,${base64}`;
  });
}

async function rgbaFromBlob(blob: Blob): Promise<{ width: number; height: number; rgba: Uint8ClampedArray } | null> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || bitmap.width < 1 || bitmap.height < 1) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, rgba: new Uint8ClampedArray(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data) };
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

function fileName(name: string, ext: string): string {
  const stem = (name.trim() || "スプライト").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 40);
  return `${stem}${ext}`;
}

async function saveBlob(blob: Blob, name: string, description: string, mime: string, ext: string): Promise<void> {
  const pick = gifSavePicker();
  if (pick) {
    try {
      const handle = await pick({ suggestedName: name, types: [{ description, accept: { [mime]: [ext] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      notify("書き出しました。");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("書き出せませんでした。スプライトの内容は変えていません。");
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
  notify("書き出しました。");
}

function FrameThumb({ frame, zoom }: { frame: SpriteFrame; zoom: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height), 0, 0);
  }, [frame]);
  return <canvas ref={ref} width={frame.width} height={frame.height} draggable={false} style={{ width: frame.width * zoom, height: frame.height * zoom, imageRendering: "pixelated" }} />;
}

function paintSpriteCanvas(node: HTMLCanvasElement | null, pixels: Uint8ClampedArray | null, width: number, height: number) {
  if (!node) return;
  if (node.width !== width) node.width = width;
  if (node.height !== height) node.height = height;
  const ctx = node.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  if (!pixels || pixels.length !== width * height * 4) return;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
}

export function SpriteBoard() {
  const [doc, setDoc] = useState<SpriteDoc>(emptySpriteDoc);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [history, setHistory] = useState<SpriteDocHistory>(emptySpriteDocHistory);
  const [transport, setTransport] = useState<Transport>("stop");
  const [shown, setShown] = useState(0);
  const [dropId, setDropId] = useState<string | null>(null);
  const [insertMark, setInsertMark] = useState<SpriteDropPlace | null>(null);
  const [split, setSplit] = useState<SplitAsk | null>(null);
  const [shrink, setShrink] = useState<ShrinkAsk | null>(null);
  const [wipe, setWipe] = useState(false);
  const [gifOver, setGifOver] = useState(false);
  const [previewLarge, setPreviewLarge] = useState(false);
  const [onion, setOnion] = useState<OnionSkin>(emptyOnionSkin);
  const [gifScale, setGifScale] = useState(1);
  const [pivotMode, setPivotMode] = useState(false);
  const [pivotMark, setPivotMark] = useState(true);
  const [pivotDraft, setPivotDraft] = useState<{ id: string; x: string; y: string } | null>(null);
  const [sliceTool, setSliceTool] = useState(false);
  const [nineOn, setNineOn] = useState(false);
  const [sliceId, setSliceId] = useState<string | null>(null);
  const [sliceDraft, setSliceDraft] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [sliceText, setSliceText] = useState<{ id: string; field: "name" | "x" | "y" | "w" | "h" | "px" | "py"; text: string } | null>(null);
  const [nineText, setNineText] = useState<{ id: string; field: string; text: string } | null>(null);
  const [holdDraft, setHoldDraft] = useState<{ key: string; text: string } | null>(null);
  const [largeBox, setLargeBox] = useState({ w: 0, h: 0 });
  const readyRef = useRef(false);
  const touchedRef = useRef(false);
  const onionTouched = useRef(false);
  const onionLoaded = useRef(false);
  const docRef = useRef(doc);
  const onionRef = useRef(onion);
  const shownRef = useRef(0);
  const playRef = useRef({ cursor: 0, acc: 0, loops: 0 });
  const playOrderRef = useRef(doc.order);
  const suppressClick = useRef(false);
  const selectedRef = useRef(selected);
  const anchorRef = useRef(anchorId);
  const editRef = useRef(editId);
  const historyRef = useRef(history);
  const transportRef = useRef<Transport>("stop");
  const pngInput = useRef<HTMLInputElement>(null);
  const sheetInput = useRef<HTMLInputElement>(null);
  const largeRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const largeCanvasRef = useRef<HTMLCanvasElement>(null);
  const timer = useRef(0);
  const onionTimer = useRef(0);
  const shrinkRef = useRef<ShrinkAsk | null>(null);
  const gifTake = useRef(Promise.resolve());
  const pivotDrag = useRef<"none" | "pending" | "saved">("none");
  const sliceDrag = useRef<"none" | "pending" | "saved">("none");
  const sliceGesture = useRef<
    | { kind: "draw"; ax: number; ay: number }
    | { kind: "move"; id: string; ax: number; ay: number; x: number; y: number }
    | { kind: "resize"; id: string; edge: SliceEdge; ax: number; ay: number; slice: SpriteSlice }
    | null
  >(null);
  const atlasRef = useRef<HTMLCanvasElement>(null);
  const nineSourceRef = useRef<HTMLCanvasElement>(null);
  const ninePreviewRef = useRef<HTMLCanvasElement>(null);
  const nineStageRef = useRef<HTMLDivElement>(null);
  const nineDrag = useRef<{ edge: NineEdge; pointer: number } | null>(null);
  const nineZoomRef = useRef(1);
  docRef.current = doc;
  onionRef.current = onion;
  shownRef.current = shown;
  selectedRef.current = selected;
  anchorRef.current = anchorId;
  editRef.current = editId;
  historyRef.current = history;
  transportRef.current = transport;

  const persist = () => {
    if (!readyRef.current) return Promise.resolve();
    const current = docRef.current;
    const job = spriteTail.catch(() => undefined).then(async () => {
      const frames = [];
      for (const frame of current.frames) {
        const png = await encodePng(frame.rgba, frame.width, frame.height);
        if (!png) return;
        frames.push({
          id: frame.id,
          width: frame.width,
          height: frame.height,
          png,
          durationMs: frame.durationMs,
          flipX: frame.flipX,
          flipY: frame.flipY,
          origin: frame.origin ?? null,
          ...(frame.pivot ? { pivot: { x: frame.pivot.x, y: frame.pivot.y } } : {}),
        });
      }
      const payload = JSON.stringify({ ...current, frames });
      await writeKv(SPRITE_DOC_KEY, payload);
    });
    spriteTail = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const scheduleSave = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void persistRef.current(), 200);
  };

  const flushOnion = () => {
    if (!onionLoaded.current) return;
    window.clearTimeout(onionTimer.current);
    onionTimer.current = 0;
    const payload = encodeOnionSkin(onionRef.current);
    const job = spriteTail.catch(() => undefined).then(() => writeKv(SPRITE_ONION_KEY, payload));
    spriteTail = job.then(
      () => undefined,
      () => undefined,
    );
  };

  const scheduleOnion = (next: OnionSkin) => {
    onionTouched.current = true;
    onionLoaded.current = true;
    onionRef.current = next;
    setOnion(next);
    window.clearTimeout(onionTimer.current);
    onionTimer.current = window.setTimeout(flushOnion, 200);
  };

  useEffect(() => {
    let alive = true;
    const job = spriteTail.catch(() => undefined).then(async () => {
      const raw = await readKvString(SPRITE_DOC_KEY, "");
      const onionRaw = await readKvString(SPRITE_ONION_KEY, "");
      return { raw, onionRaw };
    });
    spriteTail = job.then(
      () => undefined,
      () => undefined,
    );
    void job.then(async (loaded) => {
      if (!alive) return;
      const raw = loaded?.raw ?? "";
      if (!onionTouched.current) {
        const skin = parseOnionSkin(loaded?.onionRaw ?? "");
        onionRef.current = skin;
        setOnion(skin);
      }
      onionLoaded.current = true;
      let next = emptySpriteDoc();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<SpriteDoc> & { frames?: { id?: string; width?: number; height?: number; png?: string; durationMs?: number | null; flipX?: boolean; flipY?: boolean; origin?: string | null; pivot?: unknown }[]; slices?: unknown };
          const frames: SpriteFrame[] = [];
          const fps = clampFps(Number(parsed.fps));
          const fallback = fpsHoldMs(fps);
          for (const entry of parsed.frames ?? []) {
            if (!entry.png || !entry.id || !entry.width || !entry.height) continue;
            const decoded = await decodePng(entry.png);
            if (!decoded) continue;
            frames.push({
              id: entry.id,
              width: decoded.width,
              height: decoded.height,
              rgba: decoded.rgba,
              durationMs: typeof entry.durationMs === "number" ? clampHoldMs(entry.durationMs, fallback) : fallback,
              flipX: entry.flipX === true,
              flipY: entry.flipY === true,
              origin: typeof entry.origin === "string" && entry.origin.trim() ? entry.origin.trim().slice(0, 40) : null,
              pivot: readPivot(entry.pivot) ?? null,
            });
          }
          next = {
            ...emptySpriteDoc(),
            ...parsed,
            frames,
            slices: readSlices(parsed.slices),
            nines: readNines(parsed.nines),
            fps,
            speed: clampSpeed(Number(parsed.speed)),
          };
        } catch {
          next = emptySpriteDoc();
        }
      }
      if (!alive || touchedRef.current) {
        if (alive) setReady(true);
        return;
      }
      docRef.current = next;
      readyRef.current = true;
      setDoc(next);
      setReady(true);
    });
    return () => {
      alive = false;
      window.clearTimeout(timer.current);
      void persistRef.current();
      flushOnion();
    };
  }, []);

  const commit = (next: SpriteDoc, save = true) => {
    touchedRef.current = true;
    readyRef.current = true;
    docRef.current = next;
    setDoc(next);
    if (save) scheduleSave();
  };

  const reveal = (index: number) => {
    const frames = docRef.current.frames;
    const safe = frames.length === 0 ? 0 : Math.max(0, Math.min(index, frames.length - 1));
    const id = frames[safe]?.id ?? null;
    editRef.current = id;
    setEditId(id);
    shownRef.current = safe;
    setShown(safe);
  };

  const placeEdit = (frames: SpriteFrame[], preferred: string | null) => {
    if (frames.length === 0) {
      editRef.current = null;
      setEditId(null);
      if (transportRef.current !== "play") {
        shownRef.current = 0;
        setShown(0);
      }
      return;
    }
    const fallback = frames[Math.min(Math.max(0, shownRef.current), frames.length - 1)]!;
    const id = preferred && frames.some((frame) => frame.id === preferred) ? preferred : fallback.id;
    const index = Math.max(0, frames.findIndex((frame) => frame.id === id));
    editRef.current = id;
    setEditId(id);
    if (transportRef.current !== "play") {
      shownRef.current = index;
      setShown(index);
    }
  };

  const replaceFrames = (nextFrames: SpriteFrame[]) => {
    const before = docRef.current.frames;
    if (sameSpriteFrames(before, nextFrames)) return false;
    const nextHistory = pushSpriteEdit(historyRef.current, { kind: "frames", frames: before });
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    commit(adoptFrames(docRef.current, nextFrames));
    return true;
  };

  const restoreFrames = (nextHistory: SpriteDocHistory, frames: SpriteFrame[]) => {
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    commit(adoptFrames(docRef.current, frames));
    const live = new Set(frames.map((frame) => frame.id));
    setSelected((current) => current.filter((id) => live.has(id)));
    setAnchorId((current) => (current && live.has(current) ? current : null));
    placeEdit(frames, editRef.current && live.has(editRef.current) ? editRef.current : null);
  };

  const undoFrames = () => {
    const restored = undoSpriteDoc(historyRef.current, { frames: docRef.current.frames, slices: docRef.current.slices ?? [] });
    if (!restored) return;
    if (restored.edit.kind === "frames") {
      restoreFrames(restored.history, restored.edit.frames);
      return;
    }
    historyRef.current = restored.history;
    setHistory(restored.history);
    const slices = restored.edit.slices;
    commit({ ...docRef.current, slices });
    const ids = new Set(slices.map((slice) => slice.id));
    setSliceId((current) => (current && ids.has(current) ? current : slices.at(-1)?.id ?? null));
  };

  const redoFrames = () => {
    const restored = redoSpriteDoc(historyRef.current, { frames: docRef.current.frames, slices: docRef.current.slices ?? [] });
    if (!restored) return;
    if (restored.edit.kind === "frames") {
      restoreFrames(restored.history, restored.edit.frames);
      return;
    }
    historyRef.current = restored.history;
    setHistory(restored.history);
    const slices = restored.edit.slices;
    commit({ ...docRef.current, slices });
    const ids = new Set(slices.map((slice) => slice.id));
    setSliceId((current) => (current && ids.has(current) ? current : slices.at(-1)?.id ?? null));
  };

  const addFrames = (frames: SpriteFrame[]) => {
    if (frames.length === 0) return;
    const fallback = fpsHoldMs(docRef.current.fps);
    const stamped = frames.map((frame) => ({
      ...frame,
      durationMs: frame.durationMs == null ? fallback : clampHoldMs(frame.durationMs, fallback),
    }));
    if (!replaceFrames(docRef.current.frames.concat(stamped))) return;
    setSelected(stamped.map((frame) => frame.id));
    setAnchorId(stamped[0]?.id ?? null);
  };

  const stageBlob = async (blob: Blob, label: string) => {
    const decoded = await rgbaFromBlob(blob);
    if (!decoded) {
      notify(`${label}は読めません。スプライトには追加していません。`);
      return;
    }
    const reason = frameSizeReason(decoded.width, decoded.height);
    if (reason) {
      notify(`${label}は${reason}`);
      return;
    }
    addFrames([{ id: spriteId(), ...decoded, durationMs: null, flipX: false, flipY: false }]);
  };

  const stageFiles = async (files: readonly File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/") || /\.(png|gif|webp|jpe?g)$/i.test(file.name));
    if (images.length === 0) {
      notify("画像として読めないため、フレームには追加していません。");
      return;
    }
    for (const file of images) await stageBlob(file, file.name || "画像");
  };

  const offerPixels = (decoded: { width: number; height: number; rgba: Uint8ClampedArray }, origin: string | null) => {
    addFrames([{ id: spriteId(), ...decoded, durationMs: null, flipX: false, flipY: false, origin }]);
  };

  const takeGifFrame = (raw: string) => {
    const job = gifTake.current.catch(() => undefined).then(async () => {
      const drag = readGifFrameDrag(raw);
      if (!drag) {
        notify("このフレームは読めません。スプライトには追加していません。");
        return;
      }
      const origin = `GIF ${drag.index + 1}`;
      if (shrinkRef.current) {
        notify("先に縮小の確認を終えてください。このフレームはまだ追加していません。");
        return;
      }
      const blob = await readPixels(drag.itemId, "original");
      if (!blob) {
        notify("元のGIFを読めません。フレーム一覧とスプライトは変えていません。");
        return;
      }
      const session = openGifFrameSession(new Uint8Array(await blob.arrayBuffer()), browserFramePainter());
      try {
        const png = await session.png(drag.index);
        if (!png) {
          notify(`${origin}は読み出せません。スプライトには追加していません。`);
          return;
        }
        const decoded = await rgbaFromBlob(png.blob);
        if (!decoded) {
          notify(`${origin}は読めません。スプライトには追加していません。`);
          return;
        }
        if (frameSizeReason(decoded.width, decoded.height)) {
          const ask = { ...decoded, origin };
          shrinkRef.current = ask;
          setShrink(ask);
          return;
        }
        offerPixels(decoded, origin);
      } finally {
        session.release();
      }
    });
    gifTake.current = job.then(
      () => undefined,
      () => undefined,
    );
  };

  const confirmShrink = () => {
    const ask = shrinkRef.current;
    if (!ask) return;
    const fit = fittedSize(ask.width, ask.height);
    const rgba = scaleNearest(ask.rgba, ask.width, ask.height, fit.width, fit.height);
    const reason = frameSizeReason(fit.width, fit.height);
    shrinkRef.current = null;
    setShrink(null);
    if (reason) {
      notify(`${ask.origin}は縮小後も登録できません。スプライトは変えていません。`);
      return;
    }
    offerPixels({ width: fit.width, height: fit.height, rgba }, ask.origin);
  };

  const cancelShrink = () => {
    shrinkRef.current = null;
    setShrink(null);
  };

  const gifDrag = (types: Iterable<string>) => Array.from(types).includes(GIF_FRAME_DRAG);

  const onSpriteDragOver = (event: ReactDragEvent<HTMLElement>) => {
    const types = Array.from(event.dataTransfer.types);
    if (types.includes(SHOT_DRAG) || types.includes(OWN_FILE_DRAG) || types.includes(TAG_DRAG)) return;
    if (gifDrag(types)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setGifOver(true);
      return;
    }
    event.preventDefault();
  };

  const onSpriteDrop = (event: ReactDragEvent<HTMLElement>) => {
    const types = Array.from(event.dataTransfer.types);
    if (types.includes(SHOT_DRAG) || types.includes(OWN_FILE_DRAG) || types.includes(TAG_DRAG)) return;
    event.preventDefault();
    event.stopPropagation();
    setGifOver(false);
    if (gifDrag(types)) {
      takeGifFrame(event.dataTransfer.getData(GIF_FRAME_DRAG));
      return;
    }
    const files = Array.from(event.dataTransfer.files);
    void stageFiles(files);
  };

  useEffect(() => {
    const onLibrary = (event: Event) => {
      const imageId = (event as CustomEvent<{ imageId?: string }>).detail?.imageId;
      if (!imageId) return;
      void readPixels(imageId, "original").then((blob) => {
        if (!blob) {
          notify("この画像は読めません。一覧の元画像は変えていません。");
          return;
        }
        return stageBlob(blob, "一覧の画像");
      });
    };
    const onFiles = (event: Event) => {
      const files = (event as CustomEvent<{ files?: File[] }>).detail?.files ?? [];
      void stageFiles(files);
    };
    window.addEventListener("komacho-sprite-library", onLibrary);
    window.addEventListener("komacho-sprite-files", onFiles);
    return () => {
      window.removeEventListener("komacho-sprite-library", onLibrary);
      window.removeEventListener("komacho-sprite-files", onFiles);
    };
  }, []);

  const timelineKey = [
    doc.fps,
    doc.speed,
    doc.loop,
    doc.loopCount,
    doc.startFrame,
    doc.endFrame,
    doc.frames.map((frame) => `${frame.id}:${frame.durationMs ?? ""}:${frame.flipX ? 1 : 0}${frame.flipY ? 1 : 0}`).join("|"),
  ].join("/");

  useEffect(() => {
    if (transport !== "play") return;
    let alive = true;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      if (!alive || transportRef.current !== "play") return;
      const order = playOrderRef.current;
      const steps = playbackPreviewSteps({ ...docRef.current, order });
      if (steps.length === 0) {
        transportRef.current = "stop";
        setTransport("stop");
        return;
      }
      const state = playRef.current;
      if (state.cursor >= steps.length) state.cursor = 0;
      state.acc += now - last;
      last = now;
      let guard = 0;
      while (guard < 12 && state.acc >= (steps[state.cursor]?.ms ?? 10)) {
        state.acc -= steps[state.cursor]!.ms;
        state.cursor += 1;
        guard += 1;
        if (state.cursor >= steps.length) {
          const loop = docRef.current.loop;
          const count = Math.max(1, Math.round(docRef.current.loopCount) || 1);
          state.loops += 1;
          if (loop === "once" || (loop === "count" && state.loops >= count)) {
            reveal(playbackStopIndex(steps, order));
            transportRef.current = "stop";
            setTransport("stop");
            return;
          }
          state.cursor = 0;
        }
      }
      const index = steps[Math.min(state.cursor, steps.length - 1)]!.index;
      if (index !== shownRef.current) reveal(index);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [transport, timelineKey]);

  const dropFrames = (ids: readonly string[]) => {
    const current = docRef.current.frames;
    const next = deleteSpriteFrames(current, ids, editRef.current);
    if (!replaceFrames(next)) return;
    const live = new Set(next.map((frame) => frame.id));
    setSelected((picked) => picked.filter((id) => live.has(id)));
    setAnchorId((picked) => (picked && live.has(picked) ? picked : null));
    placeEdit(next, editRef.current && live.has(editRef.current) ? editRef.current : null);
    if (next.length === 0) {
      playRef.current = { cursor: 0, acc: 0, loops: 0 };
      setTransport("stop");
    }
  };

  const clearFrames = () => {
    if (replaceFrames([])) {
      setSelected([]);
      setAnchorId(null);
      placeEdit([], null);
      playRef.current = { cursor: 0, acc: 0, loops: 0 };
      setTransport("stop");
    }
    setWipe(false);
  };

  const patch = (partial: Partial<SpriteDoc>) => commit({ ...docRef.current, ...partial });

  const selectedFrames = doc.frames.filter((frame) => selected.includes(frame.id));
  const durations = selectedFrames.map((frame) => frame.durationMs);
  const sameDuration = durations.length > 0 && durations.every((value) => value === durations[0]);
  const grid = sheetGrid(doc.frames.length, doc.layout, doc.columns);
  const previewCell = cellSize(doc.frames);
  const previewIndex = doc.frames.length === 0 ? 0 : Math.min(Math.max(0, shown), doc.frames.length - 1);
  const previewFrame = doc.frames[previewIndex] ?? null;
  const activeNine = previewFrame ? (doc.nines ?? []).find((item) => item.frameId === previewFrame.id) ?? null : null;
  const shownNine = previewFrame && activeNine
    ? {
        ...activeNine,
        left: Math.max(0, Math.min(previewFrame.width, activeNine.left)),
        right: Math.max(0, Math.min(Math.max(0, previewFrame.width - Math.max(0, Math.min(previewFrame.width, activeNine.left))), activeNine.right)),
        top: Math.max(0, Math.min(previewFrame.height, activeNine.top)),
        bottom: Math.max(0, Math.min(Math.max(0, previewFrame.height - Math.max(0, Math.min(previewFrame.height, activeNine.top))), activeNine.bottom)),
      }
    : null;
  const nineZoom = previewFrame ? Math.max(1, Math.min(8, Math.floor(160 / Math.max(previewFrame.width, previewFrame.height)) || 1)) : 1;
  nineZoomRef.current = nineZoom;
  const previewPixels = useMemo(
    () => composeOnionPreview(doc.frames, previewIndex, previewCell.width, previewCell.height, onion, transport === "play"),
    [doc.frames, onion, previewCell.height, previewCell.width, previewIndex, transport],
  );
  const atlas = useMemo(() => (doc.frames.length === 0 ? null : composeSheet(doc)), [doc.columns, doc.frames, doc.layout]);

  const setFrameFields = (ids: readonly string[], partial: Partial<Pick<SpriteFrame, "durationMs" | "flipX" | "flipY">>) => {
    const chosen = new Set(ids);
    replaceFrames(docRef.current.frames.map((frame) => (chosen.has(frame.id) ? { ...frame, ...partial } : frame)));
  };

  const commitHold = (id: string, raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const frames = docRef.current.frames;
    const hold = clampHoldMs(parsed, fpsHoldMs(docRef.current.fps));
    const picked = selectedRef.current.filter((entry) => frames.some((frame) => frame.id === entry));
    const ids = picked.includes(id) && picked.length > 1 ? picked : [id];
    setFrameFields(ids, { durationMs: hold });
  };

  const pivotTargets = (): string[] => {
    const frames = docRef.current.frames;
    const shownId = frames[shownRef.current]?.id ?? null;
    const picked = selectedRef.current.filter((id) => frames.some((frame) => frame.id === id));
    if (picked.length > 0 && (shownId == null || picked.includes(shownId))) return picked;
    return shownId ? [shownId] : [];
  };

  const placePivot = (pivotFor: (frame: SpriteFrame) => SpritePivot) => {
    const chosen = new Set(pivotTargets());
    if (chosen.size === 0) return;
    const next = docRef.current.frames.map((frame) => {
      if (!chosen.has(frame.id)) return frame;
      const pivot = pivotFor(frame);
      if (frame.pivot && frame.pivot.x === pivot.x && frame.pivot.y === pivot.y) return frame;
      return { ...frame, pivot };
    });
    if (sameSpriteFrames(docRef.current.frames, next)) return;
    const record = pivotDrag.current !== "saved";
    if (record) {
      if (!replaceFrames(next)) return;
      if (pivotDrag.current === "pending") pivotDrag.current = "saved";
    } else {
      commit(adoptFrames(docRef.current, next));
    }
  };

  const roundPivot = (value: number) => Math.round(value * 100) / 100;

  const pivotAtPointer = (event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): SpritePivot | null => {
    const frame = docRef.current.frames[shownRef.current];
    if (!frame || canvas.width < 1 || canvas.height < 1) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    const visualX = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const visualY = ((event.clientY - rect.top) * canvas.height) / rect.height;
    const stored = pivotFromVisual(frame, visualX, visualY);
    return { x: roundPivot(stored.x), y: roundPivot(stored.y) };
  };

  const onPivotPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!pivotMode || event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button")) return;
    const canvas = event.currentTarget.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pivotDrag.current = "pending";
    const pivot = pivotAtPointer(event, canvas);
    if (pivot) placePivot(() => pivot);
  };

  const onPivotPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (pivotDrag.current === "none") return;
    const canvas = event.currentTarget.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const pivot = pivotAtPointer(event, canvas);
    if (pivot) placePivot(() => pivot);
  };

  const onPivotPointerUp = () => {
    pivotDrag.current = "none";
  };

  const commitPivotText = (axis: "x" | "y", text: string) => {
    setPivotDraft((current) => (current?.id === docRef.current.frames[shownRef.current]?.id ? null : current));
    const frame = docRef.current.frames[shownRef.current];
    if (!frame) return;
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return;
    const current = framePivot(frame);
    const pivot = axis === "x" ? { x: parsed, y: current.y } : { x: current.x, y: parsed };
    pivotDrag.current = "none";
    placePivot(() => pivot);
  };

  const sheetSize = () => {
    const frames = docRef.current.frames;
    if (frames.length === 0) return null;
    return composeSheet(docRef.current);
  };

  const writeSlices = (next: SpriteSlice[]) => {
    const current = docRef.current.slices ?? [];
    if (sameSpriteSlices(current, next)) return;
    if (sliceDrag.current !== "saved") {
      const nextHistory = pushSpriteEdit(historyRef.current, { kind: "slices", slices: current });
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      if (sliceDrag.current === "pending") sliceDrag.current = "saved";
    }
    commit({ ...docRef.current, slices: next });
  };

  const sheetPoint = (event: { clientX: number; clientY: number }, node: HTMLElement) => {
    const rect = node.getBoundingClientRect();
    const zoom = Math.max(1, docRef.current.zoom);
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  };

  const onSlicePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const sheet = sheetSize();
    if (!sheet) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const handle = target.closest("[data-slice-edge]");
    const host = event.currentTarget;
    if (handle instanceof HTMLElement) {
      const edge = handle.dataset.sliceEdge as SliceEdge;
      const id = handle.dataset.sliceId ?? sliceId;
      const slice = (docRef.current.slices ?? []).find((item) => item.id === id);
      if (!slice) return;
      event.preventDefault();
      event.stopPropagation();
      const point = sheetPoint(event, host);
      sliceDrag.current = "pending";
      sliceGesture.current = { kind: "resize", id: slice.id, edge, ax: point.x, ay: point.y, slice };
      setSliceId(slice.id);
      try { host.setPointerCapture(event.pointerId); } catch { /* already released */ }
      return;
    }
    const box = target.closest("[data-sprite-slice]");
    if (box instanceof HTMLElement) {
      const id = box.dataset.spriteSlice ?? "";
      const slice = (docRef.current.slices ?? []).find((item) => item.id === id);
      if (!slice) return;
      event.preventDefault();
      event.stopPropagation();
      const point = sheetPoint(event, host);
      sliceDrag.current = "pending";
      sliceGesture.current = { kind: "move", id: slice.id, ax: point.x, ay: point.y, x: slice.x, y: slice.y };
      setSliceId(slice.id);
      try { host.setPointerCapture(event.pointerId); } catch { /* already released */ }
      return;
    }
    if (!sliceTool) return;
    event.preventDefault();
    const point = sheetPoint(event, host);
    sliceGesture.current = { kind: "draw", ax: point.x, ay: point.y };
    setSliceDraft(pixelRect(point.x, point.y, point.x, point.y, sheet.width, sheet.height));
    try { host.setPointerCapture(event.pointerId); } catch { /* already released */ }
  };

  const onSlicePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = sliceGesture.current;
    if (!gesture) return;
    const sheet = sheetSize();
    if (!sheet) return;
    const point = sheetPoint(event, event.currentTarget);
    if (gesture.kind === "draw") {
      setSliceDraft(pixelRect(gesture.ax, gesture.ay, point.x, point.y, sheet.width, sheet.height));
      return;
    }
    const slices = docRef.current.slices ?? [];
    if (gesture.kind === "move") {
      writeSlices(slices.map((slice) => (slice.id === gesture.id ? moveSlice({ ...slice, x: gesture.x, y: gesture.y }, point.x - gesture.ax, point.y - gesture.ay, sheet.width, sheet.height) : slice)));
      return;
    }
    writeSlices(slices.map((slice) => (slice.id === gesture.id ? resizeSlice(gesture.slice, gesture.edge, point.x - gesture.ax, point.y - gesture.ay, sheet.width, sheet.height) : slice)));
  };

  const onSlicePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = sliceGesture.current;
    sliceGesture.current = null;
    sliceDrag.current = "none";
    if (!gesture || gesture.kind !== "draw") {
      setSliceDraft(null);
      return;
    }
    const sheet = sheetSize();
    const point = sheetPoint(event, event.currentTarget);
    const rect = sheet ? pixelRect(gesture.ax, gesture.ay, point.x, point.y, sheet.width, sheet.height) : null;
    setSliceDraft(null);
    if (!rect) return;
    const slices = docRef.current.slices ?? [];
    const number = nextSliceNumber(slices);
    const created: SpriteSlice = { id: spriteId(), number, name: `Slice ${number}`, ...rect, pivot: null };
    writeSlices(slices.concat(created));
    setSliceId(created.id);
    setSliceText(null);
  };

  const patchSlice = (id: string, next: SpriteSlice | null) => {
    const slices = docRef.current.slices ?? [];
    sliceDrag.current = "none";
    if (!next) {
      writeSlices(slices.filter((slice) => slice.id !== id));
      setSliceId((current) => (current === id ? null : current));
      return;
    }
    writeSlices(slices.map((slice) => (slice.id === id ? next : slice)));
  };

  const exportSlice = async () => {
    const slice = (docRef.current.slices ?? []).find((item) => item.id === sliceId);
    const sheet = sheetSize();
    if (!slice || !sheet) return;
    const pixels = slicePixels(sheet.rgba, sheet.width, sheet.height, slice);
    if (!pixels) {
      notify("このスライスはシートの外にはみ出しているため、切り出せません。画像は変えていません。");
      return;
    }
    const blob = await pngBlob(pixels, slice.width, slice.height);
    if (!blob) {
      notify("スライスを画像にできませんでした。元の画像は変えていません。");
      return;
    }
    await saveBlob(blob, fileName(slice.name, ".png"), "PNG", "image/png", ".png");
  };

  const writeNine = (next: NineSlice | null) => {
    const list = docRef.current.nines ?? [];
    const nines = next ? list.filter((item) => item.frameId !== next.frameId).concat(next) : list;
    patch({ nines });
  };

  const beginNine = () => {
    const frame = docRef.current.frames[shownRef.current];
    if (!frame) return;
    const existing = (docRef.current.nines ?? []).find((item) => item.frameId === frame.id);
    if (!existing) writeNine(defaultNine(frame.id, frame.width, frame.height));
    setNineText(null);
    setNineOn(true);
  };

  const moveNineGuide = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = nineDrag.current;
    const stage = nineStageRef.current;
    if (!drag || !stage || drag.pointer !== event.pointerId) return;
    const frame = docRef.current.frames[shownRef.current];
    const nine = (docRef.current.nines ?? []).find((item) => item.frameId === frame?.id);
    if (!frame || !nine) return;
    const rect = stage.getBoundingClientRect();
    const zoom = Math.max(1, nineZoomRef.current);
    const x = Math.round((event.clientX - rect.left) / zoom);
    const y = Math.round((event.clientY - rect.top) / zoom);
    const value = drag.edge === "left" ? x : drag.edge === "right" ? frame.width - x : drag.edge === "top" ? y : frame.height - y;
    const next = setNineMargin(nine, frame.width, frame.height, drag.edge, value);
    if (next.left === nine.left && next.right === nine.right && next.top === nine.top && next.bottom === nine.bottom) return;
    setNineText(null);
    writeNine(next);
  };

  const exportNine = async () => {
    const frame = docRef.current.frames[shownRef.current];
    const nine = (docRef.current.nines ?? []).find((item) => item.frameId === frame?.id);
    if (!frame || !nine) return;
    const pixels = nineSliceRgba(frame.rgba, frame.width, frame.height, nine, nine.previewWidth, nine.previewHeight);
    if (!pixels) {
      notify("この大きさでは9-sliceを書き出せません。元の画像は変えていません。");
      return;
    }
    const blob = await pngBlob(pixels, nine.previewWidth, nine.previewHeight);
    if (!blob) {
      notify("9-sliceを画像にできませんでした。元の画像は変えていません。");
      return;
    }
    await saveBlob(blob, fileName("nine", ".png"), "PNG", "image/png", ".png");
  };

  const onPng = (files: FileList | null) => {
    const list = files ? [...files] : [];
    if (pngInput.current) pngInput.current.value = "";
    const pngs = list.filter((file) => file.type === "image/png" || /\.png$/i.test(file.name));
    if (pngs.length !== list.length) notify("PNG以外は個別フレームに追加していません。");
    void stageFiles(pngs);
  };

  const onSheetFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (sheetInput.current) sheetInput.current.value = "";
    if (!file) return;
    const decoded = await rgbaFromBlob(file);
    if (!decoded) {
      notify("スプライトシートを読めません。フレームは追加していません。");
      return;
    }
    setSplit({ ...decoded, cols: 4, rows: 1 });
  };

  const confirmSplit = () => {
    if (!split) return;
    const plan = splitPlan(split.width, split.height, split.cols, split.rows);
    if (!plan.ok) return;
    const frames: SpriteFrame[] = [];
    for (let row = 0; row < split.rows; row += 1) {
      for (let col = 0; col < split.cols; col += 1) {
        frames.push({
          id: spriteId(),
          width: plan.frameW,
          height: plan.frameH,
          rgba: sliceFrame(split.rgba, split.width, plan.frameW, plan.frameH, col, row),
          durationMs: null,
          flipX: false,
          flipY: false,
        });
      }
    }
    addFrames(frames);
    setSplit(null);
  };

  const exportSheet = async () => {
    if (doc.frames.length === 0) {
      notify("フレームがないため、シートは書き出せません。");
      return;
    }
    const sheet = composeSheet(doc);
    const blob = await pngBlob(sheet.rgba, sheet.width, sheet.height);
    if (!blob) {
      notify("シートを画像にできませんでした。");
      return;
    }
    await saveBlob(blob, fileName(doc.name, ".png"), "PNG", "image/png", ".png");
  };

  const exportJson = async () => {
    if (doc.frames.length === 0) {
      notify("フレームがないため、設定は書き出せません。");
      return;
    }
    const blob = new Blob([JSON.stringify(spriteSettings(doc), null, 2)], { type: "application/json" });
    await saveBlob(blob, fileName(doc.name, ".json"), "JSON", "application/json", ".json");
  };

  const exportGif = async () => {
    if (playbackTimeline(doc).length === 0) {
      notify("再生するフレームがないため、GIFは書き出せません。");
      return;
    }
    const scale = clampGifScale(gifScale);
    const cell = cellSize(doc.frames);
    if (!spriteGifOutputSize(cell.width, cell.height, scale)) {
      notify("この倍率ではGIFが大きすぎます。倍率とスプライトはそのままです。");
      return;
    }
    let bytes: Uint8Array | null = null;
    try {
      bytes = encodeSpriteGif(doc, scale);
    } catch {
      bytes = null;
    }
    if (!bytes) {
      notify("GIFにできませんでした。スプライトは変えていません。");
      return;
    }
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    await saveBlob(new Blob([copy], { type: "image/gif" }), fileName(doc.name, ".gif"), "GIF", "image/gif", ".gif");
  };

  const applyOrder = (next: SpriteFrame[]) => {
    if (!replaceFrames(next)) return;
    const live = new Set(next.map((frame) => frame.id));
    setSelected((picked) => picked.filter((id) => live.has(id)));
    setAnchorId((picked) => (picked && live.has(picked) ? picked : null));
    placeEdit(next, editRef.current && live.has(editRef.current) ? editRef.current : null);
  };

  const beginReorder = (id: string, event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let cancelled = false;
    const picked = selectedRef.current;
    const group = picked.includes(id) && picked.length > 1;
    const movingIds = group ? docRef.current.frames.filter((frame) => picked.includes(frame.id)).map((frame) => frame.id) : [id];
    const moving = new Set(movingIds);
    const placeFromPoint = (pointer: { clientX: number; clientY: number }) => {
      const hit = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest("[data-sprite-id]");
      const target = hit?.getAttribute("data-sprite-id");
      if (!target || !(hit instanceof HTMLElement)) return null;
      if (moving.has(target)) return null;
      const rect = hit.getBoundingClientRect();
      const place = pointer.clientX < rect.left + rect.width / 2 ? "before" : "after";
      return { id: target, place } as SpriteDropPlace;
    };
    const move = (pointer: PointerEvent) => {
      if (cancelled) return;
      if (Math.hypot(pointer.clientX - startX, pointer.clientY - startY) > 4) moved = true;
      if (!moved) return;
      if (group) {
        setInsertMark(placeFromPoint(pointer));
        setDropId(null);
        return;
      }
      const hit = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest("[data-sprite-id]");
      const next = hit?.getAttribute("data-sprite-id") ?? null;
      setDropId(next && next !== id ? next : null);
      setInsertMark(null);
    };
    const end = (pointer: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("keydown", onKey);
      if (cancelled) {
        suppressClick.current = true;
        setDropId(null);
        setInsertMark(null);
        return;
      }
      if (moved) {
        suppressClick.current = true;
        if (group) {
          const place = placeFromPoint(pointer);
          if (place) applyOrder(moveSpriteFrames(docRef.current.frames, movingIds, place));
        } else {
          const hit = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest("[data-sprite-id]");
          const target = hit?.getAttribute("data-sprite-id");
          if (target && target !== id) applyOrder(reorderFrame(docRef.current.frames, id, target));
        }
      }
      setDropId(null);
      setInsertMark(null);
    };
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return;
      keyEvent.preventDefault();
      cancelled = true;
      setDropId(null);
      setInsertMark(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("keydown", onKey);
  };

  const selectFrame = (id: string, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const frames = docRef.current.frames;
    const gesture = event.shiftKey ? "range" : event.metaKey || event.ctrlKey ? "toggle" : "single";
    const next = pickSpriteFrames(
      frames.map((frame) => frame.id),
      { ids: selectedRef.current, anchorId: anchorRef.current, activeId: editRef.current },
      id,
      gesture,
    );
    setSelected(next.ids);
    setAnchorId(next.anchorId);
    if (gesture !== "single") return;
    const index = frames.findIndex((frame) => frame.id === id);
    if (index < 0 || transportRef.current === "play") return;
    reveal(index);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      const meta = event.metaKey || event.ctrlKey;
      if (!meta || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoFrames();
        return;
      }
      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redoFrames();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const plan = split ? splitPlan(split.width, split.height, split.cols, split.rows) : null;
  const pivotIds = selected.length > 0 && (previewFrame == null || selected.includes(previewFrame.id))
    ? selected
    : previewFrame
      ? [previewFrame.id]
      : [];
  const pivotFrames = doc.frames.filter((frame) => pivotIds.includes(frame.id));
  const shownPivot = previewFrame ? framePivot(previewFrame) : null;
  const pivotText = pivotDraft && previewFrame && pivotDraft.id === previewFrame.id ? pivotDraft : null;
  const presetOn = (id: string) => pivotFrames.length > 0 && pivotFrames.every((frame) => {
    const at = presetPivot(frame.width, frame.height, id);
    const pivot = framePivot(frame);
    return !!at && Math.abs(at.x - pivot.x) < 0.001 && Math.abs(at.y - pivot.y) < 0.001;
  });
  const activeSlice = (doc.slices ?? []).find((slice) => slice.id === sliceId) ?? null;
  const sliceValue = (field: "name" | "x" | "y" | "w" | "h" | "px" | "py", fallback: string) => (sliceText != null && sliceText.id === activeSlice?.id && sliceText.field === field ? sliceText.text : fallback);
  const largeFit = useMemo(
    () => integerPixelFit(largeBox.w, largeBox.h, previewCell.width, previewCell.height),
    [largeBox.h, largeBox.w, previewCell.height, previewCell.width],
  );
  const sideFit = useMemo(
    () => integerPixelFit(256, 256, previewCell.width, previewCell.height),
    [previewCell.height, previewCell.width],
  );

  useLayoutEffect(() => {
    if (doc.frames.length === 0 && previewLarge) setPreviewLarge(false);
  }, [doc.frames.length, previewLarge]);

  useLayoutEffect(() => {
    const node = largeRef.current;
    if (!node || !previewLarge) return;
    const measure = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      setLargeBox((current) => (current.w === w && current.h === h ? current : { w, h }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [previewLarge]);

  useLayoutEffect(() => {
    paintSpriteCanvas(previewCanvasRef.current, previewPixels, previewCell.width, previewCell.height);
  }, [previewCell.height, previewCell.width, previewPixels]);

  useLayoutEffect(() => {
    if (!atlas) return;
    paintSpriteCanvas(atlasRef.current, atlas.rgba, atlas.width, atlas.height);
  }, [atlas]);

  useLayoutEffect(() => {
    if (!nineOn || !previewFrame) return;
    const nine = (doc.nines ?? []).find((item) => item.frameId === previewFrame.id);
    const source = nineSourceRef.current;
    const preview = ninePreviewRef.current;
    if (!nine || !source || !preview) return;
    paintSpriteCanvas(source, previewFrame.rgba, previewFrame.width, previewFrame.height);
    const pixels = nineSliceRgba(previewFrame.rgba, previewFrame.width, previewFrame.height, nine, nine.previewWidth, nine.previewHeight);
    paintSpriteCanvas(preview, pixels, nine.previewWidth, nine.previewHeight);
  }, [doc.nines, nineOn, previewFrame]);

  useLayoutEffect(() => {
    if (!previewLarge) return;
    paintSpriteCanvas(largeCanvasRef.current, previewPixels, previewCell.width, previewCell.height);
  }, [previewCell.height, previewCell.width, previewLarge, previewPixels]);

  const togglePreview = () => {
    if (docRef.current.frames.length === 0) return;
    setPreviewLarge((open) => !open);
  };

  return (
    <section
      className={gifOver ? "canvas-pane sprite-pane is-frame-drop" : "canvas-pane sprite-pane"}
      aria-label="スプライト"
      onPointerDown={(event) => event.stopPropagation()}
      onDragEnter={(event) => {
        if (!gifDrag(event.dataTransfer.types)) return;
        event.preventDefault();
        setGifOver(true);
      }}
      onDragOver={onSpriteDragOver}
      onDragLeave={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setGifOver(false);
      }}
      onDrop={onSpriteDrop}
    >
      <div className="sprite-work">
        <div className="sprite-stage-wrap">
        <div className="sprite-stage">
          {gifOver ? <p className="sprite-drop-hint">ドロップすると新しいコマになります</p> : null}
          {doc.frames.length === 0 ? <p className="sprite-empty">左の一覧、またはGIFフレームをドロップ</p> : null}
          {atlas ? (
            <div
              className={sliceTool ? "sprite-atlas is-slice" : "sprite-atlas"}
              style={{ width: atlas.width * doc.zoom, height: atlas.height * doc.zoom }}
              onPointerDown={onSlicePointerDown}
              onPointerMove={onSlicePointerMove}
              onPointerUp={onSlicePointerUp}
              onPointerCancel={onSlicePointerUp}
            >
              <canvas ref={atlasRef} width={atlas.width} height={atlas.height} aria-label="スプライトシート" />
              {(doc.slices ?? []).map((slice) => {
                const pivot = slicePivot(slice);
                return (
                  <div
                    key={slice.id}
                    className={slice.id === sliceId ? "sprite-slice is-on" : "sprite-slice"}
                    data-sprite-slice={slice.id}
                    style={{ left: slice.x * doc.zoom, top: slice.y * doc.zoom, width: slice.width * doc.zoom, height: slice.height * doc.zoom }}
                  >
                    <span className="sprite-slice-index">{slice.number}</span>
                    {slice.id === sliceId ? (
                      <i className="sprite-pivot-mark" style={{ left: pivot.x * doc.zoom, top: pivot.y * doc.zoom }} aria-hidden="true" />
                    ) : null}
                    {slice.id === sliceId
                      ? (["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((edge) => (
                          <i key={edge} className={`sprite-slice-handle is-${edge}`} data-slice-edge={edge} data-slice-id={slice.id} />
                        ))
                      : null}
                  </div>
                );
              })}
              {sliceDraft ? (
                <div
                  className="sprite-slice is-draft"
                  style={{ left: sliceDraft.x * doc.zoom, top: sliceDraft.y * doc.zoom, width: sliceDraft.width * doc.zoom, height: sliceDraft.height * doc.zoom }}
                />
              ) : null}
            </div>
          ) : null}
          <div className="sprite-sheet" style={{ gridTemplateColumns: `repeat(${Math.max(1, grid.cols)}, max-content)` }}>
            {doc.frames.map((frame, index) => (
              <div
                key={frame.id}
                role="button"
                tabIndex={0}
                data-sprite-id={frame.id}
                className={[
                  "sprite-frame",
                  selected.includes(frame.id) ? "is-on" : "",
                  frame.id === (doc.frames[previewIndex]?.id ?? null) ? "is-edit" : "",
                  dropId === frame.id ? "is-drop" : "",
                  insertMark?.id === frame.id && insertMark.place === "before" ? "is-insert-before" : "",
                  insertMark?.id === frame.id && insertMark.place === "after" ? "is-insert-after" : "",
                ].filter(Boolean).join(" ")}
                aria-pressed={selected.includes(frame.id)}
                aria-current={frame.id === (doc.frames[previewIndex]?.id ?? null) ? "true" : undefined}
                data-sprite-selected={selected.includes(frame.id) ? "true" : "false"}
                data-sprite-edit={frame.id === (doc.frames[previewIndex]?.id ?? null) ? "true" : "false"}
                onPointerDown={(event) => beginReorder(frame.id, event)}
                onClick={(event) => selectFrame(frame.id, event)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  selectFrame(frame.id, event);
                }}
              >
                <span className="sprite-checker">
                  <button
                    type="button"
                    className="sprite-remove"
                    aria-label={`${index + 1}番のフレームを削除`}
                    disabled={doc.frames.length <= 1}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      dropFrames([frame.id]);
                    }}
                  >
                    ×
                  </button>
                  <FrameThumb frame={frame} zoom={doc.zoom} />
                </span>
                <span className="sprite-index">
                  {index + 1}
                  {frame.origin ? ` ${frame.origin}` : ""}
                  {frame.flipX || frame.flipY ? " 反転" : ""}
                </span>
                <label
                  className="sprite-hold"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label={`${index + 1}番を10ms短く`}
                    onClick={() => {
                      const live = docRef.current.frames.find((entry) => entry.id === frame.id);
                      commitHold(frame.id, String((live?.durationMs ?? fpsHoldMs(docRef.current.fps)) - 10));
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    step={10}
                    inputMode="numeric"
                    aria-label={`${index + 1}番の表示時間`}
                    data-sprite-hold={frame.durationMs ?? fpsHoldMs(doc.fps)}
                    value={holdDraft?.key === frame.id ? holdDraft.text : String(frame.durationMs ?? fpsHoldMs(doc.fps))}
                    onFocus={() => setHoldDraft({ key: frame.id, text: String(frame.durationMs ?? fpsHoldMs(docRef.current.fps)) })}
                    onChange={(event) => setHoldDraft({ key: frame.id, text: event.target.value })}
                    onBlur={(event) => {
                      const text = event.target.value;
                      setHoldDraft((current) => (current?.key === frame.id ? null : current));
                      commitHold(frame.id, text);
                    }}
                  />
                  <span>ms</span>
                  <button
                    type="button"
                    aria-label={`${index + 1}番を10ms長く`}
                    onClick={() => {
                      const live = docRef.current.frames.find((entry) => entry.id === frame.id);
                      commitHold(frame.id, String((live?.durationMs ?? fpsHoldMs(docRef.current.fps)) + 10));
                    }}
                  >
                    +
                  </button>
                </label>
              </div>
            ))}
          </div>
        </div>
        {previewLarge && previewFrame ? (
            <div
              ref={largeRef}
              className={`sprite-preview-large ${doc.background === "checker" ? "is-checker" : doc.background === "solid" ? "is-solid" : "is-clear"}${pivotMode ? " is-pivot" : ""}`}
              style={doc.background === "solid" ? { background: doc.solid } : undefined}
              onClick={(event) => {
                if (pivotMode) {
                  event.preventDefault();
                  return;
                }
                togglePreview();
              }}
              onPointerDown={onPivotPointerDown}
              onPointerMove={onPivotPointerMove}
              onPointerUp={onPivotPointerUp}
            >
              <button
                type="button"
                className="sprite-preview-close"
                aria-label="拡大表示を閉じる"
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewLarge(false);
                }}
              >
                閉じる
              </button>
              <div
                className="sprite-pivot-stage"
                style={{
                  width: largeBox.w < 1 ? 0 : largeFit.width,
                  height: largeBox.h < 1 ? 0 : largeFit.height,
                }}
              >
                <canvas
                  ref={largeCanvasRef}
                  aria-hidden="true"
                  style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
                />
                {pivotMark && previewFrame ? (
                  <i
                    className="sprite-pivot-mark"
                    data-sprite-pivot="large"
                    aria-hidden="true"
                    style={{
                      left: (visualPivot(previewFrame).x * largeFit.width) / Math.max(1, previewCell.width),
                      top: (visualPivot(previewFrame).y * largeFit.height) / Math.max(1, previewCell.height),
                    }}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <aside className="sprite-side">
          <div
            className={`sprite-preview is-checker${pivotMode ? " is-pivot" : ""}`}
            role={pivotMode ? "application" : "button"}
            tabIndex={doc.frames.length === 0 ? -1 : 0}
            aria-pressed={pivotMode ? undefined : previewLarge}
            aria-label={pivotMode ? "ピボットの位置" : previewLarge ? "見本アニメを通常表示に戻す" : "見本アニメを拡大"}
            onClick={(event) => {
              if (pivotMode) {
                event.preventDefault();
                return;
              }
              togglePreview();
            }}
            onKeyDown={(event) => {
              if (pivotMode) return;
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              togglePreview();
            }}
            onPointerDown={onPivotPointerDown}
            onPointerMove={onPivotPointerMove}
            onPointerUp={onPivotPointerUp}
          >
            <div
              className="sprite-pivot-stage"
              style={{ width: sideFit.width, height: sideFit.height }}
            >
              <canvas
                ref={previewCanvasRef}
                data-sprite-shown={previewIndex}
                style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
              />
              {pivotMark && previewFrame ? (
                <i
                  className="sprite-pivot-mark"
                  data-sprite-pivot="side"
                  aria-hidden="true"
                  style={{
                    left: visualPivot(previewFrame).x * sideFit.scale,
                    top: visualPivot(previewFrame).y * sideFit.scale,
                  }}
                />
              ) : null}
            </div>
          </div>
          <p className="sprite-meta" data-sprite-label="frame">
            {doc.frames.length === 0 ? "フレームなし" : `フレーム ${previewIndex + 1} / ${doc.frames.length}`}
            {previewFrame ? ` ・ ${holdMs(previewFrame, doc.fps, doc.speed)}ms` : ""}
          </p>
          <div className="sprite-transport">
            <button
              type="button"
              onClick={() => {
                const order = docRef.current.order;
                const steps = playbackPreviewSteps({ ...docRef.current, order });
                if (steps.length === 0) return;
                if (transportRef.current === "stop") {
                  playOrderRef.current = order;
                  playRef.current = { cursor: 0, acc: 0, loops: 0 };
                  reveal(steps[0]!.index);
                }
                transportRef.current = "play";
                setTransport("play");
              }}
              disabled={!ready || doc.frames.length === 0}
            >
              再生
            </button>
            <button type="button" onClick={() => { transportRef.current = "pause"; setTransport("pause"); }} disabled={transport !== "play"}>一時停止</button>
            <button
              type="button"
              onClick={() => {
                transportRef.current = "stop";
                playRef.current = { cursor: 0, acc: 0, loops: 0 };
                setTransport("stop");
              }}
            >
              停止
            </button>
            <button
              type="button"
              onClick={() => {
                const order = docRef.current.order;
                const steps = playbackPreviewSteps({ ...docRef.current, order });
                if (steps.length === 0) return;
                playOrderRef.current = order;
                playRef.current = { cursor: 0, acc: 0, loops: 0 };
                reveal(steps[0]!.index);
                transportRef.current = "play";
                setTransport("play");
              }}
              disabled={doc.frames.length === 0}
            >
              最初から
            </button>
          </div>
          <label className="sprite-field">
            再生方式
            <select aria-label="再生方式" value={doc.order} onChange={(event) => patch({ order: event.target.value as SpriteOrder })}>
              <option value="forward">通常再生</option>
              <option value="reverse">逆再生</option>
              <option value="pingpong">往復再生</option>
            </select>
          </label>
          <label className="sprite-field">
            名前
            <input value={doc.name} onChange={(event) => patch({ name: event.target.value })} />
          </label>
          <label className="sprite-field">
            初期FPS
            <span className="sprite-fps-line">
              <input type="number" min={1} max={60} step={1} aria-label="新規フレームの初期FPS" value={doc.fps} onChange={(event) => patch({ fps: clampFps(Number(event.target.value)) })} />
              <span className="is-seed">新規 {fpsHoldMs(doc.fps)}ms</span>
            </span>
          </label>
          <label className="sprite-field">
            再生速度
            <input type="number" min={0.25} max={4} step={0.25} value={doc.speed} onChange={(event) => patch({ speed: clampSpeed(Number(event.target.value)) })} />
          </label>
          <label className="sprite-field">
            ループ
            <select value={doc.loop} onChange={(event) => patch({ loop: event.target.value as SpriteLoop })}>
              <option value="infinite">無限ループ</option>
              <option value="count">指定回数</option>
              <option value="once">1回だけ</option>
            </select>
          </label>
          {doc.loop === "count" ? (
            <label className="sprite-field">
              回数
              <input type="number" min={1} max={99} step={1} value={doc.loopCount} onChange={(event) => patch({ loopCount: Math.max(1, Math.round(Number(event.target.value)) || 1) })} />
            </label>
          ) : null}
          <label className="sprite-field">
            開始
            <input type="number" min={1} max={Math.max(1, doc.frames.length)} value={doc.startFrame} onChange={(event) => patch({ startFrame: Math.round(Number(event.target.value)) || 1 })} />
          </label>
          <label className="sprite-field">
            終了
            <input type="number" min={1} max={Math.max(1, doc.frames.length)} value={doc.endFrame} onChange={(event) => patch({ endFrame: Math.round(Number(event.target.value)) || 1 })} />
          </label>
          <label className="sprite-field">
            プレビュー背景
            <select value={doc.background} onChange={(event) => patch({ background: event.target.value as SpriteBackground })}>
              <option value="clear">透明表示</option>
              <option value="checker">市松模様</option>
              <option value="solid">単色背景</option>
            </select>
          </label>
          {doc.background === "solid" ? (
            <label className="sprite-field">
              色
              <input type="color" value={doc.solid} onChange={(event) => patch({ solid: event.target.value })} />
            </label>
          ) : null}
          <div className="sprite-transport">
            <button type="button" aria-pressed={onion.on} onClick={() => scheduleOnion({ ...onionRef.current, on: !onionRef.current.on })}>
              オニオンスキン
            </button>
          </div>
          {onion.on ? (
            <>
              <label className="sprite-field">
                <span><i className="sprite-onion-dot is-before" aria-hidden="true" />前の枚数</span>
                <span className="sprite-onion-slide">
                  <input type="range" min={0} max={3} step={1} aria-label="前フレームの枚数" value={onion.before} onChange={(event) => scheduleOnion({ ...onionRef.current, before: Number(event.target.value) })} />
                  <span>{onion.before}</span>
                </span>
              </label>
              <label className="sprite-field">
                <span><i className="sprite-onion-dot is-after" aria-hidden="true" />後の枚数</span>
                <span className="sprite-onion-slide">
                  <input type="range" min={0} max={3} step={1} aria-label="後フレームの枚数" value={onion.after} onChange={(event) => scheduleOnion({ ...onionRef.current, after: Number(event.target.value) })} />
                  <span>{onion.after}</span>
                </span>
              </label>
              <label className="sprite-field">
                <span><i className="sprite-onion-dot is-before" aria-hidden="true" />前の濃さ</span>
                <span className="sprite-onion-slide">
                  <input type="range" min={0} max={100} step={1} aria-label="前フレームの不透明度" value={onion.beforeOpacity} onChange={(event) => scheduleOnion({ ...onionRef.current, beforeOpacity: Number(event.target.value) })} />
                  <span>{onion.beforeOpacity}%</span>
                </span>
              </label>
              <label className="sprite-field">
                <span><i className="sprite-onion-dot is-after" aria-hidden="true" />後の濃さ</span>
                <span className="sprite-onion-slide">
                  <input type="range" min={0} max={100} step={1} aria-label="後フレームの不透明度" value={onion.afterOpacity} onChange={(event) => scheduleOnion({ ...onionRef.current, afterOpacity: Number(event.target.value) })} />
                  <span>{onion.afterOpacity}%</span>
                </span>
              </label>
            </>
          ) : null}
          <label className="sprite-field">
            表示時間
            <span className="sprite-fps-line">
              <input
                type="number"
                min={10}
                max={5000}
                step={10}
                inputMode="numeric"
                aria-label={`選択中${selected.length}枚の表示時間`}
                disabled={selectedFrames.length === 0}
                value={holdDraft?.key === "selection" ? holdDraft.text : sameDuration && durations[0] != null ? String(durations[0]) : ""}
                placeholder={selectedFrames.length === 0 ? "" : sameDuration ? "" : "混在"}
                onFocus={() => {
                  if (selectedFrames.length === 0) return;
                  setHoldDraft({ key: "selection", text: sameDuration && durations[0] != null ? String(durations[0]) : "" });
                }}
                onChange={(event) => setHoldDraft({ key: "selection", text: event.target.value })}
                onBlur={(event) => {
                  const text = event.target.value.trim();
                  setHoldDraft((current) => (current?.key === "selection" ? null : current));
                  if (text === "" || selectedRef.current.length === 0) return;
                  const parsed = Number(text);
                  if (!Number.isFinite(parsed)) return;
                  setFrameFields(selectedRef.current, { durationMs: clampHoldMs(parsed, fpsHoldMs(docRef.current.fps)) });
                }}
              />
              <span>ms</span>
            </span>
          </label>
          <div className="sprite-transport">
            <button type="button" aria-pressed={selectedFrames.length > 0 && selectedFrames.every((frame) => frame.flipX)} disabled={selectedFrames.length === 0} onClick={() => setFrameFields(selected, { flipX: !selectedFrames.every((frame) => frame.flipX) })}>左右反転</button>
            <button type="button" aria-pressed={selectedFrames.length > 0 && selectedFrames.every((frame) => frame.flipY)} disabled={selectedFrames.length === 0} onClick={() => setFrameFields(selected, { flipY: !selectedFrames.every((frame) => frame.flipY) })}>上下反転</button>
          </div>
          <div className="sprite-transport">
            <button type="button" aria-pressed={pivotMode} disabled={doc.frames.length === 0} onClick={() => setPivotMode((on) => !on)}>ピボット</button>
            <button type="button" aria-pressed={pivotMark} onClick={() => setPivotMark((on) => !on)}>マーカー</button>
          </div>
          <div className="sprite-pivot-grid" role="group" aria-label="ピボットの位置">
            {PIVOT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={presetOn(preset.id)}
                disabled={doc.frames.length === 0}
                onClick={() => {
                  pivotDrag.current = "none";
                  setPivotDraft(null);
                  placePivot((frame) => presetPivot(frame.width, frame.height, preset.id) ?? framePivot(frame));
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="sprite-field">
            X
            <input
              type="number"
              step="any"
              inputMode="decimal"
              aria-label="ピボットX"
              disabled={!previewFrame}
              value={pivotText ? pivotText.x : shownPivot ? String(shownPivot.x) : ""}
              onFocus={() => {
                if (!previewFrame || !shownPivot) return;
                setPivotDraft({ id: previewFrame.id, x: String(shownPivot.x), y: String(shownPivot.y) });
              }}
              onChange={(event) => {
                if (!previewFrame) return;
                setPivotDraft((current) => ({ id: previewFrame.id, x: event.target.value, y: current?.id === previewFrame.id ? current.y : String(shownPivot?.y ?? "") }));
              }}
              onBlur={(event) => commitPivotText("x", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </label>
          <label className="sprite-field">
            Y
            <input
              type="number"
              step="any"
              inputMode="decimal"
              aria-label="ピボットY"
              disabled={!previewFrame}
              value={pivotText ? pivotText.y : shownPivot ? String(shownPivot.y) : ""}
              onFocus={() => {
                if (!previewFrame || !shownPivot) return;
                setPivotDraft({ id: previewFrame.id, x: String(shownPivot.x), y: String(shownPivot.y) });
              }}
              onChange={(event) => {
                if (!previewFrame) return;
                setPivotDraft((current) => ({ id: previewFrame.id, x: current?.id === previewFrame.id ? current.x : String(shownPivot?.x ?? ""), y: event.target.value }));
              }}
              onBlur={(event) => commitPivotText("y", event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </label>
          <div className="sprite-transport">
            <button type="button" aria-pressed={sliceTool} disabled={doc.frames.length === 0} onClick={() => setSliceTool((on) => !on)}>スライス</button>
            <button type="button" disabled={!activeSlice} onClick={() => { if (activeSlice) patchSlice(activeSlice.id, null); }}>スライス削除</button>
            <button type="button" disabled={!activeSlice} onClick={() => void exportSlice()}>切り出し</button>
          </div>
          <ul className="sprite-slice-list" aria-label="スライス一覧">
            {(doc.slices ?? []).map((slice) => (
              <li key={slice.id} className={slice.id === sliceId ? "is-on" : ""}>
                <button type="button" aria-pressed={slice.id === sliceId} onClick={() => setSliceId(slice.id)}>
                  {slice.number} {slice.name}
                </button>
                <span>{slice.x},{slice.y} {slice.width}×{slice.height}</span>
              </li>
            ))}
          </ul>
          <label className="sprite-field">
            名前
            <input
              aria-label="スライス名"
              disabled={!activeSlice}
              value={sliceValue("name", activeSlice?.name ?? "")}
              onFocus={() => { if (activeSlice) setSliceText({ id: activeSlice.id, field: "name", text: activeSlice.name }); }}
              onChange={(event) => { if (activeSlice) setSliceText({ id: activeSlice.id, field: "name", text: event.target.value }); }}
              onBlur={(event) => {
                const slice = (docRef.current.slices ?? []).find((item) => item.id === sliceId);
                setSliceText(null);
                if (!slice) return;
                const name = event.target.value.trim().slice(0, 40) || `Slice ${slice.number}`;
                if (name !== slice.name) patchSlice(slice.id, { ...slice, name });
              }}
            />
          </label>
          {([
            ["x", "スライスX"],
            ["y", "スライスY"],
            ["w", "スライス幅"],
            ["h", "スライス高さ"],
          ] as const).map(([field, label]) => (
            <label key={field} className="sprite-field">
              {field === "w" ? "幅" : field === "h" ? "高さ" : field.toUpperCase()}
              <input
                type="number"
                step={1}
                aria-label={label}
                disabled={!activeSlice}
                value={sliceValue(field, activeSlice ? String(field === "w" ? activeSlice.width : field === "h" ? activeSlice.height : activeSlice[field]) : "")}
                onFocus={() => {
                  if (!activeSlice) return;
                  const current = field === "w" ? activeSlice.width : field === "h" ? activeSlice.height : activeSlice[field];
                  setSliceText({ id: activeSlice.id, field, text: String(current) });
                }}
                onChange={(event) => { if (activeSlice) setSliceText({ id: activeSlice.id, field, text: event.target.value }); }}
                onBlur={(event) => {
                  const slice = (docRef.current.slices ?? []).find((item) => item.id === sliceId);
                  const sheet = sheetSize();
                  setSliceText(null);
                  if (!slice || !sheet) return;
                  const parsed = Number(event.target.value);
                  if (!Number.isFinite(parsed)) return;
                  const placed = placeSlice(
                    slice,
                    field === "x" ? parsed : slice.x,
                    field === "y" ? parsed : slice.y,
                    field === "w" ? parsed : slice.width,
                    field === "h" ? parsed : slice.height,
                    sheet.width,
                    sheet.height,
                  );
                  if (placed) patchSlice(slice.id, placed);
                }}
              />
            </label>
          ))}
          <label className="sprite-field">
            基準X
            <input
              type="number"
              step="any"
              aria-label="スライスの基準X"
              disabled={!activeSlice}
              value={sliceValue("px", activeSlice ? String(slicePivot(activeSlice).x) : "")}
              onFocus={() => { if (activeSlice) setSliceText({ id: activeSlice.id, field: "px", text: String(slicePivot(activeSlice).x) }); }}
              onChange={(event) => { if (activeSlice) setSliceText({ id: activeSlice.id, field: "px", text: event.target.value }); }}
              onBlur={(event) => {
                const slice = (docRef.current.slices ?? []).find((item) => item.id === sliceId);
                setSliceText(null);
                if (!slice) return;
                const parsed = Number(event.target.value);
                if (!Number.isFinite(parsed)) return;
                const pivot = slicePivot(slice);
                patchSlice(slice.id, { ...slice, pivot: { x: parsed, y: pivot.y } });
              }}
            />
          </label>
          <label className="sprite-field">
            基準Y
            <input
              type="number"
              step="any"
              aria-label="スライスの基準Y"
              disabled={!activeSlice}
              value={sliceValue("py", activeSlice ? String(slicePivot(activeSlice).y) : "")}
              onFocus={() => { if (activeSlice) setSliceText({ id: activeSlice.id, field: "py", text: String(slicePivot(activeSlice).y) }); }}
              onChange={(event) => { if (activeSlice) setSliceText({ id: activeSlice.id, field: "py", text: event.target.value }); }}
              onBlur={(event) => {
                const slice = (docRef.current.slices ?? []).find((item) => item.id === sliceId);
                setSliceText(null);
                if (!slice) return;
                const parsed = Number(event.target.value);
                if (!Number.isFinite(parsed)) return;
                const pivot = slicePivot(slice);
                patchSlice(slice.id, { ...slice, pivot: { x: pivot.x, y: parsed } });
              }}
            />
          </label>
          <div className="sprite-transport">
            <button
              type="button"
              aria-pressed={nineOn}
              disabled={doc.frames.length === 0}
              onClick={() => {
                if (nineOn) {
                  setNineOn(false);
                  return;
                }
                beginNine();
              }}
            >
              9-slice
            </button>
            {nineOn ? (
              <button type="button" onClick={() => setNineOn(false)}>
                終了
              </button>
            ) : null}
          </div>
          {nineOn && previewFrame && shownNine && activeNine ? (
            <div className="sprite-nine">
              <p className="sprite-meta">元画像</p>
              <div
                className="sprite-nine-stage"
                ref={nineStageRef}
                style={{ width: previewFrame.width * nineZoom, height: previewFrame.height * nineZoom }}
                onPointerMove={moveNineGuide}
                onPointerUp={() => {
                  nineDrag.current = null;
                }}
              >
                <canvas ref={nineSourceRef} aria-label="9-sliceの元画像" style={{ width: "100%", height: "100%", imageRendering: "pixelated" }} />
                {(["left", "right"] as const).map((edge) => (
                  <i
                    key={edge}
                    className="sprite-nine-guide is-x"
                    style={{ left: (edge === "left" ? shownNine.left : previewFrame.width - shownNine.right) * nineZoom }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      nineDrag.current = { edge, pointer: event.pointerId };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={moveNineGuide}
                    onPointerUp={() => {
                      nineDrag.current = null;
                    }}
                  />
                ))}
                {(["top", "bottom"] as const).map((edge) => (
                  <i
                    key={edge}
                    className="sprite-nine-guide is-y"
                    style={{ top: (edge === "top" ? shownNine.top : previewFrame.height - shownNine.bottom) * nineZoom }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      nineDrag.current = { edge, pointer: event.pointerId };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={moveNineGuide}
                    onPointerUp={() => {
                      nineDrag.current = null;
                    }}
                  />
                ))}
              </div>
              <p className="sprite-meta">プレビュー</p>
              <div className="sprite-nine-result">
                <canvas
                  ref={ninePreviewRef}
                  aria-label="9-sliceプレビュー"
                  className={activeNine.filter === "bilinear" ? "is-smooth" : undefined}
                  style={{
                    width: activeNine.previewWidth,
                    height: activeNine.previewHeight,
                    imageRendering: activeNine.filter === "bilinear" ? "auto" : "pixelated",
                  }}
                />
              </div>
              {([
                ["left", "左マージン", shownNine.left],
                ["right", "右マージン", shownNine.right],
                ["top", "上マージン", shownNine.top],
                ["bottom", "下マージン", shownNine.bottom],
              ] as const).map(([edge, label, value]) => (
                <label key={edge} className="sprite-field">
                  {label}
                  <input
                    type="number"
                    step={1}
                    min={0}
                    aria-label={label}
                    value={nineText?.id === activeNine.frameId && nineText.field === edge ? nineText.text : String(value)}
                    onFocus={() => setNineText({ id: activeNine.frameId, field: edge, text: String(value) })}
                    onChange={(event) => {
                      const text = event.target.value;
                      setNineText({ id: activeNine.frameId, field: edge, text });
                      if (text.trim() === "") return;
                      const parsed = Number(text);
                      if (!Number.isFinite(parsed)) return;
                      writeNine(setNineMargin(activeNine, previewFrame.width, previewFrame.height, edge, parsed));
                    }}
                    onBlur={() => setNineText(null)}
                  />
                </label>
              ))}
              <label className="sprite-field">
                プレビュー幅
                <input
                  type="number"
                  step={1}
                  min={1}
                  max={2048}
                  aria-label="9-sliceの幅"
                  value={nineText?.id === activeNine.frameId && nineText.field === "width" ? nineText.text : String(activeNine.previewWidth)}
                  onFocus={() => setNineText({ id: activeNine.frameId, field: "width", text: String(activeNine.previewWidth) })}
                  onChange={(event) => {
                    const text = event.target.value;
                    setNineText({ id: activeNine.frameId, field: "width", text });
                    const parsed = Number(text);
                    if (!Number.isFinite(parsed)) return;
                    writeNine(setNinePreviewSize(activeNine, parsed, activeNine.previewHeight));
                  }}
                  onBlur={() => setNineText(null)}
                />
              </label>
              <label className="sprite-field">
                プレビュー高さ
                <input
                  type="number"
                  step={1}
                  min={1}
                  max={2048}
                  aria-label="9-sliceの高さ"
                  value={nineText?.id === activeNine.frameId && nineText.field === "height" ? nineText.text : String(activeNine.previewHeight)}
                  onFocus={() => setNineText({ id: activeNine.frameId, field: "height", text: String(activeNine.previewHeight) })}
                  onChange={(event) => {
                    const text = event.target.value;
                    setNineText({ id: activeNine.frameId, field: "height", text });
                    const parsed = Number(text);
                    if (!Number.isFinite(parsed)) return;
                    writeNine(setNinePreviewSize(activeNine, activeNine.previewWidth, parsed));
                  }}
                  onBlur={() => setNineText(null)}
                />
              </label>
              <label className="sprite-field">
                補間
                <select
                  aria-label="9-sliceの補間"
                  value={activeNine.filter}
                  onChange={(event) => writeNine({ ...activeNine, filter: event.target.value === "bilinear" ? "bilinear" : "nearest" })}
                >
                  <option value="nearest">最近傍</option>
                  <option value="bilinear">滑らか</option>
                </select>
              </label>
              <div className="sprite-transport">
                <button type="button" onClick={() => void exportNine()}>
                  PNG書き出し
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void persistRef.current();
                    notify("9-sliceの設定を保存しました。元の画像は変えていません。");
                  }}
                >
                  設定を保存
                </button>
              </div>
            </div>
          ) : null}
          <div className="sprite-transport">
            <span className="sprite-pick-count" data-sprite-label="selection">選択 {selected.length}</span>
            <button type="button" disabled={selected.length === 0} onClick={() => applyOrder(shiftFrames(doc.frames, selected, -1))}>前へ</button>
            <button type="button" disabled={selected.length === 0} onClick={() => applyOrder(shiftFrames(doc.frames, selected, 1))}>後へ</button>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => {
                const copied = duplicateSpriteFrames(docRef.current.frames, selectedRef.current, spriteId);
                if (copied.copyIds.length === 0 || !replaceFrames(copied.frames)) return;
                setSelected(copied.copyIds);
                setAnchorId(copied.copyIds[0] ?? null);
                placeEdit(copied.frames, editRef.current);
              }}
            >
              複製
            </button>
            <button
              type="button"
              disabled={selected.length === 0 || doc.frames.length <= 1}
              onClick={() => dropFrames(selected)}
            >
              削除
            </button>
            <button type="button" onClick={undoFrames} disabled={history.undo.length === 0}>戻す</button>
            <button type="button" onClick={redoFrames} disabled={history.redo.length === 0}>やり直す</button>
            <button type="button" className="is-wipe" disabled={doc.frames.length === 0} onClick={() => setWipe(true)}>
              全削除
            </button>
          </div>
        </aside>
      </div>
      <div className="sprite-dock">
        <input ref={pngInput} type="file" accept="image/png,.png" multiple hidden aria-label="個別PNGを追加" onChange={(event) => onPng(event.target.files)} />
        <input ref={sheetInput} type="file" accept="image/png,image/gif,image/webp,image/jpeg,.png,.gif,.webp,.jpg,.jpeg" hidden aria-label="スプライトシートを読み込む" onChange={(event) => void onSheetFile(event.target.files)} />
        <button type="button" onClick={() => pngInput.current?.click()}>個別PNG</button>
        <button type="button" onClick={() => sheetInput.current?.click()}>シート分割</button>
        <div
          className="sprite-sheet-well"
          onDragOver={(event) => {
            if (Array.from(event.dataTransfer.types).includes(GIF_FRAME_DRAG)) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            if (Array.from(event.dataTransfer.types).includes(GIF_FRAME_DRAG)) return;
            event.preventDefault();
            event.stopPropagation();
            const file = event.dataTransfer.files[0];
            if (!file) {
              notify("シートとして読める画像がありません。フレームは追加していません。");
              return;
            }
            void rgbaFromBlob(file).then((decoded) => {
              if (!decoded) {
                notify("スプライトシートを読めません。フレームは追加していません。");
                return;
              }
              setSplit({ ...decoded, cols: 4, rows: 1 });
            });
          }}
        >
          シートをここにドロップ
        </div>
        <label>
          配置
          <select value={doc.layout} aria-label="シート配置" onChange={(event) => patch({ layout: event.target.value as SheetLayout })}>
            <option value="row">横並び</option>
            <option value="column">縦並び</option>
            <option value="wrap">折り返し</option>
          </select>
        </label>
        <label>
          列数
          <input aria-label="折り返し列数" type="number" min={1} max={64} value={doc.columns} disabled={doc.layout !== "wrap"} onChange={(event) => patch({ columns: Math.max(1, Math.round(Number(event.target.value)) || 1) })} />
        </label>
        <button type="button" onClick={() => patch({ zoom: Math.max(1, doc.zoom - 1) })} disabled={doc.zoom <= 1}>シート−</button>
        <span>×{doc.zoom}</span>
        <button type="button" onClick={() => patch({ zoom: Math.min(16, doc.zoom + 1) })} disabled={doc.zoom >= 16}>シート＋</button>
        <button type="button" disabled={doc.frames.length === 0} onClick={() => void exportSheet()}>シートPNG</button>
        <button type="button" disabled={doc.frames.length === 0} onClick={() => void exportJson()}>設定JSON</button>
        <span className="sprite-gif-save">
          <label>
            倍率
            <select aria-label="確認GIFの倍率" value={gifScale} onChange={(event) => setGifScale(clampGifScale(Number(event.target.value)))}>
              {SPRITE_GIF_SCALES.map((scale) => (
                <option key={scale} value={scale}>
                  {scale}倍
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={doc.frames.length === 0} onClick={() => void exportGif()}>
            確認GIF
          </button>
        </span>
      </div>
      {split
        ? createPortal(
            <div className="canvas-flip-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) setSplit(null); }}>
              <div className="canvas-flip-dialog sprite-split" role="dialog" aria-modal="true" aria-labelledby="sprite-split-title" onPointerDown={(event) => event.stopPropagation()}>
                <p id="sprite-split-title">スプライトシートを分割します。元のファイルは変更しません。</p>
                <p>
                  全体 {split.width}×{split.height}
                  {plan?.ok ? ` ・ 1フレーム ${plan.frameW}×${plan.frameH}` : ""}
                </p>
                <div className="sprite-transport">
                  <label className="sprite-field">
                    列
                    <input type="number" min={1} aria-label="分割の列数" value={split.cols} onChange={(event) => setSplit({ ...split, cols: Math.max(1, Math.round(Number(event.target.value)) || 1) })} />
                  </label>
                  <label className="sprite-field">
                    行
                    <input type="number" min={1} aria-label="分割の行数" value={split.rows} onChange={(event) => setSplit({ ...split, rows: Math.max(1, Math.round(Number(event.target.value)) || 1) })} />
                  </label>
                </div>
                {plan?.ok && (plan.remW > 0 || plan.remH > 0) ? (
                  <p>{`端数があります。右 ${plan.remW}px、下 ${plan.remH}px は分割に含めません。画像は拡大縮小しません。`}</p>
                ) : null}
                {plan && !plan.ok ? <p>{plan.reason}</p> : null}
                {plan?.ok ? (
                  <div className="sprite-split-preview" style={{ gridTemplateColumns: `repeat(${split.cols}, max-content)` }}>
                    {Array.from({ length: split.rows * split.cols }, (_, index) => {
                      const col = index % split.cols;
                      const row = Math.floor(index / split.cols);
                      const rgba = sliceFrame(split.rgba, split.width, plan.frameW, plan.frameH, col, row);
                      return (
                        <canvas
                          key={`${col}-${row}`}
                          width={plan.frameW}
                          height={plan.frameH}
                          ref={(node) => {
                            if (!node) return;
                            const ctx = node.getContext("2d");
                            ctx?.putImageData(new ImageData(new Uint8ClampedArray(rgba), plan.frameW, plan.frameH), 0, 0);
                          }}
                          style={{ width: plan.frameW * 2, height: plan.frameH * 2, imageRendering: "pixelated" }}
                        />
                      );
                    })}
                  </div>
                ) : null}
                <div className="canvas-flip-actions">
                  <button type="button" onClick={() => setSplit(null)}>キャンセル</button>
                  <button type="button" className="is-run" disabled={!plan?.ok} onClick={confirmSplit}>
                    {plan?.ok && (plan.remW > 0 || plan.remH > 0) ? "端数を除いて分割" : "分割して登録"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {wipe
        ? createPortal(
            <div className="canvas-flip-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) setWipe(false); }}>
              <div className="canvas-flip-dialog sprite-split" role="dialog" aria-modal="true" aria-labelledby="sprite-wipe-title" onPointerDown={(event) => event.stopPropagation()}>
                <p id="sprite-wipe-title">すべてのフレーム素材を削除します。よろしいですか？</p>
                <p>フレームだけを消します。名前やFPSなどの設定、ほかのモードのデータは残します。</p>
                <div className="canvas-flip-actions">
                  <button type="button" onClick={() => setWipe(false)}>キャンセル</button>
                  <button type="button" className="is-run" onClick={clearFrames}>削除する</button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {shrink
        ? createPortal(
            <div className="canvas-flip-overlay" onPointerDown={(event) => { if (event.target === event.currentTarget) cancelShrink(); }}>
              <div className="canvas-flip-dialog sprite-split" role="dialog" aria-modal="true" aria-labelledby="sprite-shrink-title" onPointerDown={(event) => event.stopPropagation()}>
                <p id="sprite-shrink-title">{`このGIFフレームは${shrink.width}×${shrink.height}ピクセルです。スプライトの最大サイズ256×256以内に縮小して追加しますか？`}</p>
                <p>{`${shrink.origin}を複製して追加します。元のGIFとフレーム一覧は変えません。`}</p>
                <div className="canvas-flip-actions">
                  <button type="button" onClick={cancelShrink}>キャンセル</button>
                  <button type="button" className="is-run" onClick={confirmShrink}>256以内に縮小して追加</button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
