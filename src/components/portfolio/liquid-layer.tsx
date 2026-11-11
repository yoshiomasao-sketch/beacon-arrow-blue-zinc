import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { liquidImage, primeLiquidAssets } from "@/lib/portfolio/liquid-assets";
import {
  clearLiquid,
  emptyLiquid,
  liquidBusy,
  liquidFreeRatio,
  liquidOverlayFlash,
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
  type LiquidSprite,
  type LiquidWorld,
} from "@/lib/portfolio/liquid";

export type LiquidHandle = {
  aim: (u: number, v: number, spray: boolean) => void;
  stop: () => void;
  clear: () => void;
};

export const LiquidLayer = forwardRef<LiquidHandle, { width: number; height: number; phone: boolean; listening: boolean; onFree?: (ratio: number) => void }>(
  function LiquidLayer({ width, height, phone, listening, onFree }, ref) {
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
    const [flashHost, setFlashHost] = useState<HTMLElement | null>(null);
    phoneRef.current = phone;
    worldRef.current.phone = phone;
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
      if (flash) flash.style.opacity = alpha.toFixed(3);
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
        for (const sprite of group.sprites) drawSprite(ctx, sprite, canvas.width, canvas.height, rows, cols, fade);
      }
    };
    paintRef.current = paint;

    const fire = (u: number, v: number) => {
      placeLiquid(worldRef.current, u, v);
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
        paint();
        report();
      },
    }));

    useLayoutEffect(() => {
      setFlashHost(document.body);
    }, []);

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
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;
        try {
          if (dt > 0) stepLiquid(world, dt);
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
      };
    }, []);

    const onDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!listening || event.button !== 0) return;
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
        {flashHost ? createPortal(<div ref={flashRef} className="liquid-flash" aria-hidden="true" />, flashHost) : null}
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

function drawSprite(ctx: CanvasRenderingContext2D, sprite: LiquidSprite, canvasW: number, canvasH: number, rows: number, cols: number, timeFade: number) {
  const image = liquidImage(sprite.asset);
  if (!image) return;
  const source = sheetBuffer(image, sprite.asset);
  const w = sprite.w * canvasW;
  const h = sprite.h * canvasH;
  if (!(w > 1) || !(h > 1)) return;
  const cx = sprite.u * canvasW;
  const cy = sprite.v * canvasH;
  const top = meshY(0, h, sprite.extend);
  const bottom = meshY(1, h, sprite.extend);
  const pad = Math.max(w, h) * 0.25 + 8;
  if (cx + w / 2 + pad < 0 || cy - h / 2 + top - pad > canvasH || cx - w / 2 - pad > canvasW || cy - h / 2 + bottom + pad < 0) return;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!(iw > 0) || !(ih > 0)) return;
  const colCount = Math.max(1, cols);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sprite.rotation);
  if (sprite.flip) ctx.scale(-1, 1);
  ctx.translate(-w / 2, -h / 2);
  for (let c = 0; c < colCount; c++) {
    const gain = strandGain(c, colCount, sprite.id);
    const stretch = strandStretch(sprite.extend, gain);
    const x0 = Math.round((c / colCount) * w);
    const x1 = Math.round(((c + 1) / colCount) * w);
    if (x1 <= x0) continue;
    const srcX = (c / colCount) * iw;
    const srcR = ((c + 1) / colCount) * iw;
    const sw = Math.min(iw - srcX, Math.max(0.5, srcR - srcX));
    if (!(sw > 0.05)) continue;
    let yPrev = Math.round(strandY(0, h, stretch));
    for (let i = 0; i < rows; i++) {
      const t0 = i / rows;
      const t1 = (i + 1) / rows;
      const yNext = Math.round(strandY(t1, h, stretch));
      const destH = yNext - yPrev;
      const rowFade = timeFade * liquidTipAlpha((t0 + t1) * 0.5);
      const srcY = t0 * ih;
      const srcH = Math.min(ih - srcY, Math.max(0, t1 * ih - srcY));
      if (destH >= 1 && rowFade > 0.004 && srcH > 0.05) {
        ctx.globalAlpha = rowFade;
        // File row 0 is the top of the art and the top of the sprite. Do not flip Y.
        ctx.drawImage(source, srcX, srcY, sw, srcH, x0, yPrev, x1 - x0, destH);
      }
      yPrev = yNext;
    }
  }
  ctx.restore();
}
