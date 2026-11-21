import { useState, useRef, useEffect, Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, X, ChevronDown,
  FileText, Image as ImageIcon, QrCode, SlidersHorizontal,
  Barcode, Info, BookOpen, Code2, HelpCircle,
  Layers, FileOutput, FileDown, FilePlus, FileX, RotateCw,
  FileImage, AlignLeft, ArrowLeftRight, Wand2,
  ListOrdered, Radio, Mail, Calculator, BarChart3,
  MessageCircle, KeyRound, Eraser, Sun, Moon, Sparkles, Award,
  Camera, Crop, Smile, PenSquare, PenLine, ScanLine, Type, ShieldCheck, Mic, Volume2,
  Languages, AppWindow, Workflow, Gauge,
  Receipt, FileSpreadsheet, ShoppingBag,
  Clapperboard, Scissors, Captions, AudioWaveform, ScrollText, Shrink,
  Pipette,
  IdCard,
  Files, FileType2, Sheet,
  TicketPercent,
  MailOpen,
  AudioLines,
  EyeOff,
  Presentation,
  Printer,
  Table2,
  RefreshCw,
  LayoutGrid,
  MapPin,
  Tag,
} from 'lucide-react';
import { Presence } from '@/hooks/usePresence';
import { useDarkMode } from '@/hooks/useDarkMode';
import { GamatoTooltip } from '@/components/ui/GamatoTooltip';
import { SearchTrigger } from '@/components/search/ToolSearch';
import LangSwitch from '@/components/layout/LangSwitch';
import { tr } from "@/i18n";

export type DropGroup = 'kode' | 'dokumen' | 'office' | 'gambar' | 'utilitas' | 'spesial' | 'video' | 'audio' | null;

export type MenuItem = { name: string; path: string; icon: ReactNode; section?: string };

export const menuGroups: { id: Exclude<DropGroup, null>; title: string; icon: ReactNode; rootPath: string; items: MenuItem[] }[] = [
  {
    id: 'kode',
    title: tr("Kode"),
    icon: <QrCode className="w-4 h-4" />,
    rootPath: '/qr',
    items: [
      { name: tr("QR Code"), path: '/qr/qr-code', icon: <QrCode className="w-4 h-4 text-teal-500" /> },
      { name: tr("Barcode"), path: '/qr/barcode', icon: <Barcode className="w-4 h-4 text-teal-500" /> },
      { name: tr("Scan HID"), path: '/qr/scan-hid', icon: <Barcode className="w-4 h-4 text-teal-500" /> },
      { name: tr("Kode Morse"), path: '/qr/kode-morse', icon: <Radio className="w-4 h-4 text-teal-500" /> },
      { name: tr("QR & Barcode Scanner"), path: '/qr/scan-qr', icon: <ScanLine className="w-4 h-4 text-teal-500" /> },
    ],
  },
  {
    id: 'dokumen',
    title: tr("Dokumen"),
    icon: <FileText className="w-4 h-4" />,
    rootPath: '/pdf',
    items: [
      { name: tr("Word ke PDF"),       path: '/pdf/word-ke-pdf',   icon: <FileText className="w-4 h-4 text-blue-500" />, section: tr("Konversi Dokumen") },
      { name: tr("Excel ke PDF"),      path: '/pdf/excel-ke-pdf',  icon: <BarChart3 className="w-4 h-4 text-blue-500" />, section: tr("Konversi Dokumen") },
      { name: tr("PowerPoint ke PDF"), path: '/pdf/ppt-ke-pdf',    icon: <Layers className="w-4 h-4 text-blue-500" />, section: tr("Konversi Dokumen") },
      { name: tr("Gambar ke PDF"),     path: '/pdf/gambar-ke-pdf', icon: <FileImage className="w-4 h-4 text-blue-500" />, section: tr("Konversi Dokumen") },
      { name: tr("Teks ke PDF"),       path: '/pdf/teks-ke-pdf',   icon: <AlignLeft className="w-4 h-4 text-blue-500" />, section: tr("Konversi Dokumen") },
      { name: tr("HTML ke PDF"),       path: '/pdf/html-ke-pdf',   icon: <Code2 className="w-4 h-4 text-blue-500" />, section: tr("Konversi Dokumen") },
      { name: tr("PDF ke Gambar"),     path: '/pdf/ke-gambar',     icon: <FileImage className="w-4 h-4 text-blue-500" />, section: tr("Konversi dari PDF") },
      { name: tr("PDF ke Word"),       path: '/pdf/ke-word',       icon: <FileText className="w-4 h-4 text-blue-500" />, section: tr("Konversi dari PDF") },
      { name: tr("PDF ke Excel"),      path: '/pdf/ke-excel',      icon: <BarChart3 className="w-4 h-4 text-blue-500" />, section: tr("Konversi dari PDF") },
      { name: tr("OCR"),               path: '/pdf/ocr',           icon: <Type className="w-4 h-4 text-blue-500" />, section: tr("Konversi dari PDF") },
      { name: tr("Gabung PDF"),        path: '/pdf/gabung',        icon: <Layers className="w-4 h-4 text-blue-500" />, section: tr("PDF Lab – Suite") },
      { name: tr("Pecah PDF"),         path: '/pdf/pecah',         icon: <FileOutput className="w-4 h-4 text-blue-500" />, section: tr("PDF Lab – Suite") },
      { name: tr("Kompres Dokumen"),   path: '/pdf/kompres-dokumen', icon: <Shrink className="w-4 h-4 text-blue-500" />, section: tr("PDF Lab – Suite") },
      { name: tr("Kompres PDF"),       path: '/pdf/kompres',       icon: <FileDown className="w-4 h-4 text-blue-500" />, section: tr("PDF Lab – Suite") },
      { name: tr("Ekstrak Halaman"),   path: '/pdf/ekstrak',       icon: <FilePlus className="w-4 h-4 text-blue-500" />, section: tr("PDF Lab – Suite") },
      { name: tr("Hapus Halaman"),     path: '/pdf/hapus-halaman', icon: <FileX className="w-4 h-4 text-blue-500" />, section: tr("PDF Lab – Suite") },
      { name: tr("Putar Halaman"),     path: '/pdf/putar',         icon: <RotateCw className="w-4 h-4 text-blue-500" />, section: tr("PDF Lab – Suite") },
      { name: tr("Atur Ulang Halaman"),path: '/pdf/atur-ulang',    icon: <SlidersHorizontal className="w-4 h-4 text-blue-500" />, section: tr("PDF Lab – Suite") },
      { name: tr("Edit PDF"),          path: '/pdf/edit',          icon: <PenSquare className="w-4 h-4 text-blue-500" />, section: tr("Keamanan & Anotasi") },
      { name: tr("Tanda Tangan PDF"),  path: '/pdf/tanda-tangan',  icon: <PenLine className="w-4 h-4 text-blue-500" />, section: tr("Keamanan & Anotasi") },
      { name: tr("Watermark PDF"),     path: '/pdf/watermark',     icon: <Layers className="w-4 h-4 text-blue-500" />, section: tr("Keamanan & Anotasi") },
      { name: tr("Nomor Halaman"),     path: '/pdf/nomor-halaman', icon: <ListOrdered className="w-4 h-4 text-blue-500" />, section: tr("Keamanan & Anotasi") },
      { name: tr("Protect PDF"),       path: '/pdf/protect',       icon: <ShieldCheck className="w-4 h-4 text-blue-500" />, section: tr("Keamanan & Anotasi") },
      { name: tr("Unlock PDF"),        path: '/pdf/unlock',        icon: <KeyRound className="w-4 h-4 text-blue-500" />, section: tr("Keamanan & Anotasi") },
      { name: tr("PDF Reader"),        path: '/pdf/reader',        icon: <BookOpen className="w-4 h-4 text-blue-500" />, section: tr("Baca & Pindai") },
      { name: tr("Sensor / Redaksi PDF"), path: '/pdf/sensor',     icon: <EyeOff className="w-4 h-4 text-blue-500" />, section: tr("Baca & Pindai") },
      { name: tr("Scan PDF"),          path: '/pdf/scan',          icon: <ScanLine className="w-4 h-4 text-blue-500" />, section: tr("Baca & Pindai") },
      { name: tr("Doc Reader"),        path: '/pdf/baca-dokumen',  icon: <BookOpen className="w-4 h-4 text-blue-500" />, section: tr("Baca & Pindai") },
    ],
  },
  {
    id: 'office',
    title: tr("Office"),
    icon: <Presentation className="w-4 h-4" />,
    rootPath: '/office',
    items: [
      { name: tr("Doc Studio"),   path: '/office/doc-studio',   icon: <BookOpen className="w-4 h-4 text-violet-500" /> },
      { name: tr("Sheet Studio"), path: '/office/sheet-studio', icon: <Table2 className="w-4 h-4 text-violet-500" /> },
      { name: tr("Slide Studio"), path: '/office/slide-studio', icon: <Presentation className="w-4 h-4 text-violet-500" /> },
      { name: tr("Diagram & Rumus Studio"), path: '/office/diagram-rumus', icon: <Workflow className="w-4 h-4 text-violet-500" /> },
    ],
  },
  {
    id: 'gambar',
    title: tr("Gambar"),
    icon: <ImageIcon className="w-4 h-4" />,
    rootPath: '/image',
    items: [
      { name: tr("Kolase Gambar"),  path: '/image/kolase',           icon: <LayoutGrid className="w-4 h-4 text-orange-500" />, section: tr("Kolase & Cetak") },
      { name: tr("Cetak Foto"),     path: '/image/cetak-foto',       icon: <Printer className="w-4 h-4 text-orange-500" />, section: tr("Kolase & Cetak") },
      { name: tr("Photo Editor"),   path: '/image/photo-editor',     icon: <SlidersHorizontal className="w-4 h-4 text-orange-500" />, section: tr("Edit & Perbaiki") },
      { name: tr("Crop Gambar"),    path: '/image/crop',              icon: <Crop className="w-4 h-4 text-orange-500" />, section: tr("Edit & Perbaiki") },
      { name: tr("Putar Gambar"),   path: '/image/putar',             icon: <RotateCw className="w-4 h-4 text-orange-500" />, section: tr("Edit & Perbaiki") },
      { name: tr("Hapus Background"), path: '/image/hapus-background', icon: <Eraser className="w-4 h-4 text-orange-500" />, section: tr("Edit & Perbaiki") },
      { name: tr("Watermark Gambar"), path: '/image/watermark',       icon: <Layers className="w-4 h-4 text-orange-500" />, section: tr("Kreatif") },
      { name: tr("Meme Generator"), path: '/image/meme-generator',    icon: <Smile className="w-4 h-4 text-orange-500" />, section: tr("Kreatif") },
      { name: tr("HTML ke Gambar"), path: '/image/html-ke-gambar',    icon: <Code2 className="w-4 h-4 text-orange-500" />, section: tr("Kreatif") },
      { name: tr("Color Picker & Palette"), path: '/image/color-picker', icon: <Pipette className="w-4 h-4 text-orange-500" />, section: tr("Kreatif") },
      { name: tr("Kompres Gambar"), path: '/image/kompres',  icon: <FileDown className="w-4 h-4 text-orange-500" />, section: tr("Konversi & Optimasi") },
      { name: tr("Ubah Ukuran"),    path: '/image/resize',   icon: <ArrowLeftRight className="w-4 h-4 text-orange-500" />, section: tr("Konversi & Optimasi") },
      { name: tr("Konversi Format"),path: '/image/konversi', icon: <Wand2 className="w-4 h-4 text-orange-500" />, section: tr("Konversi & Optimasi") },
      { name: tr("Baca Foto RAW"),  path: '/image/raw-preview', icon: <Camera className="w-4 h-4 text-orange-500" />, section: tr("Konversi & Optimasi") },
      { name: tr("Hapus Metadata"), path: '/image/hapus-metadata', icon: <Eraser className="w-4 h-4 text-orange-500" />, section: tr("Konversi & Optimasi") },
      { name: tr("Semua Dokumen ke Gambar"), path: '/image/dokumen-ke-gambar', icon: <Files className="w-4 h-4 text-orange-500" />, section: tr("Dokumen ke Gambar") },
      { name: tr("PDF ke Gambar"),    path: '/image/pdf-ke-gambar',   icon: <FileText className="w-4 h-4 text-orange-500" />, section: tr("Dokumen ke Gambar") },
      { name: tr("Word ke Gambar"),   path: '/image/word-ke-gambar',  icon: <FileType2 className="w-4 h-4 text-orange-500" />, section: tr("Dokumen ke Gambar") },
      { name: tr("PowerPoint ke Gambar"), path: '/image/ppt-ke-gambar', icon: <Presentation className="w-4 h-4 text-orange-500" />, section: tr("Dokumen ke Gambar") },
      { name: tr("Excel & CSV ke Gambar"), path: '/image/excel-ke-gambar', icon: <Sheet className="w-4 h-4 text-orange-500" />, section: tr("Dokumen ke Gambar") },
      { name: tr("Teks & Markdown ke Gambar"), path: '/image/teks-ke-gambar', icon: <AlignLeft className="w-4 h-4 text-orange-500" />, section: tr("Dokumen ke Gambar") },
    ],
  },
  {
    id: 'video',
    title: tr("Video"),
    icon: <Clapperboard className="w-4 h-4" />,
    rootPath: '/video',
    items: [
      { name: tr("Konversi Video"),    path: '/video/konversi', icon: <RefreshCw className="w-4 h-4 text-rose-500" /> },
      { name: tr("Kompres Video"),    path: '/video/kompres',  icon: <Shrink className="w-4 h-4 text-rose-500" /> },
      { name: tr("Potong Video"),      path: '/video/potong',   icon: <Scissors className="w-4 h-4 text-rose-500" /> },
      { name: tr("Crop & Resize"),     path: '/video/crop',     icon: <Crop className="w-4 h-4 text-rose-500" /> },
      { name: tr("Teks & Subtitle (CC)"), path: '/video/subtitle', icon: <Captions className="w-4 h-4 text-rose-500" /> },
      { name: tr("Gabung & Transisi"), path: '/video/gabung',   icon: <Layers className="w-4 h-4 text-rose-500" /> },
      { name: tr("Kecepatan & Filter"), path: '/video/filter',  icon: <Sparkles className="w-4 h-4 text-rose-500" /> },
      { name: tr("Tangkap Thumbnail / Screenshot"), path: '/video/thumbnail', icon: <Camera className="w-4 h-4 text-rose-500" /> },
    ],
  },
  {
    id: 'audio',
    title: tr("Audio"),
    icon: <AudioLines className="w-4 h-4" />,
    rootPath: '/audio',
    items: [
      { name: tr("Konversi Audio"),            path: '/audio/konversi',            icon: <RefreshCw className="w-4 h-4 text-cyan-500" /> },
      { name: tr("Kompres Audio"),             path: '/audio/kompres',             icon: <Shrink className="w-4 h-4 text-cyan-500" /> },
      { name: tr("Edit Audio"),                path: '/audio/edit-audio',          icon: <AudioWaveform className="w-4 h-4 text-cyan-500" /> },
      { name: tr("Audio Visualizer"),          path: '/audio/visualizer',          icon: <AudioLines className="w-4 h-4 text-cyan-500" /> },
      { name: tr("Transkrip Audio"),           path: '/audio/transkrip-audio',     icon: <ScrollText className="w-4 h-4 text-cyan-500" /> },
      { name: tr("Speech to Text"),            path: '/audio/suara-ke-teks',       icon: <Mic className="w-4 h-4 text-cyan-500" /> },
      { name: tr("Text to Speech"),            path: '/audio/teks-ke-suara',       icon: <Volume2 className="w-4 h-4 text-cyan-500" /> },
      { name: tr("Pengukur Kekuatan Suara"),   path: '/audio/pengukur-suara',      icon: <Gauge className="w-4 h-4 text-cyan-500" /> },
      { name: tr("Ekstrak Audio dari Video"),  path: '/audio/ekstrak-audio-video', icon: <AudioLines className="w-4 h-4 text-cyan-500" /> },
    ],
  },
  {
    id: 'utilitas',
    title: tr("Utilitas"),
    icon: <SlidersHorizontal className="w-4 h-4" />,
    rootPath: '/utility',
    items: [
      { name: tr("Kalkulator"),       path: '/utility/kalkulator',       icon: <Calculator className="w-4 h-4 text-pink-500" />, section: tr("Kalkulator") },
      { name: tr("Universal Converter"), path: '/utility/convert',       icon: <RefreshCw className="w-4 h-4 text-pink-500" />, section: tr("Konversi") },
      { name: tr("Kamus Dunia"),      path: '/utility/kamus-dunia',      icon: <Languages className="w-4 h-4 text-pink-500" />, section: tr("Bahasa & Konten") },
      { name: tr("HTML Preview"),     path: '/utility/html-preview',     icon: <AppWindow className="w-4 h-4 text-pink-500" />, section: tr("Bahasa & Konten") },
      { name: tr("Capture Website"),  path: '/utility/capture-website',  icon: <Camera className="w-4 h-4 text-pink-500" />, section: tr("Bahasa & Konten") },
      { name: tr("Koordinat"),        path: '/utility/koordinat',        icon: <MapPin className="w-4 h-4 text-pink-500" />, section: tr("Bahasa & Konten") },
      { name: tr("JSON & Base64"),    path: '/utility/json-base64',      icon: <Code2 className="w-4 h-4 text-pink-500" />, section: tr("Data & Teks") },
      { name: tr("Bulk Teks"),        path: '/utility/bulk-teks',        icon: <ListOrdered className="w-4 h-4 text-pink-500" />, section: tr("Data & Teks") },
      { name: tr("Statistik"),        path: '/utility/statistik',        icon: <BarChart3 className="w-4 h-4 text-pink-500" />, section: tr("Data & Teks") },
      { name: tr("Cetak File & Dokumen"), path: '/utility/cetak',        icon: <Printer className="w-4 h-4 text-pink-500" />, section: tr("Lainnya") },
      { name: tr("Link Media"),       path: '/utility/link-media',       icon: <Radio className="w-4 h-4 text-pink-500" />, section: tr("Lainnya") },
      { name: tr("Alias Email"),      path: '/utility/alias-email',      icon: <Mail className="w-4 h-4 text-pink-500" />, section: tr("Lainnya") },
      { name: tr("Password & Token"), path: '/utility/password-token',   icon: <KeyRound className="w-4 h-4 text-pink-500" />, section: tr("Lainnya") },
    ],
  },
  {
    id: 'spesial',
    title: tr("Spesial"),
    icon: <Sparkles className="w-4 h-4" />,
    rootPath: '/special',
    items: [
      { name: tr("Kwitansi"),            path: '/special/kwitansi',   icon: <Receipt className="w-4 h-4 text-amber-500" />, section: tr("Dokumen Bisnis") },
      { name: tr("Invoice"),             path: '/special/invoice',    icon: <FileSpreadsheet className="w-4 h-4 text-amber-500" />, section: tr("Dokumen Bisnis") },
      { name: tr("Struk / Nota"),        path: '/special/struk',      icon: <ShoppingBag className="w-4 h-4 text-amber-500" />, section: tr("Dokumen Bisnis") },
      { name: tr("Kartu Nama"),          path: '/special/kartu-nama', icon: <IdCard className="w-4 h-4 text-amber-500" />, section: tr("Dokumen Bisnis") },
      { name: tr("Name Tag"),            path: '/special/name-tag',   icon: <Tag className="w-4 h-4 text-amber-500" />, section: tr("Dokumen Bisnis") },
      { name: tr("Pembuat Surat"), path: '/special/surat', icon: <MailOpen className="w-4 h-4 text-sky-500" />, section: tr("Dokumen Bisnis") },
      { name: tr("Kupon, Voucher & Tiket"), path: '/special/kupon',    icon: <TicketPercent className="w-4 h-4 text-amber-500" />, section: tr("Dokumen Bisnis") },
      { name: tr("Sertifikat & Piagam"), path: '/special/sertifikat', icon: <Award className="w-4 h-4 text-amber-500" />, section: tr("Lainnya") },
      { name: tr("WA Link"),             path: '/special/wa-link',    icon: <MessageCircle className="w-4 h-4 text-amber-500" />, section: tr("Lainnya") },
      { name: tr("Pembuat CV"),          path: '/special/pembuat-cv', icon: <FileText className="w-4 h-4 text-amber-500" />, section: tr("Lainnya") },
    ],
  },
];

const policyLinks = [
  { name: tr("Tentang Kami"),       path: '/about',   icon: <Info className="w-4 h-4 text-slate-400" /> },
  { name: tr("FAQ"),                path: '/faq',     icon: <HelpCircle className="w-4 h-4 text-slate-400" /> },
  { name: tr("Kebijakan Privasi"),  path: '/privacy', icon: <BookOpen className="w-4 h-4 text-slate-400" /> },
  { name: tr("Ketentuan Layanan"),  path: '/terms',   icon: <FileText className="w-4 h-4 text-slate-400" /> },
];

/** Renders a flat item list, inserting a small section label whenever `section` changes. */
function GroupedItems({ items, onNavigate, dense }: { items: MenuItem[]; onNavigate: () => void; dense?: boolean }) {
  let lastSection: string | undefined;
  return (
    <>
      {items.map((item) => {
        const showHeader = item.section && item.section !== lastSection;
        lastSection = item.section;
        return (
          <Fragment key={item.path}>
            {showHeader && (
              <div className="col-span-full px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {item.section}
              </div>
            )}
            <Link
              to={item.path}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-xl transition-colors group/item ${dense ? 'p-2' : 'p-2.5'}`}
            >
              <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg shadow-sm ring-1 ring-slate-100 dark:ring-slate-700 group-hover/item:shadow-md group-hover/item:ring-indigo-100 dark:group-hover/item:ring-indigo-500/30 transition-all shrink-0">
                {item.icon}
              </div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover/item:text-indigo-600 dark:group-hover/item:text-indigo-400 transition-colors truncate">
                {item.name}
              </div>
            </Link>
          </Fragment>
        );
      })}
    </>
  );
}

/** Garis progres gulir — satu listener pasif + rAF, menulis transform langsung (tanpa re-render React). */
function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current; if (!el) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.style.transform = `scaleX(${max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} aria-hidden="true" data-testid="scroll-progress" className="absolute inset-x-0 -bottom-px h-[2px] origin-left scale-x-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400 pointer-events-none" />;
}

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 6);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<DropGroup>(null);
  const [activeDropdown, setActiveDropdown] = useState<DropGroup>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { isDark, toggle: toggleTheme } = useDarkMode();

  useEffect(() => { setMobileOpen(false); setActiveDropdown(null); }, [location]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setActiveDropdown(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isActive = (items: { path: string }[]) => items.some(i => location.pathname === i.path);

  return (
    <header data-testid="site-header" className={`fixed inset-x-0 top-0 z-50 bg-white/90 dark:bg-slate-900/90 gp-blur border-b transition-shadow duration-300 ${scrolled ? "border-slate-200 dark:border-slate-800 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.18)] dark:shadow-[0_6px_24px_-12px_rgba(0,0,0,0.6)]" : "border-slate-200/70 dark:border-slate-800"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm group-hover:shadow-md group-hover:ring-indigo-200 dark:group-hover:ring-indigo-500/40 transition-[box-shadow,--tw-ring-color,rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110">
              <img src="/gamato-piranti-128.webp" width={36} height={36} alt={tr("Gamato Piranti")} className="w-9 h-9 object-cover" />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {tr("Gamato")}<span className="text-slate-400 dark:text-slate-500 font-normal">{tr("Piranti")}</span>
              </span>
              <div className="flex items-center gap-1 -mt-0.5">
                <span className="text-[10px] font-semibold text-slate-300 tracking-wide">{tr("by WisDev")}</span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation — only shown from `xl:` (1280px) up. Below that, the hamburger
              menu takes over. This threshold is deliberate, not arbitrary: with 8 category
              dropdowns + the About/theme buttons, the full labelled nav needs ~940px of room
              and the header's content area is capped by `max-w-7xl`, so anything narrower
              (including the very common 1024–1279px laptop/tablet-landscape range) would
              wrap or visually crowd together. Verified to fit with 140px+ to spare at 1280px
              and beyond. */}
          <nav className="hidden xl:flex items-center gap-0.5" ref={dropdownRef}>
            {menuGroups.map((group, groupIndex) => {
              const wide = group.items.length > 4;
              // Keep each dropdown panel inside the viewport: first item hugs the left edge,
              // last two hug the right edge, everything else stays centered under its button.
              const isFirst = groupIndex === 0;
              const isNearEnd = groupIndex >= menuGroups.length - 2;
              const alignClass = isFirst ? 'left-0' : isNearEnd ? 'right-0' : 'left-1/2 -translate-x-1/2';
              return (
                <div key={group.id} className="relative">
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === group.id ? null : group.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                      activeDropdown === group.id || isActive(group.items)
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {group.icon}
                    <span>{group.title}</span>
                    <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${activeDropdown === group.id ? 'rotate-180' : ''}`} />
                  </button>

                  <Presence
                    show={activeDropdown === group.id}
                    exitMs={130}
                    openClassName="opacity-100 translate-y-0 scale-100"
                    closedClassName="opacity-0 translate-y-2 scale-[0.97]"
                    className={`absolute top-full ${alignClass} mt-2 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden transition-[opacity,translate,scale] duration-150 ease-out ${wide ? 'w-[380px]' : 'w-64'}`}
                  >
                        <div className={`p-2 max-h-[70vh] overflow-y-auto ${wide ? 'grid grid-cols-2 gap-0.5' : 'space-y-0.5'}`}>
                          <GroupedItems items={group.items} onNavigate={() => setActiveDropdown(null)} dense={wide} />
                        </div>
                        <Link
                          to={group.rootPath}
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-500/10 border-t border-slate-100 dark:border-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                        >{tr("Lihat semua {0}", group.title)}</Link>
                  </Presence>
                </div>
              );
            })}

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

            <GamatoTooltip label={tr("Cari alat (Ctrl K)")}>
              <SearchTrigger className="!px-2.5" />
            </GamatoTooltip>

            <GamatoTooltip label={tr("Tentang Kami")}>
              <Link
                to="/about"
                aria-label={tr("Tentang Kami")}
                className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                  location.pathname === '/about' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <Info className="w-4 h-4" />
              </Link>
            </GamatoTooltip>

            <LangSwitch className="mx-1" />

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? tr("Aktifkan mode terang") : tr("Aktifkan mode gelap")}
              title={isDark ? tr("Mode terang") : tr("Mode gelap")}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </nav>

          {/* Mobile theme toggle + hamburger — mirrors the nav's xl: cutover above */}
          <div className="xl:hidden flex items-center gap-1">
            <SearchTrigger compact className="!rounded-xl" />
            <LangSwitch />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? tr("Aktifkan mode terang") : tr("Aktifkan mode gelap")}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              aria-label={tr("Toggle menu")}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <Presence
        show={mobileOpen}
        exitMs={200}
        openClassName="grid-rows-[1fr] opacity-100"
        closedClassName="grid-rows-[0fr] opacity-0"
        className="xl:hidden grid transition-[grid-template-rows,opacity] duration-200 ease-out bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800"
      >
          <div className="min-h-0 overflow-hidden">
            <div className="px-4 py-5 space-y-3 max-h-[calc(100dvh-5rem)] overflow-y-auto">
              {menuGroups.map((group) => {
                const expanded = mobileExpanded === group.id;
                return (
                  <div key={group.id} className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setMobileExpanded(expanded ? null : group.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-3 text-sm font-bold transition-colors ${
                        isActive(group.items) ? 'text-indigo-600 bg-indigo-50/60 dark:text-indigo-300 dark:bg-indigo-500/10' : 'text-slate-700 bg-slate-50/60 dark:text-slate-200 dark:bg-slate-800/60'
                      }`}
                    >
                      <span className="flex items-center gap-2">{group.icon}<span>{group.title}</span></span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    <Presence
                      show={expanded}
                      exitMs={180}
                      openClassName="grid-rows-[1fr] opacity-100"
                      closedClassName="grid-rows-[0fr] opacity-0"
                      className="grid transition-[grid-template-rows,opacity] duration-200 ease-out"
                    >
                      <div className="min-h-0 overflow-hidden">
                          <div className="p-1.5">
                            <GroupedItems items={group.items} onNavigate={() => setMobileOpen(false)} />
                          </div>
                          <Link
                            to={group.rootPath}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center justify-center gap-1.5 mx-1.5 mb-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                          >{tr("Lihat semua {0}", group.title)}</Link>
                      </div>
                    </Presence>
                  </div>
                );
              })}

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-0.5">
                {policyLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {link.icon}<span>{link.name}</span>
                  </Link>
                ))}
              </div>

              {/* WisDev tag in mobile */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300 dark:text-slate-600 pt-1 border-t border-slate-100 dark:border-slate-800">
                <Code2 className="w-3 h-3" />
                <span>{tr("Powered by")}</span>
                <span className="text-slate-500 dark:text-slate-400 font-bold">{tr("WisDev")}</span>
              </div>
            </div>
          </div>
      </Presence>
      {/* Progres gulir halaman — garis tipis bergradien di tepi bawah header */}
      <ScrollProgress />
    </header>
  );
}
