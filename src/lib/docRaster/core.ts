// Mesin render dokumen → kanvas (dipakai "Dokumen ke Gambar": Word, PowerPoint, Excel, teks/Markdown/RTF).
//
// Prinsip: setiap format di-parse menjadi daftar halaman berisi "operasi gambar" (Op) dalam satuan poin (1 pt = 1/72 inci).
// Rasterisasi dilakukan SESAAT sebelum ekspor pada skala pilihan pengguna (mis. 200 dpi = skala 200/72), sehingga teks
// dan garis selalu tajam di resolusi berapa pun (tidak ada pembesaran bitmap beresolusi rendah).

export type Img = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

export interface RunStyle {
  size: number; // pt
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color: string;
  font: string; // nama keluarga font CSS (sudah dipetakan)
  highlight?: string;
  sup?: boolean;
  sub?: boolean;
}

export type Op =
  | { t: "rect"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; r?: number }
  | { t: "ellipse"; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; color: string; lw: number; dash?: number[] }
  | { t: "text"; x: number; y: number; text: string; style: RunStyle; w: number }
  | { t: "img"; x: number; y: number; w: number; h: number; img: Img; sx?: number; sy?: number; sw?: number; sh?: number; flipH?: boolean; flipV?: boolean }
  | { t: "poly"; pts: [number, number][]; fill?: string; stroke?: string; lw?: number }
  | { t: "group"; rot: number; cx: number; cy: number; ops: Op[] }
  | { t: "clip"; x: number; y: number; w: number; h: number; ops: Op[] };

export interface RasterPage {
  w: number; // pt
  h: number;
  bg: string;
  ops: Op[];
}

export interface RasterDoc {
  pages: RasterPage[];
  /** Hal-hal yang tidak bisa dirender (grafik, SmartArt, header/footer, dst.) — ditampilkan ke pengguna secara jujur. */
  notes: string[];
}

// ── Font & warna ──────────────────────────────────────────────────────────

const FONT_MAP: [RegExp, string][] = [
  [/^(calibri|carlito)/i, "Calibri, Carlito, 'Segoe UI', Roboto, Arial, sans-serif"],
  [/^(cambria|caladea)/i, "Cambria, Caladea, Georgia, 'Times New Roman', serif"],
  [/^(times|liberation serif|tinos)/i, "'Times New Roman', 'Liberation Serif', Tinos, Times, serif"],
  [/^(arial|helvetica|liberation sans|arimo)/i, "Arial, 'Liberation Sans', Arimo, Helvetica, sans-serif"],
  [/^(courier|consolas|lucida console|monaco|menlo)/i, "'Courier New', Consolas, 'Liberation Mono', Menlo, monospace"],
  [/^(georgia)/i, "Georgia, 'Times New Roman', serif"],
  [/^(verdana|tahoma|segoe)/i, "Verdana, Tahoma, 'Segoe UI', Arial, sans-serif"],
  [/^(garamond|palatino|book antiqua)/i, "Garamond, 'Palatino Linotype', Georgia, serif"],
  [/^(comic)/i, "'Comic Sans MS', 'Comic Neue', cursive, sans-serif"],
  [/^(impact)/i, "Impact, 'Arial Black', sans-serif"],
];

export function cssFamily(name?: string | null): string {
  const n = (name || "").trim();
  if (!n) return "Calibri, Carlito, 'Segoe UI', Roboto, Arial, sans-serif";
  for (const [re, fam] of FONT_MAP) if (re.test(n)) return fam;
  const safe = n.replace(/["'\\]/g, "");
  return `'${safe}', Calibri, Carlito, 'Segoe UI', Arial, sans-serif`;
}

export function defaultStyle(over: Partial<RunStyle> = {}): RunStyle {
  return { size: 11, bold: false, italic: false, underline: false, strike: false, color: "#000000", font: cssFamily("Calibri"), ...over };
}

export const fontString = (s: RunStyle, sizeOverride?: number) =>
  `${s.italic ? "italic " : ""}${s.bold ? "700 " : "400 "}${sizeOverride ?? s.size}px ${s.font}`;

export function hexColor(v?: string | null, fallback = "#000000"): string {
  if (!v) return fallback;
  const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
  return m ? `#${m[1].toLowerCase()}` : fallback;
}

export function hslAdjust(hex: string, lumMod = 1, lumOff = 0): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  let r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  const nl = Math.min(1, Math.max(0, l * lumMod + lumOff));
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) r = g = b = nl;
  else {
    const q = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s;
    const p = 2 * nl - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (x: number) => Math.round(Math.min(255, Math.max(0, x * 255))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Tint/shade DrawingML dihitung pada ruang warna linear (bukan sRGB), sama seperti PowerPoint. */
export function tintShadeLinear(hex: string, kind: "tint" | "shade", amount: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const toLin = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const toSrgb = (x: number) => { const y = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, y)) * 255); };
  const out = [m[1], m[2], m[3]].map((h) => {
    const l = toLin(parseInt(h, 16));
    const r = kind === "tint" ? l * amount + (1 - amount) : l * amount;
    return toSrgb(r).toString(16).padStart(2, "0");
  });
  return `#${out.join("")}`;
}

// ── Pengukuran teks ───────────────────────────────────────────────────────

let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();

export function measureText(text: string, style: RunStyle): number {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d")!;
  // Ukur pada ukuran besar lalu skala → presisi sub-piksel, tidak bergantung pembulatan hinting.
  const REF = 100;
  const key = `${style.bold ? 1 : 0}${style.italic ? 1 : 0}|${style.font}|${text}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    measureCtx.font = `${style.italic ? "italic " : ""}${style.bold ? "700 " : "400 "}${REF}px ${style.font}`;
    w = measureCtx.measureText(text).width / REF;
    if (widthCache.size > 40000) widthCache.clear();
    widthCache.set(key, w);
  }
  const eff = style.sup || style.sub ? style.size * 0.65 : style.size;
  return w * eff;
}

// ── Tata letak paragraf (dipakai Word, Markdown, teks) ───────────────────

export type Inline =
  | { kind: "text"; text: string; style: RunStyle }
  | { kind: "br" }
  | { kind: "pagebreak" }
  | { kind: "tab"; style: RunStyle }
  | { kind: "img"; img: Img; w: number; h: number };

export interface ParaFmt {
  align: "left" | "center" | "right" | "justify";
  indentLeft: number;
  indentRight: number;
  firstLine: number; // negatif = hanging
  spaceBefore: number;
  spaceAfter: number;
  lineMult: number;
  lineExact?: number;
  lineAtLeast?: number;
  bullet?: { text: string; style: RunStyle };
  pageBreakBefore?: boolean;
  keepLinesTogether?: boolean;
  /** Warna latar paragraf (mis. blok kode). */
  shade?: string;
  /** Garis kiri (mis. kutipan Markdown). */
  leftRule?: { color: string; width: number };
  /** Garis bawah/atas paragraf (mis. hr, judul H1/H2). */
  bottomRule?: { color: string; width: number };
}

export function defaultParaFmt(over: Partial<ParaFmt> = {}): ParaFmt {
  return { align: "left", indentLeft: 0, indentRight: 0, firstLine: 0, spaceBefore: 0, spaceAfter: 8, lineMult: 1.08, ...over };
}

export interface PlacedItem {
  x: number; // relatif terhadap tepi kiri area konten paragraf
  w: number;
  text?: string;
  style?: RunStyle;
  img?: Img;
  h?: number;
}
export interface LineBox {
  h: number;
  baseline: number;
  items: PlacedItem[];
  hasPageBreak?: boolean;
  /** Teks bullet/nomor + posisinya (hanya baris pertama). */
  bulletItem?: PlacedItem;
}
export interface ParaLayout {
  fmt: ParaFmt;
  lines: LineBox[];
  width: number;
}

interface Tok {
  kind: "word" | "space" | "br" | "pagebreak" | "tab" | "img";
  text?: string;
  style?: RunStyle;
  w: number;
  img?: Img;
  h?: number;
}

function tokenize(inlines: Inline[], maxW: number): Tok[] {
  const toks: Tok[] = [];
  for (const it of inlines) {
    if (it.kind === "br") toks.push({ kind: "br", w: 0 });
    else if (it.kind === "pagebreak") toks.push({ kind: "pagebreak", w: 0 });
    else if (it.kind === "tab") toks.push({ kind: "tab", w: 0, style: it.style });
    else if (it.kind === "img") toks.push({ kind: "img", w: it.w, h: it.h, img: it.img });
    else {
      const parts = it.text.split(/([^\S\u00a0]+)/); // NBSP bukan spasi pemisah → indentasi kode terjaga
      for (const part of parts) {
        if (!part) continue;
        if (/^[^\S\u00a0]+$/.test(part)) {
          // Spasi berurutan diperlakukan sebagai satu lebar ruang × jumlah (tab/spasi ganda dipertahankan).
          toks.push({ kind: "space", text: part.replace(/[\r\n]+/g, " "), style: it.style, w: measureText(part.replace(/[\r\n]+/g, " "), it.style) });
        } else {
          const w = measureText(part, it.style);
          if (w <= maxW || part.length < 2) toks.push({ kind: "word", text: part, style: it.style, w });
          else {
            // Kata lebih lebar dari baris (URL panjang, dst.) → pecah per karakter.
            let cur = "";
            for (const ch of part) {
              if (measureText(cur + ch, it.style) > maxW && cur) {
                toks.push({ kind: "word", text: cur, style: it.style, w: measureText(cur, it.style) });
                cur = ch;
              } else cur += ch;
            }
            if (cur) toks.push({ kind: "word", text: cur, style: it.style, w: measureText(cur, it.style) });
          }
        }
      }
    }
  }
  return toks;
}

export function layoutParagraph(inlines: Inline[], fmt: ParaFmt, width: number): ParaLayout {
  const avail = Math.max(20, width - fmt.indentLeft - fmt.indentRight);
  const toks = tokenize(inlines, avail - Math.max(0, fmt.firstLine));
  const lines: LineBox[] = [];
  let cur: Tok[] = [];
  let curW = 0;
  let first = true;
  const bulletStyle = fmt.bullet?.style;

  const lineAvail = () => avail - (first ? fmt.firstLine : fmt.firstLine < 0 ? 0 : 0) - (first ? 0 : 0);
  const startX = () => (first ? Math.max(0, fmt.firstLine) + (fmt.firstLine < 0 ? 0 : 0) : 0);

  const flush = (endsHard: boolean, pageBreak = false) => {
    // buang spasi di ujung
    while (cur.length && cur[cur.length - 1].kind === "space") {
      curW -= cur[cur.length - 1].w;
      cur.pop();
    }
    let maxSize = 0;
    let maxImg = 0;
    for (const t of cur) {
      if (t.style) maxSize = Math.max(maxSize, t.style.size);
      if (t.kind === "img") maxImg = Math.max(maxImg, t.h ?? 0);
    }
    if (first && bulletStyle) maxSize = Math.max(maxSize, bulletStyle.size);
    if (!maxSize) maxSize = inlines.find((i) => i.kind === "text")
      ? (inlines.find((i) => i.kind === "text") as any).style.size
      : bulletStyle?.size ?? 11;
    const textH = maxSize * 1.2;
    let h = fmt.lineExact ?? textH * fmt.lineMult;
    if (fmt.lineAtLeast) h = Math.max(h, fmt.lineAtLeast);
    let baseline = (h - textH) / 2 + maxSize * 0.95;
    if (maxImg > 0) {
      h = Math.max(h, maxImg + maxSize * 0.3);
      baseline = h - maxSize * 0.25;
    }
    const left = first ? Math.max(0, fmt.firstLine) : 0;
    const spaces = cur.filter((t) => t.kind === "space").length;
    let extra = 0;
    if (fmt.align === "justify" && !endsHard && spaces > 0) extra = Math.max(0, avail - left - curW) / spaces;
    let offset = 0;
    if (fmt.align === "center") offset = Math.max(0, (avail - left - curW) / 2);
    else if (fmt.align === "right") offset = Math.max(0, avail - left - curW);
    let x = left + offset;
    const items: PlacedItem[] = [];
    for (const t of cur) {
      if (t.kind === "tab") {
        const stop = 36;
        const nx = Math.ceil((x + 1) / stop) * stop;
        x = Math.min(nx, avail);
        continue;
      }
      if (t.kind === "space") {
        x += t.w + extra;
        continue;
      }
      if (t.kind === "img") {
        items.push({ x, w: t.w, img: t.img, h: t.h });
        x += t.w;
        continue;
      }
      if (t.kind === "word") {
        // gabungkan kata berurutan bergaya sama + spasi di antaranya jadi satu run teks → hasil teks lebih rapat & bisa disalin
        items.push({ x, w: t.w, text: t.text, style: t.style });
        x += t.w;
      }
    }
    const line: LineBox = { h, baseline, items, hasPageBreak: pageBreak };
    if (first && fmt.bullet) {
      const bw = measureText(fmt.bullet.text, fmt.bullet.style);
      line.bulletItem = { x: (fmt as any)._bulletX ?? 0, w: bw, text: fmt.bullet.text, style: fmt.bullet.style };
    }
    lines.push(line);
    cur = [];
    curW = 0;
    first = false;
  };

  for (const t of toks) {
    if (t.kind === "br") {
      flush(true);
      continue;
    }
    if (t.kind === "pagebreak") {
      flush(true, true);
      continue;
    }
    if (t.kind === "space" && cur.length === 0) continue; // spasi di awal baris
    const room = avail - (first ? Math.max(0, fmt.firstLine) : 0);
    if (t.kind !== "space" && t.kind !== "tab" && curW + t.w > room + 0.01 && cur.length > 0) {
      flush(false);
    }
    cur.push(t);
    curW += t.w;
  }
  if (cur.length || lines.length === 0) flush(true);
  void lineAvail;
  void startX;
  return { fmt, lines, width: avail };
}

export function paraHeight(p: ParaLayout, includeSpacing = true): number {
  return p.lines.reduce((a, l) => a + l.h, 0) + (includeSpacing ? p.fmt.spaceBefore + p.fmt.spaceAfter : 0);
}

/**
 * Menempatkan satu baris pada halaman: menghasilkan Op teks/gambar + dekorasi (garis bawah/coret/highlight).
 * x0 = tepi kiri area konten paragraf (sudah termasuk indentLeft), yTop = atas baris.
 */
export function emitLine(ops: Op[], line: LineBox, x0: number, yTop: number) {
  const base = yTop + line.baseline;
  if (line.bulletItem?.text && line.bulletItem.style) {
    ops.push({ t: "text", x: x0 + line.bulletItem.x, y: base, text: line.bulletItem.text, style: line.bulletItem.style, w: line.bulletItem.w });
  }
  for (const it of line.items) {
    if (it.img) {
      ops.push({ t: "img", x: x0 + it.x, y: base - (it.h ?? 0), w: it.w, h: it.h ?? 0, img: it.img });
    } else if (it.text && it.style) {
      let yy = base;
      if (it.style.sup) yy -= it.style.size * 0.33;
      if (it.style.sub) yy += it.style.size * 0.15;
      if (it.style.highlight) ops.push({ t: "rect", x: x0 + it.x, y: base - it.style.size * 0.95, w: it.w, h: it.style.size * 1.2, fill: it.style.highlight });
      ops.push({ t: "text", x: x0 + it.x, y: yy, text: it.text, style: it.style, w: it.w });
    }
  }
}

// ── Rasterisasi ───────────────────────────────────────────────────────────

function drawImg(ctx: CanvasRenderingContext2D, op: Extract<Op, { t: "img" }>) {
  try {
    ctx.save();
    if (op.flipH || op.flipV) {
      ctx.translate(op.x + (op.flipH ? op.w : 0), op.y + (op.flipV ? op.h : 0));
      ctx.scale(op.flipH ? -1 : 1, op.flipV ? -1 : 1);
      if (op.sw && op.sh) ctx.drawImage(op.img as any, op.sx ?? 0, op.sy ?? 0, op.sw, op.sh, 0, 0, op.w, op.h);
      else ctx.drawImage(op.img as any, 0, 0, op.w, op.h);
    } else if (op.sw && op.sh) ctx.drawImage(op.img as any, op.sx ?? 0, op.sy ?? 0, op.sw, op.sh, op.x, op.y, op.w, op.h);
    else ctx.drawImage(op.img as any, op.x, op.y, op.w, op.h);
    ctx.restore();
  } catch {
    ctx.restore();
  }
}

function drawOps(ctx: CanvasRenderingContext2D, ops: Op[]) {
  for (const op of ops) {
    switch (op.t) {
      case "rect": {
        if (op.r && op.r > 0) {
          ctx.beginPath();
          const r = Math.min(op.r, op.w / 2, op.h / 2);
          ctx.moveTo(op.x + r, op.y);
          ctx.arcTo(op.x + op.w, op.y, op.x + op.w, op.y + op.h, r);
          ctx.arcTo(op.x + op.w, op.y + op.h, op.x, op.y + op.h, r);
          ctx.arcTo(op.x, op.y + op.h, op.x, op.y, r);
          ctx.arcTo(op.x, op.y, op.x + op.w, op.y, r);
          ctx.closePath();
          if (op.fill) { ctx.fillStyle = op.fill; ctx.fill(); }
          if (op.stroke) { ctx.strokeStyle = op.stroke; ctx.lineWidth = op.lw ?? 1; ctx.stroke(); }
        } else {
          if (op.fill) { ctx.fillStyle = op.fill; ctx.fillRect(op.x, op.y, op.w, op.h); }
          if (op.stroke) { ctx.strokeStyle = op.stroke; ctx.lineWidth = op.lw ?? 1; ctx.strokeRect(op.x, op.y, op.w, op.h); }
        }
        break;
      }
      case "ellipse": {
        ctx.beginPath();
        ctx.ellipse(op.x + op.w / 2, op.y + op.h / 2, Math.max(0.1, op.w / 2), Math.max(0.1, op.h / 2), 0, 0, Math.PI * 2);
        if (op.fill) { ctx.fillStyle = op.fill; ctx.fill(); }
        if (op.stroke) { ctx.strokeStyle = op.stroke; ctx.lineWidth = op.lw ?? 1; ctx.stroke(); }
        break;
      }
      case "poly": {
        if (!op.pts.length) break;
        ctx.beginPath();
        ctx.moveTo(op.pts[0][0], op.pts[0][1]);
        for (const p of op.pts.slice(1)) ctx.lineTo(p[0], p[1]);
        ctx.closePath();
        if (op.fill) { ctx.fillStyle = op.fill; ctx.fill(); }
        if (op.stroke) { ctx.strokeStyle = op.stroke; ctx.lineWidth = op.lw ?? 1; ctx.stroke(); }
        break;
      }
      case "line": {
        ctx.beginPath();
        ctx.setLineDash(op.dash ?? []);
        ctx.strokeStyle = op.color;
        ctx.lineWidth = op.lw;
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "text": {
        const s = op.style;
        const size = s.sup || s.sub ? s.size * 0.65 : s.size;
        ctx.font = fontString(s, size);
        ctx.fillStyle = s.color;
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.fillText(op.text, op.x, op.y);
        if (s.underline) {
          ctx.fillRect(op.x, op.y + size * 0.12, op.w, Math.max(0.5, size / 16));
        }
        if (s.strike) {
          ctx.fillRect(op.x, op.y - size * 0.3, op.w, Math.max(0.5, size / 16));
        }
        break;
      }
      case "img":
        drawImg(ctx, op);
        break;
      case "group": {
        ctx.save();
        ctx.translate(op.cx, op.cy);
        ctx.rotate((op.rot * Math.PI) / 180);
        ctx.translate(-op.cx, -op.cy);
        drawOps(ctx, op.ops);
        ctx.restore();
        break;
      }
      case "clip": {
        ctx.save();
        ctx.beginPath();
        ctx.rect(op.x, op.y, op.w, op.h);
        ctx.clip();
        drawOps(ctx, op.ops);
        ctx.restore();
        break;
      }
    }
  }
}

/** Menggambar satu halaman pada skala (px per pt). Skala 200/72 ≈ 200 dpi. */
export function rasterizePage(page: RasterPage, scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(page.w * scale));
  canvas.height = Math.max(1, Math.round(page.h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(canvas.width / page.w, 0, 0, canvas.height / page.h, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = page.bg;
  ctx.fillRect(0, 0, page.w, page.h);
  drawOps(ctx, page.ops);
  return canvas;
}

// ── XML & berkas ──────────────────────────────────────────────────────────

export const parseXml = (xml: string): Document => new DOMParser().parseFromString(xml, "application/xml");

export function childEls(el: Element | null | undefined, local: string): Element[] {
  if (!el) return [];
  const out: Element[] = [];
  for (const c of Array.from(el.children)) if (c.localName === local) out.push(c);
  return out;
}
export const child = (el: Element | null | undefined, local: string): Element | null => childEls(el, local)[0] ?? null;
export function descendants(el: Element | Document | null | undefined, local: string): Element[] {
  if (!el) return [];
  return Array.from((el as any).getElementsByTagNameNS("*", local)) as Element[];
}
/** Atribut berawalan namespace apa pun (w:val, r:embed, dst.). */
export function attr(el: Element | null | undefined, name: string): string | null {
  if (!el) return null;
  const direct = el.getAttribute(name);
  if (direct !== null) return direct;
  for (const a of Array.from(el.attributes)) if (a.localName === name) return a.value;
  return null;
}

export async function loadImageFromBytes(bytes: Uint8Array, mime: string): Promise<Img | null> {
  try {
    const blob = new Blob([bytes as BlobPart], { type: mime });
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

export function mimeForExt(path: string): string {
  const e = path.split(".").pop()?.toLowerCase();
  return e === "png" ? "image/png" : e === "jpg" || e === "jpeg" ? "image/jpeg" : e === "gif" ? "image/gif" : e === "webp" ? "image/webp" : e === "svg" ? "image/svg+xml" : e === "bmp" ? "image/bmp" : "application/octet-stream";
}

export const EMU_PT = 1 / 12700;
export const TWIP_PT = 1 / 20;
