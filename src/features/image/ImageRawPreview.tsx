import React, { useState } from "react";
import { Camera, FileImage, Trash2, Loader2, Download } from "lucide-react";
import { downloadBlob } from "@/lib/file";
import { Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

interface ExtractedPreview {
  url: string;
  blob: Blob;
  width: number;
  height: number;
  sizeKb: number;
}

const RAW_ACCEPT = ".cr2,.cr3,.nef,.arw,.raf,.orf,.rw2,.dng,.raw,.srw,.pef";

/**
 * Full RAW decoding needs a native/wasm codec that isn't available fully
 * offline in this browser-only app. Instead, this tool scans the RAW file's
 * bytes for embedded JPEG previews (every camera RAW format stores one or
 * more full-size JPEG previews inside the file for fast viewing) and lets
 * you grab those — a technique that works for the vast majority of RAW
 * files from Canon, Nikon, Sony, Fujifilm, Olympus, Panasonic, and Adobe DNG.
 */
async function extractJpegPreviews(buffer: ArrayBuffer): Promise<ExtractedPreview[]> {
  const bytes = new Uint8Array(buffer);
  const found: ExtractedPreview[] = [];
  let i = 0;
  while (i < bytes.length - 1) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
      let j = i + 2;
      let end = -1;
      while (j < bytes.length - 1) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          end = j + 2;
          break;
        }
        j++;
      }
      if (end === -1) break;
      const slice = bytes.slice(i, end);
      if (slice.length > 4096) {
        const blob = new Blob([slice], { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        try {
          const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => reject();
            img.src = url;
          });
          found.push({ url, blob, width: dims.w, height: dims.h, sizeKb: Math.round(slice.length / 1024) });
        } catch {
          URL.revokeObjectURL(url);
        }
      }
      i = end;
    } else {
      i++;
    }
  }
  // Largest preview first.
  return found.sort((a, b) => b.width * b.height - a.width * a.height);
}

export const ImageRawPreview: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previews, setPreviews] = useState<ExtractedPreview[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = async (incoming: File[]) => {
    const f = incoming[0];
    if (!f) return;
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
    setFile(f);
    setInfo(null);
    setIsWorking(true);
    try {
      const buf = await f.arrayBuffer();
      const found = await extractJpegPreviews(buf);
      setPreviews(found);
      setInfo(found.length ? `${found.length} preview ditemukan di dalam file RAW.` : "Tidak ada preview JPEG yang terdeteksi di file ini.");
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal membaca file RAW."));
    } finally {
      setIsWorking(false);
    }
  };

  const download = (p: ExtractedPreview, idx: number) => {
    const base = (file?.name || "raw-preview").replace(/\.[^.]+$/, "");
    downloadBlob(p.blob, `${base}-preview-${idx + 1}-${p.width}x${p.height}.jpg`);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <Dropzone
          onFiles={addFiles}
          accept={RAW_ACCEPT}
          multiple={false}
          label="Drop file RAW di sini"
          sublabel="CR2, CR3, NEF, ARW, RAF, ORF, RW2, DNG, PEF, SRW"
          icon={<Camera className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
        />

        {file && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3">
              <FileImage className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  previews.forEach((p) => URL.revokeObjectURL(p.url));
                  setFile(null);
                  setPreviews([]);
                  setInfo(null);
                }}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {isWorking && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 px-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memindai file RAW untuk preview tersemat…
          </div>
        )}

        {previews.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            {previews.map((p, idx) => (
              <div key={p.url} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <img src={p.url} alt={`Preview ${idx + 1}`} className="w-full aspect-video object-cover bg-slate-100 dark:bg-slate-800" />
                <div className="p-3 flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {p.width}×{p.height}px
                    </p>
                    <p>{p.sizeKb} KB</p>
                  </div>
                  <Btn onClick={() => download(p, idx)} variant="secondary" className="text-xs py-1.5 gap-1.5">
                    <Download className="w-3.5 h-3.5" />
                    Unduh
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ToolInfoPanel
        icon={<Camera className="w-5 h-5" />}
        label="Baca Foto RAW"
        desc="Ekstrak preview JPEG"
        points={[
          "Mengekstrak preview JPEG yang sudah tersimpan di dalam file RAW kamera.",
          "Bukan decoder RAW penuh — kualitas preview mengikuti yang disimpan kamera saat pemotretan.",
          "Hasil bisa langsung dipakai di alat Image Lab lainnya (kompres, crop, watermark, dll).",
        ]}
        info={info}
        infoTone={info?.startsWith("Gagal") || info?.includes("Tidak ada") ? "error" : "success"}
      />
    </div>
  );
};
