import React, { useEffect, useMemo, useRef, useState } from "react";
import { Scissors, Upload, Download, Loader2, Plus, Trash2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/utils/cn";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoPlayer } from "@/components/ui/GamatoPlayer";
import { TimeRangeSlider } from "@/components/ui/TimeRangeSlider";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { Btn, Input } from "@/components/ui/primitives";
import { useVideoFile } from "@/hooks/useVideoFile";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import { formatTime, exportSegmentedVideo, getBestExportFormat, type ExportFormat } from "@/lib/videoEngine";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";

type Mode = "trim" | "cut";
type RemoveSegment = { id: string; start: number; end: number };

let segCounter = 0;
const newSegId = () => `seg-${Date.now()}-${segCounter++}`;

function computeKeepSegments(duration: number, removeSegments: { start: number; end: number }[]) {
  const sorted = [...removeSegments]
    .map((s) => ({ start: Math.max(0, Math.min(duration, s.start)), end: Math.max(0, Math.min(duration, s.end)) }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const keep: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const seg of sorted) {
    if (seg.start > cursor) keep.push({ start: cursor, end: seg.start });
    cursor = Math.max(cursor, seg.end);
  }
  if (cursor < duration) keep.push({ start: cursor, end: duration });
  return keep.filter((k) => k.end - k.start > 0.05);
}

export function VideoTrim() {
  const { meta, error: loadError, isLoading, load, reset } = useVideoFile();
  const [mode, setMode] = useState<Mode>("trim");
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [removeSegments, setRemoveSegments] = useState<RemoveSegment[]>([]);
  const [includeAudio, setIncludeAudio] = useState(true);
  const [playhead, setPlayhead] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFormat, setResultFormat] = useState<ExportFormat | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const format = useMemo(() => getBestExportFormat(), []);

  useEffect(() => {
    if (meta) {
      setTrimStart(0);
      setTrimEnd(meta.duration);
      setRemoveSegments([]);
      setResultUrl(null);
      setExportError(null);
    }
  }, [meta]);

  const keepSegments = useMemo(() => {
    if (!meta) return [];
    if (mode === "trim") return [{ start: trimStart, end: trimEnd }];
    return computeKeepSegments(meta.duration, removeSegments);
  }, [mode, trimStart, trimEnd, removeSegments, meta]);

  const resultDuration = useMemo(() => keepSegments.reduce((s, seg) => s + (seg.end - seg.start), 0), [keepSegments]);

  const handleFiles = (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("video/"));
    if (file) load(file);
  };

  const addRemoveSegment = () => {
    if (!meta) return;
    const mid = playhead || meta.duration / 2;
    setRemoveSegments((prev) => [...prev, { id: newSegId(), start: Math.max(0, mid - 1), end: Math.min(meta.duration, mid + 1) }]);
  };
  const updateRemoveSegment = (id: string, patch: Partial<RemoveSegment>) => {
    setRemoveSegments((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const removeRemoveSegment = (id: string) => setRemoveSegments((prev) => prev.filter((s) => s.id !== id));

  const runExport = async () => {
    if (!meta || !keepSegments.length) return;
    setIsExporting(true);
    setExportError(null);
    setProgress(0);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    try {
      const blob = await exportSegmentedVideo({
        sourceUrl: meta.url,
        segments: keepSegments,
        outputWidth: meta.width,
        outputHeight: meta.height,
        includeAudio,
        drawFrame: (ctx, video, canvas) => ctx.drawImage(video, 0, 0, canvas.width, canvas.height),
        onProgress: setProgress,
      });
      const bestFormat = getBestExportFormat();
      setResultFormat(bestFormat);
      setResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setExportError(err?.message || "Gagal memotong video.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadResult = async () => {
    if (!resultUrl || !resultFormat) return;
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    downloadBlob(blob, `${sanitizeFileName(meta?.file.name.replace(/\.[^.]+$/, "") || "video")}-potong.${resultFormat.ext}`);
  };

  return (
    <div className="space-y-4">
      <GamatoDesktopRecommended toolName="Potong Video" />
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
            <GamatoPlayer ref={videoRef} src={meta.url} label={meta.file.name} onTimeUpdate={setPlayhead} />

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode("trim")}
                  className={cn("py-2.5 rounded-xl text-sm font-semibold border-2 transition-all", mode === "trim" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}
                >
                  Simpan Satu Bagian (Trim)
                </button>
                <button
                  type="button"
                  onClick={() => setMode("cut")}
                  className={cn("py-2.5 rounded-xl text-sm font-semibold border-2 transition-all", mode === "cut" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}
                >
                  Buang Beberapa Bagian (Cut)
                </button>
              </div>

              {mode === "trim" ? (
                <TimeRangeSlider duration={meta.duration} start={trimStart} end={trimEnd} onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); }} playhead={playhead} />
              ) : (
                <div className="space-y-3">
                  <div className="relative h-3 rounded-full bg-emerald-100 dark:bg-emerald-500/10 overflow-hidden">
                    {removeSegments.map((s) => (
                      <div
                        key={s.id}
                        className="absolute top-0 h-full bg-red-400"
                        style={{ left: `${(s.start / meta.duration) * 100}%`, width: `${((s.end - s.start) / meta.duration) * 100}%` }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Hijau = disimpan, merah = dibuang.</p>
                  {removeSegments.map((seg) => (
                    <div key={seg.id} className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
                      <Input type="number" min={0} step={0.1} value={seg.start.toFixed(1)} onChange={(e) => updateRemoveSegment(seg.id, { start: parseFloat(e.target.value) || 0 })} className="text-xs py-1.5" />
                      <span className="text-slate-400 text-xs">s/d</span>
                      <Input type="number" min={0} step={0.1} value={seg.end.toFixed(1)} onChange={(e) => updateRemoveSegment(seg.id, { end: parseFloat(e.target.value) || 0 })} className="text-xs py-1.5" />
                      <button type="button" onClick={() => removeRemoveSegment(seg.id)} className="p-2 text-slate-400 hover:text-red-500 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <Btn onClick={addRemoveSegment} variant="secondary" className="w-full gap-2 text-sm">
                    <Plus className="w-4 h-4" />
                    Tambah Bagian yang Dibuang
                  </Btn>
                </div>
              )}

              <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5">
                <span className="text-slate-500 dark:text-slate-400">Durasi hasil</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">{formatTime(resultDuration)}</span>
              </div>

              <button type="button" onClick={() => setIncludeAudio((v) => !v)} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-medium">
                {includeAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {includeAudio ? "Audio disertakan" : "Audio dibisukan"}
              </button>
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
            <Btn onClick={runExport} disabled={isExporting || !keepSegments.length || !format} className="w-full gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
              {isExporting ? "Memproses…" : "Potong & Ekspor"}
            </Btn>
            <button type="button" onClick={reset} className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold">
              Ganti Video
            </button>
          </div>
        )}

        <ToolInfoPanel
          icon={<Scissors className="w-5 h-5" />}
          label="Potong Video"
          desc="Trim & cut ringan langsung di browser"
          points={[
            "Ekspor berjalan real-time — video 1 menit butuh kira-kira 1 menit untuk diproses.",
            format ? `Format ekspor terbaik di browser ini: ${format.label}.` : "Browser ini tampaknya tidak mendukung ekspor video — coba Chrome, Edge, atau Firefox terbaru.",
            "Video tidak pernah diunggah ke server — semua pemrosesan terjadi di perangkatmu.",
          ]}
        />
      </div>
    </div>
    </div>
  );
}
