import { FileDown, ArrowLeftRight, Wand2, RotateCw, Eraser, Camera, Crop, Layers, Code2, Smile, SlidersHorizontal, Pipette, Printer, LayoutGrid, Files, FileText, FileType2, Presentation, Sheet, AlignLeft } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";
import { tr } from "@/i18n";

export default function GambarCategory() {
  return (
    <PageShell
      badge={tr("Gambar")}
      title={tr("Gambar")}
      subtitle={tr("Image Lab — mulai dari editor foto lengkap, crop, hapus background, watermark, sampai meme generator. Semua diproses langsung di perangkatmu.")}
    >
      <CategoryGrid
        groups={[
          {
            section: tr("Kolase & Cetak"),
            items: [
              { name: tr("Kolase Gambar"), desc: tr("Gabungkan banyak foto jadi satu kolase — 46 template, mode bebas, bentuk, bingkai, latar, teks & stiker."), path: "/image/kolase", icon: <LayoutGrid className="w-6 h-6" />, badge: tr("Baru") },
              { name: tr("Cetak Foto (Pas Foto & Custom)"), desc: tr("Susun 2x3, 3x4, 4x6, 4R & ukuran lain di satu/beberapa lembar — unduh PDF siap cetak atau cetak langsung."), path: "/image/cetak-foto", icon: <Printer className="w-6 h-6" />, badge: tr("Baru") },
            ],
          },
          {
            section: tr("Edit & Perbaiki"),
            items: [
              { name: tr("Photo Editor"), desc: tr("Sesuaikan kecerahan, kontras, saturasi, filter warna, putar & balik."), path: "/image/photo-editor", icon: <SlidersHorizontal className="w-6 h-6" /> },
              { name: tr("Crop Gambar"), desc: tr("Potong area gambar secara interaktif dengan preset rasio."), path: "/image/crop", icon: <Crop className="w-6 h-6" /> },
              { name: tr("Putar Gambar"), desc: tr("Putar foto yang miring atau terbalik."), path: "/image/putar", icon: <RotateCw className="w-6 h-6" /> },
              { name: tr("Hapus Background"), desc: tr("Hapus warna latar solid (chroma-key), unduh PNG transparan."), path: "/image/hapus-background", icon: <Eraser className="w-6 h-6" /> },
            ],
          },
          {
            section: tr("Kreatif"),
            items: [
              { name: tr("Watermark Gambar"), desc: tr("Tempel watermark teks atau logo, sekali atau berulang (tile)."), path: "/image/watermark", icon: <Layers className="w-6 h-6" /> },
              { name: tr("Meme Generator"), desc: tr("Tambahkan teks bergaya meme yang bisa digeser bebas."), path: "/image/meme-generator", icon: <Smile className="w-6 h-6" /> },
              { name: tr("HTML ke Gambar"), desc: tr("Render kode HTML/CSS jadi gambar PNG — kartu kutipan, badge, banner."), path: "/image/html-ke-gambar", icon: <Code2 className="w-6 h-6" /> },
              { name: tr("Color Picker & Palette"), desc: tr("Ambil warna dari gambar (HEX/RGB/HSL) dan ekstrak palet dominan otomatis."), path: "/image/color-picker", icon: <Pipette className="w-6 h-6" /> },
            ],
          },
          {
            section: tr("Konversi & Optimasi"),
            items: [
              { name: tr("Kompres Gambar"), desc: tr("Kurangi ukuran file gambar tanpa mengubah dimensi."), path: "/image/kompres", icon: <FileDown className="w-6 h-6" /> },
              { name: tr("Ubah Ukuran"), desc: tr("Ubah dimensi gambar dengan rasio tetap terjaga."), path: "/image/resize", icon: <ArrowLeftRight className="w-6 h-6" /> },
              { name: tr("Konversi Format"), desc: tr("Konversi antar format JPEG, PNG, dan WEBP."), path: "/image/konversi", icon: <Wand2 className="w-6 h-6" /> },
              { name: tr("Baca Foto RAW"), desc: tr("Ekstrak preview JPEG dari file RAW kamera (CR2, NEF, ARW, DNG, dll)."), path: "/image/raw-preview", icon: <Camera className="w-6 h-6" /> },
              { name: tr("Hapus Metadata"), desc: tr("Hapus EXIF/GPS dari gambar via re-encode canvas."), path: "/image/hapus-metadata", icon: <Eraser className="w-6 h-6" /> },
            ],
          },
          {
            section: tr("Dokumen ke Gambar"),
            items: [
              { name: tr("Semua Dokumen ke Gambar"), desc: tr("Satu tempat untuk PDF, Word, PowerPoint, Excel/CSV, dan teks/Markdown — jenis file dikenali otomatis."), path: "/image/dokumen-ke-gambar", icon: <Files className="w-6 h-6" /> },
              { name: tr("PDF ke Gambar"), desc: tr("Render halaman PDF jadi PNG/JPG/WebP tajam (hingga 400 dpi), atau gabung jadi satu gambar panjang."), path: "/image/pdf-ke-gambar", icon: <FileText className="w-6 h-6" /> },
              { name: tr("Word ke Gambar"), desc: tr("Ubah dokumen .docx jadi gambar per halaman — judul, daftar, tabel, dan gambar ikut dirender."), path: "/image/word-ke-gambar", icon: <FileType2 className="w-6 h-6" /> },
              { name: tr("PowerPoint ke Gambar"), desc: tr("Setiap slide .pptx jadi satu gambar lengkap dengan latar, tema warna, bentuk, dan teks."), path: "/image/ppt-ke-gambar", icon: <Presentation className="w-6 h-6" /> },
              { name: tr("Excel & CSV ke Gambar"), desc: tr("Render lembar .xlsx/.csv jadi gambar — warna sel, garis, sel gabungan, dan format angka dipertahankan."), path: "/image/excel-ke-gambar", icon: <Sheet className="w-6 h-6" /> },
              { name: tr("Teks & Markdown ke Gambar"), desc: tr("Ubah .txt, .md, .json, .rtf, kode, dan log jadi gambar rapi dengan font Unicode penuh."), path: "/image/teks-ke-gambar", icon: <AlignLeft className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
