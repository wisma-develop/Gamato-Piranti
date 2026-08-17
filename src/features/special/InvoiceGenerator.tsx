import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Download, Printer, Loader2, Plus, Trash2 } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { cn } from "@/utils/cn";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { sanitizeFileName, sanitizeNumberString } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { formatIDR } from "@/lib/utilityHelpers";
import { todayISODate, formatDateID } from "@/lib/dateFormat";
import { drawWrappedText, drawSolidLine, drawLogoFit, roundRect, ensureFontReady, wrapText } from "@/lib/businessDocCanvas";
import { printCanvasImage } from "@/lib/printCanvas";
import { Label, Input, Textarea, Select, Btn, SectionBadge } from "@/components/ui/primitives";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PanelCard } from "@/components/ui/PanelCard";
import { LogoUpload } from "@/components/ui/LogoUpload";
import { useImageFromFile } from "@/hooks/useImageFromFile";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";

const ACCENT_PRESETS = ["#4f46e5", "#0f766e", "#be123c", "#b45309", "#334155"];

type InvoiceItem = { id: string; desc: string; qty: string; price: string };

let itemCounter = 0;
const newItemId = () => `inv-item-${Date.now()}-${itemCounter++}`;

function defaultItems(): InvoiceItem[] {
  return [
    { id: newItemId(), desc: "Jasa Desain Logo", qty: "1", price: "1500000" },
    { id: newItemId(), desc: "Jasa Pengembangan Website", qty: "1", price: "5000000" },
  ];
}

const W = 1240;
const MARGIN = 70;
const HEADER_H = 230;
const GAP_AFTER_HEADER = 36;
const INFO_H = 150;
const TABLE_HEADER_H = 46;
const ROW_H = 46;
const GAP_AFTER_TABLE = 34;
const TOTALS_ROW_H = 34;
const GAP_BEFORE_TOTAL_BOX = 8;
const TOTAL_BOX_H = 60;
const GAP_AFTER_TOTAL_BOX = 50;
const NOTES_LABEL_GAP = 22;
const NOTES_LINE_H = 20;
const NOTES_AFTER_GAP = 20;
const THANKYOU_GAP = 20;
const BOTTOM_MARGIN = 44;

type InvoiceData = {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  status: "lunas" | "belum" | "";
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  items: InvoiceItem[];
  discountPct: string;
  taxPct: string;
  notes: string;
  accentColor: string;
};

function computeTotals(items: InvoiceItem[], discountPct: number, taxPct: number) {
  const subtotal = items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(sanitizeNumberString(it.price)) || 0), 0);
  const discountAmount = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * (taxPct / 100);
  const total = afterDiscount + taxAmount;
  return { subtotal, discountAmount, taxAmount, total };
}

function estimateLineCount(text: string, charsPerLine = 100): number {
  if (!text.trim()) return 0;
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

function renderInvoiceToCanvas(canvas: HTMLCanvasElement, logoImg: HTMLImageElement | null, data: InvoiceData) {
  const contentX = MARGIN;
  const contentRight = W - MARGIN;
  const contentWidth = contentRight - contentX;

  const discountPct = parseFloat(sanitizeNumberString(data.discountPct || "0")) || 0;
  const taxPct = parseFloat(sanitizeNumberString(data.taxPct || "0")) || 0;
  const { subtotal, discountAmount, taxAmount, total } = computeTotals(data.items, discountPct, taxPct);
  const totalsRows = 1 + (discountPct > 0 ? 1 : 0) + (taxPct > 0 ? 1 : 0);

  const items: InvoiceItem[] = data.items.length ? data.items : [{ id: "placeholder", desc: "Belum ada item", qty: "0", price: "0" }];
  const hasNotes = !!data.notes.trim();
  const notesLines = Math.min(estimateLineCount(data.notes), 3);

  // ── Layout pass: compute every Y coordinate once, up front ──────────────
  const yHeaderTop = 60;
  const yDivider1 = yHeaderTop + HEADER_H;
  const yInfoTop = yDivider1 + GAP_AFTER_HEADER;
  const yTableTop = yInfoTop + INFO_H;
  const yTableHeaderBottom = yTableTop + TABLE_HEADER_H;
  const yItemsBottom = yTableHeaderBottom + items.length * ROW_H;
  const yDivider2 = yItemsBottom;
  const yTotalsTop = yDivider2 + GAP_AFTER_TABLE;
  const yTotalBoxTop = yTotalsTop + totalsRows * TOTALS_ROW_H + GAP_BEFORE_TOTAL_BOX;
  const yAfterTotalBox = yTotalBoxTop + TOTAL_BOX_H + GAP_AFTER_TOTAL_BOX;
  const yNotesLabel = yAfterTotalBox;
  const yNotesBodyTop = yNotesLabel + (hasNotes ? NOTES_LABEL_GAP : 0);
  const yAfterNotes = hasNotes ? yNotesBodyTop + notesLines * NOTES_LINE_H + NOTES_AFTER_GAP : yNotesLabel;
  const yThankYou = yAfterNotes + THANKYOU_GAP;
  const H = yThankYou + BOTTOM_MARGIN;

  canvas.width = W;
  canvas.height = Math.round(H);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // ── Header ──
  const logoBoxW = 130;
  const logoBoxH = 90;
  const textX = logoImg ? contentX + logoBoxW + 22 : contentX;
  if (logoImg) drawLogoFit(ctx, logoImg, contentX, yHeaderTop, logoBoxW, logoBoxH);

  ctx.textAlign = "left";
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 24px 'Alan Sans', sans-serif";
  ctx.fillText(data.companyName || "Nama Perusahaan", textX, yHeaderTop + 22);
  ctx.font = "400 14px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#64748b";
  const compAddrMaxW = contentRight - 360 - textX;
  const compY = drawWrappedText(ctx, data.companyAddress, textX, yHeaderTop + 46, compAddrMaxW, 19, 2);
  const contactLine = [data.companyPhone, data.companyEmail].filter(Boolean).join(" · ");
  if (contactLine) ctx.fillText(contactLine, textX, compY);

  ctx.textAlign = "right";
  ctx.font = "700 38px 'Alan Sans', sans-serif";
  ctx.fillStyle = data.accentColor;
  ctx.fillText("INVOICE", contentRight, yHeaderTop + 30);

  ctx.font = "400 14px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText(`No. ${data.invoiceNo || "-"}`, contentRight, yHeaderTop + 58);
  ctx.fillText(`Tanggal: ${formatDateID(data.invoiceDate) || "-"}`, contentRight, yHeaderTop + 78);
  ctx.fillText(`Jatuh Tempo: ${formatDateID(data.dueDate) || "-"}`, contentRight, yHeaderTop + 98);

  if (data.status) {
    const label = data.status === "lunas" ? "LUNAS" : "BELUM LUNAS";
    const badgeColor = data.status === "lunas" ? "#16a34a" : "#dc2626";
    ctx.font = "700 14px 'Alan Sans', sans-serif";
    const badgeW = ctx.measureText(label).width + 30;
    const badgeX = contentRight - badgeW;
    const badgeY = yHeaderTop + 112;
    ctx.strokeStyle = badgeColor;
    ctx.lineWidth = 1.5;
    roundRect(ctx, badgeX, badgeY, badgeW, 30, 15);
    ctx.stroke();
    ctx.fillStyle = badgeColor;
    ctx.textAlign = "center";
    ctx.fillText(label, badgeX + badgeW / 2, badgeY + 20);
  }

  drawSolidLine(ctx, contentX, yDivider1, contentRight, "#e2e8f0", 1.5);

  // ── Bill-to / payment info ──
  const colW = contentWidth / 2 - 20;
  ctx.textAlign = "left";
  ctx.font = "700 13px 'Alan Sans', sans-serif";
  ctx.fillStyle = data.accentColor;
  ctx.fillText("DITAGIHKAN KEPADA", contentX, yInfoTop);
  ctx.font = "700 19px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(data.clientName || "-", contentX, yInfoTop + 26);
  ctx.font = "400 15px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#64748b";
  const clientY = drawWrappedText(ctx, data.clientAddress, contentX, yInfoTop + 48, colW, 20, 2);
  if (data.clientPhone) ctx.fillText(data.clientPhone, contentX, clientY);

  const col2X = contentX + colW + 40;
  if (data.bankName || data.bankAccount) {
    ctx.font = "700 13px 'Alan Sans', sans-serif";
    ctx.fillStyle = data.accentColor;
    ctx.fillText("INFO PEMBAYARAN", col2X, yInfoTop);
    ctx.font = "600 17px 'Alan Sans', sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(data.bankName || "-", col2X, yInfoTop + 26);
    ctx.font = "400 15px 'Alan Sans', sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(data.bankAccount || "-", col2X, yInfoTop + 48);
    if (data.bankHolder) ctx.fillText(`a.n. ${data.bankHolder}`, col2X, yInfoTop + 68);
  }

  // ── Items table ──
  const colDescX = contentX + 50;
  const colQtyCenterX = contentRight - 290;
  const colPriceRightX = contentRight - 150;
  const descColWidth = colQtyCenterX - 40 - colDescX - 16;

  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(contentX, yTableTop, contentWidth, TABLE_HEADER_H);
  ctx.font = "700 13px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#475569";
  ctx.textAlign = "left";
  ctx.fillText("NO", contentX + 14, yTableTop + 29);
  ctx.fillText("DESKRIPSI", colDescX, yTableTop + 29);
  ctx.textAlign = "center";
  ctx.fillText("QTY", colQtyCenterX, yTableTop + 29);
  ctx.textAlign = "right";
  ctx.fillText("HARGA SATUAN", colPriceRightX, yTableTop + 29);
  ctx.fillText("SUBTOTAL", contentRight, yTableTop + 29);

  items.forEach((item, idx) => {
    const rowY = yTableHeaderBottom + idx * ROW_H;
    if (idx % 2 === 1) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(contentX, rowY, contentWidth, ROW_H);
    }
    const qty = parseFloat(item.qty) || 0;
    const price = parseFloat(sanitizeNumberString(item.price)) || 0;
    const rowSubtotal = qty * price;
    const baseline = rowY + 29;

    ctx.font = "400 15px 'Alan Sans', sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.fillText(String(idx + 1), contentX + 14, baseline);

    const descLines = wrapText(ctx, item.desc || "-", descColWidth);
    ctx.fillText(descLines[0] + (descLines.length > 1 ? "…" : ""), colDescX, baseline);

    ctx.textAlign = "center";
    ctx.fillText(String(qty), colQtyCenterX, baseline);
    ctx.textAlign = "right";
    ctx.fillText(formatIDR(price), colPriceRightX, baseline);
    ctx.font = "600 15px 'Alan Sans', sans-serif";
    ctx.fillText(formatIDR(rowSubtotal), contentRight, baseline);
  });

  drawSolidLine(ctx, contentX, yDivider2, contentRight, "#e2e8f0", 1.5);

  // ── Totals ──
  const totalsBoxW = 380;
  const totalsX = contentRight - totalsBoxW;
  let ty = yTotalsTop;

  const totalsLine = (label: string, value: string, bold = false) => {
    ctx.textAlign = "left";
    ctx.font = `${bold ? "700" : "400"} 15px 'Alan Sans', sans-serif`;
    ctx.fillStyle = bold ? "#0f172a" : "#64748b";
    ctx.fillText(label, totalsX, ty);
    ctx.textAlign = "right";
    ctx.font = `${bold ? "700" : "600"} 15px 'Alan Sans', sans-serif`;
    ctx.fillStyle = "#0f172a";
    ctx.fillText(value, contentRight, ty);
    ty += TOTALS_ROW_H;
  };

  totalsLine("Subtotal", formatIDR(subtotal));
  if (discountPct > 0) totalsLine(`Diskon (${discountPct}%)`, `- ${formatIDR(discountAmount)}`);
  if (taxPct > 0) totalsLine(`Pajak / PPN (${taxPct}%)`, formatIDR(taxAmount));

  ctx.fillStyle = data.accentColor;
  roundRect(ctx, totalsX, yTotalBoxTop, totalsBoxW, TOTAL_BOX_H, 12);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.font = "700 16px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("TOTAL", totalsX + 22, yTotalBoxTop + 37);
  ctx.textAlign = "right";
  ctx.font = "700 24px 'Alan Sans', sans-serif";
  ctx.fillText(formatIDR(total), contentRight - 22, yTotalBoxTop + 39);

  // ── Notes + footer ──
  if (hasNotes) {
    ctx.textAlign = "left";
    ctx.font = "700 13px 'Alan Sans', sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("CATATAN", contentX, yNotesLabel);
    ctx.font = "400 14px 'Alan Sans', sans-serif";
    ctx.fillStyle = "#475569";
    drawWrappedText(ctx, data.notes, contentX, yNotesBodyTop, contentWidth, NOTES_LINE_H, 3);
  }

  ctx.textAlign = "center";
  ctx.font = "italic 400 14px 'Alan Sans', sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Terima kasih atas kepercayaan Anda.", W / 2, yThankYou);
}

export function InvoiceGenerator() {
  // Semua field invoice (kop, klien, item, pembayaran) punya riwayat
  // Undo/Redo. Tambah/hapus item, ganti status, dan pilih warna langsung
  // commit; mengetik teks digabung jadi satu langkah setelah jeda.
  const history = useHistoryState<InvoiceData>(() => ({
    companyName: "Nama Usaha / Perusahaan",
    companyAddress: "Jl. Contoh Alamat No. 123, Kota",
    companyPhone: "0812-3456-7890",
    companyEmail: "halo@usaha.com",
    invoiceNo: `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-001`,
    invoiceDate: todayISODate(),
    dueDate: todayISODate(),
    status: "belum",
    clientName: "",
    clientAddress: "",
    clientPhone: "",
    bankName: "",
    bankAccount: "",
    bankHolder: "",
    items: defaultItems(),
    discountPct: "0",
    taxPct: "11",
    notes: "Pembayaran dapat dilakukan melalui transfer bank sesuai info pembayaran di atas.",
    accentColor: ACCENT_PRESETS[0],
  }));
  const data = history.state;
  const { schedule: scheduleCommit } = useDebouncedCommit(history.commit, 600);
  const updateField = <K extends keyof InvoiceData>(key: K, value: InvoiceData[K], opts?: { continuous?: boolean }) => {
    history.set((prev) => ({ ...prev, [key]: value }), { commit: !opts?.continuous });
    if (opts?.continuous) scheduleCommit();
  };
  const updateItem = (id: string, patch: Partial<InvoiceItem>, opts?: { continuous?: boolean }) => {
    history.set((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }), { commit: !opts?.continuous });
    if (opts?.continuous) scheduleCommit();
  };
  const addItem = () => history.set((prev) => ({ ...prev, items: [...prev.items, { id: newItemId(), desc: "Item baru", qty: "1", price: "0" }] }));
  const removeItem = (id: string) => history.set((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== id) }));

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoImg = useImageFromFile(logoFile);

  const totals = useMemo(
    () => computeTotals(data.items, parseFloat(sanitizeNumberString(data.discountPct || "0")) || 0, parseFloat(sanitizeNumberString(data.taxPct || "0")) || 0),
    [data.items, data.discountPct, data.taxPct]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFontReady("Alan Sans");
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderInvoiceToCanvas(canvas, logoImg, data);
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
      downloadBlob(blob, `${sanitizeFileName(data.invoiceNo) || "invoice"}.png`);
      setInfo("Invoice berhasil diunduh sebagai PNG.");
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuat invoice.");
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
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `${sanitizeFileName(data.invoiceNo) || "invoice"}.pdf`);
      setInfo("Invoice berhasil diunduh sebagai PDF.");
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
      printCanvasImage(canvas, { title: `Invoice ${data.invoiceNo}` });
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuka dialog cetak.");
    }
  };

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor Invoice</span>
          <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} />
        </div>

        <PanelCard title="Identitas Perusahaan" subtitle="Tampil di kop invoice">
          <div className="space-y-3">
            <LogoUpload file={logoFile} onChange={setLogoFile} />
            <Input label="Nama Perusahaan / Usaha" value={data.companyName} onChange={(e) => updateField("companyName", e.target.value, { continuous: true })} />
            <Textarea label="Alamat" rows={2} value={data.companyAddress} onChange={(e) => updateField("companyAddress", e.target.value, { continuous: true })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Telepon" value={data.companyPhone} onChange={(e) => updateField("companyPhone", e.target.value, { continuous: true })} />
              <Input label="Email" value={data.companyEmail} onChange={(e) => updateField("companyEmail", e.target.value, { continuous: true })} />
            </div>
            <div>
              <Label>Warna Aksen</Label>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateField("accentColor", c)}
                    style={{ backgroundColor: c }}
                    className={cn("shrink-0 w-8 h-8 rounded-lg border-2 transition-transform", data.accentColor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent")}
                    title={c}
                  />
                ))}
                <input type="color" value={data.accentColor} onChange={(e) => updateField("accentColor", e.target.value, { continuous: true })} className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5" />
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Detail Invoice" subtitle="Nomor, tanggal, dan status pembayaran">
          <div className="space-y-3">
            <Input label="No. Invoice" value={data.invoiceNo} onChange={(e) => updateField("invoiceNo", e.target.value, { continuous: true })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Tanggal" type="date" value={data.invoiceDate} onChange={(e) => updateField("invoiceDate", e.target.value)} />
              <Input label="Jatuh Tempo" type="date" value={data.dueDate} onChange={(e) => updateField("dueDate", e.target.value)} />
            </div>
            <Select label="Status Pembayaran" value={data.status} onChange={(e) => updateField("status", e.target.value as InvoiceData["status"])}>
              <option value="">Tanpa status</option>
              <option value="belum">Belum Lunas</option>
              <option value="lunas">Lunas</option>
            </Select>
          </div>
        </PanelCard>

        <PanelCard title="Ditagihkan Kepada" subtitle="Data klien / pelanggan">
          <div className="space-y-3">
            <Input label="Nama Klien" value={data.clientName} onChange={(e) => updateField("clientName", e.target.value, { continuous: true })} placeholder="PT Contoh Sejahtera" />
            <Textarea label="Alamat" rows={2} value={data.clientAddress} onChange={(e) => updateField("clientAddress", e.target.value, { continuous: true })} />
            <Input label="Telepon" value={data.clientPhone} onChange={(e) => updateField("clientPhone", e.target.value, { continuous: true })} />
          </div>
        </PanelCard>

        <PanelCard title="Info Pembayaran" subtitle="Opsional — kosongkan bila tidak perlu ditampilkan">
          <div className="space-y-3">
            <Input label="Nama Bank" value={data.bankName} onChange={(e) => updateField("bankName", e.target.value, { continuous: true })} placeholder="Bank Central Asia" />
            <Input label="No. Rekening" value={data.bankAccount} onChange={(e) => updateField("bankAccount", e.target.value, { continuous: true })} placeholder="1234567890" />
            <Input label="Atas Nama" value={data.bankHolder} onChange={(e) => updateField("bankHolder", e.target.value, { continuous: true })} />
          </div>
        </PanelCard>

        <PanelCard title="Item / Layanan" subtitle="Tambah baris sebanyak yang dibutuhkan">
          <div className="space-y-3">
            {data.items.map((item) => (
              <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={item.desc} onChange={(e) => updateItem(item.id, { desc: e.target.value }, { continuous: true })} placeholder="Deskripsi item" className="flex-1" />
                  <button type="button" onClick={() => removeItem(item.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MoneyInput label="Qty" value={item.qty} onChange={(v) => updateItem(item.id, { qty: v }, { continuous: true })} placeholder="1" />
                  <MoneyInput label="Harga Satuan (Rp)" value={item.price} onChange={(v) => updateItem(item.id, { price: v }, { continuous: true })} placeholder="0" prefix="Rp" />
                </div>
              </div>
            ))}
            <Btn onClick={addItem} variant="secondary" className="w-full gap-2 text-sm">
              <Plus className="w-4 h-4" />
              Tambah Item
            </Btn>
          </div>
        </PanelCard>

        <PanelCard title="Diskon, Pajak & Catatan" subtitle="Opsional">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Diskon (%)" value={data.discountPct} onChange={(e) => updateField("discountPct", sanitizeNumberString(e.target.value), { continuous: true })} />
              <Input label="Pajak / PPN (%)" value={data.taxPct} onChange={(e) => updateField("taxPct", sanitizeNumberString(e.target.value), { continuous: true })} />
            </div>
            <Textarea label="Catatan" rows={2} value={data.notes} onChange={(e) => updateField("notes", e.target.value, { continuous: true })} />
            <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5">
              Total saat ini: <span className="font-bold text-slate-800 dark:text-slate-100">{formatIDR(totals.total)}</span>
            </div>
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
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
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
