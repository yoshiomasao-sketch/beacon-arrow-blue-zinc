import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { effectCycle, effectPhase, normalizeEffectMarkers } from "./effect-marker.ts";
import { GOLD_PIN_U, goldFlex, goldShift, goldVertex } from "./gold-arc.ts";

describe("gold arc", () => {
  it("pins the right nozzle and bends the stream away from it", () => {
    assert.equal(goldFlex(GOLD_PIN_U), 0);
    assert.equal(goldFlex(0.99), 0);
    assert.equal(goldFlex(0.4), 1);
    const root = goldShift(GOLD_PIN_U, 0.37, 0.25);
    const past = goldShift(0.99, 0.4, 0.75);
    assert.equal(root.dx, 0);
    assert.equal(root.dy, 0);
    assert.equal(past.dx, 0);
    assert.equal(past.dy, 0);
    const up = goldShift(0.45, 0.4, 0.25);
    const down = goldShift(0.45, 0.4, 0.75);
    assert.ok(up.dy < -0.08);
    assert.ok(down.dy > 0.05);
    const apex = goldShift(0.62, 0.19, 0.25);
    const near = goldShift(0.9, 0.33, 0.25);
    assert.ok(apex.dy < near.dy);
    assert.ok(near.dy < 0);
  });

  it("meets itself at the loop seam, so the stream does not pop", () => {
    for (const u of [0.2, 0.55, 0.9, 0.99]) {
      const rest = goldShift(u, 0.4, 0);
      const seam = goldShift(u, 0.4, 1);
      assert.ok(Math.abs(rest.dx) < 1e-9 && Math.abs(rest.dy) < 1e-9);
      assert.ok(Math.abs(seam.dx - rest.dx) < 1e-9 && Math.abs(seam.dy - rest.dy) < 1e-9);
    }
    const steps = 32;
    let previous = goldShift(0.5, 0.35, 0).dy;
    let jump = 0;
    for (let i = 1; i <= steps; i += 1) {
      const dy = goldShift(0.5, 0.35, i / steps).dy;
      jump = Math.max(jump, Math.abs(dy - previous));
      previous = dy;
    }
    assert.ok(jump < 0.08);
  });

  it("shivers along the stream and leaves the nozzle still", () => {
    const left = goldShift(0.3, 0.45, 0.08);
    const mid = goldShift(0.62, 0.45, 0.08);
    assert.ok(Math.abs(left.dy - mid.dy) > 1e-4);
    assert.ok(Math.abs(goldShift(0.98, 0.4, 0.08).dx) < 1e-12);
    assert.ok(Math.abs(goldShift(0.98, 0.4, 0.08).dy) < 1e-12);
    const still = goldShift(0.5, 0.45, 0);
    assert.ok(Math.abs(still.dx) < 1e-9 && Math.abs(still.dy) < 1e-9);
    const pinned = goldVertex(23, 4, 0.25);
    const pinnedRest = goldVertex(23, 4, 0);
    assert.equal(pinned.x, pinnedRest.x);
    assert.equal(pinned.y, pinnedRest.y);
    const body = goldVertex(12, 4, 0.25);
    const bodyRest = goldVertex(12, 4, 0);
    assert.ok(body.y !== bodyRest.y);
  });

  it("locks height, sway, and shiver to one phase at every pace", () => {
    for (const pace of ["slow", "normal", "fast"] as const) {
      const cycle = effectCycle(pace);
      assert.equal(effectPhase(pace, cycle * 0.25, false), 0.25);
      assert.equal(effectPhase(pace, 0, true), 0.5);
      assert.equal(effectPhase(pace, cycle / 2, false), effectPhase(pace, 0, true));
    }
    const slow = goldShift(0.5, 0.4, effectPhase("slow", effectCycle("slow") * 0.25));
    const fast = goldShift(0.5, 0.4, effectPhase("fast", effectCycle("fast") * 0.25));
    assert.equal(slow.dx, fast.dx);
    assert.equal(slow.dy, fast.dy);
    const ahead = goldShift(0.5, 0.4, effectPhase("fast", 0, true));
    const half = goldShift(0.5, 0.4, effectPhase("fast", effectCycle("fast") / 2, false));
    assert.equal(ahead.dy, half.dy);
  });

  it("restores gold on splash_03 and reads an older splash_02 marker as the new sheet", () => {
    const markers = normalizeEffectMarkers({
      markers: [
        { id: 1, kind: "gold", asset: "splash_02", pace: "fast", u: 0.4, v: 0.5, size: 0.3, angle: 0.2, backbeat: true },
        { id: 2, kind: "gold", asset: "splash_01", pace: "slow", u: 0.2, v: 0.2, size: 0.3, angle: 0 },
        { id: 3, kind: "splash", asset: "splash_02", pace: "slow", u: 0.2, v: 0.2, size: 0.3, angle: 0 },
        { id: 4, kind: "splash", asset: "splash_01", pace: "normal", u: 0.3, v: 0.3, size: 0.3, angle: 0 },
        { id: 5, kind: "gold", asset: "splash_03", pace: "normal", u: 0.5, v: 0.4, size: 0.4, angle: 0, flip: true },
      ],
    });
    assert.equal(markers?.length, 3);
    assert.equal(markers?.[0]?.kind, "gold");
    assert.equal(markers?.[0]?.asset, "splash_03");
    assert.equal(markers?.[0]?.backbeat, true);
    assert.equal(markers?.[1]?.kind, "splash");
    assert.equal(markers?.[1]?.asset, "splash_01");
    assert.equal(markers?.[2]?.asset, "splash_03");
    assert.equal(markers?.[2]?.flip, true);
  });
});
