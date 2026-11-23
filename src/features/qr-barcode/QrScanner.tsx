import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScanLine, Upload, Camera, CameraOff, Copy, ExternalLink, Check, History, Trash2, Download, Eye, EyeOff, AlertTriangle, ImagePlus,
  Flashlight, Volume2, VolumeX, Loader2, FileDown, MapPin, Mail, Phone, MessageSquare, Wifi, UserRound, CalendarDays, Globe, Barcode as BarcodeIcon, Bitcoin, Type as TypeIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { Btn, Label } from "@/components/ui/primitives";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { copyToClipboard } from "@/lib/utilityHelpers";
import { downloadBlob } from "@/lib/file";
import { requestCamera, stopStream, PermissionError, type PermFailure } from "@/lib/permissions";
import { GamatoPermissionNotice } from "@/components/ui/GamatoPermissionNotice";
import { MediaDevicePicker } from "@/components/ui/MediaDevicePicker";
import { useMediaDevices } from "@/hooks/useMediaDevices";
import { scanCanvas, drawHits, type ScanHit } from "@/lib/scanEngine";
import { parseScan, type ScanKind } from "@/lib/scanParse";
import { tr } from "@/i18n";

type Mode = "upload" | "camera";

interface HistoryEntry { id: number; text: string; format: string; count: number; time: number; source: string }
interface UploadItem { id: number; name: string; hits: ScanHit[] | null; error?: string }

const FORMAT_LABELS: Record<string, string> = {
  qr_code: tr("QR Code"), code_128: "CODE 128", code_39: "CODE 39", code_93: "CODE 93", codabar: tr("Codabar"), ean_13: "EAN-13", ean_8: "EAN-8",
  upc_a: "UPC-A", upc_e: "UPC-E", itf: "ITF", data_matrix: tr("Data Matrix"), pdf417: "PDF417", aztec: tr("Aztec"),
};
const formatLabel = (f: string) => FORMAT_LABELS[f] || f.replace(/_/g, " ").toUpperCase();

const KIND_ICON: Record<ScanKind, typeof Globe> = {
  url: Globe, wifi: Wifi, contact: UserRound, calendar: CalendarDays, email: Mail, phone: Phone, sms: MessageSquare, geo: MapPin, crypto: Bitcoin, product: BarcodeIcon, text: TypeIcon,
};

const MAX_FILES = 20;
const HISTORY_MAX = 200;
const COOLDOWN_MS = 2500;
const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const pad2 = (n: number) => String(n).padStart(2, "0");
const stamp = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

type ZoomCaps = { min: number; max: number; step: number };

export function QrScanner() {
  const [mode, setMode] = useState<Mode>("upload");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ text: string; format: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [permFail, setPermFail] = useState<PermFailure | null>(null);
  const [cameraId, setCameraId] = useState("");
  const { devices: cameras, refresh: refreshCameras } = useMediaDevices("videoinput");
  const [isScanning, setIsScanning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [detectorSupported, setDetectorSupported] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState(0);

  // Pengaturan kamera
  const [continuous, setContinuous] = useState(true);
  const [beep, setBeep] = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [torchOk, setTorchOk] = useState(false);
  const [zoomCaps, setZoomCaps] = useState<ZoomCaps | null>(null);
  const [zoom, setZoom] = useState(1);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const lastRunRef = useRef(0);
  const lastHitAtRef = useRef(0);
  const seenRef = useRef<Map<string, number>>(new Map());
  const imagesRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const idRef = useRef(1);
  const histIdRef = useRef(1);
  const audioRef = useRef<AudioContext | null>(null);
  const detectorRef = useRef<any>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const settingsRef = useRef({ continuous, beep, vibrate });
  settingsRef.current = { continuous, beep, vibrate };

  const getScanCanvas = useCallback(() => {
    if (!scanCanvasRef.current) scanCanvasRef.current = document.createElement("canvas");
    return scanCanvasRef.current;
  }, []);

  // Deteksi BarcodeDetector bawaan browser (QR + barcode 1D/2D) sekali saat mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Ctor = (window as any).BarcodeDetector;
      if (!Ctor) return;
      try {
        const supported: string[] = (await Ctor.getSupportedFormats?.()) || [];
        if (cancelled) return;
        detectorRef.current = new Ctor(supported.length ? { formats: supported } : undefined);
        setDetectorSupported(true);
      } catch {
        detectorRef.current = null;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const playBeep = useCallback(() => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioRef.current) audioRef.current = new AC();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1040;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch { /* suara hanya bonus */ }
  }, []);

  const addHistory = useCallback((hit: ScanHit, source: string) => {
    setHistory((prev) => {
      const i = prev.findIndex((h) => h.text === hit.text && h.format === hit.format);
      const now = Date.now();
      if (i >= 0) {
        const cur = prev[i];
        return [{ ...cur, count: cur.count + 1, time: now, source }, ...prev.slice(0, i), ...prev.slice(i + 1)];
      }
      return [{ id: histIdRef.current++, text: hit.text, format: hit.format, count: 1, time: now, source }, ...prev].slice(0, HISTORY_MAX);
    });
  }, []);

  // ── Unggah gambar (banyak berkas, drag-drop, tempel) ──
  const processFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/")).slice(0, MAX_FILES);
    if (!imgs.length) { setError(tr("Berkas yang dipilih bukan gambar.")); return; }
    setError(null);
    const created: UploadItem[] = imgs.map((f) => ({ id: idRef.current++, name: f.name || tr("gambar-tempel"), hits: null }));
    setItems((prev) => [...prev, ...created]);
    setActiveId((cur) => cur ?? created[0].id);
    setProcessing((n) => n + imgs.length);
    for (let i = 0; i < imgs.length; i++) {
      const it = created[i];
      try {
        const img = await loadImage(imgs[i]);
        imagesRef.current.set(it.id, img);
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d", { willReadFrequently: true })!.drawImage(img, 0, 0);
        const hits = await scanCanvas(c, detectorRef.current, "thorough");
        setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, hits, error: hits.length ? undefined : tr("Tidak ada QR code atau barcode yang terdeteksi pada gambar ini.") } : x)));
        hits.forEach((h) => addHistory(h, it.name));
        if (hits.length) setSelected((cur) => cur ?? { text: hits[0].text, format: hits[0].format });
      } catch {
        setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, hits: [], error: tr("Gambar tidak bisa dibaca (rusak atau format tidak didukung).") } : x)));
      } finally {
        setProcessing((n) => n - 1);
      }
    }
  }, [addHistory]);

  // Tempel gambar dari clipboard (Ctrl/Cmd+V) saat mode unggah.
  useEffect(() => {
    if (mode !== "upload") return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.some((f) => f.type.startsWith("image/"))) { e.preventDefault(); void processFiles(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [mode, processFiles]);

  const activeItem = items.find((i) => i.id === activeId) ?? null;
  const selectedIndex = useMemo(() => (activeItem?.hits ?? []).findIndex((h) => h.text === selected?.text), [activeItem, selected]);

  // Gambar pratinjau + kotak deteksi. Canvas SELALU ter-mount (disembunyikan lewat style).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = activeItem ? imagesRef.current.get(activeItem.id) : undefined;
    if (!img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    if (activeItem?.hits?.length) drawHits(ctx, activeItem.hits, selectedIndex);
  }, [activeItem, selectedIndex]);

  const removeItem = (id: number) => {
    imagesRef.current.delete(id);
    setItems((prev) => {
      const next = prev.filter((x) => x.id !== id);
      setActiveId((cur) => (cur === id ? next[0]?.id ?? null : cur));
      return next;
    });
  };
  const clearUploads = () => { imagesRef.current.clear(); setItems([]); setActiveId(null); setSelected(null); setError(null); };

  // ── Kamera ──
  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    busyRef.current = false;
    seenRef.current.clear();
    setIsScanning(false);
    setTorchOn(false);
    setTorchOk(false);
    setZoomCaps(null);
    const o = overlayRef.current;
    if (o) o.getContext("2d")?.clearRect(0, 0, o.width, o.height);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setPermFail(null);
    let stream: MediaStream | null = null;
    try {
      stream = await requestCamera(cameraId ? { deviceId: { exact: cameraId } } : { facingMode: "environment" });
      void refreshCameras();
      const video = videoRef.current;
      if (!video) { stopStream(stream); return; }
      stopStream(streamRef.current);
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setIsScanning(true);

      // Kemampuan senter & zoom (hanya ada di sebagian perangkat/browser).
      try {
        const track = stream.getVideoTracks()[0];
        const caps: any = track?.getCapabilities?.() ?? {};
        setTorchOk(!!caps.torch);
        if (caps.zoom && caps.zoom.max > caps.zoom.min) { setZoomCaps({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 }); setZoom(caps.zoom.min); }
      } catch { /* abaikan */ }

      const canvas = getScanCanvas();
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        setError(tr("Browser ini tidak mendukung pemrosesan gambar (canvas 2D) yang dibutuhkan untuk memindai."));
        stopCamera();
        return;
      }

      const loop = (now: number) => {
        rafRef.current = requestAnimationFrame(loop);
        if (video.readyState !== video.HAVE_ENOUGH_DATA || busyRef.current) return;
        if (now - lastRunRef.current < 90) return; // ±11 pemindaian/detik: cukup cepat, hemat baterai
        lastRunRef.current = now;
        // Kecilkan frame besar (kamera HP 1080p+) agar decode tetap ringan.
        const f = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * f);
        canvas.height = Math.round(video.videoHeight * f);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        busyRef.current = true;
        scanCanvas(canvas, detectorRef.current, "fast")
          .then((hits) => {
            const o = overlayRef.current;
            if (o) {
              o.width = canvas.width;
              o.height = canvas.height;
              const octx = o.getContext("2d");
              octx?.clearRect(0, 0, o.width, o.height);
              if (hits.length && octx) { drawHits(octx, hits, 0); lastHitAtRef.current = performance.now(); }
            }
            const t = Date.now();
            for (const h of hits) {
              const key = `${h.format}:${h.text}`;
              if (t - (seenRef.current.get(key) ?? 0) < COOLDOWN_MS) { seenRef.current.set(key, t); continue; }
              seenRef.current.set(key, t);
              addHistory(h, tr("Kamera"));
              setSelected({ text: h.text, format: h.format });
              if (settingsRef.current.beep) playBeep();
              if (settingsRef.current.vibrate) navigator.vibrate?.(60);
              if (!settingsRef.current.continuous) { stopCamera(); break; }
            }
          })
          .finally(() => { busyRef.current = false; });
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      stopStream(stream);
      streamRef.current = null;
      setIsScanning(false);
      if (err instanceof PermissionError) setPermFail(err.failure);
      else setError(tr("Gagal memulai pratinjau kamera. Coba lagi atau pilih kamera lain."));
    }
  }, [addHistory, getScanCanvas, stopCamera, cameraId, refreshCameras, playBeep]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try { await track.applyConstraints({ advanced: [{ torch: next } as any] }); setTorchOn(next); }
    catch { setError(tr("Senter tidak bisa dinyalakan di perangkat ini.")); }
  };
  const changeZoom = async (z: number) => {
    setZoom(z);
    const track = streamRef.current?.getVideoTracks()[0];
    try { await track?.applyConstraints({ advanced: [{ zoom: z } as any] }); } catch { /* abaikan */ }
  };

  const switchMode = (m: Mode) => { stopCamera(); setMode(m); setError(null); setPermFail(null); };

  const copy = async (text: string, key: string) => {
    if (await copyToClipboard(text)) { setCopied(key); setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200); }
  };

  const parsed = useMemo(() => (selected ? parseScan(selected.text, selected.format) : null), [selected]);

  // ── Ekspor riwayat ──
  const exportHistory = (kind: "csv" | "txt" | "json") => {
    if (!history.length) return;
    const rows = [...history].reverse();
    if (kind === "csv") {
      const lines = [`${tr("waktu")},${tr("format")},${tr("jumlah")},${tr("sumber")},${tr("isi")}`, ...rows.map((h) => [stamp(h.time), formatLabel(h.format), h.count, h.source, h.text].map((v) => csvCell(String(v))).join(","))];
      downloadBlob(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), "gamato-hasil-pindai.csv");
    } else if (kind === "txt") {
      downloadBlob(new Blob([rows.map((h) => h.text).join("\n")], { type: "text/plain;charset=utf-8" }), "gamato-hasil-pindai.txt");
    } else {
      downloadBlob(new Blob([JSON.stringify(rows.map((h) => ({ time: new Date(h.time).toISOString(), format: h.format, count: h.count, source: h.source, text: h.text })), null, 2)], { type: "application/json" }), "gamato-hasil-pindai.json");
    }
  };

  const modeBtn = (m: Mode, Icon: typeof Upload, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} data-testid={`scan-mode-${m}`} onClick={() => switchMode(m)}
      className={cn("flex items-center justify-center gap-2 rounded-2xl border-2 p-4 text-sm font-bold transition-all", mode === m ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300")}>
      <Icon className="w-4 h-4" />{label}
    </button>
  );

  const KindIcon = parsed ? KIND_ICON[parsed.kind] : TypeIcon;

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3" role="tablist" aria-label={tr("Sumber pindai")}>
          {modeBtn("upload", Upload, tr("Unggah Gambar"))}
          {modeBtn("camera", Camera, tr("Kamera Langsung"))}
        </div>

        {mode === "upload" && (
          <div className="space-y-3">
            {items.length === 0 ? (
              <Dropzone onFiles={(f) => void processFiles(f)} accept="image/*" multiple label={tr("Drop gambar berisi QR code atau barcode")} sublabel={tr("JPG, PNG, WEBP — bisa banyak sekaligus, atau tempel dengan Ctrl+V")} icon={<ScanLine className="w-8 h-8" />} />
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3">
                {items.length > 1 && (
                  <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr("Gambar yang dipindai")}>
                    {items.map((it) => (
                      <button key={it.id} type="button" role="tab" aria-selected={it.id === activeId} onClick={() => { setActiveId(it.id); if (it.hits?.[0]) setSelected({ text: it.hits[0].text, format: it.hits[0].format }); }}
                        className={cn("max-w-[11rem] truncate rounded-lg border px-2.5 py-1.5 text-xs font-semibold", it.id === activeId ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>
                        {it.name}{it.hits ? ` · ${it.hits.length}` : ""}
                      </button>
                    ))}
                  </div>
                )}
                <canvas ref={canvasRef} data-testid="scan-canvas" className="w-full h-auto rounded-xl max-h-[420px] object-contain mx-auto" style={{ display: activeItem && imagesRef.current.has(activeItem.id) ? "block" : "none" }} aria-label={tr("Pratinjau gambar yang dipindai")} role="img" />
                {activeItem && !imagesRef.current.has(activeItem.id) && !activeItem.error && <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />{tr("Memindai…")}</p>}
                {activeItem?.hits && activeItem.hits.length > 1 && <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="scan-multi">{tr("{0} kode ditemukan pada gambar ini — klik salah satu di daftar hasil.", activeItem.hits.length)}</p>}
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-400">
                    <ImagePlus className="w-3.5 h-3.5" />{tr("Tambah Gambar")}
                    <input type="file" accept="image/*" multiple className="sr-only" data-testid="scan-add-input" onChange={(e) => { if (e.target.files) void processFiles(Array.from(e.target.files)); e.target.value = ""; }} />
                  </label>
                  {activeItem && <button type="button" onClick={() => removeItem(activeItem.id)} className="text-xs font-semibold px-3 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-red-500">{tr("Hapus Gambar Ini")}</button>}
                  <button type="button" onClick={clearUploads} data-testid="scan-clear-uploads" className="text-xs font-semibold px-3 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-red-500">{tr("Ganti Semua")}</button>
                </div>
              </div>
            )}
            {processing > 0 && <p className="flex items-center gap-2 text-xs text-slate-500" role="status"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tr("Memindai {0} gambar…", processing)}</p>}
            {activeItem?.error && <p className="text-sm text-red-600 dark:text-red-400" role="alert" data-testid="scan-item-error">{activeItem.error}</p>}
          </div>
        )}

        {mode === "camera" && (
          <>
            {cameras.length > 1 && (
              <MediaDevicePicker label={tr("Kamera")} devices={cameras} value={cameraId} testId="qr-camera-picker"
                onChange={(id) => { setCameraId(id); if (isScanning) stopCamera(); }} />
            )}
            <div className="bg-black rounded-2xl overflow-hidden shadow-sm relative">
              <video ref={videoRef} playsInline muted data-testid="scan-video" aria-label={tr("Pratinjau kamera")} className="w-full h-auto max-h-[420px] block" />
              {/* Overlay deteksi: selalu ter-mount, ukuran mengikuti resolusi frame. */}
              <canvas ref={overlayRef} data-testid="scan-overlay" className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: isScanning ? "block" : "none", objectFit: "contain" }} aria-hidden="true" />
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Btn onClick={startCamera} className="gap-2" data-testid="scan-start"><Camera className="w-4 h-4" />{tr("Mulai Kamera")}</Btn>
                </div>
              )}
              {isScanning && (
                <>
                  <div className="absolute inset-x-0 top-0 flex justify-center pt-3 pointer-events-none">
                    <span className="text-[11px] font-semibold text-white/90 bg-black/50 rounded-full px-3 py-1">{tr("Arahkan ke QR code / barcode…")}</span>
                  </div>
                  <div className="absolute top-3 right-3 flex gap-2">
                    {torchOk && (
                      <button type="button" onClick={toggleTorch} aria-pressed={torchOn} aria-label={tr("Senter")} data-testid="scan-torch" className={cn("p-2 rounded-full text-white", torchOn ? "bg-amber-500" : "bg-black/60 hover:bg-black/80")}><Flashlight className="w-4 h-4" /></button>
                    )}
                    <button type="button" onClick={stopCamera} aria-label={tr("Matikan kamera")} data-testid="scan-stop" className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80"><CameraOff className="w-4 h-4" /></button>
                  </div>
                </>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm space-y-3">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                <GamatoCheckbox checked={continuous} onChange={setContinuous} label={tr("Pindai terus-menerus")} testId="scan-continuous" />
                <GamatoCheckbox checked={beep} onChange={setBeep} label={<span className="inline-flex items-center gap-1.5">{beep ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}{tr("Bunyi saat terbaca")}</span>} testId="scan-beep" />
                <GamatoCheckbox checked={vibrate} onChange={setVibrate} label={tr("Getar saat terbaca (HP)")} testId="scan-vibrate" />
              </div>
              {zoomCaps && (
                <div>
                  <div className="flex justify-between items-center mb-1.5"><Label>{tr("Zoom kamera")}</Label><span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{zoom.toFixed(1)}×</span></div>
                  <GamatoSlider min={zoomCaps.min} max={zoomCaps.max} step={zoomCaps.step} value={zoom} onChange={(v) => void changeZoom(v)} aria-label={tr("Zoom kamera")} />
                </div>
              )}
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{continuous ? tr("Kode yang sama tidak dicatat berulang dalam {0} detik.", COOLDOWN_MS / 1000) : tr("Kamera berhenti otomatis setelah satu kode terbaca.")}</p>
            </div>
          </>
        )}

        <GamatoPermissionNotice failure={permFail} onRetry={startCamera} onDismiss={() => setPermFail(null)} />
        {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}

        {/* Daftar kode pada gambar aktif */}
        {mode === "upload" && activeItem?.hits && activeItem.hits.length > 1 && (
          <ul className="grid sm:grid-cols-2 gap-2" data-testid="scan-hit-list">
            {activeItem.hits.map((h, i) => (
              <li key={i}>
                <button type="button" onClick={() => setSelected({ text: h.text, format: h.format })}
                  className={cn("w-full text-left rounded-xl border px-3 py-2 text-xs", selected?.text === h.text ? "border-green-500 bg-green-50 dark:bg-green-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900")}>
                  <span className="font-bold text-indigo-600 dark:text-indigo-300 mr-1.5">#{i + 1}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-500 mr-1.5">{formatLabel(h.format)}</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200 break-all line-clamp-2">{h.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Kartu hasil cerdas */}
        {selected && parsed && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4" data-testid="scan-result" data-kind={parsed.kind}>
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200"><KindIcon className="w-4 h-4 text-indigo-500" />{parsed.title}</p>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-500/20 shrink-0" data-testid="scan-format">{formatLabel(selected.format)}</span>
            </div>

            {parsed.warnings.map((w) => (
              <div key={w} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2.5" role="alert" data-testid="scan-warning">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{w}</span>
              </div>
            ))}

            <dl className="space-y-2">
              {parsed.fields.map((f, i) => {
                const key = `${f.label}-${i}`;
                const hidden = f.secret && !showSecret[key];
                return (
                  <div key={key} className="flex items-start justify-between gap-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-3.5 py-2.5">
                    <div className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500">{f.label}</dt>
                      <dd className="text-sm text-slate-800 dark:text-slate-100 break-all font-mono" data-testid={`scan-field-${i}`}>{hidden ? "••••••••" : f.value}</dd>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {f.secret && <button type="button" onClick={() => setShowSecret((s) => ({ ...s, [key]: !s[key] }))} aria-label={hidden ? tr("Tampilkan") : tr("Sembunyikan")} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">{hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>}
                      <button type="button" onClick={() => void copy(f.value, key)} aria-label={tr("Salin {0}", f.label)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">{copied === key ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}</button>
                    </div>
                  </div>
                );
              })}
            </dl>

            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => void copy(selected.text, "all")} variant="secondary" className="gap-2 text-xs" data-testid="scan-copy">
                {copied === "all" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied === "all" ? tr("Disalin!") : tr("Salin Teks")}
              </Btn>
              {parsed.actions.map((a) => a.href ? (
                <a key={a.id} href={a.href} target={a.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" data-testid={`scan-action-${a.id}`}
                  className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" />{a.label}
                </a>
              ) : a.file ? (
                <Btn key={a.id} variant="secondary" className="gap-2 text-xs" data-testid={`scan-action-${a.id}`} onClick={() => downloadBlob(new Blob([a.file!.content], { type: `${a.file!.mime};charset=utf-8` }), a.file!.name)}>
                  <FileDown className="w-3.5 h-3.5" />{a.label}
                </Btn>
              ) : null)}
            </div>

            {parsed.kind !== "text" && (
              <details className="text-xs text-slate-500 dark:text-slate-400">
                <summary className="cursor-pointer font-semibold">{tr("Lihat isi mentah")}</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all bg-slate-50 dark:bg-slate-800 rounded-xl p-3 font-mono text-slate-700 dark:text-slate-200" data-testid="scan-raw">{selected.text}</pre>
              </details>
            )}
          </div>
        )}

        {/* Riwayat */}
        {history.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3" data-testid="scan-history">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5"><History className="w-3.5 h-3.5" />{tr("Riwayat Sesi Ini")} · {history.length}</p>
              <div className="flex flex-wrap gap-1.5">
                {(["csv", "txt", "json"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => exportHistory(k)} data-testid={`scan-export-${k}`} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"><Download className="w-3 h-3" />{k.toUpperCase()}</button>
                ))}
                <button type="button" onClick={() => { setHistory([]); setSelected(null); }} data-testid="scan-clear-history" className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-red-500"><Trash2 className="w-3 h-3" />{tr("Kosongkan")}</button>
              </div>
            </div>
            <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-2">
                  <button type="button" onClick={() => setSelected({ text: h.text, format: h.format })} className="flex-1 min-w-0 text-left flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs">
                    <span className="text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wide shrink-0 w-14">{formatLabel(h.format)}</span>
                    <span className="truncate font-mono text-slate-600 dark:text-slate-300">{h.text}</span>
                    {h.count > 1 && <span className="shrink-0 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 rounded-full px-1.5">×{h.count}</span>}
                  </button>
                  <button type="button" onClick={() => void copy(h.text, `h${h.id}`)} aria-label={tr("Salin")} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0">{copied === `h${h.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}</button>
                  <button type="button" onClick={() => setHistory((p) => p.filter((x) => x.id !== h.id))} aria-label={tr("Hapus")} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        <ToolInfoPanel
          icon={<ScanLine className="w-5 h-5" />}
          label={tr("QR & Barcode Scanner")}
          desc={tr("Baca QR code dan barcode dari gambar atau kamera")}
          points={[
            detectorSupported
              ? tr("Mendukung QR code sekaligus barcode 1D/2D (CODE128, EAN, UPC, CODE39, ITF, Data Matrix, PDF417, dll) — didukung penuh oleh browser ini.")
              : tr("Mendukung QR code penuh di semua browser. Untuk barcode 1D (CODE128, EAN, dll), gunakan Chrome/Edge terbaru agar deteksi barcode aktif, atau pakai alat Scan HID dengan scanner fisik."),
            tr("Satu gambar bisa berisi banyak kode — semuanya dibaca dan ditandai dengan kotak bernomor."),
            tr("Hasil dikenali otomatis: WiFi, kontak, kalender, email, telepon, SMS, lokasi, dan lainnya — lengkap dengan aksi cepat dan peringatan untuk tautan mencurigakan."),
            tr("Gambar & video kamera diproses langsung di browser, tidak pernah diunggah ke server."),
          ]}
        />
      </div>
    </div>
  );
}
