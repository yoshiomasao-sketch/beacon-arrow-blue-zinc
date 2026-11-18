import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  emptyLiquid,
  liquidExtendRate,
  liquidPaceY,
  LIQUID_EXTEND_SECONDS,
  LIQUID_PACE_BANDS,
  LIQUID_PACE_MAX,
  LIQUID_PACE_MIN,
  placeLiquid,
  resetLiquidBag,
  rollLiquidPaces,
  setLiquidPaceRandom,
  stepLiquid,
  strandY,
} from "./liquid.ts";

function place(phone = false) {
  resetLiquidBag();
  const world = emptyLiquid(phone);
  world.aspect = 1;
  const group = placeLiquid(world, 0.5, 0.5);
  assert.ok(group);
  group.showAt = world.time;
  for (const sprite of group.sprites) sprite.showAt = world.time;
  return { world, sprite: group.sprites[0]! };
}

describe("liquid pace bands", () => {
  after(() => setLiquidPaceRandom(Math.random));

  it("keeps the shared extend clock and the six second average", () => {
    assert.equal(LIQUID_EXTEND_SECONDS, 6);
    assert.equal(LIQUID_PACE_BANDS, 5);
    setLiquidPaceRandom(() => 0.5);
    const { world, sprite } = place();
    stepLiquid(world, 0.05);
    assert.ok(Math.abs(sprite.extend - 0.05 * liquidExtendRate(0.05)) < 1e-12);
    assert.ok(sprite.bands.every((value) => Math.abs(value - sprite.extend) < 1e-12));
  });

  it("rolls five scales from 0.8 to 1.2, and rerolls a flat set once", () => {
    const seq = [0, 0, 0, 0, 0, 0.1, 0.9, 0.2, 0.8, 0.4];
    let i = 0;
    const paces = rollLiquidPaces(() => seq[i++] ?? 0);
    assert.equal(i, 10);
    assert.equal(paces.length, 5);
    for (const pace of paces) assert.ok(pace >= LIQUID_PACE_MIN && pace <= LIQUID_PACE_MAX);
    assert.ok(Math.max(...paces) - Math.min(...paces) >= 0.05);
    const flat = rollLiquidPaces(() => 0);
    assert.ok(flat.every((pace) => Math.abs(pace - LIQUID_PACE_MIN) < 1e-12));
  });

  it("chooses the scales once per shot and keeps them until the sheet ends", () => {
    const seq = [0.1, 0.9, 0.3, 0.7, 0.5];
    let n = 0;
    setLiquidPaceRandom(() => seq[n++ % seq.length]!);
    const { world, sprite } = place();
    const paces = sprite.paces.slice();
    assert.equal(n, 5);
    for (let i = 0; i < 20; i++) stepLiquid(world, 0.05);
    assert.equal(n, 5);
    assert.deepEqual(sprite.paces, paces);
    for (let i = 0; i < paces.length; i++) {
      assert.ok(Math.abs((sprite.bands[i] ?? 0) - paces[i]! * sprite.extend) < 1e-9);
    }
    const phone = place(true);
    assert.equal(phone.sprite.paces.length, LIQUID_PACE_BANDS);
    assert.equal(phone.sprite.bands.length, LIQUID_PACE_BANDS);
  });

  it("uses a different combination on the next shot", () => {
    const seq = [0.1, 0.9, 0.3, 0.7, 0.5, 0.8, 0.2, 0.6, 0.4, 0];
    let n = 0;
    setLiquidPaceRandom(() => seq[n++]!);
    resetLiquidBag();
    const world = emptyLiquid(false);
    world.aspect = 1;
    const first = placeLiquid(world, 0.5, 0.5);
    const second = placeLiquid(world, 0.5, 0.5);
    assert.ok(first && second);
    assert.equal(n, 10);
    assert.notDeepEqual(first.sprites[0]!.paces, second.sprites[0]!.paces);
  });

  it("keeps one continuous sheet, and matches the old curve when every part has the same stretch", () => {
    const height = 480;
    const stretch = 0.41;
    const same = Array.from({ length: LIQUID_PACE_BANDS }, () => stretch);
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const y = liquidPaceY(t, height, same);
      assert.ok(Math.abs(y - strandY(t, height, stretch)) < 1e-6, `${t}: ${y}`);
    }
    let prev = -1;
    for (let i = 0; i <= 20; i++) {
      const y = liquidPaceY(i / 20, height, [0.1, 0.55, 0.2, 0.8, 0.35]);
      assert.ok(y >= prev - 1e-9);
      prev = y;
    }
    const slow = liquidPaceY(1, height, [0.2, 0.2, 0.2, 0.2, 0.2]);
    const fastMiddle = liquidPaceY(1, height, [0.2, 0.2, 0.9, 0.2, 0.2]);
    const fastTop = liquidPaceY(0.2, height, [0.9, 0.2, 0.2, 0.2, 0.2]);
    const slowTop = liquidPaceY(0.2, height, [0.2, 0.2, 0.2, 0.2, 0.2]);
    assert.ok(fastMiddle > slow);
    assert.ok(fastTop > slowTop);
  });
});
