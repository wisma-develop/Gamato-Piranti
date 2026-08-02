import type { FC } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Layout from "@/components/layout/Layout";
import { PageShell } from "@/components/PageShell";

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
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route
          path="qr"
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
        <Route
          path="pdf"
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
        <Route
          path="image"
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
        <Route
          path="utility"
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
      </Route>
    </Routes>
  </BrowserRouter>
);
