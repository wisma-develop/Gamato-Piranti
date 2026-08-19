import React, { useEffect, useRef, useState } from "react";
import { AlignLeft, AlignCenter, AlignRight, WrapText, Crop as CropIcon, Trash2, Check, X } from "lucide-react";
import { cmdSetImageAlign, cmdDeleteImage, type ImageAlignValue } from "../richtext/commands";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface ImageInspectorProps {
  /** Positioning context — the scrollable wrapper the editor lives in. */
  containerRef: React.RefObject<HTMLDivElement>;
  img: HTMLImageElement;
  onChanged: () => void; // called after any mutation so DocTools can re-sync stats/history
  onDeselect: () => void;
}

const ALIGN_OPTIONS: { value: ImageAlignValue; label: string; icon: React.ReactNode }[] = [
  { value: "left", label: "Rata kiri", icon: <AlignLeft className="w-4 h-4" /> },
  { value: "center", label: "Rata tengah", icon: <AlignCenter className="w-4 h-4" /> },
  { value: "right", label: "Rata kanan", icon: <AlignRight className="w-4 h-4" /> },
  { value: "float-left", label: "Kiri, teks melingkar", icon: <WrapText className="w-4 h-4 -scale-x-100" /> },
  { value: "float-right", label: "Kanan, teks melingkar", icon: <WrapText className="w-4 h-4" /> },
];

function getRectRelativeTo(el: HTMLElement, containerEl: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  const c = containerEl.getBoundingClientRect();
  return {
    top: r.top - c.top + containerEl.scrollTop,
    left: r.left - c.left + containerEl.scrollLeft,
    width: r.width,
    height: r.height,
  };
}

/**
 * Floating selection UI for an <img> inside the Doc Studio contentEditable
 * editor: corner resize handles (aspect-ratio locked), an alignment/position
 * mini-toolbar, and a real pixel-crop tool. All mutations are applied
 * directly to the actual <img> element (src/width/height/data-align), so
 * whatever the user sees here is exactly what parseEditor.ts will pick up
 * for the .docx/.pdf export — no separate "preview vs export" model to fall
 * out of sync.
 */
export const ImageInspector: React.FC<ImageInspectorProps> = ({ containerRef, img, onChanged, onDeselect }) => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [crop, setCrop] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const dragState = useRef<{ mode: string; startX: number; startY: number; startW: number; startH: number; aspect: number } | null>(null);
  const cropDragState = useRef<{ mode: string; startX: number; startY: number; start: typeof crop } | null>(null);

  const refresh = () => {
    const container = containerRef.current;
    if (!container) return;
    setRect(getRectRelativeTo(img, container));
  };

  useEffect(() => {
    refresh();
    const onResize = () => refresh();
    window.addEventListener("resize", onResize);
    const container = containerRef.current;
    container?.addEventListener("scroll", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      container?.removeEventListener("scroll", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img]);

  const applyAlign = (value: ImageAlignValue) => {
    cmdSetImageAlign(img, value);
    onChanged();
    requestAnimationFrame(refresh);
  };

  const handleDelete = () => {
    cmdDeleteImage(img);
    onChanged();
    onDeselect();
  };

  // ─── Resize (corner handles, aspect-ratio locked) ──────────────────────
  const startResize = (corner: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const w = img.getBoundingClientRect().width;
    const h = img.getBoundingClientRect().height;
    dragState.current = { mode: corner, startX: e.clientX, startY: e.clientY, startW: w, startH: h, aspect: w / h || 1 };
    const onMove = (ev: PointerEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      const dx = ev.clientX - ds.startX;
      const sign = ds.mode.includes("e") ? 1 : -1;
      let newW = Math.max(40, ds.startW + dx * sign);
      const newH = newW / ds.aspect;
      img.style.width = `${Math.round(newW)}px`;
      img.style.height = `${Math.round(newH)}px`;
      refresh();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragState.current = null;
      onChanged();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ─── Crop rectangle dragging ────────────────────────────────────────────
  const startCropDrag = (mode: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    cropDragState.current = { mode, startX: e.clientX, startY: e.clientY, start: crop };
    const imgW = rect?.width || 1;
    const imgH = rect?.height || 1;
    const onMove = (ev: PointerEvent) => {
      const ds = cropDragState.current;
      if (!ds) return;
      const dxFrac = (ev.clientX - ds.startX) / imgW;
      const dyFrac = (ev.clientY - ds.startY) / imgH;
      setCrop((prev) => {
        let { x, y, w, h } = ds.start;
        if (ds.mode === "move") {
          x = clamp(ds.start.x + dxFrac, 0, 1 - ds.start.w);
          y = clamp(ds.start.y + dyFrac, 0, 1 - ds.start.h);
        } else {
          let left = ds.start.x;
          let top = ds.start.y;
          let right = ds.start.x + ds.start.w;
          let bottom = ds.start.y + ds.start.h;
          if (ds.mode.includes("e")) right = clamp(right + dxFrac, left + 0.06, 1);
          if (ds.mode.includes("w")) left = clamp(left + dxFrac, 0, right - 0.06);
          if (ds.mode.includes("s")) bottom = clamp(bottom + dyFrac, top + 0.06, 1);
          if (ds.mode.includes("n")) top = clamp(top + dyFrac, 0, bottom - 0.06);
          x = left;
          y = top;
          w = right - left;
          h = bottom - top;
        }
        return { x, y, w, h };
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      cropDragState.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const enterCropMode = () => {
    setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
    setCropMode(true);
  };

  const applyCrop = () => {
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    const sx = Math.round(crop.x * naturalW);
    const sy = Math.round(crop.y * naturalH);
    const sw = Math.max(1, Math.round(crop.w * naturalW));
    const sh = Math.max(1, Math.round(crop.h * naturalH));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCropMode(false);
      return;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    // Real pixel crop — the exported .docx/.pdf will contain exactly this
    // cropped bitmap, not the original photo with a CSS clip on top.
    img.src = canvas.toDataURL("image/png");
    img.style.width = "";
    img.style.height = "";
    setCropMode(false);
    onChanged();
    requestAnimationFrame(refresh);
  };

  if (!rect) return null;

  return (
    <>
      {/* Selection outline + resize handles */}
      <div
        className="absolute pointer-events-none border-2 border-indigo-500 rounded-sm"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      >
        {!cropMode &&
          (["nw", "ne", "sw", "se"] as const).map((corner) => (
            <div
              key={corner}
              onPointerDown={startResize(corner)}
              className={`pointer-events-auto absolute w-3.5 h-3.5 bg-indigo-600 border-2 border-white rounded-full shadow ${
                corner === "nw" ? "-top-1.5 -left-1.5 cursor-nwse-resize" : corner === "ne" ? "-top-1.5 -right-1.5 cursor-nesw-resize" : corner === "sw" ? "-bottom-1.5 -left-1.5 cursor-nesw-resize" : "-bottom-1.5 -right-1.5 cursor-nwse-resize"
              }`}
            />
          ))}
      </div>

      {/* Crop rectangle overlay — four dimming panels around the selection,
          so the math is plain arithmetic (no background-position tricks
          that could subtly misalign the preview). */}
      {cropMode && (
        <div className="absolute" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}>
          <div className="absolute bg-black/50 pointer-events-none" style={{ top: 0, left: 0, right: 0, height: `${crop.y * 100}%` }} />
          <div className="absolute bg-black/50 pointer-events-none" style={{ bottom: 0, left: 0, right: 0, height: `${(1 - crop.y - crop.h) * 100}%` }} />
          <div className="absolute bg-black/50 pointer-events-none" style={{ top: `${crop.y * 100}%`, left: 0, width: `${crop.x * 100}%`, height: `${crop.h * 100}%` }} />
          <div className="absolute bg-black/50 pointer-events-none" style={{ top: `${crop.y * 100}%`, right: 0, width: `${(1 - crop.x - crop.w) * 100}%`, height: `${crop.h * 100}%` }} />
          <div
            onPointerDown={startCropDrag("move")}
            className="absolute pointer-events-auto border-2 border-white cursor-move"
            style={{ top: `${crop.y * 100}%`, left: `${crop.x * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
          >
            {(["nw", "ne", "sw", "se"] as const).map((corner) => (
              <div
                key={corner}
                onPointerDown={startCropDrag(corner)}
                className={`pointer-events-auto absolute w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-full shadow ${
                  corner === "nw" ? "-top-1.5 -left-1.5 cursor-nwse-resize" : corner === "ne" ? "-top-1.5 -right-1.5 cursor-nesw-resize" : corner === "sw" ? "-bottom-1.5 -left-1.5 cursor-nesw-resize" : "-bottom-1.5 -right-1.5 cursor-nwse-resize"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Floating mini toolbar */}
      <div
        className="absolute z-20 flex items-center gap-0.5 bg-slate-900 text-white rounded-xl shadow-lg px-1.5 py-1"
        style={{ top: Math.max(0, rect.top - 42), left: rect.left }}
      >
        {cropMode ? (
          <>
            <button type="button" title="Terapkan crop" onClick={applyCrop} className="h-7 px-2 inline-flex items-center gap-1 rounded-lg text-xs font-semibold hover:bg-white/10">
              <Check className="w-3.5 h-3.5" /> Terapkan
            </button>
            <button type="button" title="Batal" onClick={() => setCropMode(false)} className="h-7 px-2 inline-flex items-center gap-1 rounded-lg text-xs font-semibold hover:bg-white/10">
              <X className="w-3.5 h-3.5" /> Batal
            </button>
          </>
        ) : (
          <>
            {ALIGN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.label}
                onClick={() => applyAlign(opt.value)}
                className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-white/10 shrink-0"
              >
                {opt.icon}
              </button>
            ))}
            <div className="w-px h-5 bg-white/20 mx-0.5 shrink-0" />
            <button type="button" title="Potong (crop)" onClick={enterCropMode} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-white/10 shrink-0">
              <CropIcon className="w-4 h-4" />
            </button>
            <button type="button" title="Hapus gambar" onClick={handleDelete} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-500/80 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </>
  );
};

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
