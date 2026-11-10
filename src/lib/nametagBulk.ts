// Bulk Name Tag: parsing tabel (tempel/CSV/TSV/XLSX), pemetaan kolom → NtRecord (+ nomor otomatis & foto per orang),
// pengurutan, lalu ekspor ZIP PNG, PDF (1 halaman per sisi), atau PDF lembar cetak (multi-up, crop marks,
// duplex, dan mode LIPAT untuk meja nama). Memakai ulang renderNametagSide → hasil massal IDENTIK dengan pratinjau.

import { PDFDocument, degrees, rgb } from "pdf-lib";
import { renderNametagSide, ntPixelSize } from "@/lib/nametagEngine";
import { BLANK, BulkCancelled, MAX_BULK_ROWS, parseTable, detectDelimiter, sheetLayout, type BulkProgress, type SheetPaper } from "@/lib/businessCardBulk";
import { NT_FIELD_KEYS, roleColor, type NametagDesign, type NtField, type NtRecord } from "@/lib/nametagTypes";
import { canvasToBlob } from "@/lib/canvas";
import { stampGamatoBranding } from "@/lib/pdfBranding";

export { parseTable, detectDelimiter, BulkCancelled, MAX_BULK_ROWS };
export type { BulkProgress, SheetPaper };

const MM_TO_PT = 2.834645669;

// ── Pemetaan kolom ───────────────────────────────────────────────────────

export type NtMapKey = NtField | "photo";
export type NtMapVal = number | "default" | "blank" | "auto";
export type NtColumnMap = Record<NtMapKey, NtMapVal>;
export const NT_MAP_KEYS: NtMapKey[] = [...NT_FIELD_KEYS, "photo"];

const ALIASES: Record<NtMapKey, string[]> = {
  name: ["nama", "name", "nama lengkap", "fullname", "full name", "nama peserta", "peserta", "nama siswa", "siswa", "nama tamu", "tamu"],
  role: ["peran", "role", "kategori", "category", "tipe", "type", "status", "jabatan", "title"],
  org: ["instansi", "organisasi", "organization", "perusahaan", "company", "sekolah", "asal", "institusi", "kantor", "lembaga", "komunitas"],
  id: ["id", "no", "nomor", "no id", "nomor id", "nis", "nip", "kode", "kode peserta", "ticket", "tiket", "no peserta", "nomor peserta", "no tiket"],
  group: ["grup", "group", "meja", "table", "kelas", "class", "tim", "team", "divisi", "kelompok", "seksi", "bagian"],
  event: ["acara", "event", "kegiatan", "nama acara"],
  note: ["catatan", "note", "keterangan", "info", "tanggal", "date", "deskripsi"],
  photo: ["foto", "photo", "gambar", "image", "pas foto", "file foto", "nama file", "filename", "file"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

export function autoMap(headers: string[]): NtColumnMap {
  const map = {} as NtColumnMap;
  const used = new Set<number>();
  for (const f of NT_MAP_KEYS) {
    let idx = -1;
    const al = ALIASES[f];
    headers.forEach((h, i) => { if (idx < 0 && !used.has(i) && al.includes(norm(h))) idx = i; });
    if (idx < 0) headers.forEach((h, i) => { if (idx < 0 && !used.has(i) && al.some((a) => a.length > 3 && norm(h).includes(a))) idx = i; });
    if (idx >= 0) { map[f] = idx; used.add(idx); }
    else map[f] = f === "name" || f === "photo" ? "blank" : f === "id" ? "auto" : "default";
  }
  return map;
}

export interface NtAutoId { prefix: string; start: number; digits: number }
export const defaultAutoId = (): NtAutoId => ({ prefix: "ID-", start: 1, digits: 3 });

/** Kunci pencocokan nama berkas foto ↔ isian tabel: tanpa ekstensi, huruf kecil, tanpa tanda baca. */
export const photoKey = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\.[a-z0-9]{2,5}$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

export function buildRecords(
  rows: string[][], map: NtColumnMap, defaults: NtRecord, auto: NtAutoId, photos: Map<string, string>
): NtRecord[] {
  return rows.slice(0, MAX_BULK_ROWS).map((r, i) => {
    const rec = {} as NtRecord;
    for (const f of NT_FIELD_KEYS) {
      const m = map[f];
      if (m === "default") rec[f] = defaults[f];
      else if (m === "blank") rec[f] = "";
      else if (m === "auto") rec[f] = `${auto.prefix}${String(auto.start + i).padStart(Math.max(1, auto.digits), "0")}`;
      else rec[f] = (r[m] ?? "").trim();
    }
    const pm = map.photo;
    const keyCell = typeof pm === "number" ? (r[pm] ?? "").trim() : "";
    rec.photo = photos.get(photoKey(keyCell)) ?? photos.get(photoKey(rec.name));
    if (!rec.photo && pm === "default") rec.photo = defaults.photo;
    return rec;
  });
}

/** Nilai ke engine: kosong → ZWSP supaya tidak jatuh ke teks contoh milik template. */
export function forRender(rec: NtRecord): NtRecord {
  const o = { ...rec } as NtRecord;
  for (const f of NT_FIELD_KEYS) o[f] = rec[f] && rec[f].trim() ? rec[f] : BLANK;
  return o;
}

export type NtSortKey = "asli" | "nama" | "peran" | "grup";

/** Urutan indeks hasil pengurutan (stabil) — dipakai UI agar edit/hapus tetap menunjuk baris aslinya. */
export function sortIndices(recs: NtRecord[], by: NtSortKey, design: Pick<NametagDesign, "roles">): number[] {
  const idx = recs.map((_, i) => i);
  if (by === "asli") return idx;
  const cmp = (a: string, b: string) => a.localeCompare(b, "id", { numeric: true, sensitivity: "base" });
  const roleIdx = (r: string) => { const i = design.roles.findIndex((x) => norm(x.role) === norm(r)); return i < 0 ? 999 : i; };
  return idx.sort((ia, ib) => {
    const a = recs[ia], b = recs[ib];
    let c = 0;
    if (by === "nama") c = cmp(a.name, b.name);
    else if (by === "grup") c = cmp(a.group, b.group) || cmp(a.name, b.name);
    else c = roleIdx(a.role) - roleIdx(b.role) || cmp(a.name, b.name);
    return c || ia - ib;
  });
}

export function sortRecords(recs: NtRecord[], by: NtSortKey, design: Pick<NametagDesign, "roles">): NtRecord[] {
  return sortIndices(recs, by, design).map((i) => recs[i]);
}

/** Unggah foto: diperkecil (sisi terpanjang ≤ maxPx) lalu dijadikan blob URL — hemat memori untuk ratusan foto. */
export async function ingestPhoto(file: File, maxPx = 900): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("Gambar tidak bisa dibaca")); });
    const sc = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    if (sc >= 1 && file.size < 600_000) return url;
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(img.naturalWidth * sc)); cv.height = Math.max(1, Math.round(img.naturalHeight * sc));
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return url;
    URL.revokeObjectURL(url);
    return URL.createObjectURL(blob);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

export const SAMPLE_TABLE = `Nama\tPeran\tInstansi\tID\tGrup\tFoto
Budi Santoso\tPeserta\tPT Maju Jaya\tA-001\tMeja 1\tbudi.jpg
Siti Rahmawati\tPanitia\tUniversitas Nusantara\tA-002\tKoordinator\tsiti.jpg
Dr. Agus Wijayakusuma, M.Kom.\tPembicara\tInstitut Teknologi Bali\tA-003\tPanel 2\tagus.jpg
Dewi Lestari\tVIP\tKementerian Pariwisata\tA-004\tMeja VIP\t
I Gusti Ngurah Bagus Mahendra Putra\tMedia\tRadio Singaraja FM\tA-005\tPress\t
Ayu Ting Ting\tSponsor\tCV Sinar Abadi\tA-006\tBooth 4\t`;

export function csvTemplate(): string {
  return "Nama,Peran,Instansi,ID,Grup,Acara,Catatan,Foto\n\"Nama Lengkap\",\"Peserta\",\"Nama Instansi\",\"A-001\",\"Meja 1\",\"Nama Acara\",\"12 November 2026\",\"nama-file-foto.jpg\"\n";
}

const q = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
/** Daftar akhir (termasuk ID otomatis) sebagai CSV — dipakai untuk daftar hadir / arsip. */
export function recordsToCsv(recs: NtRecord[]): string {
  return "No,Nama,Peran,Instansi,ID,Grup,Acara,Catatan\n" + recs.map((r, i) => [i + 1, r.name, r.role, r.org, r.id, r.group, r.event, r.note].map((v) => q(String(v))).join(",")).join("\n") + "\n";
}

/** Ringkasan peran → jumlah, untuk panel bulk. */
export function roleSummary(recs: NtRecord[], design: Pick<NametagDesign, "roles" | "roleFallback">): { role: string; count: number; color: string; known: boolean }[] {
  const m = new Map<string, { role: string; count: number }>();
  for (const r of recs) {
    const k = norm(r.role) || "(tanpa peran)";
    const cur = m.get(k) ?? { role: r.role.trim() || "(tanpa peran)", count: 0 };
    cur.count++; m.set(k, cur);
  }
  return [...m.values()].map((x) => ({ ...x, color: roleColor(design, x.role), known: design.roles.some((r) => norm(r.role) === norm(x.role)) })).sort((a, b) => b.count - a.count);
}

// ── Ekspor ───────────────────────────────────────────────────────────────

export interface NtBulkCommon {
  design: NametagDesign;
  records: NtRecord[];
  sides: "front" | "both";
  cache: Map<string, HTMLImageElement>;
  /** Piksel per mm: 12 (≈300 dpi) atau 24 (≈600 dpi). */
  ppm: number;
  signal?: { cancelled: boolean };
  onProgress?: (p: BulkProgress) => void;
}

const slug = (s: string) => (s || "nametag").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "nametag";
const holeMode = (d: NametagDesign) => (d.hole.shape !== "none" && d.hole.mark ? "mark" : "none") as "mark" | "none";
const steps = (o: NtBulkCommon) => o.records.length * (o.sides === "both" ? 2 : 1);

async function renderPng(o: NtBulkCommon, side: "front" | "back", rec: NtRecord, canvas: HTMLCanvasElement): Promise<Uint8Array> {
  await renderNametagSide(canvas, o.design[side], forRender(rec), o.design, o.cache, { ppm: o.ppm, hole: holeMode(o.design) });
  const blob = await canvasToBlob(canvas);
  return new Uint8Array(await blob.arrayBuffer());
}
/** Lepas gambar foto dari cache setelah dipakai agar 1.000 foto tidak menumpuk di memori. */
const release = (o: NtBulkCommon, rec: NtRecord) => { if (rec.photo) o.cache.delete(rec.photo); };

export async function exportNtZip(o: NtBulkCommon): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const canvas = document.createElement("canvas");
  const total = steps(o);
  let done = 0;
  const pad = Math.max(3, String(o.records.length).length);
  for (let i = 0; i < o.records.length; i++) {
    for (const side of (o.sides === "both" ? ["front", "back"] : ["front"]) as ("front" | "back")[]) {
      if (o.signal?.cancelled) throw new BulkCancelled();
      const png = await renderPng(o, side, o.records[i], canvas);
      zip.file(`${String(i + 1).padStart(pad, "0")}-${slug(o.records[i].name)}${o.sides === "both" ? (side === "front" ? "-depan" : "-belakang") : ""}.png`, png, { compression: "STORE" });
      o.onProgress?.({ done: ++done, total });
    }
    release(o, o.records[i]);
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

/** PDF: satu halaman per sisi, ukuran halaman = ukuran name tag. */
export async function exportNtPdf(o: NtBulkCommon): Promise<Blob> {
  const { wMM, hMM } = ntPixelSize(o.design);
  const wPt = wMM * MM_TO_PT, hPt = hMM * MM_TO_PT;
  const pdf = await PDFDocument.create();
  const canvas = document.createElement("canvas");
  const total = steps(o);
  let done = 0;
  for (let i = 0; i < o.records.length; i++) {
    for (const side of (o.sides === "both" ? ["front", "back"] : ["front"]) as ("front" | "back")[]) {
      if (o.signal?.cancelled) throw new BulkCancelled();
      const img = await pdf.embedPng(await renderPng(o, side, o.records[i], canvas));
      pdf.addPage([wPt, hPt]).drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
      o.onProgress?.({ done: ++done, total });
    }
    release(o, o.records[i]);
  }
  await stampGamatoBranding(pdf, { firstPageOnly: true });
  return new Blob([await pdf.save()] as BlobPart[], { type: "application/pdf" });
}

export interface NtSheetOptions { paper: SheetPaper; landscape: boolean; marginMm: number; gapMm: number; cropMarks: boolean; duplexMirror: boolean; tentFold: boolean }

export function ntSheetLayout(design: NametagDesign, s: NtSheetOptions) {
  const { wMM, hMM } = ntPixelSize(design);
  return sheetLayout(wMM, hMM * (s.tentFold ? 2 : 1), s.paper, s.landscape, s.marginMm, s.gapMm);
}

export async function exportNtSheet(o: NtBulkCommon & { sheet: NtSheetOptions }): Promise<{ blob: Blob; pages: number; perPage: number }> {
  const { wMM, hMM } = ntPixelSize(o.design);
  const tent = o.sheet.tentFold;
  const unitH = hMM * (tent ? 2 : 1);
  const L = sheetLayout(wMM, unitH, o.sheet.paper, o.sheet.landscape, o.sheet.marginMm, o.sheet.gapMm);
  if (L.perPage < 1) throw new Error("Name tag tidak muat di halaman dengan margin/ukuran ini — kecilkan margin atau pilih kertas lebih besar.");
  const sides: ("front" | "back")[] = tent || o.sides === "front" ? ["front"] : ["front", "back"];
  const pdf = await PDFDocument.create();
  const canvas = document.createElement("canvas");
  const total = o.records.length * sides.length;
  let done = 0, pages = 0;
  const pageW = L.pageW * MM_TO_PT, pageH = L.pageH * MM_TO_PT;
  const cw = wMM * MM_TO_PT, ch = hMM * MM_TO_PT, uh = unitH * MM_TO_PT;
  const grey = rgb(0.25, 0.25, 0.25);

  const marks = (page: ReturnType<PDFDocument["addPage"]>, x: number, y: number) => {
    const off = 1 * MM_TO_PT, len = Math.min(3, Math.max(1.5, L.gap * 0.7 || 2)) * MM_TO_PT;
    for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + cw, y, 1, -1], [x, y + uh, -1, 1], [x + cw, y + uh, 1, 1]] as const) {
      page.drawLine({ start: { x: cx + sx * off, y: cy }, end: { x: cx + sx * (off + len), y: cy }, thickness: 0.4, color: grey });
      page.drawLine({ start: { x: cx, y: cy + sy * off }, end: { x: cx, y: cy + sy * (off + len) }, thickness: 0.4, color: grey });
    }
  };

  const place = async (side: "front" | "back", recs: NtRecord[], mirror: boolean) => {
    const page = pdf.addPage([pageW, pageH]);
    pages++;
    for (let k = 0; k < recs.length; k++) {
      if (o.signal?.cancelled) throw new BulkCancelled();
      const img = await pdf.embedPng(await renderPng(o, side, recs[k], canvas));
      let col = k % L.cols;
      const row = Math.floor(k / L.cols);
      if (mirror) col = L.cols - 1 - col;
      const x = (L.x0 + col * (wMM + L.gap)) * MM_TO_PT;
      const yTop = (L.y0 + row * (unitH + L.gap)) * MM_TO_PT;
      const y = pageH - yTop - uh; // sudut kiri-bawah unit
      if (tent) {
        page.drawImage(img, { x, y, width: cw, height: ch }); // separuh bawah: tegak
        page.drawImage(img, { x: x + cw, y: y + uh, width: cw, height: ch, rotate: degrees(180) }); // separuh atas: terbalik
        page.drawLine({ start: { x, y: y + ch }, end: { x: x + cw, y: y + ch }, thickness: 0.5, color: grey, dashArray: [3, 3] });
      } else page.drawImage(img, { x, y, width: cw, height: ch });
      if (o.sheet.cropMarks) marks(page, x, y);
      o.onProgress?.({ done: ++done, total });
      release(o, recs[k]);
    }
  };

  for (let s = 0; s < o.records.length; s += L.perPage) {
    const chunk = o.records.slice(s, s + L.perPage);
    await place("front", chunk, false);
    if (sides.length === 2) await place("back", chunk, o.sheet.duplexMirror);
  }
  await stampGamatoBranding(pdf, { firstPageOnly: true });
  return { blob: new Blob([await pdf.save()] as BlobPart[], { type: "application/pdf" }), pages, perPage: L.perPage };
}
