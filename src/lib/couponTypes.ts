// Model data untuk Generator Kupon, Voucher & Tiket (Spesial > Kupon, Voucher & Tiket).
// Dipisah dari mesin gambar (couponEngine.ts) agar UI bisa mengimpor tipe/preset
// tanpa menarik kode kanvas — pola yang sama dengan cvTypes / businessCardTypes.

import { DEFAULT_FONT_FAMILY } from "@/lib/fontPresets";

export type CouponKind = "kupon" | "voucher" | "tiket" | "pass" | "giftcard" | "undian";
export type StubPosition = "right" | "left" | "bottom" | "top" | "none";
export type LayoutMode = "value-left" | "value-center" | "banner-top" | "minimal" | "poster";
export type PatternId = "none" | "dots" | "stripes" | "grid" | "waves" | "confetti" | "circles" | "zigzag" | "diamonds";
export type EdgeStyle = "plain" | "scallop" | "zigzag";
export type BorderStyle = "none" | "solid" | "double" | "dashed" | "inset";
export type CodeMode = "qr" | "barcode" | "both" | "text" | "none";
export type QrModuleStyle = "square" | "rounded" | "dots";
export type StubTone = "same" | "accent" | "dark" | "light";
export type CharsetId = "alnum-safe" | "alnum" | "digits" | "letters" | "hex";
export type BgMode = "solid" | "gradient" | "image";
export type ValidityMode = "none" | "until" | "range" | "text";

export interface DetailRow {
  id: string;
  label: string;
  value: string;
}

export interface CodeGenSettings {
  /** Pola kode, mis. `KPN-{RAND:4}-{RAND:4}` — lihat couponCodes.ts untuk daftar token. */
  pattern: string;
  charset: CharsetId;
  uppercase: boolean;
  seqStart: number;
  seqStep: number;
  quantity: number;
}

export interface CouponDesign {
  kind: CouponKind;
  templateId: string;

  // Ukuran & struktur
  sizeId: string;
  customWMM: number;
  customHMM: number;
  stub: StubPosition;
  stubPct: number;
  layout: LayoutMode;

  // Isi
  brand: string;
  tagline: string;
  label: string;
  title: string;
  subtitle: string;
  value: string;
  unit: string;
  description: string;
  details: DetailRow[];
  validityMode: ValidityMode;
  validLabel: string;
  validFrom: string;
  validUntil: string;
  validText: string;
  terms: string;
  footer: string;
  stubNote: string;

  // Tampilan
  fontHeading: string;
  fontBody: string;
  textScale: number;
  bgMode: BgMode;
  colorBg1: string;
  colorBg2: string;
  gradAngle: number;
  bgImage: string | null;
  bgImageOverlay: number;
  colorAccent: string;
  colorText: string;
  stubTone: StubTone;
  pattern: PatternId;
  patternColor: string;
  patternOpacity: number;
  patternScale: number;
  borderStyle: BorderStyle;
  borderColor: string;
  borderWidth: number; // mm
  radius: number; // mm
  edge: EdgeStyle;
  notch: boolean;
  notchRadius: number; // mm
  logo: string | null;
  logoSize: number;
  stampText: string;
  stampColor: string;
  stampOpacity: number;

  // Kode
  codeMode: CodeMode;
  codeLabel: string;
  showCodeText: boolean;
  showSerial: boolean;
  qrEcc: "L" | "M" | "Q" | "H";
  qrStyle: QrModuleStyle;
  qrColor: string;
  qrPlate: boolean;
  qrPayload: string;
  barcodeFormat: "CODE128" | "CODE39";
  codeGen: CodeGenSettings;
}

// ── Ukuran ────────────────────────────────────────────────────────────────

export interface CouponSizePreset {
  id: string;
  label: string;
  wMM: number;
  hMM: number;
}

export const COUPON_SIZES: CouponSizePreset[] = [
  { id: "kupon-std", label: "Kupon Standar (180 × 70 mm)", wMM: 180, hMM: 70 },
  { id: "kupon-wide", label: "Kupon Lebar (150 × 60 mm)", wMM: 150, hMM: 60 },
  { id: "tiket-std", label: "Tiket Standar (200 × 75 mm)", wMM: 200, hMM: 75 },
  { id: "tiket-ringkas", label: "Tiket Ringkas (160 × 60 mm)", wMM: 160, hMM: 60 },
  { id: "voucher", label: "Voucher (160 × 70 mm)", wMM: 160, hMM: 70 },
  { id: "kartu", label: "Kartu Hadiah (86 × 54 mm)", wMM: 86, hMM: 54 },
  { id: "a6", label: "A6 Lanskap (148 × 105 mm)", wMM: 148, hMM: 105 },
  { id: "potret", label: "Tiket Potret (75 × 180 mm)", wMM: 75, hMM: 180 },
  { id: "persegi", label: "Persegi (100 × 100 mm)", wMM: 100, hMM: 100 },
  { id: "custom", label: "Ukuran Kustom…", wMM: 150, hMM: 60 },
];

/** Resolusi render: piksel per milimeter. 12 px/mm → 180 × 70 mm = 2160 × 840 px (tajam untuk cetak). */
export const COUPON_PX_PER_MM = 12;
export const MAX_COUPON_ROWS = 1000;

export function resolveCouponSizeMM(d: Pick<CouponDesign, "sizeId" | "customWMM" | "customHMM">): { wMM: number; hMM: number } {
  if (d.sizeId === "custom") {
    return {
      wMM: Math.min(300, Math.max(40, Number(d.customWMM) || 150)),
      hMM: Math.min(300, Math.max(30, Number(d.customHMM) || 60)),
    };
  }
  const p = COUPON_SIZES.find((s) => s.id === d.sizeId) ?? COUPON_SIZES[0];
  return { wMM: p.wMM, hMM: p.hMM };
}

// ── Jenis ─────────────────────────────────────────────────────────────────

export interface CouponKindMeta {
  id: CouponKind;
  name: string;
  desc: string;
}

export const COUPON_KINDS: CouponKindMeta[] = [
  { id: "kupon", name: "Kupon Diskon", desc: "Potongan harga / promo toko" },
  { id: "voucher", name: "Voucher Belanja", desc: "Bernilai rupiah, bisa ditukar" },
  { id: "tiket", name: "Tiket Event", desc: "Konser, seminar, pertunjukan" },
  { id: "pass", name: "Tiket Masuk", desc: "Wahana, wisata, parkir, museum" },
  { id: "giftcard", name: "Gift Card", desc: "Kartu hadiah bernilai" },
  { id: "undian", name: "Kupon Undian", desc: "Doorprize & undian bernomor" },
];

let idCounter = 0;
export const newRowId = () => `r${Date.now().toString(36)}${(idCounter++).toString(36)}`;

const row = (label: string, value: string): DetailRow => ({ id: newRowId(), label, value });

/** Isi & struktur bawaan per jenis. Tidak menyentuh gaya visual (warna, pola, dsb). */
export function kindPatch(kind: CouponKind): Partial<CouponDesign> {
  const base: Partial<CouponDesign> = {
    kind,
    subtitle: "",
    footer: "",
    validityMode: "until",
    validLabel: "Berlaku s/d",
    validFrom: "",
    validUntil: "2026-12-31",
    validText: "",
    stubNote: "Tunjukkan kode ini saat penukaran",
    codeLabel: "KODE",
    codeMode: "qr",
    showCodeText: true,
    showSerial: false,
    qrPayload: "{kode}",
  };
  switch (kind) {
    case "kupon":
      return {
        ...base,
        sizeId: "kupon-std", stub: "right", stubPct: 26,
        label: "KUPON DISKON", title: "Diskon Spesial Akhir Tahun", value: "50%", unit: "DISKON",
        description: "Berlaku untuk semua produk pilihan. Tunjukkan kupon ini ke kasir sebelum pembayaran.",
        details: [row("Min. belanja", "Rp 200.000"), row("Maks. potongan", "Rp 100.000")],
        terms: "Tidak dapat digabung dengan promo lain.\nSatu kupon untuk satu transaksi.\nKupon yang sudah dipakai tidak dapat digunakan kembali.",
        codeGen: { pattern: "KPN-{RAND:4}-{RAND:4}", charset: "alnum-safe", uppercase: true, seqStart: 1, seqStep: 1, quantity: 20 },
      };
    case "voucher":
      return {
        ...base,
        sizeId: "voucher", stub: "right", stubPct: 27,
        label: "VOUCHER BELANJA", title: "Voucher Belanja Spesial", value: "Rp 100.000", unit: "NILAI VOUCHER",
        description: "Dapat ditukar dengan produk apa saja di seluruh gerai kami.",
        details: [row("Diberikan kepada", "{nama}"), row("No. Voucher", "{no:4}")],
        terms: "Tidak dapat diuangkan.\nTidak berlaku kelipatan.\nVoucher hilang tidak dapat diganti.",
        codeGen: { pattern: "VCR-{RAND:4}-{RAND:4}-{RAND:4}", charset: "alnum-safe", uppercase: true, seqStart: 1, seqStep: 1, quantity: 20 },
      };
    case "tiket":
      return {
        ...base,
        sizeId: "tiket-std", stub: "right", stubPct: 28,
        label: "TIKET EVENT", title: "Gamato Music Festival 2026", subtitle: "Malam puncak · semua artis tampil", value: "", unit: "",
        description: "",
        details: [row("Tanggal", "Sabtu, 12 Desember 2026"), row("Waktu", "18.00 WIB – selesai"), row("Lokasi", "Lapangan Kota"), row("Kategori", "{zona}"), row("Kursi", "{kursi}"), row("Atas nama", "{nama}")],
        terms: "Tiket tidak dapat dikembalikan atau ditukar.\nPerlihatkan QR di pintu masuk. Satu QR untuk satu orang.",
        validityMode: "none", validLabel: "Berlaku",
        stubNote: "Pindai QR di pintu masuk",
        showSerial: true,
        codeGen: { pattern: "TKT-{SEQ:5}-{RAND:4}", charset: "alnum-safe", uppercase: true, seqStart: 1, seqStep: 1, quantity: 50 },
      };
    case "pass":
      return {
        ...base,
        sizeId: "tiket-ringkas", stub: "right", stubPct: 27,
        label: "TIKET MASUK", title: "Taman Wisata Gamato", subtitle: "Tiket masuk dewasa", value: "Rp 35.000", unit: "HARGA",
        description: "",
        details: [row("Berlaku untuk", "1 orang · 1 kali masuk"), row("Jam buka", "08.00 – 17.00 WIB")],
        terms: "Tiket hanya berlaku pada tanggal tertera.\nTiket yang sudah dipindai tidak dapat dipakai lagi.",
        validLabel: "Berlaku pada",
        stubNote: "Simpan hingga selesai berkunjung",
        codeGen: { pattern: "ENT-{SEQ:6}", charset: "digits", uppercase: true, seqStart: 1, seqStep: 1, quantity: 100 },
      };
    case "giftcard":
      return {
        ...base,
        sizeId: "kartu", stub: "none", stubPct: 28,
        label: "GIFT CARD", title: "Kartu Hadiah", value: "Rp 250.000", unit: "SALDO HADIAH",
        description: "Nikmati belanja bebas di seluruh gerai kami, kapan saja.",
        details: [row("Untuk", "{nama}")],
        terms: "Saldo tidak dapat diuangkan.",
        validLabel: "Berlaku s/d",
        stubNote: "",
        codeLabel: "KODE KARTU",
        codeGen: { pattern: "GC{RAND:4}-{RAND:4}-{RAND:4}", charset: "alnum-safe", uppercase: true, seqStart: 1, seqStep: 1, quantity: 20 },
      };
    case "undian":
    default:
      return {
        ...base,
        sizeId: "tiket-ringkas", stub: "right", stubPct: 28,
        label: "KUPON UNDIAN", title: "Undian Berhadiah Akhir Tahun", value: "{no:4}", unit: "NOMOR UNDIAN",
        description: "Simpan kupon ini baik-baik. Pemenang diumumkan melalui media sosial kami.",
        details: [row("Hadiah utama", "Sepeda Motor"), row("Pengundian", "31 Desember 2026")],
        terms: "Pemenang wajib membawa potongan kupon yang cocok.\nKeputusan penyelenggara tidak dapat diganggu gugat.",
        validityMode: "none", validLabel: "Berlaku",
        stubNote: "Potongan ini disimpan pembeli",
        codeLabel: "NO. SERI",
        codeGen: { pattern: "UND-{SEQ:5}", charset: "digits", uppercase: true, seqStart: 1, seqStep: 1, quantity: 100 },
      };
  }
}

// ── Template gaya ────────────────────────────────────────────────────────

export interface CouponTemplate {
  id: string;
  name: string;
  desc: string;
  patch: Partial<CouponDesign>;
}

const T = (id: string, name: string, desc: string, patch: Partial<CouponDesign>): CouponTemplate => ({ id, name, desc, patch });

export const COUPON_TEMPLATES: CouponTemplate[] = [
  T("klasik-merah", "Klasik Merah", "Hangat & ramai, cocok untuk promo toko", {
    layout: "value-left", bgMode: "solid", colorBg1: "#fffaf0", colorBg2: "#fffaf0", colorAccent: "#dc2626", colorText: "#3f1d1d",
    stubTone: "accent", pattern: "dots", patternColor: "#dc2626", patternOpacity: 0.07, patternScale: 1, borderStyle: "inset", borderColor: "#dc2626", borderWidth: 0.35,
    radius: 3, edge: "plain", notch: true, notchRadius: 3.2, fontHeading: "Oswald", fontBody: "Poppins", qrColor: "#3f1d1d",
  }),
  T("biru-korporat", "Biru Korporat", "Bersih & profesional", {
    layout: "banner-top", bgMode: "gradient", colorBg1: "#f8fafc", colorBg2: "#e0f2fe", gradAngle: 135, colorAccent: "#1d4ed8", colorText: "#0f172a",
    stubTone: "dark", pattern: "grid", patternColor: "#1d4ed8", patternOpacity: 0.05, patternScale: 1, borderStyle: "solid", borderColor: "#1d4ed8", borderWidth: 0.35,
    radius: 2.5, edge: "plain", notch: true, notchRadius: 3, fontHeading: "Montserrat", fontBody: "Montserrat", qrColor: "#0f172a",
  }),
  T("emas-elegan", "Emas Elegan", "Mewah gelap berpadu emas", {
    layout: "value-center", bgMode: "gradient", colorBg1: "#1c1917", colorBg2: "#292524", gradAngle: 160, colorAccent: "#d4af37", colorText: "#fef3c7",
    stubTone: "dark", pattern: "diamonds", patternColor: "#d4af37", patternOpacity: 0.09, patternScale: 1, borderStyle: "double", borderColor: "#d4af37", borderWidth: 0.3,
    radius: 2, edge: "plain", notch: true, notchRadius: 3, fontHeading: "Playfair Display", fontBody: "Montserrat", qrColor: "#1c1917",
  }),
  T("neon-malam", "Neon Malam", "Gelap dengan aksen neon, cocok untuk konser", {
    layout: "banner-top", bgMode: "gradient", colorBg1: "#0f0a2a", colorBg2: "#2e1065", gradAngle: 140, colorAccent: "#22d3ee", colorText: "#f5f3ff",
    stubTone: "dark", pattern: "stripes", patternColor: "#22d3ee", patternOpacity: 0.07, patternScale: 1, borderStyle: "solid", borderColor: "#22d3ee", borderWidth: 0.35,
    radius: 3, edge: "plain", notch: true, notchRadius: 3.2, fontHeading: "Bebas Neue", fontBody: "Poppins", qrColor: "#0f0a2a",
  }),
  T("pastel-ceria", "Pastel Ceria", "Lembut & ceria, tepi bergelombang", {
    layout: "value-left", bgMode: "gradient", colorBg1: "#fdf2f8", colorBg2: "#ede9fe", gradAngle: 120, colorAccent: "#ec4899", colorText: "#4a044e",
    stubTone: "accent", pattern: "confetti", patternColor: "#a855f7", patternOpacity: 0.35, patternScale: 1, borderStyle: "none", borderColor: "#ec4899", borderWidth: 0.3,
    radius: 6, edge: "scallop", notch: false, notchRadius: 3, fontHeading: "Poppins", fontBody: "Poppins", qrColor: "#4a044e",
  }),
  T("tropis-hijau", "Tropis Hijau", "Segar dan alami", {
    layout: "minimal", bgMode: "gradient", colorBg1: "#ecfdf5", colorBg2: "#d1fae5", gradAngle: 150, colorAccent: "#059669", colorText: "#064e3b",
    stubTone: "accent", pattern: "waves", patternColor: "#059669", patternOpacity: 0.09, patternScale: 1, borderStyle: "inset", borderColor: "#059669", borderWidth: 0.35,
    radius: 4, edge: "plain", notch: true, notchRadius: 3, fontHeading: "Merriweather", fontBody: "Poppins", qrColor: "#064e3b",
  }),
  T("retro-tiket", "Retro Tiket", "Tiket bioskop jadul, tepi bergerigi", {
    layout: "banner-top", bgMode: "solid", colorBg1: "#fef3c7", colorBg2: "#fef3c7", colorAccent: "#b45309", colorText: "#451a03",
    stubTone: "same", pattern: "stripes", patternColor: "#b45309", patternOpacity: 0.06, patternScale: 1, borderStyle: "double", borderColor: "#b45309", borderWidth: 0.3,
    radius: 1, edge: "zigzag", notch: true, notchRadius: 3, fontHeading: "Bebas Neue", fontBody: "Courier New", qrColor: "#451a03",
  }),
  T("minimal-hitam", "Minimal Hitam", "Putih bersih dengan aksen hitam", {
    layout: "minimal", bgMode: "solid", colorBg1: "#ffffff", colorBg2: "#ffffff", colorAccent: "#111827", colorText: "#111827",
    stubTone: "light", pattern: "none", patternColor: "#111827", patternOpacity: 0.06, patternScale: 1, borderStyle: "solid", borderColor: "#111827", borderWidth: 0.3,
    radius: 1, edge: "plain", notch: true, notchRadius: 2.6, fontHeading: "Montserrat", fontBody: "Montserrat", qrColor: "#111827",
  }),
  T("festival-gradasi", "Festival Gradasi", "Gradasi jingga–magenta yang meriah", {
    layout: "value-center", bgMode: "gradient", colorBg1: "#f97316", colorBg2: "#db2777", gradAngle: 120, colorAccent: "#fde047", colorText: "#ffffff",
    stubTone: "dark", pattern: "circles", patternColor: "#ffffff", patternOpacity: 0.12, patternScale: 1, borderStyle: "none", borderColor: "#ffffff", borderWidth: 0.3,
    radius: 4, edge: "plain", notch: true, notchRadius: 3.4, fontHeading: "Poppins", fontBody: "Poppins", qrColor: "#111827",
  }),
  T("gift-merah", "Gift Merah Hati", "Hangat untuk kartu hadiah", {
    layout: "value-center", bgMode: "gradient", colorBg1: "#7f1d1d", colorBg2: "#be123c", gradAngle: 135, colorAccent: "#fecdd3", colorText: "#fff1f2",
    stubTone: "same", pattern: "dots", patternColor: "#ffffff", patternOpacity: 0.08, patternScale: 1, borderStyle: "inset", borderColor: "#fecdd3", borderWidth: 0.3,
    radius: 4, edge: "plain", notch: false, notchRadius: 3, fontHeading: "Playfair Display", fontBody: "Montserrat", qrColor: "#7f1d1d",
  }),
  T("poster-konser", "Poster Konser", "Gaya poster, cocok untuk tiket potret", {
    layout: "poster", bgMode: "solid", colorBg1: "#0b1020", colorBg2: "#0b1020", colorAccent: "#f43f5e", colorText: "#e2e8f0",
    stubTone: "accent", pattern: "stripes", patternColor: "#f43f5e", patternOpacity: 0.06, patternScale: 1, borderStyle: "none", borderColor: "#f43f5e", borderWidth: 0.3,
    radius: 3, edge: "plain", notch: true, notchRadius: 3, fontHeading: "Bebas Neue", fontBody: "Poppins", qrColor: "#0b1020",
  }),
  T("ungu-premium", "Ungu Premium", "Gradasi ungu dengan aksen kuning", {
    layout: "banner-top", bgMode: "gradient", colorBg1: "#4c1d95", colorBg2: "#7c3aed", gradAngle: 135, colorAccent: "#fbbf24", colorText: "#ffffff",
    stubTone: "dark", pattern: "waves", patternColor: "#ffffff", patternOpacity: 0.07, patternScale: 1, borderStyle: "none", borderColor: "#fbbf24", borderWidth: 0.3,
    radius: 3, edge: "plain", notch: true, notchRadius: 3.2, fontHeading: "Montserrat", fontBody: "Montserrat", qrColor: "#2e1065",
  }),
];

export function templateById(id: string): CouponTemplate {
  return COUPON_TEMPLATES.find((t) => t.id === id) ?? COUPON_TEMPLATES[0];
}

export function baseDesign(): CouponDesign {
  return {
    kind: "kupon", templateId: "klasik-merah",
    sizeId: "kupon-std", customWMM: 150, customHMM: 60, stub: "right", stubPct: 26, layout: "value-left",
    brand: "Gamato Store", tagline: "Belanja hemat setiap hari",
    label: "", title: "", subtitle: "", value: "", unit: "", description: "", details: [],
    validityMode: "until", validLabel: "Berlaku s/d", validFrom: "", validUntil: "2026-12-31", validText: "",
    terms: "", footer: "", stubNote: "",
    fontHeading: DEFAULT_FONT_FAMILY, fontBody: DEFAULT_FONT_FAMILY, textScale: 1,
    bgMode: "solid", colorBg1: "#ffffff", colorBg2: "#e2e8f0", gradAngle: 135, bgImage: null, bgImageOverlay: 0.35,
    colorAccent: "#dc2626", colorText: "#111827", stubTone: "accent",
    pattern: "none", patternColor: "#000000", patternOpacity: 0.08, patternScale: 1,
    borderStyle: "none", borderColor: "#111827", borderWidth: 0.35, radius: 3, edge: "plain", notch: true, notchRadius: 3,
    logo: null, logoSize: 1, stampText: "", stampColor: "#dc2626", stampOpacity: 0.28,
    codeMode: "qr", codeLabel: "KODE", showCodeText: true, showSerial: false, qrEcc: "M", qrStyle: "square", qrColor: "#111827", qrPlate: true,
    qrPayload: "{kode}", barcodeFormat: "CODE128",
    codeGen: { pattern: "KPN-{RAND:4}-{RAND:4}", charset: "alnum-safe", uppercase: true, seqStart: 1, seqStep: 1, quantity: 20 },
  };
}

export function defaultCouponDesign(kind: CouponKind = "kupon", templateId = "klasik-merah"): CouponDesign {
  return { ...baseDesign(), ...kindPatch(kind), ...templateById(templateId).patch, templateId } as CouponDesign;
}

/** Ganti jenis: isi + struktur dari `kindPatch`, gaya visual & merek tetap milik pengguna. */
export function applyKind(d: CouponDesign, kind: CouponKind): CouponDesign {
  const p = kindPatch(kind);
  return { ...d, ...p, brand: d.brand, tagline: d.tagline } as CouponDesign;
}

export function applyTemplate(d: CouponDesign, templateId: string): CouponDesign {
  return { ...d, ...templateById(templateId).patch, templateId } as CouponDesign;
}
