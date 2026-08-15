// Small, dependency-free CSV parse/generate helpers — used by the
// Certificate Generator's "Upload CSV" bulk mode. Kept generic (no
// certificate-specific logic) so it stays reusable and easy to unit-reason
// about on its own.

/**
 * A correct (not naive-split-on-comma) CSV parser: handles quoted fields,
 * commas/newlines embedded inside quotes, escaped `""` quotes, and both
 * CRLF and LF line endings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM if present (common when the file was exported from Excel).
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const len = src.length;
  let i = 0;

  while (i < len) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Escapes a single field for CSV output (quotes it only when actually necessary). */
function toCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(rows: string[][]): string {
  return rows.map((r) => r.map(toCsvField).join(",")).join("\r\n");
}

export interface CsvRecipient {
  /** The resolved display name for this row — always present, never empty. */
  nama: string;
  /** Every column from the CSV header (lowercased keys), including "nama". */
  fields: Record<string, string>;
}

export interface CsvParseResult {
  recipients: CsvRecipient[];
  /** Column names from the header, excluding "nama" — these are extra placeholders the user can use. */
  extraColumns: string[];
  error: string | null;
}

/**
 * Converts raw CSV text into recipient records. The column named "nama" is
 * used as the display name; if no "nama" column exists, the FIRST column is
 * used instead (so a plain single-column list still works). Every other
 * column becomes an additional `{column}` placeholder available in text
 * layers, on top of the built-in `{nama}` / `{nomor}` / `{tanggal}`.
 */
export function csvToRecipients(text: string): CsvParseResult {
  const rows = parseCsv(text);
  if (!rows.length) {
    return { recipients: [], extraColumns: [], error: "File CSV kosong atau tidak terbaca." };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  let nameIdx = header.findIndex((h) => h === "nama");
  if (nameIdx === -1) nameIdx = 0; // fall back: treat the first column as the name

  const dataRows = rows.slice(1);
  if (!dataRows.length) {
    return { recipients: [], extraColumns: [], error: "CSV hanya berisi header, tidak ada baris data penerima." };
  }

  const recipients: CsvRecipient[] = [];
  for (const r of dataRows) {
    const fields: Record<string, string> = {};
    header.forEach((h, idx) => {
      if (!h) return;
      fields[h] = (r[idx] ?? "").trim();
    });
    const nama = (r[nameIdx] ?? "").trim();
    if (!nama) continue; // skip rows without a name — nothing to print
    fields.nama = nama;
    recipients.push({ nama, fields });
  }

  const extraColumns = header.filter((h, idx) => h && idx !== nameIdx && h !== "nama" && h !== "nomor" && h !== "tanggal");

  if (!recipients.length) {
    return { recipients: [], extraColumns, error: "Tidak ada baris dengan nama yang terisi di kolom \"nama\"." };
  }

  return { recipients, extraColumns, error: null };
}

/** Builds the downloadable example CSV template shown/offered in the UI. */
export function certificateCsvTemplate(): string {
  const rows = [
    ["nama", "nomor", "tanggal", "jabatan"],
    ["Budi Santoso", "", "", "Ketua Panitia"],
    ["Siti Aminah", "", "", "Sekretaris"],
    ["Ahmad Fauzi", "", "", "Bendahara"],
  ];
  return buildCsv(rows);
}
