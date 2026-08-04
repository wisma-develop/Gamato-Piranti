import { Award, MessageCircle } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function SpesialCategory() {
  return (
    <PageShell
      badge="Spesial"
      title="Spesial"
      subtitle="Fitur andalan Gamato Piranti — generator sertifikat massal full custom dan WA link."
    >
      <CategoryGrid
        groups={[
          {
            items: [
              { name: "Sertifikat & Piagam", desc: "Generator massal, full custom — template, font, dan posisi bebas.", path: "/special/sertifikat", icon: <Award className="w-6 h-6" /> },
              { name: "WA Link", desc: "Buka chat WhatsApp langsung tanpa perlu menyimpan kontak.", path: "/special/wa-link", icon: <MessageCircle className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
