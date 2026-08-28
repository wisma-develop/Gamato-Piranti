// ─── Data format converters ─────────────────────────────────────────────────
// Orchestrates conversion between structured-data text formats: JSON, CSV,
// TSV, XML, YAML. Delegates the hard parts to the already-tested `yaml.ts`
// and `xmlJson.ts` modules, and to the project's existing, shared CSV
// utility (`@/lib/csv`) rather than re-implementing CSV parsing again.
import { parseCsv, buildCsv } from "@/lib/csv";
import { parseYaml, toYaml } from "./yaml";
import { xmlToJson, jsonToXml } from "./xmlJson";

export type DataFormat = "json" | "csv" | "tsv" | "xml" | "yaml";

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON tidak valid: ${err instanceof Error ? err.message : "format tidak bisa dibaca."}`);
  }
}

/** JSON value -> flat grid (array of row objects, or a 2D array, becomes a table; anything else becomes a single-cell table). */
function jsonToGrid(value: unknown): string[][] {
  const asString = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  if (Array.isArray(value)) {
    if (!value.length) return [[]];
    if (value.every((row) => Array.isArray(row))) {
      // Array of arrays -> rows as-is
      return (value as unknown[][]).map((row) => row.map(asString));
    }
    if (value.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
      // Array of objects -> table with union of all keys as header
      const headerSet = new Set<string>();
      for (const row of value as Record<string, unknown>[]) Object.keys(row).forEach((k) => headerSet.add(k));
      const header = Array.from(headerSet);
      const rows = (value as Record<string, unknown>[]).map((row) => header.map((h) => asString(row[h])));
      return [header, ...rows];
    }
    // Array of scalars -> single column
    return [["value"], ...(value as unknown[]).map((v) => [asString(v)])];
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return [["key", "value"], ...Object.entries(obj).map(([k, v]) => [k, asString(v)])];
  }
  return [["value"], [asString(value)]];
}

/** Grid (header row + data rows) -> array of JSON objects keyed by header. */
function gridToJson(grid: string[][]): unknown {
  if (!grid.length) return [];
  const [header, ...rows] = grid;
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h || `col${i + 1}`] = row[i] ?? "";
    });
    return obj;
  });
}

function gridToTsv(grid: string[][]): string {
  return grid.map((row) => row.map((cell) => cell.replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t")).join("\r\n");
}

function parseTsv(text: string): string[][] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line, i, arr) => !(i === arr.length - 1 && line === ""))
    .map((line) => line.split("\t"));
}

/** Parses `text` as `from`, producing a normalized intermediate JS value. */
function parseAs(text: string, from: DataFormat): unknown {
  switch (from) {
    case "json":
      return parseJsonSafe(text);
    case "csv":
      return gridToJson(parseCsv(text));
    case "tsv":
      return gridToJson(parseTsv(text));
    case "xml":
      return xmlToJson(text);
    case "yaml":
      return parseYaml(text);
  }
}

/** Serializes a normalized JS value to `to`. */
function serializeAs(value: unknown, to: DataFormat): string {
  switch (to) {
    case "json":
      return JSON.stringify(value, null, 2);
    case "csv":
      return buildCsv(jsonToGrid(value));
    case "tsv":
      return gridToTsv(jsonToGrid(value));
    case "xml":
      return jsonToXml(value as any);
    case "yaml":
      return toYaml(value as any);
  }
}

export function convertDataFormat(text: string, from: DataFormat, to: DataFormat): string {
  if (from === to) return text;
  const value = parseAs(text, from);
  return serializeAs(value, to);
}

export const DATA_FORMAT_LABELS: Record<DataFormat, string> = {
  json: "JSON",
  csv: "CSV",
  tsv: "TSV",
  xml: "XML",
  yaml: "YAML",
};

export const DATA_FORMAT_EXTENSIONS: Record<DataFormat, string> = {
  json: "json",
  csv: "csv",
  tsv: "tsv",
  xml: "xml",
  yaml: "yaml",
};
