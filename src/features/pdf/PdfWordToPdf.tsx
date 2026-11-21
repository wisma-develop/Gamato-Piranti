import React, { useState } from "react";
import { FileText, Trash2, Loader2, FileDown } from "lucide-react";
import { downloadBlob } from "@/lib/file";
import { readDocxBlocks } from "@/lib/officeReaders";
import { exportPdfFromBlocks } from "@/features/docs/richtext/exportPdf";
import { Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { msgStarts, tr } from "@/i18n";

export const PdfWordToPdf: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: File[]) => {
    const f = incoming.find((x) => x.name.toLowerCase().endsWith(".docx"));
    if (f) setFile(f);
    else setInfo(tr("Pilih file dengan format .docx."));
  };

  const handleRun = async () => {
    if (!file) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const blocks = await readDocxBlocks(file);
      const blob = await exportPdfFromBlocks(blocks, file.name.replace(/\.docx$/i, ""));
      downloadBlob(blob, `${file.name.replace(/\.docx$/i, "")}.pdf`);
      setInfo(tr("Berhasil dikonversi ke PDF."));
    } catch (err: any) {
      setInfo("" + (err?.message || tr("Gagal mengonversi file. Pastikan file .docx tidak rusak.")));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <Dropzone
          onFiles={addFiles}
          accept=".docx"
          multiple={false}
          label={tr("Drop file Word (.docx) di sini")}
          sublabel={tr("atau klik untuk browse")}
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
                <p className="text-xs text-slate-400 dark:text-slate-500">{tr("{0} MB", (file.size / 1024 / 1024).toFixed(2))}</p>
              </div>
              <button type="button" onClick={() => setFile(null)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {info && <GamatoInlineAlert message={info} tone={msgStarts(info, "Gagal") || msgStarts(info, "Pilih") ? "error" : "success"} />}

        <Btn onClick={handleRun} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {tr("Mengonversi…")}
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              {tr("Konversi ke PDF")}
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<FileText className="w-5 h-5" />}
        label={tr("Word ke PDF")}
        desc={tr("Konversi .docx → .pdf")}
        points={[
          tr("Teks, bold/italic/underline, dan perataan paragraf dipertahankan."),
          tr("Tabel & gambar kompleks di dalam Word saat ini belum didukung penuh."),
        ]}
      />
    </div>
  );
};
