import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  QrCode, FileText, Image as ImageIcon, SlidersHorizontal, ArrowRight, ShieldCheck, Cpu, Lock, Gauge, Award,
  Clapperboard, AudioLines, Presentation, Search, Tag, Layers, Eraser, IdCard, Sparkles, MousePointerClick,
  Upload, Download, Check, Command, Scissors, FileDown, ScanText, PenLine,
} from 'lucide-react';

import { menuGroups } from '@/components/layout/Header';
import { useToolSearch } from '@/components/search/ToolSearch';
import { HeroShowcase } from '@/components/home/HeroShowcase';
import { ToolMarquee } from '@/components/home/ToolMarquee';
import { CountUp } from '@/components/home/CountUp';
import { SpotlightCard } from '@/components/ui/SpotlightCard';
import { cn } from '@/utils/cn';

const TOTAL_TOOLS = menuGroups.reduce((n, g) => n + g.items.length, 0);

const quickLinks = [
  { to: '/qr/qr-code', label: 'QR Code', icon: <QrCode className="w-3.5 h-3.5" /> },
  { to: '/pdf/gabung', label: 'Gabung PDF', icon: <Layers className="w-3.5 h-3.5" /> },
  { to: '/image/kompres', label: 'Kompres Gambar', icon: <ImageIcon className="w-3.5 h-3.5" /> },
  { to: '/image/hapus-background', label: 'Hapus Background', icon: <Eraser className="w-3.5 h-3.5" /> },
  { to: '/special/kartu-nama', label: 'Kartu Nama', icon: <IdCard className="w-3.5 h-3.5" /> },
  { to: '/special/name-tag', label: 'Name Tag', icon: <Tag className="w-3.5 h-3.5" /> },
];

/** Kata yang berganti di baris "Olah …" pada hero. */
const WORDS = ['PDF', 'QR code', 'gambar', 'audio', 'video', 'dokumen'];

/** Jumlah alat per kategori dihitung dari menu aktual agar lencana di kartu tidak pernah usang. */
const countOf = (id: string) => menuGroups.find((g) => g.id === id)?.items.length ?? 0;
/** Nama alat populer per kategori — hanya yang benar-benar ada di menu yang ditampilkan. */
const pick = (id: string, names: string[]) => {
  const have = new Set(menuGroups.find((g) => g.id === id)?.items.map((i) => i.name));
  return names.filter((n) => have.has(n));
};

type Cat = {
  id: string; icon: ReactNode; title: string; desc: string; path: string; gradient: string; glow: string; spot: string;
  chips: string[]; span: string; feature?: boolean;
};

/** Urutan DOM = urutan penempatan grid bento (lihat komentar di bawah). */
const cats: Cat[] = [
  { id: 'dokumen', icon: <FileText className="w-7 h-7 text-white" />, title: 'PDF Lab – Suite', path: '/pdf', gradient: 'from-blue-400 to-indigo-600', glow: 'bg-blue-500', spot: 'rgba(59,130,246,.16)', feature: true,
    desc: 'Toolkit PDF lengkap: kompres, gabung, pecah, atur ulang halaman, konversi Office dua arah, OCR, hingga keamanan & anotasi PDF.',
    chips: pick('dokumen', ['Gabung PDF', 'Kompres PDF', 'Word ke PDF', 'PDF ke Word', 'OCR', 'Tanda Tangan PDF', 'Protect PDF', 'Edit PDF']), span: 'md:col-span-2 lg:row-span-2' },
  { id: 'gambar', icon: <ImageIcon className="w-6 h-6 text-white" />, title: 'Image Lab', path: '/image', gradient: 'from-orange-400 to-rose-500', glow: 'bg-orange-500', spot: 'rgba(249,115,22,.16)',
    desc: 'Photo Editor, kolase, cetak foto, hapus background, watermark, kompres, dan konversi — termasuk foto RAW.',
    chips: pick('gambar', ['Photo Editor', 'Hapus Background', 'Kompres Gambar']), span: '' },
  { id: 'video', icon: <Clapperboard className="w-6 h-6 text-white" />, title: 'Video Studio', path: '/video', gradient: 'from-rose-400 to-red-600', glow: 'bg-rose-500', spot: 'rgba(244,63,94,.16)',
    desc: 'Konversi, kompres, potong, crop, subtitle, gabung dengan transisi — ringan tanpa upload.',
    chips: pick('video', ['Potong Video', 'Kompres Video', 'Konversi Video']), span: '' },
  { id: 'audio', icon: <AudioLines className="w-6 h-6 text-white" />, title: 'Audio Studio', path: '/audio', gradient: 'from-cyan-400 to-sky-600', glow: 'bg-cyan-500', spot: 'rgba(6,182,212,.16)',
    desc: 'Konversi, edit, visualizer, transkrip, speech to text, text to speech, sampai ekstrak audio dari video.',
    chips: pick('audio', ['Edit Audio', 'Speech to Text', 'Text to Speech']), span: '' },
  { id: 'kode', icon: <QrCode className="w-6 h-6 text-white" />, title: 'QR & Barcode Studio', path: '/qr', gradient: 'from-teal-400 to-emerald-600', glow: 'bg-teal-500', spot: 'rgba(20,184,166,.16)',
    desc: 'QR code full custom — bentuk, warna, logo bebas — plus barcode multi-format dan cetak massal ke PDF.',
    chips: pick('kode', ['QR Code', 'Barcode', 'QR & Barcode Scanner']), span: '' },
  { id: 'office', icon: <Presentation className="w-6 h-6 text-white" />, title: 'Office Tools', path: '/office', gradient: 'from-violet-400 to-purple-600', glow: 'bg-violet-500', spot: 'rgba(139,92,246,.16)',
    desc: 'Doc Studio, Sheet Studio, Slide Studio, serta Diagram & Rumus — editor dokumen, spreadsheet, presentasi, diagram, dan rumus langsung di browser.',
    chips: pick('office', ['Doc Studio', 'Sheet Studio', 'Slide Studio', 'Diagram & Rumus Studio']), span: 'md:col-span-2' },
  { id: 'utilitas', icon: <SlidersHorizontal className="w-6 h-6 text-white" />, title: 'Rak Utilitas', path: '/utility', gradient: 'from-pink-400 to-fuchsia-600', glow: 'bg-pink-500', spot: 'rgba(236,72,153,.16)',
    desc: 'Kalkulator, universal converter, kamus dunia, Capture Website, Koordinat, JSON, Base64, dan lainnya.',
    chips: pick('utilitas', ['Kalkulator', 'Universal Converter', 'Koordinat']), span: '' },
  { id: 'spesial', icon: <Award className="w-6 h-6 text-white" />, title: 'Spesial', path: '/special', gradient: 'from-amber-400 to-orange-600', glow: 'bg-amber-500', spot: 'rgba(245,158,11,.18)',
    desc: 'Kwitansi, invoice, struk, kartu nama, name tag, surat, kupon, sertifikat, CV — banyak yang bisa dibuat massal.',
    chips: pick('spesial', ['Invoice', 'Kartu Nama', 'Sertifikat & Piagam']), span: '' },
];

/** Ubin aksi PDF di kartu fitur — dekoratif (ilustrasi isi suite), bukan tautan. */
const pdfTiles = [
  { icon: <Layers className="w-5 h-5" />, label: 'Gabung' },
  { icon: <Scissors className="w-5 h-5" />, label: 'Pecah' },
  { icon: <FileDown className="w-5 h-5" />, label: 'Kompres' },
  { icon: <ScanText className="w-5 h-5" />, label: 'OCR' },
  { icon: <PenLine className="w-5 h-5" />, label: 'Tanda tangan' },
  { icon: <Lock className="w-5 h-5" />, label: 'Protect' },
];

const steps = [
  { icon: <Search className="w-5 h-5" />, title: 'Pilih alat', text: 'Cari lewat kotak pencarian (Ctrl K) atau jelajahi kategori — semuanya satu klik.' },
  { icon: <Upload className="w-5 h-5" />, title: 'Tarik & lepas file', text: 'File dibaca langsung oleh browser. Tidak ada proses unggah ke server.' },
  { icon: <Download className="w-5 h-5" />, title: 'Unduh hasilnya', text: 'Hasil siap dalam hitungan detik, tanpa akun, tanpa watermark tersembunyi.' },
];

const features = [
  { icon: <Cpu className="w-5 h-5" />, title: 'Diproses di perangkatmu', text: 'Setiap file diolah langsung di browser — tidak pernah diunggah ke server mana pun.' },
  { icon: <Lock className="w-5 h-5" />, title: 'Tanpa akun, tanpa jejak', text: 'Langsung pakai tanpa registrasi, tanpa pelacakan, dan tanpa biaya tersembunyi.' },
  { icon: <ShieldCheck className="w-5 h-5" />, title: 'Privasi milikmu penuh', text: 'File dan datamu tidak pernah meninggalkan perangkat — kendali penuh di tanganmu.' },
  { icon: <Gauge className="w-5 h-5" />, title: 'Ringan dan responsif', text: 'Dirancang agar tetap cepat dan lancar di berbagai perangkat, kapan pun dibutuhkan.' },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } } };

/** Kata berganti di kalimat hero. Hanya kata aktif yang dirender (kalimat mengikuti lebarnya, tanpa celah);
 *  `key` memicu animasi masuk CSS tiap ganti. Baca-layar mendapat kalimat statis lewat paragraf deskripsi di bawahnya. */
function RotatingWord() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % WORDS.length), 2300);
    return () => window.clearInterval(t);
  }, [reduce]);
  return (
    <span key={WORDS[i]} data-testid="hero-word" className="gp-word-in inline-block font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-300 dark:to-violet-300">{WORDS[i]}</span>
  );
}

export default function Home() {
  const { open: openSearch } = useToolSearch();
  return (
    <div className="pb-24">

      {/* ═════════════ Hero ═════════════ */}
      <section className="relative isolate overflow-hidden pt-12 sm:pt-16 lg:pt-20 pb-16 lg:pb-24" data-testid="home-hero">
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(ellipse_70%_55%_at_50%_-8%,rgba(79,70,229,0.14),transparent)] dark:bg-[radial-gradient(ellipse_70%_55%_at_50%_-8%,rgba(99,102,241,0.24),transparent)]" />
          <div className="absolute inset-x-0 top-0 h-[640px] opacity-[0.4] dark:opacity-[0.1] bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#94a3b8_1px,transparent_1px),linear-gradient(to_bottom,#94a3b8_1px,transparent_1px)] [background-size:46px_46px] [mask-image:radial-gradient(ellipse_75%_80%_at_50%_0%,#000_28%,transparent_78%)]" />
          <div className="gp-orb absolute -top-16 left-[6%] h-80 w-80 rounded-full bg-indigo-400/30 dark:bg-indigo-500/20 blur-3xl" />
          <div className="gp-orb absolute top-32 right-[4%] h-96 w-96 rounded-full bg-violet-400/25 dark:bg-violet-500/15 blur-3xl [animation-delay:-5s]" />
          <div className="gp-orb absolute top-[28rem] left-[34%] h-72 w-72 rounded-full bg-sky-400/25 dark:bg-sky-500/10 blur-3xl [animation-delay:-9s]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 xl:gap-16">

            {/* Kolom teks */}
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }} className="text-center lg:text-left">
              <Link to="/special/name-tag" data-testid="home-announce" className="group inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-200/70 dark:border-indigo-500/30 bg-white/80 dark:bg-slate-900/70 backdrop-blur px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm hover:border-indigo-300 transition-colors mb-6">
                <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
                <span className="text-indigo-700 dark:text-indigo-300">Baru</span>
                <span className="truncate">Name Tag Studio — badge acara massal dari CSV</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <h1 className="text-[2.6rem] leading-[1.04] sm:text-6xl xl:text-[4.6rem] font-extrabold tracking-tight text-slate-900 dark:text-white">
                Satu tempat untuk{' '}
                <span className="gp-gradient-text-anim bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 dark:from-indigo-300 dark:via-violet-300 dark:to-sky-300 bg-clip-text text-transparent">semua alat digitalmu</span>
              </h1>

              <p className="mt-5 text-xl sm:text-2xl font-semibold text-slate-700 dark:text-slate-200">
                Olah <RotatingWord /> langsung di browser.
              </p>
              <p className="mx-auto lg:mx-0 mt-3 max-w-xl text-base sm:text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                Gamato Piranti merapikan kerja harian: QR code, PDF suite, editor dokumen, olah gambar, video, audio, sampai puluhan utilitas kecil — cepat, aman, dan 100% gratis.
              </p>

              <div className="gp-orbit-border mx-auto lg:mx-0 mt-8 max-w-xl shadow-xl shadow-indigo-500/10">
                <button
                  type="button"
                  onClick={openSearch}
                  data-testid="home-search"
                  aria-label="Cari alat"
                  className="group flex w-full items-center gap-3 rounded-[1.05rem] bg-white dark:bg-slate-900 px-5 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/90"
                >
                  <Search className="w-5 h-5 text-indigo-500 shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-slate-500 dark:text-slate-400 text-base">Cari dari {TOTAL_TOOLS}+ alat… mis. “kompres pdf”</span>
                  <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-500 group-hover:text-indigo-600 transition-colors"><Command className="w-3 h-3" />K</kbd>
                </button>
              </div>

              <div className="mt-4 flex max-w-xl flex-wrap items-center justify-center lg:justify-start gap-2 mx-auto lg:mx-0" data-testid="home-quick">
                {quickLinks.map((q) => (
                  <Link key={q.to} to={q.to} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-300 hover:-translate-y-0.5 transition-all">
                    <span className="text-indigo-500">{q.icon}</span>{q.label}
                  </Link>
                ))}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <Link to="/qr" className="gp-shine group w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 text-white dark:text-slate-900 rounded-2xl font-semibold transition-all shadow-lg shadow-slate-900/25 dark:shadow-black/30 hover:-translate-y-0.5 flex items-center justify-center gap-2">
                  <span>Mulai Eksplorasi</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link to="/pdf" className="w-full sm:w-auto px-7 py-3.5 gp-glass text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-2xl font-semibold hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  <span>Lihat PDF Lab</span>
                </Link>
              </div>

              <ul className="mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                {['Tanpa akun', 'Tanpa unggah file', 'Gratis selamanya'].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" aria-hidden="true" />{t}</li>
                ))}
              </ul>
            </motion.div>

            {/* Kolom visual */}
            <motion.div initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}>
              <HeroShowcase totalTools={TOTAL_TOOLS} />
            </motion.div>
          </div>

          {/* Statistik */}
          <dl className="mx-auto mt-14 lg:mt-20 grid max-w-4xl grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800 shadow-xl shadow-slate-900/5" data-testid="home-stats">
            {[
              { v: <CountUp to={TOTAL_TOOLS} suffix="+" />, l: 'alat siap pakai' },
              { v: <CountUp to={menuGroups.length} />, l: 'kategori' },
              { v: <span>0 byte</span>, l: 'file diunggah' },
              { v: <CountUp to={100} suffix="%" />, l: 'gratis, tanpa akun' },
            ].map((st) => (
              <div key={st.l} className="bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-5 text-center">
                <dt className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-indigo-700 dark:from-white dark:to-indigo-300 tabular-nums">{st.v}</dt>
                <dd className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{st.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ═════════════ Marquee ═════════════ */}
      <section className="mb-24" aria-label="Sekilas isi Gamato Piranti">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-5">{TOTAL_TOOLS}+ alat, satu tempat</p>
        <ToolMarquee />
      </section>

      {/* ═════════════ Kategori (bento) ═════════════ */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-3">Suite Lengkap</p>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">Alat yang benar-benar terpakai</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-xl mx-auto">Tidak perlu pindah-pindah website. Semua kebutuhan digital ada di satu tempat.</p>
        </div>

        {/* lg: 4 kolom. Baris 1: Dokumen(2×2) Gambar Video · Baris 2: (Dokumen) Audio Kode · Baris 3: Office(2) Utilitas Spesial.
            md: 2 kolom, Dokumen & Office melebar penuh → tidak ada baris yatim. */}
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 lg:auto-rows-[minmax(200px,auto)]" variants={container} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} data-testid="home-bento">
          {cats.map((c) => (
            <motion.div key={c.path} variants={item} className={c.span}>
              <Link to={c.path} className="group block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950">
                <SpotlightCard spot={c.spot} className={cn('relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/50 dark:hover:shadow-black/50 hover:border-slate-300 dark:hover:border-slate-700', c.feature && 'sm:p-8')}>
                  <span aria-hidden="true" className={cn('pointer-events-none absolute -right-12 -top-12 rounded-full blur-3xl opacity-[0.1] transition-opacity duration-300 group-hover:opacity-[0.28]', c.glow, c.feature ? 'h-72 w-72' : 'h-40 w-40')} />
                  <span aria-hidden="true" className={cn('pointer-events-none absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r transition-transform duration-300 group-hover:scale-x-100', c.gradient)} />
                  <div className="relative flex items-start justify-between mb-5">
                    <div className={cn('inline-flex rounded-2xl bg-gradient-to-br p-3 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3', c.gradient, c.feature && 'p-4')}>{c.icon}</div>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-100 dark:border-slate-700">{c.id === 'kode' ? 'QR · Barcode' : `${countOf(c.id)} Alat`}</span>
                  </div>
                  <h3 className={cn('relative font-bold text-slate-900 dark:text-white mb-2 transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300', c.feature ? 'text-2xl' : 'text-lg')}>{c.title}</h3>
                  <p className={cn('relative text-slate-500 dark:text-slate-400 leading-relaxed', c.feature ? 'text-base max-w-md' : 'text-sm')}>{c.desc}</p>

                  {c.feature && (
                    <div className="relative mt-7 grid grid-cols-3 gap-3 max-w-lg" aria-hidden="true">
                      {pdfTiles.map((t, ti) => (
                        <div key={t.label} className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 px-2 py-4 text-slate-600 dark:text-slate-300 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-blue-200 dark:group-hover:border-blue-500/40" style={{ transitionDelay: `${ti * 30}ms` }}>
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700">{t.icon}</span>
                          <span className="text-xs font-bold">{t.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative mt-auto pt-5 flex items-end justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5" aria-hidden="true">
                      {c.chips.slice(0, c.feature ? 8 : 3).map((n) => (
                        <span key={n} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{n}</span>
                      ))}
                    </div>
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 transition-all duration-300 group-hover:bg-indigo-600 group-hover:text-white group-hover:translate-x-0.5">
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      <span className="sr-only">Buka alat</span>
                    </span>
                  </div>
                </SpotlightCard>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═════════════ Cara kerja ═════════════ */}
      <section className="mx-auto mt-28 max-w-6xl px-4 sm:px-6 lg:px-8" aria-labelledby="how-title">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-3">Cara kerja</p>
          <h2 id="how-title" className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Tiga langkah, selesai</h2>
        </div>
        <ol className="relative grid gap-5 md:grid-cols-3">
          <span aria-hidden="true" className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-9 hidden h-px border-t-2 border-dashed border-indigo-300/70 dark:border-indigo-500/30 md:block" />
          {steps.map((s, i) => (
            <li key={s.title} className="relative text-center">
              <div className="relative mx-auto mb-5 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/30 ring-8 ring-white dark:ring-slate-950">
                {s.icon}
                <span className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-slate-900 dark:bg-white text-xs font-extrabold text-white dark:text-slate-900 ring-2 ring-white dark:ring-slate-950">{i + 1}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ═════════════ Privasi ═════════════ */}
      <section className="mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="gp-noise relative overflow-hidden rounded-[2rem] bg-slate-900 ring-1 ring-slate-800">
          <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />

          <div className="relative z-10 grid items-center gap-10 p-8 sm:p-10 md:p-14 lg:grid-cols-2">
            <div className="space-y-6">
              <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">Kenapa Gamato Piranti?</p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">Semua yang kamu butuhkan, dalam satu kanvas.</h2>
              <p className="text-slate-300 text-base leading-relaxed">Berhenti loncat-loncat ke banyak website. Gamato Piranti menghadirkan semua alat digital esensial dalam satu antarmuka yang bersih, cepat, dan terpercaya.</p>

              <div className="rounded-2xl border border-slate-700/70 bg-slate-950/60 p-4 font-mono text-xs leading-relaxed" aria-label="Ilustrasi: tidak ada file yang dikirim ke server">
                <p className="mb-2 flex items-center gap-1.5 text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />monitor jaringan · saat memproses file</p>
                <p className="flex justify-between gap-3 text-slate-300"><span>file diunggah ke server</span><span className="font-bold text-emerald-400">0</span></p>
                <p className="flex justify-between gap-3 text-slate-300"><span>data terkirim</span><span className="font-bold text-emerald-400">0 byte</span></p>
                <p className="flex justify-between gap-3 text-slate-300"><span>pemrosesan</span><span className="font-bold text-sky-300">di browser kamu</span></p>
              </div>

              <Link to="/about" className="inline-flex items-center gap-2 py-2 text-white font-semibold text-sm hover:text-indigo-300 transition-colors">
                Pelajari lebih lanjut <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((f) => (
                <div key={f.title} className="rounded-2xl border border-slate-700/60 bg-slate-800/60 p-5 space-y-3 transition-colors hover:border-indigo-500/50 hover:bg-slate-800">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/20">{f.icon}</div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════ CTA penutup ═════════════ */}
      <section className="mx-auto mt-28 max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="gp-noise relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-14 text-center text-white shadow-2xl shadow-indigo-500/30 sm:px-12">
          <span aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
          <div className="relative">
            <MousePointerClick className="mx-auto mb-4 h-9 w-9 text-white/90" aria-hidden="true" />
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Siap merapikan kerja harianmu?</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/90">Tanpa daftar, tanpa unggah, tanpa biaya. Cukup buka alatnya dan mulai.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={openSearch} className="gp-shine inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 font-semibold text-indigo-700 shadow-lg transition-all hover:-translate-y-0.5 sm:w-auto">
                <Search className="h-5 w-5" aria-hidden="true" />Cari alat
              </button>
              <Link to="/qr/qr-code" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-7 py-3.5 font-semibold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/20 sm:w-auto">
                Coba QR Code <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
