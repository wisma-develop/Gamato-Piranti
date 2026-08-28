// ─── Image format converters ─────────────────────────────────────────────
// Raster conversions go through <canvas> (the same proven approach already
// used by Image Lab's ImageConvert.tsx) — reliable, no new dependency. SVG
// input rasterizes via an <img> element (browsers decode SVG images
// natively). ICO output is hand-written: modern ICO files are allowed to
// wrap a plain PNG frame (supported since Windows Vista and by every
// current browser/OS), which is far simpler and more robust than encoding
// the legacy BMP+AND-mask ICO structure from scratch.
import { PDFDocument } from "pdf-lib";
import { canvasToBlob } from "@/lib/canvas";
import { stampGamatoBranding } from "@/lib/pdfBranding";

export type ImageOutputFormat = "png" | "jpg" | "webp" | "bmp" | "ico" | "pdf";

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Gagal membaca gambar — file mungkin rusak atau formatnya tidak didukung browser."));
      img.src = url;
    });
    return img;
  } finally {
    // Revoke after the image has decoded; safe because onload already fired by the time we get here.
    URL.revokeObjectURL(url);
  }
}

function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/** BMP has no alpha-friendly encoder via canvas.toBlob in most browsers, so we paint onto a white background first — matches how BMP/JPG are commonly expected to look (no transparency support). */
function flattenOnWhite(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return flat;
}

/** Wrap a PNG image in a minimal single-frame ICO container (ICONDIR + ICONDIRENTRY + raw PNG bytes). */
function pngToIco(pngBytes: Uint8Array, width: number, height: number): Blob {
  const header = new Uint8Array(6 + 16);
  const view = new DataView(header.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: 1 = icon
  view.setUint16(4, 1, true); // image count
  // ICONDIRENTRY
  header[6] = width >= 256 ? 0 : width; // 0 means 256
  header[7] = height >= 256 ? 0 : height;
  header[8] = 0; // color palette
  header[9] = 0; // reserved
  view.setUint16(10, 1, true); // color planes
  view.setUint16(12, 32, true); // bits per pixel
  view.setUint32(14, pngBytes.byteLength, true); // size of PNG data
  view.setUint32(18, header.byteLength, true); // offset to PNG data
  return new Blob([header, pngBytes], { type: "image/x-icon" });
}

export async function convertImage(file: File, target: ImageOutputFormat, quality = 0.92): Promise<Blob> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  const img = await loadImage(file);
  let canvas = imageToCanvas(img);

  // SVGs with no intrinsic size sometimes decode to a 0×0 or 300×150 default
  // canvas — upscale to a sane working resolution so the output isn't blurry.
  if (isSvg && (canvas.width < 512 && canvas.height < 512)) {
    const scale = Math.max(1, Math.min(4, 800 / Math.max(canvas.width, canvas.height, 1)));
    const bigger = document.createElement("canvas");
    bigger.width = Math.round(canvas.width * scale) || 800;
    bigger.height = Math.round(canvas.height * scale) || 600;
    const ctx = bigger.getContext("2d")!;
    ctx.drawImage(img, 0, 0, bigger.width, bigger.height);
    canvas = bigger;
  }

  if (target === "pdf") {
    const pdfDoc = await PDFDocument.create();
    const pngBlob = await canvasToBlob(canvas, "image/png");
    const bytes = new Uint8Array(await pngBlob.arrayBuffer());
    const png = await pdfDoc.embedPng(bytes);
    const page = pdfDoc.addPage([canvas.width, canvas.height]);
    page.drawImage(png, { x: 0, y: 0, width: canvas.width, height: canvas.height });
    await stampGamatoBranding(pdfDoc);
    return new Blob([await pdfDoc.save()], { type: "application/pdf" });
  }

  if (target === "ico") {
    // ICO favicon sizes are conventionally square and capped at 256px.
    const size = Math.min(256, Math.max(canvas.width, canvas.height));
    const square = document.createElement("canvas");
    square.width = size;
    square.height = size;
    const ctx = square.getContext("2d")!;
    const scale = size / Math.max(canvas.width, canvas.height);
    const w = canvas.width * scale;
    const h = canvas.height * scale;
    ctx.drawImage(canvas, (size - w) / 2, (size - h) / 2, w, h);
    const pngBlob = await canvasToBlob(square, "image/png");
    const bytes = new Uint8Array(await pngBlob.arrayBuffer());
    return pngToIco(bytes, size, size);
  }

  if (target === "bmp") {
    // Not every engine's canvas.toBlob supports "image/bmp"; PNG->BMP-container
    // fallback isn't meaningful, so we rely on the browser's own BMP encoder
    // where available and surface a clear error otherwise (checked by caller).
    const flat = flattenOnWhite(canvas);
    return canvasToBlob(flat, "image/bmp");
  }

  if (target === "jpg") {
    const flat = flattenOnWhite(canvas);
    return canvasToBlob(flat, "image/jpeg", quality);
  }

  if (target === "webp") return canvasToBlob(canvas, "image/webp", quality);
  return canvasToBlob(canvas, "image/png");
}

/** Some browsers silently fall back to PNG when asked for an unsupported canvas.toBlob MIME (notably BMP in some engines). Detects that so the UI can warn instead of shipping a mislabeled file. */
export async function isBmpEncodingSupported(): Promise<boolean> {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const blob = await canvasToBlob(canvas, "image/bmp");
  return blob.type === "image/bmp";
}
