import { useEffect, useState } from "react";

/**
 * Kunci preferensi tema. Hanya ditulis saat pengguna MENEKAN tombol tema — bukan otomatis saat halaman dibuka —
 * sehingga "belum memilih" dan "memilih terang" bisa dibedakan. Kunci lama ("gp-theme") sengaja diabaikan karena
 * versi sebelumnya menulisnya otomatis dari preferensi sistem (pengunjung lama yang tidak pernah memilih ikut kembali ke terang).
 */
const STORAGE_KEY = "gp-theme-pref";

function getInitialTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Bawaan = TERANG (putih), apa pun preferensi sistem. Gelap hanya bila pengguna memilihnya sendiri.
    return window.localStorage.getItem(STORAGE_KEY) === "dark";
  } catch {
    return false; // localStorage tidak tersedia (mode privat, dll.)
  }
}

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#0f172a" : "#ffffff");
}

/**
 * Tracks and toggles the site's dark theme. The actual styling is driven by
 * Tailwind's `dark:` variant, which activates whenever the `.dark` class is
 * present on <html> — this hook is just responsible for keeping that class,
 * localStorage, and the returned `isDark` flag all in sync.
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);

  useEffect(() => { applyTheme(isDark); }, [isDark]);

  const toggle = () => {
    setIsDark((v) => {
      const next = !v;
      try { window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light"); } catch { /* tema tetap berlaku untuk sesi ini */ }
      return next;
    });
  };

  return { isDark, toggle };
}
