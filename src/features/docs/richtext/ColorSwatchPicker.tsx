import React, { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { GamatoTooltip } from "@/components/ui/GamatoTooltip";
import { useClampedPopover } from "@/hooks/useClampedPopover";

interface ColorSwatchPickerProps {
  presets: string[];
  /** Called once the user picks a preset OR confirms a custom color. Popover closes right after. */
  onPick: (color: string) => void;
  onClose: () => void;
  /** Called before the custom picker surface is interacted with — lets the caller snapshot the text selection first (kept for backward-compatibility; the custom picker below no longer steals window focus, but the hook is preserved as a safety net). */
  onCustomPickerOpen?: () => void;
  /** Optional "no color" swatch (e.g. removing a highlight). */
  allowNone?: boolean;
  noneLabel?: string;
}

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
  return { h, s: max === 0 ? 0 : d / max, v: max };
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

/**
 * Preset swatches apply instantly on click. The custom color surface below is
 * a fully native-to-Gamato-Piranti HSV picker (no OS/browser color dialog) that
 * previews live as the user drags, but only actually applies once they press
 * "Terapkan" — so picking a custom color never surprises the user with a
 * half-chosen shade landing on their text. Because it never opens a native
 * dialog, it never steals window focus, so the text-selection snapshot dance
 * that native `<input type="color">` used to require is no longer necessary.
 */
export const ColorSwatchPicker: React.FC<ColorSwatchPickerProps> = ({ presets, onPick, onClose, onCustomPickerOpen, allowNone, noneLabel }) => {
  const { ref: popRef, style: popStyle } = useClampedPopover<HTMLDivElement>();
  const [customColor, setCustomColor] = useState(presets[0] || "#4f46e5");
  const [hsv, setHsv] = useState(() => hexToHsv(presets[0] || "#4f46e5"));
  const [hexInput, setHexInput] = useState(customColor);

  const commitHsv = (next: { h: number; s: number; v: number }) => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    setCustomColor(hex);
    setHexInput(hex);
  };

  const updateFromSv = (el: HTMLDivElement, clientX: number, clientY: number) => {
    const rect = el.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    commitHsv({ ...hsv, s, v });
  };

  const handleHexChange = (v: string) => {
    setHexInput(v);
    const normalized = v.startsWith("#") ? v : `#${v}`;
    if (isValidHex(normalized)) {
      setHsv(hexToHsv(normalized));
      setCustomColor(normalized);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div ref={popRef} style={popStyle} className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 w-56">
        <div className="grid grid-cols-6 gap-1.5 mb-3">
          {allowNone && (
            <button
              type="button"
              title={noneLabel || "Tanpa warna"}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick("transparent");
                onClose();
              }}
              className="w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 relative flex items-center justify-center"
            >
              <span className="absolute inset-0.5 rounded-md bg-gradient-to-br from-transparent via-red-500/70 to-transparent" style={{ clipPath: "polygon(0 45%, 45% 0, 100% 55%, 55% 100%)" }} />
            </button>
          )}
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(c);
                onClose();
              }}
              style={{ backgroundColor: c }}
              className={cn("w-7 h-7 rounded-lg border shadow-sm", c === "#ffffff" || c === "transparent" ? "border-slate-300 dark:border-slate-600" : "border-transparent")}
            />
          ))}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-700 pt-2.5 space-y-2">
          {/* Saturation/Value box — engine kustom Gamato Piranti, bukan input warna bawaan browser */}
          <div
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onCustomPickerOpen?.(); }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              updateFromSv(e.currentTarget, e.clientX, e.clientY);
            }}
            onPointerMove={(e) => { if (e.buttons === 1) updateFromSv(e.currentTarget, e.clientX, e.clientY); }}
            className="relative w-full h-20 rounded-lg cursor-crosshair touch-none"
            style={{
              backgroundColor: hsvToHex(hsv.h, 1, 1),
              backgroundImage: "linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)",
            }}
          >
            <div
              className="absolute w-3 h-3 rounded-full border-2 border-white shadow -translate-x-1/2 translate-y-1/2 pointer-events-none"
              style={{ left: `${hsv.s * 100}%`, bottom: `${hsv.v * 100}%`, boxShadow: "0 0 0 1px rgba(0,0,0,0.3)" }}
            />
          </div>

          <div
            className="relative h-2.5 rounded-full cursor-pointer touch-none"
            style={{ background: "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)" }}
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              const rect = e.currentTarget.getBoundingClientRect();
              commitHsv({ ...hsv, h: Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360)) });
            }}
            onPointerMove={(e) => {
              if (e.buttons !== 1) return;
              const rect = e.currentTarget.getBoundingClientRect();
              commitHsv({ ...hsv, h: Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360)) });
            }}
          >
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border border-slate-300 shadow pointer-events-none"
              style={{ left: `calc(${(hsv.h / 360) * 100}% - 6px)` }}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0 shadow-inner" style={{ backgroundColor: customColor }} />
            <input
              type="text"
              value={hexInput}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => handleHexChange(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              maxLength={7}
              spellCheck={false}
            />
            <GamatoTooltip label="Terapkan warna kustom ini">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(customColor);
                  onClose();
                }}
                className="h-8 px-2.5 inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                Terapkan
              </button>
            </GamatoTooltip>
          </div>
        </div>
      </div>
    </>
  );
};

