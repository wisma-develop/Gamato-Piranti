import React, { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag, Download, Printer, Usb, Loader2, Plus, Trash2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { cn } from "@/utils/cn";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { sanitizeFileName, sanitizeNumberString } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { formatIDR } from "@/lib/utilityHelpers";
import { todayISODate, formatDateID, nowTimeHHMM } from "@/lib/dateFormat";
import { drawDashedLine, drawLogoFit, ensureFontReady, wrapText } from "@/lib/businessDocCanvas";
import { printCanvasImage } from "@/lib/printCanvas";
import { buildReceiptPrintJob } from "@/lib/escpos";
import { isWebUsbSupported, printViaWebUsb, WebUsbPrintError } from "@/lib/webUsbPrinter";
import { DEFAULT_FONT_FAMILY } from "@/lib/fontPresets";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { FontPicker } from "@/components/ui/FontPicker";
import { Input, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PanelCard } from "@/components/ui/PanelCard";
import { LogoUpload } from "@/components/ui/LogoUpload";
import { useImageFromFile } from "@/hooks/useImageFromFile";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

type StrukItem = { id: string; name: string; qty: string; price: string };

let itemCounter = 0;
const newItemId = () => `struk-item-${Date.now()}-${itemCounter++}`;

function defaultItems(): StrukItem[] {
  return [
    { id: newItemId(), name: "Kopi Susu Gula Aren", qty: "2", price: "18000" },
    { id: newItemId(), name: "Roti Bakar Cokelat Keju", qty: "1", price: "15000" },
  ];
}

const PADDING = 20;

type StrukData = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  paperWidth: 384 | 576;
  transactionNo: string;
  cashierName: string;
  date: string;
  items: StrukItem[];
  discountPct: string;
  taxPct: string;
  amountPaid: string;
  footerMessage: string;
  fontFamily: string;
};

function computeStrukTotals(items: StrukItem[], discountPct: number, taxPct: number, amountPaid: number) {
  const subtotal = items.reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(sanitizeNumberString(it.price)) || 0), 0);
  const discountAmount = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * (taxPct / 100);
  const total = afterDiscount + taxAmount;
  const change = amountPaid > 0 ? amountPaid - total : 0;
  return { subtotal, discountAmount, taxAmount, total, change };
}

function renderStrukToCanvas(canvas: HTMLCanvasElement, logoImg: HTMLImageElement | null, data: StrukData) {
  const W = data.paperWidth;
  const contentX = PADDING;
  const contentRight = W - PADDING;
  const contentWidth = contentRight - contentX;

  canvas.width = W;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const discountPct = parseFloat(sanitizeNumberString(data.discountPct || "0")) || 0;
  const taxPct = parseFloat(sanitizeNumberString(data.taxPct || "0")) || 0;
  const amountPaid = parseFloat(sanitizeNumberString(data.amountPaid || "0")) || 0;
  const { subtotal, discountAmount, taxAmount, total, change } = computeStrukTotals(data.items, discountPct, taxPct, amountPaid);
  const items: StrukItem[] = data.items.length ? data.items : [{ id: "placeholder", name: "Belum ada item", qty: "0", price: "0" }];

  // ── Measurement pass (uses real ctx.measureText so narrow-paper wrapping is exact) ──
  let y = PADDING;
  const logoBoxW = Math.min(160, contentWidth);
  const logoBoxH = 70;
  if (logoImg) y += logoBoxH + 12;

  ctx.font = `700 20px '${data.fontFamily}', sans-serif`;
  y += 24;

  ctx.font = `400 13px '${data.fontFamily}', sans-serif`;
  const addrLines = wrapText(ctx, data.companyAddress, contentWidth).slice(0, 2);
  y += addrLines.length * 17;
  if (data.companyPhone) y += 17;

  y += 10;
  y += 16; // dashed rule 1

  ctx.font = `400 13px '${data.fontFamily}', sans-serif`;
  y += 17; // no. transaksi
  if (data.cashierName) y += 17;
  y += 17; // tanggal & waktu

  y += 10;
  y += 16; // dashed rule 2

  ctx.font = `400 15px '${data.fontFamily}', sans-serif`;
  const itemLayout: { nameLines: string[] }[] = [];
  items.forEach((item) => {
    const nameLines = wrapText(ctx, item.name || "-", contentWidth).slice(0, 2);
    itemLayout.push({ nameLines });
    y += nameLines.length * 19;
    y += 18;
    y += 8;
  });

  y += 4;
  y += 16; // dashed rule 3

  let totalsRows = 1;
  if (discountPct > 0) totalsRows++;
  if (taxPct > 0) totalsRows++;
  y += totalsRows * 20;
  y += 8;
  y += 34; // TOTAL row
  if (amountPaid > 0) {
    y += 20;
    y += 20;
  }

  y += 12;
  y += 18; // dashed rule 4

  const footerLines = data.footerMessage.trim() ? wrapText(ctx, data.footerMessage, contentWidth).slice(0, 3) : [];
  y += footerLines.length * 17;

  y += PADDING + 16;
  const H = Math.ceil(y);

  // ── Draw pass (reuses the exact wrapped lines measured above) ──
  canvas.height = H;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0f172a";

  let dy = PADDING;
  if (logoImg) {
    drawLogoFit(ctx, logoImg, contentX + (contentWidth - logoBoxW) / 2, dy, logoBoxW, logoBoxH);
    dy += logoBoxH + 12;
  }

  ctx.textAlign = "center";
  ctx.font = `700 20px '${data.fontFamily}', sans-serif`;
  ctx.fillText(data.companyName || "Nama Usaha", W / 2, dy + 18);
  dy += 24;

  ctx.font = `400 13px '${data.fontFamily}', sans-serif`;
  ctx.fillStyle = "#475569";
  addrLines.forEach((line, i) => ctx.fillText(line, W / 2, dy + 12 + i * 17));
  dy += addrLines.length * 17;
  if (data.companyPhone) {
    ctx.fillText(data.companyPhone, W / 2, dy + 12);
    dy += 17;
  }

  dy += 10;
  drawDashedLine(ctx, contentX, dy, contentRight);
  dy += 16;

  ctx.textAlign = "left";
  ctx.font = `400 13px '${data.fontFamily}', sans-serif`;
  ctx.fillStyle = "#334155";
  ctx.fillText(`No. Transaksi: ${data.transactionNo || "-"}`, contentX, dy + 10);
  dy += 17;
  if (data.cashierName) {
    ctx.fillText(`Kasir: ${data.cashierName}`, contentX, dy + 10);
    dy += 17;
  }
  ctx.fillText(`${formatDateID(data.date) || "-"}, ${nowTimeHHMM()}`, contentX, dy + 10);
  dy += 17;

  dy += 10;
  drawDashedLine(ctx, contentX, dy, contentRight);
  dy += 16;

  items.forEach((item, idx) => {
    const layout = itemLayout[idx];
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(sanitizeNumberString(item.price)) || 0;
    const rowSubtotal = qty * price;

    ctx.textAlign = "left";
    ctx.font = `600 15px '${data.fontFamily}', sans-serif`;
    ctx.fillStyle = "#0f172a";
    layout.nameLines.forEach((line, i) => ctx.fillText(line, contentX, dy + 14 + i * 19));
    dy += layout.nameLines.length * 19;

    ctx.font = `400 14px '${data.fontFamily}', sans-serif`;
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.fillText(`${qty} x ${formatIDR(price)}`, contentX + 8, dy + 12);
    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = `600 14px '${data.fontFamily}', sans-serif`;
    ctx.fillText(formatIDR(rowSubtotal), contentRight, dy + 12);
    dy += 18 + 8;
  });

  dy += 4;
  drawDashedLine(ctx, contentX, dy, contentRight);
  dy += 16;

  const totalsLine = (label: string, value: string) => {
    ctx.textAlign = "left";
    ctx.font = `400 14px '${data.fontFamily}', sans-serif`;
    ctx.fillStyle = "#64748b";
    ctx.fillText(label, contentX, dy + 10);
    ctx.textAlign = "right";
    ctx.font = `600 14px '${data.fontFamily}', sans-serif`;
    ctx.fillStyle = "#0f172a";
    ctx.fillText(value, contentRight, dy + 10);
    dy += 20;
  };

  totalsLine("Subtotal", formatIDR(subtotal));
  if (discountPct > 0) totalsLine(`Diskon (${discountPct}%)`, `- ${formatIDR(discountAmount)}`);
  if (taxPct > 0) totalsLine(`Pajak/PPN (${taxPct}%)`, formatIDR(taxAmount));

  dy += 8;
  ctx.textAlign = "left";
  ctx.font = `700 18px '${data.fontFamily}', sans-serif`;
  ctx.fillStyle = "#0f172a";
  ctx.fillText("TOTAL", contentX, dy + 16);
  ctx.textAlign = "right";
  ctx.font = `700 20px '${data.fontFamily}', sans-serif`;
  ctx.fillText(formatIDR(total), contentRight, dy + 17);
  dy += 34;

  if (amountPaid > 0) {
    totalsLine("Bayar", formatIDR(amountPaid));
    ctx.textAlign = "left";
    ctx.font = `400 14px '${data.fontFamily}', sans-serif`;
    ctx.fillStyle = change >= 0 ? "#64748b" : "#dc2626";
    ctx.fillText(change >= 0 ? "Kembalian" : "Kurang Bayar", contentX, dy + 10);
    ctx.textAlign = "right";
    ctx.font = `600 14px '${data.fontFamily}', sans-serif`;
    ctx.fillStyle = change >= 0 ? "#0f172a" : "#dc2626";
    ctx.fillText(formatIDR(Math.abs(change)), contentRight, dy + 10);
    dy += 20;
  }

  dy += 12;
  drawDashedLine(ctx, contentX, dy, contentRight);
  dy += 18;

  ctx.textAlign = "center";
  ctx.font = `italic 400 13px '${data.fontFamily}', sans-serif`;
  ctx.fillStyle = "#64748b";
  footerLines.forEach((line, i) => ctx.fillText(line, W / 2, dy + 10 + i * 17));
}

type StrukFormData = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  paperWidth: "58" | "80";
  transactionNo: string;
  cashierName: string;
  date: string;
  items: StrukItem[];
  discountPct: string;
  taxPct: string;
  amountPaid: string;
  footerMessage: string;
  fontFamily: string;
};

export function StrukGenerator() {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  // Semua field struk (kop usaha, info transaksi, daftar item, diskon/pajak)
  // punya riwayat Undo/Redo. Tambah/hapus item & pilih lebar kertas langsung
  // commit; mengetik nama/harga/qty digabung jadi satu langkah setelah jeda.
  const history = useHistoryState<StrukFormData>(() => ({
    companyName: "Nama Usaha",
    companyAddress: "Jl. Contoh Alamat No. 123, Kota",
    companyPhone: "0812-3456-7890",
    paperWidth: "58",
    transactionNo: `TRX-${Date.now().toString().slice(-8)}`,
    cashierName: "",
    date: todayISODate(),
    items: defaultItems(),
    discountPct: "0",
    taxPct: "0",
    amountPaid: "",
    footerMessage: "Terima kasih atas kunjungan Anda!",
    fontFamily: DEFAULT_FONT_FAMILY,
  }));
  const form = history.state;
  const { schedule: scheduleCommit } = useDebouncedCommit(history.commit, 600);
  const updateField = <K extends keyof StrukFormData>(key: K, value: StrukFormData[K], opts?: { continuous?: boolean }) => {
    history.set((prev) => ({ ...prev, [key]: value }), { commit: !opts?.continuous });
    if (opts?.continuous) scheduleCommit();
  };
  const updateItem = (id: string, patch: Partial<StrukItem>, opts?: { continuous?: boolean }) => {
    history.set((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }), { commit: !opts?.continuous });
    if (opts?.continuous) scheduleCommit();
  };
  const addItem = () => history.set((prev) => ({ ...prev, items: [...prev.items, { id: newItemId(), name: "Item baru", qty: "1", price: "0" }] }));
  const removeItem = (id: string) => history.set((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== id) }));

  const { customFonts, isFontLoading, fontError, addCustomFont, removeCustomFont } = useCustomFonts();
  const handleRemoveCustomFont = (id: string) => {
    removeCustomFont(id, (fallback) => {
      if (form.fontFamily === id) updateField("fontFamily", fallback);
    });
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoImg = useImageFromFile(logoFile);
  const webUsbOk = useMemo(() => isWebUsbSupported(), []);

  const data: StrukData = useMemo(
    () => ({
      companyName: form.companyName,
      companyAddress: form.companyAddress,
      companyPhone: form.companyPhone,
      paperWidth: form.paperWidth === "58" ? 384 : 576,
      transactionNo: form.transactionNo,
      cashierName: form.cashierName,
      date: form.date,
      items: form.items,
      discountPct: form.discountPct,
      taxPct: form.taxPct,
      amountPaid: form.amountPaid,
      footerMessage: form.footerMessage,
      fontFamily: form.fontFamily,
    }),
    [form]
  );

  const totals = useMemo(
    () =>
      computeStrukTotals(
        form.items,
        parseFloat(sanitizeNumberString(form.discountPct || "0")) || 0,
        parseFloat(sanitizeNumberString(form.taxPct || "0")) || 0,
        parseFloat(sanitizeNumberString(form.amountPaid || "0")) || 0
      ),
    [form.items, form.discountPct, form.taxPct, form.amountPaid]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFontReady(form.fontFamily);
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderStrukToCanvas(canvas, logoImg, data);
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
      downloadBlob(blob, `${sanitizeFileName(form.transactionNo) || "struk"}.png`);
      setInfo("Struk berhasil diunduh sebagai PNG.");
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuat struk.");
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
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `${sanitizeFileName(form.transactionNo) || "struk"}.pdf`);
      setInfo("Struk berhasil diunduh sebagai PDF.");
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuat PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  const printDialog = () => {
    setInfo(null);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      printCanvasImage(canvas, { widthMm: form.paperWidth === "58" ? 58 : 80, title: `Struk ${form.transactionNo}` });
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuka dialog cetak.");
    }
  };

  const printDirectUsb = async () => {
    setInfo(null);
    setIsPrinting(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const jobBytes = buildReceiptPrintJob(canvas);
      await printViaWebUsb(jobBytes);
      setInfo("Struk berhasil dikirim ke printer USB.");
    } catch (err: any) {
      setInfo(err instanceof WebUsbPrintError ? err.message : "Gagal mencetak langsung. Gunakan 'Cetak (Dialog Browser)' sebagai alternatif.");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor Struk</span>
          <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} />
        </div>

        <PanelCard title="Identitas Usaha" subtitle="Tampil di kop struk">
          <div className="space-y-3">
            <LogoUpload file={logoFile} onChange={setLogoFile} label="Logo Usaha" />
            <Input label="Nama Usaha" value={form.companyName} onChange={(e) => updateField("companyName", e.target.value, { continuous: true })} />
            <Textarea label="Alamat" rows={2} value={form.companyAddress} onChange={(e) => updateField("companyAddress", e.target.value, { continuous: true })} />
            <Input label="Telepon" value={form.companyPhone} onChange={(e) => updateField("companyPhone", e.target.value, { continuous: true })} />
            <FontPicker
              value={form.fontFamily}
              onChange={(family) => updateField("fontFamily", family)}
              customFonts={customFonts}
              isFontLoading={isFontLoading}
              fontError={fontError}
              onUpload={addCustomFont}
              onRemoveCustomFont={handleRemoveCustomFont}
            />
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Lebar Kertas</p>
              <div className="grid grid-cols-2 gap-2">
                {(["58", "80"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => updateField("paperWidth", w)}
                    className={cn(
                      "py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                      form.paperWidth === w
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                    )}
                  >
                    {w}mm
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Info Transaksi" subtitle="Nomor, kasir, dan tanggal">
          <div className="space-y-3">
            <Input label="No. Transaksi" value={form.transactionNo} onChange={(e) => updateField("transactionNo", e.target.value, { continuous: true })} />
            <Input label="Nama Kasir (opsional)" value={form.cashierName} onChange={(e) => updateField("cashierName", e.target.value, { continuous: true })} />
            <Input label="Tanggal" type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} />
          </div>
        </PanelCard>

        <PanelCard title="Item Belanja" subtitle="Tambah baris sebanyak yang dibutuhkan">
          <div className="space-y-3">
            {form.items.map((item) => (
              <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={item.name} onChange={(e) => updateItem(item.id, { name: e.target.value }, { continuous: true })} placeholder="Nama barang" className="flex-1" />
                  <button type="button" onClick={() => removeItem(item.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MoneyInput label="Qty" value={item.qty} onChange={(v) => updateItem(item.id, { qty: v }, { continuous: true })} placeholder="1" />
                  <MoneyInput label="Harga (Rp)" value={item.price} onChange={(v) => updateItem(item.id, { price: v }, { continuous: true })} placeholder="0" prefix="Rp" />
                </div>
              </div>
            ))}
            <Btn onClick={addItem} variant="secondary" className="w-full gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Tambah Item
            </Btn>
          </div>
        </PanelCard>

        <PanelCard title="Diskon, Pajak & Pembayaran" subtitle="Opsional">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Diskon (%)" value={form.discountPct} onChange={(e) => updateField("discountPct", sanitizeNumberString(e.target.value), { continuous: true })} />
              <Input label="Pajak (%)" value={form.taxPct} onChange={(e) => updateField("taxPct", sanitizeNumberString(e.target.value), { continuous: true })} />
            </div>
            <MoneyInput label="Jumlah Dibayar (Rp)" value={form.amountPaid} onChange={(v) => updateField("amountPaid", v, { continuous: true })} placeholder="Kosongkan bila tidak perlu ditampilkan" prefix="Rp" />
            <Textarea label="Pesan Footer" rows={2} value={form.footerMessage} onChange={(e) => updateField("footerMessage", e.target.value, { continuous: true })} />
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
              Total saat ini: <span className="font-bold text-slate-800 dark:text-slate-100">{formatIDR(totals.total)}</span>
            </div>
          </div>
        </PanelCard>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pratinjau Langsung</p>
        <div className="flex justify-center bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="rounded-xl overflow-hidden shadow-lg bg-white" style={{ maxWidth: form.paperWidth === "58" ? 300 : 380 }}>
            <canvas ref={canvasRef} className="w-full h-auto block" />
          </div>
        </div>

        {info && <GamatoInlineAlert message={info} tone="success" />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Btn onClick={downloadPng} disabled={isGenerating} variant="secondary" className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Unduh PNG
          </Btn>
          <Btn onClick={downloadPdf} disabled={isGenerating} variant="secondary" className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
            Unduh PDF
          </Btn>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Btn onClick={printDialog} className="gap-2">
            <Printer className="w-4 h-4" />
            Cetak (Dialog Browser)
          </Btn>
          <Btn onClick={printDirectUsb} disabled={!webUsbOk || isPrinting} variant="secondary" className="gap-2" title={webUsbOk ? "Eksperimental — kirim langsung ke printer thermal USB" : "Tidak didukung di browser ini"}>
            {isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Usb className="w-4 h-4" />}
            Cetak Langsung USB
          </Btn>
        </div>

        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p>
            <strong>Cetak (Dialog Browser)</strong> bekerja dengan printer apa pun yang sudah terpasang di sistem — baik tersambung USB maupun sudah dipasangkan (paired) via Bluetooth.
          </p>
          <p>
            <strong>Cetak Langsung USB</strong> bersifat eksperimental (Chrome/Edge desktop saja) dan hanya berhasil pada sebagian printer thermal generik ESC/POS — gagal jika printer sudah terpasang sebagai printer sistem.
            {!webUsbOk && " Browser ini tidak mendukung WebUSB, gunakan Cetak (Dialog Browser)."}
          </p>
        </div>

        <div className="text-center">
          <SectionBadge>Diproses langsung di perangkatmu</SectionBadge>
        </div>
      </div>
    </div>
  );
}
