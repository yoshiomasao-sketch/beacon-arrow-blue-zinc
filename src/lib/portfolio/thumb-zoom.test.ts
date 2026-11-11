import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { THUMB_CHROME_MS, THUMB_HANDOFF_MS, THUMB_ZOOM_MS, THUMB_ZOOM_PHONE_MS, canThumbZoom, frameInStage, zoomShift } from "./thumb-zoom.ts";

describe("thumbnail zoom", () => {
  it("shifts the thumbnail box onto the lightbox box", () => {
    assert.ok(THUMB_ZOOM_MS >= 250 && THUMB_ZOOM_MS <= 350);
    assert.ok(THUMB_ZOOM_PHONE_MS >= 350 && THUMB_ZOOM_PHONE_MS <= 450);
    assert.ok(THUMB_CHROME_MS >= 120 && THUMB_CHROME_MS <= 180);
    assert.ok(THUMB_HANDOFF_MS >= 80 && THUMB_HANDOFF_MS <= 150);
    const shift = zoomShift({ left: 10, top: 20, width: 100, height: 50 }, { left: 110, top: 70, width: 200, height: 150 });
    assert.deepEqual(shift, { x: 100, y: 50, sx: 2, sy: 3 });
  });

  it("skips a zoom when the box is missing or motion is reduced", () => {
    assert.equal(zoomShift({ left: 0, top: 0, width: 0, height: 10 }, { left: 0, top: 0, width: 10, height: 10 }), null);
    assert.equal(canThumbZoom(true, { left: 0, top: 0, width: 40, height: 40 }), false);
    assert.equal(canThumbZoom(false, null), false);
    assert.equal(canThumbZoom(false, { left: 1, top: 2, width: 40, height: 30 }), true);
    const frame = frameInStage({ left: 100, top: 50, width: 800, height: 600 }, 400, 200);
    assert.ok(frame);
    assert.equal(Math.round(frame.width), 768);
    assert.equal(Math.round(frame.height), 384);
    assert.equal(Math.round(frame.left), 116);
    assert.equal(Math.round(frame.top), 158);
  });
});
