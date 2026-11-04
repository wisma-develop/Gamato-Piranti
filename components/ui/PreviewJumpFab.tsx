import { useEffect, useRef, useState } from "react";
import { Eye, Settings2 } from "lucide-react";

/**
 * PreviewJumpFab — tombol melayang khusus layar kecil (ponsel/tablet). Di layar
 * sempit, panel pengaturan tampil di atas dan pratinjau di bawah sehingga
 * pengguna tidak melihat efek perubahan. Tombol ini melompat ke pratinjau dan
 * (saat pratinjau sudah terlihat) mengembalikan ke posisi pengaturan semula.
 */
export function PreviewJumpFab({ targetId, label = "Pratinjau" }: { targetId: string; label?: string }) {
  const [visible, setVisible] = useState(false);
  const [present, setPresent] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;
    setPresent(true);
    const io = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio > 0.25), { threshold: [0, 0.25, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  if (!present) return null;

  const go = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (visible) {
      window.scrollTo({ top: lastY.current, behavior: "smooth" });
    } else {
      lastY.current = window.scrollY;
      const top = el.getBoundingClientRect().top + window.scrollY - 76;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <button
      type="button"
      onClick={go}
      aria-label={visible ? "Kembali ke pengaturan" : `Lihat ${label.toLowerCase()}`}
      className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-indigo-600 text-white text-sm font-semibold pl-3.5 pr-4 py-3 shadow-lg shadow-indigo-600/30 active:scale-95 transition-transform"
    >
      {visible ? <Settings2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      {visible ? "Pengaturan" : label}
    </button>
  );
}
