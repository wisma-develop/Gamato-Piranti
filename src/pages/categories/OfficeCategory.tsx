import { BookOpen, Table2, Presentation, Workflow } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function OfficeCategory() {
  return (
    <PageShell
      badge="Office Tools"
      title="Office Tools"
      subtitle="Doc Studio, Sheet Studio, Slide Studio, dan Diagram & Rumus Studio — editor dokumen, spreadsheet, presentasi, diagram, dan rumus, langsung di browser tanpa upload ke server."
    >
      <CategoryGrid
        groups={[
          {
            section: "Office Tools",
            items: [
              {
                name: "Doc Studio",
                desc: "Editor dokumen full rich-text — heading, list, tabel, gambar, dan ekspor .docx / .pdf / .txt.",
                path: "/office/doc-studio",
                icon: <BookOpen className="w-6 h-6" />,
              },
              {
                name: "Sheet Studio",
                desc: "Spreadsheet dengan rumus (SUM, AVERAGE, IF, dll), format sel, dan ekspor .xlsx / .csv / .pdf.",
                path: "/office/sheet-studio",
                icon: <Table2 className="w-6 h-6" />,
                badge: "Baru",
              },
              {
                name: "Slide Studio",
                desc: "Editor presentasi — teks, bentuk, gambar, banyak slide, mode tampilkan layar penuh, ekspor .pdf & gambar.",
                path: "/office/slide-studio",
                icon: <Presentation className="w-6 h-6" />,
                badge: "Baru",
              },
              {
                name: "Diagram & Rumus Studio",
                desc: "Buat & preview flowchart, struktur organisasi, chart, hingga rumus matematika (LaTeX).",
                path: "/office/diagram-rumus",
                icon: <Workflow className="w-6 h-6" />,
              },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
