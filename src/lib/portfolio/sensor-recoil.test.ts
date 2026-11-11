import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SENSOR_RECOIL_MAX_DEG,
  SENSOR_RECOIL_MS,
  freshSensorRecoilWatch,
  observeSensorReturn,
  sensorRecoilAngle,
  sensorRecoilOffset,
  sensorRecoilOffsets,
  sensorReturnReversed,
} from "./sensor-recoil.ts";

function play(steps: { t: number; x?: number; y?: number }[]) {
  let watch = freshSensorRecoilWatch();
  const impulses: { t: number; x: number; y: number }[] = [];
  for (const step of steps) {
    const out = observeSensorReturn(watch, { x: step.x ?? 0, y: step.y ?? 0 }, step.t);
    watch = out.watch;
    if (out.impulse) impulses.push({ t: step.t, ...out.impulse });
  }
  return impulses;
}

describe("sensor recoil", () => {
  it("does not throw on noise or a slow return", () => {
    const noise = play([
      { t: 0, y: 0.2 },
      { t: 40, y: -0.3 },
      { t: 80, y: 0.1 },
      { t: 120, y: 0 },
    ]);
    assert.equal(noise.length, 0);
    const slow: { t: number; y: number }[] = [];
    for (let i = 0; i <= 10; i += 1) slow.push({ t: i * 40, y: Math.min(5, i * 0.5) });
    for (let i = 1; i <= 12; i += 1) slow.push({ t: 400 + i * 80, y: Math.max(0, 5 - i * 0.45) });
    assert.equal(play(slow).length, 0);
    assert.equal(play([{ t: 0, y: 5 }, { t: 40, y: 5 }, { t: 80, y: 5 }]).length, 0);
  });

  it("throws in the return direction and grows with speed", () => {
    const build = [
      { t: 0, y: 4.8 },
      { t: 40, y: 8 },
      { t: 80, y: 10 },
    ];
    const fast = play([...build, { t: 120, y: 0 }]);
    const medium = play([...build, { t: 170, y: 0 }]);
    assert.equal(fast.length, 1);
    assert.ok(fast[0].y < -6, String(fast[0].y));
    assert.equal(fast[0].x, 0);
    assert.equal(medium.length, 1);
    assert.ok(medium[0].y < 0 && medium[0].y > fast[0].y, `${medium[0].y} vs ${fast[0].y}`);
    const again = play([...build, { t: 120, y: 0 }, { t: 160, y: 0 }, { t: 200, y: 0 }]);
    assert.equal(again.length, 1);
  });

  it("overshoots once, swings back once, and keeps a full live tilt", () => {
    assert.ok(SENSOR_RECOIL_MS >= 350 && SENSOR_RECOIL_MS <= 450);
    const frames = sensorRecoilOffsets({ x: 0, y: -10 });
    assert.ok(frames);
    const peak = sensorRecoilOffset(frames, 0.3);
    const back = sensorRecoilOffset(frames, 0.62);
    const end = sensorRecoilOffset(frames, 1);
    assert.ok(peak.y <= -9);
    assert.ok(back.y > 1 && back.y < 5);
    assert.deepEqual(end, { x: 0, y: 0 });
    assert.equal(sensorRecoilAngle({ x: 10, y: -10 }, { x: 0, y: 0 }).x, 10);
    assert.equal(sensorRecoilAngle({ x: 10, y: -10 }, { x: 0, y: 0 }).y, -10);
    assert.equal(sensorRecoilAngle({ x: 10, y: 0 }, { x: 10, y: -10 }).x, 20);
    assert.equal(sensorRecoilAngle({ x: 0, y: 0 }, { x: 30, y: -30 }).x, SENSOR_RECOIL_MAX_DEG);
    assert.equal(sensorRecoilAngle({ x: 0, y: 0 }, { x: 30, y: -30 }).y, -SENSOR_RECOIL_MAX_DEG);
  });

  it("combines a diagonal return and notices a new tilt", () => {
    const diagonal = play([
      { t: 0, x: 6, y: 6 },
      { t: 40, x: 10, y: 10 },
      { t: 80, x: 0, y: 0 },
    ]);
    assert.equal(diagonal.length, 1);
    assert.ok(diagonal[0].x < -5 && diagonal[0].y < -5);
    const vertical = play([
      { t: 0, x: 10, y: 0.4 },
      { t: 40, x: 10, y: 0 },
      { t: 80, x: 0, y: 0 },
    ]);
    assert.equal(vertical.length, 1);
    assert.ok(vertical[0].x < 0);
    assert.equal(vertical[0].y, 0);
    assert.equal(sensorReturnReversed(0.4, -3.2), true);
    assert.equal(sensorReturnReversed(0.4, 0.4), false);
  });
});
