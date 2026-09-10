import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Upload, Download, Sparkles, AlertTriangle, RefreshCw, Palette,
  Frame as FrameIcon, Square, Circle as CircleIcon, ClipboardCopy, Check,
  Ruler, ImagePlus, Wand2,
} from "lucide-react";
import QRCodeStyling from "qr-code-styling";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToDataUrl } from "@/lib/file";
import { buildFramedLogoDataUrl, type QrLogoShape } from "@/lib/qrLogo";
import { composeFramedQrCanvas, canvasToBlob } from "@/lib/qrFrame";
import { AUTO_ICONS, resolveAutoIconId, buildAutoIconDataUrl, getAutoIcon } from "@/lib/qrAutoIcons";
import { QR_TEMPLATES, QR_TEMPLATE_CATEGORIES, getQrTemplate, type QrFieldDef, type QrFieldValues } from "@/lib/qrContentTemplates";
import { QR_STYLE_PRESETS, type DotType, type CornerSquareType, type CornerDotType, type QrShape, type QrStylePreset } from "@/features/qr-barcode/qrStylePresets";
import { ColorModeControl, defaultColorState, toQrColorOptions, type ColorState } from "@/components/ui/ColorModeControl";
import { Label, Input, Select, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoTooltip } from "@/components/ui/GamatoTooltip";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";

const DOT_STYLES: { id: DotType; label: string }[] = [
  { id: "square", label: "Kotak" },
  { id: "dots", label: "Bulat" },
  { id: "rounded", label: "Membulat" },
  { id: "classy", label: "Classy" },
  { id: "classy-rounded", label: "Classy+" },
  { id: "extra-rounded", label: "Ekstra Bulat" },
];

const CORNER_SQUARE_STYLES: { id: CornerSquareType; label: string }[] = [
  { id: "square", label: "Kotak" },
  { id: "dot", label: "Bulat" },
  { id: "extra-rounded", label: "Membulat" },
];

const CORNER_DOT_STYLES: { id: CornerDotType; label: string }[] = [
  { id: "square", label: "Kotak" },
  { id: "dot", label: "Bulat" },
];

const ERROR_CORRECTION_OPTIONS: { id: "auto" | "L" | "M" | "Q" | "H"; label: string }[] = [
  { id: "auto", label: "Otomatis" },
  { id: "L", label: "L · 7%" },
  { id: "M", label: "M · 15%" },
  { id: "Q", label: "Q · 25%" },
  { id: "H", label: "H · 30%" },
];

const LOGO_SHAPE_OPTIONS: { id: QrLogoShape; label: string }[] = [
  { id: "rounded", label: "Rounded" },
  { id: "circle", label: "Bulat" },
  { id: "square", label: "Kotak" },
  { id: "none", label: "Asli" },
];

type LogoMode = "auto" | "gallery" | "upload" | "none";

const LOGO_MODE_OPTIONS: { id: LogoMode; label: string; icon: typeof Wand2 }[] = [
  { id: "auto", label: "Otomatis", icon: Wand2 },
  { id: "gallery", label: "Galeri Ikon", icon: Sparkles },
  { id: "upload", label: "Upload Sendiri", icon: ImagePlus },
  { id: "none", label: "Tanpa Logo", icon: Square },
];

function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  if (c.length !== 6) return 1;
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1) + 0.05;
  const l2 = relativeLuminance(hex2) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

type ErrorCorrection = "auto" | "L" | "M" | "Q" | "H";

type QrConfig = {
  qrTemplate: string;
  templateData: Record<string, QrFieldValues>;
  size: number;
  margin: number;
  shape: QrShape;
  errorCorrection: ErrorCorrection;
  dotsType: DotType;
  cornersSquareType: CornerSquareType;
  cornersDotType: CornerDotType;
  dots: ColorState;
  cornersSquare: ColorState;
  cornersDot: ColorState;
  background: ColorState;
  bgTransparent: boolean;
  bgRound: number;
  logoMode: LogoMode;
  logoGalleryId: string | null;
  logoSizeRatio: number;
  logoMargin: number;
  logoHideBackgroundDots: boolean;
  logoShape: QrLogoShape;
  frameEnabled: boolean;
  frameText: string;
  frameTextColor: string;
  frameBgColor: string;
  framePosition: "top" | "bottom";
};

const DEFAULT_QR_CONFIG: QrConfig = {
  qrTemplate: "url",
  templateData: {},
  size: 320,
  margin: 8,
  shape: "square",
  errorCorrection: "auto",
  dotsType: "rounded",
  cornersSquareType: "extra-rounded",
  cornersDotType: "dot",
  dots: defaultColorState("#4f46e5"),
  cornersSquare: defaultColorState("#4f46e5"),
  cornersDot: defaultColorState("#4f46e5"),
  background: defaultColorState("#ffffff"),
  bgTransparent: false,
  bgRound: 0,
  logoMode: "auto",
  logoGalleryId: null,
  logoSizeRatio: 0.35,
  logoMargin: 6,
  logoHideBackgroundDots: true,
  logoShape: "rounded",
  frameEnabled: false,
  frameText: "SCAN ME",
  frameTextColor: "#ffffff",
  frameBgColor: "#4f46e5",
  framePosition: "bottom",
};

// ─── Data-driven template field rendering ───────────────────────────────────
function isFieldVisible(field: QrFieldDef, data: QrFieldValues): boolean {
  if (!field.showWhen) return true;
  const dep = data[field.showWhen.key];
  if (field.showWhen.equals !== undefined) return dep === field.showWhen.equals;
  if (field.showWhen.notEquals !== undefined) return dep !== field.showWhen.notEquals;
  return true;
}

function QrFieldInput({ field, data, onChange }: { field: QrFieldDef; data: QrFieldValues; onChange: (key: string, v: string | boolean) => void }) {
  const value = data[field.key];
  const id = `qr-field-${field.key}`;
  switch (field.type) {
    case "textarea":
      return <Textarea id={id} label={field.label} rows={field.rows ?? 3} value={String(value ?? "")} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.placeholder} />;
    case "select":
      return (
        <Select id={id} label={field.label} value={String(value ?? "")} onChange={(e) => onChange(field.key, e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      );
    case "checkbox":
      return <GamatoCheckbox checked={!!value} onChange={(v) => onChange(field.key, v)} label={field.label} />;
    case "date":
    case "time":
      return <Input id={id} label={field.label} type={field.type} value={String(value ?? "")} onChange={(e) => onChange(field.key, e.target.value)} />;
    default:
      return <Input id={id} label={field.label} type={field.type} value={String(value ?? "")} onChange={(e) => onChange(field.key, e.target.value)} placeholder={field.placeholder} />;
  }
}

function renderTemplateFields(fields: QrFieldDef[], data: QrFieldValues, onChange: (key: string, v: string | boolean) => void) {
  const visible = fields.filter((f) => isFieldVisible(f, data));
  const nodes: ReactNode[] = [];
  for (let i = 0; i < visible.length; i++) {
    const f = visible[i];
    const next = visible[i + 1];
    if (f.half && next?.half) {
      nodes.push(
        <div key={f.key} className="grid grid-cols-2 gap-3">
          <QrFieldInput field={f} data={data} onChange={onChange} />
          <QrFieldInput field={next} data={data} onChange={onChange} />
        </div>
      );
      i++;
    } else {
      nodes.push(<QrFieldInput key={f.key} field={f} data={data} onChange={onChange} />);
    }
  }
  return nodes;
}

const pillClass = (active: boolean) =>
  cn(
    "px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
    active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300"
  );

export function QrCodeGenerator() {
  const qrHistory = useHistoryState<QrConfig>(() => DEFAULT_QR_CONFIG);
  const qrConfig = qrHistory.state;
  const { schedule: scheduleQrCommit } = useDebouncedCommit(qrHistory.commit, 600);
  function setQrField<K extends keyof QrConfig>(key: K, value: QrConfig[K]) {
    qrHistory.set((prev) => ({ ...prev, [key]: value }), { commit: false });
    scheduleQrCommit();
  }
  const {
    qrTemplate, templateData, size, margin, shape, errorCorrection,
    dotsType, cornersSquareType, cornersDotType, dots, cornersSquare, cornersDot, background, bgTransparent, bgRound,
    logoMode, logoGalleryId, logoSizeRatio, logoMargin, logoHideBackgroundDots, logoShape,
    frameEnabled, frameText, frameTextColor, frameBgColor, framePosition,
  } = qrConfig;

  const setQrTemplate = (v: string) => setQrField("qrTemplate", v);
  const setSize = (v: number) => setQrField("size", v);
  const setMargin = (v: number) => setQrField("margin", v);
  const setShape = (v: QrShape) => setQrField("shape", v);
  const setErrorCorrection = (v: ErrorCorrection) => setQrField("errorCorrection", v);
  const setDotsType = (v: DotType) => setQrField("dotsType", v);
  const setCornersSquareType = (v: CornerSquareType) => setQrField("cornersSquareType", v);
  const setCornersDotType = (v: CornerDotType) => setQrField("cornersDotType", v);
  const setDots = (v: ColorState) => setQrField("dots", v);
  const setCornersSquare = (v: ColorState) => setQrField("cornersSquare", v);
  const setCornersDot = (v: ColorState) => setQrField("cornersDot", v);
  const setBackground = (v: ColorState) => setQrField("background", v);
  const setBgTransparent = (v: boolean) => setQrField("bgTransparent", v);
  const setBgRound = (v: number) => setQrField("bgRound", v);
  const setLogoMode = (v: LogoMode) => setQrField("logoMode", v);
  const setLogoGalleryId = (v: string) => setQrField("logoGalleryId", v);
  const setLogoSizeRatio = (v: number) => setQrField("logoSizeRatio", v);
  const setLogoMargin = (v: number) => setQrField("logoMargin", v);
  const setLogoHideBackgroundDots = (v: boolean) => setQrField("logoHideBackgroundDots", v);
  const setLogoShape = (v: QrLogoShape) => setQrField("logoShape", v);
  const setFrameEnabled = (v: boolean) => setQrField("frameEnabled", v);
  const setFrameText = (v: string) => setQrField("frameText", v);
  const setFrameTextColor = (v: string) => setQrField("frameTextColor", v);
  const setFrameBgColor = (v: string) => setQrField("frameBgColor", v);
  const setFramePosition = (v: "top" | "bottom") => setQrField("framePosition", v);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [copyError, setCopyError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);

  // Always render at least 2x the visual "Ukuran" setting (matching the
  // device's own pixel ratio when that's higher, up to 4x) so both the live
  // preview and every exported file are crisp — not a blurry 1:1 bitmap
  // stretched up by the browser. Since qr-code-styling draws everything as
  // vector SVG internally before rasterizing to canvas, rendering at a
  // higher target resolution genuinely produces sharper pixels, it isn't
  // just upscaling a soft source image.
  const [renderScale] = useState(() => Math.min(Math.max(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2), 4));

  const activeTemplate = getQrTemplate(qrTemplate);
  const activeData: QrFieldValues = templateData[qrTemplate] ?? activeTemplate.defaultData;
  const updateTemplateField = (key: string, value: string | boolean) => {
    setQrField("templateData", { ...templateData, [qrTemplate]: { ...activeData, [key]: value } });
  };

  const payload = useMemo(
    () => activeTemplate.buildPayload(activeData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qrTemplate, templateData]
  );

  // Which built-in icon naturally matches the current template + subtype
  // (e.g. the "social" template's icon follows whichever platform field is
  // currently selected) — this is what "Otomatis" logo mode resolves to.
  const autoIconId = useMemo(() => resolveAutoIconId(qrTemplate, activeData), [qrTemplate, activeData]);

  // Resolve whichever logo source is currently active (auto icon / gallery
  // pick / uploaded file / none), then run it through buildFramedLogoDataUrl
  // so it always comes out as a clean, consistently-shaped badge — same
  // pipeline regardless of where the source image came from.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let rawUrl: string | null = null;
      if (logoMode === "upload" && logoFile) {
        rawUrl = await fileToDataUrl(logoFile);
      } else if (logoMode === "gallery" && logoGalleryId) {
        rawUrl = buildAutoIconDataUrl(logoGalleryId);
      } else if (logoMode === "auto" && autoIconId) {
        rawUrl = buildAutoIconDataUrl(autoIconId);
      }
      if (!rawUrl) {
        if (!cancelled) setLogoDataUrl(null);
        return;
      }
      try {
        const framed = await buildFramedLogoDataUrl(rawUrl, { shape: logoShape });
        if (!cancelled) setLogoDataUrl(framed);
      } catch {
        if (!cancelled) setLogoDataUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [logoMode, logoFile, logoGalleryId, autoIconId, logoShape]);

  const currentOptions = () => {
    const dotsOpt = toQrColorOptions(dots);
    const cornersSquareOpt = toQrColorOptions(cornersSquare);
    const cornersDotOpt = toQrColorOptions(cornersDot);
    const bgOpt = bgTransparent ? { color: "transparent", gradient: undefined } : toQrColorOptions(background);
    const effectiveErrorCorrection = errorCorrection === "auto" ? (logoDataUrl ? "H" : "Q") : errorCorrection;
    const renderSize = Math.round(size * renderScale);
    return {
      width: renderSize,
      height: renderSize,
      type: "canvas" as const,
      shape,
      data: payload.trim() || " ",
      margin: Math.round(margin * renderScale),
      qrOptions: { errorCorrectionLevel: effectiveErrorCorrection as "L" | "M" | "Q" | "H" },
      dotsOptions: { type: dotsType, color: dotsOpt.color, gradient: dotsOpt.gradient },
      backgroundOptions: { color: bgOpt.color, gradient: bgOpt.gradient, round: bgTransparent ? 0 : bgRound },
      cornersSquareOptions: { type: cornersSquareType, color: cornersSquareOpt.color, gradient: cornersSquareOpt.gradient },
      cornersDotOptions: { type: cornersDotType, color: cornersDotOpt.color, gradient: cornersDotOpt.gradient },
      image: logoDataUrl || undefined,
      imageOptions: { hideBackgroundDots: logoHideBackgroundDots, imageSize: logoSizeRatio, margin: Math.round(logoMargin * renderScale), crossOrigin: "anonymous" as const },
    };
  };

  // Create the QR instance once and mount it into the DOM.
  useEffect(() => {
    const instance = new QRCodeStyling(currentOptions());
    qrInstanceRef.current = instance;
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      instance.append(containerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push every style/content change into the live instance (no re-mount needed).
  useEffect(() => {
    qrInstanceRef.current?.update(currentOptions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    payload, size, margin, shape, errorCorrection,
    dotsType, cornersSquareType, cornersDotType, dots, cornersSquare, cornersDot, background, bgTransparent, bgRound,
    logoDataUrl, logoSizeRatio, logoMargin, logoHideBackgroundDots,
  ]);

  const applyPreset = (p: QrStylePreset) => {
    setDotsType(p.dotsType);
    setCornersSquareType(p.cornersSquareType);
    setCornersDotType(p.cornersDotType);
    setDots(p.dots);
    setCornersSquare(p.cornersSquare);
    setCornersDot(p.cornersDot);
    setBackground(p.background);
    setBgTransparent(p.bgTransparent);
    setBgRound(p.bgRound);
    setShape(p.shape);
  };

  const getPreviewCanvas = (): HTMLCanvasElement | null => containerRef.current?.querySelector("canvas") ?? null;

  const buildExportBlob = async (extension: "png" | "jpeg" | "webp" | "svg"): Promise<{ blob: Blob } | null> => {
    if (frameEnabled && extension !== "svg") {
      const qrCanvas = getPreviewCanvas();
      if (qrCanvas) {
        try {
          const framed = await composeFramedQrCanvas(qrCanvas, { text: frameText, textColor: frameTextColor, bgColor: frameBgColor, position: framePosition });
          const mime = extension === "png" ? "image/png" : extension === "jpeg" ? "image/jpeg" : "image/webp";
          const blob = await canvasToBlob(framed, mime, extension === "jpeg" ? 0.95 : undefined);
          if (blob) return { blob };
        } catch {
          // fall through to the library's own raw export as a safe fallback
        }
      }
    }
    const raw = await qrInstanceRef.current?.getRawData(extension);
    if (!raw) return null;
    const blob = raw instanceof Blob ? raw : new Blob([raw as BlobPart]);
    return { blob };
  };

  const download = async (extension: "png" | "jpeg" | "webp" | "svg") => {
    const result = await buildExportBlob(extension);
    if (!result) { qrInstanceRef.current?.download({ name: "gamato-qr", extension }); return; }
    downloadBlob(result.blob, `gamato-qr.${extension}`);
  };

  const copyToClipboard = async () => {
    setCopyError(null);
    try {
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("unsupported");
      const result = await buildExportBlob("png");
      if (!result) throw new Error("empty");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": result.blob })]);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      setCopyError("Salin gambar tidak didukung di browser ini. Gunakan tombol unduh sebagai gantinya.");
      setTimeout(() => setCopyState("idle"), 2500);
    }
  };

  // Manual, always-works fallback: fully clears and re-mounts the QR
  // instance into the preview container.
  const refreshPreview = () => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    const instance = new QRCodeStyling(currentOptions());
    qrInstanceRef.current = instance;
    instance.append(containerRef.current);
  };

  const contrast = useMemo(() => contrastRatio(dots.color, bgTransparent ? "#ffffff" : background.color), [dots.color, bgTransparent, background.color]);
  const lowContrast = !bgTransparent && contrast < 2.2;

  const activeAutoIcon = autoIconId ? getAutoIcon(autoIconId) : undefined;
  const activeGalleryIcon = logoGalleryId ? getAutoIcon(logoGalleryId) : undefined;
  const boxSizePx = size + 40; // matches the p-5 (20px) padding around the QR canvas in the preview card — this is the VISUAL/display size; the canvas itself renders internally at size*renderScale for sharpness, then CSS scales it back down to this box.

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        {/* LEFT: Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor QR Code</p>
            <UndoRedoBar canUndo={qrHistory.canUndo} canRedo={qrHistory.canRedo} onUndo={qrHistory.undo} onRedo={qrHistory.redo} />
          </div>

          {/* Isi QR — template selector, grouped by category, + the active template's form */}
          <CollapsibleSection title="Isi QR" subtitle="Pilih jenis konten lalu isi datanya" badge={`${QR_TEMPLATES.length} Tipe`} defaultOpen>
            <div className="space-y-4">
              {QR_TEMPLATE_CATEGORIES.map((cat) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {QR_TEMPLATES.filter((t) => t.category === cat).map((t) => {
                      const Icon = t.icon;
                      return (
                        <button key={t.id} type="button" onClick={() => setQrTemplate(t.id)}
                          className={cn("flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all",
                            qrTemplate === t.id ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10")}>
                          <Icon className="w-4 h-4" /><span>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {renderTemplateFields(activeTemplate.fields, activeData, updateTemplateField)}
              {activeTemplate.note && <p className="text-xs text-slate-400 dark:text-slate-500">{activeTemplate.note}</p>}
            </div>
          </CollapsibleSection>

          {/* Style presets */}
          <CollapsibleSection title="Gaya Instan" subtitle="Sentuh sekali, langsung jadi" icon={<Sparkles className="w-4 h-4" />} badge={`${QR_STYLE_PRESETS.length} Preset`} defaultOpen>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {QR_STYLE_PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => applyPreset(p)}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 transition-all">
                  <span
                    className={cn("w-8 h-8 border border-slate-200 dark:border-slate-600 shrink-0 overflow-hidden", p.shape === "circle" ? "rounded-full" : "rounded-lg")}
                    style={{ backgroundColor: p.swatchBg === "transparent" ? undefined : p.swatchBg, backgroundImage: p.swatchBg === "transparent" ? "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%)" : undefined, backgroundSize: p.swatchBg === "transparent" ? "8px 8px" : undefined }}
                  >
                    <span className="block w-full h-full" style={{ background: `linear-gradient(135deg, ${p.swatchFrom}, ${p.swatchTo})` }} />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 text-center leading-tight">{p.name}</span>
                </button>
              ))}
            </div>
          </CollapsibleSection>

          {/* Warna & Bentuk */}
          <CollapsibleSection title="Warna & Bentuk" subtitle="Titik, sudut, latar, dan bentuk QR" icon={<Palette className="w-4 h-4" />}>
            <div>
              <Label>Bentuk Titik (Dots)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {DOT_STYLES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setDotsType(s.id)} className={pillClass(dotsType === s.id)}>{s.label}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bentuk Sudut Luar</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {CORNER_SQUARE_STYLES.map((s) => (
                    <button key={s.id} type="button" onClick={() => setCornersSquareType(s.id)} className={pillClass(cornersSquareType === s.id)}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Bentuk Sudut Dalam</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {CORNER_DOT_STYLES.map((s) => (
                    <button key={s.id} type="button" onClick={() => setCornersDotType(s.id)} className={pillClass(cornersDotType === s.id)}>{s.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label>Bentuk Keseluruhan</Label>
              <div className="flex gap-1.5 mt-1.5">
                <button type="button" onClick={() => setShape("square")} className={cn(pillClass(shape === "square"), "flex items-center gap-1.5")}>
                  <Square className="w-3.5 h-3.5" />Persegi
                </button>
                <button type="button" onClick={() => setShape("circle")} className={cn(pillClass(shape === "circle"), "flex items-center gap-1.5")}>
                  <CircleIcon className="w-3.5 h-3.5" />Lingkaran
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-5 pt-1 border-t border-slate-100 dark:border-slate-800">
              <ColorModeControl label="Warna Titik" value={dots} onChange={setDots} className="pt-4" testId="dots" />
              <ColorModeControl label="Warna Sudut Luar" value={cornersSquare} onChange={setCornersSquare} className="pt-4" testId="cornersSquare" />
              <ColorModeControl label="Warna Sudut Dalam" value={cornersDot} onChange={setCornersDot} className="pt-4" testId="cornersDot" />
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Warna Latar</Label>
                  <GamatoCheckbox checked={bgTransparent} onChange={setBgTransparent} label={<span className="text-[11px]">Transparan</span>} testId="bgTransparent-checkbox" />
                </div>
                {bgTransparent ? (
                  <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2.5 text-[11px] text-slate-400 dark:text-slate-500" style={{ backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%)", backgroundSize: "10px 10px" }}>
                    Latar dibiarkan transparan (cocok untuk ditempel di atas desain lain).
                  </div>
                ) : (
                  <ColorModeControl label="" value={background} onChange={setBackground} testId="background" />
                )}
              </div>
            </div>

            {!bgTransparent && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Kelengkungan Latar</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(bgRound * 100)}%</span>
                </div>
                <GamatoSlider min={0} max={1} step={0.05} value={bgRound} onChange={setBgRound} aria-label="Kelengkungan latar belakang" />
              </div>
            )}

            {lowContrast && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Kontras warna titik &amp; latar cukup rendah — bisa mempersulit pemindaian. Coba warna yang lebih kontras untuk hasil paling aman.</span>
              </div>
            )}
          </CollapsibleSection>

          {/* Ukuran & Kualitas */}
          <CollapsibleSection title="Ukuran & Kualitas" subtitle="Dimensi, margin, dan ketahanan pindai" icon={<Ruler className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Ukuran</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{size}px</span>
                </div>
                <GamatoSlider min={200} max={600} step={10} value={size} onChange={setSize} aria-label="Ukuran QR" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Margin</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{margin}px</span>
                </div>
                <GamatoSlider min={0} max={40} step={2} value={margin} onChange={setMargin} aria-label="Margin QR" />
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500">File diekspor pada resolusi {renderScale}× lebih tinggi dari angka di atas supaya hasilnya tetap tajam saat dicetak atau di-zoom.</p>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Label>Tingkat Koreksi Error</Label>
                <GamatoTooltip label="Level lebih tinggi = QR lebih tahan kotor/rusak, tapi kepadatan modul bertambah. Otomatis memakai H saat logo aktif.">
                  <span className="text-slate-300 dark:text-slate-600 text-xs cursor-help">ⓘ</span>
                </GamatoTooltip>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ERROR_CORRECTION_OPTIONS.map((o) => (
                  <button key={o.id} type="button" onClick={() => setErrorCorrection(o.id)} className={pillClass(errorCorrection === o.id)}>{o.label}</button>
                ))}
              </div>
            </div>
          </CollapsibleSection>

          {/* Logo Tengah — auto / gallery / upload / none */}
          <CollapsibleSection title="Logo Tengah" subtitle="Otomatis menyesuaikan tipe QR, atau pilih sendiri" icon={<ImagePlus className="w-4 h-4" />} defaultOpen>
            <div className="flex flex-wrap gap-1.5">
              {LOGO_MODE_OPTIONS.map((o) => {
                const Icon = o.icon;
                return (
                  <button key={o.id} type="button" onClick={() => setLogoMode(o.id)} data-testid={`logo-mode-${o.id}`}
                    className={cn("flex items-center gap-1.5", pillClass(logoMode === o.id))}>
                    <Icon className="w-3.5 h-3.5" />{o.label}
                  </button>
                );
              })}
            </div>

            {logoMode === "auto" && (
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
                {activeAutoIcon ? (
                  <>
                    <img src={buildAutoIconDataUrl(activeAutoIcon.id) ?? undefined} alt={activeAutoIcon.label} className="w-11 h-11 rounded-lg shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ikon otomatis: {activeAutoIcon.label}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Menyesuaikan otomatis saat kamu ganti tipe QR di atas.</p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500">Tipe QR ini belum punya ikon otomatis — pilih dari Galeri atau Upload sendiri.</p>
                )}
              </div>
            )}

            {logoMode === "gallery" && (
              <div className="space-y-2">
                <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-72 overflow-y-auto pr-1">
                  {AUTO_ICONS.map((icon) => (
                    <button key={icon.id} type="button" onClick={() => setLogoGalleryId(icon.id)} title={icon.label} data-testid={`gallery-icon-${icon.id}`}
                      className={cn("relative rounded-xl p-1 border-2 transition-all", logoGalleryId === icon.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-transparent hover:border-indigo-200")}>
                      <img src={buildAutoIconDataUrl(icon.id) ?? undefined} alt={icon.label} className="w-full aspect-square rounded-lg" />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">{activeGalleryIcon ? `Dipilih: ${activeGalleryIcon.label}` : "Pilih salah satu ikon di atas."}</p>
              </div>
            )}

            {logoMode === "upload" && (
              <div className="relative">
                <label className="flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all group">
                  {logoFile && logoDataUrl ? (
                    <div className="flex items-center gap-4 w-full pr-14">
                      <img src={logoDataUrl} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm" />
                      <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 font-medium">Logo terpasang — klik untuk ganti</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="flex justify-center mb-2 text-slate-400 dark:text-slate-500"><Upload className="w-7 h-7" /></div>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Upload Logo <span className="text-indigo-600 dark:text-indigo-400">PNG/JPG</span></p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Akan tampil di tengah QR code</p>
                    </div>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
                </label>
                {logoFile && (
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLogoFile(null); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-red-500 font-semibold hover:text-red-700">
                    Hapus
                  </button>
                )}
              </div>
            )}

            {logoMode !== "none" && logoDataUrl && (
              <div className="space-y-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <Label>Bentuk Bingkai Logo</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {LOGO_SHAPE_OPTIONS.map((o) => (
                      <button key={o.id} type="button" data-testid={`logo-shape-${o.id}`} onClick={() => setLogoShape(o.id)} className={pillClass(logoShape === o.id)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {logoShape === "none" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Mode "Asli" memakai gambar apa adanya tanpa bantalan bersih di sekitarnya — di ukuran besar &amp; logo yang ramai, ini bisa menurunkan keterbacaan. Kecilkan ukuran logo atau pakai bentuk lain bila QR sulit dipindai.</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Ukuran Logo</span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{Math.round(logoSizeRatio * 100)}%</span>
                    </div>
                    <GamatoSlider min={0.15} max={0.45} step={0.01} value={logoSizeRatio} onChange={setLogoSizeRatio} aria-label="Ukuran logo" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Margin Logo</span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{logoMargin}px</span>
                    </div>
                    <GamatoSlider min={0} max={20} step={1} value={logoMargin} onChange={setLogoMargin} aria-label="Margin logo" />
                  </div>
                </div>
                <GamatoCheckbox checked={logoHideBackgroundDots} onChange={setLogoHideBackgroundDots} label="Sembunyikan titik QR di belakang logo" />
              </div>
            )}
          </CollapsibleSection>

          {/* Frame / label */}
          <CollapsibleSection title="Bingkai & Label Teks" subtitle='Tambahkan banner "SCAN ME" di atas/bawah' icon={<FrameIcon className="w-4 h-4" />}>
            <div className="flex items-center justify-between -mt-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Aktifkan bingkai</span>
              <GamatoCheckbox checked={frameEnabled} onChange={setFrameEnabled} testId="frame-enabled-checkbox" />
            </div>
            {frameEnabled && (
              <div className="space-y-4">
                <Input id="qr-frame-text" label="Teks Label" value={frameText} onChange={(e) => setFrameText(e.target.value)} placeholder="SCAN ME" maxLength={40} />
                <div>
                  <Label>Posisi</Label>
                  <div className="flex gap-1.5 mt-1.5">
                    {(["top", "bottom"] as const).map((pos) => (
                      <button key={pos} type="button" onClick={() => setFramePosition(pos)} className={pillClass(framePosition === pos)}>
                        {pos === "top" ? "Atas" : "Bawah"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <GamatoColorPicker label="Warna Latar Label" value={frameBgColor} onChange={setFrameBgColor} />
                  <GamatoColorPicker label="Warna Teks Label" value={frameTextColor} onChange={setFrameTextColor} />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Bingkai disertakan pada unduhan PNG/JPEG/WEBP. Format SVG tetap diunduh tanpa bingkai.</p>
              </div>
            )}
          </CollapsibleSection>
        </div>

        {/* RIGHT: Preview */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Preview Real-time</p>
            <GamatoTooltip label="Muat ulang preview bila tidak muncul" side="top">
              <button type="button" onClick={refreshPreview} className="text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </GamatoTooltip>
          </div>
          <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center min-h-[380px] shadow-sm overflow-hidden">
            {/* This wrapper (banner + QR box) is hidden via CSS, never
                unmounted, when payload is empty — see the note below on
                containerRef for why unmounting would break the library. Its
                width is capped at 100% of the card so it shrinks gracefully
                on narrow screens instead of overflowing the card. */}
            <div
              className={cn("flex flex-col items-stretch max-w-full mx-auto", !payload.trim() && "absolute opacity-0 pointer-events-none")}
              style={{ width: boxSizePx }}
            >
              {frameEnabled && framePosition === "top" && (
                <div className="rounded-t-2xl px-5 py-2.5 text-center font-bold text-sm truncate" style={{ backgroundColor: frameBgColor, color: frameTextColor }}>
                  {frameText.trim() || "SCAN ME"}
                </div>
              )}
              {/* The QR container div is ALWAYS mounted (never conditionally
                  removed) — qr-code-styling's canvas is appended into it once
                  and only ever `.update()`d afterwards. If this div were
                  conditionally unmounted whenever the payload is briefly
                  empty and later remounted, the library would have no way to
                  re-attach its canvas to the new DOM node, leaving the
                  preview blank even though content exists. The canvas itself
                  renders at size*renderScale physical pixels but is
                  CSS-capped to max-width:100% here, so it displays at the
                  intended visual size while staying crisp on high-DPI
                  screens (see renderScale above). */}
              <div className={cn("bg-white p-5 shadow-2xl shadow-slate-200/80 dark:shadow-black/40 max-w-full", frameEnabled ? (framePosition === "top" ? "rounded-b-2xl" : "rounded-t-2xl") : "rounded-2xl")}>
                <div ref={containerRef} className="[&>canvas]:max-w-full [&>canvas]:h-auto [&>svg]:max-w-full [&>svg]:h-auto" />
              </div>
              {frameEnabled && framePosition === "bottom" && (
                <div className="rounded-b-2xl px-5 py-2.5 text-center font-bold text-sm truncate" style={{ backgroundColor: frameBgColor, color: frameTextColor }}>
                  {frameText.trim() || "SCAN ME"}
                </div>
              )}
            </div>
            {!payload.trim() && (
              <div className="w-56 h-56 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center px-6">Isi form di kiri untuk melihat preview QR</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Btn onClick={() => download("png")} disabled={!payload.trim()} className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-lg shadow-indigo-600/20">
              <Download className="w-4 h-4" />PNG
            </Btn>
            <Btn onClick={() => download("svg")} disabled={!payload.trim()} variant="secondary" className="py-3">
              <Download className="w-4 h-4" />SVG
            </Btn>
            <Btn onClick={() => download("jpeg")} disabled={!payload.trim()} variant="secondary" className="py-3 text-sm">
              JPEG
            </Btn>
            <Btn onClick={() => download("webp")} disabled={!payload.trim()} variant="secondary" className="py-3 text-sm">
              WEBP
            </Btn>
          </div>

          <Btn onClick={copyToClipboard} disabled={!payload.trim()} variant="secondary" className="w-full py-3">
            {copyState === "copied" ? <><Check className="w-4 h-4 text-emerald-500" />Tersalin!</> : <><ClipboardCopy className="w-4 h-4" />Salin ke Clipboard</>}
          </Btn>
          {copyError && copyState === "error" && <p className="text-xs text-center text-amber-600 dark:text-amber-400">{copyError}</p>}

          <div className="text-center"><SectionBadge>Diproses langsung di perangkatmu</SectionBadge></div>
        </div>
      </div>
    </div>
  );
}
