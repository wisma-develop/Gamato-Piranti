import React, { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Image as ImageIcon, RotateCw, Loader2, Download, RefreshCw } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { loadImageFromUrl, canvasToBlob } from "@/lib/canvas";
import { Btn, Label, Select } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";

const DEFAULTS = { brightness: 100, contrast: 100, saturation: 100, blur: 0, grayscale: 0, sepia: 0, invert: 0, hue: 0 };

type PhotoAdjustments = typeof DEFAULTS & { rotateDeg: number; flipH: boolean; flipV: boolean; outputFormat: "png" | "jpeg" };

const DEFAULT_ADJUSTMENTS: PhotoAdjustments = { ...DEFAULTS, rotateDeg: 0, flipH: false, flipV: false, outputFormat: "png" };

export const PhotoEditor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Semua slider penyesuaian, rotasi/flip, dan format output punya riwayat
  // Undo/Redo (digabung jadi satu langkah setelah jeda singkat). Nama
  // variabel & setter dipertahankan sama persis supaya JSX di bawah tidak
  // perlu diubah satu per satu.
  const adjHistory = useHistoryState<PhotoAdjustments>(() => DEFAULT_ADJUSTMENTS);
  const adjustments = adjHistory.state;
  const { schedule: scheduleAdjCommit } = useDebouncedCommit(adjHistory.commit, 500);
  function setAdjField<K extends keyof PhotoAdjustments>(key: K, value: PhotoAdjustments[K]) {
    adjHistory.set((prev) => ({ ...prev, [key]: value }), { commit: false });
    scheduleAdjCommit();
  }
  const { brightness, contrast, saturation, blur, grayscale, sepia, invert, hue, rotateDeg, flipH, flipV, outputFormat } = adjustments;
  const setBrightness = (v: number) => setAdjField("brightness", v);
  const setContrast = (v: number) => setAdjField("contrast", v);
  const setSaturation = (v: number) => setAdjField("saturation", v);
  const setBlur = (v: number) => setAdjField("blur", v);
  const setGrayscale = (v: number) => setAdjField("grayscale", v);
  const setSepia = (v: number) => setAdjField("sepia", v);
  const setInvert = (v: number) => setAdjField("invert", v);
  const setHue = (v: number) => setAdjField("hue", v);
  const setRotateDeg = (updater: number | ((prev: number) => number)) =>
    setAdjField("rotateDeg", typeof updater === "function" ? (updater as (p: number) => number)(rotateDeg) : updater);
  const setFlipH = (updater: boolean | ((prev: boolean) => boolean)) =>
    setAdjField("flipH", typeof updater === "function" ? (updater as (p: boolean) => boolean)(flipH) : updater);
  const setFlipV = (updater: boolean | ((prev: boolean) => boolean)) =>
    setAdjField("flipV", typeof updater === "function" ? (updater as (p: boolean) => boolean)(flipV) : updater);
  const setOutputFormat = (v: "png" | "jpeg") => setAdjField("outputFormat", v);

  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = async (incoming: File[]) => {
    const f = incoming.find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = URL.createObjectURL(f);
    const image = await loadImageFromUrl(url);
    URL.revokeObjectURL(url);
    setFile(f);
    setImg(image);
    adjHistory.reset(DEFAULT_ADJUSTMENTS); // gambar baru = mulai riwayat baru
    setInfo(null);
  };

  const resetAdjustments = () => {
    adjHistory.set(DEFAULT_ADJUSTMENTS);
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const rotated90 = rotateDeg === 90 || rotateDeg === 270;
    const w = rotated90 ? img.naturalHeight : img.naturalWidth;
    const h = rotated90 ? img.naturalWidth : img.naturalHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px) grayscale(${grayscale}%) sepia(${sepia}%) invert(${invert}%) hue-rotate(${hue}deg)`;
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotateDeg * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  };

  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, brightness, contrast, saturation, blur, grayscale, sepia, invert, hue, rotateDeg, flipH, flipV]);

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    setIsWorking(true);
    try {
      const mime = outputFormat === "png" ? "image/png" : "image/jpeg";
      const blob = await canvasToBlob(canvasRef.current, mime, mime === "image/jpeg" ? 0.92 : undefined);
      const base = (file?.name || "gambar").replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}-edited.${outputFormat === "png" ? "png" : "jpg"}`);
      setInfo("Gambar hasil edit berhasil diunduh.");
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal memproses gambar."));
    } finally {
      setIsWorking(false);
    }
  };

  const sliders: { label: string; value: number; setValue: (v: number) => void; min: number; max: number; unit: string }[] = [
    { label: "Kecerahan (Brightness)", value: brightness, setValue: setBrightness, min: 0, max: 200, unit: "%" },
    { label: "Kontras (Contrast)", value: contrast, setValue: setContrast, min: 0, max: 200, unit: "%" },
    { label: "Saturasi (Saturation)", value: saturation, setValue: setSaturation, min: 0, max: 200, unit: "%" },
    { label: "Blur", value: blur, setValue: setBlur, min: 0, max: 20, unit: "px" },
    { label: "Hitam-Putih (Grayscale)", value: grayscale, setValue: setGrayscale, min: 0, max: 100, unit: "%" },
    { label: "Sephia", value: sepia, setValue: setSepia, min: 0, max: 100, unit: "%" },
    { label: "Invert Warna", value: invert, setValue: setInvert, min: 0, max: 100, unit: "%" },
    { label: "Hue Rotate", value: hue, setValue: setHue, min: 0, max: 360, unit: "°" },
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-5">
        {!img ? (
          <Dropzone
            onFiles={addFiles}
            accept="image/*"
            multiple={false}
            label="Drop gambar di sini"
            sublabel="JPG, PNG, WEBP"
            icon={<ImageIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file?.name}</p>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setImg(null);
                  setInfo(null);
                }}
                className="text-sm text-red-500 font-semibold hover:text-red-700 shrink-0"
              >
                Ganti File
              </button>
            </div>
            <div className="p-4 flex justify-center bg-slate-100 dark:bg-slate-950">
              <canvas ref={canvasRef} className="max-w-full max-h-[460px] rounded-lg shadow" />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Putar &amp; Balik</p>
            <div className="flex items-center gap-2">
              <UndoRedoBar canUndo={adjHistory.canUndo} canRedo={adjHistory.canRedo} onUndo={adjHistory.undo} onRedo={adjHistory.redo} hideLabel />
              <button type="button" onClick={resetAdjustments} disabled={!img} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-40 shrink-0">
                <RefreshCw className="w-3.5 h-3.5" /> Reset semua
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => setRotateDeg((d) => (d + 90) % 360)} disabled={!img} variant="secondary" className="text-xs gap-1.5">
              <RotateCw className="w-3.5 h-3.5" /> Putar 90°
            </Btn>
            <Btn onClick={() => setFlipH((v) => !v)} disabled={!img} variant={flipH ? "primary" : "secondary"} className="text-xs">
              Balik Horizontal
            </Btn>
            <Btn onClick={() => setFlipV((v) => !v)} disabled={!img} variant={flipV ? "primary" : "secondary"} className="text-xs">
              Balik Vertikal
            </Btn>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Penyesuaian Warna</p>
          {sliders.map((s) => (
            <div key={s.label}>
              <div className="flex justify-between items-center mb-1.5">
                <Label>{s.label}</Label>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {s.value}
                  {s.unit}
                </span>
              </div>
              <GamatoSlider
                min={s.min}
                max={s.max}
                value={s.value}
                disabled={!img}
                onChange={s.setValue}
                aria-label={s.label}
              />
            </div>
          ))}
          <Select label="Format Output" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as any)}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </Select>
        </div>

        {info && (
          <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", info.startsWith("Gagal") ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>
            {info}
          </div>
        )}

        <Btn onClick={handleDownload} disabled={isWorking || !img} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Unduh Hasil Edit
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<SlidersHorizontal className="w-5 h-5" />}
        label="Photo Editor"
        desc="Filter & penyesuaian warna"
        points={[
          "Semua penyesuaian dihitung ulang dari gambar asli — bebas diubah-ubah tanpa menumpuk efek.",
          "Kombinasikan dengan Crop, Watermark, atau Hapus Metadata untuk hasil akhir yang siap pakai.",
        ]}
      />
    </div>
  );
};
