import React, { useEffect, useMemo, useRef, useState } from "react";
import { PreviewJumpFab } from "@/components/ui/PreviewJumpFab";
import {
  Ticket, Download, Printer, Loader2, Copy, Plus, Trash2, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  Upload, Shuffle, Search, Save, FolderOpen, Layers, Palette, QrCode, Type, FileText, Table2, Check, X, Sparkles, FileArchive, Grid3x3,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { ensureFontReady } from "@/lib/businessDocCanvas";
import { printCanvasImage } from "@/lib/printCanvas";
import { readXlsxGrid } from "@/lib/officeReaders";
import { parseTable, BulkCancelled, type SheetPaper } from "@/lib/businessCardBulk";
import {
  COUPON_KINDS, COUPON_SIZES, COUPON_TEMPLATES, MAX_COUPON_ROWS, applyKind, applyTemplate, baseDesign, defaultCouponDesign, newRowId,
  type CouponDesign, type CouponKind, type LayoutMode, type StubPosition, type PatternId,
} from "@/lib/couponTypes";
import {
  CHARSETS, availableTokens, barcodeCompatible, checkPattern, couponCsvTemplate, recordsFromGenerator, recordsFromTable, recordsToCsv, sampleTable,
  type CouponRecord,
} from "@/lib/couponCodes";
import { renderCoupon, couponPixelSize, sampleRecord, buildQrMatrix, type CouponAssets } from "@/lib/couponEngine";
import { couponFileName, couponSheetInfo, exportCouponPdf, exportCouponSheet, exportCouponZip } from "@/lib/couponExport";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { useImageFromDataUrl } from "@/hooks/useImageFromDataUrl";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { FontPicker } from "@/components/ui/FontPicker";
import { Label, Input, Select, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { PanelCard } from "@/components/ui/PanelCard";
import { ImageField } from "@/components/ui/ImageField";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { SettingsTabBar, NextTabHint, type SettingsTabDef } from "@/components/ui/SettingsTabs";

type TabId = "jenis" | "isi" | "tampilan" | "kode" | "massal" | "ekspor";

const TABS: SettingsTabDef<TabId>[] = [
  { id: "jenis", label: "Jenis & Template", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: "isi", label: "Isi & Teks", icon: <Type className="w-3.5 h-3.5" /> },
  { id: "tampilan", label: "Tampilan", icon: <Palette className="w-3.5 h-3.5" /> },
  { id: "kode", label: "Kode & QR", icon: <QrCode className="w-3.5 h-3.5" /> },
  { id: "massal", label: "Massal", icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "ekspor", label: "Ekspor & Daftar", icon: <Download className="w-3.5 h-3.5" /> },
];

// ── Komponen kecil ───────────────────────────────────────────────────────

function Seg<T extends string>({ value, options, onChange, testId }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; testId?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} data-testid={testId ? `${testId}-${o.id}` : undefined}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
            value === o.id ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SliderRow: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }> = ({ label, value, min, max, step = 1, suffix = "", onChange }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <Label>{label}</Label>
      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{Number.isInteger(step) ? value : value.toFixed(2)}{suffix}</span>
    </div>
    <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
  </div>
);

const ColorRow: React.FC<{ label: string; value: string; onChange: (v: string) => void; testId?: string }> = ({ label, value, onChange, testId }) => (
  <div>
    <Label>{label}</Label>
    <GamatoColorPicker value={value} onChange={onChange} testId={testId} />
  </div>
);

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }> = ({ label, checked, onChange, testId }) => (
  <GamatoCheckbox checked={checked} onChange={onChange} label={<span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>} testId={testId} />
);

const SubTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{children}</p>
);

const TemplateThumb: React.FC<{ design: CouponDesign; id: string; name: string; desc: string; active: boolean; assets: CouponAssets; onPick: () => void }> = ({ design, id, name, desc, active, assets, onPick }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = applyTemplate(design, id);
      await Promise.all([ensureFontReady(t.fontHeading, "800"), ensureFontReady(t.fontBody, "500")]);
      if (cancelled || !ref.current) return;
      renderCoupon(ref.current, t, sampleRecord(), assets, { pxPerMm: 2.2 });
    })();
    return () => { cancelled = true; };
  }, [design, id, assets]);
  return (
    <button type="button" onClick={onPick} data-testid={`tpl-${id}`} title={desc}
      className={cn("rounded-xl border-2 p-2 text-left transition-all bg-slate-50 dark:bg-slate-800/60", active ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-700 hover:border-indigo-300")}>
      <canvas ref={ref} style={{ width: "100%", height: "auto", display: "block" }} />
      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1.5 truncate">{name}</p>
    </button>
  );
};

function normalizeLoaded(raw: unknown): CouponDesign | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { gamato?: string; design?: Partial<CouponDesign> };
  if (o.gamato !== "coupon" || !o.design || typeof o.design !== "object") return null;
  const base = baseDesign();
  const merged = { ...base, ...o.design, codeGen: { ...base.codeGen, ...(o.design.codeGen ?? {}) } } as CouponDesign;
  merged.details = (Array.isArray(o.design.details) ? o.design.details : []).slice(0, 8).map((r) => ({ id: newRowId(), label: String(r?.label ?? ""), value: String(r?.value ?? "") }));
  return merged;
}

// ── Komponen utama ───────────────────────────────────────────────────────

export function CouponGenerator() {
  const history = useHistoryState<CouponDesign>(() => defaultCouponDesign());
  const d = history.state;
  const { schedule } = useDebouncedCommit(history.commit, 600);
  const up = <K extends keyof CouponDesign>(key: K, value: CouponDesign[K], opts?: { continuous?: boolean }) => {
    history.set((prev) => ({ ...prev, [key]: value }), { commit: !opts?.continuous });
    if (opts?.continuous) schedule();
  };
  const upGen = <K extends keyof CouponDesign["codeGen"]>(key: K, value: CouponDesign["codeGen"][K], opts?: { continuous?: boolean }) => {
    history.set((prev) => ({ ...prev, codeGen: { ...prev.codeGen, [key]: value } }), { commit: !opts?.continuous });
    if (opts?.continuous) schedule();
  };

  const [tab, setTab] = useState<TabId>("jenis");
  const { customFonts, isFontLoading, fontError, addCustomFont, removeCustomFont } = useCustomFonts();
  const fontProps = { customFonts, isFontLoading, fontError, onUpload: addCustomFont };

  // ── data massal ──
  const [source, setSource] = useState<"generate" | "table">("generate");
  const [records, setRecords] = useState<CouponRecord[]>(() => { try { return recordsFromGenerator(defaultCouponDesign().codeGen); } catch { return []; } });
  const [genError, setGenError] = useState<string | null>(null);
  const [tableText, setTableText] = useState("");
  const [tableInfo, setTableInfo] = useState<{ ok: boolean; msgs: string[] } | null>(null);
  const [idx, setIdx] = useState(0);
  const genKey = JSON.stringify(d.codeGen);

  useEffect(() => {
    if (source !== "generate") return;
    const t = window.setTimeout(() => {
      try {
        setRecords(recordsFromGenerator(d.codeGen));
        setGenError(null);
      } catch (e) {
        setGenError(e instanceof Error ? e.message : "Gagal membuat kode.");
      }
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genKey, source]);

  const safeIdx = Math.min(idx, Math.max(0, records.length - 1));
  const rec: CouponRecord = records[safeIdx] ?? sampleRecord();

  // ── gambar & render ──
  const logoImg = useImageFromDataUrl(d.logo);
  const bgImg = useImageFromDataUrl(d.bgImage);
  const assets = useMemo<CouponAssets>(() => ({ logo: logoImg, bg: bgImg }), [logoImg, bgImg]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([ensureFontReady(d.fontHeading, "800"), ensureFontReady(d.fontBody, "500"), ensureFontReady("JetBrains Mono", "700")]);
      if (cancelled || !canvasRef.current) return;
      renderCoupon(canvasRef.current, d, rec, assets);
    })();
    return () => { cancelled = true; };
  }, [d, rec, assets]);

  const size = couponPixelSize(d);
  const qrTooLong = (d.codeMode === "qr" || d.codeMode === "both") && !buildQrMatrix(rec.code, d.qrEcc);
  const barIncompat = d.codeMode === "barcode" || d.codeMode === "both" ? records.filter((r) => !barcodeCompatible(r.code, d.barcodeFormat)).length : 0;
  const patternCheck = useMemo(() => checkPattern(d.codeGen, Math.max(1, d.codeGen.quantity)), [d.codeGen]);

  // ── ekspor ──
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [info, setInfo] = useState<{ tone: "success" | "error" | "info"; msg: string } | null>(null);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const [sheet, setSheet] = useState({ paper: "a4" as SheetPaper, landscape: false, marginMm: 8, gapMm: 3, cropMarks: true });
  const sheetInfo = couponSheetInfo(d, sheet);
  const fileBase = sanitizeFileName(d.title || d.kind) || "kupon";

  const run = async (name: string, fn: () => Promise<void>) => {
    setInfo(null);
    setBusy(name);
    setProgress(null);
    cancelRef.current = { cancelled: false };
    try {
      await fn();
    } catch (e) {
      if (e instanceof BulkCancelled) setInfo({ tone: "info", msg: "Ekspor dibatalkan." });
      else setInfo({ tone: "error", msg: e instanceof Error ? e.message : "Terjadi kesalahan saat mengekspor." });
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };
  const common = () => ({ design: d, records, assets, signal: cancelRef.current, onProgress: (p: { done: number; total: number }) => setProgress({ done: p.done, total: p.total }) });

  const needRecords = () => {
    if (!records.length) throw new Error("Belum ada kode. Buat kode di tab Massal atau perbaiki pola kode.");
  };

  const downloadPng = () => run("png", async () => {
    if (!canvasRef.current) return;
    renderCoupon(canvasRef.current, d, rec, assets);
    downloadBlob(await canvasToBlob(canvasRef.current), couponFileName(d, rec, Math.max(records.length, 1), "png"));
    setInfo({ tone: "success", msg: "PNG berhasil diunduh." });
  });
  const downloadPdfOne = () => run("pdf1", async () => {
    const blob = await exportCouponPdf({ design: d, records: [rec], assets });
    downloadBlob(blob, couponFileName(d, rec, Math.max(records.length, 1), "pdf"));
    setInfo({ tone: "success", msg: "PDF berhasil diunduh." });
  });
  const doPrint = () => {
    try {
      if (!canvasRef.current) return;
      renderCoupon(canvasRef.current, d, rec, assets);
      printCanvasImage(canvasRef.current, { widthMm: size.wMM, title: `Cetak ${d.title || "kupon"}` });
    } catch (e) {
      setInfo({ tone: "error", msg: e instanceof Error ? e.message : "Gagal mencetak." });
    }
  };
  const doZip = () => run("zip", async () => {
    needRecords();
    const blob = await exportCouponZip(common());
    downloadBlob(blob, `${fileBase}-${records.length}-png.zip`);
    setInfo({ tone: "success", msg: `${records.length} PNG dikemas ke dalam ZIP.` });
  });
  const doPdfAll = () => run("pdf", async () => {
    needRecords();
    const blob = await exportCouponPdf(common());
    downloadBlob(blob, `${fileBase}-${records.length}.pdf`);
    setInfo({ tone: "success", msg: `PDF ${records.length} halaman berhasil dibuat.` });
  });
  const doSheet = () => run("sheet", async () => {
    needRecords();
    const r = await exportCouponSheet({ ...common(), sheet });
    downloadBlob(r.blob, `${fileBase}-lembar-cetak.pdf`);
    setInfo({ tone: "success", msg: `Lembar cetak: ${r.pages} halaman, ${r.perPage} kupon per halaman.` });
  });
  const doCsv = () => {
    if (!records.length) return;
    downloadBlob(new Blob([recordsToCsv(records)], { type: "text/csv;charset=utf-8" }), `${fileBase}-daftar-kode.csv`);
  };
  const saveDesign = () => {
    downloadBlob(new Blob([JSON.stringify({ gamato: "coupon", v: 1, design: d }, null, 2)], { type: "application/json" }), `${fileBase}-desain.json`);
  };
  const loadRef = useRef<HTMLInputElement>(null);
  const loadDesign = async (file: File | undefined) => {
    if (!file) return;
    try {
      const nd = normalizeLoaded(JSON.parse(await file.text()));
      if (!nd) throw new Error("Berkas bukan desain Kupon Gamato yang valid.");
      history.set(nd);
      setSource("generate");
      setInfo({ tone: "success", msg: "Desain dimuat." });
    } catch (e) {
      setInfo({ tone: "error", msg: e instanceof Error ? e.message : "Gagal memuat desain." });
    }
  };

  // ── tabel massal ──
  const tableFileRef = useRef<HTMLInputElement>(null);
  const processTable = (text: string) => {
    const grid = parseTable(text);
    const r = recordsFromTable(grid, d.codeGen, MAX_COUPON_ROWS);
    if (!r.records.length) {
      setTableInfo({ ok: false, msgs: r.warnings.length ? r.warnings : ["Tidak ada data yang bisa diproses."] });
      return;
    }
    setSource("table");
    setRecords(r.records);
    setIdx(0);
    setGenError(null);
    setTableInfo({ ok: true, msgs: [`${r.records.length} baris diproses. Kolom: ${r.headers.join(", ")}.`, ...r.warnings] });
  };
  const onTableFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) {
        const g = await readXlsxGrid(f);
        const t = g.map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
        setTableText(t);
        processTable(t);
      } else {
        const t = await f.text();
        setTableText(t);
        processTable(t);
      }
    } catch (e) {
      setTableInfo({ ok: false, msgs: [e instanceof Error ? e.message : "Gagal membaca berkas."] });
    }
  };

  // ── daftar kode ──
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [checkCode, setCheckCode] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => r.code.toLowerCase().includes(q) || Object.values(r.fields).some((v) => v.toLowerCase().includes(q)) || String(r.no) === q);
  }, [records, filter]);
  const PAGE = 25;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice(Math.min(page, pageCount - 1) * PAGE, Math.min(page, pageCount - 1) * PAGE + PAGE);
  const checkResult = useMemo(() => {
    const q = checkCode.trim().toLowerCase();
    if (!q) return null;
    const hit = records.find((r) => r.code.toLowerCase() === q);
    return hit ?? false;
  }, [checkCode, records]);
  const copyText = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(null), 1400); } catch { /* clipboard tidak tersedia */ }
  };

  const tokens = availableTokens(records);
  const rowEdit = (i: number, patch: Partial<{ label: string; value: string }>) =>
    history.set((prev) => ({ ...prev, details: prev.details.map((r, k) => (k === i ? { ...r, ...patch } : r)) }), { commit: false }) as void;
  const rowMove = (i: number, dir: -1 | 1) => history.set((prev) => {
    const a = [...prev.details];
    const j = i + dir;
    if (j < 0 || j >= a.length) return prev;
    [a[i], a[j]] = [a[j], a[i]];
    return { ...prev, details: a };
  });

  const LAYOUTS: { id: LayoutMode; label: string }[] = [
    { id: "value-left", label: "Nilai di kiri" }, { id: "value-center", label: "Rata tengah" }, { id: "banner-top", label: "Banner atas" },
    { id: "minimal", label: "Minimal" }, { id: "poster", label: "Poster" },
  ];
  const STUBS: { id: StubPosition; label: string }[] = [
    { id: "right", label: "Kanan" }, { id: "left", label: "Kiri" }, { id: "bottom", label: "Bawah" }, { id: "top", label: "Atas" }, { id: "none", label: "Tanpa potongan" },
  ];
  const PATTERNS: { id: PatternId; label: string }[] = [
    { id: "none", label: "Polos" }, { id: "dots", label: "Titik" }, { id: "stripes", label: "Garis miring" }, { id: "grid", label: "Kotak" }, { id: "waves", label: "Gelombang" },
    { id: "confetti", label: "Konfeti" }, { id: "circles", label: "Lingkaran" }, { id: "zigzag", label: "Zigzag" }, { id: "diamonds", label: "Berlian" },
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_440px] gap-6 items-start" data-testid="coupon-root">
      {/* ── KIRI: pengaturan ── */}
      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionBadge>Semua diproses di perangkatmu</SectionBadge>
          <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={() => history.undo()} onRedo={() => history.redo()} />
        </div>
        <SettingsTabBar tabs={TABS} active={tab} onChange={setTab} />

        {/* ===== Jenis & Template ===== */}
        {tab === "jenis" && (
          <div className="space-y-4">
            <PanelCard title="Jenis" subtitle="Memilih jenis mengisi teks, ukuran, dan pola kode bawaan — gaya visual tetap.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COUPON_KINDS.map((k) => (
                  <button key={k.id} type="button" data-testid={`kind-${k.id}`} onClick={() => history.set((p) => applyKind(p, k.id as CouponKind))}
                    className={cn("rounded-xl border-2 p-3 text-left transition-all", d.kind === k.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-indigo-300")}>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{k.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{k.desc}</p>
                  </button>
                ))}
              </div>
            </PanelCard>
            <PanelCard title="Template Gaya" subtitle="12 gaya siap pakai. Isi teks kamu tidak berubah.">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {COUPON_TEMPLATES.map((t) => (
                  <TemplateThumb key={t.id} design={d} id={t.id} name={t.name} desc={t.desc} active={d.templateId === t.id} assets={assets} onPick={() => history.set((p) => applyTemplate(p, t.id))} />
                ))}
              </div>
            </PanelCard>
            <PanelCard title="Ukuran & Struktur">
              <div className="grid sm:grid-cols-2 gap-4">
                <Select label="Ukuran" value={d.sizeId} onChange={(e) => up("sizeId", e.target.value)} data-testid="size-select">
                  {COUPON_SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
                {d.sizeId === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input id="custom-w" label="Lebar (mm)" type="number" min={40} max={300} value={d.customWMM} onChange={(e) => up("customWMM", Number(e.target.value), { continuous: true })} />
                    <Input id="custom-h" label="Tinggi (mm)" type="number" min={30} max={300} value={d.customHMM} onChange={(e) => up("customHMM", Number(e.target.value), { continuous: true })} />
                  </div>
                )}
              </div>
              <div>
                <Label>Posisi potongan (stub) berkode</Label>
                <Seg value={d.stub} options={STUBS} onChange={(v) => up("stub", v)} testId="stub" />
              </div>
              {d.stub !== "none" && <SliderRow label="Lebar potongan" value={d.stubPct} min={15} max={45} suffix="%" onChange={(v) => up("stubPct", v, { continuous: true })} />}
              <div>
                <Label>Tata letak isi</Label>
                <Seg value={d.layout} options={LAYOUTS} onChange={(v) => up("layout", v)} testId="layout" />
              </div>
            </PanelCard>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Isi & Teks ===== */}
        {tab === "isi" && (
          <div className="space-y-4">
            <PanelCard title="Identitas" subtitle="Nama penyelenggara dan logo tampil di kepala kupon.">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Nama penyelenggara / toko" value={d.brand} onChange={(e) => up("brand", e.target.value, { continuous: true })} data-testid="f-brand" />
                <Input label="Tagline" value={d.tagline} onChange={(e) => up("tagline", e.target.value, { continuous: true })} />
              </div>
              <ImageField label="Logo" value={d.logo} onChange={(v) => up("logo", v)} hint="PNG/JPG/SVG. Tampil di samping nama." testId="f-logo" />
              {d.logo && <SliderRow label="Ukuran logo" value={d.logoSize} min={0.5} max={1.6} step={0.05} suffix="×" onChange={(v) => up("logoSize", v, { continuous: true })} />}
            </PanelCard>
            <PanelCard title="Teks Utama">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Label jenis" value={d.label} onChange={(e) => up("label", e.target.value, { continuous: true })} placeholder="KUPON DISKON" data-testid="f-label" />
                <Input label="Judul" value={d.title} onChange={(e) => up("title", e.target.value, { continuous: true })} data-testid="f-title" />
                <Input label="Sub-judul" value={d.subtitle} onChange={(e) => up("subtitle", e.target.value, { continuous: true })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Nilai besar" value={d.value} onChange={(e) => up("value", e.target.value, { continuous: true })} placeholder="50% / Rp 100.000" data-testid="f-value" />
                  <Input label="Keterangan nilai" value={d.unit} onChange={(e) => up("unit", e.target.value, { continuous: true })} placeholder="DISKON" />
                </div>
              </div>
              <Textarea label="Deskripsi" rows={3} value={d.description} onChange={(e) => up("description", e.target.value, { continuous: true })} />
            </PanelCard>
            <PanelCard title="Detail" subtitle="Baris label–nilai (tanggal, lokasi, kursi, dll). Nilai kosong menjadi garis isian tulis tangan.">
              <div className="space-y-2">
                {d.details.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-2" data-testid={`detail-row-${i}`}>
                    <input aria-label={`Label detail ${i + 1}`} className="w-[34%] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" value={r.label} onChange={(e) => { rowEdit(i, { label: e.target.value }); schedule(); }} placeholder="Label" />
                    <input aria-label={`Nilai detail ${i + 1}`} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" value={r.value} onChange={(e) => { rowEdit(i, { value: e.target.value }); schedule(); }} placeholder="Nilai / {nama}" />
                    <button type="button" aria-label="Naik" onClick={() => rowMove(i, -1)} className="p-1.5 text-slate-400 hover:text-slate-700"><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" aria-label="Turun" onClick={() => rowMove(i, 1)} className="p-1.5 text-slate-400 hover:text-slate-700"><ArrowDown className="w-4 h-4" /></button>
                    <button type="button" aria-label="Hapus baris" onClick={() => history.set((p) => ({ ...p, details: p.details.filter((_, k) => k !== i) }))} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <Btn variant="secondary" disabled={d.details.length >= 8} onClick={() => history.set((p) => ({ ...p, details: [...p.details, { id: newRowId(), label: "", value: "" }] }))} data-testid="add-detail"><Plus className="w-4 h-4" />Tambah baris</Btn>
              </div>
            </PanelCard>
            <PanelCard title="Masa Berlaku">
              <div className="grid sm:grid-cols-2 gap-4">
                <Select label="Mode" value={d.validityMode} onChange={(e) => up("validityMode", e.target.value as CouponDesign["validityMode"])}>
                  <option value="none">Tidak ditampilkan</option>
                  <option value="until">Sampai tanggal</option>
                  <option value="range">Rentang tanggal</option>
                  <option value="text">Teks bebas</option>
                </Select>
                {d.validityMode !== "none" && d.validityMode !== "text" && <Input label="Awalan teks" value={d.validLabel} onChange={(e) => up("validLabel", e.target.value, { continuous: true })} />}
                {d.validityMode === "range" && <Input label="Mulai" type="date" value={d.validFrom} onChange={(e) => up("validFrom", e.target.value)} />}
                {(d.validityMode === "until" || d.validityMode === "range") && <Input label="Sampai" type="date" value={d.validUntil} onChange={(e) => up("validUntil", e.target.value)} />}
              </div>
              {d.validityMode === "text" && <Input label="Teks masa berlaku" value={d.validText} onChange={(e) => up("validText", e.target.value, { continuous: true })} placeholder="Berlaku 1–7 Januari 2027" />}
            </PanelCard>
            <PanelCard title="Syarat & Catatan">
              <Textarea label="Syarat & ketentuan (satu baris = satu poin)" rows={4} value={d.terms} onChange={(e) => up("terms", e.target.value, { continuous: true })} />
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Teks kaki (opsional)" value={d.footer} onChange={(e) => up("footer", e.target.value, { continuous: true })} />
                <Input label="Catatan di potongan" value={d.stubNote} onChange={(e) => up("stubNote", e.target.value, { continuous: true })} />
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">Semua kolom teks mendukung token yang diganti otomatis per kupon. Klik untuk menyalin:</p>
                <div className="flex flex-wrap gap-1.5">
                  {tokens.map((t) => (
                    <button key={t} type="button" onClick={() => copyText(`{${t}}`, t)} className="font-mono text-[11px] px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-300 hover:border-indigo-400">
                      {copied === t ? "Disalin ✓" : `{${t}}`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">Kolom tabel di tab Massal otomatis menjadi token, mis. kolom <b>Nama</b> → <code>{"{nama}"}</code>.</p>
              </div>
            </PanelCard>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Tampilan ===== */}
        {tab === "tampilan" && (
          <div className="space-y-4">
            <PanelCard title="Warna & Latar">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <ColorRow label="Aksen" value={d.colorAccent} onChange={(v) => up("colorAccent", v)} testId="c-accent" />
                <ColorRow label="Teks" value={d.colorText} onChange={(v) => up("colorText", v)} testId="c-text" />
                <ColorRow label="Latar 1" value={d.colorBg1} onChange={(v) => up("colorBg1", v)} testId="c-bg1" />
              </div>
              <div>
                <Label>Jenis latar</Label>
                <Seg value={d.bgMode} options={[{ id: "solid", label: "Warna polos" }, { id: "gradient", label: "Gradasi" }, { id: "image", label: "Gambar" }]} onChange={(v) => up("bgMode", v)} testId="bgmode" />
              </div>
              {d.bgMode === "gradient" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <ColorRow label="Latar 2" value={d.colorBg2} onChange={(v) => up("colorBg2", v)} />
                  <SliderRow label="Sudut gradasi" value={d.gradAngle} min={0} max={360} suffix="°" onChange={(v) => up("gradAngle", v, { continuous: true })} />
                </div>
              )}
              {d.bgMode === "image" && (
                <div className="space-y-3">
                  <ImageField label="Gambar latar" value={d.bgImage} onChange={(v) => up("bgImage", v)} hint="Diisi memenuhi kupon. Atur lapisan agar teks tetap terbaca." testId="f-bgimage" />
                  <SliderRow label="Lapisan warna latar" value={d.bgImageOverlay} min={0} max={0.95} step={0.05} onChange={(v) => up("bgImageOverlay", v, { continuous: true })} />
                </div>
              )}
              <div>
                <Label>Warna potongan (stub)</Label>
                <Seg value={d.stubTone} options={[{ id: "same", label: "Sama dengan latar" }, { id: "accent", label: "Aksen" }, { id: "dark", label: "Gelap" }, { id: "light", label: "Terang" }]} onChange={(v) => up("stubTone", v)} testId="stubtone" />
              </div>
            </PanelCard>
            <PanelCard title="Pola Latar">
              <Seg value={d.pattern} options={PATTERNS} onChange={(v) => up("pattern", v)} testId="pattern" />
              {d.pattern !== "none" && (
                <div className="grid sm:grid-cols-3 gap-4">
                  <ColorRow label="Warna pola" value={d.patternColor} onChange={(v) => up("patternColor", v)} />
                  <SliderRow label="Kepekatan" value={d.patternOpacity} min={0.02} max={0.6} step={0.01} onChange={(v) => up("patternOpacity", v, { continuous: true })} />
                  <SliderRow label="Skala" value={d.patternScale} min={0.5} max={2.5} step={0.1} suffix="×" onChange={(v) => up("patternScale", v, { continuous: true })} />
                </div>
              )}
            </PanelCard>
            <PanelCard title="Bingkai & Bentuk">
              <div>
                <Label>Bingkai</Label>
                <Seg value={d.borderStyle} options={[{ id: "none", label: "Tanpa" }, { id: "solid", label: "Garis" }, { id: "double", label: "Ganda" }, { id: "dashed", label: "Putus-putus" }, { id: "inset", label: "Garis dalam" }]} onChange={(v) => up("borderStyle", v)} testId="border" />
              </div>
              {d.borderStyle !== "none" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <ColorRow label="Warna bingkai" value={d.borderColor} onChange={(v) => up("borderColor", v)} />
                  <SliderRow label="Tebal bingkai" value={d.borderWidth} min={0.15} max={1.5} step={0.05} suffix=" mm" onChange={(v) => up("borderWidth", v, { continuous: true })} />
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-4">
                <SliderRow label="Sudut membulat" value={d.radius} min={0} max={14} step={0.5} suffix=" mm" onChange={(v) => up("radius", v, { continuous: true })} />
                <div>
                  <Label>Tepi kupon</Label>
                  <Seg value={d.edge} options={[{ id: "plain", label: "Rata" }, { id: "scallop", label: "Bergelombang" }, { id: "zigzag", label: "Bergerigi" }]} onChange={(v) => up("edge", v)} testId="edge" />
                </div>
              </div>
              {d.stub !== "none" && (
                <div className="grid sm:grid-cols-2 gap-4 items-end">
                  <Toggle label="Lubang notch di garis sobek" checked={d.notch} onChange={(v) => up("notch", v)} testId="notch" />
                  {d.notch && <SliderRow label="Ukuran notch" value={d.notchRadius} min={1} max={6} step={0.2} suffix=" mm" onChange={(v) => up("notchRadius", v, { continuous: true })} />}
                </div>
              )}
            </PanelCard>
            <PanelCard title="Font & Ukuran Teks">
              <div className="grid sm:grid-cols-2 gap-4">
                <FontPicker label="Font judul & nilai" value={d.fontHeading} onChange={(v) => up("fontHeading", v)} onRemoveCustomFont={(id) => removeCustomFont(id, (fb) => { if (d.fontHeading === id) up("fontHeading", fb); if (d.fontBody === id) up("fontBody", fb); })} {...fontProps} />
                <FontPicker label="Font isi" value={d.fontBody} onChange={(v) => up("fontBody", v)} onRemoveCustomFont={() => undefined} hideUpload {...fontProps} />
              </div>
              <SliderRow label="Ukuran teks" value={d.textScale} min={0.7} max={1.4} step={0.05} suffix="×" onChange={(v) => up("textScale", v, { continuous: true })} />
            </PanelCard>
            <PanelCard title="Stempel Diagonal" subtitle="Mis. CONTOH, LUNAS, VIP, SPECIMEN. Kosongkan untuk menonaktifkan.">
              <div className="grid sm:grid-cols-3 gap-4 items-end">
                <Input label="Teks stempel" value={d.stampText} onChange={(e) => up("stampText", e.target.value, { continuous: true })} placeholder="CONTOH" data-testid="f-stamp" />
                <ColorRow label="Warna" value={d.stampColor} onChange={(v) => up("stampColor", v)} />
                <SliderRow label="Kepekatan" value={d.stampOpacity} min={0.05} max={0.9} step={0.05} onChange={(v) => up("stampOpacity", v, { continuous: true })} />
              </div>
            </PanelCard>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Kode & QR ===== */}
        {tab === "kode" && (
          <div className="space-y-4">
            <PanelCard title="Tampilan Kode">
              <div>
                <Label>Bentuk kode</Label>
                <Seg value={d.codeMode} options={[{ id: "qr", label: "QR" }, { id: "barcode", label: "Barcode" }, { id: "both", label: "QR + Barcode" }, { id: "text", label: "Teks saja" }, { id: "none", label: "Tanpa kode" }]} onChange={(v) => up("codeMode", v)} testId="codemode" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Judul di atas kode" value={d.codeLabel} onChange={(e) => up("codeLabel", e.target.value, { continuous: true })} />
                <div className="space-y-2 pt-6">
                  <Toggle label="Tampilkan teks kode" checked={d.showCodeText} onChange={(v) => up("showCodeText", v)} testId="showcode" />
                  <Toggle label="Nomor seri vertikal di tepi potongan" checked={d.showSerial} onChange={(v) => up("showSerial", v)} testId="serial" />
                </div>
              </div>
              {(d.codeMode === "qr" || d.codeMode === "both") && (
                <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <SubTitle>Pengaturan QR</SubTitle>
                  <Input label="Isi QR" value={d.qrPayload} onChange={(e) => up("qrPayload", e.target.value, { continuous: true })} placeholder="{kode}  atau  https://toko.com/tukar?c={kode}" data-testid="f-qrpayload" />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><Label>Koreksi kesalahan</Label><Seg value={d.qrEcc} options={[{ id: "L", label: "L 7%" }, { id: "M", label: "M 15%" }, { id: "Q", label: "Q 25%" }, { id: "H", label: "H 30%" }]} onChange={(v) => up("qrEcc", v)} /></div>
                    <div><Label>Gaya modul</Label><Seg value={d.qrStyle} options={[{ id: "square", label: "Kotak" }, { id: "rounded", label: "Membulat" }, { id: "dots", label: "Titik" }]} onChange={(v) => up("qrStyle", v)} /></div>
                    <ColorRow label="Warna QR" value={d.qrColor} onChange={(v) => up("qrColor", v)} />
                    <div className="pt-6"><Toggle label="Alas putih di belakang QR (disarankan)" checked={d.qrPlate} onChange={(v) => up("qrPlate", v)} /></div>
                  </div>
                  <p className="text-[11px] text-slate-400">Isi QR memakai token yang sama, mis. <code>{"https://toko.com/tukar?c={kode}"}</code>. Pindai hasil cetak sebelum mencetak banyak.</p>
                  {qrTooLong && <GamatoInlineAlert tone="warning" message={<>Isi QR terlalu panjang untuk dikodekan — dipakai tampilan teks.</>} />}
                </div>
              )}
              {(d.codeMode === "barcode" || d.codeMode === "both") && (
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <SubTitle>Pengaturan Barcode</SubTitle>
                  <Select label="Format" value={d.barcodeFormat} onChange={(e) => up("barcodeFormat", e.target.value as CouponDesign["barcodeFormat"])}>
                    <option value="CODE128">CODE 128 (semua karakter ASCII)</option>
                    <option value="CODE39">CODE 39 (A–Z, 0–9, - . $ / + % spasi)</option>
                  </Select>
                  {barIncompat > 0 && <GamatoInlineAlert tone="warning" message={<>{barIncompat} kode memuat karakter yang tidak didukung format ini — barcode dilewati untuk kupon tersebut.</>} />}
                </div>
              )}
            </PanelCard>
            <PanelCard title="Pola Kode Otomatis" subtitle="Kode dibuat unik dan acak aman (Web Crypto).">
              <Input label="Pola" value={d.codeGen.pattern} onChange={(e) => upGen("pattern", e.target.value, { continuous: true })} className="font-mono" data-testid="f-pattern" />
              <div className="flex flex-wrap gap-1.5">
                {["KPN-{RAND:4}-{RAND:4}", "VCR-{RAND:4}-{RAND:4}-{RAND:4}", "TKT-{SEQ:5}-{RAND:4}", "{YY}{MM}-{SEQ:4}-{CHK}", "GMT{NUM:8}", "{SEQ:6}"].map((p) => (
                  <button key={p} type="button" onClick={() => upGen("pattern", p)} className="font-mono text-[11px] px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400">{p}</button>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Select label="Set karakter {RAND}" value={d.codeGen.charset} onChange={(e) => upGen("charset", e.target.value as CouponDesign["codeGen"]["charset"])}>
                  {(Object.keys(CHARSETS) as (keyof typeof CHARSETS)[]).map((k) => <option key={k} value={k}>{CHARSETS[k].label}</option>)}
                </Select>
                <div className="pt-6"><Toggle label="Huruf besar" checked={d.codeGen.uppercase} onChange={(v) => upGen("uppercase", v)} /></div>
                <Input label="Nomor urut awal" type="number" value={d.codeGen.seqStart} onChange={(e) => upGen("seqStart", Math.max(0, Math.floor(Number(e.target.value) || 0)), { continuous: true })} />
                <Input label="Langkah urut" type="number" value={d.codeGen.seqStep} onChange={(e) => upGen("seqStep", Math.max(0, Math.floor(Number(e.target.value) || 0)), { continuous: true })} />
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p><b>Token:</b> <code>{"{RAND:n}"}</code> acak · <code>{"{NUM:n}"}</code> angka · <code>{"{ALPHA:n}"}</code> huruf · <code>{"{HEX:n}"}</code> heksa · <code>{"{SEQ:n}"}</code> urut · <code>{"{CHK}"}</code> karakter cek · <code>{"{YYYY} {YY} {MM} {DD}"}</code> tanggal</p>
                <p>Contoh hasil: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300" data-testid="pattern-sample">{patternCheck.sample || "—"}</span></p>
              </div>
              {patternCheck.message && <GamatoInlineAlert tone="warning" message={<>{patternCheck.message}</>} />}
            </PanelCard>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Massal ===== */}
        {tab === "massal" && (
          <div className="space-y-4">
            <PanelCard title="Sumber Data" subtitle={`Hingga ${MAX_COUPON_ROWS.toLocaleString("id-ID")} kupon sekali proses.`}>
              <Seg value={source} options={[{ id: "generate", label: "Buat otomatis dari pola" }, { id: "table", label: "Impor tabel (CSV / Excel / tempel)" }]}
                onChange={(v) => { setSource(v); if (v === "table" && tableText.trim()) processTable(tableText); setIdx(0); }} testId="source" />
              {source === "generate" ? (
                <div className="space-y-4">
                  <SliderRow label="Jumlah kupon" value={d.codeGen.quantity} min={1} max={MAX_COUPON_ROWS} suffix=" lembar" onChange={(v) => upGen("quantity", v, { continuous: true })} />
                  <div className="flex items-center gap-3 flex-wrap">
                    <Input type="number" min={1} max={MAX_COUPON_ROWS} value={d.codeGen.quantity} onChange={(e) => upGen("quantity", Math.min(MAX_COUPON_ROWS, Math.max(1, Math.floor(Number(e.target.value) || 1))), { continuous: true })} className="w-32" data-testid="f-qty" />
                    <Btn variant="secondary" onClick={() => { try { setRecords(recordsFromGenerator(d.codeGen)); setGenError(null); } catch (e) { setGenError(e instanceof Error ? e.message : "Gagal"); } }} data-testid="regen"><Shuffle className="w-4 h-4" />Acak ulang kode</Btn>
                  </div>
                  {genError && <GamatoInlineAlert tone="error" message={<>{genError}</>} />}
                  <p className="text-xs text-slate-500">Setiap kupon mendapat kode unik. Token <code>{"{no}"}</code> dan <code>{"{kode}"}</code> bisa dipakai di semua kolom teks.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea label="Tempel tabel (baris pertama = judul kolom)" rows={7} value={tableText} onChange={(e) => setTableText(e.target.value)} placeholder={sampleTable()} className="font-mono text-xs" data-testid="table-input" />
                  <div className="flex flex-wrap gap-2">
                    <Btn onClick={() => processTable(tableText)} disabled={!tableText.trim()} data-testid="table-process"><Table2 className="w-4 h-4" />Proses tabel</Btn>
                    <Btn variant="secondary" onClick={() => tableFileRef.current?.click()}><Upload className="w-4 h-4" />Impor berkas</Btn>
                    <Btn variant="ghost" onClick={() => setTableText(sampleTable())} data-testid="table-sample">Isi contoh</Btn>
                    <Btn variant="ghost" onClick={() => downloadBlob(new Blob(["\uFEFF" + couponCsvTemplate()], { type: "text/csv;charset=utf-8" }), "template-kupon.csv")}>Unduh template CSV</Btn>
                    <input ref={tableFileRef} type="file" accept=".csv,.tsv,.txt,.xlsx" className="hidden" data-testid="table-file" onChange={(e) => { void onTableFile(e.target.files?.[0]); e.target.value = ""; }} />
                  </div>
                  <p className="text-xs text-slate-500">Judul kolom menjadi token: kolom <b>Nama</b> → <code>{"{nama}"}</code>, <b>Kursi</b> → <code>{"{kursi}"}</code>. Kolom <b>kode</b> bila ada dipakai sebagai kode kupon; baris tanpa kode otomatis diberi kode dari pola.</p>
                  {tableInfo && (
                    <GamatoInlineAlert tone={tableInfo.ok ? "success" : "error"} message={<>
                      <span data-testid="table-info">{tableInfo.msgs.join(" ")}</span>
                    </>} />
                  )}
                </div>
              )}
            </PanelCard>
            <PanelCard title="Pratinjau Per Kupon" subtitle="Lihat hasil tiap kupon di pratinjau kanan.">
              <div className="flex items-center gap-2">
                <Btn variant="secondary" onClick={() => setIdx(Math.max(0, safeIdx - 1))} disabled={safeIdx <= 0} aria-label="Sebelumnya"><ChevronLeft className="w-4 h-4" /></Btn>
                <Input type="number" min={1} max={Math.max(1, records.length)} value={safeIdx + 1} onChange={(e) => setIdx(Math.min(Math.max(0, records.length - 1), Math.max(0, Math.floor(Number(e.target.value) || 1) - 1)))} className="w-24 text-center" />
                <span className="text-sm text-slate-500">dari {records.length}</span>
                <Btn variant="secondary" onClick={() => setIdx(Math.min(records.length - 1, safeIdx + 1))} disabled={safeIdx >= records.length - 1} aria-label="Berikutnya"><ChevronRight className="w-4 h-4" /></Btn>
              </div>
            </PanelCard>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Ekspor & Daftar ===== */}
        {tab === "ekspor" && (
          <div className="space-y-4">
            <PanelCard title="Ekspor" subtitle={`${records.length} kupon · ${size.wMM}×${size.hMM} mm · ${size.w}×${size.h} px`}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Btn onClick={doZip} disabled={!!busy || !records.length} data-testid="exp-zip"><FileArchive className="w-4 h-4" />ZIP semua PNG</Btn>
                <Btn onClick={doPdfAll} disabled={!!busy || !records.length} data-testid="exp-pdf"><FileText className="w-4 h-4" />PDF (1 kupon / halaman)</Btn>
                <Btn variant="secondary" onClick={doCsv} disabled={!records.length} data-testid="exp-csv"><Table2 className="w-4 h-4" />CSV daftar kode</Btn>
                <Btn variant="secondary" onClick={saveDesign} data-testid="exp-save"><Save className="w-4 h-4" />Simpan desain (.json)</Btn>
              </div>
              <Btn variant="ghost" onClick={() => loadRef.current?.click()}><FolderOpen className="w-4 h-4" />Muat desain (.json)</Btn>
              <input ref={loadRef} type="file" accept="application/json,.json" className="hidden" data-testid="load-design" onChange={(e) => { void loadDesign(e.target.files?.[0]); e.target.value = ""; }} />
              {busy && (
                <div className="space-y-2" data-testid="progress">
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress ? (progress.done / Math.max(1, progress.total)) * 100 : 8}%` }} /></div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Memproses {progress ? `${progress.done} / ${progress.total}` : "…"}</span>
                    <button type="button" onClick={() => { cancelRef.current.cancelled = true; }} className="font-semibold text-red-500 hover:text-red-700" data-testid="cancel">Batal</button>
                  </div>
                </div>
              )}
              {info && <GamatoInlineAlert tone={info.tone} message={<><span data-testid="exp-info">{info.msg}</span></>} />}
            </PanelCard>
            <PanelCard title="Lembar Cetak" subtitle="Susun banyak kupon per halaman dengan tanda potong — hemat kertas.">
              <div className="grid sm:grid-cols-2 gap-4">
                <Select label="Kertas" value={sheet.paper} onChange={(e) => setSheet({ ...sheet, paper: e.target.value as SheetPaper })}>
                  <option value="a4">A4</option><option value="letter">Letter</option><option value="a3">A3</option>
                </Select>
                <div className="pt-6"><Toggle label="Kertas lanskap" checked={sheet.landscape} onChange={(v) => setSheet({ ...sheet, landscape: v })} testId="sheet-landscape" /></div>
                <Input label="Margin (mm)" type="number" min={0} max={40} value={sheet.marginMm} onChange={(e) => setSheet({ ...sheet, marginMm: Math.max(0, Number(e.target.value) || 0) })} />
                <Input label="Jarak antar kupon (mm)" type="number" min={0} max={30} value={sheet.gapMm} onChange={(e) => setSheet({ ...sheet, gapMm: Math.max(0, Number(e.target.value) || 0) })} />
              </div>
              <Toggle label="Tanda potong di sudut" checked={sheet.cropMarks} onChange={(v) => setSheet({ ...sheet, cropMarks: v })} />
              <p className="text-xs text-slate-500" data-testid="sheet-info">{sheetInfo.perPage > 0 ? `${sheetInfo.cols} kolom × ${sheetInfo.rows} baris = ${sheetInfo.perPage} kupon per halaman → ${Math.ceil(records.length / sheetInfo.perPage)} halaman.` : "Kupon tidak muat di halaman ini — kecilkan margin atau putar kertas."}</p>
              <Btn onClick={doSheet} disabled={!!busy || !records.length || sheetInfo.perPage < 1} data-testid="exp-sheet"><Grid3x3 className="w-4 h-4" />Unduh lembar cetak PDF</Btn>
            </PanelCard>
            <PanelCard title="Daftar Kode" subtitle="Cari, salin, atau periksa keaslian kode.">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} placeholder="Cari kode / nama…" className="pl-9" data-testid="list-filter" />
                </div>
                <Input value={checkCode} onChange={(e) => setCheckCode(e.target.value)} placeholder="Periksa kode (tempel di sini)" className="font-mono" data-testid="check-input" />
              </div>
              {checkResult !== null && (
                <div data-testid="check-result" className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold", checkResult ? "border-green-200 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400" : "border-red-200 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400")}>
                  {checkResult ? <><Check className="w-4 h-4" />Kode valid — kupon nomor {checkResult.no}{Object.values(checkResult.fields)[0] ? ` (${Object.values(checkResult.fields)[0]})` : ""}</> : <><X className="w-4 h-4" />Kode tidak ditemukan dalam daftar ini</>}
                </div>
              )}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs" data-testid="code-table">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500"><tr><th className="text-left px-3 py-2">No</th><th className="text-left px-3 py-2">Kode</th><th className="text-left px-3 py-2">Data</th><th /></tr></thead>
                  <tbody>
                    {pageRows.map((r) => (
                      <tr key={`${r.no}-${r.code}`} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-1.5 tabular-nums text-slate-500">{r.no}</td>
                        <td className="px-3 py-1.5 font-mono font-bold text-slate-800 dark:text-slate-100">{r.code}</td>
                        <td className="px-3 py-1.5 text-slate-500 truncate max-w-[220px]">{Object.values(r.fields).filter(Boolean).join(" · ")}</td>
                        <td className="px-2 py-1.5 text-right"><button type="button" aria-label={`Salin ${r.code}`} onClick={() => copyText(r.code, r.code)} className="text-slate-400 hover:text-indigo-600">{copied === r.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}</button></td>
                      </tr>
                    ))}
                    {!pageRows.length && <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">Tidak ada kode.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{filtered.length} kode</span>
                <div className="flex items-center gap-2">
                  <Btn variant="secondary" className="px-2.5 py-1.5" onClick={() => setPage(Math.max(0, Math.min(page, pageCount - 1) - 1))} disabled={page <= 0} aria-label="Halaman sebelumnya"><ChevronLeft className="w-4 h-4" /></Btn>
                  <span>Hal. {Math.min(page, pageCount - 1) + 1} / {pageCount}</span>
                  <Btn variant="secondary" className="px-2.5 py-1.5" onClick={() => setPage(Math.min(pageCount - 1, page + 1))} disabled={page >= pageCount - 1} aria-label="Halaman berikutnya"><ChevronRight className="w-4 h-4" /></Btn>
                </div>
              </div>
              <Btn variant="ghost" onClick={() => copyText(records.map((r) => r.code).join("\n"), "all")} disabled={!records.length}><Copy className="w-4 h-4" />{copied === "all" ? "Semua kode disalin ✓" : "Salin semua kode"}</Btn>
            </PanelCard>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}
      </div>

      {/* ── KANAN: pratinjau ── */}
      <PreviewJumpFab targetId="kupon-preview" />
      <div id="kupon-preview" className="lg:sticky lg:top-20 scroll-mt-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin] space-y-3 min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 text-center">Pratinjau Real-time</p>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%),linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%)] dark:bg-none dark:bg-slate-800 bg-[length:16px_16px] bg-[position:0_0,8px_8px] bg-slate-100 p-4 flex items-center justify-center">
          <canvas ref={canvasRef} data-testid="coupon-canvas" style={{ width: "100%", height: "auto", maxWidth: Math.min(size.w, 560), display: "block", filter: "drop-shadow(0 6px 14px rgba(15,23,42,0.18))" }} />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>{size.wMM} × {size.hMM} mm</span>
          <span data-testid="preview-code" className="font-mono font-bold text-slate-700 dark:text-slate-200 truncate max-w-[60%]">#{rec.no} · {rec.code}</span>
        </div>
        {records.length > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Btn variant="secondary" className="px-3 py-1.5" onClick={() => setIdx(Math.max(0, safeIdx - 1))} disabled={safeIdx <= 0} aria-label="Kupon sebelumnya" data-testid="prev"><ChevronLeft className="w-4 h-4" /></Btn>
            <span className="text-xs text-slate-500 tabular-nums" data-testid="idx-label">{safeIdx + 1} / {records.length}</span>
            <Btn variant="secondary" className="px-3 py-1.5" onClick={() => setIdx(Math.min(records.length - 1, safeIdx + 1))} disabled={safeIdx >= records.length - 1} aria-label="Kupon berikutnya" data-testid="next"><ChevronRight className="w-4 h-4" /></Btn>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Btn onClick={downloadPng} disabled={!!busy} className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:text-white px-3" data-testid="dl-png"><Download className="w-4 h-4" />PNG</Btn>
          <Btn variant="secondary" onClick={downloadPdfOne} disabled={!!busy} className="px-3" data-testid="dl-pdf"><FileText className="w-4 h-4" />PDF</Btn>
          <Btn variant="secondary" onClick={doPrint} className="px-3" data-testid="dl-print"><Printer className="w-4 h-4" />Cetak</Btn>
        </div>
        {tab !== "ekspor" && info && <GamatoInlineAlert tone={info.tone} message={<>{info.msg}</>} />}
        {tab !== "ekspor" && busy && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Memproses…</p>}
        <p className="text-[11px] text-slate-400 text-center"><Ticket className="w-3 h-3 inline mr-1" />Unduhan massal ada di tab “Ekspor & Daftar”.</p>
      </div>
    </div>
  );
}
