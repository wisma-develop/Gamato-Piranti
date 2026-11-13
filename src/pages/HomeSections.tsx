import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCode, FileText, Image as ImageIcon, SlidersHorizontal, ArrowRight, ShieldCheck, Cpu, Lock, Gauge, Award,
  Clapperboard, AudioLines, Presentation, Search, Layers, MousePointerClick, Upload, Download,
  Scissors, FileDown, ScanText, PenLine,
} from 'lucide-react';

import { menuGroups } from '@/components/layout/Header';
import { useToolSearch } from '@/components/search/ToolSearch';
import { ToolMarquee } from '@/components/home/ToolMarquee';
import { SpotlightCard } from '@/components/ui/SpotlightCard';
import { Reveal } from '@/components/ui/Reveal';
import { cn } from '@/utils/cn';

const TOTAL_TOOLS = menuGroups.reduce((n, g) => n + g.items.length, 0);

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

/**
 * Bagian Beranda di bawah layar pertama (marquee → CTA). Dipisah dari Home agar hero tampil secepat mungkin;
 * dimuat lazy setelah browser idle (lihat Home.tsx).
 */
export default function HomeSections() {
  const { open: openSearch } = useToolSearch();
  return (
    <div data-testid="home-sections">

      {/* ═════════════ Marquee ═════════════ */}
      <section className="gp-cv mb-24" aria-label="Sekilas isi Gamato Piranti">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-5">{TOTAL_TOOLS}+ alat, satu tempat</p>
        <ToolMarquee />
      </section>

      {/* ═════════════ Kategori (bento) ═════════════ */}
      <section className="gp-cv mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-3">Suite Lengkap</p>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">Alat yang benar-benar terpakai</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-xl mx-auto">Tidak perlu pindah-pindah website. Semua kebutuhan digital ada di satu tempat.</p>
        </div>

        {/* lg: 4 kolom. Baris 1: Dokumen(2×2) Gambar Video · Baris 2: (Dokumen) Audio Kode · Baris 3: Office(2) Utilitas Spesial.
            md: 2 kolom, Dokumen & Office melebar penuh → tidak ada baris yatim. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 lg:auto-rows-[minmax(200px,auto)]" data-testid="home-bento">
          {cats.map((c, ci) => (
            <Reveal key={c.path} delay={(ci % 4) * 70} className={c.span}>
              <Link to={c.path} className="group block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950">
                <SpotlightCard data-tilt={c.feature ? '4' : '7'} spot={c.spot} className={cn('relative flex h-full flex-col rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/50 dark:hover:shadow-black/50 hover:border-slate-300 dark:hover:border-slate-700', c.feature && 'sm:p-8')}>
                  <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
                    <span className={cn('absolute -right-12 -top-12 rounded-full gp-soft opacity-[0.1] transition-opacity duration-300 group-hover:opacity-[0.28]', c.glow, c.feature ? 'h-72 w-72' : 'h-40 w-40')} />
                    <span className={cn('absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r transition-transform duration-300 group-hover:scale-x-100', c.gradient)} />
                  </span>
                  <div className="relative flex items-start justify-between mb-5">
                    <div data-depth style={{ ['--z' as string]: '38px' }} className={cn('inline-flex rounded-2xl bg-gradient-to-br p-3 shadow-lg shadow-black/10 transition-[scale,rotate] duration-300 group-hover:scale-110 group-hover:-rotate-3', c.gradient, c.feature && 'p-4')}>{c.icon}</div>
                    <span data-depth style={{ ['--z' as string]: '18px' }} className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-100 dark:border-slate-700">{c.id === 'kode' ? 'QR · Barcode' : `${countOf(c.id)} Alat`}</span>
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
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═════════════ Cara kerja ═════════════ */}
      <section className="gp-cv mx-auto mt-28 max-w-6xl px-4 sm:px-6 lg:px-8" aria-labelledby="how-title">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-3">Cara kerja</p>
          <h2 id="how-title" className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Tiga langkah, selesai</h2>
        </div>
        <ol className="relative grid gap-5 md:grid-cols-3">
          <span aria-hidden="true" className="pointer-events-none absolute left-[16.6%] right-[16.6%] top-9 hidden h-px border-t-2 border-dashed border-indigo-300/70 dark:border-indigo-500/30 md:block" />
          {steps.map((s, i) => (
            <li key={s.title} className="relative text-center">
              <div data-tilt="14" className="relative mx-auto mb-5 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/30 ring-8 ring-white dark:ring-slate-950">
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
      <section className="gp-cv mx-auto mt-28 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="gp-noise relative overflow-hidden rounded-[2rem] bg-slate-900 ring-1 ring-slate-800">
          <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-600/25 gp-soft" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-violet-600/20 gp-soft" />

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
                <div key={f.title} data-tilt="9" className="gp-spot rounded-2xl border border-slate-700/60 bg-slate-800/60 p-5 space-y-3 transition-colors hover:border-indigo-500/50 hover:bg-slate-800 [--spot:rgba(129,140,248,.16)]">
                  <div data-depth style={{ ['--z' as string]: '24px' }} className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/20">{f.icon}</div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═════════════ CTA penutup ═════════════ */}
      <section className="gp-cv mx-auto mt-28 max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="gp-noise relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-14 text-center text-white shadow-2xl shadow-indigo-500/30 sm:px-12">
          <span aria-hidden="true" className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/15 gp-soft" />
          <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-sky-300/25 gp-soft" />
          <div className="relative">
            <MousePointerClick className="mx-auto mb-4 h-9 w-9 text-white/90" aria-hidden="true" />
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Siap merapikan kerja harianmu?</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/90">Tanpa daftar, tanpa unggah, tanpa biaya. Cukup buka alatnya dan mulai.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button type="button" onClick={openSearch} className="gp-shine inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 font-semibold text-indigo-700 shadow-lg transition-all hover:-translate-y-0.5 sm:w-auto">
                <Search className="h-5 w-5" aria-hidden="true" />Cari alat
              </button>
              <Link to="/qr/qr-code" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-7 py-3.5 font-semibold text-white gp-blur transition-all hover:-translate-y-0.5 hover:bg-white/20 sm:w-auto">
                Coba QR Code <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
