import { useState, useRef, useEffect, Fragment } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, X, ChevronDown,
  FileText, Image as ImageIcon, QrCode, SlidersHorizontal,
  Barcode, Info, BookOpen, Code2,
  Layers, FileOutput, FileDown, FilePlus, FileX, RotateCw,
  FileImage, AlignLeft, ArrowLeftRight, Wand2,
  ListOrdered, Radio, Mail, Calculator, TrendingUp, BarChart3,
  MessageCircle, KeyRound, Eraser, Sun, Moon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDarkMode } from '@/hooks/useDarkMode';

type DropGroup = 'kode' | 'dokumen' | 'gambar' | 'utilitas' | null;

type MenuItem = { name: string; path: string; icon: ReactNode; section?: string };

const menuGroups: { id: Exclude<DropGroup, null>; title: string; icon: ReactNode; items: MenuItem[] }[] = [
  {
    id: 'kode',
    title: 'Kode',
    icon: <QrCode className="w-4 h-4" />,
    items: [
      { name: 'QR Code', path: '/qr/qr-code', icon: <QrCode className="w-4 h-4 text-teal-500" /> },
      { name: 'Barcode', path: '/qr/barcode', icon: <Barcode className="w-4 h-4 text-teal-500" /> },
    ],
  },
  {
    id: 'dokumen',
    title: 'Dokumen',
    icon: <FileText className="w-4 h-4" />,
    items: [
      { name: 'Gabung PDF',        path: '/pdf/gabung',        icon: <Layers className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Pecah PDF',         path: '/pdf/pecah',         icon: <FileOutput className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Kompres PDF',       path: '/pdf/kompres',       icon: <FileDown className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Ekstrak Halaman',   path: '/pdf/ekstrak',       icon: <FilePlus className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Hapus Halaman',     path: '/pdf/hapus-halaman', icon: <FileX className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Putar Halaman',     path: '/pdf/putar',         icon: <RotateCw className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Atur Ulang Halaman',path: '/pdf/atur-ulang',    icon: <SlidersHorizontal className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Gambar ke PDF',     path: '/pdf/gambar-ke-pdf', icon: <FileImage className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Teks ke PDF',       path: '/pdf/teks-ke-pdf',   icon: <AlignLeft className="w-4 h-4 text-blue-500" />, section: 'PDF Lab – Suite' },
      { name: 'Doc Studio',        path: '/docs',              icon: <BookOpen className="w-4 h-4 text-violet-500" />, section: 'Doc Studio' },
    ],
  },
  {
    id: 'gambar',
    title: 'Gambar',
    icon: <ImageIcon className="w-4 h-4" />,
    items: [
      { name: 'Kompres Gambar', path: '/image/kompres',  icon: <FileDown className="w-4 h-4 text-orange-500" /> },
      { name: 'Ubah Ukuran',    path: '/image/resize',   icon: <ArrowLeftRight className="w-4 h-4 text-orange-500" /> },
      { name: 'Konversi Format',path: '/image/konversi', icon: <Wand2 className="w-4 h-4 text-orange-500" /> },
      { name: 'Putar Gambar',   path: '/image/putar',    icon: <RotateCw className="w-4 h-4 text-orange-500" /> },
    ],
  },
  {
    id: 'utilitas',
    title: 'Utilitas',
    icon: <SlidersHorizontal className="w-4 h-4" />,
    items: [
      { name: 'JSON & Base64',    path: '/utility/json-base64',      icon: <Code2 className="w-4 h-4 text-pink-500" /> },
      { name: 'Bulk Teks',        path: '/utility/bulk-teks',        icon: <ListOrdered className="w-4 h-4 text-pink-500" /> },
      { name: 'Link Media',       path: '/utility/link-media',       icon: <Radio className="w-4 h-4 text-pink-500" /> },
      { name: 'Alias Email',      path: '/utility/alias-email',      icon: <Mail className="w-4 h-4 text-pink-500" /> },
      { name: 'Kalkulator Pajak', path: '/utility/kalkulator-pajak', icon: <Calculator className="w-4 h-4 text-pink-500" /> },
      { name: 'Kalkulator Bunga', path: '/utility/kalkulator-bunga', icon: <TrendingUp className="w-4 h-4 text-pink-500" /> },
      { name: 'Statistik',        path: '/utility/statistik',        icon: <BarChart3 className="w-4 h-4 text-pink-500" /> },
      { name: 'WA Link',          path: '/utility/wa-link',          icon: <MessageCircle className="w-4 h-4 text-pink-500" /> },
      { name: 'Password & Token', path: '/utility/password-token',   icon: <KeyRound className="w-4 h-4 text-pink-500" /> },
      { name: 'Hapus Metadata',   path: '/utility/hapus-metadata',   icon: <Eraser className="w-4 h-4 text-pink-500" /> },
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

            <Link
              to="/about"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                location.pathname === '/about' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>Tentang</span>
            </Link>

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
