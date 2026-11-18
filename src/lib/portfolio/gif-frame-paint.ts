/**
 * Browser painter for one temporary frame.
 * The canvas is cleared after the blob exists so the bitmap is not kept beside the URL.
 */

import { thumbBox, type GifFramePainter } from "./gif-frame-session.ts";

function canvasFromRgba(rgba: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("canvas");
  const pixels = new Uint8ClampedArray(rgba);
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  return canvas;
}

function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      releaseCanvas(canvas);
      if (!blob) reject(new Error("png"));
      else resolve(blob);
    }, "image/png");
  });
}

export function browserFramePainter(): GifFramePainter {
  return {
    async thumbUrl(rgba, width, height) {
      const source = canvasFromRgba(rgba, width, height);
      const box = thumbBox(width, height);
      const canvas = box.width === width && box.height === height ? source : document.createElement("canvas");
      if (canvas !== source) {
        canvas.width = box.width;
        canvas.height = box.height;
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) {
          releaseCanvas(source);
          throw new Error("canvas");
        }
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(source, 0, 0, box.width, box.height);
        releaseCanvas(source);
      }
      const blob = await blobFromCanvas(canvas);
      return URL.createObjectURL(blob);
    },
    pngBlob(rgba, width, height) {
      return blobFromCanvas(canvasFromRgba(rgba, width, height));
    },
    revoke(url) {
      URL.revokeObjectURL(url);
    },
  };
}
