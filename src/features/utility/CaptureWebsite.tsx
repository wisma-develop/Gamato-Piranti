import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  Monitor, MousePointer2, Pencil, Highlighter, Minus, ArrowUpRight, Square, Circle, Type, Eraser, Undo2, Redo2, Trash2, ImagePlus, Camera, Loader2, Download, FileText, X,
  ChevronLeft, ChevronRight, Crop, Play, Square as StopSquare, ExternalLink, Layers, Globe, Code2, ClipboardPaste, ListOrdered, EyeOff, Hand, Upload,
} from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { Btn, Label, Select, Input, Textarea } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { FontPicker } from "@/components/ui/FontPicker";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { sanitizeUrl } from "@/utils/sanitize";
import { annId, cloneObjs, drawObjects, transformObjs, type AnnObj, type ToolId } from "@/lib/capture/annotations";
import { LongStitcher, type StitchStatus } from "@/lib/capture/stitch";
import { captureHtml, measureFrameHeight } from "@/lib/capture/htmlCapture";
import { exportImages, exportPdf, type CaptureItem, type ImgFormat, type PageSize } from "@/lib/capture/captureExport";
import { AnnotationStage, DEFAULT_STYLE, type ToolStyle } from "./AnnotationStage";
import { requestDisplay, stopStream, PermissionError } from "@/lib/permissions";
import { tr } from "@/i18n";

type Source = "screen" | "html" | "image";
type Alert = { msg: string; tone: "success" | "error" | "warning" | "info" } | null;

const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";
const cap = "text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500";

const TOOLS: { id: ToolId; label: string; icon: React.ReactNode }[] = [
  { id: "select", label: tr("Pilih / geser"), icon: <MousePointer2 className="w-4 h-4" /> },
  { id: "pen", label: tr("Pena (corat-coret)"), icon: <Pencil className="w-4 h-4" /> },
  { id: "marker", label: tr("Stabilo"), icon: <Highlighter className="w-4 h-4" /> },
  { id: "line", label: tr("Garis"), icon: <Minus className="w-4 h-4" /> },
  { id: "arrow", label: tr("Panah"), icon: <ArrowUpRight className="w-4 h-4" /> },
  { id: "rect", label: tr("Kotak"), icon: <Square className="w-4 h-4" /> },
  { id: "ellipse", label: tr("Elips"), icon: <Circle className="w-4 h-4" /> },
  { id: "text", label: tr("Teks"), icon: <Type className="w-4 h-4" /> },
  { id: "step", label: tr("Nomor langkah"), icon: <ListOrdered className="w-4 h-4" /> },
  { id: "blur", label: tr("Sensor (blur/pixel)"), icon: <EyeOff className="w-4 h-4" /> },
  { id: "eraser", label: tr("Penghapus objek"), icon: <Eraser className="w-4 h-4" /> },
];

const DEVICES = [
  { id: "desktop", label: tr("Desktop 1440"), w: 1440 },
  { id: "laptop", label: tr("Laptop 1280"), w: 1280 },
  { id: "tablet", label: tr("Tablet 820"), w: 820 },
  { id: "mobile", label: tr("Ponsel 390"), w: 390 },
  { id: "custom", label: tr("Kustom…"), w: 0 },
];

const SAMPLE_HTML = tr("<!doctype html><html><head><meta charset=\"utf-8\"><title>Contoh</title>\n<style>\nbody{margin:0;font-family:Arial,sans-serif;color:#0f172a;background:#f8fafc}\nheader{background:linear-gradient(135deg,#4f46e5,#9333ea);color:#fff;padding:48px 32px}\nheader h1{margin:0 0 8px;font-size:40px}\nsection{padding:32px;max-width:1000px;margin:0 auto}\n.card{background:#fff;border-radius:16px;padding:24px;margin:16px 0;box-shadow:0 4px 18px rgba(15,23,42,.08)}\n.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}\nfooter{background:#0f172a;color:#cbd5e1;text-align:center;padding:40px}\n</style></head><body>\n<header><h1>Halaman Contoh Panjang</h1><p>Dipakai untuk mencoba tangkapan halaman penuh.</p></header>\n<section><div class=\"grid\"><div class=\"card\"><h3>Fitur 1</h3><p>Teks deskripsi singkat untuk kartu pertama.</p></div><div class=\"card\"><h3>Fitur 2</h3><p>Teks deskripsi singkat untuk kartu kedua.</p></div><div class=\"card\"><h3>Fitur 3</h3><p>Teks deskripsi singkat untuk kartu ketiga.</p></div></div>\n<div class=\"card\" style=\"height:420px\"><h2>Bagian Tengah</h2><p>Area tinggi agar halaman cukup panjang.</p></div>\n<div class=\"card\" style=\"height:420px;background:#e0e7ff\"><h2>Bagian Lain</h2><p>Satu lagi blok tinggi.</p></div></section>\n<footer>© Gamato Piranti — contoh footer</footer></body></html>");

// ── riwayat objek per konteks (live layar, live HTML, tiap item) ─────────
interface Ctx { objs: AnnObj[]; base: AnnObj[]; past: AnnObj[][]; future: AnnObj[][] }

const MAX_LONG_H = 30000;

function loadBitmap(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error(tr("Gambar tidak bisa dibaca.")));
    im.src = src;
  });
}
const fileToDataUrl = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });

function makeThumb(item: CaptureItem): string {
  const max = 220;
  const sc = Math.min(1, max / Math.max(item.base.width, 1));
  const w = Math.max(1, Math.round(item.base.width * sc));
  const h = Math.max(1, Math.min(300, Math.round(item.base.height * sc)));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.scale(sc, sc);
  ctx.drawImage(item.base, 0, 0);
  drawObjects(ctx, item.objects, item.base, item.base.width, item.base.height);
  ctx.restore();
  return c.toDataURL("image/jpeg", 0.7);
}

const CanvasMount: React.FC<{ canvas: HTMLCanvasElement }> = ({ canvas }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    canvas.style.cssText = "display:block;width:100%;height:100%;max-width:none;";
    host.appendChild(canvas);
    return () => { if (canvas.parentNode === host) host.removeChild(canvas); };
  }, [canvas]);
  return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
};

export const CaptureWebsite: React.FC = () => {
  const [source, setSource] = useState<Source>("screen");
  const [alert, setAlert] = useState<Alert>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // tumpukan
  const [stack, setStack] = useState<(CaptureItem & { thumb: string })[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  // alat
  const [tool, setTool] = useState<ToolId>("arrow");
  const [style, setStyle] = useState<ToolStyle>(DEFAULT_STYLE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [interactive, setInteractive] = useState(true);
  const { customFonts, isFontLoading, fontError, addCustomFont, removeCustomFont } = useCustomFonts();

  // konteks anotasi
  const store = useRef(new Map<string, Ctx>());
  const [, force] = useReducer((x: number) => x + 1, 0);
  const ctxKey = activeId ? `item:${activeId}` : source === "html" ? "live-html" : "live-screen";
  const ensureCtx = (key: string): Ctx => {
    let c = store.current.get(key);
    if (!c) {
      const initial = key.startsWith("item:") ? stackRef.current.find((s) => `item:${s.id}` === key)?.objects ?? [] : [];
      c = { objs: initial, base: initial, past: [], future: [] };
      store.current.set(key, c);
    }
    return c;
  };
  const cur = ensureCtx(ctxKey);
  const syncItem = (key: string, objs: AnnObj[]) => {
    if (!key.startsWith("item:")) return;
    const id = key.slice(5);
    setStack((s) => s.map((it) => {
      if (it.id !== id) return it;
      const next = { ...it, objects: objs };
      return { ...next, thumb: makeThumb(next) };
    }));
  };
  const onPreview = (objs: AnnObj[]) => { ensureCtx(ctxKey).objs = objs; force(); };
  const onCommit = (objs: AnnObj[]) => {
    const c = ensureCtx(ctxKey);
    c.past.push(c.base);
    if (c.past.length > 100) c.past.shift();
    c.base = objs;
    c.objs = objs;
    c.future = [];
    syncItem(ctxKey, objs);
    force();
  };
  const undo = () => {
    const c = ensureCtx(ctxKey);
    const prev = c.past.pop();
    if (!prev) return;
    c.future.push(c.base);
    c.base = prev;
    c.objs = prev;
    syncItem(ctxKey, prev);
    setSelectedId(null);
    force();
  };
  const redo = () => {
    const c = ensureCtx(ctxKey);
    const nxt = c.future.pop();
    if (!nxt) return;
    c.past.push(c.base);
    c.base = nxt;
    c.objs = nxt;
    syncItem(ctxKey, nxt);
    force();
  };
  const objs = cur.objs;
  const selected = objs.find((o) => o.id === selectedId) ?? null;

  // ── keyboard global ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (e.key === "Escape") setSelectedId(null);
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        const c = ensureCtx(ctxKey);
        onCommit(c.objs.filter((o) => o.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ── tumpukan ──
  const addItem = useCallback((base: HTMLCanvasElement, src: CaptureItem["source"], objects: AnnObj[] = [], name?: string) => {
    const item: CaptureItem = { id: annId(), name: name || tr("Tangkapan {0}", stackRef.current.length + 1), base, objects, source: src, createdAt: Date.now() };
    const withThumb = { ...item, thumb: makeThumb(item) };
    setStack((s) => [...s, withThumb]);
    return item.id;
  }, []);

  const moveItem = (i: number, d: -1 | 1) => setStack((s) => {
    const j = i + d;
    if (j < 0 || j >= s.length) return s;
    const n = s.slice();
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const removeItem = (id: string) => {
    setStack((s) => s.filter((x) => x.id !== id));
    store.current.delete(`item:${id}`);
    if (activeId === id) { setActiveId(null); setSelectedId(null); }
  };

  // ── gambar impor / tempel ──
  const importImages = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) { setAlert({ msg: tr("Pilih berkas gambar (PNG, JPG, WEBP…)."), tone: "warning" }); return; }
    let n = 0;
    for (const f of imgs) {
      try {
        const bm = await createImageBitmap(f);
        const c = document.createElement("canvas");
        c.width = bm.width; c.height = bm.height;
        c.getContext("2d")!.drawImage(bm, 0, 0);
        bm.close();
        addItem(c, "image", [], f.name.replace(/\.[^.]+$/, ""));
        n++;
      } catch { /* lewati */ }
    }
    if (n) setAlert({ msg: tr("{0} gambar ditambahkan ke tumpukan.", n), tone: "success" });
    else setAlert({ msg: tr("Gambar tidak bisa dibaca."), tone: "error" });
  };
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); importImages(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // ── layar / tab ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [vdim, setVdim] = useState<{ w: number; h: number }>({ w: 1280, h: 720 });
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const [cropMode, setCropMode] = useState(false);
  const [cropDrag, setCropDrag] = useState<{ x0: number; y0: number } | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [clearAfter, setClearAfter] = useState(true);
  const [fixedTop, setFixedTop] = useState(0);
  const [fixedBottom, setFixedBottom] = useState(0);
  const [longRun, setLongRun] = useState<null | { height: number; frames: number; lost: number; note: string }>(null);
  const stitcherRef = useRef<LongStitcher | null>(null);
  const longTimer = useRef<number | null>(null);
  const longBusy = useRef(false);
  const miniRef = useRef<HTMLCanvasElement>(null);

  const stopShare = useCallback(() => {
    if (longTimer.current) { clearInterval(longTimer.current); longTimer.current = null; }
    stitcherRef.current = null;
    setLongRun(null);
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setSharing(false);
    setCrop(null);
    setCropMode(false);
  }, []);
  useEffect(() => () => stopShare(), [stopShare]);

  const startShare = async () => {
    setAlert(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setAlert({ msg: tr("Browser ini tidak mendukung tangkap layar (getDisplayMedia). Gunakan Chrome/Edge/Firefox desktop terbaru — atau pakai mode HTML / Impor Gambar."), tone: "error" });
      return;
    }
    try {
      stopShare();
      const stream = await requestDisplay({ video: { frameRate: { ideal: 30 } }, audio: false });
      const v = videoRef.current;
      if (!v) { stopStream(stream); return; }
      streamRef.current = stream;
      v.srcObject = stream;
      await v.play().catch(() => {});
      stream.getVideoTracks()[0].addEventListener("ended", () => stopShare());
      const upd = () => { if (v.videoWidth) setVdim({ w: v.videoWidth, h: v.videoHeight }); };
      v.onloadedmetadata = upd;
      v.onresize = upd;
      upd();
      setSharing(true);
      setAlert({ msg: tr("Layar dibagikan. Atur jendela/tab yang ingin ditangkap, beri anotasi bila perlu, lalu klik “Ambil Tangkapan”."), tone: "info" });
    } catch (e: any) {
      if (e instanceof PermissionError) {
        setAlert({ msg: `${e.failure.title}. ${e.failure.message}`, tone: e.failure.code === "dismissed" ? "warning" : "error" });
        return;
      }
      const n = e?.name;
      setAlert({
        msg: n === "NotAllowedError" ? tr("Izin tangkap layar ditolak atau dibatalkan.") : n === "NotFoundError" ? tr("Tidak ada layar/tab yang bisa ditangkap.") : n === "NotReadableError" ? tr("Layar/tab tidak bisa dibaca (diblokir sistem atau browser).") : tr("Gagal memulai tangkap layar{0}", e?.message ? `: ${e.message}` : "."),
        tone: "error",
      });
    }
  };

  const grabFrame = (): HTMLCanvasElement | null => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || v.readyState < 2) return null;
    const cr = cropRef.current ?? { x: 0, y: 0, w: v.videoWidth, h: v.videoHeight };
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(cr.w));
    c.height = Math.max(1, Math.round(cr.h));
    c.getContext("2d")!.drawImage(v, cr.x, cr.y, cr.w, cr.h, 0, 0, c.width, c.height);
    return c;
  };

  const captureFrame = () => {
    const f = grabFrame();
    if (!f) { setAlert({ msg: tr("Belum ada gambar dari layar yang dibagikan."), tone: "warning" }); return; }
    const live = ensureCtx("live-screen").objs;
    const cr = cropRef.current;
    const moved = transformObjs(cloneObjs(live), 1, cr ? -cr.x : 0, cr ? -cr.y : 0);
    const id = addItem(f, "frame", moved);
    store.current.delete(`item:${id}`);
    if (clearAfter) { const c = ensureCtx("live-screen"); c.objs = []; c.base = []; c.past = []; c.future = []; setSelectedId(null); }
    setAlert({ msg: tr("Tangkapan {0} ditambahkan ({1}×{2}).", stackRef.current.length + 1, f.width, f.height), tone: "success" });
    force();
  };

  const startLong = () => {
    const f0 = grabFrame();
    if (!f0) { setAlert({ msg: tr("Bagikan layar/tab dulu."), tone: "warning" }); return; }
    const st = new LongStitcher({ fixedTop, fixedBottom, maxHeight: MAX_LONG_H });
    stitcherRef.current = st;
    st.addFrame(f0);
    setLongRun({ height: st.height, frames: 1, lost: 0, note: tr("Mulai scroll halaman di tab yang dibagikan — pelan & stabil.") });
    longTimer.current = window.setInterval(() => {
      if (longBusy.current || !stitcherRef.current) return;
      const f = grabFrame();
      if (!f) return;
      longBusy.current = true;
      try {
        const s: StitchStatus = stitcherRef.current.addFrame(f);
        const note =
          s.kind === "lost" ? (s.reason === "fast" ? tr("Scroll terlalu cepat — overlap hilang. Scroll lebih pelan.") : s.reason === "flat" ? tr("Area polos terdeteksi — lanjutkan scroll ke area bertekstur.") : tr("Posisi tidak cocok — scroll kembali pelan-pelan."))
          : s.kind === "full" ? tr("Batas tinggi {0}px tercapai — klik Selesai.", MAX_LONG_H)
          : s.kind === "appended" ? tr("Menjahit…") : tr("Tunggu / lanjut scroll…");
        setLongRun({ height: stitcherRef.current.height, frames: stitcherRef.current.frames, lost: stitcherRef.current.lost, note });
        const mini = miniRef.current;
        if (mini) {
          const sc = Math.min(1, 150 / Math.max(1, stitcherRef.current.width));
          const hh = Math.min(260, Math.round(stitcherRef.current.height * sc));
          mini.width = Math.round(stitcherRef.current.width * sc);
          mini.height = Math.max(1, hh);
          const sy = Math.max(0, stitcherRef.current.height - hh / sc);
          mini.getContext("2d")!.drawImage(stitcherRef.current.canvas, 0, sy, stitcherRef.current.width, hh / sc, 0, 0, mini.width, mini.height);
        }
        if (s.kind === "full" && longTimer.current) { clearInterval(longTimer.current); longTimer.current = null; }
      } finally { longBusy.current = false; }
    }, 130);
  };

  const finishLong = (save: boolean) => {
    if (longTimer.current) { clearInterval(longTimer.current); longTimer.current = null; }
    const st = stitcherRef.current;
    stitcherRef.current = null;
    setLongRun(null);
    if (!st || !save) return;
    const f = grabFrame();
    if (f && f.width === st.width) st.addFrame(f);
    const out = st.finish();
    if (out.height < 8) { setAlert({ msg: tr("Tidak ada hasil."), tone: "warning" }); return; }
    addItem(out, "long", [], tr("Panjang {0}", stackRef.current.length + 1));
    setAlert({ msg: tr("Tangkapan panjang disimpan ({0}×{1}px).", out.width, out.height), tone: "success" });
  };

  const openUrl = () => {
    const u = sanitizeUrl(urlInput);
    if (!u) { setAlert({ msg: tr("URL tidak valid — gunakan alamat lengkap diawali https://"), tone: "warning" }); return; }
    window.open(u, "_blank", "noopener,noreferrer");
    setAlert({ msg: tr("Situs dibuka di tab baru. Kembali ke sini → “Bagikan Layar/Tab” → pilih tab situs itu."), tone: "info" });
  };

  // area tangkap (crop) di pratinjau video
  const cropPointer = (e: React.PointerEvent, phase: "down" | "move" | "up") => {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(vdim.w, ((e.clientX - r.left) / r.width) * vdim.w));
    const y = Math.max(0, Math.min(vdim.h, ((e.clientY - r.top) / r.height) * vdim.h));
    if (phase === "down") { el.setPointerCapture(e.pointerId); setCropDrag({ x0: x, y0: y }); setCrop({ x, y, w: 0, h: 0 }); }
    else if (cropDrag) {
      const nx = Math.min(cropDrag.x0, x), ny = Math.min(cropDrag.y0, y);
      setCrop({ x: nx, y: ny, w: Math.abs(x - cropDrag.x0), h: Math.abs(y - cropDrag.y0) });
      if (phase === "up") {
        setCropDrag(null);
        setCropMode(false);
        const c = cropRef.current;
        if (!c || c.w < 20 || c.h < 20) setCrop(null);
      }
    }
  };

  // ── HTML ──
  const [html, setHtml] = useState("");
  const [device, setDevice] = useState("desktop");
  const [customW, setCustomW] = useState(1024);
  const [scale, setScale] = useState(1);
  const [segH, setSegH] = useState(0);
  const [htmlBg, setHtmlBg] = useState("#ffffff");
  const [pageH, setPageH] = useState(900);
  const [htmlFile, setHtmlFile] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const devW = device === "custom" ? Math.max(240, Math.min(3840, customW)) : DEVICES.find((d) => d.id === device)!.w;

  const measureIframe = useCallback(() => {
    const f = iframeRef.current;
    if (!f) return;
    const h = measureFrameHeight(f);
    if (h > 0) setPageH(h);
  }, []);
  const onIframeLoad = () => {
    measureIframe();
    setTimeout(measureIframe, 500);
    setTimeout(measureIframe, 1500);
  };
  useEffect(() => { setPreviewKey((k) => k + 1); }, [html, devW]);

  const loadHtmlFile = async (files: File[]) => {
    const f = files.find((x) => /\.(html?|xhtml|txt)$/i.test(x.name) || x.type.startsWith("text/"));
    if (!f) { setAlert({ msg: tr("Pilih berkas .html / .htm."), tone: "warning" }); return; }
    setHtml(await f.text());
    setHtmlFile(f.name);
    setAlert({ msg: `${f.name} dimuat.`, tone: "success" });
  };

  const captureFromHtml = async () => {
    if (!html.trim()) { setAlert({ msg: tr("Isi kode HTML dulu (atau klik “Contoh”)."), tone: "warning" }); return; }
    setBusy(tr("Merender halaman penuh…"));
    setAlert(null);
    try {
      const res = await captureHtml(html, { width: devW, scale, bg: htmlBg, segmentHeight: segH });
      const live = ensureCtx("live-html").objs;
      let y = 0;
      const per = res.canvases.length;
      res.canvases.forEach((cv, i) => {
        const segCss = cv.height / scale;
        const objsForSeg = transformObjs(cloneObjs(live), scale, 0, -y);
        const id = addItem(cv, "html", objsForSeg, per > 1 ? tr("Halaman bagian {0}", i + 1) : htmlFile ? htmlFile.replace(/\.[^.]+$/, "") : undefined);
        store.current.delete(`item:${id}`);
        y += segCss;
      });
      if (clearAfter) { const c = ensureCtx("live-html"); c.objs = []; c.base = []; c.past = []; c.future = []; setSelectedId(null); }
      const w = res.canvases[0].width;
      setAlert({ msg: tr("Halaman {0}px × {1}px ditangkap ({2}px lebar, {3} gambar). {4}", devW, res.pageHeight, w, per, res.notes.join(" ")), tone: res.notes.length ? "warning" : "success" });
    } catch (e: any) {
      setAlert({ msg: e?.message || tr("Gagal menangkap HTML."), tone: "error" });
    } finally { setBusy(null); }
  };

  // ── gaya & objek terpilih ──
  const patchSelected = (patch: Record<string, unknown>) => {
    if (!selected) return;
    const c = ensureCtx(ctxKey);
    onCommit(c.objs.map((o) => (o.id === selected.id ? ({ ...o, ...patch } as AnnObj) : o)));
  };
  const setS = (patch: Partial<ToolStyle>) => {
    setStyle((s) => ({ ...s, ...patch }));
    if (selected) {
      const map: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (k === "blurMode") map.mode = v;
        else if (k === "blurAmount") map.amount = v;
        else if (k === "size" && (selected.type === "text" || selected.type === "step")) map.size = v;
        else if (k === "width" && selected.type === "marker") map.width = v;
        else if (k in selected) map[k] = v;
      }
      if (Object.keys(map).length) patchSelected(map);
    }
  };
  const sv = (k: keyof ToolStyle) => (selected && ((k === "blurMode" ? "mode" : k === "blurAmount" ? "amount" : k) in selected) ? (selected as any)[k === "blurMode" ? "mode" : k === "blurAmount" ? "amount" : k] : style[k]);

  const addImageObject = async (f: File | undefined | null) => {
    if (!f) return;
    try {
      const src = await fileToDataUrl(f);
      const bm = await loadBitmap(src);
      const cw = activeItem ? activeItem.base.width : source === "html" ? devW : vdim.w;
      const ch = activeItem ? activeItem.base.height : source === "html" ? pageH : vdim.h;
      const w = Math.min(bm.width, cw * 0.4), h = w * (bm.height / bm.width);
      const o: AnnObj = { id: annId(), type: "image", color: "#000", width: 0, opacity: 1, x: cw / 2 - w / 2, y: Math.min(ch / 2 - h / 2, ch - h), w, h, src, bitmap: bm };
      const c = ensureCtx(ctxKey);
      onCommit([...c.objs, o]);
      setSelectedId(o.id);
      setTool("select");
    } catch (e: any) { setAlert({ msg: e?.message || tr("Gambar gagal ditambahkan."), tone: "error" }); }
  };

  const activeItem = activeId ? stack.find((s) => s.id === activeId) ?? null : null;
  const stageObjs = objs;

  // ── ekspor ──
  const [fmt, setFmt] = useState<ImgFormat>("png");
  const [q, setQ] = useState(90);
  const [baseName, setBaseName] = useState("capture-website");
  const [pdfSize, setPdfSize] = useState<PageSize>("a4");
  const [pdfOrient, setPdfOrient] = useState<"portrait" | "landscape" | "auto">("portrait");
  const [pdfMargin, setPdfMargin] = useState(10);
  const [pdfNum, setPdfNum] = useState(true);
  const [pdfNew, setPdfNew] = useState(true);
  const [pdfLossless, setPdfLossless] = useState(false);
  const [pdfQ, setPdfQ] = useState(90);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const doExport = async () => {
    if (!stack.length) return;
    setBusy("Menyusun gambar…");
    try {
      const r = await exportImages(stack, fmt, q / 100, baseName);
      downloadBlob(r.blob, r.name);
      setLastExport(`${r.name} (${(r.blob.size / 1024 / 1024).toFixed(2)} MB)`);
      setAlert({ msg: r.kind === "zip" ? tr("ZIP berisi {0} gambar diunduh.", stack.length) : tr("Gambar diunduh."), tone: "success" });
    } catch (e: any) { setAlert({ msg: e?.message || tr("Ekspor gagal."), tone: "error" }); }
    finally { setBusy(null); }
  };
  const doPdf = async () => {
    if (!stack.length) return;
    setBusy("Menyusun PDF…");
    try {
      const r = await exportPdf(stack, { pageSize: pdfSize, orientation: pdfOrient, marginMm: pdfMargin, numbering: pdfNum, newPagePerCapture: pdfNew, jpegQuality: pdfQ / 100, lossless: pdfLossless, title: baseName });
      downloadBlob(r.blob, `${baseName.replace(/[\\/:*?"<>|]+/g, "_") || "capture"}.pdf`);
      setLastExport(tr("PDF {0} halaman ({1} MB)", r.pages, (r.blob.size / 1024 / 1024).toFixed(2)));
      setAlert({ msg: tr("PDF {0} halaman diunduh.", r.pages), tone: "success" });
    } catch (e: any) { setAlert({ msg: e?.message || tr("Ekspor PDF gagal."), tone: "error" }); }
    finally { setBusy(null); }
  };

  // ── render ──
  const stageBase: CanvasImageSource | null = activeItem ? activeItem.base : source === "screen" ? videoRef.current : null;
  const isLiveBase = !activeItem && source === "screen" && sharing;
  const showStage = !!activeItem || source === "screen" || source === "html";
  const stageInteractive = activeItem ? true : source === "html" ? interactive : sharing && !cropMode;

  const colorRow = (
    <div className="grid grid-cols-2 gap-3">
      <GamatoColorPicker label={tr("Warna")} value={String(sv("color"))} onChange={(v) => setS({ color: v })} testId="cw-color" />
      {["rect", "ellipse"].includes(selected?.type ?? tool) && <GamatoColorPicker label={tr("Isi")} value={String(sv("fill"))} onChange={(v) => setS({ fill: v, fillOpacity: Number(sv("fillOpacity")) || 0.35 })} testId="cw-fill" />}
    </div>
  );

  const activeTool: ToolId | "selected" = selected && tool === "select" ? (selected.type as ToolId) : tool;
  const needsWidth = ["pen", "marker", "line", "arrow", "rect", "ellipse"].includes(activeTool);

  return (
    <div className="space-y-5">
      {/* Sumber */}
      <div className="grid grid-cols-3 gap-2" role="tablist">
        {([["screen", tr("Layar / Tab"), <Monitor key="a" className="w-4 h-4" />, tr("Website apa pun")], ["html", tr("HTML / Kode"), <Code2 key="b" className="w-4 h-4" />, tr("Halaman penuh instan")], ["image", tr("Impor Gambar"), <Upload key="c" className="w-4 h-4" />, tr("Anotasi screenshot")]] as const).map(([id, label, icon, sub]) => (
          <button key={id} type="button" role="tab" aria-selected={source === id} data-testid={`cw-src-${id}`} onClick={() => { setSource(id); setActiveId(null); setSelectedId(null); }}
            className={cn("rounded-2xl border-2 p-3 text-left transition-all flex items-center gap-2.5", source === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300")}>
            <span className={source === id ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400"}>{icon}</span>
            <span><span className={cn("block text-sm font-bold", source === id ? "text-indigo-700 dark:text-indigo-200" : "text-slate-800 dark:text-slate-100")}>{label}</span><span className="block text-[11px] text-slate-400">{sub}</span></span>
          </button>
        ))}
      </div>

      {alert && <GamatoInlineAlert message={alert.msg} tone={alert.tone} />}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        {/* KIRI */}
        <div className="space-y-4 min-w-0">
          {activeItem && (
            <div className="flex items-center gap-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 px-4 py-2.5" data-testid="cw-editing-bar">
              <span className="text-sm text-indigo-800 dark:text-indigo-200 flex-1 truncate">{tr("Mengedit:")} <b>{activeItem.name}</b>{" "}{tr("· {0}×{1}px", activeItem.base.width, activeItem.base.height)}</span>
              <Btn variant="secondary" className="!py-1.5" onClick={() => { setActiveId(null); setSelectedId(null); }} data-testid="cw-back-live"><ChevronLeft className="w-4 h-4" />{tr("Kembali")}</Btn>
            </div>
          )}

          {/* Toolbar */}
          {(showStage) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-2 flex flex-wrap items-center gap-1" data-testid="cw-toolbar">
              {TOOLS.map((t) => (
                <button key={t.id} type="button" title={t.label} aria-label={t.label} data-testid={`cw-tool-${t.id}`} onClick={() => { setTool(t.id); if (t.id !== "select") setSelectedId(null); }}
                  className={cn("p-2.5 rounded-xl transition-all", tool === t.id ? "bg-slate-900 dark:bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800")}>
                  {t.icon}
                </button>
              ))}
              <span className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
              <button type="button" title={tr("Urungkan (Ctrl+Z)")} aria-label={tr("Urungkan")} data-testid="cw-undo" onClick={undo} disabled={!cur.past.length} className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><Undo2 className="w-4 h-4" /></button>
              <button type="button" title={tr("Ulangi (Ctrl+Y)")} aria-label={tr("Ulangi")} data-testid="cw-redo" onClick={redo} disabled={!cur.future.length} className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><Redo2 className="w-4 h-4" /></button>
              <button type="button" title={tr("Hapus semua anotasi")} aria-label={tr("Hapus semua anotasi")} data-testid="cw-clear" onClick={() => { if (objs.length) { onCommit([]); setSelectedId(null); } }} disabled={!objs.length} className="p-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
              <label title={tr("Tambah gambar ke atas halaman")} className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" data-testid="cw-add-image-label">
                <ImagePlus className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" data-testid="cw-add-image" onChange={(e) => { addImageObject(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <span className="flex-1" />
              {!activeItem && source === "html" && (
                <button type="button" onClick={() => setInteractive((v) => !v)} data-testid="cw-browse-toggle" title={tr("Mode jelajah: teruskan klik ke halaman")} className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold", interactive ? "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" : "bg-amber-100 text-amber-800")}>
                  <Hand className="w-4 h-4" />{interactive ? tr("Anotasi aktif") : tr("Mode jelajah")}
                </button>
              )}
              <div className="flex items-center gap-2 w-32 pr-1">
                <span className="text-[10px] text-slate-400">{tr("Zoom")}</span>
                <GamatoSlider min={0.25} max={2} step={0.05} value={zoom} onChange={setZoom} aria-label={tr("Zoom")} />
              </div>
            </div>
          )}

          {/* PANGGUNG */}
          {activeItem ? (
            <AnnotationStage key={activeItem.id} testId="cw-stage" contentW={activeItem.base.width} contentH={activeItem.base.height} objects={stageObjs} onPreview={onPreview} onCommit={onCommit} base={activeItem.base} tool={tool} style={style} interactive selectedId={selectedId} onSelect={setSelectedId} onRequestTextEdit={() => setTool("select")} zoom={zoom}>
              <CanvasMount canvas={activeItem.base} />
            </AnnotationStage>
          ) : source === "screen" ? (
            <div className="relative">
              <AnnotationStage testId="cw-stage" contentW={vdim.w} contentH={vdim.h} objects={stageObjs} onPreview={onPreview} onCommit={onCommit} base={stageBase} tool={tool} style={style} interactive={stageInteractive} selectedId={selectedId} onSelect={setSelectedId} zoom={zoom} live={isLiveBase}>
                <div style={{ width: "100%", height: "100%", background: "#0f172a" }}>
                  <video ref={videoRef} autoPlay muted playsInline data-testid="cw-video" style={{ width: "100%", height: "100%", objectFit: "fill", display: "block", maxWidth: "none" }} />
                </div>
                {crop && crop.w > 0 && (
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }} data-testid="cw-crop-box">
                    <div style={{ position: "absolute", left: `${(crop.x / vdim.w) * 100}%`, top: `${(crop.y / vdim.h) * 100}%`, width: `${(crop.w / vdim.w) * 100}%`, height: `${(crop.h / vdim.h) * 100}%`, border: "2px dashed #f59e0b", boxShadow: "0 0 0 9999px rgba(15,23,42,0.45)" }} />
                  </div>
                )}
                {cropMode && (
                  <div style={{ position: "absolute", inset: 0, cursor: "crosshair", touchAction: "none" }} data-testid="cw-crop-layer"
                    onPointerDown={(e) => cropPointer(e, "down")} onPointerMove={(e) => cropPointer(e, "move")} onPointerUp={(e) => cropPointer(e, "up")} />
                )}
                {!sharing && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <p className="text-slate-300 text-sm text-center px-6">{tr("Belum ada layar yang dibagikan.")}<br />{tr("Klik “Bagikan Layar/Tab” di bawah.")}</p>
                  </div>
                )}
              </AnnotationStage>
            </div>
          ) : source === "html" ? (
            <AnnotationStage testId="cw-stage" contentW={devW} contentH={pageH} objects={stageObjs} onPreview={onPreview} onCommit={onCommit} base={null} tool={tool} style={style} interactive={interactive} selectedId={selectedId} onSelect={setSelectedId} zoom={zoom}>
              {(k) => (
                <div style={{ width: devW, height: pageH, transform: `scale(${k})`, transformOrigin: "0 0", background: htmlBg }}>
                  <iframe key={previewKey} ref={iframeRef} title={tr("Pratinjau HTML")} data-testid="cw-iframe" sandbox="allow-same-origin" srcDoc={html || "<body style='font-family:sans-serif;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>Tempel HTML atau klik “Contoh”</body>"} onLoad={onIframeLoad}
                    style={{ width: devW, height: pageH, border: 0, display: "block", maxWidth: "none", background: "#fff" }} />
                </div>
              )}
            </AnnotationStage>
          ) : (
            <Dropzone onFiles={importImages} multiple accept="image/*" label={tr("Drop screenshot / gambar di sini")} sublabel={tr("atau tempel dengan Ctrl+V — langsung masuk tumpukan untuk dianotasi & diekspor")} icon={<ClipboardPaste className="w-8 h-8" />} />
          )}

          {/* Kontrol sumber */}
          {!activeItem && source === "screen" && (
            <div className={card} data-testid="cw-screen-controls">
              <div className="flex flex-wrap gap-2">
                {!sharing ? (
                  <Btn onClick={startShare} data-testid="cw-share"><Monitor className="w-4 h-4" />{tr("Bagikan Layar / Tab")}</Btn>
                ) : (
                  <>
                    <Btn onClick={captureFrame} disabled={!!longRun} data-testid="cw-capture"><Camera className="w-4 h-4" />{tr("Ambil Tangkapan")}</Btn>
                    {!longRun ? (
                      <Btn variant="secondary" onClick={startLong} data-testid="cw-long-start"><Play className="w-4 h-4" />{tr("Tangkap Panjang (scroll)")}</Btn>
                    ) : (
                      <>
                        <Btn onClick={() => finishLong(true)} data-testid="cw-long-finish"><StopSquare className="w-4 h-4" />{tr("Selesai & Simpan")}</Btn>
                        <Btn variant="danger" onClick={() => finishLong(false)} data-testid="cw-long-cancel"><X className="w-4 h-4" />{tr("Batal")}</Btn>
                      </>
                    )}
                    <Btn variant="secondary" disabled={!!longRun} onClick={() => { if (crop) setCrop(null); else setCropMode(true); }} data-testid="cw-crop-btn"><Crop className="w-4 h-4" />{crop ? tr("Hapus area") : cropMode ? tr("Seret di pratinjau…") : tr("Pilih area")}</Btn>
                    <Btn variant="ghost" onClick={stopShare} data-testid="cw-stop-share">{tr("Hentikan")}</Btn>
                  </>
                )}
              </div>
              {!sharing && (
                <div className="flex gap-2">
                  <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder={tr("https://situs-yang-ingin-ditangkap.com")} data-testid="cw-url" />
                  <Btn variant="secondary" onClick={openUrl} className="shrink-0"><ExternalLink className="w-4 h-4" />{tr("Buka di tab baru")}</Btn>
                </div>
              )}
              {longRun && (
                <div className="flex gap-4 items-start rounded-xl bg-slate-50 dark:bg-slate-800 p-3" data-testid="cw-long-status">
                  <canvas ref={miniRef} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white" style={{ width: 90, height: "auto", maxHeight: 160 }} />
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p><b data-testid="cw-long-height">{longRun.height}</b>{" "}{tr("px · {0} frame · {1} terlewat", longRun.frames, longRun.lost)}</p>
                    <p className="text-indigo-600 dark:text-indigo-300 font-semibold">{longRun.note}</p>
                    <p className="text-slate-400">{tr("Scroll pelan di tab yang dibagikan; boleh naik-turun. Klik “Selesai” bila sudah di dasar halaman.")}</p>
                  </div>
                </div>
              )}
              {sharing && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>{tr("Header tetap diabaikan (px)")}</Label><Input type="number" min={0} max={600} value={fixedTop} disabled={!!longRun} onChange={(e) => setFixedTop(Math.max(0, Number(e.target.value) || 0))} data-testid="cw-fixed-top" /></div>
                  <div><Label>{tr("Footer tetap diabaikan (px)")}</Label><Input type="number" min={0} max={600} value={fixedBottom} disabled={!!longRun} onChange={(e) => setFixedBottom(Math.max(0, Number(e.target.value) || 0))} data-testid="cw-fixed-bottom" /></div>
                </div>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{tr("Frame saat ini: {0}×{1}", vdim.w, vdim.h)}{crop && crop.w > 0 ? tr(" · area {0}×{1}", Math.round(crop.w), Math.round(crop.h)) : ""}{tr(". Memilih jendela/layar penuh ikut menangkap bingkai browser — gunakan “Pilih area” atau bagikan")} <b>{tr("tab")}</b> {tr("agar hasil bersih.")}</p>
            </div>
          )}

          {!activeItem && source === "html" && (
            <div className={card} data-testid="cw-html-controls">
              <div className="flex flex-wrap gap-2 items-center">
                <Btn variant="secondary" onClick={() => { setHtml(SAMPLE_HTML); setHtmlFile(""); }} data-testid="cw-html-sample"><Globe className="w-4 h-4" />{tr("Contoh")}</Btn>
                <label className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 cursor-pointer">
                  <Upload className="w-4 h-4" />{tr("Buka berkas .html")}
                  <input type="file" accept=".html,.htm,.xhtml,text/html" className="hidden" data-testid="cw-html-file" onChange={(e) => { if (e.target.files) loadHtmlFile(Array.from(e.target.files)); e.target.value = ""; }} />
                </label>
                {html && <Btn variant="ghost" onClick={() => { setHtml(""); setHtmlFile(""); }}>{tr("Kosongkan")}</Btn>}
              </div>
              <Textarea label={tr("Kode HTML")} rows={8} value={html} onChange={(e) => { setHtml(e.target.value); setHtmlFile(""); }} placeholder={tr("<!doctype html>… tempel HTML lengkap di sini")} className="font-mono text-xs" data-testid="cw-html-code" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Select label={tr("Perangkat")} value={device} onChange={(e) => setDevice(e.target.value)} data-testid="cw-device">{DEVICES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</Select>
                <Input label={tr("Lebar (px)")} type="number" min={240} max={3840} value={device === "custom" ? customW : devW} disabled={device !== "custom"} onChange={(e) => setCustomW(Number(e.target.value) || 1024)} data-testid="cw-custom-w" />
                <Select label={tr("Skala")} value={String(scale)} onChange={(e) => setScale(Number(e.target.value))} data-testid="cw-scale"><option value="1">{tr("1× normal")}</option><option value="2">{tr("2× tajam")}</option><option value="3">{tr("3× sangat tajam")}</option></Select>
                <Select label={tr("Potong per")} value={String(segH)} onChange={(e) => setSegH(Number(e.target.value))} data-testid="cw-seg"><option value="0">{tr("Satu gambar utuh")}</option><option value="1000">{tr("1000 px")}</option><option value="2000">{tr("2000 px")}</option><option value="4000">{tr("4000 px")}</option></Select>
              </div>
              <GamatoColorPicker label={tr("Warna latar cadangan")} value={htmlBg} onChange={setHtmlBg} testId="cw-html-bg" />
              <Btn onClick={captureFromHtml} disabled={!!busy || !html.trim()} data-testid="cw-html-capture" className="w-full py-3.5">{busy && busy.startsWith("Merender") ? <><Loader2 className="w-4 h-4 animate-spin" />{tr("Merender…")}</> : <><Camera className="w-4 h-4" />{tr("Tangkap Halaman Penuh ({0}×{1}px)", devW, pageH)}</>}</Btn>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{tr("Skrip tidak dijalankan (aman). Stylesheet/gambar eksternal ikut dimuat hanya bila server mengizinkan CORS; selebihnya gunakan CSS inline atau data URL.")}</p>
            </div>
          )}

          {source === "image" && !activeItem && stack.length > 0 && (
            <p className="text-xs text-slate-400">{tr("Klik gambar di tumpukan (kanan) untuk memberi anotasi.")}</p>
          )}
        </div>

        {/* KANAN */}
        <div className="space-y-4 min-w-0">
          {/* Gaya alat */}
          {showStage && (
            <div className={card} data-testid="cw-style-panel">
              <p className={cap}>{selected ? tr("Objek Terpilih") : tr("Gaya Alat")}</p>
              {activeTool !== "select" && activeTool !== "eraser" && colorRow}
              {needsWidth && <div data-testid="cw-width"><div className="flex justify-between mb-1.5"><Label>{tr("Tebal")}</Label><span className="text-sm font-bold text-indigo-600">{tr("{0}px", Math.round(Number(sv("width"))))}</span></div><GamatoSlider min={1} max={60} step={1} value={Number(sv("width"))} onChange={(v) => setS({ width: v })} aria-label={tr("Tebal")} /></div>}
              {activeTool !== "select" && activeTool !== "eraser" && activeTool !== "blur" && activeTool !== "step" && <div><div className="flex justify-between mb-1.5"><Label>{tr("Kepekatan")}</Label><span className="text-sm font-bold text-indigo-600">{Math.round(Number(sv("opacity")) * 100)}%</span></div><GamatoSlider min={0.1} max={1} step={0.05} value={Number(sv("opacity"))} onChange={(v) => setS({ opacity: v })} aria-label={tr("Kepekatan")} /></div>}
              {["rect", "ellipse"].includes(activeTool) && (
                <>
                  <div><div className="flex justify-between mb-1.5"><Label>{tr("Isi (kepekatan)")}</Label><span className="text-sm font-bold text-indigo-600">{Math.round(Number(sv("fillOpacity")) * 100)}%</span></div><GamatoSlider min={0} max={1} step={0.05} value={Number(sv("fillOpacity"))} onChange={(v) => setS({ fillOpacity: v })} aria-label={tr("Isi")} /></div>
                  {activeTool === "rect" && <div><div className="flex justify-between mb-1.5"><Label>{tr("Sudut membulat")}</Label><span className="text-sm font-bold text-indigo-600">{tr("{0}px", Math.round(Number(sv("radius"))))}</span></div><GamatoSlider min={0} max={80} step={1} value={Number(sv("radius"))} onChange={(v) => setS({ radius: v })} aria-label={tr("Sudut")} /></div>}
                </>
              )}
              {activeTool === "text" && (
                <>
                  {selected?.type === "text" && <Textarea label={tr("Isi teks")} rows={3} value={selected.text} onChange={(e) => { const c = ensureCtx(ctxKey); onPreview(c.objs.map((o) => (o.id === selected.id ? { ...o, text: e.target.value } as AnnObj : o))); }} onBlur={() => onCommit(ensureCtx(ctxKey).objs)} data-testid="cw-text-input" />}
                  <FontPicker value={String(sv("font"))} onChange={(f) => setS({ font: f })} customFonts={customFonts} isFontLoading={isFontLoading} fontError={fontError} onUpload={addCustomFont} onRemoveCustomFont={(id) => removeCustomFont(id, (fb) => setS({ font: fb }))} label={tr("Font")} />
                  <div><div className="flex justify-between mb-1.5"><Label>{tr("Ukuran")}</Label><span className="text-sm font-bold text-indigo-600">{tr("{0}px", Math.round(Number(sv("size"))))}</span></div><GamatoSlider min={10} max={200} step={1} value={Number(sv("size"))} onChange={(v) => setS({ size: v })} aria-label={tr("Ukuran teks")} /></div>
                  <GamatoCheckbox checked={Boolean(sv("bold"))} onChange={(v) => setS({ bold: v })} label={<span className="text-sm text-slate-600 dark:text-slate-300">{tr("Tebal (bold)")}</span>} />
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <GamatoColorPicker label={tr("Latar teks")} value={String(sv("bg"))} onChange={(v) => setS({ bg: v, bgOpacity: Number(sv("bgOpacity")) || 0.9 })} testId="cw-text-bg" />
                    <div><Label>{tr("Kepekatan latar")}</Label><GamatoSlider min={0} max={1} step={0.05} value={Number(sv("bgOpacity"))} onChange={(v) => setS({ bgOpacity: v })} aria-label={tr("Latar teks")} /></div>
                  </div>
                </>
              )}
              {activeTool === "step" && <div><div className="flex justify-between mb-1.5"><Label>{tr("Ukuran badge")}</Label><span className="text-sm font-bold text-indigo-600">{tr("{0}px", Math.round(Number(sv("size"))))}</span></div><GamatoSlider min={20} max={160} step={1} value={Number(sv("size"))} onChange={(v) => setS({ size: v })} aria-label={tr("Ukuran badge")} /></div>}
              {activeTool === "blur" && (
                <>
                  <Select label={tr("Jenis sensor")} value={String(sv("blurMode"))} onChange={(e) => setS({ blurMode: e.target.value as "blur" | "pixel" })}><option value="pixel">{tr("Pixelate (mosaik)")}</option><option value="blur">{tr("Blur halus")}</option></Select>
                  <div><div className="flex justify-between mb-1.5"><Label>{tr("Intensitas")}</Label><span className="text-sm font-bold text-indigo-600">{Math.round(Number(sv("blurAmount")))}</span></div><GamatoSlider min={4} max={60} step={1} value={Number(sv("blurAmount"))} onChange={(v) => setS({ blurAmount: v })} aria-label="Intensitas" /></div>
                </>
              )}
              {tool === "select" && !selected && <p className="text-xs text-slate-400">{tr("Klik objek di panggung untuk memilih, geser untuk memindah, tarik titik putih untuk ubah ukuran. Delete = hapus, panah = geser halus.")}</p>}
              {selected && (
                <div className="flex gap-2">
                  <Btn variant="danger" className="flex-1" onClick={() => { onCommit(ensureCtx(ctxKey).objs.filter((o) => o.id !== selected.id)); setSelectedId(null); }} data-testid="cw-delete-selected"><Trash2 className="w-4 h-4" />{tr("Hapus")}</Btn>
                  <Btn variant="secondary" onClick={() => {
                    const c = ensureCtx(ctxKey);
                    const copy = transformObjs([selected], 1, 24, 24)[0];
                    copy.id = annId();
                    if (copy.type === "image") copy.bitmap = (selected as any).bitmap;
                    onCommit([...c.objs, copy]);
                    setSelectedId(copy.id);
                  }}>{tr("Duplikat")}</Btn>
                </div>
              )}
              {!activeItem && source === "screen" && (
                <GamatoCheckbox checked={clearAfter} onChange={setClearAfter} testId="cw-clear-after" label={<span className="text-sm text-slate-600 dark:text-slate-300">{tr("Kosongkan anotasi live setelah menangkap")}</span>} />
              )}
              {!activeItem && source === "html" && (
                <GamatoCheckbox checked={clearAfter} onChange={setClearAfter} label={<span className="text-sm text-slate-600 dark:text-slate-300">{tr("Kosongkan anotasi live setelah menangkap")}</span>} />
              )}
            </div>
          )}

          {/* Tumpukan */}
          <div className={card} data-testid="cw-stack">
            <div className="flex items-center justify-between">
              <p className={cap}><Layers className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />{tr("Tumpukan ({0})", stack.length)}</p>
              {stack.length > 0 && <button type="button" onClick={() => { setStack([]); store.current.clear(); setActiveId(null); setSelectedId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700" data-testid="cw-stack-clear">{tr("Kosongkan")}</button>}
            </div>
            {stack.length === 0 ? (
              <p className="text-xs text-slate-400">{tr("Belum ada tangkapan. Hasil capture menumpuk di sini; unduh sekaligus (ZIP otomatis bila lebih dari 1) atau ekspor PDF.")}</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {stack.map((it, i) => (
                  <div key={it.id} data-testid="cw-stack-item" className={cn("flex gap-3 items-center rounded-xl border p-2 transition-all", activeId === it.id ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700")}>
                    <button type="button" onClick={() => { setActiveId(it.id); setSelectedId(null); setTool("select"); }} className="shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-white" style={{ width: 84, height: 62 }} title={tr("Edit / beri anotasi")} data-testid="cw-stack-edit">
                      <img src={it.thumb} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{i + 1}. {it.name}</p>
                      <p className="text-[11px] text-slate-400">{tr("{0}×{1}px · {2} anotasi", it.base.width, it.base.height, it.objects.length)}</p>
                    </div>
                    <div className="flex flex-col">
                      <button type="button" disabled={i === 0} onClick={() => moveItem(i, -1)} className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20" aria-label={tr("Naik")}><ChevronLeft className="w-4 h-4 rotate-90" /></button>
                      <button type="button" disabled={i === stack.length - 1} onClick={() => moveItem(i, 1)} className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20" aria-label={tr("Turun")}><ChevronRight className="w-4 h-4 rotate-90" /></button>
                    </div>
                    <button type="button" onClick={() => removeItem(it.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg" aria-label={tr("Hapus")} data-testid="cw-stack-delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ekspor */}
          <div className={card} data-testid="cw-export">
            <p className={cap}>{tr("Ekspor")}</p>
            <Input label={tr("Nama berkas")} value={baseName} onChange={(e) => setBaseName(e.target.value)} data-testid="cw-basename" />
            <div className="grid grid-cols-2 gap-3">
              <Select label={tr("Format gambar")} value={fmt} onChange={(e) => setFmt(e.target.value as ImgFormat)} data-testid="cw-fmt"><option value="png">{tr("PNG (lossless)")}</option><option value="jpeg">{tr("JPEG")}</option><option value="webp">{tr("WEBP")}</option></Select>
              {fmt !== "png" && <div><div className="flex justify-between mb-1.5"><Label>{tr("Kualitas")}</Label><span className="text-sm font-bold text-indigo-600">{q}%</span></div><GamatoSlider min={40} max={100} step={1} value={q} onChange={setQ} aria-label="Kualitas" /></div>}
            </div>
            <Btn onClick={doExport} disabled={!stack.length || !!busy} className="w-full" data-testid="cw-download">
              {busy === "Menyusun gambar…" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {stack.length > 1 ? tr("Unduh ZIP ({0} gambar)", stack.length) : stack.length === 1 ? tr("Unduh Gambar") : tr("Unduh")}
            </Btn>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200"><FileText className="w-4 h-4 inline mr-1.5 -mt-0.5" />{tr("Ekspor PDF")}</p>
              <div className="grid grid-cols-2 gap-3">
                <Select label={tr("Ukuran halaman")} value={pdfSize} onChange={(e) => setPdfSize(e.target.value as PageSize)} data-testid="cw-pdf-size"><option value="a4">{tr("A4")}</option><option value="letter">{tr("Letter")}</option><option value="legal">{tr("Legal")}</option><option value="auto">{tr("Ikuti ukuran gambar")}</option></Select>
                <Select label={tr("Orientasi")} value={pdfOrient} onChange={(e) => setPdfOrient(e.target.value as any)} disabled={pdfSize === "auto"} data-testid="cw-pdf-orient"><option value="portrait">{tr("Potret")}</option><option value="landscape">{tr("Lanskap")}</option><option value="auto">{tr("Otomatis per gambar")}</option></Select>
              </div>
              <div><div className="flex justify-between mb-1.5"><Label>{tr("Margin")}</Label><span className="text-sm font-bold text-indigo-600">{tr("{0} mm", pdfMargin)}</span></div><GamatoSlider min={0} max={30} step={1} value={pdfMargin} onChange={setPdfMargin} aria-label={tr("Margin")} /></div>
              {pdfSize !== "auto" && <GamatoCheckbox checked={pdfNum} onChange={setPdfNum} label={<span className="text-sm text-slate-600 dark:text-slate-300">{tr("Nomor halaman")}</span>} />}
              {pdfSize !== "auto" && <GamatoCheckbox checked={pdfNew} onChange={setPdfNew} label={<span className="text-sm text-slate-600 dark:text-slate-300">{tr("Tiap tangkapan mulai di halaman baru")}</span>} />}
              <GamatoCheckbox checked={pdfLossless} onChange={setPdfLossless} label={<span className="text-sm text-slate-600 dark:text-slate-300">{tr("Tanpa kehilangan kualitas (PNG, berkas lebih besar)")}</span>} />
              {!pdfLossless && <div><div className="flex justify-between mb-1.5"><Label>{tr("Kualitas JPEG")}</Label><span className="text-sm font-bold text-indigo-600">{pdfQ}%</span></div><GamatoSlider min={50} max={100} step={1} value={pdfQ} onChange={setPdfQ} aria-label={tr("Kualitas PDF")} /></div>}
              <Btn variant="secondary" onClick={doPdf} disabled={!stack.length || !!busy} className="w-full" data-testid="cw-pdf">{busy === "Menyusun PDF…" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}{tr("Ekspor PDF")}</Btn>
              <p className="text-[11px] text-slate-400">{tr("Gambar panjang dipotong otomatis per halaman, mencari celah polos agar teks tidak terpotong.")}</p>
            </div>
            {lastExport && <p className="text-xs text-green-600 dark:text-green-400" data-testid="cw-last-export">{tr("Terakhir: {0}", lastExport)}</p>}
          </div>

          <ToolInfoPanel
            icon={<Camera className="w-5 h-5" />}
            label={tr("Capture Website")}
            desc={tr("Screenshot panjang + anotasi")}
            points={[
              tr("Layar/Tab: bagikan tab situs apa pun, anotasi langsung di pratinjau, tangkap satu layar atau tangkap panjang sambil scroll (dijahit otomatis)."),
              tr("HTML/Kode: tangkap halaman penuh instan pada lebar perangkat pilihan (desktop/tablet/ponsel)."),
              tr("Anotasi lengkap: pena, stabilo, garis, panah, kotak, elips, teks, nomor langkah, sensor blur/pixel, gambar."),
              tr("Hasil menumpuk dulu: 1 gambar = berkas biasa, lebih dari 1 = ZIP otomatis. Ekspor PDF dengan halaman rapi."),
              tr("Semua diproses di perangkatmu — tidak ada yang diunggah."),
            ]}
          />
        </div>
      </div>
    </div>
  );
};
