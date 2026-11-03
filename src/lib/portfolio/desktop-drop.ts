type Internals = {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  transformCallback: (callback: (response: unknown) => void, once?: boolean) => number;
  convertFileSrc?: (path: string, protocol?: string) => string;
};

export type DesktopDrop = {
  files: File[];
  point: { x: number; y: number } | null;
  failed: number;
};

let listening = false;

export function desktopDropsListening(): boolean {
  return listening;
}

function internals(): Internals | null {
  if (typeof window === "undefined") return null;
  const value = (window as Window & { __TAURI_INTERNALS__?: Internals }).__TAURI_INTERNALS__;
  if (!value || typeof value.invoke !== "function" || typeof value.transformCallback !== "function") return null;
  return value;
}

export function isDesktopShell(): boolean {
  return internals() !== null;
}

export function fileNameFromPath(path: string): string {
  const name = path.split(/[/\\]/).pop()?.trim() ?? "";
  return name || "dropped";
}

export function desktopDropPoint(
  position: { x: number; y: number } | null,
  ratio: number,
): { x: number; y: number } | null {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null;
  const scale = ratio > 0 ? ratio : 1;
  return { x: position.x / scale, y: position.y / scale };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

/** Tauri's drag-drop payload, or the event object that wraps it. */
export function parseDesktopDropEvent(raw: unknown): { paths: string[]; position: { x: number; y: number } | null } | null {
  const record = asRecord(raw);
  if (!record) return null;
  const payload = asRecord(record.payload) ?? record;
  const paths = Array.isArray(payload.paths) ? payload.paths.filter((path): path is string => typeof path === "string" && path.length > 0) : [];
  if (paths.length === 0) return null;
  const position = asRecord(payload.position);
  const x = position?.x;
  const y = position?.y;
  return {
    paths,
    position: typeof x === "number" && typeof y === "number" ? { x, y } : null,
  };
}

function bytesFrom(value: unknown): Uint8Array | null {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) return Uint8Array.from(value);
  return null;
}

async function readPathBytes(path: string): Promise<Uint8Array> {
  const api = internals();
  if (!api) throw new Error("desktop");
  try {
    const loaded = bytesFrom(await api.invoke("plugin:fs|read_file", { path }));
    if (loaded && loaded.byteLength > 0) return loaded;
  } catch {
    /* The fs plugin may be missing. The asset protocol is the other built-in read. */
  }
  if (typeof api.convertFileSrc !== "function") throw new Error("unreadable");
  const response = await fetch(api.convertFileSrc(path, "asset"));
  if (!response.ok) throw new Error("unreadable");
  const loaded = new Uint8Array(await response.arrayBuffer());
  if (loaded.byteLength === 0) throw new Error("empty");
  return loaded;
}

async function fileFromPath(path: string): Promise<File> {
  const bytes = await readPathBytes(path);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new File([copy], fileNameFromPath(path));
}

async function listen(event: string, handler: (payload: unknown) => void): Promise<() => void> {
  const api = internals();
  if (!api) return () => {};
  const eventId = await api.invoke("plugin:event|listen", {
    event,
    target: { kind: "Any" },
    handler: api.transformCallback(handler),
  });
  const id = typeof eventId === "number" ? eventId : Number(eventId);
  return () => {
    const extra = (window as Window & { __TAURI_EVENT_PLUGIN_INTERNALS__?: { unregisterListener?: (name: string, eventId: number) => void } })
      .__TAURI_EVENT_PLUGIN_INTERNALS__;
    try {
      extra?.unregisterListener?.(event, id);
    } catch {
      /* The webview already dropped the listener. */
    }
    void api.invoke("plugin:event|unlisten", { event, eventId: id }).catch(() => undefined);
  };
}

/** OS file drops in the desktop shell. A browser page has no Tauri internals, so this does nothing there. */
export async function startDesktopFileDrops(onDrop: (drop: DesktopDrop) => void): Promise<() => void> {
  if (!internals()) return () => {};
  try {
    const unlisten = await listen("tauri://drag-drop", (payload) => {
      const parsed = parseDesktopDropEvent(payload);
      if (!parsed) return;
      const point = desktopDropPoint(parsed.position, window.devicePixelRatio || 1);
      void (async () => {
        const files: File[] = [];
        let failed = 0;
        for (const path of parsed.paths) {
          try {
            files.push(await fileFromPath(path));
          } catch {
            failed += 1;
          }
        }
        onDrop({ files, point, failed });
      })();
    });
    listening = true;
    return () => {
      listening = false;
      unlisten();
    };
  } catch {
    listening = false;
    return () => {};
  }
}
