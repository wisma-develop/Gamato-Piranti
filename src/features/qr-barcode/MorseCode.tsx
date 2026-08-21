import React, { useEffect, useMemo, useState } from "react";
import { Radio, Copy, Download } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { textToMorse, morseToText, morseToWavBlob } from "@/lib/morse";
import { Textarea, Btn, Label } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoAudioPlayer } from "@/components/ui/GamatoAudioPlayer";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const MorseCode: React.FC = () => {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState("SOS GAMATO PIRANTI");
  const [wpm, setWpm] = useState(18);
  const [freq, setFreq] = useState(700);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const output = useMemo(() => (mode === "encode" ? textToMorse(input) : morseToText(input)), [mode, input]);

  useEffect(() => {
    if (mode !== "encode" || !output.trim()) {
      setAudioBlob(null);
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const blob = morseToWavBlob(output, { wpm, freq });
    setAudioBlob(blob);
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [output, wpm, freq, mode]);

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setInfo("Hasil disalin ke clipboard.");
    } catch {
      setInfo("Gagal menyalin.");
    }
  };

  const downloadAudio = () => {
    if (!audioBlob) return;
    downloadBlob(audioBlob, "gamato-kode-morse.wav");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {([
            ["encode", "Teks → Morse"],
            ["decode", "Morse → Teks"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                setInput(id === "encode" ? "SOS GAMATO PIRANTI" : "... --- ... / --. .- -- .- - ---");
              }}
              className={cn(
                "rounded-2xl border-2 p-4 text-center font-semibold transition-all",
                mode === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <Textarea
            label={mode === "encode" ? "Teks" : "Kode Morse (titik . dan strip -, pisahkan huruf dengan spasi, kata dengan /)"}
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={mode === "decode" ? "font-mono" : undefined}
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>{mode === "encode" ? "Hasil Morse" : "Hasil Teks"}</Label>
              <button type="button" onClick={copyOutput} disabled={!output} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-40">
                <Copy className="w-3.5 h-3.5" /> Salin
              </button>
            </div>
            <div className={cn("w-full min-h-[4rem] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-800 dark:text-slate-100 break-words", mode === "encode" && "font-mono tracking-widest text-base")}>
              {output || "—"}
            </div>
          </div>
        </div>

        {mode === "encode" && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Audio Kode Morse</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label>Kecepatan (WPM)</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{wpm}</span>
                </div>
                <GamatoSlider min={5} max={40} value={wpm} onChange={setWpm} aria-label="Kecepatan WPM" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label>Nada (Hz)</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{freq}</span>
                </div>
                <GamatoSlider min={300} max={1200} step={10} value={freq} onChange={setFreq} aria-label="Nada Hz" />
              </div>
            </div>
            {audioUrl && <GamatoAudioPlayer src={audioUrl} label="Audio Kode Morse" />}
            <Btn onClick={downloadAudio} disabled={!audioBlob} className="w-full py-3.5 gap-2">
              <Download className="w-4 h-4" /> Unduh Audio (.wav)
            </Btn>
          </div>
        )}

        {info && <div className="text-sm rounded-xl px-4 py-3 border font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30">{info}</div>}
      </div>

      <ToolInfoPanel
        icon={<Radio className="w-5 h-5" />}
        label="Kode Morse"
        desc="Teks ↔ Morse + audio"
        points={[
          "Mendukung huruf A-Z, angka 0-9, dan tanda baca umum.",
          "Audio dibuat langsung di browser (nada beep sesuai standar timing Morse) dan bisa diunduh sebagai .wav.",
          "Atur WPM (kecepatan) dan nada sesuai kebutuhan latihan atau sinyal.",
        ]}
      />
    </div>
  );
};
