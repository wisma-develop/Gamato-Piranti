// Shared font preset catalogue.
// Used by every "generator" tool (Certificate, Business Card Studio, Invoice,
// Kwitansi, Struk, CV Maker) so the list of available fonts — and the way a
// font name is turned into a safe CSS font-family stack — stays identical
// everywhere instead of being duplicated (and drifting) per file.

export type FontCategory = "sans" | "serif" | "script" | "display" | "mono";

export interface FontPreset {
  /** Exact font-family name as loaded via Google Fonts / the OS. */
  id: string;
  /** Human friendly label shown in dropdowns. */
  label: string;
  category: FontCategory;
  /** true if this font must be loaded from Google Fonts (see index.html) */
  webFont?: boolean;
}

// Fallback generic family per category — appended after the font name so
// rendering never breaks even if a web font briefly fails to load.
const CATEGORY_FALLBACK: Record<FontCategory, string> = {
  sans: "sans-serif",
  serif: "serif",
  script: "cursive",
  display: "sans-serif",
  mono: "monospace",
};

export const FONT_PRESETS: FontPreset[] = [
  // Sans — bersih & modern, cocok untuk body text / dokumen bisnis
  { id: "Alan Sans", label: "Alan Sans — Modern Sans", category: "sans", webFont: true },
  { id: "Poppins", label: "Poppins — Geometris & Ramah", category: "sans", webFont: true },
  { id: "Montserrat", label: "Montserrat — Sans Profesional", category: "sans", webFont: true },
  { id: "Arial", label: "Arial — Sans Netral (Sistem)", category: "sans" },
  { id: "Trebuchet MS", label: "Trebuchet MS — Sans Ramah (Sistem)", category: "sans" },

  // Serif — elegan, formal, cocok untuk sertifikat / undangan resmi
  { id: "Playfair Display", label: "Playfair Display — Serif Elegan", category: "serif", webFont: true },
  { id: "Merriweather", label: "Merriweather — Serif Mudah Dibaca", category: "serif", webFont: true },
  { id: "Cormorant Garamond", label: "Cormorant Garamond — Serif Mewah", category: "serif", webFont: true },
  { id: "Georgia", label: "Georgia — Serif Klasik (Sistem)", category: "serif" },
  { id: "Times New Roman", label: "Times New Roman — Serif Formal (Sistem)", category: "serif" },

  // Script — kaligrafi, untuk nama penerima sertifikat / kartu nama mewah
  { id: "Great Vibes", label: "Great Vibes — Kaligrafi Elegan", category: "script", webFont: true },
  { id: "Dancing Script", label: "Dancing Script — Kaligrafi Ceria", category: "script", webFont: true },

  // Display — tebal & mencolok, untuk judul / header besar
  { id: "Oswald", label: "Oswald — Display Ramping", category: "display", webFont: true },
  { id: "Bebas Neue", label: "Bebas Neue — Display Tebal", category: "display", webFont: true },

  // Monospace — cocok untuk nomor invoice / struk / kode
  { id: "JetBrains Mono", label: "JetBrains Mono — Monospace Modern", category: "mono", webFont: true },
  { id: "Courier New", label: "Courier New — Monospace Klasik (Sistem)", category: "mono" },
];

export const FONT_CATEGORY_LABEL: Record<FontCategory, string> = {
  sans: "Sans Serif",
  serif: "Serif",
  script: "Kaligrafi / Script",
  display: "Display",
  mono: "Monospace",
};

export const DEFAULT_FONT_FAMILY = "Alan Sans";

/** Quick lookup so callers don't need to re-filter FONT_PRESETS. */
export function isPresetFont(family: string): boolean {
  return FONT_PRESETS.some((f) => f.id === family);
}

/**
 * Build a safe CSS font-family value: quotes the family name (families can
 * contain spaces) and appends a sensible generic fallback so rendering never
 * silently breaks — even for custom-uploaded fonts, or a preset font whose
 * category we don't recognise (defaults to sans-serif).
 */
export function fontStack(family: string, fallback?: FontCategory): string {
  const preset = FONT_PRESETS.find((f) => f.id === family);
  const generic = CATEGORY_FALLBACK[preset?.category ?? fallback ?? "sans"];
  const safeName = family && family.trim() ? family.trim() : DEFAULT_FONT_FAMILY;
  return `'${safeName}', ${generic}`;
}
