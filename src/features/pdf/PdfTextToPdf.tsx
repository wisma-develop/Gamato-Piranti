import React, { useState } from "react";
import { AlignLeft, FileText, Loader2 } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { downloadBlob } from "@/lib/file";
import { Textarea, Btn } from "@/components/ui/primitives";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const PdfTextToPdf: React.FC = () => {
  const [textForPdf, setTextForPdf] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const handleRun = async () => {
    if (!textForPdf.trim()) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 12;
      const lineHeight = fontSize + 4;
      const margin = 50;
      const maxCharsPerLine = Math.floor((595.28 - margin * 2) / (fontSize * 0.55));
      const allLines: string[] = [];
      for (const raw of textForPdf.split(/\r?\n/)) {
        if (!raw) {
          allLines.push("");
          continue;
        }
        for (let s = 0; s < raw.length; s += maxCharsPerLine) allLines.push(raw.slice(s, s + maxCharsPerLine));
      }
      let page = pdfDoc.addPage();
      let { height } = page.getSize();
      let y = height - margin;
      const addPage = () => {
        page = pdfDoc.addPage();
        ({ height } = page.getSize());
        y = height - margin;
      };
      for (const line of allLines) {
        if (y < margin + lineHeight) addPage();
        if (line) page.drawText(line, { x: margin, y: y - lineHeight, size: fontSize, font, color: rgb(0, 0, 0) });
        y -= lineHeight;
      }
      const blob = new Blob([await pdfDoc.save()], { type: "application/pdf" });
      downloadBlob(blob, "gamato-text.pdf");
      setInfo("Teks berhasil dikonversi ke PDF.");
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <Textarea label="Teks untuk dijadikan PDF" rows={12} value={textForPdf} onChange={(e) => setTextForPdf(e.target.value)} placeholder="Tulis atau tempel teks di sini…" />
          <Btn onClick={handleRun} disabled={isWorking || !textForPdf.trim()} className="w-full py-3.5">
            {isWorking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Memproses…
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Jadikan PDF
              </>
            )}
          </Btn>
        </div>
      </div>

      <ToolInfoPanel
        icon={<AlignLeft className="w-5 h-5" />}
        label="Teks ke PDF"
        desc="Teks polos ke PDF"
        points={["Teks polos jadi PDF rapi.", "Layout sederhana, bisa dibuka di mana saja."]}
        info={info}
        infoTone={info?.includes("berhasil") ? "success" : "error"}
      />
    </div>
  );
};
