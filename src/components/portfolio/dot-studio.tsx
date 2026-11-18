import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { DOT_MAX, DOT_MIN, DOT_STEP, dotColorIndex, dotColorStops, dotView } from "@/lib/portfolio/dot-filter";
import {
  DOT_LEVEL_STOPS,
  DOT_SAMPLE_CAP,
  DOT_SAMPLE_LIVE_CAP,
  GAME_PRESETS,
  dotLevelIndex,
  dotRecipe,
  gamePresetById,
  gamePresetPatch,
  matchingGamePreset,
  newDotMarker,
  renderDotImage,
  type DotPatch,
  type DotRecipe,
} from "@/lib/portfolio/dot-recipe";
import type { DotBias, DotMarker, ImageDot } from "@/lib/portfolio/types";

export type DotPlate = "clear" | "black" | "white" | "green";

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

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="dot-group">
      <span>{label}</span>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="dot-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function DotStudioBar({
  dot,
  onPatch,
  onClose,
}: {
  dot: ImageDot | null | undefined;
  onPatch: (patch: DotPatch) => void;
  onClose: () => void;
}) {
  const view = dotView(dot);
  const recipe = dotRecipe(dot);
  const stops = dotColorStops();
  const colorIndex = dotColorIndex(view.colors);
  const processed = typeof dot?.show === "boolean" ? dot.show : true;
  const paletteChoice = recipe.palette !== "normal" ? recipe.palette : recipe.gray ? "gray" : "normal";
  const machine = matchingGamePreset({
    cols: view.cols,
    colors: view.colors,
    levels: recipe.levels,
    palette: recipe.palette,
    gray: recipe.gray,
    mosaic: view.mosaic,
    colorOn: view.colorOn,
    levelsOn: recipe.levelsOn,
    alphaOn: recipe.alphaOn,
    dither: recipe.dither,
    ditherStrength: recipe.ditherStrength,
    bayerSize: recipe.bayerSize,
    ditherStrengthOn: recipe.ditherStrengthOn,
  });
  return (
    <div className="dot-studio-rows" onPointerDown={(event) => event.stopPropagation()}>
      <div className="dot-studio-row">
        <Group label="ドット化表示">
          <input type="checkbox" checked={processed} aria-label="ドット化表示" onChange={(event) => onPatch({ show: event.target.checked })} />
        </Group>
        <Group label="ゲーム機">
          <select
            aria-label="ゲーム機プリセット"
            value={machine}
            onChange={(event) => {
              const preset = gamePresetById(event.target.value);
              if (!preset) return;
              onPatch(gamePresetPatch(preset.id, processed));
            }}
          >
            <option value="">指定なし</option>
            {GAME_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </Group>
        <Group label="ドット数">
          <input type="checkbox" checked={view.mosaic} aria-label="ドット化を適用" onChange={(event) => onPatch({ on: event.target.checked })} />
          <input
            type="range"
            min={DOT_MIN}
            max={DOT_MAX}
            step={DOT_STEP}
            value={view.cols}
            aria-label="ドット数"
            onChange={(event) => onPatch({ cols: Number(event.target.value) })}
          />
          <span className="tabular-nums">{view.cols}</span>
        </Group>
        <Group label="減色">
          <input type="checkbox" checked={view.colorOn} aria-label="減色" onChange={(event) => onPatch({ colorOn: event.target.checked })} />
          <input
            className="dot-color-range"
            type="range"
            min={0}
            max={stops.length - 1}
            step={1}
            value={colorIndex}
            aria-label="色数"
            onChange={(event) => onPatch({ colors: stops[Number(event.target.value)] ?? view.colors })}
          />
          {/* 400 はこの書体でいちばん幅が広い色数。桁が変わっても行を動かさない。 */}
          <span className="tabular-nums dot-fixed-num"><span>{view.colors}</span><span className="dot-fixed-ghost" aria-hidden="true">400</span></span>
        </Group>
        <Group label="ディザ">
          <select aria-label="ディザリング" value={recipe.dither} onChange={(event) => onPatch({ dither: event.target.value as DotRecipe["dither"] })}>
            <option value="off">OFF</option>
            <option value="floyd">Floyd-Steinberg</option>
            <option value="bayer">Bayer</option>
            <option value="atkinson">Atkinson</option>
          </select>
          {recipe.dither !== "off" ? (
            <>
              <input
                type="checkbox"
                checked={recipe.ditherStrengthOn}
                aria-label="ディザの強さを使う"
                onChange={(event) => onPatch({ ditherStrengthOn: event.target.checked })}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={recipe.ditherStrength}
                aria-label="ディザリングの強さ"
                onChange={(event) => onPatch({ ditherStrength: Number(event.target.value) })}
              />
              <span className="tabular-nums">{recipe.ditherStrength}</span>
            </>
          ) : null}
          {recipe.dither === "bayer" ? (
            <select aria-label="Bayerサイズ" value={recipe.bayerSize} onChange={(event) => onPatch({ bayerSize: Number(event.target.value) })}>
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
            </select>
          ) : null}
        </Group>
        <Group label="パレット">
          <select
            aria-label="カラーパレット"
            value={paletteChoice}
            onChange={(event) => onPatch({ palette: event.target.value as DotRecipe["palette"], gray: false })}
          >
            <option value="normal">通常カラー</option>
            <option value="gray">グレースケール</option>
            <option value="green">緑系</option>
            <option value="sepia">セピア系</option>
          </select>
        </Group>
        <Group label="階調">
          <input type="checkbox" checked={recipe.levelsOn} aria-label="階調制限" onChange={(event) => onPatch({ levelsOn: event.target.checked })} />
          <input
            type="range"
            min={0}
            max={DOT_LEVEL_STOPS.length - 1}
            step={1}
            value={dotLevelIndex(recipe.levels)}
            aria-label="階調数"
            onChange={(event) => onPatch({ levels: DOT_LEVEL_STOPS[Number(event.target.value)] ?? 8 })}
          />
          <span className="tabular-nums dot-fixed-num"><span>{recipe.levels}</span><span className="dot-fixed-ghost" aria-hidden="true">256</span></span>
        </Group>
        <Group label="フチ取り">
          <input type="checkbox" checked={recipe.outline} aria-label="フチ取り" onChange={(event) => onPatch({ outline: event.target.checked })} />
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={recipe.outlineWidth}
            aria-label="線の太さ"
            onChange={(event) => onPatch({ outlineWidth: Number(event.target.value) })}
          />
          <span className="tabular-nums">{recipe.outlineWidth}px</span>
          <select aria-label="線の色" value={recipe.outlineColor} onChange={(event) => onPatch({ outlineColor: event.target.value as DotRecipe["outlineColor"] })}>
            <option value="black">黒</option>
            <option value="white">白</option>
            <option value="custom">指定色</option>
          </select>
          {recipe.outlineColor === "custom" ? (
            <input type="color" aria-label="指定色" value={recipe.outlineHex} onChange={(event) => onPatch({ outlineHex: event.target.value })} />
          ) : null}
        </Group>
      </div>
      <div className="dot-studio-row">
        <Group label="半透明なし">
          <select aria-label="半透明なし" value={recipe.alphaOn ? "off" : "on"} onChange={(event) => onPatch({ alphaOn: event.target.value !== "on", show: processed })}>
            <option value="off">OFF</option>
            <option value="on">ON</option>
          </select>
        </Group>
        <Group label="明るさ">
          <input type="checkbox" checked={recipe.brightnessOn} aria-label="明るさを使う" onChange={(event) => onPatch({ brightnessOn: event.target.checked })} />
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={recipe.brightness}
            aria-label="明るさ"
            onChange={(event) => onPatch({ brightness: Number(event.target.value) })}
          />
          <span className="tabular-nums">{recipe.brightness}</span>
          <button type="button" aria-label="明るさを初期値に戻す" onClick={() => onPatch({ brightness: 0 })}>
            戻す
          </button>
        </Group>
        <Group label="コントラスト">
          <input type="checkbox" checked={recipe.contrastOn} aria-label="コントラストを使う" onChange={(event) => onPatch({ contrastOn: event.target.checked })} />
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={recipe.contrast}
            aria-label="コントラスト"
            onChange={(event) => onPatch({ contrast: Number(event.target.value) })}
          />
          <span className="tabular-nums">{recipe.contrast}</span>
          <button type="button" aria-label="コントラストを初期値に戻す" onClick={() => onPatch({ contrast: 0 })}>
            戻す
          </button>
        </Group>
        <Group label="濃度">
          <input type="checkbox" checked={recipe.densityOn} aria-label="濃度を使う" onChange={(event) => onPatch({ densityOn: event.target.checked })} />
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={recipe.density}
            aria-label="濃度"
            onChange={(event) => onPatch({ density: Number(event.target.value) })}
          />
          <span className="tabular-nums">{recipe.density}</span>
          <button type="button" aria-label="濃度を初期値に戻す" onClick={() => onPatch({ density: 0 })}>
            戻す
          </button>
        </Group>
        <Group label="明暗">
          <input type="checkbox" checked={recipe.sampleContrastOn} aria-label="明暗を使う" onChange={(event) => onPatch({ sampleContrastOn: event.target.checked })} />
          <input
            type="range"
            min={-100}
            max={100}
            step={1}
            value={recipe.sampleContrast}
            aria-label="取得の明暗"
            onChange={(event) => onPatch({ sampleContrast: Number(event.target.value) })}
          />
          <span className="tabular-nums">{recipe.sampleContrast}</span>
          <button type="button" aria-label="取得の明暗を初期値に戻す" onClick={() => onPatch({ sampleContrast: 0 })}>
            戻す
          </button>
        </Group>
        <Group label="主線">
          <input type="checkbox" checked={recipe.blackLineOn} aria-label="主線を使う" onChange={(event) => onPatch({ blackLineOn: event.target.checked })} />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={recipe.blackLine}
            aria-label="黒い主線の強さ"
            onChange={(event) => onPatch({ blackLine: Number(event.target.value) })}
          />
          <span className="tabular-nums">{recipe.blackLine}</span>
        </Group>
        <Group label="取得位置">
          <select aria-label="色の取得位置" value={recipe.samplePos} onChange={(event) => onPatch({ samplePos: event.target.value as DotBias })}>
            <option value="tl">左上</option>
            <option value="center">中央</option>
            <option value="br">右下</option>
          </select>
        </Group>
        <Group label="偏り">
          <input type="checkbox" checked={recipe.sampleWeightOn} aria-label="偏りを使う" onChange={(event) => onPatch({ sampleWeightOn: event.target.checked })} />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={recipe.sampleWeight}
            aria-label="取得位置の強さ"
            onChange={(event) => onPatch({ sampleWeight: Number(event.target.value) })}
          />
          <span className="tabular-nums">{recipe.sampleWeight}</span>
        </Group>
        <button type="button" className="dot-end" onClick={onClose}>
          終了
        </button>
      </div>
    </div>
  );
}

/** Current frame, at the real dot size. Display zoom and the underlay color are not part of the PNG. */
export async function rasterDotStill(
  source: HTMLImageElement | HTMLVideoElement,
  cols: number | null,
  colors: number | null,
  recipe: DotRecipe,
): Promise<Blob | null> {
  const natural = sourceSize(source);
  if (!natural) return null;
  const canvas = document.createElement("canvas");
  canvas.width = natural.width;
  canvas.height = natural.height;
  const ctx = canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, natural.width, natural.height);
  ctx.drawImage(source, 0, 0, natural.width, natural.height);
  const shot = ctx.getImageData(0, 0, natural.width, natural.height);
  const out = renderDotImage(shot.data, natural.width, natural.height, cols, colors, recipe);
  if (out.width < 1 || out.height < 1) return null;
  const still = document.createElement("canvas");
  still.width = out.width;
  still.height = out.height;
  const paint = still.getContext("2d", { alpha: true });
  if (!paint) return null;
  paint.imageSmoothingEnabled = false;
  paint.putImageData(new ImageData(new Uint8ClampedArray(out.rgba), out.width, out.height), 0, 0);
  return await new Promise((resolve) => still.toBlob((blob) => resolve(blob), "image/png"));
}

export function DotPreview({
  sourceRef,
  cols,
  colors,
  recipe,
  recipeKey,
  live,
  mosaicOn,
  plate,
  onPlate,
  copying,
  onCopy,
}: {
  sourceRef: { readonly current: DotSource | null };
  cols: number | null;
  colors: number | null;
  recipe: DotRecipe;
  recipeKey: string;
  live: boolean;
  mosaicOn: boolean;
  plate: DotPlate;
  onPlate: (plate: DotPlate) => void;
  copying: boolean;
  onCopy: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recipeRef = useRef(recipe);
  const colsRef = useRef(cols);
  const colorsRef = useRef(colors);
  const liveRef = useRef(live);
  const mosaicRef = useRef(mosaicOn);
  recipeRef.current = recipe;
  colsRef.current = cols;
  colorsRef.current = colors;
  liveRef.current = live;
  mosaicRef.current = mosaicOn;
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mosaicOn) {
      setSize({ width: 0, height: 0 });
      return;
    }
    const sample = document.createElement("canvas");
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true, alpha: true });
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!sampleCtx || !ctx) return;
    let alive = true;
    let frame = 0;
    let last = 0;
    const paint = () => {
      if (!mosaicRef.current) return;
      const source = sourceRef.current;
      if (!source) return;
      const natural = sourceSize(source);
      if (!natural) return;
      const cap = liveRef.current ? DOT_SAMPLE_LIVE_CAP : DOT_SAMPLE_CAP;
      const long = Math.max(natural.width, natural.height);
      const scale = long > cap ? cap / long : 1;
      const sampleW = Math.max(1, Math.round(natural.width * scale));
      const sampleH = Math.max(1, Math.round(natural.height * scale));
      if (sample.width !== sampleW || sample.height !== sampleH) {
        sample.width = sampleW;
        sample.height = sampleH;
      }
      sampleCtx.clearRect(0, 0, sampleW, sampleH);
      sampleCtx.imageSmoothingEnabled = false;
      sampleCtx.drawImage(source, 0, 0, sampleW, sampleH);
      const shot = sampleCtx.getImageData(0, 0, sampleW, sampleH);
      const out = renderDotImage(shot.data, sampleW, sampleH, colsRef.current, colorsRef.current, recipeRef.current);
      if (canvas.width !== out.width || canvas.height !== out.height) {
        canvas.width = out.width;
        canvas.height = out.height;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(new ImageData(new Uint8ClampedArray(out.rgba), out.width, out.height), 0, 0);
      setSize((current) => (current.width === out.width && current.height === out.height ? current : { width: out.width, height: out.height }));
    };
    const tick = (now: number) => {
      if (!alive) return;
      if (now - last >= 50) {
        last = now;
        paint();
      }
      frame = window.requestAnimationFrame(tick);
    };
    paint();
    const source = sourceRef.current;
    const onLoad = () => paint();
    if (source instanceof HTMLImageElement) source.addEventListener("load", onLoad);
    let tries = 0;
    const boot = () => {
      if (!alive) return;
      const current = sourceRef.current;
      if (!current || !sourceSize(current)) {
        tries += 1;
        if (tries < 45) {
          frame = window.requestAnimationFrame(boot);
          return;
        }
      } else paint();
      if (!liveRef.current) return;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(boot);
    return () => {
      alive = false;
      window.cancelAnimationFrame(frame);
      if (source instanceof HTMLImageElement) source.removeEventListener("load", onLoad);
    };
  }, [sourceRef, cols, colors, recipeKey, live, mosaicOn]);

  const shot = mosaicOn && size.width > 0 && size.height > 0;
  return (
    <aside className="dot-preview" aria-label="ドットプレビュー" onPointerDown={(event) => event.stopPropagation()}>
      <p className="dot-preview-meta">{shot ? `${size.width}×${size.height} px` : mosaicOn ? "" : "ドット数 OFF"}</p>
      <label className="dot-preview-plate">
        <span>背景</span>
        <select aria-label="下地" value={plate} onChange={(event) => onPlate(event.target.value as DotPlate)}>
          <option value="clear">透明</option>
          <option value="black">黒</option>
          <option value="white">白</option>
          <option value="green">緑</option>
        </select>
      </label>
      <div className={plate === "clear" ? "dot-preview-view" : `dot-preview-view is-${plate}`}>
        <div
          className={plate === "clear" ? "dot-preview-shot" : `dot-preview-shot is-${plate}`}
          style={shot ? { width: size.width, height: size.height } : undefined}
          hidden={!shot}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>
      <button type="button" className="dot-preview-copy" disabled={copying} onClick={onCopy}>
        ドットバイドットでフォルダに複製をつくる
      </button>
    </aside>
  );
}

function ordered(markers: readonly DotMarker[]): DotMarker[] {
  return markers.slice().sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}

export function DotMarkerList({
  markers,
  selectedId,
  editing,
  placing,
  onSelect,
  onEdit,
  onPlace,
  onChange,
}: {
  markers: readonly DotMarker[];
  selectedId: string | null;
  editing: boolean;
  placing: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onPlace: (value: boolean) => void;
  onChange: (markers: DotMarker[]) => void;
}) {
  const selected = markers.find((marker) => marker.id === selectedId) ?? null;
  const patch = (id: string, next: Partial<DotMarker>) => {
    onChange(markers.map((marker) => (marker.id === id ? { ...marker, ...next } : marker)));
  };
  const movePriority = (id: string, dir: 1 | -1) => {
    const list = ordered(markers);
    const index = list.findIndex((marker) => marker.id === id);
    const other = list[index + (dir > 0 ? -1 : 1)];
    if (index < 0 || !other) {
      const max = markers.reduce((best, marker) => Math.max(best, marker.priority), 0);
      patch(id, { priority: dir > 0 ? max + 1 : Math.max(0, (markers.find((marker) => marker.id === id)?.priority ?? 1) - 1) });
      return;
    }
    const current = markers.find((marker) => marker.id === id);
    if (!current) return;
    onChange(
      markers.map((marker) => {
        if (marker.id === id) return { ...marker, priority: other.priority };
        if (marker.id === other.id) return { ...marker, priority: current.priority };
        return marker;
      }),
    );
  };
  return (
    <aside className="dot-marker-list marker-list" aria-label="円マーカー" onPointerDown={(event) => event.stopPropagation()}>
      <div className="dot-marker-head">
        <p className="marker-list-title">円マーカー</p>
        <button type="button" className={placing ? "is-on" : undefined} aria-pressed={placing} onClick={() => onPlace(!placing)}>
          マーカー設置
        </button>
        <button
          type="button"
          onClick={() => {
            const priority = markers.reduce((best, marker) => Math.max(best, marker.priority), 0) + 1;
            const next = newDotMarker(markers.length + 1, priority);
            onChange([...markers, next]);
            onSelect(next.id);
            onEdit(next.id);
            onPlace(true);
          }}
        >
          追加
        </button>
      </div>
      {markers.length === 0 ? <p className="marker-list-empty">まだありません</p> : null}
      <ol>
        {ordered(markers).map((marker, index) => (
          <li key={marker.id}>
            <div className="marker-list-row">
              <button
                type="button"
                className={marker.id === selectedId ? "marker-list-pick is-on" : "marker-list-pick"}
                aria-pressed={marker.id === selectedId}
                onClick={() => onSelect(marker.id)}
                onDoubleClick={() => onEdit(marker.id)}
              >
                <span className="marker-list-index">{index + 1}</span>
              </button>
              <input
                className="dot-marker-name"
                aria-label={`${marker.name}の名前`}
                value={marker.name}
                onFocus={() => onSelect(marker.id)}
                onDoubleClick={() => onEdit(marker.id)}
                onChange={(event) => patch(marker.id, { name: event.target.value.slice(0, 24) })}
              />
              <button type="button" aria-label={`${marker.name}を前面へ`} onClick={() => movePriority(marker.id, 1)}>
                前
              </button>
              <button type="button" className="marker-list-remove" aria-label={`${marker.name}を削除`} onClick={() => onChange(markers.filter((entry) => entry.id !== marker.id))}>
                ×
              </button>
            </div>
          </li>
        ))}
      </ol>
      {editing && selected ? (
        <div className="dot-marker-edit" aria-label={`${selected.name}の個別設定`}>
          <p className="marker-list-title">{selected.name}</p>
          <Field label="くっきり">
            <input type="range" min={0} max={100} value={selected.crisp} aria-label="色の境界のくっきり具合" onChange={(event) => patch(selected.id, { crisp: Number(event.target.value) })} />
          </Field>
          <Field label="濃度">
            <input type="range" min={-100} max={100} value={selected.density} aria-label="マーカーの濃度" onChange={(event) => patch(selected.id, { density: Number(event.target.value) })} />
            <button type="button" aria-label="マーカーの濃度を初期値に戻す" onClick={() => patch(selected.id, { density: 0 })}>
              戻す
            </button>
          </Field>
          <Field label="明暗">
            <input type="range" min={-100} max={100} value={selected.contrast} aria-label="マーカーのコントラスト" onChange={(event) => patch(selected.id, { contrast: Number(event.target.value) })} />
            <button type="button" aria-label="マーカーのコントラストを初期値に戻す" onClick={() => patch(selected.id, { contrast: 0 })}>
              戻す
            </button>
          </Field>
          <Field label="主線">
            <input type="range" min={0} max={100} value={selected.line} aria-label="マーカーの主線" onChange={(event) => patch(selected.id, { line: Number(event.target.value) })} />
          </Field>
          <Field label="取得位置">
            <select aria-label="マーカーの取得位置" value={selected.bias} onChange={(event) => patch(selected.id, { bias: event.target.value as DotBias })}>
              <option value="tl">左上</option>
              <option value="center">中央</option>
              <option value="br">右下</option>
            </select>
          </Field>
          <button type="button" onClick={() => onEdit("")}>
            閉じる
          </button>
        </div>
      ) : null}
    </aside>
  );
}

export function DotMarkerLayer({
  markers,
  selectedId,
  onSelect,
  onEdit,
  onChange,
}: {
  markers: readonly DotMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onChange: (markers: DotMarker[]) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const dragRef = useRef<{ id: string; pointer: number; mode: "move" | "resize"; du: number; dv: number } | null>(null);

  useEffect(() => {
    const node = layerRef.current;
    if (!node) return;
    const apply = () => {
      setBox({ width: node.offsetWidth, height: node.offsetHeight });
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const update = (id: string, u: number, v: number, r: number) => {
    onChange(markers.map((marker) => (marker.id === id ? { ...marker, u, v, r } : marker)));
  };

  const onPointerDown = (marker: DotMarker, event: ReactPointerEvent<HTMLElement>, mode: "move" | "resize") => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(marker.id);
    const layer = layerRef.current;
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    dragRef.current = {
      id: marker.id,
      pointer: event.pointerId,
      mode,
      du: px - marker.u * rect.width,
      dv: py - marker.v * rect.height,
    };
    const button = event.currentTarget.closest("button");
    try {
      (button ?? event.currentTarget).setPointerCapture(event.pointerId);
    } catch {
      /* the drag still ends on pointerup */
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const layer = layerRef.current;
    if (!layer) return;
    const rect = layer.getBoundingClientRect();
    const marker = markers.find((entry) => entry.id === drag.id);
    if (!marker || rect.width < 1 || rect.height < 1) return;
    const minSide = Math.min(rect.width, rect.height);
    if (drag.mode === "resize") {
      const dist = Math.hypot(event.clientX - rect.left - marker.u * rect.width, event.clientY - rect.top - marker.v * rect.height);
      update(marker.id, marker.u, marker.v, Math.max(0.04, Math.min(0.48, dist / minSide)));
      return;
    }
    const u = Math.max(0, Math.min(1, (event.clientX - rect.left - drag.du) / rect.width));
    const v = Math.max(0, Math.min(1, (event.clientY - rect.top - drag.dv) / rect.height));
    update(marker.id, u, v, marker.r);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointer !== event.pointerId) return;
    dragRef.current = null;
  };

  return (
    <div ref={layerRef} className="dot-marker-layer" aria-hidden={markers.length === 0}>
      {markers.map((marker) => {
        const short = Math.min(box.width, box.height);
        const widthPct = box.width > 0 ? (marker.r * 2 * short * 100) / box.width : 0;
        const heightPct = box.height > 0 ? (marker.r * 2 * short * 100) / box.height : 0;
        const on = marker.id === selectedId;
        return (
          <button
            key={marker.id}
            type="button"
            className={on ? "dot-circle is-on" : "dot-circle"}
            aria-label={marker.name}
            style={{
              left: `${marker.u * 100}%`,
              top: `${marker.v * 100}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
            }}
            onPointerDown={(event) => onPointerDown(marker, event, "move")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(marker.id);
              onEdit(marker.id);
            }}
          >
            {on ? (
              <span
                className="dot-handle"
                aria-label={`${marker.name}の大きさ`}
                onPointerDown={(event) => onPointerDown(marker, event, "resize")}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
