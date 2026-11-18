/**
 * Canvas mode keeps the top menu outside the split.
 * The gallery viewer must not resize that menu or the side rails.
 */

/** Folder and tag rails stay as the user left them while an image or slideshow is open. */
export function desktopRailOpen(canvasOn: boolean, canvasRailOpen: boolean, savedOpen: boolean): boolean {
  return canvasOn ? canvasRailOpen : savedOpen;
}

export type DockedKeyPlace = "viewer" | "menu" | "canvas" | "page" | "other";

/**
 * A docked slideshow only owns keys aimed at the gallery viewer.
 * Escape on the page still ends it. The menu and the canvas keep their keys.
 */
export function dockedSlideshowKeyAction(place: DockedKeyPlace, key: string): "pass" | "close" | "swallow" {
  if (place === "viewer") return key === "Escape" ? "close" : "swallow";
  if (place === "page" && key === "Escape") return "close";
  return "pass";
}
