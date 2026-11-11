import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { readPixels } from "@/lib/portfolio/db";
import {
  FLOW_PX_PER_SEC,
  flowDirection,
  flowPrefix,
  flowRowHeights,
  flowTileWidth,
  flowTiles,
  type FlowRows,
} from "@/lib/portfolio/flow-saver";
import { slideshowCandidates } from "@/lib/portfolio/slideshow";
import { peekThumb } from "@/lib/portfolio/thumbs";
import type { ImageMeta } from "@/lib/portfolio/types";

const LOAD_AT_ONCE = 2;

/**
 * Still images from the current gallery, flowing in one, two, or three bands.
 * The strip keeps moving while pictures load. Only the tiles near the screen exist.
 */
export function FlowSaver({
  items,
  rows,
  orders,
}: {
  items: readonly ImageMeta[];
  rows: FlowRows;
  orders: readonly (readonly number[])[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pictures = useMemo(() => slideshowCandidates(items), [items]);
  const signature = pictures.map((item) => `${item.id}:${item.width}x${item.height}`).join("|");
  const ordersKey = orders.map((order) => order.join(".")).join("|");
  const picturesRef = useRef(pictures);
  picturesRef.current = pictures;
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  useLayoutEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const apply = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const heights = size.height > 0 ? flowRowHeights(size.height, rows) : [];

  useEffect(() => {
    const root = rootRef.current;
    const picturesNow = picturesRef.current;
    const ordersNow = ordersRef.current;
    if (!root || picturesNow.length === 0 || size.height <= 0 || size.width <= 0) return;
    let alive = true;
    const heightsNow = flowRowHeights(size.height, rows);
    const sequences = heightsNow.map((_, row) => {
      const order = ordersNow[row] ?? [];
      return order.map((index) => picturesNow[index]).filter((item): item is ImageMeta => !!item);
    });
    const models = heightsNow.map((height, row) => {
      const sequence = sequences[row] ?? [];
      const widths = sequence.map((item) => flowTileWidth(height, item.width, item.height));
      const prefix = flowPrefix(widths);
      return { height, prefix, base: prefix[prefix.length - 1] ?? 0, sequence };
    });
    const distances = models.map((model, index) => (model.base * index) / Math.max(1, models.length));
    const pools = models.map(() => new Map<string, HTMLDivElement>());
    const cache = new Map<string, string>();
    const inflight = new Set<string>();
    const queued = new Set<string>();
    const queue: string[] = [];

    const paint = (img: HTMLImageElement, id: string) => {
      const src = cache.get(id) || peekThumb(id) || "";
      if ((img.getAttribute("src") ?? "") === src) return;
      if (src) img.src = src;
      else img.removeAttribute("src");
    };

    const pump = () => {
      if (!alive) return;
      while (inflight.size < LOAD_AT_ONCE && queue.length > 0) {
        const id = queue.shift();
        queued.delete(id ?? "");
        if (!id || cache.has(id) || inflight.has(id)) continue;
        inflight.add(id);
        void readPixels(id, "original").then((blob) => {
          inflight.delete(id);
          if (!alive) return;
          if (blob) {
            const url = URL.createObjectURL(blob);
            cache.set(id, url);
            root.querySelectorAll<HTMLImageElement>(`img[data-flow-id="${CSS.escape(id)}"]`).forEach((img) => paint(img, id));
          }
          pump();
        });
      }
    };

    const request = (id: string) => {
      if (cache.has(id) || inflight.has(id) || queued.has(id)) return;
      queued.add(id);
      queue.push(id);
      pump();
    };

    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const width = root.clientWidth;
      const rowsNow = root.querySelectorAll<HTMLElement>("[data-flow-row]");
      rowsNow.forEach((rowNode, row) => {
        const model = models[row];
        const pool = pools[row];
        if (!model || !pool || model.base <= 0) return;
        distances[row] = (distances[row] ?? 0) + FLOW_PX_PER_SEC * dt;
        const direction = flowDirection(row);
        const tiles = flowTiles(model.prefix, width, distances[row] ?? 0, direction, Math.min(480, width));
        const seen = new Set<string>();
        for (const tile of tiles) {
          const key = `${tile.index}:${tile.cycle}`;
          seen.add(key);
          let node = pool.get(key);
          if (!node) {
            node = document.createElement("div");
            node.className = "flow-tile";
            node.style.pointerEvents = "none";
            node.dataset.flowKey = key;
            const img = document.createElement("img");
            img.alt = "";
            img.draggable = false;
            const item = model.sequence[tile.index];
            if (item) {
              img.dataset.flowId = item.id;
              paint(img, item.id);
              request(item.id);
            }
            node.append(img);
            rowNode.append(node);
            pool.set(key, node);
          }
          const left = Math.round(tile.x);
          const right = Math.round(tile.x + tile.width);
          node.style.width = `${Math.max(1, right - left)}px`;
          node.style.height = `${model.height}px`;
          node.style.transform = `translate3d(${left}px,0,0)`;
        }
        for (const [key, node] of pool) {
          if (seen.has(key)) continue;
          node.remove();
          pool.delete(key);
        }
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      for (const url of cache.values()) URL.revokeObjectURL(url);
      root.querySelectorAll(".flow-tile").forEach((node) => node.remove());
    };
  }, [rows, signature, ordersKey, size.height, size.width]);

  const rowIds = (row: number) =>
    (orders[row] ?? [])
      .map((index) => pictures[index]?.id)
      .filter((id): id is string => !!id)
      .join(",");

  return (
    <div ref={rootRef} className="flow-saver" data-flow-saver="" data-flow-rows={rows} role="region" aria-label="流れる表示">
      {pictures.length === 0 ? (
        <p className="flow-saver-empty">表示中の画像がありません</p>
      ) : (
        heights.map((height, row) => (
          <div
            key={row}
            className="flow-row"
            data-flow-row={row}
            data-flow-dir={flowDirection(row)}
            data-flow-ids={rowIds(row)}
            style={{ height }}
          />
        ))
      )}
    </div>
  );
}
