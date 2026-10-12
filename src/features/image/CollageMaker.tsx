import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutGrid, Images, Palette, Frame, Type, Download, Copy, Printer, FileText, Trash2, Plus, RotateCw, RotateCcw,
  FlipHorizontal, FlipVertical, ArrowUpToLine, ArrowDownToLine, CopyPlus, Shuffle, Eraser, Move, Repeat, Loader2, Sparkles,
  Upload, X, MousePointer2,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { Dropzone } from "@/components/ui/Dropzone";
import { Btn, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { SettingsTabBar, NextTabHint, type SettingsTabDef } from "@/components/ui/SettingsTabs";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { FontPicker } from "@/components/ui/FontPicker";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { useToast } from "@/components/ui/GamatoToast";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { printCanvasImage } from "@/lib/printCanvas";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import {
  AUTO_TEMPLATE_ID, CANVAS_PRESETS, TEMPLATES, autoGridTree, createInitialState, computeCellRects, defaultAutoCols, defaultCell,
  defaultText, ensureCollageFonts, hitCell, hitText, layoutRects, measureText, outputSize, renderCollage, supportsCtxFilter,
  templateCellCount, templateToFree, toLocal, MAX_PIXELS,
  type CellShape, type CellState, type CollageState, type PhotoRef, type Rect, type TextLayer, type LayoutNode,
} from "@/lib/collageEngine";

/* ───────────────────────────── helpers ───────────────────────────── */

type TabId = "foto" | "layout" | "gaya" | "latar" | "sel" | "teks" | "ekspor";
const TABS: SettingsTabDef<TabId>[] = [
  { id: "foto", label: "Foto", icon: <Images className="w-4 h-4" /> },
  { id: "layout", label: "Tata Letak", icon: <LayoutGrid className="w-4 h-4" /> },
  { id: "gaya", label: "Gaya", icon: <Frame className="w-4 h-4" /> },
  { id: "latar", label: "Latar", icon: <Palette className="w-4 h-4" /> },
  { id: "sel", label: "Sel Terpilih", icon: <MousePointer2 className="w-4 h-4" /> },
  { id: "teks", label: "Teks & Stiker", icon: <Type className="w-4 h-4" /> },
  { id: "ekspor", label: "Ekspor", icon: <Download className="w-4 h-4" /> },
];

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

const SHAPES: { id: CellShape; label: string }[] = [
  { id: "rect", label: "Persegi / Rounded" },
  { id: "circle", label: "Lingkaran / Oval" },
  { id: "hexagon", label: "Heksagon" },
  { id: "diamond", label: "Berlian" },
  { id: "heart", label: "Hati" },
];

const EMOJIS = ["❤️", "⭐", "✨", "🔥", "😍", "😂", "🎉", "🎂", "🌸", "🌈", "☀️", "🌙", "📸", "🎵", "👑", "💯", "🥳", "💖", "🍀", "🏆"];

const EXPORT_SIZES = [1080, 1600, 2048, 3000, 4096, 6000];

function loadPhoto(file: File): Promise<PhotoRef> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ id: uid(), name: file.name, img, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`"${file.name}" bukan gambar yang bisa dibaca browser.`));
    };
    img.src = url;
  });
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Mini SVG thumbnail of a template. */
const TemplateThumb: React.FC<{ tree: LayoutNode; active: boolean }> = ({ tree, active }) => {
  const rects = useMemo(() => layoutRects(tree, 100, 100, 5), [tree]);
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={3} className={active ? "fill-indigo-500" : "fill-slate-300 dark:fill-slate-600"} />
      ))}
    </svg>
  );
};

type Selection = { kind: "cell"; index: number } | { kind: "text"; id: string } | null;

type DragState =
  | { type: "pan"; index: number; startX: number; startY: number; panX: number; panY: number; rangeX: number; rangeY: number }
  | { type: "move"; index: number; startX: number; startY: number; cx: number; cy: number }
  | { type: "resize"; index: number; corner: [number, number]; rect: Rect; shift: boolean }
  | { type: "rotate"; index: number; cx: number; cy: number }
  | { type: "text"; id: string; startX: number; startY: number; cx: number; cy: number };

const HANDLE = 9; // css px

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void; testId?: string }> = ({ label, value, min, max, step = 1, suffix = "", onChange, testId }) => (
  <div data-testid={testId}>
    <div className="flex justify-between items-center mb-1.5">
      <Label>{label}</Label>
      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(value * 100) / 100}{suffix}</span>
    </div>
    <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
  </div>
);

/* ───────────────────────────── component ───────────────────────────── */

export const CollageMaker: React.FC = () => {
  const { showToast } = useToast();
  const history = useHistoryState<CollageState>(createInitialState);
  const state = history.state;
  const { schedule: scheduleCommit } = useDebouncedCommit(history.commit, 500);
  const fonts = useCustomFonts();

  const [photos, setPhotos] = useState<PhotoRef[]>([]);
  const photoMap = useMemo(() => new Map(photos.map((p) => [p.id, p])), [photos]);
  const [tab, setTab] = useState<TabId>("foto");
  const [sel, setSel] = useState<Selection>(null);
  const [swapSource, setSwapSource] = useState<number | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<{ msg: string; tone: "success" | "error" | "warning" } | null>(null);
  const [tplFilter, setTplFilter] = useState<number | "all">("all");

  const [expFormat, setExpFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [expSize, setExpSize] = useState(2048);
  const [expQuality, setExpQuality] = useState(92);
  const [fileName, setFileName] = useState("kolase-gamato");

  const previewRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [hostW, setHostW] = useState(600);
  const [winH, setWinH] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [renderTick, setRenderTick] = useState(0);

  const filterOk = useMemo(() => supportsCtxFilter(), []);

  /* ── state mutation helpers ── */
  const setLive = useCallback(
    (updater: (s: CollageState) => CollageState) => {
      history.set(updater, { commit: false });
      scheduleCommit();
    },
    [history, scheduleCommit]
  );
  const setNow = useCallback((updater: (s: CollageState) => CollageState) => history.set(updater), [history]);

  const patchCell = useCallback(
    (index: number, patch: Partial<CellState>, live = true) => {
      const fn = (s: CollageState): CollageState => ({ ...s, cells: s.cells.map((c, i) => (i === index ? { ...c, ...patch } : c)) });
      if (live) setLive(fn);
      else setNow(fn);
    },
    [setLive, setNow]
  );

  const patchText = useCallback(
    (id: string, patch: Partial<TextLayer>, live = true) => {
      const fn = (s: CollageState): CollageState => ({ ...s, texts: s.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
      if (live) setLive(fn);
      else setNow(fn);
    },
    [setLive, setNow]
  );

  /* ── sizing of the preview ── */
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHostW(el.clientWidth || 600));
    ro.observe(el);
    setHostW(el.clientWidth || 600);
    const onResize = () => setWinH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const aspect = useMemo(() => {
    const o = outputSize(state, 1000);
    return o.w / o.h;
  }, [state.canvasPreset, state.customW, state.customH]); // eslint-disable-line react-hooks/exhaustive-deps

  const cssW = Math.max(160, Math.min(hostW, winH * 0.72 * aspect));
  const cssH = cssW / aspect;
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  const prev = outputSize(state, Math.round(Math.max(cssW, cssH) * dpr));

  /* ── render preview ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureCollageFonts(state);
      if (cancelled) return;
      const c = previewRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      if (c.width !== prev.w || c.height !== prev.h) {
        c.width = prev.w;
        c.height = prev.h;
      }
      renderCollage(ctx, state, photoMap, prev.w, prev.h);
      setRenderTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [state, photoMap, prev.w, prev.h, fonts.customFonts]);

  /* ── overlay (selection / handles) ── */
  useEffect(() => {
    const o = overlayRef.current;
    if (!o) return;
    if (o.width !== prev.w || o.height !== prev.h) {
      o.width = prev.w;
      o.height = prev.h;
    }
    const ctx = o.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, o.width, o.height);
    const k = prev.w / cssW; // canvas px per css px
    const accent = "#6366f1";
    const rects = computeCellRects(state, prev.w, prev.h);

    const strokeRotRect = (r: Rect, dash: number[], color: string) => {
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate((r.rotate * Math.PI) / 180);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * k;
      ctx.setLineDash(dash.map((d) => d * k));
      ctx.strokeRect(-r.w / 2, -r.h / 2, r.w, r.h);
      ctx.restore();
    };

    if (swapMode && swapSource != null && rects[swapSource]) strokeRotRect(rects[swapSource], [6, 4], "#f59e0b");

    if (sel?.kind === "cell" && rects[sel.index]) {
      const r = rects[sel.index];
      strokeRotRect(r, [], accent);
      if (state.mode === "free") {
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
        ctx.rotate((r.rotate * Math.PI) / 180);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2 * k;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
          const hs = HANDLE * k;
          ctx.fillRect((sx * r.w) / 2 - hs / 2, (sy * r.h) / 2 - hs / 2, hs, hs);
          ctx.strokeRect((sx * r.w) / 2 - hs / 2, (sy * r.h) / 2 - hs / 2, hs, hs);
        }
        // rotate handle
        const ry = -r.h / 2 - 26 * k;
        ctx.beginPath();
        ctx.moveTo(0, -r.h / 2);
        ctx.lineTo(0, ry);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, ry, (HANDLE / 2 + 1) * k, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    if (sel?.kind === "text") {
      const t = state.texts.find((x) => x.id === sel.id);
      if (t) {
        const m = measureText(ctx, t, prev.w);
        strokeRotRect({ x: t.cx * prev.w - m.w / 2 - 6 * k, y: t.cy * prev.h - m.h / 2 - 4 * k, w: m.w + 12 * k, h: m.h + 8 * k, rotate: t.rotate }, [6, 4], accent);
      }
    }
  }, [state, sel, swapMode, swapSource, prev.w, prev.h, cssW, renderTick]);

  /* ── photo management ── */
  const addFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) {
      setInfo({ msg: "Tidak ada file gambar yang valid.", tone: "error" });
      return;
    }
    setBusy("Memuat foto…");
    const loaded: PhotoRef[] = [];
    const failed: string[] = [];
    for (const f of imgs) {
      try {
        loaded.push(await loadPhoto(f));
      } catch (e: any) {
        failed.push(e?.message ?? f.name);
      }
    }
    setBusy(null);
    if (failed.length) setInfo({ msg: failed.join(" "), tone: "warning" });
    if (!loaded.length) return;
    setPhotos((p) => [...p, ...loaded]);

    history.set((cur) => {
      const allEmpty = cur.cells.every((c) => !c.photoId);
      let next = cur;
      if (allEmpty && cur.mode === "template" && cur.cells.length !== loaded.length) {
        // First import: pick a template that fits the photo count so nothing is left blank.
        const exact = TEMPLATES.find((t) => t.count === loaded.length);
        next = exact
          ? applyTemplateTo(cur, exact.id, outputSize(cur, 1000))
          : applyTemplateTo({ ...cur, autoCount: Math.min(60, loaded.length), autoCols: 0 }, AUTO_TEMPLATE_ID, outputSize(cur, 1000));
      }
      const queue = [...loaded];
      let cells = next.cells.map((c) => (!c.photoId && queue.length ? { ...c, photoId: queue.shift()!.id } : c));
      let free = next.free;
      if (next.mode === "free" && queue.length) {
        queue.forEach((ph, i) => {
          const jitter = (i % 5) * 0.04;
          free = [...free, { cx: 0.35 + jitter + ((i * 0.13) % 0.3), cy: 0.35 + jitter + ((i * 0.11) % 0.3), w: 0.34, h: 0.34 * (ph.w / ph.h) * 0.85, rotate: ((i % 5) - 2) * 3 }];
          cells = [...cells, defaultCell(ph.id)];
        });
      }
      return { ...next, cells, free };
    });
    setInfo({ msg: `${loaded.length} foto ditambahkan.`, tone: "success" });
  };

  /** Apply a template, keeping existing cell contents by index. */
  function applyTemplateTo(s: CollageState, templateId: string, o: { w: number; h: number }): CollageState {
    const base: CollageState = { ...s, templateId };
    const n = templateCellCount(base);
    let cells = base.cells.slice(0, n);
    while (cells.length < n) cells.push(defaultCell());
    let next: CollageState = { ...base, cells };
    if (s.mode === "free") next = { ...next, free: templateToFree({ ...next, mode: "template" }, o.w, o.h) };
    return next;
  }

  const applyTemplate = (templateId: string) => {
    setNow((s) => applyTemplateTo(s, templateId, outputSize(s, 1000)));
    setSel(null);
    setSwapMode(false);
    setSwapSource(null);
  };

  const removePhoto = (id: string) => {
    setPhotos((ps) => {
      const p = ps.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.img.src);
      return ps.filter((x) => x.id !== id);
    });
    setNow((s) => ({
      ...s,
      cells: s.cells.map((c) => (c.photoId === id ? { ...c, photoId: null } : c)),
      bg: s.bg.imageId === id ? { ...s.bg, imageId: null, type: s.bg.type === "image" ? "solid" : s.bg.type } : s.bg,
    }));
  };

  const clearAllPhotos = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.img.src));
    setPhotos([]);
    setNow((s) => ({ ...s, cells: s.cells.map((c) => ({ ...c, photoId: null })), bg: { ...s.bg, imageId: null, type: s.bg.type === "image" ? "solid" : s.bg.type } }));
  };

  const assignPhoto = (photoId: string) => {
    if (sel?.kind === "cell") {
      patchCell(sel.index, { photoId, panX: 0, panY: 0, zoom: 1 }, false);
      return;
    }
    const empty = state.cells.findIndex((c) => !c.photoId);
    if (empty >= 0) patchCell(empty, { photoId }, false);
    else showToast("Pilih sel dulu di preview, lalu klik foto ini.", "info");
  };

  const autoFill = () => {
    if (!photos.length) return;
    setNow((s) => {
      let k = 0;
      return { ...s, cells: s.cells.map((c) => (c.photoId ? c : { ...c, photoId: photos[k++ % photos.length]?.id ?? null })) };
    });
  };

  const shuffleAssign = () => {
    setNow((s) => {
      const ids = s.cells.map((c) => c.photoId);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      return { ...s, cells: s.cells.map((c, i) => ({ ...c, photoId: ids[i], panX: 0, panY: 0 })) };
    });
  };

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    state.cells.forEach((c) => c.photoId && m.set(c.photoId, (m.get(c.photoId) ?? 0) + 1));
    return m;
  }, [state.cells]);

  /* ── mode switching ── */
  const setMode = (mode: "template" | "free") => {
    if (mode === state.mode) return;
    setNow((s) => {
      if (mode === "free") {
        const o = outputSize(s, 1000);
        return { ...s, mode, free: templateToFree(s, o.w, o.h) };
      }
      // free → template: fit cell count to template
      const n = templateCellCount(s);
      const cells = s.cells.slice(0, n);
      while (cells.length < n) cells.push(defaultCell());
      return { ...s, mode, cells, free: [] };
    });
    setSel(null);
  };

  /* ── free-mode actions ── */
  const addFreeCell = (photoId: string | null) => {
    setNow((s) => {
      const ph = photoId ? photoMap.get(photoId) : null;
      const ratio = ph ? ph.h / ph.w : 1;
      const o = outputSize(s, 1000);
      const w = 0.34;
      const h = clamp(w * ratio * (o.w / o.h), 0.12, 0.7);
      const n = s.free.length;
      return {
        ...s,
        cells: [...s.cells, defaultCell(photoId)],
        free: [...s.free, { cx: 0.5 + ((n % 4) - 1.5) * 0.06, cy: 0.5 + ((n % 3) - 1) * 0.06, w, h, rotate: ((n % 5) - 2) * 3 }],
      };
    });
    setSel({ kind: "cell", index: state.cells.length });
    setTab("sel");
  };

  const deleteCell = (index: number) => {
    if (state.mode !== "free") {
      patchCell(index, { photoId: null }, false);
      return;
    }
    setNow((s) => ({ ...s, cells: s.cells.filter((_, i) => i !== index), free: s.free.filter((_, i) => i !== index) }));
    setSel(null);
  };

  const duplicateCell = (index: number) => {
    if (state.mode !== "free") return;
    setNow((s) => ({
      ...s,
      cells: [...s.cells, { ...s.cells[index] }],
      free: [...s.free, { ...s.free[index], cx: clamp(s.free[index].cx + 0.04, 0, 1), cy: clamp(s.free[index].cy + 0.04, 0, 1) }],
    }));
    setSel({ kind: "cell", index: state.cells.length });
  };

  const reorderCell = (index: number, to: "front" | "back") => {
    if (state.mode !== "free") return;
    setNow((s) => {
      const cells = [...s.cells];
      const free = [...s.free];
      const [c] = cells.splice(index, 1);
      const [f] = free.splice(index, 1);
      if (to === "front") {
        cells.push(c);
        free.push(f);
      } else {
        cells.unshift(c);
        free.unshift(f);
      }
      return { ...s, cells, free };
    });
    setSel({ kind: "cell", index: to === "front" ? state.cells.length - 1 : 0 });
  };

  const patchFree = (index: number, patch: Partial<CollageState["free"][number]>) =>
    setLive((s) => ({ ...s, free: s.free.map((f, i) => (i === index ? { ...f, ...patch } : f)) }));

  const swapCells = (a: number, b: number) =>
    setNow((s) => {
      const cells = [...s.cells];
      [cells[a], cells[b]] = [cells[b], cells[a]];
      return { ...s, cells };
    });

  /* ── text layers ── */
  const addText = (text = "Teks Baru", size = 8) => {
    const t = { ...defaultText(uid(), text), size };
    setNow((s) => ({ ...s, texts: [...s.texts, t] }));
    setSel({ kind: "text", id: t.id });
    setTab("teks");
  };
  const deleteText = (id: string) => {
    setNow((s) => ({ ...s, texts: s.texts.filter((t) => t.id !== id) }));
    setSel(null);
  };
  const duplicateText = (id: string) => {
    const t = state.texts.find((x) => x.id === id);
    if (!t) return;
    const copy = { ...t, id: uid(), cx: clamp(t.cx + 0.03, 0, 1), cy: clamp(t.cy + 0.03, 0, 1) };
    setNow((s) => ({ ...s, texts: [...s.texts, copy] }));
    setSel({ kind: "text", id: copy.id });
  };

  /* ── pointer interaction ── */
  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const o = overlayRef.current!;
    const r = o.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * o.width) / r.width, y: ((e.clientY - r.top) * o.height) / r.height, k: o.width / r.width };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const o = overlayRef.current;
    if (!o) return;
    const { x, y, k } = toCanvas(e);
    const W = o.width;
    const H = o.height;
    const rects = computeCellRects(state, W, H);

    // 1) handles on the currently selected free cell
    if (state.mode === "free" && sel?.kind === "cell" && rects[sel.index]) {
      const r = rects[sel.index];
      const p = toLocal(r, x, y);
      const rotY = -26 * k;
      if (Math.hypot(p.x - r.w / 2, p.y - rotY) <= (HANDLE + 4) * k) {
        dragRef.current = { type: "rotate", index: sel.index, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
        o.setPointerCapture(e.pointerId);
        return;
      }
      for (const corner of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][]) {
        const hx = r.w / 2 + (corner[0] * r.w) / 2;
        const hy = r.h / 2 + (corner[1] * r.h) / 2;
        if (Math.hypot(p.x - hx, p.y - hy) <= (HANDLE + 3) * k) {
          dragRef.current = { type: "resize", index: sel.index, corner, rect: r, shift: e.shiftKey };
          o.setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // 2) text layers sit above cells
    const ctx = o.getContext("2d")!;
    const ti = hitText(ctx, state.texts, x, y, W, H);
    if (ti >= 0) {
      const t = state.texts[ti];
      setSel({ kind: "text", id: t.id });
      setTab("teks");
      dragRef.current = { type: "text", id: t.id, startX: x, startY: y, cx: t.cx, cy: t.cy };
      o.setPointerCapture(e.pointerId);
      return;
    }

    // 3) cells
    const ci = hitCell(rects, x, y);
    if (ci >= 0) {
      if (swapMode) {
        if (swapSource == null) {
          setSwapSource(ci);
          setSel({ kind: "cell", index: ci });
        } else if (swapSource !== ci) {
          swapCells(swapSource, ci);
          setSwapSource(null);
          setSwapMode(false);
          setSel({ kind: "cell", index: ci });
          showToast("Foto ditukar.", "success");
        }
        return;
      }
      setSel({ kind: "cell", index: ci });
      const cell = state.cells[ci];
      if (state.mode === "free") {
        const f = state.free[ci];
        dragRef.current = { type: "move", index: ci, startX: x, startY: y, cx: f.cx, cy: f.cy };
      } else if (cell?.photoId) {
        const ph = photoMap.get(cell.photoId);
        const r = rects[ci];
        let rangeX = 0;
        let rangeY = 0;
        if (ph) {
          const swap = cell.rot === 90 || cell.rot === 270;
          const iw = swap ? ph.h : ph.w;
          const ih = swap ? ph.w : ph.h;
          const base = cell.fit === "cover" ? Math.max(r.w / iw, r.h / ih) : Math.min(r.w / iw, r.h / ih);
          const s = base * Math.max(1, cell.zoom);
          rangeX = Math.max(0, (iw * s - r.w) / 2);
          rangeY = Math.max(0, (ih * s - r.h) / 2);
        }
        dragRef.current = { type: "pan", index: ci, startX: x, startY: y, panX: cell.panX, panY: cell.panY, rangeX, rangeY };
      }
      o.setPointerCapture(e.pointerId);
      return;
    }
    setSel(null);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    const o = overlayRef.current;
    if (!o) return;
    const { x, y } = toCanvas(e);
    const W = o.width;
    const H = o.height;
    if (!d) {
      // hover cursor
      const rects = computeCellRects(state, W, H);
      let cur = "default";
      if (hitText(o.getContext("2d")!, state.texts, x, y, W, H) >= 0) cur = "move";
      else if (hitCell(rects, x, y) >= 0) cur = swapMode ? "pointer" : state.mode === "free" ? "move" : "grab";
      o.style.cursor = cur;
      return;
    }
    if (d.type === "pan") {
      const nx = d.rangeX > 0 ? clamp(d.panX - (x - d.startX) / d.rangeX, -1, 1) : 0;
      const ny = d.rangeY > 0 ? clamp(d.panY - (y - d.startY) / d.rangeY, -1, 1) : 0;
      patchCell(d.index, { panX: nx, panY: ny });
    } else if (d.type === "move") {
      patchFree(d.index, { cx: clamp(d.cx + (x - d.startX) / W, 0, 1), cy: clamp(d.cy + (y - d.startY) / H, 0, 1) });
    } else if (d.type === "text") {
      patchText(d.id, { cx: clamp(d.cx + (x - d.startX) / W, 0, 1), cy: clamp(d.cy + (y - d.startY) / H, 0, 1) });
    } else if (d.type === "rotate") {
      let deg = (Math.atan2(x - d.cx, -(y - d.cy)) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      else if (Math.abs(((deg % 90) + 90) % 90) < 2.5 || Math.abs(((deg % 90) + 90) % 90) > 87.5) deg = Math.round(deg / 90) * 90;
      patchFree(d.index, { rotate: Math.round(deg * 10) / 10 });
    } else if (d.type === "resize") {
      const r = d.rect;
      const a = (r.rotate * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      // opposite corner in world space
      const ox = cx + ((-d.corner[0] * r.w) / 2) * cos - ((-d.corner[1] * r.h) / 2) * sin;
      const oy = cy + ((-d.corner[0] * r.w) / 2) * sin + ((-d.corner[1] * r.h) / 2) * cos;
      // pointer relative to opposite corner, in the cell's rotated frame
      const dx = x - ox;
      const dy = y - oy;
      let lw = dx * cos + dy * sin;
      let lh = -dx * sin + dy * cos;
      lw = d.corner[0] * lw;
      lh = d.corner[1] * lh;
      lw = Math.max(24, lw);
      lh = Math.max(24, lh);
      if (e.shiftKey || d.shift) {
        const ratio = r.w / r.h;
        if (lw / lh > ratio) lw = lh * ratio;
        else lh = lw / ratio;
      }
      // new centre = opposite corner + half of the new extents along the frame
      const ncx = ox + (d.corner[0] * lw * cos - d.corner[1] * lh * sin) / 2;
      const ncy = oy + (d.corner[0] * lw * sin + d.corner[1] * lh * cos) / 2;
      patchFree(d.index, { cx: ncx / W, cy: ncy / H, w: lw / W, h: lh / H });
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      history.commit();
    }
    try {
      overlayRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  // Wheel to zoom a cell's photo (native listener: must be non-passive to preventDefault)
  const wheelCtx = useRef({ state, sel, photoMap });
  wheelCtx.current = { state, sel, photoMap };
  useEffect(() => {
    const o = overlayRef.current;
    if (!o) return;
    const onWheel = (e: WheelEvent) => {
      const { state: s } = wheelCtx.current;
      const r = o.getBoundingClientRect();
      const x = ((e.clientX - r.left) * o.width) / r.width;
      const y = ((e.clientY - r.top) * o.height) / r.height;
      const idx = hitCell(computeCellRects(s, o.width, o.height), x, y);
      if (idx < 0 || !s.cells[idx]?.photoId) return;
      e.preventDefault();
      const z = clamp(s.cells[idx].zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), 1, 6);
      history.set((st) => ({ ...st, cells: st.cells.map((c, i) => (i === idx ? { ...c, zoom: Math.round(z * 100) / 100 } : c)) }), { commit: false });
      scheduleCommit();
    };
    o.addEventListener("wheel", onWheel, { passive: false });
    return () => o.removeEventListener("wheel", onWheel);
  }, [history, scheduleCommit]);

  // Drop a thumbnail onto a cell
  const onDropOverlay = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      addFiles(files);
      return;
    }
    const id = e.dataTransfer.getData("text/gp-photo-id");
    if (!id) return;
    const { x, y } = toCanvas(e);
    const idx = hitCell(computeCellRects(state, overlayRef.current!.width, overlayRef.current!.height), x, y);
    if (idx >= 0) {
      patchCell(idx, { photoId: id, panX: 0, panY: 0, zoom: 1 }, false);
      setSel({ kind: "cell", index: idx });
    }
  };

  // Delete key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!sel) return;
      e.preventDefault();
      if (sel.kind === "text") deleteText(sel.id);
      else deleteCell(sel.index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ── export ── */
  const out = useMemo(() => outputSize(state, expSize), [state.canvasPreset, state.customW, state.customH, expSize]); // eslint-disable-line react-hooks/exhaustive-deps
  const capped = outputSize(state, expSize).w * outputSize(state, expSize).h >= MAX_PIXELS - 1;

  const renderFull = async (): Promise<HTMLCanvasElement> => {
    await ensureCollageFonts(state);
    const c = document.createElement("canvas");
    c.width = out.w;
    c.height = out.h;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D tidak tersedia.");
    renderCollage(ctx, state, photoMap, out.w, out.h);
    return c;
  };

  const emptyCells = state.cells.filter((c) => !c.photoId).length;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setInfo(null);
    try {
      await new Promise((r) => setTimeout(r, 30));
      await fn();
    } catch (e: any) {
      setInfo({ msg: `Gagal: ${e?.message || "terjadi kesalahan."}`, tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const mimeOf = () => (expFormat === "png" ? "image/png" : expFormat === "jpeg" ? "image/jpeg" : "image/webp");
  const extOf = () => (expFormat === "jpeg" ? "jpg" : expFormat);
  const safeName = () => (fileName.trim().replace(/[\\/:*?"<>|]+/g, "_") || "kolase-gamato");

  const doDownload = () =>
    run("Merender kolase…", async () => {
      const c = await renderFull();
      const blob = await canvasToBlob(c, mimeOf(), expFormat === "png" ? undefined : expQuality / 100);
      if (expFormat !== "png" && blob.type !== mimeOf()) throw new Error(`Browser ini tidak mendukung ekspor ${expFormat.toUpperCase()}.`);
      downloadBlob(blob, `${safeName()}.${extOf()}`);
      setInfo({ msg: `Kolase ${c.width}×${c.height}px berhasil diunduh (${(blob.size / 1024 / 1024).toFixed(2)} MB).`, tone: "success" });
    });

  const doCopy = () =>
    run("Menyalin…", async () => {
      const c = await renderFull();
      const blob = await canvasToBlob(c, "image/png");
      const CI = (window as any).ClipboardItem;
      if (!navigator.clipboard?.write || !CI) throw new Error("Browser ini belum mendukung salin gambar ke clipboard.");
      await navigator.clipboard.write([new CI({ "image/png": blob })]);
      setInfo({ msg: "Kolase disalin ke clipboard — tinggal tempel (Ctrl+V).", tone: "success" });
    });

  const doPdf = () =>
    run("Membuat PDF…", async () => {
      const c = await renderFull();
      const jpg = await canvasToBlob(c, "image/jpeg", 0.95);
      const pdf = await PDFDocument.create();
      pdf.setTitle("Kolase — Gamato Piranti");
      const img = await pdf.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
      const long = 841.89;
      const pw = c.width >= c.height ? long : (long * c.width) / c.height;
      const ph = c.width >= c.height ? (long * c.height) / c.width : long;
      const page = pdf.addPage([pw, ph]);
      page.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
      await stampGamatoBranding(pdf);
      downloadBlob(new Blob([await pdf.save() as BlobPart], { type: "application/pdf" }), `${safeName()}.pdf`);
      setInfo({ msg: "PDF kolase berhasil dibuat.", tone: "success" });
    });

  const doPrint = () =>
    run("Menyiapkan cetak…", async () => {
      const c = await renderFull();
      printCanvasImage(c, { title: "Cetak Kolase — Gamato Piranti" });
    });

  /* ── derived ── */
  const selCell = sel?.kind === "cell" ? state.cells[sel.index] : undefined;
  const selFree = sel?.kind === "cell" && state.mode === "free" ? state.free[sel.index] : undefined;
  const selText = sel?.kind === "text" ? state.texts.find((t) => t.id === sel.id) : undefined;
  const filteredTemplates = TEMPLATES.filter((t) => tplFilter === "all" || (tplFilter === 10 ? t.count >= 10 : t.count === tplFilter));
  const autoTree = useMemo(() => autoGridTree(Math.max(1, state.autoCount), state.autoCols > 0 ? state.autoCols : defaultAutoCols(state.autoCount)), [state.autoCount, state.autoCols]);

  useEffect(() => {
    if (sel?.kind === "cell" && sel.index >= state.cells.length) setSel(null);
    if (sel?.kind === "text" && !state.texts.some((t) => t.id === sel.id)) setSel(null);
  }, [state.cells.length, state.texts, sel]);

  const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";

  /* ───────────────────────────── render ───────────────────────────── */
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start" data-testid="collage-root">
      {/* LEFT — preview */}
      <div className="space-y-3 lg:sticky lg:top-20">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={() => { history.undo(); }} onRedo={() => { history.redo(); }} />
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">{prev.w === prev.h ? "Persegi" : prev.w > prev.h ? "Lanskap" : "Potret"}</span>
            <span>·</span>
            <span data-testid="export-dims">{out.w} × {out.h}px</span>
          </div>
        </div>

        <div ref={hostRef} className="w-full flex justify-center">
          <div
            className="relative rounded-2xl overflow-hidden shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-[conic-gradient(#e2e8f0_25%,#f8fafc_0_50%,#e2e8f0_0_75%,#f8fafc_0)] [background-size:20px_20px]"
            style={{ width: cssW, height: cssH }}
          >
            <canvas ref={previewRef} data-testid="collage-canvas" style={{ width: "100%", height: "100%", display: "block" }} />
            <canvas
              ref={overlayRef}
              data-testid="collage-overlay"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropOverlay}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-center text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-2.5 py-1"><MousePointer2 className="w-3 h-3" /> Klik sel untuk memilih</span>
          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-2.5 py-1"><Move className="w-3 h-3" /> {state.mode === "free" ? "Seret untuk memindah" : "Seret untuk menggeser foto"}</span>
          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-2.5 py-1">Scroll = zoom foto</span>
          <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-full px-2.5 py-1">Delete = hapus</span>
        </div>

        {sel?.kind === "cell" && tab !== "sel" && (
          <div className="flex justify-center">
            <button type="button" data-testid="open-cell-settings" onClick={() => setTab("sel")} className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-full px-3 py-1.5">
              Sel #{sel.index + 1} terpilih — buka pengaturan sel →
            </button>
          </div>
        )}
        {busy && (
          <div className="flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-300 font-semibold" data-testid="collage-busy">
            <Loader2 className="w-4 h-4 animate-spin" /> {busy}
          </div>
        )}
        {info && <GamatoInlineAlert message={info.msg} tone={info.tone} />}
        {!filterOk && <GamatoInlineAlert tone="warning" message="Browser ini belum mendukung filter kanvas — pengaturan kecerahan/kontras/saturasi tidak akan terlihat. Gunakan Chrome / Edge / Firefox terbaru." />}
        {emptyCells > 0 && photos.length > 0 && (
          <GamatoInlineAlert tone="info" message={`${emptyCells} sel masih kosong. Klik sel lalu klik foto di tab “Foto”, atau tekan “Isi sel kosong otomatis”.`} />
        )}
      </div>

      {/* RIGHT — settings */}
      <div className="space-y-4 min-w-0">
        <SettingsTabBar tabs={TABS} active={tab} onChange={setTab} />

        {/* ───────── FOTO ───────── */}
        {tab === "foto" && (
          <div className="space-y-4">
            <Dropzone onFiles={addFiles} accept="image/*" multiple isDragging={isDragging} setIsDragging={setIsDragging} label="Tambah foto ke kolase" sublabel="JPG, PNG, WEBP, GIF — bisa banyak sekaligus" icon={<Images className="w-8 h-8" />} />
            {photos.length > 0 && (
              <div className={card}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{photos.length} foto</p>
                  <button type="button" onClick={clearAllPhotos} className="text-xs font-semibold text-red-500 hover:text-red-700" data-testid="clear-photos">Hapus semua</button>
                </div>
                <div className="grid grid-cols-4 gap-2" data-testid="photo-list">
                  {photos.map((p) => (
                    <div key={p.id} className="relative group" draggable onDragStart={(e) => e.dataTransfer.setData("text/gp-photo-id", p.id)}>
                      <button type="button" onClick={() => assignPhoto(p.id)} title={`${p.name} — klik untuk menaruh di sel terpilih`} data-testid="photo-thumb" className="block w-full aspect-square rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-colors">
                        <img src={p.img.src} alt={p.name} className="w-full h-full object-cover" draggable={false} />
                      </button>
                      {usage.get(p.id) ? <span className="absolute bottom-1 left-1 text-[10px] font-bold bg-indigo-600 text-white rounded-full px-1.5">{usage.get(p.id)}×</span> : null}
                      <button type="button" onClick={() => removePhoto(p.id)} aria-label="Hapus foto" className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center hidden group-hover:flex"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Klik foto untuk menaruhnya di sel terpilih, atau seret foto langsung ke sel di preview.</p>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="secondary" className="text-xs py-1.5" onClick={autoFill} data-testid="auto-fill"><Sparkles className="w-3.5 h-3.5" /> Isi sel kosong otomatis</Btn>
                  <Btn variant="secondary" className="text-xs py-1.5" onClick={shuffleAssign}><Shuffle className="w-3.5 h-3.5" /> Acak posisi</Btn>
                  <Btn variant="secondary" className="text-xs py-1.5" onClick={() => setNow((s) => ({ ...s, cells: s.cells.map((c) => ({ ...c, photoId: null })) }))}><Eraser className="w-3.5 h-3.5" /> Kosongkan sel</Btn>
                  {state.mode === "free" && (
                    <Btn variant="secondary" className="text-xs py-1.5" onClick={() => addFreeCell(photos[0]?.id ?? null)}><Plus className="w-3.5 h-3.5" /> Tambah bingkai</Btn>
                  )}
                </div>
              </div>
            )}
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ───────── TATA LETAK ───────── */}
        {tab === "layout" && (
          <div className="space-y-4">
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Mode</p>
              <div className="grid grid-cols-2 gap-2">
                {([["template", "Template Grid", "Rapi & otomatis"], ["free", "Bebas / Scrapbook", "Geser, ubah ukuran, putar"]] as const).map(([id, l, sub]) => (
                  <button key={id} type="button" data-testid={`mode-${id}`} onClick={() => setMode(id)} className={cn("rounded-xl border-2 p-3 text-left transition-all", state.mode === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                    <div className={cn("text-sm font-bold", state.mode === id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100")}>{l}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Ukuran Kanvas</p>
              <Select label="Rasio" value={state.canvasPreset} onChange={(e) => setNow((s) => ({ ...s, canvasPreset: e.target.value }))}>
                {CANVAS_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
              {state.canvasPreset === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Lebar (px)" type="number" min={64} value={state.customW} onChange={(e) => setLive((s) => ({ ...s, customW: clamp(parseInt(e.target.value) || 1, 1, 20000) }))} />
                  <Input label="Tinggi (px)" type="number" min={64} value={state.customH} onChange={(e) => setLive((s) => ({ ...s, customH: clamp(parseInt(e.target.value) || 1, 1, 20000) }))} />
                </div>
              )}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Ukuran piksel akhir diatur di tab Ekspor. Rasio kustom memakai perbandingan lebar : tinggi.</p>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Template ({state.cells.length} sel)</p>
                {state.mode === "free" && <span className="text-[10px] text-slate-400">Klik template = susun ulang bingkai</span>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["all", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((f) => (
                  <button key={String(f)} type="button" onClick={() => setTplFilter(f)} className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors", tplFilter === f ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>
                    {f === "all" ? "Semua" : f === 10 ? "10+" : `${f} foto`}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1" data-testid="template-grid">
                <button type="button" onClick={() => applyTemplate(AUTO_TEMPLATE_ID)} data-testid="tpl-auto" title="Grid otomatis (jumlah bebas)" className={cn("aspect-square rounded-xl border-2 p-1.5 transition-all relative", state.templateId === AUTO_TEMPLATE_ID ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                  <TemplateThumb tree={autoTree} active={state.templateId === AUTO_TEMPLATE_ID} />
                  <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-slate-500">AUTO</span>
                </button>
                {filteredTemplates.map((t) => (
                  <button key={t.id} type="button" onClick={() => applyTemplate(t.id)} data-testid={`tpl-${t.id}`} title={`${t.name} (${t.count} foto)`} className={cn("aspect-square rounded-xl border-2 p-1.5 transition-all relative", state.templateId === t.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                    <TemplateThumb tree={t.tree} active={state.templateId === t.id} />
                    <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-slate-500">{t.count}</span>
                  </button>
                ))}
              </div>
              {state.templateId === AUTO_TEMPLATE_ID && (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Slider label="Jumlah sel" value={state.autoCount} min={1} max={36} onChange={(v) => setNow((s) => applyTemplateTo({ ...s, autoCount: v }, AUTO_TEMPLATE_ID, outputSize(s, 1000)))} testId="auto-count" />
                  <Slider label="Kolom (0 = otomatis)" value={state.autoCols} min={0} max={8} onChange={(v) => setNow((s) => applyTemplateTo({ ...s, autoCols: v }, AUTO_TEMPLATE_ID, outputSize(s, 1000)))} />
                </div>
              )}
              {state.mode === "free" && (
                <Btn variant="secondary" className="w-full text-xs" onClick={() => addFreeCell(null)}><Plus className="w-3.5 h-3.5" /> Tambah bingkai kosong</Btn>
              )}
            </div>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ───────── GAYA ───────── */}
        {tab === "gaya" && (
          <div className="space-y-4">
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Bentuk & Jarak</p>
              <Select label="Bentuk sel" value={state.shape} onChange={(e) => setNow((s) => ({ ...s, shape: e.target.value as CellShape }))}>
                {SHAPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
              {state.mode === "template" && (
                <>
                  <Slider label="Jarak antar foto" value={state.gap} min={0} max={10} step={0.1} suffix="%" onChange={(v) => setLive((s) => ({ ...s, gap: v }))} testId="gap" />
                  <Slider label="Margin luar" value={state.padding} min={0} max={15} step={0.1} suffix="%" onChange={(v) => setLive((s) => ({ ...s, padding: v }))} testId="padding" />
                </>
              )}
              <Slider label="Sudut membulat" value={state.radius} min={0} max={50} suffix="%" onChange={(v) => setLive((s) => ({ ...s, radius: v }))} testId="radius" />
              {state.shape !== "rect" && <p className="text-[11px] text-slate-400">Sudut membulat hanya berlaku untuk bentuk “Persegi / Rounded”.</p>}
            </div>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Bingkai</p>
              <Slider label="Tebal bingkai" value={state.borderWidth} min={0} max={5} step={0.1} suffix="%" onChange={(v) => setLive((s) => ({ ...s, borderWidth: v }))} testId="border" />
              <div>
                <Label>Warna bingkai</Label>
                <GamatoColorPicker value={state.borderColor} onChange={(c) => setLive((s) => ({ ...s, borderColor: c }))} />
              </div>
            </div>
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Bayangan</p>
              <GamatoCheckbox checked={state.shadowOn} onChange={(v) => setNow((s) => ({ ...s, shadowOn: v }))} label="Aktifkan bayangan lembut" testId="shadow-on" />
              {state.shadowOn && (
                <>
                  <Slider label="Blur bayangan" value={state.shadowBlur} min={0.2} max={6} step={0.1} suffix="%" onChange={(v) => setLive((s) => ({ ...s, shadowBlur: v }))} />
                  <Slider label="Kepekatan" value={Math.round(state.shadowOpacity * 100)} min={5} max={90} suffix="%" onChange={(v) => setLive((s) => ({ ...s, shadowOpacity: v / 100 }))} />
                </>
              )}
            </div>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ───────── LATAR ───────── */}
        {tab === "latar" && (
          <div className="space-y-4">
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Jenis Latar</p>
              <div className="grid grid-cols-2 gap-2">
                {([["solid", "Warna solid"], ["gradient", "Gradien"], ["photo-blur", "Foto buram"], ["image", "Gambar sendiri"]] as const).map(([id, l]) => (
                  <button key={id} type="button" data-testid={`bg-${id}`} onClick={() => setNow((s) => ({ ...s, bg: { ...s.bg, type: id } }))} className={cn("rounded-xl border-2 py-2.5 text-sm font-semibold transition-all", state.bg.type === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>{l}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{state.bg.type === "gradient" ? "Warna awal" : "Warna"}</Label>
                  <GamatoColorPicker value={state.bg.color} onChange={(c) => setLive((s) => ({ ...s, bg: { ...s.bg, color: c } }))} testId="bg-color" />
                </div>
                {state.bg.type === "gradient" && (
                  <div>
                    <Label>Warna akhir</Label>
                    <GamatoColorPicker value={state.bg.color2} onChange={(c) => setLive((s) => ({ ...s, bg: { ...s.bg, color2: c } }))} />
                  </div>
                )}
              </div>
              {state.bg.type === "gradient" && <Slider label="Arah gradien" value={state.bg.angle} min={0} max={360} suffix="°" onChange={(v) => setLive((s) => ({ ...s, bg: { ...s.bg, angle: v } }))} />}
              {state.bg.type === "photo-blur" && (
                <>
                  <Slider label="Tingkat blur" value={state.bg.blur} min={0} max={120} onChange={(v) => setLive((s) => ({ ...s, bg: { ...s.bg, blur: v } }))} />
                  <p className="text-[11px] text-slate-400">Memakai foto pertama yang terpasang sebagai latar buram.</p>
                </>
              )}
              {state.bg.type === "image" && (
                <div className="space-y-2">
                  <input ref={bgFileRef} type="file" accept="image/*" className="hidden" data-testid="bg-file" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    try {
                      const p = await loadPhoto(f);
                      setPhotos((ps) => [...ps, p]);
                      setNow((s) => ({ ...s, bg: { ...s.bg, imageId: p.id, type: "image" } }));
                    } catch (err: any) {
                      setInfo({ msg: err?.message ?? "Gagal memuat gambar latar.", tone: "error" });
                    }
                  }} />
                  <Btn variant="secondary" className="w-full" onClick={() => bgFileRef.current?.click()}><Upload className="w-4 h-4" /> {state.bg.imageId ? "Ganti gambar latar" : "Pilih gambar latar"}</Btn>
                </div>
              )}
            </div>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ───────── SEL TERPILIH ───────── */}
        {tab === "sel" && (
          <div className="space-y-4">
            {!selCell || sel?.kind !== "cell" ? (
              <div className={card}>
                <p className="text-sm text-slate-500 dark:text-slate-400">Klik salah satu sel di preview untuk mengatur zoom, posisi, putar, balik, dan filter foto di dalamnya.</p>
                <div className="flex flex-wrap gap-2">
                  <Btn variant={swapMode ? "primary" : "secondary"} className="text-xs py-1.5" onClick={() => { setSwapMode((v) => !v); setSwapSource(null); }} data-testid="swap-toggle"><Repeat className="w-3.5 h-3.5" /> {swapMode ? "Batal tukar" : "Tukar posisi foto"}</Btn>
                </div>
              </div>
            ) : (
              <>
                <div className={card} data-testid="cell-panel">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Sel #{sel.index + 1}</p>
                    <button type="button" onClick={() => patchCell(sel.index, { ...defaultCell(selCell.photoId) }, false)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">Reset sel</button>
                  </div>
                  {!selCell.photoId && <p className="text-xs text-amber-600 dark:text-amber-400">Sel ini kosong — klik foto di tab “Foto” untuk mengisinya.</p>}
                  <Slider label="Zoom foto" value={selCell.zoom} min={1} max={6} step={0.05} suffix="×" onChange={(v) => patchCell(sel.index, { zoom: v })} testId="cell-zoom" />
                  <div className="grid grid-cols-2 gap-4">
                    <Slider label="Geser X" value={selCell.panX} min={-1} max={1} step={0.01} onChange={(v) => patchCell(sel.index, { panX: v })} />
                    <Slider label="Geser Y" value={selCell.panY} min={-1} max={1} step={0.01} onChange={(v) => patchCell(sel.index, { panY: v })} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="secondary" className="text-xs py-1.5" onClick={() => patchCell(sel.index, { rot: ((selCell.rot + 270) % 360) as CellState["rot"] }, false)} data-testid="rot-left"><RotateCcw className="w-3.5 h-3.5" /> Putar kiri</Btn>
                    <Btn variant="secondary" className="text-xs py-1.5" onClick={() => patchCell(sel.index, { rot: ((selCell.rot + 90) % 360) as CellState["rot"] }, false)} data-testid="rot-right"><RotateCw className="w-3.5 h-3.5" /> Putar kanan</Btn>
                    <Btn variant="secondary" className="text-xs py-1.5" onClick={() => patchCell(sel.index, { flipH: !selCell.flipH }, false)} data-testid="flip-h"><FlipHorizontal className="w-3.5 h-3.5" /> Balik H</Btn>
                    <Btn variant="secondary" className="text-xs py-1.5" onClick={() => patchCell(sel.index, { flipV: !selCell.flipV }, false)}><FlipVertical className="w-3.5 h-3.5" /> Balik V</Btn>
                  </div>
                  <Select label="Penyesuaian foto" value={selCell.fit} onChange={(e) => patchCell(sel.index, { fit: e.target.value as CellState["fit"], panX: 0, panY: 0 }, false)}>
                    <option value="cover">Penuhi sel (potong)</option>
                    <option value="contain">Muat utuh (tanpa potong)</option>
                  </Select>
                </div>

                <div className={card}>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Filter Foto</p>
                  <Slider label="Kecerahan" value={selCell.brightness} min={50} max={150} suffix="%" onChange={(v) => patchCell(sel.index, { brightness: v })} testId="cell-brightness" />
                  <Slider label="Kontras" value={selCell.contrast} min={50} max={150} suffix="%" onChange={(v) => patchCell(sel.index, { contrast: v })} />
                  <Slider label="Saturasi" value={selCell.saturate} min={0} max={200} suffix="%" onChange={(v) => patchCell(sel.index, { saturate: v })} />
                  <Slider label="Blur" value={selCell.blur} min={0} max={10} step={0.1} onChange={(v) => patchCell(sel.index, { blur: v })} />
                  <div className="flex gap-5">
                    <GamatoCheckbox checked={selCell.grayscale} onChange={(v) => patchCell(sel.index, { grayscale: v }, false)} label="Hitam putih" testId="cell-gray" />
                    <GamatoCheckbox checked={selCell.sepia} onChange={(v) => patchCell(sel.index, { sepia: v }, false)} label="Sepia" />
                  </div>
                  <Btn variant="secondary" className="w-full text-xs" onClick={() => {
                    const f = { brightness: selCell.brightness, contrast: selCell.contrast, saturate: selCell.saturate, blur: selCell.blur, grayscale: selCell.grayscale, sepia: selCell.sepia };
                    setNow((s) => ({ ...s, cells: s.cells.map((c) => ({ ...c, ...f })) }));
                    showToast("Filter diterapkan ke semua sel.", "success");
                  }}>Terapkan filter ini ke semua sel</Btn>
                </div>

                <div className={card}>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Aksi Sel</p>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant={swapMode ? "primary" : "secondary"} className="text-xs py-1.5" onClick={() => { setSwapMode((v) => !v); setSwapSource(swapMode ? null : sel.index); }} data-testid="swap-toggle"><Repeat className="w-3.5 h-3.5" /> {swapMode ? "Batal tukar" : "Tukar dengan sel lain"}</Btn>
                    {selCell.photoId && <Btn variant="secondary" className="text-xs py-1.5" onClick={() => patchCell(sel.index, { photoId: null }, false)} data-testid="clear-cell"><Eraser className="w-3.5 h-3.5" /> Kosongkan</Btn>}
                    {state.mode === "free" && (
                      <>
                        <Btn variant="secondary" className="text-xs py-1.5" onClick={() => reorderCell(sel.index, "front")} data-testid="to-front"><ArrowUpToLine className="w-3.5 h-3.5" /> Ke depan</Btn>
                        <Btn variant="secondary" className="text-xs py-1.5" onClick={() => reorderCell(sel.index, "back")}><ArrowDownToLine className="w-3.5 h-3.5" /> Ke belakang</Btn>
                        <Btn variant="secondary" className="text-xs py-1.5" onClick={() => duplicateCell(sel.index)}><CopyPlus className="w-3.5 h-3.5" /> Duplikat</Btn>
                        <Btn variant="danger" className="text-xs py-1.5" onClick={() => deleteCell(sel.index)} data-testid="delete-cell"><Trash2 className="w-3.5 h-3.5" /> Hapus bingkai</Btn>
                      </>
                    )}
                  </div>
                  {swapMode && <p className="text-[11px] text-amber-600 dark:text-amber-400">Klik sel tujuan di preview untuk menukar isi kedua sel.</p>}
                  {selFree && (
                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800" data-testid="free-panel">
                      <Slider label="Rotasi bingkai" value={selFree.rotate} min={-180} max={180} suffix="°" onChange={(v) => patchFree(sel.index, { rotate: v })} />
                      <div className="grid grid-cols-2 gap-4">
                        <Slider label="Lebar" value={Math.round(selFree.w * 100)} min={5} max={120} suffix="%" onChange={(v) => patchFree(sel.index, { w: v / 100 })} />
                        <Slider label="Tinggi" value={Math.round(selFree.h * 100)} min={5} max={120} suffix="%" onChange={(v) => patchFree(sel.index, { h: v / 100 })} />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ───────── TEKS ───────── */}
        {tab === "teks" && (
          <div className="space-y-4">
            <div className={card}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Lapisan Teks ({state.texts.length})</p>
                <Btn variant="secondary" className="text-xs py-1.5" onClick={() => addText()} data-testid="add-text"><Plus className="w-3.5 h-3.5" /> Tambah teks</Btn>
              </div>
              {state.texts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {state.texts.map((t) => (
                    <button key={t.id} type="button" onClick={() => setSel({ kind: "text", id: t.id })} className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold border max-w-[140px] truncate", sel?.kind === "text" && sel.id === t.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>{t.text.split("\n")[0] || "(kosong)"}</button>
                  ))}
                </div>
              )}
              <div>
                <Label>Stiker emoji (klik untuk menambah)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map((em) => (
                    <button key={em} type="button" onClick={() => addText(em, 14)} className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-lg hover:bg-slate-50 dark:hover:bg-slate-800">{em}</button>
                  ))}
                </div>
              </div>
            </div>

            {selText && sel?.kind === "text" && (
              <div className={card} data-testid="text-panel">
                <Textarea label="Isi teks" rows={3} value={selText.text} onChange={(e) => patchText(selText.id, { text: e.target.value })} data-testid="text-input" />
                <FontPicker label="Font" value={selText.font} onChange={(f) => patchText(selText.id, { font: f }, false)} customFonts={fonts.customFonts} isFontLoading={fonts.isFontLoading} fontError={fonts.fontError} onUpload={(f) => fonts.addCustomFont(f)} onRemoveCustomFont={(id) => fonts.removeCustomFont(id, (fb) => setNow((s) => ({ ...s, texts: s.texts.map((t) => (t.font === fonts.customFonts.find((c) => c.id === id)?.family ? { ...t, font: fb } : t)) })))} />
                <Slider label="Ukuran" value={selText.size} min={1} max={40} step={0.5} suffix="%" onChange={(v) => patchText(selText.id, { size: v })} testId="text-size" />
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Warna teks</Label><GamatoColorPicker value={selText.color} onChange={(c) => patchText(selText.id, { color: c })} testId="text-color" /></div>
                  <div><Label>Warna garis tepi</Label><GamatoColorPicker value={selText.strokeColor} onChange={(c) => patchText(selText.id, { strokeColor: c })} /></div>
                </div>
                <Slider label="Tebal garis tepi" value={selText.strokeWidth} min={0} max={30} suffix="%" onChange={(v) => patchText(selText.id, { strokeWidth: v })} />
                <div className="flex flex-wrap gap-4">
                  <GamatoCheckbox checked={selText.bold} onChange={(v) => patchText(selText.id, { bold: v }, false)} label="Tebal" />
                  <GamatoCheckbox checked={selText.italic} onChange={(v) => patchText(selText.id, { italic: v }, false)} label="Miring" />
                  <GamatoCheckbox checked={selText.shadow} onChange={(v) => patchText(selText.id, { shadow: v }, false)} label="Bayangan" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button key={a} type="button" onClick={() => patchText(selText.id, { align: a }, false)} className={cn("rounded-xl border-2 py-1.5 text-xs font-semibold", selText.align === a ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>{a === "left" ? "Kiri" : a === "center" ? "Tengah" : "Kanan"}</button>
                  ))}
                </div>
                <Slider label="Rotasi" value={selText.rotate} min={-180} max={180} suffix="°" onChange={(v) => patchText(selText.id, { rotate: v })} />
                <Slider label="Transparansi" value={Math.round(selText.opacity * 100)} min={5} max={100} suffix="%" onChange={(v) => patchText(selText.id, { opacity: v / 100 })} />
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div><Label>Warna latar teks</Label><GamatoColorPicker value={selText.bgColor} onChange={(c) => patchText(selText.id, { bgColor: c })} /></div>
                  <Slider label="Kepekatan latar" value={Math.round(selText.bgOpacity * 100)} min={0} max={100} suffix="%" onChange={(v) => patchText(selText.id, { bgOpacity: v / 100 })} />
                </div>
                <div className="flex gap-2">
                  <Btn variant="secondary" className="flex-1 text-xs py-1.5" onClick={() => duplicateText(selText.id)}><CopyPlus className="w-3.5 h-3.5" /> Duplikat</Btn>
                  <Btn variant="danger" className="flex-1 text-xs py-1.5" onClick={() => deleteText(selText.id)} data-testid="delete-text"><Trash2 className="w-3.5 h-3.5" /> Hapus</Btn>
                </div>
              </div>
            )}
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ───────── EKSPOR ───────── */}
        {tab === "ekspor" && (
          <div className="space-y-4">
            <div className={card}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Hasil Akhir</p>
              <Input label="Nama file" value={fileName} onChange={(e) => setFileName(e.target.value)} data-testid="file-name" />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Format" value={expFormat} onChange={(e) => setExpFormat(e.target.value as typeof expFormat)} data-testid="exp-format">
                  <option value="png">PNG (lossless)</option>
                  <option value="jpeg">JPG</option>
                  <option value="webp">WEBP</option>
                </Select>
                <Select label="Sisi terpanjang" value={String(expSize)} onChange={(e) => setExpSize(parseInt(e.target.value))} data-testid="exp-size">
                  {EXPORT_SIZES.map((s) => <option key={s} value={s}>{s}px</option>)}
                </Select>
              </div>
              {expFormat !== "png" && <Slider label="Kualitas" value={expQuality} min={40} max={100} suffix="%" onChange={setExpQuality} />}
              <p className="text-xs text-slate-500 dark:text-slate-400">Ukuran file: <b>{out.w} × {out.h}px</b>{capped ? " (dibatasi batas memori browser)" : ""}.</p>
              <div className="grid grid-cols-2 gap-2">
                <Btn onClick={doDownload} disabled={!!busy} className="col-span-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700" data-testid="btn-download"><Download className="w-4 h-4" /> Unduh Kolase</Btn>
                <Btn variant="secondary" onClick={doPdf} disabled={!!busy} data-testid="btn-pdf"><FileText className="w-4 h-4" /> PDF</Btn>
                <Btn variant="secondary" onClick={doCopy} disabled={!!busy} data-testid="btn-copy"><Copy className="w-4 h-4" /> Salin</Btn>
                <Btn variant="secondary" onClick={doPrint} disabled={!!busy} className="col-span-2" data-testid="btn-print"><Printer className="w-4 h-4" /> Cetak</Btn>
              </div>
            </div>
            <ToolInfoPanel
              icon={<LayoutGrid className="w-5 h-5" />}
              label="Kolase Gambar"
              desc="Template, bebas, dan penuh kustom"
              points={[
                "Gambar kolase persis seperti yang kamu lihat — preview dan ekspor memakai mesin render yang sama.",
                "Foto tidak pernah diunggah ke server; semua dirender di perangkatmu.",
                "Mode Bebas: seret, ubah ukuran dari sudut, dan putar dengan handle di atas bingkai (Shift = kunci rasio / snap 15°).",
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
};
