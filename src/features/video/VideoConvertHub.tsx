import React, { useEffect, useMemo, useState } from "react";
import { FileVideo2, Image as ImageIcon, AudioLines, Upload, Download, Loader2, Info } from "lucide-react";
import { cn } from "@/utils/cn";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoPlayer } from "@/components/ui/GamatoPlayer";
import { GamatoAudioPlayer } from "@/components/ui/GamatoAudioPlayer";
import { TimeRangeSlider } from "@/components/ui/TimeRangeSlider";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { Btn, Label } from "@/components/ui/primitives";
import { useVideoFile } from "@/hooks/useVideoFile";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import {
  formatTime,
  exportSegmentedVideo,
  getBestExportFormat,
  isVideoExportSupported,
  extractAudioFromVideo,
  getBestAudioFormat,
  sampleVideoFrames,
} from "@/lib/videoEngine";
import { encodeGif } from "@/lib/gifEncoder";

type Mode = "container" | "gif" | "audio";

const MODES: { id: Mode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "container", label: "Format Video", icon: <FileVideo2 className="w-4 h-4" />, desc: "Ganti/perbaiki kontainer video (MP4/WebM sesuai dukungan browser)" },
  { id: "gif", label: "Ke GIF", icon: <ImageIcon className="w-4 h-4" />, desc: "Jadikan potongan video sebagai GIF bergerak" },
  { id: "audio", label: "Ke Audio", icon: <AudioLines className="w-4 h-4" />, desc: "Ambil track suara saja dari video" },
];

const GIF_FPS_OPTIONS = [5, 10, 15];
const GIF_WIDTH_OPTIONS = [240, 320, 480, 640];

interface ConvertResult {
  kind: Mode;
  url: string;
  ext: string;
  label: string;
  sizeBytes: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoConvertHub() {
  const { meta, error: loadError, isLoading, load, reset } = useVideoFile();
  const [mode, setMode] = useState<Mode>("container");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playhead, setPlayhead] = useState(0);

  const [gifFps, setGifFps] = useState(10);
  const [gifMaxWidth, setGifMaxWidth] = useState(320);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);

  const bestVideoFormat = useMemo(() => getBestExportFormat(), []);
  const bestAudioFormat = useMemo(() => getBestAudioFormat(), []);
  const videoExportOk = useMemo(() => isVideoExportSupported(), []);

  const clearResult = () => {
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  useEffect(() => {
    if (!meta) return;
    setTrimStart(0);
    setTrimEnd(meta.duration);
    clearResult();
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  const handleFiles = (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("video/"));
    if (file) load(file);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    clearResult();
    setError(null);
  };

  const estimatedGifFrames = useMemo(() => {
    const dur = Math.max(0, trimEnd - trimStart);
    return Math.max(1, Math.round(dur * gifFps));
  }, [trimStart, trimEnd, gifFps]);

  const runConvert = async () => {
    if (!meta) return;
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    clearResult();
    try {
      if (mode === "container") {
        if (!bestVideoFormat) throw new Error("Browser ini tidak mendukung ekspor video (MediaRecorder). Coba Chrome, Edge, atau Firefox terbaru.");
        const blob = await exportSegmentedVideo({
          sourceUrl: meta.url,
          segments: [{ start: trimStart, end: trimEnd }],
          outputWidth: meta.width,
          outputHeight: meta.height,
          includeAudio: true,
          drawFrame: (ctx, video, canvas) => ctx.drawImage(video, 0, 0, canvas.width, canvas.height),
          onProgress: setProgress,
        });
        setResult({ kind: "container", url: URL.createObjectURL(blob), ext: bestVideoFormat.ext, label: bestVideoFormat.label, sizeBytes: blob.size });
      } else if (mode === "gif") {
        const frames = await sampleVideoFrames({
          sourceUrl: meta.url,
          start: trimStart,
          end: trimEnd,
          fps: gifFps,
          maxWidth: gifMaxWidth,
          onProgress: (f) => setProgress(f * 0.65),
        });
        const blob = await encodeGif(frames, {
          onProgress: (f) => setProgress(0.65 + f * 0.35),
        });
        setResult({ kind: "gif", url: URL.createObjectURL(blob), ext: "gif", label: "GIF", sizeBytes: blob.size });
      } else {
        if (!bestAudioFormat) throw new Error("Browser ini tidak mendukung ekstraksi audio (MediaRecorder). Coba Chrome, Edge, atau Firefox terbaru.");
        const blob = await extractAudioFromVideo({ sourceUrl: meta.url, start: trimStart, end: trimEnd, onProgress: setProgress });
        setResult({ kind: "audio", url: URL.createObjectURL(blob), ext: bestAudioFormat.ext, label: bestAudioFormat.label, sizeBytes: blob.size });
      }
    } catch (err: any) {
      setError(err?.message || "Gagal mengonversi video.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = async () => {
    if (!result || !meta) return;
    const res = await fetch(result.url);
    const blob = await res.blob();
    const base = sanitizeFileName(meta.file.name.replace(/\.[^.]+$/, "")) || "hasil-konversi";
    downloadBlob(blob, `${base}.${result.ext}`);
  };

  const canRun =
    !!meta &&
    !isProcessing &&
    trimEnd > trimStart &&
    (mode === "container" ? !!bestVideoFormat : mode === "audio" ? !!bestAudioFormat : true);

  const activeModeInfo = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-4">
        <GamatoDesktopRecommended toolName="Konversi Video" />

        {/* Mode tabs */}
        <div className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => switchMode(m.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 text-center transition-all",
                mode === m.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600"
              )}
            >
              <span className={cn(mode === m.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 dark:text-slate-500")}>{m.icon}</span>
              <span className={cn("text-sm font-bold", mode === m.id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200")}>{m.label}</span>
            </button>
          ))}
        </div>

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
            <GamatoPlayer src={meta.url} label={meta.file.name} onTimeUpdate={setPlayhead} />

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Rentang yang Dikonversi</p>
                <TimeRangeSlider duration={meta.duration} start={trimStart} end={trimEnd} onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); clearResult(); }} playhead={playhead} />
              </div>

              {mode === "gif" && (
                <div className="space-y-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <Label>Kecepatan (FPS)</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {GIF_FPS_OPTIONS.map((fps) => (
                        <button
                          key={fps}
                          type="button"
                          onClick={() => { setGifFps(fps); clearResult(); }}
                          className={cn(
                            "py-2 rounded-xl text-sm font-semibold border-2 transition-all",
                            gifFps === fps ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          )}
                        >
                          {fps} fps
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Lebar Maksimum</Label>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      {GIF_WIDTH_OPTIONS.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => { setGifMaxWidth(w); clearResult(); }}
                          className={cn(
                            "py-2 rounded-xl text-sm font-semibold border-2 transition-all",
                            gifMaxWidth === w ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          )}
                        >
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    Perkiraan {estimatedGifFrames} frame akan diambil. GIF lebih lebar/lebih banyak frame = file lebih besar.
                  </p>
                </div>
              )}

              {mode === "container" && !bestVideoFormat && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">Browser ini tidak mendukung ekspor video. Coba Chrome, Edge, atau Firefox versi terbaru.</p>
              )}
              {mode === "audio" && !bestAudioFormat && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">Browser ini tidak mendukung ekstraksi audio. Coba Chrome, Edge, atau Firefox versi terbaru.</p>
              )}

              {isProcessing && (
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Memproses… {Math.round(progress * 100)}%</p>
                </div>
              )}

              <Btn onClick={runConvert} disabled={!canRun} className="w-full gap-2">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : activeModeInfo.icon}
                {isProcessing ? "Memproses…" : `Konversi ${activeModeInfo.label}`}
              </Btn>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              {result && (
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  {result.kind === "container" && <GamatoPlayer src={result.url} label={`Hasil (${result.label})`} />}
                  {result.kind === "gif" && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                      <img src={result.url} alt="Hasil GIF" className="w-full h-auto" />
                    </div>
                  )}
                  {result.kind === "audio" && <GamatoAudioPlayer src={result.url} label={`Hasil audio (${result.label})`} />}
                  <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 px-1">
                    <span>{result.label}</span>
                    <span>{formatBytes(result.sizeBytes)}</span>
                  </div>
                  <Btn onClick={downloadResult} variant="secondary" className="w-full gap-2 text-sm">
                    <Download className="w-4 h-4" />
                    Unduh {result.kind === "gif" ? "GIF" : result.label}
                  </Btn>
                </div>
              )}
            </div>
          </>
        )}

        {loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        {meta && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 truncate">{meta.file.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {meta.width}×{meta.height} · {formatTime(meta.duration)}
            </p>
            <button type="button" onClick={reset} className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold">
              Ganti Video
            </button>
          </div>
        )}

        <ToolInfoPanel
          icon={activeModeInfo.icon}
          label={`Konversi Video — ${activeModeInfo.label}`}
          desc={activeModeInfo.desc}
          points={
            mode === "container"
              ? [
                  "Video diputar ulang dan direkam lewat encoder bawaan browser — bukan transcoding sungguhan seperti FFmpeg, tapi cukup untuk memperbaiki kontainer atau menyamakan format.",
                  bestVideoFormat ? `Format terbaik di browser ini: ${bestVideoFormat.label}.` : "Browser ini tampaknya tidak mendukung ekspor video.",
                  "Proses berjalan real-time (video 1 menit ≈ 1 menit proses), sama seperti alat Potong/Gabung Video lainnya.",
                ]
              : mode === "gif"
              ? [
                  "GIF dibuat langsung di browser (kuantisasi warna + kompresi LZW) tanpa server maupun library eksternal.",
                  "Turunkan FPS atau lebar untuk file lebih kecil — GIF tidak sekompak video, jadi klip pendek (2–8 detik) hasilnya paling praktis.",
                  `${estimatedGifFrames} frame akan diambil dari rentang ${formatTime(trimStart)}–${formatTime(trimEnd)}.`,
                ]
              : [
                  "Audio diekstrak apa adanya dari track suara video.",
                  bestAudioFormat ? `Format audio terbaik di browser ini: ${bestAudioFormat.label}.` : "Browser ini tampaknya tidak mendukung ekstraksi audio.",
                  "Untuk audio yang sudah dalam bentuk file suara (bukan video), pakai Konversi Audio di menu Audio.",
                ]
          }
        />
        {!videoExportOk && mode !== "gif" && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">
            Browser ini mungkin tidak mendukung sebagian fitur ekspor (MediaRecorder/captureStream). GIF tetap bisa dipakai karena tidak bergantung pada API tersebut.
          </p>
        )}
      </div>
    </div>
  );
}
