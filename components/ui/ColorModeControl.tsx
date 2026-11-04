import { ArrowRightLeft } from "lucide-react";
import { cn } from "@/utils/cn";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { Label } from "@/components/ui/primitives";

export type ColorMode = "solid" | "gradient";
export type GradientKind = "linear" | "radial";

export interface ColorState {
  mode: ColorMode;
  color: string;
  color2: string;
  gradientType: GradientKind;
  rotation: number; // degrees, 0-360
}

export function defaultColorState(color: string, color2 = "#4f46e5"): ColorState {
  return { mode: "solid", color, color2, gradientType: "linear", rotation: 0 };
}

/**
 * One reusable "Solid / Gradient" color control. Used for dots, corner
 * squares, corner dots, and background — four spots that would otherwise
 * each hand-roll the same toggle + picker(s) + rotation slider markup.
 */
export function ColorModeControl({
  label,
  value,
  onChange,
  className,
  testId,
}: {
  label: string;
  value: ColorState;
  onChange: (next: ColorState) => void;
  className?: string;
  testId?: string;
}) {
  const set = (patch: Partial<ColorState>) => onChange({ ...value, ...patch });

  return (
    <div className={cn("space-y-3", className)} data-testid={testId}>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
          {(["solid", "gradient"] as ColorMode[]).map((m) => (
            <button
              key={m}
              type="button"
              data-testid={testId ? `${testId}-mode-${m}` : undefined}
              onClick={() => set({ mode: m })}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all",
                value.mode === m ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              {m === "solid" ? "Solid" : "Gradasi"}
            </button>
          ))}
        </div>
      </div>

      {value.mode === "solid" ? (
        <GamatoColorPicker value={value.color} onChange={(c) => set({ color: c })} testId={testId ? `${testId}-solid` : undefined} />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <GamatoColorPicker label="Warna 1" value={value.color} onChange={(c) => set({ color: c })} testId={testId ? `${testId}-c1` : undefined} />
            <GamatoColorPicker label="Warna 2" value={value.color2} onChange={(c) => set({ color2: c })} testId={testId ? `${testId}-c2` : undefined} />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => set({ gradientType: value.gradientType === "linear" ? "radial" : "linear" })}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              <ArrowRightLeft className="w-3 h-3" />
              {value.gradientType === "linear" ? "Linear" : "Radial"} — ganti
            </button>
          </div>
          {value.gradientType === "linear" && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Sudut Gradasi</span>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{value.rotation}°</span>
              </div>
              <GamatoSlider min={0} max={360} step={5} value={value.rotation} onChange={(r) => set({ rotation: r })} aria-label={`Sudut gradasi ${label}`} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Converts UI degrees into the radians qr-code-styling's Gradient.rotation expects. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Builds the { color } or { gradient } sub-object for a qr-code-styling option group. Always returns BOTH keys explicitly (one real, one `undefined`) — qr-code-styling's `.update()` deep-merges new options into the old ones, so omitting a key entirely would let a stale gradient/color from a previous mode silently keep rendering after switching modes. */
export function toQrColorOptions(state: ColorState): { color: string | undefined; gradient: { type: GradientKind; rotation: number; colorStops: { offset: number; color: string }[] } | undefined } {
  if (state.mode === "gradient") {
    return {
      color: undefined,
      gradient: {
        type: state.gradientType,
        rotation: degToRad(state.rotation),
        colorStops: [
          { offset: 0, color: state.color },
          { offset: 1, color: state.color2 },
        ],
      },
    };
  }
  return { color: state.color, gradient: undefined };
}
