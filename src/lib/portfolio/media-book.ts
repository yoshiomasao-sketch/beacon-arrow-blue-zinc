/** App-owned load book. Ready files are not fetched again. Failures can be retried. */

export type AssetPhase = "idle" | "loading" | "ready" | "failed";

export type MediaJob = {
  done: number;
  total: number;
  failed: string[];
  /** True only when every id finished as ready. A failure is not success. */
  ready: boolean;
  /** Files whose load has started and not yet settled. */
  active?: { id: string; stage: string }[];
};

export type AssetBook = {
  epoch: number;
  phase: Map<string, Exclude<AssetPhase, "idle">>;
  inflight: Map<string, Promise<boolean>>;
};

export function createAssetBook(): AssetBook {
  return { epoch: 0, phase: new Map(), inflight: new Map() };
}

export function resetAssetBook(book: AssetBook): void {
  book.epoch += 1;
  book.phase.clear();
  book.inflight.clear();
}

export function assetPhase(book: AssetBook, id: string): AssetPhase {
  return book.phase.get(id) ?? "idle";
}

export function snapshotAssets(book: AssetBook, ids: readonly string[]): MediaJob {
  let done = 0;
  const failed: string[] = [];
  for (const id of ids) {
    const phase = book.phase.get(id);
    if (phase === "ready") done += 1;
    else if (phase === "failed") {
      done += 1;
      failed.push(id);
    }
  }
  const total = ids.length;
  return {
    done,
    total,
    failed,
    ready: total === 0 || (done === total && failed.length === 0),
  };
}

function settle(book: AssetBook, id: string, load: (id: string) => Promise<boolean>): Promise<boolean> {
  if (book.phase.get(id) === "ready") return Promise.resolve(true);
  const pending = book.inflight.get(id);
  if (pending) return pending;
  const stamp = book.epoch;
  book.phase.set(id, "loading");
  let task: Promise<boolean> = Promise.resolve(false);
  task = Promise.resolve()
    .then(() => load(id))
    .then(
      (ok) => {
        if (book.epoch !== stamp) return false;
        book.phase.set(id, ok ? "ready" : "failed");
        return ok;
      },
      () => {
        if (book.epoch !== stamp) return false;
        book.phase.set(id, "failed");
        return false;
      },
    )
    .finally(() => {
      if (book.inflight.get(id) === task) book.inflight.delete(id);
    });
  book.inflight.set(id, task);
  return task;
}

/**
 * Loads only ids that are not ready. One id has one flight even if two callers ask together.
 * `concurrency` caps how many new loads start at once. Progress counts settled ids, not a timer.
 */
export function ensureAssets(
  book: AssetBook,
  ids: readonly string[],
  load: (id: string) => Promise<boolean>,
  options?: { concurrency?: number; onProgress?: (job: MediaJob) => void },
): Promise<MediaJob> {
  const report = () => options?.onProgress?.(snapshotAssets(book, ids));
  report();
  const pending = ids.filter((id) => book.phase.get(id) !== "ready");
  if (pending.length === 0) return Promise.resolve(snapshotAssets(book, ids));
  const limit = Math.max(1, Math.min(options?.concurrency ?? pending.length, pending.length));
  let cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const id = pending[cursor] as string;
      cursor += 1;
      await settle(book, id, load);
      report();
    }
  };
  return Promise.all(Array.from({ length: limit }, () => worker())).then(() => snapshotAssets(book, ids));
}
