/** What the loader is doing right now, and why a file failed. Ids stay plain so a retry can find them. */

export type LoadActivity = { id: string; stage: string };

const notes = new Map<string, string>();
const active = new Map<string, string>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listen of listeners) {
    try {
      listen();
    } catch {
      /* one screen update can fail without stopping the file */
    }
  }
}

export function reportActive(id: string, stage: string): void {
  active.set(id, stage);
  notify();
}

export function clearActive(id: string): void {
  active.delete(id);
}

export function reportFailure(id: string, stage: string): void {
  notes.set(id, stage);
}

export function clearFailure(id: string): void {
  notes.delete(id);
}

export function failureLabel(id: string): string {
  const note = notes.get(id);
  return note ? `${id}（${note}）` : id;
}

export function activeLoads(): LoadActivity[] {
  return [...active.entries()].map(([id, stage]) => ({ id, stage }));
}

export function subscribeLoadActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetLoadReport(): void {
  notes.clear();
  active.clear();
}
