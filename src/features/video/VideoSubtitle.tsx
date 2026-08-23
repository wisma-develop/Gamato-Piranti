import React, { useEffect, useMemo, useState } from "react";
import { Captions, Upload, Download, Loader2, Plus, Trash2, FileText } from "lucide-react";
import { cn } from "@/utils/cn";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoPlayer } from "@/components/ui/GamatoPlayer";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { Btn, Input, Textarea, Select, Label } from "@/components/ui/primitives";
import { useVideoFile } from "@/hooks/useVideoFile";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import { wrapText } from "@/lib/businessDocCanvas";
import { formatTime, exportSegmentedVideo, getBestExportFormat, type ExportFormat } from "@/lib/videoEngine";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";

type Caption = { id: string; start: number; end: number; text: string };
type Position = "top" | "center" | "bottom";

let capCounter = 0;
const newCapId = () => `cap-${Date.now()}-${capCounter++}`;

const pad = (n: number, len: number) => String(Math.max(0, Math.floor(n))).padStart(len, "0");

function toSrtTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}
function toVttTimestamp(sec: number): string {
  return toSrtTimestamp(sec).replace(",", ".");
}
function generateSrt(captions: Caption[]): string {
  return captions.map((c, i) => `${i + 1}\n${toSrtTimestamp(c.start)} --> ${toSrtTimestamp(c.end)}\n${c.text}\n`).join("\n");
}
function generateVtt(captions: Caption[]): string {
  return `WEBVTT\n\n${captions.map((c) => `${toVttTimestamp(c.start)} --> ${toVttTimestamp(c.end)}\n${c.text}\n`).join("\n")}`;
}

function drawCaptionOverlay(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  style: { fontSize: number; color: string; background: boolean; position: Position }
) {
  if (!text.trim()) return;
  const fontSize = style.fontSize;
  ctx.font = `700 ${fontSize}px 'Alan Sans', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = canvas.width * 0.88;
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = fontSize * 1.3;
  const totalH = lines.length * lineHeight;

  let y: number;
  if (style.position === "top") y = fontSize + 24;
  else if (style.position === "center") y = canvas.height / 2 - totalH / 2 + lineHeight / 2;
  else y = canvas.height - 28 - totalH + lineHeight / 2;

  lines.forEach((line, i) => {
    const ly = y + i * lineHeight;
    if (style.background) {
      const w = ctx.measureText(line).width + 28;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(canvas.width / 2 - w / 2, ly - lineHeight / 2 + 3, w, lineHeight - 6);
    }
    ctx.fillStyle = style.color;
    ctx.fillText(line, canvas.width / 2, ly);
  });
}

export function VideoSubtitle() {
  const { meta, error: loadError, isLoading, load, reset } = useVideoFile();
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [fontSize, setFontSize] = useState(28);
  const [color, setColor] = useState("#ffffff");
  const [background, setBackground] = useState(true);
  const [position, setPosition] = useState<Position>("bottom");
  const [playhead, setPlayhead] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFormat, setResultFormat] = useState<ExportFormat | null>(null);

  const format = useMemo(() => getBestExportFormat(), []);

  useEffect(() => {
    if (!meta) return;
    setCaptions([{ id: newCapId(), start: 0, end: Math.min(3, meta.duration), text: "Tulis teks di sini…" }]);
    setResultUrl(null);
    setExportError(null);
  }, [meta]);

  const activeCaption = useMemo(() => captions.find((c) => playhead >= c.start && playhead <= c.end), [captions, playhead]);

  const handleFiles = (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("video/"));
    if (file) load(file);
  };

  const addCaption = () => {
    if (!meta) return;
    const last = captions[captions.length - 1];
    const start = last ? Math.min(meta.duration, last.end + 0.2) : playhead;
    setCaptions((prev) => [...prev, { id: newCapId(), start, end: Math.min(meta.duration, start + 2), text: "Teks baru" }]);
  };
  const updateCaption = (id: string, patch: Partial<Caption>) => setCaptions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const removeCaption = (id: string) => setCaptions((prev) => prev.filter((c) => c.id !== id));

  const downloadSubtitleFile = (kind: "srt" | "vtt") => {
    if (!meta) return;
    const content = kind === "srt" ? generateSrt(captions) : generateVtt(captions);
    downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), `${sanitizeFileName(meta.file.name.replace(/\.[^.]+$/, "")) || "video"}.${kind}`);
  };

  const runBurnInExport = async () => {
    if (!meta) return;
    setIsExporting(true);
    setExportError(null);
    setProgress(0);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    try {
      const blob = await exportSegmentedVideo({
        sourceUrl: meta.url,
        segments: [{ start: 0, end: meta.duration }],
        outputWidth: meta.width,
        outputHeight: meta.height,
        drawFrame: (ctx, video, canvas) => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const cap = captions.find((c) => video.currentTime >= c.start && video.currentTime <= c.end);
          if (cap) drawCaptionOverlay(ctx, canvas, cap.text, { fontSize, color, background, position });
        },
        onProgress: setProgress,
      });
      setResultFormat(getBestExportFormat());
      setResultUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setExportError(err?.message || "Gagal membakar teks ke video.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadResult = async () => {
    if (!resultUrl || !resultFormat || !meta) return;
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    downloadBlob(blob, `${sanitizeFileName(meta.file.name.replace(/\.[^.]+$/, "")) || "video"}-cc.${resultFormat.ext}`);
  };

  return (
    <div className="space-y-4">
      <GamatoDesktopRecommended toolName="Teks & Subtitle Video" />
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
            <div className="relative rounded-2xl overflow-hidden shadow-sm">
              <GamatoPlayer src={meta.url} label={meta.file.name} onTimeUpdate={setPlayhead} />
              {activeCaption && (
                <div
                  className={cn(
                    "absolute inset-x-0 z-20 flex justify-center px-6 pointer-events-none",
                    position === "top" ? "top-6" : position === "center" ? "top-1/2 -translate-y-1/2" : "bottom-6"
                  )}
                >
                  <span
                    className={cn("font-bold text-center rounded-lg px-3 py-1", background && "bg-black/55")}
                    style={{ color, fontSize: `${Math.round(fontSize * 0.6)}px` }}
                  >
                    {activeCaption.text}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Daftar Teks</p>
              {captions.map((cap) => (
                <div key={cap.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Textarea value={cap.text} onChange={(e) => updateCaption(cap.id, { text: e.target.value })} rows={1} className="flex-1 text-sm" />
                    <button type="button" onClick={() => removeCaption(cap.id)} className="p-2 text-slate-400 hover:text-red-500 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" min={0} step={0.1} value={cap.start.toFixed(1)} onChange={(e) => updateCaption(cap.id, { start: parseFloat(e.target.value) || 0 })} className="text-xs py-1.5" />
                    <Input type="number" min={0} step={0.1} value={cap.end.toFixed(1)} onChange={(e) => updateCaption(cap.id, { end: parseFloat(e.target.value) || 0 })} className="text-xs py-1.5" />
                  </div>
                </div>
              ))}
              <Btn onClick={addCaption} variant="secondary" className="w-full gap-2 text-sm">
                <Plus className="w-4 h-4" />
                Tambah Teks di Posisi Video Saat Ini
              </Btn>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Gaya Teks</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ukuran Font</Label>
                  <div className="mt-2"><GamatoSlider min={16} max={56} value={fontSize} onChange={setFontSize} aria-label="Ukuran font" /></div>
                </div>
                <Select label="Posisi" value={position} onChange={(e) => setPosition(e.target.value as Position)}>
                  <option value="bottom">Bawah</option>
                  <option value="center">Tengah</option>
                  <option value="top">Atas</option>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <GamatoColorPicker label="Warna" value={color} onChange={setColor} />
                <GamatoCheckbox checked={background} onChange={setBackground} label="Latar belakang gelap" />
              </div>
            </div>

            {resultUrl && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Hasil (Teks Dibakar ke Video)</p>
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
            <p className="text-sm text-slate-500 dark:text-slate-400">{formatTime(meta.duration)} · {captions.length} teks</p>

            <div className="space-y-2 pt-1">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Ekspor Ringan</p>
              <Btn onClick={() => downloadSubtitleFile("srt")} variant="secondary" className="w-full gap-2 text-sm">
                <FileText className="w-4 h-4" />
                Unduh .SRT
              </Btn>
              <Btn onClick={() => downloadSubtitleFile("vtt")} variant="secondary" className="w-full gap-2 text-sm">
                <FileText className="w-4 h-4" />
                Unduh .VTT
              </Btn>
              <p className="text-xs text-slate-400 dark:text-slate-500">Instan, video asli tidak diubah — tinggal muat file ini di media player atau platform upload.</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Atau Bakar ke Video</p>
              {isExporting && (
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Memproses… {Math.round(progress * 100)}%</p>
                </div>
              )}
              <Btn onClick={runBurnInExport} disabled={isExporting || !captions.length || !format} className="w-full gap-2">
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Captions className="w-4 h-4" />}
                {isExporting ? "Memproses…" : "Bakar & Ekspor Video"}
              </Btn>
            </div>
            <button type="button" onClick={reset} className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold">
              Ganti Video
            </button>
          </div>
        )}

        <ToolInfoPanel
          icon={<Captions className="w-5 h-5" />}
          label="Teks & Subtitle (CC)"
          desc="Caption manual dengan dua cara ekspor"
          points={[
            "File .SRT/.VTT paling ringan dan instan — cocok kalau platform tujuan (YouTube, dll) mendukung subtitle terpisah.",
            "Bakar ke video kalau butuh teks permanen menyatu dengan gambar (untuk Reels/TikTok/WhatsApp Status).",
            "Belum ada transkripsi otomatis — teks & waktunya diisi manual sesuai video.",
          ]}
        />
      </div>
    </div>
    </div>
  );
}
