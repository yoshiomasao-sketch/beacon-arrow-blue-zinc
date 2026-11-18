/**
 * Liquid sound names. Digits are not normalized.
 * 発射音１ ２ ３ use fullwidth digits. 発射音4 and both drip files use halfwidth digits.
 */

export const FIRE_SOUND_IDS = ["発射音１.mp3", "発射音２.mp3", "発射音３.mp3", "発射音4.mp3"] as const;

export const DRIP_SOUND_IDS = ["垂れる音1.mp3", "垂れる音2.mp3"] as const;

export type FireSoundId = (typeof FIRE_SOUND_IDS)[number];
export type DripSoundId = (typeof DRIP_SOUND_IDS)[number];
export type LiquidSoundKind = "fire" | "drip";

type Bag = {
  items: string[];
  last: string | null;
};

const fireBag: Bag = { items: [], last: null };
const dripBag: Bag = { items: [], last: null };
let bagRandom: () => number = Math.random;

function bagFor(kind: LiquidSoundKind): { bag: Bag; ids: readonly string[] } {
  if (kind === "fire") return { bag: fireBag, ids: FIRE_SOUND_IDS };
  return { bag: dripBag, ids: DRIP_SOUND_IDS };
}

export function resetSoundBags(): void {
  fireBag.items = [];
  fireBag.last = null;
  dripBag.items = [];
  dripBag.last = null;
}

export function setSoundBagRandom(random: () => number): void {
  bagRandom = random;
}

export function soundBagSize(kind: LiquidSoundKind): number {
  return bagFor(kind).bag.items.length;
}

function refill(bag: Bag, ids: readonly string[]) {
  const next = ids.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(bagRandom() * (i + 1));
    const swap = next[i] as string;
    next[i] = next[j] as string;
    next[j] = swap;
  }
  if (bag.last && next[0] === bag.last && next.length > 1) {
    const j = 1 + Math.floor(bagRandom() * (next.length - 1));
    const swap = next[0] as string;
    next[0] = next[j] as string;
    next[j] = swap;
  }
  bag.items = next;
}

/**
 * Next unused sound of this kind, or null when every remaining file is refused.
 * A missing buffer is not spent. Fire and drip bags never share a draw.
 * Clearing the splash does not refill either bag.
 */
export function claimSound(kind: LiquidSoundKind, ready: (id: string) => boolean): string | null {
  const { bag, ids } = bagFor(kind);
  if (bag.items.length === 0) refill(bag, ids);
  const skipped: string[] = [];
  while (bag.items.length > 0) {
    const id = bag.items.shift() as string;
    if (ready(id)) {
      bag.items = bag.items.concat(skipped);
      bag.last = id;
      return id;
    }
    skipped.push(id);
  }
  bag.items = skipped;
  return null;
}
