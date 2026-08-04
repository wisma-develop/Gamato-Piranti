import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  QrCode, FileText, Image as ImageIcon, SlidersHorizontal, BookOpen,
  ArrowRight, ShieldCheck, Cpu, Lock, Gauge, Award
} from 'lucide-react';

const tools = [
  {
    icon: <QrCode className="w-7 h-7 text-white" />,
    title: 'QR & Barcode Studio',
    desc: 'QR code full custom — bentuk, warna, dan logo bebas diatur. Barcode multi-format dengan cetak massal ke PDF.',
    path: '/qr',
    gradient: 'from-teal-400 to-emerald-600',
    badge: 'QR · Barcode',
  },
  {
    icon: <FileText className="w-7 h-7 text-white" />,
    title: 'PDF Lab – Suite',
    desc: 'Toolkit PDF lengkap: kompres, gabung, pecah, atur ulang halaman, dan konversi.',
    path: '/pdf',
    gradient: 'from-blue-400 to-indigo-600',
    badge: '9 Mode',
  },
  {
    icon: <BookOpen className="w-7 h-7 text-white" />,
    title: 'Doc Studio',
    desc: 'Editor dokumen ringan dengan ekspor .docx, .pdf, dan .txt. Lengkap dengan utilitas teks.',
    path: '/docs',
    gradient: 'from-violet-400 to-purple-600',
    badge: '.docx · .pdf · .txt',
  },
  {
    icon: <ImageIcon className="w-7 h-7 text-white" />,
    title: 'Image Lab',
    desc: 'Kompres, ubah ukuran, konversi format, dan putar gambar langsung di perangkatmu.',
    path: '/image',
    gradient: 'from-orange-400 to-rose-500',
    badge: 'JPG · PNG · WEBP',
  },
  {
    icon: <SlidersHorizontal className="w-7 h-7 text-white" />,
    title: 'Rak Utilitas',
    desc: 'JSON formatter, Base64, kalkulator pajak & bunga, statistik, password generator, dan lainnya.',
    path: '/utility',
    gradient: 'from-pink-400 to-fuchsia-600',
    badge: '9 Alat',
  },
  {
    icon: <Award className="w-7 h-7 text-white" />,
    title: 'Spesial',
    desc: 'Generator sertifikat & piagam massal full custom, WA link, dan fitur andalan lainnya.',
    path: '/special',
    gradient: 'from-amber-400 to-orange-600',
    badge: 'Unggulan',
  },
];

const features = [
  { icon: <Cpu className="w-5 h-5" />, title: 'Diproses di perangkatmu', text: 'Setiap file diolah langsung di browser — tidak pernah diunggah ke server mana pun.' },
  { icon: <Lock className="w-5 h-5" />, title: 'Tanpa akun, tanpa jejak', text: 'Langsung pakai tanpa registrasi, tanpa pelacakan, dan tanpa biaya tersembunyi.' },
  { icon: <ShieldCheck className="w-5 h-5" />, title: 'Privasi milikmu penuh', text: 'File dan datamu tidak pernah meninggalkan perangkat — kendali penuh di tanganmu.' },
  { icon: <Gauge className="w-5 h-5" />, title: 'Ringan dan responsif', text: 'Dirancang agar tetap cepat dan lancar di berbagai perangkat, kapan pun dibutuhkan.' },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

export default function Home() {
  return (
    <div className="space-y-24 pb-24">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-24 pb-16">
        {/* Subtle signature texture — restrained, not a gradient-blob cliché */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(79,70,229,0.08),transparent)]" />
          <div className="absolute inset-x-0 top-0 h-80 opacity-[0.35] bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white mb-6 leading-[1.08]">
              Satu tempat untuk<br className="hidden md:block" />
              {' '}<span className="text-indigo-600 dark:text-indigo-400">semua alat digitalmu</span>
            </h1>

            <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-500 dark:text-slate-400 mb-10 leading-relaxed">
              Gamato Piranti merapikan kerja harian: QR code, PDF suite, editor dokumen, olah gambar, sampai puluhan utilitas kecil — cepat, aman, dan 100% gratis.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/qr" className="w-full sm:w-auto px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg shadow-slate-900/20 dark:shadow-black/40 flex items-center justify-center gap-2 group">
                <span>Mulai Eksplorasi</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link to="/pdf" className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-2xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all flex items-center justify-center gap-2">
                <ShieldCheck className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                <span>Lihat PDF Lab</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Tools Grid ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-3">Suite Lengkap</p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Alat yang benar-benar terpakai</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-xl mx-auto">Tidak perlu pindah-pindah website. Semua kebutuhan digital ada di satu tempat.</p>
        </div>

        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" variants={containerVariants} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          {tools.map((tool) => (
            <motion.div key={tool.path} variants={cardVariants}>
              <Link to={tool.path} className="group block h-full">
                <div className="h-full bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-black/40 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${tool.gradient} opacity-[0.06] rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 group-hover:opacity-[0.12] transition-opacity`} />
                  <div className="flex items-start justify-between mb-5">
                    <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${tool.gradient} shadow-lg`}>{tool.icon}</div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-100 dark:border-slate-700">{tool.badge}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{tool.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{tool.desc}</p>
                  <div className="mt-4 flex items-center text-indigo-600 dark:text-indigo-400 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Buka alat</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Trust section ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 dark:ring-1 dark:ring-slate-800 rounded-3xl overflow-hidden relative">
          <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />

          <div className="relative z-10 grid md:grid-cols-2 gap-10 p-10 md:p-14 items-center">
            <div className="space-y-6">
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Kenapa Gamato Piranti?</p>
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">Semua yang kamu butuhkan, dalam satu kanvas.</h2>
              <p className="text-slate-400 text-base leading-relaxed">Berhenti loncat-loncat ke banyak website. Gamato Piranti menghadirkan semua alat digital esensial dalam satu antarmuka yang bersih, cepat, dan terpercaya.</p>
              <Link to="/about" className="inline-flex items-center gap-2 text-white font-semibold text-sm hover:text-indigo-300 transition-colors">
                Pelajari lebih lanjut <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Feature list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((f) => (
                <div key={f.title} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">{f.icon}</div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
