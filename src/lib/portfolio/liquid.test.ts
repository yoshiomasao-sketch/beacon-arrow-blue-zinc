import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import {
  LIQUID_ASSET_IDS,
  LIQUID_EXTEND_SECONDS,
  LIQUID_FADE_DELAY,
  LIQUID_FADE_SECONDS,
  LIQUID_FLASH,
  LIQUID_HINGE,
  liquidSheetAspect,
  acceptsLiquidImage,
  liquidSheetBox,
  liquidRangeFade,
  liquidRangeFadeAt,
  liquidRangePixelFade,
  liquidRangeUnface,
  liquidRangeFace,
  liquidRangeHeading,
  writeLiquidFadeMask,
  liquidRangeHit,
  liquidRangeLeanPoint,
  liquidHideCircle,
  liquidHideResize,
  liquidHidesVisibility,
  liquidHideVisibility,
  liquidShapeHit,
  normalizeLiquidHides,
  writeLiquidHideMask,
  LIQUID_HIDE_BAND,
  liquidRangeInside,
  liquidRangeLeanDrag,
  liquidRangeLean,
  liquidRangePitch,
  liquidRangeMove,
  liquidRangeResize,
  liquidRangeTurn,
  liquidRangeCorners,
  liquidRangeViewCorners,
  liquidRangeBake,
  liquidRangeCorner,
  liquidRangeEdge,
  liquidRangePivot,
  liquidRangeSpin,
  liquidRangeDeformed,
  LIQUID_TILT_LIMIT,
  normalizeLiquidRange,
  normalizeLiquidRanges,
  LIQUID_TIP,
  LIQUID_TOP_RATIO,
  LIQUID_WAVE_HZ,
  clearLiquid,
  emptyLiquid,
  liquidBusy,
  liquidBagSize,
  liquidExtendRate,
  liquidFlashAlpha,
  liquidFlashDuration,
  liquidFreeRatio,
  liquidGroupCap,
  liquidLife,
  liquidOverlayFlash,
  liquidShowDelay,
  liquidTimeFade,
  liquidTipAlpha,
  meshEdges,
  meshColumns,
  meshY,
  placeLiquid,
  resetLiquidBag,
  stepLiquid,
  stickAim,
  stickKnob,
  strandGain,
  strandStretch,
  strandY,
  takeLiquidDrips,
  type LiquidGroup,
  type LiquidSprite,
  type LiquidWorld,
} from "./liquid.ts";

const assetDir = new URL("../../../reference/liquid-assets/", import.meta.url);
const lumaDir = new URL("../../../reference/liquid-assets/luma-white/", import.meta.url);
const manualDir = new URL("../../../reference/liquid-assets/manual-source/", import.meta.url);
const extendedDir = new URL("../../../reference/liquid-assets/extended/", import.meta.url);
const jpegDir = new URL("../../../reference/", import.meta.url);

function reveal(group: LiquidGroup, world: LiquidWorld) {
  group.showAt = world.time;
  for (const sprite of group.sprites) sprite.showAt = world.time;
}

describe("liquid", () => {
  it("offers the droplet to a playing GIF and not to video", () => {
    assert.equal(acceptsLiquidImage({ mime: "image/gif" }), true);
    assert.equal(acceptsLiquidImage({ mime: "image/webp" }), true);
    assert.equal(acceptsLiquidImage({ mime: "image/png" }), true);
    assert.equal(acceptsLiquidImage({ mime: "image/jpeg" }), true);
    assert.equal(acceptsLiquidImage({ mime: "video/mp4" }), false);
    assert.equal(acceptsLiquidImage({ mime: "video/webm" }), false);
    assert.equal(acceptsLiquidImage(null), false);
  });

  it("aims the stick from the middle of the photo out to the edges", () => {
    const mid = stickAim(0, 0);
    assert.ok(Math.abs(mid.u - 0.5) < 1e-6 && Math.abs(mid.v - 0.5) < 1e-6);
    const up = stickAim(0, -1);
    assert.ok(Math.abs(up.u - 0.5) < 1e-6 && up.v < 0.02);
    const right = stickAim(1, 0);
    assert.ok(right.u > 0.98 && Math.abs(right.v - 0.5) < 1e-6);
    const corner = stickAim(1, 1);
    assert.ok(corner.u > 0.98 && corner.v > 0.98);
    const past = stickKnob(300, 0, 80);
    assert.ok(Math.abs(past.x - 80) < 1e-6 && Math.abs(past.nx - 1) < 1e-6);
    const out = stickKnob(80, 80, 50);
    assert.ok(Math.hypot(out.x, out.y) <= 50.01);
  });

  it("reads the seven cutout sheets and leaves the older folders alone", () => {
    resetLiquidBag();
    assert.equal(LIQUID_ASSET_IDS.length, 7);
    const names = LIQUID_ASSET_IDS.map((id) => `${id}.png`);
    for (const name of names) {
      const stat = fs.statSync(new URL(name, assetDir));
      assert.ok(stat.size > 1000);
    }
    const luma = fs.readdirSync(lumaDir).filter((name) => name.endsWith(".png"));
    assert.equal(luma.length, 5);
    const manual = fs.readdirSync(manualDir).filter((name) => name.endsWith(".png"));
    assert.equal(manual.length, 5);
    const extended = fs.readdirSync(extendedDir).filter((name) => name.endsWith(".png"));
    assert.equal(extended.length, 12);
    const uv = fs.readdirSync(new URL("../../../reference/liquid-assets/uv-fade/", import.meta.url)).filter((name) => name.endsWith(".png"));
    assert.equal(uv.length, 10);
    for (let i = 1; i <= 5; i++) {
      const buf = fs.readFileSync(new URL(`liquid_source_${String(i).padStart(2, "0")}.jpg`, jpegDir));
      assert.equal(buf[0], 0xff);
      assert.equal(buf[1], 0xd8);
      assert.ok(buf.length > 1000);
    }
  });

  it("fits one sheet to the image width and pins its top, on both screens", () => {
    for (const phone of [false, true]) {
      const world = emptyLiquid(phone);
      world.aspect = phone ? 0.62 : 1.35;
      const group = placeLiquid(world, 0.12, 0.88);
      assert.ok(group);
      assert.equal(group.sprites.length, 1);
      const sprite = group.sprites[0] as LiquidSprite;
      assert.equal(sprite.w, 1);
      assert.equal(sprite.u, 0.5);
      assert.equal(sprite.rotation, 0);
      assert.equal(sprite.flip, false);
      assert.equal(sprite.extend, 0);
      const expectedH = world.aspect / liquidSheetAspect(sprite.asset);
      assert.ok(Math.abs(sprite.h - expectedH) < 1e-9);
      assert.ok(Math.abs(sprite.v - sprite.h / 2) < 1e-9);
      assert.ok(sprite.asset.startsWith("liquid_cutout_test"));
      assert.equal(world.aimU, 0.12);
      assert.equal(world.aimV, 0.88);
    }
    const world = emptyLiquid(false);
    world.aspect = 0.8;
    const first = placeLiquid(world, 0.2, 0.2);
    assert.ok(first);
    const before = first.sprites[0]!.extend;
    const second = placeLiquid(world, 0.8, 0.8);
    assert.ok(second);
    assert.equal(world.groups.length, 2);
    assert.equal(first.sprites[0]!.extend, before);
    assert.notEqual(first.id, second.id);
  });

  it("fits a sheet inside a launch box and fades its rim", () => {
    const asset = "liquid_cutout_test" as const;
    const aspect = 1;
    const open = liquidSheetBox(asset, aspect, null);
    assert.equal(open.w, 1);
    assert.equal(open.u, 0.5);
    assert.ok(Math.abs(open.v - open.h / 2) < 1e-9);
    const wide = { x: 0.1, y: 0.2, w: 0.8, h: 0.7 };
    const narrow = { x: 0.2, y: 0.2, w: 0.3, h: 0.25 };
    const big = liquidSheetBox(asset, aspect, wide);
    const small = liquidSheetBox(asset, aspect, narrow);
    assert.ok(big.w > small.w);
    assert.ok(big.h > small.h);
    assert.ok(Math.abs(big.w / big.h - liquidSheetAspect(asset) / aspect) < 1e-9);
    assert.ok(Math.abs(small.w - narrow.w) < 1e-9);
    assert.ok(small.h > narrow.h);
    assert.ok(Math.abs(small.v - small.h / 2 - narrow.y) < 1e-9);
    assert.ok(Math.abs(small.u - (narrow.x + narrow.w / 2)) < 1e-9);
    const tall = { x: 0.2, y: 0.1, w: 0.2, h: 0.7 };
    const tallSheet = liquidSheetBox(asset, aspect, tall);
    assert.ok(Math.abs(tallSheet.h - tall.h) < 1e-9);
    assert.ok(tallSheet.w > tall.w);
    assert.ok(Math.abs(tallSheet.w / tallSheet.h - liquidSheetAspect(asset) / aspect) < 1e-9);
    const kept = normalizeLiquidRange({ x: -0.2, y: 0.1, w: 2, h: 0.4 });
    assert.equal(kept?.x, -0.2);
    assert.equal(kept?.y, 0.1);
    assert.equal(kept?.w, 2);
    assert.equal(kept?.h, 0.4);
    assert.equal(normalizeLiquidRange({ x: 0.2, y: 0.2, w: 0.01, h: 0.5 }), null);
    assert.equal(normalizeLiquidRange(null), null);
    assert.equal(liquidRangeFade(-1, 50, { x: 0, y: 0, w: 1, h: 1 }, 100, 100), 0);
    assert.equal(liquidRangeFade(0, 50, { x: 0, y: 0, w: 1, h: 1 }, 100, 100), 0);
    assert.equal(liquidRangeFade(50, 50, { x: 0, y: 0, w: 1, h: 1 }, 100, 100), 1);
    const edge = liquidRangeFade(2, 50, { x: 0, y: 0, w: 1, h: 1 }, 100, 100);
    assert.ok(edge > 0 && edge < 1);
    const corner = liquidRangeFade(2, 2, { x: 0, y: 0, w: 1, h: 1 }, 100, 100);
    const top = liquidRangeFade(50, 2, { x: 0, y: 0, w: 1, h: 1 }, 100, 100);
    assert.ok(corner < edge);
    assert.ok(Math.abs(corner - Math.min(edge, top)) < 1e-9);
    assert.ok(corner > edge * top);
    const inner = liquidRangeFade(8, 50, { x: 0, y: 0, w: 1, h: 1 }, 100, 100);
    assert.equal(inner, 1);
    assert.equal(normalizeLiquidRange({ x: 0.2, y: 0.2, w: 0.4, h: 0.3 })?.angle, 0);
    const spun = { x: 0.3, y: 0.4, w: 0.4, h: 0.2, angle: Math.PI / 2 };
    const keptTurn = normalizeLiquidRange(spun);
    assert.ok(keptTurn);
    assert.ok(Math.abs((keptTurn?.angle ?? 0) - Math.PI / 2) < 1e-4);
    const overshot = normalizeLiquidRange({ x: 0.05, y: 0.3, w: 0.9, h: 0.2, angle: Math.PI / 2 });
    assert.equal(overshot?.x, 0.05);
    assert.equal(overshot?.w, 0.9);
    assert.ok(Math.abs((overshot?.angle ?? 0) - Math.PI / 2) < 1e-4);
    assert.equal(normalizeLiquidRange({ x: 9, y: 0.1, w: 0.2, h: 0.2 }), null);
    assert.equal(normalizeLiquidRange({ x: 0.1, y: 0.1, w: 9, h: 0.2 }), null);
    assert.equal(liquidRangeFade(50, 50, spun, 100, 100), 1);
    assert.equal(liquidRangeFade(35, 50, spun, 100, 100), 0);
    const flat = liquidSheetBox(asset, aspect, { x: 0.2, y: 0.35, w: 0.5, h: 0.25, angle: 0 });
    const turned = liquidSheetBox(asset, aspect, { x: 0.2, y: 0.35, w: 0.5, h: 0.25, angle: Math.PI / 2 });
    assert.equal(flat.w, turned.w);
    assert.equal(flat.h, turned.h);
    assert.equal(flat.angle, 0);
    assert.ok(Math.abs(turned.angle - Math.PI / 2) < 1e-9);
    assert.ok(Math.abs(flat.u - turned.u) > 1e-4 || Math.abs(flat.v - turned.v) > 1e-4);
    const base = { x: 0.2, y: 0.2, w: 0.3, h: 0.3, angle: 0 };
    const grown = liquidRangeResize(base, 2, 0.7, 0.4);
    assert.ok(Math.abs(grown.w - 0.7) < 1e-9);
    assert.ok(Math.abs(grown.h - 0.1) < 1e-9);
    assert.ok(Math.abs(grown.x + grown.w / 2 - 0.35) < 1e-9);
    assert.ok(Math.abs(grown.y + grown.h / 2 - 0.35) < 1e-9);
    assert.ok(grown.w > base.w);
    assert.ok(grown.h < base.h);
    assert.notEqual(grown.w / grown.h, base.w / base.h);
    assert.equal(grown.id, undefined);
    const named = liquidRangeResize({ ...base, id: 4 }, 2, 0.7, 0.4);
    assert.equal(named.id, 4);
    const slid = liquidRangeMove(base, 0.1, 0.05);
    assert.ok(Math.abs(slid.x - 0.3) < 1e-9);
    assert.ok(Math.abs(slid.w - base.w) < 1e-9);
    const blocked = liquidRangeMove(base, 5, 0);
    assert.ok(Math.abs(blocked.x - 5.2) < 1e-9);
    assert.ok(Math.abs(blocked.y - base.y) < 1e-9);
    assert.equal(liquidRangeInside(blocked, 0), false);
    assert.ok(Math.abs(blocked.w - base.w) < 1e-9);
    const shoved = liquidRangeMove({ x: 0.3, y: 0.4, w: 0.4, h: 0.2, angle: Math.PI / 2 }, 5, 5);
    assert.ok(Math.abs(shoved.x - 5.3) < 1e-9);
    assert.ok(Math.abs(shoved.y - 5.4) < 1e-9);
    assert.equal(shoved.w, 0.4);
    assert.equal(shoved.h, 0.2);
    const stretched = liquidRangeResize(base, 2, 5, 5);
    assert.equal(liquidRangeInside(stretched, 0), false);
    assert.ok(Math.abs(stretched.x + stretched.w / 2 - 0.35) < 1e-9);
    assert.ok(Math.abs(stretched.y + stretched.h / 2 - 0.35) < 1e-9);
    assert.ok(Math.abs(stretched.w - 8) < 1e-9);
    assert.ok(Math.abs(stretched.h - 8) < 1e-9);
    const roomy = { x: 0.3, y: 0.35, w: 0.4, h: 0.3, angle: 0 };
    const rotated = liquidRangeTurn(roomy, 0.4);
    assert.ok(rotated);
    assert.equal(rotated?.w, roomy.w);
    assert.equal(rotated?.h, roomy.h);
    const leftPicture = liquidRangeTurn({ x: 0.02, y: 0.02, w: 0.5, h: 0.4, angle: 0, lean: 0.2 }, Math.PI / 2);
    assert.ok(leftPicture);
    assert.equal(leftPicture?.w, 0.5);
    assert.equal(leftPicture?.h, 0.4);
    assert.ok(Math.abs((leftPicture?.x ?? 0) + (leftPicture?.w ?? 0) / 2 - 0.27) < 1e-9);
    assert.ok(Math.abs((leftPicture?.y ?? 0) + (leftPicture?.h ?? 0) / 2 - 0.22) < 1e-9);
    assert.ok(Math.abs((leftPicture?.lean ?? 0) - 0.2) < 1e-4);
    assert.equal(liquidRangeInside(leftPicture, 1e-6), false);
    assert.equal(liquidRangeHit(base, 0.5, 0.5, 0.04, 0.04).kind, "corner");
    assert.equal(liquidRangeHit(base, 0.35, 0.2, 0.04, 0.04).kind, "edge");
    assert.equal(liquidRangeHit(base, 0.35, 0.35, 0.04, 0.04).kind, "move");
    assert.equal(liquidRangeHit(base, 0.42, 0.42, 0.04, 0.04).kind, "inside");
    assert.equal(liquidRangeHit(base, 0.8, 0.8, 0.04, 0.04).kind, "outside");
    const flatCorners = liquidRangeCorners(base);
    const view = liquidRangeViewCorners(base);
    assert.ok(flatCorners.every((point, index) => Math.abs(point.x - view[index]!.x) < 1e-9 && Math.abs(point.y - view[index]!.y) < 1e-9));
    const leaned = liquidRangeLeanDrag(base, 3, -0.22, 0);
    assert.ok(leaned.lean && leaned.lean > 0);
    assert.ok(Math.abs(liquidRangeLean(leaned) - LIQUID_TILT_LIMIT) < 1e-4);
    assert.ok(Math.abs(liquidRangeLean(leaned)) <= LIQUID_TILT_LIMIT);
    const forward = liquidRangeLeanDrag(leaned, 3, 0.04, 0);
    assert.ok((forward.lean ?? 0) < (leaned.lean ?? 0));
    assert.ok((forward.lean ?? 0) > 0);
    const capped = liquidRangeLeanDrag(base, 1, 2, 0);
    assert.ok(Math.abs(liquidRangeLean(capped) + LIQUID_TILT_LIMIT) < 1e-4);
    const nodded = liquidRangeLeanDrag(base, 0, 0, -0.05);
    assert.ok((nodded.pitch ?? 0) > 0 && (nodded.pitch ?? 0) < LIQUID_TILT_LIMIT);
    assert.equal(nodded.lean, undefined);
    const keptTilt = liquidRangeResize({ ...base, lean: 0.4 }, 2, 0.7, 0.4);
    assert.ok(Math.abs((keptTilt.lean ?? 0) - 0.4) < 1e-4);
    const keptMove = liquidRangeMove({ ...base, pitch: -0.2 }, 0.05, 0);
    assert.ok(Math.abs((keptMove.pitch ?? 0) + 0.2) < 1e-4);
    const restored = normalizeLiquidRange({ x: 0.2, y: 0.2, w: 0.3, h: 0.3, lean: 2, pitch: -2 });
    assert.ok(restored);
    assert.ok(Math.abs(liquidRangeLean(restored) - LIQUID_TILT_LIMIT) < 1e-4);
    assert.ok(Math.abs(liquidRangePitch(restored) + LIQUID_TILT_LIMIT) < 1e-4);
    assert.equal(normalizeLiquidRange({ x: 0.2, y: 0.2, w: 0.4, h: 0.3 })?.lean, undefined);
    const tilted = liquidRangeViewCorners({ ...base, lean: LIQUID_TILT_LIMIT });
    const left = tilted[0]!.x;
    const right = tilted[1]!.x;
    const flatLeft = flatCorners[0]!.x;
    const flatRight = flatCorners[1]!.x;
    assert.ok(right - left < flatRight - flatLeft);
    assert.ok(tilted[1]!.scale > tilted[0]!.scale);
  });

  it("fades each finished pixel, not one alpha for a whole mesh cell", () => {
    const full = { x: 0, y: 0, w: 1, h: 1 };
    assert.equal(liquidRangePixelFade(2, 50, full, 100, 100), liquidRangeFade(2, 50, full, 100, 100));
    assert.equal(liquidRangePixelFade(0, 50, full, 100, 100), 0);
    assert.equal(liquidRangePixelFade(50, 50, full, 100, 100), 1);
    const spun = { x: 0.3, y: 0.4, w: 0.4, h: 0.2, angle: Math.PI / 2 };
    assert.equal(liquidRangePixelFade(50, 50, spun, 100, 100), liquidRangeFade(50, 50, spun, 100, 100));
    assert.equal(liquidRangePixelFade(35, 50, spun, 100, 100), 0);

    const width = 1000;
    const height = 800;
    const range = { x: 0.15, y: 0.1, w: 0.7, h: 0.75 };
    const column = (range.w * width) / meshColumns(false);
    const edgeX = range.x * width;
    const midY = (range.y + range.h / 2) * height;
    const levels = new Set<number>();
    for (let x = Math.ceil(edgeX); x < edgeX + column; x++) {
      levels.add(Math.round(liquidRangePixelFade(x + 0.5, midY, range, width, height) * 1000));
    }
    assert.ok(levels.size > 4);

    const pixels = new Uint8ClampedArray(width * height * 4);
    writeLiquidFadeMask(pixels, width, height, range);
    const alpha = (x: number, y: number) => pixels[(y * width + x) * 4 + 3];
    const band = Math.round(width * 0.03);
    let previous = alpha(Math.ceil(edgeX), Math.round(midY));
    let rose = 0;
    for (let step = 1; step < band; step++) {
      const next = alpha(Math.ceil(edgeX) + step, Math.round(midY));
      assert.ok(next >= previous);
      assert.ok(next - previous < 140);
      if (next > previous) rose += 1;
      previous = next;
    }
    assert.ok(rose > 2);

    const cornerX = Math.ceil(edgeX) + 2;
    const cornerY = Math.ceil(range.y * height) + 2;
    const corner = liquidRangePixelFade(cornerX + 0.5, cornerY + 0.5, range, width, height);
    const side = liquidRangePixelFade(cornerX + 0.5, midY, range, width, height);
    const top = liquidRangePixelFade((range.x + range.w / 2) * width, cornerY + 0.5, range, width, height);
    assert.equal(alpha(cornerX, cornerY), Math.round(corner * 255));
    assert.ok(Math.abs(corner - Math.min(side, top)) < 1e-9);
    assert.ok(corner > side * top);
    assert.equal(alpha(10, 10), 0);
    assert.equal(alpha(500, 400), 255);

    const turned = { ...range, angle: 0.4 };
    const turnedPixels = new Uint8ClampedArray(width * height * 4);
    writeLiquidFadeMask(turnedPixels, width, height, turned);
    for (const [x, y] of [
      [200, 300],
      [500, 400],
      [700, 500],
      [50, 50],
    ] as const) {
      const expected = Math.round(liquidRangePixelFade(x + 0.5, y + 0.5, turned, width, height) * 255);
      assert.equal(turnedPixels[(y * width + x) * 4 + 3], expected);
    }

    const leaned = { x: 0.3, y: 0.3, w: 0.4, h: 0.4, lean: LIQUID_TILT_LIMIT, pitch: -0.35, angle: 0.25 };
    const aspect = width / height;
    for (const [lx, ly] of [
      [0, 0],
      [0.12, -0.08],
      [-0.15, 0.1],
      [0.19, 0.16],
    ] as const) {
      const face = liquidRangeFace(leaned, lx, ly, aspect);
      const back = liquidRangeUnface(leaned, face.x, face.y, aspect);
      assert.ok(back);
      assert.ok(Math.abs((back?.x ?? 0) - lx) < 1e-6);
      assert.ok(Math.abs((back?.y ?? 0) - ly) < 1e-6);
      const drawn = liquidRangePixelFade(face.x * width, face.y * height, leaned, width, height);
      assert.ok(Math.abs(drawn - liquidRangeFadeAt(lx, ly, leaned, width, height)) < 1e-9);
    }
    const edge = liquidRangeFace(leaned, leaned.w / 2, 0, aspect);
    assert.ok(liquidRangePixelFade(edge.x * width, edge.y * height, leaned, width, height) < 1e-6);
    const inside = liquidRangeFace(leaned, leaned.w / 2 - 0.01, 0, aspect);
    const insideFade = liquidRangePixelFade(inside.x * width, inside.y * height, leaned, width, height);
    assert.ok(insideFade > 0 && insideFade < 1);
    const small = new Uint8ClampedArray(160 * 120 * 4);
    writeLiquidFadeMask(small, 160, 120, leaned);
    const sx = Math.min(159, Math.max(0, Math.floor(inside.x * 160)));
    const sy = Math.min(119, Math.max(0, Math.floor(inside.y * 120)));
    assert.equal(small[(sy * 160 + sx) * 4 + 3], Math.round(liquidRangePixelFade(sx + 0.5, sy + 0.5, leaned, 160, 120) * 255));
  });

  it("varies the sheet and keeps PC and phone on the same clock", () => {
    const seen = new Set<string>();
    const world = emptyLiquid(false);
    world.aspect = 1;
    world.seed = 3;
    for (let i = 0; i < 8; i++) {
      const group = placeLiquid(world, 0.5, 0.5);
      assert.ok(group);
      seen.add(group.sprites[0]!.asset);
    }
    assert.ok(seen.size >= 3);

    const run = (phone: boolean) => {
      const sample = emptyLiquid(phone);
      sample.aspect = 0.8;
      sample.seed = 11;
      const group = placeLiquid(sample, 0.4, 0.6);
      assert.ok(group);
      while (sample.time < group.showAt) stepLiquid(sample, 0.05);
      for (let i = 0; i < 30; i++) stepLiquid(sample, 0.05);
      return {
        extend: group.sprites[0]!.extend,
        showAt: group.showAt,
        fade: liquidTimeFade(sample.time - group.showAt),
        w: group.sprites[0]!.w,
      };
    };
    const pc = run(false);
    const phone = run(true);
    assert.equal(pc.extend, phone.extend);
    assert.equal(pc.showAt, phone.showAt);
    assert.equal(pc.fade, phone.fade);
    assert.equal(pc.w, phone.w);
  });

  it("blinks twice, then shows the sheet during a half-second third flash", () => {
    assert.equal(LIQUID_FLASH.ons.length, 3);
    assert.ok(LIQUID_FLASH.ons[2] >= 0.45 && LIQUID_FLASH.ons[2] <= 0.55);
    const duration = liquidFlashDuration();
    const show = liquidShowDelay();
    assert.ok(Math.abs(show - (LIQUID_FLASH.ons[0] + LIQUID_FLASH.gap + LIQUID_FLASH.ons[1] + LIQUID_FLASH.gap)) < 1e-9);
    assert.ok(duration > show + 0.45 && duration < show + 0.55);
    assert.equal(liquidFlashAlpha(-0.01), 0);
    assert.equal(liquidFlashAlpha(0), 0);
    const firstPeak = liquidFlashAlpha(LIQUID_FLASH.ons[0] * 0.5);
    assert.ok(Math.abs(firstPeak - LIQUID_FLASH.alpha) < 1e-6);
    assert.ok(firstPeak < 0.9);
    assert.equal(liquidFlashAlpha(LIQUID_FLASH.ons[0] + LIQUID_FLASH.gap * 0.5), 0);
    assert.equal(liquidFlashAlpha(show), 1);
    assert.equal(liquidFlashAlpha(show + 0.2), 1);
    const fading = liquidFlashAlpha(show + 0.35);
    assert.ok(fading < 1 && fading > 0);
    assert.ok(liquidFlashAlpha(show + 0.4) < fading);
    assert.equal(liquidFlashAlpha(duration), 0);
    const secondStart = LIQUID_FLASH.ons[0] + LIQUID_FLASH.gap;
    const secondPeak = liquidFlashAlpha(secondStart + LIQUID_FLASH.ons[1] * 0.5);
    assert.ok(Math.abs(secondPeak - LIQUID_FLASH.alpha) < 1e-6);

    const world = emptyLiquid(false);
    world.aspect = 1;
    const group = placeLiquid(world, 0.5, 0.5);
    assert.ok(group);
    assert.equal(group.showAt, show);
    stepLiquid(world, 0.05);
    assert.ok(liquidOverlayFlash(world) > 0.2);
    assert.equal(group.sprites[0]!.extend, 0);
    assert.ok(world.time < group.showAt);
    while (world.time < show + 0.2) stepLiquid(world, 0.05);
    assert.ok(world.time >= group.showAt);
    assert.ok(liquidOverlayFlash(world) > 0);
    assert.ok(group.sprites[0]!.extend > 0);
  });

  it("pins the top, stretches downward, and waves the speed", () => {
    const height = 180;
    const still = meshEdges(0, height);
    assert.equal(still.top, 0);
    assert.equal(still.bottom, height);
    assert.equal(LIQUID_TOP_RATIO, 0);
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      assert.ok(Math.abs(meshY(t, height, 0) - t * height) < 1e-6);
    }
    const full = meshEdges(1, height);
    assert.equal(full.top, 0);
    assert.equal(full.bottom, height * 2);
    assert.equal(meshY(0, height, 1), 0);
    assert.ok(Math.abs(meshY(LIQUID_HINGE, height, 1) - LIQUID_HINGE * height) < 1e-6);
    assert.ok(Math.abs(meshY(1, height, 1) - full.bottom) < 1e-6);
    const tipSpan = (1 - LIQUID_TIP) * height;
    assert.ok(Math.abs(meshY(1, height, 1) - meshY(LIQUID_TIP, height, 1) - tipSpan) < 1e-6);
    let prev = -1;
    for (let i = 0; i <= 40; i++) {
      const y = meshY(i / 40, height, 0.63);
      assert.ok(y >= prev - 1e-6);
      prev = y;
    }

    const slow = liquidExtendRate(0);
    const fast = liquidExtendRate(0.25 / LIQUID_WAVE_HZ);
    assert.ok(Math.abs(slow - 1 / LIQUID_EXTEND_SECONDS) < 1e-9);
    assert.ok(fast > slow * 1.3);

    const moved = meshY(0.22, height, 0.35) - meshY(0.22, height, 0);
    assert.ok(moved > height * 0.05, `upper strand should travel, moved ${moved}`);
    assert.equal(meshY(0, height, 1), 0);
    const gains = Array.from({ length: 18 }, (_, column) => strandGain(column, 18, 4));
    const lo = Math.min(...gains);
    const hi = Math.max(...gains);
    assert.ok(lo >= 0.42 && hi <= 1);
    assert.ok(hi - lo > 0.2);
    const slowY = strandY(0.55, height, strandStretch(0.45, lo));
    const fastY = strandY(0.55, height, strandStretch(0.45, hi));
    assert.ok(fastY > slowY + 1);
    let prevStretch = -1;
    for (let i = 0; i <= 10; i++) {
      const stretch = strandStretch(i / 10, 0.7);
      assert.ok(stretch >= prevStretch - 1e-9);
      assert.ok(stretch <= 0.7 + 1e-9);
      prevStretch = stretch;
    }

    const world = emptyLiquid(false);
    world.aspect = 1;
    const group = placeLiquid(world, 0.5, 0.4);
    assert.ok(group);
    reveal(group, world);
    const sprite = group.sprites[0] as LiquidSprite;
    stepLiquid(world, 0.05);
    const first = sprite.extend;
    sprite.extend = 0;
    world.time = group.showAt + 0.25 / LIQUID_WAVE_HZ;
    sprite.showAt = group.showAt;
    stepLiquid(world, 0.05);
    assert.ok(sprite.extend > first);
    sprite.extend = 0.995;
    stepLiquid(world, 0.05);
    assert.equal(sprite.extend, 1);
    stepLiquid(world, 0.05);
    assert.equal(sprite.extend, 1);
    assert.equal(world.groups.includes(group), true);
  });

  it("holds for five seconds, fades for three, and keeps each sheet on its own clock", () => {
    assert.equal(LIQUID_FADE_DELAY, 5);
    assert.equal(LIQUID_FADE_SECONDS, 3);
    assert.equal(liquidLife(), 8);
    assert.equal(liquidTimeFade(0), 1);
    assert.equal(liquidTimeFade(5), 1);
    assert.equal(liquidTimeFade(8), 0);
    assert.equal(liquidTimeFade(9), 0);
    const mid = liquidTimeFade(6.5);
    assert.ok(mid > 0.65 && mid < 0.76);
    assert.ok(liquidTimeFade(7) < mid);
    assert.equal(liquidTipAlpha(0), 1);
    assert.ok(liquidTipAlpha(1) > 0.05 && liquidTipAlpha(1) < liquidTipAlpha(0.4));

    const world = emptyLiquid(false);
    world.aspect = 1;
    const first = placeLiquid(world, 0.3, 0.4);
    assert.ok(first);
    reveal(first, world);
    for (let i = 0; i < 100; i++) stepLiquid(world, 0.05);
    assert.equal(world.groups.includes(first), true);
    assert.equal(liquidTimeFade(world.time - first.showAt), 1);
    const beforeFade = first.sprites[0]!.extend;
    while (liquidTimeFade(world.time - first.showAt) === 1 && world.groups.includes(first)) stepLiquid(world, 0.05);
    assert.ok(world.groups.includes(first));
    assert.ok(liquidTimeFade(world.time - first.showAt) < 1);
    const duringFade = first.sprites[0]!.extend;
    assert.ok(duringFade >= beforeFade);
    if (duringFade < 1) {
      stepLiquid(world, 0.05);
      assert.ok(first.sprites[0]!.extend > duringFade);
    }
    const second = placeLiquid(world, 0.66, 0.5);
    assert.ok(second);
    reveal(second, world);
    const firstAge = world.time - first.showAt;
    stepLiquid(world, 0.05);
    assert.ok(Math.abs(world.time - first.showAt - (firstAge + 0.05)) < 1e-6);
    assert.ok(world.time - second.showAt < 0.1);
    while (world.groups.includes(first)) stepLiquid(world, 0.05);
    assert.equal(world.groups.includes(second), true);
    assert.ok(world.time - second.showAt < liquidLife());
    assert.ok(liquidTimeFade(world.time - second.showAt) > 0);
    while (world.groups.length > 0) stepLiquid(world, 0.05);
    assert.equal(world.groups.length, 0);
    assert.equal(liquidBusy(world), false);
  });

  it("clears every group and stops the flash", () => {
    const world = emptyLiquid(false);
    world.aspect = 1;
    placeLiquid(world, 0.2, 0.2);
    placeLiquid(world, 0.8, 0.7);
    world.spraying = true;
    stepLiquid(world, 0.04);
    assert.ok(liquidOverlayFlash(world) > 0);
    clearLiquid(world);
    assert.equal(world.groups.length, 0);
    assert.equal(world.spraying, false);
    assert.equal(liquidOverlayFlash(world), 0);
    assert.equal(liquidBusy(world), false);
    assert.equal(liquidFreeRatio(0, false), 1);
  });

  it("stops accepting groups when the cap is full", () => {
    const phone = emptyLiquid(true);
    phone.aspect = 1;
    const cap = liquidGroupCap(true);
    for (let i = 0; i < cap; i++) assert.ok(placeLiquid(phone, 0.5, 0.5));
    assert.equal(placeLiquid(phone, 0.5, 0.5), null);
    assert.equal(phone.groups.length, cap);
    assert.equal(liquidFreeRatio(cap, true), 0);
    assert.equal(liquidFreeRatio(0, false), 1);
    assert.equal(liquidGroupCap(false), 12);
    assert.equal(liquidGroupCap(true), 8);
    clearLiquid(phone);
    assert.ok(placeLiquid(phone, 0.4, 0.4));
  });

  it("deals each sheet once, then reshuffles without repeating the edge", () => {
    resetLiquidBag();
    const take = (phone: boolean) => {
      const world = emptyLiquid(phone);
      world.aspect = 1;
      const group = placeLiquid(world, 0.5, 0.5);
      assert.ok(group);
      return group.sprites[0]!.asset;
    };
    const first: string[] = [];
    for (let i = 0; i < 7; i++) first.push(take(i % 2 === 1));
    assert.equal(new Set(first).size, 7);
    const second: string[] = [];
    for (let i = 0; i < 7; i++) second.push(take(i % 2 === 0));
    assert.equal(new Set(second).size, 7);
    assert.notEqual(second[0], first[6]);
    assert.equal(liquidBagSize(), 0);
    const world = emptyLiquid(false);
    world.aspect = 1;
    assert.ok(placeLiquid(world, 0.2, 0.2));
    assert.ok(placeLiquid(world, 0.8, 0.8));
    const held = liquidBagSize();
    assert.equal(held, 5);
    clearLiquid(world);
    assert.equal(liquidBagSize(), held);
    assert.equal(world.groups.length, 0);
  });

  it("does not spend a sheet the layer cannot show", () => {
    resetLiquidBag();
    const world = emptyLiquid(false);
    world.aspect = 1;
    const cap = liquidGroupCap(false);
    for (let i = 0; i < cap; i++) assert.ok(placeLiquid(world, 0.5, 0.5));
    const held = liquidBagSize();
    assert.equal(placeLiquid(world, 0.2, 0.2), null);
    assert.equal(liquidBagSize(), held);
    assert.equal(placeLiquid(world, 0.5, 0.5, () => false), null);
    clearLiquid(world);
    assert.equal(liquidBagSize(), held);
    const refused = emptyLiquid(false);
    refused.aspect = 1;
    resetLiquidBag();
    assert.equal(placeLiquid(refused, 0.5, 0.5, () => false), null);
    assert.equal(liquidBagSize(), 7);
    const only = placeLiquid(refused, 0.5, 0.5, (id) => id === "liquid_cutout_test_07");
    assert.equal(only?.sprites[0]?.asset, "liquid_cutout_test_07");
    assert.equal(liquidBagSize(), 6);
  });

  it("cues a drip when the white flash ends, once, and not after a clear", () => {
    resetLiquidBag();
    const world = emptyLiquid(false);
    world.aspect = 1;
    const group = placeLiquid(world, 0.5, 0.5);
    assert.ok(group);
    const show = group.showAt;
    const end = group.started + liquidFlashDuration();
    assert.ok(end > show);
    let before = world.time;
    let early = 0;
    while (world.time < show + 0.02) {
      before = world.time;
      stepLiquid(world, 0.05);
      early += takeLiquidDrips(world, before).length;
    }
    assert.equal(early, 0);
    assert.ok(world.time >= show);
    let drips = 0;
    while (world.time < end + 0.08) {
      before = world.time;
      stepLiquid(world, 0.05);
      drips += takeLiquidDrips(world, before).length;
    }
    assert.equal(drips, 1);
    before = world.time;
    stepLiquid(world, 0.05);
    assert.equal(takeLiquidDrips(world, before).length, 0);
    const cleared = emptyLiquid(false);
    cleared.aspect = 1;
    assert.ok(placeLiquid(cleared, 0.5, 0.5));
    clearLiquid(cleared);
    let afterClear = 0;
    for (let i = 0; i < 30; i++) {
      before = cleared.time;
      stepLiquid(cleared, 0.05);
      afterClear += takeLiquidDrips(cleared, before).length;
    }
    assert.equal(afterClear, 0);
  });

  it("places one different sheet on every range at the same instant", () => {
    resetLiquidBag();
    const world = emptyLiquid(false);
    world.aspect = 1;
    world.ranges = [
      { id: 1, x: 0.05, y: 0.05, w: 0.25, h: 0.4 },
      { id: 2, x: 0.55, y: 0.4, w: 0.3, h: 0.25 },
    ];
    const group = placeLiquid(world, 0.4, 0.4);
    assert.ok(group);
    assert.equal(world.groups.length, 1);
    assert.equal(group.sprites.length, 2);
    assert.notEqual(group.sprites[0]!.asset, group.sprites[1]!.asset);
    assert.equal(group.sprites[0]!.showAt, group.sprites[1]!.showAt);
    assert.equal(group.sprites[0]!.showAt, group.showAt);
    assert.equal(group.sprites[0]!.rangeId, 1);
    assert.equal(group.sprites[1]!.rangeId, 2);
    const open = emptyLiquid(false);
    open.aspect = 1;
    const single = placeLiquid(open, 0.5, 0.5);
    assert.equal(single?.sprites.length, 1);
    assert.equal(single?.sprites[0]?.rangeId, undefined);

    resetLiquidBag();
    const many = emptyLiquid(false);
    many.aspect = 1;
    many.ranges = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      x: 0.05,
      y: 0.05,
      w: 0.2,
      h: 0.2,
    }));
    const packed = placeLiquid(many, 0.5, 0.5);
    assert.ok(packed);
    assert.equal(packed.sprites.length, 8);
    assert.equal(many.groups.length, 1);
    const assets = packed.sprites.map((sprite) => sprite.asset);
    assert.equal(new Set(assets).size, LIQUID_ASSET_IDS.length - 1);
    assert.equal(assets.includes("liquid_cutout_test_05"), false);
    assert.ok(assets.every((id) => (LIQUID_ASSET_IDS as readonly string[]).includes(id)));
    let drips = 0;
    let before = many.time;
    const end = packed.started + liquidFlashDuration();
    while (many.time < end + 0.05) {
      before = many.time;
      stepLiquid(many, 0.05);
      drips += takeLiquidDrips(many, before).length;
    }
    assert.equal(drips, 1);
    const refused = emptyLiquid(false);
    refused.aspect = 1;
    refused.ranges = many.ranges.slice(0, 2);
    resetLiquidBag();
    assert.equal(placeLiquid(refused, 0.5, 0.5, () => false), null);
    assert.equal(liquidBagSize(), LIQUID_ASSET_IDS.length);
  });

  it("keeps liquid_cutout_test_05 only when no range is set", () => {
    resetLiquidBag();
    const openSeen = new Set<string>();
    for (let i = 0; i < LIQUID_ASSET_IDS.length; i++) {
      const world = emptyLiquid(false);
      world.aspect = 1;
      const group = placeLiquid(world, 0.5, 0.5);
      assert.ok(group);
      openSeen.add(group!.sprites[0]!.asset);
    }
    assert.equal(openSeen.size, LIQUID_ASSET_IDS.length);
    assert.equal(openSeen.has("liquid_cutout_test_05"), true);

    resetLiquidBag();
    const rangedSeen = new Set<string>();
    for (let i = 0; i < LIQUID_ASSET_IDS.length + 4; i++) {
      const world = emptyLiquid(false);
      world.aspect = 0.7;
      world.ranges = [{ id: 1, x: -0.2, y: 0.2, w: 0.5, h: 0.4, angle: 0.2, lean: 0.3 }];
      const group = placeLiquid(world, 0.5, 0.5);
      assert.ok(group);
      assert.equal(group!.sprites[0]!.asset === "liquid_cutout_test_05", false);
      rangedSeen.add(group!.sprites[0]!.asset);
    }
    assert.equal(rangedSeen.size, LIQUID_ASSET_IDS.length - 1);
    assert.equal(rangedSeen.has("liquid_cutout_test_05"), false);
  });

  it("keeps one face through tilt, heading, and a center-fixed resize", () => {
    const aspect = 0.62;
    const width = 620;
    const height = 1000;
    const flat = { x: 0.2, y: 0.3, w: 0.4, h: 0.2, angle: 0.8 };
    const flatCorner = liquidRangeFace(flat, flat.w / 2, 0, aspect);
    assert.ok(Math.abs(liquidRangeHeading(flatCorner.x, flatCorner.y, flat.x + flat.w / 2, flat.y + flat.h / 2, aspect) - flat.angle) < 1e-6);
    const start = { x: 0.2, y: 0.25, w: 0.36, h: 0.28, lean: 0.4, pitch: -0.25, angle: 0.3, id: 7 };
    const centerOf = (range: { x: number; y: number; w: number; h: number }) => ({ x: range.x + range.w / 2, y: range.y + range.h / 2 });
    const pivot = centerOf(start);
    for (const [lx, ly] of [
      [0, 0],
      [0.11, -0.07],
      [-0.09, 0.08],
    ] as const) {
      const face = liquidRangeFace(start, lx, ly, aspect);
      const back = liquidRangeUnface(start, face.x, face.y, aspect);
      assert.ok(back);
      assert.ok(Math.abs((back?.x ?? 0) - lx) < 1e-6);
      assert.ok(Math.abs((back?.y ?? 0) - ly) < 1e-6);
    }
    const edgeLength = (range: { x: number; y: number; w: number; h: number; angle?: number; lean?: number; pitch?: number }) => {
      const corners = liquidRangeViewCorners(range, aspect);
      return [0, 1, 2, 3].map((index) => {
        const a = corners[index]!;
        const b = corners[(index + 1) % 4]!;
        return Math.hypot((b.x - a.x) * width, (b.y - a.y) * height);
      });
    };
    const before = edgeLength(start);
    const turned = liquidRangeTurn(start, start.angle + 0.7);
    assert.ok(turned);
    assert.equal(turned?.id, 7);
    assert.equal(turned?.w, start.w);
    assert.equal(turned?.h, start.h);
    assert.ok(Math.abs((turned?.lean ?? 0) - start.lean) < 1e-6);
    assert.ok(Math.abs((turned?.pitch ?? 0) - (start.pitch ?? 0)) < 1e-6);
    assert.ok(Math.abs(centerOf(turned!).x - pivot.x) < 1e-9);
    assert.ok(Math.abs(centerOf(turned!).y - pivot.y) < 1e-9);
    const after = edgeLength(turned!);
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(before[i]! - after[i]!) < 1e-6);
    const origin = liquidRangeFace(start, 0, 0, aspect);
    const spunOrigin = liquidRangeFace(turned!, 0, 0, aspect);
    assert.ok(Math.abs(origin.x - spunOrigin.x) < 1e-9);
    assert.ok(Math.abs(origin.y - spunOrigin.y) < 1e-9);

    const finger = liquidRangeFace(turned!, turned!.w / 2 + 0.08, turned!.h / 2 - 0.03, aspect);
    const resized = liquidRangeResize(turned!, 2, finger.x, finger.y, aspect);
    assert.ok(Math.abs(centerOf(resized).x - pivot.x) < 1e-4);
    assert.ok(Math.abs(centerOf(resized).y - pivot.y) < 1e-4);
    assert.ok(Math.abs(resized.w / 2 - (turned!.w / 2 + 0.08)) < 1e-4);
    assert.ok(Math.abs(resized.h / 2 - (turned!.h / 2 - 0.03)) < 1e-4);
    assert.ok(Math.abs((resized.lean ?? 0) - (turned!.lean ?? 0)) < 1e-6);
    assert.ok(Math.abs((resized.pitch ?? 0) - (turned!.pitch ?? 0)) < 1e-6);
    assert.ok(Math.abs((resized.angle ?? 0) - (turned!.angle ?? 0)) < 1e-6);
    const parked = liquidRangeFace(resized, resized.w / 2, resized.h / 2, aspect);
    assert.ok(Math.abs(parked.x - finger.x) < 1e-4);
    assert.ok(Math.abs(parked.y - finger.y) < 1e-4);

    const again = liquidRangeTurn(resized, (resized.angle ?? 0) - 0.55);
    assert.ok(again);
    assert.ok(Math.abs(centerOf(again!).x - centerOf(resized).x) < 1e-9);
    assert.ok(Math.abs(centerOf(again!).y - centerOf(resized).y) < 1e-9);
    assert.equal(again?.w, resized.w);
    assert.equal(again?.h, resized.h);
    assert.ok(Math.abs((again?.lean ?? 0) - (resized.lean ?? 0)) < 1e-6);
    const lengths = edgeLength(resized);
    const spunLengths = edgeLength(again!);
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(lengths[i]! - spunLengths[i]!) < 1e-4);

    const leaned = liquidRangeLeanDrag(again!, 1, -0.02, 0.01, aspect);
    assert.equal(leaned.w, again?.w);
    assert.equal(leaned.h, again?.h);
    assert.ok(Math.abs((leaned.angle ?? 0) - (again?.angle ?? 0)) < 1e-6);
    assert.ok(Math.abs(centerOf(leaned).x - centerOf(again!).x) < 1e-9);
    assert.notEqual(leaned.lean, again?.lean);
    assert.ok(Math.abs((leaned.pitch ?? 0) - (again?.pitch ?? 0)) < 1e-6);

    const moved = liquidRangeMove(leaned, -1.2, 0.4);
    assert.ok(Math.abs(moved.x - (leaned.x - 1.2)) < 1e-9);
    assert.ok(moved.x < 0);
    assert.equal(moved.w, leaned.w);
    assert.equal(moved.h, leaned.h);
    assert.ok(Math.abs((moved.angle ?? 0) - (leaned.angle ?? 0)) < 1e-6);
    assert.ok(Math.abs((moved.lean ?? 0) - (leaned.lean ?? 0)) < 1e-6);
    assert.ok(Math.abs((moved.pitch ?? 0) - (leaned.pitch ?? 0)) < 1e-6);
    const saved = normalizeLiquidRange(moved);
    assert.equal(saved?.x, moved.x);
    assert.equal(saved?.y, moved.y);
    assert.equal(saved?.w, moved.w);
    assert.equal(saved?.h, moved.h);
    assert.ok(Math.abs((saved?.lean ?? 0) - (moved.lean ?? 0)) < 1e-6);
  });

  it("puts the tilt handle next to its diamond and lets the center square win", () => {
    const box = { x: 0.2, y: 0.2, w: 0.4, h: 0.4, angle: 0 };
    const top = liquidRangeLeanPoint(box, 0);
    const oldInset = (box.h / 2) * 0.46;
    assert.ok(top.y > box.y);
    assert.ok(top.y < box.y + oldInset);
    assert.ok(top.y - box.y < box.y + box.h / 2 - top.y);
    const leaned = liquidRangeLeanPoint({ ...box, lean: 0.4, pitch: -0.2, angle: 0.3 }, 1, 1, 0.02, 0.02);
    const edge = liquidRangeViewCorners({ ...box, lean: 0.4, pitch: -0.2, angle: 0.3 }, 1);
    const diamond = { x: (edge[1]!.x + edge[2]!.x) / 2, y: (edge[1]!.y + edge[2]!.y) / 2 };
    const center = liquidRangeFace({ ...box, lean: 0.4, pitch: -0.2, angle: 0.3 }, 0, 0, 1);
    assert.ok(Math.hypot(leaned.x - diamond.x, leaned.y - diamond.y) < Math.hypot(center.x - diamond.x, center.y - diamond.y));

    const tiny = { x: 0.4, y: 0.4, w: 0.04, h: 0.04 };
    assert.equal(liquidRangeHit(tiny, 0.42, 0.42, 0.04, 0.04).kind, "move");
    assert.equal(liquidRangeHit(tiny, 0.44, 0.44, 0.04, 0.04).kind, "corner");
    const wide = { x: 0.1, y: 0.2, w: 0.6, h: 0.5 };
    const mid = liquidRangeLeanPoint(wide, 0, 1, 0.02, 0.02);
    const towardCenter = { u: (mid.x + (wide.x + wide.w / 2)) / 2, v: (mid.y + (wide.y + wide.h / 2)) / 2 };
    assert.notEqual(liquidRangeHit(wide, towardCenter.u, towardCenter.v, 0.02, 0.02, 1, 0.02, 0.02).kind, "lean");
    assert.equal(liquidRangeHit(wide, mid.x, mid.y, 0.04, 0.04, 1, 0.02, 0.02).kind, "lean");
  });

  it("hides liquid inside a circle or a rectangle and fades just outside", () => {
    const width = 400;
    const height = 500;
    const rect = { id: 1, shape: "rect" as const, x: 0.25, y: 0.3, w: 0.4, h: 0.2, angle: 0.4, lean: 0.2 };
    const center = liquidRangeFace(rect, 0, 0, width / height);
    assert.equal(liquidHideVisibility(center.x * width, center.y * height, rect, width, height), 0);
    const outside = liquidRangeFace(rect, rect.w, rect.h, width / height);
    assert.equal(liquidHideVisibility(outside.x * width, outside.y * height, rect, width, height), 1);
    const rim = liquidRangeFace(rect, rect.w / 2, 0, width / height);
    const band = LIQUID_HIDE_BAND * Math.min(width, height);
    const steps = new Set<number>();
    let previous = 0;
    for (let step = 0; step <= 12; step++) {
      const localX = rect.w / 2 + (band / width) * (step / 8);
      const face = liquidRangeFace(rect, localX, 0, width / height);
      const vis = liquidHideVisibility(face.x * width, face.y * height, rect, width, height);
      steps.add(Math.round(vis * 1000));
      assert.ok(vis + 1e-6 >= previous);
      previous = vis;
      if (step === 0) assert.equal(vis, 0);
    }
    assert.ok(steps.size > 4);
    assert.ok(rim.x > 0);

    const circle = liquidHideCircle(0.3, 0.3, 0.7, 0.7, 1);
    assert.equal(circle.shape, "circle");
    assert.ok(Math.abs(circle.w - circle.h) < 1e-6);
    const spun = { ...circle, angle: 1.1 };
    const sample = liquidRangeFace(circle, 0, 0, 1);
    assert.equal(liquidHideVisibility(sample.x * 200, sample.y * 200, circle, 200, 200), 0);
    assert.equal(liquidHideVisibility(sample.x * 200, sample.y * 200, spun, 200, 200), 0);
    const grown = liquidHideResize(circle, 2, circle.x + circle.w, circle.y + circle.h, 1);
    assert.equal(grown.shape, "circle");
    assert.ok(Math.abs(grown.x + grown.w / 2 - (circle.x + circle.w / 2)) < 1e-4);
    assert.ok(Math.abs(grown.y + grown.h / 2 - (circle.y + circle.h / 2)) < 1e-4);
    assert.ok(grown.w > circle.w);
    assert.ok(Math.abs(grown.w - grown.h) < 1e-4);
    const stretched = liquidHideResize({ ...rect, shape: "rect" }, 2, 0.9, 0.7, 1);
    assert.notEqual(stretched.w / stretched.h, rect.w / rect.h);

    const hole = { id: 2, shape: "circle" as const, x: 0.1, y: 0.1, w: 0.2, h: 0.16 };
    const cover = liquidHidesVisibility(center.x * width, center.y * height, [rect, hole], width, height);
    assert.equal(cover, 0);
    const fadeOnly = liquidHideVisibility(80, 80, hole, width, height);
    const other = liquidHideVisibility(80, 80, rect, width, height);
    assert.equal(liquidHidesVisibility(80, 80, [hole, rect], width, height), Math.min(fadeOnly, other));

    const pixels = new Uint8ClampedArray(width * height * 4);
    pixels.fill(255);
    writeLiquidHideMask(pixels, width, height, [rect]);
    const ix = Math.min(width - 1, Math.max(0, Math.floor(center.x * width)));
    const iy = Math.min(height - 1, Math.max(0, Math.floor(center.y * height)));
    assert.equal(pixels[(iy * width + ix) * 4 + 3], 0);
    assert.equal(pixels[(2 * width + 2) * 4 + 3], 255);
    const maskLevels = new Set<number>();
    for (let step = 0; step <= 10; step++) {
      const localX = rect.w / 2 + (band / width) * (step / 8);
      const face = liquidRangeFace(rect, localX, 0, width / height);
      const x = Math.min(width - 1, Math.max(0, Math.floor(face.x * width)));
      const y = Math.min(height - 1, Math.max(0, Math.floor(face.y * height)));
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      const expected = Math.round(liquidHideVisibility(x + 0.5, y + 0.5, rect, width, height) * 255);
      assert.ok(Math.abs(alpha - expected) <= 1);
      maskLevels.add(alpha);
    }
    assert.ok(maskLevels.size > 4);

    const saved = normalizeLiquidHides([
      { shape: "circle", id: 3, x: 0.2, y: 0.2, w: 0.2, h: 0.25, angle: 0.5, lean: 0.1 },
      { shape: "nope", x: 0.2, y: 0.2, w: 0.2, h: 0.2 },
      { shape: "rect", x: 0.5, y: 0.5, w: 0.2, h: 0.2, pitch: -0.2 },
    ]);
    assert.deepEqual(
      saved.map((hide) => hide.id),
      [3, 4],
    );
    assert.equal(saved[0]?.shape, "circle");
    assert.equal(saved[1]?.shape, "rect");
    assert.equal(normalizeLiquidHides(undefined).length, 0);
    assert.equal(normalizeLiquidHides({ shape: "rect", x: 0.1, y: 0.1, w: 0.2, h: 0.2 }).length, 0);
    const cornerBox = { x: 0.2, y: 0.2, w: 0.3, h: 0.3 };
    assert.equal(liquidShapeHit(cornerBox, "circle", 0.2, 0.2, 0.02, 0.02).kind, "corner");
    assert.equal(liquidShapeHit(cornerBox, "circle", 0.22, 0.22, 0.02, 0.02).kind, "outside");
    assert.equal(liquidShapeHit(cornerBox, "circle", 0.35, 0.35, 0.02, 0.02).kind, "move");
  });

  it("keeps a free launch quad through a corner, a face, and a turn", () => {
    const aspect = 0.8;
    const base = { id: 3, x: 0.2, y: 0.22, w: 0.36, h: 0.28, angle: 0.35, lean: 0.3, pitch: -0.2 };
    const before = liquidRangeViewCorners(base, aspect);
    const baked = liquidRangeBake(base, aspect);
    const bakedView = liquidRangeViewCorners(baked, aspect);
    for (let i = 0; i < 4; i++) {
      assert.ok(Math.abs(before[i]!.x - bakedView[i]!.x) < 1e-3);
      assert.ok(Math.abs(before[i]!.y - bakedView[i]!.y) < 1e-3);
    }
    assert.equal(baked.lean, undefined);
    assert.equal(baked.pitch, undefined);
    assert.equal(liquidRangeDeformed(baked), true);

    const moved = liquidRangeCorner(base, 2, 0.86, 0.74, aspect);
    const after = liquidRangeViewCorners(moved, aspect);
    for (const index of [0, 1, 3]) {
      assert.ok(Math.abs(before[index]!.x - after[index]!.x) < 1e-3);
      assert.ok(Math.abs(before[index]!.y - after[index]!.y) < 1e-3);
    }
    assert.ok(Math.abs(after[2]!.x - 0.86) < 1e-3);
    assert.ok(Math.abs(after[2]!.y - 0.74) < 1e-3);
    assert.equal(moved.w, baked.w);
    assert.equal(moved.h, baked.h);
    assert.equal(moved.quad === undefined, false);

    const start = liquidRangeViewCorners(moved, aspect);
    const mid = { x: (start[1]!.x + start[2]!.x) / 2, y: (start[1]!.y + start[2]!.y) / 2 };
    const extended = liquidRangeEdge(moved, 1, mid.x + 0.06, mid.y + 0.02, mid.x, mid.y, aspect);
    const next = liquidRangeViewCorners(extended, aspect);
    assert.ok(Math.abs(next[1]!.x - start[1]!.x - (next[2]!.x - start[2]!.x)) < 1e-3);
    assert.ok(Math.abs(next[1]!.y - start[1]!.y - (next[2]!.y - start[2]!.y)) < 1e-3);
    assert.ok(Math.hypot(next[1]!.x - start[1]!.x, next[1]!.y - start[1]!.y) > 0.01);
    const lenBefore = Math.hypot(start[2]!.x - start[1]!.x, (start[2]!.y - start[1]!.y) / aspect);
    const lenAfter = Math.hypot(next[2]!.x - next[1]!.x, (next[2]!.y - next[1]!.y) / aspect);
    assert.ok(Math.abs(lenBefore - lenAfter) < 1e-3);
    assert.ok(Math.abs(next[0]!.x - start[0]!.x) < 1e-3 && Math.abs(next[3]!.x - start[3]!.x) < 1e-3);
    assert.ok(Math.abs(next[0]!.y - start[0]!.y) < 1e-3 && Math.abs(next[3]!.y - start[3]!.y) < 1e-3);

    const pivot = liquidRangePivot(extended, aspect);
    const edgeLength = (corners: { x: number; y: number }[]) =>
      [0, 1, 2, 3].map((index) => {
        const a = corners[index]!;
        const b = corners[(index + 1) % 4]!;
        return Math.hypot((b.x - a.x) * 800, (b.y - a.y) * 1000);
      });
    const spun = liquidRangeSpin(extended, 0.7, aspect);
    assert.ok(spun);
    const spunView = liquidRangeViewCorners(spun!, aspect);
    const spunPivot = liquidRangePivot(spun!, aspect);
    assert.ok(Math.abs(spunPivot.x - pivot.x) < 1e-3);
    assert.ok(Math.abs(spunPivot.y - pivot.y) < 1e-3);
    const beforeLen = edgeLength(next);
    const afterLen = edgeLength(spunView);
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(beforeLen[i]! - afterLen[i]!) < 0.5);

    const again = liquidRangeCorner(spun!, 0, 0.05, 0.08, aspect);
    const againView = liquidRangeViewCorners(again, aspect);
    for (const index of [1, 2, 3]) {
      assert.ok(Math.abs(againView[index]!.x - spunView[index]!.x) < 1e-3);
      assert.ok(Math.abs(againView[index]!.y - spunView[index]!.y) < 1e-3);
    }
    assert.ok(Math.hypot(againView[0]!.x - spunView[0]!.x, againView[0]!.y - spunView[0]!.y) > 0.02);
    const saved = normalizeLiquidRange(again);
    assert.ok(saved?.quad);
    assert.equal(saved?.lean, undefined);
    const restored = liquidRangeViewCorners(saved!, aspect);
    for (let i = 0; i < 4; i++) {
      assert.ok(Math.abs(restored[i]!.x - againView[i]!.x) < 1e-3);
      assert.ok(Math.abs(restored[i]!.y - againView[i]!.y) < 1e-3);
    }
    const face = liquidRangeFace(saved!, 0, 0, aspect);
    const back = liquidRangeUnface(saved!, face.x, face.y, aspect);
    assert.ok(back);
    assert.ok(Math.abs(back?.x ?? 9) < 1e-3);
    assert.ok(Math.abs(back?.y ?? 9) < 1e-3);
    assert.equal(liquidRangePixelFade(face.x * 800, face.y * 1000, saved!, 800, 1000), 1);
    assert.equal(liquidRangePixelFade(2, 2, saved!, 800, 1000), 0);
    const listed = normalizeLiquidRanges([again]);
    assert.equal(listed[0]?.id, 3);
    assert.ok(listed[0]?.quad);
    assert.equal(listed[0]?.lean, undefined);
    assert.equal(normalizeLiquidRange({ x: 0.2, y: 0.2, w: 0.3, h: 0.2 })?.quad, undefined);
    const turned = liquidRangeSpin({ x: 0.2, y: 0.2, w: 0.3, h: 0.2, angle: 0.2, lean: 0.15 }, 0.4, aspect);
    assert.ok(turned);
    assert.equal(turned?.quad, undefined);
    assert.ok(Math.abs((turned?.lean ?? 0) - 0.15) < 1e-4);
    assert.ok(Math.abs((turned?.angle ?? 0) - 0.6) < 1e-4);
  });

  it("uses half the previous hide band", () => {
    assert.equal(LIQUID_HIDE_BAND, 0.0175);
  });
});
