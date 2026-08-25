import React, { useState } from "react";
import { KeyRound, FileText, Trash2, Loader2, Zap } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

export const PdfUnlock: React.FC = () => {
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
      const pdfDoc = await PDFDocument.load(await fileToArrayBuffer(file), { ignoreEncryption: true });
      // Re-saving without ever re-applying an encryption dictionary strips
      // any permission/print/copy restrictions the file was carrying.
      const bytes = await pdfDoc.save();
      downloadBlob(new Blob([bytes], { type: "application/pdf" }), "gamato-unlocked.pdf");
      setInfo("Proteksi/batasan pada PDF berhasil dihapus.");
    } catch (err: any) {
      setInfo(
        "Gagal membuka proteksi. File ini kemungkinan memerlukan password untuk DIBUKA (bukan hanya dibatasi izinnya) — jenis proteksi ini belum bisa dibongkar oleh alat browser-native seperti Gamato Piranti."
      );
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

        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Alat ini hanya bekerja untuk PDF yang <b>dibatasi izinnya</b> (mis. cetak/copy dinonaktifkan) tanpa password pembuka. PDF yang butuh password untuk <b>dibuka</b> tidak bisa dibongkar oleh alat browser-native.
        </div>

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={handleRun} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Buka Proteksi
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<KeyRound className="w-5 h-5" />}
        label="Unlock PDF"
        desc="Hapus batasan izin"
        points={["Menghapus batasan cetak/salin/edit dari PDF yang tidak butuh password pembuka.", "Tidak mendekripsi PDF yang benar-benar butuh password untuk dibuka."]}
      />
    </div>
  );
};
