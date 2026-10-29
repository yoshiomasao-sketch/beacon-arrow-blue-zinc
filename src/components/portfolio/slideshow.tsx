import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { readPixels } from "@/lib/portfolio/db";
import {
  advanceDeck,
  clampSlideSeconds,
  slideshowCandidates,
  startDeck,
  type SlideshowCursor,
  type SlideshowOrder,
} from "@/lib/portfolio/slideshow";
import { notify } from "@/lib/portfolio/store";
import type { ImageMeta } from "@/lib/portfolio/types";

const EMPTY_NOTE = "表示中の画像がないため、スライドショーを開始できません。";

export function Slideshow({
  open,
  items,
  onOpenChange,
}: {
  open: boolean;
  items: ImageMeta[];
  onOpenChange: (open: boolean) => void;
}) {
  const [order, setOrder] = useState<SlideshowOrder>("sequence");
  const [seconds, setSeconds] = useState(5);
  const [showClock, setShowClock] = useState(false);
  const [zoom, setZoom] = useState(true);
  const [play, setPlay] = useState<{
    items: ImageMeta[];
    order: SlideshowOrder;
    seconds: number;
    showClock: boolean;
    zoom: boolean;
  } | null>(null);

  useEffect(() => {
    if (open) return;
    setPlay(null);
    setOrder("sequence");
    setSeconds(5);
    setShowClock(false);
    setZoom(true);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  if (play) {
    return createPortal(
      <SlideshowPlayer
        items={play.items}
        order={play.order}
        seconds={play.seconds}
        showClock={play.showClock}
        zoom={play.zoom}
        onClose={() => onOpenChange(false)}
      />,
      document.body,
    );
  }

  const start = () => {
    const list = slideshowCandidates(items).slice();
    if (list.length === 0) {
      notify(EMPTY_NOTE);
      onOpenChange(false);
      return;
    }
    setPlay({ items: list, order, seconds: clampSlideSeconds(seconds), showClock, zoom });
  };

  return createPortal(
    <div className="slideshow-setup" onPointerDown={() => onOpenChange(false)}>
      <div
        className="slideshow-setup-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideshow-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div>
          <h2 id="slideshow-title" className="m-0 text-base font-medium">
            スライドショー
          </h2>
          <p className="m-0 mt-1 text-sm text-ink-muted">いま一覧に出ている画像を再生します。</p>
        </div>
        <div>
          <p className="m-0 text-sm">画像の順番</p>
          <div className="slideshow-choices" role="group" aria-label="画像の順番">
            <Button variant={order === "sequence" ? "primary" : "quiet"} aria-pressed={order === "sequence"} onClick={() => setOrder("sequence")}>
              順番どおり
            </Button>
            <Button variant={order === "random" ? "primary" : "quiet"} aria-pressed={order === "random"} onClick={() => setOrder("random")}>
              ランダム
            </Button>
          </div>
        </div>
        <label className="text-sm">
          切り替え間隔
          <select
            aria-label="切り替え間隔"
            value={seconds}
            onChange={(event) => setSeconds(clampSlideSeconds(Number(event.target.value)))}
          >
            {Array.from({ length: 60 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                {value}秒
              </option>
            ))}
          </select>
        </label>
        <label className="slideshow-clock-option">
          <input type="checkbox" checked={zoom} onChange={(event) => setZoom(event.target.checked)} />
          ゆっくり拡大する
        </label>
        <label className="slideshow-clock-option">
          <input type="checkbox" checked={showClock} onChange={(event) => setShowClock(event.target.checked)} />
          切り替えまでの秒数を表示
        </label>
        <div className="slideshow-actions">
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={start}>開始</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SlideshowPlayer({
  items,
  order,
  seconds,
  showClock,
  zoom,
  onClose,
}: {
  items: ImageMeta[];
  order: SlideshowOrder;
  seconds: number;
  showClock: boolean;
  zoom: boolean;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [layers, setLayers] = useState<Array<{ token: number; url: string; on: boolean }>>([]);
  const [remaining, setRemaining] = useState(seconds);
  const tokenRef = useRef(0);
  const endsAtRef = useRef(0);
  const showClockRef = useRef(showClock);
  showClockRef.current = showClock;

  useEffect(() => {
    let alive = true;
    const urls = new Map<string, string>();
    let timer = 0;
    let reveal = 0;
    let failures = 0;
    let cursor: SlideshowCursor = startDeck(items.length, order);
    let pending: SlideshowCursor | null = null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const urlFor = async (id: string) => {
      const cached = urls.get(id);
      if (cached) return cached;
      const blob = await readPixels(id, "original");
      if (!blob || !alive) return null;
      const url = URL.createObjectURL(blob);
      urls.set(id, url);
      return url;
    };

    const warm = (index: number | undefined) => {
      const item = index === undefined ? undefined : items[index];
      if (!item) return;
      void urlFor(item.id).then((url) => {
        if (url && alive) void decodeImage(url).catch(() => undefined);
      });
    };

    const show = async (index: number) => {
      if (!alive) return;
      const item = items[index];
      if (!item) return;
      const url = await urlFor(item.id);
      if (!alive) return;
      if (!url) {
        failures += 1;
        if (failures > items.length) return;
        pending = null;
        cursor = advanceDeck(cursor, items.length, order);
        void show(cursor.deck[cursor.at] ?? index);
        return;
      }
      try {
        await decodeImage(url);
      } catch {
        /* A failed decode still tries the blob URL. */
      }
      if (!alive) return;
      failures = 0;
      const token = tokenRef.current + 1;
      tokenRef.current = token;
      setLayers((current) => [...current.map((layer) => ({ ...layer, on: false })), { token, url, on: false }].slice(-2));
      reveal = window.requestAnimationFrame(() => {
        reveal = window.requestAnimationFrame(() => {
          if (!alive) return;
          setLayers((current) => current.map((layer) => (layer.token === token ? { ...layer, on: true } : layer)));
        });
      });
      pending = advanceDeck(cursor, items.length, order);
      warm(pending.deck[pending.at]);
      const endsAt = performance.now() + seconds * 1000;
      endsAtRef.current = endsAt;
      if (showClockRef.current) setRemaining(seconds);
      timer = window.setTimeout(() => {
        if (!alive || !pending) return;
        cursor = pending;
        pending = null;
        void show(cursor.deck[cursor.at] ?? 0);
      }, endsAt - performance.now());
    };

    void show(cursor.deck[cursor.at] ?? 0);

    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey, true);

    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(reveal);
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, [items, order, seconds]);

  useEffect(() => {
    if (!showClock) return;
    const tick = () => {
      const endsAt = endsAtRef.current;
      if (endsAt <= 0) return;
      const next = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
      setRemaining((current) => (current === next ? current : next));
    };
    tick();
    const clock = window.setInterval(tick, 200);
    return () => {
      window.clearInterval(clock);
      endsAtRef.current = 0;
    };
  }, [showClock]);

  return (
    <div
      className="slideshow-stage"
      role="button"
      tabIndex={0}
      aria-label="スライドショーを終了"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      {layers.map((layer) => (
        <div
          key={layer.token}
          className={layer.on ? "slideshow-photo is-on" : "slideshow-photo"}
          data-zoom={zoom ? "on" : "off"}
          style={{ ["--slide-ms" as string]: `${seconds * 1000}ms` }}
        >
          <img src={layer.url} alt="" draggable={false} />
        </div>
      ))}
      {showClock ? (
        <p className="slideshow-remaining" aria-live="polite">
          {remaining} 秒
        </p>
      ) : null}
    </div>
  );
}

function decodeImage(url: string): Promise<void> {
  const image = new Image();
  image.decoding = "async";
  const ready = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("load"));
  });
  image.src = url;
  if (typeof image.decode === "function") return image.decode().catch(() => ready);
  return ready;
}
