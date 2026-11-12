import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

/**
 * Angka yang menghitung naik saat masuk layar. Isi awal DOM = nilai akhir (aman untuk SEO, tes, dan pembaca layar);
 * animasi hanya menimpa teks sementara. Dengan "kurangi gerakan" aktif, angka langsung final tanpa animasi.
 */
export function CountUp({ to, prefix = "", suffix = "", className }: { to: number; prefix?: string; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!inView || reduce || !el || to <= 0) return;
    const controls = animate(0, to, {
      duration: 1.3,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { el.textContent = `${prefix}${Math.round(v)}${suffix}`; },
      onComplete: () => { el.textContent = `${prefix}${to}${suffix}`; },
    });
    return () => { controls.stop(); el.textContent = `${prefix}${to}${suffix}`; };
  }, [inView, reduce, to, prefix, suffix]);

  return <span ref={ref} className={className}>{`${prefix}${to}${suffix}`}</span>;
}
