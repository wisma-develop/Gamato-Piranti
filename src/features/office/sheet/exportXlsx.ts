// ─── Sheet Studio — Full-fidelity .xlsx writer ─────────────────────────────
// Unlike the minimal `gridToXlsxBlob` helper in `src/lib/xlsxWriter.ts` (used
// by the PDF↔Excel converters, which only needs plain text cells), Sheet
// Studio needs numbers to stay numeric, formulas to round-trip as real Excel
// formulas (with a cached value so they render before Excel recalculates),
// and basic cell styling (bold/italic/underline/background/text color/
// number format) to survive the export. This is a separate module so the
// existing PDF↔Excel converters are completely untouched.
import JSZip from "jszip";
import { isErrorValue, type CellAddr, type EvalResult } from "./formulaEngine";
import { cellKey, computeSheet, type CellFormat, type SheetData } from "./sheetModel";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function colIndexToLetters(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function hexToArgb(hex?: string): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  return `FF${m[1].toUpperCase()}`;
}

const NUMFMT_ID: Record<NonNullable<CellFormat["numberFormat"]>, number> = {
  general: 0,
  integer: 1, // built-in "0"
  number: 2, // built-in "0.00"
  percent: 10, // built-in "0.00%"
  currency: 164, // custom, declared below
};

interface StyleEntry {
  key: string;
  format?: CellFormat;
}

/** Build the deduplicated style table shared by every cell in the sheet. */
function collectStyles(sheet: SheetData): { keyToIndex: Map<string, number>; entries: StyleEntry[] } {
  const keyToIndex = new Map<string, number>();
  const entries: StyleEntry[] = [{ key: "__default__" }]; // index 0 = default/no formatting
  keyToIndex.set("__default__", 0);

  for (let r = 0; r < sheet.rowCount; r++) {
    for (let c = 0; c < sheet.colCount; c++) {
      const cell = sheet.cells[cellKey({ col: c, row: r })];
      const fmt = cell?.format;
      if (!fmt) continue;
      const key = JSON.stringify([fmt.bold, fmt.italic, fmt.underline, fmt.align, fmt.numberFormat, fmt.decimals, fmt.bg, fmt.color]);
      if (!keyToIndex.has(key)) {
        keyToIndex.set(key, entries.length);
        entries.push({ key, format: fmt });
      }
    }
  }
  return { keyToIndex, entries };
}

function buildStylesXml(entries: StyleEntry[]): string {
  // Fonts: index 0 = default. One font per distinct bold/italic/underline/color combo.
  const fontKeyToIndex = new Map<string, number>();
  const fonts: string[] = [`<font><sz val="10"/><name val="Calibri"/></font>`];
  fontKeyToIndex.set("__default__", 0);

  // Fills: index 0 and 1 are reserved by the OOXML spec (none, gray125).
  const fillKeyToIndex = new Map<string, number>();
  const fills: string[] = [`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`];

  const cellXfs: string[] = [`<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`]; // index 0 = default

  for (const entry of entries.slice(1)) {
    const fmt = entry.format!;
    const fontKey = JSON.stringify([fmt.bold, fmt.italic, fmt.underline, fmt.color]);
    let fontId = fontKeyToIndex.get(fontKey);
    if (fontId === undefined) {
      const argb = hexToArgb(fmt.color);
      const parts = [`<sz val="10"/>`, `<name val="Calibri"/>`];
      if (fmt.bold) parts.push(`<b/>`);
      if (fmt.italic) parts.push(`<i/>`);
      if (fmt.underline) parts.push(`<u/>`);
      if (argb) parts.push(`<color rgb="${argb}"/>`);
      fontId = fonts.length;
      fonts.push(`<font>${parts.join("")}</font>`);
      fontKeyToIndex.set(fontKey, fontId);
    }

    let fillId = 0;
    const bgArgb = hexToArgb(fmt.bg);
    if (bgArgb) {
      const fillKey = bgArgb;
      const existing = fillKeyToIndex.get(fillKey);
      if (existing !== undefined) {
        fillId = existing;
      } else {
        fillId = fills.length;
        fills.push(`<fill><patternFill patternType="solid"><fgColor rgb="${bgArgb}"/><bgColor indexed="64"/></patternFill></fill>`);
        fillKeyToIndex.set(fillKey, fillId);
      }
    }

    const numFmtId = fmt.numberFormat ? NUMFMT_ID[fmt.numberFormat] : 0;
    const align = fmt.align && fmt.align !== "left" ? ` applyAlignment="1"` : "";
    const alignTag = fmt.align && fmt.align !== "left" ? `<alignment horizontal="${fmt.align}"/>` : "";
    cellXfs.push(
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"${align}>${alignTag}</xf>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;Rp&quot;#,##0"/></numFmts>
<fonts count="${fonts.length}">${fonts.join("")}</fonts>
<fills count="${fills.length}">${fills.join("")}</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${cellXfs.length}">${cellXfs.join("")}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

export async function sheetToXlsxBlob(sheet: SheetData): Promise<Blob> {
  const values: Record<string, EvalResult> = computeSheet(sheet);
  const { keyToIndex, entries } = collectStyles(sheet);

  const rowsXml: string[] = [];
  for (let r = 0; r < sheet.rowCount; r++) {
    const cellsXml: string[] = [];
    for (let c = 0; c < sheet.colCount; c++) {
      const addr: CellAddr = { col: c, row: r };
      const key = cellKey(addr);
      const cellData = sheet.cells[key];
      if (!cellData || cellData.raw === "") continue;
      const ref = `${colIndexToLetters(c)}${r + 1}`;
      const fmt = cellData.format;
      const styleKey = fmt ? JSON.stringify([fmt.bold, fmt.italic, fmt.underline, fmt.align, fmt.numberFormat, fmt.decimals, fmt.bg, fmt.color]) : "__default__";
      const styleIndex = keyToIndex.get(styleKey) ?? 0;
      const sAttr = styleIndex ? ` s="${styleIndex}"` : "";

      const value = values[key];
      const isFormula = cellData.raw.startsWith("=");

      if (isFormula) {
        const formulaBody = escapeXml(cellData.raw.slice(1));
        if (isErrorValue(value)) {
          cellsXml.push(`<c r="${ref}"${sAttr} t="e"><f>${formulaBody}</f><v>${value.error}</v></c>`);
        } else if (typeof value === "number") {
          cellsXml.push(`<c r="${ref}"${sAttr}><f>${formulaBody}</f><v>${value}</v></c>`);
        } else if (typeof value === "boolean") {
          cellsXml.push(`<c r="${ref}"${sAttr} t="b"><f>${formulaBody}</f><v>${value ? 1 : 0}</v></c>`);
        } else {
          cellsXml.push(`<c r="${ref}"${sAttr} t="str"><f>${formulaBody}</f><v>${escapeXml(String(value ?? ""))}</v></c>`);
        }
        continue;
      }

      if (typeof value === "number") {
        cellsXml.push(`<c r="${ref}"${sAttr}><v>${value}</v></c>`);
      } else if (typeof value === "boolean") {
        cellsXml.push(`<c r="${ref}"${sAttr} t="b"><v>${value ? 1 : 0}</v></c>`);
      } else {
        const text = escapeXml(String(value ?? ""));
        cellsXml.push(`<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`);
      }
    }
    if (cellsXml.length) rowsXml.push(`<row r="${r + 1}">${cellsXml.join("")}</row>`);
  }

  const colWidthsXml = (() => {
    if (!sheet.colWidths || !Object.keys(sheet.colWidths).length) return "";
    const cols = Object.entries(sheet.colWidths)
      .map(([idx, px]) => `<col min="${Number(idx) + 1}" max="${Number(idx) + 1}" width="${Math.max(4, Math.round((px as number) / 7))}" customWidth="1"/>`)
      .join("");
    return `<cols>${cols}</cols>`;
  })();

  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheet.name || "Sheet1")}" sheetId="1" r:id="rId1"/></sheets>
<calcPr fullCalcOnLoad="1"/>
</workbook>`
  );

  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  );

  zip.file("xl/styles.xml", buildStylesXml(entries));

  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${colIndexToLetters(Math.max(0, sheet.colCount - 1))}${Math.max(1, sheet.rowCount)}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
${colWidthsXml}
<sheetData>${rowsXml.join("")}</sheetData>
</worksheet>`
  );

  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
