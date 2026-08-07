import React, { useState } from "react";
import { Type, FileText, Image as ImageIcon, Trash2, Loader2, Copy, Download } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToArrayBuffer, fileToDataUrl } from "@/lib/file";
import { loadPdfDocument, renderPageToCanvas } from "@/lib/pdfRender";
import { runOcr } from "@/lib/ocr";
import { Btn, Select, Textarea } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const PdfOcr: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState<"ind+eng" | "ind" | "eng">("ind+eng");
  const [resultText, setResultText] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: File[]) => {
    const f = incoming.find((x) => x.type === "application/pdf" || x.type.startsWith("image/"));
    if (f) setFile(f);
    setInfo(null);
    setResultText("");
  };

  const handleRun = async () => {
    if (!file) return;
    setInfo(null);
    setResultText("");
    setIsWorking(true);
    try {
      let combined = "";
      if (file.type === "application/pdf") {
        const bytes = await fileToArrayBuffer(file);
        const pdf = await loadPdfDocument(bytes);
        for (let i = 1; i <= pdf.numPages; i++) {
          setProgressLabel(`Membaca halaman ${i} dari ${pdf.numPages}…`);
          const canvas = await renderPageToCanvas(pdf, i, 2.2);
          const text = await runOcr(canvas, lang);
          combined += `${i > 1 ? "\n\n" : ""}--- Halaman ${i} ---\n${text.trim()}`;
        }
      } else {
        setProgressLabel("Membaca teks dari gambar…");
        const dataUrl = await fileToDataUrl(file);
        combined = await runOcr(dataUrl, lang);
      }
      const trimmed = combined.trim();
      setResultText(trimmed);
      setInfo(trimmed ? "Teks berhasil dibaca." : "Tidak ada teks yang berhasil terbaca dari file ini.");
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal menjalankan OCR. Pastikan koneksi internet aktif (mesin OCR dimuat saat pertama kali dipakai)."));
    } finally {
      setIsWorking(false);
      setProgressLabel(null);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(resultText);
      setInfo("Teks disalin ke clipboard.");
    } catch {
      setInfo("Gagal menyalin teks.");
    }
  };

  const downloadTxt = () => {
    if (!resultText) return;
    downloadBlob(new Blob([resultText], { type: "text/plain;charset=utf-8" }), `${(file?.name || "ocr-result").replace(/\.[^.]+$/, "")}.txt`);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <Dropzone
          onFiles={addFiles}
          accept="application/pdf,image/*"
          multiple={false}
          label="Drop PDF atau gambar dokumen di sini"
          sublabel="Baca teks dari PDF hasil scan atau foto dokumen"
          icon={<Type className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
        />

        {file && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3">
              {file.type === "application/pdf" ? <FileText className="w-5 h-5 text-slate-400 dark:text-slate-500" /> : <ImageIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button type="button" onClick={() => { setFile(null); setResultText(""); setInfo(null); }} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <Select label="Bahasa" value={lang} onChange={(e) => setLang(e.target.value as any)}>
            <option value="ind+eng">Indonesia + Inggris</option>
            <option value="ind">Indonesia</option>
            <option value="eng">Inggris</option>
          </Select>
        </div>

        {progressLabel && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 px-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            {progressLabel}
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
              Menjalankan OCR…
            </>
          ) : (
            <>
              <Type className="w-4 h-4" />
              Baca Teks (OCR)
            </>
          )}
        </Btn>

        {resultText && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Hasil OCR</p>
              <div className="flex gap-2">
                <Btn onClick={copyText} variant="secondary" className="text-xs py-1.5 gap-1.5">
                  <Copy className="w-3.5 h-3.5" /> Salin
                </Btn>
                <Btn onClick={downloadTxt} variant="secondary" className="text-xs py-1.5 gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Unduh .txt
                </Btn>
              </div>
            </div>
            <Textarea rows={12} value={resultText} onChange={(e) => setResultText(e.target.value)} />
          </div>
        )}
      </div>

      <ToolInfoPanel
        icon={<Type className="w-5 h-5" />}
        label="OCR"
        desc="Baca teks dari scan/foto"
        points={[
          "Bekerja untuk PDF hasil scan maupun foto dokumen biasa (JPG/PNG).",
          "Mesin OCR (Tesseract) dimuat otomatis saat pertama kali dipakai — butuh koneksi internet sekali di awal.",
          "Hasil bisa langsung diedit, disalin, atau diunduh sebagai .txt.",
        ]}
      />
    </div>
  );
};
