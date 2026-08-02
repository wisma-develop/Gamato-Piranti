import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Image as ImageIcon, FileDown, ArrowLeftRight, Wand2, RotateCw, Minus, Loader2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { fileToDataUrl, downloadBlob } from "@/lib/file";
import { Label, Input, Select, Btn, SectionBadge } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";

type ImageMode = "compress" | "resize" | "convert" | "rotate";

// URL slug (Indonesian) <-> internal mode id
const IMAGE_MODE_SLUGS: Record<ImageMode, string> = {
  compress: "kompres",
  resize: "resize",
  convert: "konversi",
  rotate: "putar",
};
const SLUG_TO_IMAGE_MODE: Record<string, ImageMode> = Object.fromEntries(
  Object.entries(IMAGE_MODE_SLUGS).map(([mode, slug]) => [slug, mode as ImageMode])
);

const IMG_MODES: { id: ImageMode; label: string; icon: React.ReactNode }[] = [
  { id: "compress", label: "Kompres",         icon: <FileDown      className="w-5 h-5" /> },
  { id: "resize",   label: "Ubah Ukuran",     icon: <ArrowLeftRight className="w-5 h-5" /> },
  { id: "convert",  label: "Konversi Format", icon: <Wand2         className="w-5 h-5" /> },
  { id: "rotate",   label: "Putar",           icon: <RotateCw      className="w-5 h-5" /> },
];

// ─── Image Lab ────────────────────────────────────────────────────────────────

export const ImageTools: React.FC = () => {
  const { mode: modeSlug } = useParams<{ mode: string }>();
  const mode: ImageMode = (modeSlug && SLUG_TO_IMAGE_MODE[modeSlug]) || "compress";
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(75);
  const [maxWidth, setMaxWidth] = useState(1600);
  const [maxHeight, setMaxHeight] = useState(1600);
  const [targetFormat, setTargetFormat] = useState<"original" | "jpeg" | "png" | "webp">("jpeg");
  const [rotateDeg, setRotateDeg] = useState(90);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Reset transient state whenever the active mode (route) changes
  useEffect(() => {
    setFiles([]);
    setPreviewUrls([]);
    setInfo(null);
  }, [mode]);

  const totalSizeMb = useMemo(() =>
    files.length ? Math.round(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024 * 10) / 10 : 0,
    [files]);

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter(f => f.type.startsWith("image/"));
    setFiles(imgs);
    setPreviewUrls(imgs.map(f => URL.createObjectURL(f)));
    setInfo(null);
  };

  const processImages = async () => {
    if (!files.length) return;
    setIsWorking(true); setInfo(null);
    try {
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });
        let drawW = img.width, drawH = img.height;
        if (mode === "resize") {
          const lw = maxWidth > 0 ? maxWidth : img.width, lh = maxHeight > 0 ? maxHeight : img.height;
          const scale = Math.min(lw / img.width, lh / img.height, 1);
          drawW = Math.round(img.width * scale); drawH = Math.round(img.height * scale);
        }
        const angle = mode === "rotate" ? rotateDeg : 0;
        const radians = angle * Math.PI / 180;
        const cw = (angle === 90 || angle === 270) ? drawH : drawW;
        const ch = (angle === 90 || angle === 270) ? drawW : drawH;
        const canvas = document.createElement("canvas");
        canvas.width = cw; canvas.height = ch;
        const ctx = canvas.getContext("2d")!;
        ctx.save(); ctx.translate(cw / 2, ch / 2);
        if (angle !== 0) ctx.rotate(radians);
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
        const origType = file.type?.startsWith("image/") ? file.type : "image/png";
        const mime = targetFormat === "original" ? origType : targetFormat === "jpeg" ? "image/jpeg" : targetFormat === "png" ? "image/png" : "image/webp";
        const q = Math.min(Math.max(quality, 10), 100) / 100;
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), mime, (mime === "image/jpeg" || mime === "image/webp") ? q : undefined));
        if (!blob) continue;
        const base = file.name.replace(/\.[^.]+$/, "");
        const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "img";
        const suffix = mode === "compress" ? "compressed" : mode === "resize" ? "resized" : mode === "convert" ? "converted" : "rotated";
        downloadBlob(blob, `${base}-gp-${suffix}.${ext}`);
      }
      setInfo(`${files.length} gambar berhasil diproses.`);
    } catch (err: any) { setInfo("" + (err?.message || "Gagal.")); }
    finally { setIsWorking(false); }
  };

  // IMG_MODES defined at module level

  return (
    <div className="space-y-6">
      {/* Mode tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {IMG_MODES.map(m => (
          <Link key={m.id} to={`/image/${IMAGE_MODE_SLUGS[m.id]}`}
            className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
              mode === m.id ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300")}>
            <span className={cn("transition-colors", mode === m.id ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500")}>{m.icon}</span>
            <span className={cn("text-sm font-bold", mode === m.id ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200")}>{m.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* LEFT */}
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
                    <button type="button" onClick={() => { setFiles(f => f.filter((_, j) => j !== i)); setPreviewUrls(u => u.filter((_, j) => j !== i)); }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs items-center justify-center hidden group-hover:flex"><Minus className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode-specific options */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Opsi</p>

            {mode === "resize" && (
              <div className="grid grid-cols-2 gap-4">
                <Input label="Lebar Maks (px)" type="number" min={0} value={maxWidth} onChange={e => setMaxWidth(parseInt(e.target.value) || 0)} />
                <Input label="Tinggi Maks (px)" type="number" min={0} value={maxHeight} onChange={e => setMaxHeight(parseInt(e.target.value) || 0)} />
                <p className="col-span-2 text-xs text-slate-400 dark:text-slate-500">Rasio gambar tetap terjaga. Nilai 0 = mengikuti asli.</p>
              </div>
            )}

            {mode === "rotate" && (
              <Select label="Derajat Putar" value={rotateDeg} onChange={e => setRotateDeg(parseInt(e.target.value))}>
                <option value={90}>90° searah jarum jam</option>
                <option value={180}>180°</option>
                <option value={270}>270° (90° berlawanan)</option>
              </Select>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Select label="Format Output" value={targetFormat} onChange={e => setTargetFormat(e.target.value as any)}>
                <option value="original">Sesuai asli</option>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
                <option value="webp">WEBP</option>
              </Select>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label>Kualitas (JPEG/WEBP)</Label>
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{quality}%</span>
                </div>
                <input type="range" min={10} max={100} value={quality} onChange={e => setQuality(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          </div>

          {info && <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", info.startsWith("Gagal") || info.startsWith("Tidak") ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>{info}</div>}

          <Btn onClick={processImages} disabled={isWorking || !files.length} className="w-full py-4 text-base">
            <>{isWorking ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses…</> : <><Wand2 className="w-4 h-4" />Proses {files.length > 0 ? `${files.length} ` : ""}Gambar</>}</>
          </Btn>
        </div>

        {/* RIGHT: info */}
        <div className="bg-slate-900 dark:ring-1 dark:ring-slate-700 rounded-2xl p-5 text-white space-y-4 sticky top-24">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Info Mode</p>
          <div className="flex items-center gap-3">
            <span className={cn("text-blue-400")}>{IMG_MODES.find(m2 => m2.id === mode)?.icon}</span>
            <p className="font-bold text-white">{IMG_MODES.find(m2 => m2.id === mode)?.label}</p>
          </div>
          <div className="border-t border-slate-800 pt-4 space-y-2 text-sm text-slate-300">
            {mode === "compress" && <><p>• Kurangi ukuran file tanpa mengubah dimensi.</p><p>• Atur kualitas dengan slider.</p></>}
            {mode === "resize" && <><p>• Ubah dimensi gambar dengan rasio tetap.</p><p>• Ideal untuk thumbnail dan upload.</p></>}
            {mode === "convert" && <><p>• Konversi antar format JPEG, PNG, WEBP.</p><p>• WEBP biasanya paling kecil ukurannya.</p></>}
            {mode === "rotate" && <><p>• Putar foto yang miring atau terbalik.</p><p>• Diterapkan ke semua file yang dipilih.</p></>}
          </div>
          <SectionBadge>Proses native di perangkatmu</SectionBadge>
        </div>
      </div>
    </div>
  );
};
