import sheet01 from "../../../reference/liquid-assets/luma-white/liquid_01.png";
import sheet02 from "../../../reference/liquid-assets/luma-white/liquid_02.png";
import sheet03 from "../../../reference/liquid-assets/luma-white/liquid_03.png";
import sheet04 from "../../../reference/liquid-assets/luma-white/liquid_04.png";
import sheet05 from "../../../reference/liquid-assets/luma-white/liquid_05.png";
import { LIQUID_ASSET_IDS, type LiquidAssetId } from "@/lib/portfolio/liquid";

export const LIQUID_ASSET_URL: Record<LiquidAssetId, string> = {
  liquid_01: sheet01,
  liquid_02: sheet02,
  liquid_03: sheet03,
  liquid_04: sheet04,
  liquid_05: sheet05,
};

const images = new Map<LiquidAssetId, HTMLImageElement>();
let loading: Promise<boolean> | null = null;

export function liquidImage(id: LiquidAssetId): HTMLImageElement | null {
  return images.get(id) ?? null;
}

/** Loads the five transparent liquid sheets. False if any file fails. */
export function primeLiquidAssets(): Promise<boolean> {
  if (images.size === LIQUID_ASSET_IDS.length) return Promise.resolve(true);
  if (loading) return loading;
  if (typeof Image === "undefined") return Promise.resolve(false);
  loading = Promise.all(
    LIQUID_ASSET_IDS.map(
      (id) =>
        new Promise<boolean>((resolve) => {
          const image = new Image();
          image.onload = () => {
            if (image.naturalWidth > 0) images.set(id, image);
            resolve(image.naturalWidth > 0);
          };
          image.onerror = () => resolve(false);
          image.src = LIQUID_ASSET_URL[id];
        }),
    ),
  ).then((flags) => flags.every(Boolean));
  return loading;
}
