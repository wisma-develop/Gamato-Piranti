import React from "react";

/**
 * Kartu dengan sorotan cahaya yang mengikuti kursor (CSS `.gp-spot`). Posisi kursor diisi oleh handler global
 * `installPointerFx` (lihat src/lib/pointerFx.ts) — komponen ini hanya menyediakan kelas & warna sorotan,
 * jadi tidak ada state/handler per kartu. Tambahkan `data-tilt` bila ingin efek miring 3D juga.
 */
export const SpotlightCard: React.FC<React.HTMLAttributes<HTMLDivElement> & { spot?: string }> = ({ spot, className, style, children, ...rest }) => (
  <div
    {...rest}
    className={["gp-spot", className].filter(Boolean).join(" ")}
    style={spot ? ({ ...style, ["--spot" as string]: spot } as React.CSSProperties) : style}
  >
    {children}
  </div>
);
