import React, { useEffect, useRef, useState } from "react";
import { Pipette, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { useClampedPopover } from "@/hooks/useClampedPopover";

/**
 * GamatoColorPicker — engine pemilih warna kustom bermerek Gamato Piranti.
 * Menggantikan `<input type="color">` bawaan OS/browser dengan panel HSV + swatch + input HEX buatan sendiri.
 */

const SWATCHES = [
  "#020617", "#ffffff", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2) || "00", 16) / 255;
  const g = parseInt(m.slice(2, 4) || "00", 16) / 255;
  const b = parseInt(m.slice(4, 6) || "00", 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function isValidHex(v: string) {
  return /^#([0-9a-fA-F]{6})$/.test(v);
}

export function GamatoColorPicker({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const { ref: popRef, style: popStyle } = useClampedPopover<HTMLDivElement>();
  const [hsv, setHsv] = useState(() => hexToHsv(value || "#000000"));

  useEffect(() => {
    setHexInput(value);
    // Only re-derive h/s/v from the incoming hex when it's a genuinely
    // EXTERNAL change (typed manually, a different element selected, a
    // swatch clicked elsewhere, etc). Without this guard, every drag inside
    // the saturation/value box re-triggers this effect via its own
    // `onChange` round-trip; the moment the user drags into an achromatic
    // area (pure black, white, or any gray), `hexToHsv` cannot recover a
    // hue from a saturation-less color and silently resets it to 0° (red).
    // The very next drag then jumps to a red-tinted color instead of the
    // shade of blue/green/whatever the user was actually adjusting — this
    // is the "warna jadi hancur/berubah sendiri" bug. Comparing against what
    // our current h/s/v would itself produce detects "this is just our own
    // echo" and preserves the in-progress hue.
    setHsv((prev) => {
      const echoOfOwnState = hsvToHex(prev.h, prev.s, prev.v).toLowerCase() === (value || "").toLowerCase();
      return echoOfOwnState ? prev : hexToHsv(value || "#000000");
    });
  }, [value]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const commit = (hex: string) => {
    onChange(hex);
    setHexInput(hex);
  };

  const updateFromSv = (clientX: number, clientY: number) => {
    const el = svRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    const next = { ...hsv, s, v };
    setHsv(next);
    commit(hsvToHex(next.h, next.s, next.v));
  };

  const handleSvDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updateFromSv(e.clientX, e.clientY);
  };
  const handleSvMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    updateFromSv(e.clientX, e.clientY);
  };

  const handleHue = (h: number) => {
    const next = { ...hsv, h };
    setHsv(next);
    commit(hsvToHex(next.h, next.s, next.v));
  };

  const handleHexChange = (v: string) => {
    setHexInput(v);
    const normalized = v.startsWith("#") ? v : `#${v}`;
    if (isValidHex(normalized)) {
      setHsv(hexToHsv(normalized));
      onChange(normalized);
    }
  };

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {label && <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">{label}</p>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-sm hover:border-indigo-300 transition-colors"
      >
        <span
          className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 shrink-0 shadow-inner"
          style={{ backgroundColor: isValidHex(value) ? value : "#000000" }}
        />
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase">{value}</span>
      </button>

      {open && (
        <div
          ref={popRef}
          style={popStyle}
          className="absolute z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-4 space-y-3"
        >
          {/* Saturation/Value box */}
          <div
            ref={svRef}
            onPointerDown={handleSvDown}
            onPointerMove={handleSvMove}
            className="relative w-full h-32 rounded-xl cursor-crosshair touch-none"
            style={{
              backgroundColor: hsvToHex(hsv.h, 1, 1),
              backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
            }}
          >
            <div
              className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow -translate-x-1/2 translate-y-1/2 pointer-events-none"
              style={{ left: `${hsv.s * 100}%`, bottom: `${hsv.v * 100}%`, boxShadow: "0 0 0 1px rgba(0,0,0,0.3)" }}
            />
          </div>

          {/* Hue slider */}
          <div
            className="relative h-3 rounded-full cursor-pointer touch-none"
            style={{ background: "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)" }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              const rect = e.currentTarget.getBoundingClientRect();
              handleHue(Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360)));
            }}
            onPointerMove={(e) => {
              if (e.buttons !== 1) return;
              const rect = e.currentTarget.getBoundingClientRect();
              handleHue(Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360)));
            }}
          >
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border border-slate-300 shadow pointer-events-none"
              style={{ left: `calc(${(hsv.h / 360) * 100}% - 7px)` }}
            />
          </div>

          {/* Hex input */}
          <div className="flex items-center gap-2">
            <Pipette className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              maxLength={7}
              spellCheck={false}
            />
          </div>

          {/* Swatches */}
          <div className="grid grid-cols-9 gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => commit(c)}
                className="w-5 h-5 rounded-md border border-black/10 flex items-center justify-center shrink-0"
                style={{ backgroundColor: c }}
                aria-label={c}
              >
                {value.toLowerCase() === c.toLowerCase() && <Check className="w-3 h-3 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
