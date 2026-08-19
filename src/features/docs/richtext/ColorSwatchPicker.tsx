import React, { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

interface ColorSwatchPickerProps {
  presets: string[];
  /** Called once the user picks a preset OR confirms a custom color. Popover closes right after. */
  onPick: (color: string) => void;
  onClose: () => void;
  /** Called on mousedown of the custom color input, before its native picker steals focus — lets the caller snapshot the text selection first. */
  onCustomPickerOpen?: () => void;
  /** Optional "no color" swatch (e.g. removing a highlight). */
  allowNone?: boolean;
  noneLabel?: string;
}

/**
 * Preset swatches apply instantly on click. The custom color input previews
 * live as the user drags the native picker, but only actually applies once
 * they press "Terapkan" — so picking a custom color never surprises the
 * user with a half-chosen shade landing on their text.
 */
export const ColorSwatchPicker: React.FC<ColorSwatchPickerProps> = ({ presets, onPick, onClose, onCustomPickerOpen, allowNone, noneLabel }) => {
  const [customColor, setCustomColor] = useState(presets[0] || "#4f46e5");

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-3 w-56">
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

        <div className="border-t border-slate-100 dark:border-slate-700 pt-2.5 flex items-center gap-2">
          <label className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-pointer shrink-0" style={{ backgroundColor: customColor }}>
            <input
              type="color"
              value={customColor}
              onMouseDown={(e) => {
                e.stopPropagation();
                onCustomPickerOpen?.();
              }}
              onChange={(e) => setCustomColor(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 flex-1">{customColor}</span>
          <button
            type="button"
            title="Terapkan warna kustom ini"
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
        </div>
      </div>
    </>
  );
};
