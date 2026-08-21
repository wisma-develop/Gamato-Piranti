import React, { useMemo, useState } from "react";
import { BookOpen, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { fileToArrayBuffer } from "@/lib/file";
import { Input, Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoPdfPage } from "@/components/ui/GamatoPdfPage";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

interface Meta {
  title: string;
  author: string;
  pageCount: number;
}

export const PdfReader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [pageInput, setPageInput] = useState("1");
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = async (incoming: File[]) => {
    const f = incoming.find((x) => x.type === "application/pdf");
    if (!f) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(f);
    setFile(f);
    setObjectUrl(url);
    setPageInput("1");
    try {
      const pdfDoc = await PDFDocument.load(await fileToArrayBuffer(f), { ignoreEncryption: true });
      setMeta({
        title: pdfDoc.getTitle() || f.name.replace(/\.pdf$/i, ""),
        author: pdfDoc.getAuthor() || "—",
        pageCount: pdfDoc.getPageCount(),
      });
    } catch {
      setMeta({ title: f.name, author: "—", pageCount: 0 });
    }
  };

  const currentPage = useMemo(() => {
    const n = parseInt(pageInput || "1", 10);
    if (!meta || !Number.isFinite(n)) return 1;
    return Math.min(Math.max(1, n), Math.max(1, meta.pageCount));
  }, [pageInput, meta]);

  const goToPage = (n: number) => {
    if (!meta) return;
    setPageInput(String(Math.min(Math.max(1, n), Math.max(1, meta.pageCount))));
  };

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
      <div className="space-y-5">
        {!objectUrl ? (
          <Dropzone
            onFiles={addFiles}
            accept="application/pdf"
            multiple={false}
            label="Drop file PDF di sini"
            sublabel="atau klik untuk browse — dibuka langsung di browser"
            icon={<FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file?.name}</p>
              <div className="flex items-center gap-2 shrink-0">
                {meta && meta.pageCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Input value={pageInput} onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))} className="w-16 py-1.5 text-center" />
                    <span className="text-xs text-slate-400 dark:text-slate-500">/ {meta.pageCount}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(objectUrl);
                    setFile(null);
                    setObjectUrl(null);
                    setMeta(null);
                  }}
                  className="text-sm text-red-500 font-semibold hover:text-red-700"
                >
                  Tutup
                </button>
              </div>
            </div>
            <GamatoPdfPage src={objectUrl} page={currentPage} height={640} />
            {meta && meta.pageCount > 1 && (
              <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-slate-100 dark:border-slate-800">
                <Btn variant="secondary" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="gap-1.5 px-3 py-1.5">
                  <ChevronLeft className="w-4 h-4" /> Sebelumnya
                </Btn>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Halaman {currentPage} / {meta.pageCount}</span>
                <Btn variant="secondary" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= meta.pageCount} className="gap-1.5 px-3 py-1.5">
                  Berikutnya <ChevronRight className="w-4 h-4" />
                </Btn>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {meta && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Info Dokumen</p>
            <div className="text-sm space-y-2">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Judul</p>
                <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{meta.title}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Penulis</p>
                <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{meta.author}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Jumlah Halaman</p>
                <p className="font-semibold text-slate-700 dark:text-slate-200">{meta.pageCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Ukuran File</p>
                <p className="font-semibold text-slate-700 dark:text-slate-200">{file ? (file.size / 1024 / 1024).toFixed(2) : 0} MB</p>
              </div>
            </div>
          </div>
        )}

        <ToolInfoPanel
          icon={<BookOpen className="w-5 h-5" />}
          label="PDF Reader"
          desc="Baca langsung di browser"
          points={["Dirender native oleh engine Gamato Piranti (pdf.js) langsung ke kanvas — cepat & tanpa upload ke server, tanpa viewer bawaan browser.", "Lompat ke halaman tertentu lewat kolom nomor halaman atau tombol navigasi."]}
        />
      </div>
    </div>
  );
};
