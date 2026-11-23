import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileDown, Layers, Archive, Loader2, ClipboardCopy, Check, Sparkles, Ruler, Type as TypeIcon, Palette, AlertTriangle, ListOrdered, Wand2 } from "lucide-react";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { cn } from "@/utils/cn";
import { copyImageBlob } from "@/lib/permissions";
import {
  BARCODE_FORMATS, BARCODE_GROUPS, DEFAULT_BARCODE_STYLE, barcodeToCanvas, barcodeToSvgString, buildSeries, canvasToPngBlob,
  checkBarcodeValue, drawBarcode, getBarcodeFormat, parseBulkLines, type BarcodeStyle, type BulkEntry,
} from "@/lib/barcodeEngine";
import { Input, Select, Textarea, Btn, SectionBadge, Label } from "@/components/ui/primitives";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { PanelCard } from "@/components/ui/PanelCard";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { LOCALE, tr } from "@/i18n";

const PREVIEW_SCALE = 2;
const EXPORT_SCALES = [1, 2, 4, 8] as const;
const BULK_MAX = 1000;
const PAGES = {
  A4: { w: 595.28, h: 841.89, label: "A4" },
  Letter: { w: 612, h: 792, label: "Letter" },
  A5: { w: 419.53, h: 595.28, label: "A5" },
} as const;
type PageKey = keyof typeof PAGES;

const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const truncateLabel = (text: string, max = 30) => (text.length > max ? text.slice(0, max - 1) + "…" : text);
const todayLong = () => new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric" }).format(new Date());

function relLum(hex: string): number {
  const c = hex.replace("#", "");
  if (c.length !== 6) return 1;
  const f = (i: number) => { const v = parseInt(c.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(0) + 0.7152 * f(2) + 0.0722 * f(4);
}
const contrast = (a: string, b: string) => { const x = relLum(a) + 0.05, y = relLum(b) + 0.05; return x > y ? x / y : y / x; };

type BarcodeConfig = {
  content: string;
  format: string;
  style: BarcodeStyle;
  bulkText: string;
};

const pill = (active: boolean) =>
  cn("px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
    active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300");

// Didefinisikan di tingkat modul (bukan di dalam komponen lain) supaya slider tidak di-remount tiap render.
function SliderRow({ label, value, unit = "", min, max, step = 1, onChange }: { label: string; value: number; unit?: string; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <Label>{label}</Label>
        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{value}{unit}</span>
      </div>
      <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
    </div>
  );
}

export function BarcodeGenerator() {
  // Seluruh pengaturan punya riwayat Undo/Redo (digabung jadi satu langkah setelah jeda singkat).
  const bcHistory = useHistoryState<BarcodeConfig>(() => ({ content: "123456789012", format: "CODE128", style: DEFAULT_BARCODE_STYLE, bulkText: "" }));
  const cfg = bcHistory.state;
  const { schedule: scheduleCommit } = useDebouncedCommit(bcHistory.commit, 600);
  const setField = <K extends keyof BarcodeConfig>(key: K, value: BarcodeConfig[K]) => {
    bcHistory.set((prev) => ({ ...prev, [key]: value }), { commit: false });
    scheduleCommit();
  };
  const setStyle = (patch: Partial<BarcodeStyle>) => {
    bcHistory.set((prev) => ({ ...prev, style: { ...prev.style, ...patch } }), { commit: false });
    scheduleCommit();
  };
  const { content, format, style, bulkText } = cfg;
  const fmt = getBarcodeFormat(format);

  const changeFormat = (id: string) => {
    bcHistory.set((prev) => {
      // Isi bawaan/contoh dari format sebelumnya diganti contoh format baru bila tidak lagi valid; isi buatan pengguna tidak disentuh.
      const wasSample = !prev.content.trim() || prev.content === getBarcodeFormat(prev.format).sample || prev.content === "123456789012";
      const stillValid = checkBarcodeValue(id, prev.content).ok;
      return { ...prev, format: id, content: wasSample && !stillValid ? getBarcodeFormat(id).sample : prev.content };
    });
  };

  const check = useMemo(() => checkBarcodeValue(format, content), [format, content]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [exportScale, setExportScale] = useState<(typeof EXPORT_SCALES)[number]>(2);
  const [dims, setDims] = useState<string>("");

  // Preview real-time: setiap perubahan isi/format/gaya langsung digambar ulang. Canvas selalu ter-mount (disembunyikan lewat style).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    if (!check.ok) { setRenderError(null); setDims(""); return; }
    try {
      drawBarcode(c, check.value, format, style, PREVIEW_SCALE);
      c.style.width = `${c.width / PREVIEW_SCALE}px`;
      setRenderError(null);
      setDims(`${c.width / PREVIEW_SCALE} × ${c.height / PREVIEW_SCALE} px`);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : tr("Gagal membuat barcode"));
      setDims("");
    }
  }, [check, format, style]);

  const ready = check.ok && !renderError;
  const lowContrast = !style.bgTransparent && contrast(style.fg, style.bg) < 3;

  const downloadPng = async () => {
    if (!check.ok) return;
    downloadBlob(await canvasToPngBlob(barcodeToCanvas(check.value, format, style, exportScale)), "gamato-barcode.png");
  };
  const downloadSvg = () => {
    if (!check.ok) return;
    downloadBlob(new Blob([barcodeToSvgString(check.value, format, style)], { type: "image/svg+xml" }), "gamato-barcode.svg");
  };
  const copyImage = async () => {
    if (!check.ok) return;
    const ok = await copyImageBlob(await canvasToPngBlob(barcodeToCanvas(check.value, format, style, 2)));
    setCopyState(ok ? "copied" : "error");
    setTimeout(() => setCopyState("idle"), 1800);
  };

  // ── Massal ──
  const [bulkKind, setBulkKind] = useState<"list" | "series">("list");
  const [prefix, setPrefix] = useState("899");
  const [start, setStart] = useState(1);
  const [count, setCount] = useState(20);
  const [pad, setPad] = useState(9);
  const [pageKey, setPageKey] = useState<PageKey>("A4");
  const [cols, setCols] = useState(2);
  const [showLabels, setShowLabels] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkMsg, setBulkMsg] = useState<{ tone: "success" | "warning" | "error"; text: string } | null>(null);
  const [zipExt, setZipExt] = useState<"png" | "svg">("png");

  const bulk = useMemo(() => {
    const entries: BulkEntry[] = bulkKind === "list" ? parseBulkLines(bulkText) : buildSeries(prefix, start, count, pad);
    const all = entries.map((e, i) => ({ ...e, line: i + 1, res: checkBarcodeValue(format, e.code) }));
    const okAll = all.filter((e) => e.res.ok) as (BulkEntry & { line: number; res: { ok: true; value: string; encoded: string } })[];
    const invalid = all.filter((e) => !e.res.ok) as (BulkEntry & { line: number; res: { ok: false; reason: string } })[];
    return { total: all.length, valid: okAll.slice(0, BULK_MAX), invalid, capped: okAll.length > BULK_MAX };
  }, [bulkKind, bulkText, prefix, start, count, pad, format]);

  const bulkNote = () => {
    const parts: string[] = [];
    if (bulk.invalid.length) parts.push(tr("{0} baris dilewati karena tidak valid untuk format {1}", bulk.invalid.length, fmt.label));
    if (bulk.capped) parts.push(tr("dibatasi {0} kode pertama", BULK_MAX));
    return parts.length ? ` (${parts.join("; ")})` : "";
  };

  const generateBulkPdf = async () => {
    setBulkMsg(null);
    if (!bulk.total) { setBulkMsg({ tone: "warning", text: tr("Isi daftar kode terlebih dahulu, satu kode per baris.") }); return; }
    if (!bulk.valid.length) { setBulkMsg({ tone: "warning", text: tr("Tidak ada kode yang valid untuk format barcode yang dipilih.") }); return; }
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: bulk.valid.length });
    try {
      // pdf-lib (±180 KB gzip) hanya dimuat saat PDF benar-benar dibuat — bukan saat halaman dibuka.
      const [{ PDFDocument, StandardFonts, rgb }, { stampGamatoBranding }] = await Promise.all([import("pdf-lib"), import("@/lib/pdfBranding")]);
      const { w: PAGE_W, h: PAGE_H } = PAGES[pageKey];
      const MARGIN = 40, GAP_X = 20, GAP_Y = 18;
      const COLS = Math.min(4, Math.max(1, cols));
      const CELL_W = (PAGE_W - MARGIN * 2 - GAP_X * (COLS - 1)) / COLS;
      const BARCODE_MAX_H = COLS === 1 ? 130 : COLS === 2 ? 90 : COLS === 3 ? 70 : 56;
      const CAPTION_H = showLabels ? 14 : 0, HEADER_H = 54;
      const ROW_H = BARCODE_MAX_H + CAPTION_H + GAP_Y;
      const ROWS = Math.max(1, Math.floor((PAGE_H - MARGIN * 2 - HEADER_H) / ROW_H));
      const perPage = COLS * ROWS;

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      let pageIndex = 1;
      const drawHeader = () => {
        page.drawText(tr("Daftar Barcode"), { x: MARGIN, y: PAGE_H - MARGIN - 14, size: 16, font: fontBold, color: rgb(0.06, 0.09, 0.16) });
        page.drawText(tr("Dibuat {0} · Total {1} kode · Halaman {2}", todayLong(), bulk.valid.length, pageIndex), { x: MARGIN, y: PAGE_H - MARGIN - 30, size: 9, font, color: rgb(0.45, 0.5, 0.58) });
        page.drawLine({ start: { x: MARGIN, y: PAGE_H - MARGIN - 38 }, end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - 38 }, thickness: 0.75, color: rgb(0.85, 0.87, 0.9) });
      };
      drawHeader();

      for (let i = 0; i < bulk.valid.length; i++) {
        const posInPage = i % perPage;
        if (i > 0 && posInPage === 0) { page = pdfDoc.addPage([PAGE_W, PAGE_H]); pageIndex++; drawHeader(); }
        const col = posInPage % COLS, row = Math.floor(posInPage / COLS);
        const cellX = MARGIN + col * (CELL_W + GAP_X);
        const cellTopY = PAGE_H - MARGIN - HEADER_H - row * ROW_H;

        const entry = bulk.valid[i];
        const blob = await canvasToPngBlob(barcodeToCanvas(entry.res.value, format, { ...style, margin: 8 }, 3));
        const img = await pdfDoc.embedPng(new Uint8Array(await blob.arrayBuffer()));
        const scale = Math.min(CELL_W / img.width, BARCODE_MAX_H / img.height);
        const drawW = img.width * scale, drawH = img.height * scale;
        page.drawImage(img, { x: cellX + (CELL_W - drawW) / 2, y: cellTopY - BARCODE_MAX_H + (BARCODE_MAX_H - drawH) / 2, width: drawW, height: drawH });

        if (showLabels && entry.label) {
          const label = truncateLabel(entry.label, 30);
          // Helvetica standar hanya mengenal WinAnsi; karakter di luarnya diganti "?" agar PDF tidak gagal dibuat.
          const safeLabel = label.replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, "?");
          const tw = font.widthOfTextAtSize(safeLabel, 8);
          page.drawText(safeLabel, { x: cellX + Math.max(0, (CELL_W - tw) / 2), y: cellTopY - BARCODE_MAX_H - CAPTION_H + 3, size: 8, font, color: rgb(0.3, 0.35, 0.4) });
        }
        setBulkProgress({ done: i + 1, total: bulk.valid.length });
        await new Promise((r) => setTimeout(r, 0));
      }

      await stampGamatoBranding(pdfDoc);
      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Blob([pdfBytes as BlobPart], { type: "application/pdf" }), "gamato-barcode-massal.pdf");
      setBulkMsg({ tone: "success", text: tr("{0} barcode berhasil dibuat dan disusun rapi dalam PDF.", bulk.valid.length) + bulkNote() });
    } catch (err) {
      setBulkMsg({ tone: "error", text: err instanceof Error ? err.message : tr("Gagal membuat PDF massal.") });
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  };

  const generateBulkZip = async () => {
    setBulkMsg(null);
    if (!bulk.valid.length) { setBulkMsg({ tone: "warning", text: tr("Tidak ada kode yang valid untuk format barcode yang dipilih.") }); return; }
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: bulk.valid.length });
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const used = new Map<string, number>();
      const rows = ["kode,label,file"];
      for (let i = 0; i < bulk.valid.length; i++) {
        const e = bulk.valid[i];
        const base = sanitizeFileName(e.label || e.res.encoded, "barcode").replace(/^\.+|\.+$/g, "") || "barcode";
        const seen = used.get(base.toLowerCase()) ?? 0;
        used.set(base.toLowerCase(), seen + 1);
        const file = `${seen ? `${base}-${seen + 1}` : base}.${zipExt}`;
        if (zipExt === "svg") zip.file(file, barcodeToSvgString(e.res.value, format, style));
        else zip.file(file, await canvasToPngBlob(barcodeToCanvas(e.res.value, format, style, 3)));
        rows.push(`${csvCell(e.res.encoded)},${csvCell(e.label ?? "")},${csvCell(file)}`);
        setBulkProgress({ done: i + 1, total: bulk.valid.length });
        await new Promise((r) => setTimeout(r, 0));
      }
      zip.file("daftar.csv", "\ufeff" + rows.join("\r\n"));
      downloadBlob(await zip.generateAsync({ type: "blob" }), "gamato-barcode-massal.zip");
      setBulkMsg({ tone: "success", text: tr("{0} barcode berhasil dikemas dalam ZIP (beserta daftar.csv).", bulk.valid.length) + bulkNote() });
    } catch (err) {
      setBulkMsg({ tone: "error", text: tr("Gagal membuat ZIP: {0}", err instanceof Error ? err.message : String(err)) });
    } finally {
      setBulkBusy(false);
      setBulkProgress(null);
    }
  };

  const isEanLike = ["EAN13", "EAN8", "UPC", "UPCE", "EAN5", "EAN2"].includes(format);
  const blank = !content.trim();

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        {/* LEFT: Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Editor Barcode")}</p>
            <UndoRedoBar canUndo={bcHistory.canUndo} canRedo={bcHistory.canRedo} onUndo={bcHistory.undo} onRedo={bcHistory.redo} />
          </div>

          <CollapsibleSection title={tr("Isi & Format")} subtitle={tr("Pilih jenis barcode lalu isi datanya")} badge={tr("{0} Format", BARCODE_FORMATS.length)} defaultOpen>
            <div className="space-y-4">
              {BARCODE_GROUPS.map((g) => (
                <div key={g}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-500 mb-1.5">{g}</p>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={g}>
                    {BARCODE_FORMATS.filter((f) => f.group === g).map((f) => (
                      <button key={f.id} type="button" role="radio" aria-checked={format === f.id} data-testid={`bc-format-${f.id}`} onClick={() => changeFormat(f.id)} className={pill(format === f.id)}>{f.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-1 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <Textarea id="bc-content" label={tr("Konten Barcode")} rows={3} value={content} onChange={(e) => setField("content", e.target.value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " "))} placeholder={tr("Kode produk, SKU, atau angka…")} />
              <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="bc-rule">{fmt.rule}</p>
              {check.ok && check.note && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400" data-testid="bc-note">{check.note}</p>}
              {!check.ok && !blank && (
                <div className="space-y-2" data-testid="bc-error">
                  <GamatoInlineAlert tone="warning" message={check.reason} />
                  <div className="flex flex-wrap gap-2">
                    {check.fixedValue && <Btn variant="secondary" className="text-xs py-1.5" data-testid="bc-fix" onClick={() => { bcHistory.set((p) => ({ ...p, content: check.fixedValue! })); }}><Wand2 className="w-3.5 h-3.5" />{tr("Perbaiki digit cek")}</Btn>}
                    <Btn variant="secondary" className="text-xs py-1.5" data-testid="bc-sample" onClick={() => bcHistory.set((p) => ({ ...p, content: fmt.sample }))}><Sparkles className="w-3.5 h-3.5" />{tr("Pakai contoh: {0}", fmt.sample)}</Btn>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title={tr("Tampilan Batang")} subtitle={tr("Lebar, tinggi, margin, dan opsi khusus format")} icon={<Ruler className="w-4 h-4" />}>
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
              <SliderRow label={tr("Lebar Batang")} value={style.width} unit="px" min={1} max={6} onChange={(v) => setStyle({ width: v })} />
              <SliderRow label={tr("Tinggi")} value={style.height} unit="px" min={30} max={300} step={5} onChange={(v) => setStyle({ height: v })} />
              <SliderRow label={tr("Margin")} value={style.margin} unit="px" min={0} max={40} onChange={(v) => setStyle({ margin: v })} />
            </div>
            {isEanLike && <GamatoCheckbox checked={style.flat} onChange={(v) => setStyle({ flat: v })} label={tr("Batang pengaman rata (tanpa batang yang memanjang ke bawah)")} testId="bc-flat" />}
            {format === "CODE39" && <GamatoCheckbox checked={style.mod43} onChange={(v) => setStyle({ mod43: v })} label={tr("Tambahkan digit cek Mod 43")} testId="bc-mod43" />}
          </CollapsibleSection>

          <CollapsibleSection title={tr("Teks di Bawah Barcode")} subtitle={tr("Tampilkan, ganti, atau atur posisi tulisan")} icon={<TypeIcon className="w-4 h-4" />}>
            <GamatoCheckbox checked={style.showText} onChange={(v) => setStyle({ showText: v })} label={tr("Tampilkan teks")} testId="bc-showtext" />
            {style.showText && (
              <div className="space-y-4">
                <Input id="bc-custom-text" label={tr("Teks pengganti (kosongkan = pakai isi barcode)")} value={style.customText} maxLength={60} onChange={(e) => setStyle({ customText: e.target.value })} placeholder={tr("mis. Kopi Susu 250ml")} />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{tr("Posisi")}</Label>
                    <div className="flex gap-1.5 mt-1.5">
                      {([["bottom", tr("Bawah")], ["top", tr("Atas")]] as const).map(([id, l]) => <button key={id} type="button" onClick={() => setStyle({ textPosition: id })} className={pill(style.textPosition === id)}>{l}</button>)}
                    </div>
                  </div>
                  <div>
                    <Label>{tr("Rata")}</Label>
                    <div className="flex gap-1.5 mt-1.5">
                      {([["left", tr("Kiri")], ["center", tr("Tengah")], ["right", tr("Kanan")]] as const).map(([id, l]) => <button key={id} type="button" onClick={() => setStyle({ textAlign: id })} className={pill(style.textAlign === id)}>{l}</button>)}
                    </div>
                  </div>
                </div>
                <div>
                  <Label>{tr("Jenis Huruf")}</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {([["monospace", tr("Monospace")], ["sans-serif", tr("Sans-serif")], ["serif", tr("Serif")]] as const).map(([id, l]) => <button key={id} type="button" onClick={() => setStyle({ font: id })} className={pill(style.font === id)}>{l}</button>)}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
                  <SliderRow label={tr("Ukuran Teks")} value={style.fontSize} unit="px" min={8} max={40} onChange={(v) => setStyle({ fontSize: v })} />
                  <SliderRow label={tr("Jarak Teks")} value={style.textMargin} unit="px" min={0} max={20} onChange={(v) => setStyle({ textMargin: v })} />
                </div>
                <GamatoCheckbox checked={style.fontBold} onChange={(v) => setStyle({ fontBold: v })} label={tr("Teks tebal")} />
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection title={tr("Kustomisasi")} subtitle={tr("Warna batang dan latar")} icon={<Palette className="w-4 h-4" />}>
            <div className="grid grid-cols-2 gap-4">
              <GamatoColorPicker label={tr("Warna Utama")} value={style.fg} onChange={(v) => setStyle({ fg: v })} />
              {style.bgTransparent
                ? <div><Label>{tr("Warna Latar")}</Label><div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-3 py-3 text-[11px] text-slate-500 dark:text-slate-400" style={{ backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%)", backgroundSize: "10px 10px" }}>{tr("Latar transparan")}</div></div>
                : <GamatoColorPicker label={tr("Warna Latar")} value={style.bg} onChange={(v) => setStyle({ bg: v })} />}
            </div>
            <GamatoCheckbox checked={style.bgTransparent} onChange={(v) => setStyle({ bgTransparent: v })} label={tr("Latar transparan (PNG/SVG)")} testId="bc-transparent" />
            {lowContrast && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2.5" data-testid="bc-contrast">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{tr("Kontras warna batang & latar rendah — scanner barcode butuh batang gelap di atas latar terang. Disarankan hitam di atas putih.")}</span>
              </div>
            )}
          </CollapsibleSection>

          {/* Massal */}
          <PanelCard title={tr("Cetak Massal (PDF & ZIP)")} subtitle={tr("Daftar kode atau deret berurutan — memakai format & gaya di atas")}>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {([["list", tr("Daftar baris"), Layers], ["series", tr("Deret nomor"), ListOrdered]] as const).map(([id, l, Icon]) => (
                  <button key={id} type="button" data-testid={`bc-bulk-${id}`} onClick={() => setBulkKind(id)} className={cn(pill(bulkKind === id), "flex items-center gap-1.5")}><Icon className="w-3.5 h-3.5" />{l}</button>
                ))}
              </div>

              {bulkKind === "list" ? (
                <Textarea id="bc-bulk-text" label={tr("Satu kode per baris — opsional label setelah koma, mis. 4006381333931,Selai Stroberi")} rows={6} value={bulkText} onChange={(e) => setField("bulkText", e.target.value)}
                  placeholder={tr("4006381333931,Selai Stroberi\n5901234123457,Teh Melati 350ml\n9780201379624")} />
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Input id="bc-series-prefix" label={tr("Awalan")} value={prefix} onChange={(e) => setPrefix(e.target.value.replace(/[\r\n,]/g, ""))} />
                    <Input id="bc-series-pad" label={tr("Digit nomor")} type="number" min={0} max={20} value={pad} onChange={(e) => setPad(Math.min(20, Math.max(0, Number(e.target.value) || 0)))} />
                    <Input id="bc-series-start" label={tr("Mulai dari")} type="number" value={start} onChange={(e) => setStart(Number(e.target.value) || 0)} />
                    <Input id="bc-series-count" label={tr("Jumlah")} type="number" min={1} max={BULK_MAX} value={count} onChange={(e) => setCount(Math.min(BULK_MAX, Math.max(0, Number(e.target.value) || 0)))} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{tr("Hasil: awalan + nomor berlapis nol. Untuk EAN-13 isi total 12 digit — digit cek ditambahkan otomatis.")}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <Select id="bc-page" label={tr("Kertas")} value={pageKey} onChange={(e) => setPageKey(e.target.value as PageKey)}>
                  {(Object.keys(PAGES) as PageKey[]).map((k) => <option key={k} value={k}>{PAGES[k].label}</option>)}
                </Select>
                <Select id="bc-cols" label={tr("Kolom")} value={String(cols)} onChange={(e) => setCols(Number(e.target.value))}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
                <Select id="bc-zipext" label={tr("Format ZIP")} value={zipExt} onChange={(e) => setZipExt(e.target.value as "png" | "svg")}>
                  <option value="png">PNG</option>
                  <option value="svg">SVG</option>
                </Select>
              </div>
              <GamatoCheckbox checked={showLabels} onChange={setShowLabels} label={tr("Cetak label di bawah barcode (PDF)")} />

              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" data-testid="bc-bulk-count">
                <Layers className="w-3.5 h-3.5" />
                <span>{tr("{0} kode siap diproses · memakai format & warna di atas", bulk.valid.length)}{bulk.invalid.length ? ` · ${tr("{0} tidak valid", bulk.invalid.length)}` : ""}</span>
              </div>
              {bulk.invalid.length > 0 && (
                <ul className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2 space-y-1" data-testid="bc-bulk-invalid">
                  {bulk.invalid.slice(0, 4).map((e) => <li key={e.line} className="truncate">{tr("Baris {0}: “{1}” — {2}", e.line, e.code, e.res.reason)}</li>)}
                  {bulk.invalid.length > 4 && <li>{tr("…dan {0} lainnya", bulk.invalid.length - 4)}</li>}
                </ul>
              )}
              {bulkMsg && <GamatoInlineAlert message={bulkMsg.text} tone={bulkMsg.tone} />}
              {bulkProgress && <p className="text-xs text-slate-500 dark:text-slate-400">{tr("Memproses {0}/{1}…", bulkProgress.done, bulkProgress.total)}</p>}
              <div className="grid sm:grid-cols-2 gap-3">
                <Btn onClick={generateBulkPdf} disabled={bulkBusy || !bulk.valid.length} data-testid="bc-bulk-pdf" className="gap-2">
                  {bulkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}{tr("Buat PDF Massal ({0} kode)", bulk.valid.length)}
                </Btn>
                <Btn onClick={generateBulkZip} disabled={bulkBusy || !bulk.valid.length} variant="secondary" data-testid="bc-bulk-zip" className="gap-2">
                  <Archive className="w-4 h-4" />{tr("Unduh ZIP ({0} kode)", bulk.valid.length)}
                </Btn>
              </div>
            </div>
          </PanelCard>
        </div>

        {/* RIGHT: Preview */}
        <div className="lg:sticky lg:top-24 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">{tr("Preview Real-time")}</p>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center min-h-[380px] shadow-sm">
            <div className="p-5 rounded-2xl shadow-xl w-full flex flex-col items-center justify-center min-h-[9rem] overflow-hidden"
              style={{ background: style.bgTransparent ? "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 0 0 / 14px 14px" : "#ffffff" }}>
              {/* Canvas selalu ter-mount (disembunyikan lewat style) agar ref-nya tidak pernah null. */}
              <canvas ref={canvasRef} data-testid="bc-canvas" aria-label={tr("Preview barcode")} role="img" style={{ display: ready ? "block" : "none", maxWidth: "100%" }} />
              {!ready && (
                <p className="text-sm text-slate-500 text-center px-4" data-testid="bc-empty-hint">
                  {blank ? tr("Isi konten barcode") : renderError ?? (!check.ok ? check.reason : "")}
                </p>
              )}
            </div>
            {dims && <p className="mt-4 text-[11px] text-slate-500 dark:text-slate-400" data-testid="bc-dims">{dims}</p>}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <Btn onClick={downloadPng} disabled={!ready} data-testid="bc-dl-png" className="py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white border-0 text-base shadow-lg shadow-indigo-600/20">
              <Download className="w-4 h-4" />{tr("Unduh Barcode · PNG")}
            </Btn>
            <div className="w-24">
              <Select id="bc-export-scale" value={String(exportScale)} onChange={(e) => setExportScale(Number(e.target.value) as (typeof EXPORT_SCALES)[number])} aria-label={`${tr("Resolusi PNG")}: ${exportScale}×`}>
                {EXPORT_SCALES.map((s) => <option key={s} value={s}>{s}×</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Btn onClick={downloadSvg} disabled={!ready} variant="secondary" data-testid="bc-dl-svg" className="py-3"><Download className="w-4 h-4" />{tr("SVG")}</Btn>
            <Btn onClick={copyImage} disabled={!ready} variant="secondary" data-testid="bc-copy" className="py-3">
              {copyState === "copied" ? <><Check className="w-4 h-4 text-emerald-500" />{tr("Tersalin!")}</> : <><ClipboardCopy className="w-4 h-4" />{tr("Salin Gambar")}</>}
            </Btn>
          </div>
          {copyState === "error" && <p className="text-xs text-center text-amber-600 dark:text-amber-400">{tr("Salin gambar tidak didukung di browser ini. Gunakan tombol unduh sebagai gantinya.")}</p>}

          <div className="text-center"><SectionBadge>{tr("Diproses langsung di perangkatmu")}</SectionBadge></div>
        </div>
      </div>
    </div>
  );
}
