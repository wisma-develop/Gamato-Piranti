import React, { useState } from "react";
import { FileX, FileText, Trash2, Loader2, Zap } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { parsePageSpec } from "@/lib/pdf";
import { Input, Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { tr } from "@/i18n";

export const PdfDeletePages: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pageSpec, setPageSpec] = useState("1-3");
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
      const src = await PDFDocument.load(await fileToArrayBuffer(file));
      const total = src.getPageCount();
      const toRemove = new Set(parsePageSpec(pageSpec, total));
      const keep = Array.from({ length: total }, (_, i) => i).filter((i) => !toRemove.has(i));
      const doc = await PDFDocument.create();
      (await doc.copyPages(src, keep)).forEach((p) => doc.addPage(p));
      await stampGamatoBranding(doc);
      downloadBlob(new Blob([await doc.save()], { type: "application/pdf" }), "gamato-clean.pdf");
      setInfo(tr("{0} halaman dihapus. Sisa {1} halaman.", toRemove.size, keep.length));
    } catch (err: any) {
      setInfo("" + (err?.message || tr("Gagal memproses PDF.")));
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
          label={tr("Drop file PDF di sini")}
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
          <Input label={tr("Rentang Halaman")} value={pageSpec} onChange={(e) => setPageSpec(e.target.value)} placeholder={tr("contoh: 1-3,5,8-9")} />
          <p className="text-xs text-slate-400 dark:text-slate-500">{tr("Gunakan koma untuk memisah, tanda minus untuk rentang. Halaman mulai dari 1.")}</p>
        </div>

        <Btn onClick={handleRun} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {tr("Memproses…")}
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              {tr("Hapus Halaman")}
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<FileX className="w-5 h-5" />}
        label={tr("Hapus Halaman")}
        desc={tr("Buang halaman")}
        points={[tr("Hapus halaman yang tidak dibutuhkan."), tr("Sisa halaman tetap utuh.")]}
        info={info}
        infoTone={info?.includes("dihapus") ? "success" : "error"}
      />
    </div>
  );
};
