import React, { useState } from "react";
import { Volume2, Play, Pause, Square, VolumeX } from "lucide-react";
import { Select, Label, Textarea, Btn } from "@/components/ui/primitives";
import { useTextToSpeech } from "@/lib/useTextToSpeech";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const TextToSpeech: React.FC = () => {
  const { supported, voices, isSpeaking, isPaused, speak, pause, resume, stop } = useTextToSpeech();
  const [text, setText] = useState("Halo! Ini contoh teks yang akan dibacakan oleh Gamato Piranti.");
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);

  const effectiveVoiceURI = voiceURI || voices.find((v) => v.lang?.startsWith("id"))?.voiceURI || voices[0]?.voiceURI || "";

  if (!supported) {
    return (
      <div className="max-w-xl mx-auto bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-6 text-center space-y-2">
        <VolumeX className="w-8 h-8 mx-auto text-amber-500" />
        <p className="font-bold text-amber-700 dark:text-amber-400">Browser ini belum mendukung Text to Speech</p>
        <p className="text-sm text-amber-600 dark:text-amber-400">Coba buka dengan browser modern seperti Chrome, Edge, Firefox, atau Safari terbaru.</p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <Textarea label="Teks yang akan dibacakan" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis atau tempel teks di sini…" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <Select label="Suara" value={effectiveVoiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </Select>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Kecepatan</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{rate.toFixed(1)}x</span>
            </div>
            <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Nada (Pitch)</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{pitch.toFixed(1)}</span>
            </div>
            <input type="range" min={0} max={2} step={0.1} value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Volume</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(volume * 100)}%</span>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>

        <div className="flex gap-3">
          {!isSpeaking ? (
            <Btn onClick={() => speak(text, { voiceURI: effectiveVoiceURI, rate, pitch, volume })} disabled={!text.trim()} className="flex-1 py-4 gap-2">
              <Play className="w-4 h-4" /> Putar
            </Btn>
          ) : (
            <Btn onClick={isPaused ? resume : pause} className="flex-1 py-4 gap-2">
              {isPaused ? (
                <>
                  <Play className="w-4 h-4" /> Lanjutkan
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" /> Jeda
                </>
              )}
            </Btn>
          )}
          <Btn onClick={stop} disabled={!isSpeaking} variant="secondary" className="gap-2">
            <Square className="w-4 h-4" /> Stop
          </Btn>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 px-1">
          Catatan: audio hanya diputar langsung di perangkatmu — browser tidak menyediakan cara untuk merekam hasil Text-to-Speech menjadi file audio yang bisa diunduh.
        </p>
      </div>

      <ToolInfoPanel
        icon={<Volume2 className="w-5 h-5" />}
        label="Text to Speech"
        desc="Teks dibacakan otomatis"
        points={["Pilih suara sesuai bahasa teksmu untuk hasil pelafalan terbaik.", "Atur kecepatan, nada, dan volume sesuai kebutuhan."]}
      />
    </div>
  );
};
