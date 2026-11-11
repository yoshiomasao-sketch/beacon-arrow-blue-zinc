import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { beginPermissionAsk, bindSensorTarget, onMotion, onOrientation, resetSensorHub, sensorListenerCounts, sensorPermits, sensorWatchHot, tiltButtonText } from "./sensor-hub.ts";

class CountingTarget extends EventTarget {
  adds: string[] = [];
  removes: string[] = [];
  addEventListener(type: string, listener: (event: Event) => void) {
    this.adds.push(type);
    super.addEventListener(type, listener);
  }
  removeEventListener(type: string, listener: (event: Event) => void) {
    this.removes.push(type);
    super.removeEventListener(type, listener);
  }
}

describe("sensor hub", () => {
  afterEach(() => {
    resetSensorHub();
    bindSensorTarget(null);
  });

  it("asks for both sensors in the same turn and does not ask again once granted", async () => {
    const calls: string[] = [];
    const scope = {
      isSecureContext: true,
      DeviceOrientationEvent: {
        requestPermission: () => {
          calls.push("orientation");
          return Promise.resolve("granted");
        },
      },
      DeviceMotionEvent: {
        requestPermission: () => {
          calls.push("motion");
          return Promise.resolve("denied");
        },
      },
    };
    const first = beginPermissionAsk(scope);
    assert.deepEqual(calls, ["orientation", "motion"]);
    const [orientation, motion] = await Promise.all([first.orientation, first.motion]);
    assert.equal(orientation, "granted");
    assert.equal(motion, "denied");
    calls.length = 0;
    const again = beginPermissionAsk({
      ...scope,
      DeviceOrientationEvent: {
        requestPermission: () => {
          calls.push("orientation-again");
          return Promise.resolve("granted");
        },
      },
    });
    await again.orientation;
    await again.motion;
    assert.deepEqual(calls, ["motion"]);
    assert.equal(sensorPermits().orientation, "granted");
    assert.equal(sensorPermits().motion, "denied");
  });

  it("keeps a granted sensor when the other fails, and uses one listener", async () => {
    const target = new CountingTarget();
    bindSensorTarget(target);
    const scope = {
      isSecureContext: true,
      DeviceOrientationEvent: { requestPermission: () => Promise.reject(new Error("no")) },
      DeviceMotionEvent: { requestPermission: () => Promise.resolve("granted") },
    };
    const asked = beginPermissionAsk(scope);
    assert.equal(await asked.orientation, "error");
    assert.equal(await asked.motion, "granted");
    const seen: number[] = [];
    const stopA = onMotion(() => seen.push(1));
    const stopB = onMotion(() => seen.push(2));
    assert.equal(sensorListenerCounts().motion, 1);
    target.dispatchEvent(new Event("devicemotion"));
    assert.deepEqual(seen, [1, 2]);
    stopA();
    assert.equal(sensorListenerCounts().motion, 1);
    stopB();
    assert.equal(sensorListenerCounts().motion, 0);
    assert.deepEqual(target.adds, ["devicemotion"]);
    assert.deepEqual(target.removes, ["devicemotion"]);
    onOrientation(() => undefined);
    assert.equal(sensorListenerCounts().orientation, 0);
  });

  it("names the button from permission and which sensors are running", () => {
    const idle = { orientation: "unknown" as const, motion: "unknown" as const, tilt: false, shake: false };
    assert.equal(tiltButtonText(idle), "未許可");
    assert.equal(tiltButtonText({ ...idle, orientation: "granted", motion: "granted" }), "停止中");
    assert.equal(tiltButtonText({ ...idle, orientation: "granted", motion: "granted", tilt: true }), "傾き動作中");
    assert.equal(tiltButtonText({ ...idle, orientation: "granted", motion: "granted", shake: true }), "シェイク動作中");
    assert.equal(tiltButtonText({ ...idle, orientation: "granted", motion: "granted", tilt: true, shake: true }), "両方動作中");
    assert.equal(tiltButtonText({ ...idle, orientation: "granted", motion: "denied" }), "一部不可");
    assert.equal(tiltButtonText({ ...idle, orientation: "denied", motion: "denied" }), "拒否");
    assert.equal(tiltButtonText({ ...idle, orientation: "unsupported", motion: "unsupported" }), "非対応");
    assert.equal(tiltButtonText({ ...idle, orientation: "error", motion: "error" }), "エラー");
  });

  it("stays hot only while the wanted streams are actually arriving", async () => {
    const target = new CountingTarget();
    bindSensorTarget(target);
    const scope = {
      isSecureContext: true,
      DeviceOrientationEvent: { requestPermission: () => Promise.resolve("granted") },
      DeviceMotionEvent: { requestPermission: () => Promise.resolve("granted") },
    };
    await Promise.all(Object.values(beginPermissionAsk(scope)));
    const stopO = onOrientation(() => undefined);
    const stopM = onMotion(() => undefined);
    const wanted = { tilt: true, shake: true };
    const permits = sensorPermits();
    assert.equal(sensorWatchHot(performance.now(), wanted, permits), false);
    target.dispatchEvent(new Event("deviceorientation"));
    assert.equal(sensorWatchHot(performance.now(), wanted, permits), false);
    target.dispatchEvent(new Event("devicemotion"));
    assert.equal(sensorWatchHot(performance.now(), wanted, permits), true);
    assert.equal(sensorWatchHot(performance.now() + 4000, wanted, permits), false);
    stopO();
    stopM();
    target.dispatchEvent(new Event("deviceorientation"));
    target.dispatchEvent(new Event("devicemotion"));
    onOrientation(() => undefined);
    onMotion(() => undefined);
    assert.equal(sensorWatchHot(performance.now(), wanted, permits), false);
  });
});
