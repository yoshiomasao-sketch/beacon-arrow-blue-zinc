import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { Button } from "@/components/ui/button";
import { readPixels } from "@/lib/portfolio/db";
import { browserFramePainter } from "@/lib/portfolio/gif-frame-paint";
import {
  dragFrameName,
  frameAddOutcome,
  framePngName,
  GIF_FRAME_DRAG,
  nextFrameIndex,
  openGifFrameSession,
  placeFrameDrag,
  writeGifFrameDrag,
  type GifFrameSession,
  type GifFrameThumb,
} from "@/lib/portfolio/gif-frame-session";
import { gifSavePicker, isSaveCancel } from "@/lib/portfolio/gif-save";
import { addFiles, getPortfolioState, notify } from "@/lib/portfolio/store";

function stop(event: { stopPropagation: () => void }): void {
  event.stopPropagation();
}

function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function GifFrameList({
  itemId,
  name,
  onBack,
  bindBack,
}: {
  itemId: string;
  name: string;
  onBack: () => void;
  bindBack: (fn: (() => void) | null) => void;
}) {
  const [thumbs, setThumbs] = useState<GifFrameThumb[]>([]);
  const [status, setStatus] = useState<"run" | "done" | "error">("run");
  const [screen, setScreen] = useState({ width: 0, height: 0 });
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [zoomDataUrl, setZoomDataUrl] = useState<string | null>(null);
  const [zoomFile, setZoomFile] = useState<File | null>(null);
  const sessionRef = useRef<GifFrameSession | null>(null);
  const zoomRef = useRef<number | null>(null);
  const thumbsRef = useRef(thumbs);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef(0);
  const onBackRef = useRef(onBack);
  const busy = useRef(false);
  const dragged = useRef(false);
  zoomRef.current = zoom;
  thumbsRef.current = thumbs;
  onBackRef.current = onBack;

  const closeZoom = () => setZoom(null);

  const openFrame = (index: number) => {
    if (zoomRef.current === null && gridRef.current) scrollRef.current = gridRef.current.scrollTop;
    setSelected(index);
    setZoom(index);
  };

  const stepFrame = (delta: number) => {
    const current = zoomRef.current;
    if (current === null) return;
    const next = nextFrameIndex(current, delta, thumbsRef.current.length);
    if (next === current) return;
    setSelected(next);
    setZoom(next);
  };

  useEffect(() => {
    bindBack(() => {
      if (zoomRef.current !== null) {
        closeZoom();
        return;
      }
      onBackRef.current();
    });
    return () => bindBack(null);
  }, [bindBack]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (typingTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      if (zoomRef.current === null) return;
      stepFrame(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useLayoutEffect(() => {
    if (zoom !== null) return;
    const node = gridRef.current;
    if (!node) return;
    node.scrollTop = scrollRef.current;
  }, [zoom]);

  useEffect(() => {
    const bag: { dead: boolean; session: GifFrameSession | null } = { dead: false, session: null };
    const ac = new AbortController();
    void (async () => {
      try {
        const blob = await readPixels(itemId, "original");
        if (bag.dead) return;
        if (!blob) {
          setStatus("error");
          return;
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (bag.dead) return;
        const session = openGifFrameSession(bytes, browserFramePainter());
        bag.session = session;
        sessionRef.current = session;
        setScreen({ width: session.width, height: session.height });
        const result = await session.list((thumb) => {
          if (!bag.dead) setThumbs((list) => [...list, thumb]);
        }, ac.signal);
        if (bag.dead) return;
        setStatus(result.failed ? "error" : "done");
      } catch {
        if (!bag.dead) setStatus("error");
      }
    })();
    return () => {
      bag.dead = true;
      ac.abort();
      bag.session?.release();
      sessionRef.current = null;
    };
  }, [itemId]);

  useEffect(() => {
    const carries = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes(GIF_FRAME_DRAG);
    const onOver = (event: DragEvent) => {
      if (!carries(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const onDrop = (event: DragEvent) => {
      if (!carries(event)) return;
      const node = event.target instanceof Element ? event.target : null;
      if (node?.closest(".sprite-pane, .pixel-pane")) return;
      event.preventDefault();
      event.stopPropagation();
      notify("ピクセルのキャンバスか、スプライトの編集エリアにドロップしてください。GIFフレーム一覧は変えていません。");
    };
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  useEffect(() => {
    if (zoom === null) {
      setZoomUrl(null);
      setZoomDataUrl(null);
      setZoomFile(null);
      return;
    }
    const session = sessionRef.current;
    if (!session || session.released) return;
    let url: string | null = null;
    let dead = false;
    const ac = new AbortController();
    const index = zoom;
    void session.png(index, ac.signal).then(async (png) => {
      if (dead || !png) return;
      const file = new File([png.blob], dragFrameName(index), { type: "image/png" });
      url = URL.createObjectURL(file);
      let dataUrl: string | null = null;
      try {
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
          reader.onerror = () => reject(reader.error ?? new Error("read"));
          reader.readAsDataURL(file);
        });
      } catch {
        dataUrl = null;
      }
      if (dead) {
        URL.revokeObjectURL(url);
        url = null;
        return;
      }
      setZoomFile(file);
      setZoomUrl(url);
      setZoomDataUrl(dataUrl && dataUrl.startsWith("data:image/png") ? dataUrl : null);
    });
    return () => {
      dead = true;
      ac.abort();
      if (url) URL.revokeObjectURL(url);
      setZoomUrl(null);
      setZoomDataUrl(null);
      setZoomFile(null);
    };
  }, [zoom]);

  const current = zoom ?? selected;
  const currentThumb = current === null ? null : (thumbs[current] ?? null);

  const copyFrame = () => {
    const session = sessionRef.current;
    if (!session || session.released || current === null || busy.current) return;
    const clip = navigator.clipboard;
    if (!clip || typeof clip.write !== "function" || typeof ClipboardItem === "undefined") {
      notify("この環境では画像をクリップボードにコピーできません。");
      return;
    }
    const index = current;
    busy.current = true;
    const pending = session.png(index).then((png) => {
      if (!png) throw new Error("empty");
      return png.blob;
    });
    void clip
      .write([new ClipboardItem({ "image/png": pending as unknown as Blob })])
      .then(() => notify("フレームをコピーしました。"))
      .catch(() => notify("クリップボードへのコピーに失敗しました。"))
      .finally(() => {
        busy.current = false;
      });
  };

  const saveFrame = () => {
    const session = sessionRef.current;
    if (!session || session.released || current === null || busy.current) return;
    const index = current;
    const suggestedName = framePngName(name, index);
    const open = gifSavePicker();
    if (!open) {
      busy.current = true;
      void session
        .png(index)
        .then((png) => {
          if (!png) {
            notify("フレームを書き出せませんでした。");
            return;
          }
          const url = URL.createObjectURL(png.blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = suggestedName;
          document.body.append(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 1500);
          notify("フレームを保存しました。");
        })
        .catch(() => notify("フレームを保存できませんでした。"))
        .finally(() => {
          busy.current = false;
        });
      return;
    }
    let dialog: ReturnType<typeof open>;
    try {
      dialog = open({
        suggestedName,
        excludeAcceptAllOption: false,
        types: [{ description: "PNG", accept: { "image/png": [".png"] } }],
      });
    } catch (error) {
      if (!isSaveCancel(error)) notify("フレームを保存できませんでした。");
      return;
    }
    busy.current = true;
    void (async () => {
      try {
        const handle = await dialog;
        const png = await session.png(index);
        if (!png) {
          notify("フレームを書き出せませんでした。");
          try {
            const writable = await handle.createWritable();
            await (writable.abort?.() ?? writable.close());
          } catch {
            /* the dialog was already confirmed; nothing else to keep */
          }
          return;
        }
        const writable = await handle.createWritable();
        await writable.write(png.blob);
        await writable.close();
        notify("フレームを保存しました。");
      } catch (error) {
        if (!isSaveCancel(error)) notify("フレームを保存できませんでした。");
      } finally {
        busy.current = false;
      }
    })();
  };

  const addFrame = () => {
    const session = sessionRef.current;
    if (!session || session.released || current === null || busy.current) return;
    const index = current;
    busy.current = true;
    void session
      .png(index)
      .then(async (png) => {
        if (!png) {
          notify("フレームを書き出せませんでした。");
          return;
        }
        const file = new File([png.blob], framePngName(name, index), { type: "image/png" });
        const before = getPortfolioState();
        const beforeCount = before.items.length;
        const beforePending = before.pendingAdd;
        await addFiles([file]);
        const after = getPortfolioState();
        const outcome = frameAddOutcome(beforeCount, after.items.length, after.pendingAdd !== beforePending);
        if (outcome === "added") notify("フレームを現在のフォルダに追加しました。");
        else if (outcome === "unchanged" && after.notices.length === before.notices.length) notify("フレームを追加できませんでした。");
      })
      .catch(() => notify("フレームを追加できませんでした。"))
      .finally(() => {
        busy.current = false;
      });
  };

  const onFrameDrag = (event: ReactDragEvent<HTMLElement>, index: number) => {
    const transfer = event.dataTransfer;
    const marked = transfer ? writeGifFrameDrag(transfer, { itemId, index, name }) : false;
    const file = zoomFile && zoom === index ? zoomFile : null;
    const filed = file && transfer ? placeFrameDrag(transfer, file, zoomDataUrl ?? zoomUrl) : false;
    if (!marked && !filed) {
      event.preventDefault();
      notify("この環境ではフレームをドラッグで渡せません。PNG保存を使ってください。");
      return;
    }
    dragged.current = true;
    event.stopPropagation();
    const image = event.currentTarget.querySelector("img");
    if (image && transfer) {
      const box = image.getBoundingClientRect();
      try {
        transfer.setDragImage(image, box.width / 2, box.height / 2);
      } catch {
        /* the frame identity is already on the drag */
      }
    }
  };

  const endFrameDrag = () => {
    window.setTimeout(() => {
      dragged.current = false;
    }, 0);
  };

  const onCellClick = (index: number) => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    openFrame(index);
  };

  const actions = (
    <div className="gif-frames-actions">
      {zoom === null ? (
        <Button variant="quiet" disabled={selected === null} onClick={() => selected !== null && openFrame(selected)}>
          拡大する
        </Button>
      ) : (
        <Button variant="quiet" onClick={closeZoom}>
          一覧へ戻る
        </Button>
      )}
      <Button variant="quiet" disabled={current === null} onClick={copyFrame}>
        コピー
      </Button>
      <Button variant="quiet" disabled={current === null} onClick={saveFrame}>
        PNG保存
      </Button>
      <Button variant="quiet" disabled={current === null} onClick={addFrame}>
        フォルダに追加
      </Button>
    </div>
  );

  return (
    <div className="gif-frames" role="region" aria-label="GIFのフレーム一覧" onPointerDown={stop} onPointerMove={stop} onPointerUp={stop} onClick={stop}>
      <div className="gif-frames-bar">
        <Button variant="quiet" onClick={onBack}>
          GIFに戻る
        </Button>
        <p className="gif-frames-count">
          {status === "run" ? `展開中 ${thumbs.length}` : `${thumbs.length}フレーム`}
          {screen.width > 0 ? ` · ${screen.width} × ${screen.height}` : ""}
          {zoom !== null ? ` · ${zoom + 1} / ${thumbs.length}` : currentThumb ? ` · ${currentThumb.index + 1} · ${currentThumb.delayMs} ms` : ""}
        </p>
        {actions}
        <Dialog.Close asChild>
          <Button variant="quiet">閉じる</Button>
        </Dialog.Close>
      </div>
      <div ref={gridRef} className="gif-frames-grid" hidden={zoom !== null}>
        {thumbs.map((thumb) => (
          <button
            key={thumb.url}
            type="button"
            draggable
            data-gif-frame={thumb.index}
            className={selected === thumb.index ? "gif-frames-cell is-on" : "gif-frames-cell"}
            aria-pressed={selected === thumb.index}
            onDragStart={(event) => onFrameDrag(event, thumb.index)}
            onDragEnd={endFrameDrag}
            onClick={() => onCellClick(thumb.index)}
          >
            <span className="gif-frames-still">
              <img src={thumb.url} alt={`フレーム ${thumb.index + 1}`} draggable={false} />
            </span>
            <span className="gif-frames-meta">
              <span>{thumb.index + 1}</span>
              <span>{thumb.delayMs} ms</span>
            </span>
          </button>
        ))}
        {status === "error" ? <p className="gif-frames-note">このGIFのフレームを読み出せませんでした。</p> : null}
        {status === "done" && thumbs.length === 0 ? <p className="gif-frames-note">フレームがありません。</p> : null}
      </div>
      {zoom !== null ? (
        <div className="gif-frames-zoom gif-frames-board">
          {zoomUrl && zoomFile ? (
            <div className="gif-frames-drag" draggable onDragStart={(event) => { if (zoom === null) return; onFrameDrag(event, zoom); }} onDragEnd={endFrameDrag}>
              <img src={zoomUrl} alt={`フレーム ${zoom + 1}`} draggable={false} />
            </div>
          ) : (
            <p className="gif-frames-note">フレームを表示しています。</p>
          )}
          <p className="gif-frames-zoom-index">{`${zoom + 1} / ${thumbs.length}`}</p>
          <button type="button" className="gif-frames-edge is-prev" aria-label="前のフレーム" disabled={zoom <= 0} onClick={() => stepFrame(-1)}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="gif-frames-edge is-next"
            aria-label="次のフレーム"
            disabled={zoom >= thumbs.length - 1}
            onClick={() => stepFrame(1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
