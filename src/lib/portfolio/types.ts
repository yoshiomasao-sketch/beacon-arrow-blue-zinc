import type { EffectMarker } from "./effect-marker.ts";
import type { LiquidHide, LiquidRange } from "./liquid.ts";

export const SUPPORTED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"] as const;

export type SupportedMime = (typeof SUPPORTED_MIMES)[number];

/** How an image entered the library. Backup/restore can use the same records later. */
export type ImageSource = "file" | "clipboard" | "capture";

/** Relative card width. 1 is the shared column width. */
export type DisplayScale = 1 | 2 | 3;

/**
 * Management record only. Pixel bytes are never stored on this object.
 */
export type ImageMeta = {
  id: string;
  name: string;
  mime: SupportedMime;
  width: number;
  height: number;
  byteSize: number;
  addedAt: number;
  /** Stable gallery order. Lower numbers are shown first. */
  order: number;
  scale: DisplayScale;
  source: ImageSource;
  /** Owning folder. Empty only before the first library migration. */
  folderId: string;
  /** Kept by image id. Moving folders does not clear it. */
  favorite: boolean;
  /** Tag ids, not names. A rename updates every image through the tag record. */
  tagIds: string[];
  /** True when the original file itself animates. Stills stay false. */
  animated: boolean;
  /** Short note kept with this image. Empty when unset. */
  memo: string;
  /** False hides the pen layer only. Missing means shown. */
  inkVisible?: boolean;
  /**
   * Display mosaic. Missing on older records, which stay sharp.
   * `on` can be false while `cols` is kept for the next time it is turned on.
   */
  dot?: ImageDot;
  /** Puru markers kept with this image id. Missing means none were saved. */
  puru?: ImagePuru;
  /** Vector markers kept with this image id. Missing means none were saved. */
  vectors?: ImageVectors;
  /** Effect markers kept with this image id. Missing means none were saved. */
  effects?: ImageEffects;
  /** Animation and voice preset for this image. Missing means none was saved. */
  play?: ImagePlay;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
  order: number;
  createdAt: number;
  /** Null when the tag sits at the root of the tag list. */
  folderId: string | null;
};

export type TagFolder = {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  open: boolean;
};

export const TAG_COLORS = ["#e07a5f", "#d4b483", "#81b29a", "#7eb6d6", "#c38d9e", "#b8a1e3", "#e6c35c", "#8fbf9f"] as const;

export type DotPaletteName = "normal" | "gray" | "green" | "sepia";
export type DotDitherName = "off" | "floyd" | "bayer" | "atkinson";
export type DotBias = "tl" | "center" | "br";
export type DotLineColor = "black" | "white" | "custom";

/** Circle used only while building a dot picture. It is not drawn into the file. */
export type DotMarker = {
  id: string;
  name: string;
  /** Center, 0–1 across the source image. */
  u: number;
  v: number;
  /** Radius as a fraction of the shorter side. */
  r: number;
  /** Higher priority wins where circles overlap. */
  priority: number;
  /** 0–100. How hard local edges are pushed. */
  crisp: number;
  /** -100–100. */
  density: number;
  /** -100–100. */
  contrast: number;
  /** 0–100. How strongly dark pixels stay dark. */
  line: number;
  bias: DotBias;
};

/** Saved mosaic for one image. The file bytes are never rewritten. */
export type ImageDot = {
  /**
   * Master display switch. Off hides both filters and keeps the checks.
   * Missing means on only when a saved check was already on, so an untouched picture stays plain.
   */
  show?: boolean;
  on: boolean;
  /** Horizontal cells. Vertical count follows the picture. */
  cols: number;
  /**
   * Opaque colors after reduction. Missing on older records means the current default, 512.
   * Clear cells are not part of this count. The count is kept even when reduction is off.
   */
  colors?: number;
  /**
   * Color reduction. Missing means on. An explicit false stays off.
   * Independent of `on` and of `show`.
   */
  colorOn?: boolean;
  /** Legacy grayscale switch. With a normal palette it means the grayscale palette, and it is not applied again on top of green or sepia. */
  gray?: boolean;
  levelsOn?: boolean;
  /** Posterize steps. Only 2, 4, 8, 16, 32, 64, or 256. Missing means 8 and stays unused until levels are on. */
  levels?: number;
  /** -100–100. Missing means 0. */
  brightness?: number;
  /** Missing or true applies `brightness`. False keeps the number and skips it. */
  brightnessOn?: boolean;
  contrast?: number;
  /** Missing or true applies `contrast`. False keeps the number and skips it. */
  contrastOn?: boolean;
  palette?: DotPaletteName;
  dither?: DotDitherName;
  /** 0–100. Missing means 70. Ignored while dither is off. */
  ditherStrength?: number;
  /** Missing or true applies `ditherStrength`. False keeps the number and skips it. */
  ditherStrengthOn?: boolean;
  /** Bayer matrix size. Missing means 4. */
  bayerSize?: number;
  outline?: boolean;
  outlineWidth?: number;
  outlineColor?: DotLineColor;
  outlineHex?: string;
  samplePos?: DotBias;
  /** 0–100. Missing means 0, which keeps the plain average. */
  sampleWeight?: number;
  /** Missing or true applies `sampleWeight`. False keeps the number and skips it. */
  sampleWeightOn?: boolean;
  density?: number;
  /** Missing or true applies `density`. False keeps the number and skips it. */
  densityOn?: boolean;
  sampleContrast?: number;
  /** Missing or true applies `sampleContrast`. False keeps the number and skips it. */
  sampleContrastOn?: boolean;
  /** Darken pixels already under luminance 110. Missing means 100. 0 leaves them as they are. */
  blackLine?: number;
  /** Missing or true applies `blackLine`. False keeps the number and skips it. */
  blackLineOn?: boolean;
  /**
   * Keep source alpha in the dot output. Missing or true keeps transparency.
   * False makes every alpha above 0 fully opaque and leaves alpha 0 clear.
   * The file and the plate color are not rewritten.
   */
  alphaOn?: boolean;
  markers?: DotMarker[];
};

/** Marker layout for one image. Absent on older records, which start with no markers. */
export type ImagePuru = {
  markers: {
    id: number;
    kind: string;
    u: number;
    v: number;
    radius: number;
    view?: number;
  }[];
};

/** Vector-marker layout for one image. Separate from puru markers. Absent means none were saved. */
export type ImageVectors = {
  /** 2 means バイブ・遅 is the new slow buzz. Missing means an old バイブ・遅 is the kick. */
  vibe?: number;
  markers: {
    id: number;
    kind: string;
    pace?: string;
    u: number;
    v: number;
    radius: number;
    view?: number;
    angle?: number;
  }[];
};

/** Effect-marker layout for one image. Separate from vector markers. Absent means none were saved. */
export type ImageEffects = {
  markers: EffectMarker[];
};

/** Saved animation and voice for one image. Voice is a catalog id, not a playback URL. */
export type ImagePlay = {
  kind: "swayX" | "hitX" | "swayY" | "hitY" | "orbit" | "zoom" | "buzz" | null;
  speed: "slow" | "normal" | "fast" | "rapid" | "ultra";
  reverse: boolean;
  zoom: boolean;
  twist: boolean;
  /** Missing on older favorites.「普通」keeps the clock those favorites were saved with. */
  zoomPace: "slow" | "normal" | "fast";
  twistPace: "slow" | "normal" | "fast";
  tilt: "right" | "left" | null;
  /** True when this favorite also plays the image's vector markers. Missing means off. */
  vector: boolean;
  /** True when this favorite also plays the saved effect markers. Missing means off. */
  effect: boolean;
  /** Splash and later image effects. Empty, or missing on older favorites, means none. */
  effects: EffectMarker[];
  voiceId: string | null;
  rate: 0.5 | 1 | 1.5 | 2;
  volume: number;
  /** Launch boxes for this image. Empty, or missing on older favorites, uses the whole picture. */
  liquid: LiquidRange[];
  /** Holes in the liquid. Empty, or missing on older favorites, hides nothing. */
  liquidHide: LiquidHide[];
};

export const TAG_DRAG = "application/x-komacho-tag";

export type Folder = {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  /** Null for folders at the top. Missing on older records, which stay at the top. */
  parentId: string | null;
  /** True when this folder holds only child folders, not images. */
  isParent: boolean;
  /** Saved outline color for a parent folder. Null for ordinary folders. */
  color: string | null;
};

export const ALL_FOLDERS = "all";

/** Gallery display for one folder. Add fields here when a new per-folder setting appears. */
export type FolderView = {
  columns: number;
  direction: "asc" | "desc";
};

export const DEFAULT_FOLDER_VIEW: FolderView = {
  columns: 4,
  direction: "desc",
};
