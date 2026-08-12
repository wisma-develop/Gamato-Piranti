import React, { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { ScanLine, Upload, Camera, CameraOff, Copy, ExternalLink, Check, History } from "lucide-react";
import { cn } from "@/utils/cn";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { Btn } from "@/components/ui/primitives";
import { useImageFromFile } from "@/hooks/useImageFromFile";
import { copyToClipboard } from "@/lib/utilityHelpers";
import { sanitizeUrl } from "@/utils/sanitize";

type Mode = "upload" | "camera";

function isLikelyUrl(text: string): string | null {
  const safe = sanitizeUrl(text.trim());
  return safe || null;
}

export function QrScanner() {
  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [copied, setCopied] = useState(false);

  const img = useImageFromFile(file);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const pushResult = useCallback((text: string) => {
    setResult(text);
    setHistory((prev) => (prev[0] === text ? prev : [text, ...prev].slice(0, 8)));
  }, []);

  useEffect(() => {
    if (mode !== "upload" || !img || !canvasRef.current) return;
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });
    if (code?.data) {
      pushResult(code.data);
    } else {
      setResult(null);
      setError("Tidak ada QR code yang terdeteksi pada gambar ini.");
    }
  }, [mode, img, pushResult]);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setIsScanning(true);

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const loop = () => {
        if (!video || !canvas || !ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          pushResult(code.data);
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err: any) {
      setIsScanning(false);
      setError(
        err?.name === "NotAllowedError"
          ? "Izin kamera ditolak. Aktifkan akses kamera di pengaturan browser untuk memakai alat ini."
          : "Gagal mengakses kamera. Pastikan perangkatmu punya kamera yang aktif."
      );
    }
  }, [pushResult]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const switchMode = (m: Mode) => {
    stopCamera();
    setMode(m);
    setResult(null);
    setError(null);
  };

  const handleFiles = (files: File[]) => {
    const f = files.find((x) => x.type.startsWith("image/"));
    if (f) setFile(f);
  };

  const copy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  const url = result ? isLikelyUrl(result) : null;

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => switchMode("upload")}
            className={cn("flex items-center justify-center gap-2 rounded-2xl border-2 p-4 text-sm font-bold transition-all", mode === "upload" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300")}
          >
            <Upload className="w-4 h-4" />
            Unggah Gambar
          </button>
          <button
            type="button"
            onClick={() => switchMode("camera")}
            className={cn("flex items-center justify-center gap-2 rounded-2xl border-2 p-4 text-sm font-bold transition-all", mode === "camera" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300")}
          >
            <Camera className="w-4 h-4" />
            Kamera Langsung
          </button>
        </div>

        {mode === "upload" ? (
          !file ? (
            <Dropzone onFiles={handleFiles} accept="image/*" multiple={false} label="Drop gambar berisi QR code" sublabel="JPG, PNG, WEBP" icon={<ScanLine className="w-8 h-8" />} />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3">
              <canvas ref={canvasRef} className="w-full h-auto rounded-xl max-h-[420px] object-contain mx-auto block" />
              <button type="button" onClick={() => { setFile(null); setResult(null); setError(null); }} className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold">
                Ganti Gambar
              </button>
            </div>
          )
        ) : (
          <div className="bg-black rounded-2xl overflow-hidden shadow-sm relative">
            <video ref={videoRef} playsInline muted className="w-full h-auto max-h-[420px] block" />
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Btn onClick={startCamera} className="gap-2">
                  <Camera className="w-4 h-4" />
                  Mulai Kamera
                </Btn>
              </div>
            )}
            {isScanning && (
              <button type="button" onClick={stopCamera} className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80">
                <CameraOff className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {result && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Hasil Pindaian</p>
            <p className="text-sm text-slate-800 dark:text-slate-100 break-all bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 font-mono">{result}</p>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => copy(result)} variant="secondary" className="gap-2 text-xs">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Disalin!" : "Salin Teks"}
              </Btn>
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buka Link
                </a>
              )}
            </div>
          </div>
        )}

        {history.length > 1 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" />
              Riwayat Sesi Ini
            </p>
            <ul className="space-y-1.5">
              {history.slice(1).map((h, i) => (
                <li key={i} className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        <ToolInfoPanel
          icon={<ScanLine className="w-5 h-5" />}
          label="QR Code Scanner"
          desc="Baca QR code dari gambar atau kamera"
          points={[
            "Mendukung format QR code — untuk barcode 1D (CODE128, EAN, dll), gunakan alat Scan HID dengan scanner fisik.",
            "Mode kamera memindai terus-menerus hingga QR code terdeteksi.",
            "Gambar & video kamera diproses langsung di browser, tidak pernah diunggah ke server.",
          ]}
        />
      </div>
    </div>
  );
}
