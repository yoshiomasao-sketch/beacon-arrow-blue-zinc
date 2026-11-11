import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { flowDirection, flowPrefix, flowRowHeights, flowRowOrders, flowTileWidth, flowTiles } from "./flow-saver.ts";

function covers(prefix: number[], viewport: number, distance: number, direction: "rtl" | "ltr"): void {
  const tiles = flowTiles(prefix, viewport, distance, direction).slice().sort((a, b) => a.x - b.x);
  assert.ok(tiles.length > 0);
  let cursor = 0;
  for (const tile of tiles) {
    if (tile.x + tile.width <= 0) continue;
    if (tile.x >= viewport) break;
    assert.ok(tile.x <= cursor + 0.01, `gap before ${tile.index}@${tile.cycle}: ${tile.x} > ${cursor}`);
    cursor = Math.max(cursor, tile.x + tile.width);
  }
  assert.ok(cursor >= viewport - 0.01, `strip ends at ${cursor}, viewport ${viewport}`);
}

describe("flowing screensaver layout", () => {
  it("splits the main area so every row is used and the sum matches", () => {
    assert.deepEqual(flowRowHeights(1000, 1), [1000]);
    assert.deepEqual(flowRowHeights(1000, 2), [500, 500]);
    assert.deepEqual(flowRowHeights(1000, 3), [333, 333, 334]);
    assert.deepEqual(flowRowHeights(5, 3), [1, 2, 2]);
    assert.equal(flowRowHeights(811, 3).reduce((sum, height) => sum + height, 0), 811);
    assert.deepEqual(flowRowHeights(0, 2), [0, 0]);
  });

  it("alternates direction and keeps the picture's aspect", () => {
    assert.equal(flowDirection(0), "rtl");
    assert.equal(flowDirection(1), "ltr");
    assert.equal(flowDirection(2), "rtl");
    assert.equal(flowTileWidth(100, 400, 200), 200);
    assert.equal(flowTileWidth(100, 100, 400), 25);
    assert.equal(flowTileWidth(180, 0, 0), 180);
    assert.equal(flowTileWidth(0, 400, 200), 0);
  });

  it("covers the viewport with no gaps, including the loop seam", () => {
    const prefix = flowPrefix([120, 80, 200]);
    for (const direction of ["rtl", "ltr"] as const) {
      for (const distance of [0, 20, 119, 400, 401.5]) {
        covers(prefix, 640, distance, direction);
      }
    }
    covers(flowPrefix([90]), 500, 40, "rtl");
    covers(flowPrefix([90]), 500, 40, "ltr");
  });

  it("moves at a constant rate and repeats without a jump", () => {
    const prefix = flowPrefix([150, 90]);
    const base = prefix[prefix.length - 1] ?? 0;
    const rtlStart = flowTiles(prefix, 400, 0, "rtl").find((tile) => tile.index === 0 && tile.cycle === 0);
    const rtlLater = flowTiles(prefix, 400, 30, "rtl").find((tile) => tile.index === 0 && tile.cycle === 0);
    assert.ok(rtlStart && rtlLater);
    assert.equal(rtlLater.x, rtlStart.x - 30);
    const ltrStart = flowTiles(prefix, 400, 0, "ltr").find((tile) => tile.index === 0 && tile.cycle === 0);
    const ltrLater = flowTiles(prefix, 400, 30, "ltr").find((tile) => tile.index === 0 && tile.cycle === 0);
    assert.ok(ltrStart && ltrLater);
    assert.equal(ltrLater.x, ltrStart.x + 30);

    const before = flowTiles(prefix, 400, 80, "rtl")
      .map((tile) => `${tile.index}:${Math.round(tile.x * 100)}`)
      .sort();
    const after = flowTiles(prefix, 400, 80 + base, "rtl")
      .map((tile) => `${tile.index}:${Math.round(tile.x * 100)}`)
      .sort();
    assert.deepEqual(after, before);
  });
});

function seedRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function assertPermutation(order: readonly number[], count: number): void {
  assert.deepEqual(order.slice().sort((left, right) => left - right), Array.from({ length: count }, (_, index) => index));
}

function aligned(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + (value === right[index] ? 1 : 0), 0);
}

describe("flowing row orders", () => {
  it("makes one sequence for one row, and the only sequence when there is one image", () => {
    assert.deepEqual(flowRowOrders(0, 3, () => 0), [[], [], []]);
    assert.deepEqual(flowRowOrders(1, 1, () => 0), [[0]]);
    assert.deepEqual(flowRowOrders(1, 2, () => 0), [[0], [0]]);
    assert.deepEqual(flowRowOrders(1, 3, () => 0), [[0], [0], [0]]);
    const single = flowRowOrders(5, 1, seedRandom(4));
    assert.equal(single.length, 1);
    assertPermutation(single[0] ?? [], 5);
  });

  it("keeps each row's order distinct from its neighbor, without lining the same image up", () => {
    for (const start of [1, 2, 3, 7, 11, 19, 42, 99]) {
      for (const count of [2, 3, 4, 6, 8]) {
        const orders = flowRowOrders(count, 3, seedRandom(start * 100 + count));
        assert.equal(orders.length, 3);
        for (const order of orders) assertPermutation(order, count);
        assert.notDeepEqual(orders[0], orders[1]);
        assert.notDeepEqual(orders[1], orders[2]);
        assert.equal(aligned(orders[0] ?? [], orders[1] ?? []), 0);
        assert.equal(aligned(orders[1] ?? [], orders[2] ?? []), 0);
        if (count >= 3) assert.notDeepEqual(orders[0], orders[2]);
        else assert.deepEqual(orders[0], orders[2]);
      }
      const pair = flowRowOrders(5, 2, seedRandom(start));
      assert.equal(pair.length, 2);
      assert.notDeepEqual(pair[0], pair[1]);
      assert.equal(aligned(pair[0] ?? [], pair[1] ?? []), 0);
    }
  });

  it("repeats a seed and changes when the slideshow starts again with a new seed", () => {
    const first = flowRowOrders(6, 3, seedRandom(21));
    assert.deepEqual(flowRowOrders(6, 3, seedRandom(21)), first);
    const again = flowRowOrders(6, 3, seedRandom(22));
    assert.notDeepEqual(again, first);
  });
});
