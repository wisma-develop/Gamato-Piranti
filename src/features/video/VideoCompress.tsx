import React, { useEffect, useMemo, useRef, useState } from "react";
import { Shrink, Download, Loader2, X, AlertTriangle, Timer, CheckCircle2, FlaskConical } from "lucide-react";
import { cn } from "@/utils/cn";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoPlayer } from "@/components/ui/GamatoPlayer";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { TimeRangeSlider } from "@/components/ui/TimeRangeSlider";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { Btn, Input, Label, Select } from "@/components/ui/primitives";
import { useVideoFile } from "@/hooks/useVideoFile";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import { exportSegmentedVideo, getSupportedExportFormats, isVideoExportSupported, formatTime, type ExportFormat } from "@/lib/videoEngine";

const fmtBytes = (n: number): string => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${(n / 1024).toFixed(0)} KB`);
const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";
const cap = "text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500";

interface Settings { height: number; fps: number; vKbps: number; aKbps: number; audio: boolean }

const PRESETS: { id: string; label: string; desc: string; s: Settings }[] = [
  { id: "light", label: "Ringan", desc: "Kualitas tinggi — 1080p maks, 2500 kbps", s: { height: 1080, fps: 30, vKbps: 2500, aKbps: 128, audio: true } },
  { id: "balanced", label: "Seimbang", desc: "720p, 1200 kbps — cocok untuk kebanyakan video", s: { height: 720, fps: 30, vKbps: 1200, aKbps: 96, audio: true } },
  { id: "chat", label: "WhatsApp / Chat", desc: "480p, 24 fps, 500 kbps — kecil & tetap enak ditonton", s: { height: 480, fps: 24, vKbps: 500, aKbps: 64, audio: true } },
  { id: "tiny", label: "Sangat kecil", desc: "360p, 15 fps, 250 kbps — ukuran minimum", s: { height: 360, fps: 15, vKbps: 250, aKbps: 32, audio: true } },
];

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void; testId?: string }> = ({ label, value, min, max, step = 1, suffix = "", onChange, testId }) => (
  <div data-testid={testId}>
    <div className="flex justify-between items-center mb-1.5">
      <Label>{label}</Label>
      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(value * 100) / 100}{suffix}</span>
    </div>
    <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
  </div>
);

export function VideoCompress() {
  const { meta, error: loadError, isLoading, load, reset } = useVideoFile();
  const formats = useMemo(() => getSupportedExportFormats(), []);
  const [formatIdx, setFormatIdx] = useState(0);
  const [presetId, setPresetId] = useState("balanced");
  const [custom, setCustom] = useState(false);
  const [s, setS] = useState<Settings>(PRESETS[1].s);
  const [targetMode, setTargetMode] = useState(false);
  const [targetMb, setTargetMb] = useState(10);
  const [useTrim, setUseTrim] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [running, setRunning] = useState<"full" | "test" | null>(null);
  const [progress, setProgress] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ blob: Blob; url: string; fmt: ExportFormat; w: number; h: number; test: boolean; segSec: number; settings: Settings } | null>(null);
  const cancelRef = useRef({ cancelled: false });
  const resultUrlRef = useRef<string | null>(null);

  const supported = isVideoExportSupported() && formats.length > 0;
  const fmt = formats[Math.min(formatIdx, formats.length - 1)] ?? null;

  useEffect(() => {
    if (!meta) return;
    setTrimStart(0);
    setTrimEnd(meta.duration);
    setUseTrim(false);
    clearResult();
    setError(null);
  }, [meta]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => () => { if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current); }, []);

  const clearResult = () => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = null;
    setResult(null);
  };

  const pickPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setPresetId(id);
    setCustom(false);
    setS(p.s);
  };

  const segStart = useTrim ? trimStart : 0;
  const segEnd = useTrim ? trimEnd : meta?.duration ?? 0;
  const segDur = Math.max(0, segEnd - segStart);

  // video bitrate actually used (target-size mode derives it from the duration)
  const effVKbps = useMemo(() => {
    if (!targetMode || segDur <= 0) return s.vKbps;
    const total = (targetMb * 1024 * 1024 * 8 * 0.94) / segDur / 1000; // 6% container/overshoot headroom
    return Math.max(60, Math.floor(total - (s.audio ? s.aKbps : 0)));
  }, [targetMode, targetMb, segDur, s]);

  const outDims = useMemo(() => {
    if (!meta) return { w: 0, h: 0 };
    const h = s.height > 0 && s.height < meta.height ? s.height : meta.height;
    const w = Math.round((meta.width * h) / meta.height);
    return { w: w - (w % 2), h: h - (h % 2) };
  }, [meta, s.height]);

  const estBytes = Math.round(((effVKbps + (s.audio ? s.aKbps : 0)) * 1000 * segDur) / 8);

  const handleFiles = (files: File[]) => {
    const f = files.find((x) => x.type.startsWith("video/"));
    if (f) load(f);
  };

  const run = async (mode: "full" | "test") => {
    if (!meta || !fmt) return;
    setError(null);
    clearResult();
    cancelRef.current = { cancelled: false };
    setRunning(mode);
    setProgress(0);
    setStartedAt(Date.now());
    setNow(Date.now());
    const a = segStart;
    const b = mode === "test" ? Math.min(segEnd, segStart + 5) : segEnd;
    try {
      const blob = await exportSegmentedVideo({
        sourceUrl: meta.url,
        segments: [{ start: a, end: b }],
        outputWidth: outDims.w,
        outputHeight: outDims.h,
        fps: s.fps,
        includeAudio: s.audio,
        videoBitsPerSecond: effVKbps * 1000,
        audioBitsPerSecond: s.audio ? s.aKbps * 1000 : undefined,
        format: fmt,
        monitorAudio: false,
        signal: cancelRef.current,
        drawFrame: (ctx, video, canvas) => ctx.drawImage(video, 0, 0, canvas.width, canvas.height),
        onProgress: setProgress,
      });
      const url = URL.createObjectURL(blob);
      resultUrlRef.current = url;
      setResult({ blob, url, fmt, w: outDims.w, h: outDims.h, test: mode === "test", segSec: b - a, settings: { ...s, vKbps: effVKbps } });
    } catch (e: any) {
      if (e?.message !== "Dibatalkan.") setError(e?.message ?? "Kompresi gagal.");
    } finally {
      setRunning(null);
    }
  };

  const baseName = meta ? sanitizeFileName(meta.file.name.replace(/\.[^.]+$/, "")) : "video";
  const elapsed = running ? (now - startedAt) / 1000 : 0;
  const eta = running && progress > 0.03 ? Math.max(0, elapsed / progress - elapsed) : null;
  const projected = result?.test && result.segSec > 0 ? Math.round((result.blob.size / result.segSec) * segDur) : null;

  return (
    <div className="space-y-5">
      <GamatoDesktopRecommended toolName="Kompres Video" />
      {!supported && <GamatoInlineAlert tone="error" message="Browser ini tidak mendukung perekaman video (MediaRecorder/captureStream). Gunakan Chrome, Edge, atau Firefox terbaru." />}

      {!meta ? (
        <div className="max-w-3xl mx-auto space-y-4">
          <Dropzone onFiles={handleFiles} accept="video/*" multiple={false} isDragging={isDragging} setIsDragging={setIsDragging} label="Unggah video untuk dikompres" sublabel="MP4, WebM, MOV — diproses di perangkatmu" icon={<Shrink className="w-8 h-8" />} />
          {isLoading && <div className="flex items-center justify-center gap-2 text-sm text-indigo-600"><Loader2 className="w-4 h-4 animate-spin" /> Membaca video…</div>}
          {loadError && <GamatoInlineAlert tone="error" message={loadError} />}
          <ToolInfoPanel
            icon={<Shrink className="w-5 h-5" />}
            label="Kompres Video"
            desc="Perkecil ukuran video dengan kontrol penuh"
            points={[
              "Atur resolusi, frame rate, bitrate video & audio — atau cukup tentukan target ukuran file (MB).",
              "Tombol “Uji 5 detik” memberi gambaran kualitas & ukuran akhir tanpa menunggu seluruh video.",
              "Video tidak diunggah ke server. Pengkodean berjalan real-time di browser, jadi lama proses ≈ durasi video.",
            ]}
          />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          <div className="space-y-4 min-w-0">
            <div className={card} data-testid="vc-source">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate" data-testid="vc-name">{meta.file.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="vc-meta">{meta.width}×{meta.height} · {formatTime(meta.duration)} · {fmtBytes(meta.file.size)} · ≈ {Math.round((meta.file.size * 8) / meta.duration / 1000)} kbps</p>
                </div>
                <Btn variant="ghost" className="text-xs py-1.5" onClick={() => { reset(); clearResult(); }} disabled={!!running}><X className="w-3.5 h-3.5" /> Ganti video</Btn>
              </div>
              <GamatoPlayer src={meta.url} label="Video asli" />
              <GamatoCheckbox checked={useTrim} onChange={setUseTrim} label="Kompres sebagian saja (potong)" testId="vc-trim-chk" />
              {useTrim && (
                <div className="space-y-2">
                  <TimeRangeSlider duration={meta.duration} start={trimStart} end={trimEnd} onChange={(a, b) => { setTrimStart(a); setTrimEnd(b); }} />
                  <p className="text-xs text-slate-500">{formatTime(trimStart)} → {formatTime(trimEnd)} ({formatTime(segDur)})</p>
                </div>
              )}
            </div>

            {running && (
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 p-4 space-y-2" data-testid="vc-progress">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-200">
                  <Loader2 className="w-4 h-4 animate-spin" /> {running === "test" ? "Menguji 5 detik pertama…" : "Mengompres…"} {Math.round(progress * 100)}%
                  {eta != null && <span className="font-normal text-xs text-indigo-500 ml-auto">sisa ± {eta < 90 ? `${Math.round(eta)} dtk` : `${Math.round(eta / 60)} mnt`}</span>}
                </div>
                <div className="h-2 rounded-full bg-indigo-100 dark:bg-indigo-900 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress * 100}%` }} /></div>
                <p className="text-[11px] text-indigo-600/80 dark:text-indigo-300/80">Jangan tutup atau pindah tab — pengkodean berjalan real-time.</p>
              </div>
            )}
            {error && <GamatoInlineAlert tone="error" message={error} />}

            {result && (
              <div className={card} data-testid="vc-result">
                <div className="flex flex-wrap items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{result.test ? "Hasil uji 5 detik" : "Kompresi selesai"}</p>
                  <span className="text-xs text-slate-500">{result.w}×{result.h} · {result.fmt.label}</span>
                </div>
                {!result.test && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3"><div className="text-[11px] text-slate-400">Asli</div><div className="font-bold" data-testid="vc-orig">{fmtBytes(meta.file.size)}</div></div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3"><div className="text-[11px] text-slate-400">Hasil</div><div className="font-bold" data-testid="vc-new">{fmtBytes(result.blob.size)}</div></div>
                    <div className={cn("rounded-xl p-3", result.blob.size < meta.file.size ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-amber-50 dark:bg-amber-500/10")}><div className="text-[11px] text-slate-400">Hemat</div><div className="font-bold" data-testid="vc-saved">{Math.round((1 - result.blob.size / meta.file.size) * 100)}%</div></div>
                  </div>
                )}
                {result.test && projected != null && (
                  <p className="text-sm text-slate-700 dark:text-slate-200" data-testid="vc-projected">Perkiraan ukuran seluruh video dengan pengaturan ini: <b>≈ {fmtBytes(projected)}</b> (asli {fmtBytes(meta.file.size)}).</p>
                )}
                {!result.test && result.blob.size >= meta.file.size && (
                  <p className="text-xs text-amber-600 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Hasil tidak lebih kecil dari video asli (video asli sudah sangat terkompresi). Turunkan bitrate/resolusi atau gunakan target ukuran.</p>
                )}
                <GamatoPlayer src={result.url} label="Hasil" compact />
                {!result.test && <Btn className="w-full py-3" onClick={() => downloadBlob(result.blob, `${baseName}-kompres.${result.fmt.ext}`)} data-testid="vc-download"><Download className="w-4 h-4" /> Unduh video terkompres</Btn>}
              </div>
            )}
          </div>

          <div className="space-y-4 min-w-0">
            <div className={card}>
              <p className={cap}>Tingkat Kompresi</p>
              <div className="space-y-2">
                {PRESETS.map((p) => (
                  <button key={p.id} type="button" data-testid={`vp-${p.id}`} disabled={!!running} onClick={() => pickPreset(p.id)} className={cn("w-full text-left rounded-xl border-2 px-3 py-2", !custom && presetId === p.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{p.label}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{p.desc}</div>
                  </button>
                ))}
                <button type="button" data-testid="vp-custom" disabled={!!running} onClick={() => setCustom(true)} className={cn("w-full text-left rounded-xl border-2 px-3 py-2", custom ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Kustom</div>
                  <div className="text-[11px] text-slate-500">Atur resolusi, fps, dan bitrate sendiri</div>
                </button>
              </div>
            </div>

            {custom && (
              <div className={card} data-testid="vc-custom">
                <p className={cap}>Pengaturan Kustom</p>
                <Select label="Resolusi (tinggi)" value={String(s.height)} onChange={(e) => setS({ ...s, height: parseInt(e.target.value) })} data-testid="vc-height">
                  <option value="0">Asli ({meta.height}p)</option>
                  {[1080, 720, 540, 480, 360, 240].filter((h) => h < meta.height).map((h) => <option key={h} value={h}>{h}p</option>)}
                </Select>
                <Select label="Frame rate" value={String(s.fps)} onChange={(e) => setS({ ...s, fps: parseInt(e.target.value) })} data-testid="vc-fps">
                  {[30, 24, 20, 15, 10].map((f) => <option key={f} value={f}>{f} fps</option>)}
                </Select>
                <Slider label="Bitrate video" value={s.vKbps} min={80} max={8000} step={10} suffix=" kbps" onChange={(v) => setS({ ...s, vKbps: v })} testId="vc-vk" />
                <GamatoCheckbox checked={s.audio} onChange={(v) => setS({ ...s, audio: v })} label="Sertakan audio" testId="vc-audio-chk" />
                {s.audio && <Select label="Bitrate audio" value={String(s.aKbps)} onChange={(e) => setS({ ...s, aKbps: parseInt(e.target.value) })}>{[32, 48, 64, 96, 128, 192].map((k) => <option key={k} value={k}>{k} kbps</option>)}</Select>}
              </div>
            )}

            <div className={card}>
              <p className={cap}>Target Ukuran</p>
              <GamatoCheckbox checked={targetMode} onChange={setTargetMode} label="Tentukan ukuran file maksimal" testId="vc-target-chk" />
              {targetMode && (
                <>
                  <Input label="Ukuran maksimal (MB)" type="number" min={0.2} step={0.5} value={targetMb} onChange={(e) => setTargetMb(Math.max(0.2, parseFloat(e.target.value) || 10))} data-testid="vc-target-mb" />
                  <p className="text-[11px] text-slate-400">Bitrate video dihitung otomatis dari durasi ({formatTime(segDur)}) → ≈ {effVKbps} kbps. Bitrate video di preset/kustom diabaikan.</p>
                </>
              )}
              {formats.length > 1 && (
                <Select label="Format keluaran" value={String(formatIdx)} onChange={(e) => setFormatIdx(parseInt(e.target.value))} data-testid="vc-format">
                  {formats.map((f, i) => <option key={f.mimeType} value={i}>{f.label} (.{f.ext})</option>)}
                </Select>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 text-sm space-y-1" data-testid="vc-estimate">
              <div className="flex justify-between"><span className="text-slate-500">Resolusi hasil</span><b>{outDims.w}×{outDims.h} @ {s.fps} fps</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Bitrate</span><b>{effVKbps}{s.audio ? ` + ${s.aKbps}` : ""} kbps</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Perkiraan ukuran</span><b data-testid="vc-est">≈ {fmtBytes(estBytes)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500 flex items-center gap-1"><Timer className="w-3 h-3" /> Perkiraan waktu</span><b>≈ {segDur < 90 ? `${Math.round(segDur)} dtk` : `${Math.round(segDur / 60)} mnt`}</b></div>
            </div>

            {running ? (
              <Btn variant="danger" className="w-full py-3" onClick={() => { cancelRef.current.cancelled = true; }} data-testid="vc-cancel"><X className="w-4 h-4" /> Batalkan</Btn>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                <Btn className="w-full py-3.5 text-base bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700" disabled={!supported || !fmt || segDur <= 0} onClick={() => run("full")} data-testid="vc-run"><Shrink className="w-4 h-4" /> Kompres video</Btn>
                <Btn variant="secondary" className="w-full text-xs py-2" disabled={!supported || !fmt || segDur <= 0} onClick={() => run("test")} data-testid="vc-test"><FlaskConical className="w-3.5 h-3.5" /> Uji 5 detik dulu</Btn>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
