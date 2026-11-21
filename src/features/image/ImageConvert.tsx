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
import { msgStarts, tr } from "@/i18n";

const FORMAT_OPTIONS: { id: ImageOutputFormat; label: string }[] = [
  { id: "jpg", label: tr("JPEG") },
  { id: "png", label: tr("PNG") },
  { id: "webp", label: tr("WEBP") },
  { id: "bmp", label: tr("BMP") },
  { id: "ico", label: tr("ICO (Ikon)") },
  { id: "pdf", label: tr("PDF") },
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
        setInfo(tr("{0} gambar berhasil diproses.", successCount));
      } else if (successCount > 0) {
        setInfo(tr("{0} dari {1} gambar berhasil diproses. Sisanya gagal (format sumber mungkin tidak didukung).", successCount, files.length));
      } else {
        setInfo(tr("Gagal. Tidak ada gambar yang berhasil dikonversi."));
      }
    } catch (err: any) {
      setInfo("" + (err?.message || tr("Gagal.")));
    } finally {
      setIsWorking(false);
    }
  };

  const showQualitySlider = QUALITY_AWARE_FORMATS.includes(targetFormat);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        {files.length === 0 ? (
          <Dropzone onFiles={addFiles} accept="image/*,.svg" multiple label={tr("Drop gambar di sini")} sublabel={tr("JPG, PNG, WEBP, BMP, SVG — bisa beberapa file")} icon={<ImageIcon className="w-8 h-8" />} isDragging={isDragging} setIsDragging={setIsDragging} />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{tr("{0} gambar · {1} MB", files.length, totalSizeMb)}</p>
              <button type="button" onClick={() => { setFiles([]); setPreviewUrls([]); setInfo(null); }} className="text-sm text-red-500 font-semibold hover:text-red-700">{tr("Ganti File")}</button>
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
                    className="absolute -top-2 -right-2 w-7 h-7 sm:-top-1.5 sm:-right-1.5 sm:w-5 sm:h-5 bg-red-500 text-white rounded-full text-xs items-center justify-center flex sm:hidden sm:group-hover:flex"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Opsi")}</p>
          <div className="grid grid-cols-2 gap-4">
            <Select label={tr("Format Output")} value={targetFormat} onChange={(e) => setTargetFormat(e.target.value as ImageOutputFormat)}>
              {FORMAT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </Select>
            {showQualitySlider ? (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label>{tr("Kualitas")}</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{quality}%</span>
                </div>
                <GamatoSlider min={10} max={100} value={quality} onChange={setQuality} aria-label={tr("Kualitas")} />
              </div>
            ) : (
              <div className="flex items-end">
                <p className="text-xs text-slate-400 dark:text-slate-500 pb-2.5">
                  {targetFormat === "ico" ? tr("Otomatis dipotong persegi & diskalakan ke maks. 256px.") : targetFormat === "pdf" ? tr("Satu gambar per halaman, ukuran mengikuti gambar asli.") : tr("Format ini tidak memakai pengaturan kualitas (tanpa kompresi rugi).")}
                </p>
              </div>
            )}
          </div>
          {targetFormat === "bmp" && bmpSupported === false && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">
              {tr("Browser ini sepertinya tidak mendukung penulisan BMP asli — hasil bisa saja tetap berupa PNG dengan nama file .bmp. Coba Chrome atau Edge untuk dukungan BMP penuh.")}
            </p>
          )}
        </div>

        {info && <GamatoInlineAlert message={info} tone={msgStarts(info, "Gagal") ? "error" : "success"} />}

        <Btn onClick={processImages} disabled={isWorking || !files.length} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {tr("Memproses…")}
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              {tr("Proses")} {files.length > 0 ? `${files.length} ` : ""}{tr("Gambar")}
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<Wand2 className="w-5 h-5" />}
        label={tr("Konversi Format")}
        desc={tr("Antar format gambar — enam pilihan output")}
        points={[
          tr("Konversi antar JPEG, PNG, WEBP, BMP, ICO (ikon), dan PDF."),
          tr("WEBP biasanya paling kecil ukurannya untuk kualitas yang sama."),
          tr("ICO otomatis dipotong persegi — cocok untuk favicon."),
          tr("Mendukung SVG sebagai sumber (dirasterisasi otomatis)."),
        ]}
      />
    </div>
  );
};
