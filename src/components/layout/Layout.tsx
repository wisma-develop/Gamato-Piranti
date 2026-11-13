import { Suspense, useLayoutEffect } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { ChevronRight, Home } from 'lucide-react';
import { GamatoToastProvider } from '@/components/ui/GamatoToast';
import { themeForPath } from '@/lib/categoryTheme';

const CATEGORY_LABELS: Record<string, string> = {
  qr: 'Kode',
  pdf: 'Dokumen',
  docs: 'Doc Studio',
  office: 'Office Tools',
  image: 'Gambar',
  utility: 'Utilitas',
  special: 'Spesial',
  video: 'Video',
  audio: 'Audio',
  about: 'Tentang Kami',
  privacy: 'Kebijakan Privasi',
  terms: 'Ketentuan Layanan',
};

// Sub-feature labels, namespaced per category since slugs like "kompres"/"putar" repeat across sections.
const MODE_LABELS: Record<string, Record<string, string>> = {
  qr: {
    'qr-code': 'QR Code',
    'barcode': 'Barcode',
    'scan-hid': 'Scan HID',
    'kode-morse': 'Kode Morse',
    'scan-qr': 'QR & Barcode Scanner',
  },
  office: {
    'doc-studio': 'Doc Studio',
    'sheet-studio': 'Sheet Studio',
    'slide-studio': 'Slide Studio',
  },
  pdf: {
    'gabung': 'Gabung PDF',
    'pecah': 'Pecah PDF',
    'kompres': 'Kompres PDF',
    'kompres-dokumen': 'Kompres Dokumen',
    'ekstrak': 'Ekstrak Halaman',
    'hapus-halaman': 'Hapus Halaman',
    'putar': 'Putar Halaman',
    'atur-ulang': 'Atur Ulang Halaman',
    'gambar-ke-pdf': 'Gambar ke PDF',
    'teks-ke-pdf': 'Teks ke PDF',
    'word-ke-pdf': 'Word ke PDF',
    'excel-ke-pdf': 'Excel ke PDF',
    'ppt-ke-pdf': 'PowerPoint ke PDF',
    'edit': 'Edit PDF',
    'tanda-tangan': 'Tanda Tangan PDF',
    'watermark': 'Watermark PDF',
    'html-ke-pdf': 'HTML ke PDF',
    'nomor-halaman': 'Nomor Halaman',
    'unlock': 'Unlock PDF',
    'reader': 'PDF Reader',
    'sensor': 'Sensor / Redaksi PDF',
    'scan': 'Scan PDF',
    'ke-gambar': 'PDF ke Gambar',
    'ke-word': 'PDF ke Word',
    'ke-excel': 'PDF ke Excel',
    'ocr': 'OCR',
    'protect': 'Protect PDF',
    'baca-dokumen': 'Doc Reader',
  },
  image: {
    'kompres': 'Kompres Gambar',
    'resize': 'Ubah Ukuran',
    'konversi': 'Konversi Format',
    'putar': 'Putar Gambar',
    'hapus-metadata': 'Hapus Metadata',
    'raw-preview': 'Baca Foto RAW',
    'crop': 'Crop Gambar',
    'hapus-background': 'Hapus Background',
    'watermark': 'Watermark Gambar',
    'html-ke-gambar': 'HTML ke Gambar',
    'color-picker': 'Color Picker & Palette',
    'meme-generator': 'Meme Generator',
    'photo-editor': 'Photo Editor',
    'cetak-foto': 'Cetak Foto',
    'kolase': 'Kolase Gambar',
  },
  utility: {
    'json-base64': 'JSON & Base64',
    'bulk-teks': 'Bulk Teks',
    'capture-website': 'Capture Website',
    'koordinat': 'Koordinat',
    'cetak': 'Cetak File & Dokumen',
    'link-media': 'Link Media',
    'alias-email': 'Alias Email',
    'kalkulator-pajak': 'Kalkulator Pajak',
    'kalkulator-bunga': 'Kalkulator Bunga',
    'statistik': 'Statistik',
    'password-token': 'Password & Token',
    'kamus-dunia': 'Kamus Dunia',
    'html-preview': 'HTML Preview',
    'diagram-rumus': 'Diagram & Rumus Studio',
    'convert': 'Universal Converter',
    'kalkulator': 'Kalkulator',
  },
  special: {
    'kwitansi': 'Kwitansi',
    'invoice': 'Invoice',
    'struk': 'Struk / Nota',
    'kartu-nama': 'Kartu Nama',
    'name-tag': 'Name Tag Studio',
    'kupon': 'Kupon, Voucher & Tiket',
    'surat': 'Pembuat Surat',
    'sertifikat': 'Sertifikat & Piagam',
    'wa-link': 'WA Link',
    'pembuat-cv': 'Pembuat CV',
  },
  video: {
    'konversi': 'Konversi Video',
    'kompres': 'Kompres Video',
    'potong': 'Potong Video',
    'crop': 'Crop & Resize',
    'subtitle': 'Teks & Subtitle (CC)',
    'gabung': 'Gabung & Transisi',
    'filter': 'Kecepatan & Filter',
    'thumbnail': 'Tangkap Thumbnail / Screenshot',
  },
  audio: {
    'konversi': 'Konversi Audio',
    'kompres': 'Kompres Audio',
    'visualizer': 'Audio Visualizer',
    'edit-audio': 'Edit Audio',
    'transkrip-audio': 'Transkrip Audio',
    'suara-ke-teks': 'Speech to Text',
    'teks-ke-suara': 'Text to Speech',
    'pengukur-suara': 'Pengukur Kekuatan Suara',
    'ekstrak-audio-video': 'Ekstrak Audio dari Video',
  },
};

/** Kerangka ringan saat potongan kode halaman diunduh. Tinggi minimum mencegah footer melompat (CLS). */
function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 min-h-[100svh]">
      <span className="sr-only">Memuat…</span>
      <div aria-hidden="true" className="h-36 sm:h-40 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 animate-pulse" />
      <div aria-hidden="true" className="mt-6 h-72 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 animate-pulse" />
    </div>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
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
                  <span>Beranda</span>
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
