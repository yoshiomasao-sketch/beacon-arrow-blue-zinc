import { Check, Heart, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { readPixels } from "@/lib/portfolio/db";
import { commitMemo, type FlowBox } from "@/lib/portfolio/logic";
import { SHOT_TIMEOUT_MS, shotAfterFailure, shotRetryDelay } from "@/lib/portfolio/shot-load";
import { invalidateThumb, loadThumb, peekThumb, pinThumb } from "@/lib/portfolio/thumbs";
import { TAG_DRAG, type ImageMeta, type Tag } from "@/lib/portfolio/types";
import { currentTagDrag, eventIsTagDrag } from "@/lib/portfolio/tag-drag";

const DRAG_SLOP = 6;

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

function isTagDrag(event: React.DragEvent): boolean {
  return eventIsTagDrag(event.dataTransfer.types);
}

export function ImageCard({
  item,
  box,
  tags,
  dragging,
  insertEdge,
  onOpen,
  onDragStart,
  flash,
  fading,
  origin = "",
  selected,
  bulk,
  onToggleSelect,
  onFavorite,
  onDelete,
  onMemo,
  onAssignTag,
  onTagPrompt,
  viewer = false,
}: {
  item: ImageMeta;
  box: FlowBox;
  tags: Tag[];
  dragging: boolean;
  insertEdge: "before" | "after" | null;
  onOpen: (id: string) => void;
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
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLLIElement>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
  const reportRef = useRef<{
    loaded: (width: number, height: number) => void;
    failed: () => void;
  } | null>(null);
  const suppressClick = useRef(false);
  const memoRef = useRef<HTMLFormElement>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const pixelKey = item.animated ? `${item.id}:motion` : item.id;
  const [url, setUrl] = useState<string | null>(() => peekThumb(pixelKey));
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [retryNonce, setRetryNonce] = useState(0);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tagHot, setTagHot] = useState(false);

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
    let useOriginal = item.animated;
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
        return blob;
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
    };
  }, [item.animated, item.id, pixelKey, retryNonce]);

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

  const menu = hover || pinned || memoOpen;
  const fit = menuFit(box.w, box.h);

  useEffect(() => {
    if (!memoOpen) return;
    const block = (event: Event) => {
      const target = event.target as Node | null;
      if (memoRef.current?.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      setMemoOpen(false);
    };
    document.addEventListener("pointerdown", block, true);
    return () => document.removeEventListener("pointerdown", block, true);
  }, [memoOpen]);

  const finishMemo = () => {
    const action = commitMemo(item.memo, draft);
    setMemoOpen(false);
    if (action === "cancel") return;
    onMemo(item.id, action === "clear" ? "" : draft);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLLIElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element | null;
    if (target?.closest(".shot-menu button, .shot-menu a, .shot-menu input, .shot-menu textarea")) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let started = false;
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId || started) return;
      const dx = pointer.clientX - startX;
      const dy = pointer.clientY - startY;
      if (dx * dx + dy * dy < DRAG_SLOP * DRAG_SLOP) return;
      if (viewer) {
        suppressClick.current = true;
        return;
      }
      started = true;
      suppressClick.current = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      onDragStart(item.id, pointer);
    };
    const end = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!suppressClick.current) return;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const className = [
    "shot-card",
    dragging ? "is-dragging" : "",
    selected ? "is-selected" : "",
    tagHot ? "is-tag-hot" : "",
    menu ? "is-menu" : "",
    flash ? "is-flash" : "",
    flash && fading ? "is-fade" : "",
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
      onPointerDown={onPointerDown}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHover(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHover(false);
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
        aria-label={`${item.name}を拡大`}
        aria-expanded={viewer ? undefined : menu}
        onClick={(event) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            event.preventDefault();
            return;
          }
          if (viewer) {
            onOpen(item.id);
            return;
          }
          if (event.metaKey || event.ctrlKey) {
            onToggleSelect(item.id);
            return;
          }
          const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
          if (fine) onOpen(item.id);
          else if (pinned) onOpen(item.id);
          else setPinned(true);
        }}
      >
        <div ref={frameRef} className="shot-frame">
          {origin ? <span className="shot-origin">{origin}</span> : null}
          {url && item.mime.startsWith("video/") ? (
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
              onLoad={(event) => reportRef.current?.loaded(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}
              onError={() => reportRef.current?.failed()}
            />
          ) : null}
        </div>
      </button>
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
            type="button"
            className="shot-icon"
            aria-label={bulk && selected ? "選択中の画像を削除" : `${item.name}を削除`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onDelete(item.id)}
          >
            <Trash2 aria-hidden="true" />
          </button>
          <button
            type="button"
            className="shot-icon shot-memo"
            aria-label={`${item.name}のメモ`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setDraft(item.memo);
              setMemoOpen(true);
            }}
          >
            <Pencil aria-hidden="true" />
          </button>
        </div>
        {memoOpen ? (
          <form
            ref={memoRef}
            className="shot-memo-pop"
            onSubmit={(event) => event.preventDefault()}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              aria-label="メモ"
              value={draft}
              maxLength={100}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") {
                  event.preventDefault();
                  setMemoOpen(false);
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  finishMemo();
                }
              }}
            />
          </form>
        ) : null}
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
    </li>
  );
}
