import React, { useEffect, useState } from "react";
import { Camera, Upload, Download, Loader2 } from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoPlayer } from "@/components/ui/GamatoPlayer";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { Btn } from "@/components/ui/primitives";
import { useVideoFile } from "@/hooks/useVideoFile";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import { formatTime, captureVideoFrame } from "@/lib/videoEngine";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";

export function VideoThumbnail() {
  const { meta, error: loadError, isLoading, load, reset } = useVideoFile();
  const [playhead, setPlayhead] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [frameError, setFrameError] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!meta) return;
    setThumbUrl(null);
    setFrameError(null);
  }, [meta]);

  const handleFiles = (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("video/"));
    if (file) load(file);
  };

  const runCaptureThumbnail = async () => {
    if (!meta) return;
    setIsCapturing(true);
    setFrameError(null);
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    setThumbUrl(null);
    try {
      const blob = await captureVideoFrame(meta.url, playhead);
      setThumbUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setFrameError(err?.message || "Gagal mengambil thumbnail.");
    } finally {
      setIsCapturing(false);
    }
  };

  const downloadThumb = async () => {
    if (!thumbUrl || !meta) return;
    const res = await fetch(thumbUrl);
    const blob = await res.blob();
    downloadBlob(blob, `${sanitizeFileName(meta.file.name.replace(/\.[^.]+$/, "")) || "video"}-thumbnail.png`);
  };

  return (
    <div className="space-y-4">
      <GamatoDesktopRecommended toolName="Tangkap Thumbnail Video" />
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
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Tangkap Thumbnail / Screenshot</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Putar video ke posisi yang diinginkan, lalu ambil frame di posisi tersebut ({formatTime(playhead)}).</p>
              <Btn onClick={runCaptureThumbnail} disabled={isCapturing} className="w-full gap-2">
                {isCapturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {isCapturing ? "Mengambil…" : `Ambil Frame di ${formatTime(playhead)}`}
              </Btn>
              {frameError && <p className="text-sm text-red-600 dark:text-red-400">{frameError}</p>}
              {thumbUrl && (
                <div className="space-y-2 pt-1">
                  <img src={thumbUrl} alt="Thumbnail" className="w-full rounded-xl border border-slate-200 dark:border-slate-700" />
                  <Btn onClick={downloadThumb} variant="secondary" className="w-full gap-2 text-sm">
                    <Download className="w-4 h-4" />
                    Unduh Thumbnail PNG
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
          icon={<Camera className="w-5 h-5" />}
          label="Tangkap Thumbnail / Screenshot"
          desc="Ambil satu frame dari video sebagai gambar"
          points={[
            "Thumbnail diambil persis di posisi video yang sedang diputar, kualitas penuh sesuai resolusi asli.",
            "Cocok untuk membuat cover/thumbnail video, atau menangkap momen tertentu sebagai screenshot.",
            "Mau ambil track audio dari video? Sekarang tersedia di menu Audio → Ekstrak Audio dari Video.",
          ]}
        />
      </div>
    </div>
    </div>
  );
}
