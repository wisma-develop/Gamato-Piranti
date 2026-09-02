// Canvas render engine for the Business Card Studio (Special > Kartu Nama).
// Mirrors the cvEngine.ts / businessDocCanvas.ts pattern already used by the
// other document generators: pure drawing functions, no React here.

import { ensureFontReady, roundRect } from "@/lib/businessDocCanvas";
import { fontStack } from "@/lib/fontPresets";
import {
  type CardDesign,
  type CardSide,
  type CardTextElement,
  type CardShapeElement,
  type CardImageElement,
  type CardBackground,
  type ContactData,
  PX_PER_MM,
  resolveCardSizeMM,
} from "@/lib/businessCardTypes";

export function cardPixelSize(design: Pick<CardDesign, "sizeId" | "customWMM" | "customHMM">): { w: number; h: number; wMM: number; hMM: number } {
  const { wMM, hMM } = resolveCardSizeMM(design);
  return { w: Math.round(wMM * PX_PER_MM), h: Math.round(hMM * PX_PER_MM), wMM, hMM };
}

function resolveText(el: CardTextElement, data: ContactData): string {
  if (el.bind) {
    const v = data[el.bind];
    return v && v.trim() ? v : el.text;
  }
  return el.text;
}

// ── Image loading (cached so re-renders don't re-decode the same data URL) ──

export async function loadImageCached(src: string, cache: Map<string, HTMLImageElement>): Promise<HTMLImageElement | null> {
  if (!src) return null;
  const cached = cache.get(src);
  if (cached) return cached;
  const img = new Image();
  img.src = src;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
  if (!img.complete || img.naturalWidth === 0) return null;
  cache.set(src, img);
  return img;
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawImageContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// ── Background ───────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, bg: CardBackground, w: number, h: number, img: HTMLImageElement | null) {
  if (bg.type === "solid") {
    ctx.fillStyle = bg.color || "#ffffff";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (bg.type === "gradient") {
    const rad = (bg.angle * Math.PI) / 180;
    const cx = w / 2;
    const cy = h / 2;
    const len = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
    const dx = (Math.cos(rad) * len) / 2;
    const dy = (Math.sin(rad) * len) / 2;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    grad.addColorStop(0, bg.from);
    grad.addColorStop(1, bg.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  // image background
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, 0, w, h);
  if (img) {
    if (bg.fit === "cover") drawImageCover(ctx, img, 0, 0, w, h);
    else drawImageContain(ctx, img, 0, 0, w, h);
  }
  if (bg.overlayOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = bg.overlayOpacity;
    ctx.fillStyle = bg.overlayColor || "#000000";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

// ── Text ─────────────────────────────────────────────────────────────────
// `xPct`/`yPct` is the literal anchor point canvas' own `textAlign` acts on
// — for "left" the text starts there, for "right" it ends there, for
// "center" it's centered there. This matches exactly what a user sees when
// dragging (drag → xPct/yPct directly under the pointer, no hidden offset).
// `widthPct` does NOT influence position; it only sizes the drag hit-box in
// the editor. (An earlier version derived the anchor from a "widthPct-wide
// box centered at xPct", which silently pushed left/right-aligned text off
// the edge of the card whenever widthPct was generous — every template's
// front side lost most of its text this way. Keeping the anchor 1:1 with
// xPct removes that whole failure mode.)

function drawLetterSpaced(ctx: CanvasRenderingContext2D, text: string, spacing: number, align: "left" | "center" | "right") {
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let startX: number;
  if (align === "center") startX = -totalWidth / 2;
  else if (align === "right") startX = -totalWidth;
  else startX = 0;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let cx = startX;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, 0);
    cx += widths[i] + spacing;
  }
  ctx.textAlign = prevAlign;
}

function drawTextElement(ctx: CanvasRenderingContext2D, el: CardTextElement, data: ContactData, w: number, h: number) {
  const raw = resolveText(el, data);
  if (!raw) return;
  const display = el.uppercase ? raw.toUpperCase() : raw;
  const cx = (el.xPct / 100) * w;
  const cy = (el.yPct / 100) * h;

  ctx.save();
  ctx.translate(cx, cy);
  if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.globalAlpha = el.opacity;
  const weight = el.bold ? "700" : "400";
  const style = el.italic ? "italic" : "normal";
  ctx.font = `${style} ${weight} ${el.fontSize}px ${fontStack(el.fontFamily)}`;
  ctx.fillStyle = el.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = el.align;

  if (el.letterSpacing > 0) {
    drawLetterSpaced(ctx, display, el.letterSpacing, el.align);
  } else {
    ctx.fillText(display, 0, 0);
  }
  ctx.restore();
}

// ── Shapes ───────────────────────────────────────────────────────────────

function drawShapeElement(ctx: CanvasRenderingContext2D, el: CardShapeElement, w: number, h: number) {
  const cx = (el.xPct / 100) * w;
  const cy = (el.yPct / 100) * h;
  const bw = (el.widthPct / 100) * w;
  const bh = (el.heightPct / 100) * h;

  ctx.save();
  ctx.translate(cx, cy);
  if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.globalAlpha = el.opacity;

  if (el.shape === "line") {
    const thickness = Math.max(1, bh);
    ctx.beginPath();
    ctx.moveTo(-bw / 2, 0);
    ctx.lineTo(bw / 2, 0);
    ctx.lineWidth = thickness;
    ctx.strokeStyle = el.hasStroke ? el.stroke : el.fill;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (el.shape === "circle") {
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0, bw / 2), Math.max(0, bh / 2), 0, 0, Math.PI * 2);
  } else {
    roundRect(ctx, -bw / 2, -bh / 2, bw, bh, Math.max(0, Math.min(el.radius, bw / 2, bh / 2)));
  }
  if (el.hasFill) {
    ctx.fillStyle = el.fill;
    ctx.fill();
  }
  if (el.hasStroke && el.strokeWidth > 0) {
    ctx.lineWidth = el.strokeWidth;
    ctx.strokeStyle = el.stroke;
    ctx.stroke();
  }
  ctx.restore();
}

// ── Images ───────────────────────────────────────────────────────────────

async function drawImageElement(ctx: CanvasRenderingContext2D, el: CardImageElement, w: number, h: number, cache: Map<string, HTMLImageElement>) {
  const img = await loadImageCached(el.src, cache);
  if (!img) return;
  const cx = (el.xPct / 100) * w;
  const cy = (el.yPct / 100) * h;
  const bw = (el.widthPct / 100) * w;
  const bh = (el.heightPct / 100) * h;
  const x = -bw / 2;
  const y = -bh / 2;

  ctx.save();
  ctx.translate(cx, cy);
  if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.globalAlpha = el.opacity;

  if (el.circle) {
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0, bw / 2), Math.max(0, bh / 2), 0, 0, Math.PI * 2);
    ctx.clip();
    drawImageCover(ctx, img, x, y, bw, bh);
  } else if (el.rounded) {
    const r = Math.min(bw, bh) * 0.12;
    roundRect(ctx, x, y, bw, bh, r);
    ctx.clip();
    drawImageCover(ctx, img, x, y, bw, bh);
  } else {
    drawImageCover(ctx, img, x, y, bw, bh);
  }
  ctx.restore();
}

// ── Public entry point ───────────────────────────────────────────────────

/**
 * Renders one side (front or back) of a business card design onto the given
 * canvas at print-safe resolution. Awaits any fonts + images the side's
 * elements reference before drawing so the very first paint is already
 * correct (no flash-of-unstyled-text / late-popping logo).
 */
export async function renderCardSide(
  canvas: HTMLCanvasElement,
  side: CardSide,
  data: ContactData,
  design: Pick<CardDesign, "sizeId" | "customWMM" | "customHMM">,
  imageCache: Map<string, HTMLImageElement>
): Promise<void> {
  const { w, h } = cardPixelSize(design);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  const families = new Set<string>();
  for (const el of side.elements) {
    if (el.kind === "text") families.add(el.fontFamily);
  }
  await Promise.all(Array.from(families).flatMap((f) => [ensureFontReady(f, "700"), ensureFontReady(f, "400")]));

  let bgImg: HTMLImageElement | null = null;
  if (side.background.type === "image" && side.background.src) {
    bgImg = await loadImageCached(side.background.src, imageCache);
  }
  drawBackground(ctx, side.background, w, h, bgImg);

  for (const el of side.elements) {
    if (el.kind === "text") drawTextElement(ctx, el, data, w, h);
    else if (el.kind === "shape") drawShapeElement(ctx, el, w, h);
    else if (el.kind === "image") await drawImageElement(ctx, el, w, h, imageCache);
  }
}
