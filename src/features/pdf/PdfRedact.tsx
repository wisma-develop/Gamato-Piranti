import React, { useRef, useState } from "react";
import { EyeOff, Upload, Loader2, Undo2, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { Btn } from "@/components/ui/primitives";
import { fileToArrayBuffer, downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { sanitizeFileName } from "@/utils/sanitize";
import { loadPdfDocument, renderPageToCanvas } from "@/lib/pdfRender";

type Box = { x: number; y: number; w: number; h: number };

const EDIT_SCALE = 1.5;
const EXPORT_SCALE = 2;

export function PdfRedact() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [boxesByPage, setBoxesByPage] = useState<Record<number, Box[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pdfRef = useRef<any>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);

  const redraw = (pageNum: number, liveBox?: Box | null) => {
    const base = baseCanvasRef.current;
    const display = displayCanvasRef.current;
    if (!base || !display) return;
    display.width = base.width;
    display.height = base.height;
    const ctx = display.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = "#000000";
    for (const b of boxesByPage[pageNum] || []) ctx.fillRect(b.x, b.y, b.w, b.h);
    if (liveBox) {
      ctx.fillStyle = "rgba(239,68,68,0.35)";
      ctx.fillRect(liveBox.x, liveBox.y, liveBox.w, liveBox.h);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.strokeRect(liveBox.x, liveBox.y, liveBox.w, liveBox.h);
    }
  };

  const renderCurrentPage = async (pdf: any, pageNum: number) => {
    const canvas = await renderPageToCanvas(pdf, pageNum, EDIT_SCALE);
    baseCanvasRef.current = canvas;
    redraw(pageNum);
  };

  const handleFiles = async (files: File[]) => {
    const f = files.find((x) => x.type === "application/pdf");
    if (!f) return;
    setError(null);
    setIsLoading(true);
    try {
      const bytes = await fileToArrayBuffer(f);
      const pdf = await loadPdfDocument(bytes);
      pdfRef.current = pdf;
      setFile(f);
      setPageCount(pdf.numPages);
      setCurrentPage(1);
      setBoxesByPage({});
      await renderCurrentPage(pdf, 1);
    } catch (err: any) {
      setError(err?.message || "Gagal membuka file PDF.");
    } finally {
      setIsLoading(false);
    }
  };

  const goToPage = async (n: number) => {
    if (!pdfRef.current || n < 1 || n > pageCount) return;
    setCurrentPage(n);
    await renderCurrentPage(pdfRef.current, n);
  };

  const beginDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const startX = (e.clientX - rect.left) * scaleX;
    const startY = (e.clientY - rect.top) * scaleY;
    const pageAtStart = currentPage;
    let liveBox: Box = { x: startX, y: startY, w: 0, h: 0 };

    const move = (ev: PointerEvent) => {
      const x = (ev.clientX - rect.left) * scaleX;
      const y = (ev.clientY - rect.top) * scaleY;
      liveBox = { x: Math.min(startX, x), y: Math.min(startY, y), w: Math.abs(x - startX), h: Math.abs(y - startY) };
      redraw(pageAtStart, liveBox);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (liveBox.w > 6 && liveBox.h > 6) {
        setBoxesByPage((prev) => ({ ...prev, [pageAtStart]: [...(prev[pageAtStart] || []), liveBox] }));
      } else {
        redraw(pageAtStart, null);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const undoLastBox = () => {
    setBoxesByPage((prev) => {
      const boxes = prev[currentPage] || [];
      if (!boxes.length) return prev;
      const next = { ...prev, [currentPage]: boxes.slice(0, -1) };
      setTimeout(() => redraw(currentPage), 0);
      return next;
    });
  };

  const clearPageBoxes = () => {
    setBoxesByPage((prev) => {
      const next = { ...prev, [currentPage]: [] };
      setTimeout(() => redraw(currentPage), 0);
      return next;
    });
  };

  const totalBoxCount = Object.values(boxesByPage).reduce((s, arr) => s + arr.length, 0);

  const runExport = async () => {
    if (!file || !pdfRef.current) return;
    setIsExporting(true);
    setError(null);
    setExportProgress(0);
    try {
      const bytes = await fileToArrayBuffer(file);
      const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const outDoc = await PDFDocument.create();
      const scaleFactor = EXPORT_SCALE / EDIT_SCALE;

      for (let i = 1; i <= pageCount; i++) {
        const boxes = boxesByPage[i];
        if (boxes && boxes.length) {
          const canvas = await renderPageToCanvas(pdfRef.current, i, EXPORT_SCALE);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#000000";
            for (const b of boxes) {
              ctx.fillRect(b.x * scaleFactor, b.y * scaleFactor, b.w * scaleFactor, b.h * scaleFactor);
            }
          }
          const blob = await canvasToBlob(canvas);
          const pngBytes = new Uint8Array(await blob.arrayBuffer());
          const img = await outDoc.embedPng(pngBytes);
          const page = outDoc.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } else {
          const [copiedPage] = await outDoc.copyPages(srcDoc, [i - 1]);
          outDoc.addPage(copiedPage);
        }
        setExportProgress(i / pageCount);
      }

      const outBytes = await outDoc.save();
      downloadBlob(new Blob([outBytes], { type: "application/pdf" }), `${sanitizeFileName(file.name.replace(/\.pdf$/i, "")) || "dokumen"}-sensor.pdf`);
    } catch (err: any) {
      setError(err?.message || "Gagal membuat PDF hasil sensor.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-4">
        {!file ? (
          <Dropzone
            onFiles={handleFiles}
            accept="application/pdf"
            multiple={false}
            label={isLoading ? "Memuat PDF…" : "Drop file PDF di sini"}
            sublabel="Gambar kotak hitam di atas informasi yang ingin disensor"
            icon={<Upload className="w-8 h-8" />}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {currentPage} / {pageCount}
                </span>
                <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= pageCount} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh] flex justify-center bg-slate-100 dark:bg-slate-950">
              <canvas ref={displayCanvasRef} onPointerDown={beginDraw} className="max-w-full h-auto cursor-crosshair shadow-sm bg-white" />
            </div>
            <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800">
              <Btn onClick={undoLastBox} variant="secondary" className="gap-2 text-xs" disabled={!(boxesByPage[currentPage] || []).length}>
                <Undo2 className="w-3.5 h-3.5" />
                Batalkan Kotak Terakhir
              </Btn>
              <Btn onClick={clearPageBoxes} variant="secondary" className="gap-2 text-xs" disabled={!(boxesByPage[currentPage] || []).length}>
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Semua di Halaman Ini
              </Btn>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        {file && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{totalBoxCount} area disensor</p>
            {isExporting && (
              <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(exportProgress * 100)}%` }} />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Memproses… {Math.round(exportProgress * 100)}%</p>
              </div>
            )}
            <Btn onClick={runExport} disabled={isExporting || !totalBoxCount} className="w-full gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
              {isExporting ? "Memproses…" : "Terapkan Sensor & Ekspor"}
            </Btn>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setBoxesByPage({});
                pdfRef.current = null;
              }}
              className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold"
            >
              Ganti File
            </button>
          </div>
        )}

        <ToolInfoPanel
          icon={<EyeOff className="w-5 h-5" />}
          label="Sensor / Redaksi PDF"
          desc="Hitamkan informasi sensitif secara permanen"
          points={[
            "Klik dan seret di atas halaman untuk menggambar kotak sensor.",
            "Halaman yang disensor diubah jadi gambar (flatten) agar teks di baliknya benar-benar tidak bisa diambil lagi — bukan cuma ditutup secara visual.",
            "Halaman tanpa kotak sensor tetap dalam bentuk aslinya (teks tetap bisa di-select).",
          ]}
        />
      </div>
    </div>
  );
}
