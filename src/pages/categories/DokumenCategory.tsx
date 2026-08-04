import {
  Layers, FileOutput, FileDown, FilePlus, FileX, RotateCw,
  SlidersHorizontal, FileImage, AlignLeft, BookOpen,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function DokumenCategory() {
  return (
    <PageShell
      badge="Dokumen"
      title="Dokumen"
      subtitle="PDF Lab – Suite (9 mode pemrosesan PDF) dan Doc Studio — masing-masing alat punya halaman sendiri."
    >
      <CategoryGrid
        groups={[
          {
            section: "PDF Lab – Suite",
            items: [
              { name: "Gabung PDF", desc: "Gabungkan beberapa file PDF menjadi satu.", path: "/pdf/gabung", icon: <Layers className="w-6 h-6" /> },
              { name: "Pecah PDF", desc: "Setiap halaman PDF diunduh sebagai file terpisah.", path: "/pdf/pecah", icon: <FileOutput className="w-6 h-6" /> },
              { name: "Kompres PDF", desc: "Kurangi ukuran file PDF tanpa mengubah isi.", path: "/pdf/kompres", icon: <FileDown className="w-6 h-6" /> },
              { name: "Ekstrak Halaman", desc: "Ambil hanya halaman tertentu dari PDF.", path: "/pdf/ekstrak", icon: <FilePlus className="w-6 h-6" /> },
              { name: "Hapus Halaman", desc: "Buang halaman yang tidak dibutuhkan.", path: "/pdf/hapus-halaman", icon: <FileX className="w-6 h-6" /> },
              { name: "Putar Halaman", desc: "Rotasi halaman PDF yang miring atau terbalik.", path: "/pdf/putar", icon: <RotateCw className="w-6 h-6" /> },
              { name: "Atur Ulang Halaman", desc: "Susun ulang urutan halaman PDF.", path: "/pdf/atur-ulang", icon: <SlidersHorizontal className="w-6 h-6" /> },
              { name: "Gambar ke PDF", desc: "Ubah kumpulan JPG/PNG menjadi satu PDF.", path: "/pdf/gambar-ke-pdf", icon: <FileImage className="w-6 h-6" /> },
              { name: "Teks ke PDF", desc: "Konversi teks polos menjadi dokumen PDF rapi.", path: "/pdf/teks-ke-pdf", icon: <AlignLeft className="w-6 h-6" /> },
            ],
          },
          {
            section: "Doc Studio",
            items: [
              { name: "Doc Studio", desc: "Editor dokumen ringan dengan ekspor .docx, .pdf, dan .txt.", path: "/docs", icon: <BookOpen className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
