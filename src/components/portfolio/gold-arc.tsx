import { useEffect, useRef, useState } from "react";
import { GOLD_COLS, GOLD_PAD_X, GOLD_PAD_Y, GOLD_ROWS, goldVertex } from "@/lib/portfolio/gold-arc";

const VERT = `
attribute vec2 aPos;
attribute vec2 aUv;
varying vec2 vUv;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  vUv = aUv;
}
`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uImage;
void main() {
  gl_FragColor = texture2D(uImage, clamp(vUv, 0.0, 1.0));
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

function indices(): Uint16Array {
  const out = new Uint16Array(GOLD_COLS * GOLD_ROWS * 6);
  let n = 0;
  const stride = GOLD_COLS + 1;
  for (let row = 0; row < GOLD_ROWS; row += 1) {
    for (let col = 0; col < GOLD_COLS; col += 1) {
      const i = row * stride + col;
      out[n++] = i;
      out[n++] = i + 1;
      out[n++] = i + stride;
      out[n++] = i + 1;
      out[n++] = i + stride + 1;
      out[n++] = i + stride;
    }
  }
  return out;
}

/**
 * Draws splash_03 as a warped mesh. The parent box stays the still sheet;
 * the canvas is larger so the stream can rise past that box. The right nozzle stays put.
 */
export function GoldArc({ image, phase, width, height, flip = false }: { image: HTMLImageElement; phase: number; width: number; height: number; flip?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const drawRef = useRef<(() => void) | null>(null);
  const [plain, setPlain] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width < 2 || height < 2 || image.naturalWidth < 2) return;
    const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) {
      setPlain(true);
      return;
    }
    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.bindAttribLocation(program, 0, "aPos");
    gl.bindAttribLocation(program, 1, "aUv");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    const pos = gl.getAttribLocation(program, "aPos");
    const uv = gl.getAttribLocation(program, "aUv");
    const buffer = gl.createBuffer();
    const index = gl.createBuffer();
    const texture = gl.createTexture();
    if (!buffer || !index || !texture) return;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices(), gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    const count = (GOLD_COLS + 1) * (GOLD_ROWS + 1);
    const data = new Float32Array(count * 4);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = width * (1 + GOLD_PAD_X * 2);
    const cssH = height * (1 + GOLD_PAD_Y * 2);
    canvas.width = Math.max(2, Math.round(cssW * dpr));
    canvas.height = Math.max(2, Math.round(cssH * dpr));
    const draw = () => {
      const pose = phaseRef.current;
      let n = 0;
      for (let row = 0; row <= GOLD_ROWS; row += 1) {
        for (let col = 0; col <= GOLD_COLS; col += 1) {
          const vertex = goldVertex(col, row, pose);
          data[n++] = vertex.x;
          data[n++] = vertex.y;
          data[n++] = vertex.u;
          data[n++] = vertex.v;
        }
      }
      gl.useProgram(program);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(pos);
      gl.enableVertexAttribArray(uv);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, GOLD_COLS * GOLD_ROWS * 6, gl.UNSIGNED_SHORT, 0);
    };
    drawRef.current = draw;
    draw();
    return () => {
      drawRef.current = null;
      gl.deleteBuffer(buffer);
      gl.deleteBuffer(index);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
    };
  }, [image, width, height]);

  useEffect(() => {
    drawRef.current?.();
  }, [phase, width, height, image]);

  if (plain) return <img src={image.src} alt="" draggable={false} style={{ transform: flip ? "scaleX(-1)" : undefined }} />;
  return (
    <canvas
      ref={canvasRef}
      className="gold-arc"
      aria-hidden="true"
      style={{
        left: `${-GOLD_PAD_X * 100}%`,
        top: `${-GOLD_PAD_Y * 100}%`,
        width: `${(1 + GOLD_PAD_X * 2) * 100}%`,
        height: `${(1 + GOLD_PAD_Y * 2) * 100}%`,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
}
