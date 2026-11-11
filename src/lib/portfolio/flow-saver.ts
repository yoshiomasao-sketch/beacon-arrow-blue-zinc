/**
 * Continuous strip layout for the flowing screensaver.
 * Each row is an endless copy of its own still-image order, moved independently.
 */

export type FlowRows = 1 | 2 | 3;
export type FlowDirection = "rtl" | "ltr";

/** Calm constant drift. About a full-height photo crosses the screen in roughly 15–25 seconds. */
export const FLOW_PX_PER_SEC = 64;

export function flowDirection(rowIndex: number): FlowDirection {
  return rowIndex % 2 === 0 ? "rtl" : "ltr";
}

/** Split the main area so the rows add up to the exact pixel height. */
export function flowRowHeights(totalHeight: number, rows: FlowRows): number[] {
  const count = rows === 2 || rows === 3 ? rows : 1;
  const total = Number.isFinite(totalHeight) ? Math.max(0, Math.round(totalHeight)) : 0;
  const base = Math.floor(total / count);
  let extra = total - base * count;
  const heights = Array.from({ length: count }, () => base);
  for (let index = count - 1; extra > 0; index -= 1) {
    heights[index] = (heights[index] ?? 0) + 1;
    extra -= 1;
  }
  return heights;
}

/** Width that keeps the picture's aspect when its height is the row. */
export function flowTileWidth(rowHeight: number, imageWidth: number, imageHeight: number): number {
  const height = Number.isFinite(rowHeight) ? Math.max(0, rowHeight) : 0;
  if (height === 0) return 0;
  const width = Number.isFinite(imageWidth) && imageWidth > 0 ? imageWidth : 1;
  const sourceHeight = Number.isFinite(imageHeight) && imageHeight > 0 ? imageHeight : 1;
  return Math.max(1, Math.round((height * width) / sourceHeight));
}

/** prefix[i] is the x of image i. prefix[length] is the width of one loop. */
export function flowPrefix(widths: readonly number[]): number[] {
  const prefix = [0];
  for (const width of widths) {
    const size = Number.isFinite(width) && width > 0 ? width : 0;
    prefix.push((prefix[prefix.length - 1] ?? 0) + size);
  }
  return prefix;
}

export type FlowTile = {
  index: number;
  cycle: number;
  x: number;
  width: number;
};

/**
 * Tiles that intersect the viewport.
 * `distance` grows forever in the travel direction. RTL moves left, LTR moves right.
 * A tile's `cycle` stays put while it is on screen, so the loop does not jump.
 */
export function flowTiles(
  prefix: readonly number[],
  viewport: number,
  distance: number,
  direction: FlowDirection,
  buffer = 0,
): FlowTile[] {
  const count = prefix.length - 1;
  const base = prefix[count] ?? 0;
  if (count <= 0 || !(base > 0)) return [];
  const travel = Number.isFinite(distance) ? distance : 0;
  const view0 = -Math.max(0, buffer);
  const view1 = Math.max(0, Number.isFinite(viewport) ? viewport : 0) + Math.max(0, buffer);
  let cycleMin: number;
  let cycleMax: number;
  if (direction === "rtl") {
    cycleMin = Math.floor((view0 - base + travel) / base) - 1;
    cycleMax = Math.ceil((view1 + travel) / base) + 1;
  } else {
    cycleMin = Math.floor((view0 - travel) / base) - 1;
    cycleMax = Math.ceil((view1 - travel) / base) + 1;
  }
  if (!Number.isFinite(cycleMin) || !Number.isFinite(cycleMax)) return [];
  const tiles: FlowTile[] = [];
  for (let cycle = cycleMin; cycle <= cycleMax; cycle += 1) {
    for (let index = 0; index < count; index += 1) {
      const start = prefix[index] ?? 0;
      const width = (prefix[index + 1] ?? start) - start;
      if (width <= 0) continue;
      const x = direction === "rtl" ? start + cycle * base - travel : start + cycle * base + travel;
      if (x + width <= view0 || x >= view1) continue;
      tiles.push({ index, cycle, x, width });
    }
  }
  return tiles;
}

/**
 * One independent shuffle per row, then loosened so the rows are not the same sequence.
 * Neighboring rows also avoid the same image in the same slot when that is possible.
 * One image cannot differ. Two images only have two orders, so with three rows the
 * outer rows may match. Call this when a slideshow starts, not on every frame.
 */
export function flowRowOrders(count: number, rows: FlowRows, random: () => number = Math.random): number[][] {
  const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const rowCount = rows === 2 || rows === 3 ? rows : 1;
  if (total <= 0) return Array.from({ length: rowCount }, () => []);
  if (total === 1) return Array.from({ length: rowCount }, () => [0]);
  if (rowCount === 1) return [shuffleOrder(total, random)];

  const orders: number[][] = [];
  const attempts = Math.min(64, Math.max(16, total * 8));
  for (let row = 0; row < rowCount; row += 1) {
    const neighbor = row > 0 ? orders[row - 1] : undefined;
    let best: number[] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      let next = shuffleOrder(total, random);
      if (neighbor && sameOrder(next, neighbor)) next = rotateOrder(next, 1 + (attempt % (total - 1)));
      const identicalNeighbor = neighbor && sameOrder(next, neighbor) ? 1 : 0;
      const identicalOther = total >= 3 && orders.some((order) => sameOrder(order, next)) ? 1 : 0;
      const hits = neighbor ? alignedCount(next, neighbor) : 0;
      const score = identicalNeighbor * 1_000_000 + identicalOther * 100_000 + hits * 100;
      if (score < bestScore) {
        bestScore = score;
        best = next;
        if (score === 0) break;
      }
    }
    orders.push(separateOrder(best ?? shuffleOrder(total, random), neighbor, orders, total));
  }
  return orders;
}

function shuffleOrder(count: number, random: () => number): number[] {
  const order = Array.from({ length: count }, (_, index) => index);
  for (let index = count - 1; index > 0; index -= 1) {
    const roll = random();
    const span = Number.isFinite(roll) ? Math.min(index, Math.max(0, Math.floor(roll * (index + 1)))) : 0;
    const current = order[index] ?? index;
    order[index] = order[span] ?? span;
    order[span] = current;
  }
  return order;
}

function sameOrder(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function alignedCount(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  let hits = 0;
  for (let index = 0; index < length; index += 1) {
    if (left[index] === right[index]) hits += 1;
  }
  return hits;
}

function rotateOrder(order: readonly number[], by: number): number[] {
  const count = order.length;
  if (count === 0) return [];
  const shift = ((by % count) + count) % count;
  if (shift === 0) return order.slice();
  return order.slice(shift).concat(order.slice(0, shift));
}

/** Keep an independent shuffle, then rotate only as far as needed to unstick a neighbor. */
function separateOrder(
  chosen: number[],
  neighbor: readonly number[] | undefined,
  earlier: readonly (readonly number[])[],
  total: number,
): number[] {
  let next = chosen.slice();
  if (neighbor && sameOrder(next, neighbor)) next = rotateOrder(next, 1);
  if (total >= 3 && earlier.some((order) => sameOrder(order, next))) {
    for (let shift = 1; shift < total; shift += 1) {
      const rotated = rotateOrder(next, shift);
      const clashes = (neighbor && sameOrder(rotated, neighbor)) || earlier.some((order) => sameOrder(order, rotated));
      if (!clashes) {
        next = rotated;
        break;
      }
    }
  }
  if (!neighbor || alignedCount(next, neighbor) === 0) return next;
  let quieter = next;
  let quietHits = alignedCount(next, neighbor);
  for (let shift = 1; shift < total; shift += 1) {
    const rotated = rotateOrder(next, shift);
    if (sameOrder(rotated, neighbor)) continue;
    if (total >= 3 && earlier.some((order) => sameOrder(order, rotated))) continue;
    const hits = alignedCount(rotated, neighbor);
    if (hits < quietHits) {
      quieter = rotated;
      quietHits = hits;
      if (hits === 0) break;
    }
  }
  if (quietHits === 0) return quieter;
  for (let shift = 1; shift < total; shift += 1) {
    const rotated = rotateOrder(neighbor, shift);
    if (total >= 3 && earlier.some((order) => sameOrder(order, rotated))) continue;
    return rotated;
  }
  return quieter;
}
