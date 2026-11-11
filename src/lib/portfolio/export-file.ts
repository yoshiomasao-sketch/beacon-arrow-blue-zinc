import { readPixels } from "./db.ts";
import { exportFileName } from "./logic.ts";
import type { ImageMeta } from "./types.ts";

const ready = new Map<string, File>();
const pending = new Map<string, Promise<File | null>>();
const order: string[] = [];
const MAX_READY = 8;
let activeReads = 0;
const waiters: (() => void)[] = [];

function schedule<T>(job: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeReads += 1;
      job().then(resolve, reject).finally(() => {
        activeReads -= 1;
        waiters.shift()?.();
      });
    };
    if (activeReads < 2) run();
    else waiters.push(run);
  });
}

export const OWN_FILE_DRAG = "application/x-komacho-file";
/** Gallery thumbnail dragged out of the app. The payload is the original file, not the thumb or pen layer. */
export const SHOT_DRAG = "application/x-komacho-shot";

export type OriginalDragSink = {
  effectAllowed: string;
  setData: (type: string, value: string) => void;
  items: { add: (file: File) => unknown; clear?: () => void };
  files?: ArrayLike<File>;
};

/** A File around the stored original bytes. Does not re-encode or write anything back. */
export function fileFromOriginal(meta: { name: string; mime: string; addedAt: number }, blob: Blob): File {
  return new File([blob], exportFileName(meta.name, meta.mime), {
    type: meta.mime,
    lastModified: meta.addedAt || Date.now(),
  });
}

/**
 * Offer the original file to another app.
 * Leaves the browser's own image file in place — clearing it drops the bitmap
 * Chrome would hand to another window, and a script-added file is not a reliable
 * replacement there. DownloadURL carries the real name for desktop drops.
 */
export function writeOriginalDrag(sink: OriginalDragSink, id: string, file: File, url?: string): void {
  sink.effectAllowed = "copy";
  sink.setData(SHOT_DRAG, id);
  sink.setData(OWN_FILE_DRAG, id);
  sink.setData("text/plain", file.name);
  if (url && /^(blob:|https?:|data:)/.test(url)) {
    const mime = file.type || "application/octet-stream";
    const name = file.name.replace(/:/g, "_");
    sink.setData("DownloadURL", `${mime}:${name}:${url}`);
  }
  const existing = Array.from(sink.files ?? []);
  const hasBitmap = existing.some((item) => item.size > 0 && item.type.startsWith("image/"));
  if (hasBitmap) return;
  try {
    sink.items.add(file);
  } catch {
    /* the image element is already carrying the bitmap */
  }
}

function remember(id: string, file: File): void {
  ready.set(id, file);
  const at = order.indexOf(id);
  if (at >= 0) order.splice(at, 1);
  order.push(id);
  while (order.length > MAX_READY) {
    const stale = order.shift();
    if (stale) ready.delete(stale);
  }
}

export function releaseOriginal(id: string): void {
  ready.delete(id);
  pending.delete(id);
  const at = order.indexOf(id);
  if (at >= 0) order.splice(at, 1);
}

export function releaseAllOriginals(): void {
  ready.clear();
  pending.clear();
  order.length = 0;
}

export function cachedOriginal(id: string): File | null {
  return ready.get(id) ?? null;
}

/** Keep a File for a blob the viewer already loaded, so a drag does not read it again. */
export function offerOriginal(meta: { id: string; name: string; mime: string; addedAt: number }, blob: Blob): File {
  const hit = ready.get(meta.id);
  if (hit) return hit;
  const file = fileFromOriginal(meta, blob);
  remember(meta.id, file);
  pending.delete(meta.id);
  return file;
}

let blankDrag: HTMLCanvasElement | null = null;

/** Hide the browser's default drag ghost so it does not sit on top of the in-page pull. */
export function hideNativeDragImage(transfer: DataTransfer): void {
  if (typeof document === "undefined") return;
  if (!blankDrag) {
    blankDrag = document.createElement("canvas");
    blankDrag.width = 1;
    blankDrag.height = 1;
  }
  try {
    transfer.setDragImage(blankDrag, 0, 0);
  } catch {
    /* the file payload still leaves with the drag */
  }
}

let ownDragDepth = 0;

export function beginOwnFileDrag(): void {
  ownDragDepth += 1;
}

export function endOwnFileDrag(): void {
  ownDragDepth = Math.max(0, ownDragDepth - 1);
}

export function ownFileDragActive(): boolean {
  return ownDragDepth > 0;
}

/** Builds a File from the stored original. Does not write anything back. */
export function primeOriginal(meta: ImageMeta): Promise<File | null> {
  const hit = ready.get(meta.id);
  if (hit) return Promise.resolve(hit);
  const current = pending.get(meta.id);
  if (current) return current;
  const task = schedule(() => readPixels(meta.id, "original"))
    .then((blob) => {
      pending.delete(meta.id);
      if (!blob) return null;
      const file = fileFromOriginal(meta, blob);
      remember(meta.id, file);
      return file;
    })
    .catch((error: unknown) => {
      pending.delete(meta.id);
      throw error;
    });
  pending.set(meta.id, task);
  return task;
}

export async function downloadOriginal(meta: ImageMeta): Promise<boolean> {
  const file = await primeOriginal(meta);
  if (!file) return false;
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
}
