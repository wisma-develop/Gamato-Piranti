import { Outlet, useLocation, Link } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { ChevronRight, Home } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  qr: 'Kode',
  pdf: 'Dokumen',
  docs: 'Doc Studio',
  image: 'Gambar',
  utility: 'Utilitas',
  special: 'Spesial',
  video: 'Video',
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
    'scan-qr': 'QR Code Scanner',
  },
  pdf: {
    'gabung': 'Gabung PDF',
    'pecah': 'Pecah PDF',
    'kompres': 'Kompres PDF',
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
    'suara-ke-teks': 'Speech to Text',
    'teks-ke-suara': 'Text to Speech',
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
  },
  utility: {
    'json-base64': 'JSON & Base64',
    'bulk-teks': 'Bulk Teks',
    'link-media': 'Link Media',
    'alias-email': 'Alias Email',
    'kalkulator-pajak': 'Kalkulator Pajak',
    'kalkulator-bunga': 'Kalkulator Bunga',
    'statistik': 'Statistik',
    'password-token': 'Password & Token',
    'kamus-dunia': 'Kamus Dunia',
    'html-preview': 'HTML Preview',
    'diagram-rumus': 'Diagram & Rumus Studio',
    'pengukur-suara': 'Pengukur Kekuatan Suara',
    'kalkulator': 'Kalkulator',
  },
  special: {
    'kwitansi': 'Kwitansi',
    'invoice': 'Invoice',
    'struk': 'Struk / Nota',
    'kartu-nama': 'Kartu Nama',
    'sertifikat': 'Sertifikat & Piagam',
    'wa-link': 'WA Link',
    'pembuat-cv': 'Pembuat CV',
  },
  video: {
    'potong': 'Potong Video',
    'crop': 'Crop & Resize',
    'subtitle': 'Teks & Subtitle (CC)',
    'gabung': 'Gabung & Transisi',
    'filter': 'Kecepatan & Filter',
    'audio-thumbnail': 'Ekstrak Audio & Thumbnail',
  },
};

export default function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const [category, mode] = pathname.split('/').filter(Boolean);

  const categoryLabel = category ? CATEGORY_LABELS[category] : undefined;
  const modeLabel = category && mode ? MODE_LABELS[category]?.[mode] : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Breadcrumb — only on non-home pages */}
        {!isHome && categoryLabel && (
          <div className="border-b border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70">
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
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
