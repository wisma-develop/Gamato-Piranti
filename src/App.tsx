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
import GambarCategory from "@/pages/categories/GambarCategory";
import UtilitasCategory from "@/pages/categories/UtilitasCategory";
import SpesialCategory from "@/pages/categories/SpesialCategory";

import { QrCodeGenerator } from "@/features/qr-barcode/QrCodeGenerator";
import { BarcodeGenerator } from "@/features/qr-barcode/BarcodeGenerator";

import { PdfMerge } from "@/features/pdf/PdfMerge";
import { PdfSplit } from "@/features/pdf/PdfSplit";
import { PdfCompress } from "@/features/pdf/PdfCompress";
import { PdfExtract } from "@/features/pdf/PdfExtract";
import { PdfDeletePages } from "@/features/pdf/PdfDeletePages";
import { PdfRotate } from "@/features/pdf/PdfRotate";
import { PdfOrganize } from "@/features/pdf/PdfOrganize";
import { PdfImagesToPdf } from "@/features/pdf/PdfImagesToPdf";
import { PdfTextToPdf } from "@/features/pdf/PdfTextToPdf";

import { DocTools } from "@/features/docs/DocTools";

import { ImageCompress } from "@/features/image/ImageCompress";
import { ImageResize } from "@/features/image/ImageResize";
import { ImageConvert } from "@/features/image/ImageConvert";
import { ImageRotate } from "@/features/image/ImageRotate";

import { UtilityJsonBase64 } from "@/features/utility/UtilityJsonBase64";
import { UtilityBulkText } from "@/features/utility/UtilityBulkText";
import { UtilityMediaLink } from "@/features/utility/UtilityMediaLink";
import { UtilityAliasEmail } from "@/features/utility/UtilityAliasEmail";
import { UtilityTaxCalculator } from "@/features/utility/UtilityTaxCalculator";
import { UtilityInterestCalculator } from "@/features/utility/UtilityInterestCalculator";
import { UtilityStatistics } from "@/features/utility/UtilityStatistics";
import { UtilityPasswordToken } from "@/features/utility/UtilityPasswordToken";
import { UtilityMetadataRemover } from "@/features/utility/UtilityMetadataRemover";

import { CertificateGenerator } from "@/features/special/CertificateGenerator";
import { WaLink } from "@/features/special/WaLink";

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

        {/* Doc Studio — alat tunggal, tanpa submenu */}
        <Route
          path="docs"
          element={
            <PageShell
              badge="Dokumen"
              title="Doc Studio"
              subtitle="Editor dokumen ringan dengan ekspor .docx, .pdf, .txt — dilengkapi Find & Replace, template cepat, dan snapshot sesi."
            >
              <DocTools />
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
          path="utility/hapus-metadata"
          element={
            <PageShell badge="Utilitas" title="Hapus Metadata" subtitle="Hapus EXIF, GPS, dan data sensitif lainnya dari gambar via re-encode canvas.">
              <UtilityMetadataRemover />
            </PageShell>
          }
        />

        {/* ── Spesial ──────────────────────────────────────────────────── */}
        <Route path="special" element={<SpesialCategory />} />
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

        <Route path="about" element={<About />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />

        {/* Fallback — arahkan path tak dikenal ke beranda */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
