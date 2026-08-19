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
      images.push({ dataUrl: img.src, width: img.naturalWidth || 500, height: img.naturalHeight || 350, align: getImageAlign(img) });
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
      blocks.push({ kind: "image", dataUrl: img.src, width: img.naturalWidth || 500, height: img.naturalHeight || 350, align: getImageAlign(img) });
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
