/**
 * Tema warna per kategori menu.
 *
 * Warna aksen aplikasi dipasang lewat utilitas `indigo-*` / `violet-*` Tailwind. Di `src/theme.generated.css`
 * variabel kedua palet itu dialihkan per `html[data-gp-theme="…"]` (lightness identik → kontras tetap lolos
 * audit WCAG). Layout memasang atribut ini sesuai rute aktif; Beranda & halaman info memakai tema merek (indigo).
 */
export type ThemeId = "kode" | "dokumen" | "office" | "gambar" | "video" | "audio" | "utilitas" | "spesial";

const SEGMENT_TO_THEME: Record<string, ThemeId> = {
  qr: "kode",
  pdf: "dokumen",
  docs: "office",
  office: "office",
  image: "gambar",
  video: "video",
  audio: "audio",
  utility: "utilitas",
  special: "spesial",
};

export function themeForPath(pathname: string): ThemeId | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  return (seg && SEGMENT_TO_THEME[seg]) || null;
}
