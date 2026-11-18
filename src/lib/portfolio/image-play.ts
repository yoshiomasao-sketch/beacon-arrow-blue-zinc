import type { ImagePlay } from "./types.ts";
import { normalizeEffectMarkers } from "./effect-marker.ts";
import { normalizeLiquidHides, normalizeLiquidRanges } from "./liquid.ts";

const KINDS = new Set<ImagePlay["kind"]>(["swayX", "hitX", "swayY", "hitY", "orbit", "zoom", "buzz"]);
const SPEEDS = new Set<ImagePlay["speed"]>(["slow", "normal", "fast", "rapid", "ultra"]);
const RATES = new Set<ImagePlay["rate"]>([0.5, 1, 1.5, 2]);
const PACES = new Set<ImagePlay["zoomPace"]>(["slow", "normal", "fast"]);

function paceOf(value: unknown): ImagePlay["zoomPace"] {
  return typeof value === "string" && PACES.has(value as ImagePlay["zoomPace"]) ? (value as ImagePlay["zoomPace"]) : "normal";
}

/** Phone enlarge, and the PC hidden tools, are the only views that start a saved favorite on their own. */
export function autoFavoriteMode(phone: boolean, hiddenTools: boolean): boolean {
  return phone || hiddenTools;
}

const ANIM_LABEL: Record<Exclude<ImagePlay["kind"], null>, string> = {
  swayX: "横揺れ・ゆるやか",
  hitX: "横揺れ・打ち付け",
  swayY: "縦揺れ・ゆるやか",
  hitY: "縦揺れ・打ち付け",
  orbit: "円運動",
  zoom: "ズーム",
  buzz: "通知バイブレーション",
};

const SPEED_LABEL: Record<ImagePlay["speed"], string> = {
  slow: "遅い",
  normal: "普通",
  fast: "速い",
  rapid: "高速",
  ultra: "超高速",
};

export type FavoriteAsk = { lines: string[]; names: string[] };

/** Names what the one star would save. The stored preset is still a single record. */
export function favoriteAskCopy(play: ImagePlay, voiceLabel: string | null): FavoriteAsk {
  const parts: string[] = [];
  if (play.kind) parts.push(`${ANIM_LABEL[play.kind]}・${SPEED_LABEL[play.speed]}`);
  if (play.zoom) parts.push("ズーム");
  if (play.twist) parts.push("ツイスト");
  if (play.tilt === "right") parts.push("右45度");
  if (play.tilt === "left") parts.push("左45度");
  if (play.vector) parts.push("ベクトルマーカー");
  if (play.effect || play.effects.length > 0) parts.push("エフェクトマーカー");
  if (play.liquid.length > 0) parts.push("発射範囲");
  if (play.liquidHide.length > 0) parts.push("非表示");
  const lines: string[] = [];
  const names: string[] = [];
  if (parts.length > 0) {
    lines.push("このアニメーションをお気に入りに登録しますか？");
    names.push(parts.join("、"));
  }
  const voice = voiceLabel?.trim() ? voiceLabel.trim() : null;
  if (voice) {
    lines.push("この音声をお気に入りに登録しますか？");
    names.push(voice);
  }
  if (lines.length === 0) {
    lines.push("このアニメーションをお気に入りに登録しますか？");
    names.push("停止");
  }
  return { lines, names };
}

export function normalizeImagePlay(raw: unknown): ImagePlay | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<ImagePlay>;
  const known =
    "kind" in row ||
    "speed" in row ||
    "zoom" in row ||
    "twist" in row ||
    "voiceId" in row ||
    "rate" in row ||
    "volume" in row ||
    row.vector === true ||
    row.effect === true ||
    "effects" in row ||
    "liquid" in row ||
    "liquidHide" in row;
  if (!known) return null;
  const kind = typeof row.kind === "string" && KINDS.has(row.kind) ? row.kind : null;
  const speed = typeof row.speed === "string" && SPEEDS.has(row.speed) ? row.speed : "normal";
  const rate = typeof row.rate === "number" && RATES.has(row.rate as ImagePlay["rate"]) ? (row.rate as ImagePlay["rate"]) : 1;
  const volume = typeof row.volume === "number" && Number.isFinite(row.volume) ? Math.round(Math.min(100, Math.max(0, row.volume))) : 100;
  const voiceId = typeof row.voiceId === "string" && row.voiceId.trim() ? row.voiceId.trim() : null;
  return {
    kind,
    speed,
    reverse: row.reverse === true,
    zoom: row.zoom === true,
    twist: row.twist === true,
    zoomPace: paceOf(row.zoomPace),
    twistPace: paceOf(row.twistPace),
    tilt: row.tilt === "right" || row.tilt === "left" ? row.tilt : null,
    vector: row.vector === true,
    effect: row.effect === true,
    effects: normalizeEffectMarkers(row.effects) ?? [],
    voiceId,
    rate,
    volume,
    liquid: normalizeLiquidRanges(row.liquid),
    liquidHide: normalizeLiquidHides(row.liquidHide),
  };
}
