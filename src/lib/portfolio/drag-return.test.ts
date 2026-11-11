import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RETURN_MS, returnEase, returnPoint } from "./drag-return.ts";

function segmentT(from: { x: number; y: number }, home: { x: number; y: number }, point: { x: number; y: number }): number {
  const dx = home.x - from.x;
  const dy = home.y - from.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return ((point.x - from.x) * dx + (point.y - from.y) * dy) / len2;
}

describe("gallery drag return", () => {
  it("finishes in about 150–200ms and eases only forward", () => {
    assert.ok(RETURN_MS >= 150 && RETURN_MS <= 200);
    assert.equal(returnEase(0), 0);
    assert.equal(returnEase(1), 1);
    assert.equal(returnEase(-1), 0);
    assert.equal(returnEase(2), 1);
    assert.equal(returnEase(Number.NaN), 0);
    let prev = -1;
    for (let step = 0; step <= 20; step += 1) {
      const eased = returnEase(step / 20);
      assert.ok(eased >= prev);
      assert.ok(eased <= 1);
      prev = eased;
    }
  });

  it("stays on the segment and lands exactly on home", () => {
    const from = { x: 40, y: 18 };
    const home = { x: -12, y: 70 };
    assert.deepEqual(returnPoint(from, home, 0), from);
    assert.deepEqual(returnPoint(from, home, 1), home);
    assert.deepEqual(returnPoint(from, home, 4), home);
    let prev = -1;
    let prevDist = Number.POSITIVE_INFINITY;
    for (let ms = 0; ms <= RETURN_MS; ms += 16) {
      const point = returnPoint(from, home, ms / RETURN_MS);
      const along = segmentT(from, home, point);
      const dx = home.x - from.x;
      const dy = home.y - from.y;
      const cross = (point.x - from.x) * dy - (point.y - from.y) * dx;
      assert.ok(along >= -1e-9 && along <= 1 + 1e-9, `left the segment at ${ms}ms (${along})`);
      assert.ok(Math.abs(cross) < 1e-6);
      assert.ok(along + 1e-9 >= prev);
      const dist = Math.hypot(point.x - home.x, point.y - home.y);
      assert.ok(dist <= prevDist + 1e-9);
      prev = along;
      prevDist = dist;
    }
    assert.deepEqual(returnPoint(from, home, 1), home);
    assert.ok(prevDist < 1);
  });

  it("does not pass a home that sits behind the release point", () => {
    const from = { x: 180, y: 40 };
    const home = { x: 20, y: 40 };
    for (let step = 0; step <= 40; step += 1) {
      const point = returnPoint(from, home, step / 40);
      assert.ok(point.x <= from.x + 1e-9);
      assert.ok(point.x >= home.x - 1e-9);
      assert.equal(point.y, 40);
    }
  });
});
