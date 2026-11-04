/**
 * Identitas situs — SATU sumber kebenaran untuk domain resmi Gamato Piranti.
 * Semua tautan yang mengarah ke halaman utama / URL absolut (canonical, Open Graph, QR bawaan,
 * watermark ekspor) wajib memakai konstanta ini, bukan string yang ditulis tangan.
 *
 * Domain resmi: https://gamatopiranti.zone.id
 */
export const SITE_HOST = "gamatopiranti.zone.id";
export const SITE_URL = `https://${SITE_HOST}`;

/** URL absolut di domain resmi. `siteUrl()` → halaman utama, `siteUrl("/pdf")` → /pdf. */
export function siteUrl(path = "/"): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p === "/" ? `${SITE_URL}/` : `${SITE_URL}${p}`;
}

/** Host yang SENGAJA dialihkan ke domain resmi (bukan preview/dev, supaya pengujian tetap jalan). */
export const LEGACY_HOSTS = ["gamato-piranti.vercel.app", "www.gamatopiranti.zone.id"] as const;
