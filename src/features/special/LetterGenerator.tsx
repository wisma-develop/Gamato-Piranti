import React, { useEffect, useMemo, useRef, useState } from "react";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { PreviewJumpFab } from "@/components/ui/PreviewJumpFab";
import {
  FileText, Download, Printer, Loader2, Copy, Plus, Trash2, Table2, Upload, FolderOpen, Save, FileArchive, ZoomIn, ZoomOut,
  LayoutTemplate, Building2, PenLine, Palette, Layers, Check, FileType2, ClipboardCopy, Type as TypeIcon, Stamp,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { ensureFontReady } from "@/lib/businessDocCanvas";
import { printCanvasPages } from "@/lib/printCanvas";
import { readXlsxGrid } from "@/lib/officeReaders";
import { parseTable as parseGrid, BulkCancelled } from "@/lib/businessCardBulk";
import { slugKey } from "@/lib/couponCodes";
import { todayISODate } from "@/lib/dateFormat";
import { renderLetter, type LetterAssets } from "@/lib/letterEngine";
import { letterToDocx } from "@/lib/letterDocx";
import { exportMergedPdf, exportZip, pagesToPdf, pagesToPngZip } from "@/lib/letterExport";
import { LETTER_TEMPLATES, TEMPLATE_CATEGORIES, applyLetterTemplate, letterTemplateById, type TemplateCategory } from "@/lib/letterTemplates";
import {
  PAPERS, blankLetter, buildVars, formatNomor, letterToText, newId, newSigner, paperSpec, signerCount, usedVarKeys,
  type KopLine, type KopStyle, type LetterBlock, type LetterDoc, type PageNumMode, type SignLayout,
} from "@/lib/letterTypes";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { useImageFromDataUrl } from "@/hooks/useImageFromDataUrl";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { useAutosave, useDraft } from "@/hooks/useAutosave";
import { mergeDraft } from "@/lib/draftStorage";
import { AutosaveBar } from "@/components/ui/AutosaveBar";
import { FontPicker } from "@/components/ui/FontPicker";
import { Label, Input, Select, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { PanelCard } from "@/components/ui/PanelCard";
import { ImageField } from "@/components/ui/ImageField";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { SettingsTabBar, NextTabHint, type SettingsTabDef } from "@/components/ui/SettingsTabs";
import { LetterBlocksEditor } from "@/features/special/LetterBlocksEditor";
import { copyText } from "@/lib/permissions";
import { tr } from "@/i18n";

type TabId = "template" | "kop" | "isi" | "ttd" | "tampilan" | "massal" | "ekspor";

const TABS: SettingsTabDef<TabId>[] = [
  { id: "template", label: tr("Template & Isi Cepat"), icon: <LayoutTemplate className="w-3.5 h-3.5" /> },
  { id: "kop", label: tr("Kop & Surat"), icon: <Building2 className="w-3.5 h-3.5" /> },
  { id: "isi", label: tr("Isi Surat"), icon: <TypeIcon className="w-3.5 h-3.5" /> },
  { id: "ttd", label: tr("Tanda Tangan"), icon: <PenLine className="w-3.5 h-3.5" /> },
  { id: "tampilan", label: tr("Tampilan"), icon: <Palette className="w-3.5 h-3.5" /> },
  { id: "massal", label: tr("Surat Massal"), icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "ekspor", label: tr("Ekspor"), icon: <Download className="w-3.5 h-3.5" /> },
];

const MAX_ROWS = 300;
const BUILTIN_VARS = ["tanggal", "tanggal_pendek", "hari", "kota", "tahun", "bulan", "bulan_romawi", "nomor", "perihal", "lampiran", "instansi", "jabatan", "penandatangan"];

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

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; testId?: string }> = ({ label, checked, onChange, testId }) => (
  <GamatoCheckbox checked={checked} onChange={onChange} label={<span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>} testId={testId} />
);

const PageView: React.FC<{ src: HTMLCanvasElement; index: number }> = ({ src, index }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = src.width;
    c.height = src.height;
    c.getContext("2d")!.drawImage(src, 0, 0);
  }, [src]);
  return <canvas ref={ref} data-testid={`letter-page-${index}`} className="w-full h-auto bg-white shadow-lg ring-1 ring-slate-200 dark:ring-slate-700" />;
};

/** Memuat gambar tanda tangan tiap penanda tangan (data-URL → HTMLImageElement). */
function useSignerImages(signers: LetterDoc["signers"]): Record<string, HTMLImageElement | null> {
  const [map, setMap] = useState<Record<string, HTMLImageElement | null>>({});
  const key = signers.map((s) => `${s.id}:${s.image ? s.image.length : 0}:${s.image ? s.image.slice(-24) : ""}`).join("|");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(signers.map(async (s) => {
        if (!s.image) return [s.id, null] as const;
        const img = new Image();
        img.src = s.image;
        try { await img.decode(); return [s.id, img] as const; } catch { return [s.id, null] as const; }
      }));
      if (!cancelled) setMap(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return map;
}

function normalizeLoaded(raw: unknown): LetterDoc | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { gamato?: string; doc?: Partial<LetterDoc> };
  if (o.gamato !== "letter" || !o.doc || typeof o.doc !== "object") return null;
  const base = blankLetter();
  const d = { ...base, ...o.doc } as LetterDoc;
  d.blocks = (Array.isArray(o.doc.blocks) ? o.doc.blocks : base.blocks).map((b) => ({ ...b, id: newId(), rows: b.rows?.map((r) => ({ ...r, id: newId("d") })) }));
  d.signers = (Array.isArray(o.doc.signers) && o.doc.signers.length ? o.doc.signers : base.signers).map((s) => ({ ...newSigner(), ...s }));
  d.vars = { ...(o.doc.vars ?? {}) };
  d.customVars = Array.isArray(o.doc.customVars) ? o.doc.customVars.map((r) => ({ ...r, id: newId("d") })) : [];
  return d;
}

const DRAFT_KEY = "gamato.draft.letter";

export function LetterGenerator() {
  const draft = useDraft<LetterDoc>(DRAFT_KEY);
  const history = useHistoryState<LetterDoc>(() => mergeDraft<LetterDoc>(applyLetterTemplate(blankLetter(), "dinas"), draft?.data));
  const autosave = useAutosave({ key: DRAFT_KEY, value: history.state, restored: !!draft });
  const doc = history.state;
  const { schedule } = useDebouncedCommit(history.commit, 600);
  const up = <K extends keyof LetterDoc>(key: K, value: LetterDoc[K], opts?: { continuous?: boolean }) => {
    history.set((p) => ({ ...p, [key]: value }), { commit: !opts?.continuous });
    if (opts?.continuous) schedule();
  };
  const upSigner = (i: number, patch: Partial<LetterDoc["signers"][number]>, continuous = true) => {
    history.set((p) => ({ ...p, signers: p.signers.map((s, k) => (k === i ? { ...s, ...patch } : s)) }), { commit: !continuous });
    if (continuous) schedule();
  };

  const [tab, setTab] = useState<TabId>("template");
  const [cat, setCat] = useState<TemplateCategory | "Semua">("Semua");
  const { customFonts, isFontLoading, fontError, addCustomFont, removeCustomFont } = useCustomFonts();
  const fontProps = { customFonts, isFontLoading, fontError, onUpload: addCustomFont };

  const template = letterTemplateById(doc.templateId);
  const fields = template.fields;

  // ── surat massal ──
  const [mergeText, setMergeText] = useState("");
  const [mergeRows, setMergeRows] = useState<Record<string, string>[]>([]);
  const [mergeHeaders, setMergeHeaders] = useState<string[]>([]);
  const [mergeInfo, setMergeInfo] = useState<{ ok: boolean; msg: string } | null>(null);
  const [rowOn, setRowOn] = useState(false);
  const [rowIdx, setRowIdx] = useState(0);
  const [nameKey, setNameKey] = useState("");
  const safeRow = Math.min(rowIdx, Math.max(0, mergeRows.length - 1));
  const activeRow = rowOn && mergeRows.length ? mergeRows[safeRow] : undefined;

  const vars = useMemo(() => buildVars(doc, fields, activeRow, doc.noUrut + (activeRow ? safeRow : 0)), [doc, fields, activeRow, safeRow]);

  // ── aset gambar & render ──
  const logoImg = useImageFromDataUrl(doc.kopLogo);
  const stampImg = useImageFromDataUrl(doc.stampImage);
  const sigImgs = useSignerImages(doc.signers);
  const assets = useMemo<LetterAssets>(() => ({ logo: logoImg, stamp: stampImg, sigs: sigImgs }), [logoImg, stampImg, sigImgs]);

  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(async () => {
      await Promise.all([ensureFontReady(doc.fontFamily, "400"), ensureFontReady(doc.fontFamily, "700"), ensureFontReady(doc.fontHeading, "700")]);
      if (cancelled) return;
      try {
        setPages(renderLetter(doc, vars, assets, { dpi: 120 }).pages);
        setRenderError(null);
      } catch (e) {
        setRenderError(e instanceof Error ? e.message : tr("Gagal menyusun surat."));
      }
    }, 140);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [doc, vars, assets]);

  // ── ekspor ──
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [info, setInfo] = useState<{ tone: "success" | "error" | "info"; msg: string } | null>(null);
  const [exportDpi, setExportDpi] = useState(200);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const fileBase = sanitizeFileName(doc.perihal ? `${template.name} ${vars.perihal}` : template.name) || "surat";

  const run = async (name: string, fn: () => Promise<void>) => {
    setInfo(null); setBusy(name); setProgress(null);
    cancelRef.current = { cancelled: false };
    try { await fn(); }
    catch (e) {
      if (e instanceof BulkCancelled) setInfo({ tone: "info", msg: tr("Ekspor dibatalkan.") });
      else setInfo({ tone: "error", msg: e instanceof Error ? e.message : tr("Terjadi kesalahan saat mengekspor.") });
    } finally { setBusy(null); setProgress(null); }
  };
  const hiRes = () => renderLetter(doc, vars, assets, { dpi: exportDpi }).pages;
  const bulkOpts = () => ({ doc, fields, assets, dpi: Math.min(exportDpi, 150), signal: cancelRef.current, onProgress: (p: { done: number; total: number }) => setProgress(p) });

  const dlPdf = () => run("pdf", async () => { downloadBlob(await pagesToPdf(hiRes(), doc, fileBase), `${fileBase}.pdf`); setInfo({ tone: "success", msg: tr("PDF berhasil diunduh.") }); });
  const dlPng = () => run("png", async () => {
    const pgs = hiRes();
    downloadBlob(await pagesToPngZip(pgs, fileBase), `${fileBase}-png.zip`);
    setInfo({ tone: "success", msg: tr("{0} halaman PNG dikemas ke ZIP.", pgs.length) });
  });
  const dlDocx = () => run("docx", async () => { downloadBlob(await letterToDocx(doc, vars, assets), `${fileBase}.docx`); setInfo({ tone: "success", msg: tr("DOCX berhasil diunduh — bisa diedit di Word / Google Docs.") }); });
  const dlTxt = () => { downloadBlob(new Blob([letterToText(doc, vars)], { type: "text/plain;charset=utf-8" }), `${fileBase}.txt`); setInfo({ tone: "success", msg: tr("Teks berhasil diunduh.") }); };
  const copyTxt = async () => {
    try { if (!(await copyText(letterToText(doc, vars)))) throw new Error("clipboard"); setInfo({ tone: "success", msg: tr("Teks surat disalin ke papan klip.") }); }
    catch { setInfo({ tone: "error", msg: tr("Gagal menyalin — izinkan akses papan klip.") }); }
  };
  const doPrint = () => {
    try { const p = paperSpec(doc.paper); printCanvasPages(hiRes(), { title: fileBase, pageSizeMm: { w: p.wMM, h: p.hMM } }); }
    catch (e) { setInfo({ tone: "error", msg: e instanceof Error ? e.message : tr("Gagal mencetak.") }); }
  };
  const needRows = () => { if (!mergeRows.length) throw new Error(tr("Belum ada data massal. Tempel/impor tabel di tab Surat Massal.")); };
  const bulkPdf = () => run("bpdf", async () => { needRows(); downloadBlob(await exportMergedPdf(bulkOpts(), mergeRows), `${fileBase}-massal.pdf`); setInfo({ tone: "success", msg: tr("{0} surat digabung dalam satu PDF.", mergeRows.length) }); });
  const bulkZip = (kind: "pdf" | "docx" | "png") => run(`z${kind}`, async () => { needRows(); downloadBlob(await exportZip(bulkOpts(), mergeRows, kind, nameKey), `${fileBase}-${kind}.zip`); setInfo({ tone: "success", msg: tr("{0} surat dikemas ke ZIP ({1}).", mergeRows.length, kind.toUpperCase()) }); });

  const saveDoc = () => downloadBlob(new Blob([JSON.stringify({ gamato: "letter", v: 1, doc }, null, 2)], { type: "application/json" }), `${fileBase}-draf.json`);
  const loadRef = useRef<HTMLInputElement>(null);
  const loadDoc = async (f: File | undefined) => {
    if (!f) return;
    try {
      const nd = normalizeLoaded(JSON.parse(await f.text()));
      if (!nd) throw new Error(tr("Berkas bukan draf Surat Gamato yang valid."));
      history.set(nd);
      setInfo({ tone: "success", msg: tr("Draf dimuat.") });
    } catch (e) { setInfo({ tone: "error", msg: e instanceof Error ? e.message : tr("Gagal memuat draf.") }); }
  };

  // ── tabel massal ──
  const mergeFileRef = useRef<HTMLInputElement>(null);
  const processMerge = (text: string) => {
    const grid = parseGrid(text);
    if (grid.length < 2) { setMergeInfo({ ok: false, msg: tr("Tabel perlu baris judul kolom dan minimal satu baris data.") }); return; }
    const headers = grid[0].map((h, i) => slugKey(h) || `kolom_${i + 1}`);
    const rows = grid.slice(1).filter((r) => r.some((c) => c.trim())).slice(0, MAX_ROWS).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? "").trim()])));
    setMergeHeaders(headers);
    setMergeRows(rows);
    setRowIdx(0);
    setNameKey(headers.includes("nama") ? "nama" : headers[0] ?? "");
    const total = grid.slice(1).filter((r) => r.some((c) => c.trim())).length;
    setMergeInfo({ ok: true, msg: tr("{0} surat siap dibuat{1}. Kolom: {2}.", rows.length, total > MAX_ROWS ? tr(" (dibatasi {0} dari {1} baris)", MAX_ROWS, total) : "", headers.join(", ")) });
    setRowOn(true);
  };
  const onMergeFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      let t: string;
      if (/\.xlsx$/i.test(f.name)) { const g = await readXlsxGrid(f); t = g.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"); }
      else t = await f.text();
      setMergeText(t);
      processMerge(t);
    } catch (e) { setMergeInfo({ ok: false, msg: e instanceof Error ? e.message : tr("Gagal membaca berkas.") }); }
  };
  const used = useMemo(() => usedVarKeys(doc), [doc]);
  const fieldKeys = fields.map((f) => f.key.toLowerCase());
  const mergeTemplateText = () => {
    const keys = Array.from(new Set(used.filter((k) => !BUILTIN_VARS.includes(k) && !k.endsWith("_iso")).concat(fieldKeys)));
    const head = keys.join("\t");
    const sample = keys.map((k) => { const f = fields.find((x) => x.key.toLowerCase() === k); return f && f.type !== "date" ? f.value.replace(/\s+/g, " ").slice(0, 60) : ""; }).join("\t");
    return `${head}\n${sample}\n${sample}`;
  };
  const missingCols = mergeRows.length ? used.filter((k) => !BUILTIN_VARS.includes(k) && !mergeHeaders.includes(k) && !(k in (doc.vars ?? {})) && !fieldKeys.includes(k) && !doc.customVars.some((c) => c.label.toLowerCase() === k)) : [];
  const allVarChips = Array.from(new Set([...BUILTIN_VARS, ...fieldKeys, ...doc.customVars.map((c) => c.label.trim().toLowerCase()).filter(Boolean)]));
  const [copied, setCopied] = useState<string | null>(null);
  const copyChip = async (k: string) => { try { if (!(await copyText(`{{${k}}}`))) throw new Error("clipboard"); setCopied(k); window.setTimeout(() => setCopied(null), 1300); } catch { /* abaikan */ } };

  const setBlocks = (fn: (b: LetterBlock[]) => LetterBlock[], o?: { continuous?: boolean }) => {
    history.set((p) => ({ ...p, blocks: fn(p.blocks) }), { commit: !o?.continuous });
    if (o?.continuous) schedule();
  };
  const setLayout = (l: SignLayout) => history.set((p) => {
    const need = signerCount(l);
    const signers = [...p.signers];
    while (signers.length < need) signers.push(newSigner({ heading: l === "two" || l === "three" ? tr("Mengetahui,") : tr("Hormat saya,"), name: tr("Nama Lengkap") }));
    return { ...p, signLayout: l, signers };
  });
  const marginPreset = (t: number, r: number, b: number, l: number) => history.set((p) => ({ ...p, marginTop: t, marginRight: r, marginBottom: b, marginLeft: l }));
  const nomorPreview = doc.numberMode === "auto" ? formatNomor(doc.noFormat, doc.noUrut, doc.noKode, doc.date) : doc.nomor;
  const p = paperSpec(doc.paper);

  const visibleTemplates = LETTER_TEMPLATES.filter((t) => cat === "Semua" || t.cat === cat);

  return (
    <div className="grid lg:grid-cols-[1fr_520px] gap-6 items-start" data-testid="letter-root">
      <AutosaveBar autosave={autosave} what="surat" className="lg:col-span-full" />
      <GamatoDesktopRecommended toolName="Pembuat Surat" className="lg:col-span-full" />
      {/* ── KIRI ── */}
      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionBadge>{tr("Semua diproses di perangkatmu")}</SectionBadge>
          <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={() => history.undo()} onRedo={() => history.redo()} />
        </div>
        <SettingsTabBar tabs={TABS} active={tab} onChange={setTab} />

        {/* ===== Template ===== */}
        {tab === "template" && (
          <div className="space-y-4">
            <PanelCard title={tr("Pilih Template")} subtitle={tr("17 template surat. Mengganti template mengganti isi & pengaturan surat — identitas kop, kertas, dan font kamu tetap. Salah pilih? Tekan Urungkan.")}>
              <div className="flex flex-wrap gap-1.5">
                {(["Semua", ...TEMPLATE_CATEGORIES] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setCat(c)} data-testid={`cat-${c}`}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border", cat === c ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700")}>{tr(c)}</button>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {visibleTemplates.map((t) => (
                  <button key={t.id} type="button" data-testid={`lt-${t.id}`} onClick={() => history.set((d) => applyLetterTemplate(d, t.id))}
                    className={cn("rounded-xl border-2 p-3 text-left transition-all", doc.templateId === t.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-indigo-300")}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{t.name}</p>
                      {doc.templateId === t.id && <Check className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{t.desc}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t.cat}</span>
                  </button>
                ))}
              </div>
            </PanelCard>
            {fields.length > 0 && (
              <PanelCard title={tr("Isi Cepat")} subtitle={tr("Lengkapi data untuk “{0}” — isi surat ikut berubah otomatis.", template.name)}>
                <div className="grid sm:grid-cols-2 gap-4">
                  {fields.map((f) => {
                    const val = doc.vars[f.key] ?? f.value;
                    const set = (v: string, cont = true) => { history.set((d) => ({ ...d, vars: { ...d.vars, [f.key]: v } }), { commit: !cont }); if (cont) schedule(); };
                    if (f.type === "textarea") return <div key={f.key} className="sm:col-span-2"><Textarea label={f.label} rows={3} value={val} onChange={(e) => set(e.target.value)} data-testid={`field-${f.key}`} /></div>;
                    if (f.type === "date") return <Input key={f.key} label={f.label} type="date" value={val} onChange={(e) => set(e.target.value, false)} data-testid={`field-${f.key}`} />;
                    if (f.type === "select") return (
                      <Select key={f.key} label={f.label} value={val} onChange={(e) => set(e.target.value, false)} data-testid={`field-${f.key}`}>
                        {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </Select>
                    );
                    return <Input key={f.key} label={f.label} value={val} onChange={(e) => set(e.target.value)} data-testid={`field-${f.key}`} />;
                  })}
                </div>
              </PanelCard>
            )}
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Kop & Surat ===== */}
        {tab === "kop" && (
          <div className="space-y-4">
            <PanelCard title={tr("Kop Surat")} subtitle={tr("Kepala surat dengan logo & identitas instansi/perusahaan.")}>
              <Toggle label={tr("Gunakan kop surat")} checked={doc.kopEnabled} onChange={(v) => up("kopEnabled", v)} testId="kop-enabled" />
              {doc.kopEnabled && (
                <div className="space-y-4">
                  <div>
                    <Label>{tr("Gaya kop")}</Label>
                    <Seg<KopStyle> value={doc.kopStyle} onChange={(v) => up("kopStyle", v)} testId="kopstyle" options={[
                      { id: "klasik", label: tr("Klasik (logo kiri, teks tengah)") }, { id: "tengah", label: tr("Logo di atas") }, { id: "samping", label: tr("Logo & teks kiri") },
                      { id: "logo-kanan", label: tr("Logo kanan") }, { id: "modern", label: tr("Modern") }, { id: "minimal", label: tr("Minimal (teks)") }]} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Input label={tr("Baris atas (instansi induk)")} value={doc.kopLine1} onChange={(e) => up("kopLine1", e.target.value, { continuous: true })} placeholder={tr("PEMERINTAH KOTA …")} data-testid="kop-line1" />
                    <Input label={tr("Nama instansi / perusahaan")} value={doc.kopName} onChange={(e) => up("kopName", e.target.value, { continuous: true })} data-testid="kop-name" />
                  </div>
                  <Textarea label={tr("Alamat")} rows={2} value={doc.kopAddress} onChange={(e) => up("kopAddress", e.target.value, { continuous: true })} />
                  <Input label={tr("Kontak (telepon, email, situs)")} value={doc.kopContact} onChange={(e) => up("kopContact", e.target.value, { continuous: true })} />
                  <ImageField label={tr("Logo")} value={doc.kopLogo} onChange={(v) => up("kopLogo", v)} hint={tr("PNG/JPG/SVG — latar transparan paling rapi.")} testId="kop-logo" />
                  <div className="grid sm:grid-cols-2 gap-4">
                    {doc.kopLogo && <SliderRow label={tr("Ukuran logo")} value={doc.kopLogoSize} min={12} max={40} suffix={tr(" mm")} onChange={(v) => up("kopLogoSize", v, { continuous: true })} />}
                    <div><Label>{tr("Warna teks kop")}</Label><GamatoColorPicker value={doc.kopColor} onChange={(v) => up("kopColor", v)} /></div>
                  </div>
                  <div>
                    <Label>{tr("Garis di bawah kop")}</Label>
                    <Seg<KopLine> value={doc.kopLine} onChange={(v) => up("kopLine", v)} options={[{ id: "none", label: tr("Tanpa") }, { id: "single", label: tr("Tunggal") }, { id: "double", label: tr("Ganda") }, { id: "thick-thin", label: tr("Tebal–tipis") }]} />
                  </div>
                  <Toggle label={tr("Tampilkan kop di semua halaman")} checked={doc.kopAllPages} onChange={(v) => up("kopAllPages", v)} />
                </div>
              )}
              <Toggle label={tr("Header lanjutan (perihal & nomor halaman) di halaman 2 dst.")} checked={doc.contHeader} onChange={(v) => up("contHeader", v)} />
            </PanelCard>

            <PanelCard title={tr("Tempat, Tanggal & Nomor")}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label={tr("Kota / tempat")} value={doc.city} onChange={(e) => up("city", e.target.value, { continuous: true })} data-testid="f-city" />
                <Input label={tr("Tanggal surat")} type="date" value={doc.date} onChange={(e) => up("date", e.target.value || todayISODate())} data-testid="f-date" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>{tr("Letak tempat & tanggal")}</Label><Seg<LetterDoc["dateLocation"]> value={doc.dateLocation} onChange={(v) => up("dateLocation", v)} options={[{ id: "top", label: tr("Di atas surat") }, { id: "signature", label: tr("Di atas tanda tangan") }, { id: "none", label: tr("Tidak tampil") }]} /></div>
                {doc.dateLocation === "top" && <div><Label>{tr("Perataan")}</Label><Seg<"left" | "right"> value={doc.dateAlign} onChange={(v) => up("dateAlign", v)} options={[{ id: "right", label: tr("Kanan") }, { id: "left", label: tr("Kiri") }]} /></div>}
              </div>
              <div>
                <Label>{tr("Nomor surat")}</Label>
                <Seg<"manual" | "auto"> value={doc.numberMode} onChange={(v) => up("numberMode", v)} testId="numbermode" options={[{ id: "manual", label: tr("Ketik manual") }, { id: "auto", label: tr("Otomatis (format)") }]} />
              </div>
              {doc.numberMode === "manual" ? (
                <Input label={tr("Nomor surat")} value={doc.nomor} onChange={(e) => up("nomor", e.target.value, { continuous: true })} placeholder="001/UM/I/2026" data-testid="f-nomor" />
              ) : (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <Input label={tr("Nomor urut")} type="number" min={1} value={doc.noUrut} onChange={(e) => up("noUrut", Math.max(1, Math.floor(Number(e.target.value) || 1)), { continuous: true })} data-testid="f-nourut" />
                    <Input label={tr("Kode unit")} value={doc.noKode} onChange={(e) => up("noKode", e.target.value, { continuous: true })} data-testid="f-nokode" />
                    <Input label={tr("Format")} value={doc.noFormat} onChange={(e) => up("noFormat", e.target.value, { continuous: true })} className="font-mono" />
                  </div>
                  <p className="text-[11px] text-slate-400">{tr("Token:")} <code>{tr("{no:3}")}</code> {tr("urut berdigit tetap ·")} <code>{tr("{kode}")}</code> · <code>{tr("{bulan_romawi}")}</code> · <code>{tr("{bulan}")}</code> · <code>{tr("{tahun}")}</code>{tr(". Pada surat massal nomor naik otomatis per surat.")}</p>
                </div>
              )}
              <p className="text-xs text-slate-500">{tr("Hasil nomor:")} <b className="font-mono text-indigo-600 dark:text-indigo-300" data-testid="nomor-preview">{nomorPreview || "—"}</b></p>
            </PanelCard>

            <PanelCard title={tr("Perihal & Tujuan")}>
              <Toggle label={tr("Tampilkan blok Nomor / Sifat / Lampiran / Hal")} checked={doc.metaEnabled} onChange={(v) => up("metaEnabled", v)} testId="meta-enabled" />
              {doc.metaEnabled && (
                <div className="grid sm:grid-cols-3 gap-4">
                  <Input label={tr("Sifat")} value={doc.sifat} onChange={(e) => up("sifat", e.target.value, { continuous: true })} placeholder={tr("Penting / Segera")} />
                  <Input label={tr("Lampiran")} value={doc.lampiran} onChange={(e) => up("lampiran", e.target.value, { continuous: true })} placeholder={tr("1 (satu) berkas")} />
                  <Input label={tr("Hal / Perihal")} value={doc.perihal} onChange={(e) => up("perihal", e.target.value, { continuous: true })} data-testid="f-perihal" />
                </div>
              )}
              <Textarea label={tr("Tujuan surat (Yth.)")} rows={4} value={doc.addressee} onChange={(e) => up("addressee", e.target.value, { continuous: true })} placeholder={tr("Yth. Bapak/Ibu …\ndi tempat")} data-testid="f-addressee" />
            </PanelCard>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Isi ===== */}
        {tab === "isi" && (
          <div className="space-y-4">
            <PanelCard title={tr("Isi Surat")} subtitle={tr("Susun surat dari blok. Format teks: **tebal**, *miring*, __garis bawah__. Variabel: {{nama}}.")}>
              <LetterBlocksEditor blocks={doc.blocks} onChange={setBlocks} />
            </PanelCard>
            <PanelCard title={tr("Variabel")} subtitle={tr("Teks apa pun bisa memuat {{variabel}}. Klik untuk menyalin.")}>
              <div className="flex flex-wrap gap-1.5">
                {allVarChips.map((k) => (
                  <button key={k} type="button" onClick={() => copyChip(k)} className="font-mono text-[11px] px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-300 hover:border-indigo-400">
                    {copied === k ? tr("Disalin ✓") : `{{${k}}}`}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{tr("Variabel kustom")}</p>
                {doc.customVars.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <input aria-label={tr("Nama variabel")} className="w-[34%] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono text-slate-900 dark:text-slate-100" value={c.label} onChange={(e) => { history.set((d) => ({ ...d, customVars: d.customVars.map((x) => (x.id === c.id ? { ...x, label: slugKey(e.target.value) } : x)) }), { commit: false }); schedule(); }} placeholder="nama_variabel" />
                    <input aria-label={tr("Nilai variabel")} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100" value={c.value} onChange={(e) => { history.set((d) => ({ ...d, customVars: d.customVars.map((x) => (x.id === c.id ? { ...x, value: e.target.value } : x)) }), { commit: false }); schedule(); }} placeholder={tr("Nilai")} />
                    <button type="button" aria-label={tr("Hapus variabel")} onClick={() => history.set((d) => ({ ...d, customVars: d.customVars.filter((x) => x.id !== c.id) }))} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
                <Btn variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => history.set((d) => ({ ...d, customVars: [...d.customVars, { id: newId("d"), label: "", value: "" }] }))} data-testid="add-var"><Plus className="w-3.5 h-3.5" />{tr("Tambah variabel")}</Btn>
              </div>
            </PanelCard>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Tanda Tangan ===== */}
        {tab === "ttd" && (
          <div className="space-y-4">
            <PanelCard title={tr("Tanda Tangan")}>
              <Toggle label={tr("Tampilkan blok tanda tangan")} checked={doc.signEnabled} onChange={(v) => up("signEnabled", v)} testId="sign-enabled" />
              {doc.signEnabled && (
                <div className="space-y-4">
                  <div>
                    <Label>{tr("Tata letak")}</Label>
                    <Seg<SignLayout> value={doc.signLayout} onChange={setLayout} testId="signlayout" options={[
                      { id: "right", label: tr("1 · Kanan") }, { id: "left", label: tr("1 · Kiri") }, { id: "center", label: tr("1 · Tengah") }, { id: "two", label: tr("2 penanda tangan") }, { id: "three", label: tr("3 penanda tangan") }]} />
                  </div>
                  <SliderRow label={tr("Ruang tanda tangan")} value={doc.signGap} min={10} max={50} suffix={tr(" mm")} onChange={(v) => up("signGap", v, { continuous: true })} />
                  <div className="grid sm:grid-cols-2 gap-4 items-center">
                    <Toggle label={tr("Tempel materai (kolom paling kanan)")} checked={doc.materai} onChange={(v) => up("materai", v)} testId="materai" />
                  </div>
                  <ImageField label={tr("Gambar cap / stempel (opsional)")} value={doc.stampImage} onChange={(v) => up("stampImage", v)} hint={tr("PNG transparan. Aktifkan per penanda tangan di bawah.")} testId="stamp-image" />
                </div>
              )}
            </PanelCard>
            {doc.signEnabled && doc.signers.slice(0, signerCount(doc.signLayout)).map((s, i) => (
              <PanelCard key={s.id} title={tr("Penanda Tangan {0}", i + 1)} subtitle={tr("Boleh memakai {{variabel}} (mis. {{nama_ttd}}).")}>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label={tr("Kalimat pembuka")} value={s.heading} onChange={(e) => upSigner(i, { heading: e.target.value })} placeholder={tr("Hormat saya,")} data-testid={`sg-heading-${i}`} />
                  <Input label={tr("Jabatan")} value={s.role} onChange={(e) => upSigner(i, { role: e.target.value })} data-testid={`sg-role-${i}`} />
                  <Input label={tr("Nama")} value={s.name} onChange={(e) => upSigner(i, { name: e.target.value })} data-testid={`sg-name-${i}`} />
                  <div className="grid grid-cols-[110px_1fr] gap-3">
                    <Input label={tr("Label NIP/NIK")} value={s.idLabel} onChange={(e) => upSigner(i, { idLabel: e.target.value })} placeholder="NIP." />
                    <Input label={tr("Nomor")} value={s.idValue} onChange={(e) => upSigner(i, { idValue: e.target.value })} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-5">
                  <Toggle label={tr("Tampilkan cap/stempel")} checked={s.showStamp} onChange={(v) => upSigner(i, { showStamp: v }, false)} />
                  <Toggle label={tr("QR tanda tangan elektronik (ganti gambar)")} checked={s.qr} onChange={(v) => upSigner(i, { qr: v }, false)} testId={`sg-qr-${i}`} />
                </div>
                {!s.qr && <SignaturePad value={s.image} onChange={(v) => upSigner(i, { image: v }, false)} label={tr("Tanda tangan (gambar / unggah)")} />}
              </PanelCard>
            ))}
            <PanelCard title={tr("Tembusan & Lampiran")}>
              <Textarea label={tr("Tembusan (satu baris = satu pihak)")} rows={3} value={doc.tembusan} onChange={(e) => up("tembusan", e.target.value, { continuous: true })} data-testid="f-tembusan" />
              <Toggle label={tr("Tambahkan halaman lampiran")} checked={doc.lampiranPage} onChange={(v) => up("lampiranPage", v)} testId="lampiran-page" />
              {doc.lampiranPage && (
                <div className="space-y-3">
                  <Input label={tr("Judul lampiran")} value={doc.lampiranTitle} onChange={(e) => up("lampiranTitle", e.target.value, { continuous: true })} />
                  <Textarea label={tr("Isi lampiran (pisahkan paragraf dengan baris kosong)")} rows={5} value={doc.lampiranText} onChange={(e) => up("lampiranText", e.target.value, { continuous: true })} />
                </div>
              )}
            </PanelCard>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Tampilan ===== */}
        {tab === "tampilan" && (
          <div className="space-y-4">
            <PanelCard title={tr("Kertas & Margin")}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Select label={tr("Ukuran kertas")} value={doc.paper} onChange={(e) => up("paper", e.target.value as LetterDoc["paper"])} data-testid="paper-select">
                  {PAPERS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </Select>
                <div>
                  <Label>{tr("Preset margin")}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {([[tr("Standar (kiri 30)"), 22, 25, 22, 30], [tr("Normal 25"), 25, 25, 25, 25], [tr("Sempit 15"), 15, 15, 15, 15], [tr("Lebar 35"), 35, 35, 35, 35]] as const).map(([l, t, r, b, ml]) => (
                      <button key={l} type="button" onClick={() => marginPreset(t, r, b, ml)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-300">{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SliderRow label={tr("Atas")} value={doc.marginTop} min={8} max={60} suffix={tr(" mm")} onChange={(v) => up("marginTop", v, { continuous: true })} />
                <SliderRow label={tr("Bawah")} value={doc.marginBottom} min={8} max={60} suffix={tr(" mm")} onChange={(v) => up("marginBottom", v, { continuous: true })} />
                <SliderRow label={tr("Kiri")} value={doc.marginLeft} min={8} max={60} suffix={tr(" mm")} onChange={(v) => up("marginLeft", v, { continuous: true })} />
                <SliderRow label={tr("Kanan")} value={doc.marginRight} min={8} max={60} suffix={tr(" mm")} onChange={(v) => up("marginRight", v, { continuous: true })} />
              </div>
            </PanelCard>
            <PanelCard title={tr("Teks")}>
              <div className="grid sm:grid-cols-2 gap-4">
                <FontPicker label={tr("Font isi surat")} value={doc.fontFamily} onChange={(v) => up("fontFamily", v)} onRemoveCustomFont={(id) => removeCustomFont(id, (fb) => { if (doc.fontFamily === id) up("fontFamily", fb); if (doc.fontHeading === id) up("fontHeading", fb); })} {...fontProps} />
                <FontPicker label={tr("Font kop & judul")} value={doc.fontHeading} onChange={(v) => up("fontHeading", v)} onRemoveCustomFont={() => undefined} hideUpload {...fontProps} />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <SliderRow label={tr("Ukuran huruf")} value={doc.fontSize} min={9} max={16} step={0.5} suffix={tr(" pt")} onChange={(v) => up("fontSize", v, { continuous: true })} />
                <SliderRow label={tr("Jarak baris")} value={doc.lineHeight} min={1} max={2} step={0.05} suffix={tr("×")} onChange={(v) => up("lineHeight", v, { continuous: true })} />
                <SliderRow label={tr("Jarak paragraf")} value={doc.paraSpacing} min={0} max={20} suffix={tr(" pt")} onChange={(v) => up("paraSpacing", v, { continuous: true })} />
              </div>
              <div>
                <Label>{tr("Perataan teks")}</Label>
                <Seg<LetterDoc["align"]> value={doc.align} onChange={(v) => up("align", v)} options={[{ id: "justify", label: tr("Rata kiri-kanan") }, { id: "left", label: tr("Rata kiri") }]} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>{tr("Warna teks")}</Label><GamatoColorPicker value={doc.colorText} onChange={(v) => up("colorText", v)} /></div>
                <div><Label>{tr("Warna aksen (tabel, kop modern)")}</Label><GamatoColorPicker value={doc.colorAccent} onChange={(v) => up("colorAccent", v)} /></div>
              </div>
            </PanelCard>
            <PanelCard title={tr("Bingkai, Nomor Halaman & Watermark")}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>{tr("Bingkai halaman")}</Label><Seg<LetterDoc["frame"]> value={doc.frame} onChange={(v) => up("frame", v)} options={[{ id: "none", label: tr("Tanpa") }, { id: "single", label: tr("Tunggal") }, { id: "double", label: tr("Ganda") }]} /></div>
                {doc.frame !== "none" && <div><Label>{tr("Warna bingkai")}</Label><GamatoColorPicker value={doc.frameColor} onChange={(v) => up("frameColor", v)} /></div>}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>{tr("Nomor halaman")}</Label><Seg<PageNumMode> value={doc.pageNum} onChange={(v) => up("pageNum", v)} options={[{ id: "none", label: tr("Tanpa") }, { id: "center", label: tr("Tengah") }, { id: "right", label: tr("Kanan") }]} /></div>
                <Input label={tr("Format nomor halaman")} value={doc.pageNumFormat} onChange={(e) => up("pageNumFormat", e.target.value, { continuous: true })} placeholder={tr("Halaman {n} dari {total}")} />
              </div>
              <Input label={tr("Teks kaki (opsional)")} value={doc.footerText} onChange={(e) => up("footerText", e.target.value, { continuous: true })} />
              <div className="grid sm:grid-cols-3 gap-4 items-end">
                <Input label={tr("Watermark teks")} value={doc.watermarkText} onChange={(e) => up("watermarkText", e.target.value, { continuous: true })} placeholder={tr("DRAFT / SALINAN")} data-testid="f-watermark" />
                <div><Label>{tr("Warna watermark")}</Label><GamatoColorPicker value={doc.watermarkColor} onChange={(v) => up("watermarkColor", v)} /></div>
                <SliderRow label={tr("Kepekatan")} value={doc.watermarkOpacity} min={0.02} max={0.4} step={0.01} onChange={(v) => up("watermarkOpacity", v, { continuous: true })} />
              </div>
              <Toggle label={tr("Logo kop sebagai watermark")} checked={doc.watermarkLogo} onChange={(v) => up("watermarkLogo", v)} />
            </PanelCard>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Surat Massal ===== */}
        {tab === "massal" && (
          <div className="space-y-4">
            <PanelCard title={tr("Surat Massal (Mail Merge)")} subtitle={tr("Satu template, banyak penerima. Hingga {0} surat sekali proses.", MAX_ROWS)}>
              <Textarea label={tr("Tempel tabel (baris pertama = judul kolom)")} rows={7} className="font-mono text-xs" value={mergeText} onChange={(e) => setMergeText(e.target.value)} placeholder={tr("nama\ttujuan\tposisi\nBudi\tPT Maju\tStaf Admin")} data-testid="merge-input" />
              <div className="flex flex-wrap gap-2">
                <Btn onClick={() => processMerge(mergeText)} disabled={!mergeText.trim()} data-testid="merge-process"><Table2 className="w-4 h-4" />{tr("Proses tabel")}</Btn>
                <Btn variant="secondary" onClick={() => mergeFileRef.current?.click()}><Upload className="w-4 h-4" />{tr("Impor CSV / Excel")}</Btn>
                <Btn variant="ghost" onClick={() => setMergeText(mergeTemplateText())} data-testid="merge-sample">{tr("Buat kerangka kolom dari surat ini")}</Btn>
                <input ref={mergeFileRef} type="file" accept=".csv,.tsv,.txt,.xlsx" className="hidden" data-testid="merge-file" onChange={(e) => { void onMergeFile(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              <p className="text-xs text-slate-500">{tr("Judul kolom = nama variabel: kolom")} <b>{tr("nama")}</b> {tr("mengisi")} <code>{tr("{{nama}}")}</code>{tr(". Kolom yang tidak ada memakai isian di tab Template.")}</p>
              {mergeInfo && <GamatoInlineAlert tone={mergeInfo.ok ? "success" : "error"} message={<span data-testid="merge-info">{mergeInfo.msg}</span>} />}
              {missingCols.length > 0 && <GamatoInlineAlert tone="warning" message={<>{tr("Variabel di surat yang belum punya kolom:")} {missingCols.map((k) => `{{${k}}}`).join(", ")} {tr("— akan kosong.")}</>} />}
            </PanelCard>
            {mergeRows.length > 0 && (
              <PanelCard title={tr("Pratinjau & Penamaan")}>
                <Toggle label={tr("Pratinjau dengan data baris tertentu")} checked={rowOn} onChange={setRowOn} testId="row-on" />
                <div className="flex items-center gap-3 flex-wrap">
                  <Label>{tr("Baris")}</Label>
                  <Input type="number" min={1} max={mergeRows.length} value={safeRow + 1} onChange={(e) => setRowIdx(Math.min(mergeRows.length - 1, Math.max(0, Math.floor(Number(e.target.value) || 1) - 1)))} className="w-24 text-center" data-testid="row-idx" />
                  <span className="text-sm text-slate-500">{tr("dari {0}", mergeRows.length)}</span>
                </div>
                <Select label={tr("Kolom untuk nama berkas")} value={nameKey} onChange={(e) => setNameKey(e.target.value)}>
                  <option value="">{tr("(nomor urut saja)")}</option>
                  {mergeHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </PanelCard>
            )}
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </div>
        )}

        {/* ===== Ekspor ===== */}
        {tab === "ekspor" && (
          <div className="space-y-4">
            <PanelCard title={tr("Ekspor Surat")} subtitle={tr("{0} halaman · {1}", pages.length, p.label)}>
              <div>
                <Label>{tr("Kualitas gambar PDF / PNG")}</Label>
                <Seg<string> value={String(exportDpi)} onChange={(v) => setExportDpi(Number(v))} options={[{ id: "150", label: tr("Standar 150 dpi") }, { id: "200", label: tr("Tinggi 200 dpi") }, { id: "300", label: tr("Cetak 300 dpi") }]} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Btn onClick={dlPdf} disabled={!!busy} data-testid="ex-pdf"><FileText className="w-4 h-4" />{tr("Unduh PDF")}</Btn>
                <Btn onClick={dlDocx} disabled={!!busy} data-testid="ex-docx"><FileType2 className="w-4 h-4" />{tr("Unduh Word (.docx)")}</Btn>
                <Btn variant="secondary" onClick={dlPng} disabled={!!busy} data-testid="ex-png"><FileArchive className="w-4 h-4" />{tr("PNG per halaman (ZIP)")}</Btn>
                <Btn variant="secondary" onClick={doPrint} data-testid="ex-print"><Printer className="w-4 h-4" />{tr("Cetak")}</Btn>
                <Btn variant="secondary" onClick={dlTxt} data-testid="ex-txt"><Download className="w-4 h-4" />{tr("Teks (.txt)")}</Btn>
                <Btn variant="secondary" onClick={copyTxt} data-testid="ex-copy"><ClipboardCopy className="w-4 h-4" />{tr("Salin teks")}</Btn>
              </div>
              <p className="text-[11px] text-slate-400">{tr("Word (.docx) bisa diedit bebas, tetapi watermark & bingkai halaman hanya ada di PDF/PNG.")}</p>
            </PanelCard>
            <PanelCard title={tr("Surat Massal")} subtitle={mergeRows.length ? tr("{0} surat dari tabel", mergeRows.length) : tr("Belum ada data — isi di tab Surat Massal.")}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Btn onClick={bulkPdf} disabled={!!busy || !mergeRows.length} data-testid="ex-bpdf"><FileText className="w-4 h-4" />{tr("Satu PDF gabungan")}</Btn>
                <Btn variant="secondary" onClick={() => bulkZip("pdf")} disabled={!!busy || !mergeRows.length} data-testid="ex-zpdf"><FileArchive className="w-4 h-4" />{tr("ZIP · PDF per surat")}</Btn>
                <Btn variant="secondary" onClick={() => bulkZip("docx")} disabled={!!busy || !mergeRows.length} data-testid="ex-zdocx"><FileArchive className="w-4 h-4" />{tr("ZIP · Word per surat")}</Btn>
                <Btn variant="secondary" onClick={() => bulkZip("png")} disabled={!!busy || !mergeRows.length} data-testid="ex-zpng"><FileArchive className="w-4 h-4" />{tr("ZIP · PNG per surat")}</Btn>
              </div>
            </PanelCard>
            <PanelCard title={tr("Draf")}>
              <div className="flex flex-wrap gap-2">
                <Btn variant="secondary" onClick={saveDoc} data-testid="ex-save"><Save className="w-4 h-4" />{tr("Simpan draf (.json)")}</Btn>
                <Btn variant="secondary" onClick={() => loadRef.current?.click()}><FolderOpen className="w-4 h-4" />{tr("Muat draf (.json)")}</Btn>
                <input ref={loadRef} type="file" accept="application/json,.json" className="hidden" data-testid="load-doc" onChange={(e) => { void loadDoc(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            </PanelCard>
            {busy && (
              <div className="space-y-2" data-testid="progress">
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${progress ? (progress.done / Math.max(1, progress.total)) * 100 : 8}%` }} /></div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tr("Memproses")} {progress ? `${progress.done} / ${progress.total}` : "…"}</span>
                  <button type="button" onClick={() => { cancelRef.current.cancelled = true; }} className="font-semibold text-red-500 hover:text-red-700" data-testid="cancel">{tr("Batal")}</button>
                </div>
              </div>
            )}
            {info && <GamatoInlineAlert tone={info.tone} message={<span data-testid="ex-info">{info.msg}</span>} />}
          </div>
        )}
      </div>

      {/* ── KANAN: pratinjau ── */}
      <PreviewJumpFab targetId="surat-preview" />
      <div id="surat-preview" className="lg:sticky lg:top-20 scroll-mt-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin] space-y-3 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{tr("Pratinjau ·")} <span data-testid="page-count">{pages.length}</span> {tr("halaman")}</p>
          <div className="flex items-center gap-1">
            <button type="button" aria-label={tr("Perkecil")} onClick={() => setZoom(Math.max(50, zoom - 10))} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs font-semibold text-slate-500 tabular-nums w-10 text-center">{zoom}%</span>
            <button type="button" aria-label={tr("Perbesar")} onClick={() => setZoom(Math.min(160, zoom + 10))} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomIn className="w-4 h-4" /></button>
          </div>
        </div>
        {activeRow && <div className="text-xs rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 font-semibold">{tr("Pratinjau data baris {0} dari {1}", safeRow + 1, mergeRows.length)}</div>}
        {renderError && <GamatoInlineAlert tone="error" message={renderError} />}
        <div className="rounded-2xl bg-slate-200/70 dark:bg-slate-800 p-3 max-h-[72vh] overflow-auto" data-testid="letter-preview">
          <div className="mx-auto space-y-4" style={{ width: `${zoom}%` }}>
            {pages.map((pg, i) => <PageView key={i} src={pg} index={i} />)}
            {!pages.length && <div className="aspect-[1/1.414] bg-white rounded-md flex items-center justify-center text-slate-400 text-sm"><Loader2 className="w-5 h-5 animate-spin mr-2" />{tr("Menyusun surat…")}</div>}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <Btn onClick={dlPdf} disabled={!!busy} className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:text-white px-3" data-testid="dl-pdf"><FileText className="w-4 h-4" />{tr("PDF")}</Btn>
          <Btn variant="secondary" onClick={dlDocx} disabled={!!busy} className="px-3" data-testid="dl-docx"><FileType2 className="w-4 h-4" />{tr("Word")}</Btn>
          <Btn variant="secondary" onClick={dlPng} disabled={!!busy} className="px-3"><Stamp className="w-4 h-4" />{tr("PNG")}</Btn>
          <Btn variant="secondary" onClick={doPrint} className="px-3" data-testid="dl-print"><Printer className="w-4 h-4" />{tr("Cetak")}</Btn>
        </div>
        {tab !== "ekspor" && info && <GamatoInlineAlert tone={info.tone} message={info.msg} />}
        {tab !== "ekspor" && busy && <p className="text-xs text-slate-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />{tr("Memproses…")}</p>}
        <p className="text-[11px] text-slate-400 text-center"><Copy className="w-3 h-3 inline mr-1" />{tr("Ekspor massal & TXT ada di tab “Ekspor”.")}</p>
      </div>
    </div>
  );
}
