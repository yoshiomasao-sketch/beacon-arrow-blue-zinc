import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVoiceLibrary, displayName, normalizeVoiceRate, applyVoiceRate, voiceRateLabel, volumeToGain } from "./voice-library.ts";

describe("voice library", () => {
  it("turns the slider percent into a gain from silence to full", () => {
    assert.equal(volumeToGain(0), 0);
    assert.equal(volumeToGain(100), 1);
    assert.equal(volumeToGain(40), 0.4);
    assert.equal(volumeToGain(-20), 0);
    assert.equal(volumeToGain(140), 1);
    assert.equal(volumeToGain(Number.NaN), 1);
  });

  it("keeps four playback speeds and does not move or pause the audio", () => {
    assert.deepEqual(normalizeVoiceRate(1), 1);
    assert.equal(normalizeVoiceRate(3), 1);
    assert.equal(voiceRateLabel(0.5), "0.5倍速");
    assert.equal(voiceRateLabel(1), "1.0倍速");
    assert.equal(voiceRateLabel(2), "2.0倍速");
    const audio = {
      playbackRate: 1,
      preservesPitch: false,
      webkitPreservesPitch: false,
      currentTime: 4.25,
      paused: false,
    } as HTMLAudioElement & { webkitPreservesPitch?: boolean };
    applyVoiceRate(audio, 1.5);
    assert.equal(audio.playbackRate, 1.5);
    assert.equal(audio.preservesPitch, true);
    assert.equal(audio.webkitPreservesPitch, true);
    assert.equal(audio.currentTime, 4.25);
    assert.equal(audio.paused, false);
    applyVoiceRate(audio, 9);
    assert.equal(audio.playbackRate, 1);
    assert.equal(audio.currentTime, 4.25);
  });

  it("uses a display name when one is set, otherwise a readable file name", () => {
    assert.equal(displayName("soft_rain.mp3", { "soft_rain.mp3": "静かな雨" }), "静かな雨");
    assert.equal(displayName("folder/soft-rain.wav", {}), "soft rain");
    assert.equal(displayName("波.mp3", { "波.mp3": "   " }), "波");
    assert.equal(displayName("tone.mp3", { "tone.mp3": 12 }), "tone");
  });

  it("lists only real audio files and leaves an empty folder empty", () => {
    assert.deepEqual(buildVoiceLibrary({}), []);
    const tracks = buildVoiceLibrary(
      {
        "/voices/labels.json": "{}",
        "/voices/note.txt": "/note.txt",
        "/voices/b_low.mp3": "/audio/b_low.mp3",
        "/voices/a-high.wav": "",
        "/voices/静かな雨.m4a": "/audio/rain.m4a",
      },
      { "b_low.mp3": "低い音" },
    );
    const labels = tracks.map((track) => track.label);
    assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, "ja")));
    assert.equal(tracks.find((track) => track.id === "b_low.mp3")?.label, "低い音");
    assert.equal(tracks.find((track) => track.id === "b_low.mp3")?.src, "/audio/b_low.mp3");
    assert.equal(tracks.find((track) => track.id === "静かな雨.m4a")?.label, "静かな雨");
    assert.equal(tracks.find((track) => track.id === "静かな雨.m4a")?.src, "/audio/rain.m4a");
  });
});
