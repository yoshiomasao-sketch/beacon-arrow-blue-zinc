/** Phone voice catalog helpers. Playback never names a specific file. */

export type VoiceTrack = {
  id: string;
  label: string;
  src: string;
};

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg)$/i;

/** 0 is silence, 100 is full. Values outside that range stay inside it. */
export function volumeToGain(percent: number): number {
  if (!Number.isFinite(percent)) return 1;
  return Math.min(1, Math.max(0, percent / 100));
}

export const VOICE_RATES = [0.5, 1, 1.5, 2] as const;
export type VoiceRate = (typeof VOICE_RATES)[number];

export function voiceRateLabel(rate: number): string {
  return `${rate.toFixed(1)}倍速`;
}

export function normalizeVoiceRate(rate: number): VoiceRate {
  return VOICE_RATES.find((entry) => entry === rate) ?? 1;
}

/**
 * Change speed only. Playback position and the paused state stay as they are.
 * Pitch stays put when the browser can do that. Otherwise the rate still changes.
 */
export function applyVoiceRate(audio: HTMLAudioElement, rate: number): void {
  audio.playbackRate = normalizeVoiceRate(rate);
  const pitched = audio as HTMLAudioElement & { webkitPreservesPitch?: boolean };
  try {
    audio.preservesPitch = true;
  } catch {
    /* this browser does not keep pitch while changing speed */
  }
  try {
    pitched.webkitPreservesPitch = true;
  } catch {
    /* older WebKit builds omit the prefixed flag */
  }
}

export function displayName(fileName: string, labels: Record<string, unknown> | null | undefined): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const custom = labels?.[base];
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  const stem = base.replace(/\.[^.]+$/u, "").replace(/[_-]+/gu, " ").trim();
  return stem || base;
}

/** Build the selectable list from files on disk plus optional display names. */
export function buildVoiceLibrary(
  files: Record<string, unknown>,
  labels: Record<string, unknown> | null | undefined = {},
): VoiceTrack[] {
  const tracks: VoiceTrack[] = [];
  for (const [path, src] of Object.entries(files)) {
    if (!AUDIO_EXT.test(path)) continue;
    if (typeof src !== "string" || src.length === 0) continue;
    const id = path.split(/[/\\]/).pop() ?? path;
    tracks.push({ id, label: displayName(id, labels), src });
  }
  tracks.sort((a, b) => a.label.localeCompare(b.label, "ja") || a.id.localeCompare(b.id, "ja"));
  return tracks;
}
