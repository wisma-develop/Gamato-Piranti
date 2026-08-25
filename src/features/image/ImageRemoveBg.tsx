import React, { useEffect, useRef, useState } from "react";
import { Eraser, Image as ImageIcon, Loader2, Download } from "lucide-react";
import { downloadBlob } from "@/lib/file";
import { loadImageFromUrl, canvasToBlob } from "@/lib/canvas";
import { Btn, Label } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

type RGB = [number, number, number];

function rgbToHex([r, g, b]: RGB) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function averageCorners(data: ImageData): RGB {
  const { width: w, height: h, data: d } = data;
  const block = 8;
  const corners = [
    [0, 0],
    [w - block, 0],
    [0, h - block],
    [w - block, h - block],
  ];
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (const [cx, cy] of corners) {
    for (let y = Math.max(0, cy); y < Math.min(h, cy + block); y++) {
      for (let x = Math.max(0, cx); x < Math.min(w, cx + block); x++) {
        const i = (y * w + x) * 4;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
    }
  }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [255, 255, 255];
}

export const ImageRemoveBg: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalDataRef = useRef<ImageData | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [bgColor, setBgColor] = useState<RGB>([255, 255, 255]);
  const [tolerance, setTolerance] = useState(35);
  const [feather, setFeather] = useState(20);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyRemoval = () => {
    const canvas = canvasRef.current;
    const original = originalDataRef.current;
    if (!canvas || !original) return;
    const ctx = canvas.getContext("2d")!;
    const out = ctx.createImageData(original.width, original.height);
    out.data.set(original.data);
    const maxDist = 441.7; // sqrt(255^2 * 3)
    const tol = (tolerance / 100) * maxDist;
    const feat = Math.max(1, (feather / 100) * maxDist);
    const [cr, cg, cb] = bgColor;
    for (let i = 0; i < out.data.length; i += 4) {
      const r = out.data[i];
      const g = out.data[i + 1];
      const b = out.data[i + 2];
      const dist = Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2);
      let alpha = 255;
      if (dist <= tol) alpha = 0;
      else if (dist <= tol + feat) alpha = Math.round(((dist - tol) / feat) * 255);
      out.data[i + 3] = Math.min(out.data[i + 3], alpha);
    }
    ctx.putImageData(out, 0, 0);
  };

  useEffect(() => {
    if (originalDataRef.current) applyRemoval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgColor, tolerance, feather]);

  const addFiles = async (incoming: File[]) => {
    const f = incoming.find((x) => x.type.startsWith("image/"));
    if (!f) return;
    setInfo(null);
    const url = URL.createObjectURL(f);
    const img = await loadImageFromUrl(url);
    URL.revokeObjectURL(url);
    const maxDim = 1400;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    originalDataRef.current = data;
    setDims({ w, h });
    setFile(f);
    const sampled = averageCorners(data);
    setBgColor(sampled);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const original = originalDataRef.current;
    if (!canvas || !original) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(canvas.width - 1, Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width));
    const y = Math.min(canvas.height - 1, Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height));
    const idx = (y * canvas.width + x) * 4;
    setBgColor([original.data[idx], original.data[idx + 1], original.data[idx + 2]]);
  };

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    setIsWorking(true);
    try {
      const blob = await canvasToBlob(canvasRef.current, "image/png");
      const base = (file?.name || "gambar").replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}-no-bg.png`);
      setInfo("Background berhasil dihapus, diunduh sebagai PNG transparan.");
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal memproses gambar."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        {!file ? (
          <Dropzone
            onFiles={addFiles}
            accept="image/*"
            multiple={false}
            label="Drop gambar di sini"
            sublabel="Paling cocok untuk foto berlatar polos (produk, KTP, dsb.)"
            icon={<ImageIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  originalDataRef.current = null;
                  setDims(null);
                  setInfo(null);
                }}
                className="text-sm text-red-500 font-semibold hover:text-red-700 shrink-0"
              >
                Ganti File
              </button>
            </div>
            <div
              className="p-4 flex justify-center items-center"
              style={{
                backgroundImage:
                  "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
                backgroundSize: "20px 20px",
                backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
              }}
            >
              <canvas ref={canvasRef} onClick={handleCanvasClick} className="max-w-full max-h-[420px] rounded-lg cursor-crosshair shadow" />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pengaturan</p>
          <div className="flex items-center gap-3">
            <Label>Warna background</Label>
            <GamatoColorPicker
              value={rgbToHex(bgColor)}
              onChange={(hex) => {
                const h = hex.replace("#", "");
                setBgColor([parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]);
              }}
            />
            <span className="text-xs text-slate-400 dark:text-slate-500">atau klik langsung pada gambar untuk mengambil warna</span>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Toleransi warna</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{tolerance}%</span>
            </div>
            <GamatoSlider min={0} max={100} value={tolerance} onChange={setTolerance} disabled={!file} aria-label="Toleransi warna" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Kehalusan tepi (feather)</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{feather}%</span>
            </div>
            <GamatoSlider min={0} max={60} value={feather} onChange={setFeather} disabled={!file} aria-label="Kehalusan tepi" />
          </div>
        </div>

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={handleDownload} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Unduh PNG Transparan
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<Eraser className="w-5 h-5" />}
        label="Hapus Background"
        desc="Chroma-key, warna solid"
        points={[
          "Bekerja dengan mendeteksi & menghapus satu warna latar (mirip green screen).",
          "Cocok untuk background polos: produk, dokumen, pas foto.",
          "Untuk foto latar rumit/alami, hasil mungkin kurang presisi — gunakan toleransi & feather untuk menghaluskan.",
        ]}
      />
    </div>
  );
};
