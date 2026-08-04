import {
  Code2, ListOrdered, Radio, Mail, Calculator, TrendingUp, BarChart3,
  KeyRound, Eraser,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function UtilitasCategory() {
  return (
    <PageShell
      badge="Utilitas"
      title="Rak Utilitas"
      subtitle="9 alat kecil untuk kerja harian — masing-masing alat punya halaman sendiri, tanpa gangguan tab lain."
    >
      <CategoryGrid
        groups={[
          {
            items: [
              { name: "JSON & Base64", desc: "Format JSON rapi, serta encode/decode Base64.", path: "/utility/json-base64", icon: <Code2 className="w-6 h-6" /> },
              { name: "Bulk Teks", desc: "Manipulasi daftar teks — hapus duplikat, sort, acak, nomori.", path: "/utility/bulk-teks", icon: <ListOrdered className="w-6 h-6" /> },
              { name: "Link Media", desc: "Analisis link video/file untuk unduhan langsung.", path: "/utility/link-media", icon: <Radio className="w-6 h-6" /> },
              { name: "Alias Email", desc: "Buat alamat email alternatif untuk pendaftaran.", path: "/utility/alias-email", icon: <Mail className="w-6 h-6" /> },
              { name: "Kalkulator Pajak", desc: "Hitung PPN eksklusif maupun inklusif.", path: "/utility/kalkulator-pajak", icon: <Calculator className="w-6 h-6" /> },
              { name: "Kalkulator Bunga", desc: "Hitung bunga sederhana & majemuk.", path: "/utility/kalkulator-bunga", icon: <TrendingUp className="w-6 h-6" /> },
              { name: "Statistik", desc: "Mean, median, min, max, dan standar deviasi.", path: "/utility/statistik", icon: <BarChart3 className="w-6 h-6" /> },
              { name: "Password & Token", desc: "Generator password & token berbasis Web Crypto API.", path: "/utility/password-token", icon: <KeyRound className="w-6 h-6" /> },
              { name: "Hapus Metadata", desc: "Hapus EXIF/GPS dari gambar via re-encode canvas.", path: "/utility/hapus-metadata", icon: <Eraser className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
