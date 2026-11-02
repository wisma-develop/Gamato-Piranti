// Render .xlsx / .csv → halaman gambar (A4 lanskap). Mendukung: lebar kolom & tinggi baris, warna isi sel, font (tebal/miring/
// warna/ukuran), garis sel, perataan, bungkus teks, sel gabungan, format angka/persen/tanggal umum, banyak lembar.
// Tabel lebar otomatis diperkecil agar muat 1 halaman (minimal 55%), sisanya dipecah ke halaman berikutnya.

import JSZip from "jszip";
import {
  attr, child, childEls, cssFamily, defaultParaFmt, defaultStyle, descendants, emitLine, hexColor, hslAdjust, layoutParagraph, paraHeight, parseXml,
  type Op, type RasterDoc, type RasterPage, type RunStyle,
} from "./core";

interface XFont { b: boolean; i: boolean; u: boolean; strike: boolean; color?: string; sz: number; name: string }
interface XBorder { l?: string; r?: string; t?: string; b?: string }
interface XXf { numFmtId: number; font: XFont; fill?: string; border: XBorder; h?: string; v?: string; wrap: boolean; indent: number }

const INDEXED = ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#800000", "#008000", "#000080", "#808000", "#800080", "#008080", "#c0c0c0", "#808080"];
const THEME_ORDER = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const colIndex = (ref: string) => {
  const m = /^([A-Z]+)(\d+)$/i.exec(ref);
  if (!m) return { c: 0, r: 0 };
  let c = 0;
  for (const ch of m[1].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { c: c - 1, r: parseInt(m[2], 10) - 1 };
};

function formatDate(serial: number, code: string): string {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  const parts = code.replace(/\[[^\]]*\]/g, "").replace(/"([^"]*)"/g, "\u0001$1\u0002");
  const toks: { t: string; lit: boolean }[] = [];
  const re = /(yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|AM\/PM|A\/P)|(\u0001[^\u0002]*\u0002)|([\s\S])/gi;
  for (const m of parts.matchAll(re)) toks.push(m[1] ? { t: m[1], lit: false } : { t: (m[2] ?? m[3]).replace(/[\u0001\u0002]/g, ""), lit: true });
  const hasAmPm = toks.some((x) => /am\/pm|a\/p/i.test(x.t));
  const p2 = (v: number) => String(v).padStart(2, "0");
  const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return toks.map((x, i) => {
    if (x.lit) return x.t;
    const k = x.t.toLowerCase();
    if (k === "yyyy") return String(d.getUTCFullYear());
    if (k === "yy") return p2(d.getUTCFullYear() % 100);
    if (k === "mmmm") return MONTHS[d.getUTCMonth()];
    if (k === "mmm") return MONTHS[d.getUTCMonth()].slice(0, 3);
    if (k === "dddd") return DAYS[d.getUTCDay()];
    if (k === "ddd") return DAYS[d.getUTCDay()].slice(0, 3);
    if (k === "dd") return p2(d.getUTCDate());
    if (k === "d") return String(d.getUTCDate());
    if (k === "hh" || k === "h") { const hh = hasAmPm ? d.getUTCHours() % 12 || 12 : d.getUTCHours(); return k === "hh" ? p2(hh) : String(hh); }
    if (k === "ss" || k === "s") return k === "ss" ? p2(d.getUTCSeconds()) : String(d.getUTCSeconds());
    if (k === "am/pm") return d.getUTCHours() < 12 ? "AM" : "PM";
    if (k === "a/p") return d.getUTCHours() < 12 ? "A" : "P";
    if (k === "mm" || k === "m") {
      // menit bila berdekatan dengan jam/detik, jika tidak → bulan
      const prev = toks.slice(0, i).reverse().find((y) => !y.lit);
      const next = toks.slice(i + 1).find((y) => !y.lit);
      const isMin = (prev && /^h/i.test(prev.t)) || (next && /^s/i.test(next.t));
      if (isMin) return k === "mm" ? p2(d.getUTCMinutes()) : String(d.getUTCMinutes());
      return k === "mm" ? p2(d.getUTCMonth() + 1) : String(d.getUTCMonth() + 1);
    }
    return x.t;
  }).join("");
}

const BUILTIN_DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const BUILTIN: Record<number, string> = { 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 14: "dd/mm/yyyy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM", 19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss", 22: "dd/mm/yyyy h:mm", 37: "#,##0;(#,##0)", 38: "#,##0;(#,##0)", 39: "#,##0.00;(#,##0.00)", 40: "#,##0.00;(#,##0.00)", 45: "mm:ss", 46: "[h]:mm:ss", 47: "mm:ss.0" };

function formatNumber(v: number, id: number, code: string | undefined): string {
  const c = code ?? BUILTIN[id];
  if (!c || /^general$/i.test(c)) return Number.isInteger(v) ? v.toLocaleString("id-ID", { useGrouping: false, maximumFractionDigits: 0 }) : String(+v.toPrecision(11)).replace(".", ",");
  const isDate = BUILTIN_DATE_IDS.has(id) || (/[ymdhs]/i.test(c.replace(/"[^"]*"|\[[^\]]*\]|\\./g, "")) && !/^[#0?,.%\s]*$/.test(c));
  if (isDate && v >= 0) return formatDate(v, c);
  const sections = c.split(";");
  let sec = sections[0];
  if (v < 0 && sections[1]) sec = sections[1];
  else if (v === 0 && sections[2]) sec = sections[2];
  const neg = v < 0 && !sections[1];
  const clean = sec.replace(/\[[^\]]*\]/g, "").replace(/_.|\*./g, " ");
  const lits: string[] = [];
  const masked = clean.replace(/"([^"]*)"|\\(.)/g, (_m, a, b) => { lits.push(a ?? b); return String.fromCharCode(0xe000 + lits.length - 1); });
  const m = /^([^#0?]*)([#0?,.]+)(%?)(.*)$/s.exec(masked);
  if (!m) return String(v);
  const restore = (s: string) => s.replace(/[\ue000-\uf8ff]/g, (ch) => lits[ch.charCodeAt(0) - 0xe000] ?? "");
  const pct = m[3] === "%" || /%/.test(m[4]);
  let x = Math.abs(v) * (pct ? 100 : 1);
  const dec = (m[2].split(".")[1] ?? "").replace(/,/g, "").length;
  const grouping = /,/.test(m[2].split(".")[0]);
  const body = x.toLocaleString("id-ID", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: grouping });
  void x;
  return `${neg ? "-" : ""}${restore(m[1])}${body}${pct ? "%" : ""}${restore(m[4].replace(/%/g, ""))}`;
}

interface Cell { r: number; c: number; text: string; xf: XXf; num: boolean }
interface SheetData { name: string; cells: Map<string, Cell>; colW: number[]; rowH: Map<number, number>; customH: Set<number>; merges: { r1: number; c1: number; r2: number; c2: number }[]; maxR: number; maxC: number; hiddenRows: Set<number>; hiddenCols: Set<number> }

export async function renderXlsx(file: File, opts: { gridlines?: boolean } = {}): Promise<RasterDoc> {
  const zip = await JSZip.loadAsync(file);
  const wbXml = await zip.file("xl/workbook.xml")?.async("text");
  if (!wbXml) throw new Error("Bukan file .xlsx yang valid (xl/workbook.xml tidak ditemukan).");
  const notes: string[] = [];
  const rels = new Map<string, string>();
  const relXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  if (relXml) for (const r of descendants(parseXml(relXml), "Relationship")) { let t = r.getAttribute("Target") || ""; t = t.startsWith("/") ? t.slice(1) : `xl/${t.replace(/^\.\//, "")}`; rels.set(r.getAttribute("Id") || "", t); }

  // tema
  const theme = new Map<string, string>();
  const thXml = await zip.file("xl/theme/theme1.xml")?.async("text");
  if (thXml) {
    const cs = descendants(parseXml(thXml), "clrScheme")[0];
    for (const c of Array.from(cs?.children ?? [])) { const v = c.firstElementChild; theme.set(c.localName, hexColor(v?.localName === "sysClr" ? attr(v, "lastClr") : attr(v, "val"), "#000000")); }
  }
  const colorOf = (el: Element | null): string | undefined => {
    if (!el) return undefined;
    const rgb = attr(el, "rgb");
    if (rgb) return hexColor(rgb.slice(-6), "#000000");
    const th = attr(el, "theme");
    if (th !== null) {
      let hex = theme.get(THEME_ORDER[Number(th)] ?? "dk1") ?? "#000000";
      const tint = Number(attr(el, "tint") ?? 0);
      if (tint) hex = tint > 0 ? hslAdjust(hex, 1 - tint, tint) : hslAdjust(hex, 1 + tint, 0);
      return hex;
    }
    const ix = attr(el, "indexed");
    if (ix !== null) return INDEXED[Number(ix)] ?? "#000000";
    return undefined;
  };

  // gaya
  const numFmts = new Map<number, string>();
  const fonts: XFont[] = [];
  const fills: (string | undefined)[] = [];
  const borders: XBorder[] = [];
  const xfs: XXf[] = [];
  const stXml = await zip.file("xl/styles.xml")?.async("text");
  if (stXml) {
    const st = parseXml(stXml);
    for (const nf of descendants(st, "numFmt")) numFmts.set(Number(attr(nf, "numFmtId")), attr(nf, "formatCode") || "");
    for (const f of childEls(descendants(st, "fonts")[0] ?? null, "font")) {
      fonts.push({ b: !!child(f, "b") && attr(child(f, "b"), "val") !== "0", i: !!child(f, "i") && attr(child(f, "i"), "val") !== "0", u: !!child(f, "u"), strike: !!child(f, "strike"), color: colorOf(child(f, "color")), sz: Number(attr(child(f, "sz"), "val") ?? 11), name: attr(child(f, "name"), "val") ?? "Calibri" });
    }
    for (const f of childEls(descendants(st, "fills")[0] ?? null, "fill")) {
      const pf = child(f, "patternFill");
      const type = attr(pf, "patternType");
      fills.push(type && type !== "none" ? colorOf(child(pf, "fgColor")) ?? (type === "solid" ? "#ffffff" : undefined) : undefined);
    }
    for (const b of childEls(descendants(st, "borders")[0] ?? null, "border")) {
      const side = (name: string) => { const e = child(b, name); return e && attr(e, "style") ? colorOf(child(e, "color")) ?? "#000000" : undefined; };
      borders.push({ l: side("left"), r: side("right"), t: side("top"), b: side("bottom") });
    }
    for (const x of childEls(descendants(st, "cellXfs")[0] ?? null, "xf")) {
      const al = child(x, "alignment");
      xfs.push({
        numFmtId: Number(attr(x, "numFmtId") ?? 0), font: fonts[Number(attr(x, "fontId") ?? 0)] ?? { b: false, i: false, u: false, strike: false, sz: 11, name: "Calibri" },
        fill: fills[Number(attr(x, "fillId") ?? 0)], border: borders[Number(attr(x, "borderId") ?? 0)] ?? {},
        h: attr(al, "horizontal") ?? undefined, v: attr(al, "vertical") ?? undefined, wrap: attr(al, "wrapText") === "1", indent: Number(attr(al, "indent") ?? 0),
      });
    }
  }
  const defaultXf: XXf = { numFmtId: 0, font: { b: false, i: false, u: false, strike: false, sz: 11, name: "Calibri" }, border: {}, wrap: false, indent: 0 };

  // shared strings
  const sst: string[] = [];
  const ssXml = await zip.file("xl/sharedStrings.xml")?.async("text");
  if (ssXml) for (const si of descendants(parseXml(ssXml), "si")) sst.push(Array.from(si.getElementsByTagNameNS("*", "t")).filter((t) => t.parentElement?.localName !== "rPh").map((t) => t.textContent || "").join(""));

  // lembar
  const sheets: SheetData[] = [];
  for (const s of descendants(parseXml(wbXml), "sheet")) {
    if (attr(s, "state") === "hidden" || attr(s, "state") === "veryHidden") continue;
    const rid = [...Array.from(s.attributes)].find((a) => a.localName === "id" && a.prefix === "r")?.value;
    const path = rid ? rels.get(rid) : undefined;
    const xml = path ? await zip.file(path)?.async("text") : null;
    if (!xml) continue;
    const doc = parseXml(xml);
    const colW: number[] = [];
    const hiddenCols = new Set<number>();
    const defCol = Number(attr(descendants(doc, "sheetFormatPr")[0] ?? null, "defaultColWidth") ?? 8.43);
    const defRow = Number(attr(descendants(doc, "sheetFormatPr")[0] ?? null, "defaultRowHeight") ?? 15);
    const toPt = (chars: number) => (Math.trunc(((256 * chars + Math.trunc(128 / 7)) / 256) * 7) + 0) * 0.75;
    for (const c of descendants(doc, "col")) {
      const min = Number(attr(c, "min")), max = Math.min(Number(attr(c, "max")), 300);
      const w = Number(attr(c, "width") ?? defCol);
      for (let i = min - 1; i < max; i++) { colW[i] = toPt(w); if (attr(c, "hidden") === "1") hiddenCols.add(i); }
    }
    const rowH = new Map<number, number>(), customH = new Set<number>(), hiddenRows = new Set<number>();
    const cells = new Map<string, Cell>();
    let maxR = -1, maxC = -1;
    for (const row of descendants(doc, "row")) {
      const ri = Number(attr(row, "r")) - 1;
      if (attr(row, "ht")) { rowH.set(ri, Number(attr(row, "ht"))); if (attr(row, "customHeight") === "1") customH.add(ri); }
      if (attr(row, "hidden") === "1") hiddenRows.add(ri);
      for (const c of childEls(row, "c")) {
        const ref = attr(c, "r") || "";
        const { c: ci, r } = colIndex(ref);
        const xf = xfs[Number(attr(c, "s") ?? 0)] ?? defaultXf;
        const t = attr(c, "t");
        const v = child(c, "v")?.textContent ?? "";
        let text = "", isNum = false;
        if (t === "s") text = sst[Number(v)] ?? "";
        else if (t === "inlineStr") text = Array.from(c.getElementsByTagNameNS("*", "t")).map((x) => x.textContent || "").join("");
        else if (t === "b") text = v === "1" ? "TRUE" : "FALSE";
        else if (t === "e") text = v;
        else if (t === "str") text = v;
        else if (v !== "") { const num = Number(v); if (isFinite(num)) { text = formatNumber(num, xf.numFmtId, numFmts.get(xf.numFmtId)); isNum = true; } else text = v; }
        const hasVisual = text !== "" || xf.fill || xf.border.l || xf.border.r || xf.border.t || xf.border.b;
        if (hasVisual) {
          cells.set(`${r}:${ci}`, { r, c: ci, text, xf, num: isNum });
          if (text !== "" || xf.fill) { maxR = Math.max(maxR, r); maxC = Math.max(maxC, ci); }
        }
      }
    }
    const merges = descendants(doc, "mergeCell").map((m) => { const [a, b] = (attr(m, "ref") || "A1").split(":"); const p = colIndex(a), q = colIndex(b ?? a); return { r1: p.r, c1: p.c, r2: q.r, c2: q.c }; });
    for (const m of merges) { maxR = Math.max(maxR, m.r2); maxC = Math.max(maxC, m.c2); }
    for (let i = 0; i <= Math.min(maxC, 300); i++) if (colW[i] === undefined) colW[i] = toPt(defCol);
    (colW as any)._defRow = defRow;
    sheets.push({ name: attr(s, "name") || `Sheet${sheets.length + 1}`, cells, colW, rowH, customH, merges, maxR, maxC, hiddenRows, hiddenCols });
    if (descendants(doc, "drawing").length || descendants(doc, "legacyDrawing").length) notes.push("Grafik, gambar, dan objek lain di dalam lembar tidak ikut dirender (hanya isi sel).");
  }
  if (!sheets.length) throw new Error("Tidak ada lembar yang bisa dibaca.");
  const pages = layoutSheets(sheets, opts.gridlines ?? true, notes);
  return { pages, notes: Array.from(new Set(notes)) };
}

export async function renderCsv(file: File, opts: { gridlines?: boolean } = {}): Promise<RasterDoc> {
  let text = await file.text();
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delim = (text.split(/\r?\n/, 1)[0].match(/\t/g)?.length ?? 0) > (text.split(/\r?\n/, 1)[0].match(/[,;]/g)?.length ?? 0) ? "\t" : (text.split(/\r?\n/, 1)[0].match(/;/g)?.length ?? 0) > (text.split(/\r?\n/, 1)[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  if (!rows.length) throw new Error("File CSV kosong.");
  const cols = Math.min(60, Math.max(...rows.map((r) => r.length)));
  const cells = new Map<string, Cell>();
  const widths: number[] = Array.from({ length: cols }, () => 40);
  const hdr: XXf = { ...{ numFmtId: 0, font: { b: true, i: false, u: false, strike: false, sz: 11, name: "Calibri" }, border: {}, wrap: false, indent: 0 }, fill: "#e5e7eb" };
  const plain: XXf = { numFmtId: 0, font: { b: false, i: false, u: false, strike: false, sz: 11, name: "Calibri" }, border: {}, wrap: false, indent: 0 };
  const meas = defaultStyle({ size: 11 });
  void meas;
  const canvas = document.createElement("canvas").getContext("2d")!;
  rows.slice(0, 5000).forEach((r, ri) => r.slice(0, cols).forEach((v, ci) => {
    const isNum = /^-?\d+([.,]\d+)?$/.test(v.trim());
    cells.set(`${ri}:${ci}`, { r: ri, c: ci, text: v, xf: ri === 0 ? hdr : plain, num: isNum });
    canvas.font = `${ri === 0 ? "700 " : ""}11px Calibri, Arial, sans-serif`;
    widths[ci] = Math.min(220, Math.max(widths[ci], canvas.measureText(v).width * 0.75 + 12));
  }));
  const sheet: SheetData = { name: file.name, cells, colW: widths, rowH: new Map(), customH: new Set(), merges: [], maxR: Math.min(rows.length, 5000) - 1, maxC: cols - 1, hiddenRows: new Set(), hiddenCols: new Set() };
  (sheet.colW as any)._defRow = 15;
  const notes: string[] = [];
  if (rows.length > 5000) notes.push("CSV dipotong pada 5.000 baris pertama.");
  return { pages: layoutSheets([sheet], opts.gridlines ?? true, notes, true), notes };
}

function layoutSheets(sheets: SheetData[], gridlines: boolean, notes: string[], single = false): RasterPage[] {
  const PW = 841.89, PH = 595.28, M = 28;
  const pages: RasterPage[] = [];
  const baseFont = cssFamily("Calibri");
  for (const sh of sheets) {
    const defRow = (sh.colW as any)._defRow ?? 15;
    const maxC = Math.min(sh.maxC, 299), maxR = Math.min(sh.maxR, 20000);
    if (sh.maxR < 0 || sh.maxC < 0) { continue; }
    if (sh.maxR > 20000) notes.push(`Lembar "${sh.name}" dipotong pada 20.000 baris pertama.`);
    const cols: number[] = [];
    for (let c = 0; c <= maxC; c++) if (!sh.hiddenCols.has(c)) cols.push(c);
    // Angka/tanggal yang tidak muat di kolomnya diperlebar (maks. +60%) agar tidak terpotong di gambar.
    {
      const mc = document.createElement("canvas").getContext("2d")!;
      for (const c of cols) {
        let need = 0;
        for (let r = 0; r <= maxR; r++) {
          const cell = sh.cells.get(`${r}:${c}`);
          if (!cell || !cell.text || cell.xf.wrap) continue;
          if (!cell.num && !/^\d{1,2}[ \/-]\w+[ \/-]\d{2,4}/.test(cell.text)) continue;
          mc.font = `${cell.xf.font.b ? "700 " : ""}${cell.xf.font.sz}px ${cssFamily(cell.xf.font.name)}`;
          need = Math.max(need, mc.measureText(cell.text).width + 8);
        }
        if (need > sh.colW[c]) sh.colW[c] = Math.min(need, sh.colW[c] * 1.6, 220);
      }
    }
    const contentW = PW - M * 2;
    const totalW = cols.reduce((a, c) => a + sh.colW[c], 0);
    const scale = totalW <= contentW ? 1 : Math.max(0.55, contentW / totalW);
    // pecah kolom ke beberapa "pita" bila tetap tidak muat
    const bands: number[][] = [];
    let band: number[] = [], bw = 0;
    for (const c of cols) {
      const w = sh.colW[c] * scale;
      if (band.length && bw + w > contentW + 0.5) { bands.push(band); band = []; bw = 0; }
      band.push(c); bw += w;
    }
    if (band.length) bands.push(band);

    // tinggi baris (dengan bungkus teks)
    const mergedAt = new Map<string, (typeof sh.merges)[0]>();
    const covered = new Set<string>();
    for (const m of sh.merges) { mergedAt.set(`${m.r1}:${m.c1}`, m); for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) covered.add(`${r}:${c}`); }
    const styleFor = (cell: Cell): RunStyle => defaultStyle({ size: cell.xf.font.sz, bold: cell.xf.font.b, italic: cell.xf.font.i, underline: cell.xf.font.u, strike: cell.xf.font.strike, color: cell.xf.font.color ?? "#000000", font: cssFamily(cell.xf.font.name || "Calibri") || baseFont });
    const rowHeights: number[] = [];
    for (let r = 0; r <= maxR; r++) {
      if (sh.hiddenRows.has(r)) { rowHeights.push(0); continue; }
      let h = sh.rowH.get(r) ?? defRow;
      if (!sh.customH.has(r)) {
        for (const c of cols) {
          const cell = sh.cells.get(`${r}:${c}`);
          if (cell && cell.xf.wrap && cell.text && !covered.has(`${r}:${c}`) && !mergedAt.has(`${r}:${c}`)) {
            const lay = layoutParagraph([{ kind: "text", text: cell.text, style: styleFor(cell) }], defaultParaFmt({ spaceAfter: 0, lineMult: 1.0 }), Math.max(10, sh.colW[c] - 6));
            h = Math.max(h, paraHeight(lay, false) + 3);
          }
        }
      }
      rowHeights.push(h);
    }

    for (let bi = 0; bi < bands.length; bi++) {
      const bandCols = bands[bi];
      const headerH = single ? 0 : 16;
      const bandStart = pages.length;
      let cur: RasterPage = { w: PW, h: PH, bg: "#ffffff", ops: [] };
      let y = M + headerH;
      const bottom = PH - M;
      const title = () => { if (!single) cur.ops.push({ t: "text", x: M, y: M + 9, text: `${sh.name}${bands.length > 1 ? ` — bagian ${bi + 1}/${bands.length}` : ""}`, style: defaultStyle({ size: 9.5, bold: true, color: "#6b7280" }), w: 200 }); };
      title();
      const bx0: number[] = [];
      let xx = M;
      for (const c of bandCols) { bx0.push(xx); xx += sh.colW[c] * scale; }
      const bandW = xx - M;
      for (let r = 0; r <= maxR; r++) {
        const rh = rowHeights[r] * scale;
        if (rh === 0) continue;
        if (y + rh > bottom && y > M + headerH + 1) { pages.push(cur); cur = { w: PW, h: PH, bg: "#ffffff", ops: [] }; y = M + headerH; title(); }
        bandCols.forEach((c, k) => {
          const key = `${r}:${c}`;
          if (covered.has(key)) return;
          const cell = sh.cells.get(key);
          let cw = sh.colW[c] * scale;
          let ch = rh;
          const mg = mergedAt.get(key);
          if (mg) { cw = 0; for (let cc = mg.c1; cc <= mg.c2; cc++) if (bandCols.includes(cc)) cw += sh.colW[cc] * scale; ch = 0; for (let rr = mg.r1; rr <= mg.r2; rr++) ch += (rowHeights[rr] ?? defRow) * scale; }
          const x = bx0[k];
          if (cell?.xf.fill) cur.ops.push({ t: "rect", x, y, w: cw, h: ch, fill: cell.xf.fill });
          if (gridlines) {
            cur.ops.push({ t: "line", x1: x, y1: y + ch, x2: x + cw, y2: y + ch, color: "#e2e5ea", lw: 0.5 });
            cur.ops.push({ t: "line", x1: x + cw, y1: y, x2: x + cw, y2: y + ch, color: "#e2e5ea", lw: 0.5 });
          }
          if (cell) {
            const b = cell.xf.border;
            if (b.t) cur.ops.push({ t: "line", x1: x, y1: y, x2: x + cw, y2: y, color: b.t, lw: 0.8 });
            if (b.b) cur.ops.push({ t: "line", x1: x, y1: y + ch, x2: x + cw, y2: y + ch, color: b.b, lw: 0.8 });
            if (b.l) cur.ops.push({ t: "line", x1: x, y1: y, x2: x, y2: y + ch, color: b.l, lw: 0.8 });
            if (b.r) cur.ops.push({ t: "line", x1: x + cw, y1: y, x2: x + cw, y2: y + ch, color: b.r, lw: 0.8 });
            if (cell.text) {
              const st = styleFor(cell);
              const s2: RunStyle = { ...st, size: st.size * scale };
              const hAlign = cell.xf.h ?? (cell.num ? "right" : "left");
              const pad = 3 * scale + cell.xf.indent * 6 * scale;
              const sub: Op[] = [];
              if (cell.xf.wrap) {
                const lay = layoutParagraph([{ kind: "text", text: cell.text, style: s2 }], defaultParaFmt({ spaceAfter: 0, lineMult: 1.0, align: hAlign === "center" ? "center" : hAlign === "right" ? "right" : "left" }), Math.max(8, cw - pad * 2));
                const th = paraHeight(lay, false);
                let ty = y + 1.5 * scale;
                if (cell.xf.v === "center") ty = y + (ch - th) / 2; else if (cell.xf.v === "bottom" || !cell.xf.v) ty = y + ch - th - 1.5 * scale;
                for (const ln of lay.lines) { emitLine(sub, ln, x + pad, ty); ty += ln.h; }
              } else {
                const lay = layoutParagraph([{ kind: "text", text: cell.text.replace(/\s*[\r\n]+\s*/g, " "), style: s2 }], defaultParaFmt({ spaceAfter: 0, lineMult: 1.0 }), 100000);
                const w = lay.lines[0]?.items.reduce((a, i) => a + i.w, 0) ?? 0;
                let tx = x + pad;
                if (hAlign === "center") tx = x + (cw - w) / 2; else if (hAlign === "right") tx = x + cw - w - pad;
                const lineH = lay.lines[0]?.h ?? s2.size * 1.2;
                let ty = y + ch - lineH - 1 * scale;
                if (cell.xf.v === "center") ty = y + (ch - lineH) / 2; else if (cell.xf.v === "top") ty = y + 1;
                for (const ln of lay.lines) { emitLine(sub, ln, tx - 0, ty); }
                // luapan teks ke sel kosong di kanan (rata kiri, bukan angka)
                let avail = cw;
                if (hAlign === "left" && !cell.num && !mg) { for (let kk = k + 1; kk < bandCols.length; kk++) { if (sh.cells.get(`${r}:${bandCols[kk]}`)?.text) break; avail += sh.colW[bandCols[kk]] * scale; } }
                cur.ops.push({ t: "clip", x, y, w: Math.max(cw, w + pad * 2 > cw ? Math.min(avail, w + pad * 2) : cw), h: ch, ops: sub });
                return;
              }
              cur.ops.push({ t: "clip", x, y, w: cw, h: ch, ops: sub });
            }
          }
        });
        y += rh;
      }
      // garis tepi kiri/atas tabel bila gridlines
      if (gridlines) {
        cur.ops.push({ t: "line", x1: M, y1: M + headerH, x2: M, y2: y, color: "#e2e5ea", lw: 0.5 });
        cur.ops.push({ t: "line", x1: M, y1: M + headerH, x2: M + bandW, y2: M + headerH, color: "#e2e5ea", lw: 0.5 });
      }
      pages.push(cur);
      // Untuk gambar, kertas dipangkas sepanjang isi (bukan seluruh A4) → tidak ada ruang putih berlebih.
      const tightW = Math.max(240, bandW + M * 2);
      for (let pi = bandStart; pi < pages.length; pi++) {
        pages[pi].w = tightW;
        if (pages.length - bandStart === 1) pages[pi].h = Math.max(120, y + M);
      }
    }
  }
  if (!pages.length) pages.push({ w: PW, h: PH, bg: "#ffffff", ops: [{ t: "text", x: M, y: M + 20, text: "(Lembar kosong)", style: defaultStyle({ size: 14, color: "#9ca3af" }), w: 120 }] });
  return pages;
}
