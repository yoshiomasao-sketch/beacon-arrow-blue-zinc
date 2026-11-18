import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { EFFECT_ASSET_URL, effectImage, primeEffectAssets } from "@/lib/portfolio/effect-assets";
import {
  effectDrawSize,
  effectEditHit,
  effectKindFace,
  effectOpacity,
  effectPhase,
  effectResize,
  effectTurn,
  EFFECT_PACES,
  type EffectMarker,
} from "@/lib/portfolio/effect-marker";
import { BackbeatMark } from "@/components/portfolio/vector-field";
import { GoldArc } from "@/components/portfolio/gold-arc";

type Drag =
  | { mode: "move"; pointerId: number; id: number; du: number; dv: number; sx: number; sy: number }
  | { mode: "resize"; pointerId: number; id: number }
  | { mode: "angle"; pointerId: number; id: number };

export function EffectField({
  markers,
  selectedId,
  editing,
  playing,
  hold = false,
  origin,
  width,
  height,
  onSelect,
  onPatch,
  onBackbeat,
}: {
  markers: readonly EffectMarker[];
  selectedId: number | null;
  editing: boolean;
  playing: boolean;
  /** Leave the current frame in place. Playback time continues from here when this turns off. */
  hold?: boolean;
  origin: number;
  width: number;
  height: number;
  onSelect: (id: number | null) => void;
  onPatch: (id: number, patch: Partial<Pick<EffectMarker, "u" | "v" | "size" | "angle" | "pace">>) => void;
  onBackbeat: (id: number) => void;
}) {
  const dragRef = useRef<Drag | null>(null);
  const tapRef = useRef<{ id: number; at: number; x: number; y: number } | null>(null);
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const [now, setNow] = useState(0);
  const [, setLoaded] = useState(0);
  const skewRef = useRef(0);

  useEffect(() => {
    skewRef.current = 0;
  }, [origin]);

  useEffect(() => {
    let alive = true;
    void primeEffectAssets().then(() => {
      if (alive) setLoaded((value) => value + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (hold) {
      const heldAt = performance.now();
      return () => {
        skewRef.current += performance.now() - heldAt;
      };
    }
    let frame = 0;
    const tick = () => {
      setNow(performance.now() - skewRef.current);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [playing, hold, origin]);

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editing || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer can still move inside the photo */
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const hit = effectEditHit(markersRef.current, selectedId, event.clientX, event.clientY, rect);
    if (hit?.action === "angle") {
      dragRef.current = { mode: "angle", pointerId: event.pointerId, id: hit.id };
      onSelect(hit.id);
      return;
    }
    if (hit?.action === "resize") {
      dragRef.current = { mode: "resize", pointerId: event.pointerId, id: hit.id };
      onSelect(hit.id);
      return;
    }
    if (hit?.action === "move") {
      const marker = markersRef.current.find((entry) => entry.id === hit.id);
      const u = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
      const v = rect.height > 0 ? (event.clientY - rect.top) / rect.height : 0;
      dragRef.current = {
        mode: "move",
        pointerId: event.pointerId,
        id: hit.id,
        du: marker ? marker.u - u : 0,
        dv: marker ? marker.v - v : 0,
        sx: event.clientX,
        sy: event.clientY,
      };
      onSelect(hit.id);
      return;
    }
    dragRef.current = null;
    onSelect(null);
  };

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!editing || !drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const marker = markersRef.current.find((entry) => entry.id === drag.id);
    if (!marker) return;
    if (drag.mode === "move") {
      if (Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) < 6) return;
      const u = rect.width > 0 ? (event.clientX - rect.left) / rect.width : marker.u;
      const v = rect.height > 0 ? (event.clientY - rect.top) / rect.height : marker.v;
      onPatch(drag.id, { u: Math.min(1, Math.max(0, u + drag.du)), v: Math.min(1, Math.max(0, v + drag.dv)) });
      return;
    }
    if (drag.mode === "angle") {
      onPatch(drag.id, { angle: effectTurn(marker, event.clientX, event.clientY, rect).angle });
      return;
    }
    onPatch(drag.id, { size: effectResize(marker, event.clientX, event.clientY, rect).size });
  };

  const onUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      const moved = drag.mode === "move" && Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) >= 6;
      const id = drag.id;
      const mode = drag.mode;
      dragRef.current = null;
      if (mode === "move" && !moved) {
        const now = event.timeStamp;
        const prev = tapRef.current;
        if (prev && prev.id === id && now - prev.at <= 450 && Math.hypot(event.clientX - prev.x, event.clientY - prev.y) <= 22) {
          tapRef.current = null;
          onBackbeat(id);
          return;
        }
        tapRef.current = { id, at: now, x: event.clientX, y: event.clientY };
      } else {
        tapRef.current = null;
      }
      return;
    }
    tapRef.current = null;
  };

  const elapsed = playing ? Math.max(0, now - origin) : 0;
  const rows = markers.flatMap((marker) => {
    const parked = marker.off === true;
    if (parked && !editing) return [];
    const draw = effectDrawSize(marker, { width, height });
    const gold = marker.kind === "gold";
    const splash = playing && !gold ? effectOpacity(marker.pace, elapsed, marker.backbeat === true) : 1;
    const phase = playing && gold ? effectPhase(marker.pace, elapsed, marker.backbeat === true) : 0;
    const showArt = editing || splash > 0;
    const showBeat = editing && marker.backbeat === true;
    if (!showArt && !showBeat) return [];
    return [
      {
        marker,
        draw,
        splash,
        phase,
        showArt,
        showBeat,
        image: effectImage(marker.asset),
        face: effectKindFace(marker.kind),
        pace: EFFECT_PACES.find((entry) => entry.id === marker.pace)?.label ?? "",
        selected: editing && marker.id === selectedId,
        parked,
      },
    ];
  });
  const pin = (marker: Pick<EffectMarker, "u" | "v" | "angle">, draw: { w: number; h: number }, color: string) => ({
    left: `${marker.u * 100}%`,
    top: `${marker.v * 100}%`,
    width: draw.w,
    height: draw.h,
    transform: `translate(-50%, -50%) rotate(${marker.angle}rad)`,
    ["--effect" as string]: color,
  });

  return (
    <div
      className={editing ? "effect-field is-editing" : "effect-field"}
      style={{ pointerEvents: editing ? "auto" : "none" }}
      onPointerDown={editing ? onDown : undefined}
      onPointerMove={editing ? onMove : undefined}
      onPointerUp={editing ? onUp : undefined}
      onPointerCancel={editing ? onUp : undefined}
    >
      <div className="effect-clip">
        {rows.map((row) =>
          row.showArt ? (
            <div key={row.marker.id} className={row.parked ? "effect-marker is-off" : "effect-marker"} style={pin(row.marker, row.draw, row.face.color)}>
              {row.image ? (
                row.marker.kind === "gold" ? (
                  <GoldArc image={row.image} phase={row.phase} width={row.draw.w} height={row.draw.h} flip={row.marker.flip === true} />
                ) : (
                  <img
                    src={EFFECT_ASSET_URL[row.marker.asset]}
                    alt=""
                    draggable={false}
                    style={{ opacity: playing ? row.splash : 1, transform: row.marker.flip ? "scaleX(-1)" : undefined }}
                  />
                )
              ) : editing ? (
                <span className="effect-missing" />
              ) : null}
            </div>
          ) : null,
        )}
      </div>
      {editing
        ? rows.map((row) => (
            <div
              key={`chrome-${row.marker.id}`}
              className={["effect-marker", "is-chrome", row.selected ? "is-selected" : "", row.parked ? "is-off" : ""].filter(Boolean).join(" ")}
              data-backbeat={row.marker.backbeat ? "1" : "0"}
              style={pin(row.marker, row.draw, row.face.color)}
            >
              {row.showBeat ? <BackbeatMark length={Math.min(row.draw.w, row.draw.h)} /> : null}
              <span className="effect-box" />
              {row.selected ? (
                <>
                  <span className="effect-handle is-nw" />
                  <span className="effect-handle is-ne" />
                  <span className="effect-handle is-se" />
                  <span className="effect-handle is-sw" />
                  <span className="effect-handle is-angle" />
                  <span className="effect-pace">{row.pace}</span>
                </>
              ) : null}
            </div>
          ))
        : null}
    </div>
  );
}
