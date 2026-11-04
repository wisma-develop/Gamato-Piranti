import { useEffect, useState } from "react";
import { Film, Info } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  CONTAINER_META,
  getStoredContainer,
  probeContainer,
  storeContainer,
  type ContainerCapability,
  type VideoContainerChoice,
} from "@/lib/videoContainer";

const ORDER: { id: VideoContainerChoice; label: string; sub: string }[] = [
  { id: "mp4", label: "MP4", sub: "Universal" },
  { id: "mov", label: "MOV", sub: "QuickTime" },
  { id: "webm", label: "WebM", sub: "Web ringan" },
  { id: "asli", label: "Asli", sub: "Tanpa kemas ulang" },
];

/** Hook kecil: pilihan format keluaran yang diingat antar-sesi dan dipakai bersama semua alat Video. */
export function useVideoContainerChoice(): [VideoContainerChoice, (v: VideoContainerChoice) => void] {
  const [choice, setChoice] = useState<VideoContainerChoice>(() => getStoredContainer());
  const set = (v: VideoContainerChoice) => {
    setChoice(v);
    storeContainer(v);
  };
  return [choice, set];
}

/**
 * VideoContainerPicker — pemilih format hasil (MP4 / MOV / WebM) yang SAMA di semua alat Video.
 * MP4 & MOV selalu tersedia, apa pun browsernya; keterangan di bawah memberi tahu kodek apa yang akan dipakai.
 */
export function VideoContainerPicker({
  value,
  onChange,
  disabled,
}: {
  value: VideoContainerChoice;
  onChange: (v: VideoContainerChoice) => void;
  disabled?: boolean;
}) {
  const [cap, setCap] = useState<ContainerCapability | null>(null);

  useEffect(() => {
    let alive = true;
    setCap(null);
    if (value === "asli") return;
    probeContainer(value)
      .then((c) => alive && setCap(c))
      .catch(() => alive && setCap(null));
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
        <Film className="w-3.5 h-3.5 text-indigo-500" /> Format Hasil
      </p>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Format hasil video">
        {ORDER.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded-xl border-2 px-1.5 py-2 text-center transition-all disabled:opacity-50",
              value === o.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            <span className={cn("block text-xs font-bold", value === o.id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200")}>{o.label}</span>
            <span className="block text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">{o.sub}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 leading-snug">
        <Info className="w-3 h-3 mt-0.5 shrink-0" />
        <span>
          {value === "asli"
            ? "Format bawaan perekam browser (WebM, atau MP4 bila didukung). Paling cepat, tanpa langkah kemas ulang."
            : `${CONTAINER_META[value].hint}${cap ? ` Kodek di browser ini: ${cap.summary}.` : ""}`}
        </span>
      </p>
    </div>
  );
}
