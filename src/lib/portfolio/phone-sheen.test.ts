import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHAKE_MAX_DEG, SHAKE_MAX_PX } from "./device-shake.ts";
import { SENSOR_MAX_DEG } from "./device-tilt.ts";
import { SENSOR_RECOIL_MAX_DEG } from "./sensor-recoil.ts";
import { SHEEN_TRAVEL_X, SHEEN_TRAVEL_Y } from "./lightbox-tilt.ts";
import { PHONE_SHEEN_OPACITY, phoneSheen } from "./phone-sheen.ts";

const still = { x: 0, y: 0, r: 0 };

describe("phone sheen", () => {
  it("follows the same degrees that rotate the picture", () => {
    assert.equal(phoneSheen({ x: 0, y: 0 }, still).opacity, 0);
    const right = phoneSheen({ x: 0, y: SENSOR_MAX_DEG }, still);
    const left = phoneSheen({ x: 0, y: -SENSOR_MAX_DEG }, still);
    assert.equal(right.x, SHEEN_TRAVEL_X);
    assert.equal(left.x, -SHEEN_TRAVEL_X);
    assert.equal(right.y, 0);
    assert.equal(right.opacity, PHONE_SHEEN_OPACITY);
    const topBack = phoneSheen({ x: SENSOR_MAX_DEG, y: 0 }, still);
    const topForward = phoneSheen({ x: -SENSOR_MAX_DEG, y: 0 }, still);
    assert.equal(topBack.y, -SHEEN_TRAVEL_Y);
    assert.equal(topForward.y, SHEEN_TRAVEL_Y);
    assert.ok(topBack.opacity <= PHONE_SHEEN_OPACITY);
  });

  it("keeps moving through a recoil and never passes the opacity cap", () => {
    const full = phoneSheen({ x: 0, y: SENSOR_MAX_DEG }, still);
    const past = phoneSheen({ x: 0, y: SENSOR_MAX_DEG + 4 }, still);
    const limit = phoneSheen({ x: SENSOR_RECOIL_MAX_DEG, y: 0 }, still);
    assert.ok(past.x > full.x);
    assert.equal(past.opacity, PHONE_SHEEN_OPACITY);
    assert.equal(limit.opacity, PHONE_SHEEN_OPACITY);
    assert.ok(limit.y < full.y);
  });

  it("follows shake strength and keeps the tilt light when the shake ends", () => {
    const soft = phoneSheen({ x: 0, y: 0 }, { x: SHAKE_MAX_PX * 0.35, y: 0, r: 0 });
    const hard = phoneSheen({ x: 0, y: 0 }, { x: SHAKE_MAX_PX, y: 0, r: 0 });
    assert.ok(soft.x > 0 && soft.x < hard.x);
    assert.ok(soft.opacity > 0 && soft.opacity < hard.opacity);
    assert.equal(hard.opacity, PHONE_SHEEN_OPACITY);
    const down = phoneSheen({ x: 0, y: 0 }, { x: 0, y: SHAKE_MAX_PX, r: 0 });
    assert.ok(down.y > 0);
    const twist = phoneSheen({ x: 0, y: 0 }, { x: 0, y: 0, r: SHAKE_MAX_DEG });
    assert.ok(twist.turn > 0);
    assert.ok(twist.opacity > 0);
    const tilted = phoneSheen({ x: 0, y: SENSOR_MAX_DEG }, still);
    const both = phoneSheen({ x: 0, y: SENSOR_MAX_DEG }, { x: SHAKE_MAX_PX, y: SHAKE_MAX_PX * 0.5, r: -SHAKE_MAX_DEG });
    assert.ok(both.x > tilted.x);
    assert.ok(both.y > tilted.y);
    assert.ok(both.opacity <= PHONE_SHEEN_OPACITY);
    assert.deepEqual(phoneSheen({ x: 0, y: SENSOR_MAX_DEG }, still), tilted);
  });
});