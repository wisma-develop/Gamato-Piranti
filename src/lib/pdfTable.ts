import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Renders a simple string grid (from readXlsxGrid) as a paginated table PDF. */
export async function gridToPdfBlob(grid: string[][], title: string): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 841.89; // A4 landscape
  const pageHeight = 595.28;
  const margin = 32;
  const usableWidth = pageWidth - margin * 2;
  const colCount = Math.max(1, ...grid.map((r) => r.length));
  const colWidth = Math.min(160, usableWidth / colCount);
  const tableWidth = colWidth * colCount;
  const rowHeight = 20;
  const fontSize = 8.5;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const newPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  grid.forEach((row, rIdx) => {
    if (y - rowHeight < margin) newPage();
    const isHeader = rIdx === 0;

    if (isHeader) {
      page.drawRectangle({ x: margin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: rgb(0.31, 0.27, 0.9) });
    } else if (rIdx % 2 === 0) {
      page.drawRectangle({ x: margin, y: y - rowHeight, width: tableWidth, height: rowHeight, color: rgb(0.96, 0.96, 0.98) });
    }

    for (let c = 0; c < colCount; c++) {
      const raw = (row[c] ?? "").toString();
      const text = raw.length > 42 ? raw.slice(0, 39) + "…" : raw;
      const x = margin + c * colWidth + 4;
      page.drawText(text, {
        x,
        y: y - rowHeight + 6,
        size: fontSize,
        font: isHeader ? fontBold : font,
        color: isHeader ? rgb(1, 1, 1) : rgb(0.12, 0.12, 0.18),
        maxWidth: colWidth - 8,
      });
      page.drawRectangle({
        x: margin + c * colWidth,
        y: y - rowHeight,
        width: colWidth,
        height: rowHeight,
        borderColor: rgb(0.85, 0.85, 0.9),
        borderWidth: 0.5,
      });
    }
    y -= rowHeight;
  });

  return new Blob([await pdfDoc.save()], { type: "application/pdf" });
}
