import React, { useCallback, useEffect, useRef, useState } from "react";
import { PenLine, Upload, Eraser, Image as ImageIcon, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { fileToDataUrl } from "@/lib/file";
import {
  makeUploadedSignatureTransparent,
  paintSignatureStrokes,
  renderSignatureStrokes,
  SIG_PAD_H,
  SIG_PAD_SCALE,
  SIG_PAD_W,
  type SigStroke,
} from "@/lib/signature";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoSlider } from "@/components/ui/GamatoSlider";

const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
};

const INK_COLORS: { value: string; label: string }[] = [
  { value: "#0f172a", label: "Hitam" },
  { value: "#1e3a8a", label: "Biru tua" },
  { value: "#2563eb", label: "Biru" },
];

/**
 * SignaturePad — komponen tanda tangan bersama (Menu Spesial: Invoice,
 * Kwitansi, Struk, Sertifikat & Piagam, Surat). Dua cara input:
 * 1. "Gambar Manual" — coret langsung di kanvas dengan mouse/jari/pena.
 * 2. "Upload Gambar" — unggah foto/scan tanda tangan (latar putih otomatis
 *    dijadikan transparan, tepi tetap halus).
 *
 * Hasil akhir selalu PNG berlatar transparan beresolusi tinggi.
 *
 * Catatan desain (hasil perbaikan bug "tanda tangan jadi double"):
 * - Coretan disimpan sebagai daftar titik lalu SELURUH coretan digambar ulang
 *   dengan satu stroke() per coretan → tidak ada garis yang ditimpa berulang
 *   kali (penyebab garis menebal/ganda), dan "Batal Coretan" bekerja akurat.
 * - Bitmap pad beresolusi 3× → tetap tajam saat diperkecil ke dokumen.
 * - Pratinjau hasil diletakkan DI BAWAH pad dengan tinggi tetap, jadi pad tidak
 *   lagi melompat turun setelah coretan pertama (coretan berikutnya tidak meleset).
 * - Bila nilai (value) berubah dari luar (Undo, ganti lapisan, unggah), coretan
 *   internal otomatis di-reset supaya tidak menumpuk ke tanda tangan lain.
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
  const [color, setColor] = useState(INK_COLORS[0].value);
  const [penWidth, setPenWidth] = useState(3.5);
  const [strokeCount, setStrokeCount] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<SigStroke[]>([]);
  const activeRef = useRef<SigStroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const lastEmitted = useRef<string | null>(value);
  const rafRef = useRef(0);
  const colorRef = useRef(color);
  const widthRef = useRef(penWidth);
  colorRef.current = color;
  widthRef.current = penWidth;

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = activeRef.current ? [...strokesRef.current, activeRef.current] : strokesRef.current;
    paintSignatureStrokes(ctx, all, { color: colorRef.current, width: widthRef.current, scale: SIG_PAD_SCALE });
  }, []);

  const scheduleRepaint = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      repaint();
    });
  }, [repaint]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const emit = useCallback(
    (strokes: SigStroke[]) => {
      const trimmed = renderSignatureStrokes(strokes, colorRef.current, widthRef.current);
      const url = trimmed ? trimmed.toDataURL("image/png") : null;
      lastEmitted.current = url;
      onChange(url);
    },
    [onChange]
  );

  // Nilai berubah dari LUAR (undo/redo, ganti lapisan, unggah, hapus) → reset coretan internal.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    strokesRef.current = [];
    activeRef.current = null;
    setStrokeCount(0);
    repaint();
  }, [value, repaint]);

  useEffect(() => {
    repaint();
  }, [mode, repaint]);

  // Warna / ketebalan pena berlaku untuk seluruh tanda tangan → gambar ulang & perbarui hasil.
  const firstStyleRun = useRef(true);
  useEffect(() => {
    if (firstStyleRun.current) {
      firstStyleRun.current = false;
      return;
    }
    repaint();
    if (strokesRef.current.length) emit(strokesRef.current);
  }, [color, penWidth, repaint, emit]);

  const toLogical = (e: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIG_PAD_W,
      y: ((e.clientY - rect.top) / rect.height) * SIG_PAD_H,
    };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (activePointer.current !== null) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture tidak tersedia — tetap lanjut */
    }
    activePointer.current = e.pointerId;
    activeRef.current = [toLogical(e)];
    scheduleRepaint();
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== e.pointerId || !activeRef.current) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    const list = events.length ? events : [e.nativeEvent];
    const stroke = activeRef.current;
    for (const ev of list) {
      const p = toLogical(ev);
      const prev = stroke[stroke.length - 1];
      if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < 0.6) continue; // abaikan getaran kecil
      stroke.push(p);
    }
    scheduleRepaint();
  };

  const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    const stroke = activeRef.current;
    activeRef.current = null;
    if (stroke && stroke.length) {
      strokesRef.current = [...strokesRef.current, stroke];
      setStrokeCount(strokesRef.current.length);
      repaint();
      emit(strokesRef.current);
    }
  };

  const undoStroke = () => {
    if (!strokesRef.current.length) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    repaint();
    emit(strokesRef.current);
  };

  const clearAll = () => {
    strokesRef.current = [];
    activeRef.current = null;
    setStrokeCount(0);
    repaint();
    lastEmitted.current = null;
    onChange(null);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    setIsProcessing(true);
    try {
      const raw = await fileToDataUrl(file);
      const finalUrl = autoTransparent ? await makeUploadedSignatureTransparent(raw) : raw;
      strokesRef.current = [];
      setStrokeCount(0);
      repaint();
      lastEmitted.current = finalUrl;
      onChange(finalUrl);
    } catch (err: any) {
      setUploadError(err?.message || "Gagal memuat gambar tanda tangan.");
    } finally {
      setIsProcessing(false);
    }
  };

  const modeBtn = (id: "draw" | "upload", icon: React.ReactNode, text: string) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      aria-pressed={mode === id}
      className={cn(
        "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all",
        mode === id
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
      )}
    >
      {icon} {text}
    </button>
  );

  return (
    <div className="space-y-3" data-testid="signature-pad">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
        <button
          type="button"
          onClick={clearAll}
          disabled={!value && strokeCount === 0}
          className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-30 disabled:pointer-events-none"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus
        </button>
      </div>
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500 -mt-1.5">{hint}</p>}

      <div className="grid grid-cols-2 gap-2">
        {modeBtn("draw", <PenLine className="w-3.5 h-3.5" />, "Gambar Manual")}
        {modeBtn("upload", <Upload className="w-3.5 h-3.5" />, "Upload Gambar")}
      </div>

      {mode === "draw" ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Coret dengan mouse, jari, atau pena di kotak putih</span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={undoStroke}
                disabled={strokeCount === 0}
                className="text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Undo2 className="w-3.5 h-3.5" /> Batal
              </button>
              <button
                type="button"
                onClick={clearAll}
                disabled={strokeCount === 0}
                className="text-xs text-red-500 font-semibold flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none"
              >
                <Eraser className="w-3.5 h-3.5" /> Bersihkan
              </button>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white" style={{ aspectRatio: `${SIG_PAD_W} / ${SIG_PAD_H}` }}>
            <div className="pointer-events-none absolute left-[6%] right-[6%] border-b border-dashed border-slate-300" style={{ top: "72%" }} aria-hidden />
            <canvas
              ref={canvasRef}
              width={SIG_PAD_W * SIG_PAD_SCALE}
              height={SIG_PAD_H * SIG_PAD_SCALE}
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerCancel={endDraw}
              aria-label="Area coret tanda tangan"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" }}
              className="cursor-crosshair"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5" role="group" aria-label="Warna tinta">
              {INK_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  aria-label={`Tinta ${c.label}`}
                  aria-pressed={color === c.value}
                  onClick={() => setColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-transform",
                    color === c.value ? "border-indigo-500 scale-110 ring-2 ring-indigo-200 dark:ring-indigo-500/30" : "border-white dark:border-slate-700 shadow"
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-[140px]">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">Tebal</span>
              <GamatoSlider min={1.5} max={8} step={0.5} value={penWidth} onChange={setPenWidth} className="flex-1" aria-label="Ketebalan pena" />
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 w-6 text-right">{penWidth}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all text-sm font-semibold text-slate-500 dark:text-slate-400">
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 animate-pulse" /> Memproses…
              </span>
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
              onChange={(e) => {
                handleUpload(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
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

      {/* Pratinjau hasil — tinggi TETAP & di bawah pad, supaya pad tidak bergeser saat coretan pertama. */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">Hasil di dokumen</p>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 h-20 flex items-center justify-center px-3" style={CHECKER_STYLE}>
          {value ? (
            <img src={value} alt="Pratinjau tanda tangan" className="max-h-16 max-w-full object-contain" />
          ) : (
            <span className="text-[11px] text-slate-400 bg-white/80 dark:bg-slate-900/80 rounded px-2 py-0.5">Belum ada tanda tangan</span>
          )}
        </div>
        {mode === "draw" && value && strokeCount === 0 && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Tanda tangan dari unggahan/riwayat sedang dipakai. Mencoret baru akan menggantikannya.</p>
        )}
      </div>
    </div>
  );
};
