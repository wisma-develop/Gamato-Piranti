import { Award, MessageCircle, Receipt, FileSpreadsheet, ShoppingBag, IdCard } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function SpesialCategory() {
  return (
    <PageShell
      badge="Spesial"
      title="Spesial"
      subtitle="Fitur andalan Gamato Piranti — dokumen bisnis profesional, generator sertifikat massal, dan WA link."
    >
      <CategoryGrid
        groups={[
          {
            section: "Dokumen Bisnis",
            items: [
              { name: "Kwitansi", desc: "Kwitansi pembayaran profesional dengan logo custom — export PNG & PDF, siap cetak.", path: "/special/kwitansi", icon: <Receipt className="w-6 h-6" /> },
              { name: "Invoice", desc: "Invoice profesional dengan item dinamis, logo custom, diskon & pajak — export PNG & PDF.", path: "/special/invoice", icon: <FileSpreadsheet className="w-6 h-6" /> },
              { name: "Struk / Nota", desc: "Struk kasir custom dengan logo — export PNG & PDF, cetak langsung ke printer USB/Bluetooth.", path: "/special/struk", icon: <ShoppingBag className="w-6 h-6" /> },
              { name: "Kartu Nama", desc: "Kartu nama profesional dengan logo custom — export PNG & PDF, siap cetak.", path: "/special/kartu-nama", icon: <IdCard className="w-6 h-6" /> },
            ],
          },
          {
            section: "Lainnya",
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
