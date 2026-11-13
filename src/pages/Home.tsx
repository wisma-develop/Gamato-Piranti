import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, Image as ImageIcon, ArrowRight, Search, Tag, Layers, Eraser, IdCard, Sparkles, Check, Command,
} from 'lucide-react';

import { menuGroups } from '@/components/layout/Header';
import { useToolSearch } from '@/components/search/ToolSearch';
import { HeroShowcase } from '@/components/home/HeroShowcase';
import { CountUp } from '@/components/home/CountUp';
import { useInViewOnce, usePrefersReducedMotion } from '@/hooks/usePresence';

/** Bagian bawah Beranda dipisah ke chunk sendiri → hero (LCP) tidak menunggu parse/eksekusi marquee, bento, dll. */
const loadSections = () => import('./HomeSections');
const HomeSections = lazy(loadSections);

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

/** Kata berganti di kalimat hero. Hanya kata aktif yang dirender (kalimat mengikuti lebarnya, tanpa celah);
 *  `key` memicu animasi masuk CSS tiap ganti. Baca-layar mendapat kalimat statis lewat paragraf deskripsi di bawahnya. */
function RotatingWord() {
  const reduce = usePrefersReducedMotion();
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

/** Mengunduh chunk bagian bawah saat browser idle (hanya jaringan + evaluasi modul kecil) — TANPA merendernya. */
function usePrefetchSections() {
  useEffect(() => {
    type Ric = (cb: () => void, o?: { timeout: number }) => number;
    const w = window as unknown as { requestIdleCallback?: Ric; cancelIdleCallback?: (id: number) => void };
    let id: number;
    const go = () => { void loadSections(); };
    if (w.requestIdleCallback) { id = w.requestIdleCallback(go, { timeout: 4000 }); return () => w.cancelIdleCallback?.(id); }
    id = window.setTimeout(go, 1500);
    return () => window.clearTimeout(id);
  }, []);
}

export default function Home() {
  const { open: openSearch } = useToolSearch();
  usePrefetchSections();
  // Bagian bawah baru dirender saat penanda ini mendekati layar (700px lebih awal) → render awal hanya hero.
  const [sentinel, ready] = useInViewOnce<HTMLDivElement>('0px 0px 700px 0px');
  return (
    <div className="pb-24">

      {/* ═════════════ Hero ═════════════ */}
      <section className="relative isolate overflow-hidden pt-12 sm:pt-16 lg:pt-20 pb-16 lg:pb-24" data-testid="home-hero">
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(ellipse_70%_55%_at_50%_-8%,rgba(79,70,229,0.14),transparent)] dark:bg-[radial-gradient(ellipse_70%_55%_at_50%_-8%,rgba(99,102,241,0.24),transparent)]" />
          <div className="absolute inset-x-0 top-0 h-[640px] opacity-[0.4] dark:opacity-[0.1] bg-[linear-gradient(to_right,#cbd5e1_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e1_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#94a3b8_1px,transparent_1px),linear-gradient(to_bottom,#94a3b8_1px,transparent_1px)] [background-size:46px_46px] [mask-image:radial-gradient(ellipse_75%_80%_at_50%_0%,#000_28%,transparent_78%)]" />
          <div className="gp-orb absolute -top-16 left-[6%] h-80 w-80 rounded-full bg-indigo-400/30 dark:bg-indigo-500/20 gp-soft" />
          <div className="gp-orb absolute top-32 right-[4%] h-96 w-96 rounded-full bg-violet-400/25 dark:bg-violet-500/15 gp-soft [animation-delay:-5s]" />
          <div className="gp-orb absolute top-[28rem] left-[34%] h-72 w-72 rounded-full bg-sky-400/25 dark:bg-sky-500/10 gp-soft [animation-delay:-9s]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 xl:gap-16">

            {/* Kolom teks */}
            <div className="gp-rise text-center lg:text-left">
              <Link to="/special/name-tag" data-testid="home-announce" className="group inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-200/70 dark:border-indigo-500/30 bg-white/80 dark:bg-slate-900/70 gp-blur px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm hover:border-indigo-300 transition-colors mb-6">
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
            </div>

            {/* Kolom visual */}
            <div className="gp-rise-fade">
              <HeroShowcase totalTools={TOTAL_TOOLS} />
            </div>
          </div>

          {/* Statistik */}
          <dl className="mx-auto mt-14 lg:mt-20 grid max-w-4xl grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800 shadow-xl shadow-slate-900/5" data-testid="home-stats">
            {[
              { v: <CountUp to={TOTAL_TOOLS} suffix="+" />, l: 'alat siap pakai' },
              { v: <CountUp to={menuGroups.length} />, l: 'kategori' },
              { v: <span>0 byte</span>, l: 'file diunggah' },
              { v: <CountUp to={100} suffix="%" />, l: 'gratis, tanpa akun' },
            ].map((st) => (
              <div key={st.l} className="bg-white/95 dark:bg-slate-900/95 gp-blur px-4 py-5 text-center">
                <dt className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-slate-900 to-indigo-700 dark:from-white dark:to-indigo-300 tabular-nums">{st.v}</dt>
                <dd className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{st.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ═════════════ Bagian di bawah layar pertama — dimuat lazy saat browser idle ═════════════ */}
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      {ready ? (
        <Suspense fallback={<div aria-hidden="true" className="min-h-[1200px]" />}>
          <HomeSections />
        </Suspense>
      ) : (
        <div aria-hidden="true" className="min-h-[1200px]" />
      )}

    </div>
  );
}
