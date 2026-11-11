import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rubberDragTilt, rubberOffset, rubberRelease, rubberResting, rubberRun } from "./pc-rubber.ts";

describe("pc rubber pull", () => {
  it("follows a short pull and resists a long one", () => {
    assert.deepEqual(rubberOffset(0, 0), { x: 0, y: 0 });
    const short = rubberOffset(48, -32);
    assert.ok(short.x > 36 && short.x < 48);
    assert.ok(short.y < -24 && short.y > -32);
    const far = rubberOffset(4000, 0);
    assert.ok(far.x > 140 && far.x < 168);
  });

  it("keeps the starting tilt and leans with the pull", () => {
    assert.deepEqual(rubberDragTilt({ x: 4, y: -3 }, { x: 0, y: 0 }), { x: 4, y: -3 });
    const leaned = rubberDragTilt({ x: 4, y: -3 }, { x: 168, y: 0 });
    assert.equal(leaned.x, 4);
    assert.ok(leaned.y > -3);
    assert.ok(Math.abs(leaned.x) <= 12 && Math.abs(leaned.y) <= 12);
  });

  it("overshoots a little when released slowly and more when flicked", () => {
    const slow = rubberRun(rubberRelease({ x: 70, y: 0, rx: 4, ry: 0 }, { x: 0, y: 0 }));
    const fast = rubberRun(rubberRelease({ x: 70, y: 0, rx: 4, ry: 0 }, { x: 1.6, y: 0 }));
    assert.ok(slow.minX < 0 && slow.minX > -50);
    assert.ok(fast.minX < slow.minX);
    assert.ok(fast.minX > -140);
    assert.ok(rubberResting(slow.end));
    assert.ok(rubberResting(fast.end));
    assert.ok(Math.abs(slow.end.rx) < 0.2);
  });
});
