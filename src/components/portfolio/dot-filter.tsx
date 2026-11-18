import { useEffect, useRef, type CSSProperties } from "react";
import { averageCells, dotGrid, fillCells, limitCellColors, quantizePixels } from "@/lib/portfolio/dot-filter";
import { DOT_SAMPLE_CAP, DOT_SAMPLE_LIVE_CAP, recipeIsPlain, renderDotImage, type DotRecipe } from "@/lib/portfolio/dot-recipe";

type DotSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

function sourceSize(source: DotSource): { width: number; height: number } | null {
  if (source instanceof HTMLImageElement) {
    if (source.naturalWidth < 1 || source.naturalHeight < 1) return null;
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  if (source instanceof HTMLVideoElement) {
    if (source.videoWidth < 1 || source.videoHeight < 1) return null;
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (source.width < 1 || source.height < 1) return null;
  return { width: source.width, height: source.height };
}

/**
 * Mosaic painted over one picture. The source element stays in place so the
 * file, the mesh, and hit testing are unchanged. Pass `live` while that source
 * is moving; a still picture is sampled when its box or column count changes.
 */
export function DotFilter({
  sourceRef,
  cols,
  colors = null,
  live,
  fit = "fill",
  sourceKey = "",
  recipe = null,
  recipeKey = "",
  style,
}: {
  sourceRef: { readonly current: DotSource | null };
  cols: number | null;
  /** Null skips color reduction. A number quantizes, whether or not the mosaic is on. */
  colors?: number | null;
  live: boolean;
  /** `contain` letterboxes like an img. `fill` covers the canvas, which already matches the picture. */
  fit?: "fill" | "contain";
  sourceKey?: string;
  /** Extra processing. A plain recipe keeps the legacy mosaic. */
  recipe?: DotRecipe | null;
  recipeKey?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recipeRef = useRef(recipe);
  recipeRef.current = recipe ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sample = document.createElement("canvas");
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true, alpha: true });
    const tiny = document.createElement("canvas");
    const tinyCtx = tiny.getContext("2d", { alpha: true });
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!sampleCtx || !ctx || !tinyCtx) return;
    let alive = true;
    let frame = 0;
    let last = 0;

    const paint = () => {
      const source = sourceRef.current;
      if (!source) return;
      const natural = sourceSize(source);
      if (!natural) return;
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width < 2 || bounds.height < 2) return;
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      let box = { x: 0, y: 0, width, height };
      if (fit === "contain") {
        const scale = Math.min(width / natural.width, height / natural.height);
        box = {
          width: Math.max(1, Math.round(natural.width * scale)),
          height: Math.max(1, Math.round(natural.height * scale)),
          x: 0,
          y: 0,
        };
        box.x = Math.round((width - box.width) / 2);
        box.y = Math.round((height - box.height) / 2);
      }
      const long = Math.max(box.width, box.height);
      const cap = live ? 512 : 960;
      const sampleScale = long > cap ? cap / long : 1;
      ctx.clearRect(0, 0, width, height);
      const recipeNow = recipeRef.current;
      if (recipeNow && !recipeIsPlain(recipeNow) && natural) {
        const cap = live ? DOT_SAMPLE_LIVE_CAP : DOT_SAMPLE_CAP;
        const longEdge = Math.max(natural.width, natural.height);
        const scale = longEdge > cap ? cap / longEdge : 1;
        const sampleW = Math.max(1, Math.round(natural.width * scale));
        const sampleH = Math.max(1, Math.round(natural.height * scale));
        if (sample.width !== sampleW || sample.height !== sampleH) {
          sample.width = sampleW;
          sample.height = sampleH;
        }
        sampleCtx.clearRect(0, 0, sampleW, sampleH);
        sampleCtx.imageSmoothingEnabled = false;
        sampleCtx.drawImage(source, 0, 0, sampleW, sampleH);
        const out = renderDotImage(sampleCtx.getImageData(0, 0, sampleW, sampleH).data, sampleW, sampleH, cols, colors, recipeNow);
        if (tiny.width !== out.width || tiny.height !== out.height) {
          tiny.width = out.width;
          tiny.height = out.height;
        }
        tinyCtx.putImageData(new ImageData(new Uint8ClampedArray(out.rgba), out.width, out.height), 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tiny, box.x, box.y, box.width, box.height);
        return;
      }
      if (cols == null) {
        if (colors == null) return;
        const sampleW = Math.max(1, Math.round(box.width * sampleScale));
        const sampleH = Math.max(1, Math.round(box.height * sampleScale));
        if (sample.width !== sampleW || sample.height !== sampleH) {
          sample.width = sampleW;
          sample.height = sampleH;
        }
        sampleCtx.clearRect(0, 0, sampleW, sampleH);
        sampleCtx.imageSmoothingEnabled = true;
        sampleCtx.drawImage(source, 0, 0, sampleW, sampleH);
        const shot = sampleCtx.getImageData(0, 0, sampleW, sampleH);
        quantizePixels(shot.data, sampleW, sampleH, colors);
        sampleCtx.putImageData(shot, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sample, box.x, box.y, box.width, box.height);
        return;
      }
      const grid = dotGrid(box.width, box.height, cols);
      const sampleW = Math.max(grid.cols, Math.round(box.width * sampleScale));
      const sampleH = Math.max(grid.rows, Math.round(box.height * sampleScale));
      if (sample.width !== sampleW || sample.height !== sampleH) {
        sample.width = sampleW;
        sample.height = sampleH;
      }
      sampleCtx.clearRect(0, 0, sampleW, sampleH);
      sampleCtx.imageSmoothingEnabled = true;
      sampleCtx.drawImage(source, 0, 0, sampleW, sampleH);
      const field = averageCells(sampleCtx.getImageData(0, 0, sampleW, sampleH).data, sampleW, sampleH, cols);
      if (colors != null) limitCellColors(field, colors);
      fillCells(ctx, field, box.x, box.y, box.width, box.height);
    };

    const tick = (now: number) => {
      if (!alive) return;
      if (!live || now - last >= 32) {
        last = now;
        paint();
      }
      if (live) frame = window.requestAnimationFrame(tick);
    };

    paint();
    if (live) frame = window.requestAnimationFrame(tick);
    const source = sourceRef.current;
    const onLoad = () => paint();
    if (source instanceof HTMLImageElement) source.addEventListener("load", onLoad);
    const observer = new ResizeObserver(() => paint());
    observer.observe(canvas);
    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      if (source instanceof HTMLImageElement) source.removeEventListener("load", onLoad);
      observer.disconnect();
    };
  }, [cols, colors, fit, live, recipeKey, sourceKey, sourceRef]);

  return <canvas ref={canvasRef} className={fit === "contain" ? "dot-filter is-contain" : "dot-filter"} aria-hidden="true" style={style} />;
}
