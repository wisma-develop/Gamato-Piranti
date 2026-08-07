// Thin wrapper around pdf.js (pdfjs-dist) for rendering PDF pages to canvas
// and extracting positioned text — the rendering/parsing engine pdf-lib
// intentionally doesn't provide (pdf-lib is a PDF *writer*, not a reader).
import * as pdfjsLib from "pdfjs-dist";
// Vite-native asset import: resolves to a real URL for the pdf.js worker file.
// eslint-disable-next-line import/no-unresolved
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl as unknown as string;

export async function loadPdfDocument(bytes: ArrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  return loadingTask.promise;
}

export async function renderPageToCanvas(pdf: any, pageNumber: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak didukung di browser ini.");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

export interface TextRunItem {
  text: string;
  x: number;
  y: number;
  height: number;
  width: number;
  hasEOL: boolean;
}

export async function extractPageTextItems(pdf: any, pageNumber: number): Promise<TextRunItem[]> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  return content.items
    .filter((it: any) => typeof it.str === "string")
    .map((it: any) => ({
      text: it.str as string,
      x: it.transform[4] as number,
      y: viewport.height - (it.transform[5] as number),
      height: Math.hypot(it.transform[2], it.transform[3]) || (it.height as number) || 10,
      width: (it.width as number) || 0,
      hasEOL: !!it.hasEOL,
    }));
}

/** Groups flat text items from a page into visual lines using pdf.js's own end-of-line markers. */
export function groupIntoLines(items: TextRunItem[]): TextRunItem[][] {
  const lines: TextRunItem[][] = [];
  let current: TextRunItem[] = [];
  for (const it of items) {
    current.push(it);
    if (it.hasEOL) {
      lines.push(current);
      current = [];
    }
  }
  if (current.length) lines.push(current);
  return lines.filter((l) => l.some((it) => it.text.trim()));
}

/** Joins a line's text items into a single string, inserting spaces where a visual gap exists. */
export function joinLineText(line: TextRunItem[]): string {
  const sorted = [...line].sort((a, b) => a.x - b.x);
  let out = "";
  let prevEnd: number | null = null;
  for (const it of sorted) {
    if (prevEnd !== null && it.x - prevEnd > it.height * 0.25) out += " ";
    out += it.text;
    prevEnd = it.x + it.width;
  }
  return out;
}

/** Splits a line's text items into table-like cells based on larger horizontal gaps. */
export function lineToCells(line: TextRunItem[]): string[] {
  const sorted = [...line].sort((a, b) => a.x - b.x);
  const row: string[] = [];
  let cell = "";
  let prevEnd: number | null = null;
  for (const it of sorted) {
    if (prevEnd !== null) {
      const gap = it.x - prevEnd;
      if (gap > it.height * 1.6) {
        row.push(cell.trim());
        cell = "";
      } else if (gap > it.height * 0.25) {
        cell += " ";
      }
    }
    cell += it.text;
    prevEnd = it.x + it.width;
  }
  if (cell.trim() || row.length) row.push(cell.trim());
  return row;
}
