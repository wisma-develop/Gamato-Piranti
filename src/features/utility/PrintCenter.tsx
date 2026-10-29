import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import {
  Printer, FileText, Download, Plus, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2, Settings2, Layers, Frame, Palette, FilePlus2, Info, Type,
  FileImage, FileSpreadsheet, Presentation, File as FileIcon, AlertTriangle,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { Dropzone } from "@/components/ui/Dropzone";
import { Btn, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { SettingsTabBar, type SettingsTabDef } from "@/components/ui/SettingsTabs";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import {
  DEFAULT_SETTINGS, PAPERS, buildPrintHtml, canvasToBlob, paperSize, planPrint, renderSheet, type PrintSettings, type PrintPageSource, type RenderContext,
} from "@/lib/printEngine";
import { ACCEPT, DEFAULT_TEXT_OPTIONS, buildTextSource, loadPrintSource, type LoadedSource, type TextOptions } from "@/lib/printSources";

type TabId = "sumber" | "halaman" | "layout" | "kertas" | "tampilan" | "tambahan";
const TABS: SettingsTabDef<TabId>[] = [
  { id: "sumber", label: "Berkas", icon: <FilePlus2 className="w-4 h-4" /> },
  { id: "halaman", label: "Halaman & Salinan", icon: <Layers className="w-4 h-4" /> },
  { id: "layout", label: "Tata Letak", icon: <Settings2 className="w-4 h-4" /> },
  { id: "kertas", label: "Kertas & Margin", icon: <Frame className="w-4 h-4" /> },
  { id: "tampilan", label: "Warna & Skala", icon: <Palette className="w-4 h-4" /> },
  { id: "tambahan", label: "Header & Watermark", icon: <Type className="w-4 h-4" /> },
];

const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";
const cap = "text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500";

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void; testId?: string }> = ({ label, value, min, max, step = 1, suffix = "", onChange, testId }) => (
  <div data-testid={testId}>
    <div className="flex justify-between items-center mb-1.5">
      <Label>{label}</Label>
      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(value * 100) / 100}{suffix}</span>
    </div>
    <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
  </div>
);

const Seg: React.FC<{ value: string; options: [string, string][]; onChange: (v: string) => void; testId?: string }> = ({ value, options, onChange, testId }) => (
  <div className="flex flex-wrap gap-1.5" data-testid={testId}>
    {options.map(([v, l]) => (
      <button key={v} type="button" data-testid={`${testId}-${v}`} onClick={() => onChange(v)} className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors", value === v ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>{l}</button>
    ))}
  </div>
);

const KIND_ICON: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-4 h-4" />, image: <FileImage className="w-4 h-4" />, docx: <FileText className="w-4 h-4" />, xlsx: <FileSpreadsheet className="w-4 h-4" />,
  csv: <FileSpreadsheet className="w-4 h-4" />, pptx: <Presentation className="w-4 h-4" />, text: <FileIcon className="w-4 h-4" />,
};

/** Small lazily-rendered thumbnail of one sheet. */
const SheetThumb: React.FC<{ index: number; active: boolean; onClick: () => void; render: (index: number, widthPx: number) => Promise<HTMLCanvasElement>; version: string; aspect: number }> = ({ index, active, onClick, render, version, aspect }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setVisible(es.some((e) => e.isIntersecting)), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const c = await render(index, 110);
        if (cancel || !ref.current) return;
        ref.current.width = c.width;
        ref.current.height = c.height;
        ref.current.getContext("2d")!.drawImage(c, 0, 0);
      } catch { /* ignore thumbnail failures */ }
    }, 120);
    return () => { cancel = true; clearTimeout(t); };
  }, [visible, version, index, render]);
  return (
    <button ref={wrapRef} type="button" onClick={onClick} data-testid="sheet-thumb" aria-label={`Lembar ${index + 1}`} className={cn("shrink-0 rounded-md border-2 bg-white overflow-hidden", active ? "border-indigo-500 shadow-md" : "border-slate-300 dark:border-slate-600 hover:border-indigo-300")} style={{ width: 62, height: 62 / aspect }}>
      <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
    </button>
  );
};

export const PrintCenter: React.FC = () => {
  const [sources, setSources] = useState<LoadedSource[]>([]);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const [s, setS] = useState<PrintSettings>(DEFAULT_SETTINGS);
  const patch = useCallback((p: Partial<PrintSettings>) => setS((x) => ({ ...x, ...p })), []);
  const [textOpts, setTextOpts] = useState<TextOptions>(DEFAULT_TEXT_OPTIONS);
  const [tab, setTab] = useState<TabId>("sumber");
  const [cur, setCur] = useState(0);
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [guides, setGuides] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [info, setInfo] = useState<{ msg: string; tone: "success" | "error" | "warning" | "info" } | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [hostW, setHostW] = useState(700);
  const [previewing, setPreviewing] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const openRef = useRef<HTMLInputElement>(null);

  const allPages: PrintPageSource[] = useMemo(() => sources.flatMap((x) => x.pages), [sources]);
  const plan = useMemo(() => planPrint(allPages.map((p) => p.ref), s), [allPages, s]);
  const sel = paperSize(s);
  const title = sources.length ? sources[0].name.replace(/\.[^.]+$/, "") + (sources.length > 1 ? ` (+${sources.length - 1})` : "") : "Dokumen";
  const ctxInfo = useCallback((guidesOn: boolean): RenderContext => ({ title, fileLabel: sources.map((x) => x.name).join(", "), uniqueSheets: plan.sheets.length, guides: guidesOn }), [title, sources, plan.sheets.length]);

  const version = useMemo(() => JSON.stringify([s, allPages.length, plan.sheets.length, title]), [s, allPages.length, plan.sheets.length, title]);
  const curSafe = Math.min(cur, Math.max(0, plan.sheets.length - 1));
  useEffect(() => { if (cur !== curSafe) setCur(curSafe); }, [cur, curSafe]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHostW(el.clientWidth || 700));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sources.length]);

  useEffect(() => () => { sourcesRef.current.forEach((x) => x.dispose()); }, []);

  /* ── preview ── */
  const aspect = plan.paperW / plan.paperH;
  const maxH = typeof window !== "undefined" ? window.innerHeight * 0.78 : 700;
  const fitW = Math.min(hostW - 24, maxH * aspect);
  const dispW = zoom === "fit" ? Math.max(180, fitW) : Math.max(120, (plan.paperW / 25.4) * 96 * (zoom / 100));
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;

  const renderUnique = useCallback(
    (index: number, widthPx: number, withGuides = false) => renderSheet(plan, index, allPages, s, ctxInfo(withGuides), { widthPx }),
    [plan, allPages, s, ctxInfo]
  );

  useEffect(() => {
    if (!plan.sheets.length) return;
    let cancelled = false;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const c = await renderUnique(curSafe, Math.round(Math.min(2000, dispW * dpr)), guides);
        if (cancelled || !canvasRef.current) return;
        canvasRef.current.width = c.width;
        canvasRef.current.height = c.height;
        canvasRef.current.getContext("2d")!.drawImage(c, 0, 0);
      } catch (e: any) {
        if (!cancelled) setInfo({ msg: `Pratinjau gagal: ${e?.message ?? e}`, tone: "error" });
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 80);
    return () => { cancelled = true; clearTimeout(t); };
  }, [version, curSafe, dispW, dpr, guides, renderUnique, plan.sheets.length]);

  /* ── sources ── */
  const addFiles = async (files: File[]) => {
    setInfo(null);
    setBusy("Membaca berkas…");
    const added: LoadedSource[] = [];
    const errors: string[] = [];
    for (const f of files) {
      try { added.push(await loadPrintSource(f, textOpts)); }
      catch (e: any) { errors.push(e?.message ?? `Gagal membaca ${f.name}`); }
    }
    setBusy(null);
    if (added.length) {
      setSources((x) => [...x, ...added]);
      setCur(0);
      if (added.length === files.length) setInfo({ msg: `${added.reduce((a, b) => a + b.pages.length, 0)} halaman siap dicetak.`, tone: "success" });
      if (tab === "sumber" && sourcesRef.current.length === 0) setTab("halaman");
    }
    if (errors.length) setInfo({ msg: errors.join(" "), tone: "error" });
  };

  const addPasted = async () => {
    if (!pasteText.trim()) return;
    try {
      const src = await buildTextSource(`Teks ${sources.length + 1}`, pasteText, textOpts);
      setSources((x) => [...x, src]);
      setPasteText("");
      setInfo({ msg: "Teks ditambahkan.", tone: "success" });
    } catch (e: any) { setInfo({ msg: e?.message ?? "Gagal.", tone: "error" }); }
  };

  const removeSource = (id: string) => {
    setSources((xs) => { xs.find((x) => x.id === id)?.dispose(); return xs.filter((x) => x.id !== id); });
  };
  const moveSource = (id: string, d: -1 | 1) => setSources((xs) => {
    const i = xs.findIndex((x) => x.id === id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= xs.length) return xs;
    const c = [...xs];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });

  // rebuild text-based sources when text options change
  const textOptsRef = useRef(textOpts);
  useEffect(() => {
    if (textOptsRef.current === textOpts) return;
    textOptsRef.current = textOpts;
    const t = setTimeout(async () => {
      const cur = sourcesRef.current;
      if (!cur.some((x) => x.text != null)) return;
      const next: LoadedSource[] = [];
      for (const x of cur) {
        if (x.text != null) {
          try { const r = await buildTextSource(x.name, x.text, textOpts, x.kind); x.dispose(); next.push({ ...r, id: x.id }); } catch { next.push(x); }
        } else next.push(x);
      }
      setSources(next);
    }, 400);
    return () => clearTimeout(t);
  }, [textOpts]);

  /* ── output ── */
  const renderAll = async (onProgress?: (f: number) => void): Promise<{ urls: string[]; blobs: Blob[]; mime: string }> => {
    const mime = s.color === "color" ? "image/jpeg" : "image/png";
    const blobs: Blob[] = [];
    for (let i = 0; i < plan.sheets.length; i++) {
      const c = await renderSheet(plan, i, allPages, s, ctxInfo(false), { dpi: s.dpi });
      blobs.push(await canvasToBlob(c, mime, 0.92));
      onProgress?.((i + 1) / plan.sheets.length);
      await new Promise((r) => setTimeout(r, 0));
    }
    return { urls: blobs.map((b) => URL.createObjectURL(b)), blobs, mime };
  };

  const doPrint = async () => {
    if (!plan.sheets.length) return;
    setInfo(null);
    setBusy("Menyiapkan lembar cetak…");
    let urls: string[] = [];
    try {
      const r = await renderAll((f) => setBusy(`Menyiapkan lembar cetak… ${Math.round(f * 100)}%`));
      urls = r.urls;
      const hook = (window as any).__GP_PRINT_HOOK__;
      let seqUrls = plan.sequence.map((i) => urls[i]);
      if (typeof hook === "function") {
        // test hook: hand over a fully self-contained document instead of opening the print dialog
        const dataUrls = await Promise.all(r.blobs.map((b) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); })));
        seqUrls = plan.sequence.map((i) => dataUrls[i]);
        hook({ html: buildPrintHtml(seqUrls, plan.paperW, plan.paperH, title), sheets: plan.sequence.length, paperW: plan.paperW, paperH: plan.paperH });
        urls.forEach((u) => URL.revokeObjectURL(u));
        setInfo({ msg: `Dokumen cetak disiapkan (${plan.sequence.length} lembar).`, tone: "success" });
        return;
      }
      const html = buildPrintHtml(seqUrls, plan.paperW, plan.paperH, title);
      const iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
      document.body.appendChild(iframe);
      const doc = iframe.contentDocument!;
      doc.open();
      doc.write(html);
      doc.close();
      await Promise.all(Array.from(doc.images).map((im) => (im.complete ? Promise.resolve() : im.decode().catch(() => {}))));
      const win = iframe.contentWindow!;
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        urls.forEach((u) => URL.revokeObjectURL(u));
        iframe.remove();
      };
      win.addEventListener("afterprint", () => setTimeout(cleanup, 500));
      setTimeout(cleanup, 10 * 60 * 1000);
      setBusy(null);
      win.focus();
      win.print();
      setInfo({ msg: "Dialog cetak browser dibuka. Pilih printer, lalu cetak. (Ukuran kertas & margin sudah diatur dari sini.)", tone: "info" });
    } catch (e: any) {
      urls.forEach((u) => URL.revokeObjectURL(u));
      setInfo({ msg: `Gagal menyiapkan cetak: ${e?.message ?? e}`, tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const doPdf = async () => {
    if (!plan.sheets.length) return;
    setInfo(null);
    setBusy("Membuat PDF…");
    try {
      const r = await renderAll((f) => setBusy(`Membuat PDF… ${Math.round(f * 100)}%`));
      const pdf = await PDFDocument.create();
      pdf.setTitle(title);
      pdf.setCreator("Gamato Piranti — Cetak File & Dokumen");
      const imgs = [];
      for (const b of r.blobs) {
        const bytes = new Uint8Array(await b.arrayBuffer());
        imgs.push(r.mime === "image/jpeg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes));
      }
      const W = (plan.paperW / 25.4) * 72;
      const H = (plan.paperH / 25.4) * 72;
      for (const i of plan.sequence) {
        const page = pdf.addPage([W, H]);
        page.drawImage(imgs[i], { x: 0, y: 0, width: W, height: H });
      }
      r.urls.forEach((u) => URL.revokeObjectURL(u));
      downloadBlob(new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" }), `${title.replace(/[\\/:*?"<>|]+/g, "_")}-siap-cetak.pdf`);
      setInfo({ msg: `PDF siap cetak (${plan.sequence.length} lembar, ${plan.paperW.toFixed(0)}×${plan.paperH.toFixed(0)} mm) diunduh.`, tone: "success" });
    } catch (e: any) {
      setInfo({ msg: `Gagal membuat PDF: ${e?.message ?? e}`, tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  /* ── derived ── */
  const totalPages = allPages.length;
  const sheetsPhysical = plan.sequence.length;
  const notes = sources.filter((x) => x.note);
  const rangeInvalid = s.rangeMode === "custom" && s.rangeText.trim() !== "" && plan.selected.length === 0;
  const hasPages = totalPages > 0;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start" data-testid="print-root">
      <GamatoDesktopRecommended toolName="Pusat Cetak" className="lg:col-span-full" />
      <input ref={openRef} type="file" multiple accept={ACCEPT} className="hidden" data-testid="print-file" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) addFiles(f); }} />

      {/* ───────── LEFT: preview ───────── */}
      <div className="space-y-3 min-w-0 lg:sticky lg:top-20" ref={hostRef}>
        {!hasPages ? (
          <div className="space-y-4">
            <Dropzone onFiles={addFiles} accept={ACCEPT} multiple isDragging={isDragging} setIsDragging={setIsDragging} label="Unggah berkas yang ingin dicetak" sublabel="PDF, gambar, DOCX, XLSX, PPTX, CSV, TXT, kode — bisa banyak sekaligus" icon={<Printer className="w-8 h-8" />} />
            {busy && <div className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600"><Loader2 className="w-4 h-4 animate-spin" />{busy}</div>}
            {info && <GamatoInlineAlert message={info.msg} tone={info.tone} />}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Btn variant="secondary" className="px-2.5 py-2" disabled={curSafe <= 0} onClick={() => setCur(curSafe - 1)} data-testid="sheet-prev" aria-label="Lembar sebelumnya"><ChevronLeft className="w-4 h-4" /></Btn>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 px-2 tabular-nums" data-testid="sheet-indicator">Lembar {plan.sheets.length ? curSafe + 1 : 0} / {plan.sheets.length}</span>
                <Btn variant="secondary" className="px-2.5 py-2" disabled={curSafe >= plan.sheets.length - 1} onClick={() => setCur(curSafe + 1)} data-testid="sheet-next" aria-label="Lembar berikutnya"><ChevronRight className="w-4 h-4" /></Btn>
              </div>
              <div className="flex items-center gap-3">
                <GamatoCheckbox checked={guides} onChange={setGuides} label="Garis margin" testId="chk-guides" />
                <select value={String(zoom)} onChange={(e) => setZoom(e.target.value === "fit" ? "fit" : parseInt(e.target.value))} aria-label="Zoom" data-testid="zoom-select" className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5">
                  <option value="fit">Pas layar</option>
                  {[50, 75, 100, 125, 150].map((z) => <option key={z} value={z}>{z}%</option>)}
                </select>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-200 dark:bg-slate-800 p-3 overflow-auto relative" style={{ maxHeight: "78vh" }} data-testid="preview-area">
              <div className="mx-auto relative" style={{ width: dispW }}>
                <canvas ref={canvasRef} data-testid="sheet-canvas" style={{ width: "100%", height: "auto", display: "block", boxShadow: "0 4px 24px rgba(15,23,42,.25)", background: "#fff" }} />
                {previewing && <div className="absolute top-2 right-2 bg-white/90 dark:bg-slate-900/90 rounded-full p-1.5 shadow"><Loader2 className="w-4 h-4 animate-spin text-indigo-600" /></div>}
              </div>
            </div>

            {plan.sheets.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" data-testid="thumb-strip">
                {plan.sheets.map((_, i) => <SheetThumb key={i} index={i} active={i === curSafe} onClick={() => setCur(i)} render={(idx, w) => renderUnique(idx, w)} version={version} aspect={aspect} />)}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400" data-testid="summary">
              <span className="bg-slate-100 dark:bg-slate-800 rounded-full px-2.5 py-1">{plan.paperW.toFixed(0)} × {plan.paperH.toFixed(0)} mm · {plan.landscape ? "Lanskap" : "Potret"}</span>
              <span className="bg-slate-100 dark:bg-slate-800 rounded-full px-2.5 py-1" data-testid="sum-pages">{plan.selected.length} dari {totalPages} halaman</span>
              <span className="bg-slate-100 dark:bg-slate-800 rounded-full px-2.5 py-1 font-semibold text-indigo-600 dark:text-indigo-300" data-testid="sum-sheets">{sheetsPhysical} lembar kertas{s.copies > 1 ? ` (${plan.sheets.length} × ${s.copies} salinan)` : ""}</span>
            </div>
            {busy && <div className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300" data-testid="print-busy"><Loader2 className="w-4 h-4 animate-spin" />{busy}</div>}
            {info && <GamatoInlineAlert message={info.msg} tone={info.tone} />}
          </>
        )}
      </div>

      {/* ───────── RIGHT: settings ───────── */}
      <div className="space-y-4 min-w-0">
        {hasPages && (
          <div className="grid grid-cols-2 gap-2">
            <Btn className="col-span-2 py-3.5 text-base bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700" onClick={doPrint} disabled={!!busy || !plan.sheets.length} data-testid="btn-print"><Printer className="w-4 h-4" /> Cetak ({sheetsPhysical} lembar)</Btn>
            <Btn variant="secondary" onClick={doPdf} disabled={!!busy || !plan.sheets.length} data-testid="btn-pdf"><Download className="w-4 h-4" /> Unduh PDF siap cetak</Btn>
            <Btn variant="secondary" onClick={() => openRef.current?.click()} disabled={!!busy} data-testid="btn-add-more"><Plus className="w-4 h-4" /> Tambah berkas</Btn>
          </div>
        )}
        <SettingsTabBar tabs={TABS} active={tab} onChange={setTab} />

        {tab === "sumber" && (
          <div className="space-y-4">
            <div className={card} data-testid="source-list">
              <p className={cap}>Berkas ({sources.length})</p>
              {sources.length === 0 && <p className="text-xs text-slate-400">Belum ada berkas. Unggah di area kiri atau tempel teks di bawah.</p>}
              {sources.map((x, i) => (
                <div key={x.id} data-testid="source-item" className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
                  <span className="text-indigo-500 shrink-0">{KIND_ICON[x.kind]}</span>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-100">{x.name}</p><p className="text-[11px] text-slate-400">{x.pages.length} halaman</p></div>
                  <button type="button" className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30" disabled={i === 0} onClick={() => moveSource(x.id, -1)} aria-label="Naik"><ChevronUp className="w-4 h-4" /></button>
                  <button type="button" className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30" disabled={i === sources.length - 1} onClick={() => moveSource(x.id, 1)} aria-label="Turun"><ChevronDown className="w-4 h-4" /></button>
                  <button type="button" className="p-1 text-slate-400 hover:text-red-500" onClick={() => removeSource(x.id)} aria-label="Hapus" data-testid="source-remove"><X className="w-4 h-4" /></button>
                </div>
              ))}
              {notes.map((x) => <p key={x.id} className="text-[11px] text-amber-600 dark:text-amber-400 flex gap-1.5"><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{x.name}: {x.note}</p>)}
              <Btn variant="secondary" className="w-full text-xs" onClick={() => openRef.current?.click()}><Plus className="w-3.5 h-3.5" /> Tambah berkas</Btn>
            </div>
            <div className={card}>
              <p className={cap}>Ketik / Tempel Teks</p>
              <Textarea rows={4} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Tempel teks yang ingin dicetak…" data-testid="paste-text" />
              <Btn variant="secondary" className="w-full text-xs" disabled={!pasteText.trim()} onClick={addPasted} data-testid="paste-add">Tambahkan sebagai dokumen</Btn>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Select label="Font teks/kode" value={textOpts.family} onChange={(e) => setTextOpts({ ...textOpts, family: e.target.value as TextOptions["family"] })} data-testid="text-family">
                  <option value="mono">Monospace (kode)</option>
                  <option value="sans">Sans-serif</option>
                  <option value="serif">Serif</option>
                </Select>
                <Select label="Ukuran font" value={String(textOpts.size)} onChange={(e) => setTextOpts({ ...textOpts, size: parseInt(e.target.value) })}>
                  {[8, 9, 10, 11, 12, 14, 16].map((n) => <option key={n} value={n}>{n} pt</option>)}
                </Select>
              </div>
              <GamatoCheckbox checked={textOpts.lineNumbers} onChange={(v) => setTextOpts({ ...textOpts, lineNumbers: v })} label="Nomor baris" testId="text-linenum" />
              <p className="text-[11px] text-slate-400">Berlaku untuk berkas teks/kode (TXT, MD, JSON, JS, PY, dll.).</p>
            </div>
          </div>
        )}

        {tab === "halaman" && (
          <div className="space-y-4">
            <div className={card}>
              <p className={cap}>Halaman</p>
              <Seg testId="range" value={s.rangeMode} onChange={(v) => patch({ rangeMode: v as PrintSettings["rangeMode"] })} options={[["all", "Semua"], ["odd", "Ganjil"], ["even", "Genap"], ["custom", "Kustom"]]} />
              {s.rangeMode === "custom" && (
                <>
                  <Input label="Rentang halaman" value={s.rangeText} onChange={(e) => patch({ rangeText: e.target.value })} placeholder="mis. 1-3, 5, 8-" data-testid="range-text" />
                  {rangeInvalid && <p className="text-xs text-red-500">Rentang tidak valid (total {totalPages} halaman).</p>}
                </>
              )}
              <GamatoCheckbox checked={s.reverse} onChange={(v) => patch({ reverse: v })} label="Urutan terbalik (halaman terakhir dulu)" testId="chk-reverse" />
            </div>
            <div className={card}>
              <p className={cap}>Salinan</p>
              <Input label="Jumlah salinan" type="number" min={1} max={999} value={s.copies} onChange={(e) => patch({ copies: Math.max(1, Math.min(999, parseInt(e.target.value) || 1)) })} data-testid="copies" />
              <GamatoCheckbox checked={s.collate} onChange={(v) => patch({ collate: v })} label="Susun (1,2,3 · 1,2,3)" testId="chk-collate" />
              <p className="text-[11px] text-slate-400">Pilihan printer, jenis kertas, dan <b>cetak dua sisi (duplex)</b> diatur di dialog cetak browser setelah menekan “Cetak”.</p>
            </div>
          </div>
        )}

        {tab === "layout" && (
          <div className="space-y-4">
            <div className={card}>
              <p className={cap}>Orientasi</p>
              <Seg testId="orient" value={s.orientation} onChange={(v) => patch({ orientation: v as PrintSettings["orientation"] })} options={[["auto", "Otomatis"], ["portrait", "Potret"], ["landscape", "Lanskap"]]} />
            </div>
            <div className={card}>
              <p className={cap}>Halaman per Lembar</p>
              <Seg testId="nup" value={String(s.pagesPerSheet)} onChange={(v) => patch({ pagesPerSheet: parseInt(v) as PrintSettings["pagesPerSheet"] })} options={[["1", "1"], ["2", "2"], ["4", "4"], ["6", "6"], ["9", "9"], ["16", "16"]]} />
              {s.pagesPerSheet > 1 && !s.booklet && (
                <>
                  <Seg testId="fill" value={s.fillOrder} onChange={(v) => patch({ fillOrder: v as PrintSettings["fillOrder"] })} options={[["rows", "Isi per baris →"], ["cols", "Isi per kolom ↓"]]} />
                  <Slider label="Celah antar halaman" value={s.cellGap} min={0} max={20} step={0.5} suffix=" mm" onChange={(v) => patch({ cellGap: v })} />
                </>
              )}
              <GamatoCheckbox checked={s.booklet} onChange={(v) => patch({ booklet: v })} label="Mode buklet (lipat tengah / saddle-stitch)" testId="chk-booklet" />
              {s.booklet && <p className="text-[11px] text-slate-500 dark:text-slate-400">Halaman diurutkan agar setelah dicetak <b>dua sisi (flip di sisi pendek)</b> lalu dilipat jadi buklet. Kertas otomatis lanskap, 2 halaman per sisi.</p>}
            </div>
          </div>
        )}

        {tab === "kertas" && (
          <div className="space-y-4">
            <div className={card}>
              <p className={cap}>Ukuran Kertas</p>
              <Select label="Kertas" value={s.paper} onChange={(e) => patch({ paper: e.target.value })} data-testid="paper-select">
                {PAPERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
              {s.paper === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Lebar (mm)" type="number" min={20} value={s.customW} onChange={(e) => patch({ customW: parseFloat(e.target.value) || 210 })} data-testid="custom-w" />
                  <Input label="Tinggi (mm)" type="number" min={20} value={s.customH} onChange={(e) => patch({ customH: parseFloat(e.target.value) || 297 })} data-testid="custom-h" />
                </div>
              )}
              <p className="text-[11px] text-slate-400">Ukuran terpilih: {sel.w} × {sel.h} mm.</p>
            </div>
            <div className={card}>
              <p className={cap}>Margin</p>
              <Seg testId="margin" value={s.marginMode} onChange={(v) => patch({ marginMode: v as PrintSettings["marginMode"] })} options={[["default", "Default (10 mm)"], ["none", "Tanpa"], ["min", "Minimum"], ["custom", "Kustom"]]} />
              {s.marginMode === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Atas (mm)" type="number" min={0} value={s.marginTop} onChange={(e) => patch({ marginTop: Math.max(0, parseFloat(e.target.value) || 0) })} data-testid="m-top" />
                  <Input label="Bawah (mm)" type="number" min={0} value={s.marginBottom} onChange={(e) => patch({ marginBottom: Math.max(0, parseFloat(e.target.value) || 0) })} />
                  <Input label="Kiri (mm)" type="number" min={0} value={s.marginLeft} onChange={(e) => patch({ marginLeft: Math.max(0, parseFloat(e.target.value) || 0) })} data-testid="m-left" />
                  <Input label="Kanan (mm)" type="number" min={0} value={s.marginRight} onChange={(e) => patch({ marginRight: Math.max(0, parseFloat(e.target.value) || 0) })} />
                </div>
              )}
              <Slider label="Jilid / binding (tambahan margin kiri)" value={s.gutter} min={0} max={30} step={0.5} suffix=" mm" onChange={(v) => patch({ gutter: v })} testId="gutter" />
            </div>
          </div>
        )}

        {tab === "tampilan" && (
          <div className="space-y-4">
            <div className={card}>
              <p className={cap}>Skala</p>
              <Seg testId="scale" value={s.scaleMode} onChange={(v) => patch({ scaleMode: v as PrintSettings["scaleMode"] })} options={[["fit", "Pas halaman"], ["shrink", "Kecilkan jika besar"], ["actual", "Ukuran asli 100%"], ["custom", "Kustom %"]]} />
              {s.scaleMode === "custom" && <Slider label="Skala" value={s.scalePct} min={10} max={300} step={1} suffix="%" onChange={(v) => patch({ scalePct: v })} testId="scale-pct" />}
              <Seg testId="align" value={s.align} onChange={(v) => patch({ align: v as PrintSettings["align"] })} options={[["center", "Tengah"], ["top", "Rata atas"]]} />
              <GamatoCheckbox checked={s.autoRotate} onChange={(v) => patch({ autoRotate: v })} label="Putar halaman otomatis agar lebih pas" testId="chk-autorotate" />
            </div>
            <div className={card}>
              <p className={cap}>Warna</p>
              <Seg testId="color" value={s.color} onChange={(v) => patch({ color: v as PrintSettings["color"] })} options={[["color", "Berwarna"], ["gray", "Skala abu-abu"], ["bw", "Hitam putih"]]} />
              {s.color === "bw" && <Slider label="Ambang hitam-putih" value={s.bwThreshold} min={30} max={230} onChange={(v) => patch({ bwThreshold: v })} testId="bw-thr" />}
              <Slider label="Kecerahan" value={s.brightness} min={-60} max={60} onChange={(v) => patch({ brightness: v })} />
              <Slider label="Kontras" value={s.contrast} min={-60} max={60} onChange={(v) => patch({ contrast: v })} />
              <Select label="Resolusi cetak" value={String(s.dpi)} onChange={(e) => patch({ dpi: parseInt(e.target.value) as PrintSettings["dpi"] })} data-testid="dpi">
                <option value="150">150 dpi (cepat, draf)</option>
                <option value="200">200 dpi (standar)</option>
                <option value="300">300 dpi (tajam, foto)</option>
              </Select>
            </div>
          </div>
        )}

        {tab === "tambahan" && (
          <div className="space-y-4">
            <div className={card}>
              <p className={cap}>Header & Footer</p>
              <div className="flex gap-5">
                <GamatoCheckbox checked={s.headerOn} onChange={(v) => patch({ headerOn: v })} label="Header" testId="chk-header" />
                <GamatoCheckbox checked={s.footerOn} onChange={(v) => patch({ footerOn: v })} label="Footer" testId="chk-footer" />
              </div>
              {s.headerOn && (
                <div className="grid grid-cols-3 gap-2">
                  <Input label="Kiri" value={s.headerLeft} onChange={(e) => patch({ headerLeft: e.target.value })} data-testid="h-left" />
                  <Input label="Tengah" value={s.headerCenter} onChange={(e) => patch({ headerCenter: e.target.value })} />
                  <Input label="Kanan" value={s.headerRight} onChange={(e) => patch({ headerRight: e.target.value })} />
                </div>
              )}
              {s.footerOn && (
                <div className="grid grid-cols-3 gap-2">
                  <Input label="Kiri" value={s.footerLeft} onChange={(e) => patch({ footerLeft: e.target.value })} />
                  <Input label="Tengah" value={s.footerCenter} onChange={(e) => patch({ footerCenter: e.target.value })} data-testid="f-center" />
                  <Input label="Kanan" value={s.footerRight} onChange={(e) => patch({ footerRight: e.target.value })} />
                </div>
              )}
              <p className="text-[11px] text-slate-400">Variabel: {"{title}"} {"{file}"} {"{date}"} {"{time}"} {"{page}"} {"{pages}"}. Header/footer digambar di area margin — beri margin ≥ 8 mm.</p>
            </div>
            <div className={card}>
              <p className={cap}>Watermark</p>
              <Input label="Teks watermark" value={s.watermark} onChange={(e) => patch({ watermark: e.target.value })} placeholder="mis. DRAFT / RAHASIA" data-testid="wm-text" />
              <GamatoCheckbox checked={s.watermarkIcon} onChange={(v) => patch({ watermarkIcon: v })} label="Tambahkan ikon asli Gamato Piranti" testId="wm-icon" />
              {(s.watermark || s.watermarkIcon) && (
                <>
                  <Slider label="Kepekatan" value={Math.round(s.watermarkOpacity * 100)} min={3} max={80} suffix="%" onChange={(v) => patch({ watermarkOpacity: v / 100 })} />
                  <Slider label="Ukuran" value={s.watermarkSize} min={4} max={40} suffix="%" onChange={(v) => patch({ watermarkSize: v })} />
                  <Slider label="Sudut" value={s.watermarkAngle} min={-90} max={90} suffix="°" onChange={(v) => patch({ watermarkAngle: v })} />
                  {s.watermark && <div className="flex items-center gap-3"><Label>Warna teks</Label><input type="color" value={s.watermarkColor} onChange={(e) => patch({ watermarkColor: e.target.value })} className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer" aria-label="Warna watermark" /></div>}
                </>
              )}
            </div>
            <div className={card}>
              <p className={cap}>Lainnya</p>
              <GamatoCheckbox checked={s.pageBorder} onChange={(v) => patch({ pageBorder: v })} label="Bingkai tipis di sekitar tiap halaman" testId="chk-border" />
              <GamatoCheckbox checked={s.mirror} onChange={(v) => patch({ mirror: v })} label="Cermin horizontal (untuk kertas transfer/iron-on)" testId="chk-mirror" />
            </div>
          </div>
        )}

        <ToolInfoPanel
          icon={<Info className="w-5 h-5" />}
          label="Cetak File & Dokumen"
          desc="Pengaturan setara dialog cetak browser"
          points={[
            "Pratinjau persis hasil cetak — digambar oleh mesin Gamato Piranti, bukan oleh browser.",
            "“Cetak” membuka dialog cetak browser dengan ukuran kertas sudah terkunci; “Unduh PDF siap cetak” bisa dibawa ke percetakan.",
            "Semua diproses di perangkatmu — berkasmu tidak diunggah. Hasil tanpa stempel Gamato.",
          ]}
        />
      </div>
    </div>
  );
};
