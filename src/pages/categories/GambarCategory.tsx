import { FileDown, ArrowLeftRight, Wand2, RotateCw, Eraser, Camera, Crop, Layers, Code2, Smile, SlidersHorizontal } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function GambarCategory() {
  return (
    <PageShell
      badge="Gambar"
      title="Gambar"
      subtitle="Image Lab — mulai dari editor foto lengkap, crop, hapus background, watermark, sampai meme generator. Semua diproses langsung di perangkatmu."
    >
      <CategoryGrid
        groups={[
          {
            section: "Edit & Perbaiki",
            items: [
              { name: "Photo Editor", desc: "Sesuaikan kecerahan, kontras, saturasi, filter warna, putar & balik.", path: "/image/photo-editor", icon: <SlidersHorizontal className="w-6 h-6" /> },
              { name: "Crop Gambar", desc: "Potong area gambar secara interaktif dengan preset rasio.", path: "/image/crop", icon: <Crop className="w-6 h-6" /> },
              { name: "Putar Gambar", desc: "Putar foto yang miring atau terbalik.", path: "/image/putar", icon: <RotateCw className="w-6 h-6" /> },
              { name: "Hapus Background", desc: "Hapus warna latar solid (chroma-key), unduh PNG transparan.", path: "/image/hapus-background", icon: <Eraser className="w-6 h-6" /> },
            ],
          },
          {
            section: "Kreatif",
            items: [
              { name: "Watermark Gambar", desc: "Tempel watermark teks atau logo, sekali atau berulang (tile).", path: "/image/watermark", icon: <Layers className="w-6 h-6" /> },
              { name: "Meme Generator", desc: "Tambahkan teks bergaya meme yang bisa digeser bebas.", path: "/image/meme-generator", icon: <Smile className="w-6 h-6" /> },
              { name: "HTML ke Gambar", desc: "Render kode HTML/CSS jadi gambar PNG — kartu kutipan, badge, banner.", path: "/image/html-ke-gambar", icon: <Code2 className="w-6 h-6" /> },
            ],
          },
          {
            section: "Konversi & Optimasi",
            items: [
              { name: "Kompres Gambar", desc: "Kurangi ukuran file gambar tanpa mengubah dimensi.", path: "/image/kompres", icon: <FileDown className="w-6 h-6" /> },
              { name: "Ubah Ukuran", desc: "Ubah dimensi gambar dengan rasio tetap terjaga.", path: "/image/resize", icon: <ArrowLeftRight className="w-6 h-6" /> },
              { name: "Konversi Format", desc: "Konversi antar format JPEG, PNG, dan WEBP.", path: "/image/konversi", icon: <Wand2 className="w-6 h-6" /> },
              { name: "Baca Foto RAW", desc: "Ekstrak preview JPEG dari file RAW kamera (CR2, NEF, ARW, DNG, dll).", path: "/image/raw-preview", icon: <Camera className="w-6 h-6" /> },
              { name: "Hapus Metadata", desc: "Hapus EXIF/GPS dari gambar via re-encode canvas.", path: "/image/hapus-metadata", icon: <Eraser className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
