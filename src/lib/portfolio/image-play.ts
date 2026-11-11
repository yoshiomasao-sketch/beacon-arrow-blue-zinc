import type { ImagePlay } from "./types.ts";

const KINDS = new Set<ImagePlay["kind"]>(["swayX", "hitX", "swayY", "hitY", "orbit", "zoom", "buzz"]);
const SPEEDS = new Set<ImagePlay["speed"]>(["slow", "normal", "fast", "rapid", "ultra"]);
const RATES = new Set<ImagePlay["rate"]>([0.5, 1, 1.5, 2]);
const PACES = new Set<ImagePlay["zoomPace"]>(["slow", "normal", "fast"]);

function paceOf(value: unknown): ImagePlay["zoomPace"] {
  return typeof value === "string" && PACES.has(value as ImagePlay["zoomPace"]) ? (value as ImagePlay["zoomPace"]) : "normal";
}

/** Keeps a saved preset, or null when the record has none. A bad row is dropped, not fatal. */
export function normalizeImagePlay(raw: unknown): ImagePlay | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<ImagePlay>;
  const known = "kind" in row || "speed" in row || "zoom" in row || "twist" in row || "voiceId" in row || "rate" in row || "volume" in row || row.vector === true;
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
    voiceId,
    rate,
    volume,
  };
}
