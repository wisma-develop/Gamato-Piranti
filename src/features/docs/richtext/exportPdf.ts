import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BlockModel, RunModel } from "./parseEditor";
import { stampGamatoBranding } from "@/lib/pdfBranding";

function hexToColor(hex?: string) {
  if (!hex) return rgb(0.06, 0.09, 0.16); // slate-900 fallback
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r || 0, g || 0, b || 0);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] || "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

interface Word {
  text: string;
  run: RunModel;
}

function splitToWords(runs: RunModel[]): Word[] {
  const words: Word[] = [];
  runs.forEach((run) => {
    if (run.text === "\n") {
      words.push({ text: "\n", run });
      return;
    }
    const parts = run.text.split(/(\s+)/).filter((p) => p.length > 0);
    parts.forEach((p) => words.push({ text: p, run }));
  });
  return words;
}

/** Builds a .pdf Blob from the parsed block model of the Doc Studio editor. */
export async function exportPdfFromBlocks(blocks: BlockModel[], title: string): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  const pageWidth = 595.28;
  const pageHeight = 841.89; // A4
  const margin = 56;
  const maxWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const newPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const pickFont = (run: RunModel) => (run.bold && run.italic ? fontBoldItalic : run.bold ? fontBold : run.italic ? fontItalic : fontRegular);

  let numberIdx = 0;

  for (const block of blocks) {
    if (block.kind === "image") {
      try {
        const bytes = dataUrlToBytes(block.dataUrl);
        const isPng = block.dataUrl.startsWith("data:image/png");
        const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const scale = Math.min(1, maxWidth / img.width);
        const w = img.width * scale;
        const h = img.height * scale;
        if (y - h < margin) newPage();
        let x = margin; // left / float-left
        const align = block.align ?? "left";
        if (align === "center") x = margin + (maxWidth - w) / 2;
        else if (align === "right" || align === "float-right") x = margin + (maxWidth - w);
        page.drawImage(img, { x, y: y - h, width: w, height: h });
        y -= h + 14;
      } catch {
        // Unsupported image format (e.g. webp/gif) — skip gracefully.
      }
      continue;
    }

    if (block.listType !== "number") numberIdx = 0;

    const words = splitToWords(block.runs);
    if (!words.length || (words.length === 1 && words[0].text === "")) {
      y -= 18;
      if (y < margin) newPage();
      continue;
    }

    const listIndent = block.listType ? 18 : 0;
    const lineMaxWidth = maxWidth - listIndent;

    type LineWord = { text: string; run: RunModel; size: number; font: any; width: number };
    const lines: LineWord[][] = [];
    let current: LineWord[] = [];
    let currentWidth = 0;

    for (const w of words) {
      if (w.text === "\n") {
        lines.push(current);
        current = [];
        currentWidth = 0;
        continue;
      }
      const baseSize = w.run.fontSizePx ? w.run.fontSizePx * 0.75 : 12;
      const size = w.run.sub || w.run.sup ? baseSize * 0.7 : baseSize;
      const font = pickFont(w.run);
      const width = font.widthOfTextAtSize(w.text, size);
      if (currentWidth + width > lineMaxWidth && current.length) {
        lines.push(current);
        current = [];
        currentWidth = 0;
        if (/^\s+$/.test(w.text)) continue;
      }
      current.push({ text: w.text, run: w.run, size, font, width });
      currentWidth += width;
    }
    if (current.length) lines.push(current);

    for (const line of lines) {
      const lineHeight = Math.max(16, ...line.map((w) => w.size * 1.4 * (block.lineHeight ?? 1)));
      if (y - lineHeight < margin) newPage();

      const totalWidth = line.reduce((a, w) => a + w.width, 0);
      let x = margin + listIndent;
      if (block.align === "center") x = margin + listIndent + (lineMaxWidth - totalWidth) / 2;
      else if (block.align === "right") x = margin + listIndent + (lineMaxWidth - totalWidth);

      if (block.listType === "bullet" && line === lines[0]) {
        page.drawText("•", { x: margin + 4, y: y - lineHeight + 4, size: 11, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
      }
      if (block.listType === "number" && line === lines[0]) {
        numberIdx += 1;
        page.drawText(`${numberIdx}.`, { x: margin, y: y - lineHeight + 4, size: 11, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
      }

      for (const w of line) {
        const baseY = y - lineHeight + 4;
        const yOffset = w.run.sub ? -w.size * 0.25 : w.run.sup ? w.size * 0.35 : 0;

        if (w.run.highlight) {
          page.drawRectangle({ x, y: baseY - 2, width: w.width, height: w.size + 3, color: hexToColor(w.run.highlight), opacity: 0.45 });
        }

        const color = w.run.link ? rgb(0.02, 0.36, 0.75) : hexToColor(w.run.color);
        page.drawText(w.text, { x, y: baseY + yOffset, size: w.size, font: w.font, color });

        if (w.run.underline || w.run.link) {
          page.drawLine({ start: { x, y: baseY - 1 }, end: { x: x + w.width, y: baseY - 1 }, thickness: 0.75, color });
        }
        if (w.run.strike) {
          page.drawLine({ start: { x, y: baseY + w.size * 0.32 }, end: { x: x + w.width, y: baseY + w.size * 0.32 }, thickness: 0.75, color });
        }
        x += w.width;
      }
      y -= lineHeight;
    }
    y -= 6 + (block.spaceAfterPx ? block.spaceAfterPx * 0.75 : 0);
  }

  await stampGamatoBranding(pdfDoc);
  return new Blob([await pdfDoc.save()], { type: "application/pdf" });
}
