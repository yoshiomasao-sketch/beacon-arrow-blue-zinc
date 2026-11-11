import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Droplet, Eye, EyeOff, Heart, Pencil, Play, Star, Volume2, VolumeX, Waves } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ImageInk } from "@/components/portfolio/ink-layer";
import { LiquidLayer, type LiquidHandle } from "@/components/portfolio/liquid-layer";
import { PuruMesh } from "@/components/portfolio/puru-mesh";
import { VectorField } from "@/components/portfolio/vector-field";
import { Button } from "@/components/ui/button";
import { readPixels } from "@/lib/portfolio/db";
import { cachedOriginal, beginOwnFileDrag, endOwnFileDrag, hideNativeDragImage, offerOriginal, writeOriginalDrag } from "@/lib/portfolio/export-file";
import {
  DOUBLE_TAP_MS,
  DRAG_REST,
  IDENTITY_ZOOM,
  PINCH_MIN,
  SWIPE_ANIM_MS,
  SWIPE_MIN,
  ZOOM_ANIM_MS,
  freshGesture,
  gestureDown,
  gestureMove,
  gestureUp,
  infoOpenForItem,
  infoSheetDismiss,
  infoSheetStep,
  incomingX,
  incomingSlideVisible,
  isZoomed,
  lightboxGestureAction,
  panEdges,
  parkedX,
  pinchRelease,
  scrimForDrag,
  scrimForPinch,
  scrubDrag,
  type Drag,
  type GestureResult,
  type Zoom,
} from "@/lib/portfolio/lightbox-zoom";
import { RECOIL_MS, TILT_RETURN_MS, TILT_REST, recoilKeyframes, sheenFromTilt, tiltAtRecoil, tiltFromDrag, tiltFromMatrix, tiltVelocity, type Tilt, type TiltVelocity } from "@/lib/portfolio/lightbox-tilt";
import { SENSOR_MIN_INTERVAL_MS, SENSOR_REST, poseFromReading, sensorSupport, sensorWriteAllowed, smoothTilt, tiltFromPose, type Pose, type SensorTilt } from "@/lib/portfolio/device-tilt";
import { applyStillTilt, freshStillWatch } from "@/lib/portfolio/sensor-still";
import { onMotion, onOrientation, askMotion, askOrientation, sensorPermits, setWantedSensors, wantedSensors, watchWantedSensors } from "@/lib/portfolio/sensor-hub";
import { SENSOR_RECOIL_MS, freshSensorRecoilWatch, muteSensorRecoil, observeSensorReturn, sensorRecoilAngle, sensorRecoilOffset, sensorRecoilOffsets, sensorReturnReversed, type SensorRecoilFrame, type SensorRecoilWatch } from "@/lib/portfolio/sensor-recoil";
import { SHAKE_MIN_INTERVAL_MS, SHAKE_REST, SHAKE_SAMPLE, considerShake, decayShake, impulseFromPower, motionSupport, readAccel, shakePaintAllowed, shakePower, type ShakeSample } from "@/lib/portfolio/device-shake";
import { phoneSheen } from "@/lib/portfolio/phone-sheen";
import { THUMB_ZOOM_EASE, THUMB_ZOOM_PHONE_MS } from "@/lib/portfolio/thumb-zoom";
import { THUMB_REST, thumbFollow, thumbTiltFromPointer, thumbUnit, type ThumbTilt } from "@/lib/portfolio/thumb-tilt";
import { rubberDragTilt, rubberOffset, rubberRelease, rubberResting, rubberStep, type RubberState } from "@/lib/portfolio/pc-rubber";
import type { ImageMeta, Tag } from "@/lib/portfolio/types";
import { setInkVisible, saveImagePlay, saveImagePuru, saveImageVectors, usePortfolio } from "@/lib/portfolio/store";
import { animationCycle, animationFrame, animPhase, carryForPhase, twistCycle, zoomOptionCycle, type AnimKind, type AnimSpeed, type AnimTilt, type OptionPace } from "@/lib/portfolio/image-animation";
import { stickAim, stickKnob } from "@/lib/portfolio/liquid";
import { VOICE_TRACKS } from "@/lib/portfolio/voice-catalog";
import { normalizeImagePlay } from "@/lib/portfolio/image-play";
import { applyVoiceRate, volumeToGain, VOICE_RATES, voiceRateLabel, type VoiceRate } from "@/lib/portfolio/voice-library";
import {
  PURU_KINDS,
  PURU_RADIUS,
  PURU_STILL,
  PURU_DRAG_PX,
  clampUnit,
  clampView,
  enqueueHit,
  imagePoint,
  imagePointFromPose,
  markerView,
  normalizePuruMarkers,
  nextPuruId,
  pickMarker,
  pinchRadius,
  pointerIsClick,
  puruEditHit,
  puruHaloBackground,
  puruKindFace,
  puruReach,
  viewAtRim,
  PURU_VIEW_REST,
  type ImagePose,
  type PuruHit,
  type PuruKind,
  type PuruMarker,
  type PuruSample,
  type PuruView,
} from "@/lib/portfolio/purupuru";
import {
  nextVectorId,
  normalizeVectorMarkers,
  puruDeformWeight,
  puruListEntries,
  retargetVector,
  VECTOR_KINDS,
  VECTOR_PACES,
  vectorHalo,
  vectorKindFace,
  vectorListEntries,
  vectorShownAfterStop,
  type VectorKind,
  type VectorMarker,
  type VectorPace,
} from "@/lib/portfolio/vector-marker";

type Frame = { left: number; top: number; width: number; height: number };

function containedFrame(availW: number, availH: number, imageW: number, imageH: number, insetX: number): Frame | null {
  const widthBudget = availW - insetX * 2;
  if (widthBudget <= 0 || availH <= 0 || imageW <= 0 || imageH <= 0) return null;
  const scale = Math.min(widthBudget / imageW, availH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return {
    left: insetX + (widthBudget - width) / 2,
    top: (availH - height) / 2,
    width,
    height,
  };
}

function mediaStyle(
  frame: Frame,
  zoom: Zoom,
  phone: boolean,
  animateZoom: boolean,
  drag: Drag,
  animateDrag: boolean,
  opacity = 1,
): { left: number; top: number; width: number; height: number; transform?: string; transformOrigin?: string; transition?: string; opacity?: number } {
  const style: { left: number; top: number; width: number; height: number; transform?: string; transformOrigin?: string; transition?: string; opacity?: number } = {
    left: frame.left,
    top: frame.top,
    width: frame.width,
    height: frame.height,
  };
  if (opacity < 0.999) style.opacity = opacity;
  if (phone) {
    style.transform = `translate(${zoom.x + drag.x}px, ${zoom.y + drag.y}px) scale(${zoom.scale})`;
    style.transformOrigin = "center center";
    if (animateDrag) style.transition = `transform ${SWIPE_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    else if (animateZoom) style.transition = `transform ${ZOOM_ANIM_MS}ms ease-out`;
  }
  return style;
}

function MemoLine({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const shift = node.scrollWidth - (node.parentElement?.clientWidth ?? 0);
    setOverflow(shift > 4 ? shift : 0);
  }, [text]);

  if (!text) return null;
  const scrolling = overflow > 0;
  const duration = scrolling ? overflow / 28 / 0.7 : 0;
  return (
    <p className="memo-line-view">
      <span
        ref={ref}
        className={scrolling ? "memo-line is-scrolling" : "memo-line"}
        style={
          scrolling
            ? { ["--marquee-shift" as string]: `${overflow}px`, ["--marquee-duration" as string]: `${duration}s` }
            : undefined
        }
      >
        {text}
      </span>
    </p>
  );
}

export function Lightbox({
  item,
  index,
  total,
  prev = null,
  next = null,
  onClose,
  onStep,
  onToggleFavorite,
  tags = [],
  launchInk = null,
  contained = false,
  container = null,
}: {
  item: ImageMeta | null;
  index: number;
  total: number;
  prev?: ImageMeta | null;
  next?: ImageMeta | null;
  onClose: () => void;
  onStep: (delta: number) => void;
  onToggleFavorite: (id: string) => void;
  tags?: Tag[];
  launchInk?: { current: boolean } | null;
  contained?: boolean;
  container?: HTMLElement | null;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [urlTick, setUrlTick] = useState(0);
  const [failed, setFailed] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 });
  const [hot, setHot] = useState<"prev" | "next" | null>(null);
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches);
  const [scrimIn, setScrimIn] = useState(1);
  const [scrimArm, setScrimArm] = useState(false);
  const scrimOpened = useRef(false);
  useLayoutEffect(() => {
    if (!phone || !item) {
      scrimOpened.current = false;
      setScrimIn(1);
      setScrimArm(false);
      return;
    }
    if (scrimOpened.current) return;
    scrimOpened.current = true;
    if (!document.body.classList.contains("is-shot-zoom")) return;
    setScrimIn(0);
    setScrimArm(true);
    let second = 0;
    let third = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        third = window.requestAnimationFrame(() => setScrimIn(1));
      });
    });
    const timer = window.setTimeout(() => setScrimArm(false), THUMB_ZOOM_PHONE_MS + 40);
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
      window.cancelAnimationFrame(third);
      window.clearTimeout(timer);
    };
  }, [phone, item]);
  const [animKind, setAnimKind] = useState<AnimKind | null>(null);
  const [animSpeed, setAnimSpeed] = useState<AnimSpeed>("normal");
  const [animReverse, setAnimReverse] = useState(false);
  const [animZoom, setAnimZoom] = useState(false);
  const [animTwist, setAnimTwist] = useState(false);
  const [animZoomPace, setAnimZoomPace] = useState<OptionPace>("normal");
  const [animTwistPace, setAnimTwistPace] = useState<OptionPace>("normal");
  const [animTilt, setAnimTilt] = useState<AnimTilt | null>(null);
  const [animMenu, setAnimMenu] = useState(false);
  const [animHold, setAnimHold] = useState(false);
  const [phonePlay, setPhonePlay] = useState(false);
  const [sensorMenu, setSensorMenu] = useState(false);
  const [sensorStatus, setSensorStatus] = useState<"idle" | "on" | "denied" | "unavailable" | "insecure">("idle");
  const [sensorNote, setSensorNote] = useState("停止中");
  const [shakeMenu, setShakeMenu] = useState(false);
  const [shakeStatus, setShakeStatus] = useState<"idle" | "on" | "denied" | "unavailable" | "insecure">("idle");
  const [shakeNote, setShakeNote] = useState("オフ");
  const animClock = useRef({
    origin: 0,
    frozen: null as number | null,
    running: false,
    carry: { base: 0, zoom: 0, twist: 0 },
  });
  const animKindRef = useRef<AnimKind | null>(null);
  const animSpeedRef = useRef<AnimSpeed>("normal");
  const animReverseRef = useRef(false);
  const animZoomRef = useRef(false);
  const animTwistRef = useRef(false);
  const animZoomPaceRef = useRef<OptionPace>("normal");
  const animTwistPaceRef = useRef<OptionPace>("normal");
  const animTiltRef = useRef<AnimTilt | null>(null);
  animKindRef.current = animKind;
  animSpeedRef.current = animSpeed;
  animReverseRef.current = animReverse;
  animZoomRef.current = animZoom;
  animTwistRef.current = animTwist;
  animZoomPaceRef.current = animZoomPace;
  animTwistPaceRef.current = animTwistPace;
  animTiltRef.current = animTilt;
  const sensorOpenRef = useRef(false);
  sensorOpenRef.current = Boolean(item) && phone;
  const animLive = !animHold && (animKind !== null || animZoom || animTwist);
  const [voiceMenu, setVoiceMenu] = useState(false);
  const [voiceRateOpen, setVoiceRateOpen] = useState(false);
  const [voiceRate, setVoiceRate] = useState<VoiceRate>(1);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [volume, setVolume] = useState(25);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceIdRef = useRef<string | null>(null);
  const voiceRateRef = useRef<VoiceRate>(1);
  const volumeRef = useRef(25);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const voiceBoundRef = useRef<HTMLAudioElement | null>(null);
  voiceIdRef.current = voiceId;
  voiceRateRef.current = voiceRate;
  const [puruEdit, setPuruEdit] = useState(false);
  const [puruMarkers, setPuruMarkers] = useState<PuruMarker[]>([]);
  const [puruSelected, setPuruSelected] = useState<number | null>(null);
  const [puruDrawn, setPuruDrawn] = useState(false);
  const puruMarkersRef = useRef<PuruMarker[]>([]);
  const puruDriveRef = useRef<PuruSample>({ x: 0, y: 0, scale: 1, t: 0 });
  const puruViewRef = useRef<PuruView>({ ...PURU_VIEW_REST });
  const puruHitsRef = useRef<PuruHit[]>([]);
  const [pokeOn, setPokeOn] = useState(false);
  const [meshReady, setMeshReady] = useState(false);
  const grabRef = useRef({ u: 0.5, v: 0.5 });
  const puruEditRef = useRef(false);
  const [vectorEdit, setVectorEdit] = useState(false);
  const [vectorPlay, setVectorPlay] = useState(false);
  const [vectorShown, setVectorShown] = useState(false);
  const [gestureOn, setGestureOn] = useState(false);
  const [vectorMarkers, setVectorMarkers] = useState<VectorMarker[]>(() => (normalizeVectorMarkers(item?.vectors) ?? []).map((marker) => ({ ...marker })));
  const [vectorSelected, setVectorSelected] = useState<number | null>(null);
  const [vectorArmed, setVectorArmed] = useState<{ kind: VectorKind; pace: VectorPace } | null>(null);
  const [vectorNote, setVectorNote] = useState("");
  const vectorEditRef = useRef(false);
  const vectorPlayRef = useRef(false);
  const vectorHoldRef = useRef(false);
  const vectorRecallRef = useRef(false);
  const vectorOriginRef = useRef(0);
  const vectorDriveRef = useRef<{ playing: boolean; origin: number; markers: VectorMarker[] }>({ playing: false, origin: 0, markers: [] });
  const vectorGhostRef = useRef<{ kind: VectorKind; pace: VectorPace; id: number; x: number; y: number } | null>(null);
  const [vectorGhost, setVectorGhost] = useState<{ kind: VectorKind; pace: VectorPace; x: number; y: number; inside: boolean; size: number } | null>(null);
  const vectorMarkersRef = useRef<VectorMarker[]>(vectorMarkers);
  const vectorSavedRef = useRef(JSON.stringify(normalizeVectorMarkers(item?.vectors) ?? []));
  const puruSelectedRef = useRef<number | null>(null);
  const puruPointers = useRef(new Map<number, { x: number; y: number }>());
  const puruPinch = useRef<{ dist: number; radius: number } | null>(null);
  const puruMove = useRef<{ id: number; markerId: number; sx: number; sy: number; du: number; dv: number } | null>(null);
  const puruMouse = useRef<
    | { mode: "move"; pointerId: number; markerId: number; du: number; dv: number; sx: number; sy: number }
    | { mode: "resize"; pointerId: number; markerId: number }
    | null
  >(null);
  const puruGhostRef = useRef<{ kind: PuruKind; id: number; x: number; y: number } | null>(null);
  const [puruGhost, setPuruGhost] = useState<{ kind: PuruKind; x: number; y: number; inside: boolean; size: number } | null>(null);
  const [puruNote, setPuruNote] = useState("");
  const [playNote, setPlayNote] = useState("");
  const [pcTools, setPcTools] = useState(false);
  const pcToolsRef = useRef(false);
  pcToolsRef.current = pcTools;
  const [liquidMode, setLiquidMode] = useState(false);
  const [liquidFree, setLiquidFree] = useState(1);
  const liquidModeRef = useRef(false);
  const liquidRef = useRef<LiquidHandle>(null);
  const stickRef = useRef<{ id: number; cx: number; cy: number; r: number } | null>(null);
  const stickKnobRef = useRef<HTMLSpanElement>(null);
  const [puruItemId, setPuruItemId] = useState(item?.id ?? null);
  const shownIdRef = useRef(item?.id ?? null);
  const itemRef = useRef(item);
  itemRef.current = item;
  if ((item?.id ?? null) !== puruItemId) {
    const leaving = puruItemId;
    const leavingMarkers = vectorMarkersRef.current.map((marker) => ({ ...marker }));
    const leavingKey = JSON.stringify(leavingMarkers);
    if (leaving && leavingKey !== vectorSavedRef.current) {
      vectorSavedRef.current = leavingKey;
      void saveImageVectors(leaving, leavingMarkers).then((ok) => {
        if (!ok && vectorSavedRef.current === leavingKey) vectorSavedRef.current = "";
      });
    }
    const loaded = (normalizeVectorMarkers(item?.vectors) ?? []).map((marker) => ({ ...marker }));
    vectorSavedRef.current = JSON.stringify(loaded);
    vectorMarkersRef.current = loaded;
    const nextId = item?.id ?? null;
    setPuruItemId(nextId);
    setPuruMarkers((normalizePuruMarkers(item?.puru) ?? []).map((marker) => ({ ...marker })));
    setPuruSelected(null);
    setPuruEdit(false);
    setPuruDrawn(false);
    setPuruNote("");
    setVectorMarkers(loaded);
    setVectorSelected(null);
    setVectorArmed(null);
    setVectorEdit(false);
    setVectorPlay(false);
    setVectorShown(false);
    setVectorNote("");
    vectorEditRef.current = false;
    vectorPlayRef.current = false;
    vectorHoldRef.current = false;
    vectorRecallRef.current = false;
    vectorOriginRef.current = 0;
    liquidRef.current?.clear();
    if (item && (item.animated || !item.mime.startsWith("image/"))) {
      liquidModeRef.current = false;
      setLiquidMode(false);
    }
    puruMouse.current = null;
    puruDriveRef.current = { x: 0, y: 0, scale: 1, t: 0 };
    puruHitsRef.current = [];
    setPokeOn(false);
    setMeshReady(false);
  }
  shownIdRef.current = item?.id ?? null;
  puruMarkersRef.current = puruMarkers;
  puruEditRef.current = puruEdit;
  puruSelectedRef.current = puruSelected;
  if ((item?.id ?? null) === puruItemId) vectorMarkersRef.current = vectorMarkers;
  vectorEditRef.current = vectorEdit;
  if ((item?.id ?? null) !== puruItemId) vectorPlayRef.current = false;
  else vectorPlayRef.current = vectorPlay;
  vectorDriveRef.current = {
    playing: vectorPlayRef.current,
    origin: vectorOriginRef.current,
    markers: vectorMarkersRef.current,
  };
  const [inkOn, setInkOn] = useState(false);
  const [inkDock, setInkDock] = useState<HTMLDivElement | null>(null);
  const hasInk = usePortfolio((state) => (item && !item.animated ? state.inkIds.includes(item.id) : false));
  const inkShown = item?.inkVisible !== false;
  const canInk = Boolean(item && !phone && !item.animated);
  const editing = canInk && (inkOn || Boolean(launchInk?.current));
  const markerMode = puruEdit || vectorEdit;
  const editingRef = useRef(false);
  editingRef.current = editing;
  useEffect(() => {
    if (!item || phone || item.animated) {
      if (launchInk) launchInk.current = false;
      setInkOn(false);
      return;
    }
    if (launchInk?.current) {
      launchInk.current = false;
      setInkOn(true);
    }
  }, [item, phone, launchInk]);
  const [zoom, setZoom] = useState<Zoom>(IDENTITY_ZOOM);
  const [zoomAnim, setZoomAnim] = useState(false);
  const [drag, setDrag] = useState<Drag>(DRAG_REST);
  const [dragAnim, setDragAnim] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [photoOpacity, setPhotoOpacity] = useState(1);
  const [pinchFades, setPinchFades] = useState(false);
  const canPrev = total > 1;
  const canNext = total > 1;
  const swipeRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const frameRef = useRef<Frame | null>(null);
  const zoomRef = useRef<Zoom>(IDENTITY_ZOOM);
  const gestureRef = useRef(freshGesture());
  const phoneRef = useRef(false);
  const suppressClick = useRef(false);
  const infoRef = useRef(false);
  const infoDragRef = useRef<{ id: number; x: number; y: number; top: number } | null>(null);
  const zoomTimer = useRef(0);
  const zoomFrame = useRef(0);
  const dragTimer = useRef(0);
  const dragFrame = useRef(0);
  const dragRef = useRef<Drag>(DRAG_REST);
  const pendingEnter = useRef<Drag | null>(null);
  const tiltTimer = useRef(0);
  const tiltHold = useRef<Tilt | null>(null);
  const pcStop = useRef<(() => void) | null>(null);
  const recoilFrame = useRef(0);
  const recoilGen = useRef(0);
  const rubberMode = useRef<"idle" | "pull" | "spring">("idle");
  const rubberFrame = useRef(0);
  const rubberGen = useRef(0);
  const hoverFrame = useRef(0);
  const hoverShown = useRef<ThumbTilt>(THUMB_REST);
  const hoverTarget = useRef<ThumbTilt>(THUMB_REST);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const [sensorEpoch, setSensorEpoch] = useState(0);
  useEffect(() => watchWantedSensors(() => setSensorEpoch((value) => value + 1)), []);
  const sensorOnRef = useRef(false);
  const sensorBaseline = useRef<Pose | null>(null);
  const sensorStill = useRef(freshStillWatch());
  const sensorShown = useRef(SENSOR_REST);
  const sensorHeld = useRef(false);
  const sensorLast = useRef(0);
  const sensorTimer = useRef(0);
  const sensorHandler = useRef<(() => void) | null>(null);
  const sensorWatch = useRef<SensorRecoilWatch>(freshSensorRecoilWatch());
  const sensorRecoilGen = useRef(0);
  const sensorRecoilFrame = useRef(0);
  const sensorRecoilFrames = useRef<SensorRecoilFrame[] | null>(null);
  const sensorRecoilStarted = useRef(0);
  const sensorRecoilMin = useRef({ x: 0, y: 0 });
  const sensorHandoff = useRef<SensorTilt | null>(null);
  const stopSensorRef = useRef<() => void>(() => {});
  const shakeOnRef = useRef(false);
  const shakeHandler = useRef<(() => void) | null>(null);
  const shakeFrame = useRef(0);
  const shakePose = useRef(SHAKE_REST);
  const shakeLastPaint = useRef(0);
  const shakeLastImpulse = useRef(0);
  const shakeSample = useRef<ShakeSample>(SHAKE_SAMPLE);
  const shakeFlip = useRef(false);
  const shakeSawMotion = useRef(false);
  const shakeTimer = useRef(0);
  const stopShakeRef = useRef<() => void>(() => {});
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const urls = useRef(new Map<string, string>());
  const loadingUrls = useRef(new Set<string>());
  const slideDir = useRef<-1 | 0 | 1>(0);
  const settleEnter = useRef(false);
  const leavingRef = useRef(false);
  const photoOpacityRef = useRef(1);
  const pinchFadesRef = useRef(false);
  const infoTapTimer = useRef(0);
  const armed = useRef(true);
  const openedAt = useRef(0);
  const seenId = useRef<string | null>(item?.id ?? null);
  const seenPhone = useRef(false);
  let shown = zoom;
  let shownDrag = drag;
  const sameImage = (item?.id ?? null) === seenId.current;

  if (!sameImage) {
    const opening = seenId.current === null && item !== null;
    const nextInfo = opening ? false : infoOpenForItem(infoRef.current, item?.id ?? null);
    const enter = pendingEnter.current;
    pendingEnter.current = null;
    seenId.current = item?.id ?? null;
    zoomRef.current = IDENTITY_ZOOM;
    if (opening || !item || gestureRef.current.pointers.length === 0) gestureRef.current = freshGesture();
    infoRef.current = nextInfo;
    shown = IDENTITY_ZOOM;
    window.cancelAnimationFrame(zoomFrame.current);
    window.clearTimeout(zoomTimer.current);
    window.clearTimeout(infoTapTimer.current);
    if (opening) {
      armed.current = false;
      openedAt.current = performance.now();
    }
    if (!item) armed.current = true;
    if (zoom !== IDENTITY_ZOOM) setZoom(IDENTITY_ZOOM);
    if (infoOpen !== nextInfo) setInfoOpen(nextInfo);
    if (zoomAnim) setZoomAnim(false);
    if (enter) {
      dragRef.current = enter;
      shownDrag = enter;
      if (drag.x !== enter.x || drag.y !== enter.y) setDrag(enter);
      if (dragAnim) setDragAnim(false);
    } else {
      window.cancelAnimationFrame(dragFrame.current);
      window.clearTimeout(dragTimer.current);
      shownDrag = DRAG_REST;
      if (drag.x !== 0 || drag.y !== 0 || dragAnim) {
        dragRef.current = DRAG_REST;
        if (drag.x !== 0 || drag.y !== 0) setDrag(DRAG_REST);
        if (dragAnim) setDragAnim(false);
      }
    }
    if (photoOpacity !== 1) {
      photoOpacityRef.current = 1;
      setPhotoOpacity(1);
    }
    if (pinchFades) {
      pinchFadesRef.current = false;
      setPinchFades(false);
    }
    leavingRef.current = false;
  }
  if (phone !== seenPhone.current) {
    seenPhone.current = phone;
    phoneRef.current = phone;
    if (!phone) {
      zoomRef.current = IDENTITY_ZOOM;
      gestureRef.current = freshGesture();
      infoRef.current = false;
      shown = IDENTITY_ZOOM;
      window.cancelAnimationFrame(zoomFrame.current);
      window.clearTimeout(zoomTimer.current);
      window.cancelAnimationFrame(dragFrame.current);
      window.clearTimeout(dragTimer.current);
      pendingEnter.current = null;
      if (zoom !== IDENTITY_ZOOM) setZoom(IDENTITY_ZOOM);
      if (infoOpen) setInfoOpen(false);
      if (zoomAnim) setZoomAnim(false);
      dragRef.current = DRAG_REST;
      if (drag.x !== 0 || drag.y !== 0) setDrag(DRAG_REST);
      if (dragAnim) setDragAnim(false);
    }
  }

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || !item) return;
    const next = containedFrame(stage.clientWidth, stage.clientHeight, item.width, item.height, 16);
    frameRef.current = next;
    const box = { width: stage.clientWidth, height: stage.clientHeight };
    setStageBox((current) => (current.width === box.width && current.height === box.height ? current : box));
    setFrame((current) => {
      if (
        current &&
        next &&
        current.left === next.left &&
        current.top === next.top &&
        current.width === next.width &&
        current.height === next.height
      ) {
        return current;
      }
      return next;
    });
  }, [item]);

  const bindStage = (node: HTMLDivElement | null) => {
    stageRef.current = node;
    measure();
  };

  const bindMedia = (node: HTMLImageElement | HTMLVideoElement | null) => {
    mediaRef.current = node;
  };

  useEffect(() => {
    return () => {
      window.cancelAnimationFrame(zoomFrame.current);
      window.clearTimeout(zoomTimer.current);
      window.cancelAnimationFrame(dragFrame.current);
      window.clearTimeout(dragTimer.current);
      window.clearTimeout(tiltTimer.current);
      window.cancelAnimationFrame(recoilFrame.current);
      recoilGen.current += 1;
      window.cancelAnimationFrame(rubberFrame.current);
      window.cancelAnimationFrame(hoverFrame.current);
      rubberGen.current += 1;
      stopSensorRef.current();
      stopShakeRef.current();
      pcStop.current?.();
      window.clearTimeout(infoTapTimer.current);
      for (const objectUrl of urls.current.values()) URL.revokeObjectURL(objectUrl);
      urls.current.clear();
    };
  }, []);

  useEffect(() => {
    measure();
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    measure();
    const frameId = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(frameId);
  }, [editing, measure]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 899px)");
    const apply = () => {
      phoneRef.current = media.matches;
      setPhone(media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!item?.id) return;
    const frame = window.requestAnimationFrame(() => {
      armed.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [item?.id]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node || !phone || !item) return;
    const block = (event: TouchEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".lightbox-info, .lightbox-anim, .puru-edit, .puru-panel, button, a, input, textarea")) return;
      event.preventDefault();
    };
    node.addEventListener("touchmove", block, { passive: false });
    return () => node.removeEventListener("touchmove", block);
  }, [phone, item]);

  useEffect(() => {
    if (phone) {
      puruEditRef.current = false;
      setPuruEdit(false);
      return;
    }
    if (pcTools) return;
    setAnimMenu(false);
    setPuruEdit(false);
  }, [phone, pcTools]);

  useEffect(() => {
    if (item !== null) return;
    setPcTools(false);
    liquidModeRef.current = false;
    setLiquidMode(false);
    liquidRef.current?.clear();
    setVoiceMenu(false);
    setVoiceRateOpen(false);
    voiceIdRef.current = null;
    setVoiceId(null);
    setVoiceError(null);
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      /* not seekable yet */
    }
  }, [item !== null]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      gainRef.current = null;
      voiceBoundRef.current = null;
      if (ctx) void ctx.close();
    };
  }, []);

  useEffect(() => {
    if (!sensorMenu) return;
    const close = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".lightbox-anim, .lightbox-anim-anchor.is-device")) return;
      setSensorMenu(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [sensorMenu]);

  useEffect(() => {
    if (!shakeMenu) return;
    const close = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".lightbox-anim, .lightbox-anim-anchor.is-shake")) return;
      setShakeMenu(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [shakeMenu]);

  useEffect(() => {
    if (!animMenu) return;
    const close = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".lightbox-anim, .lightbox-anim-anchor.is-anim")) return;
      setAnimMenu(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [animMenu]);

  useEffect(() => {
    if (!voiceMenu) return;
    const close = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".lightbox-voice, .lightbox-anim-anchor.is-voice")) return;
      setVoiceMenu(false);
      setVoiceRateOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [voiceMenu]);

  useEffect(() => {
    const now = performance.now();
    const clock = animClock.current;
    const elapsed = (clock.frozen ?? now) - clock.origin;
    if (animZoomRef.current) clock.carry.zoom = animPhase(elapsed, zoomOptionCycle(animZoomPaceRef.current), clock.carry.zoom);
    if (animTwistRef.current) clock.carry.twist = animPhase(elapsed, twistCycle(animTwistPaceRef.current), clock.carry.twist);
    clock.carry.base = 0;
    clock.origin = now;
    clock.frozen = null;
  }, [animKind]);

  useEffect(() => {
    if (!animLive) return;
    const clock = animClock.current;
    if (!clock.running) {
      clock.origin = performance.now();
      clock.frozen = null;
      clock.carry.base = 0;
      clock.carry.zoom = 0;
      clock.carry.twist = 0;
    }
    clock.running = true;
    return () => {
      clock.running = false;
    };
  }, [animLive]);

  useEffect(() => {
    const clear = () => {
      const stage = stageRef.current;
      puruDriveRef.current = { x: 0, y: 0, scale: 1, t: 0 };
      if (!stage) return;
      stage.style.removeProperty("--fx-x");
      stage.style.removeProperty("--fx-y");
      stage.style.removeProperty("--fx-s");
      stage.style.removeProperty("--fx-r");
    };
    if (!(phone || pcTools) || !animLive || !item) {
      clear();
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const stage = stageRef.current;
      const box = frameRef.current;
      const kind = animKindRef.current;
      const zoom = animZoomRef.current;
      const twist = animTwistRef.current;
      if (stage && box && (kind || zoom || twist)) {
        const editingMesh = puruEditRef.current || (vectorEditRef.current && !vectorPlayRef.current);
        const holding =
          editingMesh ||
          gestureRef.current.pointers.length > 0 ||
          Math.abs(dragRef.current.x) > 0.5 ||
          Math.abs(dragRef.current.y) > 0.5;
        const clock = animClock.current;
        if (editingMesh) {
          if (clock.frozen === null) clock.frozen = now;
          stage.style.setProperty("--fx-x", "0px");
          stage.style.setProperty("--fx-y", "0px");
          stage.style.setProperty("--fx-s", "1");
          stage.style.setProperty("--fx-r", "0deg");
          const drive = puruDriveRef.current;
          drive.x = 0;
          drive.y = 0;
          drive.scale = 1;
          drive.t = now;
          raf = window.requestAnimationFrame(tick);
          return;
        }
        let elapsed: number;
        if (holding) {
          if (clock.frozen === null) clock.frozen = now;
          elapsed = clock.frozen - clock.origin;
        } else {
          if (clock.frozen !== null) {
            clock.origin += now - clock.frozen;
            clock.frozen = null;
          }
          elapsed = now - clock.origin;
        }
        const pose = animationFrame(kind, animSpeedRef.current, elapsed, box, animReverseRef.current, {
          zoom,
          twist,
          tilt: animTiltRef.current,
          zoomPace: animZoomPaceRef.current,
          twistPace: animTwistPaceRef.current,
        }, clock.carry);
        stage.style.setProperty("--fx-x", `${pose.x.toFixed(2)}px`);
        stage.style.setProperty("--fx-y", `${pose.y.toFixed(2)}px`);
        stage.style.setProperty("--fx-s", pose.scale.toFixed(4));
        stage.style.setProperty("--fx-r", `${pose.rotate.toFixed(2)}deg`);
        const drive = puruDriveRef.current;
        drive.x = pose.x;
        drive.y = pose.y;
        drive.scale = pose.scale;
        drive.t = now;
      } else {
        clear();
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      clear();
    };
  }, [phone, pcTools, animLive, item !== null]);

  const itemId = item?.id ?? null;

  useEffect(() => {
    if (!vectorNote) return;
    const timer = window.setTimeout(() => setVectorNote(""), 1600);
    return () => window.clearTimeout(timer);
  }, [vectorNote]);

  useEffect(() => {
    if (!puruNote) return;
    const timer = window.setTimeout(() => setPuruNote(""), 1600);
    return () => window.clearTimeout(timer);
  }, [puruNote]);

  useEffect(() => {
    if (!phone) return;
    if (!vectorEditRef.current) return;
    vectorEditRef.current = false;
    setVectorEdit(false);
  }, [phone]);

  useEffect(() => {
    if (vectorEdit) return;
    if (!vectorGhostRef.current) return;
    vectorGhostRef.current = null;
    setVectorGhost(null);
  }, [vectorEdit]);

  useEffect(() => {
    if (!playNote) return;
    const timer = window.setTimeout(() => setPlayNote(""), 1600);
    return () => window.clearTimeout(timer);
  }, [playNote]);

  useEffect(() => {
    setPlayNote("");
  }, [itemId]);

  useEffect(() => {
    setPuruNote("");
  }, [puruMarkers]);

  useEffect(() => {
    if (puruMarkers.length === 0) setPuruDrawn(false);
  }, [puruMarkers.length]);

  useEffect(() => {
    if (puruEdit) return;
    puruPointers.current.clear();
    puruPinch.current = null;
    puruMove.current = null;
    if (puruGhostRef.current) {
      puruGhostRef.current = null;
      setPuruGhost(null);
    }
  }, [puruEdit]);
  const prevId = prev?.id ?? null;
  const nextId = next?.id ?? null;

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    setHot(null);
    setFailed(false);
    const ids = [itemId];
    if (phone && prevId && prevId !== itemId) ids.push(prevId);
    if (phone && nextId && nextId !== itemId && nextId !== prevId) ids.push(nextId);
    for (const id of ids) {
      if (urls.current.has(id) || loadingUrls.current.has(id)) continue;
      loadingUrls.current.add(id);
      readPixels(id, "original")
        .then((blob) => {
          loadingUrls.current.delete(id);
          if (!blob) {
            if (!cancelled && id === itemId) setFailed(true);
            return;
          }
          if (!urls.current.has(id)) urls.current.set(id, URL.createObjectURL(blob));
          const meta = itemRef.current;
          if (meta && meta.id === id && meta.mime.startsWith("image/")) offerOriginal(meta, blob);
          if (!cancelled) setUrlTick((tick) => tick + 1);
        })
        .catch(() => {
          loadingUrls.current.delete(id);
          if (!cancelled && id === itemId) setFailed(true);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [itemId, prevId, nextId, phone]);

  const step = (delta: number) => {
    if (puruEditRef.current || vectorEditRef.current) return;
    if (delta < 0 && !canPrev) return;
    if (delta > 0 && !canNext) return;
    pendingEnter.current = null;
    settleEnter.current = false;
    window.clearTimeout(dragTimer.current);
    window.cancelAnimationFrame(dragFrame.current);
    onStep(delta);
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    if (!contained || !item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      event.stopPropagation();
      stepRef.current(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [contained, item]);

  useEffect(() => {
    if (!settleEnter.current) return;
    settleEnter.current = false;
    animateDragTo(DRAG_REST);
  }, [item?.id]);

  const readVisualDrag = (): Drag => {
    const node = mediaRef.current;
    const motion = node?.closest(".lightbox-motion");
    const target = motion instanceof HTMLElement ? motion : node;
    if (!target || typeof DOMMatrix === "undefined") return dragRef.current;
    const raw = getComputedStyle(target).transform;
    if (!raw || raw === "none") return DRAG_REST;
    try {
      const matrix = new DOMMatrix(raw);
      return { x: matrix.e - zoomRef.current.x, y: matrix.f - zoomRef.current.y };
    } catch {
      return dragRef.current;
    }
  };

  const stopDragMotion = (): Drag => {
    window.clearTimeout(dragTimer.current);
    window.cancelAnimationFrame(dragFrame.current);
    const visual = dragAnim ? readVisualDrag() : dragRef.current;
    dragRef.current = visual;
    if (dragAnim) {
      setDragAnim(false);
      setDrag(visual);
    }
    return visual;
  };

  const animateDragTo = (target: Drag, done?: () => void) => {
    window.clearTimeout(dragTimer.current);
    window.cancelAnimationFrame(dragFrame.current);
    setDragAnim(true);
    dragFrame.current = window.requestAnimationFrame(() => {
      dragFrame.current = window.requestAnimationFrame(() => {
        dragRef.current = target;
        setDrag(target);
        dragTimer.current = window.setTimeout(() => {
          if (done) done();
          else setDragAnim(false);
        }, SWIPE_ANIM_MS);
      });
    });
  };

  const springDrag = () => {
    if (Math.abs(dragRef.current.x) < 0.5 && Math.abs(dragRef.current.y) < 0.5) {
      dragRef.current = DRAG_REST;
      setDrag(DRAG_REST);
      setDragAnim(false);
      return;
    }
    animateDragTo(DRAG_REST);
  };

  const flySwap = (delta: number) => {
    if ((delta < 0 && !canPrev) || (delta > 0 && !canNext)) {
      springDrag();
      return;
    }
    window.clearTimeout(dragTimer.current);
    window.cancelAnimationFrame(dragFrame.current);
    const width = stageRef.current?.clientWidth || 1;
    pendingEnter.current = { x: incomingX(dragRef.current.x, width), y: 0 };
    settleEnter.current = true;
    onStep(delta);
  };

  const stopMotion = () => {
    window.clearTimeout(dragTimer.current);
    window.clearTimeout(zoomTimer.current);
    window.cancelAnimationFrame(dragFrame.current);
    window.cancelAnimationFrame(zoomFrame.current);
  };

  const setPhoto = (value: number) => {
    photoOpacityRef.current = value;
    setPhotoOpacity(value);
  };

  const setPinchFade = (value: boolean) => {
    if (pinchFadesRef.current === value) return;
    pinchFadesRef.current = value;
    setPinchFades(value);
  };

  const playMotion = (duration: number, frame: (eased: number) => void, done?: () => void) => {
    stopMotion();
    setDragAnim(false);
    setZoomAnim(false);
    const start = performance.now();
    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / duration);
      frame(1 - (1 - raw) ** 3);
      if (raw < 1) dragFrame.current = window.requestAnimationFrame(tick);
      else done?.();
    };
    dragFrame.current = window.requestAnimationFrame(tick);
  };

  const abortLeave = () => {
    if (!leavingRef.current) return false;
    leavingRef.current = false;
    const fromDrag = { ...dragRef.current };
    const fromZoom = { ...zoomRef.current };
    const fromOpacity = photoOpacityRef.current;
    playMotion(SWIPE_ANIM_MS, (eased) => {
      const drag = { x: fromDrag.x * (1 - eased), y: fromDrag.y * (1 - eased) };
      const zoom = {
        scale: fromZoom.scale + (1 - fromZoom.scale) * eased,
        x: fromZoom.x * (1 - eased),
        y: fromZoom.y * (1 - eased),
      };
      dragRef.current = drag;
      zoomRef.current = zoom;
      setDrag(drag);
      setZoom(zoom);
      setPhoto(fromOpacity + (1 - fromOpacity) * eased);
    }, () => setPinchFade(false));
    return true;
  };

  const flyAway = () => {
    leavingRef.current = true;
    const from = { ...dragRef.current };
    const height = stageRef.current?.clientHeight || 1;
    const toY = Math.max(from.y + height * 0.45, height);
    playMotion(SWIPE_ANIM_MS, (eased) => {
      const next = { x: from.x * (1 - eased), y: from.y + (toY - from.y) * eased };
      dragRef.current = next;
      setDrag(next);
      setPhoto(1 - eased);
    }, () => {
      if (leavingRef.current) onClose();
    });
  };

  const shrinkAway = (from: Zoom) => {
    leavingRef.current = true;
    setPinchFade(true);
    const next = {
      scale: Math.max(PINCH_MIN * 0.45, from.scale * 0.55),
      x: from.x * 0.55,
      y: from.y * 0.55,
    };
    playMotion(ZOOM_ANIM_MS, (eased) => {
      const zoom = {
        scale: from.scale + (next.scale - from.scale) * eased,
        x: from.x + (next.x - from.x) * eased,
        y: from.y + (next.y - from.y) * eased,
      };
      zoomRef.current = zoom;
      setZoom(zoom);
      setPhoto(1 - eased);
    }, () => {
      if (leavingRef.current) onClose();
    });
  };

  const settlePinch = (startedFitted: boolean, zoom: Zoom) => {
    const release = pinchRelease(startedFitted, zoom.scale);
    if (release === "close") {
      shrinkAway(zoom);
      return;
    }
    if (release === "fit") {
      zoomRef.current = IDENTITY_ZOOM;
      window.cancelAnimationFrame(zoomFrame.current);
      window.clearTimeout(zoomTimer.current);
      setZoomAnim(true);
      zoomFrame.current = window.requestAnimationFrame(() => {
        setZoom(IDENTITY_ZOOM);
        zoomTimer.current = window.setTimeout(() => setZoomAnim(false), ZOOM_ANIM_MS);
      });
    }
  };

  const applyGesture = (result: GestureResult) => {
    if (leavingRef.current) return;
    if (result.gesture.pointers.length > 0 || result.zoom) window.clearTimeout(infoTapTimer.current);
    gestureRef.current = result.gesture;
    if (result.suppressClick) suppressClick.current = true;
    if (result.zoom) {
      const next = result.zoom;
      zoomRef.current = next;
      window.cancelAnimationFrame(zoomFrame.current);
      window.clearTimeout(zoomTimer.current);
      if (result.animateZoom) {
        setZoomAnim(true);
        zoomFrame.current = window.requestAnimationFrame(() => {
          setZoom(next);
          zoomTimer.current = window.setTimeout(() => setZoomAnim(false), ZOOM_ANIM_MS);
        });
      } else {
        setZoomAnim(false);
        setZoom(next);
      }
      if (dragRef.current.x !== 0 || dragRef.current.y !== 0 || dragAnim) {
        window.clearTimeout(dragTimer.current);
        dragRef.current = DRAG_REST;
        setDrag(DRAG_REST);
        setDragAnim(false);
      }
      if (isZoomed(next) && infoRef.current) {
        infoRef.current = false;
        setInfoOpen(false);
      }
    }
    if (result.drag) {
      const next = scrubDrag(result.drag, infoRef.current);
      window.clearTimeout(dragTimer.current);
      window.cancelAnimationFrame(dragFrame.current);
      dragRef.current = next;
      setDragAnim(false);
      setDrag(next);
    }
    if (result.gesture.mode === "pinch") setPinchFade(result.gesture.pinchFitted === true);
    if (result.pinch === "fit" || result.pinch === "keep") setPinchFade(false);
    const finished = result.gesture.mode === "idle" && result.gesture.pointers.length === 0;
    if (!finished) return;
    if (result.pinch === "close") {
      shrinkAway(zoomRef.current);
      return;
    }
    const action = lightboxGestureAction(result, infoRef.current, isZoomed(zoomRef.current));
    if (action === "show-info") {
      if (result.tap) {
        window.clearTimeout(infoTapTimer.current);
        infoTapTimer.current = window.setTimeout(() => {
          if (infoRef.current || isZoomed(zoomRef.current) || !phoneRef.current) return;
          infoRef.current = true;
          setInfoOpen(true);
        }, DOUBLE_TAP_MS);
      } else {
        window.clearTimeout(infoTapTimer.current);
        infoRef.current = true;
        setInfoOpen(true);
      }
      springDrag();
      return;
    }
    if (action === "hide-info") {
      infoRef.current = false;
      setInfoOpen(false);
      gestureRef.current = freshGesture();
      suppressClick.current = true;
      springDrag();
      return;
    }
    if (action === "close-viewer") {
      flyAway();
      return;
    }
    if (action === "step" && result.step) {
      flySwap(result.step);
      return;
    }
    springDrag();
  };

  const tiltNode = () => stageRef.current?.querySelector(".lightbox-tilt") ?? null;

  const clearSheen = (stage: HTMLElement) => {
    stage.style.removeProperty("--sheen-x");
    stage.style.removeProperty("--sheen-y");
    stage.style.removeProperty("--sheen-o");
    stage.style.removeProperty("--sheen-turn");
  };

  const paintPhoneGloss = () => {
    const stage = stageRef.current;
    if (!stage || !phoneRef.current) return;
    if (editingRef.current || puruEditRef.current) {
      clearSheen(stage);
      return;
    }
    const tiltOn = stage.classList.contains("is-sensor");
    const shakeOn = stage.classList.contains("is-shaking");
    const gloss = phoneSheen(
      tiltOn
        ? {
            x: Number.parseFloat(stage.style.getPropertyValue("--sensor-rx")) || 0,
            y: Number.parseFloat(stage.style.getPropertyValue("--sensor-ry")) || 0,
          }
        : TILT_REST,
      shakeOn
        ? {
            x: Number.parseFloat(stage.style.getPropertyValue("--shake-x")) || 0,
            y: Number.parseFloat(stage.style.getPropertyValue("--shake-y")) || 0,
            r: Number.parseFloat(stage.style.getPropertyValue("--shake-r")) || 0,
          }
        : SHAKE_REST,
    );
    if (gloss.opacity <= 0) {
      clearSheen(stage);
      return;
    }
    stage.style.setProperty("--sheen-x", `${gloss.x.toFixed(2)}%`);
    stage.style.setProperty("--sheen-y", `${gloss.y.toFixed(2)}%`);
    stage.style.setProperty("--sheen-o", gloss.opacity.toFixed(3));
    stage.style.setProperty("--sheen-turn", `${gloss.turn.toFixed(2)}deg`);
  };

  const paintSheen = (tilt: Tilt) => {
    const stage = stageRef.current;
    if (!stage || phoneRef.current) return;
    const sheen = sheenFromTilt(tilt);
    stage.style.setProperty("--sheen-x", `${sheen.x.toFixed(2)}%`);
    stage.style.setProperty("--sheen-y", `${sheen.y.toFixed(2)}%`);
    stage.style.setProperty("--sheen-o", sheen.opacity.toFixed(3));
    stage.style.setProperty("--sheen-turn", `${sheen.turn.toFixed(2)}deg`);
  };

  const stopRecoil = () => {
    recoilGen.current += 1;
    if (recoilFrame.current) {
      window.cancelAnimationFrame(recoilFrame.current);
      recoilFrame.current = 0;
    }
  };

  const flatTilt = () => {
    window.clearTimeout(tiltTimer.current);
    stopRecoil();
    rubberGen.current += 1;
    if (rubberFrame.current) window.cancelAnimationFrame(rubberFrame.current);
    rubberFrame.current = 0;
    if (hoverFrame.current) window.cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = 0;
    rubberMode.current = "idle";
    hoverShown.current = THUMB_REST;
    hoverTarget.current = THUMB_REST;
    tiltHold.current = null;
    pcStop.current?.();
    pcStop.current = null;
    const stage = stageRef.current;
    if (!stage) return;
    stage.classList.remove("is-tilting", "is-settling", "is-recoil", "is-pc-rubber");
    stage.style.removeProperty("--card-rx");
    stage.style.removeProperty("--card-ry");
    stage.style.removeProperty("--pull-x");
    stage.style.removeProperty("--pull-y");
    clearSheen(stage);
    puruViewRef.current = { ...PURU_VIEW_REST };
    if (phoneRef.current) paintPhoneGloss();
  };

  const readLiveTilt = (stage: HTMLElement) => {
    const node = tiltNode();
    if (stage.classList.contains("is-recoil")) {
      const x = Number.parseFloat(stage.style.getPropertyValue("--card-rx"));
      const y = Number.parseFloat(stage.style.getPropertyValue("--card-ry"));
      if (Number.isFinite(x) && Number.isFinite(y)) return { x, y };
    }
    if (!(node instanceof HTMLElement)) return TILT_REST;
    const raw = getComputedStyle(node).transform;
    if (!raw || raw === "none" || typeof DOMMatrix === "undefined") return TILT_REST;
    try {
      const matrix = new DOMMatrix(raw);
      return tiltFromMatrix(matrix.m11, matrix.m22, matrix.m23, matrix.m31);
    } catch {
      return TILT_REST;
    }
  };

  const engageTilt = () => {
    if (tiltHold.current || puruEditRef.current || vectorEditRef.current || editingRef.current) return;
    const stage = stageRef.current;
    let current: Tilt = TILT_REST;
    if (stage?.classList.contains("is-settling") || stage?.classList.contains("is-recoil")) {
      stopRecoil();
      window.clearTimeout(tiltTimer.current);
      current = readLiveTilt(stage);
      stage.style.setProperty("--card-rx", `${current.x.toFixed(2)}deg`);
      stage.style.setProperty("--card-ry", `${current.y.toFixed(2)}deg`);
      paintSheen(current);
      stage.classList.remove("is-settling", "is-recoil");
    }
    tiltHold.current = current;
  };

  const followTilt = (dx: number, dy: number) => {
    if (puruEditRef.current || vectorEditRef.current || editingRef.current) return;
    engageTilt();
    const stage = stageRef.current;
    const base = tiltHold.current;
    if (!stage || !base) return;
    const next = tiltFromDrag(dx, dy, base);
    window.clearTimeout(tiltTimer.current);
    stopRecoil();
    stage.classList.remove("is-settling", "is-recoil");
    stage.classList.add("is-tilting");
    stage.style.setProperty("--card-rx", `${next.x.toFixed(2)}deg`);
    stage.style.setProperty("--card-ry", `${next.y.toFixed(2)}deg`);
    paintSheen(next);
  };

  const settleTilt = (stage: HTMLElement) => {
    stopRecoil();
    stage.classList.remove("is-tilting", "is-recoil");
    stage.classList.add("is-settling");
    stage.style.setProperty("--card-rx", "0deg");
    stage.style.setProperty("--card-ry", "0deg");
    paintSheen(TILT_REST);
    tiltTimer.current = window.setTimeout(() => {
      if (tiltHold.current || stage.classList.contains("is-recoil")) return;
      stage.classList.remove("is-settling");
      stage.style.removeProperty("--card-rx");
      stage.style.removeProperty("--card-ry");
      clearSheen(stage);
    }, TILT_RETURN_MS);
  };

  const playRecoil = (stage: HTMLElement, frames: NonNullable<ReturnType<typeof recoilKeyframes>>) => {
    stopRecoil();
    const gen = recoilGen.current;
    stage.classList.remove("is-tilting", "is-settling");
    stage.classList.add("is-recoil");
    const started = performance.now();
    const tick = (now: number) => {
      if (gen !== recoilGen.current) return;
      const live = stageRef.current;
      if (!live || !live.classList.contains("is-recoil")) {
        recoilFrame.current = 0;
        return;
      }
      const t = (now - started) / RECOIL_MS;
      if (t >= 1) {
        recoilFrame.current = 0;
        live.classList.remove("is-recoil");
        live.style.removeProperty("--card-rx");
        live.style.removeProperty("--card-ry");
        clearSheen(live);
        return;
      }
      const tilt = tiltAtRecoil(frames, t);
      live.style.setProperty("--card-rx", `${tilt.x.toFixed(2)}deg`);
      live.style.setProperty("--card-ry", `${tilt.y.toFixed(2)}deg`);
      paintSheen(tilt);
      recoilFrame.current = window.requestAnimationFrame(tick);
    };
    recoilFrame.current = window.requestAnimationFrame(tick);
  };

  const releaseTilt = (velocity: TiltVelocity = { vx: 0, vy: 0 }) => {
    const stage = stageRef.current;
    tiltHold.current = null;
    if (!stage || !stage.classList.contains("is-tilting")) return;
    window.clearTimeout(tiltTimer.current);
    const start = {
      x: Number.parseFloat(stage.style.getPropertyValue("--card-rx")) || 0,
      y: Number.parseFloat(stage.style.getPropertyValue("--card-ry")) || 0,
    };
    const frames =
      phoneRef.current || puruEditRef.current || editingRef.current ? null : recoilKeyframes(start, velocity.vx, velocity.vy);
    if (!frames) {
      settleTilt(stage);
      return;
    }
    playRecoil(stage, frames);
  };

  const clearSensorPaint = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.classList.remove("is-sensor");
    stage.style.removeProperty("--sensor-rx");
    stage.style.removeProperty("--sensor-ry");
    paintPhoneGloss();
  };

  const stopSensorRecoil = () => {
    sensorRecoilGen.current += 1;
    if (sensorRecoilFrame.current) {
      window.cancelAnimationFrame(sensorRecoilFrame.current);
      sensorRecoilFrame.current = 0;
    }
    sensorRecoilFrames.current = null;
    sensorHandoff.current = null;
  };

  const writeSensorAngle = (tilt: SensorTilt) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.classList.add("is-sensor");
    stage.style.setProperty("--sensor-rx", `${tilt.x.toFixed(2)}deg`);
    stage.style.setProperty("--sensor-ry", `${tilt.y.toFixed(2)}deg`);
    paintPhoneGloss();
  };

  const readSensorAngle = (): SensorTilt => {
    const stage = stageRef.current;
    if (!stage) return SENSOR_REST;
    return {
      x: Number.parseFloat(stage.style.getPropertyValue("--sensor-rx")) || 0,
      y: Number.parseFloat(stage.style.getPropertyValue("--sensor-ry")) || 0,
    };
  };

  const playSensorRecoil = (impulse: SensorTilt) => {
    const frames = sensorRecoilOffsets(impulse);
    if (!frames || !stageRef.current) return;
    sensorRecoilGen.current += 1;
    if (sensorRecoilFrame.current) window.cancelAnimationFrame(sensorRecoilFrame.current);
    const gen = sensorRecoilGen.current;
    sensorRecoilFrames.current = frames;
    sensorRecoilStarted.current = performance.now();
    sensorRecoilMin.current = { x: Math.abs(sensorShown.current.x), y: Math.abs(sensorShown.current.y) };
    sensorHandoff.current = null;
    const tick = (now: number) => {
      if (gen !== sensorRecoilGen.current) return;
      if (!stageRef.current || !sensorOnRef.current || !sensorRecoilFrames.current) {
        sensorRecoilFrame.current = 0;
        return;
      }
      const t = (now - sensorRecoilStarted.current) / SENSOR_RECOIL_MS;
      if (t >= 1) {
        sensorRecoilFrames.current = null;
        sensorRecoilFrame.current = 0;
        writeSensorAngle(sensorShown.current);
        return;
      }
      writeSensorAngle(sensorRecoilAngle(sensorShown.current, sensorRecoilOffset(sensorRecoilFrames.current, t)));
      sensorRecoilFrame.current = window.requestAnimationFrame(tick);
    };
    writeSensorAngle(sensorRecoilAngle(sensorShown.current, sensorRecoilOffset(frames, 0)));
    sensorRecoilFrame.current = window.requestAnimationFrame(tick);
  };

  const grabSensorRecoil = () => {
    if (!sensorRecoilFrames.current) return;
    sensorHandoff.current = readSensorAngle();
    sensorRecoilGen.current += 1;
    if (sensorRecoilFrame.current) window.cancelAnimationFrame(sensorRecoilFrame.current);
    sensorRecoilFrame.current = 0;
    sensorRecoilFrames.current = null;
    sensorWatch.current = muteSensorRecoil(sensorWatch.current);
  };

  const paintSensor = (tilt: Tilt) => {
    const stage = stageRef.current;
    if (!stage) return;
    const allowed = sensorWriteAllowed(gestureRef.current.mode, {
      tilting: stage.classList.contains("is-tilting"),
      settling: stage.classList.contains("is-settling"),
      recoiling: stage.classList.contains("is-recoil"),
    });
    if (!allowed) {
      stopSensorRecoil();
      sensorWatch.current = muteSensorRecoil(sensorWatch.current);
      if (!sensorHeld.current) {
        sensorHeld.current = true;
        stage.classList.remove("is-sensor");
      }
      paintPhoneGloss();
      return;
    }
    if (sensorHeld.current) {
      sensorShown.current = SENSOR_REST;
      sensorHeld.current = false;
    }
    if (sensorRecoilFrames.current) {
      stage.classList.add("is-sensor");
      return;
    }
    if (sensorHandoff.current) {
      const next = smoothTilt(sensorHandoff.current, tilt);
      sensorHandoff.current = Math.hypot(next.x - tilt.x, next.y - tilt.y) < 0.08 ? null : next;
      writeSensorAngle(sensorHandoff.current ?? tilt);
      return;
    }
    writeSensorAngle(tilt);
  };

  const stopSensor = () => {
    window.clearTimeout(sensorTimer.current);
    if (sensorHandler.current) {
      sensorHandler.current();
      sensorHandler.current = null;
    }
    sensorOnRef.current = false;
    sensorBaseline.current = null;
    sensorStill.current = freshStillWatch();
    sensorShown.current = SENSOR_REST;
    sensorHeld.current = false;
    sensorLast.current = 0;
    stopSensorRecoil();
    sensorWatch.current = freshSensorRecoilWatch();
    clearSensorPaint();
    setSensorStatus("idle");
    setSensorNote("停止中");
  };
  stopSensorRef.current = stopSensor;

  const startSensor = () => {
    if (sensorOnRef.current) return;
    const support = sensorSupport(typeof window === "undefined" ? null : window);
    if (support === "missing") {
      setSensorStatus("unavailable");
      setSensorNote("この端末では傾きセンサーを利用できません");
      return;
    }
    if (support === "insecure") {
      setSensorStatus("insecure");
      setSensorNote("安全な接続（HTTPS）でのみ利用できます");
      return;
    }
    const asked = askOrientation(typeof window === "undefined" ? null : window);
    void asked.then(
      (result) => {
        if (result !== "granted" || !sensorOpenRef.current) {
          if (result !== "granted") {
            setSensorStatus(result === "unsupported" ? "unavailable" : "denied");
            setSensorNote(result === "error" ? "センサーの確認に失敗しました" : "センサーの使用が許可されませんでした");
          }
          return;
        }
        sensorHandler.current?.();
        sensorOnRef.current = true;
        sensorBaseline.current = null;
        sensorStill.current = freshStillWatch();
        sensorShown.current = SENSOR_REST;
        sensorHeld.current = false;
        sensorLast.current = 0;
        stopSensorRecoil();
        sensorWatch.current = freshSensorRecoilWatch();
        setSensorStatus("on");
        setSensorNote("基準を取っています");
        const onReading = (sample: { beta: number | null; gamma: number | null }) => {
          if (!sensorOnRef.current || !phoneRef.current) return;
          const now = performance.now();
          const dt = sensorLast.current ? now - sensorLast.current : SENSOR_MIN_INTERVAL_MS;
          if (dt < SENSOR_MIN_INTERVAL_MS) return;
          sensorLast.current = now;
          const pose = poseFromReading(sample.beta, sample.gamma);
          if (!pose) {
            sensorShown.current = smoothTilt(sensorShown.current, SENSOR_REST);
            paintSensor(sensorShown.current);
            return;
          }
          if (!sensorBaseline.current) {
            sensorBaseline.current = pose;
            sensorShown.current = SENSOR_REST;
            sensorStill.current = { anchor: pose, since: now, settling: false };
            paintSensor(SENSOR_REST);
            setSensorNote("オン");
            return;
          }
          const wasSettling = sensorStill.current.settling;
          const step = applyStillTilt({
            watch: sensorStill.current,
            baseline: sensorBaseline.current,
            shown: sensorShown.current,
            pose,
            now,
            dt,
          });
          sensorStill.current = step.watch;
          sensorBaseline.current = step.baseline;
          sensorShown.current = step.shown;
          if (step.settling && !wasSettling) {
            stopSensorRecoil();
            sensorWatch.current = muteSensorRecoil(sensorWatch.current);
          }
          if (!step.settling) {
            const target = tiltFromPose(pose, sensorBaseline.current);
            if (sensorRecoilFrames.current) {
              sensorRecoilMin.current = {
                x: Math.min(sensorRecoilMin.current.x, Math.abs(target.x)),
                y: Math.min(sensorRecoilMin.current.y, Math.abs(target.y)),
              };
              if (sensorReturnReversed(sensorRecoilMin.current.x, target.x) || sensorReturnReversed(sensorRecoilMin.current.y, target.y)) {
                grabSensorRecoil();
              }
            }
            if (!sensorHandoff.current) {
              const judged = observeSensorReturn(sensorWatch.current, target, now);
              sensorWatch.current = judged.watch;
              if (judged.impulse && !sensorRecoilFrames.current) playSensorRecoil(judged.impulse);
            }
          }
          paintSensor(sensorShown.current);
        };
        sensorHandler.current = onOrientation(onReading);
        setWantedSensors({ tilt: true });
        window.clearTimeout(sensorTimer.current);
        sensorTimer.current = window.setTimeout(() => {
          if (!sensorOnRef.current || sensorBaseline.current) return;
          setSensorNote("傾きデータを取得できません");
          sensorShown.current = SENSOR_REST;
          paintSensor(SENSOR_REST);
        }, 2000);
      },
      () => {
        setSensorStatus("denied");
        setSensorNote("センサーの確認に失敗しました");
      },
    );
  };

  const resetSensorBaseline = () => {
    if (!sensorOnRef.current) return;
    sensorBaseline.current = null;
    sensorStill.current = freshStillWatch();
    sensorShown.current = SENSOR_REST;
    sensorLast.current = 0;
    stopSensorRecoil();
    sensorWatch.current = freshSensorRecoilWatch();
    paintSensor(SENSOR_REST);
    setSensorNote("基準を取り直しています");
  };

  const shakeBlocked = () => {
    const stage = stageRef.current;
    return !shakePaintAllowed(gestureRef.current.mode, {
      tilting: stage?.classList.contains("is-tilting") ?? false,
      settling: stage?.classList.contains("is-settling") ?? false,
      recoiling: stage?.classList.contains("is-recoil") ?? false,
    });
  };

  const clearShakePaint = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.classList.remove("is-shaking");
    stage.style.removeProperty("--shake-x");
    stage.style.removeProperty("--shake-y");
    stage.style.removeProperty("--shake-r");
    paintPhoneGloss();
  };

  const paintShake = () => {
    const stage = stageRef.current;
    if (!stage || shakeBlocked()) {
      clearShakePaint();
      return;
    }
    const pose = shakePose.current;
    stage.classList.add("is-shaking");
    stage.style.setProperty("--shake-x", `${pose.x.toFixed(2)}px`);
    stage.style.setProperty("--shake-y", `${pose.y.toFixed(2)}px`);
    stage.style.setProperty("--shake-r", `${pose.r.toFixed(2)}deg`);
    paintPhoneGloss();
  };

  const runShake = (now: number) => {
    shakeLastPaint.current = now;
    paintShake();
    if (shakeFrame.current) return;
    const tick = (time: number) => {
      if (!shakeOnRef.current || shakeBlocked()) {
        shakePose.current = SHAKE_REST;
        clearShakePaint();
        shakeFrame.current = 0;
        return;
      }
      const dt = Math.min(48, time - shakeLastPaint.current);
      shakeLastPaint.current = time;
      shakePose.current = decayShake(shakePose.current, dt);
      if (shakePose.current === SHAKE_REST) {
        clearShakePaint();
        shakeFrame.current = 0;
        return;
      }
      paintShake();
      shakeFrame.current = window.requestAnimationFrame(tick);
    };
    shakeFrame.current = window.requestAnimationFrame(tick);
  };

  const stopShake = () => {
    window.clearTimeout(shakeTimer.current);
    window.cancelAnimationFrame(shakeFrame.current);
    shakeFrame.current = 0;
    if (shakeHandler.current) {
      shakeHandler.current();
      shakeHandler.current = null;
    }
    shakeOnRef.current = false;
    shakePose.current = SHAKE_REST;
    shakeSample.current = SHAKE_SAMPLE;
    shakeLastImpulse.current = 0;
    shakeSawMotion.current = false;
    clearShakePaint();
    setShakeStatus("idle");
    setShakeNote("オフ");
  };
  stopShakeRef.current = stopShake;

  const startShake = () => {
    if (shakeOnRef.current) return;
    const support = motionSupport(typeof window === "undefined" ? null : window);
    if (support === "missing") {
      setShakeStatus("unavailable");
      setShakeNote("この端末ではシェイクを利用できません");
      return;
    }
    if (support === "insecure") {
      setShakeStatus("insecure");
      setShakeNote("安全な接続（HTTPS）でのみ利用できます");
      return;
    }
    const pending = askMotion(typeof window === "undefined" ? null : window);
    void pending.then(
      (result) => {
        if (result !== "granted" || !sensorOpenRef.current) {
          if (result !== "granted") {
            setShakeStatus(result === "unsupported" ? "unavailable" : "denied");
            setShakeNote(result === "error" ? "センサーの確認に失敗しました" : result === "unsupported" ? "この端末ではシェイクを利用できません" : "センサーの使用が許可されませんでした");
          }
          return;
        }
        shakeHandler.current?.();
        shakeOnRef.current = true;
        shakePose.current = SHAKE_REST;
        shakeSample.current = SHAKE_SAMPLE;
        shakeLastImpulse.current = 0;
        shakeSawMotion.current = false;
        setShakeStatus("on");
        setShakeNote("オン");
        const onShake = (sample: { acceleration: { x: number | null; y: number | null; z: number | null } | null; accelerationIncludingGravity: { x: number | null; y: number | null; z: number | null } | null }) => {
          if (!shakeOnRef.current || !phoneRef.current) return;
          const reading = readAccel(sample.acceleration, sample.accelerationIncludingGravity);
          if (!reading) return;
          if (!shakeSawMotion.current) {
            shakeSawMotion.current = true;
            setShakeNote("オン");
          }
          const now = performance.now();
          const judged = considerShake(shakeSample.current, reading, now);
          shakeSample.current = judged.next;
          const power = shakePower(judged.delta);
          if (power <= 0 || now - shakeLastImpulse.current < SHAKE_MIN_INTERVAL_MS) return;
          shakeLastImpulse.current = now;
          shakeFlip.current = !shakeFlip.current;
          if (shakeBlocked()) return;
          shakePose.current = impulseFromPower(power, shakeFlip.current);
          runShake(now);
        };
        shakeHandler.current = onMotion(onShake);
        setWantedSensors({ shake: true });
        window.clearTimeout(shakeTimer.current);
        shakeTimer.current = window.setTimeout(() => {
          if (!shakeOnRef.current || shakeSawMotion.current) return;
          setShakeNote("シェイクを検知できません");
        }, 2000);
      },
      () => {
        setShakeStatus("denied");
        setShakeNote("センサーの使用が許可されませんでした");
      },
    );
  };

  useLayoutEffect(() => {
    flatTilt();
  }, [item?.id, editing, puruEdit, phone]);

  useEffect(() => {
    if (!item || !phone) {
      stopSensor();
      stopShake();
      return;
    }
    const want = wantedSensors();
    const permits = sensorPermits();
    if (want.tilt && permits.orientation === "granted") startSensor();
    else stopSensor();
    if (want.shake && permits.motion === "granted") startShake();
    else stopShake();
  }, [item, phone, sensorEpoch]);

  const layout = () => {
    const base = frameRef.current;
    const stage = stageRef.current;
    if (!base || !stage) return null;
    return { base, stage: { width: stage.clientWidth, height: stage.clientHeight } };
  };

  const localPoint = (event: ReactPointerEvent<HTMLElement>) => {
    const stage = stageRef.current ?? event.currentTarget;
    const rect = stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const beginSwipe = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.pointerType === "mouse") return;
    const target = event.target as Element | null;
    if (target?.closest("button, a, input, textarea")) return;
    swipeRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const endSwipe = (event: ReactPointerEvent<HTMLElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.id !== event.pointerId) return;
    swipeRef.current = null;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    step(dx < 0 ? 1 : -1);
  };

  const motionReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const frameBox = () => {
    const stage = stageRef.current;
    const frame = frameRef.current;
    if (!stage || !frame) return null;
    const box = stage.getBoundingClientRect();
    return { left: box.left + frame.left, top: box.top + frame.top, width: frame.width, height: frame.height, right: box.left + frame.left + frame.width, bottom: box.top + frame.top + frame.height };
  };

  const readImagePose = (): ImagePose | null => {
    const box = frameBox();
    const stage = stageRef.current;
    if (!box || !stage) return null;
    const num = (name: string) => {
      const value = Number.parseFloat(stage.style.getPropertyValue(name));
      return Number.isFinite(value) ? value : 0;
    };
    const tilt = stage.querySelector(".lightbox-tilt.is-hit");
    const scene = tilt?.parentElement ?? null;
    let perspective = 720;
    if (scene instanceof HTMLElement) {
      const raw = getComputedStyle(scene).perspective;
      const value = Number.parseFloat(raw);
      perspective = Number.isFinite(value) ? value : 0;
    }
    const rubber = stage.classList.contains("is-pc-rubber");
    const sensor = stage.classList.contains("is-sensor") && !rubber;
    const card =
      rubber ||
      sensor ||
      stage.classList.contains("is-tilting") ||
      stage.classList.contains("is-recoil") ||
      stage.classList.contains("is-settling");
    const shaking = stage.classList.contains("is-shaking");
    const motion = tilt?.querySelector(".lightbox-motion-fx") instanceof HTMLElement;
    const scale = motion ? num("--fx-s") : 0;
    return {
      width: box.width,
      height: box.height,
      left: box.left,
      top: box.top,
      perspective,
      pullX: rubber ? num("--pull-x") : 0,
      pullY: rubber ? num("--pull-y") : 0,
      rx: !card ? 0 : sensor ? num("--sensor-rx") : num("--card-rx"),
      ry: !card ? 0 : sensor ? num("--sensor-ry") : num("--card-ry"),
      shakeX: shaking ? num("--shake-x") : 0,
      shakeY: shaking ? num("--shake-y") : 0,
      shakeR: shaking ? num("--shake-r") : 0,
      fxX: motion ? num("--fx-x") : 0,
      fxY: motion ? num("--fx-y") : 0,
      fxR: motion ? num("--fx-r") : 0,
      fxS: scale > 0 ? scale : 1,
    };
  };

  const pictureHit = (clientX: number, clientY: number) => {
    const current = itemRef.current;
    if (!current || phoneRef.current || viewerPhone() || current.animated || !current.mime.startsWith("image/")) return null;
    const pose = readImagePose();
    if (!pose) return null;
    const point = imagePointFromPose(clientX, clientY, pose);
    if (!point.inside) return null;
    return { u: point.u, v: point.v, minSide: Math.min(pose.width, pose.height) };
  };

  const tiltAtPoint = (point: { x: number; y: number }): ThumbTilt => {
    const box = frameBox();
    if (!box || box.width < 2 || box.height < 2) return THUMB_REST;
    return thumbTiltFromPointer(
      thumbUnit(point.x - (box.left + box.width / 2), box.width / 2),
      thumbUnit(point.y - (box.top + box.height / 2), box.height / 2),
    );
  };

  const overFrame = (point: { x: number; y: number }) => {
    const box = frameBox();
    if (!box) return false;
    return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
  };

  const paintRubber = (pull: { x: number; y: number }, tilt: ThumbTilt) => {
    const stage = stageRef.current;
    if (!stage || phoneRef.current) return;
    stage.classList.add("is-pc-rubber");
    stage.classList.remove("is-tilting", "is-settling", "is-recoil");
    stage.style.setProperty("--pull-x", `${pull.x.toFixed(2)}px`);
    stage.style.setProperty("--pull-y", `${pull.y.toFixed(2)}px`);
    stage.style.setProperty("--card-rx", `${tilt.x.toFixed(2)}deg`);
    stage.style.setProperty("--card-ry", `${tilt.y.toFixed(2)}deg`);
    paintSheen(tilt);
    puruViewRef.current = {
      rx: tilt.x,
      ry: tilt.y,
      pullX: pull.x,
      pullY: pull.y,
      grabU: grabRef.current.u,
      grabV: grabRef.current.v,
    };
    const moving = Math.hypot(pull.x, pull.y) > 0.4 || Math.hypot(tilt.x, tilt.y) > 0.08;
    setGestureOn((current) => (current === moving ? current : moving));
  };

  const clearRubber = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.classList.remove("is-pc-rubber");
    stage.style.removeProperty("--pull-x");
    stage.style.removeProperty("--pull-y");
    stage.style.removeProperty("--card-rx");
    stage.style.removeProperty("--card-ry");
    clearSheen(stage);
    puruViewRef.current = { ...PURU_VIEW_REST, grabU: grabRef.current.u, grabV: grabRef.current.v };
    setGestureOn(false);
  };

  const hoverTick = () => {
    hoverFrame.current = 0;
    if (rubberMode.current !== "idle" || phoneRef.current) return;
    const next = thumbFollow(hoverShown.current, hoverTarget.current);
    hoverShown.current = next;
    if (next.x === 0 && next.y === 0 && hoverTarget.current.x === 0 && hoverTarget.current.y === 0) {
      clearRubber();
      return;
    }
    paintRubber({ x: 0, y: 0 }, next);
    if (next.x !== hoverTarget.current.x || next.y !== hoverTarget.current.y) hoverFrame.current = window.requestAnimationFrame(hoverTick);
  };

  const queueHover = () => {
    if (hoverFrame.current) return;
    hoverFrame.current = window.requestAnimationFrame(hoverTick);
  };

  const resumeHover = () => {
    rubberMode.current = "idle";
    const point = lastPointer.current;
    hoverShown.current = THUMB_REST;
    hoverTarget.current = point && overFrame(point) && !motionReduced() ? tiltAtPoint(point) : THUMB_REST;
    queueHover();
  };

  const startSpring = (state: RubberState) => {
    if (phoneRef.current || motionReduced()) {
      resumeHover();
      return;
    }
    rubberMode.current = "spring";
    if (hoverFrame.current) window.cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = 0;
    const gen = rubberGen.current + 1;
    rubberGen.current = gen;
    let current = state;
    let last = performance.now();
    const tick = (now: number) => {
      if (gen !== rubberGen.current) return;
      current = rubberStep(current, now - last);
      last = now;
      if (rubberResting(current)) {
        rubberFrame.current = 0;
        resumeHover();
        return;
      }
      paintRubber({ x: current.x, y: current.y }, { x: current.rx, y: current.ry });
      rubberFrame.current = window.requestAnimationFrame(tick);
    };
    rubberFrame.current = window.requestAnimationFrame(tick);
  };

  const onPcHover = (event: ReactPointerEvent<HTMLElement>) => {
    if (liquidModeRef.current || event.pointerType !== "mouse" || phoneRef.current || puruEditRef.current || vectorEditRef.current || editingRef.current) return;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    if (rubberMode.current !== "idle" || motionReduced()) return;
    hoverTarget.current = overFrame(lastPointer.current) ? tiltAtPoint(lastPointer.current) : THUMB_REST;
    queueHover();
  };

  const onPcHoverLeave = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || phoneRef.current) return;
    lastPointer.current = null;
    if (rubberMode.current !== "idle") return;
    hoverTarget.current = THUMB_REST;
    queueHover();
  };

  const beginPcTilt = (event: ReactPointerEvent<HTMLElement>) => {
    if (liquidModeRef.current) return;
    if (event.button !== 0 || event.pointerType === "touch") return;
    if (puruEditRef.current || vectorEditRef.current || editingRef.current) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, a, input, textarea, .lightbox-nav, .lightbox-bar, .lightbox-info, .lightbox-anim, .lightbox-voice, .puru-edit, .puru-panel, .vector-field, .ink-tools, .phone-menu")) return;
    const onPicture = pictureHit(event.clientX, event.clientY);
    if (!onPicture && !target.closest(".lightbox-tilt, img, video, .lightbox-gesture")) return;
    // Reduced motion skips the tilt, but a still image can still leave as a file.
    const reduced = event.pointerType === "mouse" && motionReduced();
    pcStop.current?.();
    const pointerId = event.pointerId;
    const originX = event.clientX;
    const originY = event.clientY;
    const mouse = event.pointerType === "mouse";
    if (mouse) {
      const box = frameBox();
      if (box) {
        const point = imagePoint(event.clientX, event.clientY, box);
        grabRef.current = { u: point.u, v: point.v };
      }
    }
    const stage = stageRef.current;
    const base = mouse ? { x: hoverShown.current.x, y: hoverShown.current.y } : null;
    const held = mouse
      ? {
          x: Number.parseFloat(stage?.style.getPropertyValue("--pull-x") || "") || 0,
          y: Number.parseFloat(stage?.style.getPropertyValue("--pull-y") || "") || 0,
        }
      : { x: 0, y: 0 };
    if (mouse) {
      rubberGen.current += 1;
      if (rubberFrame.current) window.cancelAnimationFrame(rubberFrame.current);
      rubberFrame.current = 0;
      if (hoverFrame.current) window.cancelAnimationFrame(hoverFrame.current);
      hoverFrame.current = 0;
      rubberMode.current = "idle";
    }
    const trail: { t: number; x: number; y: number }[] = [{ t: event.timeStamp, x: event.clientX, y: event.clientY }];
    let armed = false;
    let moved = 0;
    let pose = { x: held.x, y: held.y, rx: base?.x ?? 0, ry: base?.y ?? 0 };
    const remember = (ev: PointerEvent) => {
      trail.push({ t: ev.timeStamp, x: ev.clientX, y: ev.clientY });
      const cutoff = ev.timeStamp - 160;
      while (trail.length > 2 && trail[0].t < cutoff) trail.shift();
    };
    const mousePose = (dx: number, dy: number) => {
      const pull = rubberOffset(dx, dy);
      const shifted = {
        x: Math.max(-168, Math.min(168, held.x + pull.x)),
        y: Math.max(-168, Math.min(168, held.y + pull.y)),
      };
      const tilt = rubberDragTilt(base ?? { x: 0, y: 0 }, shifted);
      return { x: shifted.x, y: shifted.y, rx: tilt.x, ry: tilt.y };
    };
    let exportLive = false;
    let ended = false;
    const image = target instanceof HTMLImageElement ? target : target.closest("img");
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      remember(ev);
      lastPointer.current = { x: ev.clientX, y: ev.clientY };
      const dx = ev.clientX - originX;
      const dy = ev.clientY - originY;
      const travel = Math.hypot(dx, dy);
      if (travel > moved) moved = travel;
      if (reduced || exportLive) return;
      if (!armed) {
        if (travel < PURU_DRAG_PX) return;
        armed = true;
        suppressClick.current = true;
        if (mouse) rubberMode.current = "pull";
      }
      if (mouse) {
        pose = mousePose(dx, dy);
        paintRubber({ x: pose.x, y: pose.y }, { x: pose.rx, y: pose.ry });
        return;
      }
      followTilt(dx, dy);
    };
    const finishPointer = (stamp: number, poke = false, clientX = 0, clientY = 0) => {
      if (ended) return;
      ended = true;
      stop();
      if (poke && mouse && !exportLive && !armed && pointerIsClick(moved, 0)) {
        const point = pictureHit(clientX, clientY);
        const box = frameBox();
        if (point && box) {
          const mesh = puruDeformWeight(
            puruMarkersRef.current,
            point.u * box.width,
            point.v * box.height,
            box.width,
            box.height,
          );
          if (mesh > 0.04) {
            puruHitsRef.current = enqueueHit(puruHitsRef.current, point.u, point.v, point.minSide);
            suppressClick.current = true;
            setPokeOn(true);
          }
        }
      }
      if (!armed || reduced) {
        if (mouse) rubberMode.current = "idle";
        return;
      }
      const velocity = tiltVelocity(trail, stamp);
      if (mouse) {
        startSpring(rubberRelease({ x: pose.x, y: pose.y, rx: pose.rx, ry: pose.ry }, { x: velocity.vx, y: velocity.vy }));
        return;
      }
      releaseTilt(velocity);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      remember(ev);
      lastPointer.current = { x: ev.clientX, y: ev.clientY };
      if (exportLive) return;
      finishPointer(ev.timeStamp, true, ev.clientX, ev.clientY);
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || ended || exportLive || armed) return;
      // A native file drag cancels the pointer. Once the picture is already
      // pulled, leaving the window must not snap it back — dragend or mouseup does.
      window.setTimeout(() => {
        if (exportLive || ended || armed) return;
        finishPointer(ev.timeStamp);
      }, 240);
    };
    const onMouseUp = (ev: MouseEvent) => {
      if (ev.button !== 0 || ended) return;
      if (!exportLive) {
        finishPointer(ev.timeStamp, true, ev.clientX, ev.clientY);
        return;
      }
      // dragend is the normal end of a file drag, including a drop outside this window.
      // If the browser never sends it, still spring back once the button is up.
      window.setTimeout(() => {
        if (ended) return;
        const velocity = tiltVelocity(trail, performance.now());
        const sprung = { x: pose.x, y: pose.y, rx: pose.rx, ry: pose.ry };
        ended = true;
        stop();
        if (!mouse || reduced) return;
        startSpring(rubberRelease(sprung, { x: velocity.vx, y: velocity.vy }));
      }, 80);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("drag", onDrag);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("dragstart", onDragStart, true);
      stage?.removeAttribute("data-file-drag");
      if (exportLive) {
        exportLive = false;
        endOwnFileDrag();
      }
      if (pcStop.current === stop) pcStop.current = null;
    };
    function dragPoint(ev: DragEvent): { x: number; y: number } | null {
      if (Number.isFinite(ev.clientX) && Number.isFinite(ev.clientY) && (ev.clientX !== 0 || ev.clientY !== 0)) {
        return { x: ev.clientX, y: ev.clientY };
      }
      if (!Number.isFinite(ev.screenX) || !Number.isFinite(ev.screenY) || (ev.screenX === 0 && ev.screenY === 0)) return null;
      return { x: ev.screenX - window.screenX, y: ev.screenY - window.screenY };
    }
    function onDrag(ev: DragEvent) {
      if (reduced || !exportLive || !mouse) return;
      const point = dragPoint(ev);
      if (!point) return;
      lastPointer.current = point;
      pose = mousePose(point.x - originX, point.y - originY);
      paintRubber({ x: pose.x, y: pose.y }, { x: pose.rx, y: pose.ry });
    }
    function onDragStart(ev: DragEvent) {
      const node = ev.target;
      if (!(node instanceof Node) || !stage?.contains(node)) return;
      if (!mouse || phoneRef.current || editingRef.current || puruEditRef.current || vectorEditRef.current) {
        ev.preventDefault();
        return;
      }
      const meta = itemRef.current;
      const transfer = ev.dataTransfer;
      const file = meta && meta.mime.startsWith("image/") ? cachedOriginal(meta.id) : null;
      if (!meta || !file || !transfer) {
        ev.preventDefault();
        return;
      }
      try {
        const shownUrl = image instanceof HTMLImageElement ? image.currentSrc || image.src : "";
        writeOriginalDrag(transfer, meta.id, file, shownUrl);
        if (!reduced) hideNativeDragImage(transfer);
      } catch {
        ev.preventDefault();
        return;
      }
      exportLive = true;
      armed = true;
      suppressClick.current = true;
      beginOwnFileDrag();
      stage?.setAttribute("data-file-drag", "1");
      if (reduced) return;
      rubberMode.current = "pull";
      const point = dragPoint(ev);
      if (point) {
        pose = mousePose(point.x - originX, point.y - originY);
        paintRubber({ x: pose.x, y: pose.y }, { x: pose.rx, y: pose.ry });
      }
    }
    function onDragEnd() {
      if (!exportLive) return;
      const velocity = tiltVelocity(trail, performance.now());
      const sprung = { x: pose.x, y: pose.y, rx: pose.rx, ry: pose.ry };
      ended = true;
      stop();
      if (!mouse || reduced) return;
      startSpring(rubberRelease(sprung, { x: velocity.vx, y: velocity.vy }));
    }
    pcStop.current = stop;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("drag", onDrag);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("dragstart", onDragStart, true);
    const shownItem = itemRef.current;
    const exportable =
      mouse &&
      !!shownItem &&
      shownItem.mime.startsWith("image/") &&
      image instanceof HTMLImageElement &&
      cachedOriginal(shownItem.id) !== null;
    if ((target instanceof HTMLImageElement || target instanceof HTMLVideoElement) && !exportable) event.preventDefault();
  };

  const viewerPhone = () => phoneRef.current || (typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches);

  const echoTouch = (event: ReactPointerEvent<HTMLElement>) =>
    !armed.current || event.timeStamp < openedAt.current;

  const beginPhone = (event: ReactPointerEvent<HTMLElement>) => {
    if (puruEditRef.current) {
      event.stopPropagation();
      return;
    }
    if (event.button !== 0 || event.pointerType !== "touch") return;
    if (echoTouch(event)) {
      event.stopPropagation();
      return;
    }
    const target = event.target as Element | null;
    if (target?.closest("button, a, input, textarea, .lightbox-info, .lightbox-anim, .lightbox-voice, .puru-edit, .puru-panel, .phone-menu, .liquid-stick, .liquid-side")) return;
    const point = localPoint(event);
    const held = stopDragMotion();
    if (abortLeave()) return;
    const place = layout();
    const edges = place ? panEdges(place.base, place.stage, zoomRef.current) : null;
    applyGesture(gestureDown(gestureRef.current, zoomRef.current, event.pointerId, point.x, point.y, held, performance.now(), edges));
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer can still move inside the viewer */
    }
  };

  const movePhone = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") return;
    if (!gestureRef.current.pointers.some((pointer) => pointer.id === event.pointerId)) return;
    const point = localPoint(event);
    applyGesture(gestureMove(gestureRef.current, event.pointerId, point.x, point.y, layout(), performance.now()));
    const gesture = gestureRef.current;
    if (gesture.mode === "pinch" || puruEditRef.current || editingRef.current) {
      flatTilt();
      return;
    }
    if (gesture.mode === "pan" || gesture.mode === "swipe") {
      const pointOn = gesture.pointers[0];
      if (pointOn) followTilt(pointOn.x - gesture.origin.x, pointOn.y - gesture.origin.y);
    }
  };

  const endPhone = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") return;
    const tracked = gestureRef.current.pointers.some((pointer) => pointer.id === event.pointerId);
    applyGesture(gestureUp(gestureRef.current, zoomRef.current, event.pointerId, performance.now(), layout()));
    if (tracked && gestureRef.current.pointers.length === 0) releaseTilt();
  };

  const cancelPhone = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") return;
    if (abortLeave()) {
      flatTilt();
      return;
    }
    const gesture = gestureRef.current;
    const zoom = zoomRef.current;
    const pinching = gesture.mode === "pinch" || gesture.pinched;
    const startedFitted = gesture.pinchFitted === true;
    gestureRef.current = freshGesture();
    suppressClick.current = true;
    if (pinching) {
      flatTilt();
      settlePinch(startedFitted, zoom);
      return;
    }
    releaseTilt();
    stopDragMotion();
    springDrag();
  };

  const closeInfo = () => {
    infoRef.current = false;
    setInfoOpen(false);
    gestureRef.current = freshGesture();
    suppressClick.current = true;
  };

  const onInfoPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    if (event.pointerType !== "touch") return;
    infoDragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      top: event.currentTarget.scrollTop,
    };
  };

  const onInfoPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const drag = infoDragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    infoDragRef.current = null;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const endTop = event.currentTarget.scrollTop;
    if (infoSheetDismiss(dx, dy, drag.top, endTop)) {
      closeInfo();
      return;
    }
    const delta = infoSheetStep(dx, dy, drag.top, endTop);
    if (delta !== 0) step(delta);
  };

  const stopInfoEvent = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  if (shownDrag.x > 0.5) slideDir.current = 1;
  else if (shownDrag.x < -0.5) slideDir.current = -1;
  const url = itemId ? (urls.current.get(itemId) ?? null) : null;
  void urlTick;
  const sliding = incomingSlideVisible(phone, stageBox.width, shownDrag, dragAnim, slideDir.current);
  const incomingItem = !sliding ? null : shownDrag.x > 0 || (shownDrag.x >= 0 && slideDir.current > 0) ? prev : next;
  const incomingUrl = incomingItem ? (urls.current.get(incomingItem.id) ?? null) : null;
  const incomingFrame =
    incomingItem && incomingUrl ? containedFrame(stageBox.width, stageBox.height, incomingItem.width, incomingItem.height, 16) : null;
  const incomingShift = Math.abs(shownDrag.x) > 0.5 ? incomingX(shownDrag.x, stageBox.width) : parkedX(slideDir.current === -1 ? -1 : 1, stageBox.width);
  const scrim = phone ? Math.min(scrimForDrag(shownDrag.y, stageBox.height), scrimForPinch(pinchFades, shown.scale)) : 1;
  const motionOn = (phone || pcTools) && animLive;
  const fitted: CSSProperties = { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" };
  const motionWrap = (gesture: CSSProperties, incoming: boolean, node: ReactNode) =>
    motionOn ? (
      <div className={incoming ? "lightbox-motion is-incoming" : "lightbox-motion"} style={gesture}>
        <div className="lightbox-motion-fx">{node}</div>
      </div>
    ) : (
      node
    );
  const tiltWrap = (gesture: CSSProperties, node: ReactNode, hit = false) => {
    const showSheen = hit && !editing && !puruEdit && !vectorEdit;
    const body = (
      <>
        {node}
        {showSheen ? (
          <div className="lightbox-sheen-clip" aria-hidden="true">
            <div className="lightbox-sheen" />
          </div>
        ) : null}
      </>
    );
    return (
      <div className="lightbox-motion" style={gesture}>
        <div className="lightbox-tilt-scene">
          <div className={hit ? "lightbox-tilt is-hit" : "lightbox-tilt"}>
            <div className="lightbox-shake">{motionOn ? <div className="lightbox-motion-fx">{body}</div> : body}</div>
          </div>
        </div>
      </div>
    );
  };
  const armTrack = (which: "zoom" | "twist", cycle: number) => {
    const now = performance.now();
    const clock = animClock.current;
    const elapsed = (clock.frozen ?? now) - clock.origin;
    clock.carry[which] = carryForPhase(elapsed, cycle, 0);
  };
  const toggleZoom = () => {
    const next = !animZoomRef.current;
    if (next) setAnimHold(false);
    if (next) armTrack("zoom", zoomOptionCycle(animZoomPaceRef.current));
    animZoomRef.current = next;
    setAnimZoom(next);
  };
  const toggleTwist = () => {
    const next = !animTwistRef.current;
    if (next) setAnimHold(false);
    if (next) armTrack("twist", twistCycle(animTwistPaceRef.current));
    animTwistRef.current = next;
    setAnimTwist(next);
  };
  const toggleTilt = (side: AnimTilt) => {
    const next = animTiltRef.current === side ? null : side;
    animTiltRef.current = next;
    setAnimTilt(next);
  };
  const pickKind = (kind: AnimKind) => {
    setAnimHold(false);
    setAnimKind(kind);
  };
  const stopAnimation = () => {
    setAnimHold(false);
    animKindRef.current = null;
    animZoomRef.current = false;
    animTwistRef.current = false;
    animTiltRef.current = null;
    const clock = animClock.current;
    clock.carry.base = 0;
    clock.carry.zoom = 0;
    clock.carry.twist = 0;
    clock.frozen = null;
    clock.running = false;
    setAnimKind(null);
    setAnimZoom(false);
    setAnimTwist(false);
    setAnimTilt(null);
    const stage = stageRef.current;
    if (stage) {
      stage.style.removeProperty("--fx-x");
      stage.style.removeProperty("--fx-y");
      stage.style.removeProperty("--fx-s");
      stage.style.removeProperty("--fx-r");
    }
    puruDriveRef.current = { x: 0, y: 0, scale: 1, t: 0 };
  };
  const chooseSpeed = (next: AnimSpeed) => {
    const now = performance.now();
    const clock = animClock.current;
    const elapsed = (clock.frozen ?? now) - clock.origin;
    const prev = animSpeedRef.current;
    const kind = animKindRef.current;
    if (kind) clock.carry.base = animPhase(elapsed, animationCycle(kind, prev), clock.carry.base);
    if (animZoomRef.current) clock.carry.zoom = animPhase(elapsed, zoomOptionCycle(animZoomPaceRef.current), clock.carry.zoom);
    if (animTwistRef.current) clock.carry.twist = animPhase(elapsed, twistCycle(animTwistPaceRef.current), clock.carry.twist);
    const point = clock.frozen ?? now;
    clock.origin = point;
    if (clock.frozen !== null) clock.frozen = point;
    animSpeedRef.current = next;
    setAnimSpeed(next);
  };
  const chooseOptionPace = (which: "zoom" | "twist", pace: OptionPace) => {
    const now = performance.now();
    const clock = animClock.current;
    const elapsed = (clock.frozen ?? now) - clock.origin;
    const kind = animKindRef.current;
    if (kind) clock.carry.base = animPhase(elapsed, animationCycle(kind, animSpeedRef.current), clock.carry.base);
    if (animZoomRef.current) clock.carry.zoom = animPhase(elapsed, zoomOptionCycle(animZoomPaceRef.current), clock.carry.zoom);
    if (animTwistRef.current) clock.carry.twist = animPhase(elapsed, twistCycle(animTwistPaceRef.current), clock.carry.twist);
    const point = clock.frozen ?? now;
    clock.origin = point;
    if (clock.frozen !== null) clock.frozen = point;
    if (which === "zoom") {
      animZoomPaceRef.current = pace;
      setAnimZoomPace(pace);
      return;
    }
    animTwistPaceRef.current = pace;
    setAnimTwistPace(pace);
  };
  const applyVolume = (percent: number) => {
    const next = Math.round(Math.min(100, Math.max(0, percent)));
    volumeRef.current = next;
    setVolume(next);
    const gain = volumeToGain(next);
    const audio = audioRef.current;
    if (gainRef.current) {
      gainRef.current.gain.value = gain;
      if (audio) audio.volume = 1;
      return;
    }
    if (audio) audio.volume = gain;
  };
  const ensureVoiceGraph = () => {
    const audio = audioRef.current;
    if (!audio) return null;
    if (audioCtxRef.current && voiceBoundRef.current === audio) return audioCtxRef.current;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
      gainRef.current = null;
    }
    const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    try {
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      gainNode.gain.value = volumeToGain(volumeRef.current);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      audio.volume = 1;
      audioCtxRef.current = ctx;
      gainRef.current = gainNode;
      voiceBoundRef.current = audio;
      return ctx;
    } catch {
      return null;
    }
  };
  const playVoice = (id: string) => {
    const audio = audioRef.current;
    const track = VOICE_TRACKS.find((entry) => entry.id === id);
    if (!audio || !track) {
      setVoiceError("この音声は再生できませんでした");
      return;
    }
    if (voiceIdRef.current === id && audio.src && !audio.paused) return;
    setVoiceError(null);
    const switching = voiceIdRef.current !== id;
    voiceIdRef.current = id;
    setVoiceId(id);
    audio.loop = true;
    if (switching) {
      audio.pause();
      audio.src = track.src;
      try {
        audio.currentTime = 0;
      } catch {
        /* the new file starts at the beginning once it loads */
      }
    }
    const ctx = ensureVoiceGraph();
    applyVolume(volumeRef.current);
    applyVoiceRate(audio, voiceRateRef.current);
    void ctx?.resume();
    void audio.play().catch(() => {
      setVoiceError("再生できませんでした。もう一度選んでください");
    });
  };
  const chooseVoiceRate = (rate: VoiceRate) => {
    voiceRateRef.current = rate;
    setVoiceRate(rate);
    setVoiceRateOpen(false);
    const audio = audioRef.current;
    if (!audio) return;
    applyVoiceRate(audio, rate);
  };
  const stopVoice = () => {
    voiceIdRef.current = null;
    setVoiceId(null);
    setVoiceError(null);
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
  };
  const stopTogether = () => {
    setAnimHold(true);
    const stage = stageRef.current;
    puruDriveRef.current = { x: 0, y: 0, scale: 1, t: 0 };
    if (stage) {
      stage.style.removeProperty("--fx-x");
      stage.style.removeProperty("--fx-y");
      stage.style.removeProperty("--fx-s");
      stage.style.removeProperty("--fx-r");
    }
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    vectorHoldRef.current = false;
    const recall = vectorRecallRef.current;
    if (!vectorPlayRef.current) return;
    vectorRecallRef.current = false;
    vectorPlayRef.current = false;
    vectorDriveRef.current = { playing: false, origin: vectorOriginRef.current, markers: vectorMarkersRef.current };
    setVectorPlay(false);
    setVectorShown(vectorShownAfterStop(recall ? "favorite" : "marker", phoneRef.current, vectorMarkersRef.current.length));
  };
  const savePlay = () => {
    if (!item) return;
    flushVectors();
    const had = normalizeImagePlay(item.play) !== null;
    const play = {
      kind: animKindRef.current,
      speed: animSpeedRef.current,
      reverse: animReverseRef.current,
      zoom: animZoomRef.current,
      twist: animTwistRef.current,
      zoomPace: animZoomPaceRef.current,
      twistPace: animTwistPaceRef.current,
      tilt: animTiltRef.current,
      vector: vectorPlayRef.current,
      voiceId: voiceIdRef.current,
      rate: voiceRateRef.current,
      volume: volumeRef.current,
    };
    void saveImagePlay(item.id, play).then((ok) => {
      if (!ok || shownIdRef.current !== item.id) return;
      setPlayNote(had ? "更新しました" : "登録しました");
    });
  };
  const recallPlay = () => {
    if (!item) return;
    const play = normalizeImagePlay(item.play);
    if (!play) {
      setPlayNote("お気に入りは未登録です");
      return;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        /* the next voice starts clean */
      }
    }
    animKindRef.current = play.kind;
    animSpeedRef.current = play.speed;
    animReverseRef.current = play.reverse;
    animZoomRef.current = play.zoom;
    animTwistRef.current = play.twist;
    animZoomPaceRef.current = play.zoomPace;
    animTwistPaceRef.current = play.twistPace;
    animTiltRef.current = play.tilt;
    setAnimHold(false);
    const now = performance.now();
    const clock = animClock.current;
    clock.origin = now;
    clock.frozen = null;
    clock.carry.base = 0;
    clock.carry.zoom = 0;
    clock.carry.twist = 0;
    clock.running = play.kind !== null || play.zoom || play.twist;
    setAnimKind(play.kind);
    setAnimSpeed(play.speed);
    setAnimReverse(play.reverse);
    setAnimZoom(play.zoom);
    setAnimTwist(play.twist);
    setAnimZoomPace(play.zoomPace);
    setAnimTwistPace(play.twistPace);
    setAnimTilt(play.tilt);
    setAnimMenu(false);
    setVoiceMenu(false);
    setVoiceRateOpen(false);
    volumeRef.current = play.volume;
    setVolume(play.volume);
    voiceRateRef.current = play.rate;
    setVoiceRate(play.rate);
    voiceIdRef.current = null;
    setVoiceId(null);
    setVoiceError(null);
    if (play.voiceId && VOICE_TRACKS.some((track) => track.id === play.voiceId)) playVoice(play.voiceId);
    else if (play.voiceId) setVoiceError("この音声は再生できませんでした");
    if (play.vector && vectorMarkersRef.current.length > 0) {
      vectorRecallRef.current = true;
      vectorOriginRef.current = performance.now();
      vectorPlayRef.current = true;
      vectorDriveRef.current = { playing: true, origin: vectorOriginRef.current, markers: vectorMarkersRef.current };
      vectorEditRef.current = false;
      setVectorEdit(false);
      setVectorShown(false);
      setVectorPlay(true);
    } else {
      if (play.vector) setVectorNote("マーカーがありません");
      vectorRecallRef.current = false;
      vectorPlayRef.current = false;
      vectorDriveRef.current = { playing: false, origin: vectorOriginRef.current, markers: vectorMarkersRef.current };
      setVectorPlay(false);
    }
    setPlayNote("呼び出しました");
  };
  const puruFrame = () => {
    const node = document.querySelector(".puru-edit-fx");
    return node instanceof HTMLElement ? node.getBoundingClientRect() : null;
  };
  const vectorSurface = () => {
    const node = document.querySelector(".vector-field") ?? document.querySelector(".lightbox-stage img");
    return node instanceof HTMLElement ? node.getBoundingClientRect() : null;
  };
  const menuCovers = (x: number, y: number) => {
    const nodes = document.querySelectorAll(".puru-panel, .puru-kind-row, .puru-bar-actions, .vector-kind-row, .lightbox-anim, .marker-list");
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const rect = node.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return true;
    }
    return false;
  };
  const flushVectors = () => {
    const id = shownIdRef.current;
    if (!id) return;
    const markers = vectorMarkersRef.current.map((marker) => ({ ...marker }));
    const key = JSON.stringify(markers);
    if (key === vectorSavedRef.current) return;
    vectorSavedRef.current = key;
    void saveImageVectors(id, markers).then((ok) => {
      if (!ok && shownIdRef.current === id && vectorSavedRef.current === key) vectorSavedRef.current = "";
    });
  };
  const closePuru = (keepHold = false) => {
    puruEditRef.current = false;
    puruPointers.current.clear();
    puruPinch.current = null;
    puruMove.current = null;
    puruMouse.current = null;
    puruGhostRef.current = null;
    setPuruGhost(null);
    setPuruEdit(false);
    if (!keepHold && !vectorEditRef.current) resumeVectorHold();
  };
  const pauseVectorForEdit = () => {
    if (!vectorPlayRef.current) return;
    vectorHoldRef.current = true;
    vectorPlayRef.current = false;
    vectorDriveRef.current = { playing: false, origin: vectorOriginRef.current, markers: vectorMarkersRef.current };
    setVectorPlay(false);
  };
  const resumeVectorHold = () => {
    if (!vectorHoldRef.current) return;
    vectorHoldRef.current = false;
    if (phoneRef.current || vectorPlayRef.current || vectorMarkersRef.current.length === 0) return;
    vectorOriginRef.current = performance.now();
    vectorPlayRef.current = true;
    vectorDriveRef.current = { playing: true, origin: vectorOriginRef.current, markers: vectorMarkersRef.current };
    vectorEditRef.current = false;
    setVectorEdit(false);
    setVectorPlay(true);
  };
  const openPuru = () => {
    flushVectors();
    pauseVectorForEdit();
    vectorEditRef.current = false;
    setVectorEdit(false);
    window.cancelAnimationFrame(zoomFrame.current);
    window.clearTimeout(zoomTimer.current);
    window.cancelAnimationFrame(dragFrame.current);
    window.clearTimeout(dragTimer.current);
    zoomRef.current = IDENTITY_ZOOM;
    dragRef.current = DRAG_REST;
    gestureRef.current = freshGesture();
    setZoomAnim(false);
    setDragAnim(false);
    setZoom(IDENTITY_ZOOM);
    setDrag(DRAG_REST);
    const stage = stageRef.current;
    if (stage) {
      stage.style.setProperty("--fx-x", "0px");
      stage.style.setProperty("--fx-y", "0px");
      stage.style.setProperty("--fx-s", "1");
      stage.style.setProperty("--fx-r", "0deg");
    }
    puruDriveRef.current = { x: 0, y: 0, scale: 1, t: 0 };
    puruEditRef.current = true;
    setAnimMenu(false);
    setVoiceMenu(false);
    setVoiceRateOpen(false);
    setHot(null);
    setPuruEdit(true);
  };
  const closeVector = (keepHold = false) => {
    flushVectors();
    vectorEditRef.current = false;
    setVectorEdit(false);
    if (!keepHold && !puruEditRef.current) resumeVectorHold();
  };
  const openVector = () => {
    const wasPlaying = vectorPlayRef.current;
    if (wasPlaying) pauseVectorForEdit();
    if (vectorEditRef.current && !wasPlaying) {
      closeVector();
      return;
    }
    closePuru(true);
    vectorEditRef.current = true;
    if (hoverFrame.current) {
      window.cancelAnimationFrame(hoverFrame.current);
      hoverFrame.current = 0;
    }
    clearRubber();
    window.cancelAnimationFrame(zoomFrame.current);
    window.clearTimeout(zoomTimer.current);
    window.cancelAnimationFrame(dragFrame.current);
    window.clearTimeout(dragTimer.current);
    zoomRef.current = IDENTITY_ZOOM;
    dragRef.current = DRAG_REST;
    gestureRef.current = freshGesture();
    setZoomAnim(false);
    setDragAnim(false);
    setZoom(IDENTITY_ZOOM);
    setDrag(DRAG_REST);
    const stage = stageRef.current;
    if (stage) {
      stage.style.setProperty("--fx-x", "0px");
      stage.style.setProperty("--fx-y", "0px");
      stage.style.setProperty("--fx-s", "1");
      stage.style.setProperty("--fx-r", "0deg");
    }
    setVectorArmed({ kind: "orbit", pace: "normal" });
    setVectorEdit(true);
    setAnimMenu(false);
    setVoiceMenu(false);
    setVoiceRateOpen(false);
    setHot(null);
  };
  const patchVector = (id: number, patch: Partial<Pick<VectorMarker, "u" | "v" | "view" | "angle" | "span">>) => {
    setVectorMarkers((list) => list.map((marker) => (marker.id === id ? { ...marker, ...patch } : marker)));
  };
  const toggleVectorPlay = () => {
    if (!vectorPlayRef.current && vectorMarkersRef.current.length === 0) {
      setVectorNote("マーカーがありません");
      return;
    }
    if (vectorPlayRef.current) {
      vectorHoldRef.current = false;
      const recall = vectorRecallRef.current;
      vectorRecallRef.current = false;
      vectorPlayRef.current = false;
      vectorDriveRef.current = { playing: false, origin: vectorOriginRef.current, markers: vectorMarkersRef.current };
      setVectorPlay(false);
      setVectorShown(vectorShownAfterStop(recall ? "favorite" : "marker", phoneRef.current, vectorMarkersRef.current.length));
      return;
    }
    vectorRecallRef.current = false;
    vectorHoldRef.current = false;
    vectorOriginRef.current = performance.now();
    vectorPlayRef.current = true;
    vectorDriveRef.current = { playing: true, origin: vectorOriginRef.current, markers: vectorMarkersRef.current };
    vectorEditRef.current = false;
    setVectorEdit(false);
    setVectorPlay(true);
  };
  const saveVectors = () => {
    const id = shownIdRef.current;
    if (!id) return;
    const markers = vectorMarkersRef.current.map((marker) => ({ ...marker }));
    void saveImageVectors(id, markers).then((ok) => {
      if (!ok || shownIdRef.current !== id) return;
      vectorSavedRef.current = JSON.stringify(markers);
      setVectorNote("保存しました");
    });
  };
  const onPcPuruDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer can still move inside the photo */
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const hit = puruEditHit(puruMarkersRef.current, puruSelectedRef.current, event.clientX, event.clientY, rect);
    if (hit?.action === "resize") {
      puruMouse.current = { mode: "resize", pointerId: event.pointerId, markerId: hit.id };
      setPuruSelected(hit.id);
      return;
    }
    if (hit?.action === "move") {
      const marker = puruMarkersRef.current.find((entry) => entry.id === hit.id);
      const point = imagePoint(event.clientX, event.clientY, rect);
      puruMouse.current = {
        mode: "move",
        pointerId: event.pointerId,
        markerId: hit.id,
        du: marker ? marker.u - point.u : 0,
        dv: marker ? marker.v - point.v : 0,
        sx: event.clientX,
        sy: event.clientY,
      };
      setPuruSelected(hit.id);
      return;
    }
    setPuruSelected(null);
    puruMouse.current = null;
  };
  const onPcPuruMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = puruMouse.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (drag.mode === "move") {
      if (Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) < 8) return;
      const point = imagePoint(event.clientX, event.clientY, rect);
      const u = clampUnit(point.u + drag.du);
      const v = clampUnit(point.v + drag.dv);
      setPuruMarkers((list) => list.map((marker) => (marker.id === drag.markerId ? { ...marker, u, v } : marker)));
      return;
    }
    const marker = puruMarkersRef.current.find((entry) => entry.id === drag.markerId);
    if (!marker) return;
    const dx = event.clientX - (rect.left + marker.u * rect.width);
    const dy = event.clientY - (rect.top + marker.v * rect.height);
    const view = viewAtRim(Math.hypot(dx, dy), marker.radius, Math.min(rect.width, rect.height));
    setPuruMarkers((list) => list.map((entry) => (entry.id === marker.id ? { ...entry, view } : entry)));
  };
  const onPcPuruUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = puruMouse.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    puruMouse.current = null;
    setPuruGhost(null);
  };
  const onPuruDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (!phoneRef.current && pcToolsRef.current) {
      onPcPuruDown(event);
      return;
    }
    puruPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer can still move inside the photo */
    }
    const fingers = [...puruPointers.current.values()];
    if (fingers.length >= 2 && puruSelectedRef.current !== null) {
      const marker = puruMarkersRef.current.find((entry) => entry.id === puruSelectedRef.current);
      if (marker) {
        puruPinch.current = {
          dist: Math.hypot(fingers[0].x - fingers[1].x, fingers[0].y - fingers[1].y),
          radius: marker.radius,
        };
      }
      puruMove.current = null;
      puruMouse.current = null;
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const hit = puruEditHit(puruMarkersRef.current, puruSelectedRef.current, event.clientX, event.clientY, rect);
    if (hit?.action === "resize") {
      puruMouse.current = { mode: "resize", pointerId: event.pointerId, markerId: hit.id };
      puruMove.current = null;
      setPuruSelected(hit.id);
      return;
    }
    const point = imagePoint(event.clientX, event.clientY, rect);
    const picked = pickMarker(puruMarkersRef.current, point.u, point.v, rect.width, rect.height);
    if (picked === null) {
      puruMove.current = null;
      return;
    }
    const marker = puruMarkersRef.current.find((entry) => entry.id === picked);
    setPuruSelected(picked);
    puruMove.current = {
      id: event.pointerId,
      markerId: picked,
      sx: event.clientX,
      sy: event.clientY,
      du: marker ? marker.u - point.u : 0,
      dv: marker ? marker.v - point.v : 0,
    };
  };
  const onPuruMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!phoneRef.current && pcToolsRef.current) {
      onPcPuruMove(event);
      return;
    }
    if (!puruPointers.current.has(event.pointerId)) return;
    const drag = puruMouse.current;
    if (drag?.mode === "resize" && drag.pointerId === event.pointerId) {
      const rect = event.currentTarget.getBoundingClientRect();
      const marker = puruMarkersRef.current.find((entry) => entry.id === drag.markerId);
      if (!marker) return;
      const dx = event.clientX - (rect.left + marker.u * rect.width);
      const dy = event.clientY - (rect.top + marker.v * rect.height);
      const view = viewAtRim(Math.hypot(dx, dy), marker.radius, Math.min(rect.width, rect.height));
      setPuruMarkers((list) => list.map((entry) => (entry.id === marker.id ? { ...entry, view } : entry)));
      return;
    }
    puruPointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const fingers = [...puruPointers.current.values()];
    if (fingers.length >= 2 && puruPinch.current && puruSelectedRef.current !== null) {
      const dist = Math.hypot(fingers[0].x - fingers[1].x, fingers[0].y - fingers[1].y);
      const radius = pinchRadius(puruPinch.current.radius, puruPinch.current.dist, dist);
      const id = puruSelectedRef.current;
      setPuruMarkers((list) => list.map((marker) => (marker.id === id ? { ...marker, radius } : marker)));
      return;
    }
    const move = puruMove.current;
    if (!move || move.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - move.sx, event.clientY - move.sy) < 8) return;
    const point = imagePoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    const u = clampUnit(point.u + move.du);
    const v = clampUnit(point.v + move.dv);
    setPuruMarkers((list) => list.map((marker) => (marker.id === move.markerId ? { ...marker, u, v } : marker)));
  };
  const endPuruPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!phoneRef.current && pcToolsRef.current) {
      onPcPuruUp(event);
      return;
    }
    puruPointers.current.delete(event.pointerId);
    if (puruMouse.current?.pointerId === event.pointerId) puruMouse.current = null;
    if (puruMove.current?.id === event.pointerId) puruMove.current = null;
    if (puruPointers.current.size < 2) puruPinch.current = null;
  };
  const onKindDown = (kind: PuruKind, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    puruGhostRef.current = { kind, id: event.pointerId, x: event.clientX, y: event.clientY };
    setPuruGhost(null);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the drag can still finish on pointerup */
    }
  };
  const onKindMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const ghost = puruGhostRef.current;
    if (!ghost || ghost.id !== event.pointerId) return;
    event.stopPropagation();
    if (Math.hypot(event.clientX - ghost.x, event.clientY - ghost.y) < 8) return;
    const rect = puruFrame();
    const point = rect ? imagePoint(event.clientX, event.clientY, rect) : { inside: false };
    const size = rect ? PURU_RADIUS * Math.min(rect.width, rect.height) * 2 : 96;
    setPuruGhost({ kind: ghost.kind, x: event.clientX, y: event.clientY, inside: point.inside && !menuCovers(event.clientX, event.clientY), size });
  };
  const onKindUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const ghost = puruGhostRef.current;
    if (!ghost || ghost.id !== event.pointerId) return;
    event.stopPropagation();
    puruGhostRef.current = null;
    setPuruGhost(null);
    const dragged = Math.hypot(event.clientX - ghost.x, event.clientY - ghost.y) >= 8;
    const selected = puruSelectedRef.current;
    if (!dragged && selected !== null) {
      setPuruMarkers((list) => list.map((marker) => (marker.id === selected ? { ...marker, kind: ghost.kind } : marker)));
      return;
    }
    const rect = puruFrame();
    if (!rect || menuCovers(event.clientX, event.clientY)) return;
    const point = imagePoint(event.clientX, event.clientY, rect);
    if (!point.inside) return;
    let placed = 0;
    setPuruMarkers((list) => {
      placed = nextPuruId(list);
      return [...list, { id: placed, kind: ghost.kind, u: point.u, v: point.v, radius: PURU_RADIUS, view: 1 }];
    });
    setPuruSelected(placed);
  };
  const onKindCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (puruGhostRef.current?.id !== event.pointerId) return;
    puruGhostRef.current = null;
    setPuruGhost(null);
  };
  const onVectorKindDown = (kind: VectorKind, pace: VectorPace, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    vectorGhostRef.current = { kind, pace, id: event.pointerId, x: event.clientX, y: event.clientY };
    setVectorGhost(null);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the drag can still finish on pointerup */
    }
  };
  const onVectorKindMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const ghost = vectorGhostRef.current;
    if (!ghost || ghost.id !== event.pointerId) return;
    event.stopPropagation();
    if (Math.hypot(event.clientX - ghost.x, event.clientY - ghost.y) < 8) return;
    const rect = vectorSurface();
    const point = rect ? imagePoint(event.clientX, event.clientY, rect) : { inside: false };
    const size = rect ? PURU_RADIUS * Math.min(rect.width, rect.height) * 2 : 96;
    setVectorGhost({
      kind: ghost.kind,
      pace: ghost.pace,
      x: event.clientX,
      y: event.clientY,
      inside: point.inside && !menuCovers(event.clientX, event.clientY),
      size,
    });
  };
  const onVectorKindUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const ghost = vectorGhostRef.current;
    if (!ghost || ghost.id !== event.pointerId) return;
    event.stopPropagation();
    vectorGhostRef.current = null;
    setVectorGhost(null);
    const dragged = Math.hypot(event.clientX - ghost.x, event.clientY - ghost.y) >= 8;
    setVectorArmed({ kind: ghost.kind, pace: ghost.pace });
    if (!dragged) {
      const selected = vectorSelected;
      if (selected !== null) {
        setVectorMarkers((list) => list.map((marker) => (marker.id === selected ? retargetVector(marker, ghost.kind, ghost.pace) : marker)));
      }
      return;
    }
    const rect = vectorSurface();
    if (!rect || menuCovers(event.clientX, event.clientY)) return;
    const point = imagePoint(event.clientX, event.clientY, rect);
    if (!point.inside) return;
    const placed = nextVectorId(vectorMarkersRef.current);
    const marker = { id: placed, kind: ghost.kind, pace: ghost.pace, u: point.u, v: point.v, radius: PURU_RADIUS, view: 1, angle: 0, span: 1 };
    vectorMarkersRef.current = [...vectorMarkersRef.current, marker];
    setVectorMarkers(vectorMarkersRef.current.map((entry) => ({ ...entry })));
    setVectorSelected(placed);
  };
  const onVectorKindCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (vectorGhostRef.current?.id !== event.pointerId) return;
    vectorGhostRef.current = null;
    setVectorGhost(null);
  };
  const puruAvailable = !phone && pcTools && !!item && !item.animated;
  const puruLive = (phone || pcTools) && !!item && !item.animated && puruMarkers.length > 0;
  const pokeMesh = !phone && !!item && !item.animated && item.mime.startsWith("image/");
  const meshOn = puruLive || pokeMesh;
  const handMesh = !phone && puruMarkers.length > 0 && (gestureOn || pokeOn);
  const meshShown = (puruLive && puruDrawn) || (handMesh && meshReady);
  const clickCover = pokeOn && meshReady && !meshShown;
  const selectedMarker = puruMarkers.find((marker) => marker.id === puruSelected) ?? null;
  const optionPaces = [
    ["slow", "遅"],
    ["normal", "普通"],
    ["fast", "速"],
  ] as const;
  const optionRow = (which: "zoom" | "twist") => {
    const on = which === "zoom" ? animZoom : animTwist;
    const pace = which === "zoom" ? animZoomPace : animTwistPace;
    const label = which === "zoom" ? "ズーム" : "ツイスト";
    return (
      <div className="lightbox-anim-switch">
        <p className="lightbox-anim-label">{label}</p>
        <div className="lightbox-option-paces" role="radiogroup" aria-label={`${label}の速度`}>
          {optionPaces.map(([id, name]) => (
            <button key={id} type="button" role="radio" className={pace === id ? "is-on" : ""} aria-checked={pace === id} onClick={() => chooseOptionPace(which, id)}>
              {name}
            </button>
          ))}
        </div>
        <button
          type="button"
          role="switch"
          className={on ? "lightbox-switch is-on" : "lightbox-switch"}
          aria-checked={on}
          aria-label={on ? `${label}をオフ` : `${label}をオン`}
          onClick={which === "zoom" ? toggleZoom : toggleTwist}
        >
          <span className="lightbox-switch-knob" />
        </button>
      </div>
    );
  };
  const liquidImage = !!item && !item.animated && item.mime.startsWith("image/");
  const liquidListen = liquidMode && !phone && liquidImage && !puruEdit && !vectorEdit && !editing;
  const toggleLiquid = () => {
    const next = !liquidModeRef.current;
    liquidModeRef.current = next;
    if (!next) liquidRef.current?.stop();
    setLiquidMode(next);
  };
  const placeKnob = (x: number, y: number) => {
    const node = stickKnobRef.current;
    if (node) node.style.transform = `translate(${x}px, ${y}px)`;
  };
  const aimStick = (clientX: number, clientY: number, spray: boolean) => {
    const stick = stickRef.current;
    if (!stick) return;
    const knob = stickKnob(clientX - stick.cx, clientY - stick.cy, stick.r);
    placeKnob(knob.x, knob.y);
    const aim = stickAim(knob.nx, knob.ny);
    liquidRef.current?.aim(aim.u, aim.v, spray);
  };
  const onStickDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const box = event.currentTarget.getBoundingClientRect();
    stickRef.current = { id: event.pointerId, cx: box.left + box.width / 2, cy: box.top + box.height / 2, r: box.width / 2 };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the finger can still move inside the circle */
    }
    event.currentTarget.classList.add("is-firing");
    aimStick(event.clientX, event.clientY, true);
  };
  const onStickMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stickRef.current?.id !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    aimStick(event.clientX, event.clientY, true);
  };
  const onStickUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (stickRef.current?.id !== event.pointerId) return;
    event.stopPropagation();
    stickRef.current = null;
    placeKnob(0, 0);
    event.currentTarget.classList.remove("is-firing");
    liquidRef.current?.stop();
  };
  const stopBothButton = (
    <Button
      variant="quiet"
      className="lightbox-fav"
      aria-label="アニメーションと音声を停止"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        stopTogether();
      }}
    >
      ■
    </Button>
  );
  if (contained && !container) return null;

  return (
    <Dialog.Root
      open={item !== null}
      modal={!contained}
      onOpenChange={(open) => {
        if (!open && (puruEditRef.current || vectorEditRef.current)) return;
        if (!open) onClose();
      }}
    >
      <Dialog.Portal container={contained ? container ?? undefined : undefined}>
        {contained ? (
          <div
            className="lightbox-overlay"
            onPointerDown={(event) => {
              event.stopPropagation();
              onClose();
            }}
          />
        ) : (
        <Dialog.Overlay
          className="lightbox-overlay"
          style={
            phone
              ? {
                  opacity: scrim * scrimIn,
                  animation: "none",
                  transition: dragAnim
                    ? `opacity ${SWIPE_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
                    : scrimArm
                      ? `opacity ${THUMB_ZOOM_PHONE_MS}ms ${THUMB_ZOOM_EASE}`
                      : "none",
                }
              : undefined
          }
        />
        )}
        <Dialog.Content
          ref={contentRef}
          className={[phone ? "lightbox-content is-phone" : "lightbox-content", editing ? "is-inking" : "", contained ? "is-docked" : "", puruEdit ? "is-puru-open" : ""].filter(Boolean).join(" ")}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (contained) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (contained) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            if (contained) event.preventDefault();
          }}
          onPointerDown={(event) => {
            if (editing && event.target instanceof Element && event.target.closest(".ink-layer, .ink-select-host, .ink-tools, .ink-dock")) return;
            if (viewerPhone()) beginPhone(event);
          }}
          onPointerMove={(event) => {
            if (viewerPhone()) movePhone(event);
          }}
          onPointerUp={(event) => {
            if (viewerPhone()) endPhone(event);
          }}
          onPointerCancel={(event) => {
            if (viewerPhone()) cancelPhone(event);
          }}
          onKeyDown={(event) => {
            if (puruEditRef.current || vectorEditRef.current) return;
            if (event.key === "ArrowRight") step(1);
            if (event.key === "ArrowLeft") step(-1);
          }}
        >
          {item ? (
            <>
              <audio
                ref={audioRef}
                className="lightbox-voice-audio"
                preload="none"
                loop
                onEnded={() => {
                  const audio = audioRef.current;
                  if (!audio || !voiceIdRef.current || audio.loop) return;
                  audio.currentTime = 0;
                  void audio.play().catch(() => {
                    setVoiceError("再生できませんでした。もう一度選んでください");
                  });
                }}
                onError={() => {
                  if (!voiceIdRef.current) return;
                  setVoiceError("この音声は再生できませんでした");
                }}
              />
              {phone ? (
                <>
                  <Dialog.Title className="sr-only">{item.name}</Dialog.Title>
                  <Dialog.Description className="sr-only">
                    {item.width} × {item.height}
                    {total > 1 && index >= 0 ? ` ${index + 1}/${total}` : ""}
                  </Dialog.Description>
                </>
              ) : (
                <div className="lightbox-bar">
                  <div className="min-w-0">
                    <Dialog.Title className="sr-only">{item.name}</Dialog.Title>
                    {item.memo ? <MemoLine text={item.memo} /> : null}
                    <Dialog.Description className="text-sm text-paper/80 tabular-nums">
                      {item.width} × {item.height}
                      {total > 1 && index >= 0 ? ` · ${index + 1}/${total}` : ""}
                    </Dialog.Description>
                  </div>
                  {puruEdit && selectedMarker ? (
                    <div className="puru-bar-actions">
                      <label className="puru-range" style={{ ["--puru" as string]: puruKindFace(selectedMarker.kind).color }}>
                        <span>大きさ</span>
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={1}
                          value={Math.round(markerView(selectedMarker) * 100)}
                          aria-label="マーカーの大きさ"
                          onPointerDown={(event) => event.stopPropagation()}
                          onChange={(event) => {
                            const id = selectedMarker.id;
                            const view = clampView(Number(event.target.value) / 100);
                            setPuruMarkers((list) => list.map((marker) => (marker.id === id ? { ...marker, view } : marker)));
                          }}
                        />
                        <span className="tabular-nums">{Math.round(markerView(selectedMarker) * 100)}%</span>
                      </label>
                    </div>
                  ) : null}
                  <Dialog.Close asChild>
                    <Button variant="quiet">閉じる</Button>
                  </Dialog.Close>
                </div>
              )}
              <div
                ref={bindStage}
                className="lightbox-stage"
                onPointerDown={(event) => {
                  if (editing) return;
                  suppressClick.current = false;
                  if (viewerPhone()) return;
                  beginSwipe(event);
                  beginPcTilt(event);
                }}
                onPointerMove={(event) => {
                  if (viewerPhone()) return;
                  onPcHover(event);
                }}
                onPointerLeave={(event) => {
                  if (viewerPhone()) return;
                  onPcHoverLeave(event);
                }}
                onPointerUp={(event) => {
                  if (viewerPhone()) return;
                  endSwipe(event);
                }}
                onPointerCancel={() => {
                  if (viewerPhone()) return;
                  swipeRef.current = null;
                }}
                onClick={(event) => {
                  if (!armed.current || event.timeStamp < openedAt.current) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                  }
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    event.preventDefault();
                    return;
                  }
                  if (puruEditRef.current || vectorEditRef.current) return;
                  if (event.target === event.currentTarget) onClose();
                }}
              >
                {!phone && markerMode ? (
                  <aside
                    className="marker-list"
                    aria-label={puruEdit ? "ぷるぷるマーカー一覧" : "ベクトルマーカー一覧"}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerMove={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onPointerCancel={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    <p className="marker-list-title">{puruEdit ? "ぷるぷる" : "ベクトル"}</p>
                    {(puruEdit ? puruListEntries(puruMarkers) : vectorListEntries(vectorMarkers)).length === 0 ? (
                      <p className="marker-list-empty">まだありません</p>
                    ) : (
                      <ol>
                        {(puruEdit ? puruListEntries(puruMarkers) : vectorListEntries(vectorMarkers)).map((entry, index) => {
                          const selected = puruEdit ? entry.id === puruSelected : entry.id === vectorSelected;
                          return (
                            <li key={`${entry.group}-${entry.id}`}>
                              <button
                                type="button"
                                className={selected ? "is-on" : ""}
                                aria-pressed={selected}
                                aria-label={`${index + 1} ${entry.group} ${entry.name}${entry.pace ? ` ${entry.pace}` : ""}`}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (puruEdit) {
                                    setPuruSelected(entry.id);
                                    return;
                                  }
                                  setVectorSelected(entry.id);
                                  const marker = vectorMarkersRef.current.find((stored) => stored.id === entry.id);
                                  if (marker) setVectorArmed({ kind: marker.kind, pace: marker.pace });
                                }}
                              >
                                <span className="marker-list-index">{index + 1}</span>
                                <span className="marker-list-group">{entry.group}</span>
                                <span className="marker-list-name">{entry.name}</span>
                                {entry.pace ? <span className="marker-list-pace">{entry.pace}</span> : null}
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </aside>
                ) : null}
                {incomingFrame && incomingUrl && incomingItem
                  ? motionWrap(
                      mediaStyle(incomingFrame, IDENTITY_ZOOM, true, false, { x: incomingShift, y: 0 }, dragAnim),
                      true,
                      incomingItem.mime.startsWith("video/") ? (
                        <video
                          className="lightbox-incoming"
                          src={incomingUrl}
                          muted
                          playsInline
                          style={
                            motionOn
                              ? fitted
                              : mediaStyle(incomingFrame, IDENTITY_ZOOM, true, false, { x: incomingShift, y: 0 }, dragAnim)
                          }
                        />
                      ) : (
                        <img
                          className="lightbox-incoming"
                          src={incomingUrl}
                          alt=""
                          draggable={false}
                          style={
                            motionOn
                              ? fitted
                              : mediaStyle(incomingFrame, IDENTITY_ZOOM, true, false, { x: incomingShift, y: 0 }, dragAnim)
                          }
                        />
                      ),
                    )
                  : null}
                {url && item.mime.startsWith("video/") ? (
                  frame ? (
                    tiltWrap(
                      mediaStyle(frame, shown, phone, zoomAnim && sameImage, phone ? shownDrag : DRAG_REST, dragAnim && sameImage, photoOpacity),
                      <video
                        src={url}
                        muted
                        loop
                        autoPlay
                        playsInline
                        ref={bindMedia}
                        style={fitted}
                      />,
                      true,
                    )
                  ) : (
                    <video src={url} muted loop autoPlay playsInline ref={bindMedia} />
                  )
                ) : url ? (
                  frame ? (
                    tiltWrap(
                      mediaStyle(frame, shown, phone, zoomAnim && sameImage, phone ? shownDrag : DRAG_REST, dragAnim && sameImage, photoOpacity),
                      <>
                        <img
                          ref={bindMedia}
                          src={url}
                          alt={item.name}
                          draggable={!phone && item.mime.startsWith("image/")}
                          className={meshShown ? "puru-source" : clickCover ? "puru-click-source" : undefined}
                          style={fitted}
                        />
                        {meshOn ? (
                          <PuruMesh
                            sourceRef={mediaRef}
                            width={frame.width}
                            height={frame.height}
                            markersRef={puruMarkersRef}
                            driveRef={puruDriveRef}
                            viewRef={!phone && puruMarkers.length > 0 ? puruViewRef : undefined}
                            impulseRef={phone ? undefined : puruHitsRef}
                            vectorRef={vectorDriveRef}
                            onImpulse={setPokeOn}
                            onReady={(ok) => {
                              setPuruDrawn(ok);
                              setMeshReady(ok);
                            }}
                            style={{ ...fitted, opacity: puruLive || handMesh ? 1 : 0 }}
                          />
                        ) : null}
                        {!phone && frame && (vectorEdit || vectorShown) && !vectorPlay ? (
                          <VectorField
                            markers={vectorMarkers}
                            selectedId={vectorSelected}
                            interactive={vectorEdit}
                            width={frame.width}
                            height={frame.height}
                            onSelect={(id) => {
                              setVectorSelected(id);
                              const marker = vectorMarkersRef.current.find((entry) => entry.id === id);
                              if (marker) setVectorArmed({ kind: marker.kind, pace: marker.pace });
                            }}
                            onPatch={patchVector}
                          />
                        ) : null}
                        {liquidImage ? (
                          <LiquidLayer ref={liquidRef} width={frame.width} height={frame.height} phone={phone} listening={liquidListen} onFree={setLiquidFree} />
                        ) : null}
                      </>,
                      true,
                    )
                  ) : (
                    <img ref={bindMedia} src={url} alt={item.name} draggable={!phone && item.mime.startsWith("image/")} />
                  )
                ) : (
                  <p className="text-sm text-paper">{failed ? "プレビューを開けませんでした。" : "読み込み中"}</p>
                )}
                {frame && item && !item.animated
                  ? tiltWrap(
                      mediaStyle(frame, shown, phone, zoomAnim && sameImage, phone ? shownDrag : DRAG_REST, dragAnim && sameImage),
                      <ImageInk
                        imageId={item.id}
                        pixelWidth={Math.max(1, item.width)}
                        pixelHeight={Math.max(1, item.height)}
                        live={editing}
                        shown={inkShown || editing}
                        toolsRoot={inkDock}
                        style={fitted}
                      />,
                    )
                  : null}
                {motionOn && frame ? <div className="lightbox-gesture" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }} /> : null}
                {puruEdit && puruAvailable && frame ? (
                  <div
                    className="puru-edit"
                    style={mediaStyle(frame, shown, phone, zoomAnim && sameImage, phone ? shownDrag : DRAG_REST, dragAnim && sameImage)}
                  >
                    <div
                      className={phone ? "puru-edit-fx" : "puru-edit-fx is-pc"}
                      onPointerDown={onPuruDown}
                      onPointerMove={onPuruMove}
                      onPointerUp={endPuruPointer}
                      onPointerCancel={endPuruPointer}
                      onWheel={(event) => {
                        if (phone) return;
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                    >
                      {puruMarkers.map((marker) => {
                        const kind = puruKindFace(marker.kind, phone);
                        const still = marker.kind === "still";
                        const diameter = marker.radius * markerView(marker) * Math.min(frame.width, frame.height) * 2;
                        return (
                          <div
                            key={marker.id}
                            className={["puru-marker", marker.id === puruSelected ? "is-selected" : "", still ? "is-still" : ""].filter(Boolean).join(" ")}
                            style={{
                              left: `${marker.u * 100}%`,
                              top: `${marker.v * 100}%`,
                              width: diameter,
                              height: diameter,
                              ["--puru" as string]: kind.color,
                            }}
                          >
                            <span
                              className="puru-halo"
                              style={{
                                width: `${puruReach(marker.kind) * 100}%`,
                                height: `${puruReach(marker.kind) * 100}%`,
                                background: puruHaloBackground(kind.color, marker.kind),
                              }}
                            />
                            <span className="puru-marker-dot">{kind.short}</span>
                            {marker.id === puruSelected ? (
                              <>
                                <span className="puru-handle is-n" />
                                <span className="puru-handle is-e" />
                                <span className="puru-handle is-s" />
                                <span className="puru-handle is-w" />
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {frame && !editing && !markerMode ? (
                  <div className="lightbox-hit" style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
                    <button
                      type="button"
                      className={hot === "prev" ? "lightbox-edge is-prev is-hot" : "lightbox-edge is-prev"}
                      aria-label="前の画像"
                      onPointerEnter={(event) => {
                        if (event.pointerType === "mouse" && canPrev) setHot("prev");
                      }}
                      onPointerLeave={() => setHot((current) => (current === "prev" ? null : current))}
                      onClick={() => step(-1)}
                    >
                      <span className="edge-veil" aria-hidden="true">
                        <ChevronLeft />
                      </span>
                    </button>
                    <button
                      type="button"
                      className={hot === "next" ? "lightbox-edge is-next is-hot" : "lightbox-edge is-next"}
                      aria-label="次の画像"
                      onPointerEnter={(event) => {
                        if (event.pointerType === "mouse" && canNext) setHot("next");
                      }}
                      onPointerLeave={() => setHot((current) => (current === "next" ? null : current))}
                      onClick={() => step(1)}
                    >
                      <span className="edge-veil" aria-hidden="true">
                        <ChevronRight />
                      </span>
                    </button>
                  </div>
                ) : null}
                {phone && infoOpen ? (
                  <section
                    className="lightbox-info"
                    aria-label="画像情報"
                    onPointerDown={onInfoPointerDown}
                    onPointerMove={stopInfoEvent}
                    onPointerUp={onInfoPointerUp}
                    onPointerCancel={(event) => {
                      stopInfoEvent(event);
                      infoDragRef.current = null;
                    }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {item.memo ? <MemoLine text={item.memo} /> : null}
                    <p className="lightbox-info-label">タグ</p>
                    {tags.length > 0 ? (
                      <div className="lightbox-info-tags">
                        {tags.map((tag) => (
                          <span key={tag.id} className="shot-tag" style={{ background: tag.color }}>
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="lightbox-info-empty">タグなし</p>
                    )}
                  </section>
                ) : null}
              </div>
              {editing ? <div ref={setInkDock} className="ink-dock" /> : null}
              {phone ? (
                <div className="lightbox-nav is-phone-dock phone-menu" onPointerDown={(event) => event.stopPropagation()}>
                  {liquidMode && liquidImage ? (
                    <div className="phone-dock-row is-liquid" role="toolbar" aria-label="液体演出">
                      <Button
                        variant="quiet"
                        className="lightbox-fav is-liquid is-on"
                        aria-label="液体演出を終了"
                        aria-pressed={true}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleLiquid();
                        }}
                      >
                        <Droplet aria-hidden="true" fill="currentColor" />
                      </Button>
                      <Button
                        variant="quiet"
                        className="liquid-reset"
                        aria-label="液体をすべて消す"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          liquidRef.current?.clear();
                        }}
                      >
                        リセット
                      </Button>
                      <div className="liquid-stick">
                        <div
                          className="liquid-stick-base"
                          onPointerDown={onStickDown}
                          onPointerMove={onStickMove}
                          onPointerUp={onStickUp}
                          onPointerCancel={onStickUp}
                        >
                          <span className="liquid-stick-core" />
                          <span ref={stickKnobRef} className="liquid-stick-knob" />
                        </div>
                      </div>
                      <div className="liquid-side">
                        <div
                          className={liquidFree > 0 ? "liquid-gauge" : "liquid-gauge is-empty"}
                          role="meter"
                          aria-label="発射可能量"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(liquidFree * 100)}
                        >
                          <span style={{ width: `${Math.round(liquidFree * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ) : phonePlay ? (
                    <div className="phone-dock-row is-anim" role="toolbar" aria-label="画像アニメーション">
                      {stopBothButton}
                      <span className="lightbox-anim-anchor is-anim">
                        <Button
                          variant="quiet"
                          className={animLive ? "lightbox-fav is-play is-on" : "lightbox-fav is-play"}
                          aria-label="画像アニメーション"
                          aria-haspopup="dialog"
                          aria-expanded={animMenu}
                          aria-pressed={animLive}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => {
                            setVoiceMenu(false);
                            setVoiceRateOpen(false);
                            setSensorMenu(false);
                            setShakeMenu(false);
                            setAnimMenu((open) => !open);
                          }}
                        >
                          <Play aria-hidden="true" fill={animLive ? "currentColor" : "none"} />
                        </Button>
                        {animMenu ? (
                          <div className="lightbox-anim" role="dialog" aria-label="画像アニメーション" onPointerDown={(event) => event.stopPropagation()}>
                            <p className="lightbox-anim-title">画像アニメーション</p>
                            <button type="button" className={animLive ? "" : "is-on"} aria-pressed={!animLive} onClick={stopAnimation}>
                              停止
                            </button>
                            <p className="lightbox-anim-label">横揺れ</p>
                            <div className="lightbox-anim-row">
                              <button type="button" className={animKind === "swayX" ? "is-on" : ""} aria-pressed={animKind === "swayX"} onClick={() => pickKind("swayX")}>
                                ゆるやか
                              </button>
                              <button type="button" className={animKind === "hitX" ? "is-on" : ""} aria-pressed={animKind === "hitX"} onClick={() => pickKind("hitX")}>
                                打ち付け
                              </button>
                            </div>
                            <p className="lightbox-anim-label">縦揺れ</p>
                            <div className="lightbox-anim-row">
                              <button type="button" className={animKind === "swayY" ? "is-on" : ""} aria-pressed={animKind === "swayY"} onClick={() => pickKind("swayY")}>
                                ゆるやか
                              </button>
                              <button type="button" className={animKind === "hitY" ? "is-on" : ""} aria-pressed={animKind === "hitY"} onClick={() => pickKind("hitY")}>
                                打ち付け
                              </button>
                            </div>
                            <p className="lightbox-anim-label">そのほか</p>
                            <div className="lightbox-anim-row">
                              <button type="button" className={animKind === "orbit" ? "is-on" : ""} aria-pressed={animKind === "orbit"} onClick={() => pickKind("orbit")}>
                                円運動
                              </button>
                              <button type="button" className={animKind === "buzz" ? "is-on" : ""} aria-pressed={animKind === "buzz"} onClick={() => pickKind("buzz")}>
                                通知バイブレーション
                              </button>
                            </div>
                            <p className="lightbox-anim-label">追加オプション</p>
                            <div className="lightbox-anim-options">
                              {optionRow("zoom")}
                              {optionRow("twist")}
                              <div className="lightbox-anim-switch">
                                <p className="lightbox-anim-label">右45度</p>
                                <button type="button" role="switch" className={animTilt === "right" ? "lightbox-switch is-on" : "lightbox-switch"} aria-checked={animTilt === "right"} aria-label={animTilt === "right" ? "右45度をオフ" : "右45度をオン"} onClick={() => toggleTilt("right")}>
                                  <span className="lightbox-switch-knob" />
                                </button>
                              </div>
                              <div className="lightbox-anim-switch">
                                <p className="lightbox-anim-label">左45度</p>
                                <button type="button" role="switch" className={animTilt === "left" ? "lightbox-switch is-on" : "lightbox-switch"} aria-checked={animTilt === "left"} aria-label={animTilt === "left" ? "左45度をオフ" : "左45度をオン"} onClick={() => toggleTilt("left")}>
                                  <span className="lightbox-switch-knob" />
                                </button>
                              </div>
                            </div>
                            <div className="lightbox-anim-extra">
                              <div className="lightbox-anim-switch">
                                <p className="lightbox-anim-label">速度</p>
                                <span>反転</span>
                                <button type="button" role="switch" className={animReverse ? "lightbox-switch is-on" : "lightbox-switch"} aria-checked={animReverse} aria-label={animReverse ? "反転をオフ" : "反転をオン"} onClick={() => { animReverseRef.current = !animReverseRef.current; setAnimReverse(animReverseRef.current); }}>
                                  <span className="lightbox-switch-knob" />
                                </button>
                              </div>
                              <div className="lightbox-anim-speeds">
                                {(
                                  [
                                    ["slow", "遅い"],
                                    ["normal", "普通"],
                                    ["fast", "速い"],
                                    ["rapid", "高速"],
                                    ["ultra", "超高速"],
                                  ] as const
                                ).map(([id, label]) => (
                                  <button key={id} type="button" className={animSpeed === id ? "is-on" : ""} aria-pressed={animSpeed === id} onClick={() => chooseSpeed(id)}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </span>
                      <span className="lightbox-anim-anchor is-voice">
                        <Button
                          variant="quiet"
                          className={voiceId ? "lightbox-fav is-voice is-on" : "lightbox-fav is-voice"}
                          aria-label="音声再生"
                          aria-haspopup="dialog"
                          aria-expanded={voiceMenu}
                          aria-pressed={voiceId !== null}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => {
                            setAnimMenu(false);
                            setSensorMenu(false);
                            setShakeMenu(false);
                            setVoiceMenu((open) => {
                              if (open) setVoiceRateOpen(false);
                              return !open;
                            });
                          }}
                        >
                          {volume === 0 ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
                        </Button>
                        {voiceMenu ? (
                          <div className="lightbox-anim lightbox-voice" role="dialog" aria-label="音声再生" onPointerDown={(event) => event.stopPropagation()}>
                            <p className="lightbox-anim-title">音声再生</p>
                            {VOICE_TRACKS.length === 0 ? (
                              <p className="lightbox-voice-empty">音声はまだありません</p>
                            ) : (
                              <>
                                <button type="button" className={voiceId === null ? "is-on" : ""} aria-pressed={voiceId === null} onClick={stopVoice}>
                                  停止
                                </button>
                                <div className="lightbox-voice-list">
                                  {VOICE_TRACKS.map((track) => (
                                    <button key={track.id} type="button" className={voiceId === track.id ? "is-on" : ""} aria-pressed={voiceId === track.id} onClick={() => playVoice(track.id)}>
                                      {track.label}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                            <div className="lightbox-voice-rate">
                              <p className="lightbox-anim-label">再生速度</p>
                              <button type="button" aria-label="再生速度" aria-haspopup="listbox" aria-expanded={voiceRateOpen} onClick={() => setVoiceRateOpen((open) => !open)}>
                                {voiceRateLabel(voiceRate)}
                              </button>
                              {voiceRateOpen ? (
                                <div className="lightbox-voice-rates" role="listbox" aria-label="再生速度">
                                  {VOICE_RATES.map((rate) => (
                                    <button key={rate} type="button" role="option" className={voiceRate === rate ? "is-on" : ""} aria-selected={voiceRate === rate} onClick={() => chooseVoiceRate(rate)}>
                                      {voiceRateLabel(rate)}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <label className="lightbox-voice-volume">
                              <span>音量</span>
                              <input type="range" min={0} max={100} step={1} value={volume} aria-label="音量" onChange={(event) => applyVolume(Number(event.target.value))} />
                              <span className="tabular-nums">{volume}%</span>
                            </label>
                            {voiceError ? <p className="lightbox-voice-error">{voiceError}</p> : null}
                          </div>
                        ) : null}
                      </span>
                      <Button
                        variant="quiet"
                        className={normalizeImagePlay(item.play) ? "lightbox-fav is-play-saved" : "lightbox-fav"}
                        aria-label="アニメーションと音声をお気に入り登録"
                        aria-pressed={normalizeImagePlay(item.play) !== null}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={savePlay}
                      >
                        <Star aria-hidden="true" fill={normalizeImagePlay(item.play) ? "currentColor" : "none"} />
                      </Button>
                      <span className="lightbox-play-pair">
                        <Button
                          variant="quiet"
                          className="lightbox-fav"
                          aria-label="お気に入りのアニメーションと音声を呼び出す"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={recallPlay}
                        >
                          <span className="play-recall" aria-hidden="true">
                            <Star />
                            <Play className="play-recall-badge" />
                          </span>
                        </Button>
                        {playNote ? (
                          <span className="play-note" role="status">
                            {playNote}
                          </span>
                        ) : null}
                      </span>
                      <Button
                        variant="quiet"
                        aria-label="閉じる"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          setPhonePlay(false);
                          setAnimMenu(false);
                          setVoiceMenu(false);
                          setVoiceRateOpen(false);
                          setSensorMenu(false);
                          setShakeMenu(false);
                        }}
                      >
                        閉じる
                      </Button>
                    </div>
                  ) : (
                    <div className="phone-dock-row" role="toolbar" aria-label="画像の操作">
                      <Button variant="quiet" onClick={() => step(-1)} disabled={!canPrev}>
                        前へ
                      </Button>
                      <Button
                        variant="quiet"
                        className={infoOpen ? "lightbox-fav is-on" : "lightbox-fav"}
                        aria-label={infoOpen ? "メモを隠す" : "メモを表示"}
                        aria-pressed={infoOpen}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          const next = !infoRef.current;
                          infoRef.current = next;
                          setInfoOpen(next);
                        }}
                      >
                        メモ
                      </Button>
                      <Button
                        variant="quiet"
                        className={item.favorite ? "lightbox-fav is-on" : "lightbox-fav"}
                        aria-label={item.favorite ? `${item.name}のお気に入りを解除` : `${item.name}をお気に入りに追加`}
                        aria-pressed={item.favorite}
                        onClick={() => onToggleFavorite(item.id)}
                      >
                        <Heart aria-hidden="true" fill={item.favorite ? "currentColor" : "none"} />
                      </Button>
                      {liquidImage ? (
                        <Button
                          variant="quiet"
                          className="lightbox-fav is-liquid"
                          aria-label="液体演出"
                          aria-pressed={false}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleLiquid();
                          }}
                        >
                          <Droplet aria-hidden="true" />
                        </Button>
                      ) : null}
                      {stopBothButton}
                      <Button
                        variant="quiet"
                        className={animLive ? "lightbox-fav is-play is-on" : "lightbox-fav is-play"}
                        aria-label="画像アニメーションメニュー"
                        aria-pressed={animLive}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          setAnimMenu(false);
                          setVoiceMenu(false);
                          setVoiceRateOpen(false);
                          setSensorMenu(false);
                          setShakeMenu(false);
                          setPhonePlay(true);
                        }}
                      >
                        <Play aria-hidden="true" fill={animLive ? "currentColor" : "none"} />
                      </Button>
                      <Button variant="quiet" onClick={() => step(1)} disabled={!canNext}>
                        次へ
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
              <div className="lightbox-nav">
                {total > 1 ? (
                  <Button variant="quiet" onClick={() => step(-1)} disabled={!canPrev}>
                    前へ
                  </Button>
                ) : (
                  <span />
                )}
                <div className={phone ? "lightbox-nav-mid phone-menu" : "lightbox-nav-mid"}>
                  {!phone && puruEdit ? (
                    <div className="puru-kind-row" role="toolbar" aria-label="マーカーの種類">
                      {(
                        [
                          ["狭い", "#3DDC97", ["firm-low", "firm-weak", "firm"]],
                          ["普通", "#3DABFF", ["mid-low", "mid-weak", "mid"]],
                          ["広い", "#FF4F9A", ["soft-low", "soft-weak", "soft"]],
                        ] as const
                      ).map(([name, color, ids]) => (
                        <div key={name} className="puru-kind-group" style={{ ["--puru" as string]: color }} aria-label={name}>
                          <span className="puru-kind-group-name">{name}</span>
                          {ids.map((id) => {
                            const kind = PURU_KINDS.find((entry) => entry.id === id);
                            if (!kind) return null;
                            const active = (puruGhost?.kind ?? selectedMarker?.kind) === kind.id;
                            const strength = id.endsWith("-low") ? "is-weak" : id.endsWith("-weak") ? "is-mid" : "is-strong";
                            return (
                              <button
                                key={kind.id}
                                type="button"
                                className={active ? `puru-kind ${strength} is-on` : `puru-kind ${strength}`}
                                style={{ ["--puru" as string]: kind.color }}
                                aria-pressed={active}
                                aria-label={kind.label}
                                onPointerDown={(event) => onKindDown(kind.id, event)}
                                onPointerMove={onKindMove}
                                onPointerUp={onKindUp}
                                onPointerCancel={onKindCancel}
                              >
                                <span className="puru-kind-name">
                                  <span>{kind.lines[1] ?? kind.label}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                      <div className="puru-kind-group is-still" style={{ ["--puru" as string]: PURU_STILL.color }} aria-label={PURU_STILL.label}>
                        <button
                          type="button"
                          className={(puruGhost?.kind ?? selectedMarker?.kind) === PURU_STILL.id ? "puru-kind is-on" : "puru-kind"}
                          style={{ ["--puru" as string]: PURU_STILL.color }}
                          aria-pressed={(puruGhost?.kind ?? selectedMarker?.kind) === PURU_STILL.id}
                          aria-label={PURU_STILL.label}
                          onPointerDown={(event) => onKindDown(PURU_STILL.id, event)}
                          onPointerMove={onKindMove}
                          onPointerUp={onKindUp}
                          onPointerCancel={onKindCancel}
                        >
                          <span className="puru-kind-name">
                            <span>{PURU_STILL.label}</span>
                          </span>
                        </button>
                      </div>
                      <button
                        type="button"
                        className="puru-kind-command"
                        disabled={!selectedMarker}
                        onClick={() => {
                          if (!selectedMarker) return;
                          const id = selectedMarker.id;
                          setPuruMarkers((list) => list.filter((marker) => marker.id !== id));
                          setPuruSelected(null);
                        }}
                      >
                        削除
                      </button>
                      <div className="puru-kind-actions">
                        <button
                          type="button"
                          onClick={() => {
                            const id = shownIdRef.current;
                            if (!id) return;
                            const markers = puruMarkersRef.current.map((marker) => ({ ...marker }));
                            void saveImagePuru(id, markers).then((ok) => {
                              if (!ok || shownIdRef.current !== id) return;
                              setPuruNote("保存しました");
                            });
                          }}
                        >
                          {puruNote || "保存"}
                        </button>
                        <button type="button" onClick={() => closePuru()}>
                          終了
                        </button>
                        <button type="button" onClick={openVector}>
                          ベクトル
                        </button>
                      </div>
                    </div>
                  ) : !phone && vectorEdit ? (
                    <div className="vector-kind-row" role="toolbar" aria-label="ベクトルマーカー">
                      {VECTOR_KINDS.map((kind) => (
                        <div key={kind.id} className="vector-kind-group" style={{ ["--vector" as string]: kind.color }} aria-label={kind.label}>
                          <span className="vector-kind-name">{kind.label}</span>
                          {VECTOR_PACES.map((pace) => {
                            const on = vectorArmed?.kind === kind.id && vectorArmed.pace === pace.id;
                            return (
                              <button
                                key={pace.id}
                                type="button"
                                className={on ? "vector-pace is-on" : "vector-pace"}
                                aria-pressed={on}
                                aria-label={`${kind.label} ${pace.label}`}
                                onPointerDown={(event) => onVectorKindDown(kind.id, pace.id, event)}
                                onPointerMove={onVectorKindMove}
                                onPointerUp={onVectorKindUp}
                                onPointerCancel={onVectorKindCancel}
                              >
                                {pace.label}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                      <div className="puru-kind-actions">
                        <button
                          type="button"
                          disabled={vectorSelected === null}
                          onClick={() => {
                            const id = vectorSelected;
                            if (id === null) return;
                            setVectorMarkers((list) => list.filter((marker) => marker.id !== id));
                            setVectorSelected(null);
                          }}
                        >
                          削除
                        </button>
                        <button type="button" onClick={saveVectors}>
                          {vectorNote || "保存"}
                        </button>
                        <button type="button" onClick={openPuru}>
                          ぷるぷる
                        </button>
                        <button type="button" onClick={() => closeVector()}>
                          終了
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                  {phone ? null : item.animated ? (
                    <span />
                  ) : (
                    <span className={hasInk ? "ink-pair" : "ink-pair is-single"}>
                      <Button
                        variant="quiet"
                        className={editing ? "lightbox-fav is-on" : "lightbox-fav"}
                        aria-label={editing ? "ペン書き込みを終了" : "ペン書き込み"}
                        aria-pressed={editing}
                        onClick={() => setInkOn((current) => !current)}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      {hasInk ? (
                        <Button
                          variant="quiet"
                          className={editing ? "lightbox-fav is-ink-locked" : inkShown ? "lightbox-fav is-ink-on" : "lightbox-fav"}
                          aria-label={editing ? "編集中は表示を切り替えられません" : inkShown ? "書き込みを隠す" : "書き込みを表示"}
                          aria-pressed={editing ? true : inkShown}
                          disabled={editing}
                          onClick={() => {
                            if (editing) return;
                            void setInkVisible(item.id, !inkShown);
                          }}
                        >
                          {editing || inkShown ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                        </Button>
                      ) : null}
                    </span>
                  )}
                  {phone ? null : (
                  <Button
                    variant="quiet"
                    className={item.favorite ? "lightbox-fav is-on" : "lightbox-fav"}
                    aria-label={item.favorite ? `${item.name}のお気に入りを解除` : `${item.name}をお気に入りに追加`}
                    aria-pressed={item.favorite}
                    onClick={() => onToggleFavorite(item.id)}
                  >
                    <Heart aria-hidden="true" fill={item.favorite ? "currentColor" : "none"} />
                  </Button>
                  )}
                  {pcTools ? (
                    <>
                    <Button
                      variant="quiet"
                      className="lightbox-fav"
                      aria-label="アニメーションと音声を停止"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        stopTogether();
                      }}
                    >
                      ■
                    </Button>
                    {liquidImage ? (
                      <span className="liquid-launch">
                        <Button
                          variant="quiet"
                          className={liquidMode ? "lightbox-fav is-liquid is-on" : "lightbox-fav is-liquid"}
                          aria-label={liquidMode ? "液体演出を終了" : "液体演出"}
                          aria-pressed={liquidMode}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleLiquid();
                          }}
                        >
                          <Droplet aria-hidden="true" fill={liquidMode ? "currentColor" : "none"} />
                        </Button>
                        {liquidMode ? (
                          <Button
                            variant="quiet"
                            className="liquid-reset"
                            aria-label="液体をすべて消す"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              liquidRef.current?.clear();
                            }}
                          >
                            リセット
                          </Button>
                        ) : null}
                      </span>
                    ) : null}
                    </>
                  ) : null}
                  {(phone ? phonePlay : pcTools) ? (
                    <span className="lightbox-anim-stack">
                    <span className="lightbox-anim-anchor is-anim">
                      <Button
                        variant="quiet"
                        className={animLive ? "lightbox-fav is-play is-on" : "lightbox-fav is-play"}
                        aria-label="画像アニメーション"
                        aria-haspopup="dialog"
                        aria-expanded={animMenu}
                        aria-pressed={animLive}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          puruEditRef.current = false;
                          setPuruEdit(false);
                          setVoiceMenu(false);
                          setVoiceRateOpen(false);
                          setAnimMenu((open) => !open);
                        }}
                      >
                        <Play aria-hidden="true" fill={animLive ? "currentColor" : "none"} />
                      </Button>
                      {animMenu ? (
                        <div
                          className="lightbox-anim"
                          role="dialog"
                          aria-label="画像アニメーション"
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <p className="lightbox-anim-title">画像アニメーション</p>
                          <button type="button" className={animLive ? "" : "is-on"} aria-pressed={!animLive} onClick={stopAnimation}>
                            停止
                          </button>
                          <button
                            type="button"
                            className={vectorPlay ? "is-on" : ""}
                            aria-pressed={vectorPlay}
                            aria-label={vectorPlay ? "マーカーを停止" : "マーカーを再生"}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (vectorPlay) stopTogether();
                              else toggleVectorPlay();
                            }}
                          >
                            {vectorPlay ? "■" : "マーカーを再生"}
                          </button>
                          <p className="lightbox-anim-label">横揺れ</p>
                          <div className="lightbox-anim-row">
                            <button type="button" className={animKind === "swayX" ? "is-on" : ""} aria-pressed={animKind === "swayX"} onClick={() => pickKind("swayX")}>
                              ゆるやか
                            </button>
                            <button type="button" className={animKind === "hitX" ? "is-on" : ""} aria-pressed={animKind === "hitX"} onClick={() => pickKind("hitX")}>
                              打ち付け
                            </button>
                          </div>
                          <p className="lightbox-anim-label">縦揺れ</p>
                          <div className="lightbox-anim-row">
                            <button type="button" className={animKind === "swayY" ? "is-on" : ""} aria-pressed={animKind === "swayY"} onClick={() => pickKind("swayY")}>
                              ゆるやか
                            </button>
                            <button type="button" className={animKind === "hitY" ? "is-on" : ""} aria-pressed={animKind === "hitY"} onClick={() => pickKind("hitY")}>
                              打ち付け
                            </button>
                          </div>
                          <p className="lightbox-anim-label">そのほか</p>
                          <div className="lightbox-anim-row">
                            <button type="button" className={animKind === "orbit" ? "is-on" : ""} aria-pressed={animKind === "orbit"} onClick={() => pickKind("orbit")}>
                              円運動
                            </button>
                            <button type="button" className={animKind === "buzz" ? "is-on" : ""} aria-pressed={animKind === "buzz"} onClick={() => pickKind("buzz")}>
                              通知バイブレーション
                            </button>
                          </div>
                          <p className="lightbox-anim-label">追加オプション</p>
                          <div className="lightbox-anim-options">
                            {optionRow("zoom")}
                            {optionRow("twist")}
                            <div className="lightbox-anim-switch">
                              <p className="lightbox-anim-label">右45度</p>
                              <button
                                type="button"
                                role="switch"
                                className={animTilt === "right" ? "lightbox-switch is-on" : "lightbox-switch"}
                                aria-checked={animTilt === "right"}
                                aria-label={animTilt === "right" ? "右45度をオフ" : "右45度をオン"}
                                onClick={() => toggleTilt("right")}
                              >
                                <span className="lightbox-switch-knob" />
                              </button>
                            </div>
                            <div className="lightbox-anim-switch">
                              <p className="lightbox-anim-label">左45度</p>
                              <button
                                type="button"
                                role="switch"
                                className={animTilt === "left" ? "lightbox-switch is-on" : "lightbox-switch"}
                                aria-checked={animTilt === "left"}
                                aria-label={animTilt === "left" ? "左45度をオフ" : "左45度をオン"}
                                onClick={() => toggleTilt("left")}
                              >
                                <span className="lightbox-switch-knob" />
                              </button>
                            </div>
                          </div>
                          <div className="lightbox-anim-extra">
                            <div className="lightbox-anim-switch">
                              <p className="lightbox-anim-label">速度</p>
                              <span>反転</span>
                              <button
                                type="button"
                                role="switch"
                                className={animReverse ? "lightbox-switch is-on" : "lightbox-switch"}
                                aria-checked={animReverse}
                                aria-label={animReverse ? "反転をオフ" : "反転をオン"}
                                onClick={() => {
                                  animReverseRef.current = !animReverseRef.current;
                                  setAnimReverse(animReverseRef.current);
                                }}
                              >
                                <span className="lightbox-switch-knob" />
                              </button>
                            </div>
                            <div className="lightbox-anim-speeds">
                              {(
                                [
                                  ["slow", "遅い"],
                                  ["normal", "普通"],
                                  ["fast", "速い"],
                                  ["rapid", "高速"],
                                  ["ultra", "超高速"],
                                ] as const
                              ).map(([id, label]) => (
                                <button key={id} type="button" className={animSpeed === id ? "is-on" : ""} aria-pressed={animSpeed === id} onClick={() => chooseSpeed(id)}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </span>
                    {vectorNote ? <span className="play-note">{vectorNote}</span> : null}
                    </span>
                  ) : null}
                  {(phone ? phonePlay : pcTools) ? (
                  <span className="lightbox-anim-anchor is-voice">
                    <Button
                      variant="quiet"
                      className={voiceId ? "lightbox-fav is-voice is-on" : "lightbox-fav is-voice"}
                      aria-label="音声再生"
                      aria-haspopup="dialog"
                      aria-expanded={voiceMenu}
                      aria-pressed={voiceId !== null}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => {
                        setAnimMenu(false);
                        setVoiceMenu((open) => {
                          if (open) setVoiceRateOpen(false);
                          return !open;
                        });
                      }}
                    >
                      {volume === 0 ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
                    </Button>
                    {voiceMenu ? (
                      <div className="lightbox-anim lightbox-voice" role="dialog" aria-label="音声再生" onPointerDown={(event) => event.stopPropagation()}>
                        <p className="lightbox-anim-title">音声再生</p>
                        {VOICE_TRACKS.length === 0 ? (
                          <p className="lightbox-voice-empty">音声はまだありません</p>
                        ) : (
                          <>
                            <button type="button" className={voiceId === null ? "is-on" : ""} aria-pressed={voiceId === null} onClick={stopVoice}>
                              停止
                            </button>
                            <div className="lightbox-voice-list">
                              {VOICE_TRACKS.map((track) => (
                                <button
                                  key={track.id}
                                  type="button"
                                  className={voiceId === track.id ? "is-on" : ""}
                                  aria-pressed={voiceId === track.id}
                                  onClick={() => playVoice(track.id)}
                                >
                                  {track.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                        <div className="lightbox-voice-rate">
                          <p className="lightbox-anim-label">再生速度</p>
                          <button
                            type="button"
                            aria-label="再生速度"
                            aria-haspopup="listbox"
                            aria-expanded={voiceRateOpen}
                            onClick={() => setVoiceRateOpen((open) => !open)}
                          >
                            {voiceRateLabel(voiceRate)}
                          </button>
                          {voiceRateOpen ? (
                            <div className="lightbox-voice-rates" role="listbox" aria-label="再生速度">
                              {VOICE_RATES.map((rate) => (
                                <button
                                  key={rate}
                                  type="button"
                                  role="option"
                                  className={voiceRate === rate ? "is-on" : ""}
                                  aria-selected={voiceRate === rate}
                                  onClick={() => chooseVoiceRate(rate)}
                                >
                                  {voiceRateLabel(rate)}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <label className="lightbox-voice-volume">
                          <span>音量</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={volume}
                            aria-label="音量"
                            onChange={(event) => applyVolume(Number(event.target.value))}
                          />
                          <span className="tabular-nums">{volume}%</span>
                        </label>
                        {voiceError ? <p className="lightbox-voice-error">{voiceError}</p> : null}
                      </div>
                    ) : null}
                  </span>
                  ) : phone ? null : (
                    <Button
                      variant="quiet"
                      className="lightbox-fav lightbox-tool-lock"
                      aria-label="機能を表示"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (event.detail === 3) setPcTools(true);
                      }}
                    />
                  )}
                  {puruAvailable ? (
                    <span className="lightbox-anim-anchor">
                      <Button
                        variant="quiet"
                        className={puruEdit || puruMarkers.length > 0 ? "lightbox-fav is-puru is-on" : "lightbox-fav is-puru"}
                        aria-label="ぷるぷるメーカー"
                        aria-pressed={puruEdit}
                        aria-expanded={puruEdit}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          if (puruEditRef.current) closePuru();
                          else openPuru();
                        }}
                      >
                        <Waves aria-hidden="true" />
                      </Button>
                      <Button
                        variant="quiet"
                        className={vectorEdit || vectorMarkers.length > 0 ? "lightbox-fav is-vector is-on" : "lightbox-fav is-vector"}
                        aria-label="ベクトルマーカー設置"
                        aria-pressed={vectorEdit}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={openVector}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 4a8 8 0 1 1-5.3 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M7 3.5 L6.2 8.2 L10.4 6.2 Z" fill="currentColor" />
                        </svg>
                      </Button>
                    </span>
                  ) : null}
                  {(phone ? phonePlay : pcTools) ? (
                    <span className="lightbox-play-pair">
                      <Button
                        variant="quiet"
                        className={normalizeImagePlay(item.play) ? "lightbox-fav is-play-saved" : "lightbox-fav"}
                        aria-label="アニメーションと音声をお気に入り登録"
                        aria-pressed={normalizeImagePlay(item.play) !== null}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={savePlay}
                      >
                        <Star aria-hidden="true" fill={normalizeImagePlay(item.play) ? "currentColor" : "none"} />
                      </Button>
                      <Button
                        variant="quiet"
                        className="lightbox-fav"
                        aria-label="お気に入りのアニメーションと音声を呼び出す"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={recallPlay}
                      >
                        <span className="play-recall" aria-hidden="true">
                          <Star />
                          <Play className="play-recall-badge" />
                        </span>
                      </Button>
                      {playNote ? (
                        <span className="play-note" role="status">
                          {playNote}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                    </>
                  )}
                </div>
                {total > 1 ? (
                  <Button variant="quiet" onClick={() => step(1)} disabled={!canNext}>
                    次へ
                  </Button>
                ) : (
                  <span />
                )}
              </div>
              )}
            </>
          ) : null}
          {puruEdit && puruAvailable ? (
            <>
              <div
                className="puru-shield"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onPointerMove={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onPointerCancel={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              />
              {phone ? (
              <div className="puru-panel" role="dialog" aria-label="ぷるぷるメーカー" onPointerDown={(event) => event.stopPropagation()}>
                <div className="puru-head">
                  <p>ぷるぷるメーカー</p>
                  <div className="puru-head-actions">
                    <button
                      type="button"
                      onClick={() => {
                        const id = shownIdRef.current;
                        if (!id) return;
                        const markers = puruMarkersRef.current.map((marker) => ({ ...marker }));
                        void saveImagePuru(id, markers).then((ok) => {
                          if (!ok || shownIdRef.current !== id) return;
                          setPuruNote("保存しました");
                        });
                      }}
                    >
                      {puruNote || "保存"}
                    </button>
                    {selectedMarker ? (
                      <button
                        type="button"
                        onClick={() => {
                          const id = selectedMarker.id;
                          setPuruMarkers((list) => list.filter((marker) => marker.id !== id));
                          setPuruSelected(null);
                        }}
                      >
                        削除
                      </button>
                    ) : null}
                    <button type="button" onClick={() => closePuru()}>
                      終了
                    </button>
                  </div>
                </div>
                <div className="puru-kinds">
                  {PURU_KINDS.map((kind) => {
                    const active = (puruGhost?.kind ?? selectedMarker?.kind) === kind.id;
                    return (
                      <button
                        key={kind.id}
                        type="button"
                        className={active ? "puru-kind is-on" : "puru-kind"}
                        style={{ ["--puru" as string]: kind.color }}
                        aria-pressed={active}
                        aria-label={kind.label}
                        onPointerDown={(event) => onKindDown(kind.id, event)}
                        onPointerMove={onKindMove}
                        onPointerUp={onKindUp}
                        onPointerCancel={onKindCancel}
                      >
                        <span className="puru-swatch" />
                        <span className="puru-kind-name">
                          {kind.lines.map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="puru-still-row">
                  <button
                    type="button"
                    className={(puruGhost?.kind ?? selectedMarker?.kind) === PURU_STILL.id ? "puru-kind is-on" : "puru-kind"}
                    style={{ ["--puru" as string]: PURU_STILL.color }}
                    aria-pressed={(puruGhost?.kind ?? selectedMarker?.kind) === PURU_STILL.id}
                    aria-label={PURU_STILL.label}
                    onPointerDown={(event) => onKindDown(PURU_STILL.id, event)}
                    onPointerMove={onKindMove}
                    onPointerUp={onKindUp}
                    onPointerCancel={onKindCancel}
                  >
                    <span className="puru-swatch" />
                    <span className="puru-kind-name">
                      <span>{PURU_STILL.label}</span>
                    </span>
                  </button>
                </div>
                {selectedMarker ? (
                  <label className="puru-range" style={{ ["--puru" as string]: puruKindFace(selectedMarker.kind).color }}>
                    <span>大きさ</span>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={1}
                      value={Math.round(markerView(selectedMarker) * 100)}
                      aria-label="マーカーの大きさ"
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const id = selectedMarker.id;
                        const view = clampView(Number(event.target.value) / 100);
                        setPuruMarkers((list) => list.map((marker) => (marker.id === id ? { ...marker, view } : marker)));
                      }}
                    />
                    <span className="tabular-nums">{Math.round(markerView(selectedMarker) * 100)}%</span>
                  </label>
                ) : null}
              </div>
              ) : null}
              {puruGhost
                ? (() => {
                    const kind = puruKindFace(puruGhost.kind, phone);
                    const still = puruGhost.kind === "still";
                    return (
                      <div
                        className={["puru-marker puru-ghost", puruGhost.inside ? "" : "is-out", still ? "is-still" : ""].filter(Boolean).join(" ")}
                        style={{
                          left: puruGhost.x,
                          top: puruGhost.y,
                          width: puruGhost.size,
                          height: puruGhost.size,
                          ["--puru" as string]: kind.color,
                        }}
                      >
                        <span
                          className="puru-halo"
                          style={{
                            width: `${puruReach(puruGhost.kind) * 100}%`,
                            height: `${puruReach(puruGhost.kind) * 100}%`,
                            background: puruHaloBackground(kind.color, puruGhost.kind),
                          }}
                        />
                        <span className="puru-marker-dot">{kind.short}</span>
                      </div>
                    );
                  })()
                : null}
            </>
          ) : null}
              {vectorGhost
                ? (() => {
                    const face = vectorKindFace(vectorGhost.kind);
                    const pace = VECTOR_PACES.find((entry) => entry.id === vectorGhost.pace);
                    return (
                      <div
                        className={vectorGhost.inside ? "puru-marker puru-ghost" : "puru-marker puru-ghost is-out"}
                        style={{
                          left: vectorGhost.x,
                          top: vectorGhost.y,
                          width: vectorGhost.size,
                          height: vectorGhost.size,
                          ["--puru" as string]: face.color,
                        }}
                      >
                        <span
                          className="puru-halo"
                          style={{
                            width: "145%",
                            height: "145%",
                            background: vectorHalo(face.color),
                          }}
                        />
                        <span className="puru-marker-dot">{pace ? `${face.label}${pace.label}` : face.label}</span>
                      </div>
                    );
                  })()
                : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
