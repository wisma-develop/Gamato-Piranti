import { Scissors, Crop, Captions, Layers, Sparkles, Camera, RefreshCw, Shrink } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";
import { tr } from "@/i18n";

export default function VideoCategory() {
  return (
    <PageShell
      badge={tr("Video")}
      title={tr("Video Studio")}
      subtitle={tr("Editor video ringan langsung di browser — potong, crop, teks/subtitle, gabung & transisi, kecepatan & filter. Tanpa upload, tanpa install.")}
    >
      <CategoryGrid
        groups={[
          {
            items: [
              { name: tr("Konversi Video"), desc: tr("Satu alat, banyak tujuan: ganti format, jadikan GIF, atau ambil audionya saja."), path: "/video/konversi", icon: <RefreshCw className="w-6 h-6" /> },
              { name: tr("Kompres Video"), desc: tr("Perkecil ukuran video — preset, resolusi, fps, bitrate, atau target ukuran file. Ada uji 5 detik."), path: "/video/kompres", icon: <Shrink className="w-6 h-6" />, badge: tr("Baru") },
              { name: tr("Potong Video"), desc: tr("Trim satu bagian, atau buang beberapa bagian sekaligus (cut & stitch)."), path: "/video/potong", icon: <Scissors className="w-6 h-6" /> },
              { name: tr("Crop & Resize"), desc: tr("Pas-kan video ke rasio 1:1, 9:16, 16:9, dan lainnya untuk media sosial."), path: "/video/crop", icon: <Crop className="w-6 h-6" /> },
              { name: tr("Teks & Subtitle (CC)"), desc: tr("Tambah caption manual — ekspor sebagai .SRT/.VTT ringan atau bakar langsung ke video."), path: "/video/subtitle", icon: <Captions className="w-6 h-6" /> },
              { name: tr("Gabung & Transisi"), desc: tr("Satukan beberapa klip berurutan dengan transisi Cut atau Crossfade."), path: "/video/gabung", icon: <Layers className="w-6 h-6" /> },
              { name: tr("Kecepatan & Filter"), desc: tr("Slow-motion/mempercepat video, plus filter warna (grayscale, sepia, vintage, dll)."), path: "/video/filter", icon: <Sparkles className="w-6 h-6" /> },
              { name: tr("Tangkap Thumbnail / Screenshot"), desc: tr("Ambil satu frame video sebagai gambar — cocok untuk cover atau thumbnail."), path: "/video/thumbnail", icon: <Camera className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
