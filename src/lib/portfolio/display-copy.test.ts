import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloneDisplayEdits, displayCopyFileName, dotCopyFileName, inkCopyPlan, isDotStillName, type DisplayCopyLive } from "./display-copy.ts";
import type { PuruMarker } from "./purupuru.ts";
import type { ImageMeta, ImagePlay } from "./types.ts";
import type { VectorMarker } from "./vector-marker.ts";

function image(patch: Partial<ImageMeta> = {}): ImageMeta {
  return {
    id: "source",
    name: "original.png",
    mime: "image/png",
    width: 100,
    height: 50,
    byteSize: 10,
    addedAt: 1,
    order: 1,
    scale: 1,
    source: "file",
    folderId: "box",
    favorite: false,
    tagIds: ["tag-a"],
    animated: false,
    memo: "夕景",
    dot: { on: true, cols: 32 },
    ...patch,
  };
}

const emptyLive = (): DisplayCopyLive => ({ puru: [], vectors: [], effects: [], liquid: [], liquidHide: [] });

describe("display copy name", () => {
  it("names the first copy and then numbers the rest", () => {
    assert.equal(displayCopyFileName("original.png", []), "original_表示状態.png");
    assert.equal(displayCopyFileName("original.png", ["original_表示状態.png"]), "original_表示状態_2.png");
    assert.equal(
      displayCopyFileName("original.png", ["original_表示状態.png", "original_表示状態_2.png"]),
      "original_表示状態_3.png",
    );
    assert.equal(displayCopyFileName("photo.jpeg", []), "photo_表示状態.png");
    assert.equal(displayCopyFileName("無題", ["無題_表示状態.png"]), "無題_表示状態_2.png");
    assert.equal(dotCopyFileName("original.png", []), "original_ドット.png");
    assert.equal(dotCopyFileName("original.png", ["original_ドット.png"]), "original_ドット_2.png");
    assert.equal(dotCopyFileName("photo.jpeg", ["photo_ドット.png", "photo_ドット_2.png"]), "photo_ドット_3.png");
    assert.equal(isDotStillName("original_ドット.png"), true);
    assert.equal(isDotStillName("original_ドット_2.png"), true);
    assert.equal(isDotStillName("original.png"), false);
    assert.equal(isDotStillName("original_表示状態.png"), false);
  });
});

describe("ink copy plan", () => {
  it("bakes a visible pen and keeps a hidden pen off the pixels", () => {
    assert.equal(inkCopyPlan(true, true), "bake");
    assert.equal(inkCopyPlan(false, true), "keep-hidden");
    assert.equal(inkCopyPlan(true, false), "none");
    assert.equal(inkCopyPlan(false, false), "none");
  });
});

describe("cloned display edits", () => {
  it("copies markers into new objects and does not turn the mosaic on again", () => {
    const play: ImagePlay = {
      kind: "swayX",
      speed: "fast",
      reverse: true,
      zoom: false,
      twist: false,
      zoomPace: "normal",
      twistPace: "normal",
      tilt: null,
      vector: true,
      effect: true,
      effects: [{ id: 9, kind: "splash", asset: "splash_01", pace: "slow", u: 0.4, v: 0.6, size: 0.3, angle: 0.5, flip: true, backbeat: true }],
      voiceId: "声1.wav",
      rate: 1.5,
      volume: 40,
      liquid: [{ id: 3, x: 0.2, y: 0.3, w: 0.4, h: 0.5, angle: 0.2 }],
      liquidHide: [{ id: 4, x: 0.1, y: 0.1, w: 0.2, h: 0.2, shape: "circle" }],
    };
    const puruMarker: PuruMarker = { id: 7, kind: "mid", u: 0.25, v: 0.75, radius: 0.2, view: 0.5, off: true };
    const vectorMarker: VectorMarker = { id: 8, kind: "orbit", pace: "slow", u: 0.3, v: 0.4, radius: 0.2, angle: 1, backbeat: true };
    const source = image({
      favorite: true,
      scale: 2,
      puru: { markers: [puruMarker] },
      vectors: { vibe: 2, markers: [vectorMarker] },
      effects: { markers: [{ id: 9, kind: "gold", asset: "splash_03", pace: "fast", u: 0.5, v: 0.5, size: 0.4, angle: 0 }] },
      play,
    });
    const live: DisplayCopyLive = {
      puru: [{ ...puruMarker }],
      vectors: [{ ...vectorMarker }],
      effects: source.effects!.markers.map((marker) => ({ ...marker })),
      liquid: play.liquid.map((range) => ({ ...range })),
      liquidHide: play.liquidHide.map((hide) => ({ ...hide })),
    };
    const cloned = cloneDisplayEdits(source, live);
    assert.equal(cloned.memo, "夕景");
    assert.equal(cloned.favorite, false);
    assert.equal(source.favorite, true);
    assert.equal(cloned.scale, 2);
    assert.deepEqual(cloned.tagIds, ["tag-a"]);
    assert.equal("dot" in cloned, false);
    assert.equal(cloned.puru?.markers[0]?.id, 1);
    assert.equal(cloned.puru?.markers[0]?.u, 0.25);
    assert.equal(cloned.puru?.markers[0]?.off, true);
    assert.notEqual(cloned.puru?.markers[0], source.puru?.markers[0]);
    assert.equal(cloned.vectors?.vibe, 2);
    assert.equal(cloned.vectors?.markers[0]?.kind, "orbit");
    assert.equal(cloned.vectors?.markers[0]?.backbeat, true);
    assert.equal(cloned.effects?.markers[0]?.kind, "gold");
    assert.equal(cloned.effects?.markers[0]?.id, 1);
    assert.equal(cloned.play?.kind, "swayX");
    assert.equal(cloned.play?.voiceId, "声1.wav");
    assert.equal(cloned.play?.vector, true);
    assert.equal(cloned.play?.effects[0]?.flip, true);
    assert.equal(cloned.play?.effects[0]?.id, 1);
    assert.notEqual(cloned.play?.effects[0], play.effects[0]);
    assert.equal(cloned.play?.liquid[0]?.x, 0.2);
    assert.equal(cloned.play?.liquid[0]?.id, 1);
    assert.equal(cloned.play?.liquidHide[0]?.shape, "circle");
    assert.notEqual(cloned.play?.liquid[0], play.liquid[0]);
    cloned.puru!.markers[0]!.u = 0.99;
    cloned.tagIds.push("other");
    cloned.play!.liquid[0]!.x = 0.99;
    assert.equal(source.puru?.markers[0]?.u, 0.25);
    assert.deepEqual(source.tagIds, ["tag-a"]);
    assert.equal(play.liquid[0]?.x, 0.2);
    assert.equal(play.effects[0]?.id, 9);
  });

  it("keeps a launch range that exists only in the live edit", () => {
    const cloned = cloneDisplayEdits(image(), {
      ...emptyLive(),
      liquid: [{ x: 0.5, y: 0.5, w: 0.2, h: 0.2 }],
    });
    assert.equal(cloned.play?.kind, null);
    assert.equal(cloned.play?.liquid.length, 1);
    assert.equal(cloned.play?.liquid[0]?.id, 1);
    assert.equal(cloned.puru, undefined);
  });

  it("keeps the launch range from the button press, not an older saved one", () => {
    const cloned = cloneDisplayEdits(
      image({
        play: {
          kind: null,
          speed: "normal",
          reverse: false,
          zoom: false,
          twist: false,
          zoomPace: "normal",
          twistPace: "normal",
          tilt: null,
          vector: false,
          effect: false,
          effects: [],
          voiceId: null,
          rate: 1,
          volume: 100,
          liquid: [{ id: 8, x: 0.1, y: 0.1, w: 0.2, h: 0.2 }],
          liquidHide: [],
        },
      }),
      { ...emptyLive(), liquid: [{ x: 0.4, y: 0.4, w: 0.3, h: 0.3 }] },
    );
    assert.equal(cloned.play?.liquid.length, 1);
    assert.equal(cloned.play?.liquid[0]?.x, 0.4);
    assert.equal(cloned.play?.liquid[0]?.id, 1);
  });
});
