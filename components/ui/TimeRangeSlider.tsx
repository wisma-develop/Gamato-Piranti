import React, { useRef } from "react";
import { cn } from "@/utils/cn";
import { formatTime } from "@/lib/videoEngine";

export const TimeRangeSlider: React.FC<{
  duration: number;
  start: number;
  end: number;
  onChange: (start: number, end: number) => void;
  minGap?: number;
  playhead?: number;
  accentClassName?: string;
}> = ({ duration, start, end, onChange, minGap = 0.1, playhead, accentClassName = "bg-indigo-500" }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const safeDuration = duration > 0 ? duration : 0.001;

  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / safeDuration) * 100))}%`;

  const beginDrag = (which: "start" | "end") => (e: React.PointerEvent) => {
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;

    const move = (ev: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      const p = (ev.clientX - rect.left) / rect.width;
      const t = Math.min(duration, Math.max(0, p * duration));
      if (which === "start") onChange(Math.min(t, end - minGap), end);
      else onChange(start, Math.max(t, start + minGap));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="space-y-2">
      <div ref={trackRef} className="relative h-3 rounded-full bg-slate-200 dark:bg-slate-700 select-none">
        <div className={cn("absolute top-0 h-full rounded-full", accentClassName)} style={{ left: pct(start), right: `${100 - parseFloat(pct(end))}%` }} />
        {playhead !== undefined && (
          <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-slate-900 dark:bg-white pointer-events-none" style={{ left: pct(playhead) }} />
        )}
        <button
          type="button"
          onPointerDown={beginDrag("start")}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-indigo-500 shadow cursor-ew-resize touch-none"
          style={{ left: pct(start) }}
          aria-label="Awal"
        />
        <button
          type="button"
          onPointerDown={beginDrag("end")}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-white border-2 border-indigo-500 shadow cursor-ew-resize touch-none"
          style={{ left: pct(end) }}
          aria-label="Akhir"
        />
      </div>
      <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
        <span>{formatTime(start)}</span>
        <span>{formatTime(end)}</span>
      </div>
    </div>
  );
};
