// Slide Studio → PDF / PNG export. Each slide is rasterized to a canvas at
// 2x resolution (crisp on high-DPI screens/printers) and embedded as a PNG
// into one PDF page per slide — this guarantees the export is pixel-faithful
// to whatever was designed (text wrapping, shapes, images) without having to
// re-implement layout in PDF coordinate space. 960x540 points is the exact
// PowerPoint "Widescreen" 16:9 slide size (13.333in x 7.5in @ 72dpi), so the
// output opens at the correct real-world size in any PDF viewer.
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { canvasToBlob } from "@/lib/canvas";
import { preloadDeckImages, renderSlideToCanvas, SLIDE_HEIGHT, SLIDE_WIDTH, type Deck } from "./slideModel";

export async function deckToPdfBlob(deck: Deck): Promise<Blob> {
  const imageCache = await preloadDeckImages(deck);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(deck.title || "Presentasi");

  for (const slide of deck.slides) {
    const canvas = await renderSlideToCanvas(slide, imageCache, 2);
    const blob = await canvasToBlob(canvas, "image/png");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const png = await pdfDoc.embedPng(bytes);
    const page = pdfDoc.addPage([SLIDE_WIDTH, SLIDE_HEIGHT]);
    page.drawImage(png, { x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT });
  }

  await stampGamatoBranding(pdfDoc);
  return new Blob([await pdfDoc.save()], { type: "application/pdf" });
}

export async function deckToImagesZipBlob(deck: Deck): Promise<Blob> {
  const imageCache = await preloadDeckImages(deck);
  const zip = new JSZip();
  let i = 1;
  for (const slide of deck.slides) {
    const canvas = await renderSlideToCanvas(slide, imageCache, 2);
    const blob = await canvasToBlob(canvas, "image/png");
    zip.file(`slide-${String(i).padStart(2, "0")}.png`, blob);
    i++;
  }
  return zip.generateAsync({ type: "blob" });
}
