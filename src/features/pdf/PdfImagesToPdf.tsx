import React, { useMemo, useState } from "react";
import { FileImage, Trash2, Loader2, Zap } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const PdfImagesToPdf: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalSizeMb = useMemo(
    () => (files.length ? Math.round((files.reduce((a, f) => a + f.size, 0) / 1024 / 1024) * 10) / 10 : 0),
    [files]
  );

  const addFiles = (incoming: File[]) => {
    setFiles((prev) => [...prev, ...incoming.filter((f) => ["image/jpeg", "image/png", "image/jpg"].includes(f.type))]);
    setInfo(null);
  };
  const removeFile = (i: number) => setFiles(files.filter((_, idx) => idx !== i));

  const handleRun = async () => {
    if (!files.length) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const pdfDoc = await PDFDocument.create();
      for (const file of files) {
        const bytes = new Uint8Array(await fileToArrayBuffer(file));
        const image = file.type === "image/png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const { width, height } = image.scale(1);
        const pg = pdfDoc.addPage([width, height]);
        pg.drawImage(image, { x: 0, y: 0, width, height });
      }
      downloadBlob(new Blob([await pdfDoc.save()], { type: "application/pdf" }), "gamato-images.pdf");
      setInfo(`${files.length} gambar digabung menjadi PDF.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal memproses gambar."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <Dropzone
          onFiles={addFiles}
          accept="image/jpeg,image/png"
          multiple
          label="Drop gambar JPG/PNG di sini"
          sublabel="Bisa pilih beberapa file — urutannya bisa diatur"
          icon={<FileImage className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
        />

        {files.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{files.length} file dipilih</p>
              <span className="text-xs text-slate-400 dark:text-slate-500">Total: {totalSizeMb} MB</span>
            </div>
            <div className="divide-y divide-slate-100">
              {files.map((file, i) => (
                <div key={`${file.name}-${i}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                  <FileImage className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button type="button" onClick={() => removeFile(i)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Btn onClick={handleRun} disabled={isWorking || !files.length} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Jadikan PDF
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<FileImage className="w-5 h-5" />}
        label="Gambar ke PDF"
        desc="JPG/PNG ke PDF"
        points={["JPG/PNG jadi halaman PDF.", "Tiap gambar = 1 halaman."]}
        info={info}
        infoTone={info?.includes("digabung") ? "success" : "error"}
      />
    </div>
  );
};
