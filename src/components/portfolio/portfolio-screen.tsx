import { ClipboardPaste, Crop, FileDown, Heart, ImagePlus, Play, Shuffle } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { BackupActions, type BackupController } from "@/components/portfolio/backup-actions";
import { CanvasBoard } from "@/components/portfolio/canvas-board";
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
import { THUMB_CHROME_MS, THUMB_HANDOFF_MS, THUMB_ZOOM_EASE, THUMB_ZOOM_MS, THUMB_ZOOM_PHONE_MS, canThumbZoom, frameInStage, zoomShift, type ZoomRect } from "@/lib/portfolio/thumb-zoom";
import { considerShake, readAccel, SHAKE_MIN_INTERVAL_MS, SHAKE_REST, SHAKE_SAMPLE, shakePower } from "@/lib/portfolio/device-shake";
import { poseFromReading, SENSOR_REST } from "@/lib/portfolio/device-tilt";
import { applyStillTilt, freshStillWatch } from "@/lib/portfolio/sensor-still";
import { beginPermissionAsk, onMotion, onOrientation, sensorPermits, sensorWatchHot, setWantedSensors, wantedSensors, watchSensorPermits, watchWantedSensors, type SensorPermit } from "@/lib/portfolio/sensor-hub";
import { armGalleryShuffle, clearGalleryMotion, finishGalleryShake, galleryDecay, galleryImpulse, gallerySensorHeld, holdGallerySensor, markCardsOnScreen, paintGalleryShake, paintGalleryTilt, releaseGallerySensor, SHUFFLE_FADE_MS, SHUFFLE_ROW_MS, SHUFFLE_SLIDE_MS, shuffleEnterRows, shuffleEnterShift } from "@/lib/portfolio/sensor-gallery";
import { Button } from "@/components/ui/button";
import { centerSplit } from "@/lib/portfolio/canvas";
import { selectedLibraryTab, activeLibraryTab, type LibraryTab } from "@/lib/portfolio/db";
import { dragScrollSpeed, dragScrollStep } from "@/lib/portfolio/drag-scroll";
import { RETURN_MS, returnPoint } from "@/lib/portfolio/drag-return";
import { isBackupFileName } from "@/lib/portfolio/backup";
import { fetchBrowserMedia, pixivBlockedMessage } from "@/lib/portfolio/browser-fetch";
import { startDesktopFileDrops, desktopDropsListening, type DesktopDrop } from "@/lib/portfolio/desktop-drop";
import { OWN_FILE_DRAG, ownFileDragActive, SHOT_DRAG } from "@/lib/portfolio/export-file";
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
  shuffleIds,
  addedDateOrder,
  scrollTopForCenter,
  statusLabel,
  tagsInRailOrder,
  type FlowBox,
  type InsertMark,
  type TagMatch,
} from "@/lib/portfolio/logic";
import { pixivIllustId } from "@/lib/portfolio/pixiv-url";
import { axisLocked, drawerSpan, edgeGesture, gestureCommits, revealForMove, slideX, type EdgeGesture } from "@/lib/portfolio/phone-edge";
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
  getPortfolioState,
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
  saveCssFx,
  saveFolderOpen,
  saveFolderPane,
  saveFolderWidth,
  saveCanvasSplit,
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
import { ALL_FOLDERS, DEFAULT_FOLDER_VIEW, TAG_DRAG, type Folder, type ImageMeta } from "@/lib/portfolio/types";
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

function shownGallery(input: {
  items: readonly ImageMeta[];
  folders: readonly Folder[];
  folderId: string;
  hiddenFolderIds: readonly string[];
  favoritesOnly: boolean;
  activeTagIds: readonly string[];
  hiddenTagIds: readonly string[];
  tagMatch: TagMatch;
  direction: "asc" | "desc";
}): ImageMeta[] {
  if (input.folderId !== ALL_FOLDERS && input.hiddenFolderIds.includes(input.folderId)) return [];
  const scope = scopeFolderIds(input.folders, input.folderId);
  const concealed = new Set(input.hiddenFolderIds);
  const filtered = input.items.filter((item) => {
    if (!inScope(item, scope)) return false;
    if (concealed.has(item.folderId)) return false;
    if (input.favoritesOnly && !item.favorite) return false;
    return passesTagFilter(item.tagIds, input.activeTagIds, input.hiddenTagIds, input.tagMatch);
  });
  return readingSequence(filtered, input.direction);
}

function galleryKey(ids: readonly string[]): string {
  return ids.join("\n");
}

function dragTypes(event: { dataTransfer: DataTransfer | null }): string[] {
  return Array.from(event.dataTransfer?.types ?? []);
}

/** True while a gallery thumbnail drag is in progress, so the page does not import that same file. */
let galleryFileDrag = false;

function isInternalDrag(types: readonly string[]): boolean {
  return types.includes(OWN_FILE_DRAG) || types.includes(SHOT_DRAG) || types.includes(TAG_DRAG);
}

function isLibraryFileDrag(types: readonly string[]): boolean {
  return types.includes(OWN_FILE_DRAG) || types.includes(SHOT_DRAG);
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
  if (galleryFileDrag || ownFileDragActive()) return false;
  return isExternalDrop(dragTypes(event));
}

function popAt(rect: DOMRect): { top: number; left: number } {
  const width = 188;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 120));
  return { top, left };
}

function placeFloat(node: HTMLElement, clientX: number, clientY: number, grabX: number, grabY: number): void {
  node.style.transform = `translate3d(${Math.round(clientX - grabX)}px, ${Math.round(clientY - grabY)}px, 0)`;
}

const DRAG_CLONE_OPACITY = 0.5;

type DragGhost = {
  src: string;
  w: number;
  h: number;
  rx: string;
  ry: string;
  sx: string;
  sy: string;
  so: string;
  st: string;
};

type DragReturn = {
  key: number;
  id: string;
  ids: string[];
  ghost: DragGhost;
  fromX: number;
  fromY: number;
};

function cssVar(node: HTMLElement | null, name: string, fallback: string): string {
  if (!node) return fallback;
  const inline = node.style.getPropertyValue(name).trim();
  if (inline) return inline;
  const computed = getComputedStyle(node).getPropertyValue(name).trim();
  return computed || fallback;
}

function dragGhostOf(id: string, clientX: number, clientY: number): { ghost: DragGhost; grabX: number; grabY: number } {
  const card = document.querySelector(`[data-shot-id="${CSS.escape(id)}"]`);
  const rect = card instanceof HTMLElement ? card.getBoundingClientRect() : null;
  const w = rect && rect.width > 0 ? Math.round(rect.width) : 104;
  const h = rect && rect.height > 0 ? Math.round(rect.height) : 104;
  const contact = card?.querySelector(".shot-contact");
  const face = contact instanceof HTMLElement ? contact : null;
  let src = "";
  const image = card?.querySelector("img");
  if (image instanceof HTMLImageElement && image.currentSrc) src = image.currentSrc;
  else {
    const video = card?.querySelector("video");
    if (video instanceof HTMLVideoElement && video.readyState >= 2 && video.videoWidth > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          src = canvas.toDataURL("image/jpeg", 0.72);
        } catch {
          src = "";
        }
      }
    }
  }
  return {
    ghost: {
      src,
      w,
      h,
      rx: cssVar(face, "--thumb-rx", "0deg"),
      ry: cssVar(face, "--thumb-ry", "0deg"),
      sx: cssVar(face, "--thumb-sx", "0%"),
      sy: cssVar(face, "--thumb-sy", "0%"),
      so: cssVar(face, "--thumb-so", "0"),
      st: cssVar(face, "--thumb-st", "0deg"),
    },
    grabX: rect ? clientX - rect.left : w / 2,
    grabY: rect ? clientY - rect.top : h / 2,
  };
}

function folderDropVerdict(ids: readonly string[], folderId: string): "move" | "parent" | "reject" {
  const current = getPortfolioState();
  const destination = current.folders.find((folder) => folder.id === folderId);
  if (!destination) return "reject";
  if (destination.isParent) return "parent";
  const wanted = new Set(ids);
  if (!current.items.some((item) => wanted.has(item.id) && item.folderId !== folderId)) return "reject";
  return "move";
}

function visibleOrderMatches(order: readonly string[]): boolean {
  const visible = new Set(order);
  const slots = getPortfolioState()
    .items.filter((item) => visible.has(item.id))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return slots.map((item) => item.id).join("|") === order.join("|");
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
  const folderViews = usePortfolio((state) => state.views);
  const folders = usePortfolio((state) => state.folders);
  const folderId = usePortfolio((state) => state.folderId);
  const folderWidth = usePortfolio((state) => state.folderWidth);
  const folderPane = usePortfolio((state) => state.folderPane);
  const folderOpen = usePortfolio((state) => state.folderOpen);
  const favoritesOnly = usePortfolio((state) => state.favoritesOnly);
  const cssFx = usePortfolio((state) => state.cssFx);
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
  useEffect(() => {
    document.documentElement.classList.toggle("css-fx", cssFx);
  }, [cssFx]);
  const [phonePane, setPhonePane] = useState<PhonePane>(null);
  const [gifMotion, setGifMotion] = useState(true);
  const [canvasMode, setCanvasMode] = useState(false);
  const [canvasFolderOpen, setCanvasFolderOpen] = useState(false);
  const [canvasTagOpen, setCanvasTagOpen] = useState(false);
  const [canvasOrient, setCanvasOrient] = useState<"portrait" | "landscape">("portrait");
  const [splitLive, setSplitLive] = useState<number | null>(null);
  const [sessionSplit, setSessionSplit] = useState(0.5);
  const [splitWidth, setSplitWidth] = useState(0);
  const splitRef = useRef<HTMLDivElement | null>(null);
  const splitDragGen = useRef(0);
  const [edgeSlide, setEdgeSlide] = useState<{
    folder: { x: number; animate: boolean } | null;
    tag: { x: number; animate: boolean } | null;
  } | null>(null);
  const phonePaneRef = useRef(phonePane);
  const shownPaneRef = useRef<PhonePane>(phonePane);
  if (!edgeSlide) shownPaneRef.current = phonePane;
  phonePaneRef.current = phonePane;
  const edgeTimer = useRef(0);
  const [contentPx, setContentPx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tiltBox, setTiltBox] = useState<{ left: number; top: number } | null>(null);
  const [tiltRun, setTiltRun] = useState(false);
  const [shakeRun, setShakeRun] = useState(false);
  const [sensorPermit, setSensorPermit] = useState<{ orientation: SensorPermit; motion: SensorPermit }>({ orientation: "unknown", motion: "unknown" });
  const [sensorHot, setSensorHot] = useState(false);
  const [sensorStopAsk, setSensorStopAsk] = useState(false);
  const shuffleLock = useRef(false);
  const swapGen = useRef(0);
  const swapTimers = useRef<number[]>([]);
  const beginShuffleRef = useRef<() => void>(() => {});
  const playListSwapRef = useRef<(nextIds: readonly string[], apply: () => void | Promise<void>, resetScroll: boolean) => void>(() => {});
  const [zoomLaunch, setZoomLaunch] = useState<{ id: string; from: ZoomRect; width: number; height: number; phone: boolean } | null>(null);
  const zooming = useRef(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const slideshowAnchorRef = useRef<HTMLSpanElement>(null);
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
  const [dragPreview, setDragPreview] = useState<DragGhost | null>(null);
  const [dragFloatKey, setDragFloatKey] = useState(0);
  const [dragReturns, setDragReturns] = useState<DragReturn[]>([]);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashFade, setFlashFade] = useState(false);
  const [widthDrag, setWidthDrag] = useState<{ kind: "folder" | "tag"; width: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewerHost, setViewerHost] = useState<HTMLDivElement | null>(null);
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
  const desktopDropRef = useRef<(drop: DesktopDrop) => void>(() => {});
  const backupRef = useRef<BackupController>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef({ x: 0, y: 0 });
  const dragEpoch = useRef(0);
  const dragGhostRef = useRef<DragGhost | null>(null);
  const dragReturnsRef = useRef<DragReturn[]>([]);
  const returnNodes = useRef(new Map<number, HTMLDivElement>());
  const returnFrames = useRef(new Map<number, number>());
  const returnAlive = useRef(new Map<number, { on: boolean }>());
  const returnBinders = useRef(new Map<number, (node: HTMLDivElement | null) => void>());
  const returnSeq = useRef(0);
  const cancelAllReturnsRef = useRef<() => void>(() => {});
  const startReturnFlightRef = useRef<(item: DragReturn, node: HTMLDivElement) => void>(() => {});
  const dragPointRef = useRef<{ x: number; y: number } | null>(null);
  const canvasDropRef = useRef(false);
  const markKeyRef = useRef("");
  const folderHoldRef = useRef<string | null>(null);
  const selectedRef = useRef(selected);
  const directionRef = useRef(direction);
  const placementsRef = useRef<FlowBox[]>([]);
  const galleryScroll = useRef(0);
  const shownOpenId = useRef<string | null>(null);
  const viewerWasOpen = useRef(false);
  const inkLaunch = useRef(false);
  selectedRef.current = selected;
  directionRef.current = direction;

  useEffect(() => {
    const onOrient = (event: Event) => {
      const value = (event as CustomEvent<{ orientation?: string }>).detail?.orientation;
      setCanvasOrient(value === "landscape" ? "landscape" : "portrait");
    };
    window.addEventListener("komacho-canvas-orient", onOrient);
    return () => window.removeEventListener("komacho-canvas-orient", onOrient);
  }, []);
  const canvasOn = canvasMode && !compact;
  const railsLocked = canvasOn && (openId !== null || slideshowOpen);
  const folderShown = compact ? phonePane === "folder" : (canvasOn ? canvasFolderOpen : folderOpen) && !railsLocked;
  const tagShown = compact ? phonePane === "tag" : (canvasOn ? canvasTagOpen : tagOpen) && !railsLocked;
  const folderW = widthDrag?.kind === "folder" ? widthDrag.width : folderWidth;
  const tagW = widthDrag?.kind === "tag" ? widthDrag.width : tagWidth;

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    dragCleanup.current?.();
    cancelAllReturnsRef.current();
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
    node.style.transition = "none";
    node.style.opacity = String(DRAG_CLONE_OPACITY);
    placeFloat(node, point.x, point.y, grabRef.current.x, grabRef.current.y);
  }, [dragPreview, dragFloatKey]);

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
    if (!compact) {
      window.clearTimeout(edgeTimer.current);
      setEdgeSlide(null);
      return;
    }
    let gesture: EdgeGesture | null = null;
    let startX = 0;
    let startY = 0;
    let locked = false;
    let tracking = false;

    const span = () => drawerSpan(window.innerWidth, Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    const shown = (side: "folder" | "tag", active: boolean, reveal: number, width: number, animate: boolean) =>
      active ? { x: slideX(side, reveal, width), animate } : null;

    const finish = (event: TouchEvent, cancel: boolean) => {
      if (!tracking || !gesture) return;
      if (locked) event.preventDefault();
      const current = gesture;
      const moved = locked;
      tracking = false;
      locked = false;
      gesture = null;
      if (!moved) return;
      const width = span();
      const touch = event.changedTouches[0];
      const dx = touch ? touch.clientX - startX : 0;
      const reveal = revealForMove(current, dx, width);
      const commit = !cancel && gestureCommits(current, reveal, width, window.innerWidth);
      const folderActive = current.side === "folder" || ("other" in current && current.other === "folder");
      const tagActive = current.side === "tag" || ("other" in current && current.other === "tag");
      let next: PhonePane = phonePaneRef.current;
      let folderReveal = reveal.folder;
      let tagReveal = reveal.tag;
      if (current.kind === "open") {
        if (commit) {
          next = current.side;
          folderReveal = current.side === "folder" ? width : 0;
          tagReveal = current.side === "tag" ? width : 0;
        } else {
          next = current.other;
          folderReveal = current.other === "folder" ? width : 0;
          tagReveal = current.other === "tag" ? width : 0;
        }
      } else if (commit) {
        next = null;
        if (current.side === "folder") folderReveal = 0;
        else tagReveal = 0;
      } else {
        next = current.side;
        if (current.side === "folder") folderReveal = width;
        else tagReveal = width;
      }
      setEdgeSlide({
        folder: shown(folderActive ? "folder" : "tag", folderActive, folderReveal, width, true),
        tag: shown(tagActive ? "tag" : "folder", tagActive, tagReveal, width, true),
      });
      shownPaneRef.current = next;
      window.clearTimeout(edgeTimer.current);
      edgeTimer.current = window.setTimeout(() => {
        setPhonePane(next);
        setEdgeSlide(null);
      }, 230);
    };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      if (document.querySelector(".slideshow-stage, .lightbox-overlay, [role='dialog']")) return;
      const touch = event.touches[0];
      if (!touch) return;
      const target = event.target instanceof Element ? event.target : null;
      const next = edgeGesture({
        startX: touch.clientX,
        viewport: window.innerWidth,
        open: shownPaneRef.current,
        inFolder: Boolean(target?.closest(".folder-rail:not(.is-collapsed)")),
        inTag: Boolean(target?.closest(".tag-rail:not(.is-collapsed)")),
        editable: Boolean(target?.closest("input, textarea, select, [contenteditable='true']")),
      });
      if (!next) return;
      gesture = next;
      startX = touch.clientX;
      startY = touch.clientY;
      locked = false;
      tracking = true;
    };
    const onMove = (event: TouchEvent) => {
      if (!tracking || !gesture || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (!locked) {
        if (Math.hypot(dx, dy) < 12) return;
        if (!axisLocked(gesture, dx, dy)) {
          tracking = false;
          gesture = null;
          return;
        }
        locked = true;
        window.clearTimeout(edgeTimer.current);
      }
      event.preventDefault();
      const width = span();
      const reveal = revealForMove(gesture, dx, width);
      const folderActive = gesture.side === "folder" || ("other" in gesture && gesture.other === "folder");
      const tagActive = gesture.side === "tag" || ("other" in gesture && gesture.other === "tag");
      setEdgeSlide({
        folder: shown("folder", folderActive, reveal.folder, width, false),
        tag: shown("tag", tagActive, reveal.tag, width, false),
      });
    };
    const onEnd = (event: TouchEvent) => finish(event, false);
    const onCancel = (event: TouchEvent) => finish(event, true);
    window.addEventListener("touchstart", onStart, { capture: true, passive: true });
    window.addEventListener("touchmove", onMove, { capture: true, passive: false });
    window.addEventListener("touchend", onEnd, { capture: true, passive: false });
    window.addEventListener("touchcancel", onCancel, { capture: true, passive: false });
    return () => {
      window.clearTimeout(edgeTimer.current);
      window.removeEventListener("touchstart", onStart, true);
      window.removeEventListener("touchmove", onMove, true);
      window.removeEventListener("touchend", onEnd, true);
      window.removeEventListener("touchcancel", onCancel, true);
    };
  }, [compact]);

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
      if (galleryFileDrag || isLibraryFileDrag(dragTypes(event)) || dragHitsField(event)) return;
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
      if (galleryFileDrag || isLibraryFileDrag(dragTypes(event)) || dragHitsField(event)) return;
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
    let stop = () => {};
    let alive = true;
    void startDesktopFileDrops((drop) => {
      if (alive) desktopDropRef.current(drop);
    }).then((unlisten) => {
      if (!alive) {
        unlisten();
        return;
      }
      stop = unlisten;
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);

  useEffect(() => {
    return () => {
      dragCleanup.current?.();
      cancelAllReturnsRef.current();
    };
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
  const galleryInput = {
    items,
    folders,
    folderId,
    hiddenFolderIds,
    favoritesOnly,
    activeTagIds,
    hiddenTagIds,
    tagMatch,
    direction,
  };
  const visible = useMemo(
    () => shownGallery(galleryInput),
    [items, folders, folderId, hiddenFolderIds, favoritesOnly, activeTagIds, hiddenTagIds, tagMatch, direction],
  );

  useEffect(() => {
    if (phase !== "ready" || !favoritesOnly || hasFavorite || clearingFavorite.current) return;
    clearingFavorite.current = true;
    const next = shownGallery({ ...galleryInput, favoritesOnly: false });
    playListSwapRef.current(
      next.map((item) => item.id),
      () => saveFavoritesOnly(false).finally(() => {
        clearingFavorite.current = false;
      }),
      compact,
    );
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
      const paging = shownOpenId.current !== null && shownOpenId.current !== openId;
      if (!paging) shownOpenId.current = openId;
      if (paging) return;
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
    shownOpenId.current = null;
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

  useEffect(() => {
    if (!openId || shownOpenId.current === openId) return;
    shownOpenId.current = openId;
    const scroller = scrollRef.current;
    const node = scroller?.querySelector(`[data-shot-id="${CSS.escape(openId)}"]`);
    if (!scroller || !(node instanceof HTMLElement)) return;
    const scrollerRect = scroller.getBoundingClientRect();
    const cardRect = node.getBoundingClientRect();
    const head = scroller.querySelector(".library-head");
    const sticky = head instanceof HTMLElement ? head.getBoundingClientRect().height : 0;
    const top = scrollTopForCenter(scroller.scrollTop, scrollerRect.top, scrollerRect.height, cardRect.top, cardRect.height, sticky);
    galleryScroll.current = top;
    const start = scroller.scrollTop;
    const delta = top - start;
    if (Math.abs(delta) < 1) return;
    const duration = Math.min(420, Math.max(180, Math.abs(delta) * 0.45));
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - t) ** 3;
      if (scroller.isConnected) scroller.scrollTop = start + delta * eased;
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [openId]);

  useEffect(() => {
    const launch = zoomLaunch;
    if (!launch) return;
    zooming.current = true;
    document.body.classList.add("is-shot-zoom");
    document.body.style.setProperty("--shot-chrome", `${THUMB_CHROME_MS}ms`);
    document.body.style.setProperty("--shot-handoff", `${THUMB_HANDOFF_MS}ms`);
    const zoomMs = launch.phone ? THUMB_ZOOM_PHONE_MS : THUMB_ZOOM_MS;
    let flyer: HTMLElement | null = null;
    let timer = 0;
    let frame = 0;
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      window.clearTimeout(timer);
      document.body.classList.remove("is-shot-zoom", "is-shot-handoff");
      flyer?.remove();
      flyer = null;
      zooming.current = false;
      setZoomLaunch(null);
    };
    const lightboxMedia = () => {
      const node = document.querySelector(".lightbox-stage img, .lightbox-stage video");
      if (node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0) return node;
      if (node instanceof HTMLVideoElement && node.readyState >= 2) return node;
      return null;
    };
    const kickDecode = () => {
      const node = document.querySelector(".lightbox-stage img");
      if (node instanceof HTMLImageElement && node.decode) void node.decode().catch(() => undefined);
    };
    const handoff = () => {
      if (ended || !flyer) {
        finish();
        return;
      }
      const media = lightboxMedia();
      if (media) {
        const box = media.getBoundingClientRect();
        if (box.width >= 2 && box.height >= 2) {
          flyer.style.transition = "none";
          flyer.style.transform = "none";
          flyer.style.left = `${box.left}px`;
          flyer.style.top = `${box.top}px`;
          flyer.style.width = `${box.width}px`;
          flyer.style.height = `${box.height}px`;
        }
      }
      document.body.classList.add("is-shot-handoff");
      if (!launch.phone) {
        frame = window.requestAnimationFrame(() => {
          frame = window.requestAnimationFrame(finish);
        });
        return;
      }
      timer = window.setTimeout(() => {
        if (ended || !flyer) {
          finish();
          return;
        }
        flyer.style.willChange = "opacity";
        flyer.style.transition = `opacity ${THUMB_HANDOFF_MS}ms linear`;
        flyer.style.opacity = "0";
        const onFade = (event: TransitionEvent) => {
          if (event.target !== flyer || event.propertyName !== "opacity") return;
          finish();
        };
        flyer.addEventListener("transitionend", onFade);
        timer = window.setTimeout(finish, THUMB_HANDOFF_MS + 80);
      }, THUMB_HANDOFF_MS);
    };
    let waiting = false;
    const waitForPicture = (left: number) => {
      if (ended || waiting) return;
      waiting = true;
      const step = (n: number) => {
        if (ended) return;
        kickDecode();
        if (lightboxMedia() || n <= 0) {
          handoff();
          return;
        }
        timer = window.setTimeout(() => step(n - 1), 50);
      };
      step(left);
    };
    const fly = (dest: ZoomRect) => {
      const shift = zoomShift(launch.from, dest);
      const existing = document.querySelector(".shot-zoom");
      if (!shift || !(existing instanceof HTMLElement)) {
        finish();
        return;
      }
      flyer = existing;
      const go = () => {
        if (ended || !flyer) return;
        flyer.style.willChange = "transform";
        flyer.style.transition = `transform ${zoomMs}ms ${THUMB_ZOOM_EASE}`;
        flyer.style.transform = `translate(${shift.x}px, ${shift.y}px) scale(${shift.sx}, ${shift.sy})`;
        const onEnd = (event: TransitionEvent) => {
          if (event.target !== flyer || event.propertyName !== "transform") return;
          waitForPicture(24);
        };
        flyer.addEventListener("transitionend", onEnd);
        timer = window.setTimeout(() => waitForPicture(24), zoomMs + 80);
      };
      if (launch.phone) {
        flyer.style.transform = "translate(0px, 0px) scale(1)";
        frame = window.requestAnimationFrame(() => {
          frame = window.requestAnimationFrame(go);
        });
        return;
      }
      flyer.getBoundingClientRect();
      go();
    };
    const findDest = (tries: number) => {
      if (ended) return;
      kickDecode();
      const stage = document.querySelector(".lightbox-stage");
      const media = stage?.querySelector("img, video");
      let dest: ZoomRect | null = null;
      if (media instanceof HTMLElement) {
        const box = media.getBoundingClientRect();
        if (box.width >= 2 && box.height >= 2) dest = { left: box.left, top: box.top, width: box.width, height: box.height };
      }
      if (!dest && stage instanceof HTMLElement) {
        const box = stage.getBoundingClientRect();
        dest = frameInStage({ left: box.left, top: box.top, width: box.width, height: box.height }, launch.width, launch.height);
      }
      if (dest) {
        fly(dest);
        return;
      }
      if (tries >= (launch.phone ? 24 : 8)) {
        waitForPicture(24);
        return;
      }
      frame = window.requestAnimationFrame(() => findDest(tries + 1));
    };
    frame = window.requestAnimationFrame(() => findDest(0));
    return () => {
      ended = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      flyer?.remove();
      document.querySelector(".shot-zoom")?.remove();
      document.body.classList.remove("is-shot-zoom", "is-shot-handoff");
      zooming.current = false;
    };
  }, [zoomLaunch]);

  useEffect(() => {
    setSensorPermit(sensorPermits());
    const stopPermits = watchSensorPermits(() => setSensorPermit(sensorPermits()));
    const stopWant = watchWantedSensors(() => {
      const want = wantedSensors();
      setTiltRun(want.tilt);
      setShakeRun(want.shake);
    });
    return () => {
      stopPermits();
      stopWant();
    };
  }, []);

  useEffect(() => {
    if (!tiltRun && !shakeRun) {
      setSensorHot(false);
      setSensorStopAsk(false);
      return;
    }
    const tick = () => setSensorHot(sensorWatchHot(performance.now(), wantedSensors(), sensorPermits()));
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [tiltRun, shakeRun, sensorPermit]);

  useEffect(() => {
    const node = flowRef.current;
    if (!compact || openId || (!tiltRun && !shakeRun)) {
      if (node) clearGalleryMotion(node);
      return;
    }
    releaseGallerySensor();
    if (!node) return;
    const view = scrollRef.current ?? node;
    markCardsOnScreen(node, view);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.classList.toggle("is-on-screen", entry.isIntersecting);
      },
      { root: scrollRef.current, rootMargin: "80px" },
    );
    for (const card of node.querySelectorAll(".shot-card")) observer.observe(card);
    let baseline: { beta: number; gamma: number } | null = null;
    let still = freshStillWatch();
    let lastTilt = 0;
    let shown = SENSOR_REST;
    let shaking = SHAKE_REST;
    let sample = SHAKE_SAMPLE;
    let lastImpulse = 0;
    let flip = false;
    let frame = 0;
    let last = 0;
    let armed = false;
    const paintTilt = () => {
      const flow = flowRef.current;
      if (!flow || gallerySensorHeld() || !tiltRun) return;
      paintGalleryTilt(flow, shown);
    };
    const paintShake = () => {
      const flow = flowRef.current;
      if (!flow || gallerySensorHeld() || !shakeRun) return;
      paintGalleryShake(flow, shaking);
    };
    const stopTilt = tiltRun
      ? onOrientation((reading) => {
          const now = performance.now();
          const pose = poseFromReading(reading.beta, reading.gamma);
          if (!pose) return;
          if (!baseline) {
            baseline = pose;
            shown = SENSOR_REST;
            still = { anchor: pose, since: now, settling: false };
            lastTilt = now;
            paintTilt();
            return;
          }
          const step = applyStillTilt({ watch: still, baseline, shown, pose, now, dt: lastTilt ? now - lastTilt : 32 });
          still = step.watch;
          baseline = step.baseline;
          shown = step.shown;
          lastTilt = now;
          paintTilt();
        })
      : () => undefined;
    const tick = (now: number) => {
      const dt = last ? Math.min(48, now - last) : 16;
      last = now;
      shaking = galleryDecay(shaking, dt);
      paintShake();
      if (shaking !== SHAKE_REST) {
        frame = window.requestAnimationFrame(tick);
        return;
      }
      frame = 0;
      const done = finishGalleryShake(armed);
      armed = done.armed;
      if (done.shuffle) beginShuffleRef.current();
    };
    const stopShakeListen = shakeRun
      ? onMotion((motion) => {
          if (shuffleLock.current) return;
          const reading = readAccel(motion.acceleration, motion.accelerationIncludingGravity);
          if (!reading) return;
          const now = performance.now();
          const judged = considerShake(sample, reading, now);
          sample = judged.next;
          const power = shakePower(judged.delta);
          if (power <= 0 || now - lastImpulse < SHAKE_MIN_INTERVAL_MS) return;
          lastImpulse = now;
          flip = !flip;
          armed = armGalleryShuffle(armed, shuffleLock.current);
          if (!armed) return;
          shaking = galleryImpulse(power, flip);
          if (!frame) {
            last = now;
            frame = window.requestAnimationFrame(tick);
          }
        })
      : () => undefined;
    paintTilt();
    paintShake();
    return () => {
      stopTilt();
      stopShakeListen();
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      if (flowRef.current) clearGalleryMotion(flowRef.current);
    };
  }, [compact, openId, tiltRun, shakeRun, visible.length]);

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
  const clearSwapTimers = () => {
    for (const id of swapTimers.current) window.clearTimeout(id);
    swapTimers.current = [];
  };
  const finishSwapMotion = (node: HTMLElement | null, view: HTMLElement | null) => {
    if (node) {
      for (const card of node.querySelectorAll(".shot-card")) {
        if (!(card instanceof HTMLElement)) continue;
        card.classList.remove("is-shuffle-in", "is-shuffle-far");
        card.style.removeProperty("--shuffle-row");
        card.style.removeProperty("--shuffle-x");
      }
      node.classList.remove("is-shuffle-out", "is-shuffle-run");
    }
    view?.classList.remove("is-shuffle-clip");
    shuffleLock.current = false;
  };
  playListSwapRef.current = (nextIds, apply, resetScroll) => {
    const before = galleryKey(visible.map((item) => item.id));
    if (galleryKey(nextIds) === before) {
      void apply();
      return;
    }
    const scroller = scrollRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (phase !== "ready" || reduce) {
      if (reduce && resetScroll && compact && scroller) scroller.scrollTop = 0;
      void apply();
      return;
    }
    const gen = ++swapGen.current;
    clearSwapTimers();
    const flowNode = flowRef.current;
    finishSwapMotion(flowNode, scroller);
    shuffleLock.current = true;
    flowNode?.classList.add("is-shuffle-out");
    if (!compact) {
      flowNode?.classList.add("is-shuffle-run");
      scroller?.classList.add("is-shuffle-clip");
      window.dispatchEvent(new CustomEvent("komacho-thumb-rest"));
    }
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      swapTimers.current.push(id);
    };
    if (resetScroll) {
      later(() => {
        if (swapGen.current !== gen) return;
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      }, 100);
    }
    later(() => {
      if (swapGen.current !== gen) return;
      void Promise.resolve(apply()).finally(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (swapGen.current !== gen) return;
            const node = flowRef.current;
            const view = scrollRef.current;
            if (!node || !view) {
              finishSwapMotion(node, view);
              return;
            }
            const cards = [...node.querySelectorAll(".shot-card")].filter((card): card is HTMLElement => card instanceof HTMLElement);
            const shown = galleryKey(cards.map((card) => card.dataset.shotId ?? ""));
            if (shown === before || cards.length === 0) {
              finishSwapMotion(node, view);
              return;
            }
            const box = view.getBoundingClientRect();
            const plan = shuffleEnterRows(
              cards.map((card) => {
                const rect = card.getBoundingClientRect();
                return { top: rect.top, bottom: rect.bottom };
              }),
              box.top,
              box.bottom,
            );
            let maxRow = 0;
            cards.forEach((card, index) => {
              const row = plan[index] ?? -1;
              if (row < 0) return;
              maxRow = Math.max(maxRow, row);
              if (!compact) {
                const rect = card.getBoundingClientRect();
                card.style.setProperty("--shuffle-x", `${shuffleEnterShift(rect.left, box.right, rect.width)}px`);
                card.classList.add("is-shuffle-far");
              }
              card.classList.add("is-shuffle-in");
              card.style.setProperty("--shuffle-row", String(row));
            });
            node.classList.remove("is-shuffle-out");
            later(() => {
              if (swapGen.current !== gen) return;
              finishSwapMotion(node, view);
            }, SHUFFLE_SLIDE_MS + maxRow * SHUFFLE_ROW_MS + 40);
          });
        });
      });
    }, SHUFFLE_FADE_MS);
  };
  beginShuffleRef.current = () => {
    if (phase !== "ready" || visible.length < 2 || shuffleLock.current) return;
    const shuffled = shuffleIds(visible.map((item) => item.id));
    const stored = direction === "desc" ? shuffled.slice().reverse() : shuffled;
    playListSwapRef.current(shuffled, () => {
      if (compact && window.matchMedia("(prefers-reduced-motion: reduce)").matches && scrollRef.current) scrollRef.current.scrollTop = 0;
      setVisibleOrder(stored, compact);
      void commitImageOrder(compact);
    }, true);
  };
  const swapFilters = (patch: Partial<typeof galleryInput>, apply: () => void | Promise<void>) => {
    const next = shownGallery({ ...galleryInput, ...patch });
    playListSwapRef.current(
      next.map((item) => item.id),
      apply,
      compact,
    );
  };
  useEffect(() => {
    return () => {
      swapGen.current += 1;
      for (const id of swapTimers.current) window.clearTimeout(id);
      swapTimers.current = [];
    };
  }, []);

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

  const tiltLabel = sensorHot ? "利用中" : tiltRun || shakeRun ? "停止中" : sensorPermit.orientation === "unknown" && sensorPermit.motion === "unknown" ? "未許可" : "停止中";
  const onTiltMenu = (event: { currentTarget: HTMLButtonElement }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTiltBox({ left: rect.left, top: rect.bottom + 6 });
    if (sensorHot) {
      setSensorStopAsk(true);
      return;
    }
    const asked = beginPermissionAsk(window);
    void Promise.all([asked.orientation, asked.motion]).then(([orientation, motion]) => {
      setSensorPermit(sensorPermits());
      if (orientation === "granted" || motion === "granted") {
        setWantedSensors({ tilt: orientation === "granted", shake: motion === "granted" });
      }
    });
  };

  const openAt = (id: string, from?: ZoomRect) => {
    if (zooming.current || document.body.classList.contains("is-shot-zoom")) return;
    if (!openId) galleryScroll.current = scrollRef.current?.scrollTop ?? 0;
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const picture = items.find((entry) => entry.id === id);
    const source = from ?? null;
    if (picture && canThumbZoom(reduced, source)) {
      zooming.current = true;
      document.body.classList.add("is-shot-zoom");
      document.body.style.setProperty("--shot-chrome", `${THUMB_CHROME_MS}ms`);
      const card = document.querySelector(`[data-shot-id="${CSS.escape(id)}"]`);
      const media = card?.querySelector("img, video");
      const src = media instanceof HTMLImageElement || media instanceof HTMLVideoElement ? media.currentSrc || media.src : "";
      if (src) {
        const flyer = document.createElement("div");
        flyer.className = "shot-zoom";
        flyer.style.transition = "none";
        flyer.style.left = `${source.left}px`;
        flyer.style.top = `${source.top}px`;
        flyer.style.width = `${source.width}px`;
        flyer.style.height = `${source.height}px`;
        if (media instanceof HTMLVideoElement) {
          const video = document.createElement("video");
          video.src = src;
          video.muted = true;
          video.playsInline = true;
          try {
            video.currentTime = media.currentTime;
          } catch {
            /* the clone can start at zero */
          }
          flyer.appendChild(video);
        } else {
          const image = document.createElement("img");
          image.src = src;
          image.alt = "";
          flyer.appendChild(image);
        }
        document.body.appendChild(flyer);
      }
      setZoomLaunch({ id, from: source, width: picture.width, height: picture.height, phone: compact });
    }
    setOpenId(id);
  };
  const openInk = (id: string) => {
    const target = items.find((entry) => entry.id === id);
    if (compact || !target || target.animated) return;
    inkLaunch.current = true;
    openAt(id);
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
      const view = folderViews[item.folderId] ?? DEFAULT_FOLDER_VIEW;
      swapFilters({ folderId: item.folderId, direction: view.direction }, () => selectFolder(item.folderId));
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
      window.clearTimeout(edgeTimer.current);
      setEdgeSlide(null);
      setPhonePane((current) => (current === "folder" ? null : "folder"));
      return;
    }
    if (canvasOn) {
      setCanvasFolderOpen((current) => !current);
      return;
    }
    void saveFolderOpen(!folderOpen);
  };

  const toggleTag = () => {
    if (compact) {
      window.clearTimeout(edgeTimer.current);
      setEdgeSlide(null);
      setPhonePane((current) => (current === "tag" ? null : "tag"));
      return;
    }
    if (canvasOn) {
      setCanvasTagOpen((current) => !current);
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

  const SPLITTER = 12;
  const splitRatio = splitLive ?? sessionSplit;
  const splitShare = splitWidth > 0 ? centerSplit(splitWidth, splitRatio, SPLITTER) : splitRatio;
  const splitStyle = canvasOn
    ? splitWidth > 0
      ? { gridTemplateColumns: `${Math.round((splitWidth - SPLITTER) * splitShare)}px ${SPLITTER}px minmax(0, 1fr)` }
      : { gridTemplateColumns: `minmax(0, ${splitRatio}fr) ${SPLITTER}px minmax(0, ${Math.max(0.0001, 1 - splitRatio)}fr)` }
    : undefined;

  useLayoutEffect(() => {
    const node = splitRef.current;
    if (!node || !canvasOn) return;
    const measure = () => {
      const next = node.clientWidth;
      setSplitWidth((current) => (current === next ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [canvasOn]);

  const beginCanvasSplit = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const dragGen = splitDragGen.current;
    const handle = event.currentTarget;
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      /* a synthetic pointer still ends through the window listeners */
    }
    const shareAt = (clientX: number) => {
      const node = splitRef.current;
      if (!node) return null;
      const box = node.getBoundingClientRect();
      const usable = Math.max(1, box.width - SPLITTER);
      const raw = (clientX - box.left - SPLITTER / 2) / usable;
      return centerSplit(box.width, raw, SPLITTER);
    };
    const apply = (clientX: number) => {
      const share = shareAt(clientX);
      if (share !== null) setSplitLive(share);
    };
    let closed = false;
    const finish = (clientX: number) => {
      if (closed) return;
      closed = true;
      const share = shareAt(clientX);
      setSplitLive(null);
      if (share !== null && dragGen === splitDragGen.current) setSessionSplit(share);
      document.documentElement.classList.remove("is-canvas-splitting");
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      handle.removeEventListener("lostpointercapture", lost);
    };
    const move = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      pointer.preventDefault();
      apply(pointer.clientX);
    };
    const end = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      finish(pointer.clientX);
    };
    const lost = (pointer: PointerEvent) => {
      if (pointer.pointerId !== pointerId) return;
      finish(pointer.clientX);
    };
    document.documentElement.classList.add("is-canvas-splitting");
    apply(event.clientX);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    handle.addEventListener("lostpointercapture", lost);
  };

  const toggleCanvasMode = () => {
    galleryScroll.current = scrollRef.current?.scrollTop ?? galleryScroll.current;
    splitDragGen.current += 1;
    document.documentElement.classList.remove("is-canvas-splitting");
    setSplitLive(null);
    setSessionSplit(0.5);
    setCanvasFolderOpen(false);
    setCanvasTagOpen(false);
    setCanvasMode((current) => !current);
    void saveCanvasSplit(0.5);
  };

  const stopReturn = (key: number) => {
    const alive = returnAlive.current.get(key);
    if (alive) alive.on = false;
    const frame = returnFrames.current.get(key);
    if (frame) cancelAnimationFrame(frame);
    returnFrames.current.delete(key);
    returnAlive.current.delete(key);
  };
  const dropReturn = (key: number) => {
    stopReturn(key);
    if (!dragReturnsRef.current.some((item) => item.key === key)) return;
    const next = dragReturnsRef.current.filter((item) => item.key !== key);
    dragReturnsRef.current = next;
    setDragReturns(next);
  };
  const cancelReturnsFor = (imageId: string) => {
    const doomed = dragReturnsRef.current.filter((item) => item.ids.includes(imageId));
    if (doomed.length === 0) return;
    for (const item of doomed) stopReturn(item.key);
    const next = dragReturnsRef.current.filter((item) => !item.ids.includes(imageId));
    dragReturnsRef.current = next;
    setDragReturns(next);
  };
  const cancelAllReturns = () => {
    for (const item of dragReturnsRef.current) stopReturn(item.key);
    if (dragReturnsRef.current.length === 0) return;
    dragReturnsRef.current = [];
    setDragReturns([]);
  };
  cancelAllReturnsRef.current = cancelAllReturns;
  startReturnFlightRef.current = (item, node) => {
    if (returnAlive.current.has(item.key)) return;
    const alive = { on: true };
    returnAlive.current.set(item.key, alive);
    node.style.transition = "none";
    node.style.opacity = String(DRAG_CLONE_OPACITY);
    node.style.transform = `translate3d(${Math.round(item.fromX)}px, ${Math.round(item.fromY)}px, 0)`;
    const started = performance.now();
    const tick = (now: number) => {
      if (!alive.on) return;
      if (!dragReturnsRef.current.some((entry) => entry.key === item.key)) {
        alive.on = false;
        return;
      }
      const current = returnNodes.current.get(item.key);
      if (!current) {
        const retry = requestAnimationFrame(tick);
        if (!alive.on) {
          cancelAnimationFrame(retry);
          return;
        }
        returnFrames.current.set(item.key, retry);
        return;
      }
      const card = document.querySelector(`[data-shot-id="${CSS.escape(item.id)}"]`);
      if (!(card instanceof HTMLElement) || !card.isConnected) {
        dropReturn(item.key);
        return;
      }
      const t = Math.min(1, (now - started) / RETURN_MS);
      const home = card.getBoundingClientRect();
      const point = returnPoint({ x: item.fromX, y: item.fromY }, { x: home.left, y: home.top }, t);
      current.style.transition = "none";
      current.style.opacity = String(DRAG_CLONE_OPACITY);
      current.style.transform = `translate3d(${Math.round(point.x)}px, ${Math.round(point.y)}px, 0)`;
      if (t >= 1) {
        dropReturn(item.key);
        return;
      }
      const handle = requestAnimationFrame(tick);
      if (!alive.on) {
        cancelAnimationFrame(handle);
        return;
      }
      returnFrames.current.set(item.key, handle);
    };
    const handle = requestAnimationFrame(tick);
    if (!alive.on) {
      cancelAnimationFrame(handle);
      return;
    }
    returnFrames.current.set(item.key, handle);
  };
  const binderFor = (key: number) => {
    let binder = returnBinders.current.get(key);
    if (!binder) {
      binder = (node) => {
        if (!node) {
          returnNodes.current.delete(key);
          return;
        }
        returnNodes.current.set(key, node);
        if (returnAlive.current.has(key)) return;
        const flight = dragReturnsRef.current.find((entry) => entry.key === key);
        if (!flight) return;
        startReturnFlightRef.current(flight, node);
      };
      returnBinders.current.set(key, binder);
    }
    return binder;
  };

  const movingIds = dragId && selected.includes(dragId) && selected.length > 1 ? selected : dragId ? [dragId] : [];
  const ownerFolders = new Set(movingIds.map((id) => items.find((item) => item.id === id)?.folderId).filter((id): id is string => !!id));
  const ownerFolderId = ownerFolders.size === 1 ? [...ownerFolders][0]! : null;
  const returningIds = new Set(dragReturns.flatMap((item) => item.ids));

  const onCardDragStart = (id: string, event: PointerEvent) => {
    beginCardDrag(id, event.clientX, event.clientY);
    event.preventDefault();
  };

  const beginCardDrag = (id: string, clientX: number, clientY: number) => {
    if (compact) return;
    cancelReturnsFor(id);
    dragCleanup.current?.();
    const epoch = ++dragEpoch.current;
    const group = selectedRef.current.includes(id) && selectedRef.current.length > 1 ? [...selectedRef.current] : [id];
    const faced = dragGhostOf(id, clientX, clientY);
    dragGhostRef.current = faced.ghost;
    grabRef.current = { x: faced.grabX, y: faced.grabY };
    dragPointRef.current = { x: clientX, y: clientY };
    canvasDropRef.current = false;
    markKeyRef.current = "";
    folderHoldRef.current = null;
    dropRef.current = { folder: null, index: null };
    setDragId(id);
    setDragPreview(faced.ghost);
    setDragFloatKey((key) => key + 1);
    setInsertMarks([]);
    setDropFolderId(null);
    const paintFollow = (x: number, y: number) => {
      dragPointRef.current = { x, y };
      if (dragEpoch.current !== epoch) return;
      const previewNode = previewRef.current;
      if (!previewNode) return;
      previewNode.style.transition = "none";
      previewNode.style.opacity = String(DRAG_CLONE_OPACITY);
      placeFloat(previewNode, x, y, grabRef.current.x, grabRef.current.y);
    };
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
    const syncDrop = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      const overCanvas = Boolean(hit?.closest(".canvas-pane"));
      if (overCanvas && !canvasDropRef.current) {
        window.dispatchEvent(new CustomEvent("komacho-canvas-drag-enter"));
      }
      canvasDropRef.current = overCanvas;
      if (overCanvas) {
        dropRef.current = { folder: null, index: null };
        showFolder(null);
        showMarks([]);
        return;
      }
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
        x: x - rect.left,
        y: y - rect.top,
      });
      dropRef.current = { folder: null, index: slot ? slot.index : null };
      showMarks(slot?.marks ?? []);
    };
    const moveTo = (x: number, y: number) => {
      paintFollow(x, y);
      syncDrop(x, y);
    };
    let finished = false;
    let detached = false;
    let scrollFrame = 0;
    let scrollStamp = 0;
    const stopScroll = () => {
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      scrollFrame = 0;
    };
    const runScroll = (now: number) => {
      scrollFrame = 0;
      if (finished || dragEpoch.current !== epoch) return;
      const point = dragPointRef.current;
      const scroller = scrollRef.current;
      if (!point || !scroller) return;
      const bounds = scroller.getBoundingClientRect();
      const inside =
        point.x >= bounds.left &&
        point.x <= bounds.right &&
        point.y >= bounds.top &&
        point.y <= bounds.bottom;
      const speed = inside ? dragScrollSpeed(point.y, bounds.top, bounds.bottom) : 0;
      if (speed === 0) return;
      const dt = scrollStamp ? now - scrollStamp : 16;
      scrollStamp = now;
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const next = dragScrollStep(scroller.scrollTop, maxScroll, speed, dt);
      if (next !== scroller.scrollTop) {
        scroller.scrollTop = next;
        syncDrop(point.x, point.y);
      }
      if (finished || dragEpoch.current !== epoch) return;
      scrollFrame = requestAnimationFrame(runScroll);
    };
    const armScroll = () => {
      if (scrollFrame || finished || dragEpoch.current !== epoch) return;
      scrollStamp = performance.now();
      scrollFrame = requestAnimationFrame(runScroll);
    };
    const detach = () => {
      if (detached) return;
      detached = true;
      stopScroll();
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
      window.removeEventListener("blur", onBlur);
    };
    const clearDragChrome = () => {
      document.querySelectorAll<HTMLElement>(".shot-card").forEach((node) => {
        if (!node.classList.contains("is-dragging") && !node.style.getPropertyValue("--drag-wash")) return;
        node.style.removeProperty("--drag-wash");
        node.style.opacity = "";
      });
    };
    const dismissVisual = () => {
      clearDragChrome();
      dragPointRef.current = null;
      dragGhostRef.current = null;
      markKeyRef.current = "";
      folderHoldRef.current = null;
      setDragId(null);
      setDragPreview(null);
      setInsertMarks([]);
      setDropFolderId(null);
    };
    const abort = () => {
      if (dragEpoch.current !== epoch) return;
      finished = true;
      dragEpoch.current += 1;
      detach();
      dismissVisual();
      dragCleanup.current = null;
    };
    const releaseReturn = () => {
      if (dragEpoch.current !== epoch) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const ghost = dragGhostRef.current;
      const point = dragPointRef.current;
      const fromX = point ? point.x - grabRef.current.x : 0;
      const fromY = point ? point.y - grabRef.current.y : 0;
      dragEpoch.current += 1;
      dismissVisual();
      dragCleanup.current = null;
      if (reduced || !ghost || !point) return;
      const key = ++returnSeq.current;
      const flight: DragReturn = { key, id, ids: group.slice(), ghost, fromX, fromY };
      dragReturnsRef.current = [...dragReturnsRef.current, flight];
      setDragReturns(dragReturnsRef.current);
    };
    const settle = (kind: "clear" | "spring") => {
      if (dragEpoch.current !== epoch) return;
      if (kind === "spring") {
        releaseReturn();
        return;
      }
      dragEpoch.current += 1;
      dismissVisual();
      dragCleanup.current = null;
    };
    const finish = (commit: boolean) => {
      if (finished || dragEpoch.current !== epoch) return;
      finished = true;
      detach();
      setInsertMarks([]);
      setDropFolderId(null);
      markKeyRef.current = "";
      folderHoldRef.current = null;
      const point = dragPointRef.current;
      const overCanvas = canvasDropRef.current;
      canvasDropRef.current = false;
      const folder = dropRef.current.folder;
      const index = dropRef.current.index;
      dropRef.current = { folder: null, index: null };
      if (!commit) {
        settle("spring");
        return;
      }
      if (overCanvas && point) {
        const mime = getPortfolioState().items.find((item) => item.id === id)?.mime ?? "";
        if (!mime.startsWith("image/")) {
          settle("spring");
          return;
        }
        window.dispatchEvent(new CustomEvent("komacho-canvas-drop", { detail: { imageId: id, clientX: point.x, clientY: point.y } }));
        settle("clear");
        return;
      }
      if (folder && folder !== ALL_FOLDERS) {
        const verdict = folderDropVerdict(group, folder);
        if (verdict === "parent") void moveImagesToFolder(group, folder);
        if (verdict !== "move") {
          settle("spring");
          return;
        }
        dragCleanup.current = abort;
        void moveImagesToFolder(group, folder).then(() => {
          if (dragEpoch.current !== epoch) return;
          const moved = getPortfolioState().items.some((item) => group.includes(item.id) && item.folderId === folder);
          settle(moved ? "clear" : "spring");
        });
        return;
      }
      if (index !== null) {
        const order = orderFromInsertion(placementsRef.current, group, id, index, directionRef.current === "desc");
        if (!order) {
          settle("spring");
          return;
        }
        if (!visibleOrderMatches(order)) {
          setVisibleOrder(order);
          if (!visibleOrderMatches(order)) {
            settle("spring");
            return;
          }
        }
        dragCleanup.current = abort;
        void commitImageOrder().then(() => {
          if (dragEpoch.current !== epoch) return;
          settle(visibleOrderMatches(order) ? "clear" : "spring");
        });
        return;
      }
      settle("spring");
    };
    const onPointerMove = (pointer: PointerEvent) => {
      if (pointer.cancelable) pointer.preventDefault();
      moveTo(pointer.clientX, pointer.clientY);
      armScroll();
    };
    const onPointerUp = (pointer: PointerEvent) => {
      const leftWindow =
        pointer.clientX < 0 ||
        pointer.clientY < 0 ||
        pointer.clientX > window.innerWidth ||
        pointer.clientY > window.innerHeight;
      if (leftWindow) {
        finish(false);
        return;
      }
      moveTo(pointer.clientX, pointer.clientY);
      const hit = document.elementFromPoint(pointer.clientX, pointer.clientY);
      const overCanvas = Boolean(hit?.closest(".canvas-pane"));
      if (overCanvas && !canvasDropRef.current) window.dispatchEvent(new CustomEvent("komacho-canvas-drag-enter"));
      canvasDropRef.current = overCanvas;
      finish(true);
    };
    const onPointerCancel = () => finish(false);
    const onBlur = () => finish(false);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    window.addEventListener("blur", onBlur);
    dragCleanup.current = abort;
  };

  const onGalleryPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (compact || viewerLocked() || event.button !== 0) return;
    const target = event.target as Element | null;
    if (target?.closest(".shot-card, button, a, input, textarea, select, label, .library-head, .canvas-pane, .canvas-split-handle, .gallery-viewer-host")) return;
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
      const patch = prompt.side === "active" ? { activeTagIds: [] } : { hiddenTagIds: [] };
      swapFilters(patch, () => clearFilterTags(prompt.side));
    } else {
      const patch =
        prompt.side === "active"
          ? { activeTagIds: activeTagIds.filter((id) => id !== prompt.id) }
          : { hiddenTagIds: hiddenTagIds.filter((id) => id !== prompt.id) };
      swapFilters(patch, () => removeFilterTag(prompt.id, prompt.side));
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
    if (
      rawFiles.length === 0 &&
      plan.primary.urls.length + plan.primary.dataUrls.length === 0 &&
      desktopDropsListening()
    ) {
      return;
    }
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
  desktopDropRef.current = (drop) => {
    setFileDrag(false);
    if (drop.files.length === 0) {
      if (drop.failed > 0) {
        notify("エクスプローラーからファイルを読み取れませんでした。「画像を取り込む」から選んでください。データは変更していません。");
      }
      return;
    }
    const node = drop.point ? document.elementFromPoint(drop.point.x, drop.point.y) : document.querySelector(".library-main");
    const central = Boolean(node?.closest(".library-main, .drop-veil"));
    const backups = drop.files.filter((file) => isBackupFileName(file.name));
    if (backups.length > 0) {
      if (central && drop.files.length === 1) {
        importBackupRef.current(drop.files);
        return;
      }
      notify(
        drop.files.length === backups.length
          ? "バックアップは、中央の画像エリアにドロップしてください。ライブラリは変更していません。"
          : "バックアップファイルは1つだけ、ほかのファイルと分けてドロップしてください。ライブラリは変更していません。",
      );
      return;
    }
    void importExternalDrop(drop.files, chooseDroppedPayload("", "", ""));
    if (drop.failed > 0) notify(`${drop.failed}件は読み取れませんでした。取り込めた画像以外は、そのままにしています。`);
  };
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
      style={{
        ["--folder-width" as string]: `${folderW}px`,
        ["--tag-width" as string]: `${tagW}px`,
        ...(!compact && !folderShown ? { ["--folder-lane" as string]: "var(--rail-collapsed)" } : {}),
        ...(!compact && !tagShown ? { ["--tag-lane" as string]: "var(--rail-collapsed)" } : {}),
      }}
      onDragEnter={onShellDragEnter}
      onDragOver={onShellDragOver}
      onDragLeave={onShellDragLeave}
      onDrop={onShellDrop}
    >
      {compact && (phonePane || edgeSlide) ? (
        <button
          type="button"
          className="phone-scrim"
          aria-label="欄を閉じる"
          onClick={() => {
            window.clearTimeout(edgeTimer.current);
            setEdgeSlide(null);
            setPhonePane(null);
          }}
        />
      ) : null}
      <FolderRail
        folders={folders}
        items={items}
        selected={folderId}
        open={folderShown}
        slide={compact ? edgeSlide?.folder ?? null : null}
        width={folderW}
        dragging={dragId !== null}
        ownerFolderId={ownerFolderId}
        dropFolderId={dropFolderId}
        dropCount={movingIds.length}
        onSelect={(id) => {
          if (id === folderId) return;
          const view = folderViews[id] ?? DEFAULT_FOLDER_VIEW;
          swapFilters({ folderId: id, direction: view.direction }, () => selectFolder(id));
        }}
        onCreate={createInPlace}
        onRename={renameFolder}
        onDelete={(id) => void removeFolder(id)}
        onCopy={(id) => rememberFolderCopy(id)}
        onPaste={() => void pasteFolderCopy()}
        onToggleHidden={(id) => {
          const hiddenFolderIdsNext = hiddenFolderIds.includes(id) ? hiddenFolderIds.filter((entry) => entry !== id) : [...hiddenFolderIds, id];
          swapFilters({ hiddenFolderIds: hiddenFolderIdsNext }, () => toggleFolderHidden(id));
        }}
        hiddenIds={hiddenFolderIds}
        copyReady={folderClip !== null}
        onReorder={(sourceId, beforeId, parentId) => void moveFolder(sourceId, beforeId, parentId)}
        onNest={(sourceId, parentId) => void nestFolder(sourceId, parentId)}
        onToggle={toggleFolder}
        paneHeight={folderPane}
        onPane={(height) => void saveFolderPane(height)}
        onJump={jumpTo}
        viewer={compact}
        locked={railsLocked}
      />
      {folderShown && !compact ? (
        <div className="folder-split" role="separator" aria-orientation="vertical" aria-label="フォルダ欄の幅" onPointerDown={(event) => beginWidth("folder", event)} />
      ) : null}
      <div className={canvasOn ? "library-main is-canvas" : "library-main"} ref={canvasOn ? undefined : scrollRef} onPointerDown={onGalleryPointerDown}>
        <header className="library-head">
          <div className="tool-stack">
            <div
              className="tool-row tool-row-main"
              onClick={(event) => {
                if (!compact) return;
                const target = event.target;
                if (!(target instanceof Element) || target.closest("button, a, input, textarea, select, label")) return;
                scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              {compact ? null : (
                <div className="tool-cluster">
                  <span className="tool-label">タブ</span>
                  {tabButtons}
                  <div className="seg" role="group" aria-label="並び順">
                    <button type="button" className={direction === "asc" ? "is-on" : undefined} aria-pressed={direction === "asc"} disabled={phase !== "ready"} onClick={() => swapFilters({ direction: "asc" }, () => setDirection("asc"))}>
                      昇順
                    </button>
                    <button type="button" className={direction === "desc" ? "is-on" : undefined} aria-pressed={direction === "desc"} disabled={phase !== "ready"} onClick={() => swapFilters({ direction: "desc" }, () => setDirection("desc"))}>
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
              <Button variant="quiet" aria-pressed={favoritesOnly} disabled={!hasFavorite} onClick={() => swapFilters({ favoritesOnly: !favoritesOnly }, () => saveFavoritesOnly(!favoritesOnly))}>
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
              {compact ? (
              <span className="tilt-menu">
                <Button variant="quiet" className={sensorHot ? "aux-btn is-sensor-live" : "aux-btn"} aria-pressed={sensorHot} aria-expanded={sensorStopAsk} aria-label={`傾き ${tiltLabel}`} onClick={onTiltMenu}>
                  傾き
                  <span className="tilt-state">{tiltLabel}</span>
                </Button>
                {sensorStopAsk && tiltBox ? (
                  <div className="tilt-panel" role="dialog" aria-label="傾き・シェイクを停止しますか？" style={{ left: tiltBox.left, top: tiltBox.top }}>
                    <p>傾き・シェイクを停止しますか？</p>
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setWantedSensors({ tilt: false, shake: false });
                          setSensorStopAsk(false);
                        }}
                      >
                        停止する
                      </button>
                      <button type="button" onClick={() => setSensorStopAsk(false)}>
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : null}
              </span>
              ) : null}
              {compact ? null : (
                <button type="button" className={cssFx ? "aux-btn css-fx-switch is-on" : "aux-btn css-fx-switch"} role="switch" aria-checked={cssFx} onClick={() => void saveCssFx(!cssFx)}>
                  CSS演出
                </button>
              )}
              <BackupActions ref={backupRef} disabled={phase !== "ready"} viewer={compact} tab={activeLibraryTab()} />
              <Button
                variant="quiet"
                className="aux-btn phone-shelved"
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
              <Button variant="quiet" className="aux-btn" onClick={() => setStorageOpen(true)}>
                詳細
              </Button>
              <span ref={slideshowAnchorRef} className="slideshow-anchor">
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
              </span>
              <Button
                variant="quiet"
                className="aux-btn"
                disabled={phase !== "ready" || visible.length < 2}
                onClick={() => beginShuffleRef.current()}
              >
                <Shuffle className="size-4" aria-hidden="true" />
                シャッフル
              </Button>
              <Button
                variant="quiet"
                className="aux-btn"
                disabled={phase !== "ready" || visible.length < 2}
                onClick={() => {
                  const sorted = addedDateOrder(visible);
                  const stored = direction === "desc" ? sorted.slice().reverse() : sorted;
                  playListSwapRef.current(sorted, () => {
                    setVisibleOrder(stored, compact);
                    void commitImageOrder(compact);
                  }, compact);
                }}
              >
                日付順でソート
              </Button>
              <Button
                variant="quiet"
                className="aux-btn"
                disabled={phase !== "ready"}
                aria-pressed={gifMotion}
                onClick={() => setGifMotion((current) => !current)}
              >
                {gifMotion ? "アニメ▶️" : "アニメ⏸️"}
              </Button>
              <Button variant="quiet" className="tool-shelved" onClick={() => setSyncOpen(true)}>
                同期
              </Button>
              <Button variant="quiet" className="tool-shelved" onClick={() => setQrOpen(true)}>
                QR接続テスト
              </Button>
              <div className="canvas-mode-cluster phone-shelved">
                {canvasOn ? (
                  <Button variant="quiet" className="aux-btn" disabled={phase !== "ready"} onClick={() => window.dispatchEvent(new CustomEvent("komacho-canvas-save"))}>
                    保存
                  </Button>
                ) : null}
                {canvasOn ? (
                  <Button variant="quiet" className="aux-btn" disabled={phase !== "ready"} onClick={() => window.dispatchEvent(new CustomEvent("komacho-canvas-copy"))}>
                    コピー
                  </Button>
                ) : null}
                <Button
                  variant="quiet"
                  className={canvasOn ? "aux-btn canvas-mode-btn is-on" : "aux-btn canvas-mode-btn"}
                  aria-pressed={canvasOn}
                  disabled={phase !== "ready"}
                  onClick={toggleCanvasMode}
                >
                  キャンバスモード
                </Button>
                {canvasOn ? (
                  <Button
                    variant="quiet"
                    className="aux-btn"
                    disabled={phase !== "ready"}
                    aria-pressed={canvasOrient === "landscape"}
                    onClick={() => window.dispatchEvent(new CustomEvent("komacho-canvas-flip"))}
                  >
                    {canvasOrient === "landscape" ? "横" : "縦"}
                  </Button>
                ) : null}
              </div>
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
              onMatch={(next) => swapFilters({ tagMatch: next }, () => setTagMatch(next))}
              onPlace={(id) =>
                swapFilters(
                  {
                    activeTagIds: activeTagIds.includes(id) ? activeTagIds : [...activeTagIds, id],
                    hiddenTagIds: hiddenTagIds.filter((entry) => entry !== id),
                  },
                  () => placeFilterTag(id, "active"),
                )
              }
              onPrompt={(id, rect) => setPrompt({ kind: "filter", id, side: "active", ...popAt(rect) })}
              onClear={(rect) => setPrompt({ kind: "clear", side: "active", ...popAt(rect) })}
            />
            <TagFilterPane
              side="hidden"
              title="ネガティブタグ"
              ids={hiddenTagIds}
              tagById={tagById}
              viewer={compact}
              onPlace={(id) =>
                swapFilters(
                  {
                    hiddenTagIds: hiddenTagIds.includes(id) ? hiddenTagIds : [...hiddenTagIds, id],
                    activeTagIds: activeTagIds.filter((entry) => entry !== id),
                  },
                  () => placeFilterTag(id, "hidden"),
                )
              }
              onPrompt={(id, rect) => setPrompt({ kind: "filter", id, side: "hidden", ...popAt(rect) })}
              onClear={(rect) => setPrompt({ kind: "clear", side: "hidden", ...popAt(rect) })}
            />
          </div>
        </header>
        <div className={canvasOn ? "canvas-split" : "gallery-only"} ref={splitRef} style={splitStyle}>
          <div className="gallery-frame">
          <div className="canvas-gallery" ref={canvasOn ? scrollRef : undefined}>
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
                  settling={returningIds.has(item.id) && !movingIds.includes(item.id)}
                  insertEdge={movingIds.includes(item.id) ? null : (insertMarks.find((mark) => mark.id === item.id)?.edge ?? null)}
                  onOpen={openAt}
                  zoomSource={zoomLaunch?.id === item.id}
                  onInk={openInk}
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
                  gifMotion={gifMotion}
                />
              ))}
              {marquee && marquee.w + marquee.h > 0 ? (
                <div className="select-rect" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
              ) : null}
            </div>
          )}
        </main>
          </div>
          <div ref={setViewerHost} className="gallery-viewer-host" />
          </div>
          {canvasOn ? (
            <div
              className={splitLive !== null ? "canvas-split-handle is-dragging" : "canvas-split-handle"}
              role="separator"
              aria-orientation="vertical"
              aria-label="一覧とキャンバスの幅"
              aria-valuemin={15}
              aria-valuemax={85}
              aria-valuenow={Math.round(splitShare * 100)}
              onPointerDown={beginCanvasSplit}
            />
          ) : null}
          {canvasOn ? <CanvasBoard images={items} libraryEpoch={libraryEpoch} ready={phase === "ready"} /> : null}
        </div>
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
        slide={compact ? edgeSlide?.tag ?? null : null}
        width={tagW}
        onToggle={toggleTag}
        onSelect={(id) => {
          const turningOff = activeTagIds.includes(id);
          swapFilters(
            {
              activeTagIds: turningOff ? activeTagIds.filter((entry) => entry !== id) : [...activeTagIds, id],
              hiddenTagIds: turningOff ? hiddenTagIds : hiddenTagIds.filter((entry) => entry !== id),
            },
            () => selectTag(id),
          );
        }}
        onHide={(id) => {
          const turningOff = hiddenTagIds.includes(id);
          swapFilters(
            {
              hiddenTagIds: turningOff ? hiddenTagIds.filter((entry) => entry !== id) : [...hiddenTagIds, id],
              activeTagIds: turningOff ? activeTagIds : activeTagIds.filter((entry) => entry !== id),
            },
            () => hideTag(id),
          );
        }}
        onCreate={(name) => void createTag(name)}
        onCreateFolder={(name) => void createTagFolder(name)}
        onToggleFolder={(id) => void toggleTagFolder(id)}
        onPlaceTag={(tagId, folderId, beforeId) => void placeTag(tagId, folderId, beforeId)}
        onDeleteFolder={(id) => void deleteTagFolder(id)}
        onRename={renameTag}
        onDelete={(id) => void removeTag(id)}
        viewer={compact}
        locked={railsLocked}
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
        launchInk={inkLaunch}
        contained={canvasOn}
        container={viewerHost}
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
      <Slideshow open={slideshowOpen} items={visible} onOpenChange={setSlideshowOpen} dock={canvasOn} container={canvasOn ? viewerHost : null} anchor={slideshowAnchorRef.current} />
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
        <div key={dragFloatKey} ref={previewRef} className="drag-preview" style={{ width: dragPreview.w, height: dragPreview.h }} data-drag-float="" aria-hidden="true">
          <div className="drag-frame shot-frame">
            <div
              className="shot-contact"
              style={
                {
                  "--thumb-rx": dragPreview.rx,
                  "--thumb-ry": dragPreview.ry,
                  "--thumb-sx": dragPreview.sx,
                  "--thumb-sy": dragPreview.sy,
                  "--thumb-so": dragPreview.so,
                  "--thumb-st": dragPreview.st,
                  transition: "none",
                } as CSSProperties
              }
            >
              {dragPreview.src ? <img src={dragPreview.src} alt="" draggable={false} /> : null}
              <span className="shot-sheen" style={{ transition: "none" }} />
            </div>
          </div>
        </div>
      ) : null}
      {dragReturns.map((item) => (
        <div
          key={item.key}
          ref={binderFor(item.key)}
          className="drag-preview"
          style={{ width: item.ghost.w, height: item.ghost.h, opacity: DRAG_CLONE_OPACITY, pointerEvents: "none" }}
          data-drag-return={item.key}
          aria-hidden="true"
        >
          <div className="drag-frame shot-frame">
            <div
              className="shot-contact"
              style={
                {
                  "--thumb-rx": item.ghost.rx,
                  "--thumb-ry": item.ghost.ry,
                  "--thumb-sx": item.ghost.sx,
                  "--thumb-sy": item.ghost.sy,
                  "--thumb-so": item.ghost.so,
                  "--thumb-st": item.ghost.st,
                  transition: "none",
                } as CSSProperties
              }
            >
              {item.ghost.src ? <img src={item.ghost.src} alt="" draggable={false} /> : null}
              <span className="shot-sheen" style={{ transition: "none" }} />
            </div>
          </div>
        </div>
      ))}
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
  onPlace,
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
  onPlace: (id: string) => void;
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
        if (id) onPlace(id);
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
