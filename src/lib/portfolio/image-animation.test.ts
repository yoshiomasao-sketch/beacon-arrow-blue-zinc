import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { animationCycle, animationFrame, animationPose, animPhase, buzzWindow, carryForPhase, hitUnit, twistCycle, TWIST_DEG, ULTRA_HIT_CONTACT, zoomOptionCycle, type AnimKind, type AnimSpeed } from "./image-animation.ts";

const frame = { width: 400, height: 700 };
const kinds: AnimKind[] = ["swayX", "hitX", "swayY", "hitY", "orbit", "zoom", "buzz"];
const speeds: AnimSpeed[] = ["slow", "normal", "fast", "rapid", "ultra"];

describe("image animation", () => {
  it("pulls slowly, slams faster, then holds against the wall", () => {
    const cycle = animationCycle("hitX", "normal");
    const at = (phase: number) => animationPose("hitX", "normal", cycle * phase, frame).x;
    assert.ok(at(0) > 0);
    assert.ok(at(0.64) < 0);
    assert.ok(at(0.9) > 0);
    assert.ok(Math.abs(at(0.95) - at(0.9)) < 0.05);
    assert.equal(at(0), at(1));
    const pull = Math.abs(at(0.64) - at(0)) / 0.64;
    const slam = Math.abs(at(0.9) - at(0.64)) / 0.26;
    assert.ok(slam > pull * 1.8);
    const step = 0.08;
    const v1 = at(0.64 + step) - at(0.64);
    const v2 = at(0.64 + step * 2) - at(0.64 + step);
    const v3 = at(0.64 + step * 3) - at(0.64 + step * 2);
    assert.ok(v1 < v2 && v2 < v3);
    let prev = hitUnit(0);
    for (let i = 1; i <= 16; i += 1) {
      const next = hitUnit((0.64 * i) / 16);
      assert.ok(next <= prev + 1e-9);
      prev = next;
    }
  });

  it("keeps the hit contrast at every speed, and shortens the pull", () => {
    for (let i = 1; i < speeds.length; i += 1) {
      assert.ok(animationCycle("hitY", speeds[i]!) < animationCycle("hitY", speeds[i - 1]!));
    }
    for (const speed of speeds) {
      if (speed === "ultra") continue;
      const cycle = animationCycle("hitY", speed);
      const peak = animationPose("hitY", speed, 0, frame).y;
      assert.ok(peak > 0);
      for (const phase of [0, 0.2, 0.64, 0.8, 0.95]) {
        const pose = animationPose("hitY", speed, cycle * phase, frame);
        assert.ok(Math.abs(pose.y / peak - hitUnit(phase)) < 0.02);
        assert.equal(pose.x, 0);
      }
      const at = (phase: number) => animationPose("hitX", speed, cycle * phase, frame).x;
      const pull = Math.abs(at(0.64) - at(0)) / (cycle * 0.64);
      const slam = Math.abs(at(0.9) - at(0.64)) / (cycle * 0.26);
      assert.ok(slam > pull * 1.8);
    }
    const fastPull = animationCycle("hitX", "fast") * 0.64;
    const rapidPull = animationCycle("hitX", "rapid") * 0.64;
    assert.ok(rapidPull < fastPull * 0.7);
    assert.ok(animationCycle("hitX", "ultra") < animationCycle("hitX", "rapid"));
    assert.ok(Math.abs(animationPose("hitX", "ultra", 0, frame).x) > Math.abs(animationPose("hitX", "fast", 0, frame).x));
  });

  it("speeds orbit and zoom up harder than a shared ratio", () => {
    const ratio = (kind: AnimKind) => animationCycle(kind, "ultra") / animationCycle(kind, "fast");
    assert.ok(ratio("orbit") < ratio("swayX"));
    assert.ok(Math.abs(ratio("zoom") - 0.13 / 0.55) < 1e-9);
    assert.ok(animationCycle("orbit", "ultra") < animationCycle("orbit", "rapid"));
    assert.ok(animationCycle("zoom", "rapid") < animationCycle("zoom", "fast"));
  });

  it("loops sway, orbit, and zoom without a jump", () => {
    for (const kind of ["swayX", "swayY", "orbit", "zoom"] as const) {
      const cycle = animationCycle(kind, "normal");
      const start = animationPose(kind, "normal", 0, frame);
      const end = animationPose(kind, "normal", cycle, frame);
      assert.ok(Math.abs(start.x - end.x) < 0.01);
      assert.ok(Math.abs(start.y - end.y) < 0.01);
      assert.ok(Math.abs(start.scale - end.scale) < 0.001);
    }
    const sway = animationPose("swayX", "normal", animationCycle("swayX", "normal") * 0.25, frame);
    assert.ok(Math.abs(sway.x) > 4);
    assert.equal(sway.y, 0);
    const orbit = animationPose("orbit", "normal", animationCycle("orbit", "normal") * 0.25, frame);
    assert.ok(Math.abs(orbit.x) < 1);
    assert.ok(orbit.y > 4);
    const near = animationPose("zoom", "normal", 0, frame);
    const far = animationPose("zoom", "normal", animationCycle("zoom", "normal") * 0.5, frame);
    assert.ok(Math.abs(near.scale - 1) < 0.001);
    assert.ok(far.scale > near.scale + 0.08);
    assert.equal(far.x, 0);
    assert.equal(far.y, 0);
    for (const kind of ["swayX", "swayY", "hitX", "hitY", "orbit"] as const) {
      const cycle = animationCycle(kind, "ultra");
      const startUltra = animationPose(kind, "ultra", 0, frame);
      const endUltra = animationPose(kind, "ultra", cycle, frame);
      assert.ok(Math.abs(startUltra.x - endUltra.x) < 0.01);
      assert.ok(Math.abs(startUltra.y - endUltra.y) < 0.01);
    }
  });

  it("steps sway, hit, and orbit up one speed and keeps the old swing size", () => {
    assert.equal(animationCycle("swayX", "slow"), 3400);
    assert.equal(animationCycle("swayX", "normal"), 3400 * 0.58);
    assert.equal(animationCycle("swayX", "fast"), 3400 * 0.34);
    assert.equal(animationCycle("swayX", "rapid"), 3400 * 0.2);
    assert.equal(animationCycle("swayX", "ultra"), 3400 * 0.08);
    assert.ok(animationCycle("swayX", "ultra") < animationCycle("swayX", "rapid"));
    assert.ok(animationCycle("swayX", "ultra") > animationCycle("swayX", "rapid") * 0.3);
    assert.equal(animationCycle("swayY", "slow"), animationCycle("swayX", "slow"));
    assert.equal(animationCycle("hitX", "slow"), 2800);
    assert.equal(animationCycle("hitX", "rapid"), 2800 * 0.2);
    assert.equal(animationCycle("hitX", "ultra"), 72 + 44 + 84 + 192);
    assert.equal(animationCycle("hitY", "ultra"), animationCycle("hitX", "ultra"));
    assert.equal(animationCycle("orbit", "slow"), 7600);
    assert.equal(animationCycle("orbit", "rapid"), 7600 * 0.075);
    assert.ok(Math.abs(animationCycle("orbit", "ultra") - 7600 * 0.029032258) < 0.05);
    const amp = (kind: "swayX" | "orbit", speed: AnimSpeed) => {
      const cycle = animationCycle(kind, speed);
      const pose = animationPose(kind, speed, cycle * 0.25, frame);
      return kind === "swayX" ? Math.abs(pose.x) : Math.abs(pose.y);
    };
    assert.ok(Math.abs(amp("swayX", "slow") - 400 * 0.042) < 0.05);
    assert.ok(Math.abs(amp("swayX", "ultra") - amp("swayX", "rapid")) < 0.05);
    assert.ok(Math.abs(amp("orbit", "ultra") - amp("orbit", "rapid")) < 0.05);
    assert.equal(animationCycle("zoom", "slow"), 5200 * 1.65);
    assert.equal(animationCycle("zoom", "normal"), 5200);
    assert.equal(animationCycle("zoom", "ultra"), 5200 * 0.13);
    assert.equal(animationCycle("buzz", "slow"), 1700 + 360);
    assert.equal(animationCycle("buzz", "ultra"), 130 + 110);
  });

  it("reverses direction without changing the speed or the buzz timing", () => {
    const swayCycle = animationCycle("swayX", "fast");
    const sway = animationPose("swayX", "fast", swayCycle * 0.25, frame);
    const swayBack = animationPose("swayX", "fast", swayCycle * 0.25, frame, true);
    assert.ok(sway.x > 0 && swayBack.x < 0);
    assert.ok(Math.abs(sway.x + swayBack.x) < 0.01);

    const hit = animationPose("hitX", "ultra", 0, frame);
    const hitBack = animationPose("hitX", "ultra", 0, frame, true);
    assert.ok(hit.x > 0 && hitBack.x < 0);

    const hitDown = animationPose("hitY", "normal", 0, frame);
    const hitUp = animationPose("hitY", "normal", 0, frame, true);
    assert.ok(hitDown.y > 0 && hitUp.y < 0);

    const orbitCycle = animationCycle("orbit", "normal");
    const clockwise = animationPose("orbit", "normal", orbitCycle * 0.25, frame);
    const counter = animationPose("orbit", "normal", orbitCycle * 0.25, frame, true);
    assert.ok(clockwise.y > 0 && counter.y < 0);
    assert.ok(Math.abs(clockwise.x) < 1 && Math.abs(counter.x) < 1);

    const zoomCycle = animationCycle("zoom", "rapid");
    const zoomIn = animationPose("zoom", "rapid", 0, frame);
    const zoomOut = animationPose("zoom", "rapid", 0, frame, true);
    const zoomInMid = animationPose("zoom", "rapid", zoomCycle * 0.5, frame);
    const zoomOutMid = animationPose("zoom", "rapid", zoomCycle * 0.5, frame, true);
    assert.ok(zoomIn.scale < zoomInMid.scale);
    assert.ok(zoomOut.scale > zoomOutMid.scale);

    const still = buzzWindow("ultra").still;
    const buzzing = animationPose("buzz", "ultra", still + 20, frame);
    const buzzingBack = animationPose("buzz", "ultra", still + 20, frame, true);
    assert.ok(Math.abs(buzzing.x + buzzingBack.x) < 0.01);
    assert.ok(Math.abs(buzzing.y - buzzingBack.y) < 0.01);
    assert.ok(Math.abs(animationPose("buzz", "ultra", still / 2, frame, true).x) < 0.05);
    assert.equal(animationCycle("buzz", "ultra"), animationCycle("buzz", "ultra"));
  });

  it("rings against the wall only on the ultra hit", () => {
    const { pull, slam, stop, buzz } = ULTRA_HIT_CONTACT;
    const cycle = pull + slam + stop + buzz;
    const stopEnd = pull + slam + stop;
    const at = (ms: number, reverse = false) => animationPose("hitX", "ultra", ms, frame, reverse);
    const wall = at(0).x;
    assert.ok(wall > 0);
    assert.equal(at(0).y, 0);
    assert.ok(pull + slam < animationCycle("hitX", "rapid") * 0.3);

    const cocked = at(pull).x;
    assert.ok(Math.abs(cocked + wall) < 0.05);
    let prev = wall;
    for (let ms = 4; ms <= pull; ms += 4) {
      const x = at(ms).x;
      assert.ok(x <= prev + 1e-6);
      prev = x;
    }

    const slamAt = (u: number) => at(pull + slam * u).x;
    const d1 = slamAt(0.25) - slamAt(0);
    const d2 = slamAt(0.5) - slamAt(0.25);
    const d3 = slamAt(0.75) - slamAt(0.5);
    const d4 = slamAt(1) - slamAt(0.75);
    assert.ok(d1 < d2 && d2 < d3 && d3 < d4);
    assert.ok(Math.abs(slamAt(1) - wall) < 0.05);

    for (const ms of [1, 20, 40, 60, stop - 1]) {
      const pose = at(pull + slam + ms);
      assert.ok(Math.abs(pose.x - wall) < 0.001);
      assert.equal(pose.y, 0);
    }

    let early = 0;
    let late = 0;
    let sawPos = false;
    let sawNeg = false;
    for (let ms = 0; ms < buzz; ms += 4) {
      const pose = at(stopEnd + ms);
      const delta = pose.x - wall;
      assert.ok(Math.abs(delta) < wall * 0.25);
      assert.ok(Math.abs(pose.y) < wall * 0.12);
      assert.ok(pose.x > wall * 0.5);
      const mag = Math.hypot(delta, pose.y);
      if (ms < buzz * 0.35) early = Math.max(early, mag);
      if (ms > buzz * 0.75) late = Math.max(late, mag);
      if (delta > 0.4) sawPos = true;
      if (delta < -0.4) sawNeg = true;
    }
    assert.ok(sawPos && sawNeg);
    assert.ok(early > 2);
    assert.ok(early > late * 2);
    assert.ok(Math.abs(at(cycle - 1).x - wall) < wall * 0.05);
    assert.ok(Math.abs(at(cycle).x - wall) < 0.01);
    assert.ok(Math.abs(at(cycle).y) < 0.01);

    for (let ms = 0; ms <= cycle; ms += 8) {
      const fore = at(ms);
      const back = at(ms, true);
      assert.ok(Math.abs(fore.x + back.x) < 0.02);
      assert.ok(Math.abs(fore.y + back.y) < 0.02);
    }

    const down = animationPose("hitY", "ultra", pull + slam + 10, frame);
    const up = animationPose("hitY", "ultra", pull + slam + 10, frame, true);
    assert.ok(down.y > 0 && up.y < 0 && down.x === 0 && up.x === 0);
    const ring = animationPose("hitY", "ultra", stopEnd, frame);
    const ringUp = animationPose("hitY", "ultra", stopEnd, frame, true);
    assert.ok(ring.y > down.y);
    assert.ok(ringUp.y < up.y);
    assert.ok(Math.abs(ring.x) > 0.2);
    assert.ok(Math.abs(ring.y + ringUp.y) < 0.02);

    for (const speed of ["slow", "normal", "fast", "rapid"] as const) {
      const hold = animationCycle("hitX", speed);
      const a = animationPose("hitX", speed, hold * 0.92, frame);
      const b = animationPose("hitX", speed, hold * 0.97, frame);
      assert.ok(Math.abs(a.x - b.x) < 0.05);
      assert.equal(a.y, 0);
      assert.equal(b.y, 0);
      assert.equal(animationPose("hitY", speed, hold * 0.95, frame).x, 0);
    }

    const sway = animationPose("swayX", "ultra", animationCycle("swayX", "ultra") * 0.25, frame);
    assert.equal(sway.y, 0);
    assert.equal(animationCycle("swayX", "ultra"), 3400 * 0.08);
  });

  it("rests, then buzzes, and gets harsher without using one shared ratio", () => {
    for (let i = 1; i < speeds.length; i += 1) {
      const prev = buzzWindow(speeds[i - 1]!);
      const next = buzzWindow(speeds[i]!);
      assert.ok(next.still < prev.still);
      assert.ok(next.buzz < prev.buzz);
    }
    const fast = buzzWindow("fast");
    const ultra = buzzWindow("ultra");
    assert.ok(ultra.still / fast.still < ultra.buzz / fast.buzz);
    const resting = animationPose("buzz", "normal", buzzWindow("normal").still / 2, frame);
    assert.ok(Math.abs(resting.x) < 0.05 && Math.abs(resting.y) < 0.05);
    const shaking = animationPose("buzz", "normal", buzzWindow("normal").still + 40, frame);
    assert.ok(Math.hypot(shaking.x, shaking.y) > 0.4);
    let normalPeak = 0;
    let ultraPeak = 0;
    for (let i = 0; i < 40; i += 1) {
      normalPeak = Math.max(normalPeak, Math.abs(animationPose("buzz", "normal", buzzWindow("normal").still + i * 8, frame).x));
      ultraPeak = Math.max(ultraPeak, Math.abs(animationPose("buzz", "ultra", buzzWindow("ultra").still + i * 4, frame).x));
    }
    assert.ok(ultraPeak > normalPeak);
  });

  it("stacks zoom, twist, and a 45 degree tilt without replacing the base move", () => {
    const frame = { width: 400, height: 700 };
    const root = Math.SQRT1_2;
    for (const kind of ["swayX", "hitX", "swayY", "hitY", "orbit", "buzz"] as const) {
      for (const speed of speeds) {
        const cycle = animationCycle(kind, speed);
        const pose = animationPose(kind, speed, cycle * 0.3, frame, true);
        const stacked = animationFrame(kind, speed, cycle * 0.3, frame, true);
        assert.ok(Math.abs(stacked.x - pose.x) < 0.001);
        assert.ok(Math.abs(stacked.y - pose.y) < 0.001);
        assert.ok(Math.abs(stacked.scale - pose.scale) < 0.001);
        assert.equal(stacked.rotate, 0);
      }
    }

    const swayCycle = animationCycle("swayX", "normal");
    const at = swayCycle * 0.25;
    const sway = animationPose("swayX", "normal", at, frame);
    const zoomOnly = animationFrame(null, "normal", at, frame, false, { zoom: true });
    const both = animationFrame("swayX", "normal", at, frame, false, { zoom: true });
    assert.ok(Math.abs(both.x - sway.x) < 0.001);
    assert.equal(both.y, 0);
    assert.ok(Math.abs(both.scale - sway.scale * zoomOnly.scale) < 0.001);
    const fixedZoom = zoomOptionCycle();
    assert.equal(fixedZoom, animationCycle("zoom", "fast") * 2);
    const oldFastPeak = 1 + 0.12 * 1.05;
    const alone = animationFrame(null, "ultra", fixedZoom * 0.5, frame, false, { zoom: true });
    const zoomNear = animationFrame(null, "slow", 0, frame, false, { zoom: true });
    assert.equal(alone.x, 0);
    assert.equal(alone.y, 0);
    assert.ok(Math.abs(zoomNear.scale - 1) < 0.001);
    assert.ok(Math.abs(alone.scale - 1.28) < 0.001);
    assert.ok(alone.scale > oldFastPeak + 0.1);
    let previous = zoomNear.scale;
    for (let i = 1; i <= 8; i += 1) {
      const scale = animationFrame(null, "rapid", (fixedZoom * i) / 16, frame, false, { zoom: true }).scale;
      assert.ok(scale > previous);
      previous = scale;
    }
    const zoomBack = animationFrame(null, "slow", 0, frame, true, { zoom: true });
    assert.ok(zoomBack.scale > animationFrame(null, "slow", fixedZoom * 0.5, frame, true, { zoom: true }).scale);
    for (const speed of ["slow", "ultra"] as const) {
      const layered = animationFrame("hitY", speed, fixedZoom * 0.5, frame, false, { zoom: true });
      const base = animationPose("hitY", speed, fixedZoom * 0.5, frame);
      assert.ok(Math.abs(layered.scale - base.scale * alone.scale) < 0.001);
      assert.ok(Math.abs(layered.y - base.y) < 0.001);
    }

    const twist = twistCycle();
    assert.equal(twist, 12800);
    assert.equal(TWIST_DEG, 15);
    assert.equal(animationFrame("orbit", "ultra", 0, frame, false, { twist: true }).rotate, 0);
    for (const speed of speeds) {
      assert.ok(Math.abs(animationFrame(null, speed, twist * 0.25, frame, false, { twist: true }).rotate - TWIST_DEG) < 0.001);
      assert.ok(Math.abs(animationFrame("buzz", speed, twist * 0.75, frame, false, { twist: true }).rotate + TWIST_DEG) < 0.001);
    }
    assert.ok(Math.abs(animationFrame(null, "rapid", twist * 0.25, frame, true, { twist: true }).rotate + TWIST_DEG) < 0.001);
    assert.ok(Math.abs(animationFrame("hitY", "fast", twist * 0.5, frame, false, { twist: true }).rotate) < 0.001);

    const right = animationFrame("swayX", "normal", swayCycle * 0.25, frame, false, { tilt: "right" });
    const left = animationFrame("swayX", "normal", swayCycle * 0.25, frame, false, { tilt: "left" });
    assert.ok(right.x > 0 && right.y > 0);
    assert.ok(Math.abs(right.x - sway.x * root) < 0.05 && Math.abs(right.y - sway.x * root) < 0.05);
    assert.ok(Math.abs(left.x - right.x) < 0.05 && Math.abs(left.y + right.y) < 0.05);
    const slowTilt = animationFrame("swayX", "slow", animationCycle("swayX", "slow") * 0.25, frame, false, { tilt: "right" });
    const ultraTilt = animationFrame("swayX", "ultra", animationCycle("swayX", "ultra") * 0.25, frame, false, { tilt: "right" });
    assert.ok(Math.abs(slowTilt.x - slowTilt.y) < 0.05 && Math.abs(ultraTilt.x - ultraTilt.y) < 0.05);
    assert.ok(ultraTilt.x > slowTilt.x);
    assert.ok(animationCycle("swayX", "ultra") < animationCycle("swayX", "slow"));
    const down = animationPose("swayY", "normal", swayCycle * 0.25, frame);
    const downRight = animationFrame("swayY", "normal", swayCycle * 0.25, frame, false, { tilt: "right" });
    assert.ok(downRight.x < 0 && downRight.y > 0);
    assert.ok(Math.abs(downRight.x + down.y * root) < 0.05);
    assert.ok(Math.abs(downRight.y - down.y * root) < 0.05);

    const orbitAt = animationCycle("orbit", "normal") * 0.3;
    const orbit = animationFrame("orbit", "normal", orbitAt, frame, false, { tilt: "right", zoom: true, twist: true });
    const orbitPlain = animationPose("orbit", "normal", orbitAt, frame);
    assert.ok(Math.abs(orbit.x - orbitPlain.x) < 0.001);
    assert.ok(Math.abs(orbit.y - orbitPlain.y) < 0.001);
    const buzzAt = buzzWindow("normal").still + 30;
    const buzz = animationFrame("buzz", "normal", buzzAt, frame, false, { tilt: "left" });
    const buzzPlain = animationPose("buzz", "normal", buzzAt, frame);
    assert.ok(Math.abs(buzz.x - buzzPlain.x) < 0.001);
    assert.ok(Math.abs(buzz.y - buzzPlain.y) < 0.001);

    const { pull, slam, stop } = ULTRA_HIT_CONTACT;
    const held = pull + slam + stop / 2;
    const ringing = pull + slam + stop;
    const wall = animationFrame("hitX", "ultra", held, frame);
    const wallRight = animationFrame("hitX", "ultra", held, frame, false, { tilt: "right" });
    const ring = animationFrame("hitX", "ultra", ringing, frame);
    const ringRight = animationFrame("hitX", "ultra", ringing, frame, false, { tilt: "right" });
    assert.ok(wall.x > 0 && Math.abs(wall.y) < 0.001);
    assert.ok(Math.abs(wallRight.x - wall.x * root) < 0.05 && Math.abs(wallRight.y - wall.x * root) < 0.05);
    assert.ok(Math.abs(ringRight.x - (ring.x - ring.y) * root) < 0.05);
    assert.ok(Math.abs(ringRight.y - (ring.x + ring.y) * root) < 0.05);
    assert.ok(Math.hypot(ringRight.x - wallRight.x, ringRight.y - wallRight.y) < wall.x * 0.25);
    const back = animationFrame("hitY", "ultra", held, frame, true, { tilt: "left" });
    const fore = animationFrame("hitY", "ultra", held, frame, false, { tilt: "left" });
    assert.ok(fore.y > 0 && back.y < 0);
    assert.ok(Math.abs(fore.x + back.x) < 0.05 && Math.abs(fore.y + back.y) < 0.05);

    const mixed = animationFrame("swayX", "fast", twist * 0.25, frame, true, { zoom: true, twist: true, tilt: "left" });
    assert.ok(Math.abs(mixed.rotate + TWIST_DEG) < 0.001);
    assert.ok(mixed.scale > 1);
    assert.ok(Math.hypot(mixed.x, mixed.y) > 1);
    const cleared = animationFrame("swayX", "fast", twist * 0.25, frame, true);
    assert.equal(cleared.rotate, 0);
    assert.ok(Math.abs(cleared.y) < 0.001);

    const elapsed = 800;
    const phase = animPhase(elapsed, swayCycle, 0.2);
    assert.ok(Math.abs(animPhase(0, animationCycle("swayX", "rapid"), phase) - phase) < 1e-9);
    assert.ok(Math.abs(carryForPhase(elapsed, swayCycle, 0) + elapsed / swayCycle) < 1e-9);
    assert.equal(animationFrame(null, "normal", 0, frame).x, 0);
    assert.equal(animationFrame(null, "normal", 0, frame).rotate, 0);
    assert.equal(animationFrame(null, "normal", 0, frame, false, { tilt: "right" }).x, 0);
  });

  it("changes only the zoom or twist clock when that pace changes", () => {
    const frame = { width: 800, height: 600 };
    const normalZoom = zoomOptionCycle();
    const normalTwist = twistCycle();
    assert.equal(normalZoom, animationCycle("zoom", "fast") * 2);
    assert.equal(normalTwist, 12800);
    assert.equal(zoomOptionCycle("slow"), normalZoom * 2);
    assert.equal(zoomOptionCycle("fast"), normalZoom * 0.5);
    assert.equal(twistCycle("slow"), normalTwist * 2);
    assert.equal(twistCycle("fast"), normalTwist * 0.5);
    const elapsed = zoomOptionCycle("fast") * 0.5;
    const fastZoom = animationFrame(null, "slow", elapsed, frame, false, { zoom: true, zoomPace: "fast" });
    const slowZoom = animationFrame(null, "ultra", elapsed, frame, false, { zoom: true, zoomPace: "slow" });
    const plain = animationFrame("swayX", "ultra", elapsed, frame, false, { zoomPace: "fast" });
    assert.ok(fastZoom.scale > slowZoom.scale);
    assert.equal(fastZoom.x, 0);
    assert.equal(slowZoom.rotate, 0);
    assert.equal(plain.scale, animationPose("swayX", "ultra", elapsed, frame).scale);
    const twistAt = twistCycle("fast") * 0.25;
    const fastTwist = animationFrame(null, "rapid", twistAt, frame, false, { twist: true, twistPace: "fast", zoomPace: "slow" });
    const slowTwist = animationFrame(null, "rapid", twistAt, frame, false, { twist: true, twistPace: "slow", zoom: true, zoomPace: "fast" });
    assert.ok(Math.abs(fastTwist.rotate - TWIST_DEG) < 0.001);
    assert.equal(fastTwist.scale, 1);
    assert.ok(Math.abs(slowTwist.rotate) < TWIST_DEG * 0.4);
    assert.ok(slowTwist.scale > 1);
    const peak = animationFrame(null, "normal", twistCycle("normal") * 0.25, frame, false, { twist: true, twistPace: "normal" });
    assert.ok(Math.abs(peak.rotate - TWIST_DEG) < 0.001);
  });

  it("stays inside the picture even at the fastest step", () => {
    for (const kind of kinds) {
      for (const speed of speeds) {
        const cycle = animationCycle(kind, speed);
        for (let i = 0; i <= 20; i += 1) {
          for (const reverse of [false, true]) {
            const pose = animationPose(kind, speed, (cycle * i) / 20, frame, reverse);
            assert.ok(pose.scale >= 1 && pose.scale <= 1.22);
            assert.ok(Math.abs(pose.x) <= frame.width * 0.09);
            assert.ok(Math.abs(pose.y) <= frame.height * 0.09);
          }
        }
      }
    }
  });
});
