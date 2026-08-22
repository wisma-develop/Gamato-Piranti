import React, { useState } from "react";
import { ScanLine, Image as ImageIcon, Trash2, Loader2, Zap, ArrowUp, ArrowDown } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { downloadBlob } from "@/lib/file";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { loadImageFromUrl, canvasToBlob } from "@/lib/canvas";
import { Btn, Select, Label } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

type ScanMode = "original" | "grayscale" | "bw";

interface ScanItem {
  file: File;
  url: string;
}

export const PdfScan: React.FC = () => {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [mode, setMode] = useState<ScanMode>("bw");
  const [brightness, setBrightness] = useState(110);
  const [contrast, setContrast] = useState(120);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter((f) => f.type.startsWith("image/"));
    setItems((prev) => [...prev, ...imgs.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
    setInfo(null);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const move = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleBuild = async () => {
    if (!items.length) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const pdfDoc = await PDFDocument.create();
      for (const item of items) {
        const img = await loadImageFromUrl(item.url);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        let filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        if (mode === "grayscale") filter += " grayscale(100%)";
        if (mode === "bw") filter += " grayscale(100%) contrast(180%) brightness(115%)";
        ctx.filter = filter;
        ctx.drawImage(img, 0, 0);

        const blob = await canvasToBlob(canvas, "image/jpeg", 0.88);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const embedded = await pdfDoc.embedJpg(bytes);
        const page = pdfDoc.addPage([embedded.width, embedded.height]);
        page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      }
      await stampGamatoBranding(pdfDoc);
      downloadBlob(new Blob([await pdfDoc.save()], { type: "application/pdf" }), "gamato-scan.pdf");
      setInfo(`${items.length} halaman berhasil dijadikan PDF hasil scan.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal membuat PDF."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <Dropzone
          onFiles={addFiles}
          accept="image/*"
          multiple
          label="Ambil foto atau drop gambar dokumen di sini"
          sublabel="Bisa beberapa halaman sekaligus — urutan bisa diatur"
          icon={<ImageIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
        />

        {items.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{items.length} halaman</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item, i) => (
                <div key={item.url} className="flex items-center gap-3 px-5 py-3">
                  <img src={item.url} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-700" style={{ filter: mode === "bw" ? "grayscale(1) contrast(1.8)" : mode === "grayscale" ? "grayscale(1)" : undefined }} />
                  <p className="flex-1 text-sm text-slate-600 dark:text-slate-300 truncate">
                    Halaman {i + 1} — {item.file.name}
                  </p>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <Select label="Gaya Scan" value={mode} onChange={(e) => setMode(e.target.value as ScanMode)}>
            <option value="bw">Hitam-Putih Kontras (mirip scanner)</option>
            <option value="grayscale">Grayscale</option>
            <option value="original">Warna Asli</option>
          </Select>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Kecerahan</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{brightness}%</span>
            </div>
            <GamatoSlider min={50} max={180} value={brightness} onChange={setBrightness} aria-label="Kecerahan" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Kontras</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{contrast}%</span>
            </div>
            <GamatoSlider min={50} max={220} value={contrast} onChange={setContrast} aria-label="Kontras" />
          </div>
        </div>

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={handleBuild} disabled={isWorking || !items.length} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Buat PDF Hasil Scan
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<ScanLine className="w-5 h-5" />}
        label="Scan PDF"
        desc="Foto dokumen → PDF"
        points={["Ambil foto dari HP (kamera langsung) atau upload gambar dokumen.", "Filter otomatis membuat hasil terlihat seperti hasil scanner sungguhan.", "Susun ulang urutan halaman sebelum digabung."]}
      />
    </div>
  );
};
