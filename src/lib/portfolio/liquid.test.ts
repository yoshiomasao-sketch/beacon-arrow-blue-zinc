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
  LIQUID_SHEET_ASPECT,
  LIQUID_TIP,
  LIQUID_TOP_RATIO,
  LIQUID_WAVE_HZ,
  clearLiquid,
  emptyLiquid,
  liquidBusy,
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
  meshY,
  placeLiquid,
  stepLiquid,
  stickAim,
  stickKnob,
  strandGain,
  strandStretch,
  strandY,
  type LiquidGroup,
  type LiquidSprite,
  type LiquidWorld,
} from "./liquid.ts";

const assetDir = new URL("../../../reference/liquid-assets/luma-white/", import.meta.url);
const manualDir = new URL("../../../reference/liquid-assets/manual-source/", import.meta.url);
const extendedDir = new URL("../../../reference/liquid-assets/extended/", import.meta.url);
const jpegDir = new URL("../../../reference/", import.meta.url);

function reveal(group: LiquidGroup, world: LiquidWorld) {
  group.showAt = world.time;
  for (const sprite of group.sprites) sprite.showAt = world.time;
}

describe("liquid", () => {
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

  it("reads the five transparent sheets and leaves the older folders alone", () => {
    assert.equal(LIQUID_ASSET_IDS.length, 5);
    const names = fs.readdirSync(assetDir).filter((name) => name.endsWith(".png")).sort();
    assert.deepEqual(names, [...LIQUID_ASSET_IDS].map((id) => `${id}.png`).sort());
    for (const name of names) {
      const stat = fs.statSync(new URL(name, assetDir));
      assert.ok(stat.size > 1000);
    }
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
      const expectedH = world.aspect / LIQUID_SHEET_ASPECT;
      assert.ok(Math.abs(sprite.h - expectedH) < 1e-9);
      assert.ok(Math.abs(sprite.v - sprite.h / 2) < 1e-9);
      assert.ok(sprite.asset.startsWith("liquid_0"));
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

  it("blinks twice, then shows the sheet during a long third flash", () => {
    assert.equal(LIQUID_FLASH.ons.length, 3);
    assert.ok(LIQUID_FLASH.ons[2] >= 0.9 && LIQUID_FLASH.ons[2] <= 1.1);
    const duration = liquidFlashDuration();
    const show = liquidShowDelay();
    assert.ok(Math.abs(show - (LIQUID_FLASH.ons[0] + LIQUID_FLASH.gap + LIQUID_FLASH.ons[1] + LIQUID_FLASH.gap)) < 1e-9);
    assert.ok(duration > show + 0.9 && duration < show + 1.1);
    assert.equal(liquidFlashAlpha(-0.01), 0);
    assert.equal(liquidFlashAlpha(0), 0);
    const firstPeak = liquidFlashAlpha(LIQUID_FLASH.ons[0] * 0.5);
    assert.ok(Math.abs(firstPeak - LIQUID_FLASH.alpha) < 1e-6);
    assert.ok(firstPeak < 0.9);
    assert.equal(liquidFlashAlpha(LIQUID_FLASH.ons[0] + LIQUID_FLASH.gap * 0.5), 0);
    assert.equal(liquidFlashAlpha(show), 1);
    assert.equal(liquidFlashAlpha(show + LIQUID_FLASH.ons[2] * 0.5), 1);
    assert.equal(liquidFlashAlpha(show + LIQUID_FLASH.ons[2] - 0.02), 1);
    assert.equal(liquidFlashAlpha(duration), 0);

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
});
