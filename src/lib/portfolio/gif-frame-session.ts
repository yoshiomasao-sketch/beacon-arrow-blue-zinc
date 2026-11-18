/**
 * Temporary GIF frame walk.
 * Thumbs are published one at a time and the full pixels are dropped.
 * A PNG is painted by walking again from the first frame, so the list does not
 * keep every full-screen bitmap. `release` drops the file bytes and revokes
 * every thumb URL. A second release does nothing.
 */

import { baseName } from "./logic.ts";
import { openGifReader, type GifDecodedFrame } from "./gif-decode.ts";

export const GIF_THUMB_EDGE = 240;

export type GifFrameThumb = {
  index: number;
  delayMs: number;
  url: string;
};

export type GifFramePainter = {
  thumbUrl: (rgba: Uint8ClampedArray, width: number, height: number) => Promise<string>;
  pngBlob: (rgba: Uint8ClampedArray, width: number, height: number) => Promise<Blob>;
  revoke: (url: string) => void;
};

export type GifFramePng = {
  blob: Blob;
  delayMs: number;
  width: number;
  height: number;
};

export type GifFrameListResult = {
  count: number;
  aborted: boolean;
  failed: boolean;
};

export type GifFrameSession = {
  readonly width: number;
  readonly height: number;
  readonly released: boolean;
  list: (onThumb: (thumb: GifFrameThumb) => void, signal?: AbortSignal) => Promise<GifFrameListResult>;
  png: (index: number, signal?: AbortSignal) => Promise<GifFramePng | null>;
  release: () => void;
};

export function thumbBox(width: number, height: number, edge = GIF_THUMB_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= edge) return { width: Math.max(1, width), height: Math.max(1, height) };
  const scale = edge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** `dance.gif` frame 1 → `dance_frame_01.png`. The original name is not rewritten. */
export function framePngName(name: string, index: number): string {
  const stem = baseName(name).replace(/\.gif$/i, "") || "frame";
  const number = String(Math.max(0, index) + 1).padStart(2, "0");
  return `${stem}_frame_${number}.png`;
}

/** Drag name for one composited frame. `GIF_Frame_001.png` is frame 1. */
export function dragFrameName(index: number): string {
  const number = String(Math.max(0, Math.trunc(index)) + 1).padStart(3, "0");
  return `GIF_Frame_${number}.png`;
}

/** In-app drag of one GIF frame. The sprite editor reads the original GIF again from this id. */
export const GIF_FRAME_DRAG = "application/x-komacho-gif-frame";

export type GifFrameDrag = {
  itemId: string;
  index: number;
  name: string;
};

export function writeGifFrameDrag(sink: { effectAllowed: string; setData: (type: string, value: string) => void }, drag: GifFrameDrag): boolean {
  if (!drag.itemId || !Number.isInteger(drag.index) || drag.index < 0) return false;
  try {
    sink.effectAllowed = "copy";
    sink.setData(GIF_FRAME_DRAG, JSON.stringify({ itemId: drag.itemId, index: drag.index, name: drag.name }));
    sink.setData("text/plain", dragFrameName(drag.index));
    return true;
  } catch {
    return false;
  }
}

export function readGifFrameDrag(raw: string): GifFrameDrag | null {
  try {
    const parsed = JSON.parse(raw) as Partial<GifFrameDrag>;
    if (typeof parsed.itemId !== "string" || parsed.itemId.length === 0) return null;
    if (typeof parsed.index !== "number" || !Number.isInteger(parsed.index) || parsed.index < 0) return null;
    return { itemId: parsed.itemId, index: parsed.index, name: typeof parsed.name === "string" ? parsed.name : "" };
  } catch {
    return null;
  }
}

/** Stay inside the list. The ends do not wrap. */
export function nextFrameIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  const next = index + delta;
  if (next < 0) return 0;
  if (next >= count) return count - 1;
  return next;
}

export type FrameDragSink = {
  effectAllowed: string;
  setData: (type: string, value: string) => void;
  items: { add: (file: File) => unknown };
  files?: ArrayLike<File>;
};

/**
 * Put the composited PNG on a drag.
 * DownloadURL uses a data URL when one is ready, so another window can take
 * the file without reading this page's blob. An image file the browser already
 * attached is left in place. Returns false when no image file can be offered.
 */
export function placeFrameDrag(sink: FrameDragSink, file: File, url: string | null): boolean {
  const listed = () => Array.from(sink.files ?? []);
  const bitmap = (items: readonly File[]) => items.some((item) => item.size > 0 && item.type.startsWith("image/"));
  try {
    sink.effectAllowed = "copy";
    sink.setData("text/plain", file.name);
  } catch {
    return false;
  }
  if (url && /^(blob:|https?:|data:)/.test(url)) {
    try {
      sink.setData("DownloadURL", `image/png:${file.name.replace(/:/g, "_")}:${url}`);
    } catch {
      /* a long data URL can be refused; the file item still carries the pixels */
    }
  }
  try {
    if (!bitmap(listed())) sink.items.add(file);
  } catch {
    if (!bitmap(listed())) return false;
  }
  const after = listed();
  if (after.length > 0) return bitmap(after);
  return file.size > 0 && file.type.startsWith("image/");
}

export function frameAddOutcome(before: number, after: number, pendingChanged: boolean): "added" | "choose-folder" | "unchanged" {
  if (pendingChanged) return "choose-folder";
  if (after > before) return "added";
  return "unchanged";
}

export function openGifFrameSession(bytes: Uint8Array, paint: GifFramePainter): GifFrameSession {
  let held: Uint8Array | null = bytes;
  let released = false;
  const urls: string[] = [];
  const probe = openGifReader(bytes);
  const width = probe.width;
  const height = probe.height;

  const release = () => {
    if (released) return;
    released = true;
    held = null;
    while (urls.length > 0) {
      const url = urls.pop();
      if (!url) continue;
      try {
        paint.revoke(url);
      } catch {
        /* a second revoke from the browser is not this list's problem */
      }
    }
  };

  const walk = (index: number, signal?: AbortSignal): GifDecodedFrame | null => {
    if (released || !held || index < 0 || signal?.aborted) return null;
    const reader = openGifReader(held);
    let frame: GifDecodedFrame | null = null;
    for (let at = 0; at <= index; at += 1) {
      if (released || signal?.aborted) return null;
      frame = reader.next();
      if (!frame) return null;
    }
    return frame;
  };

  return {
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    get released() {
      return released;
    },
    release,
    async list(onThumb, signal) {
      if (released || !held) return { count: 0, aborted: true, failed: false };
      const reader = openGifReader(held);
      let count = 0;
      while (!released && !signal?.aborted) {
        let frame: GifDecodedFrame | null;
        try {
          frame = reader.next();
        } catch {
          return { count, aborted: true, failed: true };
        }
        if (!frame) return { count, aborted: false, failed: false };
        let url = "";
        try {
          url = await paint.thumbUrl(frame.rgba, frame.width, frame.height);
        } catch {
          return { count, aborted: true, failed: true };
        }
        if (released || signal?.aborted) {
          try {
            paint.revoke(url);
          } catch {
            /* the caller already left */
          }
          return { count, aborted: true, failed: false };
        }
        urls.push(url);
        count += 1;
        onThumb({ index: count - 1, delayMs: frame.delayMs, url });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return { count, aborted: true, failed: false };
    },
    async png(index, signal) {
      const frame = walk(index, signal);
      if (!frame) return null;
      const rgba = frame.rgba;
      const frameWidth = frame.width;
      const frameHeight = frame.height;
      const delayMs = frame.delayMs;
      const blob = await paint.pngBlob(rgba, frameWidth, frameHeight);
      if (signal?.aborted) return null;
      return { blob, delayMs, width: frameWidth, height: frameHeight };
    },
  };
}
