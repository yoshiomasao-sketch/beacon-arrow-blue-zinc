/**
 * Auto-scroll while a thumbnail is dragged near the list viewport edge.
 * Speed is pixels per second so it does not depend on the frame rate.
 */

export const DRAG_SCROLL_ZONE = 80;
export const DRAG_SCROLL_MAX = 840;

/** Keep the band from swallowing a short list. */
export function dragScrollZone(viewHeight: number, zone = DRAG_SCROLL_ZONE): number {
  if (!Number.isFinite(viewHeight) || viewHeight <= 0) return 0;
  const cap = Number.isFinite(zone) && zone > 0 ? zone : DRAG_SCROLL_ZONE;
  return Math.min(cap, viewHeight * 0.25);
}

/**
 * Pointer px/s. Negative scrolls up. Zero outside the band, full speed at the edge.
 */
export function dragScrollSpeed(
  clientY: number,
  top: number,
  bottom: number,
  zone = DRAG_SCROLL_ZONE,
  max = DRAG_SCROLL_MAX,
): number {
  const band = dragScrollZone(bottom - top, zone);
  const limit = Number.isFinite(max) && max > 0 ? max : DRAG_SCROLL_MAX;
  if (band <= 0 || !Number.isFinite(clientY) || !Number.isFinite(top) || !Number.isFinite(bottom)) return 0;
  const fromTop = clientY - top;
  const fromBottom = bottom - clientY;
  if (fromTop >= 0 && fromTop < band) return -limit * (1 - fromTop / band);
  if (fromBottom >= 0 && fromBottom < band) return limit * (1 - fromBottom / band);
  return 0;
}

/** Clamp a time step so a stalled frame cannot jump the list, and never past the ends. */
export function dragScrollStep(scrollTop: number, maxScroll: number, speed: number, dtMs: number): number {
  const top = Number.isFinite(scrollTop) ? scrollTop : 0;
  const limit = Number.isFinite(maxScroll) && maxScroll > 0 ? maxScroll : 0;
  const dt = Math.min(0.05, Math.max(0, Number.isFinite(dtMs) ? dtMs : 0) / 1000);
  const next = top + (Number.isFinite(speed) ? speed : 0) * dt;
  return Math.min(limit, Math.max(0, next));
}
