import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RUBBER_MAX_PAST, clampSpeed, rubberFade, stepRubber, type RubberVec } from "./drag-rubber.ts";

function release(vx: number): { minX: number; end: RubberVec & { done: boolean } } {
  const home = { x: 0, y: 0 };
  let current = stepRubber({ x: 80, y: 0, vx, vy: 0 }, home, 16);
  let minX = current.x;
  for (let i = 0; i < 89; i += 1) {
    current = stepRubber(current, home, 16);
    minX = Math.min(minX, current.x);
  }
  return { minX, end: current };
}

describe("gallery drag rubber", () => {
  it("caps speed and ignores non-finite samples", () => {
    assert.deepEqual(clampSpeed(0, 0), { vx: 0, vy: 0 });
    assert.equal(clampSpeed(3000, 0).vx, 1600);
    assert.ok(Math.hypot(clampSpeed(2000, 2000).vx, clampSpeed(2000, 2000).vy) <= 1600.01);
    assert.deepEqual(clampSpeed(Number.NaN, Number.POSITIVE_INFINITY), { vx: 0, vy: 0 });
  });

  it("does not clamp the approach from far away", () => {
    const next = stepRubber({ x: 200, y: 0, vx: -500, vy: 0 }, { x: 0, y: 0 }, 16);
    assert.ok(next.x > RUBBER_MAX_PAST);
    assert.ok(next.x < 200);
  });

  it("overshoots a little when released slowly and more when flicked, then settles", () => {
    const slow = release(-80);
    const fast = release(-1400);
    assert.ok(slow.minX < 0 && slow.minX > -RUBBER_MAX_PAST);
    assert.ok(fast.minX < slow.minX);
    assert.ok(fast.minX >= -RUBBER_MAX_PAST - 0.01);
    assert.equal(slow.end.done, true);
    assert.equal(fast.end.done, true);
    assert.ok(Math.hypot(slow.end.x, slow.end.y) <= 0.6);
    assert.ok(Math.hypot(fast.end.x, fast.end.y) <= 0.6);
  });

  it("stops a hard outward flick at the cap", () => {
    const next = stepRubber({ x: 70, y: 0, vx: 5000, vy: 0 }, { x: 0, y: 0 }, 16);
    assert.ok(Math.abs(next.x - RUBBER_MAX_PAST) < 0.01);
    assert.ok(next.vx <= 0);
  });

  it("crossfades only while the clone covers the card", () => {
    assert.deepEqual(rubberFade(100), { clone: 1, card: 0.55 });
    assert.deepEqual(rubberFade(0), { clone: 0, card: 1 });
    const mid = rubberFade(18);
    assert.ok(Math.abs(mid.clone - 0.5) < 1e-9);
    assert.ok(Math.abs(mid.card - 0.775) < 1e-9);
  });
});
