import { useEffect, useState } from "react";

const STORAGE_KEY = "gp-theme";

function getInitialTheme(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {
    // localStorage may be unavailable (private mode, etc.) — fall back silently.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/**
 * Tracks and toggles the site's dark theme. The actual styling is driven by
 * Tailwind's `dark:` variant, which activates whenever the `.dark` class is
 * present on <html> — this hook is just responsible for keeping that class,
 * localStorage, and the returned `isDark` flag all in sync.
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      window.localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
    } catch {
      // Ignore write failures (e.g. storage disabled) — theme still applies for this session.
    }
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((v) => !v) };
}
