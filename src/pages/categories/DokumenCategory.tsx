import {
  Layers, FileOutput, FileDown, FilePlus, FileX, RotateCw,
  SlidersHorizontal, FileImage, AlignLeft, BookOpen, BarChart3, EyeOff,
  PenSquare, PenLine, Code2, ListOrdered, KeyRound, ScanLine,
  FileText, Type, ShieldCheck, Shrink,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";
import { tr } from "@/i18n";

export default function DokumenCategory() {
  return (
    <PageShell
      badge={tr("Dokumen")}
      title={tr("Dokumen")}
      subtitle={tr("PDF Lab – Suite, konversi Office 2 arah, OCR, keamanan & anotasi PDF, sampai Doc Reader — masing-masing alat punya halaman sendiri.")}
    >
      <CategoryGrid
        groups={[
          {
            section: tr("Konversi ke PDF"),
            items: [
              { name: tr("Word ke PDF"), desc: tr("Konversi file .docx menjadi PDF, format teks tetap terjaga."), path: "/pdf/word-ke-pdf", icon: <FileText className="w-6 h-6" /> },
              { name: tr("Excel ke PDF"), desc: tr("Konversi sheet .xlsx menjadi tabel PDF yang rapi."), path: "/pdf/excel-ke-pdf", icon: <BarChart3 className="w-6 h-6" /> },
              { name: tr("PowerPoint ke PDF"), desc: tr("Konversi .pptx menjadi PDF, satu slide satu halaman."), path: "/pdf/ppt-ke-pdf", icon: <Layers className="w-6 h-6" /> },
              { name: tr("Gambar ke PDF"), desc: tr("Ubah kumpulan JPG/PNG menjadi satu PDF."), path: "/pdf/gambar-ke-pdf", icon: <FileImage className="w-6 h-6" /> },
              { name: tr("Teks ke PDF"), desc: tr("Konversi teks polos menjadi dokumen PDF rapi."), path: "/pdf/teks-ke-pdf", icon: <AlignLeft className="w-6 h-6" /> },
              { name: tr("HTML ke PDF"), desc: tr("Render kode HTML/CSS jadi dokumen PDF custom."), path: "/pdf/html-ke-pdf", icon: <Code2 className="w-6 h-6" /> },
            ],
          },
          {
            section: tr("Konversi dari PDF"),
            items: [
              { name: tr("PDF ke Gambar"), desc: tr("Render setiap halaman jadi PNG/JPEG kualitas tinggi."), path: "/pdf/ke-gambar", icon: <FileImage className="w-6 h-6" /> },
              { name: tr("PDF ke Word"), desc: tr("Ekstrak teks asli PDF menjadi dokumen .docx."), path: "/pdf/ke-word", icon: <FileText className="w-6 h-6" /> },
              { name: tr("PDF ke Excel"), desc: tr("Deteksi baris & kolom, ekspor sebagai .xlsx."), path: "/pdf/ke-excel", icon: <BarChart3 className="w-6 h-6" /> },
              { name: tr("OCR"), desc: tr("Baca teks dari PDF hasil scan atau foto dokumen."), path: "/pdf/ocr", icon: <Type className="w-6 h-6" /> },
            ],
          },
          {
            section: tr("PDF Lab – Suite"),
            items: [
              { name: tr("Gabung PDF"), desc: tr("Gabungkan beberapa file PDF menjadi satu."), path: "/pdf/gabung", icon: <Layers className="w-6 h-6" /> },
              { name: tr("Pecah PDF"), desc: tr("Setiap halaman PDF diunduh sebagai file terpisah."), path: "/pdf/pecah", icon: <FileOutput className="w-6 h-6" /> },
              { name: tr("Kompres Dokumen"), desc: tr("Satu alat untuk memperkecil PDF, Word, Excel, PowerPoint, ODT, EPUB, ZIP, gambar & teks — banyak berkas sekaligus."), path: "/pdf/kompres-dokumen", icon: <Shrink className="w-6 h-6" />, badge: tr("Baru") },
              { name: tr("Kompres PDF"), desc: tr("Kurangi ukuran file PDF — gambar dikompres ulang secara nyata."), path: "/pdf/kompres", icon: <FileDown className="w-6 h-6" /> },
              { name: tr("Ekstrak Halaman"), desc: tr("Ambil hanya halaman tertentu dari PDF."), path: "/pdf/ekstrak", icon: <FilePlus className="w-6 h-6" /> },
              { name: tr("Hapus Halaman"), desc: tr("Buang halaman yang tidak dibutuhkan."), path: "/pdf/hapus-halaman", icon: <FileX className="w-6 h-6" /> },
              { name: tr("Putar Halaman"), desc: tr("Rotasi halaman PDF yang miring atau terbalik."), path: "/pdf/putar", icon: <RotateCw className="w-6 h-6" /> },
              { name: tr("Atur Ulang Halaman"), desc: tr("Susun ulang urutan halaman PDF."), path: "/pdf/atur-ulang", icon: <SlidersHorizontal className="w-6 h-6" /> },
            ],
          },
          {
            section: tr("Keamanan & Anotasi"),
            items: [
              { name: tr("Edit PDF"), desc: tr("Tambahkan teks bebas atau kotak penanda ke halaman PDF."), path: "/pdf/edit", icon: <PenSquare className="w-6 h-6" /> },
              { name: tr("Tanda Tangan PDF"), desc: tr("Gambar atau ketik tanda tangan, tempelkan ke PDF."), path: "/pdf/tanda-tangan", icon: <PenLine className="w-6 h-6" /> },
              { name: tr("Watermark PDF"), desc: tr("Tambahkan watermark teks ke semua halaman."), path: "/pdf/watermark", icon: <Layers className="w-6 h-6" /> },
              { name: tr("Nomor Halaman"), desc: tr("Tambahkan nomor halaman format & posisi bebas."), path: "/pdf/nomor-halaman", icon: <ListOrdered className="w-6 h-6" /> },
              { name: tr("Protect PDF"), desc: tr("Kunci konten dari salin/edit dengan mengubah jadi gambar flat."), path: "/pdf/protect", icon: <ShieldCheck className="w-6 h-6" /> },
              { name: tr("Unlock PDF"), desc: tr("Hapus batasan cetak/salin dari PDF yang tidak terkunci password."), path: "/pdf/unlock", icon: <KeyRound className="w-6 h-6" /> },
            ],
          },
          {
            section: tr("Baca & Pindai"),
            items: [
              { name: tr("PDF Reader"), desc: tr("Baca PDF langsung di browser + info dokumen."), path: "/pdf/reader", icon: <BookOpen className="w-6 h-6" /> },
              { name: tr("Sensor / Redaksi PDF"), desc: tr("Hitamkan informasi sensitif secara permanen dengan menggambar kotak sensor."), path: "/pdf/sensor", icon: <EyeOff className="w-6 h-6" /> },
              { name: tr("Scan PDF"), desc: tr("Ubah foto dokumen menjadi PDF hasil scan."), path: "/pdf/scan", icon: <ScanLine className="w-6 h-6" /> },
              { name: tr("Doc Reader"), desc: tr("Baca file .txt, .docx, atau .rtf dengan tampilan nyaman — bisa juga didengarkan."), path: "/pdf/baca-dokumen", icon: <BookOpen className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
