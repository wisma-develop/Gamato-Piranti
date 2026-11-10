import React, { useEffect, useMemo, useRef, useState } from "react";
import { PreviewJumpFab } from "@/components/ui/PreviewJumpFab";
import {
  Tag, Type, Square, Circle, Minus as LineIcon, Image as ImageIcon, Trash2, Download, Printer, Loader2, Move, ChevronUp, ChevronDown, Copy,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, CaseUpper, FlipHorizontal2, Layers, Sparkles, Ruler, Palette, Users, UserSquare2, QrCode, Barcode,
  Plus, Contact, Paintbrush,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToDataUrl } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { sanitizeFileName } from "@/utils/sanitize";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { printCanvasImage, printCanvasPages } from "@/lib/printCanvas";
import { renderNametagSide } from "@/lib/nametagEngine";
import { exportNtSheet, forRender, ingestPhoto } from "@/lib/nametagBulk";
import {
  NT_FIELD_KEYS, NT_FIELD_LABEL, NT_SIZES, NT_TEMPLATES, PT_PX, PX_PER_MM, defaultRecord, defaultRoles, getNtTemplate, makeBarcode, makeImage, makePhoto, makeQr, makeShape,
  makeText, newNtId, resolveNtSizeMM,
  type NametagDesign, type NtBarcodeEl, type NtElement, type NtImageEl, type NtPhotoEl, type NtQrEl, type NtRecord, type NtShapeEl, type NtSide, type NtSizeId, type NtTextEl,
} from "@/lib/nametagTypes";
import { NametagBulk } from "./NametagBulk";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { FontPicker } from "@/components/ui/FontPicker";
import { Label, Input, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoSelect } from "@/components/ui/GamatoSelect";
import { PanelCard } from "@/components/ui/PanelCard";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { SettingsTabBar, NextTabHint, type SettingsTabDef } from "@/components/ui/SettingsTabs";

type Side = "front" | "back";
type TabId = "template" | "data" | "ukuran" | "latar" | "elemen" | "peran" | "massal";

const TABS: SettingsTabDef<TabId>[] = [
  { id: "template", label: "Template", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: "data", label: "Data Peserta", icon: <Contact className="w-3.5 h-3.5" /> },
  { id: "ukuran", label: "Ukuran & Lubang", icon: <Ruler className="w-3.5 h-3.5" /> },
  { id: "latar", label: "Latar Belakang", icon: <Palette className="w-3.5 h-3.5" /> },
  { id: "elemen", label: "Elemen", icon: <Layers className="w-3.5 h-3.5" /> },
  { id: "peran", label: "Warna Peran", icon: <Paintbrush className="w-3.5 h-3.5" /> },
  { id: "massal", label: "Massal (Bulk)", icon: <Users className="w-3.5 h-3.5" /> },
];

interface Studio { design: NametagDesign; rec: NtRecord }
const defaultStudio = (): Studio => ({ design: getNtTemplate("konferensi"), rec: defaultRecord() });
const MM_TO_PT = 2.834645669;

function ToggleRow<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon?: React.ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)} aria-pressed={value === opt.value}
          className={cn("flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all",
            value === opt.value ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600")}>
          {opt.icon}{opt.label}
        </button>
      ))}
    </div>
  );
}

const elLabel = (el: NtElement): string =>
  el.kind === "text" ? (el.bind ? NT_FIELD_LABEL[el.bind] : el.text || "Teks Kosong")
  : el.kind === "image" ? "Gambar / Logo"
  : el.kind === "photo" ? "Foto Peserta"
  : el.kind === "qr" ? "QR Code"
  : el.kind === "barcode" ? "Barcode"
  : `Bentuk · ${el.shape === "rect" ? "Kotak" : el.shape === "circle" ? "Lingkaran" : "Garis"}`;

const elIcon = (el: NtElement) =>
  el.kind === "text" ? <Type className="w-3.5 h-3.5" /> : el.kind === "image" ? <ImageIcon className="w-3.5 h-3.5" /> : el.kind === "photo" ? <UserSquare2 className="w-3.5 h-3.5" />
  : el.kind === "qr" ? <QrCode className="w-3.5 h-3.5" /> : el.kind === "barcode" ? <Barcode className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />;

export function NametagGenerator() {
  const history = useHistoryState<Studio>(() => defaultStudio());
  const { design, rec } = history.state;
  const { schedule: scheduleCommit } = useDebouncedCommit(history.commit, 500);

  const [activeSide, setActiveSide] = useState<Side>("front");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("template");
  const [bulkPreview, setBulkPreview] = useState<NtRecord | null>(null);
  const shown = useMemo(() => (bulkPreview && tab !== "data" ? forRender(bulkPreview) : rec), [bulkPreview, rec, tab]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportPpm, setExportPpm] = useState<12 | 24>(12);
  const [info, setInfo] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { customFonts, isFontLoading, fontError, addCustomFont, removeCustomFont } = useCustomFonts();

  const frontRef = useRef<HTMLCanvasElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const frontSeq = useRef(0);
  const backSeq = useRef(0);

  const currentSide: NtSide = design[activeSide];
  const selected = useMemo(() => currentSide.elements.find((e) => e.id === selectedId) ?? null, [currentSide, selectedId]);
  const sizeMM = useMemo(() => resolveNtSizeMM(design), [design.sizeId, design.customWMM, design.customHMM]);

  // ── helpers ──
  const setStudio = (up: (s: Studio) => Studio, o?: { continuous?: boolean }) => { history.set(up, { commit: !o?.continuous }); if (o?.continuous) scheduleCommit(); };
  const updateRec = (patch: Partial<NtRecord>, o?: { continuous?: boolean }) => setStudio((s) => ({ ...s, rec: { ...s.rec, ...patch } }), o);
  const updateDesign = (patch: Partial<NametagDesign>, o?: { continuous?: boolean }) => setStudio((s) => ({ ...s, design: { ...s.design, ...patch } }), o);
  const updateHole = (patch: Partial<NametagDesign["hole"]>, o?: { continuous?: boolean }) => setStudio((s) => ({ ...s, design: { ...s.design, hole: { ...s.design.hole, ...patch } } }), o);
  const updateSide = (up: (side: NtSide) => NtSide, o?: { continuous?: boolean }) =>
    setStudio((s) => ({ ...s, design: { ...s.design, [activeSide]: up(s.design[activeSide]) } }), o);
  function updateElement<T extends NtElement>(id: string, patch: Partial<T>, o?: { continuous?: boolean }) {
    updateSide((side) => ({ ...side, elements: side.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as NtElement) : el)) }), o);
  }

  const handleRemoveCustomFont = (id: string) => {
    removeCustomFont(id, (fallback) => { if (selected?.kind === "text" && selected.fontFamily === id) updateElement(selected.id, { fontFamily: fallback }); });
  };

  // ── element CRUD ──
  const addEl = (el: NtElement) => { updateSide((side) => ({ ...side, elements: [...side.elements, el] })); setSelectedId(el.id); };
  const addText = () => addEl(makeText({ text: "Teks baru", fontSize: 12 }));
  const addShape = (shape: "rect" | "circle" | "line") => addEl(makeShape({ shape, ...(shape === "line" ? { widthPct: 30, heightPct: 0.8 } : {}) }));
  const addPhoto = () => addEl(makePhoto());
  const addQr = () => addEl(makeQr());
  const addBarcode = () => addEl(makeBarcode());
  const addImageFile = async (file: File | null) => {
    if (!file) return;
    try { addEl(makeImage({ src: await fileToDataUrl(file) })); } catch { setInfo({ type: "error", text: "Gagal memuat gambar." }); }
  };
  const replaceImage = async (id: string, file: File | null) => {
    if (!file) return;
    try { updateElement(id, { src: await fileToDataUrl(file) }); } catch { setInfo({ type: "error", text: "Gagal memuat gambar." }); }
  };
  const removeEl = (id: string) => { updateSide((side) => ({ ...side, elements: side.elements.filter((e) => e.id !== id) })); if (selectedId === id) setSelectedId(null); };
  const dupEl = (id: string) => {
    const el = currentSide.elements.find((e) => e.id === id);
    if (!el) return;
    const clone = { ...el, id: newNtId(el.kind), xPct: Math.min(96, el.xPct + 3), yPct: Math.min(96, el.yPct + 3) } as NtElement;
    addEl(clone);
  };
  const moveEl = (id: string, dir: -1 | 1) => updateSide((side) => {
    const i = side.elements.findIndex((e) => e.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= side.elements.length) return side;
    const next = [...side.elements]; [next[i], next[j]] = [next[j], next[i]];
    return { ...side, elements: next };
  });

  // ── background ──
  const setBgType = (type: "solid" | "gradient" | "image") => updateSide((side) => {
    if (type === "solid") return { ...side, background: { type: "solid", color: side.background.type === "solid" ? side.background.color : "#ffffff" } };
    if (type === "gradient") return side.background.type === "gradient" ? side : { ...side, background: { type: "gradient", angle: 135, from: "#4f46e5", to: "#7c3aed" } };
    return side.background.type === "image" ? side : { ...side, background: { type: "image", src: "", fit: "cover", overlayColor: "#000000", overlayOpacity: 0 } };
  });
  const bgPatch = (p: Record<string, unknown>, o?: { continuous?: boolean }) => updateSide((side) => ({ ...side, background: { ...side.background, ...p } as NtSide["background"] }), o);
  const setBgImageFile = async (file: File | null) => {
    if (!file) return;
    try { bgPatch({ src: await fileToDataUrl(file) }); } catch { setInfo({ type: "error", text: "Gagal memuat gambar latar." }); }
  };

  // ── template / size / photo / roles ──
  const applyTemplate = (id: string) => {
    const tpl = getNtTemplate(id);
    setStudio((s) => ({ ...s, design: { ...tpl, roles: s.design.roles, roleFallback: s.design.roleFallback, customWMM: s.design.customWMM, customHMM: s.design.customHMM } }));
    setSelectedId(null); setInfo(null);
  };
  const uploadSamplePhoto = async (file: File | null) => {
    if (!file) return;
    try { updateRec({ photo: await ingestPhoto(file) }); } catch { setInfo({ type: "error", text: "Foto tidak bisa dibaca." }); }
  };
  const setRoles = (roles: NametagDesign["roles"], o?: { continuous?: boolean }) => updateDesign({ roles }, o);
  const addRoleNamed = (role: string) => {
    if (!role.trim() || design.roles.some((r) => r.role.toLowerCase() === role.trim().toLowerCase())) return;
    const pal = ["#2563eb", "#16a34a", "#b8860b", "#7c3aed", "#ea580c", "#0891b2", "#db2777", "#475569"];
    setRoles([...design.roles, { role: role.trim(), color: pal[design.roles.length % pal.length] }]);
  };

  // ── drag ──
  const onPointerDownEl = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    setSelectedId(id); setTab("elemen"); setDragId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragId || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    updateElement(dragId, { xPct: Math.round(x * 10) / 10, yPct: Math.round(y * 10) / 10 }, { continuous: true });
  };
  const onPointerUp = () => { if (dragId) { setDragId(null); history.commit(); } };

  // ── preview render (offscreen-first agar render lambat tak menimpa yang baru) ──
  const holeGuide = design.hole.shape !== "none" ? "guide" : "none";
  useEffect(() => {
    const seq = ++frontSeq.current; let cancelled = false;
    (async () => {
      const off = document.createElement("canvas");
      await renderNametagSide(off, design.front, shown, design, cacheRef.current, { hole: holeGuide });
      if (cancelled || frontSeq.current !== seq) return;
      const c = frontRef.current; if (!c) return;
      c.width = off.width; c.height = off.height; c.getContext("2d")?.drawImage(off, 0, 0);
    })();
    return () => { cancelled = true; };
  }, [design.front, design.sizeId, design.customWMM, design.customHMM, design.roles, design.roleFallback, design.hole, shown]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const seq = ++backSeq.current; let cancelled = false;
    (async () => {
      const off = document.createElement("canvas");
      await renderNametagSide(off, design.back, shown, design, cacheRef.current, { hole: holeGuide });
      if (cancelled || backSeq.current !== seq) return;
      const c = backRef.current; if (!c) return;
      c.width = off.width; c.height = off.height; c.getContext("2d")?.drawImage(off, 0, 0);
    })();
    return () => { cancelled = true; };
  }, [design.back, design.sizeId, design.customWMM, design.customHMM, design.roles, design.roleFallback, design.hole, shown]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ekspor (selalu render ulang pada resolusi pilihan — tajam, tanpa panduan lubang) ──
  const holeExport = design.hole.shape !== "none" && design.hole.mark ? "mark" : "none";
  const fresh = async (side: Side): Promise<HTMLCanvasElement> => {
    const c = document.createElement("canvas");
    await renderNametagSide(c, design[side], shown, design, cacheRef.current, { ppm: exportPpm, hole: holeExport });
    return c;
  };
  const baseName = sanitizeFileName(shown.name?.replace(/\u200B/g, "") || "name-tag");
  const wrapExport = async (fn: () => Promise<void>) => {
    setInfo(null); setIsExporting(true);
    try { await fn(); } catch (err: any) { setInfo({ type: "error", text: err?.message || "Ekspor gagal." }); } finally { setIsExporting(false); }
  };

  const downloadPng = () => wrapExport(async () => {
    downloadBlob(await canvasToBlob(await fresh(activeSide)), `${baseName}-${activeSide === "front" ? "depan" : "belakang"}.png`);
    setInfo({ type: "success", text: `Name tag diunduh sebagai PNG (${exportPpm === 24 ? "600" : "300"} dpi).` });
  });
  const downloadPdf = (mode: "current" | "both") => wrapExport(async () => {
    const pdf = await PDFDocument.create();
    const wPt = sizeMM.wMM * MM_TO_PT, hPt = sizeMM.hMM * MM_TO_PT;
    for (const side of (mode === "both" ? ["front", "back"] : [activeSide]) as Side[]) {
      const img = await pdf.embedPng(new Uint8Array(await (await canvasToBlob(await fresh(side))).arrayBuffer()));
      pdf.addPage([wPt, hPt]).drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
    }
    await stampGamatoBranding(pdf);
    downloadBlob(new Blob([(await pdf.save()) as BlobPart], { type: "application/pdf" }), `${baseName}-name-tag${mode === "both" ? "" : `-${activeSide === "front" ? "depan" : "belakang"}`}.pdf`);
    setInfo({ type: "success", text: `Name tag diunduh sebagai PDF${mode === "both" ? " (2 halaman)" : ""}.` });
  });
  const downloadTent = () => wrapExport(async () => {
    const r = await exportNtSheet({
      design, records: [shown], sides: "front", cache: cacheRef.current, ppm: exportPpm,
      sheet: { paper: "a4", landscape: false, marginMm: 8, gapMm: 0, cropMarks: true, duplexMirror: false, tentFold: true },
    });
    downloadBlob(r.blob, `${baseName}-meja-nama-lipat.pdf`);
    setInfo({ type: "success", text: "PDF meja nama lipat diunduh — cetak, lipat di garis putus-putus, berdirikan." });
  });
  const printCurrent = () => wrapExport(async () => {
    printCanvasImage(await fresh(activeSide), { widthMm: sizeMM.wMM, title: `Name Tag — ${shown.name || "Gamato Piranti"}` });
  });
  const printBoth = () => wrapExport(async () => {
    printCanvasPages([await fresh("front"), await fresh("back")], { title: `Name Tag — ${shown.name || "Gamato Piranti"}`, pageSizeMm: { w: sizeMM.wMM, h: sizeMM.hMM } });
  });

  const alignOptions: { value: "left" | "center" | "right"; label: string; icon: React.ReactNode }[] = [
    { value: "left", label: "", icon: <AlignLeft className="w-4 h-4" strokeWidth={2.5} /> },
    { value: "center", label: "", icon: <AlignCenter className="w-4 h-4" strokeWidth={2.5} /> },
    { value: "right", label: "", icon: <AlignRight className="w-4 h-4" strokeWidth={2.5} /> },
  ];

  const hitHeightPct = (el: NtElement): number => {
    if (el.kind === "text") return Math.min(40, Math.max(5, ((el.fontSize * PT_PX * 1.35) / (sizeMM.hMM * PX_PER_MM)) * 100));
    if (el.kind === "qr") return (el.sizePct * sizeMM.wMM) / sizeMM.hMM;
    return el.heightPct;
  };
  const hitWidthPct = (el: NtElement): number => (el.kind === "qr" ? el.sizePct : el.widthPct);

  return (
    <div className="grid lg:grid-cols-[1fr_440px] gap-6 items-start">
      {/* LEFT: editor */}
      <div className="space-y-5">
        <GamatoDesktopRecommended toolName="Name Tag Studio" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor Name Tag</span>
          <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-2 shadow-sm">
          <ToggleRow value={activeSide} onChange={(v) => { setActiveSide(v); setSelectedId(null); }}
            options={[{ value: "front", label: "Sisi Depan", icon: <Tag className="w-4 h-4" /> }, { value: "back", label: "Sisi Belakang", icon: <FlipHorizontal2 className="w-4 h-4" /> }]} />
        </div>

        <SettingsTabBar tabs={TABS} active={tab} onChange={setTab} />

        {/* Tetap terpasang (hanya disembunyikan) agar data massal, foto, dan pemetaan tidak hilang saat berpindah tab. */}
        <div style={{ display: tab === "massal" ? "block" : "none" }} data-testid="nt-bulk-wrap">
          <NametagBulk design={design} base={rec} cache={cacheRef.current} onPreview={setBulkPreview} onAddRole={addRoleNamed} />
        </div>

        {tab === "template" && (
          <PanelCard title="Template Siap Pakai" subtitle="Setiap template punya ukuran sendiri — warna peran & ukuran kustom Anda tetap dipertahankan">
            <div className="grid grid-cols-2 gap-2.5">
              {NT_TEMPLATES.map((t) => (
                <button key={t.id} type="button" data-testid={`nt-tpl-${t.id}`} onClick={() => applyTemplate(t.id)}
                  className="text-left rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 p-3 transition-all group">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    <Sparkles className="w-3 h-3 shrink-0 text-indigo-400" />{t.name}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-snug">{t.desc}</p>
                  <p className="text-[10px] font-semibold text-indigo-500/80 mt-1.5">{t.size}</p>
                </button>
              ))}
            </div>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </PanelCard>
        )}

        {tab === "data" && (
          <PanelCard title="Data Peserta" subtitle="Sumber teks untuk elemen yang ditautkan — untuk satu name tag (massal ada di tab Massal)">
            <div className="grid sm:grid-cols-2 gap-3">
              {NT_FIELD_KEYS.map((f) => (
                <Input key={f} label={NT_FIELD_LABEL[f]} value={rec[f]} onChange={(e) => updateRec({ [f]: e.target.value }, { continuous: true })} data-testid={`nt-data-${f}`} />
              ))}
            </div>
            <div>
              <Label>Pilih peran cepat</Label>
              <div className="flex flex-wrap gap-1.5 mt-1" data-testid="nt-role-chips">
                {design.roles.map((r) => (
                  <button key={r.role} type="button" onClick={() => updateRec({ role: r.role })} aria-pressed={rec.role.toLowerCase() === r.role.toLowerCase()}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-[11px] font-semibold transition-all",
                      rec.role.toLowerCase() === r.role.toLowerCase() ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />{r.role}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Foto contoh (untuk elemen Foto)</Label>
              <div className="flex items-center gap-3 mt-1">
                {rec.photo ? <img src={rec.photo} alt="Foto contoh" className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700" /> : <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-300"><UserSquare2 className="w-6 h-6" /></div>}
                <label className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <ImageIcon className="w-3.5 h-3.5" />{rec.photo ? "Ganti foto" : "Unggah foto"}
                  <input type="file" accept="image/*" className="hidden" data-testid="nt-sample-photo" onChange={(e) => { void uploadSamplePhoto(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                </label>
                {rec.photo && <Btn variant="ghost" className="!py-1.5" onClick={() => updateRec({ photo: undefined })}><Trash2 className="w-4 h-4" /></Btn>}
              </div>
            </div>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </PanelCard>
        )}

        {tab === "ukuran" && (
          <>
            <PanelCard title="Ukuran Name Tag" subtitle="Elemen menyesuaikan otomatis (posisi berbasis persentase)">
              <div className="grid grid-cols-2 gap-2">
                {NT_SIZES.map((s) => (
                  <button key={s.id} type="button" onClick={() => updateDesign({ sizeId: s.id as NtSizeId })} data-testid={`nt-size-${s.id}`}
                    className={cn("flex flex-col gap-0.5 py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all text-left",
                      design.sizeId === s.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600")}>
                    <span className="flex items-center gap-2"><Ruler className="w-3.5 h-3.5 shrink-0" />{s.label}</span>
                    <span className="pl-5 text-[10px] font-normal opacity-70">{s.hint}</span>
                  </button>
                ))}
              </div>
              {design.sizeId === "custom" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Input label="Lebar (mm)" type="number" min={30} max={300} value={design.customWMM} onChange={(e) => updateDesign({ customWMM: Number(e.target.value) || 90 }, { continuous: true })} />
                  <Input label="Tinggi (mm)" type="number" min={20} max={300} value={design.customHMM} onChange={(e) => updateDesign({ customHMM: Number(e.target.value) || 55 }, { continuous: true })} />
                </div>
              )}
            </PanelCard>
            <PanelCard title="Lubang Tali (Lanyard)" subtitle="Panduan lubang tampil di pratinjau (garis putus-putus merah) — tidak ikut tercetak kecuali penanda dinyalakan">
              <ToggleRow value={design.hole.shape} onChange={(v) => updateHole({ shape: v })}
                options={[{ value: "none", label: "Tanpa" }, { value: "slot", label: "Slot 14×3,5" }, { value: "circle", label: "Bulat Ø5" }]} />
              {design.hole.shape !== "none" && (
                <>
                  <ToggleRow value={design.hole.edge} onChange={(v) => updateHole({ edge: v })} options={[{ value: "top", label: "Di atas" }, { value: "left", label: "Di kiri" }]} />
                  <SliderField label="Jarak pusat lubang dari tepi" unit=" mm" min={2} max={30} step={0.5} value={design.hole.offsetMM} onChange={(v) => updateHole({ offsetMM: v }, { continuous: true })} />
                  <GamatoCheckbox checked={design.hole.mark} onChange={(v) => updateHole({ mark: v })} testId="nt-hole-mark" label={<span className="text-sm text-slate-600 dark:text-slate-300">Cetak garis penanda lubang (panduan melubangi)</span>} />
                  <p className="text-xs text-slate-400 dark:text-slate-500">Jaga agar teks & QR tidak menutupi area lubang.</p>
                </>
              )}
            </PanelCard>
            <PanelCard title="Kualitas Ekspor" subtitle="Berlaku untuk PNG, PDF, dan cetak dari tombol di samping pratinjau">
              <GamatoSelect value={String(exportPpm)} onChange={(e) => setExportPpm(Number(e.target.value) as 12 | 24)} data-testid="nt-quality">
                <option value="12">Standar — 300 dpi (cepat, cukup untuk cetak biasa)</option>
                <option value="24">Tinggi — 600 dpi (paling tajam, berkas lebih besar)</option>
              </GamatoSelect>
              <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
            </PanelCard>
          </>
        )}

        {tab === "latar" && (
          <PanelCard title={`Latar Belakang — ${activeSide === "front" ? "Sisi Depan" : "Sisi Belakang"}`} subtitle="Warna solid, gradasi, atau gambar kustom">
            <ToggleRow value={currentSide.background.type} onChange={setBgType}
              options={[{ value: "solid", label: "Warna", icon: <Palette className="w-3.5 h-3.5" /> }, { value: "gradient", label: "Gradasi", icon: <Layers className="w-3.5 h-3.5" /> }, { value: "image", label: "Gambar", icon: <ImageIcon className="w-3.5 h-3.5" /> }]} />
            {currentSide.background.type === "solid" && <GamatoColorPicker label="Warna Latar" value={currentSide.background.color} onChange={(c) => bgPatch({ color: c })} />}
            {currentSide.background.type === "gradient" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <GamatoColorPicker label="Warna Awal" value={currentSide.background.from} onChange={(c) => bgPatch({ from: c })} />
                  <GamatoColorPicker label="Warna Akhir" value={currentSide.background.to} onChange={(c) => bgPatch({ to: c })} />
                </div>
                <SliderField label="Sudut Gradasi" unit="°" min={0} max={360} value={currentSide.background.angle} onChange={(v) => bgPatch({ angle: v }, { continuous: true })} />
              </div>
            )}
            {currentSide.background.type === "image" && (
              <div className="space-y-4">
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <ImageIcon className="w-4 h-4" />{currentSide.background.src ? "Ganti Gambar Latar" : "Unggah Gambar Latar"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setBgImageFile(e.target.files?.[0] ?? null)} />
                </label>
                {currentSide.background.src && (
                  <>
                    <ToggleRow value={currentSide.background.fit} onChange={(v) => bgPatch({ fit: v })} options={[{ value: "cover", label: "Penuhi (Cover)" }, { value: "contain", label: "Sesuaikan (Contain)" }]} />
                    <div className="grid grid-cols-2 gap-3 items-end">
                      <GamatoColorPicker label="Warna Overlay" value={currentSide.background.overlayColor} onChange={(c) => bgPatch({ overlayColor: c })} />
                      <SliderField label="Opasitas Overlay" unit="%" min={0} max={100} value={Math.round(currentSide.background.overlayOpacity * 100)} onChange={(v) => bgPatch({ overlayOpacity: v / 100 }, { continuous: true })} />
                    </div>
                  </>
                )}
              </div>
            )}
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </PanelCard>
        )}

        {tab === "peran" && (
          <PanelCard title="Warna per Peran" subtitle="Pita, blok, dan teks yang diberi tanda “ikuti warna peran” otomatis berganti warna sesuai peran tiap orang">
            <div className="space-y-2" data-testid="nt-roles">
              {design.roles.map((r, i) => (
                <div key={i} className="flex items-center gap-2" data-testid="nt-role-row">
                  <Input value={r.role} onChange={(e) => setRoles(design.roles.map((x, k) => (k === i ? { ...x, role: e.target.value } : x)), { continuous: true })} aria-label={`Nama peran ${i + 1}`} className="!py-2" />
                  <GamatoColorPicker value={r.color} onChange={(c) => setRoles(design.roles.map((x, k) => (k === i ? { ...x, color: c } : x)))} />
                  <button type="button" aria-label="Hapus peran" onClick={() => setRoles(design.roles.filter((_, k) => k !== i))} className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn variant="secondary" onClick={() => addRoleNamed(`Peran ${design.roles.length + 1}`)} data-testid="nt-role-add"><Plus className="w-4 h-4" />Tambah peran</Btn>
              <Btn variant="ghost" onClick={() => updateDesign({ roles: defaultRoles(), roleFallback: "#475569" })}>Setel ulang bawaan</Btn>
            </div>
            <GamatoColorPicker label="Warna cadangan (peran tak dikenal / kosong)" value={design.roleFallback} onChange={(c) => updateDesign({ roleFallback: c })} />
            <p className="text-xs text-slate-400 dark:text-slate-500">Pencocokan peran tidak peka huruf besar/kecil dan mengabaikan spasi ganda. Di tab Elemen, centang “Ikuti warna peran” pada bentuk/teks/foto yang ingin berubah warna.</p>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </PanelCard>
        )}

        {tab === "elemen" && (
          <>
            <PanelCard title={`Elemen — ${activeSide === "front" ? "Sisi Depan" : "Sisi Belakang"}`} subtitle="Tambah, seret, dan atur lapisan bebas">
              <div className="grid grid-cols-3 gap-2">
                <Btn variant="secondary" onClick={addText} className="text-xs gap-1.5" data-testid="nt-add-text"><Type className="w-3.5 h-3.5" />Teks</Btn>
                <Btn variant="secondary" onClick={addPhoto} className="text-xs gap-1.5" data-testid="nt-add-photo"><UserSquare2 className="w-3.5 h-3.5" />Foto</Btn>
                <Btn variant="secondary" onClick={addQr} className="text-xs gap-1.5" data-testid="nt-add-qr"><QrCode className="w-3.5 h-3.5" />QR</Btn>
                <Btn variant="secondary" onClick={addBarcode} className="text-xs gap-1.5" data-testid="nt-add-barcode"><Barcode className="w-3.5 h-3.5" />Barcode</Btn>
                <label className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all">
                  <ImageIcon className="w-3.5 h-3.5" />Logo
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void addImageFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                </label>
                <div className="flex gap-1">
                  {([["rect", "Kotak", <Square key="r" className="w-4 h-4" />], ["circle", "Lingkaran", <Circle key="c" className="w-4 h-4" />], ["line", "Garis", <LineIcon key="l" className="w-4 h-4" />]] as const).map(([k, t, ic]) => (
                    <button key={k} type="button" onClick={() => addShape(k)} title={t} aria-label={`Tambah ${t}`} data-testid={`nt-add-${k}`}
                      className="flex-1 inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800">{ic}</button>
                  ))}
                </div>
              </div>

              {currentSide.elements.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">Belum ada elemen di sisi ini.</p>
              ) : (
                <div className="space-y-1.5" data-testid="nt-elements">
                  {currentSide.elements.map((el, idx) => (
                    <div key={el.id} onClick={() => setSelectedId(el.id)} data-testid="nt-el-row"
                      className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all", selectedId === el.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-transparent bg-slate-50 dark:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700")}>
                      <span className="text-slate-400 dark:text-slate-500 shrink-0">{elIcon(el)}</span>
                      <span className="flex-1 min-w-0 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{elLabel(el)}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveEl(el.id, -1); }} disabled={idx === 0} className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30" title="Ke belakang"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveEl(el.id, 1); }} disabled={idx === currentSide.elements.length - 1} className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30" title="Ke depan"><ChevronDown className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); dupEl(el.id); }} className="p-1 rounded text-slate-400 hover:text-indigo-600" title="Duplikat"><Copy className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); removeEl(el.id); }} className="p-1 rounded text-slate-400 hover:text-red-500" title="Hapus" data-testid="nt-el-del"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </PanelCard>

            {selected && (
              <PanelCard title="Pengaturan Elemen" subtitle="Seret elemen langsung di pratinjau untuk mengatur posisi">
                {selected.kind === "text" && <TextPanel el={selected} onChange={(p, o) => updateElement(selected.id, p, o)} customFonts={customFonts} isFontLoading={isFontLoading} fontError={fontError} onUploadFont={addCustomFont} onRemoveCustomFont={handleRemoveCustomFont} alignOptions={alignOptions} />}
                {selected.kind === "shape" && <ShapePanel el={selected} onChange={(p, o) => updateElement(selected.id, p, o)} />}
                {selected.kind === "image" && <ImagePanel el={selected} onChange={(p, o) => updateElement(selected.id, p, o)} onReplaceFile={(f) => replaceImage(selected.id, f)} />}
                {selected.kind === "photo" && <PhotoPanel el={selected} onChange={(p, o) => updateElement(selected.id, p, o)} />}
                {selected.kind === "qr" && <QrPanel el={selected} onChange={(p, o) => updateElement(selected.id, p, o)} />}
                {selected.kind === "barcode" && <BarcodePanel el={selected} onChange={(p, o) => updateElement(selected.id, p, o)} />}
              </PanelCard>
            )}
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </>
        )}
      </div>

      {/* RIGHT: preview + export */}
      <PreviewJumpFab targetId="nametag-preview" />
      <div id="nametag-preview" className="space-y-4 lg:sticky lg:top-20 scroll-mt-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1 [scrollbar-width:thin]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pratinjau Langsung</p>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500"><Move className="w-3 h-3" />Seret elemen untuk atur posisi</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 shadow-sm">
          <ToggleRow value={activeSide} onChange={(v) => { setActiveSide(v); setSelectedId(null); }}
            options={[{ value: "front", label: "Depan", icon: <Tag className="w-3.5 h-3.5" /> }, { value: "back", label: "Belakang", icon: <FlipHorizontal2 className="w-3.5 h-3.5" /> }]} />
        </div>

        <div className="flex justify-center">
          <div ref={wrapRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            style={{ aspectRatio: `${sizeMM.wMM} / ${sizeMM.hMM}`, width: sizeMM.hMM > sizeMM.wMM ? `min(100%, ${Math.round((sizeMM.wMM / sizeMM.hMM) * 560)}px)` : "100%" }}
            className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm select-none touch-none bg-slate-100 dark:bg-slate-800">
            {/* Sembunyikan dengan style inline (bukan kelas `hidden`): `canvas { display:block }` di index.css mengalahkan utilitas Tailwind. */}
            <canvas ref={frontRef} data-testid="nt-canvas-front" className="w-full h-full" style={{ display: activeSide === "front" ? "block" : "none" }} />
            <canvas ref={backRef} data-testid="nt-canvas-back" className="w-full h-full" style={{ display: activeSide === "back" ? "block" : "none" }} />
            {currentSide.elements.map((el) => {
              const xOrigin = el.kind === "text" ? (el.align === "left" ? "0%" : el.align === "right" ? "-100%" : "-50%") : "-50%";
              return (
                <div key={el.id} data-testid="nt-hit" onPointerDown={(e) => onPointerDownEl(e, el.id)}
                  style={{ position: "absolute", left: `${el.xPct}%`, top: `${el.yPct}%`, width: `${hitWidthPct(el)}%`, height: `${hitHeightPct(el)}%`, transform: `translate(${xOrigin}, -50%)${el.rotation && el.kind !== "text" ? ` rotate(${el.rotation}deg)` : ""}` }}
                  className={cn("cursor-move rounded", selectedId === el.id ? "ring-2 ring-indigo-500" : "ring-1 ring-transparent hover:ring-indigo-300")}
                  title={elLabel(el)} />
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500" data-testid="nt-size-info">{sizeMM.wMM} × {sizeMM.hMM} mm · {Math.round(sizeMM.wMM * PX_PER_MM * (exportPpm / PX_PER_MM))}×{Math.round(sizeMM.hMM * PX_PER_MM * (exportPpm / PX_PER_MM))}px saat ekspor</p>

        {info && <GamatoInlineAlert message={info.text} tone={info.type} />}

        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={downloadPng} disabled={isExporting} className="gap-2" data-testid="nt-png">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PNG ({activeSide === "front" ? "Depan" : "Belakang"})
          </Btn>
          <Btn onClick={() => downloadPdf("current")} disabled={isExporting} variant="secondary" className="gap-2" data-testid="nt-pdf"><Download className="w-4 h-4" /> PDF (Sisi Ini)</Btn>
          <Btn onClick={() => downloadPdf("both")} disabled={isExporting} variant="secondary" className="gap-2" data-testid="nt-pdf-both"><Layers className="w-4 h-4" /> PDF (2 Sisi)</Btn>
          <Btn onClick={downloadTent} disabled={isExporting} variant="secondary" className="gap-2" data-testid="nt-tent"><Tag className="w-4 h-4" /> PDF Lipat (Tent)</Btn>
          <Btn onClick={printCurrent} disabled={isExporting} variant="secondary" className="gap-2" data-testid="nt-print-one"><Printer className="w-4 h-4" /> Cetak Sisi Ini</Btn>
          <Btn onClick={printBoth} disabled={isExporting} variant="secondary" className="gap-2" data-testid="nt-print-both"><Printer className="w-4 h-4" /> Cetak 2 Sisi</Btn>
        </div>

        <div className="text-center"><SectionBadge>Diproses langsung di perangkatmu</SectionBadge></div>
      </div>
    </div>
  );
}

// ─────────────────────────── Panel elemen ───────────────────────────

type PatchFn<T> = (patch: Partial<T>, opts?: { continuous?: boolean }) => void;

function SliderField({ label, unit, min, max, step = 1, value, onChange }: { label: string; unit: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between mb-1"><Label>{label}</Label><span className="text-xs text-slate-400 dark:text-slate-500">{value}{unit}</span></div>
      <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
    </div>
  );
}

function CommonControls<T extends NtElement>({ el, onChange }: { el: T; onChange: PatchFn<NtElement> }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Rotasi" unit="°" min={-180} max={180} value={el.rotation} onChange={(v) => onChange({ rotation: v }, { continuous: true })} />
        <SliderField label="Opasitas" unit="%" min={0} max={100} value={Math.round(el.opacity * 100)} onChange={(v) => onChange({ opacity: v / 100 }, { continuous: true })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Posisi X" unit="%" min={0} max={100} step={0.5} value={el.xPct} onChange={(v) => onChange({ xPct: v }, { continuous: true })} />
        <SliderField label="Posisi Y" unit="%" min={0} max={100} step={0.5} value={el.yPct} onChange={(v) => onChange({ yPct: v }, { continuous: true })} />
      </div>
    </>
  );
}

const styleBtn = (on: boolean) => cn("flex items-center justify-center p-2.5 rounded-lg border-2", on ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400");

function TextPanel({ el, onChange, customFonts, isFontLoading, fontError, onUploadFont, onRemoveCustomFont, alignOptions }: {
  el: NtTextEl; onChange: PatchFn<NtTextEl>; customFonts: ReturnType<typeof useCustomFonts>["customFonts"]; isFontLoading: boolean; fontError: string | null;
  onUploadFont: (f: File | null) => void; onRemoveCustomFont: (id: string) => void; alignOptions: { value: "left" | "center" | "right"; label: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Sumber Teks</Label>
        <GamatoSelect value={el.bind ?? ""} onChange={(e) => onChange({ bind: (e.target.value || null) as NtTextEl["bind"] })} data-testid="nt-bind-select">
          <option value="">Teks Bebas</option>
          {NT_FIELD_KEYS.map((f) => <option key={f} value={f}>{`Tertaut: ${NT_FIELD_LABEL[f]}`}</option>)}
        </GamatoSelect>
      </div>
      <Textarea label={el.bind ? "Teks Cadangan (jika data kosong)" : "Isi Teks"} rows={2} value={el.text} onChange={(e) => onChange({ text: e.target.value }, { continuous: true })} />
      <div className="grid grid-cols-2 gap-3 items-start">
        <FontPicker hideUpload value={el.fontFamily} onChange={(family) => onChange({ fontFamily: family })} customFonts={customFonts} isFontLoading={isFontLoading} fontError={fontError} onUpload={onUploadFont} onRemoveCustomFont={onRemoveCustomFont} />
        <Input label="Ukuran (pt)" type="number" min={4} max={160} step={0.5} value={el.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) || 11 }, { continuous: true })} />
      </div>
      <FontPicker hideSelect value={el.fontFamily} onChange={(family) => onChange({ fontFamily: family })} customFonts={customFonts} isFontLoading={isFontLoading} fontError={fontError} onUpload={onUploadFont} onRemoveCustomFont={onRemoveCustomFont} />

      <GamatoColorPicker label="Warna Teks" value={el.color} onChange={(c) => onChange({ color: c })} />
      <GamatoCheckbox checked={el.colorFromRole} onChange={(v) => onChange({ colorFromRole: v })} testId="nt-text-role" label={<span className="text-sm text-slate-600 dark:text-slate-300">Ikuti warna peran (menggantikan warna di atas)</span>} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Gaya</Label>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => onChange({ bold: !el.bold })} aria-pressed={el.bold} aria-label="Tebal" className={styleBtn(el.bold)}><Bold className="w-4 h-4" /></button>
            <button type="button" onClick={() => onChange({ italic: !el.italic })} aria-pressed={el.italic} aria-label="Miring" className={styleBtn(el.italic)}><Italic className="w-4 h-4" /></button>
            <button type="button" onClick={() => onChange({ uppercase: !el.uppercase })} aria-pressed={el.uppercase} aria-label="Huruf besar" className={styleBtn(el.uppercase)}><CaseUpper className="w-4 h-4" /></button>
          </div>
        </div>
        <div>
          <Label>Perataan</Label>
          <div className="grid grid-cols-3 gap-2">
            {alignOptions.map((opt) => <button key={opt.value} type="button" onClick={() => onChange({ align: opt.value })} aria-pressed={el.align === opt.value} aria-label={`Rata ${opt.value}`} className={styleBtn(el.align === opt.value)}>{opt.icon}</button>)}
          </div>
        </div>
      </div>

      <div>
        <Label>Jika teks terlalu panjang</Label>
        <GamatoSelect value={el.fit} onChange={(e) => onChange({ fit: e.target.value as NtTextEl["fit"] })} data-testid="nt-fit">
          <option value="none">Apa adanya (bisa meluap)</option>
          <option value="shrink">Kecilkan otomatis — 1 baris</option>
          <option value="wrap">Bungkus ke beberapa baris + kecilkan bila perlu</option>
        </GamatoSelect>
        {el.fit === "wrap" && <div className="mt-3"><SliderField label="Maksimum baris" unit=" baris" min={1} max={4} value={el.maxLines} onChange={(v) => onChange({ maxLines: v })} /></div>}
      </div>

      <SliderField label="Lebar Kotak Teks" unit="%" min={10} max={100} value={el.widthPct} onChange={(v) => onChange({ widthPct: v }, { continuous: true })} />
      <SliderField label="Jarak Antar Huruf" unit="pt" min={0} max={10} step={0.5} value={el.letterSpacing} onChange={(v) => onChange({ letterSpacing: v }, { continuous: true })} />
      <CommonControls el={el} onChange={onChange as PatchFn<NtElement>} />
    </div>
  );
}

function ShapePanel({ el, onChange }: { el: NtShapeEl; onChange: PatchFn<NtShapeEl> }) {
  return (
    <div className="space-y-4">
      <ToggleRow value={el.shape} onChange={(v) => onChange({ shape: v })} options={[{ value: "rect", label: "Kotak", icon: <Square className="w-3.5 h-3.5" /> }, { value: "circle", label: "Lingkaran", icon: <Circle className="w-3.5 h-3.5" /> }, { value: "line", label: "Garis", icon: <LineIcon className="w-3.5 h-3.5" /> }]} />
      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Lebar" unit="%" min={1} max={150} step={0.5} value={el.widthPct} onChange={(v) => onChange({ widthPct: v }, { continuous: true })} />
        <SliderField label="Tinggi" unit="%" min={0.2} max={150} step={0.1} value={el.heightPct} onChange={(v) => onChange({ heightPct: v }, { continuous: true })} />
      </div>
      <GamatoCheckbox checked={el.hasFill} onChange={(v) => onChange({ hasFill: v })} label={<span className="text-sm text-slate-600 dark:text-slate-300">Isi warna</span>} />
      {el.hasFill && (
        <>
          <GamatoColorPicker label="Warna Isi" value={el.fill} onChange={(c) => onChange({ fill: c })} />
          <GamatoCheckbox checked={el.fillFromRole} onChange={(v) => onChange({ fillFromRole: v })} testId="nt-shape-role" label={<span className="text-sm text-slate-600 dark:text-slate-300">Ikuti warna peran (pita/blok berganti per orang)</span>} />
        </>
      )}
      {el.shape !== "line" && (
        <>
          <GamatoCheckbox checked={el.hasStroke} onChange={(v) => onChange({ hasStroke: v })} label={<span className="text-sm text-slate-600 dark:text-slate-300">Garis tepi</span>} />
          {el.hasStroke && (
            <div className="grid grid-cols-2 gap-3 items-end">
              <GamatoColorPicker label="Warna Tepi" value={el.stroke} onChange={(c) => onChange({ stroke: c })} />
              <SliderField label="Tebal" unit="px" min={1} max={20} value={el.strokeWidth} onChange={(v) => onChange({ strokeWidth: v }, { continuous: true })} />
            </div>
          )}
        </>
      )}
      {el.shape === "rect" && <SliderField label="Sudut Membulat" unit="px" min={0} max={120} value={el.radius} onChange={(v) => onChange({ radius: v }, { continuous: true })} />}
      <CommonControls el={el} onChange={onChange as PatchFn<NtElement>} />
    </div>
  );
}

function ImagePanel({ el, onChange, onReplaceFile }: { el: NtImageEl; onChange: PatchFn<NtImageEl>; onReplaceFile: (f: File | null) => void }) {
  return (
    <div className="space-y-4">
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-3 cursor-pointer hover:border-indigo-400 text-sm font-semibold text-slate-600 dark:text-slate-300">
        <ImageIcon className="w-4 h-4" />Ganti gambar
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { onReplaceFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Lebar" unit="%" min={2} max={150} step={0.5} value={el.widthPct} onChange={(v) => onChange({ widthPct: v }, { continuous: true })} />
        <SliderField label="Tinggi" unit="%" min={2} max={150} step={0.5} value={el.heightPct} onChange={(v) => onChange({ heightPct: v }, { continuous: true })} />
      </div>
      <GamatoCheckbox checked={el.rounded} onChange={(v) => onChange({ rounded: v })} label={<span className="text-sm text-slate-600 dark:text-slate-300">Sudut membulat</span>} />
      <GamatoCheckbox checked={el.circle} onChange={(v) => onChange({ circle: v })} label={<span className="text-sm text-slate-600 dark:text-slate-300">Potong bulat</span>} />
      <CommonControls el={el} onChange={onChange as PatchFn<NtElement>} />
    </div>
  );
}

function PhotoPanel({ el, onChange }: { el: NtPhotoEl; onChange: PatchFn<NtPhotoEl> }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">Bingkai foto per orang. Foto contoh di tab <b>Data Peserta</b>; untuk banyak orang, unggah foto di tab <b>Massal</b> (dicocokkan lewat nama berkas / nama).</p>
      <ToggleRow value={el.shape} onChange={(v) => onChange({ shape: v })} options={[{ value: "circle", label: "Bulat" }, { value: "rounded", label: "Membulat" }, { value: "square", label: "Kotak" }]} />
      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Lebar" unit="%" min={5} max={100} step={0.5} value={el.widthPct} onChange={(v) => onChange({ widthPct: v }, { continuous: true })} />
        <SliderField label="Tinggi" unit="%" min={5} max={100} step={0.5} value={el.heightPct} onChange={(v) => onChange({ heightPct: v }, { continuous: true })} />
      </div>
      <SliderField label="Titik fokus potong (atas ↔ bawah)" unit="%" min={0} max={100} value={el.focusY} onChange={(v) => onChange({ focusY: v }, { continuous: true })} />
      <SliderField label="Tebal bingkai" unit="px" min={0} max={30} value={el.borderWidth} onChange={(v) => onChange({ borderWidth: v }, { continuous: true })} />
      {el.borderWidth > 0 && (
        <>
          <GamatoColorPicker label="Warna Bingkai" value={el.borderColor} onChange={(c) => onChange({ borderColor: c })} />
          <GamatoCheckbox checked={el.borderFromRole} onChange={(v) => onChange({ borderFromRole: v })} label={<span className="text-sm text-slate-600 dark:text-slate-300">Bingkai ikuti warna peran</span>} />
        </>
      )}
      <CommonControls el={el} onChange={onChange as PatchFn<NtElement>} />
    </div>
  );
}

const TOKENS = ["{id}", "{nama}", "{peran}", "{instansi}", "{grup}", "{acara}", "{catatan}"];

function PayloadField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="space-y-2">
      <Input label={label} value={value} onChange={(e) => onChange(e.target.value)} data-testid="nt-payload" />
      <div className="flex flex-wrap gap-1.5">
        {TOKENS.map((t) => <button key={t} type="button" onClick={() => onChange(value + t)} className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20">{t}</button>)}
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">Token diganti otomatis dengan data tiap orang. Contoh: <span className="font-mono">https://acara.id/hadir/{"{id}"}</span> atau teks bebas seperti <span className="font-mono">{"{nama}"} · {"{id}"}</span>.</p>
    </div>
  );
}

function QrPanel({ el, onChange }: { el: NtQrEl; onChange: PatchFn<NtQrEl> }) {
  return (
    <div className="space-y-4">
      <PayloadField label="Isi QR" value={el.payload} onChange={(v) => onChange({ payload: v }, { continuous: true })} />
      <SliderField label="Ukuran QR (lebar kartu)" unit="%" min={8} max={80} step={0.5} value={el.sizePct} onChange={(v) => onChange({ sizePct: v }, { continuous: true })} />
      <ToggleRow value={el.style} onChange={(v) => onChange({ style: v })} options={[{ value: "square", label: "Kotak" }, { value: "dots", label: "Titik" }]} />
      <div className="grid grid-cols-2 gap-3">
        <GamatoColorPicker label="Warna QR" value={el.fg} onChange={(c) => onChange({ fg: c })} />
        <GamatoColorPicker label="Warna Alas" value={el.bg} onChange={(c) => onChange({ bg: c })} />
      </div>
      <GamatoCheckbox checked={el.plate} onChange={(v) => onChange({ plate: v })} label={<span className="text-sm text-slate-600 dark:text-slate-300">Alas berwarna + tepi putih (disarankan agar mudah dipindai)</span>} />
      <div>
        <Label>Tingkat koreksi galat</Label>
        <GamatoSelect value={el.ecc} onChange={(e) => onChange({ ecc: e.target.value as NtQrEl["ecc"] })}>
          <option value="L">L — paling ringkas</option><option value="M">M — seimbang (disarankan)</option><option value="Q">Q — tahan lecet</option><option value="H">H — paling tahan</option>
        </GamatoSelect>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">Pakai kontras tinggi (gelap di atas terang) dan jangan perkecil di bawah ±15 mm agar terbaca ponsel.</p>
      <CommonControls el={el} onChange={onChange as PatchFn<NtElement>} />
    </div>
  );
}

function BarcodePanel({ el, onChange }: { el: NtBarcodeEl; onChange: PatchFn<NtBarcodeEl> }) {
  return (
    <div className="space-y-4">
      <PayloadField label="Isi Barcode (CODE 128)" value={el.payload} onChange={(v) => onChange({ payload: v }, { continuous: true })} />
      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Lebar" unit="%" min={10} max={100} step={0.5} value={el.widthPct} onChange={(v) => onChange({ widthPct: v }, { continuous: true })} />
        <SliderField label="Tinggi" unit="%" min={2} max={40} step={0.5} value={el.heightPct} onChange={(v) => onChange({ heightPct: v }, { continuous: true })} />
      </div>
      <GamatoColorPicker label="Warna Garis" value={el.color} onChange={(c) => onChange({ color: c })} />
      <GamatoCheckbox checked={el.plate} onChange={(v) => onChange({ plate: v })} label={<span className="text-sm text-slate-600 dark:text-slate-300">Alas putih di belakang barcode</span>} />
      <CommonControls el={el} onChange={onChange as PatchFn<NtElement>} />
    </div>
  );
}
