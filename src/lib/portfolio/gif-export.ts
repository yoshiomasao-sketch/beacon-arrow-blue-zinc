/**
 * PC favorite → silent GIF.
 * Motion comes from the same functions playback uses. This file only draws
 * those poses. It does not start audio and it does not touch the live clock.
 */

import { GOLD_COLS, GOLD_PAD_X, GOLD_PAD_Y, GOLD_ROWS, goldVertex } from "./gold-arc.ts";
import { effectDrawSize, effectOpacity, effectPhase, type EffectMarker } from "./effect-marker.ts";
import { loadEffectAsset, effectImage } from "./effect-assets.ts";
import { absorbOpaque, averageCells, fillCells, mapCells, mapPixelBuffer, paletteFromCells, paletteFromHistogram, DOT_COLOR_DEFAULT, DOT_DEFAULT, snapDotColors } from "./dot-filter.ts";
import { recipeIsPlain, renderDotImage, type DotRecipe } from "./dot-recipe.ts";
import { beginGif } from "./gif-encode.ts";
import { GIF_DELAY_MS, gifDotFrames, gifExportPlan, gifPixelSize, meshFrames, motionAt, type GifExportCount, type GifMotion } from "./gif-record.ts";
import { logGifSave, type GifSaveStage } from "./gif-save.ts";
import type { PuruMarker } from "./purupuru.ts";
import { PURU_GRID } from "./purupuru.ts";
import type { VectorMarker } from "./vector-marker.ts";

export type GifProgress = { stage: "生成開始" | "フレーム生成" | "GIFエンコード" | "保存" | "保存先を選択"; percent: number };

function releaseGl(gl: WebGLRenderingContext | null) {
  if (!gl) return;
  try {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    /* the context is already gone */
  }
}

function saveTrace(id: number, stage: GifSaveStage, bytes: number | null = null) {
  if (!id) return;
  logGifSave({
    id,
    stage,
    errorName: "",
    errorMessage: "",
    bytes,
    mime: bytes === null ? null : "image/gif",
    method: "showSaveFilePicker",
    encoder: "gifenc:new",
    worker: "none",
  });
}

function rest(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function stop(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("The operation was aborted.", "AbortError");
}

const MESH_VERT = `
attribute vec2 aUv;
attribute vec2 aDisp;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vec2 px = aUv * uSize + aDisp;
  gl_Position = vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
  vUv = aUv;
}
`;

const MESH_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uImage;
void main() {
  gl_FragColor = texture2D(uImage, vUv);
}
`;

const GOLD_VERT = `
attribute vec2 aPos;
attribute vec2 aUv;
varying vec2 vUv;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  vUv = aUv;
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function link(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string, attribs: string[]): WebGLProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vert || !frag) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  attribs.forEach((name, index) => gl.bindAttribLocation(program, index, name));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  return program;
}

function meshPainter(image: CanvasImageSource, width: number, height: number): { paint: (disp: Float32Array, target: CanvasRenderingContext2D) => void; release: () => void } | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  if (!gl) return null;
  const release = () => releaseGl(gl);
  const program = link(gl, MESH_VERT, MESH_FRAG, ["aUv", "aDisp"]);
  if (!program) {
    release();
    return null;
  }
  const cols = PURU_GRID;
  const uv = new Float32Array(cols * cols * 2);
  const indices = new Uint16Array((cols - 1) * (cols - 1) * 6);
  let cursor = 0;
  for (let row = 0; row < cols; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const vertex = row * cols + col;
      uv[vertex * 2] = col / (cols - 1);
      uv[vertex * 2 + 1] = row / (cols - 1);
      if (row < cols - 1 && col < cols - 1) {
        const next = vertex + cols;
        indices[cursor++] = vertex;
        indices[cursor++] = next;
        indices[cursor++] = vertex + 1;
        indices[cursor++] = vertex + 1;
        indices[cursor++] = next;
        indices[cursor++] = next + 1;
      }
    }
  }
  const uvBuf = gl.createBuffer();
  const dispBuf = gl.createBuffer();
  const indexBuf = gl.createBuffer();
  const texture = gl.createTexture();
  if (!uvBuf || !dispBuf || !indexBuf || !texture) {
    release();
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, dispBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cols * cols * 2), gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image as TexImageSource);
  gl.uniform1i(gl.getUniformLocation(program, "uImage"), 0);
  const sizeLoc = gl.getUniformLocation(program, "uSize");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  return {
    release,
    paint(disp, target) {
    gl.useProgram(program);
    gl.viewport(0, 0, width, height);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, dispBuf);
    gl.bufferData(gl.ARRAY_BUFFER, disp, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    gl.uniform2f(sizeLoc, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    target.drawImage(canvas, 0, 0);
    },
  };
}

function goldPainter(image: CanvasImageSource): { paint: (phase: number, width: number, height: number, flip: boolean, target: CanvasRenderingContext2D, left: number, top: number) => void; release: () => void } | null {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true });
  if (!gl) return null;
  const release = () => releaseGl(gl);
  const program = link(gl, GOLD_VERT, MESH_FRAG, ["aPos", "aUv"]);
  if (!program) {
    release();
    return null;
  }
  const count = (GOLD_COLS + 1) * (GOLD_ROWS + 1);
  const data = new Float32Array(count * 4);
  const indices = new Uint16Array(GOLD_COLS * GOLD_ROWS * 6);
  let cursor = 0;
  const stride = GOLD_COLS + 1;
  for (let row = 0; row < GOLD_ROWS; row += 1) {
    for (let col = 0; col < GOLD_COLS; col += 1) {
      const index = row * stride + col;
      indices[cursor++] = index;
      indices[cursor++] = index + 1;
      indices[cursor++] = index + stride;
      indices[cursor++] = index + 1;
      indices[cursor++] = index + stride + 1;
      indices[cursor++] = index + stride;
    }
  }
  const buffer = gl.createBuffer();
  const index = gl.createBuffer();
  const texture = gl.createTexture();
  if (!buffer || !index || !texture) {
    release();
    return null;
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image as TexImageSource);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return {
    release,
    paint(phase, width, height, flip, target, left, top) {
    const cssW = Math.max(2, Math.round(width));
    const cssH = Math.max(2, Math.round(height));
    if (canvas.width !== cssW || canvas.height !== cssH) {
      canvas.width = cssW;
      canvas.height = cssH;
    }
    let n = 0;
    for (let row = 0; row <= GOLD_ROWS; row += 1) {
      for (let col = 0; col <= GOLD_COLS; col += 1) {
        const vertex = goldVertex(col, row, phase);
        data[n++] = vertex.x;
        data[n++] = vertex.y;
        data[n++] = vertex.u;
        data[n++] = vertex.v;
      }
    }
    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    target.save();
    if (flip) {
      target.translate(left + cssW, top);
      target.scale(-1, 1);
      target.drawImage(canvas, 0, 0, cssW, cssH);
    } else target.drawImage(canvas, left, top, cssW, cssH);
    target.restore();
    },
  };
}

export async function renderFavoriteGif(input: {
  image: CanvasImageSource;
  natural: { width: number; height: number };
  play: GifMotion;
  puru: readonly PuruMarker[];
  vectors: readonly VectorMarker[];
  effects: readonly EffectMarker[];
  signal: AbortSignal;
  saveId: number;
  /** Horizontal mosaic cells. Null leaves the picture sharp. The grid is the frame, not the warp. */
  dotCols?: number | null;
  /** Opaque colors shared by every frame. Null skips reduction. Independent of the mosaic. */
  dotColors?: number | null;
  /** 128 keeps every sample. 64 and 32 drop frames and hold the rest so the record length stays. */
  frames?: GifExportCount;
  /** Store one pixel per dot cell. Off keeps the usual export size. */
  dotByDot?: boolean;
  /** Slider columns used only when `dotByDot` is on. */
  dotByDotCols?: number | null;
  /** Opaque color cap used only when `dotByDot` is on. Null skips reduction. */
  dotByDotColors?: number | null;
  /**
   * Extra dot recipe. A plain recipe keeps the old shared-palette mosaic.
   * A fancy one is painted per frame, same as the preview.
   */
  dotRecipe?: DotRecipe | null;
  onProgress: (progress: GifProgress) => void;
}): Promise<Uint8Array> {
  const size = gifPixelSize(input.natural.width, input.natural.height);
  const plan = gifExportPlan(input.frames ?? 128);
  input.onProgress({ stage: "生成開始", percent: 1 });
  await rest();
  stop(input.signal);
  const sheets = new Map<string, CanvasImageSource>();
  for (const marker of input.effects) {
    if (marker.off === true || sheets.has(marker.asset)) continue;
    const ok = await loadEffectAsset(marker.asset);
    stop(input.signal);
    const image = ok ? effectImage(marker.asset) : null;
    if (image && image.naturalWidth > 0) sheets.set(marker.asset, image);
  }
  const warped = meshFrames({
    play: input.play,
    puru: input.puru,
    vectors: input.vectors,
    width: size.width,
    height: size.height,
    count: input.frames ?? 128,
  });
  const paintMesh = warped ? meshPainter(input.image, size.width, size.height) : null;
  const goldSheet = sheets.get("splash_03");
  const gold = goldSheet && input.effects.some((marker) => marker.kind === "gold" && marker.off !== true) ? goldPainter(goldSheet) : null;
  try {
  const visualMotion =
    input.play.kind !== null ||
    input.play.zoom ||
    input.play.twist ||
    warped !== null ||
    input.effects.some((marker) => marker.off !== true);
  const times = visualMotion ? plan.times : [0];
  const holds = visualMotion ? plan.delays : [GIF_DELAY_MS];
  const photo = document.createElement("canvas");
  photo.width = size.width;
  photo.height = size.height;
  const photoCtx = photo.getContext("2d", { alpha: true });
  const out = document.createElement("canvas");
  out.width = size.width;
  out.height = size.height;
  const outCtx = out.getContext("2d", { alpha: true });
  if (!photoCtx || !outCtx) throw new Error("canvas");
  const byDot = input.dotByDot === true;
  const fancyRecipe = byDot && input.dotRecipe && !recipeIsPlain(input.dotRecipe) ? input.dotRecipe : null;
  const paintCols = byDot ? null : (input.dotCols ?? null);
  const paintColors = byDot ? null : (input.dotColors ?? null);
  photoCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingEnabled = paintCols == null && paintColors == null;
  const gif = beginGif(plan.delayMs);
  saveTrace(input.saveId, "フレーム生成開始");
  saveTrace(input.saveId, "エンコード開始");
  const reduce = paintColors != null;
  const dotted: ReturnType<typeof averageCells>[] | null = paintCols == null ? null : [];
  const dotFields: ReturnType<typeof averageCells>[] = [];
  const fancyFrames: { rgba: Uint8ClampedArray; width: number; height: number }[] = [];
  let sharedPalette: ReturnType<typeof paletteFromHistogram> | null = null;
  if (dotted && paintCols != null) {
    for (let index = 0; index < times.length; index += 1) {
      stop(input.signal);
      input.onProgress({ stage: "フレーム生成", percent: Math.round((index / times.length) * 4) });
      photoCtx.clearRect(0, 0, size.width, size.height);
      const disp = warped?.frames[index];
      if (disp && paintMesh) paintMesh.paint(disp, photoCtx);
      else photoCtx.drawImage(input.image, 0, 0, size.width, size.height);
      const shot = photoCtx.getImageData(0, 0, size.width, size.height);
      dotted.push(averageCells(shot.data, size.width, size.height, paintCols));
      if (index % 2 === 1) await rest();
    }
    if (reduce) {
      const palette = paletteFromCells(dotted, snapDotColors(paintColors ?? DOT_COLOR_DEFAULT));
      for (const field of dotted) mapCells(field, palette);
    }
  } else if (reduce) {
    const hist = new Map<number, { r: number; g: number; b: number; w: number }>();
    for (let index = 0; index < times.length; index += 1) {
      stop(input.signal);
      input.onProgress({ stage: "フレーム生成", percent: Math.round((index / times.length) * 4) });
      photoCtx.clearRect(0, 0, size.width, size.height);
      const disp = warped?.frames[index];
      if (disp && paintMesh) paintMesh.paint(disp, photoCtx);
      else photoCtx.drawImage(input.image, 0, 0, size.width, size.height);
      absorbOpaque(photoCtx.getImageData(0, 0, size.width, size.height).data, hist);
      if (index % 2 === 1) await rest();
    }
    sharedPalette = paletteFromHistogram(hist, snapDotColors(paintColors ?? DOT_COLOR_DEFAULT));
  }
  for (let index = 0; index < times.length; index += 1) {
    stop(input.signal);
    const elapsed = times[index] ?? 0;
    input.onProgress({ stage: "フレーム生成", percent: Math.round(4 + (index / times.length) * 70) });
    photoCtx.clearRect(0, 0, size.width, size.height);
    if (dotted) {
      const field = dotted[index];
      if (field) fillCells(photoCtx, field, 0, 0, size.width, size.height);
    } else {
      const disp = warped?.frames[index];
      if (disp && paintMesh) paintMesh.paint(disp, photoCtx);
      else photoCtx.drawImage(input.image, 0, 0, size.width, size.height);
      if (sharedPalette && sharedPalette.length > 0) {
        const shot = photoCtx.getImageData(0, 0, size.width, size.height);
        mapPixelBuffer(shot.data, size.width, size.height, sharedPalette);
        photoCtx.putImageData(shot, 0, 0);
      }
    }
    photoCtx.save();
    photoCtx.beginPath();
    photoCtx.rect(0, 0, size.width, size.height);
    photoCtx.clip();
    for (const marker of input.effects) {
      if (marker.off === true) continue;
      const sheet = sheets.get(marker.asset);
      if (!sheet) continue;
      const draw = effectDrawSize(marker, size);
      const cx = marker.u * size.width;
      const cy = marker.v * size.height;
      photoCtx.save();
      photoCtx.translate(cx, cy);
      photoCtx.rotate(marker.angle);
      if (marker.kind === "gold") {
        const boxW = draw.w * (1 + GOLD_PAD_X * 2);
        const boxH = draw.h * (1 + GOLD_PAD_Y * 2);
        const left = -draw.w / 2 - GOLD_PAD_X * draw.w;
        const top = -draw.h / 2 - GOLD_PAD_Y * draw.h;
        if (gold) gold.paint(effectPhase(marker.pace, elapsed, marker.backbeat === true), boxW, boxH, marker.flip === true, photoCtx, left, top);
        else {
          if (marker.flip) photoCtx.scale(-1, 1);
          photoCtx.drawImage(sheet, -draw.w / 2, -draw.h / 2, draw.w, draw.h);
        }
      } else {
        const opacity = effectOpacity(marker.pace, elapsed, marker.backbeat === true);
        if (opacity > 0) {
          photoCtx.globalAlpha = opacity;
          if (marker.flip) photoCtx.scale(-1, 1);
          photoCtx.drawImage(sheet, -draw.w / 2, -draw.h / 2, draw.w, draw.h);
        }
      }
      photoCtx.restore();
    }
    photoCtx.restore();
    const pose = motionAt(input.play, elapsed, size);
    outCtx.clearRect(0, 0, size.width, size.height);
    outCtx.save();
    outCtx.translate(size.width / 2, size.height / 2);
    outCtx.translate(pose.x, pose.y);
    outCtx.rotate((pose.rotate * Math.PI) / 180);
    outCtx.scale(pose.scale, pose.scale);
    outCtx.translate(-size.width / 2, -size.height / 2);
    outCtx.drawImage(photo, 0, 0);
    outCtx.restore();
    input.onProgress({ stage: "GIFエンコード", percent: Math.round(8 + ((index + 1) / times.length) * 84) });
    const pixels = outCtx.getImageData(0, 0, size.width, size.height);
    if (byDot && fancyRecipe) {
      const out = renderDotImage(pixels.data, size.width, size.height, input.dotByDotCols ?? DOT_DEFAULT, input.dotByDotColors ?? null, fancyRecipe);
      fancyFrames.push({ rgba: out.rgba, width: out.width, height: out.height });
    } else if (byDot) dotFields.push(averageCells(pixels.data, size.width, size.height, input.dotByDotCols ?? DOT_DEFAULT));
    else gif.frame(pixels.data, size.width, size.height, holds[index] ?? GIF_DELAY_MS);
    if (visualMotion && index % 2 === 1) await rest();
  }
  stop(input.signal);
  if (byDot && fancyRecipe) {
    for (let index = 0; index < fancyFrames.length; index += 1) {
      const field = fancyFrames[index];
      if (!field) continue;
      gif.frame(field.rgba, field.width, field.height, holds[index] ?? GIF_DELAY_MS);
    }
  } else if (byDot) {
    const ready = gifDotFrames(
      dotFields.map((field) => ({ rgba: field.rgba, width: field.cols, height: field.rows })),
      dotFields[0]?.cols ?? input.dotByDotCols ?? DOT_DEFAULT,
      input.dotByDotColors ?? null,
    );
    for (let index = 0; index < ready.length; index += 1) {
      const field = ready[index];
      if (!field) continue;
      gif.frame(field.rgba, field.width, field.height, holds[index] ?? GIF_DELAY_MS);
    }
  }
  input.onProgress({ stage: "GIFエンコード", percent: 94 });
  saveTrace(input.saveId, "フレーム生成完了");
  const bytes = gif.finish();
  saveTrace(input.saveId, "エンコード完了", bytes.byteLength);
  return bytes;
  } finally {
    paintMesh?.release();
    gold?.release();
  }
}
