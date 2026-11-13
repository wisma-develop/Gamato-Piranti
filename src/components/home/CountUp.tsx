import { useEffect, useRef } from "react";
import { useInViewOnce, usePrefersReducedMotion } from "@/hooks/usePresence";

/**
 * Angka yang menghitung naik saat masuk layar (rAF + easing, tanpa library animasi).
 * Isi awal DOM = nilai akhir (aman untuk SEO, tes, dan pembaca layar); animasi hanya menimpa teks sementara.
 * Dengan "kurangi gerakan" aktif, angka langsung final.
 */
export function CountUp({ to, prefix = "", suffix = "", className }: { to: number; prefix?: string; suffix?: string; className?: string }) {
  const [ref, seen] = useInViewOnce<HTMLSpanElement>("0px 0px -40px 0px");
  const reduce = usePrefersReducedMotion();
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!seen || reduce || done.current || !el || to <= 0) return;
    done.current = true;
    const t0 = performance.now(), dur = 1300;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 4);
      el.textContent = `${prefix}${Math.round(to * eased)}${suffix}`;
      if (k < 1) raf = requestAnimationFrame(tick); else el.textContent = `${prefix}${to}${suffix}`;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); el.textContent = `${prefix}${to}${suffix}`; };
  }, [seen, reduce, to, prefix, suffix, ref]);

  return <span ref={ref} className={className}>{`${prefix}${to}${suffix}`}</span>;
}
