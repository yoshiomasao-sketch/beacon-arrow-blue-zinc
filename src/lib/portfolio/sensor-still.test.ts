import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tiltFromPose } from "./device-tilt.ts";
import { SENSOR_STILL_DEG, SENSOR_STILL_MS, applyStillTilt, freshStillWatch } from "./sensor-still.ts";

describe("still tilt reset", () => {
  const held = { beta: 40, gamma: 8 };
  const baseline0 = { beta: 40 - 22, gamma: 8 };

  it("ignores noise and recenters only after two quiet seconds", () => {
    let watch = freshStillWatch();
    let baseline = baseline0;
    let shown = { x: 10, y: 0 };
    const started = applyStillTilt({ watch, baseline, shown, pose: held, now: 0, dt: 32 });
    watch = started.watch;
    for (let t = 100; t < SENSOR_STILL_MS; t += 100) {
      const step = applyStillTilt({
        watch,
        baseline,
        shown,
        pose: { beta: held.beta + 0.4, gamma: held.gamma - 0.3 },
        now: t,
        dt: 100,
      });
      watch = step.watch;
      baseline = step.baseline;
      shown = step.shown;
      assert.equal(step.settling, false);
    }
    const reset = applyStillTilt({
      watch,
      baseline,
      shown,
      pose: { beta: held.beta + 0.4, gamma: held.gamma - 0.3 },
      now: SENSOR_STILL_MS + 50,
      dt: 32,
    });
    assert.equal(reset.settling, true);
    assert.ok(reset.shown.x < shown.x);
    assert.ok(reset.shown.x > 8);
  });

  it("restarts the wait when the phone actually moves", () => {
    let watch = { anchor: held, since: 0, settling: false };
    const moved = applyStillTilt({
      watch,
      baseline: baseline0,
      shown: { x: 10, y: 0 },
      pose: { beta: held.beta + SENSOR_STILL_DEG + 1, gamma: held.gamma },
      now: 1500,
      dt: 32,
    });
    assert.equal(moved.settling, false);
    assert.equal(moved.watch.since, 1500);
    const early = applyStillTilt({
      watch: moved.watch,
      baseline: moved.baseline,
      shown: moved.shown,
      pose: moved.watch.anchor!,
      now: 1500 + SENSOR_STILL_MS - 10,
      dt: 32,
    });
    assert.equal(early.settling, false);
  });

  it("eases back, then follows a new move without a jump", () => {
    const watch = { anchor: held, since: 0, settling: true };
    const shown = { x: 8, y: -3 };
    const easing = applyStillTilt({ watch, baseline: held, shown, pose: held, now: 100, dt: 32 });
    assert.equal(easing.settling, true);
    assert.ok(easing.shown.x < 8 && easing.shown.x > 6);
    const nextPose = { beta: held.beta + 8, gamma: held.gamma - 6 };
    const interrupted = applyStillTilt({
      watch: easing.watch,
      baseline: easing.baseline,
      shown: easing.shown,
      pose: nextPose,
      now: 200,
      dt: 32,
    });
    assert.equal(interrupted.settling, false);
    assert.ok(interrupted.shown.x > easing.shown.x);
    assert.ok(interrupted.shown.x < easing.shown.x + 3);
    const followed = tiltFromPose(nextPose, interrupted.baseline);
    assert.ok(followed.x > interrupted.shown.x);
  });
});
