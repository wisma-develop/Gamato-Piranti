import { Sparkles } from "lucide-react";
import { cn } from "@/utils/cn";

export type ExportScale = 1 | 2 | 3;

const OPTIONS: { value: ExportScale; label: string; sub: string }[] = [
  { value: 1, label: "Standar", sub: "1× · cepat, file kecil" },
  { value: 2, label: "Tajam", sub: "2× · disarankan" },
  { value: 3, label: "Ultra", sub: "3× · cetak besar" },
];

/**
 * ExportQuality — pemilih kualitas ekspor bersama. Skala = pengali resolusi
 * bitmap saat mengekspor PNG/PDF (tata letak tetap sama, hanya lebih tajam).
 */
export function ExportQuality({
  value,
  onChange,
  baseWidth,
  baseHeight,
}: {
  value: ExportScale;
  onChange: (v: ExportScale) => void;
  baseWidth?: number;
  baseHeight?: number;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Kualitas Ekspor
      </p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Kualitas ekspor">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-xl border-2 px-2 py-2 text-center transition-all",
              value === o.value
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            <span className={cn("block text-xs font-bold", value === o.value ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200")}>{o.label}</span>
            <span className="block text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">{o.sub}</span>
          </button>
        ))}
      </div>
      {baseWidth && baseHeight && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Hasil PNG: {Math.round(baseWidth * value)} × {Math.round(baseHeight * value)} px
        </p>
      )}
    </div>
  );
}
