import { buildVoiceLibrary, type VoiceTrack } from "@/lib/portfolio/voice-library";

/**
 * Drop mp3, m4a, aac, or wav files into src/assets/voices.
 * iPhone plays those. ogg is accepted too, but many iPhones cannot play it.
 * Optional display names live in src/assets/voices/labels.json:
 * { "rain.mp3": "静かな雨" }
 * A file with no label uses its file name, without the extension.
 */

const fileUrls = import.meta.glob("../../assets/voices/*.{mp3,m4a,aac,wav,ogg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const labelModules = import.meta.glob("../../assets/voices/labels.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, unknown>>;

const labels = Object.values(labelModules)[0] ?? {};

export const VOICE_TRACKS: VoiceTrack[] = buildVoiceLibrary(fileUrls, labels);
