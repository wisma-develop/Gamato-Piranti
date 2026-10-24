// Mesin gambar Kupon / Voucher / Tiket. Satu fungsi `renderCoupon` menggambar satu lembar
// ke <canvas> — dipakai identik untuk pratinjau, PNG, PDF, lembar cetak, dan ZIP massal,
// sehingga hasil ekspor selalu sama persis dengan yang terlihat di layar.

import qrcode from "qrcode-generator";
import JsBarcode from "jsbarcode";
import { fontStack } from "@/lib/fontPresets";
import { roundRect, drawLogoFit } from "@/lib/businessDocCanvas";
import { formatDateID } from "@/lib/dateFormat";
import { applyTokens, barcodeCompatible, type CouponRecord } from "@/lib/couponCodes";
import { COUPON_PX_PER_MM, resolveCouponSizeMM, type CouponDesign, type LayoutMode } from "@/lib/couponTypes";

export interface CouponAssets {
  logo: HTMLImageElement | null;
  bg: HTMLImageElement | null;
}

export interface RenderOptions {
  pxPerMm?: number;
}

type Align = "left" | "center" | "right";
interface Rect { x: number; y: number; w: number; h: number }

// ── Warna ────────────────────────────────────────────────────────────────

function parseHex(hex: string): [number, number, number] {
  let h = (hex || "#000000").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6).padEnd(6, "0"), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex: string, a: number) => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
};
function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const onColor = (bg: string) => (luminance(bg) > 0.42 ? "#111827" : "#ffffff");
function mix(a: string, b: string, t: number): string {
  const A = parseHex(a), B = parseHex(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ── Teks ─────────────────────────────────────────────────────────────────

interface TextItem {
  k: "text";
  text: string;
  size: number;
  weight?: number;
  color: string;
  heading?: boolean;
  italic?: boolean;
  upper?: boolean;
  mono?: boolean;
  spacing?: number;
  lh?: number;
  maxLines?: number;
  gap?: number;
  bullet?: boolean;
  align?: Align;
}
interface CustomItem {
  k: "custom";
  gap?: number;
  measure: (ctx: CanvasRenderingContext2D, w: number, s: number) => number;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, s: number, align: Align) => void;
}
type FlowItem = TextItem | CustomItem;

const MONO = "'JetBrains Mono', 'Courier New', monospace";

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  if ("letterSpacing" in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

function fontFor(d: CouponDesign, it: Pick<TextItem, "heading" | "mono" | "italic" | "weight">, size: number): string {
  const fam = it.mono ? MONO : fontStack(it.heading ? d.fontHeading : d.fontBody);
  return `${it.italic ? "italic " : ""}${it.weight ?? 400} ${size}px ${fam}`;
}

/** Memecah teks menjadi baris (mendukung \n dan kata yang lebih lebar dari kolom). */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (!cur || ctx.measureText(test).width <= maxW) { cur = test; if (ctx.measureText(cur).width <= maxW) continue; }
      if (cur !== test) { out.push(cur); cur = w; }
      // kata tunggal terlalu lebar → pecah per karakter
      while (ctx.measureText(cur).width > maxW && cur.length > 1) {
        let n = cur.length - 1;
        while (n > 1 && ctx.measureText(cur.slice(0, n)).width > maxW) n--;
        out.push(cur.slice(0, n));
        cur = cur.slice(n);
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

function layoutText(ctx: CanvasRenderingContext2D, d: CouponDesign, it: TextItem, w: number, s: number) {
  const size = it.size * s;
  ctx.font = fontFor(d, it, size);
  setSpacing(ctx, (it.spacing ?? 0) * s);
  let text = it.upper ? it.text.toUpperCase() : it.text;
  if (it.bullet) text = text.split(/\r?\n/).filter((l) => l.trim()).map((l) => `•  ${l.trim()}`).join("\n");
  let lines = wrapLines(ctx, text, w);
  if (it.maxLines && lines.length > it.maxLines) {
    lines = lines.slice(0, it.maxLines);
    let last = lines[it.maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > w) last = last.slice(0, -1);
    lines[it.maxLines - 1] = `${last}…`;
  }
  const lh = size * (it.lh ?? 1.28);
  return { lines, lh, size, h: lines.length * lh };
}

function itemHeight(ctx: CanvasRenderingContext2D, d: CouponDesign, it: FlowItem, w: number, s: number): number {
  return it.k === "text" ? layoutText(ctx, d, it, w, s).h : it.measure(ctx, w, s);
}

function flowHeight(ctx: CanvasRenderingContext2D, d: CouponDesign, items: FlowItem[], w: number, s: number): number {
  let h = 0;
  items.forEach((it, i) => {
    h += itemHeight(ctx, d, it, w, s);
    if (i < items.length - 1) h += (it.gap ?? 0) * s;
  });
  return h;
}

function drawFlow(ctx: CanvasRenderingContext2D, d: CouponDesign, items: FlowItem[], r: Rect, s: number, align: Align, valign: "top" | "middle" | "bottom") {
  const total = flowHeight(ctx, d, items, r.w, s);
  let y = valign === "top" ? r.y : valign === "middle" ? r.y + Math.max(0, (r.h - total) / 2) : r.y + Math.max(0, r.h - total);
  ctx.textBaseline = "top";
  items.forEach((it, i) => {
    if (it.k === "text") {
      const L = layoutText(ctx, d, it, r.w, s);
      const al = it.align ?? align;
      ctx.fillStyle = it.color;
      ctx.textAlign = al;
      const x = al === "left" ? r.x : al === "center" ? r.x + r.w / 2 : r.x + r.w;
      L.lines.forEach((ln, li) => ctx.fillText(ln, x, y + li * L.lh + (L.lh - L.size) / 2));
      y += L.h;
    } else {
      const h = it.measure(ctx, r.w, s);
      it.draw(ctx, r.x, y, r.w, s, align);
      y += h;
    }
    if (i < items.length - 1) y += (it.gap ?? 0) * s;
    setSpacing(ctx, 0);
  });
  setSpacing(ctx, 0);
}

/** Menggambar daftar item di dalam kotak; mengecilkan skala otomatis bila isi melebihi tinggi kotak. */
function fitFlow(ctx: CanvasRenderingContext2D, d: CouponDesign, items: FlowItem[], r: Rect, opts: { align?: Align; valign?: "top" | "middle" | "bottom"; min?: number } = {}) {
  if (r.w <= 2 || r.h <= 2 || !items.length) return;
  const min = opts.min ?? 0.42;
  let s = 1;
  if (flowHeight(ctx, d, items, r.w, 1) > r.h) {
    let lo = min, hi = 1;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (flowHeight(ctx, d, items, r.w, mid) <= r.h) lo = mid; else hi = mid;
    }
    s = lo;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  ctx.clip();
  drawFlow(ctx, d, items, r, s, opts.align ?? "left", opts.valign ?? "top");
  ctx.restore();
}

function fitSize(ctx: CanvasRenderingContext2D, d: CouponDesign, text: string, maxW: number, base: number, o: { heading?: boolean; weight?: number; mono?: boolean; spacing?: number }): number {
  ctx.font = fontFor(d, o, base);
  setSpacing(ctx, o.spacing ?? 0);
  const w = ctx.measureText(text).width;
  setSpacing(ctx, 0);
  if (w <= maxW || w === 0) return base;
  return Math.max(base * 0.1, base * (maxW / w));
}

function bigText(d: CouponDesign, text: string, size: number, color: string, o: { gap?: number; heading?: boolean; weight?: number; mono?: boolean; spacing?: number } = {}): CustomItem {
  const heading = o.heading ?? true;
  const weight = o.weight ?? 800;
  return {
    k: "custom",
    gap: o.gap,
    measure: (ctx, w, s) => fitSize(ctx, d, text, w, size * Math.max(s, 0.78), { heading, weight, mono: o.mono, spacing: o.spacing }) * 1.12,
    draw: (ctx, x, y, w, s, align) => {
      const sz = fitSize(ctx, d, text, w, size * Math.max(s, 0.78), { heading, weight, mono: o.mono, spacing: o.spacing });
      ctx.font = fontFor(d, { heading, weight, mono: o.mono }, sz);
      setSpacing(ctx, o.spacing ?? 0);
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.textAlign = align;
      ctx.fillText(text, align === "left" ? x : align === "center" ? x + w / 2 : x + w, y + sz * 0.06);
      setSpacing(ctx, 0);
    },
  };
}

// ── PRNG & pola ──────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPattern(ctx: CanvasRenderingContext2D, d: CouponDesign, W: number, H: number, ppm: number) {
  if (d.pattern === "none" || d.patternOpacity <= 0) return;
  const sc = Math.max(0.4, d.patternScale || 1);
  const step = 5.5 * ppm * sc;
  ctx.save();
  ctx.globalAlpha = Math.min(1, d.patternOpacity);
  ctx.fillStyle = d.patternColor;
  ctx.strokeStyle = d.patternColor;
  switch (d.pattern) {
    case "dots": {
      const r = step * 0.13;
      for (let y = step / 2, row = 0; y < H + step; y += step, row++)
        for (let x = (row % 2 ? step : step / 2); x < W + step; x += step) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case "stripes": {
      ctx.lineWidth = step * 0.16;
      const gap = step * 0.62;
      for (let k = -H; k < W + H; k += gap) { ctx.beginPath(); ctx.moveTo(k, H); ctx.lineTo(k + H, 0); ctx.stroke(); }
      break;
    }
    case "grid": {
      ctx.lineWidth = Math.max(1, ppm * 0.12);
      for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      break;
    }
    case "waves": {
      ctx.lineWidth = Math.max(1.2, ppm * 0.16);
      const amp = step * 0.22, wl = step * 1.6;
      for (let y = step * 0.5; y < H + step; y += step * 0.9) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const yy = y + Math.sin((x / wl) * Math.PI * 2) * amp;
          if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      break;
    }
    case "confetti": {
      const rnd = mulberry32(20260101);
      const n = Math.round((W * H) / (step * step * 1.6));
      for (let i = 0; i < n; i++) {
        const x = rnd() * W, y = rnd() * H, sz = step * (0.1 + rnd() * 0.14), rot = rnd() * Math.PI * 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        const t = Math.floor(rnd() * 3);
        if (t === 0) ctx.fillRect(-sz, -sz / 2, sz * 2, sz);
        else if (t === 1) { ctx.beginPath(); ctx.arc(0, 0, sz * 0.7, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz, sz); ctx.lineTo(-sz, sz); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      break;
    }
    case "circles": {
      ctx.lineWidth = Math.max(1.2, ppm * 0.2);
      for (const [cx, cy] of [[0, 0], [W, H]]) {
        for (let r = step * 1.2; r < Math.max(W, H) * 0.7; r += step * 1.15) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
      }
      break;
    }
    case "zigzag": {
      ctx.lineWidth = Math.max(1.2, ppm * 0.16);
      const zh = step * 0.28, zw = step * 0.5;
      for (let y = step * 0.5; y < H + step; y += step * 0.85) {
        ctx.beginPath();
        let up = false;
        for (let x = 0; x <= W + zw; x += zw) { const yy = y + (up ? -zh : zh); if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); up = !up; }
        ctx.stroke();
      }
      break;
    }
    case "diamonds": {
      ctx.lineWidth = Math.max(1, ppm * 0.14);
      const hs = step * 0.5;
      for (let y = 0; y < H + step; y += step) for (let x = 0; x < W + step; x += step) {
        ctx.beginPath(); ctx.moveTo(x, y - hs); ctx.lineTo(x + hs, y); ctx.lineTo(x, y + hs); ctx.lineTo(x - hs, y); ctx.closePath(); ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

// ── QR & barcode ─────────────────────────────────────────────────────────

let qrUtf8Ready = false;
function ensureQrUtf8() {
  if (qrUtf8Ready) return;
  const q = qrcode as unknown as { stringToBytes: unknown; stringToBytesFuncs?: Record<string, unknown> };
  if (q.stringToBytesFuncs?.["UTF-8"]) q.stringToBytes = q.stringToBytesFuncs["UTF-8"];
  qrUtf8Ready = true;
}

/** Matriks QR (true = modul gelap) atau null bila data terlalu panjang. */
export function buildQrMatrix(text: string, ecc: "L" | "M" | "Q" | "H"): boolean[][] | null {
  try {
    ensureQrUtf8();
    const qr = qrcode(0, ecc);
    qr.addData(text, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    const m: boolean[][] = [];
    for (let r = 0; r < n; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
      m.push(row);
    }
    return m;
  } catch {
    return null;
  }
}

function drawQr(ctx: CanvasRenderingContext2D, d: CouponDesign, matrix: boolean[][], x: number, y: number, side: number, plateBg: string) {
  const n = matrix.length;
  const pad = side * (2 / (n + 4));
  if (d.qrPlate) {
    ctx.fillStyle = plateBg;
    roundRect(ctx, x, y, side, side, side * 0.05);
    ctx.fill();
  }
  const inner = side - pad * 2;
  const cell = inner / n;
  const ox = x + pad, oy = y + pad;
  ctx.fillStyle = d.qrColor;
  const finder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c]) continue;
      const px = ox + c * cell, py = oy + r * cell;
      if (d.qrStyle === "square" || finder(r, c)) {
        const x0 = Math.floor(px), y0 = Math.floor(py);
        ctx.fillRect(x0, y0, Math.ceil(px + cell) - x0, Math.ceil(py + cell) - y0);
      } else if (d.qrStyle === "dots") {
        ctx.beginPath(); ctx.arc(px + cell / 2, py + cell / 2, cell * 0.46, 0, Math.PI * 2); ctx.fill();
      } else {
        roundRect(ctx, px + cell * 0.04, py + cell * 0.04, cell * 0.92, cell * 0.92, cell * 0.3); ctx.fill();
      }
    }
  }
}

/** Menggambar barcode dengan lebar modul bilangan bulat supaya batang tetap tajam. */
function drawBarcode(ctx: CanvasRenderingContext2D, d: CouponDesign, code: string, x: number, y: number, boxW: number, boxH: number, color: string, plateBg: string | null): boolean {
  if (!barcodeCompatible(code, d.barcodeFormat)) return false;
  try {
    const probe = document.createElement("canvas");
    JsBarcode(probe, code, { format: d.barcodeFormat, width: 1, height: 10, margin: 0, displayValue: false });
    const modules = probe.width;
    if (!modules) return false;
    const padX = boxH * 0.12;
    const mw = Math.max(1, Math.floor((boxW - padX * 2) / modules));
    const cv = document.createElement("canvas");
    JsBarcode(cv, code, { format: d.barcodeFormat, width: mw, height: Math.max(8, Math.round(boxH * 0.8)), margin: 0, displayValue: false, lineColor: color, background: "rgba(0,0,0,0)" });
    const dw = cv.width, dh = Math.min(cv.height, boxH);
    const dx = x + (boxW - dw) / 2;
    if (plateBg) {
      ctx.fillStyle = plateBg;
      roundRect(ctx, dx - padX, y, dw + padX * 2, boxH, boxH * 0.1);
      ctx.fill();
    }
    ctx.drawImage(cv, dx, y + (boxH - dh) / 2, dw, dh);
    return true;
  } catch {
    return false;
  }
}

// ── Bentuk kupon (sudut, tepi, notch) ────────────────────────────────────

function shapePath(ctx: CanvasRenderingContext2D, W: number, H: number, rr: number) {
  roundRect(ctx, 0, 0, W, H, Math.max(0, rr));
}

interface Geometry {
  main: Rect;
  stub: Rect | null;
  vertical: boolean; // stub berdiri (kiri/kanan) → konten menumpuk vertikal
  perf: { x1: number; y1: number; x2: number; y2: number } | null;
  strip: boolean; // "none": area kode ditaruh di dalam kupon tanpa perforasi
}

function geometry(d: CouponDesign, W: number, H: number): Geometry {
  const f = Math.min(0.45, Math.max(0.14, (d.stubPct || 26) / 100));
  switch (d.stub) {
    case "right": { const sw = W * f; return { main: { x: 0, y: 0, w: W - sw, h: H }, stub: { x: W - sw, y: 0, w: sw, h: H }, vertical: true, perf: { x1: W - sw, y1: 0, x2: W - sw, y2: H }, strip: false }; }
    case "left": { const sw = W * f; return { main: { x: sw, y: 0, w: W - sw, h: H }, stub: { x: 0, y: 0, w: sw, h: H }, vertical: true, perf: { x1: sw, y1: 0, x2: sw, y2: H }, strip: false }; }
    case "bottom": { const sh = H * f; return { main: { x: 0, y: 0, w: W, h: H - sh }, stub: { x: 0, y: H - sh, w: W, h: sh }, vertical: false, perf: { x1: 0, y1: H - sh, x2: W, y2: H - sh }, strip: false }; }
    case "top": { const sh = H * f; return { main: { x: 0, y: sh, w: W, h: H - sh }, stub: { x: 0, y: 0, w: W, h: sh }, vertical: false, perf: { x1: 0, y1: sh, x2: W, y2: sh }, strip: false }; }
    default: {
      if (d.codeMode === "none") return { main: { x: 0, y: 0, w: W, h: H }, stub: null, vertical: false, perf: null, strip: false };
      const sh = H * 0.27;
      return { main: { x: 0, y: 0, w: W, h: H - sh }, stub: { x: 0, y: H - sh, w: W, h: sh }, vertical: false, perf: null, strip: true };
    }
  }
}

function edgeHoles(W: number, H: number, style: "scallop" | "zigzag", ppm: number, rr: number, avoid: { x: number; y: number; r: number }[]): { fill: Path2D; stroke: Path2D } {
  const fill = new Path2D(), stroke = new Path2D();
  const r = 1.25 * ppm, step = 4.4 * ppm, cm = Math.max(rr, 2.5 * ppm) + r * 1.6;
  const place = (cx: number, cy: number, dir: "t" | "b" | "l" | "r") => {
    for (const a of avoid) if (Math.hypot(cx - a.x, cy - a.y) < a.r + r * 2.2) return;
    if (style === "scallop") {
      fill.moveTo(cx + r, cy); fill.arc(cx, cy, r, 0, Math.PI * 2);
      stroke.moveTo(cx + r, cy); stroke.arc(cx, cy, r, 0, Math.PI * 2);
    } else {
      const h = r * 1.15;
      const pts: [number, number][] =
        dir === "t" ? [[cx - r, cy], [cx + r, cy], [cx, cy + h]]
        : dir === "b" ? [[cx - r, cy], [cx + r, cy], [cx, cy - h]]
        : dir === "l" ? [[cx, cy - r], [cx, cy + r], [cx + h, cy]]
        : [[cx, cy - r], [cx, cy + r], [cx - h, cy]];
      for (const p of [fill, stroke]) { p.moveTo(pts[0][0], pts[0][1]); p.lineTo(pts[1][0], pts[1][1]); p.lineTo(pts[2][0], pts[2][1]); p.closePath(); }
    }
  };
  const run = (len: number, fn: (t: number) => void) => {
    const span = len - cm * 2;
    if (span < step) return;
    const n = Math.max(1, Math.round(span / step));
    for (let i = 0; i < n; i++) fn(cm + (i + 0.5) * (span / n));
  };
  run(W, (t) => place(t, 0, "t"));
  run(W, (t) => place(t, H, "b"));
  run(H, (t) => place(0, t, "l"));
  run(H, (t) => place(W, t, "r"));
  return { fill, stroke };
}

// ── Isi teks bersama ─────────────────────────────────────────────────────

function validityText(d: CouponDesign, rec: CouponRecord): string {
  const T = (s: string) => applyTokens(s, rec).trim();
  const label = T(d.validLabel);
  const fmt = (iso: string) => formatDateID(iso);
  if (d.validityMode === "until") return d.validUntil ? `${label} ${fmt(d.validUntil)}`.trim() : "";
  if (d.validityMode === "range") {
    if (d.validFrom && d.validUntil) return `${label} ${fmt(d.validFrom)} – ${fmt(d.validUntil)}`.trim();
    if (d.validUntil) return `${label} ${fmt(d.validUntil)}`.trim();
    return d.validFrom ? `${label} ${fmt(d.validFrom)}`.trim() : "";
  }
  if (d.validityMode === "text") return T(d.validText);
  return "";
}

const PAD4 = (n: number) => String(Math.max(0, n)).padStart(4, "0");

// ── Penggambar utama ─────────────────────────────────────────────────────

export function couponPixelSize(d: CouponDesign, ppm = COUPON_PX_PER_MM) {
  const { wMM, hMM } = resolveCouponSizeMM(d);
  return { w: Math.round(wMM * ppm), h: Math.round(hMM * ppm), wMM, hMM };
}

export function renderCoupon(canvas: HTMLCanvasElement, d: CouponDesign, rec: CouponRecord, assets: CouponAssets, opts: RenderOptions = {}): void {
  const ppm = opts.pxPerMm ?? COUPON_PX_PER_MM;
  const { w: W, h: H } = couponPixelSize(d, ppm);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = "top";

  const T = (s: string) => applyTokens(s, rec).trim();
  const rr = Math.min(Math.max(0, d.radius) * ppm, W / 2, H / 2);
  const bw = Math.max(0, d.borderWidth) * ppm;
  const geo = geometry(d, W, H);

  // ukuran dasar teks mengikuti ukuran area utama
  const m = Math.min(geo.main.w, geo.main.h * 1.75);
  const S = (m / ppm / 110) * (d.textScale || 1);
  const mm = (v: number) => v * ppm * S;
  // Bingkai (terutama garis dalam/ganda) memakan ruang tepi — isi digeser ke dalam agar tidak menabrak garis.
  const borderSafe = d.borderStyle === "none" ? 0
    : (d.borderStyle === "inset" ? 2.4 + d.borderWidth : d.borderStyle === "double" ? 0.9 + d.borderWidth * 3.4 : d.borderStyle === "dashed" ? 1.6 + d.borderWidth : d.borderWidth) * ppm
      + (d.edge === "plain" ? 0 : 2.6 * ppm);
  const padBase = mm(4.6) + borderSafe * 0.55;

  const tc = d.colorText;
  const muted = rgba(tc, 0.7);
  const ac = d.colorAccent;
  const onAc = onColor(ac);

  // ── 1. Latar & pola (di dalam bentuk kupon) ──
  ctx.save();
  shapePath(ctx, W, H, rr);
  ctx.clip();

  if (d.bgMode === "image" && assets.bg) {
    const iw = assets.bg.naturalWidth || assets.bg.width, ih = assets.bg.naturalHeight || assets.bg.height;
    const sc = Math.max(W / iw, H / ih);
    ctx.drawImage(assets.bg, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc);
    ctx.fillStyle = rgba(d.colorBg1, d.bgImageOverlay);
    ctx.fillRect(0, 0, W, H);
  } else if (d.bgMode === "gradient") {
    const a = ((d.gradAngle || 0) * Math.PI) / 180;
    const L = Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a));
    const cx = W / 2, cy = H / 2;
    const g = ctx.createLinearGradient(cx - (Math.cos(a) * L) / 2, cy - (Math.sin(a) * L) / 2, cx + (Math.cos(a) * L) / 2, cy + (Math.sin(a) * L) / 2);
    g.addColorStop(0, d.colorBg1);
    g.addColorStop(1, d.colorBg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = d.colorBg1;
    ctx.fillRect(0, 0, W, H);
  }
  drawPattern(ctx, d, W, H, ppm);

  // ── 2. Warna potongan (stub) ──
  let stubText = tc, stubMuted = muted;
  if (geo.stub && !geo.strip) {
    const tone = d.stubTone;
    let fill: string | null = null;
    if (tone === "accent") { fill = ac; stubText = onAc; stubMuted = rgba(onAc, 0.78); }
    else if (tone === "dark") { fill = mix(ac, "#000000", 0.68); stubText = onColor(fill); stubMuted = rgba(stubText, 0.75); }
    else if (tone === "light") { fill = "rgba(255,255,255,0.78)"; stubText = "#111827"; stubMuted = "rgba(17,24,39,0.65)"; }
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(geo.stub.x, geo.stub.y, geo.stub.w, geo.stub.h); }
  } else if (geo.stub && geo.strip) {
    // pita kode di dalam kupon: garis pemisah tipis
    ctx.fillStyle = rgba(tc, 0.07);
    ctx.fillRect(geo.stub.x, geo.stub.y, geo.stub.w, geo.stub.h);
  }

  // ── 3. Konten area utama ──
  const logo = assets.logo;
  const brand = T(d.brand), tagline = T(d.tagline);
  const label = T(d.label), title = T(d.title), subtitle = T(d.subtitle);
  const value = T(d.value), unit = T(d.unit), desc = T(d.description);
  const terms = T(d.terms), footer = T(d.footer);
  const valid = validityText(d, rec);
  const detailRows = d.details.map((r) => ({ label: T(r.label), value: T(r.value) })).filter((r) => r.label || r.value);

  const brandItem = (color: string, mutedC: string, size = 3.6, forceCenter = false): CustomItem | null => {
    if (!brand && !logo && !tagline) return null;
    const logoH = mm(8.5) * (d.logoSize || 1);
    return {
      k: "custom",
      gap: 2.4 * ppm * S,
      measure: (c, w, s) => {
        const hasLogo = !!logo;
        let th = 0;
        if (brand) { c.font = fontFor(d, { heading: true, weight: 800 }, mm(size) * s); th += mm(size) * s * 1.2; }
        if (tagline) th += mm(2.5) * s * 1.2;
        void w;
        return Math.max(hasLogo ? logoH * s : 0, th);
      },
      draw: (c, x, y, w, s, align) => {
        const lh = logoH * s;
        const lw = logo ? lh * Math.min(2.6, (logo.naturalWidth || 1) / (logo.naturalHeight || 1)) : 0;
        const gapX = logo && (brand || tagline) ? mm(2.2) * s : 0;
        const textMax = Math.max(10, w - lw - gapX);
        c.font = fontFor(d, { heading: true, weight: 800 }, mm(size) * s);
        const bwid = brand ? Math.min(textMax, c.measureText(brand).width) : 0;
        c.font = fontFor(d, { weight: 500 }, mm(2.5) * s);
        const twid = tagline ? Math.min(textMax, c.measureText(tagline).width) : 0;
        const total = lw + gapX + Math.max(bwid, twid);
        const al = forceCenter ? "center" : align;
        let cx = al === "left" ? x : al === "center" ? x + (w - total) / 2 : x + w - total;
        const rowH = Math.max(logo ? lh : 0, (brand ? mm(size) * s * 1.2 : 0) + (tagline ? mm(2.5) * s * 1.2 : 0));
        if (logo) { drawLogoFit(c, logo, cx, y + (rowH - lh) / 2, lw, lh, { rounded: true }); cx += lw + gapX; }
        const textH = (brand ? mm(size) * s * 1.2 : 0) + (tagline ? mm(2.5) * s * 1.2 : 0);
        let ty = y + (rowH - textH) / 2;
        c.textAlign = "left";
        c.textBaseline = "top";
        if (brand) {
          c.font = fontFor(d, { heading: true, weight: 800 }, mm(size) * s);
          c.fillStyle = color;
          let b = brand;
          while (b.length > 1 && c.measureText(b).width > textMax) b = b.slice(0, -1);
          c.fillText(b === brand ? b : `${b}…`, cx, ty);
          ty += mm(size) * s * 1.2;
        }
        if (tagline) {
          c.font = fontFor(d, { weight: 500 }, mm(2.5) * s);
          c.fillStyle = mutedC;
          let t = tagline;
          while (t.length > 1 && c.measureText(t).width > textMax) t = t.slice(0, -1);
          c.fillText(t === tagline ? t : `${t}…`, cx, ty);
        }
      },
    };
  };

  const detailsItem = (cols: number, color: string, mutedC: string, accentC: string, gap = 2.6): CustomItem | null => {
    if (!detailRows.length) return null;
    const colGap = mm(4);
    const cellH = (c: CanvasRenderingContext2D, wCell: number, s: number, r: { label: string; value: string }) => {
      const ls = mm(2.2) * s, vs = mm(3.2) * s;
      c.font = fontFor(d, { weight: 700 }, vs);
      const vl = r.value ? wrapLines(c, r.value, wCell).slice(0, 2).length : 1;
      return (r.label ? ls * 1.35 : 0) + vl * vs * 1.25 + mm(0.6) * s;
    };
    const rows: { label: string; value: string }[][] = [];
    for (let i = 0; i < detailRows.length; i += cols) rows.push(detailRows.slice(i, i + cols));
    return {
      k: "custom",
      gap: gap * ppm * S,
      measure: (c, w, s) => {
        const wCell = (w - colGap * s * (cols - 1)) / cols;
        return rows.reduce((h, rw) => h + Math.max(...rw.map((r) => cellH(c, wCell, s, r))) + mm(1.2) * s, 0) - mm(1.2) * s;
      },
      draw: (c, x, y, w, s, align) => {
        const wCell = (w - colGap * s * (cols - 1)) / cols;
        let yy = y;
        for (const rw of rows) {
          const rh = Math.max(...rw.map((r) => cellH(c, wCell, s, r)));
          rw.forEach((r, ci) => {
            const cx = x + ci * (wCell + colGap * s);
            const ls = mm(2.2) * s, vs = mm(3.2) * s;
            const al: Align = align === "center" ? "center" : align === "right" ? "right" : "left";
            const ax = al === "left" ? cx : al === "center" ? cx + wCell / 2 : cx + wCell;
            c.textAlign = al;
            c.textBaseline = "top";
            let ty = yy;
            if (r.label) {
              c.font = fontFor(d, { weight: 600 }, ls);
              setSpacing(c, ls * 0.12);
              c.fillStyle = mutedC;
              let lbl = r.label.toUpperCase();
              while (lbl.length > 1 && c.measureText(lbl).width > wCell) lbl = lbl.slice(0, -1);
              c.fillText(lbl, ax, ty);
              setSpacing(c, 0);
              ty += ls * 1.35;
            }
            c.font = fontFor(d, { weight: 700 }, vs);
            if (r.value) {
              c.fillStyle = color;
              const ls2 = wrapLines(c, r.value, wCell).slice(0, 2);
              ls2.forEach((ln, i) => c.fillText(ln, ax, ty + i * vs * 1.25));
            } else {
              // kosong → garis isian untuk ditulis tangan
              c.strokeStyle = accentC;
              c.globalAlpha = 0.55;
              c.setLineDash([vs * 0.2, vs * 0.2]);
              c.lineWidth = Math.max(1, ppm * 0.18);
              const lx1 = al === "left" ? cx : al === "center" ? cx + wCell * 0.1 : cx + wCell * 0.2;
              const lx2 = al === "left" ? cx + wCell * 0.9 : al === "center" ? cx + wCell * 0.9 : cx + wCell;
              c.beginPath(); c.moveTo(lx1, ty + vs * 1.0); c.lineTo(lx2, ty + vs * 1.0); c.stroke();
              c.setLineDash([]);
              c.globalAlpha = 1;
            }
          });
          yy += rh + mm(1.2) * s;
        }
      },
    };
  };

  const txt = (text: string, sizeMM: number, o: Partial<TextItem> = {}): TextItem | null =>
    text ? { k: "text", text, size: mm(sizeMM), color: tc, ...o } : null;
  const compact = (arr: (FlowItem | null)[]): FlowItem[] => arr.filter((x): x is FlowItem => !!x);

  // tata letak efektif: kolom sempit → poster
  let layout: LayoutMode = d.layout;
  if (layout === "value-left" && geo.main.w < geo.main.h * 1.05) layout = "poster";
  const M = geo.main;
  const pad = padBase;
  const termsItem = (color: string, size = 2.3): TextItem | null => txt(terms, size, { color, bullet: true, lh: 1.3, maxLines: 4, gap: 0 });

  if (layout === "value-left") {
    const pw = M.w * 0.34;
    const g = ctx.createLinearGradient(M.x, M.y, M.x, M.y + M.h);
    g.addColorStop(0, ac);
    g.addColorStop(1, mix(ac, "#000000", 0.18));
    ctx.fillStyle = g;
    ctx.fillRect(M.x, M.y, pw, M.h);
    ctx.fillStyle = rgba("#ffffff", 0.18);
    ctx.fillRect(M.x + pw - ppm * 0.4, M.y, ppm * 0.4, M.h);
    const panel: Rect = { x: M.x + pad * 0.6, y: M.y + pad, w: pw - pad * 1.2, h: M.h - pad * 2 };
    const panelItems = compact([
      txt(label, 2.6, { color: onAc, weight: 700, upper: true, spacing: mm(0.45), gap: mm(2.5), heading: false, align: "center" }),
      value ? bigText(d, value, mm(15), onAc, { gap: mm(1.2) }) : null,
      value ? txt(unit, 2.7, { color: rgba(onAc, 0.9), weight: 600, upper: true, spacing: mm(0.4), align: "center" }) : null,
      !value ? brandItem(onAc, rgba(onAc, 0.8), 4.2, true) : null,
    ]);
    fitFlow(ctx, d, panelItems, panel, { align: "center", valign: "middle" });
    const R: Rect = { x: M.x + pw + pad, y: M.y + pad, w: M.w - pw - pad * 2, h: M.h - pad * 2 };
    const cols = R.w / ppm > 90 && detailRows.length >= 2 ? 2 : 1;
    fitFlow(ctx, d, compact([
      value ? brandItem(tc, muted, 3.4) : null,
      txt(title, 7.4, { color: tc, heading: true, weight: 800, lh: 1.12, maxLines: 3, gap: mm(1.4) }),
      txt(subtitle, 3.4, { color: muted, weight: 500, maxLines: 2, gap: mm(1.6) }),
      txt(desc, 3.0, { color: tc, maxLines: 4, gap: mm(2.6) }),
      detailsItem(cols, tc, muted, ac),
      txt(valid, 3.0, { color: ac, weight: 800, gap: mm(2), maxLines: 2 }),
      termsItem(muted),
      txt(footer, 2.3, { color: muted, maxLines: 2 }),
    ]), R, { valign: "middle" });
  } else if (layout === "value-center") {
    const R: Rect = { x: M.x + pad, y: M.y + pad * 0.9, w: M.w - pad * 2, h: M.h - pad * 1.8 };
    const cols = R.w / ppm > 80 && detailRows.length >= 2 ? 2 : 1;
    fitFlow(ctx, d, compact([
      brandItem(tc, muted, 3.4),
      txt(label, 2.7, { color: ac, weight: 700, upper: true, spacing: mm(0.5), gap: mm(1.6), heading: false }),
      txt(title, 7.2, { color: tc, heading: true, weight: 800, lh: 1.12, maxLines: 2, gap: mm(1.2) }),
      txt(subtitle, 3.3, { color: muted, weight: 500, maxLines: 2, gap: mm(1.8) }),
      value ? bigText(d, value, mm(17), ac, { gap: mm(0.8) }) : null,
      value ? txt(unit, 2.8, { color: muted, weight: 700, upper: true, spacing: mm(0.45), gap: mm(2.2) }) : null,
      txt(desc, 3.0, { color: tc, maxLines: 3, gap: mm(2.2) }),
      detailsItem(cols, tc, muted, ac),
      txt(valid, 3.0, { color: ac, weight: 800, gap: mm(1.6), maxLines: 2 }),
      termsItem(muted, 2.2),
      txt(footer, 2.2, { color: muted, maxLines: 1 }),
    ]), R, { align: "center", valign: "middle" });
  } else if (layout === "banner-top") {
    const bh = Math.max(Math.min(M.h * 0.25, mm(17)), borderSafe * 1.15 + mm(7.5));
    const g = ctx.createLinearGradient(M.x, M.y, M.x + M.w, M.y);
    g.addColorStop(0, ac);
    g.addColorStop(1, mix(ac, "#000000", 0.22));
    ctx.fillStyle = g;
    ctx.fillRect(M.x, M.y, M.w, bh);
    const bandTop = Math.max(bh * 0.12, borderSafe * 0.9);
    const bandR: Rect = { x: M.x + pad, y: M.y + bandTop, w: M.w - pad * 2, h: bh - bandTop - bh * 0.1 };
    const lblW = Math.min(bandR.w * 0.45, mm(60));
    fitFlow(ctx, d, compact([brandItem(onAc, rgba(onAc, 0.8), 3.6)]), { ...bandR, w: bandR.w - lblW - pad * 0.5 }, { valign: "middle" });
    fitFlow(ctx, d, compact([txt(label, 3, { color: onAc, weight: 800, upper: true, spacing: mm(0.55), heading: true, maxLines: 2, align: "right" })]), { x: bandR.x + bandR.w - lblW, y: bandR.y, w: lblW, h: bandR.h }, { align: "right", valign: "middle" });
    const B: Rect = { x: M.x + pad, y: M.y + bh + pad * 0.75, w: M.w - pad * 2, h: M.h - bh - pad * 1.5 };
    const wide = B.w / B.h > 1.75 && !!value;
    if (wide) {
      const lw = B.w * 0.63, rw = B.w - lw - pad;
      const cols = lw / ppm > 90 && detailRows.length >= 2 ? 2 : 1;
      fitFlow(ctx, d, compact([
        txt(title, 7, { color: tc, heading: true, weight: 800, lh: 1.12, maxLines: 2, gap: mm(1.2) }),
        txt(subtitle, 3.3, { color: muted, weight: 500, maxLines: 2, gap: mm(1.8) }),
        txt(desc, 3.0, { color: tc, maxLines: 3, gap: mm(2.2) }),
        detailsItem(cols, tc, muted, ac),
        termsItem(muted, 2.2),
      ]), { x: B.x, y: B.y, w: lw, h: B.h }, { valign: "top" });
      ctx.fillStyle = rgba(tc, 0.14);
      ctx.fillRect(B.x + lw + pad / 2 - ppm * 0.15, B.y, ppm * 0.3, B.h);
      fitFlow(ctx, d, compact([
        bigText(d, value, mm(17), ac, { gap: mm(0.8) }),
        txt(unit, 2.8, { color: muted, weight: 700, upper: true, spacing: mm(0.45), gap: mm(2.2), align: "center" }),
        txt(valid, 3.0, { color: tc, weight: 800, maxLines: 3, align: "center" }),
      ]), { x: B.x + lw + pad, y: B.y, w: rw, h: B.h }, { align: "center", valign: "middle" });
    } else {
      const cols = B.w / ppm > 70 && detailRows.length >= 2 ? 2 : 1;
      fitFlow(ctx, d, compact([
        txt(title, 7, { color: tc, heading: true, weight: 800, lh: 1.12, maxLines: 2, gap: mm(1.2) }),
        txt(subtitle, 3.3, { color: muted, weight: 500, maxLines: 2, gap: mm(1.6) }),
        value ? bigText(d, value, mm(13), ac, { gap: mm(0.4) }) : null,
        value ? txt(unit, 2.7, { color: muted, weight: 700, upper: true, spacing: mm(0.4), gap: mm(1.8) }) : null,
        txt(desc, 3.0, { color: tc, maxLines: 3, gap: mm(2) }),
        detailsItem(cols, tc, muted, ac),
        txt(valid, 3.0, { color: ac, weight: 800, gap: mm(1.6), maxLines: 2 }),
        termsItem(muted, 2.2),
      ]), B, { valign: "top" });
    }
  } else if (layout === "minimal") {
    const barW = mm(1.5);
    ctx.fillStyle = ac;
    ctx.fillRect(M.x + pad * 0.55, M.y + pad * 0.9, barW, M.h - pad * 1.8);
    const R: Rect = { x: M.x + pad * 0.55 + barW + pad * 0.8, y: M.y + pad * 0.9, w: M.w - pad * 1.6 - barW - pad * 0.8, h: M.h - pad * 1.8 };
    const cols = R.w / ppm > 90 && detailRows.length >= 2 ? 2 : 1;
    fitFlow(ctx, d, compact([
      brandItem(tc, muted, 3.4),
      txt(label, 2.7, { color: ac, weight: 700, upper: true, spacing: mm(0.5), gap: mm(1.2), heading: false }),
      txt(title, 7.6, { color: tc, heading: true, weight: 800, lh: 1.1, maxLines: 2, gap: mm(1) }),
      txt(subtitle, 3.3, { color: muted, weight: 500, maxLines: 2, gap: mm(1.6) }),
      value ? bigText(d, value, mm(13), ac, { gap: mm(0.3) }) : null,
      value ? txt(unit, 2.7, { color: muted, weight: 700, upper: true, spacing: mm(0.4), gap: mm(2) }) : null,
      txt(desc, 3.0, { color: tc, maxLines: 3, gap: mm(2.2) }),
      detailsItem(cols, tc, muted, ac),
      txt(valid, 3.0, { color: ac, weight: 800, gap: mm(1.6), maxLines: 2 }),
      termsItem(muted, 2.2),
      txt(footer, 2.2, { color: muted, maxLines: 1 }),
    ]), R, { valign: "middle" });
  } else {
    // poster
    const hh = M.h * 0.37;
    const g = ctx.createLinearGradient(M.x, M.y, M.x + M.w, M.y + hh);
    g.addColorStop(0, ac);
    g.addColorStop(1, mix(ac, "#000000", 0.28));
    ctx.fillStyle = g;
    ctx.fillRect(M.x, M.y, M.w, hh);
    const HR: Rect = { x: M.x + pad, y: M.y + pad * 0.8, w: M.w - pad * 2, h: hh - pad * 1.4 };
    fitFlow(ctx, d, compact([
      brandItem(onAc, rgba(onAc, 0.85), 3.4),
      txt(label, 2.7, { color: rgba(onAc, 0.92), weight: 700, upper: true, spacing: mm(0.55), gap: mm(1.4), heading: false }),
      txt(title, 8.6, { color: onAc, heading: true, weight: 800, lh: 1.08, maxLines: 3, gap: mm(1) }),
      txt(subtitle, 3.2, { color: rgba(onAc, 0.88), weight: 500, maxLines: 2 }),
    ]), HR, { align: "center", valign: "middle" });
    const BR: Rect = { x: M.x + pad, y: M.y + hh + pad * 0.8, w: M.w - pad * 2, h: M.h - hh - pad * 1.5 };
    const cols = BR.w / ppm > 80 && detailRows.length >= 2 ? 2 : 1;
    fitFlow(ctx, d, compact([
      value ? bigText(d, value, mm(14), ac, { gap: mm(0.3) }) : null,
      value ? txt(unit, 2.7, { color: muted, weight: 700, upper: true, spacing: mm(0.4), gap: mm(2) }) : null,
      txt(desc, 3.0, { color: tc, maxLines: 3, gap: mm(2.2) }),
      detailsItem(cols, tc, muted, ac),
      txt(valid, 3.0, { color: ac, weight: 800, gap: mm(1.6), maxLines: 2 }),
      termsItem(muted, 2.2),
      txt(footer, 2.2, { color: muted, maxLines: 1 }),
    ]), BR, { align: "center", valign: "middle" });
  }

  // ── 4. Potongan / area kode ──
  if (geo.stub && d.codeMode !== "none" || (geo.stub && (d.stubNote || d.showSerial))) {
    const st = geo.stub!;
    const isStrip = geo.strip;
    const sText = isStrip ? tc : stubText;
    const sMuted = isStrip ? muted : stubMuted;
    const plate = "#ffffff";
    const sPad = Math.min(st.w, st.h) * 0.09 + ppm * 0.8 + borderSafe * 0.6;
    const note = T(d.stubNote);
    const code = rec.code;
    const mode = d.codeMode;
    const payload = T(d.qrPayload) || code;
    const matrix = mode === "qr" || mode === "both" ? buildQrMatrix(payload, d.qrEcc) : null;
    const wantQr = (mode === "qr" || mode === "both") && !!matrix;
    const wantBar = (mode === "barcode" || mode === "both") && barcodeCompatible(code, d.barcodeFormat);
    const showText = d.showCodeText || (!wantQr && !wantBar && mode !== "none");

    const codeTextItem = (size: number, color: string): CustomItem | null => {
      if (!showText || !code) return null;
      return {
        k: "custom",
        gap: mm(1.2),
        measure: (c, w, s) => {
          const sz = fitSize(c, d, code, w, mm(size) * s, { mono: true, weight: 700 });
          const two = c.measureText(code).width > w * 1.0001 && sz < mm(size) * s * 0.5;
          return sz * 1.25 * (two ? 2 : 1);
        },
        draw: (c, x, y, w, s, align) => {
          const sz = fitSize(c, d, code, w, mm(size) * s, { mono: true, weight: 700 });
          c.font = fontFor(d, { mono: true, weight: 700 }, sz);
          c.fillStyle = color;
          c.textBaseline = "top";
          c.textAlign = align;
          const tx = align === "left" ? x : align === "center" ? x + w / 2 : x + w;
          const lines = c.measureText(code).width > w * 1.0001 ? wrapLines(c, code, w) : [code];
          lines.forEach((ln, i) => c.fillText(ln, tx, y + i * sz * 1.25 + sz * 0.05));
        },
      };
    };
    const qrItem = (side: number): CustomItem | null =>
      wantQr && matrix
        ? { k: "custom", gap: mm(1.6), measure: (_c, w, s) => Math.min(side * s, w), draw: (c, x, y, w, s, al) => { const sd = Math.min(side * s, w); const qx = al === "left" ? x : al === "center" ? x + (w - sd) / 2 : x + w - sd; drawQr(c, d, matrix, qx, y, sd, plate); } }
        : null;
    const barItem = (h: number): CustomItem | null =>
      wantBar
        ? { k: "custom", gap: mm(1.4), measure: (_c, _w, s) => h * s, draw: (c, x, y, w, s, al) => { void al; drawBarcode(c, d, code, x, y, w, h * s, isStrip ? tc : mode === "barcode" && d.stubTone === "same" ? tc : "#111827", d.qrPlate ? plate : null); } }
        : null;
    const labelItem = txt(T(d.codeLabel), 2.3, { color: sMuted, weight: 700, upper: true, spacing: mm(0.45), gap: mm(1.4), heading: false, align: undefined });
    const noteItem = note ? ({ k: "text", text: note, size: mm(2.3), color: sMuted, lh: 1.3, maxLines: 3, weight: 500 } as TextItem) : null;

    if (!isStrip && geo.vertical) {
      const R: Rect = { x: st.x + sPad, y: st.y + sPad, w: st.w - sPad * 2, h: st.h - sPad * 2 };
      const qrSide = Math.min(R.w, R.h * 0.52);
      fitFlow(ctx, d, compact([
        labelItem,
        qrItem(qrSide),
        barItem(Math.min(R.h * 0.13, mm(11))),
        codeTextItem(3.4, sText),
        noteItem,
      ]), R, { align: "center", valign: "middle" });
    } else {
      // pita horizontal (bawah / atas / tanpa potongan)
      const R: Rect = { x: st.x + sPad, y: st.y + sPad * 0.8, w: st.w - sPad * 2, h: st.h - sPad * 1.6 };
      if (wantQr && matrix) {
        const side = Math.min(R.h, R.w * 0.3);
        drawQr(ctx, d, matrix, R.x, R.y + (R.h - side) / 2, side, plate);
        fitFlow(ctx, d, compact([labelItem, barItem(Math.min(R.h * 0.32, mm(10))), codeTextItem(3.2, sText), noteItem]), { x: R.x + side + sPad, y: R.y, w: R.w - side - sPad, h: R.h }, { align: "left", valign: "middle" });
      } else {
        fitFlow(ctx, d, compact([labelItem, barItem(Math.min(R.h * 0.4, mm(11))), codeTextItem(3.6, sText), noteItem]), R, { align: "center", valign: "middle" });
      }
    }

    if (d.showSerial && !isStrip) {
      ctx.save();
      const fs = mm(2);
      ctx.font = fontFor(d, { mono: true, weight: 600 }, fs);
      ctx.fillStyle = sMuted;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      setSpacing(ctx, fs * 0.2);
      if (geo.vertical) {
        const edgeX = d.stub === "right" ? st.x + st.w - fs * 0.9 : st.x + fs * 0.9;
        ctx.translate(edgeX, st.y + st.h / 2);
        ctx.rotate(d.stub === "right" ? Math.PI / 2 : -Math.PI / 2);
      } else {
        ctx.translate(st.x + st.w / 2, d.stub === "bottom" ? st.y + st.h - fs * 0.9 : st.y + fs * 0.9);
      }
      ctx.fillText(`NO. ${PAD4(rec.no)}`, 0, 0);
      setSpacing(ctx, 0);
      ctx.restore();
    }
  }

  // ── 5. Garis perforasi ──
  if (geo.perf) {
    ctx.save();
    ctx.strokeStyle = rgba(onColor(d.stubTone === "accent" || d.stubTone === "dark" ? ac : d.colorBg1), 0.5);
    ctx.lineWidth = Math.max(1.2, ppm * 0.28);
    ctx.setLineDash([ppm * 0.9, ppm * 0.9]);
    ctx.beginPath();
    ctx.moveTo(geo.perf.x1, geo.perf.y1);
    ctx.lineTo(geo.perf.x2, geo.perf.y2);
    ctx.stroke();
    ctx.restore();
  }

  // ── 6. Bingkai ──
  if (d.borderStyle !== "none" && bw > 0) {
    ctx.save();
    ctx.strokeStyle = d.borderColor;
    ctx.lineWidth = bw;
    const extra = d.edge === "plain" ? 0 : 2.6 * ppm;
    if (d.borderStyle === "solid") {
      const ins = bw / 2 + extra;
      roundRect(ctx, ins, ins, W - ins * 2, H - ins * 2, Math.max(0, rr - ins));
      ctx.stroke();
    } else if (d.borderStyle === "double") {
      const i1 = bw / 2 + extra, i2 = i1 + bw * 2.8;
      roundRect(ctx, i1, i1, W - i1 * 2, H - i1 * 2, Math.max(0, rr - i1));
      ctx.stroke();
      ctx.lineWidth = Math.max(1, bw * 0.55);
      roundRect(ctx, i2, i2, W - i2 * 2, H - i2 * 2, Math.max(0, rr - i2));
      ctx.stroke();
    } else if (d.borderStyle === "dashed") {
      const ins = Math.max(bw / 2, 1.6 * ppm) + extra;
      ctx.setLineDash([bw * 3.2, bw * 2.2]);
      roundRect(ctx, ins, ins, W - ins * 2, H - ins * 2, Math.max(0, rr - ins));
      ctx.stroke();
    } else {
      const ins = 2.4 * ppm + extra;
      roundRect(ctx, ins, ins, W - ins * 2, H - ins * 2, Math.max(0, rr - ins));
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── 7. Stempel diagonal ──
  const stamp = T(d.stampText);
  if (stamp) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.28);
    ctx.globalAlpha = Math.min(1, Math.max(0, d.stampOpacity));
    const fs = Math.min(H * 0.34, mm(24));
    ctx.font = fontFor(d, { heading: true, weight: 800 }, fs);
    setSpacing(ctx, fs * 0.08);
    const tw = Math.min(W * 0.8, ctx.measureText(stamp.toUpperCase()).width);
    const fit = Math.min(1, (W * 0.8) / Math.max(1, ctx.measureText(stamp.toUpperCase()).width));
    ctx.scale(fit, fit);
    ctx.strokeStyle = d.stampColor;
    ctx.fillStyle = d.stampColor;
    ctx.lineWidth = Math.max(3, fs * 0.07);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const bwid = ctx.measureText(stamp.toUpperCase()).width + fs * 0.7;
    roundRect(ctx, -bwid / 2, -fs * 0.72, bwid, fs * 1.44, fs * 0.16);
    ctx.stroke();
    ctx.fillText(stamp.toUpperCase(), 0, fs * 0.04);
    setSpacing(ctx, 0);
    void tw;
    ctx.restore();
  }

  ctx.restore(); // akhir clip bentuk

  // ── 8. Notch perforasi & tepi bergerigi (dilubangi sungguhan → transparan) ──
  const notchR = Math.max(0, d.notchRadius) * ppm;
  const avoid: { x: number; y: number; r: number }[] = [];
  const notchCenters: [number, number][] = [];
  if (d.notch && geo.perf && notchR > 0) {
    notchCenters.push([geo.perf.x1, geo.perf.y1], [geo.perf.x2, geo.perf.y2]);
    for (const [cx, cy] of notchCenters) avoid.push({ x: cx, y: cy, r: notchR });
  }
  const holes = d.edge !== "plain" ? edgeHoles(W, H, d.edge, ppm, rr, avoid) : null;

  if (notchCenters.length || holes) {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
    for (const [cx, cy] of notchCenters) { ctx.beginPath(); ctx.arc(cx, cy, notchR, 0, Math.PI * 2); ctx.fill(); }
    if (holes) ctx.fill(holes.fill);
    ctx.restore();

    if (d.borderStyle !== "none" && bw > 0) {
      ctx.save();
      shapePath(ctx, W, H, rr);
      ctx.clip();
      ctx.strokeStyle = d.borderColor;
      ctx.lineWidth = Math.max(1.5, bw * 0.8);
      for (const [cx, cy] of notchCenters) { ctx.beginPath(); ctx.arc(cx, cy, notchR, 0, Math.PI * 2); ctx.stroke(); }
      if (holes) ctx.stroke(holes.stroke);
      ctx.restore();
    }
  }
}

/** Isi contoh (untuk thumbnail template & pratinjau awal). */
export function sampleRecord(): CouponRecord {
  return { no: 1, code: "GMT-7K2Q-X9PD", fields: { nama: "Budi Santoso", kursi: "A-12", zona: "VIP", kategori: "VIP" } };
}
