import React, { useRef } from "react";

/**
 * Pembungkus yang memberi variabel `--mx/--my` (posisi kursor) ke CSS `.gp-spot`, sehingga muncul sorotan
 * cahaya yang mengikuti kursor. Murni dekoratif: tanpa state React (tidak ada re-render saat kursor bergerak),
 * dan di layar sentuh tidak melakukan apa pun.
 */
export const SpotlightCard: React.FC<React.HTMLAttributes<HTMLDivElement> & { spot?: string }> = ({ spot, className, style, children, onPointerMove, ...rest }) => {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      {...rest}
      className={["gp-spot", className].filter(Boolean).join(" ")}
      style={spot ? ({ ...style, ["--spot" as string]: spot } as React.CSSProperties) : style}
      onPointerMove={(e) => {
        const el = ref.current;
        if (el && e.pointerType === "mouse") {
          const r = el.getBoundingClientRect();
          el.style.setProperty("--mx", `${e.clientX - r.left}px`);
          el.style.setProperty("--my", `${e.clientY - r.top}px`);
        }
        onPointerMove?.(e);
      }}
    >
      {children}
    </div>
  );
};
