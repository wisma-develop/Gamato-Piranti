import React, { useEffect, useMemo, useRef, useState } from "react";
import { Shrink, Download, Trash2, Loader2, X, CheckCircle2, AlertTriangle, Play, Package, Info, Zap } from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { Btn, Input, Label, Select } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { decodeFileToPcm } from "@/lib/audioDecode";
import { PCM, pcmDuration, resamplePcm, toMono, normalizePeak, removeSilences, encodeWavPcm, formatClock } from "@/lib/audioEditEngine";
import { COMPRESS_PRESETS, encodeOpusOgg, fmtBytes, isOpusEncoderSupported } from "@/lib/audioCompress";
import { encodeAudioBufferCompressed, getBestCompressedAudioFormat } from "@/lib/audioEngine";

interface Item {
  id: string;
  file: File;
  duration: number | null; // seconds, known after decode
  status: "queued" | "working" | "done" | "error";
  progress: number;
  message?: string;
  result?: { blob: Blob; url: string; ext: string; bitrateKbps: number };
}

const uid = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";
const cap = "text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500";

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void; testId?: string }> = ({ label, value, min, max, step = 1, suffix = "", onChange, testId }) => (
  <div data-testid={testId}>
    <div className="flex justify-between items-center mb-1.5">
      <Label>{label}</Label>
      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(value * 100) / 100}{suffix}</span>
    </div>
    <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
  </div>
);

export const AudioCompress: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [isDragging, setIsDragging] = useState(false);
  const [presetId, setPresetId] = useState("voice");
  const [custom, setCustom] = useState(false);
  const [kbps, setKbps] = useState(48);
  const [mono, setMono] = useState(true);
  const [application, setApplication] = useState<"audio" | "voip">("audio");
  const [targetMode, setTargetMode] = useState(false);
  const [targetMb, setTargetMb] = useState(1);
  const [format, setFormat] = useState<"opus" | "wav">("opus");
  const [wavRate, setWavRate] = useState(16000);
  const [wavMono, setWavMono] = useState(true);
  const [normalize, setNormalize] = useState(false);
  const [trimSilence, setTrimSilence] = useState(false);
  const [running, setRunning] = useState(false);
  const [info, setInfo] = useState<{ msg: string; tone: "success" | "error" | "warning" | "info" } | null>(null);
  const [fast, setFast] = useState<boolean | null>(null);
  const cancelRef = useRef({ cancelled: false });

  useEffect(() => { isOpusEncoderSupported().then(setFast); }, []);
  useEffect(() => () => { itemsRef.current.forEach((i) => i.result && URL.revokeObjectURL(i.result.url)); }, []);

  const preset = COMPRESS_PRESETS.find((p) => p.id === presetId)!;
  const eff = custom ? { kbps, mono, application } : { kbps: preset.kbps, mono: preset.mono, application: preset.application };

  const patch = (id: string, p: Partial<Item>) => setItems((is) => is.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const addFiles = async (files: File[]) => {
    const ok = files.filter((f) => f.type.startsWith("audio/") || f.type.startsWith("video/") || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm|mp4|mov|mkv|wma)$/i.test(f.name));
    if (!ok.length) return setInfo({ msg: "Pilih file audio (MP3, WAV, M4A, OGG, FLAC…) atau video.", tone: "error" });
    setInfo(null);
    const fresh: Item[] = ok.map((file) => ({ id: uid(), file, duration: null, status: "queued", progress: 0 }));
    setItems((is) => [...is, ...fresh]);
    // read durations cheaply through <audio> metadata (no full decode)
    for (const it of fresh) {
      const url = URL.createObjectURL(it.file);
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.src = url;
      a.onloadedmetadata = () => { if (isFinite(a.duration)) patch(it.id, { duration: a.duration }); URL.revokeObjectURL(url); };
      a.onerror = () => URL.revokeObjectURL(url);
    }
  };

  const bitrateFor = (duration: number | null): number => {
    if (targetMode && duration && duration > 0) return Math.max(6, Math.min(320 * (eff.mono ? 1 : 2), Math.floor((targetMb * 1024 * 1024 * 8 * 0.96) / duration / 1000)));
    return eff.kbps;
  };

  const processOne = async (it: Item) => {
    patch(it.id, { status: "working", progress: 0.02, message: "Mendekode…" });
    let pcm: PCM = await decodeFileToPcm(it.file);
    const dur = pcmDuration(pcm);
    patch(it.id, { duration: dur, progress: 0.1, message: "Memproses…" });
    if (trimSilence) pcm = removeSilences(pcm, -50, 1000, 400, false);
    if (normalize) pcm = normalizePeak(pcm, -1);
    const k = bitrateFor(dur);
    let blob: Blob;
    let ext: string;
    let usedKbps = k;
    if (format === "wav") {
      let p = pcm.sampleRate !== wavRate ? resamplePcm(pcm, wavRate) : pcm;
      if (wavMono && p.channels.length > 1) p = toMono(p);
      blob = encodeWavPcm(p, 16, true);
      ext = "wav";
      usedKbps = Math.round((wavRate * 16 * p.channels.length) / 1000);
    } else if (fast) {
      patch(it.id, { message: "Mengkodekan Opus…" });
      blob = await encodeOpusOgg(pcm, {
        bitrate: k * 1000,
        mono: eff.mono,
        application: eff.application,
        signal: cancelRef.current,
        onProgress: (f) => patch(it.id, { progress: 0.1 + f * 0.88 }),
      });
      ext = "opus";
    } else {
      const fmt = getBestCompressedAudioFormat();
      if (!fmt) throw new Error("Browser ini tidak mendukung pengkodean Opus. Pilih format WAV ringan.");
      patch(it.id, { message: "Mengkodekan (real-time)…" });
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const tmp: AudioContext = new AC();
      try {
        let p = eff.mono ? toMono(pcm) : pcm;
        const buf = tmp.createBuffer(p.channels.length, p.channels[0].length, p.sampleRate);
        p.channels.forEach((c, i) => buf.copyToChannel(c as any, i));
        blob = await encodeAudioBufferCompressed({ buffer: buf, start: 0, end: buf.duration, format: fmt, onProgress: (f) => patch(it.id, { progress: 0.1 + f * 0.88 }) });
        ext = fmt.ext;
      } finally {
        tmp.close().catch(() => {});
      }
    }
    if (cancelRef.current.cancelled) throw new Error("Dibatalkan.");
    const url = URL.createObjectURL(blob);
    patch(it.id, { status: "done", progress: 1, message: undefined, result: { blob, url, ext, bitrateKbps: usedKbps } });
  };

  const runAll = async () => {
    cancelRef.current = { cancelled: false };
    setRunning(true);
    setInfo(null);
    const todo = itemsRef.current.filter((i) => i.status !== "working");
    for (const it of todo) {
      if (cancelRef.current.cancelled) break;
      if (it.result) { URL.revokeObjectURL(it.result.url); patch(it.id, { result: undefined }); }
      try {
        await processOne(it);
      } catch (e: any) {
        patch(it.id, { status: "error", progress: 0, message: e?.message ?? "Gagal." });
      }
    }
    setRunning(false);
    if (cancelRef.current.cancelled) setInfo({ msg: "Dibatalkan.", tone: "warning" });
  };

  const baseName = (n: string) => n.replace(/\.[^.]+$/, "");
  const outName = (it: Item) => `${baseName(it.file.name)}-kompres.${it.result?.ext ?? "opus"}`;

  const downloadAll = async () => {
    const done = items.filter((i) => i.result);
    if (!done.length) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (const it of done) zip.file(outName(it), await it.result!.blob.arrayBuffer());
    downloadBlob(await zip.generateAsync({ type: "blob" }), "audio-terkompres.zip");
  };

  const remove = (id: string) => {
    setItems((is) => {
      const t = is.find((i) => i.id === id);
      if (t?.result) URL.revokeObjectURL(t.result.url);
      return is.filter((i) => i.id !== id);
    });
  };

  const totals = useMemo(() => {
    const done = items.filter((i) => i.result);
    const before = done.reduce((a, i) => a + i.file.size, 0);
    const after = done.reduce((a, i) => a + (i.result?.blob.size ?? 0), 0);
    return { n: done.length, before, after, saved: before ? Math.round((1 - after / before) * 100) : 0 };
  }, [items]);

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start" data-testid="acomp-root">
      <div className="space-y-4 min-w-0">
        <Dropzone onFiles={addFiles} accept="audio/*,video/*" multiple isDragging={isDragging} setIsDragging={setIsDragging} label="Tambah audio untuk dikompres" sublabel="Bisa banyak file sekaligus — MP3, WAV, M4A, OGG, FLAC, atau video" icon={<Shrink className="w-8 h-8" />} />
        {info && <GamatoInlineAlert message={info.msg} tone={info.tone} />}

        {items.length > 0 && (
          <div className={card} data-testid="acomp-list">
            <div className="flex items-center justify-between">
              <p className={cap}>{items.length} file</p>
              <button type="button" className="text-xs font-semibold text-red-500" onClick={() => { items.forEach((i) => i.result && URL.revokeObjectURL(i.result.url)); setItems([]); }} disabled={running}>Hapus semua</button>
            </div>
            <div className="space-y-2.5">
              {items.map((it) => {
                const est = it.duration ? Math.round((bitrateFor(it.duration) * 1000 * it.duration) / 8) : null;
                return (
                  <div key={it.id} data-testid="acomp-item" className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{it.file.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {fmtBytes(it.file.size)}{it.duration ? ` · ${formatClock(it.duration, false)}` : ""}
                          {it.status === "queued" && est && format === "opus" ? ` · perkiraan hasil ≈ ${fmtBytes(est)}` : ""}
                        </p>
                      </div>
                      {it.status === "done" && it.result && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1" data-testid="acomp-saved"><CheckCircle2 className="w-4 h-4" />{fmtBytes(it.result.blob.size)} · {Math.round((1 - it.result.blob.size / it.file.size) * 100)}%</span>
                      )}
                      {it.status === "error" && <span className="text-xs font-semibold text-red-500 flex items-center gap-1" data-testid="acomp-error"><AlertTriangle className="w-4 h-4" />Gagal</span>}
                      <button type="button" onClick={() => remove(it.id)} disabled={it.status === "working"} aria-label="Hapus" className="p-1 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                    {it.status === "working" && (
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(it.progress * 100)}%` }} /></div>
                        <p className="text-[11px] text-slate-400">{it.message}</p>
                      </div>
                    )}
                    {it.status === "error" && <p className="text-xs text-red-500">{it.message}</p>}
                    {it.status === "done" && it.result && (
                      <div className="flex flex-wrap items-center gap-2">
                        <audio controls src={it.result.url} className="h-9 flex-1 min-w-[180px]" />
                        <Btn variant="secondary" className="text-xs py-1.5" onClick={() => downloadBlob(it.result!.blob, outName(it))} data-testid="acomp-download"><Download className="w-3.5 h-3.5" /> Unduh</Btn>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {totals.n > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-4 py-3" data-testid="acomp-total">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Total: {fmtBytes(totals.before)} → {fmtBytes(totals.after)} (hemat {totals.saved}%)</span>
                {totals.n > 1 && <Btn variant="secondary" className="text-xs py-1.5" onClick={downloadAll} data-testid="acomp-zip"><Package className="w-3.5 h-3.5" /> Unduh semua (ZIP)</Btn>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 min-w-0">
        <div className={card}>
          <div className="flex items-center justify-between">
            <p className={cap}>Format Hasil</p>
            {fast != null && <span className="text-[11px] text-slate-400 flex items-center gap-1"><Zap className="w-3 h-3" />{fast ? "Encoder cepat aktif" : "Mode real-time"}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([["opus", "Opus (disarankan)", "Paling kecil"], ["wav", "WAV ringan", "Kompatibel luas"]] as const).map(([id, l, s]) => (
              <button key={id} type="button" data-testid={`fmt-${id}`} onClick={() => setFormat(id)} className={cn("rounded-xl border-2 p-3 text-left", format === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700")}>
                <div className={cn("text-sm font-bold", format === id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100")}>{l}</div>
                <div className="text-[11px] text-slate-500">{s}</div>
              </button>
            ))}
          </div>
        </div>

        {format === "opus" ? (
          <div className={card} data-testid="opus-settings">
            <p className={cap}>Tingkat Kompresi</p>
            <div className="space-y-2">
              {COMPRESS_PRESETS.map((p) => (
                <button key={p.id} type="button" data-testid={`preset-${p.id}`} onClick={() => { setPresetId(p.id); setCustom(false); }} className={cn("w-full text-left rounded-xl border-2 px-3 py-2", !custom && presetId === p.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{p.label}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{p.desc}</div>
                </button>
              ))}
              <button type="button" data-testid="preset-custom" onClick={() => { setCustom(true); }} className={cn("w-full text-left rounded-xl border-2 px-3 py-2", custom ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Kustom</div>
                <div className="text-[11px] text-slate-500">Atur bitrate, kanal, dan mode sendiri</div>
              </button>
            </div>
            {custom && (
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Slider label="Bitrate" value={kbps} min={8} max={320} step={1} suffix=" kbps" onChange={setKbps} testId="kbps-slider" />
                <GamatoCheckbox checked={mono} onChange={setMono} label="Jadikan mono (hemat ~50%)" testId="mono-chk" />
                <Select label="Mode pengkodean" value={application} onChange={(e) => setApplication(e.target.value as typeof application)}>
                  <option value="audio">Musik / umum</option>
                  <option value="voip">Suara bicara (lebih jernih di bitrate rendah)</option>
                </Select>
              </div>
            )}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <GamatoCheckbox checked={targetMode} onChange={setTargetMode} label="Tentukan target ukuran file" testId="target-chk" />
              {targetMode && (
                <>
                  <Input label="Ukuran maksimal per file (MB)" type="number" min={0.1} step={0.1} value={targetMb} onChange={(e) => setTargetMb(Math.max(0.1, parseFloat(e.target.value) || 1))} data-testid="target-mb" />
                  <p className="text-[11px] text-slate-400">Bitrate dihitung otomatis dari durasi tiap file (batas 8–320 kbps) — nilai bitrate di atas diabaikan.</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className={card} data-testid="wav-settings">
            <p className={cap}>WAV Ringan</p>
            <Select label="Sample rate" value={String(wavRate)} onChange={(e) => setWavRate(parseInt(e.target.value))}>
              {[8000, 11025, 16000, 22050, 32000, 44100].map((r) => <option key={r} value={r}>{r} Hz</option>)}
            </Select>
            <GamatoCheckbox checked={wavMono} onChange={setWavMono} label="Jadikan mono" />
            <p className="text-[11px] text-slate-400">WAV 16-bit tidak terkompresi — hanya mengecil lewat sample rate & mono. Cocok bila perangkat tujuan tidak mendukung Opus.</p>
          </div>
        )}

        <div className={card}>
          <p className={cap}>Pra-pemrosesan (opsional)</p>
          <GamatoCheckbox checked={normalize} onChange={setNormalize} label="Normalisasi volume (puncak −1 dB)" testId="norm-chk" />
          <GamatoCheckbox checked={trimSilence} onChange={setTrimSilence} label="Persingkat hening panjang (> 1 dtk)" testId="trim-chk" />
        </div>

        {running ? (
          <Btn variant="danger" className="w-full py-3" onClick={() => { cancelRef.current.cancelled = true; }} data-testid="acomp-cancel"><X className="w-4 h-4" /> Batalkan</Btn>
        ) : (
          <Btn className="w-full py-3.5 text-base bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700" disabled={!items.length || fast === null} onClick={runAll} data-testid="acomp-run">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shrink className="w-4 h-4" />} Kompres {items.length > 1 ? `${items.length} file` : "audio"}
          </Btn>
        )}

        <ToolInfoPanel
          icon={<Info className="w-5 h-5" />}
          label="Kompres Audio"
          desc="Opus: ukuran jauh lebih kecil dari MP3"
          points={[
            "Opus 24 kbps mono sudah jernih untuk suara bicara; 96–160 kbps stereo untuk musik.",
            "Dengan encoder cepat, proses jauh lebih singkat dari durasi audio. Tanpa itu, browser memakai mode real-time (durasi proses ≈ durasi audio).",
            "Format .opus didukung Chrome, Firefox, Edge, VLC & Android; Safari/iOS lama mungkin belum — gunakan WAV ringan atau Universal Converter.",
          ]}
        />
      </div>
    </div>
  );
};

void Trash2; void Play;
