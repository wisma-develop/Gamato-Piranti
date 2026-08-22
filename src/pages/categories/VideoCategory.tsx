import { Scissors, Crop, Captions, Layers, Sparkles, Camera } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function VideoCategory() {
  return (
    <PageShell
      badge="Video"
      title="Video Studio"
      subtitle="Editor video ringan langsung di browser — potong, crop, teks/subtitle, gabung & transisi, kecepatan & filter. Tanpa upload, tanpa install."
    >
      <CategoryGrid
        groups={[
          {
            items: [
              { name: "Potong Video", desc: "Trim satu bagian, atau buang beberapa bagian sekaligus (cut & stitch).", path: "/video/potong", icon: <Scissors className="w-6 h-6" /> },
              { name: "Crop & Resize", desc: "Pas-kan video ke rasio 1:1, 9:16, 16:9, dan lainnya untuk media sosial.", path: "/video/crop", icon: <Crop className="w-6 h-6" /> },
              { name: "Teks & Subtitle (CC)", desc: "Tambah caption manual — ekspor sebagai .SRT/.VTT ringan atau bakar langsung ke video.", path: "/video/subtitle", icon: <Captions className="w-6 h-6" /> },
              { name: "Gabung & Transisi", desc: "Satukan beberapa klip berurutan dengan transisi Cut atau Crossfade.", path: "/video/gabung", icon: <Layers className="w-6 h-6" /> },
              { name: "Kecepatan & Filter", desc: "Slow-motion/mempercepat video, plus filter warna (grayscale, sepia, vintage, dll).", path: "/video/filter", icon: <Sparkles className="w-6 h-6" /> },
              { name: "Tangkap Thumbnail / Screenshot", desc: "Ambil satu frame video sebagai gambar — cocok untuk cover atau thumbnail.", path: "/video/thumbnail", icon: <Camera className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
