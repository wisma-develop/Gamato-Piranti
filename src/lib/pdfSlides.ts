import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SlideContent } from "./officeReaders";

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/** Renders parsed .pptx slides (from readPptxSlides) as one PDF page per slide. */
export async function slidesToPdfBlob(slides: SlideContent[], title: string): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 960;
  const pageHeight = 540;
  const margin = 60;

  for (const slide of slides) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(0.99, 0.99, 1) });
    page.drawRectangle({ x: 0, y: pageHeight - 8, width: pageWidth, height: 8, color: rgb(0.31, 0.27, 0.9) });

    let y = pageHeight - margin - 20;
    const titleSize = 28;
    for (const line of wrapText(slide.title, fontBold, titleSize, pageWidth - margin * 2)) {
      page.drawText(line, { x: margin, y, size: titleSize, font: fontBold, color: rgb(0.09, 0.09, 0.15) });
      y -= titleSize * 1.25;
    }
    y -= 16;

    const bodySize = 16;
    for (const bullet of slide.bullets) {
      const lines = wrapText(bullet, font, bodySize, pageWidth - margin * 2 - 20);
      lines.forEach((line, i) => {
        if (y < margin) return;
        const prefix = i === 0 ? "•  " : "    ";
        page.drawText(prefix + line, { x: margin, y, size: bodySize, font, color: rgb(0.28, 0.28, 0.34) });
        y -= bodySize * 1.4;
      });
    }
  }

  return new Blob([await pdfDoc.save()], { type: "application/pdf" });
}
