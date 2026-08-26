import type { FC } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "@/components/layout/Layout";
import { PageShell } from "@/components/PageShell";
import ScrollToTop from "@/components/ScrollToTop";

import Home from "@/pages/Home";
import About from "@/pages/About";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";

import KodeCategory from "@/pages/categories/KodeCategory";
import DokumenCategory from "@/pages/categories/DokumenCategory";
import OfficeCategory from "@/pages/categories/OfficeCategory";
import GambarCategory from "@/pages/categories/GambarCategory";
import UtilitasCategory from "@/pages/categories/UtilitasCategory";
import SpesialCategory from "@/pages/categories/SpesialCategory";
import VideoCategory from "@/pages/categories/VideoCategory";
import AudioCategory from "@/pages/categories/AudioCategory";

import { QrCodeGenerator } from "@/features/qr-barcode/QrCodeGenerator";
import { BarcodeGenerator } from "@/features/qr-barcode/BarcodeGenerator";
import { HidScanner } from "@/features/qr-barcode/HidScanner";
import { MorseCode } from "@/features/qr-barcode/MorseCode";
import { QrScanner } from "@/features/qr-barcode/QrScanner";

import { PdfMerge } from "@/features/pdf/PdfMerge";
import { PdfSplit } from "@/features/pdf/PdfSplit";
import { PdfCompress } from "@/features/pdf/PdfCompress";
import { PdfExtract } from "@/features/pdf/PdfExtract";
import { PdfDeletePages } from "@/features/pdf/PdfDeletePages";
import { PdfRotate } from "@/features/pdf/PdfRotate";
import { PdfOrganize } from "@/features/pdf/PdfOrganize";
import { PdfImagesToPdf } from "@/features/pdf/PdfImagesToPdf";
import { PdfTextToPdf } from "@/features/pdf/PdfTextToPdf";
import { PdfWordToPdf } from "@/features/pdf/PdfWordToPdf";
import { PdfExcelToPdf } from "@/features/pdf/PdfExcelToPdf";
import { PdfPptToPdf } from "@/features/pdf/PdfPptToPdf";
import { PdfEdit } from "@/features/pdf/PdfEdit";
import { PdfSign } from "@/features/pdf/PdfSign";
import { PdfWatermark } from "@/features/pdf/PdfWatermark";
import { PdfHtmlToPdf } from "@/features/pdf/PdfHtmlToPdf";
import { PdfPageNumbers } from "@/features/pdf/PdfPageNumbers";
import { PdfUnlock } from "@/features/pdf/PdfUnlock";
import { PdfReader } from "@/features/pdf/PdfReader";
import { PdfRedact } from "@/features/pdf/PdfRedact";
import { PdfScan } from "@/features/pdf/PdfScan";
import { PdfToImage } from "@/features/pdf/PdfToImage";
import { PdfToWord } from "@/features/pdf/PdfToWord";
import { PdfToExcel } from "@/features/pdf/PdfToExcel";
import { PdfOcr } from "@/features/pdf/PdfOcr";
import { PdfProtect } from "@/features/pdf/PdfProtect";
import { DocReader } from "@/features/docs/DocReader";

import { DocTools } from "@/features/docs/DocTools";
import { SheetStudio } from "@/features/office/SheetStudio";
import { SlideStudio } from "@/features/office/SlideStudio";

import { ImageCompress } from "@/features/image/ImageCompress";
import { ImageResize } from "@/features/image/ImageResize";
import { ImageConvert } from "@/features/image/ImageConvert";
import { ImageRotate } from "@/features/image/ImageRotate";
import { ImageMetadataRemover } from "@/features/image/ImageMetadataRemover";
import { ImageRawPreview } from "@/features/image/ImageRawPreview";
import { ImageCrop } from "@/features/image/ImageCrop";
import { ImageRemoveBg } from "@/features/image/ImageRemoveBg";
import { ImageWatermark } from "@/features/image/ImageWatermark";
import { HtmlToImage } from "@/features/image/HtmlToImage";
import { MemeGenerator } from "@/features/image/MemeGenerator";
import { ColorPicker } from "@/features/image/ColorPicker";
import { PhotoEditor } from "@/features/image/PhotoEditor";

import { UtilityJsonBase64 } from "@/features/utility/UtilityJsonBase64";
import { UtilityBulkText } from "@/features/utility/UtilityBulkText";
import { UtilityMediaLink } from "@/features/utility/UtilityMediaLink";
import { UtilityAliasEmail } from "@/features/utility/UtilityAliasEmail";
import { UtilityTaxCalculator } from "@/features/utility/UtilityTaxCalculator";
import { UtilityInterestCalculator } from "@/features/utility/UtilityInterestCalculator";
import { UtilityStatistics } from "@/features/utility/UtilityStatistics";
import { UtilityPasswordToken } from "@/features/utility/UtilityPasswordToken";
import { UtilityWorldDictionary } from "@/features/utility/UtilityWorldDictionary";
import { UtilityHtmlPreview } from "@/features/utility/UtilityHtmlPreview";
import { UtilityDiagramFormula } from "@/features/utility/UtilityDiagramFormula";
import { CalculatorHub } from "@/features/utility/calculator/CalculatorHub";

import { AudioSpeechToText } from "@/features/audio/AudioSpeechToText";
import { AudioTextToSpeech } from "@/features/audio/AudioTextToSpeech";
import { AudioSoundMeter } from "@/features/audio/AudioSoundMeter";
import { AudioExtractFromVideo } from "@/features/audio/AudioExtractFromVideo";

import { CertificateGenerator } from "@/features/special/CertificateGenerator";
import { WaLink } from "@/features/special/WaLink";
import { KwitansiGenerator } from "@/features/special/KwitansiGenerator";
import { InvoiceGenerator } from "@/features/special/InvoiceGenerator";
import { StrukGenerator } from "@/features/special/StrukGenerator";
import { BusinessCardGenerator } from "@/features/special/BusinessCardGenerator";
import { CvMaker } from "@/features/special/CvMaker";
import { VideoTrim } from "@/features/video/VideoTrim";
import { VideoCrop } from "@/features/video/VideoCrop";
import { VideoSubtitle } from "@/features/video/VideoSubtitle";
import { VideoMerge } from "@/features/video/VideoMerge";
import { VideoFilter } from "@/features/video/VideoFilter";
import { VideoThumbnail } from "@/features/video/VideoThumbnail";

export const App: FC = () => (
  <BrowserRouter>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />

        {/* ── Kode ─────────────────────────────────────────────────────── */}
        {/* /qr = halaman kategori (daftar semua submenu Kode) */}
        <Route path="qr" element={<KodeCategory />} />
        <Route
          path="qr/qr-code"
          element={
            <PageShell badge="Kode" title="QR Code" subtitle="QR code full custom — bentuk titik & sudut, warna, hingga logo bebas diatur, dengan preview real-time.">
              <QrCodeGenerator />
            </PageShell>
          }
        />
        <Route
          path="qr/barcode"
          element={
            <PageShell badge="Kode" title="Barcode" subtitle="6 format barcode (CODE128, EAN-13, EAN-8, UPC, CODE39, ITF-14) dengan validasi otomatis dan cetak massal ke PDF.">
              <BarcodeGenerator />
            </PageShell>
          }
        />
        <Route
          path="qr/scan-hid"
          element={
            <PageShell badge="Kode" title="Scan HID" subtitle="Terima input dari scanner barcode/QR bertipe HID (USB/Bluetooth) yang bekerja seperti keyboard.">
              <HidScanner />
            </PageShell>
          }
        />
        <Route
          path="qr/kode-morse"
          element={
            <PageShell badge="Kode" title="Kode Morse" subtitle="Konversi teks ke kode Morse (dan sebaliknya), lengkap dengan audio beep yang bisa diunduh.">
              <MorseCode />
            </PageShell>
          }
        />
        <Route
          path="qr/scan-qr"
          element={
            <PageShell badge="Kode" title="QR Code Scanner" subtitle="Baca QR code dari gambar yang diunggah atau langsung dari kamera.">
              <QrScanner />
            </PageShell>
          }
        />

        {/* ── Dokumen ──────────────────────────────────────────────────── */}
        {/* /pdf = halaman kategori Dokumen (PDF Lab – Suite + Doc Studio) */}
        <Route path="pdf" element={<DokumenCategory />} />
        <Route
          path="pdf/gabung"
          element={
            <PageShell badge="Dokumen" title="Gabung PDF" subtitle="Gabungkan beberapa file PDF menjadi satu file, urutan mengikuti daftar file yang kamu unggah.">
              <PdfMerge />
            </PageShell>
          }
        />
        <Route
          path="pdf/pecah"
          element={
            <PageShell badge="Dokumen" title="Pecah PDF" subtitle="Setiap halaman PDF diunduh sebagai file terpisah, satu per satu.">
              <PdfSplit />
            </PageShell>
          }
        />
        <Route
          path="pdf/kompres"
          element={
            <PageShell badge="Dokumen" title="Kompres PDF" subtitle="Kurangi ukuran file PDF tanpa mengubah isi — pilih tingkat kompresi ringan, sedang, atau tinggi.">
              <PdfCompress />
            </PageShell>
          }
        />
        <Route
          path="pdf/ekstrak"
          element={
            <PageShell badge="Dokumen" title="Ekstrak Halaman" subtitle="Ambil hanya halaman tertentu dari PDF, misalnya 1-3,5,8-9.">
              <PdfExtract />
            </PageShell>
          }
        />
        <Route
          path="pdf/hapus-halaman"
          element={
            <PageShell badge="Dokumen" title="Hapus Halaman" subtitle="Buang halaman yang tidak dibutuhkan, sisanya tetap utuh.">
              <PdfDeletePages />
            </PageShell>
          }
        />
        <Route
          path="pdf/putar"
          element={
            <PageShell badge="Dokumen" title="Putar Halaman" subtitle="Rotasi halaman PDF yang miring atau terbalik — bisa semua halaman atau halaman tertentu.">
              <PdfRotate />
            </PageShell>
          }
        />
        <Route
          path="pdf/atur-ulang"
          element={
            <PageShell badge="Dokumen" title="Atur Ulang Halaman" subtitle="Susun ulang urutan halaman PDF sesuai kebutuhanmu.">
              <PdfOrganize />
            </PageShell>
          }
        />
        <Route
          path="pdf/gambar-ke-pdf"
          element={
            <PageShell badge="Dokumen" title="Gambar ke PDF" subtitle="Ubah kumpulan gambar JPG/PNG menjadi satu file PDF, tiap gambar jadi satu halaman.">
              <PdfImagesToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/teks-ke-pdf"
          element={
            <PageShell badge="Dokumen" title="Teks ke PDF" subtitle="Konversi teks polos menjadi dokumen PDF yang rapi dan bisa dibuka di mana saja.">
              <PdfTextToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/word-ke-pdf"
          element={
            <PageShell badge="Dokumen" title="Word ke PDF" subtitle="Konversi file .docx menjadi PDF, lengkap dengan format bold/italic/underline dan perataan paragraf.">
              <PdfWordToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/excel-ke-pdf"
          element={
            <PageShell badge="Dokumen" title="Excel ke PDF" subtitle="Konversi sheet pertama file .xlsx menjadi tabel PDF yang rapi.">
              <PdfExcelToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/ppt-ke-pdf"
          element={
            <PageShell badge="Dokumen" title="PowerPoint ke PDF" subtitle="Konversi file .pptx menjadi PDF, satu slide jadi satu halaman.">
              <PdfPptToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/edit"
          element={
            <PageShell badge="Dokumen" title="Edit PDF" subtitle="Tambahkan teks bebas atau kotak penanda ke halaman PDF mana pun.">
              <PdfEdit />
            </PageShell>
          }
        />
        <Route
          path="pdf/tanda-tangan"
          element={
            <PageShell badge="Dokumen" title="Tanda Tangan PDF" subtitle="Gambar atau ketik tanda tangan, lalu tempelkan ke halaman PDF.">
              <PdfSign />
            </PageShell>
          }
        />
        <Route
          path="pdf/watermark"
          element={
            <PageShell badge="Dokumen" title="Watermark PDF" subtitle="Tambahkan watermark teks ke semua halaman PDF sekaligus.">
              <PdfWatermark />
            </PageShell>
          }
        />
        <Route
          path="pdf/html-ke-pdf"
          element={
            <PageShell badge="Dokumen" title="HTML ke PDF" subtitle="Render kode HTML/CSS menjadi dokumen PDF — cocok untuk invoice atau surat custom.">
              <PdfHtmlToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/nomor-halaman"
          element={
            <PageShell badge="Dokumen" title="Nomor Halaman" subtitle="Tambahkan nomor halaman dengan format dan posisi bebas ke seluruh PDF.">
              <PdfPageNumbers />
            </PageShell>
          }
        />
        <Route
          path="pdf/unlock"
          element={
            <PageShell badge="Dokumen" title="Unlock PDF" subtitle="Hapus batasan cetak/salin/edit dari PDF yang tidak memerlukan password pembuka.">
              <PdfUnlock />
            </PageShell>
          }
        />
        <Route
          path="pdf/reader"
          element={
            <PageShell badge="Dokumen" title="PDF Reader" subtitle="Baca PDF langsung di browser, lengkap dengan info dokumen.">
              <PdfReader />
            </PageShell>
          }
        />
        <Route
          path="pdf/sensor"
          element={
            <PageShell badge="Dokumen" title="Sensor / Redaksi PDF" subtitle="Hitamkan informasi sensitif secara permanen — halaman disensor diubah jadi gambar agar teks di baliknya tak bisa diambil lagi.">
              <PdfRedact />
            </PageShell>
          }
        />
        <Route
          path="pdf/scan"
          element={
            <PageShell badge="Dokumen" title="Scan PDF" subtitle="Ubah foto dokumen menjadi PDF hasil scan yang rapi.">
              <PdfScan />
            </PageShell>
          }
        />
        <Route
          path="pdf/ke-gambar"
          element={
            <PageShell badge="Dokumen" title="PDF ke Gambar" subtitle="Render setiap halaman PDF menjadi gambar PNG/JPEG kualitas tinggi.">
              <PdfToImage />
            </PageShell>
          }
        />
        <Route
          path="pdf/ke-word"
          element={
            <PageShell badge="Dokumen" title="PDF ke Word" subtitle="Ekstrak teks asli dari PDF menjadi dokumen .docx yang bisa diedit.">
              <PdfToWord />
            </PageShell>
          }
        />
        <Route
          path="pdf/ke-excel"
          element={
            <PageShell badge="Dokumen" title="PDF ke Excel" subtitle="Deteksi baris & kolom dari PDF, ekspor sebagai .xlsx.">
              <PdfToExcel />
            </PageShell>
          }
        />
        <Route
          path="pdf/ocr"
          element={
            <PageShell badge="Dokumen" title="OCR" subtitle="Baca teks dari PDF hasil scan atau foto dokumen — hasilnya bisa disalin atau diunduh.">
              <PdfOcr />
            </PageShell>
          }
        />
        <Route
          path="pdf/protect"
          element={
            <PageShell badge="Dokumen" title="Protect PDF" subtitle="Kunci konten PDF dari salin/edit dengan mengubahnya menjadi gambar flat.">
              <PdfProtect />
            </PageShell>
          }
        />
        <Route path="pdf/suara-ke-teks" element={<Navigate to="/audio/suara-ke-teks" replace />} />
        <Route path="pdf/teks-ke-suara" element={<Navigate to="/audio/teks-ke-suara" replace />} />
        <Route
          path="pdf/baca-dokumen"
          element={
            <PageShell badge="Dokumen" title="Doc Reader" subtitle="Baca file .txt, .docx, atau .rtf dengan tampilan nyaman — bisa juga didengarkan.">
              <DocReader />
            </PageShell>
          }
        />

        {/* Doc Studio dipindah ke bawah kategori Office Tools — path lama dialihkan supaya bookmark/link lama tetap jalan */}
        <Route path="docs" element={<Navigate to="/office/doc-studio" replace />} />

        {/* ── Office Tools ─────────────────────────────────────────────── */}
        <Route path="office" element={<OfficeCategory />} />
        <Route
          path="office/doc-studio"
          element={
            <PageShell
              badge="Office Tools"
              title="Doc Studio"
              subtitle="Editor dokumen ringan dengan ekspor .docx, .pdf, .txt — dilengkapi Find & Replace, template cepat, dan snapshot sesi."
            >
              <DocTools />
            </PageShell>
          }
        />
        <Route
          path="office/sheet-studio"
          element={
            <PageShell
              badge="Office Tools"
              title="Sheet Studio"
              subtitle="Spreadsheet penuh — rumus, format sel, banyak sheet, dan ekspor .xlsx / .csv / .pdf, semua diproses di perangkatmu."
            >
              <SheetStudio />
            </PageShell>
          }
        />
        <Route
          path="office/slide-studio"
          element={
            <PageShell
              badge="Office Tools"
              title="Slide Studio"
              subtitle="Editor presentasi — teks, bentuk, gambar, banyak slide, mode tampilkan layar penuh, dan ekspor .pdf / gambar."
            >
              <SlideStudio />
            </PageShell>
          }
        />

        {/* ── Gambar ───────────────────────────────────────────────────── */}
        <Route path="image" element={<GambarCategory />} />
        <Route
          path="image/kompres"
          element={
            <PageShell badge="Gambar" title="Kompres Gambar" subtitle="Kurangi ukuran file gambar tanpa mengubah dimensi — atur kualitas dengan slider.">
              <ImageCompress />
            </PageShell>
          }
        />
        <Route
          path="image/resize"
          element={
            <PageShell badge="Gambar" title="Ubah Ukuran" subtitle="Ubah dimensi gambar dengan rasio tetap terjaga — ideal untuk thumbnail dan upload.">
              <ImageResize />
            </PageShell>
          }
        />
        <Route
          path="image/konversi"
          element={
            <PageShell badge="Gambar" title="Konversi Format" subtitle="Konversi antar format JPEG, PNG, dan WEBP.">
              <ImageConvert />
            </PageShell>
          }
        />
        <Route
          path="image/putar"
          element={
            <PageShell badge="Gambar" title="Putar Gambar" subtitle="Putar foto yang miring atau terbalik, diterapkan ke semua file yang dipilih.">
              <ImageRotate />
            </PageShell>
          }
        />
        <Route
          path="image/hapus-metadata"
          element={
            <PageShell badge="Gambar" title="Hapus Metadata" subtitle="Hapus EXIF, GPS, dan data sensitif lainnya dari gambar via re-encode canvas.">
              <ImageMetadataRemover />
            </PageShell>
          }
        />
        <Route
          path="image/raw-preview"
          element={
            <PageShell badge="Gambar" title="Baca Foto RAW" subtitle="Ekstrak preview JPEG yang tersimpan di dalam file RAW kamera (CR2, NEF, ARW, DNG, dan lainnya).">
              <ImageRawPreview />
            </PageShell>
          }
        />
        <Route
          path="image/crop"
          element={
            <PageShell badge="Gambar" title="Crop Gambar" subtitle="Potong area gambar secara interaktif dengan preset rasio siap pakai.">
              <ImageCrop />
            </PageShell>
          }
        />
        <Route
          path="image/hapus-background"
          element={
            <PageShell badge="Gambar" title="Hapus Background" subtitle="Hapus warna latar solid (chroma-key) dan unduh sebagai PNG transparan.">
              <ImageRemoveBg />
            </PageShell>
          }
        />
        <Route
          path="image/watermark"
          element={
            <PageShell badge="Gambar" title="Watermark Gambar" subtitle="Tambahkan watermark teks atau logo, sekali tempel atau diulang ke seluruh gambar.">
              <ImageWatermark />
            </PageShell>
          }
        />
        <Route
          path="image/html-ke-gambar"
          element={
            <PageShell badge="Gambar" title="HTML ke Gambar" subtitle="Render kode HTML/CSS menjadi gambar PNG — cocok untuk kartu kutipan, badge, atau banner.">
              <HtmlToImage />
            </PageShell>
          }
        />
        <Route
          path="image/meme-generator"
          element={
            <PageShell badge="Gambar" title="Meme Generator" subtitle="Tambahkan teks bergaya meme yang bisa digeser bebas di atas gambar.">
              <MemeGenerator />
            </PageShell>
          }
        />
        <Route
          path="image/photo-editor"
          element={
            <PageShell badge="Gambar" title="Photo Editor" subtitle="Sesuaikan kecerahan, kontras, saturasi, filter warna, putar, dan balik gambar.">
              <PhotoEditor />
            </PageShell>
          }
        />
        <Route
          path="image/color-picker"
          element={
            <PageShell badge="Gambar" title="Color Picker & Palette" subtitle="Ambil warna dari gambar (HEX/RGB/HSL) dan ekstrak palet warna dominan otomatis.">
              <ColorPicker />
            </PageShell>
          }
        />

        {/* ── Utilitas ─────────────────────────────────────────────────── */}
        <Route path="utility" element={<UtilitasCategory />} />
        <Route
          path="utility/json-base64"
          element={
            <PageShell badge="Utilitas" title="JSON & Base64" subtitle="Format JSON rapi, serta encode/decode Base64.">
              <UtilityJsonBase64 />
            </PageShell>
          }
        />
        <Route
          path="utility/bulk-teks"
          element={
            <PageShell badge="Utilitas" title="Bulk Teks" subtitle="Manipulasi daftar teks — hapus duplikat, sort, acak, nomori, dan lainnya.">
              <UtilityBulkText />
            </PageShell>
          }
        />
        <Route
          path="utility/link-media"
          element={
            <PageShell badge="Utilitas" title="Link Media" subtitle="Analisis link video/file untuk unduhan langsung.">
              <UtilityMediaLink />
            </PageShell>
          }
        />
        <Route
          path="utility/alias-email"
          element={
            <PageShell badge="Utilitas" title="Alias Email" subtitle="Buat alamat email alternatif untuk pendaftaran.">
              <UtilityAliasEmail />
            </PageShell>
          }
        />
        <Route
          path="utility/kalkulator-pajak"
          element={
            <PageShell badge="Utilitas" title="Kalkulator Pajak" subtitle="Hitung PPN eksklusif maupun inklusif.">
              <UtilityTaxCalculator />
            </PageShell>
          }
        />
        <Route
          path="utility/kalkulator-bunga"
          element={
            <PageShell badge="Utilitas" title="Kalkulator Bunga" subtitle="Hitung bunga sederhana & majemuk.">
              <UtilityInterestCalculator />
            </PageShell>
          }
        />
        <Route
          path="utility/statistik"
          element={
            <PageShell badge="Utilitas" title="Statistik" subtitle="Mean, median, min, max, dan standar deviasi dari sekumpulan angka.">
              <UtilityStatistics />
            </PageShell>
          }
        />
        <Route
          path="utility/password-token"
          element={
            <PageShell badge="Utilitas" title="Password & Token" subtitle="Generator password & token berbasis Web Crypto API — aman dan acak.">
              <UtilityPasswordToken />
            </PageShell>
          }
        />
        <Route
          path="utility/kamus-dunia"
          element={
            <PageShell badge="Utilitas" title="Kamus Dunia" subtitle="Cari arti kata & terjemahkan kalimat lintas puluhan bahasa dunia.">
              <UtilityWorldDictionary />
            </PageShell>
          }
        />
        <Route
          path="utility/html-preview"
          element={
            <PageShell badge="Utilitas" title="HTML Preview" subtitle="Tulis HTML, CSS, dan JavaScript, lihat hasilnya langsung secara real-time.">
              <UtilityHtmlPreview />
            </PageShell>
          }
        />
        <Route
          path="utility/diagram-rumus"
          element={
            <PageShell badge="Utilitas" title="Diagram & Rumus Studio" subtitle="Buat & preview flowchart, struktur organisasi, chart, hingga rumus matematika (LaTeX).">
              <UtilityDiagramFormula />
            </PageShell>
          }
        />
        <Route path="utility/pengukur-suara" element={<Navigate to="/audio/pengukur-suara" replace />} />
        <Route
          path="utility/kalkulator"
          element={
            <PageShell badge="Utilitas" title="Kalkulator" subtitle="Satu tempat untuk semua kalkulator: standar, pajak, bunga, investasi, cicilan, rumus, hingga HPP/COGS.">
              <CalculatorHub />
            </PageShell>
          }
        />

        {/* ── Spesial ──────────────────────────────────────────────────── */}
        <Route path="special" element={<SpesialCategory />} />
        <Route
          path="special/kwitansi"
          element={
            <PageShell badge="Spesial" title="Kwitansi" subtitle="Kwitansi pembayaran profesional dengan logo custom — export PNG & PDF, siap cetak.">
              <KwitansiGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/invoice"
          element={
            <PageShell badge="Spesial" title="Invoice" subtitle="Invoice profesional dengan item dinamis, logo custom, diskon & pajak — export PNG & PDF.">
              <InvoiceGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/struk"
          element={
            <PageShell badge="Spesial" title="Struk / Nota" subtitle="Struk kasir custom dengan logo — export PNG & PDF, cetak langsung ke printer USB/Bluetooth.">
              <StrukGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/kartu-nama"
          element={
            <PageShell badge="Spesial" title="Kartu Nama" subtitle="Kartu nama profesional dengan logo custom — export PNG & PDF, siap cetak.">
              <BusinessCardGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/sertifikat"
          element={
            <PageShell badge="Spesial" title="Sertifikat & Piagam" subtitle="Generator sertifikat massal, full custom — template, font, dan posisi bebas diatur.">
              <CertificateGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/wa-link"
          element={
            <PageShell badge="Spesial" title="WA Link" subtitle="Buka chat WhatsApp langsung tanpa perlu menyimpan kontak.">
              <WaLink />
            </PageShell>
          }
        />
        <Route
          path="special/pembuat-cv"
          element={
            <PageShell badge="Spesial" title="Pembuat CV" subtitle="Buat CV/resume profesional dengan 5 pilihan template, halaman otomatis mengikuti panjang isi — export PDF & PNG.">
              <CvMaker />
            </PageShell>
          }
        />

        {/* ── Video ────────────────────────────────────────────────────── */}
        <Route path="video" element={<VideoCategory />} />
        <Route
          path="video/potong"
          element={
            <PageShell badge="Video" title="Potong Video" subtitle="Trim satu bagian atau buang beberapa bagian sekaligus, langsung di browser.">
              <VideoTrim />
            </PageShell>
          }
        />
        <Route
          path="video/crop"
          element={
            <PageShell badge="Video" title="Crop & Resize Video" subtitle="Pas-kan video ke rasio 1:1, 9:16, 16:9, dan lainnya untuk media sosial.">
              <VideoCrop />
            </PageShell>
          }
        />
        <Route
          path="video/subtitle"
          element={
            <PageShell badge="Video" title="Teks & Subtitle (CC)" subtitle="Tambah teks bertempo — ekspor sebagai .SRT/.VTT ringan atau bakar langsung ke video.">
              <VideoSubtitle />
            </PageShell>
          }
        />
        <Route
          path="video/gabung"
          element={
            <PageShell badge="Video" title="Gabung & Transisi" subtitle="Satukan beberapa klip berurutan dengan transisi cut atau crossfade.">
              <VideoMerge />
            </PageShell>
          }
        />
        <Route
          path="video/filter"
          element={
            <PageShell badge="Video" title="Kecepatan & Filter" subtitle="Atur kecepatan putar dan filter warna — preview langsung sesuai hasil ekspor.">
              <VideoFilter />
            </PageShell>
          }
        />
        <Route
          path="video/thumbnail"
          element={
            <PageShell badge="Video" title="Tangkap Thumbnail / Screenshot" subtitle="Putar video ke posisi yang diinginkan, lalu tangkap satu frame sebagai gambar PNG.">
              <VideoThumbnail />
            </PageShell>
          }
        />
        <Route path="video/audio-thumbnail" element={<Navigate to="/video/thumbnail" replace />} />

        {/* ── Audio ────────────────────────────────────────────────────── */}
        <Route path="audio" element={<AudioCategory />} />
        <Route
          path="audio/suara-ke-teks"
          element={
            <PageShell badge="Audio" title="Speech to Text" subtitle="Ubah ucapan jadi teks secara langsung lewat mikrofon.">
              <AudioSpeechToText />
            </PageShell>
          }
        />
        <Route
          path="audio/teks-ke-suara"
          element={
            <PageShell badge="Audio" title="Text to Speech" subtitle="Bacakan teks apa pun dengan suara pilihan langsung dari browser.">
              <AudioTextToSpeech />
            </PageShell>
          }
        />
        <Route
          path="audio/pengukur-suara"
          element={
            <PageShell badge="Audio" title="Pengukur Kekuatan Suara" subtitle="Meteran level suara real-time langsung dari mikrofon browser.">
              <AudioSoundMeter />
            </PageShell>
          }
        />
        <Route
          path="audio/ekstrak-audio-video"
          element={
            <PageShell badge="Audio" title="Ekstrak Audio dari Video" subtitle="Ambil track audio dari file video sebagai file terpisah — bisa dipangkas dulu sebelum diekstrak.">
              <AudioExtractFromVideo />
            </PageShell>
          }
        />

        <Route path="about" element={<About />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />

        {/* Fallback — arahkan path tak dikenal ke beranda */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
