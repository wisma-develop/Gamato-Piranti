import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Radio, Copy, Download, Lightbulb, Square, Maximize2, Eraser, Hand } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { encodeMorse, decodeMorse, morseToWavBlob, morseSegments, morseDurationSeconds, morseReference, MORSE_MAP } from "@/lib/morse";
import { Textarea, Btn, Label } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoAudioPlayer } from "@/components/ui/GamatoAudioPlayer";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { copyText } from "@/lib/permissions";
import { tr } from "@/i18n";

type Mode = "encode" | "decode" | "practice";
const SAMPLE_ENCODE = "SOS GAMATO PIRANTI";
const SAMPLE_DECODE = "... --- ... / --. .- -- .- - ---";
const MAX_AUDIO_SECONDS = 600;
const REVERSE: Record<string, string> = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));

const fmtDuration = (s: number) => (s < 60 ? `${s.toFixed(1)} ${tr("dtk")}` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")} ${tr("mnt")}`);

function SliderRow({ label, value, unit = "", min, max, step = 1, onChange }: { label: string; value: number; unit?: string; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <Label>{label}</Label>
        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{value}{unit}</span>
      </div>
      <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
    </div>
  );
}

const modeCard = (active: boolean) =>
  cn("rounded-2xl border-2 p-4 text-center font-semibold transition-all flex items-center justify-center gap-2",
    active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300");

export const MorseCode: React.FC = () => {
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState(SAMPLE_ENCODE);
  const [wpm, setWpm] = useState(18);
  const [farns, setFarns] = useState(18);
  const [freq, setFreq] = useState(700);
  const [volume, setVolume] = useState(60);
  const [dotStyle, setDotStyle] = useState<"ascii" | "dots">("ascii");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<{ tone: "success" | "warning"; text: string } | null>(null);

  const farnsEff = Math.min(farns, wpm);
  const encoded = useMemo(() => encodeMorse(input), [input]);
  const decoded = useMemo(() => decodeMorse(input), [input]);
  const rawOutput = mode === "encode" ? encoded.morse : mode === "decode" ? decoded.text : "";
  const output = mode === "encode" && dotStyle === "dots" ? rawOutput.replace(/\./g, "•").replace(/-/g, "—") : rawOutput;
  const morseForAudio = mode === "encode" ? encoded.morse : "";
  const duration = useMemo(() => (morseForAudio ? morseDurationSeconds(morseForAudio, { wpm, farnsworth: farnsEff }) : 0), [morseForAudio, wpm, farnsEff]);
  const tooLong = duration > MAX_AUDIO_SECONDS;

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    // Teks pengguna tidak ditimpa: pindah arah membawa hasil terjemahan sebagai masukan baru.
    if (next !== "practice" && mode !== "practice") setInput(rawOutput.trim() ? rawOutput : next === "encode" ? SAMPLE_ENCODE : SAMPLE_DECODE);
    else if (next !== "practice") setInput(next === "encode" ? SAMPLE_ENCODE : SAMPLE_DECODE);
    stopLamp();
    setInfo(null);
    setMode(next);
  };

  // ── Audio WAV ──
  useEffect(() => {
    if (mode !== "encode" || !morseForAudio.trim() || tooLong) {
      setAudioBlob(null);
      setAudioUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      return;
    }
    const blob = morseToWavBlob(morseForAudio, { wpm, farnsworth: farnsEff, freq, volume: volume / 100 });
    setAudioBlob(blob);
    setAudioUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morseForAudio, wpm, farnsEff, freq, volume, mode, tooLong]);
  useEffect(() => () => { setAudioUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; }); }, []);

  const copyOutput = async () => {
    if (await copyText(output).catch(() => false)) setInfo({ tone: "success", text: tr("Hasil disalin ke clipboard.") });
    else setInfo({ tone: "warning", text: tr("Gagal menyalin.") });
  };

  // ── Cahaya kedip + bunyi langsung ──
  const [lampOn, setLampOn] = useState(false);
  const [lampRunning, setLampRunning] = useState(false);
  const [lampSound, setLampSound] = useState(true);
  const lampTimers = useRef<number[]>([]);
  const lampBoxRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);

  const getCtx = useCallback(() => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!audioCtxRef.current) audioCtxRef.current = new AC();
    if (audioCtxRef.current.state === "suspended") void audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);
  const toneOn = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || oscRef.current) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume / 100 * 0.5), ctx.currentTime + 0.005);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    oscRef.current = { osc, gain };
  }, [freq, volume, getCtx]);
  const toneOff = useCallback(() => {
    const cur = oscRef.current;
    const ctx = audioCtxRef.current;
    if (!cur || !ctx) return;
    cur.gain.gain.cancelScheduledValues(ctx.currentTime);
    cur.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.004);
    cur.osc.stop(ctx.currentTime + 0.03);
    oscRef.current = null;
  }, []);

  function stopLamp() {
    lampTimers.current.forEach((t) => window.clearTimeout(t));
    lampTimers.current = [];
    setLampOn(false);
    setLampRunning(false);
    toneOff();
  }
  const playLamp = () => {
    if (!morseForAudio.trim() || tooLong) return;
    stopLamp();
    const segs = morseSegments(morseForAudio, { wpm, farnsworth: farnsEff });
    let t = 0;
    setLampRunning(true);
    for (const seg of segs) {
      if (seg.on) {
        lampTimers.current.push(window.setTimeout(() => { setLampOn(true); if (lampSound) toneOn(); }, t * 1000));
        lampTimers.current.push(window.setTimeout(() => { setLampOn(false); toneOff(); }, (t + seg.duration) * 1000));
      }
      t += seg.duration;
    }
    lampTimers.current.push(window.setTimeout(() => stopLamp(), t * 1000 + 150));
  };
  useEffect(() => () => {
    lampTimers.current.forEach((t) => window.clearTimeout(t));
    toneOff();
    void audioCtxRef.current?.close().catch(() => undefined);
  }, [toneOff]);
  const fullscreenLamp = () => { void lampBoxRef.current?.requestFullscreen?.().catch(() => undefined); };

  // ── Latihan ketuk (keyer) ──
  const [practiceWpm, setPracticeWpm] = useState(12);
  const [keyDown, setKeyDown] = useState(false);
  const [pattern, setPattern] = useState("");
  const [keyedMorse, setKeyedMorse] = useState("");
  const [keyedText, setKeyedText] = useState("");
  const [keyerSound, setKeyerSound] = useState(true);
  const pressAt = useRef(0);
  const patternRef = useRef("");
  const letterTimer = useRef<number | null>(null);
  const wordTimer = useRef<number | null>(null);
  const unitMs = 1200 / practiceWpm;

  const commitLetter = useCallback(() => {
    const pat = patternRef.current;
    if (!pat) return;
    patternRef.current = "";
    setPattern("");
    const ch = REVERSE[pat] ?? "?";
    setKeyedText((s) => s + ch);
    setKeyedMorse((s) => (s ? s + " " : "") + pat);
  }, []);
  const clearTimers = () => {
    if (letterTimer.current) window.clearTimeout(letterTimer.current);
    if (wordTimer.current) window.clearTimeout(wordTimer.current);
    letterTimer.current = wordTimer.current = null;
  };
  const press = () => {
    if (pressAt.current) return;
    clearTimers();
    pressAt.current = performance.now();
    setKeyDown(true);
    if (keyerSound) toneOn();
  };
  const release = () => {
    if (!pressAt.current) return;
    const held = performance.now() - pressAt.current;
    pressAt.current = 0;
    setKeyDown(false);
    toneOff();
    const sym = held < unitMs * 2 ? "." : "-";
    patternRef.current += sym;
    setPattern(patternRef.current);
    // Jeda > 2 unit = huruf selesai; > 5 unit = pergantian kata (selaras timing Morse standar 3 & 7 unit).
    letterTimer.current = window.setTimeout(commitLetter, unitMs * 2);
    wordTimer.current = window.setTimeout(() => {
      setKeyedText((s) => (s && !s.endsWith(" ") ? s + " " : s));
      setKeyedMorse((s) => (s && !s.endsWith("/") ? s + " /" : s));
    }, unitMs * 5);
  };
  useEffect(() => () => clearTimers(), []);
  const resetKeyer = () => { clearTimers(); patternRef.current = ""; setPattern(""); setKeyedMorse(""); setKeyedText(""); };

  const reference = useMemo(() => morseReference(), []);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3" role="tablist" aria-label={tr("Mode Morse")}>
          {([
            ["encode", tr("Teks → Morse")],
            ["decode", tr("Morse → Teks")],
            ["practice", tr("Latihan Ketuk")],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} data-testid={`morse-mode-${id}`} onClick={() => switchMode(id)} className={modeCard(mode === id)}>
              {id === "practice" && <Hand className="w-4 h-4 shrink-0" />}
              <span className="text-sm sm:text-base">{label}</span>
            </button>
          ))}
        </div>

        {mode !== "practice" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <Textarea
              id="morse-input"
              label={mode === "encode" ? tr("Teks (prosign ditulis <AR>, <SK>, <SOS>)") : tr("Kode Morse (titik . dan strip -, pisahkan huruf dengan spasi, kata dengan /)")}
              rows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={mode === "decode" ? "font-mono" : undefined}
            />

            {mode === "encode" && encoded.skipped.length > 0 && (
              <GamatoInlineAlert tone="warning" message={tr("Karakter ini tidak punya padanan Morse dan dilewati: {0}", encoded.skipped.join(" "))} />
            )}
            {mode === "decode" && decoded.unknown.length > 0 && (
              <GamatoInlineAlert tone="warning" message={tr("Kode tidak dikenali (ditulis sebagai ?): {0}", decoded.unknown.join("  "))} />
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5 gap-3">
                <Label>{mode === "encode" ? tr("Hasil Morse") : tr("Hasil Teks")}</Label>
                <div className="flex items-center gap-3">
                  {mode === "encode" && (
                    <div className="flex gap-1" role="group" aria-label={tr("Gaya simbol")}>
                      {([["ascii", ". -"], ["dots", "• —"]] as const).map(([id, l]) => (
                        <button key={id} type="button" onClick={() => setDotStyle(id)} aria-pressed={dotStyle === id}
                          className={cn("px-2 py-1 rounded-lg text-xs font-mono font-bold border", dotStyle === id ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 dark:border-slate-700 text-slate-500")}>{l}</button>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={copyOutput} disabled={!output} data-testid="morse-copy" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-40">
                    <Copy className="w-3.5 h-3.5" /> {tr("Salin")}
                  </button>
                </div>
              </div>
              <div data-testid="morse-output" aria-live="polite" className={cn("w-full min-h-[4rem] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 break-words", mode === "encode" && "font-mono tracking-widest text-base")}>
                {output || "—"}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                {mode === "encode" ? tr("{0} karakter · {1} sandi Morse", input.length, rawOutput.replace(/[\s/]/g, "").length) : tr("{0} karakter terbaca", decoded.text.length)}
              </p>
            </div>
          </div>
        )}

        {mode === "encode" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Audio & Sinyal Cahaya")}</p>
              {duration > 0 && <span className="text-xs font-semibold text-slate-500 dark:text-slate-400" data-testid="morse-duration">{tr("Durasi ±{0}", fmtDuration(duration))}</span>}
            </div>
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
              <SliderRow label={tr("Kecepatan karakter (WPM)")} value={wpm} min={5} max={40} onChange={(v) => { setWpm(v); if (farns > v || farns === wpm) setFarns(v); }} />
              <SliderRow label={tr("Kecepatan efektif / Farnsworth (WPM)")} value={farnsEff} min={3} max={wpm} onChange={setFarns} />
              <SliderRow label={tr("Nada (Hz)")} value={freq} min={300} max={1200} step={10} onChange={setFreq} />
              <SliderRow label={tr("Volume")} value={volume} unit="%" min={10} max={100} step={5} onChange={setVolume} />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{tr("Farnsworth: huruf tetap dibunyikan cepat, tetapi jeda antar huruf & kata diregangkan — cara standar untuk belajar Morse.")}</p>
            {tooLong && <GamatoInlineAlert tone="warning" message={tr("Teks terlalu panjang untuk dijadikan audio (maks. {0} menit). Pendekkan teks atau naikkan kecepatan.", MAX_AUDIO_SECONDS / 60)} />}
            {audioUrl && <GamatoAudioPlayer src={audioUrl} label={tr("Audio Kode Morse")} />}
            <Btn onClick={() => audioBlob && downloadBlob(audioBlob, "gamato-kode-morse.wav")} disabled={!audioBlob} data-testid="morse-download" className="w-full py-3.5 gap-2">
              <Download className="w-4 h-4" /> {tr("Unduh Audio (.wav)")}
            </Btn>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Lampu Sinyal")}</p>
              <div ref={lampBoxRef} className="flex flex-col items-center gap-3 rounded-2xl bg-slate-900 p-5 [&:fullscreen]:justify-center [&:fullscreen]:min-h-screen" data-testid="morse-lamp-box">
                <div data-testid="morse-lamp" data-on={lampOn ? "1" : "0"} aria-hidden="true" className="h-24 w-24 rounded-full border-4 border-slate-700 transition-colors duration-75"
                  style={{ backgroundColor: lampOn ? "#fde047" : "#1e293b", boxShadow: lampOn ? "0 0 60px 20px rgba(253,224,71,.55)" : "none" }} />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {!lampRunning
                    ? <Btn onClick={playLamp} disabled={!morseForAudio.trim() || tooLong} data-testid="morse-lamp-play" className="gap-2"><Lightbulb className="w-4 h-4" />{tr("Putar Cahaya")}</Btn>
                    : <Btn onClick={stopLamp} variant="secondary" data-testid="morse-lamp-stop" className="gap-2"><Square className="w-4 h-4" />{tr("Berhenti")}</Btn>}
                  <Btn onClick={fullscreenLamp} variant="secondary" className="gap-2" aria-label={tr("Layar penuh")}><Maximize2 className="w-4 h-4" /></Btn>
                </div>
              </div>
              <GamatoCheckbox checked={lampSound} onChange={setLampSound} label={tr("Ikut bunyikan nada saat lampu menyala")} testId="morse-lamp-sound" />
            </div>
          </div>
        )}

        {mode === "practice" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Kunci Morse")}</p>
            <SliderRow label={tr("Kecepatan (WPM)")} value={practiceWpm} min={5} max={30} onChange={setPracticeWpm} />
            <button
              type="button"
              data-testid="morse-key"
              aria-pressed={keyDown}
              aria-label={tr("Kunci Morse — tahan sebentar untuk titik, lebih lama untuk strip")}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); press(); }}
              onPointerUp={release}
              onPointerCancel={release}
              onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); press(); } }}
              onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); release(); } }}
              className={cn("w-full select-none touch-none rounded-2xl border-2 py-10 text-lg font-bold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-400/40",
                keyDown ? "border-amber-500 bg-amber-400 text-slate-900" : "border-indigo-300 dark:border-indigo-500/40 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300")}
            >
              {keyDown ? tr("● Menekan…") : tr("Tahan di sini (atau tekan Spasi)")}
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400">{tr("Tekan singkat = titik (·), tekan lebih lama = strip (−). Jeda ±2 unit mengakhiri huruf, jeda ±5 unit memulai kata baru. 1 unit = {0} md pada kecepatan ini.", Math.round(unitMs))}</p>
            <GamatoCheckbox checked={keyerSound} onChange={setKeyerSound} label={tr("Bunyikan nada saat menekan")} testId="morse-keyer-sound" />

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tr("Huruf berjalan")}</p>
                <p className="font-mono text-xl tracking-widest min-h-[2rem] text-slate-800 dark:text-slate-100" data-testid="morse-pattern">{pattern || "·"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{tr("Kode Morse")}</p>
                <p className="font-mono text-base tracking-widest min-h-[2rem] break-all text-slate-800 dark:text-slate-100" data-testid="morse-keyed-morse">{keyedMorse || "—"}</p>
              </div>
            </div>
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">{tr("Teks")}</p>
              <p className="text-2xl font-bold min-h-[2.5rem] break-all text-indigo-900 dark:text-indigo-100" data-testid="morse-keyed-text" aria-live="polite">{keyedText || "—"}</p>
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => { commitLetter(); }} className="gap-2" data-testid="morse-commit">{tr("Akhiri huruf")}</Btn>
              <Btn variant="secondary" onClick={() => void copyText(keyedText)} disabled={!keyedText} className="gap-2"><Copy className="w-4 h-4" />{tr("Salin Teks")}</Btn>
              <Btn variant="secondary" onClick={resetKeyer} className="gap-2" data-testid="morse-reset"><Eraser className="w-4 h-4" />{tr("Hapus")}</Btn>
            </div>
          </div>
        )}

        {info && <GamatoInlineAlert message={info.text} tone={info.tone} />}

        <details className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm group" data-testid="morse-reference">
          <summary className="cursor-pointer px-5 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
            {tr("Tabel Referensi Kode Morse")}
            <span className="text-xs font-normal text-slate-400 group-open:hidden">{tr("Buka")}</span>
          </summary>
          <div className="px-5 pb-5 space-y-4">
            {reference.map((g) => (
              <div key={g.group}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{g.group === "Tanda baca" ? tr("Tanda baca") : g.group}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {g.items.map(([ch, code]) => (
                    <div key={ch} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{ch}</span>
                      <span className="font-mono tracking-widest text-slate-500 dark:text-slate-300">{code}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>

      <ToolInfoPanel
        icon={<Radio className="w-5 h-5" />}
        label={tr("Kode Morse")}
        desc={tr("Teks ↔ Morse + audio")}
        points={[
          tr("Mendukung huruf A-Z (huruf beraksen otomatis disederhanakan), angka 0-9, tanda baca umum, dan prosign seperti <AR>, <SK>, <SOS>."),
          tr("Karakter yang tak bisa dikodekan dan kode Morse yang tak dikenal selalu dilaporkan — tidak pernah dibuang diam-diam."),
          tr("Audio dibuat langsung di browser (timing standar PARIS, opsi Farnsworth) dan bisa diunduh sebagai .wav; ada juga lampu sinyal dan mode Latihan Ketuk."),
        ]}
      />
    </div>
  );
};
