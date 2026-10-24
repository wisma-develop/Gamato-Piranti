// Model data & utilitas untuk Surat Generator (Spesial > Pembuat Surat).
// Dipisah dari mesin gambar (letterEngine.ts) dan ekspor DOCX (letterDocx.ts) supaya UI,
// template, dan ekspor memakai definisi yang sama.

import { formatDateID, todayISODate } from "@/lib/dateFormat";

export type PaperId = "a4" | "f4" | "letter" | "legal" | "a5";
export interface PaperSpec { id: PaperId; label: string; wMM: number; hMM: number }
export const PAPERS: PaperSpec[] = [
  { id: "a4", label: "A4 (210 × 297 mm)", wMM: 210, hMM: 297 },
  { id: "f4", label: "F4 / Folio (215 × 330 mm)", wMM: 215, hMM: 330 },
  { id: "letter", label: "Letter (216 × 279 mm)", wMM: 215.9, hMM: 279.4 },
  { id: "legal", label: "Legal (216 × 356 mm)", wMM: 215.9, hMM: 355.6 },
  { id: "a5", label: "A5 (148 × 210 mm)", wMM: 148, hMM: 210 },
];
export const paperSpec = (id: PaperId): PaperSpec => PAPERS.find((p) => p.id === id) ?? PAPERS[0];

export type BlockType = "heading" | "paragraph" | "numbered" | "bullets" | "data" | "table" | "spacer" | "pagebreak";
export type TextAlign = "left" | "center" | "right" | "justify";
export type NumStyle = "1." | "1)" | "a." | "i." | "(1)";

export interface DataRow { id: string; label: string; value: string }

export interface LetterBlock {
  id: string;
  type: BlockType;
  /** heading/paragraph: teks; numbered/bullets: satu baris = satu butir; table: baris `a | b | c`. */
  text: string;
  /** heading: baris kecil di bawah judul (mis. nomor surat). */
  sub?: string;
  rows?: DataRow[];
  align?: TextAlign | "auto";
  indent?: boolean;
  underline?: boolean;
  bold?: boolean;
  header?: boolean;
  numStyle?: NumStyle;
  labelWidth?: number;
  height?: number;
}

export interface Signer {
  id: string;
  heading: string;
  role: string;
  name: string;
  idLabel: string;
  idValue: string;
  image: string | null;
  showStamp: boolean;
  qr: boolean;
}

export type KopStyle = "klasik" | "tengah" | "samping" | "modern" | "minimal" | "logo-kanan";
export type KopLine = "none" | "single" | "double" | "thick-thin";
export type SignLayout = "right" | "left" | "center" | "two" | "three";
export type DateLocation = "top" | "signature" | "none";
export type PageNumMode = "none" | "center" | "right";
export type FrameStyle = "none" | "single" | "double";

export interface LetterDoc {
  templateId: string;

  // Halaman
  paper: PaperId;
  marginTop: number; marginRight: number; marginBottom: number; marginLeft: number;
  fontFamily: string; fontHeading: string;
  fontSize: number; // pt
  lineHeight: number;
  paraSpacing: number; // pt
  align: TextAlign;
  colorText: string; colorAccent: string;
  frame: FrameStyle; frameColor: string; frameInset: number;

  // Kop
  kopEnabled: boolean; kopStyle: KopStyle; kopLine: KopLine;
  kopLine1: string; kopName: string; kopAddress: string; kopContact: string;
  kopLogo: string | null; kopLogoSize: number; kopAllPages: boolean; kopColor: string;
  contHeader: boolean;

  // Surat
  city: string; date: string; dateLocation: DateLocation; dateAlign: "left" | "right";
  numberMode: "manual" | "auto"; nomor: string; noUrut: number; noKode: string; noFormat: string;
  metaEnabled: boolean; sifat: string; lampiran: string; perihal: string;
  addressee: string;

  // Isi
  blocks: LetterBlock[];

  // Tanda tangan
  signEnabled: boolean; signLayout: SignLayout; signGap: number; signers: Signer[];
  materai: boolean; stampImage: string | null;
  tembusan: string;
  lampiranPage: boolean; lampiranTitle: string; lampiranText: string;

  // Kaki & watermark
  pageNum: PageNumMode; pageNumFormat: string; footerText: string;
  watermarkText: string; watermarkOpacity: number; watermarkColor: string; watermarkLogo: boolean;

  // Variabel
  vars: Record<string, string>;
  customVars: DataRow[];
}

export interface TemplateField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "select";
  value: string;
  options?: string[];
  placeholder?: string;
}

let idc = 0;
export const newId = (p = "b") => `${p}${Date.now().toString(36)}${(idc++).toString(36)}`;

export const blk = (type: BlockType, text = "", extra: Partial<LetterBlock> = {}): LetterBlock => ({ id: newId(), type, text, ...extra });
export const dataRow = (label: string, value: string): DataRow => ({ id: newId("d"), label, value });
export const newSigner = (p: Partial<Signer> = {}): Signer => ({
  id: newId("s"), heading: "Hormat saya,", role: "", name: "{{penandatangan}}", idLabel: "", idValue: "", image: null, showStamp: false, qr: false, ...p,
});

export function blankLetter(): LetterDoc {
  return {
    templateId: "kosong",
    paper: "a4", marginTop: 22, marginRight: 25, marginBottom: 22, marginLeft: 30,
    fontFamily: "Times New Roman", fontHeading: "Times New Roman", fontSize: 12, lineHeight: 1.35, paraSpacing: 6, align: "justify",
    colorText: "#111827", colorAccent: "#1e3a8a", frame: "none", frameColor: "#1e3a8a", frameInset: 8,
    kopEnabled: false, kopStyle: "klasik", kopLine: "double", kopLine1: "", kopName: "NAMA INSTANSI / PERUSAHAAN", kopAddress: "Jl. Contoh Alamat No. 123, Kota, Provinsi 12345", kopContact: "Telp. (021) 1234567 · Email: info@contoh.id · www.contoh.id",
    kopLogo: null, kopLogoSize: 22, kopAllPages: false, kopColor: "#111827", contHeader: true,
    city: "Jakarta", date: todayISODate(), dateLocation: "top", dateAlign: "right",
    numberMode: "manual", nomor: "", noUrut: 1, noKode: "UM", noFormat: "{no:3}/{kode}/{bulan_romawi}/{tahun}",
    metaEnabled: false, sifat: "", lampiran: "", perihal: "",
    addressee: "",
    blocks: [blk("paragraph", "Tulis isi surat di sini…")],
    signEnabled: true, signLayout: "right", signGap: 22,
    signers: [newSigner({ role: "", name: "Nama Lengkap" })],
    materai: false, stampImage: null, tembusan: "",
    lampiranPage: false, lampiranTitle: "LAMPIRAN", lampiranText: "",
    pageNum: "center", pageNumFormat: "Halaman {n} dari {total}", footerText: "",
    watermarkText: "", watermarkOpacity: 0.08, watermarkColor: "#64748b", watermarkLogo: false,
    vars: {}, customVars: [],
  };
}

// ── Angka romawi, nomor surat, variabel ──────────────────────────────────

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export const monthRoman = (m: number) => ROMAN[Math.min(12, Math.max(1, m))] ?? "";

function parseISO(iso: string): Date {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function formatNomor(fmt: string, noUrut: number, kode: string, iso: string): string {
  const d = parseISO(iso);
  return fmt.replace(/\{(no|kode|bulan_romawi|bulan|tahun|hari)(?::(\d{1,2}))?\}/gi, (_m, key: string, pad?: string) => {
    switch (key.toLowerCase()) {
      case "no": return pad ? String(noUrut).padStart(parseInt(pad, 10), "0") : String(noUrut);
      case "kode": return kode;
      case "bulan_romawi": return monthRoman(d.getMonth() + 1);
      case "bulan": return String(d.getMonth() + 1).padStart(2, "0");
      case "tahun": return String(d.getFullYear());
      default: return String(d.getDate()).padStart(2, "0");
    }
  });
}

export const resolveNomor = (doc: LetterDoc, noUrutOverride?: number): string =>
  doc.numberMode === "auto" ? formatNomor(doc.noFormat, noUrutOverride ?? doc.noUrut, doc.noKode, doc.date) : doc.nomor;

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function applyVars(text: string, vars: Record<string, string>): string {
  if (!text) return "";
  return text.replace(VAR_RE, (_m, k: string) => vars[k.toLowerCase()] ?? "");
}

export const templateFieldsKey = (f: TemplateField[]) => f.map((x) => x.key).join(",");

/**
 * Gabungan variabel untuk satu surat: bawaan (tanggal, nomor, kota, …) → isian template →
 * variabel kustom → data baris massal. Kunci selalu huruf kecil. Isian bertipe tanggal
 * otomatis diformat panjang ("12 Januari 2026"), nilai ISO tersedia di `<kunci>_iso`.
 */
export function buildVars(doc: LetterDoc, fields: TemplateField[], row?: Record<string, string>, noUrutOverride?: number): Record<string, string> {
  const d = parseISO(doc.date);
  const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(d);
  const v: Record<string, string> = {
    tanggal: formatDateID(doc.date),
    tanggal_pendek: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`,
    hari: weekday,
    kota: doc.city,
    tahun: String(d.getFullYear()),
    bulan: new Intl.DateTimeFormat("id-ID", { month: "long" }).format(d),
    bulan_romawi: monthRoman(d.getMonth() + 1),
    nomor: resolveNomor(doc, noUrutOverride),
    perihal: doc.perihal,
    lampiran: doc.lampiran,
    instansi: doc.kopName,
    jabatan: doc.signers[0]?.role ?? "",
  };
  for (const f of fields) {
    const raw = doc.vars[f.key] ?? f.value ?? "";
    if (f.type === "date") { v[`${f.key.toLowerCase()}_iso`] = raw; v[f.key.toLowerCase()] = formatDateID(raw); }
    else v[f.key.toLowerCase()] = raw;
  }
  for (const [k, val] of Object.entries(doc.vars)) if (!(k.toLowerCase() in v)) v[k.toLowerCase()] = val;
  for (const c of doc.customVars) if (c.label.trim()) v[c.label.trim().toLowerCase()] = c.value;
  if (row) for (const [k, val] of Object.entries(row)) v[k.toLowerCase()] = val;
  // penandatangan dihitung terakhir agar bisa memakai variabel lain (mis. {{nama}})
  v.penandatangan = applyVars(doc.signers[0]?.name ?? "", v);
  return v;
}

/** Semua kunci {{variabel}} yang dipakai di dokumen (untuk memberi tahu pengguna kolom apa yang tersedia). */
export function usedVarKeys(doc: LetterDoc): string[] {
  const set = new Set<string>();
  const scan = (s?: string) => { if (!s) return; for (const m of s.matchAll(VAR_RE)) set.add(m[1].toLowerCase()); };
  [doc.kopLine1, doc.kopName, doc.kopAddress, doc.kopContact, doc.perihal, doc.lampiran, doc.sifat, doc.addressee, doc.tembusan, doc.lampiranText, doc.footerText, doc.watermarkText, doc.nomor, doc.city].forEach(scan);
  for (const b of doc.blocks) { scan(b.text); scan(b.sub); b.rows?.forEach((r) => { scan(r.label); scan(r.value); }); }
  for (const s of doc.signers) { scan(s.heading); scan(s.role); scan(s.name); scan(s.idValue); }
  return Array.from(set);
}

// ── Teks polos (untuk TXT & salin) ───────────────────────────────────────

export function parseTable(text: string): string[][] {
  return text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split("|").map((c) => c.trim()));
}

export function blockLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export function numberLabel(i: number, style: NumStyle): string {
  const roman = (n: number) => { const t: [number, string][] = [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]]; let r = ""; for (const [v, s] of t) while (n >= v) { r += s; n -= v; } return r; };
  const alpha = (n: number) => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(97 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  switch (style) {
    case "1)": return `${i + 1})`;
    case "a.": return `${alpha(i)}.`;
    case "i.": return `${roman(i + 1)}.`;
    case "(1)": return `(${i + 1})`;
    default: return `${i + 1}.`;
  }
}

/** Menghapus penanda **tebal**, *miring*, __garis bawah__. */
export const stripMarkup = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1$2");

export function letterToText(doc: LetterDoc, vars: Record<string, string>): string {
  const T = (s: string) => stripMarkup(applyVars(s, vars));
  const out: string[] = [];
  if (doc.kopEnabled) {
    [doc.kopLine1, doc.kopName, doc.kopAddress, doc.kopContact].map(T).filter(Boolean).forEach((l) => out.push(l));
    out.push("=".repeat(48), "");
  }
  const dateLine = [T(doc.city), vars.tanggal].filter(Boolean).join(", ");
  if (doc.dateLocation === "top" && dateLine) out.push(dateLine, "");
  if (doc.metaEnabled) {
    const nomor = vars.nomor;
    if (nomor) out.push(`Nomor     : ${nomor}`);
    if (doc.sifat) out.push(`Sifat     : ${T(doc.sifat)}`);
    if (doc.lampiran) out.push(`Lampiran  : ${T(doc.lampiran)}`);
    if (doc.perihal) out.push(`Hal       : ${T(doc.perihal)}`);
    out.push("");
  }
  if (doc.addressee.trim()) out.push(...T(doc.addressee).split(/\r?\n/), "");
  for (const b of doc.blocks) {
    switch (b.type) {
      case "heading": out.push(T(b.text).toUpperCase()); if (b.sub) out.push(T(b.sub)); out.push(""); break;
      case "paragraph": out.push(T(b.text), ""); break;
      case "numbered": blockLines(T(b.text)).forEach((l, i) => out.push(`${numberLabel(i, b.numStyle ?? "1.")} ${l}`)); out.push(""); break;
      case "bullets": blockLines(T(b.text)).forEach((l) => out.push(`- ${l}`)); out.push(""); break;
      case "data": (b.rows ?? []).forEach((r) => out.push(`${T(r.label).padEnd(22)}: ${T(r.value)}`)); out.push(""); break;
      case "table": parseTable(T(b.text)).forEach((r) => out.push(r.join(" | "))); out.push(""); break;
      case "pagebreak": out.push("-".repeat(48), ""); break;
      default: out.push("");
    }
  }
  if (doc.signEnabled) {
    if (doc.dateLocation === "signature" && dateLine) out.push(dateLine);
    doc.signers.slice(0, signerCount(doc.signLayout)).forEach((s) => {
      out.push("", T(s.heading), T(s.role), "", "", T(s.name));
      if (s.idValue) out.push(`${s.idLabel ? `${T(s.idLabel)} ` : ""}${T(s.idValue)}`);
    });
    out.push("");
  }
  if (doc.tembusan.trim()) { out.push("Tembusan:"); blockLines(T(doc.tembusan)).forEach((l, i) => out.push(`${i + 1}. ${l}`)); }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export const signerCount = (l: SignLayout) => (l === "two" ? 2 : l === "three" ? 3 : 1);
