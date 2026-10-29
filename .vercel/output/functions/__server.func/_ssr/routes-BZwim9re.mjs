import { i as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { _ as ClipboardPaste, a as PanelRightOpen, b as ChevronDown, c as PanelLeftClose, d as Folder, f as FolderPlus, g as Copy, h as Crop, i as Pencil, l as ImagePlus, m as Download, n as Trash2, o as PanelRightClose, p as FileDown, r as Play, s as PanelLeftOpen, u as Heart, v as ChevronRight, x as Check, y as ChevronLeft } from "../_libs/lucide-react.mjs";
import { a as DialogOverlay, c as Slot, i as DialogDescription, l as require_react_dom, n as DialogClose, o as DialogPortal, r as DialogContent, s as DialogTitle, t as Dialog } from "../_libs/@radix-ui/react-dialog+[...].mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { i as strToU8, n as gzipSync, r as strFromU8, t as gunzipSync } from "../_libs/fflate.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BZwim9re.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom());
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium transition-[background-color,border-color,color,opacity] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 disabled:shadow-[inset_0_0_0_1px_var(--color-line-strong)] min-h-11 px-4 text-sm", {
	variants: { variant: {
		primary: "border-transparent bg-pine text-pine-ink hover:opacity-90",
		quiet: "border-line-strong bg-paper-raised text-ink hover:bg-paper-deep",
		ghost: "border-transparent bg-transparent text-ink hover:bg-paper-deep"
	} },
	defaultVariants: { variant: "primary" }
});
function Button({ className, variant, asChild = false, type = "button", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({ variant }), className),
		type,
		...props
	});
}
var SUPPORTED_MIMES = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
	"video/mp4",
	"video/webm"
];
var TAG_COLORS = [
	"#e07a5f",
	"#d4b483",
	"#81b29a",
	"#7eb6d6",
	"#c38d9e",
	"#b8a1e3",
	"#e6c35c",
	"#8fbf9f"
];
var TAG_DRAG = "application/x-komacho-tag";
var DEFAULT_FOLDER_VIEW = {
	columns: 4,
	direction: "desc"
};
var EXTENSIONS = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	webp: "image/webp",
	gif: "image/gif",
	mp4: "video/mp4",
	webm: "video/webm"
};
function baseName(name) {
	return (name.trim().split(/[/\\]/).pop()?.trim() ?? "") || "無題";
}
function classifyImageInput(file) {
	if (file.size <= 0) return {
		ok: false,
		reason: "empty"
	};
	const type = file.type.toLowerCase().split(";")[0]?.trim() ?? "";
	if (type === "image/jpg" || type === "image/pjpeg") return {
		ok: true,
		mime: "image/jpeg"
	};
	if (type === "video/mp4" || type === "video/webm") return {
		ok: true,
		mime: type
	};
	if (SUPPORTED_MIMES.includes(type)) return {
		ok: true,
		mime: type
	};
	if (type && type !== "application/octet-stream") return {
		ok: false,
		reason: "type"
	};
	const mime = EXTENSIONS[file.name.split(".").pop()?.toLowerCase() ?? ""];
	if (!mime) return {
		ok: false,
		reason: "type"
	};
	return {
		ok: true,
		mime
	};
}
function sortByOrder(items) {
	return items.slice().sort((a, b) => a.order - b.order || a.addedAt - b.addedAt);
}
/** Screen, lightbox, and PDF share this list. Stored order stays oldest-first. */
function readingSequence(items, direction) {
	const sorted = sortByOrder(items);
	if (direction === "desc") sorted.reverse();
	return sorted;
}
function importNotice(stats) {
	if (stats.skippedType + stats.skippedEmpty + stats.failedDecode + stats.failedSave === 0) return null;
	const parts = [];
	if (stats.added > 0) parts.push(`${stats.added}枚は追加しました。`);
	if (stats.quota) parts.push("保存容量が不足している可能性があります。「容量」で使用量を確認し、不要な画像を削除してから、もう一度追加してください。画像は自動では削除しません。");
	else if (stats.failedSave > 0) parts.push(`${stats.failedSave}枚を保存できませんでした。`);
	if (stats.failedDecode > 0) parts.push(`${stats.failedDecode}枚は画像として読み込めませんでした。`);
	if (stats.skippedType > 0) parts.push(`${stats.skippedType}件は対応外の形式です。JPEG、PNG、GIF、WebPのみ追加できます。`);
	if (stats.skippedEmpty > 0) parts.push(`${stats.skippedEmpty}件は空のファイルでした。`);
	return parts.join("");
}
function storageErrorMessage(error, action) {
	if ((typeof DOMException !== "undefined" && error instanceof DOMException || error instanceof Error ? error.name : "") === "QuotaExceededError") return "保存容量が不足しています。「容量」で使用量を確認し、不要な画像を削除してから、もう一度追加してください。画像は自動では削除しません。";
	if (action === "delete") return "削除を保存できませんでした。画像はそのまま残しています。";
	if (action === "open") return "画像ライブラリを開けませんでした。このブラウザでは保存機能が使えないことがあります。";
	return "保存に失敗しました。容量が足りない可能性があります。「容量」で使用量を確認し、不要な画像を削除してからもう一度試してください。画像は自動では削除しません。";
}
function formatCount(count) {
	return `${count}枚`;
}
function statusLabel(count, importing) {
	if (!importing) return formatCount(count);
	return `${formatCount(count)} · 保存中 ${importing.done}/${importing.total}`;
}
function normalizeScale(value) {
	return value === 2 || value === 3 ? value : 1;
}
function normalizeMeta(raw) {
	if (!raw || typeof raw !== "object") return null;
	const row = raw;
	if (typeof row.id !== "string" || !row.id) return null;
	if (row.mime !== "image/jpeg" && row.mime !== "image/png" && row.mime !== "image/webp" && row.mime !== "image/gif" && row.mime !== "video/mp4" && row.mime !== "video/webm") return null;
	const source = row.source === "clipboard" || row.source === "capture" ? row.source : "file";
	return {
		id: row.id,
		name: typeof row.name === "string" && row.name ? row.name : "無題",
		mime: row.mime,
		width: typeof row.width === "number" ? row.width : 0,
		height: typeof row.height === "number" ? row.height : 0,
		byteSize: typeof row.byteSize === "number" ? row.byteSize : 0,
		addedAt: typeof row.addedAt === "number" ? row.addedAt : 0,
		order: typeof row.order === "number" ? row.order : 0,
		scale: normalizeScale(row.scale),
		source,
		folderId: typeof row.folderId === "string" ? row.folderId : "",
		favorite: row.favorite === true,
		tagIds: Array.isArray(row.tagIds) ? [...new Set(row.tagIds.filter((id) => typeof id === "string" && id.length > 0))] : [],
		animated: row.animated === true,
		memo: normalizeMemo(row.memo)
	};
}
function normalizeMemo(value) {
	if (typeof value !== "string") return "";
	return value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 100);
}
/** Empty text cancels a new note and clears one that already existed. */
function commitMemo(original, draft) {
	if (!normalizeMemo(draft)) return normalizeMemo(original) ? "clear" : "cancel";
	return "save";
}
function parseActiveTagIds(raw, known) {
	if (!raw) return [];
	let ids = [];
	if (raw.startsWith("[")) try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) ids = parsed.filter((id) => typeof id === "string" && id.length > 0);
	} catch {
		ids = [];
	}
	else ids = [raw];
	const seen = /* @__PURE__ */ new Set();
	const next = [];
	for (const id of ids) {
		if (!known.has(id) || seen.has(id)) continue;
		seen.add(id);
		next.push(id);
	}
	return next;
}
function hasEveryTag(tagIds, required) {
	return required.every((id) => tagIds.includes(id));
}
/** Missing or unknown values stay on the original AND match. */
function normalizeTagMatch(value) {
	return value === "any" ? "any" : "all";
}
function passesTagFilter(tagIds, required, hidden, match = "all") {
	if (hidden.some((id) => tagIds.includes(id))) return false;
	if (required.length === 0) return true;
	if (normalizeTagMatch(match) === "any") return required.some((id) => tagIds.includes(id));
	return hasEveryTag(tagIds, required);
}
/** Tags that belong to one tag folder, and the image links that must drop those tags. */
function planTagFolderRemoval(input) {
	const doomed = new Set(input.tags.filter((tag) => tag.folderId === input.folderId).map((tag) => tag.id));
	return {
		tagIds: [...doomed],
		items: input.items.flatMap((item) => {
			if (!item.tagIds.some((id) => doomed.has(id))) return [];
			return [{
				id: item.id,
				tagIds: item.tagIds.filter((id) => !doomed.has(id))
			}];
		}),
		activeTagIds: input.activeTagIds.filter((id) => !doomed.has(id)),
		hiddenTagIds: input.hiddenTagIds.filter((id) => !doomed.has(id))
	};
}
/** Same comparison the tag list uses inside one folder, and for tags with no folder. */
function compareTagOrder(a, b) {
	return a.order - b.order || a.createdAt - b.createdAt;
}
/**
* Tags in the right-hand list's top-to-bottom order.
* Folders stay in the order they are shown, then tags that belong to no folder.
*/
function tagsInRailOrder(tags, folders) {
	const groups = /* @__PURE__ */ new Map();
	for (const tag of tags) {
		const key = tag.folderId ?? null;
		const list = groups.get(key);
		if (list) list.push(tag);
		else groups.set(key, [tag]);
	}
	const take = (key) => (groups.get(key) ?? []).slice().sort(compareTagOrder);
	const seen = /* @__PURE__ */ new Set();
	const ordered = [];
	for (const folder of folders) {
		if (seen.has(folder.id)) continue;
		seen.add(folder.id);
		ordered.push(...take(folder.id));
	}
	ordered.push(...take(null));
	for (const [key, list] of groups) if (key !== null && !seen.has(key)) ordered.push(...list.slice().sort(compareTagOrder));
	return ordered;
}
function normalizeTag(raw) {
	if (!raw || typeof raw !== "object") return null;
	const row = raw;
	if (typeof row.id !== "string" || !row.id) return null;
	const name = typeof row.name === "string" ? row.name.trim().slice(0, 40) : "";
	if (!name) return null;
	const color = typeof row.color === "string" && TAG_COLORS.includes(row.color) ? row.color : TAG_COLORS[0];
	return {
		id: row.id,
		name,
		color,
		order: typeof row.order === "number" ? row.order : 0,
		createdAt: typeof row.createdAt === "number" ? row.createdAt : 0,
		folderId: typeof row.folderId === "string" && row.folderId ? row.folderId : null
	};
}
function normalizeTagFolder(raw) {
	if (!raw || typeof raw !== "object") return null;
	const row = raw;
	if (typeof row.id !== "string" || !row.id) return null;
	const name = typeof row.name === "string" ? row.name.trim().slice(0, 40) : "";
	if (!name) return null;
	return {
		id: row.id,
		name,
		order: typeof row.order === "number" ? row.order : 0,
		createdAt: typeof row.createdAt === "number" ? row.createdAt : 0,
		open: row.open !== false
	};
}
function assignVisibleOrders(items, visibleIds) {
	const visible = new Set(visibleIds);
	const slots = items.filter((item) => visible.has(item.id)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
	if (slots.length !== visibleIds.length || new Set(visibleIds).size !== visibleIds.length) return null;
	if (slots.map((item) => item.id).join("|") === visibleIds.join("|")) return null;
	const orders = slots.map((item) => item.order);
	const nextOrder = new Map(visibleIds.map((id, index) => [id, orders[index]]));
	return items.map((item) => {
		const order = nextOrder.get(item.id);
		return order === void 0 ? item : {
			...item,
			order
		};
	});
}
function normalizeFolders(raw) {
	const parsed = raw.flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const row = entry;
		if (typeof row.id !== "string" || !row.id || typeof row.name !== "string" || !row.name.trim()) return [];
		const parentId = typeof row.parentId === "string" && row.parentId && row.parentId !== row.id ? row.parentId : null;
		return [{
			id: row.id,
			name: row.name,
			order: typeof row.order === "number" ? row.order : 0,
			createdAt: typeof row.createdAt === "number" ? row.createdAt : 0,
			parentId,
			isParent: row.isParent === true,
			color: typeof row.color === "string" && row.color.trim() ? row.color : null
		}];
	});
	const ids = new Set(parsed.map((folder) => folder.id));
	const linked = parsed.map((folder) => ({
		...folder,
		parentId: folder.parentId && ids.has(folder.parentId) ? folder.parentId : null
	}));
	const byId = new Map(linked.map((folder) => [folder.id, folder]));
	return linked.map((folder) => {
		const seen = /* @__PURE__ */ new Set([folder.id]);
		let parent = folder.parentId;
		while (parent) {
			if (seen.has(parent) || !byId.has(parent)) return {
				...folder,
				parentId: null
			};
			seen.add(parent);
			parent = byId.get(parent)?.parentId ?? null;
		}
		return folder;
	});
}
function folderChildren(folders, parentId) {
	return folders.filter((folder) => (folder.parentId ?? null) === parentId).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}
function flattenFolders(folders) {
	const out = [];
	const walk = (parentId, depth) => {
		for (const folder of folderChildren(folders, parentId)) {
			out.push({
				folder,
				depth
			});
			walk(folder.id, depth + 1);
		}
	};
	walk(null, 0);
	return out;
}
function folderAncestors(folders, id) {
	const out = [];
	const byId = new Map(folders.map((folder) => [folder.id, folder]));
	const seen = /* @__PURE__ */ new Set([id]);
	let parentId = byId.get(id)?.parentId ?? null;
	while (parentId && !seen.has(parentId)) {
		const parent = byId.get(parentId);
		if (!parent) break;
		out.unshift(parent);
		seen.add(parent.id);
		parentId = parent.parentId;
	}
	return out;
}
/** Top and bottom 30% reorder beside the row. The middle nests into it. */
function folderDropBand(ratio) {
	if (ratio < .3) return "before";
	if (ratio > .7) return "after";
	return "into";
}
function folderWouldCycle(folders, sourceId, parentId) {
	if (!parentId) return false;
	if (parentId === sourceId) return true;
	const byId = new Map(folders.map((folder) => [folder.id, folder]));
	const seen = /* @__PURE__ */ new Set([sourceId]);
	let current = parentId;
	while (current) {
		if (seen.has(current)) return true;
		seen.add(current);
		current = byId.get(current)?.parentId ?? null;
	}
	return false;
}
function descendantFolderIds(folders, rootId) {
	const out = [];
	const walk = (id) => {
		for (const child of folderChildren(folders, id)) {
			out.push(child.id);
			walk(child.id);
		}
	};
	walk(rootId);
	return out;
}
function storedImageCount(items, folderIds) {
	const ids = new Set(folderIds);
	const seen = /* @__PURE__ */ new Set();
	let count = 0;
	for (const item of items) {
		if (!ids.has(item.folderId) || seen.has(item.id)) continue;
		seen.add(item.id);
		count += 1;
	}
	return count;
}
function folderPath(folders, id) {
	const self = folders.find((folder) => folder.id === id);
	if (!self) return "";
	return [...folderAncestors(folders, id), self].map((folder) => folder.name).join(" / ");
}
function imageFolderChoices(folders, parentId) {
	return descendantFolderIds(folders, parentId).flatMap((id) => {
		const folder = folders.find((entry) => entry.id === id);
		return folder && !folder.isParent ? [folder] : [];
	});
}
var PARENT_COLORS = [
	"#e07a5f",
	"#81b29a",
	"#7eb6d6",
	"#e6c35c",
	"#c38d9e",
	"#b8a1e3",
	"#6fbfc9",
	"#d4b483",
	"#f2a7c3",
	"#a3c47a",
	"#e0986a",
	"#8aa4e0"
];
function pickParentColor(used) {
	const taken = new Set(used.map((color) => color.toLowerCase()));
	const free = PARENT_COLORS.find((color) => !taken.has(color.toLowerCase()));
	if (free) return free;
	for (let step = 0; step < 360; step += 1) {
		const color = `hsl(${(used.length * 47 + step) % 360} 58% 58%)`;
		if (!taken.has(color.toLowerCase())) return color;
	}
	return PARENT_COLORS[used.length % PARENT_COLORS.length] ?? PARENT_COLORS[0];
}
/** Marks empty folders that already contain children as parents, without moving images. */
function settleParentFolders(folders, items) {
	const direct = /* @__PURE__ */ new Map();
	for (const item of items) direct.set(item.folderId, (direct.get(item.folderId) ?? 0) + 1);
	const used = folders.flatMap((folder) => folder.color ? [folder.color] : []);
	return folders.map((folder) => {
		const children = folders.some((entry) => entry.parentId === folder.id);
		const count = direct.get(folder.id) ?? 0;
		if (!(folder.isParent || children && count === 0)) {
			if (!folder.isParent && !folder.color) return folder;
			return {
				...folder,
				isParent: false,
				color: null
			};
		}
		if (folder.isParent && folder.color) return folder;
		const color = folder.color ?? pickParentColor(used);
		if (!folder.color) used.push(color);
		return {
			...folder,
			isParent: true,
			color
		};
	});
}
function scrollTopForCenter(scrollTop, scrollerTop, scrollerHeight, cardTop, cardHeight, sticky = 0) {
	const room = Math.max(0, scrollerHeight - sticky);
	const delta = cardTop - scrollerTop - sticky - (room - cardHeight) / 2;
	return Math.max(0, scrollTop + delta);
}
function exportFileName(name, mime) {
	const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : mime === "video/mp4" ? "mp4" : mime === "video/webm" ? "webm" : "png";
	return `${(name.trim() || "image").replace(/\.(jpe?g|png|webp|gif|mp4|webm)$/i, "")}.${ext}`;
}
function hasAscii(bytes, needle) {
	const first = needle.charCodeAt(0);
	outer: for (let index = 0; index <= bytes.length - needle.length; index += 1) {
		if (bytes[index] !== first) continue;
		for (let offset = 1; offset < needle.length; offset += 1) if (bytes[index + offset] !== needle.charCodeAt(offset)) continue outer;
		return true;
	}
	return false;
}
/** True when the file has more than one frame. Static GIF, PNG, and WebP stay false. */
function isAnimatedImage(bytes, mime) {
	if (mime === "video/mp4" || mime === "video/webm") return true;
	if (mime === "image/gif") {
		let controls = 0;
		for (let index = 0; index < bytes.length - 1; index += 1) if (bytes[index] === 33 && bytes[index + 1] === 249) {
			controls += 1;
			if (controls > 1) return true;
		}
		return false;
	}
	if (mime === "image/png") return hasAscii(bytes, "acTL");
	if (mime === "image/webp") return hasAscii(bytes, "ANIM");
	return false;
}
function clampColumns(value) {
	if (!Number.isFinite(value)) return 4;
	return Math.min(6, Math.max(2, Math.round(value)));
}
function normalizeFolderView(raw) {
	const row = raw && typeof raw === "object" ? raw : {};
	return {
		columns: clampColumns(typeof row.columns === "number" ? row.columns : DEFAULT_FOLDER_VIEW.columns),
		direction: row.direction === "asc" ? "asc" : "desc"
	};
}
/** How many shared columns fit. Preferred count is the saved unified height. */
function fitColumns(preferred, contentPx, minTrack = 148, gap = 12) {
	const pref = clampColumns(preferred);
	if (contentPx <= 0) return pref;
	const fit = Math.max(1, Math.floor((contentPx + gap) / (minTrack + gap)));
	return Math.max(1, Math.min(pref, fit));
}
/** Image ids whose boxes meet a drag rectangle. Touching an edge counts. */
function boxesInRect(boxes, rect) {
	const left = Math.min(rect.x, rect.x + rect.w);
	const right = Math.max(rect.x, rect.x + rect.w);
	const top = Math.min(rect.y, rect.y + rect.h);
	const bottom = Math.max(rect.y, rect.y + rect.h);
	return boxes.filter((box) => box.x < right && box.x + box.w > left && box.y < bottom && box.y + box.h > top).map((box) => box.id);
}
/** Preferred row height. A square at scale 1 is about one column wide. */
function baselineHeight(contentWidth, columns, gap = 8) {
	const cols = Math.max(1, Math.round(columns));
	if (contentWidth <= 0) return 0;
	return Math.max(1, (contentWidth - gap * (cols - 1)) / cols);
}
function rowGroups(spots) {
	const sorted = [...spots].sort((a, b) => a.y - b.y || a.x - b.x);
	const rows = [];
	for (const spot of sorted) {
		const last = rows[rows.length - 1];
		if (!last || Math.abs(last[0].y - spot.y) > .5) rows.push([spot]);
		else last.push(spot);
	}
	return rows;
}
function rowIndexAt(rows, y) {
	let best = 0;
	let bestDist = Number.POSITIVE_INFINITY;
	for (let index = 0; index < rows.length; index += 1) {
		const row = rows[index];
		const top = Math.min(...row.map((box) => box.y));
		const bottom = Math.max(...row.map((box) => box.y + box.h));
		const dist = y < top ? top - y : y > bottom ? y - bottom : 0;
		if (dist < bestDist) {
			bestDist = dist;
			best = index;
		}
	}
	return best;
}
/** Where a vertical tag row would land. `rows` already excludes the tag being dragged. */
function tagInsertIndex(rows, clientY) {
	if (rows.length === 0) return {
		index: 0,
		marks: []
	};
	let index = rows.length;
	for (let at = 0; at < rows.length; at += 1) {
		const row = rows[at];
		if (clientY <= (row.top + row.bottom) / 2) {
			index = at;
			break;
		}
	}
	return {
		index,
		marks: insertMarks(rows, index)
	};
}
/** Yellow edges for one insertion slot. The dragged images are not in `rest`. */
function insertMarks(rest, index) {
	if (rest.length === 0) return [];
	const at = Math.max(0, Math.min(index, rest.length));
	if (at <= 0) return [{
		id: rest[0].id,
		edge: "before"
	}];
	if (at >= rest.length) return [{
		id: rest[rest.length - 1].id,
		edge: "after"
	}];
	return [{
		id: rest[at - 1].id,
		edge: "after"
	}, {
		id: rest[at].id,
		edge: "before"
	}];
}
/**
* Where a drag would land in visual reading order, after the moving images are taken out.
* Index 0 is before the first remaining image. Index `rest.length` is after the last.
* `point` uses the same coordinates as the boxes.
*/
function insertionAt(placements, movingIds, point) {
	const moving = new Set(movingIds);
	const rest = rowGroups([...placements]).flat().filter((box) => !moving.has(box.id));
	if (rest.length === 0) return null;
	const rows = rowGroups(rest);
	const rowAt = rowIndexAt(rows, point.y);
	const row = rows[rowAt];
	let local = 0;
	for (let index = 0; index < row.length; index += 1) {
		const card = row[index];
		if (point.x >= card.x + card.w / 2) local = index + 1;
	}
	const index = rows.slice(0, rowAt).reduce((sum, entry) => sum + entry.length, 0) + local;
	return {
		index,
		marks: insertMarks(rest, index)
	};
}
/** Visual insertion, written back as stored oldest-first order.
* Descending shows that sequence reversed, so the saved list is reversed once.
*/
function orderFromInsertion(placements, movingIds, sourceId, index, descending) {
	const moving = new Set(movingIds);
	if (!moving.has(sourceId)) return null;
	const visual = rowGroups([...placements]).flat().map((box) => box.id);
	if (!visual.includes(sourceId)) return null;
	const block = visual.filter((id) => moving.has(id));
	const rest = visual.filter((id) => !moving.has(id));
	if (rest.length === 0 || block.length === 0) return null;
	const at = Math.max(0, Math.min(index, rest.length));
	const next = [
		...rest.slice(0, at),
		...block,
		...rest.slice(at)
	];
	if (next.join("|") === visual.join("|")) return null;
	return descending ? next.slice().reverse() : next;
}
function imageAspect(item) {
	if (item.width > 0 && item.height > 0) return item.width / item.height;
	return 1;
}
/** Height that makes this row, including gaps, exactly as wide as the container. */
function justifiedHeight(row, contentWidth, gap) {
	const sum = row.reduce((total, item) => total + imageAspect(item), 0);
	const gaps = gap * Math.max(0, row.length - 1);
	if (sum <= 0 || contentWidth <= gaps) return 0;
	return (contentWidth - gaps) / sum;
}
/**
* Justified rows. Order is kept. Each full row is scaled so its images and
* gaps land exactly on the container width, without cropping.
* `lastRow: "match"` keeps the incomplete row at the previous row's height
* and only shrinks it when it would overflow. The default still caps growth
* with LAST_ROW_MAX so PDF pages keep their current packing.
*/
function layoutFlow(items, options) {
	const gap = options.gap ?? 8;
	const contentWidth = options.contentWidth;
	if (contentWidth <= 0 || items.length === 0) return {
		width: Math.max(0, contentWidth),
		height: 0,
		placements: []
	};
	const target = baselineHeight(contentWidth, options.columns, gap);
	const rows = [];
	let row = [];
	const close = () => {
		if (row.length === 0) return;
		rows.push(row);
		row = [];
	};
	for (const item of items) {
		if (row.length > 0 && normalizeScale(item.scale) !== normalizeScale(row[0].scale)) close();
		const trial = [...row, item];
		const want = target * normalizeScale(item.scale);
		const trialHeight = justifiedHeight(trial, contentWidth, gap);
		if (row.length > 0 && trialHeight < want) {
			const currentHeight = justifiedHeight(row, contentWidth, gap);
			if (Math.abs(trialHeight - want) < Math.abs(currentHeight - want)) {
				row = trial;
				close();
			} else {
				close();
				row = [item];
			}
		} else row = trial;
	}
	const lines = row.length > 0 ? [...rows, row] : rows;
	const placements = [];
	let y = 0;
	let previousHeight = 0;
	let previousScale = 1;
	lines.forEach((line, index) => {
		const last = index === lines.length - 1;
		const fill = justifiedHeight(line, contentWidth, gap);
		const scale = normalizeScale(line[0].scale);
		const want = target * scale;
		let height = fill;
		if (last && options.lastRow === "match") {
			const basis = index === 0 ? want : previousHeight * (scale / previousScale);
			height = basis * line.reduce((total, item) => total + imageAspect(item), 0) + gap * Math.max(0, line.length - 1) > contentWidth + .01 ? fill : basis;
		} else if (last) height = Math.min(fill, want * 2);
		let x = 0;
		for (const item of line) {
			const w = height * imageAspect(item);
			placements.push({
				id: item.id,
				x,
				y,
				w,
				h: height
			});
			x += w + gap;
		}
		y += height + gap;
		previousHeight = height;
		previousScale = scale;
	});
	return {
		width: contentWidth,
		height: placements.length === 0 ? 0 : y - gap,
		placements
	};
}
var A4_MM = {
	portrait: {
		width: 210,
		height: 297
	},
	landscape: {
		width: 297,
		height: 210
	}
};
var PAGE_MARGIN_MM = 12;
var PAGE_GAP_MM = 2;
/**
* Same height-based rows as the screen, then whole rows move to the next page.
*/
function layoutPortfolio(items, options) {
	const page = A4_MM[options.orientation];
	const contentW = page.width - 24;
	const contentH = page.height - 24;
	const flow = layoutFlow(items, {
		contentWidth: contentW,
		columns: options.columns,
		gap: PAGE_GAP_MM
	});
	const rows = [];
	for (const place of flow.placements) {
		const last = rows[rows.length - 1];
		if (!last || Math.abs((last[0]?.y ?? 0) - place.y) > .01) rows.push([place]);
		else last.push(place);
	}
	const placements = [];
	let pageIndex = 0;
	let y = 0;
	for (const row of rows) {
		const rowH = Math.max(...row.map((cell) => cell.h));
		let scale = 1;
		let usedH = rowH;
		if (usedH > contentH) {
			scale = contentH / usedH;
			usedH = contentH;
		}
		if (y > 0 && y + usedH > contentH + .01) {
			pageIndex += 1;
			y = 0;
		}
		for (const cell of row) placements.push({
			id: cell.id,
			page: pageIndex,
			x: PAGE_MARGIN_MM + cell.x * scale,
			y: PAGE_MARGIN_MM + y,
			w: cell.w * scale,
			h: cell.h * scale
		});
		y += usedH + PAGE_GAP_MM * scale;
	}
	return {
		pageCount: rows.length === 0 ? 0 : pageIndex + 1,
		pageWidth: page.width,
		pageHeight: page.height,
		placements
	};
}
var FIT_MARGIN_MIN = 4;
var FIT_MARGIN_MAX = 24;
var FIT_GAP_MIN = 0;
var FIT_GAP_MAX = 8;
function clampPdfMargin(value) {
	if (!Number.isFinite(value)) return 10;
	return Math.min(FIT_MARGIN_MAX, Math.max(FIT_MARGIN_MIN, Math.round(value)));
}
function clampPdfGap(value) {
	if (!Number.isFinite(value)) return 2;
	return Math.min(FIT_GAP_MAX, Math.max(FIT_GAP_MIN, Math.round(value)));
}
/** Normal keeps the screen layout. Fit keeps those same rows and only eases page-break gaps. */
function layoutForPdf(items, options) {
	if (options.mode === "fit") return layoutFit(items, {
		orientation: options.orientation,
		columns: options.columns,
		marginMm: clampPdfMargin(options.marginMm ?? 10),
		gapMm: clampPdfGap(options.gapMm ?? 2)
	});
	return layoutPortfolio(items, {
		orientation: options.orientation,
		columns: options.columns
	});
}
/**
* Drops images that are not kept, then closes the holes.
* Surviving images stay in their original rows and keep their size.
* Empty rows disappear. Rows are not rebuilt the way fit mode does.
*/
function omitPlacements(layout, keepIds, margin = PAGE_MARGIN_MM, gap = PAGE_GAP_MM) {
	const keep = new Set(keepIds);
	const ordered = [...layout.placements].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
	const rows = [];
	for (const cell of ordered) {
		if (!keep.has(cell.id)) continue;
		const row = rows[rows.length - 1];
		if (row && row[0].page === cell.page && Math.abs(row[0].y - cell.y) < .05 && row) row.push(cell);
		else rows.push([cell]);
	}
	const contentH = layout.pageHeight - margin * 2;
	const placements = [];
	let pageIndex = 0;
	let y = 0;
	for (const row of rows) {
		const cells = [...row].sort((a, b) => a.x - b.x);
		let usedH = Math.max(...cells.map((cell) => cell.h));
		let scale = 1;
		if (usedH > contentH && contentH > 0) {
			scale = contentH / usedH;
			usedH = contentH;
		}
		if (y > 0 && y + usedH > contentH + .01) {
			pageIndex += 1;
			y = 0;
		}
		let x = margin;
		for (const cell of cells) {
			placements.push({
				id: cell.id,
				page: pageIndex,
				x,
				y: margin + y,
				w: cell.w * scale,
				h: cell.h * scale
			});
			x += cell.w * scale + gap * scale;
		}
		y += usedH + gap * scale;
	}
	return {
		pageCount: placements.length === 0 ? 0 : pageIndex + 1,
		pageWidth: layout.pageWidth,
		pageHeight: layout.pageHeight,
		placements
	};
}
function layoutPdfSelection(items, options) {
	const picked = options.favoritesOnly ? items.filter((item) => item.favorite) : items;
	if (options.mode === "fit") return layoutForPdf(picked, options);
	const full = layoutForPdf(items, {
		...options,
		mode: "normal"
	});
	if (!options.favoritesOnly) return full;
	return omitPlacements(full, picked.map((item) => item.id));
}
function maxFitRowGap(baseGap, contentH) {
	return Math.min(18, Math.max(baseGap, contentH * .07));
}
function rowsUsed(rows, gap) {
	if (rows.length === 0) return 0;
	return rows.reduce((total, row) => total + row.height, 0) + gap * (rows.length - 1);
}
function scaleFitRow(row, scale) {
	if (scale >= .999) return row;
	return {
		...row,
		height: row.height * scale,
		widths: row.widths.map((width) => width * scale)
	};
}
/**
* Large tails may take the next original row if it still fits close to its size.
* Small tails keep every row and only open the space between them. Nothing is enlarged,
* and rows are never rebuilt or taken out of order.
*/
function settleFitWhitespace(source, contentH, gap) {
	const pages = source.map((page) => page.slice());
	if (contentH <= 1) return {
		pages,
		rowGaps: pages.map(() => gap)
	};
	for (let index = 0; index < pages.length; index += 1) {
		const page = pages[index];
		const left = contentH - rowsUsed(page, gap);
		if (left < contentH * .3 - .01) continue;
		const donor = pages[index + 1];
		const row = donor?.[0];
		const available = page.length === 0 ? contentH : left - gap;
		if (!donor || !row || available < 8) continue;
		const scale = Math.min(1, available / row.height);
		if (scale < .85) continue;
		const placed = scaleFitRow(row, scale);
		donor.shift();
		page.push(placed);
		if (rowsUsed(page, gap) > contentH + .05) {
			page.pop();
			donor.unshift(row);
		}
	}
	const kept = [];
	const rowGaps = [];
	for (const page of pages) {
		if (page.length === 0) continue;
		const left = contentH - rowsUsed(page, gap);
		const ratio = left / contentH;
		let rowGap = gap;
		if (ratio < .3 && page.length > 1 && left > .5) {
			const slots = page.length - 1;
			const room = Math.max(0, maxFitRowGap(gap, contentH) - gap);
			rowGap = gap + Math.min(room, left / slots);
		}
		kept.push(page);
		rowGaps.push(rowGap);
	}
	return {
		pages: kept,
		rowGaps
	};
}
function paginateFitRows(rows, contentH, gap) {
	const pages = [];
	let page = [];
	for (const source of rows) {
		const row = source.height > contentH ? scaleFitRow(source, contentH / source.height) : source;
		if (page.length > 0 && rowsUsed([...page, row], gap) > contentH + .05) {
			pages.push(page);
			page = [row];
		} else page.push(row);
	}
	if (page.length > 0) pages.push(page);
	return pages;
}
/**
* Same rows as the portfolio. Page breaks may pull the next row forward or
* open the gaps. The input array and its items are left untouched.
*/
function layoutFit(items, options) {
	const page = A4_MM[options.orientation];
	const margin = options.marginMm;
	const gap = options.gapMm;
	const contentW = page.width - margin * 2;
	const contentH = page.height - margin * 2;
	const placements = [];
	if (contentW <= 8 || contentH <= 8 || items.length === 0) return {
		pageCount: 0,
		pageWidth: page.width,
		pageHeight: page.height,
		placements
	};
	const settled = settleFitWhitespace(paginateFitRows(rowGroups(layoutFlow(items, {
		contentWidth: contentW,
		columns: options.columns,
		gap
	}).placements).map((row) => ({
		ids: row.map((cell) => cell.id),
		height: Math.max(...row.map((cell) => cell.h)),
		widths: row.map((cell) => cell.w),
		aspects: row.map((cell) => cell.w / Math.max(cell.h, .001))
	})), contentH, gap), contentH, gap);
	let pageIndex = 0;
	for (let index = 0; index < settled.pages.length; index += 1) {
		const pageRows = settled.pages[index] ?? [];
		const rowGap = settled.rowGaps[index] ?? gap;
		let y = 0;
		for (const row of pageRows) {
			let x = margin;
			for (let cell = 0; cell < row.ids.length; cell += 1) {
				placements.push({
					id: row.ids[cell],
					page: pageIndex,
					x,
					y: margin + y,
					w: row.widths[cell] ?? 0,
					h: row.height
				});
				x += (row.widths[cell] ?? 0) + gap;
			}
			y += row.height + rowGap;
		}
		pageIndex += 1;
	}
	return {
		pageCount: placements.length === 0 ? 0 : pageIndex,
		pageWidth: page.width,
		pageHeight: page.height,
		placements
	};
}
/** Where a pasted folder lands. A parent receives it; a normal folder uses its own parent. */
function pasteParentId(folders, selectedId) {
	if (selectedId === "all") return null;
	const current = folders.find((folder) => folder.id === selectedId);
	if (!current) return null;
	if (current.isParent) return current.id;
	return current.parentId ?? null;
}
/** Smallest unused 「名前（n）」 when `name` is already taken under the same parent. */
function nextCopyName(name, taken) {
	const used = new Set(taken);
	if (!used.has(name)) return name;
	const base = name.replace(/（\d+）$/, "");
	for (let n = 1; n < 1e3; n += 1) {
		const suffix = `（${n}）`;
		const room = Math.max(1, 40 - suffix.length);
		const candidate = `${base.slice(0, room)}${suffix}`;
		if (!used.has(candidate)) return candidate;
	}
	return name;
}
/**
* New ids for the copied tree. Tag ids are reused only when the destination
* already has that same tag. Otherwise the tag, and its folder, are copied by name.
*/
function planFolderCopy(input) {
	const root = input.sourceFolders.find((folder) => folder.id === input.rootId);
	if (!root) return null;
	const nextId = input.nextId ?? (() => crypto.randomUUID());
	const now = input.now ?? Date.now();
	const takenIds = /* @__PURE__ */ new Set([
		...input.sourceFolders.map((folder) => folder.id),
		...input.sourceItems.map((item) => item.id),
		...input.sourceTags.map((tag) => tag.id),
		...input.sourceTagFolders.map((folder) => folder.id),
		...input.destFolders.map((folder) => folder.id),
		...input.destTags.map((tag) => tag.id),
		...input.destTagFolders.map((folder) => folder.id)
	]);
	const allocate = () => {
		for (let attempt = 0; attempt < 20; attempt += 1) {
			const id = nextId();
			if (!takenIds.has(id)) {
				takenIds.add(id);
				return id;
			}
		}
		const id = `${nextId()}-${takenIds.size}`;
		takenIds.add(id);
		return id;
	};
	const folderIdMap = /* @__PURE__ */ new Map();
	const made = [];
	const queue = [root];
	while (queue.length > 0) {
		const folder = queue.shift();
		const id = allocate();
		folderIdMap.set(folder.id, id);
		const parentId = folder.id === root.id ? input.destParentId : folderIdMap.get(folder.parentId ?? "") ?? input.destParentId;
		const siblingNames = [...input.destFolders.filter((entry) => (entry.parentId ?? null) === parentId).map((entry) => entry.name), ...made.filter((entry) => (entry.parentId ?? null) === parentId).map((entry) => entry.name)];
		const peers = input.destFolders.filter((entry) => (entry.parentId ?? null) === parentId);
		const order = folder.id === root.id ? parentId === null ? peers.length === 0 ? 0 : Math.min(...peers.map((entry) => entry.order)) - 1 : peers.length : folder.order;
		made.push({
			...folder,
			id,
			name: nextCopyName(folder.name, siblingNames),
			parentId,
			order,
			createdAt: folder.createdAt
		});
		for (const child of folderChildren(input.sourceFolders, folder.id)) queue.push(child);
	}
	const copiedItems = input.sourceItems.filter((item) => folderIdMap.has(item.folderId));
	const tagIdMap = /* @__PURE__ */ new Map();
	const tags = [];
	const tagFolders = [];
	const folderNameToNew = /* @__PURE__ */ new Map();
	const plannedTagNames = /* @__PURE__ */ new Map();
	const usedTagIds = new Set(copiedItems.flatMap((item) => item.tagIds));
	for (const sourceId of usedTagIds) {
		const source = input.sourceTags.find((tag) => tag.id === sourceId);
		if (!source) continue;
		const named = input.destTags.find((tag) => tag.id === source.id && tag.name === source.name) ?? input.destTags.find((tag) => tag.name === source.name);
		if (named) {
			tagIdMap.set(source.id, named.id);
			continue;
		}
		const plannedName = plannedTagNames.get(source.name);
		if (plannedName) {
			tagIdMap.set(source.id, plannedName);
			continue;
		}
		let folderId = null;
		if (source.folderId) {
			const sourceFolder = input.sourceTagFolders.find((folder) => folder.id === source.folderId);
			const folderName = sourceFolder?.name ?? "";
			if (folderName) {
				const existing = input.destTagFolders.find((folder) => folder.name === folderName);
				const planned = folderNameToNew.get(folderName);
				if (existing) folderId = existing.id;
				else if (planned) folderId = planned;
				else {
					folderId = allocate();
					folderNameToNew.set(folderName, folderId);
					const orders = [...input.destTagFolders, ...tagFolders].map((folder) => folder.order);
					tagFolders.push({
						id: folderId,
						name: folderName,
						order: orders.length === 0 ? 0 : Math.max(...orders) + 1,
						createdAt: sourceFolder?.createdAt ?? now,
						open: sourceFolder?.open ?? true
					});
				}
			}
		}
		const id = allocate();
		tagIdMap.set(source.id, id);
		plannedTagNames.set(source.name, id);
		tags.push({
			...source,
			id,
			folderId,
			createdAt: source.createdAt
		});
	}
	const sourceByNew = new Map([...folderIdMap].map(([from, to]) => [to, from]));
	const images = [];
	for (const item of copiedItems) {
		const folderId = folderIdMap.get(item.folderId);
		if (!folderId) continue;
		images.push({
			sourceId: item.id,
			meta: {
				...item,
				id: allocate(),
				folderId,
				tagIds: [...new Set(item.tagIds.flatMap((id) => {
					const next = tagIdMap.get(id);
					return next ? [next] : [];
				}))]
			}
		});
	}
	return {
		rootId: folderIdMap.get(root.id) ?? made[0].id,
		folders: made,
		views: made.map((folder) => {
			const view = input.sourceViews[sourceByNew.get(folder.id) ?? ""] ?? DEFAULT_FOLDER_VIEW;
			return {
				id: folder.id,
				view: {
					columns: view.columns,
					direction: view.direction
				}
			};
		}),
		tags,
		tagFolders,
		images
	};
}
var BACKUP_MAGIC = "KMCHOBK1";
var MAX_MANIFEST_BYTES = 33554432;
var BackupError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "BackupError";
	}
};
function isBackupFileName(name) {
	return name.trim().toLowerCase().endsWith(".kmb");
}
/** A new library: one empty folder and no media. Other tabs and swap slots are not part of this record. */
function emptyLibraryBackup(folder) {
	const createdAt = new Date(folder.createdAt).toISOString();
	const view = { ...DEFAULT_FOLDER_VIEW };
	return {
		summary: {
			images: 0,
			videos: 0,
			folders: 1,
			tags: 0,
			tagFolders: 0,
			favorites: 0,
			bytes: 0,
			createdAt
		},
		images: [],
		manifest: {
			format: "komacho-backup",
			version: 1,
			createdAt,
			images: [],
			folders: [folder],
			folderViews: [{
				id: folder.id,
				...view
			}, {
				id: "all",
				...view
			}],
			tags: [],
			tagFolders: [],
			settings: [{
				key: "folder",
				value: "all"
			}]
		}
	};
}
var RestoreFailure = class extends Error {
	stage;
	fileBytes;
	saved;
	total;
	elapsedMs;
	reasonName;
	detail;
	constructor(stage, fileBytes, saved, total, elapsedMs, cause, detail = "") {
		super(detail || (cause instanceof Error ? cause.message : "復元に失敗しました。"));
		this.name = "RestoreFailure";
		this.stage = stage;
		this.fileBytes = fileBytes;
		this.saved = saved;
		this.total = total;
		this.elapsedMs = elapsedMs;
		this.reasonName = cause instanceof Error ? cause.name : "Error";
		this.detail = detail || (cause instanceof Error ? cause.message : "");
	}
};
function byteLength(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : -1;
}
function uniqueIds(ids, label) {
	if (new Set(ids).size !== ids.length) throw new BackupError(`${label}のIDが重複しています。`);
}
function validateManifest(raw) {
	if (!raw || typeof raw !== "object") throw new BackupError("バックアップの内容を読めませんでした。");
	const row = raw;
	if (row.format !== "komacho-backup") throw new BackupError("バックアップファイルではありません。");
	if (row.version !== 1) throw new BackupError("このバックアップ形式には対応していません。");
	if (typeof row.createdAt !== "string" || !row.createdAt) throw new BackupError("作成日時がありません。");
	if (!Array.isArray(row.images) || !Array.isArray(row.folders) || !Array.isArray(row.folderViews)) throw new BackupError("必要なデータが足りません。");
	if (!Array.isArray(row.tags) || !Array.isArray(row.tagFolders) || !Array.isArray(row.settings)) throw new BackupError("必要なデータが足りません。");
	const images = row.images.map((entry) => {
		if (!entry || typeof entry !== "object") throw new BackupError("画像の情報が不正です。");
		const image = entry;
		const meta = normalizeMeta(image.meta);
		if (!meta) throw new BackupError("画像の情報が不正です。");
		const originalBytes = byteLength(image.originalBytes);
		const thumbBytes = byteLength(image.thumbBytes);
		if (originalBytes < 1) throw new BackupError(`「${meta.name}」の画像データがありません。`);
		if (thumbBytes < 0) throw new BackupError(`「${meta.name}」のサムネイル情報が不正です。`);
		if (typeof image.originalType !== "string") throw new BackupError(`「${meta.name}」の形式が不正です。`);
		if (image.thumbType !== null && typeof image.thumbType !== "string") throw new BackupError(`「${meta.name}」のサムネイル形式が不正です。`);
		return {
			meta,
			originalBytes,
			originalType: image.originalType || meta.mime,
			thumbBytes,
			thumbType: thumbBytes > 0 ? image.thumbType || "image/jpeg" : null
		};
	});
	uniqueIds(images.map((image) => image.meta.id), "画像");
	const folders = normalizeFolders(row.folders);
	if (folders.length !== row.folders.length) throw new BackupError("フォルダ情報が不正です。");
	uniqueIds(folders.map((folder) => folder.id), "フォルダ");
	const tags = row.tags.map((entry) => {
		const tag = normalizeTag(entry);
		if (!tag) throw new BackupError("タグ情報が不正です。");
		return tag;
	});
	uniqueIds(tags.map((tag) => tag.id), "タグ");
	const tagFolders = row.tagFolders.map((entry) => {
		const folder = normalizeTagFolder(entry);
		if (!folder) throw new BackupError("タグフォルダの情報が不正です。");
		return folder;
	});
	uniqueIds(tagFolders.map((folder) => folder.id), "タグフォルダ");
	const folderViews = row.folderViews.map((entry) => {
		if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id) throw new BackupError("表示設定が不正です。");
		return {
			id: entry.id,
			...normalizeFolderView(entry)
		};
	});
	uniqueIds(folderViews.map((view) => view.id), "表示設定");
	const settings = row.settings.map((entry) => {
		if (!entry || typeof entry !== "object") throw new BackupError("設定が不正です。");
		const setting = entry;
		if (typeof setting.key !== "string" || !setting.key) throw new BackupError("設定が不正です。");
		if (typeof setting.value !== "string" && typeof setting.value !== "number") throw new BackupError("設定が不正です。");
		return {
			key: setting.key,
			value: setting.value
		};
	});
	uniqueIds(settings.map((setting) => setting.key), "設定");
	return {
		format: "komacho-backup",
		version: 1,
		createdAt: row.createdAt,
		images,
		folders,
		folderViews,
		tags,
		tagFolders,
		settings
	};
}
function packBackup(manifest, binaries) {
	const json = new TextEncoder().encode(JSON.stringify(manifest));
	if (json.byteLength > MAX_MANIFEST_BYTES) throw new BackupError("設定データが大きすぎます。");
	const header = /* @__PURE__ */ new Uint8Array(12);
	header.set(new TextEncoder().encode(BACKUP_MAGIC));
	new DataView(header.buffer).setUint32(8, json.byteLength, true);
	return new Blob([
		header,
		json,
		...binaries
	], { type: "application/octet-stream" });
}
function summarize(manifest, bytes) {
	return {
		images: manifest.images.length,
		videos: manifest.images.filter((image) => image.meta.mime.startsWith("video/")).length,
		folders: manifest.folders.length,
		tags: manifest.tags.length,
		tagFolders: manifest.tagFolders.length,
		favorites: manifest.images.filter((image) => image.meta.favorite).length,
		bytes,
		createdAt: manifest.createdAt
	};
}
function buildBackup(dump, createdAt = /* @__PURE__ */ new Date()) {
	const missing = dump.metas.filter((meta) => !(dump.blobs.get(meta.id)?.original instanceof Blob));
	if (missing.length > 0) throw new BackupError(`画像データが${missing.length}件足りないため、バックアップを作成できませんでした。保存データは変更していません。`);
	const images = [];
	const binaries = [];
	for (const meta of dump.metas) {
		const row = dump.blobs.get(meta.id);
		const thumb = row.thumb instanceof Blob && row.thumb.size > 0 ? row.thumb : null;
		images.push({
			meta,
			originalBytes: row.original.size,
			originalType: row.original.type || meta.mime,
			thumbBytes: thumb?.size ?? 0,
			thumbType: thumb ? thumb.type || "image/jpeg" : null
		});
		binaries.push(row.original);
		if (thumb) binaries.push(thumb);
	}
	const manifest = {
		format: "komacho-backup",
		version: 1,
		createdAt: createdAt.toISOString(),
		images,
		folders: dump.folders,
		folderViews: dump.views,
		tags: dump.tags,
		tagFolders: dump.tagFolders,
		settings: dump.settings
	};
	const file = packBackup(manifest, binaries);
	return {
		file,
		summary: summarize(manifest, file.size)
	};
}
function backupFileName(createdAt) {
	const pad = (value) => String(value).padStart(2, "0");
	return `komacho-backup-${createdAt.getFullYear()}${pad(createdAt.getMonth() + 1)}${pad(createdAt.getDate())}-${pad(createdAt.getHours())}${pad(createdAt.getMinutes())}.kmb`;
}
/** Groups image bodies so one IndexedDB transaction stays small enough for a phone. */
function batchImageIndexes(sizes, maxBytes = 4194304, maxCount = 12) {
	const batches = [];
	let current = [];
	let bytes = 0;
	for (let index = 0; index < sizes.length; index += 1) {
		const size = Math.max(0, sizes[index] ?? 0);
		const alone = size > maxBytes;
		if (current.length > 0 && (alone || current.length >= maxCount || bytes + size > maxBytes)) {
			batches.push(current);
			current = [];
			bytes = 0;
		}
		current.push(index);
		bytes += size;
		if (alone || current.length >= maxCount || bytes >= maxBytes) {
			batches.push(current);
			current = [];
			bytes = 0;
		}
	}
	if (current.length > 0) batches.push(current);
	return batches;
}
async function readBackup(file, onProgress) {
	if (file.size < 12) throw new BackupError("バックアップファイルではありません。");
	onProgress?.({
		stage: "header",
		done: 0,
		total: file.size
	});
	const headBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
	if (new TextDecoder().decode(headBytes.subarray(0, 8)) !== "KMCHOBK1") throw new BackupError("バックアップファイルではありません。");
	const jsonLength = new DataView(headBytes.buffer).getUint32(8, true);
	if (jsonLength < 2 || jsonLength > MAX_MANIFEST_BYTES || 12 + jsonLength > file.size) throw new BackupError("ファイルが途中で切れています。");
	onProgress?.({
		stage: "manifest",
		done: 12,
		total: file.size
	});
	let raw;
	try {
		raw = JSON.parse(new TextDecoder().decode(await file.slice(12, 12 + jsonLength).arrayBuffer()));
	} catch {
		throw new BackupError("バックアップの内容を読めませんでした。");
	}
	const manifest = validateManifest(raw);
	let offset = 12 + jsonLength;
	const images = [];
	onProgress?.({
		stage: "verify",
		done: 0,
		total: manifest.images.length
	});
	await new Promise((resolve) => setTimeout(resolve, 0));
	for (let index = 0; index < manifest.images.length; index += 1) {
		const image = manifest.images[index];
		const originalEnd = offset + image.originalBytes;
		const thumbEnd = originalEnd + image.thumbBytes;
		if (thumbEnd > file.size) throw new BackupError("画像データが途中で切れています。");
		images.push({
			meta: image.meta,
			original: file.slice(offset, originalEnd, image.originalType || image.meta.mime),
			thumb: image.thumbBytes > 0 ? file.slice(originalEnd, thumbEnd, image.thumbType || "image/jpeg") : null
		});
		offset = thumbEnd;
		if (onProgress && index > 0 && index % 100 === 0) {
			onProgress({
				stage: "verify",
				done: index,
				total: manifest.images.length
			});
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}
	if (offset !== file.size) throw new BackupError("ファイルの長さが記録と一致しません。");
	onProgress?.({
		stage: "verify",
		done: manifest.images.length,
		total: manifest.images.length
	});
	return {
		manifest,
		images,
		summary: summarize(manifest, file.size)
	};
}
/**
* Pixel bytes live only in IndexedDB (`imageBlobs`).
* Names, order, and dimensions live in `imageMeta`.
* localStorage is intentionally unused — image bodies must not go there.
*/
var DB_VERSION = 5;
/** Tab 1 keeps the original names. Tabs 2 and 3 have their own swap pairs. */
var TAB_SLOTS = {
	1: ["komacho", "komacho-b"],
	2: ["komacho-2", "komacho-2b"],
	3: ["komacho-3", "komacho-3b"]
};
var LIVE_KEYS = {
	1: "komacho-library-db",
	2: "komacho-library-db-2",
	3: "komacho-library-db-3"
};
var RETIRE_KEYS = {
	1: "komacho-drop-db",
	2: "komacho-drop-db-2",
	3: "komacho-drop-db-3"
};
var SELECTED_TAB_KEY = "komacho-library-tab";
function normalizeLibraryTab(value) {
	if (value === 2 || value === "2") return 2;
	if (value === 3 || value === "3") return 3;
	return 1;
}
function libraryDbSlots(tab = 1) {
	return TAB_SLOTS[normalizeLibraryTab(tab)];
}
function readStorage(key) {
	if (typeof localStorage === "undefined") return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
/** Which database is live, and which empty slot a restore may replace, for one tab. */
function librarySlotPlan(tab = 1) {
	const target = normalizeLibraryTab(tab);
	const slots = TAB_SLOTS[target];
	const saved = readStorage(LIVE_KEYS[target]);
	const live = saved === slots[0] || saved === slots[1] ? saved : slots[0];
	return {
		tab: target,
		live,
		swap: live === slots[0] ? slots[1] : slots[0],
		liveKey: LIVE_KEYS[target],
		retireKey: RETIRE_KEYS[target],
		slots
	};
}
var phoneSurface = false;
var heldLibraryName = null;
var writesOpen = true;
var userWrites = true;
var connectionEpoch = 0;
var writeDepth = 0;
var writeWaiters = [];
/** Phone layout reads tab 1. It does not change the saved PC tab. */
function setLibraryPhoneSurface(phone) {
	phoneSurface = phone;
}
/** The tab whose database should be open. Phone always uses tab 1. */
function activeLibraryTab() {
	return phoneSurface ? 1 : selectedLibraryTab();
}
function rememberLibraryTab(tab) {
	const next = normalizeLibraryTab(tab);
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(SELECTED_TAB_KEY, String(next));
	} catch {}
}
/**
* Database opened for ordinary reads and writes.
* A switch can hold the previous name until its writes have finished.
* Restore still chooses its own pair through `librarySlotPlan`.
*/
function libraryDbName() {
	return heldLibraryName ?? librarySlotPlan(activeLibraryTab()).live;
}
function holdLibraryName(name) {
	heldLibraryName = name;
}
function suspendLibraryWrites() {
	writesOpen = false;
}
function resumeLibraryWrites() {
	writesOpen = true;
}
/** User actions may write. A tab switch turns this off so a late save cannot land in the next library. */
function userWritesOpen() {
	return userWrites;
}
function setUserWritesOpen(open) {
	userWrites = open;
}
/**
* Waits until readwrite transactions, and the next save those transactions schedule, have finished.
* The held database name stays in place while this runs.
*/
async function drainLibraryWrites() {
	for (let turn = 0; turn < 1e4; turn += 1) {
		await writesSettled();
		if (writeDepth !== 0) continue;
		await Promise.resolve();
		if (writeDepth === 0) return;
	}
}
function libraryConnectionEpoch() {
	return connectionEpoch;
}
/** Saved PC tab. Unset or invalid values are tab 1. Phone layout does not read this. */
function selectedLibraryTab() {
	return normalizeLibraryTab(readStorage(SELECTED_TAB_KEY));
}
/**
* A name recorded for later deletion. Only the inactive slot of this same tab qualifies.
* Another tab's database, or the live database, is never returned.
*/
function retiredDbToDelete(tab, stored, live) {
	if (!stored) return null;
	const slots = libraryDbSlots(tab);
	if (stored !== slots[0] && stored !== slots[1]) return null;
	if (stored === live) return null;
	return stored;
}
var dbPromise = null;
var boundName = null;
var openedFresh = /* @__PURE__ */ new WeakMap();
function trackWrite(tx) {
	if (typeof tx.addEventListener !== "function") return;
	writeDepth += 1;
	let settled = false;
	const done = () => {
		if (settled) return;
		settled = true;
		writeDepth -= 1;
		if (writeDepth === 0) {
			const waiting = writeWaiters.splice(0);
			for (const resolve of waiting) resolve();
		}
	};
	tx.addEventListener("complete", done);
	tx.addEventListener("abort", done);
	tx.addEventListener("error", done);
}
function openWrite(db, stores) {
	const tx = db.transaction(stores, "readwrite");
	trackWrite(tx);
	return tx;
}
/** Resolves when readwrite transactions that already started have finished. */
function writesSettled() {
	if (writeDepth === 0) return Promise.resolve();
	return new Promise((resolve) => writeWaiters.push(resolve));
}
async function closeLibraryConnection() {
	connectionEpoch += 1;
	const pending = dbPromise;
	dbPromise = null;
	boundName = null;
	if (!pending) return;
	try {
		(await pending).close();
	} catch {}
}
function upgradeLibrary(db) {
	if (!db.objectStoreNames.contains("imageMeta")) db.createObjectStore("imageMeta", { keyPath: "id" }).createIndex("byOrder", "order");
	if (!db.objectStoreNames.contains("imageBlobs")) db.createObjectStore("imageBlobs", { keyPath: "id" });
	if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv", { keyPath: "key" });
	if (!db.objectStoreNames.contains("folders")) db.createObjectStore("folders", { keyPath: "id" });
	if (!db.objectStoreNames.contains("folderViews")) db.createObjectStore("folderViews", { keyPath: "id" });
	if (!db.objectStoreNames.contains("tags")) db.createObjectStore("tags", { keyPath: "id" });
	if (!db.objectStoreNames.contains("tagFolders")) db.createObjectStore("tagFolders", { keyPath: "id" });
}
function openNamed(name, track) {
	return new Promise((resolve, reject) => {
		let request;
		try {
			request = indexedDB.open(name, DB_VERSION);
		} catch (error) {
			reject(error);
			return;
		}
		let created = false;
		request.onupgradeneeded = (event) => {
			created = event.oldVersion === 0;
			upgradeLibrary(request.result);
		};
		request.onsuccess = () => {
			const db = request.result;
			openedFresh.set(db, created);
			db.onversionchange = () => {
				db.close();
				if (track) dbPromise = null;
			};
			resolve(db);
		};
		request.onerror = () => reject(request.error ?? /* @__PURE__ */ new Error("indexedDB open failed"));
		request.onblocked = () => reject(/* @__PURE__ */ new Error("indexedDB blocked"));
	});
}
function getDb() {
	if (!writesOpen) return Promise.reject(/* @__PURE__ */ new Error("library-changed"));
	if (typeof indexedDB === "undefined") return Promise.reject(/* @__PURE__ */ new Error("indexedDB unavailable"));
	const wanted = libraryDbName();
	const epoch = connectionEpoch;
	if (!dbPromise || boundName !== wanted) {
		if (dbPromise) {
			const stale = dbPromise;
			dbPromise = null;
			boundName = null;
			stale.then((db) => db.close()).catch(() => void 0);
		}
		boundName = wanted;
		dbPromise = openNamed(wanted, true).then((db) => {
			if (epoch !== connectionEpoch || libraryDbName() !== wanted) {
				db.close();
				throw new Error("library-changed");
			}
			return db;
		}).catch((error) => {
			if (boundName === wanted) {
				dbPromise = null;
				boundName = null;
			}
			throw error;
		});
	}
	return dbPromise.then((db) => {
		if (!writesOpen || epoch !== connectionEpoch || db.name !== wanted) throw new Error("library-changed");
		return db;
	});
}
function allocateOrders(count) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		if (count <= 0) {
			resolve(0);
			return;
		}
		const tx = openWrite(db, "kv");
		const store = tx.objectStore("kv");
		const getReq = store.get("orderSeq");
		let start = 1;
		getReq.onsuccess = () => {
			const row = getReq.result;
			const current = row && typeof row.value === "number" ? row.value : 0;
			start = current + 1;
			store.put({
				key: "orderSeq",
				value: current + count
			});
		};
		tx.oncomplete = () => resolve(start);
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("order allocate failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("order allocate aborted"));
	}));
}
function saveImage(meta, original, thumb) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, ["imageMeta", "imageBlobs"]);
		tx.objectStore("imageMeta").put(meta);
		const row = {
			id: meta.id,
			original,
			thumb
		};
		tx.objectStore("imageBlobs").put(row);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("save failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("save aborted"));
	}));
}
function deleteImage(id) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, ["imageMeta", "imageBlobs"]);
		tx.objectStore("imageMeta").delete(id);
		tx.objectStore("imageBlobs").delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("delete failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("delete aborted"));
	}));
}
function listMeta() {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const req = db.transaction("imageMeta", "readonly").objectStore("imageMeta").getAll();
		req.onsuccess = () => {
			resolve(sortByOrder((req.result ?? []).map((row) => normalizeMeta(row)).filter((row) => row !== null)));
		};
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("list failed"));
	}));
}
function putMeta(meta) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, "imageMeta");
		tx.objectStore("imageMeta").put(meta);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("meta save failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("meta save aborted"));
	}));
}
function writeMetaOrders(entries) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, "imageMeta");
		const store = tx.objectStore("imageMeta");
		for (const entry of entries) {
			const req = store.get(entry.id);
			req.onsuccess = () => {
				const meta = normalizeMeta(req.result);
				if (!meta) return;
				store.put({
					...meta,
					order: entry.order
				});
			};
		}
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("order save failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("order save aborted"));
	}));
}
function readKv(key, fallback) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const req = db.transaction("kv", "readonly").objectStore("kv").get(key);
		req.onsuccess = () => {
			const value = req.result?.value;
			resolve(typeof value === "number" ? value : fallback);
		};
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("setting read failed"));
	}));
}
function readKvString(key, fallback) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const req = db.transaction("kv", "readonly").objectStore("kv").get(key);
		req.onsuccess = () => {
			const value = req.result?.value;
			resolve(typeof value === "string" && value ? value : fallback);
		};
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("setting read failed"));
	}));
}
function listFolders() {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const req = db.transaction("folders", "readonly").objectStore("folders").getAll();
		req.onsuccess = () => {
			resolve(normalizeFolders(req.result ?? []));
		};
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("folder list failed"));
	}));
}
function putFolder(folder) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, "folders");
		tx.objectStore("folders").put(folder);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("folder save failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("folder save aborted"));
	}));
}
function deleteFolderRecord(id) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, "folders");
		tx.objectStore("folders").delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("folder delete failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("folder delete aborted"));
	}));
}
var INITIAL_FOLDER_NAME = "未分類";
/** Creates the first folder when needed and stamps older images without copying pixels. */
async function ensureLibrary(items) {
	let folders = await listFolders();
	if (folders.length === 0) {
		const folder = {
			id: crypto.randomUUID(),
			name: INITIAL_FOLDER_NAME,
			order: 0,
			createdAt: Date.now(),
			parentId: null,
			isParent: false,
			color: null
		};
		await putFolder(folder);
		folders = [folder];
	}
	const known = new Set(folders.map((folder) => folder.id));
	const fallback = folders[0].id;
	const next = items.map((item) => item.folderId && known.has(item.folderId) ? item : {
		...item,
		folderId: fallback
	});
	for (let index = 0; index < next.length; index += 1) if (next[index].folderId !== items[index].folderId) await putMeta(next[index]);
	return {
		folders,
		items: next
	};
}
function listFolderViews() {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const req = db.transaction("folderViews", "readonly").objectStore("folderViews").getAll();
		req.onsuccess = () => {
			const views = {};
			for (const row of req.result ?? []) {
				if (!row || typeof row.id !== "string" || !row.id) continue;
				views[row.id] = normalizeFolderView(row);
			}
			resolve(views);
		};
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("view list failed"));
	}));
}
function putFolderView(id, view) {
	const row = {
		id,
		...normalizeFolderView(view)
	};
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, "folderViews");
		tx.objectStore("folderViews").put(row);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("view save failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("view save aborted"));
	}));
}
function deleteFolderView(id) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, "folderViews");
		tx.objectStore("folderViews").delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("view delete failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("view delete aborted"));
	}));
}
function listTagFolders() {
	return getDb().then((db) => new Promise((resolve, reject) => {
		if (!db.objectStoreNames.contains("tagFolders")) {
			resolve([]);
			return;
		}
		const req = db.transaction("tagFolders", "readonly").objectStore("tagFolders").getAll();
		req.onsuccess = () => {
			resolve((req.result ?? []).map((row) => normalizeTagFolder(row)).filter((row) => row !== null).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt));
		};
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("tag folder list failed"));
	}));
}
function putTagFolder(folder) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, "tagFolders");
		tx.objectStore("tagFolders").put(folder);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("tag folder save failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("tag folder save aborted"));
	}));
}
/**
* Deletes one tag folder, the tags that belong to it, and those tags on images.
* One transaction: a failure leaves the previous records in place.
*/
function deleteTagFolderTree(input) {
	const stores = [
		"tagFolders",
		"tags",
		"imageMeta"
	];
	if (input.active || input.hidden) stores.push("kv");
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, stores);
		tx.objectStore("tagFolders").delete(input.folderId);
		for (const id of input.tagIds) tx.objectStore("tags").delete(id);
		for (const meta of input.metas) tx.objectStore("imageMeta").put(meta);
		if (input.active) tx.objectStore("kv").put({
			key: "tag",
			value: JSON.stringify(input.active)
		});
		if (input.hidden) tx.objectStore("kv").put({
			key: "tagHidden",
			value: JSON.stringify(input.hidden)
		});
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("tag folder delete failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("tag folder delete aborted"));
	}));
}
function listTags() {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const req = db.transaction("tags", "readonly").objectStore("tags").getAll();
		req.onsuccess = () => {
			resolve((req.result ?? []).map((row) => normalizeTag(row)).filter((row) => row !== null).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt));
		};
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("tag list failed"));
	}));
}
function putTag(tag) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, "tags");
		tx.objectStore("tags").put(tag);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("tag save failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("tag save aborted"));
	}));
}
function deleteTagRecord(id) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, "tags");
		tx.objectStore("tags").delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("tag delete failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("tag delete aborted"));
	}));
}
function writeKv(key, value) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, "kv");
		tx.objectStore("kv").put({
			key,
			value
		});
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("setting save failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("setting save aborted"));
	}));
}
async function measureAppStorage() {
	const db = await getDb();
	const originals = {
		bytes: 0,
		images: 0
	};
	const thumbs = { bytes: 0 };
	await new Promise((resolve, reject) => {
		if (!db.objectStoreNames.contains("imageBlobs")) {
			resolve();
			return;
		}
		const tx = db.transaction("imageBlobs", "readonly");
		const req = tx.objectStore("imageBlobs").openCursor();
		req.onsuccess = () => {
			const cursor = req.result;
			if (!cursor) return;
			const row = cursor.value;
			if (row.original instanceof Blob) {
				originals.bytes += row.original.size;
				originals.images += 1;
			}
			if (row.thumb instanceof Blob && row.thumb !== row.original) thumbs.bytes += row.thumb.size;
			cursor.continue();
		};
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("storage measure failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("storage measure aborted"));
	});
	const meta = await measureMetaBytes(db);
	return {
		originals: originals.bytes,
		thumbs: thumbs.bytes,
		meta,
		images: originals.images
	};
}
async function measureMetaBytes(db) {
	const names = [
		"imageMeta",
		"folders",
		"folderViews",
		"tags",
		"kv"
	].filter((name) => db.objectStoreNames.contains(name));
	if (names.length === 0) return null;
	const rows = await new Promise((resolve, reject) => {
		const tx = db.transaction(names, "readonly");
		const found = [];
		let pending = names.length;
		for (const name of names) {
			const req = tx.objectStore(name).getAll();
			req.onsuccess = () => {
				const value = req.result;
				if (Array.isArray(value)) found.push(...value);
				pending -= 1;
				if (pending === 0) resolve(found);
			};
			req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("meta measure failed"));
		}
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("meta measure failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("meta measure aborted"));
	});
	try {
		return new TextEncoder().encode(JSON.stringify(rows)).byteLength;
	} catch {
		return null;
	}
}
async function measureBrowserStorage() {
	if (typeof navigator === "undefined" || !navigator.storage?.estimate) return {
		usage: null,
		quota: null
	};
	try {
		const estimate = await navigator.storage.estimate();
		return {
			usage: typeof estimate.usage === "number" ? estimate.usage : null,
			quota: typeof estimate.quota === "number" ? estimate.quota : null
		};
	} catch {
		return {
			usage: null,
			quota: null
		};
	}
}
/** Reads stored sizes without writing or converting image data. */
async function measureStorage() {
	const measuredAt = Date.now();
	const [app, browser] = await Promise.all([measureAppStorage().catch(() => null), measureBrowserStorage()]);
	return {
		measuredAt,
		app,
		browser
	};
}
function listKv() {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const req = db.transaction("kv", "readonly").objectStore("kv").getAll();
		req.onsuccess = () => {
			resolve((req.result ?? []).flatMap((row) => row && typeof row.key === "string" && row.key && (typeof row.value === "string" || typeof row.value === "number") ? [{
				key: row.key,
				value: row.value
			}] : []));
		};
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("setting list failed"));
	}));
}
function listViewRows() {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const req = db.transaction("folderViews", "readonly").objectStore("folderViews").getAll();
		req.onsuccess = () => {
			resolve((req.result ?? []).flatMap((row) => {
				if (!row || typeof row.id !== "string" || !row.id) return [];
				return [{
					id: row.id,
					...normalizeFolderView(row)
				}];
			}));
		};
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("view list failed"));
	}));
}
/** Reads the library for a backup. Does not write or delete anything. */
async function readLibraryDump(onProgress) {
	const db = await getDb();
	const [metas, folders, tags, tagFolders, views, settings] = await Promise.all([
		listMeta(),
		listFolders(),
		listTags(),
		listTagFolders(),
		listViewRows(),
		listKv()
	]);
	const wanted = new Set(metas.map((meta) => meta.id));
	const blobs = /* @__PURE__ */ new Map();
	await new Promise((resolve, reject) => {
		const tx = db.transaction("imageBlobs", "readonly");
		const req = tx.objectStore("imageBlobs").openCursor();
		req.onsuccess = () => {
			const cursor = req.result;
			if (!cursor) return;
			const row = cursor.value;
			if (row && wanted.has(row.id) && row.original instanceof Blob) {
				blobs.set(row.id, {
					original: row.original,
					thumb: row.thumb instanceof Blob ? row.thumb : null
				});
				onProgress?.(blobs.size, metas.length);
			}
			cursor.continue();
		};
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("blob read failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("blob read aborted"));
	});
	return {
		metas,
		blobs,
		folders,
		views,
		tags,
		tagFolders,
		settings
	};
}
function yieldUi() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}
function deleteNamed(name) {
	return new Promise((resolve, reject) => {
		let request;
		try {
			request = indexedDB.deleteDatabase(name);
		} catch (error) {
			reject(error);
			return;
		}
		request.onsuccess = () => resolve();
		request.onerror = () => reject(request.error ?? /* @__PURE__ */ new Error("indexedDB delete failed"));
		request.onblocked = () => reject(/* @__PURE__ */ new Error("indexedDB blocked"));
	});
}
function deleteTabDatabase(tab, name) {
	const slots = libraryDbSlots(tab);
	if (name !== slots[0] && name !== slots[1]) return Promise.reject(/* @__PURE__ */ new Error("このタブ以外の保存先は削除できません。"));
	return deleteNamed(name);
}
function txDone(tx) {
	return new Promise((resolve, reject) => {
		let settled = false;
		const fail = (error) => {
			if (settled) return;
			settled = true;
			reject(error ?? /* @__PURE__ */ new Error("indexedDB failed"));
		};
		tx.oncomplete = () => {
			if (settled) return;
			settled = true;
			resolve();
		};
		tx.onerror = () => fail(tx.error);
		tx.onabort = () => fail(tx.error ?? /* @__PURE__ */ new Error("indexedDB aborted"));
	});
}
function countStore(db, name) {
	return new Promise((resolve, reject) => {
		const req = db.transaction(name, "readonly").objectStore(name).count();
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("count failed"));
	});
}
async function ownBlob(source, type) {
	const bytes = await source.arrayBuffer();
	return new Blob([bytes], { type: type || source.type || "application/octet-stream" });
}
function readStore(db, name) {
	return new Promise((resolve, reject) => {
		if (!db.objectStoreNames.contains(name)) {
			resolve([]);
			return;
		}
		const req = db.transaction(name, "readonly").objectStore(name).getAll();
		req.onsuccess = () => resolve(req.result ?? []);
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("indexedDB read failed"));
	});
}
async function databaseExists(name) {
	if (typeof indexedDB.databases !== "function") return true;
	return (await indexedDB.databases()).some((entry) => entry.name === name);
}
/** Reads one folder tree from a tab without switching the open library. Bytes are copied out of IndexedDB. */
async function readFolderCopySource(tab, folderId) {
	const plan = librarySlotPlan(tab);
	const same = plan.live === libraryDbName();
	if (!same && !await databaseExists(plan.live)) return null;
	const db = same ? await getDb() : await openNamed(plan.live, false);
	let folderMissing = false;
	try {
		const [folderRows, itemRows, blobRows, tagRows, tagFolderRows, viewRows] = await Promise.all([
			readStore(db, "folders"),
			readStore(db, "imageMeta"),
			readStore(db, "imageBlobs"),
			readStore(db, "tags"),
			readStore(db, "tagFolders"),
			readStore(db, "folderViews")
		]);
		const folders = normalizeFolders(folderRows);
		if (!folders.some((folder) => folder.id === folderId)) {
			folderMissing = true;
			return null;
		}
		const branch = /* @__PURE__ */ new Set([folderId, ...descendantFolderIds(folders, folderId)]);
		const items = itemRows.flatMap((row) => {
			const meta = normalizeMeta(row);
			return meta && branch.has(meta.folderId) ? [meta] : [];
		});
		const blobs = /* @__PURE__ */ new Map();
		const blobById = new Map(blobRows.filter((row) => typeof row.id === "string").map((row) => [row.id, row]));
		for (const item of items) {
			const row = blobById.get(item.id);
			if (!row?.original) continue;
			const original = await ownBlob(row.original, row.original.type || item.mime);
			const thumb = row.thumb instanceof Blob && row.thumb !== row.original ? await ownBlob(row.thumb, row.thumb.type || "image/jpeg") : null;
			blobs.set(item.id, {
				original,
				thumb
			});
		}
		const views = {};
		for (const row of viewRows) {
			if (!row || typeof row.id !== "string" || !branch.has(row.id)) continue;
			views[row.id] = normalizeFolderView(row);
		}
		return {
			rootId: folderId,
			folders: folders.filter((folder) => branch.has(folder.id)),
			items,
			blobs,
			tags: tagRows.flatMap((row) => {
				const tag = normalizeTag(row);
				return tag ? [tag] : [];
			}),
			tagFolders: tagFolderRows.flatMap((row) => {
				const folder = normalizeTagFolder(row);
				return folder ? [folder] : [];
			}),
			views
		};
	} finally {
		if (!same) {
			const fresh = openedFresh.get(db) === true;
			db.close();
			if (folderMissing && fresh) await deleteTabDatabase(tab, plan.live).catch(() => void 0);
		}
	}
}
/** Writes a prepared copy in one transaction. A failure leaves none of it behind. */
function commitFolderCopy(input) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const tx = openWrite(db, [
			"folders",
			"folderViews",
			"tags",
			"tagFolders",
			"imageMeta",
			"imageBlobs",
			"kv"
		]);
		if (input.promoted) tx.objectStore("folders").put(input.promoted);
		for (const folder of input.folders) tx.objectStore("folders").put(folder);
		for (const view of input.views) tx.objectStore("folderViews").put({
			id: view.id,
			...normalizeFolderView(view.view)
		});
		for (const folder of input.tagFolders) tx.objectStore("tagFolders").put(folder);
		for (const tag of input.tags) tx.objectStore("tags").put(tag);
		for (const image of input.images) {
			tx.objectStore("imageMeta").put(image.meta);
			tx.objectStore("imageBlobs").put({
				id: image.meta.id,
				original: image.original,
				thumb: image.thumb
			});
		}
		tx.objectStore("kv").put({
			key: "folder",
			value: input.selectId
		});
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("folder copy failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("folder copy aborted"));
	}));
}
/** Drops a retired slot only when the reserved name belongs to that same tab. */
function releaseRetiredLibrary() {
	if (typeof localStorage === "undefined" || typeof indexedDB === "undefined") return;
	for (const tab of [
		1,
		2,
		3
	]) releaseRetiredTab(tab);
}
function releaseRetiredTab(tab) {
	const plan = librarySlotPlan(tab);
	let drop = "";
	try {
		drop = localStorage.getItem(plan.retireKey) ?? "";
		if (!drop) return;
		const target = retiredDbToDelete(tab, drop, plan.live);
		localStorage.removeItem(plan.retireKey);
		if (!target) return;
		deleteTabDatabase(tab, target).catch(() => {
			try {
				localStorage.setItem(plan.retireKey, target);
			} catch {}
		});
	} catch {}
}
/**
* Writes the backup into the unused slot of one tab, and switches to it
* only after the counts match. Other tabs' databases are never opened or deleted.
* Omitting `tab` restores the database that is open now.
*/
async function restoreLibrary(backup, onProgress, tab) {
	const started = performance.now();
	const total = backup.images.length;
	const bytesTotal = backup.images.reduce((sum, image) => sum + image.original.size + (image.thumb?.size ?? 0), 0);
	const fileBytes = backup.summary.bytes;
	let saved = 0;
	let stage = "下書きの準備";
	const fail = (cause, detail = "") => new RestoreFailure(stage, fileBytes, saved, total, performance.now() - started, cause, detail);
	const report = (name, done, bytesDone) => {
		onProgress?.({
			stage: name,
			done,
			total,
			bytesDone,
			bytesTotal,
			elapsedMs: performance.now() - started
		});
	};
	const plan = librarySlotPlan(tab === void 0 ? activeLibraryTab() : tab);
	const next = plan.swap;
	let staging = null;
	let flipped = false;
	try {
		if (typeof indexedDB === "undefined") throw new Error("indexedDB unavailable");
		stage = "下書きの準備";
		report("draft", 0, 0);
		await yieldUi();
		await deleteTabDatabase(plan.tab, next);
		staging = await openNamed(next, false);
		const metaTx = staging.transaction([
			"folders",
			"folderViews",
			"tags",
			"tagFolders",
			"kv"
		], "readwrite");
		for (const folder of backup.manifest.folders) metaTx.objectStore("folders").put(folder);
		for (const view of backup.manifest.folderViews) metaTx.objectStore("folderViews").put(view);
		for (const tag of backup.manifest.tags) metaTx.objectStore("tags").put(tag);
		for (const folder of backup.manifest.tagFolders) metaTx.objectStore("tagFolders").put(folder);
		for (const setting of backup.manifest.settings) metaTx.objectStore("kv").put({
			key: setting.key,
			value: setting.value
		});
		await txDone(metaTx);
		stage = "画像の保存";
		const sizes = backup.images.map((image) => image.original.size + (image.thumb?.size ?? 0));
		let bytesDone = 0;
		for (const indexes of batchImageIndexes(sizes)) {
			report("save", saved, bytesDone);
			await yieldUi();
			const rows = [];
			for (const index of indexes) {
				const image = backup.images[index];
				if (!image) continue;
				let original;
				let thumb = null;
				try {
					original = await ownBlob(image.original, image.original.type || image.meta.mime);
					if (image.thumb) thumb = await ownBlob(image.thumb, image.thumb.type || "image/jpeg");
				} catch (error) {
					throw fail(error, `「${image.meta.name}」のデータを読み出せませんでした。`);
				}
				if (original.size !== image.original.size || image.thumb && thumb?.size !== image.thumb.size) throw fail(/* @__PURE__ */ new Error("size mismatch"), `「${image.meta.name}」の長さが記録と一致しません。`);
				rows.push({
					meta: image.meta,
					original,
					thumb
				});
			}
			const tx = staging.transaction(["imageMeta", "imageBlobs"], "readwrite");
			for (const row of rows) {
				tx.objectStore("imageMeta").put(row.meta);
				tx.objectStore("imageBlobs").put({
					id: row.meta.id,
					original: row.original,
					thumb: row.thumb
				});
			}
			try {
				await txDone(tx);
			} catch (error) {
				const name = rows[0]?.meta.name ?? "";
				throw fail(error, name ? `「${name}」付近の保存に失敗しました。` : "");
			}
			saved += rows.length;
			bytesDone += rows.reduce((sum, row) => sum + row.original.size + (row.thumb?.size ?? 0), 0);
			rows.length = 0;
			report("save", saved, bytesDone);
			await yieldUi();
		}
		stage = "件数の照合";
		report("check", saved, bytesDone);
		const [images, blobs, folders, views, tags, tagFolders, settings] = await Promise.all([
			countStore(staging, "imageMeta"),
			countStore(staging, "imageBlobs"),
			countStore(staging, "folders"),
			countStore(staging, "folderViews"),
			countStore(staging, "tags"),
			countStore(staging, "tagFolders"),
			countStore(staging, "kv")
		]);
		if (images !== total || blobs !== total || folders !== backup.manifest.folders.length || views !== backup.manifest.folderViews.length || tags !== backup.manifest.tags.length || tagFolders !== backup.manifest.tagFolders.length || settings !== backup.manifest.settings.length) throw fail(/* @__PURE__ */ new Error("count mismatch"), `件数が合いません。画像 ${images}/${total}、本体 ${blobs}、フォルダ ${folders}、タグ ${tags}。`);
		stage = "ライブラリの切り替え";
		report("switch", saved, bytesDone);
		const previous = plan.live;
		try {
			localStorage.setItem(plan.liveKey, next);
		} catch (error) {
			throw fail(error, "このブラウザは復元先を覚えておけません。");
		}
		flipped = true;
		try {
			localStorage.setItem(plan.retireKey, previous);
		} catch {}
		staging.close();
		staging = null;
		if (plan.tab === activeLibraryTab()) {
			(await getDb().catch(() => null))?.close();
			dbPromise = null;
			boundName = null;
			connectionEpoch += 1;
		}
	} catch (error) {
		staging?.close();
		if (!flipped) await deleteTabDatabase(plan.tab, next).catch(() => void 0);
		if (error instanceof RestoreFailure) throw error;
		throw fail(error);
	}
}
var LIBRARY_STORES = [
	"imageMeta",
	"imageBlobs",
	"folders",
	"folderViews",
	"tags",
	"tagFolders",
	"kv"
];
/** Rewrites the seven stores of the given database. It does not open or choose a database. */
function replaceLibraryStores(db, backup) {
	return new Promise((resolve, reject) => {
		const tx = openWrite(db, [...LIBRARY_STORES]);
		for (const name of LIBRARY_STORES) tx.objectStore(name).clear();
		for (const image of backup.images) {
			tx.objectStore("imageMeta").put(image.meta);
			const row = {
				id: image.meta.id,
				original: image.original,
				thumb: image.thumb
			};
			tx.objectStore("imageBlobs").put(row);
		}
		for (const folder of backup.manifest.folders) tx.objectStore("folders").put(folder);
		for (const view of backup.manifest.folderViews) tx.objectStore("folderViews").put(view);
		for (const tag of backup.manifest.tags) tx.objectStore("tags").put(tag);
		for (const folder of backup.manifest.tagFolders) tx.objectStore("tagFolders").put(folder);
		for (const setting of backup.manifest.settings) tx.objectStore("kv").put({
			key: setting.key,
			value: setting.value
		});
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? /* @__PURE__ */ new Error("restore failed"));
		tx.onabort = () => reject(tx.error ?? /* @__PURE__ */ new Error("restore aborted"));
	});
}
/** Replaces the seven stores of the database that is open now. */
function replaceLibrary(backup) {
	if (!userWrites) return Promise.reject(/* @__PURE__ */ new Error("library-changed"));
	return getDb().then((db) => replaceLibraryStores(db, backup));
}
/**
* Clears the open library and writes a fresh one in the same database.
* Does not open another tab, and does not touch the swap or retire slot.
* Aborts without writing when the open database is no longer the one requested.
*/
async function resetLiveLibrary(expectedName, backup) {
	if (!userWrites) throw new Error("library-changed");
	const db = await getDb();
	if (!userWrites || db.name !== expectedName) throw new Error("library-changed");
	await replaceLibraryStores(db, backup);
}
function readPixels(id, kind) {
	return getDb().then((db) => new Promise((resolve, reject) => {
		const req = db.transaction("imageBlobs", "readonly").objectStore("imageBlobs").get(id);
		req.onsuccess = () => {
			const row = req.result;
			if (!row) {
				resolve(null);
				return;
			}
			resolve(kind === "original" ? row.original : row.thumb ?? row.original);
		};
		req.onerror = () => reject(req.error ?? /* @__PURE__ */ new Error("read failed"));
	}));
}
/** Browser quota pressure. Missing numbers stay unknown instead of a guessed percent. */
function storagePressure(usage, quota) {
	if (usage === null || quota === null || !Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) return null;
	const ratio = usage / quota;
	if (ratio >= .95) return "alert";
	if (ratio >= .8) return "warn";
	return "ok";
}
function storageRatio(usage, quota) {
	if (usage === null || quota === null || !Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) return null;
	return usage / quota;
}
function formatBytes(bytes) {
	if (!Number.isFinite(bytes) || bytes < 0) return "取得できません";
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	const units = [
		"KB",
		"MB",
		"GB",
		"TB"
	];
	let value = bytes / 1024;
	let index = 0;
	while (value >= 1024 && index < units.length - 1) {
		value /= 1024;
		index += 1;
	}
	const digits = value >= 10 ? 1 : 2;
	return `${value.toFixed(digits)} ${units[index]}`;
}
function formatCheckedAt(time) {
	if (!Number.isFinite(time)) return "取得できません";
	return new Date(time).toLocaleString("ja-JP", { hour12: false });
}
function summaryLine(summary, tail) {
	return `バックアップを作成しました。画像${summary.images}枚（動画${summary.videos}件）、フォルダ${summary.folders}、タグ${summary.tags}、タグフォルダ${summary.tagFolders}、お気に入り${summary.favorites}を含みます。${tail}`;
}
function errorName(error) {
	if (!error || typeof error !== "object") return "";
	const name = error.name;
	return typeof name === "string" ? name : "";
}
function shareApiPresent() {
	return typeof navigator.share === "function" && typeof navigator.canShare === "function";
}
function shareSupported(file) {
	if (!shareApiPresent()) return false;
	try {
		return navigator.canShare({ files: [file] });
	} catch {
		return false;
	}
}
function namedBackup(data, name) {
	if (data instanceof File && data.name === name) return data;
	return new File([data], name, { type: data.type || "application/octet-stream" });
}
function triggerDownload(data, name) {
	const url = URL.createObjectURL(data);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.rel = "noopener";
	document.body.appendChild(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 6e4);
}
function reason(error, fallback) {
	if (error instanceof RestoreFailure) {
		const seconds = Math.max(1, Math.round(error.elapsedMs / 1e3));
		const quota = error.reasonName === "QuotaExceededError";
		const lines = [
			`${error.stage}の段階で失敗しました。`,
			`ファイル ${formatBytes(error.fileBytes)}、処理 ${error.saved}/${error.total} 件、経過 ${seconds} 秒。`,
			quota ? "ブラウザの保存容量が足りません。復元は今のデータを残したまま書き込むため、ファイルサイズ分の空きがさらに必要です。現在のライブラリは消していません。" : `エラーは ${error.reasonName} です。`
		];
		if (error.detail && error.detail !== error.reasonName) lines.push(error.detail);
		lines.push("現在のデータは変更していません。もう一度「復元」からやり直せます。");
		return lines.join("\n");
	}
	if (error instanceof BackupError) return error.message;
	return storageErrorMessage(error, "save") || fallback;
}
function readStatus(stage, done, total, fileBytes) {
	if (stage === "header") return `ファイルを開いています\n${formatBytes(fileBytes)}`;
	if (stage === "manifest") return `目録を読み込んでいます\n${formatBytes(fileBytes)}`;
	return `データを検証しています\n${done}/${total} 件 · ${formatBytes(fileBytes)}`;
}
function saveStatus(progress) {
	const label = progress.stage === "draft" ? "下書きを用意しています" : progress.stage === "check" ? "件数を照合しています" : progress.stage === "switch" ? "ライブラリを切り替えています" : "画像を分割して保存しています";
	const seconds = Math.max(0, Math.round(progress.elapsedMs / 1e3));
	return `${label}\n${progress.done}/${progress.total} 件 · ${formatBytes(progress.bytesDone)} / ${formatBytes(progress.bytesTotal)} · ${seconds}秒`;
}
function when(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("ja-JP", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(date);
}
var BackupActions = (0, import_react.forwardRef)(function BackupActions({ disabled, viewer = false, tab }, ref) {
	const inputRef = (0, import_react.useRef)(null);
	const fileRef = (0, import_react.useRef)(null);
	const noteRef = (0, import_react.useRef)("");
	const sharingRef = (0, import_react.useRef)(false);
	const jobRef = (0, import_react.useRef)(null);
	const [sharing, setSharing] = (0, import_react.useState)(false);
	const [job, setJobState] = (0, import_react.useState)(null);
	const busy = job?.mode === "work";
	const setJob = (next) => {
		jobRef.current = next;
		setJobState(next);
	};
	const setSharingFlag = (value) => {
		sharingRef.current = value;
		setSharing(value);
	};
	const forgetFile = () => {
		fileRef.current = null;
	};
	const downloadSaved = () => {
		const file = fileRef.current;
		if (!file) {
			setSharingFlag(false);
			setJob({
				mode: "error",
				message: "バックアップファイルがありません。共有もダウンロードもできません。もう一度「バックアップ」を押してください。保存データは変更していません。",
				canDownload: false
			});
			return;
		}
		const shareAlreadyFailed = job?.mode === "error";
		try {
			triggerDownload(file, file.name);
			forgetFile();
			setSharingFlag(false);
			setJob({
				mode: "done",
				message: "ダウンロードしました。保存データは変更していません。"
			});
		} catch {
			setSharingFlag(false);
			setJob({
				mode: "error",
				canDownload: true,
				message: shareAlreadyFailed ? "共有とダウンロードの両方が失敗しました。共有メニューは開かず、ブラウザの保存も拒否しました。同じファイルは残っています。もう一度「ダウンロード」を押せます。保存データは変更していません。" : "ダウンロードに失敗しました。ブラウザがファイルの保存を拒否しました。共有メニューとは別の失敗です。同じファイルは残っています。もう一度「ダウンロード」を押せます。保存データは変更していません。"
			});
		}
	};
	const finishShareError = (error) => {
		setSharingFlag(false);
		if (!fileRef.current) return;
		const name = errorName(error);
		if (name === "AbortError") {
			setJob({
				mode: "ready",
				message: `${noteRef.current}\n共有を取り消しました。同じファイルを、もう一度「共有する」か「ダウンロード」で渡せます。保存データは変更していません。`
			});
			return;
		}
		const why = name === "NotAllowedError" ? "ブラウザが共有メニューを拒否しました。ファイルを作った直後の操作ではなかったか、この形式を共有できません。" : name === "DataError" || name === "TypeError" ? "このブラウザは、このバックアップファイルを共有メニューに載せられませんでした。" : `共有に失敗しました${name ? `（${name}）` : ""}。`;
		setJob({
			mode: "error",
			canDownload: true,
			message: `${why}\n同じファイルは残しています。「ダウンロード」で保存できます。共有は自動ではやり直していません。保存データは変更していません。`
		});
	};
	const shareSaved = () => {
		const file = fileRef.current;
		if (sharingRef.current) return;
		if (!file) {
			setJob({
				mode: "error",
				message: "バックアップファイルがありません。共有もダウンロードもできません。もう一度「バックアップ」を押してください。保存データは変更していません。",
				canDownload: false
			});
			return;
		}
		if (!shareSupported(file)) {
			downloadSaved();
			return;
		}
		setSharingFlag(true);
		setJob({
			mode: "ready",
			message: `${noteRef.current}\n共有メニューを開いています…`
		});
		let pending;
		try {
			pending = navigator.share({
				files: [file],
				title: file.name
			});
		} catch (error) {
			finishShareError(error);
			return;
		}
		pending.then(() => {
			setSharingFlag(false);
			if (!fileRef.current) return;
			forgetFile();
			setJob({
				mode: "done",
				message: "共有メニューに渡しました。保存先はそこで選んでください。特定のサービスへは送っていません。保存データは変更していません。"
			});
		}, (error) => {
			finishShareError(error);
		});
	};
	const download = async () => {
		if (busy || sharingRef.current) return;
		setJob({
			mode: "work",
			title: "バックアップ",
			status: "保存データを読み出しています…"
		});
		try {
			const createdAt = /* @__PURE__ */ new Date();
			const dump = await readLibraryDump((done, total) => {
				setJob({
					mode: "work",
					title: "バックアップ",
					status: `画像を読み出しています ${done}/${total}`
				});
			});
			setJob({
				mode: "work",
				title: "バックアップ",
				status: "ファイルを作成しています…"
			});
			const { file, summary } = buildBackup(dump, createdAt);
			const name = backupFileName(createdAt);
			const kept = summaryLine(summary, "保存データは変更していません。");
			if (!viewer) {
				triggerDownload(file, name);
				setJob({
					mode: "done",
					message: kept
				});
				return;
			}
			if (!shareApiPresent()) {
				triggerDownload(file, name);
				setJob({
					mode: "done",
					message: summaryLine(summary, "このブラウザはファイルの共有メニューに対応していないため、ダウンロードしました。保存データは変更していません。")
				});
				return;
			}
			const named = namedBackup(file, name);
			if (!shareSupported(named)) {
				triggerDownload(file, name);
				setJob({
					mode: "done",
					message: summaryLine(summary, "このブラウザは、このバックアップファイルを共有メニューに載せられないため、ダウンロードしました。保存データは変更していません。")
				});
				return;
			}
			fileRef.current = named;
			noteRef.current = kept;
			setJob({
				mode: "ready",
				message: `${kept}\nファイルはできています。「共有する」で保存先を選ぶか、「ダウンロード」で保存できます。`
			});
		} catch (error) {
			forgetFile();
			setSharingFlag(false);
			setJob({
				mode: "error",
				message: reason(error, "バックアップに失敗しました。保存データは変更していません。"),
				canDownload: false
			});
		}
	};
	const inspect = async (file) => {
		if (!file || sharingRef.current || jobRef.current?.mode === "work") return;
		let stage = "ファイルの受付";
		setJob({
			mode: "work",
			title: "復元",
			status: `ファイルを開いています\n${formatBytes(file.size)}`
		});
		try {
			const parsed = await readBackup(file, (progress) => {
				stage = progress.stage === "header" ? "ファイルの受付" : progress.stage === "manifest" ? "目録の読み込み" : "データの検証";
				setJob({
					mode: "work",
					title: "復元",
					status: readStatus(progress.stage, progress.done, progress.total, file.size)
				});
			});
			setJob({
				mode: "confirm",
				parsed
			});
		} catch (error) {
			const detail = reason(error, "バックアップを読めませんでした。");
			setJob({
				mode: "error",
				message: `${detail}\n段階: ${stage}\nファイル ${formatBytes(file.size)}\n現在のデータは変更していません。`,
				canDownload: false
			});
		}
	};
	const inspectRef = (0, import_react.useRef)(inspect);
	inspectRef.current = inspect;
	(0, import_react.useImperativeHandle)(ref, () => ({ inspectFile(file) {
		inspectRef.current(file);
	} }));
	const restore = async (parsed) => {
		const started = performance.now();
		setJob({
			mode: "work",
			title: "復元",
			status: "下書きを用意しています\n現在のデータは、まだ消していません"
		});
		try {
			await restoreLibrary(parsed, (progress) => {
				setJob({
					mode: "work",
					title: "復元",
					status: saveStatus(progress)
				});
			});
		} catch (error) {
			setJob({
				mode: "error",
				message: reason(error, "復元に失敗しました。現在のデータは変更していません。"),
				canDownload: false
			});
			return;
		}
		const { summary } = parsed;
		const seconds = Math.max(1, Math.round((performance.now() - started) / 1e3));
		try {
			sessionStorage.setItem("komacho-restored", `復元しました。画像${summary.images}枚（動画${summary.videos}件）、フォルダ${summary.folders}、タグ${summary.tags}、タグフォルダ${summary.tagFolders}、お気に入り${summary.favorites}です。ファイル ${formatBytes(summary.bytes)}、${seconds}秒。`);
		} catch {}
		window.location.reload();
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "quiet",
			className: "aux-btn",
			disabled: disabled || busy || sharing,
			onClick: () => void download(),
			children: "バックアップを保存"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "quiet",
			className: "aux-btn",
			disabled: disabled || busy,
			onClick: () => inputRef.current?.click(),
			children: "バックアップから復元"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			ref: inputRef,
			type: "file",
			accept: ".kmb,application/octet-stream",
			className: "sr-only",
			"aria-label": "バックアップファイル",
			onChange: (event) => {
				const file = event.target.files?.[0];
				event.target.value = "";
				inspect(file);
			}
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: job !== null,
			modal: job?.mode === "work" || job?.mode === "confirm",
			onOpenChange: (open) => {
				if (open || busy || sharingRef.current) return;
				if (fileRef.current) return;
				setJob(null);
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "sheet-overlay" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "storage-sheet",
				"aria-describedby": void 0,
				onOpenAutoFocus: (event) => event.preventDefault(),
				onCloseAutoFocus: (event) => event.preventDefault(),
				onPointerDownOutside: (event) => event.preventDefault(),
				onInteractOutside: (event) => event.preventDefault(),
				onFocusOutside: (event) => event.preventDefault(),
				onEscapeKeyDown: (event) => event.preventDefault(),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "border-b border-line px-4 py-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
							className: "font-medium",
							children: job?.mode === "confirm" ? "復元の確認" : job?.mode === "work" ? job.title : job?.mode === "error" ? "できませんでした" : "バックアップ"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-3 px-4 py-4 text-sm",
						children: [
							job?.mode === "work" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "whitespace-pre-wrap",
								children: job.status
							}) : null,
							job?.mode === "done" || job?.mode === "error" || job?.mode === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "whitespace-pre-wrap",
								children: job.message
							}) : null,
							job?.mode === "confirm" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								"復元先はタブ",
								tab,
								"です。他のタブは変更しません。現在の保存データは、このバックアップの時点の内容にすべて置き換わります。先に「バックアップを保存」で今のデータを保存しておくことをおすすめします。"
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
								className: "grid grid-cols-[8rem_1fr] gap-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-ink-muted",
										children: "復元先"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { children: ["タブ", tab] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-ink-muted",
										children: "作成日時"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: when(job.parsed.summary.createdAt) }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-ink-muted",
										children: "画像"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { children: [
										job.parsed.summary.images,
										"枚（動画",
										job.parsed.summary.videos,
										"件）"
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-ink-muted",
										children: "フォルダ"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: job.parsed.summary.folders }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-ink-muted",
										children: "タグ"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dd", { children: [
										job.parsed.summary.tags,
										"（フォルダ",
										job.parsed.summary.tagFolders,
										"）"
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-ink-muted",
										children: "お気に入り"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: job.parsed.summary.favorites }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-ink-muted",
										children: "ファイル"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: formatBytes(job.parsed.summary.bytes) })
								]
							})] }) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex justify-end gap-2 border-t border-line px-4 py-3",
						children: job?.mode === "confirm" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							onClick: () => setJob(null),
							children: "キャンセル"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => void restore(job.parsed),
							children: "置き換える"
						})] }) : job?.mode === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "quiet",
								onClick: () => {
									forgetFile();
									setSharingFlag(false);
									setJob(null);
								},
								children: "閉じる"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "quiet",
								onClick: () => downloadSaved(),
								children: "ダウンロード"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								disabled: sharing,
								onClick: () => shareSaved(),
								children: "共有する"
							})
						] }) : job?.mode === "work" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [job?.mode === "error" && job.canDownload ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							onClick: () => downloadSaved(),
							children: "ダウンロード"
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							onClick: () => {
								forgetFile();
								setJob(null);
							},
							children: "閉じる"
						})] })
					})
				]
			})] })
		})
	] });
});
function captureErrorMessage(error) {
	const name = error instanceof DOMException || error instanceof Error ? error.name : "";
	if (name === "NotAllowedError" || name === "AbortError") return "画面共有がキャンセルされました。切り取る画面を選ぶと、範囲を指定できます。";
	return "画面を取得できませんでした。ブラウザの共有ダイアログで、画面またはウィンドウを選んでください。";
}
async function captureScreenFrame() {
	if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("unsupported");
	const stream = await navigator.mediaDevices.getDisplayMedia({
		video: { displaySurface: "monitor" },
		audio: false,
		preferCurrentTab: false,
		selfBrowserSurface: "exclude",
		monitorTypeSurfaces: "include",
		surfaceSwitching: "exclude"
	});
	const video = document.createElement("video");
	video.srcObject = stream;
	video.muted = true;
	video.playsInline = true;
	try {
		await video.play();
		if (video.readyState < 2) await new Promise((resolve, reject) => {
			const timer = window.setTimeout(() => reject(/* @__PURE__ */ new Error("timeout")), 5e3);
			video.onloadeddata = () => {
				window.clearTimeout(timer);
				resolve();
			};
		});
		const width = video.videoWidth;
		const height = video.videoHeight;
		if (width < 2 || height < 2) throw new Error("empty");
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("canvas");
		ctx.drawImage(video, 0, 0);
		return await new Promise((resolve, reject) => {
			canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("png")), "image/png");
		});
	} finally {
		stream.getTracks().forEach((track) => track.stop());
		video.srcObject = null;
	}
}
function contentFrame(image) {
	const box = image.getBoundingClientRect();
	const origin = image.parentElement?.getBoundingClientRect() ?? box;
	const naturalWidth = image.naturalWidth;
	const naturalHeight = image.naturalHeight;
	if (box.width < 1 || box.height < 1 || naturalWidth < 2 || naturalHeight < 2) return null;
	const scale = Math.min(box.width / naturalWidth, box.height / naturalHeight);
	const width = naturalWidth * scale;
	const height = naturalHeight * scale;
	const viewLeft = box.left + (box.width - width) / 2;
	const viewTop = box.top + (box.height - height) / 2;
	return {
		left: viewLeft - origin.left,
		top: viewTop - origin.top,
		viewLeft,
		viewTop,
		width,
		height,
		naturalWidth,
		naturalHeight
	};
}
function cropBlob(image, rect) {
	const canvas = document.createElement("canvas");
	const width = Math.max(1, Math.round(rect.w));
	const height = Math.max(1, Math.round(rect.h));
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) return Promise.reject(/* @__PURE__ */ new Error("canvas"));
	ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, width, height);
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => blob ? resolve(blob) : reject(/* @__PURE__ */ new Error("png")), "image/png");
	});
}
function SnipOverlay({ url, busy, onCancel, onCrop }) {
	const imageRef = (0, import_react.useRef)(null);
	const dragRef = (0, import_react.useRef)(null);
	const rectRef = (0, import_react.useRef)(null);
	const [rect, setRect] = (0, import_react.useState)(null);
	const [frame, setFrame] = (0, import_react.useState)(null);
	const choose = (next) => {
		rectRef.current = next;
		setRect(next);
	};
	(0, import_react.useEffect)(() => {
		const onResize = () => {
			const image = imageRef.current;
			if (image) setFrame(contentFrame(image));
		};
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);
	(0, import_react.useEffect)(() => {
		const onKey = (event) => {
			if (event.key === "Escape") onCancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onCancel]);
	const measure = () => {
		const image = imageRef.current;
		if (!image) return;
		setFrame(contentFrame(image));
	};
	const point = (event) => {
		const image = imageRef.current;
		const current = image ? contentFrame(image) : null;
		if (!image || !current) return null;
		return {
			x: Math.min(current.naturalWidth, Math.max(0, (event.clientX - current.viewLeft) / current.width * current.naturalWidth)),
			y: Math.min(current.naturalHeight, Math.max(0, (event.clientY - current.viewTop) / current.height * current.naturalHeight))
		};
	};
	const shown = rect && frame && rect.w > 1 && rect.h > 1 ? {
		left: frame.left + rect.x / frame.naturalWidth * frame.width,
		top: frame.top + rect.y / frame.naturalHeight * frame.height,
		width: rect.w / frame.naturalWidth * frame.width,
		height: rect.h / frame.naturalHeight * frame.height
	} : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "snip-layer",
		role: "dialog",
		"aria-modal": "true",
		"aria-label": "画面の範囲を選択",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "snip-stage",
			onPointerDown: (event) => {
				if (busy) return;
				const start = point(event);
				if (!start) return;
				dragRef.current = start;
				choose({
					x: start.x,
					y: start.y,
					w: 0,
					h: 0
				});
				event.currentTarget.setPointerCapture(event.pointerId);
			},
			onPointerMove: (event) => {
				const start = dragRef.current;
				const current = point(event);
				if (!start || !current) return;
				setRect({
					x: Math.min(start.x, current.x),
					y: Math.min(start.y, current.y),
					w: Math.abs(current.x - start.x),
					h: Math.abs(current.y - start.y)
				});
				rectRef.current = {
					x: Math.min(start.x, current.x),
					y: Math.min(start.y, current.y),
					w: Math.abs(current.x - start.x),
					h: Math.abs(current.y - start.y)
				};
			},
			onPointerUp: () => {
				const chosen = rectRef.current;
				dragRef.current = null;
				const image = imageRef.current;
				if (!image || !chosen || chosen.w < 8 || chosen.h < 8 || busy) {
					if (!busy) choose(null);
					return;
				}
				choose(null);
				cropBlob(image, chosen).then(onCrop).catch(() => onCancel());
			},
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				ref: imageRef,
				src: url,
				alt: "",
				draggable: false,
				onLoad: measure
			}), shown ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "snip-rect",
				style: {
					left: shown.left,
					top: shown.top,
					width: shown.width,
					height: shown.height
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "snip-size",
					style: {
						top: shown.top < 36 ? "100%" : "auto",
						bottom: shown.top < 36 ? "auto" : "100%"
					},
					children: [
						Math.round(rect?.x ?? 0),
						", ",
						Math.round(rect?.y ?? 0),
						" · ",
						Math.round(rect?.w ?? 0),
						" × ",
						Math.round(rect?.h ?? 0)
					]
				})
			}) : null]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "snip-bar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm",
				children: "ドラッグして範囲を指定します。離すと、その範囲を追加します。"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				variant: "quiet",
				onClick: onCancel,
				disabled: busy,
				children: busy ? "追加中" : "キャンセル"
			})]
		})]
	});
}
var ready = /* @__PURE__ */ new Map();
var pending = /* @__PURE__ */ new Map();
var order = [];
var MAX_READY = 8;
var activeReads = 0;
var waiters = [];
function schedule(job) {
	return new Promise((resolve, reject) => {
		const run = () => {
			activeReads += 1;
			job().then(resolve, reject).finally(() => {
				activeReads -= 1;
				waiters.shift()?.();
			});
		};
		if (activeReads < 2) run();
		else waiters.push(run);
	});
}
var OWN_FILE_DRAG = "application/x-komacho-file";
function remember(id, file) {
	ready.set(id, file);
	const at = order.indexOf(id);
	if (at >= 0) order.splice(at, 1);
	order.push(id);
	while (order.length > MAX_READY) {
		const stale = order.shift();
		if (stale) ready.delete(stale);
	}
}
function releaseOriginal(id) {
	ready.delete(id);
	pending.delete(id);
	const at = order.indexOf(id);
	if (at >= 0) order.splice(at, 1);
}
function releaseAllOriginals() {
	ready.clear();
	pending.clear();
	order.length = 0;
}
function cachedOriginal(id) {
	return ready.get(id) ?? null;
}
/** Builds a File from the stored original. Does not write anything back. */
function primeOriginal(meta) {
	const hit = ready.get(meta.id);
	if (hit) return Promise.resolve(hit);
	const current = pending.get(meta.id);
	if (current) return current;
	const task = schedule(() => readPixels(meta.id, "original")).then((blob) => {
		pending.delete(meta.id);
		if (!blob) return null;
		const file = new File([blob], exportFileName(meta.name, meta.mime), {
			type: meta.mime,
			lastModified: meta.addedAt || Date.now()
		});
		remember(meta.id, file);
		return file;
	}).catch((error) => {
		pending.delete(meta.id);
		throw error;
	});
	pending.set(meta.id, task);
	return task;
}
async function downloadOriginal(meta) {
	const file = await primeOriginal(meta);
	if (!file) return false;
	const url = URL.createObjectURL(file);
	const link = document.createElement("a");
	link.href = url;
	link.download = file.name;
	document.body.append(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1500);
	return true;
}
/**
* Keeps a small set of object URLs for grid thumbs.
* Full-size bytes stay in IndexedDB until a preview asks for them.
*/
var urls = /* @__PURE__ */ new Map();
var pins = /* @__PURE__ */ new Map();
var inflight = /* @__PURE__ */ new Map();
var MAX_UNPINNED = 48;
var thumbEpoch = 0;
function revoke(url) {
	if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
}
function peekThumb(id) {
	return urls.get(id) ?? null;
}
function pinThumb(id) {
	pins.set(id, (pins.get(id) ?? 0) + 1);
	let released = false;
	return () => {
		if (released) return;
		released = true;
		const next = (pins.get(id) ?? 1) - 1;
		if (next <= 0) pins.delete(id);
		else pins.set(id, next);
		trim();
	};
}
function forgetThumb(id) {
	for (const key of [id, `${id}:motion`]) {
		const url = urls.get(key);
		if (url) revoke(url);
		urls.delete(key);
		inflight.delete(key);
		pins.delete(key);
	}
}
function forgetAllThumbs() {
	thumbEpoch += 1;
	for (const url of urls.values()) revoke(url);
	urls.clear();
	inflight.clear();
	pins.clear();
}
function loadThumb(id, read) {
	const cached = urls.get(id);
	if (cached) return Promise.resolve(cached);
	const pending = inflight.get(id);
	if (pending) return pending;
	const epoch = thumbEpoch;
	const task = read(id).then((blob) => {
		inflight.delete(id);
		if (epoch !== thumbEpoch) throw new Error("stale-thumb");
		if (!blob) throw new Error("missing-thumb");
		const again = urls.get(id);
		if (again) return again;
		const url = URL.createObjectURL(blob);
		urls.set(id, url);
		trim(id);
		return url;
	}).catch((error) => {
		inflight.delete(id);
		throw error;
	});
	inflight.set(id, task);
	return task;
}
function invalidateThumb(id) {
	const url = urls.get(id);
	if (url) revoke(url);
	urls.delete(id);
	inflight.delete(id);
}
function trim(keep) {
	if (urls.size <= MAX_UNPINNED) return;
	for (const id of urls.keys()) {
		if (urls.size <= MAX_UNPINNED) break;
		if (id === keep || pins.has(id)) continue;
		const url = urls.get(id);
		if (url) revoke(url);
		urls.delete(id);
	}
}
function FileRow({ item, onJump, viewer }) {
	const [url, setUrl] = (0, import_react.useState)(null);
	const [dragging, setDragging] = (0, import_react.useState)(false);
	const [primed, setPrimed] = (0, import_react.useState)(() => cachedOriginal(item.id) !== null);
	const dragged = (0, import_react.useRef)(false);
	const name = exportFileName(item.name, item.mime);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		const unpin = pinThumb(item.id);
		loadThumb(item.id, (id) => readPixels(id, "thumb")).then((next) => {
			if (!cancelled) setUrl(next);
		}).catch(() => {
			if (!cancelled) setUrl(null);
		});
		(viewer ? Promise.resolve(null) : primeOriginal(item)).then((file) => {
			if (!cancelled && file) setPrimed(true);
		});
		return () => {
			cancelled = true;
			unpin();
		};
	}, [item.id, viewer]);
	const prepare = () => {
		primeOriginal(item).then((file) => {
			if (file) setPrimed(true);
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "file-line",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: dragging ? "file-row is-dragging" : "file-row",
			draggable: !viewer && primed,
			title: viewer ? name : primed ? `${name} をドラッグして渡せます` : "ファイルを準備しています",
			onPointerEnter: () => {
				if (!viewer) prepare();
			},
			onDragStart: (event) => {
				if (viewer) {
					event.preventDefault();
					return;
				}
				const file = cachedOriginal(item.id);
				const transfer = event.dataTransfer;
				if (!file || !transfer) {
					event.preventDefault();
					return;
				}
				transfer.effectAllowed = "copy";
				transfer.setData(OWN_FILE_DRAG, item.id);
				transfer.setData("text/plain", file.name);
				try {
					transfer.items.add(file);
				} catch {
					event.preventDefault();
					return;
				}
				const image = event.currentTarget.querySelector("img");
				if (image) transfer.setDragImage(image, 16, 16);
				dragged.current = true;
				setDragging(true);
			},
			onDragEnd: () => setDragging(false),
			onClick: () => {
				if (dragged.current) {
					dragged.current = false;
					return;
				}
				onJump(item.id);
			},
			children: [url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: url,
				alt: "",
				draggable: false
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "file-thumb" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "file-name",
				children: name
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "file-download",
			"aria-label": `${name}をダウンロード`,
			draggable: false,
			hidden: viewer,
			onClick: () => {
				if (viewer) return;
				downloadOriginal(item);
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { "aria-hidden": "true" })
		})]
	});
}
function FileDock({ items, onJump, viewer = false }) {
	const signature = items.map((item) => item.id).join("|");
	(0, import_react.useEffect)(() => {
		for (const item of items.slice(0, 4)) primeOriginal(item);
	}, [signature, items]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "file-dock",
		"aria-label": "ファイル一覧",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
			className: "file-dock-title",
			children: "ファイル一覧"
		}), items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "file-empty",
			children: "このフォルダにファイルはありません"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "file-scroll",
			children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileRow, {
				item,
				onJump,
				viewer
			}, item.id))
		})]
	});
}
/** Keeps a small confirm next to its button, and nudges it back inside the window. */
function placeSpot(anchor, side, box) {
	const margin = 8;
	const gap = 6;
	const vw = typeof window === "undefined" ? box.width + 16 : window.innerWidth;
	const vh = typeof window === "undefined" ? box.height + 16 : window.innerHeight;
	let left = side === "lower-left" ? anchor.left - box.width + Math.min(20, anchor.width) : anchor.left;
	let top = anchor.bottom + gap;
	if (top + box.height > vh - margin) {
		const above = anchor.top - gap - box.height;
		top = above >= margin ? above : Math.max(margin, vh - margin - box.height);
	}
	if (top < margin) top = margin;
	if (left + box.width > vw - margin) left = vw - margin - box.width;
	if (left < margin) left = margin;
	return {
		top,
		left
	};
}
function SpotConfirm({ anchor, side, title, body, confirmLabel, busy = false, onConfirm, onCancel }) {
	const ref = (0, import_react.useRef)(null);
	const [pos, setPos] = (0, import_react.useState)(() => placeSpot(anchor, side, {
		width: 288,
		height: 148
	}));
	(0, import_react.useLayoutEffect)(() => {
		const node = ref.current;
		if (!node) return;
		const box = node.getBoundingClientRect();
		const next = placeSpot(anchor, side, {
			width: box.width,
			height: box.height
		});
		setPos((current) => current.top === next.top && current.left === next.left ? current : next);
	}, [
		anchor,
		side,
		body,
		title
	]);
	(0, import_react.useEffect)(() => {
		if (busy) return;
		const onPointer = (event) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (ref.current?.contains(target)) return;
			if (target instanceof Element && target.closest("[data-spot-trigger]")) return;
			onCancel();
		};
		const onKey = (event) => {
			if (event.key === "Escape") onCancel();
		};
		const onScroll = (event) => {
			const target = event.target;
			if (target instanceof Node && ref.current?.contains(target)) return;
			onCancel();
		};
		document.addEventListener("pointerdown", onPointer, true);
		document.addEventListener("keydown", onKey);
		window.addEventListener("scroll", onScroll, true);
		return () => {
			document.removeEventListener("pointerdown", onPointer, true);
			document.removeEventListener("keydown", onKey);
			window.removeEventListener("scroll", onScroll, true);
		};
	}, [busy, onCancel]);
	if (typeof document === "undefined") return null;
	return (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref,
		className: "spot-confirm",
		role: "dialog",
		"aria-label": title,
		style: {
			top: pos.top,
			left: pos.left
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: body }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "spot-confirm-actions",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: busy,
				onClick: onCancel,
				children: "キャンセル"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "spot-go",
				disabled: busy,
				onClick: onConfirm,
				children: confirmLabel
			})]
		})]
	}), document.body);
}
function FolderRail({ folders, items, selected, open, width, dragging, ownerFolderId, dropFolderId, dropCount = 0, onSelect, onCreate, onRename, onDelete, onCopy, onPaste, copyReady = false, onReorder, onNest, onToggle, paneHeight, onPane, onJump, viewer = false }) {
	const [draft, setDraft] = (0, import_react.useState)("");
	const [creating, setCreating] = (0, import_react.useState)(false);
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [editName, setEditName] = (0, import_react.useState)("");
	const [dragId, setDragId] = (0, import_react.useState)(null);
	const [beforeId, setBeforeId] = (0, import_react.useState)(null);
	const [afterId, setAfterId] = (0, import_react.useState)(null);
	const [rootDrop, setRootDrop] = (0, import_react.useState)(false);
	const [nestId, setNestId] = (0, import_react.useState)(null);
	const [expanded, setExpanded] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
	const placeRef = (0, import_react.useRef)(null);
	const nestRef = (0, import_react.useRef)(null);
	const draggedRef = (0, import_react.useRef)(false);
	const foldersRef = (0, import_react.useRef)(folders);
	foldersRef.current = folders;
	const editingRef = (0, import_react.useRef)(false);
	const commitRef = (0, import_react.useRef)(false);
	const railRef = (0, import_react.useRef)(null);
	const listRef = (0, import_react.useRef)(null);
	const [dragPane, setDragPane] = (0, import_react.useState)(null);
	const [pendingDelete, setPendingDelete] = (0, import_react.useState)(null);
	const pane = dragPane ?? paneHeight;
	const count = (folder) => {
		if (folder.id === "all") return items.length;
		return storedImageCount(items, folder.isParent ? descendantFolderIds(folders, folder.id) : [folder.id]);
	};
	const startEdit = (folder) => {
		commitRef.current = false;
		editingRef.current = true;
		setEditing(folder.id);
		setEditName(folder.name);
	};
	const finishEdit = (id, name, keepOnReject) => {
		if (commitRef.current) return;
		commitRef.current = true;
		const trimmed = name.trim();
		if (!trimmed) {
			editingRef.current = false;
			setEditing(null);
			return;
		}
		onRename(id, trimmed).then((saved) => {
			if (saved || !keepOnReject) {
				editingRef.current = false;
				setEditing(null);
				return;
			}
			commitRef.current = false;
		});
	};
	const startFolderDrag = (event, folder) => {
		if (viewer || event.button !== 0 || editingRef.current) return;
		if (event.target.closest(".folder-op, input")) return;
		const startY = event.clientY;
		let moved = false;
		const clear = () => {
			placeRef.current = null;
			nestRef.current = null;
			setBeforeId(null);
			setAfterId(null);
			setNestId(null);
			setRootDrop(false);
		};
		const showPlace = (parentId, nextBefore, after, root) => {
			placeRef.current = {
				parentId,
				beforeId: nextBefore
			};
			nestRef.current = null;
			setBeforeId(nextBefore);
			setAfterId(after);
			setNestId(null);
			setRootDrop(root);
			setDragId(folder.id);
		};
		const placeBeside = (target, after) => {
			const parentId = target.parentId ?? null;
			if (folderWouldCycle(folders, folder.id, parentId)) {
				clear();
				setDragId(folder.id);
				return;
			}
			const siblings = folderChildren(folders, parentId).filter((entry) => entry.id !== folder.id);
			if (!after) {
				showPlace(parentId, target.id, null, false);
				return;
			}
			const index = siblings.findIndex((entry) => entry.id === target.id);
			const next = index >= 0 ? siblings[index + 1] : void 0;
			if (next) showPlace(parentId, next.id, null, false);
			else showPlace(parentId, null, target.id, false);
		};
		const move = (pointer) => {
			if (pointer.pointerId !== event.pointerId || editingRef.current) return;
			if (!moved && Math.abs(pointer.clientY - startY) < 6) return;
			moved = true;
			const list = listRef.current;
			const pointed = document.elementFromPoint(pointer.clientX, pointer.clientY);
			const rows = list?.querySelectorAll("[data-folder-id]");
			const lastRow = rows && rows.length > 0 ? rows[rows.length - 1] : void 0;
			const listRect = list?.getBoundingClientRect();
			if (listRect !== void 0 && pointer.clientX >= listRect.left && pointer.clientX <= listRect.right && lastRow !== void 0 && pointer.clientY > lastRow.getBoundingClientRect().bottom || pointed?.closest("[data-root-drop]")) {
				showPlace(null, null, null, true);
				return;
			}
			const hit = pointed?.closest("[data-folder-id]");
			const id = hit?.getAttribute("data-folder-id");
			if (!hit || !id || id === folder.id) {
				clear();
				setDragId(folder.id);
				return;
			}
			const rect = hit.getBoundingClientRect();
			const ratio = rect.height > 0 ? (pointer.clientY - rect.top) / rect.height : .5;
			const target = folders.find((entry) => entry.id === id);
			if (!target) {
				clear();
				setDragId(folder.id);
				return;
			}
			const band = folderDropBand(ratio);
			if (band === "before" || band === "after") {
				placeBeside(target, band === "after");
				return;
			}
			if (!folderWouldCycle(folders, folder.id, target.id)) {
				placeRef.current = null;
				nestRef.current = target.id;
				setBeforeId(null);
				setAfterId(null);
				setRootDrop(false);
				setNestId(target.id);
			} else clear();
			setDragId(folder.id);
		};
		const finish = (pointer) => {
			if (pointer.pointerId !== event.pointerId) return;
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", finish);
			window.removeEventListener("pointercancel", finish);
			if (moved && nestRef.current) {
				setExpanded((current) => new Set(current).add(nestRef.current));
				onNest(folder.id, nestRef.current);
			} else if (moved && placeRef.current) onReorder(folder.id, placeRef.current.beforeId, placeRef.current.parentId);
			draggedRef.current = moved;
			setDragId(null);
			clear();
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", finish);
		window.addEventListener("pointercancel", finish);
	};
	(0, import_react.useEffect)(() => {
		if (selected === "all") return;
		const chain = folderAncestors(foldersRef.current, selected);
		if (chain.length === 0) return;
		setExpanded((current) => {
			let changed = false;
			const next = new Set(current);
			for (const ancestor of chain) if (!next.has(ancestor.id)) {
				next.add(ancestor.id);
				changed = true;
			}
			return changed ? next : current;
		});
	}, [selected]);
	if (!open) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
		className: "folder-rail is-collapsed",
		"aria-label": "フォルダ",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "quiet",
			"aria-label": "フォルダを表示",
			onClick: onToggle,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeftOpen, {
				className: "size-4",
				"aria-hidden": "true"
			})
		})
	});
	const visibleTree = flattenFolders(folders).filter(({ folder }) => folderAncestors(folders, folder.id).every((ancestor) => expanded.has(ancestor.id)));
	const current = folders.find((folder) => folder.id === selected) ?? null;
	const ancestors = current ? folderAncestors(folders, current.id) : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		ref: railRef,
		className: "folder-rail",
		style: { width },
		"aria-label": "フォルダ",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "folder-pane",
				style: { height: pane },
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "folder-rail-head",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "フォルダ" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							"aria-label": "フォルダをしまう",
							onClick: onToggle,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeftClose, {
								className: "size-4",
								"aria-hidden": "true"
							})
						})]
					}),
					viewer ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: creating ? "folder-create is-naming" : "folder-create",
						children: creating ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
							onSubmit: (event) => {
								event.preventDefault();
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: draft,
								autoFocus: true,
								maxLength: 40,
								"aria-label": "新しいフォルダ名",
								placeholder: "フォルダ名",
								onChange: (event) => setDraft(event.target.value),
								onBlur: () => {
									setDraft("");
									setCreating(false);
								},
								onKeyDown: (event) => {
									if (event.key === "Escape") event.currentTarget.blur();
									if (event.key === "Enter") {
										event.preventDefault();
										const name = draft.trim();
										setDraft("");
										setCreating(false);
										if (name) onCreate(name);
									}
								}
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "quiet",
							onClick: () => {
								setCreating(true);
								setDraft("");
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderPlus, {
								className: "size-4",
								"aria-hidden": "true"
							}), "作成"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							className: "folder-paste whitespace-normal",
							disabled: !copyReady,
							onClick: onPaste,
							children: "コピーフォルダ貼りつけ"
						})] })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "folder-scroll",
						ref: listRef,
						children: [
							current ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "folder-path",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: [...ancestors, current].map((folder) => folder.name).join(" / ") })
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: selected === "all" ? "folder-row is-current" : "folder-row",
								"aria-current": selected === "all",
								onClick: () => onSelect("all"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "folder-name",
									children: "すべての画像"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "folder-count",
									children: items.length
								})]
							}),
							visibleTree.map(({ folder, depth }) => {
								const available = dragging && ownerFolderId !== folder.id && !folder.isParent;
								const hot = dropFolderId === folder.id && !folder.isParent;
								const nesting = nestId === folder.id;
								const className = [
									"folder-row",
									selected === folder.id ? "is-current" : "",
									available ? "is-available" : "",
									hot ? "is-drop" : "",
									nesting ? "is-nest" : "",
									folder.isParent ? "is-parent" : ""
								].filter(Boolean).join(" ");
								const childCount = folderChildren(folders, folder.id).length;
								const owner = [...folderAncestors(folders, folder.id)].reverse().find((entry) => entry.isParent);
								const lineColor = folder.isParent ? folder.color : owner?.color ?? null;
								const lineClass = [
									"folder-line",
									dragId === folder.id ? "is-ghost" : "",
									beforeId === folder.id ? "is-before" : "",
									afterId === folder.id ? "is-after" : "",
									folder.isParent ? "is-parent" : "",
									!folder.isParent && lineColor ? "is-child" : ""
								].filter(Boolean).join(" ");
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: lineClass,
									style: {
										marginLeft: `${depth * 1.05}rem`,
										["--folder-color"]: lineColor ?? void 0
									},
									children: [editing === folder.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
										className: "folder-create",
										onSubmit: (event) => {
											event.preventDefault();
											finishEdit(folder.id, editName, true);
										},
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											value: editName,
											autoFocus: true,
											maxLength: 40,
											"aria-label": `${folder.name}の名前`,
											onChange: (event) => setEditName(event.target.value),
											onBlur: () => finishEdit(folder.id, editName, false),
											onKeyDown: (event) => {
												if (event.key === "Escape") {
													commitRef.current = true;
													editingRef.current = false;
													setEditing(null);
												}
											}
										})
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className,
										"data-folder-id": folder.id,
										"aria-current": selected === folder.id,
										"aria-expanded": childCount > 0 ? expanded.has(folder.id) : void 0,
										onPointerDown: (event) => startFolderDrag(event, folder),
										onDoubleClick: () => {
											if (!viewer) startEdit(folder);
										},
										onClick: () => {
											if (draggedRef.current) {
												draggedRef.current = false;
												return;
											}
											if (dragId) return;
											onSelect(folder.id);
											if (childCount > 0) setExpanded((current) => {
												const next = new Set(current);
												if (next.has(folder.id)) next.delete(folder.id);
												else next.add(folder.id);
												return next;
											});
										},
										children: [
											childCount > 0 ? expanded.has(folder.id) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, {
												className: "folder-twist",
												"aria-hidden": "true"
											}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {
												className: "folder-twist",
												"aria-hidden": "true"
											}) : null,
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "folder-name",
												children: folder.name
											}),
											hot && dropCount > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "folder-move-count",
												children: [dropCount, "枚を移動"]
											}) : null,
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "folder-count",
												children: count(folder)
											})
										]
									}), viewer ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "folder-ops",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "folder-op",
											"aria-label": `${folder.name}をコピー`,
											onPointerDown: (event) => event.stopPropagation(),
											onClick: () => onCopy(folder.id),
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { "aria-hidden": "true" })
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "folder-op",
											"data-spot-trigger": "",
											"aria-label": `${folder.name}を削除`,
											"aria-expanded": pendingDelete?.id === folder.id,
											onPointerDown: (event) => event.stopPropagation(),
											onClick: (event) => {
												const extra = childCount > 0 ? "中の子フォルダと、その中の画像・動画もまとめて削除されます。" : "このフォルダの中の画像・動画も削除されます。";
												setPendingDelete({
													id: folder.id,
													name: folder.name,
													rect: event.currentTarget.getBoundingClientRect(),
													body: `「${folder.name}」を削除しますか？${extra}他のフォルダの内容は残ります。元に戻せません。`
												});
											},
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { "aria-hidden": "true" })
										})]
									})]
								}, folder.id);
							}),
							dragId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: rootDrop ? "folder-root-drop is-hot" : "folder-root-drop",
								"data-root-drop": "true",
								children: "最上位の末尾"
							}) : null
						]
					})
				]
			}),
			viewer ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pane-split",
				role: "separator",
				"aria-orientation": "horizontal",
				"aria-label": "ファイル一覧の高さ",
				onPointerDown: (event) => {
					const rail = railRef.current?.getBoundingClientRect().height ?? 0;
					const startY = event.clientY;
					const startH = pane;
					const move = (pointer) => {
						const next = Math.min(Math.max(140, startH + pointer.clientY - startY), Math.max(140, rail - 160));
						setDragPane(next);
					};
					const finish = (pointer) => {
						window.removeEventListener("pointermove", move);
						window.removeEventListener("pointerup", finish);
						const next = Math.min(Math.max(140, startH + pointer.clientY - startY), Math.max(140, rail - 160));
						setDragPane(null);
						onPane(next);
					};
					window.addEventListener("pointermove", move);
					window.addEventListener("pointerup", finish);
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDock, {
				items: selected === "all" ? items : items.filter((item) => item.folderId === selected),
				onJump,
				viewer
			}),
			pendingDelete ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpotConfirm, {
				anchor: pendingDelete.rect,
				side: "below",
				title: `「${pendingDelete.name}」の削除`,
				body: pendingDelete.body,
				confirmLabel: "削除",
				onCancel: () => setPendingDelete(null),
				onConfirm: () => {
					const id = pendingDelete.id;
					setPendingDelete(null);
					onDelete(id);
				}
			}) : null
		]
	});
}
/** A read that stays pending this long is treated as a failed attempt. */
var SHOT_TIMEOUT_MS = 8e3;
function shotRetryDelay(attempt) {
	return 400 * Math.max(1, attempt);
}
/** Missing bytes are not retried. Transient reads stop after SHOT_ATTEMPTS. */
function shotAfterFailure(attempt, kind) {
	if (kind === "missing") return "missing";
	if (attempt >= 3) return "error";
	return "retry";
}
var tagDragId = null;
function beginTagDrag(id) {
	tagDragId = id;
}
function endTagDrag() {
	tagDragId = null;
}
function currentTagDrag() {
	return tagDragId;
}
/** Custom drag types are hidden during dragover in some browsers. The in-memory id covers that. */
function eventIsTagDrag(types) {
	if (tagDragId) return true;
	if (!types) return false;
	return Array.from(types).includes(TAG_DRAG);
}
function menuFit(width, height) {
	if (width < 96 || height < 72) return "tiny";
	if (width < 150 || height < 110) return "compact";
	return "full";
}
function ShotName({ name, active, className = "" }) {
	const ref = (0, import_react.useRef)(null);
	const [overflow, setOverflow] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		const node = ref.current;
		if (!node || !active) {
			setOverflow(0);
			return;
		}
		const shift = node.scrollWidth - (node.parentElement?.clientWidth ?? 0);
		setOverflow(shift > 4 ? shift : 0);
	}, [name, active]);
	const scrolling = active && overflow > 0;
	const duration = scrolling ? overflow / 28 / .7 : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: className ? `shot-name-view ${className}` : "shot-name-view",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			ref,
			className: scrolling ? "shot-name is-scrolling" : "shot-name",
			style: scrolling ? {
				["--marquee-shift"]: `${overflow}px`,
				["--marquee-duration"]: `${duration}s`
			} : void 0,
			children: name
		})
	});
}
function isTagDrag(event) {
	return eventIsTagDrag(event.dataTransfer.types);
}
function ImageCard({ item, box, tags, dragging, insertEdge, onOpen, onDragStart, flash, fading, origin = "", selected, bulk, onToggleSelect, onFavorite, onDelete, onMemo, onAssignTag, onTagPrompt, viewer = false }) {
	const frameRef = (0, import_react.useRef)(null);
	const rootRef = (0, import_react.useRef)(null);
	const mediaRef = (0, import_react.useRef)(null);
	const reportRef = (0, import_react.useRef)(null);
	const suppressClick = (0, import_react.useRef)(false);
	const memoRef = (0, import_react.useRef)(null);
	const [memoOpen, setMemoOpen] = (0, import_react.useState)(false);
	const [draft, setDraft] = (0, import_react.useState)("");
	const pixelKey = item.animated ? `${item.id}:motion` : item.id;
	const [url, setUrl] = (0, import_react.useState)(() => peekThumb(pixelKey));
	const [status, setStatus] = (0, import_react.useState)("loading");
	const [retryNonce, setRetryNonce] = (0, import_react.useState)(0);
	const [hover, setHover] = (0, import_react.useState)(false);
	const [pinned, setPinned] = (0, import_react.useState)(false);
	const [tagHot, setTagHot] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!pinned) return;
		const close = (event) => {
			const root = rootRef.current;
			if (!root || root.contains(event.target)) return;
			setPinned(false);
		};
		window.addEventListener("pointerdown", close);
		return () => window.removeEventListener("pointerdown", close);
	}, [pinned]);
	(0, import_react.useEffect)(() => {
		const frame = frameRef.current;
		if (!frame) return;
		let alive = true;
		let visible = false;
		let running = false;
		let ready = false;
		let gaveUp = false;
		let failing = false;
		let attempt = 0;
		let token = 0;
		let useOriginal = item.animated;
		let unpin = null;
		let retryTimer = 0;
		let timeoutTimer = 0;
		let hideTimer = 0;
		let releaseTimer = 0;
		const retain = () => {
			if (!unpin) unpin = pinThumb(pixelKey);
		};
		const stopTimers = () => {
			window.clearTimeout(retryTimer);
			window.clearTimeout(timeoutTimer);
		};
		const fail = (kind) => {
			if (!alive || failing) return;
			failing = true;
			running = false;
			ready = false;
			token += 1;
			stopTimers();
			setUrl(null);
			invalidateThumb(pixelKey);
			attempt += 1;
			const plan = shotAfterFailure(attempt, kind);
			if (plan === "missing") {
				gaveUp = true;
				setStatus("missing");
				return;
			}
			if (plan === "error") {
				gaveUp = true;
				setStatus("error");
				return;
			}
			setStatus("loading");
			retryTimer = window.setTimeout(() => {
				failing = false;
				start();
			}, shotRetryDelay(attempt));
		};
		const start = () => {
			if (!alive || !visible || running || gaveUp) return;
			const known = peekThumb(pixelKey);
			if (known && attempt === 0 && !useOriginal) {
				if (running) return;
				running = true;
				retain();
				failing = false;
				setUrl(known);
				setStatus(ready ? "ready" : "loading");
				if (!ready) {
					const my = ++token;
					window.clearTimeout(timeoutTimer);
					timeoutTimer = window.setTimeout(() => {
						if (!alive || my !== token) return;
						running = false;
						fail("transient");
					}, SHOT_TIMEOUT_MS);
				}
				return;
			}
			running = true;
			failing = false;
			setStatus("loading");
			const my = ++token;
			window.clearTimeout(timeoutTimer);
			timeoutTimer = window.setTimeout(() => {
				if (!alive || my !== token) return;
				running = false;
				fail("transient");
			}, SHOT_TIMEOUT_MS);
			const kind = useOriginal ? "original" : "thumb";
			loadThumb(pixelKey, async () => {
				const blob = await readPixels(item.id, kind);
				if (!blob || blob.size <= 0) return null;
				return blob;
			}).then((next) => {
				if (!alive || my !== token) return;
				window.clearTimeout(timeoutTimer);
				running = false;
				retain();
				setUrl(next);
				setStatus("loading");
			}).catch((error) => {
				if (!alive || my !== token) return;
				window.clearTimeout(timeoutTimer);
				running = false;
				const missing = error instanceof Error && error.message === "missing-thumb";
				fail(missing ? "missing" : "transient");
			});
		};
		reportRef.current = {
			loaded(width, height) {
				if (!alive) return;
				if (width > 0 && height > 0) {
					ready = true;
					gaveUp = false;
					failing = false;
					running = false;
					attempt = 0;
					stopTimers();
					setStatus("ready");
					return;
				}
				if (!item.animated && !useOriginal) {
					useOriginal = true;
					token += 1;
					running = false;
					failing = true;
					stopTimers();
					setUrl(null);
					invalidateThumb(pixelKey);
					failing = false;
					start();
					return;
				}
				fail("transient");
			},
			failed() {
				if (!alive || !visible) return;
				if (!item.animated && !useOriginal) {
					useOriginal = true;
					token += 1;
					running = false;
					failing = true;
					stopTimers();
					setUrl(null);
					invalidateThumb(pixelKey);
					failing = false;
					start();
					return;
				}
				fail("transient");
			}
		};
		const show = () => {
			visible = true;
			window.clearTimeout(hideTimer);
			window.clearTimeout(releaseTimer);
			retain();
			const known = peekThumb(pixelKey);
			if (ready && known) {
				setUrl(known);
				setStatus("ready");
				return;
			}
			if (gaveUp) return;
			if (ready && !known) ready = false;
			start();
		};
		const hide = () => {
			visible = false;
			token += 1;
			running = false;
			failing = false;
			stopTimers();
			window.clearTimeout(hideTimer);
			hideTimer = window.setTimeout(() => {
				if (!alive || visible) return;
				setUrl(null);
				window.clearTimeout(releaseTimer);
				releaseTimer = window.setTimeout(() => {
					unpin?.();
					unpin = null;
				}, 2e3);
			}, 250);
		};
		const onVisible = () => {
			if (document.visibilityState !== "visible" || !visible) return;
			const known = peekThumb(pixelKey);
			if (ready && known) {
				setUrl(known);
				return;
			}
			gaveUp = false;
			attempt = 0;
			failing = false;
			ready = false;
			start();
		};
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) {
				if (!visible) {
					gaveUp = false;
					attempt = 0;
					failing = false;
				}
				show();
			} else hide();
		}, { rootMargin: "480px 0px" });
		observer.observe(frame);
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			alive = false;
			token += 1;
			reportRef.current = null;
			stopTimers();
			window.clearTimeout(hideTimer);
			window.clearTimeout(releaseTimer);
			observer.disconnect();
			document.removeEventListener("visibilitychange", onVisible);
			unpin?.();
		};
	}, [
		item.animated,
		item.id,
		pixelKey,
		retryNonce
	]);
	(0, import_react.useEffect)(() => {
		const node = mediaRef.current;
		if (!node || !url) return;
		if (node instanceof HTMLImageElement && node.complete) reportRef.current?.loaded(node.naturalWidth, node.naturalHeight);
		if (node instanceof HTMLVideoElement && node.readyState >= 1) reportRef.current?.loaded(node.videoWidth, node.videoHeight);
	}, [url]);
	const menu = hover || pinned || memoOpen;
	const fit = menuFit(box.w, box.h);
	(0, import_react.useEffect)(() => {
		if (!memoOpen) return;
		const block = (event) => {
			const target = event.target;
			if (memoRef.current?.contains(target)) return;
			event.preventDefault();
			event.stopPropagation();
			setMemoOpen(false);
		};
		document.addEventListener("pointerdown", block, true);
		return () => document.removeEventListener("pointerdown", block, true);
	}, [memoOpen]);
	const finishMemo = () => {
		const action = commitMemo(item.memo, draft);
		setMemoOpen(false);
		if (action === "cancel") return;
		onMemo(item.id, action === "clear" ? "" : draft);
	};
	const onPointerDown = (event) => {
		if (event.button !== 0) return;
		if (event.target?.closest(".shot-menu button, .shot-menu a, .shot-menu input, .shot-menu textarea")) return;
		const startX = event.clientX;
		const startY = event.clientY;
		const pointerId = event.pointerId;
		let started = false;
		const move = (pointer) => {
			if (pointer.pointerId !== pointerId || started) return;
			const dx = pointer.clientX - startX;
			const dy = pointer.clientY - startY;
			if (dx * dx + dy * dy < 36) return;
			if (viewer) {
				suppressClick.current = true;
				return;
			}
			started = true;
			suppressClick.current = true;
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", end);
			window.removeEventListener("pointercancel", end);
			onDragStart(item.id, pointer);
		};
		const end = (pointer) => {
			if (pointer.pointerId !== pointerId) return;
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", end);
			window.removeEventListener("pointercancel", end);
			if (!suppressClick.current) return;
			window.setTimeout(() => {
				suppressClick.current = false;
			}, 0);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", end);
		window.addEventListener("pointercancel", end);
	};
	const className = [
		"shot-card",
		dragging ? "is-dragging" : "",
		selected ? "is-selected" : "",
		tagHot ? "is-tag-hot" : "",
		menu ? "is-menu" : "",
		flash ? "is-flash" : "",
		flash && fading ? "is-fade" : ""
	].filter(Boolean).join(" ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		ref: rootRef,
		"data-shot-id": item.id,
		"data-fit": fit,
		className,
		style: {
			left: box.x,
			top: box.y,
			width: box.w,
			height: box.h
		},
		onPointerDown,
		onPointerEnter: (event) => {
			if (event.pointerType === "mouse") setHover(true);
		},
		onPointerLeave: (event) => {
			if (event.pointerType === "mouse") setHover(false);
		},
		onFocus: () => setHover(true),
		onBlur: (event) => {
			if (!event.currentTarget.contains(event.relatedTarget)) setHover(false);
		},
		onDragOver: (event) => {
			if (viewer || !isTagDrag(event)) return;
			event.preventDefault();
			event.stopPropagation();
			event.dataTransfer.dropEffect = "copy";
			setTagHot(true);
		},
		onDragLeave: (event) => {
			if (!event.currentTarget.contains(event.relatedTarget)) setTagHot(false);
		},
		onDrop: (event) => {
			if (viewer || !isTagDrag(event)) return;
			event.preventDefault();
			event.stopPropagation();
			setTagHot(false);
			const tagId = event.dataTransfer.getData("application/x-komacho-tag") || currentTagDrag();
			if (tagId) onAssignTag(item.id, tagId);
		},
		children: [
			insertEdge ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: insertEdge === "before" ? "shot-edge is-before" : "shot-edge is-after" }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "shot-hit",
				"aria-label": `${item.name}を拡大`,
				"aria-expanded": viewer ? void 0 : menu,
				onClick: (event) => {
					if (suppressClick.current) {
						suppressClick.current = false;
						event.preventDefault();
						return;
					}
					if (viewer) {
						onOpen(item.id);
						return;
					}
					if (event.metaKey || event.ctrlKey) {
						onToggleSelect(item.id);
						return;
					}
					if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) onOpen(item.id);
					else if (pinned) onOpen(item.id);
					else setPinned(true);
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					ref: frameRef,
					className: "shot-frame",
					children: [origin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "shot-origin",
						children: origin
					}) : null, url && item.mime.startsWith("video/") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
						ref: (node) => {
							mediaRef.current = node;
						},
						src: url,
						muted: true,
						loop: true,
						autoPlay: true,
						playsInline: true,
						width: item.width,
						height: item.height,
						draggable: false,
						onLoadedData: (event) => reportRef.current?.loaded(event.currentTarget.videoWidth, event.currentTarget.videoHeight),
						onError: () => reportRef.current?.failed()
					}) : url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
						ref: (node) => {
							mediaRef.current = node;
						},
						src: url,
						alt: "",
						width: item.width,
						height: item.height,
						decoding: "async",
						draggable: false,
						onLoad: (event) => reportRef.current?.loaded(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight),
						onError: () => reportRef.current?.failed()
					}) : null]
				})
			}),
			status === "error" || status === "missing" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "shot-fail",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: status === "missing" ? "画像データがありません" : "読み込めませんでした" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "shot-retry",
					onPointerDown: (event) => event.stopPropagation(),
					onClick: (event) => {
						event.stopPropagation();
						setStatus("loading");
						setRetryNonce((current) => current + 1);
					},
					children: "再試行"
				})]
			}) : null,
			viewer ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "shot-menu",
				"aria-hidden": !menu,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShotName, {
						name: item.name,
						active: menu
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "shot-meta",
						children: [
							item.width,
							" × ",
							item.height
						]
					}),
					item.memo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShotName, {
						name: item.memo,
						active: menu,
						className: "shot-menu-memo"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "shot-actions",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: selected ? "shot-icon is-selected" : "shot-icon",
								"aria-label": selected ? `${item.name}の選択を解除` : `${item.name}を選択`,
								"aria-pressed": selected,
								onPointerDown: (event) => event.stopPropagation(),
								onClick: () => onToggleSelect(item.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { "aria-hidden": "true" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: item.favorite ? "shot-icon is-favorite" : "shot-icon",
								"aria-label": bulk && selected ? "選択中の画像をすべてお気に入りにする" : item.favorite ? `${item.name}のお気に入りを解除` : `${item.name}をお気に入りに追加`,
								"aria-pressed": item.favorite,
								onPointerDown: (event) => event.stopPropagation(),
								onClick: () => onFavorite(item.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, {
									"aria-hidden": "true",
									fill: item.favorite ? "currentColor" : "none"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "shot-icon",
								"aria-label": bulk && selected ? "選択中の画像を削除" : `${item.name}を削除`,
								onPointerDown: (event) => event.stopPropagation(),
								onClick: () => onDelete(item.id),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { "aria-hidden": "true" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "shot-icon shot-memo",
								"aria-label": `${item.name}のメモ`,
								onPointerDown: (event) => event.stopPropagation(),
								onClick: (event) => {
									event.stopPropagation();
									setDraft(item.memo);
									setMemoOpen(true);
								},
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, { "aria-hidden": "true" })
							})
						]
					}),
					memoOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
						ref: memoRef,
						className: "shot-memo-pop",
						onSubmit: (event) => event.preventDefault(),
						onPointerDown: (event) => event.stopPropagation(),
						onClick: (event) => event.stopPropagation(),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							"aria-label": "メモ",
							value: draft,
							maxLength: 100,
							autoFocus: true,
							onChange: (event) => setDraft(event.target.value),
							onKeyDown: (event) => {
								event.stopPropagation();
								if (event.key === "Escape") {
									event.preventDefault();
									setMemoOpen(false);
								}
								if (event.key === "Enter") {
									event.preventDefault();
									finishMemo();
								}
							}
						})
					}) : null,
					tags.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "shot-tags",
						children: tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "shot-tag",
							style: { background: tag.color },
							onPointerDown: (event) => event.stopPropagation(),
							onClick: (event) => event.stopPropagation(),
							onDoubleClick: (event) => {
								event.preventDefault();
								event.stopPropagation();
								onTagPrompt(item.id, tag.id, event.currentTarget.getBoundingClientRect());
							},
							children: tag.name
						}, tag.id))
					}) : null
				]
			})
		]
	});
}
var LAN_PORT = 17331;
var HOST_KEY = "komacho-lan-base";
var TOKEN_KEY = "komacho-lan-token";
function ipv4Parts(host) {
	const parts = host.split(".").map((part) => Number(part));
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
	return parts;
}
function isPrivateHostname(host) {
	const name = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
	if (name === "localhost" || name.endsWith(".local")) return true;
	if (name.includes(":")) return name === "::1" || name.startsWith("fe80:") || name.startsWith("fc") || name.startsWith("fd");
	const parts = ipv4Parts(name);
	if (!parts) return false;
	const [a, b] = parts;
	if (a === 10 || a === 127) return true;
	if (a === 192 && b === 168) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 169 && b === 254) return true;
	return false;
}
function parseSyncBase(input) {
	const trimmed = input.trim();
	if (!trimmed) throw new Error("PCのアドレスを入力してください。");
	const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
	if (withScheme.toLowerCase().startsWith("https://")) throw new Error("同期サーバーは http です。https では接続できません。");
	let url;
	try {
		url = new URL(withScheme);
	} catch {
		throw new Error("アドレスの形式が正しくありません。");
	}
	if (!isPrivateHostname(url.hostname)) throw new Error("自宅のLANアドレスだけを受け付けます。インターネット上のアドレスには接続しません。");
	if (url.pathname !== "/" || url.search || url.hash) throw new Error("アドレスは http://192.168.x.x:17331 の形にしてください。");
	const port = url.port ? Number(url.port) : LAN_PORT;
	if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("ポート番号が正しくありません。");
	const host = url.hostname.includes(":") ? `[${url.hostname}]` : url.hostname;
	const space = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" ? "loopback" : "local";
	return {
		url: `http://${host}:${port}`,
		space
	};
}
function rememberSyncTarget(base, token) {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(HOST_KEY, base);
	localStorage.setItem(TOKEN_KEY, token);
}
function rememberedSyncTarget() {
	if (typeof localStorage === "undefined") return {
		base: "",
		token: ""
	};
	return {
		base: localStorage.getItem(HOST_KEY) ?? "",
		token: localStorage.getItem(TOKEN_KEY) ?? ""
	};
}
function lanErrorMessage(error, status) {
	if (status === 401) return "合言葉が違います。データは変更していません。";
	if (status === 403) return "この端末からは接続できません。データは変更していません。";
	if (status === 404) return "PCからまだデータが送られていません。データは変更していません。";
	if (status === 413) return "データが大きすぎて送れませんでした。保存データは変更していません。";
	if (error instanceof Error && error.message && !/failed to fetch|networkerror|load failed/i.test(error.message)) return error.message;
	return "接続できませんでした。同期サーバーが起動しているか、同じWi-Fiか、ブラウザがローカルネットワークへの接続を止めていないかを確認してください。データは変更していません。";
}
async function lanFetch(base, path, init = {}) {
	const headers = new Headers();
	if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
	if (init.body) headers.set("Content-Type", "application/octet-stream");
	const request = {
		method: init.method ?? "GET",
		mode: "cors",
		headers,
		body: init.body ?? void 0,
		signal: init.signal,
		targetAddressSpace: base.space
	};
	try {
		return await fetch(`${base.url}${path}`, request);
	} catch (error) {
		throw new Error(lanErrorMessage(error));
	}
}
async function readJson(response) {
	if (!response.ok) throw new Error(lanErrorMessage(/* @__PURE__ */ new Error("sync"), response.status));
	return response.json();
}
function LanSyncDialog({ open, onOpenChange }) {
	const [session, setSession] = (0, import_react.useState)(null);
	const [pcNote, setPcNote] = (0, import_react.useState)("");
	const [phoneBase, setPhoneBase] = (0, import_react.useState)("");
	const [phoneToken, setPhoneToken] = (0, import_react.useState)("");
	const [phoneNote, setPhoneNote] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [confirm, setConfirm] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const remembered = rememberedSyncTarget();
		setPhoneBase((current) => current || remembered.base);
		setPhoneToken((current) => current || remembered.token);
		let cancelled = false;
		setPcNote("同期サーバーを確認しています…");
		lanFetch(parseSyncBase("127.0.0.1"), "/session").then((response) => readJson(response)).then((next) => {
			if (cancelled) return;
			setSession(next);
			setPcNote(next.hasSnapshot ? "PCのデータを受け付けています。" : "サーバーは起動しています。まだデータは送られていません。");
		}).catch((error) => {
			if (cancelled) return;
			setSession(null);
			setPcNote(error instanceof Error ? error.message : "同期サーバーが起動していません。");
		});
		return () => {
			cancelled = true;
		};
	}, [open]);
	const sendSnapshot = async () => {
		setBusy(true);
		setPcNote("保存データを読み出しています…");
		try {
			const base = parseSyncBase("127.0.0.1");
			const current = session ?? await readJson(await lanFetch(base, "/session"));
			const dump = await readLibraryDump((done, total) => setPcNote(`画像を読み出しています ${done}/${total}`));
			setPcNote("同期サーバーへ送っています…");
			const { file, summary } = buildBackup(dump);
			await readJson(await lanFetch(base, "/snapshot", {
				method: "POST",
				token: current.token,
				body: file
			}));
			setSession({
				...current,
				hasSnapshot: true,
				bytes: file.size,
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			});
			setPcNote(`送りました。画像${summary.images}枚、フォルダ${summary.folders}、タグ${summary.tags}です。スマホへはまだ反映していません。`);
		} catch (error) {
			setPcNote(error instanceof Error ? error.message : lanErrorMessage(error));
		} finally {
			setBusy(false);
		}
	};
	const pullSnapshot = async () => {
		setBusy(true);
		setConfirm(null);
		setPhoneNote("PCへ接続しています…");
		try {
			const base = parseSyncBase(phoneBase);
			const token = phoneToken.trim();
			if (!token) throw new Error("合言葉を入力してください。");
			rememberSyncTarget(base.url, token);
			if (!(await readJson(await lanFetch(base, "/health"))).hasSnapshot) throw new Error(lanErrorMessage(/* @__PURE__ */ new Error("empty"), 404));
			setPhoneNote("データを受け取っています…");
			const response = await lanFetch(base, "/snapshot", { token });
			if (!response.ok) throw new Error(lanErrorMessage(/* @__PURE__ */ new Error("snapshot"), response.status));
			const parsed = await readBackup(await response.blob());
			setConfirm(parsed);
			setPhoneNote("内容を確認しました。置き換えるまで、この端末のデータは変更していません。");
		} catch (error) {
			setPhoneNote(error instanceof Error ? error.message : lanErrorMessage(error));
		} finally {
			setBusy(false);
		}
	};
	const applySnapshot = async () => {
		if (!confirm) return;
		setBusy(true);
		setPhoneNote("置き換えています…");
		try {
			await replaceLibrary(confirm);
			const { summary } = confirm;
			sessionStorage.setItem("komacho-restored", `PCのデータを受け取りました。画像${summary.images}枚、フォルダ${summary.folders}、タグ${summary.tags}、お気に入り${summary.favorites}です。`);
			window.location.reload();
		} catch {
			setPhoneNote("置き換えに失敗しました。この端末のデータは変更していません。");
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (next) => !busy && onOpenChange(next),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "sheet-overlay" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "storage-sheet",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-b border-line px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
						className: "font-medium",
						children: "LAN同期"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
						className: "text-sm text-ink-muted",
						children: "自宅PCからスマホへ、同じWi-Fiの中だけで送ります。スマホ側の変更はPCへ戻りません。"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4 px-4 py-4 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-ink-muted",
							children: "公開ページから自宅PCへ接続します。Chromeではローカルネットワークの許可が出ます。iPhoneのSafariでは拒否されることがあり、その場合はデータは変わりません。拒否されたときは、アドレスのうしろに /snapshot.kmb?token=合言葉 を付けて直接開くとファイルを保存できます。そのファイルは「復元」から読み込めます。"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-medium",
									children: "このPCを同期元にする"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: pcNote }),
								session ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
									className: "grid grid-cols-[6rem_1fr] gap-y-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-ink-muted",
											children: "アドレス"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "break-all",
											children: session.urls.join("、") || "LANの住所がまだありません"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
											className: "text-ink-muted",
											children: "合言葉"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
											className: "break-all font-medium",
											children: session.token
										})
									]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
									"PCに",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										className: "mx-1 underline",
										href: "/lan-sync-server.mjs",
										download: "lan-sync-server.mjs",
										children: "サーバー"
									}),
									"と",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										className: "mx-1 underline",
										href: "/start-lan-sync.bat",
										download: "start-lan-sync.bat",
										children: "起動ファイル"
									}),
									"を同じフォルダへ保存し、起動ファイルをダブルクリックします。Node.js が無い場合は https://nodejs.org の LTS を入れてから、もう一度起動します。"
								] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									disabled: busy || !session,
									onClick: () => void sendSnapshot(),
									children: "今のデータを送る"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-medium",
									children: "スマホで受け取る"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-ink-muted",
										children: "PCのアドレス"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "mt-1 w-full rounded-md border border-line bg-paper px-2 py-1",
										value: phoneBase,
										placeholder: "http://192.168.1.20:17331",
										onChange: (event) => setPhoneBase(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-ink-muted",
										children: "合言葉"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "mt-1 w-full rounded-md border border-line bg-paper px-2 py-1",
										value: phoneToken,
										onChange: (event) => setPhoneToken(event.target.value)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: phoneNote }),
								confirm ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
									"画像",
									confirm.summary.images,
									"枚、フォルダ",
									confirm.summary.folders,
									"、タグ",
									confirm.summary.tags,
									"、お気に入り",
									confirm.summary.favorites,
									"。この端末の保存データは、PCの内容に置き換わります。"
								] }) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "quiet",
										disabled: busy,
										onClick: () => void pullSnapshot(),
										children: "データを確認"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										disabled: busy || !confirm,
										onClick: () => void applySnapshot(),
										children: "置き換える"
									})]
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-end border-t border-line px-4 py-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							disabled: busy,
							children: "閉じる"
						})
					})
				})
			]
		})] })
	});
}
/** How far a pinch may shrink past the fitted size before it resists. */
var PINCH_MIN = .45;
var IDENTITY_ZOOM = {
	scale: 1,
	x: 0,
	y: 0
};
var DRAG_REST = {
	x: 0,
	y: 0
};
function freshGesture() {
	return {
		pointers: [],
		mode: "idle",
		startZoom: IDENTITY_ZOOM,
		origin: {
			x: 0,
			y: 0
		},
		startMid: {
			x: 0,
			y: 0
		},
		startDist: 0,
		pinched: false,
		pinchFitted: null,
		lastTap: null,
		dragAxis: null,
		held: DRAG_REST,
		samples: [],
		edge: null
	};
}
function isZoomed(zoom) {
	return zoom.scale > 1.001;
}
function clampScale(scale) {
	return clampRange(scale, 1, 4);
}
function clampRange(scale, min, max) {
	if (!Number.isFinite(scale)) return min;
	return Math.min(max, Math.max(min, scale));
}
function isUnderFitted(scale) {
	return scale < .999;
}
/** Keep a live pinch. Close only if it began fitted and the fingers leave it under fitted size. */
function pinchRelease(startedFitted, scale) {
	if (!isUnderFitted(scale)) return "keep";
	return startedFitted ? "close" : "fit";
}
function visualRect(base, zoom) {
	const width = base.width * zoom.scale;
	const height = base.height * zoom.scale;
	const cx = base.left + base.width / 2 + zoom.x;
	const cy = base.top + base.height / 2 + zoom.y;
	return {
		left: cx - width / 2,
		top: cy - height / 2,
		width,
		height
	};
}
function clampPan(origin, baseSize, size, stageSize, pan) {
	if (size <= stageSize + .5) return 0;
	const center = origin + baseSize / 2;
	const at = (edge) => edge + size / 2 - center;
	const low = Math.min(at(0), at(stageSize - size));
	const high = Math.max(at(0), at(stageSize - size));
	return Math.min(high, Math.max(low, pan));
}
/** Keeps a zoomed image from sliding entirely off the stage. Scale 1 stays on the fitted frame. */
function clampZoom(base, stage, zoom) {
	const scale = clampScale(zoom.scale);
	const width = base.width * scale;
	const height = base.height * scale;
	return {
		scale,
		x: clampPan(base.left, base.width, width, stage.width, Number.isFinite(zoom.x) ? zoom.x : 0),
		y: clampPan(base.top, base.height, height, stage.height, Number.isFinite(zoom.y) ? zoom.y : 0)
	};
}
/** Changes scale while keeping the image point under `focal` in place. */
function zoomAround(base, zoom, nextScale, focal, minScale = 1) {
	const scale = clampRange(nextScale, minScale, 4);
	const rect = visualRect(base, zoom);
	if (rect.width <= 0 || rect.height <= 0) return {
		scale,
		x: zoom.x,
		y: zoom.y
	};
	const fx = (focal.x - rect.left) / rect.width;
	const fy = (focal.y - rect.top) / rect.height;
	const width = base.width * scale;
	const height = base.height * scale;
	const left = focal.x - fx * width;
	const top = focal.y - fy * height;
	return {
		scale,
		x: left + width / 2 - (base.left + base.width / 2),
		y: top + height / 2 - (base.top + base.height / 2)
	};
}
function pinchTo(base, stage, start, startMid, currentMid, startDist, currentDist) {
	const ratio = startDist > 0 ? currentDist / startDist : 1;
	const scaled = zoomAround(base, start, start.scale * ratio, startMid, PINCH_MIN);
	return clampPinchZoom(base, stage, {
		scale: scaled.scale,
		x: scaled.x + (currentMid.x - startMid.x),
		y: scaled.y + (currentMid.y - startMid.y)
	});
}
/** Fitted and larger pinches use the normal frame. Below fitted, the image may shrink but stays nearby. */
function clampPinchZoom(base, stage, zoom) {
	const scale = clampRange(zoom.scale, PINCH_MIN, 4);
	if (!isUnderFitted(scale)) return clampZoom(base, stage, {
		...zoom,
		scale
	});
	const width = base.width * scale;
	const height = base.height * scale;
	const limitX = stage.width / 2 + width / 2;
	const limitY = stage.height / 2 + height / 2;
	return {
		scale,
		x: Math.min(limitX, Math.max(-limitX, Number.isFinite(zoom.x) ? zoom.x : 0)),
		y: Math.min(limitY, Math.max(-limitY, Number.isFinite(zoom.y) ? zoom.y : 0))
	};
}
/**
* Which edges the image is already against.
* A side the image cannot pan along counts as reached.
*/
function panEdges(base, stage, zoom) {
	const rect = visualRect(base, zoom);
	const narrow = rect.width <= stage.width + 4;
	const short = rect.height <= stage.height + 4;
	return {
		left: narrow || rect.left >= -4,
		right: narrow || rect.left + rect.width <= stage.width + 4,
		top: short || rect.top >= -4
	};
}
/** Pan, then resist once the image is pulled past an edge. */
function panGive(base, stage, start, dx, dy) {
	const raw = {
		scale: start.scale,
		x: start.x + dx,
		y: start.y + dy
	};
	const fitted = clampZoom(base, stage, raw);
	const give = (overflow, span) => Math.abs(overflow) < .5 ? 0 : rubberOffset(overflow, Math.max(span, 1));
	return {
		scale: fitted.scale,
		x: fitted.x + give(raw.x - fitted.x, stage.width),
		y: fitted.y + give(raw.y - fitted.y, stage.height)
	};
}
/** Fitted double-tap grows around the tap. Already-zoomed callers reset instead of calling this. */
function doubleTapZoom(base, stage, focal) {
	return clampZoom(base, stage, zoomAround(base, IDENTITY_ZOOM, 2, focal));
}
function swipeStep(dx, dy, zoomed) {
	if (zoomed) return 0;
	if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.25) return 0;
	return dx < 0 ? 1 : -1;
}
/** Up or down at the fitted size. Diagonal and short moves are neither axis. */
function verticalSwipe(dx, dy, zoomed) {
	if (zoomed) return null;
	if (Math.abs(dy) < 56 || Math.abs(dy) < Math.abs(dx) * 1.25) return null;
	return dy < 0 ? "up" : "down";
}
/** What a finished phone gesture does. A zoomed drag pages only when the gesture already says so. */
function lightboxGestureAction(result, infoOpen, zoomed) {
	if (result.sheet === "down") return infoOpen ? "hide-info" : "close-viewer";
	if (result.sheet === "up") return zoomed || infoOpen ? "none" : "show-info";
	if (zoomed) return result.tap && infoOpen ? "hide-info" : result.step ? "step" : "none";
	if (result.tap) return infoOpen ? "hide-info" : "show-info";
	if (result.step) return "step";
	return "none";
}
/** Info stays up while moving between images, and closes with the viewer. */
function infoOpenForItem(infoOpen, itemId) {
	return infoOpen && itemId !== null;
}
/** A downward swipe dismisses info only when the info list itself did not scroll. */
function infoSheetDismiss(dx, dy, startTop, endTop) {
	if (Math.abs(endTop - startTop) > 2) return false;
	if (startTop > 1) return false;
	return verticalSwipe(dx, dy, false) === "down";
}
/** Horizontal swipe on the info sheet changes images unless that sheet was scrolling. */
function infoSheetStep(dx, dy, startTop, endTop) {
	if (Math.abs(endTop - startTop) > 2) return 0;
	return swipeStep(dx, dy, false);
}
/** 1:1 at the start of a pull, then resistance so the image cannot leave the stage. */
function rubberOffset(delta, span) {
	if (!Number.isFinite(delta) || !Number.isFinite(span) || span <= 0) return 0;
	const sign = Math.sign(delta);
	const abs = Math.abs(delta);
	const linear = span * .22;
	if (abs <= linear) return delta;
	const extra = abs - linear;
	return sign * (linear + span * .46 * (1 - Math.exp(-extra / (span * .5))));
}
function dominantAxis(dx, dy) {
	if (Math.hypot(dx, dy) <= 10) return null;
	if (Math.abs(dx) >= Math.abs(dy) * 1.25) return "x";
	if (Math.abs(dy) >= Math.abs(dx) * 1.25) return "y";
	return null;
}
function slideSpan(width) {
	if (!Number.isFinite(width) || width <= 0) return 0;
	return width * 1;
}
/** Shared track. Positive track brings the previous image in from the left. */
function incomingX(track, width) {
	const span = slideSpan(width);
	const dir = Math.sign(track);
	if (dir === 0 || span === 0) return 0;
	return track - dir * span;
}
function parkedX(dir, width) {
	return -dir * slideSpan(width);
}
/** Black backdrop. 1 at rest, 0 once the image has traveled one stage height downward. */
function scrimForDrag(y, height) {
	if (!Number.isFinite(y) || y <= 0 || !Number.isFinite(height) || height <= 0) return 1;
	return Math.max(0, 1 - y / height);
}
/** Backdrop while pinching. Only a pinch that began at the fitted size fades, and only once it shrinks past fitted. */
function scrimForPinch(startedFitted, scale) {
	if (!startedFitted || !isUnderFitted(scale)) return 1;
	return Math.max(0, Math.min(1, 1 - (1 - scale) / .55));
}
/** Info sheet: horizontal paging may move the photo. A downward pull must not. */
function scrubDrag(drag, infoOpen) {
	if (!infoOpen || drag.y === 0) return drag;
	return {
		x: drag.x,
		y: 0
	};
}
function dragFollow(dx, dy, axis, stage, held = DRAG_REST) {
	if (axis === "x") return {
		x: rubberOffset(held.x + dx, stage.width),
		y: 0
	};
	if (axis === "y") {
		const raw = held.y + dy;
		if (raw <= 0) return DRAG_REST;
		return {
			x: 0,
			y: rubberOffset(raw, stage.height)
		};
	}
	return held;
}
function dragVelocity(samples) {
	if (samples.length < 2) return {
		vx: 0,
		vy: 0
	};
	const last = samples[samples.length - 1];
	let first = null;
	for (let index = samples.length - 2; index >= 0; index -= 1) {
		const sample = samples[index];
		const dt = last.t - sample.t;
		if (dt > 90) break;
		if (dt >= 12) first = sample;
	}
	const origin = first ?? samples[samples.length - 2];
	const dt = last.t - origin.t;
	if (dt < 8) return {
		vx: 0,
		vy: 0
	};
	return {
		vx: (last.x - origin.x) / dt,
		vy: (last.y - origin.y) / dt
	};
}
/**
* Distance commits a slow pull. A flick commits sooner.
* A finger already traveling back toward rest cancels, even past the distance line.
*/
function releaseSwipe(dx, dy, vx, vy, axis, zoomed) {
	if (zoomed || axis === null) return {
		step: 0,
		sheet: null
	};
	const minFlick = 24;
	if (axis === "x") {
		const returning = dx !== 0 && Math.sign(vx) === -Math.sign(dx) && Math.abs(vx) >= .15;
		if (!(!returning && Math.abs(vx) >= .55 && Math.abs(dx) >= minFlick && Math.sign(vx) === Math.sign(dx)) && !(!returning && Math.abs(dx) >= 56)) return {
			step: 0,
			sheet: null
		};
		return {
			step: dx < 0 ? 1 : -1,
			sheet: null
		};
	}
	const returning = dy !== 0 && Math.sign(vy) === -Math.sign(dy) && Math.abs(vy) >= .15;
	if (!(!returning && Math.abs(vy) >= .55 && Math.abs(dy) >= minFlick && Math.sign(vy) === Math.sign(dy)) && !(!returning && Math.abs(dy) >= 56)) return {
		step: 0,
		sheet: null
	};
	return {
		step: 0,
		sheet: dy < 0 ? "up" : "down"
	};
}
function midpoint(a, b) {
	return {
		x: (a.x + b.x) / 2,
		y: (a.y + b.y) / 2
	};
}
function distance(a, b) {
	return Math.hypot(a.x - b.x, a.y - b.y);
}
function idleFrom(gesture, lastTap) {
	return {
		...freshGesture(),
		lastTap
	};
}
function gestureDown(gesture, zoom, id, x, y, held = DRAG_REST, time = 0, edge = null) {
	if (gesture.pointers.some((pointer) => pointer.id === id)) return { gesture };
	const pointers = [...gesture.pointers, {
		id,
		x,
		y
	}];
	if (pointers.length === 1) return { gesture: {
		...gesture,
		pointers,
		mode: "pending",
		startZoom: zoom,
		origin: {
			x,
			y
		},
		startMid: {
			x,
			y
		},
		startDist: 0,
		pinched: false,
		pinchFitted: null,
		dragAxis: null,
		held,
		samples: time > 0 ? [{
			x,
			y,
			t: time
		}] : [],
		edge
	} };
	const a = pointers[0];
	const b = pointers[1];
	const startMid = midpoint(a, b);
	return { gesture: {
		...gesture,
		pointers,
		mode: "pinch",
		startZoom: zoom,
		origin: startMid,
		startMid,
		startDist: distance(a, b),
		pinched: true,
		pinchFitted: gesture.pinchFitted ?? !isZoomed(zoom)
	} };
}
function gestureMove(gesture, id, x, y, layout, time = 0) {
	if (!gesture.pointers.some((pointer) => pointer.id === id)) return { gesture };
	const pointers = gesture.pointers.map((pointer) => pointer.id === id ? {
		id,
		x,
		y
	} : pointer);
	let next = {
		...gesture,
		pointers,
		samples: time > 0 ? gesture.samples.concat([{
			x,
			y,
			t: time
		}]).slice(-6) : gesture.samples
	};
	if (next.mode === "pinch" || pointers.length >= 2) {
		const a = pointers[0];
		const b = pointers[1];
		next = {
			...next,
			mode: "pinch",
			pinched: true,
			dragAxis: null
		};
		if (!layout || !b) return {
			gesture: next,
			drag: DRAG_REST
		};
		return {
			gesture: next,
			zoom: pinchTo(layout.base, layout.stage, next.startZoom, next.startMid, midpoint(a, b), next.startDist, distance(a, b)),
			drag: DRAG_REST
		};
	}
	const point = pointers[0];
	const dx = point.x - next.origin.x;
	const dy = point.y - next.origin.y;
	if (next.mode === "pending" && Math.hypot(dx, dy) > 10 && !next.pinched) {
		const axis = dominantAxis(dx, dy);
		if (!isZoomed(next.startZoom)) next = {
			...next,
			mode: "swipe",
			dragAxis: axis
		};
		else if (axis === "x" && next.edge && (dx < 0 && next.edge.right || dx > 0 && next.edge.left)) next = {
			...next,
			mode: "swipe",
			dragAxis: "x"
		};
		else if (axis === "y" && dy > 0 && next.edge?.top) next = {
			...next,
			mode: "swipe",
			dragAxis: "y"
		};
		else next = {
			...next,
			mode: "pan",
			dragAxis: axis
		};
	} else if (next.mode === "swipe" && !next.dragAxis) {
		const axis = dominantAxis(dx, dy);
		if (axis) next = {
			...next,
			dragAxis: axis
		};
	}
	if (next.mode === "pan" && layout) return {
		gesture: next,
		zoom: panGive(layout.base, layout.stage, next.startZoom, dx, dy)
	};
	if (next.mode === "swipe" && layout && !next.pinched) return {
		gesture: next,
		drag: dragFollow(dx, dy, next.dragAxis, layout.stage, next.held)
	};
	return { gesture: next };
}
function finishPinch(gesture, zoom) {
	const release = pinchRelease(gesture.pinchFitted === true, zoom.scale);
	return {
		gesture: idleFrom(gesture, null),
		suppressClick: true,
		pinch: release,
		...release === "fit" ? {
			zoom: IDENTITY_ZOOM,
			animateZoom: true
		} : {}
	};
}
function gestureUp(gesture, zoom, id, time, layout = null) {
	if (!gesture.pointers.some((pointer) => pointer.id === id)) return { gesture };
	const ended = gesture.pointers.find((pointer) => pointer.id === id);
	const pointers = gesture.pointers.filter((pointer) => pointer.id !== id);
	if (gesture.mode === "pinch") {
		if (pointers.length >= 2) {
			const a = pointers[0];
			const b = pointers[1];
			return { gesture: {
				...gesture,
				pointers,
				mode: "pinch",
				pinched: true,
				startZoom: zoom,
				startMid: midpoint(a, b),
				startDist: distance(a, b)
			} };
		}
		if (pointers.length === 1) {
			const point = pointers[0];
			return { gesture: {
				...gesture,
				pointers,
				mode: isZoomed(zoom) ? "pan" : "pending",
				startZoom: zoom,
				origin: {
					x: point.x,
					y: point.y
				},
				pinched: true
			} };
		}
		return finishPinch(gesture, zoom);
	}
	if (pointers.length > 0) return { gesture: {
		...gesture,
		pointers
	} };
	if (gesture.pinched) return finishPinch(gesture, zoom);
	if (gesture.mode === "swipe" || gesture.mode === "pan") {
		const dx = ended.x - gesture.origin.x;
		const dy = ended.y - gesture.origin.y;
		if (gesture.mode === "pan") {
			const settled = layout ? clampZoom(layout.base, layout.stage, zoom) : zoom;
			const pulled = Math.abs(settled.x - zoom.x) > .5 || Math.abs(settled.y - zoom.y) > .5;
			return {
				gesture: idleFrom(gesture, null),
				suppressClick: true,
				...pulled ? {
					zoom: settled,
					animateZoom: true
				} : {}
			};
		}
		const velocity = dragVelocity(gesture.samples);
		const released = releaseSwipe(dx, dy, velocity.vx, velocity.vy, gesture.dragAxis, false);
		return {
			gesture: idleFrom(gesture, null),
			suppressClick: true,
			...released.step === 0 ? {} : { step: released.step },
			...released.sheet ? { sheet: released.sheet } : {}
		};
	}
	if (gesture.mode === "pending" && !gesture.pinched) {
		const previous = gesture.lastTap;
		if (previous && time >= previous.t && time - previous.t <= 300 && Math.hypot(ended.x - previous.x, ended.y - previous.y) <= 32) {
			if (isZoomed(zoom) || !layout) return {
				gesture: idleFrom(gesture, null),
				...isZoomed(zoom) ? {
					zoom: IDENTITY_ZOOM,
					animateZoom: true
				} : {},
				suppressClick: true
			};
			return {
				gesture: idleFrom(gesture, null),
				zoom: doubleTapZoom(layout.base, layout.stage, {
					x: ended.x,
					y: ended.y
				}),
				animateZoom: true,
				suppressClick: true
			};
		}
		return {
			gesture: idleFrom(gesture, {
				t: time,
				x: ended.x,
				y: ended.y
			}),
			tap: true
		};
	}
	return {
		gesture: idleFrom(gesture, null),
		suppressClick: gesture.pinched || gesture.mode !== "idle"
	};
}
function containedFrame(availW, availH, imageW, imageH, insetX) {
	const widthBudget = availW - insetX * 2;
	if (widthBudget <= 0 || availH <= 0 || imageW <= 0 || imageH <= 0) return null;
	const scale = Math.min(widthBudget / imageW, availH / imageH);
	const width = imageW * scale;
	const height = imageH * scale;
	return {
		left: insetX + (widthBudget - width) / 2,
		top: (availH - height) / 2,
		width,
		height
	};
}
function mediaStyle(frame, zoom, phone, animateZoom, drag, animateDrag, opacity = 1) {
	const style = {
		left: frame.left,
		top: frame.top,
		width: frame.width,
		height: frame.height
	};
	if (opacity < .999) style.opacity = opacity;
	if (phone) {
		style.transform = `translate(${zoom.x + drag.x}px, ${zoom.y + drag.y}px) scale(${zoom.scale})`;
		style.transformOrigin = "center center";
		if (animateDrag) style.transition = `transform 280ms cubic-bezier(0.16, 1, 0.3, 1)`;
		else if (animateZoom) style.transition = `transform 260ms ease-out`;
	}
	return style;
}
function MemoLine({ text }) {
	const ref = (0, import_react.useRef)(null);
	const [overflow, setOverflow] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		const node = ref.current;
		if (!node) return;
		const shift = node.scrollWidth - (node.parentElement?.clientWidth ?? 0);
		setOverflow(shift > 4 ? shift : 0);
	}, [text]);
	if (!text) return null;
	const scrolling = overflow > 0;
	const duration = scrolling ? overflow / 28 / .7 : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "memo-line-view",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			ref,
			className: scrolling ? "memo-line is-scrolling" : "memo-line",
			style: scrolling ? {
				["--marquee-shift"]: `${overflow}px`,
				["--marquee-duration"]: `${duration}s`
			} : void 0,
			children: text
		})
	});
}
function Lightbox({ item, index, total, prev = null, next = null, onClose, onStep, onToggleFavorite, tags = [] }) {
	const stageRef = (0, import_react.useRef)(null);
	const [urlTick, setUrlTick] = (0, import_react.useState)(0);
	const [failed, setFailed] = (0, import_react.useState)(false);
	const [frame, setFrame] = (0, import_react.useState)(null);
	const [stageBox, setStageBox] = (0, import_react.useState)({
		width: 0,
		height: 0
	});
	const [hot, setHot] = (0, import_react.useState)(null);
	const [phone, setPhone] = (0, import_react.useState)(false);
	const [zoom, setZoom] = (0, import_react.useState)(IDENTITY_ZOOM);
	const [zoomAnim, setZoomAnim] = (0, import_react.useState)(false);
	const [drag, setDrag] = (0, import_react.useState)(DRAG_REST);
	const [dragAnim, setDragAnim] = (0, import_react.useState)(false);
	const [infoOpen, setInfoOpen] = (0, import_react.useState)(false);
	const [photoOpacity, setPhotoOpacity] = (0, import_react.useState)(1);
	const [pinchFades, setPinchFades] = (0, import_react.useState)(false);
	const canPrev = total > 1;
	const canNext = total > 1;
	const swipeRef = (0, import_react.useRef)(null);
	const frameRef = (0, import_react.useRef)(null);
	const zoomRef = (0, import_react.useRef)(IDENTITY_ZOOM);
	const gestureRef = (0, import_react.useRef)(freshGesture());
	const phoneRef = (0, import_react.useRef)(false);
	const suppressClick = (0, import_react.useRef)(false);
	const infoRef = (0, import_react.useRef)(false);
	const infoDragRef = (0, import_react.useRef)(null);
	const zoomTimer = (0, import_react.useRef)(0);
	const zoomFrame = (0, import_react.useRef)(0);
	const dragTimer = (0, import_react.useRef)(0);
	const dragFrame = (0, import_react.useRef)(0);
	const dragRef = (0, import_react.useRef)(DRAG_REST);
	const pendingEnter = (0, import_react.useRef)(null);
	const mediaRef = (0, import_react.useRef)(null);
	const urls = (0, import_react.useRef)(/* @__PURE__ */ new Map());
	const loadingUrls = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const slideDir = (0, import_react.useRef)(0);
	const settleEnter = (0, import_react.useRef)(false);
	const leavingRef = (0, import_react.useRef)(false);
	const photoOpacityRef = (0, import_react.useRef)(1);
	const pinchFadesRef = (0, import_react.useRef)(false);
	const infoTapTimer = (0, import_react.useRef)(0);
	const seenId = (0, import_react.useRef)(item?.id ?? null);
	const seenPhone = (0, import_react.useRef)(false);
	let shown = zoom;
	let shownDrag = drag;
	const sameImage = (item?.id ?? null) === seenId.current;
	if (!sameImage) {
		const nextInfo = infoOpenForItem(infoRef.current, item?.id ?? null);
		const enter = pendingEnter.current;
		pendingEnter.current = null;
		seenId.current = item?.id ?? null;
		zoomRef.current = IDENTITY_ZOOM;
		if (gestureRef.current.pointers.length === 0) gestureRef.current = freshGesture();
		infoRef.current = nextInfo;
		shown = IDENTITY_ZOOM;
		window.cancelAnimationFrame(zoomFrame.current);
		window.clearTimeout(zoomTimer.current);
		if (zoom !== IDENTITY_ZOOM) setZoom(IDENTITY_ZOOM);
		if (infoOpen !== nextInfo) setInfoOpen(nextInfo);
		if (zoomAnim) setZoomAnim(false);
		if (enter) {
			dragRef.current = enter;
			shownDrag = enter;
			if (drag.x !== enter.x || drag.y !== enter.y) setDrag(enter);
			if (dragAnim) setDragAnim(false);
		} else {
			window.cancelAnimationFrame(dragFrame.current);
			window.clearTimeout(dragTimer.current);
			shownDrag = DRAG_REST;
			if (drag.x !== 0 || drag.y !== 0 || dragAnim) {
				dragRef.current = DRAG_REST;
				if (drag.x !== 0 || drag.y !== 0) setDrag(DRAG_REST);
				if (dragAnim) setDragAnim(false);
			}
		}
		if (photoOpacity !== 1) {
			photoOpacityRef.current = 1;
			setPhotoOpacity(1);
		}
		if (pinchFades) {
			pinchFadesRef.current = false;
			setPinchFades(false);
		}
		leavingRef.current = false;
	}
	if (phone !== seenPhone.current) {
		seenPhone.current = phone;
		phoneRef.current = phone;
		if (!phone) {
			zoomRef.current = IDENTITY_ZOOM;
			gestureRef.current = freshGesture();
			infoRef.current = false;
			shown = IDENTITY_ZOOM;
			window.cancelAnimationFrame(zoomFrame.current);
			window.clearTimeout(zoomTimer.current);
			window.cancelAnimationFrame(dragFrame.current);
			window.clearTimeout(dragTimer.current);
			pendingEnter.current = null;
			if (zoom !== IDENTITY_ZOOM) setZoom(IDENTITY_ZOOM);
			if (infoOpen) setInfoOpen(false);
			if (zoomAnim) setZoomAnim(false);
			dragRef.current = DRAG_REST;
			if (drag.x !== 0 || drag.y !== 0) setDrag(DRAG_REST);
			if (dragAnim) setDragAnim(false);
		}
	}
	const measure = (0, import_react.useCallback)(() => {
		const stage = stageRef.current;
		if (!stage || !item) return;
		const next = containedFrame(stage.clientWidth, stage.clientHeight, item.width, item.height, 16);
		frameRef.current = next;
		const box = {
			width: stage.clientWidth,
			height: stage.clientHeight
		};
		setStageBox((current) => current.width === box.width && current.height === box.height ? current : box);
		setFrame((current) => {
			if (current && next && current.left === next.left && current.top === next.top && current.width === next.width && current.height === next.height) return current;
			return next;
		});
	}, [item]);
	const bindStage = (node) => {
		stageRef.current = node;
		measure();
	};
	const bindMedia = (node) => {
		mediaRef.current = node;
	};
	(0, import_react.useEffect)(() => {
		return () => {
			window.cancelAnimationFrame(zoomFrame.current);
			window.clearTimeout(zoomTimer.current);
			window.cancelAnimationFrame(dragFrame.current);
			window.clearTimeout(dragTimer.current);
			window.clearTimeout(infoTapTimer.current);
			for (const objectUrl of urls.current.values()) URL.revokeObjectURL(objectUrl);
			urls.current.clear();
		};
	}, []);
	(0, import_react.useEffect)(() => {
		measure();
		const stage = stageRef.current;
		if (!stage) return;
		const observer = new ResizeObserver(measure);
		observer.observe(stage);
		return () => observer.disconnect();
	}, [measure]);
	(0, import_react.useEffect)(() => {
		const media = window.matchMedia("(max-width: 899px)");
		const apply = () => {
			phoneRef.current = media.matches;
			setPhone(media.matches);
		};
		apply();
		media.addEventListener("change", apply);
		return () => media.removeEventListener("change", apply);
	}, []);
	const itemId = item?.id ?? null;
	const prevId = prev?.id ?? null;
	const nextId = next?.id ?? null;
	(0, import_react.useEffect)(() => {
		if (!itemId) return;
		let cancelled = false;
		setHot(null);
		setFailed(false);
		const ids = [itemId];
		if (phone && prevId && prevId !== itemId) ids.push(prevId);
		if (phone && nextId && nextId !== itemId && nextId !== prevId) ids.push(nextId);
		for (const id of ids) {
			if (urls.current.has(id) || loadingUrls.current.has(id)) continue;
			loadingUrls.current.add(id);
			readPixels(id, "original").then((blob) => {
				loadingUrls.current.delete(id);
				if (!blob) {
					if (!cancelled && id === itemId) setFailed(true);
					return;
				}
				if (!urls.current.has(id)) urls.current.set(id, URL.createObjectURL(blob));
				if (!cancelled) setUrlTick((tick) => tick + 1);
			}).catch(() => {
				loadingUrls.current.delete(id);
				if (!cancelled && id === itemId) setFailed(true);
			});
		}
		return () => {
			cancelled = true;
		};
	}, [
		itemId,
		prevId,
		nextId,
		phone
	]);
	const step = (delta) => {
		if (delta < 0 && !canPrev) return;
		if (delta > 0 && !canNext) return;
		pendingEnter.current = null;
		settleEnter.current = false;
		window.clearTimeout(dragTimer.current);
		window.cancelAnimationFrame(dragFrame.current);
		onStep(delta);
	};
	(0, import_react.useEffect)(() => {
		if (!settleEnter.current) return;
		settleEnter.current = false;
		animateDragTo(DRAG_REST);
	}, [item?.id]);
	const readVisualDrag = () => {
		const node = mediaRef.current;
		if (!node || typeof DOMMatrix === "undefined") return dragRef.current;
		const raw = getComputedStyle(node).transform;
		if (!raw || raw === "none") return DRAG_REST;
		try {
			const matrix = new DOMMatrix(raw);
			return {
				x: matrix.e - zoomRef.current.x,
				y: matrix.f - zoomRef.current.y
			};
		} catch {
			return dragRef.current;
		}
	};
	const stopDragMotion = () => {
		window.clearTimeout(dragTimer.current);
		window.cancelAnimationFrame(dragFrame.current);
		const visual = dragAnim ? readVisualDrag() : dragRef.current;
		dragRef.current = visual;
		if (dragAnim) {
			setDragAnim(false);
			setDrag(visual);
		}
		return visual;
	};
	const animateDragTo = (target, done) => {
		window.clearTimeout(dragTimer.current);
		window.cancelAnimationFrame(dragFrame.current);
		setDragAnim(true);
		dragFrame.current = window.requestAnimationFrame(() => {
			dragFrame.current = window.requestAnimationFrame(() => {
				dragRef.current = target;
				setDrag(target);
				dragTimer.current = window.setTimeout(() => {
					if (done) done();
					else setDragAnim(false);
				}, 280);
			});
		});
	};
	const springDrag = () => {
		if (Math.abs(dragRef.current.x) < .5 && Math.abs(dragRef.current.y) < .5) {
			dragRef.current = DRAG_REST;
			setDrag(DRAG_REST);
			setDragAnim(false);
			return;
		}
		animateDragTo(DRAG_REST);
	};
	const flySwap = (delta) => {
		if (delta < 0 && !canPrev || delta > 0 && !canNext) {
			springDrag();
			return;
		}
		window.clearTimeout(dragTimer.current);
		window.cancelAnimationFrame(dragFrame.current);
		const width = stageRef.current?.clientWidth || 1;
		pendingEnter.current = {
			x: incomingX(dragRef.current.x, width),
			y: 0
		};
		settleEnter.current = true;
		onStep(delta);
	};
	const stopMotion = () => {
		window.clearTimeout(dragTimer.current);
		window.clearTimeout(zoomTimer.current);
		window.cancelAnimationFrame(dragFrame.current);
		window.cancelAnimationFrame(zoomFrame.current);
	};
	const setPhoto = (value) => {
		photoOpacityRef.current = value;
		setPhotoOpacity(value);
	};
	const setPinchFade = (value) => {
		if (pinchFadesRef.current === value) return;
		pinchFadesRef.current = value;
		setPinchFades(value);
	};
	const playMotion = (duration, frame, done) => {
		stopMotion();
		setDragAnim(false);
		setZoomAnim(false);
		const start = performance.now();
		const tick = (now) => {
			const raw = Math.min(1, (now - start) / duration);
			frame(1 - (1 - raw) ** 3);
			if (raw < 1) dragFrame.current = window.requestAnimationFrame(tick);
			else done?.();
		};
		dragFrame.current = window.requestAnimationFrame(tick);
	};
	const abortLeave = () => {
		if (!leavingRef.current) return false;
		leavingRef.current = false;
		const fromDrag = { ...dragRef.current };
		const fromZoom = { ...zoomRef.current };
		const fromOpacity = photoOpacityRef.current;
		playMotion(280, (eased) => {
			const drag = {
				x: fromDrag.x * (1 - eased),
				y: fromDrag.y * (1 - eased)
			};
			const zoom = {
				scale: fromZoom.scale + (1 - fromZoom.scale) * eased,
				x: fromZoom.x * (1 - eased),
				y: fromZoom.y * (1 - eased)
			};
			dragRef.current = drag;
			zoomRef.current = zoom;
			setDrag(drag);
			setZoom(zoom);
			setPhoto(fromOpacity + (1 - fromOpacity) * eased);
		}, () => setPinchFade(false));
		return true;
	};
	const flyAway = () => {
		leavingRef.current = true;
		const from = { ...dragRef.current };
		const height = stageRef.current?.clientHeight || 1;
		const toY = Math.max(from.y + height * .45, height);
		playMotion(280, (eased) => {
			const next = {
				x: from.x * (1 - eased),
				y: from.y + (toY - from.y) * eased
			};
			dragRef.current = next;
			setDrag(next);
			setPhoto(1 - eased);
		}, () => {
			if (leavingRef.current) onClose();
		});
	};
	const shrinkAway = (from) => {
		leavingRef.current = true;
		setPinchFade(true);
		const next = {
			scale: Math.max(PINCH_MIN * .45, from.scale * .55),
			x: from.x * .55,
			y: from.y * .55
		};
		playMotion(260, (eased) => {
			const zoom = {
				scale: from.scale + (next.scale - from.scale) * eased,
				x: from.x + (next.x - from.x) * eased,
				y: from.y + (next.y - from.y) * eased
			};
			zoomRef.current = zoom;
			setZoom(zoom);
			setPhoto(1 - eased);
		}, () => {
			if (leavingRef.current) onClose();
		});
	};
	const settlePinch = (startedFitted, zoom) => {
		const release = pinchRelease(startedFitted, zoom.scale);
		if (release === "close") {
			shrinkAway(zoom);
			return;
		}
		if (release === "fit") {
			zoomRef.current = IDENTITY_ZOOM;
			window.cancelAnimationFrame(zoomFrame.current);
			window.clearTimeout(zoomTimer.current);
			setZoomAnim(true);
			zoomFrame.current = window.requestAnimationFrame(() => {
				setZoom(IDENTITY_ZOOM);
				zoomTimer.current = window.setTimeout(() => setZoomAnim(false), 260);
			});
		}
	};
	const applyGesture = (result) => {
		if (leavingRef.current) return;
		if (result.gesture.pointers.length > 0 || result.zoom) window.clearTimeout(infoTapTimer.current);
		gestureRef.current = result.gesture;
		if (result.suppressClick) suppressClick.current = true;
		if (result.zoom) {
			const next = result.zoom;
			zoomRef.current = next;
			window.cancelAnimationFrame(zoomFrame.current);
			window.clearTimeout(zoomTimer.current);
			if (result.animateZoom) {
				setZoomAnim(true);
				zoomFrame.current = window.requestAnimationFrame(() => {
					setZoom(next);
					zoomTimer.current = window.setTimeout(() => setZoomAnim(false), 260);
				});
			} else {
				setZoomAnim(false);
				setZoom(next);
			}
			if (dragRef.current.x !== 0 || dragRef.current.y !== 0 || dragAnim) {
				window.clearTimeout(dragTimer.current);
				dragRef.current = DRAG_REST;
				setDrag(DRAG_REST);
				setDragAnim(false);
			}
			if (isZoomed(next) && infoRef.current) {
				infoRef.current = false;
				setInfoOpen(false);
			}
		}
		if (result.drag) {
			const next = scrubDrag(result.drag, infoRef.current);
			window.clearTimeout(dragTimer.current);
			window.cancelAnimationFrame(dragFrame.current);
			dragRef.current = next;
			setDragAnim(false);
			setDrag(next);
		}
		if (result.gesture.mode === "pinch") setPinchFade(result.gesture.pinchFitted === true);
		if (result.pinch === "fit" || result.pinch === "keep") setPinchFade(false);
		if (!(result.gesture.mode === "idle" && result.gesture.pointers.length === 0)) return;
		if (result.pinch === "close") {
			shrinkAway(zoomRef.current);
			return;
		}
		const action = lightboxGestureAction(result, infoRef.current, isZoomed(zoomRef.current));
		if (action === "show-info") {
			if (result.tap) {
				window.clearTimeout(infoTapTimer.current);
				infoTapTimer.current = window.setTimeout(() => {
					if (infoRef.current || isZoomed(zoomRef.current) || !phoneRef.current) return;
					infoRef.current = true;
					setInfoOpen(true);
				}, 300);
			} else {
				window.clearTimeout(infoTapTimer.current);
				infoRef.current = true;
				setInfoOpen(true);
			}
			springDrag();
			return;
		}
		if (action === "hide-info") {
			infoRef.current = false;
			setInfoOpen(false);
			gestureRef.current = freshGesture();
			suppressClick.current = true;
			springDrag();
			return;
		}
		if (action === "close-viewer") {
			flyAway();
			return;
		}
		if (action === "step" && result.step) {
			flySwap(result.step);
			return;
		}
		springDrag();
	};
	const layout = () => {
		const base = frameRef.current;
		const stage = stageRef.current;
		if (!base || !stage) return null;
		return {
			base,
			stage: {
				width: stage.clientWidth,
				height: stage.clientHeight
			}
		};
	};
	const localPoint = (event) => {
		const rect = event.currentTarget.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
	};
	const beginSwipe = (event) => {
		if (event.button !== 0 || event.pointerType === "mouse") return;
		if (event.target?.closest("button, a, input, textarea")) return;
		swipeRef.current = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY
		};
	};
	const endSwipe = (event) => {
		const swipe = swipeRef.current;
		if (!swipe || swipe.id !== event.pointerId) return;
		swipeRef.current = null;
		const dx = event.clientX - swipe.x;
		const dy = event.clientY - swipe.y;
		if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
		step(dx < 0 ? 1 : -1);
	};
	const beginPhone = (event) => {
		if (event.button !== 0 || event.pointerType !== "touch") return;
		if (event.target?.closest("button, a, input, textarea")) return;
		const point = localPoint(event);
		const held = stopDragMotion();
		if (abortLeave()) return;
		const place = layout();
		const edges = place ? panEdges(place.base, place.stage, zoomRef.current) : null;
		applyGesture(gestureDown(gestureRef.current, zoomRef.current, event.pointerId, point.x, point.y, held, performance.now(), edges));
		try {
			event.currentTarget.setPointerCapture(event.pointerId);
		} catch {}
	};
	const movePhone = (event) => {
		if (event.pointerType !== "touch") return;
		if (!gestureRef.current.pointers.some((pointer) => pointer.id === event.pointerId)) return;
		const point = localPoint(event);
		applyGesture(gestureMove(gestureRef.current, event.pointerId, point.x, point.y, layout(), performance.now()));
	};
	const endPhone = (event) => {
		if (event.pointerType !== "touch") return;
		applyGesture(gestureUp(gestureRef.current, zoomRef.current, event.pointerId, performance.now(), layout()));
	};
	const cancelPhone = (event) => {
		if (event.pointerType !== "touch") return;
		if (abortLeave()) return;
		const gesture = gestureRef.current;
		const zoom = zoomRef.current;
		const pinching = gesture.mode === "pinch" || gesture.pinched;
		const startedFitted = gesture.pinchFitted === true;
		gestureRef.current = freshGesture();
		suppressClick.current = true;
		if (pinching) {
			settlePinch(startedFitted, zoom);
			return;
		}
		stopDragMotion();
		springDrag();
	};
	const closeInfo = () => {
		infoRef.current = false;
		setInfoOpen(false);
		gestureRef.current = freshGesture();
		suppressClick.current = true;
	};
	const onInfoPointerDown = (event) => {
		event.stopPropagation();
		if (event.pointerType !== "touch") return;
		infoDragRef.current = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			top: event.currentTarget.scrollTop
		};
	};
	const onInfoPointerUp = (event) => {
		event.stopPropagation();
		const drag = infoDragRef.current;
		if (!drag || drag.id !== event.pointerId) return;
		infoDragRef.current = null;
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		const endTop = event.currentTarget.scrollTop;
		if (infoSheetDismiss(dx, dy, drag.top, endTop)) {
			closeInfo();
			return;
		}
		const delta = infoSheetStep(dx, dy, drag.top, endTop);
		if (delta !== 0) step(delta);
	};
	const stopInfoEvent = (event) => {
		event.stopPropagation();
	};
	if (shownDrag.x > .5) slideDir.current = 1;
	else if (shownDrag.x < -.5) slideDir.current = -1;
	const url = itemId ? urls.current.get(itemId) ?? null : null;
	const incomingItem = !(phone && !isZoomed(shown) && stageBox.width > 0 && shownDrag.y === 0 && (Math.abs(shownDrag.x) > .5 || dragAnim && slideDir.current !== 0)) ? null : shownDrag.x > 0 || shownDrag.x >= 0 && slideDir.current > 0 ? prev : next;
	const incomingUrl = incomingItem ? urls.current.get(incomingItem.id) ?? null : null;
	const incomingFrame = incomingItem && incomingUrl ? containedFrame(stageBox.width, stageBox.height, incomingItem.width, incomingItem.height, 16) : null;
	const incomingShift = Math.abs(shownDrag.x) > .5 ? incomingX(shownDrag.x, stageBox.width) : parkedX(slideDir.current === -1 ? -1 : 1, stageBox.width);
	const scrim = phone ? Math.min(scrimForDrag(shownDrag.y, stageBox.height), scrimForPinch(pinchFades, shown.scale)) : 1;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open: item !== null,
		onOpenChange: (open) => !open && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {
			className: "lightbox-overlay",
			style: phone ? {
				opacity: scrim,
				animation: "none",
				transition: dragAnim ? `opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)` : "none"
			} : void 0
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogContent, {
			className: "lightbox-content",
			onCloseAutoFocus: (event) => {
				event.preventDefault();
			},
			onKeyDown: (event) => {
				if (event.key === "ArrowRight") step(1);
				if (event.key === "ArrowLeft") step(-1);
			},
			children: item ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				phone ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
					className: "sr-only",
					children: item.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, {
					className: "sr-only",
					children: [
						item.width,
						" × ",
						item.height,
						total > 1 && index >= 0 ? ` ${index + 1}/${total}` : ""
					]
				})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lightbox-bar",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
								className: "sr-only",
								children: item.name
							}),
							item.memo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoLine, { text: item.memo }) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, {
								className: "text-sm text-paper/80 tabular-nums",
								children: [
									item.width,
									" × ",
									item.height,
									total > 1 && index >= 0 ? ` · ${index + 1}/${total}` : ""
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							children: "閉じる"
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					ref: bindStage,
					className: "lightbox-stage",
					onPointerDown: (event) => {
						suppressClick.current = false;
						if (phoneRef.current) beginPhone(event);
						else beginSwipe(event);
					},
					onPointerMove: (event) => {
						if (phoneRef.current) movePhone(event);
					},
					onPointerUp: (event) => {
						if (phoneRef.current) endPhone(event);
						else endSwipe(event);
					},
					onPointerCancel: (event) => {
						if (phoneRef.current) cancelPhone(event);
						else swipeRef.current = null;
					},
					onClick: (event) => {
						if (suppressClick.current) {
							suppressClick.current = false;
							event.preventDefault();
							return;
						}
						if (event.target === event.currentTarget) onClose();
					},
					children: [
						incomingFrame && incomingUrl && incomingItem ? incomingItem.mime.startsWith("video/") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
							className: "lightbox-incoming",
							src: incomingUrl,
							muted: true,
							playsInline: true,
							style: mediaStyle(incomingFrame, IDENTITY_ZOOM, true, false, {
								x: incomingShift,
								y: 0
							}, dragAnim)
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							className: "lightbox-incoming",
							src: incomingUrl,
							alt: "",
							style: mediaStyle(incomingFrame, IDENTITY_ZOOM, true, false, {
								x: incomingShift,
								y: 0
							}, dragAnim)
						}) : null,
						url && item.mime.startsWith("video/") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
							src: url,
							muted: true,
							loop: true,
							autoPlay: true,
							playsInline: true,
							ref: bindMedia,
							style: frame ? mediaStyle(frame, shown, phone, zoomAnim && sameImage, phone ? shownDrag : DRAG_REST, dragAnim && sameImage, photoOpacity) : void 0
						}) : url ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							ref: bindMedia,
							src: url,
							alt: item.name,
							style: frame ? mediaStyle(frame, shown, phone, zoomAnim && sameImage, phone ? shownDrag : DRAG_REST, dragAnim && sameImage, photoOpacity) : void 0
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-paper",
							children: failed ? "プレビューを開けませんでした。" : "読み込み中"
						}),
						frame ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "lightbox-hit",
							style: {
								left: frame.left,
								top: frame.top,
								width: frame.width,
								height: frame.height
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: hot === "prev" ? "lightbox-edge is-prev is-hot" : "lightbox-edge is-prev",
								"aria-label": "前の画像",
								onPointerEnter: (event) => {
									if (event.pointerType === "mouse" && canPrev) setHot("prev");
								},
								onPointerLeave: () => setHot((current) => current === "prev" ? null : current),
								onClick: () => step(-1),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "edge-veil",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {})
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: hot === "next" ? "lightbox-edge is-next is-hot" : "lightbox-edge is-next",
								"aria-label": "次の画像",
								onPointerEnter: (event) => {
									if (event.pointerType === "mouse" && canNext) setHot("next");
								},
								onPointerLeave: () => setHot((current) => current === "next" ? null : current),
								onClick: () => step(1),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "edge-veil",
									"aria-hidden": "true",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {})
								})
							})]
						}) : null,
						phone && infoOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "lightbox-info",
							"aria-label": "画像情報",
							onPointerDown: onInfoPointerDown,
							onPointerMove: stopInfoEvent,
							onPointerUp: onInfoPointerUp,
							onPointerCancel: (event) => {
								stopInfoEvent(event);
								infoDragRef.current = null;
							},
							onClick: (event) => event.stopPropagation(),
							children: [
								item.memo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MemoLine, { text: item.memo }) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "lightbox-info-label",
									children: "タグ"
								}),
								tags.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "lightbox-info-tags",
									children: tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "shot-tag",
										style: { background: tag.color },
										children: tag.name
									}, tag.id))
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "lightbox-info-empty",
									children: "タグなし"
								})
							]
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "lightbox-nav",
					children: [
						total > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							onClick: () => step(-1),
							disabled: !canPrev,
							children: "前へ"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							className: item.favorite ? "lightbox-fav is-on" : "lightbox-fav",
							"aria-label": item.favorite ? `${item.name}のお気に入りを解除` : `${item.name}をお気に入りに追加`,
							"aria-pressed": item.favorite,
							onClick: () => onToggleFavorite(item.id),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, {
								"aria-hidden": "true",
								fill: item.favorite ? "currentColor" : "none"
							})
						}),
						total > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							onClick: () => step(1),
							disabled: !canNext,
							children: "次へ"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {})
					]
				})
			] }) : null
		})] })
	});
}
var MM = 72 / 25.4;
function jpegOrientation(bytes) {
	if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return 1;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 2;
	while (offset + 4 < bytes.length) {
		if (bytes[offset] !== 255) return 1;
		const marker = bytes[offset + 1] ?? 0;
		if (marker === 218 || marker === 217) return 1;
		const size = view.getUint16(offset + 2);
		if (marker === 225 && size >= 16) {
			const start = offset + 4;
			if (view.getUint32(start) !== 1165519206) return 1;
			const endian = view.getUint16(start + 6);
			const little = endian === 18761;
			if (!little && endian !== 19789) return 1;
			const tiff = start + 6;
			const ifd = tiff + view.getUint32(tiff + 4, little);
			if (ifd + 2 > bytes.length) return 1;
			const count = view.getUint16(ifd, little);
			for (let index = 0; index < count; index += 1) {
				const entry = ifd + 2 + index * 12;
				if (entry + 12 > bytes.length) break;
				if (view.getUint16(entry, little) === 274) return view.getUint16(entry + 8, little) || 1;
			}
			return 1;
		}
		if (size < 2) return 1;
		offset += 2 + size;
	}
	return 1;
}
async function rasterPng(blob, maxEdge) {
	const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
	try {
		const longEdge = Math.max(bitmap.width, bitmap.height);
		const scale = maxEdge && longEdge > maxEdge ? maxEdge / longEdge : 1;
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("canvas");
		ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const png = await new Promise((resolve, reject) => {
			canvas.toBlob((value) => value ? resolve(value) : reject(/* @__PURE__ */ new Error("png")), "image/png");
		});
		return new Uint8Array(await png.arrayBuffer());
	} finally {
		bitmap.close();
	}
}
async function pngBytes(blob) {
	try {
		return await rasterPng(blob);
	} catch {
		return rasterPng(blob, 4096);
	}
}
async function buildPortfolioPdf(items, options) {
	const { PDFDocument } = await import("../_libs/pdf-lib.mjs").then((n) => n.t);
	const layout = layoutPdfSelection(items, options);
	const pdf = await PDFDocument.create();
	const pages = Array.from({ length: Math.max(layout.pageCount, 1) }, () => pdf.addPage([layout.pageWidth * MM, layout.pageHeight * MM]));
	for (const place of layout.placements) {
		const item = items.find((entry) => entry.id === place.id);
		const page = pages[place.page];
		if (!item || !page) continue;
		const blob = await readPixels(item.id, "original");
		if (!blob) throw new Error("missing image");
		const bytes = new Uint8Array(await blob.arrayBuffer());
		const image = item.animated ? await pdf.embedPng(await pngBytes(blob)) : item.mime === "image/png" ? await pdf.embedPng(bytes) : item.mime === "image/jpeg" && jpegOrientation(bytes) <= 1 ? await pdf.embedJpg(bytes) : await pdf.embedPng(await pngBytes(blob));
		page.drawImage(image, {
			x: place.x * MM,
			y: (layout.pageHeight - place.y - place.h) * MM,
			width: place.w * MM,
			height: place.h * MM
		});
	}
	const saved = await pdf.save();
	const copy = new ArrayBuffer(saved.byteLength);
	new Uint8Array(copy).set(saved);
	return new Blob([copy], { type: "application/pdf" });
}
var THUMB_EDGE = 640;
var ImagePrepareError = class extends Error {
	kind = "decode";
	constructor() {
		super("decode");
		this.name = "ImagePrepareError";
	}
};
function canvasToBlob(canvas, type) {
	const paint = (mime) => new Promise((resolve) => {
		canvas.toBlob((blob) => resolve(blob), mime, .82);
	});
	return paint(type).then((blob) => {
		if (blob) return blob;
		if (type === "image/jpeg") throw new ImagePrepareError();
		return paint("image/jpeg").then((fallback) => {
			if (!fallback) throw new ImagePrepareError();
			return fallback;
		});
	});
}
function prepareVideo(original) {
	const url = URL.createObjectURL(original);
	const video = document.createElement("video");
	video.muted = true;
	video.playsInline = true;
	video.preload = "auto";
	video.src = url;
	return new Promise((resolve, reject) => {
		const fail = () => {
			URL.revokeObjectURL(url);
			reject(new ImagePrepareError());
		};
		video.onerror = fail;
		video.onloadeddata = () => {
			const width = video.videoWidth;
			const height = video.videoHeight;
			if (width < 1 || height < 1) {
				fail();
				return;
			}
			const longEdge = Math.max(width, height);
			const scale = longEdge <= THUMB_EDGE ? 1 : THUMB_EDGE / longEdge;
			const tw = Math.max(1, Math.round(width * scale));
			const th = Math.max(1, Math.round(height * scale));
			const canvas = document.createElement("canvas");
			canvas.width = tw;
			canvas.height = th;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				fail();
				return;
			}
			ctx.drawImage(video, 0, 0, tw, th);
			canvas.toBlob((poster) => {
				URL.revokeObjectURL(url);
				if (!poster) reject(new ImagePrepareError());
				else resolve({
					width,
					height,
					original,
					thumb: poster,
					animated: true
				});
			}, "image/jpeg", .82);
		};
	});
}
async function prepareImage(file, mime) {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const animated = isAnimatedImage(bytes, mime);
	const original = new Blob([bytes], { type: mime });
	if (mime === "video/mp4" || mime === "video/webm") return prepareVideo(original);
	let bitmap;
	try {
		bitmap = await createImageBitmap(original, { imageOrientation: "from-image" });
	} catch {
		throw new ImagePrepareError();
	}
	try {
		const width = bitmap.width;
		const height = bitmap.height;
		if (width < 1 || height < 1) throw new ImagePrepareError();
		const longEdge = Math.max(width, height);
		if (!animated && longEdge <= THUMB_EDGE) return {
			width,
			height,
			original,
			thumb: null,
			animated
		};
		const scale = longEdge <= THUMB_EDGE ? 1 : THUMB_EDGE / longEdge;
		const tw = Math.max(1, Math.round(width * scale));
		const th = Math.max(1, Math.round(height * scale));
		const canvas = document.createElement("canvas");
		canvas.width = tw;
		canvas.height = th;
		const ctx = canvas.getContext("2d", { alpha: mime === "image/png" || mime === "image/gif" || mime === "image/webp" });
		if (!ctx) throw new ImagePrepareError();
		ctx.drawImage(bitmap, 0, 0, tw, th);
		return {
			width,
			height,
			original,
			thumb: await canvasToBlob(canvas, mime === "image/jpeg" ? "image/jpeg" : "image/png"),
			animated
		};
	} finally {
		bitmap.close();
	}
}
var SERVER_SNAPSHOT = {
	phase: "boot",
	items: [],
	notices: [],
	importing: null,
	bootError: null,
	columns: 4,
	direction: DEFAULT_FOLDER_VIEW.direction,
	folders: [],
	folderId: "all",
	views: { ["all"]: DEFAULT_FOLDER_VIEW },
	folderWidth: 240,
	folderPane: 360,
	folderOpen: true,
	favoritesOnly: false,
	tags: [],
	tagFolders: [],
	activeTagIds: [],
	hiddenTagIds: [],
	tagMatch: "all",
	tagOpen: true,
	tagWidth: 220,
	pendingAdd: null,
	libraryEpoch: 0
};
var state = SERVER_SNAPSHOT;
var listeners = /* @__PURE__ */ new Set();
var bootPromise = null;
var queue = Promise.resolve();
var switchChain = Promise.resolve();
var stateLocked = false;
var viewEpoch = 0;
var deleting = /* @__PURE__ */ new Set();
var persistedKey = "";
function orderKey(items) {
	return items.map((item) => `${item.id}:${item.order}:${item.scale}:${item.folderId}`).join("|");
}
function emit() {
	for (const listener of listeners) listener();
}
function setState(update) {
	if (stateLocked) return;
	state = update(state);
	emit();
}
function forceState(update) {
	state = update(state);
	emit();
}
function subscribe(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
function usePortfolio(select) {
	return (0, import_react.useSyncExternalStore)(subscribe, () => select(state), () => select(SERVER_SNAPSHOT));
}
function pushNotice(message) {
	if (!message) return;
	const notice = {
		id: crypto.randomUUID(),
		message
	};
	setState((current) => ({
		...current,
		notices: [...current.notices, notice].slice(-4)
	}));
}
function notify(message) {
	pushNotice(message);
}
function dismissNotices() {
	if (state.notices.length === 0) return;
	setState((current) => ({
		...current,
		notices: []
	}));
}
var viewerLock = false;
function setViewerLock(locked) {
	viewerLock = locked;
}
function viewerLocked() {
	return viewerLock;
}
function isQuota(error) {
	return typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "QuotaExceededError" || error instanceof Error && error.name === "QuotaExceededError";
}
async function loadLibraryIntoState(epoch) {
	const [items, folder, width, open, pane, favoritesOnly, tags, tag, tagHidden, tagMatch, tagOpen, tagWidth, tagFolders] = await Promise.all([
		listMeta(),
		readKvString("folder", "all"),
		readKv("folderWidth", 240),
		readKv("folderOpen", 1),
		readKv("folderPane", 360),
		readKv("favoritesOnly", 0),
		listTags(),
		readKvString("tag", ""),
		readKvString("tagHidden", ""),
		readKvString("tagMatch", "all"),
		readKv("tagOpen", 1),
		readKv("tagWidth", 220),
		listTagFolders()
	]);
	if (epoch !== viewEpoch) return;
	const library = await ensureLibrary(items);
	if (epoch !== viewEpoch) return;
	const folders = settleParentFolders(library.folders, library.items);
	for (const entry of folders) {
		const previous = library.folders.find((item) => item.id === entry.id);
		if (!previous || previous.isParent !== entry.isParent || previous.color !== entry.color) await putFolder(entry);
	}
	if (epoch !== viewEpoch) return;
	const folderId = folder === "all" || folders.some((entry) => entry.id === folder) ? folder : "all";
	const views = await listFolderViews();
	if (epoch !== viewEpoch) return;
	const ids = ["all", ...folders.map((entry) => entry.id)];
	for (const id of ids) {
		if (views[id]) continue;
		views[id] = DEFAULT_FOLDER_VIEW;
		await putFolderView(id, DEFAULT_FOLDER_VIEW);
	}
	if (epoch !== viewEpoch) return;
	const active = views[folderId] ?? DEFAULT_FOLDER_VIEW;
	const knownTags = new Set(tags.map((entry) => entry.id));
	const cleaned = library.items.map((item) => {
		const tagIds = item.tagIds.filter((id) => knownTags.has(id));
		return tagIds.length === item.tagIds.length ? item : {
			...item,
			tagIds
		};
	});
	for (const item of cleaned) if (item.tagIds.join("|") !== library.items.find((entry) => entry.id === item.id)?.tagIds.join("|")) await putMeta(item);
	if (epoch !== viewEpoch) return;
	const knownFolderIds = new Set(tagFolders.map((entry) => entry.id));
	const filed = tags.map((entry) => entry.folderId && !knownFolderIds.has(entry.folderId) ? {
		...entry,
		folderId: null
	} : entry);
	for (const entry of filed) if (entry.folderId !== tags.find((tagItem) => tagItem.id === entry.id)?.folderId) await putTag(entry);
	if (epoch !== viewEpoch) return;
	const activeTagIds = parseActiveTagIds(tag, knownTags);
	const hiddenTagIds = parseActiveTagIds(tagHidden, knownTags).filter((id) => !activeTagIds.includes(id));
	persistedKey = orderKey(cleaned);
	forceState((current) => ({
		...current,
		phase: "ready",
		libraryEpoch: epoch,
		items: cleaned,
		folders,
		folderId,
		views,
		folderWidth: Math.min(420, Math.max(180, width || 240)),
		folderPane: Math.min(720, Math.max(140, pane || 360)),
		folderOpen: open !== 0,
		favoritesOnly: favoritesOnly === 1,
		tags: filed,
		tagFolders,
		activeTagIds,
		hiddenTagIds,
		tagMatch: normalizeTagMatch(tagMatch),
		tagOpen: tagOpen !== 0,
		tagWidth: Math.min(320, Math.max(180, tagWidth || 220)),
		columns: active.columns,
		direction: active.direction,
		bootError: null,
		pendingAdd: null,
		importing: null
	}));
}
function bootstrap() {
	if (state.phase === "ready") return Promise.resolve();
	if (!bootPromise) {
		releaseRetiredLibrary();
		const epoch = viewEpoch;
		bootPromise = loadLibraryIntoState(epoch).catch((error) => {
			if (epoch !== viewEpoch) return;
			forceState((current) => ({
				...current,
				phase: "unavailable",
				bootError: storageErrorMessage(error, "open")
			}));
		}).finally(() => {
			if (state.phase !== "ready") bootPromise = null;
		});
	}
	return bootPromise;
}
function retryBootstrap() {
	bootPromise = null;
	forceState((current) => ({
		...current,
		phase: "boot",
		bootError: null
	}));
	return bootstrap();
}
function scheduleReload() {
	viewEpoch += 1;
	const ticket = viewEpoch;
	const run = switchChain.then(() => applyRetarget(ticket));
	switchChain = run.then(() => void 0, () => void 0);
	return run;
}
async function applyRetarget(ticket) {
	if (ticket !== viewEpoch) return;
	stateLocked = true;
	deleting.clear();
	try {
		await queue.catch(() => void 0);
		if (ticket !== viewEpoch) return;
		await drainLibraryWrites();
		if (ticket !== viewEpoch) return;
		suspendLibraryWrites();
		await writesSettled();
		if (ticket !== viewEpoch) return;
		await closeLibraryConnection();
		forgetAllThumbs();
		releaseAllOriginals();
		if (ticket !== viewEpoch) return;
		holdLibraryName(null);
		resumeLibraryWrites();
		bootPromise = null;
		persistedKey = "";
		forceState((current) => ({
			...current,
			phase: "boot",
			libraryEpoch: ticket,
			items: [],
			folders: [],
			folderId: "all",
			views: { ["all"]: DEFAULT_FOLDER_VIEW },
			columns: DEFAULT_FOLDER_VIEW.columns,
			direction: DEFAULT_FOLDER_VIEW.direction,
			favoritesOnly: false,
			tags: [],
			tagFolders: [],
			activeTagIds: [],
			hiddenTagIds: [],
			tagMatch: "all",
			folderWidth: 240,
			folderPane: 360,
			folderOpen: true,
			tagOpen: true,
			tagWidth: 220,
			pendingAdd: null,
			importing: null,
			bootError: null
		}));
		await loadLibraryIntoState(ticket);
	} catch (error) {
		if (ticket !== viewEpoch) return;
		holdLibraryName(null);
		resumeLibraryWrites();
		forceState((current) => ({
			...current,
			phase: "unavailable",
			bootError: storageErrorMessage(error, "open"),
			libraryEpoch: ticket
		}));
	} finally {
		resumeLibraryWrites();
		if (ticket === viewEpoch) {
			setUserWritesOpen(true);
			stateLocked = false;
		}
	}
}
/** Opens one PC library. Safe to call again before the previous switch finishes. */
function switchLibraryTab(tab) {
	const before = libraryDbName();
	rememberLibraryTab(normalizeLibraryTab(tab));
	const after = librarySlotPlan(activeLibraryTab()).live;
	if (!(state.phase === "ready" || state.phase === "unavailable" || bootPromise !== null)) return Promise.resolve();
	if (state.phase === "ready" && after === before) return Promise.resolve();
	setUserWritesOpen(false);
	holdLibraryName(before);
	return scheduleReload();
}
/**
* Follows the existing phone layout flag.
* Does not rewrite the saved PC tab. No-op until the library has started opening.
*/
function syncLibrarySurface(phone) {
	const before = libraryDbName();
	setLibraryPhoneSurface(phone);
	if (librarySlotPlan(activeLibraryTab()).live === before) return Promise.resolve();
	if (state.phase !== "ready" && !bootPromise) return Promise.resolve();
	setUserWritesOpen(false);
	holdLibraryName(before);
	return scheduleReload();
}
function inboxFolderId() {
	if (state.folderId !== "all" && state.folders.some((folder) => folder.id === state.folderId)) return state.folderId;
	return state.folders.find((folder) => folder.name === "未分類")?.id ?? state.folders[0]?.id ?? "";
}
async function importBatch(files, source, folderId = inboxFolderId()) {
	if (state.phase !== "ready") {
		pushNotice(state.bootError ?? "まだ画像ライブラリの準備ができていません。");
		return;
	}
	const destination = state.folders.find((folder) => folder.id === folderId);
	if (!destination) {
		pushNotice("フォルダを用意してから画像を追加してください。");
		return;
	}
	if (destination.isParent) {
		pushNotice("親フォルダには画像を入れられません。子フォルダを選んで追加してください。");
		return;
	}
	const stats = {
		added: 0,
		skippedType: 0,
		skippedEmpty: 0,
		failedDecode: 0,
		failedSave: 0,
		quota: false
	};
	const accepted = [];
	for (const file of files) {
		const result = classifyImageInput(file);
		if (!result.ok) {
			if (result.reason === "empty") stats.skippedEmpty += 1;
			else stats.skippedType += 1;
			continue;
		}
		accepted.push({
			file,
			mime: result.mime
		});
	}
	if (accepted.length === 0) {
		pushNotice(importNotice(stats));
		return;
	}
	setState((current) => ({
		...current,
		importing: {
			done: 0,
			total: accepted.length
		}
	}));
	try {
		let start = 1;
		try {
			start = await allocateOrders(accepted.length);
		} catch (error) {
			stats.failedSave = accepted.length;
			stats.quota = isQuota(error);
			return;
		}
		for (let index = 0; index < accepted.length; index += 1) {
			const { file, mime } = accepted[index];
			if (stats.quota) stats.failedSave += 1;
			else try {
				const prepared = await prepareImage(file, mime);
				const meta = {
					id: crypto.randomUUID(),
					name: baseName(file.name),
					mime,
					width: prepared.width,
					height: prepared.height,
					byteSize: prepared.original.size,
					addedAt: Date.now(),
					order: start + index,
					scale: 1,
					source,
					folderId,
					favorite: false,
					tagIds: [],
					animated: prepared.animated,
					memo: ""
				};
				await saveImage(meta, prepared.original, prepared.thumb);
				stats.added += 1;
				setState((current) => ({
					...current,
					items: [...current.items, meta]
				}));
			} catch (error) {
				if (error instanceof ImagePrepareError) stats.failedDecode += 1;
				else {
					stats.failedSave += 1;
					if (isQuota(error)) stats.quota = true;
				}
			}
			const done = index + 1;
			setState((current) => ({
				...current,
				importing: current.importing ? {
					done,
					total: accepted.length
				} : null
			}));
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	} finally {
		setState((current) => ({
			...current,
			importing: null
		}));
		persistedKey = orderKey(state.items);
		pushNotice(importNotice(stats));
	}
}
function addFiles(list, source = "file") {
	if (viewerLock || !userWritesOpen()) return Promise.resolve();
	const files = Array.from(list);
	const folderId = inboxFolderId();
	const destination = state.folders.find((folder) => folder.id === folderId);
	if (destination?.isParent) {
		if (imageFolderChoices(state.folders, destination.id).length === 0) {
			pushNotice("親フォルダには画像を入れられません。先に子フォルダを作ってから、その中へ追加してください。");
			return Promise.resolve();
		}
		setState((current) => ({
			...current,
			pendingAdd: {
				files,
				source,
				parentId: destination.id
			}
		}));
		return Promise.resolve();
	}
	const job = queue.then(() => importBatch(files, source, folderId));
	queue = job.then(() => void 0, () => void 0);
	return job;
}
function cancelPendingAdd() {
	setState((current) => ({
		...current,
		pendingAdd: null
	}));
}
function confirmPendingAdd(folderId) {
	if (viewerLock || !userWritesOpen()) return Promise.resolve();
	const pending = state.pendingAdd;
	const destination = state.folders.find((folder) => folder.id === folderId);
	if (!pending || !destination || destination.isParent) return Promise.resolve();
	if (!imageFolderChoices(state.folders, pending.parentId).some((folder) => folder.id === folderId)) return Promise.resolve();
	setState((current) => ({
		...current,
		pendingAdd: null
	}));
	const job = queue.then(() => importBatch(pending.files, pending.source, folderId));
	queue = job.then(() => void 0, () => void 0);
	return job;
}
async function favoriteImages(ids) {
	if (viewerLock || !userWritesOpen()) return;
	const wanted = new Set(ids);
	const changed = state.items.filter((item) => wanted.has(item.id) && !item.favorite);
	if (changed.length === 0) return;
	const previous = state.items;
	const nextItems = state.items.map((item) => wanted.has(item.id) ? {
		...item,
		favorite: true
	} : item);
	setState((current) => ({
		...current,
		items: nextItems
	}));
	try {
		for (const item of changed) await putMeta({
			...item,
			favorite: true
		});
	} catch (error) {
		setState((current) => ({
			...current,
			items: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function removeImages(ids) {
	if (viewerLock || !userWritesOpen()) return;
	const unique = [...new Set(ids)].filter((id) => !deleting.has(id) && state.items.some((item) => item.id === id));
	unique.forEach((id) => deleting.add(id));
	const removed = [];
	try {
		for (const id of unique) try {
			await deleteImage(id);
			forgetThumb(id);
			releaseOriginal(id);
			removed.push(id);
		} catch (error) {
			pushNotice(storageErrorMessage(error, "delete"));
		}
		if (removed.length === 0) return;
		const gone = new Set(removed);
		setState((current) => ({
			...current,
			items: current.items.filter((item) => !gone.has(item.id))
		}));
		persistedKey = orderKey(state.items);
	} finally {
		unique.forEach((id) => deleting.delete(id));
	}
}
async function moveImagesToFolder(ids, folderId) {
	if (viewerLock || !userWritesOpen()) return;
	const destination = state.folders.find((folder) => folder.id === folderId);
	if (!destination) return;
	if (destination.isParent) {
		pushNotice("親フォルダには画像を入れられません。子フォルダへドロップしてください。");
		return;
	}
	const wanted = new Set(ids);
	const moving = state.items.filter((item) => wanted.has(item.id) && item.folderId !== folderId);
	if (moving.length === 0) return;
	const movingIds = new Set(moving.map((item) => item.id));
	const previous = state.items;
	const nextItems = state.items.map((item) => movingIds.has(item.id) ? {
		...item,
		folderId
	} : item);
	setState((current) => ({
		...current,
		items: nextItems
	}));
	try {
		for (const item of nextItems) if (movingIds.has(item.id)) await putMeta(item);
		persistedKey = orderKey(state.items);
	} catch (error) {
		setState((current) => ({
			...current,
			items: previous
		}));
		persistedKey = orderKey(previous);
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function assignTagToImages(ids, tagId) {
	if (viewerLock || !userWritesOpen()) return;
	if (!state.tags.some((tag) => tag.id === tagId)) return;
	const wanted = new Set(ids);
	const changed = [];
	const nextItems = state.items.map((item) => {
		if (!wanted.has(item.id) || item.tagIds.includes(tagId)) return item;
		const next = {
			...item,
			tagIds: [...item.tagIds, tagId]
		};
		changed.push(next);
		return next;
	});
	if (changed.length === 0) return;
	const previous = state.items;
	setState((current) => ({
		...current,
		items: nextItems
	}));
	try {
		for (const item of changed) await putMeta(item);
	} catch (error) {
		setState((current) => ({
			...current,
			items: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function toggleFavorite(id, options) {
	if (!userWritesOpen()) return;
	if (viewerLock && !options?.fromLightbox) return;
	const item = state.items.find((entry) => entry.id === id);
	if (!item) return;
	const next = {
		...item,
		favorite: !item.favorite
	};
	const previous = state.items;
	setState((current) => ({
		...current,
		items: current.items.map((entry) => entry.id === id ? next : entry)
	}));
	try {
		await putMeta(next);
	} catch (error) {
		setState((current) => ({
			...current,
			items: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function setImageMemo(id, memo) {
	if (!userWritesOpen()) return;
	const item = state.items.find((entry) => entry.id === id);
	if (!item) return;
	const nextMemo = normalizeMemo(memo);
	if (item.memo === nextMemo) return;
	const next = {
		...item,
		memo: nextMemo
	};
	const previous = state.items;
	setState((current) => ({
		...current,
		items: current.items.map((entry) => entry.id === id ? next : entry)
	}));
	try {
		await putMeta(next);
	} catch (error) {
		setState((current) => ({
			...current,
			items: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
function tagTaken(name, exceptId) {
	return state.tags.some((tag) => tag.id !== exceptId && tag.name === name);
}
async function createTag(name) {
	if (viewerLock || !userWritesOpen()) return;
	const trimmed = name.trim().slice(0, 40);
	if (!trimmed) return;
	if (tagTaken(trimmed)) {
		pushNotice("同じ名前のタグがあります。");
		return;
	}
	const tag = {
		id: crypto.randomUUID(),
		name: trimmed,
		color: TAG_COLORS[state.tags.length % TAG_COLORS.length] ?? TAG_COLORS[0],
		order: state.tags.length,
		createdAt: Date.now(),
		folderId: null
	};
	const previous = state.tags;
	setState((current) => ({
		...current,
		tags: [...current.tags, tag]
	}));
	try {
		await putTag(tag);
	} catch (error) {
		setState((current) => ({
			...current,
			tags: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
function tagFolderTaken(name) {
	return state.tagFolders.some((folder) => folder.name === name);
}
async function createTagFolder(name) {
	if (viewerLock || !userWritesOpen()) return;
	const trimmed = name.trim().slice(0, 40);
	if (!trimmed) return;
	if (tagFolderTaken(trimmed)) {
		pushNotice("同じ名前のフォルダがあります。");
		return;
	}
	const folder = {
		id: crypto.randomUUID(),
		name: trimmed,
		order: state.tagFolders.length,
		createdAt: Date.now(),
		open: true
	};
	const previous = state.tagFolders;
	setState((current) => ({
		...current,
		tagFolders: [...current.tagFolders, folder]
	}));
	try {
		await putTagFolder(folder);
	} catch (error) {
		setState((current) => ({
			...current,
			tagFolders: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function toggleTagFolder(id) {
	if (!userWritesOpen()) return;
	const folder = state.tagFolders.find((entry) => entry.id === id);
	if (!folder) return;
	const next = {
		...folder,
		open: !folder.open
	};
	const previous = state.tagFolders;
	setState((current) => ({
		...current,
		tagFolders: current.tagFolders.map((entry) => entry.id === id ? next : entry)
	}));
	try {
		await putTagFolder(next);
	} catch (error) {
		setState((current) => ({
			...current,
			tagFolders: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function placeTag(tagId, folderId, beforeId) {
	if (viewerLock || !userWritesOpen()) return;
	const source = state.tags.find((entry) => entry.id === tagId);
	if (!source) return;
	if (folderId && !state.tagFolders.some((entry) => entry.id === folderId)) return;
	const byOrder = (a, b) => a.order - b.order || a.createdAt - b.createdAt;
	const siblings = state.tags.filter((entry) => entry.id !== tagId && (entry.folderId ?? null) === folderId).sort(byOrder);
	if (beforeId !== null && !siblings.some((entry) => entry.id === beforeId)) return;
	const ids = siblings.map((entry) => entry.id);
	ids.splice(beforeId === null ? ids.length : ids.indexOf(beforeId), 0, tagId);
	const sameFolder = (source.folderId ?? null) === folderId;
	const currentIds = state.tags.filter((entry) => (entry.folderId ?? null) === folderId).sort(byOrder).map((entry) => entry.id);
	if (sameFolder && currentIds.join("|") === ids.join("|")) return;
	const orderOf = new Map(ids.map((id, index) => [id, index]));
	const previous = state.tags;
	const next = previous.map((entry) => {
		const order = orderOf.get(entry.id);
		if (order === void 0) return entry;
		if (entry.id === tagId) return {
			...entry,
			folderId,
			order
		};
		return order === entry.order ? entry : {
			...entry,
			order
		};
	});
	setState((current) => ({
		...current,
		tags: next.slice().sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
	}));
	try {
		for (const tag of next) {
			const before = previous.find((entry) => entry.id === tag.id);
			if (!before || before.order !== tag.order || before.folderId !== tag.folderId) await putTag(tag);
		}
	} catch (error) {
		setState((current) => ({
			...current,
			tags: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function deleteTagFolder(id) {
	if (viewerLock || !userWritesOpen()) return;
	if (!state.tagFolders.some((entry) => entry.id === id)) return;
	const epoch = libraryConnectionEpoch();
	const plan = planTagFolderRemoval({
		folderId: id,
		tags: state.tags,
		items: state.items,
		activeTagIds: state.activeTagIds,
		hiddenTagIds: state.hiddenTagIds
	});
	const doomed = new Set(plan.tagIds);
	const metas = state.items.flatMap((item) => {
		if (!item.tagIds.some((tagId) => doomed.has(tagId))) return [];
		return [{
			...item,
			tagIds: item.tagIds.filter((tagId) => !doomed.has(tagId))
		}];
	});
	const active = plan.activeTagIds.length === state.activeTagIds.length ? null : plan.activeTagIds;
	const hidden = plan.hiddenTagIds.length === state.hiddenTagIds.length ? null : plan.hiddenTagIds;
	try {
		await deleteTagFolderTree({
			folderId: id,
			tagIds: plan.tagIds,
			metas,
			active,
			hidden
		});
	} catch (error) {
		if (error instanceof Error && error.message === "library-changed") {
			pushNotice("画面が切り替わったため、タグフォルダの削除を中止しました。");
			return;
		}
		pushNotice(storageErrorMessage(error, "delete"));
		return;
	}
	if (libraryConnectionEpoch() !== epoch || !userWritesOpen()) return;
	setState((current) => ({
		...current,
		tagFolders: current.tagFolders.filter((entry) => entry.id !== id),
		tags: current.tags.filter((tag) => !doomed.has(tag.id)),
		items: current.items.map((item) => item.tagIds.some((tagId) => doomed.has(tagId)) ? {
			...item,
			tagIds: item.tagIds.filter((tagId) => !doomed.has(tagId))
		} : item),
		activeTagIds: current.activeTagIds.filter((tagId) => !doomed.has(tagId)),
		hiddenTagIds: current.hiddenTagIds.filter((tagId) => !doomed.has(tagId))
	}));
}
/** Empties only the library that is open now. Other tabs, LAN settings, and backup slots stay. */
async function resetCurrentLibrary() {
	if (!userWritesOpen()) {
		pushNotice("画面が切り替わったため、初期化を中止しました。");
		return;
	}
	const tab = activeLibraryTab();
	const expectedName = libraryDbName();
	const epoch = libraryConnectionEpoch();
	const ticket = viewEpoch;
	await writesSettled();
	if (activeLibraryTab() !== tab || libraryDbName() !== expectedName || libraryConnectionEpoch() !== epoch || viewEpoch !== ticket || !userWritesOpen()) {
		pushNotice("画面が切り替わったため、初期化を中止しました。");
		return;
	}
	const folder = {
		id: crypto.randomUUID(),
		name: INITIAL_FOLDER_NAME,
		order: 0,
		createdAt: Date.now(),
		parentId: null,
		isParent: false,
		color: null
	};
	try {
		await resetLiveLibrary(expectedName, emptyLibraryBackup(folder));
	} catch (error) {
		if (error instanceof Error && error.message === "library-changed") {
			pushNotice("画面が切り替わったため、初期化を中止しました。");
			return;
		}
		pushNotice(`${storageErrorMessage(error, "delete")}初期化は完了していないため、このタブも他のタブも変えていません。`);
		return;
	}
	if (activeLibraryTab() !== tab || viewEpoch !== ticket) return;
	forgetAllThumbs();
	releaseAllOriginals();
	pushNotice(`タブ${tab}を初期状態に戻しました。他のタブはそのままです。`);
	await scheduleReload();
}
async function renameTag(id, name) {
	if (viewerLock || !userWritesOpen()) return false;
	const trimmed = name.trim().slice(0, 40);
	const tag = state.tags.find((entry) => entry.id === id);
	if (!tag || !trimmed || trimmed === tag.name) return false;
	if (tagTaken(trimmed, id)) {
		pushNotice("同じ名前のタグがあります。");
		return false;
	}
	const next = {
		...tag,
		name: trimmed
	};
	const previous = state.tags;
	setState((current) => ({
		...current,
		tags: current.tags.map((entry) => entry.id === id ? next : entry)
	}));
	try {
		await putTag(next);
		return true;
	} catch (error) {
		setState((current) => ({
			...current,
			tags: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
		return false;
	}
}
async function removeTag(id) {
	if (viewerLock || !userWritesOpen()) return;
	if (!state.tags.find((entry) => entry.id === id)) return;
	const previousTags = state.tags;
	const previousItems = state.items;
	const previousIds = state.activeTagIds;
	const previousHidden = state.hiddenTagIds;
	const nextIds = previousIds.filter((entry) => entry !== id);
	const nextHidden = previousHidden.filter((entry) => entry !== id);
	const nextItems = state.items.map((item) => item.tagIds.includes(id) ? {
		...item,
		tagIds: item.tagIds.filter((entry) => entry !== id)
	} : item);
	setState((current) => ({
		...current,
		tags: current.tags.filter((entry) => entry.id !== id),
		items: nextItems,
		activeTagIds: nextIds,
		hiddenTagIds: nextHidden
	}));
	try {
		await deleteTagRecord(id);
		for (const item of nextItems) if (item.tagIds.length !== previousItems.find((entry) => entry.id === item.id)?.tagIds.length) await putMeta(item);
		if (nextIds.length !== previousIds.length) await writeKv("tag", JSON.stringify(nextIds));
		if (nextHidden.length !== previousHidden.length) await writeKv("tagHidden", JSON.stringify(nextHidden));
	} catch (error) {
		setState((current) => ({
			...current,
			tags: previousTags,
			items: previousItems,
			activeTagIds: previousIds,
			hiddenTagIds: previousHidden
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function unassignTagFromImages(ids, tagId) {
	if (viewerLock || !userWritesOpen()) return;
	const wanted = new Set(ids);
	const changed = [];
	const nextItems = state.items.map((item) => {
		if (!wanted.has(item.id) || !item.tagIds.includes(tagId)) return item;
		const next = {
			...item,
			tagIds: item.tagIds.filter((entry) => entry !== tagId)
		};
		changed.push(next);
		return next;
	});
	if (changed.length === 0) return;
	const previous = state.items;
	setState((current) => ({
		...current,
		items: nextItems
	}));
	try {
		for (const item of changed) await putMeta(item);
	} catch (error) {
		setState((current) => ({
			...current,
			items: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function writeTagFilters(active, hidden, previousActive, previousHidden) {
	if (!userWritesOpen()) return;
	if (active.join("|") === previousActive.join("|") && hidden.join("|") === previousHidden.join("|")) return;
	setState((current) => ({
		...current,
		activeTagIds: active,
		hiddenTagIds: hidden
	}));
	try {
		if (active.join("|") !== previousActive.join("|")) await writeKv("tag", JSON.stringify(active));
		if (hidden.join("|") !== previousHidden.join("|")) await writeKv("tagHidden", JSON.stringify(hidden));
	} catch (error) {
		setState((current) => ({
			...current,
			activeTagIds: previousActive,
			hiddenTagIds: previousHidden
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function placeFilterTag(id, side) {
	const known = new Set(state.tags.map((tag) => tag.id));
	if (!known.has(id)) return;
	const previousActive = state.activeTagIds.filter((entry) => known.has(entry));
	const previousHidden = state.hiddenTagIds.filter((entry) => known.has(entry));
	await writeTagFilters(side === "active" ? previousActive.includes(id) ? previousActive : [...previousActive, id] : previousActive.filter((entry) => entry !== id), side === "hidden" ? previousHidden.includes(id) ? previousHidden : [...previousHidden, id] : previousHidden.filter((entry) => entry !== id), state.activeTagIds, state.hiddenTagIds);
}
async function removeFilterTag(id, side) {
	const previousActive = state.activeTagIds;
	const previousHidden = state.hiddenTagIds;
	await writeTagFilters(side === "active" ? previousActive.filter((entry) => entry !== id) : previousActive, side === "hidden" ? previousHidden.filter((entry) => entry !== id) : previousHidden, previousActive, previousHidden);
}
async function clearFilterTags(side) {
	const previousActive = state.activeTagIds;
	const previousHidden = state.hiddenTagIds;
	if (side === "active") await writeTagFilters([], previousHidden, previousActive, previousHidden);
	else await writeTagFilters(previousActive, [], previousActive, previousHidden);
}
async function selectTag(id) {
	if (id === null) {
		await clearFilterTags("active");
		return;
	}
	if (state.activeTagIds.includes(id)) {
		await removeFilterTag(id, "active");
		return;
	}
	await placeFilterTag(id, "active");
}
async function hideTag(id) {
	if (state.hiddenTagIds.includes(id)) {
		await removeFilterTag(id, "hidden");
		return;
	}
	await placeFilterTag(id, "hidden");
}
async function setTagMatch(match) {
	if (!userWritesOpen()) return;
	const next = normalizeTagMatch(match);
	if (next === state.tagMatch) return;
	const previous = state.tagMatch;
	setState((current) => ({
		...current,
		tagMatch: next
	}));
	try {
		await writeKv("tagMatch", next);
	} catch (error) {
		setState((current) => ({
			...current,
			tagMatch: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function saveTagOpen(open) {
	if (viewerLock || !userWritesOpen()) return;
	setState((current) => ({
		...current,
		tagOpen: open
	}));
	try {
		await writeKv("tagOpen", open ? 1 : 0);
	} catch (error) {
		setState((current) => ({
			...current,
			tagOpen: !open
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function saveTagWidth(width) {
	if (viewerLock || !userWritesOpen()) return;
	const next = Math.min(320, Math.max(180, Math.round(width)));
	setState((current) => ({
		...current,
		tagWidth: next
	}));
	try {
		await writeKv("tagWidth", next);
	} catch (error) {
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function removeImage(id) {
	if (viewerLock || !userWritesOpen()) return;
	if (deleting.has(id)) return;
	deleting.add(id);
	try {
		await deleteImage(id);
		forgetThumb(id);
		releaseOriginal(id);
		setState((current) => ({
			...current,
			items: current.items.filter((item) => item.id !== id)
		}));
		persistedKey = orderKey(state.items);
	} catch (error) {
		pushNotice(storageErrorMessage(error, "delete"));
	} finally {
		deleting.delete(id);
	}
}
async function commitImageOrder() {
	if (viewerLock || !userWritesOpen()) return;
	if (orderKey(state.items) === persistedKey) return;
	const snapshot = state.items;
	try {
		await writeMetaOrders(snapshot.map((item) => ({
			id: item.id,
			order: item.order
		})));
		persistedKey = orderKey(state.items);
	} catch (error) {
		try {
			const items = await listMeta();
			persistedKey = orderKey(items);
			setState((current) => ({
				...current,
				items
			}));
		} catch {
			setState((current) => ({
				...current,
				items: snapshot
			}));
		}
		pushNotice(storageErrorMessage(error, "save"));
	}
}
function setVisibleOrder(ids) {
	if (viewerLock || !userWritesOpen()) return;
	const next = assignVisibleOrders(state.items, ids);
	if (!next) return;
	setState((current) => ({
		...current,
		items: next
	}));
}
function folderNameTaken(name, parentId, exceptId) {
	return state.folders.some((folder) => folder.id !== exceptId && (folder.parentId ?? null) === parentId && folder.name === name);
}
function viewFor(id) {
	return state.views[id] ?? DEFAULT_FOLDER_VIEW;
}
async function writeCurrentView(view) {
	const folderId = state.folderId;
	const previous = viewFor(folderId);
	const previousColumns = state.columns;
	const previousDirection = state.direction;
	setState((current) => ({
		...current,
		columns: view.columns,
		direction: view.direction,
		views: {
			...current.views,
			[folderId]: view
		}
	}));
	try {
		await putFolderView(folderId, view);
	} catch (error) {
		setState((current) => ({
			...current,
			columns: previousColumns,
			direction: previousDirection,
			views: {
				...current.views,
				[folderId]: previous
			}
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function setDirection(direction) {
	if (viewerLock || !userWritesOpen()) return;
	if (direction === state.direction) return;
	await writeCurrentView({
		...viewFor(state.folderId),
		direction
	});
}
async function setColumns(columns) {
	if (viewerLock || !userWritesOpen()) return;
	const next = normalizeFolderView({ columns }).columns;
	if (next === state.columns) return;
	await writeCurrentView({
		...viewFor(state.folderId),
		columns: next
	});
}
async function selectFolder(folderId) {
	if (!userWritesOpen()) return;
	const next = folderId === "all" || state.folders.some((folder) => folder.id === folderId) ? folderId : "all";
	if (next === state.folderId) return;
	const previousId = state.folderId;
	const previousColumns = state.columns;
	const previousDirection = state.direction;
	const previousViews = state.views;
	const known = state.views[next];
	const view = known ?? DEFAULT_FOLDER_VIEW;
	setState((current) => ({
		...current,
		folderId: next,
		columns: view.columns,
		direction: view.direction,
		views: known ? current.views : {
			...current.views,
			[next]: view
		}
	}));
	try {
		await writeKv("folder", next);
		if (!known) await putFolderView(next, view);
	} catch (error) {
		setState((current) => ({
			...current,
			folderId: previousId,
			columns: previousColumns,
			direction: previousDirection,
			views: previousViews
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function createFolder(name, parentId = null) {
	if (viewerLock || !userWritesOpen()) return;
	const trimmed = name.trim().slice(0, 40);
	const parent = parentId ? state.folders.find((folder) => folder.id === parentId) : void 0;
	const parentKey = parent?.id ?? null;
	if (!trimmed) return;
	if (parent && !parent.isParent && state.items.some((item) => item.folderId === parent.id)) {
		pushNotice("画像が入っているフォルダは親フォルダにできません。画像のないフォルダに子フォルダを入れてください。");
		return;
	}
	if (folderNameTaken(trimmed, parentKey)) {
		pushNotice("同じ階層に同じ名前のフォルダがあります。");
		return;
	}
	const promoted = parent && !parent.isParent ? {
		...parent,
		isParent: true,
		color: parent.color ?? pickParentColor(state.folders.flatMap((folder) => folder.color ? [folder.color] : []))
	} : null;
	const peers = state.folders.filter((entry) => (entry.parentId ?? null) === parentKey);
	const folder = {
		id: crypto.randomUUID(),
		name: trimmed,
		order: parentKey === null ? peers.length === 0 ? 0 : Math.min(...peers.map((entry) => entry.order)) - 1 : peers.length,
		createdAt: Date.now(),
		parentId: parentKey,
		isParent: false,
		color: null
	};
	const previous = state.folders;
	const previousId = state.folderId;
	const previousColumns = state.columns;
	const previousDirection = state.direction;
	const previousViews = state.views;
	const view = DEFAULT_FOLDER_VIEW;
	setState((current) => ({
		...current,
		folders: [...current.folders.map((entry) => promoted && entry.id === promoted.id ? promoted : entry), folder],
		folderId: folder.id,
		columns: view.columns,
		direction: view.direction,
		views: {
			...current.views,
			[folder.id]: view
		}
	}));
	try {
		await putFolder(folder);
		if (promoted) await putFolder(promoted);
		await putFolderView(folder.id, view);
		await writeKv("folder", folder.id);
	} catch (error) {
		setState((current) => ({
			...current,
			folders: previous,
			folderId: previousId,
			columns: previousColumns,
			direction: previousDirection,
			views: previousViews
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
var folderClip = null;
var clipListeners = /* @__PURE__ */ new Set();
function emitClip() {
	for (const listener of clipListeners) listener();
}
function folderClipSnapshot() {
	return folderClip;
}
function useFolderClip() {
	return (0, import_react.useSyncExternalStore)((listener) => {
		clipListeners.add(listener);
		return () => clipListeners.delete(listener);
	}, folderClipSnapshot, () => null);
}
/** Remembers a folder to paste later. Pixels stay where they are until paste. */
function rememberFolderCopy(folderId) {
	const folder = state.folders.find((entry) => entry.id === folderId);
	if (!folder || viewerLock || !userWritesOpen()) return;
	folderClip = {
		tab: activeLibraryTab(),
		folderId
	};
	emitClip();
	pushNotice(`「${folder.name}」をコピーしました。貼りつけできます。`);
}
async function pasteFolderCopy() {
	if (viewerLock || !userWritesOpen()) return;
	const clip = folderClip;
	if (!clip) {
		pushNotice("コピーしたフォルダがありません。");
		return;
	}
	const destTab = activeLibraryTab();
	const destDb = libraryDbName();
	const destEpoch = libraryConnectionEpoch();
	let source;
	try {
		await writesSettled();
		source = await readFolderCopySource(clip.tab, clip.folderId);
	} catch (error) {
		pushNotice(storageErrorMessage(error, "save"));
		return;
	}
	if (activeLibraryTab() !== destTab || libraryDbName() !== destDb || libraryConnectionEpoch() !== destEpoch || !userWritesOpen()) {
		pushNotice("画面が切り替わったため、貼り付けを中止しました。");
		return;
	}
	if (!source) {
		folderClip = null;
		emitClip();
		pushNotice("コピー元のフォルダが見つかりません。貼り付けを中止しました。");
		return;
	}
	const destParentId = pasteParentId(state.folders, state.folderId);
	const parent = destParentId ? state.folders.find((folder) => folder.id === destParentId) : void 0;
	const parentKey = parent?.id ?? null;
	if (parent && !parent.isParent && state.items.some((item) => item.folderId === parent.id)) {
		pushNotice("画像が入っているフォルダは親フォルダにできません。画像のないフォルダに子フォルダを入れてください。");
		return;
	}
	const promoted = parent && !parent.isParent ? {
		...parent,
		isParent: true,
		color: parent.color ?? pickParentColor(state.folders.flatMap((folder) => folder.color ? [folder.color] : []))
	} : null;
	const planned = planFolderCopy({
		rootId: source.rootId,
		sourceFolders: source.folders,
		sourceItems: source.items,
		sourceTags: source.tags,
		sourceTagFolders: source.tagFolders,
		sourceViews: source.views,
		destFolders: promoted ? state.folders.map((folder) => folder.id === promoted.id ? promoted : folder) : state.folders,
		destTags: state.tags,
		destTagFolders: state.tagFolders,
		destParentId: parentKey
	});
	if (!planned) {
		folderClip = null;
		emitClip();
		pushNotice("コピー元のフォルダが見つかりません。貼り付けを中止しました。");
		return;
	}
	const images = [];
	for (const image of planned.images) {
		const blob = source.blobs.get(image.sourceId);
		if (!blob) {
			pushNotice("コピー元の画像を読み取れなかったため、貼り付けを中止しました。");
			return;
		}
		images.push({
			meta: image.meta,
			original: blob.original,
			thumb: blob.thumb
		});
	}
	const root = planned.folders.find((folder) => folder.id === planned.rootId);
	const view = planned.views.find((entry) => entry.id === planned.rootId)?.view ?? DEFAULT_FOLDER_VIEW;
	try {
		await commitFolderCopy({
			folders: planned.folders,
			views: planned.views,
			tags: planned.tags,
			tagFolders: planned.tagFolders,
			images,
			promoted,
			selectId: planned.rootId
		});
	} catch (error) {
		pushNotice(storageErrorMessage(error, "save"));
		return;
	}
	if (libraryDbName() !== destDb || libraryConnectionEpoch() !== destEpoch) return;
	setState((current) => ({
		...current,
		folders: [...current.folders.map((folder) => promoted && folder.id === promoted.id ? promoted : folder), ...planned.folders],
		items: [...current.items, ...images.map((image) => image.meta)],
		tags: [...current.tags, ...planned.tags],
		tagFolders: [...current.tagFolders, ...planned.tagFolders],
		views: {
			...current.views,
			...Object.fromEntries(planned.views.map((entry) => [entry.id, entry.view]))
		},
		folderId: planned.rootId,
		columns: view.columns,
		direction: view.direction
	}));
	if (root) pushNotice(`「${root.name}」を貼り付けました。`);
}
async function renameFolder(id, name) {
	if (viewerLock || !userWritesOpen()) return false;
	const trimmed = name.trim().slice(0, 40);
	const folder = state.folders.find((entry) => entry.id === id);
	if (!folder || !trimmed || trimmed === folder.name) return false;
	if (folderNameTaken(trimmed, folder.parentId ?? null, id)) {
		pushNotice("同じ階層に同じ名前のフォルダがあります。");
		return false;
	}
	const next = {
		...folder,
		name: trimmed
	};
	const previous = state.folders;
	setState((current) => ({
		...current,
		folders: current.folders.map((entry) => entry.id === id ? next : entry)
	}));
	try {
		await putFolder(next);
		return true;
	} catch (error) {
		setState((current) => ({
			...current,
			folders: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
		return false;
	}
}
async function moveFolder(sourceId, beforeId, parentId) {
	if (viewerLock || !userWritesOpen()) return;
	const source = state.folders.find((folder) => folder.id === sourceId);
	if (!source) return;
	const nextParent = parentId === void 0 ? source.parentId ?? null : parentId;
	if (folderWouldCycle(state.folders, sourceId, nextParent)) {
		pushNotice("自分自身や、その中にあるフォルダの中には入れられません。");
		return;
	}
	if (nextParent !== (source.parentId ?? null) && folderNameTaken(source.name, nextParent, sourceId)) {
		pushNotice("同じ階層に同じ名前のフォルダがあります。");
		return;
	}
	const ids = state.folders.filter((folder) => folder.id !== sourceId && (folder.parentId ?? null) === nextParent).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt).map((folder) => folder.id);
	if (beforeId !== null && !ids.includes(beforeId)) return;
	ids.splice(beforeId === null ? ids.length : ids.indexOf(beforeId), 0, sourceId);
	const currentIds = state.folders.filter((folder) => (folder.parentId ?? null) === (source.parentId ?? null)).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt).map((folder) => folder.id);
	if ((source.parentId ?? null) === nextParent && currentIds.join("|") === ids.join("|")) return;
	const orderOf = new Map(ids.map((id, order) => [id, order]));
	const previous = state.folders;
	const next = state.folders.map((folder) => {
		if (folder.id === sourceId) return {
			...folder,
			parentId: nextParent,
			order: orderOf.get(sourceId) ?? 0
		};
		const order = orderOf.get(folder.id);
		return order === void 0 ? folder : {
			...folder,
			order
		};
	});
	setState((current) => ({
		...current,
		folders: next
	}));
	try {
		for (const folder of next) {
			const before = previous.find((entry) => entry.id === folder.id);
			if (!before || before.parentId !== folder.parentId || before.order !== folder.order) await putFolder(folder);
		}
	} catch (error) {
		setState((current) => ({
			...current,
			folders: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function nestFolder(sourceId, parentId) {
	if (viewerLock || !userWritesOpen()) return;
	const source = state.folders.find((folder) => folder.id === sourceId);
	const target = state.folders.find((folder) => folder.id === parentId);
	if (!source || !target) return;
	if ((source.parentId ?? null) === parentId) return;
	if (!target.isParent && state.items.some((item) => item.folderId === target.id)) {
		pushNotice("画像が入っているフォルダは親フォルダにできません。画像のないフォルダへドロップしてください。");
		return;
	}
	if (folderWouldCycle(state.folders, sourceId, parentId)) {
		pushNotice("自分自身や、その中にあるフォルダの中には入れられません。");
		return;
	}
	if (folderNameTaken(source.name, parentId, sourceId)) {
		pushNotice("同じ階層に同じ名前のフォルダがあります。");
		return;
	}
	const previous = state.folders;
	const promoted = target.isParent ? null : {
		...target,
		isParent: true,
		color: target.color ?? pickParentColor(state.folders.flatMap((folder) => folder.color ? [folder.color] : []))
	};
	const nextFolder = {
		...source,
		parentId,
		order: state.folders.filter((folder) => (folder.parentId ?? null) === parentId).length
	};
	setState((current) => ({
		...current,
		folders: current.folders.map((folder) => {
			if (folder.id === sourceId) return nextFolder;
			if (promoted && folder.id === promoted.id) return promoted;
			return folder;
		})
	}));
	try {
		await putFolder(nextFolder);
		if (promoted) await putFolder(promoted);
	} catch (error) {
		setState((current) => ({
			...current,
			folders: previous
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function removeFolder(id) {
	if (viewerLock || !userWritesOpen()) return;
	const folder = state.folders.find((entry) => entry.id === id);
	if (!folder) return;
	const doomed = /* @__PURE__ */ new Set([id, ...descendantFolderIds(state.folders, id)]);
	const remaining = state.folders.filter((entry) => !doomed.has(entry.id));
	if (remaining.length === 0) {
		pushNotice("最後のフォルダは削除できません。");
		return;
	}
	const imageIds = state.items.filter((item) => doomed.has(item.folderId)).map((item) => item.id);
	const removed = [];
	for (const imageId of imageIds) {
		if (deleting.has(imageId)) continue;
		deleting.add(imageId);
		try {
			await deleteImage(imageId);
			forgetThumb(imageId);
			releaseOriginal(imageId);
			removed.push(imageId);
		} catch (error) {
			pushNotice(storageErrorMessage(error, "delete"));
			break;
		} finally {
			deleting.delete(imageId);
		}
	}
	if (removed.length !== imageIds.length) {
		const gone = new Set(removed);
		if (gone.size > 0) {
			setState((current) => ({
				...current,
				items: current.items.filter((item) => !gone.has(item.id))
			}));
			persistedKey = orderKey(state.items);
		}
		return;
	}
	const deletedFolderIds = [];
	let folderError = null;
	for (const folderId of doomed) try {
		await deleteFolderRecord(folderId);
		await deleteFolderView(folderId);
		deletedFolderIds.push(folderId);
	} catch (error) {
		folderError = error;
		break;
	}
	const goneFolders = new Set(deletedFolderIds);
	const goneImages = new Set(removed);
	const previousId = state.folderId;
	const nextFolderId = goneFolders.has(previousId) ? folder.parentId && !goneFolders.has(folder.parentId) ? folder.parentId : remaining.find((entry) => !goneFolders.has(entry.id))?.id ?? previousId : previousId;
	const homeView = nextFolderId !== previousId ? viewFor(nextFolderId) : null;
	setState((current) => {
		const views = { ...current.views };
		for (const folderId of goneFolders) delete views[folderId];
		return {
			...current,
			folders: current.folders.filter((entry) => !goneFolders.has(entry.id)),
			folderId: nextFolderId,
			columns: homeView ? homeView.columns : current.columns,
			direction: homeView ? homeView.direction : current.direction,
			views,
			items: current.items.filter((item) => !goneImages.has(item.id)),
			pendingAdd: current.pendingAdd && doomed.has(current.pendingAdd.parentId) ? null : current.pendingAdd
		};
	});
	persistedKey = orderKey(state.items);
	if (folderError) pushNotice(storageErrorMessage(folderError, "delete"));
	if (previousId !== nextFolderId) try {
		await writeKv("folder", nextFolderId);
	} catch (error) {
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function saveFolderWidth(width) {
	if (viewerLock || !userWritesOpen()) return;
	const next = Math.min(420, Math.max(180, Math.round(width)));
	setState((current) => ({
		...current,
		folderWidth: next
	}));
	try {
		await writeKv("folderWidth", next);
	} catch (error) {
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function saveFolderPane(height) {
	if (viewerLock || !userWritesOpen()) return;
	const next = Math.min(720, Math.max(140, Math.round(height)));
	setState((current) => ({
		...current,
		folderPane: next
	}));
	try {
		await writeKv("folderPane", next);
	} catch (error) {
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function saveFavoritesOnly(on) {
	if (!userWritesOpen()) return;
	setState((current) => ({
		...current,
		favoritesOnly: on
	}));
	try {
		await writeKv("favoritesOnly", on ? 1 : 0);
	} catch (error) {
		setState((current) => ({
			...current,
			favoritesOnly: !on
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
async function saveFolderOpen(open) {
	if (viewerLock || !userWritesOpen()) return;
	setState((current) => ({
		...current,
		folderOpen: open
	}));
	try {
		await writeKv("folderOpen", open ? 1 : 0);
	} catch (error) {
		setState((current) => ({
			...current,
			folderOpen: !open
		}));
		pushNotice(storageErrorMessage(error, "save"));
	}
}
function PdfPreview({ open, items, columns, onOpenChange }) {
	const [orientation, setOrientation] = (0, import_react.useState)("portrait");
	const [mode, setMode] = (0, import_react.useState)("fit");
	const [favoritesOnly, setFavoritesOnly] = (0, import_react.useState)(false);
	const [marginMm, setMarginMm] = (0, import_react.useState)(10);
	const [gapMm, setGapMm] = (0, import_react.useState)(2);
	const [urls, setUrls] = (0, import_react.useState)({});
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const pdfOptions = {
		orientation,
		columns,
		mode,
		marginMm,
		gapMm,
		favoritesOnly
	};
	const layout = layoutPdfSelection(items, pdfOptions);
	const picked = favoritesOnly ? items.filter((item) => item.favorite) : items;
	(0, import_react.useEffect)(() => {
		if (!open) return;
		let cancelled = false;
		const created = [];
		Promise.all(items.map(async (item) => {
			const blob = await readPixels(item.id, "thumb");
			if (!blob) return [item.id, ""];
			const url = URL.createObjectURL(blob);
			created.push(url);
			return [item.id, url];
		})).then((pairs) => {
			if (cancelled) {
				created.forEach((url) => URL.revokeObjectURL(url));
				return;
			}
			setUrls(Object.fromEntries(pairs.filter((pair) => pair[1])));
		});
		return () => {
			cancelled = true;
			created.forEach((url) => URL.revokeObjectURL(url));
			setUrls({});
		};
	}, [open, items]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "sheet-overlay" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "sheet-content",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start justify-between gap-3 border-b border-line px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
						className: "font-medium",
						children: "PDFプレビュー"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, {
						className: "text-sm text-ink-muted",
						children: [favoritesOnly ? "お気に入りだけを出力します。" : "フォルダ内の画像を出力します。", mode === "fit" ? "用紙を埋めるように並べ直します。画面の順番と大きさは変わりません。" : "いまの順番と表示サイズの関係を保って、A4に収めます。"]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							children: "閉じる"
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2 px-4 pt-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: mode === "normal" ? "primary" : "quiet",
							onClick: () => setMode("normal"),
							children: "通常"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: mode === "fit" ? "primary" : "quiet",
							onClick: () => setMode("fit"),
							children: "フィット"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: favoritesOnly ? "primary" : "quiet",
							"aria-pressed": favoritesOnly,
							onClick: () => setFavoritesOnly((value) => !value),
							children: favoritesOnly ? "お気に入りのみ" : "すべての画像"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: orientation === "portrait" ? "primary" : "quiet",
							onClick: () => setOrientation("portrait"),
							children: "A4縦"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: orientation === "landscape" ? "primary" : "quiet",
							onClick: () => setOrientation("landscape"),
							children: "A4横"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "self-center text-sm text-ink-muted tabular-nums",
							children: [layout.pageCount, "ページ"]
						})
					]
				}),
				mode === "fit" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2 px-4 pt-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm text-ink-muted",
							children: "余白"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							"aria-label": "余白を狭く",
							disabled: marginMm <= 4,
							onClick: () => setMarginMm((value) => clampPdfMargin(value - 2)),
							children: "−"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-12 text-center text-sm tabular-nums",
							children: [marginMm, "mm"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							"aria-label": "余白を広く",
							disabled: marginMm >= 24,
							onClick: () => setMarginMm((value) => clampPdfMargin(value + 2)),
							children: "＋"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-2 text-sm text-ink-muted",
							children: "間隔"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							"aria-label": "間隔を狭く",
							disabled: gapMm <= 0,
							onClick: () => setGapMm((value) => clampPdfGap(value - 1)),
							children: "−"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-12 text-center text-sm tabular-nums",
							children: [gapMm, "mm"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							"aria-label": "間隔を広く",
							disabled: gapMm >= 8,
							onClick: () => setGapMm((value) => clampPdfGap(value + 1)),
							children: "＋"
						})
					]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pdf-scroll px-4 py-4",
					children: [picked.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-ink-muted",
						children: "出力できる画像がありません。"
					}) : null, Array.from({ length: layout.pageCount }, (_, page) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "pdf-sheet",
						style: { aspectRatio: `${layout.pageWidth} / ${layout.pageHeight}` },
						children: layout.placements.filter((place) => place.page === page).map((place) => urls[place.id] ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: urls[place.id],
							alt: "",
							style: {
								left: `${place.x / layout.pageWidth * 100}%`,
								top: `${place.y / layout.pageHeight * 100}%`,
								width: `${place.w / layout.pageWidth * 100}%`,
								height: `${place.h / layout.pageHeight * 100}%`
							}
						}, place.id) : null)
					}, `${mode}-${favoritesOnly}-${orientation}-${page}`))]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3 border-t border-line px-4 py-3",
					children: [error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "alert",
						className: "text-sm text-danger",
						children: error
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						disabled: saving || picked.length === 0,
						onClick: () => {
							setSaving(true);
							setError(null);
							buildPortfolioPdf(items, pdfOptions).then((blob) => {
								const url = URL.createObjectURL(blob);
								const link = document.createElement("a");
								link.href = url;
								link.download = "komacho.pdf";
								link.click();
								URL.revokeObjectURL(url);
							}).catch(() => {
								const message = "PDFを書き出せませんでした。もう一度保存を押してください。";
								setError(message);
								notify(message);
							}).finally(() => setSaving(false));
						},
						children: saving ? "書き出し中" : error ? "再試行" : "PDFを保存"
					})]
				})
			]
		})] })
	});
}
/** Still images only, in the gallery order already applied to `items`. */
function slideshowCandidates(items) {
	return items.filter((item) => item.mime.startsWith("image/"));
}
/** Integer seconds from 1 through 10. Anything else falls back to 5. */
function clampSlideSeconds(value) {
	if (!Number.isFinite(value)) return 5;
	return Math.min(10, Math.max(1, Math.round(value)));
}
function startDeck(count, order, random = Math.random) {
	if (count <= 0) return {
		deck: [],
		at: 0
	};
	if (count === 1 || order === "sequence") return {
		deck: indexes(count),
		at: 0
	};
	return {
		deck: shuffleDeck(count, -1, random),
		at: 0
	};
}
/** Next slide. Sequence wraps. Random finishes the deck, then shuffles again without repeating the last image. */
function advanceDeck(cursor, count, order, random = Math.random) {
	if (count <= 1) return startDeck(count, order, random);
	if (cursor.at + 1 < cursor.deck.length) return {
		deck: cursor.deck,
		at: cursor.at + 1
	};
	if (order === "sequence") return {
		deck: cursor.deck.length === count ? cursor.deck : indexes(count),
		at: 0
	};
	return {
		deck: shuffleDeck(count, cursor.deck[cursor.deck.length - 1] ?? -1, random),
		at: 0
	};
}
function indexes(count) {
	return Array.from({ length: count }, (_, index) => index);
}
function shuffleDeck(count, avoidFirst, random) {
	const deck = indexes(count);
	for (let index = count - 1; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1));
		const current = deck[index] ?? index;
		deck[index] = deck[swap] ?? current;
		deck[swap] = current;
	}
	if (avoidFirst >= 0 && deck[0] === avoidFirst) {
		const swap = 1 + Math.floor(random() * (count - 1));
		const current = deck[0] ?? 0;
		deck[0] = deck[swap] ?? current;
		deck[swap] = current;
	}
	return deck;
}
var EMPTY_NOTE = "表示中の画像がないため、スライドショーを開始できません。";
function Slideshow({ open, items, onOpenChange }) {
	const [order, setOrder] = (0, import_react.useState)("sequence");
	const [seconds, setSeconds] = (0, import_react.useState)(5);
	const [play, setPlay] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		if (open) return;
		setPlay(null);
		setOrder("sequence");
		setSeconds(5);
	}, [open]);
	if (!open || typeof document === "undefined") return null;
	if (play) return (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlideshowPlayer, {
		items: play.items,
		order: play.order,
		seconds: play.seconds,
		onClose: () => onOpenChange(false)
	}), document.body);
	const start = () => {
		const list = slideshowCandidates(items).slice();
		if (list.length === 0) {
			notify(EMPTY_NOTE);
			onOpenChange(false);
			return;
		}
		setPlay({
			items: list,
			order,
			seconds: clampSlideSeconds(seconds)
		});
	};
	return (0, import_react_dom.createPortal)(/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "slideshow-setup",
		onPointerDown: () => onOpenChange(false),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "slideshow-setup-card",
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "slideshow-title",
			onPointerDown: (event) => event.stopPropagation(),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: "slideshow-title",
					className: "m-0 text-base font-medium",
					children: "スライドショー"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 mt-1 text-sm text-ink-muted",
					children: "いま一覧に出ている画像を再生します。"
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "m-0 text-sm",
					children: "画像の順番"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "slideshow-choices",
					role: "group",
					"aria-label": "画像の順番",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: order === "sequence" ? "primary" : "quiet",
						"aria-pressed": order === "sequence",
						onClick: () => setOrder("sequence"),
						children: "順番どおり"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: order === "random" ? "primary" : "quiet",
						"aria-pressed": order === "random",
						onClick: () => setOrder("random"),
						children: "ランダム"
					})]
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-sm",
					children: ["切り替え間隔", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						"aria-label": "切り替え間隔",
						value: seconds,
						onChange: (event) => setSeconds(clampSlideSeconds(Number(event.target.value))),
						children: Array.from({ length: 10 }, (_, index) => index + 1).map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("option", {
							value,
							children: [value, "秒"]
						}, value))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "slideshow-actions",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "quiet",
						onClick: () => onOpenChange(false),
						children: "キャンセル"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						onClick: start,
						children: "開始"
					})]
				})
			]
		})
	}), document.body);
}
function SlideshowPlayer({ items, order, seconds, onClose }) {
	const onCloseRef = (0, import_react.useRef)(onClose);
	onCloseRef.current = onClose;
	const [layers, setLayers] = (0, import_react.useState)([]);
	const tokenRef = (0, import_react.useRef)(0);
	(0, import_react.useEffect)(() => {
		let alive = true;
		const urls = /* @__PURE__ */ new Map();
		let timer = 0;
		let reveal = 0;
		let failures = 0;
		let cursor = startDeck(items.length, order);
		let pending = null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		const urlFor = async (id) => {
			const cached = urls.get(id);
			if (cached) return cached;
			const blob = await readPixels(id, "original");
			if (!blob || !alive) return null;
			const url = URL.createObjectURL(blob);
			urls.set(id, url);
			return url;
		};
		const warm = (index) => {
			const item = index === void 0 ? void 0 : items[index];
			if (!item) return;
			urlFor(item.id).then((url) => {
				if (url && alive) decodeImage(url).catch(() => void 0);
			});
		};
		const show = async (index) => {
			if (!alive) return;
			const item = items[index];
			if (!item) return;
			const url = await urlFor(item.id);
			if (!alive) return;
			if (!url) {
				failures += 1;
				if (failures > items.length) return;
				pending = null;
				cursor = advanceDeck(cursor, items.length, order);
				show(cursor.deck[cursor.at] ?? index);
				return;
			}
			try {
				await decodeImage(url);
			} catch {}
			if (!alive) return;
			failures = 0;
			const token = tokenRef.current + 1;
			tokenRef.current = token;
			setLayers((current) => [...current.map((layer) => ({
				...layer,
				on: false
			})), {
				token,
				url,
				on: false
			}].slice(-2));
			reveal = window.requestAnimationFrame(() => {
				reveal = window.requestAnimationFrame(() => {
					if (!alive) return;
					setLayers((current) => current.map((layer) => layer.token === token ? {
						...layer,
						on: true
					} : layer));
				});
			});
			pending = advanceDeck(cursor, items.length, order);
			warm(pending.deck[pending.at]);
			timer = window.setTimeout(() => {
				if (!alive || !pending) return;
				cursor = pending;
				pending = null;
				show(cursor.deck[cursor.at] ?? 0);
			}, seconds * 1e3);
		};
		show(cursor.deck[cursor.at] ?? 0);
		const onKey = (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (event.key === "Escape") onCloseRef.current();
		};
		window.addEventListener("keydown", onKey, true);
		return () => {
			alive = false;
			window.clearTimeout(timer);
			window.cancelAnimationFrame(reveal);
			window.removeEventListener("keydown", onKey, true);
			document.body.style.overflow = previousOverflow;
			for (const url of urls.values()) URL.revokeObjectURL(url);
		};
	}, [
		items,
		order,
		seconds
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "slideshow-stage",
		role: "button",
		tabIndex: 0,
		"aria-label": "スライドショーを終了",
		onPointerDown: (event) => event.stopPropagation(),
		onClick: (event) => {
			event.preventDefault();
			event.stopPropagation();
			onClose();
		},
		children: layers.map((layer) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: layer.on ? "slideshow-photo is-on" : "slideshow-photo",
			style: { ["--slide-ms"]: `${seconds * 1e3}ms` },
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: layer.url,
				alt: "",
				draggable: false
			})
		}, layer.token))
	});
}
function decodeImage(url) {
	const image = new Image();
	image.decoding = "async";
	const ready = new Promise((resolve, reject) => {
		image.onload = () => resolve();
		image.onerror = () => reject(/* @__PURE__ */ new Error("load"));
	});
	image.src = url;
	if (typeof image.decode === "function") return image.decode().catch(() => ready);
	return ready;
}
var MAX_PIECES = 32;
var LINE = /^K1\.([0-9a-f]{8})\.(\d+)\.(\d+)\.([A-Za-z0-9_-]+)$/;
function emptyGather() {
	return {
		id: null,
		count: 0,
		parts: []
	};
}
function bytesToBase64Url(bytes) {
	let binary = "";
	for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index] ?? 0);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function base64UrlToBytes(value) {
	const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
	const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
	return bytes;
}
function assertSignal(message) {
	if (message.v !== 1 || message.k !== "offer" && message.k !== "answer") throw new Error("接続情報の形式が違います。");
	if (!message.sdp.startsWith("v=0") || !message.sdp.includes("m=application")) throw new Error("接続情報が途中で切れています。すべてのQRを読み取り直してください。");
}
function gatherChunks(current, raw) {
	const lines = raw.split(/\s+/).map((line) => line.trim()).filter(Boolean);
	if (lines.length === 0) return {
		gather: current,
		signal: null,
		note: "接続情報が空です。"
	};
	const next = {
		id: current.id,
		count: current.count,
		parts: current.parts.slice()
	};
	let replaced = false;
	for (const line of lines) {
		const match = LINE.exec(line);
		if (!match) throw new Error("QRの形式が正しくありません。途中で切れていないか確認してください。");
		const id = match[1] ?? "";
		const index = Number(match[2]);
		const count = Number(match[3]);
		const piece = match[4] ?? "";
		if (!Number.isInteger(index) || !Number.isInteger(count) || count < 1 || count > MAX_PIECES || index < 1 || index > count) throw new Error("QRの順番が正しくありません。");
		if (next.id && next.id !== id) {
			next.id = id;
			next.count = count;
			next.parts = Array.from({ length: count }, () => "");
			replaced = true;
		}
		if (!next.id) {
			next.id = id;
			next.count = count;
			next.parts = Array.from({ length: count }, () => "");
		}
		if (count !== next.count) throw new Error("QRの枚数が一致しません。最初から読み取り直してください。");
		const previous = next.parts[index - 1] ?? "";
		if (previous && previous !== piece) throw new Error("同じ番号のQRの内容が違います。読み取り直してください。");
		next.parts[index - 1] = piece;
	}
	const have = next.parts.filter(Boolean).length;
	if (have < next.count) return {
		gather: next,
		signal: null,
		note: `${replaced ? "新しい接続情報を読み始めたので、前の読み取りは破棄しました。" : ""}${have}/${next.count} を読み取りました。残りのQRも読み取ってください。`
	};
	let message;
	try {
		message = JSON.parse(strFromU8(gunzipSync(base64UrlToBytes(next.parts.join("")))));
		assertSignal(message);
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("接続情報")) throw error;
		throw new Error("接続情報を結合できませんでした。QRが欠けていないか確認してください。");
	}
	return {
		gather: emptyGather(),
		signal: message,
		note: "接続情報を結合しました。"
	};
}
async function digestHex(bytes) {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	const hash = await crypto.subtle.digest("SHA-256", copy);
	return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
var FILE_CHUNK = 16384;
var CONNECT_STAGES = [
	"qr",
	"parse",
	"prepare",
	"ice",
	"channel",
	"file"
];
function stageLabel(stage) {
	if (stage === "qr") return "QRコードの読み取り";
	if (stage === "parse") return "接続情報の解析";
	if (stage === "prepare") return "WebRTC接続の準備";
	if (stage === "ice") return "ICE接続の成立";
	if (stage === "channel") return "DataChannel接続の成立";
	return "テストファイルの送信・受信";
}
function failureNote(stage, detail) {
	return `${stageLabel(stage)}の段階で失敗しました。${detail} 外部サービスなしでは、この先へ直接接続できない可能性があります。`;
}
function timeoutStage(ice) {
	return ice === "connected" || ice === "completed" ? "channel" : "ice";
}
function sdpHasCandidate(sdp) {
	return sdp.split(/\r?\n/).some((line) => line.startsWith("a=candidate:"));
}
function sdpDeferRemoteChecks(sdp) {
	return `${sdp.split(/\r?\n/).filter((line) => line.length > 0 && !line.startsWith("a=candidate:") && line !== "a=end-of-candidates").map((line) => {
		if (line.startsWith("m=application ")) {
			const parts = line.split(" ");
			if (parts.length >= 2) parts[1] = "9";
			return parts.join(" ");
		}
		if (line.startsWith("c=")) return "c=IN IP4 0.0.0.0";
		return line;
	}).join("\r\n")}\r\n`;
}
/** Version 40, error correction L, byte mode. Do not put more than this in one QR. */
var QR_BYTE_LIMIT = 2953;
var ANSWER_RETURN_LIMIT = "ブラウザはスマホの応答をPCへ自動で返せません。外部の中継サーバーもPCのカメラも使わないため、応答の文字列を1回だけコピーしてPCに貼り付けてください。4桁の番号は貼り付けの確認だけです。番号だけでは接続できません。";
function qrByteLength(text) {
	return new TextEncoder().encode(text).length;
}
function signalPayload(message) {
	assertSignal(message);
	return bytesToBase64Url(gzipSync(strToU8(JSON.stringify(message))));
}
function isLoopbackHost(hostname) {
	const host = hostname.toLowerCase().replaceAll("[", "").replaceAll("]", "");
	return host === "localhost" || host === "127.0.0.1" || host === "::1";
}
function isPrivateIpv4(address) {
	const parts = address.split(".");
	if (parts.length !== 4) return false;
	const nums = parts.map((part) => Number(part));
	if (nums.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
	const a = nums[0] ?? -1;
	const b = nums[1] ?? -1;
	if (a === 10) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	return a === 192 && b === 168;
}
function hostCandidateForPage(sdp) {
	for (const line of sdp.split(/\r?\n/)) {
		if (!line.startsWith("a=candidate:") || !line.includes(" typ host")) continue;
		const address = line.split(" ")[4] ?? "";
		if (isPrivateIpv4(address)) return address;
	}
	return null;
}
function pageUrlForPhone(pageUrl, sdp) {
	const url = new URL(pageUrl);
	url.hash = "";
	if (!isLoopbackHost(url.hostname)) return {
		url: url.toString(),
		note: ""
	};
	const ip = hostCandidateForPage(sdp);
	if (!ip) return {
		url: url.toString(),
		note: "このページはPCの中（localhost）でしか開けません。スマホのカメラで読み取ってもアプリは開きません。同じWi-FiのPCの住所でアプリを開いてから、もう一度QRを作ってください。"
	};
	url.hostname = ip;
	return {
		url: url.toString(),
		note: `スマホが同じネットワークから開けるよう、QRの住所を ${ip} にしました。その住所でこのアプリが見えないときは、読み取っても接続画面は開きません。`
	};
}
function connectionUrl(pageUrl, message) {
	const url = new URL(pageUrl);
	if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("接続用の住所を作れません。");
	url.hash = "";
	return `${url.origin}${url.pathname}${url.search}#k1=${signalPayload(message)}`;
}
function safeDecode(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
function extractPayload(raw) {
	const text = raw.trim();
	if (!text) throw new Error("接続情報が空です。");
	const marker = text.indexOf("#k1=");
	if (marker >= 0) {
		const payload = safeDecode((text.slice(marker + 4).split(/\s/)[0] ?? "").trim());
		if (!payload) throw new Error("接続情報が見つかりません。検索には移動しません。");
		if (payload.includes("K1.") && payload.includes("~")) return payload.split("~").join("\n");
		return payload;
	}
	if (text.includes("K1.")) return text;
	if (/^[A-Za-z0-9_-]+$/.test(text)) return text;
	throw new Error("接続情報が見つかりません。この文字では検索へ移動しません。");
}
function parseConnectionText(raw) {
	const input = extractPayload(raw);
	if (input.includes("K1.")) {
		const result = gatherChunks(emptyGather(), input);
		if (!result.signal) throw new Error("1回分の接続情報が揃っていません。短く切ってはいません。");
		return result.signal;
	}
	try {
		const message = JSON.parse(strFromU8(gunzipSync(base64UrlToBytes(input))));
		assertSignal(message);
		return message;
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("接続情報")) throw error;
		throw new Error("接続情報を解析できませんでした。途中で切れていないか確認してください。");
	}
}
async function confirmCode(sdp) {
	const hex = await digestHex(new TextEncoder().encode(sdp));
	return String(Number.parseInt(hex.slice(0, 8), 16) % 1e4).padStart(4, "0");
}
async function gateAnswer(raw, code) {
	const digits = code.trim();
	const text = raw.trim();
	if (!text && digits) return {
		ok: false,
		reason: "number-only",
		detail: "番号だけでは接続できません。スマホに出た応答の文字列を貼り付けてください。4桁は、その貼り付けが正しいかの確認だけです。"
	};
	if (!text) return {
		ok: false,
		reason: "missing",
		detail: "スマホの応答を貼り付けてください。番号だけでは接続できません。"
	};
	let signal;
	try {
		signal = parseConnectionText(text);
	} catch (error) {
		return {
			ok: false,
			reason: "bad",
			detail: error instanceof Error ? error.message : "応答を読めませんでした。"
		};
	}
	if (signal.k !== "answer") return {
		ok: false,
		reason: "not-answer",
		detail: "これは応答ではありません。スマホ側に出た応答を貼り付けてください。番号だけでは接続できません。"
	};
	if (!/^\d{4}$/.test(digits)) return {
		ok: false,
		reason: "need-code",
		detail: "確認用の4桁を入力してください。番号だけでは接続できません。応答と番号が両方一致したときだけ接続します。"
	};
	if (digits !== await confirmCode(signal.sdp)) return {
		ok: false,
		reason: "mismatch",
		detail: "確認番号が応答と一致しないので、接続情報は適用しませんでした。番号だけでは接続できません。"
	};
	return {
		ok: true,
		signal
	};
}
function emptyStages() {
	return {
		qr: "wait",
		parse: "wait",
		prepare: "wait",
		ice: "wait",
		channel: "wait",
		file: "wait"
	};
}
function statusWord(status) {
	if (status === "ok") return "成功";
	if (status === "ng") return "失敗";
	if (status === "now") return "進行中";
	return "待ち";
}
function phaseLabel(phase) {
	if (phase === "preparing") return "接続情報を作っています";
	if (phase === "show-local") return "相手の操作待ち";
	if (phase === "wait-remote") return "QRの読み取り待ち";
	if (phase === "connecting") return "直接接続を試しています";
	if (phase === "open") return "接続できました";
	if (phase === "failed") return "接続できませんでした";
	return "未接続";
}
async function waitForCandidates(pc) {
	if (pc.iceGatheringState === "complete") return;
	await new Promise((resolve, reject) => {
		const finish = () => {
			window.clearTimeout(timer);
			pc.removeEventListener("icecandidate", onCandidate);
			pc.removeEventListener("icegatheringstatechange", onGathering);
			resolve();
		};
		const onCandidate = (event) => {
			if (!event.candidate || pc.iceGatheringState === "complete") finish();
		};
		const onGathering = () => {
			if (pc.iceGatheringState === "complete") finish();
		};
		const timer = window.setTimeout(() => {
			pc.removeEventListener("icecandidate", onCandidate);
			pc.removeEventListener("icegatheringstatechange", onGathering);
			reject(/* @__PURE__ */ new Error("接続候補を集めきれませんでした。中継なしでは、このブラウザで直接接続を準備できないことがあります。"));
		}, 8e3);
		pc.addEventListener("icecandidate", onCandidate);
		pc.addEventListener("icegatheringstatechange", onGathering);
	});
}
function QrLinkDialog({ open, onOpenChange, bootText = null }) {
	const peerRef = (0, import_react.useRef)(null);
	const channelRef = (0, import_react.useRef)(null);
	const roleRef = (0, import_react.useRef)(null);
	const timerRef = (0, import_react.useRef)(null);
	const seenRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
	const videoRef = (0, import_react.useRef)(null);
	const incomingRef = (0, import_react.useRef)(null);
	const downloadRef = (0, import_react.useRef)(null);
	const answerRef = (0, import_react.useRef)(null);
	const linkRef = (0, import_react.useRef)(null);
	const bootSeen = (0, import_react.useRef)("");
	const [role, setRole] = (0, import_react.useState)(null);
	const [phase, setPhase] = (0, import_react.useState)("idle");
	const [stages, setStages] = (0, import_react.useState)(emptyStages);
	const [ice, setIce] = (0, import_react.useState)("new");
	const [gathering, setGathering] = (0, import_react.useState)("new");
	const [channelState, setChannelState] = (0, import_react.useState)("なし");
	const [note, setNote] = (0, import_react.useState)("");
	const [linkText, setLinkText] = (0, import_react.useState)("");
	const [linkNote, setLinkNote] = (0, import_react.useState)("");
	const [qrUrl, setQrUrl] = (0, import_react.useState)("");
	const [qrError, setQrError] = (0, import_react.useState)("");
	const [scanNote, setScanNote] = (0, import_react.useState)("");
	const [paste, setPaste] = (0, import_react.useState)("");
	const [confirmInput, setConfirmInput] = (0, import_react.useState)("");
	const [scanning, setScanning] = (0, import_react.useState)(false);
	const [answerText, setAnswerText] = (0, import_react.useState)("");
	const [answerCode, setAnswerCode] = (0, import_react.useState)("");
	const [sent, setSent] = (0, import_react.useState)("");
	const [sendProgress, setSendProgress] = (0, import_react.useState)(null);
	const [received, setReceived] = (0, import_react.useState)(null);
	const [receiveProgress, setReceiveProgress] = (0, import_react.useState)(null);
	const [failStage, setFailStage] = (0, import_react.useState)("なし");
	const secure = typeof window !== "undefined" && window.isSecureContext;
	const patchStage = (stage, status) => {
		setStages((current) => current[stage] === status ? current : {
			...current,
			[stage]: status
		});
	};
	const release = () => {
		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		timerRef.current = null;
		const channel = channelRef.current;
		channelRef.current = null;
		if (channel) {
			channel.onopen = null;
			channel.onclose = null;
			channel.onmessage = null;
			channel.onerror = null;
			channel.close();
		}
		const peer = peerRef.current;
		peerRef.current = null;
		if (peer) {
			peer.onicecandidate = null;
			peer.ondatachannel = null;
			peer.oniceconnectionstatechange = null;
			peer.close();
		}
		if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
		downloadRef.current = null;
		incomingRef.current = null;
		setScanning(false);
	};
	const reset = () => {
		release();
		roleRef.current = null;
		seenRef.current.clear();
		setRole(null);
		setPhase("idle");
		setStages(emptyStages());
		setIce("new");
		setGathering("new");
		setChannelState("なし");
		setNote("");
		setLinkText("");
		setLinkNote("");
		setQrUrl("");
		setQrError("");
		setScanNote("");
		setPaste("");
		setConfirmInput("");
		setAnswerText("");
		setAnswerCode("");
		setSent("");
		setSendProgress(null);
		setReceived(null);
		setReceiveProgress(null);
		setFailStage("なし");
	};
	const markFailed = (stage, detail) => {
		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		timerRef.current = null;
		setFailStage(stageLabel(stage));
		setStages((current) => ({
			...current,
			[stage]: "ng"
		}));
		setPhase("failed");
		setNote(failureNote(stage, detail));
	};
	const armTimeout = (pc) => {
		if (timerRef.current !== null) window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(() => {
			if (channelRef.current?.readyState === "open") return;
			const iceState = pc.iceConnectionState;
			if (timeoutStage(iceState) === "channel") {
				markFailed("channel", "ICEはつながりましたが、データチャネルが開きませんでした。最初からやり直せます。");
				return;
			}
			markFailed("ice", `状態は ${iceState} です。同じネットワークでも、中継なしでは直接つながらないことがあります。最初からやり直せます。`);
		}, 2e4);
	};
	const bindChannel = (channel) => {
		channel.binaryType = "arraybuffer";
		channel.bufferedAmountLowThreshold = 65536;
		const mark = () => setChannelState(channel.readyState);
		channel.onopen = () => {
			mark();
			if (timerRef.current !== null) window.clearTimeout(timerRef.current);
			timerRef.current = null;
			setPhase("open");
			setStages((current) => ({
				...current,
				ice: "ok",
				channel: "ok",
				file: current.file === "ok" ? "ok" : "now"
			}));
			setNote(roleRef.current === "pc" ? "データチャネルが開きました。テストファイルを送れます。" : "データチャネルが開きました。PCからのテストファイルを待っています。");
		};
		channel.onclose = () => {
			mark();
			const incoming = incomingRef.current;
			if (incoming && incoming.got < incoming.size) {
				incomingRef.current = null;
				markFailed("channel", "受信が完了する前に切断しました。PCからもう一度送信してください。");
				return;
			}
			setNote((current) => current || "データチャネルが閉じました。");
		};
		channel.onerror = () => {
			if (channel.readyState === "open") return;
			markFailed("channel", "データチャネルでエラーが起きました。最初からやり直せます。");
		};
		channel.onmessage = (event) => {
			receive(event.data);
		};
		mark();
	};
	const bindPeer = (pc) => {
		pc.oniceconnectionstatechange = () => {
			const state = pc.iceConnectionState;
			setIce(state);
			setGathering(pc.iceGatheringState);
			if (state === "checking") {
				patchStage("ice", "now");
				armTimeout(pc);
			}
			if (state === "connected" || state === "completed") setStages((current) => ({
				...current,
				ice: "ok",
				channel: current.channel === "ok" || current.channel === "ng" ? current.channel : "now"
			}));
			if (state === "failed") markFailed("ice", "端末同士の直接通信が成立しませんでした。最初からやり直せます。");
		};
	};
	const receive = async (data) => {
		if (typeof data === "string") {
			let message;
			try {
				message = JSON.parse(data);
			} catch {
				patchStage("file", "ng");
				setFailStage(stageLabel("file"));
				setNote(`${stageLabel("file")}の段階で失敗しました。受信データの形式が正しくありません。`);
				incomingRef.current = null;
				return;
			}
			if (message.t === "begin" && typeof message.name === "string" && typeof message.hash === "string" && typeof message.size === "number") {
				if (!/^[\w.-]{1,80}$/.test(message.name) || !Number.isSafeInteger(message.size) || message.size < 0 || message.size > 262144) {
					setNote("テスト用ではないデータは受け取りませんでした。");
					incomingRef.current = null;
					return;
				}
				incomingRef.current = {
					name: message.name,
					size: message.size,
					hash: message.hash,
					parts: [],
					got: 0
				};
				setReceiveProgress({
					name: message.name,
					got: 0,
					size: message.size
				});
				setReceived(null);
				patchStage("file", "now");
				return;
			}
			if (message.t === "end") {
				const incoming = incomingRef.current;
				incomingRef.current = null;
				if (!incoming || incoming.got !== incoming.size) {
					patchStage("file", "ng");
					setFailStage(stageLabel("file"));
					setNote(`${stageLabel("file")}の段階で失敗しました。受信が完了する前に切れました。もう一度送信してください。`);
					return;
				}
				const bytes = new Uint8Array(incoming.got);
				let offset = 0;
				for (const part of incoming.parts) {
					bytes.set(part, offset);
					offset += part.byteLength;
				}
				const match = await digestHex(bytes) === incoming.hash;
				if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
				const url = URL.createObjectURL(new Blob([bytes], { type: "text/plain" }));
				downloadRef.current = url;
				setReceived({
					name: incoming.name,
					size: incoming.size,
					text: new TextDecoder().decode(bytes),
					match,
					url
				});
				if (match) {
					patchStage("file", "ok");
					setNote("受信した内容は送信データと一致しました。");
				} else {
					patchStage("file", "ng");
					setFailStage(stageLabel("file"));
					setNote(`${stageLabel("file")}の段階で失敗しました。受信しましたが、内容が一致しません。`);
				}
			}
			return;
		}
		const incoming = incomingRef.current;
		if (!incoming) {
			setNote(`${stageLabel("file")}の段階で、開始情報のないデータを受信したため破棄しました。`);
			return;
		}
		const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : null;
		if (!bytes) {
			incomingRef.current = null;
			patchStage("file", "ng");
			setFailStage(stageLabel("file"));
			setNote(`${stageLabel("file")}の段階で失敗しました。受信データの形式が正しくありません。`);
			return;
		}
		if (incoming.got + bytes.byteLength > incoming.size) {
			incomingRef.current = null;
			patchStage("file", "ng");
			setFailStage(stageLabel("file"));
			setNote(`${stageLabel("file")}の段階で失敗しました。受信データが宣言より大きいため中断しました。`);
			return;
		}
		incoming.parts.push(bytes);
		incoming.got += bytes.byteLength;
		setReceiveProgress({
			name: incoming.name,
			got: incoming.got,
			size: incoming.size
		});
	};
	const ensurePhone = () => {
		release();
		roleRef.current = "phone";
		seenRef.current.clear();
		setRole("phone");
		setAnswerText("");
		setAnswerCode("");
		setFailStage("なし");
		setSent("");
		setReceived(null);
		setSendProgress(null);
		setReceiveProgress(null);
		setPhase("wait-remote");
		const pc = new RTCPeerConnection({ iceServers: [] });
		peerRef.current = pc;
		bindPeer(pc);
		pc.ondatachannel = (event) => {
			channelRef.current = event.channel;
			bindChannel(event.channel);
		};
		return pc;
	};
	const acceptSignal = async (signal, pc, cancelled) => {
		const stop = () => cancelled?.() ?? false;
		const currentRole = roleRef.current;
		if (stop() || peerRef.current !== pc || !currentRole) return;
		try {
			if (currentRole === "phone") {
				if (signal.k !== "offer") return;
				patchStage("prepare", "now");
				const deferred = sdpDeferRemoteChecks(signal.sdp);
				try {
					await pc.setRemoteDescription({
						type: "offer",
						sdp: deferred
					});
				} catch {
					await pc.setRemoteDescription({
						type: "offer",
						sdp: signal.sdp
					});
				}
				if (stop() || peerRef.current !== pc) return;
				const answer = await pc.createAnswer();
				await pc.setLocalDescription(answer);
				await waitForCandidates(pc);
				if (stop() || peerRef.current !== pc) return;
				const sdp = pc.localDescription?.sdp ?? "";
				const packed = signalPayload({
					v: 1,
					k: "answer",
					sdp
				});
				const code = await confirmCode(sdp);
				if (stop() || peerRef.current !== pc) return;
				setAnswerText(packed);
				setAnswerCode(code);
				patchStage("prepare", "ok");
				setPhase("show-local");
				setGathering(pc.iceGatheringState);
				setNote(sdpHasCandidate(sdp) ? `${ANSWER_RETURN_LIMIT} PCが応答を取り込むまで、こちらから接続は始めません。PC側が失敗しても、その結果はこちらへ自動では届きません。` : "応答は作りました。ただし接続候補がありません。中継なしではつながらない可能性が高いです。");
				return;
			}
			if (signal.k !== "answer") return;
			await pc.setRemoteDescription({
				type: "answer",
				sdp: signal.sdp
			});
			if (stop() || peerRef.current !== pc) return;
			patchStage("ice", "now");
			setPhase("connecting");
			setGathering(pc.iceGatheringState);
			setNote("応答を確認しました。直接接続を待っています。番号だけでは接続していません。");
			armTimeout(pc);
		} catch (error) {
			if (stop() || peerRef.current !== pc) return;
			markFailed(currentRole === "phone" ? "prepare" : "parse", error instanceof Error ? error.message : "接続情報を適用できませんでした。画像データは変更していません。");
		}
	};
	const acceptOfferText = async (raw, cancelled) => {
		const stop = () => cancelled?.() ?? false;
		if (stop()) return;
		setRole("phone");
		roleRef.current = "phone";
		setStages({
			...emptyStages(),
			qr: "ok",
			parse: "now"
		});
		let signal;
		try {
			signal = parseConnectionText(raw);
		} catch (error) {
			if (stop()) return;
			markFailed("parse", error instanceof Error ? error.message : "接続情報を解析できませんでした。");
			return;
		}
		if (signal.k !== "offer") {
			if (stop()) return;
			markFailed("parse", "スマホ側で読むのはPCの接続情報です。応答はここでは使いません。");
			return;
		}
		if (stop()) return;
		setScanning(false);
		const pc = ensurePhone();
		setStages({
			...emptyStages(),
			qr: "ok",
			parse: "ok",
			prepare: "now"
		});
		if (stop() || peerRef.current !== pc) return;
		await acceptSignal(signal, pc, cancelled);
	};
	const startPc = async () => {
		release();
		roleRef.current = "pc";
		seenRef.current.clear();
		setRole("pc");
		setStages({
			...emptyStages(),
			prepare: "now"
		});
		setPhase("preparing");
		setLinkText("");
		setLinkNote("");
		setQrUrl("");
		setQrError("");
		setAnswerText("");
		setAnswerCode("");
		setPaste("");
		setConfirmInput("");
		setScanNote("");
		setReceived(null);
		setSent("");
		setSendProgress(null);
		setReceiveProgress(null);
		setFailStage("なし");
		setNote("接続候補を集めています。外部の中継は使いません。");
		let pc = null;
		try {
			pc = new RTCPeerConnection({ iceServers: [] });
			peerRef.current = pc;
			bindPeer(pc);
			const channel = pc.createDataChannel("komacho-test");
			channelRef.current = channel;
			bindChannel(channel);
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			await waitForCandidates(pc);
			if (peerRef.current !== pc) return;
			const sdp = pc.localDescription?.sdp ?? "";
			const page = pageUrlForPhone(window.location.href, sdp);
			const link = connectionUrl(page.url, {
				v: 1,
				k: "offer",
				sdp
			});
			setLinkText(link);
			setLinkNote(page.note);
			setGathering(pc.iceGatheringState);
			const tooBig = qrByteLength(link) > QR_BYTE_LIMIT;
			patchStage("prepare", sdpHasCandidate(sdp) ? "ok" : "ng");
			if (!sdpHasCandidate(sdp)) {
				setFailStage(stageLabel("prepare"));
				setNote(`${failureNote("prepare", "接続候補がありません。")} ${page.note}`.trim());
			}
			if (tooBig) {
				setQrError("接続情報を1枚のQRに収められません。短く切ってはいません。下の住所を1回だけコピーして、スマホのブラウザに貼り付けてください。");
				patchStage("qr", "ng");
				setPhase("show-local");
				setNote("QRコードの読み取りの段階で、1枚に収まらなかったためQRは出していません。短く切ってはいません。下の住所を1回だけコピーして、スマホのブラウザに貼り付けてください。");
				return;
			}
			patchStage("qr", "now");
			setPhase("show-local");
			if (sdpHasCandidate(sdp)) setNote(`このQRをスマホで1回読み取ってください。標準カメラはアプリの接続画面を開きます。検索へは移動しません。${page.note ? ` ${page.note}` : ""} ${ANSWER_RETURN_LIMIT}`);
		} catch (error) {
			if (peerRef.current !== pc) return;
			const message = error instanceof Error ? error.message : "接続の準備に失敗しました。";
			markFailed("prepare", message);
			release();
		}
	};
	const startPhone = () => {
		ensurePhone();
		setStages({
			...emptyStages(),
			qr: "now"
		});
		setLinkText("");
		setQrError("");
		setPaste("");
		setScanNote("");
		setNote("PCのQRを1回読み取ってください。スマホの標準カメラで開くか、下のカメラで読みます。読み取ったあとに検索へは移動しません。");
	};
	const submitAnswer = async () => {
		const pc = peerRef.current;
		if (roleRef.current !== "pc" || !pc) {
			setNote("先にPCとしてQRを表示してください。番号だけでは接続できません。");
			return;
		}
		const result = await gateAnswer(paste, confirmInput);
		if (peerRef.current !== pc) return;
		if (!result.ok) {
			if (result.reason === "bad" || result.reason === "not-answer") {
				markFailed("parse", result.detail);
				return;
			}
			setNote(result.detail);
			patchStage("parse", result.reason === "mismatch" ? "ng" : "wait");
			if (result.reason === "mismatch") setFailStage(stageLabel("parse"));
			return;
		}
		setStages((current) => ({
			...current,
			qr: "ok",
			parse: "ok"
		}));
		setFailStage("なし");
		setPaste("");
		await acceptSignal(result.signal, pc);
	};
	const submitOfferPaste = () => {
		const raw = paste.trim();
		if (!raw) return;
		setPaste("");
		acceptOfferText(raw);
	};
	const waitForSendRoom = async (channel) => {
		if (channel.readyState !== "open") throw new Error("送信中に切断しました。");
		if (channel.bufferedAmount <= 262144) return;
		await new Promise((resolve, reject) => {
			const finish = (error) => {
				window.clearTimeout(timer);
				channel.removeEventListener("bufferedamountlow", onLow);
				channel.removeEventListener("close", onClose);
				if (error) reject(error);
				else resolve();
			};
			const onLow = () => finish();
			const onClose = () => finish(/* @__PURE__ */ new Error("送信中に切断しました。"));
			const timer = window.setTimeout(() => {
				if (channel.readyState === "open" && channel.bufferedAmount <= 262144) finish();
				else finish(/* @__PURE__ */ new Error("送信バッファが空かず、タイムアウトしました。接続し直して再試行できます。"));
			}, 1e4);
			channel.addEventListener("bufferedamountlow", onLow);
			channel.addEventListener("close", onClose);
		});
	};
	const sendTest = async () => {
		const channel = channelRef.current;
		if (roleRef.current !== "pc") {
			setNote("テスト送信はPC側だけです。スマホ側は受信します。");
			return;
		}
		if (!channel || channel.readyState !== "open") {
			setNote("まだ接続できていません。");
			return;
		}
		const text = `komacho-qr-test\nnonce:${crypto.randomUUID()}\nfrom:pc\n`;
		const bytes = new TextEncoder().encode(text);
		const hash = await digestHex(bytes);
		setSent(text);
		setSendProgress({
			sent: 0,
			size: bytes.length
		});
		patchStage("file", "now");
		try {
			channel.send(JSON.stringify({
				t: "begin",
				name: "komacho-qr-test.txt",
				size: bytes.length,
				hash
			}));
			for (let offset = 0; offset < bytes.length; offset += FILE_CHUNK) {
				if (channel.readyState !== "open") throw new Error("送信中に切断しました。");
				await waitForSendRoom(channel);
				channel.send(bytes.subarray(offset, Math.min(bytes.length, offset + FILE_CHUNK)));
				setSendProgress({
					sent: Math.min(bytes.length, offset + FILE_CHUNK),
					size: bytes.length
				});
			}
			channel.send(JSON.stringify({ t: "end" }));
			patchStage("file", "ok");
			setNote("テストファイルを送りました。スマホ側の受信結果と見比べてください。");
		} catch (error) {
			const detail = error instanceof Error ? error.message : "送信に失敗しました。接続し直して再試行できます。";
			patchStage("file", "ng");
			setFailStage(stageLabel("file"));
			setNote(failureNote("file", detail));
		}
	};
	const copyText = async (value, box, success) => {
		try {
			await navigator.clipboard.writeText(value);
			setNote(success);
		} catch {
			box?.focus();
			box?.select();
			setNote("自動コピーは使えません。表示中の文字列を選択して、1回だけコピーしてください。");
		}
	};
	(0, import_react.useEffect)(() => {
		if (!open) reset();
		return () => release();
	}, [open]);
	(0, import_react.useEffect)(() => {
		if (!open) {
			bootSeen.current = "";
			return;
		}
		if (!bootText || bootSeen.current === bootText) return;
		bootSeen.current = bootText;
		let cancelled = false;
		acceptOfferText(bootText, () => cancelled);
		return () => {
			cancelled = true;
			bootSeen.current = "";
		};
	}, [open, bootText]);
	(0, import_react.useEffect)(() => {
		if (role !== "pc" || !linkText || qrByteLength(linkText) > 2953) {
			setQrUrl("");
			return;
		}
		let cancelled = false;
		import("../_libs/qrcode.mjs").then((n) => /* @__PURE__ */ __toESM(n.t())).then((mod) => mod.default.toDataURL(linkText, {
			errorCorrectionLevel: "L",
			margin: 2,
			width: 360
		}).then((url) => {
			if (!cancelled) setQrUrl(url);
		}, () => {
			if (!cancelled) {
				setQrUrl("");
				setQrError("接続情報を1枚のQRに収められません。短く切ってはいません。下の住所を1回だけコピーして、スマホのブラウザに貼り付けてください。");
				patchStage("qr", "ng");
			}
		}));
		return () => {
			cancelled = true;
		};
	}, [role, linkText]);
	(0, import_react.useEffect)(() => {
		if (!scanning) return;
		const video = videoRef.current;
		if (!video) return;
		let stop = false;
		let stream = null;
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d", { willReadFrequently: true });
		const watch = (raw) => {
			if (seenRef.current.has(raw)) return;
			seenRef.current.add(raw);
			acceptOfferText(raw);
		};
		(async () => {
			try {
				try {
					stream = await navigator.mediaDevices.getUserMedia({
						video: { facingMode: { ideal: "environment" } },
						audio: false
					});
				} catch {
					stream = await navigator.mediaDevices.getUserMedia({
						video: true,
						audio: false
					});
				}
				const { default: jsQR } = await import("../_libs/jsqr.mjs").then((n) => /* @__PURE__ */ __toESM(n.t()));
				if (stop) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}
				video.srcObject = stream;
				await video.play();
				let last = 0;
				const tick = (now) => {
					if (stop) return;
					if (context && now - last > 120 && video.readyState >= 2) {
						last = now;
						canvas.width = video.videoWidth;
						canvas.height = video.videoHeight;
						context.drawImage(video, 0, 0);
						const image = context.getImageData(0, 0, canvas.width, canvas.height);
						const code = jsQR(image.data, image.width, image.height);
						if (code?.data) watch(code.data);
					}
					requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			} catch {
				if (!stop) {
					setScanning(false);
					setScanNote("カメラを使えません。標準カメラでQRを開くか、下の欄に住所を1回貼り付けてください。検索へは移動しません。");
					if (!secure) setScanNote("このページではカメラを使えないことがあります。PCに出ている住所を1回貼り付けてください。");
				}
			}
		})();
		return () => {
			stop = true;
			stream?.getTracks().forEach((track) => track.stop());
			video.srcObject = null;
		};
	}, [scanning]);
	const progress = sendProgress && sendProgress.size > 0 ? Math.round(sendProgress.sent / sendProgress.size * 100) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange: (next) => {
			if (!next) reset();
			onOpenChange(next);
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "sheet-overlay" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "storage-sheet qr-test-sheet",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-b border-line px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
						className: "font-medium",
						children: "QR接続テスト"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
						className: "text-sm text-ink-muted",
						children: "PCからスマホへ、小さなテストファイルだけを送ります。画像や保存データには触れません。"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4 px-4 py-4 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-ink-muted",
							children: "外部の中継サーバー、STUN、TURNは使いません。QRに入るのは、この接続画面を開く住所と接続情報だけです。画像・アカウント・保存データは入れません。直接つなぐため、端末のローカルアドレスが接続情報に入ることがあります。別のネットワークでは、中継なしでは届かないことが普通です。"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: ANSWER_RETURN_LIMIT }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									onClick: () => void startPc(),
									children: "PCとしてQRを表示"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									onClick: startPhone,
									children: "スマホとして待つ"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									onClick: reset,
									children: "最初からやり直す"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-medium",
									children: "接続段階"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
									className: "qr-stages",
									children: CONNECT_STAGES.map((stage) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										"data-qr-stage": stage,
										"data-status": stages[stage],
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: stageLabel(stage) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: statusWord(stages[stage]) })]
									}, stage))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["役割: ", role === "pc" ? "PC" : role === "phone" ? "スマホ" : "未選択"] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["状態: ", phaseLabel(phase)] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["ICE: ", ice] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["候補の収集: ", gathering] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["データチャネル: ", channelState] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["失敗した段階: ", failStage] }),
								note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: note }) : null
							]
						}),
						role === "pc" && linkText ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-medium",
									children: "PCの接続用QR（1枚）"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-ink-muted",
									children: "PCにカメラは要りません。スマホでこのQRを1回読むと、アプリの接続画面が開きます。"
								}),
								qrUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									className: "qr-test-image",
									src: qrUrl,
									alt: "接続用QR"
								}) : null,
								qrError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: qrError }) : null,
								linkNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: linkNote }) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									ref: linkRef,
									className: "w-full rounded-md border border-line bg-paper px-2 py-1",
									readOnly: true,
									rows: 3,
									value: linkText,
									"data-qr-link": ""
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									onClick: () => void copyText(linkText, linkRef.current, "接続用の住所をコピーしました。スマホのブラウザに1回だけ貼り付けてください。"),
									children: "QRを読めないときだけ住所をコピー"
								})
							]
						}) : null,
						role === "pc" && linkText ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-medium",
									children: "スマホからの応答（1回だけ貼り付け）"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-ink-muted",
									children: "自動では届きません。応答の文字列と、確認用の4桁の両方が必要です。4桁だけ入力しても接続しません。"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									className: "w-full rounded-md border border-line bg-paper px-2 py-1",
									rows: 3,
									value: paste,
									placeholder: "スマホに出た応答を、ここに1回貼り付けます",
									"data-qr-paste": "",
									onChange: (event) => setPaste(event.target.value)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "block space-y-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "確認用の4桁（これだけでは接続しません）" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
										className: "w-24 rounded-md border border-line bg-paper px-2 py-2 text-center text-lg tracking-widest",
										inputMode: "numeric",
										autoComplete: "off",
										maxLength: 4,
										value: confirmInput,
										"data-qr-confirm": "",
										onChange: (event) => setConfirmInput(event.target.value.replace(/\D/g, "").slice(0, 4)),
										onKeyDown: (event) => {
											if (event.key === "Enter") submitAnswer();
										}
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									onClick: () => void submitAnswer(),
									children: "応答を確認して接続"
								})
							]
						}) : null,
						role === "phone" && !answerText ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-medium",
									children: "アプリ内でQRを読む"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-ink-muted",
									children: "標準カメラで開いた場合は、この操作は要りません。ここでの読み取りは住所を開かず、この画面で解析します。検索へは移動しません。"
								}),
								scanning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
									ref: videoRef,
									className: "qr-test-camera",
									muted: true,
									playsInline: true
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
									ref: videoRef,
									className: "hidden",
									muted: true,
									playsInline: true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									onClick: () => setScanning((value) => !value),
									children: scanning ? "カメラを止める" : "カメラで1回読み取る"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									className: "w-full rounded-md border border-line bg-paper px-2 py-1",
									rows: 3,
									value: paste,
									placeholder: "標準カメラが使えないときは、PCの住所を1回貼り付けます",
									onChange: (event) => setPaste(event.target.value)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									onClick: submitOfferPaste,
									children: "貼り付けた住所を解析"
								}),
								scanNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: scanNote }) : null
							]
						}) : null,
						role === "phone" && answerText ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-medium",
									children: "PCへ返す応答（1回だけコピー）"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "確認用の4桁" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "qr-confirm-code",
									"data-qr-code": "",
									children: answerCode
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-ink-muted",
									children: "この番号だけでは接続できません。下の応答をPCに1回貼り付け、PCで同じ4桁を入力します。"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									ref: answerRef,
									className: "w-full rounded-md border border-line bg-paper px-2 py-1",
									readOnly: true,
									rows: 3,
									value: answerText,
									"data-qr-answer": ""
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									onClick: () => void copyText(answerText, answerRef.current, "応答をコピーしました。PCに1回だけ貼り付け、同じ4桁を入力してください。"),
									children: "応答を1回コピー"
								})
							]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-medium",
									children: "テストファイル送信（PCからスマホ）"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-ink-muted",
									children: "スマホ側はこのボタンを使えません。受信結果で内容を確認します。"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "quiet",
									disabled: role !== "pc" || phase !== "open",
									onClick: () => void sendTest(),
									children: "テストファイルを送る"
								}),
								sendProgress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
									"komacho-qr-test.txt / ",
									sendProgress.sent,
									"/",
									sendProgress.size,
									" バイト"
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "storage-bar",
									role: "meter",
									"aria-label": "送信進捗",
									"aria-valuemin": 0,
									"aria-valuemax": 100,
									"aria-valuenow": progress,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${progress}%` } })
								})] }) : null,
								sent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
									className: "overflow-auto rounded-md border border-line bg-paper p-2",
									children: sent
								}) : null
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
							className: "space-y-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-medium",
									children: "受信結果"
								}),
								receiveProgress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
									receiveProgress.name,
									" / 受信 ",
									receiveProgress.got,
									"/",
									receiveProgress.size,
									" バイト"
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "storage-bar",
									role: "meter",
									"aria-label": "受信進捗",
									"aria-valuemin": 0,
									"aria-valuemax": 100,
									"aria-valuenow": receiveProgress.size > 0 ? Math.round(receiveProgress.got / receiveProgress.size * 100) : 0,
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${receiveProgress.size > 0 ? Math.round(receiveProgress.got / receiveProgress.size * 100) : 0}%` } })
								})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-ink-muted",
									children: "まだ受信していません。"
								}),
								received ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
										received.name,
										" / ",
										received.size,
										" バイト / ",
										received.match ? "一致" : "不一致"
									] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
										className: "overflow-auto rounded-md border border-line bg-paper p-2",
										children: received.text
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
										className: "underline",
										href: received.url,
										download: received.name,
										children: "受信ファイルをダウンロード"
									})
								] }) : null
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex justify-end border-t border-line px-4 py-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "quiet",
							children: "閉じる"
						})
					})
				})
			]
		})] })
	});
}
function Amount({ value, pending }) {
	if (pending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "text-ink-muted",
		children: "計測しています"
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "tabular-nums",
		children: value === null ? "取得できません" : formatBytes(value)
	});
}
function StorageDialog({ open, onOpenChange }) {
	const [snapshot, setSnapshot] = (0, import_react.useState)(null);
	const [measuring, setMeasuring] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		let cancelled = false;
		setMeasuring(true);
		setSnapshot(null);
		measureStorage().then((next) => {
			if (cancelled) return;
			setSnapshot(next);
			setMeasuring(false);
		});
		return () => {
			cancelled = true;
		};
	}, [open]);
	const usage = snapshot?.browser.usage ?? null;
	const quota = snapshot?.browser.quota ?? null;
	const ratio = storageRatio(usage, quota);
	const pressure = storagePressure(usage, quota);
	const remaining = usage !== null && quota !== null ? Math.max(0, quota - usage) : null;
	const appTotal = snapshot?.app == null ? null : snapshot.app.originals + snapshot.app.thumbs + (snapshot.app.meta ?? 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "sheet-overlay" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
			className: "storage-sheet",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3 border-b border-line px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
					className: "font-medium",
					children: "容量"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
					className: "text-sm text-ink-muted",
					children: "ブラウザが示している保存容量の目安です。実際に保存できる量を保証するものではありません。"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "quiet",
						children: "閉じる"
					})
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-4 px-4 py-4 text-sm",
				children: [
					measuring ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-ink-muted",
						children: "容量を計測しています。"
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-medium",
								children: "このアプリの使用量"
							}),
							snapshot?.app ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
								className: "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "画像・動画" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "text-right",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Amount, {
											value: snapshot.app.originals,
											pending: false
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-ink-muted",
										children: "サムネイル"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "text-right text-ink-muted",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Amount, {
											value: snapshot.app.thumbs,
											pending: false
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
										className: "text-ink-muted",
										children: "メタデータ（概算）"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "text-right text-ink-muted",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Amount, {
											value: snapshot.app.meta,
											pending: false
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "合計" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "text-right",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Amount, {
											value: appTotal,
											pending: false
										})
									})
								]
							}) : measuring ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "取得できません" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-ink-faint",
								children: "画像・動画は元ファイル、サムネイルは一覧用の別データです。同じファイルを二重には数えていません。合計にデータベースの管理領域は含みません。"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "space-y-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-medium",
								children: "ブラウザの保存容量の目安"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
								className: "grid grid-cols-[1fr_auto] gap-x-4 gap-y-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "使用量" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "text-right",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Amount, {
											value: usage,
											pending: !snapshot
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "保存可能容量" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "text-right",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Amount, {
											value: quota,
											pending: !snapshot
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: "残り容量の目安" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
										className: "text-right",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Amount, {
											value: remaining,
											pending: !snapshot
										})
									})
								]
							}),
							ratio === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-ink-muted",
								children: snapshot ? "使用率は取得できません" : "使用率を計測しています"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: pressure === "alert" ? "storage-bar is-alert" : pressure === "warn" ? "storage-bar is-warn" : "storage-bar",
								role: "meter",
								"aria-label": "ブラウザの保存容量の使用率",
								"aria-valuemin": 0,
								"aria-valuemax": 100,
								"aria-valuenow": Math.round(Math.min(ratio, 1) * 100),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { width: `${Math.min(ratio, 1) * 100}%` } })
							}),
							pressure === "warn" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "storage-note is-warn",
								children: "保存容量の目安の80%以上を使っています。不要な画像を削除すると余裕が戻ります。画像は自動では削除しません。"
							}) : null,
							pressure === "alert" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "storage-note is-alert",
								children: "保存容量の目安の95%以上を使っています。追加に失敗することがあります。不要な画像を削除してください。画像は自動では削除しません。"
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-ink-faint",
								children: "ブラウザ全体の使用量には、このアプリ以外の同じサイトのデータも含まれることがあります。"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-ink-faint",
						children: ["最終確認 ", snapshot ? formatCheckedAt(snapshot.measuredAt) : "計測しています"]
					})
				]
			})]
		})] })
	});
}
function inkOn(color) {
	const value = Number.parseInt(color.slice(1), 16);
	return ((value >> 16 & 255) * 299 + (value >> 8 & 255) * 587 + (value & 255) * 114) / 1e3 > 160 ? "#1c140c" : "#f3f1ec";
}
function slotKey(slot) {
	if (!slot) return "";
	if (slot.kind === "folder") return `folder:${slot.folderId}`;
	return `insert:${slot.folderId ?? ""}:${slot.beforeId ?? ""}`;
}
function tagRows(root, folderId, sourceId) {
	const scope = folderId ? folderBlock(root, folderId)?.querySelector(":scope > .tag-folder-tags") : root;
	if (!scope) return [];
	return [...scope.children].filter((node) => node instanceof HTMLElement && node.classList.contains("tag-line")).filter((node) => node.dataset.tagId && node.dataset.tagId !== sourceId).map((node) => {
		const rect = node.getBoundingClientRect();
		return {
			id: node.dataset.tagId ?? "",
			top: rect.top,
			bottom: rect.bottom
		};
	});
}
function folderBlock(root, folderId) {
	for (const node of root.querySelectorAll(":scope > .tag-folder-block")) if (node instanceof HTMLElement && node.dataset.folderId === folderId) return node;
	return null;
}
function insertSlot(root, folderId, clientY, sourceId) {
	const rows = tagRows(root, folderId, sourceId);
	if (folderId && rows.length === 0) return {
		kind: "folder",
		folderId
	};
	const placed = tagInsertIndex(rows, clientY);
	return {
		kind: "insert",
		folderId,
		beforeId: placed.index >= rows.length ? null : rows[placed.index].id,
		marks: placed.marks
	};
}
/** Folder headers store a tag. Tag rows insert. The gap above a loose tag belongs to that list, not the folder above it. */
function resolveTagSlot(root, clientY, sourceId) {
	const children = [...root.children].filter((node) => node instanceof HTMLElement && !node.classList.contains("tag-empty"));
	if (children.length === 0) return {
		kind: "insert",
		folderId: null,
		beforeId: null,
		marks: []
	};
	const rootRect = root.getBoundingClientRect();
	const lastBottom = children[children.length - 1].getBoundingClientRect().bottom;
	if (clientY > lastBottom) return insertSlot(root, null, clientY, sourceId);
	for (let index = 0; index < children.length; index += 1) {
		const el = children[index];
		const rect = el.getBoundingClientRect();
		const prevBottom = index === 0 ? rootRect.top : children[index - 1].getBoundingClientRect().bottom;
		const nextTop = index === children.length - 1 ? lastBottom : children[index + 1].getBoundingClientRect().top;
		const prevEdge = el.classList.contains("tag-line") ? prevBottom : (prevBottom + rect.top) / 2;
		const nextIsLoose = index < children.length - 1 && children[index + 1].classList.contains("tag-line");
		const nextEdge = index === children.length - 1 ? lastBottom : nextIsLoose ? rect.bottom : (rect.bottom + nextTop) / 2;
		if (clientY >= prevEdge && clientY < nextEdge) return slotForChild(root, el, clientY, sourceId);
	}
	return insertSlot(root, null, clientY, sourceId);
}
function slotForChild(root, el, clientY, sourceId) {
	if (!el.classList.contains("tag-folder-block")) return insertSlot(root, null, clientY, sourceId);
	const folderId = el.dataset.folderId;
	if (!folderId) return null;
	const header = [...el.children].find((node) => node instanceof HTMLElement && node.classList.contains("tag-folder"));
	const tags = [...el.children].find((node) => node instanceof HTMLElement && node.classList.contains("tag-folder-tags"));
	const headerBottom = header instanceof HTMLElement ? header.getBoundingClientRect().bottom : el.getBoundingClientRect().top;
	if (!(tags instanceof HTMLElement) || clientY <= headerBottom) return {
		kind: "folder",
		folderId
	};
	return insertSlot(root, folderId, clientY, sourceId);
}
function TagRail({ tags, folders, counts, selected, hidden, open, width, onToggle, onSelect, onHide, onCreate, onCreateFolder, onToggleFolder, onPlaceTag, onDeleteFolder, onRename, onDelete, viewer = false }) {
	const [draft, setDraft] = (0, import_react.useState)("");
	const [composer, setComposer] = (0, import_react.useState)(null);
	const [editing, setEditing] = (0, import_react.useState)(null);
	const [editName, setEditName] = (0, import_react.useState)("");
	const [slot, setSlot] = (0, import_react.useState)(null);
	const [dragId, setDragId] = (0, import_react.useState)(null);
	const [pendingFolder, setPendingFolder] = (0, import_react.useState)(null);
	const commitRef = (0, import_react.useRef)(false);
	const dragged = (0, import_react.useRef)(false);
	const formRef = (0, import_react.useRef)(null);
	const scrollRef = (0, import_react.useRef)(null);
	const slotKeyRef = (0, import_react.useRef)("");
	const clearDrag = () => {
		slotKeyRef.current = "";
		setSlot(null);
		setDragId(null);
	};
	const showSlot = (next) => {
		const key = slotKey(next);
		if (key === slotKeyRef.current) return;
		slotKeyRef.current = key;
		setSlot(next);
	};
	(0, import_react.useEffect)(() => {
		if (!open) setPendingFolder(null);
	}, [open]);
	(0, import_react.useEffect)(() => {
		const clear = () => {
			slotKeyRef.current = "";
			setSlot(null);
			setDragId(null);
		};
		window.addEventListener("dragend", clear);
		return () => window.removeEventListener("dragend", clear);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!composer) return;
		const cancel = (event) => {
			if (formRef.current?.contains(event.target)) return;
			setComposer(null);
			setDraft("");
		};
		window.addEventListener("pointerdown", cancel);
		return () => window.removeEventListener("pointerdown", cancel);
	}, [composer]);
	const finishEdit = (id, name) => {
		if (commitRef.current) return;
		commitRef.current = true;
		const trimmed = name.trim();
		const current = tags.find((tag) => tag.id === id)?.name ?? "";
		if (!trimmed || trimmed === current) {
			setEditing(null);
			return;
		}
		onRename(id, trimmed).finally(() => setEditing(null));
	};
	const openComposer = (next) => {
		setComposer(next);
		setDraft("");
	};
	const listed = tagsInRailOrder(tags, folders);
	const loose = listed.filter((tag) => !tag.folderId);
	const tagsIn = (folderId) => listed.filter((tag) => tag.folderId === folderId);
	const marks = slot?.kind === "insert" ? slot.marks : [];
	const startDrag = (tag) => (event) => {
		if (viewer) {
			event.preventDefault();
			return;
		}
		const transfer = event.dataTransfer;
		transfer.effectAllowed = "all";
		transfer.setData(TAG_DRAG, tag.id);
		transfer.setData("text/plain", tag.name);
		beginTagDrag(tag.id);
		dragged.current = true;
		setDragId(tag.id);
		const chip = event.currentTarget.closest(".tag-chip");
		if (chip instanceof HTMLElement) transfer.setDragImage(chip, 18, 16);
	};
	const allowTagDrop = (event) => {
		if (viewer || !eventIsTagDrag(event.dataTransfer?.types)) return;
		event.preventDefault();
	};
	const previewTagDrop = (event) => {
		if (viewer || !eventIsTagDrag(event.dataTransfer?.types)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
		const root = scrollRef.current;
		const sourceId = currentTagDrag();
		if (!root || !sourceId) return;
		showSlot(resolveTagSlot(root, event.clientY, sourceId));
	};
	const commitTagDrop = (event) => {
		if (!eventIsTagDrag(event.dataTransfer?.types)) return;
		event.preventDefault();
		const root = scrollRef.current;
		const id = event.dataTransfer.getData("application/x-komacho-tag") || currentTagDrag();
		const next = root && id ? resolveTagSlot(root, event.clientY, id) : null;
		clearDrag();
		if (viewer || !id || !next) return;
		if (next.kind === "folder") {
			if ((tags.find((entry) => entry.id === id)?.folderId ?? null) === next.folderId) return;
			onPlaceTag(id, next.folderId, null);
			return;
		}
		onPlaceTag(id, next.folderId, next.beforeId);
	};
	const renderTag = (tag, nested) => {
		const edge = marks.find((mark) => mark.id === tag.id)?.edge ?? null;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: nested ? "tag-line is-nested" : "tag-line",
			"data-tag-id": tag.id,
			children: [editing === tag.id ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
				className: "tag-edit",
				onSubmit: (event) => {
					event.preventDefault();
					finishEdit(tag.id, editName);
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: editName,
					autoFocus: true,
					maxLength: 40,
					"aria-label": `${tag.name}の名前`,
					onChange: (event) => setEditName(event.target.value),
					onBlur: (event) => finishEdit(tag.id, event.currentTarget.value),
					onKeyDown: (event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							finishEdit(tag.id, event.currentTarget.value);
						}
						if (event.key === "Escape") {
							event.preventDefault();
							commitRef.current = true;
							setEditing(null);
						}
					}
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: [
					"tag-chip",
					selected.includes(tag.id) ? "is-current" : "",
					hidden.includes(tag.id) ? "is-hidden" : "",
					dragId === tag.id ? "is-dragging" : ""
				].filter(Boolean).join(" "),
				style: {
					background: tag.color,
					color: inkOn(tag.color)
				},
				draggable: !viewer,
				onDragStart: startDrag(tag),
				onDragEnd: () => {
					endTagDrag();
					clearDrag();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "tag-chip-main",
						draggable: !viewer,
						"aria-pressed": selected.includes(tag.id),
						title: selected.includes(tag.id) ? "もう一度押すと選択を外す" : "クリックで選択タグに追加",
						onDragStart: startDrag(tag),
						onClick: () => {
							if (dragged.current) {
								dragged.current = false;
								return;
							}
							onSelect(tag.id);
						},
						onDoubleClick: () => {
							if (viewer) return;
							commitRef.current = false;
							setEditing(tag.id);
							setEditName(tag.name);
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tag-chip-name",
							children: tag.name
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "tag-chip-neg",
						draggable: !viewer,
						"aria-pressed": hidden.includes(tag.id),
						"aria-label": hidden.includes(tag.id) ? `${tag.name}のネガティブを外す` : `${tag.name}をネガティブにする`,
						title: hidden.includes(tag.id) ? "もう一度押すとネガティブを外す" : "ネガティブタグにする",
						onDragStart: startDrag(tag),
						onClick: (event) => {
							event.stopPropagation();
							if (dragged.current) {
								dragged.current = false;
								return;
							}
							onHide(tag.id);
						},
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tag-count",
							children: counts[tag.id] ?? 0
						})
					}),
					edge ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: edge === "before" ? "tag-edge is-before" : "tag-edge is-after" }) : null
				]
			}), viewer ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "tag-delete",
				"aria-label": `${tag.name}を削除`,
				onClick: () => {
					if (window.confirm(`タグ「${tag.name}」を削除しますか？画像から外れます。`)) onDelete(tag.id);
				},
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { "aria-hidden": "true" })
			})]
		}, tag.id);
	};
	if (!open) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
		className: "tag-rail is-collapsed",
		"aria-label": "タグ",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "quiet",
			"aria-label": "タグを表示",
			onClick: onToggle,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelRightOpen, {
				className: "size-4",
				"aria-hidden": "true"
			})
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: "tag-rail",
		style: { width },
		"aria-label": "タグ",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "tag-rail-head",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "quiet",
					"aria-label": "タグをしまう",
					onClick: onToggle,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelRightClose, {
						className: "size-4",
						"aria-hidden": "true"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "タグ" })]
			}),
			viewer ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "tag-create-pane",
				children: composer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
					ref: formRef,
					className: "tag-create",
					onSubmit: (event) => {
						event.preventDefault();
						const name = draft.trim();
						if (!name) return;
						if (composer === "folder") onCreateFolder(name);
						else onCreate(name);
						setDraft("");
						setComposer(null);
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: draft,
						autoFocus: true,
						maxLength: 40,
						"aria-label": composer === "folder" ? "新しいフォルダ名" : "新しいタグ名",
						placeholder: composer === "folder" ? "フォルダ名" : "タグ名",
						onChange: (event) => setDraft(event.target.value),
						onKeyDown: (event) => {
							if (event.key === "Escape") {
								event.preventDefault();
								setComposer(null);
								setDraft("");
							}
						}
					})
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "tag-create-actions",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "quiet",
						onClick: () => openComposer("tag"),
						children: "作成"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "quiet",
						onClick: () => openComposer("folder"),
						children: "フォルダ作成"
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "tag-list-pane",
				"aria-label": "タグ一覧",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					ref: scrollRef,
					className: "tag-scroll",
					onDragEnter: allowTagDrop,
					onDragOver: previewTagDrop,
					onDrop: commitTagDrop,
					children: [
						tags.length === 0 && folders.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "tag-empty",
							children: "タグはまだありません"
						}) : null,
						folders.map((folder) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "tag-folder-block",
							"data-folder-id": folder.id,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: slot?.kind === "folder" && slot.folderId === folder.id ? "tag-folder is-hot" : "tag-folder",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "tag-folder-toggle",
									"aria-expanded": folder.open,
									onClick: () => onToggleFolder(folder.id),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Folder, {
											className: "size-4",
											"aria-hidden": "true"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "tag-folder-name",
											children: folder.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "tag-count",
											children: tagsIn(folder.id).length
										})
									]
								}), viewer ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "tag-delete",
									"data-spot-trigger": "",
									"aria-label": `${folder.name}を削除`,
									"aria-expanded": pendingFolder?.id === folder.id,
									onClick: (event) => {
										setPendingFolder({
											id: folder.id,
											name: folder.name,
											rect: event.currentTarget.getBoundingClientRect()
										});
									},
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { "aria-hidden": "true" })
								})]
							}), folder.open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "tag-folder-tags",
								children: tagsIn(folder.id).map((tag) => renderTag(tag, true))
							}) : null]
						}, folder.id)),
						loose.map((tag) => renderTag(tag, false))
					]
				})
			}),
			pendingFolder ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpotConfirm, {
				anchor: pendingFolder.rect,
				side: "lower-left",
				title: `フォルダ「${pendingFolder.name}」の削除`,
				body: `フォルダ「${pendingFolder.name}」を削除しますか？中のタグもすべて削除され、画像からの関連付けも外れます。他のタグや画像自体は残ります。`,
				confirmLabel: "削除",
				onCancel: () => setPendingFolder(null),
				onConfirm: () => {
					const id = pendingFolder.id;
					setPendingFolder(null);
					onDeleteFolder(id);
				}
			}) : null
		]
	});
}
/** The first http(s) URL in copied text. Pixiv pages are handled separately. */
function copiedHttpUrl(text) {
	const match = text.replace(/\b(?:blob|data|filesystem|chrome-untrusted|chrome):[^\s<>"']+/gi, " ").match(/https?:\/\/[^\s<>"']+/i);
	if (!match) return null;
	return publicHttpUrl(match[0].replace(/[),.;]+$/g, ""));
}
function decodeHtmlAttr(value) {
	return value.replace(/\u0026amp;/gi, "&").replace(/\u0026quot;/gi, "\"").replace(/\u0026#0*39;/g, "'").replace(/\u0026apos;/gi, "'").replace(/\u0026lt;/gi, "<").replace(/\u0026gt;/gi, ">");
}
function pushAddress(raw, into, seen) {
	let text = raw.trim();
	if (!text || text.startsWith("#")) return;
	if (text.startsWith("//")) text = `https:${text}`;
	if (/^data:/i.test(text)) {
		if (/^data:image\/(?:png|jpe?g|gif|webp)/i.test(text) && !seen.has(text)) {
			seen.add(text);
			into.dataUrls.push(text);
		}
		return;
	}
	if (/^(?:blob|filesystem|chrome-untrusted|chrome):/i.test(text)) {
		into.blocked.push(text);
		return;
	}
	const pub = publicHttpUrl(text);
	if (pub) {
		if (!seen.has(pub)) {
			seen.add(pub);
			into.urls.push(pub);
		}
		return;
	}
	try {
		const url = new URL(text);
		if (url.protocol === "http:" || url.protocol === "https:") into.blocked.push(url.toString());
	} catch {}
}
function htmlImageSrcs(html) {
	const found = [];
	for (const match of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
		const raw = decodeHtmlAttr(match[1] ?? match[2] ?? match[3] ?? "");
		if (raw) found.push(raw);
	}
	return found;
}
function emptySources() {
	return {
		urls: [],
		dataUrls: [],
		blocked: []
	};
}
function mergeBlocked(parts) {
	const blocked = [];
	const seen = /* @__PURE__ */ new Set();
	for (const part of parts) for (const entry of part.blocked) {
		if (seen.has(entry)) continue;
		seen.add(entry);
		blocked.push(entry);
	}
	return blocked;
}
/** A direct image address, not a page that merely links to one. */
function looksLikeImageUrl(raw) {
	try {
		return /\.(?:png|jpe?g|gif|webp|avif|bmp)$/i.test(new URL(raw).pathname);
	} catch {
		return false;
	}
}
function collectLines(lines) {
	const into = emptySources();
	const seen = /* @__PURE__ */ new Set();
	for (const line of lines.split(/[\r\n]+/)) pushAddress(line, into, seen);
	return into;
}
function collectHtml(html) {
	const into = emptySources();
	const seen = /* @__PURE__ */ new Set();
	for (const src of htmlImageSrcs(html)) pushAddress(src, into, seen);
	return into;
}
function collectPlain(plain) {
	const into = emptySources();
	const seen = /* @__PURE__ */ new Set();
	const visible = plain.replace(/\b(?:blob|data|filesystem|chrome-untrusted|chrome):[^\s<>"']+/gi, " ");
	for (const match of visible.matchAll(/https?:\/\/[^\s<>"']+/gi)) pushAddress(match[0].replace(/[),.;]+$/g, ""), into, seen);
	for (const match of plain.matchAll(/data:image\/(?:png|jpe?g|gif|webp)[^'"\s]*/gi)) pushAddress(match[0], into, seen);
	return into;
}
function collectDownload(downloadUrl) {
	const into = emptySources();
	if (!downloadUrl) return into;
	pushAddress(downloadUrl.split(":").slice(2).join(":"), into, /* @__PURE__ */ new Set());
	return into;
}
/**
* A drag from another page describes the same images several ways
* (uri-list, the img markup, plain text, DownloadURL).
* Those channels are alternate encodings, not extra images.
*/
function chooseDroppedPayload(uriList, html, plain, downloadUrl = "") {
	const uri = collectLines(uriList);
	const imgs = collectHtml(html);
	const text = collectPlain(plain);
	const download = collectDownload(downloadUrl);
	const blocked = mergeBlocked([
		uri,
		imgs,
		text,
		download
	]);
	const none = emptySources();
	const withBlocked = (sources) => ({
		...sources,
		blocked
	});
	const data = [
		uri,
		imgs,
		text,
		download
	].find((part) => part.dataUrls.length > 0);
	if (data) {
		const http = [
			uri,
			imgs,
			text,
			download
		].find((part) => part.urls.length > 0) ?? none;
		return {
			primary: withBlocked({
				urls: [],
				dataUrls: data.dataUrls,
				blocked: []
			}),
			fallback: {
				urls: http.urls,
				dataUrls: [],
				blocked: []
			}
		};
	}
	if (uri.urls.length > 1) return {
		primary: withBlocked(uri),
		fallback: none
	};
	if (uri.urls.length === 1 && imgs.urls.length > 0) {
		const link = uri.urls[0];
		if (imgs.urls.length === 1 && imgs.urls[0] === link) return {
			primary: withBlocked(uri),
			fallback: none
		};
		if (imgs.urls.length > 1) return {
			primary: withBlocked(imgs),
			fallback: none
		};
		if (looksLikeImageUrl(link)) return {
			primary: withBlocked(uri),
			fallback: {
				urls: imgs.urls,
				dataUrls: [],
				blocked: []
			}
		};
		return {
			primary: withBlocked(imgs),
			fallback: none
		};
	}
	if (uri.urls.length === 1) return {
		primary: withBlocked(uri),
		fallback: none
	};
	if (imgs.urls.length > 0) return {
		primary: withBlocked(imgs),
		fallback: none
	};
	if (text.urls.length > 0) return {
		primary: withBlocked(text),
		fallback: none
	};
	if (download.urls.length > 0) return {
		primary: withBlocked(download),
		fallback: none
	};
	return {
		primary: withBlocked(none),
		fallback: none
	};
}
var MAX_DATA_CHARS = 33554432;
/** Turns a data:image URL into a file when the bytes are JPEG, PNG, GIF, or WebP. */
function fileFromDataUrl(dataUrl, index = 0) {
	const match = /^data:(image\/(?:png|jpeg|jpg|pjpeg|gif|webp));base64,([\s\S]*)$/i.exec(dataUrl.trim());
	if (!match) return null;
	const b64 = match[2].replace(/\s/g, "");
	if (!b64 || b64.length > MAX_DATA_CHARS) return null;
	let binary;
	try {
		binary = atob(b64);
	} catch {
		return null;
	}
	if (binary.length > 25165824) return null;
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i) & 255;
	const sniffed = sniffImage(bytes);
	if (sniffed !== "image/jpeg" && sniffed !== "image/png" && sniffed !== "image/gif" && sniffed !== "image/webp") return null;
	const ext = sniffed === "image/jpeg" ? "jpg" : sniffed === "image/png" ? "png" : sniffed === "image/gif" ? "gif" : "webp";
	return new File([bytes], `dropped-${index + 1}.${ext}`, { type: sniffed });
}
/** Public http(s) only. Private and local addresses are refused. */
function publicHttpUrl(raw) {
	let url;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return null;
	if (url.username || url.password) return null;
	if (!isPublicHost(url.hostname)) return null;
	return url.toString();
}
function isPublicHost(hostname) {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost")) return false;
	if (host === "0.0.0.0" || host === "::1" || host === "metadata.google.internal") return false;
	const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (!v4) return true;
	const parts = v4.slice(1).map(Number);
	if (parts.some((part) => part > 255)) return false;
	const [a, b] = parts;
	if (a === 0 || a === 10 || a === 127) return false;
	if (a === 169 && b === 254) return false;
	if (a === 172 && b >= 16 && b <= 31) return false;
	if (a === 192 && b === 168) return false;
	return true;
}
function sniffImage(bytes) {
	if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
	if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "image/png";
	if (bytes.length >= 6) {
		const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]);
		if (head === "GIF87a" || head === "GIF89a") return "image/gif";
	}
	if (bytes.length >= 12) {
		const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
		const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
		if (riff === "RIFF" && webp === "WEBP") return "image/webp";
	}
	return null;
}
function looksLikeHtml(bytes, contentType) {
	const type = contentType.toLowerCase();
	if (type.includes("text/html") || type.includes("application/xhtml")) return true;
	const start = String.fromCharCode(...bytes.subarray(0, Math.min(bytes.length, 80))).trim().toLowerCase();
	return start.startsWith("<!doctype html") || start.startsWith("<html") || start.startsWith("<head") || start.startsWith("<body");
}
var MAX_BYTES = 25165824;
var MANUAL = "保存したファイルを「画像を追加」から読み込んでください。ログイン情報は使いません。";
function pixivBlockedMessage() {
	return `このブラウザからpixivの作品データは取得できません。pixivが別のページからの読み取りを許していないためです。${MANUAL}`;
}
function sniffVideo(bytes) {
	if (bytes.length > 12 && bytes[4] === 102 && bytes[5] === 116 && bytes[6] === 121 && bytes[7] === 112) return "video/mp4";
	if (bytes.length > 4 && bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163) return "video/webm";
	return null;
}
function fileName(url, mime) {
	const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : mime === "video/webm" ? "webm" : "mp4";
	try {
		const bare = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "").replace(/\.(jpe?g|png|webp|gif|mp4|webm)$/i, "").replace(/[\\/:*?"<>|\n\r\t]/g, " ").trim();
		if (bare) return `${bare.slice(0, 40)}.${ext}`;
	} catch {}
	return `file.${ext}`;
}
/** Reads a public file in the browser. Credentials are not sent. */
async function fetchBrowserMedia(rawUrl, signal) {
	const safe = publicHttpUrl(rawUrl);
	if (!safe) return {
		ok: false,
		reason: "browser",
		message: `このアドレスは取得できません。${MANUAL}`
	};
	let response;
	try {
		response = await fetch(safe, {
			mode: "cors",
			credentials: "omit",
			redirect: "follow",
			signal,
			cache: "no-store"
		});
	} catch (error) {
		if (signal.aborted || error instanceof Error && error.name === "AbortError") throw error;
		return {
			ok: false,
			reason: "browser",
			message: `このアドレスはブラウザの制限で読み取れません。${MANUAL}`
		};
	}
	if (response.url && !publicHttpUrl(response.url)) return {
		ok: false,
		reason: "browser",
		message: `転送先が公開アドレスではなかったため、取得しませんでした。${MANUAL}`
	};
	if (response.status === 401 || response.status === 403) return {
		ok: false,
		reason: "browser",
		message: `サイトが取得を拒否しました（${response.status}）。ログインが必要か、直接読めないアドレスです。${MANUAL}`
	};
	if (response.status === 404 || response.status === 410) return {
		ok: false,
		reason: "url",
		message: `ファイルが見つかりません（${response.status}）。アドレスが切れている可能性があります。${MANUAL}`
	};
	if (!response.ok) return {
		ok: false,
		reason: "url",
		message: `取得できませんでした（${response.status}）。${MANUAL}`
	};
	const advertised = Number(response.headers.get("content-length") ?? "0");
	if (Number.isFinite(advertised) && advertised > MAX_BYTES) return {
		ok: false,
		reason: "format",
		message: "ファイルが大きすぎます。24MBまでです。"
	};
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (signal.aborted) throw new DOMException("Aborted", "AbortError");
	if (bytes.byteLength === 0) return {
		ok: false,
		reason: "format",
		message: "ファイルが空だったため、追加しませんでした。"
	};
	if (bytes.byteLength > MAX_BYTES) return {
		ok: false,
		reason: "format",
		message: "ファイルが大きすぎます。24MBまでです。"
	};
	if (looksLikeHtml(bytes, (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "")) return {
		ok: false,
		reason: "format",
		message: `このURLはファイルではなくページです。画像や動画のアドレスをコピーするか、${MANUAL}`
	};
	const mime = sniffImage(bytes) ?? sniffVideo(bytes);
	if (!mime) return {
		ok: false,
		reason: "format",
		message: `JPEG、PNG、WebP、GIF、MP4、WebM のいずれでもありませんでした。${MANUAL}`
	};
	return {
		ok: true,
		file: new File([bytes], fileName(safe, mime), { type: mime })
	};
}
/** Pulls a pixiv artwork id out of a copied URL. Other text returns null. */
function pixivIllustId(text) {
	const source = text.trim();
	if (!source) return null;
	return (source.match(/pixiv\.net\/(?:[a-z]{2}\/)?artworks\/(\d+)/i) ?? source.match(/[?&]illust_id=(\d+)/i) ?? source.match(/pixiv\.net\/ugoira\/(\d+)/i))?.[1] ?? null;
}
/** Pulls an X or Twitter status id out of a copied post URL. */
function xStatusId(text) {
	return text.match(/(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:[\w%.-]+\/status|i\/web\/status|i\/status)\/(\d{5,22})(?=\D|$)/i)?.[1] ?? null;
}
var X_GIF_MAX_MS = 14e4;
/** True when the address is a public video file, not a post page and not a private host. */
function allowedVideoFileUrl(raw) {
	const safe = publicHttpUrl(raw);
	if (!safe) return null;
	const url = new URL(safe);
	const host = url.hostname.toLowerCase();
	if (host === "x.com" || host === "twitter.com" || host.endsWith(".x.com") || host.endsWith(".twitter.com")) return null;
	return /\.(mp4|webm)$/i.test(url.pathname) || host === "video.twimg.com" || host === "video.twitter.com" ? safe : null;
}
/** A copied file address for an MP4 or WebM, including X's video host. Post pages are not included. */
function directVideoUrl(text) {
	const matches = text.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
	for (const candidate of matches) {
		const allowed = allowedVideoFileUrl(candidate.replace(/[),.;]+$/g, ""));
		if (allowed) return allowed;
	}
	return null;
}
function scoreFx(entry) {
	const mp4 = /\.mp4(\?|$)/i.test(entry.url) ? 1e5 : 0;
	if (entry.width > 0 && entry.width <= 720) return mp4 + 1e4 + entry.width;
	if (entry.width > 720) return mp4 + 1e3;
	return mp4 + entry.bitrate / 1e4;
}
/** Picks one original MP4 from an FxTwitter status payload. GIF posts stay MP4 because that is how X delivers them. */
function pickFxVideo(payload) {
	const root = asRecord(payload);
	const media = asRecord(asRecord(root.tweet ?? root).media);
	const items = [...asList(media.videos), ...asList(media.all)];
	let best = null;
	const seen = /* @__PURE__ */ new Set();
	for (const item of items) {
		const record = asRecord(item);
		const mediaKind = textOf(record.type).toLowerCase() === "gif" ? "gif" : "video";
		const durationMs = typeof record.duration === "number" ? Math.round(record.duration * 1e3) : 0;
		const variants = [record, ...asList(record.formats).map((entry) => asRecord(entry))];
		for (const variant of variants) {
			const url = textOf(variant.url);
			if (!url || seen.has(url)) continue;
			const mp4 = `${textOf(variant.container)} ${textOf(variant.format)}`.toLowerCase().includes("mp4") || /\.mp4(\?|$)/i.test(url);
			const gif = /\.gif(\?|$)/i.test(url);
			if (!mp4 && !gif) continue;
			if (mp4 && !allowedVideoFileUrl(url)) continue;
			if (gif && !publicHttpUrl(url)) continue;
			seen.add(url);
			const size = url.match(/\/(\d{2,5})x(\d{2,5})\//);
			const width = size ? Number(size[1]) : typeof record.width === "number" ? record.width : 0;
			const bitrate = typeof variant.bitrate === "number" ? variant.bitrate : 0;
			const candidate = {
				url,
				kind: gif ? "gif" : mediaKind,
				durationMs,
				width,
				bitrate
			};
			if (!best || scoreFx(candidate) > scoreFx(best)) best = candidate;
		}
	}
	if (!best) return {
		ok: false,
		reason: "none"
	};
	if (best.durationMs > 14e4) return {
		ok: false,
		reason: "long"
	};
	return {
		ok: true,
		url: best.url,
		kind: best.kind,
		durationMs: best.durationMs
	};
}
function classifyFxStatus(status, message) {
	const marker = message.toUpperCase();
	if (status === 404 || marker.includes("NOT_FOUND")) return "missing";
	if (status === 401 || marker.includes("PRIVATE") || marker.includes("PROTECTED")) return "auth";
	if (status >= 200 && status < 300) return "ok";
	return "service";
}
function asRecord(value) {
	return value && typeof value === "object" ? value : {};
}
function textOf(value) {
	return typeof value === "string" ? value : "";
}
function asList(value) {
	return Array.isArray(value) ? value : [];
}
var META_URL = "https://api.fxtwitter.com/status/";
/**
* Reads a public post id from FxTwitter in the browser, then downloads the original MP4.
* Only the status id is sent. Cookies are not sent. X's own post page is not readable here.
*/
async function loadXPostVideo(id, signal, onProgress) {
	if (!/^\d{5,22}$/.test(id)) return {
		ok: false,
		reason: "url",
		message: "Xの投稿URLから投稿IDを読み取れませんでした。"
	};
	onProgress?.("公開の投稿IDだけを api.fxtwitter.com に送って、動画のアドレスを調べています。ログイン情報は送りません。");
	let response;
	try {
		response = await fetch(`${META_URL}${id}`, {
			mode: "cors",
			credentials: "omit",
			cache: "no-store",
			signal,
			headers: { accept: "application/json" }
		});
	} catch (error) {
		if (signal.aborted || error instanceof Error && error.name === "AbortError") throw error;
		return {
			ok: false,
			reason: "cors",
			message: "投稿情報の取得先（api.fxtwitter.com）をブラウザから読めませんでした。通信できないか、ブラウザの制限です。ログイン情報は送っていません。動画ファイルのアドレスをコピーするか、保存したファイルを「画像を追加」から読み込んでください。"
		};
	}
	const text = await response.text();
	if (signal.aborted) throw new DOMException("Aborted", "AbortError");
	if (text.trim().startsWith("<")) return {
		ok: false,
		reason: "service",
		message: "投稿情報の取得先がデータを返さなかったため、動画アドレスを特定できませんでした。時間をおいてもう一度貼り付けてください。"
	};
	let payload;
	try {
		payload = JSON.parse(text);
	} catch {
		return {
			ok: false,
			reason: "service",
			message: "投稿情報の形式を読めなかったため、動画を特定できませんでした。"
		};
	}
	const record = payload && typeof payload === "object" ? payload : {};
	const remoteMessage = typeof record.message === "string" ? record.message : "";
	const kind = classifyFxStatus(response.status, remoteMessage);
	if (kind === "missing") return {
		ok: false,
		reason: "missing",
		message: "この投稿は見つかりません。削除されたか、URLが違う可能性があります。"
	};
	if (kind === "auth") return {
		ok: false,
		reason: "auth",
		message: "この投稿は非公開か、ログインが必要です。制限の回避はしません。見られるファイルを保存して「画像を追加」から読み込んでください。"
	};
	if (kind === "service") return {
		ok: false,
		reason: "service",
		message: `投稿情報を取得できませんでした（${response.status || "不明"}）。api.fxtwitter.com が一時的に使えない可能性があります。`
	};
	const picked = pickFxVideo(payload);
	if (!picked.ok && picked.reason === "long") return {
		ok: false,
		reason: "long",
		message: `この動画は長すぎます。保存できるのは${Math.round(X_GIF_MAX_MS / 1e3)}秒までです。`
	};
	if (!picked.ok) return {
		ok: false,
		reason: "none",
		message: "この投稿には動画もGIFもありません。画像だけの投稿は、画像のアドレスをコピーして貼り付けてください。"
	};
	onProgress?.("元の動画ファイルをダウンロードしています。変換はしません。");
	const loaded = await fetchBrowserMedia(picked.url, signal);
	if (!loaded.ok) return {
		ok: false,
		reason: "download",
		message: loaded.message
	};
	const ext = loaded.file.type === "image/gif" ? "gif" : loaded.file.type === "video/webm" ? "webm" : "mp4";
	return {
		ok: true,
		file: new File([loaded.file], `${id}.${ext}`, { type: loaded.file.type })
	};
}
var PASTE_FAIL = "貼り付けできませんでした。画像か、pixivの作品URL、Xの投稿URLをコピーして、もう一度押してください。";
function scopeFolderIds(folders, folderId) {
	if (folderId === "all") return null;
	const folder = folders.find((entry) => entry.id === folderId);
	if (!folder) return /* @__PURE__ */ new Set();
	if (folder.isParent) return new Set(descendantFolderIds(folders, folder.id));
	return /* @__PURE__ */ new Set([folder.id]);
}
function inScope(item, scope) {
	return scope === null || scope.has(item.folderId);
}
function dragTypes(event) {
	return Array.from(event.dataTransfer?.types ?? []);
}
function isInternalDrag(types) {
	return types.includes("application/x-komacho-file") || types.includes("application/x-komacho-tag");
}
/** A drop from the desktop or from another browser page. Internal tag and file drags are excluded. */
function isExternalDrop(types) {
	return !isInternalDrag(types);
}
function dragHitsField(event) {
	const raw = event.target;
	const target = raw instanceof Element ? raw : raw instanceof Node ? raw.parentElement : null;
	return Boolean(target?.closest("input, textarea, [contenteditable='true']"));
}
/** Chrome image drags are often effectAllowed "link". An incompatible "copy" makes the drop fail and the URL open. */
function preferDropEffect(transfer) {
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
function readDrag(transfer, type) {
	try {
		return transfer.getData(type);
	} catch {
		return "";
	}
}
/** One file list per drop. `files` and `items` are the same files, and reading both can register each one twice. */
function filesFromTransfer(transfer) {
	const fromItems = [];
	const items = transfer.items;
	if (items) for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (!item || item.kind !== "file") continue;
		try {
			const file = item.getAsFile();
			if (file && file.size > 0) fromItems.push(file);
		} catch {}
	}
	const fromFiles = Array.from(transfer.files).filter((file) => file.size > 0);
	const chosen = fromItems.length > 0 && (fromFiles.length === 0 || fromItems.length < fromFiles.length) ? fromItems : fromFiles.length > 0 ? fromFiles : fromItems;
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const file of chosen) {
		const key = `${file.name}\0${file.size}\0${file.type}\0${file.lastModified}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(file);
	}
	return out;
}
/** Backup files are recognized by name, including an empty file the image filter would drop. */
function filesForDrop(transfer) {
	const listed = filesFromTransfer(transfer);
	const raw = Array.from(transfer.files);
	if (raw.some((file) => isBackupFileName(file.name)) && !listed.some((file) => isBackupFileName(file.name))) return raw;
	return listed;
}
/** Keeps JPEG, PNG, GIF, WebP, and the video types the library already stores. Untyped image bytes are sniffed. */
async function asImportableFile(file, index) {
	const named = classifyImageInput(file);
	if (named.ok) {
		if (file.type) return file;
		return new File([file], file.name || `dropped-${index + 1}`, { type: named.mime });
	}
	if (file.type && file.type !== "application/octet-stream") return null;
	const mime = sniffImage(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
	if (!mime) return null;
	const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/gif" ? "gif" : "webp";
	const stem = (file.name || `dropped-${index + 1}`).replace(/\.[^.]+$/, "") || `dropped-${index + 1}`;
	return new File([await file.arrayBuffer()], `${stem}.${ext}`, { type: mime });
}
/** One native drop event is handled once, even if it reaches several listeners. */
var handledDrops = /* @__PURE__ */ new WeakSet();
function logDrop(info) {
	console.info("[komacho-drop]", info);
}
function dropMissMessage(reason) {
	if (reason === "browser") return "この画像はブラウザの制限で読み取れません。別ページの中だけで有効なアドレスか、公開されていないアドレスです。ログイン情報は使いません。画像を保存して「画像を追加」から読み込んでください。";
	if (reason === "format") return "このデータは JPEG、PNG、GIF ではありませんでした。既存の画像はそのままです。";
	return "このドロップからは画像を取り出せませんでした。画像を保存して「画像を追加」から読み込むか、画像のアドレスを貼り付けてください。";
}
function isExternalFileDrag(event) {
	return isExternalDrop(dragTypes(event));
}
function popAt(rect) {
	const left = Math.max(8, Math.min(rect.left, window.innerWidth - 188 - 8));
	return {
		top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 120)),
		left
	};
}
function placePreview(node, clientX, clientY) {
	const width = node.offsetWidth;
	const height = node.offsetHeight;
	let x = clientX + 18;
	let y = clientY + 18;
	if (width > 0 && x + width > window.innerWidth - 8) x = clientX - width - 14;
	if (height > 0 && y + height > window.innerHeight - 8) y = clientY - height - 14;
	node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}
function dragPreviewOf(id) {
	const max = 104;
	const card = document.querySelector(`[data-shot-id="${CSS.escape(id)}"]`);
	const rect = card?.getBoundingClientRect();
	const aspect = rect && rect.height > 0 ? rect.width / rect.height : 1;
	const w = aspect >= 1 ? max : Math.max(32, Math.round(max * aspect));
	const h = aspect >= 1 ? Math.max(32, Math.round(max / aspect)) : max;
	const image = card?.querySelector("img");
	if (image instanceof HTMLImageElement && image.currentSrc) return {
		src: image.currentSrc,
		w,
		h
	};
	const video = card?.querySelector("video");
	if (video instanceof HTMLVideoElement && video.readyState >= 2 && video.videoWidth > 0) {
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, w);
		canvas.height = Math.max(1, h);
		const context = canvas.getContext("2d");
		if (context) {
			context.drawImage(video, 0, 0, canvas.width, canvas.height);
			try {
				return {
					src: canvas.toDataURL("image/jpeg", .72),
					w,
					h
				};
			} catch {}
		}
	}
	return {
		src: "",
		w,
		h
	};
}
function LibraryTabButtons({ current, pressed, busy, onPick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "library-tabs",
		role: "group",
		"aria-label": "ライブラリ",
		children: [
			1,
			2,
			3
		].map((tab) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			variant: "quiet",
			className: pressed && tab === current ? "library-tab is-current" : "library-tab",
			"aria-pressed": pressed && tab === current,
			"aria-label": `ライブラリ${tab}`,
			disabled: busy,
			onClick: () => onPick(tab),
			children: tab
		}, tab))
	});
}
function PortfolioScreen() {
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
	const tagMatch = usePortfolio((state) => state.tagMatch);
	const tagOpen = usePortfolio((state) => state.tagOpen);
	const tagWidth = usePortfolio((state) => state.tagWidth);
	const pendingAdd = usePortfolio((state) => state.pendingAdd);
	const libraryEpoch = usePortfolio((state) => state.libraryEpoch);
	const folderClip = useFolderClip();
	const [libraryTab, setLibraryTab] = (0, import_react.useState)(1);
	const [tabBusy, setTabBusy] = (0, import_react.useState)(false);
	const tabRequest = (0, import_react.useRef)(0);
	const [compact, setCompact] = (0, import_react.useState)(false);
	const [phonePane, setPhonePane] = (0, import_react.useState)(null);
	const [contentPx, setContentPx] = (0, import_react.useState)(0);
	const [selected, setSelected] = (0, import_react.useState)([]);
	const [openId, setOpenId] = (0, import_react.useState)(null);
	const [pdfOpen, setPdfOpen] = (0, import_react.useState)(false);
	const [slideshowOpen, setSlideshowOpen] = (0, import_react.useState)(false);
	const [storageOpen, setStorageOpen] = (0, import_react.useState)(false);
	const [syncOpen, setSyncOpen] = (0, import_react.useState)(false);
	const [qrOpen, setQrOpen] = (0, import_react.useState)(false);
	const [qrBoot, setQrBoot] = (0, import_react.useState)(null);
	const [snipUrl, setSnipUrl] = (0, import_react.useState)(null);
	const [pasteNote, setPasteNote] = (0, import_react.useState)(null);
	const [prompt, setPrompt] = (0, import_react.useState)(null);
	const [fileDrag, setFileDrag] = (0, import_react.useState)(false);
	const [resetAsk, setResetAsk] = (0, import_react.useState)(null);
	const [resetting, setResetting] = (0, import_react.useState)(false);
	const [marquee, setMarquee] = (0, import_react.useState)(null);
	const [dragId, setDragId] = (0, import_react.useState)(null);
	const [insertMarks, setInsertMarks] = (0, import_react.useState)([]);
	const [dragPreview, setDragPreview] = (0, import_react.useState)(null);
	const [dropFolderId, setDropFolderId] = (0, import_react.useState)(null);
	const [flashId, setFlashId] = (0, import_react.useState)(null);
	const [flashFade, setFlashFade] = (0, import_react.useState)(false);
	const [widthDrag, setWidthDrag] = (0, import_react.useState)(null);
	const scrollRef = (0, import_react.useRef)(null);
	const flowRef = (0, import_react.useRef)(null);
	const fileRef = (0, import_react.useRef)(null);
	const pasteAbort = (0, import_react.useRef)(null);
	const pasteGen = (0, import_react.useRef)(0);
	const dragDepth = (0, import_react.useRef)(0);
	const dragCleanup = (0, import_react.useRef)(null);
	const pendingJump = (0, import_react.useRef)(null);
	const clearingFavorite = (0, import_react.useRef)(false);
	const dropRef = (0, import_react.useRef)({
		folder: null,
		index: null
	});
	const importDropRef = (0, import_react.useRef)(() => {});
	const backupRef = (0, import_react.useRef)(null);
	const previewRef = (0, import_react.useRef)(null);
	const dragPointRef = (0, import_react.useRef)(null);
	const markKeyRef = (0, import_react.useRef)("");
	const folderHoldRef = (0, import_react.useRef)(null);
	const selectedRef = (0, import_react.useRef)(selected);
	const directionRef = (0, import_react.useRef)(direction);
	const placementsRef = (0, import_react.useRef)([]);
	const galleryScroll = (0, import_react.useRef)(0);
	const viewerWasOpen = (0, import_react.useRef)(false);
	selectedRef.current = selected;
	directionRef.current = direction;
	const folderShown = compact ? phonePane === "folder" : folderOpen;
	const tagShown = compact ? phonePane === "tag" : tagOpen;
	const folderW = widthDrag?.kind === "folder" ? widthDrag.width : folderWidth;
	const tagW = widthDrag?.kind === "tag" ? widthDrag.width : tagWidth;
	(0, import_react.useEffect)(() => {
		bootstrap();
	}, []);
	(0, import_react.useEffect)(() => {
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
	(0, import_react.useLayoutEffect)(() => {
		if (phase === "boot") return;
		setLibraryTab(selectedLibraryTab());
	}, [phase, libraryEpoch]);
	(0, import_react.useLayoutEffect)(() => {
		const node = previewRef.current;
		const point = dragPointRef.current;
		if (!node || !point) return;
		placePreview(node, point.x, point.y);
	}, [dragPreview]);
	(0, import_react.useLayoutEffect)(() => {
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
	(0, import_react.useEffect)(() => {
		if (phase !== "ready") return;
		const note = sessionStorage.getItem("komacho-restored");
		if (!note) return;
		sessionStorage.removeItem("komacho-restored");
		notify(note);
	}, [phase]);
	(0, import_react.useLayoutEffect)(() => {
		const media = window.matchMedia("(max-width: 899px)");
		const apply = () => {
			const phone = media.matches;
			setCompact(phone);
			setViewerLock(phone);
			syncLibrarySurface(phone);
		};
		apply();
		media.addEventListener("change", apply);
		return () => {
			media.removeEventListener("change", apply);
			setViewerLock(false);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		if (compact) cancelPendingAdd();
	}, [compact]);
	(0, import_react.useEffect)(() => {
		const block = (event) => {
			const raw = event.target;
			if ((raw instanceof Element ? raw : raw instanceof Node ? raw.parentElement : null)?.closest("input, textarea, [contenteditable='true'], [draggable='true']")) return;
			event.preventDefault();
		};
		document.addEventListener("selectstart", block);
		return () => document.removeEventListener("selectstart", block);
	}, []);
	(0, import_react.useEffect)(() => {
		const cancelNav = (event) => {
			if (currentTagDrag()) {
				event.preventDefault();
				if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
				return;
			}
			if (dragTypes(event).includes("application/x-komacho-file") || dragHitsField(event)) return;
			event.preventDefault();
			if (event.dataTransfer) preferDropEffect(event.dataTransfer);
		};
		const onDrop = (event) => {
			if (currentTagDrag()) {
				event.preventDefault();
				return;
			}
			if (dragTypes(event).includes("application/x-komacho-file") || dragHitsField(event)) return;
			if (handledDrops.has(event)) return;
			event.preventDefault();
			if (!event.dataTransfer) return;
			const node = event.target instanceof Element ? event.target : null;
			const dropped = filesForDrop(event.dataTransfer);
			if (node?.closest(".library-main") && dropped.some((file) => isBackupFileName(file.name))) return;
			handledDrops.add(event);
			event.stopPropagation();
			importDropRef.current(event.dataTransfer);
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
	(0, import_react.useEffect)(() => {
		return () => dragCleanup.current?.();
	}, []);
	(0, import_react.useEffect)(() => {
		if (!prompt) return;
		const close = (event) => {
			if (event.target?.closest(".tag-pop")) return;
			setPrompt(null);
		};
		window.addEventListener("pointerdown", close);
		return () => window.removeEventListener("pointerdown", close);
	}, [prompt]);
	const scope = (0, import_react.useMemo)(() => scopeFolderIds(folders, folderId), [folders, folderId]);
	const scopedItems = (0, import_react.useMemo)(() => items.filter((item) => inScope(item, scope)), [items, scope]);
	const hasFavorite = scopedItems.some((item) => item.favorite);
	const visible = (0, import_react.useMemo)(() => {
		return readingSequence(scopedItems.filter((item) => {
			if (favoritesOnly && !item.favorite) return false;
			return passesTagFilter(item.tagIds, activeTagIds, hiddenTagIds, tagMatch);
		}), direction);
	}, [
		scopedItems,
		favoritesOnly,
		activeTagIds,
		hiddenTagIds,
		tagMatch,
		direction
	]);
	(0, import_react.useEffect)(() => {
		if (phase !== "ready" || !favoritesOnly || hasFavorite || clearingFavorite.current) return;
		clearingFavorite.current = true;
		saveFavoritesOnly(false).finally(() => {
			clearingFavorite.current = false;
		});
	}, [
		phase,
		favoritesOnly,
		hasFavorite
	]);
	(0, import_react.useEffect)(() => {
		setSelected((current) => {
			if (current.length === 0) return current;
			const known = new Set(items.map((item) => item.id));
			const next = current.filter((id) => known.has(id));
			return next.length === current.length ? current : next;
		});
		setOpenId((current) => current && items.some((item) => item.id === current) ? current : null);
	}, [items]);
	(0, import_react.useEffect)(() => {
		if (notices.length === 0) return;
		const followers = [];
		let dropTimer = 0;
		const dropFollowers = () => {
			window.clearTimeout(dropTimer);
			dropTimer = 0;
			for (const item of followers.splice(0)) document.removeEventListener(item.type, item.fn, true);
		};
		const arm = (type) => {
			const fn = (event) => {
				event.preventDefault();
				event.stopPropagation();
				if (type === "pointercancel" || type === "click" || type === "auxclick") dropFollowers();
				if (type === "pointerup") {
					window.clearTimeout(dropTimer);
					dropTimer = window.setTimeout(dropFollowers, 0);
				}
			};
			followers.push({
				type,
				fn
			});
			document.addEventListener(type, fn, true);
		};
		const swallow = (event) => {
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
	(0, import_react.useEffect)(() => {
		setSelected([]);
		setOpenId(null);
	}, [folderId]);
	(0, import_react.useLayoutEffect)(() => {
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
		const timers = [
			0,
			50,
			140
		].map((ms) => window.setTimeout(keep, ms));
		return () => {
			window.cancelAnimationFrame(frame);
			for (const timer of timers) window.clearTimeout(timer);
		};
	}, [openId]);
	const fitted = fitColumns(columns, contentPx, 148, 8);
	const flow = (0, import_react.useMemo)(() => layoutFlow(visible.map((item) => ({
		id: item.id,
		width: item.width,
		height: item.height,
		scale: item.scale
	})), {
		contentWidth: contentPx,
		columns: fitted,
		gap: 8,
		lastRow: "match"
	}), [
		visible,
		contentPx,
		fitted
	]);
	const placements = flow.placements;
	placementsRef.current = placements;
	(0, import_react.useEffect)(() => {
		const node = flowRef.current;
		if (!node) return;
		const measure = () => {
			const next = node.clientWidth;
			if (next > 0) setContentPx((current) => current === next ? current : next);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		return () => observer.disconnect();
	}, [
		phase,
		visible.length,
		compact,
		folderShown,
		tagShown
	]);
	const counts = (0, import_react.useMemo)(() => {
		const tally = {};
		for (const tag of tags) tally[tag.id] = 0;
		for (const item of scopedItems) for (const id of item.tagIds) if (tally[id] !== void 0) tally[id] += 1;
		return tally;
	}, [tags, scopedItems]);
	const tagById = (0, import_react.useMemo)(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
	const listedTags = (0, import_react.useMemo)(() => tagsInRailOrder(tags, tagFolders), [tags, tagFolders]);
	const currentFolder = folders.find((folder) => folder.id === folderId) ?? null;
	const showOrigin = folderId === "all" || currentFolder?.isParent === true;
	const readingIds = placements.length ? [...placements].sort((a, b) => a.y - b.y || a.x - b.x).map((box) => box.id) : visible.map((item) => item.id);
	const openItem = openId ? visible.find((item) => item.id === openId) ?? scopedItems.find((item) => item.id === openId && favoritesOnly && !item.favorite && passesTagFilter(item.tagIds, activeTagIds, hiddenTagIds, tagMatch)) ?? null : null;
	const openIndex = openItem ? readingIds.indexOf(openItem.id) : -1;
	const openAt = (id) => {
		if (!openId) galleryScroll.current = scrollRef.current?.scrollTop ?? 0;
		setOpenId(id);
	};
	const scrollToId = (id) => {
		const scroller = scrollRef.current;
		const node = scroller?.querySelector(`[data-shot-id="${CSS.escape(id)}"]`);
		if (!scroller || !(node instanceof HTMLElement)) return false;
		const scrollerRect = scroller.getBoundingClientRect();
		const cardRect = node.getBoundingClientRect();
		const head = scroller.querySelector(".library-head");
		const sticky = head instanceof HTMLElement ? head.getBoundingClientRect().height : 0;
		const top = scrollTopForCenter(scroller.scrollTop, scrollerRect.top, scrollerRect.height, cardRect.top, cardRect.height, sticky);
		scroller.scrollTo({
			top,
			behavior: "smooth"
		});
		setFlashId(id);
		setFlashFade(false);
		window.setTimeout(() => setFlashFade(true), 40);
		window.setTimeout(() => {
			setFlashId((current) => current === id ? null : current);
			setFlashFade(false);
		}, 1100);
		return true;
	};
	(0, import_react.useEffect)(() => {
		const id = pendingJump.current;
		if (!id || phase !== "ready") return;
		const item = items.find((entry) => entry.id === id);
		if (!item) {
			pendingJump.current = null;
			notify("その画像は見つかりません。");
			return;
		}
		if (folderId !== "all" && !inScope(item, scope)) return;
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
		const frame = window.requestAnimationFrame(() => {
			if (pendingJump.current !== id) return;
			if (scrollToId(id)) pendingJump.current = null;
		});
		return () => window.cancelAnimationFrame(frame);
	}, [
		phase,
		items,
		folderId,
		scope,
		favoritesOnly,
		activeTagIds,
		hiddenTagIds,
		tagMatch,
		contentPx,
		visible.length
	]);
	const jumpTo = (id) => {
		const item = items.find((entry) => entry.id === id);
		if (!item) {
			notify("その画像は見つかりません。");
			return;
		}
		if (!inScope(item, scope)) {
			pendingJump.current = id;
			selectFolder(item.folderId);
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
			setPhonePane((current) => current === "folder" ? null : "folder");
			return;
		}
		saveFolderOpen(!folderOpen);
	};
	const toggleTag = () => {
		if (compact) {
			setPhonePane((current) => current === "tag" ? null : "tag");
			return;
		}
		saveTagOpen(!tagOpen);
	};
	const beginWidth = (kind, event) => {
		if (compact || event.button !== 0) return;
		event.preventDefault();
		const startX = event.clientX;
		const start = kind === "folder" ? folderWidth : tagWidth;
		const clamp = (value) => kind === "folder" ? Math.min(420, Math.max(180, value)) : Math.min(320, Math.max(180, value));
		const move = (pointer) => {
			const delta = pointer.clientX - startX;
			setWidthDrag({
				kind,
				width: clamp(Math.round(start + (kind === "folder" ? delta : -delta)))
			});
		};
		const end = (pointer) => {
			const delta = pointer.clientX - startX;
			const next = clamp(Math.round(start + (kind === "folder" ? delta : -delta)));
			setWidthDrag(null);
			if (kind === "folder") saveFolderWidth(next);
			else saveTagWidth(next);
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", end);
			window.removeEventListener("pointercancel", end);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", end);
		window.addEventListener("pointercancel", end);
	};
	const movingIds = dragId && selected.includes(dragId) && selected.length > 1 ? selected : dragId ? [dragId] : [];
	const ownerFolders = new Set(movingIds.map((id) => items.find((item) => item.id === id)?.folderId).filter((id) => !!id));
	const ownerFolderId = ownerFolders.size === 1 ? [...ownerFolders][0] : null;
	const onCardDragStart = (id, event) => {
		if (compact || viewerLocked()) return;
		dragCleanup.current?.();
		const group = selectedRef.current.includes(id) && selectedRef.current.length > 1 ? [...selectedRef.current] : [id];
		const preview = dragPreviewOf(id);
		dragPointRef.current = {
			x: event.clientX,
			y: event.clientY
		};
		markKeyRef.current = "";
		folderHoldRef.current = null;
		dropRef.current = {
			folder: null,
			index: null
		};
		setDragId(id);
		setDragPreview(preview);
		setInsertMarks([]);
		setDropFolderId(null);
		const showMarks = (marks) => {
			const key = marks.map((mark) => `${mark.id}:${mark.edge}`).join("|");
			if (key === markKeyRef.current) return;
			markKeyRef.current = key;
			setInsertMarks(marks);
		};
		const showFolder = (folder) => {
			if (folderHoldRef.current === folder) return;
			folderHoldRef.current = folder;
			setDropFolderId(folder);
		};
		const move = (pointer) => {
			dragPointRef.current = {
				x: pointer.clientX,
				y: pointer.clientY
			};
			const previewNode = previewRef.current;
			if (previewNode) placePreview(previewNode, pointer.clientX, pointer.clientY);
			const folderId = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest("[data-folder-id]")?.getAttribute("data-folder-id") ?? null;
			const folder = folderId && folderId !== "all" ? folderId : null;
			if (folder) {
				dropRef.current = {
					folder,
					index: null
				};
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
				y: pointer.clientY - rect.top
			});
			dropRef.current = {
				folder: null,
				index: slot ? slot.index : null
			};
			showMarks(slot?.marks ?? []);
		};
		let finished = false;
		const end = (commit) => {
			if (finished) return;
			finished = true;
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", finish);
			window.removeEventListener("pointercancel", cancel);
			dragCleanup.current = null;
			const folder = dropRef.current.folder;
			const index = dropRef.current.index;
			dropRef.current = {
				folder: null,
				index: null
			};
			dragPointRef.current = null;
			markKeyRef.current = "";
			folderHoldRef.current = null;
			setDragId(null);
			setDragPreview(null);
			setInsertMarks([]);
			setDropFolderId(null);
			if (!commit) return;
			if (folder && folder !== "all") {
				moveImagesToFolder(group, folder);
				return;
			}
			if (index === null) return;
			const order = orderFromInsertion(placementsRef.current, group, id, index, directionRef.current === "desc");
			if (!order) return;
			setVisibleOrder(order);
			commitImageOrder();
		};
		const finish = () => end(true);
		const cancel = () => end(false);
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", finish);
		window.addEventListener("pointercancel", cancel);
		dragCleanup.current = () => end(false);
		event.preventDefault();
	};
	const onGalleryPointerDown = (event) => {
		if (compact || viewerLocked() || event.button !== 0) return;
		const target = event.target;
		if (target?.closest(".shot-card, button, a, input, textarea, select, label, .library-head")) return;
		const flowNode = flowRef.current;
		const scroller = scrollRef.current;
		if (!flowNode || !scroller) return;
		if (target === scroller) {
			const bounds = scroller.getBoundingClientRect();
			const barX = scroller.offsetWidth - scroller.clientWidth;
			const barY = scroller.offsetHeight - scroller.clientHeight;
			if (barX > 0 && event.clientX >= bounds.right - barX || barY > 0 && event.clientY >= bounds.bottom - barY) return;
		}
		const point = (clientX, clientY) => {
			const rect = flowNode.getBoundingClientRect();
			return {
				x: clientX - rect.left,
				y: clientY - rect.top
			};
		};
		const origin = point(event.clientX, event.clientY);
		const drag = {
			x0: origin.x,
			y0: origin.y,
			x1: origin.x,
			y1: origin.y,
			base: selectedRef.current,
			clientX: event.clientX,
			clientY: event.clientY
		};
		let moved = false;
		const paint = () => {
			const hits = boxesInRect(placementsRef.current, {
				x: drag.x0,
				y: drag.y0,
				w: drag.x1 - drag.x0,
				h: drag.y1 - drag.y0
			});
			const next = [...drag.base];
			for (const id of hits) if (!next.includes(id)) next.push(id);
			setSelected(next);
			setMarquee({
				x: Math.min(drag.x0, drag.x1),
				y: Math.min(drag.y0, drag.y1),
				w: Math.abs(drag.x1 - drag.x0),
				h: Math.abs(drag.y1 - drag.y0)
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
		const move = (pointer) => {
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
			if (navigator.clipboard?.read) try {
				const clip = await navigator.clipboard.read();
				const files = [];
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
				if (stale() || error instanceof DOMException && error.name === "AbortError") return;
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
		if (prompt.kind === "image") unassignTagFromImages(selected.includes(prompt.imageId) && selected.length > 1 ? selected : [prompt.imageId], prompt.id);
		else if (prompt.kind === "clear") clearFilterTags(prompt.side);
		else removeFilterTag(prompt.id, prompt.side);
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
		if (items.length === 0) return "まだ画像がありません";
		if (scopedItems.length === 0) return "このフォルダには画像がありません";
		if (favoritesOnly) return "お気に入りはまだありません";
		return "該当する画像がありません";
	};
	const onShellDragEnter = (event) => {
		if (currentTagDrag() || dragHitsField(event) || !isExternalFileDrag(event)) return;
		event.preventDefault();
		if (compact || viewerLocked()) return;
		dragDepth.current += 1;
		setFileDrag(true);
	};
	const onShellDragOver = (event) => {
		if (currentTagDrag() || dragHitsField(event) || !isExternalFileDrag(event)) return;
		event.preventDefault();
		if (event.dataTransfer) preferDropEffect(event.dataTransfer);
	};
	const onShellDragLeave = (event) => {
		if (currentTagDrag() || dragHitsField(event) || !isExternalFileDrag(event)) return;
		dragDepth.current = Math.max(0, dragDepth.current - 1);
		if (dragDepth.current === 0) setFileDrag(false);
	};
	const finishExternalDrop = (transfer) => {
		dragDepth.current = 0;
		setFileDrag(false);
		if (compact || viewerLocked()) return;
		const rawFiles = filesFromTransfer(transfer);
		const plan = chooseDroppedPayload(readDrag(transfer, "text/uri-list"), readDrag(transfer, "text/html"), readDrag(transfer, "text/plain"), readDrag(transfer, "DownloadURL"));
		logDrop({
			types: Array.from(transfer.types),
			files: rawFiles.map((file) => ({
				name: file.name,
				type: file.type || "(none)",
				size: file.size
			})),
			urls: plan.primary.urls.length,
			dataUrls: plan.primary.dataUrls.length,
			blocked: plan.primary.blocked.map((entry) => entry.split(":")[0] ?? "").slice(0, 4)
		});
		importExternalDrop(rawFiles, plan);
	};
	const importExternalDrop = async (rawFiles, plan) => {
		if (compact || viewerLocked()) return;
		const images = [];
		let foreign = 0;
		for (let index = 0; index < rawFiles.length; index += 1) {
			const normalized = await asImportableFile(rawFiles[index], index);
			if (normalized) images.push(normalized);
			else foreign += 1;
		}
		if (images.length > 0) {
			logDrop({
				path: "file",
				reason: "file",
				files: images.length,
				skipped: foreign
			});
			await addFiles(images, "file");
			if (foreign > 0) notify(`${foreign}件は JPEG、PNG、GIF ではありませんでした。既存の画像はそのままです。`);
			return;
		}
		const takeAddresses = async (sources) => {
			const dataFiles = [];
			let badData = 0;
			sources.dataUrls.forEach((url, index) => {
				const file = fileFromDataUrl(url, index);
				if (file) dataFiles.push(file);
				else badData += 1;
			});
			if (dataFiles.length > 0) return {
				files: dataFiles,
				browser: 0,
				format: badData,
				missing: 0,
				path: "data"
			};
			if (sources.urls.length === 0) return {
				files: [],
				browser: 0,
				format: badData,
				missing: 0,
				path: "none"
			};
			const ctrl = new AbortController();
			setPasteNote(sources.urls.length > 1 ? `${sources.urls.length}件のアドレスを取得しています` : "画像のアドレスを取得しています");
			const fetched = [];
			let browser = 0;
			let format = badData;
			let missing = 0;
			try {
				for (const url of sources.urls) try {
					const result = await fetchBrowserMedia(url, ctrl.signal);
					if (result.ok) fetched.push(result.file);
					else if (result.reason === "browser") browser += 1;
					else if (result.reason === "format") format += 1;
					else missing += 1;
					if (!result.ok) logDrop({
						path: "url",
						reason: result.reason,
						host: (() => {
							try {
								return new URL(url).host;
							} catch {
								return "";
							}
						})()
					});
				} catch (error) {
					if (error instanceof DOMException && error.name === "AbortError") throw error;
					browser += 1;
					logDrop({
						path: "url",
						reason: "browser"
					});
				}
			} finally {
				setPasteNote(null);
			}
			return {
				files: fetched,
				browser,
				format,
				missing,
				path: fetched.length > 0 ? "url" : "none"
			};
		};
		let outcome;
		try {
			outcome = await takeAddresses(plan.primary);
			if (outcome.files.length === 0 && plan.fallback.urls.length + plan.fallback.dataUrls.length > 0) {
				const alt = await takeAddresses(plan.fallback);
				outcome = alt.files.length > 0 ? alt : {
					files: [],
					browser: outcome.browser + alt.browser,
					format: outcome.format + alt.format,
					missing: outcome.missing + alt.missing,
					path: "none"
				};
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") return;
			throw error;
		}
		const failed = outcome.browser + outcome.format + outcome.missing + foreign;
		const reason = outcome.browser > 0 || plan.primary.blocked.length > 0 ? "browser" : outcome.format > 0 || foreign > 0 ? "format" : "url";
		logDrop({
			path: outcome.files.length > 0 ? outcome.path : "none",
			reason,
			added: outcome.files.length,
			browser: outcome.browser,
			format: outcome.format,
			missing: outcome.missing
		});
		if (outcome.files.length > 0) await addFiles(outcome.files, "file");
		if (failed > 0 && outcome.files.length === 0) notify(dropMissMessage(reason));
		else if (failed > 0) {
			const bits = [];
			if (outcome.browser > 0) bits.push(`${outcome.browser}件はブラウザの制限で読み取れませんでした。`);
			if (outcome.format > 0) bits.push(`${outcome.format}件は JPEG、PNG、GIF ではありませんでした。`);
			if (outcome.missing > 0) bits.push(`${outcome.missing}件のアドレスからは画像を取得できませんでした。`);
			notify(`${bits.join("")}取り込めた画像以外は、そのままにしています。`);
		}
	};
	importDropRef.current = finishExternalDrop;
	const onShellDrop = (event) => {
		if (currentTagDrag() || !isExternalFileDrag(event)) return;
		if (handledDrops.has(event.nativeEvent)) return;
		handledDrops.add(event.nativeEvent);
		event.preventDefault();
		event.stopPropagation();
		const node = event.target instanceof Element ? event.target : null;
		const onMain = Boolean(node?.closest(".library-main"));
		const dropped = filesForDrop(event.dataTransfer);
		const backups = dropped.filter((file) => isBackupFileName(file.name));
		if (onMain && backups.length > 0) {
			dragDepth.current = 0;
			setFileDrag(false);
			if (phase !== "ready") {
				notify("ライブラリの準備が終わるまで、バックアップは復元できません。データは変更していません。");
				return;
			}
			if (dropped.length !== 1 || backups.length !== 1) {
				notify("バックアップファイルは1つだけ、ほかのファイルと分けてドロップしてください。ライブラリは変更していません。");
				return;
			}
			backupRef.current?.inspectFile(dropped[0]);
			return;
		}
		finishExternalDrop(event.dataTransfer);
	};
	const createInPlace = (name) => {
		createFolder(name, currentFolder?.isParent ? currentFolder.id : currentFolder?.parentId ?? null);
	};
	const pickLibraryTab = (tab) => {
		if (compact || tabBusy || phase === "boot") return;
		if (phase === "ready" && tab === libraryTab) return;
		const ticket = tabRequest.current + 1;
		tabRequest.current = ticket;
		setTabBusy(true);
		switchLibraryTab(tab).finally(() => {
			if (ticket !== tabRequest.current) return;
			setTabBusy(false);
		});
	};
	const tabButtons = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LibraryTabButtons, {
		current: libraryTab,
		pressed: phase !== "boot",
		busy: tabBusy || phase === "boot",
		onPick: pickLibraryTab
	});
	if (phase === "unavailable") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "library-shell",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "library-main",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "error-well grid place-items-center px-6 text-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid max-w-md gap-3",
					children: [
						compact ? null : tabButtons,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-lg",
							children: "保存機能を使えません"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-ink-muted",
							children: bootError
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => void retryBootstrap(),
							children: "もう一度開く"
						})
					]
				})
			})
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "library-shell",
		style: {
			["--folder-width"]: `${folderW}px`,
			["--tag-width"]: `${tagW}px`
		},
		onDragEnter: onShellDragEnter,
		onDragOver: onShellDragOver,
		onDragLeave: onShellDragLeave,
		onDrop: onShellDrop,
		children: [
			compact && phonePane ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "phone-scrim",
				"aria-label": "欄を閉じる",
				onClick: () => setPhonePane(null)
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderRail, {
				folders,
				items,
				selected: folderId,
				open: folderShown,
				width: folderW,
				dragging: dragId !== null,
				ownerFolderId,
				dropFolderId,
				dropCount: movingIds.length,
				onSelect: (id) => void selectFolder(id),
				onCreate: createInPlace,
				onRename: renameFolder,
				onDelete: (id) => void removeFolder(id),
				onCopy: (id) => rememberFolderCopy(id),
				onPaste: () => void pasteFolderCopy(),
				copyReady: folderClip !== null,
				onReorder: (sourceId, beforeId, parentId) => void moveFolder(sourceId, beforeId, parentId),
				onNest: (sourceId, parentId) => void nestFolder(sourceId, parentId),
				onToggle: toggleFolder,
				paneHeight: folderPane,
				onPane: (height) => void saveFolderPane(height),
				onJump: jumpTo,
				viewer: compact
			}),
			folderShown && !compact ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "folder-split",
				role: "separator",
				"aria-orientation": "vertical",
				"aria-label": "フォルダ欄の幅",
				onPointerDown: (event) => beginWidth("folder", event)
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "library-main",
				ref: scrollRef,
				onPointerDown: onGalleryPointerDown,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "library-head",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "tool-stack",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "tool-row tool-row-main",
								children: [
									compact ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "tool-cluster",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "tool-label",
												children: "タブ"
											}),
											tabButtons,
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "seg",
												role: "group",
												"aria-label": "並び順",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													className: direction === "asc" ? "is-on" : void 0,
													"aria-pressed": direction === "asc",
													disabled: phase !== "ready",
													onClick: () => void setDirection("asc"),
													children: "昇順"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													className: direction === "desc" ? "is-on" : void 0,
													"aria-pressed": direction === "desc",
													disabled: phase !== "ready",
													onClick: () => void setDirection("desc"),
													children: "降順"
												})]
											})
										]
									}),
									compact ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "seg",
										role: "group",
										"aria-label": "表示サイズ",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: phase !== "ready" || columns <= 2,
											onClick: () => void setColumns(columns - 1),
											children: "拡大"
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: phase !== "ready" || columns >= 6,
											onClick: () => void setColumns(columns + 1),
											children: "縮小"
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										variant: "quiet",
										"aria-pressed": favoritesOnly,
										disabled: !hasFavorite,
										onClick: () => void saveFavoritesOnly(!favoritesOnly),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Heart, {
											className: "size-4",
											"aria-hidden": "true",
											fill: favoritesOnly ? "currentColor" : "none"
										}), "お気に入りのみ"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "tool-cluster import-cluster phone-shelved",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												className: "import-btn",
												disabled: phase !== "ready",
												onClick: () => void paste(),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ClipboardPaste, {
													className: "size-4",
													"aria-hidden": "true"
												}), "クリップボードから貼りつけ"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												className: "import-btn",
												disabled: phase !== "ready",
												onClick: () => void capture(),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Crop, {
													className: "size-4",
													"aria-hidden": "true"
												}), "画面から取り込む"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												className: "import-btn",
												disabled: phase !== "ready",
												onClick: () => fileRef.current?.click(),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImagePlus, {
													className: "size-4",
													"aria-hidden": "true"
												}), "画像を取り込む"]
											})
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										variant: "quiet",
										className: "phone-shelved",
										disabled: phase !== "ready" || visible.length === 0,
										onClick: () => setPdfOpen(true),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDown, {
											className: "size-4",
											"aria-hidden": "true"
										}), "現在の表示をPDF化"]
									})
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "tool-row tool-row-sub",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BackupActions, {
										ref: backupRef,
										disabled: phase !== "ready",
										viewer: compact,
										tab: activeLibraryTab()
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "quiet",
										className: "aux-btn",
										"data-spot-trigger": "",
										disabled: phase !== "ready" || resetting,
										onClick: (event) => setResetAsk(event.currentTarget.getBoundingClientRect()),
										children: "現在のタブを初期化"
									}),
									resetAsk ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpotConfirm, {
										anchor: resetAsk,
										side: "below",
										title: "現在のタブを初期化",
										body: `現在選択中のタブ（タブ${activeLibraryTab()}）のライブラリデータをすべて削除し、初期状態に戻します。この操作は元に戻せません。実行しますか？`,
										confirmLabel: "初期化",
										busy: resetting,
										onCancel: () => {
											if (!resetting) setResetAsk(null);
										},
										onConfirm: () => {
											if (resetting) return;
											setResetting(true);
											setSelected([]);
											setOpenId(null);
											setPrompt(null);
											setPdfOpen(false);
											setSlideshowOpen(false);
											resetCurrentLibrary().finally(() => {
												setResetting(false);
												setResetAsk(null);
											});
										}
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "quiet",
										className: "aux-btn phone-shelved",
										onClick: () => setStorageOpen(true),
										children: "容量"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										variant: "quiet",
										className: "aux-btn",
										disabled: phase !== "ready",
										onClick: () => {
											if (slideshowCandidates(visible).length === 0) {
												notify("表示中の画像がないため、スライドショーを開始できません。");
												return;
											}
											setSlideshowOpen(true);
										},
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {
											className: "size-4",
											"aria-hidden": "true"
										}), "スライドショー"]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "quiet",
										className: "tool-shelved",
										onClick: () => setSyncOpen(true),
										children: "同期"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "quiet",
										className: "tool-shelved",
										onClick: () => setQrOpen(true),
										children: "QR接続テスト"
									})
								]
							})]
						}),
						pasteNote ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "paste-note px-4 pb-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: pasteNote }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "quiet",
								onClick: cancelPaste,
								children: "キャンセル"
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "tag-board",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TagFilterPane, {
								side: "active",
								title: "選択タグ",
								ids: activeTagIds,
								tagById,
								viewer: compact,
								match: tagMatch,
								onMatch: (next) => void setTagMatch(next),
								onPrompt: (id, rect) => setPrompt({
									kind: "filter",
									id,
									side: "active",
									...popAt(rect)
								}),
								onClear: (rect) => setPrompt({
									kind: "clear",
									side: "active",
									...popAt(rect)
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TagFilterPane, {
								side: "hidden",
								title: "ネガティブタグ",
								ids: hiddenTagIds,
								tagById,
								viewer: compact,
								onPrompt: (id, rect) => setPrompt({
									kind: "filter",
									id,
									side: "hidden",
									...popAt(rect)
								}),
								onClear: (rect) => setPrompt({
									kind: "clear",
									side: "hidden",
									...popAt(rect)
								})
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
					className: "gallery-pad",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-sm text-ink-muted",
						children: phase === "ready" ? statusLabel(visible.length, importing) : "ライブラリを開いています"
					}), phase !== "ready" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "empty-well grid place-items-center text-ink-muted",
						children: "ライブラリを開いています"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						ref: flowRef,
						className: "gallery-flow",
						style: visible.length === 0 ? void 0 : { height: flow.height },
						children: [
							visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "empty-well grid place-items-center text-ink-muted",
								children: emptyCopy()
							}) : null,
							visible.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageCard, {
								item,
								box: placements.find((box) => box.id === item.id) ?? {
									id: item.id,
									x: 0,
									y: 0,
									w: 0,
									h: 0
								},
								tags: listedTags.filter((tag) => item.tagIds.includes(tag.id)),
								dragging: movingIds.includes(item.id),
								insertEdge: movingIds.includes(item.id) ? null : insertMarks.find((mark) => mark.id === item.id)?.edge ?? null,
								onOpen: openAt,
								onDragStart: onCardDragStart,
								flash: flashId === item.id,
								fading: flashId === item.id && flashFade,
								origin: showOrigin ? folderPath(folders, item.folderId) : "",
								selected: selected.includes(item.id),
								bulk: selected.length > 1,
								onToggleSelect: (id) => setSelected((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]),
								onFavorite: (id) => {
									if (selected.includes(id) && selected.length > 1) favoriteImages(selected);
									else toggleFavorite(id);
								},
								onDelete: (id) => {
									if (selected.includes(id) && selected.length > 1) removeImages(selected);
									else removeImage(id);
								},
								onMemo: (id, memo) => void setImageMemo(id, memo),
								onAssignTag: (imageId, tagId) => {
									assignTagToImages(selected.includes(imageId) && selected.length > 1 ? selected : [imageId], tagId);
								},
								onTagPrompt: (imageId, tagId, rect) => setPrompt({
									kind: "image",
									id: tagId,
									imageId,
									...popAt(rect)
								}),
								viewer: compact
							}, item.id)),
							marquee && marquee.w + marquee.h > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "select-rect",
								style: {
									left: marquee.x,
									top: marquee.y,
									width: marquee.w,
									height: marquee.h
								}
							}) : null
						]
					})]
				})]
			}),
			tagShown && !compact ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tag-split",
				role: "separator",
				"aria-orientation": "vertical",
				"aria-label": "タグ欄の幅",
				onPointerDown: (event) => beginWidth("tag", event)
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TagRail, {
				tags,
				folders: tagFolders,
				counts,
				selected: activeTagIds,
				hidden: hiddenTagIds,
				open: tagShown,
				width: tagW,
				onToggle: toggleTag,
				onSelect: (id) => void selectTag(id),
				onHide: (id) => void hideTag(id),
				onCreate: (name) => void createTag(name),
				onCreateFolder: (name) => void createTagFolder(name),
				onToggleFolder: (id) => void toggleTagFolder(id),
				onPlaceTag: (tagId, folderId, beforeId) => void placeTag(tagId, folderId, beforeId),
				onDeleteFolder: (id) => void deleteTagFolder(id),
				onRename: renameTag,
				onDelete: (id) => void removeTag(id),
				viewer: compact
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				ref: fileRef,
				className: "sr-only",
				type: "file",
				accept: "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm",
				multiple: true,
				"aria-label": "画像を取り込む",
				onChange: (event) => {
					const list = Array.from(event.target.files ?? []);
					event.target.value = "";
					if (compact || viewerLocked()) return;
					if (list.length > 0) addFiles(list, "file");
				}
			}),
			selected.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "select-count",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [selected.length, "枚選択中"] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setSelected([]),
					children: "解除"
				})]
			}) : null,
			notices.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "notice-stack",
				children: notices.map((notice) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "alert-error rounded-md px-3 py-2 text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0",
						children: notice.message
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "mt-1 underline",
						onClick: () => dismissNotices(),
						children: "閉じる"
					})]
				}, notice.id))
			}) : null,
			prompt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "tag-pop",
				style: {
					top: prompt.top,
					left: prompt.left
				},
				role: "dialog",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: promptText() }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: confirmPrompt,
					children: "削除"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setPrompt(null),
					children: "キャンセル"
				})] })]
			}) : null,
			pendingAdd ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "dest-layer",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "dest-card",
					role: "dialog",
					"aria-label": "追加先のフォルダ",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "m-0",
							children: "親フォルダには直接入れられません。入れる子フォルダを選んでください。"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "dest-list",
							children: imageFolderChoices(folders, pendingAdd.parentId).map((folder) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void confirmPendingAdd(folder.id),
								children: folderPath(folders, folder.id)
							}, folder.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 flex justify-end",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "quiet",
								onClick: () => cancelPendingAdd(),
								children: "キャンセル"
							})
						})
					]
				})
			}) : null,
			fileDrag ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "drop-veil",
				children: "画像をここにドロップ"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lightbox, {
				item: openItem,
				index: openIndex,
				total: Math.max(readingIds.length, openItem ? 1 : 0),
				prev: openItem && openIndex >= 0 && readingIds.length > 1 ? visible.find((entry) => entry.id === readingIds[(openIndex - 1 + readingIds.length) % readingIds.length]) ?? null : null,
				next: openItem && openIndex >= 0 && readingIds.length > 1 ? visible.find((entry) => entry.id === readingIds[(openIndex + 1) % readingIds.length]) ?? null : null,
				onClose: () => setOpenId(null),
				onToggleFavorite: (id) => void toggleFavorite(id, { fromLightbox: true }),
				tags: openItem ? listedTags.filter((tag) => openItem.tagIds.includes(tag.id)) : [],
				onStep: (delta) => {
					if (!openId) return;
					const count = readingIds.length;
					if (count < 2) return;
					const index = readingIds.indexOf(openId);
					if (index < 0) return;
					const next = readingIds[(index + delta + count) % count];
					if (next) setOpenId(next);
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PdfPreview, {
				open: pdfOpen,
				items: visible,
				columns,
				onOpenChange: setPdfOpen
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Slideshow, {
				open: slideshowOpen,
				items: visible,
				onOpenChange: setSlideshowOpen
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StorageDialog, {
				open: storageOpen,
				onOpenChange: setStorageOpen
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LanSyncDialog, {
				open: syncOpen,
				onOpenChange: setSyncOpen
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrLinkDialog, {
				open: qrOpen,
				bootText: qrBoot,
				onOpenChange: (next) => {
					setQrOpen(next);
					if (!next) setQrBoot(null);
				}
			}),
			snipUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SnipOverlay, {
				url: snipUrl,
				busy: false,
				onCancel: closeSnip,
				onCrop: (blob) => {
					closeSnip();
					addFiles([new File([blob], `capture-${Date.now()}.png`, { type: "image/png" })], "capture");
				}
			}) : null,
			dragPreview ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: previewRef,
				className: "drag-preview",
				style: {
					width: dragPreview.w,
					height: dragPreview.h
				},
				"aria-hidden": "true",
				children: dragPreview.src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
					src: dragPreview.src,
					alt: "",
					draggable: false
				}) : null
			}) : null
		]
	});
}
function TagFilterPane({ side, title, ids, tagById, viewer, match = "all", onMatch, onPrompt, onClear }) {
	const [hot, setHot] = (0, import_react.useState)(false);
	const chips = ids.flatMap((id) => {
		const tag = tagById.get(id);
		return tag ? [tag] : [];
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: hot ? "tag-pane is-hot" : "tag-pane",
		onDragOver: (event) => {
			if (!eventIsTagDrag(event.dataTransfer.types)) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
			setHot(true);
		},
		onDragLeave: (event) => {
			if (event.currentTarget.contains(event.relatedTarget)) return;
			setHot(false);
		},
		onDrop: (event) => {
			if (!eventIsTagDrag(event.dataTransfer.types)) return;
			const id = event.dataTransfer.getData("application/x-komacho-tag") || currentTagDrag();
			event.preventDefault();
			setHot(false);
			if (id) placeFilterTag(id, side);
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "tag-pane-head",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: title }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "tag-pane-actions",
				children: [side === "active" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "tag-banner-action is-current",
					"aria-pressed": match === "any",
					"aria-label": match === "any" ? "いずれか一致。すべて一致に切り替え" : "すべて一致。いずれか一致に切り替え",
					onPointerDown: (event) => event.stopPropagation(),
					onClick: (event) => {
						event.stopPropagation();
						onMatch?.(match === "any" ? "all" : "any");
					},
					children: match === "any" ? "いずれか一致" : "すべて一致"
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "tag-banner-action",
					disabled: chips.length === 0,
					onClick: (event) => onClear(event.currentTarget.getBoundingClientRect()),
					children: "すべて外す"
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "tag-pane-list",
			children: [chips.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "tag-pane-empty",
				children: viewer ? "タグを選ぶとここに出ます" : "ここにタグをドロップ"
			}) : null, chips.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: side === "hidden" ? "tag-banner-chip is-negative" : "tag-banner-chip",
				style: { background: tag.color },
				draggable: !viewer,
				onDragStart: (event) => {
					if (viewer) {
						event.preventDefault();
						return;
					}
					event.dataTransfer.effectAllowed = "all";
					event.dataTransfer.setData(TAG_DRAG, tag.id);
					event.dataTransfer.setData("text/plain", tag.name);
					beginTagDrag(tag.id);
					event.dataTransfer.setDragImage(event.currentTarget, 16, 12);
				},
				onDragEnd: () => endTagDrag(),
				onDoubleClick: (event) => {
					event.preventDefault();
					onPrompt(tag.id, event.currentTarget.getBoundingClientRect());
				},
				children: tag.name
			}, tag.id))]
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortfolioScreen, {});
}
//#endregion
export { Home as component };
