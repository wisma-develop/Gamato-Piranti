// ─── Spreadsheet converters ─────────────────────────────────────────────────
// Reuses the project's existing, already-tested XLSX read/write utilities —
// deliberately not duplicated here.
import { parseCsv, buildCsv } from "@/lib/csv";
import { gridToXlsxBlob } from "@/lib/xlsxWriter";
import { gridToPdfBlob } from "@/lib/pdfTable";
import { readXlsxGrid } from "@/lib/officeReaders";
import { loadPdfDocument, extractPageTextItems, groupIntoLines, lineToCells } from "@/lib/pdfRender";
import { dataFormatToGrid, gridToJson, gridToTsv, type DataFormat } from "./dataFormats";

export async function csvToXlsx(csvText: string): Promise<Blob> {
  return gridToXlsxBlob(parseCsv(csvText));
}

export async function xlsxToCsv(file: File): Promise<string> {
  const grid = await readXlsxGrid(file);
  return buildCsv(grid);
}

export async function xlsxToPdf(file: File, title: string): Promise<Blob> {
  const grid = await readXlsxGrid(file);
  return gridToPdfBlob(grid, title);
}

export async function xlsxToJson(file: File): Promise<string> {
  const grid = await readXlsxGrid(file);
  return JSON.stringify(gridToJson(grid), null, 2);
}

export async function xlsxToTsv(file: File): Promise<string> {
  const grid = await readXlsxGrid(file);
  return gridToTsv(grid);
}

/** Turns ANY structured-data text (JSON/CSV/TSV/XML/YAML) into a spreadsheet — array-of-objects becomes a table with the union of keys as header; anything else falls back to a sensible single-column/key-value table. */
export async function dataTextToXlsx(text: string, from: DataFormat): Promise<Blob> {
  return gridToXlsxBlob(dataFormatToGrid(text, from));
}

/** Same idea as `dataTextToXlsx`, but rendered as a paginated PDF table instead of a spreadsheet. */
export async function dataTextToPdfTable(text: string, from: DataFormat, title: string): Promise<Blob> {
  return gridToPdfBlob(dataFormatToGrid(text, from), title);
}

/**
 * Extracts text from a PDF, line by line, and reconstructs it as a table by
 * splitting each line into cells wherever there's a wide gap between words
 * (the same heuristic already proven in the dedicated "PDF ke Excel" tool —
 * reused here via the shared `lineToCells` helper rather than re-implemented).
 * Works well for PDFs that were actually built from tabular data; for prose
 * PDFs, expect one long cell per line rather than a meaningful grid — that's
 * an inherent limitation of text-position heuristics, not a bug.
 */
export async function pdfToXlsx(file: File): Promise<Blob> {
  const bytes = await file.arrayBuffer();
  const pdf = await loadPdfDocument(bytes);
  const grid: string[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const items = await extractPageTextItems(pdf, p);
    const lines = groupIntoLines(items);
    lines.forEach((line) => grid.push(lineToCells(line)));
  }
  return gridToXlsxBlob(grid);
}
