import React, { useEffect, useMemo, useState } from "react";
import { VideoContainerPicker, useVideoContainerChoice } from "@/components/ui/VideoContainerPicker";
import { AudioFormatPicker, useAudioOutChoice } from "@/components/ui/AudioFormatPicker";
import { convertVideoBlob, finalizeVideoExport } from "@/lib/videoContainer";
import { extractAudioToMp3 } from "@/lib/mp3Encoder";
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
import { tr } from "@/i18n";

type Mode = "container" | "gif" | "audio";

const MODES: { id: Mode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "container", label: tr("Format Video"), icon: <FileVideo2 className="w-4 h-4" />, desc: tr("Ubah video ke MP4, MOV, atau WebM — cepat, langsung di browser") },
  { id: "gif", label: tr("Ke GIF"), icon: <ImageIcon className="w-4 h-4" />, desc: tr("Jadikan potongan video sebagai GIF bergerak") },
  { id: "audio", label: tr("Ke Audio"), icon: <AudioLines className="w-4 h-4" />, desc: tr("Ambil track suara saja dari video") },
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

  const [container, setContainer] = useVideoContainerChoice();
  const [audioOut, setAudioOut] = useAudioOutChoice();
  const [note, setNote] = useState<string | null>(null);
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
        setNote(null);
        const whole = trimStart <= 0.05 && trimEnd >= meta.duration - 0.05;
        // Jalur cepat (bukan real-time): kemas/transkode langsung dari berkas sumber ke MP4/MOV/WebM pilihan.
        if (container !== "asli") {
          try {
            const r = await convertVideoBlob(meta.file, container, {
              trim: whole ? undefined : { start: trimStart, end: trimEnd },
              onProgress: setProgress,
            });
            setNote(r.note ?? null);
            setResult({ kind: "container", url: URL.createObjectURL(r.blob), ext: r.fmt.ext, label: r.fmt.label, sizeBytes: r.blob.size });
            return;
          } catch (fastErr: any) {
            if (!bestVideoFormat) throw fastErr;
            setNote(tr("Jalur cepat tidak tersedia ({0}). Memakai perekaman real-time…", fastErr?.message || tr("tidak didukung")));
            setProgress(0);
          }
        }
        if (!bestVideoFormat) throw new Error(tr("Browser ini tidak mendukung ekspor video (MediaRecorder). Coba Chrome, Edge, atau Firefox terbaru."));
        const blob = await exportSegmentedVideo({
          sourceUrl: meta.url,
          segments: [{ start: trimStart, end: trimEnd }],
          outputWidth: meta.width,
          outputHeight: meta.height,
          includeAudio: true,
          drawFrame: (ctx, video, canvas) => ctx.drawImage(video, 0, 0, canvas.width, canvas.height),
          onProgress: setProgress,
        });
        const fin = await finalizeVideoExport(blob, bestVideoFormat, container);
        setNote((prev) => fin.note ?? prev);
        setResult({ kind: "container", url: URL.createObjectURL(fin.blob), ext: fin.fmt.ext, label: fin.fmt.label, sizeBytes: fin.blob.size });
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
        setResult({ kind: "gif", url: URL.createObjectURL(blob), ext: "gif", label: tr("GIF"), sizeBytes: blob.size });
      } else {
        setNote(null);
        if (audioOut.format === "mp3") {
          try {
            const blob = await extractAudioToMp3(meta.file, { kbps: audioOut.kbps, start: trimStart, end: trimEnd, onProgress: setProgress });
            setResult({ kind: "audio", url: URL.createObjectURL(blob), ext: "mp3", label: tr("MP3"), sizeBytes: blob.size });
            return;
          } catch (mp3Err: any) {
            if (!bestAudioFormat) throw mp3Err;
            setNote(tr("Browser tidak bisa mendekode audio video ini untuk MP3, jadi hasil disimpan dalam format asli perekam."));
            setProgress(0);
          }
        }
        if (!bestAudioFormat) throw new Error(tr("Browser ini tidak mendukung ekstraksi audio (MediaRecorder). Coba Chrome, Edge, atau Firefox terbaru."));
        const blob = await extractAudioFromVideo({ sourceUrl: meta.url, start: trimStart, end: trimEnd, onProgress: setProgress });
        setResult({ kind: "audio", url: URL.createObjectURL(blob), ext: bestAudioFormat.ext, label: bestAudioFormat.label, sizeBytes: blob.size });
      }
    } catch (err: any) {
      setError(err?.message || tr("Gagal mengonversi video."));
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
    (mode === "container" ? container !== "asli" || !!bestVideoFormat : mode === "audio" ? audioOut.format === "mp3" || !!bestAudioFormat : true);

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
            label={isLoading ? tr("Memuat video…") : tr("Drop video di sini")}
            sublabel={tr("MP4, WebM, MOV — diproses langsung di browser")}
            icon={<Upload className="w-8 h-8" />}
          />
        ) : (
          <>
            <GamatoPlayer src={meta.url} label={meta.file.name} onTimeUpdate={setPlayhead} />

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">{tr("Rentang yang Dikonversi")}</p>
                <TimeRangeSlider duration={meta.duration} start={trimStart} end={trimEnd} onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); clearResult(); }} playhead={playhead} />
              </div>

              {mode === "gif" && (
                <div className="space-y-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <Label>{tr("Kecepatan (FPS)")}</Label>
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
                        >{tr("{0} fps", fps)}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>{tr("Lebar Maksimum")}</Label>
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
                        >{tr("{0}px", w)}</button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />{tr("Perkiraan {0} frame akan diambil. GIF lebih lebar/lebih banyak frame = file lebih besar.", estimatedGifFrames)}</p>
                </div>
              )}

              {mode === "container" && (
                <>
                  <VideoContainerPicker value={container} onChange={(v) => { setContainer(v); clearResult(); }} disabled={isProcessing} />
                  {note && <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">{note}</p>}
                </>
              )}
              {mode === "audio" && (
                <>
                  <AudioFormatPicker value={audioOut} onChange={(v) => { setAudioOut(v); clearResult(); }} disabled={isProcessing} nativeLabel={bestAudioFormat?.label} />
                  {note && <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">{note}</p>}
                </>
              )}
              {mode === "container" && container === "asli" && !bestVideoFormat && (
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">{tr("Browser ini tidak mendukung ekspor video. Coba Chrome, Edge, atau Firefox versi terbaru.")}</p>
              )}
              {mode === "audio" && audioOut.format === "asli" && !bestAudioFormat && (
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">{tr("Browser ini tidak mendukung ekstraksi audio. Coba Chrome, Edge, atau Firefox versi terbaru.")}</p>
              )}

              {isProcessing && (
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{tr("Memproses… {0}%", Math.round(progress * 100))}</p>
                </div>
              )}

              <Btn onClick={runConvert} disabled={!canRun} className="w-full gap-2">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : activeModeInfo.icon}
                {isProcessing ? tr("Memproses…") : tr("Konversi {0}", activeModeInfo.label)}
              </Btn>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              {result && (
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  {result.kind === "container" && <GamatoPlayer src={result.url} label={tr("Hasil ({0})", result.label)} />}
                  {result.kind === "gif" && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                      <img src={result.url} alt={tr("Hasil GIF")} className="w-full h-auto" />
                    </div>
                  )}
                  {result.kind === "audio" && <GamatoAudioPlayer src={result.url} label={tr("Hasil audio ({0})", result.label)} />}
                  <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 px-1">
                    <span>{result.label}</span>
                    <span>{formatBytes(result.sizeBytes)}</span>
                  </div>
                  <Btn onClick={downloadResult} variant="secondary" className="w-full gap-2 text-sm">
                    <Download className="w-4 h-4" />
                    {tr("Unduh")} {result.kind === "gif" ? tr("GIF") : result.label}
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
            <p className="text-sm text-slate-500 dark:text-slate-400">{tr("{0}×{1} · {2}", meta.width, meta.height, formatTime(meta.duration))}</p>
            <button type="button" onClick={reset} className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold">
              {tr("Ganti Video")}
            </button>
          </div>
        )}

        <ToolInfoPanel
          icon={activeModeInfo.icon}
          label={tr("Konversi Video — {0}", activeModeInfo.label)}
          desc={activeModeInfo.desc}
          points={
            mode === "container"
              ? [
                  tr("Video diputar ulang dan direkam lewat encoder bawaan browser — bukan transcoding sungguhan seperti FFmpeg, tapi cukup untuk memperbaiki kontainer atau menyamakan format."),
                  bestVideoFormat ? tr("Format terbaik di browser ini: {0}.", bestVideoFormat.label) : tr("Browser ini tampaknya tidak mendukung ekspor video."),
                  tr("Proses berjalan real-time (video 1 menit ≈ 1 menit proses), sama seperti alat Potong/Gabung Video lainnya."),
                ]
              : mode === "gif"
              ? [
                  tr("GIF dibuat langsung di browser (kuantisasi warna + kompresi LZW) tanpa server maupun library eksternal."),
                  tr("Turunkan FPS atau lebar untuk file lebih kecil — GIF tidak sekompak video, jadi klip pendek (2–8 detik) hasilnya paling praktis."),
                  tr("{0} frame akan diambil dari rentang {1}–{2}.", estimatedGifFrames, formatTime(trimStart), formatTime(trimEnd)),
                ]
              : [
                  tr("Audio diekstrak apa adanya dari track suara video."),
                  bestAudioFormat ? tr("Format audio terbaik di browser ini: {0}.", bestAudioFormat.label) : tr("Browser ini tampaknya tidak mendukung ekstraksi audio."),
                  tr("Untuk audio yang sudah dalam bentuk file suara (bukan video), pakai Konversi Audio di menu Audio."),
                ]
          }
        />
        {!videoExportOk && mode !== "gif" && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">
            {tr("Browser ini mungkin tidak mendukung sebagian fitur ekspor (MediaRecorder/captureStream). GIF tetap bisa dipakai karena tidak bergantung pada API tersebut.")}
          </p>
        )}
      </div>
    </div>
  );
}
