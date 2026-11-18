/**
 * Save-dialog timing for a favorite GIF.
 * Chrome forgets the click after 5 seconds. Encoding a moving favorite takes longer
 * than that, so the dialog has to be requested in the click itself. The bytes are
 * written afterwards, on the handle the dialog already returned.
 */

import { gifSuggestedName } from "./gif-record.ts";

export type GifWritable = {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
  abort?: () => Promise<void>;
};

export type GifSaveHandle = {
  createWritable: () => Promise<GifWritable>;
};

export type GifDialogOpener = (options: {
  suggestedName?: string;
  excludeAcceptAllOption?: boolean;
  types?: { description?: string; accept: Record<string, string[]> }[];
}) => Promise<GifSaveHandle>;

export type GifSaveStage =
  | "変換開始"
  | "フレーム生成開始"
  | "フレーム生成完了"
  | "エンコード開始"
  | "エンコード完了"
  | "Blob取得完了"
  | "保存ダイアログ"
  | "保存開始"
  | "保存成功"
  | "保存失敗"
  | "保存キャンセル";

export type GifSaveEvent = {
  id: number;
  stage: GifSaveStage;
  errorName: string;
  errorMessage: string;
  bytes: number | null;
  mime: string | null;
  method: string;
  encoder: string;
  worker: "none";
};

const events: GifSaveEvent[] = [];
let sequence = 0;
const EVENT_LIMIT = 400;

export function gifSaveEvents(): readonly GifSaveEvent[] {
  return events;
}

export function resetGifSaveLog(): void {
  events.length = 0;
  sequence = 0;
}

export function nextGifSaveId(): number {
  sequence += 1;
  return sequence;
}

export function errorParts(error: unknown): { errorName: string; errorMessage: string } {
  if (error instanceof DOMException || error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message.replace(/[\r\n]/g, " ").slice(0, 180) };
  }
  return { errorName: "", errorMessage: "" };
}

export function isSaveCancel(error: unknown): boolean {
  return (error instanceof DOMException || error instanceof Error) && error.name === "AbortError";
}

export function logGifSave(event: GifSaveEvent): void {
  events.push(event);
  if (events.length > EVENT_LIMIT) events.splice(0, events.length - EVENT_LIMIT);
  if (typeof window !== "undefined") console.info("[gif-save]", event);
}

function blank(id: number, stage: GifSaveStage, extra?: Partial<GifSaveEvent>): GifSaveEvent {
  return {
    id,
    stage,
    errorName: "",
    errorMessage: "",
    bytes: null,
    mime: null,
    method: "showSaveFilePicker",
    encoder: "gifenc:new",
    worker: "none",
    ...extra,
  };
}

export function gifSavePicker(): GifDialogOpener | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { showSaveFilePicker?: GifDialogOpener };
  return typeof host.showSaveFilePicker === "function" ? host.showSaveFilePicker.bind(host) : null;
}

export function canSaveGif(): boolean {
  return gifSavePicker() !== null;
}

function pickerOptions(suggestedName: string) {
  return {
    suggestedName: gifSuggestedName(suggestedName),
    excludeAcceptAllOption: false,
    types: [{ description: "GIF", accept: { "image/gif": [".gif"] } }],
  };
}

export type GifSaveResult = "saved" | "cancelled" | "unsupported";

/**
 * Call this directly from the click handler. `open` runs before this function
 * awaits, and rendering starts in parallel. A dialog cancel does not write.
 */
export function runGifExportSave(args: {
  suggestedName: string;
  open: GifDialogOpener | null;
  signal: AbortSignal;
  stop: () => void;
  onWrite?: () => void;
  render: (id: number) => Promise<Uint8Array>;
}): Promise<GifSaveResult> {
  const id = nextGifSaveId();
  logGifSave(blank(id, "変換開始"));
  if (!args.open) {
    logGifSave(blank(id, "保存失敗", { method: "none", errorName: "Unsupported", errorMessage: "showSaveFilePicker is missing" }));
    return Promise.resolve("unsupported");
  }
  let dialog: Promise<GifSaveHandle>;
  try {
    logGifSave(blank(id, "保存ダイアログ"));
    dialog = args.open(pickerOptions(args.suggestedName));
  } catch (error) {
    const parts = errorParts(error);
    if (isSaveCancel(error)) {
      logGifSave(blank(id, "保存キャンセル", parts));
      return Promise.resolve("cancelled");
    }
    logGifSave(blank(id, "保存失敗", parts));
    return Promise.reject(error);
  }
  const rendered = args.render(id).then(
    (bytes) => ({ ok: true as const, bytes }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  return finishGifExportSave(id, dialog, rendered, args.signal, args.stop, args.onWrite);
}

async function finishGifExportSave(
  id: number,
  dialog: Promise<GifSaveHandle>,
  rendered: Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: unknown }>,
  signal: AbortSignal,
  stop: () => void,
  onWrite: (() => void) | undefined,
): Promise<GifSaveResult> {
  let handle: GifSaveHandle;
  try {
    handle = await dialog;
  } catch (error) {
    stop();
    await rendered;
    const parts = errorParts(error);
    if (isSaveCancel(error)) {
      logGifSave(blank(id, "保存キャンセル", parts));
      return "cancelled";
    }
    logGifSave(blank(id, "保存失敗", parts));
    throw error;
  }
  if (signal.aborted) {
    stop();
    await rendered;
    logGifSave(blank(id, "保存キャンセル", { errorName: "AbortError", errorMessage: "aborted" }));
    return "cancelled";
  }
  const produced = await rendered;
  if (!produced.ok) {
    const parts = errorParts(produced.error);
    if (signal.aborted || isSaveCancel(produced.error)) {
      logGifSave(blank(id, "保存キャンセル", parts));
      return "cancelled";
    }
    logGifSave(blank(id, "保存失敗", parts));
    throw produced.error;
  }
  if (signal.aborted) {
    logGifSave(blank(id, "保存キャンセル", { errorName: "AbortError", errorMessage: "aborted", bytes: produced.bytes.byteLength }));
    return "cancelled";
  }
  if (produced.bytes.byteLength < 1) {
    logGifSave(blank(id, "保存失敗", { errorName: "EmptyGif", errorMessage: "encoded gif has no bytes", bytes: 0, mime: "image/gif" }));
    throw new Error("empty gif");
  }
  try {
    onWrite?.();
    await writeGifHandle(handle, produced.bytes, id);
  } catch (error) {
    const parts = errorParts(error);
    if (signal.aborted || isSaveCancel(error)) {
      logGifSave(blank(id, "保存キャンセル", { ...parts, bytes: produced.bytes.byteLength, mime: "image/gif" }));
      return "cancelled";
    }
    logGifSave(blank(id, "保存失敗", { ...parts, bytes: produced.bytes.byteLength, mime: "image/gif" }));
    throw error;
  }
  logGifSave(blank(id, "保存成功", { bytes: produced.bytes.byteLength, mime: "image/gif" }));
  return "saved";
}

export async function writeGifHandle(handle: GifSaveHandle, bytes: Uint8Array, id: number): Promise<void> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "image/gif" });
  logGifSave(blank(id, "Blob取得完了", { bytes: blob.size, mime: blob.type || "image/gif" }));
  const writable = await handle.createWritable();
  logGifSave(blank(id, "保存開始", { bytes: blob.size, mime: blob.type || "image/gif" }));
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort?.();
    } catch {
      /* keep the original write error */
    }
    throw error;
  }
}
