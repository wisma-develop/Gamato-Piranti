import React, { useState } from "react";
import { FileText, Trash2, Loader2, FileDown } from "lucide-react";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { loadPdfDocument, extractPageTextItems, groupIntoLines, joinLineText } from "@/lib/pdfRender";
import type { BlockModel } from "@/features/docs/richtext/parseEditor";
import { exportDocxFromBlocks } from "@/features/docs/richtext/exportDocx";
import { Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

export const PdfToWord: React.FC = () => {
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
      const blocks: BlockModel[] = [];
      let hasText = false;

      for (let i = 1; i <= pdf.numPages; i++) {
        const items = await extractPageTextItems(pdf, i);
        const lines = groupIntoLines(items);
        if (lines.length) hasText = true;
        lines.forEach((line) => {
          blocks.push({ kind: "text", align: "left", runs: [{ text: joinLineText(line) }] });
        });
        if (i < pdf.numPages) blocks.push({ kind: "text", align: "left", runs: [{ text: "" }] });
      }

      if (!hasText) {
        setInfo("Tidak ada teks yang terdeteksi — kemungkinan PDF ini hasil scan gambar. Coba alat OCR PDF untuk membaca teksnya.");
        return;
      }

      const base = file.name.replace(/\.pdf$/i, "");
      const blob = await exportDocxFromBlocks(blocks, base);
      downloadBlob(blob, `${base}.docx`);
      setInfo(`Berhasil dikonversi ke Word (${pdf.numPages} halaman).`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal mengonversi PDF ke Word."));
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

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") || info.startsWith("Tidak") ? "warning" : "success"} />}

        <Btn onClick={handleRun} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Mengekstrak teks…
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              Konversi ke Word
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<FileText className="w-5 h-5" />}
        label="PDF ke Word"
        desc="Ekstrak teks asli PDF"
        points={[
          "Setiap baris teks di PDF menjadi satu paragraf di Word.",
          "Bekerja untuk PDF berbasis teks asli — untuk PDF hasil scan, gunakan alat OCR PDF terlebih dahulu.",
        ]}
      />
    </div>
  );
};
