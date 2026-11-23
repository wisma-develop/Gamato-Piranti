import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  QrCode as QrCodeIcon, Upload, Download, Sparkles, AlertTriangle, RefreshCw, Palette,
  Frame as FrameIcon, Square, Circle as CircleIcon, ClipboardCopy, Check,
  Ruler, ImagePlus, Wand2, Layers, Archive, ScanLine, CheckCircle2, Loader2, X,
} from "lucide-react";
import QRCodeStyling from "qr-code-styling";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToDataUrl } from "@/lib/file";
import { renderQrBlob, verifyQrCanvas, qrUtf8Data, type QrExt, type QrVerifyResult } from "@/lib/qrRender";
import { sanitizeFileName } from "@/utils/sanitize";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { buildFramedLogoDataUrl, type QrLogoShape } from "@/lib/qrLogo";
import { AUTO_ICONS, resolveAutoIconId, buildAutoIconDataUrl, getAutoIcon } from "@/lib/qrAutoIcons";
import { QR_TEMPLATES, QR_TEMPLATE_CATEGORIES, getQrTemplate, normalizeWebUrl, type QrFieldDef, type QrFieldValues } from "@/lib/qrContentTemplates";
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
import { tr } from "@/i18n";

const DOT_STYLES: { id: DotType; label: string }[] = [
  { id: "square", label: tr("Kotak") },
  { id: "dots", label: tr("Bulat") },
  { id: "rounded", label: tr("Membulat") },
  { id: "classy", label: tr("Classy") },
  { id: "classy-rounded", label: tr("Classy+") },
  { id: "extra-rounded", label: tr("Ekstra Bulat") },
];

const CORNER_SQUARE_STYLES: { id: CornerSquareType; label: string }[] = [
  { id: "square", label: tr("Kotak") },
  { id: "dot", label: tr("Bulat") },
  { id: "extra-rounded", label: tr("Membulat") },
];

const CORNER_DOT_STYLES: { id: CornerDotType; label: string }[] = [
  { id: "square", label: tr("Kotak") },
  { id: "dot", label: tr("Bulat") },
];

const ERROR_CORRECTION_OPTIONS: { id: "auto" | "L" | "M" | "Q" | "H"; label: string }[] = [
  { id: "auto", label: tr("Otomatis") },
  { id: "L", label: tr("L · 7%") },
  { id: "M", label: tr("M · 15%") },
  { id: "Q", label: tr("Q · 25%") },
  { id: "H", label: tr("H · 30%") },
];

const LOGO_SHAPE_OPTIONS: { id: QrLogoShape; label: string }[] = [
  { id: "rounded", label: tr("Rounded") },
  { id: "circle", label: tr("Bulat") },
  { id: "square", label: tr("Kotak") },
  { id: "none", label: tr("Asli") },
];

const EXPORT_SIZES = [512, 1024, 2048, 4096] as const;
const BATCH_MAX = 500;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
type BatchEntry = { content: string; name: string };

type LogoMode = "auto" | "gallery" | "upload" | "none";

const LOGO_MODE_OPTIONS: { id: LogoMode; label: string; icon: typeof Wand2 }[] = [
  { id: "auto", label: tr("Otomatis"), icon: Wand2 },
  { id: "gallery", label: tr("Galeri Ikon"), icon: Sparkles },
  { id: "upload", label: tr("Upload Sendiri"), icon: ImagePlus },
  { id: "none", label: tr("Tanpa Logo"), icon: Square },
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
  /** Ukuran ekspor (px). 0 = otomatis (mengikuti resolusi preview). */
  exportPx: number;
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
  exportPx: 0,
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
    frameEnabled, frameText, frameTextColor, frameBgColor, framePosition, exportPx,
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
  const setExportPx = (v: number) => setQrField("exportPx", v);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [copyError, setCopyError] = useState<string | null>(null);

  // ── Mode massal (ZIP) ──
  const [qrMode, setQrMode] = useState<"single" | "batch">("single");
  const [batchKind, setBatchKind] = useState<"list" | "series">("list");
  const [batchText, setBatchText] = useState("");
  const [batchAsUrl, setBatchAsUrl] = useState(true);
  const [seriesTpl, setSeriesTpl] = useState("https://contoh.com/meja/{n}");
  const [seriesStart, setSeriesStart] = useState(1);
  const [seriesCount, setSeriesCount] = useState(10);
  const [seriesPad, setSeriesPad] = useState(0);
  const [batchExt, setBatchExt] = useState<QrExt>("png");
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);
  const [batchMsg, setBatchMsg] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);
  const cancelBatchRef = useRef(false);
  const [verify, setVerify] = useState<QrVerifyResult | "idle" | "checking">("idle");

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

  const validationMsg = activeTemplate.validate?.(activeData) ?? null;

  // Entri massal: daftar baris ("isi" atau "isi | nama-file") ATAU deret nomor ("…/meja/{n}").
  const batch = useMemo(() => {
    const raw: { content: string; name: string }[] = [];
    if (batchKind === "list") {
      for (const line of batchText.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const bar = line.lastIndexOf("|");
        const content = (bar >= 0 ? line.slice(0, bar) : line).replace(CONTROL_CHARS, " ").trim();
        const name = bar >= 0 ? line.slice(bar + 1).trim() : "";
        raw.push({ content, name });
      }
    } else if (seriesTpl.includes("{n}")) {
      const count = Math.max(0, Math.min(Math.floor(seriesCount) || 0, BATCH_MAX + 1));
      for (let i = 0; i < count; i++) {
        const n = String(Math.floor(seriesStart) + i).padStart(Math.max(0, Math.floor(seriesPad)), "0");
        raw.push({ content: seriesTpl.split("{n}").join(n), name: n });
      }
    }
    let skipped = 0;
    const entries: BatchEntry[] = [];
    const used = new Map<string, number>();
    const width = String(Math.min(raw.length, BATCH_MAX)).length;
    for (const r of raw) {
      const content = batchAsUrl ? normalizeWebUrl(r.content) : r.content;
      if (!content) { skipped++; continue; }
      if (entries.length >= BATCH_MAX) { skipped++; continue; }
      const base = sanitizeFileName(r.name || String(entries.length + 1).padStart(width, "0"), "qr").replace(/^\.+|\.+$/g, "") || "qr";
      const seen = used.get(base.toLowerCase()) ?? 0;
      used.set(base.toLowerCase(), seen + 1);
      entries.push({ content, name: seen ? `${base}-${seen + 1}` : base });
    }
    return { entries, skipped, templateMissing: batchKind === "series" && !seriesTpl.includes("{n}") };
  }, [batchKind, batchText, batchAsUrl, seriesTpl, seriesStart, seriesCount, seriesPad]);
  const isBatch = qrMode === "batch";
  const verifyStatus = typeof verify === "string" ? verify : verify.status;
  const effectivePayload = isBatch ? (batch.entries[0]?.content ?? "") : payload;

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

  // Opsi pustaka pada ukuran `px` & isi `data` tertentu — satu-satunya sumber opsi, dipakai preview, unduhan, dan ekspor massal.
  const buildOptions = (px: number, data: string) => {
    const ratio = px / size;
    const dotsOpt = toQrColorOptions(dots);
    const cornersSquareOpt = toQrColorOptions(cornersSquare);
    const cornersDotOpt = toQrColorOptions(cornersDot);
    const bgOpt = bgTransparent ? { color: "transparent", gradient: undefined } : toQrColorOptions(background);
    const effectiveErrorCorrection = errorCorrection === "auto" ? (logoDataUrl ? "H" : "Q") : errorCorrection;
    return {
      width: px,
      height: px,
      type: "canvas" as const,
      shape,
      data: data.trim() ? qrUtf8Data(data) : " ",
      margin: Math.round(margin * ratio),
      qrOptions: { errorCorrectionLevel: effectiveErrorCorrection as "L" | "M" | "Q" | "H" },
      dotsOptions: { type: dotsType, color: dotsOpt.color, gradient: dotsOpt.gradient },
      backgroundOptions: { color: bgOpt.color, gradient: bgOpt.gradient, round: bgTransparent ? 0 : bgRound },
      cornersSquareOptions: { type: cornersSquareType, color: cornersSquareOpt.color, gradient: cornersSquareOpt.gradient },
      cornersDotOptions: { type: cornersDotType, color: cornersDotOpt.color, gradient: cornersDotOpt.gradient },
      image: logoDataUrl || undefined,
      imageOptions: { hideBackgroundDots: logoHideBackgroundDots, imageSize: logoSizeRatio, margin: Math.round(logoMargin * ratio), crossOrigin: "anonymous" as const },
    };
  };
  const previewPx = Math.round(size * renderScale);
  const currentOptions = () => buildOptions(previewPx, effectivePayload);

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
  const skipFirstUpdateRef = useRef(true);
  useEffect(() => {
    // Efek pembuatan instance di atas sudah merender dengan opsi yang sama persis — jangan render kedua kali saat mount.
    if (skipFirstUpdateRef.current) { skipFirstUpdateRef.current = false; return; }
    qrInstanceRef.current?.update(currentOptions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectivePayload, size, margin, shape, errorCorrection,
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

  const frameOpts = frameEnabled ? { text: frameText, textColor: frameTextColor, bgColor: frameBgColor, position: framePosition } : null;
  const exportSize = exportPx > 0 ? exportPx : previewPx;
  const exportBlob = (ext: QrExt, data: string) =>
    renderQrBlob(buildOptions(exportSize, data), ext, ext === "svg" ? null : frameOpts, bgTransparent ? "#ffffff" : background.color);

  const download = async (extension: QrExt) => {
    try {
      downloadBlob(await exportBlob(extension, effectivePayload), `gamato-qr.${extension}`);
    } catch {
      // Jalur cadangan: ekspor bawaan pustaka dari instance preview.
      qrInstanceRef.current?.download({ name: "gamato-qr", extension });
    }
  };

  const copyToClipboard = async () => {
    setCopyError(null);
    try {
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("unsupported");
      const blob = await exportBlob("png", effectivePayload);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("error");
      setCopyError(tr("Salin gambar tidak didukung di browser ini. Gunakan tombol unduh sebagai gantinya."));
      setTimeout(() => setCopyState("idle"), 2500);
    }
  };

  const runBatch = async () => {
    const entries = batch.entries;
    if (!entries.length) return;
    cancelBatchRef.current = false;
    setBatchMsg(null);
    setBatchProgress({ done: 0, total: entries.length });
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const rows = ["no,file,isi"];
      const ext = batchExt === "jpeg" ? "jpg" : batchExt;
      for (let i = 0; i < entries.length; i++) {
        if (cancelBatchRef.current) { setBatchMsg({ tone: "warning", text: tr("Dibatalkan — tidak ada file yang diunduh.") }); return; }
        const e = entries[i];
        const file = `${e.name}.${ext}`;
        zip.file(file, await exportBlob(batchExt, e.content));
        rows.push(`${i + 1},${csvCell(file)},${csvCell(e.content)}`);
        setBatchProgress({ done: i + 1, total: entries.length });
        await new Promise((r) => setTimeout(r, 0));
      }
      zip.file("daftar.csv", "\ufeff" + rows.join("\r\n"));
      downloadBlob(await zip.generateAsync({ type: "blob" }), "gamato-qr-massal.zip");
      setBatchMsg({ tone: "success", text: tr("{0} QR berhasil dibuat dan dikemas dalam ZIP (beserta daftar.csv).", entries.length) });
    } catch (err) {
      setBatchMsg({ tone: "error", text: tr("Gagal membuat ZIP: {0}", err instanceof Error ? err.message : String(err)) });
    } finally {
      setBatchProgress(null);
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

  // Verifikasi nyata: hasil render di-decode ulang (jsQR) & dibandingkan dengan isi yang dimaksud.
  // Render canvas pustaka asinkron (terutama saat ada logo), jadi dicoba lagi bila percobaan pertama belum terbaca.
  useEffect(() => {
    if (!effectivePayload.trim()) { setVerify("idle"); return; }
    setVerify("checking");
    let cancelled = false;
    const timers: number[] = [];
    const attempt = async (n: number) => {
      const canvas = getPreviewCanvas();
      const r: QrVerifyResult = canvas
        ? await verifyQrCanvas(canvas, effectivePayload).catch((): QrVerifyResult => ({ status: "unreadable" }))
        : { status: "unreadable" };
      if (cancelled) return;
      if (r.status !== "ok" && n < 2) { timers.push(window.setTimeout(() => void attempt(n + 1), 700)); return; }
      setVerify(r);
    };
    // Tunggu render selesai, lalu jalankan saat browser idle supaya verifikasi tidak bersaing dengan render/interaksi.
    let idleId: number | undefined;
    const run = () => { idleId = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(() => void attempt(0), { timeout: 1500 }) : window.setTimeout(() => void attempt(0), 0); };
    timers.push(window.setTimeout(run, 650));
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectivePayload, size, margin, shape, errorCorrection,
    dotsType, cornersSquareType, cornersDotType, dots, cornersSquare, cornersDot, background, bgTransparent, bgRound,
    logoDataUrl, logoSizeRatio, logoMargin, logoHideBackgroundDots,
  ]);

  const activeAutoIcon = autoIconId ? getAutoIcon(autoIconId) : undefined;
  const activeGalleryIcon = logoGalleryId ? getAutoIcon(logoGalleryId) : undefined;
  const boxSizePx = size + 40; // matches the p-5 (20px) padding around the QR canvas in the preview card — this is the VISUAL/display size; the canvas itself renders internally at size*renderScale for sharpness, then CSS scales it back down to this box.

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        {/* LEFT: Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Editor QR Code")}</p>
            <UndoRedoBar canUndo={qrHistory.canUndo} canRedo={qrHistory.canRedo} onUndo={qrHistory.undo} onRedo={qrHistory.redo} />
          </div>

          <div role="tablist" aria-label={tr("Mode pembuatan")} className="grid grid-cols-2 gap-2">
            {([["single", tr("Tunggal"), tr("Satu QR, kustom penuh"), QrCodeIcon], ["batch", tr("Massal (ZIP)"), tr("Banyak QR sekaligus"), Layers]] as const).map(([id, label, sub, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={qrMode === id} data-testid={`qr-mode-${id}`} onClick={() => setQrMode(id)}
                className={cn("flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all", qrMode === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300")}>
                <Icon className={cn("w-5 h-5 shrink-0", qrMode === id ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400")} />
                <span className="min-w-0">
                  <span className={cn("block text-sm font-bold", qrMode === id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-800 dark:text-slate-100")}>{label}</span>
                  <span className="block text-[11px] text-slate-600 dark:text-slate-300 truncate">{sub}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Isi QR — template selector, grouped by category, + the active template's form */}
          {isBatch && (
            <CollapsibleSection title={tr("Isi QR Massal")} subtitle={tr("Daftar baris atau deret nomor → satu ZIP")} icon={<Layers className="w-4 h-4" />} badge={tr("maks. {0}", BATCH_MAX)} defaultOpen>
              <div className="flex flex-wrap gap-1.5">
                {([["list", tr("Daftar baris")], ["series", tr("Deret nomor")]] as const).map(([id, label]) => (
                  <button key={id} type="button" data-testid={`batch-kind-${id}`} onClick={() => setBatchKind(id)} className={pillClass(batchKind === id)}>{label}</button>
                ))}
              </div>

              {batchKind === "list" ? (
                <Textarea id="qr-batch-text" label={tr("Satu QR per baris — opsional nama file setelah tanda |")} rows={8} value={batchText} onChange={(e) => setBatchText(e.target.value)}
                  placeholder={"https://contoh.com/menu | menu-utama\nhttps://contoh.com/promo | promo\ncontoh.com/kontak"} />
              ) : (
                <div className="space-y-3">
                  <Input id="qr-series-tpl" label={tr("Pola isi — tulis {n} di tempat nomor")} value={seriesTpl} onChange={(e) => setSeriesTpl(e.target.value)} placeholder="https://contoh.com/meja/{n}" />
                  <div className="grid grid-cols-3 gap-3">
                    <Input id="qr-series-start" label={tr("Mulai dari")} type="number" value={seriesStart} onChange={(e) => setSeriesStart(Number(e.target.value) || 0)} />
                    <Input id="qr-series-count" label={tr("Jumlah")} type="number" min={1} max={BATCH_MAX} value={seriesCount} onChange={(e) => setSeriesCount(Math.min(BATCH_MAX, Math.max(0, Number(e.target.value) || 0)))} />
                    <Input id="qr-series-pad" label={tr("Digit (isi 0)")} type="number" min={0} max={8} value={seriesPad} onChange={(e) => setSeriesPad(Math.min(8, Math.max(0, Number(e.target.value) || 0)))} />
                  </div>
                  {batch.templateMissing && <GamatoInlineAlert tone="warning" message={tr("Pola harus memuat {n}, kalau tidak semua QR akan sama persis.")} />}
                </div>
              )}

              <GamatoCheckbox checked={batchAsUrl} onChange={setBatchAsUrl} label={tr("Perlakukan sebagai URL (tambah https:// otomatis, tolak yang tidak valid)")} testId="batch-as-url" />
              <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="batch-count">
                {tr("{0} QR siap dibuat", batch.entries.length)}{batch.skipped > 0 ? ` · ${tr("{0} baris dilewati (kosong/tidak valid/melebihi batas)", batch.skipped)}` : ""}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{tr("Gaya, warna, logo, bingkai, dan ukuran di bawah berlaku untuk semua QR. Preview menampilkan baris pertama.")}</p>
            </CollapsibleSection>
          )}

          {!isBatch && <CollapsibleSection title={tr("Isi QR")} subtitle={tr("Pilih jenis konten lalu isi datanya")} badge={tr("{0} Tipe", QR_TEMPLATES.length)} defaultOpen>
            <div className="space-y-4">
              {QR_TEMPLATE_CATEGORIES.map((cat) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">{cat}</p>
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
              {validationMsg && <GamatoInlineAlert tone="warning" message={validationMsg} />}
              {activeTemplate.note && <p className="text-xs text-slate-400 dark:text-slate-500">{activeTemplate.note}</p>}
            </div>
          </CollapsibleSection>}

          {/* Style presets */}
          <CollapsibleSection title={tr("Gaya Instan")} subtitle={tr("Sentuh sekali, langsung jadi")} icon={<Sparkles className="w-4 h-4" />} badge={tr("{0} Preset", QR_STYLE_PRESETS.length)} defaultOpen>
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
          <CollapsibleSection title={tr("Warna & Bentuk")} subtitle={tr("Titik, sudut, latar, dan bentuk QR")} icon={<Palette className="w-4 h-4" />}>
            <div>
              <Label>{tr("Bentuk Titik (Dots)")}</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {DOT_STYLES.map((s) => (
                  <button key={s.id} type="button" onClick={() => setDotsType(s.id)} className={pillClass(dotsType === s.id)}>{s.label}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{tr("Bentuk Sudut Luar")}</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {CORNER_SQUARE_STYLES.map((s) => (
                    <button key={s.id} type="button" onClick={() => setCornersSquareType(s.id)} className={pillClass(cornersSquareType === s.id)}>{s.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>{tr("Bentuk Sudut Dalam")}</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {CORNER_DOT_STYLES.map((s) => (
                    <button key={s.id} type="button" onClick={() => setCornersDotType(s.id)} className={pillClass(cornersDotType === s.id)}>{s.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <Label>{tr("Bentuk Keseluruhan")}</Label>
              <div className="flex gap-1.5 mt-1.5">
                <button type="button" onClick={() => setShape("square")} className={cn(pillClass(shape === "square"), "flex items-center gap-1.5")}>
                  <Square className="w-3.5 h-3.5" />{tr("Persegi")}
                </button>
                <button type="button" onClick={() => setShape("circle")} className={cn(pillClass(shape === "circle"), "flex items-center gap-1.5")}>
                  <CircleIcon className="w-3.5 h-3.5" />{tr("Lingkaran")}
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-5 pt-1 border-t border-slate-100 dark:border-slate-800">
              <ColorModeControl label={tr("Warna Titik")} value={dots} onChange={setDots} className="pt-4" testId="dots" />
              <ColorModeControl label={tr("Warna Sudut Luar")} value={cornersSquare} onChange={setCornersSquare} className="pt-4" testId="cornersSquare" />
              <ColorModeControl label={tr("Warna Sudut Dalam")} value={cornersDot} onChange={setCornersDot} className="pt-4" testId="cornersDot" />
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{tr("Warna Latar")}</Label>
                  <GamatoCheckbox checked={bgTransparent} onChange={setBgTransparent} label={<span className="text-[11px]">{tr("Transparan")}</span>} testId="bgTransparent-checkbox" />
                </div>
                {bgTransparent ? (
                  <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-2.5 text-[11px] text-slate-400 dark:text-slate-500" style={{ backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%)", backgroundSize: "10px 10px" }}>
                    {tr("Latar dibiarkan transparan (cocok untuk ditempel di atas desain lain).")}
                  </div>
                ) : (
                  <ColorModeControl label="" value={background} onChange={setBackground} testId="background" />
                )}
              </div>
            </div>

            {!bgTransparent && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>{tr("Kelengkungan Latar")}</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(bgRound * 100)}%</span>
                </div>
                <GamatoSlider min={0} max={1} step={0.05} value={bgRound} onChange={setBgRound} aria-label={tr("Kelengkungan latar belakang")} />
              </div>
            )}

            {lowContrast && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{tr("Kontras warna titik & latar cukup rendah — bisa mempersulit pemindaian. Coba warna yang lebih kontras untuk hasil paling aman.")}</span>
              </div>
            )}
          </CollapsibleSection>

          {/* Ukuran & Kualitas */}
          <CollapsibleSection title={tr("Ukuran & Kualitas")} subtitle={tr("Dimensi, margin, dan ketahanan pindai")} icon={<Ruler className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>{tr("Ukuran")}</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{tr("{0}px", size)}</span>
                </div>
                <GamatoSlider min={200} max={600} step={10} value={size} onChange={setSize} aria-label={tr("Ukuran QR")} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>{tr("Margin")}</Label>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{tr("{0}px", margin)}</span>
                </div>
                <GamatoSlider min={0} max={40} step={2} value={margin} onChange={setMargin} aria-label={tr("Margin QR")} />
              </div>
            </div>
            <Select id="qr-export-size" label={tr("Ukuran File Ekspor")} value={String(exportPx)} onChange={(e) => setExportPx(Number(e.target.value) || 0)}>
              <option value="0">{tr("Otomatis ({0}px, tajam di layar & cetak biasa)", previewPx)}</option>
              {EXPORT_SIZES.map((px) => <option key={px} value={px}>{tr("{0}×{0}px", px)}{px >= 2048 ? ` — ${tr("untuk cetak besar")}` : ""}</option>)}
            </Select>
            <p className="text-xs text-slate-400 dark:text-slate-500">{exportPx > 0 ? tr("File PNG/JPEG/WEBP diekspor tepat {0}×{0}px (SVG selalu vektor, bebas ukuran).", exportPx) : tr("File diekspor pada resolusi {0}× lebih tinggi dari angka di atas supaya hasilnya tetap tajam saat dicetak atau di-zoom.", renderScale)}</p>

            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Label>{tr("Tingkat Koreksi Error")}</Label>
                <GamatoTooltip label={tr("Level lebih tinggi = QR lebih tahan kotor/rusak, tapi kepadatan modul bertambah. Otomatis memakai H saat logo aktif.")}>
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
          <CollapsibleSection title={tr("Logo Tengah")} subtitle={tr("Otomatis menyesuaikan tipe QR, atau pilih sendiri")} icon={<ImagePlus className="w-4 h-4" />} defaultOpen>
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
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{tr("Ikon otomatis: {0}", activeAutoIcon.label)}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{tr("Menyesuaikan otomatis saat kamu ganti tipe QR di atas.")}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500">{tr("Tipe QR ini belum punya ikon otomatis — pilih dari Galeri atau Upload sendiri.")}</p>
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
                <p className="text-xs text-slate-400 dark:text-slate-500">{activeGalleryIcon ? tr("Dipilih: {0}", activeGalleryIcon.label) : tr("Pilih salah satu ikon di atas.")}</p>
              </div>
            )}

            {logoMode === "upload" && (
              <div className="relative">
                <label className="flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all group">
                  {logoFile && logoDataUrl ? (
                    <div className="flex items-center gap-4 w-full pr-14">
                      <img src={logoDataUrl} alt={tr("Logo")} className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm" />
                      <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 font-medium">{tr("Logo terpasang — klik untuk ganti")}</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="flex justify-center mb-2 text-slate-400 dark:text-slate-500"><Upload className="w-7 h-7" /></div>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{tr("Upload Logo")} <span className="text-indigo-600 dark:text-indigo-400">{tr("PNG/JPG")}</span></p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{tr("Akan tampil di tengah QR code")}</p>
                    </div>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
                </label>
                {logoFile && (
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLogoFile(null); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-red-500 font-semibold hover:text-red-700">
                    {tr("Hapus")}
                  </button>
                )}
              </div>
            )}

            {logoMode !== "none" && logoDataUrl && (
              <div className="space-y-4 pt-1 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <Label>{tr("Bentuk Bingkai Logo")}</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {LOGO_SHAPE_OPTIONS.map((o) => (
                      <button key={o.id} type="button" data-testid={`logo-shape-${o.id}`} onClick={() => setLogoShape(o.id)} className={pillClass(logoShape === o.id)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {logoShape === "none" && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">{tr("Mode \"Asli\" memakai gambar apa adanya tanpa bantalan bersih di sekitarnya — di ukuran besar & logo yang ramai, ini bisa menurunkan keterbacaan. Kecilkan ukuran logo atau pakai bentuk lain bila QR sulit dipindai.")}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{tr("Ukuran Logo")}</span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{Math.round(logoSizeRatio * 100)}%</span>
                    </div>
                    <GamatoSlider min={0.15} max={0.45} step={0.01} value={logoSizeRatio} onChange={setLogoSizeRatio} aria-label={tr("Ukuran logo")} />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{tr("Margin Logo")}</span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{tr("{0}px", logoMargin)}</span>
                    </div>
                    <GamatoSlider min={0} max={20} step={1} value={logoMargin} onChange={setLogoMargin} aria-label={tr("Margin logo")} />
                  </div>
                </div>
                <GamatoCheckbox checked={logoHideBackgroundDots} onChange={setLogoHideBackgroundDots} label={tr("Sembunyikan titik QR di belakang logo")} />
              </div>
            )}
          </CollapsibleSection>

          {/* Frame / label */}
          <CollapsibleSection title={tr("Bingkai & Label Teks")} subtitle={tr("Tambahkan banner \"SCAN ME\" di atas/bawah")} icon={<FrameIcon className="w-4 h-4" />}>
            <div className="flex items-center justify-between -mt-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{tr("Aktifkan bingkai")}</span>
              <GamatoCheckbox checked={frameEnabled} onChange={setFrameEnabled} testId="frame-enabled-checkbox" />
            </div>
            {frameEnabled && (
              <div className="space-y-4">
                <Input id="qr-frame-text" label={tr("Teks Label")} value={frameText} onChange={(e) => setFrameText(e.target.value)} placeholder={tr("SCAN ME")} maxLength={40} />
                <div>
                  <Label>{tr("Posisi")}</Label>
                  <div className="flex gap-1.5 mt-1.5">
                    {(["top", "bottom"] as const).map((pos) => (
                      <button key={pos} type="button" onClick={() => setFramePosition(pos)} className={pillClass(framePosition === pos)}>
                        {pos === "top" ? tr("Atas") : tr("Bawah")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <GamatoColorPicker label={tr("Warna Latar Label")} value={frameBgColor} onChange={setFrameBgColor} />
                  <GamatoColorPicker label={tr("Warna Teks Label")} value={frameTextColor} onChange={setFrameTextColor} />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">{tr("Bingkai disertakan pada unduhan PNG/JPEG/WEBP. Format SVG tetap diunduh tanpa bingkai.")}</p>
              </div>
            )}
          </CollapsibleSection>
        </div>

        {/* RIGHT: Preview */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="flex items-center justify-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Preview Real-time")}</p>
            <GamatoTooltip label={tr("Muat ulang preview bila tidak muncul")} side="top">
              <button type="button" onClick={refreshPreview} aria-label={tr("Segarkan pratinjau")} title={tr("Segarkan pratinjau")} className="p-1.5 -m-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors">
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
              className={cn("flex flex-col items-stretch max-w-full mx-auto", !effectivePayload.trim() && "absolute opacity-0 pointer-events-none")}
              style={{ width: boxSizePx }}
            >
              {frameEnabled && framePosition === "top" && (
                <div className="rounded-t-2xl px-5 py-2.5 text-center font-bold text-sm truncate" style={{ backgroundColor: frameBgColor, color: frameTextColor }}>
                  {frameText.trim() || tr("SCAN ME")}
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
                  {frameText.trim() || tr("SCAN ME")}
                </div>
              )}
            </div>
            {!effectivePayload.trim() && (
              <div className="w-56 min-h-56 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center" data-testid="qr-empty-hint">
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center px-6">
                  {isBatch ? tr("Isi daftar atau pola di kiri untuk melihat preview QR") : validationMsg ?? tr("Isi form di kiri untuk melihat preview QR")}
                </p>
              </div>
            )}
          </div>

          {/* Badge verifikasi: QR hasil render benar-benar di-decode ulang */}
          {effectivePayload.trim() && (
            <div data-testid="qr-verify" data-status={verifyStatus} role="status" aria-live="polite"
              className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium",
                verifyStatus === "ok" ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30"
                : verifyStatus !== "idle" && verifyStatus !== "checking" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
                : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700")}>
              {typeof verify === "string" ? <><Loader2 className="w-4 h-4 shrink-0 animate-spin" /><span>{tr("Memeriksa keterbacaan QR…")}</span></>
              : verify.status === "ok" ? <><CheckCircle2 className="w-4 h-4 shrink-0" /><span>{tr("Terverifikasi: QR ini berhasil dibaca ulang dan isinya cocok.")}</span></>
              : verify.status === "mismatch" ? <><AlertTriangle className="w-4 h-4 shrink-0" /><span>{tr("QR terbaca tapi isinya berbeda dari yang dimaksud — coba naikkan koreksi error atau kecilkan logo.")}</span></>
              : <><ScanLine className="w-4 h-4 shrink-0" /><span>{tr("QR belum bisa dibaca pemindai uji — periksa kontras warna, ukuran logo, atau naikkan tingkat koreksi error.")}</span></>}
            </div>
          )}

          {!isBatch ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Btn onClick={() => download("png")} disabled={!effectivePayload.trim()} className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-lg shadow-indigo-600/20">
                  <Download className="w-4 h-4" />{tr("PNG")}
                </Btn>
                <Btn onClick={() => download("svg")} disabled={!effectivePayload.trim()} variant="secondary" className="py-3">
                  <Download className="w-4 h-4" />{tr("SVG")}
                </Btn>
                <Btn onClick={() => download("jpeg")} disabled={!effectivePayload.trim()} variant="secondary" className="py-3 text-sm">
                  {tr("JPEG")}
                </Btn>
                <Btn onClick={() => download("webp")} disabled={!effectivePayload.trim()} variant="secondary" className="py-3 text-sm">
                  {tr("WEBP")}
                </Btn>
              </div>

              <Btn onClick={copyToClipboard} disabled={!effectivePayload.trim()} variant="secondary" className="w-full py-3">
                {copyState === "copied" ? <><Check className="w-4 h-4 text-emerald-500" />{tr("Tersalin!")}</> : <><ClipboardCopy className="w-4 h-4" />{tr("Salin ke Clipboard")}</>}
              </Btn>
              {copyError && copyState === "error" && <p className="text-xs text-center text-amber-600 dark:text-amber-400">{copyError}</p>}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label={tr("Format file di dalam ZIP")}>
                {(["png", "svg", "jpeg", "webp"] as const).map((e) => (
                  <button key={e} type="button" data-testid={`batch-ext-${e}`} onClick={() => setBatchExt(e)} className={pillClass(batchExt === e)}>{e.toUpperCase()}</button>
                ))}
              </div>
              <Btn onClick={runBatch} disabled={!batch.entries.length || !!batchProgress} data-testid="batch-run" className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-lg shadow-indigo-600/20">
                {batchProgress ? <><Loader2 className="w-4 h-4 animate-spin" />{tr("Memproses {0}/{1}…", batchProgress.done, batchProgress.total)}</> : <><Archive className="w-4 h-4" />{tr("Unduh ZIP ({0} QR)", batch.entries.length)}</>}
              </Btn>
              {batchProgress && (
                <Btn variant="secondary" onClick={() => { cancelBatchRef.current = true; }} className="w-full"><X className="w-4 h-4" />{tr("Batalkan")}</Btn>
              )}
              {exportSize >= 2048 && batch.entries.length > 100 && <p className="text-xs text-center text-amber-600 dark:text-amber-400">{tr("Ukuran besar × banyak QR membutuhkan memori dan waktu lebih — pertimbangkan 1024px.")}</p>}
              {batchMsg && <GamatoInlineAlert tone={batchMsg.tone} message={batchMsg.text} />}
            </div>
          )}

          <div className="text-center"><SectionBadge>{tr("Diproses langsung di perangkatmu")}</SectionBadge></div>
        </div>
      </div>
    </div>
  );
}
