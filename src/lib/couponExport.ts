// Ekspor massal Kupon / Voucher / Tiket: ZIP PNG, PDF (1 lembar per halaman), dan lembar cetak
// (banyak kupon per halaman + tanda potong). Pola & tipe progres mengikuti businessCardBulk.

import { PDFDocument, rgb } from "pdf-lib";
import { canvasToBlob } from "@/lib/canvas";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { BulkCancelled, sheetLayout, type BulkProgress, type SheetPaper } from "@/lib/businessCardBulk";
import { renderCoupon, couponPixelSize, type CouponAssets } from "@/lib/couponEngine";
import { slugFile, type CouponRecord } from "@/lib/couponCodes";
import type { CouponDesign } from "@/lib/couponTypes";

const MM_TO_PT = 72 / 25.4;

export interface CouponBulkCommon {
  design: CouponDesign;
  records: CouponRecord[];
  assets: CouponAssets;
  signal?: { cancelled: boolean };
  onProgress?: (p: BulkProgress) => void;
}

export interface CouponSheetOptions {
  paper: SheetPaper;
  landscape: boolean;
  marginMm: number;
  gapMm: number;
  cropMarks: boolean;
}

async function pngOf(o: CouponBulkCommon, rec: CouponRecord, canvas: HTMLCanvasElement): Promise<Uint8Array> {
  renderCoupon(canvas, o.design, rec, o.assets);
  const blob = await canvasToBlob(canvas);
  return new Uint8Array(await blob.arrayBuffer());
}

/** Beri napas ke UI tiap beberapa item supaya progres terlihat & tombol Batal responsif. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export function couponFileName(d: CouponDesign, rec: CouponRecord, total: number, ext: string): string {
  const pad = Math.max(3, String(total).length);
  const idx = String(rec.no).padStart(pad, "0");
  return `${slugFile(d.kind, "kupon")}-${idx}-${slugFile(rec.code, "kode")}.${ext}`;
}

export async function exportCouponZip(o: CouponBulkCommon): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const canvas = document.createElement("canvas");
  const total = o.records.length;
  const used = new Set<string>();
  for (let i = 0; i < total; i++) {
    if (o.signal?.cancelled) throw new BulkCancelled();
    const rec = o.records[i];
    const png = await pngOf(o, rec, canvas);
    let name = couponFileName(o.design, rec, total, "png");
    if (used.has(name)) name = name.replace(/\.png$/, `-${i + 1}.png`);
    used.add(name);
    zip.file(name, png, { compression: "STORE" });
    o.onProgress?.({ done: i + 1, total });
    if (i % 4 === 3) await tick();
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

/** PDF: satu halaman per kupon, ukuran halaman = ukuran kupon. */
export async function exportCouponPdf(o: CouponBulkCommon): Promise<Blob> {
  const { wMM, hMM } = couponPixelSize(o.design);
  const wPt = wMM * MM_TO_PT, hPt = hMM * MM_TO_PT;
  const pdf = await PDFDocument.create();
  pdf.setTitle("Kupon — Gamato Piranti");
  const canvas = document.createElement("canvas");
  const total = o.records.length;
  for (let i = 0; i < total; i++) {
    if (o.signal?.cancelled) throw new BulkCancelled();
    const img = await pdf.embedPng(await pngOf(o, o.records[i], canvas));
    pdf.addPage([wPt, hPt]).drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
    o.onProgress?.({ done: i + 1, total });
    if (i % 4 === 3) await tick();
  }
  await stampGamatoBranding(pdf, { firstPageOnly: true });
  return new Blob([await pdf.save()] as BlobPart[], { type: "application/pdf" });
}

export function couponSheetInfo(d: CouponDesign, s: CouponSheetOptions) {
  const { wMM, hMM } = couponPixelSize(d);
  return sheetLayout(wMM, hMM, s.paper, s.landscape, s.marginMm, s.gapMm);
}

/** Lembar cetak: banyak kupon per halaman, urut kiri→kanan lalu atas→bawah. */
export async function exportCouponSheet(o: CouponBulkCommon & { sheet: CouponSheetOptions }): Promise<{ blob: Blob; pages: number; perPage: number }> {
  const { wMM, hMM } = couponPixelSize(o.design);
  const L = couponSheetInfo(o.design, o.sheet);
  if (L.perPage < 1) throw new Error("Kupon tidak muat di halaman dengan margin/ukuran ini — kecilkan margin, putar kertas, atau pilih kertas lebih besar.");
  const pdf = await PDFDocument.create();
  pdf.setTitle("Lembar Cetak Kupon — Gamato Piranti");
  const canvas = document.createElement("canvas");
  const pageW = L.pageW * MM_TO_PT, pageH = L.pageH * MM_TO_PT;
  const cw = wMM * MM_TO_PT, ch = hMM * MM_TO_PT;
  const marks = (page: ReturnType<PDFDocument["addPage"]>, x: number, y: number) => {
    const off = 1 * MM_TO_PT, len = 2.5 * MM_TO_PT;
    const c = rgb(0.25, 0.25, 0.25);
    for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + cw, y, 1, -1], [x, y + ch, -1, 1], [x + cw, y + ch, 1, 1]] as const) {
      page.drawLine({ start: { x: cx + sx * off, y: cy }, end: { x: cx + sx * (off + len), y: cy }, thickness: 0.4, color: c });
      page.drawLine({ start: { x: cx, y: cy + sy * off }, end: { x: cx, y: cy + sy * (off + len) }, thickness: 0.4, color: c });
    }
  };
  const total = o.records.length;
  let done = 0, pages = 0;
  for (let s = 0; s < total; s += L.perPage) {
    const chunk = o.records.slice(s, s + L.perPage);
    const page = pdf.addPage([pageW, pageH]);
    pages++;
    for (let k = 0; k < chunk.length; k++) {
      if (o.signal?.cancelled) throw new BulkCancelled();
      const img = await pdf.embedPng(await pngOf(o, chunk[k], canvas));
      const col = k % L.cols, row = Math.floor(k / L.cols);
      const x = (L.x0 + col * (wMM + L.gap)) * MM_TO_PT;
      const y = pageH - (L.y0 + row * (hMM + L.gap)) * MM_TO_PT - ch;
      page.drawImage(img, { x, y, width: cw, height: ch });
      if (o.sheet.cropMarks) marks(page, x, y);
      o.onProgress?.({ done: ++done, total });
      if (done % 4 === 0) await tick();
    }
  }
  await stampGamatoBranding(pdf, { firstPageOnly: true });
  return { blob: new Blob([await pdf.save()] as BlobPart[], { type: "application/pdf" }), pages, perPage: L.perPage };
}
