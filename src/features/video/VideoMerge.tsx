import React, { useEffect, useMemo, useRef, useState } from "react";
import { Layers, Upload, Download, Loader2, Trash2, ArrowUp, ArrowDown, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/utils/cn";
import { Dropzone } from "@/components/ui/Dropzone";
import { TimeRangeSlider } from "@/components/ui/TimeRangeSlider";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { Btn } from "@/components/ui/primitives";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import { formatTime, loadVideoMeta, exportMergedVideo, getBestExportFormat, type VideoMeta, type TransitionType, type ExportFormat } from "@/lib/videoEngine";

type MergeClip = { id: string; meta: VideoMeta; trimStart: number; trimEnd: number };

let clipCounter = 0;
const newClipId = () => `merge-clip-${Date.now()}-${clipCounter++}`;

export function VideoMerge() {
  const [clips, setClips] = useState<MergeClip[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [transition, setTransition] = useState<TransitionType>("fade");
  const [transitionDuration, setTransitionDuration] = useState(0.8);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFormat, setResultFormat] = useState<ExportFormat | null>(null);

  const clipsRef = useRef<MergeClip[]>([]);
  clipsRef.current = clips;
  const format = useMemo(() => getBestExportFormat(), []);

  useEffect(() => {
    return () => {
      clipsRef.current.forEach((c) => URL.revokeObjectURL(c.meta.url));
    };
  }, []);

  const totalDuration = useMemo(() => {
    return clips.reduce((sum, c, i) => {
      const dur = Math.max(0, c.trimEnd - c.trimStart);
      const overlap = transition === "fade" && i < clips.length - 1 ? Math.min(transitionDuration, dur) : 0;
      return sum + dur - overlap;
    }, 0);
  }, [clips, transition, transitionDuration]);

  const handleFiles = async (files: File[]) => {
    setLoadError(null);
    const videoFiles = files.filter((f) => f.type.startsWith("video/"));
    for (const file of videoFiles) {
      try {
        const meta = await loadVideoMeta(file);
        setClips((prev) => [...prev, { id: newClipId(), meta, trimStart: 0, trimEnd: meta.duration }]);
      } catch (err: any) {
        setLoadError(err?.message || `Gagal memuat ${file.name}.`);
      }
    }
  };

  const updateClip = (id: string, patch: Partial<MergeClip>) => setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const removeClip = (id: string) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) URL.revokeObjectURL(target.meta.url);
      return prev.filter((c) => c.id !== id);
    });
  };

  const moveClip = (index: number, dir: -1 | 1) => {
    setClips((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const runExport = async () => {
    if (clips.length < 2) return;
    setIsExporting(true);
    setExportError(null);
    setProgress(0);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    try {
      const first = clips[0].meta;
      const blob = await exportMergedVideo({
        clips: clips.map((c) => ({ sourceUrl: c.meta.url, start: c.trimStart, end: c.trimEnd })),
        transition,
        transitionDuration,
        outputWidth: first.width,
        outputHeight: first.height,
        includeAudio,
        onProgress: setProgress,
      });
      setResultFormat(getBestExportFormat());
      setResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setExportError(err?.message || "Gagal menggabungkan video.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadResult = async () => {
    if (!resultUrl || !resultFormat) return;
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    downloadBlob(blob, `${sanitizeFileName("gamato-gabungan")}.${resultFormat.ext}`);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-4">
        <Dropzone
          onFiles={handleFiles}
          accept="video/*"
          multiple
          label="Drop 2 video atau lebih di sini"
          sublabel="Bisa tambah klip kapan saja — urutan bisa diatur di bawah"
          icon={<Upload className="w-8 h-8" />}
        />

        {clips.length > 0 && (
          <div className="space-y-3">
            {clips.map((clip, i) => (
              <div key={clip.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 text-sm font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{clip.meta.file.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {clip.meta.width}×{clip.meta.height} · {formatTime(clip.meta.duration)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => moveClip(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-30">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => moveClip(i, 1)} disabled={i === clips.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-30">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => removeClip(clip.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <TimeRangeSlider
                  duration={clip.meta.duration}
                  start={clip.trimStart}
                  end={clip.trimEnd}
                  onChange={(s, e) => updateClip(clip.id, { trimStart: s, trimEnd: e })}
                  accentClassName="bg-emerald-500"
                />
              </div>
            ))}
          </div>
        )}

        {clips.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Transisi Antar Klip</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTransition("cut")}
                  className={cn("py-2.5 rounded-xl text-sm font-semibold border-2 transition-all", transition === "cut" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}
                >
                  Potong Langsung (Cut)
                </button>
                <button
                  type="button"
                  onClick={() => setTransition("fade")}
                  className={cn("py-2.5 rounded-xl text-sm font-semibold border-2 transition-all", transition === "fade" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}
                >
                  Crossfade (Fade)
                </button>
              </div>
            </div>

            {transition === "fade" && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Durasi Transisi</p>
                  <span className="text-xs font-mono text-slate-400">{transitionDuration.toFixed(1)}s</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2}
                  step={0.1}
                  value={transitionDuration}
                  onChange={(e) => setTransitionDuration(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700"
                />
              </div>
            )}

            <button type="button" onClick={() => setIncludeAudio((v) => !v)} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-medium">
              {includeAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {includeAudio ? "Audio disertakan" : "Audio dibisukan"}
            </button>

            <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5">
              <span className="text-slate-500 dark:text-slate-400">Total durasi hasil</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">{formatTime(totalDuration)}</span>
            </div>
          </div>
        )}

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

        {loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
        {exportError && <p className="text-sm text-red-600 dark:text-red-400">{exportError}</p>}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        {clips.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{clips.length} klip dipilih</p>
            {clips.length < 2 && <p className="text-xs text-amber-600 dark:text-amber-400">Tambah minimal 2 klip untuk digabung.</p>}
            {isExporting && (
              <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Memproses… {Math.round(progress * 100)}%</p>
              </div>
            )}
            <Btn onClick={runExport} disabled={isExporting || clips.length < 2 || !format} className="w-full gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              {isExporting ? "Memproses…" : "Gabung & Ekspor"}
            </Btn>
          </div>
        )}

        <ToolInfoPanel
          icon={<Layers className="w-5 h-5" />}
          label="Gabung & Transisi"
          desc="Satukan beberapa klip jadi satu video"
          points={[
            "Resolusi hasil mengikuti klip pertama — klip lain otomatis disesuaikan (letterbox) bila rasionya beda.",
            "Crossfade memberi transisi halus antar klip; Cut langsung berpindah tanpa efek.",
            format ? `Format ekspor terbaik di browser ini: ${format.label}.` : "Browser ini tampaknya tidak mendukung ekspor video.",
          ]}
        />
      </div>
    </div>
  );
}
