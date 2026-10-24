// Ekspor Surat ke .docx (bisa diedit di Word / Google Docs / LibreOffice).
// Tata letak mengikuti struktur surat yang sama dengan mesin kanvas; elemen yang tidak punya
// padanan layak di DOCX (watermark, bingkai halaman) tidak disertakan.

import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, LineRuleType, Packer, PageBreak, PageNumber, Paragraph, ShadingType,
  Table, TableCell, TableRow, TabStopType, TextRun, UnderlineType, VerticalAlign, WidthType, convertMillimetersToTwip,
  type ParagraphChild, type FileChild,
} from "docx";
import { parseRuns, type LetterAssets } from "@/lib/letterEngine";
import { buildQrMatrix } from "@/lib/couponEngine";
import { applyVars, blockLines, numberLabel, paperSpec, parseTable, signerCount, type LetterBlock, type LetterDoc, type TextAlign } from "@/lib/letterTypes";

const tw = convertMillimetersToTwip;
const hex = (c: string) => c.replace("#", "").toUpperCase().padEnd(6, "0").slice(0, 6);

const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const NO_BORDERS = { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE } as const;
const CELL_NO = { top: NONE, bottom: NONE, left: NONE, right: NONE } as const;

async function imgToPng(img: HTMLImageElement | null): Promise<{ data: Uint8Array; w: number; h: number } | null> {
  if (!img) return null;
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) return null;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0);
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
  if (!blob) return null;
  return { data: new Uint8Array(await blob.arrayBuffer()), w, h };
}

async function qrPng(text: string): Promise<{ data: Uint8Array; w: number; h: number } | null> {
  const m = buildQrMatrix(text, "M");
  if (!m) return null;
  const cell = 8, pad = 16, size = m.length * cell + pad * 2;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, size, size);
  g.fillStyle = "#111827";
  m.forEach((row, r) => row.forEach((on, k) => { if (on) g.fillRect(pad + k * cell, pad + r * cell, cell, cell); }));
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
  return blob ? { data: new Uint8Array(await blob.arrayBuffer()), w: size, h: size } : null;
}

const alignOf = (a: TextAlign) => (a === "center" ? AlignmentType.CENTER : a === "right" ? AlignmentType.RIGHT : a === "justify" ? AlignmentType.JUSTIFIED : AlignmentType.LEFT);

export async function letterToDocx(doc: LetterDoc, vars: Record<string, string>, assets: LetterAssets): Promise<Blob> {
  const T = (s: string) => applyVars(s, vars);
  const paper = paperSpec(doc.paper);
  const font = doc.fontFamily;
  const size = Math.round(doc.fontSize * 2);
  const color = hex(doc.colorText);
  const contentMM = paper.wMM - doc.marginLeft - doc.marginRight;
  const contentTw = tw(contentMM);
  const spacing = { line: Math.round(240 * doc.lineHeight), lineRule: LineRuleType.AUTO, after: Math.round(doc.paraSpacing * 20), before: 0 };

  const runsFor = (text: string, o: { bold?: boolean; size?: number; color?: string; underline?: boolean; font?: string } = {}): TextRun[] =>
    parseRuns(T(text), !!o.bold).map((r) => new TextRun({
      text: r.t, bold: r.b, italics: r.i, underline: r.u || o.underline ? { type: UnderlineType.SINGLE } : undefined,
      font: o.font ?? font, size: o.size ?? size, color: o.color ?? color,
    }));

  const para = (text: string, o: { align?: TextAlign; indentFirst?: boolean; bold?: boolean; after?: number; keepNext?: boolean; size?: number; underline?: boolean; before?: number } = {}) =>
    new Paragraph({
      children: runsFor(text, { bold: o.bold, size: o.size, underline: o.underline }),
      alignment: alignOf(o.align ?? doc.align),
      indent: o.indentFirst ? { firstLine: tw(12.5) } : undefined,
      spacing: { ...spacing, after: o.after ?? spacing.after, before: o.before ?? 0 },
      keepNext: o.keepNext,
    });

  const body: FileChild[] = [];

  // tanggal
  const dateLine = [T(doc.city).trim(), vars.tanggal].filter(Boolean).join(", ");
  if (doc.dateLocation === "top" && dateLine) body.push(para(dateLine, { align: doc.dateAlign, after: 200 }));

  // meta (Nomor/Sifat/Lampiran/Hal)
  if (doc.metaEnabled) {
    const rows = ([["Nomor", vars.nomor ?? ""], ["Sifat", T(doc.sifat)], ["Lampiran", T(doc.lampiran)], ["Hal", T(doc.perihal)]] as [string, string][]).filter((r) => r[1].trim());
    if (rows.length) {
      const w = [tw(24), tw(4), contentTw - tw(28)];
      body.push(new Table({
        width: { size: contentTw, type: WidthType.DXA }, columnWidths: w, borders: NO_BORDERS,
        rows: rows.map(([l, v]) => new TableRow({
          cantSplit: true,
          children: [l, ":", v].map((t, i) => new TableCell({ width: { size: w[i], type: WidthType.DXA }, borders: CELL_NO, children: [new Paragraph({ children: runsFor(t, { bold: i === 2 && l === "Hal" }), spacing: { ...spacing, after: 0 } })] })),
        })),
      }));
      body.push(new Paragraph({ children: [], spacing: { after: 160 } }));
    }
  }

  // tujuan
  if (doc.addressee.trim()) {
    T(doc.addressee).split(/\r?\n/).forEach((l, i, a) => body.push(para(l, { align: "left", after: i === a.length - 1 ? 200 : 0, keepNext: true })));
  }

  const dataTable = (b: LetterBlock) => {
    const rows = (b.rows ?? []).filter((r) => T(r.label).trim() || T(r.value).trim());
    if (!rows.length) return;
    const lw = tw(b.labelWidth ?? 32), indent = tw(6), cw = tw(4);
    const w = [lw, cw, contentTw - indent - lw - cw];
    body.push(new Table({
      width: { size: contentTw - indent, type: WidthType.DXA }, columnWidths: w, borders: NO_BORDERS, indent: { size: indent, type: WidthType.DXA },
      rows: rows.map((r) => new TableRow({ cantSplit: true, children: [T(r.label), ":", T(r.value)].map((t, i) => new TableCell({ width: { size: w[i], type: WidthType.DXA }, borders: CELL_NO, children: [new Paragraph({ children: i === 1 ? [new TextRun({ text: t, font, size, color })] : runsFor(t), spacing: { ...spacing, after: 0 } })] })) })),
    }));
    body.push(new Paragraph({ children: [], spacing: { after: Math.round(doc.paraSpacing * 20) } }));
  };

  for (const b of doc.blocks) {
    switch (b.type) {
      case "heading": {
        const a = !b.align || b.align === "auto" ? "center" : (b.align as TextAlign);
        body.push(new Paragraph({ children: runsFor(T(b.text), { bold: true, size: size + 2, underline: b.underline }), alignment: alignOf(a), spacing: { ...spacing, after: b.sub ? 0 : 160 }, keepNext: true }));
        if (b.sub) body.push(new Paragraph({ children: runsFor(b.sub, { bold: false }), alignment: alignOf(a), spacing: { ...spacing, after: 160 }, keepNext: true }));
        break;
      }
      case "paragraph":
        if (!T(b.text).trim()) body.push(new Paragraph({ children: [], spacing }));
        else body.push(para(b.text, { align: !b.align || b.align === "auto" ? doc.align : b.align, indentFirst: b.indent, bold: b.bold }));
        break;
      case "numbered":
      case "bullets": {
        const lines = blockLines(T(b.text));
        const lab = (i: number) => (b.type === "bullets" ? "•" : numberLabel(i, b.numStyle ?? "1."));
        const hang = tw(7), left = tw(6) + hang;
        lines.forEach((l, i) => body.push(new Paragraph({
          children: [new TextRun({ text: lab(i), font, size, color }), new TextRun({ text: "\t", font, size }), ...runsFor(l)],
          tabStops: [{ type: TabStopType.LEFT, position: left }],
          indent: { left, hanging: hang },
          alignment: doc.align === "justify" ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
          spacing: { ...spacing, after: i === lines.length - 1 ? spacing.after : 60 },
        })));
        break;
      }
      case "data": dataTable(b); break;
      case "table": {
        const grid = parseTable(T(b.text));
        if (!grid.length) break;
        const cols = Math.max(...grid.map((r) => r.length));
        const colW = Math.floor(contentTw / cols);
        const bd = { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" } as const;
        body.push(new Table({
          width: { size: contentTw, type: WidthType.DXA }, columnWidths: Array(cols).fill(colW),
          rows: grid.map((r, ri) => new TableRow({
            cantSplit: true, tableHeader: !!b.header && ri === 0,
            children: Array.from({ length: cols }, (_, ci) => new TableCell({
              width: { size: colW, type: WidthType.DXA }, borders: { top: bd, bottom: bd, left: bd, right: bd },
              shading: b.header && ri === 0 ? { type: ShadingType.CLEAR, fill: "E8EDF7", color: "auto" } : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ children: runsFor(r[ci] ?? "", { bold: !!b.header && ri === 0 }), spacing: { ...spacing, after: 0 } })],
            })),
          })),
        }));
        body.push(new Paragraph({ children: [], spacing: { after: Math.round(doc.paraSpacing * 20) } }));
        break;
      }
      case "spacer": body.push(new Paragraph({ children: [], spacing: { before: tw(b.height ?? 6), after: 0 } })); break;
      case "pagebreak": body.push(new Paragraph({ children: [new PageBreak()] })); break;
    }
  }

  // tanda tangan
  if (doc.signEnabled) {
    const count = signerCount(doc.signLayout);
    const signers = doc.signers.slice(0, count);
    const stamp = await imgToPng(assets.stamp);
    const cellFor = async (idx: number, w: number) => {
      const s = signers[idx];
      const kids: Paragraph[] = [];
      const c = (text: string, o: { bold?: boolean; after?: number } = {}) => new Paragraph({ children: runsFor(text, { bold: o.bold }), alignment: AlignmentType.CENTER, spacing: { ...spacing, after: o.after ?? 0 } });
      if (doc.dateLocation === "signature" && dateLine) kids.push(idx === signers.length - 1 ? c(dateLine) : c(" "));
      if (T(s.heading).trim()) kids.push(c(s.heading));
      if (T(s.role).trim()) kids.push(c(s.role, { bold: true }));
      const gapMM = Math.max(doc.signGap, doc.materai ? 18 : 8);
      const sig = await imgToPng(assets.sigs[s.id] ?? null);
      const qr = s.qr ? await qrPng(`Ditandatangani secara elektronik oleh ${T(s.name)} — ${vars.nomor ? `No. ${vars.nomor} — ` : ""}${vars.tanggal}`) : null;
      const pic = qr ?? sig;
      const kidsRuns: ParagraphChild[] = [];
      if (s.showStamp && stamp) {
        const hpx = Math.round(gapMM * 3.78 * 1.1);
        kidsRuns.push(new ImageRun({ type: "png", data: stamp.data, transformation: { width: Math.round((hpx * stamp.w) / stamp.h), height: hpx } }));
      }
      if (pic) {
        const hpx = Math.round(gapMM * 3.78 * (qr ? 0.95 : 1));
        kidsRuns.push(new ImageRun({ type: "png", data: pic.data, transformation: { width: Math.min(Math.round((hpx * pic.w) / pic.h), Math.round((w / 15) * 0.75)), height: hpx } }));
      }
      if (kidsRuns.length) kids.push(new Paragraph({ children: kidsRuns, alignment: AlignmentType.CENTER, spacing: { ...spacing, after: 0 } }));
      else if (doc.materai && idx === signers.length - 1) kids.push(new Paragraph({ children: [new TextRun({ text: "[ Materai Rp10.000 ]", font, size: Math.round(size * 0.7), color: "94A3B8" })], alignment: AlignmentType.CENTER, spacing: { before: tw(gapMM) / 3, after: tw(gapMM) / 3 } }));
      else kids.push(new Paragraph({ children: [], spacing: { before: tw(gapMM), after: 0 } }));
      kids.push(c(s.name, { bold: true }));
      if (s.idValue.trim()) kids.push(c(`${s.idLabel ? `${T(s.idLabel)} ` : ""}${T(s.idValue)}`));
      return kids;
    };
    const blockW = doc.signLayout === "three" ? Math.floor(contentTw / 3) : doc.signLayout === "two" ? Math.floor(Math.min(contentTw * 0.44, tw(80))) : Math.floor(Math.min(contentTw * 0.52, tw(82)));
    let widths: number[];
    let slots: (number | null)[];
    if (doc.signLayout === "three") { widths = [blockW, blockW, blockW]; slots = [0, 1, 2]; }
    else if (doc.signLayout === "two") { widths = [blockW, contentTw - blockW * 2, blockW]; slots = [0, null, 1]; }
    else if (doc.signLayout === "left") { widths = [blockW, contentTw - blockW]; slots = [0, null]; }
    else if (doc.signLayout === "center") { const side = Math.floor((contentTw - blockW) / 2); widths = [side, blockW, contentTw - blockW - side]; slots = [null, 0, null]; }
    else { widths = [contentTw - blockW, blockW]; slots = [null, 0]; }
    const cells = await Promise.all(slots.map(async (slot, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA }, borders: CELL_NO, verticalAlign: VerticalAlign.TOP,
      children: slot === null ? [new Paragraph({ children: [] })] : await cellFor(slot, widths[i]),
    })));
    body.push(new Paragraph({ children: [], spacing: { after: 120 }, keepNext: true }));
    body.push(new Table({ width: { size: contentTw, type: WidthType.DXA }, columnWidths: widths, borders: NO_BORDERS, rows: [new TableRow({ cantSplit: true, children: cells })] }));
  }

  // tembusan
  const tem = blockLines(T(doc.tembusan));
  if (tem.length) {
    body.push(new Paragraph({ children: [], spacing: { after: 160 } }));
    body.push(new Paragraph({ children: runsFor("Tembusan:", { size: Math.round(size * 0.92) }), spacing: { ...spacing, after: 0 }, keepNext: true }));
    tem.forEach((l, i) => body.push(new Paragraph({
      children: [new TextRun({ text: `${i + 1}.`, font, size: Math.round(size * 0.92), color }), new TextRun({ text: "\t", font }), ...runsFor(l, { size: Math.round(size * 0.92) })],
      tabStops: [{ type: TabStopType.LEFT, position: tw(7) }], indent: { left: tw(7), hanging: tw(7) }, spacing: { ...spacing, after: 0 },
    })));
  }

  // lampiran
  if (doc.lampiranPage) {
    body.push(new Paragraph({ children: [new PageBreak()] }));
    body.push(new Paragraph({ children: runsFor(T(doc.lampiranTitle).trim() || "LAMPIRAN", { bold: true, size: size + 2, underline: true }), alignment: AlignmentType.CENTER, spacing: { ...spacing, after: 240 } }));
    T(doc.lampiranText).split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean).forEach((p) => body.push(para(p)));
  }

  // kop (di header) ----------------------------------------------------
  const logo = await imgToPng(assets.logo);
  const makeKop = (): (Paragraph | Table)[] => {
    if (!doc.kopEnabled) return [new Paragraph({ children: [] })];
    const col = hex(doc.kopColor);
    const lines: { t: string; s: number; b: boolean }[] = [
      { t: T(doc.kopLine1), s: size, b: true },
      { t: T(doc.kopName), s: Math.round(size * 1.55), b: true },
      { t: T(doc.kopAddress), s: Math.round(size * 0.76), b: false },
      { t: T(doc.kopContact), s: Math.round(size * 0.76), b: false },
    ].filter((l) => l.t.trim());
    const textAlign = doc.kopStyle === "klasik" || doc.kopStyle === "tengah" ? AlignmentType.CENTER : AlignmentType.LEFT;
    const textParas = lines.map((l, i) => new Paragraph({
      alignment: textAlign, spacing: { after: 0, line: 252, lineRule: LineRuleType.AUTO },
      border: i === lines.length - 1 && doc.kopLine !== "none" ? { bottom: { style: doc.kopLine === "double" ? BorderStyle.DOUBLE : doc.kopLine === "thick-thin" ? BorderStyle.THICK_THIN_SMALL_GAP : BorderStyle.SINGLE, size: doc.kopLine === "single" ? 8 : 18, space: 6, color: hex(doc.kopStyle === "modern" ? doc.colorAccent : doc.kopColor) } } : undefined,
      children: [new TextRun({ text: l.t, bold: l.b, font: doc.fontHeading, size: l.s, color: col })],
    }));
    const logoRun = logo ? [new ImageRun({ type: "png", data: logo.data, transformation: { width: Math.round((doc.kopLogoSize * 3.78 * Math.min(1.9, logo.w / logo.h))), height: Math.round(doc.kopLogoSize * 3.78) } })] : [];
    if (!logo || doc.kopStyle === "minimal") return textParas;
    if (doc.kopStyle === "tengah") return [new Paragraph({ children: logoRun, alignment: AlignmentType.CENTER, spacing: { after: 60 } }), ...textParas];
    const lw = tw(doc.kopLogoSize * 1.25);
    const right = doc.kopStyle === "logo-kanan";
    const widths = right ? [contentTw - lw, lw] : [lw, contentTw - lw];
    const logoCell = new TableCell({ width: { size: right ? lw : lw, type: WidthType.DXA }, borders: CELL_NO, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: logoRun, alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT })] });
    const textCell = new TableCell({ width: { size: widths[right ? 0 : 1], type: WidthType.DXA }, borders: CELL_NO, verticalAlign: VerticalAlign.CENTER, children: textParas });
    return [new Table({ width: { size: contentTw, type: WidthType.DXA }, columnWidths: widths, borders: NO_BORDERS, rows: [new TableRow({ children: right ? [textCell, logoCell] : [logoCell, textCell] })] })];
  };
  const kopChildren = makeKop();
  const firstHeader = new Header({ children: kopChildren });
  const contHeader = doc.kopEnabled && doc.kopAllPages
    ? new Header({ children: makeKop() })
    : new Header({ children: doc.contHeader ? [new Paragraph({ children: [new TextRun({ text: `${T(doc.perihal).trim() || vars.nomor || "Lanjutan surat"}`, font, size: Math.round(size * 0.8), color: "64748B" })], border: { bottom: { style: BorderStyle.SINGLE, size: 4, space: 2, color: "CBD5E1" } } })] : [new Paragraph({ children: [] })] });

  const pageNumRuns = (): TextRun[] => {
    const parts = doc.pageNumFormat.split(/(\{n\}|\{total\})/);
    return parts.filter(Boolean).map((p) => (p === "{n}" ? new TextRun({ children: [PageNumber.CURRENT], font, size: Math.round(size * 0.78), color: "64748B" })
      : p === "{total}" ? new TextRun({ children: [PageNumber.TOTAL_PAGES], font, size: Math.round(size * 0.78), color: "64748B" })
      : new TextRun({ text: p, font, size: Math.round(size * 0.78), color: "64748B" })));
  };
  const footerParas: Paragraph[] = [];
  if (T(doc.footerText).trim()) footerParas.push(new Paragraph({ children: [new TextRun({ text: T(doc.footerText), font, size: Math.round(size * 0.78), color: "64748B" })] }));
  if (doc.pageNum !== "none") footerParas.push(new Paragraph({ alignment: doc.pageNum === "center" ? AlignmentType.CENTER : AlignmentType.RIGHT, children: pageNumRuns() }));
  const footer = new Footer({ children: footerParas.length ? footerParas : [new Paragraph({ children: [] })] });

  const document = new Document({
    creator: "Gamato Piranti",
    title: T(doc.perihal) || "Surat",
    styles: { default: { document: { run: { font, size, color }, paragraph: { spacing } } } },
    sections: [{
      properties: {
        titlePage: true,
        page: {
          size: { width: tw(paper.wMM), height: tw(paper.hMM) },
          margin: { top: tw(doc.marginTop), right: tw(doc.marginRight), bottom: tw(doc.marginBottom), left: tw(doc.marginLeft), header: tw(Math.min(12, doc.marginTop * 0.5)), footer: tw(Math.min(10, doc.marginBottom * 0.45)) },
        },
      },
      headers: { first: firstHeader, default: contHeader },
      footers: { first: footer, default: footer },
      children: body,
    }],
  });
  return Packer.toBlob(document);
}
