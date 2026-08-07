import React, { useState } from "react";
import { BarChart3, FileText, Trash2, Loader2, FileDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { loadPdfDocument, extractPageTextItems, groupIntoLines, lineToCells } from "@/lib/pdfRender";
import { gridToXlsxBlob } from "@/lib/xlsxWriter";
import { Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const PdfToExcel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: File[]) => {
    const pdf = incoming.find((f) => f.type === "application/pdf");
    if (pdf) setFile(pdf);
    setInfo(null);
  };

  const handleRun = async () => {
    if (!file) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const bytes = await fileToArrayBuffer(file);
      const pdf = await loadPdfDocument(bytes);
      const grid: string[][] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const items = await extractPageTextItems(pdf, i);
        const lines = groupIntoLines(items);
        lines.forEach((line) => grid.push(lineToCells(line)));
      }

      if (!grid.length) {
        setInfo("Tidak ada teks yang terdeteksi — kemungkinan PDF ini hasil scan gambar. Coba alat OCR PDF terlebih dahulu.");
        return;
      }

      const base = file.name.replace(/\.pdf$/i, "");
      const blob = await gridToXlsxBlob(grid);
      downloadBlob(blob, `${base}.xlsx`);
      setInfo(`Berhasil dikonversi ke Excel (${grid.length} baris terdeteksi).`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal mengonversi PDF ke Excel."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <Dropzone
          onFiles={addFiles}
          accept="application/pdf"
          multiple={false}
          label="Drop file PDF di sini"
          sublabel="atau klik untuk browse"
          icon={<FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
        />

        {file && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3">
              <FileText className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button type="button" onClick={() => setFile(null)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {info && (
          <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", info.startsWith("Gagal") || info.startsWith("Tidak") ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>
            {info}
          </div>
        )}

        <Btn onClick={handleRun} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Mengekstrak data…
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              Konversi ke Excel
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<BarChart3 className="w-5 h-5" />}
        label="PDF ke Excel"
        desc="Deteksi baris & kolom"
        points={[
          "Kolom dideteksi otomatis dari jarak antar teks — cocok untuk tabel yang rapi.",
          "Untuk tabel kompleks/PDF hasil scan, hasil mungkin perlu dirapikan manual setelah dibuka.",
        ]}
      />
    </div>
  );
};
