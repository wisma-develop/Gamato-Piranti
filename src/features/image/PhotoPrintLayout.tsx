import React, { useEffect, useMemo, useRef, useState } from "react";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import {
  Printer, Trash2, Plus, Minus, ChevronLeft, ChevronRight,
  Images, LayoutGrid, Ruler, Scissors, Download, FileText, Loader2,
  ImageOff,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { printCanvasPages } from "@/lib/printCanvas";
import { Label, Input, Select, Btn, SectionBadge } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { Dropzone } from "@/components/ui/Dropzone";
import { PanelCard } from "@/components/ui/PanelCard";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { SettingsTabBar, NextTabHint, type SettingsTabDef } from "@/components/ui/SettingsTabs";
import {
  computeGrid,
  buildQueue,
  paginateQueue,
  renderSheet,
  renderAllSheets,
  mmToPt,
  type PrintPhotoItem,
  type PrintLayoutSettings,
  type FocusX,
  type FocusY,
} from "@/lib/photoPrintEngine";
import { PAPER_SIZES, PHOTO_SIZES, getPaperSize, getPhotoSize } from "@/lib/photoPrintPresets";
import { GamatoSelect } from "@/components/ui/GamatoSelect";
import { msgStarts, tr } from "@/i18n";

let itemCounter = 0;
const newItemId = () => tr("print-item-{0}-{1}", Date.now(), itemCounter++);

type PrintState = {
  paperId: string;
  customPaperWMm: number;
  customPaperHMm: number;
  photoId: string;
  customPhotoWMm: number;
  customPhotoHMm: number;
  orientation: "auto" | "portrait" | "landscape";
  marginMm: number;
  gutterMm: number;
  showCutGuides: boolean;
  fitMode: "cover" | "contain";
  items: PrintPhotoItem[];
};

const DEFAULT_STATE: PrintState = {
  paperId: "a4",
  customPaperWMm: 210,
  customPaperHMm: 297,
  photoId: "pf-3x4",
  customPhotoWMm: 30,
  customPhotoHMm: 40,
  orientation: "auto",
  marginMm: 5,
  gutterMm: 3,
  showCutGuides: true,
  fitMode: "cover",
  items: [],
};

type TabId = "foto" | "ukuran" | "tataletak";

const TABS: SettingsTabDef<TabId>[] = [
  { id: "foto", label: tr("Foto & Jumlah"), icon: <Images className="w-3.5 h-3.5" /> },
  { id: "ukuran", label: tr("Ukuran Foto & Kertas"), icon: <Ruler className="w-3.5 h-3.5" /> },
  { id: "tataletak", label: tr("Tata Letak"), icon: <LayoutGrid className="w-3.5 h-3.5" /> },
];

const FOCUS_X_OPTIONS: { id: FocusX; label: string }[] = [
  { id: "left", label: tr("Kiri") },
  { id: "center", label: tr("Tengah") },
  { id: "right", label: tr("Kanan") },
];
const FOCUS_Y_OPTIONS: { id: FocusY; label: string }[] = [
  { id: "top", label: tr("Atas") },
  { id: "center", label: tr("Tengah") },
  { id: "bottom", label: tr("Bawah") },
];

export const PhotoPrintLayout: React.FC = () => {
  const history = useHistoryState<PrintState>(() => DEFAULT_STATE);
  const state = history.state;
  const { schedule: scheduleCommit } = useDebouncedCommit(history.commit, 500);
  const updateField = <K extends keyof PrintState>(key: K, value: PrintState[K], opts?: { continuous?: boolean }) => {
    history.set((prev) => ({ ...prev, [key]: value }), { commit: !opts?.continuous });
    if (opts?.continuous) scheduleCommit();
  };
  const updateItem = (id: string, patch: Partial<PrintPhotoItem>, opts?: { continuous?: boolean }) => {
    history.set((prev) => ({ ...prev, items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }), { commit: !opts?.continuous });
    if (opts?.continuous) scheduleCommit();
  };

  const [tab, setTab] = useState<TabId>("foto");
  const [isDragging, setIsDragging] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Object URLs are created once per uploaded file and kept alive for the
  // component's whole lifetime (never revoked on remove) — Undo can bring a
  // removed photo back, and a prematurely-revoked URL would render blank.
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const addFiles = (incoming: File[]) => {
    const imgs = incoming.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    const newItems: PrintPhotoItem[] = imgs.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      return { id: newItemId(), objectUrl: url, fileName: file.name, copies: 4, focusX: "center", focusY: "center" };
    });
    history.set((prev) => ({ ...prev, items: [...prev.items, ...newItems] }));
    setInfo(null);
  };

  const removeItem = (id: string) => history.set((prev) => ({ ...prev, items: prev.items.filter((it) => it.id !== id) }));

  // ── Resolve effective paper/photo dimensions (preset or custom) ──
  const paperPreset = getPaperSize(state.paperId);
  const paperWMm = state.paperId === "custom" ? state.customPaperWMm : paperPreset?.wMm ?? 210;
  const paperHMm = state.paperId === "custom" ? state.customPaperHMm : paperPreset?.hMm ?? 297;
  const photoPreset = getPhotoSize(state.photoId);
  const photoWMm = state.photoId === "custom" ? state.customPhotoWMm : photoPreset?.wMm ?? 30;
  const photoHMm = state.photoId === "custom" ? state.customPhotoHMm : photoPreset?.hMm ?? 40;

  const settings: PrintLayoutSettings = useMemo(
    () => ({
      paperWMm,
      paperHMm,
      photoWMm,
      photoHMm,
      orientation: state.orientation,
      marginMm: state.marginMm,
      gutterMm: state.gutterMm,
      showCutGuides: state.showCutGuides,
      fitMode: state.fitMode,
    }),
    [paperWMm, paperHMm, photoWMm, photoHMm, state.orientation, state.marginMm, state.gutterMm, state.showCutGuides, state.fitMode]
  );

  const grid = useMemo(() => computeGrid(settings), [settings]);
  const queue = useMemo(() => buildQueue(state.items), [state.items]);
  const sheets = useMemo(() => paginateQueue(queue, grid.perSheet), [queue, grid.perSheet]);
  const totalCopies = queue.length;
  const totalPhotos = state.items.length;

  // Clamp the currently-viewed sheet whenever the sheet count shrinks (e.g. after removing a photo).
  useEffect(() => {
    if (sheetIndex > 0 && sheetIndex >= sheets.length) setSheetIndex(Math.max(0, sheets.length - 1));
  }, [sheets.length, sheetIndex]);

  // Live preview of the currently-viewed sheet only — exporting renders every sheet on demand instead, so this stays fast even with many pages queued.
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    if (!sheets.length || grid.cols <= 0 || grid.rows <= 0) {
      const ctx = canvas.getContext("2d");
      canvas.width = 300;
      canvas.height = 300;
      if (ctx) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    let cancelled = false;
    (async () => {
      const sheetItems = sheets[Math.min(sheetIndex, sheets.length - 1)] ?? [];
      await renderSheet(canvas, sheetItems, grid, settings, imageCacheRef.current);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [sheets, sheetIndex, grid, settings]);

  const fitsOnPaper = grid.cols > 0 && grid.rows > 0;

  const handleDownloadPdf = async () => {
    if (!fitsOnPaper || !sheets.length) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const canvases = await renderAllSheets(state.items, grid, settings, imageCacheRef.current);
      const pdfDoc = await PDFDocument.create();
      const pageWpt = mmToPt(grid.paperUsedWMm);
      const pageHpt = mmToPt(grid.paperUsedHMm);
      for (const canvas of canvases) {
        const blob = await canvasToBlob(canvas);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const img = await pdfDoc.embedPng(bytes);
        const page = pdfDoc.addPage([pageWpt, pageHpt]);
        page.drawImage(img, { x: 0, y: 0, width: pageWpt, height: pageHpt });
      }
      await stampGamatoBranding(pdfDoc);
      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), "cetak-foto-gamato-piranti.pdf");
      setInfo(tr("{0} halaman siap cetak berhasil diunduh sebagai PDF (ukuran fisik akurat — cetak di \"Ukuran Asli / 100%\", jangan \"Fit to Page\").", canvases.length));
    } catch (err: any) {
      setInfo(tr("Gagal: ") + (err?.message || tr("Tidak dapat membuat PDF.")));
    } finally {
      setIsWorking(false);
    }
  };

  const handleDownloadCurrentPng = async () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !fitsOnPaper) return;
    setIsWorking(true);
    setInfo(null);
    try {
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, tr("cetak-foto-halaman-{0}.png", sheetIndex + 1));
      setInfo(tr("Halaman ini berhasil diunduh sebagai PNG."));
    } catch (err: any) {
      setInfo(tr("Gagal: ") + (err?.message || tr("Tidak dapat membuat PNG.")));
    } finally {
      setIsWorking(false);
    }
  };

  const handlePrintDirect = async () => {
    if (!fitsOnPaper || !sheets.length) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const canvases = await renderAllSheets(state.items, grid, settings, imageCacheRef.current);
      printCanvasPages(canvases, { title: tr("Cetak Foto — Gamato Piranti"), pageSizeMm: { w: grid.paperUsedWMm, h: grid.paperUsedHMm } });
      setInfo(tr("Dialog cetak dibuka. Pilih \"Ukuran Asli / 100% / Actual Size\" pada printer agar ukuran fisik foto tetap akurat."));
    } catch (err: any) {
      setInfo(tr("Gagal: ") + (err?.message || tr("Tidak dapat membuka dialog cetak.")));
    } finally {
      setIsWorking(false);
    }
  };

  const currentSheetLabel = sheets.length ? tr("Halaman {0} dari {1}", sheetIndex + 1, sheets.length) : tr("Belum ada halaman");
  const paperOrientationLabel = grid.paperRotated ? tr("Lanskap") : tr("Potret");

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
      <GamatoDesktopRecommended toolName={tr("Tata Letak Cetak Foto")} className="lg:col-span-full" />
      {/* LEFT: settings */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Editor Cetak Foto")}</span>
          <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} hideLabel />
        </div>

        <SettingsTabBar tabs={TABS} active={tab} onChange={setTab} />

        {tab === "foto" && (
          <PanelCard title={tr("Foto & Jumlah Salinan")} subtitle={tr("Unggah satu atau beberapa foto, atur berapa lembar tiap foto")}>
            <Dropzone
              onFiles={addFiles}
              accept="image/*"
              multiple
              label={tr("Drop foto di sini")}
              sublabel={tr("Bisa unggah beberapa foto sekaligus")}
              icon={<Images className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
            />

            {state.items.length > 0 && (
              <div className="space-y-3 mt-4">
                {state.items.map((item) => (
                  <div key={item.id} className="flex gap-3 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    <img src={item.objectUrl} alt={item.fileName} className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{item.fileName}</p>
                        <button type="button" onClick={() => removeItem(item.id)} className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{tr("Jumlah:")}</span>
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { copies: Math.max(1, item.copies - 1) })}
                          className="w-8 h-8 sm:w-6 sm:h-6 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-400"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={item.copies}
                          onChange={(e) => updateItem(item.id, { copies: Math.max(1, Math.min(999, parseInt(e.target.value) || 1)) }, { continuous: true })}
                          className="w-12 text-center text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 py-1"
                        />
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { copies: Math.min(999, item.copies + 1) })}
                          className="w-8 h-8 sm:w-6 sm:h-6 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-400"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">{tr("lembar")}</span>
                      </div>
                      {state.fitMode === "cover" && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{tr("Fokus potong:")}</span>
                          <GamatoSelect
                            compact
                            aria-label={tr("Fokus potong horizontal")}
                            value={item.focusX}
                            onChange={(e) => updateItem(item.id, { focusX: e.target.value as FocusX })}
                          >
                            {FOCUS_X_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                          </GamatoSelect>
                          <GamatoSelect
                            compact
                            aria-label={tr("Fokus potong vertikal")}
                            value={item.focusY}
                            onChange={(e) => updateItem(item.id, { focusY: e.target.value as FocusY })}
                          >
                            {FOCUS_Y_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                          </GamatoSelect>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </PanelCard>
        )}

        {tab === "ukuran" && (
          <PanelCard title={tr("Ukuran Foto & Kertas")} subtitle={tr("Pilih ukuran pas foto/cetak dan kertas yang dipakai")}>
            <div className="space-y-4">
              <div>
                <Select label={tr("Ukuran Foto")} value={state.photoId} onChange={(e) => updateField("photoId", e.target.value)}>
                  {(["Pas Foto", "Cetak Foto", "Lainnya"] as const).map((group) => (
                    <optgroup key={group} label={tr(group)}>
                      {PHOTO_SIZES.filter((p) => p.group === group).map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                {state.photoId === "custom" && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Input label={tr("Lebar Foto (mm)")} type="number" min={5} max={500} value={state.customPhotoWMm} onChange={(e) => updateField("customPhotoWMm", Number(e.target.value) || 1, { continuous: true })} />
                    <Input label={tr("Tinggi Foto (mm)")} type="number" min={5} max={500} value={state.customPhotoHMm} onChange={(e) => updateField("customPhotoHMm", Number(e.target.value) || 1, { continuous: true })} />
                  </div>
                )}
              </div>

              <div>
                <Select label={tr("Ukuran Kertas")} value={state.paperId} onChange={(e) => updateField("paperId", e.target.value)}>
                  {PAPER_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </Select>
                {state.paperId === "custom" && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Input label={tr("Lebar Kertas (mm)")} type="number" min={20} max={2000} value={state.customPaperWMm} onChange={(e) => updateField("customPaperWMm", Number(e.target.value) || 1, { continuous: true })} />
                    <Input label={tr("Tinggi Kertas (mm)")} type="number" min={20} max={2000} value={state.customPaperHMm} onChange={(e) => updateField("customPaperHMm", Number(e.target.value) || 1, { continuous: true })} />
                  </div>
                )}
              </div>
            </div>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </PanelCard>
        )}

        {tab === "tataletak" && (
          <PanelCard title={tr("Tata Letak")} subtitle={tr("Orientasi kertas, jarak antar foto, dan garis potong")}>
            <div className="space-y-4">
              <Select label={tr("Orientasi Kertas")} value={state.orientation} onChange={(e) => updateField("orientation", e.target.value as PrintState["orientation"])}>
                <option value="auto">{tr("Otomatis (muat sebanyak mungkin)")}</option>
                <option value="portrait">{tr("Potret")}</option>
                <option value="landscape">{tr("Lanskap")}</option>
              </Select>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label>{tr("Margin Kertas")}</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{tr("{0} mm", state.marginMm)}</span>
                </div>
                <GamatoSlider min={0} max={30} value={state.marginMm} onChange={(v) => updateField("marginMm", v, { continuous: true })} aria-label={tr("Margin Kertas")} />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label>{tr("Jarak Antar Foto (Gutter)")}</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{tr("{0} mm", state.gutterMm)}</span>
                </div>
                <GamatoSlider min={0} max={20} value={state.gutterMm} onChange={(v) => updateField("gutterMm", v, { continuous: true })} aria-label={tr("Jarak Antar Foto")} />
              </div>

              <GamatoCheckbox checked={state.showCutGuides} onChange={(v) => updateField("showCutGuides", v)} label={<span className="flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5" /> {tr("Tampilkan garis potong")}</span>} />

              <div>
                <Label>{tr("Mode Penyesuaian Foto")}</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => updateField("fitMode", "cover")}
                    className={cn("py-2.5 rounded-xl text-xs font-semibold border-2 transition-all", state.fitMode === "cover" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}
                  >
                    {tr("Penuhi & Potong")}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("fitMode", "contain")}
                    className={cn("py-2.5 rounded-xl text-xs font-semibold border-2 transition-all", state.fitMode === "contain" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}
                  >
                    {tr("Utuh (Tanpa Potong)")}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                  {state.fitMode === "cover" ? tr("Foto dipotong rapi mengisi penuh ukuran cetak (paling umum untuk pas foto).") : tr("Seluruh foto ditampilkan utuh, bisa ada sedikit ruang putih bila rasio tidak sama persis.")}
                </p>
              </div>
            </div>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </PanelCard>
        )}
      </div>

      {/* RIGHT: live preview + export */}
      <div className="space-y-4 lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Pratinjau Lembar Cetak")}</p>
          {sheets.length > 1 && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSheetIndex((i) => Math.max(0, i - 1))} disabled={sheetIndex === 0} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{currentSheetLabel}</span>
              <button type="button" onClick={() => setSheetIndex((i) => Math.min(sheets.length - 1, i + 1))} disabled={sheetIndex >= sheets.length - 1} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-center bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          {!totalPhotos ? (
            <div className="flex flex-col items-center justify-center gap-2 h-64 text-slate-600 dark:text-slate-400 text-sm text-center px-6">
              <ImageOff className="w-8 h-8" />
              {tr("Unggah foto dulu di panel kiri untuk melihat pratinjau lembar cetak")}
            </div>
          ) : (
            <canvas ref={previewCanvasRef} className="max-w-full max-h-[560px] rounded-lg shadow bg-white" />
          )}
        </div>

        {totalPhotos > 0 && (
          <div className="bg-slate-900 dark:bg-slate-950 rounded-xl px-4 py-3 text-xs text-slate-300 space-y-1">
            <p>
              <span className="text-slate-500">{tr("Muat per lembar:")}</span> <span className="font-bold text-white">{grid.perSheet}</span>{" "}{tr("foto ({0} kolom × {1} baris) · Kertas {2}", grid.cols, grid.rows, paperOrientationLabel)}</p>
            <p>
              <span className="text-slate-500">{tr("Total dibutuhkan:")}</span> <span className="font-bold text-white">{tr("{0} salinan", totalCopies)}</span>{" "}{tr("dari {0} foto →", totalPhotos)}{" "}<span className="font-bold text-white">{tr("{0} lembar", sheets.length)}</span>
            </p>
          </div>
        )}

        {!fitsOnPaper && totalPhotos > 0 && (
          <GamatoInlineAlert
            tone="error"
            message={tr("Ukuran foto ({0}×{1} mm) tidak muat di kertas yang dipilih ({2}×{3} mm) dengan margin saat ini. Kecilkan margin/ukuran foto, atau pilih kertas yang lebih besar.", photoWMm, photoHMm, paperWMm, paperHMm)}
          />
        )}

        {info && <GamatoInlineAlert message={info} tone={msgStarts(info, "Gagal") ? "error" : "success"} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Btn onClick={handleDownloadPdf} disabled={isWorking || !fitsOnPaper || !sheets.length} className="gap-2">
            {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {tr("Unduh PDF Siap Cetak")}
          </Btn>
          <Btn onClick={handlePrintDirect} disabled={isWorking || !fitsOnPaper || !sheets.length} variant="secondary" className="gap-2">
            {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {tr("Cetak Langsung")}
          </Btn>
        </div>
        <Btn onClick={handleDownloadCurrentPng} disabled={isWorking || !fitsOnPaper || !sheets.length} variant="ghost" className="w-full gap-2 text-sm">
          <Download className="w-4 h-4" />
          {tr("Unduh Halaman Ini sebagai PNG")}
        </Btn>

        <div className="text-center">
          <SectionBadge>{tr("Diproses langsung di perangkatmu — ukuran fisik akurat untuk cetak")}</SectionBadge>
        </div>

        <ToolInfoPanel
          icon={<Printer className="w-5 h-5" />}
          label={tr("Cetak Foto")}
          desc={tr("Susun pas foto / foto cetak siap print dalam satu atau beberapa lembar")}
          points={[
            tr("Unggah beberapa foto sekaligus, atur jumlah salinan per foto — tool ini otomatis menyusun & memecah ke beberapa lembar bila tidak muat dalam satu halaman."),
            tr("Ukuran kertas & foto dihitung dalam milimeter asli, bukan diperkirakan — jadi hasil PDF/cetak presisi secara fisik."),
            tr("Saat mencetak PDF atau lewat dialog printer, pilih 'Ukuran Asli / 100% / Actual Size' — bukan 'Fit to Page' — supaya ukuran pas foto tidak melar/menyusut."),
            tr("Mode 'Penuhi & Potong' memangkas foto rapi mengisi penuh bingkai; atur 'Fokus Potong' per foto bila wajah tidak tepat di tengah."),
          ]}
        />
      </div>
    </div>
  );
};
