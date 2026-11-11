import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { armGalleryShuffle, finishGalleryShake, galleryDecay, galleryImpulse, galleryTiltStep, shuffleEnterRows, shuffleEnterShift } from "./sensor-gallery.ts";
import { SHAKE_REST } from "./device-shake.ts";

describe("gallery sensor tilt", () => {
  it("leans the opposite way and stays within 10 degrees", () => {
    const first = galleryTiltStep({ x: 0, y: 0 }, { beta: 0, gamma: 0 }, null);
    assert.deepEqual(first.shown, { x: 0, y: 0 });
    let shown = first.shown;
    let baseline = first.baseline;
    for (let i = 0; i < 12; i += 1) {
      const next = galleryTiltStep(shown, { beta: 22, gamma: 22 }, baseline);
      shown = next.shown;
      baseline = next.baseline;
    }
    assert.ok(shown.x > 9 && shown.x <= 10);
    assert.ok(shown.y < -9 && shown.y >= -10);
  });
});

describe("gallery shake and shuffle", () => {
  it("shoves the thumbnails by a large distance and returns them", () => {
    const pose = galleryImpulse(1, false);
    assert.equal(pose.x, 96);
    assert.ok(Math.abs(pose.y) > 30);
    let current = pose;
    for (let i = 0; i < 80; i += 1) current = galleryDecay(current, 16);
    assert.equal(current, SHAKE_REST);
  });

  it("schedules one shuffle after the shake, not another while it is busy", () => {
    assert.equal(armGalleryShuffle(false, false), true);
    assert.equal(armGalleryShuffle(true, false), true);
    assert.equal(armGalleryShuffle(false, true), false);
    assert.deepEqual(finishGalleryShake(true), { armed: false, shuffle: true });
    assert.deepEqual(finishGalleryShake(false), { armed: false, shuffle: false });
  });

  it("staggers visible rows and leaves offscreen cards alone", () => {
    const rows = shuffleEnterRows(
      [
        { top: 10, bottom: 80 },
        { top: 12, bottom: 82 },
        { top: 100, bottom: 170 },
        { top: 400, bottom: 470 },
      ],
      0,
      200,
    );
    assert.deepEqual(rows, [0, 0, 1, -1]);
  });

  it("starts a desktop card outside the right edge, at least its own width", () => {
    assert.equal(shuffleEnterShift(100, 800, 160), 732);
    assert.equal(shuffleEnterShift(700, 800, 180), 180);
  });
});
