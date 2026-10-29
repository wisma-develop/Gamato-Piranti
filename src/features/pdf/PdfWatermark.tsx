import React, { useEffect, useState } from "react";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { Layers, FileText, Trash2, Loader2, Zap, Type, Image as ImageIcon } from "lucide-react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { loadGamatoIcon, loadGamatoIconPng, GAMATO_NAME } from "@/lib/gamatoIcon";
import { cn } from "@/utils/cn";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { Input, Select, Label, Btn } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

type Position = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "tile";
type Mode = "text" | "icon" | "image";

/** Gambar apa pun (PNG/JPG/WEBP/SVG) → bytes PNG + ukuran, supaya bisa disematkan pdf-lib. */
async function fileToPng(file: File): Promise<{ bytes: Uint8Array; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Gambar tidak bisa dibaca.")); i.src = url; });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || 1; c.height = img.naturalHeight || 1;
    c.getContext("2d")!.drawImage(img, 0, 0);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
    if (!blob) throw new Error("Gagal memproses gambar.");
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}

function hexToRgb01(hex: string) {
  const h = hex.replace("#", "");
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

export const PdfWatermark: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setModeState] = useState<Mode>("text");
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [iconLabel, setIconLabel] = useState(true);
  const [imgSize, setImgSize] = useState(18);
  const [text, setText] = useState("CONTOH / DRAFT");
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState("#4f46e5");
  const [opacity, setOpacity] = useState(35);
  const [rotation, setRotation] = useState(45);
  const [position, setPosition] = useState<Position>("center");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Memanaskan ikon agar ekspor pertama langsung siap.
  useEffect(() => { void loadGamatoIcon(); }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    // Ikon/logo paling pas tegak di pojok; teks diagonal di tengah.
    if (m === "text") { setRotation(45); setPosition("center"); setOpacity(35); }
    else { setRotation(0); setPosition("bottom-right"); setOpacity(70); }
  };

  const addFiles = (incoming: File[]) => {
    const pdf = incoming.find((f) => f.type === "application/pdf");
    if (pdf) setFile(pdf);
    setInfo(null);
  };

  const handleRun = async () => {
    if (!file) return;
    if (mode === "text" && !text.trim()) return;
    if (mode === "image" && !imgFile) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const pdfDoc = await PDFDocument.load(await fileToArrayBuffer(file));
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const wmColor = hexToRgb01(color);
      const alpha = opacity / 100;
      const pages = pdfDoc.getPages();

      if (mode !== "text") {
        // ── Ikon Gamato / gambar: digambar sebagai gambar PDF asli, diputar terhadap pusat kelompok ──
        let img;
        let ratio = 1;
        if (mode === "icon") {
          const bytes = await loadGamatoIconPng();
          if (!bytes) throw new Error("Ikon Gamato Piranti tidak bisa dimuat.");
          img = await pdfDoc.embedPng(bytes);
          ratio = img.width / img.height;
        } else {
          const png = await fileToPng(imgFile!);
          img = await pdfDoc.embedPng(png.bytes);
          ratio = png.w / png.h;
        }
        const label = mode === "icon" && iconLabel ? (text.trim() || GAMATO_NAME) : "";
        const lblFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const theta = (rotation * Math.PI) / 180;
        const cos = Math.cos(theta), sin = Math.sin(theta);
        pages.forEach((page) => {
          const { width, height } = page.getSize();
          const iconW = (imgSize / 100) * width;
          const iconH = iconW / ratio;
          const fontPx = iconH * 0.36;
          const gap = label ? iconH * 0.26 : 0;
          const labelW = label ? lblFont.widthOfTextAtSize(label, fontPx) : 0;
          const boxW = iconW + gap + labelW;
          const boxH = iconH;
          const drawGroup = (cx: number, cy: number) => {
            const world = (lx: number, ly: number) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos });
            const p0 = world(-boxW / 2, -iconH / 2);
            page.drawImage(img, { x: p0.x, y: p0.y, width: iconW, height: iconH, opacity: alpha, rotate: degrees(rotation) });
            if (label) {
              const p1 = world(-boxW / 2 + iconW + gap, -fontPx * 0.32);
              page.drawText(label, { x: p1.x, y: p1.y, size: fontPx, font: lblFont, color: wmColor, opacity: alpha, rotate: degrees(rotation) });
            }
          };
          const margin = 24;
          if (position === "tile") {
            const stepX = boxW + Math.max(40, boxW * 0.5);
            const stepY = boxH * 2.4;
            let row = 0;
            for (let ty = -stepY; ty < height + stepY; ty += stepY, row++)
              for (let tx = -stepX + (row % 2 ? stepX / 2 : 0); tx < width + stepX; tx += stepX) drawGroup(tx, ty);
            return;
          }
          let cx = width / 2, cy = height / 2;
          if (position.includes("left")) cx = margin + boxW / 2;
          else if (position.includes("right")) cx = width - margin - boxW / 2;
          if (position.includes("top")) cy = height - margin - boxH / 2;
          else if (position.includes("bottom")) cy = margin + boxH / 2;
          drawGroup(cx, cy);
        });
        await stampGamatoBranding(pdfDoc);
        downloadBlob(new Blob([await pdfDoc.save() as BlobPart], { type: "application/pdf" }), "gamato-watermarked.pdf");
        setInfo(`Watermark diterapkan ke ${pages.length} halaman.`);
        return;
      }

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

      await stampGamatoBranding(pdfDoc);
      downloadBlob(new Blob([await pdfDoc.save() as BlobPart], { type: "application/pdf" }), "gamato-watermarked.pdf");
      setInfo(`Watermark diterapkan ke ${pages.length} halaman.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal menambahkan watermark."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <GamatoDesktopRecommended toolName="Watermark PDF" className="lg:col-span-full" />
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
          <div className="grid grid-cols-3 gap-2" data-testid="pwm-modes">
            {([
              ["text", "Teks", <Type key="t" className="w-4 h-4" />],
              ["icon", "Ikon Gamato", <Layers key="g" className="w-4 h-4" />],
              ["image", "Gambar/Logo", <ImageIcon key="i" className="w-4 h-4" />],
            ] as const).map(([id, label, icon]) => (
              <button key={id} type="button" data-testid={`pwm-mode-${id}`} onClick={() => setMode(id)}
                className={cn("flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                  mode === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>
                {icon}{label}
              </button>
            ))}
          </div>
          {mode === "icon" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3">
                <img src="/gamato-piranti.png" alt="" className="w-10 h-10 object-contain" />
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">Memakai ikon asli Gamato Piranti sebagai gambar PDF — tajam saat di-zoom.</p>
              </div>
              <GamatoCheckbox checked={iconLabel} onChange={setIconLabel} label={<span className="text-sm text-slate-700 dark:text-slate-300">Tampilkan teks di samping ikon</span>} testId="pwm-icon-label" />
              {iconLabel && <Input label="Teks di samping ikon" value={text} onChange={(e) => setText(e.target.value)} placeholder={GAMATO_NAME} />}
              {iconLabel && (
                <div>
                  <Label>Warna teks</Label>
                  <GamatoColorPicker value={color} onChange={setColor} className="mt-1.5" />
                </div>
              )}
            </div>
          )}
          {mode === "image" && (
            <div>
              <Label>Gambar / logo (PNG transparan disarankan)</Label>
              <input type="file" accept="image/*" data-testid="pwm-image" onChange={(e) => setImgFile(e.target.files?.[0] ?? null)} className="mt-1.5 text-sm text-slate-600 dark:text-slate-300" />
              {imgFile && <p className="text-xs text-slate-400 mt-1">{imgFile.name}</p>}
            </div>
          )}
          {mode === "text" && (
            <>
              <Input label="Teks Watermark" value={text} onChange={(e) => setText(e.target.value)} placeholder="Contoh: RAHASIA, DRAFT, dst." />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Ukuran Font (pt)" type="number" min={10} max={150} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value) || 48)} />
                <div>
                  <Label>Warna</Label>
                  <GamatoColorPicker value={color} onChange={setColor} className="mt-1.5" />
                </div>
              </div>
            </>
          )}
          {mode !== "text" && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label>Ukuran (% lebar halaman)</Label>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{imgSize}%</span>
              </div>
              <GamatoSlider min={5} max={70} value={imgSize} onChange={setImgSize} aria-label="Ukuran ikon" />
            </div>
          )}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Opacity</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{opacity}%</span>
            </div>
            <GamatoSlider min={5} max={100} value={opacity} onChange={setOpacity} aria-label="Opasitas" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Rotasi</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{rotation}°</span>
            </div>
            <GamatoSlider min={0} max={90} value={rotation} onChange={setRotation} aria-label="Rotasi" />
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

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={handleRun} disabled={isWorking || !file || (mode === "text" && !text.trim()) || (mode === "image" && !imgFile)} className="w-full py-4 text-base">
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
        points={["Teks diterapkan sebagai teks vektor PDF asli; ikon Gamato & logo sebagai gambar PDF yang tajam.", "Bisa sekali tempel di satu posisi atau diulang (tile) ke seluruh halaman."]}
      />
    </div>
  );
};
