import {
  Code2, ListOrdered, Radio, Mail, BarChart3,
  KeyRound, Calculator, Languages, AppWindow, Workflow, RefreshCw,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function UtilitasCategory() {
  return (
    <PageShell
      badge="Utilitas"
      title="Rak Utilitas"
      subtitle="Alat kecil untuk kerja harian — masing-masing alat punya halaman sendiri, tanpa gangguan tab lain."
    >
      <CategoryGrid
        groups={[
          {
            section: "Konversi",
            items: [
              {
                name: "Universal Converter",
                desc: "Ubah file/data ke format lain — gambar, dokumen, spreadsheet, data terstruktur (JSON/CSV/XML/YAML), audio, video, dan ZIP. Puluhan pasangan format didukung.",
                path: "/utility/convert",
                icon: <RefreshCw className="w-6 h-6" />,
                badge: "Baru",
              },
            ],
          },
          {
            section: "Kalkulator",
            items: [
              {
                name: "Kalkulator",
                desc: "Satu tempat untuk semua kalkulator: standar, pajak, bunga, investasi, cicilan/hutang, rumus, hingga HPP/COGS.",
                path: "/utility/kalkulator",
                icon: <Calculator className="w-6 h-6" />,
                badge: "8 Mode",
              },
            ],
          },
          {
            section: "Bahasa & Konten",
            items: [
              { name: "Kamus Dunia", desc: "Cari arti kata & terjemahkan kalimat lintas puluhan bahasa dunia.", path: "/utility/kamus-dunia", icon: <Languages className="w-6 h-6" /> },
              { name: "HTML Preview", desc: "Tulis HTML/CSS/JS, lihat hasilnya langsung secara real-time.", path: "/utility/html-preview", icon: <AppWindow className="w-6 h-6" /> },
              { name: "Diagram & Rumus Studio", desc: "Buat & preview flowchart, struktur, chart, hingga rumus matematika (LaTeX).", path: "/utility/diagram-rumus", icon: <Workflow className="w-6 h-6" /> },
            ],
          },
          {
            section: "Data & Teks",
            items: [
              { name: "JSON & Base64", desc: "Format JSON rapi, serta encode/decode Base64.", path: "/utility/json-base64", icon: <Code2 className="w-6 h-6" /> },
              { name: "Bulk Teks", desc: "Manipulasi daftar teks — hapus duplikat, sort, acak, nomori.", path: "/utility/bulk-teks", icon: <ListOrdered className="w-6 h-6" /> },
              { name: "Statistik", desc: "Mean, median, min, max, dan standar deviasi.", path: "/utility/statistik", icon: <BarChart3 className="w-6 h-6" /> },
            ],
          },
          {
            section: "Lainnya",
            items: [
              { name: "Link Media", desc: "Analisis link video/file untuk unduhan langsung.", path: "/utility/link-media", icon: <Radio className="w-6 h-6" /> },
              { name: "Alias Email", desc: "Buat alamat email alternatif untuk pendaftaran.", path: "/utility/alias-email", icon: <Mail className="w-6 h-6" /> },
              { name: "Password & Token", desc: "Generator password & token berbasis Web Crypto API.", path: "/utility/password-token", icon: <KeyRound className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
