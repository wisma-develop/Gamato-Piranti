import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

/**
 * Pengganti ringan `AnimatePresence` untuk animasi masuk/keluar berbasis CSS transition.
 * `mounted` = elemen harus ada di DOM; `open` = sedang dalam keadaan tampil (kelas "terbuka").
 * Saat `show` menjadi false, elemen dipertahankan `exitMs` agar transisi keluar sempat berjalan.
 */
export function usePresence(show: boolean, exitMs = 160) {
  const [mounted, setMounted] = useState(show);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (show) {
      setMounted(true);
      // dua frame: frame pertama menggambar keadaan "tertutup", frame kedua memicu transisi ke "terbuka"
      let id2 = 0;
      const id1 = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setOpen(true)); });
      return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2); };
    }
    setOpen(false);
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [show, exitMs]);
  return { mounted: mounted || show, open: show && open };
}

type PresenceProps = Omit<React.HTMLAttributes<HTMLDivElement>, "className"> & {
  show: boolean;
  exitMs?: number;
  className?: string;
  openClassName: string;
  closedClassName: string;
};

/** <div> yang di-mount/unmount dengan transisi; `openClassName`/`closedClassName` bergantian sesuai status. */
export const Presence: React.FC<PresenceProps> = ({ show, exitMs, className, openClassName, closedClassName, children, ...rest }) => {
  const { mounted, open } = usePresence(show, exitMs);
  if (!mounted) return null;
  return <div {...rest} className={cn(className, open ? openClassName : closedClassName)}>{children}</div>;
};

/** Preferensi "kurangi gerakan" — nilai awal dibaca sinkron, lalu mengikuti perubahan. */
export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** True saat elemen pertama kali masuk layar (sekali saja). Tanpa IntersectionObserver → langsung true. */
export function useInViewOnce<T extends Element>(rootMargin = "0px 0px -8% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, rootMargin]);
  return [ref, seen] as const;
}
