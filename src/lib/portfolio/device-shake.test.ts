import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SHAKE_MAX_DEG,
  SHAKE_MAX_PX,
  SHAKE_REST,
  SHAKE_SAMPLE,
  SHAKE_THRESHOLD,
  considerShake,
  decayShake,
  impulseFromPower,
  motionSupport,
  readAccel,
  requestMotionPermission,
  shakePaintAllowed,
  shakePower,
} from "./device-shake.ts";

describe("device shake", () => {
  it("ignores gravity, a slow tilt, and the first sample", () => {
    const still = readAccel(null, { x: 0, y: 0, z: 9.8 });
    assert.ok(still);
    const first = considerShake(SHAKE_SAMPLE, still, 1000);
    assert.equal(first.delta, 0);
    const tilt = considerShake(first.next, { accel: { x: 0.4, y: 0.2, z: 9.7 }, gravity: true }, 1032);
    assert.ok(tilt.delta < SHAKE_THRESHOLD);
    assert.equal(shakePower(tilt.delta), 0);
  });

  it("treats a sudden change as a shake and caps the wobble", () => {
    const base = considerShake(SHAKE_SAMPLE, { accel: { x: 0, y: 0, z: 0 }, gravity: false }, 0);
    const light = considerShake(base.next, { accel: { x: 18, y: 0, z: 0 }, gravity: false }, 32);
    const soft = shakePower(light.delta);
    assert.ok(soft > 0 && soft < 1, String(soft));
    const hard = considerShake(base.next, { accel: { x: 80, y: 0, z: 0 }, gravity: false }, 32);
    assert.equal(shakePower(hard.delta), 1);
    const pose = impulseFromPower(1, false);
    assert.equal(pose.x, SHAKE_MAX_PX);
    assert.ok(Math.abs(pose.y) < SHAKE_MAX_PX);
    assert.equal(Math.abs(pose.r), SHAKE_MAX_DEG);
    const other = impulseFromPower(soft, true);
    assert.ok(Math.abs(other.x) < Math.abs(pose.x));
    assert.ok(other.x < 0);
  });

  it("does not turn a pause or a sensor switch into a shake", () => {
    const held = considerShake(SHAKE_SAMPLE, { accel: { x: 0, y: 0, z: 9.8 }, gravity: true }, 1000);
    const afterPause = considerShake(held.next, { accel: { x: 40, y: 0, z: 9.8 }, gravity: true }, 1000 + 400);
    assert.equal(afterPause.delta, 0);
    const switched = considerShake(held.next, { accel: { x: 30, y: 0, z: 0 }, gravity: false }, 1032);
    assert.equal(switched.delta, 0);
    assert.equal(readAccel(null, null), null);
  });

  it("settles quickly and then stops", () => {
    let pose = impulseFromPower(1, false);
    for (let i = 0; i < 8; i += 1) pose = decayShake(pose, 16);
    assert.ok(Math.abs(pose.x) < SHAKE_MAX_PX * 0.4);
    for (let i = 0; i < 30; i += 1) pose = decayShake(pose, 16);
    assert.deepEqual(pose, SHAKE_REST);
  });

  it("reports support without throwing and stays quiet while dragging", async () => {
    assert.equal(motionSupport(null), "missing");
    assert.equal(motionSupport({ isSecureContext: false, DeviceMotionEvent: function DeviceMotionEvent() {} }), "insecure");
    assert.equal(await requestMotionPermission(undefined), "granted");
    assert.equal(await requestMotionPermission({ requestPermission: async () => "denied" }), "denied");
    assert.equal(
      await requestMotionPermission({
        requestPermission: async () => {
          throw new Error("blocked");
        },
      }),
      "denied",
    );
    assert.equal(shakePaintAllowed("idle", { tilting: false, settling: false, recoiling: false }), true);
    assert.equal(shakePaintAllowed("pan", { tilting: false, settling: false, recoiling: false }), false);
    assert.equal(shakePaintAllowed("pinch", { tilting: false, settling: false, recoiling: false }), false);
    assert.equal(shakePaintAllowed("idle", { tilting: true, settling: false, recoiling: false }), false);
  });
});
