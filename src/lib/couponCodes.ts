// Pembuat kode unik (kupon / voucher / tiket), substitusi token teks, dan pengolahan tabel massal.
//
// Token pola kode (tidak peka huruf besar/kecil):
//   {RAND:n}  n karakter acak dari set karakter terpilih      {NUM:n}   n angka acak
//   {ALPHA:n} n huruf acak                                    {HEX:n}   n heksadesimal acak
//   {SEQ:n}   nomor urut berurutan, diisi nol hingga n digit  {CHK}     karakter cek (mod 36) dari karakter sebelumnya
//   {YYYY} {YY} {MM} {DD}  tanggal hari ini
// Selain token, semua karakter ditulis apa adanya (mis. "KPN-", "/", "-").

import type { CharsetId, CodeGenSettings } from "@/lib/couponTypes";
import { buildCsv } from "@/lib/csv";

export interface CouponRecord {
  /** Nomor urut tampil (seqStart + i·seqStep), dipakai token {no}. */
  no: number;
  code: string;
  /** Semua kolom data (kunci huruf kecil), dipakai token {nama}, {kursi}, dst. */
  fields: Record<string, string>;
}

export const CHARSETS: Record<CharsetId, { label: string; chars: string }> = {
  "alnum-safe": { label: "Huruf & angka (tanpa 0/O/1/I)", chars: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" },
  alnum: { label: "Huruf & angka lengkap", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" },
  digits: { label: "Angka saja", chars: "0123456789" },
  letters: { label: "Huruf saja", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  hex: { label: "Heksadesimal", chars: "0123456789ABCDEF" },
};

const CHK_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type Tok =
  | { t: "lit"; v: string }
  | { t: "rand"; n: number; set: string }
  | { t: "seq"; n: number }
  | { t: "date"; k: "YYYY" | "YY" | "MM" | "DD" }
  | { t: "chk" };

const TOKEN_RE = /\{(RAND|NUM|ALPHA|HEX|SEQ):(\d{1,2})\}|\{(YYYY|YY|MM|DD|CHK)\}/gi;

export function parsePattern(pattern: string, charset: CharsetId): Tok[] {
  const out: Tok[] = [];
  let last = 0;
  const re = new RegExp(TOKEN_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(pattern))) {
    if (m.index > last) out.push({ t: "lit", v: pattern.slice(last, m.index) });
    if (m[1]) {
      const kind = m[1].toUpperCase();
      const n = Math.min(32, Math.max(1, parseInt(m[2], 10) || 1));
      if (kind === "SEQ") out.push({ t: "seq", n });
      else if (kind === "RAND") out.push({ t: "rand", n, set: CHARSETS[charset].chars });
      else if (kind === "NUM") out.push({ t: "rand", n, set: CHARSETS.digits.chars });
      else if (kind === "ALPHA") out.push({ t: "rand", n, set: CHARSETS.letters.chars });
      else out.push({ t: "rand", n, set: CHARSETS.hex.chars });
    } else {
      const k = m[3].toUpperCase();
      if (k === "CHK") out.push({ t: "chk" });
      else out.push({ t: "date", k: k as "YYYY" | "YY" | "MM" | "DD" });
    }
    last = m.index + m[0].length;
  }
  if (last < pattern.length) out.push({ t: "lit", v: pattern.slice(last) });
  return out;
}

function randInt(max: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max; // buang sisa agar tidak bias
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

function checkChar(s: string): string {
  let sum = 0;
  let idx = 1;
  for (const ch of s.toUpperCase()) {
    const v = CHK_CHARS.indexOf(ch);
    if (v < 0) continue;
    sum += v * idx;
    idx++;
  }
  return CHK_CHARS[sum % 36];
}

function buildOne(tokens: Tok[], seqValue: number, uppercase: boolean, now: Date): string {
  let s = "";
  for (const tk of tokens) {
    if (tk.t === "lit") s += tk.v;
    else if (tk.t === "seq") s += String(Math.max(0, seqValue)).padStart(tk.n, "0");
    else if (tk.t === "date") {
      const y = String(now.getFullYear());
      s += tk.k === "YYYY" ? y : tk.k === "YY" ? y.slice(2) : tk.k === "MM" ? String(now.getMonth() + 1).padStart(2, "0") : String(now.getDate()).padStart(2, "0");
    } else if (tk.t === "chk") s += checkChar(s);
    else {
      let part = "";
      for (let i = 0; i < tk.n; i++) part += tk.set[randInt(tk.set.length)];
      s += uppercase ? part : part.toLowerCase();
    }
  }
  return s;
}

/** Perkiraan ruang kode unik (Infinity bila ada {SEQ}, 1 bila tanpa unsur acak/urut). */
export function patternSpace(pattern: string, charset: CharsetId): number {
  const toks = parsePattern(pattern, charset);
  if (toks.some((t) => t.t === "seq")) return Infinity;
  let space = 1;
  for (const t of toks) if (t.t === "rand") space *= Math.pow(t.set.length, t.n);
  return space;
}

export function sampleCode(g: CodeGenSettings): string {
  const toks = parsePattern(g.pattern, g.charset);
  return buildOne(toks, g.seqStart, g.uppercase, new Date());
}

export interface PatternCheck {
  ok: boolean;
  message: string | null;
  sample: string;
}

export function checkPattern(g: CodeGenSettings, count: number): PatternCheck {
  const pat = (g.pattern || "").trim();
  if (!pat) return { ok: false, message: "Pola kode masih kosong.", sample: "" };
  const sample = sampleCode(g);
  if (!sample.trim()) return { ok: false, message: "Pola menghasilkan kode kosong.", sample };
  if (count > 1) {
    const space = patternSpace(pat, g.charset);
    if (space <= 1) return { ok: false, message: "Pola tidak punya bagian acak/urut — semua kode akan sama. Tambahkan {RAND:4} atau {SEQ:4}.", sample };
    if (g.seqStep === 0 && patternSpace(pat, g.charset) === Infinity && !/\{(RAND|NUM|ALPHA|HEX):/i.test(pat)) {
      return { ok: false, message: "Langkah urut 0 membuat semua kode sama.", sample };
    }
    if (Number.isFinite(space) && space < count * 2) {
      return { ok: false, message: `Pola hanya mampu ±${space.toLocaleString("id-ID")} kode unik — perpanjang bagian acak untuk ${count} kode.`, sample };
    }
  }
  if (/[\u0000-\u001f]/.test(sample)) return { ok: false, message: "Kode memuat karakter kontrol.", sample };
  return { ok: true, message: null, sample };
}

/** Membuat `count` kode unik; `taken` = kode yang sudah dipakai (tidak akan diulang). */
export function generateCodes(g: CodeGenSettings, count: number, taken?: Set<string>, seqOffset = 0): string[] {
  const chk = checkPattern(g, count);
  if (!chk.ok) throw new Error(chk.message ?? "Pola kode tidak valid.");
  const toks = parsePattern(g.pattern.trim(), g.charset);
  const hasRand = toks.some((t) => t.t === "rand");
  const now = new Date();
  const seen = taken ?? new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const seq = g.seqStart + (i + seqOffset) * g.seqStep;
    let code = buildOne(toks, seq, g.uppercase, now);
    let tries = 0;
    while (seen.has(code)) {
      if (!hasRand || ++tries > 200) throw new Error("Tidak bisa membuat kode unik dengan pola ini. Perpanjang bagian acak atau ubah pola.");
      code = buildOne(toks, seq, g.uppercase, now);
    }
    seen.add(code);
    out.push(code);
  }
  return out;
}

// ── Token teks {kode} {no} {nama} ... ────────────────────────────────────

const TEXT_TOKEN_RE = /\{([a-zA-Z0-9_]+)(?::(\d{1,2}))?\}/g;

export function slugKey(s: string): string {
  return (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Mengganti {kode}, {no}, {no:4}, {nama}, … dengan data record. Token tak dikenal → kosong. */
export function applyTokens(text: string, rec: CouponRecord): string {
  if (!text) return "";
  return text.replace(TEXT_TOKEN_RE, (_m, key: string, pad?: string) => {
    const k = key.toLowerCase();
    if (k === "kode" || k === "code") return rec.code;
    if (k === "no" || k === "nomor") return pad ? String(rec.no).padStart(parseInt(pad, 10), "0") : String(rec.no);
    const v = rec.fields[k];
    return v === undefined ? "" : v;
  });
}

/** Token yang tersedia untuk pengguna (bawaan + kolom tabel). */
export function availableTokens(records: CouponRecord[]): string[] {
  const set = new Set<string>(["kode", "no", "no:4"]);
  for (const r of records.slice(0, 50)) for (const k of Object.keys(r.fields)) if (k !== "kode" && k !== "code") set.add(k);
  return Array.from(set);
}

// ── Rekaman ──────────────────────────────────────────────────────────────

export function recordsFromGenerator(g: CodeGenSettings): CouponRecord[] {
  const qty = Math.max(1, Math.min(1000, Math.floor(g.quantity) || 1));
  const codes = generateCodes(g, qty);
  return codes.map((code, i) => ({ no: g.seqStart + i * g.seqStep, code, fields: {} }));
}

export interface TableRecords {
  records: CouponRecord[];
  headers: string[];
  warnings: string[];
}

const CODE_HEADERS = new Set(["kode", "code", "kode_voucher", "kode_kupon", "voucher", "kupon", "kode_tiket", "no_seri", "seri"]);

/**
 * Membangun rekaman dari tabel (baris pertama = header). Kolom bernama kode/code dipakai sebagai kode;
 * bila kosong/tidak ada, kode dibuat otomatis dari pola. Kolom lain menjadi token {nama_kolom}.
 */
export function recordsFromTable(grid: string[][], g: CodeGenSettings, maxRows = 1000): TableRecords {
  const warnings: string[] = [];
  if (grid.length < 2) return { records: [], headers: [], warnings: ["Tabel perlu header dan minimal satu baris data."] };
  const rawHeaders = grid[0].map((h) => h.trim());
  const keys = rawHeaders.map((h, i) => slugKey(h) || `kolom_${i + 1}`);
  const codeIdx = keys.findIndex((k) => CODE_HEADERS.has(k));
  const rows = grid.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length > maxRows) warnings.push(`Data ${rows.length} baris — hanya ${maxRows} baris pertama yang diproses.`);
  const used = rows.slice(0, maxRows);

  const taken = new Set<string>();
  // Kode yang sudah ada di tabel didahulukan agar kode otomatis tidak bentrok.
  let dup = 0;
  const given: (string | null)[] = used.map((r) => {
    if (codeIdx < 0) return null;
    const c = (r[codeIdx] ?? "").trim();
    if (!c) return null;
    if (taken.has(c)) { dup++; return c; }
    taken.add(c);
    return c;
  });
  if (dup) warnings.push(`${dup} kode di tabel duplikat — periksa kolom kode.`);
  const missing = given.filter((c) => c === null).length;
  let auto: string[] = [];
  if (missing > 0) {
    try {
      auto = generateCodes(g, missing, taken);
    } catch (e: any) {
      return { records: [], headers: rawHeaders, warnings: [e?.message || "Gagal membuat kode otomatis."] };
    }
  }
  let ai = 0;
  const records: CouponRecord[] = used.map((r, i) => {
    const fields: Record<string, string> = {};
    keys.forEach((k, ci) => {
      if (ci === codeIdx) return;
      fields[k] = (r[ci] ?? "").trim();
    });
    const code = given[i] ?? auto[ai++];
    return { no: g.seqStart + i * g.seqStep, code, fields };
  });
  return { records, headers: rawHeaders, warnings };
}

export function sampleTable(): string {
  return [
    "Nama\tKategori\tKursi\tZona",
    "Budi Santoso\tVIP\tA-01\tZona A",
    "Siti Rahma\tVIP\tA-02\tZona A",
    "Agus Wijaya\tReguler\tB-10\tZona B",
    "Dewi Lestari\tReguler\tB-11\tZona B",
    "Rina Putri\tFestival\t-\tZona C",
  ].join("\n");
}

export function couponCsvTemplate(): string {
  return buildCsv([
    ["nama", "kode", "kategori", "kursi", "zona"],
    ["Budi Santoso", "", "VIP", "A-01", "Zona A"],
    ["Siti Rahma", "", "VIP", "A-02", "Zona A"],
    ["Agus Wijaya", "KODE-MANUAL-01", "Reguler", "B-10", "Zona B"],
  ]);
}

/** CSV daftar kode (no, kode, + semua kolom). Diawali BOM agar Excel membaca UTF-8 dengan benar. */
export function recordsToCsv(records: CouponRecord[]): string {
  const cols: string[] = [];
  for (const r of records) for (const k of Object.keys(r.fields)) if (!cols.includes(k)) cols.push(k);
  const rows: string[][] = [["no", "kode", ...cols]];
  for (const r of records) rows.push([String(r.no), r.code, ...cols.map((c) => r.fields[c] ?? "")]);
  return "\uFEFF" + buildCsv(rows);
}

export function slugFile(s: string, fallback = "item"): string {
  const v = (s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return v || fallback;
}

/** Apakah `code` bisa di-encode sebagai barcode `format`? (CODE128 = ASCII cetak; CODE39 = A–Z 0–9 - . $ / + % spasi). */
export function barcodeCompatible(code: string, format: "CODE128" | "CODE39"): boolean {
  if (!code) return false;
  if (format === "CODE39") return /^[A-Z0-9\-. $/+%]+$/.test(code.toUpperCase());
  return /^[\x20-\x7e]+$/.test(code);
}
