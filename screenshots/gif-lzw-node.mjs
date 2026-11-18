import { GIFEncoder } from "/workspace/node_modules/gifenc/dist/gifenc.esm.js";
import { openGifReader } from "/workspace/src/lib/portfolio/gif-decode.ts";

const width = 180;
const height = 120;
const index = new Uint8Array(width * height);
for (let i = 0; i < index.length; i += 1) index[i] = (i * 17 + (i % width) * 3) % 256;
const palette = [];
for (let i = 0; i < 256; i += 1) palette.push([(i * 37) % 256, (i * 91) % 256, (i * 13) % 256]);
const gif = GIFEncoder();
gif.writeFrame(index, width, height, { palette, delay: 4 });
gif.finish();
const frame = openGifReader(gif.bytes()).next();
let first = -1;
let bad = 0;
for (let i = 0; i < index.length; i += 1) {
  const at = i * 4;
  const got = frame.rgba[at];
  const expect = palette[index[i]][0];
  if (got !== expect) {
    bad += 1;
    if (first < 0) first = i;
  }
}
console.log({ bad, first, expectIndex: first < 0 ? null : index[first], expectR: first < 0 ? null : palette[index[first]][0], gotR: first < 0 ? null : frame.rgba[first * 4] });
