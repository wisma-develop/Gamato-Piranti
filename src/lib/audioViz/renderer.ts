// Renderer Audio Visualizer — menggambar satu frame ke canvas 2D.
// Dipakai pratinjau & ekspor. Koordinat logis = cfg.width × cfg.height; pemanggil
// boleh menskalakan context (pratinjau) dan memberi tahu skalanya lewat `pxScale`.

import { fontStack } from "@/lib/fontPresets";
import { WAVE_LEN, type VizFrame } from "./analysis";
import { clamp, isCircleStyle, isReflectable, type VizConfig } from "./config";

export interface VizAssets {
  bg?: (CanvasImageSource & { width: number; height: number }) | null;
  logo?: (CanvasImageSource & { width: number; height: number }) | null;
}

type Paint = (i: number, n: number, v: number) => string | CanvasGradient;

const S1080 = (cfg: VizConfig) => cfg.height / 1080; // skala px "setara 1080p"

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * t);
  const g = Math.round(A[1] + (B[1] - A[1]) * t);
  const bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function stops(cfg: VizConfig): [number, string][] {
  return cfg.useColor3 ? [[0, cfg.color1], [0.5, cfg.color2], [1, cfg.color3]] : [[0, cfg.color1], [1, cfg.color2]];
}

function colorAt(cfg: VizConfig, t: number): string {
  const s = stops(cfg);
  t = clamp(t, 0, 1);
  for (let i = 0; i < s.length - 1; i++) {
    if (t <= s[i + 1][0]) return mix(s[i][1], s[i + 1][1], (t - s[i][0]) / (s[i + 1][0] - s[i][0] || 1));
  }
  return s[s.length - 1][1];
}

function linearGradientAcross(g: CanvasRenderingContext2D, w: number, h: number, angleDeg: number, st: [number, string][]): CanvasGradient {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2 || 1;
  const grad = g.createLinearGradient(-dx * half, -dy * half, dx * half, dy * half);
  for (const [o, c] of st) grad.addColorStop(o, c);
  return grad;
}

function makePaint(g: CanvasRenderingContext2D, cfg: VizConfig, aw: number, ah: number, time: number): Paint {
  switch (cfg.colorMode) {
    case "solid":
      return () => cfg.color1;
    case "rainbow": {
      const shift = time * cfg.hueShift;
      return (i, n) => `hsl(${(((i / Math.max(1, n)) * 360 + shift) % 360 + 360) % 360},90%,60%)`;
    }
    case "level":
      return (_i, _n, v) => colorAt(cfg, v);
    default: {
      const grad = linearGradientAcross(g, aw, ah, cfg.gradAngle, stops(cfg));
      return () => grad;
    }
  }
}

/** Cat untuk elemen tunggal besar (garis/area): rainbow & level → gradien horizontal. */
function wholePaint(g: CanvasRenderingContext2D, cfg: VizConfig, aw: number, ah: number, time: number): string | CanvasGradient {
  if (cfg.colorMode === "solid") return cfg.color1;
  if (cfg.colorMode === "rainbow") {
    const grad = g.createLinearGradient(-aw / 2, 0, aw / 2, 0);
    const shift = time * cfg.hueShift;
    for (let k = 0; k <= 12; k++) grad.addColorStop(k / 12, `hsl(${((k / 12) * 360 + shift) % 360},90%,60%)`);
    return grad;
  }
  return linearGradientAcross(g, aw, ah, cfg.gradAngle, stops(cfg));
}

function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  if (rr <= 0.01) {
    g.rect(x, y, w, h);
    return;
  }
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.arcTo(x + w, y, x + w, y + rr, rr);
  g.lineTo(x + w, y + h - rr);
  g.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  g.lineTo(x + rr, y + h);
  g.arcTo(x, y + h, x, y + h - rr, rr);
  g.lineTo(x, y + rr);
  g.arcTo(x, y, x + rr, y, rr);
  g.closePath();
}

function smoothPath(g: CanvasRenderingContext2D, pts: [number, number][], closed: boolean) {
  const n = pts.length;
  if (n < 2) return;
  g.beginPath();
  if (closed) {
    const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(pts[n - 1], pts[0]);
    g.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    g.closePath();
  } else {
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    g.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}

// ── Gaya ─────────────────────────────────────────────────────────────────

interface Ctx2 {
  g: CanvasRenderingContext2D;
  cfg: VizConfig;
  f: VizFrame;
  aw: number;
  ah: number;
  time: number;
  s: number; // skala 1080p
  paint: Paint;
  whole: string | CanvasGradient;
}

function strokeIfOutline(c: Ctx2) {
  if (c.cfg.outline > 0) {
    c.g.lineWidth = c.cfg.outline * c.s;
    c.g.strokeStyle = c.cfg.outlineColor;
    c.g.stroke();
  }
}

function drawBars(c: Ctx2, mirror: boolean) {
  const { g, cfg, f, aw, ah, s } = c;
  const n = f.bars.length;
  const slot = aw / n;
  const bw = Math.max(1, slot * cfg.barWidth);
  const minH = cfg.minBar * s;
  for (let i = 0; i < n; i++) {
    const v = f.bars[i];
    const h = clamp(Math.max(minH, v * ah), 0, ah);
    const x = -aw / 2 + i * slot + (slot - bw) / 2;
    const y = mirror ? -h / 2 : ah / 2 - h;
    roundRectPath(g, x, y, bw, h, (cfg.barRadius * bw) / 2);
    g.fillStyle = c.paint(i, n, v);
    g.fill();
    strokeIfOutline(c);
    if (cfg.peaks) {
      const ph = Math.max(2 * s, 4 * s);
      const pv = clamp(f.peaks[i], 0, 1) * ah;
      g.fillStyle = c.paint(i, n, v);
      if (mirror) {
        g.fillRect(x, -pv / 2 - ph - 2 * s, bw, ph);
        g.fillRect(x, pv / 2 + 2 * s, bw, ph);
      } else g.fillRect(x, ah / 2 - pv - ph - 2 * s, bw, ph);
    }
  }
}

function drawSegments(c: Ctx2, round: boolean) {
  const { g, cfg, f, aw, ah, s } = c;
  const n = f.bars.length;
  const slot = aw / n;
  const bw = Math.max(1, slot * cfg.barWidth);
  const segN = Math.round(clamp(cfg.segments, 3, 60));
  const segH = ah / segN;
  const gap = segH * cfg.segGap;
  for (let i = 0; i < n; i++) {
    const v = f.bars[i];
    const lit = Math.ceil(v * segN - 1e-6);
    const x = -aw / 2 + i * slot + (slot - bw) / 2;
    for (let k = 0; k < lit; k++) {
      const y = ah / 2 - (k + 1) * segH + gap / 2;
      g.fillStyle = c.paint(i, n, (k + 1) / segN);
      if (round) {
        const r = Math.min(bw, segH - gap, cfg.dotSize * s * 2) / 2;
        g.beginPath();
        g.arc(x + bw / 2, y + (segH - gap) / 2, Math.max(0.5, r), 0, Math.PI * 2);
        g.fill();
      } else {
        roundRectPath(g, x, y, bw, Math.max(1, segH - gap), cfg.barRadius * Math.min(bw, segH - gap) * 0.3);
        g.fill();
        strokeIfOutline(c);
      }
    }
  }
}

function drawLineArea(c: Ctx2, area: boolean) {
  const { g, cfg, f, aw, ah, s } = c;
  const n = f.bars.length;
  const slot = aw / n;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) pts.push([-aw / 2 + (i + 0.5) * slot, ah / 2 - clamp(f.bars[i], 0, 1) * ah]);
  pts.unshift([-aw / 2, pts[0][1]]);
  pts.push([aw / 2, pts[pts.length - 1][1]]);
  g.lineJoin = "round";
  g.lineCap = "round";
  if (area) {
    smoothPath(g, pts, false);
    g.lineTo(aw / 2, ah / 2);
    g.lineTo(-aw / 2, ah / 2);
    g.closePath();
    g.fillStyle = c.whole;
    g.globalAlpha *= 0.85;
    g.fill();
    g.globalAlpha /= 0.85;
  }
  smoothPath(g, pts, false);
  g.lineWidth = cfg.lineWidth * s;
  g.strokeStyle = c.whole;
  g.stroke();
}

function drawWave(c: Ctx2) {
  const { g, cfg, f, aw, ah, s } = c;
  const n = WAVE_LEN;
  const pts: [number, number][] = [];
  const step = Math.max(1, Math.floor(n / Math.max(64, Math.min(512, aw / 3))));
  for (let i = 0; i < n; i += step) pts.push([-aw / 2 + (i / (n - 1)) * aw, -f.wave[i] * (ah / 2)]);
  g.lineJoin = "round";
  g.lineCap = "round";
  smoothPath(g, pts, false);
  g.lineWidth = cfg.lineWidth * s;
  g.strokeStyle = c.whole;
  g.stroke();
}

function drawLissajous(c: Ctx2) {
  const { g, cfg, f, aw, ah, s } = c;
  const r = Math.min(aw, ah) / 2;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.beginPath();
  for (let i = 0; i < WAVE_LEN; i += 2) {
    const L = f.waveL[i], R = f.waveR[i];
    const x = ((L - R) / Math.SQRT2) * r;
    const y = (-(L + R) / Math.SQRT2) * r;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.lineWidth = cfg.lineWidth * s * 0.6;
  g.strokeStyle = c.whole;
  g.stroke();
}

function circleGeometry(c: Ctx2) {
  const base = Math.min(c.aw, c.ah) / 2;
  const r0 = clamp(c.cfg.radius, 0.05, 0.95) * base;
  const len = Math.max(2, base - r0);
  return { base, r0, len };
}

function spokeIndex(c: Ctx2) {
  const n = c.f.bars.length;
  const total = c.cfg.circleSymmetric ? n * 2 : n;
  return { n, total, idx: (j: number) => (c.cfg.circleSymmetric ? (j < n ? j : 2 * n - 1 - j) : j) };
}

function drawCircleBars(c: Ctx2, dots: boolean) {
  const { g, cfg, f, s } = c;
  const { r0, len } = circleGeometry(c);
  const { n, total, idx } = spokeIndex(c);
  const a0 = ((cfg.startAngle + cfg.spin * c.time) * Math.PI) / 180;
  const arc = (2 * Math.PI * r0) / total;
  const bw = Math.max(1, arc * cfg.barWidth);
  for (let j = 0; j < total; j++) {
    const i = idx(j);
    const v = f.bars[i];
    const L = Math.max(cfg.minBar * s, v * len);
    g.save();
    g.rotate(a0 + (j / total) * Math.PI * 2);
    g.fillStyle = c.paint(i, n, v);
    if (dots) {
      g.beginPath();
      g.arc(r0 + L, 0, Math.max(1, cfg.dotSize * s * 0.6), 0, Math.PI * 2);
      g.fill();
    } else {
      roundRectPath(g, r0, -bw / 2, L, bw, (cfg.barRadius * bw) / 2);
      g.fill();
      strokeIfOutline(c);
      if (cfg.peaks) {
        const pl = clamp(f.peaks[i], 0, 1) * len;
        g.fillRect(r0 + pl + 3 * s, -bw / 2, Math.max(2, 4 * s), bw);
      }
    }
    g.restore();
  }
}

function drawCircleWave(c: Ctx2) {
  const { g, cfg, f, s } = c;
  const { r0, len } = circleGeometry(c);
  const M = 360;
  const pts: [number, number][] = [];
  const a0 = ((cfg.startAngle + cfg.spin * c.time) * Math.PI) / 180;
  for (let k = 0; k < M; k++) {
    // sampel dibaurkan simetris agar ujung bertemu mulus
    const u = k / M;
    const pos = (u < 0.5 ? u * 2 : (1 - u) * 2) * (WAVE_LEN - 1);
    const w = f.wave[Math.round(pos)];
    const r = r0 + w * len * 0.5 + len * 0.15;
    const a = a0 + u * Math.PI * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  g.lineJoin = "round";
  smoothPath(g, pts, true);
  g.lineWidth = cfg.lineWidth * s;
  g.strokeStyle = c.whole;
  g.stroke();
}

function drawCircleBlob(c: Ctx2) {
  const { g, cfg, f, s } = c;
  const { r0, len } = circleGeometry(c);
  const { total, idx } = spokeIndex(c);
  const a0 = ((cfg.startAngle + cfg.spin * c.time) * Math.PI) / 180;
  const pts: [number, number][] = [];
  for (let j = 0; j < total; j++) {
    const r = r0 + clamp(f.bars[idx(j)], 0, 1) * len;
    const a = a0 + (j / total) * Math.PI * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  smoothPath(g, pts, true);
  g.fillStyle = c.whole;
  g.globalAlpha *= 0.55;
  g.fill();
  g.globalAlpha /= 0.55;
  g.lineWidth = cfg.lineWidth * s;
  g.lineJoin = "round";
  g.strokeStyle = c.whole;
  g.stroke();
}

function drawPulse(c: Ctx2) {
  const { g, cfg, f, s } = c;
  const { r0, base } = circleGeometry(c);
  const pr = Math.min(base * 0.98, r0 * (1 + 0.32 * f.bass + 0.12 * f.level));
  g.beginPath();
  g.arc(0, 0, pr, 0, Math.PI * 2);
  g.fillStyle = c.whole;
  g.globalAlpha *= 0.9;
  g.fill();
  g.globalAlpha /= 0.9;
  strokeIfOutline(c);
  for (let k = 1; k <= 3; k++) {
    const rr = Math.min(base, pr + k * (base - r0) * 0.22 * (0.5 + f.level));
    g.beginPath();
    g.arc(0, 0, rr, 0, Math.PI * 2);
    g.lineWidth = Math.max(1, cfg.lineWidth * s * (1 - k * 0.2));
    g.strokeStyle = c.whole;
    g.globalAlpha *= (0.55 * (4 - k)) / 3;
    g.stroke();
    g.globalAlpha /= (0.55 * (4 - k)) / 3;
  }
}

function drawStyle(g: CanvasRenderingContext2D, cfg: VizConfig, f: VizFrame, aw: number, ah: number, time: number) {
  const c: Ctx2 = { g, cfg, f, aw, ah, time, s: S1080(cfg), paint: makePaint(g, cfg, aw, ah, time), whole: wholePaint(g, cfg, aw, ah, time) };
  switch (cfg.style) {
    case "bars": return drawBars(c, false);
    case "bars-mirror": return drawBars(c, true);
    case "blocks": return drawSegments(c, false);
    case "dots": return drawSegments(c, true);
    case "line": return drawLineArea(c, false);
    case "area": return drawLineArea(c, true);
    case "wave": return drawWave(c);
    case "lissajous": return drawLissajous(c);
    case "circle-bars": return drawCircleBars(c, false);
    case "circle-dots": return drawCircleBars(c, true);
    case "circle-wave": return drawCircleWave(c);
    case "circle-blob": return drawCircleBlob(c);
    case "pulse": return drawPulse(c);
  }
}

// ── Kanvas sementara (pantulan) ──────────────────────────────────────────

let tempCanvas: HTMLCanvasElement | null = null;
function getTemp(w: number, h: number): HTMLCanvasElement {
  if (!tempCanvas) tempCanvas = document.createElement("canvas");
  if (tempCanvas.width !== w || tempCanvas.height !== h) {
    tempCanvas.width = w;
    tempCanvas.height = h;
  }
  return tempCanvas;
}

// ── Latar, logo, teks, progres ───────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, cfg: VizConfig, a: VizAssets, f: VizFrame, pxScale: number) {
  const W = cfg.width, H = cfg.height;
  if (cfg.bgMode === "solid") {
    ctx.fillStyle = cfg.bgColor1;
    ctx.fillRect(0, 0, W, H);
  } else if (cfg.bgMode === "gradient") {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.fillStyle = linearGradientAcross(ctx, W, H, cfg.bgAngle, [[0, cfg.bgColor1], [1, cfg.bgColor2]]);
    ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.restore();
  } else if (cfg.bgMode === "image") {
    ctx.fillStyle = cfg.bgColor1;
    ctx.fillRect(0, 0, W, H);
    const img = a.bg;
    if (img && img.width > 0) {
      const zoom = 1 + cfg.bgBeat * f.bass * 0.08 + (cfg.bgBlur > 0 ? 0.03 : 0);
      const sc = Math.max(W / img.width, H / img.height) * zoom;
      const dw = img.width * sc, dh = img.height * sc;
      ctx.save();
      if (cfg.bgBlur > 0) (ctx as any).filter = `blur(${cfg.bgBlur * pxScale * (cfg.height / 1080)}px)`;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
    }
    if (cfg.bgDim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${clamp(cfg.bgDim, 0, 0.95)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

function drawLogo(ctx: CanvasRenderingContext2D, cfg: VizConfig, a: VizAssets, f: VizFrame) {
  if (!cfg.logoOn) return;
  const img = a.logo;
  const base = Math.min(cfg.width, cfg.height) * cfg.logoSize;
  const size = base * (1 + cfg.logoBeat * f.bass);
  const x = cfg.logoX * cfg.width, y = cfg.logoY * cfg.height;
  const r = size / 2;
  ctx.save();
  ctx.translate(x, y);
  const path = () => {
    if (cfg.logoShape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else roundRectPath(ctx, -r, -r, size, size, cfg.logoShape === "rounded" ? size * 0.2 : 0);
  };
  path();
  ctx.save();
  ctx.clip();
  if (img && img.width > 0) {
    const sc = Math.max(size / img.width, size / img.height);
    ctx.drawImage(img, (-img.width * sc) / 2, (-img.height * sc) / 2, img.width * sc, img.height * sc);
  } else {
    ctx.fillStyle = "rgba(148,163,184,0.35)";
    ctx.fillRect(-r, -r, size, size);
  }
  ctx.restore();
  if (cfg.logoBorder > 0) {
    path();
    ctx.lineWidth = cfg.logoBorder * S1080(cfg);
    ctx.strokeStyle = cfg.logoBorderColor;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTexts(ctx: CanvasRenderingContext2D, cfg: VizConfig) {
  if (!cfg.title && !cfg.subtitle) return;
  const s = S1080(cfg);
  const px = cfg.textSize * s;
  const x = cfg.textX * cfg.width;
  let y = cfg.textY * cfg.height;
  ctx.save();
  ctx.textAlign = cfg.textAlign;
  ctx.textBaseline = "middle";
  ctx.fillStyle = cfg.textColor;
  if (cfg.textShadow) {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = px * 0.25;
    ctx.shadowOffsetY = px * 0.05;
  }
  const fam = fontStack(cfg.textFont);
  if (cfg.title) {
    ctx.font = `700 ${px}px ${fam}`;
    ctx.fillText(cfg.title, x, y, cfg.width * 0.94);
    y += px * 0.95;
  }
  if (cfg.subtitle) {
    ctx.font = `400 ${px * 0.55}px ${fam}`;
    ctx.globalAlpha = 0.85;
    ctx.fillText(cfg.subtitle, x, y, cfg.width * 0.94);
  }
  ctx.restore();
}

function drawProgress(ctx: CanvasRenderingContext2D, cfg: VizConfig, time: number, duration: number) {
  if (!cfg.progress || duration <= 0) return;
  const s = S1080(cfg);
  const h = Math.max(1, cfg.progressH * s);
  const margin = cfg.width * 0.05;
  const w = cfg.width - margin * 2;
  const y = cfg.progressPos === "top" ? 24 * s : cfg.height - 24 * s - h;
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = cfg.progressColor;
  roundRectPath(ctx, margin, y, w, h, h / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  roundRectPath(ctx, margin, y, Math.max(h, w * clamp(time / duration, 0, 1)), h, h / 2);
  ctx.fill();
  ctx.restore();
}

// ── Pintu masuk ──────────────────────────────────────────────────────────

/**
 * Menggambar satu frame penuh. Context harus sudah diatur skalanya sehingga
 * koordinat (0..cfg.width, 0..cfg.height) mengisi canvas; `pxScale` = piksel canvas per satuan logis.
 * Tanpa latar (bgMode "transparent") canvas dibersihkan sehingga alpha tetap utuh.
 */
export function renderViz(ctx: CanvasRenderingContext2D, cfg: VizConfig, f: VizFrame, assets: VizAssets, time: number, duration: number, pxScale = 1) {
  const W = cfg.width, H = cfg.height;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, cfg, assets, f, pxScale);

  const aw = Math.max(8, cfg.areaW * W);
  const ah = Math.max(8, cfg.areaH * H);
  const s = S1080(cfg);

  const applyLocal = (g: CanvasRenderingContext2D) => {
    g.translate(cfg.posX * W, cfg.posY * H);
    g.rotate((cfg.rotation * Math.PI) / 180);
    g.scale(cfg.mirrorX ? -1 : 1, cfg.flipY ? -1 : 1);
  };
  const glow = (g: CanvasRenderingContext2D) => {
    g.globalAlpha = clamp(cfg.opacity, 0, 1);
    if (cfg.glow > 0) {
      g.shadowColor = cfg.glowColor || (cfg.colorMode === "solid" || cfg.colorMode === "gradient" || cfg.colorMode === "level" ? cfg.color1 : "#ffffff");
      g.shadowBlur = cfg.glow * s * pxScale;
    }
  };

  // Pantulan (di bawah garis dasar) — digambar ke kanvas sementara lalu dipudarkan.
  if (cfg.reflection > 0.01 && isReflectable(cfg.style)) {
    const tmp = getTemp(Math.max(1, Math.round(W * pxScale)), Math.max(1, Math.round(H * pxScale)));
    const tg = tmp.getContext("2d")!;
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.clearRect(0, 0, tmp.width, tmp.height);
    tg.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    tg.save();
    applyLocal(tg);
    glow(tg);
    tg.translate(0, ah);
    tg.scale(1, -1);
    drawStyle(tg, cfg, f, aw, ah, time);
    tg.restore();
    tg.save();
    tg.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    applyLocal(tg);
    tg.shadowBlur = 0;
    tg.globalAlpha = 1;
    tg.globalCompositeOperation = "destination-in";
    const len = ah * clamp(cfg.reflectionLen, 0.05, 1);
    const grad = tg.createLinearGradient(0, ah / 2, 0, ah / 2 + len);
    grad.addColorStop(0, `rgba(0,0,0,${clamp(cfg.reflection, 0, 1)})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    tg.fillStyle = grad;
    tg.fillRect(-W * 2, ah / 2, W * 4, len);
    tg.restore();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // tmp sudah dalam piksel kanvas; gambar apa adanya di atas kanvas utama
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  }

  ctx.save();
  applyLocal(ctx);
  glow(ctx);
  drawStyle(ctx, cfg, f, aw, ah, time);
  ctx.restore();

  drawLogo(ctx, cfg, assets, f);
  drawTexts(ctx, cfg);
  drawProgress(ctx, cfg, time, duration);
  ctx.restore();
}

/** Frame demo animasi (pratinjau sebelum audio dimuat). */
export function demoFrame(t: number, bars: number): VizFrame {
  const b = new Float32Array(bars);
  for (let i = 0; i < bars; i++) {
    const x = i / bars;
    b[i] = clamp(0.1 + 0.55 * Math.abs(Math.sin(t * 2.1 + x * 9)) * (1 - x * 0.55) + 0.2 * Math.abs(Math.sin(t * 3.3 + x * 23)), 0, 1);
  }
  const w = new Float32Array(WAVE_LEN);
  for (let i = 0; i < WAVE_LEN; i++) w[i] = 0.55 * Math.sin(i * 0.05 + t * 6) * Math.sin(i * 0.004 + t);
  const l = new Float32Array(WAVE_LEN), r = new Float32Array(WAVE_LEN);
  for (let i = 0; i < WAVE_LEN; i++) {
    l[i] = 0.7 * Math.sin(i * 0.07 + t * 3);
    r[i] = 0.7 * Math.sin(i * 0.11 + t * 2 + 1);
  }
  return { bars: b, peaks: b.map((v) => Math.min(1, v + 0.08)), wave: w, waveL: l, waveR: r, level: 0.5 + 0.3 * Math.sin(t * 2), bass: 0.5 + 0.4 * Math.sin(t * 3.1) };
}

export { isCircleStyle };
