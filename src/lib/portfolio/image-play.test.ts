import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeImagePlay } from "./image-play.ts";

describe("image play preset", () => {
  it("keeps a preset and drops a playback url", () => {
    const play = normalizeImagePlay({
      kind: "hitY",
      speed: "ultra",
      reverse: true,
      zoom: true,
      twist: true,
      tilt: "left",
      voiceId: "声1.wav",
      src: "/assets/声1-hashed.wav",
      rate: 2,
      volume: 140,
    });
    assert.deepEqual(play, {
      kind: "hitY",
      speed: "ultra",
      reverse: true,
      zoom: true,
      twist: true,
      zoomPace: "normal",
      twistPace: "normal",
      tilt: "left",
      vector: false,
      voiceId: "声1.wav",
      rate: 2,
      volume: 100,
    });
    assert.equal("src" in (play ?? {}), false);
  });

  it("drops a broken preset and keeps two images apart", () => {
    assert.equal(normalizeImagePlay(null), null);
    assert.equal(normalizeImagePlay({}), null);
    assert.equal(normalizeImagePlay({ kind: "nope", speed: "nope", voiceId: "  " })?.kind, null);
    assert.equal(normalizeImagePlay({ kind: "nope", speed: "nope", voiceId: "  " })?.voiceId, null);
    const a = normalizeImagePlay({ kind: "swayX", voiceId: "a.wav", rate: 0.5, volume: 10 });
    const b = normalizeImagePlay({ kind: "buzz", voiceId: "b.wav", rate: 9, volume: -4 });
    assert.equal(a?.voiceId, "a.wav");
    assert.equal(a?.rate, 0.5);
    assert.equal(b?.kind, "buzz");
    assert.equal(b?.rate, 1);
    assert.equal(b?.volume, 0);
    assert.equal(a?.zoomPace, "normal");
    assert.equal(b?.twistPace, "normal");
    const paced = normalizeImagePlay({ kind: "swayX", zoomPace: "fast", twistPace: "slow", zoom: true, twist: true });
    assert.equal(paced?.zoomPace, "fast");
    assert.equal(paced?.twistPace, "slow");
    assert.equal(normalizeImagePlay({ kind: "swayX", zoomPace: "ultra", twistPace: "nope" })?.zoomPace, "normal");
    assert.equal(normalizeImagePlay({ kind: "swayX", zoomPace: "ultra", twistPace: "nope" })?.twistPace, "normal");
    assert.equal(normalizeImagePlay({ kind: "swayX" })?.vector, false);
    assert.equal(normalizeImagePlay({ kind: "hitX", vector: true })?.vector, true);
    assert.equal(normalizeImagePlay({ vector: true })?.kind, null);
    assert.equal(normalizeImagePlay({ vector: true })?.vector, true);
    assert.notEqual(a?.voiceId, b?.voiceId);
  });
});
