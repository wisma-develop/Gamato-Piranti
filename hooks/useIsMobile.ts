import { useEffect, useState } from "react";

/**
 * useIsMobile — deteksi apakah layar saat ini berukuran mobile (di bawah breakpoint tertentu).
 * Reaktif terhadap resize (misal HP diputar landscape) dan aman untuk SSR.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
