import React, { useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { AnchoredPortal } from "@/components/ui/AnchoredPortal";

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
  const anchorRef = useRef<HTMLSpanElement>(null);

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

  return (
    <span
      ref={anchorRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={showOnTouch}
    >
      {children}
      <AnchoredPortal anchorRef={anchorRef} open={open} side={side} align="center" offset={6} role="tooltip" className={"pointer-events-none max-w-[min(220px,calc(100vw-1.5rem))] text-center whitespace-normal rounded-lg bg-slate-900 dark:bg-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg transition-all duration-150 animate-[gamatoFadeIn_0.12s_ease-out]"}>
        {label}
      </AnchoredPortal>
    </span>
  );
}
