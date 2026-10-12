// DOCX / PDF exporters for transcripts.

import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, Footer, PageNumber, AlignmentType, BorderStyle, ShadingType } from "docx";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { fmtTime, type ExportOptions, type Paragraph as TPara, type TranscriptMeta } from "@/lib/transcriptEngine";

const spName = (meta: TranscriptMeta, i: number | null): string => (i == null ? "" : meta.speakers[i] ?? `Pembicara ${i + 1}`);
const dateText = (meta: TranscriptMeta) => new Date(meta.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

const SPEAKER_COLORS = ["1D4ED8", "BE185D", "047857", "B45309", "6D28D9", "0E7490"];

/* ─────────────────────────────── DOCX ─────────────────────────────── */

export async function buildTranscriptDocx(meta: TranscriptMeta, paras: TPara[], o: ExportOptions): Promise<Blob> {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: none, bottom: none, left: none, right: none };
  const metaRows: [string, string][] = [
    ["Sumber", meta.sourceName],
    ["Durasi", fmtTime(meta.duration)],
    ["Bahasa", meta.language],
    ["Tanggal", dateText(meta)],
  ];
  if (meta.speakers.length) metaRows.push(["Pembicara", meta.speakers.join(", ")]);

  const children: (Paragraph | Table)[] = [];
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: meta.title, bold: true })], spacing: { after: 200 } }));
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: metaRows.map(
        ([k, v]) =>
          new TableRow({
            children: [
              new TableCell({ borders: noBorders, width: { size: 22, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, color: "64748B", size: 20 })] })] }),
              new TableCell({ borders: noBorders, width: { size: 78, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: v, size: 20 })] })] }),
            ],
          })
      ),
    })
  );
  children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CBD5E1", space: 1 } }, spacing: { after: 240 }, children: [] }));

  if (o.summary?.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Ringkasan", bold: true })], spacing: { before: 120, after: 120 } }));
    for (const s of o.summary) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: [new TextRun({ text: s, size: 22 })] }));
  }
  if (o.keywords?.length) {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 200 },
        shading: { type: ShadingType.CLEAR, fill: "F1F5F9", color: "auto" },
        children: [new TextRun({ text: "Kata kunci: ", bold: true, size: 20 }), new TextRun({ text: o.keywords.join(" · "), size: 20, color: "334155" })],
      })
    );
  }

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Transkrip", bold: true })], spacing: { before: 240, after: 160 } }));
  for (const p of paras) {
    const runs: TextRun[] = [];
    if (o.timestamps) runs.push(new TextRun({ text: `[${fmtTime(p.start)}]  `, color: "94A3B8", size: 18, font: "Consolas" }));
    if (o.speakers && p.speaker != null) runs.push(new TextRun({ text: `${spName(meta, p.speaker)}: `, bold: true, color: SPEAKER_COLORS[p.speaker % SPEAKER_COLORS.length], size: 22 }));
    runs.push(new TextRun({ text: p.text, size: 22 }));
    children.push(new Paragraph({ children: runs, spacing: { after: 160, line: 320 }, alignment: AlignmentType.LEFT }));
  }

  const doc = new Document({
    creator: "Gamato Piranti",
    title: meta.title,
    description: "Transkrip audio — Gamato Piranti",
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1247, right: 1247 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Dibuat dengan Gamato Piranti · Halaman ", size: 16, color: "94A3B8" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "94A3B8" }),
                  new TextRun({ text: " / ", size: 16, color: "94A3B8" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "94A3B8" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}

/* ─────────────────────────────── PDF ─────────────────────────────── */

const WIN_ANSI_MAP: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", "•": "-", "\u00a0": " ", "\u200b": "" };

/** pdf-lib's standard fonts only encode WinAnsi; returns the text plus whether anything had to be replaced. */
export function toWinAnsi(text: string): { text: string; lossy: boolean } {
  let lossy = false;
  let out = "";
  for (const ch of text.normalize("NFC")) {
    if (WIN_ANSI_MAP[ch] !== undefined) out += WIN_ANSI_MAP[ch];
    else if (ch === "\n") out += "\n";
    else if (ch.codePointAt(0)! <= 0xff && ch.codePointAt(0)! >= 0x20) out += ch;
    else { out += "?"; lossy = true; }
  }
  return { text: out, lossy };
}

export function hasNonLatin(texts: string[]): boolean {
  return texts.some((t) => toWinAnsi(t).lossy);
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else {
        if (line) out.push(line);
        // very long single word: hard-break
        if (font.widthOfTextAtSize(w, size) > maxWidth) {
          let chunk = "";
          for (const ch of w) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) { out.push(chunk); chunk = ch; } else chunk += ch;
          }
          line = chunk;
        } else line = w;
      }
    }
    out.push(line);
  }
  return out;
}

export async function buildTranscriptPdf(meta: TranscriptMeta, paras: TPara[], o: ExportOptions): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(meta.title).text);
  pdf.setCreator("Gamato Piranti");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const PW = 595.28;
  const PH = 841.89;
  const M = 56;
  const maxW = PW - M * 2;
  const bottomLimit = 62; // leaves room for the branding stamp + page number

  let page = pdf.addPage([PW, PH]);
  let y = PH - M;
  const newPage = () => { page = pdf.addPage([PW, PH]); y = PH - M; };
  const ensure = (h: number) => { if (y - h < bottomLimit) newPage(); };
  const W = (s: string) => toWinAnsi(s).text;

  // title
  for (const l of wrapLines(W(meta.title), bold, 22, maxW)) {
    ensure(28);
    page.drawText(l, { x: M, y: y - 22, size: 22, font: bold, color: rgb(0.06, 0.09, 0.16) });
    y -= 28;
  }
  y -= 6;
  const metaLines: [string, string][] = [["Sumber", meta.sourceName], ["Durasi", fmtTime(meta.duration)], ["Bahasa", meta.language], ["Tanggal", dateText(meta)]];
  if (meta.speakers.length) metaLines.push(["Pembicara", meta.speakers.join(", ")]);
  for (const [k, v] of metaLines) {
    ensure(15);
    page.drawText(`${k}`, { x: M, y: y - 11, size: 10, font: bold, color: rgb(0.39, 0.45, 0.55) });
    const vl = wrapLines(W(v), font, 10, maxW - 80);
    page.drawText(vl[0] ?? "", { x: M + 80, y: y - 11, size: 10, font, color: rgb(0.2, 0.25, 0.33) });
    y -= 15;
  }
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.8, color: rgb(0.8, 0.84, 0.88) });
  y -= 22;

  const heading = (t: string) => {
    ensure(34);
    page.drawText(W(t), { x: M, y: y - 14, size: 14, font: bold, color: rgb(0.06, 0.09, 0.16) });
    y -= 26;
  };

  if (o.summary?.length) {
    heading("Ringkasan");
    for (const s of o.summary) {
      const ls = wrapLines(W(s), font, 10.5, maxW - 14);
      ensure(ls.length * 15 + 4);
      page.drawText("-", { x: M + 2, y: y - 11, size: 10.5, font: bold, color: rgb(0.31, 0.27, 0.9) });
      for (const l of ls) { page.drawText(l, { x: M + 14, y: y - 11, size: 10.5, font, color: rgb(0.15, 0.2, 0.27) }); y -= 15; }
      y -= 4;
    }
    y -= 8;
  }
  if (o.keywords?.length) {
    const ls = wrapLines(W(`Kata kunci: ${o.keywords.join(" · ").replace(/·/g, "|")}`), font, 10, maxW);
    ensure(ls.length * 14 + 14);
    for (const l of ls) { page.drawText(l, { x: M, y: y - 10, size: 10, font, color: rgb(0.28, 0.33, 0.41) }); y -= 14; }
    y -= 14;
  }

  heading("Transkrip");
  const palette = [rgb(0.11, 0.31, 0.85), rgb(0.74, 0.09, 0.36), rgb(0.02, 0.47, 0.34), rgb(0.7, 0.33, 0.04), rgb(0.43, 0.16, 0.85), rgb(0.05, 0.45, 0.52)];
  for (const p of paras) {
    const stamp = o.timestamps ? `[${fmtTime(p.start)}]` : "";
    const who = o.speakers && p.speaker != null ? `${W(spName(meta, p.speaker))}:` : "";
    const indent = 0;
    const headW = (stamp ? mono.widthOfTextAtSize(stamp, 8.5) + 6 : 0) + (who ? bold.widthOfTextAtSize(who, 10.5) + 5 : 0);
    // first line is preceded by the stamp/speaker, so wrap the body with a reduced first-line width
    const body = W(p.text);
    const words = body.split(" ");
    const lines: string[] = [];
    let cur = "";
    let width = maxW - headW - indent;
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, 10.5) <= width) cur = test;
      else { if (cur) lines.push(cur); cur = w; width = maxW - indent; }
    }
    if (cur) lines.push(cur);
    ensure(Math.min(lines.length, 2) * 15 + 6);
    let x = M;
    if (stamp) { page.drawText(stamp, { x, y: y - 11, size: 8.5, font: mono, color: rgb(0.58, 0.64, 0.72) }); x += mono.widthOfTextAtSize(stamp, 8.5) + 6; }
    if (who) page.drawText(who, { x, y: y - 11, size: 10.5, font: bold, color: palette[(p.speaker ?? 0) % palette.length] });
    lines.forEach((l, i) => {
      if (i > 0) ensure(15);
      page.drawText(l, { x: i === 0 ? M + headW : M, y: y - 11, size: 10.5, font, color: rgb(0.1, 0.13, 0.2) });
      y -= 15;
    });
    y -= 7;
  }

  // page numbers (bottom-right keeps clear of the bottom-left branding stamp)
  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    const t = `${i + 1} / ${pages.length}`;
    pg.drawText(t, { x: PW - M - font.widthOfTextAtSize(t, 9), y: 30, size: 9, font, color: rgb(0.58, 0.64, 0.72) });
  });
  await stampGamatoBranding(pdf);
  return new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" });
}
