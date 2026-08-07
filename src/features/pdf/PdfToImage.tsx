import React, { useState } from "react";
import { FileImage, FileText, Trash2, Loader2, Download } from "lucide-react";
import JSZip from "jszip";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { loadPdfDocument, renderPageToCanvas } from "@/lib/pdfRender";
import { canvasToBlob } from "@/lib/canvas";
import { Btn, Select } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const PdfToImage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [scale, setScale] = useState(2);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [isWorking, setIsWorking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
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
    setProgress(null);
    try {
      const bytes = await fileToArrayBuffer(file);
      const pdf = await loadPdfDocument(bytes);
      const total = pdf.numPages;
      const base = file.name.replace(/\.pdf$/i, "");
      const mime = format === "png" ? "image/png" : "image/jpeg";
      const ext = format === "png" ? "png" : "jpg";

      if (total === 1) {
        const canvas = await renderPageToCanvas(pdf, 1, scale);
        const blob = await canvasToBlob(canvas, mime, format === "jpeg" ? 0.92 : undefined);
        downloadBlob(blob, `${base}.${ext}`);
      } else {
        const zip = new JSZip();
        for (let i = 1; i <= total; i++) {
          setProgress({ done: i - 1, total });
          const canvas = await renderPageToCanvas(pdf, i, scale);
          const blob = await canvasToBlob(canvas, mime, format === "jpeg" ? 0.92 : undefined);
          zip.file(`${base}-hal-${String(i).padStart(2, "0")}.${ext}`, blob);
        }
        setProgress({ done: total, total });
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${base}-gambar.zip`);
      }
      setInfo(`${total} halaman berhasil dijadikan gambar.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal mengonversi PDF ke gambar."));
    } finally {
      setIsWorking(false);
      setProgress(null);
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

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <Select label="Kualitas" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))}>
            <option value={1}>Standar (1x)</option>
            <option value={2}>Tinggi (2x)</option>
            <option value={3}>Sangat Tinggi (3x)</option>
            <option value={4}>Maksimal (4x)</option>
          </Select>
          <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value as any)}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </Select>
          <p className="text-xs text-slate-400 dark:text-slate-500">PDF 1 halaman diunduh langsung sebagai gambar; PDF banyak halaman diunduh sebagai ZIP.</p>
        </div>

        {progress && (
          <div className="text-sm text-slate-500 dark:text-slate-400 px-1">
            Merender halaman {progress.done + 1} dari {progress.total}…
          </div>
        )}

        {info && (
          <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", info.startsWith("Gagal") ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>
            {info}
          </div>
        )}

        <Btn onClick={handleRun} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Merender…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Konversi ke Gambar
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<FileImage className="w-5 h-5" />}
        label="PDF ke Gambar"
        desc="Render setiap halaman"
        points={["Setiap halaman dirender penuh sebagai gambar — termasuk PDF hasil scan.", "Pilih kualitas lebih tinggi untuk hasil yang lebih tajam (ukuran file lebih besar)."]}
      />
    </div>
  );
};
