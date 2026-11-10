// Mesin render Name Tag Studio (Spesial > Name Tag): fungsi gambar murni, tanpa React.
// Memakai ulang primitif latar/bentuk/gambar dari businessCardEngine; menambah:
//  • teks cerdas (kecilkan otomatis / bungkus baris) agar nama panjang selalu muat,
//  • warna otomatis menurut PERAN (pita/teks berubah per orang),
//  • elemen Foto per orang, QR (kotak/titik) & barcode dengan token data,
//  • panduan lubang tali (lanyard) dan resolusi variabel (300/600 dpi).

import qrcode from "qrcode-generator";
import JsBarcode from "jsbarcode";
import { ensureFontReady, roundRect } from "@/lib/businessDocCanvas";
import { fontStack } from "@/lib/fontPresets";
import { drawBackground, drawImageElement, drawShapeElement, loadImageCached } from "@/lib/businessCardEngine";
import type { CardImageElement, CardShapeElement } from "@/lib/businessCardTypes";
import {
  PX_PER_MM, fillTokens, resolveNtSizeMM, roleColor,
  type NametagDesign, type NtBarcodeEl, type NtPhotoEl, type NtQrEl, type NtRecord, type NtSide, type NtTextEl,
} from "@/lib/nametagTypes";

export type NtHoleMode = "none" | "guide" | "mark";
export interface NtRenderOpts { ppm?: number; hole?: NtHoleMode }

/** Penanda “sengaja kosong” — dibuang dari payload QR/barcode. */
const ZWSP = /\u200B/g;

export function ntPixelSize(design: Pick<NametagDesign, "sizeId" | "customWMM" | "customHMM">, ppm = PX_PER_MM) {
  const { wMM, hMM } = resolveNtSizeMM(design);
  return { w: Math.round(wMM * ppm), h: Math.round(hMM * ppm), wMM, hMM };
}

// ── QR ───────────────────────────────────────────────────────────────────

let utf8Ready = false;
function ensureUtf8() {
  if (utf8Ready) return;
  const q = qrcode as unknown as { stringToBytes: unknown; stringToBytesFuncs?: Record<string, unknown> };
  if (q.stringToBytesFuncs?.["UTF-8"]) q.stringToBytes = q.stringToBytesFuncs["UTF-8"];
  utf8Ready = true;
}

export function qrMatrix(text: string, ecc: "L" | "M" | "Q" | "H"): boolean[][] | null {
  try {
    ensureUtf8();
    const qr = qrcode(0, ecc);
    qr.addData(text, "Byte");
    qr.make();
    const n = qr.getModuleCount();
    const m: boolean[][] = [];
    for (let r = 0; r < n; r++) { const row: boolean[] = []; for (let c = 0; c < n; c++) row.push(qr.isDark(r, c)); m.push(row); }
    return m;
  } catch { return null; }
}

function drawQr(ctx: CanvasRenderingContext2D, el: NtQrEl, rec: NtRecord, w: number, h: number) {
  const payload = fillTokens(el.payload, cleanRec(rec)).trim();
  const m = payload ? qrMatrix(payload, el.ecc) : null;
  const S = Math.max(8, Math.round((el.sizePct / 100) * w));
  ctx.save();
  ctx.translate((el.xPct / 100) * w, (el.yPct / 100) * h);
  if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.globalAlpha = el.opacity;
  ctx.translate(-S / 2, -S / 2);
  if (el.plate) { ctx.fillStyle = el.bg; ctx.fillRect(0, 0, S, S); }
  if (!m) {
    // data kosong/terlalu panjang → kotak putus-putus sebagai penanda
    ctx.strokeStyle = "#94a3b8"; ctx.setLineDash([S / 14, S / 14]); ctx.lineWidth = Math.max(1, S / 60); ctx.strokeRect(1, 1, S - 2, S - 2);
    ctx.restore();
    return;
  }
  const n = m.length;
  const quiet = el.plate ? 2 : 0;
  const ms = S / (n + quiet * 2);
  const off = quiet * ms;
  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  ctx.fillStyle = el.fg;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!m[r][c]) continue;
      const x0 = off + c * ms, y0 = off + r * ms;
      if (el.style === "dots" && !inFinder(r, c)) {
        ctx.beginPath(); ctx.arc(x0 + ms / 2, y0 + ms / 2, ms * 0.46, 0, Math.PI * 2); ctx.fill();
      } else {
        const xa = Math.round(x0), ya = Math.round(y0);
        ctx.fillRect(xa, ya, Math.round(x0 + ms) - xa, Math.round(y0 + ms) - ya);
      }
    }
  }
  ctx.restore();
}

// ── Barcode (CODE128) ────────────────────────────────────────────────────

function drawBarcode(ctx: CanvasRenderingContext2D, el: NtBarcodeEl, rec: NtRecord, w: number, h: number) {
  const code = fillTokens(el.payload, cleanRec(rec)).trim();
  const bw = Math.round((el.widthPct / 100) * w), bh = Math.round((el.heightPct / 100) * h);
  ctx.save();
  ctx.translate((el.xPct / 100) * w, (el.yPct / 100) * h);
  if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.globalAlpha = el.opacity;
  if (el.plate) { ctx.fillStyle = "#ffffff"; ctx.fillRect(-bw / 2, -bh / 2, bw, bh); }
  try {
    if (!code) throw new Error("kosong");
    const probe = document.createElement("canvas");
    JsBarcode(probe, code, { format: "CODE128", width: 1, height: 10, margin: 0, displayValue: false });
    const mw = Math.max(1, Math.floor(bw / Math.max(1, probe.width)));
    const cv = document.createElement("canvas");
    JsBarcode(cv, code, { format: "CODE128", width: mw, height: Math.max(8, bh), margin: 0, displayValue: false, lineColor: el.color, background: "rgba(0,0,0,0)" });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, -cv.width / 2, -bh / 2, cv.width, bh);
  } catch {
    ctx.strokeStyle = "#94a3b8"; ctx.setLineDash([6, 6]); ctx.lineWidth = 1; ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
  }
  ctx.restore();
}

// ── Foto ─────────────────────────────────────────────────────────────────

function pathFor(ctx: CanvasRenderingContext2D, shape: NtPhotoEl["shape"], x: number, y: number, bw: number, bh: number) {
  ctx.beginPath();
  if (shape === "circle") ctx.ellipse(x + bw / 2, y + bh / 2, Math.max(0, bw / 2), Math.max(0, bh / 2), 0, 0, Math.PI * 2);
  else roundRect(ctx, x, y, bw, bh, shape === "rounded" ? Math.min(bw, bh) * 0.12 : 0);
}

function drawPhoto(ctx: CanvasRenderingContext2D, el: NtPhotoEl, img: HTMLImageElement | null, color: string, w: number, h: number, k: number) {
  const bw = (el.widthPct / 100) * w, bh = (el.heightPct / 100) * h;
  ctx.save();
  ctx.translate((el.xPct / 100) * w, (el.yPct / 100) * h);
  if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.globalAlpha = el.opacity;
  const x = -bw / 2, y = -bh / 2;
  ctx.save();
  pathFor(ctx, el.shape, x, y, bw, bh);
  ctx.clip();
  if (img) {
    const iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1;
    const sc = Math.max(bw / iw, bh / ih);
    const dw = iw * sc, dh = ih * sc;
    ctx.drawImage(img, x + (bw - dw) / 2, y + (bh - dh) * (el.focusY / 100), dw, dh);
  } else {
    // siluet pengganti bila belum ada foto
    ctx.fillStyle = "#e2e8f0"; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = "#94a3b8";
    const cx = x + bw / 2;
    ctx.beginPath(); ctx.arc(cx, y + bh * 0.38, Math.min(bw, bh) * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, y + bh * 1.02, bw * 0.38, bh * 0.38, 0, Math.PI, 0); ctx.fill();
  }
  ctx.restore();
  if (el.borderWidth > 0) {
    const bwid = el.borderWidth * k;
    ctx.lineWidth = bwid;
    ctx.strokeStyle = el.borderFromRole ? color : el.borderColor;
    pathFor(ctx, el.shape, x + bwid / 2, y + bwid / 2, bw - bwid, bh - bwid);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Teks cerdas ──────────────────────────────────────────────────────────

const clean = (s: string) => s.replace(ZWSP, "");
function cleanRec(r: NtRecord): NtRecord { return { ...r, name: clean(r.name), role: clean(r.role), org: clean(r.org), id: clean(r.id), group: clean(r.group), event: clean(r.event), note: clean(r.note) }; }

function resolveText(el: NtTextEl, rec: NtRecord): string {
  if (el.bind) { const v = rec[el.bind]; return v && v.trim() ? v : el.text; }
  return el.text;
}

interface Laid { lines: string[]; size: number }

function layoutText(ctx: CanvasRenderingContext2D, text: string, el: NtTextEl, boxW: number, basePx: number, ptPx: number): Laid {
  const fontOf = (px: number) => `${el.italic ? "italic" : "normal"} ${el.bold ? "700" : "400"} ${px}px ${fontStack(el.fontFamily)}`;
  const spacingAt = (px: number) => el.letterSpacing * ptPx * (px / basePx);
  const width = (s: string, px: number) => { ctx.font = fontOf(px); return ctx.measureText(s).width + spacingAt(px) * Math.max(0, Array.from(s).length - 1); };
  const src = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (!src) return { lines: [], size: basePx };

  if (el.fit === "none") return { lines: [src], size: basePx };

  if (el.fit === "shrink") {
    const w = width(src, basePx);
    const size = w > boxW ? Math.max(basePx * 0.35, basePx * (boxW / w) * 0.995) : basePx;
    return { lines: [src], size };
  }

  // wrap
  const maxLines = Math.max(1, Math.min(4, Math.round(el.maxLines)));
  const wrapAt = (px: number, splitLong: boolean): string[] => {
    const words = src.split(" ");
    const lines: string[] = [];
    let cur = "";
    const push = () => { if (cur) { lines.push(cur); cur = ""; } };
    for (const wd of words) {
      const trial = cur ? `${cur} ${wd}` : wd;
      if (width(trial, px) <= boxW) { cur = trial; continue; }
      push();
      if (width(wd, px) <= boxW || !splitLong) { cur = wd; continue; }
      let piece = "";
      for (const ch of Array.from(wd)) {
        if (width(piece + ch, px) > boxW && piece) { lines.push(piece); piece = ch; } else piece += ch;
      }
      cur = piece;
    }
    push();
    return lines;
  };
  for (let px = basePx; px >= basePx * 0.45; px *= 0.94) {
    const lines = wrapAt(px, false);
    if (lines.length <= maxLines && lines.every((l) => width(l, px) <= boxW)) return { lines, size: px };
  }
  const px = basePx * 0.45;
  let lines = wrapAt(px, true);
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, "…"); }
  return { lines, size: px };
}

function drawSpaced(ctx: CanvasRenderingContext2D, text: string, spacing: number, align: "left" | "center" | "right", y: number) {
  const chars = Array.from(text);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let x = align === "center" ? -total / 2 : align === "right" ? -total : 0;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  for (let i = 0; i < chars.length; i++) { ctx.fillText(chars[i], x, y); x += widths[i] + spacing; }
  ctx.textAlign = prev;
}

function drawText(ctx: CanvasRenderingContext2D, el: NtTextEl, rec: NtRecord, design: NametagDesign, w: number, h: number, ptPx: number) {
  const raw = resolveText(el, rec);
  if (!raw || !clean(raw).trim()) return;
  const text = el.uppercase ? raw.toUpperCase() : raw;
  const basePx = el.fontSize * ptPx;
  const boxW = (el.widthPct / 100) * w;
  const laid = layoutText(ctx, text, el, boxW, basePx, ptPx);
  if (!laid.lines.length) return;

  ctx.save();
  ctx.translate((el.xPct / 100) * w, (el.yPct / 100) * h);
  if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
  ctx.globalAlpha = el.opacity;
  ctx.font = `${el.italic ? "italic" : "normal"} ${el.bold ? "700" : "400"} ${laid.size}px ${fontStack(el.fontFamily)}`;
  ctx.fillStyle = el.colorFromRole ? roleColor(design, rec.role) : el.color;
  ctx.textBaseline = "middle";
  ctx.textAlign = el.align;
  const lh = laid.size * 1.18;
  const y0 = -((laid.lines.length - 1) * lh) / 2;
  const spacing = el.letterSpacing * ptPx * (laid.size / basePx);
  laid.lines.forEach((ln, i) => {
    const y = y0 + i * lh;
    if (spacing > 0) drawSpaced(ctx, ln, spacing, el.align, y);
    else ctx.fillText(ln, 0, y);
  });
  ctx.restore();
}

// ── Lubang tali ──────────────────────────────────────────────────────────

export function holeGeometry(design: Pick<NametagDesign, "hole" | "sizeId" | "customWMM" | "customHMM">, ppm: number) {
  const { wMM, hMM } = resolveNtSizeMM(design);
  const hl = design.hole;
  if (hl.shape === "none") return null;
  const long = hl.shape === "slot" ? 14 : 5, short = hl.shape === "slot" ? 3.5 : 5;
  const vertical = hl.edge === "left";
  const wm = vertical ? short : long, hm = vertical ? long : short;
  const cx = hl.edge === "top" ? wMM / 2 : hl.offsetMM;
  const cy = hl.edge === "top" ? hl.offsetMM : hMM / 2;
  return { x: (cx - wm / 2) * ppm, y: (cy - hm / 2) * ppm, w: wm * ppm, h: hm * ppm, r: Math.min(wm, hm) * ppm / 2 };
}

function drawHole(ctx: CanvasRenderingContext2D, design: NametagDesign, mode: NtHoleMode, ppm: number) {
  if (mode === "none") return;
  const g = holeGeometry(design, ppm);
  if (!g) return;
  ctx.save();
  const path = () => { ctx.beginPath(); roundRect(ctx, g.x, g.y, g.w, g.h, g.r); };
  if (mode === "guide") {
    path(); ctx.fillStyle = "rgba(15,23,42,0.30)"; ctx.fill();
    path(); ctx.setLineDash([ppm * 0.9, ppm * 0.6]); ctx.lineWidth = Math.max(1.5, ppm * 0.28); ctx.strokeStyle = "#ffffff"; ctx.stroke();
    ctx.lineDashOffset = ppm * 0.45; ctx.strokeStyle = "#ef4444"; path(); ctx.stroke();
  } else {
    path(); ctx.lineWidth = ppm * 0.6; ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.stroke();
    path(); ctx.lineWidth = Math.max(1, ppm * 0.25); ctx.strokeStyle = "#6b7280"; ctx.stroke();
  }
  ctx.restore();
}

// ── Titik masuk ──────────────────────────────────────────────────────────

/**
 * Menggambar satu sisi name tag. Menunggu font & gambar siap sebelum menggambar sehingga
 * kemunculan pertama sudah benar (tanpa kedip font / logo yang telat muncul).
 */
export async function renderNametagSide(
  canvas: HTMLCanvasElement,
  side: NtSide,
  rec: NtRecord,
  design: NametagDesign,
  cache: Map<string, HTMLImageElement>,
  opts: NtRenderOpts = {}
): Promise<void> {
  const ppm = opts.ppm ?? PX_PER_MM;
  const k = ppm / PX_PER_MM;
  const ptPx = (ppm * 25.4) / 72;
  const { w, h } = ntPixelSize(design, ppm);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  const families = new Set<string>();
  for (const el of side.elements) if (el.kind === "text") families.add(el.fontFamily);
  await Promise.all(Array.from(families).flatMap((f) => [ensureFontReady(f, "700"), ensureFontReady(f, "400")]));

  let bgImg: HTMLImageElement | null = null;
  if (side.background.type === "image" && side.background.src) bgImg = await loadImageCached(side.background.src, cache);
  drawBackground(ctx, side.background, w, h, bgImg);

  const photo = rec.photo ? await loadImageCached(rec.photo, cache) : null;
  const rc = roleColor(design, rec.role);

  for (const el of side.elements) {
    if (el.kind === "text") drawText(ctx, el, rec, design, w, h, ptPx);
    else if (el.kind === "shape") {
      const scaled = { ...el, fill: el.fillFromRole ? rc : el.fill, strokeWidth: el.strokeWidth * k, radius: el.radius * k } as unknown as CardShapeElement;
      drawShapeElement(ctx, scaled, w, h);
    } else if (el.kind === "image") await drawImageElement(ctx, el as unknown as CardImageElement, w, h, cache);
    else if (el.kind === "photo") drawPhoto(ctx, el, photo, rc, w, h, k);
    else if (el.kind === "qr") drawQr(ctx, el, rec, w, h);
    else if (el.kind === "barcode") drawBarcode(ctx, el, rec, w, h);
  }
  drawHole(ctx, design, opts.hole ?? "none", ppm);
}
