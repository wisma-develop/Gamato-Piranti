import { useLayoutEffect, useState, type CSSProperties } from "react";

/**
 * useClampedPopover — keeps a freshly-mounted absolute/anchored popover panel
 * (color pickers, small dropdown menus, etc.) from spilling outside the
 * viewport horizontally.
 *
 * Root cause it fixes: panels like `GamatoColorPicker`, `ColorSwatchPicker`,
 * and the Rich Text "Sisipkan bentuk" menu are anchored with plain
 * `absolute ... left-0` relative to their own trigger button. That's fine
 * when the trigger sits on the left side of a narrow (mobile) screen, but
 * once the same trigger ends up on the right half of the screen — e.g. the
 * 3rd color swatch in a `grid-cols-3` row, or a toolbar button that wrapped
 * to a new line — the panel's fixed width pushes it past the right edge and
 * the rest of the panel becomes unreachable (the page's `overflow-x: clip`
 * visually cuts it off instead of scrolling to it).
 *
 * This hook measures the panel right after it mounts (and again on resize),
 * and nudges it back on-screen with a `transform: translateX()` correction
 * — it never touches width, open/close state, or any interaction logic.
 *
 * Usage:
 *   const { ref, style } = useClampedPopover<HTMLDivElement>();
 *   <div ref={ref} style={style} className="absolute ... left-0 w-64">...
 */
export function useClampedPopover<T extends HTMLElement>(margin = 8) {
  // Callback ref + state: efek dijalankan SETIAP kali panel benar-benar terpasang (panel biasanya dirender
  // kondisional saat dibuka). Versi lama memakai useRef dengan dependency [margin] saja, sehingga hanya
  // mengukur saat komponen induk pertama dipasang (ref masih null) dan koreksi tidak pernah berjalan.
  const [el, setEl] = useState<T | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!el) { setStyle({}); return; }

    const measure = () => {
      // Reset any earlier correction before measuring the panel's natural position.
      el.style.transform = "";
      const rect = el.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      let shift = 0;
      if (rect.right > vw - margin) shift -= rect.right - (vw - margin);
      if (rect.left + shift < margin) shift += margin - (rect.left + shift);
      setStyle(shift ? { transform: `translateX(${shift}px)` } : {});
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [el, margin]);

  return { ref: setEl as (node: T | null) => void, style };
}
