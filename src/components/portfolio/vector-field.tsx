import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { imagePoint, viewAtRim } from "@/lib/portfolio/purupuru";
import {
  angleFromPoint,
  spanFromDistance,
  vectorEditHit,
  vectorGeometry,
  vectorHalo,
  vectorKindFace,
  vectorSpan,
  VECTOR_PACES,
  type VectorKind,
  type VectorMarker,
} from "@/lib/portfolio/vector-marker";

type Drag =
  | { mode: "move"; pointerId: number; id: number; du: number; dv: number; sx: number; sy: number }
  | { mode: "resize"; pointerId: number; id: number }
  | { mode: "angle"; pointerId: number; id: number };

function Glyph({ kind }: { kind: VectorKind }) {
  if (kind === "orbit" || kind === "orbitBack") {
    const back = kind === "orbitBack";
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path
          d={back ? "M46 16a18 18 0 1 0 4 20" : "M18 16a18 18 0 1 1 -4 20"}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path d={back ? "M44 12 L56 18 L46 28" : "M20 12 L8 18 L18 28"} fill="currentColor" />
      </svg>
    );
  }
  if (kind === "sway") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M14 32 H50" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M18 32 L8 24 L8 40 Z" fill="currentColor" />
        <path d="M46 32 L56 24 L56 40 Z" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "hit") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M10 32 H42" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M40 20 L58 32 L40 44 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 32 L14 18 L22 46 L30 18 L38 46 L46 18 L54 32" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function VectorField({
  markers,
  selectedId,
  interactive,
  width,
  height,
  onSelect,
  onPatch,
}: {
  markers: readonly VectorMarker[];
  selectedId: number | null;
  interactive: boolean;
  width: number;
  height: number;
  onSelect: (id: number | null) => void;
  onPatch: (id: number, patch: Partial<Pick<VectorMarker, "u" | "v" | "view" | "angle" | "span">>) => void;
}) {
  const dragRef = useRef<Drag | null>(null);
  const markersRef = useRef(markers);
  markersRef.current = markers;

  const onDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer can still move inside the photo */
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const hit = vectorEditHit(markersRef.current, selectedId, event.clientX, event.clientY, rect);
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
      const point = imagePoint(event.clientX, event.clientY, rect);
      dragRef.current = {
        mode: "move",
        pointerId: event.pointerId,
        id: hit.id,
        du: marker ? marker.u - point.u : 0,
        dv: marker ? marker.v - point.v : 0,
        sx: event.clientX,
        sy: event.clientY,
      };
      onSelect(hit.id);
      return;
    }
    onSelect(null);
  };

  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (drag.mode === "move") {
      if (Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) < 6) return;
      const point = imagePoint(event.clientX, event.clientY, rect);
      onPatch(drag.id, { u: Math.min(1, Math.max(0, point.u + drag.du)), v: Math.min(1, Math.max(0, point.v + drag.dv)) });
      return;
    }
    const marker = markersRef.current.find((entry) => entry.id === drag.id);
    if (!marker) return;
    if (drag.mode === "angle") {
      const cx = rect.left + marker.u * rect.width;
      const cy = rect.top + marker.v * rect.height;
      const drawn = vectorGeometry(marker, rect).drawn;
      onPatch(drag.id, {
        angle: angleFromPoint(cx, cy, event.clientX, event.clientY),
        span: spanFromDistance(Math.hypot(event.clientX - cx, event.clientY - cy), drawn),
      });
      return;
    }
    const dx = event.clientX - (rect.left + marker.u * rect.width);
    const dy = event.clientY - (rect.top + marker.v * rect.height);
    onPatch(drag.id, { view: viewAtRim(Math.hypot(dx, dy), marker.radius, Math.min(rect.width, rect.height)) });
  };

  const onUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
  };

  return (
    <div
      className="vector-field"
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={interactive ? onDown : undefined}
      onPointerMove={interactive ? onMove : undefined}
      onPointerUp={interactive ? onUp : undefined}
      onPointerCancel={interactive ? onUp : undefined}
    >
      {markers.map((marker) => {
        const face = vectorKindFace(marker.kind);
        const paceLabel = VECTOR_PACES.find((pace) => pace.id === marker.pace)?.label ?? "";
        const geo = vectorGeometry(marker, { width, height });
        const drawn = geo.drawn;
        const pose = { x: 0, y: 0, rotate: (marker.angle * 180) / Math.PI };
        const selected = marker.id === selectedId;
        const diameter = Math.max(8, drawn * 2);
        return (
          <div
            key={marker.id}
            className={selected ? "vector-marker is-selected" : "vector-marker"}
            data-vector-kind={marker.kind}
            data-vector-pace={marker.pace}
            data-vector-span={vectorSpan(marker)}
            style={{
              left: `${marker.u * 100}%`,
              top: `${marker.v * 100}%`,
              width: diameter,
              height: diameter,
              ["--vector" as string]: face.color,
            }}
          >
            <span
              className="vector-halo"
              style={{
                width: "145%",
                height: "145%",
                transform: `translate(-50%, -50%)`,
                background: vectorHalo(face.color),
              }}
            />
            <span className="vector-ring" />
            <span
              className="vector-glyph"
              style={{ transform: `translate(-50%, -50%) translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotate}deg)` }}
            >
              <Glyph kind={marker.kind} />
            </span>
            <span className="vector-speed">{face.label}・{paceLabel}</span>
            {selected && interactive ? (
              <>
                <span className="vector-handle is-n" />
                <span className="vector-handle is-e" />
                <span className="vector-handle is-s" />
                <span className="vector-handle is-w" />
                <span
                  className="vector-handle is-angle"
                  style={{
                    left: `calc(50% + ${geo.hx - geo.cx}px)`,
                    top: `calc(50% + ${geo.hy - geo.cy}px)`,
                  }}
                />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
