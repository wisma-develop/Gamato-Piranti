import { PDFDocument } from "pdf-lib";
import { canvasToBlob } from "@/lib/canvas";
import { stampGamatoBranding } from "@/lib/pdfBranding";

// True A4 dimensions in PDF points (1pt = 1/72in). 210mm × 297mm.
export const A4_PT_W = 595.28;
export const A4_PT_H = 841.89;

/**
 * Embeds a list of canvases (assumed to already be in A4 pixel proportions,
 * e.g. 1240×1754) into a single multi-page PDF sized at TRUE A4 physical
 * dimensions in points — not "1 pixel = 1 point" like some of the simpler
 * single-page generators in this app. This matters for a document like a CV,
 * where recruiters/ATS software may check that the PDF is a real A4 page.
 * pdf-lib scales the raster to fill the page automatically.
 */
export async function canvasesToA4PdfBlob(canvases: HTMLCanvasElement[], title: string): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);
  for (const canvas of canvases) {
    const blob = await canvasToBlob(canvas);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const img = await pdfDoc.embedPng(bytes);
    const page = pdfDoc.addPage([A4_PT_W, A4_PT_H]);
    page.drawImage(img, { x: 0, y: 0, width: A4_PT_W, height: A4_PT_H });
  }
  await stampGamatoBranding(pdfDoc);
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}
