import React, { useState } from "react";
import { Code2, Loader2, Download } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { downloadBlob } from "@/lib/file";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { renderHtmlToCanvas } from "@/lib/htmlRender";
import { Btn, Input, Label, Textarea } from "@/components/ui/primitives";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { msgStarts, tr } from "@/i18n";

const DEFAULT_HTML = tr("<div style=\"font-family:'Alan Sans',sans-serif;padding:48px;color:#0f172a;\">\n  <div style=\"font-size:13px;letter-spacing:3px;color:#4f46e5;font-weight:800;\">GAMATO PIRANTI</div>\n  <div style=\"font-size:34px;font-weight:800;margin-top:10px;\">Invoice #001</div>\n  <div style=\"font-size:15px;color:#64748b;margin-top:6px;\">Dibuat langsung dari HTML — full custom.</div>\n</div>");

export const PdfHtmlToPdf: React.FC = () => {
  const [html, setHtml] = useState(DEFAULT_HTML);
  const [width, setWidth] = useState(794); // A4 @ ~96dpi in px
  const [height, setHeight] = useState(1123);
  const [bg, setBg] = useState("#ffffff");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const previewDoc = `<!doctype html><html><head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;background:${bg};width:${width}px;height:${height}px;overflow:hidden;}</style></head><body>${html}</body></html>`;

  const handleExport = async () => {
    setIsWorking(true);
    setInfo(null);
    try {
      const canvas = await renderHtmlToCanvas(html, width, height, bg);
      const dataUrl = canvas.toDataURL("image/png");
      const pngBytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));

      const pdfDoc = await PDFDocument.create();
      const img = await pdfDoc.embedPng(pngBytes);
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(img, { x: 0, y: 0, width, height });

      await stampGamatoBranding(pdfDoc);
      downloadBlob(new Blob([await pdfDoc.save()], { type: "application/pdf" }), "gamato-html-to-pdf.pdf");
      setInfo(tr("PDF berhasil dibuat dari HTML."));
    } catch (err: any) {
      setInfo(tr("Gagal mengekspor. Coba sederhanakan HTML (hindari gambar/font eksternal) lalu ulangi."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <Textarea label={tr("Kode HTML (boleh pakai inline style)")} rows={10} value={html} onChange={(e) => setHtml(e.target.value)} className="font-mono text-xs" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Preview Langsung")}</p>
          </div>
          <div className="p-4 flex justify-center overflow-auto bg-slate-100 dark:bg-slate-950" style={{ maxHeight: 480 }}>
            <iframe title="preview" srcDoc={previewDoc} className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white shrink-0" style={{ width, height: Math.min(height, 900) }} sandbox="" />
          </div>
        </div>

        {info && <GamatoInlineAlert message={info} tone={msgStarts(info, "Gagal") ? "error" : "success"} />}

        <Btn onClick={handleExport} disabled={isWorking || !html.trim()} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {tr("Merender…")}
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              {tr("Ekspor ke PDF")}
            </>
          )}
        </Btn>
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Ukuran Halaman")}</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label={tr("Lebar (px)")} type="number" min={200} max={3000} value={width} onChange={(e) => setWidth(parseInt(e.target.value) || 794)} />
            <Input label={tr("Tinggi (px)")} type="number" min={200} max={5000} value={height} onChange={(e) => setHeight(parseInt(e.target.value) || 1123)} />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">{tr("Default 794×1123px ≈ ukuran A4.")}</p>
          <div>
            <Label>{tr("Warna Latar")}</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <GamatoColorPicker value={bg} onChange={setBg} />
              <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{bg}</span>
            </div>
          </div>
        </div>

        <ToolInfoPanel
          icon={<Code2 className="w-5 h-5" />}
          label={tr("HTML ke PDF")}
          desc={tr("Render HTML/CSS jadi PDF")}
          points={[tr("Cocok untuk invoice, surat, sertifikat, atau dokumen custom lain berbasis HTML/CSS."), tr("Gambar/font eksternal bisa gagal — pakai inline style untuk hasil paling stabil.")]}
        />
      </div>
    </div>
  );
};
