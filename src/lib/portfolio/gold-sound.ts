/** One shared loop for every 黄金 marker. Splash and liquid sounds do not use this. */
export type GoldSoundMode = "play" | "pause" | "stop";

/**
 * Play while any visible 黄金 marker is animating.
 * Pause keeps the place in the loop. Stop rewinds. No gold marker means stop,
 * even if other effects are still running.
 */
export function goldSoundMode(input: {
  playing: boolean;
  preview: boolean;
  held: boolean;
  goldVisible: boolean;
}): GoldSoundMode {
  if (!input.goldVisible) return "stop";
  if (input.playing || input.preview) return "play";
  if (input.held) return "pause";
  return "stop";
}
