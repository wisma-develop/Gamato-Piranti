import React, { useState } from "react";
import { Eraser, Image as ImageIcon } from "lucide-react";
import { sanitizeFileName } from "@/utils/sanitize";
import { fileToDataUrl, downloadBlob } from "@/lib/file";
import { Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

export const ImageMetadataRemover: React.FC = () => {
  const [metaFiles, setMetaFiles] = useState<File[]>([]);
  const [metaInfo, setMetaInfo] = useState<string | null>(null);

  const runMetaClean = async () => {
    if (!metaFiles.length) return;
    setMetaInfo(null);
    try {
      for (const file of metaFiles) {
        const dataUrl = await fileToDataUrl(file);
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej();
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        let mime = file.type?.startsWith("image/") ? file.type : "image/png";
        if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) mime = "image/png";
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), mime, mime === "image/jpeg" ? 0.92 : undefined));
        if (!blob) continue;
        const base = sanitizeFileName(file.name.replace(/\.[^.]+$/, "")) || "image";
        const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
        downloadBlob(blob, `${base}-clean.${ext}`);
      }
      setMetaInfo(`${metaFiles.length} gambar dibersihkan dari metadata.`);
    } catch (err: any) {
      setMetaInfo("" + (err?.message || "Gagal."));
    }
  };

  return (
    <PanelCard title="Hapus Metadata Gambar" subtitle="EXIF, GPS, dan data sensitif lainnya dihapus via re-encode canvas">
      <div className="space-y-4 max-w-lg">
        <Dropzone onFiles={(f) => setMetaFiles(f.filter((f2) => f2.type.startsWith("image/")))} accept="image/*" label="Drop gambar di sini" sublabel="Bisa pilih beberapa sekaligus" icon={<ImageIcon className="w-8 h-8" />} />
        {metaFiles.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{metaFiles.length} gambar dipilih</p>
            <ul className="mt-2 space-y-1">
              {metaFiles.map((f, i) => (
                <li key={i} className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  • {f.name} ({(f.size / 1024).toFixed(0)} KB)
                </li>
              ))}
            </ul>
          </div>
        )}
        <Btn onClick={runMetaClean} disabled={!metaFiles.length} className="w-full gap-2">
          <Eraser className="w-4 h-4" />Bersihkan Metadata
        </Btn>
        {metaInfo && <GamatoInlineAlert message={metaInfo} tone={metaInfo.startsWith("Gagal") ? "error" : "success"} />}
        <p className="text-xs text-slate-400 dark:text-slate-500">File diunduh ulang — tanpa metadata EXIF. Tidak ada yang dikirim ke server.</p>
      </div>
    </PanelCard>
  );
};
