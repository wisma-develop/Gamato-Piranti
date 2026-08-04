import React, { useMemo, useState } from "react";
import { RotateCw, Image as ImageIcon, Minus, Loader2, Wand2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { fileToDataUrl, downloadBlob } from "@/lib/file";
import { Select, Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const ImageRotate: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [rotateDeg, setRotateDeg] = useState(90);
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
        const angle = rotateDeg;
        const radians = (angle * Math.PI) / 180;
        const cw = angle === 90 || angle === 270 ? img.height : img.width;
        const ch = angle === 90 || angle === 270 ? img.width : img.height;
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d")!;
        ctx.save();
        ctx.translate(cw / 2, ch / 2);
        ctx.rotate(radians);
        ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
        ctx.restore();
        const origType = file.type?.startsWith("image/") ? file.type : "image/png";
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), origType));
        if (!blob) continue;
        const base = file.name.replace(/\.[^.]+$/, "");
        const ext = origType === "image/jpeg" ? "jpg" : origType === "image/webp" ? "webp" : "png";
        downloadBlob(blob, `${base}-gp-rotated.${ext}`);
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
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs items-center justify-center hidden group-hover:flex"
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
          <Select label="Derajat Putar" value={rotateDeg} onChange={(e) => setRotateDeg(parseInt(e.target.value))}>
            <option value={90}>90° searah jarum jam</option>
            <option value={180}>180°</option>
            <option value={270}>270° (90° berlawanan)</option>
          </Select>
        </div>

        {info && (
          <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", info.startsWith("Gagal") ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>
            {info}
          </div>
        )}

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
        icon={<RotateCw className="w-5 h-5" />}
        label="Putar Gambar"
        desc="Rotasi gambar"
        points={["Putar foto yang miring atau terbalik.", "Diterapkan ke semua file yang dipilih."]}
      />
    </div>
  );
};
