import React, { useEffect, useRef, useState } from "react";
import { ScanLine, Image as ImageIcon, Trash2, Loader2, Zap, ArrowUp, ArrowDown, Camera, CameraOff, Upload } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { loadImageFromUrl, canvasToBlob } from "@/lib/canvas";
import { Btn, Select, Label } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

type ScanMode = "original" | "grayscale" | "bw";
type InputMode = "upload" | "camera";

interface ScanItem {
  file: File;
  url: string;
}

export const PdfScan: React.FC = () => {
  const [items, setItems] = useState<ScanItem[]>([]);
  const [mode, setMode] = useState<ScanMode>("bw");
  const [brightness, setBrightness] = useState(110);
  const [contrast, setContrast] = useState(120);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Off-screen, never attached to the DOM on purpose — the visible <video>
  // already shows the live preview, this canvas only needs to exist in
  // memory to grab a still frame via drawImage()+toBlob().
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const getCaptureCanvas = () => {
    if (!captureCanvasRef.current) captureCanvasRef.current = document.createElement("canvas");
    return captureCanvasRef.current;
  };

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter((f) => f.type.startsWith("image/"));
    setItems((prev) => [...prev, ...imgs.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
    setInfo(null);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsCameraOn(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setIsCameraOn(true);
    } catch (err: any) {
      setIsCameraOn(false);
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Izin kamera ditolak. Aktifkan akses kamera di pengaturan browser untuk memakai fitur ini."
          : "Gagal mengakses kamera. Pastikan perangkatmu punya kamera yang aktif dan tidak dipakai aplikasi lain."
      );
    }
  };

  // Capture the current video frame as a new page — camera stays open so
  // the user can keep photographing the next page right away, matching how
  // this tool already supports building a multi-page PDF from a sequence
  // of shots.
  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_CURRENT_DATA) return;
    const canvas = getCaptureCanvas();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
      const file = new File([blob], `scan-kamera-${Date.now()}.jpg`, { type: "image/jpeg" });
      setItems((prev) => [...prev, { file, url: URL.createObjectURL(blob) }]);
      setInfo(null);
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
    } catch {
      setCameraError("Gagal mengambil foto dari kamera. Coba lagi.");
    }
  };

  const switchInputMode = (m: InputMode) => {
    if (m === "upload") stopCamera();
    setInputMode(m);
    setCameraError(null);
  };

  // Always release the camera when leaving the page, not just on explicit stop.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const removeItem = (idx: number) => {
    setItems((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const move = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleBuild = async () => {
    if (!items.length) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const pdfDoc = await PDFDocument.create();
      for (const item of items) {
        const img = await loadImageFromUrl(item.url);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        let filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        if (mode === "grayscale") filter += " grayscale(100%)";
        if (mode === "bw") filter += " grayscale(100%) contrast(180%) brightness(115%)";
        ctx.filter = filter;
        ctx.drawImage(img, 0, 0);

        const blob = await canvasToBlob(canvas, "image/jpeg", 0.88);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const embedded = await pdfDoc.embedJpg(bytes);
        const page = pdfDoc.addPage([embedded.width, embedded.height]);
        page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      }
      await stampGamatoBranding(pdfDoc);
      downloadBlob(new Blob([await pdfDoc.save()], { type: "application/pdf" }), "gamato-scan.pdf");
      setInfo(`${items.length} halaman berhasil dijadikan PDF hasil scan.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal membuat PDF."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => switchInputMode("upload")}
            className={cn("flex items-center justify-center gap-2 rounded-2xl border-2 p-4 text-sm font-bold transition-all",
              inputMode === "upload" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300")}
          >
            <Upload className="w-4 h-4" />
            Upload Gambar
          </button>
          <button
            type="button"
            onClick={() => switchInputMode("camera")}
            className={cn("flex items-center justify-center gap-2 rounded-2xl border-2 p-4 text-sm font-bold transition-all",
              inputMode === "camera" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300")}
          >
            <Camera className="w-4 h-4" />
            Ambil dari Kamera
          </button>
        </div>

        {inputMode === "upload" ? (
          <Dropzone
            onFiles={addFiles}
            accept="image/*"
            multiple
            label="Drop gambar dokumen di sini"
            sublabel="Bisa beberapa halaman sekaligus — urutan bisa diatur"
            icon={<ImageIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        ) : (
          <div className="bg-black rounded-2xl overflow-hidden shadow-sm relative">
            <video ref={videoRef} playsInline muted className="w-full h-auto max-h-[480px] block" />
            {flash && <div className="absolute inset-0 bg-white animate-pulse pointer-events-none" style={{ opacity: 0.7 }} />}
            {!isCameraOn ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Btn onClick={startCamera} className="gap-2">
                  <Camera className="w-4 h-4" />
                  Mulai Kamera
                </Btn>
              </div>
            ) : (
              <>
                <div className="absolute inset-x-0 top-0 flex justify-between items-start p-3 pointer-events-none">
                  <span className="text-[11px] font-semibold text-white/90 bg-black/50 rounded-full px-3 py-1">Posisikan dokumen dalam bingkai</span>
                  {items.length > 0 && <span className="text-[11px] font-bold text-white bg-indigo-600 rounded-full px-2.5 py-1 pointer-events-auto">{items.length} halaman</span>}
                </div>
                <button type="button" onClick={stopCamera} className="absolute top-12 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80">
                  <CameraOff className="w-4 h-4" />
                </button>
                <div className="absolute inset-x-0 bottom-0 flex justify-center pb-5 pt-8 bg-gradient-to-t from-black/50 to-transparent">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    aria-label="Ambil foto"
                    className="w-16 h-16 rounded-full bg-white border-4 border-indigo-500 shadow-lg active:scale-90 transition-transform"
                  />
                </div>
              </>
            )}
          </div>
        )}
        {cameraError && <p className="text-sm text-red-600 dark:text-red-400">{cameraError}</p>}

        {items.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{items.length} halaman</p>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((item, i) => (
                <div key={item.url} className="flex items-center gap-3 px-5 py-3">
                  <img src={item.url} alt="" className="w-12 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-700" style={{ filter: mode === "bw" ? "grayscale(1) contrast(1.8)" : mode === "grayscale" ? "grayscale(1)" : undefined }} />
                  <p className="flex-1 text-sm text-slate-600 dark:text-slate-300 truncate">
                    Halaman {i + 1} — {item.file.name}
                  </p>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <Select label="Gaya Scan" value={mode} onChange={(e) => setMode(e.target.value as ScanMode)}>
            <option value="bw">Hitam-Putih Kontras (mirip scanner)</option>
            <option value="grayscale">Grayscale</option>
            <option value="original">Warna Asli</option>
          </Select>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Kecerahan</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{brightness}%</span>
            </div>
            <GamatoSlider min={50} max={180} value={brightness} onChange={setBrightness} aria-label="Kecerahan" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Kontras</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{contrast}%</span>
            </div>
            <GamatoSlider min={50} max={220} value={contrast} onChange={setContrast} aria-label="Kontras" />
          </div>
        </div>

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={handleBuild} disabled={isWorking || !items.length} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Buat PDF Hasil Scan
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<ScanLine className="w-5 h-5" />}
        label="Scan PDF"
        desc="Foto dokumen → PDF"
        points={[
          "Ambil foto langsung lewat kamera browser (live, bisa berkali-kali tanpa buka ulang) atau upload gambar dokumen.",
          "Filter otomatis membuat hasil terlihat seperti hasil scanner sungguhan.",
          "Susun ulang urutan halaman sebelum digabung.",
        ]}
      />
    </div>
  );
};
