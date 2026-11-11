/** Display-only motion for the phone viewer. Gesture code must not read this. */

export type AnimKind = "swayX" | "hitX" | "swayY" | "hitY" | "orbit" | "zoom" | "buzz";
export type AnimSpeed = "slow" | "normal" | "fast" | "rapid" | "ultra";

export type AnimPose = { x: number; y: number; scale: number };

export type AnimTilt = "right" | "left";

/** Zoom and twist each pick one of these. They do not use the base speed menu. */
export type OptionPace = "slow" | "normal" | "fast";

/** Extra layers. They do not replace the base move. */
export type AnimOptions = {
  zoom?: boolean;
  twist?: boolean;
  tilt?: AnimTilt | null;
  zoomPace?: OptionPace;
  twistPace?: OptionPace;
};

export type AnimFrame = { x: number; y: number; scale: number; rotate: number };

export const TWIST_DEG = 15;

type Pace = { time: number; travel: number };

/**
 * Horizontal and vertical sway, and the circle, step up one preset.
 * slow uses the old normal clock, and each faster name takes the clock that used to sit above it.
 * The new ultra is the speed halfway between rapid and the previous ultra. Travel stays put, so only the clock changes.
 * Zoom and buzz are not part of this shift. Ultra hit uses its own contact clock.
 */
const SWAY: Record<AnimSpeed, Pace> = {
  slow: { time: 1, travel: 1 },
  normal: { time: 0.58, travel: 1.05 },
  fast: { time: 0.34, travel: 1.28 },
  rapid: { time: 0.2, travel: 1.55 },
  ultra: { time: 0.08, travel: 1.55 },
};
const HIT: Record<AnimSpeed, Pace> = {
  slow: { time: 1, travel: 1 },
  normal: { time: 0.64, travel: 1.08 },
  fast: { time: 0.36, travel: 1.32 },
  rapid: { time: 0.2, travel: 1.45 },
  // Travel only. The ultra clock is ULTRA_HIT_CONTACT, so the impact stays readable.
  ultra: { time: 0.08, travel: 1.45 },
};
const ORBIT: Record<AnimSpeed, Pace> = {
  slow: { time: 1, travel: 1 },
  normal: { time: 0.48, travel: 1.05 },
  fast: { time: 0.18, travel: 1.22 },
  rapid: { time: 0.075, travel: 1.4 },
  ultra: { time: 0.029032258, travel: 1.4 },
};
const ZOOM: Record<AnimSpeed, Pace> = {
  slow: { time: 1.65, travel: 0.85 },
  normal: { time: 1, travel: 1 },
  fast: { time: 0.55, travel: 1.05 },
  rapid: { time: 0.26, travel: 1.22 },
  ultra: { time: 0.13, travel: 1.38 },
};

const BUZZ: Record<AnimSpeed, { still: number; buzz: number; freq: number; amp: number }> = {
  slow: { still: 1700, buzz: 360, freq: 12, amp: 2.4 },
  normal: { still: 1100, buzz: 280, freq: 18, amp: 3.1 },
  fast: { still: 680, buzz: 210, freq: 22, amp: 3.3 },
  rapid: { still: 320, buzz: 150, freq: 26, amp: 4.2 },
  ultra: { still: 130, buzz: 110, freq: 30, amp: 5.2 },
};

/**
 * Ultra hit only. Milliseconds, not a scaled copy of the slower curve.
 * Pull and slam stay short. The stop and the ring keep enough time to see.
 */
export const ULTRA_HIT_CONTACT = { pull: 72, slam: 44, stop: 84, buzz: 192 } as const;

const ULTRA_HIT_CYCLE =
  ULTRA_HIT_CONTACT.pull + ULTRA_HIT_CONTACT.slam + ULTRA_HIT_CONTACT.stop + ULTRA_HIT_CONTACT.buzz;

function paceOf(kind: AnimKind, speed: AnimSpeed): Pace {
  if (kind === "hitX" || kind === "hitY") return HIT[speed];
  if (kind === "orbit") return ORBIT[speed];
  if (kind === "zoom") return ZOOM[speed];
  return SWAY[speed];
}

/** One loop, in milliseconds. Faster steps are not one shared ratio. */
export function animationCycle(kind: AnimKind, speed: AnimSpeed): number {
  if (kind === "buzz") {
    const buzz = BUZZ[speed];
    return buzz.still + buzz.buzz;
  }
  if ((kind === "hitX" || kind === "hitY") && speed === "ultra") return ULTRA_HIT_CYCLE;
  const pace = paceOf(kind, speed);
  if (kind === "swayX" || kind === "swayY") return 3400 * pace.time;
  if (kind === "hitX" || kind === "hitY") return 2800 * pace.time;
  if (kind === "orbit") return 7600 * pace.time;
  return 5200 * pace.time;
}

export function buzzWindow(speed: AnimSpeed): { still: number; buzz: number } {
  const buzz = BUZZ[speed];
  return { still: buzz.still, buzz: buzz.buzz };
}

/**
 * Starts on the impact wall, pulls to the far side, slams back, then holds.
 * The phase split stays put at every speed except ultra, which has its own contact.
 */
export function hitUnit(phase: number): number {
  const pullEnd = 0.64;
  const slamEnd = 0.9;
  const t = ((phase % 1) + 1) % 1;
  if (t < pullEnd) {
    const u = t / pullEnd;
    const eased = u * u * (3 - 2 * u);
    return 1 - 2 * eased;
  }
  if (t < slamEnd) {
    const u = (t - pullEnd) / (slamEnd - pullEnd);
    return -1 + 2 * u * u * u;
  }
  return 1;
}

/** Around the wall, after the stop. 30Hz with a quarter-turn so a 60fps frame lands on a peak, not a zero. */
function ultraHitRing(intoMs: number): { along: number; across: number } {
  const u = Math.min(1, Math.max(0, intoMs / ULTRA_HIT_CONTACT.buzz));
  const decay = (1 - u) ** 1.5;
  const sec = intoMs / 1000;
  return {
    along: Math.cos(sec * 30 * Math.PI * 2) * 0.2 * decay,
    across: Math.cos(sec * 18 * Math.PI * 2) * 0.08 * decay,
  };
}

/** 1 is the wall, -1 is the cocked side. The ring is a fraction of that travel, centered on the wall. */
function ultraHitUnit(localMs: number): { along: number; across: number } {
  const { pull, slam, stop } = ULTRA_HIT_CONTACT;
  const slamEnd = pull + slam;
  const stopEnd = slamEnd + stop;
  let t = localMs % ULTRA_HIT_CYCLE;
  if (t < 0) t += ULTRA_HIT_CYCLE;
  if (t < pull) {
    const u = t / pull;
    const eased = 1 - (1 - u) * (1 - u);
    return { along: 1 - 2 * eased, across: 0 };
  }
  if (t < slamEnd) {
    const u = (t - pull) / slam;
    return { along: -1 + 2 * u * u * u * u, across: 0 };
  }
  if (t < stopEnd) return { along: 1, across: 0 };
  const ring = ultraHitRing(t - stopEnd);
  return { along: 1 + ring.along, across: ring.across };
}

function phaseOf(elapsedMs: number, cycle: number): number {
  if (cycle <= 0) return 0;
  const t = elapsedMs % cycle;
  return (t < 0 ? t + cycle : t) / cycle;
}

function cover(travel: number, axis: number): number {
  return 1 + (2 * Math.abs(travel)) / Math.max(1, axis) + 0.012;
}

export function animationPose(
  kind: AnimKind,
  speed: AnimSpeed,
  elapsedMs: number,
  frame: { width: number; height: number },
  reverse = false,
): AnimPose {
  const width = Math.max(1, frame.width);
  const height = Math.max(1, frame.height);
  const min = Math.min(width, height);
  const cycle = animationCycle(kind, speed);
  const phase = phaseOf(elapsedMs, cycle);
  const dir = reverse ? -1 : 1;

  if (kind === "swayX" || kind === "swayY") {
    const pace = SWAY[speed];
    const amp = min * 0.042 * pace.travel;
    const travel = Math.sin(phase * Math.PI * 2) * amp * dir;
    if (kind === "swayX") return { x: travel, y: 0, scale: cover(amp, width) };
    return { x: 0, y: travel, scale: cover(amp, height) };
  }

  if (kind === "hitX" || kind === "hitY") {
    const pace = HIT[speed];
    const amp = min * 0.05 * pace.travel;
    if (speed === "ultra") {
      const hit = ultraHitUnit(phase * cycle);
      const along = hit.along * amp * dir;
      const across = hit.across * amp * dir;
      if (kind === "hitX") return { x: along, y: across, scale: cover(amp, width) };
      return { x: across, y: along, scale: cover(amp, height) };
    }
    const travel = hitUnit(phase) * amp * dir;
    if (kind === "hitX") return { x: travel, y: 0, scale: cover(amp, width) };
    return { x: 0, y: travel, scale: cover(amp, height) };
  }

  if (kind === "orbit") {
    const pace = ORBIT[speed];
    const radius = min * 0.032 * pace.travel;
    const angle = dir * phase * Math.PI * 2;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      scale: cover(radius, min),
    };
  }

  if (kind === "zoom") {
    const pace = ZOOM[speed];
    const depth = 0.12 * pace.travel;
    const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    return { x: 0, y: 0, scale: 1 + depth * (reverse ? 1 - wave : wave) };
  }

  const buzz = BUZZ[speed];
  const local = phase * cycle;
  if (local < buzz.still) return { x: 0, y: 0, scale: 1 };
  const into = (local - buzz.still) / 1000;
  const amp = Math.min(buzz.amp, min * 0.02);
  return {
    x: Math.sin(into * buzz.freq * Math.PI * 2) * amp * dir,
    y: Math.sin(into * buzz.freq * 1.37 * Math.PI * 2) * amp * 0.7,
    scale: 1.03,
  };
}

/** Twist's「普通」is the old fixed clock.「遅」is twice as long,「速」is half. The base speed menu does not change it. */
const OPTION_PACE: Record<OptionPace, number> = { slow: 2, normal: 1, fast: 0.5 };

export function twistCycle(pace: OptionPace = "normal"): number {
  return 3200 * SWAY.slow.time * 4 * OPTION_PACE[pace];
}

/** How far the zoom option grows past 1. Larger than the old fast zoom, still a gentle crop. */
const ZOOM_OPTION_DEPTH = 0.28;

/** Zoom's「普通」is the old fixed clock.「遅」and「速」only change that clock, not the depth. */
export function zoomOptionCycle(pace: OptionPace = "normal"): number {
  return animationCycle("zoom", "fast") * 2 * OPTION_PACE[pace];
}

function zoomOptionScale(phase: number, reverse: boolean): number {
  const wave = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  return 1 + ZOOM_OPTION_DEPTH * (reverse ? 1 - wave : wave);
}

export function animPhase(elapsedMs: number, cycle: number, carry = 0): number {
  if (!(cycle > 0)) return 0;
  return ((elapsedMs / cycle + carry) % 1 + 1) % 1;
}

/** Carry that makes `animPhase(elapsed, cycle, carry)` equal `phase` right now. */
export function carryForPhase(elapsedMs: number, cycle: number, phase: number): number {
  if (!(cycle > 0)) return 0;
  return phase - elapsedMs / cycle;
}

/**
 * Screen axes, y downward. Right is 45° clockwise. Left is 45° counter-clockwise.
 * The whole travel vector turns, including a hit's stop and its shudder.
 */
function turnTravel(x: number, y: number, tilt: AnimTilt): { x: number; y: number } {
  const rad = (tilt === "right" ? 1 : -1) * (Math.PI / 4);
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: x * c - y * s, y: x * s + y * c };
}

/**
 * Base move, then a 45° turn of that move, then zoom as a scale and twist as a rotation.
 * Zoom and twist use their own pace. The base speed menu does not change those clocks.
 */
export function animationFrame(
  kind: AnimKind | null,
  speed: AnimSpeed,
  elapsedMs: number,
  frame: { width: number; height: number },
  reverse = false,
  options: AnimOptions = {},
  carry: { base?: number; zoom?: number; twist?: number } = {},
): AnimFrame {
  const base = kind
    ? animationPose(kind, speed, animPhase(elapsedMs, animationCycle(kind, speed), carry.base ?? 0) * animationCycle(kind, speed), frame, reverse)
    : { x: 0, y: 0, scale: 1 };
  let x = base.x;
  let y = base.y;
  const canTilt = kind === "swayX" || kind === "swayY" || kind === "hitX" || kind === "hitY";
  if (canTilt && (options.tilt === "right" || options.tilt === "left")) {
    const turned = turnTravel(x, y, options.tilt);
    x = turned.x;
    y = turned.y;
  }
  let scale = base.scale;
  if (options.zoom) {
    const cycle = zoomOptionCycle(options.zoomPace ?? "normal");
    scale *= zoomOptionScale(animPhase(elapsedMs, cycle, carry.zoom ?? 0), reverse);
  }
  let rotate = 0;
  if (options.twist) {
    const cycle = twistCycle(options.twistPace ?? "normal");
    const phase = animPhase(elapsedMs, cycle, carry.twist ?? 0);
    rotate = Math.sin(phase * Math.PI * 2) * TWIST_DEG * (reverse ? -1 : 1);
  }
  return { x, y, scale, rotate };
}
