import React, { useRef, useState } from "react";
import { cn } from "@/utils/cn";

/**
 * GamatoTooltip — engine tooltip kustom bermerek Gamato Piranti.
 * Menggantikan atribut `title="..."` bawaan browser (kotak abu-abu lambat & tak bisa di-style)
 * dengan tooltip instan yang di-render sendiri.
 */
export function GamatoTooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!label) return children;

  const show = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), 180);
  };
  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  };
  // Touch devices never fire mouseenter/mouseleave, so hover-only tooltips
  // are permanently invisible on phones & tablets. Show instantly on tap
  // and auto-dismiss shortly after — purely additive, doesn't call
  // preventDefault/stopPropagation so the child's own onClick still fires.
  const showOnTouch = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
    timerRef.current = setTimeout(() => setOpen(false), 1600);
  };

  const posClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  };

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={showOnTouch}
    >
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 max-w-[min(220px,calc(100vw-1.5rem))] text-center whitespace-normal rounded-lg bg-slate-900 dark:bg-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg transition-all duration-150",
          posClasses[side],
          open ? "opacity-100 scale-100" : "opacity-0 scale-95"
        )}
      >
        {label}
      </span>
    </span>
  );
}
