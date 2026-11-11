import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PURU_KINDS,
  PURU_PC_KINDS,
  PURU_DRAG_PX,
  PURU_GRID,
  PURU_HIT_LIMIT,
  clampView,
  driveFromMotion,
  enqueueHit,
  falloff,
  fillDisplacement,
  hitKick,
  imagePoint,
  imagePointFromPose,
  impulseShift,
  influence,
  markerView,
  nextPuruId,
  normalizePuruMarkers,
  pickMarker,
  pinchRadius,
  pointerIsClick,
  projectImagePoint,
  puruEditHit,
  puruHaloBackground,
  puruKindFace,
  puruReach,
  radiusAtRim,
  viewAtRim,
  restBody,
  sampleShift,
  stepBody,
  stepHits,
  puruMotionSpace,
  PURU_MOTION_REF,
  type ImagePose,
  type PuruHit,
  type PuruKind,
  type PuruMarker,
} from "./purupuru.ts";

const kinds: PuruKind[] = ["firm", "mid", "soft"];

function run(kind: PuruKind, drive: { vx: number; vy: number; dScale: number }, frames: number) {
  let body = restBody();
  for (let i = 0; i < frames; i++) body = stepBody(body, kind, drive, 1 / 60);
  return body;
}

describe("purupuru", () => {
  it("fades from the marker center to the rim", () => {
    assert.equal(falloff(0, 100), 1);
    assert.equal(falloff(100, 100), 0);
    assert.equal(falloff(140, 100), 0);
    assert.ok(falloff(20, 100) > falloff(60, 100));
    assert.ok(falloff(60, 100) > falloff(90, 100));
  });

  it("keeps the shake size apart from how far past the circle the wobble travels", () => {
    const drive = { vx: 180, vy: 0, dScale: 0 };
    const later = kinds.map((kind) => run(kind, drive, 24));
    const peaks = later.map((body) => Math.abs(body.ox));
    for (const peak of peaks) {
      assert.ok(Math.abs(peak - 13.5) < 0.6);
    }
    assert.ok(Math.max(...peaks) - Math.min(...peaks) < 1);
    const marker = (kind: PuruKind, view = 1): PuruMarker => ({ id: 1, kind, u: 0.5, v: 0.5, radius: 0.25, view });
    const body = [{ ...restBody(), ox: 18 }];
    const shift = (kind: PuruKind, x: number, view = 1) => sampleShift([marker(kind, view)], body, x, 200, 400, 400).x;
    assert.ok(Math.abs(shift("firm", 200) - 18) < 0.01);
    assert.ok(shift("firm", 300) > 0);
    assert.equal(shift("firm", 320), 0);
    assert.ok(shift("mid", 320) > shift("firm", 320));
    assert.equal(shift("mid", 360), 0);
    assert.ok(shift("soft", 360) > 0);
    assert.equal(shift("soft", 400), 0);
    assert.ok(shift("mid", 300) > shift("firm", 300));
    assert.ok(shift("soft", 330) > shift("mid", 330));
    assert.equal(shift("soft", 320, 0.5), 0);
    assert.ok(shift("soft", 240, 0.5) > 0);
    assert.ok(influence(100, 100, "firm") > 0);
    assert.ok(influence(100, 100, "mid") > influence(100, 100, "firm"));
    assert.ok(influence(100, 100, "soft") > influence(100, 100, "mid"));
    assert.equal(influence(130, 100, "firm"), 0);
    assert.ok(influence(130, 100, "mid") > 0);
    assert.ok(influence(160, 100, "soft") > 0);
    assert.equal(influence(160, 100, "mid"), 0);
    assert.equal(influence(200, 100, "soft"), 0);
    assert.ok(influence(40, 100, "soft") > influence(80, 100, "soft"));
    assert.equal(puruReach("firm"), puruReach("firm-weak"));
    assert.equal(puruReach("firm-low"), puruReach("firm"));
    assert.ok(puruReach("mid") > puruReach("firm"));
    assert.ok(puruReach("soft") > puruReach("mid"));
  });

  it("keeps a weaker kind on the same reach with a smaller shake", () => {
    const drive = { vx: 180, vy: 40, dScale: 0.4 };
    const midScale = (0.175 / 0.75) * 1.3;
    const pairs = [
      ["firm", "firm-weak", midScale],
      ["mid", "mid-weak", midScale],
      ["soft", "soft-weak", midScale],
      ["firm", "firm-low", midScale * 0.7],
      ["mid", "mid-low", midScale * 0.7],
      ["soft", "soft-low", midScale * 0.7],
    ] as const;
    const marker = (kind: PuruKind): PuruMarker => ({ id: 1, kind, u: 0.5, v: 0.5, radius: 0.25 });
    const same = [{ ...restBody(), ox: 18 }];
    for (const [normal, weak, expected] of pairs) {
      const strong = run(normal, drive, 24);
      const gentle = run(weak, drive, 24);
      const ratio = Math.abs(gentle.ox) / Math.abs(strong.ox);
      assert.ok(Math.abs(ratio - expected) < 0.04);
      assert.ok(Math.abs(Math.abs(gentle.os) / Math.abs(strong.os) - expected) < 0.04);
      for (const x of [200, 235, 250, 270, 280, 292, 300, 330]) {
        const wide = sampleShift([marker(normal)], same, x, 200, 400, 400);
        const quiet = sampleShift([marker(weak)], same, x, 200, 400, 400);
        assert.equal(quiet.x, wide.x);
        assert.equal(quiet.y, wide.y);
      }
    }
    const medium = run("firm-weak", drive, 24);
    const low = run("firm-low", drive, 24);
    assert.ok(Math.abs(Math.abs(low.ox) / Math.abs(medium.ox) - 0.7) < 0.04);
  });

  it("keeps the phone spring cap and lets a larger picture follow the same travel", () => {
    assert.equal(puruMotionSpace(320, false), 1);
    assert.equal(puruMotionSpace(900, false), 1);
    assert.equal(puruMotionSpace(0, true), 1);
    assert.equal(puruMotionSpace(PURU_MOTION_REF, true), 1);
    const drive = { vx: 140, vy: -90, dScale: 0.4 };
    const phone = run("firm", drive, 90);
    let wide = restBody();
    for (let i = 0; i < 90; i++) wide = stepBody(wide, "firm", drive, 1 / 60, 2);
    assert.ok(Math.abs(phone.ox) < 13.6);
    assert.ok(Math.abs(wide.ox) > Math.abs(phone.ox) * 1.8);
    assert.ok(Math.abs(wide.ox) < 13.5 * 2 + 0.2);
    assert.ok(Math.abs(wide.os - phone.os) < 0.002);
  });

  it("settles after the whole image stops, and ignores a jumped clock", () => {
    assert.deepEqual(driveFromMotion({ x: 10, y: 0, scale: 1, t: 1000 }, { x: 10, y: 0, scale: 1, t: 1016 }, 1100), {
      vx: 0,
      vy: 0,
      dScale: 0,
    });
    const moving = driveFromMotion({ x: 0, y: 0, scale: 1, t: 1000 }, { x: 4, y: -2, scale: 1.02, t: 1016 }, 1020);
    assert.ok(moving.vx > 100);
    assert.ok(moving.vy < 0);
    assert.ok(moving.dScale > 0);
    assert.deepEqual(driveFromMotion({ x: 0, y: 0, scale: 1, t: 1000 }, { x: 400, y: 0, scale: 1, t: 1016 }, 1020), {
      vx: 0,
      vy: 0,
      dScale: 0,
    });
  });

  it("deforms the center, fades outward, and does not stack overlaps without limit", () => {
    const markers: PuruMarker[] = [
      { id: 1, kind: "soft", u: 0.5, v: 0.5, radius: 0.3 },
      { id: 2, kind: "firm", u: 0.5, v: 0.5, radius: 0.3 },
    ];
    const one = sampleShift(markers.slice(0, 1), [{ ...restBody(), ox: 30 }], 200, 200, 400, 400);
    assert.ok(Math.abs(one.x - 30) < 0.01);
    const outside = sampleShift(markers.slice(0, 1), [{ ...restBody(), ox: 30 }], 20, 20, 400, 400);
    assert.equal(outside.x, 0);
    const stacked = sampleShift(markers, [
      { ...restBody(), ox: 30 },
      { ...restBody(), ox: 10 },
    ], 200, 200, 400, 400);
    assert.ok(Math.abs(stacked.x - 20) < 0.01);
    const colors = new Set(PURU_KINDS.map((kind) => kind.color));
    assert.equal(PURU_KINDS.length, 9);
    assert.equal(colors.size, 3);
    assert.deepEqual(
      PURU_KINDS.map((kind) => kind.id),
      ["firm-low", "mid-low", "soft-low", "firm-weak", "mid-weak", "soft-weak", "firm", "mid", "soft"],
    );
    assert.deepEqual(
      PURU_KINDS.map((kind) => kind.short),
      ["狭弱", "普弱", "広弱", "狭中", "普中", "広中", "狭強", "普強", "広強"],
    );
    assert.equal(PURU_PC_KINDS, PURU_KINDS);
    const halo = puruHaloBackground("#3DDC97", "mid");
    assert.match(halo, /rgba\(61, 220, 151, 0\.400\)/);
    assert.match(halo, /rgba\(61, 220, 151, 0\.000\) 100\.00%/);
    assert.equal(puruHaloBackground("#FF4F9A", "soft").includes("255, 79, 154"), true);
    assert.equal(puruKindFace("firm", true).short, "狭強");
    assert.equal(puruKindFace("soft", false).label, "広い・強");
    assert.equal(puruKindFace("firm-weak", true).short, "狭中");
    assert.equal(puruKindFace("firm-low", false).short, "狭弱");
    assert.equal(puruKindFace("mid", true).short, "普強");
  });

  it("picks the nearest handle and ignores empty taps", () => {
    const markers: PuruMarker[] = [
      { id: 1, kind: "firm", u: 0.2, v: 0.2, radius: 0.2 },
      { id: 2, kind: "soft", u: 0.7, v: 0.6, radius: 0.2 },
    ];
    assert.equal(pickMarker(markers, 0.22, 0.2, 400, 400), 1);
    assert.equal(pickMarker(markers, 0.72, 0.58, 400, 400), 2);
    assert.equal(pickMarker(markers, 0.45, 0.9, 400, 400), null);
  });

  it("keeps a dragged point on the image and rejects a release outside it", () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 };
    const inside = imagePoint(110, 70, rect);
    assert.equal(inside.inside, true);
    assert.ok(Math.abs(inside.u - 0.5) < 0.001);
    assert.ok(Math.abs(inside.v - 0.5) < 0.001);
    assert.equal(imagePoint(0, 70, rect).inside, false);
    assert.equal(imagePoint(210, 20, rect).inside, true);
  });

  it("moves inside the circle and resizes from any of the four handles", () => {
    assert.equal(radiusAtRim(0, 1, 400), 0.12);
    assert.ok(Math.abs(radiusAtRim(112, 1, 400) - 0.28) < 0.001);
    assert.equal(radiusAtRim(400, 1, 400), 0.5);
    assert.ok(Math.abs(radiusAtRim(80, 0.5, 400) - 0.4) < 0.001);
    assert.equal(viewAtRim(100, 0.25, 400), 1);
    assert.ok(Math.abs(viewAtRim(50, 0.25, 400) - 0.5) < 0.001);
    assert.equal(viewAtRim(10, 0.25, 400), 0.1);
    assert.equal(viewAtRim(4, 0.25, 400), 0.1);
    assert.equal(viewAtRim(400, 0.25, 400), 1);
    const markers: PuruMarker[] = [
      { id: 1, kind: "firm", u: 0.3, v: 0.5, radius: 0.2 },
      { id: 2, kind: "soft", u: 0.75, v: 0.5, radius: 0.15 },
    ];
    const rect = { left: 0, top: 0, width: 400, height: 400 };
    const rim = 0.2 * 400;
    const cx = 120;
    const cy = 200;
    for (const [x, y] of [
      [cx, cy - rim],
      [cx + rim, cy],
      [cx, cy + rim],
      [cx - rim, cy],
    ]) {
      assert.deepEqual(puruEditHit(markers, 1, x, y, rect), { action: "resize", id: 1 });
    }
    assert.deepEqual(puruEditHit(markers, 1, cx + rim - 8, cy, rect), { action: "resize", id: 1 });
    assert.deepEqual(puruEditHit(markers, 1, cx + 20, cy, rect), { action: "move", id: 1 });
    assert.deepEqual(puruEditHit(markers, 1, cx, cy, rect), { action: "move", id: 1 });
    assert.deepEqual(puruEditHit(markers, 1, 300, cy, rect), { action: "move", id: 2 });
    assert.equal(puruEditHit(markers, null, 20, 20, rect), null);
  });

  it("resizes only within the radius limits", () => {
    assert.ok(Math.abs(pinchRadius(0.2, 100, 150) - 0.3) < 0.001);
    assert.equal(pinchRadius(0.4, 100, 400), 0.5);
    assert.equal(pinchRadius(0.2, 100, 20), 0.12);
  });

  it("shrinks the drawn circle down to a tenth and pulls the wobble in with it", () => {
    assert.equal(clampView(1), 1);
    assert.equal(clampView(0.5), 0.5);
    assert.equal(clampView(0.1), 0.1);
    assert.equal(clampView(0.04), 0.1);
    assert.equal(clampView(2), 1);
    assert.equal(clampView(Number.NaN), 1);
    assert.equal(markerView({}), 1);
    assert.equal(markerView({ view: 0.1 }), 0.1);
    const marker = (view?: number): PuruMarker => ({ id: 1, kind: "mid", u: 0.5, v: 0.5, radius: 0.25, view });
    const body = [{ ...restBody(), ox: 18 }];
    const full = sampleShift([marker(1)], body, 230, 200, 400, 400);
    const tenth = sampleShift([marker(0.1)], body, 230, 200, 400, 400);
    const tenthCenter = sampleShift([marker(0.1)], body, 200, 200, 400, 400);
    assert.ok(full.x > 10);
    assert.equal(tenth.x, 0);
    assert.ok(Math.abs(tenthCenter.x - 18) < 0.01);
    assert.equal(marker(0.1).radius, marker(1).radius);
    assert.equal(pickMarker([marker(0.1)], 0.55, 0.5, 400, 400), pickMarker([marker(1)], 0.55, 0.5, 400, 400));
  });

  it("keeps a saved layout on its own image and drops a broken row", () => {
    const saved = normalizePuruMarkers({
      markers: [
        { id: 2, kind: "soft", u: 0.2, v: 1.4, radius: 0.3, view: 0.2 },
        { id: 2, kind: "firm", u: 0.9, v: 0.9, radius: 0.2 },
        { id: "x", kind: "firm", u: 0.5, v: 0.5, radius: 0.2 },
        { id: 3, kind: "nope", u: 0.5, v: 0.5, radius: 0.2 },
      ],
    });
    assert.equal(saved?.length, 1);
    assert.equal(saved?.[0]?.id, 2);
    assert.equal(saved?.[0]?.kind, "soft");
    assert.equal(saved?.[0]?.u, 0.2);
    assert.equal(saved?.[0]?.v, 1);
    assert.equal(saved?.[0]?.radius, 0.3);
    assert.equal(saved?.[0]?.view, 0.2);
    assert.deepEqual(normalizePuruMarkers({ markers: [] }), []);
    assert.equal(normalizePuruMarkers(undefined), null);
    assert.equal(normalizePuruMarkers({ markers: "no" }), null);
    let list: PuruMarker[] = [
      { id: 1, kind: "firm", u: 0.2, v: 0.2, radius: 0.2 },
      { id: 4, kind: "soft", u: 0.8, v: 0.3, radius: 0.2 },
    ];
    const before = list.map((marker) => ({ ...marker }));
    for (let i = 0; i < 12; i += 1) {
      const id = nextPuruId(list);
      list = [...list, { id, kind: "mid", u: (i + 1) / 20, v: 0.6, radius: 0.28, view: 1 }];
    }
    assert.equal(list.length, 14);
    assert.equal(new Set(list.map((marker) => marker.id)).size, 14);
    assert.deepEqual(list.slice(0, 2), before);
    assert.equal(nextPuruId(list), 17);
    assert.equal(nextPuruId([]), 1);
  });

  it("fades a still marker across the same reach as a normal marker", () => {
    const drive = { vx: 180, vy: 40, dScale: 0.4 };
    const held = run("still", drive, 24);
    assert.equal(held.ox, 0);
    assert.equal(held.oy, 0);
    assert.equal(held.os, 0);
    assert.equal(puruReach("still"), puruReach("mid"));
    assert.equal(puruReach("firm"), 1.12);
    assert.equal(puruReach("mid"), 1.45);
    assert.equal(puruReach("soft"), 1.9);
    for (const dist of [0, 40, 100, 130, 145, 160]) {
      assert.equal(influence(dist, 100, "still"), influence(dist, 100, "mid"));
    }
    assert.equal(influence(0, 100, "still"), 1);
    assert.equal(influence(145, 100, "still"), 0);
    assert.ok(influence(100, 100, "still") > influence(130, 100, "still"));
    assert.ok(influence(130, 100, "still") > 0);
    const soft: PuruMarker = { id: 1, kind: "soft", u: 0.5, v: 0.5, radius: 0.3 };
    const pin: PuruMarker = { id: 2, kind: "still", u: 0.5, v: 0.5, radius: 0.15 };
    const body = [{ ...restBody(), ox: 30 }];
    const drawn = 0.15 * 400;
    const at = (x: number) => {
      const open = sampleShift([soft], body, x, 200, 400, 400).x;
      const quiet = sampleShift([soft, pin], [...body, restBody()], x, 200, 400, 400).x;
      const dist = Math.abs(x - 200);
      return { open, quiet, hold: influence(dist, drawn, "mid") };
    };
    const center = at(200);
    assert.equal(center.quiet, 0);
    const inner = at(220);
    assert.ok(Math.abs(inner.quiet - inner.open * (1 - inner.hold)) < 0.02);
    assert.ok(inner.hold > 0.8);
    const rim = at(260);
    const past = at(280);
    const clear = at(330);
    assert.ok(rim.quiet > inner.quiet);
    assert.ok(past.quiet > rim.quiet);
    assert.ok(past.quiet < past.open);
    assert.ok(Math.abs(clear.quiet - clear.open) < 0.02);
    const again = { ...pin, id: 3 };
    assert.equal(sampleShift([soft, pin, again], [...body, restBody(), restBody()], 240, 200, 400, 400).x, sampleShift([soft, pin], [...body, restBody()], 240, 200, 400, 400).x);
    const midOnly = sampleShift([{ id: 1, kind: "mid", u: 0.5, v: 0.5, radius: 0.25 }], body, 200, 200, 400, 400).x;
    assert.ok(Math.abs(midOnly - 30) < 0.01);
    const tiny: PuruMarker = { ...pin, view: 0.1 };
    assert.equal(sampleShift([soft, tiny], [body[0]!, restBody()], 200, 200, 400, 400).x, 0);
    assert.ok(sampleShift([soft, tiny], [body[0]!, restBody()], 220, 200, 400, 400).x > 5);
    const saved = normalizePuruMarkers({ markers: [{ id: 9, kind: "still", u: 0.4, v: 0.6, radius: 0.2, view: 0.5 }] });
    assert.equal(saved?.[0]?.kind, "still");
    assert.equal(saved?.[0]?.view, 0.5);
    assert.equal(saved?.[0]?.u, 0.4);
    assert.equal(puruKindFace("still", true).label, "不動");
    assert.equal(puruKindFace("still", false).short, "不動");
    assert.equal(puruKindFace("still").hint, "円の少し外側まで、動きを抑える");
    assert.equal(PURU_KINDS.some((kind) => kind.id === "still"), false);
  });
});

function restPose(over: Partial<ImagePose> = {}): ImagePose {
  return {
    width: 400,
    height: 300,
    left: 20,
    top: 40,
    perspective: 720,
    pullX: 0,
    pullY: 0,
    rx: 0,
    ry: 0,
    shakeX: 0,
    shakeY: 0,
    shakeR: 0,
    fxX: 0,
    fxY: 0,
    fxR: 0,
    fxS: 1,
    ...over,
  };
}

function expectRoundtrip(pose: ImagePose, u: number, v: number) {
  const screen = projectImagePoint(u * pose.width, v * pose.height, pose);
  assert.ok(screen, `projected ${u},${v}`);
  const back = imagePointFromPose(screen!.x, screen!.y, pose);
  assert.equal(back.inside, true);
  assert.ok(Math.abs(back.u - u) < 0.004, `u ${back.u} vs ${u}`);
  assert.ok(Math.abs(back.v - v) < 0.004, `v ${back.v} vs ${v}`);
}

describe("click impulse", () => {
  it("keeps the 6px line between a click and a drag", () => {
    assert.equal(PURU_DRAG_PX, 6);
    assert.equal(pointerIsClick(0, 0), true);
    assert.equal(pointerIsClick(5.9, 0), true);
    assert.equal(pointerIsClick(0, 4), true);
    assert.equal(pointerIsClick(6, 0), false);
    assert.equal(pointerIsClick(5, 5), false);
    assert.equal(pointerIsClick(20, 1), false);
  });

  it("maps a click through tilt, pull, and animation back onto the same pixel", () => {
    const spots = [
      [0.5, 0.5],
      [0, 0],
      [1, 1],
      [0, 0.5],
      [1, 0.2],
      [0.15, 1],
      [0.82, 0.08],
    ] as const;
    const poses = [
      restPose(),
      restPose({ perspective: 0 }),
      restPose({ fxS: 1.65, fxR: 28, fxX: 36, fxY: -22 }),
      restPose({ rx: 24, ry: -30, pullX: 16, pullY: -9 }),
      restPose({ rx: 45, ry: 0, pullX: 0, pullY: 12 }),
      restPose({ shakeX: 8, shakeY: -6, shakeR: 12, fxS: 0.8, fxR: -18, fxX: -20, fxY: 14, rx: 12, ry: 20, pullX: -10, pullY: 7 }),
    ];
    for (const pose of poses) {
      for (const [u, v] of spots) expectRoundtrip(pose, u, v);
    }
    const pose = restPose();
    assert.equal(imagePointFromPose(pose.left - 40, pose.top + pose.height / 2, pose).inside, false);
    assert.equal(imagePointFromPose(pose.left + pose.width + 24, pose.top + 8, pose).inside, false);
    const center = projectImagePoint(pose.width / 2, pose.height / 2, pose);
    assert.ok(center);
    assert.ok(Math.abs(center!.x - (pose.left + pose.width / 2)) < 0.01);
    assert.ok(Math.abs(center!.y - (pose.top + pose.height / 2)) < 0.01);
  });

  it("pushes outward from the click, only inside the existing mesh", () => {
    const hit: PuruHit = { u: 0.5, v: 0.5, amp: 30, vel: 0, age: 0.05 };
    const mesh: PuruMarker[] = [{ id: 1, kind: "soft", u: 0.5, v: 0.5, radius: 0.42, view: 1 }];
    const right = impulseShift([hit], 260, 200, 400, 400, mesh);
    const up = impulseShift([hit], 200, 140, 400, 400, mesh);
    const far = impulseShift([hit], 390, 390, 400, 400, mesh);
    assert.ok(right.x > 8);
    assert.ok(Math.abs(right.y) < 1);
    assert.ok(up.y < -8);
    assert.equal(far.x, 0);
    assert.equal(far.y, 0);
    assert.deepEqual(impulseShift([hit], 260, 200, 400, 400, []), { x: 0, y: 0 });
    const elsewhere: PuruMarker[] = [{ id: 2, kind: "mid", u: 0.08, v: 0.08, radius: 0.12, view: 1 }];
    assert.equal(impulseShift([hit], 260, 200, 400, 400, elsewhere).x, 0);
    const leftHit: PuruHit = { u: 0.32, v: 0.5, amp: 30, vel: 0, age: 0.1 };
    const rightHit: PuruHit = { u: 0.72, v: 0.5, amp: 30, vel: 0, age: 0.1 };
    const cover: PuruMarker[] = [{ id: 3, kind: "soft", u: 0.5, v: 0.5, radius: 0.5, view: 1 }];
    const fromLeft = impulseShift([leftHit], 200, 200, 400, 400, cover);
    const fromRight = impulseShift([rightHit], 200, 200, 400, 400, cover);
    assert.ok(fromLeft.x > 4);
    assert.ok(fromRight.x < -4);
    const near = Math.hypot(right.x, right.y);
    const mid = Math.hypot(impulseShift([hit], 310, 200, 400, 400, mesh).x, impulseShift([hit], 310, 200, 400, 400, mesh).y);
    assert.ok(near > mid);
    const huge = impulseShift([{ ...hit, amp: 5000 }], 250, 200, 400, 400, mesh);
    assert.ok(Math.hypot(huge.x, huge.y) <= 400 * 0.16 + 0.05);

    let hits = enqueueHit([], 0.5, 0.5, 400);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.vel, hitKick(400));
    let sawPos = false;
    let sawNeg = false;
    for (let i = 0; i < 140 && hits.length; i++) {
      hits = stepHits(hits, 1 / 60, 400);
      const amp = hits[0]?.amp ?? 0;
      if (amp > 1) sawPos = true;
      if (amp < -1) sawNeg = true;
    }
    assert.equal(hits.length, 0);
    assert.equal(sawPos, true);
    assert.equal(sawNeg, true);
  });

  it("overlaps clicks without resetting or growing without a limit", () => {
    let hits = enqueueHit([], 0.5, 0.5, 400);
    for (let frame = 0; frame < 8; frame++) hits = stepHits(hits, 1 / 60, 400);
    const kept = hits[0]?.amp ?? 0;
    assert.ok(Math.abs(kept) > 1);
    hits = enqueueHit(hits, 0.82, 0.2, 400);
    assert.equal(hits.length, 2);
    assert.ok(Math.abs((hits[0]?.amp ?? 0) - kept) < 0.001);
    const stacked = enqueueHit(hits, 0.5, 0.5, 400);
    assert.equal(stacked.length, 2);
    assert.ok(Math.abs(stacked[0]?.vel ?? 0) <= hitKick(400) * 1.45 + 0.01);
    let many: PuruHit[] = [];
    for (let i = 0; i < 8; i++) many = enqueueHit(many, 0.1 + i * 0.1, 0.7, 400);
    assert.equal(many.length, PURU_HIT_LIMIT);
  });

  it("lets a still marker hold the poke and leaves saved markers untouched", () => {
    const hit: PuruHit[] = [{ u: 0.5, v: 0.5, amp: 40, vel: 0, age: 0.08 }];
    const pin: PuruMarker = { id: 4, kind: "still", u: 0.5, v: 0.5, radius: 0.22, view: 1 };
    const saved = [{ ...pin }];
    const out = new Float32Array(PURU_GRID * PURU_GRID * 2);
    const bare = new Float32Array(PURU_GRID * PURU_GRID * 2);
    fillDisplacement([], [], 400, 400, bare, null, hit);
    const softMesh: PuruMarker = { id: 8, kind: "soft", u: 0.5, v: 0.5, radius: 0.4, view: 1 };
    const openMesh = new Float32Array(PURU_GRID * PURU_GRID * 2);
    fillDisplacement([softMesh], [restBody()], 400, 400, openMesh, null, hit);
    fillDisplacement(saved, [restBody()], 400, 400, out, null, hit);
    assert.equal(impulseShift(hit, 260, 200, 400, 400, []).x, 0);
    const at = (grid: Float32Array, col: number, row: number) => {
      const index = (row * PURU_GRID + col) * 2;
      return Math.hypot(grid[index] ?? 0, grid[index + 1] ?? 0);
    };
    const mid = Math.round((PURU_GRID - 1) / 2);
    const around = at(openMesh, mid + 2, mid);
    const held = at(out, mid + 2, mid);
    const bareAround = at(bare, mid + 2, mid);
    assert.equal(bareAround, 0);
    assert.ok(around > 4);
    assert.ok(held < around * 0.35);
    assert.ok(at(out, mid, mid) <= at(openMesh, mid, mid));
    const farCol = PURU_GRID - 2;
    assert.ok(Math.abs(at(out, farCol, mid) - at(bare, farCol, mid)) < 0.05);
    assert.deepEqual(saved, [pin]);
    const soft: PuruMarker = { id: 1, kind: "mid", u: 0.15, v: 0.5, radius: 0.2 };
    const body = { ...restBody(), ox: 20 };
    const markerOnly = new Float32Array(PURU_GRID * PURU_GRID * 2);
    const both = new Float32Array(PURU_GRID * PURU_GRID * 2);
    fillDisplacement([soft], [body], 400, 400, markerOnly, null, null);
    fillDisplacement([soft], [body], 400, 400, both, null, [{ u: 0.8, v: 0.5, amp: 28, vel: 0, age: 0.05 }]);
    const left = (grid: Float32Array) => at(grid, 4, mid);
    const right = (grid: Float32Array) => at(grid, PURU_GRID - 5, mid);
    assert.ok(Math.abs(left(both) - left(markerOnly)) < 0.5);
    assert.ok(Math.abs(right(both) - right(markerOnly)) < 0.5);
    const onMesh = new Float32Array(PURU_GRID * PURU_GRID * 2);
    fillDisplacement([soft], [body], 400, 400, onMesh, null, [{ u: 0.15, v: 0.5, amp: 28, vel: 0, age: 0.05 }]);
    assert.ok(left(onMesh) > left(markerOnly) + 1);
  });
});
