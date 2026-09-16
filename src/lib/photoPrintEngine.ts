import { loadImageCached } from "@/lib/businessCardEngine";

// Engine for "Cetak Foto" (Menu Gambar): arranges one or more uploaded
// photos — each repeated by a requested copy count — into a print-shop-
// style grid on a chosen paper size (A4, F4, 4R, etc), automatically
// paginating across as many sheets as needed. Everything is computed in
// millimeters first (so real-world physical dimensions are exact for
// printing) and only converted to pixels at render time via a fixed DPI.

export const PRINT_DPI = 300; // standard print-quality resolution

export function mmToPx(mm: number, dpi: number = PRINT_DPI): number {
  return Math.round((mm / 25.4) * dpi);
}

export function mmToPt(mm: number): number {
  return mm * 2.834645669291339; // 1mm = 2.8346... pt (72pt / 25.4mm)
}

export type FocusX = "left" | "center" | "right";
export type FocusY = "top" | "center" | "bottom";

const FOCUS_X_VALUE: Record<FocusX, number> = { left: 0, center: 0.5, right: 1 };
const FOCUS_Y_VALUE: Record<FocusY, number> = { top: 0, center: 0.5, bottom: 1 };

export interface PrintPhotoItem {
  id: string;
  objectUrl: string;
  fileName: string;
  copies: number;
  focusX: FocusX;
  focusY: FocusY;
}

export interface PrintLayoutSettings {
  paperWMm: number;
  paperHMm: number;
  photoWMm: number;
  photoHMm: number;
  orientation: "auto" | "portrait" | "landscape";
  marginMm: number;
  gutterMm: number;
  showCutGuides: boolean;
  fitMode: "cover" | "contain";
}

export interface GridResult {
  cols: number;
  rows: number;
  perSheet: number;
  paperUsedWMm: number;
  paperUsedHMm: number;
  paperRotated: boolean;
}

function fitCount(paperW: number, paperH: number, cellW: number, cellH: number, margin: number, gutter: number) {
  const usableW = paperW - margin * 2;
  const usableH = paperH - margin * 2;
  if (usableW < cellW || usableH < cellH || cellW <= 0 || cellH <= 0) return { cols: 0, rows: 0, count: 0 };
  const cols = Math.max(0, Math.floor((usableW + gutter) / (cellW + gutter)));
  const rows = Math.max(0, Math.floor((usableH + gutter) / (cellH + gutter)));
  return { cols, rows, count: cols * rows };
}

/**
 * Decides how many photo cells fit on the sheet. The PAPER may be treated
 * portrait or landscape (whichever orientation of the same physical paper
 * yields more copies, when orientation is "auto") — but individual photos
 * are NEVER rotated on their own, since that would turn faces sideways on
 * ID/pas-foto prints. This mirrors how real print shops actually work:
 * they pick a sheet orientation, not a per-photo rotation.
 */
export function computeGrid(settings: PrintLayoutSettings): GridResult {
  const { paperWMm: pw, paperHMm: ph, photoWMm: cw, photoHMm: ch, marginMm: m, gutterMm: g, orientation } = settings;
  const asIs = fitCount(pw, ph, cw, ch, m, g);
  const swapped = fitCount(ph, pw, cw, ch, m, g);
  let useSwapped: boolean;
  if (orientation === "portrait") useSwapped = pw > ph;
  else if (orientation === "landscape") useSwapped = pw < ph;
  else useSwapped = swapped.count > asIs.count;
  const chosen = useSwapped ? swapped : asIs;
  return {
    cols: chosen.cols,
    rows: chosen.rows,
    perSheet: chosen.count,
    paperUsedWMm: useSwapped ? ph : pw,
    paperUsedHMm: useSwapped ? pw : ph,
    paperRotated: useSwapped,
  };
}

/** Expands every uploaded photo by its requested copy count into one flat, ordered queue — this is what actually gets paginated across sheets. */
export function buildQueue(items: PrintPhotoItem[]): PrintPhotoItem[] {
  const queue: PrintPhotoItem[] = [];
  for (const item of items) {
    const n = Math.max(0, Math.floor(item.copies) || 0);
    for (let i = 0; i < n; i++) queue.push(item);
  }
  return queue;
}

export function paginateQueue<T>(queue: T[], perSheet: number): T[][] {
  if (perSheet <= 0) return [];
  const sheets: T[][] = [];
  for (let i = 0; i < queue.length; i += perSheet) sheets.push(queue.slice(i, i + perSheet));
  return sheets;
}

/** Cover-fit (crop to fill) with an adjustable focal point, so a headshot that isn't perfectly centered in the source photo can still be biased toward the top/left/etc instead of always cropping dead-center. */
function drawImageCoverFocused(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusX: number, focusY: number) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x - (dw - w) * focusX;
  const dy = y - (dh - h) * focusY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** Contain-fit (letterbox, centered) — used when the photo shouldn't be cropped at all. */
function drawImageContainCentered(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Renders one sheet (one page's worth of photo cells) onto `canvas` at the given DPI. `sheetItems` should have exactly `grid.cols * grid.rows` entries (use `null` for a blank leftover cell on the final, partially-filled sheet). */
export async function renderSheet(
  canvas: HTMLCanvasElement,
  sheetItems: (PrintPhotoItem | null)[],
  grid: GridResult,
  settings: PrintLayoutSettings,
  imageCache: Map<string, HTMLImageElement>,
  dpi: number = PRINT_DPI
): Promise<void> {
  const pxW = mmToPx(grid.paperUsedWMm, dpi);
  const pxH = mmToPx(grid.paperUsedHMm, dpi);
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pxW, pxH);

  if (grid.cols <= 0 || grid.rows <= 0) return;

  const cellWpx = mmToPx(settings.photoWMm, dpi);
  const cellHpx = mmToPx(settings.photoHMm, dpi);
  const gutterPx = mmToPx(settings.gutterMm, dpi);
  const totalWpx = grid.cols * cellWpx + Math.max(0, grid.cols - 1) * gutterPx;
  const totalHpx = grid.rows * cellHpx + Math.max(0, grid.rows - 1) * gutterPx;
  const startX = (pxW - totalWpx) / 2;
  const startY = (pxH - totalHpx) / 2;

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const idx = r * grid.cols + c;
      const item = sheetItems[idx] ?? null;
      const x = startX + c * (cellWpx + gutterPx);
      const y = startY + r * (cellHpx + gutterPx);

      if (item) {
        const img = await loadImageCached(item.objectUrl, imageCache);
        if (img) {
          if (settings.fitMode === "cover") {
            drawImageCoverFocused(ctx, img, x, y, cellWpx, cellHpx, FOCUS_X_VALUE[item.focusX], FOCUS_Y_VALUE[item.focusY]);
          } else {
            drawImageContainCentered(ctx, img, x, y, cellWpx, cellHpx);
          }
        }
      }

      if (settings.showCutGuides) {
        ctx.save();
        ctx.setLineDash([mmToPx(1.2, dpi), mmToPx(1.2, dpi)]);
        ctx.strokeStyle = "rgba(110,110,110,0.9)";
        ctx.lineWidth = Math.max(1, mmToPx(0.12, dpi));
        ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, cellWpx - 1), Math.max(0, cellHpx - 1));
        ctx.restore();
      }
    }
  }
}

/** Renders every sheet needed to fit all requested copies, in order — used for PDF export and direct printing (where every page must exist as a real canvas up front, unlike the on-screen preview which only renders the page currently being viewed). */
export async function renderAllSheets(
  items: PrintPhotoItem[],
  grid: GridResult,
  settings: PrintLayoutSettings,
  imageCache: Map<string, HTMLImageElement>,
  dpi: number = PRINT_DPI
): Promise<HTMLCanvasElement[]> {
  const queue = buildQueue(items);
  const sheets = paginateQueue(queue, grid.perSheet);
  const canvases: HTMLCanvasElement[] = [];
  for (const sheetItems of sheets) {
    const canvas = document.createElement("canvas");
    await renderSheet(canvas, sheetItems, grid, settings, imageCache, dpi);
    canvases.push(canvas);
  }
  return canvases;
}
