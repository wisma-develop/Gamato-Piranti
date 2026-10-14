// Print engine — mirrors the options of the browser's own print dialog
// (paper, orientation, pages per sheet, margins, scale, range, copies, colour…)
// plus a few extras (booklet, header/footer templates, watermark, mirror).
//
// planPrint() is pure (unit-testable in Node); renderSheet() draws one physical
// sheet onto a canvas at any resolution, so the on-screen preview and the final
// print/PDF output are produced by exactly the same code.

/* ───────────────────────────── paper ───────────────────────────── */

export interface Paper { id: string; label: string; w: number; h: number } // mm, portrait

export const PAPERS: Paper[] = [
  { id: "a4", label: "A4 (210 × 297 mm)", w: 210, h: 297 },
  { id: "a3", label: "A3 (297 × 420 mm)", w: 297, h: 420 },
  { id: "a5", label: "A5 (148 × 210 mm)", w: 148, h: 210 },
  { id: "a6", label: "A6 (105 × 148 mm)", w: 105, h: 148 },
  { id: "b4", label: "B4 (250 × 353 mm)", w: 250, h: 353 },
  { id: "b5", label: "B5 (176 × 250 mm)", w: 176, h: 250 },
  { id: "letter", label: "Letter (8,5 × 11 in)", w: 215.9, h: 279.4 },
  { id: "legal", label: "Legal (8,5 × 14 in)", w: 215.9, h: 355.6 },
  { id: "f4", label: "F4 / Folio (215 × 330 mm)", w: 215, h: 330 },
  { id: "executive", label: "Executive (7,25 × 10,5 in)", w: 184.15, h: 266.7 },
  { id: "tabloid", label: "Tabloid (11 × 17 in)", w: 279.4, h: 431.8 },
  { id: "p4r", label: "Foto 4R (4 × 6 in)", w: 101.6, h: 152.4 },
  { id: "p5r", label: "Foto 5R (5 × 7 in)", w: 127, h: 177.8 },
  { id: "custom", label: "Kustom (mm)", w: 210, h: 297 },
];

/* ───────────────────────────── settings ───────────────────────────── */

export type ColorMode = "color" | "gray" | "bw";
export type MarginMode = "default" | "none" | "min" | "custom";
export type ScaleMode = "fit" | "shrink" | "actual" | "custom";
export type RangeMode = "all" | "odd" | "even" | "custom";

export interface PrintSettings {
  paper: string;
  customW: number;
  customH: number;
  orientation: "auto" | "portrait" | "landscape";
  pagesPerSheet: 1 | 2 | 4 | 6 | 9 | 16;
  fillOrder: "rows" | "cols";
  booklet: boolean;
  marginMode: MarginMode;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  gutter: number;
  cellGap: number;
  scaleMode: ScaleMode;
  scalePct: number;
  align: "center" | "top";
  autoRotate: boolean;
  rangeMode: RangeMode;
  rangeText: string;
  copies: number;
  collate: boolean;
  reverse: boolean;
  color: ColorMode;
  bwThreshold: number;
  brightness: number; // -100 … 100
  contrast: number; // -100 … 100
  pageBorder: boolean;
  mirror: boolean;
  headerOn: boolean;
  footerOn: boolean;
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  watermark: string;
  watermarkOpacity: number; // 0..1
  watermarkSize: number; // % of sheet short side
  watermarkAngle: number;
  watermarkColor: string;
  dpi: 150 | 200 | 300;
}

export const DEFAULT_SETTINGS: PrintSettings = {
  paper: "a4", customW: 210, customH: 297, orientation: "auto", pagesPerSheet: 1, fillOrder: "rows", booklet: false,
  marginMode: "default", marginTop: 10, marginRight: 10, marginBottom: 10, marginLeft: 10, gutter: 0, cellGap: 4,
  scaleMode: "fit", scalePct: 100, align: "center", autoRotate: false,
  rangeMode: "all", rangeText: "", copies: 1, collate: true, reverse: false,
  color: "color", bwThreshold: 160, brightness: 0, contrast: 0, pageBorder: false, mirror: false,
  headerOn: false, footerOn: false, headerLeft: "{title}", headerCenter: "", headerRight: "{date}", footerLeft: "", footerCenter: "{page} / {pages}", footerRight: "",
  watermark: "", watermarkOpacity: 0.15, watermarkSize: 14, watermarkAngle: -35, watermarkColor: "#ef4444",
  dpi: 200,
};

/* ───────────────────────────── types ───────────────────────────── */

export interface PrintPageRef { id: string; wMm: number; hMm: number; label: string }

export interface SheetCell {
  page: number | null; // index into `selected`; null = blank cell (booklet padding / unused slot)
  x: number; y: number; w: number; h: number; // mm, sheet coordinates
}

export interface Sheet { cells: SheetCell[] }

export interface PrintPlan {
  paperW: number; // mm, after orientation
  paperH: number;
  landscape: boolean;
  margins: { top: number; right: number; bottom: number; left: number };
  selected: number[]; // indexes into the page list, in print order
  sheets: Sheet[]; // unique sheets
  sequence: number[]; // physical order → index in `sheets` (includes copies)
}

/* ───────────────────────────── planning ───────────────────────────── */

export function parseRange(text: string, total: number): number[] {
  const out: number[] = [];
  for (const part of text.split(/[,;]/).map((p) => p.trim()).filter(Boolean)) {
    const m = part.match(/^(\d*)\s*-\s*(\d*)$/);
    if (m && (m[1] || m[2])) {
      const a = m[1] ? parseInt(m[1], 10) : 1;
      const b = m[2] ? parseInt(m[2], 10) : total;
      const lo = Math.max(1, Math.min(a, b));
      const hi = Math.min(total, Math.max(a, b));
      for (let p = lo; p <= hi; p++) out.push(p - 1);
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= total) out.push(n - 1);
    }
  }
  return out;
}

export function selectPages(total: number, s: Pick<PrintSettings, "rangeMode" | "rangeText" | "reverse">): number[] {
  let idx: number[];
  if (s.rangeMode === "odd") idx = Array.from({ length: total }, (_, i) => i).filter((i) => i % 2 === 0);
  else if (s.rangeMode === "even") idx = Array.from({ length: total }, (_, i) => i).filter((i) => i % 2 === 1);
  else if (s.rangeMode === "custom") idx = parseRange(s.rangeText, total);
  else idx = Array.from({ length: total }, (_, i) => i);
  return s.reverse ? [...idx].reverse() : idx;
}

export function paperSize(s: Pick<PrintSettings, "paper" | "customW" | "customH">): { w: number; h: number } {
  if (s.paper === "custom") return { w: Math.max(20, s.customW), h: Math.max(20, s.customH) };
  const p = PAPERS.find((x) => x.id === s.paper) ?? PAPERS[0];
  return { w: p.w, h: p.h };
}

export function resolveMargins(s: PrintSettings): { top: number; right: number; bottom: number; left: number } {
  let m: { top: number; right: number; bottom: number; left: number };
  if (s.marginMode === "none") m = { top: 0, right: 0, bottom: 0, left: 0 };
  else if (s.marginMode === "min") m = { top: 4, right: 4, bottom: 4, left: 4 };
  else if (s.marginMode === "custom") m = { top: s.marginTop, right: s.marginRight, bottom: s.marginBottom, left: s.marginLeft };
  else m = { top: 10, right: 10, bottom: 10, left: 10 };
  return { ...m, left: m.left + (s.gutter || 0) };
}

/** Picks the cols×rows split of N cells that gives the biggest pages on this sheet. */
export function bestGrid(n: number, boxW: number, boxH: number, pageAspect: number): { cols: number; rows: number } {
  let best = { cols: n, rows: 1 };
  let bestK = -1;
  for (let cols = 1; cols <= n; cols++) {
    if (n % cols !== 0) continue;
    const rows = n / cols;
    const cw = boxW / cols;
    const ch = boxH / rows;
    const k = Math.min(cw, ch * pageAspect); // width of the page that fits
    if (k > bestK + 1e-9) { bestK = k; best = { cols, rows }; }
  }
  return best;
}

export function planPrint(pages: PrintPageRef[], s: PrintSettings): PrintPlan {
  const selected = selectPages(pages.length, s);
  const paper = paperSize(s);

  // orientation
  let landscape: boolean;
  if (s.booklet) landscape = true;
  else if (s.orientation === "landscape") landscape = true;
  else if (s.orientation === "portrait") landscape = false;
  else {
    let l = 0;
    let p = 0;
    for (const i of selected) (pages[i].wMm > pages[i].hMm ? l++ : p++);
    landscape = l > p;
  }
  const paperW = landscape ? Math.max(paper.w, paper.h) : Math.min(paper.w, paper.h);
  const paperH = landscape ? Math.min(paper.w, paper.h) : Math.max(paper.w, paper.h);
  const margins = resolveMargins(s);
  const boxX = margins.left;
  const boxY = margins.top;
  const boxW = Math.max(10, paperW - margins.left - margins.right);
  const boxH = Math.max(10, paperH - margins.top - margins.bottom);
  const gap = s.cellGap;

  const sheets: Sheet[] = [];
  const n = selected.length;

  const gridCells = (cols: number, rows: number, order: (number | null)[], fill: "rows" | "cols"): SheetCell[] => {
    const cw = (boxW - gap * (cols - 1)) / cols;
    const ch = (boxH - gap * (rows - 1)) / rows;
    const cells: SheetCell[] = [];
    for (let k = 0; k < cols * rows; k++) {
      const r = fill === "rows" ? Math.floor(k / cols) : k % rows;
      const c = fill === "rows" ? k % cols : Math.floor(k / rows);
      cells.push({ page: order[k] ?? null, x: boxX + c * (cw + gap), y: boxY + r * (ch + gap), w: cw, h: ch });
    }
    return cells;
  };

  if (s.booklet && n > 0) {
    const total = Math.ceil(n / 4) * 4;
    const seq: (number | null)[] = Array.from({ length: total }, (_, i) => (i < n ? i : null));
    for (let k = 0; k < total / 4; k++) {
      // saddle-stitch imposition: front = [last-2k, first+2k], back = [first+2k+1, last-2k-1]
      const front: (number | null)[] = [seq[total - 1 - 2 * k], seq[2 * k]];
      const back: (number | null)[] = [seq[2 * k + 1], seq[total - 2 - 2 * k]];
      sheets.push({ cells: gridCells(2, 1, front, "rows") });
      sheets.push({ cells: gridCells(2, 1, back, "rows") });
    }
  } else if (n > 0) {
    const N = s.pagesPerSheet;
    const aspect = pages[selected[0]].wMm / pages[selected[0]].hMm;
    const { cols, rows } = N === 1 ? { cols: 1, rows: 1 } : bestGrid(N, boxW, boxH, aspect);
    for (let i = 0; i < n; i += N) {
      const order = Array.from({ length: N }, (_, k) => (i + k < n ? i + k : null));
      sheets.push({ cells: gridCells(cols, rows, order, s.fillOrder) });
    }
  }

  // copies / collation
  const copies = Math.max(1, Math.min(999, Math.round(s.copies)));
  const sequence: number[] = [];
  if (s.collate || sheets.length === 1) {
    for (let c = 0; c < copies; c++) for (let i = 0; i < sheets.length; i++) sequence.push(i);
  } else {
    for (let i = 0; i < sheets.length; i++) for (let c = 0; c < copies; c++) sequence.push(i);
  }
  return { paperW, paperH, landscape, margins, selected, sheets, sequence };
}

/* ───────────────────────────── rendering ───────────────────────────── */

export interface PrintPageSource {
  ref: PrintPageRef;
  /** Renders the page (unrotated) at the given pixel width. */
  render(widthPx: number): Promise<CanvasImageSource>;
}

export interface RenderContext {
  title: string;
  fileLabel: string;
  uniqueSheets: number;
  guides?: boolean; // dashed margin guides (preview only)
}

function expandTemplate(t: string, ctx: RenderContext, sheetNo: number): string {
  const d = new Date();
  return t
    .replace(/\{title\}/gi, ctx.title)
    .replace(/\{file\}/gi, ctx.fileLabel)
    .replace(/\{date\}/gi, d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }))
    .replace(/\{time\}/gi, d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }))
    .replace(/\{(page|sheet)\}/gi, String(sheetNo))
    .replace(/\{(pages|sheets)\}/gi, String(ctx.uniqueSheets));
}

export function applyColorMode(c: HTMLCanvasElement, s: Pick<PrintSettings, "color" | "bwThreshold" | "brightness" | "contrast">) {
  if (s.color === "color" && s.brightness === 0 && s.contrast === 0) return;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const cf = (259 * (s.contrast + 255)) / (255 * (259 - s.contrast));
  const bright = (s.brightness / 100) * 255;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    if (s.brightness !== 0 || s.contrast !== 0) {
      r = cf * (r + bright - 128) + 128;
      g = cf * (g + bright - 128) + 128;
      b = cf * (b + bright - 128) + 128;
    }
    if (s.color !== "color") {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      if (s.color === "bw") { const v = l >= s.bwThreshold ? 255 : 0; r = g = b = v; }
      else r = g = b = l;
    }
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(img, 0, 0);
}

/** Pixel size of one sheet for a resolution (dpi) or a target pixel width. */
export function sheetPixels(plan: Pick<PrintPlan, "paperW" | "paperH">, opts: { dpi?: number; widthPx?: number }): { w: number; h: number; ppm: number } {
  const ppm = opts.widthPx ? opts.widthPx / plan.paperW : (opts.dpi ?? 150) / 25.4;
  return { w: Math.round(plan.paperW * ppm), h: Math.round(plan.paperH * ppm), ppm };
}

export async function renderSheet(
  plan: PrintPlan,
  sheetIndex: number,
  sources: PrintPageSource[],
  s: PrintSettings,
  ctxInfo: RenderContext,
  opts: { dpi?: number; widthPx?: number }
): Promise<HTMLCanvasElement> {
  const { w: W, h: H, ppm } = sheetPixels(plan, opts);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = "high";
  const sheet = plan.sheets[sheetIndex];

  for (const cell of sheet.cells) {
    if (cell.page == null) continue;
    const src = sources[plan.selected[cell.page]];
    const { wMm: pw0, hMm: ph0 } = src.ref;
    const cx = cell.x * ppm;
    const cy = cell.y * ppm;
    const cw = cell.w * ppm;
    const ch = cell.h * ppm;

    // choose rotation (auto-rotate when it makes the page fit noticeably better)
    const fitK = (w: number, h: number) => Math.min(cell.w / w, cell.h / h);
    const rotate = s.autoRotate && s.scaleMode !== "actual" && s.scaleMode !== "custom" && fitK(ph0, pw0) > fitK(pw0, ph0) * 1.05;
    const pw = rotate ? ph0 : pw0; // displayed size in mm @100%
    const ph = rotate ? pw0 : ph0;
    let k: number;
    if (s.scaleMode === "actual") k = 1;
    else if (s.scaleMode === "custom") k = Math.max(0.05, s.scalePct / 100);
    else if (s.scaleMode === "shrink") k = Math.min(1, fitK(pw, ph));
    else k = fitK(pw, ph);
    const dw = pw * k * ppm;
    const dh = ph * k * ppm;
    const dx = cx + (cw - dw) / 2;
    const dy = s.align === "top" ? cy : cy + (ch - dh) / 2;

    // un-rotated raster size
    const rasterW = Math.max(8, Math.round(rotate ? dh : dw));
    const img = await src.render(rasterW);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cw, ch);
    ctx.clip();
    if (rotate) {
      ctx.translate(dx + dw / 2, dy + dh / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(img, -dh / 2, -dw / 2, dh, dw);
    } else {
      ctx.drawImage(img, dx, dy, dw, dh);
    }
    ctx.restore();
    if (s.pageBorder) {
      ctx.save();
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = Math.max(1, 0.2 * ppm);
      ctx.strokeRect(Math.max(cx, dx), Math.max(cy, dy), Math.min(cw, dw), Math.min(ch, dh));
      ctx.restore();
    }
  }

  const sheetNo = sheetIndex + 1;
  const fontPx = (pt: number) => (pt * 25.4 * ppm) / 72;
  const drawBand = (y: number, left: string, center: string, right: string, baseline: CanvasTextBaseline) => {
    ctx.save();
    ctx.fillStyle = "#334155";
    ctx.font = `${fontPx(8.5)}px Helvetica, Arial, sans-serif`;
    ctx.textBaseline = baseline;
    const padX = Math.max(plan.margins.left, 6) * ppm;
    const padR = Math.max(plan.margins.right, 6) * ppm;
    ctx.textAlign = "left";
    if (left) ctx.fillText(expandTemplate(left, ctxInfo, sheetNo), padX, y);
    ctx.textAlign = "center";
    if (center) ctx.fillText(expandTemplate(center, ctxInfo, sheetNo), W / 2, y);
    ctx.textAlign = "right";
    if (right) ctx.fillText(expandTemplate(right, ctxInfo, sheetNo), W - padR, y);
    ctx.restore();
  };
  if (s.headerOn) drawBand(Math.max(plan.margins.top, 8) * ppm * 0.5 + fontPx(3), s.headerLeft, s.headerCenter, s.headerRight, "middle");
  if (s.footerOn) drawBand(H - Math.max(plan.margins.bottom, 8) * ppm * 0.5 - fontPx(3), s.footerLeft, s.footerCenter, s.footerRight, "middle");

  if (s.watermark.trim()) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, s.watermarkOpacity));
    ctx.fillStyle = s.watermarkColor;
    ctx.translate(W / 2, H / 2);
    ctx.rotate((s.watermarkAngle * Math.PI) / 180);
    ctx.font = `bold ${(Math.min(W, H) * s.watermarkSize) / 100}px Helvetica, Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.watermark, 0, 0);
    ctx.restore();
  }

  applyColorMode(canvas, s);

  if (s.mirror) {
    const m = document.createElement("canvas");
    m.width = W;
    m.height = H;
    const mc = m.getContext("2d")!;
    mc.translate(W, 0);
    mc.scale(-1, 1);
    mc.drawImage(canvas, 0, 0);
    return m;
  }

  if (ctxInfo.guides) {
    ctx.save();
    ctx.strokeStyle = "rgba(99,102,241,0.55)";
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1;
    ctx.strokeRect(plan.margins.left * ppm, plan.margins.top * ppm, W - (plan.margins.left + plan.margins.right) * ppm, H - (plan.margins.top + plan.margins.bottom) * ppm);
    ctx.restore();
  }
  return canvas;
}

/* ───────────────────────────── output ───────────────────────────── */

export function canvasToBlob(c: HTMLCanvasElement, type: string, q?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat gambar lembar."))), type, q));
}

export function buildPrintHtml(urls: string[], paperW: number, paperH: number, title: string): string {
  const esc = title.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const w = paperW.toFixed(3);
  const h = paperH.toFixed(3);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc}</title><style>
@page{size:${w}mm ${h}mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
.s{width:${w}mm;height:${h}mm;overflow:hidden;page-break-after:always;break-after:page;position:relative}
.s:last-child{page-break-after:auto;break-after:auto}
.s img{position:absolute;left:0;top:0;width:100%;height:100%;display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact}
</style></head><body>${urls.map((u) => `<div class="s"><img src="${u}" alt=""></div>`).join("")}</body></html>`;
}
