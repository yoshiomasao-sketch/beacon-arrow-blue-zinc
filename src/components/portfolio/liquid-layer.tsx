import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { liquidImage, primeLiquidAssets } from "@/lib/portfolio/liquid-assets";
import { playDripSound, playFireSound, stopLiquidSounds } from "@/lib/portfolio/liquid-sfx-play";
import {
  clearLiquid,
  emptyLiquid,
  liquidBusy,
  liquidFreeRatio,
  liquidOverlayFlash,
  liquidPaceY,
  liquidFadePixelBounds,
  liquidRangeCorners,
  liquidRangeViewCorners,
  liquidRangeDeformed,
  liquidRangeFace,
  liquidRangeLean,
  liquidRangePitch,
  liquidSheetBox,
  liquidTimeFade,
  liquidTipAlpha,
  meshColumns,
  meshRows,
  meshY,
  placeLiquid,
  stepLiquid,
  strandGain,
  strandStretch,
  strandY,
  takeLiquidDrips,
  writeLiquidFadeMask,
  writeLiquidHideMask,
  type LiquidHide,
  type LiquidRange,
  type LiquidSprite,
  type LiquidWorld,
} from "@/lib/portfolio/liquid";

export type LiquidHandle = {
  aim: (u: number, v: number, spray: boolean) => void;
  stop: () => void;
  clear: () => void;
};

export const LiquidLayer = forwardRef<
  LiquidHandle,
  { width: number; height: number; phone: boolean; listening: boolean; hold?: boolean; ranges: LiquidRange[]; hides?: LiquidHide[]; onFree?: (ratio: number) => void }
>(function LiquidLayer({ width, height, phone, listening, hold = false, ranges, hides = [], onFree }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const flashRef = useRef<HTMLDivElement>(null);
    const worldRef = useRef<LiquidWorld>(emptyLiquid(phone));
    const phoneRef = useRef(phone);
    const loopRef = useRef(0);
    const kickRef = useRef<() => void>(() => undefined);
    const paintRef = useRef<() => void>(() => undefined);
    const onFreeRef = useRef(onFree);
    const freeRef = useRef(-1);
    const gestureRef = useRef(false);
    const assetsRef = useRef(false);
    const flashOpacityRef = useRef(0);
    const hidesRef = useRef(hides);
    const holdRef = useRef(hold);
    phoneRef.current = phone;
    worldRef.current.phone = phone;
    worldRef.current.ranges = ranges;
    hidesRef.current = hides;
    holdRef.current = hold;
    onFreeRef.current = onFree;

    const report = () => {
      const ratio = liquidFreeRatio(worldRef.current.groups.length, worldRef.current.phone);
      const pct = Math.round(ratio * 1000);
      if (pct === freeRef.current) return;
      freeRef.current = pct;
      onFreeRef.current?.(ratio);
    };

    const paint = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const flash = flashRef.current;
      const world = worldRef.current;
      const alpha = liquidOverlayFlash(world);
      flashOpacityRef.current = alpha;
      if (flash) {
        flash.style.opacity = alpha.toFixed(3);
        if (flash.style.clipPath) flash.style.clipPath = "";
      }
      if (!canvas || !ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.imageSmoothingEnabled = true;
      const rows = meshRows(world.phone);
      const cols = meshColumns(world.phone);
      for (const group of world.groups) {
        if (world.time < group.showAt) continue;
        const fade = liquidTimeFade(world.time - group.showAt);
        if (!(fade > 0)) continue;
        for (const sprite of group.sprites) {
          const range = spriteRange(sprite, world.ranges);
          if (range === undefined) continue;
          drawSprite(ctx, sprite, canvas.width, canvas.height, rows, cols, fade, range, hidesRef.current);
        }
      }
    };
    paintRef.current = paint;

    const fire = (u: number, v: number) => {
      const placed = placeLiquid(worldRef.current, u, v, (id) => liquidImage(id) !== null);
      if (placed) playFireSound();
      report();
      paint();
      kickRef.current();
    };

    useImperativeHandle(ref, () => ({
      aim(u, v, spray) {
        const world = worldRef.current;
        world.aimU = u;
        world.aimV = v;
        const rising = spray && !gestureRef.current;
        gestureRef.current = spray;
        world.spraying = spray;
        if (rising) fire(u, v);
      },
      stop() {
        gestureRef.current = false;
        worldRef.current.spraying = false;
      },
      clear() {
        gestureRef.current = false;
        clearLiquid(worldRef.current);
        stopLiquidSounds();
        paint();
        report();
      },
    }));

    useLayoutEffect(() => {
      const node = flashRef.current;
      if (node) node.style.opacity = flashOpacityRef.current.toFixed(3);
    });

    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = Math.min(phone ? 1.5 : 2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(width * dpr));
      const h = Math.max(1, Math.round(height * dpr));
      worldRef.current.aspect = w / h;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      paint();
    }, [width, height, phone]);

    useLayoutEffect(() => {
      worldRef.current.ranges = ranges;
      hidesRef.current = hides;
      paintRef.current();
    }, [ranges, hides]);

    useEffect(() => {
      report();
    }, [phone]);

    useEffect(() => {
      let dead = false;
      void primeLiquidAssets().then((ok) => {
        assetsRef.current = ok;
        if (dead) return;
        paintRef.current();
        if (liquidBusy(worldRef.current)) kickRef.current();
      });
      return () => {
        dead = true;
      };
    }, []);

    useEffect(() => {
      let last = performance.now();
      let alive = true;
      const tick = (now: number) => {
        if (!alive) return;
        const world = worldRef.current;
        world.phone = phoneRef.current;
        const dt = holdRef.current ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;
        try {
          if (dt > 0) {
            const before = world.time;
            stepLiquid(world, dt);
            const drips = takeLiquidDrips(world, before);
            for (let i = 0; i < drips.length; i++) playDripSound();
          }
          report();
          paint();
        } catch (error) {
          console.error(error);
        } finally {
          if (!alive) return;
          if (liquidBusy(worldRef.current)) loopRef.current = window.requestAnimationFrame(tick);
          else loopRef.current = 0;
        }
      };
      kickRef.current = () => {
        if (loopRef.current) return;
        last = performance.now();
        loopRef.current = window.requestAnimationFrame(tick);
      };
      if (liquidBusy(worldRef.current)) kickRef.current();
      return () => {
        alive = false;
        window.cancelAnimationFrame(loopRef.current);
        loopRef.current = 0;
        gestureRef.current = false;
        stopLiquidSounds();
      };
    }, []);

    const onDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!listening || holdRef.current || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* the pointer still moves over the photo */
      }
      gestureRef.current = true;
      const canvas = event.currentTarget;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!(w > 0) || !(h > 0)) return;
      fire(Math.min(1, Math.max(0, event.nativeEvent.offsetX / w)), Math.min(1, Math.max(0, event.nativeEvent.offsetY / h)));
    };

    return (
      <>
        <canvas
          ref={canvasRef}
          className={listening ? "liquid-layer is-live" : "liquid-layer"}
          aria-hidden="true"
          onPointerDown={listening ? onDown : undefined}
          onPointerMove={
            listening
              ? (event) => {
                  if (!gestureRef.current) return;
                  event.preventDefault();
                  event.stopPropagation();
                }
              : undefined
          }
          onPointerUp={
            listening
              ? (event) => {
                  event.stopPropagation();
                  gestureRef.current = false;
                }
              : undefined
          }
          onPointerCancel={
            listening
              ? (event) => {
                  event.stopPropagation();
                  gestureRef.current = false;
                }
              : undefined
          }
          onLostPointerCapture={() => {
            gestureRef.current = false;
          }}
        />
        <div ref={flashRef} className="liquid-flash" aria-hidden="true" />
      </>
    );
  },
);

const sheetBuffers = new Map<string, HTMLCanvasElement>();

function sheetBuffer(image: HTMLImageElement, id: string): HTMLCanvasElement {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const cached = sheetBuffers.get(id);
  if (cached && cached.width === iw && cached.height === ih) return cached;
  const node = document.createElement("canvas");
  node.width = iw;
  node.height = ih;
  node.getContext("2d")?.drawImage(image, 0, 0);
  sheetBuffers.set(id, node);
  return node;
}

function spriteRange(sprite: LiquidSprite, ranges: LiquidRange[]): LiquidRange | null | undefined {
  if (sprite.rangeId == null) return null;
  return ranges.find((range) => range.id === sprite.rangeId);
}

type FadeLayer = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  bounds: { x: number; y: number; w: number; h: number };
};

let fadeLayer: FadeLayer | null = null;
let fadeMask: HTMLCanvasElement | null = null;
let fadeMaskKey = "";

function fadeKey(range: LiquidRange, width: number, height: number): string {
  const n = (value: number | undefined) => Math.round((value ?? 0) * 1e6);
  let key = `${width}x${height}:${n(range.x)}:${n(range.y)}:${n(range.w)}:${n(range.h)}:${n(range.angle)}:${n(range.lean)}:${n(range.pitch)}`;
  if (range.quad) {
    for (const point of range.quad) key += `:${n(point.x)}:${n(point.y)}`;
  }
  return key;
}

/** Cached for the current box and canvas size. The mesh moves every frame; this rim does not. */
function rangeFadeMask(width: number, height: number, range: LiquidRange): HTMLCanvasElement | null {
  const key = fadeKey(range, width, height);
  if (fadeMask && fadeMaskKey === key && fadeMask.width === width && fadeMask.height === height) return fadeMask;
  const canvas = fadeMask && fadeMask.width === width && fadeMask.height === height ? fadeMask : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const maskCtx = canvas.getContext("2d");
  if (!maskCtx) return null;
  const image = maskCtx.createImageData(width, height);
  writeLiquidFadeMask(image.data, width, height, range);
  maskCtx.putImageData(image, 0, 0);
  fadeMask = canvas;
  fadeMaskKey = key;
  return canvas;
}

function beginLayer(width: number, height: number, bounds: { x: number; y: number; w: number; h: number }): CanvasRenderingContext2D | null {
  if (!(bounds.w > 0) || !(bounds.h > 0)) return null;
  if (!fadeLayer || fadeLayer.canvas.width !== width || fadeLayer.canvas.height !== height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const layerCtx = canvas.getContext("2d");
    if (!layerCtx) return null;
    fadeLayer = { canvas, ctx: layerCtx, bounds };
  }
  fadeLayer.bounds = bounds;
  const layerCtx = fadeLayer.ctx;
  layerCtx.setTransform(1, 0, 0, 1, 0, 0);
  layerCtx.globalAlpha = 1;
  layerCtx.globalCompositeOperation = "source-over";
  layerCtx.imageSmoothingEnabled = true;
  layerCtx.clearRect(bounds.x, bounds.y, bounds.w, bounds.h);
  return layerCtx;
}

function beginFadedLayer(width: number, height: number, range: LiquidRange): CanvasRenderingContext2D | null {
  return beginLayer(width, height, liquidFadePixelBounds(range, width, height));
}

let hideMask: HTMLCanvasElement | null = null;
let hideMaskKey = "";

function hideKey(hides: readonly LiquidHide[], width: number, height: number): string {
  const n = (value: number | undefined) => Math.round((value ?? 0) * 1e6);
  let key = `${width}x${height}`;
  for (const hide of hides) {
    key += `|${hide.shape}:${n(hide.x)}:${n(hide.y)}:${n(hide.w)}:${n(hide.h)}:${n(hide.angle)}:${n(hide.lean)}:${n(hide.pitch)}`;
  }
  return key;
}

/** Opaque except where a hide removes liquid. Cached until the holes or the canvas size change. */
function liquidHideMask(width: number, height: number, hides: readonly LiquidHide[]): HTMLCanvasElement | null {
  if (hides.length === 0) return null;
  const key = hideKey(hides, width, height);
  if (hideMask && hideMaskKey === key && hideMask.width === width && hideMask.height === height) return hideMask;
  const canvas = hideMask && hideMask.width === width && hideMask.height === height ? hideMask : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const maskCtx = canvas.getContext("2d");
  if (!maskCtx) return null;
  const image = maskCtx.createImageData(width, height);
  image.data.fill(255);
  writeLiquidHideMask(image.data, width, height, hides);
  maskCtx.putImageData(image, 0, 0);
  hideMask = canvas;
  hideMaskKey = key;
  return canvas;
}

/** Multiplies the sheet by the range fade and the hide mask, then paints that onto the picture. */
function finishFadedLayer(
  main: CanvasRenderingContext2D,
  width: number,
  height: number,
  range: LiquidRange | null,
  hides: readonly LiquidHide[],
): void {
  if (!fadeLayer) return;
  const bounds = fadeLayer.bounds;
  if (!(bounds.w > 0) || !(bounds.h > 0)) return;
  const layerCtx = fadeLayer.ctx;
  layerCtx.setTransform(1, 0, 0, 1, 0, 0);
  layerCtx.globalAlpha = 1;
  layerCtx.imageSmoothingEnabled = false;
  if (range) {
    const mask = rangeFadeMask(width, height, range);
    if (!mask) return;
    layerCtx.globalCompositeOperation = "destination-in";
    layerCtx.drawImage(mask, bounds.x, bounds.y, bounds.w, bounds.h, bounds.x, bounds.y, bounds.w, bounds.h);
  }
  if (hides.length > 0) {
    const holes = liquidHideMask(width, height, hides);
    if (holes) {
      layerCtx.globalCompositeOperation = "destination-in";
      layerCtx.drawImage(holes, bounds.x, bounds.y, bounds.w, bounds.h, bounds.x, bounds.y, bounds.w, bounds.h);
    }
  }
  layerCtx.globalCompositeOperation = "source-over";
  const smoothing = main.imageSmoothingEnabled;
  main.imageSmoothingEnabled = false;
  main.drawImage(fadeLayer.canvas, bounds.x, bounds.y, bounds.w, bounds.h, bounds.x, bounds.y, bounds.w, bounds.h);
  main.imageSmoothingEnabled = smoothing;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: LiquidSprite,
  canvasW: number,
  canvasH: number,
  rows: number,
  cols: number,
  timeFade: number,
  range: LiquidRange | null,
  hides: readonly LiquidHide[] = [],
) {
  const image = liquidImage(sprite.asset);
  if (!image) return;
  const source = sheetBuffer(image, sprite.asset);
  let spriteW = sprite.w;
  let spriteH = sprite.h;
  let spriteU = sprite.u;
  let spriteV = sprite.v;
  const fitted = range ? liquidSheetBox(sprite.asset, canvasW / canvasH, range) : null;
  const tilted = Boolean(
    range &&
      fitted &&
      (Math.abs(liquidRangeLean(range)) > 1e-6 || Math.abs(liquidRangePitch(range)) > 1e-6 || liquidRangeDeformed(range)),
  );
  if (tilted && range && fitted) {
    const pen = beginFadedLayer(canvasW, canvasH, range);
    if (!pen) return;
    drawTiltedSprite(pen, sprite, source, image, canvasW, canvasH, rows, cols, timeFade, range, fitted);
    finishFadedLayer(ctx, canvasW, canvasH, range, hides);
    return;
  }
  if (fitted) {
    spriteW = fitted.w;
    spriteH = fitted.h;
    spriteU = fitted.u;
    spriteV = fitted.v;
  }
  const spin = fitted ? fitted.angle : sprite.rotation;
  const w = spriteW * canvasW;
  const h = spriteH * canvasH;
  if (!(w > 1) || !(h > 1)) return;
  const cx = spriteU * canvasW;
  const cy = spriteV * canvasH;
  let reach = sprite.extend;
  for (const value of sprite.bands) if (value > reach) reach = value;
  const top = meshY(0, h, reach);
  const bottom = meshY(1, h, reach);
  const pad = Math.max(w, h) * 0.25 + 8;
  if (Math.abs(spin) < 1e-6 && (cx + w / 2 + pad < 0 || cy - h / 2 + top - pad > canvasH || cx - w / 2 - pad > canvasW || cy - h / 2 + bottom + pad < 0)) return;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!(iw > 0) || !(ih > 0)) return;
  const colCount = Math.max(1, cols);
  const bandCount = sprite.bands.length;
  // Rim fade and hide holes are per-pixel masks of where the sheet landed, so those sheets are drawn offscreen first.
  const pen = range ? beginFadedLayer(canvasW, canvasH, range) : hides.length > 0 ? beginLayer(canvasW, canvasH, { x: 0, y: 0, w: canvasW, h: canvasH }) : ctx;
  if (!pen) return;
  pen.save();
  if (range) {
    const corners = liquidRangeCorners(range, canvasH > 0 ? canvasW / canvasH : 1);
    pen.beginPath();
    pen.moveTo(corners[0]!.x * canvasW, corners[0]!.y * canvasH);
    for (let i = 1; i < corners.length; i++) pen.lineTo(corners[i]!.x * canvasW, corners[i]!.y * canvasH);
    pen.closePath();
    pen.clip();
  }
  pen.translate(cx, cy);
  pen.rotate(spin);
  if (sprite.flip) pen.scale(-1, 1);
  pen.translate(-w / 2, -h / 2);
  for (let c = 0; c < colCount; c++) {
    const gain = strandGain(c, colCount, sprite.id);
    const stretches = new Float64Array(bandCount);
    for (let i = 0; i < bandCount; i++) stretches[i] = strandStretch(sprite.bands[i] ?? 0, gain);
    const fallback = strandStretch(sprite.extend, gain);
    const yAt = (t: number) => (bandCount > 0 ? liquidPaceY(t, h, stretches) : strandY(t, h, fallback));
    const x0 = Math.round((c / colCount) * w);
    const x1 = Math.round(((c + 1) / colCount) * w);
    if (x1 <= x0) continue;
    const srcX = (c / colCount) * iw;
    const srcR = ((c + 1) / colCount) * iw;
    const sw = Math.min(iw - srcX, Math.max(0.5, srcR - srcX));
    if (!(sw > 0.05)) continue;
    let yPrev = Math.round(yAt(0));
    for (let i = 0; i < rows; i++) {
      const t0 = i / rows;
      const t1 = (i + 1) / rows;
      const yNext = Math.round(yAt(t1));
      const destH = yNext - yPrev;
      const rowFade = timeFade * liquidTipAlpha((t0 + t1) * 0.5);
      const srcY = t0 * ih;
      const srcH = Math.min(ih - srcY, Math.max(0, t1 * ih - srcY));
      if (destH >= 1 && rowFade > 0.004 && srcH > 0.05) {
        pen.globalAlpha = rowFade;
        // File row 0 is the top of the art and the top of the sprite. Do not flip Y.
        pen.drawImage(source, srcX, srcY, sw, srcH, x0, yPrev, x1 - x0, destH);
      }
      yPrev = yNext;
    }
  }
  pen.restore();
  if (range || hides.length > 0) finishFadedLayer(ctx, canvasW, canvasH, range, hides);
}

function paintFaceCell(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  topLeft: { x: number; y: number },
  topRight: { x: number; y: number },
  bottomLeft: { x: number; y: number },
) {
  const cross = (topRight.x - topLeft.x) * (bottomLeft.y - topLeft.y) - (topRight.y - topLeft.y) * (bottomLeft.x - topLeft.x);
  if (Math.abs(cross) < 0.2) return;
  const a = (topRight.x - topLeft.x) / sw;
  const b = (topRight.y - topLeft.y) / sw;
  const c = (bottomLeft.x - topLeft.x) / sh;
  const d = (bottomLeft.y - topLeft.y) / sh;
  ctx.save();
  ctx.transform(a, b, c, d, topLeft.x - a * sx - c * sy, topLeft.y - b * sx - d * sy);
  ctx.drawImage(source, sx, sy, sw, sh, sx, sy, sw, sh);
  ctx.restore();
}

/** The same drip mesh, projected onto the tilted face. Zero tilt never comes here. */
function drawTiltedSprite(
  ctx: CanvasRenderingContext2D,
  sprite: LiquidSprite,
  source: CanvasImageSource,
  image: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  rows: number,
  cols: number,
  timeFade: number,
  range: LiquidRange,
  fitted: { w: number; h: number },
) {
  const aspect = canvasH > 0 ? canvasW / canvasH : 1;
  const view = liquidRangeViewCorners(range, aspect);
  const xs = view.map((point) => point.x * canvasW);
  const ys = view.map((point) => point.y * canvasH);
  if (Math.max(...xs) < 0 || Math.min(...xs) > canvasW || Math.max(...ys) < 0 || Math.min(...ys) > canvasH) return;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!(iw > 0) || !(ih > 0)) return;
  const sheetLy = -range.h / 2 + fitted.h / 2;
  const place = (px: number, py: number) => {
    const fx = px / canvasW - fitted.w / 2;
    const fy = py / canvasH - fitted.h / 2;
    const lx = sprite.flip ? -fx : fx;
    const ly = sheetLy + fy;
    const face = liquidRangeFace(range, lx, ly, aspect);
    return { x: face.x * canvasW, y: face.y * canvasH, lx, ly };
  };
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(xs[0]!, ys[0]!);
  for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i]!, ys[i]!);
  ctx.closePath();
  ctx.clip();
  const w = fitted.w * canvasW;
  const h = fitted.h * canvasH;
  const colCount = Math.max(1, cols);
  const bandCount = sprite.bands.length;
  for (let c = 0; c < colCount; c++) {
    const gain = strandGain(c, colCount, sprite.id);
    const stretches = new Float64Array(bandCount);
    for (let i = 0; i < bandCount; i++) stretches[i] = strandStretch(sprite.bands[i] ?? 0, gain);
    const fallback = strandStretch(sprite.extend, gain);
    const yAt = (t: number) => (bandCount > 0 ? liquidPaceY(t, h, stretches) : strandY(t, h, fallback));
    const x0 = (c / colCount) * w;
    const x1 = ((c + 1) / colCount) * w;
    if (x1 - x0 < 0.5) continue;
    const srcX = (c / colCount) * iw;
    const srcR = ((c + 1) / colCount) * iw;
    const sw = Math.min(iw - srcX, Math.max(0.5, srcR - srcX));
    if (!(sw > 0.05)) continue;
    let yPrev = yAt(0);
    for (let i = 0; i < rows; i++) {
      const t0 = i / rows;
      const t1 = (i + 1) / rows;
      const yNext = yAt(t1);
      const destH = yNext - yPrev;
      const srcY = t0 * ih;
      const srcH = Math.min(ih - srcY, Math.max(0, t1 * ih - srcY));
      if (destH >= 0.5 && srcH > 0.05) {
        const rowFade = timeFade * liquidTipAlpha((t0 + t1) * 0.5);
        if (rowFade > 0.004) {
          ctx.globalAlpha = rowFade;
          const topLeft = place(x0, yPrev);
          const topRight = place(x1, yPrev);
          const bottomLeft = place(x0, yNext);
          paintFaceCell(ctx, source, srcX, srcY, sw, srcH, topLeft, topRight, bottomLeft);
        }
      }
      yPrev = yNext;
    }
  }
  ctx.restore();
}
