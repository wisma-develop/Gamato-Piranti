// Loads a user-uploaded font file (.ttf/.otf/.woff/.woff2) into the page via
// the CSS Font Loading API so it can be used as a normal `font-family` value
// on <canvas> text — exactly like any of the built-in preset fonts.

export interface CustomFontEntry {
  id: string;
  /** The exact CSS font-family name registered with the browser — always unique. */
  family: string;
  /** Original uploaded filename, shown to the user. */
  fileName: string;
}

const ACCEPTED_EXT = [".ttf", ".otf", ".woff", ".woff2"];
const MAX_FONT_BYTES = 8 * 1024 * 1024; // 8MB — generous for any real font file

let customFontCounter = 0;

export function isSupportedFontFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXT.some((ext) => lower.endsWith(ext));
}

/**
 * Reads the given font file, registers it with `document.fonts`, and
 * resolves with a stable, unique family name to use in `fontFamily`. Throws
 * a friendly, Indonesian-language error on invalid/corrupt files instead of
 * leaving the caller with a cryptic browser exception.
 */
export async function loadCustomFont(file: File): Promise<CustomFontEntry> {
  if (!isSupportedFontFile(file)) {
    throw new Error("Format font tidak didukung. Gunakan file .ttf, .otf, .woff, atau .woff2.");
  }
  if (file.size > MAX_FONT_BYTES) {
    throw new Error("Ukuran file font terlalu besar (maksimal 8MB).");
  }

  customFontCounter += 1;
  const family = `gp-custom-font-${Date.now().toString(36)}-${customFontCounter}`;

  const buffer = await file.arrayBuffer();
  let fontFace: FontFace;
  try {
    fontFace = new FontFace(family, buffer);
    await fontFace.load();
  } catch {
    throw new Error(`Gagal memuat font "${file.name}". Pastikan file tidak rusak.`);
  }

  document.fonts.add(fontFace);

  return { id: family, family, fileName: file.name };
}
