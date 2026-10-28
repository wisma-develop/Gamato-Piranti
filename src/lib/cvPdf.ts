import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { canvasToBlob } from "@/lib/canvas";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { A4_PT_H, A4_PT_W } from "@/lib/pdfFromCanvases";
import { getCvTextRuns } from "@/lib/cvEngine";

/** Hanya karakter yang bisa dikodekan font standar PDF (WinAnsi); sisanya diganti spasi agar tidak melempar error. */
function encodable(font: PDFFont, text: string): string {
  let set: Set<number> | null = null;
  try {
    set = new Set(font.getCharacterSet());
  } catch {
    set = null;
  }
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0xa0) out += " ";
    else if (!set || set.has(cp)) out += ch;
    else out += " ";
  }
  return out;
}

/**
 * Menyusun PDF A4 dari halaman CV: gambar kanvas beresolusi tinggi sebagai
 * tampilan + LAPISAN TEKS TAK TERLIHAT di atas setiap teks. Hasilnya tampil
 * persis seperti pratinjau, tetapi teksnya bisa dipilih/disalin/dicari dan
 * terbaca oleh sistem ATS & perekrut. (Halaman harus dirender dengan recordText.)
 */
export async function cvPagesToPdfBlob(pages: HTMLCanvasElement[], title: string, author: string): Promise<{ blob: Blob; textRuns: number }> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);
  if (author.trim()) pdfDoc.setAuthor(author.trim());
  const fReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fIt = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fBoldIt = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  let total = 0;

  for (const canvas of pages) {
    const png = new Uint8Array(await (await canvasToBlob(canvas)).arrayBuffer());
    const img = await pdfDoc.embedPng(png);
    const page = pdfDoc.addPage([A4_PT_W, A4_PT_H]);
    page.drawImage(img, { x: 0, y: 0, width: A4_PT_W, height: A4_PT_H });

    const k = A4_PT_W / canvas.width;
    for (const run of getCvTextRuns(canvas)) {
      const font = run.bold ? (run.italic ? fBoldIt : fBold) : run.italic ? fIt : fReg;
      const text = encodable(font, run.text);
      if (!text.trim()) continue;
      let size = run.size * k;
      const targetW = run.width * k;
      const natural = font.widthOfTextAtSize(text, size);
      if (natural > 0 && targetW > 0) size *= Math.min(1.6, Math.max(0.5, targetW / natural));
      const w = font.widthOfTextAtSize(text, size);
      let x = run.x * k;
      if (run.align === "center") x -= w / 2;
      else if (run.align === "right" || run.align === "end") x -= w;
      const yCanvas = run.baseline === "middle" ? run.y + run.size * 0.35 : run.y;
      const y = A4_PT_H - yCanvas * k;
      try {
        page.drawText(text, { x, y, size, font, opacity: 0 });
        total += 1;
      } catch {
        /* teks yang gagal dikodekan dilewati — tampilan visual tidak terpengaruh */
      }
    }
  }
  await stampGamatoBranding(pdfDoc);
  const bytes = await pdfDoc.save();
  return { blob: new Blob([bytes as BlobPart], { type: "application/pdf" }), textRuns: total };
}
