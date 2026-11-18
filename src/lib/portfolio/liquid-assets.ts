import sheet01 from "../../../reference/liquid-assets/liquid_cutout_test.png";
import sheet02 from "../../../reference/liquid-assets/liquid_cutout_test_02.png";
import sheet03 from "../../../reference/liquid-assets/liquid_cutout_test_03.png";
import sheet04 from "../../../reference/liquid-assets/liquid_cutout_test_04.png";
import sheet05 from "../../../reference/liquid-assets/liquid_cutout_test_05.png";
import sheet06 from "../../../reference/liquid-assets/liquid_cutout_test_06.png";
import sheet07 from "../../../reference/liquid-assets/liquid_cutout_test_07.png";
import { LIQUID_ASSET_IDS, type LiquidAssetId } from "@/lib/portfolio/liquid";
import { clearActive, clearFailure, reportActive, reportFailure } from "@/lib/portfolio/load-report";

export const LIQUID_ASSET_URL: Record<LiquidAssetId, string> = {
  liquid_cutout_test: sheet01,
  liquid_cutout_test_02: sheet02,
  liquid_cutout_test_03: sheet03,
  liquid_cutout_test_04: sheet04,
  liquid_cutout_test_05: sheet05,
  liquid_cutout_test_06: sheet06,
  liquid_cutout_test_07: sheet07,
};

const images = new Map<LiquidAssetId, HTMLImageElement>();
const inflight = new Map<LiquidAssetId, Promise<boolean>>();
let loading: Promise<boolean> | null = null;
let epoch = 0;
const IMAGE_MS = 12000;

export function liquidImage(id: LiquidAssetId): HTMLImageElement | null {
  return images.get(id) ?? null;
}

/** One sheet. A failed or timed-out file can be asked for again. Two callers share one image. */
export function loadLiquidAsset(id: LiquidAssetId): Promise<boolean> {
  if (images.has(id)) return Promise.resolve(true);
  const pending = inflight.get(id);
  if (pending) return pending;
  if (typeof Image === "undefined") {
    reportFailure(id, "画像の読み込み");
    return Promise.resolve(false);
  }
  const stamp = epoch;
  const task = new Promise<boolean>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (ok: boolean, note: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      clearActive(id);
      if (ok && stamp === epoch && image.naturalWidth > 0) {
        images.set(id, image);
        clearFailure(id);
        resolve(true);
        return;
      }
      image.removeAttribute("src");
      if (stamp === epoch) reportFailure(id, note || "画像の読み込み");
      resolve(false);
    };
    reportActive(id, "画像の読み込み");
    const timer = setTimeout(() => finish(false, "画像の読み込み（時間切れ）"), IMAGE_MS);
    image.onload = () => finish(true, "");
    image.onerror = () => finish(false, "画像の読み込み");
    image.src = LIQUID_ASSET_URL[id];
  }).finally(() => {
    if (inflight.get(id) === task) inflight.delete(id);
  });
  inflight.set(id, task);
  return task;
}

/** Loads the seven transparent liquid sheets. False if any file fails. */
export function primeLiquidAssets(): Promise<boolean> {
  if (images.size === LIQUID_ASSET_IDS.length) return Promise.resolve(true);
  if (loading) return loading;
  loading = Promise.all(LIQUID_ASSET_IDS.map((id) => loadLiquidAsset(id))).then((flags) => {
    loading = null;
    return flags.every(Boolean);
  });
  return loading;
}

/** Drops decoded sheets so the next liquid open loads them again. */
export function releaseLiquidImages(): void {
  epoch += 1;
  images.clear();
  inflight.clear();
  loading = null;
}
