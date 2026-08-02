import type { FC } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "@/components/layout/Layout";
import { PageShell } from "@/components/PageShell";
import ScrollToTop from "@/components/ScrollToTop";

import Home from "@/pages/Home";
import About from "@/pages/About";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";

import { QRBarcodeStudio } from "@/features/qr-barcode/QRBarcodeStudio";
import { PdfTools } from "@/features/pdf/PdfTools";
import { DocTools } from "@/features/docs/DocTools";
import { ImageTools } from "@/features/image/ImageTools";
import { UtilityShelf } from "@/features/utility/UtilityShelf";

export const App: FC = () => (
  <BrowserRouter>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />

        {/* Kode — QR & Barcode Studio: /qr/qr-code, /qr/barcode */}
        <Route path="qr" element={<Navigate to="/qr/qr-code" replace />} />
        <Route
          path="qr/:mode"
          element={
            <PageShell
              badge="Kode"
              title="QR & Barcode Studio"
              subtitle="Buat QR code multi-template dengan logo & warna kustom, atau barcode berbagai format — preview real-time, semua fitur lengkap."
            >
              <QRBarcodeStudio />
            </PageShell>
          }
        />

        {/* Dokumen — PDF Lab: 9 mode, masing-masing punya URL sendiri */}
        <Route path="pdf" element={<Navigate to="/pdf/gabung" replace />} />
        <Route
          path="pdf/:mode"
          element={
            <PageShell
              badge="Dokumen"
              title="PDF Lab – Suite"
              subtitle="9 mode pemrosesan PDF: gabung, pecah, kompres, ekstrak, hapus, putar, atur halaman, gambar→PDF, dan teks→PDF."
            >
              <PdfTools />
            </PageShell>
          }
        />

        {/* Dokumen — Doc Studio: alat tunggal, tanpa submenu */}
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

        {/* Gambar — Image Lab: 4 mode */}
        <Route path="image" element={<Navigate to="/image/kompres" replace />} />
        <Route
          path="image/:mode"
          element={
            <PageShell
              badge="Gambar"
              title="Image Lab"
              subtitle="Kompres, ubah ukuran, konversi format (JPG/PNG/WEBP), dan putar gambar — batch processing langsung di browser."
            >
              <ImageTools />
            </PageShell>
          }
        />

        {/* Utilitas — Rak Utilitas: 10 alat */}
        <Route path="utility" element={<Navigate to="/utility/json-base64" replace />} />
        <Route
          path="utility/:mode"
          element={
            <PageShell
              badge="Utilitas"
              title="Rak Utilitas"
              subtitle="10+ alat kecil: JSON formatter, Base64, bulk teks, kalkulator pajak & bunga, WA link, password & token generator, hapus metadata."
            >
              <UtilityShelf />
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
