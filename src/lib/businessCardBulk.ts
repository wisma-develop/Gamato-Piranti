// Bulk generate Kartu Nama: parsing tabel (tempel/CSV/TSV/XLSX), pemetaan kolom → ContactData,
// lalu ekspor ZIP PNG, PDF (1 halaman per sisi), atau PDF lembar cetak (multi-up + crop marks + duplex).
// Memakai ulang mesin `renderCardSide` sehingga hasil massal IDENTIK dengan pratinjau satu kartu.

import { PDFDocument, rgb } from "pdf-lib";
import { renderCardSide, cardPixelSize } from "@/lib/businessCardEngine";
import { CONTACT_FIELD_KEYS, type CardDesign, type ContactData, type ContactField } from "@/lib/businessCardTypes";
import { canvasToBlob } from "@/lib/canvas";
import { stampGamatoBranding } from "@/lib/pdfBranding";

export const MAX_BULK_ROWS = 1000;
const MM_TO_PT = 2.834645669;
/** Penanda “sengaja kosong”: engine kartu memakai teks bawaan bila field kosong, ZWSP tidak dianggap kosong oleh trim(). */
export const BLANK = "\u200B";

// ── Parsing tabel ────────────────────────────────────────────────────────

export function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const counts: [string, number][] = [["\t", (first.match(/\t/g) || []).length], [";", (first.match(/;/g) || []).length], [",", (first.match(/,/g) || []).length], ["|", (first.match(/\|/g) || []).length]];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Parser tabel berkutip (RFC-4180-ish) dengan pemisah bebas. */
export function parseTable(text: string, delim = detectDelimiter(text)): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"' && field === "") q = true;
    else if (c === delim) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== "")).map((r) => r.map((c) => c.trim()));
}

// ── Pemetaan kolom ───────────────────────────────────────────────────────

export type ColumnMap = Record<ContactField, number | "default" | "blank">;

const ALIASES: Record<ContactField, string[]> = {
  name: ["nama", "name", "nama lengkap", "fullname", "full name", "nama karyawan"],
  title: ["jabatan", "title", "posisi", "position", "job title", "role", "profesi"],
  company: ["perusahaan", "company", "organisasi", "organization", "instansi", "kantor", "nama perusahaan"],
  phone: ["telepon", "telp", "phone", "hp", "no hp", "nomor hp", "wa", "whatsapp", "mobile", "tel", "no telepon", "nomor telepon"],
  email: ["email", "e-mail", "surel", "mail"],
  website: ["website", "web", "situs", "url", "site", "laman"],
  address: ["alamat", "address", "lokasi", "location"],
  tagline: ["tagline", "motto", "slogan", "deskripsi", "description"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function autoMap(headers: string[]): ColumnMap {
  const map = {} as ColumnMap;
  const used = new Set<number>();
  for (const f of CONTACT_FIELD_KEYS) {
    let idx = -1;
    const al = ALIASES[f];
    headers.forEach((h, i) => { if (idx < 0 && !used.has(i) && al.includes(norm(h))) idx = i; });
    if (idx < 0) headers.forEach((h, i) => { if (idx < 0 && !used.has(i) && al.some((a) => norm(h).includes(a) && a.length > 2)) idx = i; });
    if (idx >= 0) { map[f] = idx; used.add(idx); } else map[f] = f === "name" ? "blank" : "default";
  }
  return map;
}

export function buildRecords(rows: string[][], map: ColumnMap, defaults: ContactData): ContactData[] {
  return rows.slice(0, MAX_BULK_ROWS).map((r) => {
    const rec = {} as ContactData;
    for (const f of CONTACT_FIELD_KEYS) {
      const m = map[f];
      if (m === "default") rec[f] = defaults[f];
      else if (m === "blank") rec[f] = "";
      else rec[f] = (r[m] ?? "").trim();
    }
    return rec;
  });
}

/** Nilai yang dikirim ke engine: kosong → ZWSP agar tidak jatuh ke teks placeholder template. */
export function forRender(rec: ContactData): ContactData {
  const o = {} as ContactData;
  for (const f of CONTACT_FIELD_KEYS) o[f] = rec[f] && rec[f].trim() ? rec[f] : BLANK;
  return o;
}

export const SAMPLE_TABLE = `Nama\tJabatan\tPerusahaan\tTelepon\tEmail\tWebsite\tAlamat
Budi Santoso\tDirektur Utama\tPT Maju Jaya\t+62 812-1111-2222\tbudi@majujaya.co.id\twww.majujaya.co.id\tJl. Sudirman No. 1, Jakarta
Siti Rahma\tManajer Pemasaran\tPT Maju Jaya\t+62 813-3333-4444\tsiti@majujaya.co.id\twww.majujaya.co.id\tJl. Sudirman No. 1, Jakarta
Agus Wijaya\tSenior Developer\tPT Maju Jaya\t+62 857-5555-6666\tagus@majujaya.co.id\twww.majujaya.co.id\tJl. Sudirman No. 1, Jakarta
Dewi Lestari\tFinance Officer\tPT Maju Jaya\t\tdewi@majujaya.co.id\twww.majujaya.co.id\tJl. Sudirman No. 1, Jakarta`;

export function csvTemplate(): string {
  return "Nama,Jabatan,Perusahaan,Telepon,Email,Website,Alamat,Tagline\n\"Nama Lengkap\",\"Jabatan\",\"Nama Perusahaan\",\"+62 812-0000-0000\",\"nama@email.com\",\"www.website.com\",\"Kota, Indonesia\",\"Tagline singkat\"\n";
}

// ── vCard ────────────────────────────────────────────────────────────────

const vEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function toVcf(records: ContactData[]): string {
  return records.map((r) => {
    const parts = r.name.trim().split(/\s+/);
    const last = parts.length > 1 ? parts[parts.length - 1] : "";
    const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "";
    const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${vEsc(last)};${vEsc(first)};;;`, `FN:${vEsc(r.name || "-")}`];
    if (r.company) lines.push(`ORG:${vEsc(r.company)}`);
    if (r.title) lines.push(`TITLE:${vEsc(r.title)}`);
    if (r.phone) lines.push(`TEL;TYPE=CELL:${vEsc(r.phone)}`);
    if (r.email) lines.push(`EMAIL;TYPE=INTERNET:${vEsc(r.email)}`);
    if (r.website) lines.push(`URL:${vEsc(r.website)}`);
    if (r.address) lines.push(`ADR;TYPE=WORK:;;${vEsc(r.address)};;;;`);
    if (r.tagline) lines.push(`NOTE:${vEsc(r.tagline)}`);
    lines.push("END:VCARD");
    return lines.join("\r\n");
  }).join("\r\n") + "\r\n";
}

// ── Tata letak lembar cetak ──────────────────────────────────────────────

export type SheetPaper = "a4" | "letter" | "a3";
const PAPER_MM: Record<SheetPaper, [number, number]> = { a4: [210, 297], letter: [215.9, 279.4], a3: [297, 420] };

export interface SheetLayout { cols: number; rows: number; perPage: number; x0: number; y0: number; pageW: number; pageH: number; cw: number; ch: number; gap: number }

/** Semua satuan mm. Grid dipusatkan pada halaman. */
export function sheetLayout(cardW: number, cardH: number, paper: SheetPaper, landscape: boolean, margin: number, gap: number): SheetLayout {
  let [pw, ph] = PAPER_MM[paper];
  if (landscape) [pw, ph] = [ph, pw];
  const cols = Math.max(0, Math.floor((pw - 2 * margin + gap) / (cardW + gap)));
  const rows = Math.max(0, Math.floor((ph - 2 * margin + gap) / (cardH + gap)));
  const gw = cols * cardW + Math.max(0, cols - 1) * gap;
  const gh = rows * cardH + Math.max(0, rows - 1) * gap;
  return { cols, rows, perPage: cols * rows, x0: (pw - gw) / 2, y0: (ph - gh) / 2, pageW: pw, pageH: ph, cw: cardW, ch: cardH, gap };
}

// ── Ekspor ───────────────────────────────────────────────────────────────

export interface BulkProgress { done: number; total: number; message?: string }
export interface BulkCommon {
  design: CardDesign;
  records: ContactData[];
  sides: "front" | "both";
  cache: Map<string, HTMLImageElement>;
  signal?: { cancelled: boolean };
  onProgress?: (p: BulkProgress) => void;
}
export class BulkCancelled extends Error { constructor() { super("Dibatalkan."); } }

async function renderPng(design: CardDesign, side: "front" | "back", rec: ContactData, cache: Map<string, HTMLImageElement>, canvas: HTMLCanvasElement): Promise<Uint8Array> {
  await renderCardSide(canvas, design[side], forRender(rec), design, cache);
  const blob = await canvasToBlob(canvas);
  return new Uint8Array(await blob.arrayBuffer());
}

const slug = (s: string) => (s || "kartu").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "kartu";

function steps(o: BulkCommon) { return o.records.length * (o.sides === "both" ? 2 : 1); }

export async function exportBulkZip(o: BulkCommon): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const canvas = document.createElement("canvas");
  const total = steps(o);
  let done = 0;
  const pad = Math.max(3, String(o.records.length).length);
  for (let i = 0; i < o.records.length; i++) {
    for (const side of (o.sides === "both" ? ["front", "back"] : ["front"]) as ("front" | "back")[]) {
      if (o.signal?.cancelled) throw new BulkCancelled();
      const png = await renderPng(o.design, side, o.records[i], o.cache, canvas);
      zip.file(`${String(i + 1).padStart(pad, "0")}-${slug(o.records[i].name)}${o.sides === "both" ? (side === "front" ? "-depan" : "-belakang") : ""}.png`, png, { compression: "STORE" });
      o.onProgress?.({ done: ++done, total });
    }
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

/** PDF: satu halaman per sisi dengan ukuran halaman = ukuran kartu. */
export async function exportBulkPdf(o: BulkCommon): Promise<Blob> {
  const { wMM, hMM } = cardPixelSize(o.design);
  const wPt = wMM * MM_TO_PT, hPt = hMM * MM_TO_PT;
  const pdf = await PDFDocument.create();
  const canvas = document.createElement("canvas");
  const total = steps(o);
  let done = 0;
  for (let i = 0; i < o.records.length; i++) {
    for (const side of (o.sides === "both" ? ["front", "back"] : ["front"]) as ("front" | "back")[]) {
      if (o.signal?.cancelled) throw new BulkCancelled();
      const img = await pdf.embedPng(await renderPng(o.design, side, o.records[i], o.cache, canvas));
      pdf.addPage([wPt, hPt]).drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
      o.onProgress?.({ done: ++done, total });
    }
  }
  await stampGamatoBranding(pdf, { firstPageOnly: true });
  return new Blob([await pdf.save()] as BlobPart[], { type: "application/pdf" });
}

export interface SheetOptions { paper: SheetPaper; landscape: boolean; marginMm: number; gapMm: number; cropMarks: boolean; duplexMirror: boolean }

export async function exportBulkSheet(o: BulkCommon & { sheet: SheetOptions }): Promise<{ blob: Blob; pages: number; perPage: number }> {
  const { wMM, hMM } = cardPixelSize(o.design);
  const L = sheetLayout(wMM, hMM, o.sheet.paper, o.sheet.landscape, o.sheet.marginMm, o.sheet.gapMm);
  if (L.perPage < 1) throw new Error("Kartu tidak muat di halaman dengan margin/ukuran ini — kecilkan margin atau pilih kertas lebih besar.");
  const pdf = await PDFDocument.create();
  const canvas = document.createElement("canvas");
  const total = steps(o);
  let done = 0;
  let pages = 0;
  const pageW = L.pageW * MM_TO_PT, pageH = L.pageH * MM_TO_PT;
  const cw = wMM * MM_TO_PT, ch = hMM * MM_TO_PT;
  const marks = (page: ReturnType<PDFDocument["addPage"]>, x: number, y: number) => {
    const off = 1 * MM_TO_PT, len = Math.min(3, Math.max(1.5, L.gap * 0.7 || 2)) * MM_TO_PT;
    const c = rgb(0.25, 0.25, 0.25);
    for (const [cx, cyy, sx, sy] of [[x, y, -1, -1], [x + cw, y, 1, -1], [x, y + ch, -1, 1], [x + cw, y + ch, 1, 1]] as const) {
      page.drawLine({ start: { x: cx + sx * off, y: cyy }, end: { x: cx + sx * (off + len), y: cyy }, thickness: 0.4, color: c });
      page.drawLine({ start: { x: cx, y: cyy + sy * off }, end: { x: cx, y: cyy + sy * (off + len) }, thickness: 0.4, color: c });
    }
  };
  const place = async (side: "front" | "back", recs: ContactData[], mirror: boolean) => {
    const page = pdf.addPage([pageW, pageH]);
    pages++;
    for (let k = 0; k < recs.length; k++) {
      if (o.signal?.cancelled) throw new BulkCancelled();
      const img = await pdf.embedPng(await renderPng(o.design, side, recs[k], o.cache, canvas));
      let col = k % L.cols;
      const row = Math.floor(k / L.cols);
      if (mirror) col = L.cols - 1 - col;
      const x = (L.x0 + col * (wMM + L.gap)) * MM_TO_PT;
      const yTop = (L.y0 + row * (hMM + L.gap)) * MM_TO_PT;
      const y = pageH - yTop - ch;
      page.drawImage(img, { x, y, width: cw, height: ch });
      if (o.sheet.cropMarks) marks(page, x, y);
      o.onProgress?.({ done: ++done, total });
    }
  };
  for (let s = 0; s < o.records.length; s += L.perPage) {
    const chunk = o.records.slice(s, s + L.perPage);
    await place("front", chunk, false);
    if (o.sides === "both") await place("back", chunk, o.sheet.duplexMirror);
  }
  await stampGamatoBranding(pdf, { firstPageOnly: true });
  return { blob: new Blob([await pdf.save()] as BlobPart[], { type: "application/pdf" }), pages, perPage: L.perPage };
}
