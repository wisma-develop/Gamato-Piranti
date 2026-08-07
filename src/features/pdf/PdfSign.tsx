import React, { useEffect, useRef, useState } from "react";
import { PenLine, FileText, Loader2, Zap, Eraser } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { Input, Btn, Label } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export const PdfSign: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const [targetPage, setTargetPage] = useState(1);

  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("Nama Anda");
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  const [pos, setPos] = useState({ x: 0.55, y: 0.8, w: 0.3 });
  const placeholderRef = useRef<HTMLDivElement>(null);

  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = async (incoming: File[]) => {
    const f = incoming.find((x) => x.type === "application/pdf");
    if (!f) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(f);
    const bytes = await fileToArrayBuffer(f);
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    setFile(f);
    setObjectUrl(url);
    setPageCount(pdfDoc.getPageCount());
    setPageSizes(pdfDoc.getPages().map((p) => ({ w: p.getSize().width, h: p.getSize().height })));
    setTargetPage(1);
    setInfo(null);
  };

  useEffect(() => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
  }, [mode]);

  const getPos = (canvas: HTMLCanvasElement, e: React.PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const ctx = canvas.getContext("2d")!;
    const p = getPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    setHasDrawing(true);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const p = getPos(canvas, e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const endDraw = () => {
    drawing.current = false;
  };
  const clearSig = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  const buildSignaturePng = async (): Promise<Uint8Array> => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 220;
    const ctx = canvas.getContext("2d")!;
    if (mode === "draw" && sigCanvasRef.current) {
      ctx.drawImage(sigCanvasRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.font = "italic 700 64px Georgia, 'Times New Roman', serif";
      ctx.fillStyle = "#0f172a";
      ctx.textBaseline = "middle";
      ctx.fillText(typedName || "Tanda Tangan", 20, canvas.height / 2);
    }
    const dataUrl = canvas.toDataURL("image/png");
    return Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  };

  const startDragPos = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = placeholderRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...pos };
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      setPos({ ...startPos, x: clamp(startPos.x + dx, 0, 1 - startPos.w), y: clamp(startPos.y + dy, 0, 0.95) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleApply = async () => {
    if (!file) return;
    if (mode === "draw" && !hasDrawing) {
      setInfo("Gambar tanda tangan terlebih dahulu, atau pindah ke mode Ketik.");
      return;
    }
    setInfo(null);
    setIsWorking(true);
    try {
      const pdfDoc = await PDFDocument.load(await fileToArrayBuffer(file), { ignoreEncryption: true });
      const sigBytes = await buildSignaturePng();
      const sigImg = await pdfDoc.embedPng(sigBytes);
      const pages = pdfDoc.getPages();
      const idx = clamp(targetPage - 1, 0, pages.length - 1);
      const page = pages[idx];
      const { width, height } = page.getSize();
      const stampW = pos.w * width;
      const stampH = stampW * (sigImg.height / sigImg.width);
      const x = pos.x * width;
      const y = (1 - pos.y) * height - stampH;
      page.drawImage(sigImg, { x, y, width: stampW, height: stampH });

      downloadBlob(new Blob([await pdfDoc.save()], { type: "application/pdf" }), "gamato-signed.pdf");
      setInfo(`Tanda tangan berhasil dibubuhkan di halaman ${targetPage}.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal membubuhkan tanda tangan."));
    } finally {
      setIsWorking(false);
    }
  };

  const pageAspect = pageSizes[targetPage - 1] ? `${pageSizes[targetPage - 1].w} / ${pageSizes[targetPage - 1].h}` : "1 / 1.414";

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-5">
        {!file ? (
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
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (objectUrl) URL.revokeObjectURL(objectUrl);
                    setFile(null);
                    setObjectUrl(null);
                    setInfo(null);
                  }}
                  className="text-sm text-red-500 font-semibold hover:text-red-700 shrink-0"
                >
                  Ganti File
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-0">
                <iframe title="ref" src={objectUrl ? `${objectUrl}#page=${targetPage}` : undefined} className="w-full border-0" style={{ height: 420 }} />
                <div className="p-4 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                  <div
                    ref={placeholderRef}
                    className="relative bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded shadow max-w-full"
                    style={{ width: "min(100%, 280px)", aspectRatio: pageAspect }}
                  >
                    <div
                      onPointerDown={startDragPos}
                      className="absolute border-2 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/20 cursor-move touch-none flex items-center justify-center text-[10px] text-indigo-600 font-semibold"
                      style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${pos.w * 100}%`, aspectRatio: "600 / 220" }}
                    >
                      Tanda Tangan
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 px-5 py-2 border-t border-slate-100 dark:border-slate-800">
                Kiri: pratinjau halaman asli. Kanan: geser kotak untuk mengatur posisi tanda tangan (proporsional terhadap halaman).
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Halaman" type="number" min={1} max={pageCount} value={targetPage} onChange={(e) => setTargetPage(clamp(parseInt(e.target.value) || 1, 1, pageCount))} />
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <Label>Ukuran</Label>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(pos.w * 100)}%</span>
                  </div>
                  <input type="range" min={10} max={70} value={Math.round(pos.w * 100)} onChange={(e) => setPos((p) => ({ ...p, w: parseInt(e.target.value) / 100 }))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMode("draw")} className={cn("py-2.5 rounded-xl text-sm font-semibold border-2", mode === "draw" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>
                  Gambar
                </button>
                <button type="button" onClick={() => setMode("type")} className={cn("py-2.5 rounded-xl text-sm font-semibold border-2", mode === "type" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>
                  Ketik
                </button>
              </div>

              {mode === "draw" ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>Gambar tanda tangan di sini</Label>
                    <button type="button" onClick={clearSig} className="text-xs text-red-500 font-semibold flex items-center gap-1">
                      <Eraser className="w-3.5 h-3.5" /> Hapus
                    </button>
                  </div>
                  <canvas
                    ref={sigCanvasRef}
                    width={600}
                    height={220}
                    onPointerDown={startDraw}
                    onPointerMove={moveDraw}
                    onPointerUp={endDraw}
                    onPointerLeave={endDraw}
                    className="w-full h-40 bg-white rounded-xl border border-slate-200 dark:border-slate-700 touch-none cursor-crosshair"
                  />
                </div>
              ) : (
                <Input label="Ketik nama untuk dijadikan tanda tangan" value={typedName} onChange={(e) => setTypedName(e.target.value)} placeholder="Nama Anda" />
              )}
            </div>
          </>
        )}

        {info && (
          <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", info.startsWith("Gagal") || info.startsWith("Gambar") ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>
            {info}
          </div>
        )}

        <Btn onClick={handleApply} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Bubuhkan Tanda Tangan
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<PenLine className="w-5 h-5" />}
        label="Tanda Tangan PDF"
        desc="Gambar atau ketik"
        points={["Gambar tanda tangan dengan mouse/jari, atau ketik nama bergaya tulisan tangan.", "Posisi & ukuran diatur proporsional terhadap halaman yang dipilih."]}
      />
    </div>
  );
};
