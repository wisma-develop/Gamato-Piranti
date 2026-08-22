import React, { useEffect, useRef, useState } from "react";
import { IdCard, Download, Printer, Loader2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { sanitizeFileName } from "@/utils/sanitize";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { drawWrappedText, drawLogoFit, ensureFontReady } from "@/lib/businessDocCanvas";
import { printCanvasImage } from "@/lib/printCanvas";
import { Label, Input, Btn, SectionBadge } from "@/components/ui/primitives";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { PanelCard } from "@/components/ui/PanelCard";
import { LogoUpload } from "@/components/ui/LogoUpload";
import { useImageFromFile } from "@/hooks/useImageFromFile";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

const ACCENT_PRESETS = ["#4f46e5", "#0f766e", "#be123c", "#b45309", "#334155", "#7c3aed"];

const W = 1050;
const H = 600;

type CardData = {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  accentColor: string;
};

function renderCardToCanvas(canvas: HTMLCanvasElement, logoImg: HTMLImageElement | null, data: CardData) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Accent vertical bar on the left edge
  const barW = 18;
  ctx.fillStyle = data.accentColor;
  ctx.fillRect(0, 0, barW, H);

  const contentX = barW + 60;
  const contentRight = W - 60;
  let y = 90;

  const logoBoxW = 90;
  const logoBoxH = 90;
  if (logoImg) {
    drawLogoFit(ctx, logoImg, contentRight - logoBoxW, 50, logoBoxW, logoBoxH);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 46px 'Alan Sans', sans-serif";
  ctx.fillText(data.name || "Nama Lengkap", contentX, y);

  y += 42;
  ctx.font = "600 24px 'Alan Sans', sans-serif";
  ctx.fillStyle = data.accentColor;
  ctx.fillText(data.title || "Jabatan", contentX, y);

  y += 30;
  ctx.font = "700 20px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText(data.company || "Nama Perusahaan", contentX, y);

  // Divider
  y += 40;
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(contentX, y);
  ctx.lineTo(contentRight, y);
  ctx.stroke();

  y += 44;
  ctx.font = "400 19px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#475569";

  const lines = [data.phone, data.email, data.website].filter(Boolean);
  for (const line of lines) {
    ctx.fillText(line, contentX, y);
    y += 30;
  }

  if (data.address.trim()) {
    ctx.font = "400 17px 'Alan Sans', sans-serif";
    ctx.fillStyle = "#94a3b8";
    drawWrappedText(ctx, data.address, contentX, y, contentRight - contentX, 22, 2);
  }
}

export function BusinessCardGenerator() {
  // Semua field kartu nama punya riwayat Undo/Redo. Mengetik digabung jadi
  // satu langkah setelah jeda; pilih warna preset/upload logo langsung commit.
  const history = useHistoryState<CardData>({
    name: "Nama Lengkap",
    title: "Jabatan / Posisi",
    company: "Nama Usaha / Perusahaan",
    phone: "0812-3456-7890",
    email: "nama@usaha.com",
    website: "www.usaha.com",
    address: "",
    accentColor: ACCENT_PRESETS[0],
  });
  const data = history.state;
  const { schedule: scheduleCommit } = useDebouncedCommit(history.commit, 600);
  const updateField = <K extends keyof CardData>(key: K, value: CardData[K], opts?: { continuous?: boolean }) => {
    history.set((prev) => ({ ...prev, [key]: value }), { commit: !opts?.continuous });
    if (opts?.continuous) scheduleCommit();
  };

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoImg = useImageFromFile(logoFile);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFontReady("Alan Sans");
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderCardToCanvas(canvas, logoImg, data);
    })();
    return () => {
      cancelled = true;
    };
  }, [data, logoImg]);

  const downloadPng = async () => {
    setInfo(null);
    setIsGenerating(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, `${sanitizeFileName(data.name) || "kartu-nama"}.png`);
      setInfo("Kartu nama berhasil diunduh sebagai PNG.");
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuat kartu nama.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPdf = async () => {
    setInfo(null);
    setIsGenerating(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const blob = await canvasToBlob(canvas);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const pdfDoc = await PDFDocument.create();
      const img = await pdfDoc.embedPng(bytes);
      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      await stampGamatoBranding(pdfDoc);
      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `${sanitizeFileName(data.name) || "kartu-nama"}.pdf`);
      setInfo("Kartu nama berhasil diunduh sebagai PDF.");
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuat PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  const printNow = () => {
    setInfo(null);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      printCanvasImage(canvas, { title: `Kartu Nama ${data.name}` });
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuka dialog cetak.");
    }
  };

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor Kartu Nama</span>
          <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} />
        </div>

        <PanelCard title="Identitas" subtitle="Data pemilik kartu nama">
          <div className="space-y-3">
            <LogoUpload file={logoFile} onChange={setLogoFile} />
            <Input label="Nama Lengkap" value={data.name} onChange={(e) => updateField("name", e.target.value, { continuous: true })} />
            <Input label="Jabatan / Posisi" value={data.title} onChange={(e) => updateField("title", e.target.value, { continuous: true })} />
            <Input label="Nama Perusahaan" value={data.company} onChange={(e) => updateField("company", e.target.value, { continuous: true })} />
            <div>
              <Label>Warna Aksen</Label>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateField("accentColor", c)}
                    style={{ backgroundColor: c }}
                    className={`shrink-0 w-8 h-8 rounded-lg border-2 transition-transform ${data.accentColor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent"}`}
                    title={c}
                  />
                ))}
                <GamatoColorPicker value={data.accentColor} onChange={(hex) => updateField("accentColor", hex, { continuous: true })} className="shrink-0" />
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Kontak" subtitle="Tampil di bagian bawah kartu">
          <div className="space-y-3">
            <Input label="Telepon" value={data.phone} onChange={(e) => updateField("phone", e.target.value, { continuous: true })} />
            <Input label="Email" value={data.email} onChange={(e) => updateField("email", e.target.value, { continuous: true })} />
            <Input label="Website" value={data.website} onChange={(e) => updateField("website", e.target.value, { continuous: true })} />
            <Input label="Alamat (opsional)" value={data.address} onChange={(e) => updateField("address", e.target.value, { continuous: true })} placeholder="Alamat singkat" />
          </div>
        </PanelCard>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pratinjau Langsung</p>
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white max-w-lg mx-auto">
          <canvas ref={canvasRef} className="w-full h-auto block" />
        </div>

        {info && <GamatoInlineAlert message={info} tone="success" />}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
          <Btn onClick={downloadPng} disabled={isGenerating} variant="secondary" className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Unduh PNG
          </Btn>
          <Btn onClick={downloadPdf} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <IdCard className="w-4 h-4" />}
            Unduh PDF
          </Btn>
          <Btn onClick={printNow} variant="secondary" className="gap-2">
            <Printer className="w-4 h-4" />
            Cetak
          </Btn>
        </div>

        <div className="text-center">
          <SectionBadge>Diproses langsung di perangkatmu</SectionBadge>
        </div>
      </div>
    </div>
  );
}
