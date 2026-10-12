import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play, Pause, Square, Repeat, SkipBack, SkipForward, ZoomIn, ZoomOut, Maximize2, Scissors, Copy, ClipboardPaste, Trash2, Mic, Download,
  Upload, Volume2, Flag, AudioWaveform, Crop, Plus, Loader2, Undo2, Redo2, Headphones, Wand2, Sliders, SlidersHorizontal, Timer, Layers,
  FolderOpen, Info, Eraser, Check, X,
} from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { Btn, Input, Label, Select } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { SettingsTabBar, type SettingsTabDef } from "@/components/ui/SettingsTabs";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { encodeAudioBufferCompressed, getBestCompressedAudioFormat } from "@/lib/audioEngine";
import {
  PCM, pcmFrames, pcmDuration, pcmBytes, slicePcm, deleteRange, replaceRange, insertPcm, concatPcm, mixInto, resamplePcm, toMono, normalizePeak,
  analyzePcm, buildPeaks, getPeaks, findSilences, encodeWavPcm, formatClock, parseClock, makeSilence, peakOf, gainToDb,
  EQ_FREQS, type AudioStats, type PeakPyramid, type WavDepth,
} from "@/lib/audioEditEngine";
import { decodeFileToPcm } from "@/lib/audioDecode";
import { runOperation, DEFAULT_PARAMS, WHOLE_FILE_OPS, OP_LABELS, type OpKind, type OpParams } from "@/lib/audioEditOps";

/* ───────────────────────────── constants ───────────────────────────── */

type TabId = "edit" | "volume" | "waktu" | "eq" | "efek" | "bersih" | "kanal" | "tambah" | "marker" | "ekspor";
const TABS: SettingsTabDef<TabId>[] = [
  { id: "edit", label: "Edit", icon: <Scissors className="w-4 h-4" /> },
  { id: "volume", label: "Volume & Fade", icon: <Volume2 className="w-4 h-4" /> },
  { id: "waktu", label: "Kecepatan & Pitch", icon: <Timer className="w-4 h-4" /> },
  { id: "eq", label: "Equalizer", icon: <SlidersHorizontal className="w-4 h-4" /> },
  { id: "efek", label: "Efek", icon: <Wand2 className="w-4 h-4" /> },
  { id: "bersih", label: "Bersihkan", icon: <Eraser className="w-4 h-4" /> },
  { id: "kanal", label: "Kanal", icon: <Headphones className="w-4 h-4" /> },
  { id: "tambah", label: "Tambah & Rekam", icon: <Layers className="w-4 h-4" /> },
  { id: "marker", label: "Marker", icon: <Flag className="w-4 h-4" /> },
  { id: "ekspor", label: "Ekspor", icon: <Download className="w-4 h-4" /> },
];

const WAVE_H = 260;
const RULER_H = 24;
const MAX_PREVIEW_SEC = 15;
const HISTORY_BUDGET = 600 * 1024 * 1024; // bytes of PCM kept for undo
const MAX_PROJECT_BYTES = 1.4 * 1024 * 1024 * 1024;

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Marker { id: string; frame: number; label: string }
interface Snap { pcm: PCM; markers: Marker[]; label: string }
interface Hist { list: Snap[]; idx: number }

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void; testId?: string }> = ({ label, value, min, max, step = 1, suffix = "", onChange, testId }) => (
  <div data-testid={testId}>
    <div className="flex justify-between items-center mb-1.5">
      <Label>{label}</Label>
      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(value * 100) / 100}{suffix}</span>
    </div>
    <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
  </div>
);

const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";

/** One effect card: params + preview + apply. */
const OpCard: React.FC<{ title: string; desc?: string; kind: OpKind; testId?: string; disabled: boolean; onApply: (k: OpKind) => void; onPreview: (k: OpKind) => void; children?: React.ReactNode; applyLabel?: string; noPreview?: boolean }> = ({ title, desc, kind, testId, disabled, onApply, onPreview, children, applyLabel = "Terapkan", noPreview }) => (
  <div className={card} data-testid={testId ?? `op-${kind}`}>
    <div>
      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{title}</h4>
      {desc && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>}
    </div>
    {children}
    <div className="flex gap-2">
      {!noPreview && <Btn variant="secondary" className="flex-1 text-xs py-2" disabled={disabled} onClick={() => onPreview(kind)} data-testid={`preview-${kind}`}><Headphones className="w-3.5 h-3.5" /> Pratinjau</Btn>}
      <Btn className="flex-1 text-xs py-2" disabled={disabled} onClick={() => onApply(kind)} data-testid={`apply-${kind}`}><Check className="w-3.5 h-3.5" /> {applyLabel}</Btn>
    </div>
  </div>
);

/* ───────────────────────────── component ───────────────────────────── */

export const AudioEditor: React.FC = () => {
  // project
  const [hist, setHist] = useState<Hist>({ list: [], idx: -1 });
  const histRef = useRef(hist);
  histRef.current = hist;
  const pcm = hist.idx >= 0 ? hist.list[hist.idx].pcm : null;
  const markers = hist.idx >= 0 ? hist.list[hist.idx].markers : [];
  const [fileName, setFileName] = useState("audio");

  // selection / cursor / view
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [cursor, setCursor] = useState(0);
  const [view, setView] = useState({ start: 0, fpp: 100 });
  const [ampZoom, setAmpZoom] = useState(1);
  const [wavW, setWavW] = useState(800);
  const [snapZero, setSnapZero] = useState(true);
  const [followPlay, setFollowPlay] = useState(true);

  // ui
  const [tab, setTab] = useState<TabId>("edit");
  const [P, setPState] = useState<OpParams>(DEFAULT_PARAMS);
  const setP = useCallback((patch: Partial<OpParams>) => setPState((p) => ({ ...p, ...patch })), []);
  const [busy, setBusy] = useState<{ label: string; progress: number | null } | null>(null);
  const [info, setInfo] = useState<{ msg: string; tone: "success" | "error" | "warning" | "info" } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stats, setStats] = useState<AudioStats | null>(null);
  const [clip, setClip] = useState<PCM | null>(null);
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState<"none" | "main" | "preview">("none");
  const [volume, setVolume] = useState(1);
  const [recording, setRecording] = useState<{ sec: number } | null>(null);

  // export
  const [expScope, setExpScope] = useState<"all" | "sel">("all");
  const [expFormat, setExpFormat] = useState<"wav16" | "wav24" | "wav32" | "opus">("wav16");
  const [expRate, setExpRate] = useState(0);
  const [expMono, setExpMono] = useState(false);
  const [expNorm, setExpNorm] = useState(false);
  const [expDither, setExpDither] = useState(true);
  const [expName, setExpName] = useState("audio-edit");

  // refs
  const waveRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const overviewRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pyrRef = useRef<{ pcm: PCM; pyr: PeakPyramid } | null>(null);
  const mixFileRef = useRef<HTMLInputElement>(null);
  const mixModeRef = useRef<"insert" | "append" | "mix">("insert");
  const openFileRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<null | { type: "select"; anchor: number; moved: boolean; startX: number } | { type: "edge"; fixed: number } | { type: "marker"; id: string; moved: boolean } | { type: "overview"; offset: number }>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const meterL = useRef<HTMLDivElement>(null);
  const meterR = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ mr: MediaRecorder; stream: MediaStream; timer: number } | null>(null);

  // audio playback
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const playInfo = useRef<{ t0: number; from: number; to: number; loop: boolean; sr: number; mode: "main" | "preview" } | null>(null);
  const bufCache = useRef(new WeakMap<PCM, AudioBuffer>());
  const rafRef = useRef<number | null>(null);

  const n = pcm ? pcmFrames(pcm) : 0;
  const sr = pcm?.sampleRate ?? 44100;
  const hasSel = !!sel && sel[1] > sel[0];

  // live mirror for callbacks (rAF, native listeners)
  const live = useRef({ pcm, sel, cursor, view, markers, ampZoom, wavW, n, sr, loop, followPlay });
  live.current = { pcm, sel, cursor, view, markers, ampZoom, wavW, n, sr, loop, followPlay };

  const toast = (msg: string, tone: "success" | "error" | "warning" | "info" = "info") => setInfo({ msg, tone });

  /* ── history ── */
  const commit = useCallback((next: PCM, label: string, nextMarkers?: Marker[]) => {
    const h = histRef.current;
    const cur = h.idx >= 0 ? h.list[h.idx] : null;
    let list = [...h.list.slice(0, h.idx + 1), { pcm: next, markers: nextMarkers ?? cur?.markers ?? [], label }];
    let total = list.reduce((a, s) => a + pcmBytes(s.pcm), 0);
    while (total > HISTORY_BUDGET && list.length > 2) {
      total -= pcmBytes(list[0].pcm);
      list = list.slice(1);
    }
    const nh = { list, idx: list.length - 1 };
    histRef.current = nh;
    setHist(nh);
    setStats(null);
  }, []);

  const undo = useCallback(() => {
    const h = histRef.current;
    if (h.idx <= 0) return;
    stopAll();
    const nh = { ...h, idx: h.idx - 1 };
    histRef.current = nh;
    setHist(nh);
    setSel(null);
    setStats(null);
    toast(`Dibatalkan: ${h.list[h.idx].label}`, "info");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const redo = useCallback(() => {
    const h = histRef.current;
    if (h.idx >= h.list.length - 1) return;
    stopAll();
    const nh = { ...h, idx: h.idx + 1 };
    histRef.current = nh;
    setHist(nh);
    setSel(null);
    setStats(null);
    toast(`Diulang: ${h.list[h.idx + 1].label}`, "info");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const jumpTo = (idx: number) => {
    stopAll();
    const nh = { ...histRef.current, idx };
    histRef.current = nh;
    setHist(nh);
    setSel(null);
    setStats(null);
  };

  /* ── view helpers ── */
  const maxFpp = useCallback((frames: number, w: number) => Math.max(0.25, frames / Math.max(1, w)), []);
  const clampView = useCallback((start: number, fpp: number, frames = live.current.n, w = live.current.wavW) => {
    const f = clamp(fpp, 0.05, maxFpp(frames, w));
    const s = clamp(start, 0, Math.max(0, frames - f * w));
    return { start: s, fpp: f };
  }, [maxFpp]);

  const fitView = useCallback((frames = live.current.n) => setView({ start: 0, fpp: maxFpp(frames, live.current.wavW) }), [maxFpp]);

  const zoomAround = useCallback((factor: number, anchorFrame?: number) => {
    const { view: v, wavW: w, n: frames } = live.current;
    const a = anchorFrame ?? v.start + (v.fpp * w) / 2;
    const nf = clamp(v.fpp * factor, 0.05, maxFpp(frames, w));
    const ratio = (a - v.start) / (v.fpp * w);
    setView(clampView(a - ratio * nf * w, nf, frames, w));
  }, [clampView, maxFpp]);

  // measure width
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWavW(Math.max(200, Math.floor(el.clientWidth))));
    ro.observe(el);
    setWavW(Math.max(200, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, [pcm === null]); // re-attach when the editor area mounts

  // keep the view valid when audio / width changes (stay "fit to screen" if it was fit before)
  const firstLoadRef = useRef<PCM | null>(null);
  const prevFitRef = useRef<{ n: number; w: number } | null>(null);
  useEffect(() => {
    if (!pcm) { prevFitRef.current = null; return; }
    const frames = pcmFrames(pcm);
    const prev = prevFitRef.current;
    setView((v) => {
      const wasFit = !prev || (v.start === 0 && v.fpp >= maxFpp(prev.n, prev.w) * 0.99);
      return wasFit ? { start: 0, fpp: maxFpp(frames, wavW) } : clampView(v.start, v.fpp, frames, wavW);
    });
    prevFitRef.current = { n: frames, w: wavW };
    setCursor((c) => clamp(c, 0, frames));
    setSel((s) => (s ? [clamp(s[0], 0, frames), clamp(s[1], 0, frames)] : s));
  }, [pcm, wavW, clampView, maxFpp]);

  useEffect(() => {
    if (pcm && firstLoadRef.current === null) {
      firstLoadRef.current = pcm;
      fitView(pcmFrames(pcm));
    }
  }, [pcm, fitView]);

  /* ── peaks ── */
  const getPyr = (p: PCM): PeakPyramid => {
    if (!pyrRef.current || pyrRef.current.pcm !== p) pyrRef.current = { pcm: p, pyr: buildPeaks(p) };
    return pyrRef.current.pyr;
  };

  /* ── drawing: waveform ── */
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

  useEffect(() => {
    const c = waveRef.current;
    if (!c || !pcm) return;
    const W = wavW;
    const H = WAVE_H;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(0, 0, W, H);

    // ruler
    const span = view.fpp * W;
    const secPerPx = view.fpp / sr;
    const steps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
    const step = steps.find((s) => s / secPerPx >= 80) ?? 3600;
    ctx.fillStyle = "#111a2e";
    ctx.fillRect(0, 0, W, RULER_H);
    ctx.font = "10px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    const t0 = Math.floor(view.start / sr / step) * step;
    for (let t = t0; t * sr < view.start + span + step * sr; t += step) {
      const x = (t * sr - view.start) / view.fpp;
      if (x < -50 || x > W + 50) continue;
      ctx.strokeStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, RULER_H - 7);
      ctx.lineTo(Math.round(x) + 0.5, RULER_H);
      ctx.stroke();
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(formatClock(t, step < 1), x + 4, RULER_H / 2);
      ctx.strokeStyle = "rgba(51,65,85,0.35)";
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, RULER_H);
      ctx.lineTo(Math.round(x) + 0.5, H);
      ctx.stroke();
    }

    // channels
    const nCh = pcm.channels.length;
    const chH = (H - RULER_H) / nCh;
    const pyr = getPyr(pcm);
    for (let k = 0; k < nCh; k++) {
      const top = RULER_H + k * chH;
      const mid = top + chH / 2;
      const half = (chH / 2) * 0.94;
      ctx.strokeStyle = "#1e293b";
      ctx.beginPath();
      ctx.moveTo(0, mid + 0.5);
      ctx.lineTo(W, mid + 0.5);
      ctx.stroke();
      if (k > 0) {
        ctx.beginPath();
        ctx.moveTo(0, top + 0.5);
        ctx.lineTo(W, top + 0.5);
        ctx.stroke();
      }
      ctx.fillStyle = "#818cf8";
      if (view.fpp < 1) {
        // sample-accurate line
        const src = pcm.channels[k];
        ctx.strokeStyle = "#a5b4fc";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        let started = false;
        for (let x = 0; x <= W; x++) {
          const f = view.start + x * view.fpp;
          const i0 = Math.floor(f);
          if (i0 < 0 || i0 >= src.length) continue;
          const i1 = Math.min(src.length - 1, i0 + 1);
          const v = src[i0] + (src[i1] - src[i0]) * (f - i0);
          const y = mid - clamp(v * ampZoom, -1, 1) * half;
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
        if (view.fpp < 0.15) {
          ctx.fillStyle = "#e0e7ff";
          for (let i = Math.ceil(view.start); i < view.start + span && i < src.length; i++) {
            const x = (i - view.start) / view.fpp;
            ctx.fillRect(x - 2, mid - clamp(src[i] * ampZoom, -1, 1) * half - 2, 4, 4);
          }
        }
      } else {
        const pk = getPeaks(pcm, pyr, view.start, span, W);
        for (let x = 0; x < W; x++) {
          const hi = clamp(pk.max[k][x] * ampZoom, -1, 1);
          const lo = clamp(pk.min[k][x] * ampZoom, -1, 1);
          const y1 = mid - hi * half;
          const y2 = mid - lo * half;
          ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
        }
        // clipping indicator
        ctx.fillStyle = "#f87171";
        for (let x = 0; x < W; x++) {
          if (pk.max[k][x] * ampZoom >= 0.999 || pk.min[k][x] * ampZoom <= -0.999) {
            ctx.fillRect(x, mid - half, 1, 2);
            ctx.fillRect(x, mid + half - 2, 1, 2);
          }
        }
      }
    }
  }, [pcm, view, ampZoom, wavW, sr, dpr]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── drawing: overlay (selection, cursor, markers, playhead) ── */
  const drawOverlay = useCallback(() => {
    const c = overlayRef.current;
    const L = live.current;
    if (!c || !L.pcm) return;
    const W = L.wavW;
    const H = WAVE_H;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const xOf = (f: number) => (f - L.view.start) / L.view.fpp;
    if (L.sel && L.sel[1] > L.sel[0]) {
      const x1 = xOf(L.sel[0]);
      const x2 = xOf(L.sel[1]);
      ctx.fillStyle = "rgba(99,102,241,0.32)";
      ctx.fillRect(x1, RULER_H, x2 - x1, H - RULER_H);
      ctx.fillStyle = "#6366f1";
      ctx.fillRect(x1 - 1, RULER_H, 2, H - RULER_H);
      ctx.fillRect(x2 - 1, RULER_H, 2, H - RULER_H);
      ctx.fillStyle = "rgba(99,102,241,0.55)";
      ctx.fillRect(x1, 0, x2 - x1, 3);
    }
    for (const m of L.markers) {
      const x = xOf(m.frame);
      if (x < -60 || x > W + 60) continue;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, H);
      ctx.stroke();
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 10, 6);
      ctx.lineTo(x, 12);
      ctx.closePath();
      ctx.fill();
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.fillStyle = "#fcd34d";
      ctx.fillText(m.label, x + 13, 10);
    }
    const cx = xOf(L.cursor);
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(cx) + 0.5, RULER_H);
    ctx.lineTo(Math.round(cx) + 0.5, H);
    ctx.stroke();
    const pi = playInfo.current;
    if (pi && pi.mode === "main" && ctxRef.current) {
      const f = playheadFrame();
      const px = xOf(f);
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
    }
  }, [dpr]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { drawOverlay(); }, [drawOverlay, sel, cursor, view, markers, wavW, pcm, playing]);

  /* ── drawing: overview ── */
  useEffect(() => {
    const c = overviewRef.current;
    if (!c || !pcm) return;
    const W = wavW;
    const H = 44;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(0, 0, W, H);
    const pk = getPeaks(pcm, getPyr(pcm), 0, Math.max(1, n), W);
    ctx.fillStyle = "#475569";
    for (let x = 0; x < W; x++) {
      let hi = 0;
      let lo = 0;
      for (let k = 0; k < pcm.channels.length; k++) { hi = Math.max(hi, pk.max[k][x]); lo = Math.min(lo, pk.min[k][x]); }
      const y1 = H / 2 - hi * (H / 2) * 0.9;
      const y2 = H / 2 - lo * (H / 2) * 0.9;
      ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
    const x1 = (view.start / n) * W;
    const x2 = ((view.start + view.fpp * wavW) / n) * W;
    ctx.fillStyle = "rgba(99,102,241,0.25)";
    ctx.fillRect(x1, 0, Math.max(3, x2 - x1), H);
    ctx.strokeStyle = "#818cf8";
    ctx.strokeRect(x1 + 0.5, 0.5, Math.max(3, x2 - x1) - 1, H - 1);
    if (sel && sel[1] > sel[0]) {
      ctx.fillStyle = "rgba(251,191,36,0.4)";
      ctx.fillRect((sel[0] / n) * W, H - 4, ((sel[1] - sel[0]) / n) * W, 4);
    }
  }, [pcm, view, wavW, sel, n, dpr]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────────────────────────── playback ───────────────────────────── */

  const ensureCtx = async (): Promise<AudioContext> => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AC();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      gain.connect(an);
      an.connect(ctx.destination);
      ctxRef.current = ctx;
      gainRef.current = gain;
      analyserRef.current = an;
    }
    if (ctxRef.current.state === "suspended") await ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  };

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  const toAudioBuffer = (ctx: AudioContext, p: PCM): AudioBuffer => {
    const cached = bufCache.current.get(p);
    if (cached) return cached;
    const buf = ctx.createBuffer(p.channels.length, Math.max(1, pcmFrames(p)), p.sampleRate);
    p.channels.forEach((c, k) => buf.copyToChannel(c as any, k));
    bufCache.current.set(p, buf);
    return buf;
  };

  const playheadFrame = (): number => {
    const pi = playInfo.current;
    const ctx = ctxRef.current;
    if (!pi || !ctx) return live.current.cursor;
    let f = pi.from + (ctx.currentTime - pi.t0) * pi.sr;
    if (pi.loop && pi.to > pi.from) f = pi.from + ((f - pi.from) % (pi.to - pi.from));
    return Math.min(f, pi.to);
  };

  const stopAll = useCallback(() => {
    const src = srcRef.current;
    if (src) {
      src.onended = null;
      try { src.stop(); } catch { /* already stopped */ }
      src.disconnect();
    }
    srcRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (playInfo.current?.mode === "main") {
      // leave the cursor where playback stopped
      const f = playheadFrame();
      if (Number.isFinite(f)) setCursor(Math.round(f));
    }
    playInfo.current = null;
    setPlaying("none");
    if (meterL.current) meterL.current.style.width = "0%";
    if (meterR.current) meterR.current.style.width = "0%";
    drawOverlay();
  }, [drawOverlay]);

  const tick = useCallback(() => {
    const pi = playInfo.current;
    if (!pi) return;
    const f = playheadFrame();
    if (pi.mode === "main") {
      if (timeRef.current) timeRef.current.textContent = formatClock(f / pi.sr);
      const L = live.current;
      if (L.followPlay) {
        const span = L.view.fpp * L.wavW;
        if (f < L.view.start || f > L.view.start + span) setView((v) => clampView(f - span * 0.1, v.fpp));
      }
      drawOverlay();
    }
    // level meter
    const an = analyserRef.current;
    if (an) {
      const data = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(data);
      let m = 0;
      for (const v of data) m = Math.max(m, Math.abs(v));
      const pct = Math.min(100, Math.max(0, (20 * Math.log10(m + 1e-6) + 60) / 60 * 100));
      if (meterL.current) meterL.current.style.width = `${pct}%`;
      if (meterR.current) meterR.current.style.width = `${pct}%`;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [drawOverlay, clampView]); // eslint-disable-line react-hooks/exhaustive-deps

  const playPcm = async (p: PCM, from: number, to: number, doLoop: boolean, mode: "main" | "preview") => {
    stopAll();
    const ctx = await ensureCtx();
    const buf = toAudioBuffer(ctx, p);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gainRef.current!);
    const total = pcmFrames(p);
    const a = clamp(from, 0, Math.max(0, total - 1));
    const b = clamp(to, a + 1, total);
    if (doLoop) {
      src.loop = true;
      src.loopStart = a / p.sampleRate;
      src.loopEnd = b / p.sampleRate;
      src.start(0, a / p.sampleRate);
    } else {
      src.start(0, a / p.sampleRate, (b - a) / p.sampleRate);
    }
    src.onended = () => {
      if (srcRef.current === src) {
        if (mode === "main" && !doLoop) setCursor(live.current.sel && live.current.sel[1] > live.current.sel[0] ? live.current.sel[0] : Math.round(a));
        playInfo.current = null;
        srcRef.current = null;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        setPlaying("none");
        if (meterL.current) meterL.current.style.width = "0%";
        if (meterR.current) meterR.current.style.width = "0%";
        drawOverlay();
      }
    };
    srcRef.current = src;
    playInfo.current = { t0: ctx.currentTime, from: a, to: b, loop: doLoop, sr: p.sampleRate, mode };
    setPlaying(mode);
    rafRef.current = requestAnimationFrame(tick);
  };

  const playMain = async () => {
    if (!pcm) return;
    const s = live.current.sel;
    if (s && s[1] > s[0]) await playPcm(pcm, s[0], s[1], loop, "main");
    else {
      const from = live.current.cursor >= n - 1 ? 0 : live.current.cursor;
      await playPcm(pcm, from, n, loop, "main");
    }
  };

  const togglePlay = async () => {
    if (playing !== "none") stopAll();
    else await playMain();
  };

  const stopAndRewind = () => {
    stopAll();
    const s = live.current.sel;
    setCursor(s && s[1] > s[0] ? s[0] : 0);
  };

  useEffect(() => () => {
    // cleanup on unmount
    const src = srcRef.current;
    if (src) { src.onended = null; try { src.stop(); } catch { /* noop */ } }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    ctxRef.current?.close().catch(() => {});
    if (recRef.current) { recRef.current.stream.getTracks().forEach((t) => t.stop()); window.clearInterval(recRef.current.timer); }
  }, []);

  /* ───────────────────────────── loading ───────────────────────────── */

  const loadProject = async (file: File) => {
    stopAll();
    setBusy({ label: "Membaca & mendekode audio…", progress: null });
    setInfo(null);
    try {
      const p = await decodeFileToPcm(file);
      if (pcmBytes(p) > MAX_PROJECT_BYTES) throw new Error("File terlalu besar untuk diedit di browser (batas ≈ 1,4 GB PCM, sekitar 2 jam stereo).");
      firstLoadRef.current = null;
      pyrRef.current = null;
      const h = { list: [{ pcm: p, markers: [], label: "Buka file" }], idx: 0 };
      histRef.current = h;
      setHist(h);
      setSel(null);
      setCursor(0);
      setStats(null);
      setFileName(file.name.replace(/\.[^.]+$/, ""));
      setExpName(`${file.name.replace(/\.[^.]+$/, "")}-edit`);
      toast(`${file.name} dimuat — ${formatClock(pcmDuration(p), false)} · ${p.sampleRate} Hz · ${p.channels.length === 1 ? "mono" : "stereo"}.`, "success");
    } catch (e: any) {
      toast(e?.message ?? "Gagal membuka file.", "error");
    } finally {
      setBusy(null);
    }
  };

  const onFiles = (files: File[]) => {
    const f = files.find((x) => x.type.startsWith("audio/") || x.type.startsWith("video/") || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm|mp4|mov|mkv)$/i.test(x.name));
    if (!f) {
      toast("Pilih file audio (MP3, WAV, OGG, M4A, FLAC) atau video.", "error");
      return;
    }
    loadProject(f);
  };

  /* ───────────────────────────── helpers for edits ───────────────────────────── */

  const snap = (frame: number): number => {
    const p = live.current.pcm;
    if (!snapZero || !p) return frame;
    const win = Math.round(p.sampleRate * 0.005);
    const f = clamp(Math.round(frame), 0, pcmFrames(p) - 1);
    const c = p.channels[0];
    let best = f;
    let bestAbs = Math.abs(c[f] ?? 0);
    for (let d = 1; d <= win; d++) {
      for (const g of [f - d, f + d]) {
        if (g < 0 || g >= c.length) continue;
        const a = Math.abs(c[g]);
        if (a < bestAbs) { bestAbs = a; best = g; }
      }
      if (bestAbs < 1e-4) break;
    }
    return best;
  };

  const range = (): [number, number] | null => (live.current.sel && live.current.sel[1] > live.current.sel[0] ? live.current.sel : null);

  const shiftMarkers = (ms: Marker[], at: number, end: number, newEnd: number): Marker[] =>
    ms
      .filter((m) => !(m.frame > at && m.frame < end && newEnd <= at)) // markers swallowed by a deletion
      .map((m) => (m.frame >= end ? { ...m, frame: m.frame - end + newEnd } : m.frame > newEnd ? { ...m, frame: newEnd } : m));

  /* ───────────────────────────── edit actions ───────────────────────────── */

  const doTrim = () => {
    const r = range();
    if (!pcm || !r) return toast("Pilih bagian yang ingin dipertahankan dulu (seret di waveform).", "warning");
    stopAll();
    const ms = markers.filter((m) => m.frame >= r[0] && m.frame <= r[1]).map((m) => ({ ...m, frame: m.frame - r[0] }));
    commit(slicePcm(pcm, r[0], r[1]), "Pangkas ke seleksi", ms);
    setSel(null);
    setCursor(0);
    fitView(r[1] - r[0]);
  };

  const doDelete = () => {
    const r = range();
    if (!pcm || !r) return toast("Pilih bagian yang ingin dihapus dulu.", "warning");
    stopAll();
    commit(deleteRange(pcm, r[0], r[1]), "Hapus seleksi", shiftMarkers(markers, r[0], r[1], r[0]));
    setSel(null);
    setCursor(r[0]);
  };

  const doCopy = (silent = false) => {
    const r = range();
    if (!pcm || !r) return silent ? undefined : toast("Pilih bagian yang ingin disalin dulu.", "warning");
    setClip(slicePcm(pcm, r[0], r[1]));
    if (!silent) toast(`${formatClock((r[1] - r[0]) / sr)} disalin ke papan klip editor.`, "success");
  };

  const doCut = () => {
    const r = range();
    if (!pcm || !r) return toast("Pilih bagian yang ingin dipotong dulu.", "warning");
    setClip(slicePcm(pcm, r[0], r[1]));
    doDelete();
  };

  const doPaste = () => {
    if (!pcm || !clip) return toast("Papan klip kosong — salin atau potong dulu.", "warning");
    stopAll();
    const r = range();
    const len = pcmFrames(matchClipLength(clip, pcm));
    if (r) {
      commit(replaceRange(pcm, r[0], r[1], clip), "Tempel (ganti seleksi)", shiftMarkers(markers, r[0], r[1], r[0] + len));
      setSel([r[0], r[0] + len]);
    } else {
      commit(insertPcm(pcm, cursor, clip), "Tempel", markers.map((m) => (m.frame >= cursor ? { ...m, frame: m.frame + len } : m)));
      setSel([cursor, cursor + len]);
      setCursor(cursor + len);
    }
  };

  const matchClipLength = (c: PCM, p: PCM): PCM => (c.sampleRate === p.sampleRate ? c : resamplePcm(c, p.sampleRate));

  const selectAll = () => { if (pcm) setSel([0, n]); };

  /* ── apply / preview an effect ── */
  const effRange = (kind: OpKind): [number, number] => {
    const r = range();
    if (kind === "insertSilence") return [cursor, cursor];
    if (WHOLE_FILE_OPS.includes(kind)) return [0, n];
    return r ?? [0, n];
  };

  const applyOp = async (kind: OpKind) => {
    if (!pcm) return;
    stopAll();
    const [s, e] = effRange(kind);
    if (kind === "repeat" && !range()) return toast("Pilih bagian yang ingin diulang dulu.", "warning");
    const heavy = kind === "tempo" || kind === "pitch";
    setBusy({ label: `${OP_LABELS[kind]}…`, progress: heavy ? 0 : null });
    setInfo(null);
    try {
      await new Promise((r) => setTimeout(r, 20));
      const res = await runOperation(kind, pcm, s, e, P, (f) => setBusy((b) => (b ? { ...b, progress: f } : b)));
      let ms = markers;
      if (res.lengthDelta) ms = shiftMarkers(markers, res.lengthDelta.at, res.lengthDelta.end, res.lengthDelta.newEnd);
      else if (pcmFrames(res.pcm) !== n) ms = markers.map((m) => ({ ...m, frame: Math.min(m.frame, pcmFrames(res.pcm)) }));
      if (kind === "resample") {
        ms = markers.map((m) => ({ ...m, frame: Math.round((m.frame * res.pcm.sampleRate) / pcm.sampleRate) }));
        setSel(null);
        firstLoadRef.current = null;
      }
      commit(res.pcm, res.label + (range() && !WHOLE_FILE_OPS.includes(kind) ? " (seleksi)" : ""), ms);
      if (res.sel) setSel(res.sel);
      const newN = pcmFrames(res.pcm);
      if (newN !== n && !res.sel) {
        setCursor((c) => Math.min(c, newN));
      }
      toast(`${res.label} diterapkan${range() && !WHOLE_FILE_OPS.includes(kind) ? " pada seleksi" : ""}.`, "success");
    } catch (e: any) {
      toast(`Gagal: ${e?.message ?? "terjadi kesalahan."}`, "error");
    } finally {
      setBusy(null);
    }
  };

  const previewOp = async (kind: OpKind) => {
    if (!pcm) return;
    if (playing === "preview") return stopAll();
    const r = range();
    const a = r ? r[0] : clamp(cursor, 0, Math.max(0, n - 1));
    const b = Math.min(r ? r[1] : n, a + Math.round(MAX_PREVIEW_SEC * sr));
    const slice = slicePcm(pcm, a, b);
    setBusy({ label: "Menyiapkan pratinjau…", progress: null });
    try {
      await new Promise((rr) => setTimeout(rr, 10));
      const res = await runOperation(kind, slice, kind === "insertSilence" ? 0 : 0, pcmFrames(slice), { ...P, extendTail: true }, undefined, true);
      setBusy(null);
      await playPcm(res.pcm, 0, pcmFrames(res.pcm), false, "preview");
    } catch (e: any) {
      setBusy(null);
      toast(`Pratinjau gagal: ${e?.message ?? ""}`, "error");
    }
  };

  /* ── add / insert / mix other audio ── */
  const askFile = (mode: "insert" | "append" | "mix") => {
    mixModeRef.current = mode;
    mixFileRef.current?.click();
  };

  const onMixFile = async (file: File | undefined) => {
    if (!file || !pcm) return;
    stopAll();
    setBusy({ label: "Membaca audio tambahan…", progress: null });
    try {
      const other = await decodeFileToPcm(file);
      const mode = mixModeRef.current;
      if (mode === "append") {
        const prepared = other.sampleRate === sr ? other : resamplePcm(other, sr);
        commit(concatPcm([pcm, prepared]), "Gabung di akhir");
        toast(`"${file.name}" digabung di akhir.`, "success");
      } else if (mode === "insert") {
        const len = pcmFrames(matchClipLength(other, pcm));
        commit(insertPcm(pcm, cursor, other), "Sisipkan audio", markers.map((m) => (m.frame >= cursor ? { ...m, frame: m.frame + len } : m)));
        setSel([cursor, cursor + len]);
        toast(`"${file.name}" disisipkan di ${formatClock(cursor / sr)}.`, "success");
      } else {
        commit(mixInto(pcm, cursor, other, 0.8), "Campur (overlay) audio");
        toast(`"${file.name}" dicampur mulai ${formatClock(cursor / sr)}.`, "success");
      }
    } catch (e: any) {
      toast(e?.message ?? "Gagal menambah audio.", "error");
    } finally {
      setBusy(null);
    }
  };

  /* ── recording ── */
  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return toast("Browser ini tidak mendukung perekaman audio.", "error");
    try {
      stopAll();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const started = Date.now();
      const timer = window.setInterval(() => setRecording({ sec: (Date.now() - started) / 1000 }), 200);
      mr.onstop = async () => {
        window.clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        recRef.current = null;
        setRecording(null);
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        setBusy({ label: "Memproses rekaman…", progress: null });
        try {
          const rec = await decodeFileToPcm(new File([blob], "rekaman.webm", { type: blob.type }));
          const cur = histRef.current;
          if (cur.idx < 0) {
            firstLoadRef.current = null;
            pyrRef.current = null;
            const h = { list: [{ pcm: rec, markers: [], label: "Rekaman" }], idx: 0 };
            histRef.current = h;
            setHist(h);
            setFileName("rekaman");
            setExpName("rekaman");
          } else {
            const base = cur.list[cur.idx].pcm;
            const len = pcmFrames(rec.sampleRate === base.sampleRate ? rec : resamplePcm(rec, base.sampleRate));
            const at = live.current.cursor;
            commit(insertPcm(base, at, rec), "Sisipkan rekaman", cur.list[cur.idx].markers.map((m) => (m.frame >= at ? { ...m, frame: m.frame + len } : m)));
            setSel([at, at + len]);
          }
          toast("Rekaman selesai.", "success");
        } catch (e: any) {
          toast(e?.message ?? "Rekaman gagal diproses.", "error");
        } finally {
          setBusy(null);
        }
      };
      mr.start();
      recRef.current = { mr, stream, timer };
      setRecording({ sec: 0 });
    } catch (e: any) {
      toast(e?.name === "NotAllowedError" ? "Izin mikrofon ditolak. Aktifkan izin mikrofon di pengaturan browser." : `Tidak bisa mengakses mikrofon: ${e?.message ?? e}`, "error");
    }
  };

  const stopRecording = () => {
    const r = recRef.current;
    if (r && r.mr.state !== "inactive") r.mr.stop();
  };

  /* ── markers ── */
  const addMarker = (frame = cursor) => {
    if (!pcm) return;
    const label = `M${markers.length + 1}`;
    commit(pcm, "Tambah marker", [...markers, { id: uid(), frame: Math.round(frame), label }].sort((a, b) => a.frame - b.frame));
  };
  const removeMarker = (id: string) => pcm && commit(pcm, "Hapus marker", markers.filter((m) => m.id !== id));
  const renameMarker = (id: string, label: string) => pcm && commit(pcm, "Ubah nama marker", markers.map((m) => (m.id === id ? { ...m, label } : m)));
  const markersFromSilence = () => {
    if (!pcm) return;
    const spans = findSilences(pcm, P.silThr, P.silMin);
    const ms: Marker[] = spans.filter((s) => s.end < n).map((s, i) => ({ id: uid(), frame: s.end, label: `Bagian ${i + 2}` }));
    if (!ms.length) return toast("Tidak ditemukan jeda hening dengan pengaturan ini.", "warning");
    commit(pcm, "Marker dari hening", [...markers, ...ms].sort((a, b) => a.frame - b.frame));
    toast(`${ms.length} marker dibuat di akhir tiap jeda hening.`, "success");
  };

  /* ───────────────────────────── export ───────────────────────────── */

  const buildExportPcm = (scope: "all" | "sel"): PCM | null => {
    if (!pcm) return null;
    let p = scope === "sel" && range() ? slicePcm(pcm, range()![0], range()![1]) : pcm;
    if (expRate > 0 && expRate !== p.sampleRate) p = resamplePcm(p, expRate);
    if (expMono && p.channels.length > 1) p = toMono(p);
    if (expNorm) p = normalizePeak(p, -1);
    return p;
  };

  const encodeFor = async (p: PCM, fmt: typeof expFormat, onProgress?: (f: number) => void): Promise<{ blob: Blob; ext: string }> => {
    if (fmt === "opus") {
      const format = getBestCompressedAudioFormat();
      if (!format) throw new Error("Browser ini tidak mendukung ekspor Opus. Gunakan WAV.");
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const tmp: AudioContext = new AC();
      try {
        const buf = tmp.createBuffer(p.channels.length, Math.max(1, pcmFrames(p)), p.sampleRate);
        p.channels.forEach((c, k) => buf.copyToChannel(c as any, k));
        const blob = await encodeAudioBufferCompressed({ buffer: buf, start: 0, end: buf.duration, format, onProgress });
        return { blob, ext: format.ext };
      } finally {
        tmp.close().catch(() => {});
      }
    }
    const depth: WavDepth = fmt === "wav16" ? 16 : fmt === "wav24" ? 24 : 32;
    return { blob: encodeWavPcm(p, depth, expDither), ext: "wav" };
  };

  const safeName = () => expName.trim().replace(/[\\/:*?"<>|]+/g, "_") || "audio-edit";

  const doExport = async () => {
    const p = buildExportPcm(expScope);
    if (!p) return;
    stopAll();
    setBusy({ label: expFormat === "opus" ? "Mengkodekan Opus (real-time)…" : "Menulis file…", progress: expFormat === "opus" ? 0 : null });
    setInfo(null);
    try {
      await new Promise((r) => setTimeout(r, 20));
      const { blob, ext } = await encodeFor(p, expFormat, (f) => setBusy((b) => (b ? { ...b, progress: f } : b)));
      downloadBlob(blob, `${safeName()}.${ext}`);
      toast(`Berhasil diekspor: ${safeName()}.${ext} (${(blob.size / 1024 / 1024).toFixed(2)} MB, ${formatClock(pcmDuration(p), false)}).`, "success");
    } catch (e: any) {
      toast(`Ekspor gagal: ${e?.message ?? "terjadi kesalahan."}`, "error");
    } finally {
      setBusy(null);
    }
  };

  const doExportMarkers = async () => {
    if (!pcm) return;
    if (!markers.length) return toast("Belum ada marker. Tambahkan marker (tombol M) di titik pemisah.", "warning");
    const fmt = expFormat === "opus" ? "wav16" : expFormat;
    setBusy({ label: "Membuat ZIP…", progress: 0 });
    setInfo(null);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const cuts = [0, ...markers.map((m) => m.frame), n].filter((v, i, a) => i === 0 || v > a[i - 1]);
      const labels = ["Awal", ...markers.map((m) => m.label)];
      for (let i = 0; i < cuts.length - 1; i++) {
        let seg = slicePcm(pcm, cuts[i], cuts[i + 1]);
        if (expRate > 0 && expRate !== seg.sampleRate) seg = resamplePcm(seg, expRate);
        if (expMono) seg = toMono(seg);
        if (expNorm) seg = normalizePeak(seg, -1);
        const { blob } = await encodeFor(seg, fmt);
        const label = (labels[i] ?? `bagian-${i + 1}`).replace(/[\\/:*?"<>|]+/g, "_");
        zip.file(`${String(i + 1).padStart(2, "0")}-${label}.wav`, await blob.arrayBuffer());
        setBusy({ label: "Membuat ZIP…", progress: (i + 1) / (cuts.length - 1) });
        await new Promise((r) => setTimeout(r, 0));
      }
      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, `${safeName()}-bagian.zip`);
      toast(`${cuts.length - 1} bagian diekspor dalam ZIP.`, "success");
    } catch (e: any) {
      toast(`Ekspor ZIP gagal: ${e?.message ?? ""}`, "error");
    } finally {
      setBusy(null);
    }
  };

  const doAnalyze = () => {
    if (!pcm) return;
    const r = range();
    setStats(analyzePcm(r ? slicePcm(pcm, r[0], r[1]) : pcm));
  };

  /* ───────────────────────────── pointer interaction ───────────────────────────── */

  const frameAt = (clientX: number): number => {
    const r = overlayRef.current!.getBoundingClientRect();
    return live.current.view.start + (clientX - r.left) * live.current.view.fpp;
  };
  const xOfFrame = (f: number) => (f - live.current.view.start) / live.current.view.fpp;

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pcm) return;
    rootRef.current?.focus({ preventScroll: true });
    const o = overlayRef.current!;
    const rect = o.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const f = clamp(frameAt(e.clientX), 0, n);
    o.setPointerCapture(e.pointerId);

    // markers (flag area)
    if (py < 16) {
      const m = live.current.markers.find((mk) => Math.abs(xOfFrame(mk.frame) - px) < 8);
      if (m) {
        dragRef.current = { type: "marker", id: m.id, moved: false };
        if (playing !== "none") stopAll();
        setCursor(m.frame);
        return;
      }
    }
    // selection edges
    const s = live.current.sel;
    if (s && s[1] > s[0]) {
      if (Math.abs(xOfFrame(s[0]) - px) < 7) { dragRef.current = { type: "edge", fixed: s[1] }; return; }
      if (Math.abs(xOfFrame(s[1]) - px) < 7) { dragRef.current = { type: "edge", fixed: s[0] }; return; }
    }
    if (e.shiftKey) {
      const anchor = s && s[1] > s[0] ? (Math.abs(f - s[0]) < Math.abs(f - s[1]) ? s[1] : s[0]) : live.current.cursor;
      dragRef.current = { type: "select", anchor, moved: true, startX: e.clientX };
      setSel([Math.min(anchor, f), Math.max(anchor, f)]);
      return;
    }
    dragRef.current = { type: "select", anchor: f, moved: false, startX: e.clientX };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    const o = overlayRef.current;
    if (!o || !pcm) return;
    if (!d) {
      const rect = o.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const s = live.current.sel;
      const nearEdge = s && s[1] > s[0] && (Math.abs(xOfFrame(s[0]) - px) < 7 || Math.abs(xOfFrame(s[1]) - px) < 7);
      const nearMarker = py < 16 && live.current.markers.some((mk) => Math.abs(xOfFrame(mk.frame) - px) < 8);
      o.style.cursor = nearEdge ? "ew-resize" : nearMarker ? "grab" : "text";
      return;
    }
    const f = clamp(frameAt(e.clientX), 0, n);
    if (d.type === "select") {
      if (!d.moved && Math.abs(e.clientX - d.startX) < 3) return;
      d.moved = true;
      setSel([Math.min(d.anchor, f), Math.max(d.anchor, f)]);
    } else if (d.type === "edge") {
      setSel([Math.min(d.fixed, f), Math.max(d.fixed, f)]);
    } else if (d.type === "marker") {
      d.moved = true;
      const id = d.id;
      const h = histRef.current;
      // live move without polluting history; committed on pointer-up
      const list = h.list.map((snapItem, i) => (i === h.idx ? { ...snapItem, markers: snapItem.markers.map((m) => (m.id === id ? { ...m, frame: Math.round(f) } : m)) } : snapItem));
      const nh = { ...h, list };
      histRef.current = nh;
      setHist(nh);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    try { overlayRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    if (!d || !pcm) return;
    const f = clamp(frameAt(e.clientX), 0, n);
    if (d.type === "select") {
      if (!d.moved) {
        const c = snap(f);
        setSel(null);
        setCursor(c);
        if (playing === "main") playPcm(pcm, c, n, loop, "main");
      } else {
        setSel((s) => (s && s[1] - s[0] >= 2 ? [snap(s[0]), snap(s[1])] : null));
        setCursor(Math.min(d.anchor, f));
      }
    } else if (d.type === "edge") {
      setSel((s) => (s ? [snap(s[0]), snap(s[1])] : s));
    } else if (d.type === "marker" && d.moved) {
      // commit the moved marker as one history step
      const h = histRef.current;
      const cur = h.list[h.idx];
      commit(cur.pcm, "Pindah marker", [...cur.markers].sort((a, b) => a.frame - b.frame));
    }
  };

  // wheel: scroll / zoom (native, non-passive)
  useEffect(() => {
    const o = overlayRef.current;
    if (!o) return;
    const onWheel = (e: WheelEvent) => {
      const L = live.current;
      if (!L.pcm) return;
      e.preventDefault();
      const r = o.getBoundingClientRect();
      const anchor = L.view.start + (e.clientX - r.left) * L.view.fpp;
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) {
        if (e.ctrlKey || e.metaKey) zoomAround(e.deltaY < 0 ? 0.8 : 1.25, anchor);
        else setView((v) => clampView(v.start + e.deltaY * v.fpp * 0.8, v.fpp));
      } else {
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        setView((v) => clampView(v.start + dx * v.fpp, v.fpp));
      }
    };
    o.addEventListener("wheel", onWheel, { passive: false });
    return () => o.removeEventListener("wheel", onWheel);
  }, [pcm === null, zoomAround, clampView]); // eslint-disable-line react-hooks/exhaustive-deps

  // overview scrubbing
  const onOverviewDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pcm) return;
    const c = overviewRef.current!;
    c.setPointerCapture(e.pointerId);
    const rect = c.getBoundingClientRect();
    const f = ((e.clientX - rect.left) / rect.width) * n;
    const vs = view.start;
    const span = view.fpp * wavW;
    const inside = f >= vs && f <= vs + span;
    dragRef.current = { type: "overview", offset: inside ? f - vs : span / 2 };
    setView((v) => clampView(f - (inside ? f - vs : span / 2), v.fpp));
  };
  const onOverviewMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d || d.type !== "overview") return;
    const rect = overviewRef.current!.getBoundingClientRect();
    const f = ((e.clientX - rect.left) / rect.width) * n;
    setView((v) => clampView(f - d.offset, v.fpp));
  };
  const onOverviewUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.type === "overview") dragRef.current = null;
    try { overviewRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  /* ── keyboard ── */
  const onKeyDown = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable) return;
    if (!pcm) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (k === " ") { e.preventDefault(); togglePlay(); }
    else if (mod && k === "a") { e.preventDefault(); selectAll(); }
    else if (mod && k === "x") { e.preventDefault(); doCut(); }
    else if (mod && k === "c") { e.preventDefault(); doCopy(); }
    else if (mod && k === "v") { e.preventDefault(); doPaste(); }
    else if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if (mod && k === "y") { e.preventDefault(); redo(); }
    else if (k === "delete" || k === "backspace") { e.preventDefault(); doDelete(); }
    else if (k === "escape") { setSel(null); }
    else if (k === "m" && !mod) { e.preventDefault(); addMarker(playing === "main" ? Math.round(playheadFrame()) : cursor); }
    else if (k === "l" && !mod) { setLoop((v) => !v); }
    else if (k === "home") { e.preventDefault(); setCursor(0); setView((v) => clampView(0, v.fpp)); }
    else if (k === "end") { e.preventDefault(); setCursor(n); setView((v) => clampView(n - v.fpp * wavW, v.fpp)); }
    else if (k === "arrowleft" || k === "arrowright") {
      e.preventDefault();
      const d = (e.shiftKey ? 1 : 0.1) * sr * (k === "arrowleft" ? -1 : 1);
      setCursor((c) => clamp(Math.round(c + d), 0, n));
    } else if (k === "+" || k === "=") { zoomAround(0.7); }
    else if (k === "-") { zoomAround(1.4); }
  };

  const keyRef = useRef(onKeyDown);
  keyRef.current = onKeyDown;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      // don't hijack typing in other fields/dialogs or buttons activated by Space/Enter
      if (e.key === " " && t && (t.tagName === "BUTTON" || t.tagName === "A")) return;
      keyRef.current(e);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* ── selection numeric fields ── */
  const [selStartText, setSelStartText] = useState("");
  const [selEndText, setSelEndText] = useState("");
  useEffect(() => {
    setSelStartText(hasSel ? formatClock(sel![0] / sr) : formatClock(cursor / sr));
    setSelEndText(hasSel ? formatClock(sel![1] / sr) : formatClock(cursor / sr));
  }, [sel, cursor, sr, hasSel]);

  const commitSelFields = () => {
    const a = parseClock(selStartText);
    const b = parseClock(selEndText);
    if (a == null || b == null) return toast("Format waktu tidak valid. Contoh: 1:23.5 atau 83.5", "warning");
    const s = clamp(Math.round(Math.min(a, b) * sr), 0, n);
    const e = clamp(Math.round(Math.max(a, b) * sr), 0, n);
    if (e > s) { setSel([s, e]); setCursor(s); } else { setSel(null); setCursor(s); }
  };

  /* ───────────────────────────── derived ───────────────────────────── */

  const curTime = formatClock((playing === "main" ? playheadFrame() : cursor) / sr);
  const disabled = !pcm || !!busy;
  const regionLabel = hasSel ? `seleksi ${formatClock((sel![1] - sel![0]) / sr)}` : "seluruh audio";
  const canUndo = hist.idx > 0;
  const canRedo = hist.idx < hist.list.length - 1;
  const histBytes = useMemo(() => hist.list.reduce((a, s) => a + pcmBytes(s.pcm), 0), [hist.list]);

  const cardProps = { disabled, onApply: applyOp, onPreview: previewOp };

  /* ───────────────────────────── render ───────────────────────────── */

  if (!pcm) {
    return (
      <div className="space-y-5 max-w-3xl mx-auto" data-testid="audio-editor-empty">
        <input ref={openFileRef} type="file" className="hidden" accept="audio/*,video/*" data-testid="editor-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFiles([f]); }} />
        <Dropzone onFiles={onFiles} accept="audio/*,video/*" multiple={false} isDragging={isDragging} setIsDragging={setIsDragging} label="Buka audio untuk diedit" sublabel="MP3, WAV, OGG, M4A, FLAC — atau video, audionya akan diambil" icon={<AudioWaveform className="w-8 h-8" />} />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm text-slate-400">atau</span>
          {recording ? (
            <Btn variant="danger" onClick={stopRecording} data-testid="rec-stop"><Square className="w-4 h-4" /> Berhenti ({recording.sec.toFixed(1)}s)</Btn>
          ) : (
            <Btn variant="secondary" onClick={startRecording} data-testid="rec-start"><Mic className="w-4 h-4" /> Rekam dari mikrofon</Btn>
          )}
        </div>
        {busy && <div className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300"><Loader2 className="w-4 h-4 animate-spin" />{busy.label}</div>}
        {info && <GamatoInlineAlert message={info.msg} tone={info.tone} />}
        <ToolInfoPanel
          icon={<AudioWaveform className="w-5 h-5" />}
          label="Edit Audio"
          desc="Editor waveform penuh — semua di browser"
          points={[
            "Pangkas, potong, salin, tempel, hapus, ulangi, sisipkan hening — dengan undo/redo tak terbatas (dibatasi memori).",
            "Volume, normalisasi, fade, kecepatan, tempo (tanpa ubah nada), pitch, equalizer 5-band, kompresor, limiter, echo, reverb, noise gate.",
            "Marker + ekspor per bagian (ZIP), ekspor WAV 16/24/32-bit atau Opus. File tidak pernah diunggah.",
          ]}
        />
      </div>
    );
  }

  const eqLabels = ["60 Hz", "230 Hz", "910 Hz", "3,6 kHz", "14 kHz"];

  return (
    <div ref={rootRef} tabIndex={-1} className="space-y-4 outline-none" data-testid="audio-editor">
      <input ref={mixFileRef} type="file" accept="audio/*,video/*" className="hidden" data-testid="mix-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; onMixFile(f); }} />
      <input ref={openFileRef} type="file" accept="audio/*,video/*" className="hidden" data-testid="editor-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFiles([f]); }} />

      {/* top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 p-2 rounded-xl shrink-0"><AudioWaveform className="w-5 h-5" /></div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate" data-testid="project-name">{fileName}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="project-meta">{formatClock(pcmDuration(pcm), false)} · {sr} Hz · {pcm.channels.length === 1 ? "mono" : `${pcm.channels.length} kanal`} · {(pcmBytes(pcm) / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="secondary" className="text-xs py-1.5" onClick={undo} disabled={!canUndo || !!busy} data-testid="btn-undo" title="Urungkan (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /> Urungkan</Btn>
          <Btn variant="secondary" className="text-xs py-1.5" onClick={redo} disabled={!canRedo || !!busy} data-testid="btn-redo" title="Ulangi (Ctrl+Y)"><Redo2 className="w-3.5 h-3.5" /> Ulangi</Btn>
          <Btn variant="ghost" className="text-xs py-1.5" onClick={() => openFileRef.current?.click()}><FolderOpen className="w-3.5 h-3.5" /> Buka lain</Btn>
        </div>
      </div>

      {/* transport */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 shadow-sm flex flex-wrap items-center gap-2">
        <Btn onClick={togglePlay} disabled={!!busy} className="px-5" data-testid="btn-play">{playing !== "none" ? <><Pause className="w-4 h-4" /> Jeda</> : <><Play className="w-4 h-4" /> Putar</>}</Btn>
        <Btn variant="secondary" onClick={stopAndRewind} disabled={!!busy} className="px-3" data-testid="btn-stop" title="Stop"><Square className="w-4 h-4" /></Btn>
        <Btn variant="secondary" onClick={() => { setCursor(0); setView((v) => clampView(0, v.fpp)); if (playing === "main") playPcm(pcm, 0, n, loop, "main"); }} className="px-3" title="Ke awal (Home)"><SkipBack className="w-4 h-4" /></Btn>
        <Btn variant="secondary" onClick={() => { stopAll(); setCursor(n); setView((v) => clampView(n - v.fpp * wavW, v.fpp)); }} className="px-3" title="Ke akhir (End)"><SkipForward className="w-4 h-4" /></Btn>
        <Btn variant={loop ? "primary" : "secondary"} onClick={() => setLoop((v) => !v)} className="px-3" title="Ulangi seleksi (L)" data-testid="btn-loop"><Repeat className="w-4 h-4" /></Btn>
        <div className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums px-2" data-testid="time-display"><span ref={timeRef}>{curTime}</span><span className="text-xs text-slate-400 font-normal"> / {formatClock(pcmDuration(pcm), false)}</span></div>
        {playing === "preview" && <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full">Pratinjau efek…</span>}
        <div className="flex-1" />
        <div className="hidden sm:flex items-center gap-2 w-40" title="Level">
          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div ref={meterL} className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500" style={{ width: "0%" }} /></div>
          <div className="hidden"><div ref={meterR} /></div>
        </div>
        <div className="flex items-center gap-2 w-36" style={{ minWidth: 110 }}><Volume2 className="w-4 h-4 text-slate-400 shrink-0" /><GamatoSlider min={0} max={1.5} step={0.01} value={volume} onChange={setVolume} aria-label="Volume monitor" /></div>
      </div>

      {/* waveform */}
      <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-lg bg-[#0b1120]">
        <div ref={hostRef} className="relative w-full" style={{ height: WAVE_H }}>
          <canvas ref={waveRef} data-testid="wave-canvas" style={{ position: "absolute", left: 0, top: 0, width: wavW, height: WAVE_H, display: "block" }} />
          <canvas
            ref={overlayRef}
            data-testid="wave-overlay"
            style={{ position: "absolute", left: 0, top: 0, width: wavW, height: WAVE_H, display: "block", touchAction: "none", cursor: "text" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={selectAll}
          />
        </div>
        <canvas ref={overviewRef} data-testid="overview-canvas" style={{ width: wavW, height: 44, display: "block", touchAction: "none", cursor: "pointer", borderTop: "1px solid #1e293b" }} onPointerDown={onOverviewDown} onPointerMove={onOverviewMove} onPointerUp={onOverviewUp} onPointerCancel={onOverviewUp} />
      </div>

      {/* view / selection controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5">
          <Btn variant="secondary" className="px-2.5 py-2" onClick={() => zoomAround(0.6)} title="Perbesar (+)" data-testid="zoom-in"><ZoomIn className="w-4 h-4" /></Btn>
          <Btn variant="secondary" className="px-2.5 py-2" onClick={() => zoomAround(1.6)} title="Perkecil (−)" data-testid="zoom-out"><ZoomOut className="w-4 h-4" /></Btn>
          <Btn variant="secondary" className="px-2.5 py-2" onClick={() => fitView()} title="Pas layar" data-testid="zoom-fit"><Maximize2 className="w-4 h-4" /></Btn>
          <Btn variant="secondary" className="px-2.5 py-2 text-xs" disabled={!hasSel} onClick={() => { if (sel) { const f = Math.max(0.05, (sel[1] - sel[0]) / wavW); setView(clampView(sel[0], f)); } }} data-testid="zoom-sel">Zoom seleksi</Btn>
        </div>
        <div className="w-36" style={{ minWidth: 130 }}><Slider label="Tinggi gelombang" value={ampZoom} min={1} max={8} step={0.1} suffix="×" onChange={setAmpZoom} /></div>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="w-28"><Input label="Mulai" value={selStartText} onChange={(e) => setSelStartText(e.target.value)} onBlur={commitSelFields} onKeyDown={(e) => { if (e.key === "Enter") commitSelFields(); }} data-testid="sel-start" className="py-2 font-mono text-xs" /></div>
          <div className="w-28"><Input label="Akhir" value={selEndText} onChange={(e) => setSelEndText(e.target.value)} onBlur={commitSelFields} onKeyDown={(e) => { if (e.key === "Enter") commitSelFields(); }} data-testid="sel-end" className="py-2 font-mono text-xs" /></div>
          <div className="pb-2.5 text-xs text-slate-500 dark:text-slate-400" data-testid="sel-length">{hasSel ? `Durasi: ${formatClock((sel![1] - sel![0]) / sr)}` : "Tidak ada seleksi"}</div>
        </div>
        <div className="flex gap-4 pb-2">
          <GamatoCheckbox checked={snapZero} onChange={setSnapZero} label="Tempel ke zero-crossing" testId="snap-zero" />
          <GamatoCheckbox checked={followPlay} onChange={setFollowPlay} label="Ikuti pemutaran" />
        </div>
      </div>

      {busy && (
        <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl px-4 py-3" data-testid="busy">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-200">{busy.label}</span>
          {busy.progress != null && <div className="flex-1 h-2 rounded-full bg-indigo-100 dark:bg-indigo-900 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(busy.progress * 100)}%` }} /></div>}
        </div>
      )}
      {info && <GamatoInlineAlert message={info.msg} tone={info.tone} />}

      {/* tools */}
      <SettingsTabBar tabs={TABS} active={tab} onChange={setTab} />
      <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="region-hint">Efek diterapkan pada: <b>{regionLabel}</b>{!hasSel && " (seret di waveform untuk memilih bagian)"}.</p>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {tab === "edit" && (
          <>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Edit Seleksi</p>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="secondary" disabled={disabled || !hasSel} onClick={doTrim} data-testid="btn-trim"><Crop className="w-4 h-4" /> Pangkas</Btn>
                <Btn variant="secondary" disabled={disabled || !hasSel} onClick={doDelete} data-testid="btn-delete"><Trash2 className="w-4 h-4" /> Hapus</Btn>
                <Btn variant="secondary" disabled={disabled || !hasSel} onClick={doCut} data-testid="btn-cut"><Scissors className="w-4 h-4" /> Potong</Btn>
                <Btn variant="secondary" disabled={disabled || !hasSel} onClick={() => doCopy()} data-testid="btn-copy"><Copy className="w-4 h-4" /> Salin</Btn>
                <Btn variant="secondary" disabled={disabled || !clip} onClick={doPaste} className="col-span-2" data-testid="btn-paste"><ClipboardPaste className="w-4 h-4" /> Tempel {clip ? `(${formatClock(pcmDuration(clip), false)})` : ""}</Btn>
                <Btn variant="secondary" disabled={disabled} onClick={selectAll} data-testid="btn-select-all">Pilih semua</Btn>
                <Btn variant="secondary" disabled={disabled || !hasSel} onClick={() => setSel(null)}>Batal pilih</Btn>
              </div>
              <p className="text-[11px] text-slate-400">Pangkas = simpan hanya seleksi · Tempel mengganti seleksi, atau menyisipkan di kursor.</p>
            </div>
            <OpCard {...cardProps} kind="silence" title="Bisukan seleksi" desc="Ganti bagian terpilih dengan keheningan (panjang tetap)." noPreview />
            <OpCard {...cardProps} kind="reverse" title="Balik (reverse)" desc="Putar terbalik bagian terpilih / seluruh audio." />
            <OpCard {...cardProps} kind="repeat" title="Ulangi seleksi" desc="Gandakan seleksi tepat setelahnya." noPreview>
              <Slider label="Jumlah ulangan" value={P.repeatTimes} min={1} max={20} onChange={(v) => setP({ repeatTimes: v })} />
            </OpCard>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Riwayat ({hist.list.length})</p>
              <div className="space-y-1 max-h-48 overflow-y-auto" data-testid="history-list">
                {hist.list.map((h, i) => (
                  <button key={i} type="button" onClick={() => jumpTo(i)} className={cn("w-full flex items-center justify-between text-left text-xs rounded-lg px-3 py-1.5 border", i === hist.idx ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold" : i > hist.idx ? "border-transparent text-slate-300 dark:text-slate-600" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300")}>
                    <span>{i + 1}. {h.label}</span><span className="text-[10px] text-slate-400">{formatClock(pcmDuration(h.pcm), false)}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">Memori riwayat: {(histBytes / 1024 / 1024).toFixed(0)} MB (batas {Math.round(HISTORY_BUDGET / 1024 / 1024)} MB; langkah tertua dibuang otomatis).</p>
            </div>
            <div className={card}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Analisis Level</p>
                <Btn variant="secondary" className="text-xs py-1.5" onClick={doAnalyze} disabled={disabled} data-testid="btn-analyze">Analisis {hasSel ? "seleksi" : "semua"}</Btn>
              </div>
              {stats ? (
                <div className="grid grid-cols-2 gap-2 text-sm" data-testid="stats">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3"><div className="text-[11px] text-slate-400">Puncak</div><div className="font-bold">{stats.peakDb.toFixed(1)} dBFS</div></div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3"><div className="text-[11px] text-slate-400">RMS rata-rata</div><div className="font-bold">{stats.rmsDb.toFixed(1)} dBFS</div></div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3"><div className="text-[11px] text-slate-400">Sampel clipping</div><div className={cn("font-bold", stats.clipped > 0 && "text-red-500")}>{stats.clipped}</div></div>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3"><div className="text-[11px] text-slate-400">DC offset</div><div className="font-bold">{stats.dcOffset.toFixed(4)}</div></div>
                </div>
              ) : <p className="text-xs text-slate-400">Klik analisis untuk melihat puncak, RMS, dan clipping.</p>}
            </div>
          </>
        )}

        {tab === "volume" && (
          <>
            <OpCard {...cardProps} kind="gain" title="Volume (gain)" desc="Naik/turunkan volume dalam dB. +6 dB ≈ dua kali lipat.">
              <Slider label="Penguatan" value={P.gainDb} min={-30} max={30} step={0.5} suffix=" dB" onChange={(v) => setP({ gainDb: v })} testId="gain-slider" />
            </OpCard>
            <OpCard {...cardProps} kind="normalize" title="Normalisasi" desc="Samakan level ke target — puncak atau rata-rata (RMS, tidak akan clipping).">
              <div className="grid grid-cols-2 gap-2">
                {(["peak", "rms"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setP({ normMode: m })} className={cn("rounded-xl border-2 py-2 text-xs font-semibold", P.normMode === m ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>{m === "peak" ? "Puncak (peak)" : "Rata-rata (RMS)"}</button>
                ))}
              </div>
              {P.normMode === "peak" ? <Slider label="Puncak target" value={P.normPeakDb} min={-12} max={0} step={0.1} suffix=" dB" onChange={(v) => setP({ normPeakDb: v })} /> : <Slider label="RMS target" value={P.normRmsDb} min={-30} max={-6} step={0.5} suffix=" dB" onChange={(v) => setP({ normRmsDb: v })} />}
            </OpCard>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Fade in / Fade out</p>
              <Select label="Kurva" value={P.fadeCurve} onChange={(e) => setP({ fadeCurve: e.target.value as OpParams["fadeCurve"] })}>
                <option value="linear">Linear</option>
                <option value="exp">Eksponensial (lambat → cepat)</option>
                <option value="log">Logaritmik (cepat → lambat)</option>
                <option value="scurve">S-curve (halus)</option>
              </Select>
              <p className="text-xs text-slate-500">Fade berlaku di sepanjang bagian terpilih (atau seluruh audio jika tak ada seleksi).</p>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="secondary" disabled={disabled} onClick={() => previewOp("fadeIn")}><Headphones className="w-3.5 h-3.5" /> Pratinjau in</Btn>
                <Btn variant="secondary" disabled={disabled} onClick={() => previewOp("fadeOut")}><Headphones className="w-3.5 h-3.5" /> Pratinjau out</Btn>
                <Btn disabled={disabled} onClick={() => applyOp("fadeIn")} data-testid="apply-fadeIn">Fade in</Btn>
                <Btn disabled={disabled} onClick={() => applyOp("fadeOut")} data-testid="apply-fadeOut">Fade out</Btn>
              </div>
            </div>
            <OpCard {...cardProps} kind="invert" title="Balik fase" desc="Membalik polaritas gelombang (berguna untuk mengoreksi fase)." />
          </>
        )}

        {tab === "waktu" && (
          <>
            <OpCard {...cardProps} kind="speed" title="Kecepatan (nada ikut berubah)" desc="Seperti mempercepat/memperlambat kaset: durasi dan nada berubah bersama.">
              <Slider label="Faktor" value={P.speed} min={0.25} max={4} step={0.05} suffix="×" onChange={(v) => setP({ speed: v })} testId="speed-slider" />
            </OpCard>
            <OpCard {...cardProps} kind="tempo" title="Tempo (nada tetap)" desc="Ubah durasi tanpa mengubah nada (WSOLA)." applyLabel="Terapkan tempo">
              <Slider label="Faktor tempo" value={P.tempo} min={0.5} max={2} step={0.05} suffix="×" onChange={(v) => setP({ tempo: v })} testId="tempo-slider" />
            </OpCard>
            <OpCard {...cardProps} kind="pitch" title="Pitch (durasi tetap)" desc="Naikkan/turunkan nada dalam semiton tanpa mengubah durasi.">
              <Slider label="Semiton" value={P.pitch} min={-12} max={12} step={1} onChange={(v) => setP({ pitch: v })} testId="pitch-slider" />
            </OpCard>
            <OpCard {...cardProps} kind="resample" title="Ubah sample rate" desc="Konversi seluruh audio ke sample rate lain (durasi tetap)." noPreview>
              <Select label="Sample rate" value={String(P.sampleRate)} onChange={(e) => setP({ sampleRate: parseInt(e.target.value) })}>
                {[8000, 11025, 16000, 22050, 32000, 44100, 48000, 96000].map((r) => <option key={r} value={r}>{r} Hz</option>)}
              </Select>
            </OpCard>
          </>
        )}

        {tab === "eq" && (
          <div className={cn(card, "md:col-span-2")} data-testid="op-eq">
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Equalizer 5-band + filter</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Atur frekuensi rendah → tinggi, plus High-pass / Low-pass untuk memotong gemuruh atau desis.</p>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {P.eqBands.map((g, i) => (
                <Slider key={i} label={eqLabels[i]} value={g} min={-15} max={15} step={0.5} suffix=" dB" onChange={(v) => setP({ eqBands: P.eqBands.map((x, j) => (j === i ? v : x)) })} testId={`eq-${EQ_FREQS[i]}`} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Slider label="High-pass (0 = mati)" value={P.eqHp} min={0} max={500} step={5} suffix=" Hz" onChange={(v) => setP({ eqHp: v })} />
              <Slider label="Low-pass (0 = mati)" value={P.eqLp} min={0} max={20000} step={100} suffix=" Hz" onChange={(v) => setP({ eqLp: v })} />
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["Suara jernih", [-3, 0, 1, 3, 1], 80, 0],
                ["Bass boost", [8, 4, 0, 0, 0], 0, 0],
                ["Treble boost", [0, 0, 0, 4, 8], 0, 0],
                ["Telepon", [-12, -4, 6, 4, -12], 300, 3400],
                ["Radio hangat", [3, 2, 0, -2, -5], 0, 8000],
                ["Rata", [0, 0, 0, 0, 0], 0, 0],
              ] as [string, number[], number, number][]).map(([l, b, hp, lp]) => (
                <Btn key={l} variant="secondary" className="text-xs py-1.5" onClick={() => setP({ eqBands: b, eqHp: hp, eqLp: lp })}>{l}</Btn>
              ))}
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" className="flex-1" disabled={disabled} onClick={() => previewOp("eq")} data-testid="preview-eq"><Headphones className="w-4 h-4" /> Pratinjau</Btn>
              <Btn className="flex-1" disabled={disabled} onClick={() => applyOp("eq")} data-testid="apply-eq"><Check className="w-4 h-4" /> Terapkan EQ</Btn>
            </div>
          </div>
        )}

        {tab === "efek" && (
          <>
            <OpCard {...cardProps} kind="compress" title="Kompresor" desc="Meratakan suara keras & pelan — cocok untuk suara/vokal.">
              <Slider label="Ambang (threshold)" value={P.compThr} min={-60} max={0} suffix=" dB" onChange={(v) => setP({ compThr: v })} />
              <Slider label="Rasio" value={P.compRatio} min={1} max={20} step={0.5} suffix=":1" onChange={(v) => setP({ compRatio: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Slider label="Attack" value={P.compAtk} min={1} max={100} suffix=" ms" onChange={(v) => setP({ compAtk: v })} />
                <Slider label="Release" value={P.compRel} min={20} max={1000} step={10} suffix=" ms" onChange={(v) => setP({ compRel: v })} />
              </div>
              <Slider label="Penguatan akhir" value={P.compMakeup} min={0} max={24} step={0.5} suffix=" dB" onChange={(v) => setP({ compMakeup: v })} />
            </OpCard>
            <OpCard {...cardProps} kind="limit" title="Limiter" desc="Menjaga puncak tidak melewati batas (anti-clipping), look-ahead 5 ms.">
              <Slider label="Batas puncak" value={P.limitCeil} min={-12} max={0} step={0.1} suffix=" dB" onChange={(v) => setP({ limitCeil: v })} />
              <Slider label="Release" value={P.limitRel} min={10} max={500} step={10} suffix=" ms" onChange={(v) => setP({ limitRel: v })} />
            </OpCard>
            <OpCard {...cardProps} kind="echo" title="Echo / Delay" desc="Gema berulang dengan umpan balik.">
              <Slider label="Jeda" value={P.echoDelay} min={30} max={1500} step={10} suffix=" ms" onChange={(v) => setP({ echoDelay: v })} />
              <Slider label="Umpan balik" value={Math.round(P.echoFb * 100)} min={0} max={90} suffix="%" onChange={(v) => setP({ echoFb: v / 100 })} />
              <Slider label="Campuran" value={Math.round(P.echoMix * 100)} min={5} max={100} suffix="%" onChange={(v) => setP({ echoMix: v / 100 })} />
              <GamatoCheckbox checked={P.extendTail} onChange={(v) => setP({ extendTail: v })} label="Perpanjang ekor di akhir audio" />
              {P.extendTail && <Slider label="Panjang ekor" value={P.echoTail} min={0.2} max={6} step={0.1} suffix=" s" onChange={(v) => setP({ echoTail: v })} />}
            </OpCard>
            <OpCard {...cardProps} kind="reverb" title="Reverb" desc="Gema ruangan (Freeverb): ruang kecil → aula besar.">
              <Slider label="Ukuran ruang" value={Math.round(P.revRoom * 100)} min={0} max={100} suffix="%" onChange={(v) => setP({ revRoom: v / 100 })} />
              <Slider label="Peredam (damping)" value={Math.round(P.revDamp * 100)} min={0} max={100} suffix="%" onChange={(v) => setP({ revDamp: v / 100 })} />
              <Slider label="Basah (wet)" value={Math.round(P.revWet * 100)} min={0} max={100} suffix="%" onChange={(v) => setP({ revWet: v / 100 })} />
              <div className="grid grid-cols-2 gap-3">
                <Slider label="Pre-delay" value={P.revPre} min={0} max={100} suffix=" ms" onChange={(v) => setP({ revPre: v })} />
                <Slider label="Lebar stereo" value={Math.round(P.revWidth * 100)} min={0} max={100} suffix="%" onChange={(v) => setP({ revWidth: v / 100 })} />
              </div>
              <GamatoCheckbox checked={P.extendTail} onChange={(v) => setP({ extendTail: v })} label="Perpanjang ekor di akhir audio" />
              {P.extendTail && <Slider label="Panjang ekor" value={P.revTail} min={0.5} max={8} step={0.1} suffix=" s" onChange={(v) => setP({ revTail: v })} />}
            </OpCard>
          </>
        )}

        {tab === "bersih" && (
          <>
            <OpCard {...cardProps} kind="gate" title="Noise gate" desc="Menekan desis/noise latar saat tidak ada suara.">
              <Slider label="Ambang" value={P.gateThr} min={-80} max={-10} suffix=" dB" onChange={(v) => setP({ gateThr: v })} />
              <Slider label="Peredaman" value={P.gateRed} min={6} max={90} suffix=" dB" onChange={(v) => setP({ gateRed: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Slider label="Attack" value={P.gateAtk} min={1} max={50} suffix=" ms" onChange={(v) => setP({ gateAtk: v })} />
                <Slider label="Release" value={P.gateRel} min={20} max={800} step={10} suffix=" ms" onChange={(v) => setP({ gateRel: v })} />
              </div>
            </OpCard>
            <div className={card} data-testid="op-silence">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Hapus / pangkas hening</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Cocok untuk merapikan rekaman bicara.</p>
              </div>
              <Slider label="Dianggap hening di bawah" value={P.silThr} min={-80} max={-20} suffix=" dB" onChange={(v) => setP({ silThr: v })} testId="sil-thr" />
              <Slider label="Minimal durasi hening" value={P.silMin} min={100} max={3000} step={50} suffix=" ms" onChange={(v) => setP({ silMin: v })} />
              <Slider label="Sisakan jeda" value={P.silKeep} min={0} max={1000} step={25} suffix=" ms" onChange={(v) => setP({ silKeep: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="secondary" disabled={disabled} onClick={() => applyOp("trimSilence")} data-testid="apply-trimSilence">Pangkas hening di tepi</Btn>
                <Btn disabled={disabled} onClick={() => applyOp("removeSilence")} data-testid="apply-removeSilence">Persingkat semua hening</Btn>
              </div>
              <Btn variant="secondary" className="w-full text-xs" disabled={disabled} onClick={() => previewOp("removeSilence")}><Headphones className="w-3.5 h-3.5" /> Pratinjau</Btn>
            </div>
            <OpCard {...cardProps} kind="dc" title="Hapus DC offset" desc="Memusatkan gelombang di nol (menghilangkan 'klik' & offset)." noPreview />
          </>
        )}

        {tab === "kanal" && (
          <>
            <OpCard {...cardProps} kind="mono" title="Jadikan mono" desc="Gabungkan semua kanal jadi satu (file lebih kecil)." noPreview />
            <OpCard {...cardProps} kind="stereo" title="Jadikan stereo" desc="Gandakan mono ke dua kanal." noPreview />
            <OpCard {...cardProps} kind="swap" title="Tukar kiri ↔ kanan" noPreview />
            <OpCard {...cardProps} kind="pan" title="Pan / balance" desc="Geser suara ke kiri atau kanan (daya konstan).">
              <Slider label="Pan (−100 kiri … +100 kanan)" value={Math.round(P.pan * 100)} min={-100} max={100} onChange={(v) => setP({ pan: v / 100 })} />
            </OpCard>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Pakai satu kanal saja</p>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="secondary" disabled={disabled || pcm.channels.length < 2} onClick={() => applyOp("keepL")}>Hanya kiri</Btn>
                <Btn variant="secondary" disabled={disabled || pcm.channels.length < 2} onClick={() => applyOp("keepR")}>Hanya kanan</Btn>
              </div>
            </div>
          </>
        )}

        {tab === "tambah" && (
          <>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Tambah Audio Lain</p>
              <div className="grid grid-cols-1 gap-2">
                <Btn variant="secondary" disabled={disabled} onClick={() => askFile("insert")} data-testid="btn-insert-file"><Upload className="w-4 h-4" /> Sisipkan di kursor ({formatClock(cursor / sr)})</Btn>
                <Btn variant="secondary" disabled={disabled} onClick={() => askFile("append")} data-testid="btn-append-file"><Plus className="w-4 h-4" /> Gabung di akhir</Btn>
                <Btn variant="secondary" disabled={disabled} onClick={() => askFile("mix")} data-testid="btn-mix-file"><Layers className="w-4 h-4" /> Campur (overlay) mulai kursor</Btn>
              </div>
            </div>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Sisipkan Hening</p>
              <Slider label="Durasi" value={P.insertSilenceSec} min={0.1} max={30} step={0.1} suffix=" s" onChange={(v) => setP({ insertSilenceSec: v })} />
              <Btn className="w-full" disabled={disabled} onClick={() => applyOp("insertSilence")} data-testid="apply-insertSilence"><Plus className="w-4 h-4" /> Sisipkan di kursor</Btn>
            </div>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Rekam dari Mikrofon</p>
              {recording ? (
                <Btn variant="danger" className="w-full" onClick={stopRecording} data-testid="rec-stop"><Square className="w-4 h-4" /> Berhenti & sisipkan ({recording.sec.toFixed(1)}s)</Btn>
              ) : (
                <Btn variant="secondary" className="w-full" disabled={disabled} onClick={startRecording} data-testid="rec-start"><Mic className="w-4 h-4" /> Mulai rekam (disisipkan di kursor)</Btn>
              )}
              <p className="text-[11px] text-slate-400">Butuh izin mikrofon. Rekaman diproses di perangkatmu.</p>
            </div>
          </>
        )}

        {tab === "marker" && (
          <>
            <div className={card}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Marker ({markers.length})</p>
                <Btn variant="secondary" className="text-xs py-1.5" disabled={disabled} onClick={() => addMarker()} data-testid="btn-add-marker"><Flag className="w-3.5 h-3.5" /> Tambah di kursor (M)</Btn>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto" data-testid="marker-list">
                {markers.length === 0 && <p className="text-xs text-slate-400">Belum ada marker. Tekan M saat memutar atau di posisi kursor.</p>}
                {markers.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <button type="button" className="font-mono text-xs text-indigo-600 dark:text-indigo-300 w-24 text-left" onClick={() => { setCursor(m.frame); setView((v) => clampView(m.frame - (v.fpp * wavW) / 2, v.fpp)); }}>{formatClock(m.frame / sr)}</button>
                    <input defaultValue={m.label} key={m.id + m.label} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== m.label) renameMarker(m.id, v); }} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs" aria-label="Nama marker" />
                    <button type="button" onClick={() => removeMarker(m.id)} className="p-1.5 text-slate-400 hover:text-red-500" aria-label="Hapus marker"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Marker Otomatis dari Hening</p>
              <Slider label="Hening di bawah" value={P.silThr} min={-80} max={-20} suffix=" dB" onChange={(v) => setP({ silThr: v })} />
              <Slider label="Minimal durasi" value={P.silMin} min={100} max={3000} step={50} suffix=" ms" onChange={(v) => setP({ silMin: v })} />
              <Btn variant="secondary" className="w-full" disabled={disabled} onClick={markersFromSilence} data-testid="btn-markers-silence">Buat marker di akhir tiap hening</Btn>
            </div>
          </>
        )}

        {tab === "ekspor" && (
          <>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Ekspor Audio</p>
              <Input label="Nama file" value={expName} onChange={(e) => setExpName(e.target.value)} data-testid="exp-name" />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Format" value={expFormat} onChange={(e) => setExpFormat(e.target.value as typeof expFormat)} data-testid="exp-format">
                  <option value="wav16">WAV 16-bit (umum)</option>
                  <option value="wav24">WAV 24-bit (studio)</option>
                  <option value="wav32">WAV 32-bit float</option>
                  <option value="opus" disabled={!getBestCompressedAudioFormat()}>Opus (kecil, real-time)</option>
                </Select>
                <Select label="Bagian" value={expScope} onChange={(e) => setExpScope(e.target.value as "all" | "sel")} data-testid="exp-scope">
                  <option value="all">Seluruh audio</option>
                  <option value="sel" disabled={!hasSel}>Seleksi saja</option>
                </Select>
                <Select label="Sample rate" value={String(expRate)} onChange={(e) => setExpRate(parseInt(e.target.value))} data-testid="exp-rate">
                  <option value="0">Asli ({sr} Hz)</option>
                  {[8000, 16000, 22050, 32000, 44100, 48000].map((r) => <option key={r} value={r}>{r} Hz</option>)}
                </Select>
                <div className="pt-6 space-y-2">
                  <GamatoCheckbox checked={expMono} onChange={setExpMono} label="Jadikan mono" testId="exp-mono" />
                  <GamatoCheckbox checked={expNorm} onChange={setExpNorm} label="Normalisasi −1 dB" testId="exp-norm" />
                </div>
              </div>
              {expFormat !== "wav32" && expFormat !== "opus" && <GamatoCheckbox checked={expDither} onChange={setExpDither} label="Dither (TPDF) — kualitas lebih halus saat dikurangi bit-nya" />}
              <Btn className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700" disabled={disabled} onClick={doExport} data-testid="btn-export"><Download className="w-4 h-4" /> Unduh audio</Btn>
              {expFormat === "opus" && <p className="text-[11px] text-amber-600">Opus diproses real-time: durasi proses ≈ durasi audio.</p>}
            </div>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Ekspor per Marker</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Potong audio di setiap marker menjadi file WAV terpisah, lalu unduh sebagai ZIP. Pakai pengaturan sample rate / mono / normalisasi di kiri.</p>
              <Btn variant="secondary" className="w-full" disabled={disabled || markers.length === 0} onClick={doExportMarkers} data-testid="btn-export-markers"><Download className="w-4 h-4" /> Unduh ZIP ({markers.length + 1} bagian)</Btn>
              {markers.length === 0 && <p className="text-[11px] text-slate-400">Tambahkan marker di tab Marker dulu.</p>}
            </div>
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ToolInfoPanel
          icon={<Info className="w-5 h-5" />}
          label="Pintasan Keyboard"
          desc="Klik waveform dulu agar pintasan aktif"
          points={["Spasi: putar/jeda · L: ulangi · M: marker · Home/End: awal/akhir · ←/→: geser kursor (Shift = 1 dtk)", "Ctrl+A pilih semua · Ctrl+X/C/V potong/salin/tempel · Delete hapus · Ctrl+Z / Ctrl+Y undo/redo", "+/− zoom · Ctrl+scroll zoom di posisi mouse · scroll = geser · klik dua kali = pilih semua"]}
        />
        <ToolInfoPanel
          icon={<Sliders className="w-5 h-5" />}
          label="Catatan Teknis"
          desc="Cara kerja & batasan"
          points={[
            "Semua pemrosesan di browser; audio tidak diunggah. Kualitas internal 32-bit float.",
            "Sample rate file WAV/MP3 dipertahankan; format lain dibaca di sample rate browser lalu bisa diubah lewat tab Kecepatan.",
            "Efek diterapkan ke seleksi dengan crossfade 4 ms di tepi sehingga tidak ada bunyi klik.",
          ]}
        />
      </div>
    </div>
  );
};

// keep tree-shaking quiet about helpers only used in some tabs
void makeSilence; void peakOf; void gainToDb;
