/**
 * One place for the phone tilt and shake sensors.
 * Permission is requested in the same user gesture, and each sensor
 * has a single window listener shared by the gallery and the lightbox.
 */

import { motionSupport } from "./device-shake.ts";
import { sensorSupport } from "./device-tilt.ts";

export type SensorPermit = "unknown" | "granted" | "denied" | "unsupported" | "error";

export type OrientationSample = { beta: number | null; gamma: number | null };
export type MotionSample = {
  acceleration: { x: number | null; y: number | null; z: number | null } | null;
  accelerationIncludingGravity: { x: number | null; y: number | null; z: number | null } | null;
};

type Scope = {
  isSecureContext?: boolean;
  DeviceOrientationEvent?: unknown;
  DeviceMotionEvent?: unknown;
};

type PermissionCtor = { requestPermission?: () => Promise<string> };

function permissionCtor(value: unknown): PermissionCtor | undefined {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return undefined;
  return value as PermissionCtor;
}

type Target = {
  addEventListener: (type: string, listener: (event: Event) => void) => void;
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
};

let wantTilt = false;
let wantShake = false;
const wantWatchers = new Set<() => void>();

function publishWant() {
  for (const watch of wantWatchers) watch();
}

export function wantedSensors(): { tilt: boolean; shake: boolean } {
  return { tilt: wantTilt, shake: wantShake };
}

export function setWantedSensors(next: { tilt?: boolean; shake?: boolean }) {
  let changed = false;
  if (next.tilt !== undefined && next.tilt !== wantTilt) {
    wantTilt = next.tilt;
    changed = true;
  }
  if (next.shake !== undefined && next.shake !== wantShake) {
    wantShake = next.shake;
    changed = true;
  }
  if (changed) publishWant();
}

export function watchWantedSensors(listener: () => void): () => void {
  wantWatchers.add(listener);
  return () => wantWatchers.delete(listener);
}
let orientationPermit: SensorPermit = "unknown";
let motionPermit: SensorPermit = "unknown";
const tiltSubs = new Set<(sample: OrientationSample) => void>();
const shakeSubs = new Set<(sample: MotionSample) => void>();
const permitWatchers = new Set<() => void>();
let orientationListener: ((event: Event) => void) | null = null;
let motionListener: ((event: Event) => void) | null = null;
let orientationPulse = 0;
let motionPulse = 0;
let target: Target | null = typeof window === "undefined" ? null : window;

/** A stream older than this is treated as stopped. */
export const SENSOR_FRESH_MS = 1600;

function publishPermits() {
  for (const watch of permitWatchers) watch();
}

export function bindSensorTarget(next: Target | null) {
  if (orientationListener && target) target.removeEventListener("deviceorientation", orientationListener);
  if (motionListener && target) target.removeEventListener("devicemotion", motionListener);
  orientationListener = null;
  motionListener = null;
  target = next;
  ensureListeners();
}

export function resetSensorHub() {
  if (orientationListener && target) target.removeEventListener("deviceorientation", orientationListener);
  if (motionListener && target) target.removeEventListener("devicemotion", motionListener);
  orientationListener = null;
  motionListener = null;
  orientationPulse = 0;
  motionPulse = 0;
  orientationPermit = "unknown";
  motionPermit = "unknown";
  tiltSubs.clear();
  shakeSubs.clear();
  permitWatchers.clear();
  wantWatchers.clear();
  wantTilt = false;
  wantShake = false;
}

export function sensorPermits(): { orientation: SensorPermit; motion: SensorPermit } {
  return { orientation: orientationPermit, motion: motionPermit };
}

export function sensorListenerCounts(): { orientation: number; motion: number } {
  return { orientation: orientationListener ? 1 : 0, motion: motionListener ? 1 : 0 };
}

export function sensorWatchHot(
  now: number,
  wanted: { tilt: boolean; shake: boolean },
  permits: { orientation: SensorPermit; motion: SensorPermit },
): boolean {
  const tiltOn = wanted.tilt && permits.orientation === "granted";
  const shakeOn = wanted.shake && permits.motion === "granted";
  if (!tiltOn && !shakeOn) return false;
  if (!Number.isFinite(now)) return false;
  if (tiltOn && (orientationPulse <= 0 || now - orientationPulse > SENSOR_FRESH_MS)) return false;
  if (shakeOn && (motionPulse <= 0 || now - motionPulse > SENSOR_FRESH_MS)) return false;
  return true;
}

export function watchSensorPermits(listener: () => void): () => void {
  permitWatchers.add(listener);
  return () => permitWatchers.delete(listener);
}

function settle(kind: "orientation" | "motion", permit: SensorPermit): SensorPermit {
  if (kind === "orientation") orientationPermit = permit;
  else motionPermit = permit;
  publishPermits();
  ensureListeners();
  return permit;
}

function askOne(kind: "orientation" | "motion", support: "ok" | "insecure" | "missing", ctor: PermissionCtor | undefined): Promise<SensorPermit> {
  const current = kind === "orientation" ? orientationPermit : motionPermit;
  if (current === "granted") return Promise.resolve("granted");
  if (support !== "ok") return Promise.resolve(settle(kind, "unsupported"));
  if (!ctor || typeof ctor.requestPermission !== "function") return Promise.resolve(settle(kind, "granted"));
  let pending: Promise<string>;
  try {
    pending = ctor.requestPermission();
  } catch {
    return Promise.resolve(settle(kind, "error"));
  }
  return pending.then(
    (result) => settle(kind, result === "granted" ? "granted" : "denied"),
    () => settle(kind, "error"),
  );
}

export function askOrientation(scope: Scope | null | undefined): Promise<SensorPermit> {
  return askOne("orientation", sensorSupport(scope), permissionCtor(scope?.DeviceOrientationEvent));
}

export function askMotion(scope: Scope | null | undefined): Promise<SensorPermit> {
  return askOne("motion", motionSupport(scope), permissionCtor(scope?.DeviceMotionEvent));
}

/**
 * Start both permission prompts before either result is awaited.
 * A granted sensor is not asked again.
 */
export function beginPermissionAsk(scope: Scope | null | undefined): { orientation: Promise<SensorPermit>; motion: Promise<SensorPermit> } {
  const orientation = askOrientation(scope);
  const motion = askMotion(scope);
  return { orientation, motion };
}

export function onOrientation(listener: (sample: OrientationSample) => void): () => void {
  tiltSubs.add(listener);
  ensureListeners();
  return () => {
    tiltSubs.delete(listener);
    ensureListeners();
  };
}

export function onMotion(listener: (sample: MotionSample) => void): () => void {
  shakeSubs.add(listener);
  ensureListeners();
  return () => {
    shakeSubs.delete(listener);
    ensureListeners();
  };
}

function ensureListeners() {
  if (!target) return;
  if (orientationPermit === "granted" && tiltSubs.size > 0 && !orientationListener) {
    orientationListener = (event) => {
      orientationPulse = performance.now();
      const reading = event as DeviceOrientationEvent;
      const sample = { beta: reading.beta, gamma: reading.gamma };
      for (const sub of tiltSubs) sub(sample);
    };
    target.addEventListener("deviceorientation", orientationListener);
  } else if ((orientationPermit !== "granted" || tiltSubs.size === 0) && orientationListener) {
    target.removeEventListener("deviceorientation", orientationListener);
    orientationListener = null;
    orientationPulse = 0;
  }
  if (motionPermit === "granted" && shakeSubs.size > 0 && !motionListener) {
    motionListener = (event) => {
      motionPulse = performance.now();
      const reading = event as DeviceMotionEvent;
      const sample = {
        acceleration: reading.acceleration,
        accelerationIncludingGravity: reading.accelerationIncludingGravity,
      };
      for (const sub of shakeSubs) sub(sample);
    };
    target.addEventListener("devicemotion", motionListener);
  } else if ((motionPermit !== "granted" || shakeSubs.size === 0) && motionListener) {
    target.removeEventListener("devicemotion", motionListener);
    motionListener = null;
    motionPulse = 0;
  }
}

export function tiltButtonText(input: { orientation: SensorPermit; motion: SensorPermit; tilt: boolean; shake: boolean }): string {
  const { orientation, motion, tilt, shake } = input;
  if (tilt && shake) return "両方動作中";
  if (tilt) return "傾き動作中";
  if (shake) return "シェイク動作中";
  const granted = orientation === "granted" || motion === "granted";
  const otherBlocked = (permit: SensorPermit) => permit === "denied" || permit === "unsupported" || permit === "error";
  if (granted && (otherBlocked(orientation) || otherBlocked(motion))) return "一部不可";
  if (granted) return "停止中";
  if (orientation === "unknown" || motion === "unknown") return "未許可";
  if (orientation === "error" || motion === "error") return "エラー";
  if (orientation === "denied" || motion === "denied") return "拒否";
  return "非対応";
}
