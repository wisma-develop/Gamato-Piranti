import React, { useState } from "react";
import { FileDown, FileText, Trash2, Loader2, Zap } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const PdfCompress: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [compressLevel, setCompressLevel] = useState<"low" | "medium" | "high">("medium");
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
      const doc = await PDFDocument.load(await fileToArrayBuffer(file), { updateMetadata: true });
      doc.setTitle(`Compressed by Gamato Piranti (${compressLevel})`);
      downloadBlob(new Blob([await doc.save({ useObjectStreams: true })], { type: "application/pdf" }), `gamato-compressed-${compressLevel}.pdf`);
      setInfo(`PDF dikompresi (level: ${compressLevel}).`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal memproses PDF."));
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Tingkat Kompresi</p>
          <div className="grid grid-cols-3 gap-2">
            {(["low", "medium", "high"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setCompressLevel(l)}
                className={cn(
                  "py-2.5 rounded-xl text-sm font-semibold border-2 transition-all capitalize",
                  compressLevel === l
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                )}
              >
                {l === "low" ? "Ringan" : l === "medium" ? "Sedang" : "Tinggi"}
              </button>
            ))}
          </div>
        </div>

        <Btn onClick={handleRun} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Kompres PDF
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<FileDown className="w-5 h-5" />}
        label="Kompres PDF"
        desc="Kurangi ukuran file"
        points={["Optimasi struktur PDF tanpa mengubah isi.", "Tiga level kompresi tersedia."]}
        info={info}
        infoTone={info?.includes("dikompresi") ? "success" : "error"}
      />
    </div>
  );
};
