import React, { useState } from "react";
import { ListOrdered, FileText, Trash2, Loader2, Zap } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { Input, Select, Label, Btn } from "@/components/ui/primitives";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

type Position = "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";

export const PdfPageNumbers: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState("{n} / {total}");
  const [startAt, setStartAt] = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [color, setColor] = useState("#334155");
  const [position, setPosition] = useState<Position>("bottom-center");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: File[]) => {
    const pdf = incoming.find((f) => f.type === "application/pdf");
    if (pdf) setFile(pdf);
    setInfo(null);
  };

  const handleRun = async () => {
    if (!file) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const pdfDoc = await PDFDocument.load(await fileToArrayBuffer(file));
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const h = color.replace("#", "");
      const textColor = rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
      const pages = pdfDoc.getPages();
      const total = pages.length;
      const margin = 28;

      pages.forEach((page, idx) => {
        const { width } = page.getSize();
        const label = format.replace(/\{n\}/g, String(idx + startAt)).replace(/\{total\}/g, String(total));
        const textWidth = font.widthOfTextAtSize(label, fontSize);

        let x = (width - textWidth) / 2;
        if (position.endsWith("left")) x = margin;
        else if (position.endsWith("right")) x = width - margin - textWidth;

        const y = position.startsWith("top") ? page.getSize().height - margin : margin - fontSize * 0.3;
        page.drawText(label, { x, y, size: fontSize, font, color: textColor });
      });

      await stampGamatoBranding(pdfDoc);
      downloadBlob(new Blob([await pdfDoc.save()], { type: "application/pdf" }), "gamato-numbered.pdf");
      setInfo(`Nomor halaman ditambahkan ke ${total} halaman.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal menambahkan nomor halaman."));
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
          <Input label="Format" value={format} onChange={(e) => setFormat(e.target.value)} placeholder="{n} / {total}" />
          <p className="text-xs text-slate-400 dark:text-slate-500 -mt-2">
            Gunakan <code className="bg-slate-100 dark:bg-slate-800 rounded px-1">{"{n}"}</code> untuk nomor halaman dan{" "}
            <code className="bg-slate-100 dark:bg-slate-800 rounded px-1">{"{total}"}</code> untuk total halaman. Contoh: "Halaman {"{n}"}"
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Mulai dari" type="number" value={startAt} onChange={(e) => setStartAt(parseInt(e.target.value) || 1)} />
            <Input label="Ukuran Font (pt)" type="number" min={6} max={40} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value) || 11)} />
          </div>
          <div>
            <Label>Warna</Label>
            <GamatoColorPicker value={color} onChange={setColor} className="mt-1.5" />
          </div>
          <Select label="Posisi" value={position} onChange={(e) => setPosition(e.target.value as Position)}>
            <option value="bottom-center">Bawah Tengah</option>
            <option value="bottom-right">Bawah Kanan</option>
            <option value="bottom-left">Bawah Kiri</option>
            <option value="top-center">Atas Tengah</option>
            <option value="top-right">Atas Kanan</option>
            <option value="top-left">Atas Kiri</option>
          </Select>
        </div>

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={handleRun} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Tambahkan Nomor Halaman
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<ListOrdered className="w-5 h-5" />}
        label="Nomor Halaman"
        desc="Tambahkan ke semua halaman"
        points={["Format bebas diatur, bisa mulai dari angka berapa saja.", "Posisi bisa dipilih di 6 titik berbeda."]}
      />
    </div>
  );
};
