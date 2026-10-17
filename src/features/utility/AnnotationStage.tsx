import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  annId, boundsOf, cloneObjs, dragHandle, drawObjects, handlesOf, hitTest, moveObj,
  type AnnObj, type BlurObj, type HandleId, type LineObj, type PenObj, type ShapeObj, type StepObj, type TextObj, type ToolId,
} from "@/lib/capture/annotations";

export interface ToolStyle {
  color: string;
  width: number;
  opacity: number;
  fill: string;
  fillOpacity: number;
  radius: number;
  font: string;
  size: number;
  bold: boolean;
  bg: string;
  bgOpacity: number;
  blurMode: "blur" | "pixel";
  blurAmount: number;
}

export const DEFAULT_STYLE: ToolStyle = {
  color: "#ef4444",
  width: 6,
  opacity: 1,
  fill: "#fde047",
  fillOpacity: 0,
  radius: 0,
  font: "Alan Sans",
  size: 40,
  bold: true,
  bg: "#ffffff",
  bgOpacity: 0,
  blurMode: "pixel",
  blurAmount: 14,
};

interface Props {
  contentW: number;
  contentH: number;
  objects: AnnObj[];
  onPreview: (objs: AnnObj[]) => void;
  onCommit: (objs: AnnObj[]) => void;
  base: CanvasImageSource | null;
  tool: ToolId;
  style: ToolStyle;
  interactive: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRequestTextEdit?: (id: string) => void;
  zoom: number;
  live?: boolean; // dasar berubah terus (video) → gambar ulang berkala
  maxViewportH?: string;
  children: React.ReactNode | ((k: number) => React.ReactNode);
  testId?: string;
}

type Drag =
  | { kind: "create"; obj: AnnObj; startX: number; startY: number }
  | { kind: "move"; id: string; lastX: number; lastY: number; orig: AnnObj[] }
  | { kind: "handle"; id: string; h: HandleId; orig: AnnObj[] }
  | { kind: "erase"; orig: AnnObj[]; removed: Set<string> };

export const AnnotationStage: React.FC<Props> = ({ contentW, contentH, objects, onPreview, onCommit, base, tool, style, interactive, selectedId, onSelect, onRequestTextEdit, zoom, live, maxViewportH = "72vh", children, testId }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxW, setBoxW] = useState(600);
  const dragRef = useRef<Drag | null>(null);
  const objsRef = useRef(objects);
  objsRef.current = objects;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(Math.max(120, el.clientWidth - 2)));
    ro.observe(el);
    setBoxW(Math.max(120, el.clientWidth - 2));
    return () => ro.disconnect();
  }, []);

  const displayW = Math.max(60, Math.round(boxW * zoom));
  const k = displayW / Math.max(1, contentW); // layar px per px konten
  const displayH = Math.max(1, Math.round(contentH * k));

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const sc = Math.min(k * dpr, 16000 / Math.max(1, contentH), 16000 / Math.max(1, contentW));
    const pw = Math.max(1, Math.round(contentW * sc)), ph = Math.max(1, Math.round(contentH * sc));
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    const objs = objsRef.current;
    drawObjects(ctx, objs, base, contentW, contentH);
    // seleksi
    const sel = objs.find((o) => o.id === selectedId);
    if (sel && interactive) {
      const px = 1 / (k > 0 ? k : 1); // 1 px layar dalam px konten
      const b = boundsOf(sel);
      ctx.save();
      ctx.lineWidth = 1.5 * px;
      ctx.setLineDash([5 * px, 4 * px]);
      ctx.strokeStyle = "#6366f1";
      if (sel.type !== "line" && sel.type !== "arrow") ctx.strokeRect(b.x - 3 * px, b.y - 3 * px, b.w + 6 * px, b.h + 6 * px);
      ctx.setLineDash([]);
      for (const h of handlesOf(sel)) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, 5.5 * px, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 2 * px;
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [k, contentW, contentH, base, selectedId, interactive]);

  useEffect(() => { draw(); }, [draw, objects, displayW]);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(draw, 120);
    return () => clearInterval(id);
  }, [live, draw]);

  const toContent = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * contentW, y: ((e.clientY - r.top) / r.height) * contentH };
  };

  const tol = 9 / Math.max(0.05, k);

  const newObject = (x: number, y: number): AnnObj | null => {
    const common = { id: annId(), color: style.color, width: style.width, opacity: style.opacity };
    switch (tool) {
      case "pen": return { ...common, type: "pen", points: [x, y] } as PenObj;
      case "marker": return { ...common, type: "marker", width: Math.max(style.width * 3, 14), opacity: Math.min(style.opacity, 0.4), points: [x, y] } as PenObj;
      case "line": case "arrow": return { ...common, type: tool, x1: x, y1: y, x2: x, y2: y } as LineObj;
      case "rect": case "ellipse": return { ...common, type: tool, x, y, w: 0, h: 0, fill: style.fill, fillOpacity: style.fillOpacity, radius: style.radius } as ShapeObj;
      case "blur": return { ...common, type: "blur", x, y, w: 0, h: 0, mode: style.blurMode, amount: style.blurAmount } as BlurObj;
      case "text": return { ...common, type: "text", x, y, text: "Teks", size: style.size, font: style.font, bold: style.bold, bg: style.bg, bgOpacity: style.bgOpacity } as TextObj;
      case "step": {
        const n = objsRef.current.reduce((m, o) => (o.type === "step" ? Math.max(m, o.n) : m), 0) + 1;
        return { ...common, type: "step", x, y, n, size: Math.max(28, style.size) } as StepObj;
      }
      default: return null;
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (!interactive || e.button !== 0) return;
    const { x, y } = toContent(e);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const objs = objsRef.current;
    if (tool === "select") {
      const sel = objs.find((o) => o.id === selectedId);
      if (sel) {
        for (const h of handlesOf(sel)) {
          if (Math.hypot(h.x - x, h.y - y) <= 10 / Math.max(0.05, k)) {
            dragRef.current = { kind: "handle", id: sel.id, h: h.id, orig: cloneObjs(objs) };
            return;
          }
        }
      }
      for (let i = objs.length - 1; i >= 0; i--) {
        if (hitTest(objs[i], x, y, tol)) {
          onSelect(objs[i].id);
          dragRef.current = { kind: "move", id: objs[i].id, lastX: x, lastY: y, orig: cloneObjs(objs) };
          return;
        }
      }
      onSelect(null);
      return;
    }
    if (tool === "eraser") {
      dragRef.current = { kind: "erase", orig: cloneObjs(objs), removed: new Set() };
      eraseAt(x, y);
      return;
    }
    const o = newObject(x, y);
    if (!o) return;
    onSelect(null);
    dragRef.current = { kind: "create", obj: o, startX: x, startY: y };
    onPreview([...objs, o]);
  };

  const eraseAt = (x: number, y: number) => {
    const d = dragRef.current;
    if (!d || d.kind !== "erase") return;
    const objs = objsRef.current;
    for (let i = objs.length - 1; i >= 0; i--) {
      if (hitTest(objs[i], x, y, tol)) {
        d.removed.add(objs[i].id);
        onPreview(objs.filter((o) => o.id !== objs[i].id));
        return;
      }
    }
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const { x, y } = toContent(e);
    const objs = objsRef.current;
    if (d.kind === "erase") return eraseAt(x, y);
    if (d.kind === "move") {
      const dx = x - d.lastX, dy = y - d.lastY;
      d.lastX = x; d.lastY = y;
      onPreview(objs.map((o) => (o.id === d.id ? moveObj(o, dx, dy) : o)));
      return;
    }
    if (d.kind === "handle") {
      onPreview(objs.map((o) => (o.id === d.id ? dragHandle(o, d.h, x, y, !e.shiftKey) : o)));
      return;
    }
    // create
    let o = d.obj;
    if (o.type === "pen" || o.type === "marker") {
      const last = o.points.length;
      const dx = x - o.points[last - 2], dy = y - o.points[last - 1];
      if (Math.hypot(dx, dy) < 1.2 / Math.max(0.05, k)) return;
      o = { ...o, points: [...o.points, x, y] };
    } else if (o.type === "line" || o.type === "arrow") {
      let tx = x, ty = y;
      if (e.shiftKey) {
        const ang = Math.round(Math.atan2(y - d.startY, x - d.startX) / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(x - d.startX, y - d.startY);
        tx = d.startX + len * Math.cos(ang); ty = d.startY + len * Math.sin(ang);
      }
      o = { ...o, x2: tx, y2: ty };
    } else if (o.type === "rect" || o.type === "ellipse" || o.type === "blur") {
      let w = x - d.startX, h = y - d.startY;
      if (e.shiftKey && o.type !== "blur") { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      o = { ...o, x: d.startX, y: d.startY, w, h } as AnnObj;
    } else if (o.type === "text" || o.type === "step") {
      return; // diletakkan saat klik
    }
    d.obj = o;
    onPreview([...objs.filter((q) => q.id !== o.id), o]);
  };

  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* abaikan */ }
    if (!d) return;
    const objs = objsRef.current;
    if (d.kind === "create") {
      let o = d.obj;
      const b = boundsOf(o);
      const tiny = b.w < 3 && b.h < 3;
      const needsSize = o.type === "rect" || o.type === "ellipse" || o.type === "blur" || o.type === "line" || o.type === "arrow";
      if (needsSize && tiny) { onPreview(objs.filter((q) => q.id !== o.id)); return; }
      if (o.type === "rect" || o.type === "ellipse" || o.type === "blur") {
        o = { ...o, x: b.x, y: b.y, w: b.w, h: b.h } as AnnObj;
      }
      const next = [...objs.filter((q) => q.id !== o.id), o];
      onCommit(next);
      if (o.type === "text") { onSelect(o.id); onRequestTextEdit?.(o.id); }
      else if (o.type === "step") onSelect(o.id);
      return;
    }
    if (d.kind === "erase") {
      if (d.removed.size) onCommit(objs);
      return;
    }
    // move / handle: komit bila berubah
    if (JSON.stringify(objs.map((o) => (o.type === "image" ? { ...o, bitmap: 0 } : o))) !== JSON.stringify(d.orig.map((o) => (o.type === "image" ? { ...o, bitmap: 0 } : o)))) onCommit(objs);
  };

  const onDouble = (e: React.PointerEvent | React.MouseEvent) => {
    if (!interactive || tool !== "select") return;
    const r = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * contentW, y = ((e.clientY - r.top) / r.height) * contentH;
    const objs = objsRef.current;
    for (let i = objs.length - 1; i >= 0; i--) {
      if (objs[i].type === "text" && hitTest(objs[i], x, y, tol)) { onSelect(objs[i].id); onRequestTextEdit?.(objs[i].id); return; }
    }
  };

  // Tombol keyboard saat fokus di panggung
  const onKey = (e: React.KeyboardEvent) => {
    if (!interactive || !selectedId) return;
    const objs = objsRef.current;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onCommit(objs.filter((o) => o.id !== selectedId));
      onSelect(null);
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      onCommit(objs.map((o) => (o.id === selectedId ? moveObj(o, dx, dy) : o)));
    }
  };

  const cursor = !interactive ? "default" : tool === "select" ? "default" : tool === "text" ? "text" : tool === "eraser" ? "not-allowed" : "crosshair";

  return (
    <div ref={wrapRef} className="w-full overflow-auto rounded-xl bg-slate-100 dark:bg-slate-800" style={{ maxHeight: maxViewportH }} data-testid={testId}>
      <div style={{ position: "relative", width: displayW, height: displayH, margin: displayW < boxW ? "0 auto" : undefined }} tabIndex={0} onKeyDown={onKey} className="outline-none">
        <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>{typeof children === "function" ? children(k) : children}</div>
        <canvas
          ref={canvasRef}
          data-testid="ann-canvas"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor, pointerEvents: interactive ? "auto" : "none", maxWidth: "none" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onDoubleClick={onDouble}
        />
      </div>
    </div>
  );
};
