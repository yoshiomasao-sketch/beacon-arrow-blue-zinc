import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePuruMarkers, puruKindFace } from "./purupuru.ts";
import {
  angleFromPoint,
  capShift,
  cyclePhase,
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
  vectorKindFace,
  vectorListEntries,
  vectorShownAfterStop,
  VECTOR_KINDS,
  VECTOR_PACES,
  VECTOR_VIBE,
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
    assert.equal(VECTOR_KINDS.length, 9);
    assert.deepEqual(
      VECTOR_KINDS.map((kind) => kind.label),
      ["円", "逆円", "揺れ", "プッシュ", "打ち付け", "膨張", "縮小", "反応", "バイブ"],
    );
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
    assert.equal(vectorCycle("buzz", "slow"), 1024);
    assert.equal(vectorCycle("buzz", "normal"), 512);
    assert.equal(vectorCycle("buzz", "fast"), 256);
    assert.equal(vectorCycle("react", "slow"), vectorCycle("hit", "normal"));
    assert.equal(vectorCycle("react", "normal"), 640);
    assert.equal(vectorCycle("react", "fast"), 320);
    assert.equal(vectorCycle("orbit", "normal"), vectorCycle("hit", "normal"));
    assert.equal(vectorCycle("orbitBack", "fast"), vectorCycle("hit", "fast"));
    assert.equal(vectorCycle("sway", "slow"), vectorCycle("hit", "slow"));
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
    const hitRest = vectorMotion(marker("hit", "normal", 0), 0, drawn);
    const hitHold = vectorMotion(marker("hit", "normal", 0), vectorCycle("hit", "normal") * 0.52, drawn);
    const hitBack = vectorMotion(marker("hit", "normal", 0), vectorCycle("hit", "normal") * 0.9, drawn);
    assert.ok(Math.abs(hitRest.x) < 0.001 && hitHold.x > 30 && Math.abs(hitBack.x) < 0.001);
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
    const cycle = vectorCycle("hit", "normal");
    const hit = vectorMeshShift([markerAt("hit", "normal", Math.PI / 2)], cycle * 0.52, 200, 200, 400, 400);
    assert.ok(hit.y > 30 && Math.abs(hit.x) < 0.001);
    const hitRest = vectorMeshShift([markerAt("hit", "normal", Math.PI / 2)], 0, 200, 200, 400, 400);
    assert.ok(Math.abs(hitRest.x) < 0.001 && Math.abs(hitRest.y) < 0.001);
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
      const normal = vectorMotion(marker("buzz", "normal"), vectorCycle("buzz", "normal") * phase, drawn).x;
      const fast = vectorMotion(marker("buzz", "fast"), vectorCycle("buzz", "fast") * phase, drawn).x;
      assert.ok(Math.abs(normal - sine(phase)) < 0.001);
      assert.ok(Math.abs(fast - sine(phase)) < 0.001);
    }
    let flipsNormal = 0;
    let flipsFast = 0;
    let prevN = 0;
    let prevF = 0;
    for (let i = 0; i <= 80; i += 1) {
      const n = vectorMotion(marker("buzz", "normal"), (vectorCycle("buzz", "normal") * i) / 80, drawn).x;
      const f = vectorMotion(marker("buzz", "fast"), (vectorCycle("buzz", "normal") * i) / 80, drawn).x;
      if (Math.abs(n) > 0.4 && prevN && Math.sign(n) !== prevN) flipsNormal += 1;
      if (Math.abs(f) > 0.4 && prevF && Math.sign(f) !== prevF) flipsFast += 1;
      if (Math.abs(n) > 0.4) prevN = Math.sign(n);
      if (Math.abs(f) > 0.4) prevF = Math.sign(f);
    }
    assert.ok(flipsNormal >= 8);
    assert.ok(flipsFast > flipsNormal * 1.5);

    const slowMs = vectorCycle("react", "slow");
    const kickMs = slowMs * (320 / 1320);
    assert.equal(slowMs, vectorCycle("hit", "normal"));
    let maxSlow = 0;
    let peakAt = 0;
    let maxWait = 0;
    for (let ms = 0; ms <= slowMs; ms += 4) {
      const x = vectorMotion(marker("react", "slow"), ms, drawn).x;
      if (ms + 1e-6 < kickMs) {
        if (x > maxSlow) {
          maxSlow = x;
          peakAt = ms;
        }
      } else maxWait = Math.max(maxWait, Math.abs(x));
    }
    assert.ok(maxSlow > peak * 2.2);
    assert.ok(peakAt >= 40 && peakAt <= 80);
    assert.equal(maxWait, 0);
    const before = vectorMotion(marker("react", "slow"), 8, drawn).x;
    assert.ok(before > peak * 0.4);
    let minAfter = 0;
    for (let ms = peakAt; ms < kickMs; ms += 4) minAfter = Math.min(minAfter, vectorMotion(marker("react", "slow"), ms, drawn).x);
    assert.ok(minAfter < -2);
    assert.ok(minAfter > -maxSlow * 0.45);
    const spanned = vectorMotion({ ...marker("react", "slow"), span: 2 }, peakAt, drawn).x;
    const spannedFast = vectorMotion({ ...marker("buzz", "fast"), span: 2 }, vectorCycle("buzz", "fast") * 0.05, drawn).x;
    const plainFast = vectorMotion(marker("buzz", "fast"), vectorCycle("buzz", "fast") * 0.05, drawn).x;
    assert.ok(Math.abs(spanned - maxSlow * 2) < 0.05);
    assert.ok(Math.abs(spannedFast - plainFast * 2) < 0.001);
    const up = vectorMotion(marker("react", "slow", Math.PI / 2), peakAt, drawn);
    assert.ok(up.y > peak * 2);
    assert.ok(Math.abs(up.x) < 0.001);

    const vectors = [{ kind: "react" as const, pace: "slow" as const, angle: 0, span: 1, u: 0.5, v: 0.5, radius: 0.25, view: 1 }];
    const puru = [{ kind: "mid" as const, u: 0.5, v: 0.5, radius: 0.4, view: 1 }];
    assert.equal(vectorOnMesh(vectors, [], peakAt, 200, 200, 400, 400).x, 0);
    assert.ok(vectorOnMesh(vectors, puru, peakAt, 200, 200, 400, 400).x > 8);
    assert.equal(vectorOnMesh(vectors, puru, 800, 200, 200, 400, 400).x, 0);
    assert.equal(vectorWeight(drawn * 1.45, drawn), 0);

    const sway = vectorMotion(marker("sway", "normal"), vectorCycle("sway", "normal") * 0.25, drawn);
    const hit = vectorMotion(marker("hit", "fast"), vectorCycle("hit", "fast") * 0.52, drawn);
    assert.ok(Math.abs(sway.x - drawn * 0.46) < 0.001);
    assert.ok(hit.x > 40);
    assert.ok(Math.abs(vectorMotion(marker("hit", "fast"), 0, drawn).x) < 0.001);
  });

  it("retunes only orbit and orbit back: slow is the old normal, normal is the old fast, fast swings wider", () => {
    const drawn = 100;
    const oldTravel = drawn * 0.34;
    const fastTravel = drawn * 0.62;
    for (const kind of ["orbit", "orbitBack"] as const) {
      assert.equal(vectorCycle(kind, "slow"), vectorCycle("hit", "slow"));
      assert.equal(vectorCycle(kind, "normal"), vectorCycle("hit", "normal"));
      assert.equal(vectorCycle(kind, "fast"), vectorCycle("hit", "fast"));
      const radiusOf = (pace: VectorPace) => {
        const pose = vectorMotion(marker(kind, pace, 0), vectorCycle(kind, pace) * 0.25, drawn);
        return Math.hypot(pose.x, pose.y);
      };
      assert.ok(Math.abs(radiusOf("slow") - oldTravel) < 0.001);
      assert.ok(Math.abs(radiusOf("normal") - oldTravel) < 0.001);
      assert.ok(Math.abs(radiusOf("fast") - fastTravel) < 0.001);
    }

    const quarter = vectorCycle("orbit", "normal") * 0.25;
    const cw = vectorMotion(marker("orbit", "normal", 0), quarter, drawn);
    const ccw = vectorMotion(marker("orbitBack", "normal", 0), quarter, drawn);
    assert.ok(cw.y > 20 && Math.abs(cw.x) < 1);
    assert.ok(ccw.y < -20 && Math.abs(ccw.x) < 1);

    const fastMs = vectorCycle("orbit", "fast");
    const fastFull = vectorMotion(marker("orbit", "fast", 0), fastMs, drawn);
    const normalHalf = vectorMotion(marker("orbit", "normal", 0), fastMs, drawn);
    const backFull = vectorMotion(marker("orbitBack", "fast", 0), fastMs, drawn);
    assert.ok(fastFull.x > 50 && Math.abs(fastFull.y) < 1);
    assert.ok(normalHalf.x < -20 && Math.abs(normalHalf.y) < 1);
    assert.ok(backFull.x > 50 && Math.abs(backFull.y) < 1);

    let prevCw = vectorMotion(marker("orbit", "fast", 0), 0, drawn).rotate;
    let prevCcw = vectorMotion(marker("orbitBack", "fast", 0), 0, drawn).rotate;
    for (let i = 1; i <= 7; i += 1) {
      const at = (fastMs * i) / 8;
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

    assert.equal(vectorCycle("sway", "slow"), 2560);
    assert.equal(vectorCycle("sway", "normal"), 1280);
    assert.equal(vectorCycle("sway", "fast"), 640);
    assert.equal(vectorCycle("hit", "slow"), 2560);
    assert.equal(vectorCycle("hit", "normal"), 1280);
    assert.equal(vectorCycle("hit", "fast"), 640);
    assert.equal(vectorCycle("buzz", "slow"), 1024);
    assert.equal(vectorCycle("buzz", "normal"), 512);
    assert.equal(vectorCycle("buzz", "fast"), 256);
    const swayPose = vectorMotion(marker("sway", "normal"), vectorCycle("sway", "normal") * 0.25, drawn);
    const hitPose = vectorMotion(marker("hit", "normal"), vectorCycle("hit", "normal") * 0.52, drawn);
    const buzzPose = vectorMotion(marker("buzz", "normal"), vectorCycle("buzz", "normal") * 0.05, drawn);
    assert.ok(Math.abs(swayPose.x - drawn * 0.46) < 0.001);
    assert.ok(Math.abs(hitPose.x - drawn * 0.52) < 0.001);
    assert.ok(Math.abs(buzzPose.x - Math.sin(0.05 * Math.PI * 2 * 5) * drawn * 0.14) < 0.001);
  });

  it("lines up one loop of motion with 打ち付け, without changing the path", () => {
    const drawn = 100;
    const sample = (kind: VectorKind, pace: VectorPace, ms: number) => vectorMotion(marker(kind, pace, 0), ms, drawn);

    const loopMs = (kind: VectorKind, pace: VectorPace) => {
      const span = 2400;
      const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) <= 0.05;
      for (let period = 40; period <= 6000; period += 1) {
        let matched = true;
        for (let at = 0; at < span; at += 8) {
          if (!near(sample(kind, pace, at), sample(kind, pace, period + at))) {
            matched = false;
            break;
          }
        }
        if (matched) return period;
      }
      throw new Error(`no loop for ${kind} ${pace}`);
    };

    const hit = {
      slow: loopMs("hit", "slow"),
      normal: loopMs("hit", "normal"),
      fast: loopMs("hit", "fast"),
    };
    assert.equal(hit.slow, 2560);
    assert.equal(hit.normal, 1280);
    assert.equal(hit.fast, 640);
    assert.equal(hit.slow / hit.normal, 2);
    assert.equal(hit.slow / hit.fast, 4);
    assert.equal(hit.normal / hit.fast, 2);

    for (const kind of ["orbit", "orbitBack", "sway", "push"] as const) {
      assert.equal(loopMs(kind, "slow"), hit.slow);
      assert.equal(loopMs(kind, "normal"), hit.normal);
      assert.equal(loopMs(kind, "fast"), hit.fast);
    }
    assert.equal(vectorCycle("buzz", "normal"), 512);

    const waves = (pace: VectorPace, count: number) => {
      let prev = sample("buzz", pace, 0).x;
      let crosses = 0;
      for (let ms = 1; ms <= 4000; ms += 1) {
        const x = sample("buzz", pace, ms).x;
        if (prev < 0 && x >= 0) {
          crosses += 1;
          if (crosses === count) return ms;
        }
        prev = x;
      }
      throw new Error(`no buzz waves for ${pace}`);
    };
    assert.equal(waves("normal", 5), vectorCycle("buzz", "normal"));
    assert.equal(waves("fast", 5), vectorCycle("buzz", "fast"));

    for (const pace of paces) {
      const orbitAt = (kind: "orbit" | "orbitBack") => sample(kind, pace, vectorCycle(kind, pace) * 0.25);
      const forward = orbitAt("orbit");
      const back = orbitAt("orbitBack");
      assert.ok(Math.abs(Math.hypot(forward.x, forward.y) - (pace === "fast" ? drawn * 0.62 : drawn * 0.34)) < 0.001);
      assert.ok(Math.abs(Math.hypot(back.x, back.y) - Math.hypot(forward.x, forward.y)) < 0.001);
      assert.ok(forward.y > 20 && back.y < -20);
      const sway = sample("sway", pace, vectorCycle("sway", pace) * 0.25);
      assert.ok(Math.abs(sway.x - drawn * 0.46) < 0.001);
      const other = sample("sway", pace, vectorCycle("sway", pace) * 0.75);
      assert.ok(Math.abs(other.x + drawn * 0.46) < 0.001);
      const hitAt = sample("hit", pace, vectorCycle("hit", pace) * 0.52);
      assert.ok(Math.abs(hitAt.x - sample("hit", "slow", vectorCycle("hit", "slow") * 0.52).x) < 0.001);
      assert.ok(hitAt.x > 40);
    }
  });

  it("expands outward and shrinks inward on the shared hit clock", () => {
    const drawn = 100;
    const field = (
      kind: "expand" | "shrink",
      pace: VectorPace,
      ms: number,
      x: number,
      y: number,
      span = 1,
      angle = 0.4,
    ) =>
      vectorMeshShift(
        [{ kind, pace, angle, span, u: 0.5, v: 0.5, radius: drawn / 400, view: 1 }],
        ms,
        x,
        y,
        400,
        400,
      );
    const loopMs = (kind: "expand" | "shrink", pace: VectorPace) => {
      const span = 2400;
      const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) <= 0.01;
      for (let period = 40; period <= 6000; period += 1) {
        let matched = true;
        for (let at = 0; at < span; at += 8) {
          if (!near(field(kind, pace, at, 240, 200), field(kind, pace, period + at, 240, 200))) {
            matched = false;
            break;
          }
        }
        if (matched) return period;
      }
      throw new Error(`no radial loop for ${kind} ${pace}`);
    };

    for (const pace of paces) {
      assert.equal(vectorCycle("expand", pace), vectorCycle("hit", pace));
      assert.equal(vectorCycle("shrink", pace), vectorCycle("hit", pace));
      assert.equal(loopMs("expand", pace), vectorCycle("hit", pace));
      assert.equal(loopMs("shrink", pace), vectorCycle("hit", pace));
      const peak = vectorCycle("expand", pace) * 0.5;
      const right = field("expand", pace, peak, 240, 200);
      const left = field("expand", pace, peak, 160, 200);
      const up = field("expand", pace, peak, 200, 160);
      const inward = field("shrink", pace, peak, 240, 200);
      assert.ok(right.x > 8 && Math.abs(right.y) < 0.001);
      assert.ok(left.x < -8 && Math.abs(left.y) < 0.001);
      assert.ok(up.y < -8 && Math.abs(up.x) < 0.001);
      assert.ok(Math.abs(inward.x + right.x) < 0.001 && inward.x < -8);
      const samePhase = field("expand", pace === "slow" ? "fast" : "slow", vectorCycle("expand", pace === "slow" ? "fast" : "slow") * 0.5, 240, 200);
      assert.ok(Math.abs(samePhase.x - right.x) < 0.001);
    }

    const peak = vectorCycle("expand", "normal") * 0.5;
    assert.equal(field("expand", "normal", 0, 240, 200).x, 0);
    assert.equal(field("expand", "normal", vectorCycle("expand", "normal"), 240, 200).x, 0);
    assert.deepEqual(field("expand", "normal", peak, 200, 200), { x: 0, y: 0 });
    const near = field("expand", "normal", peak, 206, 200);
    const body = field("expand", "normal", peak, 240, 200);
    const rim = field("expand", "normal", peak, 340, 200);
    assert.ok(near.x > 0 && near.x < body.x);
    assert.ok(rim.x > 0 && rim.x < body.x);
    assert.equal(field("expand", "normal", peak, 360, 200).x, 0);
    assert.equal(field("shrink", "normal", peak, 360, 200).y, 0);
    const turned = field("expand", "normal", peak, 240, 200, 1, Math.PI);
    assert.ok(Math.abs(turned.x - body.x) < 0.001);
    const longer = field("expand", "normal", peak, 240, 200, 2);
    assert.ok(Math.abs(longer.x - body.x * 2) < 0.001);

    const vectors = [{ kind: "expand" as const, pace: "normal" as const, angle: 0, span: 1, u: 0.5, v: 0.5, radius: 0.25, view: 1 }];
    const puru = [{ kind: "mid" as const, u: 0.5, v: 0.5, radius: 0.4, view: 1 }];
    assert.equal(vectorOnMesh(vectors, [], peak, 240, 200, 400, 400).x, 0);
    assert.ok(vectorOnMesh(vectors, puru, peak, 240, 200, 400, 400).x > 8);
    assert.equal(vectorOnMesh(vectors, [{ kind: "still", u: 0.5, v: 0.5, radius: 0.4, view: 1 }], peak, 240, 200, 400, 400).x, 0);
    const saved = normalizeVectorMarkers({
      markers: [{ id: 4, kind: "shrink", pace: "fast", u: 0.2, v: 0.3, radius: 0.22, angle: 1, span: 1.4 }],
    });
    assert.equal(saved?.[0]?.kind, "shrink");
    assert.equal(saved?.[0]?.pace, "fast");
    assert.equal(saved?.[0]?.span, 1.4);
    assert.equal(vectorCycle("hit", "slow"), 2560);
    assert.equal(vectorCycle("hit", "normal"), 1280);
    assert.equal(vectorCycle("hit", "fast"), 640);
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
    assert.equal(puru[0]?.color, puruKindFace("soft").color);
    assert.equal(puru[0]?.pace, null);
    assert.equal(puru[1]?.name, "不動");
    assert.equal(puru[1]?.color, puruKindFace("still").color);
    assert.equal(puru[2]?.name, "普通・弱");
    assert.equal(puru[2]?.color, puruKindFace("mid-low").color);

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
    assert.equal(vectors[0]?.color, vectorKindFace("orbit").color);
    assert.equal(vectors[1]?.color, vectorKindFace("buzz").color);
    assert.equal(vectors[2]?.color, vectorKindFace("hit").color);
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
    assert.equal(vectorShownAfterStop("marker", false, 3), false);
    assert.equal(vectorShownAfterStop("marker", true, 3), false);
    assert.equal(vectorShownAfterStop("marker", false, 0), false);
    assert.equal(vectorShownAfterStop("favorite", false, 0), false);
  });

  it("parks a vector marker without stimulating the mesh or forgetting it", () => {
    const elapsed = vectorCycle("sway", "normal") * 0.25;
    const on = { kind: "sway" as const, pace: "normal" as const, angle: 0, span: 1, u: 0.5, v: 0.5, radius: 0.25, view: 1 };
    const off = { ...on, u: 0.2, off: true };
    const mixed = vectorMeshShift([on, off], elapsed, 200, 200, 400, 400);
    const alone = vectorMeshShift([on], elapsed, 200, 200, 400, 400);
    assert.ok(Math.abs(mixed.x - alone.x) < 0.001);
    assert.ok(Math.abs(alone.x) > 8);
    assert.equal(vectorMeshShift([off], elapsed, 80, 200, 400, 400).x, 0);
    const puru = [{ kind: "mid" as const, u: 0.5, v: 0.5, radius: 0.25, view: 1 }];
    assert.equal(vectorOnMesh([off], puru, elapsed, 80, 200, 400, 400).x, 0);
    assert.equal(vectorOnMesh([on], [{ ...puru[0]!, off: true }], elapsed, 200, 200, 400, 400).x, 0);
    assert.ok(Math.abs(vectorOnMesh([on], puru, elapsed, 200, 200, 400, 400).x) > 8);
    const saved = normalizeVectorMarkers({
      markers: [
        { id: 4, kind: "shrink", pace: "fast", u: 0.2, v: 0.3, radius: 0.22, angle: 1, span: 1.4, off: true },
        { id: 5, kind: "sway", pace: "slow", u: 0.4, v: 0.4, radius: 0.2, off: false },
      ],
    });
    assert.equal(saved?.[0]?.off, true);
    assert.equal(saved?.[0]?.kind, "shrink");
    assert.equal(saved?.[0]?.pace, "fast");
    assert.equal(saved?.[0]?.span, 1.4);
    assert.equal(saved?.[1]?.off, undefined);
    assert.equal(saved?.[1]?.kind, "sway");
    assert.equal(puruListEntries([{ id: 1, kind: "mid", off: true }])[0]?.off, true);
    assert.equal(puruListEntries([{ id: 1, kind: "mid" }])[0]?.off, false);
    assert.equal(vectorListEntries([{ id: 2, kind: "expand", pace: "normal", off: true }])[0]?.off, true);
  });

  it("keeps a backbeat half of that marker's own period ahead", () => {
    for (const kind of kinds) {
      for (const pace of paces) {
        const cycle = vectorCycle(kind, pace);
        assert.ok(Math.abs(cyclePhase(0, cycle, true) - 0.5) < 1e-9);
        assert.ok(Math.abs(cyclePhase(cycle * 3.25, cycle, true) - 0.75) < 1e-9);
        const base = { ...marker(kind, pace), span: 1, u: 0.5, v: 0.5, radius: 0.25, view: 1 };
        const elapsed = cycle * 1.1;
        if (Math.abs(cycle / 2 - 640) > 1 && Math.abs((640 % cycle) / cycle - 0.5) > 0.06) {
          const beatPhase = cyclePhase(elapsed, cycle, true);
          const fixedPhase = cyclePhase(elapsed + 640, cycle, false);
          const gap = Math.abs(beatPhase - fixedPhase);
          assert.ok(Math.min(gap, 1 - gap) > 0.04, `${kind} ${pace}`);
        }
        if (kind === "expand" || kind === "shrink") {
          const beat = vectorMeshShift([{ ...base, backbeat: true }], elapsed, 280, 200, 400, 400);
          const ahead = vectorMeshShift([base], elapsed + cycle / 2, 280, 200, 400, 400);
          assert.ok(Math.abs(beat.x - ahead.x) < 1e-6, kind + pace);
          assert.ok(Math.abs(beat.y - ahead.y) < 1e-6, kind + pace);
        } else {
          const beat = vectorMotion({ ...base, backbeat: true }, elapsed, 100);
          const ahead = vectorMotion(base, elapsed + cycle / 2, 100);
          assert.ok(Math.abs(beat.x - ahead.x) < 1e-6, kind + pace);
          assert.ok(Math.abs(beat.y - ahead.y) < 1e-6, kind + pace);
        }
      }
    }
    const parked = vectorMeshShift(
      [{ kind: "sway", pace: "normal", angle: 0, span: 1, u: 0.5, v: 0.5, radius: 0.25, view: 1, off: true, backbeat: true }],
      400,
      200,
      200,
      400,
      400,
    );
    assert.equal(parked.x, 0);
    assert.equal(parked.y, 0);
    const saved = normalizeVectorMarkers({
      markers: [
        { id: 1, kind: "orbit", pace: "fast", u: 0.2, v: 0.3, radius: 0.2, angle: 0.2, backbeat: true, off: true },
        { id: 2, kind: "buzz", pace: "slow", u: 0.4, v: 0.5, radius: 0.2, angle: 0 },
        { id: 3, kind: "hit", pace: "normal", u: 0.5, v: 0.5, radius: 0.2, angle: 0, backbeat: false },
      ],
    });
    assert.equal(saved?.[0]?.backbeat, true);
    assert.equal(saved?.[0]?.off, true);
    assert.equal(saved?.[1]?.backbeat, undefined);
    assert.equal(saved?.[2]?.backbeat, undefined);
    const rows = vectorListEntries(saved ?? []);
    assert.equal(rows[0]?.backbeat, true);
    assert.equal(rows[0]?.off, true);
    assert.equal(rows[1]?.backbeat, false);
    const retargeted = retargetVector(saved![0]!, "sway", "slow");
    assert.equal(retargeted.backbeat, true);
    assert.equal(retargeted.off, true);
    assert.equal(retargeted.kind, "sway");
    assert.equal(retargeted.pace, "slow");
  });

  it("moves an old バイブ・遅 onto 反応・遅 and keeps a new バイブ・遅", () => {
    const old = normalizeVectorMarkers({
      markers: [
        { id: 1, kind: "buzz", pace: "slow", u: 0.2, v: 0.3, radius: 0.2, angle: 0 },
        { id: 2, kind: "buzz", pace: "normal", u: 0.3, v: 0.3, radius: 0.2, angle: 0 },
        { id: 3, kind: "buzz", pace: "fast", u: 0.4, v: 0.3, radius: 0.2, angle: 0 },
      ],
    });
    assert.equal(old?.[0]?.kind, "react");
    assert.equal(old?.[0]?.pace, "slow");
    assert.equal(old?.[1]?.kind, "buzz");
    assert.equal(old?.[1]?.pace, "normal");
    assert.equal(old?.[2]?.kind, "buzz");
    assert.equal(old?.[2]?.pace, "fast");
    const next = normalizeVectorMarkers({
      vibe: VECTOR_VIBE,
      markers: [{ id: 4, kind: "buzz", pace: "slow", u: 0.2, v: 0.2, radius: 0.2, angle: 0 }],
    });
    assert.equal(next?.[0]?.kind, "buzz");
    assert.equal(next?.[0]?.pace, "slow");
    const kept = normalizeVectorMarkers({
      vibe: VECTOR_VIBE,
      markers: [{ id: 5, kind: "react", pace: "fast", u: 0.2, v: 0.2, radius: 0.2, angle: 0.4, backbeat: true }],
    });
    assert.equal(kept?.[0]?.kind, "react");
    assert.equal(kept?.[0]?.pace, "fast");
    assert.equal(kept?.[0]?.backbeat, true);
    const drawn = 100;
    const kick = vectorMotion(marker("react", "slow"), 56, drawn).x;
    const doubled = vectorMotion(marker("react", "normal"), 28, drawn).x;
    const quadrupled = vectorMotion(marker("react", "fast"), 14, drawn).x;
    assert.ok(Math.abs(kick - doubled) < 0.001);
    assert.ok(Math.abs(kick - quadrupled) < 0.001);
    const vibe = vectorMotion(marker("buzz", "normal"), vectorCycle("buzz", "normal") * 0.05, drawn).x;
    const vibeSlow = vectorMotion(marker("buzz", "slow"), vectorCycle("buzz", "slow") * 0.05, drawn).x;
    assert.ok(Math.abs(vibe - vibeSlow) < 0.001);
    assert.ok(Math.abs(vibe - kick) > 1);
  });

  it("pushes one way and slams a hit back to the same center", () => {
    const drawn = 100;
    const at = (kind: "push" | "hit" | "sway", phase: number, angle = 0, span = 1) =>
      vectorMotion({ ...marker(kind, "normal", angle), span }, vectorCycle(kind, "normal") * phase, drawn);
    const push = at("push", 0.5);
    assert.ok(Math.abs(at("push", 0).x) < 0.001);
    assert.ok(Math.abs(at("push", 1).x) < 0.001);
    assert.ok(Math.abs(push.x - drawn * 0.5) < 0.001);
    assert.ok(Math.abs(at("push", 0.25).x - at("push", 0.75).x) < 0.001);
    assert.ok(at("push", 0.25).x > 20 && at("push", 0.25).x < push.x);
    const down = at("push", 0.5, Math.PI / 2);
    assert.ok(down.y > 40 && Math.abs(down.x) < 0.001);
    const left = at("push", 0.5, Math.PI);
    assert.ok(left.x < -40 && Math.abs(left.y) < 0.001);
    assert.ok(Math.abs(at("push", 0.5, 0, 2).x - push.x * 2) < 0.001);
    for (let step = 0; step <= 20; step += 1) {
      assert.ok(at("push", step / 20).x >= -0.001);
      assert.ok(at("hit", step / 20).x >= -0.001);
    }
    const sway = at("sway", 0.75);
    assert.ok(sway.x < -40);
    assert.ok(Math.abs(at("sway", 0.25).x - drawn * 0.46) < 0.001);

    const hold = at("hit", 0.52);
    assert.ok(Math.abs(at("hit", 0).x) < 0.001);
    assert.ok(Math.abs(at("hit", 0.9).x) < 0.001);
    assert.ok(Math.abs(hold.x - drawn * 0.52) < 0.001);
    assert.ok(Math.abs(at("hit", 0.5).x - hold.x) < 0.001);
    const step = (phase: number, width: number) => at("hit", phase + width).x - at("hit", phase).x;
    let pull = 0;
    for (let phase = 0; phase < 0.46; phase += 0.02) pull = Math.max(pull, step(phase, 0.02));
    let slam = 0;
    for (let phase = 0.58; phase < 0.78; phase += 0.02) slam = Math.max(slam, Math.abs(step(phase, 0.02)));
    assert.ok(slam > pull * 1.8);
    const old = normalizeVectorMarkers({
      markers: [{ id: 11, kind: "hit", pace: "slow", u: 0.2, v: 0.4, radius: 0.25, angle: 1.1, span: 1.3 }],
    });
    assert.equal(old?.[0]?.kind, "hit");
    assert.equal(old?.[0]?.pace, "slow");
    assert.equal(old?.[0]?.span, 1.3);
    const saved = normalizeVectorMarkers({
      markers: [{ id: 12, kind: "push", pace: "fast", u: 0.6, v: 0.3, radius: 0.2, angle: 0.4 }],
    });
    assert.equal(saved?.[0]?.kind, "push");
    assert.equal(saved?.[0]?.pace, "fast");
    assert.equal(vectorListEntries(saved ?? [])[0]?.name, "プッシュ");
    assert.equal(vectorListEntries(saved ?? [])[0]?.pace, "速");
    assert.equal(vectorCycle("push", "slow"), 2560);
    assert.equal(vectorCycle("push", "normal"), 1280);
    assert.equal(vectorCycle("push", "fast"), 640);
  });
});
