import React, { useState } from "react";
import { Layers, FileText, Trash2, Loader2, Zap } from "lucide-react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { Input, Select, Label, Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

type Position = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "tile";

function hexToRgb01(hex: string) {
  const h = hex.replace("#", "");
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

export const PdfWatermark: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONTOH / DRAFT");
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#4f46e5");
  const [opacity, setOpacity] = useState(35);
  const [rotation, setRotation] = useState(45);
  const [position, setPosition] = useState<Position>("center");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: File[]) => {
    const pdf = incoming.find((f) => f.type === "application/pdf");
    if (pdf) setFile(pdf);
    setInfo(null);
  };

  const handleRun = async () => {
    if (!file || !text.trim()) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const pdfDoc = await PDFDocument.load(await fileToArrayBuffer(file));
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const wmColor = hexToRgb01(color);
      const alpha = opacity / 100;
      const pages = pdfDoc.getPages();

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const margin = 24;

        const draw = (x: number, y: number) =>
          page.drawText(text, { x, y, size: fontSize, font, color: wmColor, opacity: alpha, rotate: degrees(rotation) });

        if (position === "tile") {
          const stepX = textWidth + 80;
          const stepY = fontSize * 4;
          for (let ty = -stepY; ty < height + stepY; ty += stepY) {
            for (let tx = -stepX; tx < width + stepX; tx += stepX) draw(tx, ty);
          }
          return;
        }

        let x = (width - textWidth) / 2;
        let y = (height - fontSize) / 2;
        if (position === "top-left") {
          x = margin;
          y = height - margin - fontSize;
        } else if (position === "top-right") {
          x = width - margin - textWidth;
          y = height - margin - fontSize;
        } else if (position === "bottom-left") {
          x = margin;
          y = margin;
        } else if (position === "bottom-right") {
          x = width - margin - textWidth;
          y = margin;
        }
        draw(x, y);
      });

      downloadBlob(new Blob([await pdfDoc.save()], { type: "application/pdf" }), "gamato-watermarked.pdf");
      setInfo(`Watermark diterapkan ke ${pages.length} halaman.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal menambahkan watermark."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <Dropzone
          onFiles={addFiles}
          accept="application/pdf"
          multiple={false}
          label="Drop file PDF di sini"
          sublabel="atau klik untuk browse"
          icon={<FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
        />

        {file && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3">
              <FileText className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button type="button" onClick={() => setFile(null)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <Input label="Teks Watermark" value={text} onChange={(e) => setText(e.target.value)} placeholder="Contoh: RAHASIA, DRAFT, dst." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ukuran Font (pt)" type="number" min={10} max={150} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value) || 48)} />
            <div>
              <Label>Warna</Label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer" />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Opacity</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{opacity}%</span>
            </div>
            <input type="range" min={5} max={100} value={opacity} onChange={(e) => setOpacity(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Rotasi</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{rotation}°</span>
            </div>
            <input type="range" min={0} max={90} value={rotation} onChange={(e) => setRotation(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
          </div>
          <Select label="Posisi" value={position} onChange={(e) => setPosition(e.target.value as Position)}>
            <option value="center">Tengah</option>
            <option value="tile">Berulang (tile)</option>
            <option value="top-left">Kiri Atas</option>
            <option value="top-right">Kanan Atas</option>
            <option value="bottom-left">Kiri Bawah</option>
            <option value="bottom-right">Kanan Bawah</option>
          </Select>
        </div>

        {info && (
          <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", info.startsWith("Gagal") ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>
            {info}
          </div>
        )}

        <Btn onClick={handleRun} disabled={isWorking || !file || !text.trim()} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Terapkan Watermark
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<Layers className="w-5 h-5" />}
        label="Watermark PDF"
        desc="Tempel ke semua halaman"
        points={["Diterapkan langsung sebagai teks vektor PDF asli — tetap tajam saat di-zoom.", "Bisa sekali tempel di satu posisi atau diulang (tile) ke seluruh halaman."]}
      />
    </div>
  );
};
