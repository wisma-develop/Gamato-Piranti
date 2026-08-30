// Rendering engine for the CV Maker (Special > Pembuat CV).
//
// Design notes (read before touching pagination logic):
// - Each page is a fixed 1240×1754px canvas — the same pixel ratio as real A4
//   (210mm × 297mm), consistent with the other document generators in this app.
// - "Aside" content (photo, contact block, skills bars, languages) for the
//   sidebar/accent/band templates is drawn ONCE on page 1 only and is capped
//   to a sane item count. This is a deliberate, documented simplification —
//   real resume builders (Canva, Novoresume, etc.) do the same thing — and it
//   keeps pagination fully deterministic (no ambiguous "which column
//   continues first" scenarios). Realistically nobody lists 40 skills.
// - The "main flow" (Ringkasan, Pengalaman, Pendidikan, Sertifikasi,
//   Organisasi) is fully paginated: it can span as many A4 pages as needed.
//   Continuation pages (page 2+) drop the sidebar/band and become a plain
//   full-width column with a small "Lanjutan" header.
// - Minimalis & Linimasa templates have no fixed aside at all — everything,
//   including skills/languages, lives in the single paginated column, so
//   pagination for those two is trivial and can never overlap/clip content.

import { wrapText, drawWrappedText, roundRect, ensureFontReady } from "@/lib/businessDocCanvas";
import type { CvData, CvTemplateId, SkillItem, LangItem } from "@/lib/cvTypes";

export const CV_PAGE_W = 1240;
export const CV_PAGE_H = 1754;
const MARGIN = 64;
const BOTTOM_LIMIT = CV_PAGE_H - MARGIN;
let FONT = "'Alan Sans', sans-serif";

/** Called once at the top of `renderCvPages` so every draw* helper below
 *  (which all reference the shared `FONT` binding) picks up the user's
 *  chosen font/custom upload for this render pass. Safe because canvas
 *  drawing here is fully synchronous — no other render can interleave. */
function setActiveFont(family: string) {
  FONT = family && family.trim() ? `'${family.trim()}', sans-serif` : "'Alan Sans', sans-serif";
}

// ── Low-level helpers ─────────────────────────────────────────────────────

function newBlankPage(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CV_PAGE_W;
  canvas.height = CV_PAGE_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CV_PAGE_W, CV_PAGE_H);
  ctx.textBaseline = "alphabetic";
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

function drawCircleClip(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, draw: () => void) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  draw();
  ctx.restore();
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  cx: number,
  cy: number,
  r: number,
  ringColor: string,
  bgColor: string,
  fgColor: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
  ctx.fillStyle = ringColor;
  ctx.fill();
  ctx.restore();

  if (img) {
    drawCircleClip(ctx, cx, cy, r, () => {
      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;
      const scale = Math.max((r * 2) / iw, (r * 2) / ih);
      const w = iw * scale;
      const h = ih * scale;
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    });
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bgColor;
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(r * 0.7)}px ${FONT}`;
    ctx.fillStyle = fgColor;
    ctx.fillText(initials(name), cx, cy + 2);
    ctx.textBaseline = "alphabetic";
  }
}

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
  ensureSpace(cursor, 46);
  const ctx = cursor.ctx;
  ctx.fillStyle = cursor.accent;
  ctx.fillRect(cursor.x, cursor.y - 15, 5, 20);
  ctx.font = `700 16.5px ${FONT}`;
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "left";
  ctx.fillText(title.toUpperCase(), cursor.x + 14, cursor.y);
  cursor.y += 12;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cursor.x, cursor.y);
  ctx.lineTo(cursor.x + cursor.w, cursor.y);
  ctx.stroke();
  cursor.y += 22;
}

function drawParagraphFlow(cursor: FlowCursor, text: string, opts?: { fontSize?: number; color?: string; lineHeight?: number }) {
  const fontSize = opts?.fontSize ?? 13.5;
  const color = opts?.color ?? "#334155";
  const lineHeight = opts?.lineHeight ?? 19;
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
      ctx.textAlign = "left";
      if (ln) ctx.fillText(ln, cursor.x, cursor.y);
      cursor.y += lineHeight;
    }
  }
}

function drawBulletsFlow(cursor: FlowCursor, description: string) {
  const items = description.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!items.length) return;
  const indent = 16;
  const fontSize = 13;
  const lineHeight = 18.5;
  const measureCtx = cursor.ctx;
  measureCtx.font = `400 ${fontSize}px ${FONT}`;
  for (const item of items) {
    const wrapped = wrapText(measureCtx, item, cursor.w - indent);
    wrapped.forEach((ln, i) => {
      ensureSpace(cursor, lineHeight);
      const ctx = cursor.ctx;
      ctx.font = `400 ${fontSize}px ${FONT}`;
      ctx.fillStyle = "#475569";
      ctx.textAlign = "left";
      if (i === 0) {
        ctx.fillStyle = cursor.accent;
        ctx.beginPath();
        ctx.arc(cursor.x + 4, cursor.y - 4, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#475569";
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
  cursor.y += 19;
}

function drawEntrySubtitle(cursor: FlowCursor, subtitle: string) {
  if (!subtitle.trim()) return;
  ensureSpace(cursor, 19);
  const ctx = cursor.ctx;
  ctx.font = `600 12.5px ${FONT}`;
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "left";
  ctx.fillText(truncateText(ctx, subtitle, cursor.w), cursor.x, cursor.y);
  cursor.y += 20;
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

// ── Fixed (non-paginated) aside blocks — sidebar/band/accent only ────────

function drawSkillBarsBlock(
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
  const shown = skills.filter((s) => s.name.trim()).slice(0, cap);
  for (const s of shown) {
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = labelColor;
    ctx.textAlign = "left";
    ctx.fillText(truncateText(ctx, s.name, w), x, cy);
    cy += 15;
    const barH = 6;
    ctx.fillStyle = trackColor;
    roundRect(ctx, x, cy, w, barH, 3);
    ctx.fill();
    ctx.fillStyle = accent;
    const pct = Math.min(100, Math.max(4, s.level || 0));
    roundRect(ctx, x, cy, Math.max(8, (w * pct) / 100), barH, 3);
    ctx.fill();
    cy += barH + 13;
  }
  const rest = skills.filter((s) => s.name.trim()).length - shown.length;
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

// ── Chip-row helper (used by Linimasa for skills/languages) ──────────────

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

// ── Contact line helper ───────────────────────────────────────────────────

function contactLines(data: CvData): string[] {
  return [data.email, data.phone, data.address, data.website].map((s) => s.trim()).filter(Boolean);
}

// ── Section flow orchestration (shared by all templates) ─────────────────

function runMainFlow(cursor: FlowCursor, data: CvData, opts?: { includeSkillsLangs?: boolean }) {
  if (data.summary.trim()) {
    drawSectionTitle(cursor, "Ringkasan");
    drawParagraphFlow(cursor, data.summary);
    cursor.y += 16;
  }

  if (opts?.includeSkillsLangs) {
    const skillNames = data.skills.map((s) => s.name).filter(Boolean);
    if (skillNames.length) {
      drawSectionTitle(cursor, "Keahlian");
      drawParagraphFlow(cursor, skillNames.join("  •  "), { fontSize: 13, color: "#334155" });
      cursor.y += 16;
    }
    const langNames = data.languages.filter((l) => l.name.trim()).map((l) => `${l.name} (${l.level || "-"})`);
    if (langNames.length) {
      drawSectionTitle(cursor, "Bahasa");
      drawParagraphFlow(cursor, langNames.join("  •  "), { fontSize: 13, color: "#334155" });
      cursor.y += 16;
    }
  }

  const experience = data.experience.filter((e) => e.role.trim() || e.company.trim());
  if (experience.length) {
    drawSectionTitle(cursor, "Pengalaman Kerja");
    experience.forEach((exp, idx) => {
      ensureSpace(cursor, 66);
      if (cursor.timelineMode) drawTimelineDot(cursor);
      const titleText = [exp.role, exp.location].filter(Boolean).join(" — ") || exp.role || "-";
      drawEntryTitleRow(cursor, titleText, exp.period);
      drawEntrySubtitle(cursor, exp.company);
      drawBulletsFlow(cursor, exp.description);
      if (idx < experience.length - 1) cursor.y += 14;
    });
    cursor.y += 18;
  }

  const education = data.education.filter((e) => e.degree.trim() || e.school.trim());
  if (education.length) {
    drawSectionTitle(cursor, "Pendidikan");
    education.forEach((edu, idx) => {
      ensureSpace(cursor, 66);
      if (cursor.timelineMode) drawTimelineDot(cursor);
      drawEntryTitleRow(cursor, edu.degree || "-", edu.period);
      drawEntrySubtitle(cursor, edu.school);
      drawBulletsFlow(cursor, edu.description);
      if (idx < education.length - 1) cursor.y += 14;
    });
    cursor.y += 18;
  }

  const certifications = data.certifications.filter((c) => c.name.trim());
  if (certifications.length) {
    drawSectionTitle(cursor, "Sertifikasi");
    certifications.forEach((c, idx) => {
      ensureSpace(cursor, 40);
      drawEntryTitleRow(cursor, c.name, c.year);
      drawEntrySubtitle(cursor, c.issuer);
      if (idx < certifications.length - 1) cursor.y += 8;
    });
    cursor.y += 18;
  }

  const achievements = data.achievements.filter((a) => a.title.trim());
  if (achievements.length) {
    drawSectionTitle(cursor, "Organisasi & Penghargaan");
    achievements.forEach((a, idx) => {
      ensureSpace(cursor, 66);
      drawEntryTitleRow(cursor, a.title, a.period);
      drawEntrySubtitle(cursor, a.org);
      drawBulletsFlow(cursor, a.description);
      if (idx < achievements.length - 1) cursor.y += 14;
    });
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
    ctx.lineTo(CV_PAGE_W - MARGIN, MARGIN - 8);
    ctx.stroke();
    return MARGIN + 34;
  };
}

function buildSidebarPages(data: CvData, photo: HTMLImageElement | null, mirrored: boolean): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const sideW = 400;
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;

  const colGap = 36;
  const sideX = mirrored ? CV_PAGE_W - sideW : 0;
  const mainX = mirrored ? MARGIN : sideX + sideW + colGap;
  const mainW = mirrored ? sideX - colGap - mainX : CV_PAGE_W - mainX - MARGIN;

  ctx.fillStyle = accent;
  ctx.fillRect(sideX, 0, sideW, CV_PAGE_H);

  const padX = sideX + 46;
  const innerW = sideW - 92;
  let y = 90;

  drawAvatar(ctx, photo, data.fullName, sideX + sideW / 2, y, 66, "#ffffff", "rgba(255,255,255,0.18)", "#ffffff");
  y += 100;

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

  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(padX + innerW, y);
  ctx.stroke();
  y += 30;

  ctx.textAlign = "left";
  ctx.font = `700 11.5px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText("KONTAK", padX, y);
  y += 22;
  for (const line of contactLines(data)) {
    ctx.font = `400 12px ${FONT}`;
    ctx.fillStyle = "#ffffff";
    const wrapped = wrapText(ctx, line, innerW);
    wrapped.slice(0, 2).forEach((ln) => {
      ctx.fillText(ln, padX, y);
      y += 17;
    });
    y += 5;
  }
  y += 10;

  const skillNames = data.skills.filter((s) => s.name.trim());
  if (skillNames.length) {
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + innerW, y);
    ctx.stroke();
    y += 30;
    ctx.font = `700 11.5px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText("KEAHLIAN", padX, y);
    y += 20;
    y = drawSkillBarsBlock(ctx, padX, y, innerW, data.skills, "#ffffff", "#ffffff", "rgba(255,255,255,0.25)", 10);
    y += 10;
  }

  const langs = data.languages.filter((l) => l.name.trim());
  if (langs.length) {
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(padX + innerW, y);
    ctx.stroke();
    y += 30;
    ctx.font = `700 11.5px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText("BAHASA", padX, y);
    y += 20;
    drawLanguagesBlock(ctx, padX, y, innerW, data.languages, "#ffffff", "rgba(255,255,255,0.7)", 8);
  }

  const cursor: FlowCursor = {
    pages: [first],
    ctx,
    x: mainX,
    w: mainW,
    y: 90,
    bottom: BOTTOM_LIMIT,
    pageIndex: 0,
    fullCol: { x: MARGIN, w: CV_PAGE_W - MARGIN * 2 },
    drawContinuationHeader: plainContinuationHeader(data, accent),
    accent,
    timelineMode: false,
  };

  runMainFlow(cursor, data, { includeSkillsLangs: false });
  return cursor.pages;
}

function buildBandPages(data: CvData, photo: HTMLImageElement | null): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;
  const bandH = 210;

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, CV_PAGE_W, bandH);

  const avatarR = 58;
  const avatarCx = MARGIN + avatarR;
  drawAvatar(ctx, photo, data.fullName, avatarCx, bandH / 2, avatarR, "#ffffff", "rgba(255,255,255,0.2)", "#ffffff");

  const textX = MARGIN + avatarR * 2 + 36;
  ctx.textAlign = "left";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(truncateText(ctx, data.fullName || "Nama Lengkap", CV_PAGE_W - textX - MARGIN), textX, bandH / 2 - 18);
  ctx.font = `500 16px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(truncateText(ctx, data.jobTitle || "Profesi", CV_PAGE_W - textX - MARGIN), textX, bandH / 2 + 10);
  ctx.font = `400 12.5px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText(truncateText(ctx, contactLines(data).join("   •   "), CV_PAGE_W - textX - MARGIN), textX, bandH / 2 + 36);

  const asideX = MARGIN;
  const asideW = 300;
  const mainX = asideX + asideW + 40;
  const mainW = CV_PAGE_W - mainX - MARGIN;
  let ay = bandH + 54;

  const skillNames = data.skills.filter((s) => s.name.trim());
  if (skillNames.length) {
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.fillText("KEAHLIAN", asideX, ay);
    ay += 22;
    ay = drawSkillBarsBlock(ctx, asideX, ay, asideW, data.skills, accent, "#334155", "#e2e8f0", 9);
    ay += 14;
  }
  const langs = data.languages.filter((l) => l.name.trim());
  if (langs.length) {
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = "#0f172a";
    ctx.fillText("BAHASA", asideX, ay);
    ay += 22;
    drawLanguagesBlock(ctx, asideX, ay, asideW, data.languages, "#0f172a", "#64748b", 6);
  }

  const cursor: FlowCursor = {
    pages: [first],
    ctx,
    x: mainX,
    w: mainW,
    y: bandH + 54,
    bottom: BOTTOM_LIMIT,
    pageIndex: 0,
    fullCol: { x: MARGIN, w: CV_PAGE_W - MARGIN * 2 },
    drawContinuationHeader: plainContinuationHeader(data, accent),
    accent,
    timelineMode: false,
  };

  runMainFlow(cursor, data, { includeSkillsLangs: false });
  return cursor.pages;
}

function buildMinimalPages(data: CvData): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;
  const colX = MARGIN;
  const colW = CV_PAGE_W - MARGIN * 2;
  let y = 84;

  ctx.textAlign = "left";
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = "#0f172a";
  ctx.fillText(data.fullName || "Nama Lengkap", colX, y);
  y += 28;
  ctx.font = `600 15px ${FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText(data.jobTitle || "Profesi", colX, y);
  y += 26;
  ctx.font = `400 12.5px ${FONT}`;
  ctx.fillStyle = "#64748b";
  ctx.fillText(contactLines(data).join("   |   "), colX, y);
  y += 22;
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(colX, y);
  ctx.lineTo(colX + colW, y);
  ctx.stroke();
  y += 30;

  const cursor: FlowCursor = {
    pages: [first],
    ctx,
    x: colX,
    w: colW,
    y,
    bottom: BOTTOM_LIMIT,
    pageIndex: 0,
    fullCol: { x: colX, w: colW },
    drawContinuationHeader: plainContinuationHeader(data, accent),
    accent,
    timelineMode: false,
  };

  runMainFlow(cursor, data, { includeSkillsLangs: true });
  return cursor.pages;
}

function buildTimelinePages(data: CvData): HTMLCanvasElement[] {
  const accent = data.accentColor;
  const first = newBlankPage();
  const ctx = first.getContext("2d")!;
  const outerX = MARGIN;
  const outerW = CV_PAGE_W - MARGIN * 2;
  let y = 84;

  ctx.textAlign = "left";
  ctx.font = `700 28px ${FONT}`;
  ctx.fillStyle = "#0f172a";
  ctx.fillText(data.fullName || "Nama Lengkap", outerX, y);
  y += 26;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillStyle = accent;
  ctx.fillText(data.jobTitle || "Profesi", outerX, y);
  y += 24;
  ctx.font = `400 12px ${FONT}`;
  ctx.fillStyle = "#64748b";
  ctx.fillText(contactLines(data).join("   •   "), outerX, y);
  y += 18;
  ctx.fillStyle = accent;
  ctx.fillRect(outerX, y, 60, 4);
  y += 30;

  // Timeline entries get extra left indent for the dot/line marker.
  const timelineIndent = 22;
  const colX = outerX + timelineIndent;
  const colW = outerW - timelineIndent;

  const cursor: FlowCursor = {
    pages: [first],
    ctx,
    x: colX,
    w: colW,
    y,
    bottom: BOTTOM_LIMIT,
    pageIndex: 0,
    // Continuation pages keep the same timeline indent as page 1 so the dot
    // markers line up consistently across every page (see addPage()).
    fullCol: { x: colX, w: colW },
    drawContinuationHeader: plainContinuationHeader(data, accent),
    accent,
    timelineMode: false,
  };

  // Skills & languages as chip rows before the timelined sections, drawn at
  // full outer width (no indent needed — they're not timeline entries). The
  // full-width column is used for BOTH the initial draw and any page break
  // that might happen mid-list, so it stays correct even in that edge case.
  cursor.x = outerX;
  cursor.w = outerW;
  cursor.fullCol = { x: outerX, w: outerW };

  const skillNames = data.skills.filter((s) => s.name.trim()).map((s) => s.name);
  if (skillNames.length) {
    drawSectionTitle(cursor, "Keahlian");
    drawChipRowsFlow(cursor, layoutChipRows(cursor.ctx, skillNames, cursor.w), rgba(accent, 0.12), accent);
    cursor.y += 12;
  }
  const langChips = data.languages.filter((l) => l.name.trim()).map((l) => `${l.name} · ${l.level || "-"}`);
  if (langChips.length) {
    drawSectionTitle(cursor, "Bahasa");
    drawChipRowsFlow(cursor, layoutChipRows(cursor.ctx, langChips, cursor.w), "#f1f5f9", "#334155");
    cursor.y += 12;
  }

  // Switch to the timeline-indented column for the rest of the flow
  // (Pengalaman/Pendidikan/etc.), including any future page breaks.
  cursor.x = colX;
  cursor.w = colW;
  cursor.fullCol = { x: colX, w: colW };
  cursor.timelineMode = true;

  runMainFlow(cursor, data, { includeSkillsLangs: false });
  return cursor.pages;
}

// ── Public entry point ────────────────────────────────────────────────────

export async function renderCvPages(
  data: CvData,
  photo: HTMLImageElement | null
): Promise<HTMLCanvasElement[]> {
  setActiveFont(data.fontFamily);
  await ensureFontReady(data.fontFamily, "700");
  await ensureFontReady(data.fontFamily, "600");
  await ensureFontReady(data.fontFamily, "400");

  const id: CvTemplateId = data.templateId;
  if (id === "sidebar") return buildSidebarPages(data, photo, false);
  if (id === "accent") return buildSidebarPages(data, photo, true);
  if (id === "band") return buildBandPages(data, photo);
  if (id === "timeline") return buildTimelinePages(data);
  return buildMinimalPages(data);
}
