import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { AudioLines, Play, Pause, Download, Loader2, X, Mic, MicOff, Upload, Save, FolderOpen, Film, Palette, Move, Image as ImageIcon, Type, Waves, Sparkles, AlertTriangle } from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { Btn, Label, Select, Input } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
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
      setAlert({ msg: "Pilih berkas audio (MP3, WAV, OGG, M4A, FLAC) atau video yang berisi audio.", tone: "warning" });
      return;
    }
    stopMic();
    setLoading(true);
    setAlert(null);
    setResult(null);
    try {
      const pcm = await decodeFileToPcm(f);
      const bs = new BufferSource(pcm.channels, pcm.sampleRate);
      if (!(bs.duration > 0.2)) throw new Error("Audio terlalu pendek atau kosong.");
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(f));
      setFile(f);
      setSrc(bs);
      setRange([0, bs.duration]);
      setCurrent(0);
      setPlaying(false);
      if (!cfg.title) set({ title: f.name.replace(/\.[^.]+$/, "").slice(0, 60) });
    } catch (e: any) {
      setAlert({ msg: e?.message || "Gagal membaca audio.", tone: "error" });
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
      a.play().catch(() => setAlert({ msg: "Browser memblokir pemutaran — klik lagi.", tone: "warning" }));
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
      m.stream.getTracks().forEach((t) => t.stop());
      m.ctx.close().catch(() => {});
      micRef.current = null;
    }
    setMicOn(false);
  }
  const toggleMic = async () => {
    if (micOn) return stopMic();
    try {
      audioRef.current?.pause();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      const an = ctx.createAnalyser();
      an.fftSize = 8192;
      ctx.createMediaStreamSource(stream).connect(an);
      micRef.current = { ctx, stream, source: new AnalyserSource(an, ctx.sampleRate) };
      setMicOn(true);
      setAlert({ msg: "Mikrofon aktif — hanya untuk pratinjau live. Ekspor memakai berkas audio.", tone: "info" });
    } catch {
      setAlert({ msg: "Mikrofon tidak bisa diakses (izin ditolak atau tidak ada perangkat).", tone: "error" });
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
      setAlert({ msg: `Selesai: ${r.name} (${fmtBytes(r.bytes)}, ${r.frames} frame) — diunduh otomatis.`, tone: "success" });
    } catch (e: any) {
      if (e instanceof ExportCancelled) setAlert({ msg: "Ekspor dibatalkan.", tone: "info" });
      else setAlert({ msg: e?.message || "Ekspor gagal.", tone: "error" });
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
      setAlert({ msg: "Pengaturan dimuat.", tone: "success" });
    } catch {
      setAlert({ msg: "Berkas pengaturan tidak valid.", tone: "error" });
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
    { id: "style" as const, label: "Gaya", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "spectrum" as const, label: "Spektrum", icon: <Waves className="w-3.5 h-3.5" /> },
    { id: "layout" as const, label: "Tata Letak", icon: <Move className="w-3.5 h-3.5" /> },
    { id: "color" as const, label: "Warna & Efek", icon: <Palette className="w-3.5 h-3.5" /> },
    { id: "bg" as const, label: "Latar", icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { id: "text" as const, label: "Logo & Teks", icon: <Type className="w-3.5 h-3.5" /> },
    { id: "export" as const, label: "Ekspor", icon: <Film className="w-3.5 h-3.5" /> },
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
          {cfg.bgMode === "transparent" ? "Kotak-kotak = bagian transparan (akan transparan di .mov)." : "Latar aktif — .mov akan memakai latar ini."} Pratinjau {cfg.width}×{cfg.height} · {cfg.fps} fps{!src && !micOn ? " · animasi demo sampai audio dimuat" : ""}
        </p>

        {!src && (
          <Dropzone onFiles={loadAudio} multiple={false} accept="audio/*,video/*" label={loading ? "Membaca audio…" : "Drop audio di sini"} sublabel="MP3, WAV, OGG, M4A, FLAC — atau video yang berisi audio" icon={loading ? <Loader2 className="w-8 h-8 animate-spin" /> : <AudioLines className="w-8 h-8" />} isDragging={isDragging} setIsDragging={setIsDragging} />
        )}

        {src && file && (
          <div className={card} data-testid="av-transport">
            <div className="flex items-center gap-3">
              <button type="button" data-testid="av-play" onClick={togglePlay} disabled={exporting || micOn} className="w-11 h-11 rounded-full bg-slate-900 dark:bg-indigo-600 text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 shrink-0" aria-label={playing ? "Jeda" : "Putar"}>
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" data-testid="av-filename">{file.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  <span data-testid="av-time">{fmtTime(current)}</span> / {fmtTime(duration)} · {Math.round(src.sampleRate / 100) / 10} kHz · {src.channels.length === 1 ? "mono" : "stereo"}
                </p>
              </div>
              <button type="button" onClick={toggleMic} className={cn("p-2 rounded-xl border text-sm", micOn ? "border-red-300 bg-red-50 text-red-600" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800")} title="Pratinjau dari mikrofon" aria-label="Mikrofon">
                {micOn ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <label className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" title="Ganti audio">
                <Upload className="w-4 h-4" />
                <input type="file" accept="audio/*,video/*" className="hidden" data-testid="av-replace-input" onChange={(e) => e.target.files && loadAudio(Array.from(e.target.files))} />
              </label>
            </div>
            <GamatoSlider min={0} max={Math.max(0.1, duration)} step={0.05} value={clamp(current, 0, duration)} onChange={seek} aria-label="Posisi" />
          </div>
        )}
        {!src && (
          <button type="button" onClick={toggleMic} className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800">
            {micOn ? <><MicOff className="w-4 h-4" />Matikan mikrofon</> : <><Mic className="w-4 h-4" />Atau pratinjau dari mikrofon (live)</>}
          </button>
        )}
        {alert && <GamatoInlineAlert message={alert.msg} tone={alert.tone} />}
        <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" className="hidden" style={{ display: "none" }} />
      </div>

      {/* ── KANAN: pengaturan ── */}
      <div className="space-y-4 min-w-0">
        <SettingsTabBar tabs={tabs} active={tab} onChange={(t) => setTab(t)} />

        {tab === "style" && (
          <div className={card} data-testid="av-tab-style">
            <p className={cap}>Preset Cepat</p>
            <div className="grid grid-cols-2 gap-2">
              {VIZ_PRESETS.map((p) => (
                <button key={p.id} type="button" data-testid={`av-preset-${p.id}`} onClick={() => applyPreset(p.id)} title={p.desc}
                  className={cn("text-left px-3 py-2 rounded-xl border-2 text-sm transition-all", presetId === p.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                  <span className="font-bold text-slate-800 dark:text-slate-100 block">{p.label}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1">{p.desc}</span>
                </button>
              ))}
            </div>
            <p className={cap}>Gaya Visual</p>
            <div className="flex flex-wrap gap-2">
              {STYLE_LIST.map((s) => (
                <button key={s.id} type="button" data-testid={`av-style-${s.id}`} onClick={() => { set({ style: s.id }); setPresetId(""); }}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all", cfg.style === s.id ? "bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300")}>
                  {s.label}
                </button>
              ))}
            </div>
            {spectrum && !["line", "area", "pulse", "circle-blob"].includes(cfg.style) && <Sl id="bars" label="Jumlah batang" value={cfg.bars} min={8} max={192} onChange={(v) => set({ bars: v })} />}
            {["line", "area", "circle-blob"].includes(cfg.style) && <Sl id="bars" label="Titik kontrol" value={cfg.bars} min={8} max={192} onChange={(v) => set({ bars: v })} />}
            {barish && <Sl id="barwidth" label="Lebar batang" value={cfg.barWidth} min={0.1} max={1} step={0.05} digits={2} onChange={(v) => set({ barWidth: v })} />}
            {["bars", "bars-mirror", "circle-bars", "blocks"].includes(cfg.style) && <Sl id="barradius" label="Sudut membulat" value={cfg.barRadius} min={0} max={1} step={0.05} digits={2} onChange={(v) => set({ barRadius: v })} />}
            {["bars", "bars-mirror", "circle-bars", "circle-dots"].includes(cfg.style) && <Sl id="minbar" label="Tinggi minimum" value={cfg.minBar} min={0} max={30} suffix=" px" onChange={(v) => set({ minBar: v })} />}
            {["blocks", "dots"].includes(cfg.style) && (
              <>
                <Sl id="segments" label="Jumlah segmen" value={cfg.segments} min={4} max={40} onChange={(v) => set({ segments: v })} />
                <Sl id="seggap" label="Celah segmen" value={cfg.segGap} min={0} max={0.8} step={0.05} digits={2} onChange={(v) => set({ segGap: v })} />
              </>
            )}
            {["dots", "circle-dots"].includes(cfg.style) && <Sl id="dotsize" label="Ukuran titik" value={cfg.dotSize} min={2} max={30} suffix=" px" onChange={(v) => set({ dotSize: v })} />}
            {lineish && <Sl id="linewidth" label="Tebal garis" value={cfg.lineWidth} min={1} max={24} suffix=" px" onChange={(v) => set({ lineWidth: v })} />}
            {["bars", "bars-mirror", "circle-bars"].includes(cfg.style) && <Tg id="peaks" label="Tampilkan penanda puncak (peak cap)" checked={cfg.peaks} onChange={(v) => set({ peaks: v })} />}
          </div>
        )}

        {tab === "spectrum" && (
          <div className={card} data-testid="av-tab-spectrum">
            <p className={cap}>Analisis Frekuensi</p>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Skala frekuensi" value={cfg.freqScale} onChange={(e) => set({ freqScale: e.target.value as VizConfig["freqScale"] })}>
                <option value="log">Logaritmik (alami)</option>
                <option value="sqrt">Akar kuadrat</option>
                <option value="linear">Linear</option>
              </Select>
              <Select label="Resolusi FFT" value={String(cfg.fftSize)} onChange={(e) => set({ fftSize: Number(e.target.value) as VizConfig["fftSize"] })}>
                <option value="1024">1024 (cepat)</option>
                <option value="2048">2048</option>
                <option value="4096">4096 (bass detail)</option>
                <option value="8192">8192 (sangat detail)</option>
              </Select>
            </div>
            <Sl id="fmin" label="Frekuensi terendah" value={cfg.freqMin} min={20} max={500} suffix=" Hz" onChange={(v) => set({ freqMin: v })} />
            <Sl id="fmax" label="Frekuensi tertinggi" value={cfg.freqMax} min={2000} max={20000} step={100} suffix=" Hz" onChange={(v) => set({ freqMax: v })} />
            <p className={cap}>Respons</p>
            <Sl id="gain" label="Sensitivitas" value={cfg.gainDb} min={-10} max={40} suffix=" dB" hint="Naikkan bila batang terlalu rendah pada lagu pelan." onChange={(v) => set({ gainDb: v })} />
            <Sl id="floor" label="Lantai derau" value={cfg.floorDb} min={-110} max={-40} suffix=" dB" hint="Suara di bawah nilai ini dianggap senyap." onChange={(v) => set({ floorDb: v })} />
            <Sl id="tilt" label="Penyeimbang nada tinggi" value={cfg.tilt} min={0} max={9} step={0.5} suffix=" dB/oktaf" onChange={(v) => set({ tilt: v })} />
            <Sl id="attack" label="Kecepatan naik (attack)" value={cfg.attack} min={2} max={250} suffix=" ms" onChange={(v) => set({ attack: v })} />
            <Sl id="release" label="Kecepatan turun (release)" value={cfg.release} min={20} max={1500} step={10} suffix=" ms" onChange={(v) => set({ release: v })} />
            <Sl id="smooth" label="Haluskan antar batang" value={cfg.spatialSmooth} min={0} max={4} onChange={(v) => set({ spatialSmooth: v })} />
            <Sl id="peakfall" label="Kecepatan turun penanda puncak" value={cfg.peakFall} min={0.1} max={2} step={0.05} digits={2} onChange={(v) => set({ peakFall: v })} />
          </div>
        )}

        {tab === "layout" && (
          <div className={cn(card)} data-testid="av-tab-layout">
            <p className={cap}>Posisi & Ukuran Area</p>
            <Sl id="posx" label="Posisi horizontal" value={cfg.posX} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ posX: v })} />
            <Sl id="posy" label="Posisi vertikal" value={cfg.posY} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ posY: v })} />
            <Sl id="areaw" label="Lebar area" value={cfg.areaW} min={0.1} max={1.5} step={0.01} digits={2} onChange={(v) => set({ areaW: v })} />
            <Sl id="areah" label="Tinggi area" value={cfg.areaH} min={0.05} max={1.5} step={0.01} digits={2} onChange={(v) => set({ areaH: v })} />
            <Sl id="rotation" label="Rotasi" value={cfg.rotation} min={-180} max={180} suffix="°" onChange={(v) => set({ rotation: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Tg id="mirrorx" label="Cermin horizontal" checked={cfg.mirrorX} onChange={(v) => set({ mirrorX: v })} />
              <Tg id="flipy" label="Balik vertikal" checked={cfg.flipY} onChange={(v) => set({ flipY: v })} />
            </div>
            {circle && (
              <>
                <p className={cap}>Lingkaran</p>
                <Sl id="radius" label="Radius dalam" value={cfg.radius} min={0.05} max={0.95} step={0.01} digits={2} onChange={(v) => set({ radius: v })} />
                <Sl id="startangle" label="Sudut awal" value={cfg.startAngle} min={-180} max={180} suffix="°" onChange={(v) => set({ startAngle: v })} />
                <Sl id="spin" label="Putaran otomatis" value={cfg.spin} min={-90} max={90} suffix="°/dtk" onChange={(v) => set({ spin: v })} />
                {["circle-bars", "circle-dots", "circle-blob"].includes(cfg.style) && <Tg id="symmetric" label="Simetris kiri-kanan" checked={cfg.circleSymmetric} onChange={(v) => set({ circleSymmetric: v })} />}
              </>
            )}
            <Btn variant="secondary" onClick={() => set({ posX: 0.5, posY: 0.5, areaW: DEFAULT_CONFIG.areaW, areaH: DEFAULT_CONFIG.areaH, rotation: 0, mirrorX: false, flipY: false })}>Reset tata letak</Btn>
          </div>
        )}

        {tab === "color" && (
          <div className={card} data-testid="av-tab-color">
            <p className={cap}>Warna</p>
            <Select label="Mode warna" value={cfg.colorMode} onChange={(e) => set({ colorMode: e.target.value as VizConfig["colorMode"] })}>
              <option value="solid">Satu warna</option>
              <option value="gradient">Gradien</option>
              <option value="rainbow">Pelangi (berputar)</option>
              <option value="level">Berdasarkan level (hijau → merah)</option>
            </Select>
            {cfg.colorMode !== "rainbow" && (
              <div className="grid grid-cols-3 gap-3">
                <GamatoColorPicker label="Warna 1" value={cfg.color1} onChange={(v) => set({ color1: v })} testId="av-color1" />
                {cfg.colorMode !== "solid" && <GamatoColorPicker label="Warna 2" value={cfg.color2} onChange={(v) => set({ color2: v })} testId="av-color2" />}
                {cfg.colorMode !== "solid" && cfg.useColor3 && <GamatoColorPicker label="Warna 3" value={cfg.color3} onChange={(v) => set({ color3: v })} testId="av-color3" />}
              </div>
            )}
            {(cfg.colorMode === "gradient" || cfg.colorMode === "level") && <Tg id="usecolor3" label="Pakai 3 warna" checked={cfg.useColor3} onChange={(v) => set({ useColor3: v })} />}
            {cfg.colorMode === "gradient" && <Sl id="gradangle" label="Arah gradien" value={cfg.gradAngle} min={0} max={360} suffix="°" hint="90° = atas ke bawah, 0° = kiri ke kanan." onChange={(v) => set({ gradAngle: v })} />}
            {cfg.colorMode === "rainbow" && <Sl id="hue" label="Kecepatan pergeseran warna" value={cfg.hueShift} min={-180} max={180} suffix="°/dtk" onChange={(v) => set({ hueShift: v })} />}
            <Sl id="opacity" label="Kepekatan" value={cfg.opacity} min={0.05} max={1} step={0.01} digits={2} onChange={(v) => set({ opacity: v })} />
            <p className={cap}>Efek</p>
            <Sl id="glow" label="Cahaya (glow)" value={cfg.glow} min={0} max={60} suffix=" px" onChange={(v) => set({ glow: v })} />
            {cfg.glow > 0 && (
              <div className="flex items-end gap-3">
                <GamatoColorPicker label="Warna cahaya" value={cfg.glowColor || cfg.color1} onChange={(v) => set({ glowColor: v })} testId="av-glowcolor" />
                {cfg.glowColor && <button type="button" onClick={() => set({ glowColor: "" })} className="text-xs font-semibold text-slate-500 hover:text-indigo-600 pb-3">Otomatis</button>}
              </div>
            )}
            {["bars", "bars-mirror", "blocks", "circle-bars", "pulse"].includes(cfg.style) && (
              <>
                <Sl id="outline" label="Garis tepi" value={cfg.outline} min={0} max={10} step={0.5} suffix=" px" onChange={(v) => set({ outline: v })} />
                {cfg.outline > 0 && <GamatoColorPicker label="Warna garis tepi" value={cfg.outlineColor} onChange={(v) => set({ outlineColor: v })} testId="av-outlinecolor" />}
              </>
            )}
            {["bars", "blocks", "dots", "line", "area", "wave"].includes(cfg.style) && (
              <>
                <Sl id="reflection" label="Pantulan (reflection)" value={cfg.reflection} min={0} max={1} step={0.05} digits={2} onChange={(v) => set({ reflection: v })} />
                {cfg.reflection > 0 && <Sl id="reflen" label="Panjang pantulan" value={cfg.reflectionLen} min={0.1} max={1} step={0.05} digits={2} onChange={(v) => set({ reflectionLen: v })} />}
              </>
            )}
          </div>
        )}

        {tab === "bg" && (
          <div className={card} data-testid="av-tab-bg">
            <p className={cap}>Latar Belakang</p>
            <div className="grid grid-cols-2 gap-2">
              {([["transparent", "Transparan"], ["solid", "Warna"], ["gradient", "Gradien"], ["image", "Gambar"]] as const).map(([id, l]) => (
                <button key={id} type="button" data-testid={`av-bg-${id}`} onClick={() => set({ bgMode: id })}
                  className={cn("py-2.5 rounded-xl text-sm font-semibold border-2 transition-all", cfg.bgMode === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>
                  {l}
                </button>
              ))}
            </div>
            {cfg.bgMode === "transparent" && <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">Latar transparan otomatis: hasil .mov punya kanal alpha — tumpuk langsung di atas video lain di editor.</p>}
            {(cfg.bgMode === "solid" || cfg.bgMode === "gradient" || cfg.bgMode === "image") && (
              <div className="grid grid-cols-2 gap-3">
                <GamatoColorPicker label={cfg.bgMode === "gradient" ? "Warna 1" : "Warna"} value={cfg.bgColor1} onChange={(v) => set({ bgColor1: v })} testId="av-bgcolor1" />
                {cfg.bgMode === "gradient" && <GamatoColorPicker label="Warna 2" value={cfg.bgColor2} onChange={(v) => set({ bgColor2: v })} testId="av-bgcolor2" />}
              </div>
            )}
            {cfg.bgMode === "gradient" && <Sl id="bgangle" label="Arah gradien latar" value={cfg.bgAngle} min={0} max={360} suffix="°" onChange={(v) => set({ bgAngle: v })} />}
            {cfg.bgMode === "image" && (
              <>
                <LogoUpload file={bgFile} onChange={setBgFile} label="Gambar latar" hint="Diisi memenuhi kanvas (crop tengah)." />
                <Sl id="bgdim" label="Gelapkan" value={cfg.bgDim} min={0} max={0.9} step={0.05} digits={2} onChange={(v) => set({ bgDim: v })} />
                <Sl id="bgblur" label="Blur" value={cfg.bgBlur} min={0} max={40} suffix=" px" onChange={(v) => set({ bgBlur: v })} />
                <Sl id="bgbeat" label="Zoom mengikuti bass" value={cfg.bgBeat} min={0} max={1} step={0.05} digits={2} onChange={(v) => set({ bgBeat: v })} />
              </>
            )}
          </div>
        )}

        {tab === "text" && (
          <div className={card} data-testid="av-tab-text">
            <p className={cap}>Logo / Gambar Tengah</p>
            <Tg id="logoon" label="Tampilkan logo" checked={cfg.logoOn} onChange={(v) => set({ logoOn: v })} />
            {cfg.logoOn && (
              <>
                <LogoUpload file={logoFile} onChange={setLogoFile} label="Gambar logo" hint="Berdenyut mengikuti bass." />
                <Select label="Bentuk" value={cfg.logoShape} onChange={(e) => set({ logoShape: e.target.value as VizConfig["logoShape"] })}>
                  <option value="circle">Lingkaran</option>
                  <option value="rounded">Persegi membulat</option>
                  <option value="square">Persegi</option>
                </Select>
                <Sl id="logosize" label="Ukuran" value={cfg.logoSize} min={0.05} max={0.8} step={0.01} digits={2} onChange={(v) => set({ logoSize: v })} />
                <Sl id="logobeat" label="Denyut bass" value={cfg.logoBeat} min={0} max={0.6} step={0.01} digits={2} onChange={(v) => set({ logoBeat: v })} />
                <Sl id="logox" label="Posisi horizontal" value={cfg.logoX} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ logoX: v })} />
                <Sl id="logoy" label="Posisi vertikal" value={cfg.logoY} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ logoY: v })} />
                <Sl id="logoborder" label="Tebal bingkai" value={cfg.logoBorder} min={0} max={20} suffix=" px" onChange={(v) => set({ logoBorder: v })} />
                {cfg.logoBorder > 0 && <GamatoColorPicker label="Warna bingkai" value={cfg.logoBorderColor} onChange={(v) => set({ logoBorderColor: v })} testId="av-logobordercolor" />}
              </>
            )}
            <p className={cap}>Teks</p>
            <Input label="Judul" value={cfg.title} onChange={(e) => set({ title: e.target.value })} placeholder="Judul lagu" data-testid="av-title" />
            <Input label="Subjudul" value={cfg.subtitle} onChange={(e) => set({ subtitle: e.target.value })} placeholder="Nama artis / keterangan" data-testid="av-subtitle" />
            <FontPicker value={cfg.textFont} onChange={(f) => set({ textFont: f })} customFonts={customFonts} isFontLoading={isFontLoading} fontError={fontError} onUpload={addCustomFont} onRemoveCustomFont={(id) => removeCustomFont(id, (fb) => set({ textFont: fb }))} label="Font teks" />
            <Sl id="textsize" label="Ukuran teks" value={cfg.textSize} min={14} max={160} suffix=" px" onChange={(v) => set({ textSize: v })} />
            <GamatoColorPicker label="Warna teks" value={cfg.textColor} onChange={(v) => set({ textColor: v })} testId="av-textcolor" />
            <Select label="Perataan" value={cfg.textAlign} onChange={(e) => set({ textAlign: e.target.value as VizConfig["textAlign"] })}>
              <option value="center">Tengah</option>
              <option value="left">Kiri</option>
              <option value="right">Kanan</option>
            </Select>
            <Sl id="textx" label="Posisi horizontal" value={cfg.textX} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ textX: v })} />
            <Sl id="texty" label="Posisi vertikal" value={cfg.textY} min={0} max={1} step={0.01} digits={2} onChange={(v) => set({ textY: v })} />
            <Tg id="textshadow" label="Bayangan teks" checked={cfg.textShadow} onChange={(v) => set({ textShadow: v })} />
            <p className={cap}>Bilah Progres</p>
            <Tg id="progress" label="Tampilkan bilah progres lagu" checked={cfg.progress} onChange={(v) => set({ progress: v })} />
            {cfg.progress && (
              <>
                <Select label="Posisi" value={cfg.progressPos} onChange={(e) => set({ progressPos: e.target.value as "top" | "bottom" })}>
                  <option value="bottom">Bawah</option>
                  <option value="top">Atas</option>
                </Select>
                <GamatoColorPicker label="Warna progres" value={cfg.progressColor} onChange={(v) => set({ progressColor: v })} testId="av-progresscolor" />
                <Sl id="progressh" label="Tebal" value={cfg.progressH} min={2} max={30} suffix=" px" onChange={(v) => set({ progressH: v })} />
              </>
            )}
          </div>
        )}

        {tab === "export" && (
          <div className={card} data-testid="av-tab-export">
            <p className={cap}>Format Ekspor</p>
            <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
              <option value="mov-png">.mov — PNG (alpha, ukuran kecil) · direkomendasikan</option>
              <option value="mov-rle">.mov — Animation/RLE (alpha, lossless, kompatibel luas)</option>
              <option value="mov-jpeg">.mov — JPEG (latar penuh, ukuran kecil; tanpa alpha)</option>
              <option value="png-zip">ZIP urutan PNG + audio.wav (cadangan)</option>
            </Select>
            <div className={cn("rounded-xl px-3 py-2.5 text-xs border", hasBg ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30")} data-testid="av-alpha-note">
              {hasBg ? "Latar aktif → video akan memakai latar (tanpa transparansi)." : "Latar transparan → .mov punya kanal alpha otomatis."}
            </div>
            {format === "mov-jpeg" && !hasBg && (
              <p className="text-[11px] text-red-600 dark:text-red-400" data-testid="av-jpeg-warn">Format JPEG tidak punya transparansi — aktifkan latar (tab Latar) atau pilih PNG/RLE.</p>
            )}
            {format === "mov-jpeg" && hasBg && (
              <Sl id="jpegq" label="Kualitas JPEG" value={jpegQ} min={50} max={100} suffix="%" onChange={setJpegQ} />
            )}
            {format === "mov-rle" && hasBg && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300" data-testid="av-rle-warn">Animation/RLE dengan latar gradien/gambar bisa sangat besar (tanpa kompresi detail). Untuk latar penuh, pilih format PNG.</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Select label="Ukuran video" value={CANVAS_PRESETS.find((p) => p.w === cfg.width && p.h === cfg.height)?.id ?? "custom"} onChange={(e) => { const p = CANVAS_PRESETS.find((x) => x.id === e.target.value); if (p) set({ width: p.w, height: p.h }); }}>
                {CANVAS_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                {!CANVAS_PRESETS.some((p) => p.w === cfg.width && p.h === cfg.height) && <option value="custom">Kustom {cfg.width}×{cfg.height}</option>}
              </Select>
              <Select label="Frame rate" value={String(cfg.fps)} onChange={(e) => set({ fps: Number(e.target.value) })}>
                {[24, 25, 30, 50, 60].map((f) => <option key={f} value={f}>{f} fps</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Lebar (px)" type="number" min={160} max={7680} value={cfg.width} onChange={(e) => set({ width: Math.round(clamp(Number(e.target.value) || 1920, 160, 7680)) })} data-testid="av-width" />
              <Input label="Tinggi (px)" type="number" min={160} max={4320} value={cfg.height} onChange={(e) => set({ height: Math.round(clamp(Number(e.target.value) || 1080, 160, 4320)) })} data-testid="av-height" />
            </div>
            {src && (
              <>
                <p className={cap}>Rentang Waktu</p>
                <Sl id="rstart" label="Mulai" value={range[0]} min={0} max={Math.max(0.2, duration - 0.2)} step={0.1} suffix=" dtk" onChange={(v) => setRange(([, e]) => [Math.min(v, e - 0.2), e])} />
                <Sl id="rend" label="Selesai" value={range[1]} min={0.2} max={duration} step={0.1} suffix=" dtk" onChange={(v) => setRange(([s]) => [s, Math.max(v, s + 0.2)])} />
                <Tg id="inclaudio" label="Sertakan audio di dalam berkas (PCM 16-bit)" checked={includeAudio} onChange={setIncludeAudio} />
              </>
            )}
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={saveConfig} className="flex-1" data-testid="av-save-preset"><Save className="w-4 h-4" />Simpan pengaturan</Btn>
              <Btn variant="secondary" onClick={() => importRef.current?.click()} className="flex-1"><FolderOpen className="w-4 h-4" />Muat</Btn>
              <input ref={importRef} type="file" accept="application/json,.json" className="hidden" data-testid="av-load-preset" onChange={(e) => { loadConfig(e.target.files?.[0]); e.target.value = ""; }} />
            </div>

            {src ? (
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5"><p className="text-[10px] text-slate-400">Durasi</p><p className="text-sm font-bold text-slate-700 dark:text-slate-200" data-testid="av-dur">{fmtDur(range[1] - range[0])}</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5"><p className="text-[10px] text-slate-400">Frame</p><p className="text-sm font-bold text-slate-700 dark:text-slate-200" data-testid="av-frames">{frames}</p></div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5"><p className="text-[10px] text-slate-400">Perkiraan ukuran</p><p className="text-sm font-bold text-slate-700 dark:text-slate-200" data-testid="av-est">{estimating || !estimate ? "…" : `≈ ${fmtBytes(estimate.bytes)}`}</p></div>
                </div>
                {estimate && !estimating && <p className="text-[11px] text-slate-400 dark:text-slate-500">Perkiraan waktu render ≈ {fmtDur(estimate.renderSeconds)} (tergantung perangkat). Render berjalan di tab ini — biarkan tab tetap terbuka.</p>}
                {estTooBig && (
                  <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs p-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Perkiraan melebihi 3,5 GB — terlalu besar untuk browser. Perkecil rentang waktu, resolusi, atau FPS, atau pilih format PNG (jauh lebih kecil).</span>
                  </div>
                )}
                {exporting && progress && (
                  <div className="space-y-1.5" data-testid="av-progress">
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(progress.f * 100)}%` }} /></div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{progress.msg ?? `Frame ${progress.frame}/${progress.total} · ${fmtBytes(progress.bytes)} · sisa ≈ ${fmtDur(progress.eta)}`}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <Btn data-testid="av-export" onClick={runExport} disabled={exporting || micOn || estTooBig || frames < 1 || (format === "mov-jpeg" && !hasBg)} className="flex-1 py-3.5 text-base">
                    {exporting ? <><Loader2 className="w-4 h-4 animate-spin" />Merender…</> : <><Film className="w-4 h-4" />Ekspor {format === "png-zip" ? "ZIP PNG" : ".mov"}</>}
                  </Btn>
                  {exporting && <Btn data-testid="av-cancel" variant="danger" onClick={() => { cancelRef.current.cancelled = true; }}><X className="w-4 h-4" />Batal</Btn>}
                </div>
                {result && !exporting && (
                  <Btn data-testid="av-download" variant="secondary" onClick={() => downloadBlob(result.blob, result.name)} className="w-full"><Download className="w-4 h-4" />Unduh lagi: {result.name} ({fmtBytes(result.bytes)})</Btn>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">Muat audio terlebih dahulu untuk mengekspor.</p>
            )}
          </div>
        )}

        <ToolInfoPanel
          icon={<AudioLines className="w-5 h-5" />}
          label="Audio Visualizer"
          desc="13 gaya · .mov transparan"
          points={[
            "Pratinjau real-time memakai mesin yang sama dengan ekspor — hasil .mov persis seperti di layar.",
            "Latar Transparan = .mov dengan kanal alpha otomatis; ganti ke Warna/Gradien/Gambar bila butuh latar.",
            "Render offline frame demi frame: sinkron sempurna dengan audio, tanpa lag.",
            "Format PNG dalam MOV didukung QuickTime, Premiere, After Effects, Final Cut; pilih Animation/RLE bila editormu rewel.",
            "Semua diproses di perangkatmu — audio tidak diunggah ke mana pun.",
          ]}
        />
      </div>
    </div>
  );
};
