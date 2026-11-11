/** Screen-only liquid images. Never written onto the photo. */

export const LIQUID_SOURCE_IDS = [
  "liquid_01",
  "liquid_02",
  "liquid_03",
  "liquid_04",
  "liquid_05",
] as const;

export const LIQUID_ASSET_IDS = LIQUID_SOURCE_IDS;

export type LiquidAssetId = (typeof LIQUID_ASSET_IDS)[number];

/** Width / height of every luma-white sheet. Same pixels as the source JPEGs. */
export const LIQUID_SHEET_ASPECT = 768 / 1376;

/**
 * Average time for the bottom to gain one initial height.
 * The rate waves around this. Same value on PC and phone. Tune here.
 */
export const LIQUID_EXTEND_SECONDS = 6;
/** How fast the stretch speeds up and slows down, in cycles per second. */
export const LIQUID_WAVE_HZ = 0.65;
/** The top edge stays put. The bottom carries the stretch. */
export const LIQUID_TOP_RATIO = 0;
/** Above this fraction, the mesh stays pinned to the top edge. Only a thin lip — a tall sheet would hide a deep hinge below the photo. */
export const LIQUID_HINGE = 0.08;
/** Below this, the tip keeps its shape and only drops. */
export const LIQUID_TIP = 0.86;
/** Full strength until this many seconds after the sheet appears. Tune here. */
export const LIQUID_FADE_DELAY = 5;
/** Then this many seconds to fade to nothing. Tune here. */
export const LIQUID_FADE_SECONDS = 3;

export const LIQUID_FLASH = {
  /** Two short blinks, then one long blink of about a second. */
  ons: [0.12, 0.12, 1],
  gap: 0.08,
  /** Peak of the two short blinks. The last blink ignores this and is solid white. */
  alpha: 0.55,
};

export type LiquidSprite = {
  id: number;
  asset: LiquidAssetId;
  /** Center, as a fraction of the image. */
  u: number;
  v: number;
  /** Size, as a fraction of the image. */
  w: number;
  h: number;
  rotation: number;
  flip: boolean;
  /** Bottom extension divided by the sprite's initial height. Stops at 1. */
  extend: number;
  showAt: number;
};

export type LiquidGroup = {
  id: number;
  sprites: LiquidSprite[];
  /** World time when the flash started. */
  started: number;
  /** World time when the sheet becomes visible. Fade and drip are measured from here. */
  showAt: number;
};

export type LiquidWorld = {
  groups: LiquidGroup[];
  time: number;
  seed: number;
  phone: boolean;
  /** Image width / height. */
  aspect: number;
  seq: number;
  spraying: boolean;
  aimU: number;
  aimV: number;
};

export function liquidGroupCap(phone: boolean): number {
  return phone ? 8 : 12;
}

export function meshRows(phone: boolean): number {
  return phone ? 12 : 16;
}

export function meshColumns(phone: boolean): number {
  return phone ? 18 : 24;
}

export function liquidFreeRatio(groupCount: number, phone: boolean): number {
  const cap = liquidGroupCap(phone);
  if (!(cap > 0)) return 0;
  const room = cap - groupCount;
  if (!(room > 0)) return 0;
  return room / cap;
}

export function emptyLiquid(phone = false): LiquidWorld {
  return {
    groups: [],
    time: 0,
    seed: 1,
    phone,
    aspect: 1,
    seq: 1,
    spraying: false,
    aimU: 0.5,
    aimV: 0.5,
  };
}

export function clearLiquid(world: LiquidWorld) {
  world.groups.length = 0;
  world.spraying = false;
}

export function liquidFlashDuration(flash = LIQUID_FLASH): number {
  if (flash.ons.length === 0) return 0;
  return flash.ons.reduce((sum, on) => sum + on, 0) + Math.max(0, flash.ons.length - 1) * flash.gap;
}

/** Start of the last blink. The sheet is shown during that blink. */
export function liquidShowDelay(flash = LIQUID_FLASH): number {
  if (flash.ons.length === 0) return 0;
  let time = 0;
  for (let i = 0; i < flash.ons.length - 1; i++) time += flash.ons[i] + flash.gap;
  return time;
}

/** 0 outside a pulse. Short blinks rise and fall. The last blink is solid white the whole time. */
export function liquidFlashAlpha(elapsed: number, flash = LIQUID_FLASH): number {
  if (!(elapsed >= 0) || flash.ons.length === 0) return 0;
  let time = 0;
  for (let i = 0; i < flash.ons.length; i++) {
    const on = flash.ons[i];
    if (!(on > 0)) continue;
    if (elapsed < time + on) {
      if (i === flash.ons.length - 1) return 1;
      const local = elapsed - time;
      return flash.alpha * Math.sin((local / on) * Math.PI);
    }
    time += on;
    if (i < flash.ons.length - 1) {
      if (elapsed < time + Math.max(0, flash.gap)) return 0;
      time += Math.max(0, flash.gap);
    }
  }
  return 0;
}

export function liquidOverlayFlash(world: LiquidWorld, flash = LIQUID_FLASH): number {
  let max = 0;
  for (const group of world.groups) {
    const alpha = liquidFlashAlpha(world.time - group.started, flash);
    if (alpha > max) max = alpha;
  }
  return max;
}

export function liquidBusy(world: LiquidWorld): boolean {
  return world.groups.length > 0;
}

export function liquidLife(delay = LIQUID_FADE_DELAY, fade = LIQUID_FADE_SECONDS): number {
  return Math.max(0, delay) + Math.max(0, fade);
}

/**
 * 1 until {@link LIQUID_FADE_DELAY} after the sheet appears,
 * then a smooth fall to 0 across {@link LIQUID_FADE_SECONDS}.
 * `displayAge` is seconds since the sheet became visible.
 */
export function liquidTimeFade(displayAge: number, delay = LIQUID_FADE_DELAY, fade = LIQUID_FADE_SECONDS): number {
  if (!(displayAge > 0)) return 1;
  if (!(fade > 0)) return displayAge >= delay ? 0 : 1;
  if (displayAge <= delay) return 1;
  const u = (displayAge - delay) / fade;
  if (u >= 1) return 0;
  return Math.cos(u * Math.PI * 0.5);
}

/**
 * Separate from the clock fade. The attachment stays dense.
 * Strands lose opacity toward the tip, in a smooth ramp.
 */
export function liquidTipAlpha(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  const start = 0.2;
  if (u <= start) return 1;
  const x = (u - start) / (1 - start);
  const s = x * x * (3 - 2 * x);
  return 1 - s * 0.88;
}

/** Extension speed at `elapsed` seconds after the sheet appears. Averages to 1 / {@link LIQUID_EXTEND_SECONDS}. */
export function liquidExtendRate(elapsed: number, seconds = LIQUID_EXTEND_SECONDS, hz = LIQUID_WAVE_HZ): number {
  const base = seconds > 0 ? 1 / seconds : 0;
  const wave = 1 + 0.38 * Math.sin(Math.max(0, elapsed) * hz * Math.PI * 2);
  return base * wave;
}

export function meshEdges(extend: number, height: number) {
  const stretch = strandStretch(extend, 1);
  const extra = stretch * height;
  return {
    extend: Math.min(1, Math.max(0, extend)),
    extra,
    top: 0,
    bottom: height + extra,
  };
}

/**
 * How far one strand has stretched, as a fraction of the initial height.
 * `extend` is the shared clock (0 to 1). `gain` is this strand's own cap, at most 1.
 * The result only increases as `extend` increases, and it never passes one height.
 */
export function strandStretch(extend: number, gain: number): number {
  const g = Math.min(1, Math.max(0, gain));
  const u = Math.min(1, Math.max(0, extend));
  if (!(g > 0) || !(u > 0)) return 0;
  const exp = 0.68 + 0.7 * (1 - g);
  return g * Math.pow(u, exp);
}

/** Stable 0.42–1 mix so neighboring strands lengthen by different amounts. */
export function strandGain(column: number, columns: number, salt: number): number {
  const cols = Math.max(1, columns);
  const n = Math.abs(Math.sin((column + 0.5) * 12.9898 + (salt % 97) * 0.618 + cols * 0.013));
  const wave = 0.5 + 0.5 * Math.sin(((column + 0.5) / cols) * Math.PI * 3 + (salt % 13));
  return 0.42 + 0.58 * (0.62 * n + 0.38 * wave);
}

/**
 * Local Y of source fraction `t` (0 = top of the file, 1 = bottom).
 * The top lip stays put. The middle stretches. The tip drops without squashing.
 * `stretch` is already the strand's own extension, capped at 1.
 */
export function strandY(t: number, height: number, stretch: number): number {
  const clampedT = Math.min(1, Math.max(0, t));
  const extra = Math.min(1, Math.max(0, stretch)) * height;
  const bottom = height + extra;
  if (clampedT <= LIQUID_HINGE) return clampedT * height;
  if (clampedT >= LIQUID_TIP) return bottom - (1 - clampedT) * height;
  const y0 = LIQUID_HINGE * height;
  const mid0 = (LIQUID_TIP - LIQUID_HINGE) * height;
  const u = (clampedT - LIQUID_HINGE) / (LIQUID_TIP - LIQUID_HINGE);
  return y0 + u * mid0 + extra * Math.pow(u, 0.6);
}

/**
 * Longest strand (gain 1). Source top stays at local Y 0.
 * There is no vertical flip: increasing `t` moves down the canvas.
 */
export function meshY(t: number, height: number, extend: number): number {
  return strandY(t, height, strandStretch(extend, 1));
}

function rand(world: LiquidWorld): number {
  world.seed = (Math.imul(world.seed, 1664525) + 1013904223) >>> 0;
  return world.seed / 4294967296;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function pickAsset(world: LiquidWorld): LiquidAssetId {
  const index = Math.min(LIQUID_SOURCE_IDS.length - 1, Math.floor(rand(world) * LIQUID_SOURCE_IDS.length));
  return LIQUID_SOURCE_IDS[index] ?? LIQUID_SOURCE_IDS[0];
}

function makeSheet(world: LiquidWorld, showAt: number): LiquidSprite {
  const aspect = world.aspect > 0.05 ? world.aspect : 1;
  const h = aspect / LIQUID_SHEET_ASPECT;
  return {
    id: world.seq++,
    asset: pickAsset(world),
    u: 0.5,
    v: h / 2,
    w: 1,
    h,
    rotation: 0,
    flip: false,
    extend: 0,
    showAt,
  };
}

/**
 * One full-width sheet, top edge on the image top.
 * The gesture position is remembered and does not move the sheet.
 * Null when the layer cap is full. PC and phone share this placement.
 */
export function placeLiquid(world: LiquidWorld, u: number, v: number): LiquidGroup | null {
  if (world.groups.length >= liquidGroupCap(world.phone)) return null;
  world.aimU = clamp01(u);
  world.aimV = clamp01(v);
  const started = world.time;
  const showAt = started + liquidShowDelay();
  const group: LiquidGroup = {
    id: world.seq++,
    sprites: [makeSheet(world, showAt)],
    started,
    showAt,
  };
  world.groups.push(group);
  return group;
}

export function stepLiquid(world: LiquidWorld, dt: number) {
  const step = Math.min(0.05, Math.max(0, dt));
  if (!(step > 0)) return;
  world.time += step;
  const life = liquidLife();
  const alive: LiquidGroup[] = [];
  for (const group of world.groups) {
    const displayed = world.time - group.showAt;
    if (displayed >= life) continue;
    for (const sprite of group.sprites) {
      if (world.time < sprite.showAt || sprite.extend >= 1) continue;
      const rate = liquidExtendRate(world.time - sprite.showAt);
      sprite.extend = Math.min(1, sprite.extend + step * rate);
    }
    alive.push(group);
  }
  if (alive.length !== world.groups.length) world.groups = alive;
}

/**
 * Stick deflection, length clamped to 1, mapped so a full push lands on the image border.
 * Center is the middle of the photo. A corner of the circle reaches a corner of the photo.
 */
export function stickAim(nx: number, ny: number): { u: number; v: number } {
  const mag = Math.hypot(nx, ny);
  if (!(mag > 1e-4)) return { u: 0.5, v: 0.5 };
  const scale = Math.min(1, mag);
  const dx = nx / mag;
  const dy = ny / mag;
  const tx = Math.abs(dx) < 1e-6 ? Infinity : 0.5 / Math.abs(dx);
  const ty = Math.abs(dy) < 1e-6 ? Infinity : 0.5 / Math.abs(dy);
  const edge = Math.min(tx, ty);
  return {
    u: clamp01(0.5 + dx * edge * scale),
    v: clamp01(0.5 + dy * edge * scale),
  };
}

/** Knob stays inside the circle. Past the rim, direction is kept and the reach stays at the rim. */
export function stickKnob(dx: number, dy: number, radius: number): { x: number; y: number } & { nx: number; ny: number } {
  if (!(radius > 0)) return { x: 0, y: 0, nx: 0, ny: 0 };
  const mag = Math.hypot(dx, dy);
  const limit = mag > radius ? radius / mag : 1;
  const x = dx * limit;
  const y = dy * limit;
  return { x, y, nx: x / radius, ny: y / radius };
}
