import { roundRect } from "@/lib/businessDocCanvas";

export type QrLogoShape = "rounded" | "circle" | "square" | "none";

/**
 * Takes any uploaded logo (raw data URL) — transparent PNG, logo with its own
 * background, odd aspect ratio, whatever — and re-renders it centered inside
 * a clean frame with a solid backdrop, in the chosen shape. This guarantees a
 * consistently stylish result in the QR center regardless of what the user
 * actually uploaded, instead of dropping the raw image (with potentially
 * transparent edges bleeding into the QR's white background, or a clashing
 * square corner) straight into the code.
 *
 * shape "none" skips all of this and returns the raw image untouched, for
 * users who already prepared a properly-cropped logo themselves.
 */
export async function buildFramedLogoDataUrl(
  rawDataUrl: string,
  opts: { size?: number; paddingRatio?: number; radiusRatio?: number; bgColor?: string; shape?: QrLogoShape } = {}
): Promise<string> {
  const { size = 400, paddingRatio = 0.14, bgColor = "#ffffff", shape = "rounded" } = opts;

  if (shape === "none") return rawDataUrl;

  const radiusRatio = shape === "circle" ? 0.5 : shape === "square" ? 0 : opts.radiusRatio ?? 0.22;

  const img = new Image();
  img.src = rawDataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Gagal memuat gambar logo."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return rawDataUrl; // extremely unlikely fallback — never block export over this

  const radius = size * radiusRatio;

  // Rounded-square (or circular, or square) backdrop. Clipping first means a
  // transparent PNG's edges are always backed by a clean solid color instead
  // of showing the QR's white through irregular alpha edges.
  ctx.save();
  roundRect(ctx, 0, 0, size, size, radius);
  ctx.clip();
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  const padding = size * paddingRatio;
  const innerSize = size - padding * 2;
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.min(innerSize / iw, innerSize / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;
  ctx.drawImage(img, dx, dy, drawW, drawH);
  ctx.restore();

  // Subtle border so the frame reads clearly even against a white QR background.
  ctx.save();
  roundRect(ctx, 1.5, 1.5, size - 3, size - 3, radius);
  ctx.strokeStyle = "rgba(15, 23, 42, 0.12)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  return canvas.toDataURL("image/png");
}
