import { BookOpen, Table2, Presentation, Workflow } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";
import { tr } from "@/i18n";

export default function OfficeCategory() {
  return (
    <PageShell
      badge={tr("Office Tools")}
      title={tr("Office Tools")}
      subtitle={tr("Doc Studio, Sheet Studio, Slide Studio, dan Diagram & Rumus Studio — editor dokumen, spreadsheet, presentasi, diagram, dan rumus, langsung di browser tanpa upload ke server.")}
    >
      <CategoryGrid
        groups={[
          {
            section: tr("Office Tools"),
            items: [
              {
                name: tr("Doc Studio"),
                desc: tr("Editor dokumen full rich-text — heading, list, tabel, gambar, dan ekspor .docx / .pdf / .txt."),
                path: "/office/doc-studio",
                icon: <BookOpen className="w-6 h-6" />,
              },
              {
                name: tr("Sheet Studio"),
                desc: tr("Spreadsheet dengan rumus (SUM, AVERAGE, IF, dll), format sel, dan ekspor .xlsx / .csv / .pdf."),
                path: "/office/sheet-studio",
                icon: <Table2 className="w-6 h-6" />,
                badge: tr("Baru"),
              },
              {
                name: tr("Slide Studio"),
                desc: tr("Editor presentasi — teks, bentuk, gambar, banyak slide, mode tampilkan layar penuh, ekspor .pdf & gambar."),
                path: "/office/slide-studio",
                icon: <Presentation className="w-6 h-6" />,
                badge: tr("Baru"),
              },
              {
                name: tr("Diagram & Rumus Studio"),
                desc: tr("Buat & preview flowchart, struktur organisasi, chart, hingga rumus matematika (LaTeX)."),
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
