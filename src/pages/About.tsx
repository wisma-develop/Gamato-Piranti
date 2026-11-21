import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Cpu, Globe2, HeartHandshake, Layers, Lock, Rocket, ShieldCheck, Sparkles, Wand2, Zap } from "lucide-react";
import { menuGroups } from "@/components/layout/Header";
import { Callout, DocFooterNav, DocHero } from "@/components/ui/StaticDoc";
import { pick } from "@/i18n";
import pkg from "../../package.json";

const GROUP_BLURB: Record<string, string> = {
  kode: pick("QR Code & barcode kustom, pemindai QR/barcode, input scanner HID, dan kode Morse.", "Custom QR codes & barcodes, a QR/barcode scanner, HID scanner input, and Morse code."),
  dokumen: pick("Suite PDF lengkap: konversi dari/ke Office, gabung, pecah, kompres, edit, tanda tangan, watermark, proteksi, OCR, hingga pembaca dokumen.", "A complete PDF suite: Office conversion both ways, merge, split, compress, edit, sign, watermark, protect, OCR, and a document reader."),
  office: pick("Editor kantor di browser: dokumen, spreadsheet, slide, serta diagram & rumus.", "Office editors in your browser: documents, spreadsheets, slides, plus diagrams & formulas."),
  gambar: pick("Editor foto, kolase, cetak foto, hapus latar, watermark, meme, kompres, ubah ukuran, dan konversi — termasuk foto RAW.", "Photo editor, collage, photo print, background removal, watermark, memes, compress, resize, and convert — RAW photos included."),
  video: pick("Konversi, kompres, potong, crop, subtitle, gabung dengan transisi, kecepatan & filter, hingga tangkap thumbnail.", "Convert, compress, trim, crop, subtitles, merge with transitions, speed & filters, and thumbnail capture."),
  audio: pick("Konversi, kompres & edit audio, visualizer, transkrip, speech to text, text to speech, dan pengukur suara.", "Convert, compress & edit audio, visualizer, transcripts, speech to text, text to speech, and a sound level meter."),
  utilitas: pick("Kalkulator, universal converter, kamus dunia, capture website, koordinat, JSON & Base64, cetak file, password & token.", "Calculators, universal converter, world dictionary, website capture, coordinates, JSON & Base64, file printing, passwords & tokens."),
  spesial: pick("Dokumen bisnis siap pakai: kwitansi, invoice, struk, kartu nama, surat, kupon & tiket, sertifikat, CV, dan WA link.", "Ready-to-use business documents: receipts, invoices, sales slips, business cards, letters, coupons & tickets, certificates, CVs, and WhatsApp links."),
};

const TECH = ["React 19", "TypeScript", "Vite", "Tailwind CSS", "pdf-lib", "PDF.js", "docx", "Tesseract.js", "Whisper (Transformers.js)", "mediabunny", "Mermaid", "KaTeX", "Leaflet", "JSZip", "qr-code-styling", "framer-motion"];

export default function About() {
  const reduce = useReducedMotion();
  const totalTools = menuGroups.reduce((n, g) => n + g.items.length, 0);
  const stats = [
    { value: `${totalTools}+`, label: pick("alat siap pakai", "ready-to-use tools") },
    { value: String(menuGroups.length), label: pick("kategori", "categories") },
    { value: "0", label: pick("berkas diunggah ke server", "files uploaded to a server") },
    { value: "2", label: pick("bahasa: Indonesia & Inggris", "languages: Indonesian & English") },
  ];
  const pillars = [
    { icon: <Cpu className="h-5 w-5 text-blue-500" aria-hidden="true" />, title: pick("Native di browser", "Browser-native"), desc: pick("Pemrosesan berjalan di perangkatmu memakai Web API modern. Berkas tidak meninggalkan browser — privasi adalah keputusan arsitektur, bukan sekadar janji.", "Processing runs on your device using modern Web APIs. Files never leave the browser — privacy is an architectural decision, not just a promise.") },
    { icon: <ShieldCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" />, title: pick("Privat secara bawaan", "Private by default"), desc: pick("Tanpa akun, tanpa pelacak, tanpa iklan. Draf hanya disimpan di perangkatmu dan bisa kamu hapus kapan saja.", "No account, no trackers, no ads. Drafts are kept only on your device and you can erase them at any time.") },
    { icon: <Zap className="h-5 w-5 text-amber-500" aria-hidden="true" />, title: pick("Cepat & ringan", "Fast & light"), desc: pick("Setiap alat dimuat sesuai kebutuhan (lazy-load), sehingga halaman awal tetap ringan walau katalognya besar.", "Every tool loads on demand (lazy-loaded), so the first page stays light even though the catalog is large.") },
    { icon: <Globe2 className="h-5 w-5 text-violet-500" aria-hidden="true" />, title: pick("Dua bahasa utuh", "Truly bilingual"), desc: pick("Seluruh antarmuka, template dokumen, dan pesan galat tersedia dalam Bahasa Indonesia dan English.", "The whole interface, document templates, and error messages are available in Indonesian and English.") },
    { icon: <HeartHandshake className="h-5 w-5 text-rose-500" aria-hidden="true" />, title: pick("Gratis & jujur", "Free & honest"), desc: pick("Tanpa watermark tersembunyi dan tanpa fitur berbayar. Batasan teknis dijelaskan apa adanya di tiap alat.", "No hidden watermarks and no paywalled features. Technical limits are explained plainly inside each tool.") },
    { icon: <Wand2 className="h-5 w-5 text-pink-500" aria-hidden="true" />, title: pick("Dibuat untuk dipakai", "Built to be used"), desc: pick("Alat dirancang untuk pekerjaan nyata: dokumen bisnis, berkas kantor, media, hingga utilitas harian.", "Tools are designed for real work: business documents, office files, media, and everyday utilities.") },
  ];
  const steps = [
    { n: 1, t: pick("Pilih alat", "Pick a tool"), d: pick("Cari lewat Ctrl K atau jelajahi kategori.", "Search with Ctrl K or browse the categories.") },
    { n: 2, t: pick("Tarik & lepas berkas", "Drop your files"), d: pick("Berkas dibaca langsung oleh browser — tidak ada unggahan.", "Files are read directly by the browser — nothing is uploaded.") },
    { n: 3, t: pick("Unduh hasilnya", "Download the result"), d: pick("Siap dalam hitungan detik, tanpa akun.", "Ready in seconds, no account needed.") },
  ];
  const fade = (i: number) => (reduce ? {} : { initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-40px" }, transition: { duration: 0.35, delay: Math.min(i * 0.05, 0.25) } });

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6 lg:px-8 sm:py-14">
      <DocHero
        badge={pick("Tentang kami", "About us")}
        title={pick("Alat digital yang menghormati privasimu", "Digital tools that respect your privacy")}
        lead={pick(
          "Gamato Piranti adalah suite alat digital berbasis browser — QR code, PDF, dokumen kantor, gambar, video, audio, dan puluhan utilitas — yang bekerja sepenuhnya di perangkatmu.",
          "Gamato Piranti is a browser-based digital tool suite — QR codes, PDFs, office documents, images, video, audio, and dozens of utilities — that works entirely on your device.",
        )}
        meta={`v${pkg.version} · WisDev`}
        icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={pick("Angka utama", "Key numbers")}>
        {stats.map((s, i) => (
          <motion.div key={s.label} {...fade(i)} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <dt className="order-2 mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</dt>
            <dd className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{s.value}</dd>
          </motion.div>
        ))}
      </dl>

      <section aria-labelledby="about-story" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-9">
        <h2 id="about-story" className="mb-4 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white"><Rocket className="h-6 w-6 text-indigo-500" aria-hidden="true" />{pick("Mengapa Gamato Piranti ada", "Why Gamato Piranti exists")}</h2>
        <div className="space-y-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
          <p>{pick("Pekerjaan digital sehari-hari — menggabungkan PDF, mengecilkan foto, membuat QR, merapikan kwitansi — biasanya memaksa kita berpindah-pindah situs, mengunggah berkas pribadi ke server yang tidak kita kenal, atau membayar untuk fitur dasar.", "Everyday digital chores — merging a PDF, shrinking a photo, making a QR code, tidying up a receipt — usually force us to hop between sites, upload personal files to servers we don't know, or pay for basic features.")}</p>
          <p>{pick("Gamato Piranti membalik pendekatan itu: semua alat dikumpulkan di satu antarmuka yang bersih, dan semua pemrosesan terjadi di browser. Tidak ada server pemrosesan yang bisa menyimpan berkasmu, karena memang tidak ada yang menerimanya.", "Gamato Piranti flips that approach: every tool lives in one clean interface and all processing happens in the browser. There is no processing server that could keep your files, because nothing receives them in the first place.")}</p>
          <p>{pick("Dibuat dan dirawat oleh WisDev, dengan komponen open source yang solid — dan terus diperluas berdasarkan kebutuhan pengguna.", "Built and maintained by WisDev on top of solid open-source components — and continuously expanded based on what users need.")}</p>
        </div>
      </section>

      <section aria-labelledby="about-principles">
        <h2 id="about-principles" className="mb-5 text-2xl font-bold text-slate-900 dark:text-white">{pick("Prinsip kami", "Our principles")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p, i) => (
            <motion.div key={p.title} {...fade(i)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">{p.icon}</div>
              <h3 className="mb-1.5 font-bold text-slate-900 dark:text-white">{p.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section aria-labelledby="about-how" className="rounded-3xl bg-slate-900 p-6 text-white sm:p-9 dark:border dark:border-slate-800">
        <h2 id="about-how" className="mb-5 text-2xl font-bold">{pick("Cara kerjanya", "How it works")}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-bold">{s.n}</span>
              <p className="font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-slate-300">{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 flex items-start gap-2 text-sm text-slate-300"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />{pick("Beberapa fitur memang butuh internet (peta, kamus dunia, unduhan model AI sekali pakai). Rinciannya ada di Kebijakan Privasi.", "A few features genuinely need the internet (maps, the world dictionary, one-time AI model downloads). The details are in the Privacy Policy.")}</p>
      </section>

      <section aria-labelledby="about-suite">
        <h2 id="about-suite" className="mb-1 flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white"><Layers className="h-6 w-6 text-indigo-500" aria-hidden="true" />{pick("Seluruh suite", "The whole suite")}</h2>
        <p className="mb-5 text-sm text-slate-600 dark:text-slate-400">{pick("Daftar ini diambil langsung dari menu, jadi selalu mutakhir.", "This list is read straight from the menu, so it is always up to date.")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {menuGroups.map((g) => (
            <div key={g.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <Link to={g.rootPath} className="flex items-center gap-2 font-bold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300">
                  <span className="text-indigo-600 dark:text-indigo-300">{g.icon}</span>{g.title}
                </Link>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{pick(`${g.items.length} alat`, `${g.items.length} tools`)}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{GROUP_BLURB[g.id]}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {g.items.map((it) => (
                  <li key={it.path}>
                    <Link to={it.path} className="inline-block rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300">{it.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="about-tech">
        <h2 id="about-tech" className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">{pick("Dibangun di atas open source", "Built on open source")}</h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">{pick("Terima kasih kepada para pengembang pustaka ini — Gamato Piranti berdiri di pundak mereka.", "Thank you to the maintainers of these libraries — Gamato Piranti stands on their shoulders.")}</p>
        <ul className="flex flex-wrap gap-2">
          {TECH.map((t) => (
            <li key={t} className="rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{t}</li>
          ))}
        </ul>
      </section>

      <Callout title={pick("Punya saran atau menemukan bug?", "Have a suggestion or found a bug?")}>
        {pick("Laporkan lewat ", "Tell us through ")}
        <a className="font-semibold underline underline-offset-2" href="https://github.com/wisma-develop/Gamato-Piranti/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>
        {pick(" — sertakan alat, browser, dan langkah yang kamu lakukan. Lihat juga ", " — include the tool, your browser, and the steps you took. See also the ")}
        <Link className="font-semibold underline underline-offset-2" to="/faq">FAQ</Link>.
      </Callout>

      <div className="text-center">
        <Link to="/" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-lg shadow-slate-900/20 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
          {pick("Mulai menjelajah", "Start exploring")}<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <DocFooterNav links={[{ to: "/faq", label: "FAQ" }, { to: "/privacy", label: pick("Kebijakan Privasi", "Privacy Policy") }, { to: "/terms", label: pick("Ketentuan Layanan", "Terms of Service") }]} />
    </div>
  );
}
