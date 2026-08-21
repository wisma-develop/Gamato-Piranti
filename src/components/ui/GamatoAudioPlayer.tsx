import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Music2 } from "lucide-react";
import { cn } from "@/utils/cn";

/** GamatoAudioPlayer — engine pemutar audio kustom bermerek Gamato Piranti, tanpa `<audio controls>` bawaan browser. */
export function GamatoAudioPlayer({ src, className, label = "Audio" }: { src: string; className?: string; label?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
  }, [src]);

  const fmt = (t: number) => {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const handleBar = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  };

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className={cn("bg-slate-900 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm", className)}>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        className="hidden"
      />
      <button
        type="button"
        onClick={togglePlay}
        className="shrink-0 w-9 h-9 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center transition-colors"
        aria-label={playing ? "Jeda" : "Putar"}
      >
        {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Music2 className="w-3 h-3 text-indigo-300 shrink-0" />
          <span className="text-[11px] font-semibold text-white/80 truncate">{label}</span>
        </div>
        <div
          className="relative h-1.5 rounded-full bg-white/15 cursor-pointer"
          onPointerDown={(e) => { handleBar(e); }}
          onPointerMove={(e) => { if (e.buttons === 1) handleBar(e); }}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => { const a = audioRef.current; if (!a) return; a.muted = !a.muted; setMuted(a.muted); }}
        className="shrink-0 p-1.5 text-white/70 hover:text-white transition-colors"
        aria-label="Volume"
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      <span className="text-[11px] font-mono text-white/60 shrink-0 tabular-nums">{fmt(current)} / {fmt(duration)}</span>
    </div>
  );
}
