import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PURU_GRID, PURU_VIEW_REST, fillDisplacement, meshSheen, restBody, restViewBody, stepView, viewShift, type PuruMarker, type PuruView } from "./purupuru.ts";

const size = { width: 400, height: 400 };

function marker(kind: PuruMarker["kind"], u = 0.5, v = 0.5, radius = 0.28): PuruMarker {
  return { id: 1, kind, u, v, radius };
}

describe("lightbox mesh pose", () => {
  it("leans only the mesh that is already there", () => {
    const wide = marker("soft", 0.5, 0.5, 0.46);
    const right = viewShift([wide], { ...PURU_VIEW_REST, ry: 8 }, 390, 200, size.width, size.height);
    const left = viewShift([wide], { ...PURU_VIEW_REST, ry: 8 }, 10, 200, size.width, size.height);
    const mid = viewShift([wide], { ...PURU_VIEW_REST, ry: 8 }, 200, 200, size.width, size.height);
    assert.ok(right.x < -4);
    assert.ok(left.x > 4);
    assert.ok(Math.abs(mid.x) < 1);
    const up = viewShift([wide], { ...PURU_VIEW_REST, rx: 8 }, 200, 10, size.width, size.height);
    const down = viewShift([wide], { ...PURU_VIEW_REST, rx: 8 }, 200, 390, size.width, size.height);
    assert.ok(up.y > 4);
    assert.ok(down.y < -4);
    assert.deepEqual(viewShift([], { ...PURU_VIEW_REST, ry: 8 }, 390, 200, size.width, size.height), { x: 0, y: 0 });
    assert.deepEqual(viewShift([marker("mid", 0.5, 0.5, 0.12)], { ...PURU_VIEW_REST, ry: 8 }, 390, 200, size.width, size.height), { x: 0, y: 0 });
    const slow = viewShift([wide], { ...PURU_VIEW_REST, pullX: 20, grabU: 0.5, grabV: 0.5 }, 200, 200, size.width, size.height);
    const fast = viewShift([wide], { ...PURU_VIEW_REST, pullX: 20, grabU: 0.5, grabV: 0.5, vx: 980 }, 200, 200, size.width, size.height);
    assert.ok(fast.x > slow.x + 4);
  });

  it("pulls hardest at the grab and respects marker strength", () => {
    const view: PuruView = { ...PURU_VIEW_REST, pullX: 80, pullY: 0, grabU: 0.75, grabV: 0.5 };
    const near = viewShift([marker("soft", 0.75, 0.5)], view, 300, 200, size.width, size.height);
    const far = viewShift([marker("soft", 0.75, 0.5)], view, 20, 20, size.width, size.height);
    assert.ok(near.x > 8);
    assert.ok(far.x < near.x * 0.5);
    const firm = viewShift([marker("firm")], { ...PURU_VIEW_REST, pullX: 100 }, 200, 200, size.width, size.height);
    const weak = viewShift([marker("firm-low")], { ...PURU_VIEW_REST, pullX: 100 }, 200, 200, size.width, size.height);
    assert.ok(firm.x > weak.x);
  });

  it("keeps a still circle fixed and does not invent mesh past the markers", () => {
    const pin = marker("still", 0.5, 0.5, 0.2);
    const pull = { ...PURU_VIEW_REST, pullX: 100, grabU: 0.5, grabV: 0.5 };
    assert.deepEqual(viewShift([pin], pull, 200, 200, size.width, size.height), { x: 0, y: 0 });
    assert.deepEqual(viewShift([pin], pull, 20, 20, size.width, size.height), { x: 0, y: 0 });
    const soft = marker("soft", 0.5, 0.5, 0.28);
    const out = new Float32Array(PURU_GRID * PURU_GRID * 2);
    fillDisplacement([soft, pin], [restBody(), restBody()], size.width, size.height, out, pull);
    const at = (grid: Float32Array, col: number, row: number) => {
      const index = (row * PURU_GRID + col) * 2;
      return Math.hypot(grid[index] ?? 0, grid[index + 1] ?? 0);
    };
    const mid = Math.round((PURU_GRID - 1) / 2);
    const moved = (col: number, row: number) => {
      const x = (col / (PURU_GRID - 1)) * size.width;
      const y = (row / (PURU_GRID - 1)) * size.height;
      const raw = viewShift([soft, pin], pull, x, y, size.width, size.height);
      return { here: at(out, col, row), raw: Math.hypot(raw.x, raw.y) };
    };
    const center = moved(mid, mid);
    const band = moved(mid + 8, mid);
    const edge = moved(0, 0);
    assert.ok(center.here < 1);
    assert.ok(band.raw > 1);
    assert.ok(band.here < band.raw);
    assert.equal(edge.here, 0);
    assert.equal(edge.raw, 0);
  });

  it("lags behind a pose and overshoots the pull without dropping the remaining tilt", () => {
    let body = restViewBody();
    const held: PuruView = { ...PURU_VIEW_REST, ry: 8, pullX: 70 };
    for (let i = 0; i < 3; i += 1) body = stepView(body, held, 1 / 60);
    assert.ok(body.ry > 0 && body.ry < 8);
    assert.ok(body.pullX > 0 && body.pullX < 70);
    for (let i = 0; i < 180; i += 1) body = stepView(body, held, 1 / 60);
    assert.ok(Math.abs(body.ry - 8) < 0.4);
    let minPull = body.pullX;
    const rest = { ...PURU_VIEW_REST, ry: 6 };
    for (let i = 0; i < 180; i += 1) {
      body = stepView(body, rest, 1 / 60);
      minPull = Math.min(minPull, body.pullX);
    }
    assert.ok(minPull < -4);
    assert.ok(Math.abs(body.pullX) < 1);
    assert.ok(Math.abs(body.ry - 6) < 0.4);
  });

  it("keeps the gloss band on the picture and moves it with the cursor", () => {
    assert.ok(Math.abs(meshSheen(0.5, 0.5, 0, 0, 0.55, 0) - 0.275) < 0.001);
    assert.equal(meshSheen(0.02, 0.02, 0, 0, 0.55, 0), 0);
    const center = meshSheen(0.5, 0.5, 18, 0, 0.55, 0);
    const shifted = meshSheen(0.5 + 0.18 * 1.84, 0.5, 18, 0, 0.55, 0);
    assert.ok(center < 0.2);
    assert.ok(shifted > 0.2);
    assert.equal(meshSheen(0.5, 0.5, 0, 0, 0, 0), 0);
  });
});
