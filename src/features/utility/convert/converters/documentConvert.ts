// ─── Document format converters ────────────────────────────────────────────
// Almost entirely orchestration of infrastructure that already exists and is
// already used elsewhere in the app — deliberately not reimplemented:
//   - readDocxBlocks / exportDocxFromBlocks / exportPdfFromBlocks (Doc Studio)
//   - readRtfText (Doc Reader)
//   - renderHtmlToPngBlob (used by certificate/business-card style tools)
//   - loadPdfDocument / extractPageTextItems / renderPageToCanvas (PDF Lab)
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readDocxBlocks, readRtfText } from "@/lib/officeReaders";
import { exportDocxFromBlocks } from "@/features/docs/richtext/exportDocx";
import { exportPdfFromBlocks } from "@/features/docs/richtext/exportPdf";
import { parseEditor, type BlockModel, type RunModel } from "@/features/docs/richtext/parseEditor";
import { renderHtmlToPngBlob } from "@/lib/htmlRender";
import { loadPdfDocument, extractPageTextItems, groupIntoLines, joinLineText, renderPageToCanvas } from "@/lib/pdfRender";
import { canvasToBlob } from "@/lib/canvas";
import { stampGamatoBranding } from "@/lib/pdfBranding";

/** Plain text -> one BlockModel paragraph per line (blank lines preserved as empty paragraphs). */
function textToBlocks(text: string): BlockModel[] {
  return text.split(/\r?\n/).map((line) => ({
    kind: "text" as const,
    align: "left" as const,
    runs: [{ text: line }],
  }));
}

/** Very small Markdown-aware line splitter: strips the most common markers (#, -, *, >) so plain-text/.docx/.pdf output reads cleanly, without pulling in a full Markdown parser. */
export function markdownToPlainLines(md: string): string[] {
  return md.split(/\r?\n/).map((line) => {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) return heading[1];
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) return `•  ${bullet[1]}`;
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) return quote[1];
    return line.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1").replace(/`(.*?)`/g, "$1");
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Minimal Markdown -> HTML (headings, bold/italic/code, bullet lists, paragraphs). Enough for a faithful-looking PDF/PNG render without a full Markdown library. */
export function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  for (const raw of lines) {
    const line = raw;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level} style="margin:0.6em 0 0.3em;">${inlineMd(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      if (!inList) {
        out.push("<ul style=\"margin:0.3em 0;padding-left:1.4em;\">");
        inList = true;
      }
      out.push(`<li>${inlineMd(bullet[1])}</li>`);
      continue;
    }
    closeList();
    if (line.trim() === "") {
      out.push("<br/>");
    } else {
      out.push(`<p style="margin:0.4em 0;">${inlineMd(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

function inlineMd(s: string): string {
  let html = escapeHtml(s);
  html = html.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:0 4px;border-radius:4px;">$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return html;
}

async function pdfFromBlocksSimple(title: string, blocks: BlockModel[]): Promise<Blob> {
  return exportPdfFromBlocks(blocks, title);
}

// ─── HTML <-> BlockModel bridge ────────────────────────────────────────────
// `parseEditor` was built for Doc Studio's own contentEditable tree, but it's
// really just a generic HTML-DOM-to-BlockModel walker (it reads inline
// styles + a handful of semantic tags like B/STRONG/I/EM/A/IMG). Reused here
// for arbitrary uploaded/pasted HTML so "HTML -> DOCX/PDF" keeps real
// formatting (bold/italic/links/lists/images) instead of flattening to plain
// text. Semantic <h1>-<h6> tags don't carry inline styles by default (they
// rely on the browser's UA stylesheet, which parseEditor doesn't consult for
// sizing), so we inject bold+size inline styles onto headings first.
const HEADING_PX: Record<string, number> = { H1: 28, H2: 24, H3: 20, H4: 18, H5: 16, H6: 14 };

function htmlStringToBlocks(html: string): BlockModel[] {
  const container = document.createElement("div");
  container.innerHTML = html;
  // parseEditor only reads inline styles off elements it walks INTO (it
  // starts from a block's *children*, never the block element itself — see
  // parseInline/pushTextBlock) — so styling the <h1> tag directly is
  // silently ignored. Wrapping the heading's own content in a real inline
  // element makes the bold/size actually visible to that walk.
  container.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    const el = h as HTMLElement;
    const size = HEADING_PX[el.tagName] ?? 16;
    const wrapper = document.createElement("strong");
    wrapper.style.fontSize = `${size}px`;
    while (el.firstChild) wrapper.appendChild(el.firstChild);
    el.appendChild(wrapper);
  });
  // parseEditor reads computed style for alignment/spacing, which only
  // resolves reliably for elements actually attached to the document.
  container.style.cssText = "position:absolute;left:-99999px;top:0;visibility:hidden;";
  document.body.appendChild(container);
  try {
    return parseEditor(container);
  } finally {
    document.body.removeChild(container);
  }
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function runToHtml(r: RunModel): string {
  let t = escapeHtmlText(r.text).replace(/\n/g, "<br/>");
  if (r.sup) t = `<sup>${t}</sup>`;
  if (r.sub) t = `<sub>${t}</sub>`;
  if (r.bold) t = `<strong>${t}</strong>`;
  if (r.italic) t = `<em>${t}</em>`;
  if (r.underline) t = `<u>${t}</u>`;
  if (r.strike) t = `<s>${t}</s>`;
  const styles: string[] = [];
  if (r.color) styles.push(`color:${r.color}`);
  if (r.highlight) styles.push(`background-color:${r.highlight}`);
  if (r.fontSizePx) styles.push(`font-size:${r.fontSizePx}px`);
  if (styles.length) t = `<span style="${styles.join(";")}">${t}</span>`;
  if (r.link) t = `<a href="${escapeHtmlText(r.link)}">${t}</a>`;
  return t;
}

/** BlockModel[] -> HTML body markup (bold/italic/underline/links/lists/images all preserved). Counterpart to `parseEditor`/`htmlStringToBlocks`. */
export function blocksToHtml(blocks: BlockModel[]): string {
  const parts: string[] = [];
  let list: { type: "bullet" | "number"; items: string[] } | null = null;
  const flushList = () => {
    if (!list) return;
    const tag = list.type === "bullet" ? "ul" : "ol";
    parts.push(`<${tag}>${list.items.map((i) => `<li>${i}</li>`).join("")}</${tag}>`);
    list = null;
  };
  for (const b of blocks) {
    if (b.kind === "image") {
      flushList();
      parts.push(`<p><img src="${b.dataUrl}" style="max-width:100%;" width="${Math.round(b.width)}" height="${Math.round(b.height)}" /></p>`);
      continue;
    }
    const inner = b.runs.map(runToHtml).join("") || "&nbsp;";
    if (b.listType) {
      if (!list || list.type !== b.listType) {
        flushList();
        list = { type: b.listType, items: [] };
      }
      list.items.push(inner);
    } else {
      flushList();
      const alignAttr = b.align && b.align !== "left" ? ` style="text-align:${b.align}"` : "";
      parts.push(`<p${alignAttr}>${inner}</p>`);
    }
  }
  flushList();
  return parts.join("\n");
}

function runToMarkdown(r: RunModel): string {
  let t = r.text;
  if (r.bold) t = `**${t}**`;
  if (r.italic) t = `*${t}*`;
  if (r.strike) t = `~~${t}~~`;
  if (r.link) t = `[${t}](${r.link})`;
  return t;
}

/** BlockModel[] -> Markdown text (bold/italic/strikethrough/links/lists preserved; images embedded as data-URI references). Counterpart to `htmlStringToBlocks` for a plain-text-friendly export. */
export function blocksToMarkdown(blocks: BlockModel[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.kind === "image") {
      lines.push(`![gambar](${b.dataUrl})`);
      continue;
    }
    const text = b.runs.map(runToMarkdown).join("");
    if (b.listType === "bullet") lines.push(`- ${text}`);
    else if (b.listType === "number") lines.push(`1. ${text}`);
    else lines.push(text);
  }
  return lines.join("\n\n");
}

function wrapHtmlDocument(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#0f172a;max-width:800px;margin:0 auto;padding:24px;">${bodyHtml}</body></html>`;
}

// ─── Public conversion functions ──────────────────────────────────────────

export async function txtToDocx(text: string, title: string): Promise<Blob> {
  return exportDocxFromBlocks(textToBlocks(text), title);
}
export async function txtToPdf(text: string, title: string): Promise<Blob> {
  return pdfFromBlocksSimple(title, textToBlocks(text));
}
export async function markdownToDocx(md: string, title: string): Promise<Blob> {
  return exportDocxFromBlocks(textToBlocks(markdownToPlainLines(md).join("\n")), title);
}
export async function markdownToPdf(md: string, title: string): Promise<Blob> {
  return pdfFromBlocksSimple(title, textToBlocks(markdownToPlainLines(md).join("\n")));
}
export async function markdownToHtmlBlob(md: string): Promise<Blob> {
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#0f172a;">${markdownToHtml(md)}</body></html>`;
  return new Blob([html], { type: "text/html;charset=utf-8" });
}
export function markdownToHtmlString(md: string): string {
  return markdownToHtml(md);
}

export async function htmlToPlainText(html: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body?.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}
export async function htmlToPng(html: string, width = 1000, height = 1400): Promise<Blob> {
  return renderHtmlToPngBlob(html, width, height, "#ffffff");
}
export async function htmlToPdf(html: string, title: string): Promise<Blob> {
  return pdfFromBlocksSimple(title, htmlStringToBlocks(html));
}
export async function htmlToDocx(html: string, title: string): Promise<Blob> {
  return exportDocxFromBlocks(htmlStringToBlocks(html), title);
}
export async function htmlToMarkdown(html: string): Promise<string> {
  return blocksToMarkdown(htmlStringToBlocks(html));
}

export async function docxToTxt(file: File): Promise<string> {
  const blocks = await readDocxBlocks(file);
  return blocks
    .map((b) => (b.kind === "text" ? b.runs.map((r) => r.text).join("") : ""))
    .join("\n");
}
export async function docxToPdf(file: File, title: string): Promise<Blob> {
  const blocks = await readDocxBlocks(file);
  return pdfFromBlocksSimple(title, blocks);
}
export async function docxToHtmlBlob(file: File): Promise<Blob> {
  const blocks = await readDocxBlocks(file);
  const html = wrapHtmlDocument(blocksToHtml(blocks));
  return new Blob([html], { type: "text/html;charset=utf-8" });
}
export async function docxToMarkdown(file: File): Promise<string> {
  const blocks = await readDocxBlocks(file);
  return blocksToMarkdown(blocks);
}

export async function rtfToTxt(file: File): Promise<string> {
  return readRtfText(file);
}
export async function rtfToDocx(file: File, title: string): Promise<Blob> {
  const text = await readRtfText(file);
  return exportDocxFromBlocks(textToBlocks(text), title);
}
export async function rtfToPdf(file: File, title: string): Promise<Blob> {
  const text = await readRtfText(file);
  return pdfFromBlocksSimple(title, textToBlocks(text));
}

/** Extracts all text from a PDF, page by page, in reading order. */
export async function pdfToTxt(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const pdf = await loadPdfDocument(bytes);
  const pageTexts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const items = await extractPageTextItems(pdf, p);
    const lines = groupIntoLines(items);
    pageTexts.push(lines.map(joinLineText).join("\n"));
  }
  return pageTexts.join("\n\n");
}
export async function pdfToDocx(file: File, title: string): Promise<Blob> {
  const text = await pdfToTxt(file);
  return exportDocxFromBlocks(textToBlocks(text), title);
}
/** Plain text is already valid (unstyled) Markdown, so this just relabels the extracted text — paragraph breaks are preserved so it still reads cleanly as Markdown. */
export async function pdfToMarkdown(file: File): Promise<string> {
  return pdfToTxt(file);
}

/** Rasterizes every page of a PDF into an image and bundles them into a ZIP. */
export async function pdfToImagesZip(file: File, baseName: string, format: "png" | "jpeg" = "png"): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  const pdf = await loadPdfDocument(bytes);
  const zip = new JSZip();
  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  const ext = format === "jpeg" ? "jpg" : "png";
  for (let p = 1; p <= pdf.numPages; p++) {
    const canvas = await renderPageToCanvas(pdf, p, 2);
    const blob = await canvasToBlob(canvas, mime, format === "jpeg" ? 0.92 : undefined);
    zip.file(`${baseName}-hal-${String(p).padStart(2, "0")}.${ext}`, blob);
  }
  return zip.generateAsync({ type: "blob" });
}

/** Simple text -> single-page-per-chunk PDF, used as a graceful fallback when a richer text-to-PDF path isn't applicable. Kept here for completeness/testing; the primary path is `txtToPdf` above (via exportPdfFromBlocks). */
export async function plainTextToPdfDirect(text: string): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;
  const lineHeight = fontSize + 4;
  const margin = 50;
  const maxCharsPerLine = 90;
  const allLines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw) {
      allLines.push("");
      continue;
    }
    for (let s = 0; s < raw.length; s += maxCharsPerLine) allLines.push(raw.slice(s, s + maxCharsPerLine));
  }
  let page = pdfDoc.addPage();
  let { height } = page.getSize();
  let y = height - margin;
  const addPage = () => {
    page = pdfDoc.addPage();
    ({ height } = page.getSize());
    y = height - margin;
  };
  for (const line of allLines) {
    if (y < margin + lineHeight) addPage();
    if (line) page.drawText(line, { x: margin, y: y - lineHeight, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= lineHeight;
  }
  await stampGamatoBranding(pdfDoc);
  return new Blob([await pdfDoc.save()], { type: "application/pdf" });
}
