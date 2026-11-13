import React from "react";
import { cn } from "@/utils/cn";
import { useInViewOnce } from "@/hooks/usePresence";

/** Memunculkan anak saat masuk layar (opacity+translate via CSS transition). `delay` (ms) untuk efek berjenjang. */
export const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className }) => {
  const [ref, seen] = useInViewOnce<HTMLDivElement>("0px 0px -6% 0px");
  return (
    <div ref={ref} style={delay ? { transitionDelay: `${delay}ms` } : undefined} className={cn("gp-reveal", seen && "is-in", className)}>
      {children}
    </div>
  );
};
