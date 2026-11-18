import splash01 from "../../../reference/effect-assets/splash/splash_01.png";
import splash02 from "../../../reference/effect-assets/splash/splash_02.png";
import splash03 from "../../../reference/effect-assets/splash/splash_03.png";
import { EFFECT_ASSET_IDS, type EffectAssetId } from "@/lib/portfolio/effect-marker";

/** One import per file in reference/effect-assets/splash. The picture bytes are not edited. */
export const EFFECT_ASSET_URL: Record<EffectAssetId, string> = {
  splash_01: splash01,
  splash_02: splash02,
  splash_03: splash03,
};

const images = new Map<EffectAssetId, HTMLImageElement>();
const failed = new Set<EffectAssetId>();

export function effectImage(id: EffectAssetId): HTMLImageElement | null {
  return images.get(id) ?? null;
}

/** Loads one sheet. A failure is remembered for this page and does not reject the whole effect. */
export function loadEffectAsset(id: EffectAssetId): Promise<boolean> {
  if (images.has(id)) return Promise.resolve(true);
  if (failed.has(id)) return Promise.resolve(false);
  if (typeof Image === "undefined") {
    failed.add(id);
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > 0) images.set(id, image);
      else failed.add(id);
      resolve(images.has(id));
    };
    image.onerror = () => {
      failed.add(id);
      resolve(false);
    };
    image.src = EFFECT_ASSET_URL[id];
  });
}

/** Loads every registered sheet. One broken file does not cancel the others. */
export function primeEffectAssets(): Promise<boolean> {
  return Promise.all(EFFECT_ASSET_IDS.map((id) => loadEffectAsset(id))).then((flags) => flags.some(Boolean));
}
