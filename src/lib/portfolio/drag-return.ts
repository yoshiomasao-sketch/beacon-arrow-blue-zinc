/**
 * Invalid-drop return. The clone travels the straight segment from the
 * release point to the card and stops on the card. It never passes home.
 */

export const RETURN_MS = 180;

/** Ease-out cubic. `t` is clamped to [0, 1], so the result stays in [0, 1]. */
export function returnEase(t: number): number {
  const u = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const inv = 1 - u;
  return 1 - inv * inv * inv;
}

/**
 * Point on the segment from `from` to `home`.
 * Any `t` stays on that segment: t <= 0 is `from`, t >= 1 is exactly `home`.
 */
export function returnPoint(
  from: { x: number; y: number },
  home: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const e = returnEase(t);
  const fx = Number.isFinite(from.x) ? from.x : 0;
  const fy = Number.isFinite(from.y) ? from.y : 0;
  const hx = Number.isFinite(home.x) ? home.x : fx;
  const hy = Number.isFinite(home.y) ? home.y : fy;
  return {
    x: fx + (hx - fx) * e,
    y: fy + (hy - fy) * e,
  };
}
