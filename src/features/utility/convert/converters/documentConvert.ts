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
import type { BlockModel } from "@/features/docs/richtext/parseEditor";
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
  const text = await htmlToPlainText(html);
  return pdfFromBlocksSimple(title, textToBlocks(text));
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

export async function rtfToTxt(file: File): Promise<string> {
  return readRtfText(file);
}
export async function rtfToDocx(file: File, title: string): Promise<Blob> {
  const text = await readRtfText(file);
  return exportDocxFromBlocks(textToBlocks(text), title);
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

/** Rasterizes every page of a PDF to a PNG and bundles them into a ZIP. */
export async function pdfToImagesZip(file: File, baseName: string): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  const pdf = await loadPdfDocument(bytes);
  const zip = new JSZip();
  for (let p = 1; p <= pdf.numPages; p++) {
    const canvas = await renderPageToCanvas(pdf, p, 2);
    const blob = await canvasToBlob(canvas, "image/png");
    zip.file(`${baseName}-hal-${String(p).padStart(2, "0")}.png`, blob);
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
