import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoFavoriteMode, favoriteAskCopy, normalizeImagePlay } from "./image-play.ts";

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
      effect: false,
      effects: [],
      voiceId: "声1.wav",
      rate: 2,
      volume: 100,
      liquid: [],
      liquidHide: [],
    });
    assert.equal("src" in (play ?? {}), false);
  });

  it("keeps effect backbeats and reads an older favorite as the downbeat", () => {
    const play = normalizeImagePlay({
      effect: true,
      effects: [
        { id: 3, kind: "splash", asset: "splash_01", pace: "fast", u: 0.2, v: 0.4, size: 0.3, angle: 1, backbeat: true, off: true },
        { id: 4, kind: "splash", asset: "splash_01", pace: "normal", u: 0.6, v: 0.4, size: 0.3, angle: 0 },
      ],
    });
    assert.equal(play?.effects[0]?.backbeat, true);
    assert.equal(play?.effects[0]?.off, true);
    assert.equal(play?.effects[1]?.backbeat, undefined);
    assert.equal(play?.effects[1]?.off, undefined);
    assert.equal(play?.effects[0]?.pace, "fast");
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
    assert.equal(normalizeImagePlay({ kind: "swayX" })?.effect, false);
    assert.equal(normalizeImagePlay({ kind: "swayX" })?.effects.length, 0);
    assert.equal(normalizeImagePlay({ kind: "hitX", vector: true, effect: true })?.effect, true);
    assert.equal(normalizeImagePlay({ kind: "hitX", vector: true })?.vector, true);
    assert.equal(normalizeImagePlay({ vector: true })?.kind, null);
    assert.equal(normalizeImagePlay({ vector: true })?.vector, true);
    assert.equal(normalizeImagePlay({ kind: "swayX", liquid: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 } })?.liquid[0]?.x, 0.1);
    assert.equal(normalizeImagePlay({ kind: "swayX", liquid: { x: 0, y: 0, w: 0.01, h: 0.5 } })?.liquid.length, 0);
    assert.equal(normalizeImagePlay({ kind: "swayX" })?.liquid.length, 0);
    assert.notEqual(a?.voiceId, b?.voiceId);
  });

  it("starts a saved favorite only in the phone viewer or the PC hidden tools", () => {
    assert.equal(autoFavoriteMode(true, false), true);
    assert.equal(autoFavoriteMode(false, true), true);
    assert.equal(autoFavoriteMode(true, true), true);
    assert.equal(autoFavoriteMode(false, false), false);
  });

  it("names the animation and the voice that a new favorite would save", () => {
    const both = favoriteAskCopy(
      normalizeImagePlay({ kind: "swayX", speed: "fast", zoom: true, vector: true, voiceId: "a.wav" })!,
      "朝の声",
    );
    assert.deepEqual(both.lines, ["このアニメーションをお気に入りに登録しますか？", "この音声をお気に入りに登録しますか？"]);
    assert.equal(both.names[0], "横揺れ・ゆるやか・速い、ズーム、ベクトルマーカー");
    assert.equal(both.names[1], "朝の声");
    const voiceOnly = favoriteAskCopy(normalizeImagePlay({ voiceId: "a.wav" })!, "朝の声");
    assert.deepEqual(voiceOnly.lines, ["この音声をお気に入りに登録しますか？"]);
    assert.deepEqual(voiceOnly.names, ["朝の声"]);
    const animOnly = favoriteAskCopy(normalizeImagePlay({ kind: "buzz", speed: "slow", tilt: "left" })!, null);
    assert.deepEqual(animOnly.lines, ["このアニメーションをお気に入りに登録しますか？"]);
    assert.equal(animOnly.names[0], "通知バイブレーション・遅い、左45度");
    const stopped = favoriteAskCopy(normalizeImagePlay({ kind: null, voiceId: null })!, "  ");
    assert.deepEqual(stopped.lines, ["このアニメーションをお気に入りに登録しますか？"]);
    assert.deepEqual(stopped.names, ["停止"]);
    const ranged = favoriteAskCopy(
      normalizeImagePlay({ kind: "swayX", speed: "fast", liquid: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } })!,
      null,
    );
    assert.equal(ranged.names[0], "横揺れ・ゆるやか・速い、発射範囲");
    const hidden = favoriteAskCopy(
      normalizeImagePlay({
        kind: null,
        liquidHide: [
          { shape: "circle", id: 2, x: 0.2, y: 0.25, w: 0.2, h: 0.24, angle: 0.3 },
          { shape: "rect", x: 0.6, y: 0.1, w: 0.2, h: 0.3, pitch: -0.1 },
        ],
      })!,
      null,
    );
    assert.equal(hidden.names[0], "非表示");
    const holes = normalizeImagePlay({
      kind: null,
      liquidHide: [
        { shape: "circle", id: 2, x: 0.2, y: 0.25, w: 0.2, h: 0.24, angle: 0.3 },
        { shape: "rect", x: 0.6, y: 0.1, w: 0.2, h: 0.3, pitch: -0.1 },
      ],
    });
    assert.equal(holes?.liquid.length, 0);
    assert.equal(holes?.liquidHide.length, 2);
    assert.equal(holes?.liquidHide[0]?.shape, "circle");
    assert.equal(holes?.liquidHide[0]?.id, 2);
    assert.equal(holes?.liquidHide[1]?.shape, "rect");
    assert.ok(Math.abs((holes?.liquidHide[0]?.angle ?? 0) - 0.3) < 1e-4);
    assert.equal(normalizeImagePlay({ kind: "swayX" })?.liquidHide.length, 0);
    const angled = normalizeImagePlay({ kind: null, liquid: { x: 0.3, y: 0.4, w: 0.4, h: 0.2, angle: Math.PI / 2 } });
    assert.equal(angled?.liquid.length, 1);
    assert.ok(Math.abs((angled?.liquid[0]?.angle ?? 0) - Math.PI / 2) < 1e-4);
    assert.equal(angled?.liquid[0]?.x, 0.3);
    assert.equal(angled?.liquid[0]?.lean, undefined);
    assert.equal(angled?.liquid[0]?.pitch, undefined);
    const upright = normalizeImagePlay({ kind: null, liquid: { x: 0.2, y: 0.2, w: 0.4, h: 0.3 } });
    assert.equal(upright?.liquid[0]?.angle, 0);
    assert.equal(upright?.liquid[0]?.id, 1);
    const stacked = normalizeImagePlay({
      kind: null,
      liquid: [
        { id: 2, x: 0.05, y: 0.05, w: 0.2, h: 0.2, lean: 0.2 },
        { id: 3, x: 0.5, y: 0.5, w: 0.2, h: 0.3, pitch: -0.2 },
        { x: 0, y: 0, w: 0.01, h: 0.5 },
      ],
    });
    assert.deepEqual(
      stacked?.liquid.map((range) => range.id),
      [2, 3],
    );
    assert.equal(stacked?.liquid[0]?.lean !== undefined, true);
    assert.equal(stacked?.liquid[1]?.pitch !== undefined, true);
    assert.equal(stacked?.liquid[1]?.lean, undefined);
    const kept = stacked?.liquid.filter((range) => range.id !== 2) ?? [];
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.id, 3);
    assert.equal(kept[0]?.x, 0.5);
    const hung = normalizeImagePlay({
      kind: null,
      liquid: { id: 4, x: -0.35, y: 1.1, w: 0.8, h: 0.5, angle: 0.4, lean: 0.25, pitch: -0.15 },
    });
    assert.equal(hung?.liquid.length, 1);
    assert.equal(hung?.liquid[0]?.id, 4);
    assert.equal(hung?.liquid[0]?.x, -0.35);
    assert.equal(hung?.liquid[0]?.y, 1.1);
    assert.equal(hung?.liquid[0]?.w, 0.8);
    assert.equal(hung?.liquid[0]?.h, 0.5);
    assert.ok(Math.abs((hung?.liquid[0]?.angle ?? 0) - 0.4) < 1e-4);
    assert.ok(Math.abs((hung?.liquid[0]?.lean ?? 0) - 0.25) < 1e-4);
    assert.ok(Math.abs((hung?.liquid[0]?.pitch ?? 0) + 0.15) < 1e-4);
  });
});
