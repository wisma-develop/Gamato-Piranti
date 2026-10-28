// Rendering engine for the CV Maker (Special > Pembuat CV).
//
// Design notes (read before touching pagination logic):
// - Each page is a fixed A4 bitmap: 1240×1754 px at 1× (150 dpi). `scale` (R)
//   multiplies the bitmap for crisp export (2× = 300 dpi) WITHOUT touching layout:
//   every coordinate below is "logical" and mapped by ctx.setTransform.
// - `textScale` (Z) is a zoom of the page content: the logical page is
//   (1240/Z) × (1754/Z), so every font size scales with Z. Structural sizes
//   (sidebar width, band height, avatar radius…) are specified in PHYSICAL px
//   and converted with S() so they stay the same visual size at any Z.
// - "Aside" content (photo, contact block, skill list, languages) for the
//   sidebar/accent/band/split templates is drawn ONCE on page 1 only and is capped
//   to a sane item count (documented simplification, keeps pagination
//   deterministic). The "main flow" is fully paginated; continuation pages (2+)
//   become a plain full-width column with a small "Lanjutan" header.
// - Single-column templates (minimal, timeline, elegant, banner) put
//   skills/languages in the paginated column — nothing can overlap or clip.
// - Rendering is fully synchronous after the font awaits, so concurrent renders
//   can never interleave on shared state (module-level layout variables below).

import { wrapText, drawWrappedText, roundRect, ensureFontReady } from "@/lib/businessDocCanvas";
import {
  SECTION_TITLES_ID,
  type CvData,
  type CvTemplateId,
  type SectionKey,
  type SkillItem,
  type LangItem,
  type PhotoShape,
} from "@/lib/cvTypes";

export const CV_PAGE_W = 1240;
export const CV_PAGE_H = 1754;
const MM_PX = 150 / 25.4; // piksel per mm pada 150 dpi

// ── Module-level layout state (set by setupEnv at the start of every build) ──
let FONT = "'Alan Sans', sans-serif";
let Z = 1;
let PW = CV_PAGE_W;
let PH = CV_PAGE_H;
let MARGIN = 64;
let BOTTOM_LIMIT = CV_PAGE_H - 64;
let LS = 1; // line-spacing multiplier
let SS = 1; // section-spacing multiplier
let TXT = "#334155";
let HEADING: CvData["headingStyle"] = "bar";
let SKILL_STYLE: CvData["skillStyle"] = "bars";
let TITLES: Record<SectionKey, string> = SECTION_TITLES_ID;
let RSCALE = 1;
let RECORD = false;

/** Physical (1240-wide page) px → logical px at the current zoom. */
const S = (v: number) => v / Z;

function setupEnv(data: CvData, z: number, scale: number, record: boolean) {
  FONT = data.fontFamily && data.fontFamily.trim() ? `'${data.fontFamily.trim()}', sans-serif` : "'Alan Sans', sans-serif";
  Z = Math.min(1.7, Math.max(0.6, z));
  PW = CV_PAGE_W / Z;
  PH = CV_PAGE_H / Z;
  MARGIN = (Math.min(25, Math.max(6, data.marginMm)) * MM_PX) / Z;
  BOTTOM_LIMIT = PH - MARGIN;
  LS = data.lineSpacing;
  SS = data.sectionSpacing;
  TXT = /^#[0-9a-f]{6}$/i.test(data.textColor || "") ? data.textColor : "#334155";
  HEADING = data.headingStyle;
  SKILL_STYLE = data.skillStyle;
  TITLES = { ...SECTION_TITLES_ID };
  for (const [k, v] of Object.entries(data.sectionTitles || {})) {
    if (typeof v === "string" && v.trim()) TITLES[k as SectionKey] = v.trim();
  }
  RSCALE = scale;
  RECORD = record;
}

// ── Text-run recorder (dipakai PDF agar teks bisa dipilih / terbaca ATS) ──

export interface CvTextRun {
  text: string;
  x: number; // piksel kanvas
  y: number;
  size: number; // piksel kanvas
  bold: boolean;
  italic: boolean;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  width: number; // lebar terukur, piksel kanvas
}

const runsMap = new WeakMap<HTMLCanvasElement, CvTextRun[]>();
export function getCvTextRuns(canvas: HTMLCanvasElement): CvTextRun[] {
  return runsMap.get(canvas) ?? [];
}

function attachRecorder(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const runs: CvTextRun[] = [];
  runsMap.set(canvas, runs);
  const orig = ctx.fillText.bind(ctx);
  (ctx as any).fillText = (text: string, x: number, y: number, maxWidth?: number) => {
    if (text && String(text).trim()) {
      const m = ctx.getTransform();
      const sizeMatch = /([\d.]+)px/.exec(ctx.font);
      const px = sizeMatch ? parseFloat(sizeMatch[1]) : 12;
      runs.push({
        text: String(text),
        x: m.a * x + m.e,
        y: m.d * y + m.f,
        size: px * m.a,
        bold: /(^|\s)(600|700|800|900|bold)(\s|$)/.test(ctx.font),
        italic: /italic/.test(ctx.font),
        align: ctx.textAlign,
        baseline: ctx.textBaseline,
        width: ctx.measureText(String(text)).width * m.a,
      });
    }
    if (maxWidth === undefined) orig(text, x, y);
    else orig(text, x, y, maxWidth);
  };
}

// ── Low-level helpers ─────────────────────────────────────────────────────

function newBlankPage(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(CV_PAGE_W * RSCALE);
  canvas.height = Math.round(CV_PAGE_H * RSCALE);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(RSCALE * Z, 0, 0, RSCALE * Z, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PW + 1, PH + 1);
  ctx.textBaseline = "alphabetic";
  if (RECORD) attachRecorder(canvas, ctx);
  return canvas;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return [79, 70, 229];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shapePath(ctx: CanvasRenderingContext2D, shape: PhotoShape, cx: number, cy: number, r: number) {
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else {
    const rad = shape === "rounded" ? r * 0.28 : 0;
    ctx.rect(cx - r, cy - r, r * 2, r * 2);
    if (rad > 0) roundRect(ctx, cx - r, cy - r, r * 2, r * 2, rad);
  }
  ctx.closePath();
}

interface PhotoOpts {
  shape: PhotoShape;
  zoom: number;
  offX: number;
  offY: number;
}

/** Foto profil (atau inisial bila tanpa foto) dengan bentuk, zoom & geser yang bisa diatur. */
function drawPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  cx: number,
  cy: number,
  r: number,
  opts: PhotoOpts,
  ringColor: string,
  bgColor: string,
  fgColor: string,
  allowInitials: boolean
) {
  if (!img && !allowInitials) return;
  const ring = Math.max(2, S(4));
  if (img) {
    // Cincin solid di belakang foto (foto menutup bagian dalamnya).
    ctx.save();
    shapePath(ctx, opts.shape, cx, cy, r + ring);
    ctx.fillStyle = ringColor;
    ctx.fill();
    ctx.restore();
  }

  if (img) {
    ctx.save();
    shapePath(ctx, opts.shape, cx, cy, r);
    ctx.clip();
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const side = Math.min(iw, ih) / Math.max(1, opts.zoom);
    const sx = (iw - side) / 2 + opts.offX * ((iw - side) / 2);
    const sy = (ih - side) / 2 + opts.offY * ((ih - side) / 2);
    ctx.drawImage(img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } else {
    // Tanpa foto: lingkaran inisial (isi transparan di atas warna aksen) + cincin sebagai garis.
    ctx.save();
    shapePath(ctx, opts.shape, cx, cy, r);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.lineWidth = ring;
    ctx.strokeStyle = ringColor;
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(r * 0.7)}px ${FONT}`;
    ctx.fillStyle = fgColor;
    ctx.fillText(initials(name), cx, cy + 2);
    ctx.textBaseline = "alphabetic";
  }
}

const photoOpts = (d: CvData): PhotoOpts => ({ shape: d.photoShape, zoom: d.photoZoom, offX: d.photoX, offY: d.photoY });
const hasPhoto = (d: CvData, photo: HTMLImageElement | null) => !!photo && d.showPhoto;

// ── Flow cursor: drives the paginated main content column ────────────────

interface ColumnSpec {
  x: number;
  w: number;
}

interface FlowCursor {
  pages: HTMLCanvasElement[];
  ctx: CanvasRenderingContext2D;
  x: number;
  w: number;
  y: number;
  bottom: number;
  pageIndex: number;
  fullCol: ColumnSpec;
  drawContinuationHeader: (ctx: CanvasRenderingContext2D, pageNumber: number) => number;
  accent: string;
  /** True for the Linimasa template — draws a small dot marker before each entry title. */
  timelineMode: boolean;
  /** Cara menampilkan keahlian/bahasa di kolom tunggal. */
  inline: "text" | "chips";
}

function ensureSpace(cursor: FlowCursor, needed: number) {
  if (cursor.y + needed > cursor.bottom) addPage(cursor);
}

function addPage(cursor: FlowCursor) {
  const page = newBlankPage();
  cursor.pages.push(page);
  cursor.ctx = page.getContext("2d")!;
  cursor.pageIndex += 1;
  cursor.x = cursor.fullCol.x;
  cursor.w = cursor.fullCol.w;
  cursor.y = cursor.drawContinuationHeader(cursor.ctx, cursor.pageIndex + 1);
  cursor.bottom = BOTTOM_LIMIT;
}

function drawSectionTitle(cursor: FlowCursor, title: string) {
  ensureSpace(cursor, 56);
  const ctx = cursor.ctx;
  const label = title.toUpperCase();
  ctx.textAlign = "left";
  if (HEADING === "bar") {
    ctx.fillStyle = cursor.accent;
    ctx.fillRect(cursor.x, cursor.y - 15, 5, 20);
    ctx.font = `700 16.5px ${FONT}`;
    ctx.fillStyle = "#0f172a";
    ctx.fillText(label, cursor.x + 14, cursor.y);
    cursor.y += 12;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cursor.x, cursor.y);
    ctx.lineTo(cursor.x + cursor.w, cursor.y);
    ctx.stroke();
    cursor.y += 22;
  } else if (HEADING === "underline") {
    ctx.font = `700 16.5px ${FONT}`;
    ctx.fillStyle = cursor.accent;
    ctx.fillText(label, cursor.x, cursor.y);
    cursor.y += 10;
    ctx.strokeStyle = cursor.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursor.x, cursor.y);
    ctx.lineTo(cursor.x + cursor.w, cursor.y);
    ctx.stroke();
    cursor.y += 22;
  } else if (HEADING === "plain") {
    ctx.font = `700 16.5px ${FONT}`;
    ctx.fillStyle = cursor.accent;
    ctx.fillText(label, cursor.x, cursor.y);
    cursor.y += 22;
  } else {
    // centered
    ctx.font = `700 15.5px ${FONT}`;
    const tw = ctx.measureText(label).width;
    const cx = cursor.x + cursor.w / 2;
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, cursor.y);
    ctx.textAlign = "left";
    ctx.strokeStyle = rgba(cursor.accent, 0.55);
    ctx.lineWidth = 1;
    const lineY = cursor.y - 5;
    const gap = 16;
    ctx.beginPath();
    ctx.moveTo(cursor.x, lineY);
    ctx.lineTo(cx - tw / 2 - gap, lineY);
    ctx.moveTo(cx + tw / 2 + gap, lineY);
    ctx.lineTo(cursor.x + cursor.w, lineY);
    ctx.stroke();
    cursor.y += 24;
  }
}

function drawParagraphFlow(cursor: FlowCursor, text: string, opts?: { fontSize?: number; color?: string; lineHeight?: number; align?: "left" | "center" }) {
  const fontSize = opts?.fontSize ?? 13.5;
  const color = opts?.color ?? TXT;
  const lineHeight = (opts?.lineHeight ?? 19) * LS;
  const measureCtx = cursor.ctx;
  measureCtx.font = `400 ${fontSize}px ${FONT}`;
  const rawLines = text.split(/\r?\n/);
  for (const raw of rawLines) {
    const wrapped = raw.trim() ? wrapText(measureCtx, raw, cursor.w) : [""];
    for (const ln of wrapped) {
      ensureSpace(cursor, lineHeight);
      const ctx = cursor.ctx;
      ctx.font = `400 ${fontSize}px ${FONT}`;
      ctx.fillStyle = color;
      ctx.textAlign = opts?.align === "center" ? "center" : "left";
      if (ln) ctx.fillText(ln, opts?.align === "center" ? cursor.x + cursor.w / 2 : cursor.x, cursor.y);
      ctx.textAlign = "left";
      cursor.y += lineHeight;
    }
  }
}

function drawBulletsFlow(cursor: FlowCursor, description: string) {
  const items = description.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!items.length) return;
  const indent = 16;
  const fontSize = 13;
  const lineHeight = 18.5 * LS;
  const measureCtx = cursor.ctx;
  measureCtx.font = `400 ${fontSize}px ${FONT}`;
  for (const item of items) {
    const wrapped = wrapText(measureCtx, item, cursor.w - indent);
    wrapped.forEach((ln, i) => {
      ensureSpace(cursor, lineHeight);
      const ctx = cursor.ctx;
      ctx.font = `400 ${fontSize}px ${FONT}`;
      ctx.fillStyle = TXT;
      ctx.textAlign = "left";
      if (i === 0) {
        ctx.fillStyle = cursor.accent;
        ctx.beginPath();
        ctx.arc(cursor.x + 4, cursor.y - 4, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = TXT;
      }
      ctx.fillText(ln, cursor.x + indent, cursor.y);
      cursor.y += lineHeight;
    });
  }
}

function drawEntryTitleRow(cursor: FlowCursor, title: string, period: string) {
  ensureSpace(cursor, 22);
  const ctx = cursor.ctx;
  ctx.textAlign = "left";
  ctx.font = `600 11.5px ${FONT}`;
  const periodW = period ? ctx.measureText(period).width : 0;
  ctx.font = `700 14.5px ${FONT}`;
  ctx.fillStyle = "#0f172a";
  const titleMaxW = cursor.w - (periodW ? periodW + 16 : 0);
  ctx.fillText(truncateText(ctx, title || "-", titleMaxW), cursor.x, cursor.y);
  if (period) {
    ctx.font = `600 11.5px ${FONT}`;
    ctx.fillStyle = cursor.accent;
    ctx.textAlign = "right";
    ctx.fillText(period, cursor.x + cursor.w, cursor.y);
    ctx.textAlign = "left";
  }
  cursor.y += 19 * LS;
}

function drawEntrySubtitle(cursor: FlowCursor, subtitle: string, color = "#64748b") {
  if (!subtitle.trim()) return;
  ensureSpace(cursor, 19);
  const ctx = cursor.ctx;
  ctx.font = `600 12.5px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.fillText(truncateText(ctx, subtitle, cursor.w), cursor.x, cursor.y);
  cursor.y += 20 * LS;
}

function drawTimelineDot(cursor: FlowCursor) {
  const ctx = cursor.ctx;
  ctx.fillStyle = cursor.accent;
  ctx.beginPath();
  ctx.arc(cursor.x - 15, cursor.y - 5, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(cursor.accent, 0.35);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cursor.x - 15, cursor.y - 5, 8, 0, Math.PI * 2);
  ctx.stroke();
}

// ── Skill rendering (shared by aside blocks and inline grid) ─────────────

function skillHeight(style: CvData["skillStyle"]): number {
  return style === "bars" ? 34 : style === "dots" ? 22 : 20;
}

function drawOneSkill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  s: SkillItem,
  style: CvData["skillStyle"],
  accent: string,
  labelColor: string,
  trackColor: string
): number {
  ctx.textAlign = "left";
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = labelColor;
  if (style === "text") {
    ctx.fillText(truncateText(ctx, s.name, w), x, y);
    return y + skillHeight(style);
  }
  if (style === "dots") {
    const dotsW = 5 * 11;
    ctx.fillText(truncateText(ctx, s.name, w - dotsW - 8), x, y);
    const filled = Math.max(1, Math.min(5, Math.round((s.level || 0) / 20)));
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(x + w - dotsW + i * 11 + 4.5, y - 4, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = i < filled ? accent : trackColor;
      ctx.fill();
    }
    return y + skillHeight(style);
  }
  ctx.fillText(truncateText(ctx, s.name, w), x, y);
  const by = y + 9;
  const barH = 6;
  ctx.fillStyle = trackColor;
  roundRect(ctx, x, by, w, barH, 3);
  ctx.fill();
  ctx.fillStyle = accent;
  const pct = Math.min(100, Math.max(4, s.level || 0));
  roundRect(ctx, x, by, Math.max(8, (w * pct) / 100), barH, 3);
  ctx.fill();
  return y + skillHeight(style);
}

function drawSkillListBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  skills: SkillItem[],
  accent: string,
  labelColor: string,
  trackColor: string,
  cap = 10
): number {
  let cy = y;
  const named = skills.filter((s) => s.name.trim());
  const shown = named.slice(0, cap);
  for (const s of shown) cy = drawOneSkill(ctx, x, cy, w, s, SKILL_STYLE, accent, labelColor, trackColor);
  const rest = named.length - shown.length;
  if (rest > 0) {
    ctx.font = `500 10.5px ${FONT}`;
    ctx.fillStyle = rgba(labelColor === "#ffffff" ? "#ffffff" : "#64748b", 0.75);
    ctx.fillText(`+${rest} keahlian lainnya`, x, cy);
    cy += 16;
  }
  return cy;
}

function drawLanguagesBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  languages: LangItem[],
  labelColor: string,
  mutedColor: string,
  cap = 8
): number {
  let cy = y;
  const shown = languages.filter((l) => l.name.trim()).slice(0, cap);
  for (const l of shown) {
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = "left";
    ctx.fillText(truncateText(ctx, l.name, w * 0.62), x, cy);
    ctx.font = `400 11px ${FONT}`;
    ctx.fillStyle = mutedColor;
    ctx.textAlign = "right";
    ctx.fillText(l.level || "", x + w, cy);
    ctx.textAlign = "left";
    cy += 22;
  }
  return cy;
}

/** Grid dua kolom untuk gaya titik/garis di kolom tunggal (dengan paginasi). */
function drawSkillGridFlow(cursor: FlowCursor, skills: SkillItem[]) {
  const named = skills.filter((s) => s.name.trim());
  const colGap = 28;
  const colW = (cursor.w - colGap) / 2;
  const rowH = skillHeight(SKILL_STYLE) + 4;
  for (let i = 0; i < named.length; i += 2) {
    ensureSpace(cursor, rowH);
    const ctx = cursor.ctx;
    drawOneSkill(ctx, cursor.x, cursor.y, colW, named[i], SKILL_STYLE, cursor.accent, "#0f172a", "#e2e8f0");
    if (named[i + 1]) drawOneSkill(ctx, cursor.x + colW + colGap, cursor.y, colW, named[i + 1], SKILL_STYLE, cursor.accent, "#0f172a", "#e2e8f0");
    cursor.y += rowH;
  }
}

// ── Chip-row helper ───────────────────────────────────────────────────────

function layoutChipRows(ctx: CanvasRenderingContext2D, items: string[], maxWidth: number): string[][] {
  ctx.font = `600 12.5px ${FONT}`;
  const rows: string[][] = [];
  let row: string[] = [];
  let rowW = 0;
  const padX = 14;
  const gapX = 8;
  for (const label of items) {
    if (!label.trim()) continue;
    const chipW = ctx.measureText(label).width + padX * 2;
    if (row.length && rowW + gapX + chipW > maxWidth) {
      rows.push(row);
      row = [];
      rowW = 0;
    }
    row.push(label);
    rowW += (row.length > 1 ? gapX : 0) + chipW;
  }
  if (row.length) rows.push(row);
  return rows;
}

function drawChipRowsFlow(cursor: FlowCursor, rows: string[][], fillColor: string, textColor: string) {
  const chipH = 27;
  const padX = 14;
  const gapX = 8;
  const gapY = 10;
  for (const row of rows) {
    ensureSpace(cursor, chipH + gapY);
    const ctx = cursor.ctx;
    ctx.font = `600 12px ${FONT}`;
    let x = cursor.x;
    for (const label of row) {
      const w = ctx.measureText(label).width + padX * 2;
      ctx.fillStyle = fillColor;
      roundRect(ctx, x, cursor.y - chipH + 7, w, chipH, chipH / 2);
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + padX, cursor.y - chipH / 2 + 7);
      ctx.textBaseline = "alphabetic";
      x += w + gapX;
    }
    cursor.y += chipH + gapY - 7;
  }
}

// ── Contact helpers ───────────────────────────────────────────────────────

function contactLines(data: CvData): string[] {
  return [data.email, data.phone, data.address, data.website].map((s) => s.trim()).filter(Boolean);
}

function extraInfoLines(data: CvData): string[] {
  return (data.extraInfo || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

function headerItems(data: CvData): string[] {
  return [...contactLines(data), ...extraInfoLines(data)];
}

/** Membungkus item-item kontak menjadi beberapa baris (dipisah `sep`) agar tidak pernah meluber dari halaman. */
function wrapItemsRow(ctx: CanvasRenderingContext2D, items: string[], sep: string, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const it of items) {
    const test = cur ? `${cur}${sep}${it}` : it;
    if (cur && ctx.measureText(test).width > maxW) {
      lines.push(cur);
      cur = it;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function parseInterests(text: string): string[] {
  return (text || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

// ── Section flow orchestration (shared by all templates) ─────────────────

function sectionTitle(_data: CvData, key: SectionKey): string {
  return TITLES[key];
}

function gap(cursor: FlowCursor, n: number) {
  cursor.y += n * SS;
}

function runMainFlow(cursor: FlowCursor, data: CvData, opts?: { includeSkillsLangs?: boolean }) {
  const hidden = new Set(data.hiddenSections);
  for (const key of data.sectionOrder) {
    if (hidden.has(key)) continue;
    switch (key) {
      case "summary": {
        if (!data.summary.trim()) break;
        drawSectionTitle(cursor, sectionTitle(data, key));
        drawParagraphFlow(cursor, data.summary);
        gap(cursor, 16);
        break;
      }
      case "skills": {
        if (!opts?.includeSkillsLangs) break;
        const named = data.skills.filter((s) => s.name.trim());
        if (!named.length) break;
        drawSectionTitle(cursor, sectionTitle(data, key));
        if (cursor.inline === "chips") {
          drawChipRowsFlow(cursor, layoutChipRows(cursor.ctx, named.map((s) => s.name), cursor.w), rgba(cursor.accent, 0.12), cursor.accent);
        } else if (SKILL_STYLE === "dots") {
          drawSkillGridFlow(cursor, named);
        } else {
          drawParagraphFlow(cursor, named.map((s) => s.name).join("  •  "), { fontSize: 13 });
        }
        gap(cursor, cursor.inline === "chips" ? 12 : 16);
        break;
      }
      case "languages": {
        if (!opts?.includeSkillsLangs) break;
        const langs = data.languages.filter((l) => l.name.trim());
        if (!langs.length) break;
        drawSectionTitle(cursor, sectionTitle(data, key));
        if (cursor.inline === "chips") {
          drawChipRowsFlow(cursor, layoutChipRows(cursor.ctx, langs.map((l) => `${l.name} · ${l.level || "-"}`), cursor.w), "#f1f5f9", "#334155");
        } else {
          drawParagraphFlow(cursor, langs.map((l) => `${l.name} (${l.level || "-"})`).join("  •  "), { fontSize: 13 });
        }
        gap(cursor, cursor.inline === "chips" ? 12 : 16);
        break;
      }
      case "experience": {
        const items = data.experience.filter((e) => e.role.trim() || e.company.trim());
        if (!items.length) break;
        drawSectionTitle(cursor, sectionTitle(data, key));
        items.forEach((exp, idx) => {
          ensureSpace(cursor, 66);
          if (cursor.timelineMode) drawTimelineDot(cursor);
          const titleText = [exp.role, exp.location].filter(Boolean).join(" — ") || exp.role || "-";
          drawEntryTitleRow(cursor, titleText, exp.period);
          drawEntrySubtitle(cursor, exp.company);
          drawBulletsFlow(cursor, exp.description);
          if (idx < items.length - 1) gap(cursor, 14);
        });
        gap(cursor, 18);
        break;
      }
      case "education": {
        const items = data.education.filter((e) => e.degree.trim() || e.school.trim());
        if (!items.length) break;
        drawSectionTitle(cursor, sectionTitle(data, key));
        items.forEach((edu, idx) => {
          ensureSpace(cursor, 66);
          if (cursor.timelineMode) drawTimelineDot(cursor);
          drawEntryTitleRow(cursor, edu.degree || "-", edu.period);
          drawEntrySubtitle(cursor, edu.school);
          drawBulletsFlow(cursor, edu.description);
          if (idx < items.length - 1) gap(cursor, 14);
        });
        gap(cursor, 18);
        break;
      }
      case "projects": {
        const items = data.projects.filter((p) => p.name.trim());
        if (!items.length) break;
        drawSectionTitle(cursor, sectionTitle(data, key));
        items.forEach((p, idx) => {
          ensureSpace(cursor, 66);
          if (cursor.timelineMode) drawTimelineDot(cursor);
          drawEntryTitleRow(cursor, p.name, p.period);
          drawEntrySubtitle(cursor, p.role);
          if (p.link.trim()) drawEntrySubtitle(cursor, p.link, cursor.accent);
          drawBulletsFlow(cursor, p.description);
          if (idx < items.length - 1) gap(cursor, 14);
        });
        gap(cursor, 18);
        break;
      }
      case "certifications": {
        const items = data.certifications.filter((c) => c.name.trim());
        if (!items.length) break;
        drawSectionTitle(cursor, sectionTitle(data, key));
        items.forEach((c, idx) => {
          ensureSpace(cursor, 40);
          drawEntryTitleRow(cursor, c.name, c.year);
          drawEntrySubtitle(cursor, c.issuer);
          if (idx < items.length - 1) gap(cursor, 8);
        });
        gap(cursor, 18);
        break;
      }
      case "achievements": {
        const items = data.achievements.filter((a) => a.title.trim());
        if (!items.length) break;
        drawSectionTitle(cursor, sectionTitle(data, key));
        items.forEach((a, idx) => {
          ensureSpace(cursor, 66);
          drawEntryTitleRow(cursor, a.title, a.period);
          drawEntrySubtitle(cursor, a.org);
          drawBulletsFlow(cursor, a.description);
          if (idx < items.length - 1) gap(cursor, 14);
        });
        gap(cursor, 18);
        break;
      }
      case "interests": {
        const list = parseInterests(data.interests);
        if (!list.length) break;
        drawSectionTitle(cursor, sectionTitle(data, key));
        if (cursor.inline === "chips") {
          drawChipRowsFlow(cursor, layoutChipRows(cursor.ctx, list, cursor.w), "#f1f5f9", "#334155");
        } else {
          drawParagraphFlow(cursor, list.join("  •  "), { fontSize: 13 });
        }
        gap(cursor, 16);
        break;
      }
      case "references": {
        const items = data.references.filter((r) => r.name.trim());
        if (!items.length) break;
        drawSectionTitle(cursor, sectionTitle(data, key));
        items.forEach((r, idx) => {
          ensureSpace(cursor, 54);
          drawEntryTitleRow(cursor, r.name, "");
          drawEntrySubtitle(cursor, r.position);
          if (r.contact.trim()) drawEntrySubtitle(cursor, r.contact, cursor.accent);
          if (idx < items.length - 1) gap(cursor, 8);
        });
        gap(cursor, 18);
        break;
      }
      case "custom": {
        if (!data.customBody.trim()) break;
        drawSectionTitle(cursor, data.customTitle.trim() || sectionTitle(data, key));
        drawBulletsFlow(cursor, data.customBody);
        gap(cursor, 18);
        break;
      }
    }
  }
}

// ── Template builders ─────────────────────────────────────────────────────

function plainContinuationHeader(data: CvData, accent: string) {
  return (ctx: CanvasRenderingContext2D, pageNumber: number): number => {
    ctx.textAlign = "left";
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`${data.fullName || "CV"} — Lanjutan (Halaman ${pageNumber})`, MARGIN, MARGIN - 20);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN, MARGIN - 8);
    ctx.lineTo(PW - MARGIN, MARGIN - 8);
    ctx.stroke();
    return MARGIN + 34;
  };
}

function makeCursor(first: HTMLCanvasElement, data: CvData, x: number, w: number, y: number, fullCol: ColumnSpec, inline: "text" | "chips" = "text"): FlowCursor {
  return {
    pages: [first],
    ctx: first.getContext("2d")!,
    x,
    w,
    y,
    bottom: BOTTOM_LIMIT,
    pageIndex: 0,
    fullCol,
    drawContinuationHeader: plainContinuationHeader(data, data.accentColor),
    accent: data.accentColor,
    timelineMode: false,
    inline,
  };
}

function asideLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size = 11.5) {
  ctx.textAlign = "left";
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.fillText(text.toUpperCase(), x, y);
}

function buildSidebarPages(data: CvData, photo: HTMLImageElement | null, mirrored: boolean): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const hidden = new Set(data.hiddenSections);
  const sideW = S(400);
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;

  const colGap = S(36);
  const sideX = mirrored ? PW - sideW : 0;
  const mainX = mirrored ? MARGIN : sideX + sideW + colGap;
  const mainW = mirrored ? sideX - colGap - mainX : PW - mainX - MARGIN;

  ctx.fillStyle = accent;
  ctx.fillRect(sideX, 0, sideW, PH);

  const padX = sideX + S(46);
  const innerW = sideW - S(92);
  let y = S(90);

  if (hasPhoto(data, photo) || data.showPhoto) {
    drawPhoto(ctx, hasPhoto(data, photo) ? photo : null, data.fullName, sideX + sideW / 2, y, S(66), photoOpts(data), "#ffffff", "rgba(255,255,255,0.18)", "#ffffff", true);
    y += S(100);
  } else {
    y += S(10);
  }

  ctx.textAlign = "center";
  ctx.font = `700 21px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  const nameLines = wrapText(ctx, data.fullName || "Nama Lengkap", innerW);
  nameLines.slice(0, 2).forEach((ln) => {
    ctx.fillText(ln, sideX + sideW / 2, y);
    y += 25;
  });
  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  y += 2;
  drawWrappedText(ctx, data.jobTitle || "Profesi", sideX + sideW / 2, y, innerW, 17, 2);
  y += 46;

  const divider = () => {
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + innerW, y);
    ctx.stroke();
  };

  divider();
  y += 30;
  asideLabel(ctx, "Kontak", padX, y, "rgba(255,255,255,0.65)");
  y += 22;
  for (const line of headerItems(data)) {
    ctx.font = `400 12px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    const wrapped = wrapText(ctx, line, innerW);
    wrapped.slice(0, 3).forEach((ln) => {
      ctx.fillText(ln, padX, y);
      y += 17;
    });
    y += 5;
  }
  y += 10;

  const skillNames = data.skills.filter((s) => s.name.trim());
  if (skillNames.length && !hidden.has("skills")) {
    divider();
    y += 30;
    asideLabel(ctx, TITLES.skills, padX, y, "rgba(255,255,255,0.65)");
    y += 20;
    y = drawSkillListBlock(ctx, padX, y, innerW, data.skills, "#ffffff", "#ffffff", "rgba(255,255,255,0.25)", 10);
    y += 10;
  }

  const langs = data.languages.filter((l) => l.name.trim());
  if (langs.length && !hidden.has("languages")) {
    divider();
    y += 30;
    asideLabel(ctx, TITLES.languages, padX, y, "rgba(255,255,255,0.65)");
    y += 20;
    drawLanguagesBlock(ctx, padX, y, innerW, data.languages, "#ffffff", "rgba(255,255,255,0.7)", 8);
  }

  const cursor = makeCursor(first, data, mainX, mainW, S(90), { x: MARGIN, w: PW - MARGIN * 2 });
  runMainFlow(cursor, data, { includeSkillsLangs: false });
  return cursor.pages;
}

function buildBandPages(data: CvData, photo: HTMLImageElement | null): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const hidden = new Set(data.hiddenSections);
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;
  const bandH = S(210);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, PW, bandH);

  const avatarR = S(58);
  const avatarCx = MARGIN + avatarR;
  const photoOn = hasPhoto(data, photo) || data.showPhoto;
  if (photoOn) drawPhoto(ctx, hasPhoto(data, photo) ? photo : null, data.fullName, avatarCx, bandH / 2, avatarR, photoOpts(data), "#ffffff", "rgba(255,255,255,0.2)", "#ffffff", true);

  const textX = photoOn ? MARGIN + avatarR * 2 + S(36) : MARGIN;
  const textW = PW - textX - MARGIN;
  ctx.textAlign = "left";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(truncateText(ctx, data.fullName || "Nama Lengkap", textW), textX, bandH / 2 - 18);
  ctx.font = `500 16px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(truncateText(ctx, data.jobTitle || "Profesi", textW), textX, bandH / 2 + 10);
  ctx.font = `400 12.5px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  wrapItemsRow(ctx, headerItems(data), "   •   ", textW).slice(0, 2).forEach((ln, i) => ctx.fillText(ln, textX, bandH / 2 + 36 + i * 18));

  const asideX = MARGIN;
  const asideW = S(300);
  const mainX = asideX + asideW + S(40);
  const mainW = PW - mainX - MARGIN;
  let ay = bandH + S(54);

  const skillNames = data.skills.filter((s) => s.name.trim());
  if (skillNames.length && !hidden.has("skills")) {
    asideLabel(ctx, TITLES.skills, asideX, ay, "#0f172a", 13);
    ay += 22;
    ay = drawSkillListBlock(ctx, asideX, ay, asideW, data.skills, accent, "#334155", "#e2e8f0", 9);
    ay += 14;
  }
  const langs = data.languages.filter((l) => l.name.trim());
  if (langs.length && !hidden.has("languages")) {
    asideLabel(ctx, TITLES.languages, asideX, ay, "#0f172a", 13);
    ay += 22;
    drawLanguagesBlock(ctx, asideX, ay, asideW, data.languages, "#0f172a", "#64748b", 6);
  }

  const cursor = makeCursor(first, data, mainX, mainW, bandH + S(54), { x: MARGIN, w: PW - MARGIN * 2 });
  runMainFlow(cursor, data, { includeSkillsLangs: false });
  return cursor.pages;
}

function buildMinimalPages(data: CvData): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;
  const colX = MARGIN;
  const colW = PW - MARGIN * 2;
  let y = MARGIN + S(20);

  ctx.textAlign = "left";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = "#0f172a";
  ctx.fillText(truncateText(ctx, data.fullName || "Nama Lengkap", colW), colX, y);
  y += 28;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText(truncateText(ctx, data.jobTitle || "Profesi", colW), colX, y);
  y += 26;
  ctx.font = `400 12.5px ${FONT}`;
  ctx.fillStyle = "#64748b";
  for (const ln of wrapItemsRow(ctx, headerItems(data), "   |   ", colW)) {
    ctx.fillText(ln, colX, y);
    y += 19;
  }
  y += 3;
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(colX, y);
  ctx.lineTo(colX + colW, y);
  ctx.stroke();
  y += 30;

  const cursor = makeCursor(first, data, colX, colW, y, { x: colX, w: colW });
  runMainFlow(cursor, data, { includeSkillsLangs: true });
  return cursor.pages;
}

function buildTimelinePages(data: CvData): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;
  const outerX = MARGIN;
  const outerW = PW - MARGIN * 2;
  let y = MARGIN + S(20);

  ctx.textAlign = "left";
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = "#0f172a";
  ctx.fillText(truncateText(ctx, data.fullName || "Nama Lengkap", outerW), outerX, y);
  y += 26;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText(truncateText(ctx, data.jobTitle || "Profesi", outerW), outerX, y);
  y += 24;
  ctx.font = `400 12px ${FONT}`;
  ctx.fillStyle = "#64748b";
  for (const ln of wrapItemsRow(ctx, headerItems(data), "   •   ", outerW)) {
    ctx.fillText(ln, outerX, y);
    y += 18;
  }
  y += 2;
  ctx.fillStyle = accent;
  ctx.fillRect(outerX, y, 60, 4);
  y += 30;

  const cursor = makeCursor(first, data, outerX, outerW, y, { x: outerX, w: outerW }, "chips");
  cursor.timelineMode = true;
  // Bagian tanpa penanda linimasa (keahlian/bahasa/minat/ringkasan) memakai lebar penuh;
  // entri bertanggal diberi indentasi agar titik penanda punya ruang. Diatur di runTimelineFlow.
  runTimelineFlow(cursor, data, outerX, outerW);
  return cursor.pages;
}

/** Linimasa: entri bertanggal diindentasi, bagian lain selebar penuh — urutan tetap mengikuti sectionOrder. */
function runTimelineFlow(cursor: FlowCursor, data: CvData, outerX: number, outerW: number) {
  const indent = 22;
  const dated: SectionKey[] = ["experience", "education", "projects"];
  const wasHidden = new Set(data.hiddenSections);
  let buffer: SectionKey[] = [];
  const flush = () => {
    if (!buffer.length) return;
    const only = data.sectionOrder.filter((k) => buffer.includes(k));
    const hide = data.sectionOrder.filter((k) => !only.includes(k));
    const sub: CvData = { ...data, sectionOrder: only, hiddenSections: [...new Set([...data.hiddenSections, ...hide])] };
    const isDated = only.some((k) => dated.includes(k));
    cursor.x = isDated ? outerX + indent : outerX;
    cursor.w = isDated ? outerW - indent : outerW;
    cursor.fullCol = { x: cursor.x, w: cursor.w };
    cursor.timelineMode = isDated;
    runMainFlow(cursor, sub, { includeSkillsLangs: true });
    buffer = [];
  };
  let prevDated: boolean | null = null;
  for (const key of data.sectionOrder) {
    if (wasHidden.has(key)) continue;
    const d = dated.includes(key);
    if (prevDated !== null && d !== prevDated) flush();
    buffer.push(key);
    prevDated = d;
  }
  flush();
}

function buildElegantPages(data: CvData): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;
  const colX = MARGIN;
  const colW = PW - MARGIN * 2;
  const cx = PW / 2;
  let y = MARGIN + S(26);

  ctx.textAlign = "center";
  ctx.font = `700 32px ${FONT}`;
  ctx.fillStyle = "#0f172a";
  try {
    (ctx as any).letterSpacing = "3px";
  } catch {
    /* tidak didukung — lanjut tanpa spasi huruf */
  }
  ctx.fillText(truncateText(ctx, (data.fullName || "Nama Lengkap").toUpperCase(), colW), cx, y);
  try {
    (ctx as any).letterSpacing = "0px";
  } catch {
    /* abaikan */
  }
  y += 28;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText(truncateText(ctx, data.jobTitle || "Profesi", colW), cx, y);
  y += 24;
  ctx.font = `400 12.5px ${FONT}`;
  ctx.fillStyle = "#64748b";
  for (const ln of wrapItemsRow(ctx, headerItems(data), "   ·   ", colW)) {
    ctx.fillText(ln, cx, y);
    y += 19;
  }
  y += 6;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(colX, y);
  ctx.lineTo(colX + colW, y);
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(colX, y + 5);
  ctx.lineTo(colX + colW, y + 5);
  ctx.stroke();
  ctx.textAlign = "left";
  y += 34;

  const cursor = makeCursor(first, data, colX, colW, y, { x: colX, w: colW });
  runMainFlow(cursor, data, { includeSkillsLangs: true });
  return cursor.pages;
}

function buildBannerPages(data: CvData, photo: HTMLImageElement | null): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;
  const photoOn = hasPhoto(data, photo);
  const photoR = S(54);
  const textX = MARGIN;
  const textW = PW - MARGIN * 2 - (photoOn ? photoR * 2 + S(30) : 0);

  ctx.font = `400 12.5px ${FONT}`;
  const contactRows = wrapItemsRow(ctx, headerItems(data), "   •   ", textW).slice(0, 3);
  const bandH = Math.max(S(photoOn ? 190 : 150), MARGIN + S(18) + 36 + 28 + contactRows.length * 19 + S(24));

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, PW, bandH);
  // Aksen garis tipis di tepi bawah banner
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(0, bandH - 4, PW, 4);

  let y = MARGIN + S(18) + 22;
  ctx.textAlign = "left";
  ctx.font = `700 32px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(truncateText(ctx, data.fullName || "Nama Lengkap", textW), textX, y);
  y += 30;
  ctx.font = `500 16px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(truncateText(ctx, data.jobTitle || "Profesi", textW), textX, y);
  y += 28;
  ctx.font = `400 12.5px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  for (const ln of contactRows) {
    ctx.fillText(ln, textX, y);
    y += 19;
  }
  if (photoOn) drawPhoto(ctx, photo, data.fullName, PW - MARGIN - photoR, bandH / 2, photoR, photoOpts(data), "#ffffff", "rgba(255,255,255,0.2)", "#ffffff", false);

  const cursor = makeCursor(first, data, MARGIN, PW - MARGIN * 2, bandH + S(48), { x: MARGIN, w: PW - MARGIN * 2 });
  runMainFlow(cursor, data, { includeSkillsLangs: true });
  return cursor.pages;
}

function buildSplitPages(data: CvData, photo: HTMLImageElement | null): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const hidden = new Set(data.hiddenSections);
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;
  const fullW = PW - MARGIN * 2;

  let y = MARGIN + S(26);
  ctx.textAlign = "left";
  ctx.font = `700 32px ${FONT}`;
  ctx.fillStyle = "#0f172a";
  ctx.fillText(truncateText(ctx, data.fullName || "Nama Lengkap", fullW), MARGIN, y);
  y += 28;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText(truncateText(ctx, data.jobTitle || "Profesi", fullW), MARGIN, y);
  y += 20;
  ctx.fillStyle = accent;
  ctx.fillRect(MARGIN, y, fullW, 3);
  const headEnd = y + S(46);

  const asideX = MARGIN;
  const asideW = S(300);
  const ruleX = asideX + asideW + S(22);
  const mainX = ruleX + S(24);
  const mainW = PW - MARGIN - mainX;
  let ay = headEnd;

  if (hasPhoto(data, photo)) {
    const r = S(78);
    drawPhoto(ctx, photo, data.fullName, asideX + asideW / 2, ay + r, r, photoOpts(data), rgba(accent, 0.25), "#e2e8f0", "#475569", false);
    ay += r * 2 + S(36);
  }

  asideLabel(ctx, "Kontak", asideX, ay, accent, 12.5);
  ay += 8;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(asideX, ay);
  ctx.lineTo(asideX + asideW, ay);
  ctx.stroke();
  ay += 22;
  for (const line of headerItems(data)) {
    ctx.font = `400 12px ${FONT}`;
    ctx.fillStyle = "#334155";
    ctx.textAlign = "left";
    wrapText(ctx, line, asideW).slice(0, 3).forEach((ln) => {
      ctx.fillText(ln, asideX, ay);
      ay += 17;
    });
    ay += 5;
  }
  ay += 12;

  const named = data.skills.filter((s) => s.name.trim());
  if (named.length && !hidden.has("skills")) {
    asideLabel(ctx, TITLES.skills, asideX, ay, accent, 12.5);
    ay += 8;
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(asideX, ay);
    ctx.lineTo(asideX + asideW, ay);
    ctx.stroke();
    ay += 22;
    ay = drawSkillListBlock(ctx, asideX, ay, asideW, data.skills, accent, "#334155", "#e2e8f0", 10);
    ay += 14;
  }
  const langs = data.languages.filter((l) => l.name.trim());
  if (langs.length && !hidden.has("languages")) {
    asideLabel(ctx, TITLES.languages, asideX, ay, accent, 12.5);
    ay += 8;
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(asideX, ay);
    ctx.lineTo(asideX + asideW, ay);
    ctx.stroke();
    ay += 22;
    drawLanguagesBlock(ctx, asideX, ay, asideW, data.languages, "#0f172a", "#64748b", 8);
  }

  // Garis vertikal pemisah kolom
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ruleX, headEnd - S(10));
  ctx.lineTo(ruleX, PH - MARGIN);
  ctx.stroke();

  const cursor = makeCursor(first, data, mainX, mainW, headEnd + S(8), { x: MARGIN, w: fullW });
  runMainFlow(cursor, data, { includeSkillsLangs: false });
  return cursor.pages;
}

// ── Public entry points ───────────────────────────────────────────────────

export interface CvRenderOptions {
  /** Pengali resolusi bitmap: 1 = pratinjau (150 dpi), 2 = ekspor tajam (300 dpi). */
  scale?: number;
  /** Rekam semua run teks per halaman (untuk lapisan teks PDF). */
  recordText?: boolean;
}

export interface CvRenderResult {
  pages: HTMLCanvasElement[];
  /** Skala teks yang benar-benar dipakai (bisa lebih kecil dari pengaturan bila "muat 1 halaman" aktif). */
  usedTextScale: number;
  /** True bila mode "muat 1 halaman" aktif tetapi isi tetap lebih dari 1 halaman pada skala terkecil. */
  fitFailed: boolean;
}

function buildPages(data: CvData, photo: HTMLImageElement | null, z: number, scale: number, record: boolean): HTMLCanvasElement[] {
  setupEnv(data, z, scale, record);
  const id: CvTemplateId = data.templateId;
  if (id === "sidebar") return buildSidebarPages(data, photo, false);
  if (id === "accent") return buildSidebarPages(data, photo, true);
  if (id === "band") return buildBandPages(data, photo);
  if (id === "timeline") return buildTimelinePages(data);
  if (id === "elegant") return buildElegantPages(data);
  if (id === "split") return buildSplitPages(data, photo);
  if (id === "banner") return buildBannerPages(data, photo);
  return buildMinimalPages(data);
}

export async function renderCvDocument(data: CvData, photo: HTMLImageElement | null, opts: CvRenderOptions = {}): Promise<CvRenderResult> {
  await ensureFontReady(data.fontFamily, "700");
  await ensureFontReady(data.fontFamily, "600");
  await ensureFontReady(data.fontFamily, "400");

  const scale = Math.max(0.25, opts.scale ?? 1);
  const record = !!opts.recordText;
  let z = data.textScale;
  let fitFailed = false;

  if (data.autoFit) {
    // Turunkan skala teks bertahap (probe beresolusi rendah) sampai isi muat 1 halaman.
    const MIN_Z = 0.7;
    let probe = Math.max(MIN_Z, z);
    let fitted = false;
    while (probe >= MIN_Z - 1e-6) {
      const n = buildPages(data, photo, probe, 0.25, false).length;
      if (n <= 1) {
        fitted = true;
        break;
      }
      probe = Math.round((probe - 0.05) * 100) / 100;
    }
    if (fitted) z = Math.min(z, probe);
    else {
      z = MIN_Z;
      fitFailed = true;
    }
  }

  const pages = buildPages(data, photo, z, scale, record);
  return { pages, usedTextScale: z, fitFailed };
}

/** Kompatibel dengan pemanggil lama. */
export async function renderCvPages(data: CvData, photo: HTMLImageElement | null): Promise<HTMLCanvasElement[]> {
  return (await renderCvDocument(data, photo)).pages;
}
