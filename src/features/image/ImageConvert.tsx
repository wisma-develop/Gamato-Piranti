import React, { useEffect, useMemo, useState } from "react";
import { Wand2, Image as ImageIcon, Minus, Loader2 } from "lucide-react";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import { Label, Select, Btn } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { convertImage, isBmpEncodingSupported, type ImageOutputFormat } from "@/features/utility/convert/converters/imageConvert";

const FORMAT_OPTIONS: { id: ImageOutputFormat; label: string }[] = [
  { id: "jpg", label: "JPEG" },
  { id: "png", label: "PNG" },
  { id: "webp", label: "WEBP" },
  { id: "bmp", label: "BMP" },
  { id: "ico", label: "ICO (Ikon)" },
  { id: "pdf", label: "PDF" },
];

const QUALITY_AWARE_FORMATS: ImageOutputFormat[] = ["jpg", "webp"];

export const ImageConvert: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [quality, setQuality] = useState(90);
  const [targetFormat, setTargetFormat] = useState<ImageOutputFormat>("webp");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [bmpSupported, setBmpSupported] = useState<boolean | null>(null);

  useEffect(() => {
    isBmpEncodingSupported().then(setBmpSupported).catch(() => setBmpSupported(false));
  }, []);

  const totalSizeMb = useMemo(
    () => (files.length ? Math.round((files.reduce((a, f) => a + f.size, 0) / 1024 / 1024) * 10) / 10 : 0),
    [files]
  );

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter((f) => f.type.startsWith("image/") || /\.svg$/i.test(f.name));
    setFiles(imgs);
    setPreviewUrls(imgs.map((f) => URL.createObjectURL(f)));
    setInfo(null);
  };

  const processImages = async () => {
    if (!files.length) return;
    setIsWorking(true);
    setInfo(null);
    try {
      let successCount = 0;
      for (const file of files) {
        try {
          const q = Math.min(Math.max(quality, 10), 100) / 100;
          const blob = await convertImage(file, targetFormat, q);
          const base = sanitizeFileName(file.name.replace(/\.[^.]+$/, "")) || "gambar";
          downloadBlob(blob, `${base}-gp-converted.${targetFormat}`);
          successCount++;
        } catch {
          // Keep going for the rest of the batch — one corrupt/unsupported
          // file shouldn't abort every other file the user selected.
        }
      }
      if (successCount === files.length) {
        setInfo(`${successCount} gambar berhasil diproses.`);
      } else if (successCount > 0) {
        setInfo(`${successCount} dari ${files.length} gambar berhasil diproses. Sisanya gagal (format sumber mungkin tidak didukung).`);
      } else {
        setInfo("Gagal. Tidak ada gambar yang berhasil dikonversi.");
      }
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal."));
    } finally {
      setIsWorking(false);
    }
  };

  const showQualitySlider = QUALITY_AWARE_FORMATS.includes(targetFormat);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        {files.length === 0 ? (
          <Dropzone onFiles={addFiles} accept="image/*,.svg" multiple label="Drop gambar di sini" sublabel="JPG, PNG, WEBP, BMP, SVG — bisa beberapa file" icon={<ImageIcon className="w-8 h-8" />} isDragging={isDragging} setIsDragging={setIsDragging} />
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
            <Select label="Format Output" value={targetFormat} onChange={(e) => setTargetFormat(e.target.value as ImageOutputFormat)}>
              {FORMAT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </Select>
            {showQualitySlider ? (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label>Kualitas</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{quality}%</span>
                </div>
                <GamatoSlider min={10} max={100} value={quality} onChange={setQuality} aria-label="Kualitas" />
              </div>
            ) : (
              <div className="flex items-end">
                <p className="text-xs text-slate-400 dark:text-slate-500 pb-2.5">
                  {targetFormat === "ico" ? "Otomatis dipotong persegi & diskalakan ke maks. 256px." : targetFormat === "pdf" ? "Satu gambar per halaman, ukuran mengikuti gambar asli." : "Format ini tidak memakai pengaturan kualitas (tanpa kompresi rugi)."}
                </p>
              </div>
            )}
          </div>
          {targetFormat === "bmp" && bmpSupported === false && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">
              Browser ini sepertinya tidak mendukung penulisan BMP asli — hasil bisa saja tetap berupa PNG dengan nama file .bmp. Coba Chrome atau Edge untuk dukungan BMP penuh.
            </p>
          )}
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
        icon={<Wand2 className="w-5 h-5" />}
        label="Konversi Format"
        desc="Antar format gambar — enam pilihan output"
        points={[
          "Konversi antar JPEG, PNG, WEBP, BMP, ICO (ikon), dan PDF.",
          "WEBP biasanya paling kecil ukurannya untuk kualitas yang sama.",
          "ICO otomatis dipotong persegi — cocok untuk favicon.",
          "Mendukung SVG sebagai sumber (dirasterisasi otomatis).",
        ]}
      />
    </div>
  );
};
