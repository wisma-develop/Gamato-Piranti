import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, Upload, Download, Loader2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/utils/cn";
import { Dropzone } from "@/components/ui/Dropzone";
import { TimeRangeSlider } from "@/components/ui/TimeRangeSlider";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { Btn, Label } from "@/components/ui/primitives";
import { useVideoFile } from "@/hooks/useVideoFile";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import { formatTime, exportSegmentedVideo, getBestExportFormat, type ExportFormat } from "@/lib/videoEngine";

const PRESETS = [
  { id: "normal", label: "Normal", filter: "" },
  { id: "grayscale", label: "Hitam-Putih", filter: "grayscale(1)" },
  { id: "sepia", label: "Sepia", filter: "sepia(0.8)" },
  { id: "vintage", label: "Vintage", filter: "sepia(0.35) contrast(1.1) brightness(0.95) saturate(0.85)" },
  { id: "cool", label: "Dingin", filter: "hue-rotate(15deg) saturate(1.1) brightness(1.02)" },
  { id: "warm", label: "Hangat", filter: "hue-rotate(-10deg) saturate(1.15) brightness(1.03)" },
  { id: "highcontrast", label: "Kontras Tinggi", filter: "contrast(1.4) saturate(1.2)" },
];

function buildFilterString(presetFilter: string, brightness: number, contrast: number, saturation: number) {
  const manual = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  return [presetFilter, manual].filter(Boolean).join(" ");
}

export function VideoFilter() {
  const { meta, error: loadError, isLoading, load, reset } = useVideoFile();
  const [presetId, setPresetId] = useState("normal");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [speed, setSpeed] = useState(1);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFormat, setResultFormat] = useState<ExportFormat | null>(null);

  const format = useMemo(() => getBestExportFormat(), []);
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const filterString = useMemo(() => buildFilterString(preset.filter, brightness, contrast, saturation), [preset, brightness, contrast, saturation]);

  useEffect(() => {
    if (!meta) return;
    setTrimStart(0);
    setTrimEnd(meta.duration);
    setResultUrl(null);
    setExportError(null);
  }, [meta]);

  const handleFiles = (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("video/"));
    if (file) load(file);
  };

  const runExport = async () => {
    if (!meta) return;
    setIsExporting(true);
    setExportError(null);
    setProgress(0);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    try {
      const blob = await exportSegmentedVideo({
        sourceUrl: meta.url,
        segments: [{ start: trimStart, end: trimEnd }],
        outputWidth: meta.width,
        outputHeight: meta.height,
        includeAudio,
        drawFrame: (ctx, video, canvas) => {
          video.playbackRate = speed;
          ctx.filter = filterString || "none";
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          ctx.filter = "none";
        },
        onProgress: setProgress,
      });
      setResultFormat(getBestExportFormat());
      setResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setExportError(err?.message || "Gagal memproses video.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadResult = async () => {
    if (!resultUrl || !resultFormat) return;
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    downloadBlob(blob, `${sanitizeFileName(meta?.file.name.replace(/\.[^.]+$/, "") || "video")}-filter.${resultFormat.ext}`);
  };

  return (
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
            <div className="bg-black rounded-2xl overflow-hidden shadow-sm">
              <video
                src={meta.url}
                controls
                muted={!includeAudio}
                className="w-full h-auto max-h-[480px] block"
                style={{ filter: filterString || undefined }}
                onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
              />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Filter Warna</p>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPresetId(p.id)}
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

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1"><Label>Terang</Label><span className="text-xs font-mono text-slate-400">{brightness}%</span></div>
                  <input type="range" min={40} max={160} value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1"><Label>Kontras</Label><span className="text-xs font-mono text-slate-400">{contrast}%</span></div>
                  <input type="range" min={40} max={160} value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1"><Label>Saturasi</Label><span className="text-xs font-mono text-slate-400">{saturation}%</span></div>
                  <input type="range" min={0} max={200} value={saturation} onChange={(e) => setSaturation(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Kecepatan</p>
                  <span className="text-xs font-mono text-slate-400">{speed.toFixed(2)}x</span>
                </div>
                <input type="range" min={0.25} max={2} step={0.25} value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Rentang Waktu</p>
                <TimeRangeSlider duration={meta.duration} start={trimStart} end={trimEnd} onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); }} playhead={playhead} />
              </div>

              <button type="button" onClick={() => setIncludeAudio((v) => !v)} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-medium">
                {includeAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {includeAudio ? "Audio disertakan" : "Audio dibisukan"}
              </button>
            </div>

            {resultUrl && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Hasil</p>
                <video src={resultUrl} controls className="w-full rounded-xl bg-black max-h-[360px]" />
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
            <Btn onClick={runExport} disabled={isExporting || !format} className="w-full gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isExporting ? "Memproses…" : "Terapkan & Ekspor"}
            </Btn>
            <button type="button" onClick={reset} className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold">
              Ganti Video
            </button>
          </div>
        )}

        <ToolInfoPanel
          icon={<Sparkles className="w-5 h-5" />}
          label="Kecepatan & Filter"
          desc="Preview WYSIWYG — apa yang terlihat, itu yang diekspor"
          points={[
            "Kecepatan >1x membuat proses ekspor lebih cepat; <1x (slow-motion) butuh waktu proses lebih lama dari durasi aslinya.",
            "Filter warna diterapkan langsung saat preview, jadi hasilnya selalu sesuai yang terlihat.",
            format ? `Format ekspor terbaik di browser ini: ${format.label}.` : "Browser ini tampaknya tidak mendukung ekspor video.",
          ]}
        />
      </div>
    </div>
  );
}
