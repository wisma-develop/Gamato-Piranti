// Sheet Studio → PDF export. Reuses the project's existing, shared table-PDF
// renderer (`@/lib/pdfTable`, already used by "PDF ke Excel"/"Excel ke PDF")
// instead of reimplementing table layout — keeps visual style consistent
// with the rest of the app and gets the Gamato branding stamp for free.
import { gridToPdfBlob } from "@/lib/pdfTable";
import { cellKey, computeSheet, formatCellValue, type SheetData } from "./sheetModel";

export async function sheetToPdfBlob(sheet: SheetData): Promise<Blob> {
  const values = computeSheet(sheet);

  // Trim trailing fully-empty rows/columns so the PDF isn't padded with
  // dozens of blank table rows from the default 60x20 grid.
  let lastRow = -1;
  let lastCol = -1;
  for (let r = 0; r < sheet.rowCount; r++) {
    for (let c = 0; c < sheet.colCount; c++) {
      const v = values[cellKey({ col: c, row: r })];
      if (v !== null && v !== undefined && v !== "") {
        if (r > lastRow) lastRow = r;
        if (c > lastCol) lastCol = c;
      }
    }
  }
  if (lastRow === -1) lastRow = 0;
  if (lastCol === -1) lastCol = 0;

  const grid: string[][] = [];
  for (let r = 0; r <= lastRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= lastCol; c++) {
      const cell = sheet.cells[cellKey({ col: c, row: r })];
      row.push(formatCellValue(values[cellKey({ col: c, row: r })] ?? null, cell?.format));
    }
    grid.push(row);
  }

  return gridToPdfBlob(grid, sheet.name || "Sheet Studio");
}
