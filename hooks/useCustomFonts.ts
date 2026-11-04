import { useCallback, useState } from "react";
import { loadCustomFont, type CustomFontEntry } from "@/lib/customFont";
import { DEFAULT_FONT_FAMILY } from "@/lib/fontPresets";

export interface UseCustomFontsResult {
  customFonts: CustomFontEntry[];
  isFontLoading: boolean;
  fontError: string | null;
  /** Reads + registers an uploaded font file. No-ops silently on `null`. */
  addCustomFont: (file: File | null) => Promise<void>;
  /**
   * Un-registers a previously uploaded font. `onRemoved` is called with the
   * safe default family name so the caller can fall any layer/field that was
   * still using the removed font back to something that still renders.
   */
  removeCustomFont: (id: string, onRemoved?: (fallbackFamily: string) => void) => void;
  clearFontError: () => void;
}

/**
 * Centralizes the "upload a .ttf/.otf/.woff(2) and use it as a font" flow
 * shared by every generator (Certificate, Business Card Studio, Invoice,
 * Kwitansi, Struk, CV Maker) so the loading/error state and removal-fallback
 * logic lives in exactly one place instead of being copy-pasted per tool.
 */
export function useCustomFonts(): UseCustomFontsResult {
  const [customFonts, setCustomFonts] = useState<CustomFontEntry[]>([]);
  const [isFontLoading, setIsFontLoading] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);

  const addCustomFont = useCallback(async (file: File | null) => {
    if (!file) return;
    setFontError(null);
    setIsFontLoading(true);
    try {
      const entry = await loadCustomFont(file);
      setCustomFonts((prev) => [...prev, entry]);
    } catch (err: any) {
      setFontError(err?.message || "Gagal memuat font kustom.");
    } finally {
      setIsFontLoading(false);
    }
  }, []);

  const removeCustomFont = useCallback((id: string, onRemoved?: (fallbackFamily: string) => void) => {
    setCustomFonts((prev) => prev.filter((f) => f.id !== id));
    onRemoved?.(DEFAULT_FONT_FAMILY);
  }, []);

  const clearFontError = useCallback(() => setFontError(null), []);

  return { customFonts, isFontLoading, fontError, addCustomFont, removeCustomFont, clearFontError };
}
