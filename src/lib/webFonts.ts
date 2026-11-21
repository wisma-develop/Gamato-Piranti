/**
 * Font Google khusus generator (Sertifikat, Kartu Nama, Invoice, Kwitansi, Struk, CV, Surat, Kupon, …) —
 * lihat src/lib/fontPresets.ts. Dimuat HANYA saat pengguna membuka sebuah alat (bukan beranda / halaman
 * informasi) supaya halaman awal tidak membayar biaya jaringan & render untuk font yang belum dipakai.
 * Non-blocking: media="print" lalu dialihkan ke "all" saat selesai; display=swap.
 */
const FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Great+Vibes&family=Poppins:wght@300;400;500;600;700;800;900&family=Montserrat:wght@300..900&family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Dancing+Script:wght@400..700&family=Oswald:wght@300..700&family=Bebas+Neue&family=JetBrains+Mono:wght@400..700&display=swap";

let started = false;

export function loadWebFonts(): void {
  if (started || typeof document === "undefined") return;
  started = true;
  for (const [href, cors] of [["https://fonts.googleapis.com", false], ["https://fonts.gstatic.com", true]] as const) {
    const l = document.createElement("link");
    l.rel = "preconnect";
    l.href = href;
    if (cors) l.crossOrigin = "anonymous";
    document.head.appendChild(l);
  }
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = FONTS_CSS;
  css.media = "print";
  css.onload = () => { css.media = "all"; };
  document.head.appendChild(css);
}
