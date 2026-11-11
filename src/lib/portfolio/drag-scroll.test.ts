import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dragScrollSpeed, dragScrollStep, dragScrollZone } from "./drag-scroll.ts";

describe("gallery drag edge scroll", () => {
  it("shrinks the band on a short list", () => {
    assert.equal(dragScrollZone(800), 80);
    assert.equal(dragScrollZone(100), 25);
    assert.equal(dragScrollZone(0), 0);
  });

  it("is still at the inner edge and fastest at the screen edge", () => {
    assert.equal(dragScrollSpeed(200, 0, 600), 0);
    const inner = dragScrollSpeed(70, 0, 600);
    const edge = dragScrollSpeed(0, 0, 600);
    assert.ok(inner < 0 && inner > -840);
    assert.ok(Math.abs(edge) > Math.abs(inner));
    assert.equal(edge, -840);
    assert.equal(dragScrollSpeed(600, 0, 600), 840);
    assert.equal(dragScrollSpeed(-20, 0, 600), 0);
  });

  it("moves by elapsed time and stops at the ends", () => {
    assert.equal(dragScrollStep(0, 400, -840, 100), 0);
    assert.equal(dragScrollStep(380, 400, 840, 100), 400);
    const once = dragScrollStep(0, 5000, 840, 48);
    const split = [16, 16, 16].reduce((top, dt) => dragScrollStep(top, 5000, 840, dt), 0);
    assert.ok(Math.abs(once - split) < 0.01);
    assert.ok(once > 40 && once < 41);
    assert.equal(dragScrollStep(0, 5000, 840, 200), dragScrollStep(0, 5000, 840, 50));
  });
});
