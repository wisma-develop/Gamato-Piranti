import {
  Layers, FileOutput, FileDown, FilePlus, FileX, RotateCw,
  SlidersHorizontal, FileImage, AlignLeft, BookOpen, BarChart3, EyeOff,
  PenSquare, PenLine, Code2, ListOrdered, KeyRound, ScanLine,
  FileText, Type, ShieldCheck,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function DokumenCategory() {
  return (
    <PageShell
      badge="Dokumen"
      title="Dokumen"
      subtitle="PDF Lab – Suite, konversi Office 2 arah, OCR, keamanan & anotasi PDF, sampai Doc Studio — masing-masing alat punya halaman sendiri."
    >
      <CategoryGrid
        groups={[
          {
            section: "Konversi ke PDF",
            items: [
              { name: "Word ke PDF", desc: "Konversi file .docx menjadi PDF, format teks tetap terjaga.", path: "/pdf/word-ke-pdf", icon: <FileText className="w-6 h-6" /> },
              { name: "Excel ke PDF", desc: "Konversi sheet .xlsx menjadi tabel PDF yang rapi.", path: "/pdf/excel-ke-pdf", icon: <BarChart3 className="w-6 h-6" /> },
              { name: "PowerPoint ke PDF", desc: "Konversi .pptx menjadi PDF, satu slide satu halaman.", path: "/pdf/ppt-ke-pdf", icon: <Layers className="w-6 h-6" /> },
              { name: "Gambar ke PDF", desc: "Ubah kumpulan JPG/PNG menjadi satu PDF.", path: "/pdf/gambar-ke-pdf", icon: <FileImage className="w-6 h-6" /> },
              { name: "Teks ke PDF", desc: "Konversi teks polos menjadi dokumen PDF rapi.", path: "/pdf/teks-ke-pdf", icon: <AlignLeft className="w-6 h-6" /> },
              { name: "HTML ke PDF", desc: "Render kode HTML/CSS jadi dokumen PDF custom.", path: "/pdf/html-ke-pdf", icon: <Code2 className="w-6 h-6" /> },
            ],
          },
          {
            section: "Konversi dari PDF",
            items: [
              { name: "PDF ke Gambar", desc: "Render setiap halaman jadi PNG/JPEG kualitas tinggi.", path: "/pdf/ke-gambar", icon: <FileImage className="w-6 h-6" /> },
              { name: "PDF ke Word", desc: "Ekstrak teks asli PDF menjadi dokumen .docx.", path: "/pdf/ke-word", icon: <FileText className="w-6 h-6" /> },
              { name: "PDF ke Excel", desc: "Deteksi baris & kolom, ekspor sebagai .xlsx.", path: "/pdf/ke-excel", icon: <BarChart3 className="w-6 h-6" /> },
              { name: "OCR", desc: "Baca teks dari PDF hasil scan atau foto dokumen.", path: "/pdf/ocr", icon: <Type className="w-6 h-6" /> },
            ],
          },
          {
            section: "PDF Lab – Suite",
            items: [
              { name: "Gabung PDF", desc: "Gabungkan beberapa file PDF menjadi satu.", path: "/pdf/gabung", icon: <Layers className="w-6 h-6" /> },
              { name: "Pecah PDF", desc: "Setiap halaman PDF diunduh sebagai file terpisah.", path: "/pdf/pecah", icon: <FileOutput className="w-6 h-6" /> },
              { name: "Kompres PDF", desc: "Kurangi ukuran file PDF — gambar dikompres ulang secara nyata.", path: "/pdf/kompres", icon: <FileDown className="w-6 h-6" /> },
              { name: "Ekstrak Halaman", desc: "Ambil hanya halaman tertentu dari PDF.", path: "/pdf/ekstrak", icon: <FilePlus className="w-6 h-6" /> },
              { name: "Hapus Halaman", desc: "Buang halaman yang tidak dibutuhkan.", path: "/pdf/hapus-halaman", icon: <FileX className="w-6 h-6" /> },
              { name: "Putar Halaman", desc: "Rotasi halaman PDF yang miring atau terbalik.", path: "/pdf/putar", icon: <RotateCw className="w-6 h-6" /> },
              { name: "Atur Ulang Halaman", desc: "Susun ulang urutan halaman PDF.", path: "/pdf/atur-ulang", icon: <SlidersHorizontal className="w-6 h-6" /> },
            ],
          },
          {
            section: "Keamanan & Anotasi",
            items: [
              { name: "Edit PDF", desc: "Tambahkan teks bebas atau kotak penanda ke halaman PDF.", path: "/pdf/edit", icon: <PenSquare className="w-6 h-6" /> },
              { name: "Tanda Tangan PDF", desc: "Gambar atau ketik tanda tangan, tempelkan ke PDF.", path: "/pdf/tanda-tangan", icon: <PenLine className="w-6 h-6" /> },
              { name: "Watermark PDF", desc: "Tambahkan watermark teks ke semua halaman.", path: "/pdf/watermark", icon: <Layers className="w-6 h-6" /> },
              { name: "Nomor Halaman", desc: "Tambahkan nomor halaman format & posisi bebas.", path: "/pdf/nomor-halaman", icon: <ListOrdered className="w-6 h-6" /> },
              { name: "Protect PDF", desc: "Kunci konten dari salin/edit dengan mengubah jadi gambar flat.", path: "/pdf/protect", icon: <ShieldCheck className="w-6 h-6" /> },
              { name: "Unlock PDF", desc: "Hapus batasan cetak/salin dari PDF yang tidak terkunci password.", path: "/pdf/unlock", icon: <KeyRound className="w-6 h-6" /> },
            ],
          },
          {
            section: "Baca & Pindai",
            items: [
              { name: "PDF Reader", desc: "Baca PDF langsung di browser + info dokumen.", path: "/pdf/reader", icon: <BookOpen className="w-6 h-6" /> },
              { name: "Sensor / Redaksi PDF", desc: "Hitamkan informasi sensitif secara permanen dengan menggambar kotak sensor.", path: "/pdf/sensor", icon: <EyeOff className="w-6 h-6" /> },
              { name: "Scan PDF", desc: "Ubah foto dokumen menjadi PDF hasil scan.", path: "/pdf/scan", icon: <ScanLine className="w-6 h-6" /> },
            ],
          },
          {
            section: "Doc Studio",
            items: [
              { name: "Doc Studio", desc: "Editor dokumen full rich-text dengan ekspor .docx, .pdf, dan .txt.", path: "/docs", icon: <BookOpen className="w-6 h-6" /> },
              { name: "Doc Reader", desc: "Baca file .txt, .docx, atau .rtf dengan tampilan nyaman — bisa juga didengarkan.", path: "/pdf/baca-dokumen", icon: <BookOpen className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
