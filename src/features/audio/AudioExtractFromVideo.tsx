import React, { useEffect, useMemo, useState } from "react";
import { AudioLines, Upload, Download, Loader2 } from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoPlayer } from "@/components/ui/GamatoPlayer";
import { GamatoAudioPlayer } from "@/components/ui/GamatoAudioPlayer";
import { TimeRangeSlider } from "@/components/ui/TimeRangeSlider";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { Btn } from "@/components/ui/primitives";
import { useVideoFile } from "@/hooks/useVideoFile";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import { formatTime, extractAudioFromVideo, getBestAudioFormat, type ExportFormat } from "@/lib/videoEngine";

export function AudioExtractFromVideo() {
  const { meta, error: loadError, isLoading, load, reset } = useVideoFile();
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [isExtractingAudio, setIsExtractingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioResultUrl, setAudioResultUrl] = useState<string | null>(null);
  const [audioFormat, setAudioFormat] = useState<ExportFormat | null>(null);

  const bestAudioFormat = useMemo(() => getBestAudioFormat(), []);

  useEffect(() => {
    if (!meta) return;
    setTrimStart(0);
    setTrimEnd(meta.duration);
    setAudioResultUrl(null);
    setAudioError(null);
  }, [meta]);

  const handleFiles = (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("video/"));
    if (file) load(file);
  };

  const runExtractAudio = async () => {
    if (!meta) return;
    setIsExtractingAudio(true);
    setAudioError(null);
    setAudioProgress(0);
    if (audioResultUrl) URL.revokeObjectURL(audioResultUrl);
    setAudioResultUrl(null);
    try {
      const blob = await extractAudioFromVideo({ sourceUrl: meta.url, start: trimStart, end: trimEnd, onProgress: setAudioProgress });
      const format = getBestAudioFormat();
      setAudioFormat(format);
      setAudioResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setAudioError(err?.message || "Gagal mengekstrak audio.");
    } finally {
      setIsExtractingAudio(false);
    }
  };

  const downloadAudio = async () => {
    if (!audioResultUrl || !audioFormat || !meta) return;
    const res = await fetch(audioResultUrl);
    const blob = await res.blob();
    downloadBlob(blob, `${sanitizeFileName(meta.file.name.replace(/\.[^.]+$/, "")) || "audio"}.${audioFormat.ext}`);
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
            <GamatoPlayer src={meta.url} label={meta.file.name} onTimeUpdate={setPlayhead} />

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Ekstrak Audio</p>
              <TimeRangeSlider duration={meta.duration} start={trimStart} end={trimEnd} onChange={(s, e) => { setTrimStart(s); setTrimEnd(e); }} playhead={playhead} />
              {isExtractingAudio && (
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(audioProgress * 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Memproses… {Math.round(audioProgress * 100)}%</p>
                </div>
              )}
              <Btn onClick={runExtractAudio} disabled={isExtractingAudio || !bestAudioFormat} className="w-full gap-2">
                {isExtractingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <AudioLines className="w-4 h-4" />}
                {isExtractingAudio ? "Memproses…" : "Ekstrak Audio"}
              </Btn>
              {audioError && <p className="text-sm text-red-600 dark:text-red-400">{audioError}</p>}
              {audioResultUrl && (
                <div className="space-y-2 pt-1">
                  <GamatoAudioPlayer src={audioResultUrl} label="Hasil ekstraksi audio" />
                  <Btn onClick={downloadAudio} variant="secondary" className="w-full gap-2 text-sm">
                    <Download className="w-4 h-4" />
                    Unduh Audio ({audioFormat?.label})
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
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{meta.file.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {meta.width}×{meta.height} · {formatTime(meta.duration)}
            </p>
            <button type="button" onClick={reset} className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold">
              Ganti Video
            </button>
          </div>
        )}

        <ToolInfoPanel
          icon={<AudioLines className="w-5 h-5" />}
          label="Ekstrak Audio dari Video"
          desc="Ambil track suara dari file video"
          points={[
            "Audio diekstrak apa adanya dari track suara video — cocok untuk menyimpan rekaman suara atau musik latar.",
            "Bisa dipangkas dulu (trim) sebelum diekstrak, tidak perlu seluruh durasi video.",
            bestAudioFormat ? `Format audio terbaik di browser ini: ${bestAudioFormat.label}.` : "Browser ini tampaknya tidak mendukung ekstraksi audio.",
          ]}
        />
      </div>
    </div>
  );
}
