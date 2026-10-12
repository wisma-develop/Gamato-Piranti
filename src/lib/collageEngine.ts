// Collage engine — layout templates, geometry, and canvas rendering.
//
// Preview and export use the SAME renderCollage() function (only the target
// pixel width differs), so what the user sees is exactly what is exported.
// Pure browser/canvas code, no dependencies.

import { fontStack } from "@/lib/fontPresets";

/* ────────────────────────────── Types ────────────────────────────── */

export type CellShape = "rect" | "circle" | "hexagon" | "diamond" | "heart";
export type FitMode = "cover" | "contain";
export type BgType = "solid" | "gradient" | "photo-blur" | "image";

export interface CellState {
  photoId: string | null;
  zoom: number; // 1 – 6
  panX: number; // -1 … 1
  panY: number; // -1 … 1
  rot: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  fit: FitMode;
  brightness: number; // 50 – 150 (%)
  contrast: number; // 50 – 150 (%)
  saturate: number; // 0 – 200 (%)
  grayscale: boolean;
  sepia: boolean;
  blur: number; // 0 – 10 (px @ 1000px canvas)
}

/** Free-mode geometry, normalised to the canvas (centre + size + rotation). */
export interface FreeRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rotate: number; // degrees
}

export interface TextLayer {
  id: string;
  text: string;
  cx: number; // 0..1
  cy: number; // 0..1
  size: number; // % of canvas width
  color: string;
  font: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  strokeColor: string;
  strokeWidth: number; // % of font size
  shadow: boolean;
  rotate: number;
  opacity: number; // 0..1
  bgColor: string;
  bgOpacity: number; // 0..1 (0 = no plate)
}

export interface CollageBackground {
  type: BgType;
  color: string;
  color2: string;
  angle: number;
  imageId: string | null;
  blur: number; // for photo-blur (px @ 1000)
}

export interface CollageState {
  mode: "template" | "free";
  templateId: string;
  autoCount: number; // used by the "auto" template
  autoCols: number; // 0 = automatic
  canvasPreset: string;
  customW: number;
  customH: number;
  padding: number; // % of min canvas side
  gap: number; // % of min canvas side
  radius: number; // % of min cell side (rect shape)
  shape: CellShape;
  borderWidth: number; // % of min canvas side ×10 → see borderPx()
  borderColor: string;
  shadowOn: boolean;
  shadowBlur: number; // % of min side
  shadowOpacity: number; // 0..1
  bg: CollageBackground;
  cells: CellState[];
  free: FreeRect[];
  texts: TextLayer[];
}

export interface PhotoRef {
  id: string;
  name: string;
  img: HTMLImageElement;
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
}

/* ────────────────────────── Canvas presets ───────────────────────── */

export interface CanvasPreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: "sq", label: "Persegi 1:1 (Instagram)", w: 1, h: 1 },
  { id: "p45", label: "Potret 4:5 (Instagram)", w: 4, h: 5 },
  { id: "story", label: "Story 9:16 (Reels / TikTok)", w: 9, h: 16 },
  { id: "land169", label: "Lanskap 16:9 (YouTube)", w: 16, h: 9 },
  { id: "land32", label: "Foto 3:2", w: 3, h: 2 },
  { id: "p23", label: "Foto potret 2:3", w: 2, h: 3 },
  { id: "land43", label: "Layar 4:3", w: 4, h: 3 },
  { id: "p34", label: "Potret 3:4", w: 3, h: 4 },
  { id: "a4p", label: "A4 Potret", w: 210, h: 297 },
  { id: "a4l", label: "A4 Lanskap", w: 297, h: 210 },
  { id: "fb", label: "Cover Facebook (205:78)", w: 205, h: 78 },
  { id: "custom", label: "Kustom (px)", w: 1, h: 1 },
];

export const MAX_SIDE = 8192;
export const MAX_PIXELS = 40_000_000;

/** Output pixel size for a preset + target long-side. */
export function outputSize(state: Pick<CollageState, "canvasPreset" | "customW" | "customH">, longSide: number): { w: number; h: number } {
  let ratioW: number;
  let ratioH: number;
  if (state.canvasPreset === "custom") {
    ratioW = Math.max(1, state.customW);
    ratioH = Math.max(1, state.customH);
  } else {
    const p = CANVAS_PRESETS.find((c) => c.id === state.canvasPreset) ?? CANVAS_PRESETS[0];
    ratioW = p.w;
    ratioH = p.h;
  }
  const ls = Math.max(64, Math.min(MAX_SIDE, longSide));
  let w: number;
  let h: number;
  if (ratioW >= ratioH) {
    w = ls;
    h = Math.round((ls * ratioH) / ratioW);
  } else {
    h = ls;
    w = Math.round((ls * ratioW) / ratioH);
  }
  // Guard total pixel budget so the browser never silently fails to allocate.
  const px = w * h;
  if (px > MAX_PIXELS) {
    const k = Math.sqrt(MAX_PIXELS / px);
    w = Math.floor(w * k);
    h = Math.floor(h * k);
  }
  return { w: Math.max(16, w), h: Math.max(16, h) };
}

/* ───────────────────────── Template definitions ───────────────────── */

export type LayoutNode = { leaf: true } | { dir: "row" | "col"; items: { size: number; node: LayoutNode }[] };

const L: LayoutNode = { leaf: true };
const row = (...items: (LayoutNode | [number, LayoutNode])[]): LayoutNode => ({
  dir: "row",
  items: items.map((i) => (Array.isArray(i) ? { size: i[0], node: i[1] } : { size: 1, node: i })),
});
const col = (...items: (LayoutNode | [number, LayoutNode])[]): LayoutNode => ({
  dir: "col",
  items: items.map((i) => (Array.isArray(i) ? { size: i[0], node: i[1] } : { size: 1, node: i })),
});

export interface CollageTemplate {
  id: string;
  name: string;
  count: number;
  tree: LayoutNode;
}

function countLeaves(n: LayoutNode): number {
  return "leaf" in n ? 1 : n.items.reduce((a, i) => a + countLeaves(i.node), 0);
}

function T(id: string, name: string, tree: LayoutNode): CollageTemplate {
  return { id, name, count: countLeaves(tree), tree };
}

/** Evenly split grid `cols × rows` (full rows). */
function gridTree(cols: number, rows: number): LayoutNode {
  return col(...Array.from({ length: rows }, () => row(...Array.from({ length: cols }, () => L))));
}

/** Rows grid where the last (short) row stretches over the full width. */
export function autoGridTree(n: number, cols: number): LayoutNode {
  const c = Math.max(1, Math.min(cols, n));
  const rows: LayoutNode[] = [];
  let left = n;
  while (left > 0) {
    const take = Math.min(c, left);
    rows.push(row(...Array.from({ length: take }, () => L)));
    left -= take;
  }
  return rows.length === 1 ? rows[0] : col(...rows);
}

export function defaultAutoCols(n: number): number {
  return Math.max(1, Math.round(Math.sqrt(n)));
}

export const TEMPLATES: CollageTemplate[] = [
  T("t1", "Satu foto penuh", L),

  T("t2-v", "2 kolom", row(L, L)),
  T("t2-h", "2 baris", col(L, L)),
  T("t2-lw", "2 kolom — kiri lebar", row([2, L], [1, L])),
  T("t2-rw", "2 kolom — kanan lebar", row([1, L], [2, L])),
  T("t2-tw", "2 baris — atas tinggi", col([2, L], [1, L])),
  T("t2-bw", "2 baris — bawah tinggi", col([1, L], [2, L])),

  T("t3-v", "3 kolom", row(L, L, L)),
  T("t3-h", "3 baris", col(L, L, L)),
  T("t3-l", "1 besar kiri + 2", row([3, L], [2, col(L, L)])),
  T("t3-r", "1 besar kanan + 2", row([2, col(L, L)], [3, L])),
  T("t3-t", "1 besar atas + 2", col([3, L], [2, row(L, L)])),
  T("t3-b", "1 besar bawah + 2", col([2, row(L, L)], [3, L])),

  T("t4-g", "Grid 2×2", gridTree(2, 2)),
  T("t4-v", "4 kolom", row(L, L, L, L)),
  T("t4-h", "4 baris", col(L, L, L, L)),
  T("t4-l", "1 besar kiri + 3", row([2, L], [1, col(L, L, L)])),
  T("t4-r", "1 besar kanan + 3", row([1, col(L, L, L)], [2, L])),
  T("t4-t", "1 besar atas + 3", col([2, L], [1, row(L, L, L)])),
  T("t4-b", "1 besar bawah + 3", col([1, row(L, L, L)], [2, L])),
  T("t4-m", "Mozaik 4", row([1, col([2, L], [1, L])], [1, col([1, L], [2, L])])),

  T("t5-23", "2 + 3", col(row(L, L), row(L, L, L))),
  T("t5-32", "3 + 2", col(row(L, L, L), row(L, L))),
  T("t5-l", "1 besar kiri + 4", row([2, L], [1, col(L, L, L, L)])),
  T("t5-q", "1 besar + 4 grid", row([1, L], [1, gridTree(2, 2)])),
  T("t5-t", "1 besar atas + 4", col([2, L], [1, row(L, L, L, L)])),

  T("t6-g", "Grid 3×2", gridTree(3, 2)),
  T("t6-g2", "Grid 2×3", gridTree(2, 3)),
  T("t6-l", "1 besar kiri + 5", row([2, L], [1, col(L, L, L, L, L)])),
  T("t6-m", "Mozaik 6", col([1, row(L, L, L)], [2, row([1, col(L, L)], [2, L])])),
  T("t6-h", "1 besar atas + 5", col([2, L], [1, row(L, L, L, L, L)])),

  T("t7-a", "3 + 4", col(row(L, L, L), row(L, L, L, L))),
  T("t7-b", "1 besar + 6", row([2, L], [1, gridTree(2, 3)])),
  T("t7-c", "2 + 2 + 3", col(row(L, L), row(L, L), row(L, L, L))),

  T("t8-g", "Grid 4×2", gridTree(4, 2)),
  T("t8-g2", "Grid 2×4", gridTree(2, 4)),
  T("t8-a", "3 + 2 + 3", col(row(L, L, L), row(L, L), row(L, L, L))),
  T("t8-b", "1 besar + 7", row([2, L], [1, col(L, L, L, L, L, L, L)])),

  T("t9-g", "Grid 3×3", gridTree(3, 3)),
  T("t9-a", "1 besar + 8", row([2, L], [2, gridTree(2, 4)])),
  T("t9-b", "Mozaik 9", col(row(L, L, L), row([2, L], [1, L]), row(L, L, L))),

  T("t10-a", "Grid 5×2", gridTree(5, 2)),
  T("t10-b", "3 + 4 + 3", col(row(L, L, L), row(L, L, L, L), row(L, L, L))),
  T("t12-g", "Grid 4×3", gridTree(4, 3)),
  T("t12-g2", "Grid 3×4", gridTree(3, 4)),
  T("t16-g", "Grid 4×4", gridTree(4, 4)),
];

export const AUTO_TEMPLATE_ID = "auto";

export function getTree(state: Pick<CollageState, "templateId" | "autoCount" | "autoCols">): LayoutNode {
  if (state.templateId === AUTO_TEMPLATE_ID) {
    const n = Math.max(1, Math.min(60, state.autoCount));
    return autoGridTree(n, state.autoCols > 0 ? state.autoCols : defaultAutoCols(n));
  }
  return (TEMPLATES.find((t) => t.id === state.templateId) ?? TEMPLATES[0]).tree;
}

export function templateCellCount(state: Pick<CollageState, "templateId" | "autoCount" | "autoCols">): number {
  return countLeaves(getTree(state));
}

/* ───────────────────────────── Geometry ───────────────────────────── */

function layoutTree(node: LayoutNode, x: number, y: number, w: number, h: number, gap: number, out: Rect[]) {
  if ("leaf" in node) {
    out.push({ x, y, w: Math.max(1, w), h: Math.max(1, h), rotate: 0 });
    return;
  }
  const n = node.items.length;
  const total = node.items.reduce((a, i) => a + i.size, 0) || 1;
  if (node.dir === "row") {
    const avail = Math.max(1, w - gap * (n - 1));
    let cx = x;
    for (const it of node.items) {
      const cw = (avail * it.size) / total;
      layoutTree(it.node, cx, y, cw, h, gap, out);
      cx += cw + gap;
    }
  } else {
    const avail = Math.max(1, h - gap * (n - 1));
    let cy = y;
    for (const it of node.items) {
      const ch = (avail * it.size) / total;
      layoutTree(it.node, x, cy, w, ch, gap, out);
      cy += ch + gap;
    }
  }
}

/** Lays out a tree inside a w×h box (used for template thumbnails). */
export function layoutRects(tree: LayoutNode, w: number, h: number, gap: number): Rect[] {
  const out: Rect[] = [];
  layoutTree(tree, 0, 0, w, h, gap, out);
  return out;
}

export function paddingPx(state: CollageState, W: number, H: number): number {
  return (Math.min(W, H) * state.padding) / 100;
}
export function gapPx(state: CollageState, W: number, H: number): number {
  return (Math.min(W, H) * state.gap) / 100;
}
export function borderPx(state: CollageState, W: number, H: number): number {
  return (Math.min(W, H) * state.borderWidth) / 100;
}

/** Cell rectangles in output pixels (template mode: computed; free mode: from state.free). */
export function computeCellRects(state: CollageState, W: number, H: number): Rect[] {
  if (state.mode === "free") {
    return state.free.map((f) => ({ x: (f.cx - f.w / 2) * W, y: (f.cy - f.h / 2) * H, w: f.w * W, h: f.h * H, rotate: f.rotate }));
  }
  const pad = paddingPx(state, W, H);
  const out: Rect[] = [];
  layoutTree(getTree(state), pad, pad, W - pad * 2, H - pad * 2, gapPx(state, W, H), out);
  return out;
}

/** Convert the current template layout to free-mode normalised rects. */
export function templateToFree(state: CollageState, W: number, H: number): FreeRect[] {
  return computeCellRects({ ...state, mode: "template" }, W, H).map((r) => ({
    cx: (r.x + r.w / 2) / W,
    cy: (r.y + r.h / 2) / H,
    w: r.w / W,
    h: r.h / H,
    rotate: 0,
  }));
}

/* ───────────────────────────── Defaults ───────────────────────────── */

export function defaultCell(photoId: string | null = null): CellState {
  return {
    photoId,
    zoom: 1,
    panX: 0,
    panY: 0,
    rot: 0,
    flipH: false,
    flipV: false,
    fit: "cover",
    brightness: 100,
    contrast: 100,
    saturate: 100,
    grayscale: false,
    sepia: false,
    blur: 0,
  };
}

export function defaultText(id: string, text = "Teks Baru"): TextLayer {
  return {
    id,
    text,
    cx: 0.5,
    cy: 0.5,
    size: 8,
    color: "#ffffff",
    font: "Alan Sans",
    bold: true,
    italic: false,
    align: "center",
    strokeColor: "#000000",
    strokeWidth: 0,
    shadow: true,
    rotate: 0,
    opacity: 1,
    bgColor: "#000000",
    bgOpacity: 0,
  };
}

export function createInitialState(): CollageState {
  const n = TEMPLATES.find((t) => t.id === "t4-g")!.count;
  return {
    mode: "template",
    templateId: "t4-g",
    autoCount: 6,
    autoCols: 0,
    canvasPreset: "sq",
    customW: 1080,
    customH: 1080,
    padding: 2,
    gap: 1.2,
    radius: 6,
    shape: "rect",
    borderWidth: 0,
    borderColor: "#ffffff",
    shadowOn: false,
    shadowBlur: 1.5,
    shadowOpacity: 0.35,
    bg: { type: "solid", color: "#ffffff", color2: "#c7d2fe", angle: 135, imageId: null, blur: 40 },
    cells: Array.from({ length: n }, () => defaultCell()),
    free: [],
    texts: [],
  };
}

/* ───────────────────────────── Shapes ─────────────────────────────── */

function shapePath(ctx: CanvasRenderingContext2D, shape: CellShape, x: number, y: number, w: number, h: number, radiusPct: number) {
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case "hexagon": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const pts = [
        [cx - w / 4, cy - h / 2],
        [cx + w / 4, cy - h / 2],
        [cx + w / 2, cy],
        [cx + w / 4, cy + h / 2],
        [cx - w / 4, cy + h / 2],
        [cx - w / 2, cy],
      ];
      pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
      ctx.closePath();
      break;
    }
    case "diamond": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.moveTo(cx, y);
      ctx.lineTo(x + w, cy);
      ctx.lineTo(cx, y + h);
      ctx.lineTo(x, cy);
      ctx.closePath();
      break;
    }
    case "heart": {
      const cx = x + w / 2;
      ctx.moveTo(cx, y + h * 0.95);
      ctx.bezierCurveTo(x - w * 0.12, y + h * 0.55, x + w * 0.02, y - h * 0.02, cx, y + h * 0.28);
      ctx.bezierCurveTo(x + w * 0.98, y - h * 0.02, x + w * 1.12, y + h * 0.55, cx, y + h * 0.95);
      ctx.closePath();
      break;
    }
    default: {
      const r = Math.max(0, Math.min((Math.min(w, h) * radiusPct) / 100, Math.min(w, h) / 2));
      if (r <= 0.5) {
        ctx.rect(x, y, w, h);
      } else {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      }
    }
  }
}

/* ───────────────────────────── Rendering ──────────────────────────── */

export function supportsCtxFilter(): boolean {
  try {
    const c = document.createElement("canvas").getContext("2d");
    return !!c && "filter" in c;
  } catch {
    return false;
  }
}

function filterString(cell: CellState, scale: number): string {
  const parts: string[] = [];
  if (cell.brightness !== 100) parts.push(`brightness(${cell.brightness}%)`);
  if (cell.contrast !== 100) parts.push(`contrast(${cell.contrast}%)`);
  if (cell.saturate !== 100) parts.push(`saturate(${cell.saturate}%)`);
  if (cell.grayscale) parts.push("grayscale(100%)");
  if (cell.sepia) parts.push("sepia(100%)");
  if (cell.blur > 0) parts.push(`blur(${(cell.blur * scale).toFixed(2)}px)`);
  return parts.length ? parts.join(" ") : "none";
}

function drawBackground(ctx: CanvasRenderingContext2D, state: CollageState, photos: Map<string, PhotoRef>, W: number, H: number) {
  const bg = state.bg;
  ctx.save();
  if (bg.type === "gradient") {
    const a = (bg.angle * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const half = (Math.abs(W * dx) + Math.abs(H * dy)) / 2;
    const g = ctx.createLinearGradient(W / 2 - dx * half, H / 2 - dy * half, W / 2 + dx * half, H / 2 + dy * half);
    g.addColorStop(0, bg.color);
    g.addColorStop(1, bg.color2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.type === "image" || bg.type === "photo-blur") {
    let src: PhotoRef | undefined;
    if (bg.type === "image") src = bg.imageId ? photos.get(bg.imageId) : undefined;
    else {
      const firstId = state.cells.find((c) => c.photoId)?.photoId;
      src = firstId ? photos.get(firstId) : undefined;
    }
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
    if (src) {
      const s = Math.max(W / src.w, H / src.h);
      const dw = src.w * s;
      const dh = src.h * s;
      if (bg.type === "photo-blur") {
        const scale = Math.min(W, H) / 1000;
        if (supportsCtxFilter()) ctx.filter = `blur(${(bg.blur * scale).toFixed(2)}px)`;
        // Slight over-scan hides the transparent blur fringe at the edges.
        const k = 1.15;
        ctx.drawImage(src.img, (W - dw * k) / 2, (H - dh * k) / 2, dw * k, dh * k);
        ctx.filter = "none";
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.drawImage(src.img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      }
    }
  } else {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function drawCellImage(ctx: CanvasRenderingContext2D, cell: CellState, photo: PhotoRef, w: number, h: number, scale: number) {
  // Work in a frame centred on the cell. Rotation/flip are applied to the image only.
  const swap = cell.rot === 90 || cell.rot === 270;
  const iw = swap ? photo.h : photo.w;
  const ih = swap ? photo.w : photo.h;
  const base = cell.fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const s = base * Math.max(1, cell.zoom);
  const sw = iw * s;
  const sh = ih * s;
  const rangeX = Math.max(0, (sw - w) / 2);
  const rangeY = Math.max(0, (sh - h) / 2);
  const ox = -cell.panX * rangeX;
  const oy = -cell.panY * rangeY;

  ctx.save();
  const f = filterString(cell, scale);
  if (f !== "none") ctx.filter = f;
  ctx.translate(w / 2 + ox, h / 2 + oy);
  // Rotation and flip live in image space (before the overall scale).
  ctx.scale(cell.flipH ? -1 : 1, cell.flipV ? -1 : 1);
  ctx.rotate((cell.rot * Math.PI) / 180);
  ctx.scale(s, s);
  ctx.drawImage(photo.img, -photo.w / 2, -photo.h / 2, photo.w, photo.h);
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, t: TextLayer, W: number, H: number) {
  if (!t.text) return;
  const fs = (t.size / 100) * W;
  const lines = t.text.split("\n");
  const lh = fs * 1.2;
  ctx.save();
  ctx.translate(t.cx * W, t.cy * H);
  ctx.rotate((t.rotate * Math.PI) / 180);
  ctx.globalAlpha = Math.max(0, Math.min(1, t.opacity));
  ctx.font = `${t.italic ? "italic " : ""}${t.bold ? "bold " : ""}${fs}px ${fontStack(t.font)}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = t.align;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  const totalH = lh * lines.length;
  const anchorX = t.align === "left" ? -widest / 2 : t.align === "right" ? widest / 2 : 0;

  if (t.bgOpacity > 0) {
    const padX = fs * 0.4;
    const padY = fs * 0.25;
    ctx.save();
    ctx.globalAlpha *= t.bgOpacity;
    ctx.fillStyle = t.bgColor;
    const rx = -widest / 2 - padX;
    const ry = -totalH / 2 - padY;
    const rw = widest + padX * 2;
    const rh = totalH + padY * 2;
    const r = Math.min(fs * 0.25, rh / 2);
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
    ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
    ctx.arcTo(rx, ry + rh, rx, ry, r);
    ctx.arcTo(rx, ry, rx + rw, ry, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (t.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = fs * 0.12;
    ctx.shadowOffsetY = fs * 0.04;
  }
  lines.forEach((line, i) => {
    const y = -totalH / 2 + lh * (i + 0.5);
    if (t.strokeWidth > 0) {
      ctx.lineJoin = "round";
      ctx.lineWidth = (t.strokeWidth / 100) * fs * 2;
      ctx.strokeStyle = t.strokeColor;
      ctx.strokeText(line, anchorX, y);
    }
    ctx.fillStyle = t.color;
    ctx.fillText(line, anchorX, y);
  });
  ctx.restore();
}

/**
 * Renders the whole collage onto `ctx` assuming its canvas is `W × H` px.
 * `fontsReady` isn't awaited here — callers wait for document.fonts first.
 */
export function renderCollage(ctx: CanvasRenderingContext2D, state: CollageState, photos: Map<string, PhotoRef>, W: number, H: number) {
  const scale = Math.min(W, H) / 1000;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawBackground(ctx, state, photos, W, H);

  const rects = computeCellRects(state, W, H);
  const bw = borderPx(state, W, H);
  const shadowBlur = (Math.min(W, H) * state.shadowBlur) / 100;

  rects.forEach((r, i) => {
    const cell = state.cells[i];
    if (!cell) return;
    const photo = cell.photoId ? photos.get(cell.photoId) : undefined;
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    if (r.rotate) ctx.rotate((r.rotate * Math.PI) / 180);
    ctx.translate(-r.w / 2, -r.h / 2);

    // Soft drop shadow drawn from the cell silhouette.
    if (state.shadowOn) {
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${state.shadowOpacity})`;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetY = shadowBlur * 0.35;
      ctx.fillStyle = "#ffffff";
      shapePath(ctx, state.shape, 0, 0, r.w, r.h, state.radius);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    shapePath(ctx, state.shape, 0, 0, r.w, r.h, state.radius);
    ctx.clip();
    if (photo) {
      drawCellImage(ctx, cell, photo, r.w, r.h, scale);
    } else {
      // Empty slot placeholder (also visible in export so the user notices).
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, 0, r.w, r.h);
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.setLineDash([10 * scale, 8 * scale]);
      ctx.strokeRect(r.w * 0.1, r.h * 0.1, r.w * 0.8, r.h * 0.8);
      ctx.setLineDash([]);
      const s = Math.min(r.w, r.h) * 0.18;
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = Math.max(2, 4 * scale);
      ctx.beginPath();
      ctx.moveTo(r.w / 2 - s / 2, r.h / 2);
      ctx.lineTo(r.w / 2 + s / 2, r.h / 2);
      ctx.moveTo(r.w / 2, r.h / 2 - s / 2);
      ctx.lineTo(r.w / 2, r.h / 2 + s / 2);
      ctx.stroke();
    }
    ctx.restore();

    if (bw > 0) {
      ctx.save();
      ctx.strokeStyle = state.borderColor;
      ctx.lineWidth = bw;
      const inset = bw / 2;
      shapePath(ctx, state.shape, inset, inset, Math.max(1, r.w - bw), Math.max(1, r.h - bw), state.radius);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  });

  for (const t of state.texts) drawText(ctx, t, W, H);
  ctx.restore();
}

/** Waits for the web fonts used by the collage's text layers to be ready. */
export async function ensureCollageFonts(state: CollageState): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const fams = Array.from(new Set(state.texts.map((t) => t.font)));
  await Promise.all(
    fams.flatMap((f) => [
      document.fonts.load(`16px ${fontStack(f)}`).catch(() => []),
      document.fonts.load(`bold 16px ${fontStack(f)}`).catch(() => []),
    ])
  );
}

/* ───────────────────────────── Hit testing ────────────────────────── */

/** Converts a point (in canvas px) into a cell's local coordinates (0..w, 0..h). */
export function toLocal(r: Rect, px: number, py: number): { x: number; y: number } {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const a = (-r.rotate * Math.PI) / 180;
  const dx = px - cx;
  const dy = py - cy;
  return { x: dx * Math.cos(a) - dy * Math.sin(a) + r.w / 2, y: dx * Math.sin(a) + dy * Math.cos(a) + r.h / 2 };
}

/** Topmost cell index under the point, or -1. */
export function hitCell(rects: Rect[], px: number, py: number): number {
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    const p = toLocal(r, px, py);
    if (p.x >= 0 && p.y >= 0 && p.x <= r.w && p.y <= r.h) return i;
  }
  return -1;
}

/** Approximate bounding box (px, un-rotated local space) of a text layer. */
export function measureText(ctx: CanvasRenderingContext2D, t: TextLayer, W: number): { w: number; h: number } {
  const fs = (t.size / 100) * W;
  ctx.save();
  ctx.font = `${t.italic ? "italic " : ""}${t.bold ? "bold " : ""}${fs}px ${fontStack(t.font)}`;
  const lines = t.text.split("\n");
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width), fs);
  ctx.restore();
  return { w, h: fs * 1.2 * lines.length };
}

export function hitText(ctx: CanvasRenderingContext2D, texts: TextLayer[], px: number, py: number, W: number, H: number): number {
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    const m = measureText(ctx, t, W);
    const r: Rect = { x: t.cx * W - m.w / 2, y: t.cy * H - m.h / 2, w: m.w, h: m.h, rotate: t.rotate };
    const p = toLocal(r, px, py);
    const pad = m.h * 0.2;
    if (p.x >= -pad && p.y >= -pad && p.x <= m.w + pad && p.y <= m.h + pad) return i;
  }
  return -1;
}
