import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  PURU_GRID,
  driveFromMotion,
  fillDisplacement,
  puruMotionSpace,
  restViewBody,
  stepBodies,
  stepHits,
  stepView,
  stillHold,
  type PuruBody,
  type PuruHit,
  type PuruMarker,
  type PuruSample,
  type PuruView,
  type PuruViewBody,
} from "@/lib/portfolio/purupuru";
import { capShift, vectorOnMesh, type VectorMarker } from "@/lib/portfolio/vector-marker";

const VERT = `
attribute vec2 aUv;
attribute vec2 aDisp;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vec2 px = aUv * uSize + aDisp;
  gl_Position = vec4(px.x / uSize.x * 2.0 - 1.0, 1.0 - px.y / uSize.y * 2.0, 0.0, 1.0);
  vUv = aUv;
}
`;

const SHEEN = `
float sheenBand(vec2 uv, vec4 sheen) {
  if (sheen.z <= 0.001) return 0.0;
  float rad = radians(sheen.w);
  vec2 travel = sheen.xy * 0.01 * 1.84;
  vec2 p = uv - vec2(0.5) - travel;
  float c = cos(rad);
  float s = sin(rad);
  vec2 e = vec2(c * p.x + s * p.y, -s * p.x + c * p.y) / 1.84 + vec2(0.5);
  float ang = radians(108.0);
  vec2 dir = vec2(sin(ang), -cos(ang));
  float extent = 0.5 * (abs(dir.x) + abs(dir.y));
  float g = dot(e - vec2(0.5), dir) / (2.0 * extent) + 0.5;
  float d = abs(g - 0.5);
  float band = 0.0;
  if (d < 0.04) band = mix(0.5, 0.16, d / 0.04);
  else if (d < 0.14) band = 0.16 * (1.0 - (d - 0.04) / 0.1);
  return band * sheen.z;
}
`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uImage;
uniform vec4 uSheen;
${SHEEN}
void main() {
  vec4 img = texture2D(uImage, vUv);
  float band = sheenBand(vUv, uSheen);
  gl_FragColor = vec4(mix(img.rgb, vec3(1.0), band), img.a);
}
`;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function PuruMesh({
  sourceRef,
  width,
  height,
  markersRef,
  driveRef,
  viewRef,
  impulseRef,
  vectorRef,
  onImpulse,
  style,
  onReady,
  surfaceRef,
  still = false,
}: {
  sourceRef: RefObject<HTMLImageElement | HTMLVideoElement | null>;
  width: number;
  height: number;
  markersRef: RefObject<PuruMarker[]>;
  driveRef: RefObject<PuruSample>;
  viewRef?: RefObject<PuruView | null>;
  impulseRef?: RefObject<PuruHit[]>;
  /** Vector playback. Null or not playing leaves the puru mesh alone. */
  vectorRef?: RefObject<{ playing: boolean; origin: number; markers: readonly VectorMarker[] }>;
  onImpulse?: (active: boolean) => void;
  style: CSSProperties;
  onReady: (ok: boolean) => void;
  /** The same canvas the mesh draws into, so a later filter can read the warped picture. */
  surfaceRef?: RefObject<HTMLCanvasElement | null>;
  /** Keep the last drawn frame. The mesh loop stays so playback can continue afterwards. */
  still?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onImpulseRef = useRef(onImpulse);
  onImpulseRef.current = onImpulse;
  const stillRef = useRef(false);
  stillRef.current = still;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width < 2 || height < 2) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: true });
    if (!gl) {
      onReadyRef.current(false);
      return;
    }
    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = vert && frag ? gl.createProgram() : null;
    if (!vert || !frag || !program) {
      onReadyRef.current(false);
      return;
    }
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.bindAttribLocation(program, 0, "aUv");
    gl.bindAttribLocation(program, 1, "aDisp");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      onReadyRef.current(false);
      return;
    }
    gl.useProgram(program);

    const cols = PURU_GRID;
    const uv = new Float32Array(cols * cols * 2);
    const disp = new Float32Array(cols * cols * 2);
    const indices = new Uint16Array((cols - 1) * (cols - 1) * 6);
    let index = 0;
    for (let row = 0; row < cols; row++) {
      for (let col = 0; col < cols; col++) {
        const vertex = row * cols + col;
        uv[vertex * 2] = col / (cols - 1);
        uv[vertex * 2 + 1] = row / (cols - 1);
        if (row < cols - 1 && col < cols - 1) {
          const next = vertex + cols;
          indices[index++] = vertex;
          indices[index++] = next;
          indices[index++] = vertex + 1;
          indices[index++] = vertex + 1;
          indices[index++] = next;
          indices[index++] = next + 1;
        }
      }
    }
    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const dispBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, dispBuf);
    gl.bufferData(gl.ARRAY_BUFFER, disp, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    const indexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(program, "uImage"), 0);
    const sizeLoc = gl.getUniformLocation(program, "uSize");
    const sheenLoc = gl.getUniformLocation(program, "uSheen");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const bodies = new Map<number, PuruBody>();
    let uploadedSrc = "";
    let readySrc = "";
    let hidden = false;
    let prevSample: PuruSample | null = null;
    let prevFrame = 0;
    let pausedAt = 0;
    let viewBody: PuruViewBody = restViewBody();
    let prevPose = { pullX: 0, pullY: 0, rx: 0, ry: 0 };
    let told = false;
    let hitsWere = false;
    let raf = 0;
    let alive = true;
    const markLoaded = () => {
      const source = sourceRef.current;
      if (source instanceof HTMLImageElement && source.complete && source.naturalWidth > 0) readySrc = source.currentSrc || source.src;
    };
    const sourceNode = sourceRef.current;
    if (sourceNode instanceof HTMLImageElement) {
      sourceNode.addEventListener("load", markLoaded);
      markLoaded();
    }

    const draw = (now: number) => {
      if (!alive) return;
      raf = window.requestAnimationFrame(draw);
      const source = sourceRef.current;
      if (!(source instanceof HTMLImageElement)) return;
      const stamp = source.currentSrc || source.src;
      if (!stamp || stamp !== readySrc || !source.complete || source.naturalWidth < 1) {
        if (!hidden && uploadedSrc) {
          hidden = true;
          setShown(false);
          onReadyRef.current(false);
        }
        return;
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.max(1, Math.round(width * dpr));
      const bh = Math.max(1, Math.round(height * dpr));
      const resized = canvas.width !== bw || canvas.height !== bh;
      if (resized) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, dispBuf);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuf);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (uploadedSrc !== stamp) {
        const switched = uploadedSrc !== "";
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
        uploadedSrc = stamp;
        bodies.clear();
        prevSample = null;
        prevFrame = 0;
        viewBody = restViewBody();
        if (switched && impulseRef) impulseRef.current = [];
        hidden = false;
        told = false;
      }
      const frozen = stillRef.current;
      if (frozen) {
        if (!pausedAt) pausedAt = now;
        if (prevFrame !== 0 && !resized) return;
      } else if (pausedAt) {
        const vector = vectorRef?.current;
        if (vector?.playing) vector.origin += now - pausedAt;
        pausedAt = 0;
        prevFrame = now;
      }
      const sample = driveRef.current ?? { x: 0, y: 0, scale: 1, t: 0 };
      const drive = frozen ? { vx: 0, vy: 0, dScale: 0 } : driveFromMotion(prevSample, sample, now);
      if (!frozen) prevSample = { x: sample.x, y: sample.y, scale: sample.scale, t: sample.t };
      const step = frozen ? 0 : prevFrame ? Math.min(0.05, (now - prevFrame) / 1000) : 1 / 60;
      prevFrame = now;
      const markers = markersRef.current ?? [];
      const minSide = Math.min(width, height);
      const space = puruMotionSpace(minSide, viewRef !== undefined);
      const posed = markers.length ? stepBodies(markers, bodies, drive, step, space) : [];
      if (!markers.length) bodies.clear();
      const target = viewRef?.current ?? null;
      viewBody = target ? stepView(viewBody, target, step) : restViewBody();
      const dt = Math.max(step, 1 / 120);
      const limit = (value: number, cap: number) => Math.max(-cap, Math.min(cap, value));
      const speed = target
        ? {
            vx: limit((target.pullX - prevPose.pullX) / dt, 1600),
            vy: limit((target.pullY - prevPose.pullY) / dt, 1600),
            drx: limit((target.rx - prevPose.rx) / dt, 160),
            dry: limit((target.ry - prevPose.ry) / dt, 160),
          }
        : { vx: 0, vy: 0, drx: 0, dry: 0 };
      prevPose = target
        ? { pullX: target.pullX, pullY: target.pullY, rx: target.rx, ry: target.ry }
        : { pullX: 0, pullY: 0, rx: 0, ry: 0 };
      const viewLive =
        target &&
        (Math.abs(target.rx) > 0.04 ||
          Math.abs(target.ry) > 0.04 ||
          Math.abs(target.pullX) > 0.3 ||
          Math.abs(target.pullY) > 0.3 ||
          Math.abs(viewBody.rx) > 0.04 ||
          Math.abs(viewBody.ry) > 0.04 ||
          Math.abs(viewBody.pullX) > 0.3 ||
          Math.abs(viewBody.pullY) > 0.3 ||
          Math.hypot(speed.vx, speed.vy) > 40 ||
          Math.hypot(speed.drx, speed.dry) > 8)
          ? { ...viewBody, ...speed }
          : null;
      const hits = impulseRef ? stepHits(impulseRef.current ?? [], step, minSide) : [];
      if (impulseRef) impulseRef.current = hits;
      const hitLive = hits.length > 0;
      if (hitLive !== hitsWere) {
        hitsWere = hitLive;
        onImpulseRef.current?.(hitLive);
      }
      fillDisplacement(markers, posed, width, height, disp, viewLive, hitLive ? hits : null);
      const vector = vectorRef?.current;
      if (vector?.playing && vector.markers.length && markers.length) {
        const elapsed = Math.max(0, (frozen ? pausedAt : now) - vector.origin);
        const cap = minSide * 0.34;
        for (let row = 0; row < cols; row++) {
          const y = (row / (cols - 1)) * height;
          for (let col = 0; col < cols; col++) {
            const x = (col / (cols - 1)) * width;
            const extra = vectorOnMesh(vector.markers, markers, elapsed, x, y, width, height);
            if (extra.x === 0 && extra.y === 0) continue;
            const open = 1 - stillHold(markers, x, y, width, height);
            const index = (row * cols + col) * 2;
            const mixed = capShift({ x: disp[index]! + extra.x * open, y: disp[index + 1]! + extra.y * open }, cap);
            disp[index] = mixed.x;
            disp[index + 1] = mixed.y;
          }
        }
      }
      const stage = canvas.closest(".lightbox-stage");
      const sheenX = stage instanceof HTMLElement ? Number.parseFloat(stage.style.getPropertyValue("--sheen-x")) || 0 : 0;
      const sheenY = stage instanceof HTMLElement ? Number.parseFloat(stage.style.getPropertyValue("--sheen-y")) || 0 : 0;
      const sheenO = stage instanceof HTMLElement ? Number.parseFloat(stage.style.getPropertyValue("--sheen-o")) || 0 : 0;
      const sheenT = stage instanceof HTMLElement ? Number.parseFloat(stage.style.getPropertyValue("--sheen-turn")) || 0 : 0;
      gl.uniform2f(sizeLoc, width, height);
      gl.uniform4f(sheenLoc, sheenX, sheenY, sheenO, sheenT);
      gl.bindBuffer(gl.ARRAY_BUFFER, dispBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, disp);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      if (!told || hidden) {
        told = true;
        hidden = false;
        setShown(true);
        onReadyRef.current(true);
      }
    };
    raf = window.requestAnimationFrame(draw);
    if (surfaceRef) surfaceRef.current = canvas;
    return () => {
      alive = false;
      window.cancelAnimationFrame(raf);
      if (surfaceRef) surfaceRef.current = null;
      if (sourceNode instanceof HTMLImageElement) sourceNode.removeEventListener("load", markLoaded);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(uvBuf);
      gl.deleteBuffer(dispBuf);
      gl.deleteBuffer(indexBuf);
      gl.deleteTexture(texture);
    };
  }, [width, height, sourceRef, markersRef, driveRef, viewRef, impulseRef, vectorRef, surfaceRef]);

  const opacity = shown ? (typeof style.opacity === "number" ? style.opacity : 1) : 0;
  return <canvas ref={canvasRef} className="puru-mesh" aria-hidden="true" style={{ ...style, pointerEvents: "none", opacity }} />;
}
