import { useState, useRef, useEffect, Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, X, ChevronDown,
  FileText, Image as ImageIcon, QrCode, SlidersHorizontal,
  Barcode, Info, BookOpen, Code2,
  Layers, FileOutput, FileDown, FilePlus, FileX, RotateCw,
  FileImage, AlignLeft, ArrowLeftRight, Wand2,
  ListOrdered, Radio, Mail, Calculator, BarChart3,
  MessageCircle, KeyRound, Eraser, Sun, Moon, Sparkles, Award,
  Camera, Crop, Smile, PenSquare, PenLine, ScanLine, Type, ShieldCheck, Mic, Volume2,
  Languages, AppWindow, Workflow, Gauge,
  Receipt, FileSpreadsheet, ShoppingBag,
  Clapperboard, Scissors, Captions,
  Pipette,
  IdCard,
  AudioLines,
  EyeOff,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDarkMode } from '@/hooks/useDarkMode';
import { GamatoTooltip } from '@/components/ui/GamatoTooltip';

type DropGroup = 'kode' | 'dokumen' | 'gambar' | 'utilitas' | 'spesial' | 'video' | 'audio' | null;

type MenuItem = { name: string; path: string; icon: ReactNode; section?: string };

const menuGroups: { id: Exclude<DropGroup, null>; title: string; icon: ReactNode; rootPath: string; items: MenuItem[] }[] = [
  {
    id: 'kode',
    title: 'Kode',
    icon: <QrCode className="w-4 h-4" />,
    rootPath: '/qr',
    items: [
      { name: 'QR Code', path: '/qr/qr-code', icon: <QrCode className="w-4 h-4 text-teal-500" /> },
      { name: 'Barcode', path: '/qr/barcode', icon: <Barcode className="w-4 h-4 text-teal-500" /> },
      { name: 'Scan HID', path: '/qr/scan-hid', icon: <Barcode className="w-4 h-4 text-teal-500" /> },
      { name: 'Kode Morse', path: '/qr/kode-morse', icon: <Radio className="w-4 h-4 text-teal-500" /> },
      { name: 'QR Code Scanner', path: '/qr/scan-qr', icon: <ScanLine className="w-4 h-4 text-teal-500" /> },
    ],
  },
  {
    id: 'dokumen',
    title: 'Dokumen',
    icon: <FileText className="w-4 h-4" />,
    rootPath: '/pdf',
    items: [
      { name: 'Word ke PDF',       path: '/pdf/word-ke-pdf',   icon: <FileText className="w-4 h-4 text-blue-500" />, section: 'Konversi Dokumen' },
      { name: 'Excel ke PDF',      path: '/pdf/excel-ke-pdf',  icon: <BarChart3 className="w-4 h-4 text-blue-500" />, section: 'Konversi Dokumen' },
      { name: 'PowerPoint ke PDF', path: '/pdf/ppt-ke-pdf',    icon: <Layers className="w-4 h-4 text-blue-500" />, section: 'Konversi Dokumen' },
      { name: 'Gambar ke PDF',     path: '/pdf/gambar-ke-pdf', icon: <FileImage className="w-4 h-4 text-blue-500" />, section: 'Konversi Dokumen' },
      { name: 'Teks ke PDF',       path: '/pdf/teks-ke-pdf',   icon: <AlignLeft className="w-4 h-4 text-blue-500" />, section: 'Konversi Dokumen' },
      { name: 'HTML ke PDF',       path: '/pdf/html-ke-pdf',   icon: <Code2 className="w-4 h-4 text-blue-500" />, section: 'Konversi Dokumen' },
      { name: 'PDF ke Gambar',     path: '/pdf/ke-gambar',     icon: <FileImage className="w-4 h-4 text-blue-500" />, section: 'Konversi dari PDF' },
      { name: 'PDF ke Word',       path: '/pdf/ke-word',       icon: <FileText className="w-4 h-4 text-blue-500" />, section: 'Konversi dari PDF' },
      { name: 'PDF ke Excel',      path: '/pdf/ke-excel',      icon: <BarChart3 className="w-4 h-4 text-blue-500" />, section: 'Konversi dari PDF' },
      { name: 'OCR',               path: '/pdf/ocr',           icon: <Type className="w-4 h-4 text-blue-500" />, section: 'Konversi dari PDF' },
      { name: 'Gabung PDF',        path: '/pdf/gabung',        icon: <Layers className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Pecah PDF',         path: '/pdf/pecah',         icon: <FileOutput className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Kompres PDF',       path: '/pdf/kompres',       icon: <FileDown className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Ekstrak Halaman',   path: '/pdf/ekstrak',       icon: <FilePlus className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Hapus Halaman',     path: '/pdf/hapus-halaman', icon: <FileX className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Putar Halaman',     path: '/pdf/putar',         icon: <RotateCw className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Atur Ulang Halaman',path: '/pdf/atur-ulang',    icon: <SlidersHorizontal className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Edit PDF',          path: '/pdf/edit',          icon: <PenSquare className="w-4 h-4 text-blue-500" />, section: 'Keamanan & Anotasi' },
      { name: 'Tanda Tangan PDF',  path: '/pdf/tanda-tangan',  icon: <PenLine className="w-4 h-4 text-blue-500" />, section: 'Keamanan & Anotasi' },
      { name: 'Watermark PDF',     path: '/pdf/watermark',     icon: <Layers className="w-4 h-4 text-blue-500" />, section: 'Keamanan & Anotasi' },
      { name: 'Nomor Halaman',     path: '/pdf/nomor-halaman', icon: <ListOrdered className="w-4 h-4 text-blue-500" />, section: 'Keamanan & Anotasi' },
      { name: 'Protect PDF',       path: '/pdf/protect',       icon: <ShieldCheck className="w-4 h-4 text-blue-500" />, section: 'Keamanan & Anotasi' },
      { name: 'Unlock PDF',        path: '/pdf/unlock',        icon: <KeyRound className="w-4 h-4 text-blue-500" />, section: 'Keamanan & Anotasi' },
      { name: 'PDF Reader',        path: '/pdf/reader',        icon: <BookOpen className="w-4 h-4 text-blue-500" />, section: 'Baca & Pindai' },
      { name: 'Sensor / Redaksi PDF', path: '/pdf/sensor',     icon: <EyeOff className="w-4 h-4 text-blue-500" />, section: 'Baca & Pindai' },
      { name: 'Scan PDF',          path: '/pdf/scan',          icon: <ScanLine className="w-4 h-4 text-blue-500" />, section: 'Baca & Pindai' },
      { name: 'Doc Studio',        path: '/docs',              icon: <BookOpen className="w-4 h-4 text-violet-500" />, section: 'Doc Studio' },
      { name: 'Doc Reader',        path: '/pdf/baca-dokumen',  icon: <BookOpen className="w-4 h-4 text-violet-500" />, section: 'Doc Studio' },
    ],
  },
  {
    id: 'gambar',
    title: 'Gambar',
    icon: <ImageIcon className="w-4 h-4" />,
    rootPath: '/image',
    items: [
      { name: 'Photo Editor',   path: '/image/photo-editor',     icon: <SlidersHorizontal className="w-4 h-4 text-orange-500" />, section: 'Edit & Perbaiki' },
      { name: 'Crop Gambar',    path: '/image/crop',              icon: <Crop className="w-4 h-4 text-orange-500" />, section: 'Edit & Perbaiki' },
      { name: 'Putar Gambar',   path: '/image/putar',             icon: <RotateCw className="w-4 h-4 text-orange-500" />, section: 'Edit & Perbaiki' },
      { name: 'Hapus Background', path: '/image/hapus-background', icon: <Eraser className="w-4 h-4 text-orange-500" />, section: 'Edit & Perbaiki' },
      { name: 'Watermark Gambar', path: '/image/watermark',       icon: <Layers className="w-4 h-4 text-orange-500" />, section: 'Kreatif' },
      { name: 'Meme Generator', path: '/image/meme-generator',    icon: <Smile className="w-4 h-4 text-orange-500" />, section: 'Kreatif' },
      { name: 'HTML ke Gambar', path: '/image/html-ke-gambar',    icon: <Code2 className="w-4 h-4 text-orange-500" />, section: 'Kreatif' },
      { name: 'Color Picker & Palette', path: '/image/color-picker', icon: <Pipette className="w-4 h-4 text-orange-500" />, section: 'Kreatif' },
      { name: 'Kompres Gambar', path: '/image/kompres',  icon: <FileDown className="w-4 h-4 text-orange-500" />, section: 'Konversi & Optimasi' },
      { name: 'Ubah Ukuran',    path: '/image/resize',   icon: <ArrowLeftRight className="w-4 h-4 text-orange-500" />, section: 'Konversi & Optimasi' },
      { name: 'Konversi Format',path: '/image/konversi', icon: <Wand2 className="w-4 h-4 text-orange-500" />, section: 'Konversi & Optimasi' },
      { name: 'Baca Foto RAW',  path: '/image/raw-preview', icon: <Camera className="w-4 h-4 text-orange-500" />, section: 'Konversi & Optimasi' },
      { name: 'Hapus Metadata', path: '/image/hapus-metadata', icon: <Eraser className="w-4 h-4 text-orange-500" />, section: 'Konversi & Optimasi' },
    ],
  },
  {
    id: 'video',
    title: 'Video',
    icon: <Clapperboard className="w-4 h-4" />,
    rootPath: '/video',
    items: [
      { name: 'Potong Video',      path: '/video/potong',   icon: <Scissors className="w-4 h-4 text-rose-500" /> },
      { name: 'Crop & Resize',     path: '/video/crop',     icon: <Crop className="w-4 h-4 text-rose-500" /> },
      { name: 'Teks & Subtitle (CC)', path: '/video/subtitle', icon: <Captions className="w-4 h-4 text-rose-500" /> },
      { name: 'Gabung & Transisi', path: '/video/gabung',   icon: <Layers className="w-4 h-4 text-rose-500" /> },
      { name: 'Kecepatan & Filter', path: '/video/filter',  icon: <Sparkles className="w-4 h-4 text-rose-500" /> },
      { name: 'Tangkap Thumbnail / Screenshot', path: '/video/thumbnail', icon: <Camera className="w-4 h-4 text-rose-500" /> },
    ],
  },
  {
    id: 'audio',
    title: 'Audio',
    icon: <AudioLines className="w-4 h-4" />,
    rootPath: '/audio',
    items: [
      { name: 'Speech to Text',            path: '/audio/suara-ke-teks',       icon: <Mic className="w-4 h-4 text-cyan-500" /> },
      { name: 'Text to Speech',            path: '/audio/teks-ke-suara',       icon: <Volume2 className="w-4 h-4 text-cyan-500" /> },
      { name: 'Pengukur Kekuatan Suara',   path: '/audio/pengukur-suara',      icon: <Gauge className="w-4 h-4 text-cyan-500" /> },
      { name: 'Ekstrak Audio dari Video',  path: '/audio/ekstrak-audio-video', icon: <AudioLines className="w-4 h-4 text-cyan-500" /> },
    ],
  },
  {
    id: 'utilitas',
    title: 'Utilitas',
    icon: <SlidersHorizontal className="w-4 h-4" />,
    rootPath: '/utility',
    items: [
      { name: 'Kalkulator',       path: '/utility/kalkulator',       icon: <Calculator className="w-4 h-4 text-pink-500" />, section: 'Kalkulator' },
      { name: 'Kamus Dunia',      path: '/utility/kamus-dunia',      icon: <Languages className="w-4 h-4 text-pink-500" />, section: 'Bahasa & Konten' },
      { name: 'HTML Preview',     path: '/utility/html-preview',     icon: <AppWindow className="w-4 h-4 text-pink-500" />, section: 'Bahasa & Konten' },
      { name: 'Diagram & Rumus Studio', path: '/utility/diagram-rumus', icon: <Workflow className="w-4 h-4 text-pink-500" />, section: 'Bahasa & Konten' },
      { name: 'JSON & Base64',    path: '/utility/json-base64',      icon: <Code2 className="w-4 h-4 text-pink-500" />, section: 'Data & Teks' },
      { name: 'Bulk Teks',        path: '/utility/bulk-teks',        icon: <ListOrdered className="w-4 h-4 text-pink-500" />, section: 'Data & Teks' },
      { name: 'Statistik',        path: '/utility/statistik',        icon: <BarChart3 className="w-4 h-4 text-pink-500" />, section: 'Data & Teks' },
      { name: 'Link Media',       path: '/utility/link-media',       icon: <Radio className="w-4 h-4 text-pink-500" />, section: 'Lainnya' },
      { name: 'Alias Email',      path: '/utility/alias-email',      icon: <Mail className="w-4 h-4 text-pink-500" />, section: 'Lainnya' },
      { name: 'Password & Token', path: '/utility/password-token',   icon: <KeyRound className="w-4 h-4 text-pink-500" />, section: 'Lainnya' },
    ],
  },
  {
    id: 'spesial',
    title: 'Spesial',
    icon: <Sparkles className="w-4 h-4" />,
    rootPath: '/special',
    items: [
      { name: 'Kwitansi',            path: '/special/kwitansi',   icon: <Receipt className="w-4 h-4 text-amber-500" />, section: 'Dokumen Bisnis' },
      { name: 'Invoice',             path: '/special/invoice',    icon: <FileSpreadsheet className="w-4 h-4 text-amber-500" />, section: 'Dokumen Bisnis' },
      { name: 'Struk / Nota',        path: '/special/struk',      icon: <ShoppingBag className="w-4 h-4 text-amber-500" />, section: 'Dokumen Bisnis' },
      { name: 'Kartu Nama',          path: '/special/kartu-nama', icon: <IdCard className="w-4 h-4 text-amber-500" />, section: 'Dokumen Bisnis' },
      { name: 'Sertifikat & Piagam', path: '/special/sertifikat', icon: <Award className="w-4 h-4 text-amber-500" />, section: 'Lainnya' },
      { name: 'WA Link',             path: '/special/wa-link',    icon: <MessageCircle className="w-4 h-4 text-amber-500" />, section: 'Lainnya' },
      { name: 'Pembuat CV',          path: '/special/pembuat-cv', icon: <FileText className="w-4 h-4 text-amber-500" />, section: 'Lainnya' },
    ],
  },
];

const policyLinks = [
  { name: 'Tentang Kami',       path: '/about',   icon: <Info className="w-4 h-4 text-slate-400" /> },
  { name: 'Kebijakan Privasi',  path: '/privacy', icon: <BookOpen className="w-4 h-4 text-slate-400" /> },
  { name: 'Ketentuan Layanan',  path: '/terms',   icon: <FileText className="w-4 h-4 text-slate-400" /> },
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

export default function Header() {
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
    <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="rounded-xl overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm group-hover:shadow-md group-hover:ring-indigo-200 dark:group-hover:ring-indigo-500/40 transition-all duration-300">
              <img src="/gamato-piranti.png" alt="Gamato Piranti" className="w-9 h-9 object-cover" />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Gamato<span className="text-slate-400 dark:text-slate-500 font-normal">Piranti</span>
              </span>
              <div className="flex items-center gap-1 -mt-0.5">
                <span className="text-[10px] font-semibold text-slate-300 tracking-wide">by WisDev</span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" ref={dropdownRef}>
            {menuGroups.map((group) => {
              const wide = group.items.length > 4;
              return (
                <div key={group.id} className="relative">
                  <button
                    onClick={() => setActiveDropdown(activeDropdown === group.id ? null : group.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      activeDropdown === group.id || isActive(group.items)
                        ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {group.icon}
                    <span>{group.title}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${activeDropdown === group.id ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {activeDropdown === group.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                        transition={{ duration: 0.13 }}
                        className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden ${wide ? 'w-[380px]' : 'w-64'}`}
                      >
                        <div className={`p-2 max-h-[70vh] overflow-y-auto ${wide ? 'grid grid-cols-2 gap-0.5' : 'space-y-0.5'}`}>
                          <GroupedItems items={group.items} onNavigate={() => setActiveDropdown(null)} dense={wide} />
                        </div>
                        <Link
                          to={group.rootPath}
                          onClick={() => setActiveDropdown(null)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-500/10 border-t border-slate-100 dark:border-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                        >
                          Lihat semua {group.title}
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

            <GamatoTooltip label="Tentang Kami">
              <Link
                to="/about"
                aria-label="Tentang Kami"
                className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                  location.pathname === '/about' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <Info className="w-4 h-4" />
              </Link>
            </GamatoTooltip>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              title={isDark ? 'Mode terang' : 'Mode gelap'}
              className="p-2 rounded-full text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </nav>

          {/* Mobile theme toggle + hamburger */}
          <div className="md:hidden flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800"
          >
            <div className="px-4 py-5 space-y-3 max-h-[80vh] overflow-y-auto">
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
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="p-1.5">
                            <GroupedItems items={group.items} onNavigate={() => setMobileOpen(false)} />
                          </div>
                          <Link
                            to={group.rootPath}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center justify-center gap-1.5 mx-1.5 mb-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                          >
                            Lihat semua {group.title}
                          </Link>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
                <span>Powered by</span>
                <span className="text-slate-500 dark:text-slate-400 font-bold">WisDev</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
