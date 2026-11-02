// Render .docx → halaman gambar. Mendukung: gaya paragraf & karakter (termasuk pewarisan gaya), judul, rata teks,
// indentasi, jarak, daftar bullet/nomor, tabel (lebar kolom, gabung kolom, warna sel, garis), gambar sebaris,
// tab, page-break. Tidak didukung (dilaporkan ke pengguna): header/footer, kotak teks, grafik/SmartArt, kolom, nomor halaman.

import JSZip from "jszip";
import {
  EMU_PT, TWIP_PT, attr, child, childEls, cssFamily, defaultParaFmt, defaultStyle, descendants, emitLine, hexColor,
  layoutParagraph, loadImageFromBytes, mimeForExt, paraHeight, parseXml,
  type Img, type Inline, type Op, type ParaFmt, type ParaLayout, type RasterDoc, type RasterPage, type RunStyle,
} from "./core";

interface PProps {
  jc?: string; before?: number; after?: number; line?: number; lineRule?: string; left?: number; right?: number;
  firstLine?: number; hanging?: number; pageBreakBefore?: boolean; numId?: string; ilvl?: number; shade?: string;
  borderBottom?: { color: string; width: number }; keepLines?: boolean; contextual?: boolean;
}
interface RProps {
  b?: boolean; i?: boolean; u?: boolean; strike?: boolean; sz?: number; color?: string; font?: string; highlight?: string;
  sup?: boolean; sub?: boolean; caps?: boolean;
}
interface StyleDef { id: string; type: string; basedOn?: string; isDefault?: boolean; p: PProps; r: RProps; tblBorders?: Element | null }

const HILITE: Record<string, string> = {
  yellow: "#ffff00", green: "#00ff00", cyan: "#00ffff", magenta: "#ff00ff", blue: "#0000ff", red: "#ff0000", darkBlue: "#000080",
  darkCyan: "#008080", darkGreen: "#008000", darkMagenta: "#800080", darkRed: "#800000", darkYellow: "#808000", darkGray: "#808080",
  lightGray: "#c0c0c0", black: "#000000", white: "#ffffff",
};

const onOff = (el: Element | null): boolean | undefined => {
  if (!el) return undefined;
  const v = attr(el, "val");
  return !(v === "0" || v === "false" || v === "off" || v === "none");
};
const num = (v: string | null): number | undefined => (v === null || v === "" || isNaN(Number(v)) ? undefined : Number(v));

function readPPr(pPr: Element | null): PProps {
  const o: PProps = {};
  if (!pPr) return o;
  const jc = attr(child(pPr, "jc"), "val");
  if (jc) o.jc = jc;
  const sp = child(pPr, "spacing");
  if (sp) {
    o.before = num(attr(sp, "before"));
    o.after = num(attr(sp, "after"));
    o.line = num(attr(sp, "line"));
    o.lineRule = attr(sp, "lineRule") ?? undefined;
  }
  const ind = child(pPr, "ind");
  if (ind) {
    o.left = num(attr(ind, "left") ?? attr(ind, "start"));
    o.right = num(attr(ind, "right") ?? attr(ind, "end"));
    o.firstLine = num(attr(ind, "firstLine"));
    o.hanging = num(attr(ind, "hanging"));
  }
  if (child(pPr, "pageBreakBefore")) o.pageBreakBefore = onOff(child(pPr, "pageBreakBefore"));
  if (child(pPr, "keepLines")) o.keepLines = onOff(child(pPr, "keepLines"));
  if (child(pPr, "contextualSpacing")) o.contextual = onOff(child(pPr, "contextualSpacing"));
  const numPr = child(pPr, "numPr");
  if (numPr) {
    const id = attr(child(numPr, "numId"), "val");
    if (id !== null) o.numId = id;
    const il = num(attr(child(numPr, "ilvl"), "val"));
    if (il !== undefined) o.ilvl = il;
  }
  const shd = child(pPr, "shd");
  const fill = attr(shd, "fill");
  if (fill && fill !== "auto") o.shade = hexColor(fill, "");
  const bdr = child(pPr, "pBdr");
  const bb = child(bdr, "bottom");
  if (bb && attr(bb, "val") !== "nil" && attr(bb, "val") !== "none") {
    const c = attr(bb, "color");
    o.borderBottom = { color: c && c !== "auto" ? hexColor(c, "#000000") : "#000000", width: Math.max(0.5, (num(attr(bb, "sz")) ?? 4) / 8) };
  }
  return o;
}

function readRPr(rPr: Element | null): RProps {
  const o: RProps = {};
  if (!rPr) return o;
  if (child(rPr, "b")) o.b = onOff(child(rPr, "b"));
  if (child(rPr, "i")) o.i = onOff(child(rPr, "i"));
  const u = child(rPr, "u");
  if (u) o.u = attr(u, "val") !== "none";
  if (child(rPr, "strike")) o.strike = onOff(child(rPr, "strike"));
  if (child(rPr, "caps") || child(rPr, "smallCaps")) o.caps = true;
  const sz = num(attr(child(rPr, "sz"), "val"));
  if (sz !== undefined) o.sz = sz / 2;
  const col = attr(child(rPr, "color"), "val");
  if (col && col !== "auto") o.color = hexColor(col, "#000000");
  const rf = child(rPr, "rFonts");
  if (rf) o.font = attr(rf, "ascii") ?? attr(rf, "hAnsi") ?? attr(rf, "asciiTheme") ?? undefined;
  const hl = attr(child(rPr, "highlight"), "val");
  if (hl && HILITE[hl]) o.highlight = HILITE[hl];
  const shd = attr(child(rPr, "shd"), "fill");
  if (!o.highlight && shd && shd !== "auto") o.highlight = hexColor(shd, "");
  const va = attr(child(rPr, "vertAlign"), "val");
  if (va === "superscript") o.sup = true;
  if (va === "subscript") o.sub = true;
  return o;
}

const merge = <T extends object>(base: T, over: T): T => {
  const out: any = { ...base };
  for (const [k, v] of Object.entries(over)) if (v !== undefined) out[k] = v;
  return out;
};

interface NumLevel { fmt: string; text: string; start: number; left?: number; hanging?: number }
function toRoman(n: number): string {
  const m: [number, string][] = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let r = "";
  for (const [v, s] of m) while (n >= v) { r += s; n -= v; }
  return r;
}
function fmtNum(n: number, fmt: string): string {
  switch (fmt) {
    case "decimal": return String(n);
    case "decimalZero": return String(n).padStart(2, "0");
    case "lowerLetter": return String.fromCharCode(96 + (((n - 1) % 26) + 1));
    case "upperLetter": return String.fromCharCode(64 + (((n - 1) % 26) + 1));
    case "lowerRoman": return toRoman(n);
    case "upperRoman": return toRoman(n).toUpperCase();
    default: return String(n);
  }
}
function bulletGlyph(t: string, level: number): string {
  if (!t) return "•";
  const c = t.charCodeAt(0);
  if (c >= 0xf000 || t === "o" || t === "§" || t === "ü" || t === "Ø") return level % 3 === 0 ? "•" : level % 3 === 1 ? "◦" : "▪";
  return t;
}

export async function renderDocx(file: File): Promise<RasterDoc> {
  const zip = await JSZip.loadAsync(file);
  const docXml = await zip.file("word/document.xml")?.async("text");
  if (!docXml) throw new Error("Bukan file .docx yang valid (word/document.xml tidak ditemukan).");
  const notes: string[] = [];
  const doc = parseXml(docXml);
  const body = descendants(doc, "body")[0];
  if (!body) throw new Error("Isi dokumen tidak ditemukan.");

  // ── tema (font & warna) ──
  let majorFont = "Calibri Light", minorFont = "Calibri";
  const themeXml = await zip.file("word/theme/theme1.xml")?.async("text");
  if (themeXml) {
    const th = parseXml(themeXml);
    const mj = descendants(th, "majorFont")[0], mn = descendants(th, "minorFont")[0];
    majorFont = attr(child(mj, "latin"), "typeface") || majorFont;
    minorFont = attr(child(mn, "latin"), "typeface") || minorFont;
  }
  const fontName = (n?: string) => (n === "majorHAnsi" || n === "majorAscii" ? majorFont : n === "minorHAnsi" || n === "minorAscii" ? minorFont : n || minorFont);

  // ── gaya ──
  const styles = new Map<string, StyleDef>();
  let docDefaultsP: PProps = {}, docDefaultsR: RProps = {};
  let defaultParaStyle = "";
  const stXml = await zip.file("word/styles.xml")?.async("text");
  if (stXml) {
    const st = parseXml(stXml);
    const dd = descendants(st, "docDefaults")[0];
    docDefaultsP = readPPr(child(child(dd, "pPrDefault"), "pPr"));
    docDefaultsR = readRPr(child(child(dd, "rPrDefault"), "rPr"));
    for (const s of descendants(st, "style")) {
      const id = attr(s, "styleId");
      if (!id) continue;
      const def: StyleDef = {
        id, type: attr(s, "type") || "paragraph", basedOn: attr(child(s, "basedOn"), "val") ?? undefined,
        isDefault: attr(s, "default") === "1" || attr(s, "default") === "true",
        p: readPPr(child(s, "pPr")), r: readRPr(child(s, "rPr")),
        tblBorders: child(child(s, "tblPr"), "tblBorders"),
      };
      styles.set(id, def);
      if (def.type === "paragraph" && def.isDefault) defaultParaStyle = id;
    }
  }
  const resolveP = (id: string | undefined, depth = 0): { p: PProps; r: RProps } => {
    if (!id || depth > 12) return { p: {}, r: {} };
    const s = styles.get(id);
    if (!s) return { p: {}, r: {} };
    const base = resolveP(s.basedOn, depth + 1);
    return { p: merge(base.p, s.p), r: merge(base.r, s.r) };
  };
  const resolveTblBorders = (id: string | undefined, depth = 0): Element | null => {
    if (!id || depth > 8) return null;
    const s = styles.get(id);
    if (!s) return null;
    return s.tblBorders ?? resolveTblBorders(s.basedOn, depth + 1);
  };

  // ── penomoran ──
  const nums = new Map<string, string>(); // numId → abstractNumId
  const abs = new Map<string, Map<number, NumLevel>>();
  const numXml = await zip.file("word/numbering.xml")?.async("text");
  if (numXml) {
    const nx = parseXml(numXml);
    for (const a of descendants(nx, "abstractNum")) {
      const id = attr(a, "abstractNumId");
      if (id === null) continue;
      const lv = new Map<number, NumLevel>();
      for (const l of childEls(a, "lvl")) {
        const il = num(attr(l, "ilvl")) ?? 0;
        const ind = child(child(l, "pPr"), "ind");
        lv.set(il, {
          fmt: attr(child(l, "numFmt"), "val") || "decimal",
          text: attr(child(l, "lvlText"), "val") ?? "",
          start: num(attr(child(l, "start"), "val")) ?? 1,
          left: num(attr(ind, "left") ?? attr(ind, "start")),
          hanging: num(attr(ind, "hanging")),
        });
      }
      abs.set(id, lv);
    }
    for (const n of descendants(nx, "num")) {
      const id = attr(n, "numId");
      const a = attr(child(n, "abstractNumId"), "val");
      if (id !== null && a !== null) nums.set(id, a);
    }
  }
  const counters = new Map<string, number[]>();

  // ── relasi & gambar ──
  const rels = new Map<string, string>();
  const relXml = await zip.file("word/_rels/document.xml.rels")?.async("text");
  if (relXml) for (const r of descendants(parseXml(relXml), "Relationship")) rels.set(r.getAttribute("Id") || "", r.getAttribute("Target") || "");
  const images = new Map<string, Img | null>();
  const blips = Array.from(new Set(descendants(body, "blip").map((b) => attr(b, "embed")).filter((x): x is string => !!x)));
  for (const id of blips) {
    const target = rels.get(id);
    if (!target) { images.set(id, null); continue; }
    const path = target.startsWith("/") ? target.slice(1) : `word/${target.replace(/^\.\//, "")}`;
    const f = zip.file(path);
    const bytes = f ? await f.async("uint8array") : null;
    images.set(id, bytes ? await loadImageFromBytes(bytes, mimeForExt(path)) : null);
  }
  let skippedImages = 0;

  // ── halaman ──
  const sect = Array.from(body.children).filter((c) => c.localName === "sectPr").pop() ?? descendants(body, "sectPr").pop() ?? null;
  const pgSz = child(sect, "pgSz");
  const pgMar = child(sect, "pgMar");
  let PW = (num(attr(pgSz, "w")) ?? 11906) * TWIP_PT;
  let PH = (num(attr(pgSz, "h")) ?? 16838) * TWIP_PT;
  if (attr(pgSz, "orient") === "landscape" && PW < PH) [PW, PH] = [PH, PW];
  const mTop = (num(attr(pgMar, "top")) ?? 1440) * TWIP_PT;
  const mBottom = (num(attr(pgMar, "bottom")) ?? 1440) * TWIP_PT;
  const mLeft = (num(attr(pgMar, "left")) ?? 1440) * TWIP_PT;
  const mRight = (num(attr(pgMar, "right")) ?? 1440) * TWIP_PT;
  const contentW = Math.max(100, PW - mLeft - mRight);

  // ── paragraf → ParaLayout ──
  const baseP = merge(docDefaultsP, resolveP(defaultParaStyle).p);

  function runStyleFor(pRun: RProps, direct: RProps, charStyle?: string): RunStyle {
    const cs = charStyle ? resolveP(charStyle).r : {};
    const eff = merge(merge(merge(docDefaultsR, pRun), cs), direct);
    return defaultStyle({
      size: eff.sz ?? 11, bold: !!eff.b, italic: !!eff.i, underline: !!eff.u, strike: !!eff.strike,
      color: eff.color ?? "#000000", font: cssFamily(fontName(eff.font)), highlight: eff.highlight, sup: eff.sup, sub: eff.sub,
    });
  }

  function collectInlines(container: Element, pRun: RProps, out: Inline[]) {
    for (const c of Array.from(container.children)) {
      const ln = c.localName;
      if (ln === "r") {
        const rPr = child(c, "rPr");
        const direct = readRPr(rPr);
        const cstyle = attr(child(rPr, "rStyle"), "val") ?? undefined;
        const style = runStyleFor(pRun, direct, cstyle);
        const caps = merge(merge(docDefaultsR, pRun), direct).caps;
        for (const rc of Array.from(c.children)) emitRunChild(rc, style, !!caps, out);
      } else if (["hyperlink", "ins", "smartTag", "sdt", "sdtContent", "fldSimple", "customXml", "bdo", "dir"].includes(ln)) {
        collectInlines(c, pRun, out);
      }
    }
  }

  function emitRunChild(rc: Element, style: RunStyle, caps: boolean, out: Inline[]) {
    switch (rc.localName) {
      case "t": out.push({ kind: "text", text: caps ? (rc.textContent || "").toUpperCase() : rc.textContent || "", style }); break;
      case "tab": out.push({ kind: "tab", style }); break;
      case "br": out.push(attr(rc, "type") === "page" ? { kind: "pagebreak" } : { kind: "br" }); break;
      case "cr": out.push({ kind: "br" }); break;
      case "noBreakHyphen": out.push({ kind: "text", text: "-", style }); break;
      case "drawing": {
        const anchor = child(rc, "anchor");
        if (anchor && (attr(anchor, "behindDoc") === "1" || attr(anchor, "behindDoc") === "true")) { skippedImages++; break; }
        const ext = descendants(rc, "extent")[0];
        const id = attr(descendants(rc, "blip")[0] ?? null, "embed");
        const img = id ? images.get(id) : null;
        if (!img || !ext) { if (descendants(rc, "txbx").length || descendants(rc, "chart").length) notes.push("Kotak teks/grafik di dalam dokumen tidak ikut dirender."); else skippedImages++; break; }
        let w = (num(attr(ext, "cx")) ?? 0) * EMU_PT, h = (num(attr(ext, "cy")) ?? 0) * EMU_PT;
        if (w > contentW) { h = (h * contentW) / w; w = contentW; }
        if (w > 1 && h > 1) out.push({ kind: "img", img, w, h });
        break;
      }
      case "AlternateContent": {
        const choice = child(rc, "Choice");
        if (choice) for (const cc of Array.from(choice.children)) emitRunChild(cc, style, caps, out);
        break;
      }
    }
  }

  function buildParagraph(p: Element, width: number, tblP?: PProps): { layout: ParaLayout; pageBreakBefore: boolean; styleId: string; contextual: boolean } {
    const pPr = child(p, "pPr");
    const direct = readPPr(pPr);
    const styleId = attr(child(pPr, "pStyle"), "val") ?? defaultParaStyle;
    const rs = resolveP(styleId);
    // Gaya tabel (mis. "Table Grid": jarak 0) menimpa gaya Normal/bawaan dokumen di dalam sel.
    let eff: PProps = merge(merge(tblP ? merge(baseP, tblP) : baseP, styleId === defaultParaStyle ? {} : rs.p), direct);
    // gaya paragraf ikut membawa penomoran (mis. "ListParagraph")
    const numId = direct.numId ?? rs.p.numId;
    const ilvl = direct.ilvl ?? rs.p.ilvl ?? 0;

    let bullet: ParaFmt["bullet"] | undefined;
    if (numId && numId !== "0") {
      const lv = abs.get(nums.get(numId) ?? "")?.get(ilvl);
      if (lv) {
        const hasDirectInd = direct.left !== undefined || direct.hanging !== undefined;
        if (!hasDirectInd) eff = { ...eff, left: lv.left ?? eff.left, hanging: lv.hanging ?? eff.hanging, firstLine: undefined };
        const arr = counters.get(numId) ?? [];
        while (arr.length <= ilvl) arr.push(0);
        arr[ilvl] = (arr[ilvl] || lv.start - 1) + 1;
        if (arr[ilvl] < lv.start) arr[ilvl] = lv.start;
        for (let k = ilvl + 1; k < arr.length; k++) arr[k] = 0;
        counters.set(numId, arr);
        let label: string;
        if (lv.fmt === "bullet" || lv.fmt === "none") label = lv.fmt === "none" ? "" : bulletGlyph(lv.text, ilvl);
        else {
          label = lv.text || `%${ilvl + 1}.`;
          for (let k = 0; k <= 8; k++) {
            const levelFmt = abs.get(nums.get(numId) ?? "")?.get(k)?.fmt ?? "decimal";
            label = label.replace(`%${k + 1}`, arr[k] ? fmtNum(arr[k], levelFmt) : "");
          }
        }
        if (label) bullet = { text: label, style: runStyleFor(rs.r, {}) };
      }
    }

    const fmt = defaultParaFmt({
      align: eff.jc === "center" ? "center" : eff.jc === "right" || eff.jc === "end" ? "right" : eff.jc === "both" || eff.jc === "distribute" ? "justify" : "left",
      indentLeft: (eff.left ?? 0) * TWIP_PT,
      indentRight: (eff.right ?? 0) * TWIP_PT,
      firstLine: eff.hanging ? -eff.hanging * TWIP_PT : (eff.firstLine ?? 0) * TWIP_PT,
      spaceBefore: (eff.before ?? 0) * TWIP_PT,
      spaceAfter: (eff.after ?? 0) * TWIP_PT,
      lineMult: eff.line && (!eff.lineRule || eff.lineRule === "auto") ? eff.line / 240 : 1,
      lineExact: eff.line && eff.lineRule === "exact" ? eff.line * TWIP_PT : undefined,
      lineAtLeast: eff.line && eff.lineRule === "atLeast" ? eff.line * TWIP_PT : undefined,
      bullet,
      shade: eff.shade,
      bottomRule: eff.borderBottom,
      keepLinesTogether: eff.keepLines,
    });
    // Hanging indent: dengan bullet → bullet mundur sebesar hanging dan teks tetap di indentLeft;
    // tanpa bullet → baris pertama saja yang mundur.
    const hangPt = (eff.hanging ?? 0) * TWIP_PT;
    if (bullet) {
      (fmt as any)._bulletX = hangPt ? -hangPt : Math.max(0, (eff.firstLine ?? 0) * TWIP_PT);
      fmt.firstLine = 0;
    } else if (hangPt) {
      fmt.firstLine = 0;
      (fmt as any)._hanging = -hangPt;
    }
    const inl: Inline[] = [];
    collectInlines(p, rs.r, inl);
    const layout = layoutParagraph(inl, fmt, width);
    return { layout, pageBreakBefore: !!eff.pageBreakBefore, styleId, contextual: !!eff.contextual };
  }

  // ── tabel ──
  interface RowBox { h: number; draw: (ops: Op[], x: number, y: number) => void }
  type Block = { kind: "para"; layout: ParaLayout; pageBreakBefore: boolean; styleId?: string; contextual?: boolean } | { kind: "table"; rows: RowBox[]; width: number };

  const borderOf = (b: Element | null, fallback?: Element | null): { color: string; w: number } | null => {
    const el = b ?? fallback ?? null;
    if (!el) return null;
    const v = attr(el, "val");
    if (!v || v === "nil" || v === "none") return null;
    const c = attr(el, "color");
    return { color: c && c !== "auto" ? hexColor(c, "#000000") : "#000000", w: Math.max(0.4, (num(attr(el, "sz")) ?? 4) / 8) };
  };

  function buildTable(tbl: Element, width: number): Block {
    const tblPr = child(tbl, "tblPr");
    const tblStyleId = attr(child(tblPr, "tblStyle"), "val") ?? undefined;
    const tblP = resolveP(tblStyleId).p;
    const styleBorders = resolveTblBorders(tblStyleId);
    const tblBorders = child(tblPr, "tblBorders") ?? styleBorders;
    const grid = childEls(child(tbl, "tblGrid"), "gridCol").map((g) => (num(attr(g, "w")) ?? 1000) * TWIP_PT);
    let gridW = grid.reduce((a, b) => a + b, 0) || width;
    const factor = gridW > width ? width / gridW : 1;
    const cols = grid.length ? grid.map((g) => g * factor) : [width];
    gridW = cols.reduce((a, b) => a + b, 0);
    const indent = ((num(attr(child(tblPr, "tblInd"), "w")) ?? 0) * TWIP_PT) as number;
    const mar = child(tblPr, "tblCellMar");
    const padL = (num(attr(child(mar, "left") ?? child(mar, "start"), "w")) ?? 108) * TWIP_PT;
    const padR = (num(attr(child(mar, "right") ?? child(mar, "end"), "w")) ?? 108) * TWIP_PT;
    const padT = (num(attr(child(mar, "top"), "w")) ?? 0) * TWIP_PT;
    const padB = (num(attr(child(mar, "bottom"), "w")) ?? 0) * TWIP_PT;

    const rows: RowBox[] = [];
    const trs = childEls(tbl, "tr");
    trs.forEach((tr, ri) => {
      const cells: { x: number; w: number; blocks: Block[]; h: number; fill?: string; borders: Record<string, { color: string; w: number } | null> }[] = [];
      let col = 0;
      for (const tc of childEls(tr, "tc")) {
        const tcPr = child(tc, "tcPr");
        const span = num(attr(child(tcPr, "gridSpan"), "val")) ?? 1;
        const cw = cols.slice(col, col + span).reduce((a, b) => a + b, 0) || cols[Math.min(col, cols.length - 1)] || 50;
        const x = cols.slice(0, col).reduce((a, b) => a + b, 0);
        const vm = child(tcPr, "vMerge");
        const fillAttr = attr(child(tcPr, "shd"), "fill");
        const tcb = child(tcPr, "tcBorders");
        const first = ri === 0, last = ri === trs.length - 1, isFirstCol = col === 0, isLastCol = col + span >= cols.length;
        const borders = {
          top: borderOf(child(tcb, "top"), first ? child(tblBorders, "top") : child(tblBorders, "insideH")),
          bottom: borderOf(child(tcb, "bottom"), last ? child(tblBorders, "bottom") : child(tblBorders, "insideH")),
          left: borderOf(child(tcb, "left") ?? child(tcb, "start"), isFirstCol ? child(tblBorders, "left") ?? child(tblBorders, "start") : child(tblBorders, "insideV")),
          right: borderOf(child(tcb, "right") ?? child(tcb, "end"), isLastCol ? child(tblBorders, "right") ?? child(tblBorders, "end") : child(tblBorders, "insideV")),
        };
        const blocks = vm && !attr(vm, "val") ? [] : buildBlocks(tc, cw - padL - padR, tblP);
        const h = blocks.reduce((a, b) => a + blockHeight(b), 0) + padT + padB;
        cells.push({ x, w: cw, blocks, h, fill: fillAttr && fillAttr !== "auto" ? hexColor(fillAttr, "") : undefined, borders });
        col += span;
      }
      const trH = (num(attr(child(child(tr, "trPr"), "trHeight"), "val")) ?? 0) * TWIP_PT;
      const rowH = Math.max(trH, ...cells.map((c) => c.h), 12);
      rows.push({
        h: rowH,
        draw: (ops, x, y) => {
          for (const c of cells) {
            if (c.fill) ops.push({ t: "rect", x: x + indent + c.x, y, w: c.w, h: rowH, fill: c.fill });
            let cy = y + padT;
            for (const b of c.blocks) {
              drawBlock(ops, b, x + indent + c.x + padL, cy, c.w - padL - padR);
              cy += blockHeight(b);
            }
            const L = x + indent + c.x, R = L + c.w;
            const e = c.borders;
            if (e.top) ops.push({ t: "line", x1: L, y1: y, x2: R, y2: y, color: e.top.color, lw: e.top.w });
            if (e.bottom) ops.push({ t: "line", x1: L, y1: y + rowH, x2: R, y2: y + rowH, color: e.bottom.color, lw: e.bottom.w });
            if (e.left) ops.push({ t: "line", x1: L, y1: y, x2: L, y2: y + rowH, color: e.left.color, lw: e.left.w });
            if (e.right) ops.push({ t: "line", x1: R, y1: y, x2: R, y2: y + rowH, color: e.right.color, lw: e.right.w });
          }
        },
      });
    });
    return { kind: "table", rows, width: gridW };
  }

  function blockHeight(b: Block): number {
    return b.kind === "para" ? paraHeight(b.layout) : b.rows.reduce((a, r) => a + r.h, 0);
  }

  function drawPara(ops: Op[], layout: ParaLayout, x: number, y: number, width: number, withSpace = true) {
    const f = layout.fmt;
    let cy = y + (withSpace ? f.spaceBefore : 0);
    const h = paraHeight(layout, false);
    const left = x + f.indentLeft;
    if (f.shade) ops.push({ t: "rect", x: left, y: cy, w: width - f.indentLeft - f.indentRight, h, fill: f.shade });
    const hang = (f as any)._hanging as number | undefined;
    for (let i = 0; i < layout.lines.length; i++) {
      const ln = layout.lines[i];
      let lx = left;
      if (i === 0 && hang) lx = left + hang; // baris pertama mundur
      emitLine(ops, ln, i === 0 && hang ? lx : left, cy);
      cy += ln.h;
    }
    if (f.bottomRule) ops.push({ t: "line", x1: left, y1: cy + 1, x2: x + width - f.indentRight, y2: cy + 1, color: f.bottomRule.color, lw: f.bottomRule.width });
  }
  function drawBlock(ops: Op[], b: Block, x: number, y: number, width: number) {
    if (b.kind === "para") drawPara(ops, b.layout, x, y, width);
    else {
      let cy = y;
      for (const r of b.rows) {
        r.draw(ops, x, cy);
        cy += r.h;
      }
    }
  }

  function buildBlocks(container: Element, width: number, tblP?: PProps): Block[] {
    const out: Block[] = [];
    for (const c of Array.from(container.children)) {
      if (c.localName === "p") {
        const { layout, pageBreakBefore, styleId, contextual } = buildParagraph(c, width, tblP);
        out.push({ kind: "para", layout, pageBreakBefore, styleId, contextual });
      } else if (c.localName === "tbl") out.push(buildTable(c, width));
      else if (c.localName === "sdt") {
        const content = child(c, "sdtContent");
        if (content) out.push(...buildBlocks(content, width, tblP));
      }
    }
    // contextualSpacing: jarak antar paragraf BERGAYA SAMA ditiadakan (mis. item daftar)
    for (let i = 0; i < out.length; i++) {
      const b = out[i], nx = out[i + 1], pv = out[i - 1];
      if (b.kind !== "para" || !b.contextual) continue;
      if (nx && nx.kind === "para" && nx.styleId === b.styleId) b.layout.fmt.spaceAfter = 0;
      if (pv && pv.kind === "para" && pv.styleId === b.styleId) b.layout.fmt.spaceBefore = 0;
    }
    return out;
  }

  const blocks = buildBlocks(body, contentW);

  // ── penataan halaman ──
  const pages: RasterPage[] = [];
  let cur: RasterPage = { w: PW, h: PH, bg: "#ffffff", ops: [] };
  let y = mTop;
  const bottom = PH - mBottom;
  let autoBreak = false; // true bila halaman baru muncul karena meluap (Word menghapus "spasi sebelum" di sana)
  const newPage = (auto = false) => {
    pages.push(cur);
    cur = { w: PW, h: PH, bg: "#ffffff", ops: [] };
    y = mTop;
    autoBreak = auto;
  };

  for (const b of blocks) {
    if (b.kind === "para") {
      const L = b.layout;
      if (b.pageBreakBefore && y > mTop + 1) newPage();
      if (!(autoBreak && y <= mTop + 0.5)) y += L.fmt.spaceBefore;
      autoBreak = false;
      // satu paragraf pendek yang tidak muat → pindah utuh (hindari judul yatim)
      const total = paraHeight(L, false);
      if (L.fmt.keepLinesTogether && y + total > bottom && total < bottom - mTop) newPage(true);
      const startY = y;
      const left = mLeft + L.fmt.indentLeft;
      const hang = (L.fmt as any)._hanging as number | undefined;
      if (L.fmt.shade) cur.ops.push({ t: "rect", x: left, y: startY, w: contentW - L.fmt.indentLeft - L.fmt.indentRight, h: Math.min(total, bottom - startY), fill: L.fmt.shade });
      for (let i = 0; i < L.lines.length; i++) {
        const ln = L.lines[i];
        if (y + ln.h > bottom + 0.5 && y > mTop + 0.5) newPage(true);
        emitLine(cur.ops, ln, i === 0 && hang ? left + hang : left, y);
        y += ln.h;
        if (ln.hasPageBreak && i < L.lines.length - 1) newPage();
        else if (ln.hasPageBreak) { newPage(); }
      }
      if (L.fmt.bottomRule) cur.ops.push({ t: "line", x1: left, y1: y + 1, x2: mLeft + contentW - L.fmt.indentRight, y2: y + 1, color: L.fmt.bottomRule.color, lw: L.fmt.bottomRule.width });
      y += L.fmt.spaceAfter;
    } else {
      for (const r of b.rows) {
        if (y + r.h > bottom + 0.5 && y > mTop + 0.5) newPage(true);
        r.draw(cur.ops, mLeft, y);
        y += r.h;
      }
      y += 4;
    }
  }
  pages.push(cur);
  // buang halaman terakhir yang kosong akibat page-break di akhir
  while (pages.length > 1 && pages[pages.length - 1].ops.length === 0) pages.pop();

  if (descendants(doc, "txbxContent").length) notes.push("Kotak teks (text box) di dokumen tidak ikut dirender.");
  if (zip.file(/word\/(header|footer)\d*\.xml/).length) notes.push("Header, footer, dan nomor halaman tidak ikut dirender.");
  if (skippedImages) notes.push(`${skippedImages} gambar tidak bisa dirender (format EMF/WMF/latar) dan dilewati.`);
  if (descendants(body, "sectPr").length > 1 && descendants(body, "cols").some((c) => (num(attr(c, "num")) ?? 1) > 1)) notes.push("Tata letak multi-kolom ditampilkan sebagai satu kolom.");
  return { pages, notes: Array.from(new Set(notes)) };
}
