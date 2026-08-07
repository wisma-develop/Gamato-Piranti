import React, { useState } from "react";
import { FileDown, FileText, Trash2, Loader2, Zap } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { compressPdf, type CompressLevel } from "@/lib/pdfCompress";
import { Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export const PdfCompress: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [compressLevel, setCompressLevel] = useState<CompressLevel>("medium");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [result, setResult] = useState<{ original: number; compressed: number; images: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: File[]) => {
    const pdf = incoming.find((f) => f.type === "application/pdf");
    if (pdf) setFile(pdf);
    setInfo(null);
    setResult(null);
  };

  const handleRun = async () => {
    if (!file) return;
    setInfo(null);
    setResult(null);
    setIsWorking(true);
    try {
      const { bytes, originalSize, compressedSize, imagesProcessed } = await compressPdf(await fileToArrayBuffer(file), compressLevel);
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), `gamato-compressed-${compressLevel}.pdf`);
      setResult({ original: originalSize, compressed: compressedSize, images: imagesProcessed });
      const savedPct = Math.max(0, Math.round((1 - compressedSize / originalSize) * 100));
      setInfo(
        imagesProcessed > 0
          ? `Berhasil dikompresi ${savedPct}% (${imagesProcessed} gambar dioptimasi).`
          : savedPct > 0
          ? `Berhasil dikompresi ${savedPct}% (optimasi struktur, tidak ada gambar JPEG untuk dipadatkan).`
          : "PDF sudah cukup padat — tidak banyak yang bisa dihemat lagi."
      );
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
                <p className="text-xs text-slate-400 dark:text-slate-500">{formatSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setInfo(null);
                }}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
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
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {compressLevel === "low" && "Kualitas gambar tetap tinggi, penghematan ukuran moderat."}
            {compressLevel === "medium" && "Keseimbangan terbaik antara kualitas dan ukuran file."}
            {compressLevel === "high" && "Penghematan ukuran maksimal, gambar dikompres & diperkecil lebih agresif."}
          </p>
        </div>

        {result && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <div className="text-center flex-1">
                <p className="text-slate-400 dark:text-slate-500 text-xs mb-1">Sebelum</p>
                <p className="font-bold text-slate-700 dark:text-slate-200">{formatSize(result.original)}</p>
              </div>
              <div className="text-indigo-500 font-bold text-lg px-3">→</div>
              <div className="text-center flex-1">
                <p className="text-slate-400 dark:text-slate-500 text-xs mb-1">Sesudah</p>
                <p className="font-bold text-green-600 dark:text-green-400">{formatSize(result.compressed)}</p>
              </div>
            </div>
          </div>
        )}

        <Btn onClick={handleRun} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Mengompres gambar &amp; struktur PDF…
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
        points={[
          "Gambar JPEG di dalam PDF diperkecil & dikompres ulang — penghemat ukuran terbesar.",
          "Struktur PDF dipadatkan (object streams) untuk file berbasis teks.",
          "Gambar non-JPEG (PNG mentah) dibiarkan apa adanya agar tidak merusak kualitas.",
        ]}
        info={info}
        infoTone={info?.startsWith("Gagal") ? "error" : "success"}
      />
    </div>
  );
};
