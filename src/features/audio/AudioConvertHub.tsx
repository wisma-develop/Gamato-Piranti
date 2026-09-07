import React, { useMemo, useState } from "react";
import { FileAudio, Upload, Download, Loader2, Info } from "lucide-react";
import { cn } from "@/utils/cn";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoAudioPlayer } from "@/components/ui/GamatoAudioPlayer";
import { TimeRangeSlider } from "@/components/ui/TimeRangeSlider";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { Btn } from "@/components/ui/primitives";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import {
  loadAudioMeta,
  audioFileToWav,
  encodeAudioBufferCompressed,
  getSupportedCompressedAudioFormats,
  getBestCompressedAudioFormat,
  type AudioMeta,
  type CompressedAudioFormat,
} from "@/lib/audioEngine";

type Mode = "wav" | "compressed";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(t: number): string {
  if (!Number.isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: "wav", label: "WAV (Lossless)", desc: "Kualitas penuh, tanpa kompresi — file lebih besar tapi tidak ada penurunan mutu sama sekali." },
  { id: "compressed", label: "Terkompresi (Opus)", desc: "File jauh lebih kecil, cocok untuk berbagi — kualitas tetap jernih untuk suara/musik biasa." },
];

export function AudioConvertHub() {
  const [meta, setMeta] = useState<AudioMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("wav");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);

  const compressedFormats = useMemo(() => getSupportedCompressedAudioFormats(), []);
  const [compressedFormat, setCompressedFormat] = useState<CompressedAudioFormat | null>(() => getBestCompressedAudioFormat());

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; ext: string; label: string; sizeBytes: number } | null>(null);

  const clearResult = () => {
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };

  const handleFiles = async (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("audio/")) ?? files[0];
    if (!file) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const m = await loadAudioMeta(file);
      setMeta(m);
      setTrimStart(0);
      setTrimEnd(m.duration);
      clearResult();
      setError(null);
    } catch (err: any) {
      setLoadError(err?.message || "Gagal memuat file audio.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetFile = () => {
    if (meta) URL.revokeObjectURL(meta.url);
    setMeta(null);
    clearResult();
    setError(null);
    setLoadError(null);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    clearResult();
    setError(null);
  };

  const runConvert = async () => {
    if (!meta) return;
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    clearResult();
    try {
      if (mode === "wav") {
        setProgress(0.3);
        const blob = await audioFileToWav(meta.file);
        setProgress(1);
        setResult({ url: URL.createObjectURL(blob), ext: "wav", label: "WAV", sizeBytes: blob.size });
      } else {
        if (!compressedFormat) throw new Error("Browser ini tidak mendukung perekaman audio terkompresi. Coba Chrome, Edge, atau Firefox terbaru.");
        const blob = await encodeAudioBufferCompressed({
          buffer: meta.buffer,
          start: trimStart,
          end: trimEnd,
          format: compressedFormat,
          onProgress: setProgress,
        });
        setResult({ url: URL.createObjectURL(blob), ext: compressedFormat.ext, label: compressedFormat.label, sizeBytes: blob.size });
      }
    } catch (err: any) {
      setError(err?.message || "Gagal mengonversi audio.");
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

  const canRun = !!meta && !isProcessing && (mode === "wav" ? true : trimEnd > trimStart && !!compressedFormat);
  const activeModeInfo = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-4">
        <GamatoDesktopRecommended toolName="Konversi Audio" />

        {/* Mode tabs */}
        <div className="grid grid-cols-2 gap-2">
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
              <span className={cn("text-sm font-bold", mode === m.id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200")}>{m.label}</span>
            </button>
          ))}
        </div>

        {!meta ? (
          <Dropzone
            onFiles={handleFiles}
            accept="audio/*"
            multiple={false}
            label={isLoading ? "Memuat audio…" : "Drop file audio di sini"}
            sublabel="MP3, WAV, OGG, M4A, FLAC — diproses langsung di browser"
            icon={<Upload className="w-8 h-8" />}
          />
        ) : (
          <>
            <GamatoAudioPlayer src={meta.url} label={meta.file.name} />

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              {mode === "compressed" && (
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Rentang yang Dikonversi</p>
                  <TimeRangeSlider duration={meta.duration} start={trimStart} end={trimEnd} onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); clearResult(); }} />
                </div>
              )}

              {mode === "compressed" && compressedFormats.length > 1 && (
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Format Terkompresi</p>
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${compressedFormats.length}, minmax(0,1fr))` }}>
                    {compressedFormats.map((f) => (
                      <button
                        key={f.mimeType}
                        type="button"
                        onClick={() => { setCompressedFormat(f); clearResult(); }}
                        className={cn(
                          "py-2 rounded-xl text-xs font-semibold border-2 transition-all",
                          compressedFormat?.mimeType === f.mimeType ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mode === "compressed" && !compressedFormat && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">Browser ini tidak mendukung perekaman audio terkompresi. Coba Chrome, Edge, atau Firefox versi terbaru.</p>
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
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileAudio className="w-4 h-4" />}
                {isProcessing ? "Memproses…" : `Konversi ke ${activeModeInfo.label}`}
              </Btn>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              {result && (
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <GamatoAudioPlayer src={result.url} label={`Hasil (${result.label})`} />
                  <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 px-1">
                    <span>{result.label}</span>
                    <span>{formatBytes(result.sizeBytes)}</span>
                  </div>
                  <Btn onClick={downloadResult} variant="secondary" className="w-full gap-2 text-sm">
                    <Download className="w-4 h-4" />
                    Unduh {result.label}
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
              {meta.numberOfChannels === 1 ? "Mono" : meta.numberOfChannels === 2 ? "Stereo" : `${meta.numberOfChannels} channel`} · {meta.sampleRate.toLocaleString("id-ID")} Hz · {formatTime(meta.duration)}
            </p>
            <button type="button" onClick={resetFile} className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold">
              Ganti Audio
            </button>
          </div>
        )}

        <ToolInfoPanel
          icon={<FileAudio className="w-5 h-5" />}
          label={`Konversi Audio — ${activeModeInfo.label}`}
          desc={activeModeInfo.desc}
          points={
            mode === "wav"
              ? [
                  "Audio didekode lewat Web Audio API lalu ditulis ulang sebagai WAV PCM 16-bit — cara paling universal dan pasti bisa dibuka di mana saja.",
                  "Cocok untuk MP3, OGG, M4A/AAC, FLAC sebagai sumber (tergantung dukungan decoder browser).",
                  "Karena tanpa kompresi, ukuran file WAV jauh lebih besar dari sumbernya — bukan untuk berbagi, tapi untuk kualitas maksimal atau diedit lebih lanjut.",
                ]
              : [
                  "Audio diputar ulang secara real-time dan direkam lewat encoder Opus bawaan browser — bukan transcoding instan, jadi audio 1 menit ≈ 1 menit proses.",
                  compressedFormat ? `Format yang dipakai: ${compressedFormat.label}.` : "Browser ini tampaknya tidak mendukung mode ini.",
                  "Hasil jauh lebih kecil dari WAV, cocok untuk dikirim atau diunggah.",
                ]
          }
        />
      </div>
    </div>
  );
}
