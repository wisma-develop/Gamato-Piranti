import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * GamatoCheckbox — engine checkbox kustom bermerek Gamato Piranti.
 * Menggantikan `<input type="checkbox">` bawaan browser dengan kotak & centang SVG buatan sendiri.
 */
export function GamatoCheckbox({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const box = (
    <span
      role="checkbox"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={cn(
        "inline-flex items-center justify-center w-[18px] h-[18px] rounded-md border-2 shrink-0 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
        checked ? "bg-indigo-600 border-indigo-600" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-indigo-400",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
    >
      <Check className={cn("w-3 h-3 text-white transition-transform", checked ? "scale-100" : "scale-0")} strokeWidth={3} />
    </span>
  );

  if (!label) return <span className={className}>{box}</span>;

  return (
    <label className={cn("flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none", disabled && "cursor-not-allowed opacity-60", className)}>
      {box}
      {label}
    </label>
  );
}
