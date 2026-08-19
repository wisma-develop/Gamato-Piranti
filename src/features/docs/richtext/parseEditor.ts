// Walks the contentEditable DOM tree produced by the Doc Studio rich text
// editor into a small, serializable block/run model that both the .docx
// and .pdf exporters (and, in principle, any future exporter) can consume
// without needing to touch the DOM again.

export type Align = "left" | "center" | "right" | "justify";
export type ImageAlign = "left" | "center" | "right" | "float-left" | "float-right";

export interface RunModel {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string; // hex, e.g. "#0f172a"
  highlight?: string; // hex background color
  fontSizePx?: number;
  sub?: boolean;
  sup?: boolean;
  link?: string;
}

export type BlockModel =
  | { kind: "text"; listType?: "bullet" | "number"; align: Align; runs: RunModel[]; lineHeight?: number; spaceAfterPx?: number }
  | { kind: "image"; dataUrl: string; width: number; height: number; align?: ImageAlign };

function rgbStringToHex(input: string): string | undefined {
  const m = input.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const toHex = (n: string) => parseInt(n, 10).toString(16).padStart(2, "0");
    return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
  }
  if (input.startsWith("#")) return input;
  return undefined;
}

function getAlign(el: HTMLElement): Align {
  const inline = el.style?.textAlign;
  const computed = inline || (typeof window !== "undefined" ? window.getComputedStyle(el).textAlign : "");
  if (computed === "center") return "center";
  if (computed === "right") return "right";
  if (computed === "justify") return "justify";
  return "left";
}

function getSpacing(el: HTMLElement): { lineHeight?: number; spaceAfterPx?: number } {
  const result: { lineHeight?: number; spaceAfterPx?: number } = {};
  const lh = el.style?.lineHeight;
  if (lh) {
    const n = parseFloat(lh);
    if (Number.isFinite(n) && n > 0) result.lineHeight = n;
  }
  const mb = el.style?.marginBottom;
  if (mb && mb.endsWith("px")) {
    const n = parseFloat(mb);
    if (Number.isFinite(n) && n >= 0) result.spaceAfterPx = n;
  }
  return result;
}

function getImageAlign(el: HTMLElement): ImageAlign | undefined {
  const attr = el.getAttribute("data-align");
  if (attr === "left" || attr === "center" || attr === "right" || attr === "float-left" || attr === "float-right") return attr;
  return undefined;
}

function getImageRotation(el: HTMLElement): number {
  const attr = el.getAttribute("data-rotate");
  const n = attr ? parseFloat(attr) : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * Resolves what an <img> in the editor should export as: its DISPLAYED size
 * (what the user actually dragged/resized it to — NOT the raw pixel
 * resolution of the uploaded file, which is what naturalWidth/naturalHeight
 * report and was the source of "image comes out huge in the export" bugs),
 * with any rotation baked directly into a fresh bitmap so every exporter
 * can just draw it as a plain axis-aligned image.
 */
function resolveImageForExport(img: HTMLImageElement): { dataUrl: string; width: number; height: number } {
  // offsetWidth/offsetHeight reflect the element's own layout box, which
  // (unlike getBoundingClientRect) is NOT affected by a CSS `transform`
  // rotation — exactly the "size before rotation" we need here.
  const displayW = img.offsetWidth || img.naturalWidth || 300;
  const displayH = img.offsetHeight || img.naturalHeight || 200;
  const rotateDeg = getImageRotation(img);

  if (!rotateDeg) {
    return { dataUrl: img.src, width: displayW, height: displayH };
  }

  try {
    const rad = (rotateDeg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const boundW = Math.round(displayW * cos + displayH * sin);
    const boundH = Math.round(displayW * sin + displayH * cos);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, boundW);
    canvas.height = Math.max(1, boundH);
    const ctx = canvas.getContext("2d");
    if (!ctx) return { dataUrl: img.src, width: displayW, height: displayH };
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -displayW / 2, -displayH / 2, displayW, displayH);
    return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  } catch {
    // Cross-origin or otherwise tainted canvas — fall back to the
    // unrotated image rather than failing the whole export.
    return { dataUrl: img.src, width: displayW, height: displayH };
  }
}

interface StyleCtx {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  highlight?: string;
  fontSizePx?: number;
  sub?: boolean;
  sup?: boolean;
  link?: string;
}

function parseInline(
  node: Node,
  ctx: StyleCtx,
  runs: RunModel[],
  images: { dataUrl: string; width: number; height: number; align?: ImageAlign }[]
) {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || "";
      if (text) runs.push({ text, ...ctx });
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName;

    if (tag === "IMG") {
      const img = el as HTMLImageElement;
      const resolved = resolveImageForExport(img);
      images.push({ ...resolved, align: getImageAlign(img) });
      return;
    }
    if (tag === "BR") {
      runs.push({ text: "\n", ...ctx });
      return;
    }

    const next: StyleCtx = { ...ctx };
    if (tag === "B" || tag === "STRONG") next.bold = true;
    if (tag === "I" || tag === "EM") next.italic = true;
    if (tag === "U") next.underline = true;
    if (tag === "S" || tag === "STRIKE" || tag === "DEL") next.strike = true;
    if (tag === "SUB") next.sub = true;
    if (tag === "SUP") next.sup = true;
    if (tag === "A") next.link = el.getAttribute("href") || undefined;

    // execCommand doesn't always produce semantic tags (<b>/<i>/<u>/<s>) —
    // depending on the browser and the existing formatting under the
    // selection, it can just as easily wrap the text in a <span> with an
    // inline style instead. Checking tag name alone silently dropped bold/
    // italic/underline/strikethrough whenever that happened, so every style
    // property is checked too, independent of which element it lands on.
    const styleEl = el.style;
    if (styleEl) {
      const fw = styleEl.fontWeight;
      if (fw && (fw === "bold" || fw === "bolder" || parseInt(fw, 10) >= 600)) next.bold = true;
      if (styleEl.fontStyle === "italic" || styleEl.fontStyle === "oblique") next.italic = true;
      const decoLine = styleEl.textDecorationLine || styleEl.textDecoration || "";
      if (decoLine.includes("underline")) next.underline = true;
      if (decoLine.includes("line-through")) next.strike = true;
      if (styleEl.verticalAlign === "sub") next.sub = true;
      if (styleEl.verticalAlign === "super") next.sup = true;
    }

    if (el.style?.color) {
      const hex = rgbStringToHex(el.style.color);
      if (hex) next.color = hex;
    }
    if (el.style?.backgroundColor && el.style.backgroundColor !== "transparent") {
      const hex = rgbStringToHex(el.style.backgroundColor);
      if (hex) next.highlight = hex;
    }
    if (el.style?.fontSize?.endsWith("px")) {
      next.fontSizePx = parseFloat(el.style.fontSize);
    }
    if (tag === "FONT") {
      const c = el.getAttribute("color");
      if (c) next.color = c;
    }

    parseInline(el, next, runs, images);
  });
}

function pushTextBlock(blocks: BlockModel[], el: HTMLElement, listType?: "bullet" | "number") {
  const runs: RunModel[] = [];
  const images: { dataUrl: string; width: number; height: number; align?: ImageAlign }[] = [];
  parseInline(el, {}, runs, images);
  const align = getAlign(el);
  const spacing = getSpacing(el);
  const hasText = runs.some((r) => r.text.replace(/\n/g, "").trim() !== "");
  if (hasText || runs.length === 0) {
    blocks.push({ kind: "text", listType, align, runs: runs.length ? runs : [{ text: "" }], ...spacing });
  }
  images.forEach((img) => blocks.push({ kind: "image", ...img }));
}

export function parseEditor(root: HTMLElement): BlockModel[] {
  const blocks: BlockModel[] = [];

  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.trim()) blocks.push({ kind: "text", align: "left", runs: [{ text }] });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (tag === "UL" || tag === "OL") {
      const listType = tag === "UL" ? "bullet" : "number";
      Array.from(el.children).forEach((li) => {
        if (li.tagName === "LI") pushTextBlock(blocks, li as HTMLElement, listType);
      });
      return;
    }
    if (tag === "IMG") {
      const img = el as HTMLImageElement;
      const resolved = resolveImageForExport(img);
      blocks.push({ kind: "image", ...resolved, align: getImageAlign(img) });
      return;
    }
    if (tag === "BR") {
      blocks.push({ kind: "text", align: "left", runs: [{ text: "" }] });
      return;
    }
    // P, DIV, or any other block-level wrapper the browser produced
    pushTextBlock(blocks, el);
  });

  return blocks.length ? blocks : [{ kind: "text", align: "left", runs: [{ text: "" }] }];
}

/** Flattens a parsed block model back into plain text (used by readers/exports that don't need formatting). */
export function blocksToPlainText(blocks: BlockModel[]): string {
  return blocks
    .map((b) => (b.kind === "text" ? b.runs.map((r) => r.text).join("") : ""))
    .join("\n");
}
