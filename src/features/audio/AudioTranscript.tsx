import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollText, Mic, Square, Play, Pause, Trash2, Plus, Scissors, Merge, Download, Copy, FileText, Loader2, Search, Users, Sparkles,
  Wand2, Clock, Cpu, X, FileUp, AlertTriangle, ChevronDown, Info,
} from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { Btn, Input, Label, Select } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { requestMicrophone, stopStream, PermissionError, type PermFailure } from "@/lib/permissions";
import { GamatoPermissionNotice } from "@/components/ui/GamatoPermissionNotice";
import { MediaDevicePicker } from "@/components/ui/MediaDevicePicker";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { decodeFileToPcm } from "@/lib/audioDecode";
import { resamplePcm, toMono, pcmDuration } from "@/lib/audioEditEngine";
import { createAsrSession, ASR_MODELS, ASR_LANGUAGES, type AsrSession } from "@/lib/asrClient";
import {
  DEFAULT_FORMAT, buildParagraphs, cleanSegments, computeStats, countMatches, exportClipboardText, exportCsv, exportJson, exportMarkdown, exportSrt, exportTxt,
  exportVtt, extractiveSummary, fmtTime, guessSpeakersByPauses, isSilentWindow, mergeShortSegments, newSegId, parseAnyTranscript, planWindows, postProcessAsr, replaceAll,
  topKeywords, type FormatOptions, type Segment, type TranscriptMeta,
} from "@/lib/transcriptEngine";
import { buildTranscriptDocx, buildTranscriptPdf, hasNonLatin } from "@/lib/transcriptDocs";
import { copyText as gamatoCopyText } from "@/lib/permissions";
import { GamatoSelect } from "@/components/ui/GamatoSelect";
import { tr } from "@/i18n";

/* ───────────────────────────── helpers ───────────────────────────── */

const SR = 16000;
const SPEAKER_STYLES = [
  "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30",
  "text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/30",
  "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30",
  "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",
  "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30",
  "text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/30",
];
const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";
const cap = "text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500";

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }> = ({ label, value, min, max, step = 1, suffix = "", onChange }) => (
  <div>
    <div className="flex justify-between items-center mb-1.5">
      <Label>{label}</Label>
      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(value * 100) / 100}{suffix}</span>
    </div>
    <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
  </div>
);

const SegmentRow = React.memo(function SegmentRow({
  seg, index, active, highlight, speakers, hasAudio, showTime, showSpeaker, onText, onSeek, onSpeaker, onSplit, onMergeNext, onDelete, onAddAfter, onSetStart, isLast,
}: {
  seg: Segment; index: number; active: boolean; highlight: boolean; speakers: string[]; hasAudio: boolean; showTime: boolean; showSpeaker: boolean; isLast: boolean;
  onText: (id: string, text: string) => void; onSeek: (t: number) => void; onSpeaker: (id: string, sp: number | null) => void;
  onSplit: (id: string, caret: number) => void; onMergeNext: (id: string) => void; onDelete: (id: string) => void; onAddAfter: (id: string) => void; onSetStart: (id: string) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = taRef.current;
    if (t) { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; }
  }, [seg.text]);
  return (
    <div data-seg-id={seg.id} data-testid="seg-row" className={cn("rounded-xl border px-3 py-2.5 transition-colors", active ? "border-indigo-400 bg-indigo-50/70 dark:bg-indigo-500/10" : highlight ? "border-amber-300 bg-amber-50/60 dark:bg-amber-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900")}>
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        {showTime && (
          <button type="button" onClick={() => onSeek(seg.start)} disabled={!hasAudio} data-testid="seg-time" title={hasAudio ? tr("Putar dari sini") : tr("Tidak ada audio")} className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 rounded-md px-2 py-0.5 disabled:text-slate-400 disabled:bg-slate-100 dark:disabled:bg-slate-800">
            {fmtTime(seg.start)}
          </button>
        )}
        {showSpeaker && (
          <GamatoSelect compact wrapperClassName="w-auto" value={seg.speaker == null ? "" : String(seg.speaker)} onChange={(e) => onSpeaker(seg.id, e.target.value === "" ? null : parseInt(e.target.value))} aria-label={tr("Pembicara")} data-testid="seg-speaker" className={cn("px-1.5 py-0.5 text-[11px] rounded-md font-semibold", seg.speaker != null ? SPEAKER_STYLES[seg.speaker % SPEAKER_STYLES.length] : "text-slate-500")}>
            <option value="">{tr("— Pembicara —")}</option>
            {speakers.map((s, i) => <option key={i} value={String(i)}>{s}</option>)}
          </GamatoSelect>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 text-slate-400">
          {hasAudio && <button type="button" title={tr("Atur waktu mulai ke posisi pemutar")} onClick={() => onSetStart(seg.id)} className="p-1 hover:text-indigo-600"><Clock className="w-3.5 h-3.5" /></button>}
          <button type="button" title={tr("Pisah di posisi kursor")} onClick={() => onSplit(seg.id, taRef.current?.selectionStart ?? 0)} data-testid="seg-split" className="p-1 hover:text-indigo-600"><Scissors className="w-3.5 h-3.5" /></button>
          <button type="button" title={tr("Gabung dengan segmen berikutnya")} disabled={isLast} onClick={() => onMergeNext(seg.id)} data-testid="seg-merge" className="p-1 hover:text-indigo-600 disabled:opacity-30"><Merge className="w-3.5 h-3.5" /></button>
          <button type="button" title={tr("Tambah segmen setelah ini")} onClick={() => onAddAfter(seg.id)} className="p-1 hover:text-indigo-600"><Plus className="w-3.5 h-3.5" /></button>
          <button type="button" title={tr("Hapus segmen")} onClick={() => onDelete(seg.id)} data-testid="seg-delete" className="p-1 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <textarea ref={taRef} rows={1} value={seg.text} onChange={(e) => onText(seg.id, e.target.value)} aria-label={tr("Teks segmen {0}", index + 1)} data-testid="seg-text" className="w-full resize-none bg-transparent text-sm leading-relaxed text-slate-800 dark:text-slate-100 focus:outline-none" />
    </div>
  );
});

/* ───────────────────────────── component ───────────────────────────── */

type RunState =
  | { stage: "idle" }
  | { stage: "prepare"; msg: string }
  | { stage: "download"; pct: number }
  | { stage: "loading" }
  | { stage: "transcribing"; done: number; total: number; eta: number | null }
  | { stage: "error"; message: string };

export const AudioTranscript: React.FC = () => {
  // transcript data
  const history = useHistoryState<Segment[]>(() => []);
  const segments = history.state;
  const { schedule: scheduleCommit } = useDebouncedCommit(history.commit, 600);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [title, setTitle] = useState(tr("Transkrip Audio"));

  // source
  const [src, setSrc] = useState<{ name: string; duration: number; url: string | null; audio16k: Float32Array | null } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // engine settings
  const [model, setModel] = useState(ASR_MODELS[1].id);
  const [language, setLanguage] = useState("id");
  const [task, setTask] = useState<"transcribe" | "translate">("transcribe");
  const [run, setRun] = useState<RunState>({ stage: "idle" });
  const [info, setInfo] = useState<{ msg: string; tone: "success" | "error" | "warning" | "info" } | null>(null);
  const cancelRef = useRef(false);
  const sessionRef = useRef<AsrSession | null>(null);

  // view / format
  const [fmt, setFmt] = useState<FormatOptions>(DEFAULT_FORMAT);
  const [view, setView] = useState<"segmen" | "paragraf">("segmen");
  const [showTime, setShowTime] = useState(true);
  const [showSpeaker, setShowSpeaker] = useState(true);
  const [find, setFind] = useState("");
  const [rep, setRep] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [follow, setFollow] = useState(true);
  const [pauseGap, setPauseGap] = useState(2);
  const [summaryCount, setSummaryCount] = useState(5);
  const [summary, setSummary] = useState<string[] | null>(null);

  // export
  const [expTime, setExpTime] = useState(true);
  const [expSpeakers, setExpSpeakers] = useState(true);
  const [expSummary, setExpSummary] = useState(true);
  const [expKeywords, setExpKeywords] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  // audio player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [curTime, setCurTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const openRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<{ mr: MediaRecorder; stream: MediaStream; timer: number } | null>(null);
  const [recording, setRecording] = useState<number | null>(null);
  const [micFail, setMicFail] = useState<PermFailure | null>(null);
  const [micId, setMicId] = useState("");
  const { devices: mics, refresh: refreshMics } = useMediaDevices("audioinput");

  const duration = src?.duration ?? (segments.length ? Math.max(...segments.map((s) => s.end)) : 0);
  const running = run.stage === "prepare" || run.stage === "download" || run.stage === "loading" || run.stage === "transcribing";
  const hasAudio = !!src?.url;

  const meta: TranscriptMeta = useMemo(
    () => ({
      title: title.trim() || tr("Transkrip Audio"),
      sourceName: src?.name ?? tr("Impor manual"),
      duration,
      language: ASR_LANGUAGES.find((l) => l.id === language)?.label ?? language,
      model: ASR_MODELS.find((m) => m.id === model)?.label ?? model,
      speakers,
      date: new Date().toISOString(),
    }),
    [title, src?.name, duration, language, model, speakers]
  );

  const fullText = useMemo(() => segments.map((s) => s.text).join(" "), [segments]);
  const stats = useMemo(() => computeStats(segments, duration), [segments, duration]);
  const keywords = useMemo(() => topKeywords(fullText, 10), [fullText]);
  const paragraphs = useMemo(() => buildParagraphs(segments, fmt), [segments, fmt]);
  const matchCount = useMemo(() => countMatches(segments, find, matchCase), [segments, find, matchCase]);
  const activeId = useMemo(() => {
    if (!hasAudio) return null;
    let id: string | null = null;
    for (const s of segments) {
      if (curTime >= s.start - 0.05 && curTime < Math.max(s.end, s.start + 0.2)) id = s.id;
    }
    return id;
  }, [segments, curTime, hasAudio]);

  const msg = (text: string, tone: "success" | "error" | "warning" | "info" = "info") => setInfo({ msg: text, tone });

  /* ── segment mutations ── */
  const setSegs = useCallback((fn: (s: Segment[]) => Segment[], live = false) => {
    if (live) {
      history.set(fn, { commit: false });
      scheduleCommit();
    } else history.set(fn);
  }, [history, scheduleCommit]);

  const onText = useCallback((id: string, text: string) => setSegs((ss) => ss.map((s) => (s.id === id ? { ...s, text } : s)), true), [setSegs]);
  const onSpeaker = useCallback((id: string, sp: number | null) => setSegs((ss) => ss.map((s) => (s.id === id ? { ...s, speaker: sp } : s))), [setSegs]);
  const onDelete = useCallback((id: string) => setSegs((ss) => ss.filter((s) => s.id !== id)), [setSegs]);
  const onMergeNext = useCallback((id: string) => setSegs((ss) => {
    const i = ss.findIndex((s) => s.id === id);
    if (i < 0 || i >= ss.length - 1) return ss;
    const merged = { ...ss[i], text: `${ss[i].text} ${ss[i + 1].text}`.trim(), end: Math.max(ss[i].end, ss[i + 1].end) };
    return [...ss.slice(0, i), merged, ...ss.slice(i + 2)];
  }), [setSegs]);
  const onSplit = useCallback((id: string, caret: number) => setSegs((ss) => {
    const i = ss.findIndex((s) => s.id === id);
    if (i < 0) return ss;
    const s = ss[i];
    const a = s.text.slice(0, caret).trim();
    const b = s.text.slice(caret).trim();
    if (!a || !b) return ss;
    const mid = s.start + ((s.end - s.start) * a.length) / (a.length + b.length);
    return [...ss.slice(0, i), { ...s, text: a, end: mid }, { ...s, id: newSegId(), text: b, start: mid }, ...ss.slice(i + 1)];
  }), [setSegs]);
  const onAddAfter = useCallback((id: string) => setSegs((ss) => {
    const i = ss.findIndex((s) => s.id === id);
    const prev = ss[i];
    const start = prev ? prev.end : 0;
    return [...ss.slice(0, i + 1), { id: newSegId(), start, end: start + 2, text: "", speaker: prev?.speaker ?? null }, ...ss.slice(i + 1)];
  }), [setSegs]);
  const onSetStart = useCallback((id: string) => {
    const t = audioRef.current?.currentTime ?? 0;
    setSegs((ss) => ss.map((s) => (s.id === id ? { ...s, start: t, end: Math.max(s.end, t + 0.5) } : s)));
  }, [setSegs]);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, t);
    a.play().catch(() => {});
  }, []);

  const addSegmentNow = () => {
    const t = audioRef.current?.currentTime ?? (segments.length ? segments[segments.length - 1].end : 0);
    setSegs((ss) => [...ss, { id: newSegId(), start: t, end: t + 3, text: "", speaker: null }]);
    msg(tr("Segmen kosong ditambahkan di posisi pemutar — ketik teksnya di daftar."), "info");
  };

  /* ── audio events ── */
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurTime(a.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onPause);
    };
  }, [src?.url]);

  useEffect(() => { if (audioRef.current) audioRef.current.playbackRate = rate; }, [rate, src?.url]);

  // keep the active segment visible while playing
  useEffect(() => {
    if (!follow || !isPlaying || !activeId || view !== "segmen") return;
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-seg-id="${activeId}"]`);
    if (!list || !el) return;
    const top = el.offsetTop - list.offsetTop;
    if (top < list.scrollTop || top + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTo({ top: Math.max(0, top - 60), behavior: "smooth" });
  }, [activeId, follow, isPlaying, view]);

  useEffect(() => () => {
    sessionRef.current?.terminate();
    if (recRef.current) { recRef.current.stream.getTracks().forEach((t) => t.stop()); window.clearInterval(recRef.current.timer); }
  }, []);

  useEffect(() => () => { if (src?.url) URL.revokeObjectURL(src.url); }, [src?.url]);

  /* ── loading source ── */
  const loadSource = async (file: File) => {
    setInfo(null);
    setRun({ stage: "prepare", msg: tr("Mendekode & menyiapkan audio…") });
    try {
      const pcm = await decodeFileToPcm(file);
      const dur = pcmDuration(pcm);
      const mono = toMono(pcm);
      const r16 = resamplePcm(mono, SR);
      const audio16k = r16.channels[0];
      setSrc((old) => { if (old?.url) URL.revokeObjectURL(old.url); return { name: file.name, duration: dur, url: URL.createObjectURL(file), audio16k }; });
      setTitle(file.name.replace(/\.[^.]+$/, ""));
      setCurTime(0);
      setRun({ stage: "idle" });
      if (dur > 90 * 60) msg(tr("Audio lebih dari 90 menit — proses di browser bisa sangat lama dan berat di memori. Pertimbangkan memotongnya dulu di Edit Audio."), "warning");
      else msg(tr("{0} siap — {1}. Pilih model & bahasa lalu tekan “Mulai Transkripsi”.", file.name, fmtTime(dur)), "success");
    } catch (e: any) {
      setRun({ stage: "error", message: e?.message ?? tr("Gagal membaca audio.") });
    }
  };

  const onFiles = (files: File[]) => {
    const f = files.find((x) => x.type.startsWith("audio/") || x.type.startsWith("video/") || /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|webm|mp4|mov|mkv)$/i.test(x.name));
    if (!f) return msg(tr("Pilih file audio (MP3, WAV, OGG, M4A, FLAC) atau video."), "error");
    loadSource(f);
  };

  const importTranscript = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const segs = parseAnyTranscript(text);
      if (!segs.length) return msg(tr("Tidak ada teks yang bisa dibaca dari file itu."), "error");
      history.reset(segs);
      setSpeakers([]);
      setSummary(null);
      if (!src) setTitle(file.name.replace(/\.[^.]+$/, ""));
      msg(tr("{0} segmen diimpor dari {1}. Kamu bisa merapikan, mengganti, dan mengekspornya.", segs.length, file.name), "success");
    } catch {
      msg(tr("File tidak bisa dibaca."), "error");
    }
  };

  /* ── recording ── */
  const startRecording = async () => {
    if (typeof MediaRecorder === "undefined") return msg(tr("Browser ini tidak mendukung perekaman audio."), "error");
    setMicFail(null);
    let stream: MediaStream | null = null;
    try {
      stream = await requestMicrophone(micId ? { deviceId: { exact: micId } } : true);
      void refreshMics();
      const media = stream;
      const mr = new MediaRecorder(media);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const t0 = Date.now();
      const timer = window.setInterval(() => setRecording((Date.now() - t0) / 1000), 250);
      mr.onstop = () => {
        window.clearInterval(timer);
        stopStream(media);
        recRef.current = null;
        setRecording(null);
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        loadSource(new File([blob], "rekaman.webm", { type: blob.type }));
      };
      mr.start();
      recRef.current = { mr, stream: media, timer };
      setRecording(0);
    } catch (e: any) {
      stopStream(stream);
      if (e instanceof PermissionError) setMicFail(e.failure);
      else msg(tr("Tidak bisa merekam: {0}", e?.message ?? e), "error");
    }
  };
  const stopRecording = () => { const r = recRef.current; if (r && r.mr.state !== "inactive") r.mr.stop(); };

  /* ── transcription ── */
  const startTranscription = async () => {
    if (!src?.audio16k || running) return;
    setInfo(null);
    cancelRef.current = false;
    history.reset([]);
    setSummary(null);
    const audio = src.audio16k;
    setRun({ stage: "download", pct: 0 });
    let session: AsrSession;
    try {
      session = await createAsrSession(model, (s) => {
        if (s.stage === "download") setRun({ stage: "download", pct: s.pct });
        else if (s.stage === "loading") setRun({ stage: "loading" });
      });
    } catch (e: any) {
      setRun({ stage: "error", message: tr("Model tidak bisa dimuat: {0}. Model Whisper diunduh dari internet saat pertama kali dipakai (lalu disimpan di cache browser) — pastikan koneksi aktif.", e?.message ?? e) });
      return;
    }
    sessionRef.current = session;
    try {
      const wins = planWindows(audio, SR);
      const collected: Segment[] = [];
      const t0 = performance.now();
      let doneSec = 0;
      const totalSec = audio.length / SR;
      for (let i = 0; i < wins.length; i++) {
        if (cancelRef.current) break;
        const w = wins[i];
        setRun({ stage: "transcribing", done: i, total: wins.length, eta: i > 0 ? ((performance.now() - t0) / 1000 / doneSec) * (totalSec - doneSec) : null });
        if (!isSilentWindow(audio, w.start, w.end, SR)) {
          const chunk = audio.slice(w.start, w.end);
          const res = await session.transcribe(chunk, language, task);
          const off = w.start / SR;
          for (const s of res.segments) {
            if (!s.text.trim()) continue;
            collected.push({ id: newSegId(), start: off + s.start, end: off + Math.max(s.end, s.start + 0.2), text: s.text.trim(), speaker: null });
          }
          history.set(() => postProcessAsr(collected.map((c) => ({ ...c }))), { commit: false });
        }
        doneSec += (w.end - w.start) / SR;
      }
      const finalSegs = postProcessAsr(collected);
      history.reset(finalSegs);
      if (cancelRef.current) {
        msg(tr("Dibatalkan. {0} segmen yang sempat selesai dipertahankan.", finalSegs.length), "warning");
        setRun({ stage: "idle" });
      } else {
        setRun({ stage: "idle" });
        msg(finalSegs.length ? tr("Selesai — {0} segmen. Periksa & rapikan di bawah, lalu ekspor.", finalSegs.length) : tr("Selesai, tetapi tidak ada ucapan yang terdeteksi. Coba model lebih besar atau pilih bahasa secara manual."), finalSegs.length ? "success" : "warning");
      }
    } catch (e: any) {
      history.reset(postProcessAsr(history.state));
      setRun({ stage: "error", message: tr("Transkripsi gagal: {0}", e?.message ?? e) });
    } finally {
      session.terminate();
      sessionRef.current = null;
    }
  };

  const cancelTranscription = () => {
    cancelRef.current = true;
    // aborting the in-flight chunk: terminating the worker rejects its promise
    sessionRef.current?.terminate();
  };

  /* ── formatting tools ── */
  const applyCleanup = () => {
    setSegs((ss) => cleanSegments(ss, fmt));
    msg(tr("Teks dirapikan: kata pengisi dibuang & huruf kapital diperbaiki."), "success");
  };
  const applyMerge = () => { setSegs((ss) => mergeShortSegments(ss)); msg(tr("Segmen pendek digabung."), "success"); };
  const applyDedupe = () => { setSegs((ss) => postProcessAsr(ss)); msg(tr("Pengulangan & segmen kosong dibersihkan."), "success"); };
  const applyReplace = () => {
    if (!find) return;
    const n = matchCount;
    setSegs((ss) => replaceAll(ss, find, rep, matchCase));
    msg(tr("{0} kemunculan diganti.", n), n ? "success" : "warning");
  };
  const guessSpeakers = () => {
    if (!segments.length) return;
    setSpeakers((sp) => (sp.length >= 2 ? sp : [tr("Pembicara 1"), tr("Pembicara 2")]));
    setSegs((ss) => guessSpeakersByPauses(ss, pauseGap));
    msg(tr("Giliran bicara diperkirakan dari jeda — ini hanya tebakan, periksa & koreksi seperlunya."), "warning");
  };
  const addSpeaker = () => setSpeakers((sp) => [...sp, tr("Pembicara {0}", sp.length + 1)]);
  const removeSpeaker = (i: number) => {
    setSpeakers((sp) => sp.filter((_, j) => j !== i));
    setSegs((ss) => ss.map((s) => (s.speaker == null ? s : s.speaker === i ? { ...s, speaker: null } : s.speaker > i ? { ...s, speaker: s.speaker - 1 } : s)));
  };
  const makeSummary = () => {
    const s = extractiveSummary(paragraphs.map((p) => p.text).join(" "), summaryCount);
    setSummary(s);
    if (!s.length) msg(tr("Teks terlalu pendek untuk diringkas."), "warning");
  };

  /* ── export ── */
  const exportOpts = () => ({
    timestamps: expTime,
    speakers: expSpeakers,
    summary: expSummary && summary?.length ? summary : null,
    keywords: expKeywords && keywords.length ? keywords.map((k) => k.word) : null,
  });
  const fileBase = () => (meta.title.replace(/[\\/:*?"<>|]+/g, "_").trim() || "transkrip");

  const doExport = async (kind: "docx" | "pdf" | "txt" | "md" | "srt" | "vtt" | "json" | "csv") => {
    if (!segments.length) return msg(tr("Belum ada transkrip untuk diekspor."), "warning");
    setExporting(kind);
    setInfo(null);
    try {
      await new Promise((r) => setTimeout(r, 20));
      const o = exportOpts();
      const base = fileBase();
      if (kind === "docx") downloadBlob(await buildTranscriptDocx(meta, paragraphs, o), `${base}.docx`);
      else if (kind === "pdf") {
        if (hasNonLatin([meta.title, ...paragraphs.map((p) => p.text), ...speakers])) msg(tr("Catatan: PDF hanya mendukung aksara Latin — karakter lain diganti “?”. Gunakan DOCX untuk aksara non-Latin."), "warning");
        downloadBlob(await buildTranscriptPdf(meta, paragraphs, o), `${base}.pdf`);
      } else if (kind === "txt") downloadBlob(new Blob([exportTxt(meta, paragraphs, o)], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
      else if (kind === "md") downloadBlob(new Blob([exportMarkdown(meta, paragraphs, o)], { type: "text/markdown;charset=utf-8" }), `${base}.md`);
      else if (kind === "srt") downloadBlob(new Blob([exportSrt(segments)], { type: "application/x-subrip;charset=utf-8" }), `${base}.srt`);
      else if (kind === "vtt") downloadBlob(new Blob([exportVtt(segments)], { type: "text/vtt;charset=utf-8" }), `${base}.vtt`);
      else if (kind === "json") downloadBlob(new Blob([exportJson(meta, segments, paragraphs)], { type: "application/json" }), `${base}.json`);
      else downloadBlob(new Blob([exportCsv(meta, segments)], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
      if (kind !== "pdf" || !hasNonLatin([meta.title, ...paragraphs.map((p) => p.text)])) msg(tr("{0} berhasil diunduh.", kind.toUpperCase()), "success");
    } catch (e: any) {
      msg(tr("Ekspor gagal: {0}", e?.message ?? e), "error");
    } finally {
      setExporting(null);
    }
  };

  const copyText = async () => {
    try {
      if (!(await gamatoCopyText(exportClipboardText(meta, paragraphs, { timestamps: expTime, speakers: expSpeakers })))) throw new Error("clipboard");
      msg(tr("Transkrip disalin ke clipboard."), "success");
    } catch {
      msg(tr("Gagal menyalin — izin clipboard ditolak browser."), "error");
    }
  };

  const reset = () => {
    sessionRef.current?.terminate();
    history.reset([]);
    setSrc(null);
    setSpeakers([]);
    setSummary(null);
    setInfo(null);
    setRun({ stage: "idle" });
    setTitle(tr("Transkrip Audio"));
  };

  /* ───────────────────────────── render ───────────────────────────── */

  const hasContent = !!src || segments.length > 0;
  const etaText = run.stage === "transcribing" && run.eta != null ? `sisa ± ${run.eta < 90 ? `${Math.round(run.eta)} dtk` : `${Math.round(run.eta / 60)} mnt`}` : "";

  return (
    <div className="space-y-5" data-testid="transcript-root">
      <input ref={importRef} type="file" accept=".srt,.vtt,.txt,.md,text/plain" className="hidden" data-testid="import-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; importTranscript(f); }} />
      <input ref={openRef} type="file" accept="audio/*,video/*" className="hidden" data-testid="audio-file" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFiles([f]); }} />

      {!hasContent && (
        <div className="max-w-3xl mx-auto space-y-4" data-testid="transcript-empty">
          <Dropzone onFiles={onFiles} accept="audio/*,video/*" multiple={false} isDragging={isDragging} setIsDragging={setIsDragging} label={tr("Unggah audio atau video untuk ditranskrip")} sublabel={tr("MP3, WAV, M4A, OGG, FLAC, MP4 — rapat, wawancara, kuliah, podcast")} icon={<ScrollText className="w-8 h-8" />} />
          <div className="flex flex-wrap items-center justify-center gap-3">
            {recording != null ? (
              <Btn variant="danger" onClick={stopRecording} data-testid="rec-stop"><Square className="w-4 h-4" />{" "}{tr("Berhenti ({0}s)", recording.toFixed(0))}</Btn>
            ) : (
              <Btn variant="secondary" onClick={startRecording} data-testid="rec-start"><Mic className="w-4 h-4" /> {tr("Rekam dari mikrofon")}</Btn>
            )}
            <Btn variant="secondary" onClick={() => importRef.current?.click()} data-testid="btn-import"><FileUp className="w-4 h-4" /> {tr("Impor transkrip (.srt / .vtt / .txt)")}</Btn>
          </div>
          {mics.length > 1 && recording == null && <div className="max-w-xs mx-auto"><MediaDevicePicker label={tr("Mikrofon")} devices={mics} value={micId} onChange={setMicId} testId="mic-picker" /></div>}
          <GamatoPermissionNotice failure={micFail} onRetry={startRecording} onDismiss={() => setMicFail(null)} />
          {run.stage === "prepare" && <div className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300"><Loader2 className="w-4 h-4 animate-spin" />{run.msg}</div>}
          {run.stage === "error" && <GamatoInlineAlert tone="error" message={run.message} />}
          {info && <GamatoInlineAlert message={info.msg} tone={info.tone} />}
          <ToolInfoPanel
            icon={<ScrollText className="w-5 h-5" />}
            label={tr("Transkrip Audio")}
            desc={tr("Whisper AI berjalan di browser — audio tidak diunggah")}
            points={[
              tr("Hasil berformat: stempel waktu, pembicara, paragraf otomatis, kata kunci & ringkasan, dengan editor yang tersinkron ke pemutar audio."),
              tr("Ekspor DOCX, PDF, TXT, Markdown, SRT, VTT, JSON, dan CSV. Bisa juga mengimpor SRT/VTT/TXT yang sudah ada untuk dirapikan."),
              tr("Model AI (≈40–250 MB) diunduh sekali dari internet lalu disimpan di cache browser; transkripsi sendiri berjalan offline di perangkatmu."),
            ]}
          />
        </div>
      )}

      {hasContent && (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          {/* ───────── LEFT ───────── */}
          <div className="space-y-4 min-w-0">
            {/* source + player */}
            {src && (
              <div className={card} data-testid="source-card">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 p-2 rounded-xl shrink-0"><ScrollText className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate" data-testid="src-name">{src.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{tr("{0} · mono 16 kHz siap diproses", fmtTime(src.duration))}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Btn variant="ghost" className="text-xs py-1.5" onClick={() => openRef.current?.click()} disabled={running}>{tr("Ganti audio")}</Btn>
                    <Btn variant="ghost" className="text-xs py-1.5" onClick={reset} disabled={running} data-testid="btn-reset"><X className="w-3.5 h-3.5" /> {tr("Mulai baru")}</Btn>
                  </div>
                </div>
                {src.url && (
                  <div className="flex items-center gap-3">
                    <audio ref={audioRef} src={src.url} preload="metadata" className="hidden" data-testid="audio-el" />
                    <Btn variant="secondary" className="px-3 py-2" onClick={() => { const a = audioRef.current; if (!a) return; if (a.paused) a.play().catch(() => {}); else a.pause(); }} data-testid="btn-play">{isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</Btn>
                    <span className="font-mono text-xs text-slate-600 dark:text-slate-300 w-12 text-right" data-testid="cur-time">{fmtTime(curTime)}</span>
                    <div className="flex-1"><GamatoSlider min={0} max={Math.max(1, src.duration)} step={0.1} value={Math.min(curTime, src.duration)} onChange={(v) => { if (audioRef.current) { audioRef.current.currentTime = v; setCurTime(v); } }} aria-label={tr("Posisi audio")} /></div>
                    <span className="font-mono text-xs text-slate-400 w-12">{fmtTime(src.duration)}</span>
                    <GamatoSelect compact wrapperClassName="w-20" value={String(rate)} onChange={(e) => setRate(parseFloat(e.target.value))} aria-label={tr("Kecepatan putar")}>
                      {[0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={String(r)}>{tr("{0}×", r)}</option>)}
                    </GamatoSelect>
                  </div>
                )}
              </div>
            )}

            {/* engine */}
            {src?.audio16k && (
              <div className={card} data-testid="engine-card">
                <div className="flex items-center justify-between">
                  <p className={cap}>{tr("Mesin Transkripsi (Whisper)")}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Cpu className="w-3 h-3" /> {tr("berjalan di perangkatmu")}</span>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  <Select label={tr("Model")} value={model} onChange={(e) => setModel(e.target.value)} disabled={running} data-testid="asr-model">
                    {ASR_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.size}</option>)}
                  </Select>
                  <Select label={tr("Bahasa audio")} value={language} onChange={(e) => setLanguage(e.target.value)} disabled={running} data-testid="asr-lang">
                    {ASR_LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </Select>
                  <Select label="Tugas" value={task} onChange={(e) => setTask(e.target.value as typeof task)} disabled={running} data-testid="asr-task">
                    <option value="transcribe">{tr("Transkrip (bahasa asli)")}</option>
                    <option value="translate">{tr("Terjemahkan ke Inggris")}</option>
                  </Select>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{ASR_MODELS.find((m) => m.id === model)?.note} {tr("Unduhan pertama butuh internet; selanjutnya tersimpan di cache.")}</p>

                {run.stage === "idle" || run.stage === "error" ? (
                  <Btn className="w-full py-3.5 text-base bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700" onClick={startTranscription} data-testid="btn-transcribe">
                    <Sparkles className="w-4 h-4" /> {segments.length ? tr("Transkripsi ulang (ganti hasil)") : tr("Mulai Transkripsi")}
                  </Btn>
                ) : (
                  <div className="space-y-2" data-testid="run-progress">
                    <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-200">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {run.stage === "prepare" && run.msg}
                      {run.stage === "download" && tr("Mengunduh model… {0}%", Math.round(run.pct))}
                      {run.stage === "loading" && tr("Memuat model ke memori…")}
                      {run.stage === "transcribing" && tr("Mentranskrip bagian {0} / {1} {2}", Math.min(run.done + 1, run.total), run.total, etaText)}
                    </div>
                    <div className="h-2 rounded-full bg-indigo-100 dark:bg-indigo-900 overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all" style={{ width: `${run.stage === "download" ? run.pct : run.stage === "transcribing" ? (run.done / run.total) * 100 : run.stage === "loading" ? 100 : 5}%` }} />
                    </div>
                    <Btn variant="secondary" className="w-full text-xs" onClick={cancelTranscription} data-testid="btn-cancel"><X className="w-3.5 h-3.5" /> {tr("Batalkan")}</Btn>
                  </div>
                )}
                {run.stage === "error" && (
                  <div className="space-y-2" data-testid="run-error">
                    <GamatoInlineAlert tone="error" message={run.message} />
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {tr("Tanpa internet kamu tetap bisa menulis transkrip secara manual (tombol “Tambah segmen di posisi pemutar”) atau mengimpor SRT/VTT/TXT, lalu memformat & mengekspornya di sini.")}</p>
                  </div>
                )}
              </div>
            )}

            {run.stage === "prepare" && src && <div className="flex items-center gap-2 text-sm text-indigo-600"><Loader2 className="w-4 h-4 animate-spin" />{run.msg}</div>}
            {info && <GamatoInlineAlert message={info.msg} tone={info.tone} />}

            {/* transcript */}
            <div className={card} data-testid="transcript-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={() => { history.undo(); }} onRedo={() => { history.redo(); }} />
                  <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-semibold">
                    {(["segmen", "paragraf"] as const).map((v) => (
                      <button key={v} type="button" onClick={() => setView(v)} data-testid={`view-${v}`} className={cn("px-3 py-1.5", view === v ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300")}>{v === "segmen" ? tr("Segmen (edit)") : tr("Paragraf (baca)")}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <GamatoCheckbox checked={showTime} onChange={setShowTime} label={tr("Waktu")} testId="chk-time" />
                  <GamatoCheckbox checked={showSpeaker} onChange={setShowSpeaker} label={tr("Pembicara")} testId="chk-speaker" />
                  {hasAudio && <GamatoCheckbox checked={follow} onChange={setFollow} label={tr("Ikuti pemutaran")} />}
                </div>
              </div>

              {/* find / replace */}
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[140px]"><Input label={tr("Cari")} value={find} onChange={(e) => setFind(e.target.value)} placeholder={tr("kata…")} className="py-2" data-testid="find-input" /></div>
                <div className="flex-1 min-w-[140px]"><Input label={tr("Ganti dengan")} value={rep} onChange={(e) => setRep(e.target.value)} placeholder={tr("pengganti…")} className="py-2" data-testid="replace-input" /></div>
                <Btn variant="secondary" className="py-2 text-xs" onClick={applyReplace} disabled={!find || !matchCount} data-testid="btn-replace">{tr("Ganti semua")}{find ? ` (${matchCount})` : ""}</Btn>
                <div className="pb-2"><GamatoCheckbox checked={matchCase} onChange={setMatchCase} label={tr("Huruf besar/kecil")} /></div>
              </div>

              {segments.length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-400" data-testid="transcript-placeholder">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  {src ? tr("Belum ada transkrip. Tekan “Mulai Transkripsi”, atau tambah segmen manual.") : tr("Belum ada transkrip.")}
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Btn variant="secondary" className="text-xs py-1.5" onClick={addSegmentNow} data-testid="btn-add-seg"><Plus className="w-3.5 h-3.5" /> {tr("Tambah segmen di posisi pemutar")}</Btn>
                    <Btn variant="secondary" className="text-xs py-1.5" onClick={() => importRef.current?.click()}><FileUp className="w-3.5 h-3.5" /> {tr("Impor SRT/VTT/TXT")}</Btn>
                  </div>
                </div>
              ) : view === "segmen" ? (
                <>
                  <div ref={listRef} className="space-y-2 max-h-[560px] overflow-y-auto pr-1 relative" data-testid="seg-list">
                    {segments.map((s, i) => (
                      <SegmentRow key={s.id} seg={s} index={i} active={s.id === activeId} highlight={!!find && s.text.toLowerCase().includes(matchCase ? find : find.toLowerCase()) || (matchCase && !!find && s.text.includes(find))} speakers={speakers} hasAudio={hasAudio} showTime={showTime} showSpeaker={showSpeaker} isLast={i === segments.length - 1}
                        onText={onText} onSeek={seek} onSpeaker={onSpeaker} onSplit={onSplit} onMergeNext={onMergeNext} onDelete={onDelete} onAddAfter={onAddAfter} onSetStart={onSetStart} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="secondary" className="text-xs py-1.5" onClick={addSegmentNow} data-testid="btn-add-seg"><Plus className="w-3.5 h-3.5" /> {tr("Tambah segmen di posisi pemutar")}</Btn>
                    <Btn variant="secondary" className="text-xs py-1.5" onClick={() => importRef.current?.click()}><FileUp className="w-3.5 h-3.5" /> {tr("Impor SRT/VTT/TXT")}</Btn>
                  </div>
                </>
              ) : (
                <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1" data-testid="para-list">
                  {paragraphs.map((p, i) => (
                    <div key={i} className="text-sm leading-relaxed text-slate-800 dark:text-slate-100" data-testid="para">
                      {showTime && <button type="button" disabled={!hasAudio} onClick={() => seek(p.start)} className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 rounded-md px-2 py-0.5 mr-2 disabled:text-slate-400">{fmtTime(p.start)}</button>}
                      {showSpeaker && p.speaker != null && <span className={cn("text-[11px] font-bold rounded-md border px-1.5 py-0.5 mr-2", SPEAKER_STYLES[p.speaker % SPEAKER_STYLES.length])}>{speakers[p.speaker] ?? tr("Pembicara {0}", p.speaker + 1)}</span>}
                      <span>{p.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ───────── RIGHT ───────── */}
          <div className="space-y-4 min-w-0">
            <div className={card} data-testid="stats-card">
              <p className={cap}>{tr("Statistik")}</p>
              <div className="grid grid-cols-2 gap-2">
                {[[tr("Kata"), stats.words], [tr("Segmen"), stats.segments], [tr("Durasi"), fmtTime(duration)], [tr("Kata/menit"), stats.wpm]].map(([l, v]) => (
                  <div key={l as string} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-slate-900 dark:text-slate-100" data-testid={`stat-${l}`}>{v}</div>
                    <div className="text-[11px] text-slate-400">{l}</div>
                  </div>
                ))}
              </div>
              {stats.perSpeaker.filter((p) => p.speaker != null).length > 0 && (
                <div className="space-y-1.5">
                  {stats.perSpeaker.filter((p) => p.speaker != null).map((p) => {
                    const total = stats.perSpeaker.reduce((a, x) => a + x.seconds, 0) || 1;
                    return (
                      <div key={p.speaker} className="text-xs">
                        <div className="flex justify-between"><span className="font-semibold">{speakers[p.speaker!] ?? tr("Pembicara {0}", p.speaker! + 1)}</span><span className="text-slate-400">{tr("{0}% · {1} kata", Math.round((p.seconds / total) * 100), p.words)}</span></div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${(p.seconds / total) * 100}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={card} data-testid="format-card">
              <p className={cap}>{tr("Format & Rapikan")}</p>
              <div className="space-y-2">
                <GamatoCheckbox checked={fmt.removeFillers} onChange={(v) => setFmt((f) => ({ ...f, removeFillers: v }))} label={tr("Buang kata pengisi (eh, ehm, hmm, um…)")} testId="fmt-fillers" />
                <GamatoCheckbox checked={fmt.capitalize} onChange={(v) => setFmt((f) => ({ ...f, capitalize: v }))} label={tr("Huruf kapital di awal kalimat")} />
                <GamatoCheckbox checked={fmt.punctuate} onChange={(v) => setFmt((f) => ({ ...f, punctuate: v }))} label={tr("Tambah titik di akhir paragraf")} />
              </div>
              <Slider label={tr("Jeda pemisah paragraf")} value={fmt.paragraphGap} min={0.5} max={6} step={0.1} suffix={tr(" dtk")} onChange={(v) => setFmt((f) => ({ ...f, paragraphGap: v }))} />
              <Slider label={tr("Panjang paragraf (≈ karakter)")} value={fmt.paragraphMax} min={200} max={1500} step={50} onChange={(v) => setFmt((f) => ({ ...f, paragraphMax: v }))} />
              <p className="text-[11px] text-slate-400">{tr("Pengaturan di atas menentukan tampilan “Paragraf” dan hasil ekspor. Tombol di bawah mengubah teks segmen secara permanen (bisa di-undo).")}</p>
              <div className="grid grid-cols-1 gap-2">
                <Btn variant="secondary" className="text-xs py-2" onClick={applyCleanup} disabled={!segments.length} data-testid="btn-cleanup"><Wand2 className="w-3.5 h-3.5" /> {tr("Rapikan teks segmen")}</Btn>
                <div className="grid grid-cols-2 gap-2">
                  <Btn variant="secondary" className="text-xs py-2" onClick={applyMerge} disabled={!segments.length} data-testid="btn-merge-short">{tr("Gabung segmen pendek")}</Btn>
                  <Btn variant="secondary" className="text-xs py-2" onClick={applyDedupe} disabled={!segments.length}>{tr("Hapus pengulangan")}</Btn>
                </div>
              </div>
            </div>

            <div className={card} data-testid="speakers-card">
              <div className="flex items-center justify-between">
                <p className={cap}>{tr("Pembicara")}</p>
                <Btn variant="secondary" className="text-xs py-1" onClick={addSpeaker} data-testid="btn-add-speaker"><Plus className="w-3 h-3" /> {tr("Tambah")}</Btn>
              </div>
              {speakers.length === 0 && <p className="text-xs text-slate-400">{tr("Belum ada pembicara. Tambahkan, lalu pilih pembicara di tiap segmen.")}</p>}
              <div className="space-y-2">
                {speakers.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={cn("w-3 h-3 rounded-full border shrink-0", SPEAKER_STYLES[i % SPEAKER_STYLES.length])} />
                    <input value={s} onChange={(e) => setSpeakers((sp) => sp.map((x, j) => (j === i ? e.target.value : x)))} aria-label={tr("Nama pembicara {0}", i + 1)} data-testid="speaker-name" className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm" />
                    <button type="button" onClick={() => removeSpeaker(i)} className="text-slate-400 hover:text-red-500" aria-label={tr("Hapus pembicara")}><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                <Slider label={tr("Jeda dianggap ganti pembicara")} value={pauseGap} min={0.5} max={8} step={0.5} suffix={tr(" dtk")} onChange={setPauseGap} />
                <Btn variant="secondary" className="w-full text-xs py-2" onClick={guessSpeakers} disabled={!segments.length} data-testid="btn-guess-speakers"><Users className="w-3.5 h-3.5" /> {tr("Tebak giliran bicara dari jeda")}</Btn>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {tr("Ini perkiraan sederhana (2 pembicara bergantian), bukan pengenalan suara. Koreksi manual di tiap segmen.")}</p>
              </div>
            </div>

            <div className={card} data-testid="summary-card">
              <p className={cap}>{tr("Ringkasan & Kata Kunci")}</p>
              {keywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5" data-testid="keywords">
                  {keywords.map((k) => (
                    <button key={k.word} type="button" onClick={() => setFind(k.word)} title={tr("Cari kata ini")} className="text-xs font-semibold rounded-full px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                      {k.word} <span className="text-slate-400">{k.count}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">{tr("Kata kunci muncul setelah ada transkrip.")}</p>}
              <Slider label={tr("Jumlah poin ringkasan")} value={summaryCount} min={2} max={12} onChange={setSummaryCount} />
              <Btn variant="secondary" className="w-full text-xs py-2" onClick={makeSummary} disabled={!segments.length} data-testid="btn-summary"><Sparkles className="w-3.5 h-3.5" /> {tr("Buat ringkasan")}</Btn>
              {summary && summary.length > 0 && (
                <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-200 list-disc pl-5" data-testid="summary-list">
                  {summary.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}
              <p className="text-[11px] text-slate-400">{tr("Ringkasan bersifat ekstraktif (memilih kalimat terpenting), bukan hasil AI generatif.")}</p>
            </div>

            <div className={card} data-testid="export-card">
              <p className={cap}>{tr("Ekspor")}</p>
              <Input label={tr("Judul dokumen")} value={title} onChange={(e) => setTitle(e.target.value)} data-testid="doc-title" />
              <div className="grid grid-cols-2 gap-2">
                <GamatoCheckbox checked={expTime} onChange={setExpTime} label={tr("Stempel waktu")} testId="exp-time" />
                <GamatoCheckbox checked={expSpeakers} onChange={setExpSpeakers} label={tr("Nama pembicara")} testId="exp-speakers" />
                <GamatoCheckbox checked={expSummary} onChange={setExpSummary} label={tr("Sertakan ringkasan")} testId="exp-summary" />
                <GamatoCheckbox checked={expKeywords} onChange={setExpKeywords} label={tr("Sertakan kata kunci")} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Btn className="text-xs py-2.5" onClick={() => doExport("docx")} disabled={!segments.length || !!exporting} data-testid="exp-docx">{exporting === "docx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} {tr("Word (.docx)")}</Btn>
                <Btn className="text-xs py-2.5" onClick={() => doExport("pdf")} disabled={!segments.length || !!exporting} data-testid="exp-pdf">{exporting === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} {tr("PDF")}</Btn>
                {([["txt", tr("Teks (.txt)")], ["md", tr("Markdown (.md)")], ["srt", tr("Subtitle (.srt)")], ["vtt", tr("WebVTT (.vtt)")], ["json", "JSON"], ["csv", tr("CSV / Excel")]] as const).map(([k, l]) => (
                  <Btn key={k} variant="secondary" className="text-xs py-2.5" onClick={() => doExport(k)} disabled={!segments.length || !!exporting} data-testid={`exp-${k}`}><Download className="w-3.5 h-3.5" /> {l}</Btn>
                ))}
                <Btn variant="secondary" className="col-span-2 text-xs py-2.5" onClick={copyText} disabled={!segments.length} data-testid="exp-copy"><Copy className="w-3.5 h-3.5" /> {tr("Salin teks ke clipboard")}</Btn>
              </div>
              <p className="text-[11px] text-slate-400 flex gap-1"><ChevronDown className="w-3 h-3 shrink-0 mt-0.5 rotate-[-90deg]" /> {tr("SRT/VTT/CSV memakai segmen apa adanya; DOCX/PDF/TXT/MD memakai format paragraf di atas.")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
