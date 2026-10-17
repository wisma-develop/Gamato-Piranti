import React, { useMemo, useRef, useState } from "react";
import { FileArchive, FileText, Image as ImageIcon, Download, Trash2, Loader2, X, CheckCircle2, AlertTriangle, Package, Zap, Shrink } from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { Btn, Label } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { LEVEL_PRESETS, compressDocument, detectKind, isCancelled, type DocCompressResult } from "@/lib/docCompress";

interface Item {
  id: string;
  file: File;
  status: "queued" | "working" | "done" | "error";
  progress: number;
  message?: string;
  result?: DocCompressResult;
}

const uid = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";
const cap = "text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500";

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void; testId?: string; disabled?: boolean }> = ({ label, value, min, max, step = 1, suffix = "", onChange, testId, disabled }) => (
  <div data-testid={testId} className={cn(disabled && "opacity-50")}>
    <div className="flex justify-between items-center mb-1.5">
      <Label>{label}</Label>
      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(value * 100) / 100}{suffix}</span>
    </div>
    <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} disabled={disabled} aria-label={label} />
  </div>
);

export const DocCompress: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [preset, setPreset] = useState<"low" | "medium" | "high" | "custom">("medium");
  const [quality, setQuality] = useState(Math.round(LEVEL_PRESETS.medium.quality * 100));
  const [maxDim, setMaxDim] = useState<number>(LEVEL_PRESETS.medium.maxDim);
  const [pngToJpeg, setPngToJpeg] = useState(true);
  const [pdfRaster, setPdfRaster] = useState(false);
  const [rasterDpi, setRasterDpi] = useState(110);
  const [running, setRunning] = useState(false);
  const [info, setInfo] = useState<{ msg: string; tone: "success" | "error" | "warning" | "info" } | null>(null);
  const cancelRef = useRef({ cancelled: false });

  const patch = (id: string, p: Partial<Item>) => setItems((is) => is.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const hasPdf = useMemo(() => items.some((i) => detectKind(i.file).kind === "pdf"), [items]);
  const hasImageish = useMemo(() => items.some((i) => ["image", "ooxml", "odf"].includes(detectKind(i.file).kind)), [items]);
  const done = items.filter((i) => i.status === "done" && i.result);
  const totals = useMemo(() => {
    const o = done.reduce((a, i) => a + i.result!.originalSize, 0);
    const c = done.reduce((a, i) => a + i.result!.compressedSize, 0);
    return { o, c, pct: o > 0 ? Math.max(0, Math.round((1 - c / o) * 100)) : 0 };
  }, [done]);

  const choosePreset = (p: "low" | "medium" | "high") => {
    setPreset(p);
    setQuality(Math.round(LEVEL_PRESETS[p].quality * 100));
    setMaxDim(LEVEL_PRESETS[p].maxDim);
  };

  const addFiles = (files: File[]) => {
    if (!files.length) return;
    setInfo(null);
    const fresh: Item[] = [];
    const rejected: string[] = [];
    for (const f of files) {
      if (detectKind(f).kind === "unsupported") rejected.push(f.name);
      else fresh.push({ id: uid(), file: f, status: "queued", progress: 0 });
    }
    if (fresh.length) setItems((is) => [...is, ...fresh]);
    if (rejected.length) setInfo({ msg: `${rejected.join(", ")}: audio/video punya alat khusus — pakai Kompres Audio atau Kompres Video.`, tone: "warning" });
  };

  const removeItem = (id: string) => setItems((is) => is.filter((i) => i.id !== id));

  const run = async () => {
    const queue = items.filter((i) => i.status !== "done");
    if (!queue.length) return;
    cancelRef.current = { cancelled: false };
    setRunning(true);
    setInfo(null);
    let ok = 0;
    let failed = 0;
    for (const it of queue) {
      if (cancelRef.current.cancelled) break;
      patch(it.id, { status: "working", progress: 0, message: "Memulai…", result: undefined });
      try {
        const result = await compressDocument(it.file, {
          quality: quality / 100,
          maxDim,
          pngToJpeg,
          pdfRaster,
          rasterDpi,
          signal: cancelRef.current,
          onProgress: (f, m) => patch(it.id, { progress: f, message: m }),
        });
        patch(it.id, { status: "done", progress: 1, result, message: undefined });
        ok++;
      } catch (e: any) {
        if (isCancelled(e)) {
          patch(it.id, { status: "queued", progress: 0, message: undefined });
          break;
        }
        failed++;
        patch(it.id, { status: "error", message: e?.message || "Gagal memproses berkas." });
      }
    }
    setRunning(false);
    if (cancelRef.current.cancelled) setInfo({ msg: "Dibatalkan. Berkas yang sudah selesai tetap bisa diunduh.", tone: "info" });
    else if (failed && !ok) setInfo({ msg: "Semua berkas gagal diproses — periksa pesan di tiap baris.", tone: "error" });
    else if (failed) setInfo({ msg: `${ok} berkas selesai, ${failed} gagal.`, tone: "warning" });
    else setInfo({ msg: `${ok} berkas selesai diproses.`, tone: "success" });
  };

  const downloadOne = (it: Item) => {
    if (it.result) downloadBlob(it.result.blob, it.result.name);
  };

  const downloadAllZip = async () => {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const used = new Set<string>();
    for (const it of done) {
      let name = it.result!.name;
      if (used.has(name)) {
        const m = /^(.*?)(\.[^.]*)?$/.exec(name)!;
        let n = 2;
        while (used.has(`${m[1]}-${n}${m[2] ?? ""}`)) n++;
        name = `${m[1]}-${n}${m[2] ?? ""}`;
      }
      used.add(name);
      zip.file(name, it.result!.blob);
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    downloadBlob(blob, "gamato-dokumen-terkompres.zip");
  };

  const pending = items.filter((i) => i.status !== "done").length;

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-5">
        <Dropzone
          onFiles={addFiles}
          multiple
          label="Drop dokumen di sini"
          sublabel="PDF, DOCX, XLSX, PPTX, ODT, EPUB, ZIP, gambar, teks — bisa banyak sekaligus"
          icon={<FileArchive className="w-8 h-8" />}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
        />

        {items.length > 0 && (
          <div className={cn(card, "!p-0 overflow-hidden")} data-testid="dc-list">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{items.length} berkas · {fmtSize(items.reduce((a, i) => a + i.file.size, 0))}</p>
              <button type="button" disabled={running} onClick={() => setItems([])} className="text-sm text-red-500 font-semibold hover:text-red-700 disabled:opacity-40">Kosongkan</button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((it) => {
                const k = detectKind(it.file);
                const r = it.result;
                const saved = r ? Math.max(0, Math.round((1 - r.compressedSize / r.originalSize) * 100)) : 0;
                return (
                  <div key={it.id} className="px-5 py-3 space-y-2" data-testid="dc-row" data-status={it.status}>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 dark:text-slate-500 shrink-0">{k.kind === "image" ? <ImageIcon className="w-5 h-5" /> : k.kind === "wrap" || k.kind === "zip" ? <FileArchive className="w-5 h-5" /> : <FileText className="w-5 h-5" />}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{it.file.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-[10px] mr-1.5">{k.label}</span>
                          {fmtSize(it.file.size)}
                          {r && (
                            <>
                              {" → "}
                              <span data-testid="dc-after" className="font-bold text-green-600 dark:text-green-400">{fmtSize(r.compressedSize)}</span>
                              {r.outcome === "original" ? " (asli dipertahankan)" : ` · hemat ${saved}%`}
                            </>
                          )}
                        </p>
                      </div>
                      {it.status === "working" && <Loader2 className="w-4 h-4 animate-spin text-indigo-500 shrink-0" />}
                      {it.status === "done" && r && (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          <button type="button" data-testid="dc-download-one" onClick={() => downloadOne(it)} className="p-1.5 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg" title={`Unduh ${r.name}`}>
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {it.status === "error" && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                      <button type="button" disabled={it.status === "working"} onClick={() => removeItem(it.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg disabled:opacity-30" aria-label="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {it.status === "working" && (
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round(it.progress * 100)}%` }} />
                        </div>
                        <p className="text-[11px] text-slate-400">{it.message}</p>
                      </div>
                    )}
                    {it.status === "error" && <p className="text-xs text-red-600 dark:text-red-400">{it.message}</p>}
                    {it.status === "queued" && <p className="text-[11px] text-slate-400 dark:text-slate-500">{k.plan}</p>}
                    {r && r.notes.length > 0 && (
                      <ul className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                        {r.images > 0 && <li>• {r.images} gambar dioptimasi{r.converted ? `, ${r.converted} diubah ke JPEG` : ""}.</li>}
                        {r.notes.map((n, i) => <li key={i}>• {n}</li>)}
                      </ul>
                    )}
                    {r && r.notes.length === 0 && r.images > 0 && <p className="text-[11px] text-slate-500 dark:text-slate-400">• {r.images} gambar dioptimasi{r.converted ? `, ${r.converted} diubah ke JPEG` : ""}.</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className={card}>
          <p className={cap}>Tingkat Kompresi</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="dc-presets">
            {(["low", "medium", "high"] as const).map((p) => (
              <button key={p} type="button" data-testid={`dc-preset-${p}`} onClick={() => choosePreset(p)}
                className={cn("py-2.5 rounded-xl text-sm font-semibold border-2 transition-all", preset === p ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>
                {LEVEL_PRESETS[p].label}
              </button>
            ))}
            <button type="button" data-testid="dc-preset-custom" onClick={() => setPreset("custom")}
              className={cn("py-2.5 rounded-xl text-sm font-semibold border-2 transition-all", preset === "custom" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>
              Kustom
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <Slider label="Kualitas gambar (JPEG/WEBP)" value={quality} min={20} max={95} suffix="%" testId="dc-quality" onChange={(v) => { setQuality(v); setPreset("custom"); }} />
            <Slider label="Dimensi gambar maks" value={maxDim} min={480} max={4096} step={32} suffix=" px" testId="dc-maxdim" onChange={(v) => { setMaxDim(v); setPreset("custom"); }} />
          </div>
          {hasImageish && (
            <GamatoCheckbox checked={pngToJpeg} onChange={setPngToJpeg} testId="dc-png2jpg" label={<span className="text-sm text-slate-600 dark:text-slate-300">Ubah PNG tanpa transparansi menjadi JPEG <span className="text-slate-400">(penghemat terbesar; PNG ber-transparansi tidak pernah diubah)</span></span>} />
          )}
          {hasPdf && (
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <GamatoCheckbox checked={pdfRaster} onChange={setPdfRaster} testId="dc-pdf-raster" label={<span className="text-sm text-slate-600 dark:text-slate-300">Mode agresif PDF <span className="text-slate-400">— setiap halaman jadi gambar JPEG (cocok untuk PDF hasil scan; teks tidak bisa diseleksi/dicari)</span></span>} />
              {pdfRaster && <Slider label="Resolusi halaman" value={rasterDpi} min={72} max={220} step={4} suffix=" dpi" testId="dc-dpi" onChange={setRasterDpi} />}
            </div>
          )}
        </div>

        {info && <GamatoInlineAlert message={info.msg} tone={info.tone} />}

        {done.length > 0 && (
          <div className={card} data-testid="dc-summary">
            <div className="flex items-center justify-between text-sm">
              <div className="text-center flex-1">
                <p className="text-slate-400 dark:text-slate-500 text-xs mb-1">Sebelum</p>
                <p className="font-bold text-slate-700 dark:text-slate-200">{fmtSize(totals.o)}</p>
              </div>
              <div className="text-indigo-500 font-bold text-lg px-3">→</div>
              <div className="text-center flex-1">
                <p className="text-slate-400 dark:text-slate-500 text-xs mb-1">Sesudah</p>
                <p className="font-bold text-green-600 dark:text-green-400" data-testid="dc-total-after">{fmtSize(totals.c)}</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-slate-400 dark:text-slate-500 text-xs mb-1">Hemat</p>
                <p className="font-bold text-indigo-600 dark:text-indigo-300" data-testid="dc-total-pct">{totals.pct}%</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {done.length === 1 ? (
                <Btn data-testid="dc-download" onClick={() => downloadOne(done[0])} className="flex-1"><Download className="w-4 h-4" />Unduh {done[0].result!.name}</Btn>
              ) : (
                <>
                  <Btn data-testid="dc-download-zip" onClick={downloadAllZip} className="flex-1"><Package className="w-4 h-4" />Unduh Semua (ZIP)</Btn>
                  <Btn variant="secondary" onClick={() => done.forEach((d, i) => setTimeout(() => downloadOne(d), i * 250))}><Download className="w-4 h-4" />Unduh Satu per Satu</Btn>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Btn data-testid="dc-run" onClick={run} disabled={running || pending === 0} className="flex-1 py-4 text-base">
            {running ? <><Loader2 className="w-4 h-4 animate-spin" />Mengompres…</> : <><Zap className="w-4 h-4" />Kompres {pending > 0 ? `${pending} ` : ""}Berkas</>}
          </Btn>
          {running && (
            <Btn data-testid="dc-cancel" variant="danger" onClick={() => { cancelRef.current.cancelled = true; }}><X className="w-4 h-4" />Batal</Btn>
          )}
        </div>
      </div>

      <ToolInfoPanel
        icon={<Shrink className="w-5 h-5" />}
        label="Kompres Dokumen"
        desc="PDF, Office, gambar & arsip"
        points={[
          "PDF: gambar JPEG dikompres ulang, struktur dipadatkan. Mode agresif untuk PDF hasil scan.",
          "DOCX/XLSX/PPTX/ODT/EPUB: gambar di dalam dokumen dikompres ulang, ZIP ditulis ulang maksimal.",
          "Hasil tidak pernah lebih besar dari aslinya — kalau tidak ada yang bisa dihemat, berkas asli dipertahankan.",
          "DOC/XLS/PPT lama & berkas teks dibungkus ZIP (format biner lama tidak bisa dipadatkan aman di browser).",
          "Semua proses di perangkatmu — berkas tidak diunggah ke server mana pun.",
        ]}
        info={info && info.tone !== "info" ? info.msg : null}
        infoTone={info?.tone === "error" ? "error" : "success"}
      />
    </div>
  );
};
