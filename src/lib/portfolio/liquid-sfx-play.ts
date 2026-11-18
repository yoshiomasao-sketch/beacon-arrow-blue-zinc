import { claimSound, type LiquidSoundKind } from "@/lib/portfolio/liquid-sfx";
import { liquidSfxUrl } from "@/lib/portfolio/liquid-sfx-assets";
import { withDeadline } from "@/lib/portfolio/load-deadline";
import { clearActive, clearFailure, reportActive, reportFailure } from "@/lib/portfolio/load-report";

/**
 * Small effect sounds stay decoded. Voice favorites do not use this cache.
 * Gain stays at 1. The voice slider does not change these.
 */

const buffers = new Map<string, AudioBuffer>();
const decoding = new Map<string, Promise<boolean>>();
let context: AudioContext | null = null;
let epoch = 0;
let resumeFlight: Promise<boolean> | null = null;
const fireSources: AudioBufferSourceNode[] = [];
const dripSources: AudioBufferSourceNode[] = [];

export type LiquidSoundMark = {
  kind: LiquidSoundKind;
  id: string;
  /** When start() was accepted. This is not proof a speaker made sound. */
  at: number;
};

const marks: LiquidSoundMark[] = [];

export function recentLiquidSounds(): readonly LiquidSoundMark[] {
  return marks;
}

function audioContext(): AudioContext {
  if (context) return context;
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("no audio context");
  context = new Ctx();
  return context;
}

/** Call from the click or tap that opens liquid mode, before any await. */
export function unlockLiquidAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = audioContext();
    if (ctx.state === "running") return;
    if (!resumeFlight) {
      resumeFlight = ctx.resume().then(
        () => ctx.state === "running",
        () => false,
      ).finally(() => {
        resumeFlight = null;
      });
    }
  } catch {
    /* a later shot can still draw */
  }
}

function audioRunning(): Promise<boolean> {
  const ctx = audioContext();
  if (ctx.state === "running") return Promise.resolve(true);
  unlockLiquidAudio();
  return resumeFlight ?? Promise.resolve(false);
}

export function sfxReady(id: string): boolean {
  return buffers.has(id);
}

const SFX_FETCH_MS = 8000;
const SFX_DECODE_MS = 8000;

export function preloadSfx(id: string): Promise<boolean> {
  if (buffers.has(id)) return Promise.resolve(true);
  const pending = decoding.get(id);
  if (pending) return pending;
  const url = liquidSfxUrl(id);
  if (!url || typeof window === "undefined") {
    reportFailure(id, "通信");
    return Promise.resolve(false);
  }
  const stamp = epoch;
  let task: Promise<boolean> = Promise.resolve(false);
  task = (async () => {
    const controller = new AbortController();
    let stage = "通信";
    reportActive(id, stage);
    try {
      const fetched = await withDeadline(fetch(url, { signal: controller.signal }), SFX_FETCH_MS, () => controller.abort());
      if (stamp !== epoch) return false;
      if (!fetched.ok || !fetched.value.ok) {
        reportFailure(id, fetched.ok ? "通信" : fetched.timeout ? "通信（時間切れ）" : "通信");
        return false;
      }
      stage = "デコード";
      reportActive(id, stage);
      const bytes = await fetched.value.arrayBuffer();
      if (stamp !== epoch) return false;
      const ctx = audioContext();
      if (ctx.state !== "running") {
        stage = "音声コンテキストの再開";
        reportActive(id, stage);
        const resumed = await withDeadline(audioRunning(), 4000);
        if (stamp !== epoch) return false;
        if (!resumed.ok || !resumed.value) {
          reportFailure(id, resumed.ok ? "音声コンテキストの再開" : resumed.timeout ? "音声コンテキストの再開（時間切れ）" : "音声コンテキストの再開");
          return false;
        }
        stage = "デコード";
        reportActive(id, stage);
      }
      const decoded = await withDeadline(ctx.decodeAudioData(bytes.slice(0)), SFX_DECODE_MS);
      if (stamp !== epoch) return false;
      if (!decoded.ok) {
        reportFailure(id, decoded.timeout ? "デコード（時間切れ）" : "デコード");
        return false;
      }
      buffers.set(id, decoded.value);
      clearFailure(id);
      return true;
    } catch {
      if (stamp === epoch) reportFailure(id, stage === "通信" ? "通信" : stage);
      return false;
    } finally {
      controller.abort();
      clearActive(id);
      if (decoding.get(id) === task) decoding.delete(id);
    }
  })();
  decoding.set(id, task);
  return task;
}

function stopList(list: AudioBufferSourceNode[]) {
  for (const source of list) {
    try {
      source.onended = null;
      source.stop();
    } catch {
      /* already finished */
    }
  }
  list.length = 0;
}

/** Stops fire and drip that are already sounding. Does not reshuffle either bag. */
export function stopLiquidSounds(): void {
  stopList(fireSources);
  stopList(dripSources);
}

export function clearSfxCache(): void {
  epoch += 1;
  stopLiquidSounds();
  buffers.clear();
  decoding.clear();
}

function startBuffer(kind: LiquidSoundKind, id: string, buffer: AudioBuffer) {
  const ctx = audioContext();
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 1;
  source.connect(gain);
  gain.connect(ctx.destination);
  const list = kind === "fire" ? fireSources : dripSources;
  source.start();
  list.push(source);
  source.onended = () => {
    const index = list.indexOf(source);
    if (index >= 0) list.splice(index, 1);
  };
  marks.push({ kind, id, at: performance.now() });
  if (marks.length > 40) marks.shift();
}

function playKind(kind: LiquidSoundKind) {
  const id = claimSound(kind, sfxReady);
  if (!id) return;
  const buffer = buffers.get(id);
  if (!buffer) return;
  startBuffer(kind, id, buffer);
}

export function playFireSound(): void {
  try {
    playKind("fire");
  } catch {
    /* the splash still runs */
  }
}

export function playDripSound(): void {
  try {
    playKind("drip");
  } catch {
    /* the sheet still stretches */
  }
}
