// Ekspor Surat: PDF (satu surat atau gabungan massal), ZIP PNG / PDF / DOCX per surat (mail merge).

import { PDFDocument } from "pdf-lib";
import { canvasToBlob } from "@/lib/canvas";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { BulkCancelled, type BulkProgress } from "@/lib/businessCardBulk";
import { slugFile } from "@/lib/couponCodes";
import { renderLetter, type LetterAssets } from "@/lib/letterEngine";
import { letterToDocx } from "@/lib/letterDocx";
import { buildVars, paperSpec, type LetterDoc, type TemplateField } from "@/lib/letterTypes";

const MM_TO_PT = 72 / 25.4;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export interface LetterBulkOptions {
  doc: LetterDoc;
  fields: TemplateField[];
  assets: LetterAssets;
  dpi: number;
  signal?: { cancelled: boolean };
  onProgress?: (p: BulkProgress) => void;
}

export interface LetterRow { data: Record<string, string> }

async function appendPages(pdf: PDFDocument, pages: HTMLCanvasElement[], doc: LetterDoc) {
  const p = paperSpec(doc.paper);
  const w = p.wMM * MM_TO_PT, h = p.hMM * MM_TO_PT;
  for (const cv of pages) {
    const blob = await canvasToBlob(cv);
    const img = await pdf.embedPng(new Uint8Array(await blob.arrayBuffer()));
    pdf.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
  }
}

export async function pagesToPdf(pages: HTMLCanvasElement[], doc: LetterDoc, title = "Surat — Gamato Piranti"): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  await appendPages(pdf, pages, doc);
  await stampGamatoBranding(pdf, { firstPageOnly: true });
  return new Blob([await pdf.save()] as BlobPart[], { type: "application/pdf" });
}

export async function pagesToPngZip(pages: HTMLCanvasElement[], base: string): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (let i = 0; i < pages.length; i++) {
    const blob = await canvasToBlob(pages[i]);
    zip.file(`${base}-hal-${String(i + 1).padStart(2, "0")}.png`, new Uint8Array(await blob.arrayBuffer()), { compression: "STORE" });
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

const rowName = (row: Record<string, string>, i: number, nameKey: string, total: number) => {
  const pad = String(total).length;
  const n = nameKey && row[nameKey] ? slugFile(row[nameKey], "") : "";
  return `${String(i + 1).padStart(Math.max(2, pad), "0")}${n ? `-${n}` : ""}`;
};

function renderRow(o: LetterBulkOptions, row: Record<string, string>, i: number) {
  const vars = buildVars(o.doc, o.fields, row, o.doc.noUrut + i);
  return { vars, pages: renderLetter(o.doc, vars, o.assets, { dpi: o.dpi }).pages };
}

/** Semua surat digabung dalam satu PDF (urut sesuai baris). */
export async function exportMergedPdf(o: LetterBulkOptions, rows: Record<string, string>[]): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Surat Massal — Gamato Piranti");
  for (let i = 0; i < rows.length; i++) {
    if (o.signal?.cancelled) throw new BulkCancelled();
    const { pages } = renderRow(o, rows[i], i);
    await appendPages(pdf, pages, o.doc);
    o.onProgress?.({ done: i + 1, total: rows.length });
    await tick();
  }
  await stampGamatoBranding(pdf, { firstPageOnly: true });
  return new Blob([await pdf.save()] as BlobPart[], { type: "application/pdf" });
}

/** ZIP berisi satu berkas per surat: pdf / docx / png (satu folder per surat bila >1 halaman). */
export async function exportZip(o: LetterBulkOptions, rows: Record<string, string>[], kind: "pdf" | "docx" | "png", nameKey: string): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    if (o.signal?.cancelled) throw new BulkCancelled();
    const { vars, pages } = renderRow(o, rows[i], i);
    let base = `surat-${rowName(rows[i], i, nameKey, rows.length)}`;
    if (used.has(base)) base += `-${i + 1}`;
    used.add(base);
    if (kind === "pdf") {
      zip.file(`${base}.pdf`, await (await pagesToPdf(pages, o.doc, base)).arrayBuffer(), { compression: "STORE" });
    } else if (kind === "docx") {
      zip.file(`${base}.docx`, await (await letterToDocx(o.doc, vars, o.assets)).arrayBuffer());
    } else {
      for (let p = 0; p < pages.length; p++) {
        const blob = await canvasToBlob(pages[p]);
        zip.file(pages.length > 1 ? `${base}/hal-${p + 1}.png` : `${base}.png`, new Uint8Array(await blob.arrayBuffer()), { compression: "STORE" });
      }
    }
    o.onProgress?.({ done: i + 1, total: rows.length });
    await tick();
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
