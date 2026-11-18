import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { goldSoundMode } from "./gold-sound.ts";

describe("gold sound", () => {
  it("loops one shared sound only while a visible gold marker is animating", () => {
    assert.equal(goldSoundMode({ playing: true, preview: false, held: false, goldVisible: true }), "play");
    assert.equal(goldSoundMode({ playing: true, preview: false, held: false, goldVisible: false }), "stop");
    assert.equal(goldSoundMode({ playing: false, preview: true, held: true, goldVisible: true }), "play");
    assert.equal(goldSoundMode({ playing: false, preview: false, held: true, goldVisible: true }), "pause");
    assert.equal(goldSoundMode({ playing: false, preview: false, held: false, goldVisible: true }), "stop");
    assert.equal(goldSoundMode({ playing: true, preview: true, held: false, goldVisible: false }), "stop");
  });
});
