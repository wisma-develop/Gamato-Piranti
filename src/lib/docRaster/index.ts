// Pintu masuk "Dokumen ke Gambar": membuka PDF / Word / PowerPoint / Excel / CSV / teks / Markdown / RTF
// dan menyediakan halaman yang bisa dirender ke kanvas pada DPI pilihan.

import { loadPdfDocument, renderPageToCanvas } from "@/lib/pdfRender";
import { rasterizePage, type RasterDoc } from "./core";
import { renderDocx } from "./docx";
import { renderPptx } from "./pptx";
import { renderCsv, renderXlsx } from "./xlsx";
import { renderTextDocument } from "./text";

export type DocKind = "pdf" | "word" | "ppt" | "excel" | "teks";
export type DocKindOrAuto = DocKind | "auto";

export const KIND_EXTS: Record<DocKind, string[]> = {
  pdf: ["pdf"],
  word: ["docx"],
  ppt: ["pptx"],
  excel: ["xlsx", "xlsm", "csv", "tsv"],
  teks: ["txt", "md", "markdown", "rtf", "json", "log", "xml", "yml", "yaml", "ini", "html", "htm", "js", "ts", "css", "py", "java", "c", "cpp", "sql", "sh", "php"],
};

export const KIND_LABEL: Record<DocKind, string> = { pdf: "PDF", word: "Word (.docx)", ppt: "PowerPoint (.pptx)", excel: "Excel / CSV", teks: "Teks / Markdown / RTF" };

export function detectKind(file: File): DocKind | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  for (const k of Object.keys(KIND_EXTS) as DocKind[]) if (KIND_EXTS[k].includes(ext)) return k;
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("text/")) return "teks";
  return null;
}

export interface DocSession {
  kind: DocKind;
  count: number;
  /** ukuran halaman dalam poin (1 pt = 1/72 inci) */
  size(i: number): { w: number; h: number };
  /** render halaman i (0-based) pada DPI tertentu */
  render(i: number, dpi: number): Promise<HTMLCanvasElement>;
  notes: string[];
  dispose(): void;
}

function fromRaster(kind: DocKind, doc: RasterDoc): DocSession {
  return {
    kind,
    count: doc.pages.length,
    size: (i) => ({ w: doc.pages[i].w, h: doc.pages[i].h }),
    render: async (i, dpi) => rasterizePage(doc.pages[i], dpi / 72),
    notes: doc.notes,
    dispose: () => {
      for (const p of doc.pages) p.ops.length = 0;
    },
  };
}

export async function openDocument(file: File, kindIn: DocKindOrAuto, opts: { gridlines?: boolean } = {}): Promise<DocSession> {
  const kind = kindIn === "auto" ? detectKind(file) : kindIn;
  if (!kind) throw new Error("Jenis file tidak dikenali. Gunakan PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx/.csv), atau teks/Markdown/RTF.");
  if (kind === "pdf") {
    let pdf: any;
    try {
      pdf = await loadPdfDocument(await file.arrayBuffer());
    } catch (err: any) {
      if (err?.name === "PasswordException") throw new Error("PDF ini dilindungi kata sandi. Buka kuncinya dulu (menu PDF → Unlock PDF).");
      throw new Error("File PDF tidak dapat dibaca. Pastikan file tidak rusak.");
    }
    const sizes: { w: number; h: number }[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i);
      const v = p.getViewport({ scale: 1 });
      sizes.push({ w: v.width, h: v.height });
    }
    return {
      kind,
      count: pdf.numPages,
      size: (i) => sizes[i],
      render: (i, dpi) => renderPageToCanvas(pdf, i + 1, dpi / 72),
      notes: [],
      dispose: () => {
        try { pdf.destroy(); } catch { /* abaikan */ }
      },
    };
  }
  try {
    if (kind === "word") return fromRaster(kind, await renderDocx(file));
    if (kind === "ppt") return fromRaster(kind, await renderPptx(file));
    if (kind === "excel") return fromRaster(kind, /\.(csv|tsv)$/i.test(file.name) ? await renderCsv(file, opts) : await renderXlsx(file, opts));
    return fromRaster(kind, await renderTextDocument(file));
  } catch (err: any) {
    const msg = err?.message || "";
    if (/zip|central directory|end of central/i.test(msg)) throw new Error(`File tampak rusak atau bukan format ${KIND_LABEL[kind]} yang valid (file .doc/.ppt/.xls lama belum didukung — simpan ulang sebagai .docx/.pptx/.xlsx).`);
    throw err;
  }
}
