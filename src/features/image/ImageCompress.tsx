import React, { useMemo, useState } from "react";
import { FileDown, Image as ImageIcon, Minus, Loader2, Wand2 } from "lucide-react";
import { fileToDataUrl, downloadBlob } from "@/lib/file";
import { Label, Select, Btn } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

export const ImageCompress: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [quality, setQuality] = useState(75);
  const [targetFormat, setTargetFormat] = useState<"original" | "jpeg" | "png" | "webp">("jpeg");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalSizeMb = useMemo(
    () => (files.length ? Math.round((files.reduce((a, f) => a + f.size, 0) / 1024 / 1024) * 10) / 10 : 0),
    [files]
  );

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter((f) => f.type.startsWith("image/"));
    setFiles(imgs);
    setPreviewUrls(imgs.map((f) => URL.createObjectURL(f)));
    setInfo(null);
  };

  const processImages = async () => {
    if (!files.length) return;
    setIsWorking(true);
    setInfo(null);
    try {
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        const origType = file.type?.startsWith("image/") ? file.type : "image/png";
        const mime = targetFormat === "original" ? origType : targetFormat === "jpeg" ? "image/jpeg" : targetFormat === "png" ? "image/png" : "image/webp";
        const q = Math.min(Math.max(quality, 10), 100) / 100;
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), mime, mime === "image/jpeg" || mime === "image/webp" ? q : undefined)
        );
        if (!blob) continue;
        const base = file.name.replace(/\.[^.]+$/, "");
        const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "img";
        downloadBlob(blob, `${base}-gp-compressed.${ext}`);
      }
      setInfo(`${files.length} gambar berhasil diproses.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        {files.length === 0 ? (
          <Dropzone onFiles={addFiles} accept="image/*" multiple label="Drop gambar di sini" sublabel="JPG, PNG, WEBP — bisa beberapa file" icon={<ImageIcon className="w-8 h-8" />} isDragging={isDragging} setIsDragging={setIsDragging} />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{files.length} gambar · {totalSizeMb} MB</p>
              <button type="button" onClick={() => { setFiles([]); setPreviewUrls([]); setInfo(null); }} className="text-sm text-red-500 font-semibold hover:text-red-700">Ganti File</button>
            </div>
            <div className="p-4 flex flex-wrap gap-3">
              {previewUrls.map((url, i) => (
                <div key={i} className="relative group">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm" />
                  <button
                    type="button"
                    onClick={() => {
                      setFiles((f) => f.filter((_, j) => j !== i));
                      setPreviewUrls((u) => u.filter((_, j) => j !== i));
                    }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs items-center justify-center flex sm:hidden sm:group-hover:flex"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Opsi</p>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Format Output" value={targetFormat} onChange={(e) => setTargetFormat(e.target.value as any)}>
              <option value="original">Sesuai asli</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WEBP</option>
            </Select>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label>Kualitas</Label>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{quality}%</span>
              </div>
              <GamatoSlider min={10} max={100} value={quality} onChange={setQuality} aria-label="Kualitas" />
            </div>
          </div>
        </div>

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={processImages} disabled={isWorking || !files.length} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              Proses {files.length > 0 ? `${files.length} ` : ""}Gambar
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<FileDown className="w-5 h-5" />}
        label="Kompres Gambar"
        desc="Kurangi ukuran file"
        points={["Kurangi ukuran file tanpa mengubah dimensi.", "Atur kualitas dengan slider."]}
      />
    </div>
  );
};
