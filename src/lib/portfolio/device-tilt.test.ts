import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SENSOR_DEADZONE_DEG,
  SENSOR_MAX_DEG,
  SENSOR_RANGE_DEG,
  poseFromReading,
  requestSensorPermission,
  sensorSupport,
  sensorWriteAllowed,
  smoothTilt,
  tiltFromPose,
  wrap180,
} from "./device-tilt.ts";

describe("device tilt", () => {
  it("uses the start pose as zero and caps each axis at 10 degrees, opposite the phone", () => {
    assert.equal(SENSOR_MAX_DEG, 10);
    const base = { beta: 50, gamma: 4 };
    assert.deepEqual(tiltFromPose(base, base), { x: 0, y: 0 });
    const right = tiltFromPose({ beta: 50, gamma: 4 + SENSOR_RANGE_DEG }, base);
    assert.equal(right.y, -10);
    assert.equal(right.x, 0);
    const left = tiltFromPose({ beta: 50, gamma: 4 - SENSOR_RANGE_DEG }, base);
    assert.equal(left.y, 10);
    const away = tiltFromPose({ beta: 50 + SENSOR_RANGE_DEG, gamma: 4 }, base);
    assert.equal(away.x, 10);
    const toward = tiltFromPose({ beta: 50 - SENSOR_RANGE_DEG, gamma: 4 }, base);
    assert.equal(toward.x, -10);
    const past = tiltFromPose({ beta: 50 - SENSOR_RANGE_DEG * 3, gamma: 4 - SENSOR_RANGE_DEG * 4 }, base);
    assert.equal(past.x, -10);
    assert.equal(past.y, 10);
  });

  it("ignores a small wobble and follows both axes", () => {
    const base = { beta: 40, gamma: 0 };
    const still = tiltFromPose({ beta: 40 + SENSOR_DEADZONE_DEG * 0.5, gamma: SENSOR_DEADZONE_DEG * 0.4 }, base);
    assert.deepEqual(still, { x: 0, y: 0 });
    const diagonal = tiltFromPose({ beta: 40 + 12, gamma: -12 }, base);
    assert.ok(diagonal.x > 0 && diagonal.x < 10);
    assert.ok(diagonal.y > 0 && diagonal.y < 10);
  });

  it("wraps a baseline near the edge", () => {
    assert.ok(Math.abs(wrap180(190) - -170) < 1e-9);
    const tilt = tiltFromPose({ beta: -170, gamma: 0 }, { beta: 170, gamma: 0 });
    assert.ok(tilt.x > 0 && tilt.x < 10, String(tilt.x));
  });

  it("eases toward the target without passing it", () => {
    const once = smoothTilt({ x: 0, y: 0 }, { x: 0, y: 5 }, 0.5);
    assert.ok(once.y > 0 && once.y < 5);
    const done = smoothTilt({ x: 0.02, y: 4.98 }, { x: 0, y: 5 });
    assert.equal(done.y, 5);
    assert.equal(done.x, 0);
  });

  it("drops empty readings and reports support without throwing", async () => {
    assert.equal(poseFromReading(null, 10), null);
    assert.equal(poseFromReading(10, Number.NaN), null);
    assert.deepEqual(poseFromReading(10, -3), { beta: 10, gamma: -3 });
    assert.equal(sensorSupport(null), "missing");
    assert.equal(sensorSupport({ isSecureContext: false, DeviceOrientationEvent: function DeviceOrientationEvent() {} }), "insecure");
    assert.equal(sensorSupport({ isSecureContext: true, DeviceOrientationEvent: function DeviceOrientationEvent() {} }), "ok");
    assert.equal(await requestSensorPermission(undefined), "granted");
    assert.equal(await requestSensorPermission({ requestPermission: async () => "denied" }), "denied");
    assert.equal(
      await requestSensorPermission({
        requestPermission: async () => {
          throw new Error("blocked");
        },
      }),
      "denied",
    );
  });

  it("stays quiet while a finger is on the picture", () => {
    assert.equal(sensorWriteAllowed("idle", { tilting: false, settling: false, recoiling: false }), true);
    assert.equal(sensorWriteAllowed("pan", { tilting: false, settling: false, recoiling: false }), false);
    assert.equal(sensorWriteAllowed("pinch", { tilting: false, settling: false, recoiling: false }), false);
    assert.equal(sensorWriteAllowed("swipe", { tilting: false, settling: false, recoiling: false }), false);
    assert.equal(sensorWriteAllowed("idle", { tilting: true, settling: false, recoiling: false }), false);
    assert.equal(sensorWriteAllowed("idle", { tilting: false, settling: true, recoiling: false }), false);
  });
});
