import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

/**
 * GamatoSlider — engine slider kustom bermerek Gamato Piranti.
 * Menggantikan `<input type="range">` bawaan browser dengan trek & handle yang di-render sendiri.
 *
 * Perilaku geser (drag) dirancang agar bebas hambatan:
 * - Area sentuh/klik 20 px (bukan hanya trek setipis 8 px) → tidak perlu membidik "bagian tertentu".
 * - Selama menggeser, event pointer dipantau di `window` (bukan di elemen), sehingga geseran tetap
 *   mulus walau kursor keluar dari trek (naik/turun/di luar kartu) dan tidak putus oleh re-render.
 * - Mengambil handle tidak "melompat": offset antara titik tekan dan pusat handle dipertahankan.
 * - Klik di trek langsung memindahkan handle ke titik itu, lalu bisa langsung digeser.
 * - Papan ketik: ← → ↑ ↓ (1 langkah), PageUp/PageDown (10 langkah), Home/End.
 *
 * PENTING untuk pemakai: jangan mendefinisikan komponen pembungkus slider DI DALAM komponen lain
 * (mis. `const Row = () => ...` di dalam fungsi render). Identitas komponen yang berubah tiap render
 * membuat React me-mount ulang slider di tengah geseran sehingga geseran terputus.
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
  const thumbRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const range = max - min || 1;
  const clampedValue = Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  const pct = ((clampedValue - min) / range) * 100;

  // Nilai terbaru disimpan di ref agar listener window selalu memakai props terkini tanpa dipasang ulang.
  const latest = useRef({ min, max, step, range, onChange, value: clampedValue });
  latest.current = { min, max, step, range, onChange, value: clampedValue };
  const cleanupRef = useRef<(() => void) | null>(null);

  const snap = useCallback((raw: number) => {
    const { min: lo, max: hi, step: st } = latest.current;
    const stepped = Math.round((raw - lo) / st) * st + lo;
    return Math.min(hi, Math.max(lo, Math.round(stepped * 1000) / 1000));
  }, []);

  const emit = useCallback(
    (next: number) => {
      if (next === latest.current.value) return;
      latest.current.value = next;
      latest.current.onChange(next);
    },
    []
  );

  const valueFromClientX = useCallback(
    (clientX: number, grabOffset: number) => {
      const track = trackRef.current;
      if (!track) return null;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const ratio = Math.max(0, Math.min(1, (clientX - grabOffset - rect.left) / rect.width));
      return snap(latest.current.min + ratio * latest.current.range);
    },
    [snap]
  );

  // Bersihkan listener bila komponen dilepas saat sedang menggeser.
  useEffect(() => () => cleanupRef.current?.(), []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    cleanupRef.current?.();
    e.currentTarget.focus({ preventScroll: true });

    // Jika menekan handle itu sendiri, pertahankan offset agar tidak melompat.
    let grabOffset = 0;
    const thumb = thumbRef.current?.getBoundingClientRect();
    if (thumb && e.clientX >= thumb.left - 6 && e.clientX <= thumb.right + 6) {
      grabOffset = e.clientX - (thumb.left + thumb.width / 2);
    }
    const first = valueFromClientX(e.clientX, grabOffset);
    if (first !== null) emit(first);

    const pointerId = e.pointerId;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const v = valueFromClientX(ev.clientX, grabOffset);
      if (v !== null) emit(v);
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      cleanupRef.current?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    setDragging(true);
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      cleanupRef.current = null;
      setDragging(false);
    };
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = clampedValue + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = clampedValue - step;
    else if (e.key === "PageUp") next = clampedValue + step * 10;
    else if (e.key === "PageDown") next = clampedValue - step * 10;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    if (next !== null) {
      e.preventDefault();
      emit(snap(next));
    }
  };

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clampedValue}
      aria-disabled={disabled || undefined}
      aria-orientation="horizontal"
      aria-label={rest["aria-label"]}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={cn(
        // Area sentuh 20px; margin negatif menjaga tinggi tata letak lama (≈8px) hampir tak berubah.
        "relative h-5 -my-1.5 flex items-center cursor-pointer select-none touch-none group/slider focus:outline-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div
        ref={trackRef}
        className="relative h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 group-focus-visible/slider:ring-2 group-focus-visible/slider:ring-indigo-500/40"
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
        <div
          ref={thumbRef}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow transition-transform",
            dragging ? "scale-125" : "group-hover/slider:scale-110"
          )}
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>
    </div>
  );
}
