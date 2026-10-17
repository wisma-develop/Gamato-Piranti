// Ekspor tumpukan tangkapan: gambar tunggal, ZIP (bila >1), dan PDF dengan tata letak halaman otomatis.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { drawObjects, type AnnObj } from "./annotations";
import { stampGamatoBranding } from "@/lib/pdfBranding";

export interface CaptureItem {
  id: string;
  name: string;
  base: HTMLCanvasElement; // gambar asli (tanpa anotasi)
  objects: AnnObj[];
  source: "frame" | "long" | "html" | "image";
  createdAt: number;
}

export type ImgFormat = "png" | "jpeg" | "webp";

/** Gambar akhir = dasar + anotasi (+ latar putih untuk format tanpa alpha). */
export function renderItem(item: CaptureItem, opaque = false): HTMLCanvasElement {
  const { width: w, height: h } = item.base;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  if (opaque) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(item.base, 0, 0);
  drawObjects(ctx, item.objects, item.base, w, h);
  return c;
}

const toBlob = (c: HTMLCanvasElement, mime: string, q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Gagal membuat gambar (kanvas terlalu besar?)."))), mime, q));

const MIME: Record<ImgFormat, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
const EXT: Record<ImgFormat, string> = { png: "png", jpeg: "jpg", webp: "webp" };

export function safeBase(s: string) {
  return (s || "capture").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 80) || "capture";
}

export async function itemToBlob(item: CaptureItem, fmt: ImgFormat, quality: number): Promise<Blob> {
  const c = renderItem(item, fmt !== "png");
  const b = await toBlob(c, MIME[fmt], fmt === "png" ? undefined : quality);
  c.width = c.height = 0;
  return b;
}

/** 1 tangkapan → berkas gambar biasa; >1 → ZIP. */
export async function exportImages(items: CaptureItem[], fmt: ImgFormat, quality: number, baseName: string): Promise<{ blob: Blob; name: string; kind: "image" | "zip" }> {
  const base = safeBase(baseName);
  if (items.length === 1) {
    const blob = await itemToBlob(items[0], fmt, quality);
    return { blob, name: `${base}.${EXT[fmt]}`, kind: "image" };
  }
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const pad = String(items.length).length;
  for (let i = 0; i < items.length; i++) {
    const b = await itemToBlob(items[i], fmt, quality);
    zip.file(`${base}-${String(i + 1).padStart(Math.max(2, pad), "0")}.${EXT[fmt]}`, b, { compression: "STORE" });
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  return { blob, name: `${base}.zip`, kind: "zip" };
}

// ── PDF ──────────────────────────────────────────────────────────────────

export type PageSize = "a4" | "letter" | "legal" | "auto";
export interface PdfOptions {
  pageSize: PageSize;
  orientation: "portrait" | "landscape" | "auto";
  marginMm: number;
  numbering: boolean;
  newPagePerCapture: boolean;
  jpegQuality: number;
  lossless: boolean;
  title: string;
}

const PAGE_PT: Record<Exclude<PageSize, "auto">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
};
const MM = 72 / 25.4;
const PX_TO_PT = 0.75;
const MAX_PAGE_PT = 14000;

/** Mencari baris “kosong” (latar polos) dekat batas halaman agar teks tidak terpotong. */
function smartBreak(c: HTMLCanvasElement, from: number, ideal: number, minLen: number): number {
  const look = Math.min(Math.round((ideal - from) * 0.22), 320);
  if (look < 8) return ideal;
  const top = Math.max(from + minLen, ideal - look);
  const h = ideal - top;
  if (h < 4) return ideal;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const w = c.width;
  const d = ctx.getImageData(0, top, w, h).data;
  let bestY = ideal, bestScore = Infinity;
  for (let y = 0; y < h; y++) {
    let busy = 0;
    const row = y * w * 4;
    let prev = d[row] + d[row + 1] + d[row + 2];
    for (let x = 4; x < w; x += 4) {
      const i = row + x * 4;
      const v = d[i] + d[i + 1] + d[i + 2];
      const diff = v > prev ? v - prev : prev - v;
      if (diff > busy) busy = diff;
      prev = v;
    }
    // sedikit memilih baris yang lebih dekat ke batas ideal
    const score = busy + (h - y) * 0.02;
    if (score < bestScore) { bestScore = score; bestY = top + y + 1; }
  }
  return bestScore < 18 ? Math.min(ideal, bestY) : ideal; // hanya bila benar-benar ada celah polos
}

async function embedSlice(pdf: PDFDocument, src: HTMLCanvasElement, y: number, h: number, o: PdfOptions) {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = Math.max(1, h);
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, y, src.width, h, 0, 0, src.width, h);
  const blob = await toBlob(c, o.lossless ? "image/png" : "image/jpeg", o.jpegQuality);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const img = o.lossless ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  c.width = c.height = 0;
  return img;
}

export interface PdfResult {
  blob: Blob;
  pages: number;
}

export async function exportPdf(items: CaptureItem[], o: PdfOptions): Promise<PdfResult> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(o.title || "Capture Website");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const margin = Math.max(0, o.marginMm) * MM;
  const footer = o.pageSize === "auto" ? 0 : Math.max(o.numbering ? 16 : 0, 26); // ruang bawah untuk nomor & identitas
  type PageState = { page: ReturnType<PDFDocument["addPage"]>; pw: number; ph: number; cursor: number }; // cursor = y bebas berikutnya (dari atas, pt)
  const st: { cur: PageState | null } = { cur: null };

  const newPage = (pw: number, ph: number): PageState => {
    const page = pdf.addPage([pw, ph]);
    st.cur = { page, pw, ph, cursor: margin };
    return st.cur;
  };

  for (const it of items) {
    const flat = renderItem(it, true);
    const W = flat.width, H = flat.height;

    if (o.pageSize === "auto") {
      // Satu halaman = ukuran gambar (96 dpi → pt); sangat tinggi dipecah per MAX_PAGE_PT.
      const pw = W * PX_TO_PT + margin * 2;
      const slicePx = Math.floor((MAX_PAGE_PT - margin * 2) / PX_TO_PT);
      for (let y = 0; y < H; ) {
        const end = Math.min(H, y + slicePx);
        const hh = end - y;
        const img = await embedSlice(pdf, flat, y, hh, o);
        const ph = hh * PX_TO_PT + margin * 2;
        const { page } = newPage(pw, ph);
        page.drawImage(img, { x: margin, y: margin, width: W * PX_TO_PT, height: hh * PX_TO_PT });
        y = end;
      }
      flat.width = flat.height = 0;
      continue;
    }

    let [bw, bh] = PAGE_PT[o.pageSize];
    const landscape = o.orientation === "landscape" || (o.orientation === "auto" && W > H * 1.15);
    const pw = landscape ? bh : bw;
    const ph = landscape ? bw : bh;
    const contentW = pw - margin * 2;
    const contentH = ph - margin - Math.max(margin, footer);
    const s = Math.min(contentW / W, 2);
    const drawW = W * s;
    const gap = 8;

    let y = 0;
    let first = true;
    while (y < H) {
      let page: PageState | null = st.cur;
      const startNew = !page || page.pw !== pw || page.ph !== ph || (first && o.newPagePerCapture);
      let room = page ? ph - Math.max(margin, footer) - page.cursor : 0;
      if (startNew || room < 60) {
        page = newPage(pw, ph);
        room = contentH;
      } else if (first && !o.newPagePerCapture && page) {
        page.cursor += gap;
        room -= gap;
      }
      const pg = page!;
      const maxPx = room / s;
      let end = Math.min(H, y + Math.floor(maxPx));
      if (end < H) end = Math.max(y + 1, smartBreak(flat, y, end, Math.floor(maxPx * 0.55)));
      const hh = end - y;
      const img = await embedSlice(pdf, flat, y, hh, o);
      const drawH = hh * s;
      pg.page.drawImage(img, { x: margin + (contentW - drawW) / 2, y: ph - pg.cursor - drawH, width: drawW, height: drawH });
      pg.cursor += drawH;
      y = end;
      first = false;
    }
    flat.width = flat.height = 0;
  }

  const n = pdf.getPageCount();
  if (o.numbering && o.pageSize !== "auto") {
    pdf.getPages().forEach((p, i) => {
      const label = `${i + 1} / ${n}`;
      const size = 9;
      const w = font.widthOfTextAtSize(label, size);
      p.drawText(label, { x: p.getWidth() / 2 - w / 2, y: Math.max(8, margin / 2 - 2) + 4, size, font, color: rgb(0.45, 0.5, 0.58) });
    });
  }
  await stampGamatoBranding(pdf);
  const bytes = await pdf.save();
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), pages: n };
}
