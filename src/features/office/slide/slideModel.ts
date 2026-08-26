// ─── Slide Studio — Data Model & Canvas Renderer ───────────────────────────
// Pure data-layer module. The editor renders slides as absolutely-positioned
// DOM elements (for easy click/drag/resize interaction); this module renders
// the *same* slide data onto an actual <canvas> at high resolution — used to
// rasterize slides for PDF/PNG export so exports are pixel-faithful to what
// was designed, without re-implementing PDF text layout.

export type SlideElementKind = "text" | "shape" | "image";
export type ShapeKind = "rect" | "ellipse" | "line";
export type TextAlign = "left" | "center" | "right";

interface ElementBase {
  id: string;
  x: number; // logical units (slide is SLIDE_WIDTH x SLIDE_HEIGHT logical units)
  y: number;
  width: number;
  height: number;
}

export interface TextElement extends ElementBase {
  kind: "text";
  text: string;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  align?: TextAlign;
  color: string;
}

export interface ShapeElement extends ElementBase {
  kind: "shape";
  shape: ShapeKind;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface ImageElement extends ElementBase {
  kind: "image";
  src: string; // data URL
}

export type SlideElement = TextElement | ShapeElement | ImageElement;

export interface Slide {
  id: string;
  background: string;
  elements: SlideElement[];
}

export interface Deck {
  title: string;
  slides: Slide[];
}

export const SLIDE_WIDTH = 960;
export const SLIDE_HEIGHT = 540;

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export function createEmptySlide(): Slide {
  return { id: newId("slide"), background: "#ffffff", elements: [] };
}

export function createTitleSlide(title: string, subtitle?: string): Slide {
  const slide = createEmptySlide();
  slide.elements.push({
    id: newId("el"),
    kind: "text",
    x: 80,
    y: 190,
    width: 800,
    height: 100,
    text: title,
    fontSize: 44,
    bold: true,
    align: "center",
    color: "#0f172a",
  });
  if (subtitle) {
    slide.elements.push({
      id: newId("el"),
      kind: "text",
      x: 120,
      y: 300,
      width: 720,
      height: 60,
      text: subtitle,
      fontSize: 22,
      align: "center",
      color: "#475569",
    });
  }
  return slide;
}

export function createEmptyDeck(): Deck {
  return { title: "Presentasi Baru", slides: [createTitleSlide("Judul Presentasi", "Subjudul atau nama penulis")] };
}

// ─── Canvas rendering (shared by live thumbnail preview + export) ────────

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/**
 * Draw a slide onto a canvas 2D context that has already been scaled so
 * that 1 unit == 1 logical slide unit (i.e. caller sets canvas size to
 * SLIDE_WIDTH*scale x SLIDE_HEIGHT*scale and calls ctx.scale(scale, scale)
 * before invoking this).
 */
export function drawSlideOnCanvas(ctx: CanvasRenderingContext2D, slide: Slide, imageCache: Map<string, HTMLImageElement>) {
  ctx.fillStyle = slide.background || "#ffffff";
  ctx.fillRect(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT);

  for (const el of slide.elements) {
    if (el.kind === "shape") {
      ctx.fillStyle = el.fill;
      ctx.strokeStyle = el.stroke || "transparent";
      ctx.lineWidth = el.strokeWidth ?? 0;
      if (el.shape === "rect") {
        ctx.fillRect(el.x, el.y, el.width, el.height);
        if (el.strokeWidth) ctx.strokeRect(el.x, el.y, el.width, el.height);
      } else if (el.shape === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (el.strokeWidth) ctx.stroke();
      } else if (el.shape === "line") {
        ctx.beginPath();
        ctx.moveTo(el.x, el.y);
        ctx.lineTo(el.x + el.width, el.y + el.height);
        ctx.lineWidth = el.strokeWidth || 4;
        ctx.strokeStyle = el.fill;
        ctx.stroke();
      }
    } else if (el.kind === "image") {
      const img = imageCache.get(el.src);
      if (img && img.complete) {
        ctx.drawImage(img, el.x, el.y, el.width, el.height);
      } else {
        ctx.fillStyle = "#e2e8f0";
        ctx.fillRect(el.x, el.y, el.width, el.height);
      }
    } else if (el.kind === "text") {
      ctx.save();
      ctx.fillStyle = el.color;
      const weight = el.bold ? "bold" : "normal";
      const style = el.italic ? "italic" : "normal";
      ctx.font = `${style} ${weight} ${el.fontSize}px Arial, sans-serif`;
      ctx.textBaseline = "top";
      const lineHeight = el.fontSize * 1.3;
      const lines = wrapCanvasText(ctx, el.text, el.width);
      const align = el.align ?? "left";
      ctx.textAlign = align;
      const drawX = align === "center" ? el.x + el.width / 2 : align === "right" ? el.x + el.width : el.x;
      lines.forEach((line, i) => {
        const ly = el.y + i * lineHeight;
        if (ly + lineHeight <= el.y + el.height + lineHeight) ctx.fillText(line, drawX, ly);
      });
      ctx.restore();
    }
  }
}

/** Preload every distinct image src used across the deck (data URLs resolve instantly but still need an Image object with known natural size). */
export async function preloadDeckImages(deck: Deck): Promise<Map<string, HTMLImageElement>> {
  const cache = new Map<string, HTMLImageElement>();
  const srcs = new Set<string>();
  for (const slide of deck.slides) {
    for (const el of slide.elements) {
      if (el.kind === "image") srcs.add(el.src);
    }
  }
  await Promise.all(
    Array.from(srcs).map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            cache.set(src, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = src;
        })
    )
  );
  return cache;
}

export async function renderSlideToCanvas(slide: Slide, imageCache: Map<string, HTMLImageElement>, scale = 2): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_WIDTH * scale;
  canvas.height = SLIDE_HEIGHT * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  drawSlideOnCanvas(ctx, slide, imageCache);
  return canvas;
}
