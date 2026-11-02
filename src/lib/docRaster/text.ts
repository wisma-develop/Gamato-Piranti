// Render teks polos / Markdown / kode / JSON / CSV / RTF → halaman gambar (A4) dengan font Unicode penuh.

import { readRtfText } from "@/lib/officeReaders";
import {
  cssFamily, defaultParaFmt, defaultStyle, emitLine, layoutParagraph, paraHeight,
  type Inline, type Op, type ParaLayout, type RasterDoc, type RasterPage, type RunStyle,
} from "./core";

const PW = 595.28, PH = 841.89, M = 56;
const W = PW - M * 2;

function inlineMd(text: string, base: RunStyle): Inline[] {
  const out: Inline[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ kind: "text", text: text.slice(last, m.index), style: base });
    const tok = m[0];
    if (tok.startsWith("**") || tok.startsWith("__")) out.push({ kind: "text", text: tok.slice(2, -2), style: { ...base, bold: true } });
    else if (tok.startsWith("~~")) out.push({ kind: "text", text: tok.slice(2, -2), style: { ...base, strike: true } });
    else if (tok.startsWith("`")) out.push({ kind: "text", text: tok.slice(1, -1), style: { ...base, font: cssFamily("Consolas"), size: base.size * 0.92, highlight: "#eef0f3", color: "#b3261e" } });
    else if (tok.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)!;
      out.push({ kind: "text", text: mm[1], style: { ...base, color: "#1a56db", underline: true } });
    } else out.push({ kind: "text", text: tok.slice(1, -1), style: { ...base, italic: true } });
    last = m.index! + tok.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last), style: base });
  return out.length ? out : [{ kind: "text", text: "", style: base }];
}

interface Item { layout: ParaLayout; pageBreakBefore?: boolean; keepNext?: boolean }

function paginate(items: Item[], bg = "#ffffff"): RasterPage[] {
  const pages: RasterPage[] = [];
  let cur: RasterPage = { w: PW, h: PH, bg, ops: [] };
  let y = M;
  const bottom = PH - M;
  const np = () => { pages.push(cur); cur = { w: PW, h: PH, bg, ops: [] }; y = M; };
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    const L = it.layout;
    if (it.pageBreakBefore && y > M + 1) np();
    if (y > M + 0.5) y += L.fmt.spaceBefore;
    // judul tidak ditinggal sendirian di dasar halaman
    if (it.keepNext && y + paraHeight(L, false) + 40 > bottom && y > M + 1) np();
    const left = M + L.fmt.indentLeft;
    const total = paraHeight(L, false);
    const fitsHere = y + total <= bottom;
    if (L.fmt.shade) cur.ops.push({ t: "rect", x: left - 6, y: y - 2, w: W - L.fmt.indentLeft - L.fmt.indentRight + 12, h: Math.min(total, bottom - y) + 4, fill: L.fmt.shade, r: 4 });
    if (L.fmt.leftRule) cur.ops.push({ t: "rect", x: left - 10, y, w: L.fmt.leftRule.width, h: Math.min(total, bottom - y), fill: L.fmt.leftRule.color });
    for (const ln of L.lines) {
      if (y + ln.h > bottom + 0.5 && y > M + 0.5) {
        np();
        if (L.fmt.shade) cur.ops.push({ t: "rect", x: left - 6, y: y - 2, w: W - L.fmt.indentLeft - L.fmt.indentRight + 12, h: Math.min(total, bottom - y) + 4, fill: L.fmt.shade, r: 4 });
      }
      emitLine(cur.ops, ln, left, y);
      y += ln.h;
    }
    if (L.fmt.bottomRule) cur.ops.push({ t: "line", x1: M, y1: y + 2, x2: PW - M, y2: y + 2, color: L.fmt.bottomRule.color, lw: L.fmt.bottomRule.width });
    y += L.fmt.spaceAfter;
    void fitsHere;
  }
  pages.push(cur);
  return pages;
}

function plainItems(text: string, mono: boolean): Item[] {
  const style = defaultStyle({ size: mono ? 9.5 : 11, font: cssFamily(mono ? "Consolas" : "Calibri"), color: "#111827" });
  const fmt = defaultParaFmt({ spaceAfter: mono ? 0 : 6, lineMult: mono ? 1.25 : 1.35 });
  const items: Item[] = [];
  for (const raw of text.replace(/\t/g, "    ").split(/\r?\n/)) {
    // monospace: pertahankan spasi di awal baris (indentasi) dengan karakter NBSP
    const line = mono ? raw.replace(/^ +/, (s) => "\u00a0".repeat(s.length)) : raw;
    items.push({ layout: layoutParagraph([{ kind: "text", text: line || " ", style }], fmt, W) });
  }
  return items;
}

function markdownItems(text: string): Item[] {
  const sans = defaultStyle({ size: 11, font: cssFamily("Calibri"), color: "#1f2937" });
  const mono = defaultStyle({ size: 9.5, font: cssFamily("Consolas"), color: "#1f2937" });
  const items: Item[] = [];
  const lines = text.replace(/\t/g, "    ").split(/\r?\n/);
  let para: string[] = [];
  const flushPara = () => {
    if (!para.length) return;
    items.push({ layout: layoutParagraph(inlineMd(para.join(" "), sans), defaultParaFmt({ spaceAfter: 7, lineMult: 1.35 }), W) });
    para = [];
  };
  let i = 0;
  const olCount: number[] = [];
  while (i < lines.length) {
    const ln = lines[i];
    if (/^```/.test(ln)) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      code.forEach((c, k) => items.push({
        layout: layoutParagraph([{ kind: "text", text: c.replace(/^ +/, (s) => "\u00a0".repeat(s.length)) || " ", style: mono }],
          defaultParaFmt({ shade: "#f3f4f6", lineMult: 1.25, spaceAfter: k === code.length - 1 ? 8 : 0, indentLeft: 0 }), W),
      }));
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(ln);
    if (h) {
      flushPara();
      const lvl = h[1].length;
      const size = [24, 19, 15.5, 13, 12, 11][lvl - 1];
      items.push({
        layout: layoutParagraph(inlineMd(h[2], { ...sans, size, bold: true, color: "#0f172a" }),
          defaultParaFmt({ spaceBefore: lvl <= 2 ? 10 : 6, spaceAfter: 6, lineMult: 1.15, bottomRule: lvl <= 2 ? { color: "#d1d5db", width: 0.8 } : undefined }), W),
        keepNext: true,
      });
      i++;
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(ln)) {
      flushPara();
      items.push({ layout: layoutParagraph([{ kind: "text", text: " ", style: { ...sans, size: 4 } }], defaultParaFmt({ bottomRule: { color: "#9ca3af", width: 0.8 }, spaceAfter: 8 }), W) });
      i++;
      continue;
    }
    const bq = /^>\s?(.*)$/.exec(ln);
    if (bq) {
      flushPara();
      items.push({ layout: layoutParagraph(inlineMd(bq[1], { ...sans, italic: true, color: "#4b5563" }), defaultParaFmt({ indentLeft: 14, spaceAfter: 4, leftRule: { color: "#9ca3af", width: 3 } }), W - 0) });
      i++;
      continue;
    }
    const ul = /^(\s*)[-*+]\s+(.*)$/.exec(ln);
    const ol = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(ln);
    if (ul || ol) {
      flushPara();
      const indentSp = (ul ? ul[1] : ol![1]).length;
      const depth = Math.floor(indentSp / 2);
      const label = ul ? (depth % 2 ? "◦" : "•") : `${ol![2]}.`;
      const left = 18 + depth * 16;
      const f = defaultParaFmt({ indentLeft: left, spaceAfter: 3, lineMult: 1.3, bullet: { text: label, style: sans } });
      (f as any)._bulletX = -14;
      items.push({ layout: layoutParagraph(inlineMd(ul ? ul[2] : ol![3], sans), f, W) });
      i++;
      continue;
    }
    if (!ln.trim()) {
      flushPara();
      i++;
      olCount.length = 0;
      continue;
    }
    para.push(ln.trim());
    i++;
  }
  flushPara();
  return items;
}

export type TextKind = "txt" | "md" | "code" | "rtf";

export function textKindFor(name: string): TextKind {
  const e = name.split(".").pop()?.toLowerCase() ?? "";
  if (e === "md" || e === "markdown") return "md";
  if (e === "rtf") return "rtf";
  if (["json", "csv", "tsv", "log", "xml", "yml", "yaml", "ini", "js", "ts", "tsx", "jsx", "css", "html", "htm", "py", "java", "c", "cpp", "cs", "go", "rs", "php", "rb", "sh", "sql"].includes(e)) return "code";
  return "txt";
}

export async function renderTextDocument(file: File): Promise<RasterDoc> {
  const kind = textKindFor(file.name);
  const notes: string[] = [];
  let items: Item[];
  if (kind === "rtf") {
    items = plainItems(await readRtfText(file), false);
    notes.push("RTF dibaca sebagai teks polos (gaya huruf/tabel RTF tidak dipertahankan).");
  } else {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (!text.trim()) throw new Error("File teks kosong.");
    if (/\.json$/i.test(file.name)) {
      try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* biarkan apa adanya */ }
    }
    items = kind === "md" ? markdownItems(text) : plainItems(text, kind === "code");
  }
  const pages = paginate(items);
  if (pages.length > 400) throw new Error("Dokumen terlalu panjang (>400 halaman) untuk dirender di browser.");
  return { pages, notes };
}

export type { Op };
