// Shared low-level canvas drawing helpers used by Kwitansi, Invoice, and
// Struk/Nota generators (text wrapping, dashed rule lines, logo placement).

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/** Draws left-aligned wrapped text and returns the y position right after the last line. */
export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines?: number
): number {
  let lines = wrapText(ctx, text, maxWidth);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}…` : `${last}…`;
  }
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

export function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, color = "#94a3b8") {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

export function drawSolidLine(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number, color = "#e2e8f0", width = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws an image inside a bounding box, preserving aspect ratio and centering
 * it. By default the drawn image gets gentle rounded corners automatically —
 * even if the uploaded file itself is a hard-edged square — so every logo
 * insertion (business card, invoice, kwitansi, struk, ...) looks polished
 * without the user having to pre-round their source file. Pass
 * `{ rounded: false }` to opt out for a specific placement if a perfectly
 * square/sharp logo is ever wanted.
 */
export function drawLogoFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
  options?: { rounded?: boolean; radiusRatio?: number }
) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.min(boxW / iw, boxH / ih);
  const w = iw * scale;
  const h = ih * scale;
  const dx = x + (boxW - w) / 2;
  const dy = y + (boxH - h) / 2;

  const rounded = options?.rounded ?? true;
  if (rounded && w > 0 && h > 0) {
    const radius = Math.min(Math.min(w, h) * (options?.radiusRatio ?? 0.16), w / 2, h / 2);
    ctx.save();
    roundRect(ctx, dx, dy, w, h, radius);
    ctx.clip();
    ctx.drawImage(img, dx, dy, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, dx, dy, w, h);
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Ensures the given font family is actually loaded before the canvas draws text with it (avoids FOUT baked into the raster). */
export async function ensureFontReady(family: string, weight = "700"): Promise<void> {
  try {
    await document.fonts.load(`${weight} 32px "${family}"`);
    await document.fonts.ready;
  } catch {
    // Font Loading API unavailable — canvas will fall back gracefully to the system font.
  }
}
