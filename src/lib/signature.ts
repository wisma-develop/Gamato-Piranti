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
 * Turns an uploaded signature photo into a transparent PNG by treating
 * near-white pixels as transparent. This is a simple luminance threshold —
 * not full AI background removal — but it works well for the common case of
 * a signature signed in dark ink on plain white/light paper and then
 * photographed or scanned.
 */
export async function makeUploadedSignatureTransparent(dataUrl: string, threshold = 235): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width || 1;
        canvas.height = img.naturalHeight || img.height || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imageData;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r >= threshold && g >= threshold && b >= threshold) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Gagal memuat gambar tanda tangan."));
    img.src = dataUrl;
  });
}
