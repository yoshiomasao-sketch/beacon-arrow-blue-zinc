import { Check, Eye, EyeOff, Heart, Pencil, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { readInk, readPixels } from "@/lib/portfolio/db";
import { primeOriginal } from "@/lib/portfolio/export-file";
import { type FlowBox } from "@/lib/portfolio/logic";
import { SHOT_TIMEOUT_MS, shotAfterFailure, shotRetryDelay } from "@/lib/portfolio/shot-load";
import { invalidateThumb, loadThumb, peekThumb, pinThumb } from "@/lib/portfolio/thumbs";
import { TAG_DRAG, type ImageMeta, type Tag } from "@/lib/portfolio/types";
import { currentTagDrag, eventIsTagDrag } from "@/lib/portfolio/tag-drag";
import { setInkVisible, usePortfolio } from "@/lib/portfolio/store";
import { placeSpot } from "@/components/portfolio/spot-confirm";
import { THUMB_REST, THUMB_RETURN_EASE, THUMB_RETURN_MS, thumbFollow, thumbSheen, thumbTiltEnabled, thumbTiltFromPointer, thumbUnit, type ThumbTilt } from "@/lib/portfolio/thumb-tilt";
import { holdGallerySensor } from "@/lib/portfolio/sensor-gallery";
import { zoomRectOf, type ZoomRect } from "@/lib/portfolio/thumb-zoom";

const DRAG_SLOP = 6;

function stylusPointer(type: string): boolean {
  return type === "pen" || type === "touch";
}

function hasBytes(bytes: Uint8Array, needle: number[]): boolean {
  outer: for (let index = 0; index <= bytes.length - needle.length; index += 1) {
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}

async function isStaticPoster(blob: Blob): Promise<boolean> {
  if (blob.type === "image/jpeg") return true;
  if (blob.type !== "image/png") return false;
  const bytes = new Uint8Array(await blob.slice(0, 2048).arrayBuffer());
  return !hasBytes(bytes, [0x61, 0x63, 0x54, 0x4c]);
}

async function stillFrame(blob: Blob): Promise<Blob | null> {
  if (blob.type.startsWith("video/")) return videoPoster(blob);
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    if (bitmap.width < 1 || bitmap.height < 1) return null;
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise((resolve) => canvas.toBlob((next) => resolve(next), "image/png"));
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

function videoPoster(blob: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  return new Promise((resolve) => {
    const finish = (next: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(next);
    };
    video.onerror = () => finish(null);
    video.onloadeddata = () => {
      if (video.videoWidth < 1 || video.videoHeight < 1) {
        finish(null);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        finish(null);
        return;
      }
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((next) => finish(next), "image/jpeg", 0.82);
    };
  });
}

function menuFit(width: number, height: number): "full" | "compact" | "tiny" {
  if (width < 96 || height < 72) return "tiny";
  if (width < 150 || height < 110) return "compact";
  return "full";
}

function ShotName({ name, active, className = "" }: { name: string; active: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || !active) {
      setOverflow(0);
      return;
    }
    const shift = node.scrollWidth - (node.parentElement?.clientWidth ?? 0);
    setOverflow(shift > 4 ? shift : 0);
  }, [name, active]);

  const scrolling = active && overflow > 0;
  const duration = scrolling ? overflow / 28 / 0.7 : 0;

  return (
    <p className={className ? `shot-name-view ${className}` : "shot-name-view"}>
      <span
        ref={ref}
        className={scrolling ? "shot-name is-scrolling" : "shot-name"}
        style={
          scrolling
            ? { ["--marquee-shift" as string]: `${overflow}px`, ["--marquee-duration" as string]: `${duration}s` }
            : undefined
        }
      >
        {name}
      </span>
    </p>
  );
}

function placedMedia(boxW: number, boxH: number, imageW: number, imageH: number): CSSProperties {
  const widthBudget = Math.max(0, boxW);
  const heightBudget = Math.max(0, boxH);
  const sourceW = Math.max(1, imageW);
  const sourceH = Math.max(1, imageH);
  const scale = Math.min(widthBudget / sourceW, heightBudget / sourceH);
  const width = sourceW * scale;
  const height = sourceH * scale;
  return {
    left: (widthBudget - width) / 2,
    top: (heightBudget - height) / 2,
    width,
    height,
    right: "auto",
    bottom: "auto",
  };
}
function isTagDrag(event: React.DragEvent): boolean {
  return eventIsTagDrag(event.dataTransfer.types);
}

function paintThumb(node: HTMLElement, tilt: ThumbTilt) {
  const gloss = thumbSheen(tilt);
  node.style.setProperty("--thumb-rx", `${tilt.x.toFixed(2)}deg`);
  node.style.setProperty("--thumb-ry", `${tilt.y.toFixed(2)}deg`);
  node.style.setProperty("--thumb-sx", `${gloss.x.toFixed(2)}%`);
  node.style.setProperty("--thumb-sy", `${gloss.y.toFixed(2)}%`);
  node.style.setProperty("--thumb-so", gloss.opacity.toFixed(3));
  node.style.setProperty("--thumb-st", `${gloss.turn.toFixed(2)}deg`);
}

function thumbMotion(node: HTMLElement, returning: boolean) {
  const sheen = node.querySelector(".shot-sheen");
  const ease = `${THUMB_RETURN_MS}ms ${THUMB_RETURN_EASE}`;
  node.style.transition = returning ? `transform ${ease}` : "none";
  node.style.willChange = returning ? "auto" : "transform";
  if (sheen instanceof HTMLElement) sheen.style.transition = returning ? `transform ${ease}, opacity ${ease}` : "none";
}

const inkPreviewCache = new Map<string, { rev: number; url: string }>();

function cachedInkPreview(id: string, rev: number): string | null {
  const hit = inkPreviewCache.get(id);
  return hit && hit.rev === rev ? hit.url : null;
}

function rememberInkPreview(id: string, rev: number, url: string): void {
  const hit = inkPreviewCache.get(id);
  if (hit && hit.rev > rev) {
    URL.revokeObjectURL(url);
    return;
  }
  if (hit && hit.url !== url) URL.revokeObjectURL(hit.url);
  inkPreviewCache.set(id, { rev, url });
}

async function shrinkInk(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const maxEdge = 480;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 0.999) return blob;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const preview = await new Promise<Blob | null>((resolve) => canvas.toBlob((next) => resolve(next), "image/png"));
    return preview && preview.size > 0 ? preview : blob;
  } finally {
    bitmap.close();
  }
}

function InkStill({ imageId, revision, style }: { imageId: string; revision: number; style: CSSProperties }) {
  const [url, setUrl] = useState<string | null>(() => cachedInkPreview(imageId, revision));
  useEffect(() => {
    const cached = cachedInkPreview(imageId, revision);
    if (cached) {
      setUrl(cached);
      return;
    }
    let alive = true;
    void readInk(imageId)
      .then(async (blob) => {
        if (!alive || !blob) {
          if (alive) setUrl(null);
          return;
        }
        const preview = await shrinkInk(blob).catch(() => blob);
        if (!alive) return;
        const next = URL.createObjectURL(preview);
        rememberInkPreview(imageId, revision, next);
        if (alive) setUrl(cachedInkPreview(imageId, revision));
      })
      .catch(() => {
        if (alive) setUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [imageId, revision]);
  if (!url) return null;
  return <img className="shot-ink" src={url} alt="" draggable={false} style={style} />;
}

function ShotDeleteAsk({
  anchor,
  trigger,
  body,
  onConfirm,
  onCancel,
}: {
  anchor: DOMRect;
  trigger: HTMLElement | null;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(() => placeSpot(anchor, "below", { width: 220, height: 92 }));

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const next = placeSpot(anchor, "below", { width: box.width, height: box.height });
    setPos((current) => (current.top === next.top && current.left === next.left ? current : next));
  }, [anchor, body]);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (ref.current?.contains(target)) return;
      if (trigger && trigger.contains(target)) event.preventDefault();
      onCancel();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && ref.current?.contains(target)) return;
      onCancel();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onCancel, trigger]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      className="spot-confirm"
      role="dialog"
      aria-label="画像を削除"
      style={{ top: pos.top, left: pos.left }}
    >
      <p>{body}</p>
      <div className="spot-confirm-actions">
        <button type="button" onClick={onCancel}>
          キャンセル
        </button>
        <button type="button" className="spot-go" onClick={onConfirm}>
          削除
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function ImageCard({
  item,
  box,
  tags,
  dragging,
  settling = false,
  insertEdge,
  onOpen,
  onInk,
  onDragStart,
  flash,
  fading,
  origin = "",
  selected,
  bulk,
  onToggleSelect,
  onFavorite,
  onDelete,
  onAssignTag,
  onTagPrompt,
  viewer = false,
  gifMotion = true,
  zoomSource = false,
}: {
  item: ImageMeta;
  box: FlowBox;
  tags: Tag[];
  dragging: boolean;
  settling?: boolean;
  insertEdge: "before" | "after" | null;
  onOpen: (id: string, from?: ZoomRect) => void;
  onInk: (id: string) => void;
  onDragStart: (id: string, event: PointerEvent) => void;
  flash: boolean;
  fading: boolean;
  origin?: string;
  selected: boolean;
  bulk: boolean;
  onToggleSelect: (id: string) => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onMemo: (id: string, memo: string) => void;
  onAssignTag: (id: string, tagId: string) => void;
  onTagPrompt: (imageId: string, tagId: string, rect: DOMRect) => void;
  viewer?: boolean;
  gifMotion?: boolean;
  zoomSource?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLLIElement>(null);
  const tiltShown = useRef<ThumbTilt>(THUMB_REST);
  const tiltTarget = useRef<ThumbTilt>(THUMB_REST);
  const tiltFrame = useRef(0);
  const tiltLive = useRef(false);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
  const reportRef = useRef<{
    loaded: (width: number, height: number) => void;
    failed: () => void;
  } | null>(null);
  const suppressClick = useRef(false);
  const pointerOwned = useRef(false);
  const slopCleanup = useRef<(() => void) | null>(null);
  const pauseMotion = item.animated && !gifMotion;
  const pixelKey = pauseMotion ? `${item.id}:still` : item.animated ? `${item.id}:motion` : item.id;
  const hasInk = usePortfolio((state) => state.inkIds.includes(item.id));
  const inkRev = usePortfolio((state) => state.inkRev[item.id] ?? 0);
  const inkShown = item.inkVisible !== false;
  const [url, setUrl] = useState<string | null>(() => peekThumb(pixelKey));
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [retryNonce, setRetryNonce] = useState(0);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tagHot, setTagHot] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState<DOMRect | null>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pinned) return;
    const close = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      setPinned(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [pinned]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let alive = true;
    let visible = false;
    let running = false;
    let ready = false;
    let gaveUp = false;
    let failing = false;
    let attempt = 0;
    let token = 0;
    let useOriginal = item.animated && !pauseMotion;
    let unpin: (() => void) | null = null;
    let retryTimer = 0;
    let timeoutTimer = 0;
    let hideTimer = 0;
    let releaseTimer = 0;

    const retain = () => {
      if (!unpin) unpin = pinThumb(pixelKey);
    };

    const stopTimers = () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(timeoutTimer);
    };

    const fail = (kind: "transient" | "missing") => {
      if (!alive || failing) return;
      failing = true;
      running = false;
      ready = false;
      token += 1;
      stopTimers();
      setUrl(null);
      invalidateThumb(pixelKey);
      attempt += 1;
      const plan = shotAfterFailure(attempt, kind);
      if (plan === "missing") {
        gaveUp = true;
        setStatus("missing");
        return;
      }
      if (plan === "error") {
        gaveUp = true;
        setStatus("error");
        return;
      }
      setStatus("loading");
      retryTimer = window.setTimeout(() => {
        failing = false;
        start();
      }, shotRetryDelay(attempt));
    };

    const start = () => {
      if (!alive || !visible || running || gaveUp) return;
      const known = peekThumb(pixelKey);
      if (known && attempt === 0 && !useOriginal) {
        if (running) return;
        running = true;
        retain();
        failing = false;
        setUrl(known);
        setStatus(ready ? "ready" : "loading");
        if (!ready) {
          const my = ++token;
          window.clearTimeout(timeoutTimer);
          timeoutTimer = window.setTimeout(() => {
            if (!alive || my !== token) return;
            running = false;
            fail("transient");
          }, SHOT_TIMEOUT_MS);
        }
        return;
      }
      running = true;
      failing = false;
      setStatus("loading");
      const my = ++token;
      window.clearTimeout(timeoutTimer);
      timeoutTimer = window.setTimeout(() => {
        if (!alive || my !== token) return;
        running = false;
        fail("transient");
      }, SHOT_TIMEOUT_MS);
      const kind = useOriginal ? "original" : "thumb";
      loadThumb(pixelKey, async () => {
        const blob = await readPixels(item.id, kind);
        if (!blob || blob.size <= 0) return null;
        if (!pauseMotion || (await isStaticPoster(blob))) return blob;
        return stillFrame(blob);
      })
        .then((next) => {
          if (!alive || my !== token) return;
          window.clearTimeout(timeoutTimer);
          running = false;
          retain();
          setUrl(next);
          setStatus("loading");
        })
        .catch((error: unknown) => {
          if (!alive || my !== token) return;
          window.clearTimeout(timeoutTimer);
          running = false;
          const missing = error instanceof Error && error.message === "missing-thumb";
          fail(missing ? "missing" : "transient");
        });
    };

    reportRef.current = {
      loaded(width, height) {
        if (!alive) return;
        if (width > 0 && height > 0) {
          ready = true;
          gaveUp = false;
          failing = false;
          running = false;
          attempt = 0;
          stopTimers();
          setStatus("ready");
          return;
        }
        if (!item.animated && !useOriginal) {
          useOriginal = true;
          token += 1;
          running = false;
          failing = true;
          stopTimers();
          setUrl(null);
          invalidateThumb(pixelKey);
          failing = false;
          start();
          return;
        }
        fail("transient");
      },
      failed() {
        if (!alive || !visible) return;
        if (!item.animated && !useOriginal) {
          useOriginal = true;
          token += 1;
          running = false;
          failing = true;
          stopTimers();
          setUrl(null);
          invalidateThumb(pixelKey);
          failing = false;
          start();
          return;
        }
        fail("transient");
      },
    };

    const show = () => {
      visible = true;
      window.clearTimeout(hideTimer);
      window.clearTimeout(releaseTimer);
      retain();
      const known = peekThumb(pixelKey);
      if (ready && known) {
        setUrl(known);
        setStatus("ready");
        return;
      }
      if (gaveUp) return;
      if (ready && !known) ready = false;
      start();
    };

    const hide = () => {
      visible = false;
      token += 1;
      running = false;
      failing = false;
      stopTimers();
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        if (!alive || visible) return;
        setUrl(null);
        window.clearTimeout(releaseTimer);
        releaseTimer = window.setTimeout(() => {
          unpin?.();
          unpin = null;
        }, 2000);
      }, 250);
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible" || !visible) return;
      const known = peekThumb(pixelKey);
      if (ready && known) {
        setUrl(known);
        return;
      }
      gaveUp = false;
      attempt = 0;
      failing = false;
      ready = false;
      start();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entered = entries.some((entry) => entry.isIntersecting);
        if (entered) {
          if (!visible) {
            gaveUp = false;
            attempt = 0;
            failing = false;
          }
          show();
        } else hide();
      },
      { rootMargin: "480px 0px" },
    );
    observer.observe(frame);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      token += 1;
      reportRef.current = null;
      stopTimers();
      window.clearTimeout(hideTimer);
      window.clearTimeout(releaseTimer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      unpin?.();
      setUrl(null);
    };
  }, [item.animated, item.id, pauseMotion, pixelKey, retryNonce]);

  useEffect(() => {
    const node = mediaRef.current;
    if (!node || !url) return;
    if (node instanceof HTMLImageElement && node.complete) {
      reportRef.current?.loaded(node.naturalWidth, node.naturalHeight);
    }
    if (node instanceof HTMLVideoElement && node.readyState >= 1) {
      reportRef.current?.loaded(node.videoWidth, node.videoHeight);
    }
  }, [url]);

  useEffect(() => {
    if (!dragging) {
      const node = rootRef.current;
      if (node?.matches(":hover")) setHover(true);
      return;
    }
    tiltLive.current = false;
    if (tiltFrame.current) cancelAnimationFrame(tiltFrame.current);
    tiltFrame.current = 0;
    tiltShown.current = THUMB_REST;
    tiltTarget.current = THUMB_REST;
    rootRef.current?.classList.remove("is-pressing", "is-relaxing");
    const face = contactRef.current;
    if (!face) return;
    thumbMotion(face, false);
    paintThumb(face, THUMB_REST);
  }, [dragging]);

  useEffect(() => {
    const rest = () => {
      tiltLive.current = false;
      if (tiltFrame.current) cancelAnimationFrame(tiltFrame.current);
      tiltFrame.current = 0;
      tiltShown.current = THUMB_REST;
      tiltTarget.current = THUMB_REST;
      setHover(false);
      const face = contactRef.current;
      if (!face) return;
      thumbMotion(face, true);
      paintThumb(face, THUMB_REST);
    };
    window.addEventListener("komacho-thumb-rest", rest);
    return () => {
      window.removeEventListener("komacho-thumb-rest", rest);
      if (tiltFrame.current) cancelAnimationFrame(tiltFrame.current);
    };
  }, []);

  const menu = hover || pinned;
  const fit = menuFit(box.w, box.h);
  const mediaStyle = placedMedia(box.w, box.h, item.width, item.height);

  const prepareExport = () => {
    if (viewer) return;
    void primeOriginal(item).catch(() => undefined);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLLIElement>) => {
    if (event.button !== 0) return;
    // The phone list uses this gesture for scrolling and the side menus.
    // Reorder, the drag clone, and the return flight stay on the desktop layout.
    if (viewer) return;
    prepareExport();
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const kind = event.pointerType || "mouse";
    const stylus = stylusPointer(kind);
    const target = event.target as Element | null;
    // Text fields keep their own gesture. Buttons stay clickable, but the same
    // 6px slop can still pick the card up — a short card's menu must not shrink
    // the grab area when the window gets smaller.
    if (target?.closest(".shot-menu input, .shot-menu textarea, .shot-menu select, .shot-menu a")) return;
    pointerOwned.current = false;
    const hit = target?.closest(".shot-hit");
    // Capture the button, not the card. Capturing the card retargets the click
    // away from the button, so a short tap never opens the image.
    if (stylus && !viewer && hit instanceof HTMLElement) {
      try {
        hit.setPointerCapture(pointerId);
      } catch {
        /* a drawing surface may still hold this id; the move below still listens on window */
      }
    }
    let started = false;
    const cleanup = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      if (slopCleanup.current === cleanup) slopCleanup.current = null;
    };
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId || started) return;
      const dx = pointer.clientX - startX;
      const dy = pointer.clientY - startY;
      if (dx * dx + dy * dy < DRAG_SLOP * DRAG_SLOP) return;
      started = true;
      pointerOwned.current = true;
      suppressClick.current = true;
      if (hit instanceof HTMLElement) {
        try {
          hit.setPointerCapture(pointerId);
        } catch {
          /* window listeners still follow the pointer */
        }
      }
      window.removeEventListener("pointermove", move, true);
      onDragStart(item.id, pointer);
    };
    const end = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      cleanup();
      // Let the browser drop capture as the pointer ends. Releasing it here
      // swallows the click that should open the image after a short tap.
      if (!suppressClick.current) return;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };
    slopCleanup.current = cleanup;
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
  };

  const onExportDragStart = (event: React.DragEvent<HTMLButtonElement>) => {
    // The picture is not a native drag source. Chrome would otherwise steal
    // the gesture before the pointer slop, and a cached file never started
    // that drag because the image itself is not draggable.
    event.preventDefault();
  };

  const className = [
    "shot-card",
    dragging ? "is-dragging" : settling ? "is-drag-return" : "",
    selected ? "is-selected" : "",
    tagHot ? "is-tag-hot" : "",
    menu ? "is-menu" : "",
    flash ? "is-flash" : "",
    flash && fading ? "is-fade" : "",
    zoomSource ? "is-zoom-source" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      ref={rootRef}
      data-shot-id={item.id}
      data-fit={fit}
      className={className}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      onPointerDownCapture={onPointerDown}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerEnter={(event) => {
        if (event.currentTarget.closest(".is-shuffle-run")) return;
        if (event.pointerType === "mouse") setHover(true);
        prepareExport();
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.closest(".is-shuffle-run")) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!thumbTiltEnabled(event.pointerType, reduced) || dragging || zoomSource) return;
        const rect = event.currentTarget.getBoundingClientRect();
        tiltTarget.current = thumbTiltFromPointer(
          thumbUnit(event.clientX - (rect.left + rect.width / 2), rect.width / 2),
          thumbUnit(event.clientY - (rect.top + rect.height / 2), rect.height / 2),
        );
        tiltLive.current = true;
        const face = contactRef.current;
        if (face) thumbMotion(face, false);
        if (tiltFrame.current) return;
        const tick = () => {
          tiltFrame.current = 0;
          if (!tiltLive.current) return;
          const next = thumbFollow(tiltShown.current, tiltTarget.current);
          tiltShown.current = next;
          const face = contactRef.current;
          if (face) paintThumb(face, next);
          const goal = tiltTarget.current;
          if (next.x !== goal.x || next.y !== goal.y) tiltFrame.current = requestAnimationFrame(tick);
        };
        tiltFrame.current = requestAnimationFrame(tick);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHover(false);
        if (event.pointerType !== "mouse") return;
        if (dragging || pointerOwned.current) return;
        tiltLive.current = false;
        if (tiltFrame.current) cancelAnimationFrame(tiltFrame.current);
        tiltFrame.current = 0;
        tiltShown.current = THUMB_REST;
        tiltTarget.current = THUMB_REST;
        const face = contactRef.current;
        if (!face) return;
        thumbMotion(face, true);
        paintThumb(face, THUMB_REST);
      }}
      onFocus={() => setHover(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover(false);
      }}
      onDragOver={(event) => {
        if (viewer || !isTagDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        setTagHot(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTagHot(false);
      }}
      onDrop={(event) => {
        if (viewer || !isTagDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        setTagHot(false);
        const tagId = event.dataTransfer.getData(TAG_DRAG) || currentTagDrag();
        if (tagId) onAssignTag(item.id, tagId);
      }}
    >
      {insertEdge ? <span className={insertEdge === "before" ? "shot-edge is-before" : "shot-edge is-after"} /> : null}
      <button
        type="button"
        className="shot-hit"
        draggable={false}
        aria-label={`${item.name}を拡大`}
        aria-expanded={viewer ? undefined : menu}
        onDragStart={onExportDragStart}
        onClick={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            event.preventDefault();
            return;
          }
          const open = () => {
            tiltLive.current = false;
            if (tiltFrame.current) cancelAnimationFrame(tiltFrame.current);
            tiltFrame.current = 0;
            tiltShown.current = THUMB_REST;
            tiltTarget.current = THUMB_REST;
            const face = contactRef.current;
            if (face) {
              thumbMotion(face, false);
              paintThumb(face, THUMB_REST);
            }
            holdGallerySensor();
            const media = face?.querySelector("img, video") ?? frameRef.current;
            onOpen(item.id, zoomRectOf(media) ?? undefined);
          };
          if (viewer) {
            open();
            return;
          }
          if (event.metaKey || event.ctrlKey) {
            onToggleSelect(item.id);
            return;
          }
          open();
        }}
      >
        <div ref={frameRef} className="shot-frame">
          <div className="shot-sensor">
          <div ref={contactRef} className="shot-contact">
          {origin ? <span className="shot-origin">{origin}</span> : null}
          {url && item.mime.startsWith("video/") && !pauseMotion ? (
            <video
              ref={(node) => {
                mediaRef.current = node;
              }}
              src={url}
              muted
              loop
              autoPlay
              playsInline
              width={item.width}
              height={item.height}
              draggable={false}
              style={mediaStyle}
              onLoadedData={(event) => reportRef.current?.loaded(event.currentTarget.videoWidth, event.currentTarget.videoHeight)}
              onError={() => reportRef.current?.failed()}
            />
          ) : url ? (
            <img
              ref={(node) => {
                mediaRef.current = node;
              }}
              src={url}
              alt=""
              width={item.width}
              height={item.height}
              decoding="async"
              draggable={false}
              style={mediaStyle}
              onLoad={(event) => reportRef.current?.loaded(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
              onError={() => reportRef.current?.failed()}
            />
          ) : null}
          {hasInk && inkShown && !item.animated ? (
            <InkStill imageId={item.id} revision={inkRev} style={{ ...mediaStyle, objectFit: "fill" }} />
          ) : null}
          <span className="shot-sheen" aria-hidden="true" />
          {pauseMotion ? (
            <span className="shot-play" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M8.6 6.4v11.2L18 12z" />
              </svg>
            </span>
          ) : null}
          </div>
          </div>
        </div>
      </button>
      {hasInk && !item.animated ? (
        <div className="shot-ink-status">
          <span className="shot-icon shot-ink-mark" aria-label="ペン書き込みあり">
            <Pencil aria-hidden="true" />
          </span>
          <button
            type="button"
            className={inkShown ? "shot-icon is-on" : "shot-icon"}
            aria-pressed={inkShown}
            aria-label={inkShown ? "書き込みを隠す" : "書き込みを表示"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              void setInkVisible(item.id, !inkShown);
            }}
          >
            {inkShown ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          </button>
        </div>
      ) : null}
      {status === "error" || status === "missing" ? (
        <div className="shot-fail">
          <span>{status === "missing" ? "画像データがありません" : "読み込めませんでした"}</span>
          <button
            type="button"
            className="shot-retry"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setStatus("loading");
              setRetryNonce((current) => current + 1);
            }}
          >
            再試行
          </button>
        </div>
      ) : null}
      {viewer ? null : (
      <div className="shot-menu" aria-hidden={!menu}>
        <ShotName name={item.name} active={menu} />
        <p className="shot-meta">
          {item.width} × {item.height}
        </p>
        {item.memo ? <ShotName name={item.memo} active={menu} className="shot-menu-memo" /> : null}
        <div className="shot-actions">
          <button
            type="button"
            className={selected ? "shot-icon is-selected" : "shot-icon"}
            aria-label={selected ? `${item.name}の選択を解除` : `${item.name}を選択`}
            aria-pressed={selected}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onToggleSelect(item.id)}
          >
            <Check aria-hidden="true" />
          </button>
          <button
            type="button"
            className={item.favorite ? "shot-icon is-favorite" : "shot-icon"}
            aria-label={
              bulk && selected
                ? "選択中の画像をすべてお気に入りにする"
                : item.favorite
                  ? `${item.name}のお気に入りを解除`
                  : `${item.name}をお気に入りに追加`
            }
            aria-pressed={item.favorite}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onFavorite(item.id)}
          >
            <Heart aria-hidden="true" fill={item.favorite ? "currentColor" : "none"} />
          </button>
          <button
            ref={deleteTrigger}
            type="button"
            className="shot-icon"
            aria-label={bulk && selected ? "選択中の画像を削除" : `${item.name}を削除`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              const card = rootRef.current?.getBoundingClientRect();
              if (!card) return;
              setDeleteAsk(card);
            }}
          >
            <Trash2 aria-hidden="true" />
          </button>
          {item.animated ? null : hasInk ? (
            <span className="shot-ink-pair">
              <button
                type="button"
                className="shot-icon shot-memo"
                aria-label={`${item.name}のペン書き込み`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onInk(item.id);
                }}
              >
                <Pencil aria-hidden="true" />
              </button>
              <button
                type="button"
                className={inkShown ? "shot-icon shot-ink-toggle is-on" : "shot-icon shot-ink-toggle"}
                aria-pressed={inkShown}
                aria-label={inkShown ? "書き込みを隠す" : "書き込みを表示"}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  void setInkVisible(item.id, !inkShown);
                }}
              >
                {inkShown ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="shot-icon shot-memo"
              aria-label={`${item.name}のペン書き込み`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onInk(item.id);
              }}
            >
              <Pencil aria-hidden="true" />
            </button>
          )}
        </div>
        {tags.length > 0 ? (
          <div className="shot-tags">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className="shot-tag"
                style={{ background: tag.color }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onTagPrompt(item.id, tag.id, event.currentTarget.getBoundingClientRect());
                }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      )}
      {deleteAsk ? (
        <ShotDeleteAsk
          anchor={deleteAsk}
          trigger={deleteTrigger.current}
          body={bulk && selected ? "選択中の画像を削除しますか？" : "この画像を削除しますか？"}
          onCancel={() => setDeleteAsk(null)}
          onConfirm={() => {
            const id = item.id;
            setDeleteAsk(null);
            onDelete(id);
          }}
        />
      ) : null}
    </li>
  );
}
