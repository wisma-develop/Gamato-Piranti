import { lazy, Suspense, type FC } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "@/components/layout/Layout";
import { PageShell } from "@/components/PageShell";
import ScrollToTop from "@/components/ScrollToTop";
import SeoSync from "@/components/SeoSync";
import { ToolSearchProvider } from "@/components/search/ToolSearch";

import Home from "@/pages/Home";
import { tr } from "@/i18n";
const About = lazy(() => import("@/pages/About"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const Faq = lazy(() => import("@/pages/Faq"));

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
            <PageShell badge={tr("Kode")} title={tr("QR Code")} subtitle={tr("QR code full custom — bentuk titik & sudut, warna, hingga logo bebas diatur, dengan preview real-time.")}>
              <QrCodeGenerator />
            </PageShell>
          }
        />
        <Route
          path="qr/barcode"
          element={
            <PageShell badge={tr("Kode")} title={tr("Barcode")} subtitle={tr("21 format barcode (CODE128, EAN-13, UPC, ITF-14, CODE39, dll) dengan preview real-time, digit cek otomatis, ekspor PNG/SVG, dan cetak massal PDF/ZIP.")}>
              <BarcodeGenerator />
            </PageShell>
          }
        />
        <Route
          path="qr/scan-hid"
          element={
            <PageShell badge={tr("Kode")} title={tr("Scan HID")} subtitle={tr("Terima input dari scanner barcode/QR bertipe HID (USB/Bluetooth) yang bekerja seperti keyboard.")}>
              <HidScanner />
            </PageShell>
          }
        />
        <Route
          path="qr/kode-morse"
          element={
            <PageShell badge={tr("Kode")} title={tr("Kode Morse")} subtitle={tr("Konversi teks ke kode Morse (dan sebaliknya), lengkap dengan audio beep yang bisa diunduh.")}>
              <MorseCode />
            </PageShell>
          }
        />
        <Route
          path="qr/scan-qr"
          element={
            <PageShell badge={tr("Kode")} title={tr("QR & Barcode Scanner")} subtitle={tr("Baca QR code dan barcode dari gambar (banyak sekaligus) atau kamera; hasil dikenali otomatis dan dilengkapi aksi cepat.")}>
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
            <PageShell badge={tr("Dokumen")} title={tr("Gabung PDF")} subtitle={tr("Gabungkan beberapa file PDF menjadi satu file, urutan mengikuti daftar file yang kamu unggah.")}>
              <PdfMerge />
            </PageShell>
          }
        />
        <Route
          path="pdf/pecah"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Pecah PDF")} subtitle={tr("Setiap halaman PDF diunduh sebagai file terpisah, satu per satu.")}>
              <PdfSplit />
            </PageShell>
          }
        />
        <Route
          path="pdf/kompres"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Kompres PDF")} subtitle={tr("Kurangi ukuran file PDF tanpa mengubah isi — pilih tingkat kompresi ringan, sedang, atau tinggi.")}>
              <PdfCompress />
            </PageShell>
          }
        />
        <Route
          path="pdf/kompres-dokumen"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Kompres Dokumen")} subtitle={tr("Satu tempat untuk memperkecil PDF, Word, Excel, PowerPoint, ODT, EPUB, ZIP, gambar, dan berkas teks — banyak berkas sekaligus, langsung di browser.")}>
              <DocCompress />
            </PageShell>
          }
        />
        <Route
          path="pdf/ekstrak"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Ekstrak Halaman")} subtitle={tr("Ambil hanya halaman tertentu dari PDF, misalnya 1-3,5,8-9.")}>
              <PdfExtract />
            </PageShell>
          }
        />
        <Route
          path="pdf/hapus-halaman"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Hapus Halaman")} subtitle={tr("Buang halaman yang tidak dibutuhkan, sisanya tetap utuh.")}>
              <PdfDeletePages />
            </PageShell>
          }
        />
        <Route
          path="pdf/putar"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Putar Halaman")} subtitle={tr("Rotasi halaman PDF yang miring atau terbalik — bisa semua halaman atau halaman tertentu.")}>
              <PdfRotate />
            </PageShell>
          }
        />
        <Route
          path="pdf/atur-ulang"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Atur Ulang Halaman")} subtitle={tr("Susun ulang urutan halaman PDF sesuai kebutuhanmu.")}>
              <PdfOrganize />
            </PageShell>
          }
        />
        <Route
          path="pdf/gambar-ke-pdf"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Gambar ke PDF")} subtitle={tr("Ubah kumpulan gambar JPG/PNG menjadi satu file PDF, tiap gambar jadi satu halaman.")}>
              <PdfImagesToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/teks-ke-pdf"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Teks ke PDF")} subtitle={tr("Konversi teks polos menjadi dokumen PDF yang rapi dan bisa dibuka di mana saja.")}>
              <PdfTextToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/word-ke-pdf"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Word ke PDF")} subtitle={tr("Konversi file .docx menjadi PDF, lengkap dengan format bold/italic/underline dan perataan paragraf.")}>
              <PdfWordToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/excel-ke-pdf"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Excel ke PDF")} subtitle={tr("Konversi sheet pertama file .xlsx menjadi tabel PDF yang rapi.")}>
              <PdfExcelToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/ppt-ke-pdf"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("PowerPoint ke PDF")} subtitle={tr("Konversi file .pptx menjadi PDF, satu slide jadi satu halaman.")}>
              <PdfPptToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/edit"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Edit PDF")} subtitle={tr("Tambahkan teks bebas atau kotak penanda ke halaman PDF mana pun.")}>
              <PdfEdit />
            </PageShell>
          }
        />
        <Route
          path="pdf/tanda-tangan"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Tanda Tangan PDF")} subtitle={tr("Gambar atau ketik tanda tangan, lalu tempelkan ke halaman PDF.")}>
              <PdfSign />
            </PageShell>
          }
        />
        <Route
          path="pdf/watermark"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Watermark PDF")} subtitle={tr("Tambahkan watermark teks ke semua halaman PDF sekaligus.")}>
              <PdfWatermark />
            </PageShell>
          }
        />
        <Route
          path="pdf/html-ke-pdf"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("HTML ke PDF")} subtitle={tr("Render kode HTML/CSS menjadi dokumen PDF — cocok untuk invoice atau surat custom.")}>
              <PdfHtmlToPdf />
            </PageShell>
          }
        />
        <Route
          path="pdf/nomor-halaman"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Nomor Halaman")} subtitle={tr("Tambahkan nomor halaman dengan format dan posisi bebas ke seluruh PDF.")}>
              <PdfPageNumbers />
            </PageShell>
          }
        />
        <Route
          path="pdf/unlock"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Unlock PDF")} subtitle={tr("Hapus batasan cetak/salin/edit dari PDF yang tidak memerlukan password pembuka.")}>
              <PdfUnlock />
            </PageShell>
          }
        />
        <Route
          path="pdf/reader"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("PDF Reader")} subtitle={tr("Baca PDF langsung di browser, lengkap dengan info dokumen.")}>
              <PdfReader />
            </PageShell>
          }
        />
        <Route
          path="pdf/sensor"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Sensor / Redaksi PDF")} subtitle={tr("Hitamkan informasi sensitif secara permanen — halaman disensor diubah jadi gambar agar teks di baliknya tak bisa diambil lagi.")}>
              <PdfRedact />
            </PageShell>
          }
        />
        <Route
          path="pdf/scan"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Scan PDF")} subtitle={tr("Ubah foto dokumen menjadi PDF hasil scan yang rapi.")}>
              <PdfScan />
            </PageShell>
          }
        />
        <Route
          path="pdf/ke-gambar"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("PDF ke Gambar")} subtitle={tr("Render setiap halaman PDF menjadi gambar PNG/JPEG kualitas tinggi.")}>
              <PdfToImage />
            </PageShell>
          }
        />
        <Route
          path="pdf/ke-word"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("PDF ke Word")} subtitle={tr("Ekstrak teks asli dari PDF menjadi dokumen .docx yang bisa diedit.")}>
              <PdfToWord />
            </PageShell>
          }
        />
        <Route
          path="pdf/ke-excel"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("PDF ke Excel")} subtitle={tr("Deteksi baris & kolom dari PDF, ekspor sebagai .xlsx.")}>
              <PdfToExcel />
            </PageShell>
          }
        />
        <Route
          path="pdf/ocr"
          element={
            <PageShell badge={tr("Dokumen")} title="OCR" subtitle={tr("Baca teks dari PDF hasil scan atau foto dokumen — hasilnya bisa disalin atau diunduh.")}>
              <PdfOcr />
            </PageShell>
          }
        />
        <Route
          path="pdf/protect"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Protect PDF")} subtitle={tr("Kunci konten PDF dari salin/edit dengan mengubahnya menjadi gambar flat.")}>
              <PdfProtect />
            </PageShell>
          }
        />
        <Route path="pdf/suara-ke-teks" element={<Navigate to="/audio/suara-ke-teks" replace />} />
        <Route path="pdf/teks-ke-suara" element={<Navigate to="/audio/teks-ke-suara" replace />} />
        <Route
          path="pdf/baca-dokumen"
          element={
            <PageShell badge={tr("Dokumen")} title={tr("Doc Reader")} subtitle={tr("Baca file .txt, .docx, atau .rtf dengan tampilan nyaman — bisa juga didengarkan.")}>
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
              badge={tr("Office Tools")}
              title={tr("Doc Studio")}
              subtitle={tr("Editor dokumen ringan dengan ekspor .docx, .pdf, .txt — dilengkapi Find & Replace, template cepat, dan snapshot sesi.")}
            >
              <DocTools />
            </PageShell>
          }
        />
        <Route
          path="office/sheet-studio"
          element={
            <PageShell
              badge={tr("Office Tools")}
              title={tr("Sheet Studio")}
              subtitle={tr("Spreadsheet penuh — rumus, format sel, banyak sheet, dan ekspor .xlsx / .csv / .pdf, semua diproses di perangkatmu.")}
            >
              <SheetStudio />
            </PageShell>
          }
        />
        <Route
          path="office/slide-studio"
          element={
            <PageShell
              badge={tr("Office Tools")}
              title={tr("Slide Studio")}
              subtitle={tr("Editor presentasi — teks, bentuk, gambar, banyak slide, mode tampilkan layar penuh, dan ekspor .pdf / gambar.")}
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
            <PageShell badge={tr("Gambar")} title={tr("Kompres Gambar")} subtitle={tr("Kurangi ukuran file gambar tanpa mengubah dimensi — atur kualitas dengan slider.")}>
              <ImageCompress />
            </PageShell>
          }
        />
        <Route
          path="image/resize"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Ubah Ukuran")} subtitle={tr("Ubah dimensi gambar dengan rasio tetap terjaga — ideal untuk thumbnail dan upload.")}>
              <ImageResize />
            </PageShell>
          }
        />
        <Route
          path="image/konversi"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Konversi Format")} subtitle={tr("Konversi antar format JPEG, PNG, dan WEBP.")}>
              <ImageConvert />
            </PageShell>
          }
        />
        <Route
          path="image/putar"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Putar Gambar")} subtitle={tr("Putar foto yang miring atau terbalik, diterapkan ke semua file yang dipilih.")}>
              <ImageRotate />
            </PageShell>
          }
        />
        <Route
          path="image/dokumen-ke-gambar"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Dokumen ke Gambar")} subtitle={tr("Ubah PDF, Word, PowerPoint, Excel/CSV, dan teks/Markdown menjadi gambar PNG/JPG/WebP — per halaman atau satu gambar panjang.")}>
              <DocToImage kind="auto" />
            </PageShell>
          }
        />
        <Route
          path="image/pdf-ke-gambar"
          element={
            <PageShell badge={tr("Gambar")} title={tr("PDF ke Gambar")} subtitle={tr("Render setiap halaman PDF menjadi gambar PNG/JPG/WebP hingga 400 dpi, pilih halaman, atau gabung jadi satu gambar panjang.")}>
              <DocToImage kind="pdf" />
            </PageShell>
          }
        />
        <Route
          path="image/word-ke-gambar"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Word ke Gambar")} subtitle={tr("Ubah dokumen Word (.docx) menjadi gambar per halaman — judul, daftar, tabel, dan gambar ikut dirender.")}>
              <DocToImage kind="word" />
            </PageShell>
          }
        />
        <Route
          path="image/ppt-ke-gambar"
          element={
            <PageShell badge={tr("Gambar")} title={tr("PowerPoint ke Gambar")} subtitle={tr("Ubah setiap slide PowerPoint (.pptx) menjadi gambar lengkap dengan latar, tema warna, bentuk, teks, dan gambar.")}>
              <DocToImage kind="ppt" />
            </PageShell>
          }
        />
        <Route
          path="image/excel-ke-gambar"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Excel & CSV ke Gambar")} subtitle={tr("Render lembar Excel (.xlsx) atau CSV menjadi gambar — warna sel, garis, sel gabungan, dan format angka dipertahankan.")}>
              <DocToImage kind="excel" />
            </PageShell>
          }
        />
        <Route
          path="image/teks-ke-gambar"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Teks & Markdown ke Gambar")} subtitle={tr("Ubah .txt, .md, .json, .rtf, kode, dan log menjadi gambar rapi dengan font Unicode penuh.")}>
              <DocToImage kind="teks" />
            </PageShell>
          }
        />
        <Route
          path="image/hapus-metadata"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Hapus Metadata")} width="narrow" subtitle={tr("Hapus EXIF, GPS, dan data sensitif lainnya dari gambar via re-encode canvas.")}>
              <ImageMetadataRemover />
            </PageShell>
          }
        />
        <Route
          path="image/raw-preview"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Baca Foto RAW")} subtitle={tr("Ekstrak preview JPEG yang tersimpan di dalam file RAW kamera (CR2, NEF, ARW, DNG, dan lainnya).")}>
              <ImageRawPreview />
            </PageShell>
          }
        />
        <Route
          path="image/crop"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Crop Gambar")} subtitle={tr("Potong area gambar secara interaktif dengan preset rasio siap pakai.")}>
              <ImageCrop />
            </PageShell>
          }
        />
        <Route
          path="image/hapus-background"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Hapus Background")} subtitle={tr("Hapus warna latar solid (chroma-key) dan unduh sebagai PNG transparan.")}>
              <ImageRemoveBg />
            </PageShell>
          }
        />
        <Route
          path="image/watermark"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Watermark Gambar")} subtitle={tr("Tambahkan watermark teks atau logo, sekali tempel atau diulang ke seluruh gambar.")}>
              <ImageWatermark />
            </PageShell>
          }
        />
        <Route
          path="image/html-ke-gambar"
          element={
            <PageShell badge={tr("Gambar")} title={tr("HTML ke Gambar")} subtitle={tr("Render kode HTML/CSS menjadi gambar PNG — cocok untuk kartu kutipan, badge, atau banner.")}>
              <HtmlToImage />
            </PageShell>
          }
        />
        <Route
          path="image/meme-generator"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Meme Generator")} subtitle={tr("Tambahkan teks bergaya meme yang bisa digeser bebas di atas gambar.")}>
              <MemeGenerator />
            </PageShell>
          }
        />
        <Route
          path="image/photo-editor"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Photo Editor")} subtitle={tr("Sesuaikan kecerahan, kontras, saturasi, filter warna, putar, dan balik gambar.")}>
              <PhotoEditor />
            </PageShell>
          }
        />
                <Route
          path="image/kolase"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Kolase Gambar")} subtitle={tr("Susun banyak foto jadi satu kolase — 46 template atau mode bebas ala scrapbook, bentuk sel, bingkai, bayangan, latar, teks & stiker. Semua diproses di perangkatmu.")}>
              <CollageMaker />
            </PageShell>
          }
        />
<Route
          path="image/cetak-foto"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Cetak Foto")} subtitle={tr("Susun pas foto atau foto cetak (2x3, 3x4, 4x6, 4R, dll) dalam satu atau beberapa lembar siap cetak — unduh PDF atau cetak langsung.")}>
              <PhotoPrintLayout />
            </PageShell>
          }
        />
        <Route
          path="image/color-picker"
          element={
            <PageShell badge={tr("Gambar")} title={tr("Color Picker & Palette")} subtitle={tr("Ambil warna dari gambar (HEX/RGB/HSL) dan ekstrak palet warna dominan otomatis.")}>
              <ColorPicker />
            </PageShell>
          }
        />

        {/* ── Utilitas ─────────────────────────────────────────────────── */}
        <Route path="utility" element={<UtilitasCategory />} />
        <Route
          path="utility/koordinat"
          element={
            <PageShell badge="Utilitas" title={tr("Koordinat")} subtitle={tr("Cari tempat, pilih titik di peta dunia, lihat pratinjau, dan dapatkan koordinat dalam semua format (DD, DMS, UTM, MGRS, Plus Code, Geohash…). Ukur jarak, kelola daftar titik, generate titik, impor/ekspor CSV/GeoJSON/KML/GPX.")}>
              <Suspense fallback={<div className="py-16 text-center text-sm text-slate-400">{tr("Memuat peta…")}</div>}>
                <CoordinateTool />
              </Suspense>
            </PageShell>
          }
        />
        <Route
          path="utility/capture-website"
          element={
            <PageShell badge="Utilitas" title={tr("Capture Website")} subtitle={tr("Screenshot panjang website secara real-time: bagikan tab, beri anotasi langsung di pratinjau (pena, panah, bentuk, teks, sensor, gambar), tumpuk hasilnya, lalu unduh sebagai gambar/ZIP atau PDF yang rapi.")}>
              <CaptureWebsite />
            </PageShell>
          }
        />
        <Route
          path="utility/json-base64"
          element={
            <PageShell badge="Utilitas" title={tr("JSON & Base64")} subtitle={tr("Format JSON rapi, serta encode/decode Base64.")}>
              <UtilityJsonBase64 />
            </PageShell>
          }
        />
        <Route
          path="utility/bulk-teks"
          element={
            <PageShell badge="Utilitas" title={tr("Bulk Teks")} subtitle={tr("Manipulasi daftar teks — hapus duplikat, sort, acak, nomori, dan lainnya.")}>
              <UtilityBulkText />
            </PageShell>
          }
        />
        <Route
          path="utility/cetak"
          element={
            <PageShell badge="Utilitas" title={tr("Cetak File & Dokumen")} subtitle={tr("Cetak PDF, gambar, dokumen Office, dan teks dengan pratinjau langsung dan pengaturan lengkap seperti dialog cetak browser: kertas, orientasi, margin, skala, halaman per lembar, salinan, warna, buklet, header/footer, watermark.")}>
              <PrintCenter />
            </PageShell>
          }
        />
        <Route
          path="utility/link-media"
          element={
            <PageShell badge="Utilitas" title={tr("Link Media")} width="narrow" subtitle={tr("Analisis link video/file untuk unduhan langsung.")}>
              <UtilityMediaLink />
            </PageShell>
          }
        />
        <Route
          path="utility/alias-email"
          element={
            <PageShell badge="Utilitas" title={tr("Alias Email")} width="narrow" subtitle={tr("Buat alamat email alternatif untuk pendaftaran.")}>
              <UtilityAliasEmail />
            </PageShell>
          }
        />
        <Route
          path="utility/kalkulator-pajak"
          element={
            <PageShell badge="Utilitas" title={tr("Kalkulator Pajak")} width="narrow" subtitle={tr("Hitung PPN eksklusif maupun inklusif.")}>
              <UtilityTaxCalculator />
            </PageShell>
          }
        />
        <Route
          path="utility/kalkulator-bunga"
          element={
            <PageShell badge="Utilitas" title={tr("Kalkulator Bunga")} width="narrow" subtitle={tr("Hitung bunga sederhana & majemuk.")}>
              <UtilityInterestCalculator />
            </PageShell>
          }
        />
        <Route
          path="utility/statistik"
          element={
            <PageShell badge="Utilitas" title={tr("Statistik")} width="narrow" subtitle={tr("Mean, median, min, max, dan standar deviasi dari sekumpulan angka.")}>
              <UtilityStatistics />
            </PageShell>
          }
        />
        <Route
          path="utility/password-token"
          element={
            <PageShell badge="Utilitas" title={tr("Password & Token")} subtitle={tr("Generator password & token berbasis Web Crypto API — aman dan acak.")}>
              <UtilityPasswordToken />
            </PageShell>
          }
        />
        <Route
          path="utility/kamus-dunia"
          element={
            <PageShell badge="Utilitas" title={tr("Kamus Dunia")} subtitle={tr("Cari arti kata & terjemahkan kalimat lintas puluhan bahasa dunia.")}>
              <UtilityWorldDictionary />
            </PageShell>
          }
        />
        <Route
          path="utility/html-preview"
          element={
            <PageShell badge="Utilitas" title={tr("HTML Preview")} subtitle={tr("Tulis HTML, CSS, dan JavaScript, lihat hasilnya langsung secara real-time.")}>
              <UtilityHtmlPreview />
            </PageShell>
          }
        />
        <Route
          path="office/diagram-rumus"
          element={
            <PageShell badge={tr("Office")} title={tr("Diagram & Rumus Studio")} subtitle={tr("Buat & preview flowchart, struktur organisasi, chart, hingga rumus matematika (LaTeX).")}>
              <UtilityDiagramFormula />
            </PageShell>
          }
        />
        <Route path="utility/diagram-rumus" element={<Navigate to="/office/diagram-rumus" replace />} />
        <Route
          path="utility/convert"
          element={
            <PageShell badge="Utilitas" title={tr("Universal Converter")} subtitle={tr("Ubah file/data ke format lain — gambar, dokumen, spreadsheet, data terstruktur, audio, video, dan ZIP.")}>
              <UniversalConverter />
            </PageShell>
          }
        />
        <Route path="utility/pengukur-suara" element={<Navigate to="/audio/pengukur-suara" replace />} />
        <Route
          path="utility/kalkulator"
          element={
            <PageShell badge="Utilitas" title={tr("Kalkulator")} width="medium" subtitle={tr("Satu tempat untuk semua kalkulator: standar, pajak, bunga, investasi, cicilan, rumus, hingga HPP/COGS.")}>
              <CalculatorHub />
            </PageShell>
          }
        />

        {/* ── Spesial ──────────────────────────────────────────────────── */}
        <Route path="special" element={<SpesialCategory />} />
        <Route
          path="special/kwitansi"
          element={
            <PageShell badge={tr("Spesial")} title={tr("Kwitansi")} subtitle={tr("Kwitansi pembayaran profesional dengan logo custom — export PNG & PDF, siap cetak.")}>
              <KwitansiGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/invoice"
          element={
            <PageShell badge={tr("Spesial")} title={tr("Invoice")} subtitle={tr("Invoice profesional dengan item dinamis, logo custom, diskon & pajak — export PNG & PDF.")}>
              <InvoiceGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/struk"
          element={
            <PageShell badge={tr("Spesial")} title={tr("Struk / Nota")} subtitle={tr("Struk kasir custom dengan logo — export PNG & PDF, cetak langsung ke printer USB/Bluetooth.")}>
              <StrukGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/name-tag"
          element={
            <PageShell badge={tr("Spesial")} title={tr("Name Tag Studio")} subtitle={tr("Generator name tag, badge acara & ID card full custom: template siap pakai, warna otomatis per peran, foto, QR/barcode, lubang tali, meja nama lipat — satu per satu atau massal dari tabel/CSV/XLSX.")}>
              <NametagGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/kartu-nama"
          element={
            <PageShell badge={tr("Spesial")} title={tr("Studio Kartu Nama")} subtitle={tr("Desain kartu nama full custom: template siap pakai, latar warna/gradasi/gambar, elemen bebas, ukuran & sisi depan-belakang — export PNG & PDF, siap cetak.")}>
              <BusinessCardGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/kupon"
          element={
            <PageShell badge={tr("Spesial")} title={tr("Kupon, Voucher & Tiket")} subtitle={tr("Generator kupon diskon, voucher, tiket event, tiket masuk, gift card, dan kupon undian — 12 template, kode unik otomatis, QR & barcode, massal hingga 1.000 lembar.")}>
              <CouponGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/surat"
          element={
            <PageShell badge={tr("Spesial")} title={tr("Pembuat Surat")} subtitle={tr("Generator surat resmi, bisnis, lamaran, kuasa, pernyataan, perjanjian, dan lainnya — 17 template, kop surat kustom, nomor otomatis, tanda tangan & materai, surat massal, ekspor PDF/Word.")}>
              <LetterGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/sertifikat"
          element={
            <PageShell badge={tr("Spesial")} title={tr("Sertifikat & Piagam")} subtitle={tr("Generator sertifikat massal, full custom — template, font, dan posisi bebas diatur.")}>
              <CertificateGenerator />
            </PageShell>
          }
        />
        <Route
          path="special/wa-link"
          element={
            <PageShell badge={tr("Spesial")} title={tr("WA Link")} subtitle={tr("Buka chat WhatsApp langsung tanpa perlu menyimpan kontak.")}>
              <WaLink />
            </PageShell>
          }
        />
        <Route
          path="special/pembuat-cv"
          element={
            <PageShell badge={tr("Spesial")} title={tr("Pembuat CV")} subtitle={tr("Buat CV/resume profesional dengan 8 template, susunan & judul bagian yang bisa diatur, foto, auto-muat 1 halaman — ekspor PDF (teks bisa dipilih/ATS), DOCX, dan PNG tajam.")}>
              <CvMaker />
            </PageShell>
          }
        />

        {/* ── Video ────────────────────────────────────────────────────── */}
        <Route path="video" element={<VideoCategory />} />
        <Route
          path="video/konversi"
          element={
            <PageShell badge={tr("Video")} title={tr("Konversi Video")} subtitle={tr("Satu alat, banyak tujuan: ganti format video, jadikan GIF, atau ambil audionya saja — pilih tab sesuai kebutuhan.")}>
              <VideoConvertHub />
            </PageShell>
          }
        />
        <Route
          path="video/potong"
          element={
            <PageShell badge={tr("Video")} title={tr("Potong Video")} subtitle={tr("Trim satu bagian atau buang beberapa bagian sekaligus, langsung di browser.")}>
              <VideoTrim />
            </PageShell>
          }
        />
        <Route
          path="video/crop"
          element={
            <PageShell badge={tr("Video")} title={tr("Crop & Resize Video")} subtitle={tr("Pas-kan video ke rasio 1:1, 9:16, 16:9, dan lainnya untuk media sosial.")}>
              <VideoCrop />
            </PageShell>
          }
        />
        <Route
          path="video/subtitle"
          element={
            <PageShell badge={tr("Video")} title={tr("Teks & Subtitle (CC)")} subtitle={tr("Tambah teks bertempo — ekspor sebagai .SRT/.VTT ringan atau bakar langsung ke video.")}>
              <VideoSubtitle />
            </PageShell>
          }
        />
        <Route
          path="video/gabung"
          element={
            <PageShell badge={tr("Video")} title={tr("Gabung & Transisi")} subtitle={tr("Satukan beberapa klip berurutan dengan transisi cut atau crossfade.")}>
              <VideoMerge />
            </PageShell>
          }
        />
        <Route
          path="video/filter"
          element={
            <PageShell badge={tr("Video")} title={tr("Kecepatan & Filter")} subtitle={tr("Atur kecepatan putar dan filter warna — preview langsung sesuai hasil ekspor.")}>
              <VideoFilter />
            </PageShell>
          }
        />
        <Route
          path="video/kompres"
          element={
            <PageShell badge={tr("Video")} title={tr("Kompres Video")} width="medium" subtitle={tr("Perkecil ukuran video — pilih preset, atur resolusi, fps & bitrate, atau tentukan target ukuran file. Uji 5 detik dulu sebelum memproses seluruh video.")}>
              <VideoCompress />
            </PageShell>
          }
        />
        <Route
          path="video/thumbnail"
          element={
            <PageShell badge={tr("Video")} title={tr("Tangkap Thumbnail / Screenshot")} subtitle={tr("Putar video ke posisi yang diinginkan, lalu tangkap satu frame sebagai gambar PNG.")}>
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
            <PageShell badge={tr("Audio")} title={tr("Konversi Audio")} subtitle={tr("Ubah audio ke WAV (kualitas penuh) atau format terkompresi (Opus) — semua diproses langsung di browser.")}>
              <AudioConvertHub />
            </PageShell>
          }
        />
        <Route
          path="audio/edit-audio"
          element={
            <PageShell badge={tr("Audio")} title={tr("Edit Audio")} width="medium" subtitle={tr("Editor waveform lengkap: pangkas, potong, tempel, fade, volume, tempo & pitch, equalizer, kompresor, reverb, noise gate, marker, hingga ekspor WAV/Opus — semua di browser.")}>
              <AudioEditor />
            </PageShell>
          }
        />
        <Route
          path="audio/transkrip-audio"
          element={
            <PageShell badge={tr("Audio")} title={tr("Transkrip Audio")} subtitle={tr("Ubah rekaman rapat, wawancara, kuliah, atau podcast menjadi transkrip berformat — stempel waktu, pembicara, paragraf, kata kunci & ringkasan — lalu ekspor ke DOCX, PDF, SRT, dan lainnya.")}>
              <AudioTranscript />
            </PageShell>
          }
        />
        <Route
          path="audio/kompres"
          element={
            <PageShell badge={tr("Audio")} title={tr("Kompres Audio")} subtitle={tr("Perkecil ukuran audio dengan Opus (jauh lebih kecil dari MP3) — pilih preset, atur bitrate sendiri, atau tentukan target ukuran file. Bisa banyak file sekaligus, semua di browser.")}>
              <AudioCompress />
            </PageShell>
          }
        />
        <Route
          path="audio/visualizer"
          element={
            <PageShell badge={tr("Audio")} title={tr("Audio Visualizer")} subtitle={tr("Ubah lagu jadi visual bergerak: 13 gaya, kustomisasi penuh (warna, glow, pantulan, logo, teks, latar), pratinjau real-time, lalu ekspor .mov dengan latar transparan otomatis — atau beri latar sendiri.")}>
              <AudioVisualizer />
            </PageShell>
          }
        />
        <Route
          path="audio/suara-ke-teks"
          element={
            <PageShell badge={tr("Audio")} title={tr("Speech to Text")} subtitle={tr("Ubah ucapan jadi teks secara langsung lewat mikrofon.")}>
              <AudioSpeechToText />
            </PageShell>
          }
        />
        <Route
          path="audio/teks-ke-suara"
          element={
            <PageShell badge={tr("Audio")} title={tr("Text to Speech")} subtitle={tr("Bacakan teks apa pun dengan suara pilihan langsung dari browser.")}>
              <AudioTextToSpeech />
            </PageShell>
          }
        />
        <Route
          path="audio/pengukur-suara"
          element={
            <PageShell badge={tr("Audio")} title={tr("Pengukur Kekuatan Suara")} subtitle={tr("Meteran level suara real-time langsung dari mikrofon browser.")}>
              <AudioSoundMeter />
            </PageShell>
          }
        />
        <Route
          path="audio/ekstrak-audio-video"
          element={
            <PageShell badge={tr("Audio")} title={tr("Ekstrak Audio dari Video")} subtitle={tr("Ambil track audio dari file video sebagai file terpisah — bisa dipangkas dulu sebelum diekstrak.")}>
              <AudioExtractFromVideo />
            </PageShell>
          }
        />

        <Route path="about" element={<About />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="faq" element={<Faq />} />

        {/* Fallback — arahkan path tak dikenal ke beranda */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ToolSearchProvider>
  </BrowserRouter>
);
