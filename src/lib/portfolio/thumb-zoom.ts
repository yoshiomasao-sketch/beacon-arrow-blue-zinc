/**
 * Thumbnail → lightbox zoom. A separate layer, so it does not share a
 * transform with the thumbnail tilt or the lightbox tilt.
 */

export const THUMB_ZOOM_MS = 300;
export const THUMB_ZOOM_PHONE_MS = 400;
export const THUMB_CHROME_MS = 150;
/** Real image fades in, then the zoom copy fades out. Never both transparent. */
export const THUMB_HANDOFF_MS = 120;
export const THUMB_ZOOM_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export type ZoomRect = { left: number; top: number; width: number; height: number };

export function zoomRectOf(node: Element | null): ZoomRect | null {
  if (!(node instanceof HTMLElement)) return null;
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

export function canThumbZoom(reducedMotion: boolean, source: ZoomRect | null): source is ZoomRect {
  return !reducedMotion && !!source && source.width >= 2 && source.height >= 2;
}

/** Move and scale a box from the thumbnail to the lightbox image. Null if either box is unusable. */
export function zoomShift(source: ZoomRect, dest: ZoomRect): { x: number; y: number; sx: number; sy: number } | null {
  if (source.width < 2 || source.height < 2 || dest.width < 2 || dest.height < 2) return null;
  const sx = dest.width / source.width;
  const sy = dest.height / source.height;
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx <= 0 || sy <= 0) return null;
  return { x: dest.left - source.left, y: dest.top - source.top, sx, sy };
}

/** Where the lightbox will place the picture inside the stage. Matches its 16px side inset. */
export function frameInStage(stage: ZoomRect, imageW: number, imageH: number, inset = 16): ZoomRect | null {
  const widthBudget = stage.width - inset * 2;
  if (widthBudget <= 0 || stage.height <= 0 || imageW <= 0 || imageH <= 0) return null;
  const scale = Math.min(widthBudget / imageW, stage.height / imageH);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const width = imageW * scale;
  const height = imageH * scale;
  return {
    left: stage.left + inset + (widthBudget - width) / 2,
    top: stage.top + (stage.height - height) / 2,
    width,
    height,
  };
}
