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

type Source = "screen" | "html" | "image";
type Alert = { msg: string; tone: "success" | "error" | "warning" | "info" } | null;

const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";
const cap = "text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500";

const TOOLS: { id: ToolId; label: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Pilih / geser", icon: <MousePointer2 className="w-4 h-4" /> },
  { id: "pen", label: "Pena (corat-coret)", icon: <Pencil className="w-4 h-4" /> },
  { id: "marker", label: "Stabilo", icon: <Highlighter className="w-4 h-4" /> },
  { id: "line", label: "Garis", icon: <Minus className="w-4 h-4" /> },
  { id: "arrow", label: "Panah", icon: <ArrowUpRight className="w-4 h-4" /> },
  { id: "rect", label: "Kotak", icon: <Square className="w-4 h-4" /> },
  { id: "ellipse", label: "Elips", icon: <Circle className="w-4 h-4" /> },
  { id: "text", label: "Teks", icon: <Type className="w-4 h-4" /> },
  { id: "step", label: "Nomor langkah", icon: <ListOrdered className="w-4 h-4" /> },
  { id: "blur", label: "Sensor (blur/pixel)", icon: <EyeOff className="w-4 h-4" /> },
  { id: "eraser", label: "Penghapus objek", icon: <Eraser className="w-4 h-4" /> },
];

const DEVICES = [
  { id: "desktop", label: "Desktop 1440", w: 1440 },
  { id: "laptop", label: "Laptop 1280", w: 1280 },
  { id: "tablet", label: "Tablet 820", w: 820 },
  { id: "mobile", label: "Ponsel 390", w: 390 },
  { id: "custom", label: "Kustom…", w: 0 },
];

const SAMPLE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Contoh</title>
<style>
body{margin:0;font-family:Arial,sans-serif;color:#0f172a;background:#f8fafc}
header{background:linear-gradient(135deg,#4f46e5,#9333ea);color:#fff;padding:48px 32px}
header h1{margin:0 0 8px;font-size:40px}
section{padding:32px;max-width:1000px;margin:0 auto}
.card{background:#fff;border-radius:16px;padding:24px;margin:16px 0;box-shadow:0 4px 18px rgba(15,23,42,.08)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
footer{background:#0f172a;color:#cbd5e1;text-align:center;padding:40px}
</style></head><body>
<header><h1>Halaman Contoh Panjang</h1><p>Dipakai untuk mencoba tangkapan halaman penuh.</p></header>
<section><div class="grid"><div class="card"><h3>Fitur 1</h3><p>Teks deskripsi singkat untuk kartu pertama.</p></div><div class="card"><h3>Fitur 2</h3><p>Teks deskripsi singkat untuk kartu kedua.</p></div><div class="card"><h3>Fitur 3</h3><p>Teks deskripsi singkat untuk kartu ketiga.</p></div></div>
<div class="card" style="height:420px"><h2>Bagian Tengah</h2><p>Area tinggi agar halaman cukup panjang.</p></div>
<div class="card" style="height:420px;background:#e0e7ff"><h2>Bagian Lain</h2><p>Satu lagi blok tinggi.</p></div></section>
<footer>© Gamato Piranti — contoh footer</footer></body></html>`;

// ── riwayat objek per konteks (live layar, live HTML, tiap item) ─────────
interface Ctx { objs: AnnObj[]; base: AnnObj[]; past: AnnObj[][]; future: AnnObj[][] }

const MAX_LONG_H = 30000;

function loadBitmap(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Gambar tidak bisa dibaca."));
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
    const item: CaptureItem = { id: annId(), name: name || `Tangkapan ${stackRef.current.length + 1}`, base, objects, source: src, createdAt: Date.now() };
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
    if (!imgs.length) { setAlert({ msg: "Pilih berkas gambar (PNG, JPG, WEBP…).", tone: "warning" }); return; }
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
    if (n) setAlert({ msg: `${n} gambar ditambahkan ke tumpukan.`, tone: "success" });
    else setAlert({ msg: "Gambar tidak bisa dibaca.", tone: "error" });
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
    streamRef.current?.getTracks().forEach((t) => t.stop());
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
      setAlert({ msg: "Browser ini tidak mendukung tangkap layar (getDisplayMedia). Gunakan Chrome/Edge/Firefox desktop terbaru — atau pakai mode HTML / Impor Gambar.", tone: "error" });
      return;
    }
    try {
      stopShare();
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: false });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play().catch(() => {});
      stream.getVideoTracks()[0].addEventListener("ended", () => stopShare());
      const upd = () => { if (v.videoWidth) setVdim({ w: v.videoWidth, h: v.videoHeight }); };
      v.onloadedmetadata = upd;
      v.onresize = upd;
      upd();
      setSharing(true);
      setAlert({ msg: "Layar dibagikan. Atur jendela/tab yang ingin ditangkap, beri anotasi bila perlu, lalu klik “Ambil Tangkapan”.", tone: "info" });
    } catch (e: any) {
      const n = e?.name;
      setAlert({
        msg: n === "NotAllowedError" ? "Izin tangkap layar ditolak atau dibatalkan." : n === "NotFoundError" ? "Tidak ada layar/tab yang bisa ditangkap." : n === "NotReadableError" ? "Layar/tab tidak bisa dibaca (diblokir sistem atau browser)." : `Gagal memulai tangkap layar${e?.message ? `: ${e.message}` : "."}`,
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
    if (!f) { setAlert({ msg: "Belum ada gambar dari layar yang dibagikan.", tone: "warning" }); return; }
    const live = ensureCtx("live-screen").objs;
    const cr = cropRef.current;
    const moved = transformObjs(cloneObjs(live), 1, cr ? -cr.x : 0, cr ? -cr.y : 0);
    const id = addItem(f, "frame", moved);
    store.current.delete(`item:${id}`);
    if (clearAfter) { const c = ensureCtx("live-screen"); c.objs = []; c.base = []; c.past = []; c.future = []; setSelectedId(null); }
    setAlert({ msg: `Tangkapan ${stackRef.current.length + 1} ditambahkan (${f.width}×${f.height}).`, tone: "success" });
    force();
  };

  const startLong = () => {
    const f0 = grabFrame();
    if (!f0) { setAlert({ msg: "Bagikan layar/tab dulu.", tone: "warning" }); return; }
    const st = new LongStitcher({ fixedTop, fixedBottom, maxHeight: MAX_LONG_H });
    stitcherRef.current = st;
    st.addFrame(f0);
    setLongRun({ height: st.height, frames: 1, lost: 0, note: "Mulai scroll halaman di tab yang dibagikan — pelan & stabil." });
    longTimer.current = window.setInterval(() => {
      if (longBusy.current || !stitcherRef.current) return;
      const f = grabFrame();
      if (!f) return;
      longBusy.current = true;
      try {
        const s: StitchStatus = stitcherRef.current.addFrame(f);
        const note =
          s.kind === "lost" ? (s.reason === "fast" ? "Scroll terlalu cepat — overlap hilang. Scroll lebih pelan." : s.reason === "flat" ? "Area polos terdeteksi — lanjutkan scroll ke area bertekstur." : "Posisi tidak cocok — scroll kembali pelan-pelan.")
          : s.kind === "full" ? `Batas tinggi ${MAX_LONG_H}px tercapai — klik Selesai.`
          : s.kind === "appended" ? "Menjahit…" : "Tunggu / lanjut scroll…";
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
    if (out.height < 8) { setAlert({ msg: "Tidak ada hasil.", tone: "warning" }); return; }
    addItem(out, "long", [], `Panjang ${stackRef.current.length + 1}`);
    setAlert({ msg: `Tangkapan panjang disimpan (${out.width}×${out.height}px).`, tone: "success" });
  };

  const openUrl = () => {
    const u = sanitizeUrl(urlInput);
    if (!u) { setAlert({ msg: "URL tidak valid — gunakan alamat lengkap diawali https://", tone: "warning" }); return; }
    window.open(u, "_blank", "noopener,noreferrer");
    setAlert({ msg: "Situs dibuka di tab baru. Kembali ke sini → “Bagikan Layar/Tab” → pilih tab situs itu.", tone: "info" });
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
    if (!f) { setAlert({ msg: "Pilih berkas .html / .htm.", tone: "warning" }); return; }
    setHtml(await f.text());
    setHtmlFile(f.name);
    setAlert({ msg: `${f.name} dimuat.`, tone: "success" });
  };

  const captureFromHtml = async () => {
    if (!html.trim()) { setAlert({ msg: "Isi kode HTML dulu (atau klik “Contoh”).", tone: "warning" }); return; }
    setBusy("Merender halaman penuh…");
    setAlert(null);
    try {
      const res = await captureHtml(html, { width: devW, scale, bg: htmlBg, segmentHeight: segH });
      const live = ensureCtx("live-html").objs;
      let y = 0;
      const per = res.canvases.length;
      res.canvases.forEach((cv, i) => {
        const segCss = cv.height / scale;
        const objsForSeg = transformObjs(cloneObjs(live), scale, 0, -y);
        const id = addItem(cv, "html", objsForSeg, per > 1 ? `Halaman bagian ${i + 1}` : htmlFile ? htmlFile.replace(/\.[^.]+$/, "") : undefined);
        store.current.delete(`item:${id}`);
        y += segCss;
      });
      if (clearAfter) { const c = ensureCtx("live-html"); c.objs = []; c.base = []; c.past = []; c.future = []; setSelectedId(null); }
      const w = res.canvases[0].width;
      setAlert({ msg: `Halaman ${devW}px × ${res.pageHeight}px ditangkap (${w}px lebar, ${per} gambar). ${res.notes.join(" ")}`, tone: res.notes.length ? "warning" : "success" });
    } catch (e: any) {
      setAlert({ msg: e?.message || "Gagal menangkap HTML.", tone: "error" });
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
    } catch (e: any) { setAlert({ msg: e?.message || "Gambar gagal ditambahkan.", tone: "error" }); }
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
      setAlert({ msg: r.kind === "zip" ? `ZIP berisi ${stack.length} gambar diunduh.` : "Gambar diunduh.", tone: "success" });
    } catch (e: any) { setAlert({ msg: e?.message || "Ekspor gagal.", tone: "error" }); }
    finally { setBusy(null); }
  };
  const doPdf = async () => {
    if (!stack.length) return;
    setBusy("Menyusun PDF…");
    try {
      const r = await exportPdf(stack, { pageSize: pdfSize, orientation: pdfOrient, marginMm: pdfMargin, numbering: pdfNum, newPagePerCapture: pdfNew, jpegQuality: pdfQ / 100, lossless: pdfLossless, title: baseName });
      downloadBlob(r.blob, `${baseName.replace(/[\\/:*?"<>|]+/g, "_") || "capture"}.pdf`);
      setLastExport(`PDF ${r.pages} halaman (${(r.blob.size / 1024 / 1024).toFixed(2)} MB)`);
      setAlert({ msg: `PDF ${r.pages} halaman diunduh.`, tone: "success" });
    } catch (e: any) { setAlert({ msg: e?.message || "Ekspor PDF gagal.", tone: "error" }); }
    finally { setBusy(null); }
  };

  // ── render ──
  const stageBase: CanvasImageSource | null = activeItem ? activeItem.base : source === "screen" ? videoRef.current : null;
  const isLiveBase = !activeItem && source === "screen" && sharing;
  const showStage = !!activeItem || source === "screen" || source === "html";
  const stageInteractive = activeItem ? true : source === "html" ? interactive : sharing && !cropMode;

  const colorRow = (
    <div className="grid grid-cols-2 gap-3">
      <GamatoColorPicker label="Warna" value={String(sv("color"))} onChange={(v) => setS({ color: v })} testId="cw-color" />
      {["rect", "ellipse"].includes(selected?.type ?? tool) && <GamatoColorPicker label="Isi" value={String(sv("fill"))} onChange={(v) => setS({ fill: v, fillOpacity: Number(sv("fillOpacity")) || 0.35 })} testId="cw-fill" />}
    </div>
  );

  const activeTool: ToolId | "selected" = selected && tool === "select" ? (selected.type as ToolId) : tool;
  const needsWidth = ["pen", "marker", "line", "arrow", "rect", "ellipse"].includes(activeTool);

  return (
    <div className="space-y-5">
      {/* Sumber */}
      <div className="grid grid-cols-3 gap-2" role="tablist">
        {([["screen", "Layar / Tab", <Monitor key="a" className="w-4 h-4" />, "Website apa pun"], ["html", "HTML / Kode", <Code2 key="b" className="w-4 h-4" />, "Halaman penuh instan"], ["image", "Impor Gambar", <Upload key="c" className="w-4 h-4" />, "Anotasi screenshot"]] as const).map(([id, label, icon, sub]) => (
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
              <span className="text-sm text-indigo-800 dark:text-indigo-200 flex-1 truncate">Mengedit: <b>{activeItem.name}</b> · {activeItem.base.width}×{activeItem.base.height}px</span>
              <Btn variant="secondary" className="!py-1.5" onClick={() => { setActiveId(null); setSelectedId(null); }} data-testid="cw-back-live"><ChevronLeft className="w-4 h-4" />Kembali</Btn>
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
              <button type="button" title="Urungkan (Ctrl+Z)" aria-label="Urungkan" data-testid="cw-undo" onClick={undo} disabled={!cur.past.length} className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><Undo2 className="w-4 h-4" /></button>
              <button type="button" title="Ulangi (Ctrl+Y)" aria-label="Ulangi" data-testid="cw-redo" onClick={redo} disabled={!cur.future.length} className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><Redo2 className="w-4 h-4" /></button>
              <button type="button" title="Hapus semua anotasi" aria-label="Hapus semua anotasi" data-testid="cw-clear" onClick={() => { if (objs.length) { onCommit([]); setSelectedId(null); } }} disabled={!objs.length} className="p-2.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
              <label title="Tambah gambar ke atas halaman" className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" data-testid="cw-add-image-label">
                <ImagePlus className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" data-testid="cw-add-image" onChange={(e) => { addImageObject(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <span className="flex-1" />
              {!activeItem && source === "html" && (
                <button type="button" onClick={() => setInteractive((v) => !v)} data-testid="cw-browse-toggle" title="Mode jelajah: teruskan klik ke halaman" className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold", interactive ? "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" : "bg-amber-100 text-amber-800")}>
                  <Hand className="w-4 h-4" />{interactive ? "Anotasi aktif" : "Mode jelajah"}
                </button>
              )}
              <div className="flex items-center gap-2 w-32 pr-1">
                <span className="text-[10px] text-slate-400">Zoom</span>
                <GamatoSlider min={0.25} max={2} step={0.05} value={zoom} onChange={setZoom} aria-label="Zoom" />
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
                    <p className="text-slate-300 text-sm text-center px-6">Belum ada layar yang dibagikan.<br />Klik “Bagikan Layar/Tab” di bawah.</p>
                  </div>
                )}
              </AnnotationStage>
            </div>
          ) : source === "html" ? (
            <AnnotationStage testId="cw-stage" contentW={devW} contentH={pageH} objects={stageObjs} onPreview={onPreview} onCommit={onCommit} base={null} tool={tool} style={style} interactive={interactive} selectedId={selectedId} onSelect={setSelectedId} zoom={zoom}>
              {(k) => (
                <div style={{ width: devW, height: pageH, transform: `scale(${k})`, transformOrigin: "0 0", background: htmlBg }}>
                  <iframe key={previewKey} ref={iframeRef} title="Pratinjau HTML" data-testid="cw-iframe" sandbox="allow-same-origin" srcDoc={html || "<body style='font-family:sans-serif;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>Tempel HTML atau klik “Contoh”</body>"} onLoad={onIframeLoad}
                    style={{ width: devW, height: pageH, border: 0, display: "block", maxWidth: "none", background: "#fff" }} />
                </div>
              )}
            </AnnotationStage>
          ) : (
            <Dropzone onFiles={importImages} multiple accept="image/*" label="Drop screenshot / gambar di sini" sublabel="atau tempel dengan Ctrl+V — langsung masuk tumpukan untuk dianotasi & diekspor" icon={<ClipboardPaste className="w-8 h-8" />} />
          )}

          {/* Kontrol sumber */}
          {!activeItem && source === "screen" && (
            <div className={card} data-testid="cw-screen-controls">
              <div className="flex flex-wrap gap-2">
                {!sharing ? (
                  <Btn onClick={startShare} data-testid="cw-share"><Monitor className="w-4 h-4" />Bagikan Layar / Tab</Btn>
                ) : (
                  <>
                    <Btn onClick={captureFrame} disabled={!!longRun} data-testid="cw-capture"><Camera className="w-4 h-4" />Ambil Tangkapan</Btn>
                    {!longRun ? (
                      <Btn variant="secondary" onClick={startLong} data-testid="cw-long-start"><Play className="w-4 h-4" />Tangkap Panjang (scroll)</Btn>
                    ) : (
                      <>
                        <Btn onClick={() => finishLong(true)} data-testid="cw-long-finish"><StopSquare className="w-4 h-4" />Selesai & Simpan</Btn>
                        <Btn variant="danger" onClick={() => finishLong(false)} data-testid="cw-long-cancel"><X className="w-4 h-4" />Batal</Btn>
                      </>
                    )}
                    <Btn variant="secondary" disabled={!!longRun} onClick={() => { if (crop) setCrop(null); else setCropMode(true); }} data-testid="cw-crop-btn"><Crop className="w-4 h-4" />{crop ? "Hapus area" : cropMode ? "Seret di pratinjau…" : "Pilih area"}</Btn>
                    <Btn variant="ghost" onClick={stopShare} data-testid="cw-stop-share">Hentikan</Btn>
                  </>
                )}
              </div>
              {!sharing && (
                <div className="flex gap-2">
                  <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://situs-yang-ingin-ditangkap.com" data-testid="cw-url" />
                  <Btn variant="secondary" onClick={openUrl} className="shrink-0"><ExternalLink className="w-4 h-4" />Buka di tab baru</Btn>
                </div>
              )}
              {longRun && (
                <div className="flex gap-4 items-start rounded-xl bg-slate-50 dark:bg-slate-800 p-3" data-testid="cw-long-status">
                  <canvas ref={miniRef} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white" style={{ width: 90, height: "auto", maxHeight: 160 }} />
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p><b data-testid="cw-long-height">{longRun.height}</b> px · {longRun.frames} frame · {longRun.lost} terlewat</p>
                    <p className="text-indigo-600 dark:text-indigo-300 font-semibold">{longRun.note}</p>
                    <p className="text-slate-400">Scroll pelan di tab yang dibagikan; boleh naik-turun. Klik “Selesai” bila sudah di dasar halaman.</p>
                  </div>
                </div>
              )}
              {sharing && (
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Header tetap diabaikan (px)</Label><Input type="number" min={0} max={600} value={fixedTop} disabled={!!longRun} onChange={(e) => setFixedTop(Math.max(0, Number(e.target.value) || 0))} data-testid="cw-fixed-top" /></div>
                  <div><Label>Footer tetap diabaikan (px)</Label><Input type="number" min={0} max={600} value={fixedBottom} disabled={!!longRun} onChange={(e) => setFixedBottom(Math.max(0, Number(e.target.value) || 0))} data-testid="cw-fixed-bottom" /></div>
                </div>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Frame saat ini: {vdim.w}×{vdim.h}{crop && crop.w > 0 ? ` · area ${Math.round(crop.w)}×${Math.round(crop.h)}` : ""}. Memilih jendela/layar penuh ikut menangkap bingkai browser — gunakan “Pilih area” atau bagikan <b>tab</b> agar hasil bersih.</p>
            </div>
          )}

          {!activeItem && source === "html" && (
            <div className={card} data-testid="cw-html-controls">
              <div className="flex flex-wrap gap-2 items-center">
                <Btn variant="secondary" onClick={() => { setHtml(SAMPLE_HTML); setHtmlFile(""); }} data-testid="cw-html-sample"><Globe className="w-4 h-4" />Contoh</Btn>
                <label className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 cursor-pointer">
                  <Upload className="w-4 h-4" />Buka berkas .html
                  <input type="file" accept=".html,.htm,.xhtml,text/html" className="hidden" data-testid="cw-html-file" onChange={(e) => { if (e.target.files) loadHtmlFile(Array.from(e.target.files)); e.target.value = ""; }} />
                </label>
                {html && <Btn variant="ghost" onClick={() => { setHtml(""); setHtmlFile(""); }}>Kosongkan</Btn>}
              </div>
              <Textarea label="Kode HTML" rows={8} value={html} onChange={(e) => { setHtml(e.target.value); setHtmlFile(""); }} placeholder="<!doctype html>… tempel HTML lengkap di sini" className="font-mono text-xs" data-testid="cw-html-code" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Select label="Perangkat" value={device} onChange={(e) => setDevice(e.target.value)} data-testid="cw-device">{DEVICES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</Select>
                <Input label="Lebar (px)" type="number" min={240} max={3840} value={device === "custom" ? customW : devW} disabled={device !== "custom"} onChange={(e) => setCustomW(Number(e.target.value) || 1024)} data-testid="cw-custom-w" />
                <Select label="Skala" value={String(scale)} onChange={(e) => setScale(Number(e.target.value))} data-testid="cw-scale"><option value="1">1× normal</option><option value="2">2× tajam</option><option value="3">3× sangat tajam</option></Select>
                <Select label="Potong per" value={String(segH)} onChange={(e) => setSegH(Number(e.target.value))} data-testid="cw-seg"><option value="0">Satu gambar utuh</option><option value="1000">1000 px</option><option value="2000">2000 px</option><option value="4000">4000 px</option></Select>
              </div>
              <GamatoColorPicker label="Warna latar cadangan" value={htmlBg} onChange={setHtmlBg} testId="cw-html-bg" />
              <Btn onClick={captureFromHtml} disabled={!!busy || !html.trim()} data-testid="cw-html-capture" className="w-full py-3.5">{busy && busy.startsWith("Merender") ? <><Loader2 className="w-4 h-4 animate-spin" />Merender…</> : <><Camera className="w-4 h-4" />Tangkap Halaman Penuh ({devW}×{pageH}px)</>}</Btn>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Skrip tidak dijalankan (aman). Stylesheet/gambar eksternal ikut dimuat hanya bila server mengizinkan CORS; selebihnya gunakan CSS inline atau data URL.</p>
            </div>
          )}

          {source === "image" && !activeItem && stack.length > 0 && (
            <p className="text-xs text-slate-400">Klik gambar di tumpukan (kanan) untuk memberi anotasi.</p>
          )}
        </div>

        {/* KANAN */}
        <div className="space-y-4 min-w-0">
          {/* Gaya alat */}
          {showStage && (
            <div className={card} data-testid="cw-style-panel">
              <p className={cap}>{selected ? "Objek Terpilih" : "Gaya Alat"}</p>
              {activeTool !== "select" && activeTool !== "eraser" && colorRow}
              {needsWidth && <div data-testid="cw-width"><div className="flex justify-between mb-1.5"><Label>Tebal</Label><span className="text-sm font-bold text-indigo-600">{Math.round(Number(sv("width")))}px</span></div><GamatoSlider min={1} max={60} step={1} value={Number(sv("width"))} onChange={(v) => setS({ width: v })} aria-label="Tebal" /></div>}
              {activeTool !== "select" && activeTool !== "eraser" && activeTool !== "blur" && activeTool !== "step" && <div><div className="flex justify-between mb-1.5"><Label>Kepekatan</Label><span className="text-sm font-bold text-indigo-600">{Math.round(Number(sv("opacity")) * 100)}%</span></div><GamatoSlider min={0.1} max={1} step={0.05} value={Number(sv("opacity"))} onChange={(v) => setS({ opacity: v })} aria-label="Kepekatan" /></div>}
              {["rect", "ellipse"].includes(activeTool) && (
                <>
                  <div><div className="flex justify-between mb-1.5"><Label>Isi (kepekatan)</Label><span className="text-sm font-bold text-indigo-600">{Math.round(Number(sv("fillOpacity")) * 100)}%</span></div><GamatoSlider min={0} max={1} step={0.05} value={Number(sv("fillOpacity"))} onChange={(v) => setS({ fillOpacity: v })} aria-label="Isi" /></div>
                  {activeTool === "rect" && <div><div className="flex justify-between mb-1.5"><Label>Sudut membulat</Label><span className="text-sm font-bold text-indigo-600">{Math.round(Number(sv("radius")))}px</span></div><GamatoSlider min={0} max={80} step={1} value={Number(sv("radius"))} onChange={(v) => setS({ radius: v })} aria-label="Sudut" /></div>}
                </>
              )}
              {activeTool === "text" && (
                <>
                  {selected?.type === "text" && <Textarea label="Isi teks" rows={3} value={selected.text} onChange={(e) => { const c = ensureCtx(ctxKey); onPreview(c.objs.map((o) => (o.id === selected.id ? { ...o, text: e.target.value } as AnnObj : o))); }} onBlur={() => onCommit(ensureCtx(ctxKey).objs)} data-testid="cw-text-input" />}
                  <FontPicker value={String(sv("font"))} onChange={(f) => setS({ font: f })} customFonts={customFonts} isFontLoading={isFontLoading} fontError={fontError} onUpload={addCustomFont} onRemoveCustomFont={(id) => removeCustomFont(id, (fb) => setS({ font: fb }))} label="Font" />
                  <div><div className="flex justify-between mb-1.5"><Label>Ukuran</Label><span className="text-sm font-bold text-indigo-600">{Math.round(Number(sv("size")))}px</span></div><GamatoSlider min={10} max={200} step={1} value={Number(sv("size"))} onChange={(v) => setS({ size: v })} aria-label="Ukuran teks" /></div>
                  <GamatoCheckbox checked={Boolean(sv("bold"))} onChange={(v) => setS({ bold: v })} label={<span className="text-sm text-slate-600 dark:text-slate-300">Tebal (bold)</span>} />
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <GamatoColorPicker label="Latar teks" value={String(sv("bg"))} onChange={(v) => setS({ bg: v, bgOpacity: Number(sv("bgOpacity")) || 0.9 })} testId="cw-text-bg" />
                    <div><Label>Kepekatan latar</Label><GamatoSlider min={0} max={1} step={0.05} value={Number(sv("bgOpacity"))} onChange={(v) => setS({ bgOpacity: v })} aria-label="Latar teks" /></div>
                  </div>
                </>
              )}
              {activeTool === "step" && <div><div className="flex justify-between mb-1.5"><Label>Ukuran badge</Label><span className="text-sm font-bold text-indigo-600">{Math.round(Number(sv("size")))}px</span></div><GamatoSlider min={20} max={160} step={1} value={Number(sv("size"))} onChange={(v) => setS({ size: v })} aria-label="Ukuran badge" /></div>}
              {activeTool === "blur" && (
                <>
                  <Select label="Jenis sensor" value={String(sv("blurMode"))} onChange={(e) => setS({ blurMode: e.target.value as "blur" | "pixel" })}><option value="pixel">Pixelate (mosaik)</option><option value="blur">Blur halus</option></Select>
                  <div><div className="flex justify-between mb-1.5"><Label>Intensitas</Label><span className="text-sm font-bold text-indigo-600">{Math.round(Number(sv("blurAmount")))}</span></div><GamatoSlider min={4} max={60} step={1} value={Number(sv("blurAmount"))} onChange={(v) => setS({ blurAmount: v })} aria-label="Intensitas" /></div>
                </>
              )}
              {tool === "select" && !selected && <p className="text-xs text-slate-400">Klik objek di panggung untuk memilih, geser untuk memindah, tarik titik putih untuk ubah ukuran. Delete = hapus, panah = geser halus.</p>}
              {selected && (
                <div className="flex gap-2">
                  <Btn variant="danger" className="flex-1" onClick={() => { onCommit(ensureCtx(ctxKey).objs.filter((o) => o.id !== selected.id)); setSelectedId(null); }} data-testid="cw-delete-selected"><Trash2 className="w-4 h-4" />Hapus</Btn>
                  <Btn variant="secondary" onClick={() => {
                    const c = ensureCtx(ctxKey);
                    const copy = transformObjs([selected], 1, 24, 24)[0];
                    copy.id = annId();
                    if (copy.type === "image") copy.bitmap = (selected as any).bitmap;
                    onCommit([...c.objs, copy]);
                    setSelectedId(copy.id);
                  }}>Duplikat</Btn>
                </div>
              )}
              {!activeItem && source === "screen" && (
                <GamatoCheckbox checked={clearAfter} onChange={setClearAfter} testId="cw-clear-after" label={<span className="text-sm text-slate-600 dark:text-slate-300">Kosongkan anotasi live setelah menangkap</span>} />
              )}
              {!activeItem && source === "html" && (
                <GamatoCheckbox checked={clearAfter} onChange={setClearAfter} label={<span className="text-sm text-slate-600 dark:text-slate-300">Kosongkan anotasi live setelah menangkap</span>} />
              )}
            </div>
          )}

          {/* Tumpukan */}
          <div className={card} data-testid="cw-stack">
            <div className="flex items-center justify-between">
              <p className={cap}><Layers className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />Tumpukan ({stack.length})</p>
              {stack.length > 0 && <button type="button" onClick={() => { setStack([]); store.current.clear(); setActiveId(null); setSelectedId(null); }} className="text-xs text-red-500 font-semibold hover:text-red-700" data-testid="cw-stack-clear">Kosongkan</button>}
            </div>
            {stack.length === 0 ? (
              <p className="text-xs text-slate-400">Belum ada tangkapan. Hasil capture menumpuk di sini; unduh sekaligus (ZIP otomatis bila lebih dari 1) atau ekspor PDF.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {stack.map((it, i) => (
                  <div key={it.id} data-testid="cw-stack-item" className={cn("flex gap-3 items-center rounded-xl border p-2 transition-all", activeId === it.id ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700")}>
                    <button type="button" onClick={() => { setActiveId(it.id); setSelectedId(null); setTool("select"); }} className="shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 bg-white" style={{ width: 84, height: 62 }} title="Edit / beri anotasi" data-testid="cw-stack-edit">
                      <img src={it.thumb} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{i + 1}. {it.name}</p>
                      <p className="text-[11px] text-slate-400">{it.base.width}×{it.base.height}px · {it.objects.length} anotasi</p>
                    </div>
                    <div className="flex flex-col">
                      <button type="button" disabled={i === 0} onClick={() => moveItem(i, -1)} className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20" aria-label="Naik"><ChevronLeft className="w-4 h-4 rotate-90" /></button>
                      <button type="button" disabled={i === stack.length - 1} onClick={() => moveItem(i, 1)} className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20" aria-label="Turun"><ChevronRight className="w-4 h-4 rotate-90" /></button>
                    </div>
                    <button type="button" onClick={() => removeItem(it.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg" aria-label="Hapus" data-testid="cw-stack-delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ekspor */}
          <div className={card} data-testid="cw-export">
            <p className={cap}>Ekspor</p>
            <Input label="Nama berkas" value={baseName} onChange={(e) => setBaseName(e.target.value)} data-testid="cw-basename" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Format gambar" value={fmt} onChange={(e) => setFmt(e.target.value as ImgFormat)} data-testid="cw-fmt"><option value="png">PNG (lossless)</option><option value="jpeg">JPEG</option><option value="webp">WEBP</option></Select>
              {fmt !== "png" && <div><div className="flex justify-between mb-1.5"><Label>Kualitas</Label><span className="text-sm font-bold text-indigo-600">{q}%</span></div><GamatoSlider min={40} max={100} step={1} value={q} onChange={setQ} aria-label="Kualitas" /></div>}
            </div>
            <Btn onClick={doExport} disabled={!stack.length || !!busy} className="w-full" data-testid="cw-download">
              {busy === "Menyusun gambar…" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {stack.length > 1 ? `Unduh ZIP (${stack.length} gambar)` : stack.length === 1 ? "Unduh Gambar" : "Unduh"}
            </Btn>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200"><FileText className="w-4 h-4 inline mr-1.5 -mt-0.5" />Ekspor PDF</p>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Ukuran halaman" value={pdfSize} onChange={(e) => setPdfSize(e.target.value as PageSize)} data-testid="cw-pdf-size"><option value="a4">A4</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="auto">Ikuti ukuran gambar</option></Select>
                <Select label="Orientasi" value={pdfOrient} onChange={(e) => setPdfOrient(e.target.value as any)} disabled={pdfSize === "auto"} data-testid="cw-pdf-orient"><option value="portrait">Potret</option><option value="landscape">Lanskap</option><option value="auto">Otomatis per gambar</option></Select>
              </div>
              <div><div className="flex justify-between mb-1.5"><Label>Margin</Label><span className="text-sm font-bold text-indigo-600">{pdfMargin} mm</span></div><GamatoSlider min={0} max={30} step={1} value={pdfMargin} onChange={setPdfMargin} aria-label="Margin" /></div>
              {pdfSize !== "auto" && <GamatoCheckbox checked={pdfNum} onChange={setPdfNum} label={<span className="text-sm text-slate-600 dark:text-slate-300">Nomor halaman</span>} />}
              {pdfSize !== "auto" && <GamatoCheckbox checked={pdfNew} onChange={setPdfNew} label={<span className="text-sm text-slate-600 dark:text-slate-300">Tiap tangkapan mulai di halaman baru</span>} />}
              <GamatoCheckbox checked={pdfLossless} onChange={setPdfLossless} label={<span className="text-sm text-slate-600 dark:text-slate-300">Tanpa kehilangan kualitas (PNG, berkas lebih besar)</span>} />
              {!pdfLossless && <div><div className="flex justify-between mb-1.5"><Label>Kualitas JPEG</Label><span className="text-sm font-bold text-indigo-600">{pdfQ}%</span></div><GamatoSlider min={50} max={100} step={1} value={pdfQ} onChange={setPdfQ} aria-label="Kualitas PDF" /></div>}
              <Btn variant="secondary" onClick={doPdf} disabled={!stack.length || !!busy} className="w-full" data-testid="cw-pdf">{busy === "Menyusun PDF…" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}Ekspor PDF</Btn>
              <p className="text-[11px] text-slate-400">Gambar panjang dipotong otomatis per halaman, mencari celah polos agar teks tidak terpotong.</p>
            </div>
            {lastExport && <p className="text-xs text-green-600 dark:text-green-400" data-testid="cw-last-export">Terakhir: {lastExport}</p>}
          </div>

          <ToolInfoPanel
            icon={<Camera className="w-5 h-5" />}
            label="Capture Website"
            desc="Screenshot panjang + anotasi"
            points={[
              "Layar/Tab: bagikan tab situs apa pun, anotasi langsung di pratinjau, tangkap satu layar atau tangkap panjang sambil scroll (dijahit otomatis).",
              "HTML/Kode: tangkap halaman penuh instan pada lebar perangkat pilihan (desktop/tablet/ponsel).",
              "Anotasi lengkap: pena, stabilo, garis, panah, kotak, elips, teks, nomor langkah, sensor blur/pixel, gambar.",
              "Hasil menumpuk dulu: 1 gambar = berkas biasa, lebih dari 1 = ZIP otomatis. Ekspor PDF dengan halaman rapi.",
              "Semua diproses di perangkatmu — tidak ada yang diunggah.",
            ]}
          />
        </div>
      </div>
    </div>
  );
};
