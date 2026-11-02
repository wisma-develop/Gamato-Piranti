import { useState } from "react";
import { Music2, Info } from "lucide-react";
import { cn } from "@/utils/cn";
import { MP3_BITRATES } from "@/lib/mp3Encoder";

export type AudioOutChoice = { format: "mp3" | "asli"; kbps: number };

const KEY = "gamato.audio.out";

export function useAudioOutChoice(): [AudioOutChoice, (c: AudioOutChoice) => void] {
  const [choice, setChoice] = useState<AudioOutChoice>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (raw && (raw.format === "mp3" || raw.format === "asli") && MP3_BITRATES.includes(raw.kbps)) return raw;
    } catch {
      /* abaikan */
    }
    return { format: "mp3", kbps: 192 };
  });
  const set = (c: AudioOutChoice) => {
    setChoice(c);
    try {
      localStorage.setItem(KEY, JSON.stringify(c));
    } catch {
      /* abaikan */
    }
  };
  return [choice, set];
}

/** Pemilih format audio keluaran: MP3 (universal, selalu tersedia) atau format asli perekam browser. */
export function AudioFormatPicker({ value, onChange, disabled, nativeLabel, nativeTitle }: { value: AudioOutChoice; onChange: (c: AudioOutChoice) => void; disabled?: boolean; nativeLabel?: string; nativeTitle?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
        <Music2 className="w-3.5 h-3.5 text-indigo-500" /> Format Audio
      </p>
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Format audio">
        {([["mp3", "MP3", "Universal — semua perangkat"], ["asli", nativeTitle ?? "Asli", nativeLabel ?? "Format bawaan browser"]] as const).map(([id, label, sub]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value.format === id}
            disabled={disabled}
            onClick={() => onChange({ ...value, format: id })}
            className={cn(
              "rounded-xl border-2 px-2 py-2 text-center transition-all disabled:opacity-50",
              value.format === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
            )}
          >
            <span className={cn("block text-xs font-bold", value.format === id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200")}>{label}</span>
            <span className="block text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">{sub}</span>
          </button>
        ))}
      </div>
      {value.format === "mp3" && (
        <div className="flex items-center gap-2">
          <label htmlFor="audio-mp3-kbps" className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">Bitrate</label>
          <select
            id="audio-mp3-kbps"
            value={value.kbps}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, kbps: parseInt(e.target.value) })}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-800 dark:text-slate-100"
          >
            {MP3_BITRATES.map((k) => (
              <option key={k} value={k}>
                {k} kbps{k === 128 ? " (standar)" : k === 192 ? " (seimbang)" : k === 320 ? " (maksimum)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 leading-snug">
        <Info className="w-3 h-3 mt-0.5 shrink-0" />
        <span>{value.format === "mp3" ? "Di-encode langsung di browser (cepat, tanpa upload). MP3 diputar di hampir semua perangkat." : "Tanpa encode MP3: memakai perekam browser secara real-time, hasilnya WebM/Ogg Opus."}</span>
      </p>
    </div>
  );
}
