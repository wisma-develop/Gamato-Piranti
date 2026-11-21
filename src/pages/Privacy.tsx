import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Bullets, Callout, DocFooterNav, DocHero, DocLayout, DocSection } from "@/components/ui/StaticDoc";
import { pick } from "@/i18n";

const UPDATED = pick("Terakhir diperbarui: 18 November 2026", "Last updated: 18 November 2026");

interface Row { feature: string; service: string; sent: string; when: string }

export default function Privacy() {
  const toc = [
    { id: "ringkasan", label: pick("Ringkasan", "Summary") },
    { id: "tidak-dikumpulkan", label: pick("Yang tidak kami kumpulkan", "What we do not collect") },
    { id: "penyimpanan-lokal", label: pick("Penyimpanan di perangkatmu", "Storage on your device") },
    { id: "permintaan-jaringan", label: pick("Layanan pihak ketiga", "Third-party services") },
    { id: "izin-perangkat", label: pick("Izin kamera, mikrofon & lainnya", "Camera, microphone & other permissions") },
    { id: "hosting-log", label: pick("Hosting & log server", "Hosting & server logs") },
    { id: "cookie", label: pick("Cookie & pelacakan", "Cookies & tracking") },
    { id: "keamanan", label: pick("Keamanan", "Security") },
    { id: "hak-kontrol", label: pick("Kontrolmu atas data", "Your control over data") },
    { id: "anak", label: pick("Anak-anak", "Children") },
    { id: "perubahan", label: pick("Perubahan kebijakan", "Changes to this policy") },
    { id: "kontak", label: pick("Kontak", "Contact") },
  ];

  const rows: Row[] = [
    { feature: pick("Font khusus generator (sertifikat, CV, kartu nama)", "Special fonts for generators (certificates, CVs, business cards)"), service: "Google Fonts", sent: pick("Alamat IP & user-agent saat browser mengunduh file font", "IP address & user-agent when the browser downloads font files"), when: pick("Saat halaman memuat font", "When a page loads the fonts") },
    { feature: pick("Koordinat — peta", "Coordinates — map"), service: "OpenStreetMap, OpenTopoMap, Esri", sent: pick("Nomor ubin peta (area yang kamu lihat) & IP", "Map tile numbers (the area you are viewing) & IP"), when: pick("Saat peta online dipakai", "When the online map is used") },
    { feature: pick("Koordinat — cari tempat / alamat", "Coordinates — place / address search"), service: "OpenStreetMap Nominatim", sent: pick("Kata kunci pencarian atau koordinat titik", "The search keyword or the point's coordinates"), when: pick("Hanya saat kamu mencari / mengaktifkan cari alamat", "Only when you search or enable address lookup") },
    { feature: pick("Koordinat — ketinggian (elevasi)", "Coordinates — elevation"), service: "Open-Meteo", sent: pick("Koordinat titik terpilih", "The selected point's coordinates"), when: pick("Hanya saat kamu menekan tombol elevasi", "Only when you press the elevation button") },
    { feature: pick("Kamus Dunia (terjemahan)", "World Dictionary (translation)"), service: "MyMemory (translated.net)", sent: pick("Teks yang kamu ketik untuk diterjemahkan", "The text you type to be translated"), when: pick("Saat menekan tombol terjemahkan", "When you press translate") },
    { feature: pick("Transkrip audio (Whisper)", "Audio transcript (Whisper)"), service: pick("Hugging Face / CDN publik", "Hugging Face / public CDN"), sent: pick("Hanya permintaan unduhan file model (bukan audiomu)", "Only requests to download the model files (never your audio)"), when: pick("Sekali, lalu tersimpan di cache browser", "Once, then cached in the browser") },
    { feature: pick("OCR (baca teks dari gambar/PDF)", "OCR (read text from images/PDFs)"), service: pick("CDN publik (Tesseract.js)", "Public CDN (Tesseract.js)"), sent: pick("Hanya permintaan unduhan engine & data bahasa (bukan dokumenmu)", "Only requests to download the engine & language data (never your documents)"), when: pick("Saat pertama kali dipakai", "The first time it is used") },
    { feature: pick("Speech to Text", "Speech to Text"), service: pick("Layanan pengenalan suara bawaan browser (mis. Google di Chrome)", "The browser's built-in speech service (e.g. Google in Chrome)"), sent: pick("Suara dari mikrofon, diproses oleh vendor browser — bukan oleh Gamato Piranti", "Microphone audio, processed by the browser vendor — not by Gamato Piranti"), when: pick("Saat kamu menekan rekam", "When you press record") },
    { feature: pick("WA Link & tautan keluar", "WA Link & outgoing links"), service: "WhatsApp (wa.me) dll.", sent: pick("Tidak ada, sampai kamu sendiri mengeklik tautannya", "Nothing, until you click the link yourself"), when: pick("Saat kamu mengeklik", "When you click") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 sm:py-14">
      <DocHero
        badge={pick("Kebijakan", "Policy")}
        title={pick("Kebijakan Privasi", "Privacy Policy")}
        lead={pick("Singkatnya: berkasmu diproses di perangkatmu dan tidak diunggah ke server kami. Halaman ini menjelaskan dengan rinci apa yang tersimpan, apa yang keluar, dan kapan.", "In short: your files are processed on your device and are never uploaded to our servers. This page explains in detail what is stored, what leaves your device, and when.")}
        meta={UPDATED}
        icon={<Lock className="h-3.5 w-3.5" aria-hidden="true" />}
      />
      <DocLayout toc={toc}>
        <DocSection id="ringkasan" num={1} title={toc[0].label}>
          <Bullets items={[
            pick("Berkas, gambar, audio, video, dan teks yang kamu olah tetap di browser — tidak ada pemrosesan di sisi server.", "The files, images, audio, video, and text you work with stay in your browser — there is no server-side processing."),
            pick("Tanpa akun, tanpa iklan, tanpa analitik, dan tanpa cookie pelacak.", "No account, no ads, no analytics, and no tracking cookies."),
            pick("Beberapa fitur memang menghubungi layanan luar (peta, terjemahan, unduhan model AI). Semuanya tercantum di bagian 4 dan hanya aktif saat kamu memakai fitur tersebut.", "A few features do contact outside services (maps, translation, AI model downloads). All of them are listed in section 4 and only run when you use that feature."),
          ]} />
          <Callout title={pick("Tidak ada yang bisa kami ‘lihat’", "There is nothing for us to ‘see’")}>
            {pick("Karena pemrosesan terjadi di perangkatmu, kami tidak memiliki salinan dokumen, foto, atau rekamanmu. Kamu bisa membuktikannya sendiri: buka tab Network di DevTools browser dan perhatikan bahwa tidak ada unggahan saat kamu memproses berkas.", "Because processing happens on your device, we hold no copy of your documents, photos, or recordings. You can verify this yourself: open the Network tab in your browser's DevTools and notice that no upload happens while you process a file.")}
          </Callout>
        </DocSection>

        <DocSection id="tidak-dikumpulkan" num={2} title={toc[1].label}>
          <Bullets items={[
            pick("Isi berkas atau teks yang kamu proses.", "The contents of the files or text you process."),
            pick("Nama, email, nomor telepon, atau identitas lain — kami tidak meminta registrasi.", "Your name, email, phone number, or any other identity — we do not ask you to register."),
            pick("Lokasi, kontak, atau data perangkat untuk keperluan iklan atau profil.", "Location, contacts, or device data for advertising or profiling."),
            pick("Riwayat penggunaan alat yang dikirim ke pihak mana pun.", "Tool-usage history sent to any party."),
          ]} />
        </DocSection>

        <DocSection id="penyimpanan-lokal" num={3} title={toc[2].label}>
          <p>{pick("Gamato Piranti memakai penyimpanan browser (localStorage / cache) di perangkatmu — bukan di server kami — untuk kenyamanan berikut:", "Gamato Piranti uses your browser's storage (localStorage / cache) on your device — not on our servers — for the following conveniences:")}</p>
          <Bullets items={[
            <><strong>{pick("Preferensi", "Preferences")}</strong>: {pick("bahasa (ID/EN) dan tema terang/gelap.", "language (ID/EN) and light/dark theme.")}</>,
            <><strong>{pick("Draf otomatis", "Autosaved drafts")}</strong>: {pick("isi editor (mis. CV, surat, invoice) agar bisa dipulihkan saat halaman dibuka lagi.", "editor content (e.g. CVs, letters, invoices) so it can be restored when you reopen the page.")}</>,
            <><strong>{pick("Riwayat ringan", "Light history")}</strong>: {pick("alat yang baru dipakai di pencarian, serta pilihan format audio/video terakhir.", "recently used tools in search, and your last audio/video format choices.")}</>,
            <><strong>{pick("Cache model", "Model cache")}</strong>: {pick("berkas model Whisper/OCR yang diunduh sekali agar tidak diunduh ulang.", "Whisper/OCR model files downloaded once so they are not downloaded again.")}</>,
          ]} />
          <p>{pick("Draf berisi apa yang kamu ketik di editor, jadi di komputer bersama sebaiknya gunakan tombol “Mulai ulang” pada alat atau hapus data situs dari pengaturan browser setelah selesai.", "Drafts contain what you typed into an editor, so on a shared computer use the tool's “Start over” button or clear the site's data from your browser settings when you are done.")}</p>
        </DocSection>

        <DocSection id="permintaan-jaringan" num={4} title={toc[3].label}>
          <p>{pick("Inilah seluruh permintaan jaringan ke pihak luar yang bisa terjadi. Setiap layanan punya kebijakan privasinya sendiri; tabel hanya menjelaskan apa yang dikirim oleh Gamato Piranti.", "This is the complete list of outside network requests that can happen. Each service has its own privacy policy; the table only describes what Gamato Piranti sends.")}</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">{pick("Layanan pihak ketiga yang dihubungi fitur tertentu", "Third-party services contacted by specific features")}</caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th scope="col" className="px-3 py-2">{pick("Fitur", "Feature")}</th>
                  <th scope="col" className="px-3 py-2">{pick("Layanan", "Service")}</th>
                  <th scope="col" className="px-3 py-2">{pick("Yang dikirim", "What is sent")}</th>
                  <th scope="col" className="px-3 py-2">{pick("Kapan", "When")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.feature} className="align-top">
                    <th scope="row" className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">{r.feature}</th>
                    <td className="px-3 py-2">{r.service}</td>
                    <td className="px-3 py-2">{r.sent}</td>
                    <td className="px-3 py-2">{r.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout tone="warn" title={pick("Hati-hati dengan teks sensitif di fitur online", "Be careful with sensitive text in online features")}>
            {pick("Jangan menempelkan rahasia (kata sandi, data pribadi) ke Kamus Dunia atau kolom pencarian peta — teks itu dikirim ke layanan pihak ketiga. Alat lain tidak mengirim isinya ke mana pun.", "Do not paste secrets (passwords, personal data) into the World Dictionary or the map search box — that text is sent to a third-party service. Other tools send their content nowhere.")}
          </Callout>
        </DocSection>

        <DocSection id="izin-perangkat" num={5} title={toc[4].label}>
          <p>{pick("Alat tertentu meminta izin browser: kamera (pemindai QR, scan dokumen), mikrofon (rekam, speech to text, pengukur suara), layar (capture), lokasi (koordinat), clipboard, dan USB (cetak struk). Izin hanya diminta saat kamu menekan tombol terkait, hasilnya diproses di browser, dan bisa kamu cabut kapan saja di pengaturan situs browser.", "Some tools request browser permissions: camera (QR scanner, document scan), microphone (recording, speech to text, sound meter), screen (capture), location (coordinates), clipboard, and USB (receipt printing). A permission is only requested when you press the related button, the result is processed in the browser, and you can revoke it at any time in your browser's site settings.")}</p>
        </DocSection>

        <DocSection id="hosting-log" num={6} title={toc[5].label}>
          <p>{pick("Situs disajikan lewat penyedia hosting (saat ini Vercel). Seperti hampir semua server web, penyedia hosting dapat mencatat log akses standar — alamat IP, jenis browser, halaman yang diminta, dan waktu — untuk keamanan dan operasional. Gamato Piranti sendiri tidak memasang alat analitik atau pelacak tambahan.", "The site is served through a hosting provider (currently Vercel). Like almost every web server, the hosting provider may keep standard access logs — IP address, browser type, requested page, and time — for security and operations. Gamato Piranti itself does not add any analytics or tracking tools.")}</p>
        </DocSection>

        <DocSection id="cookie" num={7} title={toc[6].label}>
          <p>{pick("Gamato Piranti tidak menyetel cookie pelacak. Pengaturan kamu disimpan di localStorage (lihat bagian 3), yang tidak ikut terkirim ke server pada setiap permintaan seperti cookie. Karena itu kami tidak menampilkan spanduk persetujuan cookie.", "Gamato Piranti sets no tracking cookies. Your settings are kept in localStorage (see section 3), which — unlike cookies — is not sent to the server with every request. That is why we do not show a cookie consent banner.")}</p>
        </DocSection>

        <DocSection id="keamanan" num={8} title={toc[7].label}>
          <Bullets items={[
            pick("Seluruh situs disajikan lewat HTTPS dengan header keamanan (HSTS, nosniff, kebijakan referrer, izin perangkat terbatas).", "The whole site is served over HTTPS with security headers (HSTS, nosniff, referrer policy, restricted device permissions)."),
            pick("Pratinjau kode (mis. HTML/CSS/JS) berjalan di iframe ber-sandbox, terpisah dari halaman utama.", "Code previews (e.g. HTML/CSS/JS) run inside a sandboxed iframe, isolated from the main page."),
            pick("Input pengguna disanitasi sebelum dipakai pada nama berkas, tautan, dan teks yang diekspor.", "User input is sanitized before being used in file names, links, and exported text."),
            pick("Pembuat password/token memakai Web Crypto API; nilainya tidak pernah dikirim ke mana pun.", "The password/token generator uses the Web Crypto API; the values are never sent anywhere."),
          ]} />
          <p>{pick("Tidak ada sistem yang 100% kebal. Jika kamu menemukan celah keamanan, mohon laporkan secara bertanggung jawab lewat kontak di bawah sebelum mengungkapkannya.", "No system is 100% immune. If you find a security issue, please report it responsibly through the contact below before disclosing it.")}</p>
        </DocSection>

        <DocSection id="hak-kontrol" num={9} title={toc[8].label}>
          <Bullets items={[
            pick("Hapus draf: tombol “Mulai ulang” pada tiap alat, atau hapus data situs di pengaturan browser.", "Erase drafts: use the “Start over” button in each tool, or clear the site's data in your browser settings."),
            pick("Ganti atau reset preferensi: pilih bahasa di menu atas; tema lewat tombol terang/gelap.", "Change or reset preferences: choose the language in the top menu; the theme with the light/dark button."),
            pick("Cabut izin perangkat: lewat ikon gembok di samping alamat situs.", "Revoke device permissions: via the lock icon next to the site address."),
            pick("Karena kami tidak menyimpan data pribadimu di server, permintaan akses atau penghapusan data tidak berlaku pada isi berkasmu — semuanya ada di tanganmu.", "Because we keep no personal data about you on a server, access or deletion requests do not apply to your file contents — it is all in your hands."),
          ]} />
          <p>{pick("Pendekatan ini dirancang selaras dengan prinsip minimisasi data pada UU Pelindungan Data Pribadi (UU No. 27/2022) dan regulasi serupa, tanpa mengklaim sertifikasi kepatuhan tertentu.", "This approach is designed to align with the data-minimization principles of Indonesia's Personal Data Protection Law (Law No. 27 of 2022) and similar regulations, without claiming any specific compliance certification.")}</p>
        </DocSection>

        <DocSection id="anak" num={10} title={toc[9].label}>
          <p>{pick("Layanan ini bersifat umum dan tidak ditujukan khusus untuk anak di bawah 13 tahun. Karena kami tidak mengumpulkan data pribadi, tidak ada data anak yang kami simpan.", "This service is general-purpose and not specifically directed at children under 13. Because we collect no personal data, we hold no data about children.")}</p>
        </DocSection>

        <DocSection id="perubahan" num={11} title={toc[10].label}>
          <p>{pick("Jika kebijakan ini berubah, tanggal “Terakhir diperbarui” di atas akan ikut berubah. Perubahan material (misalnya penambahan layanan pihak ketiga) akan tercermin di tabel bagian 4.", "If this policy changes, the “Last updated” date above changes with it. Material changes (for example a newly added third-party service) will be reflected in the table in section 4.")}</p>
        </DocSection>

        <DocSection id="kontak" num={12} title={toc[11].label}>
          <p>{pick("Pertanyaan tentang privasi? Buka ", "Questions about privacy? Open an issue on ")}<a className="font-semibold text-indigo-700 underline underline-offset-2 dark:text-indigo-300" href="https://github.com/wisma-develop/Gamato-Piranti/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>{pick(" atau baca ", " or read the ")}<Link className="font-semibold text-indigo-700 underline underline-offset-2 dark:text-indigo-300" to="/faq">FAQ</Link>.</p>
        </DocSection>
      </DocLayout>
      <DocFooterNav links={[{ to: "/terms", label: pick("Ketentuan Layanan", "Terms of Service") }, { to: "/faq", label: "FAQ" }, { to: "/about", label: pick("Tentang kami", "About us") }]} />
    </div>
  );
}
