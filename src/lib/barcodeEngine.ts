import JsBarcode from "jsbarcode";
import { tr } from "@/i18n";

// ─── Definisi format ─────────────────────────────────────────────────────────
export interface BarcodeFormatDef {
  id: string;
  label: string;
  group: string;
  /** Aturan isi, ditampilkan sebagai petunjuk di bawah kolom isi. */
  rule: string;
  /** Contoh isi yang dijamin valid untuk format ini. */
  sample: string;
}

export const BARCODE_GROUPS = [tr("Umum"), tr("Retail (produk)"), tr("Logistik & Inventaris"), tr("Industri & Khusus")] as const;

export const BARCODE_FORMATS: BarcodeFormatDef[] = [
  { id: "CODE128", label: tr("CODE 128 (umum)"), group: tr("Umum"), rule: tr("Huruf, angka, dan simbol ASCII (tanpa huruf beraksen/emoji). Paling serbaguna & padat."), sample: "GAMATO-2026" },
  { id: "CODE128A", label: tr("CODE 128 A"), group: tr("Umum"), rule: tr("Huruf BESAR, angka, simbol, dan karakter kontrol."), sample: "GAMATO-26" },
  { id: "CODE128B", label: tr("CODE 128 B"), group: tr("Umum"), rule: tr("Huruf besar-kecil, angka, dan simbol ASCII."), sample: "Gamato-01" },
  { id: "CODE128C", label: tr("CODE 128 C"), group: tr("Umum"), rule: tr("Hanya angka, jumlah digit genap (paling padat untuk angka)."), sample: "12345678" },
  { id: "EAN13", label: tr("EAN-13"), group: tr("Retail (produk)"), rule: tr("12 digit (digit cek dihitung otomatis) atau 13 digit (digit cek diperiksa)."), sample: "899123456789" },
  { id: "EAN8", label: tr("EAN-8"), group: tr("Retail (produk)"), rule: tr("7 digit (digit cek otomatis) atau 8 digit."), sample: "9638507" },
  { id: "UPC", label: tr("UPC-A"), group: tr("Retail (produk)"), rule: tr("11 digit (digit cek otomatis) atau 12 digit."), sample: "01234567890" },
  { id: "UPCE", label: tr("UPC-E"), group: tr("Retail (produk)"), rule: tr("6 digit, atau 7–8 digit yang diawali 0/1."), sample: "123456" },
  { id: "EAN5", label: tr("EAN-5 (add-on harga buku)"), group: tr("Retail (produk)"), rule: tr("Tepat 5 digit."), sample: "52495" },
  { id: "EAN2", label: tr("EAN-2 (add-on terbitan)"), group: tr("Retail (produk)"), rule: tr("Tepat 2 digit."), sample: "53" },
  { id: "ITF14", label: tr("ITF-14 (karton/kardus)"), group: tr("Logistik & Inventaris"), rule: tr("13 digit (digit cek otomatis) atau 14 digit."), sample: "1234567890123" },
  { id: "ITF", label: tr("ITF (Interleaved 2 of 5)"), group: tr("Logistik & Inventaris"), rule: tr("Hanya angka, jumlah digit genap."), sample: "123456" },
  { id: "MSI", label: tr("MSI"), group: tr("Logistik & Inventaris"), rule: tr("Hanya angka."), sample: "123456" },
  { id: "MSI10", label: tr("MSI + cek Mod 10"), group: tr("Logistik & Inventaris"), rule: tr("Hanya angka; digit cek Mod 10 ditambahkan otomatis."), sample: "123456" },
  { id: "MSI11", label: tr("MSI + cek Mod 11"), group: tr("Logistik & Inventaris"), rule: tr("Hanya angka; digit cek Mod 11 ditambahkan otomatis."), sample: "123456" },
  { id: "MSI1010", label: tr("MSI + cek Mod 10/10"), group: tr("Logistik & Inventaris"), rule: tr("Hanya angka; dua digit cek Mod 10 ditambahkan otomatis."), sample: "123456" },
  { id: "MSI1110", label: tr("MSI + cek Mod 11/10"), group: tr("Logistik & Inventaris"), rule: tr("Hanya angka; digit cek Mod 11 lalu Mod 10 ditambahkan otomatis."), sample: "123456" },
  { id: "CODE39", label: tr("CODE 39"), group: tr("Industri & Khusus"), rule: tr("Huruf BESAR A–Z, angka, spasi, dan - . $ / + %."), sample: "GAMATO-39" },
  { id: "CODE93", label: tr("CODE 93"), group: tr("Industri & Khusus"), rule: tr("Huruf BESAR A–Z, angka, spasi, dan - . $ / + %."), sample: "GAMATO93" },
  { id: "codabar", label: tr("Codabar"), group: tr("Industri & Khusus"), rule: tr("Angka dan - $ : / . +, diapit huruf awal/akhir A–D (mis. A123456A)."), sample: "A123456A" },
  { id: "pharmacode", label: tr("Pharmacode"), group: tr("Industri & Khusus"), rule: tr("Bilangan bulat 3 sampai 131070."), sample: "1234" },
];

export const getBarcodeFormat = (id: string): BarcodeFormatDef => BARCODE_FORMATS.find((f) => f.id === id) ?? BARCODE_FORMATS[0];

// ─── Digit cek ───────────────────────────────────────────────────────────────
/** Digit cek GS1 (EAN-13/EAN-8/UPC-A/ITF-14/GTIN) untuk deret digit TANPA digit cek. */
export function gs1CheckDigit(digitsWithoutCheck: string): number {
  let sum = 0;
  const n = digitsWithoutCheck.length;
  for (let i = 0; i < n; i++) {
    const d = digitsWithoutCheck.charCodeAt(n - 1 - i) - 48;
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Panjang isi (tanpa digit cek) → panjang penuh, untuk format berdigit cek GS1. */
const GS1_LENGTH: Record<string, number> = { EAN13: 13, EAN8: 8, UPC: 12, ITF14: 14 };

/** `value` = isi yang dimasukkan ke encoder; `encoded` = isi lengkap yang benar-benar tercetak (termasuk digit cek GS1 otomatis). */
export type BarcodeCheck = { ok: true; value: string; encoded: string; note?: string } | { ok: false; reason: string; fixedValue?: string };

/**
 * Validasi isi untuk satu format memakai encoder JsBarcode yang SAMA dengan yang menggambar (tanpa DOM),
 * lalu menerjemahkan kegagalannya menjadi pesan yang bisa ditindaklanjuti. Untuk format GS1, digit cek yang salah
 * dilaporkan lengkap dengan nilai yang benar.
 */
export function checkBarcodeValue(format: string, raw: string): BarcodeCheck {
  const def = getBarcodeFormat(format);
  let value = raw.replace(/\r?\n/g, " ").trim();
  if (!value) return { ok: false, reason: "kosong" };

  const numericOnly = ["EAN13", "EAN8", "UPC", "UPCE", "EAN5", "EAN2", "ITF14", "ITF", "MSI", "MSI10", "MSI11", "MSI1010", "MSI1110", "CODE128C", "pharmacode"].includes(format);
  if (numericOnly) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return { ok: false, reason: tr("Format {0} hanya menerima angka. {1}", def.label, def.rule) };
    value = digits;
  }

  const full = GS1_LENGTH[format];
  if (full && value.length === full) {
    const want = gs1CheckDigit(value.slice(0, -1));
    if (Number(value[value.length - 1]) !== want) {
      return { ok: false, reason: tr("Digit cek salah — untuk isi ini seharusnya {0}.", want), fixedValue: value.slice(0, -1) + want };
    }
  }

  let encodedOk = true;
  try {
    JsBarcode({}, value, { format, valid: (v: boolean) => { encodedOk = v; } });
  } catch {
    encodedOk = false;
  }
  if (!encodedOk) return { ok: false, reason: tr("Isi tidak valid untuk {0}. {1}", def.label, def.rule) };

  if (full && value.length === full - 1) {
    const cd = gs1CheckDigit(value);
    return { ok: true, value, encoded: value + cd, note: tr("Digit cek {0} ditambahkan otomatis.", cd) };
  }
  return { ok: true, value, encoded: value };
}

// ─── Konfigurasi & penggambaran ──────────────────────────────────────────────
export interface BarcodeStyle {
  /** Lebar satu modul (px). */
  width: number;
  height: number;
  margin: number;
  showText: boolean;
  /** Teks pengganti di bawah/atas batang; kosong = pakai isi. */
  customText: string;
  textPosition: "top" | "bottom";
  textAlign: "left" | "center" | "right";
  fontSize: number;
  textMargin: number;
  font: "monospace" | "sans-serif" | "serif";
  fontBold: boolean;
  /** EAN/UPC: batang pengaman rata (tanpa batang yang memanjang). */
  flat: boolean;
  /** CODE 39: tambahkan digit cek Mod 43. */
  mod43: boolean;
  fg: string;
  bg: string;
  bgTransparent: boolean;
}

export const DEFAULT_BARCODE_STYLE: BarcodeStyle = {
  width: 2, height: 80, margin: 10, showText: true, customText: "", textPosition: "bottom", textAlign: "center",
  fontSize: 20, textMargin: 2, font: "monospace", fontBold: false, flat: false, mod43: false,
  fg: "#020617", bg: "#ffffff", bgTransparent: false,
};

/** Gambar satu barcode ke canvas atau elemen SVG pada skala tertentu (1 = ukuran layar; 3–8 = cetak tajam). */
export function drawBarcode(target: HTMLCanvasElement | SVGSVGElement, value: string, format: string, s: BarcodeStyle, scale = 1): void {
  JsBarcode(target, value, {
    format,
    width: s.width * scale,
    height: s.height * scale,
    margin: s.margin * scale,
    displayValue: s.showText,
    text: s.customText.trim() || undefined,
    textPosition: s.textPosition,
    textAlign: s.textAlign,
    fontSize: s.fontSize * scale,
    textMargin: s.textMargin * scale,
    font: s.font,
    fontOptions: s.fontBold ? "bold" : "",
    flat: s.flat,
    mod43: format === "CODE39" ? s.mod43 : undefined,
    lineColor: s.fg,
    background: s.bgTransparent ? "transparent" : s.bg,
  } as never);
}

export function barcodeToCanvas(value: string, format: string, s: BarcodeStyle, scale = 1): HTMLCanvasElement {
  const c = document.createElement("canvas");
  drawBarcode(c, value, format, s, scale);
  return c;
}

export function barcodeToSvgString(value: string, format: string, s: BarcodeStyle): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  drawBarcode(svg, value, format, s, 1);
  if (!svg.getAttribute("xmlns")) svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return `<?xml version="1.0" standalone="no"?>\r\n${new XMLSerializer().serializeToString(svg)}`;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"));
}

// ─── Daftar massal ───────────────────────────────────────────────────────────
export interface BulkEntry { code: string; label?: string }

/** `kode` atau `kode,label` per baris (label boleh mengandung koma). */
export function parseBulkLines(text: string): BulkEntry[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [code, ...rest] = line.split(",");
      return { code: (code || "").trim(), label: rest.join(",").trim() || undefined };
    });
}

/** Deret berurutan: awalan + nomor berlapis nol. */
export function buildSeries(prefix: string, start: number, count: number, pad: number): BulkEntry[] {
  const out: BulkEntry[] = [];
  const n = Math.max(0, Math.min(Math.floor(count) || 0, 2000));
  for (let i = 0; i < n; i++) out.push({ code: prefix + String(Math.floor(start) + i).padStart(Math.max(0, Math.floor(pad)), "0") });
  return out;
}
