import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { AudioLines, Play, Pause, Download, Loader2, X, Mic, MicOff, Upload, Save, FolderOpen, Film, Palette, Move, Image as ImageIcon, Type, Waves, Sparkles, AlertTriangle } from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { Btn, Label, Select, Input } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { GamatoPermissionNotice } from "@/components/ui/GamatoPermissionNotice";
import { requestMicrophone, stopStream, ensureAudioRunning, PermissionError, type PermFailure } from "@/lib/permissions";
import { SettingsTabBar } from "@/components/ui/SettingsTabs";
import { FontPicker } from "@/components/ui/FontPicker";
import { LogoUpload } from "@/components/ui/LogoUpload";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { decodeFileToPcm } from "@/lib/audioDecode";
import { AnalyserSource, BufferSource, VizAnalyzer, type FeedSource } from "@/lib/audioViz/analysis";
import { CANVAS_PRESETS, DEFAULT_CONFIG, STYLE_LIST, VIZ_PRESETS, clamp, isCircleStyle, sanitizeConfig, usesSpectrum, type VizConfig } from "@/lib/audioViz/config";
import { demoFrame, renderViz, type VizAssets } from "@/lib/audioViz/renderer";
import { ExportCancelled, estimateExport, exportViz, frameCountFor, type ExportFormat, type ExportResult } from "@/lib/audioViz/exporter";
import { tr } from "@/i18n";

type TabId = "style" | "spectrum" | "layout" | "color" | "bg" | "text" | "export";

const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";
const cap = "text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500";
const CHECKER = {
  backgroundImage: "linear-gradient(45deg,#cbd5e1 25%,transparent 25%),linear-gradient(-45deg,#cbd5e1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#cbd5e1 75%),linear-gradient(-45deg,transparent 75%,#cbd5e1 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
  backgroundColor: "#e2e8f0",
} as React.CSSProperties;

const fmtTime = (t: number) => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
};
const fmtBytes = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : b < 1024 ** 3 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024 ** 3).toFixed(2)} GB`);
const fmtDur = (s: number) => (s < 90 ? `${Math.round(s)} dtk` : `${Math.floor(s / 60)} mnt ${Math.round(s % 60)} dtk`);

const Sl: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; digits?: number; onChange: (v: number) => void; id: string; hint?: string }> = ({ label, value, min, max, step = 1, suffix = "", digits, onChange, id, hint }) => (
  <div data-testid={`av-${id}`}>
    <div className="flex justify-between items-center mb-1.5">
      <Label>{label}</Label>
      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{digits !== undefined ? value.toFixed(digits) : Math.round(value * 100) / 100}{suffix}</span>
    </div>
    <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
    {hint && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{hint}</p>}
  </div>
);

const Tg: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; id: string }> = ({ label, checked, onChange, id }) => (
  <GamatoCheckbox checked={checked} onChange={onChange} testId={`av-${id}`} label={<span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>} />
);

export const AudioVisualizer: React.FC = () => {
  const [cfg, setCfg] = useState<VizConfig>({ ...DEFAULT_CONFIG, ...VIZ_PRESETS[0].patch });
  const [presetId, setPresetId] = useState("klasik");
  const [tab, setTab] = useState<TabId>("style");
  const set = useCallback((p: Partial<VizConfig>) => setCfg((c) => ({ ...c, ...p })), []);

  // Audio
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<BufferSource | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [micOn, setMicOn] = useState(false);
  const [micFail, setMicFail] = useState<PermFailure | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const micRef = useRef<{ ctx: AudioContext; stream: MediaStream; source: AnalyserSource } | null>(null);

  // Aset gambar
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [assets, setAssets] = useState<VizAssets>({});

  // Teks & font
  const { customFonts, isFontLoading, fontError, addCustomFont, removeCustomFont } = useCustomFonts();

  // Ekspor
  const [format, setFormat] = useState<ExportFormat>("mov-png");
  const [includeAudio, setIncludeAudio] = useState(true);
  const [jpegQ, setJpegQ] = useState(90);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ f: number; frame: number; total: number; bytes: number; eta: number; msg?: string } | null>(null);
  const [result, setResult] = useState<(ExportResult & { url?: string }) | null>(null);
  const [estimate, setEstimate] = useState<{ bytes: number; renderSeconds: number; frames: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [alert, setAlert] = useState<{ msg: string; tone: "success" | "error" | "warning" | "info" } | null>(null);
  const cancelRef = useRef({ cancelled: false });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // ── status "hidup" untuk loop pratinjau (tanpa memulai ulang rAF) ──
  const live = useRef({ cfg, src: null as FeedSource | null, bufSrc: src, assets, exporting, playing, range, micOn });
  live.current = { cfg, src: micOn && micRef.current ? micRef.current.source : src, bufSrc: src, assets, exporting, playing, range, micOn };

  const duration = src?.duration ?? 0;
  const analysisKey = `${cfg.fftSize}|${cfg.bars}|${cfg.freqMin}|${cfg.freqMax}|${cfg.freqScale}|${cfg.gainDb}|${cfg.floorDb}|${cfg.tilt}|${cfg.attack}|${cfg.release}|${cfg.spatialSmooth}|${cfg.peakFall}|${src?.sampleRate ?? 0}|${micOn}`;

  // ── muat audio ──
  const loadAudio = async (files: File[]) => {
    const f = files.find((x) => x.type.startsWith("audio/") || x.type.startsWith("video/") || /\.(mp3|wav|ogg|m4a|flac|opus|aac|mp4|webm|mov|mkv)$/i.test(x.name));
    if (!f) {
      setAlert({ msg: tr("Pilih berkas audio (MP3, WAV, OGG, M4A, FLAC) atau video yang berisi audio."), tone: "warning" });
      return;
    }
    stopMic();
    setLoading(true);
    setAlert(null);
    setResult(null);
    try {
      const pcm = await decodeFileToPcm(f);
      const bs = new BufferSource(pcm.channels, pcm.sampleRate);
      if (!(bs.duration > 0.2)) throw new Error(tr("Audio terlalu pendek atau kosong."));
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(f));
      setFile(f);
      setSrc(bs);
      setRange([0, bs.duration]);
      setCurrent(0);
      setPlaying(false);
      if (!cfg.title) set({ title: f.name.replace(/\.[^.]+$/, "").slice(0, 60) });
    } catch (e: any) {
      setAlert({ msg: e?.message || tr("Gagal membaca audio."), tone: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  // ── transport ──
  const togglePlay = () => {
    const a = audioRef.current;
    if (!a || !src) return;
    if (a.paused) {
      if (a.currentTime >= src.duration - 0.05) a.currentTime = live.current.range[0];
      a.play().catch(() => setAlert({ msg: tr("Browser memblokir pemutaran — klik lagi."), tone: "warning" }));
    } else a.pause();
  };
  const seek = (t: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = clamp(t, 0, duration);
    setCurrent(t);
  };

  // ── mikrofon ──
  function stopMic() {
    const m = micRef.current;
    if (m) {
      stopStream(m.stream);
      m.ctx.close().catch(() => {});
      micRef.current = null;
    }
    setMicOn(false);
  }
  const toggleMic = async () => {
    if (micOn) return stopMic();
    setMicFail(null);
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    try {
      audioRef.current?.pause();
      stream = await requestMicrophone({ echoCancellation: false, noiseSuppression: false, autoGainControl: false });
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      ctx = new Ctx() as AudioContext;
      await ensureAudioRunning(ctx);
      const an = ctx.createAnalyser();
      an.fftSize = 8192;
      ctx.createMediaStreamSource(stream).connect(an);
      micRef.current = { ctx, stream, source: new AnalyserSource(an, ctx.sampleRate) };
      setMicOn(true);
      setAlert({ msg: tr("Mikrofon aktif — hanya untuk pratinjau live. Ekspor memakai berkas audio."), tone: "info" });
    } catch (e) {
      stopStream(stream);
      ctx?.close().catch(() => {});
      if (e instanceof PermissionError) setMicFail(e.failure);
      else setAlert({ msg: tr("Mikrofon tidak bisa dipakai. Coba lagi."), tone: "error" });
    }
  };
  useEffect(() => () => { stopMic(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── aset gambar ──
  useEffect(() => {
    let dead = false;
    (async () => {
      const next: VizAssets = {};
      try { if (bgFile) next.bg = await createImageBitmap(bgFile); } catch { /* abaikan */ }
      try { if (logoFile) next.logo = await createImageBitmap(logoFile); } catch { /* abaikan */ }
      if (!dead) setAssets(next);
    })();
    return () => { dead = true; };
  }, [bgFile, logoFile]);

  // ── muat font teks sebelum digambar ──
  useEffect(() => {
    try { (document as any).fonts?.load?.(`700 40px "${cfg.textFont}"`); } catch { /* abaikan */ }
  }, [cfg.textFont, customFonts]);

  // ── loop pratinjau ──
  const analyzerRef = useRef<{ key: string; a: VizAnalyzer } | null>(null);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const L = live.current;
      const canvas = canvasRef.current;
      if (!canvas || L.exporting) { last = now; return; }
      const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
      last = now;
      const c = L.cfg;
      const ps = Math.min(1, 960 / c.width, 720 / c.height);
      const pw = Math.max(1, Math.round(c.width * ps)), ph = Math.max(1, Math.round(c.height * ps));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const a = audioRef.current;
      let t = 0;
      let frame;
      if (L.src) {
        if (L.micOn) t = now / 1000;
        else t = a ? a.currentTime : 0;
        const key = analysisKeyRef.current;
        if (!analyzerRef.current || analyzerRef.current.key !== key) analyzerRef.current = { key, a: new VizAnalyzer(c, L.src.sampleRate) };
        const playingNow = L.micOn || (!!a && !a.paused && !a.ended);
        frame = analyzerRef.current.a.analyze(L.src.getWindows(t, c.fftSize), dt, !playingNow);
        // otomatis berhenti di akhir rentang
        if (!L.micOn && a && !a.paused && t >= L.range[1] - 0.02 && L.range[1] < (L.bufSrc?.duration ?? 0) - 0.05) a.pause();
      } else {
        t = now / 1000;
        frame = demoFrame(t, c.bars);
      }
      ctx.setTransform(ps, 0, 0, ps, 0, 0);
      renderViz(ctx, c, frame, L.assets, t, L.bufSrc?.duration ?? 0, ps);
      if (now - lastUi > 120 && L.bufSrc && !L.micOn) {
        lastUi = now;
        setCurrent(t);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const analysisKeyRef = useRef(analysisKey);
  analysisKeyRef.current = analysisKey;

  // sinkron status play/pause dari elemen audio
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const on = () => setPlaying(true), off = () => setPlaying(false);
    a.addEventListener("play", on);
    a.addEventListener("pause", off);
    a.addEventListener("ended", off);
    return () => { a.removeEventListener("play", on); a.removeEventListener("pause", off); a.removeEventListener("ended", off); };
  }, [audioUrl]);

  // ── ukuran & waktu ekspor ──
  const frames = src ? frameCountFor(range[0], range[1], cfg.fps) : 0;
  const hasBg = cfg.bgMode !== "transparent";

  useEffect(() => {
    setEstimate(null);
    if (!src || exporting) return;
    let dead = false;
    const id = setTimeout(async () => {
      setEstimating(true);
      try {
        const e = await estimateExport({ src, cfg, assets, start: range[0], end: range[1], format, includeAudio, jpegQuality: jpegQ / 100 });
        if (!dead) setEstimate(e);
      } catch { /* abaikan */ }
      finally { if (!dead) setEstimating(false); }
    }, 700);
    return () => { dead = true; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, cfg, assets, range, format, includeAudio, exporting, jpegQ]);

  const runExport = async () => {
    if (!src || !file) return;
    cancelRef.current = { cancelled: false };
    audioRef.current?.pause();
    setExporting(true);
    setResult(null);
    setAlert(null);
    setProgress({ f: 0, frame: 0, total: frames, bytes: 0, eta: 0 });
    try {
      const r = await exportViz({
        src, cfg, assets, start: range[0], end: range[1], format, includeAudio, jpegQuality: jpegQ / 100,
        fileBase: `${file.name.replace(/\.[^.]+$/, "")}-visualizer`,
        signal: cancelRef.current,
        onProgress: (f, i) => setProgress({ f, frame: i.frame, total: i.total, bytes: i.bytes, eta: i.etaSec, msg: i.message }),
      });
      setResult(r);
      downloadBlob(r.blob, r.name);
      setAlert({ msg: tr("Selesai: {0} ({1}, {2} frame) — diunduh otomatis.", r.name, fmtBytes(r.bytes), r.frames), tone: "success" });
    } catch (e: any) {
      if (e instanceof ExportCancelled) setAlert({ msg: tr("Ekspor dibatalkan."), tone: "info" });
      else setAlert({ msg: e?.message || tr("Ekspor gagal."), tone: "error" });
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  // ── simpan / muat pengaturan ──
  const saveConfig = () => downloadBlob(new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" }), "gamato-visualizer-preset.json");
  const loadConfig = async (f: File | undefined | null) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      setCfg(sanitizeConfig(j));
      setPresetId("");
      setAlert({ msg: tr("Pengaturan dimuat."), tone: "success" });
    } catch {
      setAlert({ msg: tr("Berkas pengaturan tidak valid."), tone: "error" });
    }
  };

  const applyPreset = (id: string) => {
    const p = VIZ_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    // preset hanya menimpa tampilan — ukuran kanvas, fps, teks & logo pengguna tetap.
    setCfg((c) => ({ ...c, ...p.patch }));
  };

  const circle = isCircleStyle(cfg.style);
  const spectrum = usesSpectrum(cfg.style);
  const barish = ["bars", "bars-mirror", "blocks", "dots", "circle-bars"].includes(cfg.style);
  const lineish = ["line", "area", "wave", "lissajous", "circle-wave", "circle-blob", "pulse"].includes(cfg.style);
  const estTooBig = !!estimate && estimate.bytes > 3.5 * 1024 ** 3;

  const tabs = useMemo(() => [
    { id: "style" as const, label: tr("Gaya"), icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "spectrum" as const, label: tr("Spektrum"), icon: <Waves className="w-3.5 h-3.5" /> },
    { id: "layout" as const, label: tr("Tata Letak"), icon: <Move className="w-3.5 h-3.5" /> },
    { id: "color" as const, label: tr("Warna & Efek"), icon: <Palette className="w-3.5 h-3.5" /> },
    { id: "bg" as const, label: tr("Latar"), icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { id: "text" as const, label: tr("Logo & Teks"), icon: <Type className="w-3.5 h-3.5" /> },
    { id: "export" as const, label: tr("Ekspor"), icon: <Film className="w-3.5 h-3.5" /> },
  ], []);

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_440px] gap-6 items-start">
      <GamatoDesktopRecommended toolName="Visualizer Audio" className="lg:col-span-full" />
      {/* ── KIRI: pratinjau + transport ── */}
      <div className="space-y-4 xl:sticky xl:top-24">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm" style={CHECKER} data-testid="av-preview-wrap">
          <div className="flex justify-center bg-transparent">
            <canvas ref={canvasRef} data-testid="av-canvas" style={{ maxHeight: "68vh", width: "auto", maxWidth: "100%", aspectRatio: `${cfg.width} / ${cfg.height}` }} />
          </div>
        </div>
        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
          {cfg.bgMode === "transparent" ? tr("Kotak-kotak = bagian transparan (akan transparan di .mov).") : tr("Latar aktif — .mov akan memakai latar ini.")}{" "}{tr("Pratinjau {0}×{1} · {2} fps", cfg.width, cfg.height, cfg.fps)}{!src && !micOn ? tr(" · animasi demo sampai audio dimuat") : ""}
        </p>

        {!src && (
          <Dropzone onFiles={loadAudio} multiple={false} accept="audio/*,video/*" label={loading ? tr("Membaca audio…") : tr("Drop audio di sini")} sublabel={tr("MP3, WAV, OGG, M4A, FLAC — atau video yang berisi audio")} icon={loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <AudioLines className="w-8 h-8" />} isDragging={isDragging} setIsDragging={setIsDragging} />
        )}

        {src && file && (
          <div className={card} data-testid="av-transport">
            <div className="flex items-center gap-3">
              <button type="button" data-testid="av-play" onClick={togglePlay} disabled={exporting || micOn} className="w-11 h-11 rounded-full bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 shrink-0" aria-label={playing ? tr("Jeda") : tr("Putar")}>
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" data-testid="av-filename">{file.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  <span data-testid="av-time">{fmtTime(current)}</span>{" "}{tr("/ {0} · {1} kHz ·", fmtTime(duration), Math.round(src.sampleRate / 100) / 10)}{" "}{src.channels.length === 1 ? "mono" : "stereo"}
                </p>
              </div>
              <button type="button" onClick={toggleMic} className={cn("p-2 rounded-xl border text-sm", micOn ? "border-red-300 bg-red-50 text-red-600" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800")} title={tr("Pratinjau dari mikrofon")} aria-label={tr("Mikrofon")}>
                {micOn ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <label className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" title={tr("Ganti audio")}>
                <Upload className="w-4 h-4" />
                <input type="file" accept="audio/*,video/*" className="hidden" data-testid="av-replace-input" onChange={(e) => e.target.files && loadAudio(Array.from(e.target.files))} />
              </label>
            </div>
            <GamatoSlider min={0} max={Math.max(0.1, duration)} step={0.05} value={clamp(current, 0, duration)} onChange={seek} aria-label={tr("Posisi")} />
          </div>
        )}
        {!src && (
          <button type="button" onClick={toggleMic} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800">
            {micOn ? <><MicOff className="w-4 h-4" />{tr("Matikan mikrofon")}</> : <><Mic className="w-4 h-4" />{tr("Atau pratinjau dari mikrofon (live)")}</>}
          </button>
        )}
        <GamatoPermissionNotice failure={micFail} onRetry={toggleMic} onDismiss={() => setMicFail(null)} />
        {alert && <GamatoInlineAlert message={alert.msg} tone={alert.tone} />}
        <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" className="hidden" style={{ display: "none" }} />
      </div>

      {/* ── KANAN: pengaturan ── */}
      <div className="space-y-4 min-w-0">
        <SettingsTabBar tabs={tabs} active={tab} onChange={(t) => setTab(t)} />

        {tab === "style" && (
          <div className={card} data-testid="av-tab-style">
            <p className={cap}>{tr("Preset Cepat")}</p>
            <div className="grid grid-cols-2 gap-2">
              {VIZ_PRESETS.map((p) => (
                <button key={p.id} type="button" data-testid={`av-preset-${p.id}`} onClick={() => applyPreset(p.id)} title={p.desc}
                  className={cn("text-left px-3 py-2 rounded-xl border-2 text-sm transition-all", presetId === p.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                  <span className="font-bold text-slate-800 dark:text-slate-100 block">{p.label}</span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1">{p.desc}</span>
                </button>
              ))}
            </div>
            <p className={cap}>{tr("Gaya Visual")}</p>
            <div className="flex flex-wrap gap-2">
              {STYLE_LIST.map((s) => (
                <button key={s.id} type="button" data-testid={`av-style-${s.id}`} onClick={() => { set({ style: s.id }); setPresetId(""); }}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all", cfg.style === s.id ? "bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300")}>
                  {s.label}
                </button>
              ))}
            </div>
            {spectrum && !["line", "area", "pulse", "circle-blob"].includes(cfg.style) && <Sl id="bars" label={tr("Jumlah batang")} value={cfg.bars} min={8} max={192} onChange={(v) => set({ bars: v })} />}
            {["line", "area", "circle-blob"].includes(cfg.style) && <Sl id="bars" label={tr("Titik kontrol")} value={cfg.bars} min={8} max={192} onChange={(v) => set({ bars: v })} />}
            {barish && <Sl id="barwidth" label={tr("Lebar batang")} value={cfg.barWidth} min={0.1} max={1} step={0.05} digits={2} onChange={(v) => set({ barWidth: v })} />}
            {["bars", "bars-mirror", "circle-bars", "blocks"].includes(cfg.style) && <Sl id="barradius" label={tr("Sudut membulat")} value={cfg.barRadius} min={0} max={1} step={0.05} digits={2} onChange={(v) => set({ barRadius: v })} />}
            {["bars", "bars-mirror", "circle-bars", "circle-dots"].includes(cfg.style) && <Sl id="minbar" label={tr("Tinggi minimum")} value={cfg.minBar} min={0} max={30} suffix={tr(" px")} onChange={(v) => set({ minBar: v })} />}
            {["blocks", "dots"].includes(cfg.style) && (
              <>
                <Sl id="segments" label={tr("Jumlah segmen")} value={cfg.segments} min={4} max={40} onChange={(v) => set({ segments: v })} />
                <Sl id="seggap" label={tr("Celah segmen")} value={cfg.segGap} min={0} max={0.8} step={0.05} digits={2} onChange={(v) => set({ segGap: v })} />
              </>
            )}
            {["dots", "circle-dots"].includes(cfg.style) && <Sl id="dotsize" label={tr("Ukuran titik")} value={cfg.dotSize} min={2} max={30} suffix={tr(" px")} onChange={(v) => set({ dotSize: v })} />}
            {lineish && <Sl id="linewidth" label={tr("Tebal garis")} value={cfg.lineWidth} min={1} max={24} suffix={tr(" px")} onChange={(v) => set({ lineWidth: v })} />}
            {["bars", "bars-mirror", "circle-bars"].includes(cfg.style) && <Tg id="peaks" label={tr("Tampilkan penanda puncak (peak cap)")} checked={cfg.peaks} onChange={(v) => set({ peaks: v })} />}
          </div>
        )}

        {tab === "spectrum" && (
          <div className={card} data-testid="av-tab-spectrum">
            <p className={cap}>{tr("Analisis Frekuensi")}</p>
            <div className="grid grid-cols-2 gap-3">
              <Select label={tr("Skala frekuensi")} value={cfg.freqScale} onChange={(e) => set({ freqScale: e.target.value as VizConfig["freqScale"] })}>
                <option value="log">{tr("Logaritmik (alami)")}</option>
                <option value="sqrt">{tr("Akar kuadrat")}</option>
                <option value="linear">{tr("Linear")}</option>
              </Select>
              <Select label={tr("Resolusi FFT")} value={String(cfg.fftSize)} onChange={(e) => set({ fftSize: Number(e.target.value) as VizConfig["fftSize"] })}>
                <option value="1024">{tr("1024 (cepat)")}</option>
                <option value="2048">2048</option>
                <option value="4096">{tr("4096 (bass detail)")}</option>
                <option value="8192">{tr("8192 (sangat detail)")}</option>
              </Select>
            </div>
            <Sl id="fmin" label={tr("Frekuensi terendah")} value={cfg.freqMin} min={20} max={500} suffix={tr(" Hz")} onChange={(v) => set({ freqMin: v })} />
            <Sl id="fmax" label={tr("Frekuensi tertinggi")} value={cfg.freqMax} min={2000} max={20000} step={100} suffix={tr(" Hz")} onChange={(v) => set({ freqMax: v })} />
            <p className={cap}>{tr("Respons")}</p>
            <Sl id="gain" label="Sensitivitas" value={cfg.gainDb} min={-10} max={40} suffix={tr(" dB")} hint={tr("Naikkan bila batang terlalu rendah pada lagu pelan.")} onChange={(v) => set({ gainDb: v })} />
            <Sl id="floor" label={tr("Lantai derau")} value={cfg.floorDb} min={-110} max={-40} suffix={tr(" dB")} hint={tr("Suara di bawah nilai ini dianggap senyap.")} onChange={(v) => set({ floorDb: v })} />
            <Sl id="tilt" label={tr("Penyeimbang nada tinggi")} value={cfg.tilt} min={0} max={9} step={0.5} suffix={tr(" dB/oktaf")} onChange={(v) => set({ tilt: v })} />
            <Sl id="attack" label={tr("Kecepatan naik (attack)")} value={cfg.attack} min={2} max={250} suffix={tr(" ms")} onChange={(v) => set({ attack: v })} />
            <Sl id="release" label={tr("Kecepatan turun (release)")} value={cfg.release} min={20} max={1500} step={10} suffix={tr(" ms")} onChange={(v) => set({ release: v })} />
            <Sl id="smooth" label={tr("Haluskan antar batang")} value={cfg.spatialSmooth} min={0} max={4} onChange={(v) => set({ spatialSmooth: v })} />
            <Sl id="peakfall" label={tr("Kecepatan turun penanda puncak")} value={cfg.peakFall} min={0.1} max={2} step={0.05} digits={2} onChange={(v) => set({ peakFall: v })} />
          </div>
        )}

        {tab === "layout" && (
          <div className={cn(card)} data-testid="av-tab-layout">
            <p className={cap}>{tr("Posisi & Ukuran Area")}</p>
            <Sl id="posx" label={tr("Posisi horizontal")} value={cfg.posX} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ posX: v })} />
            <Sl id="posy" label={tr("Posisi vertikal")} value={cfg.posY} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ posY: v })} />
            <Sl id="areaw" label={tr("Lebar area")} value={cfg.areaW} min={0.1} max={1.5} step={0.01} digits={2} onChange={(v) => set({ areaW: v })} />
            <Sl id="areah" label={tr("Tinggi area")} value={cfg.areaH} min={0.05} max={1.5} step={0.01} digits={2} onChange={(v) => set({ areaH: v })} />
            <Sl id="rotation" label={tr("Rotasi")} value={cfg.rotation} min={-180} max={180} suffix="°" onChange={(v) => set({ rotation: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Tg id="mirrorx" label={tr("Cermin horizontal")} checked={cfg.mirrorX} onChange={(v) => set({ mirrorX: v })} />
              <Tg id="flipy" label={tr("Balik vertikal")} checked={cfg.flipY} onChange={(v) => set({ flipY: v })} />
            </div>
            {circle && (
              <>
                <p className={cap}>{tr("Lingkaran")}</p>
                <Sl id="radius" label={tr("Radius dalam")} value={cfg.radius} min={0.05} max={0.95} step={0.01} digits={2} onChange={(v) => set({ radius: v })} />
                <Sl id="startangle" label={tr("Sudut awal")} value={cfg.startAngle} min={-180} max={180} suffix="°" onChange={(v) => set({ startAngle: v })} />
                <Sl id="spin" label={tr("Putaran otomatis")} value={cfg.spin} min={-90} max={90} suffix={tr("°/dtk")} onChange={(v) => set({ spin: v })} />
                {["circle-bars", "circle-dots", "circle-blob"].includes(cfg.style) && <Tg id="symmetric" label={tr("Simetris kiri-kanan")} checked={cfg.circleSymmetric} onChange={(v) => set({ circleSymmetric: v })} />}
              </>
            )}
            <Btn variant="secondary" onClick={() => set({ posX: 0.5, posY: 0.5, areaW: DEFAULT_CONFIG.areaW, areaH: DEFAULT_CONFIG.areaH, rotation: 0, mirrorX: false, flipY: false })}>{tr("Reset tata letak")}</Btn>
          </div>
        )}

        {tab === "color" && (
          <div className={card} data-testid="av-tab-color">
            <p className={cap}>{tr("Warna")}</p>
            <Select label={tr("Mode warna")} value={cfg.colorMode} onChange={(e) => set({ colorMode: e.target.value as VizConfig["colorMode"] })}>
              <option value="solid">{tr("Satu warna")}</option>
              <option value="gradient">{tr("Gradien")}</option>
              <option value="rainbow">{tr("Pelangi (berputar)")}</option>
              <option value="level">{tr("Berdasarkan level (hijau → merah)")}</option>
            </Select>
            {cfg.colorMode !== "rainbow" && (
              <div className="grid grid-cols-3 gap-3">
                <GamatoColorPicker label={tr("Warna 1")} value={cfg.color1} onChange={(v) => set({ color1: v })} testId="av-color1" />
                {cfg.colorMode !== "solid" && <GamatoColorPicker label={tr("Warna 2")} value={cfg.color2} onChange={(v) => set({ color2: v })} testId="av-color2" />}
                {cfg.colorMode !== "solid" && cfg.useColor3 && <GamatoColorPicker label={tr("Warna 3")} value={cfg.color3} onChange={(v) => set({ color3: v })} testId="av-color3" />}
              </div>
            )}
            {(cfg.colorMode === "gradient" || cfg.colorMode === "level") && <Tg id="usecolor3" label={tr("Pakai 3 warna")} checked={cfg.useColor3} onChange={(v) => set({ useColor3: v })} />}
            {cfg.colorMode === "gradient" && <Sl id="gradangle" label={tr("Arah gradien")} value={cfg.gradAngle} min={0} max={360} suffix="°" hint={tr("90° = atas ke bawah, 0° = kiri ke kanan.")} onChange={(v) => set({ gradAngle: v })} />}
            {cfg.colorMode === "rainbow" && <Sl id="hue" label={tr("Kecepatan pergeseran warna")} value={cfg.hueShift} min={-180} max={180} suffix={tr("°/dtk")} onChange={(v) => set({ hueShift: v })} />}
            <Sl id="opacity" label={tr("Kepekatan")} value={cfg.opacity} min={0.05} max={1} step={0.01} digits={2} onChange={(v) => set({ opacity: v })} />
            <p className={cap}>{tr("Efek")}</p>
            <Sl id="glow" label={tr("Cahaya (glow)")} value={cfg.glow} min={0} max={60} suffix={tr(" px")} onChange={(v) => set({ glow: v })} />
            {cfg.glow > 0 && (
              <div className="flex items-end gap-3">
                <GamatoColorPicker label={tr("Warna cahaya")} value={cfg.glowColor || cfg.color1} onChange={(v) => set({ glowColor: v })} testId="av-glowcolor" />
                {cfg.glowColor && <button type="button" onClick={() => set({ glowColor: "" })} className="text-xs font-semibold text-slate-500 hover:text-indigo-600 pb-3">{tr("Otomatis")}</button>}
              </div>
            )}
            {["bars", "bars-mirror", "blocks", "circle-bars", "pulse"].includes(cfg.style) && (
              <>
                <Sl id="outline" label={tr("Garis tepi")} value={cfg.outline} min={0} max={10} step={0.5} suffix={tr(" px")} onChange={(v) => set({ outline: v })} />
                {cfg.outline > 0 && <GamatoColorPicker label={tr("Warna garis tepi")} value={cfg.outlineColor} onChange={(v) => set({ outlineColor: v })} testId="av-outlinecolor" />}
              </>
            )}
            {["bars", "blocks", "dots", "line", "area", "wave"].includes(cfg.style) && (
              <>
                <Sl id="reflection" label={tr("Pantulan (reflection)")} value={cfg.reflection} min={0} max={1} step={0.05} digits={2} onChange={(v) => set({ reflection: v })} />
                {cfg.reflection > 0 && <Sl id="reflen" label={tr("Panjang pantulan")} value={cfg.reflectionLen} min={0.1} max={1} step={0.05} digits={2} onChange={(v) => set({ reflectionLen: v })} />}
              </>
            )}
          </div>
        )}

        {tab === "bg" && (
          <div className={card} data-testid="av-tab-bg">
            <p className={cap}>{tr("Latar Belakang")}</p>
            <div className="grid grid-cols-2 gap-2">
              {([["transparent", tr("Transparan")], ["solid", tr("Warna")], ["gradient", tr("Gradien")], ["image", tr("Gambar")]] as const).map(([id, l]) => (
                <button key={id} type="button" data-testid={`av-bg-${id}`} onClick={() => set({ bgMode: id })}
                  className={cn("py-2.5 rounded-xl text-sm font-semibold border-2 transition-all", cfg.bgMode === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>
                  {l}
                </button>
              ))}
            </div>
            {cfg.bgMode === "transparent" && <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">{tr("Latar transparan otomatis: hasil .mov punya kanal alpha — tumpuk langsung di atas video lain di editor.")}</p>}
            {(cfg.bgMode === "solid" || cfg.bgMode === "gradient" || cfg.bgMode === "image") && (
              <div className="grid grid-cols-2 gap-3">
                <GamatoColorPicker label={cfg.bgMode === "gradient" ? tr("Warna 1") : tr("Warna")} value={cfg.bgColor1} onChange={(v) => set({ bgColor1: v })} testId="av-bgcolor1" />
                {cfg.bgMode === "gradient" && <GamatoColorPicker label={tr("Warna 2")} value={cfg.bgColor2} onChange={(v) => set({ bgColor2: v })} testId="av-bgcolor2" />}
              </div>
            )}
            {cfg.bgMode === "gradient" && <Sl id="bgangle" label={tr("Arah gradien latar")} value={cfg.bgAngle} min={0} max={360} suffix="°" onChange={(v) => set({ bgAngle: v })} />}
            {cfg.bgMode === "image" && (
              <>
                <LogoUpload file={bgFile} onChange={setBgFile} label={tr("Gambar latar")} hint={tr("Diisi memenuhi kanvas (crop tengah).")} />
                <Sl id="bgdim" label={tr("Gelapkan")} value={cfg.bgDim} min={0} max={0.9} step={0.05} digits={2} onChange={(v) => set({ bgDim: v })} />
                <Sl id="bgblur" label={tr("Blur")} value={cfg.bgBlur} min={0} max={40} suffix={tr(" px")} onChange={(v) => set({ bgBlur: v })} />
                <Sl id="bgbeat" label={tr("Zoom mengikuti bass")} value={cfg.bgBeat} min={0} max={1} step={0.05} digits={2} onChange={(v) => set({ bgBeat: v })} />
              </>
            )}
          </div>
        )}

        {tab === "text" && (
          <div className={card} data-testid="av-tab-text">
            <p className={cap}>{tr("Logo / Gambar Tengah")}</p>
            <Tg id="logoon" label={tr("Tampilkan logo")} checked={cfg.logoOn} onChange={(v) => set({ logoOn: v })} />
            {cfg.logoOn && (
              <>
                <LogoUpload file={logoFile} onChange={setLogoFile} label={tr("Gambar logo")} hint={tr("Berdenyut mengikuti bass.")} />
                <Select label={tr("Bentuk")} value={cfg.logoShape} onChange={(e) => set({ logoShape: e.target.value as VizConfig["logoShape"] })}>
                  <option value="circle">{tr("Lingkaran")}</option>
                  <option value="rounded">{tr("Persegi membulat")}</option>
                  <option value="square">{tr("Persegi")}</option>
                </Select>
                <Sl id="logosize" label={tr("Ukuran")} value={cfg.logoSize} min={0.05} max={0.8} step={0.01} digits={2} onChange={(v) => set({ logoSize: v })} />
                <Sl id="logobeat" label={tr("Denyut bass")} value={cfg.logoBeat} min={0} max={0.6} step={0.01} digits={2} onChange={(v) => set({ logoBeat: v })} />
                <Sl id="logox" label={tr("Posisi horizontal")} value={cfg.logoX} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ logoX: v })} />
                <Sl id="logoy" label={tr("Posisi vertikal")} value={cfg.logoY} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ logoY: v })} />
                <Sl id="logoborder" label={tr("Tebal bingkai")} value={cfg.logoBorder} min={0} max={20} suffix={tr(" px")} onChange={(v) => set({ logoBorder: v })} />
                {cfg.logoBorder > 0 && <GamatoColorPicker label={tr("Warna bingkai")} value={cfg.logoBorderColor} onChange={(v) => set({ logoBorderColor: v })} testId="av-logobordercolor" />}
              </>
            )}
            <p className={cap}>{tr("Teks")}</p>
            <Input label={tr("Judul")} value={cfg.title} onChange={(e) => set({ title: e.target.value })} placeholder={tr("Judul lagu")} data-testid="av-title" />
            <Input label={tr("Subjudul")} value={cfg.subtitle} onChange={(e) => set({ subtitle: e.target.value })} placeholder={tr("Nama artis / keterangan")} data-testid="av-subtitle" />
            <FontPicker value={cfg.textFont} onChange={(f) => set({ textFont: f })} customFonts={customFonts} isFontLoading={isFontLoading} fontError={fontError} onUpload={addCustomFont} onRemoveCustomFont={(id) => removeCustomFont(id, (fb) => set({ textFont: fb }))} label={tr("Font teks")} />
            <Sl id="textsize" label={tr("Ukuran teks")} value={cfg.textSize} min={14} max={160} suffix={tr(" px")} onChange={(v) => set({ textSize: v })} />
            <GamatoColorPicker label={tr("Warna teks")} value={cfg.textColor} onChange={(v) => set({ textColor: v })} testId="av-textcolor" />
            <Select label={tr("Perataan")} value={cfg.textAlign} onChange={(e) => set({ textAlign: e.target.value as VizConfig["textAlign"] })}>
              <option value="center">{tr("Tengah")}</option>
              <option value="left">{tr("Kiri")}</option>
              <option value="right">{tr("Kanan")}</option>
            </Select>
            <Sl id="textx" label={tr("Posisi horizontal")} value={cfg.textX} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ textX: v })} />
            <Sl id="texty" label={tr("Posisi vertikal")} value={cfg.textY} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ textY: v })} />
            <Tg id="textshadow" label={tr("Bayangan teks")} checked={cfg.textShadow} onChange={(v) => set({ textShadow: v })} />
            <p className={cap}>{tr("Bilah Progres")}</p>
            <Tg id="progress" label={tr("Tampilkan bilah progres lagu")} checked={cfg.progress} onChange={(v) => set({ progress: v })} />
            {cfg.progress && (
              <>
                <Select label={tr("Posisi")} value={cfg.progressPos} onChange={(e) => set({ progressPos: e.target.value as "top" | "bottom" })}>
                  <option value="bottom">{tr("Bawah")}</option>
                  <option value="top">{tr("Atas")}</option>
                </Select>
                <GamatoColorPicker label={tr("Warna progres")} value={cfg.progressColor} onChange={(v) => set({ progressColor: v })} testId="av-progresscolor" />
                <Sl id="progressh" label={tr("Tebal")} value={cfg.progressH} min={2} max={30} suffix={tr(" px")} onChange={(v) => set({ progressH: v })} />
              </>
            )}
          </div>
        )}

        {tab === "export" && (
          <div className={card} data-testid="av-tab-export">
            <p className={cap}>{tr("Format Ekspor")}</p>
            <Select label={tr("Format")} value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
              <option value="mov-png">{tr(".mov — PNG (alpha, ukuran kecil) · direkomendasikan")}</option>
              <option value="mov-rle">{tr(".mov — Animation/RLE (alpha, lossless, kompatibel luas)")}</option>
              <option value="mov-jpeg">{tr(".mov — JPEG (latar penuh, ukuran kecil; tanpa alpha)")}</option>
              <option value="png-zip">{tr("ZIP urutan PNG + audio.wav (cadangan)")}</option>
            </Select>
            <div className={cn("rounded-xl px-3 py-2.5 text-xs border", hasBg ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30")} data-testid="av-alpha-note">
              {hasBg ? tr("Latar aktif → video akan memakai latar (tanpa transparansi).") : tr("Latar transparan → .mov punya kanal alpha otomatis.")}
            </div>
            {format === "mov-jpeg" && !hasBg && (
              <p className="text-[11px] text-red-600 dark:text-red-400" data-testid="av-jpeg-warn">{tr("Format JPEG tidak punya transparansi — aktifkan latar (tab Latar) atau pilih PNG/RLE.")}</p>
            )}
            {format === "mov-jpeg" && hasBg && (
              <Sl id="jpegq" label={tr("Kualitas JPEG")} value={jpegQ} min={50} max={100} suffix="%" onChange={setJpegQ} />
            )}
            {format === "mov-rle" && hasBg && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300" data-testid="av-rle-warn">{tr("Animation/RLE dengan latar gradien/gambar bisa sangat besar (tanpa kompresi detail). Untuk latar penuh, pilih format PNG.")}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Select label={tr("Ukuran video")} value={CANVAS_PRESETS.find((p) => p.w === cfg.width && p.h === cfg.height)?.id ?? "custom"} onChange={(e) => { const p = CANVAS_PRESETS.find((x) => x.id === e.target.value); if (p) set({ width: p.w, height: p.h }); }}>
                {CANVAS_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                {!CANVAS_PRESETS.some((p) => p.w === cfg.width && p.h === cfg.height) && <option value="custom">{tr("Kustom {0}×{1}", cfg.width, cfg.height)}</option>}
              </Select>
              <Select label={tr("Frame rate")} value={String(cfg.fps)} onChange={(e) => set({ fps: Number(e.target.value) })}>
                {[24, 25, 30, 50, 60].map((f) => <option key={f} value={f}>{tr("{0} fps", f)}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={tr("Lebar (px)")} type="number" min={160} max={7680} value={cfg.width} onChange={(e) => set({ width: Math.round(clamp(Number(e.target.value) || 1920, 160, 7680)) })} data-testid="av-width" />
              <Input label={tr("Tinggi (px)")} type="number" min={160} max={4320} value={cfg.height} onChange={(e) => set({ height: Math.round(clamp(Number(e.target.value) || 1080, 160, 4320)) })} data-testid="av-height" />
            </div>
            {src && (
              <>
                <p className={cap}>{tr("Rentang Waktu")}</p>
                <Sl id="rstart" label={tr("Mulai")} value={range[0]} min={0} max={Math.max(0.2, duration - 0.2)} step={0.1} suffix={tr(" dtk")} onChange={(v) => setRange(([, e]) => [Math.min(v, e - 0.2), e])} />
                <Sl id="rend" label={tr("Selesai")} value={range[1]} min={0.2} max={duration} step={0.1} suffix={tr(" dtk")} onChange={(v) => setRange(([s]) => [s, Math.max(v, s + 0.2)])} />
                <Tg id="inclaudio" label={tr("Sertakan audio di dalam berkas (PCM 16-bit)")} checked={includeAudio} onChange={setIncludeAudio} />
              </>
            )}
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={saveConfig} className="flex-1" data-testid="av-save-preset"><Save className="w-4 h-4" />{tr("Simpan pengaturan")}</Btn>
              <Btn variant="secondary" onClick={() => importRef.current?.click()} className="flex-1"><FolderOpen className="w-4 h-4" />{tr("Muat")}</Btn>
              <input ref={importRef} type="file" accept="application/json,.json" className="hidden" data-testid="av-load-preset" onChange={(e) => { loadConfig(e.target.files?.[0]); e.target.value = ""; }} />
            </div>

            {src ? (
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5"><p className="text-[10px] text-slate-400">{tr("Durasi")}</p><p className="text-sm font-bold text-slate-700 dark:text-slate-200" data-testid="av-dur">{fmtDur(range[1] - range[0])}</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5"><p className="text-[10px] text-slate-400">{tr("Frame")}</p><p className="text-sm font-bold text-slate-700 dark:text-slate-200" data-testid="av-frames">{frames}</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5"><p className="text-[10px] text-slate-400">{tr("Perkiraan ukuran")}</p><p className="text-sm font-bold text-slate-700 dark:text-slate-200" data-testid="av-est">{estimating || !estimate ? "…" : `≈ ${fmtBytes(estimate.bytes)}`}</p></div>
                </div>
                {estimate && !estimating && <p className="text-[11px] text-slate-400 dark:text-slate-500">{tr("Perkiraan waktu render ≈ {0} (tergantung perangkat). Render berjalan di tab ini — biarkan tab tetap terbuka.", fmtDur(estimate.renderSeconds))}</p>}
                {estTooBig && (
                  <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs p-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{tr("Perkiraan melebihi 3,5 GB — terlalu besar untuk browser. Perkecil rentang waktu, resolusi, atau FPS, atau pilih format PNG (jauh lebih kecil).")}</span>
                  </div>
                )}
                {exporting && progress && (
                  <div className="space-y-1.5" data-testid="av-progress">
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(progress.f * 100)}%` }} /></div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{progress.msg ?? tr("Frame {0}/{1} · {2} · sisa ≈ {3}", progress.frame, progress.total, fmtBytes(progress.bytes), fmtDur(progress.eta))}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <Btn data-testid="av-export" onClick={runExport} disabled={exporting || micOn || estTooBig || frames < 1 || (format === "mov-jpeg" && !hasBg)} className="flex-1 py-3.5 text-base">
                    {exporting ? <><Loader2 className="w-4 h-4 animate-spin" />{tr("Merender…")}</> : <><Film className="w-4 h-4" />{tr("Ekspor")} {format === "png-zip" ? tr("ZIP PNG") : ".mov"}</>}
                  </Btn>
                  {exporting && <Btn data-testid="av-cancel" variant="danger" onClick={() => { cancelRef.current.cancelled = true; }}><X className="w-4 h-4" />{tr("Batal")}</Btn>}
                </div>
                {result && !exporting && (
                  <Btn data-testid="av-download" variant="secondary" onClick={() => downloadBlob(result.blob, result.name)} className="w-full"><Download className="w-4 h-4" />{tr("Unduh lagi: {0} ({1})", result.name, fmtBytes(result.bytes))}</Btn>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">{tr("Muat audio terlebih dahulu untuk mengekspor.")}</p>
            )}
          </div>
        )}

        <ToolInfoPanel
          icon={<AudioLines className="w-5 h-5" />}
          label={tr("Audio Visualizer")}
          desc={tr("13 gaya · .mov transparan")}
          points={[
            tr("Pratinjau real-time memakai mesin yang sama dengan ekspor — hasil .mov persis seperti di layar."),
            tr("Latar Transparan = .mov dengan kanal alpha otomatis; ganti ke Warna/Gradien/Gambar bila butuh latar."),
            tr("Render offline frame demi frame: sinkron sempurna dengan audio, tanpa lag."),
            tr("Format PNG dalam MOV didukung QuickTime, Premiere, After Effects, Final Cut; pilih Animation/RLE bila editormu rewel."),
            tr("Semua diproses di perangkatmu — audio tidak diunggah ke mana pun."),
          ]}
        />
      </div>
    </div>
  );
};
