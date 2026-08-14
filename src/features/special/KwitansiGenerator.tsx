import React, { useEffect, useMemo, useRef, useState } from "react";
import { Receipt, Download, Printer, Loader2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { sanitizeFileName, sanitizeNumberString } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { formatIDR } from "@/lib/utilityHelpers";
import { terbilangRupiah } from "@/lib/terbilang";
import { todayISODate, formatDateID } from "@/lib/dateFormat";
import { drawWrappedText, drawDashedLine, drawSolidLine, drawLogoFit, roundRect, ensureFontReady } from "@/lib/businessDocCanvas";
import { printCanvasImage } from "@/lib/printCanvas";
import { Label, Input, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PanelCard } from "@/components/ui/PanelCard";
import { LogoUpload } from "@/components/ui/LogoUpload";
import { useImageFromFile } from "@/hooks/useImageFromFile";

const ACCENT_PRESETS = ["#4f46e5", "#0f766e", "#be123c", "#b45309", "#334155"];

const W = 1400;
const H = 960;

type KwitansiData = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  nomor: string;
  receivedFrom: string;
  amount: string;
  description: string;
  date: string;
  city: string;
  receiverName: string;
  accentColor: string;
};

function renderKwitansiToCanvas(canvas: HTMLCanvasElement, logoImg: HTMLImageElement | null, data: KwitansiData) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const marginOuter = 36;
  const marginInner = 56;
  const contentX = marginInner;
  const contentRight = W - marginInner;

  ctx.strokeStyle = data.accentColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(marginOuter, marginOuter, W - marginOuter * 2, H - marginOuter * 2);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(marginOuter + 8, marginOuter + 8, W - (marginOuter + 8) * 2, H - (marginOuter + 8) * 2);

  let y = marginInner + 34;

  const logoBoxW = 150;
  const logoBoxH = 100;
  const textX = logoImg ? contentX + logoBoxW + 24 : contentX;
  if (logoImg) drawLogoFit(ctx, logoImg, contentX, y - 20, logoBoxW, logoBoxH);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 30px 'Alan Sans', sans-serif";
  ctx.fillText(data.companyName || "Nama Perusahaan", textX, y);

  ctx.font = "400 16px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#64748b";
  const textMaxWidth = contentRight - 260 - textX;
  const addrY = drawWrappedText(ctx, data.companyAddress, textX, y + 28, textMaxWidth, 22, 2);
  if (data.companyPhone) ctx.fillText(data.companyPhone, textX, addrY);

  ctx.textAlign = "right";
  ctx.font = "400 15px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("No. Kwitansi", contentRight, y - 4);
  ctx.font = "700 20px 'Alan Sans', sans-serif";
  ctx.fillStyle = data.accentColor;
  ctx.fillText(data.nomor || "-", contentRight, y + 22);

  y = marginInner + 34 + 116;
  drawSolidLine(ctx, contentX, y, contentRight, "#e2e8f0", 1.5);

  y += 64;
  ctx.textAlign = "center";
  ctx.font = "700 44px 'Alan Sans', sans-serif";
  ctx.fillStyle = data.accentColor;
  ctx.fillText("KWITANSI", W / 2, y);
  drawSolidLine(ctx, W / 2 - 100, y + 18, W / 2 + 100, data.accentColor, 3);

  y += 76;
  const labelColX = contentX;
  const valueColX = contentX + 260;
  const amountNum = parseFloat(sanitizeNumberString(data.amount || "0")) || 0;

  // Field: Telah terima dari
  ctx.textAlign = "left";
  ctx.font = "400 16px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Telah terima dari", labelColX, y);
  ctx.font = "600 21px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(data.receivedFrom || "-", valueColX, y);
  drawDashedLine(ctx, valueColX, y + 12, contentRight);

  y += 74;

  // Field: Uang sejumlah (terbilang)
  ctx.font = "400 16px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Uang sejumlah", labelColX, y);
  ctx.font = "italic 600 19px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#0f172a";
  const amountWords = `"${amountNum > 0 ? terbilangRupiah(amountNum) : "-"}"`;
  drawWrappedText(ctx, amountWords, valueColX, y, contentRight - valueColX, 27, 2);
  drawDashedLine(ctx, valueColX, y + 66, contentRight);

  y += 104;

  // Field: Untuk pembayaran
  ctx.font = "400 16px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Untuk pembayaran", labelColX, y);
  ctx.font = "600 19px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#0f172a";
  drawWrappedText(ctx, data.description || "-", valueColX, y, contentRight - valueColX, 27, 2);
  drawDashedLine(ctx, valueColX, y + 66, contentRight);

  y += 100;

  // Amount box
  const boxW = 360;
  const boxH = 78;
  const boxX = contentRight - boxW;
  ctx.fillStyle = "#f8fafc";
  roundRect(ctx, boxX, y, boxW, boxH, 12);
  ctx.fill();
  ctx.strokeStyle = data.accentColor;
  ctx.lineWidth = 2;
  roundRect(ctx, boxX, y, boxW, boxH, 12);
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.font = "600 15px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("JUMLAH", boxX + 22, y + 28);
  ctx.font = "700 32px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(formatIDR(amountNum), boxX + 22, y + 62);

  y += boxH + 74;

  // Footer: dates + signature — both columns flow downward from the same anchor, so
  // nothing can ever climb back up into the amount box above.
  ctx.textAlign = "left";
  ctx.font = "400 16px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(`Tanggal Bayar: ${formatDateID(data.date) || "-"}`, contentX, y);

  const sigX = contentRight - 190;
  ctx.textAlign = "center";
  ctx.font = "400 16px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#334155";
  const sigDateLine = [data.city, formatDateID(data.date)].filter(Boolean).join(", ");
  ctx.fillText(sigDateLine || "-", sigX, y);
  ctx.fillText("Yang Menerima,", sigX, y + 28);
  drawSolidLine(ctx, sigX - 95, y + 82, sigX + 95, "#334155", 1.5);
  ctx.font = "600 17px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(data.receiverName || "(..............................)", sigX, y + 106);
}

export function KwitansiGenerator() {
  const [companyName, setCompanyName] = useState("Nama Usaha / Perusahaan");
  const [companyAddress, setCompanyAddress] = useState("Jl. Contoh Alamat No. 123, Kota");
  const [companyPhone, setCompanyPhone] = useState("0812-3456-7890");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [nomor, setNomor] = useState(() => {
    const now = new Date();
    return `001/KWT/${now.getMonth() + 1}/${now.getFullYear()}`;
  });
  const [receivedFrom, setReceivedFrom] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayISODate());
  const [city, setCity] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [accentColor, setAccentColor] = useState(ACCENT_PRESETS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoImg = useImageFromFile(logoFile);

  const data: KwitansiData = useMemo(
    () => ({ companyName, companyAddress, companyPhone, nomor, receivedFrom, amount, description, date, city, receiverName, accentColor }),
    [companyName, companyAddress, companyPhone, nomor, receivedFrom, amount, description, date, city, receiverName, accentColor]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFontReady("Alan Sans");
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderKwitansiToCanvas(canvas, logoImg, data);
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
      downloadBlob(blob, `${sanitizeFileName(nomor) || "kwitansi"}.png`);
      setInfo("Kwitansi berhasil diunduh sebagai PNG.");
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuat kwitansi.");
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
      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `${sanitizeFileName(nomor) || "kwitansi"}.pdf`);
      setInfo("Kwitansi berhasil diunduh sebagai PDF.");
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
      printCanvasImage(canvas, { title: `Kwitansi ${nomor}` });
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuka dialog cetak.");
    }
  };

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      <div className="space-y-5">
        <PanelCard title="Identitas Perusahaan" subtitle="Tampil di kop kwitansi">
          <div className="space-y-3">
            <LogoUpload file={logoFile} onChange={setLogoFile} />
            <Input label="Nama Perusahaan / Usaha" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <Textarea label="Alamat" rows={2} value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
            <Input label="Telepon" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
            <div>
              <Label>Warna Aksen</Label>
              <div className="flex items-center gap-2 mt-1.5">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAccentColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-8 h-8 rounded-lg border-2 transition-transform ${accentColor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent"}`}
                    title={c}
                  />
                ))}
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5" />
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Detail Pembayaran" subtitle="Isi data transaksi yang akan tercetak">
          <div className="space-y-3">
            <Input label="No. Kwitansi" value={nomor} onChange={(e) => setNomor(e.target.value)} />
            <Input label="Telah Terima Dari" value={receivedFrom} onChange={(e) => setReceivedFrom(e.target.value)} placeholder="Nama pembayar" />
            <MoneyInput
              label="Jumlah (Rp)"
              value={amount}
              onChange={(v) => setAmount(v)}
              placeholder="1500000"
              prefix="Rp"
            />
            <Textarea label="Untuk Pembayaran" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: Pembayaran sewa ruko bulan Agustus 2026" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Kota" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Denpasar" />
            </div>
            <Input label="Nama Penerima (opsional)" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} placeholder="Dikosongkan = garis tanda tangan kosong" />
          </div>
        </PanelCard>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pratinjau Langsung</p>
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white">
          <canvas ref={canvasRef} className="w-full h-auto block" />
        </div>

        {info && (
          <div className="text-sm rounded-xl px-4 py-3 border font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30">
            {info}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Btn onClick={downloadPng} disabled={isGenerating} variant="secondary" className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Unduh PNG
          </Btn>
          <Btn onClick={downloadPdf} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
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
