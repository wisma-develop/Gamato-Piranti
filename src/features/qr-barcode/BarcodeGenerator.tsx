import { useMemo, useRef, useState } from "react";
import { Barcode, Download, Loader2, FileDown, Layers } from "lucide-react";
import JsBarcode from "jsbarcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { cn } from "@/utils/cn";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { sanitizeText } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { Label, Input, Select, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";

const NUMERIC_FORMATS = ["EAN13", "EAN8", "UPC", "ITF14"];

type ValidationResult = { ok: true; value: string } | { ok: false; reason: string };

function validateBarcodeValue(format: string, raw: string): ValidationResult {
  let value = raw.trim();
  if (!value) return { ok: false, reason: "kosong" };
  if (NUMERIC_FORMATS.includes(format)) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return { ok: false, reason: "format ini hanya mendukung angka" };
    const len = digits.length;
    if (format === "EAN13" && len !== 12 && len !== 13) return { ok: false, reason: "EAN-13 butuh 12/13 digit" };
    if (format === "EAN8" && len !== 7 && len !== 8) return { ok: false, reason: "EAN-8 butuh 7/8 digit" };
    if (format === "UPC" && len !== 11 && len !== 12) return { ok: false, reason: "UPC butuh 11/12 digit" };
    if (format === "ITF14" && len !== 13 && len !== 14) return { ok: false, reason: "ITF-14 butuh 13/14 digit" };
    value = digits;
  }
  return { ok: true, value };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Gagal membuat gambar"))), "image/png");
  });
}

function truncateLabel(text: string, max = 30) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function todayLong() {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

type BarcodeConfig = {
  barcodeContent: string;
  barcodeFormat: string;
  barcodeHeight: number;
  fgColor: string;
  bgColor: string;
  bulkText: string;
};

export function BarcodeGenerator() {
  // Konten, format, warna, tinggi, dan daftar cetak massal semuanya punya
  // riwayat Undo/Redo (digabung jadi satu langkah setelah jeda singkat).
  // Nama variabel & setter dipertahankan sama persis supaya JSX di bawah
  // tidak perlu diubah satu per satu.
  const bcHistory = useHistoryState<BarcodeConfig>(() => ({
    barcodeContent: "123456789012",
    barcodeFormat: "CODE128",
    barcodeHeight: 80,
    fgColor: "#020617",
    bgColor: "#ffffff",
    bulkText: "",
  }));
  const bcConfig = bcHistory.state;
  const { schedule: scheduleBcCommit } = useDebouncedCommit(bcHistory.commit, 600);
  function setBcField<K extends keyof BarcodeConfig>(key: K, value: BarcodeConfig[K]) {
    bcHistory.set((prev) => ({ ...prev, [key]: value }), { commit: false });
    scheduleBcCommit();
  }
  const { barcodeContent, barcodeFormat, barcodeHeight, fgColor, bgColor, bulkText } = bcConfig;
  const setBarcodeContent = (v: string) => setBcField("barcodeContent", v);
  const setBarcodeFormat = (v: string) => setBcField("barcodeFormat", v);
  const setBarcodeHeight = (v: number) => setBcField("barcodeHeight", v);
  const setFgColor = (v: string) => setBcField("fgColor", v);
  const setBgColor = (v: string) => setBcField("bgColor", v);
  const setBulkText = (v: string) => setBcField("bulkText", v);

  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const barcodeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [bulkInfo, setBulkInfo] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [isBulkWorking, setIsBulkWorking] = useState(false);

  const bulkEntries = useMemo(() => {
    return bulkText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(line => {
        const [code, ...rest] = line.split(",");
        return { code: (code || "").trim(), label: rest.join(",").trim() || undefined };
      });
  }, [bulkText]);

  const generate = () => {
    setError(null);
    setIsGenerating(true);
    try {
      const canvas = barcodeCanvasRef.current;
      if (!canvas) return;
      const result = validateBarcodeValue(barcodeFormat, barcodeContent);
      if (!result.ok) {
        setError(result.reason === "kosong" ? "Isi barcode belum diisi." : `Format ini butuh nilai yang valid: ${result.reason}.`);
        return;
      }
      JsBarcode(canvas, result.value, { format: barcodeFormat as any, lineColor: fgColor, background: bgColor, width: 2, height: barcodeHeight, displayValue: true, margin: 10 });
    } catch (err: any) {
      setError(err?.message || "Gagal membuat barcode");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadBarcode = () => {
    const canvas = barcodeCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob(b => { if (b) downloadBlob(b, "gamato-barcode.png"); });
  };

  const generateBulkPdf = async () => {
    setBulkInfo(null);
    if (!bulkEntries.length) { setBulkInfo("Isi daftar kode terlebih dahulu, satu kode per baris."); return; }

    const validated = bulkEntries.map(e => ({ ...e, result: validateBarcodeValue(barcodeFormat, e.code) }));
    const valid = validated.filter(e => e.result.ok) as { code: string; label?: string; result: { ok: true; value: string } }[];
    const invalidCount = validated.length - valid.length;

    if (!valid.length) { setBulkInfo("Tidak ada kode yang valid untuk format barcode yang dipilih."); return; }

    setIsBulkWorking(true);
    setBulkProgress({ done: 0, total: valid.length });
    try {
      const PAGE_W = 595.28, PAGE_H = 841.89; // A4 in points
      const MARGIN = 40, COLS = 2, GAP_X = 20, GAP_Y = 18;
      const CELL_W = (PAGE_W - MARGIN * 2 - GAP_X * (COLS - 1)) / COLS;
      const BARCODE_MAX_H = 90, CAPTION_H = 14, HEADER_H = 54;
      const ROW_H = BARCODE_MAX_H + CAPTION_H + GAP_Y;
      const ROWS = Math.max(1, Math.floor((PAGE_H - MARGIN * 2 - HEADER_H) / ROW_H));
      const perPage = COLS * ROWS;

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const offscreen = document.createElement("canvas");

      let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      let pageIndex = 1;
      const drawHeader = () => {
        page.drawText("Daftar Barcode", { x: MARGIN, y: PAGE_H - MARGIN - 14, size: 16, font: fontBold, color: rgb(0.06, 0.09, 0.16) });
        page.drawText(`Dibuat ${todayLong()} · Total ${valid.length} kode · Halaman ${pageIndex}`, { x: MARGIN, y: PAGE_H - MARGIN - 30, size: 9, font, color: rgb(0.45, 0.5, 0.58) });
        page.drawLine({ start: { x: MARGIN, y: PAGE_H - MARGIN - 38 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - 38 }, thickness: 0.75, color: rgb(0.85, 0.87, 0.9) });
      };
      drawHeader();

      for (let i = 0; i < valid.length; i++) {
        const posInPage = i % perPage;
        if (i > 0 && posInPage === 0) {
          page = pdfDoc.addPage([PAGE_W, PAGE_H]);
          pageIndex++;
          drawHeader();
        }
        const col = posInPage % COLS;
        const row = Math.floor(posInPage / COLS);
        const cellX = MARGIN + col * (CELL_W + GAP_X);
        const cellTopY = PAGE_H - MARGIN - HEADER_H - row * ROW_H;

        JsBarcode(offscreen, valid[i].result.value, { format: barcodeFormat as any, lineColor: fgColor, background: bgColor, width: 2, height: barcodeHeight, displayValue: true, margin: 8 });
        const blob = await canvasToBlob(offscreen);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const img = await pdfDoc.embedPng(bytes);
        const scale = Math.min(CELL_W / img.width, BARCODE_MAX_H / img.height);
        const drawW = img.width * scale, drawH = img.height * scale;
        const drawX = cellX + (CELL_W - drawW) / 2;
        const drawY = cellTopY - BARCODE_MAX_H + (BARCODE_MAX_H - drawH) / 2;
        page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });

        if (valid[i].label) {
          const label = truncateLabel(valid[i].label!, 30);
          const textWidth = font.widthOfTextAtSize(label, 8);
          page.drawText(label, { x: cellX + Math.max(0, (CELL_W - textWidth) / 2), y: cellTopY - BARCODE_MAX_H - CAPTION_H + 3, size: 8, font, color: rgb(0.3, 0.35, 0.4) });
        }

        setBulkProgress({ done: i + 1, total: valid.length });
        await new Promise(r => setTimeout(r, 0));
      }

      await stampGamatoBranding(pdfDoc);
      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), "gamato-barcode-massal.pdf");
      setBulkInfo(
        invalidCount > 0
          ? `${valid.length} barcode berhasil dibuat (${invalidCount} baris dilewati karena tidak valid untuk format ${barcodeFormat}).`
          : `${valid.length} barcode berhasil dibuat dan disusun rapi dalam PDF.`
      );
    } catch (err: any) {
      setBulkInfo(err?.message || "Gagal membuat PDF massal.");
    } finally {
      setIsBulkWorking(false);
      setBulkProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        {/* LEFT: Controls */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor Barcode</p>
            <UndoRedoBar canUndo={bcHistory.canUndo} canRedo={bcHistory.canRedo} onUndo={bcHistory.undo} onRedo={bcHistory.redo} />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <Textarea label="Konten Barcode" rows={4} value={barcodeContent} onChange={e => setBarcodeContent(sanitizeText(e.target.value))} placeholder="Kode produk, SKU, atau angka…" />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Format" value={barcodeFormat} onChange={e => setBarcodeFormat(e.target.value)}>
                <option value="CODE128">CODE 128 (umum)</option>
                <option value="EAN13">EAN-13</option>
                <option value="EAN8">EAN-8</option>
                <option value="UPC">UPC</option>
                <option value="CODE39">CODE 39</option>
                <option value="ITF14">ITF-14</option>
              </Select>
              <Input label="Tinggi (px)" type="number" min={40} max={200} value={barcodeHeight} onChange={e => setBarcodeHeight(Number(e.target.value) || 80)} />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">Format EAN/UPC/ITF hanya mendukung angka dengan panjang tertentu. Pengaturan format &amp; warna di sini juga dipakai untuk cetak massal di bawah.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Kustomisasi</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Warna Utama</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={fgColor} onChange={e => setFgColor(e.target.value)} className="h-11 w-11 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 shadow-sm" />
                  <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{fgColor}</span>
                </div>
              </div>
              <div>
                <Label>Warna Latar</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-11 w-11 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5 shadow-sm" />
                  <span className="text-sm font-mono text-slate-500 dark:text-slate-400">{bgColor}</span>
                </div>
              </div>
            </div>
          </div>

          {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

          <Btn onClick={generate} disabled={isGenerating || !barcodeContent.trim()} className="w-full py-4 text-base">
            {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses…</> : <><Barcode className="w-4 h-4" />Generate Barcode</>}
          </Btn>

          {/* Bulk / mass print */}
          <PanelCard title="Cetak Massal ke PDF" subtitle="Satu kode per baris — opsional tambahkan label dengan koma, mis. 8991234567890,Kopi Susu 250ml">
            <div className="space-y-3">
              <Textarea
                rows={6}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder={"8991234567890,Kopi Susu 250ml\n8991234567891,Teh Melati 350ml\n8991234567892"}
              />
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                <Layers className="w-3.5 h-3.5" />
                <span>{bulkEntries.length} kode siap diproses · memakai format &amp; warna di atas</span>
              </div>
              {bulkInfo && (
                <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", bulkInfo.startsWith("Gagal") || bulkInfo.startsWith("Isi") || bulkInfo.startsWith("Tidak") ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>
                  {bulkInfo}
                </div>
              )}
              {bulkProgress && <p className="text-xs text-slate-500 dark:text-slate-400">Memproses {bulkProgress.done}/{bulkProgress.total}…</p>}
              <Btn onClick={generateBulkPdf} disabled={isBulkWorking || !bulkEntries.length} className="w-full gap-2">
                {isBulkWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Buat PDF Massal ({bulkEntries.length} kode)
              </Btn>
            </div>
          </PanelCard>
        </div>

        {/* RIGHT: Preview */}
        <div className="sticky top-24 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Preview Real-time</p>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center min-h-[380px] shadow-sm">
            <div className="bg-white p-5 rounded-2xl shadow-xl w-full">
              <canvas ref={barcodeCanvasRef} className="max-w-full" />
              {!barcodeContent.trim() && <div className="h-28 flex items-center justify-center"><p className="text-sm text-slate-400">Isi konten barcode</p></div>}
            </div>
          </div>

          <Btn onClick={downloadBarcode} disabled={!barcodeContent.trim()} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white border-0 text-base shadow-lg shadow-indigo-600/20">
            <Download className="w-4 h-4" />Unduh Barcode · PNG
          </Btn>

          <div className="text-center"><SectionBadge>Diproses langsung di perangkatmu</SectionBadge></div>
        </div>
      </div>
    </div>
  );
}
