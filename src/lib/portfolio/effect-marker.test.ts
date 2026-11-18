import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  effectCycle,
  effectDrawSize,
  effectDrop,
  effectListEntries,
  effectOpacity,
  effectResize,
  effectTimeline,
  effectTurn,
  normalizeEffectMarkers,
} from "./effect-marker.ts";
import { vectorCycle } from "./vector-marker.ts";

describe("splash effect markers", () => {
  it("keeps each pace's loop and plays every splash at the fast length", () => {
    const slowCycle = vectorCycle("hit", "slow");
    assert.equal(slowCycle, 2560);
    assert.equal(effectCycle("slow"), slowCycle);
    assert.equal(effectCycle("normal"), slowCycle / 2);
    assert.equal(effectCycle("fast"), slowCycle / 4);
    const fast = effectTimeline("fast");
    const normal = effectTimeline("normal");
    const slow = effectTimeline("slow");
    assert.equal(fast.fadeIn, 25);
    assert.equal(fast.hold, 50);
    assert.equal(fast.fadeOut, 75);
    for (const span of [fast, normal, slow]) {
      assert.equal(span.fadeIn, fast.fadeIn);
      assert.equal(span.hold, fast.hold);
      assert.equal(span.fadeOut, fast.fadeOut);
      assert.equal(span.fadeIn + span.hold + span.fadeOut + span.hidden, span.cycle);
      assert.ok(span.hidden >= 0);
    }
    assert.ok(slow.hidden > normal.hidden);
    assert.ok(normal.hidden > fast.hidden);
  });

  it("fades in, holds, fades out, stays clear, then repeats from zero", () => {
    const span = effectTimeline("slow");
    assert.equal(effectOpacity("slow", 0), 0);
    assert.ok(Math.abs(effectOpacity("slow", span.fadeIn / 2) - 0.5) < 1e-6);
    assert.equal(effectOpacity("slow", span.fadeIn), 1);
    assert.equal(effectOpacity("slow", span.fadeIn + span.hold / 2), 1);
    const outAt = span.fadeIn + span.hold + span.fadeOut / 2;
    assert.ok(Math.abs(effectOpacity("slow", outAt) - 0.5) < 1e-6);
    assert.equal(effectOpacity("slow", span.fadeIn + span.hold + span.fadeOut), 0);
    assert.equal(effectOpacity("slow", span.cycle - 1), 0);
    assert.equal(effectOpacity("slow", span.cycle), 0);
    assert.ok(Math.abs(effectOpacity("slow", span.cycle + span.fadeIn / 2) - 0.5) < 1e-6);
  });

  it("keeps each marker on its own loop while the splash itself stays the fast length", () => {
    const slow = effectTimeline("slow");
    const fast = effectTimeline("fast");
    const shown = fast.fadeIn + fast.hold + fast.fadeOut;
    const elapsed = shown + 10;
    assert.equal(effectOpacity("fast", elapsed), 0);
    assert.equal(effectOpacity("normal", elapsed), 0);
    assert.equal(effectOpacity("slow", elapsed), 0);
    assert.ok(Math.abs(effectOpacity("slow", fast.fadeIn / 2) - effectOpacity("fast", fast.fadeIn / 2)) < 1e-9);
    assert.equal(effectOpacity("slow", fast.cycle), 0);
    assert.ok(fast.cycle < slow.cycle);
    assert.ok(elapsed < slow.hidden || elapsed >= shown);
  });

  it("restores splash markers and drops an unknown kind without breaking the rest", () => {
    const markers = normalizeEffectMarkers({
      markers: [
        { id: 2, kind: "spark", asset: "splash_01", pace: "fast", u: 0.2, v: 0.2, size: 0.3, angle: 0 },
        { id: 4, kind: "splash", asset: "splash_01", pace: "slow", u: 0.25, v: 0.75, size: 0.4, angle: Math.PI / 2 },
      ],
    });
    assert.equal(markers?.length, 1);
    assert.equal(markers?.[0]?.id, 4);
    assert.equal(markers?.[0]?.kind, "splash");
    assert.equal(markers?.[0]?.asset, "splash_01");
    assert.equal(markers?.[0]?.pace, "slow");
    assert.equal(markers?.[0]?.u, 0.25);
    assert.equal(markers?.[0]?.v, 0.75);
    assert.equal(markers?.[0]?.size, 0.4);
    assert.ok(Math.abs((markers?.[0]?.angle ?? 0) - Math.PI / 2) < 1e-6);
  });

  it("resizes from the center in the sheet ratio and turns around the center", () => {
    const marker = {
      id: 1,
      kind: "splash" as const,
      asset: "splash_01" as const,
      pace: "normal" as const,
      u: 0.4,
      v: 0.6,
      size: 0.34,
      angle: 0.3,
    };
    const rect = { left: 10, top: 20, width: 400, height: 200 };
    const draw = effectDrawSize(marker, rect);
    assert.ok(Math.abs(draw.w / draw.h - 1240 / 1268) < 1e-6);
    const grown = effectResize(marker, 10 + marker.u * rect.width + 80, 20 + marker.v * rect.height, rect);
    assert.equal(grown.u, marker.u);
    assert.equal(grown.v, marker.v);
    assert.equal(grown.angle, marker.angle);
    assert.ok(grown.size > marker.size);
    const turned = effectTurn(marker, 10 + marker.u * rect.width, 20 + marker.v * rect.height - 40, rect);
    assert.equal(turned.u, marker.u);
    assert.equal(turned.v, marker.v);
    assert.equal(turned.size, marker.size);
    assert.ok(Math.abs(turned.angle - (Math.PI * 1.5)) < 1e-6 || Math.abs(turned.angle - (-Math.PI / 2 + Math.PI * 2)) < 1e-6);
  });

  it("shifts the whole splash cycle by half, including the wait after the splash", () => {
    for (const pace of ["slow", "normal", "fast"] as const) {
      const cycle = effectCycle(pace);
      const span = effectTimeline(pace);
      assert.equal(effectOpacity(pace, 0, true), 0);
      assert.equal(effectOpacity(pace, cycle / 2, true), effectOpacity(pace, 0, false));
      assert.ok(Math.abs(effectOpacity(pace, cycle / 2 + span.fadeIn / 2, true) - 0.5) < 1e-6);
      const elapsed = cycle * 2 + 80;
      assert.ok(Math.abs(effectOpacity(pace, elapsed, true) - effectOpacity(pace, elapsed + cycle / 2, false)) < 1e-9);
    }
    const span = effectTimeline("slow");
    let bothHolding = 0;
    for (let step = 0; step < 32; step += 1) {
      const t = (step * span.cycle) / 32;
      const down = effectOpacity("slow", t, false);
      const back = effectOpacity("slow", t, true);
      if (down === 1 && back === 1) bothHolding += 1;
    }
    assert.equal(bothHolding, 0);
    const saved = normalizeEffectMarkers({
      markers: [
        { id: 4, kind: "splash", asset: "splash_01", pace: "fast", u: 0.2, v: 0.3, size: 0.4, angle: 0.4, backbeat: true, off: true },
        { id: 5, kind: "splash", asset: "splash_01", pace: "normal", u: 0.5, v: 0.5, size: 0.3, angle: 0, flip: true },
      ],
    });
    assert.equal(saved?.[0]?.backbeat, true);
    assert.equal(saved?.[0]?.off, true);
    assert.equal(saved?.[0]?.pace, "fast");
    assert.equal(saved?.[1]?.backbeat, undefined);
    assert.equal(saved?.[1]?.off, undefined);
    assert.equal(saved?.[1]?.flip, true);
    const rows = effectListEntries(saved ?? []);
    assert.equal(rows[0]?.backbeat, true);
    assert.equal(rows[0]?.off, true);
    assert.equal(rows[1]?.backbeat, false);
    assert.equal(rows[1]?.group, "エフェクト");
  });

  it("drops a splash where the drag ends and ignores a click", () => {
    assert.equal(effectDrop(1, 1, 0.4, 0.4), null);
    assert.deepEqual(effectDrop(12, 0, 0.2, 1.4), { u: 0.2, v: 1 });
    assert.deepEqual(effectDrop(0, -9, -0.2, 0.3), { u: 0, v: 0.3 });
  });
});
