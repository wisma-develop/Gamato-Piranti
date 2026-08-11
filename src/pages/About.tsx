import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Zap, QrCode, FileText, Image as ImageIcon, SlidersHorizontal, ShieldCheck, Cpu, ArrowRight, BookOpen, Heart, Award, Clapperboard } from 'lucide-react';

const pillars = [
  {
    icon: <Cpu className="w-5 h-5 text-blue-500" />,
    title: 'Browser-Native',
    desc: 'Semua pemrosesan terjadi langsung di perangkatmu. File tidak pernah meninggalkan browser — privasi penuh terjaga.',
  },
  {
    icon: <ShieldCheck className="w-5 h-5 text-green-500" />,
    title: 'Privat & Aman',
    desc: 'Tidak ada akun, tidak ada tracking, tidak ada penyimpanan data. Kamu yang pegang kendali penuh atas file dan datamu.',
  },
  {
    icon: <Zap className="w-5 h-5 text-yellow-500" />,
    title: 'Cepat & Ringan',
    desc: 'Dioptimalkan untuk performa tinggi dan antarmuka yang responsif — bekerja lancar di semua perangkat.',
  },
];

const toolSuite = [
  { icon: <QrCode className="w-5 h-5" />, label: 'QR & Barcode Studio', desc: 'QR code full custom — bentuk titik & sudut, warna, hingga logo — bukan QR generik. Barcode berbagai format dengan cetak massal langsung ke PDF.' },
  { icon: <FileText className="w-5 h-5" />, label: 'PDF Lab – Suite', desc: '9 mode pemrosesan PDF: kompres, gabung, pecah, ekstrak, hapus, putar, atur halaman, gambar→PDF, dan teks→PDF.' },
  { icon: <BookOpen className="w-5 h-5" />, label: 'Doc Studio', desc: 'Editor teks ringan dengan ekspor .docx, .pdf, .txt. Dilengkapi Find & Replace, format case, snapshot sesi, dan template cepat.' },
  { icon: <ImageIcon className="w-5 h-5" />, label: 'Image Lab', desc: 'Kompres, ubah ukuran, konversi format (JPG/PNG/WEBP), dan putar gambar secara batch langsung di perangkatmu.' },
  { icon: <SlidersHorizontal className="w-5 h-5" />, label: 'Rak Utilitas', desc: '11 alat: kalkulator serba-guna, kamus dunia, HTML preview, diagram & rumus, JSON formatter, Base64, bulk teks, statistik, password/token generator, dan lainnya.' },
  { icon: <Clapperboard className="w-5 h-5" />, label: 'Video Studio', desc: 'Editor video ringan: potong/cut, crop & resize, teks & subtitle (CC), gabung dengan transisi, kecepatan & filter warna — tanpa upload ke server.' },
  { icon: <Award className="w-5 h-5" />, label: 'Spesial', desc: 'Kwitansi, invoice, dan struk/nota profesional dengan logo custom, generator sertifikat & piagam massal full custom, WA link, dan fitur unggulan lainnya.' },
];

export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center space-y-5">
        <div className="inline-flex items-center gap-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm pl-2 pr-4 py-2 rounded-2xl">
          <div className="rounded-xl overflow-hidden w-8 h-8 ring-1 ring-slate-100 dark:ring-slate-700">
            <img src="/gamato-piranti.png" alt="Gamato Piranti" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">Gamato Piranti</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white leading-tight">Tentang Kami</h1>
        <p className="text-xl text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto">
          Suite alat digital yang dibuat untuk menyederhanakan pekerjaan sehari-hari — tanpa ribet, tanpa biaya, tanpa privasi yang dikorbankan.
        </p>
      </motion.div>

      {/* Story */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 md:p-10 shadow-sm space-y-5">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Awal Mula</h2>
        <div className="space-y-4 text-slate-600 dark:text-slate-300 leading-relaxed">
          <p><strong className="text-slate-900 dark:text-white">Gamato Piranti</strong> lahir dari frustrasi yang sangat sederhana: terlalu banyak waktu terbuang berpindah-pindah antara berbagai website hanya untuk menyelesaikan pekerjaan digital sehari-hari.</p>
          <p>Kami percaya semua alat itu harusnya ada dalam satu tempat. Bersih. Cepat. Dan yang paling penting — <em>aman</em>. File kamu adalah milikmu, bukan milik server orang lain.</p>
          <p>Dengan arsitektur <strong className="text-slate-900 dark:text-white">browser-native</strong>, semua pemrosesan di Gamato Piranti terjadi langsung di perangkat pengguna menggunakan Web APIs modern. Ini bukan sekadar klaim — ini pilihan arsitektur yang disengaja sejak hari pertama.</p>
        </div>
      </motion.section>

      {/* Pillars */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Prinsip Kami</h2>
        <div className="grid md:grid-cols-3 gap-5">
          {pillars.map((p) => (
            <div key={p.title} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md dark:hover:shadow-black/30 transition-shadow">
              <div className="bg-slate-50 dark:bg-slate-800 w-10 h-10 rounded-xl flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700">{p.icon}</div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-2">{p.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Tool Suite */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Suite Alat Digital</h2>
        <div className="space-y-3">
          {toolSuite.map((tool) => (
            <div key={tool.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex items-start gap-4 hover:border-indigo-200 dark:hover:border-indigo-500/40 hover:shadow-md dark:hover:shadow-black/30 transition-all">
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-2.5 rounded-xl shrink-0 text-slate-500 dark:text-slate-400">{tool.icon}</div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{tool.label}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{tool.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* Craft & commitment */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="bg-slate-900 dark:ring-1 dark:ring-slate-800 rounded-3xl p-8 md:p-10 text-white">
        <h2 className="text-2xl font-bold mb-4">Dirawat dengan serius, dikembangkan berkelanjutan</h2>
        <p className="text-slate-400 leading-relaxed max-w-2xl">
          Setiap alat di Gamato Piranti dirancang, diuji, dan diperbarui secara berkala untuk menjaga performa, kompatibilitas, dan keamanan. Kami terus mendengarkan masukan pengguna untuk membuat setiap alat semakin relevan dengan kebutuhan sehari-hari.
        </p>
        <div className="flex items-center gap-2 text-slate-400 text-sm border-t border-slate-800 mt-8 pt-6">
          <Heart className="w-4 h-4 text-red-400" />
          <span>Dikembangkan & dirawat oleh</span>
          <span className="text-white font-bold text-base">WisDev</span>
        </div>
      </motion.section>

      {/* CTA */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Siap mencoba?</h2>
        <p className="text-slate-500 dark:text-slate-400">Tidak perlu daftar. Langsung pakai.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/qr" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-lg shadow-slate-900/20 dark:shadow-black/30 group">
            <span>Buka QR Studio</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link to="/pdf" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-2xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all">
            PDF Lab
          </Link>
        </div>
      </div>
    </div>
  );
}
