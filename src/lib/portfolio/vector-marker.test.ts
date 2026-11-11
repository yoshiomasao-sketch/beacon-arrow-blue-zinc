import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePuruMarkers } from "./purupuru.ts";
import {
  angleFromPoint,
  capShift,
  normalizeVectorMarkers,
  retargetVector,
  spanFromDistance,
  vectorCycle,
  vectorEditHit,
  vectorMeshShift,
  vectorMotion,
  vectorOnMesh,
  vectorShift,
  vectorWeight,
  wrapAngle,
  puruListEntries,
  vectorListEntries,
  vectorShownAfterStop,
  VECTOR_KINDS,
  VECTOR_PACES,
  type VectorKind,
  type VectorMarker,
  type VectorPace,
} from "./vector-marker.ts";

const kinds = VECTOR_KINDS.map((kind) => kind.id);
const paces: VectorPace[] = ["slow", "normal", "fast"];

function marker(kind: VectorKind, pace: VectorPace = "normal", angle = 0): VectorMarker {
  return { id: 1, kind, pace, u: 0.5, v: 0.5, radius: 0.25, view: 1, angle };
}

describe("vector markers", () => {
  it("keeps five kinds and three speeds, and ignores puru kinds", () => {
    assert.equal(VECTOR_KINDS.length, 5);
    assert.equal(VECTOR_PACES.length, 3);
    assert.equal(normalizeVectorMarkers(undefined), null);
    assert.deepEqual(normalizeVectorMarkers({ markers: [] }), []);
    const saved = normalizeVectorMarkers({
      markers: [
        { id: 3, kind: "sway", pace: "fast", u: 0.2, v: 0.8, radius: 0.3, view: 0.5, angle: Math.PI },
        { id: 4, kind: "mid", pace: "normal", u: 0.5, v: 0.5, radius: 0.2, angle: 0 },
      ],
    });
    assert.equal(saved?.length, 1);
    assert.equal(saved?.[0]?.kind, "sway");
    assert.equal(saved?.[0]?.pace, "fast");
    assert.equal(saved?.[0]?.view, 0.5);
    assert.equal(saved?.[0]?.span, 1);
    assert.deepEqual(normalizePuruMarkers({ markers: [{ id: 1, kind: "orbit", u: 0.5, v: 0.5, radius: 0.2, angle: 1 }] }), []);
  });

  it("keeps buzz pace words and gives buzz its own clocks", () => {
    assert.equal(vectorCycle("buzz", "slow"), 1320);
    assert.equal(vectorCycle("buzz", "normal"), 520);
    assert.equal(vectorCycle("buzz", "fast"), 320);
    assert.equal(vectorCycle("orbit", "normal"), 1400);
    assert.equal(vectorCycle("orbitBack", "fast"), 700);
    assert.equal(vectorCycle("sway", "slow"), 3200);
    assert.equal(vectorCycle("hit", "normal"), 1280);
    const kept = normalizeVectorMarkers({
      markers: [{ id: 7, kind: "buzz", pace: "fast", u: 0.4, v: 0.6, radius: 0.22, angle: 0.4 }],
    });
    assert.equal(kept?.[0]?.pace, "fast");
    assert.equal(kept?.[0]?.kind, "buzz");
    assert.equal(kept?.[0]?.span, 1);
    assert.equal(kept?.[0]?.radius, 0.22);
  });

  it("makes slow, normal, and fast different clocks without changing the travel", () => {
    const drawn = 100;
    for (const kind of kinds) {
      assert.ok(vectorCycle(kind, "slow") > vectorCycle(kind, "normal"));
      assert.ok(vectorCycle(kind, "normal") > vectorCycle(kind, "fast"));
      if (kind === "buzz") continue;
      assert.equal(vectorCycle(kind, "slow"), vectorCycle(kind, "normal") * 2);
      assert.equal(vectorCycle(kind, "fast"), vectorCycle(kind, "normal") * 0.5);
      const slow = vectorMotion(marker(kind, "slow"), vectorCycle(kind, "slow") * 0.25, drawn);
      const fast = vectorMotion(marker(kind, "fast"), vectorCycle(kind, "fast") * 0.25, drawn);
      if (kind === "orbit" || kind === "orbitBack") {
        const normal = vectorMotion(marker(kind, "normal"), vectorCycle(kind, "normal") * 0.25, drawn);
        const slowR = Math.hypot(slow.x, slow.y);
        const fastR = Math.hypot(fast.x, fast.y);
        assert.ok(Math.abs(slowR - Math.hypot(normal.x, normal.y)) < 0.001);
        assert.ok(fastR > slowR * 1.5);
      } else {
        assert.ok(Math.hypot(slow.x - fast.x, slow.y - fast.y) < 0.001);
      }
      const early = vectorCycle(kind, "slow") * 0.08;
      if (kind === "sway") {
        const slowEarly = Math.abs(vectorMotion(marker(kind, "slow"), early, drawn).x);
        const fastEarly = Math.abs(vectorMotion(marker(kind, "fast"), early, drawn).x);
        assert.ok(fastEarly > slowEarly);
      }
      if (kind === "orbit" || kind === "orbitBack") {
        const slowTurn = Math.abs(vectorMotion(marker(kind, "slow", 0), early, drawn).rotate);
        const fastTurn = Math.abs(vectorMotion(marker(kind, "fast", 0), early, drawn).rotate);
        assert.ok(fastTurn > slowTurn);
      }
    }
  });

  it("spins circles in opposite directions and keeps that spin when the angle changes", () => {
    const drawn = 100;
    const quarter = vectorCycle("orbit", "normal") * 0.25;
    const cw = vectorMotion(marker("orbit", "normal", 0), quarter, drawn);
    const ccw = vectorMotion(marker("orbitBack", "normal", 0), quarter, drawn);
    assert.ok(cw.y > 20);
    assert.ok(ccw.y < -20);
    assert.ok(Math.abs(cw.x) < 1);
    assert.ok(Math.abs(ccw.x) < 1);
    const turned = vectorMotion(marker("orbit", "normal", Math.PI / 2), quarter, drawn);
    assert.ok(turned.x < -20);
    assert.ok(Math.abs(turned.y) < 1);
    assert.ok(cw.rotate > 80 && cw.rotate < 100);
    assert.ok(ccw.rotate > 260 || ccw.rotate < -80);
  });

  it("separates sway, hit, and buzz along the chosen angle", () => {
    const drawn = 100;
    const sway = vectorMotion(marker("sway", "normal", 0), vectorCycle("sway", "normal") * 0.25, drawn);
    assert.ok(sway.x > 30);
    assert.ok(Math.abs(sway.y) < 0.001);
    const down = vectorMotion(marker("sway", "normal", Math.PI / 2), vectorCycle("sway", "normal") * 0.25, drawn);
    assert.ok(down.y > 30);
    assert.ok(Math.abs(down.x) < 0.001);
    const hitStart = vectorMotion(marker("hit", "normal", 0), 0, drawn);
    const hitBack = vectorMotion(marker("hit", "normal", 0), vectorCycle("hit", "normal") * 0.64, drawn);
    const hitSlam = vectorMotion(marker("hit", "normal", 0), vectorCycle("hit", "normal") * 0.9, drawn);
    assert.ok(hitStart.x > 30 && hitBack.x < -30 && hitSlam.x > 30);
    assert.ok(vectorCycle("hit", "normal") * 0.26 < vectorCycle("hit", "normal") * 0.64);
    const buzz = vectorMotion(marker("buzz", "normal", Math.PI / 2), vectorCycle("buzz", "normal") * 0.05, drawn);
    assert.ok(buzz.y > 10);
    assert.ok(Math.abs(buzz.x) < 0.001);
    let flips = 0;
    let prev = 0;
    for (let i = 0; i <= 20; i += 1) {
      const x = vectorMotion(marker("buzz"), vectorCycle("buzz", "normal") * ((i + 0.5) / 20), drawn).x;
      if (Math.abs(x) < 0.2) continue;
      if (prev !== 0 && Math.sign(x) !== Math.sign(prev)) flips += 1;
      prev = Math.sign(x);
    }
    assert.ok(flips >= 8);
  });

  it("weakens past the drawn circle the way a normal puru marker does", () => {
    const drawn = 80;
    assert.equal(vectorWeight(0, drawn), 1);
    const rim = vectorWeight(drawn, drawn);
    const outside = vectorWeight(drawn * 1.2, drawn);
    const edge = vectorWeight(drawn * 1.45, drawn);
    assert.ok(rim > 0.15 && rim < 0.4);
    assert.ok(outside > 0 && outside < rim);
    assert.equal(edge, 0);
    const pose = vectorMotion(marker("sway"), vectorCycle("sway", "normal") * 0.25, drawn);
    const atRim = vectorShift(marker("sway"), vectorCycle("sway", "normal") * 0.25, drawn, drawn);
    assert.ok(Math.abs(pose.x) > Math.abs(atRim.x));
    assert.ok(Math.abs(atRim.x) > 0);
  });

  it("hits the diamond and the rim separately, and a retarget keeps place, size, and angle", () => {
    const markers = [marker("hit", "slow", Math.PI / 2)];
    const rect = { left: 10, top: 20, width: 400, height: 300 };
    const cx = 10 + 200;
    const cy = 20 + 150;
    const drawn = 0.25 * Math.min(400, 300);
    assert.equal(vectorEditHit(markers, 1, cx, cy, rect)?.action, "move");
    assert.equal(vectorEditHit(markers, 1, cx + drawn, cy, rect)?.action, "resize");
    const hx = cx + Math.cos(Math.PI / 2) * (drawn + 22);
    const hy = cy + Math.sin(Math.PI / 2) * (drawn + 22);
    assert.equal(vectorEditHit(markers, 1, hx, hy, rect)?.action, "angle");
    assert.equal(vectorEditHit(markers, null, hx, hy, rect), null);
    const next = retargetVector(markers[0]!, "buzz", "fast");
    assert.equal(next.kind, "buzz");
    assert.equal(next.pace, "fast");
    assert.equal(next.u, markers[0]!.u);
    assert.equal(next.radius, markers[0]!.radius);
    assert.equal(next.angle, markers[0]!.angle);
    assert.ok(Math.abs(wrapAngle(angleFromPoint(0, 0, 0, 10)) - Math.PI / 2) < 0.001);
  });

  it("moves the mesh with the marker and fades past the drawn circle", () => {
    const drawn = 80;
    const markerAt = (kind: VectorKind, pace: VectorPace = "normal", angle = 0) => ({
      kind,
      pace,
      angle,
      u: 0.5,
      v: 0.5,
      radius: drawn / 400,
      view: 1,
    });
    const elapsed = vectorCycle("sway", "normal") * 0.25;
    const center = vectorMeshShift([markerAt("sway")], elapsed, 200, 200, 400, 400);
    const pose = vectorMotion(marker("sway"), elapsed, drawn);
    assert.ok(Math.abs(center.x - pose.x) < 0.001);
    assert.ok(center.x > 30);
    const rim = vectorMeshShift([markerAt("sway")], elapsed, 200 + drawn, 200, 400, 400);
    const edge = vectorMeshShift([markerAt("sway")], elapsed, 200 + drawn * 1.5, 200, 400, 400);
    assert.ok(Math.abs(rim.x) > 0 && Math.abs(rim.x) < Math.abs(center.x));
    assert.equal(edge.x, 0);
    const quarter = vectorCycle("orbit", "normal") * 0.25;
    const cw = vectorMeshShift([markerAt("orbit")], quarter, 200, 200, 400, 400);
    const ccw = vectorMeshShift([markerAt("orbitBack")], quarter, 200, 200, 400, 400);
    assert.ok(cw.y > 20 && ccw.y < -20);
    const slow = vectorMeshShift([markerAt("sway", "slow")], vectorCycle("sway", "slow") * 0.25, 200, 200, 400, 400);
    const fast = vectorMeshShift([markerAt("sway", "fast")], vectorCycle("sway", "fast") * 0.25, 200, 200, 400, 400);
    assert.ok(Math.abs(slow.x - fast.x) < 0.001);
    const doubled = vectorMeshShift([markerAt("sway"), markerAt("sway")], elapsed, 200, 200, 400, 400);
    assert.ok(Math.abs(doubled.x - center.x) < 0.001);
    const hit = vectorMeshShift([markerAt("hit", "normal", Math.PI / 2)], 0, 200, 200, 400, 400);
    assert.ok(hit.y > 30 && Math.abs(hit.x) < 0.001);
    const capped = capShift({ x: center.x + 100, y: 0 }, 40);
    assert.ok(Math.abs(capped.x) <= 40.001);
    assert.equal(capShift(center, 400).x, center.x);
  });

  it("stimulates only the puru mesh that is already there", () => {
    const elapsed = vectorCycle("sway", "normal") * 0.25;
    const vectors = [{ kind: "sway" as const, pace: "normal" as const, angle: 0, u: 0.5, v: 0.5, radius: 0.25, view: 1 }];
    const puru = [{ kind: "mid" as const, u: 0.5, v: 0.5, radius: 0.25, view: 1 }];
    const alone = vectorOnMesh(vectors, [], elapsed, 200, 200, 400, 400);
    assert.equal(alone.x, 0);
    assert.equal(alone.y, 0);
    const pinned = vectorOnMesh(vectors, [{ kind: "still", u: 0.5, v: 0.5, radius: 0.25, view: 1 }], elapsed, 200, 200, 400, 400);
    assert.equal(pinned.x, 0);
    const onMesh = vectorOnMesh(vectors, puru, elapsed, 200, 200, 400, 400);
    assert.ok(onMesh.x > 20);
    const outside = vectorOnMesh(vectors, puru, elapsed, 390, 200, 400, 400);
    assert.equal(outside.x, 0);
    const farPuru = [{ kind: "mid" as const, u: 0.08, v: 0.08, radius: 0.2, view: 1 }];
    const missed = vectorOnMesh(vectors, farPuru, elapsed, 200, 200, 400, 400);
    assert.equal(missed.x, 0);
    const edge = vectorOnMesh(vectors, puru, elapsed, 200 + 70, 200, 400, 400);
    assert.ok(Math.abs(edge.x) > 0 && Math.abs(edge.x) < onMesh.x);
  });

  it("scales every kind by span without widening the circle", () => {
    const drawn = 80;
    const elapsed = vectorCycle("sway", "normal") * 0.25;
    const base = vectorMotion(marker("sway"), elapsed, drawn);
    const longer = vectorMotion({ ...marker("sway"), span: 2 }, elapsed, drawn);
    const shorter = vectorMotion({ ...marker("sway"), span: 0.5 }, elapsed, drawn);
    assert.ok(Math.abs(longer.x - base.x * 2) < 0.001);
    assert.ok(Math.abs(shorter.x - base.x * 0.5) < 0.001);
    for (const kind of kinds) {
      const plain = vectorMotion(marker(kind), vectorCycle(kind, "normal") * 0.25, drawn);
      const scaled = vectorMotion({ ...marker(kind), span: 1.5 }, vectorCycle(kind, "normal") * 0.25, drawn);
      assert.ok(Math.abs(Math.hypot(scaled.x, scaled.y) - Math.hypot(plain.x, plain.y) * 1.5) < 0.001);
    }
    assert.equal(vectorWeight(drawn * 1.45, drawn), 0);
    const wide = vectorMeshShift(
      [{ kind: "sway", pace: "normal", angle: 0, span: 2.5, u: 0.5, v: 0.5, radius: drawn / 400, view: 1 }],
      elapsed,
      200 + drawn * 1.5,
      200,
      400,
      400,
    );
    assert.equal(wide.x, 0);
    const saved = normalizeVectorMarkers({
      markers: [{ id: 2, kind: "orbit", pace: "slow", u: 0.2, v: 0.3, radius: 0.2, angle: 1, span: 9 }],
    });
    assert.equal(saved?.[0]?.span, 2.5);
    assert.equal(saved?.[0]?.radius, 0.2);
    assert.equal(spanFromDistance(drawn + 22, drawn), 1);
    assert.ok(spanFromDistance(drawn * 2 + 22, drawn) > 1.9);
    assert.ok(spanFromDistance(drawn * 0.4, drawn) < 0.5);
  });

  it("retunes only buzz: old fast becomes normal, fast is finer, slow kicks then waits", () => {
    const drawn = 100;
    const peak = drawn * 0.14;
    const sine = (phase: number) => Math.sin(phase * Math.PI * 2 * 5) * peak;
    for (let i = 0; i <= 24; i += 1) {
      const phase = i / 24;
      const normal = vectorMotion(marker("buzz", "normal"), 520 * phase, drawn).x;
      const fast = vectorMotion(marker("buzz", "fast"), 320 * phase, drawn).x;
      assert.ok(Math.abs(normal - sine(phase)) < 0.001);
      assert.ok(Math.abs(fast - sine(phase)) < 0.001);
    }
    let flipsNormal = 0;
    let flipsFast = 0;
    let prevN = 0;
    let prevF = 0;
    for (let i = 0; i <= 80; i += 1) {
      const n = vectorMotion(marker("buzz", "normal"), (520 * i) / 80, drawn).x;
      const f = vectorMotion(marker("buzz", "fast"), (520 * i) / 80, drawn).x;
      if (Math.abs(n) > 0.4 && prevN && Math.sign(n) !== prevN) flipsNormal += 1;
      if (Math.abs(f) > 0.4 && prevF && Math.sign(f) !== prevF) flipsFast += 1;
      if (Math.abs(n) > 0.4) prevN = Math.sign(n);
      if (Math.abs(f) > 0.4) prevF = Math.sign(f);
    }
    assert.ok(flipsNormal >= 8);
    assert.ok(flipsFast > flipsNormal * 1.5);

    let maxSlow = 0;
    let peakAt = 0;
    let maxWait = 0;
    for (let ms = 0; ms <= 1320; ms += 4) {
      const x = vectorMotion(marker("buzz", "slow"), ms, drawn).x;
      if (ms < 320) {
        if (x > maxSlow) {
          maxSlow = x;
          peakAt = ms;
        }
      } else maxWait = Math.max(maxWait, Math.abs(x));
    }
    assert.ok(maxSlow > peak * 2.2);
    assert.ok(peakAt >= 40 && peakAt <= 80);
    assert.equal(maxWait, 0);
    const before = vectorMotion(marker("buzz", "slow"), 8, drawn).x;
    assert.ok(before > peak * 0.4);
    let minAfter = 0;
    for (let ms = peakAt; ms < 320; ms += 4) minAfter = Math.min(minAfter, vectorMotion(marker("buzz", "slow"), ms, drawn).x);
    assert.ok(minAfter < -2);
    assert.ok(minAfter > -maxSlow * 0.45);
    const spanned = vectorMotion({ ...marker("buzz", "slow"), span: 2 }, peakAt, drawn).x;
    const spannedFast = vectorMotion({ ...marker("buzz", "fast"), span: 2 }, 320 * 0.05, drawn).x;
    const plainFast = vectorMotion(marker("buzz", "fast"), 320 * 0.05, drawn).x;
    assert.ok(Math.abs(spanned - maxSlow * 2) < 0.05);
    assert.ok(Math.abs(spannedFast - plainFast * 2) < 0.001);
    const up = vectorMotion(marker("buzz", "slow", Math.PI / 2), peakAt, drawn);
    assert.ok(up.y > peak * 2);
    assert.ok(Math.abs(up.x) < 0.001);

    const vectors = [{ kind: "buzz" as const, pace: "slow" as const, angle: 0, span: 1, u: 0.5, v: 0.5, radius: 0.25, view: 1 }];
    const puru = [{ kind: "mid" as const, u: 0.5, v: 0.5, radius: 0.4, view: 1 }];
    assert.equal(vectorOnMesh(vectors, [], peakAt, 200, 200, 400, 400).x, 0);
    assert.ok(vectorOnMesh(vectors, puru, peakAt, 200, 200, 400, 400).x > 8);
    assert.equal(vectorOnMesh(vectors, puru, 800, 200, 200, 400, 400).x, 0);
    assert.equal(vectorWeight(drawn * 1.45, drawn), 0);

    const sway = vectorMotion(marker("sway", "normal"), 1600 * 0.25, drawn);
    const hit = vectorMotion(marker("hit", "fast"), 0, drawn);
    assert.ok(Math.abs(sway.x - drawn * 0.46) < 0.001);
    assert.ok(hit.x > 40);
  });

  it("retunes only orbit and orbit back: slow is the old normal, normal is the old fast, fast swings wider", () => {
    const drawn = 100;
    const oldTravel = drawn * 0.34;
    const fastTravel = drawn * 0.62;
    for (const kind of ["orbit", "orbitBack"] as const) {
      assert.equal(vectorCycle(kind, "slow"), 2800);
      assert.equal(vectorCycle(kind, "normal"), 1400);
      assert.equal(vectorCycle(kind, "fast"), 700);
      const radiusOf = (pace: VectorPace) => {
        const pose = vectorMotion(marker(kind, pace, 0), vectorCycle(kind, pace) * 0.25, drawn);
        return Math.hypot(pose.x, pose.y);
      };
      assert.ok(Math.abs(radiusOf("slow") - oldTravel) < 0.001);
      assert.ok(Math.abs(radiusOf("normal") - oldTravel) < 0.001);
      assert.ok(Math.abs(radiusOf("fast") - fastTravel) < 0.001);
    }

    const quarter = 1400 * 0.25;
    const cw = vectorMotion(marker("orbit", "normal", 0), quarter, drawn);
    const ccw = vectorMotion(marker("orbitBack", "normal", 0), quarter, drawn);
    assert.ok(cw.y > 20 && Math.abs(cw.x) < 1);
    assert.ok(ccw.y < -20 && Math.abs(ccw.x) < 1);

    const fastFull = vectorMotion(marker("orbit", "fast", 0), 700, drawn);
    const normalHalf = vectorMotion(marker("orbit", "normal", 0), 700, drawn);
    const backFull = vectorMotion(marker("orbitBack", "fast", 0), 700, drawn);
    assert.ok(fastFull.x > 50 && Math.abs(fastFull.y) < 1);
    assert.ok(normalHalf.x < -20 && Math.abs(normalHalf.y) < 1);
    assert.ok(backFull.x > 50 && Math.abs(backFull.y) < 1);

    let prevCw = vectorMotion(marker("orbit", "fast", 0), 0, drawn).rotate;
    let prevCcw = vectorMotion(marker("orbitBack", "fast", 0), 0, drawn).rotate;
    for (let i = 1; i <= 7; i += 1) {
      const at = (700 * i) / 8;
      const cwPose = vectorMotion(marker("orbit", "fast", 0), at, drawn);
      const ccwPose = vectorMotion(marker("orbitBack", "fast", 0), at, drawn);
      assert.ok(Math.abs(Math.hypot(cwPose.x, cwPose.y) - fastTravel) < 0.001);
      assert.ok(Math.abs(Math.hypot(ccwPose.x, ccwPose.y) - fastTravel) < 0.001);
      assert.ok(cwPose.rotate > prevCw);
      assert.ok(ccwPose.rotate < prevCcw);
      prevCw = cwPose.rotate;
      prevCcw = ccwPose.rotate;
    }

    for (const pace of paces) {
      const plain = vectorMotion(marker("orbit", pace), vectorCycle("orbit", pace) * 0.25, drawn);
      const scaled = vectorMotion({ ...marker("orbit", pace), span: 2 }, vectorCycle("orbit", pace) * 0.25, drawn);
      const back = vectorMotion({ ...marker("orbitBack", pace), span: 0.5 }, vectorCycle("orbitBack", pace) * 0.25, drawn);
      const backPlain = vectorMotion(marker("orbitBack", pace), vectorCycle("orbitBack", pace) * 0.25, drawn);
      assert.ok(Math.abs(Math.hypot(scaled.x, scaled.y) - Math.hypot(plain.x, plain.y) * 2) < 0.001);
      assert.ok(Math.abs(Math.hypot(back.x, back.y) - Math.hypot(backPlain.x, backPlain.y) * 0.5) < 0.001);
    }
    assert.equal(vectorWeight(drawn * 1.45, drawn), 0);

    const kept = normalizeVectorMarkers({
      markers: [{ id: 9, kind: "orbit", pace: "fast", u: 0.4, v: 0.4, radius: 0.3, angle: 0.2, span: 1.2 }],
    });
    assert.equal(kept?.[0]?.pace, "fast");
    assert.equal(kept?.[0]?.kind, "orbit");
    assert.equal(kept?.[0]?.radius, 0.3);
    assert.equal(kept?.[0]?.span, 1.2);

    const vectors = [{ kind: "orbit" as const, pace: "fast" as const, angle: 0, span: 1, u: 0.5, v: 0.5, radius: 0.28, view: 1 }];
    const puru = [{ kind: "mid" as const, u: 0.5, v: 0.5, radius: 0.4, view: 1 }];
    assert.equal(vectorOnMesh(vectors, [], 175, 200, 200, 400, 400).x, 0);
    const on = vectorOnMesh(vectors, puru, 175, 200, 200, 400, 400);
    const mag = Math.hypot(on.x, on.y);
    assert.ok(mag > 60 && mag < 75);
    assert.ok(mag < 400 * 0.34);

    assert.equal(vectorCycle("sway", "slow"), 3200);
    assert.equal(vectorCycle("sway", "normal"), 1600);
    assert.equal(vectorCycle("sway", "fast"), 800);
    assert.equal(vectorCycle("hit", "slow"), 2560);
    assert.equal(vectorCycle("hit", "normal"), 1280);
    assert.equal(vectorCycle("hit", "fast"), 640);
    assert.equal(vectorCycle("buzz", "slow"), 1320);
    assert.equal(vectorCycle("buzz", "normal"), 520);
    assert.equal(vectorCycle("buzz", "fast"), 320);
    const swayPose = vectorMotion(marker("sway", "normal"), 1600 * 0.25, drawn);
    const hitPose = vectorMotion(marker("hit", "normal"), 0, drawn);
    const buzzPose = vectorMotion(marker("buzz", "normal"), 520 * 0.05, drawn);
    assert.ok(Math.abs(swayPose.x - drawn * 0.46) < 0.001);
    assert.ok(hitPose.x > 40);
    assert.ok(Math.abs(buzzPose.x - Math.sin(0.05 * Math.PI * 2 * 5) * drawn * 0.14) < 0.001);
  });

  it("lists markers in addition order and hides rings only after a favorite stop", () => {
    const puru = puruListEntries([
      { id: 4, kind: "soft" },
      { id: 1, kind: "still" },
      { id: 9, kind: "mid-low" },
    ]);
    assert.deepEqual(
      puru.map((entry) => entry.id),
      [4, 1, 9],
    );
    assert.equal(puru[0]?.group, "ぷるぷる");
    assert.equal(puru[0]?.name, "広い・強");
    assert.equal(puru[0]?.pace, null);
    assert.equal(puru[1]?.name, "不動");
    assert.equal(puru[2]?.name, "普通・弱");

    const vectors = vectorListEntries([
      { id: 2, kind: "orbit", pace: "fast" },
      { id: 8, kind: "buzz", pace: "slow" },
      { id: 3, kind: "hit", pace: "normal" },
    ]);
    assert.deepEqual(
      vectors.map((entry) => [entry.id, entry.group, entry.name, entry.pace]),
      [
        [2, "ベクトル", "円", "速"],
        [8, "ベクトル", "バイブ", "遅"],
        [3, "ベクトル", "打ち付け", "普通"],
      ],
    );
    const moved = vectorListEntries([
      { id: 2, kind: "sway", pace: "normal" },
      { id: 8, kind: "orbitBack", pace: "fast" },
    ]);
    assert.deepEqual(
      moved.map((entry) => entry.id),
      [2, 8],
    );
    assert.equal(moved[0]?.name, "揺れ");
    assert.equal(moved[1]?.name, "逆円");

    assert.equal(vectorShownAfterStop("favorite", false, 3), false);
    assert.equal(vectorShownAfterStop("marker", false, 3), true);
    assert.equal(vectorShownAfterStop("marker", true, 3), false);
    assert.equal(vectorShownAfterStop("marker", false, 0), false);
    assert.equal(vectorShownAfterStop("favorite", false, 0), false);
  });
});
