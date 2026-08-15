import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Award, Upload, Plus, Trash2, Download, Loader2, Move, Type,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Users, Image as ImageIcon,
  FileSpreadsheet, FileDown, PenLine, X, Info,
} from "lucide-react";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { cn } from "@/utils/cn";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob, fileToDataUrl } from "@/lib/file";
import { csvToRecipients, certificateCsvTemplate, type CsvRecipient } from "@/lib/csv";
import { loadCustomFont, type CustomFontEntry } from "@/lib/customFont";
import { Label, Input, Select, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";

// ─── Types ──────────────────────────────────────────────────────────────────

type TextLayer = {
  id: string;
  name: string;
  text: string; // may contain {nama}, {nomor}, {tanggal}
  xPct: number;
  yPct: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
};

const FONT_OPTIONS = [
  { id: "Alan Sans", label: "Alan Sans (Modern)" },
  { id: "Playfair Display", label: "Playfair Display (Elegan)" },
  { id: "Great Vibes", label: "Great Vibes (Kaligrafi)" },
  { id: "Georgia", label: "Georgia (Serif Klasik)" },
];

const DEFAULT_CANVAS_W = 1600;
const DEFAULT_CANVAS_H = 1131; // ~A4 landscape ratio, used only when there's no uploaded template
const MAX_TEMPLATE_DIMENSION = 1800; // cap resolution for performance/memory when a template is uploaded

/** Canvas resolution follows the uploaded template's own aspect ratio (capped), so a
 *  square or 16:9 template is never stretched to fit a fixed A4-ish shape. */
function resolveCanvasSize(templateImg: HTMLImageElement | null): { w: number; h: number } {
  if (!templateImg || !templateImg.naturalWidth || !templateImg.naturalHeight) {
    return { w: DEFAULT_CANVAS_W, h: DEFAULT_CANVAS_H };
  }
  const { naturalWidth, naturalHeight } = templateImg;
  const scale = Math.min(1, MAX_TEMPLATE_DIMENSION / Math.max(naturalWidth, naturalHeight));
  return { w: Math.round(naturalWidth * scale), h: Math.round(naturalHeight * scale) };
}

let layerCounter = 0;
const newLayerId = () => `layer-${Date.now()}-${layerCounter++}`;

function defaultLayers(): TextLayer[] {
  return [
    { id: newLayerId(), name: "Judul", text: "SERTIFIKAT PENGHARGAAN", xPct: 50, yPct: 21, fontSize: 46, fontFamily: "Playfair Display", color: "#1e293b", bold: true, italic: false, align: "center" },
    { id: newLayerId(), name: "Pengantar", text: "Dengan bangga diberikan kepada", xPct: 50, yPct: 36, fontSize: 20, fontFamily: "Alan Sans", color: "#64748b", bold: false, italic: false, align: "center" },
    { id: newLayerId(), name: "Nama Penerima", text: "{nama}", xPct: 50, yPct: 52, fontSize: 68, fontFamily: "Great Vibes", color: "#4f46e5", bold: false, italic: false, align: "center" },
    { id: newLayerId(), name: "Keterangan", text: "Atas partisipasi dan dedikasinya dalam kegiatan ini", xPct: 50, yPct: 67, fontSize: 18, fontFamily: "Alan Sans", color: "#475569", bold: false, italic: false, align: "center" },
    { id: newLayerId(), name: "Footer", text: "Diberikan pada {tanggal} · No. {nomor}", xPct: 50, yPct: 87, fontSize: 14, fontFamily: "Alan Sans", color: "#94a3b8", bold: false, italic: false, align: "center" },
  ];
}

function applyPlaceholders(text: string, fields: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(fields)) {
    if (!key) continue;
    result = result.split(`{${key}}`).join(value);
  }
  return result;
}

function todayLong() {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
}

/** Elegant procedural fallback design, used whenever no template image is uploaded. */
function drawDefaultTemplate(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#fdfbf5");
  grad.addColorStop(1, "#f6f1e6");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const margin = w * 0.035;
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = w * 0.006;
  ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);

  const inner = margin + w * 0.016;
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = w * 0.0022;
  ctx.strokeRect(inner, inner, w - inner * 2, h - inner * 2);

  const bracketLen = w * 0.055;
  const bOffset = margin * 0.55;
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = w * 0.004;
  const corners: [number, number, number, number][] = [
    [bOffset, bOffset, 1, 1],
    [w - bOffset, bOffset, -1, 1],
    [bOffset, h - bOffset, 1, -1],
    [w - bOffset, h - bOffset, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * bracketLen, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * bracketLen);
    ctx.stroke();
  }
}

async function ensureFontsReady(layers: TextLayer[]) {
  try {
    const families = Array.from(new Set(layers.map(l => l.fontFamily)));
    await Promise.all(families.map(f => document.fonts.load(`700 64px "${f}"`)));
    await document.fonts.ready;
  } catch {
    // If the Font Loading API isn't available, canvas will just fall back gracefully.
  }
}

function renderToCanvas(
  canvas: HTMLCanvasElement,
  templateImg: HTMLImageElement | null,
  layers: TextLayer[],
  fields: Record<string, string>
) {
  const { w, h } = resolveCanvasSize(templateImg);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  if (templateImg) ctx.drawImage(templateImg, 0, 0, w, h);
  else drawDefaultTemplate(ctx, w, h);

  for (const layer of layers) {
    const text = applyPlaceholders(layer.text, fields);
    if (!text.trim()) continue;
    const weight = layer.bold ? "700" : "400";
    const style = layer.italic ? "italic" : "normal";
    ctx.font = `${style} ${weight} ${layer.fontSize}px "${layer.fontFamily}"`;
    ctx.fillStyle = layer.color;
    ctx.textAlign = layer.align;
    ctx.textBaseline = "middle";
    ctx.fillText(text, (layer.xPct / 100) * w, (layer.yPct / 100) * h);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Gagal membuat gambar"))), "image/png");
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CertificateGenerator() {
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateImg, setTemplateImg] = useState<HTMLImageElement | null>(null);
  const [layers, setLayers] = useState<TextLayer[]>(defaultLayers);
  const [selectedLayerId, setSelectedLayerId] = useState<string>(() => layers[2]?.id ?? layers[0].id);
  const [recipientMode, setRecipientMode] = useState<"manual" | "csv">("manual");
  const [recipientsText, setRecipientsText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRecipients, setCsvRecipients] = useState<CsvRecipient[]>([]);
  const [csvExtraColumns, setCsvExtraColumns] = useState<string[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [fileNameMode, setFileNameMode] = useState<"recipient" | "system">("recipient");
  const [customFonts, setCustomFonts] = useState<CustomFontEntry[]>([]);
  const [isFontLoading, setIsFontLoading] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);

  // Manual (one name per line) and CSV modes both resolve into the same
  // shape: a list of { nama, fields } records. In manual mode each line
  // only carries `{nama}`; in CSV mode every extra column becomes an
  // additional placeholder available in text layers.
  const recipients: CsvRecipient[] = useMemo(() => {
    if (recipientMode === "csv") return csvRecipients;
    return recipientsText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(nama => ({ nama, fields: { nama } }));
  }, [recipientMode, recipientsText, csvRecipients]);

  // Read + parse the uploaded CSV whenever it changes.
  useEffect(() => {
    if (!csvFile) { setCsvRecipients([]); setCsvExtraColumns([]); setCsvError(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const text = await csvFile.text();
        if (cancelled) return;
        const result = csvToRecipients(text);
        setCsvRecipients(result.recipients);
        setCsvExtraColumns(result.extraColumns);
        setCsvError(result.error);
      } catch {
        if (!cancelled) {
          setCsvRecipients([]);
          setCsvExtraColumns([]);
          setCsvError("Gagal membaca file CSV. Pastikan file tidak rusak.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [csvFile]);

  const fontOptions = useMemo(
    () => [...FONT_OPTIONS, ...customFonts.map(f => ({ id: f.family, label: `${f.fileName} (Custom)` }))],
    [customFonts]
  );

  const handleFontUpload = async (file: File | null) => {
    if (!file) return;
    setFontError(null);
    setIsFontLoading(true);
    try {
      const entry = await loadCustomFont(file);
      setCustomFonts(prev => [...prev, entry]);
    } catch (err: any) {
      setFontError(err?.message || "Gagal memuat font kustom.");
    } finally {
      setIsFontLoading(false);
    }
  };

  const removeCustomFont = (id: string) => {
    setCustomFonts(prev => prev.filter(f => f.id !== id));
    // Any layer using this font falls back to a safe default instead of
    // silently rendering blank/invisible text once the font is gone.
    setLayers(prev => prev.map(l => (l.fontFamily === id ? { ...l, fontFamily: "Alan Sans" } : l)));
  };

  const downloadCsvTemplate = () => {
    const csv = certificateCsvTemplate();
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, "template-daftar-penerima.csv");
  };

  const previewRecipient = recipients[0];
  const previewFields: Record<string, string> = useMemo(() => {
    const base: Record<string, string> = previewRecipient ? { ...previewRecipient.fields } : {};
    if (!base.nama || !base.nama.trim()) base.nama = previewRecipient?.nama || "Nama Contoh";
    if (!base.nomor || !base.nomor.trim()) base.nomor = "1";
    if (!base.tanggal || !base.tanggal.trim()) base.tanggal = todayLong();
    return base;
  }, [previewRecipient]);
  const previewName = previewFields.nama;
  const selectedLayer = layers.find(l => l.id === selectedLayerId) ?? layers[0];

  // Load the uploaded template as an <img> element usable by canvas.
  useEffect(() => {
    if (!templateFile) { setTemplateImg(null); return; }
    let cancelled = false;
    (async () => {
      const dataUrl = await fileToDataUrl(templateFile);
      const img = new Image();
      img.onload = () => { if (!cancelled) setTemplateImg(img); };
      img.src = dataUrl;
    })();
    return () => { cancelled = true; };
  }, [templateFile]);

  // Live preview re-render whenever anything relevant changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureFontsReady(layers);
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderToCanvas(canvas, templateImg, layers, previewFields);
    })();
    return () => { cancelled = true; };
  }, [layers, templateImg, previewFields]);

  const updateLayer = (id: string, patch: Partial<TextLayer>) => {
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLayer = () => {
    const id = newLayerId();
    setLayers(prev => [...prev, { id, name: `Teks ${prev.length + 1}`, text: "Teks baru", xPct: 50, yPct: 50, fontSize: 24, fontFamily: "Alan Sans", color: "#1e293b", bold: false, italic: false, align: "center" }]);
    setSelectedLayerId(id);
  };

  const removeLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(layers[0]?.id ?? "");
  };

  // ── Drag-to-position on the live preview ──
  const onPointerDownLayer = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    setSelectedLayerId(id);
    setDragLayerId(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMovePreview = (e: React.PointerEvent) => {
    if (!dragLayerId || !previewWrapRef.current) return;
    const rect = previewWrapRef.current.getBoundingClientRect();
    const xPct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    updateLayer(dragLayerId, { xPct: Math.round(xPct * 10) / 10, yPct: Math.round(yPct * 10) / 10 });
  };
  const onPointerUpPreview = () => setDragLayerId(null);

  // ── Export ──
  const buildBlobsForAllRecipients = async (): Promise<{ name: string; blob: Blob }[]> => {
    await ensureFontsReady(layers);
    const list = recipients.length ? recipients : [{ nama: previewName, fields: { nama: previewName } }];
    const offscreen = document.createElement("canvas");
    const results: { name: string; blob: Blob }[] = [];
    for (let i = 0; i < list.length; i++) {
      const rec = list[i];
      const fields: Record<string, string> = { ...rec.fields, nama: rec.nama };
      if (!fields.nomor || !fields.nomor.trim()) fields.nomor = String(i + 1);
      if (!fields.tanggal || !fields.tanggal.trim()) fields.tanggal = todayLong();
      renderToCanvas(offscreen, templateImg, layers, fields);
      const blob = await canvasToBlob(offscreen);
      const systemName = `sertifikat-${String(i + 1).padStart(3, "0")}`;
      const baseName = fileNameMode === "recipient" ? (sanitizeFileName(rec.nama) || systemName) : systemName;
      results.push({ name: baseName, blob });
      setProgress({ done: i + 1, total: list.length });
      // Yield to the browser so the UI (progress text) can actually repaint between iterations.
      await new Promise(r => setTimeout(r, 0));
    }
    return results;
  };

  const downloadSingle = async () => {
    setInfo(null);
    setIsGenerating(true);
    try {
      await ensureFontsReady(layers);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, `${sanitizeFileName(previewName) || "sertifikat"}.png`);
      setInfo("Contoh sertifikat berhasil diunduh.");
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuat sertifikat.");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadZip = async () => {
    if (!recipients.length) { setInfo("Isi daftar nama penerima terlebih dahulu untuk unduhan massal."); return; }
    setInfo(null);
    setIsGenerating(true);
    setProgress({ done: 0, total: recipients.length });
    try {
      const items = await buildBlobsForAllRecipients();
      const zip = new JSZip();
      const used = new Set<string>();
      for (const { name, blob } of items) {
        let filename = `${name}.png`;
        let n = 2;
        while (used.has(filename)) filename = `${name}-${n++}.png`;
        used.add(filename);
        zip.file(filename, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, "sertifikat-gamato-piranti.zip");
      setInfo(`${items.length} sertifikat berhasil dibuat dan diunduh sebagai ZIP.`);
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuat sertifikat massal.");
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const downloadPdf = async () => {
    if (!recipients.length) { setInfo("Isi daftar nama penerima terlebih dahulu untuk unduhan massal."); return; }
    setInfo(null);
    setIsGenerating(true);
    setProgress({ done: 0, total: recipients.length });
    try {
      const items = await buildBlobsForAllRecipients();
      const pdfDoc = await PDFDocument.create();
      for (const { blob } of items) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const img = await pdfDoc.embedPng(bytes);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), "sertifikat-gamato-piranti.pdf");
      setInfo(`${items.length} sertifikat berhasil digabung menjadi satu PDF.`);
    } catch (err: any) {
      setInfo(err?.message || "Gagal membuat PDF gabungan.");
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* LEFT: controls */}
        <div className="space-y-5">
          <PanelCard title="Template Latar" subtitle="Unggah desain sendiri, atau pakai template bawaan">
            <div className="space-y-3">
              {templateFile ? (
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
                  <ImageIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-300 truncate flex-1">{templateFile.name}</span>
                  <button type="button" onClick={() => setTemplateFile(null)} className="text-xs font-semibold text-red-500 hover:text-red-700 shrink-0">Hapus</button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all text-sm font-semibold text-slate-500 dark:text-slate-400">
                  <Upload className="w-4 h-4" />
                  Unggah Template (PNG/JPG)
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={e => setTemplateFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500">Tanpa template, sertifikat memakai desain bawaan bergaya klasik dengan bingkai emas.</p>
            </div>
          </PanelCard>

          <PanelCard title="Lapisan Teks" subtitle="Klik salah satu untuk diedit, atau seret langsung di pratinjau">
            <div className="space-y-2">
              {layers.map(layer => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm font-medium border-2 transition-all",
                    selectedLayerId === layer.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                  )}
                >
                  <Type className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 truncate">{layer.name}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                    className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                </button>
              ))}
              <Btn onClick={addLayer} variant="secondary" className="w-full gap-2 text-sm"><Plus className="w-4 h-4" />Tambah Lapisan Teks</Btn>
            </div>

            {selectedLayer && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <Input label="Nama Lapisan" value={selectedLayer.name} onChange={e => updateLayer(selectedLayer.id, { name: e.target.value })} />
                <Textarea
                  label="Isi Teks"
                  rows={2}
                  value={selectedLayer.text}
                  onChange={e => updateLayer(selectedLayer.id, { text: e.target.value })}
                  placeholder="Gunakan {nama}, {nomor}, atau {tanggal} sebagai placeholder otomatis"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 -mt-2">
                  Placeholder: <code className="bg-slate-100 dark:bg-slate-800 rounded px-1">{'{nama}'}</code> <code className="bg-slate-100 dark:bg-slate-800 rounded px-1">{'{nomor}'}</code> <code className="bg-slate-100 dark:bg-slate-800 rounded px-1">{'{tanggal}'}</code>
                  {recipientMode === "csv" && csvExtraColumns.length > 0 && (
                    <>
                      {" "}{csvExtraColumns.map(col => <code key={col} className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded px-1">{`{${col}}`}</code>)}
                    </>
                  )}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Select label="Font" value={selectedLayer.fontFamily} onChange={e => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}>
                    {fontOptions.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </Select>
                  <Input label="Ukuran (px)" type="number" min={8} max={200} value={selectedLayer.fontSize} onChange={e => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) || 24 })} />
                </div>

                <div>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:text-indigo-700 dark:hover:text-indigo-300">
                    {isFontLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload Font Kustom (.ttf / .otf / .woff)
                    <input
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      className="hidden"
                      disabled={isFontLoading}
                      onChange={e => { handleFontUpload(e.target.files?.[0] ?? null); e.target.value = ""; }}
                    />
                  </label>
                  {fontError && <p className="text-xs text-red-500 mt-1">{fontError}</p>}
                  {customFonts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {customFonts.map(f => (
                        <span key={f.id} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg">
                          {f.fileName}
                          <button type="button" onClick={() => removeCustomFont(f.id)} className="hover:text-red-500 transition-colors" aria-label={`Hapus font ${f.fileName}`}>
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <Label>Warna</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input type="color" value={selectedLayer.color} onChange={e => updateLayer(selectedLayer.id, { color: e.target.value })} className="h-10 w-10 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer p-0.5" />
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{selectedLayer.color}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => updateLayer(selectedLayer.id, { bold: !selectedLayer.bold })} className={cn("p-2.5 rounded-lg border-2", selectedLayer.bold ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400")}><Bold className="w-4 h-4" /></button>
                    <button type="button" onClick={() => updateLayer(selectedLayer.id, { italic: !selectedLayer.italic })} className={cn("p-2.5 rounded-lg border-2", selectedLayer.italic ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400")}><Italic className="w-4 h-4" /></button>
                    {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([val, Icon]) => (
                      <button key={val} type="button" onClick={() => updateLayer(selectedLayer.id, { align: val })} className={cn("p-2.5 rounded-lg border-2", selectedLayer.align === val ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400")}><Icon className="w-4 h-4" /></button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between mb-1"><Label>Posisi X</Label><span className="text-xs text-slate-400 dark:text-slate-500">{selectedLayer.xPct.toFixed(0)}%</span></div>
                    <input type="range" min={0} max={100} value={selectedLayer.xPct} onChange={e => updateLayer(selectedLayer.id, { xPct: Number(e.target.value) })} className="w-full accent-indigo-600" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1"><Label>Posisi Y</Label><span className="text-xs text-slate-400 dark:text-slate-500">{selectedLayer.yPct.toFixed(0)}%</span></div>
                    <input type="range" min={0} max={100} value={selectedLayer.yPct} onChange={e => updateLayer(selectedLayer.id, { yPct: Number(e.target.value) })} className="w-full accent-indigo-600" />
                  </div>
                </div>
              </div>
            )}
          </PanelCard>

          <PanelCard title="Daftar Penerima" subtitle="Satu sertifikat akan dibuat untuk setiap nama pada daftar">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRecipientMode("manual")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                  recipientMode === "manual" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                <PenLine className="w-3.5 h-3.5" /> Tulis Manual
              </button>
              <button
                type="button"
                onClick={() => setRecipientMode("csv")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                  recipientMode === "csv" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Upload CSV
              </button>
            </div>

            {recipientMode === "manual" ? (
              <Textarea
                rows={6}
                value={recipientsText}
                onChange={e => setRecipientsText(e.target.value)}
                placeholder={"Budi Santoso\nSiti Aminah\nAhmad Fauzi\n..."}
              />
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-xl py-2.5 transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" /> Unduh Template CSV
                </button>

                <label className="flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all">
                  {csvFile ? (
                    <div className="flex items-center gap-3 w-full">
                      <FileSpreadsheet className="w-6 h-6 text-indigo-500 shrink-0" />
                      <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 font-medium truncate">{csvFile.name}</span>
                      <button type="button" onClick={e => { e.preventDefault(); setCsvFile(null); }} className="text-sm text-red-500 font-semibold hover:text-red-700 shrink-0">Hapus</button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="flex justify-center mb-1.5 text-slate-400 dark:text-slate-500"><Upload className="w-6 h-6" /></div>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Upload File <span className="text-indigo-600 dark:text-indigo-400">.CSV</span></p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Kolom wajib: nama. Kolom lain jadi placeholder tambahan.</p>
                    </div>
                  )}
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => setCsvFile(e.target.files?.[0] ?? null)} />
                </label>

                {csvError && (
                  <p className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {csvError}
                  </p>
                )}
                {csvExtraColumns.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Placeholder tambahan dari CSV: {csvExtraColumns.map(col => <code key={col} className="bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 rounded px-1 mr-1">{`{${col}}`}</code>)}
                    — bisa dipakai di lapisan teks manapun.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mt-2">
              <Users className="w-3.5 h-3.5" />
              <span>{recipients.length} nama siap dicetak</span>
            </div>
          </PanelCard>

          <PanelCard title="Nama File Hasil Unduhan" subtitle="Berlaku untuk unduhan ZIP/PDF bulk semua penerima">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFileNameMode("recipient")}
                className={cn(
                  "py-2.5 rounded-xl text-xs font-semibold border-2 transition-all",
                  fileNameMode === "recipient" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                Sesuai Nama Penerima
              </button>
              <button
                type="button"
                onClick={() => setFileNameMode("system")}
                className={cn(
                  "py-2.5 rounded-xl text-xs font-semibold border-2 transition-all",
                  fileNameMode === "system" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                Default Sistem
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              Contoh nama file: <code className="bg-slate-100 dark:bg-slate-800 rounded px-1">
                {fileNameMode === "recipient" ? (sanitizeFileName(recipients[0]?.nama || "budi-santoso") || "budi-santoso") : "sertifikat-001"}.png
              </code>
            </p>
          </PanelCard>
        </div>

        {/* RIGHT: live preview + export */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pratinjau Langsung</p>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500"><Move className="w-3 h-3" />Seret teks untuk atur posisi</span>
          </div>

          <div
            ref={previewWrapRef}
            onPointerMove={onPointerMovePreview}
            onPointerUp={onPointerUpPreview}
            className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm select-none touch-none"
          >
            <canvas ref={canvasRef} className="w-full h-auto block" />
            {layers.map(layer => (
              <div
                key={layer.id}
                onPointerDown={(e) => onPointerDownLayer(e, layer.id)}
                style={{
                  position: "absolute",
                  left: `${layer.xPct}%`,
                  top: `${layer.yPct}%`,
                  transform: `translate(${layer.align === "left" ? "0" : layer.align === "right" ? "-100%" : "-50%"}, -50%)`,
                }}
                className={cn(
                  "cursor-move px-1.5 py-0.5 rounded",
                  selectedLayerId === layer.id ? "ring-2 ring-indigo-500" : "ring-1 ring-transparent hover:ring-indigo-300"
                )}
                title={layer.name}
              >
                <span className="opacity-0">{layer.name}</span>
              </div>
            ))}
          </div>

          {info && (
            <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", info.startsWith("Gagal") || info.startsWith("Isi") ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>
              {info}
            </div>
          )}

          {progress && (
            <div className="text-xs text-slate-500 dark:text-slate-400">Memproses {progress.done}/{progress.total}…</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Btn onClick={downloadSingle} disabled={isGenerating} variant="secondary" className="gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Unduh Contoh
            </Btn>
            <Btn onClick={downloadZip} disabled={isGenerating || !recipients.length} className="gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
              Unduh Semua (ZIP)
            </Btn>
            <Btn onClick={downloadPdf} disabled={isGenerating || !recipients.length} variant="secondary" className="gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Unduh Semua (PDF)
            </Btn>
          </div>

          <div className="text-center"><SectionBadge>Diproses langsung di perangkatmu — bisa ratusan sertifikat sekaligus</SectionBadge></div>
        </div>
      </div>
    </div>
  );
}
