import { Link } from "react-router-dom";
import { Scale } from "lucide-react";
import { Bullets, Callout, DocFooterNav, DocHero, DocLayout, DocSection } from "@/components/ui/StaticDoc";
import { pick } from "@/i18n";

const UPDATED = pick("Terakhir diperbarui: 18 November 2026", "Last updated: 18 November 2026");

export default function Terms() {
  const toc = [
    { id: "penerimaan", label: pick("Penerimaan ketentuan", "Acceptance of terms") },
    { id: "layanan", label: pick("Tentang layanan", "About the service") },
    { id: "penggunaan", label: pick("Penggunaan yang diizinkan", "Permitted use") },
    { id: "larangan", label: pick("Penggunaan yang dilarang", "Prohibited use") },
    { id: "konten", label: pick("Berkas & hasil milikmu", "Your files & outputs") },
    { id: "bukan-nasihat", label: pick("Bukan nasihat profesional", "Not professional advice") },
    { id: "akurasi", label: pick("Akurasi & batasan teknis", "Accuracy & technical limits") },
    { id: "pihak-ketiga", label: pick("Layanan & pustaka pihak ketiga", "Third-party services & libraries") },
    { id: "hki", label: pick("Kekayaan intelektual", "Intellectual property") },
    { id: "garansi", label: pick("Tanpa jaminan", "No warranty") },
    { id: "tanggung-jawab", label: pick("Batasan tanggung jawab", "Limitation of liability") },
    { id: "perubahan", label: pick("Perubahan layanan & ketentuan", "Changes to the service & terms") },
    { id: "hukum", label: pick("Hukum yang berlaku", "Governing law") },
    { id: "kontak", label: pick("Kontak", "Contact") },
  ];
  let n = 0;
  const num = () => ++n;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 sm:py-14">
      <DocHero
        badge={pick("Kebijakan", "Policy")}
        title={pick("Ketentuan Layanan", "Terms of Service")}
        lead={pick("Aturan sederhana untuk memakai Gamato Piranti: gunakan dengan bijak, bertanggung jawab atas hasilmu, dan pahami batasan tiap alat.", "Simple rules for using Gamato Piranti: use it wisely, be responsible for your results, and understand the limits of each tool.")}
        meta={UPDATED}
        icon={<Scale className="h-3.5 w-3.5" aria-hidden="true" />}
      />
      <DocLayout toc={toc}>
        <DocSection id="penerimaan" num={num()} title={toc[0].label}>
          <p>{pick("Dengan mengakses atau memakai Gamato Piranti, kamu menyatakan telah membaca dan menyetujui ketentuan ini serta ", "By accessing or using Gamato Piranti you confirm that you have read and agree to these terms and to our ")}<Link className="font-semibold text-indigo-700 underline underline-offset-2 dark:text-indigo-300" to="/privacy">{pick("Kebijakan Privasi", "Privacy Policy")}</Link>{pick(". Jika tidak setuju, mohon hentikan penggunaan.", ". If you do not agree, please stop using the service.")}</p>
        </DocSection>
        <DocSection id="layanan" num={num()} title={toc[1].label}>
          <p>{pick("Gamato Piranti adalah kumpulan alat digital berbasis browser yang memproses data langsung di perangkatmu. Layanan disediakan gratis tanpa akun. Kami dapat menambah, mengubah, atau menghentikan fitur kapan saja.", "Gamato Piranti is a collection of browser-based digital tools that process data directly on your device. The service is provided free of charge without an account. We may add, change, or discontinue features at any time.")}</p>
        </DocSection>
        <DocSection id="penggunaan" num={num()} title={toc[2].label}>
          <p>{pick("Kamu boleh memakai alat untuk keperluan pribadi, pendidikan, maupun komersial — termasuk menggunakan hasil seperti QR code, PDF, gambar, dan dokumen yang kamu buat — selama sesuai ketentuan ini dan hukum yang berlaku.", "You may use the tools for personal, educational, and commercial purposes — including using the results such as QR codes, PDFs, images, and documents you create — as long as you comply with these terms and applicable law.")}</p>
        </DocSection>
        <DocSection id="larangan" num={num()} title={toc[3].label}>
          <p>{pick("Kamu dilarang memakai Gamato Piranti untuk:", "You may not use Gamato Piranti to:")}</p>
          <Bullets items={[
            pick("memalsukan dokumen, tanda tangan, stempel, sertifikat, tiket, atau identitas milik orang lain atau lembaga;", "forge documents, signatures, stamps, certificates, tickets, or identities belonging to other people or organizations;"),
            pick("menyebarkan spam, penipuan, phishing (termasuk lewat QR code atau WA Link), atau konten melanggar hukum;", "spread spam, fraud, or phishing (including via QR codes or WA Links), or unlawful content;"),
            pick("melanggar hak cipta, privasi, atau hak pihak lain;", "infringe copyright, privacy, or the rights of others;"),
            pick("mengganggu, membebani, atau mencoba menembus keamanan layanan dan penyedia pihak ketiganya;", "disrupt, overload, or try to breach the security of the service and its third-party providers;"),
            pick("menyalin ulang atau memperjualbelikan layanan ini sebagai produk sendiri tanpa memenuhi lisensi sumber terbukanya.", "re-package or resell this service as your own product without meeting its open-source licenses."),
          ]} />
        </DocSection>
        <DocSection id="konten" num={num()} title={toc[4].label}>
          <p>{pick("Berkas, teks, dan hasil olahanmu tetap menjadi milikmu. Karena tidak diunggah, kami tidak memperoleh lisensi atas kontenmu. Kamu bertanggung jawab penuh atas isi dan penggunaannya, termasuk memastikan kamu berhak mengolah berkas tersebut.", "Your files, text, and processed results remain yours. Because nothing is uploaded, we obtain no license to your content. You are fully responsible for its contents and use, including making sure you have the right to process the files.")}</p>
          <p>{pick("Simpan cadangan pekerjaan pentingmu. Draf otomatis hanya tersimpan di browser dan bisa hilang jika data situs dihapus.", "Keep backups of important work. Autosaved drafts live only in your browser and can be lost if site data is cleared.")}</p>
        </DocSection>
        <DocSection id="bukan-nasihat" num={num()} title={toc[5].label}>
          <Callout tone="warn" title={pick("Penting", "Important")}>
            {pick("Kalkulator (pajak, bunga, investasi, cicilan, HPP), template surat/perjanjian/kuasa, kwitansi, invoice, dan alat sejenis hanyalah bantuan. Hasilnya bukan nasihat hukum, pajak, keuangan, atau medis. Validitas hukum dokumen bergantung pada yurisdiksi dan kebutuhanmu — konsultasikan dengan profesional bila perlu. “Meterai” pada template hanyalah penanda visual, bukan e-Meterai resmi.", "Calculators (tax, interest, investment, installments, COGS), letter/agreement/power-of-attorney templates, receipts, invoices, and similar tools are aids only. Their output is not legal, tax, financial, or medical advice. The legal validity of a document depends on your jurisdiction and needs — consult a professional when in doubt. A “stamp duty” box on a template is only a visual placeholder, not an official e-stamp.")}
          </Callout>
        </DocSection>
        <DocSection id="akurasi" num={num()} title={toc[6].label}>
          <Bullets items={[
            pick("Pemrosesan memakai sumber daya perangkatmu; berkas sangat besar dapat lambat atau gagal di perangkat dengan memori terbatas.", "Processing uses your device's resources; very large files can be slow or fail on devices with limited memory."),
            pick("OCR, transkrip, dan terjemahan otomatis bisa keliru — periksa hasilnya sebelum dipakai.", "OCR, transcripts, and automatic translation can be wrong — review results before relying on them."),
            pick("“Kunci PDF” mengubah halaman menjadi gambar; itu bukan enkripsi atau kata sandi. “Buka proteksi” hanya melepas pembatasan izin, bukan membuka PDF yang butuh kata sandi.", "“Lock PDF” turns pages into images; it is not encryption or a password. “Unlock” only removes permission restrictions and cannot open a PDF that needs a password."),
            pick("Fitur dan format dukungan video/audio bergantung pada browser yang kamu pakai.", "Video/audio features and supported formats depend on the browser you use."),
          ]} />
        </DocSection>
        <DocSection id="pihak-ketiga" num={num()} title={toc[7].label}>
          <p>{pick("Beberapa fitur memakai layanan pihak ketiga (peta, pencarian tempat, terjemahan, unduhan model) dan pustaka open source. Layanan tersebut tunduk pada ketentuan dan kebijakan masing-masing, dan kami tidak bertanggung jawab atas ketersediaan atau konten mereka. Rincian ada di ", "Some features use third-party services (maps, place search, translation, model downloads) and open-source libraries. Those are governed by their own terms and policies, and we are not responsible for their availability or content. Details are in the ")}<Link className="font-semibold text-indigo-700 underline underline-offset-2 dark:text-indigo-300" to="/privacy#permintaan-jaringan">{pick("Kebijakan Privasi", "Privacy Policy")}</Link>.</p>
        </DocSection>
        <DocSection id="hki" num={num()} title={toc[8].label}>
          <p>{pick("Nama, logo, dan tampilan Gamato Piranti adalah milik WisDev. Pustaka open source yang dipakai tetap berada di bawah lisensinya masing-masing. Hasil buatanmu — termasuk QR code yang kamu generate — bebas kamu pakai, termasuk untuk keperluan komersial.", "The Gamato Piranti name, logo, and look and feel belong to WisDev. The open-source libraries used remain under their respective licenses. What you create — including the QR codes you generate — is free for you to use, including commercially.")}</p>
        </DocSection>
        <DocSection id="garansi" num={num()} title={toc[9].label}>
          <p>{pick("Layanan disediakan “sebagaimana adanya” dan “sebagaimana tersedia”, tanpa jaminan apa pun, tersurat maupun tersirat, termasuk kesesuaian untuk tujuan tertentu, bebas galat, atau tersedia tanpa gangguan.", "The service is provided “as is” and “as available”, without warranties of any kind, express or implied, including fitness for a particular purpose, freedom from errors, or uninterrupted availability.")}</p>
        </DocSection>
        <DocSection id="tanggung-jawab" num={num()} title={toc[10].label}>
          <p>{pick("Sejauh diizinkan hukum, WisDev dan kontributor tidak bertanggung jawab atas kerugian langsung, tidak langsung, insidental, atau konsekuensial — termasuk kehilangan data atau keuntungan — yang timbul dari penggunaan atau ketidakmampuan memakai layanan.", "To the extent permitted by law, WisDev and its contributors are not liable for direct, indirect, incidental, or consequential damages — including loss of data or profits — arising from the use of, or inability to use, the service.")}</p>
        </DocSection>
        <DocSection id="perubahan" num={num()} title={toc[11].label}>
          <p>{pick("Kami dapat memperbarui ketentuan ini dari waktu ke waktu. Tanggal “Terakhir diperbarui” menunjukkan versi terbaru; melanjutkan penggunaan setelah perubahan berarti kamu menerimanya.", "We may update these terms from time to time. The “Last updated” date shows the current version; continuing to use the service after a change means you accept it.")}</p>
        </DocSection>
        <DocSection id="hukum" num={num()} title={toc[12].label}>
          <p>{pick("Ketentuan ini diatur oleh hukum Republik Indonesia. Sengketa diupayakan diselesaikan secara musyawarah terlebih dahulu.", "These terms are governed by the laws of the Republic of Indonesia. Disputes will first be sought to be resolved amicably.")}</p>
        </DocSection>
        <DocSection id="kontak" num={num()} title={toc[13].label}>
          <p>{pick("Pertanyaan tentang ketentuan ini? Hubungi kami lewat ", "Questions about these terms? Reach us through ")}<a className="font-semibold text-indigo-700 underline underline-offset-2 dark:text-indigo-300" href="https://github.com/wisma-develop/Gamato-Piranti/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>.</p>
        </DocSection>
      </DocLayout>
      <DocFooterNav links={[{ to: "/privacy", label: pick("Kebijakan Privasi", "Privacy Policy") }, { to: "/faq", label: "FAQ" }, { to: "/about", label: pick("Tentang kami", "About us") }]} />
    </div>
  );
}
