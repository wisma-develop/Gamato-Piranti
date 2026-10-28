// Shared signature-image helpers used by the Invoice, Kwitansi, Struk, and
// Sertifikat/Certificate generators (Menu Spesial). A signature captured
// through <SignaturePad> can come from two sources — freehand drawing on a
// <canvas>, or an uploaded photo/scan — and both end up normalized into the
// same shape here: a transparent-background PNG data URL, ready to be drawn
// straight onto any of the business-document canvases via drawImageContain().

/** Scans the canvas' alpha channel and returns the tightest box containing any non-transparent pixel, or null if the canvas is entirely empty. */
export function findInkBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx || !canvas.width || !canvas.height) return null;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return null; // e.g. tainted canvas — fail safe rather than throwing mid-draw
  }
  const { width, height } = canvas;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  const ALPHA_THRESHOLD = 10;
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Returns a new canvas cropped to the drawn ink's bounding box (plus a little padding), or null if the source canvas has no visible ink yet. */
export function trimSignatureCanvas(source: HTMLCanvasElement, padding = 12): HTMLCanvasElement | null {
  const bounds = findInkBounds(source);
  if (!bounds) return null;
  const x = Math.max(0, bounds.x - padding);
  const y = Math.max(0, bounds.y - padding);
  const w = Math.min(source.width - x, bounds.w + padding * 2);
  const h = Math.min(source.height - y, bounds.h + padding * 2);
  if (w <= 0 || h <= 0) return null;
  const out = document.createElement("canvas");
  out.width = Math.round(w);
  out.height = Math.round(h);
  const ctx = out.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, x, y, w, h, 0, 0, out.width, out.height);
  return out;
}

/**
 * Turns an uploaded signature photo into a transparent PNG. Near-white paper
 * becomes transparent with a SOFT alpha ramp (not a hard cut-off), so the
 * anti-aliased edge of every stroke stays smooth instead of turning jagged.
 * The result is trimmed to the ink's bounding box and capped to a sane size.
 *
 * `threshold` is the brightness at/above which a pixel is fully transparent;
 * pixels between (threshold - 70) and threshold fade out gradually.
 */
export async function makeUploadedSignatureTransparent(dataUrl: string, threshold = 235): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const iw = img.naturalWidth || img.width || 1;
        const ih = img.naturalHeight || img.height || 1;
        const cap = Math.min(1, 2400 / Math.max(iw, ih));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(iw * cap));
        canvas.height = Math.max(1, Math.round(ih * cap));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imageData;
        const low = Math.max(0, threshold - 70);
        for (let i = 0; i < data.length; i += 4) {
          // Perceived brightness; the darker the pixel, the more opaque the ink.
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (lum >= threshold) {
            data[i + 3] = 0;
          } else if (lum > low) {
            const a = (threshold - lum) / (threshold - low);
            data[i + 3] = Math.round(data[i + 3] * a);
          }
        }
        ctx.putImageData(imageData, 0, 0);
        const trimmed = trimSignatureCanvas(canvas, 8);
        resolve((trimmed ?? canvas).toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Gagal memuat gambar tanda tangan."));
    img.src = dataUrl;
  });
}

// ─── Freehand drawing model (used by <SignaturePad>) ─────────────────────────
//
// A signature is stored as a list of strokes (arrays of points) instead of
// being painted incrementally onto a bitmap. Every change re-renders ALL
// strokes from scratch with exactly ONE stroke() call per stroke, which means:
//   - no re-stroking of the same path (the old code called stroke() on the
//     whole accumulated path on every pointer-move → edges got darker/bolder),
//   - undo-last-stroke is trivial and exact,
//   - what the user sees in the pad is bit-for-bit what gets exported.

export interface SigPoint {
  x: number;
  y: number;
}
export type SigStroke = SigPoint[];

/** Logical pad size (CSS px at 1×). The backing bitmap is this × PAD_SCALE. */
export const SIG_PAD_W = 600;
export const SIG_PAD_H = 200;
/** Backing-store multiplier — keeps hand-drawn lines razor sharp when scaled onto a certificate/invoice. */
export const SIG_PAD_SCALE = 3;

/** Paints strokes with smooth quadratic curves through midpoints (no polyline "corners"). */
export function paintSignatureStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: SigStroke[],
  opts: { color: string; width: number; scale: number }
) {
  ctx.save();
  ctx.setTransform(opts.scale, 0, 0, opts.scale, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = opts.color;
  ctx.fillStyle = opts.color;
  ctx.lineWidth = opts.width;
  for (const stroke of strokes) {
    if (!stroke.length) continue;
    if (stroke.length < 3) {
      const a = stroke[0];
      const b = stroke[stroke.length - 1];
      if (stroke.length === 1 || (a.x === b.x && a.y === b.y)) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, opts.width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length - 1; i++) {
      const mx = (stroke[i].x + stroke[i + 1].x) / 2;
      const my = (stroke[i].y + stroke[i + 1].y) / 2;
      ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, mx, my);
    }
    const last = stroke[stroke.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Renders strokes onto a fresh transparent canvas at pad resolution and returns it trimmed to the ink (or null if empty). */
export function renderSignatureStrokes(strokes: SigStroke[], color: string, width: number): HTMLCanvasElement | null {
  if (!strokes.length) return null;
  const canvas = document.createElement("canvas");
  canvas.width = SIG_PAD_W * SIG_PAD_SCALE;
  canvas.height = SIG_PAD_H * SIG_PAD_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paintSignatureStrokes(ctx, strokes, { color, width, scale: SIG_PAD_SCALE });
  return trimSignatureCanvas(canvas, 6 * SIG_PAD_SCALE);
}
