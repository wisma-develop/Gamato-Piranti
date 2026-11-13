import { lazy, Suspense, type FC } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "@/components/layout/Layout";
import { PageShell } from "@/components/PageShell";
import ScrollToTop from "@/components/ScrollToTop";
import SeoSync from "@/components/SeoSync";
import { ToolSearchProvider } from "@/components/search/ToolSearch";

import Home from "@/pages/Home";
const About = lazy(() => import("@/pages/About"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));

const KodeCategory = lazy(() => import("@/pages/categories/KodeCategory"));
const DokumenCategory = lazy(() => import("@/pages/categories/DokumenCategory"));
const OfficeCategory = lazy(() => import("@/pages/categories/OfficeCategory"));
const GambarCategory = lazy(() => import("@/pages/categories/GambarCategory"));
const UtilitasCategory = lazy(() => import("@/pages/categories/UtilitasCategory"));
const SpesialCategory = lazy(() => import("@/pages/categories/SpesialCategory"));
const VideoCategory = lazy(() => import("@/pages/categories/VideoCategory"));
const AudioCategory = lazy(() => import("@/pages/categories/AudioCategory"));

const QrCodeGenerator = lazy(() => import("@/features/qr-barcode/QrCodeGenerator").then((m) => ({ default: m.QrCodeGenerator })));
const BarcodeGenerator = lazy(() => import("@/features/qr-barcode/BarcodeGenerator").then((m) => ({ default: m.BarcodeGenerator })));
const HidScanner = lazy(() => import("@/features/qr-barcode/HidScanner").then((m) => ({ default: m.HidScanner })));
const MorseCode = lazy(() => import("@/features/qr-barcode/MorseCode").then((m) => ({ default: m.MorseCode })));
const QrScanner = lazy(() => import("@/features/qr-barcode/QrScanner").then((m) => ({ default: m.QrScanner })));

const PdfMerge = lazy(() => import("@/features/pdf/PdfMerge").then((m) => ({ default: m.PdfMerge })));
const PdfSplit = lazy(() => import("@/features/pdf/PdfSplit").then((m) => ({ default: m.PdfSplit })));
const PdfCompress = lazy(() => import("@/features/pdf/PdfCompress").then((m) => ({ default: m.PdfCompress })));
const DocCompress = lazy(() => import("@/features/pdf/DocCompress").then((m) => ({ default: m.DocCompress })));
const PdfExtract = lazy(() => import("@/features/pdf/PdfExtract").then((m) => ({ default: m.PdfExtract })));
const PdfDeletePages = lazy(() => import("@/features/pdf/PdfDeletePages").then((m) => ({ default: m.PdfDeletePages })));
const PdfRotate = lazy(() => import("@/features/pdf/PdfRotate").then((m) => ({ default: m.PdfRotate })));
const PdfOrganize = lazy(() => import("@/features/pdf/PdfOrganize").then((m) => ({ default: m.PdfOrganize })));
const PdfImagesToPdf = lazy(() => import("@/features/pdf/PdfImagesToPdf").then((m) => ({ default: m.PdfImagesToPdf })));
const PdfTextToPdf = lazy(() => import("@/features/pdf/PdfTextToPdf").then((m) => ({ default: m.PdfTextToPdf })));
const PdfWordToPdf = lazy(() => import("@/features/pdf/PdfWordToPdf").then((m) => ({ default: m.PdfWordToPdf })));
const PdfExcelToPdf = lazy(() => import("@/features/pdf/PdfExcelToPdf").then((m) => ({ default: m.PdfExcelToPdf })));
const PdfPptToPdf = lazy(() => import("@/features/pdf/PdfPptToPdf").then((m) => ({ default: m.PdfPptToPdf })));
const PdfEdit = lazy(() => import("@/features/pdf/PdfEdit").then((m) => ({ default: m.PdfEdit })));
const PdfSign = lazy(() => import("@/features/pdf/PdfSign").then((m) => ({ default: m.PdfSign })));
const PdfWatermark = lazy(() => import("@/features/pdf/PdfWatermark").then((m) => ({ default: m.PdfWatermark })));
const PdfHtmlToPdf = lazy(() => import("@/features/pdf/PdfHtmlToPdf").then((m) => ({ default: m.PdfHtmlToPdf })));
const PdfPageNumbers = lazy(() => import("@/features/pdf/PdfPageNumbers").then((m) => ({ default: m.PdfPageNumbers })));
const PdfUnlock = lazy(() => import("@/features/pdf/PdfUnlock").then((m) => ({ default: m.PdfUnlock })));
const PdfReader = lazy(() => import("@/features/pdf/PdfReader").then((m) => ({ default: m.PdfReader })));
const PdfRedact = lazy(() => import("@/features/pdf/PdfRedact").then((m) => ({ default: m.PdfRedact })));
const PdfScan = lazy(() => import("@/features/pdf/PdfScan").then((m) => ({ default: m.PdfScan })));
const PdfToImage = lazy(() => import("@/features/pdf/PdfToImage").then((m) => ({ default: m.PdfToImage })));
const PdfToWord = lazy(() => import("@/features/pdf/PdfToWord").then((m) => ({ default: m.PdfToWord })));
const PdfToExcel = lazy(() => import("@/features/pdf/PdfToExcel").then((m) => ({ default: m.PdfToExcel })));
const PdfOcr = lazy(() => import("@/features/pdf/PdfOcr").then((m) => ({ default: m.PdfOcr })));
const PdfProtect = lazy(() => import("@/features/pdf/PdfProtect").then((m) => ({ default: m.PdfProtect })));
const DocReader = lazy(() => import("@/features/docs/DocReader").then((m) => ({ default: m.DocReader })));

const DocTools = lazy(() => import("@/features/docs/DocTools").then((m) => ({ default: m.DocTools })));
const SheetStudio = lazy(() => import("@/features/office/SheetStudio").then((m) => ({ default: m.SheetStudio })));
const SlideStudio = lazy(() => import("@/features/office/SlideStudio").then((m) => ({ default: m.SlideStudio })));

const ImageCompress = lazy(() => import("@/features/image/ImageCompress").then((m) => ({ default: m.ImageCompress })));
const ImageResize = lazy(() => import("@/features/image/ImageResize").then((m) => ({ default: m.ImageResize })));
const ImageConvert = lazy(() => import("@/features/image/ImageConvert").then((m) => ({ default: m.ImageConvert })));
const ImageRotate = lazy(() => import("@/features/image/ImageRotate").then((m) => ({ default: m.ImageRotate })));
const ImageMetadataRemover = lazy(() => import("@/features/image/ImageMetadataRemover").then((m) => ({ default: m.ImageMetadataRemover })));
const ImageRawPreview = lazy(() => import("@/features/image/ImageRawPreview").then((m) => ({ default: m.ImageRawPreview })));
const ImageCrop = lazy(() => import("@/features/image/ImageCrop").then((m) => ({ default: m.ImageCrop })));
const ImageRemoveBg = lazy(() => import("@/features/image/ImageRemoveBg").then((m) => ({ default: m.ImageRemoveBg })));
const ImageWatermark = lazy(() => import("@/features/image/ImageWatermark").then((m) => ({ default: m.ImageWatermark })));
const HtmlToImage = lazy(() => import("@/features/image/HtmlToImage").then((m) => ({ default: m.HtmlToImage })));
const MemeGenerator = lazy(() => import("@/features/image/MemeGenerator").then((m) => ({ default: m.MemeGenerator })));
const ColorPicker = lazy(() => import("@/features/image/ColorPicker").then((m) => ({ default: m.ColorPicker })));
const PhotoEditor = lazy(() => import("@/features/image/PhotoEditor").then((m) => ({ default: m.PhotoEditor })));
const DocToImage = lazy(() => import("@/features/image/DocToImage").then((m) => ({ default: m.DocToImage })));
const PhotoPrintLayout = lazy(() => import("@/features/image/PhotoPrintLayout").then((m) => ({ default: m.PhotoPrintLayout })));
const CollageMaker = lazy(() => import("@/features/image/CollageMaker").then((m) => ({ default: m.CollageMaker })));

const UtilityJsonBase64 = lazy(() => import("@/features/utility/UtilityJsonBase64").then((m) => ({ default: m.UtilityJsonBase64 })));
const PrintCenter = lazy(() => import("@/features/utility/PrintCenter").then((m) => ({ default: m.PrintCenter })));
const UtilityBulkText = lazy(() => import("@/features/utility/UtilityBulkText").then((m) => ({ default: m.UtilityBulkText })));
const UtilityMediaLink = lazy(() => import("@/features/utility/UtilityMediaLink").then((m) => ({ default: m.UtilityMediaLink })));
const UtilityAliasEmail = lazy(() => import("@/features/utility/UtilityAliasEmail").then((m) => ({ default: m.UtilityAliasEmail })));
const UtilityTaxCalculator = lazy(() => import("@/features/utility/UtilityTaxCalculator").then((m) => ({ default: m.UtilityTaxCalculator })));
const UtilityInterestCalculator = lazy(() => import("@/features/utility/UtilityInterestCalculator").then((m) => ({ default: m.UtilityInterestCalculator })));
const UtilityStatistics = lazy(() => import("@/features/utility/UtilityStatistics").then((m) => ({ default: m.UtilityStatistics })));
const UtilityPasswordToken = lazy(() => import("@/features/utility/UtilityPasswordToken").then((m) => ({ default: m.UtilityPasswordToken })));
const UtilityWorldDictionary = lazy(() => import("@/features/utility/UtilityWorldDictionary").then((m) => ({ default: m.UtilityWorldDictionary })));
const UtilityHtmlPreview = lazy(() => import("@/features/utility/UtilityHtmlPreview").then((m) => ({ default: m.UtilityHtmlPreview })));
const UtilityDiagramFormula = lazy(() => import("@/features/utility/UtilityDiagramFormula").then((m) => ({ default: m.UtilityDiagramFormula })));
const UniversalConverter = lazy(() => import("@/features/utility/convert/UniversalConverter").then((m) => ({ default: m.UniversalConverter })));
const CalculatorHub = lazy(() => import("@/features/utility/calculator/CalculatorHub").then((m) => ({ default: m.CalculatorHub })));

const AudioSpeechToText = lazy(() => import("@/features/audio/AudioSpeechToText").then((m) => ({ default: m.AudioSpeechToText })));
const AudioTextToSpeech = lazy(() => import("@/features/audio/AudioTextToSpeech").then((m) => ({ default: m.AudioTextToSpeech })));
const AudioSoundMeter = lazy(() => import("@/features/audio/AudioSoundMeter").then((m) => ({ default: m.AudioSoundMeter })));
const AudioExtractFromVideo = lazy(() => import("@/features/audio/AudioExtractFromVideo").then((m) => ({ default: m.AudioExtractFromVideo })));
const AudioConvertHub = lazy(() => import("@/features/audio/AudioConvertHub").then((m) => ({ default: m.AudioConvertHub })));
const AudioEditor = lazy(() => import("@/features/audio/AudioEditor").then((m) => ({ default: m.AudioEditor })));
const AudioTranscript = lazy(() => import("@/features/audio/AudioTranscript").then((m) => ({ default: m.AudioTranscript })));
const AudioCompress = lazy(() => import("@/features/audio/AudioCompress").then((m) => ({ default: m.AudioCompress })));
const AudioVisualizer = lazy(() => import("@/features/audio/AudioVisualizer").then((m) => ({ default: m.AudioVisualizer })));
const CaptureWebsite = lazy(() => import("@/features/utility/CaptureWebsite").then((m) => ({ default: m.CaptureWebsite })));
const CoordinateTool = lazy(() => import("@/features/utility/CoordinateTool").then((m) => ({ default: m.CoordinateTool })));

const CertificateGenerator = lazy(() => import("@/features/special/CertificateGenerator").then((m) => ({ default: m.CertificateGenerator })));
const WaLink = lazy(() => import("@/features/special/WaLink").then((m) => ({ default: m.WaLink })));
const KwitansiGenerator = lazy(() => import("@/features/special/KwitansiGenerator").then((m) => ({ default: m.KwitansiGenerator })));
const InvoiceGenerator = lazy(() => import("@/features/special/InvoiceGenerator").then((m) => ({ default: m.InvoiceGenerator })));
const StrukGenerator = lazy(() => import("@/features/special/StrukGenerator").then((m) => ({ default: m.StrukGenerator })));
const BusinessCardGenerator = lazy(() => import("@/features/special/BusinessCardGenerator").then((m) => ({ default: m.BusinessCardGenerator })));
const NametagGenerator = lazy(() => import("@/features/special/NametagGenerator").then((m) => ({ default: m.NametagGenerator })));
const CvMaker = lazy(() => import("@/features/special/CvMaker").then((m) => ({ default: m.CvMaker })));
const CouponGenerator = lazy(() => import("@/features/special/CouponGenerator").then((m) => ({ default: m.CouponGenerator })));
const LetterGenerator = lazy(() => import("@/features/special/LetterGenerator").then((m) => ({ default: m.LetterGenerator })));
const VideoTrim = lazy(() => import("@/features/video/VideoTrim").then((m) => ({ default: m.VideoTrim })));
const VideoCrop = lazy(() => import("@/features/video/VideoCrop").then((m) => ({ default: m.VideoCrop })));
const VideoSubtitle = lazy(() => import("@/features/video/VideoSubtitle").then((m) => ({ default: m.VideoSubtitle })));
const VideoMerge = lazy(() => import("@/features/video/VideoMerge").then((m) => ({ default: m.VideoMerge })));
const VideoFilter = lazy(() => import("@/features/video/VideoFilter").then((m) => ({ default: m.VideoFilter })));
const VideoThumbnail = lazy(() => import("@/features/video/VideoThumbnail").then((m) => ({ default: m.VideoThumbnail })));
const VideoCompress = lazy(() => import("@/features/video/VideoCompress").then((m) => ({ default: m.VideoCompress })));
const VideoConvertHub = lazy(() => import("@/features/video/VideoConvertHub").then((m) => ({ default: m.VideoConvertHub })));

export const App: FC = () => (
  <BrowserRouter>
    <ScrollToTop />
    <SeoSync />
    <ToolSearchProvider>
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
            <PageShell badge="Kode" title="QR & Barcode Scanner" subtitle="Baca QR code dan barcode dari gambar yang diunggah atau langsung dari kamera.">
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
          path="pdf/kompres-dokumen"
          element={
            <PageShell badge="Dokumen" title="Kompres Dokumen" subtitle="Satu tempat untuk memperkecil PDF, Word, Excel, PowerPoint, ODT, EPUB, ZIP, gambar, dan berkas teks — banyak berkas sekaligus, langsung di browser.">
              <DocCompress />
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
          path="image/dokumen-ke-gambar"
          element={
            <PageShell badge="Gambar" title="Dokumen ke Gambar" subtitle="Ubah PDF, Word, PowerPoint, Excel/CSV, dan teks/Markdown menjadi gambar PNG/JPG/WebP — per halaman atau satu gambar panjang.">
              <DocToImage kind="auto" />
            </PageShell>
          }
        />
        <Route
          path="image/pdf-ke-gambar"
          element={
            <PageShell badge="Gambar" title="PDF ke Gambar" subtitle="Render setiap halaman PDF menjadi gambar PNG/JPG/WebP hingga 400 dpi, pilih halaman, atau gabung jadi satu gambar panjang.">
              <DocToImage kind="pdf" />
            </PageShell>
          }
        />
        <Route
          path="image/word-ke-gambar"
          element={
            <PageShell badge="Gambar" title="Word ke Gambar" subtitle="Ubah dokumen Word (.docx) menjadi gambar per halaman — judul, daftar, tabel, dan gambar ikut dirender.">
              <DocToImage kind="word" />
            </PageShell>
          }
        />
        <Route
          path="image/ppt-ke-gambar"
          element={
            <PageShell badge="Gambar" title="PowerPoint ke Gambar" subtitle="Ubah setiap slide PowerPoint (.pptx) menjadi gambar lengkap dengan latar, tema warna, bentuk, teks, dan gambar.">
              <DocToImage kind="ppt" />
            </PageShell>
          }
        />
        <Route
          path="image/excel-ke-gambar"
          element={
            <PageShell badge="Gambar" title="Excel & CSV ke Gambar" subtitle="Render lembar Excel (.xlsx) atau CSV menjadi gambar — warna sel, garis, sel gabungan, dan format angka dipertahankan.">
              <DocToImage kind="excel" />
            </PageShell>
          }
        />
        <Route
          path="image/teks-ke-gambar"
          element={
            <PageShell badge="Gambar" title="Teks & Markdown ke Gambar" subtitle="Ubah .txt, .md, .json, .rtf, kode, dan log menjadi gambar rapi dengan font Unicode penuh.">
              <DocToImage kind="teks" />
            </PageShell>
          }
        />
        <Route
          path="image/hapus-metadata"
          element={
            <PageShell badge="Gambar" title="Hapus Metadata" width="narrow" subtitle="Hapus EXIF, GPS, dan data sensitif lainnya dari gambar via re-encode canvas.">
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
          path="image/kolase"
          element={
            <PageShell badge="Gambar" title="Kolase Gambar" subtitle="Susun banyak foto jadi satu kolase — 46 template atau mode bebas ala scrapbook, bentuk sel, bingkai, bayangan, latar, teks & stiker. Semua diproses di perangkatmu.">
              <CollageMaker />
            </PageShell>
          }
        />
<Route
          path="image/cetak-foto"
          element={
            <PageShell badge="Gambar" title="Cetak Foto" subtitle="Susun pas foto atau foto cetak (2x3, 3x4, 4x6, 4R, dll) dalam satu atau beberapa lembar siap cetak — unduh PDF atau cetak langsung.">
              <PhotoPrintLayout />
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
          path="utility/koordinat"
          element={
            <PageShell badge="Utilitas" title="Koordinat" subtitle="Cari tempat, pilih titik di peta dunia, lihat pratinjau, dan dapatkan koordinat dalam semua format (DD, DMS, UTM, MGRS, Plus Code, Geohash…). Ukur jarak, kelola daftar titik, generate titik, impor/ekspor CSV/GeoJSON/KML/GPX.">
              <Suspense fallback={<div className="py-16 text-center text-sm text-slate-400">Memuat peta…</div>}>
                <CoordinateTool />
              </Suspense>
            </PageShell>
          }
        />
        <Route
          path="utility/capture-website"
          element={
            <PageShell badge="Utilitas" title="Capture Website" subtitle="Screenshot panjang website secara real-time: bagikan tab, beri anotasi langsung di pratinjau (pena, panah, bentuk, teks, sensor, gambar), tumpuk hasilnya, lalu unduh sebagai gambar/ZIP atau PDF yang rapi.">
              <CaptureWebsite />
            </PageShell>
          }
        />
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
          path="utility/cetak"
          element={
            <PageShell badge="Utilitas" title="Cetak File & Dokumen" subtitle="Cetak PDF, gambar, dokumen Office, dan teks dengan pratinjau langsung dan pengaturan lengkap seperti dialog cetak browser: kertas, orientasi, margin, skala, halaman per lembar, salinan, warna, buklet, header/footer, watermark.">
              <PrintCenter />
            </PageShell>
          }
        />
        <Route
          path="utility/link-media"
          element={
            <PageShell badge="Utilitas" title="Link Media" width="narrow" subtitle="Analisis link video/file untuk unduhan langsung.">
              <UtilityMediaLink />
            </PageShell>
          }
        />
        <Route
          path="utility/alias-email"
          element={
            <PageShell badge="Utilitas" title="Alias Email" width="narrow" subtitle="Buat alamat email alternatif untuk pendaftaran.">
              <UtilityAliasEmail />
            </PageShell>
          }
        />
        <Route
          path="utility/kalkulator-pajak"
          element={
            <PageShell badge="Utilitas" title="Kalkulator Pajak" width="narrow" subtitle="Hitung PPN eksklusif maupun inklusif.">
              <UtilityTaxCalculator />
            </PageShell>
          }
        />
        <Route
          path="utility/kalkulator-bunga"
          element={
            <PageShell badge="Utilitas" title="Kalkulator Bunga" width="narrow" subtitle="Hitung bunga sederhana & majemuk.">
              <UtilityInterestCalculator />
            </PageShell>
          }
        />
        <Route
          path="utility/statistik"
          element={
            <PageShell badge="Utilitas" title="Statistik" width="narrow" subtitle="Mean, median, min, max, dan standar deviasi dari sekumpulan angka.">
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
          path="office/diagram-rumus"
          element={
            <PageShell badge="Office" title="Diagram & Rumus Studio" subtitle="Buat & preview flowchart, struktur organisasi, chart, hingga rumus matematika (LaTeX).">
              <UtilityDiagramFormula />
            </PageShell>
          }
        />
        <Route path="utility/diagram-rumus" element={<Navigate to="/office/diagram-rumus" replace />} />
        <Route
          path="utility/convert"
          element={
            <PageShell badge="Utilitas" title="Universal Converter" subtitle="Ubah file/data ke format lain — gambar, dokumen, spreadsheet, data terstruktur, audio, video, dan ZIP.">
              <UniversalConverter />
            </PageShell>
          }
        />
        <Route path="utility/pengukur-suara" element={<Navigate to="/audio/pengukur-suara" replace />} />
        <Route
          path="utility/kalkulator"
          element={
            <PageShell badge="Utilitas" title="Kalkulator" width="medium" subtitle="Satu tempat untuk semua kalkulator: standar, pajak, bunga, investasi, cicilan, rumus, hingga HPP/COGS.">
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
          path="special/name-tag"
          element={
            <PageShell badge="Spesial" title="Name Tag Studio" subtitle="Generator name tag, badge acara & ID card full custom: template siap pakai, warna otomatis per peran, foto, QR/barcode, lubang tali, meja nama lipat — satu per satu atau massal dari tabel/CSV/XLSX.">
              <NametagGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/kartu-nama"
          element={
            <PageShell badge="Spesial" title="Studio Kartu Nama" subtitle="Desain kartu nama full custom: template siap pakai, latar warna/gradasi/gambar, elemen bebas, ukuran & sisi depan-belakang — export PNG & PDF, siap cetak.">
              <BusinessCardGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/kupon"
          element={
            <PageShell badge="Spesial" title="Kupon, Voucher & Tiket" subtitle="Generator kupon diskon, voucher, tiket event, tiket masuk, gift card, dan kupon undian — 12 template, kode unik otomatis, QR & barcode, massal hingga 1.000 lembar.">
              <CouponGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/surat"
          element={
            <PageShell badge="Spesial" title="Pembuat Surat" subtitle="Generator surat resmi, bisnis, lamaran, kuasa, pernyataan, perjanjian, dan lainnya — 17 template, kop surat kustom, nomor otomatis, tanda tangan & materai, surat massal, ekspor PDF/Word.">
              <LetterGenerator />
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
            <PageShell badge="Spesial" title="Pembuat CV" subtitle="Buat CV/resume profesional dengan 8 template, susunan & judul bagian yang bisa diatur, foto, auto-muat 1 halaman — ekspor PDF (teks bisa dipilih/ATS), DOCX, dan PNG tajam.">
              <CvMaker />
            </PageShell>
          }
        />

        {/* ── Video ────────────────────────────────────────────────────── */}
        <Route path="video" element={<VideoCategory />} />
        <Route
          path="video/konversi"
          element={
            <PageShell badge="Video" title="Konversi Video" subtitle="Satu alat, banyak tujuan: ganti format video, jadikan GIF, atau ambil audionya saja — pilih tab sesuai kebutuhan.">
              <VideoConvertHub />
            </PageShell>
          }
        />
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
          path="video/kompres"
          element={
            <PageShell badge="Video" title="Kompres Video" width="medium" subtitle="Perkecil ukuran video — pilih preset, atur resolusi, fps & bitrate, atau tentukan target ukuran file. Uji 5 detik dulu sebelum memproses seluruh video.">
              <VideoCompress />
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
          path="audio/konversi"
          element={
            <PageShell badge="Audio" title="Konversi Audio" subtitle="Ubah audio ke WAV (kualitas penuh) atau format terkompresi (Opus) — semua diproses langsung di browser.">
              <AudioConvertHub />
            </PageShell>
          }
        />
        <Route
          path="audio/edit-audio"
          element={
            <PageShell badge="Audio" title="Edit Audio" width="medium" subtitle="Editor waveform lengkap: pangkas, potong, tempel, fade, volume, tempo & pitch, equalizer, kompresor, reverb, noise gate, marker, hingga ekspor WAV/Opus — semua di browser.">
              <AudioEditor />
            </PageShell>
          }
        />
        <Route
          path="audio/transkrip-audio"
          element={
            <PageShell badge="Audio" title="Transkrip Audio" subtitle="Ubah rekaman rapat, wawancara, kuliah, atau podcast menjadi transkrip berformat — stempel waktu, pembicara, paragraf, kata kunci & ringkasan — lalu ekspor ke DOCX, PDF, SRT, dan lainnya.">
              <AudioTranscript />
            </PageShell>
          }
        />
        <Route
          path="audio/kompres"
          element={
            <PageShell badge="Audio" title="Kompres Audio" subtitle="Perkecil ukuran audio dengan Opus (jauh lebih kecil dari MP3) — pilih preset, atur bitrate sendiri, atau tentukan target ukuran file. Bisa banyak file sekaligus, semua di browser.">
              <AudioCompress />
            </PageShell>
          }
        />
        <Route
          path="audio/visualizer"
          element={
            <PageShell badge="Audio" title="Audio Visualizer" subtitle="Ubah lagu jadi visual bergerak: 13 gaya, kustomisasi penuh (warna, glow, pantulan, logo, teks, latar), pratinjau real-time, lalu ekspor .mov dengan latar transparan otomatis — atau beri latar sendiri.">
              <AudioVisualizer />
            </PageShell>
          }
        />
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
    </ToolSearchProvider>
  </BrowserRouter>
);
