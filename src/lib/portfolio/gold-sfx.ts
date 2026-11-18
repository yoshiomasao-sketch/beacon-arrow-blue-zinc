import goldUrl from "../../../reference/effect-assets/splash/黄金音.mp3";
import { type GoldSoundMode } from "@/lib/portfolio/gold-sound";

export { goldSoundMode } from "@/lib/portfolio/gold-sound";
export type { GoldSoundMode } from "@/lib/portfolio/gold-sound";

let audio: HTMLAudioElement | null = null;
let broken = false;

function node(): HTMLAudioElement | null {
  if (broken || typeof Audio === "undefined") return null;
  if (audio) return audio;
  try {
    const element = new Audio(goldUrl);
    element.loop = true;
    element.preload = "auto";
    element.addEventListener("error", () => {
      broken = true;
    });
    audio = element;
    return element;
  } catch {
    broken = true;
    return null;
  }
}

/** One element for every marker. A failed play leaves the picture running. */
export function syncGoldSound(next: GoldSoundMode): void {
  const element = node();
  if (!element) return;
  try {
    if (next === "play") {
      if (!element.paused) return;
      const pending = element.play();
      if (pending && typeof pending.catch === "function") pending.catch(() => undefined);
      return;
    }
    element.pause();
    if (next === "stop") element.currentTime = 0;
  } catch {
    /* the mesh keeps moving */
  }
}
