// Mesin tata letak Surat: mengubah LetterDoc + variabel menjadi halaman <canvas> (A4/F4/dst).
// Tahapan: (1) setiap blok → daftar "item" bertinggi pasti (baris teks, baris tabel, dll),
// (2) paginasi (jaga janda/yatim baris, tanda tangan tidak terpisah dari paragraf penutup),
// (3) gambar tiap halaman: bingkai, watermark, kop, isi, kaki. Pratinjau, PNG, dan PDF memakai
// hasil yang sama persis.

import { fontStack } from "@/lib/fontPresets";
import { drawLogoFit, roundRect } from "@/lib/businessDocCanvas";
import { buildQrMatrix } from "@/lib/couponEngine";
import {
  applyVars, blockLines, numberLabel, paperSpec, parseTable, signerCount,
  type LetterBlock, type LetterDoc, type Signer, type TextAlign,
} from "@/lib/letterTypes";

export interface LetterAssets {
  logo: HTMLImageElement | null;
  stamp: HTMLImageElement | null;
  sigs: Record<string, HTMLImageElement | null>;
}

export interface LetterRenderResult {
  pages: HTMLCanvasElement[];
}

// ── Teks kaya: **tebal**, *miring*, __garis bawah__ ──────────────────────

interface Run { t: string; b: boolean; i: boolean; u: boolean }
interface Tok { s: string; b: boolean; i: boolean; u: boolean; space: boolean; w: number }
interface Line { toks: Tok[]; last: boolean; indent: number }

export function parseRuns(text: string, baseBold = false): Run[] {
  const runs: Run[] = [];
  let b = baseBold, i = false, u = false, cur = "";
  const flush = () => { if (cur) { runs.push({ t: cur, b, i, u }); cur = ""; } };
  for (let k = 0; k < text.length; k++) {
    const ch = text[k];
    if (ch === "\\" && (text[k + 1] === "*" || text[k + 1] === "_")) { cur += text[k + 1]; k++; continue; }
    if (ch === "*" && text[k + 1] === "*") { flush(); b = baseBold ? true : !b; k++; continue; }
    if (ch === "_" && text[k + 1] === "_") { flush(); u = !u; k++; continue; }
    if (ch === "*") {
      const prev = text[k - 1], next = text[k + 1];
      if (!i && next && !/\s/.test(next)) { flush(); i = true; continue; }
      if (i && prev && !/\s/.test(prev)) { flush(); i = false; continue; }
    }
    cur += ch;
  }
  flush();
  return runs;
}

// ── Item aliran ──────────────────────────────────────────────────────────

interface Item {
  h: number;
  draw?: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => void;
  keepNext?: boolean;
  soft?: boolean; // spasi: dibuang di puncak halaman
  breakBefore?: boolean;
}

const rgba = (hex: string, a: number) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function renderLetter(doc: LetterDoc, vars: Record<string, string>, assets: LetterAssets, opts: { dpi?: number } = {}): LetterRenderResult {
  const dpi = opts.dpi ?? 150;
  const ppm = dpi / 25.4;
  const ptPx = dpi / 72;
  const paper = paperSpec(doc.paper);
  const PW = Math.round(paper.wMM * ppm), PH = Math.round(paper.hMM * ppm);
  const mL = doc.marginLeft * ppm, mR = doc.marginRight * ppm, mT = doc.marginTop * ppm, mB = doc.marginBottom * ppm;
  const contentW = Math.max(40, PW - mL - mR);
  const fs = doc.fontSize * ptPx;
  const lh = fs * doc.lineHeight;
  const paraGap = doc.paraSpacing * ptPx;
  const T = (s: string) => applyVars(s, vars);
  const color = doc.colorText;
  const muted = rgba(color, 0.62);

  const mc = document.createElement("canvas").getContext("2d")!;
  const bodyFam = fontStack(doc.fontFamily);
  const headFam = fontStack(doc.fontHeading);
  const font = (size: number, o: { b?: boolean; i?: boolean; head?: boolean } = {}) => `${o.i ? "italic " : ""}${o.b ? 700 : 400} ${size}px ${o.head ? headFam : bodyFam}`;

  // ── pembungkus kata ──
  const tokenize = (c: CanvasRenderingContext2D, runs: Run[], size: number): Tok[] => {
    const toks: Tok[] = [];
    let pending = false;
    for (const r of runs) {
      for (const part of r.t.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { pending = true; continue; }
        c.font = font(size, { b: r.b, i: r.i });
        toks.push({ s: part, b: r.b, i: r.i, u: r.u, space: pending && toks.length > 0, w: c.measureText(part).width });
        pending = false;
      }
    }
    return toks;
  };

  const wrapRuns = (c: CanvasRenderingContext2D, text: string, size: number, maxW: number, firstIndent = 0, baseBold = false): Line[] => {
    const lines: Line[] = [];
    text.split(/\r?\n/).forEach((para, pi) => {
      const toks = tokenize(c, parseRuns(para, baseBold), size);
      c.font = font(size);
      const sp = c.measureText(" ").width;
      let cur: Tok[] = [];
      let w = 0;
      let indent = pi === 0 ? firstIndent : 0;
      const pushLine = (last: boolean) => { lines.push({ toks: cur, last, indent }); cur = []; w = 0; indent = 0; };
      for (const tk of toks) {
        let t = tk;
        // kata yang lebih lebar dari kolom dipecah per karakter
        while (t.w > Math.max(10, maxW - indent) && t.s.length > 1) {
          c.font = font(size, { b: t.b, i: t.i });
          let n = t.s.length - 1;
          while (n > 1 && c.measureText(t.s.slice(0, n)).width > maxW - indent) n--;
          if (cur.length) pushLine(false);
          cur = [{ ...t, s: t.s.slice(0, n), space: false, w: c.measureText(t.s.slice(0, n)).width }];
          pushLine(false);
          const rest = t.s.slice(n);
          t = { ...t, s: rest, space: false, w: c.measureText(rest).width };
        }
        const gapW = cur.length && t.space ? sp : 0;
        if (cur.length && w + gapW + t.w > maxW - indent) pushLine(false);
        cur.push(t);
        w += (cur.length > 1 && t.space ? sp : 0) + t.w;
      }
      pushLine(true);
    });
    return lines;
  };

  const lineWidth = (c: CanvasRenderingContext2D, ln: Line, size: number) => {
    c.font = font(size);
    const sp = c.measureText(" ").width;
    return ln.toks.reduce((a, t, i) => a + t.w + (i > 0 && t.space ? sp : 0), 0);
  };

  const drawLine = (c: CanvasRenderingContext2D, ln: Line, x: number, y: number, w: number, align: TextAlign, size: number, col: string) => {
    c.font = font(size);
    const sp = c.measureText(" ").width;
    const nat = lineWidth(c, ln, size);
    const avail = w - ln.indent;
    let extra = 0;
    const gaps = ln.toks.filter((t, i) => i > 0 && t.space).length;
    if (align === "justify" && !ln.last && gaps > 0) {
      extra = (avail - nat) / gaps;
      if (extra < 0 || extra > sp * 3) extra = 0;
    }
    let cx = x + ln.indent;
    if (align === "center") cx = x + (w - nat) / 2;
    else if (align === "right") cx = x + w - nat;
    c.textBaseline = "top";
    c.textAlign = "left";
    c.fillStyle = col;
    const ty = y + (lh - size) / 2;
    ln.toks.forEach((t, i) => {
      if (i > 0 && t.space) cx += sp + extra;
      c.font = font(size, { b: t.b, i: t.i });
      c.fillText(t.s, cx, ty);
      if (t.u) {
        const nextU = ln.toks[i + 1]?.u && ln.toks[i + 1].space;
        c.fillRect(cx, ty + size * 1.06, t.w + (nextU ? sp + extra : 0), Math.max(1, size * 0.06));
      }
      cx += t.w;
    });
  };

  // ── pembuat item ──
  const items: Item[] = [];
  const gap = (h: number, keepNext = false) => items.push({ h, soft: true, keepNext });

  const textItems = (text: string, o: { x?: number; w?: number; align?: TextAlign; size?: number; bold?: boolean; indent?: number; col?: string; keepAll?: boolean } = {}): Item[] => {
    const size = o.size ?? fs;
    const w = (o.w ?? contentW) - (o.x ?? 0);
    const lines = wrapRuns(mc, text, size, w, o.indent ?? 0, !!o.bold);
    const n = lines.length;
    return lines.map((ln, idx) => ({
      h: lh * (size / fs),
      keepNext: o.keepAll ? idx < n - 1 : n >= 4 ? idx === 0 || idx === n - 2 : n === 3 ? idx < 2 : n === 2 ? idx === 0 : false,
      draw: (c, x, y, cw) => drawLine(c, ln, x + (o.x ?? 0), y, cw - (o.x ?? 0), o.align ?? "left", size, o.col ?? color),
    }));
  };

  /** Baris "label  :  nilai" dengan lebar label tetap, nilai membungkus dengan indentasi gantung. */
  const rowItem = (label: string, value: string, labelW: number, x0: number, o: { boldValue?: boolean } = {}): Item => {
    mc.font = font(fs);
    const colonW = mc.measureText(" : ").width;
    const valueX = x0 + labelW + colonW;
    const vLines = wrapRuns(mc, value, fs, contentW - valueX, 0, !!o.boldValue);
    const lLines = wrapRuns(mc, label, fs, labelW, 0);
    const n = Math.max(vLines.length, lLines.length, 1);
    return {
      h: lh * n,
      keepNext: true,
      draw: (c, x, y) => {
        lLines.forEach((ln, i) => drawLine(c, ln, x + x0, y + i * lh, labelW, "left", fs, color));
        c.font = font(fs);
        c.fillStyle = color;
        c.textBaseline = "top";
        c.textAlign = "left";
        c.fillText(":", x + x0 + labelW + mc.measureText(" ").width * 0.4, y + (lh - fs) / 2);
        vLines.forEach((ln, i) => drawLine(c, ln, x + valueX, y + i * lh, contentW - valueX, "left", fs, color));
      },
    };
  };

  const alignOf = (b: LetterBlock): TextAlign => (!b.align || b.align === "auto" ? doc.align : b.align);

  // ── Kop surat ──
  const kopFor = () => {
    if (!doc.kopEnabled) return { h: 0, draw: (_c: CanvasRenderingContext2D, _y: number) => undefined };
    const line1 = T(doc.kopLine1).trim(), name = T(doc.kopName).trim(), addr = T(doc.kopAddress).trim(), contact = T(doc.kopContact).trim();
    const logo = assets.logo;
    const logoH = doc.kopLogoSize * ppm;
    const logoW = logo ? Math.min(logoH * 1.9, logoH * ((logo.naturalWidth || 1) / (logo.naturalHeight || 1))) : 0;
    const gapX = logo ? 4 * ppm : 0;
    const col = doc.kopColor;
    const s1 = fs * 1.0, sN = fs * 1.55, sA = fs * 0.76;
    const style = doc.kopStyle;
    const textMaxFor = (st: string) => (st === "klasik" ? contentW - (logoW + gapX) * 2 : st === "tengah" || st === "minimal" ? contentW : contentW - logoW - gapX);
    const textBlock = (maxW: number, align: TextAlign) => {
      const parts: { lines: Line[]; size: number; bold: boolean; head: boolean; col: string; h: number }[] = [];
      const add = (txt: string, size: number, bold: boolean, head: boolean, c2: string, spacing = 1.18) => {
        if (!txt) return;
        const lines = wrapRuns(mc, txt, size, maxW, 0, bold);
        parts.push({ lines, size, bold, head, col: c2, h: lines.length * size * spacing });
      };
      add(line1, s1, true, true, col);
      add(name, sN, true, true, style === "modern" ? doc.colorAccent : col);
      add(addr, sA, false, false, rgba(col, 0.82));
      add(contact, sA, false, false, rgba(col, 0.82));
      const h = parts.reduce((a, p) => a + p.h, 0);
      const draw = (c: CanvasRenderingContext2D, x: number, y: number, w: number) => {
        let yy = y;
        for (const p of parts) {
          for (const ln of p.lines) {
            c.textBaseline = "top"; c.textAlign = "left"; c.fillStyle = p.col;
            const natW = ln.toks.reduce((a, t, i) => { c.font = font(p.size, { b: p.bold, head: p.head }); return a + c.measureText(t.s).width + (i > 0 && t.space ? c.measureText(" ").width : 0); }, 0);
            let cx = align === "center" ? x + (w - natW) / 2 : align === "right" ? x + w - natW : x;
            ln.toks.forEach((t, i) => {
              c.font = font(p.size, { b: p.bold, i: t.i, head: p.head });
              if (i > 0 && t.space) cx += c.measureText(" ").width;
              c.fillText(t.s, cx, yy);
              cx += c.measureText(t.s).width;
            });
            yy += p.size * 1.18;
          }
        }
      };
      return { h, draw };
    };

    let bodyH = 0;
    let drawBody: (c: CanvasRenderingContext2D, y: number) => void = () => undefined;
    if (style === "klasik") {
      const tb = textBlock(Math.max(40, textMaxFor("klasik")), "center");
      bodyH = Math.max(logo ? logoH : 0, tb.h);
      drawBody = (c, y) => {
        if (logo) drawLogoFit(c, logo, mL, y + (bodyH - logoH) / 2, logoW, logoH, { rounded: false });
        tb.draw(c, mL + logoW + gapX, y + (bodyH - tb.h) / 2, contentW - (logoW + gapX) * 2);
      };
    } else if (style === "tengah") {
      const tb = textBlock(contentW, "center");
      const lg = logo ? logoH + 2 * ppm : 0;
      bodyH = lg + tb.h;
      drawBody = (c, y) => {
        if (logo) drawLogoFit(c, logo, mL + (contentW - logoW) / 2, y, logoW, logoH, { rounded: false });
        tb.draw(c, mL, y + lg, contentW);
      };
    } else if (style === "logo-kanan") {
      const tb = textBlock(Math.max(40, textMaxFor("logo-kanan")), "left");
      bodyH = Math.max(logo ? logoH : 0, tb.h);
      drawBody = (c, y) => {
        tb.draw(c, mL, y + (bodyH - tb.h) / 2, contentW - logoW - gapX);
        if (logo) drawLogoFit(c, logo, mL + contentW - logoW, y + (bodyH - logoH) / 2, logoW, logoH, { rounded: false });
      };
    } else if (style === "modern") {
      const rightLines = [addr, contact].filter(Boolean);
      const rightW = contentW * 0.36;
      const rLines = rightLines.flatMap((t) => wrapRuns(mc, t, sA, rightW, 0));
      const rH = rLines.length * sA * 1.25;
      // di gaya modern alamat/kontak pindah ke kanan; blok kiri hanya instansi + nama
      const leftOnly = (() => {
        const parts: { lines: Line[]; size: number; col: string; head: boolean }[] = [];
        const addP = (txt: string, size: number, c2: string) => { if (txt) parts.push({ lines: wrapRuns(mc, txt, size, Math.max(40, contentW * 0.6 - logoW - gapX), 0, true), size, col: c2, head: true }); };
        addP(line1, s1, col); addP(name, sN, doc.colorAccent);
        const h = parts.reduce((a, p) => a + p.lines.length * p.size * 1.18, 0);
        return { parts, h };
      })();
      bodyH = Math.max(logo ? logoH : 0, leftOnly.h, rH);
      drawBody = (c, y) => {
        let x = mL;
        if (logo) { drawLogoFit(c, logo, x, y + (bodyH - logoH) / 2, logoW, logoH, { rounded: false }); x += logoW + gapX; }
        let yy = y + (bodyH - leftOnly.h) / 2;
        for (const p of leftOnly.parts) for (const ln of p.lines) {
          c.textBaseline = "top"; c.textAlign = "left"; c.fillStyle = p.col;
          let cx = x;
          ln.toks.forEach((t, i) => { c.font = font(p.size, { b: true, head: true }); if (i > 0 && t.space) cx += c.measureText(" ").width; c.fillText(t.s, cx, yy); cx += c.measureText(t.s).width; });
          yy += p.size * 1.18;
        }
        let ry = y + (bodyH - rH) / 2;
        for (const ln of rLines) {
          c.fillStyle = rgba(col, 0.85); c.textBaseline = "top";
          const nat = lineWidth(c, ln, sA);
          let cx = mL + contentW - nat;
          c.font = font(sA);
          const sp = c.measureText(" ").width;
          ln.toks.forEach((t, i) => { if (i > 0 && t.space) cx += sp; c.font = font(sA, { i: t.i }); c.fillText(t.s, cx, ry); cx += t.w; });
          ry += sA * 1.25;
        }
      };
    } else if (style === "minimal") {
      const tb = textBlock(contentW, "left");
      bodyH = tb.h;
      drawBody = (c, y) => tb.draw(c, mL, y, contentW);
    } else {
      // samping
      const tb = textBlock(Math.max(40, textMaxFor("samping")), "left");
      bodyH = Math.max(logo ? logoH : 0, tb.h);
      drawBody = (c, y) => {
        if (logo) drawLogoFit(c, logo, mL, y + (bodyH - logoH) / 2, logoW, logoH, { rounded: false });
        tb.draw(c, mL + logoW + gapX, y + (bodyH - tb.h) / 2, contentW - logoW - gapX);
      };
    }
    const ruleGap = 2.2 * ppm;
    const ruleH = doc.kopLine === "none" ? 0 : doc.kopLine === "single" ? 0.5 * ppm : doc.kopLine === "double" ? 1.7 * ppm : 1.9 * ppm;
    const h = bodyH + (ruleH ? ruleGap + ruleH : 0);
    const draw = (c: CanvasRenderingContext2D, y: number) => {
      drawBody(c, y);
      if (!ruleH) return;
      const ry = y + bodyH + ruleGap;
      const rc = style === "modern" ? doc.colorAccent : col;
      c.fillStyle = rc;
      if (doc.kopLine === "single") c.fillRect(mL, ry, contentW, 0.5 * ppm);
      else if (doc.kopLine === "double") { c.fillRect(mL, ry, contentW, 0.45 * ppm); c.fillRect(mL, ry + 1.25 * ppm, contentW, 0.45 * ppm); }
      else { c.fillRect(mL, ry, contentW, 1.1 * ppm); c.fillRect(mL, ry + 1.55 * ppm, contentW, 0.35 * ppm); }
    };
    return { h, draw };
  };
  const kop = kopFor();
  const kopGap = 5 * ppm;
  const contH = 8 * ppm;

  // ── tanggal, meta, tujuan ──
  const dateLine = [T(doc.city).trim(), vars.tanggal].filter(Boolean).join(", ");
  if (doc.dateLocation === "top" && dateLine) {
    items.push(...textItems(dateLine, { align: doc.dateAlign }));
    gap(paraGap * 1.4, true);
  }
  if (doc.metaEnabled) {
    const rows: [string, string, boolean?][] = [["Nomor", vars.nomor ?? ""], ["Sifat", T(doc.sifat)], ["Lampiran", T(doc.lampiran)], ["Hal", T(doc.perihal), true]];
    const used = rows.filter((r) => r[1].trim());
    const lw = 24 * ppm;
    used.forEach((r, i) => { const it = rowItem(r[0], r[1], lw, 0, { boldValue: !!r[2] }); it.keepNext = i < used.length - 1 ? true : false; items.push(it); });
    if (used.length) gap(paraGap * 1.6);
  }
  if (doc.addressee.trim()) {
    const lines = T(doc.addressee).split(/\r?\n/);
    lines.forEach((l, i) => { const its = textItems(l, { keepAll: true }); if (i === lines.length - 1) its.forEach((it) => (it.keepNext = false)); items.push(...its); });
    gap(paraGap * 1.4);
  }

  // ── blok isi ──
  const indentFirst = 12.5 * ppm;
  doc.blocks.forEach((b, bi) => {
    const last = bi === doc.blocks.length - 1;
    switch (b.type) {
      case "heading": {
        const size = fs * 1.15;
        const text = T(b.text);
        const its = textItems(b.underline ? `__${text}__` : text, { size, bold: true, align: !b.align || b.align === "auto" ? "center" : (b.align as TextAlign), keepAll: true });
        its.forEach((it) => (it.keepNext = true));
        items.push(...its);
        const sub = T(b.sub ?? "");
        if (sub) items.push(...textItems(sub, { align: !b.align || b.align === "auto" ? "center" : (b.align as TextAlign), keepAll: true }).map((it) => ({ ...it, keepNext: true })));
        gap(paraGap * 0.9, true);
        break;
      }
      case "paragraph": {
        const text = T(b.text);
        if (!text.trim()) { gap(lh * 0.6); break; }
        items.push(...textItems(text, { align: alignOf(b), bold: b.bold, indent: b.indent ? indentFirst : 0 }));
        gap(paraGap);
        break;
      }
      case "numbered":
      case "bullets": {
        const lines = blockLines(T(b.text));
        const style = b.numStyle ?? "1.";
        const listX = 6 * ppm;
        const labels = lines.map((_l, i) => (b.type === "bullets" ? "•" : numberLabel(i, style)));
        mc.font = font(fs);
        const labW = Math.max(...labels.map((l) => mc.measureText(l).width), 0) + 2.2 * ppm;
        lines.forEach((l, i) => {
          const wrapped = wrapRuns(mc, l, fs, contentW - listX - labW, 0);
          const n = wrapped.length;
          wrapped.forEach((ln, li) => items.push({
            h: lh,
            keepNext: n > 1 ? li < n - 1 : false,
            draw: (c, x, y, w) => {
              if (li === 0) { c.font = font(fs); c.fillStyle = color; c.textBaseline = "top"; c.textAlign = "left"; c.fillText(labels[i], x + listX, y + (lh - fs) / 2); }
              drawLine(c, ln, x + listX + labW, y, w - listX - labW, doc.align === "justify" ? "justify" : "left", fs, color);
            },
          }));
          if (i < lines.length - 1) items.push({ h: paraGap * 0.35, soft: true });
        });
        gap(paraGap);
        break;
      }
      case "data": {
        const rows = (b.rows ?? []).map((r) => ({ label: T(r.label), value: T(r.value) })).filter((r) => r.label.trim() || r.value.trim());
        rows.forEach((r, i) => { const it = rowItem(r.label, r.value, (b.labelWidth ?? 32) * ppm, 6 * ppm); it.keepNext = rows.length <= 8 ? i < rows.length - 1 : false; items.push(it); });
        if (rows.length) gap(paraGap);
        break;
      }
      case "table": {
        const grid = parseTable(T(b.text));
        if (!grid.length) break;
        const cols = Math.max(...grid.map((r) => r.length));
        const pad = 1.6 * ppm;
        const nat: number[] = Array(cols).fill(0);
        grid.forEach((r, ri) => r.forEach((cell, ci) => { mc.font = font(fs, { b: !!b.header && ri === 0 }); nat[ci] = Math.max(nat[ci], mc.measureText(cell).width + pad * 2); }));
        const total = nat.reduce((a, v) => a + v, 0);
        let widths = nat.map((v) => (v / total) * contentW);
        if (total < contentW * 0.98) widths = nat.map((v) => v + (contentW - total) / cols);
        const minW = contentW * 0.08;
        widths = widths.map((v) => Math.max(minW, v));
        const sum = widths.reduce((a, v) => a + v, 0);
        widths = widths.map((v) => (v / sum) * contentW);
        grid.forEach((r, ri) => {
          const isHead = !!b.header && ri === 0;
          const cells = Array.from({ length: cols }, (_, ci) => wrapRuns(mc, r[ci] ?? "", fs, widths[ci] - pad * 2, 0, isHead));
          const n = Math.max(...cells.map((cl) => cl.length), 1);
          const rh = n * lh + pad * 1.2;
          items.push({
            h: rh,
            keepNext: isHead,
            draw: (c, x, y, w) => {
              void w;
              let cx = x;
              cells.forEach((cl, ci) => {
                if (isHead) { c.fillStyle = rgba(doc.colorAccent, 0.1); c.fillRect(cx, y, widths[ci], rh); }
                c.strokeStyle = rgba(color, 0.45); c.lineWidth = Math.max(1, ppm * 0.18);
                c.strokeRect(cx, y, widths[ci], rh);
                cl.forEach((ln, li) => drawLine(c, ln, cx + pad, y + pad * 0.6 + li * lh, widths[ci] - pad * 2, "left", fs, color));
                cx += widths[ci];
              });
            },
          });
        });
        gap(paraGap);
        break;
      }
      case "spacer":
        items.push({ h: Math.max(1, b.height ?? 6) * ppm, soft: false });
        break;
      case "pagebreak":
        items.push({ h: 0, breakBefore: true });
        break;
    }
    void last;
  });

  // ── tanda tangan ──
  if (doc.signEnabled) {
    const count = signerCount(doc.signLayout);
    const signers = doc.signers.slice(0, count);
    if (signers.length) {
      const blockW = doc.signLayout === "three" ? contentW / 3 - 2 * ppm : doc.signLayout === "two" ? Math.min(contentW * 0.44, 80 * ppm) : Math.min(contentW * 0.52, 82 * ppm);
      const xs: number[] =
        doc.signLayout === "three" ? [0, (contentW - blockW) / 2, contentW - blockW]
        : doc.signLayout === "two" ? [0, contentW - blockW]
        : doc.signLayout === "left" ? [0]
        : doc.signLayout === "center" ? [(contentW - blockW) / 2]
        : [contentW - blockW];
      const rightmost = signers.length - 1;
      const gapH = Math.max(doc.signGap, doc.materai ? 18 : 8) * ppm;
      const dateH = doc.dateLocation === "signature" && dateLine ? lh : 0;
      const cells = signers.map((s, i) => {
        const heading = wrapRuns(mc, T(s.heading), fs, blockW, 0);
        const role = wrapRuns(mc, T(s.role), fs, blockW, 0, true);
        const nameLines = wrapRuns(mc, T(s.name), fs, blockW, 0, true);
        const idText = s.idValue.trim() ? `${s.idLabel ? `${T(s.idLabel)} ` : ""}${T(s.idValue)}` : "";
        const idLines = idText ? wrapRuns(mc, idText, fs, blockW, 0) : [];
        const hasHead = T(s.heading).trim() ? heading.length : 0;
        const hasRole = T(s.role).trim() ? role.length : 0;
        const h = dateH + (hasHead + hasRole) * lh + gapH + nameLines.length * lh + idLines.length * lh;
        return { s, i, heading: T(s.heading).trim() ? heading : [], role: T(s.role).trim() ? role : [], nameLines, idLines, h };
      });
      const sigH = Math.max(...cells.map((c) => c.h));
      // dua baris terakhir paragraf penutup selalu ikut halaman tanda tangan
      for (let k = items.length - 1, cnt = 0; k >= 0 && cnt < 2; k--) { items[k].keepNext = true; if (!items[k].soft) cnt++; }
      items.push({ h: paraGap * 1.2, soft: true, keepNext: true });
      items.push({
        h: sigH,
        draw: (c, x, y) => {
          cells.forEach((cell, ci) => {
            const cx = x + xs[Math.min(ci, xs.length - 1)];
            let yy = y;
            if (dateH && ci === rightmost) drawLine(c, wrapRuns(mc, dateLine, fs, blockW, 0)[0], cx, yy, blockW, "center", fs, color);
            yy += dateH;
            [...cell.heading, ...cell.role].forEach((ln) => { drawLine(c, ln, cx, yy, blockW, "center", fs, color); yy += lh; });
            // area tanda tangan
            const gx = cx, gy = yy, gw = blockW, gh = gapH;
            if (doc.materai && ci === rightmost) {
              const mw = 21 * ppm, mh = 15 * ppm;
              c.save();
              c.strokeStyle = rgba(color, 0.4); c.lineWidth = Math.max(1, ppm * 0.25); c.setLineDash([ppm * 1.2, ppm * 0.9]);
              c.strokeRect(gx + gw / 2 - mw / 2 - 3 * ppm, gy + (gh - mh) / 2, mw, mh);
              c.setLineDash([]); c.fillStyle = rgba(color, 0.4); c.font = font(fs * 0.62, { b: true }); c.textAlign = "center"; c.textBaseline = "middle";
              c.fillText("MATERAI", gx + gw / 2 - 3 * ppm, gy + gh / 2 - fs * 0.35);
              c.fillText("Rp10.000", gx + gw / 2 - 3 * ppm, gy + gh / 2 + fs * 0.4);
              c.restore();
            }
            if (cell.s.showStamp && assets.stamp) {
              const sz = Math.min(gh * 1.25, 30 * ppm);
              c.save(); c.globalAlpha = 0.88;
              c.drawImage(assets.stamp, gx + gw / 2 - sz * 0.95, gy + gh / 2 - sz / 2, sz, sz * ((assets.stamp.naturalHeight || 1) / (assets.stamp.naturalWidth || 1)));
              c.restore();
            }
            const sig = assets.sigs[cell.s.id];
            if (cell.s.qr) {
              const payload = `Ditandatangani secara elektronik oleh ${T(cell.s.name)}${T(cell.s.role) ? ` (${T(cell.s.role)})` : ""} — ${vars.nomor ? `No. ${vars.nomor} — ` : ""}${vars.tanggal}`;
              const m = buildQrMatrix(payload, "M");
              if (m) {
                const side = Math.min(gh, 24 * ppm);
                const qx = gx + (gw - side) / 2, qy = gy + (gh - side) / 2, cell2 = side / m.length;
                c.fillStyle = "#ffffff"; c.fillRect(qx - ppm, qy - ppm, side + ppm * 2, side + ppm * 2);
                c.fillStyle = "#111827";
                for (let r = 0; r < m.length; r++) for (let k = 0; k < m.length; k++) if (m[r][k]) c.fillRect(Math.floor(qx + k * cell2), Math.floor(qy + r * cell2), Math.ceil(cell2) + 0.5, Math.ceil(cell2) + 0.5);
              }
            } else if (sig) {
              const boxW = gw * 0.7, boxH = gh * 1.05;
              const sc = Math.min(boxW / (sig.naturalWidth || 1), boxH / (sig.naturalHeight || 1));
              const w2 = (sig.naturalWidth || 1) * sc, h2 = (sig.naturalHeight || 1) * sc;
              c.drawImage(sig, gx + (gw - w2) / 2 + (doc.materai && ci === rightmost ? 3 * ppm : 0), gy + (gh - h2) / 2, w2, h2);
            }
            yy += gh;
            cell.nameLines.forEach((ln) => { drawLine(c, ln, cx, yy, blockW, "center", fs, color); yy += lh; });
            cell.idLines.forEach((ln) => { drawLine(c, ln, cx, yy, blockW, "center", fs, color); yy += lh; });
          });
        },
      });
    }
  }

  // ── tembusan ──
  const tembusan = blockLines(T(doc.tembusan));
  if (tembusan.length) {
    gap(paraGap * 1.6);
    const ts = fs * 0.92;
    items.push({ h: lh * 0.92, keepNext: true, draw: (c, x, y) => { c.font = font(ts, { b: false }); c.fillStyle = color; c.textBaseline = "top"; c.textAlign = "left"; c.fillText("Tembusan:", x, y + (lh * 0.92 - ts) / 2); } });
    tembusan.forEach((l, i) => {
      const wrapped = wrapRuns(mc, l, ts, contentW - 8 * ppm, 0);
      wrapped.forEach((ln, li) => items.push({
        h: lh * 0.92,
        keepNext: i < tembusan.length - 1 || li < wrapped.length - 1,
        draw: (c, x, y, w) => {
          if (li === 0) { c.font = font(ts); c.fillStyle = color; c.textBaseline = "top"; c.textAlign = "left"; c.fillText(`${i + 1}.`, x, y + (lh * 0.92 - ts) / 2); }
          drawLine(c, ln, x + 7 * ppm, y, w - 7 * ppm, "left", ts, color);
        },
      }));
    });
  }

  // ── halaman lampiran ──
  if (doc.lampiranPage) {
    items.push({ h: 0, breakBefore: true });
    const t = T(doc.lampiranTitle).trim() || "LAMPIRAN";
    items.push(...textItems(`__${t}__`, { size: fs * 1.15, bold: true, align: "center", keepAll: true }).map((it) => ({ ...it, keepNext: true })));
    gap(paraGap * 1.2);
    const paras = T(doc.lampiranText).split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
    paras.forEach((p) => { items.push(...textItems(p, { align: doc.align })); gap(paraGap); });
  }

  // ── paginasi ──
  const topFor = (pg: number) =>
    mT + (pg === 0 ? (kop.h ? kop.h + kopGap : 0) : doc.kopEnabled && doc.kopAllPages ? kop.h + kopGap : doc.contHeader ? contH + 3 * ppm : 0);
  const bottomY = PH - mB;
  interface Placed { it: Item; y: number }
  const pagesItems: Placed[][] = [[]];
  let pg = 0;
  let y = topFor(0);
  const atTop = () => y <= topFor(pg) + 0.5;
  const newPage = () => { pagesItems.push([]); pg++; y = topFor(pg); };
  let idx = 0;
  while (idx < items.length) {
    const it = items[idx];
    if (it.breakBefore) {
      if (pagesItems[pg].some((p) => !p.it.soft)) newPage();
      idx++;
      continue;
    }
    let end = idx;
    while (items[end].keepNext && end + 1 < items.length && !items[end + 1].breakBefore) end++;
    const chain = items.slice(idx, end + 1);
    let chainH = chain.reduce((a, c) => a + c.h, 0);
    if (atTop()) { for (const c of chain) { if (!c.soft) break; chainH -= c.h; } }
    // rantai yang tidak muat di sisa halaman tapi muat di halaman baru → pindah utuh
    if (!atTop() && y + chainH > bottomY && chainH <= bottomY - topFor(1)) newPage();
    for (const c of chain) {
      if (c.soft) { if (!atTop()) y += c.h; continue; }
      if (y + c.h > bottomY && !atTop()) newPage();
      pagesItems[pg].push({ it: c, y });
      y += c.h;
    }
    idx = end + 1;
  }
  // buang halaman akhir yang kosong (kecuali satu-satunya)
  while (pagesItems.length > 1 && !pagesItems[pagesItems.length - 1].some((p) => p.it.draw)) pagesItems.pop();

  // ── menggambar halaman ──
  const total = pagesItems.length;
  const pages: HTMLCanvasElement[] = pagesItems.map((placed, p) => {
    const cv = document.createElement("canvas");
    cv.width = PW; cv.height = PH;
    const c = cv.getContext("2d")!;
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, PW, PH);

    if (doc.frame !== "none") {
      c.save();
      c.strokeStyle = doc.frameColor;
      const ins = doc.frameInset * ppm;
      c.lineWidth = 0.6 * ppm;
      c.strokeRect(ins, ins, PW - ins * 2, PH - ins * 2);
      if (doc.frame === "double") { c.lineWidth = 0.25 * ppm; c.strokeRect(ins + 1.5 * ppm, ins + 1.5 * ppm, PW - (ins + 1.5 * ppm) * 2, PH - (ins + 1.5 * ppm) * 2); }
      c.restore();
    }

    const wm = T(doc.watermarkText).trim();
    if (wm || (doc.watermarkLogo && assets.logo)) {
      c.save();
      c.globalAlpha = Math.min(1, Math.max(0, doc.watermarkOpacity));
      c.translate(PW / 2, PH / 2);
      if (doc.watermarkLogo && assets.logo) {
        const side = Math.min(PW, PH) * 0.55;
        const ar = (assets.logo.naturalWidth || 1) / (assets.logo.naturalHeight || 1);
        const w2 = ar >= 1 ? side : side * ar, h2 = ar >= 1 ? side / ar : side;
        c.drawImage(assets.logo, -w2 / 2, -h2 / 2, w2, h2);
      }
      if (wm) {
        c.rotate(-Math.PI / 6);
        let size = Math.min(PW, PH) * 0.14;
        c.font = font(size, { b: true, head: true });
        const tw = c.measureText(wm.toUpperCase()).width;
        if (tw > PW * 0.78) { size *= (PW * 0.78) / tw; c.font = font(size, { b: true, head: true }); }
        c.fillStyle = doc.watermarkColor; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText(wm.toUpperCase(), 0, 0);
      }
      c.restore();
    }

    if (doc.kopEnabled && (p === 0 || doc.kopAllPages)) kop.draw(c, mT);
    else if (p > 0 && doc.contHeader) {
      const label = T(doc.perihal).trim() || "Lanjutan surat";
      c.save();
      c.font = font(fs * 0.82); c.fillStyle = muted; c.textBaseline = "top"; c.textAlign = "left";
      let l = label;
      while (l.length > 3 && c.measureText(l).width > contentW * 0.7) l = l.slice(0, -1);
      c.fillText(l === label ? l : `${l}…`, mL, mT);
      c.textAlign = "right";
      if (vars.nomor) c.fillText(`No. ${vars.nomor}`, mL + contentW, mT);
      c.fillStyle = rgba(color, 0.25);
      c.fillRect(mL, mT + fs * 1.35, contentW, Math.max(1, ppm * 0.2));
      c.restore();
    }

    for (const { it, y: py } of placed) it.draw?.(c, mL, py, contentW);

    // kaki
    const footY = PH - Math.min(mB * 0.6, 14 * ppm);
    const fsz = fs * 0.78;
    c.save();
    c.font = font(fsz); c.fillStyle = muted; c.textBaseline = "top";
    const ft = T(doc.footerText).trim();
    if (ft) { c.textAlign = "left"; c.fillText(ft, mL, footY); }
    if (doc.pageNum !== "none") {
      const label = doc.pageNumFormat.replace(/\{n\}/g, String(p + 1)).replace(/\{total\}/g, String(total));
      c.textAlign = doc.pageNum === "center" ? "center" : "right";
      c.fillText(label, doc.pageNum === "center" ? PW / 2 : mL + contentW, footY);
    }
    c.restore();
    void roundRect;
    return cv;
  });

  return { pages };
}

export type { Signer };
