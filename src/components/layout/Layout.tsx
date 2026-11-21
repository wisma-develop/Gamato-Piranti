import { Suspense, useLayoutEffect } from 'react';
import { useEffect } from "react";
import { Outlet, useLocation, Link } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { ChevronRight, Home } from 'lucide-react';
import { GamatoToastProvider } from '@/components/ui/GamatoToast';
import { themeForPath } from '@/lib/categoryTheme';
import { tr } from "@/i18n";

import { loadWebFonts } from "@/lib/webFonts";
const CATEGORY_LABELS: Record<string, string> = {
  qr: tr("Kode"),
  pdf: tr("Dokumen"),
  docs: tr("Doc Studio"),
  office: tr("Office Tools"),
  image: tr("Gambar"),
  utility: tr("Utilitas"),
  special: tr("Spesial"),
  video: tr("Video"),
  audio: tr("Audio"),
  about: tr("Tentang Kami"),
  privacy: tr("Kebijakan Privasi"),
  terms: tr("Ketentuan Layanan"),
  faq: "FAQ",
};

// Sub-feature labels, namespaced per category since slugs like "kompres"/"putar" repeat across sections.
const MODE_LABELS: Record<string, Record<string, string>> = {
  qr: {
    'qr-code': tr("QR Code"),
    'barcode': tr("Barcode"),
    'scan-hid': tr("Scan HID"),
    'kode-morse': tr("Kode Morse"),
    'scan-qr': tr("QR & Barcode Scanner"),
  },
  office: {
    'doc-studio': tr("Doc Studio"),
    'sheet-studio': tr("Sheet Studio"),
    'slide-studio': tr("Slide Studio"),
  },
  pdf: {
    'gabung': tr("Gabung PDF"),
    'pecah': tr("Pecah PDF"),
    'kompres': tr("Kompres PDF"),
    'kompres-dokumen': tr("Kompres Dokumen"),
    'ekstrak': tr("Ekstrak Halaman"),
    'hapus-halaman': tr("Hapus Halaman"),
    'putar': tr("Putar Halaman"),
    'atur-ulang': tr("Atur Ulang Halaman"),
    'gambar-ke-pdf': tr("Gambar ke PDF"),
    'teks-ke-pdf': tr("Teks ke PDF"),
    'word-ke-pdf': tr("Word ke PDF"),
    'excel-ke-pdf': tr("Excel ke PDF"),
    'ppt-ke-pdf': tr("PowerPoint ke PDF"),
    'edit': tr("Edit PDF"),
    'tanda-tangan': tr("Tanda Tangan PDF"),
    'watermark': tr("Watermark PDF"),
    'html-ke-pdf': tr("HTML ke PDF"),
    'nomor-halaman': tr("Nomor Halaman"),
    'unlock': tr("Unlock PDF"),
    'reader': tr("PDF Reader"),
    'sensor': tr("Sensor / Redaksi PDF"),
    'scan': tr("Scan PDF"),
    'ke-gambar': tr("PDF ke Gambar"),
    'ke-word': tr("PDF ke Word"),
    'ke-excel': tr("PDF ke Excel"),
    'ocr': 'OCR',
    'protect': tr("Protect PDF"),
    'baca-dokumen': tr("Doc Reader"),
  },
  image: {
    'kompres': tr("Kompres Gambar"),
    'resize': tr("Ubah Ukuran"),
    'konversi': tr("Konversi Format"),
    'putar': tr("Putar Gambar"),
    'hapus-metadata': tr("Hapus Metadata"),
    'raw-preview': tr("Baca Foto RAW"),
    'crop': tr("Crop Gambar"),
    'hapus-background': tr("Hapus Background"),
    'watermark': tr("Watermark Gambar"),
    'html-ke-gambar': tr("HTML ke Gambar"),
    'color-picker': tr("Color Picker & Palette"),
    'meme-generator': tr("Meme Generator"),
    'photo-editor': tr("Photo Editor"),
    'cetak-foto': tr("Cetak Foto"),
    'kolase': tr("Kolase Gambar"),
  },
  utility: {
    'json-base64': tr("JSON & Base64"),
    'bulk-teks': tr("Bulk Teks"),
    'capture-website': tr("Capture Website"),
    'koordinat': tr("Koordinat"),
    'cetak': tr("Cetak File & Dokumen"),
    'link-media': tr("Link Media"),
    'alias-email': tr("Alias Email"),
    'kalkulator-pajak': tr("Kalkulator Pajak"),
    'kalkulator-bunga': tr("Kalkulator Bunga"),
    'statistik': tr("Statistik"),
    'password-token': tr("Password & Token"),
    'kamus-dunia': tr("Kamus Dunia"),
    'html-preview': tr("HTML Preview"),
    'diagram-rumus': tr("Diagram & Rumus Studio"),
    'convert': tr("Universal Converter"),
    'kalkulator': tr("Kalkulator"),
  },
  special: {
    'kwitansi': tr("Kwitansi"),
    'invoice': tr("Invoice"),
    'struk': tr("Struk / Nota"),
    'kartu-nama': tr("Kartu Nama"),
    'name-tag': tr("Name Tag Studio"),
    'kupon': tr("Kupon, Voucher & Tiket"),
    'surat': tr("Pembuat Surat"),
    'sertifikat': tr("Sertifikat & Piagam"),
    'wa-link': tr("WA Link"),
    'pembuat-cv': tr("Pembuat CV"),
  },
  video: {
    'konversi': tr("Konversi Video"),
    'kompres': tr("Kompres Video"),
    'potong': tr("Potong Video"),
    'crop': tr("Crop & Resize"),
    'subtitle': tr("Teks & Subtitle (CC)"),
    'gabung': tr("Gabung & Transisi"),
    'filter': tr("Kecepatan & Filter"),
    'thumbnail': tr("Tangkap Thumbnail / Screenshot"),
  },
  audio: {
    'konversi': tr("Konversi Audio"),
    'kompres': tr("Kompres Audio"),
    'visualizer': tr("Audio Visualizer"),
    'edit-audio': tr("Edit Audio"),
    'transkrip-audio': tr("Transkrip Audio"),
    'suara-ke-teks': tr("Speech to Text"),
    'teks-ke-suara': tr("Text to Speech"),
    'pengukur-suara': tr("Pengukur Kekuatan Suara"),
    'ekstrak-audio-video': tr("Ekstrak Audio dari Video"),
  },
};

/** Kerangka ringan saat potongan kode halaman diunduh. Tinggi minimum mencegah footer melompat (CLS). */
function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 min-h-[100svh]">
      <span className="sr-only">{tr("Memuat…")}</span>
      <div aria-hidden="true" className="h-36 sm:h-40 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 animate-pulse" />
      <div aria-hidden="true" className="mt-6 h-72 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 animate-pulse" />
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();

  // Font generator (Google Fonts) hanya dimuat saat sebuah alat dibuka — bukan di beranda / halaman informasi.
  useEffect(() => {
    if (pathname === "/" || /^\/(about|faq|privacy|terms)\/?$/.test(pathname)) return;
    loadWebFonts();
  }, [pathname]);
  const isHome = pathname === '/';
  const [category, mode] = pathname.split('/').filter(Boolean);

  const categoryLabel = category ? CATEGORY_LABELS[category] : undefined;
  const modeLabel = category && mode ? MODE_LABELS[category]?.[mode] : undefined;

  // Tema warna kategori dipasang di <html> (bukan di wrapper) supaya popover/tooltip yang dirender ke <body>
  // lewat portal ikut berwarna sama. Beranda & halaman info = tema merek (tanpa atribut).
  const theme = themeForPath(pathname);
  useLayoutEffect(() => {
    const el = document.documentElement;
    if (theme) el.dataset.gpTheme = theme; else delete el.dataset.gpTheme;
  }, [theme]);

  return (
    <GamatoToastProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
        <Header />
        {/* Header memakai position:fixed (selalu terlihat di ponsel, tanpa menggulir ke atas) → spacer setinggi header (64px + 1px border) menjaga isi tidak tertutup. */}
        <div aria-hidden="true" className="h-[65px] shrink-0" />
      <main className="flex-1 relative isolate">
        {/* Cahaya latar bertema di bawah header — mengikuti warna kategori aktif */}
        {!isHome && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-[radial-gradient(ellipse_75%_100%_at_50%_0%,color-mix(in_oklab,var(--color-indigo-500)_13%,transparent),transparent_72%)] dark:bg-[radial-gradient(ellipse_75%_100%_at_50%_0%,color-mix(in_oklab,var(--color-indigo-500)_22%,transparent),transparent_72%)]" />
        )}
        {/* Breadcrumb — only on non-home pages */}
        {!isHome && categoryLabel && (
          <div className="border-b border-slate-100/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 gp-blur">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
              <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
                <Link to="/" className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  <Home className="w-3 h-3" />
                  <span>{tr("Beranda")}</span>
                </Link>
                <ChevronRight className="w-3 h-3 shrink-0" />
                {modeLabel ? (
                  <>
                    <Link to={`/${category}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{categoryLabel}</Link>
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">{modeLabel}</span>
                  </>
                ) : (
                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{categoryLabel}</span>
                )}
              </nav>
            </div>
          </div>
        )}
        <div key={pathname} className="gp-page-in">
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Footer />
      </div>
    </GamatoToastProvider>
  );
}
