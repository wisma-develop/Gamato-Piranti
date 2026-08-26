// ─── Sheet Studio — Sheet Data Model & Recalculation Engine ────────────────
// Pure data-layer module (no DOM/React): cell storage, formatting, and a
// memoized, cycle-safe recalculation pass built on top of formulaEngine.ts.

import {
  addrToLabel,
  evaluateFormula,
  isErrorValue,
  parseCellAddr,
  type CellAddr,
  type EvalResult,
} from "./formulaEngine";
import { buildCsv, parseCsv as parseCsvRows } from "@/lib/csv";

export type NumberFormat = "general" | "number" | "currency" | "percent" | "integer";
export type TextAlign = "left" | "center" | "right";

export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: TextAlign;
  numberFormat?: NumberFormat;
  decimals?: number;
  bg?: string; // hex color
  color?: string; // hex color
}

export interface CellData {
  /** Raw user input: plain text/number, or a formula starting with "=". */
  raw: string;
  format?: CellFormat;
}

export interface SheetData {
  name: string;
  rowCount: number;
  colCount: number;
  cells: Record<string, CellData>;
  colWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
}

export const DEFAULT_ROWS = 60;
export const DEFAULT_COLS = 20;

export function createEmptySheet(name = "Sheet1"): SheetData {
  return { name, rowCount: DEFAULT_ROWS, colCount: DEFAULT_COLS, cells: {} };
}

export function cellKey(addr: CellAddr): string {
  return addrToLabel(addr);
}

/**
 * Recompute every formula cell in the sheet. Returns a map of cell-label ->
 * evaluated result. Non-formula cells resolve to their raw value coerced to
 * number when it looks numeric, otherwise the raw string.
 *
 * Circular references are detected per-cell via a "currently resolving" set
 * threaded through the whole pass; any cell caught in a cycle (including
 * transitively, through another cell that's mid-cycle) resolves to
 * {error:"#CIRCULAR!"} instead of hanging.
 */
export function computeSheet(sheet: SheetData): Record<string, EvalResult> {
  const cache = new Map<string, EvalResult>();
  const resolving = new Set<string>();

  function coerceRaw(raw: string): EvalResult {
    if (raw === "") return null;
    const trimmed = raw.trim();
    if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);
    return raw;
  }

  function resolve(addr: CellAddr): EvalResult {
    const key = cellKey(addr);
    if (cache.has(key)) return cache.get(key)!;
    const cell = sheet.cells[key];
    if (!cell || cell.raw === "") {
      cache.set(key, null);
      return null;
    }
    if (!cell.raw.startsWith("=")) {
      const v = coerceRaw(cell.raw);
      cache.set(key, v);
      return v;
    }
    if (resolving.has(key)) {
      return { error: "#CIRCULAR!" };
    }
    resolving.add(key);
    const result = evaluateFormula(cell.raw.slice(1), resolve);
    resolving.delete(key);
    cache.set(key, result);
    return result;
  }

  for (const key of Object.keys(sheet.cells)) {
    const addr = parseCellAddr(key);
    if (addr) resolve(addr);
  }
  return Object.fromEntries(cache);
}

/** Format an evaluated cell value for display, applying number format + decimals. */
export function formatCellValue(value: EvalResult, format?: CellFormat): string {
  if (value === null || value === undefined) return "";
  if (isErrorValue(value)) return value.error;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "string") return value;

  const decimals = format?.decimals ?? 2;
  switch (format?.numberFormat) {
    case "currency":
      return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: decimals }).format(value);
    case "percent":
      return `${(value * 100).toFixed(decimals)}%`;
    case "integer":
      return Math.round(value).toLocaleString("id-ID");
    case "number":
      return value.toLocaleString("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    default:
      // "general": trim trailing float noise but don't force decimals
      return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e10) / 1e10);
  }
}

/** Serialize the sheet to CSV (values only, formulas evaluated). Reuses the project's shared, battle-tested CSV writer (`@/lib/csv`). */
export function sheetToCsv(sheet: SheetData): string {
  const values = computeSheet(sheet);
  const grid: string[][] = [];
  for (let r = 0; r < sheet.rowCount; r++) {
    const row: string[] = [];
    for (let c = 0; c < sheet.colCount; c++) {
      row.push(formatCellValue(values[cellKey({ col: c, row: r })] ?? null));
    }
    grid.push(row);
  }
  // Trim fully-empty trailing rows so exports aren't padded with blank lines.
  while (grid.length && grid[grid.length - 1].every((v) => v === "")) grid.pop();
  return buildCsv(grid);
}

/** Parse CSV text into a grid of strings. Reuses the project's shared, battle-tested CSV parser (`@/lib/csv`), which already handles quoted fields, embedded commas/newlines, escaped quotes, and a leading BOM. */
export function parseCsv(text: string): string[][] {
  return parseCsvRows(text);
}
