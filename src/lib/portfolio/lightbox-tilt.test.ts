import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RECOIL_MAX_DEG, RECOIL_MS, RECOIL_SPEED_FULL, RECOIL_SPEED_MIN, TILT_MAX_DEG, TILT_RANGE_PX, TILT_RETURN_MS, recoilKeyframes, sheenFromTilt, tiltAtRecoil, tiltFromDrag, tiltFromMatrix, tiltVelocity } from "./lightbox-tilt.ts";

describe("lightbox tilt", () => {
  it("stays flat with no drag and caps each axis at 5 degrees", () => {
    assert.deepEqual(tiltFromDrag(0, 0), { x: 0, y: 0 });
    assert.equal(TILT_MAX_DEG, 5);
    assert.equal(TILT_RETURN_MS, 240);
    const full = tiltFromDrag(TILT_RANGE_PX, 0);
    assert.equal(full.y, 5);
    assert.equal(full.x, 0);
    assert.equal(tiltFromDrag(TILT_RANGE_PX * 4, 0).y, 5);
    assert.equal(tiltFromDrag(-TILT_RANGE_PX, 0).y, -5);
    assert.equal(tiltFromDrag(0, TILT_RANGE_PX).x, -5);
    assert.equal(tiltFromDrag(0, -TILT_RANGE_PX).x, 5);
  });

  it("scales with drag distance and continues from a mid-return angle", () => {
    const half = tiltFromDrag(TILT_RANGE_PX / 2, TILT_RANGE_PX / 2);
    assert.ok(Math.abs(half.y - 2.5) < 1e-9);
    assert.ok(Math.abs(half.x - -2.5) < 1e-9);
    const next = tiltFromDrag(TILT_RANGE_PX, 0, { x: -2, y: 4 });
    assert.equal(next.y, 5);
    assert.equal(next.x, -2);
    assert.deepEqual(tiltFromDrag(Number.NaN, Number.POSITIVE_INFINITY), { x: 0, y: 0 });
  });

  it("reads rotateX/rotateY back out of the CSS matrix", () => {
    const back = tiltFromMatrix(0.996195, 0.999048, -0.0436194, 0.0871557);
    assert.ok(Math.abs(back.x - -2.5) < 0.05, String(back.x));
    assert.ok(Math.abs(back.y - 5) < 0.05, String(back.y));
    assert.deepEqual(tiltFromMatrix(Number.NaN, 1, 0, 0), { x: 0, y: 0 });
  });

  it("slides the highlight with tilt and parks it when the card is flat", () => {
    assert.deepEqual(sheenFromTilt({ x: 0, y: 0 }), { x: 0, y: 0, opacity: 0, turn: 0 });
    const right = sheenFromTilt({ x: 0, y: TILT_MAX_DEG });
    const left = sheenFromTilt({ x: 0, y: -TILT_MAX_DEG });
    assert.ok(right.x > 0 && left.x < 0);
    assert.equal(right.x, -left.x);
    assert.ok(right.opacity > 0 && right.opacity <= 0.55);
    const down = sheenFromTilt({ x: -TILT_MAX_DEG, y: 0 });
    const up = sheenFromTilt({ x: TILT_MAX_DEG, y: 0 });
    assert.ok(down.y > 0 && up.y < 0);
    assert.equal(down.y, -up.y);
    const diagonal = sheenFromTilt({ x: TILT_MAX_DEG, y: TILT_MAX_DEG });
    assert.ok(diagonal.opacity <= 0.55);
    assert.ok(Math.abs(diagonal.x) > 0 && Math.abs(diagonal.y) > 0);
    const past = sheenFromTilt({ x: 0, y: RECOIL_MAX_DEG });
    assert.ok(past.x > right.x);
    assert.equal(past.opacity, 0.55);
  });

  it("keeps a recoil angle when a new drag starts, then rejoins the 5 degree rail", () => {
    assert.equal(tiltFromDrag(0, 0, { x: 0, y: 9 }).y, 9);
    assert.equal(tiltFromDrag(40, 0, { x: 0, y: 9 }).y, 9);
    assert.ok(Math.abs(tiltFromDrag(-40, 0, { x: 0, y: 9 }).y - 6.5) < 1e-9);
    assert.equal(tiltFromDrag(-TILT_RANGE_PX * 4, 0, { x: 0, y: 9 }).y, -5);
    assert.equal(tiltFromDrag(TILT_RANGE_PX, 0, { x: 0, y: 4 }).y, 5);
  });

  it("reads a recoil angle above 5 degrees back out of the matrix", () => {
    const y = (8 * Math.PI) / 180;
    const back = tiltFromMatrix(Math.cos(y), 1, 0, Math.sin(y));
    assert.ok(Math.abs(back.y - 8) < 0.05, String(back.y));
    assert.ok(Math.abs(back.x) < 0.05, String(back.x));
    assert.ok(Math.abs(back.y) <= RECOIL_MAX_DEG);
  });

  it("builds one recoil from recent speed and ignores a slow release", () => {
    assert.equal(RECOIL_MAX_DEG, 10);
    assert.ok(RECOIL_MS >= 350 && RECOIL_MS <= 450);
    assert.equal(recoilKeyframes({ x: 0, y: 5 }, RECOIL_SPEED_MIN - 0.1, 0), null);
    assert.equal(recoilKeyframes({ x: 0, y: 5 }, 0, 0), null);
    const weak = recoilKeyframes({ x: 0, y: 5 }, RECOIL_SPEED_MIN + 0.1, 0);
    const strong = recoilKeyframes({ x: 0, y: 5 }, RECOIL_SPEED_FULL, 0);
    assert.ok(weak && strong);
    assert.ok(strong[1].tilt.y > weak[1].tilt.y);
    assert.ok(weak[1].tilt.y > 5 && weak[1].tilt.y < 7);
    assert.equal(strong[1].tilt.y, 10);
    assert.ok(strong[2].tilt.y < 0 && strong[2].tilt.y > -3);
    const left = recoilKeyframes({ x: 0, y: -5 }, -RECOIL_SPEED_FULL, 0);
    assert.equal(left?.[1].tilt.y, -10);
    assert.ok((left?.[2].tilt.y ?? 0) > 0);
    const down = recoilKeyframes({ x: -5, y: 0 }, 0, RECOIL_SPEED_FULL);
    assert.equal(down?.[1].tilt.x, -10);
    assert.equal(down?.[1].tilt.y, 0);
    const diagonal = recoilKeyframes({ x: -5, y: 5 }, RECOIL_SPEED_FULL, RECOIL_SPEED_FULL);
    assert.equal(diagonal?.[1].tilt.y, 10);
    assert.equal(diagonal?.[1].tilt.x, -10);
    const onlyY = recoilKeyframes({ x: 3, y: 5 }, RECOIL_SPEED_FULL, 0);
    assert.ok((onlyY?.[1].tilt.x ?? 0) > 0);
    assert.ok((onlyY?.[2].tilt.x ?? 0) > 0);
    const huge = recoilKeyframes({ x: 0, y: 5 }, 100, 0);
    assert.equal(huge?.[1].tilt.y, 10);
    assert.ok(Math.abs(huge?.[2].tilt.y ?? 0) <= RECOIL_MAX_DEG);
  });

  it("swings back once and is flat at the end", () => {
    const frames = recoilKeyframes({ x: 0, y: 5 }, RECOIL_SPEED_FULL, 0);
    assert.ok(frames);
    assert.equal(tiltAtRecoil(frames, 0).y, 5);
    assert.equal(tiltAtRecoil(frames, 1).y, 0);
    let previous = frames[0].tilt.y;
    let crosses = 0;
    for (let step = 1; step <= 40; step += 1) {
      const y = tiltAtRecoil(frames, step / 40).y;
      assert.ok(Math.abs(y) <= RECOIL_MAX_DEG + 1e-6);
      if ((previous > 0 && y < 0) || (previous < 0 && y > 0)) crosses += 1;
      previous = y;
    }
    assert.equal(crosses, 1);
  });

  it("measures speed across the recent window and drops spikes", () => {
    const steady = tiltVelocity(
      [
        { t: 800, x: 0, y: 0 },
        { t: 940, x: 0, y: 0 },
        { t: 1000, x: 80, y: 0 },
      ],
      1000,
    );
    assert.ok(Math.abs(steady.vx - 80 / 60) < 1e-9);
    assert.equal(steady.vy, 0);
    assert.deepEqual(
      tiltVelocity(
        [
          { t: 990, x: 0, y: 0 },
          { t: 995, x: 400, y: 0 },
        ],
        1000,
      ),
      { vx: 0, vy: 0 },
    );
    assert.equal(tiltVelocity([{ t: 940, x: 0, y: 0 }, { t: 1000, x: 10000, y: 0 }], 1000).vx, 4);
    assert.deepEqual(tiltVelocity([{ t: Number.NaN, x: 0, y: 0 }], 1000), { vx: 0, vy: 0 });
  });
});
