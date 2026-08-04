import { FileDown, ArrowLeftRight, Wand2, RotateCw } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function GambarCategory() {
  return (
    <PageShell
      badge="Gambar"
      title="Gambar"
      subtitle="Image Lab — kompres, ubah ukuran, konversi format, dan putar gambar langsung di perangkatmu."
    >
      <CategoryGrid
        groups={[
          {
            items: [
              { name: "Kompres Gambar", desc: "Kurangi ukuran file gambar tanpa mengubah dimensi.", path: "/image/kompres", icon: <FileDown className="w-6 h-6" /> },
              { name: "Ubah Ukuran", desc: "Ubah dimensi gambar dengan rasio tetap terjaga.", path: "/image/resize", icon: <ArrowLeftRight className="w-6 h-6" /> },
              { name: "Konversi Format", desc: "Konversi antar format JPEG, PNG, dan WEBP.", path: "/image/konversi", icon: <Wand2 className="w-6 h-6" /> },
              { name: "Putar Gambar", desc: "Putar foto yang miring atau terbalik.", path: "/image/putar", icon: <RotateCw className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
