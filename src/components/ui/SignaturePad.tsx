import React, { useRef, useState } from "react";
import { PenLine, Upload, Eraser, Image as ImageIcon, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { fileToDataUrl } from "@/lib/file";
import { trimSignatureCanvas, makeUploadedSignatureTransparent } from "@/lib/signature";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";

const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

/**
 * SignaturePad — komponen tanda tangan bersama (Menu Spesial: Invoice,
 * Kwitansi, Struk, Sertifikat & Piagam). Mendukung dua cara input:
 * 1. "Gambar Manual" — coret langsung di kanvas dengan mouse/jari.
 * 2. "Upload Gambar" — unggah foto/scan tanda tangan (opsional: latar putih
 *    otomatis dijadikan transparan agar menyatu rapi dengan dokumen).
 *
 * Hasil akhir selalu berupa PNG data URL berlatar transparan, siap dipakai
 * lewat drawImageContain() di kanvas dokumen manapun.
 */
export const SignaturePad: React.FC<{
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  hint?: string;
}> = ({ value, onChange, label = "Tanda Tangan", hint }) => {
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [autoTransparent, setAutoTransparent] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  const getPos = (canvas: HTMLCanvasElement, e: React.PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    const p = getPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setHasStroke(true);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const p = getPos(canvas, e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const commitDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const trimmed = trimSignatureCanvas(canvas);
    onChange(trimmed ? trimmed.toDataURL("image/png") : null);
  };

  const endDraw = () => {
    if (!drawing.current) return;
    drawing.current = false;
    commitDrawing();
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
    onChange(null);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    setIsProcessing(true);
    try {
      const raw = await fileToDataUrl(file);
      const finalUrl = autoTransparent ? await makeUploadedSignatureTransparent(raw) : raw;
      onChange(finalUrl);
    } catch (err: any) {
      setUploadError(err?.message || "Gagal memuat gambar tanda tangan.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
        {value && (
          <button
            type="button"
            onClick={() => {
              clearDrawing();
            }}
            className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1.5">{hint}</p>}

      {value && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-center" style={CHECKER_STYLE}>
          <img src={value} alt="Pratinjau tanda tangan" className="max-h-20 max-w-full object-contain" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("draw")}
          aria-pressed={mode === "draw"}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all",
            mode === "draw"
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
          )}
        >
          <PenLine className="w-3.5 h-3.5" /> Gambar Manual
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          aria-pressed={mode === "upload"}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all",
            mode === "upload"
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
          )}
        >
          <Upload className="w-3.5 h-3.5" /> Upload Gambar
        </button>
      </div>

      {mode === "draw" ? (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Coret dengan mouse atau jari di kotak putih di bawah</span>
            <button type="button" onClick={clearDrawing} disabled={!hasStroke && !value} className="text-xs text-red-500 font-semibold flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none">
              <Eraser className="w-3.5 h-3.5" /> Hapus Coretan
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="w-full h-36 bg-white rounded-xl border border-slate-200 dark:border-slate-700 touch-none cursor-crosshair"
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all text-sm font-semibold text-slate-500 dark:text-slate-400">
            {isProcessing ? (
              <span className="flex items-center gap-2"><ImageIcon className="w-4 h-4 animate-pulse" /> Memproses…</span>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Pilih Gambar Tanda Tangan
              </>
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={isProcessing}
              onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
            />
          </label>
          <GamatoCheckbox
            checked={autoTransparent}
            onChange={setAutoTransparent}
            label="Hapus latar putih otomatis (untuk foto/scan di kertas putih)"
          />
          {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        </div>
      )}
    </div>
  );
};
