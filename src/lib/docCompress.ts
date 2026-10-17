// Kompres Dokumen (gabungan) — satu mesin untuk banyak format.
//
// Cara kerja per jenis berkas (semuanya di browser, tanpa upload):
//   • PDF            → gambar JPEG di dalam PDF dikompres ulang (mesin `compressPdf`), atau
//                      mode agresif: tiap halaman dirender jadi gambar JPEG lalu dirakit ulang.
//   • DOCX/XLSX/PPTX → file ZIP berisi XML + media. Gambar di `*/media/*` dikompres ulang
//     ODT/ODS/ODP      (JPEG/PNG/WEBP), PNG tanpa transparansi bisa dijadikan JPEG (referensi
//     EPUB/ZIP         diperbarui otomatis), lalu ZIP ditulis ulang dengan DEFLATE level 9.
//   • Gambar         → JPG/PNG/WEBP/BMP dikodekan ulang (kualitas + batas dimensi).
//   • DOC/XLS/PPT/RTF/TXT/CSV/JSON/XML/HTML… → tidak bisa “dipadatkan” isinya dengan aman di
//                      browser, jadi dibungkus ZIP (DEFLATE 9). Hasil tetap ZIP yang jujur.
// Aturan emas: hasil TIDAK PERNAH dipakai jika lebih besar dari aslinya.

import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { compressPdf } from "@/lib/pdfCompress";
import { loadPdfDocument } from "@/lib/pdfRender";

export type DocKind = "pdf" | "ooxml" | "odf" | "epub" | "zip" | "image" | "wrap" | "unsupported";

export interface DocKindInfo {
  kind: DocKind;
  ext: string;
  label: string;
  /** Penjelasan singkat apa yang akan dilakukan pada berkas ini. */
  plan: string;
}

const OOXML = new Set(["docx", "xlsx", "pptx", "docm", "xlsm", "pptm", "dotx", "xltx", "potx", "ppsx"]);
const ODF = new Set(["odt", "ods", "odp", "odg", "ott", "ots", "otp"]);
const IMAGE = new Set(["jpg", "jpeg", "png", "webp", "bmp"]);
const WRAP = new Set(["doc", "xls", "ppt", "rtf", "txt", "csv", "tsv", "json", "xml", "html", "htm", "md", "svg", "log", "yaml", "yml", "sql", "css", "js", "ts", "dot", "xlt", "pot", "pps", "wps", "pages", "numbers", "key"]);
const MEDIA = new Set(["mp3", "wav", "ogg", "m4a", "flac", "opus", "aac", "mp4", "mov", "webm", "mkv", "avi", "gif"]);

export function extOf(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export function detectKind(file: { name: string; type?: string }): DocKindInfo {
  const ext = extOf(file.name);
  const mime = file.type || "";
  if (ext === "pdf" || mime === "application/pdf") return { kind: "pdf", ext: "pdf", label: "PDF", plan: "Gambar di dalam PDF dikompres ulang + struktur dipadatkan." };
  if (OOXML.has(ext)) return { kind: "ooxml", ext, label: ext.toUpperCase(), plan: "Gambar di dalam dokumen dikompres ulang, ZIP ditulis ulang DEFLATE 9." };
  if (ODF.has(ext)) return { kind: "odf", ext, label: ext.toUpperCase(), plan: "Gambar di dalam dokumen dikompres ulang, ZIP ditulis ulang DEFLATE 9." };
  if (ext === "epub") return { kind: "epub", ext, label: "EPUB", plan: "Gambar buku dikompres ulang (format tetap), ZIP ditulis ulang." };
  if (ext === "zip") return { kind: "zip", ext, label: "ZIP", plan: "Gambar di dalam ZIP dikompres ulang (format tetap), ZIP ditulis ulang DEFLATE 9." };
  if (IMAGE.has(ext) || /^image\/(jpeg|png|webp|bmp)$/.test(mime)) return { kind: "image", ext: ext || "jpg", label: (ext || "gambar").toUpperCase(), plan: "Gambar dikodekan ulang dengan kualitas & dimensi pilihanmu." };
  if (WRAP.has(ext)) {
    const legacy = ["doc", "xls", "ppt", "dot", "xlt", "pot", "pps", "wps", "rtf"].includes(ext);
    return {
      kind: "wrap",
      ext,
      label: ext.toUpperCase(),
      plan: legacy
        ? "Format biner lama tidak bisa dipadatkan isinya di browser — dibungkus ZIP (DEFLATE 9). Untuk hasil maksimal, simpan ulang sebagai .docx/.xlsx/.pptx lalu kompres."
        : "Berkas teks dibungkus ZIP (DEFLATE 9) — biasanya hemat 60–90%.",
    };
  }
  if (MEDIA.has(ext) || /^(audio|video)\//.test(mime))
    return { kind: "unsupported", ext, label: ext.toUpperCase() || "MEDIA", plan: "Audio/video punya alat khusus: gunakan Kompres Audio atau Kompres Video." };
  return { kind: "wrap", ext, label: ext ? ext.toUpperCase() : "FILE", plan: "Format ini tidak dikenali — dibungkus ZIP (DEFLATE 9)." };
}

export interface DocCompressOptions {
  /** Kualitas JPEG/WEBP 0.2–0.95. */
  quality: number;
  /** Sisi terpanjang maksimum gambar (px). */
  maxDim: number;
  /** PNG tanpa transparansi → JPEG (dokumen OOXML/ODF & gambar mandiri). */
  pngToJpeg: boolean;
  /** PDF: false = kompres gambar JPEG saja (teks tetap), true = rasterisasi halaman (teks jadi gambar). */
  pdfRaster: boolean;
  /** PDF rasterisasi: dpi render. */
  rasterDpi: number;
  signal?: { cancelled: boolean };
  onProgress?: (fraction: number, message?: string) => void;
}

export const LEVEL_PRESETS = {
  low: { quality: 0.85, maxDim: 2400, label: "Ringan" },
  medium: { quality: 0.72, maxDim: 1800, label: "Sedang" },
  high: { quality: 0.55, maxDim: 1280, label: "Tinggi" },
} as const;

export interface DocCompressResult {
  blob: Blob;
  name: string;
  originalSize: number;
  compressedSize: number;
  /** compressed = isi dipadatkan; zip = dibungkus ZIP; original = tidak ada yang bisa dihemat, berkas asli dipertahankan. */
  outcome: "compressed" | "zip" | "original";
  notes: string[];
  images: number;
  converted: number;
}

function stem(name: string): string {
  return name.replace(/\.[^.]+$/, "") || "dokumen";
}

class Cancelled extends Error {
  constructor() {
    super("Dibatalkan.");
  }
}
function checkCancel(o: DocCompressOptions) {
  if (o.signal?.cancelled) throw new Cancelled();
}
export function isCancelled(e: unknown): boolean {
  return e instanceof Cancelled;
}

// ── Gambar ───────────────────────────────────────────────────────────────

function canvasToBlob(c: HTMLCanvasElement, mime: string, q?: number): Promise<Blob | null> {
  return new Promise((res) => c.toBlob((b) => res(b), mime, q));
}

/** Membaca tag orientasi EXIF JPEG (1 = normal). null bila tidak ada. */
export function jpegExifOrientation(b: Uint8Array): number | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let o = 2;
  while (o + 4 < b.length) {
    if (b[o] !== 0xff) return null;
    const marker = b[o + 1];
    const len = (b[o + 2] << 8) | b[o + 3];
    if (marker === 0xe1 && len >= 14 && b[o + 4] === 0x45 && b[o + 5] === 0x78 && b[o + 6] === 0x69 && b[o + 7] === 0x66) {
      const t = o + 10; // awal header TIFF
      const le = b[t] === 0x49;
      const u16 = (p: number) => (le ? b[p] | (b[p + 1] << 8) : (b[p] << 8) | b[p + 1]);
      const u32 = (p: number) => (le ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0 : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0);
      const ifd = t + u32(t + 4);
      if (ifd + 2 > b.length) return null;
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 12 > b.length) return null;
        if (u16(e) === 0x0112) return u16(e + 8);
      }
      return null;
    }
    if (marker === 0xda) return null; // mulai data gambar
    o += 2 + len;
  }
  return null;
}

/** Petunjuk cepat dari header PNG: apakah mungkin punya transparansi? */
export function pngMayHaveAlpha(b: Uint8Array): boolean {
  if (b.length < 33 || b[1] !== 0x50) return true;
  const colorType = b[25];
  if (colorType === 4 || colorType === 6) return true;
  // tRNS (transparansi palet/warna tunggal) muncul sebelum IDAT
  for (let i = 33; i + 8 < Math.min(b.length, 4096 + 33); i++) {
    if (b[i] === 0x74 && b[i + 1] === 0x52 && b[i + 2] === 0x4e && b[i + 3] === 0x53) return true;
    if (b[i] === 0x49 && b[i + 1] === 0x44 && b[i + 2] === 0x41 && b[i + 3] === 0x54) break;
  }
  return false;
}

function canvasHasTransparency(c: HTMLCanvasElement): boolean {
  const ctx = c.getContext("2d")!;
  const { width, height } = c;
  // Pindai per potongan agar hemat memori pada gambar besar.
  const step = 256;
  for (let y = 0; y < height; y += step) {
    const h = Math.min(step, height - y);
    const d = ctx.getImageData(0, y, width, h).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
  }
  return false;
}

export interface ReencodeResult {
  bytes: Uint8Array;
  mime: string;
  ext: string;
  width: number;
  height: number;
}

type ImgMime = "image/jpeg" | "image/png" | "image/webp" | "image/bmp";

function mimeFromExt(ext: string): ImgMime | null {
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "bmp") return "image/bmp";
  return null;
}

/**
 * Mengodekan ulang satu gambar. Mengembalikan null bila hasilnya tidak lebih baik
 * (lebih besar / hampir sama) atau gambar tidak aman diubah — pemanggil lalu memakai aslinya.
 * `allowConvert` = boleh mengubah format (PNG/BMP tanpa transparansi → JPEG).
 */
export async function reencodeImage(
  bytes: Uint8Array,
  ext: string,
  o: Pick<DocCompressOptions, "quality" | "maxDim" | "pngToJpeg">,
  allowConvert: boolean,
  /** Di dalam dokumen/paket: lewati JPEG ber-EXIF-rotasi (menghindari rotasi ganda). */
  skipRotated: boolean
): Promise<ReencodeResult | null> {
  const srcMime = mimeFromExt(ext);
  if (!srcMime) return null;
  if (srcMime === "image/bmp" && !allowConvert) return null; // BMP hanya aman diubah bila format boleh berganti
  if (srcMime === "image/jpeg" && skipRotated) {
    const ori = jpegExifOrientation(bytes);
    if (ori !== null && ori !== 1) return null;
  }
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(new Blob([bytes as BlobPart], { type: srcMime }));
  } catch {
    return null;
  }
  try {
    const w0 = bmp.width, h0 = bmp.height;
    if (!w0 || !h0) return null;
    const scale = Math.min(1, o.maxDim / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, w, h);

    let outMime: ImgMime = srcMime;
    let blob: Blob | null = null;
    if (srcMime === "image/jpeg") {
      blob = await canvasToBlob(canvas, "image/jpeg", o.quality);
    } else if (srcMime === "image/webp") {
      blob = await canvasToBlob(canvas, "image/webp", o.quality);
    } else {
      // PNG / BMP
      const mayAlpha = srcMime === "image/png" ? pngMayHaveAlpha(bytes) : false;
      const opaque = !mayAlpha || !canvasHasTransparency(canvas);
      if (opaque && o.pngToJpeg && allowConvert) {
        outMime = "image/jpeg";
        blob = await canvasToBlob(canvas, "image/jpeg", o.quality);
      } else if (srcMime === "image/png") {
        // tetap PNG: hanya berguna bila diperkecil dimensinya
        if (scale < 1) blob = await canvasToBlob(canvas, "image/png");
      } else if (srcMime === "image/bmp") {
        // BMP mentah selalu jauh lebih besar → PNG sebagai format aman tanpa kehilangan
        outMime = "image/png";
        blob = await canvasToBlob(canvas, "image/png");
      }
    }
    if (!blob) return null;
    const out = new Uint8Array(await blob.arrayBuffer());
    if (out.length >= bytes.length * 0.97) return null;
    return { bytes: out, mime: outMime, ext: outMime === "image/jpeg" ? "jpeg" : outMime === "image/png" ? "png" : "webp", width: w, height: h };
  } finally {
    bmp.close();
  }
}

// ── ZIP package (OOXML / ODF / EPUB / ZIP) ──────────────────────────────

const IMG_ENTRY = /\.(jpe?g|png|webp|bmp)$/i;

function escRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function compressZipPackage(file: File, kind: "ooxml" | "odf" | "epub" | "zip", o: DocCompressOptions): Promise<{ blob: Blob; images: number; converted: number; notes: string[] }> {
  const notes: string[] = [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new Error(`“${file.name}” rusak atau bukan berkas ${extOf(file.name).toUpperCase()} yang valid (bukan arsip ZIP yang utuh).`);
  }
  const entries = Object.values(zip.files).filter((f) => !f.dir);
  const imageEntries = entries.filter((f) => IMG_ENTRY.test(f.name));
  const allowConvert = kind === "ooxml" || kind === "odf";
  const renames = new Map<string, string>(); // jalur lama → jalur baru
  let images = 0;
  let converted = 0;

  for (let i = 0; i < imageEntries.length; i++) {
    checkCancel(o);
    const entry = imageEntries[i];
    o.onProgress?.(0.05 + (0.8 * i) / Math.max(1, imageEntries.length), `Gambar ${i + 1}/${imageEntries.length}…`);
    try {
      const bytes = await entry.async("uint8array");
      const ext = extOf(entry.name);
      const r = await reencodeImage(bytes, ext, o, allowConvert, true);
      if (!r) continue;
      const sameFormat = (mimeFromExt(ext) ?? "") === r.mime;
      if (sameFormat) {
        zip.file(entry.name, r.bytes, { binary: true, createFolders: false });
      } else {
        const newName = entry.name.replace(/\.[^./]+$/, "." + r.ext);
        if (zip.file(newName)) continue; // bentrok nama — lewati demi keamanan
        zip.remove(entry.name);
        zip.file(newName, r.bytes, { binary: true, createFolders: false });
        renames.set(entry.name, newName);
        converted++;
      }
      images++;
    } catch {
      // gambar rusak / tak terdukung → biarkan apa adanya
    }
  }

  // Perbarui referensi bila ada gambar yang berganti ekstensi.
  if (renames.size) {
    if (kind === "ooxml") {
      const relNames = Object.keys(zip.files).filter((n) => /\.rels$/i.test(n));
      for (const rn of relNames) {
        let xml = await zip.file(rn)!.async("string");
        let changed = false;
        for (const [oldPath, newPath] of renames) {
          const oldBase = oldPath.split("/").pop()!;
          const newBase = newPath.split("/").pop()!;
          // Hanya cocokkan Target yang menunjuk ke jalur media yang sama (…/media/<nama>), bukan sembarang nama.
          const dir = oldPath.split("/").slice(-2, -1)[0] ?? "";
          const re = new RegExp(`(Target\\s*=\\s*["'][^"']*${escRe(dir ? dir + "/" : "")})${escRe(oldBase)}(["'])`, "g");
          const next = xml.replace(re, `$1${newBase}$2`);
          if (next !== xml) {
            xml = next;
            changed = true;
          }
        }
        if (changed) zip.file(rn, xml, { createFolders: false });
      }
      const ct = zip.file("[Content_Types].xml");
      if (ct) {
        let xml = await ct.async("string");
        if (!/Extension\s*=\s*["']jpeg["']/i.test(xml)) {
          xml = xml.replace(/<\/Types>\s*$/i, `<Default Extension="jpeg" ContentType="image/jpeg"/></Types>`);
          zip.file("[Content_Types].xml", xml, { createFolders: false });
        }
      }
    } else if (kind === "odf") {
      const parts = ["content.xml", "styles.xml", "META-INF/manifest.xml", "settings.xml"].filter((n) => zip.file(n));
      for (const pn of parts) {
        let xml = await zip.file(pn)!.async("string");
        let changed = false;
        for (const [oldPath, newPath] of renames) {
          const next = xml.split(oldPath).join(newPath);
          if (next !== xml) {
            xml = next;
            changed = true;
          }
        }
        if (pn === "META-INF/manifest.xml") {
          // sinkronkan media-type entri yang berubah menjadi image/jpeg
          for (const [, newPath] of renames) {
            const re = new RegExp(`(<manifest:file-entry[^>]*manifest:full-path="${escRe(newPath)}"[^>]*manifest:media-type=")[^"]*(")`, "g");
            const re2 = new RegExp(`(<manifest:file-entry[^>]*manifest:media-type=")[^"]*("[^>]*manifest:full-path="${escRe(newPath)}")`, "g");
            const n2 = xml.replace(re, "$1image/jpeg$2").replace(re2, "$1image/jpeg$2");
            if (n2 !== xml) {
              xml = n2;
              changed = true;
            }
          }
        }
        if (changed) zip.file(pn, xml, { createFolders: false });
      }
    }
  }

  checkCancel(o);
  // ODF/EPUB mewajibkan `mimetype` tidak terkompresi dan ditulis pertama.
  const mt = zip.file("mimetype");
  let outMime = "application/zip";
  if (mt && (kind === "odf" || kind === "epub")) {
    const text = await mt.async("string");
    outMime = text.trim() || outMime;
    zip.remove("mimetype");
    // JSZip menulis berkas sesuai urutan penambahan; kita susun ulang agar mimetype di depan.
    const rest: { name: string; data: Uint8Array; date: Date }[] = [];
    for (const f of Object.values(zip.files)) {
      if (f.dir) continue;
      rest.push({ name: f.name, data: await f.async("uint8array"), date: f.date });
    }
    const fresh = new JSZip();
    fresh.file("mimetype", text, { compression: "STORE", createFolders: false });
    for (const r of rest) fresh.file(r.name, r.data, { binary: true, date: r.date, createFolders: false });
    o.onProgress?.(0.92, "Menulis ulang ZIP…");
    const blob = await fresh.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 }, mimeType: outMime });
    return { blob, images, converted, notes };
  }
  o.onProgress?.(0.92, "Menulis ulang ZIP…");
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    mimeType: kind === "ooxml" ? officeMime(extOf(file.name)) : outMime,
  });
  return { blob, images, converted, notes };
}

function officeMime(ext: string): string {
  switch (ext) {
    case "docx": case "docm": case "dotx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xlsx": case "xlsm": case "xltx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "pptx": case "pptm": case "potx": case "ppsx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    default: return "application/zip";
  }
}

// ── PDF ──────────────────────────────────────────────────────────────────

async function compressPdfRaster(file: File, o: DocCompressOptions): Promise<Blob> {
  const buf = await file.arrayBuffer();
  const pdf = await loadPdfDocument(buf.slice(0));
  const out = await PDFDocument.create();
  const scale = Math.max(0.5, Math.min(4, o.rasterDpi / 72));
  for (let p = 1; p <= pdf.numPages; p++) {
    checkCancel(o);
    o.onProgress?.(0.05 + (0.9 * (p - 1)) / pdf.numPages, `Halaman ${p}/${pdf.numPages}…`);
    const page = await pdf.getPage(p);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(vp.width));
    canvas.height = Math.max(1, Math.round(vp.height));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas } as any).promise;
    const blob = await canvasToBlob(canvas, "image/jpeg", o.quality);
    if (!blob) throw new Error("Gagal membuat gambar halaman.");
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const pg = out.addPage([vp1.width, vp1.height]);
    pg.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
    canvas.width = canvas.height = 0;
  }
  const bytes = await out.save({ useObjectStreams: true });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

// ── Pintu masuk ──────────────────────────────────────────────────────────

async function wrapZip(file: File): Promise<Blob> {
  const zip = new JSZip();
  zip.file(file.name, await file.arrayBuffer(), { date: new Date(file.lastModified || Date.now()) });
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 }, mimeType: "application/zip" });
}

export async function compressDocument(file: File, o: DocCompressOptions): Promise<DocCompressResult> {
  const info = detectKind(file);
  const original = file.size;
  const notes: string[] = [];
  const base = stem(file.name);
  let blob!: Blob;
  let name = file.name;
  let outcome: DocCompressResult["outcome"] = "compressed";
  let images = 0;
  let converted = 0;

  o.onProgress?.(0.02, "Membaca berkas…");

  if (info.kind === "unsupported") throw new Error(info.plan);

  const compressPdfBranch = async () => {
    if (o.pdfRaster) {
      blob = await compressPdfRaster(file, o);
      notes.push("Mode agresif: setiap halaman dijadikan gambar JPEG — teks tidak bisa diseleksi/dicari lagi.");
      images = 0;
    } else {
      const r = await compressPdf(await file.arrayBuffer(), "medium", { quality: o.quality, maxDim: o.maxDim });
      blob = new Blob([r.bytes as BlobPart], { type: "application/pdf" });
      images = r.imagesProcessed;
      if (!images) notes.push("Tidak ada gambar JPEG di PDF ini; hanya struktur yang dipadatkan. Untuk PDF hasil scan, coba “Mode agresif”.");
    }
  };

  if (info.kind === "pdf") {
    try {
      await compressPdfBranch();
    } catch (e) {
      if (isCancelled(e)) throw e;
      throw new Error(`“${file.name}” tidak bisa dibaca sebagai PDF (rusak, bukan PDF, atau terkunci password).`);
    }
  } else if (info.kind === "image") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = info.ext === "jpg" ? "jpeg" : info.ext;
    const r = await reencodeImage(bytes, ext, o, true, false);
    if (r) {
      blob = new Blob([r.bytes as BlobPart], { type: r.mime });
      name = `${base}.${r.ext === "jpeg" ? "jpg" : r.ext}`;
      images = 1;
      if (mimeFromExt(ext) !== r.mime) {
        converted = 1;
        notes.push(`Format diubah ke ${r.ext === "jpeg" ? "JPEG" : r.ext.toUpperCase()}.`);
      }
    } else {
      blob = file;
      notes.push("Gambar sudah efisien pada pengaturan ini.");
    }
  } else if (info.kind === "wrap") {
    blob = await wrapZip(file);
    name = `${base}.zip`;
    outcome = "zip";
    if (info.plan.startsWith("Format biner")) notes.push("Format lama dibungkus ZIP — buka ZIP untuk memakai dokumennya.");
  } else {
    const r = await compressZipPackage(file, info.kind, o);
    blob = r.blob;
    images = r.images;
    converted = r.converted;
    if (!images) notes.push("Tidak ada gambar yang bisa dihemat; hanya kompresi ZIP yang diperbarui.");
  }

  o.onProgress?.(1, "Selesai");

  // Aturan emas: jangan pernah lebih besar dari aslinya.
  if (outcome !== "zip" && blob.size >= original) {
    notes.push("Hasil tidak lebih kecil — berkas asli dipertahankan.");
    return { blob: file, name: file.name, originalSize: original, compressedSize: original, outcome: "original", notes, images: 0, converted: 0 };
  }
  if (outcome === "zip" && blob.size >= original) {
    notes.push("Berkas ini sudah padat — ZIP tidak menghemat ruang.");
  }
  if (outcome === "compressed" && info.kind !== "image") {
    const ext = extOf(file.name);
    name = `${base}-gp-kompres.${ext}`;
  } else if (outcome === "compressed") {
    name = name.replace(/(\.[^.]+)$/, "-gp-kompres$1");
  }
  return { blob, name, originalSize: original, compressedSize: blob.size, outcome, notes, images, converted };
}
