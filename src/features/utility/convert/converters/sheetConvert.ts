// ─── Spreadsheet converters ─────────────────────────────────────────────────
// Reuses the project's existing, already-tested XLSX read/write utilities —
// deliberately not duplicated here.
import { parseCsv, buildCsv } from "@/lib/csv";
import { gridToXlsxBlob } from "@/lib/xlsxWriter";
import { gridToPdfBlob } from "@/lib/pdfTable";
import { readXlsxGrid } from "@/lib/officeReaders";

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
