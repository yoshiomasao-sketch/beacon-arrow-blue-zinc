import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  THUMB_MAX_DEG,
  THUMB_REST,
  THUMB_RETURN_MS,
  thumbFollow,
  thumbSheen,
  thumbTiltEnabled,
  thumbTiltFromPointer,
  thumbUnit,
} from "./thumb-tilt.ts";

describe("thumbnail tilt", () => {
  it("presses the side under the cursor and caps both axes at 8 degrees", () => {
    assert.equal(THUMB_MAX_DEG, 8);
    assert.deepEqual(thumbTiltFromPointer(0, 0), THUMB_REST);
    assert.deepEqual(thumbTiltFromPointer(1, 0), { x: 0, y: 8 });
    assert.deepEqual(thumbTiltFromPointer(-1, 0), { x: 0, y: -8 });
    assert.deepEqual(thumbTiltFromPointer(0, -1), { x: 8, y: 0 });
    assert.deepEqual(thumbTiltFromPointer(0, 1), { x: -8, y: 0 });
    const mid = thumbTiltFromPointer(0.5, -0.5);
    assert.ok(mid.y > 2 && mid.y < 8);
    assert.ok(mid.x > 2 && mid.x < 8);
    assert.deepEqual(thumbTiltFromPointer(4, -4), { x: 8, y: 8 });
  });

  it("stays flat near the center and maps the pointer into the card", () => {
    assert.deepEqual(thumbTiltFromPointer(0.05, -0.04), THUMB_REST);
    assert.equal(thumbUnit(0, 40), 0);
    assert.equal(thumbUnit(40, 40), 1);
    assert.equal(thumbUnit(-80, 40), -1);
    assert.equal(thumbUnit(10, 0), 0);
  });

  it("catches up in one step and parks when the pointer stops", () => {
    const once = thumbFollow(THUMB_REST, { x: 0, y: 8 });
    assert.ok(once.y > 4 && once.y < 8);
    const parked = thumbFollow({ x: 0, y: 7.98 }, { x: 0, y: 8 });
    assert.equal(parked.y, 8);
    assert.equal(parked.x, 0);
  });

  it("moves a soft highlight with the press and clears it at rest", () => {
    assert.ok(THUMB_RETURN_MS >= 200 && THUMB_RETURN_MS <= 250);
    const right = thumbSheen({ x: 0, y: 8 });
    assert.ok(right.x > 0);
    assert.equal(right.y, 0);
    assert.ok(right.opacity > 0.2 && right.opacity <= 0.38);
    const top = thumbSheen({ x: 8, y: 0 });
    assert.ok(top.y < 0);
    assert.deepEqual(thumbSheen(THUMB_REST), { x: 0, y: 0, opacity: 0, turn: 0 });
  });

  it("follows a mouse pointer and ignores touch, pen, and reduced motion", () => {
    assert.equal(thumbTiltEnabled("mouse", false), true);
    assert.equal(thumbTiltEnabled("touch", false), false);
    assert.equal(thumbTiltEnabled("pen", false), false);
    assert.equal(thumbTiltEnabled("mouse", true), false);
    assert.equal(thumbTiltEnabled("", false), false);
  });
});
