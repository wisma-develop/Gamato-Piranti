import React, { useEffect, useMemo, useRef, useState } from "react";
import { Crop as CropIcon, Upload, Download, Loader2, Move } from "lucide-react";
import { cn } from "@/utils/cn";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoPlayer } from "@/components/ui/GamatoPlayer";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { TimeRangeSlider } from "@/components/ui/TimeRangeSlider";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { Btn } from "@/components/ui/primitives";
import { useVideoFile } from "@/hooks/useVideoFile";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import { formatTime, exportSegmentedVideo, getBestExportFormat, type ExportFormat } from "@/lib/videoEngine";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";

type CropBox = { x: number; y: number; w: number; h: number };

const ASPECT_PRESETS = [
  { id: "original", label: "Asli", ratio: null as number | null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
];

function fitBox(videoW: number, videoH: number, ratio: number, scale: number): CropBox {
  let w = videoW;
  let h = videoW / ratio;
  if (h > videoH) {
    h = videoH;
    w = videoH * ratio;
  }
  w *= scale;
  h *= scale;
  return { x: (videoW - w) / 2, y: (videoH - h) / 2, w, h };
}

export function VideoCrop() {
  const { meta, error: loadError, isLoading, load, reset } = useVideoFile();
  const [presetId, setPresetId] = useState("original");
  const [scale, setScale] = useState(1);
  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFormat, setResultFormat] = useState<ExportFormat | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const format = useMemo(() => getBestExportFormat(), []);

  useEffect(() => {
    if (!meta) return;
    setTrimStart(0);
    setTrimEnd(meta.duration);
    setPresetId("original");
    setScale(1);
    setCropBox(fitBox(meta.width, meta.height, meta.width / meta.height, 1));
    setResultUrl(null);
    setExportError(null);
  }, [meta]);

  const applyPreset = (id: string, s: number) => {
    if (!meta) return;
    const preset = ASPECT_PRESETS.find((p) => p.id === id);
    const ratio = preset?.ratio ?? meta.width / meta.height;
    setPresetId(id);
    setScale(s);
    setCropBox(fitBox(meta.width, meta.height, ratio, s));
  };

  const handleFiles = (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("video/"));
    if (file) load(file);
  };

  const beginDragBox = (e: React.PointerEvent) => {
    if (!meta || !cropBox || !containerRef.current) return;
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = meta.width / rect.width;
    const scaleY = meta.height / rect.height;
    const startX = e.clientX;
    const startY = e.clientY;
    const startBox = { ...cropBox };

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) * scaleX;
      const dy = (ev.clientY - startY) * scaleY;
      const newX = Math.min(Math.max(0, startBox.x + dx), meta.width - startBox.w);
      const newY = Math.min(Math.max(0, startBox.y + dy), meta.height - startBox.h);
      setCropBox({ ...startBox, x: newX, y: newY });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const runExport = async () => {
    if (!meta || !cropBox) return;
    setIsExporting(true);
    setExportError(null);
    setProgress(0);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    try {
      const outW = Math.max(2, Math.round(cropBox.w / 2) * 2);
      const outH = Math.max(2, Math.round(cropBox.h / 2) * 2);
      const blob = await exportSegmentedVideo({
        sourceUrl: meta.url,
        segments: [{ start: trimStart, end: trimEnd }],
        outputWidth: outW,
        outputHeight: outH,
        drawFrame: (ctx, video, canvas) => {
          ctx.drawImage(video, cropBox.x, cropBox.y, cropBox.w, cropBox.h, 0, 0, canvas.width, canvas.height);
        },
        onProgress: setProgress,
      });
      setResultFormat(getBestExportFormat());
      setResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setExportError(err?.message || "Gagal meng-crop video.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadResult = async () => {
    if (!resultUrl || !resultFormat) return;
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    downloadBlob(blob, `${sanitizeFileName(meta?.file.name.replace(/\.[^.]+$/, "") || "video")}-crop.${resultFormat.ext}`);
  };

  return (
    <div className="space-y-4">
      <GamatoDesktopRecommended toolName="Crop & Resize Video" />
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-4">
        {!meta ? (
          <Dropzone
            onFiles={handleFiles}
            accept="video/*"
            multiple={false}
            label={isLoading ? "Memuat video…" : "Drop video di sini"}
            sublabel="MP4, WebM, MOV — diproses langsung di browser"
            icon={<Upload className="w-8 h-8" />}
          />
        ) : (
          <>
            <div ref={containerRef} className="relative rounded-2xl overflow-hidden shadow-sm">
              <GamatoPlayer src={meta.url} label={meta.file.name} onTimeUpdate={setPlayhead} />
              {cropBox && (
                <div
                  onPointerDown={beginDragBox}
                  className="absolute z-30 border-2 border-indigo-400 bg-indigo-400/10 cursor-move flex items-center justify-center"
                  style={{
                    left: `${(cropBox.x / meta.width) * 100}%`,
                    top: `${(cropBox.y / meta.height) * 100}%`,
                    width: `${(cropBox.w / meta.width) * 100}%`,
                    height: `${(cropBox.h / meta.height) * 100}%`,
                  }}
                >
                  <Move className="w-5 h-5 text-white/80 drop-shadow" />
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Rasio Crop</p>
                <div className="flex flex-wrap gap-2">
                  {ASPECT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id, scale)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
                        presetId === p.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ukuran Crop</p>
                  <span className="text-xs font-mono text-slate-400">{Math.round(scale * 100)}%</span>
                </div>
                <GamatoSlider min={0.2} max={1} step={0.01} value={scale} onChange={(v) => applyPreset(presetId, v)} aria-label="Ukuran crop" />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Geser kotak di video untuk mengatur posisi crop.</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Rentang Waktu</p>
                <TimeRangeSlider duration={meta.duration} start={trimStart} end={trimEnd} onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); }} playhead={playhead} />
              </div>

              {cropBox && (
                <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2">
                  Ukuran hasil: {Math.round(cropBox.w)}×{Math.round(cropBox.h)}px · Durasi: {formatTime(trimEnd - trimStart)}
                </div>
              )}
            </div>

            {resultUrl && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Hasil</p>
                <GamatoPlayer src={resultUrl} compact />
                <Btn onClick={downloadResult} className="w-full gap-2">
                  <Download className="w-4 h-4" />
                  Unduh Video ({resultFormat?.label})
                </Btn>
              </div>
            )}
          </>
        )}

        {loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
        {exportError && <p className="text-sm text-red-600 dark:text-red-400">{exportError}</p>}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        {meta && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{meta.file.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {meta.width}×{meta.height} · {formatTime(meta.duration)}
            </p>
            {isExporting && (
              <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Memproses… {Math.round(progress * 100)}%</p>
              </div>
            )}
            <Btn onClick={runExport} disabled={isExporting || !cropBox || !format} className="w-full gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CropIcon className="w-4 h-4" />}
              {isExporting ? "Memproses…" : "Crop & Ekspor"}
            </Btn>
            <button type="button" onClick={reset} className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold">
              Ganti Video
            </button>
          </div>
        )}

        <ToolInfoPanel
          icon={<CropIcon className="w-5 h-5" />}
          label="Crop & Resize Video"
          desc="Pas-kan video untuk Reels, TikTok, atau Feed"
          points={[
            "Pilih rasio siap pakai (1:1, 9:16, 16:9, dst), lalu geser kotak crop langsung di atas video.",
            "Ekspor berjalan real-time — durasi proses kira-kira sama dengan panjang video hasil.",
            format ? `Format ekspor terbaik di browser ini: ${format.label}.` : "Browser ini tampaknya tidak mendukung ekspor video.",
          ]}
        />
      </div>
    </div>
    </div>
  );
}
