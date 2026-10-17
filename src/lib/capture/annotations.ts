// Model & penggambaran anotasi untuk Capture Website. Semua koordinat dalam piksel KONTEN
// (resolusi asli tangkapan), sehingga overlay layar dan ekspor akhir memakai fungsi gambar yang sama.

import { fontStack } from "@/lib/fontPresets";

export type ToolId = "select" | "pen" | "marker" | "line" | "arrow" | "rect" | "ellipse" | "text" | "step" | "blur" | "image" | "eraser";

interface Base {
  id: string;
  color: string;
  width: number; // tebal garis (px konten)
  opacity: number;
}
export interface PenObj extends Base { type: "pen" | "marker"; points: number[] } // x,y,x,y…
export interface LineObj extends Base { type: "line" | "arrow"; x1: number; y1: number; x2: number; y2: number }
export interface ShapeObj extends Base { type: "rect" | "ellipse"; x: number; y: number; w: number; h: number; fill: string; fillOpacity: number; radius: number }
export interface TextObj extends Base { type: "text"; x: number; y: number; text: string; size: number; font: string; bold: boolean; bg: string; bgOpacity: number }
export interface StepObj extends Base { type: "step"; x: number; y: number; n: number; size: number }
export interface BlurObj extends Base { type: "blur"; x: number; y: number; w: number; h: number; mode: "blur" | "pixel"; amount: number }
export interface ImageObj extends Base { type: "image"; x: number; y: number; w: number; h: number; src: string; bitmap?: ImageBitmap | HTMLImageElement | null }

export type AnnObj = PenObj | LineObj | ShapeObj | TextObj | StepObj | BlurObj | ImageObj;

let uidn = 0;
export const annId = () => `a${Date.now().toString(36)}${(uidn++).toString(36)}`;

export interface Box { x: number; y: number; w: number; h: number }

// ── Gambar ───────────────────────────────────────────────────────────────

function arrowHead(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(14, width * 4.5);
  const spread = Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(ang - spread), y2 - len * Math.sin(ang - spread));
  ctx.lineTo(x2 - len * Math.cos(ang + spread), y2 - len * Math.sin(ang + spread));
  ctx.closePath();
  ctx.fill();
}

function pathPoints(ctx: CanvasRenderingContext2D, pts: number[]) {
  ctx.beginPath();
  if (pts.length < 4) {
    ctx.arc(pts[0], pts[1], 0.5, 0, Math.PI * 2);
    return;
  }
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length - 2; i += 2) {
    const mx = (pts[i] + pts[i + 2]) / 2, my = (pts[i + 1] + pts[i + 3]) / 2;
    ctx.quadraticCurveTo(pts[i], pts[i + 1], mx, my);
  }
  ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const nx = w < 0 ? x + w : x, ny = h < 0 ? y + h : y, nw = Math.abs(w), nh = Math.abs(h);
  const radius = Math.max(0, Math.min(r, nw / 2, nh / 2));
  ctx.beginPath();
  if (radius < 0.5) ctx.rect(nx, ny, nw, nh);
  else {
    ctx.moveTo(nx + radius, ny);
    ctx.arcTo(nx + nw, ny, nx + nw, ny + nh, radius);
    ctx.arcTo(nx + nw, ny + nh, nx, ny + nh, radius);
    ctx.arcTo(nx, ny + nh, nx, ny, radius);
    ctx.arcTo(nx, ny, nx + nw, ny, radius);
    ctx.closePath();
  }
}

function drawBlur(ctx: CanvasRenderingContext2D, o: BlurObj, base: CanvasImageSource | null, baseW: number, baseH: number) {
  if (!base) return;
  const x = Math.round(Math.min(o.x, o.x + o.w)), y = Math.round(Math.min(o.y, o.y + o.h));
  const w = Math.round(Math.abs(o.w)), h = Math.round(Math.abs(o.h));
  if (w < 2 || h < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (o.mode === "pixel") {
    const cell = Math.max(2, Math.round(o.amount));
    const sw = Math.max(1, Math.ceil(w / cell)), sh = Math.max(1, Math.ceil(h / cell));
    const tmp = document.createElement("canvas");
    tmp.width = sw;
    tmp.height = sh;
    const t = tmp.getContext("2d")!;
    t.imageSmoothingEnabled = true;
    t.drawImage(base, x, y, w, h, 0, 0, sw, sh);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, sw, sh, x, y, sw * cell, sh * cell);
    ctx.imageSmoothingEnabled = true;
  } else {
    const pad = Math.ceil(o.amount * 2);
    const sx = Math.max(0, x - pad), sy = Math.max(0, y - pad);
    const ex = Math.min(baseW, x + w + pad), ey = Math.min(baseH, y + h + pad);
    (ctx as any).filter = `blur(${o.amount}px)`;
    ctx.drawImage(base, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
    (ctx as any).filter = "none";
  }
  ctx.restore();
}

/** Menggambar semua objek. `base` dipakai oleh objek blur/pixel (isi di bawahnya). */
export function drawObjects(ctx: CanvasRenderingContext2D, objs: AnnObj[], base: CanvasImageSource | null, baseW: number, baseH: number, hideIds?: Set<string>) {
  for (const o of objs) {
    if (hideIds?.has(o.id)) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, o.opacity));
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    switch (o.type) {
      case "pen":
      case "marker": {
        ctx.strokeStyle = o.color;
        ctx.lineWidth = o.width;
        if (o.type === "marker") ctx.lineCap = "butt";
        pathPoints(ctx, o.points);
        ctx.stroke();
        break;
      }
      case "line":
      case "arrow": {
        ctx.strokeStyle = o.color;
        ctx.fillStyle = o.color;
        ctx.lineWidth = o.width;
        let ex = o.x2, ey = o.y2;
        if (o.type === "arrow") {
          const ang = Math.atan2(o.y2 - o.y1, o.x2 - o.x1);
          const back = Math.max(14, o.width * 4.5) * 0.7;
          ex = o.x2 - back * Math.cos(ang);
          ey = o.y2 - back * Math.sin(ang);
        }
        ctx.beginPath();
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (o.type === "arrow") arrowHead(ctx, o.x1, o.y1, o.x2, o.y2, o.width);
        break;
      }
      case "rect":
      case "ellipse": {
        if (o.type === "rect") rr(ctx, o.x, o.y, o.w, o.h, o.radius);
        else {
          ctx.beginPath();
          ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, Math.abs(o.w) / 2, Math.abs(o.h) / 2, 0, 0, Math.PI * 2);
        }
        if (o.fill && o.fillOpacity > 0) {
          ctx.save();
          ctx.globalAlpha *= o.fillOpacity;
          ctx.fillStyle = o.fill;
          ctx.fill();
          ctx.restore();
        }
        if (o.width > 0) {
          ctx.strokeStyle = o.color;
          ctx.lineWidth = o.width;
          ctx.stroke();
        }
        break;
      }
      case "text": {
        const lines = (o.text || " ").split("\n");
        ctx.font = `${o.bold ? "700" : "400"} ${o.size}px ${fontStack(o.font)}`;
        ctx.textBaseline = "top";
        const lh = o.size * 1.25;
        const wmax = Math.max(...lines.map((l) => ctx.measureText(l).width));
        if (o.bg && o.bgOpacity > 0) {
          ctx.save();
          ctx.globalAlpha *= o.bgOpacity;
          ctx.fillStyle = o.bg;
          rr(ctx, o.x - o.size * 0.3, o.y - o.size * 0.2, wmax + o.size * 0.6, lh * lines.length + o.size * 0.15, o.size * 0.25);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = o.color;
        lines.forEach((l, i) => ctx.fillText(l, o.x, o.y + i * lh));
        break;
      }
      case "step": {
        const r = o.size / 2;
        ctx.beginPath();
        ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
        ctx.fillStyle = o.color;
        ctx.fill();
        ctx.lineWidth = Math.max(2, o.size * 0.08);
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${o.size * 0.55}px ${fontStack("Alan Sans")}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(o.n), o.x, o.y + o.size * 0.03);
        break;
      }
      case "blur":
        drawBlur(ctx, o, base, baseW, baseH);
        break;
      case "image": {
        if (o.bitmap) ctx.drawImage(o.bitmap, o.x, o.y, o.w, o.h);
        break;
      }
    }
    ctx.restore();
  }
}

// ── Kotak, hit-test, transformasi ────────────────────────────────────────

export function measureText(o: TextObj): Box {
  const c = (measureText as any)._c ?? ((measureText as any)._c = document.createElement("canvas").getContext("2d")!);
  c.font = `${o.bold ? "700" : "400"} ${o.size}px ${fontStack(o.font)}`;
  const lines = (o.text || " ").split("\n");
  const w = Math.max(...lines.map((l: string) => c.measureText(l).width));
  return { x: o.x, y: o.y, w, h: o.size * 1.25 * lines.length };
}

export function boundsOf(o: AnnObj): Box {
  switch (o.type) {
    case "pen":
    case "marker": {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < o.points.length; i += 2) {
        x0 = Math.min(x0, o.points[i]); x1 = Math.max(x1, o.points[i]);
        y0 = Math.min(y0, o.points[i + 1]); y1 = Math.max(y1, o.points[i + 1]);
      }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    case "line":
    case "arrow":
      return { x: Math.min(o.x1, o.x2), y: Math.min(o.y1, o.y2), w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
    case "rect":
    case "ellipse":
    case "blur":
    case "image":
      return { x: Math.min(o.x, o.x + o.w), y: Math.min(o.y, o.y + o.h), w: Math.abs(o.w), h: Math.abs(o.h) };
    case "text":
      return measureText(o);
    case "step":
      return { x: o.x - o.size / 2, y: o.y - o.size / 2, w: o.size, h: o.size };
  }
}

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - x1) * dx + (py - y1) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** tol = toleransi dalam px konten (≈ 8 px layar). */
export function hitTest(o: AnnObj, px: number, py: number, tol: number): boolean {
  switch (o.type) {
    case "pen":
    case "marker": {
      const t = Math.max(tol, o.width / 2 + 2);
      for (let i = 0; i + 3 < o.points.length; i += 2) if (distToSeg(px, py, o.points[i], o.points[i + 1], o.points[i + 2], o.points[i + 3]) <= t) return true;
      return o.points.length === 2 && Math.hypot(px - o.points[0], py - o.points[1]) <= t;
    }
    case "line":
    case "arrow":
      return distToSeg(px, py, o.x1, o.y1, o.x2, o.y2) <= Math.max(tol, o.width / 2 + 2);
    case "ellipse": {
      const b = boundsOf(o);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      const rx = b.w / 2 + tol, ry = b.h / 2 + tol;
      const v = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
      if (o.fill && o.fillOpacity > 0.02) return v <= 1;
      const rx2 = Math.max(1, b.w / 2 - tol), ry2 = Math.max(1, b.h / 2 - tol);
      return v <= 1 && ((px - cx) / rx2) ** 2 + ((py - cy) / ry2) ** 2 >= 1;
    }
    case "rect": {
      const b = boundsOf(o);
      const inside = px >= b.x - tol && px <= b.x + b.w + tol && py >= b.y - tol && py <= b.y + b.h + tol;
      if (!inside) return false;
      if (o.fill && o.fillOpacity > 0.02) return true;
      const inner = px > b.x + tol && px < b.x + b.w - tol && py > b.y + tol && py < b.y + b.h - tol;
      return !inner;
    }
    case "step": {
      return Math.hypot(px - o.x, py - o.y) <= o.size / 2 + tol * 0.5;
    }
    default: {
      const b = boundsOf(o);
      return px >= b.x - tol * 0.5 && px <= b.x + b.w + tol * 0.5 && py >= b.y - tol * 0.5 && py <= b.y + b.h + tol * 0.5;
    }
  }
}

export function moveObj(o: AnnObj, dx: number, dy: number): AnnObj {
  switch (o.type) {
    case "pen":
    case "marker":
      return { ...o, points: o.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) };
    case "line":
    case "arrow":
      return { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
    default:
      return { ...o, x: (o as any).x + dx, y: (o as any).y + dy } as AnnObj;
  }
}

export type HandleId = "nw" | "ne" | "sw" | "se" | "p1" | "p2";

export function handlesOf(o: AnnObj): { id: HandleId; x: number; y: number }[] {
  if (o.type === "line" || o.type === "arrow") return [{ id: "p1", x: o.x1, y: o.y1 }, { id: "p2", x: o.x2, y: o.y2 }];
  if (o.type === "rect" || o.type === "ellipse" || o.type === "blur" || o.type === "image") {
    const b = boundsOf(o);
    return [{ id: "nw", x: b.x, y: b.y }, { id: "ne", x: b.x + b.w, y: b.y }, { id: "sw", x: b.x, y: b.y + b.h }, { id: "se", x: b.x + b.w, y: b.y + b.h }];
  }
  if (o.type === "text") {
    const b = boundsOf(o);
    return [{ id: "se", x: b.x + b.w, y: b.y + b.h }];
  }
  if (o.type === "step") return [{ id: "se", x: o.x + o.size / 2, y: o.y + o.size / 2 }];
  return [];
}

export function dragHandle(o: AnnObj, h: HandleId, x: number, y: number, keepRatio: boolean): AnnObj {
  switch (o.type) {
    case "line":
    case "arrow":
      return h === "p1" ? { ...o, x1: x, y1: y } : { ...o, x2: x, y2: y };
    case "rect":
    case "ellipse":
    case "blur":
    case "image": {
      const b = boundsOf(o);
      let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
      if (h === "nw") { x0 = x; y0 = y; }
      if (h === "ne") { x1 = x; y0 = y; }
      if (h === "sw") { x0 = x; y1 = y; }
      if (h === "se") { x1 = x; y1 = y; }
      if (keepRatio && o.type === "image" && b.w > 0 && b.h > 0) {
        const ratio = b.w / b.h;
        const w = Math.abs(x1 - x0);
        const hh = w / ratio;
        if (h === "nw" || h === "ne") y0 = y1 - hh;
        else y1 = y0 + hh;
      }
      return { ...o, x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) } as AnnObj;
    }
    case "text": {
      const b = boundsOf(o);
      const k = Math.max(0.2, (y - b.y) / Math.max(1, b.h));
      return { ...o, size: Math.max(8, Math.min(400, Math.round(o.size * k))) };
    }
    case "step":
      return { ...o, size: Math.max(16, Math.min(300, Math.round(Math.hypot(x - o.x, y - o.y) * 2 * 0.92))) };
    default:
      return o;
  }
}

export function cloneObjs(objs: AnnObj[]): AnnObj[] {
  return objs.map((o) => (o.type === "pen" || o.type === "marker" ? { ...o, points: o.points.slice() } : { ...o }));
}

/** Menggabungkan objek ke gambar dasar → kanvas baru. */
export function flatten(base: CanvasImageSource, w: number, h: number, objs: AnnObj[]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(base, 0, 0, w, h);
  drawObjects(ctx, objs, base, w, h);
  return c;
}

/** Menggeser (dx,dy) lalu menskalakan seluruh objek — dipakai saat anotasi live dipindah ke hasil tangkapan. */
export function transformObjs(objs: AnnObj[], scale: number, dx = 0, dy = 0): AnnObj[] {
  const X = (v: number) => (v + dx) * scale;
  const Y = (v: number) => (v + dy) * scale;
  return objs.map((o): AnnObj => {
    switch (o.type) {
      case "pen":
      case "marker":
        return { ...o, width: o.width * scale, points: o.points.map((v, i) => (i % 2 === 0 ? X(v) : Y(v))) };
      case "line":
      case "arrow":
        return { ...o, width: o.width * scale, x1: X(o.x1), y1: Y(o.y1), x2: X(o.x2), y2: Y(o.y2) };
      case "rect":
      case "ellipse":
        return { ...o, width: o.width * scale, radius: o.radius * scale, x: X(o.x), y: Y(o.y), w: o.w * scale, h: o.h * scale };
      case "blur":
        return { ...o, x: X(o.x), y: Y(o.y), w: o.w * scale, h: o.h * scale, amount: o.amount * scale };
      case "image":
        return { ...o, x: X(o.x), y: Y(o.y), w: o.w * scale, h: o.h * scale };
      case "text":
        return { ...o, x: X(o.x), y: Y(o.y), size: o.size * scale };
      case "step":
        return { ...o, x: X(o.x), y: Y(o.y), size: o.size * scale };
    }
  });
}
