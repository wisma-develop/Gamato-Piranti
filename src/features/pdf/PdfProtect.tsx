import React, { useState } from "react";
import { ShieldCheck, FileText, Trash2, Loader2, Zap } from "lucide-react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { loadPdfDocument, renderPageToCanvas } from "@/lib/pdfRender";
import { canvasToBlob } from "@/lib/canvas";
import { Btn, Select, Input } from "@/components/ui/primitives";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const PdfProtect: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(2.2);
  const [addWatermark, setAddWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState("DILARANG MENYALIN");
  const [isWorking, setIsWorking] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
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
      const srcPdf = await loadPdfDocument(bytes);
      const outDoc = await PDFDocument.create();
      const font = addWatermark ? await outDoc.embedFont(StandardFonts.HelveticaBold) : null;

      for (let i = 1; i <= srcPdf.numPages; i++) {
        setProgressLabel(`Mengunci halaman ${i} dari ${srcPdf.numPages}…`);
        const canvas = await renderPageToCanvas(srcPdf, i, quality);
        const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
        const imgBytes = new Uint8Array(await blob.arrayBuffer());
        const embedded = await outDoc.embedJpg(imgBytes);
        const page = outDoc.addPage([embedded.width, embedded.height]);
        page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });

        if (addWatermark && watermarkText.trim() && font) {
          const size = embedded.width * 0.07;
          const textWidth = font.widthOfTextAtSize(watermarkText, size);
          page.drawText(watermarkText, {
            x: (embedded.width - textWidth) / 2,
            y: embedded.height / 2,
            size,
            font,
            color: rgb(0.85, 0.15, 0.15),
            opacity: 0.28,
            rotate: degrees(35),
          });
        }
      }

      const outBytes = await outDoc.save();
      downloadBlob(new Blob([outBytes], { type: "application/pdf" }), "gamato-protected.pdf");
      setInfo(`Berhasil dikunci — ${srcPdf.numPages} halaman diubah menjadi gambar (teks tidak lagi bisa disalin/diedit langsung).`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal mengunci PDF."));
    } finally {
      setIsWorking(false);
      setProgressLabel(null);
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

        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <b>Bukan proteksi password.</b> Alat ini mengubah setiap halaman jadi gambar, sehingga teks tidak bisa disalin (copy-paste) atau diedit langsung — cocok untuk membagikan dokumen tanpa risiko orang lain menjiplak isinya. PDF hasilnya tetap bisa dibuka semua orang tanpa password.
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <Select label="Kualitas Render" value={quality} onChange={(e) => setQuality(parseFloat(e.target.value))}>
            <option value={1.5}>Standar</option>
            <option value={2.2}>Tinggi</option>
            <option value={3}>Sangat Tinggi</option>
          </Select>
          <GamatoCheckbox checked={addWatermark} onChange={setAddWatermark} label="Tambahkan watermark peringatan" />
          {addWatermark && <Input label="Teks Watermark" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} />}
        </div>

        {progressLabel && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 px-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            {progressLabel}
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
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Kunci Konten PDF
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<ShieldCheck className="w-5 h-5" />}
        label="Protect PDF"
        desc="Kunci dari salin/edit"
        points={[
          "Mengunci konten dengan mengubah setiap halaman jadi gambar flat.",
          "Bukan enkripsi/password — untuk itu, alat browser-native seperti ini belum mendukungnya secara aman.",
        ]}
      />
    </div>
  );
};
