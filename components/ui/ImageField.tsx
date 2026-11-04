import React, { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { fileToDataUrl } from "@/lib/file";
import { Label } from "@/components/ui/primitives";

/**
 * ImageField — unggah gambar kecil (logo, cap, gambar latar) yang disimpan sebagai data-URL.
 * Karena nilainya string biasa, ia ikut masuk riwayat Undo/Redo dan bisa disimpan ke berkas desain (.json).
 */
export const ImageField: React.FC<{
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  hint?: string;
  maxDim?: number;
  testId?: string;
}> = ({ label, value, onChange, hint, maxDim = 1600, testId }) => {
  const ref = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = await fileToDataUrl(file);
    // Perkecil gambar besar agar berkas desain & riwayat undo tetap ringan.
    const img = new Image();
    img.src = url;
    try { await img.decode(); } catch { onChange(url); return; }
    const sc = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    if (sc >= 1 || file.type === "image/svg+xml") { onChange(url); return; }
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * sc);
    c.height = Math.round(img.naturalHeight * sc);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    onChange(c.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.9));
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className={cn("flex items-center gap-3 rounded-xl border-2 border-dashed p-3 transition-colors", "border-slate-300 dark:border-slate-700 hover:border-indigo-400")}>
        {value ? (
          <img src={value} alt="" className="w-12 h-12 rounded-lg object-contain bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400"><ImagePlus className="w-5 h-5" /></div>
        )}
        <div className="flex-1 min-w-0">
          <button type="button" onClick={() => ref.current?.click()} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
            {value ? "Ganti gambar" : "Pilih gambar"}
          </button>
          {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
        </div>
        {value && (
          <button type="button" aria-label={`Hapus ${label}`} onClick={() => onChange(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
            <X className="w-4 h-4" />
          </button>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden" data-testid={testId} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
};
