import { LIQUID_ASSET_IDS, type LiquidAssetId } from "@/lib/portfolio/liquid";
import { loadLiquidAsset, releaseLiquidImages } from "@/lib/portfolio/liquid-assets";
import { DRIP_SOUND_IDS, FIRE_SOUND_IDS } from "@/lib/portfolio/liquid-sfx";
import { clearSfxCache, preloadSfx } from "@/lib/portfolio/liquid-sfx-play";
import { confirmAudioHeader } from "@/lib/portfolio/load-deadline";
import {
  activeLoads,
  clearActive,
  clearFailure,
  reportActive,
  reportFailure,
  resetLoadReport,
  subscribeLoadActivity,
} from "@/lib/portfolio/load-report";
import { assetPhase, createAssetBook, ensureAssets, resetAssetBook, snapshotAssets, type MediaJob } from "@/lib/portfolio/media-book";
import { VOICE_TRACKS } from "@/lib/portfolio/voice-catalog";

/**
 * Session cache for the liquid kit only.
 * Effect sounds are decoded once, when liquid mode starts.
 * Voices are not warmed here. The playback element loads one voice when it is played.
 * Image animation has no files. It is computed while the photo is open.
 */

export type MediaKit = "liquid" | "stage";

const VOICE_EVENT_MS = 2500;
const VOICE_HEADER_MS = 8000;

const book = createAssetBook();
const sfxIds = new Set<string>([...FIRE_SOUND_IDS, ...DRIP_SOUND_IDS]);
const liquidIds = new Set<string>(LIQUID_ASSET_IDS);

type Flight = {
  promise: Promise<MediaJob>;
  listeners: Set<(job: MediaJob) => void>;
};

const flights = new Map<MediaKit, Flight>();

export function kitIds(name: MediaKit): string[] {
  if (name === "liquid") return [...FIRE_SOUND_IDS, ...DRIP_SOUND_IDS, ...LIQUID_ASSET_IDS];
  // Kept for the book. The animation menu does not warm these. A voice loads when it is played.
  return VOICE_TRACKS.map((track) => track.id);
}

export function kitReady(name: MediaKit): boolean {
  return snapshotAssets(book, kitIds(name)).ready;
}

export function kitSnapshot(name: MediaKit): MediaJob {
  return { ...snapshotAssets(book, kitIds(name)), active: activeLoads().filter((item) => kitIds(name).includes(item.id)) };
}

export function voiceWarmed(id: string): boolean {
  return assetPhase(book, id) === "ready";
}

function phoneLayout(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 899px)").matches;
}

function kitConcurrency(name: MediaKit): number {
  if (name === "stage") return phoneLayout() ? 2 : 3;
  return phoneLayout() ? 3 : 6;
}

function releaseAudio(audio: HTMLAudioElement): void {
  audio.removeAttribute("src");
  try {
    audio.load();
  } catch {
    /* the element is only a probe */
  }
}

/** Metadata only. The element is always released so the phone can open the next file. */
function listenForMetadata(src: string, id: string): Promise<boolean> {
  reportActive(id, "メタデータ");
  return new Promise((resolve) => {
    let audio: HTMLAudioElement;
    try {
      audio = new Audio();
    } catch {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("error", onMiss);
      releaseAudio(audio);
      resolve(ok);
    };
    const onReady = () => finish(true);
    const onMiss = () => finish(false);
    const timer = setTimeout(() => finish(false), VOICE_EVENT_MS);
    audio.preload = "metadata";
    audio.addEventListener("loadedmetadata", onReady);
    audio.addEventListener("error", onMiss);
    audio.src = src;
  });
}

async function probeVoice(id: string): Promise<boolean> {
  const track = VOICE_TRACKS.find((entry) => entry.id === id);
  if (!track || typeof Audio === "undefined") {
    reportFailure(id, "音声ファイルがありません");
    return false;
  }
  try {
    if (await listenForMetadata(track.src, id)) {
      clearFailure(id);
      return true;
    }
    reportActive(id, "ヘッダ確認");
    const header = await confirmAudioHeader(track.src, VOICE_HEADER_MS);
    if (header === "ok") {
      clearFailure(id);
      return true;
    }
    reportFailure(id, header === "timeout" ? "ヘッダ確認（時間切れ）" : "通信");
    return false;
  } finally {
    clearActive(id);
  }
}

function loadAsset(id: string): Promise<boolean> {
  if (sfxIds.has(id)) return preloadSfx(id);
  if (liquidIds.has(id)) return loadLiquidAsset(id as LiquidAssetId);
  return probeVoice(id);
}

export function ensureVoice(id: string): Promise<boolean> {
  if (!VOICE_TRACKS.some((track) => track.id === id)) return Promise.resolve(false);
  return ensureAssets(book, [id], loadAsset).then((job) => job.ready);
}

function decorate(job: MediaJob, ids: readonly string[]): MediaJob {
  const allowed = new Set(ids);
  return { ...job, active: activeLoads().filter((item) => allowed.has(item.id)) };
}

export function loadKit(name: MediaKit, onProgress?: (job: MediaJob) => void): Promise<MediaJob> {
  const ids = kitIds(name);
  const current = decorate(snapshotAssets(book, ids), ids);
  if (current.ready) {
    onProgress?.(current);
    return Promise.resolve(current);
  }
  const existing = flights.get(name);
  if (existing) {
    if (onProgress) {
      existing.listeners.add(onProgress);
      onProgress(decorate(snapshotAssets(book, ids), ids));
    }
    return existing.promise.finally(() => {
      if (onProgress) existing.listeners.delete(onProgress);
    });
  }
  const listeners = new Set<(job: MediaJob) => void>();
  if (onProgress) listeners.add(onProgress);
  const emit = (job: MediaJob) => {
    const next = decorate(job, ids);
    for (const listen of listeners) listen(next);
  };
  const stopActivity = subscribeLoadActivity(() => emit(snapshotAssets(book, ids)));
  const promise = ensureAssets(book, ids, loadAsset, {
    concurrency: kitConcurrency(name),
    onProgress: (job) => emit(job),
  }).finally(() => {
    stopActivity();
    if (flights.get(name)?.promise === promise) flights.delete(name);
  });
  flights.set(name, { promise, listeners });
  return promise;
}

export function loadKits(names: readonly MediaKit[], onProgress?: (job: MediaJob) => void): Promise<MediaJob> {
  const parts = new Map<MediaKit, MediaJob>();
  const emit = () => {
    let done = 0;
    let total = 0;
    const failed: string[] = [];
    const active: { id: string; stage: string }[] = [];
    for (const name of names) {
      const job = parts.get(name) ?? decorate(snapshotAssets(book, kitIds(name)), kitIds(name));
      done += job.done;
      total += job.total;
      failed.push(...job.failed);
      active.push(...(job.active ?? []));
    }
    const job = {
      done,
      total,
      failed,
      active,
      ready: total === 0 || (done === total && failed.length === 0),
    };
    onProgress?.(job);
    return job;
  };
  return Promise.all(
    names.map((name) =>
      loadKit(name, (job) => {
        parts.set(name, job);
        emit();
      }),
    ),
  ).then(() => emit());
}

/** Drops the session cache. The next liquid tap or hidden-mode start loads again. */
export function forgetReadyAssets(): void {
  resetAssetBook(book);
  flights.clear();
  resetLoadReport();
  clearSfxCache();
  releaseLiquidImages();
}
