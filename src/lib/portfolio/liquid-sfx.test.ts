import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { DRIP_SOUND_IDS, FIRE_SOUND_IDS, claimSound, resetSoundBags, soundBagSize } from "./liquid-sfx.ts";

const audioDir = new URL("../../../reference/liquid-assets/audio/", import.meta.url);

describe("liquid sound bags", () => {
  it("keeps the six filenames, including fullwidth and halfwidth digits", () => {
    assert.equal(FIRE_SOUND_IDS[0]?.codePointAt(3), 0xff11);
    assert.equal(FIRE_SOUND_IDS[1]?.codePointAt(3), 0xff12);
    assert.equal(FIRE_SOUND_IDS[2]?.codePointAt(3), 0xff13);
    assert.equal(FIRE_SOUND_IDS[3]?.codePointAt(3), 0x34);
    assert.equal(DRIP_SOUND_IDS[0]?.codePointAt(4), 0x31);
    assert.equal(DRIP_SOUND_IDS[1]?.codePointAt(4), 0x32);
    assert.notEqual(DRIP_SOUND_IDS[0], DRIP_SOUND_IDS[1]);
    const onDisk = new Set(fs.readdirSync(audioDir));
    for (const name of [...FIRE_SOUND_IDS, ...DRIP_SOUND_IDS]) {
      assert.equal(onDisk.has(name), true, name);
      const bytes = fs.readFileSync(new URL(name, audioDir));
      assert.ok(bytes.length > 1000);
      assert.equal(bytes.subarray(0, 3).toString(), "ID3");
    }
  });

  it("plays each fire sound once per cycle and does not repeat the edge", () => {
    resetSoundBags();
    const first: string[] = [];
    for (let i = 0; i < 4; i++) first.push(claimSound("fire", () => true) as string);
    assert.equal(new Set(first).size, 4);
    const second: string[] = [];
    for (let i = 0; i < 4; i++) second.push(claimSound("fire", () => true) as string);
    assert.equal(new Set(second).size, 4);
    assert.notEqual(second[0], first[3]);
  });

  it("keeps the two drip sounds independent of the fire bag", () => {
    resetSoundBags();
    for (let i = 0; i < 4; i++) claimSound("fire", () => true);
    assert.equal(soundBagSize("drip"), 0);
    const first = claimSound("drip", () => true);
    const second = claimSound("drip", () => true);
    assert.equal(new Set([first, second]).size, 2);
    const third = claimSound("drip", () => true);
    assert.notEqual(third, second);
    assert.equal(soundBagSize("fire"), 0);
  });

  it("does not spend a sound that is not ready", () => {
    resetSoundBags();
    assert.equal(claimSound("fire", () => false), null);
    assert.equal(soundBagSize("fire"), 4);
    const id = claimSound("fire", (name) => name === "発射音4.mp3");
    assert.equal(id, "発射音4.mp3");
    assert.equal(soundBagSize("fire"), 3);
    assert.equal(claimSound("fire", () => false), null);
    assert.equal(soundBagSize("fire"), 3);
    assert.equal(soundBagSize("drip"), 0);
  });
});
