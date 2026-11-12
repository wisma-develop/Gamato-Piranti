// Indeks pencarian alat — dibangun dari `menuGroups` (satu sumber kebenaran menu), sehingga alat baru yang
// ditambahkan ke menu otomatis bisa dicari. Mendukung sinonim Indonesia ⇄ Inggris dan pencocokan toleran.

import type { ReactNode } from "react";
import { menuGroups } from "@/components/layout/Header";

export interface ToolEntry {
  name: string;
  path: string;
  group: string;
  groupId: string;
  section?: string;
  icon: ReactNode;
  kind: "tool" | "category" | "page";
  /** Teks pencarian ternormalisasi. */
  hay: string;
  nameN: string;
}

const norm = (s: string) =>
  s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9+#]+/g, " ").replace(/\s+/g, " ").trim();

/** Kata kunci tambahan per alat (cocok sebagian pada path). */
const KEYWORDS: [string, string][] = [
  ["/qr/qr-code", "qrcode kode qr generator pembuat link wifi"], ["/qr/barcode", "bar code ean upc code128 produk"], ["/qr/scan-qr", "scanner pindai baca qr kamera"],
  ["/pdf/kompres", "compress perkecil ukuran kecilkan pdf"], ["/pdf/gabung", "merge combine satukan pdf"], ["/pdf/pecah", "split bagi pisah pdf"],
  ["/pdf/ocr", "teks dari gambar scan baca tulisan"], ["/pdf/protect", "password kunci enkripsi sandi pdf"], ["/pdf/unlock", "buka kunci password pdf"],
  ["/pdf/tanda-tangan", "sign signature ttd paraf"], ["/pdf/watermark", "cap air logo teks pdf"], ["/pdf/edit", "editor ubah anotasi pdf"],
  ["/pdf/scan", "kamera scanner dokumen foto jadi pdf"], ["/pdf/ke-word", "docx convert konversi pdf"], ["/pdf/word-ke-pdf", "docx convert konversi"],
  ["/image/kompres", "compress perkecil ukuran foto jpg png webp"], ["/image/resize", "resize ubah dimensi ukuran foto"], ["/image/hapus-background", "remove background latar transparan cutout"],
  ["/image/crop", "potong pangkas foto"], ["/image/kolase", "collage grid gabung foto"], ["/image/cetak-foto", "print pas foto 3x4 4x6 layout"],
  ["/image/meme-generator", "meme template lucu"], ["/image/konversi", "convert format jpg png webp heic"], ["/image/photo-editor", "edit filter brightness kontras"],
  ["/audio", "suara musik mp3 wav"], ["/video", "film mp4 klip"], ["/video/kompres", "compress perkecil ukuran video"],
  ["/special/name-tag", "nametag badge id card tanda pengenal peserta panitia lanyard tali meja nama event acara"],
  ["/special/kartu-nama", "business card kontak profesional"], ["/special/kwitansi", "receipt tanda terima pembayaran"], ["/special/invoice", "tagihan faktur billing"],
  ["/special/struk", "nota receipt kasir toko"], ["/special/surat", "letter surat resmi dinas kop"], ["/special/kupon", "voucher tiket coupon diskon"],
  ["/special/sertifikat", "certificate piagam penghargaan"], ["/special/pembuat-cv", "resume curriculum vitae lamaran kerja"], ["/special/wa-link", "whatsapp chat link wa.me"],
  ["/utility/koordinat", "peta map gps lokasi latitude longitude maps"], ["/utility/kalkulator", "hitung calculator pajak bunga"], ["/utility/password-token", "generator sandi acak"],
  ["/utility/json-base64", "format json encode decode"], ["/utility/cetak", "print printer cetak dokumen"], ["/utility/capture-website", "screenshot tangkap layar situs"],
  ["/office/sheet-studio", "excel spreadsheet xlsx tabel rumus"], ["/office/slide-studio", "powerpoint presentasi ppt slide"], ["/office/doc-studio", "word dokumen docx editor"],
];

/** Sinonim kata (Inggris → Indonesia & sebaliknya) untuk perluasan kueri. */
const SYN: Record<string, string[]> = {
  compress: ["kompres"], kompres: ["compress", "perkecil"], perkecil: ["kompres", "compress"], merge: ["gabung"], gabung: ["merge"], split: ["pecah", "pisah"], pecah: ["split"],
  convert: ["konversi", "ubah"], konversi: ["convert"], image: ["gambar", "foto"], gambar: ["image", "foto"], foto: ["gambar", "photo", "image"], photo: ["foto", "gambar"],
  resize: ["ubah ukuran"], crop: ["potong"], potong: ["crop"], rotate: ["putar"], putar: ["rotate"], sign: ["tanda tangan"], print: ["cetak"], cetak: ["print"],
  map: ["peta", "koordinat"], peta: ["map", "koordinat"], location: ["lokasi", "koordinat"], lokasi: ["koordinat", "location"], badge: ["name tag", "nametag"], nametag: ["name tag"],
  invoice: ["tagihan"], receipt: ["kwitansi", "struk"], letter: ["surat"], certificate: ["sertifikat"], password: ["sandi", "kata sandi", "protect"], sandi: ["password"],
  excel: ["sheet", "xlsx"], word: ["docx", "doc"], powerpoint: ["slide", "ppt"], presentasi: ["slide"], voice: ["suara"], suara: ["audio"], music: ["audio", "musik"], film: ["video"],
};

let cache: ToolEntry[] | null = null;

export function getToolIndex(): ToolEntry[] {
  if (cache) return cache;
  const kw = (path: string) => KEYWORDS.filter(([p]) => path === p || path.startsWith(p + "/") || (p.length > 4 && path.startsWith(p))).map(([, k]) => k).join(" ");
  const out: ToolEntry[] = [];
  for (const g of menuGroups) {
    out.push({ name: g.title, path: g.rootPath, group: g.title, groupId: g.id, icon: g.icon, kind: "category", hay: norm(`${g.title} ${kw(g.rootPath)} kategori semua alat`), nameN: norm(g.title) });
    for (const it of g.items) {
      out.push({ name: it.name, path: it.path, group: g.title, groupId: g.id, section: it.section, icon: it.icon, kind: "tool", hay: norm(`${it.name} ${it.section ?? ""} ${g.title} ${kw(it.path)}`), nameN: norm(it.name) });
    }
  }
  cache = out;
  return out;
}

export const POPULAR_PATHS = ["/qr/qr-code", "/pdf/gabung", "/pdf/kompres", "/image/kompres", "/image/hapus-background", "/special/kartu-nama", "/special/name-tag", "/utility/koordinat"];

const expand = (tokens: string[]): string[][] => tokens.map((t) => [t, ...(SYN[t] ?? []).map(norm)]);

function subseq(needle: string, hay: string): boolean {
  let i = 0;
  for (const c of hay) if (c === needle[i] && ++i === needle.length) return true;
  return false;
}

export function searchTools(query: string, limit = 30): { entry: ToolEntry; score: number }[] {
  const q = norm(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean);
  const groups = expand(tokens);
  const res: { entry: ToolEntry; score: number }[] = [];
  for (const e of getToolIndex()) {
    let total = 0, ok = true;
    for (const alts of groups) {
      let best = 0;
      for (const [k, t] of alts.entries()) {
        const w = k === 0 ? 1 : 0.7; // sinonim sedikit lebih rendah
        let s = 0;
        if (e.nameN === t) s = 14;
        else if (e.nameN.startsWith(t)) s = 11;
        else if (e.nameN.split(" ").some((x) => x.startsWith(t))) s = 8;
        else if (e.nameN.includes(t)) s = 6;
        else if (e.hay.split(" ").some((x) => x.startsWith(t))) s = 4;
        else if (e.hay.includes(t)) s = 3;
        else if (t.length >= 3 && subseq(t, e.nameN.replace(/ /g, ""))) s = 1.5;
        best = Math.max(best, s * w);
      }
      if (best === 0) { ok = false; break; }
      total += best;
    }
    if (!ok) continue;
    if (e.nameN === q) total += 10;
    total += e.kind === "category" ? -1 : 0;
    total -= e.nameN.length * 0.02;
    res.push({ entry: e, score: total });
  }
  return res.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name)).slice(0, limit);
}

/** Bagian teks yang cocok untuk disorot di UI. */
export function highlightRanges(text: string, query: string): [number, number][] {
  const toks = norm(query).split(" ").filter((t) => t.length > 0);
  const low = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const ranges: [number, number][] = [];
  for (const t of toks) {
    let from = 0;
    for (;;) { const i = low.indexOf(t, from); if (i < 0) break; ranges.push([i, i + t.length]); from = i + t.length; }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push([...r] as [number, number]); }
  return merged;
}
