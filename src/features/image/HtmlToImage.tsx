import React, { useState } from "react";
import { Code2, Loader2, Download } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { renderHtmlToCanvas } from "@/lib/htmlRender";
import { Btn, Input, Label, Textarea } from "@/components/ui/primitives";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

const TEMPLATES: Record<string, string> = {
  quote: `<div style="font-family:'Alan Sans',sans-serif;text-align:center;color:#fff;padding:32px;">
  <div style="font-size:30px;font-weight:800;line-height:1.35;margin-bottom:14px;">"Kerja keras hari ini, hasil manis nanti."</div>
  <div style="font-size:16px;opacity:.85;">— Gamato Piranti</div>
</div>`,
  badge: `<div style="font-family:'Alan Sans',sans-serif;background:#ffffff;border-radius:20px;padding:20px 32px;box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center;">
  <div style="font-size:13px;letter-spacing:2px;color:#6366f1;font-weight:700;">SERTIFIKAT DIGITAL</div>
  <div style="font-size:26px;font-weight:800;color:#0f172a;margin-top:6px;">Nama Peserta</div>
  <div style="font-size:14px;color:#64748b;margin-top:4px;">Telah menyelesaikan pelatihan</div>
</div>`,
  banner: `<div style="font-family:'Alan Sans',sans-serif;width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;padding:0 40px;color:#fff;box-sizing:border-box;">
  <div style="font-size:34px;font-weight:800;">Diskon 50%!</div>
  <div style="font-size:16px;background:#fff;color:#4f46e5;padding:10px 20px;border-radius:999px;font-weight:700;">Belanja Sekarang</div>
</div>`,
};

export const HtmlToImage: React.FC = () => {
  const [html, setHtml] = useState(TEMPLATES.quote);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(500);
  const [bg, setBg] = useState("#4f46e5");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const previewDoc = `<!doctype html><html><head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;background:${bg};width:${width}px;height:${height}px;overflow:hidden;}</style></head><body>${html}</body></html>`;

  const handleExport = async () => {
    setIsWorking(true);
    setInfo(null);
    try {
      const canvas = await renderHtmlToCanvas(html, width, height, bg);
      const blob = await canvasToBlob(canvas, "image/png");
      downloadBlob(blob, "gamato-html-to-image.png");
      setInfo("Gambar berhasil dibuat dari HTML.");
    } catch (err: any) {
      setInfo("Gagal mengekspor. Coba sederhanakan HTML (hindari gambar/font eksternal) lalu ulangi.");
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 self-center mr-1">Template:</span>
            {Object.keys(TEMPLATES).map((k) => (
              <button key={k} type="button" onClick={() => setHtml(TEMPLATES[k])} className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-3 py-1.5 rounded-lg capitalize">
                {k}
              </button>
            ))}
          </div>
          <Textarea label="Kode HTML (boleh pakai inline style)" rows={10} value={html} onChange={(e) => setHtml(e.target.value)} className="font-mono text-xs" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Preview Langsung</p>
          </div>
          <div className="p-4 flex justify-center overflow-auto bg-slate-100 dark:bg-slate-950">
            <iframe title="preview" srcDoc={previewDoc} className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white shrink-0" style={{ width, height, maxWidth: "100%" }} sandbox="" />
          </div>
        </div>

        {info && (
          <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", info.startsWith("Gagal") ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>
            {info}
          </div>
        )}

        <Btn onClick={handleExport} disabled={isWorking || !html.trim()} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Merender…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Ekspor ke PNG
            </>
          )}
        </Btn>
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Ukuran Kanvas</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Lebar (px)" type="number" min={100} max={3000} value={width} onChange={(e) => setWidth(parseInt(e.target.value) || 800)} />
            <Input label="Tinggi (px)" type="number" min={100} max={3000} value={height} onChange={(e) => setHeight(parseInt(e.target.value) || 500)} />
          </div>
          <div>
            <Label>Warna Latar</Label>
            <div className="flex items-center gap-3 mt-1.5">
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer" />
              <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{bg}</span>
            </div>
          </div>
        </div>

        <ToolInfoPanel
          icon={<Code2 className="w-5 h-5" />}
          label="HTML ke Gambar"
          desc="Render HTML/CSS jadi PNG"
          points={[
            "Ideal untuk kartu kutipan, badge, banner promo — semua dengan HTML/CSS sederhana.",
            "Gambar/font dari luar situs bisa gagal diekspor karena batasan keamanan browser; gunakan CSS/inline style untuk hasil paling stabil.",
          ]}
        />
      </div>
    </div>
  );
};
