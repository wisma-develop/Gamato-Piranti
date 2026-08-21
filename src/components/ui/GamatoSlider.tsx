import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/utils/cn";

/**
 * GamatoSlider — engine slider kustom bermerek Gamato Piranti.
 * Menggantikan `<input type="range">` bawaan browser dengan trek & handle yang di-render sendiri.
 */
type GamatoSliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
};

export function GamatoSlider({ min, max, step = 1, value, onChange, className, disabled, ...rest }: GamatoSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const range = max - min || 1;
  const clampedValue = Math.min(max, Math.max(min, value));
  const pct = ((clampedValue - min) / range) * 100;

  const snap = useCallback(
    (raw: number) => {
      const stepped = Math.round((raw - min) / step) * step + min;
      return Math.min(max, Math.max(min, Math.round(stepped * 1000) / 1000));
    },
    [min, max, step]
  );

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onChange(snap(min + ratio * range));
    },
    [min, range, onChange, snap]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    updateFromClientX(e.clientX);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || disabled) return;
    updateFromClientX(e.clientX);
  };
  const stopDrag = () => setDragging(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = clampedValue + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = clampedValue - step;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    if (next !== null) {
      e.preventDefault();
      onChange(snap(next));
    }
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clampedValue}
      aria-label={rest["aria-label"]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative h-2 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer select-none touch-none group/slider focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow transition-transform",
          dragging ? "scale-110" : "group-hover/slider:scale-105"
        )}
        style={{ left: `calc(${pct}% - 8px)` }}
      />
    </div>
  );
}
