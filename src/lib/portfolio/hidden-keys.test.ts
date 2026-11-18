import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { favoritePlaybackLive, hiddenArrowCommand } from "./hidden-keys.ts";

const ready = {
  key: "ArrowUp",
  repeat: false,
  held: false,
  phone: false,
  hidden: true,
  typing: false,
  editing: false,
  favoriteLive: false,
  hasFavorite: true,
  canLiquid: true,
  liquidMode: false,
  liquidBooting: false,
};

describe("hidden arrow keys", () => {
  it("toggles the saved favorite from the real playback state", () => {
    assert.equal(hiddenArrowCommand(ready), "favorite-play");
    assert.equal(hiddenArrowCommand({ ...ready, favoriteLive: true }), "favorite-stop");
    assert.equal(hiddenArrowCommand({ ...ready, favoriteLive: true, hasFavorite: true }), "favorite-stop");
    assert.equal(hiddenArrowCommand({ ...ready, hasFavorite: false, favoriteLive: false }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, hasFavorite: false, favoriteLive: true }), "ignore");
  });

  it("does not treat an unsaved channel, or a missing favorite, as playback", () => {
    assert.equal(favoritePlaybackLive({ hasFavorite: false, savedAnim: false, animRunning: true, savedVoice: false, voiceRunning: false, savedVector: false, vectorRunning: false }), false);
    assert.equal(favoritePlaybackLive({ hasFavorite: true, savedAnim: true, animRunning: true, savedVoice: false, voiceRunning: false, savedVector: false, vectorRunning: false }), true);
    assert.equal(favoritePlaybackLive({ hasFavorite: true, savedAnim: true, animRunning: false, savedVoice: false, voiceRunning: false, savedVector: false, vectorRunning: false }), false);
    assert.equal(favoritePlaybackLive({ hasFavorite: true, savedAnim: false, animRunning: true, savedVoice: true, voiceRunning: false, savedVector: false, vectorRunning: false }), false);
    assert.equal(favoritePlaybackLive({ hasFavorite: true, savedAnim: false, animRunning: false, savedVoice: true, voiceRunning: true, savedVector: false, vectorRunning: false }), true);
    assert.equal(favoritePlaybackLive({ hasFavorite: true, savedAnim: true, animRunning: false, savedVoice: true, voiceRunning: true, savedVector: false, vectorRunning: false }), true);
    assert.equal(favoritePlaybackLive({ hasFavorite: true, savedAnim: false, animRunning: false, savedVoice: false, voiceRunning: false, savedVector: true, vectorRunning: true }), true);
    assert.equal(favoritePlaybackLive({ hasFavorite: true, savedAnim: false, animRunning: false, savedVoice: false, voiceRunning: false, savedVector: true, vectorRunning: false }), false);
  });

  it("arms liquid before it fires, and does not fire while the kit is loading", () => {
    assert.equal(hiddenArrowCommand({ ...ready, key: "ArrowDown" }), "liquid-arm");
    assert.equal(hiddenArrowCommand({ ...ready, key: "ArrowDown", liquidMode: true }), "liquid-fire");
    assert.equal(hiddenArrowCommand({ ...ready, key: "ArrowDown", liquidBooting: true }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, key: "ArrowDown", liquidMode: true, liquidBooting: true }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, key: "ArrowDown", canLiquid: false }), "ignore");
  });

  it("ignores repeats, other modes, typing, and unrelated keys", () => {
    assert.equal(hiddenArrowCommand({ ...ready, repeat: true }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, held: true }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, key: "ArrowDown", repeat: true, liquidMode: true }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, phone: true }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, hidden: false }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, typing: true }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, editing: true }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, key: "ArrowLeft" }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, key: "ArrowRight" }), "ignore");
    assert.equal(hiddenArrowCommand({ ...ready, key: " " }), "ignore");
  });
});
