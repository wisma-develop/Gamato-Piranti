import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IdCard, Type, Square, Circle, Minus as LineIcon, Image as ImageIcon,
  Trash2, Download, Printer, Loader2, Move, ChevronUp, ChevronDown, Copy,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, CaseUpper, FlipHorizontal2,
  Layers, Sparkles, Ruler, Palette,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToDataUrl } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { sanitizeFileName } from "@/utils/sanitize";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { printCanvasImage } from "@/lib/printCanvas";
import { renderCardSide } from "@/lib/businessCardEngine";
import {
  CARD_SIZES,
  CARD_TEMPLATES,
  CONTACT_FIELD_LABEL,
  CONTACT_FIELD_KEYS,
  getCardTemplate,
  defaultContactData,
  resolveCardSizeMM,
  newElementId,
  makeTextElement,
  makeShapeElement,
  makeImageElement,
  PX_PER_MM,
  type CardDesign,
  type CardSide,
  type CardSizeId,
  type ContactData,
  type CardElement,
  type CardTextElement,
  type CardShapeElement,
  type CardImageElement,
} from "@/lib/businessCardTypes";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { FontPicker } from "@/components/ui/FontPicker";
import { Label, Input, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { PanelCard } from "@/components/ui/PanelCard";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";

type Side = "front" | "back";

interface StudioState {
  design: CardDesign;
  contact: ContactData;
}

function defaultStudioState(): StudioState {
  return { design: getCardTemplate("minimal"), contact: defaultContactData() };
}

const MM_TO_PT = 2.834645669;

// Small reusable "row of toggle buttons" used for shape-type / align /
// background-type / image-shape pickers throughout the element panel.
function ToggleRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all",
            value === opt.value
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function BusinessCardGenerator() {
  // Seluruh desain (ukuran, latar, elemen kedua sisi) + data kontak punya
  // riwayat Undo/Redo. Drag posisi & slider digabung jadi satu langkah
  // setelah jeda; aksi diskrit (tambah/hapus elemen, pilih template, dsb)
  // langsung commit.
  const history = useHistoryState<StudioState>(() => defaultStudioState());
  const state = history.state;
  const { design, contact } = state;
  const { schedule: scheduleCommit } = useDebouncedCommit(history.commit, 500);

  const [activeSide, setActiveSide] = useState<Side>("front");
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [dragElementId, setDragElementId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [info, setInfo] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { customFonts, isFontLoading, fontError, addCustomFont, removeCustomFont } = useCustomFonts();

  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const frontSeqRef = useRef(0);
  const backSeqRef = useRef(0);

  const currentSide: CardSide = design[activeSide];
  const selectedElement = useMemo(
    () => currentSide.elements.find((el) => el.id === selectedElementId) ?? null,
    [currentSide, selectedElementId]
  );
  const activeSizeMM = useMemo(() => resolveCardSizeMM(design), [design.sizeId, design.customWMM, design.customHMM]);

  // ── generic state helpers ──
  const setStudio = (updater: (s: StudioState) => StudioState, opts?: { continuous?: boolean }) => {
    history.set(updater, { commit: !opts?.continuous });
    if (opts?.continuous) scheduleCommit();
  };
  const updateContact = (patch: Partial<ContactData>, opts?: { continuous?: boolean }) =>
    setStudio((s) => ({ ...s, contact: { ...s.contact, ...patch } }), opts);

  const updateSide = (updater: (side: CardSide) => CardSide, opts?: { continuous?: boolean }) =>
    setStudio((s) => ({ ...s, design: { ...s.design, [activeSide]: updater(s.design[activeSide]) } }), opts);

  const updateDesignRoot = (patch: Partial<Pick<CardDesign, "sizeId" | "customWMM" | "customHMM">>, opts?: { continuous?: boolean }) =>
    setStudio((s) => ({ ...s, design: { ...s.design, ...patch } }), opts);

  // Generic so each element-kind's own onChange (which only ever patches its
  // own kind's fields) type-checks directly against this without callers
  // having to fight an intersection-typed patch shape.
  function updateElement<T extends CardElement>(id: string, patch: Partial<T>, opts?: { continuous?: boolean }) {
    updateSide(
      (side) => ({
        ...side,
        elements: side.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as CardElement) : el)),
      }),
      opts
    );
  }

  const handleRemoveCustomFont = (id: string) => {
    removeCustomFont(id, (fallback) => {
      if (selectedElement?.kind === "text" && selectedElement.fontFamily === id) {
        updateElement(selectedElement.id, { fontFamily: fallback });
      }
    });
  };

  // ── element CRUD ──
  const addTextElement = () => {
    const el = makeTextElement({ text: "Teks baru" });
    updateSide((side) => ({ ...side, elements: [...side.elements, el] }));
    setSelectedElementId(el.id);
  };
  const addShapeElement = (shape: "rect" | "circle" | "line") => {
    const el = makeShapeElement({ shape, ...(shape === "line" ? { widthPct: 30, heightPct: 0.8 } : {}) });
    updateSide((side) => ({ ...side, elements: [...side.elements, el] }));
    setSelectedElementId(el.id);
  };
  const addImageElementFromFile = async (file: File | null) => {
    if (!file) return;
    try {
      const src = await fileToDataUrl(file);
      const el = makeImageElement({ src });
      updateSide((side) => ({ ...side, elements: [...side.elements, el] }));
      setSelectedElementId(el.id);
    } catch {
      setInfo({ type: "error", text: "Gagal memuat gambar." });
    }
  };
  const replaceImageSrc = async (id: string, file: File | null) => {
    if (!file) return;
    try {
      const src = await fileToDataUrl(file);
      updateElement(id, { src });
    } catch {
      setInfo({ type: "error", text: "Gagal memuat gambar." });
    }
  };
  const removeElement = (id: string) => {
    updateSide((side) => ({ ...side, elements: side.elements.filter((e) => e.id !== id) }));
    if (selectedElementId === id) setSelectedElementId(null);
  };
  const duplicateElement = (id: string) => {
    const el = currentSide.elements.find((e) => e.id === id);
    if (!el) return;
    const clone: CardElement = { ...el, id: newElementId(el.kind), xPct: Math.min(96, el.xPct + 3), yPct: Math.min(96, el.yPct + 3) };
    updateSide((side) => ({ ...side, elements: [...side.elements, clone] }));
    setSelectedElementId(clone.id);
  };
  const moveElement = (id: string, dir: -1 | 1) => {
    updateSide((side) => {
      const idx = side.elements.findIndex((e) => e.id === id);
      if (idx < 0) return side;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= side.elements.length) return side;
      const next = [...side.elements];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return { ...side, elements: next };
    });
  };

  // ── background ──
  const setBgType = (type: "solid" | "gradient" | "image") => {
    updateSide((side) => {
      if (type === "solid") {
        return { ...side, background: { type: "solid", color: side.background.type === "solid" ? side.background.color : "#ffffff" } };
      }
      if (type === "gradient") {
        return side.background.type === "gradient"
          ? side
          : { ...side, background: { type: "gradient", angle: 135, from: "#4f46e5", to: "#7c3aed" } };
      }
      return side.background.type === "image"
        ? side
        : { ...side, background: { type: "image", src: "", fit: "cover", overlayColor: "#000000", overlayOpacity: 0 } };
    });
  };
  const setBgSolidColor = (color: string, opts?: { continuous?: boolean }) =>
    updateSide((side) => (side.background.type === "solid" ? { ...side, background: { ...side.background, color } } : side), opts);
  const setBgGradientFrom = (from: string, opts?: { continuous?: boolean }) =>
    updateSide((side) => (side.background.type === "gradient" ? { ...side, background: { ...side.background, from } } : side), opts);
  const setBgGradientTo = (to: string, opts?: { continuous?: boolean }) =>
    updateSide((side) => (side.background.type === "gradient" ? { ...side, background: { ...side.background, to } } : side), opts);
  const setBgGradientAngle = (angle: number, opts?: { continuous?: boolean }) =>
    updateSide((side) => (side.background.type === "gradient" ? { ...side, background: { ...side.background, angle } } : side), opts);
  const setBgImageFile = async (file: File | null) => {
    if (!file) return;
    try {
      const src = await fileToDataUrl(file);
      updateSide((side) => (side.background.type === "image" ? { ...side, background: { ...side.background, src } } : side));
    } catch {
      setInfo({ type: "error", text: "Gagal memuat gambar latar." });
    }
  };
  const setBgImageFit = (fit: "cover" | "contain") =>
    updateSide((side) => (side.background.type === "image" ? { ...side, background: { ...side.background, fit } } : side));
  const setBgOverlayColor = (overlayColor: string, opts?: { continuous?: boolean }) =>
    updateSide((side) => (side.background.type === "image" ? { ...side, background: { ...side.background, overlayColor } } : side), opts);
  const setBgOverlayOpacity = (overlayOpacity: number, opts?: { continuous?: boolean }) =>
    updateSide((side) => (side.background.type === "image" ? { ...side, background: { ...side.background, overlayOpacity } } : side), opts);

  // ── templates & size ──
  const applyTemplate = (id: string) => {
    const tpl = getCardTemplate(id);
    setStudio((s) => ({ ...s, design: { ...tpl, sizeId: s.design.sizeId, customWMM: s.design.customWMM, customHMM: s.design.customHMM } }));
    setSelectedElementId(null);
    setInfo(null);
  };
  const setSizeId = (id: CardSizeId) => updateDesignRoot({ sizeId: id });

  // ── drag-to-position on live preview ──
  const onPointerDownElement = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    setSelectedElementId(id);
    setDragElementId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMovePreview = (e: React.PointerEvent) => {
    if (!dragElementId || !previewWrapRef.current) return;
    const rect = previewWrapRef.current.getBoundingClientRect();
    const xPct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    updateElement(dragElementId, { xPct: Math.round(xPct * 10) / 10, yPct: Math.round(yPct * 10) / 10 }, { continuous: true });
  };
  const onPointerUpPreview = () => {
    if (dragElementId) {
      setDragElementId(null);
      history.commit();
    }
  };

  // ── render both sides (offscreen-first so a slow render never overwrites a newer one) ──
  useEffect(() => {
    const seq = ++frontSeqRef.current;
    let cancelled = false;
    (async () => {
      const offscreen = document.createElement("canvas");
      await renderCardSide(offscreen, design.front, contact, design, imageCacheRef.current);
      if (cancelled || frontSeqRef.current !== seq) return;
      const canvas = frontCanvasRef.current;
      if (!canvas) return;
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [design.front, design.sizeId, design.customWMM, design.customHMM, contact]);

  useEffect(() => {
    const seq = ++backSeqRef.current;
    let cancelled = false;
    (async () => {
      const offscreen = document.createElement("canvas");
      await renderCardSide(offscreen, design.back, contact, design, imageCacheRef.current);
      if (cancelled || backSeqRef.current !== seq) return;
      const canvas = backCanvasRef.current;
      if (!canvas) return;
      canvas.width = offscreen.width;
      canvas.height = offscreen.height;
      canvas.getContext("2d")?.drawImage(offscreen, 0, 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [design.back, design.sizeId, design.customWMM, design.customHMM, contact]);

  // ── export ──
  const activeCanvas = () => (activeSide === "front" ? frontCanvasRef.current : backCanvasRef.current);

  const downloadPng = async () => {
    setInfo(null);
    setIsExporting(true);
    try {
      const canvas = activeCanvas();
      if (!canvas) return;
      const blob = await canvasToBlob(canvas);
      const base = sanitizeFileName(contact.name || "kartu-nama");
      downloadBlob(blob, `${base}-${activeSide === "front" ? "depan" : "belakang"}.png`);
      setInfo({ type: "success", text: "Kartu nama berhasil diunduh sebagai PNG." });
    } catch (err: any) {
      setInfo({ type: "error", text: err?.message || "Gagal mengunduh PNG." });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadPdf = async (mode: "current" | "both") => {
    setInfo(null);
    setIsExporting(true);
    try {
      const pdfDoc = await PDFDocument.create();
      const wPt = activeSizeMM.wMM * MM_TO_PT;
      const hPt = activeSizeMM.hMM * MM_TO_PT;
      const sides: Side[] = mode === "both" ? ["front", "back"] : [activeSide];
      for (const side of sides) {
        const canvas = side === "front" ? frontCanvasRef.current : backCanvasRef.current;
        if (!canvas) continue;
        const blob = await canvasToBlob(canvas);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const img = await pdfDoc.embedPng(bytes);
        const page = pdfDoc.addPage([wPt, hPt]);
        page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
      }
      await stampGamatoBranding(pdfDoc);
      const pdfBytes = await pdfDoc.save();
      const base = sanitizeFileName(contact.name || "kartu-nama");
      const suffix = mode === "both" ? "" : `-${activeSide === "front" ? "depan" : "belakang"}`;
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `${base}-kartu-nama${suffix}.pdf`);
      setInfo({ type: "success", text: `Kartu nama berhasil diunduh sebagai PDF${mode === "both" ? " (2 halaman)" : ""}.` });
    } catch (err: any) {
      setInfo({ type: "error", text: err?.message || "Gagal membuat PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const printCurrent = () => {
    setInfo(null);
    try {
      const canvas = activeCanvas();
      if (!canvas) return;
      printCanvasImage(canvas, { widthMm: activeSizeMM.wMM, title: `Kartu Nama — ${contact.name || "Gamato Piranti"}` });
    } catch (err: any) {
      setInfo({ type: "error", text: err?.message || "Gagal membuka dialog cetak." });
    }
  };

  const alignOptions: { value: "left" | "center" | "right"; label: string; icon: React.ReactNode }[] = [
    { value: "left", label: "", icon: <AlignLeft className="w-4 h-4" strokeWidth={2.5} /> },
    { value: "center", label: "", icon: <AlignCenter className="w-4 h-4" strokeWidth={2.5} /> },
    { value: "right", label: "", icon: <AlignRight className="w-4 h-4" strokeWidth={2.5} /> },
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_440px] gap-6 items-start">
      {/* LEFT: editor */}
      <div className="space-y-5">
        <GamatoDesktopRecommended toolName="Studio Kartu Nama" />

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor Kartu Nama</span>
          <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} />
        </div>

        {/* Side switch */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-2 shadow-sm">
          <ToggleRow
            value={activeSide}
            onChange={(v) => { setActiveSide(v); setSelectedElementId(null); }}
            options={[
              { value: "front", label: "Sisi Depan", icon: <IdCard className="w-4 h-4" /> },
              { value: "back", label: "Sisi Belakang", icon: <FlipHorizontal2 className="w-4 h-4" /> },
            ]}
          />
        </div>

        {/* Templates */}
        <PanelCard title="Template Siap Pakai" subtitle="Pilih titik awal, lalu ubah bebas sesuka Anda">
          <div className="grid grid-cols-2 gap-2.5">
            {CARD_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                className="text-left rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 p-3 transition-all group"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  <Sparkles className="w-3 h-3 shrink-0 text-indigo-400" />
                  {t.name}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-snug">{t.desc}</p>
              </button>
            ))}
          </div>
        </PanelCard>

        {/* Contact data */}
        <PanelCard title="Data Kontak" subtitle="Sumber teks untuk elemen yang ditautkan (dipakai lintas template)">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Nama" value={contact.name} onChange={(e) => updateContact({ name: e.target.value }, { continuous: true })} />
            <Input label="Jabatan" value={contact.title} onChange={(e) => updateContact({ title: e.target.value }, { continuous: true })} />
            <Input label="Perusahaan" value={contact.company} onChange={(e) => updateContact({ company: e.target.value }, { continuous: true })} />
            <Input label="Telepon" value={contact.phone} onChange={(e) => updateContact({ phone: e.target.value }, { continuous: true })} />
            <Input label="Email" type="email" value={contact.email} onChange={(e) => updateContact({ email: e.target.value }, { continuous: true })} />
            <Input label="Website" value={contact.website} onChange={(e) => updateContact({ website: e.target.value }, { continuous: true })} />
            <Input label="Alamat" value={contact.address} onChange={(e) => updateContact({ address: e.target.value }, { continuous: true })} />
            <Input label="Tagline" value={contact.tagline} onChange={(e) => updateContact({ tagline: e.target.value }, { continuous: true })} />
          </div>
        </PanelCard>

        {/* Size */}
        <PanelCard title="Ukuran Kartu" subtitle="Elemen menyesuaikan otomatis (posisi berbasis persentase)">
          <div className="grid grid-cols-2 gap-2">
            {CARD_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSizeId(s.id)}
                className={cn(
                  "flex items-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all text-left",
                  design.sizeId === s.id
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                <Ruler className="w-3.5 h-3.5 shrink-0" />
                {s.label}
              </button>
            ))}
          </div>
          {design.sizeId === "custom" && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Input
                label="Lebar (mm)"
                type="number"
                min={30}
                max={200}
                value={design.customWMM}
                onChange={(e) => updateDesignRoot({ customWMM: Number(e.target.value) || 90 }, { continuous: true })}
              />
              <Input
                label="Tinggi (mm)"
                type="number"
                min={20}
                max={200}
                value={design.customHMM}
                onChange={(e) => updateDesignRoot({ customHMM: Number(e.target.value) || 55 }, { continuous: true })}
              />
            </div>
          )}
        </PanelCard>

        {/* Background */}
        <PanelCard title={`Latar Belakang — ${activeSide === "front" ? "Sisi Depan" : "Sisi Belakang"}`} subtitle="Warna solid, gradasi, atau gambar kustom">
          <ToggleRow
            value={currentSide.background.type}
            onChange={setBgType}
            options={[
              { value: "solid", label: "Warna", icon: <Palette className="w-3.5 h-3.5" /> },
              { value: "gradient", label: "Gradasi", icon: <Layers className="w-3.5 h-3.5" /> },
              { value: "image", label: "Gambar", icon: <ImageIcon className="w-3.5 h-3.5" /> },
            ]}
          />

          {currentSide.background.type === "solid" && (
            <GamatoColorPicker label="Warna Latar" value={currentSide.background.color} onChange={(c) => setBgSolidColor(c)} />
          )}

          {currentSide.background.type === "gradient" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <GamatoColorPicker label="Warna Awal" value={currentSide.background.from} onChange={(c) => setBgGradientFrom(c)} />
                <GamatoColorPicker label="Warna Akhir" value={currentSide.background.to} onChange={(c) => setBgGradientTo(c)} />
              </div>
              <div>
                <div className="flex justify-between mb-1"><Label>Sudut Gradasi</Label><span className="text-xs text-slate-400 dark:text-slate-500">{currentSide.background.angle}°</span></div>
                <GamatoSlider min={0} max={360} value={currentSide.background.angle} onChange={(v) => setBgGradientAngle(v, { continuous: true })} aria-label="Sudut gradasi" />
              </div>
            </div>
          )}

          {currentSide.background.type === "image" && (
            <div className="space-y-4">
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all text-sm font-semibold text-slate-500 dark:text-slate-400">
                <ImageIcon className="w-4 h-4" />
                {currentSide.background.src ? "Ganti Gambar Latar" : "Unggah Gambar Latar"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setBgImageFile(e.target.files?.[0] ?? null)} />
              </label>
              {currentSide.background.src && (
                <>
                  <ToggleRow
                    value={currentSide.background.fit}
                    onChange={setBgImageFit}
                    options={[
                      { value: "cover", label: "Penuhi (Cover)" },
                      { value: "contain", label: "Sesuaikan (Contain)" },
                    ]}
                  />
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <GamatoColorPicker label="Warna Overlay" value={currentSide.background.overlayColor} onChange={(c) => setBgOverlayColor(c)} />
                    <div>
                      <div className="flex justify-between mb-1"><Label>Opasitas Overlay</Label><span className="text-xs text-slate-400 dark:text-slate-500">{Math.round(currentSide.background.overlayOpacity * 100)}%</span></div>
                      <GamatoSlider min={0} max={1} step={0.05} value={currentSide.background.overlayOpacity} onChange={(v) => setBgOverlayOpacity(v, { continuous: true })} aria-label="Opasitas overlay" />
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Overlay membantu teks tetap terbaca di atas foto.</p>
                </>
              )}
            </div>
          )}
        </PanelCard>

        {/* Elements list */}
        <PanelCard title={`Elemen — ${activeSide === "front" ? "Sisi Depan" : "Sisi Belakang"}`} subtitle="Tambah, seret, dan atur lapisan bebas">
          <div className="grid grid-cols-3 gap-2">
            <Btn variant="secondary" onClick={addTextElement} className="text-xs gap-1.5"><Type className="w-3.5 h-3.5" />Teks</Btn>
            <label className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-all">
              <ImageIcon className="w-3.5 h-3.5" />Gambar
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => addImageElementFromFile(e.target.files?.[0] ?? null)} />
            </label>
            <div className="relative group">
              <Btn variant="secondary" className="text-xs gap-1.5 w-full"><Square className="w-3.5 h-3.5" />Bentuk</Btn>
              <div className="absolute z-10 hidden group-hover:flex group-focus-within:flex top-full mt-1 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5 gap-1">
                <button type="button" onClick={() => addShapeElement("rect")} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300" title="Kotak"><Square className="w-4 h-4" /></button>
                <button type="button" onClick={() => addShapeElement("circle")} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300" title="Lingkaran"><Circle className="w-4 h-4" /></button>
                <button type="button" onClick={() => addShapeElement("line")} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300" title="Garis"><LineIcon className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {currentSide.elements.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              Belum ada elemen di sisi ini. Tambahkan teks, gambar, atau bentuk.
            </p>
          ) : (
            <div className="space-y-1.5">
              {currentSide.elements.map((el, idx) => (
                <div
                  key={el.id}
                  onClick={() => setSelectedElementId(el.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border-2 cursor-pointer transition-all",
                    selectedElementId === el.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                      : "border-transparent bg-slate-50 dark:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-700"
                  )}
                >
                  <span className="text-slate-400 dark:text-slate-500 shrink-0">
                    {el.kind === "text" ? <Type className="w-3.5 h-3.5" /> : el.kind === "image" ? <ImageIcon className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  </span>
                  <span className="flex-1 min-w-0 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {el.kind === "text" ? (el.bind ? CONTACT_FIELD_LABEL[el.bind] : el.text || "Teks Kosong") : el.kind === "image" ? "Gambar" : `Bentuk · ${el.shape === "rect" ? "Kotak" : el.shape === "circle" ? "Lingkaran" : "Garis"}`}
                  </span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); moveElement(el.id, -1); }} disabled={idx === 0} className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none"><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); moveElement(el.id, 1); }} disabled={idx === currentSide.elements.length - 1} className="p-1 rounded text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:pointer-events-none"><ChevronDown className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); duplicateElement(el.id); }} className="p-1 rounded text-slate-400 hover:text-indigo-600" title="Duplikat"><Copy className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeElement(el.id); }} className="p-1 rounded text-slate-400 hover:text-red-500" title="Hapus"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        {/* Element properties */}
        {selectedElement && (
          <PanelCard title="Pengaturan Elemen" subtitle="Seret elemen langsung di pratinjau untuk mengatur posisi">
            {selectedElement.kind === "text" && (
              <TextElementPanel
                el={selectedElement}
                onChange={(patch, opts) => updateElement(selectedElement.id, patch, opts)}
                customFonts={customFonts}
                isFontLoading={isFontLoading}
                fontError={fontError}
                onUploadFont={addCustomFont}
                onRemoveCustomFont={handleRemoveCustomFont}
                alignOptions={alignOptions}
              />
            )}
            {selectedElement.kind === "shape" && (
              <ShapeElementPanel el={selectedElement} onChange={(patch, opts) => updateElement(selectedElement.id, patch, opts)} />
            )}
            {selectedElement.kind === "image" && (
              <ImageElementPanel el={selectedElement} onChange={(patch, opts) => updateElement(selectedElement.id, patch, opts)} onReplaceFile={(f) => replaceImageSrc(selectedElement.id, f)} />
            )}
          </PanelCard>
        )}
      </div>

      {/* RIGHT: preview + export */}
      <div className="space-y-4 lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pratinjau Langsung</p>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500"><Move className="w-3 h-3" />Seret elemen untuk atur posisi</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-1.5 shadow-sm">
          <ToggleRow
            value={activeSide}
            onChange={(v) => { setActiveSide(v); setSelectedElementId(null); }}
            options={[
              { value: "front", label: "Depan", icon: <IdCard className="w-3.5 h-3.5" /> },
              { value: "back", label: "Belakang", icon: <FlipHorizontal2 className="w-3.5 h-3.5" /> },
            ]}
          />
        </div>

        <div
          ref={previewWrapRef}
          onPointerMove={onPointerMovePreview}
          onPointerUp={onPointerUpPreview}
          style={{ aspectRatio: `${activeSizeMM.wMM} / ${activeSizeMM.hMM}` }}
          className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm select-none touch-none bg-slate-100 dark:bg-slate-800"
        >
          <canvas ref={frontCanvasRef} className={cn("w-full h-full block", activeSide !== "front" && "hidden")} />
          <canvas ref={backCanvasRef} className={cn("w-full h-full block", activeSide !== "back" && "hidden")} />
          {currentSide.elements.map((el) => (
            <div
              key={el.id}
              onPointerDown={(e) => onPointerDownElement(e, el.id)}
              style={{
                position: "absolute",
                left: `${el.xPct}%`,
                top: `${el.yPct}%`,
                width: `${el.kind === "text" ? el.widthPct : el.widthPct}%`,
                height: `${el.kind === "text" ? 14 : el.heightPct}%`,
                transform: "translate(-50%, -50%)",
              }}
              className={cn(
                "cursor-move rounded",
                selectedElementId === el.id ? "ring-2 ring-indigo-500" : "ring-1 ring-transparent hover:ring-indigo-300"
              )}
              title={el.kind === "text" ? (el.bind ? CONTACT_FIELD_LABEL[el.bind] : "Teks") : el.kind === "shape" ? `Bentuk ${el.shape}` : "Gambar"}
            />
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">{activeSizeMM.wMM} × {activeSizeMM.hMM} mm · {Math.round(activeSizeMM.wMM * PX_PER_MM)}×{Math.round(activeSizeMM.hMM * PX_PER_MM)}px</p>

        {info && <GamatoInlineAlert message={info.text} tone={info.type} />}

        <div className="grid grid-cols-2 gap-3">
          <Btn onClick={downloadPng} disabled={isExporting} className="gap-2">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PNG ({activeSide === "front" ? "Depan" : "Belakang"})
          </Btn>
          <Btn onClick={() => downloadPdf("current")} disabled={isExporting} variant="secondary" className="gap-2">
            <Download className="w-4 h-4" /> PDF (Sisi Ini)
          </Btn>
          <Btn onClick={() => downloadPdf("both")} disabled={isExporting} variant="secondary" className="gap-2">
            <Layers className="w-4 h-4" /> PDF (2 Sisi)
          </Btn>
          <Btn onClick={printCurrent} variant="secondary" className="gap-2">
            <Printer className="w-4 h-4" /> Cetak
          </Btn>
        </div>

        <div className="text-center"><SectionBadge>Diproses langsung di perangkatmu</SectionBadge></div>
      </div>
    </div>
  );
}

// ── Element property sub-panels ─────────────────────────────────────────

function TextElementPanel({
  el,
  onChange,
  customFonts,
  isFontLoading,
  fontError,
  onUploadFont,
  onRemoveCustomFont,
  alignOptions,
}: {
  el: CardTextElement;
  onChange: (patch: Partial<CardTextElement>, opts?: { continuous?: boolean }) => void;
  customFonts: ReturnType<typeof useCustomFonts>["customFonts"];
  isFontLoading: boolean;
  fontError: string | null;
  onUploadFont: (f: File | null) => void;
  onRemoveCustomFont: (id: string) => void;
  alignOptions: { value: "left" | "center" | "right"; label: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Sumber Teks</Label>
        <select
          value={el.bind ?? ""}
          onChange={(e) => onChange({ bind: (e.target.value || null) as CardTextElement["bind"] })}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
        >
          <option value="">Teks Bebas</option>
          {CONTACT_FIELD_KEYS.map((f) => (
            <option key={f} value={f}>{`Tertaut: ${CONTACT_FIELD_LABEL[f]}`}</option>
          ))}
        </select>
      </div>

      <Textarea
        label={el.bind ? "Teks Cadangan (jika data kontak kosong)" : "Isi Teks"}
        rows={2}
        value={el.text}
        onChange={(e) => onChange({ text: e.target.value }, { continuous: true })}
      />

      <div className="grid grid-cols-2 gap-3 items-start">
        <FontPicker
          hideUpload
          value={el.fontFamily}
          onChange={(family) => onChange({ fontFamily: family })}
          customFonts={customFonts}
          isFontLoading={isFontLoading}
          fontError={fontError}
          onUpload={onUploadFont}
          onRemoveCustomFont={onRemoveCustomFont}
        />
        <Input label="Ukuran (px)" type="number" min={6} max={80} value={el.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) || 14 }, { continuous: true })} />
      </div>
      <FontPicker
        hideSelect
        value={el.fontFamily}
        onChange={(family) => onChange({ fontFamily: family })}
        customFonts={customFonts}
        isFontLoading={isFontLoading}
        fontError={fontError}
        onUpload={onUploadFont}
        onRemoveCustomFont={onRemoveCustomFont}
      />

      <GamatoColorPicker label="Warna Teks" value={el.color} onChange={(c) => onChange({ color: c })} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Gaya</Label>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => onChange({ bold: !el.bold })} aria-pressed={el.bold} className={cn("flex items-center justify-center p-2.5 rounded-lg border-2", el.bold ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400")}><Bold className="w-4 h-4" /></button>
            <button type="button" onClick={() => onChange({ italic: !el.italic })} aria-pressed={el.italic} className={cn("flex items-center justify-center p-2.5 rounded-lg border-2", el.italic ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400")}><Italic className="w-4 h-4" /></button>
            <button type="button" onClick={() => onChange({ uppercase: !el.uppercase })} aria-pressed={el.uppercase} className={cn("flex items-center justify-center p-2.5 rounded-lg border-2", el.uppercase ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400")}><CaseUpper className="w-4 h-4" /></button>
          </div>
        </div>
        <div>
          <Label>Perataan</Label>
          <div className="grid grid-cols-3 gap-2">
            {alignOptions.map((opt) => (
              <button key={opt.value} type="button" onClick={() => onChange({ align: opt.value })} aria-pressed={el.align === opt.value} className={cn("flex items-center justify-center p-2.5 rounded-lg border-2", el.align === opt.value ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400")}>{opt.icon}</button>
            ))}
          </div>
        </div>
      </div>

      <SliderField label="Lebar Kotak Teks" unit="%" min={10} max={100} value={el.widthPct} onChange={(v) => onChange({ widthPct: v }, { continuous: true })} />
      <SliderField label="Jarak Antar Huruf" unit="px" min={0} max={10} step={0.5} value={el.letterSpacing} onChange={(v) => onChange({ letterSpacing: v }, { continuous: true })} />
      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Rotasi" unit="°" min={-180} max={180} value={el.rotation} onChange={(v) => onChange({ rotation: v }, { continuous: true })} />
        <SliderField label="Opasitas" unit="%" min={10} max={100} value={Math.round(el.opacity * 100)} onChange={(v) => onChange({ opacity: v / 100 }, { continuous: true })} />
      </div>
    </div>
  );
}

function ShapeElementPanel({ el, onChange }: { el: CardShapeElement; onChange: (patch: Partial<CardShapeElement>, opts?: { continuous?: boolean }) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Jenis Bentuk</Label>
        <ToggleRow
          value={el.shape}
          onChange={(v) => onChange({ shape: v })}
          options={[
            { value: "rect", label: "Kotak", icon: <Square className="w-3.5 h-3.5" /> },
            { value: "circle", label: "Lingkaran", icon: <Circle className="w-3.5 h-3.5" /> },
            { value: "line", label: "Garis", icon: <LineIcon className="w-3.5 h-3.5" /> },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Lebar" unit="%" min={1} max={100} value={el.widthPct} onChange={(v) => onChange({ widthPct: v }, { continuous: true })} />
        <SliderField label={el.shape === "line" ? "Ketebalan" : "Tinggi"} unit="%" min={0.2} max={100} step={0.2} value={el.heightPct} onChange={(v) => onChange({ heightPct: v }, { continuous: true })} />
      </div>

      <div className="flex items-center justify-between">
        <GamatoCheckbox checked={el.hasFill} onChange={(v) => onChange({ hasFill: v })} label="Isi Warna" />
        {el.hasFill && <GamatoColorPicker value={el.fill} onChange={(c) => onChange({ fill: c })} />}
      </div>
      {el.shape !== "line" && (
        <>
          <div className="flex items-center justify-between">
            <GamatoCheckbox checked={el.hasStroke} onChange={(v) => onChange({ hasStroke: v })} label="Garis Tepi" />
            {el.hasStroke && <GamatoColorPicker value={el.stroke} onChange={(c) => onChange({ stroke: c })} />}
          </div>
          {el.hasStroke && <SliderField label="Ketebalan Garis Tepi" unit="px" min={1} max={20} value={el.strokeWidth} onChange={(v) => onChange({ strokeWidth: v }, { continuous: true })} />}
        </>
      )}
      {el.shape === "rect" && <SliderField label="Radius Sudut" unit="px" min={0} max={100} value={el.radius} onChange={(v) => onChange({ radius: v }, { continuous: true })} />}

      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Rotasi" unit="°" min={-180} max={180} value={el.rotation} onChange={(v) => onChange({ rotation: v }, { continuous: true })} />
        <SliderField label="Opasitas" unit="%" min={10} max={100} value={Math.round(el.opacity * 100)} onChange={(v) => onChange({ opacity: v / 100 }, { continuous: true })} />
      </div>
    </div>
  );
}

function ImageElementPanel({
  el,
  onChange,
  onReplaceFile,
}: {
  el: CardImageElement;
  onChange: (patch: Partial<CardImageElement>, opts?: { continuous?: boolean }) => void;
  onReplaceFile: (f: File | null) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all text-sm font-semibold text-slate-500 dark:text-slate-400">
        <ImageIcon className="w-4 h-4" />
        {el.src ? "Ganti Gambar" : "Unggah Gambar"}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onReplaceFile(e.target.files?.[0] ?? null)} />
      </label>

      <div>
        <Label>Bentuk Gambar</Label>
        <ToggleRow
          value={el.circle ? "circle" : el.rounded ? "rounded" : "square"}
          onChange={(v) => onChange(v === "circle" ? { circle: true, rounded: false } : v === "rounded" ? { circle: false, rounded: true } : { circle: false, rounded: false })}
          options={[
            { value: "square", label: "Persegi" },
            { value: "rounded", label: "Membulat" },
            { value: "circle", label: "Lingkaran" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Lebar" unit="%" min={5} max={100} value={el.widthPct} onChange={(v) => onChange({ widthPct: v }, { continuous: true })} />
        <SliderField label="Tinggi" unit="%" min={5} max={100} value={el.heightPct} onChange={(v) => onChange({ heightPct: v }, { continuous: true })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SliderField label="Rotasi" unit="°" min={-180} max={180} value={el.rotation} onChange={(v) => onChange({ rotation: v }, { continuous: true })} />
        <SliderField label="Opasitas" unit="%" min={10} max={100} value={Math.round(el.opacity * 100)} onChange={(v) => onChange({ opacity: v / 100 }, { continuous: true })} />
      </div>
    </div>
  );
}

function SliderField({
  label,
  unit,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1"><Label>{label}</Label><span className="text-xs text-slate-400 dark:text-slate-500">{value}{unit}</span></div>
      <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
    </div>
  );
}
