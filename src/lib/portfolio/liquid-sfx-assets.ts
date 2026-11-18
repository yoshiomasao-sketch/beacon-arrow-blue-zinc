import drip1 from "../../../reference/liquid-assets/audio/垂れる音1.mp3";
import drip2 from "../../../reference/liquid-assets/audio/垂れる音2.mp3";
import fire4 from "../../../reference/liquid-assets/audio/発射音4.mp3";
import fire1 from "../../../reference/liquid-assets/audio/発射音１.mp3";
import fire2 from "../../../reference/liquid-assets/audio/発射音２.mp3";
import fire3 from "../../../reference/liquid-assets/audio/発射音３.mp3";
import { DRIP_SOUND_IDS, FIRE_SOUND_IDS, type DripSoundId, type FireSoundId } from "@/lib/portfolio/liquid-sfx";

export const LIQUID_SFX_URL: Record<FireSoundId | DripSoundId, string> = {
  "発射音１.mp3": fire1,
  "発射音２.mp3": fire2,
  "発射音３.mp3": fire3,
  "発射音4.mp3": fire4,
  "垂れる音1.mp3": drip1,
  "垂れる音2.mp3": drip2,
};

const listed = new Set<string>([...FIRE_SOUND_IDS, ...DRIP_SOUND_IDS]);

export function liquidSfxUrl(id: string): string | null {
  if (!listed.has(id)) return null;
  return LIQUID_SFX_URL[id as FireSoundId | DripSoundId] ?? null;
}
