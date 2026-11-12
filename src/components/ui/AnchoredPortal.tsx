import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/**
 * AnchoredPortal — mesin popover Gamato Piranti.
 *
 * Masalah yang diselesaikan: popover (daftar pilihan, kalender, pemilih warna, tooltip) yang dirender
 * `absolute` di DALAM kartu akan (1) terpotong oleh `overflow-hidden` kartu/pembungkusnya, dan (2) tertutup
 * kartu lain yang dirender sesudahnya bila kartu itu membuat stacking context (transform, opacity<1, motion).
 *
 * Solusi standar industri: render panel ke `document.body` lewat portal dengan `position: fixed`, lalu
 * hitung posisinya dari kotak jangkar (anchor):
 *  • otomatis membalik ke atas bila ruang di bawah kurang,
 *  • selalu dijepit di dalam layar (kiri/kanan/atas/bawah) dan tingginya dibatasi agar bisa di-scroll,
 *  • mengikuti jangkar saat halaman / kontainer mana pun di-scroll atau ukuran berubah,
 *  • tanpa kedipan: posisi dihitung sebelum frame pertama digambar.
 */

export type PopSide = "bottom" | "top" | "left" | "right";
export type PopAlign = "start" | "center" | "end";

export interface AnchoredOptions {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  side?: PopSide;
  align?: PopAlign;
  offset?: number;
  margin?: number;
  /** Lebar minimum panel = lebar jangkar (untuk daftar pilihan). */
  matchWidth?: boolean;
  /** Batas tinggi (px) dari pemanggil, mis. 256 untuk daftar pilihan. */
  maxHeight?: number;
  flip?: boolean;
}

export function useAnchoredPosition(o: AnchoredOptions) {
  const { anchorRef, open, side = "bottom", align = "start", offset = 6, margin = 8, matchWidth = false, maxHeight, flip = true } = o;
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", left: 0, top: 0, visibility: "hidden" });
  const [placedSide, setPlacedSide] = useState<PopSide>(side);

  const compute = useCallback(() => {
    const a = anchorRef.current, p = panel;
    if (!a || !p) return;
    const ar = a.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const pw = p.offsetWidth, ph = p.offsetHeight;
    let s: PopSide = side;
    const below = vh - ar.bottom - margin, above = ar.top - margin;
    const rightRoom = vw - ar.right - margin, leftRoom = ar.left - margin;
    if (flip) {
      if (side === "bottom" && ph + offset > below && above > below) s = "top";
      else if (side === "top" && ph + offset > above && below > above) s = "bottom";
      else if (side === "right" && pw + offset > rightRoom && leftRoom > rightRoom) s = "left";
      else if (side === "left" && pw + offset > leftRoom && rightRoom > leftRoom) s = "right";
    }
    let left: number, top: number;
    if (s === "bottom" || s === "top") {
      left = align === "start" ? ar.left : align === "end" ? ar.right - pw : ar.left + ar.width / 2 - pw / 2;
      top = s === "bottom" ? ar.bottom + offset : ar.top - ph - offset;
    } else {
      top = align === "start" ? ar.top : align === "end" ? ar.bottom - ph : ar.top + ar.height / 2 - ph / 2;
      left = s === "right" ? ar.right + offset : ar.left - pw - offset;
    }
    // jepit di dalam layar
    left = Math.min(Math.max(left, margin), Math.max(margin, vw - pw - margin));
    top = Math.min(Math.max(top, margin), Math.max(margin, vh - ph - margin));
    const vMax = vh - margin * 2;
    const room = s === "bottom" ? below - offset : s === "top" ? above - offset : vMax;
    const cap = Math.max(140, Math.min(maxHeight ?? Infinity, room > 0 ? Math.max(room, 140) : vMax, vMax));
    setPlacedSide(s);
    setStyle({
      position: "fixed", left: Math.round(left), top: Math.round(top), zIndex: 1000,
      minWidth: matchWidth ? Math.round(ar.width) : undefined,
      maxHeight: Math.round(cap),
      overflowY: ph > cap ? "auto" : undefined,
      visibility: "visible",
    });
  }, [anchorRef, panel, side, align, offset, margin, matchWidth, maxHeight, flip]);

  useLayoutEffect(() => {
    if (!open || !panel) return;
    compute();
  }, [open, panel, compute]);

  useEffect(() => {
    if (!open || !panel) return;
    let raf = 0;
    const tick = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(compute); };
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(tick) : null;
    ro?.observe(panel);
    if (anchorRef.current) ro?.observe(anchorRef.current);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", tick, true); window.removeEventListener("resize", tick); ro?.disconnect(); };
  }, [open, panel, compute, anchorRef]);

  // Reset agar pembukaan berikutnya tidak sempat tampil di posisi lama.
  useEffect(() => { if (!open) setStyle({ position: "fixed", left: 0, top: 0, visibility: "hidden" }); }, [open]);

  return { setPanel, style, side: placedSide };
}

export interface AnchoredPortalProps extends AnchoredOptions, Omit<HTMLAttributes<HTMLDivElement>, "style"> {
  children: ReactNode;
  /** Ref ke elemen panel (untuk deteksi klik-di-luar). */
  panelRef?: MutableRefObject<HTMLDivElement | null>;
  style?: CSSProperties;
}

export function AnchoredPortal({ anchorRef, open, side, align, offset, margin, matchWidth, maxHeight, flip, panelRef, style: extraStyle, children, ...rest }: AnchoredPortalProps) {
  const { setPanel, style } = useAnchoredPosition({ anchorRef, open, side, align, offset, margin, matchWidth, maxHeight, flip });
  const setRef = useCallback((el: HTMLDivElement | null) => { setPanel(el); if (panelRef) panelRef.current = el; }, [setPanel, panelRef]);
  // Mode layar penuh hanya menampilkan subtree elemen fullscreen — portal ke body akan tak terlihat di sana.
  const [, bump] = useState(0);
  useEffect(() => {
    if (!open) return;
    const f = () => bump((n) => n + 1);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  const host = (document.fullscreenElement as HTMLElement | null) ?? document.body;
  return createPortal(<div ref={setRef} style={{ ...extraStyle, ...style }} {...rest}>{children}</div>, host);
}

/** Klik/ketuk di luar jangkar DAN panel (panel berada di portal, bukan di dalam jangkar). */
export function useOutsideClose(open: boolean, refs: Array<RefObject<HTMLElement | null>>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (refs.some((r) => r.current?.contains(t))) return;
      closeRef.current();
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("touchstart", h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** Tutup popover dengan Esc dari mana pun (fokus boleh di pemicu atau di dalam panel). */
export function useEscapeClose(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") ref.current(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);
}
