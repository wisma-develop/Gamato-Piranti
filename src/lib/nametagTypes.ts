// Model data Name Tag Studio (Spesial > Name Tag).
// Dipisah dari mesin render (nametagEngine.ts) seperti pola cvTypes/cvEngine & businessCardTypes/Engine,
// agar UI bisa mengimpor tipe & pabrik elemen tanpa menarik kode gambar kanvas.

import { DEFAULT_FONT_FAMILY } from "@/lib/fontPresets";
import { PX_PER_MM, PT_PX } from "@/lib/businessCardTypes";

export { PX_PER_MM, PT_PX };

// ── Ukuran ───────────────────────────────────────────────────────────────

export type NtSizeId = "badge-90x120" | "badge-a7" | "badge-a6" | "id-p" | "id-l" | "land-90x55" | "land-100x70" | "bar" | "tent" | "custom";

export interface NtSizePreset { id: NtSizeId; label: string; hint: string; wMM: number; hMM: number }

export const NT_SIZES: NtSizePreset[] = [
  { id: "badge-90x120", label: "Badge Konferensi (90 × 120 mm)", hint: "Potret · tali lanyard", wMM: 90, hMM: 120 },
  { id: "badge-a7", label: "Badge A7 (74 × 105 mm)", hint: "Potret · hemat kertas", wMM: 74, hMM: 105 },
  { id: "badge-a6", label: "Badge A6 (105 × 148 mm)", hint: "Potret · besar", wMM: 105, hMM: 148 },
  { id: "id-p", label: "ID Card Potret (54 × 86 mm)", hint: "Ukuran kartu CR80", wMM: 54, hMM: 86 },
  { id: "id-l", label: "ID Card Lanskap (86 × 54 mm)", hint: "Ukuran kartu CR80", wMM: 86, hMM: 54 },
  { id: "land-90x55", label: "Lanskap (90 × 55 mm)", hint: "Seperti kartu nama", wMM: 90, hMM: 55 },
  { id: "land-100x70", label: "Lanskap (100 × 70 mm)", hint: "Peniti / badge", wMM: 100, hMM: 70 },
  { id: "bar", label: "Name Bar (75 × 30 mm)", hint: "Bros / magnet / peniti", wMM: 75, hMM: 30 },
  { id: "tent", label: "Meja Nama (200 × 60 mm)", hint: "Satu sisi — ekspor bisa dilipat", wMM: 200, hMM: 60 },
  { id: "custom", label: "Ukuran Kustom…", hint: "30–300 mm", wMM: 90, hMM: 55 },
];

export function resolveNtSizeMM(d: Pick<NametagDesign, "sizeId" | "customWMM" | "customHMM">): { wMM: number; hMM: number } {
  if (d.sizeId === "custom") {
    return { wMM: Math.min(300, Math.max(30, d.customWMM || 90)), hMM: Math.min(300, Math.max(20, d.customHMM || 55)) };
  }
  const p = NT_SIZES.find((s) => s.id === d.sizeId) ?? NT_SIZES[0];
  return { wMM: p.wMM, hMM: p.hMM };
}

// ── Data peserta ─────────────────────────────────────────────────────────

export type NtField = "name" | "role" | "org" | "id" | "group" | "event" | "note";

export interface NtRecord {
  name: string; role: string; org: string; id: string; group: string; event: string; note: string;
  /** URL gambar (blob/data) foto orang ini — dipakai elemen “Foto”. */
  photo?: string;
}

export const NT_FIELD_KEYS: NtField[] = ["name", "role", "org", "id", "group", "event", "note"];
export const NT_FIELD_LABEL: Record<NtField, string> = {
  name: "Nama", role: "Peran", org: "Instansi / Perusahaan", id: "Nomor / ID", group: "Grup / Meja / Kelas", event: "Nama Acara", note: "Catatan",
};

export function defaultRecord(): NtRecord {
  return {
    name: "Budi Santoso", role: "Peserta", org: "PT Maju Jaya", id: "A-001", group: "Meja 3",
    event: "Gamato Summit 2026", note: "12 November 2026 · Jakarta",
  };
}

/** Isi token `{nama} {peran} {instansi} {id} {grup} {acara} {catatan}` pada payload QR/barcode. */
export function fillTokens(tpl: string, r: Pick<NtRecord, NtField>): string {
  const map: Record<string, string> = { nama: r.name, peran: r.role, instansi: r.org, id: r.id, grup: r.group, acara: r.event, catatan: r.note };
  return tpl.replace(/\{(nama|peran|instansi|id|grup|acara|catatan)\}/gi, (_, k: string) => map[k.toLowerCase()] ?? "");
}

// ── Peran → warna ────────────────────────────────────────────────────────

export interface NtRoleColor { role: string; color: string }

export function defaultRoles(): NtRoleColor[] {
  return [
    { role: "Peserta", color: "#2563eb" },
    { role: "Panitia", color: "#16a34a" },
    { role: "VIP", color: "#b8860b" },
    { role: "Pembicara", color: "#7c3aed" },
    { role: "Media", color: "#ea580c" },
    { role: "Sponsor", color: "#0891b2" },
    { role: "Staf", color: "#475569" },
  ];
}

const normRole = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function roleColor(design: Pick<NametagDesign, "roles" | "roleFallback">, role: string): string {
  const k = normRole(role);
  if (k) {
    const hit = design.roles.find((r) => normRole(r.role) === k);
    if (hit) return hit.color;
  }
  return design.roleFallback;
}

// ── Elemen ───────────────────────────────────────────────────────────────

interface Base { id: string; xPct: number; yPct: number; rotation: number; opacity: number }

export type NtFit = "none" | "shrink" | "wrap";

export interface NtTextEl extends Base {
  kind: "text";
  bind: NtField | null;
  text: string;
  fontFamily: string;
  fontSize: number; // pt fisik
  color: string;
  /** Warna teks mengikuti warna peran orang tersebut. */
  colorFromRole: boolean;
  bold: boolean; italic: boolean; uppercase: boolean;
  align: "left" | "center" | "right";
  letterSpacing: number; // pt
  widthPct: number;
  /** none = apa adanya · shrink = kecilkan otomatis agar muat 1 baris · wrap = bungkus hingga maxLines lalu kecilkan bila masih meluap */
  fit: NtFit;
  maxLines: number;
}

export interface NtShapeEl extends Base {
  kind: "shape";
  shape: "rect" | "circle" | "line";
  widthPct: number; heightPct: number;
  hasFill: boolean; fill: string;
  /** Isi mengikuti warna peran. */
  fillFromRole: boolean;
  hasStroke: boolean; stroke: string; strokeWidth: number;
  radius: number;
}

export interface NtImageEl extends Base {
  kind: "image";
  src: string;
  widthPct: number; heightPct: number;
  rounded: boolean; circle: boolean;
}

export interface NtPhotoEl extends Base {
  kind: "photo";
  widthPct: number; heightPct: number;
  shape: "circle" | "rounded" | "square";
  borderWidth: number; borderColor: string; borderFromRole: boolean;
  /** 0 = potong dari atas · 100 = dari bawah (wajah biasanya di sekitar 30–40). */
  focusY: number;
}

export interface NtQrEl extends Base {
  kind: "qr";
  payload: string;
  /** Sisi QR sebagai persen LEBAR kartu. */
  sizePct: number;
  fg: string; bg: string; plate: boolean;
  style: "square" | "dots";
  ecc: "L" | "M" | "Q" | "H";
}

export interface NtBarcodeEl extends Base {
  kind: "barcode";
  payload: string;
  widthPct: number; heightPct: number;
  color: string; plate: boolean;
}

export type NtElement = NtTextEl | NtShapeEl | NtImageEl | NtPhotoEl | NtQrEl | NtBarcodeEl;

let counter = 0;
export function newNtId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

export function makeText(o: Partial<NtTextEl> = {}): NtTextEl {
  return {
    id: newNtId("text"), kind: "text", bind: null, text: "Teks baru", xPct: 50, yPct: 50,
    fontFamily: DEFAULT_FONT_FAMILY, fontSize: 11, color: "#0f172a", colorFromRole: false,
    bold: false, italic: false, uppercase: false, align: "center", letterSpacing: 0, widthPct: 80,
    fit: "none", maxLines: 2, rotation: 0, opacity: 1, ...o,
  };
}

export function makeShape(o: Partial<NtShapeEl> = {}): NtShapeEl {
  return {
    id: newNtId("shape"), kind: "shape", shape: "rect", xPct: 50, yPct: 50, widthPct: 30, heightPct: 10,
    hasFill: true, fill: "#4f46e5", fillFromRole: false, hasStroke: false, stroke: "#0f172a", strokeWidth: 2, radius: 0,
    rotation: 0, opacity: 1, ...o,
  };
}

export function makeImage(o: Partial<NtImageEl> = {}): NtImageEl {
  return { id: newNtId("image"), kind: "image", src: "", xPct: 50, yPct: 50, widthPct: 20, heightPct: 20, rounded: false, circle: false, rotation: 0, opacity: 1, ...o };
}

export function makePhoto(o: Partial<NtPhotoEl> = {}): NtPhotoEl {
  return {
    id: newNtId("photo"), kind: "photo", xPct: 50, yPct: 40, widthPct: 40, heightPct: 30, shape: "circle",
    borderWidth: 0, borderColor: "#ffffff", borderFromRole: false, focusY: 35, rotation: 0, opacity: 1, ...o,
  };
}

export function makeQr(o: Partial<NtQrEl> = {}): NtQrEl {
  return {
    id: newNtId("qr"), kind: "qr", payload: "{id}", xPct: 50, yPct: 85, sizePct: 22, fg: "#0f172a", bg: "#ffffff",
    plate: true, style: "square", ecc: "M", rotation: 0, opacity: 1, ...o,
  };
}

export function makeBarcode(o: Partial<NtBarcodeEl> = {}): NtBarcodeEl {
  return { id: newNtId("bar"), kind: "barcode", payload: "{id}", xPct: 50, yPct: 88, widthPct: 70, heightPct: 8, color: "#0f172a", plate: false, rotation: 0, opacity: 1, ...o };
}

// ── Latar, sisi, desain ──────────────────────────────────────────────────

export type NtBackground =
  | { type: "solid"; color: string }
  | { type: "gradient"; angle: number; from: string; to: string }
  | { type: "image"; src: string; fit: "cover" | "contain"; overlayColor: string; overlayOpacity: number };

export interface NtSide { background: NtBackground; elements: NtElement[] }

export const emptyNtSide = (): NtSide => ({ background: { type: "solid", color: "#ffffff" }, elements: [] });

export interface NtHole {
  shape: "none" | "slot" | "circle";
  /** Sisi tempat lubang berada. */
  edge: "top" | "left";
  /** Jarak pusat lubang dari tepi (mm). */
  offsetMM: number;
  /** Cetak garis kecil penanda lubang di hasil ekspor (panduan melubangi). */
  mark: boolean;
}

export interface NametagDesign {
  sizeId: NtSizeId; customWMM: number; customHMM: number;
  front: NtSide; back: NtSide;
  roles: NtRoleColor[]; roleFallback: string;
  hole: NtHole;
}

export function blankNtDesign(sizeId: NtSizeId = "badge-90x120"): NametagDesign {
  return {
    sizeId, customWMM: 90, customHMM: 55, front: emptyNtSide(), back: emptyNtSide(),
    roles: defaultRoles(), roleFallback: "#475569",
    hole: { shape: "none", edge: "top", offsetMM: 6, mark: true },
  };
}

// ── Template siap pakai ──────────────────────────────────────────────────

export interface NtTemplateDef { id: string; name: string; desc: string; size: string; build: () => NametagDesign }

const T = (bind: NtField | null, o: Partial<NtTextEl>) => makeText({ bind, ...o });
const sizeLabel = (id: NtSizeId) => { const s = NT_SIZES.find((x) => x.id === id)!; return `${s.wMM}×${s.hMM} mm`; };

function simpleBack(bg: string, fg: string, accent: string, qrFg = "#0f172a"): NtSide {
  return {
    background: { type: "solid", color: bg },
    elements: [
      T("event", { text: "Nama Acara", xPct: 50, yPct: 26, widthPct: 84, fontSize: 12, bold: true, color: fg, fit: "wrap", maxLines: 2 }),
      T("note", { text: "Catatan acara", xPct: 50, yPct: 38, widthPct: 84, fontSize: 8, color: accent, fit: "wrap", maxLines: 2 }),
      makeQr({ payload: "{id}", xPct: 50, yPct: 66, sizePct: 36, fg: qrFg, bg: "#ffffff", plate: true }),
      T("id", { text: "ID", xPct: 50, yPct: 88, widthPct: 70, fontSize: 9, color: fg, fontFamily: "JetBrains Mono" }),
    ],
  };
}

function build(sizeId: NtSizeId, hole: Partial<NtHole>, front: NtSide, back: NtSide): NametagDesign {
  const d = blankNtDesign(sizeId);
  d.front = front; d.back = back;
  d.hole = { ...d.hole, ...hole };
  return d;
}

const TEMPLATE_META: Omit<NtTemplateDef, "build">[] = [
  { id: "konferensi", name: "Konferensi Modern", desc: "Header gelap, nama besar, pita warna per peran, QR check-in.", size: sizeLabel("badge-90x120") },
  { id: "seminar", name: "Seminar Bersih", desc: "Putih bersih dengan strip & pita peran berwarna.", size: sizeLabel("badge-a7") },
  { id: "panitia", name: "Panitia Bold", desc: "Blok peran vertikal berwarna di sisi kiri — terbaca dari jauh.", size: sizeLabel("land-100x70") },
  { id: "id-karyawan", name: "ID Card Karyawan", desc: "Foto bulat, nama, peran, barcode; sisi belakang berisi QR & alamat kembali.", size: sizeLabel("id-p") },
  { id: "workshop", name: "Workshop Ceria", desc: "Lingkaran warna-warni, nama besar, label peran.", size: sizeLabel("badge-a7") },
  { id: "vip-gold", name: "VIP Gold", desc: "Latar gelap, bingkai & aksen emas, nama serif.", size: sizeLabel("badge-90x120") },
  { id: "sekolah", name: "Sekolah / MOS", desc: "Foto siswa, kelas, nomor induk, pita peran di bawah.", size: sizeLabel("land-90x55") },
  { id: "meja-elegan", name: "Meja Nama Elegan", desc: "Kaligrafi emas di atas krem — ekspor lipat dua (tent card).", size: sizeLabel("tent") },
  { id: "hackathon", name: "Hackathon Neon", desc: "Gelap pekat dengan aksen neon cyan & QR.", size: sizeLabel("badge-a7") },
  { id: "komunitas", name: "Komunitas “Halo, Saya…”", desc: "Gradasi hangat, kartu putih membulat, sapaan ramah.", size: sizeLabel("land-90x55") },
  { id: "name-bar", name: "Name Bar Ringkas", desc: "Bilah kecil untuk bros/magnet: nama + instansi + aksen peran.", size: sizeLabel("bar") },
];

const BUILDERS: Record<string, () => NametagDesign> = {
  konferensi: () => build("badge-90x120", { shape: "slot", edge: "top", offsetMM: 6 }, {
    background: { type: "solid", color: "#ffffff" },
    elements: [
      makeShape({ xPct: 50, yPct: 11, widthPct: 100, heightPct: 22, fill: "#0f172a" }),
      T("event", { text: "Nama Acara", xPct: 50, yPct: 12, widthPct: 86, fontSize: 11, bold: true, uppercase: true, letterSpacing: 1.5, color: "#ffffff", fit: "shrink" }),
      T("note", { text: "Tanggal · Lokasi", xPct: 50, yPct: 18, widthPct: 86, fontSize: 7.5, color: "#94a3b8", fit: "shrink" }),
      T("name", { text: "Nama Lengkap", xPct: 50, yPct: 42, widthPct: 86, fontSize: 25, bold: true, color: "#0f172a", fit: "wrap", maxLines: 2 }),
      T("org", { text: "Instansi", xPct: 50, yPct: 56, widthPct: 86, fontSize: 12, color: "#475569", fit: "shrink" }),
      makeShape({ xPct: 50, yPct: 70, widthPct: 100, heightPct: 12, fill: "#2563eb", fillFromRole: true }),
      T("role", { text: "PESERTA", xPct: 50, yPct: 70, widthPct: 90, fontSize: 16, bold: true, uppercase: true, letterSpacing: 3, color: "#ffffff", fit: "shrink" }),
      makeQr({ payload: "{id}", xPct: 50, yPct: 88, sizePct: 22 }),
      T("id", { text: "A-001", xPct: 9, yPct: 88, widthPct: 28, fontSize: 9, align: "left", color: "#334155", fontFamily: "JetBrains Mono", fit: "shrink" }),
      T("group", { text: "Meja 3", xPct: 91, yPct: 88, widthPct: 28, fontSize: 9, align: "right", color: "#334155", fit: "shrink" }),
    ],
  }, simpleBack("#0f172a", "#ffffff", "#94a3b8")),

  seminar: () => build("badge-a7", { shape: "slot", edge: "top", offsetMM: 5 }, {
    background: { type: "solid", color: "#ffffff" },
    elements: [
      makeShape({ xPct: 50, yPct: 3, widthPct: 100, heightPct: 6, fill: "#2563eb", fillFromRole: true }),
      T("event", { text: "Nama Acara", xPct: 50, yPct: 14, widthPct: 88, fontSize: 8.5, uppercase: true, letterSpacing: 1.5, color: "#64748b", bold: true, fit: "shrink" }),
      T("name", { text: "Nama Lengkap", xPct: 50, yPct: 38, widthPct: 88, fontSize: 22, bold: true, color: "#0f172a", fit: "wrap", maxLines: 3 }),
      makeShape({ shape: "line", xPct: 50, yPct: 54, widthPct: 18, heightPct: 0.7, fill: "#2563eb", fillFromRole: true }),
      T("org", { text: "Instansi", xPct: 50, yPct: 62, widthPct: 88, fontSize: 11, color: "#334155", fit: "wrap", maxLines: 2 }),
      T("group", { text: "Grup", xPct: 50, yPct: 74, widthPct: 88, fontSize: 9, color: "#64748b", fit: "shrink" }),
      makeShape({ xPct: 50, yPct: 93, widthPct: 100, heightPct: 14, fill: "#2563eb", fillFromRole: true }),
      T("role", { text: "PESERTA", xPct: 50, yPct: 93, widthPct: 90, fontSize: 14, bold: true, uppercase: true, letterSpacing: 3, color: "#ffffff", fit: "shrink" }),
    ],
  }, simpleBack("#f8fafc", "#0f172a", "#64748b")),

  panitia: () => build("land-100x70", { shape: "slot", edge: "top", offsetMM: 5 }, {
    background: { type: "solid", color: "#ffffff" },
    elements: [
      makeShape({ xPct: 13, yPct: 50, widthPct: 26, heightPct: 100, fill: "#16a34a", fillFromRole: true }),
      T("role", { text: "PANITIA", xPct: 13, yPct: 50, widthPct: 60, fontSize: 18, bold: true, uppercase: true, letterSpacing: 4, color: "#ffffff", rotation: -90, fit: "shrink" }),
      T("event", { text: "Nama Acara", xPct: 33, yPct: 14, widthPct: 62, fontSize: 8, bold: true, uppercase: true, letterSpacing: 1.5, color: "#94a3b8", align: "left", fit: "shrink" }),
      T("name", { text: "Nama Lengkap", xPct: 33, yPct: 38, widthPct: 62, fontSize: 22, bold: true, color: "#0f172a", align: "left", fit: "wrap", maxLines: 2 }),
      T("org", { text: "Instansi", xPct: 33, yPct: 62, widthPct: 48, fontSize: 11, color: "#475569", align: "left", fit: "shrink" }),
      T("id", { text: "A-001", xPct: 33, yPct: 84, widthPct: 40, fontSize: 9.5, color: "#64748b", align: "left", fontFamily: "JetBrains Mono", fit: "shrink" }),
      makeQr({ payload: "{id}", xPct: 87, yPct: 72, sizePct: 17, plate: false }),
    ],
  }, simpleBack("#0f172a", "#ffffff", "#94a3b8")),

  "id-karyawan": () => build("id-p", { shape: "slot", edge: "top", offsetMM: 5 }, {
    background: { type: "solid", color: "#ffffff" },
    elements: [
      makeShape({ xPct: 50, yPct: 15, widthPct: 100, heightPct: 30, fill: "#1e3a8a" }),
      T("org", { text: "PT Maju Jaya", xPct: 50, yPct: 10, widthPct: 88, fontSize: 9, bold: true, uppercase: true, letterSpacing: 1.2, color: "#ffffff", fit: "shrink" }),
      T(null, { text: "KARTU IDENTITAS", xPct: 50, yPct: 15, widthPct: 88, fontSize: 5.5, uppercase: true, letterSpacing: 1.8, color: "#bfdbfe" }),
      makePhoto({ xPct: 50, yPct: 35, widthPct: 46, heightPct: 29, borderWidth: 6, borderColor: "#ffffff" }),
      T("name", { text: "Nama Lengkap", xPct: 50, yPct: 59, widthPct: 88, fontSize: 13, bold: true, color: "#0f172a", fit: "wrap", maxLines: 2 }),
      T("role", { text: "STAF", xPct: 50, yPct: 68.5, widthPct: 88, fontSize: 8.5, bold: true, uppercase: true, letterSpacing: 2, color: "#2563eb", colorFromRole: true, fit: "shrink" }),
      T("id", { text: "A-001", xPct: 50, yPct: 74, widthPct: 88, fontSize: 8, color: "#475569", fontFamily: "JetBrains Mono", fit: "shrink" }),
      makeBarcode({ payload: "{id}", xPct: 50, yPct: 87, widthPct: 78, heightPct: 9 }),
      makeShape({ xPct: 50, yPct: 98, widthPct: 100, heightPct: 4, fill: "#2563eb", fillFromRole: true }),
    ],
  }, {
    background: { type: "solid", color: "#f8fafc" },
    elements: [
      T(null, { text: "Jika kartu ini ditemukan, mohon dikembalikan ke:", xPct: 50, yPct: 16, widthPct: 84, fontSize: 7, color: "#475569", fit: "wrap", maxLines: 3 }),
      T("org", { text: "PT Maju Jaya", xPct: 50, yPct: 31, widthPct: 84, fontSize: 10, bold: true, color: "#0f172a", fit: "wrap", maxLines: 2 }),
      T("note", { text: "Alamat / telepon", xPct: 50, yPct: 43, widthPct: 84, fontSize: 7, color: "#64748b", fit: "wrap", maxLines: 3 }),
      makeQr({ payload: "{id}", xPct: 50, yPct: 70, sizePct: 52, plate: true }),
      T("id", { text: "A-001", xPct: 50, yPct: 90, widthPct: 80, fontSize: 8, color: "#334155", fontFamily: "JetBrains Mono" }),
    ],
  }),

  workshop: () => build("badge-a7", { shape: "slot", edge: "top", offsetMM: 5 }, {
    background: { type: "solid", color: "#fff7ed" },
    elements: [
      makeShape({ shape: "circle", xPct: 90, yPct: 7, widthPct: 44, heightPct: 31, fill: "#fb7185", opacity: 0.85 }),
      makeShape({ shape: "circle", xPct: 3, yPct: 30, widthPct: 24, heightPct: 17, fill: "#facc15", opacity: 0.85 }),
      makeShape({ shape: "circle", xPct: 94, yPct: 98, widthPct: 42, heightPct: 30, fill: "#38bdf8", opacity: 0.8 }),
      T("event", { text: "Nama Acara", xPct: 10, yPct: 16, widthPct: 56, fontSize: 9, bold: true, uppercase: true, letterSpacing: 1, color: "#9a3412", align: "left", fit: "wrap", maxLines: 2 }),
      T("name", { text: "Nama Lengkap", xPct: 10, yPct: 44, widthPct: 82, fontSize: 22, bold: true, color: "#1c1917", align: "left", fit: "wrap", maxLines: 3 }),
      T("org", { text: "Instansi", xPct: 10, yPct: 60, widthPct: 82, fontSize: 11, color: "#ea580c", align: "left", fit: "wrap", maxLines: 2 }),
      makeShape({ xPct: 32, yPct: 73, widthPct: 44, heightPct: 9, fill: "#2563eb", fillFromRole: true, radius: 40 }),
      T("role", { text: "PESERTA", xPct: 32, yPct: 73, widthPct: 40, fontSize: 9, bold: true, uppercase: true, letterSpacing: 1.5, color: "#ffffff", fit: "shrink" }),
      makeQr({ payload: "{id}", xPct: 80, yPct: 84, sizePct: 22 }),
    ],
  }, simpleBack("#fb7185", "#ffffff", "#fff1f2")),

  "vip-gold": () => build("badge-90x120", { shape: "slot", edge: "top", offsetMM: 6 }, {
    background: { type: "solid", color: "#0b1220" },
    elements: [
      makeShape({ xPct: 50, yPct: 52, widthPct: 92, heightPct: 90, hasFill: false, hasStroke: true, stroke: "#c9a227", strokeWidth: 3 }),
      T("event", { text: "Nama Acara", xPct: 50, yPct: 14, widthPct: 74, fontSize: 9, bold: true, uppercase: true, letterSpacing: 3, color: "#c9a227", fit: "shrink" }),
      makeShape({ shape: "line", xPct: 50, yPct: 19, widthPct: 30, heightPct: 0.5, fill: "#c9a227" }),
      T("role", { text: "VIP", xPct: 50, yPct: 27, widthPct: 74, fontSize: 15, bold: true, uppercase: true, letterSpacing: 7, color: "#c9a227", fit: "shrink" }),
      T("name", { text: "Nama Lengkap", xPct: 50, yPct: 46, widthPct: 78, fontSize: 24, bold: true, color: "#ffffff", fontFamily: "Playfair Display", fit: "wrap", maxLines: 2 }),
      T("org", { text: "Instansi", xPct: 50, yPct: 60, widthPct: 78, fontSize: 11, color: "#cbd5e1", fit: "shrink" }),
      makeShape({ shape: "line", xPct: 50, yPct: 67, widthPct: 20, heightPct: 0.5, fill: "#c9a227" }),
      T("group", { text: "Meja VIP", xPct: 50, yPct: 72, widthPct: 74, fontSize: 9, uppercase: true, letterSpacing: 2, color: "#c9a227", fit: "shrink" }),
      makeQr({ payload: "{id}", xPct: 50, yPct: 87, sizePct: 20, plate: true }),
    ],
  }, simpleBack("#0b1220", "#ffffff", "#c9a227", "#0b1220")),

  sekolah: () => build("land-90x55", { shape: "slot", edge: "top", offsetMM: 4.5 }, {
    background: { type: "solid", color: "#f0f9ff" },
    elements: [
      makeShape({ xPct: 50, yPct: 14, widthPct: 100, heightPct: 28, fill: "#0ea5e9" }),
      T("event", { text: "Masa Orientasi Siswa", xPct: 50, yPct: 19, widthPct: 84, fontSize: 9.5, bold: true, uppercase: true, letterSpacing: 1, color: "#ffffff", fit: "shrink" }),
      makePhoto({ xPct: 21, yPct: 62, widthPct: 30, heightPct: 49, shape: "rounded", borderWidth: 4, borderColor: "#ffffff" }),
      T("name", { text: "Nama Siswa", xPct: 40, yPct: 50, widthPct: 56, fontSize: 15, bold: true, color: "#0c4a6e", align: "left", fit: "wrap", maxLines: 2 }),
      T("group", { text: "Kelas X-A", xPct: 40, yPct: 67, widthPct: 56, fontSize: 10, color: "#0369a1", align: "left", fit: "shrink" }),
      T("id", { text: "NIS 12345", xPct: 40, yPct: 77, widthPct: 56, fontSize: 8.5, color: "#64748b", align: "left", fontFamily: "JetBrains Mono", fit: "shrink" }),
      makeShape({ xPct: 50, yPct: 95, widthPct: 100, heightPct: 10, fill: "#16a34a", fillFromRole: true }),
      T("role", { text: "PESERTA", xPct: 50, yPct: 95, widthPct: 90, fontSize: 7, bold: true, uppercase: true, letterSpacing: 2, color: "#ffffff", fit: "shrink" }),
    ],
  }, simpleBack("#0ea5e9", "#ffffff", "#e0f2fe")),

  "meja-elegan": () => build("tent", { shape: "none" }, {
    background: { type: "solid", color: "#faf6ec" },
    elements: [
      makeShape({ xPct: 50, yPct: 50, widthPct: 96, heightPct: 84, hasFill: false, hasStroke: true, stroke: "#c9a227", strokeWidth: 3 }),
      T("name", { text: "Nama Tamu", xPct: 50, yPct: 44, widthPct: 80, fontSize: 38, color: "#3f3421", fontFamily: "Great Vibes", fit: "shrink" }),
      makeShape({ shape: "line", xPct: 50, yPct: 66, widthPct: 24, heightPct: 0.6, fill: "#c9a227" }),
      T("org", { text: "Instansi / Keluarga", xPct: 50, yPct: 78, widthPct: 70, fontSize: 11, uppercase: true, letterSpacing: 3, color: "#8a7a4f", fit: "shrink" }),
    ],
  }, emptyNtSide()),

  hackathon: () => build("badge-a7", { shape: "slot", edge: "top", offsetMM: 5 }, {
    background: { type: "solid", color: "#020617" },
    elements: [
      makeShape({ shape: "line", xPct: 50, yPct: 14, widthPct: 70, heightPct: 0.4, fill: "#22d3ee" }),
      T("event", { text: "Nama Acara", xPct: 50, yPct: 10, widthPct: 86, fontSize: 8, uppercase: true, letterSpacing: 2, color: "#22d3ee", fontFamily: "JetBrains Mono", fit: "shrink" }),
      T("name", { text: "Nama Lengkap", xPct: 50, yPct: 34, widthPct: 86, fontSize: 21, bold: true, color: "#f8fafc", fit: "wrap", maxLines: 3 }),
      makeShape({ xPct: 50, yPct: 54, widthPct: 62, heightPct: 8, hasFill: false, hasStroke: true, stroke: "#22d3ee", strokeWidth: 3, radius: 14 }),
      T("role", { text: "PESERTA", xPct: 50, yPct: 54, widthPct: 56, fontSize: 9, uppercase: true, letterSpacing: 2.5, color: "#22d3ee", fontFamily: "JetBrains Mono", fit: "shrink" }),
      T("org", { text: "Instansi", xPct: 50, yPct: 66, widthPct: 86, fontSize: 10, color: "#94a3b8", fit: "wrap", maxLines: 2 }),
      T("id", { text: "A-001", xPct: 50, yPct: 74, widthPct: 86, fontSize: 9, color: "#22d3ee", fontFamily: "JetBrains Mono", fit: "shrink" }),
      makeQr({ payload: "{id}", xPct: 50, yPct: 89, sizePct: 22, fg: "#020617", bg: "#ffffff", plate: true }),
    ],
  }, simpleBack("#020617", "#f8fafc", "#22d3ee", "#020617")),

  komunitas: () => build("land-90x55", { shape: "slot", edge: "top", offsetMM: 4.5 }, {
    background: { type: "gradient", angle: 135, from: "#fde68a", to: "#fca5a5" },
    elements: [
      makeShape({ xPct: 50, yPct: 54, widthPct: 92, heightPct: 84, fill: "#ffffff", radius: 36, opacity: 0.96 }),
      T(null, { text: "Halo, saya", xPct: 50, yPct: 22, widthPct: 80, fontSize: 11, bold: true, uppercase: true, letterSpacing: 3, color: "#ef4444", colorFromRole: true, fit: "shrink" }),
      T("name", { text: "Nama Saya", xPct: 50, yPct: 50, widthPct: 80, fontSize: 24, bold: true, color: "#111827", fontFamily: "Poppins", fit: "wrap", maxLines: 2 }),
      T("org", { text: "Komunitas", xPct: 50, yPct: 75, widthPct: 80, fontSize: 10, color: "#6b7280", fit: "shrink" }),
      T("role", { text: "ANGGOTA", xPct: 50, yPct: 86, widthPct: 70, fontSize: 7.5, bold: true, uppercase: true, letterSpacing: 2, color: "#ef4444", colorFromRole: true, fit: "shrink" }),
    ],
  }, simpleBack("#fca5a5", "#7f1d1d", "#991b1b")),

  "name-bar": () => build("bar", { shape: "none" }, {
    background: { type: "solid", color: "#ffffff" },
    elements: [
      makeShape({ xPct: 2.5, yPct: 50, widthPct: 5, heightPct: 100, fill: "#2563eb", fillFromRole: true }),
      T("name", { text: "Nama Lengkap", xPct: 10, yPct: 40, widthPct: 80, fontSize: 15, bold: true, color: "#0f172a", align: "left", fit: "shrink" }),
      T("org", { text: "Instansi", xPct: 10, yPct: 72, widthPct: 66, fontSize: 8.5, color: "#64748b", align: "left", fit: "shrink" }),
      T("role", { text: "PESERTA", xPct: 94, yPct: 20, widthPct: 30, fontSize: 6.5, bold: true, uppercase: true, letterSpacing: 1.2, color: "#2563eb", colorFromRole: true, align: "right", fit: "shrink" }),
    ],
  }, emptyNtSide()),
};

export const NT_TEMPLATES: NtTemplateDef[] = TEMPLATE_META.map((t) => ({ ...t, build: BUILDERS[t.id] }));

export function getNtTemplate(id: string): NametagDesign {
  return (BUILDERS[id] ?? BUILDERS.konferensi)();
}
