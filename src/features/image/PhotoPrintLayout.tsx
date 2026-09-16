import React, { useEffect, useMemo, useRef, useState } from "react";
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

let itemCounter = 0;
const newItemId = () => `print-item-${Date.now()}-${itemCounter++}`;

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
  { id: "foto", label: "Foto & Jumlah", icon: <Images className="w-3.5 h-3.5" /> },
  { id: "ukuran", label: "Ukuran Foto & Kertas", icon: <Ruler className="w-3.5 h-3.5" /> },
  { id: "tataletak", label: "Tata Letak", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
];

const FOCUS_X_OPTIONS: { id: FocusX; label: string }[] = [
  { id: "left", label: "Kiri" },
  { id: "center", label: "Tengah" },
  { id: "right", label: "Kanan" },
];
const FOCUS_Y_OPTIONS: { id: FocusY; label: string }[] = [
  { id: "top", label: "Atas" },
  { id: "center", label: "Tengah" },
  { id: "bottom", label: "Bawah" },
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
      setInfo(`${canvases.length} halaman siap cetak berhasil diunduh sebagai PDF (ukuran fisik akurat — cetak di "Ukuran Asli / 100%", jangan "Fit to Page").`);
    } catch (err: any) {
      setInfo("Gagal: " + (err?.message || "Tidak dapat membuat PDF."));
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
      downloadBlob(blob, `cetak-foto-halaman-${sheetIndex + 1}.png`);
      setInfo("Halaman ini berhasil diunduh sebagai PNG.");
    } catch (err: any) {
      setInfo("Gagal: " + (err?.message || "Tidak dapat membuat PNG."));
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
      printCanvasPages(canvases, { title: "Cetak Foto — Gamato Piranti", pageSizeMm: { w: grid.paperUsedWMm, h: grid.paperUsedHMm } });
      setInfo('Dialog cetak dibuka. Pilih "Ukuran Asli / 100% / Actual Size" pada printer agar ukuran fisik foto tetap akurat.');
    } catch (err: any) {
      setInfo("Gagal: " + (err?.message || "Tidak dapat membuka dialog cetak."));
    } finally {
      setIsWorking(false);
    }
  };

  const currentSheetLabel = sheets.length ? `Halaman ${sheetIndex + 1} dari ${sheets.length}` : "Belum ada halaman";
  const paperOrientationLabel = grid.paperRotated ? "Lanskap" : "Potret";

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
      {/* LEFT: settings */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor Cetak Foto</span>
          <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} hideLabel />
        </div>

        <SettingsTabBar tabs={TABS} active={tab} onChange={setTab} />

        {tab === "foto" && (
          <PanelCard title="Foto & Jumlah Salinan" subtitle="Unggah satu atau beberapa foto, atur berapa lembar tiap foto">
            <Dropzone
              onFiles={addFiles}
              accept="image/*"
              multiple
              label="Drop foto di sini"
              sublabel="Bisa unggah beberapa foto sekaligus"
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
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">Jumlah:</span>
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { copies: Math.max(1, item.copies - 1) })}
                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-400"
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
                          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-400"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">lembar</span>
                      </div>
                      {state.fitMode === "cover" && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">Fokus potong:</span>
                          <select
                            value={item.focusX}
                            onChange={(e) => updateItem(item.id, { focusX: e.target.value as FocusX })}
                            className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 py-1 px-1.5"
                          >
                            {FOCUS_X_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                          </select>
                          <select
                            value={item.focusY}
                            onChange={(e) => updateItem(item.id, { focusY: e.target.value as FocusY })}
                            className="text-[11px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 py-1 px-1.5"
                          >
                            {FOCUS_Y_OPTIONS.map((o) => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                          </select>
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
          <PanelCard title="Ukuran Foto & Kertas" subtitle="Pilih ukuran pas foto/cetak dan kertas yang dipakai">
            <div className="space-y-4">
              <div>
                <Select label="Ukuran Foto" value={state.photoId} onChange={(e) => updateField("photoId", e.target.value)}>
                  {["Pas Foto", "Cetak Foto", "Lainnya"].map((group) => (
                    <optgroup key={group} label={group}>
                      {PHOTO_SIZES.filter((p) => p.group === group).map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                {state.photoId === "custom" && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Input label="Lebar Foto (mm)" type="number" min={5} max={500} value={state.customPhotoWMm} onChange={(e) => updateField("customPhotoWMm", Number(e.target.value) || 1, { continuous: true })} />
                    <Input label="Tinggi Foto (mm)" type="number" min={5} max={500} value={state.customPhotoHMm} onChange={(e) => updateField("customPhotoHMm", Number(e.target.value) || 1, { continuous: true })} />
                  </div>
                )}
              </div>

              <div>
                <Select label="Ukuran Kertas" value={state.paperId} onChange={(e) => updateField("paperId", e.target.value)}>
                  {PAPER_SIZES.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </Select>
                {state.paperId === "custom" && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Input label="Lebar Kertas (mm)" type="number" min={20} max={2000} value={state.customPaperWMm} onChange={(e) => updateField("customPaperWMm", Number(e.target.value) || 1, { continuous: true })} />
                    <Input label="Tinggi Kertas (mm)" type="number" min={20} max={2000} value={state.customPaperHMm} onChange={(e) => updateField("customPaperHMm", Number(e.target.value) || 1, { continuous: true })} />
                  </div>
                )}
              </div>
            </div>
            <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
          </PanelCard>
        )}

        {tab === "tataletak" && (
          <PanelCard title="Tata Letak" subtitle="Orientasi kertas, jarak antar foto, dan garis potong">
            <div className="space-y-4">
              <Select label="Orientasi Kertas" value={state.orientation} onChange={(e) => updateField("orientation", e.target.value as PrintState["orientation"])}>
                <option value="auto">Otomatis (muat sebanyak mungkin)</option>
                <option value="portrait">Potret</option>
                <option value="landscape">Lanskap</option>
              </Select>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label>Margin Kertas</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{state.marginMm} mm</span>
                </div>
                <GamatoSlider min={0} max={30} value={state.marginMm} onChange={(v) => updateField("marginMm", v, { continuous: true })} aria-label="Margin Kertas" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label>Jarak Antar Foto (Gutter)</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{state.gutterMm} mm</span>
                </div>
                <GamatoSlider min={0} max={20} value={state.gutterMm} onChange={(v) => updateField("gutterMm", v, { continuous: true })} aria-label="Jarak Antar Foto" />
              </div>

              <GamatoCheckbox checked={state.showCutGuides} onChange={(v) => updateField("showCutGuides", v)} label={<span className="flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5" /> Tampilkan garis potong</span>} />

              <div>
                <Label>Mode Penyesuaian Foto</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => updateField("fitMode", "cover")}
                    className={cn("py-2.5 rounded-xl text-xs font-semibold border-2 transition-all", state.fitMode === "cover" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}
                  >
                    Penuhi & Potong
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField("fitMode", "contain")}
                    className={cn("py-2.5 rounded-xl text-xs font-semibold border-2 transition-all", state.fitMode === "contain" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}
                  >
                    Utuh (Tanpa Potong)
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                  {state.fitMode === "cover" ? "Foto dipotong rapi mengisi penuh ukuran cetak (paling umum untuk pas foto)." : "Seluruh foto ditampilkan utuh, bisa ada sedikit ruang putih bila rasio tidak sama persis."}
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
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pratinjau Lembar Cetak</p>
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
            <div className="flex flex-col items-center justify-center gap-2 h-64 text-slate-400 dark:text-slate-500 text-sm text-center px-6">
              <ImageOff className="w-8 h-8" />
              Unggah foto dulu di panel kiri untuk melihat pratinjau lembar cetak
            </div>
          ) : (
            <canvas ref={previewCanvasRef} className="max-w-full max-h-[560px] rounded-lg shadow bg-white" />
          )}
        </div>

        {totalPhotos > 0 && (
          <div className="bg-slate-900 dark:bg-slate-950 rounded-xl px-4 py-3 text-xs text-slate-300 space-y-1">
            <p>
              <span className="text-slate-500">Muat per lembar:</span> <span className="font-bold text-white">{grid.perSheet}</span> foto ({grid.cols} kolom × {grid.rows} baris) · Kertas {paperOrientationLabel}
            </p>
            <p>
              <span className="text-slate-500">Total dibutuhkan:</span> <span className="font-bold text-white">{totalCopies} salinan</span> dari {totalPhotos} foto → <span className="font-bold text-white">{sheets.length} lembar</span>
            </p>
          </div>
        )}

        {!fitsOnPaper && totalPhotos > 0 && (
          <GamatoInlineAlert
            tone="error"
            message={`Ukuran foto (${photoWMm}×${photoHMm} mm) tidak muat di kertas yang dipilih (${paperWMm}×${paperHMm} mm) dengan margin saat ini. Kecilkan margin/ukuran foto, atau pilih kertas yang lebih besar.`}
          />
        )}

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Btn onClick={handleDownloadPdf} disabled={isWorking || !fitsOnPaper || !sheets.length} className="gap-2">
            {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Unduh PDF Siap Cetak
          </Btn>
          <Btn onClick={handlePrintDirect} disabled={isWorking || !fitsOnPaper || !sheets.length} variant="secondary" className="gap-2">
            {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Cetak Langsung
          </Btn>
        </div>
        <Btn onClick={handleDownloadCurrentPng} disabled={isWorking || !fitsOnPaper || !sheets.length} variant="ghost" className="w-full gap-2 text-sm">
          <Download className="w-4 h-4" />
          Unduh Halaman Ini sebagai PNG
        </Btn>

        <div className="text-center">
          <SectionBadge>Diproses langsung di perangkatmu — ukuran fisik akurat untuk cetak</SectionBadge>
        </div>

        <ToolInfoPanel
          icon={<Printer className="w-5 h-5" />}
          label="Cetak Foto"
          desc="Susun pas foto / foto cetak siap print dalam satu atau beberapa lembar"
          points={[
            "Unggah beberapa foto sekaligus, atur jumlah salinan per foto — tool ini otomatis menyusun & memecah ke beberapa lembar bila tidak muat dalam satu halaman.",
            "Ukuran kertas & foto dihitung dalam milimeter asli, bukan diperkirakan — jadi hasil PDF/cetak presisi secara fisik.",
            "Saat mencetak PDF atau lewat dialog printer, pilih 'Ukuran Asli / 100% / Actual Size' — bukan 'Fit to Page' — supaya ukuran pas foto tidak melar/menyusut.",
            "Mode 'Penuhi & Potong' memangkas foto rapi mengisi penuh bingkai; atur 'Fokus Potong' per foto bila wajah tidak tepat di tengah.",
          ]}
        />
      </div>
    </div>
  );
};
