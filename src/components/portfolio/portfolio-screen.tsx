import { ClipboardPaste, Crop, FileDown, Heart, ImagePlus, Play } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { BackupActions, type BackupController } from "@/components/portfolio/backup-actions";
import { captureErrorMessage, captureScreenFrame, SnipOverlay } from "@/components/portfolio/capture-dialog";
import { FolderRail } from "@/components/portfolio/folder-rail";
import { ImageCard } from "@/components/portfolio/image-card";
import { LanSyncDialog } from "@/components/portfolio/lan-sync-dialog";
import { Lightbox } from "@/components/portfolio/lightbox";
import { PdfPreview } from "@/components/portfolio/pdf-preview";
import { Slideshow } from "@/components/portfolio/slideshow";
import { QrLinkDialog } from "@/components/portfolio/qr-link-dialog";
import { SpotConfirm } from "@/components/portfolio/spot-confirm";
import { StorageDialog } from "@/components/portfolio/storage-dialog";
import { TagRail } from "@/components/portfolio/tag-rail";
import { Button } from "@/components/ui/button";
import { selectedLibraryTab, activeLibraryTab, type LibraryTab } from "@/lib/portfolio/db";
import { isBackupFileName } from "@/lib/portfolio/backup";
import { fetchBrowserMedia, pixivBlockedMessage } from "@/lib/portfolio/browser-fetch";
import { OWN_FILE_DRAG } from "@/lib/portfolio/export-file";
import { copiedHttpUrl, chooseDroppedPayload, fileFromDataUrl, sniffImage, type DroppedPayload, type ExternalImageSources } from "@/lib/portfolio/image-sniff";
import {
  boxesInRect,
  classifyImageInput,
  descendantFolderIds,
  fitColumns,
  folderPath,
  GALLERY_GAP_PX,
  imageFolderChoices,
  layoutFlow,
  insertionAt,
  orderFromInsertion,
  passesTagFilter,
  readingSequence,
  scrollTopForCenter,
  statusLabel,
  tagsInRailOrder,
  type FlowBox,
  type InsertMark,
} from "@/lib/portfolio/logic";
import { pixivIllustId } from "@/lib/portfolio/pixiv-url";
import { slideshowCandidates } from "@/lib/portfolio/slideshow";
import {
  addFiles,
  assignTagToImages,
  bootstrap,
  cancelPendingAdd,
  clearFilterTags,
  commitImageOrder,
  confirmPendingAdd,
  createFolder,
  createTag,
  createTagFolder,
  deleteTagFolder,
  dismissNotices,
  favoriteImages,
  hideTag,
  moveFolder,
  moveImagesToFolder,
  placeTag,
  nestFolder,
  notify,
  pasteFolderCopy,
  placeFilterTag,
  rememberFolderCopy,
  removeFilterTag,
  removeFolder,
  removeImage,
  removeImages,
  removeTag,
  renameFolder,
  renameTag,
  resetCurrentLibrary,
  retryBootstrap,
  saveFavoritesOnly,
  saveFolderOpen,
  saveFolderPane,
  saveFolderWidth,
  saveTagOpen,
  saveTagWidth,
  selectFolder,
  selectTag,
  setColumns,
  setDirection,
  setImageMemo,
  setTagMatch,
  setViewerLock,
  setVisibleOrder,
  switchLibraryTab,
  syncLibrarySurface,
  toggleFolderHidden,
  toggleFavorite,
  toggleTagFolder,
  unassignTagFromImages,
  useFolderClip,
  usePortfolio,
  viewerLocked,
} from "@/lib/portfolio/store";
import { ALL_FOLDERS, TAG_DRAG, type Folder, type ImageMeta } from "@/lib/portfolio/types";
import { beginTagDrag, currentTagDrag, endTagDrag, eventIsTagDrag } from "@/lib/portfolio/tag-drag";
import { loadXPostVideo } from "@/lib/portfolio/x-browser";
import { directVideoUrl, xStatusId } from "@/lib/portfolio/x-url";

const PASTE_FAIL = "貼り付けできませんでした。画像か、pixivの作品URL、Xの投稿URLをコピーして、もう一度押してください。";

type PhonePane = "folder" | "tag" | null;

type TagPrompt =
  | { kind: "filter"; id: string; side: "active" | "hidden"; top: number; left: number }
  | { kind: "clear"; side: "active" | "hidden"; top: number; left: number }
  | { kind: "image"; id: string; imageId: string; top: number; left: number };

function scopeFolderIds(folders: readonly Folder[], folderId: string): Set<string> | null {
  if (folderId === ALL_FOLDERS) return null;
  const folder = folders.find((entry) => entry.id === folderId);
  if (!folder) return new Set();
  if (folder.isParent) return new Set(descendantFolderIds(folders, folder.id));
  return new Set([folder.id]);
}

function inScope(item: ImageMeta, scope: Set<string> | null): boolean {
  return scope === null || scope.has(item.folderId);
}

function dragTypes(event: { dataTransfer: DataTransfer | null }): string[] {
  return Array.from(event.dataTransfer?.types ?? []);
}

function isInternalDrag(types: readonly string[]): boolean {
  return types.includes(OWN_FILE_DRAG) || types.includes(TAG_DRAG);
}

/** A drop from the desktop or from another browser page. Internal tag and file drags are excluded. */
function isExternalDrop(types: readonly string[]): boolean {
  return !isInternalDrag(types);
}

function eventElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function dragHitsField(event: { target: EventTarget | null }): boolean {
  return Boolean(eventElement(event.target)?.closest("input, textarea, [contenteditable='true']"));
}

/** The element under the pointer. A full-screen veil must not hide the gallery. */
function dropHit(event: { target: EventTarget | null; clientX: number; clientY: number }): Element | null {
  const direct = eventElement(event.target);
  const veil = direct?.closest(".drop-veil");
  if (veil instanceof HTMLElement) {
    const previous = veil.style.pointerEvents;
    veil.style.pointerEvents = "none";
    const under = document.elementFromPoint(event.clientX, event.clientY);
    veil.style.pointerEvents = previous;
    return under ?? direct;
  }
  if (direct?.closest(".library-shell")) return direct;
  return document.elementFromPoint(event.clientX, event.clientY) ?? direct;
}

/** Central gallery, including its buttons and the drop veil. Side rails are not a restore target. */
function isCentralDrop(event: { target: EventTarget | null; clientX: number; clientY: number }): boolean {
  const node = dropHit(event);
  if (!node || node.closest(".folder-rail, .tag-rail")) return false;
  return Boolean(node.closest(".library-main, .drop-veil, .library-shell"));
}

/** Chrome image drags are often effectAllowed "link". An incompatible "copy" makes the drop fail and the URL open. */
function preferDropEffect(transfer: DataTransfer): void {
  const allowed = transfer.effectAllowed;
  if (allowed === "none") return;
  if (allowed === "link" || allowed === "linkMove") {
    transfer.dropEffect = "link";
    return;
  }
  if (allowed === "move") {
    transfer.dropEffect = "move";
    return;
  }
  transfer.dropEffect = "copy";
}

function readDrag(transfer: DataTransfer, type: string): string {
  try {
    return transfer.getData(type);
  } catch {
    return "";
  }
}

/** One file list per drop. `files` and `items` are the same files, and reading both can register each one twice. */
function filesFromTransfer(transfer: DataTransfer): File[] {
  const fromItems: File[] = [];
  const items = transfer.items;
  if (items) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item || item.kind !== "file") continue;
      try {
        const file = item.getAsFile();
        if (file && file.size > 0) fromItems.push(file);
      } catch {
        /* the browser withheld this file */
      }
    }
  }
  const fromFiles = Array.from(transfer.files).filter((file) => file.size > 0);
  const chosen =
    fromItems.length > 0 && (fromFiles.length === 0 || fromItems.length < fromFiles.length) ? fromItems : fromFiles.length > 0 ? fromFiles : fromItems;
  const out: File[] = [];
  const seen = new Set<string>();
  for (const file of chosen) {
    const key = `${file.name}\0${file.size}\0${file.type}\0${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(file);
  }
  return out;
}

/** Backup files are recognized by name, including an empty file the image filter would drop. */
function filesForDrop(transfer: DataTransfer): File[] {
  const listed = filesFromTransfer(transfer);
  const raw = Array.from(transfer.files);
  if (raw.some((file) => isBackupFileName(file.name)) && !listed.some((file) => isBackupFileName(file.name))) return raw;
  return listed;
}

/** Keeps JPEG, PNG, GIF, WebP, and the video types the library already stores. Untyped image bytes are sniffed. */
async function asImportableFile(file: File, index: number): Promise<File | null> {
  const named = classifyImageInput(file);
  if (named.ok) {
    if (file.type) return file;
    return new File([file], file.name || `dropped-${index + 1}`, { type: named.mime });
  }
  if (file.type && file.type !== "application/octet-stream") return null;
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const mime = sniffImage(head);
  if (!mime) return null;
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : "webp";
  const stem = (file.name || `dropped-${index + 1}`).replace(/\.[^.]+$/, "") || `dropped-${index + 1}`;
  return new File([await file.arrayBuffer()], `${stem}.${ext}`, { type: mime });
}

/** One native drop event is handled once, even if it reaches several listeners. */
const handledDrops = new WeakSet<Event>();
/** Files read in the first drop listener. A later listener can see an empty list. */
let stagedDropFiles: File[] | null = null;

function logDrop(info: Record<string, unknown>): void {
  console.info("[komacho-drop]", info);
}

function dropMissMessage(reason: "browser" | "format" | "url"): string {
  if (reason === "browser") {
    return "この画像はブラウザの制限で読み取れません。別ページの中だけで有効なアドレスか、公開されていないアドレスです。ログイン情報は使いません。画像を保存して「画像を追加」から読み込んでください。";
  }
  if (reason === "format") return "このデータは JPEG、PNG、GIF ではありませんでした。既存の画像はそのままです。";
  return "このドロップからは画像を取り出せませんでした。画像を保存して「画像を追加」から読み込むか、画像のアドレスを貼り付けてください。";
}

function isExternalFileDrag(event: { dataTransfer: DataTransfer | null }): boolean {
  return isExternalDrop(dragTypes(event));
}

function popAt(rect: DOMRect): { top: number; left: number } {
  const width = 188;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 120));
  return { top, left };
}

function placePreview(node: HTMLElement, clientX: number, clientY: number): void {
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  let x = clientX + 18;
  let y = clientY + 18;
  if (width > 0 && x + width > window.innerWidth - 8) x = clientX - width - 14;
  if (height > 0 && y + height > window.innerHeight - 8) y = clientY - height - 14;
  node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}

function dragPreviewOf(id: string): { src: string; w: number; h: number } {
  const max = 104;
  const card = document.querySelector(`[data-shot-id="${CSS.escape(id)}"]`);
  const rect = card?.getBoundingClientRect();
  const aspect = rect && rect.height > 0 ? rect.width / rect.height : 1;
  const w = aspect >= 1 ? max : Math.max(32, Math.round(max * aspect));
  const h = aspect >= 1 ? Math.max(32, Math.round(max / aspect)) : max;
  const image = card?.querySelector("img");
  if (image instanceof HTMLImageElement && image.currentSrc) return { src: image.currentSrc, w, h };
  const video = card?.querySelector("video");
  if (video instanceof HTMLVideoElement && video.readyState >= 2 && video.videoWidth > 0) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
    const context = canvas.getContext("2d");
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        return { src: canvas.toDataURL("image/jpeg", 0.72), w, h };
      } catch {
        /* a tainted frame still gets an empty preview */
      }
    }
  }
  return { src: "", w, h };
}

function LibraryTabButtons({
  current,
  pressed,
  busy,
  onPick,
}: {
  current: LibraryTab;
  pressed: boolean;
  busy: boolean;
  onPick: (tab: LibraryTab) => void;
}) {
  return (
    <div className="library-tabs" role="group" aria-label="ライブラリ">
      {([1, 2, 3] as const).map((tab) => (
        <Button
          key={tab}
          variant="quiet"
          className={pressed && tab === current ? "library-tab is-current" : "library-tab"}
          aria-pressed={pressed && tab === current}
          aria-label={`ライブラリ${tab}`}
          disabled={busy}
          onClick={() => onPick(tab)}
        >
          {tab}
        </Button>
      ))}
    </div>
  );
}

export function PortfolioScreen() {
  const phase = usePortfolio((state) => state.phase);
  const items = usePortfolio((state) => state.items);
  const notices = usePortfolio((state) => state.notices);
  const importing = usePortfolio((state) => state.importing);
  const bootError = usePortfolio((state) => state.bootError);
  const columns = usePortfolio((state) => state.columns);
  const direction = usePortfolio((state) => state.direction);
  const folders = usePortfolio((state) => state.folders);
  const folderId = usePortfolio((state) => state.folderId);
  const folderWidth = usePortfolio((state) => state.folderWidth);
  const folderPane = usePortfolio((state) => state.folderPane);
  const folderOpen = usePortfolio((state) => state.folderOpen);
  const favoritesOnly = usePortfolio((state) => state.favoritesOnly);
  const tags = usePortfolio((state) => state.tags);
  const tagFolders = usePortfolio((state) => state.tagFolders);
  const activeTagIds = usePortfolio((state) => state.activeTagIds);
  const hiddenTagIds = usePortfolio((state) => state.hiddenTagIds);
  const hiddenFolderIds = usePortfolio((state) => state.hiddenFolderIds);
  const tagMatch = usePortfolio((state) => state.tagMatch);
  const tagOpen = usePortfolio((state) => state.tagOpen);
  const tagWidth = usePortfolio((state) => state.tagWidth);
  const pendingAdd = usePortfolio((state) => state.pendingAdd);
  const libraryEpoch = usePortfolio((state) => state.libraryEpoch);
  const folderClip = useFolderClip();
  const [libraryTab, setLibraryTab] = useState<LibraryTab>(1);
  const [tabBusy, setTabBusy] = useState(false);
  const tabRequest = useRef(0);

  const [compact, setCompact] = useState(false);
  const [phonePane, setPhonePane] = useState<PhonePane>(null);
  const [contentPx, setContentPx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [storageOpen, setStorageOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrBoot, setQrBoot] = useState<string | null>(null);
  const [snipUrl, setSnipUrl] = useState<string | null>(null);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<TagPrompt | null>(null);
  const [fileDrag, setFileDrag] = useState(false);
  const [resetAsk, setResetAsk] = useState<DOMRect | null>(null);
  const [resetting, setResetting] = useState(false);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [insertMarks, setInsertMarks] = useState<InsertMark[]>([]);
  const [dragPreview, setDragPreview] = useState<{ src: string; w: number; h: number } | null>(null);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashFade, setFlashFade] = useState(false);
  const [widthDrag, setWidthDrag] = useState<{ kind: "folder" | "tag"; width: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteAbort = useRef<AbortController | null>(null);
  const pasteGen = useRef(0);
  const dragCleanup = useRef<(() => void) | null>(null);
  const pendingJump = useRef<string | null>(null);
  const clearingFavorite = useRef(false);
  const dropRef = useRef({ folder: null as string | null, index: null as number | null });
  const importDropRef = useRef<(transfer: DataTransfer) => void>(() => {});
  const importBackupRef = useRef<(files: readonly File[]) => void>(() => {});
  const backupRef = useRef<BackupController>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragPointRef = useRef<{ x: number; y: number } | null>(null);
  const markKeyRef = useRef("");
  const folderHoldRef = useRef<string | null>(null);
  const selectedRef = useRef(selected);
  const directionRef = useRef(direction);
  const placementsRef = useRef<FlowBox[]>([]);
  const galleryScroll = useRef(0);
  const viewerWasOpen = useRef(false);
  selectedRef.current = selected;
  directionRef.current = direction;

  const folderShown = compact ? phonePane === "folder" : folderOpen;
  const tagShown = compact ? phonePane === "tag" : tagOpen;
  const folderW = widthDrag?.kind === "folder" ? widthDrag.width : folderWidth;
  const tagW = widthDrag?.kind === "tag" ? widthDrag.width : tagWidth;

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    setSelected([]);
    setOpenId(null);
    setPdfOpen(false);
    setMarquee(null);
    setDragId(null);
    setInsertMarks([]);
    setDragPreview(null);
    setDropFolderId(null);
    setFlashId(null);
  }, [libraryEpoch]);

  useLayoutEffect(() => {
    if (phase === "boot") return;
    setLibraryTab(selectedLibraryTab());
  }, [phase, libraryEpoch]);

  useLayoutEffect(() => {
    const node = previewRef.current;
    const point = dragPointRef.current;
    if (!node || !point) return;
    placePreview(node, point.x, point.y);
  }, [dragPreview]);

  useLayoutEffect(() => {
    const take = () => {
      const hash = window.location.hash;
      if (!hash.includes("k1=")) return;
      if (window.matchMedia("(max-width: 899px)").matches) return;
      setQrBoot(hash);
      setQrOpen(true);
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    };
    take();
    window.addEventListener("hashchange", take);
    return () => window.removeEventListener("hashchange", take);
  }, []);

  useEffect(() => {
    if (phase !== "ready") return;
    const note = sessionStorage.getItem("komacho-restored");
    if (!note) return;
    sessionStorage.removeItem("komacho-restored");
    notify(note);
  }, [phase]);

  useLayoutEffect(() => {
    const media = window.matchMedia("(max-width: 899px)");
    const apply = () => {
      const phone = media.matches;
      setCompact(phone);
      setViewerLock(phone);
      void syncLibrarySurface(phone);
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      setViewerLock(false);
    };
  }, []);

  useEffect(() => {
    if (compact) cancelPendingAdd();
  }, [compact]);

  useEffect(() => {
    const block = (event: Event) => {
      const raw = event.target;
      const target = raw instanceof Element ? raw : raw instanceof Node ? raw.parentElement : null;
      if (target?.closest("input, textarea, [contenteditable='true'], [draggable='true']")) return;
      event.preventDefault();
    };
    document.addEventListener("selectstart", block);
    return () => document.removeEventListener("selectstart", block);
  }, []);

  useEffect(() => {
    const cancelNav = (event: globalThis.DragEvent) => {
      if (currentTagDrag()) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        return;
      }
      if (dragTypes(event).includes(OWN_FILE_DRAG) || dragHitsField(event)) return;
      // Chrome opens a new tab at about:blank#blocked when a cross-window image
      // drop is not accepted. Types are often hidden until dragover is cancelled.
      event.preventDefault();
      if (event.dataTransfer) preferDropEffect(event.dataTransfer);
    };
    const onDrop = (event: globalThis.DragEvent) => {
      if (currentTagDrag()) {
        event.preventDefault();
        return;
      }
      if (dragTypes(event).includes(OWN_FILE_DRAG) || dragHitsField(event)) return;
      if (handledDrops.has(event)) return;
      event.preventDefault();
      const transfer = event.dataTransfer;
      if (!transfer) return;
      const dropped = filesForDrop(transfer);
      stagedDropFiles = dropped;
      const backups = dropped.filter((file) => isBackupFileName(file.name));
      if (backups.length > 0 && isCentralDrop(event)) {
        handledDrops.add(event);
        event.stopPropagation();
        stagedDropFiles = null;
        importBackupRef.current(dropped);
        return;
      }
      const node = eventElement(event.target);
      if (node?.closest(".library-shell") || isCentralDrop(event)) return;
      stagedDropFiles = null;
      handledDrops.add(event);
      event.stopPropagation();
      importDropRef.current(transfer);
    };
    const end = () => endTagDrag();
    document.addEventListener("dragenter", cancelNav);
    document.addEventListener("dragover", cancelNav);
    window.addEventListener("dragenter", cancelNav, true);
    window.addEventListener("dragover", cancelNav, true);
    window.addEventListener("drop", onDrop, true);
    document.addEventListener("drop", onDrop);
    window.addEventListener("dragend", end);
    return () => {
      document.removeEventListener("dragenter", cancelNav);
      document.removeEventListener("dragover", cancelNav);
      window.removeEventListener("dragenter", cancelNav, true);
      window.removeEventListener("dragover", cancelNav, true);
      window.removeEventListener("drop", onDrop, true);
      document.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", end);
    };
  }, []);

  useEffect(() => {
    return () => dragCleanup.current?.();
  }, []);

  useEffect(() => {
    if (!prompt) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".tag-pop")) return;
      setPrompt(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [prompt]);

  const scope = useMemo(() => scopeFolderIds(folders, folderId), [folders, folderId]);
  const scopedItems = useMemo(() => items.filter((item) => inScope(item, scope)), [items, scope]);
  const hasFavorite = scopedItems.some((item) => item.favorite);
  const selectedFolderHidden = folderId !== ALL_FOLDERS && hiddenFolderIds.includes(folderId);
  const visible = useMemo(() => {
    if (selectedFolderHidden) return [];
    const concealed = new Set(hiddenFolderIds);
    const filtered = scopedItems.filter((item) => {
      if (concealed.has(item.folderId)) return false;
      if (favoritesOnly && !item.favorite) return false;
      return passesTagFilter(item.tagIds, activeTagIds, hiddenTagIds, tagMatch);
    });
    return readingSequence(filtered, direction);
  }, [scopedItems, selectedFolderHidden, hiddenFolderIds, favoritesOnly, activeTagIds, hiddenTagIds, tagMatch, direction]);

  useEffect(() => {
    if (phase !== "ready" || !favoritesOnly || hasFavorite || clearingFavorite.current) return;
    clearingFavorite.current = true;
    void saveFavoritesOnly(false).finally(() => {
      clearingFavorite.current = false;
    });
  }, [phase, favoritesOnly, hasFavorite]);

  useEffect(() => {
    setSelected((current) => {
      if (current.length === 0) return current;
      const known = new Set(items.map((item) => item.id));
      const next = current.filter((id) => known.has(id));
      return next.length === current.length ? current : next;
    });
    setOpenId((current) => (current && items.some((item) => item.id === current) ? current : null));
  }, [items]);

  useEffect(() => {
    if (notices.length === 0) return;
    const followers: Array<{ type: string; fn: (event: Event) => void }> = [];
    let dropTimer = 0;
    const dropFollowers = () => {
      window.clearTimeout(dropTimer);
      dropTimer = 0;
      for (const item of followers.splice(0)) document.removeEventListener(item.type, item.fn, true);
    };
    const arm = (type: string) => {
      const fn = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        if (type === "pointercancel" || type === "click" || type === "auxclick") dropFollowers();
        if (type === "pointerup") {
          window.clearTimeout(dropTimer);
          dropTimer = window.setTimeout(dropFollowers, 0);
        }
      };
      followers.push({ type, fn });
      document.addEventListener(type, fn, true);
    };
    const swallow = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dropFollowers();
      arm("pointerup");
      arm("pointercancel");
      arm("mousedown");
      arm("mouseup");
      arm("click");
      arm("auxclick");
      dismissNotices();
    };
    document.addEventListener("pointerdown", swallow, true);
    return () => {
      document.removeEventListener("pointerdown", swallow, true);
    };
  }, [notices.length]);

  useEffect(() => {
    setSelected([]);
    setOpenId(null);
  }, [folderId]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    if (openId) {
      viewerWasOpen.current = true;
      const top = galleryScroll.current;
      const keep = () => {
        if (scroller.isConnected) scroller.scrollTop = top;
      };
      keep();
      const frame = window.requestAnimationFrame(keep);
      const timers = [0, 80].map((ms) => window.setTimeout(keep, ms));
      return () => {
        window.cancelAnimationFrame(frame);
        for (const timer of timers) window.clearTimeout(timer);
      };
    }
    if (!viewerWasOpen.current) return;
    const top = galleryScroll.current;
    const keep = () => {
      if (scroller.isConnected) scroller.scrollTop = top;
    };
    keep();
    const frame = window.requestAnimationFrame(keep);
    const timers = [0, 50, 140].map((ms) => window.setTimeout(keep, ms));
    return () => {
      window.cancelAnimationFrame(frame);
      for (const timer of timers) window.clearTimeout(timer);
    };
  }, [openId]);

  const fitted = fitColumns(columns, contentPx, 148, GALLERY_GAP_PX);
  const flow = useMemo(
    () => layoutFlow(
      visible.map((item) => ({ id: item.id, width: item.width, height: item.height, scale: item.scale })),
      { contentWidth: contentPx, columns: fitted, gap: GALLERY_GAP_PX, lastRow: "match" },
    ),
    [visible, contentPx, fitted],
  );
  const placements = flow.placements;
  placementsRef.current = placements;

  useEffect(() => {
    const node = flowRef.current;
    if (!node) return;
    const measure = () => {
      const next = node.clientWidth;
      if (next > 0) setContentPx((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [phase, visible.length, compact, folderShown, tagShown]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const tag of tags) tally[tag.id] = 0;
    for (const item of scopedItems) {
      for (const id of item.tagIds) {
        if (tally[id] !== undefined) tally[id] += 1;
      }
    }
    return tally;
  }, [tags, scopedItems]);

  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const listedTags = useMemo(() => tagsInRailOrder(tags, tagFolders), [tags, tagFolders]);
  const currentFolder = folders.find((folder) => folder.id === folderId) ?? null;
  const showOrigin = folderId === ALL_FOLDERS || currentFolder?.isParent === true;
  const readingIds = placements.length
    ? [...placements].sort((a, b) => a.y - b.y || a.x - b.x).map((box) => box.id)
    : visible.map((item) => item.id);
  const openItem = openId
    ? (visible.find((item) => item.id === openId) ??
      scopedItems.find((item) => item.id === openId && favoritesOnly && !item.favorite && passesTagFilter(item.tagIds, activeTagIds, hiddenTagIds, tagMatch)) ??
      null)
    : null;
  const openIndex = openItem ? readingIds.indexOf(openItem.id) : -1;

  const openAt = (id: string) => {
    if (!openId) galleryScroll.current = scrollRef.current?.scrollTop ?? 0;
    setOpenId(id);
  };

  const scrollToId = (id: string) => {
    const scroller = scrollRef.current;
    const node = scroller?.querySelector(`[data-shot-id="${CSS.escape(id)}"]`);
    if (!scroller || !(node instanceof HTMLElement)) return false;
    const scrollerRect = scroller.getBoundingClientRect();
    const cardRect = node.getBoundingClientRect();
    const head = scroller.querySelector(".library-head");
    const sticky = head instanceof HTMLElement ? head.getBoundingClientRect().height : 0;
    const top = scrollTopForCenter(scroller.scrollTop, scrollerRect.top, scrollerRect.height, cardRect.top, cardRect.height, sticky);
    scroller.scrollTo({ top, behavior: "smooth" });
    setFlashId(id);
    setFlashFade(false);
    window.setTimeout(() => setFlashFade(true), 40);
    window.setTimeout(() => {
      setFlashId((current) => (current === id ? null : current));
      setFlashFade(false);
    }, 1100);
    return true;
  };

  useEffect(() => {
    const id = pendingJump.current;
    if (!id || phase !== "ready") return;
    const item = items.find((entry) => entry.id === id);
    if (!item) {
      pendingJump.current = null;
      notify("その画像は見つかりません。");
      return;
    }
    if (folderId !== ALL_FOLDERS && !inScope(item, scope)) return;
    if (favoritesOnly && !item.favorite) {
      pendingJump.current = null;
      notify("お気に入りの表示中です。その画像はお気に入りではないため、ここには出ません。");
      return;
    }
    if (!passesTagFilter(item.tagIds, activeTagIds, hiddenTagIds, tagMatch)) {
      pendingJump.current = null;
      notify("タグの絞り込み中です。その画像は条件に合わないため、ここには出ません。");
      return;
    }
    if (hiddenFolderIds.includes(item.folderId) || selectedFolderHidden) {
      pendingJump.current = null;
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      if (pendingJump.current !== id) return;
      if (scrollToId(id)) pendingJump.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase, items, folderId, scope, favoritesOnly, activeTagIds, hiddenTagIds, hiddenFolderIds, selectedFolderHidden, tagMatch, contentPx, visible.length]);

  const jumpTo = (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) {
      notify("その画像は見つかりません。");
      return;
    }
    if (!inScope(item, scope)) {
      pendingJump.current = id;
      void selectFolder(item.folderId);
      return;
    }
    if (favoritesOnly && !item.favorite) {
      notify("お気に入りの表示中です。その画像はお気に入りではないため、ここには出ません。");
      return;
    }
    if (!passesTagFilter(item.tagIds, activeTagIds, hiddenTagIds, tagMatch)) {
      notify("タグの絞り込み中です。その画像は条件に合わないため、ここには出ません。");
      return;
    }
    if (!scrollToId(id)) pendingJump.current = id;
  };

  const toggleFolder = () => {
    if (compact) {
      setPhonePane((current) => (current === "folder" ? null : "folder"));
      return;
    }
    void saveFolderOpen(!folderOpen);
  };

  const toggleTag = () => {
    if (compact) {
      setPhonePane((current) => (current === "tag" ? null : "tag"));
      return;
    }
    void saveTagOpen(!tagOpen);
  };

  const beginWidth = (kind: "folder" | "tag", event: ReactPointerEvent<HTMLDivElement>) => {
    if (compact || event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const start = kind === "folder" ? folderWidth : tagWidth;
    const clamp = (value: number) => (kind === "folder" ? Math.min(420, Math.max(180, value)) : Math.min(320, Math.max(180, value)));
    const move = (pointer: PointerEvent) => {
      const delta = pointer.clientX - startX;
      setWidthDrag({ kind, width: clamp(Math.round(start + (kind === "folder" ? delta : -delta))) });
    };
    const end = (pointer: PointerEvent) => {
      const delta = pointer.clientX - startX;
      const next = clamp(Math.round(start + (kind === "folder" ? delta : -delta)));
      setWidthDrag(null);
      if (kind === "folder") void saveFolderWidth(next);
      else void saveTagWidth(next);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const movingIds = dragId && selected.includes(dragId) && selected.length > 1 ? selected : dragId ? [dragId] : [];
  const ownerFolders = new Set(movingIds.map((id) => items.find((item) => item.id === id)?.folderId).filter((id): id is string => !!id));
  const ownerFolderId = ownerFolders.size === 1 ? [...ownerFolders][0]! : null;

  const onCardDragStart = (id: string, event: PointerEvent) => {
    if (compact || viewerLocked()) return;
    dragCleanup.current?.();
    const group = selectedRef.current.includes(id) && selectedRef.current.length > 1 ? [...selectedRef.current] : [id];
    const preview = dragPreviewOf(id);
    dragPointRef.current = { x: event.clientX, y: event.clientY };
    markKeyRef.current = "";
    folderHoldRef.current = null;
    dropRef.current = { folder: null, index: null };
    setDragId(id);
    setDragPreview(preview);
    setInsertMarks([]);
    setDropFolderId(null);
    const showMarks = (marks: InsertMark[]) => {
      const key = marks.map((mark) => `${mark.id}:${mark.edge}`).join("|");
      if (key === markKeyRef.current) return;
      markKeyRef.current = key;
      setInsertMarks(marks);
    };
    const showFolder = (folder: string | null) => {
      if (folderHoldRef.current === folder) return;
      folderHoldRef.current = folder;
      setDropFolderId(folder);
    };
    const move = (pointer: PointerEvent) => {
      dragPointRef.current = { x: pointer.clientX, y: pointer.clientY };
      const previewNode = previewRef.current;
      if (previewNode) placePreview(previewNode, pointer.clientX, pointer.clientY);
      const hit = document.elementFromPoint(pointer.clientX, pointer.clientY);
      const folderId = hit?.closest("[data-folder-id]")?.getAttribute("data-folder-id") ?? null;
      const folder = folderId && folderId !== ALL_FOLDERS ? folderId : null;
      if (folder) {
        dropRef.current = { folder, index: null };
        showFolder(folder);
        showMarks([]);
        return;
      }
      showFolder(null);
      const flowNode = flowRef.current;
      if (!flowNode) return;
      const rect = flowNode.getBoundingClientRect();
      const slot = insertionAt(placementsRef.current, group, {
        x: pointer.clientX - rect.left,
        y: pointer.clientY - rect.top,
      });
      dropRef.current = { folder: null, index: slot ? slot.index : null };
      showMarks(slot?.marks ?? []);
    };
    let finished = false;
    const end = (commit: boolean) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      dragCleanup.current = null;
      const folder = dropRef.current.folder;
      const index = dropRef.current.index;
      dropRef.current = { folder: null, index: null };
      dragPointRef.current = null;
      markKeyRef.current = "";
      folderHoldRef.current = null;
      setDragId(null);
      setDragPreview(null);
      setInsertMarks([]);
      setDropFolderId(null);
      if (!commit) return;
      if (folder && folder !== ALL_FOLDERS) {
        void moveImagesToFolder(group, folder);
        return;
      }
      if (index === null) return;
      const order = orderFromInsertion(placementsRef.current, group, id, index, directionRef.current === "desc");
      if (!order) return;
      setVisibleOrder(order);
      void commitImageOrder();
    };
    const finish = () => end(true);
    const cancel = () => end(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    dragCleanup.current = () => end(false);
    event.preventDefault();
  };

  const onGalleryPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (compact || viewerLocked() || event.button !== 0) return;
    const target = event.target as Element | null;
    if (target?.closest(".shot-card, button, a, input, textarea, select, label, .library-head")) return;
    const flowNode = flowRef.current;
    const scroller = scrollRef.current;
    if (!flowNode || !scroller) return;
    if (target === scroller) {
      const bounds = scroller.getBoundingClientRect();
      const barX = scroller.offsetWidth - scroller.clientWidth;
      const barY = scroller.offsetHeight - scroller.clientHeight;
      if ((barX > 0 && event.clientX >= bounds.right - barX) || (barY > 0 && event.clientY >= bounds.bottom - barY)) return;
    }
    const point = (clientX: number, clientY: number) => {
      const rect = flowNode.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const origin = point(event.clientX, event.clientY);
    const drag = {
      x0: origin.x,
      y0: origin.y,
      x1: origin.x,
      y1: origin.y,
      base: selectedRef.current,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    let moved = false;
    const paint = () => {
      const hits = boxesInRect(placementsRef.current, {
        x: drag.x0,
        y: drag.y0,
        w: drag.x1 - drag.x0,
        h: drag.y1 - drag.y0,
      });
      const next = [...drag.base];
      for (const id of hits) if (!next.includes(id)) next.push(id);
      setSelected(next);
      setMarquee({
        x: Math.min(drag.x0, drag.x1),
        y: Math.min(drag.y0, drag.y1),
        w: Math.abs(drag.x1 - drag.x0),
        h: Math.abs(drag.y1 - drag.y0),
      });
    };
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const bounds = scroller.getBoundingClientRect();
      let dy = 0;
      if (drag.clientY < bounds.top + 48) dy = -18;
      else if (drag.clientY > bounds.bottom - 48) dy = 18;
      if (dy !== 0) {
        scroller.scrollTop += dy;
        const next = point(drag.clientX, drag.clientY);
        drag.x1 = next.x;
        drag.y1 = next.y;
        moved = true;
        paint();
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
    const move = (pointer: PointerEvent) => {
      drag.clientX = pointer.clientX;
      drag.clientY = pointer.clientY;
      const next = point(pointer.clientX, pointer.clientY);
      if (Math.hypot(next.x - drag.x0, next.y - drag.y0) > 4) moved = true;
      drag.x1 = next.x;
      drag.y1 = next.y;
      paint();
    };
    const end = () => {
      alive = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      setMarquee(null);
      if (!moved) setSelected([]);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const cancelPaste = () => {
    pasteGen.current += 1;
    pasteAbort.current?.abort();
    setPasteNote(null);
  };

  const paste = async () => {
    if (compact || viewerLocked()) return;
    const gen = ++pasteGen.current;
    pasteAbort.current?.abort();
    const ctrl = new AbortController();
    pasteAbort.current = ctrl;
    const stale = () => gen !== pasteGen.current;
    try {
      if (navigator.clipboard?.read) {
        try {
          const clip = await navigator.clipboard.read();
          const files: File[] = [];
          for (const item of clip) {
            const type = item.types.find((entry) => entry.startsWith("image/") || entry === "video/mp4" || entry === "video/webm");
            if (!type) continue;
            const blob = await item.getType(type);
            const ext = type.split("/")[1] || "bin";
            files.push(new File([blob], `clipboard.${ext}`, { type }));
          }
          if (stale()) return;
          if (files.length > 0) {
            await addFiles(files, "clipboard");
            return;
          }
        } catch (error) {
          if (stale() || (error instanceof DOMException && error.name === "AbortError")) return;
        }
      }
      const text = navigator.clipboard?.readText ? await navigator.clipboard.readText() : "";
      if (stale()) return;
      const video = directVideoUrl(text);
      const pixiv = pixivIllustId(text);
      const status = xStatusId(text);
      if (!video && pixiv) {
        notify(pixivBlockedMessage());
        return;
      }
      if (!video && status) {
        setPasteNote("公開の投稿情報を確認しています");
        const result = await loadXPostVideo(status, ctrl.signal, (note) => {
          if (!stale()) setPasteNote(note);
        });
        if (stale()) return;
        setPasteNote(null);
        if (!result.ok) {
          notify(result.message);
          return;
        }
        await addFiles([result.file], "clipboard");
        return;
      }
      const url = video ?? copiedHttpUrl(text);
      if (!url) {
        notify(PASTE_FAIL);
        return;
      }
      setPasteNote("画像のアドレスを取得しています");
      const fetched = await fetchBrowserMedia(url, ctrl.signal);
      if (stale()) return;
      setPasteNote(null);
      if (!fetched.ok) {
        notify(fetched.message);
        return;
      }
      await addFiles([fetched.file], "clipboard");
    } catch (error) {
      if (stale()) return;
      setPasteNote(null);
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify(PASTE_FAIL);
    }
  };

  const capture = async () => {
    if (compact || viewerLocked()) return;
    try {
      const blob = await captureScreenFrame();
      setSnipUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
    } catch (error) {
      notify(captureErrorMessage(error));
    }
  };

  const closeSnip = () => {
    setSnipUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const confirmPrompt = () => {
    if (!prompt) return;
    if (prompt.kind === "image") {
      const ids = selected.includes(prompt.imageId) && selected.length > 1 ? selected : [prompt.imageId];
      void unassignTagFromImages(ids, prompt.id);
    } else if (prompt.kind === "clear") {
      void clearFilterTags(prompt.side);
    } else {
      void removeFilterTag(prompt.id, prompt.side);
    }
    setPrompt(null);
  };

  const promptText = () => {
    if (!prompt) return "";
    if (prompt.kind === "clear") return prompt.side === "active" ? "選択タグをすべて外しますか？" : "ネガティブタグをすべて外しますか？";
    if (prompt.kind === "image") {
      const count = selected.includes(prompt.imageId) && selected.length > 1 ? selected.length : 1;
      return count > 1 ? `選択中の${count}枚からこのタグを外しますか？` : "この画像からタグを外しますか？";
    }
    return prompt.side === "active" ? "この選択タグを外しますか？" : "このネガティブタグを外しますか？";
  };

  const emptyCopy = () => {
    if (selectedFolderHidden) return "表示できるものがありません";
    if (items.length === 0) return "まだ画像がありません";
    if (scopedItems.length === 0) return "このフォルダには画像がありません";
    if (favoritesOnly) return "お気に入りはまだありません";
    return "該当する画像がありません";
  };

  const onShellDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (currentTagDrag() || dragHitsField(event) || !isExternalFileDrag(event)) return;
    event.preventDefault();
    if (compact || viewerLocked()) return;
    const previous = event.relatedTarget;
    if (previous instanceof Node && event.currentTarget.contains(previous)) return;
    setFileDrag(true);
  };

  const onShellDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (currentTagDrag() || dragHitsField(event) || !isExternalFileDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) preferDropEffect(event.dataTransfer);
  };

  const onShellDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (currentTagDrag() || dragHitsField(event) || !isExternalFileDrag(event)) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setFileDrag(false);
  };

  const finishExternalDrop = (transfer: DataTransfer) => {
    setFileDrag(false);
    if (compact || viewerLocked()) return;
    const dropped = stagedDropFiles && stagedDropFiles.length > 0 ? stagedDropFiles : filesForDrop(transfer);
    stagedDropFiles = null;
    if (dropped.some((file) => isBackupFileName(file.name))) {
      const images = dropped.filter((file) => !isBackupFileName(file.name));
      notify(
        images.length > 0
          ? "バックアップファイルは1つだけ、ほかのファイルと分けてドロップしてください。ライブラリは変更していません。"
          : "バックアップは、中央の画像エリアにドロップしてください。ライブラリは変更していません。",
      );
      return;
    }
    const rawFiles = dropped.length > 0 ? [...dropped] : filesFromTransfer(transfer);
    const plan = chooseDroppedPayload(
      readDrag(transfer, "text/uri-list"),
      readDrag(transfer, "text/html"),
      readDrag(transfer, "text/plain"),
      readDrag(transfer, "DownloadURL"),
    );
    logDrop({
      types: Array.from(transfer.types),
      files: rawFiles.map((file) => ({ name: file.name, type: file.type || "(none)", size: file.size })),
      urls: plan.primary.urls.length,
      dataUrls: plan.primary.dataUrls.length,
      blocked: plan.primary.blocked.map((entry) => entry.split(":")[0] ?? "").slice(0, 4),
    });
    void importExternalDrop(rawFiles, plan);
  };

  const importExternalDrop = async (rawFiles: readonly File[], plan: DroppedPayload) => {
    if (compact || viewerLocked()) return;
    const images: File[] = [];
    let foreign = 0;
    for (let index = 0; index < rawFiles.length; index += 1) {
      const normalized = await asImportableFile(rawFiles[index]!, index);
      if (normalized) images.push(normalized);
      else foreign += 1;
    }
    if (images.length > 0) {
      logDrop({ path: "file", reason: "file", files: images.length, skipped: foreign });
      await addFiles(images, "file");
      if (foreign > 0) notify(`${foreign}件は JPEG、PNG、GIF ではありませんでした。既存の画像はそのままです。`);
      return;
    }

    const takeAddresses = async (sources: ExternalImageSources) => {
      const dataFiles: File[] = [];
      let badData = 0;
      sources.dataUrls.forEach((url, index) => {
        const file = fileFromDataUrl(url, index);
        if (file) dataFiles.push(file);
        else badData += 1;
      });
      if (dataFiles.length > 0) return { files: dataFiles, browser: 0, format: badData, missing: 0, path: "data" as const };
      if (sources.urls.length === 0) return { files: [] as File[], browser: 0, format: badData, missing: 0, path: "none" as const };
      const ctrl = new AbortController();
      setPasteNote(sources.urls.length > 1 ? `${sources.urls.length}件のアドレスを取得しています` : "画像のアドレスを取得しています");
      const fetched: File[] = [];
      let browser = 0;
      let format = badData;
      let missing = 0;
      try {
        for (const url of sources.urls) {
          try {
            const result = await fetchBrowserMedia(url, ctrl.signal);
            if (result.ok) fetched.push(result.file);
            else if (result.reason === "browser") browser += 1;
            else if (result.reason === "format") format += 1;
            else missing += 1;
            if (!result.ok) logDrop({ path: "url", reason: result.reason, host: (() => { try { return new URL(url).host; } catch { return ""; } })() });
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") throw error;
            browser += 1;
            logDrop({ path: "url", reason: "browser" });
          }
        }
      } finally {
        setPasteNote(null);
      }
      return { files: fetched, browser, format, missing, path: fetched.length > 0 ? ("url" as const) : ("none" as const) };
    };

    let outcome: Awaited<ReturnType<typeof takeAddresses>>;
    try {
      outcome = await takeAddresses(plan.primary);
      if (outcome.files.length === 0 && plan.fallback.urls.length + plan.fallback.dataUrls.length > 0) {
        const alt = await takeAddresses(plan.fallback);
        outcome = alt.files.length > 0 ? alt : {
          files: [],
          browser: outcome.browser + alt.browser,
          format: outcome.format + alt.format,
          missing: outcome.missing + alt.missing,
          path: "none" as const,
        };
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    }
    const failed = outcome.browser + outcome.format + outcome.missing + foreign;
    const reason = outcome.browser > 0 || plan.primary.blocked.length > 0 ? "browser" : outcome.format > 0 || foreign > 0 ? "format" : "url";
    logDrop({ path: outcome.files.length > 0 ? outcome.path : "none", reason, added: outcome.files.length, browser: outcome.browser, format: outcome.format, missing: outcome.missing });
    if (outcome.files.length > 0) await addFiles(outcome.files, "file");
    if (failed > 0 && outcome.files.length === 0) notify(dropMissMessage(reason));
    else if (failed > 0) {
      const bits: string[] = [];
      if (outcome.browser > 0) bits.push(`${outcome.browser}件はブラウザの制限で読み取れませんでした。`);
      if (outcome.format > 0) bits.push(`${outcome.format}件は JPEG、PNG、GIF ではありませんでした。`);
      if (outcome.missing > 0) bits.push(`${outcome.missing}件のアドレスからは画像を取得できませんでした。`);
      notify(`${bits.join("")}取り込めた画像以外は、そのままにしています。`);
    }
  };
  importDropRef.current = finishExternalDrop;
  importBackupRef.current = (files) => {
    setFileDrag(false);
    const backups = files.filter((file) => isBackupFileName(file.name));
    if (phase !== "ready") {
      notify("ライブラリの準備が終わるまで、バックアップは復元できません。データは変更していません。");
      return;
    }
    if (files.length !== 1 || backups.length !== 1) {
      notify("バックアップファイルは1つだけ、ほかのファイルと分けてドロップしてください。ライブラリは変更していません。");
      return;
    }
    const file = backups[0];
    if (!file || !backupRef.current) {
      notify("復元画面を開けませんでした。「バックアップから復元」から同じファイルを選んでください。データは変更していません。");
      return;
    }
    backupRef.current.inspectFile(file);
  };

  const onShellDrop = (event: DragEvent<HTMLDivElement>) => {
    if (currentTagDrag() || !isExternalFileDrag(event)) return;
    if (handledDrops.has(event.nativeEvent)) return;
    handledDrops.add(event.nativeEvent);
    event.preventDefault();
    event.stopPropagation();
    const dropped = stagedDropFiles && stagedDropFiles.length > 0 ? stagedDropFiles : filesForDrop(event.dataTransfer);
    const backups = dropped.filter((file) => isBackupFileName(file.name));
    if (backups.length > 0 && isCentralDrop(event)) {
      stagedDropFiles = null;
      importBackupRef.current(dropped);
      return;
    }
    if (backups.length > 0) {
      stagedDropFiles = null;
      notify(
        dropped.length === backups.length
          ? "バックアップは、中央の画像エリアにドロップしてください。ライブラリは変更していません。"
          : "バックアップファイルは1つだけ、ほかのファイルと分けてドロップしてください。ライブラリは変更していません。",
      );
      return;
    }
    finishExternalDrop(event.dataTransfer);
  };

  const createInPlace = (name: string) => {
    const parentId = currentFolder?.isParent ? currentFolder.id : (currentFolder?.parentId ?? null);
    void createFolder(name, parentId);
  };

  const pickLibraryTab = (tab: LibraryTab) => {
    if (compact || tabBusy || phase === "boot") return;
    if (phase === "ready" && tab === libraryTab) return;
    const ticket = tabRequest.current + 1;
    tabRequest.current = ticket;
    setTabBusy(true);
    void switchLibraryTab(tab).finally(() => {
      if (ticket !== tabRequest.current) return;
      setTabBusy(false);
    });
  };

  const tabButtons = (
    <LibraryTabButtons
      current={libraryTab}
      pressed={phase !== "boot"}
      busy={tabBusy || phase === "boot"}
      onPick={pickLibraryTab}
    />
  );

  if (phase === "unavailable") {
    return (
      <div className="library-shell">
        <div className="library-main">
          <div className="error-well grid place-items-center px-6 text-center">
            <div className="grid max-w-md gap-3">
              {compact ? null : tabButtons}
              <p className="text-lg">保存機能を使えません</p>
              <p className="text-sm text-ink-muted">{bootError}</p>
              <Button onClick={() => void retryBootstrap()}>もう一度開く</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="library-shell"
      style={{ ["--folder-width" as string]: `${folderW}px`, ["--tag-width" as string]: `${tagW}px` }}
      onDragEnter={onShellDragEnter}
      onDragOver={onShellDragOver}
      onDragLeave={onShellDragLeave}
      onDrop={onShellDrop}
    >
      {compact && phonePane ? (
        <button type="button" className="phone-scrim" aria-label="欄を閉じる" onClick={() => setPhonePane(null)} />
      ) : null}
      <FolderRail
        folders={folders}
        items={items}
        selected={folderId}
        open={folderShown}
        width={folderW}
        dragging={dragId !== null}
        ownerFolderId={ownerFolderId}
        dropFolderId={dropFolderId}
        dropCount={movingIds.length}
        onSelect={(id) => void selectFolder(id)}
        onCreate={createInPlace}
        onRename={renameFolder}
        onDelete={(id) => void removeFolder(id)}
        onCopy={(id) => rememberFolderCopy(id)}
        onPaste={() => void pasteFolderCopy()}
        onToggleHidden={(id) => void toggleFolderHidden(id)}
        hiddenIds={hiddenFolderIds}
        copyReady={folderClip !== null}
        onReorder={(sourceId, beforeId, parentId) => void moveFolder(sourceId, beforeId, parentId)}
        onNest={(sourceId, parentId) => void nestFolder(sourceId, parentId)}
        onToggle={toggleFolder}
        paneHeight={folderPane}
        onPane={(height) => void saveFolderPane(height)}
        onJump={jumpTo}
        viewer={compact}
      />
      {folderShown && !compact ? (
        <div className="folder-split" role="separator" aria-orientation="vertical" aria-label="フォルダ欄の幅" onPointerDown={(event) => beginWidth("folder", event)} />
      ) : null}
      <div className="library-main" ref={scrollRef} onPointerDown={onGalleryPointerDown}>
        <header className="library-head">
          <div className="tool-stack">
            <div className="tool-row tool-row-main">
              {compact ? null : (
                <div className="tool-cluster">
                  <span className="tool-label">タブ</span>
                  {tabButtons}
                  <div className="seg" role="group" aria-label="並び順">
                    <button type="button" className={direction === "asc" ? "is-on" : undefined} aria-pressed={direction === "asc"} disabled={phase !== "ready"} onClick={() => void setDirection("asc")}>
                      昇順
                    </button>
                    <button type="button" className={direction === "desc" ? "is-on" : undefined} aria-pressed={direction === "desc"} disabled={phase !== "ready"} onClick={() => void setDirection("desc")}>
                      降順
                    </button>
                  </div>
                </div>
              )}
              {compact ? null : (
                <div className="seg" role="group" aria-label="表示サイズ">
                  <button type="button" disabled={phase !== "ready" || columns <= 2} onClick={() => void setColumns(columns - 1)}>
                    拡大
                  </button>
                  <button type="button" disabled={phase !== "ready" || columns >= 6} onClick={() => void setColumns(columns + 1)}>
                    縮小
                  </button>
                </div>
              )}
              <Button variant="quiet" aria-pressed={favoritesOnly} disabled={!hasFavorite} onClick={() => void saveFavoritesOnly(!favoritesOnly)}>
                <Heart className="size-4" aria-hidden="true" fill={favoritesOnly ? "currentColor" : "none"} />
                お気に入りのみ
              </Button>
              <div className="tool-cluster import-cluster phone-shelved">
                <Button className="import-btn" disabled={phase !== "ready"} onClick={() => void paste()}>
                  <ClipboardPaste className="size-4" aria-hidden="true" />
                  クリップボードから貼りつけ
                </Button>
                <Button className="import-btn" disabled={phase !== "ready"} onClick={() => void capture()}>
                  <Crop className="size-4" aria-hidden="true" />
                  画面から取り込む
                </Button>
                <Button className="import-btn" disabled={phase !== "ready"} onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="size-4" aria-hidden="true" />
                  画像を取り込む
                </Button>
              </div>
              <Button variant="quiet" className="phone-shelved" disabled={phase !== "ready" || visible.length === 0} onClick={() => setPdfOpen(true)}>
                <FileDown className="size-4" aria-hidden="true" />
                現在の表示をPDF化
              </Button>
            </div>
            <div className="tool-row tool-row-sub">
              <BackupActions ref={backupRef} disabled={phase !== "ready"} viewer={compact} tab={activeLibraryTab()} />
              <Button
                variant="quiet"
                className="aux-btn"
                data-spot-trigger=""
                disabled={phase !== "ready" || resetting}
                onClick={(event) => setResetAsk(event.currentTarget.getBoundingClientRect())}
              >
                現在のタブを初期化
              </Button>
              {resetAsk ? (
                <SpotConfirm
                  anchor={resetAsk}
                  side="below"
                  title="現在のタブを初期化"
                  body={`現在選択中のタブ（タブ${activeLibraryTab()}）のライブラリデータをすべて削除し、初期状態に戻します。この操作は元に戻せません。実行しますか？`}
                  confirmLabel="初期化"
                  busy={resetting}
                  onCancel={() => {
                    if (!resetting) setResetAsk(null);
                  }}
                  onConfirm={() => {
                    if (resetting) return;
                    setResetting(true);
                    setSelected([]);
                    setOpenId(null);
                    setPrompt(null);
                    setPdfOpen(false);
                    setSlideshowOpen(false);
                    void resetCurrentLibrary().finally(() => {
                      setResetting(false);
                      setResetAsk(null);
                    });
                  }}
                />
              ) : null}
              <Button variant="quiet" className="aux-btn phone-shelved" onClick={() => setStorageOpen(true)}>
                容量
              </Button>
              <Button
                variant="quiet"
                className="aux-btn"
                disabled={phase !== "ready"}
                onClick={() => {
                  if (slideshowCandidates(visible).length === 0) {
                    notify("表示中の画像がないため、スライドショーを開始できません。");
                    return;
                  }
                  setSlideshowOpen(true);
                }}
              >
                <Play className="size-4" aria-hidden="true" />
                スライドショー
              </Button>
              <Button variant="quiet" className="tool-shelved" onClick={() => setSyncOpen(true)}>
                同期
              </Button>
              <Button variant="quiet" className="tool-shelved" onClick={() => setQrOpen(true)}>
                QR接続テスト
              </Button>
            </div>
          </div>
          {pasteNote ? (
            <div className="paste-note px-4 pb-2">
              <span>{pasteNote}</span>
              <Button variant="quiet" onClick={cancelPaste}>
                キャンセル
              </Button>
            </div>
          ) : null}
          <div className="tag-board">
            <TagFilterPane
              side="active"
              title="選択タグ"
              ids={activeTagIds}
              tagById={tagById}
              viewer={compact}
              match={tagMatch}
              onMatch={(next) => void setTagMatch(next)}
              onPrompt={(id, rect) => setPrompt({ kind: "filter", id, side: "active", ...popAt(rect) })}
              onClear={(rect) => setPrompt({ kind: "clear", side: "active", ...popAt(rect) })}
            />
            <TagFilterPane
              side="hidden"
              title="ネガティブタグ"
              ids={hiddenTagIds}
              tagById={tagById}
              viewer={compact}
              onPrompt={(id, rect) => setPrompt({ kind: "filter", id, side: "hidden", ...popAt(rect) })}
              onClear={(rect) => setPrompt({ kind: "clear", side: "hidden", ...popAt(rect) })}
            />
          </div>
        </header>
        <main className="gallery-pad">
          <p className="mb-2 text-sm text-ink-muted">{phase === "ready" ? statusLabel(visible.length, importing) : "ライブラリを開いています"}</p>
          {phase !== "ready" ? (
            <div className="empty-well grid place-items-center text-ink-muted">ライブラリを開いています</div>
          ) : (
            <div
              ref={flowRef}
              className="gallery-flow"
              style={visible.length === 0 ? undefined : { height: flow.height }}
            >
              {visible.length === 0 ? <div className="empty-well grid place-items-center text-ink-muted">{emptyCopy()}</div> : null}
              {visible.map((item) => (
                <ImageCard
                  key={item.id}
                  item={item}
                  box={placements.find((box) => box.id === item.id) ?? { id: item.id, x: 0, y: 0, w: 0, h: 0 }}
                  tags={listedTags.filter((tag) => item.tagIds.includes(tag.id))}
                  dragging={movingIds.includes(item.id)}
                  insertEdge={movingIds.includes(item.id) ? null : (insertMarks.find((mark) => mark.id === item.id)?.edge ?? null)}
                  onOpen={openAt}
                  onDragStart={onCardDragStart}
                  flash={flashId === item.id}
                  fading={flashId === item.id && flashFade}
                  origin={showOrigin ? folderPath(folders, item.folderId) : ""}
                  selected={selected.includes(item.id)}
                  bulk={selected.length > 1}
                  onToggleSelect={(id) => setSelected((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))}
                  onFavorite={(id) => {
                    if (selected.includes(id) && selected.length > 1) void favoriteImages(selected);
                    else void toggleFavorite(id);
                  }}
                  onDelete={(id) => {
                    if (selected.includes(id) && selected.length > 1) void removeImages(selected);
                    else void removeImage(id);
                  }}
                  onMemo={(id, memo) => void setImageMemo(id, memo)}
                  onAssignTag={(imageId, tagId) => {
                    const ids = selected.includes(imageId) && selected.length > 1 ? selected : [imageId];
                    void assignTagToImages(ids, tagId);
                  }}
                  onTagPrompt={(imageId, tagId, rect) => setPrompt({ kind: "image", id: tagId, imageId, ...popAt(rect) })}
                  viewer={compact}
                />
              ))}
              {marquee && marquee.w + marquee.h > 0 ? (
                <div className="select-rect" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
              ) : null}
            </div>
          )}
        </main>
      </div>
      {tagShown && !compact ? (
        <div className="tag-split" role="separator" aria-orientation="vertical" aria-label="タグ欄の幅" onPointerDown={(event) => beginWidth("tag", event)} />
      ) : null}
      <TagRail
        tags={tags}
        folders={tagFolders}
        counts={counts}
        selected={activeTagIds}
        hidden={hiddenTagIds}
        open={tagShown}
        width={tagW}
        onToggle={toggleTag}
        onSelect={(id) => void selectTag(id)}
        onHide={(id) => void hideTag(id)}
        onCreate={(name) => void createTag(name)}
        onCreateFolder={(name) => void createTagFolder(name)}
        onToggleFolder={(id) => void toggleTagFolder(id)}
        onPlaceTag={(tagId, folderId, beforeId) => void placeTag(tagId, folderId, beforeId)}
        onDeleteFolder={(id) => void deleteTagFolder(id)}
        onRename={renameTag}
        onDelete={(id) => void removeTag(id)}
        viewer={compact}
      />
      <input
        ref={fileRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
        multiple
        aria-label="画像を取り込む"
        onChange={(event) => {
          const list = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (compact || viewerLocked()) return;
          if (list.length > 0) void addFiles(list, "file");
        }}
      />
      {selected.length > 0 ? (
        <div className="select-count">
          <span>{selected.length}枚選択中</span>
          <button type="button" onClick={() => setSelected([])}>
            解除
          </button>
        </div>
      ) : null}
      {notices.length > 0 ? (
        <div className="notice-stack">
          {notices.map((notice) => (
            <div key={notice.id} className="alert-error rounded-md px-3 py-2 text-sm">
              <p className="m-0">{notice.message}</p>
              <button type="button" className="mt-1 underline" onClick={() => dismissNotices()}>
                閉じる
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {prompt ? (
        <div className="tag-pop" style={{ top: prompt.top, left: prompt.left }} role="dialog">
          <p>{promptText()}</p>
          <div>
            <button type="button" onClick={confirmPrompt}>
              削除
            </button>
            <button type="button" onClick={() => setPrompt(null)}>
              キャンセル
            </button>
          </div>
        </div>
      ) : null}
      {pendingAdd ? (
        <div className="dest-layer">
          <div className="dest-card" role="dialog" aria-label="追加先のフォルダ">
            <p className="m-0">親フォルダには直接入れられません。入れる子フォルダを選んでください。</p>
            <div className="dest-list">
              {imageFolderChoices(folders, pendingAdd.parentId).map((folder) => (
                <button key={folder.id} type="button" onClick={() => void confirmPendingAdd(folder.id)}>
                  {folderPath(folders, folder.id)}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="quiet" onClick={() => cancelPendingAdd()}>
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {fileDrag ? <div className="drop-veil">画像をここにドロップ</div> : null}
      <Lightbox
        item={openItem}
        index={openIndex}
        total={Math.max(readingIds.length, openItem ? 1 : 0)}
        prev={openItem && openIndex >= 0 && readingIds.length > 1 ? (visible.find((entry) => entry.id === readingIds[(openIndex - 1 + readingIds.length) % readingIds.length]) ?? null) : null}
        next={openItem && openIndex >= 0 && readingIds.length > 1 ? (visible.find((entry) => entry.id === readingIds[(openIndex + 1) % readingIds.length]) ?? null) : null}
        onClose={() => setOpenId(null)}
        onToggleFavorite={(id) => void toggleFavorite(id, { fromLightbox: true })}
        tags={openItem ? listedTags.filter((tag) => openItem.tagIds.includes(tag.id)) : []}
        onStep={(delta) => {
          if (!openId) return;
          const count = readingIds.length;
          if (count < 2) return;
          const index = readingIds.indexOf(openId);
          if (index < 0) return;
          const next = readingIds[(index + delta + count) % count];
          if (next) setOpenId(next);
        }}
      />
      <PdfPreview open={pdfOpen} items={visible} columns={columns} onOpenChange={setPdfOpen} />
      <Slideshow open={slideshowOpen} items={visible} onOpenChange={setSlideshowOpen} />
      <StorageDialog open={storageOpen} onOpenChange={setStorageOpen} />
      <LanSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
      <QrLinkDialog
        open={qrOpen}
        bootText={qrBoot}
        onOpenChange={(next) => {
          setQrOpen(next);
          if (!next) setQrBoot(null);
        }}
      />
      {snipUrl ? (
        <SnipOverlay
          url={snipUrl}
          busy={false}
          onCancel={closeSnip}
          onCrop={(blob) => {
            closeSnip();
            const file = new File([blob], `capture-${Date.now()}.png`, { type: "image/png" });
            void addFiles([file], "capture");
          }}
        />
      ) : null}
      {dragPreview ? (
        <div ref={previewRef} className="drag-preview" style={{ width: dragPreview.w, height: dragPreview.h }} aria-hidden="true">
          {dragPreview.src ? <img src={dragPreview.src} alt="" draggable={false} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function TagFilterPane({
  side,
  title,
  ids,
  tagById,
  viewer,
  match = "all",
  onMatch,
  onPrompt,
  onClear,
}: {
  side: "active" | "hidden";
  title: string;
  ids: string[];
  tagById: Map<string, { id: string; name: string; color: string }>;
  viewer: boolean;
  match?: "all" | "any";
  onMatch?: (match: "all" | "any") => void;
  onPrompt: (id: string, rect: DOMRect) => void;
  onClear: (rect: DOMRect) => void;
}) {
  const [hot, setHot] = useState(false);
  const chips = ids.flatMap((id) => {
    const tag = tagById.get(id);
    return tag ? [tag] : [];
  });
  return (
    <section
      className={hot ? "tag-pane is-hot" : "tag-pane"}
      onDragOver={(event) => {
        if (!eventIsTagDrag(event.dataTransfer.types)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        setHot(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setHot(false);
      }}
      onDrop={(event) => {
        if (!eventIsTagDrag(event.dataTransfer.types)) return;
        const id = event.dataTransfer.getData(TAG_DRAG) || currentTagDrag();
        event.preventDefault();
        setHot(false);
        if (id) void placeFilterTag(id, side);
      }}
    >
      <div className="tag-pane-head">
        <h2>{title}</h2>
        <div className="tag-pane-actions">
          {side === "active" ? (
            <button
              type="button"
              className="tag-banner-action is-current"
              aria-pressed={match === "any"}
              aria-label={match === "any" ? "いずれか一致。すべて一致に切り替え" : "すべて一致。いずれか一致に切り替え"}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onMatch?.(match === "any" ? "all" : "any");
              }}
            >
              {match === "any" ? "いずれか一致" : "すべて一致"}
            </button>
          ) : null}
          <button type="button" className="tag-banner-action" disabled={chips.length === 0} onClick={(event) => onClear(event.currentTarget.getBoundingClientRect())}>
            すべて外す
          </button>
        </div>
      </div>
      <div className="tag-pane-list">
        {chips.length === 0 ? <p className="tag-pane-empty">{viewer ? "タグを選ぶとここに出ます" : "ここにタグをドロップ"}</p> : null}
        {chips.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={side === "hidden" ? "tag-banner-chip is-negative" : "tag-banner-chip"}
            style={{ background: tag.color }}
            draggable={!viewer}
            onDragStart={(event) => {
              if (viewer) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = "all";
              event.dataTransfer.setData(TAG_DRAG, tag.id);
              event.dataTransfer.setData("text/plain", tag.name);
              beginTagDrag(tag.id);
              event.dataTransfer.setDragImage(event.currentTarget, 16, 12);
            }}
            onDragEnd={() => endTagDrag()}
            onDoubleClick={(event) => {
              event.preventDefault();
              onPrompt(tag.id, event.currentTarget.getBoundingClientRect());
            }}
          >
            {tag.name}
          </button>
        ))}
      </div>
    </section>
  );
}
