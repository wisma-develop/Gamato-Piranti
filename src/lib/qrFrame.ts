export interface QrFrameOptions {
  text: string;
  textColor: string;
  bgColor: string;
  position: "top" | "bottom";
}

/**
 * Composites a solid-color text banner directly above or below an already
 * rendered QR canvas, producing one flattened raster image. Takes the QR's
 * own live-preview <canvas> as input (rather than re-rendering the QR code a
 * second time from scratch) so the exported frame always matches exactly
 * what the user sees in the preview, with zero risk of the two drifting out
 * of sync from independently duplicated rendering logic.
 */
export async function composeFramedQrCanvas(qrCanvas: HTMLCanvasElement, opts: QrFrameOptions): Promise<HTMLCanvasElement> {
  const { text, textColor, bgColor, position } = opts;
  const size = qrCanvas.width;
  const bannerHeight = Math.max(56, Math.round(size * 0.16));

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size + bannerHeight;
  const ctx = out.getContext("2d");
  if (!ctx) return qrCanvas;

  const bannerY = position === "top" ? 0 : size;
  const qrY = position === "top" ? bannerHeight : 0;

  // Banner background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, bannerY, size, bannerHeight);

  // QR itself
  ctx.drawImage(qrCanvas, 0, qrY, size, size);

  // Banner text, auto-shrunk to fit the available width with side padding.
  const paddingX = size * 0.06;
  const maxWidth = size - paddingX * 2;
  let fontSize = Math.round(bannerHeight * 0.42);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColor;
  const trimmed = text.trim() || "SCAN ME";
  do {
    ctx.font = `700 ${fontSize}px "Inter", system-ui, -apple-system, sans-serif`;
    if (ctx.measureText(trimmed).width <= maxWidth || fontSize <= 10) break;
    fontSize -= 1;
  } while (fontSize > 10);
  ctx.fillText(trimmed, size / 2, bannerY + bannerHeight / 2, maxWidth);

  return out;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}
