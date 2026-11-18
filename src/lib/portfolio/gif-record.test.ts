import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { animationPose, type AnimKind, type AnimSpeed } from "./image-animation.ts";
import { effectCycle } from "./effect-marker.ts";
import { encodeGif, beginGif, indexGifFrame } from "./gif-encode.ts";
import {
  GIF_DELAY_MS,
  GIF_FPS,
  effectCyclesDivide,
  effectSeam,
  gifDelaysMs,
  gifDotFrames,
  gifDotPixelSize,
  gifExportPlan,
  gifFramePlan,
  gifPixelSize,
  gifSuggestedName,
  imageCyclesDivide,
  meshFrames,
  motionAt,
  vectorCyclesDivide,
  vectorSeam,
  type GifMotion,
} from "./gif-record.ts";
import { favoriteRecordMs, vectorCycle, type VectorKind, type VectorPace } from "./vector-marker.ts";
import { openGifReader } from "./gif-decode.ts";
import { goldShift } from "./gold-arc.ts";
import { effectPhase } from "./effect-marker.ts";

const frame = { width: 180, height: 240 };
const speeds: AnimSpeed[] = ["slow", "normal", "fast", "rapid", "ultra"];
const kinds: AnimKind[] = ["swayX", "hitX", "swayY", "hitY", "orbit", "zoom", "buzz"];

describe("gif record", () => {
  it("records two slow hits at 25fps without a spare frame", () => {
    const plan = gifFramePlan();
    assert.equal(favoriteRecordMs(), vectorCycle("hit", "slow") * 2);
    assert.equal(plan.recordMs, 5120);
    assert.equal(plan.fps, GIF_FPS);
    assert.equal(plan.fps, 25);
    assert.equal(plan.frameMs, 40);
    assert.equal(plan.delayMs, GIF_DELAY_MS);
    assert.equal(plan.count, 128);
    assert.equal(plan.times[0], 0);
    assert.equal(plan.times[127], 5080);
    assert.equal(plan.times.includes(plan.recordMs), false);
    assert.equal(gifPixelSize(1774, 887).width, 720);
    assert.equal(gifPixelSize(1774, 887).height, 360);
    assert.equal(gifPixelSize(400, 800).width, 360);
    assert.equal(gifPixelSize(400, 800).height, 720);
    assert.equal(gifSuggestedName("photo.png"), "photo.gif");
    assert.equal(gifSuggestedName("a/b:c"), "abc.gif");
  });

  it("keeps the record length when every second or fourth frame is kept", () => {
    const full = gifExportPlan(128);
    const half = gifExportPlan(64);
    const quarter = gifExportPlan(32);
    assert.deepEqual(full.times, gifFramePlan().times);
    assert.deepEqual(full.delays, Array.from({ length: 128 }, () => 40));
    assert.equal(full.delays.reduce((sum, delay) => sum + delay, 0), full.recordMs);
    assert.equal(half.count, 64);
    assert.equal(half.stride, 2);
    assert.deepEqual(half.times.slice(0, 4), [0, 80, 160, 240]);
    assert.equal(half.times[63], 5040);
    assert.ok(half.delays.every((delay) => delay === 80));
    assert.equal(half.delays.reduce((sum, delay) => sum + delay, 0), half.recordMs);
    assert.equal(quarter.count, 32);
    assert.equal(quarter.stride, 4);
    assert.deepEqual(quarter.times.slice(0, 4), [0, 160, 320, 480]);
    assert.equal(quarter.times[31], 4960);
    assert.ok(quarter.delays.every((delay) => delay === 160));
    assert.equal(quarter.delays.reduce((sum, delay) => sum + delay, 0), quarter.recordMs);
    assert.deepEqual(gifDelaysMs([0, 25], 40), [20, 20]);
    assert.equal(gifDelaysMs([0, 25], 40).reduce((sum, delay) => sum + delay, 0), 40);
  });

  it("fits every listed cycle into the record, including a backbeat", () => {
    assert.equal(imageCyclesDivide(), true);
    assert.equal(vectorCyclesDivide(), true);
    assert.equal(effectCyclesDivide(), true);
    const record = favoriteRecordMs();
    for (const kind of kinds) {
      for (const speed of speeds) {
        const start = animationPose(kind, speed, 0, frame);
        const end = animationPose(kind, speed, record, frame);
        assert.ok(Math.abs(start.x - end.x) < 0.02, `${kind} ${speed} x`);
        assert.ok(Math.abs(start.y - end.y) < 0.02, `${kind} ${speed} y`);
        assert.ok(Math.abs(start.scale - end.scale) < 0.001, `${kind} ${speed} scale`);
      }
    }
    const vectorKinds: VectorKind[] = ["orbit", "orbitBack", "sway", "push", "hit", "expand", "shrink", "react", "buzz"];
    const paces: VectorPace[] = ["slow", "normal", "fast"];
    for (const kind of vectorKinds) for (const pace of paces) assert.ok(vectorSeam(kind, pace) < 0.001, `${kind} ${pace}`);
    for (const pace of paces) {
      assert.equal(effectSeam(pace), 0);
      assert.equal(effectCycle(pace) === effectCycle(pace), true);
      const rest = goldShift(0.42, 0.33, effectPhase(pace, 0));
      const end = goldShift(0.42, 0.33, effectPhase(pace, record));
      assert.equal(rest.dx, end.dx);
      assert.equal(rest.dy, end.dy);
      const beat = goldShift(0.42, 0.33, effectPhase(pace, 0, true));
      const beatEnd = goldShift(0.42, 0.33, effectPhase(pace, record, true));
      assert.equal(beat.dx, beatEnd.dx);
      assert.equal(beat.dy, beatEnd.dy);
    }
    const motion: GifMotion = {
      kind: "swayX",
      speed: "fast",
      reverse: true,
      zoom: true,
      twist: true,
      zoomPace: "slow",
      twistPace: "fast",
      tilt: "left",
    };
    const a = motionAt(motion, 0, frame);
    const b = motionAt(motion, record, frame);
    assert.ok(Math.abs(a.x - b.x) < 0.02);
    assert.ok(Math.abs(a.y - b.y) < 0.02);
    assert.ok(Math.abs(a.scale - b.scale) < 0.001);
    assert.ok(Math.abs(a.rotate - b.rotate) < 0.001);
  });

  it("repeats a puru mesh from rest with a fixed step", () => {
    const play: GifMotion = {
      kind: "hitX",
      speed: "normal",
      reverse: false,
      zoom: true,
      twist: false,
      zoomPace: "normal",
      twistPace: "normal",
      tilt: null,
    };
    const puru = [{ id: 1, kind: "mid" as const, u: 0.45, v: 0.55, radius: 0.3 }];
    const vectors = [{ id: 7, kind: "buzz" as const, pace: "fast" as const, u: 0.45, v: 0.55, radius: 0.28, angle: 0.5, backbeat: true }];
    const first = meshFrames({ play, puru, vectors, width: 96, height: 120 });
    const second = meshFrames({ play, puru, vectors, width: 96, height: 120 });
    assert.ok(first);
    assert.ok(second);
    assert.equal(first.frames.length, 128);
    assert.ok(first.seam < 0.05, `seam ${first.seam}`);
    assert.equal(first.seam, second.seam);
    assert.equal(first.frames[0]?.[10], second.frames[0]?.[10]);
    assert.equal(first.frames[40]?.[80], second.frames[40]?.[80]);
    const half = meshFrames({ play, puru, vectors, width: 96, height: 120, count: 64 });
    const quarter = meshFrames({ play, puru, vectors, width: 96, height: 120, count: 32 });
    assert.equal(half?.frames.length, 64);
    assert.equal(quarter?.frames.length, 32);
    assert.equal(half?.frames[0]?.[10], first.frames[0]?.[10]);
    assert.equal(half?.frames[1]?.[80], first.frames[2]?.[80]);
    assert.equal(quarter?.frames[3]?.[40], first.frames[12]?.[40]);
    assert.equal(half?.seam, first.seam);
    const still = meshFrames({
      play: { ...play, kind: null, zoom: false },
      puru: [],
      vectors,
      width: 96,
      height: 120,
    });
    assert.equal(still, null);
  });
});

describe("gif encode", () => {
  it("dithers to 256 colors, keeps a transparent margin, and loops", () => {
    const width = 4;
    const height = 2;
    const rgba = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      rgba[i * 4] = i * 30;
      rgba[i * 4 + 1] = 40;
      rgba[i * 4 + 2] = 200 - i * 20;
      rgba[i * 4 + 3] = i === 0 ? 0 : 255;
    }
    const indexed = indexGifFrame(rgba, width, height);
    assert.equal(indexed.transparent, true);
    assert.equal(indexed.index[0], 0);
    assert.ok(indexed.palette.length <= 256);
    assert.ok(indexed.palette.length >= 2);
    const bytes = encodeGif([{ rgba, width, height }]);
    assert.equal(String.fromCharCode(...bytes.subarray(0, 6)), "GIF89a");
    const mark = String.fromCharCode(...bytes);
    assert.equal(mark.includes("NETSCAPE2.0"), true);
  });

  it("stores 128, 64, and 32 holds that add up to the same record", () => {
    const pixel = new Uint8Array([200, 10, 10, 255]);
    for (const count of [128, 64, 32] as const) {
      const plan = gifExportPlan(count);
      const gif = beginGif();
      for (const delay of plan.delays) gif.frame(pixel, 1, 1, delay);
      const reader = openGifReader(gif.finish());
      const delays: number[] = [];
      for (;;) {
        const frame = reader.next();
        if (!frame) break;
        delays.push(frame.delayMs);
      }
      assert.equal(delays.length, count);
      assert.deepEqual(delays, plan.delays);
      assert.equal(delays.reduce((sum, delay) => sum + delay, 0), plan.recordMs);
    }
  });

  it("writes a dot-by-dot gif at the slider size without stretching it back", () => {
    for (const cols of [16, 32, 64, 128, 256]) {
      assert.deepEqual(gifDotPixelSize(720, 720, cols), { width: cols, height: cols });
    }
    assert.deepEqual(gifDotPixelSize(1774, 887, 64), { width: 64, height: 32 });
    assert.deepEqual(gifDotPixelSize(400, 800, 32), { width: 32, height: 64 });
    const width = 32;
    const height = 16;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = (y * width + x) * 4;
        if (x < 16) continue;
        const band = Math.floor((x - 16) / 2);
        rgba[at] = (band * 37) % 256;
        rgba[at + 1] = (band * 91) % 256;
        rgba[at + 2] = (band * 13) % 256;
        rgba[at + 3] = 255;
      }
    }
    const open = gifDotFrames(
      [
        { rgba, width, height },
        { rgba, width, height },
      ],
      16,
      null,
    );
    assert.equal(open.length, 2);
    assert.deepEqual(
      open.map((frame) => [frame.width, frame.height, frame.rgba.length]),
      [
        [16, 8, 16 * 8 * 4],
        [16, 8, 16 * 8 * 4],
      ],
    );
    assert.equal(open[0]?.rgba[3], 0);
    const colored = gifDotFrames([{ rgba, width, height }], 16, 16);
    assert.equal(colored[0]?.rgba[3], 0);
    const seen = new Set<number>();
    const data = colored[0]?.rgba ?? new Uint8ClampedArray();
    for (let index = 0; index < data.length; index += 4) {
      if ((data[index + 3] ?? 0) === 0) continue;
      seen.add(((data[index] ?? 0) << 16) | ((data[index + 1] ?? 0) << 8) | (data[index + 2] ?? 0));
    }
    assert.ok(seen.size >= 1);
    assert.ok(seen.size <= 16);
    const plan = gifExportPlan(32);
    const gif = beginGif();
    for (let index = 0; index < 2; index += 1) {
      const frame = open[index];
      if (!frame) continue;
      gif.frame(frame.rgba, frame.width, frame.height, plan.delays[index] ?? plan.delayMs);
    }
    const reader = openGifReader(gif.finish());
    assert.equal(reader.width, 16);
    assert.equal(reader.height, 8);
    const decoded = reader.next();
    assert.equal(decoded?.rgba[3], 0);
    assert.equal(decoded?.delayMs, plan.delays[0]);
    assert.ok((decoded?.rgba[(15 * 4) + 3] ?? 0) > 0);
  });
});
