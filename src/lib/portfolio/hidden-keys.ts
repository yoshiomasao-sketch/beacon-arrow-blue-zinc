/** PC hidden-mode arrow keys. Playback and liquid stay in the lightbox; this only picks the existing action. */

export type HiddenArrowCommand = "favorite-stop" | "favorite-play" | "liquid-arm" | "liquid-fire" | "ignore";

/** The saved favorite is live only when one of its own channels is actually running. A key count is not playback. */
export function favoritePlaybackLive(input: {
  hasFavorite: boolean;
  savedAnim: boolean;
  animRunning: boolean;
  savedVoice: boolean;
  voiceRunning: boolean;
  savedVector: boolean;
  vectorRunning: boolean;
  savedEffect?: boolean;
  effectRunning?: boolean;
}): boolean {
  if (!input.hasFavorite) return false;
  return (
    (input.savedAnim && input.animRunning) ||
    (input.savedVoice && input.voiceRunning) ||
    (input.savedVector && input.vectorRunning) ||
    (!!input.savedEffect && !!input.effectRunning)
  );
}

export function hiddenArrowCommand(input: {
  key: string;
  repeat: boolean;
  held: boolean;
  phone: boolean;
  hidden: boolean;
  typing: boolean;
  editing: boolean;
  favoriteLive: boolean;
  hasFavorite: boolean;
  canLiquid: boolean;
  liquidMode: boolean;
  liquidBooting: boolean;
}): HiddenArrowCommand {
  if (input.phone || !input.hidden || input.typing || input.editing) return "ignore";
  if (input.key !== "ArrowUp" && input.key !== "ArrowDown") return "ignore";
  if (input.repeat || input.held) return "ignore";
  if (input.key === "ArrowUp") {
    if (!input.hasFavorite) return "ignore";
    return input.favoriteLive ? "favorite-stop" : "favorite-play";
  }
  if (!input.canLiquid || input.liquidBooting) return "ignore";
  return input.liquidMode ? "liquid-fire" : "liquid-arm";
}
