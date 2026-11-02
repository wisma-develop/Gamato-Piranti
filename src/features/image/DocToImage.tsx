import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileImage, FileText, Presentation, Sheet, FileType2, Layers, Download, Loader2, Trash2, Check, Info, Files, GalleryVertical } from "lucide-react";
import JSZip from "jszip";
import { cn } from "@/utils/cn";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { PanelCard } from "@/components/ui/PanelCard";
import { PreviewJumpFab } from "@/components/ui/PreviewJumpFab";
import { detectKind, KIND_EXTS, KIND_LABEL, openDocument, type DocKind, type DocKindOrAuto, type DocSession } from "@/lib/docRaster";

const KIND_UI: Record<DocKindOrAuto, { title: string; accept: string; label: string; sub: string; icon: React.ReactNode; points: string[] }> = {
  pdf: {
    title: "PDF ke Gambar", accept: ".pdf,application/pdf", label: "Drop file PDF di sini", sub: "atau klik untuk browse", icon: <FileText className="w-8 h-8 text-slate-400" />,
    points: ["Setiap halaman dirender penuh sebagai gambar — termasuk PDF hasil scan.", "Pilih halaman lewat pratinjau, atau gabungkan semuanya jadi satu gambar panjang."],
  },
  word: {
    title: "Word ke Gambar", accept: ".docx", label: "Drop file Word (.docx) di sini", sub: "atau klik untuk browse", icon: <FileType2 className="w-8 h-8 text-slate-400" />,
    points: ["Judul, gaya huruf, daftar, tabel, dan gambar dirender per halaman sesuai ukuran kertas dokumen.", "Header/footer, kotak teks, dan grafik tidak ikut dirender. Untuk hasil identik 100% dengan Word, ekspor dulu ke PDF dari Word lalu pakai PDF ke Gambar."],
  },
  ppt: {
    title: "PowerPoint ke Gambar", accept: ".pptx", label: "Drop file PowerPoint (.pptx) di sini", sub: "atau klik untuk browse", icon: <Presentation className="w-8 h-8 text-slate-400" />,
    points: ["Setiap slide menjadi satu gambar: latar, tema warna, bentuk, teks, gambar, dan tabel.", "Grafik/SmartArt diganti kotak keterangan; animasi dan transisi tidak berlaku."],
  },
  excel: {
    title: "Excel & CSV ke Gambar", accept: ".xlsx,.xlsm,.csv,.tsv", label: "Drop file Excel (.xlsx) atau CSV di sini", sub: "atau klik untuk browse", icon: <Sheet className="w-8 h-8 text-slate-400" />,
    points: ["Lebar kolom, warna sel, garis, perataan, sel gabungan, dan format angka/tanggal dipertahankan.", "Tabel lebar otomatis diperkecil agar muat satu halaman; semua lembar ikut dirender."],
  },
  teks: {
    title: "Teks, Markdown & RTF ke Gambar", accept: ".txt,.md,.markdown,.rtf,.json,.log,.xml,.yml,.yaml,.ini,.html,.htm,.js,.ts,.css,.py,.java,.c,.cpp,.sql,.sh,.php,text/*", label: "Drop file teks / Markdown / RTF di sini", sub: "atau klik untuk browse", icon: <FileText className="w-8 h-8 text-slate-400" />,
    points: ["Markdown dirender dengan judul, daftar, kutipan, dan blok kode; JSON dirapikan otomatis.", "Kode/log/CSV memakai font monospasi dengan indentasi terjaga. Semua aksara Unicode didukung."],
  },
  auto: {
    title: "Dokumen ke Gambar", accept: ".pdf,.docx,.pptx,.xlsx,.xlsm,.csv,.tsv,.txt,.md,.markdown,.rtf,.json,.log,.xml,.yml,.yaml,.html,.htm", label: "Drop dokumen apa pun di sini", sub: "PDF · Word · PowerPoint · Excel/CSV · Teks/Markdown/RTF", icon: <Files className="w-8 h-8 text-slate-400" />,
    points: ["Jenis file dikenali otomatis dari ekstensinya.", "Semua diproses di perangkatmu — dokumen tidak pernah diunggah ke server."],
  },
};

const DPI_OPTIONS = [
  { dpi: 96, label: "96", sub: "Layar" },
  { dpi: 150, label: "150", sub: "Standar" },
  { dpi: 200, label: "200", sub: "Tajam" },
  { dpi: 300, label: "300", sub: "Cetak" },
  { dpi: 400, label: "400", sub: "Maks" },
] as const;
const FORMATS = [
  { id: "png", label: "PNG", mime: "image/png", ext: "png", sub: "Tanpa kehilangan" },
  { id: "jpeg", label: "JPG", mime: "image/jpeg", ext: "jpg", sub: "Ringan" },
  { id: "webp", label: "WebP", mime: "image/webp", ext: "webp", sub: "Paling kecil" },
] as const;
type FormatId = (typeof FORMATS)[number]["id"];

const yieldUi = () => new Promise<void>((r) => setTimeout(r, 0));

const Seg: React.FC<{ children: React.ReactNode; active: boolean; onClick: () => void; sub?: string }> = ({ children, active, onClick, sub }) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    onClick={onClick}
    className={cn(
      "rounded-xl border-2 px-1.5 py-2 text-center transition-all",
      active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
    )}
  >
    <span className={cn("block text-xs font-bold", active ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200")}>{children}</span>
    {sub && <span className="block text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">{sub}</span>}
  </button>
);

export const DocToImage: React.FC<{ kind: DocKindOrAuto }> = ({ kind }) => {
  const ui = KIND_UI[kind];
  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<DocSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dpi, setDpi] = useState(200);
  const [format, setFormat] = useState<FormatId>("png");
  const [quality, setQuality] = useState(92);
  const [mode, setMode] = useState<"pages" | "stitch">("pages");
  const [gap, setGap] = useState(false);
  const [gridlines, setGridlines] = useState(true);
  const [busy, setBusy] = useState<{ done: number; total: number; label: string } | null>(null);
  const sessionRef = useRef<DocSession | null>(null);
  const loadSeq = useRef(0);

  const effKind: DocKind | null = useMemo(() => (file ? (kind === "auto" ? detectKind(file) : kind) : null), [file, kind]);

  const closeSession = useCallback(() => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
  }, []);
  useEffect(() => () => closeSession(), [closeSession]);

  const load = useCallback(
    async (f: File) => {
      const seq = ++loadSeq.current;
      closeSession();
      setSession(null);
      setThumbs({});
      setSelected(new Set());
      setError(null);
      setInfo(null);
      setLoading(true);
      try {
        const s = await openDocument(f, kind, { gridlines });
        if (loadSeq.current !== seq) { s.dispose(); return; }
        sessionRef.current = s;
        setSession(s);
        setSelected(new Set(Array.from({ length: s.count }, (_, i) => i)));
        // thumbnail bertahap (maks 150 halaman) agar UI tetap responsif
        const limit = Math.min(s.count, 150);
        for (let i = 0; i < limit; i++) {
          if (loadSeq.current !== seq) return;
          const c = await s.render(i, 40);
          if (loadSeq.current !== seq) return;
          const url = c.toDataURL("image/jpeg", 0.8);
          setThumbs((prev) => ({ ...prev, [i]: url }));
          if (i % 4 === 3) await yieldUi();
        }
      } catch (err: any) {
        if (loadSeq.current === seq) setError(err?.message || "Gagal membuka dokumen.");
      } finally {
        if (loadSeq.current === seq) setLoading(false);
      }
    },
    [kind, gridlines, closeSession]
  );

  const addFiles = (incoming: File[]) => {
    const f = incoming[0];
    if (!f) return;
    const k = detectKind(f);
    const allowed = kind === "auto" ? !!k : k === kind;
    if (!allowed) {
      setError(kind === "auto" ? "Jenis file tidak didukung." : `File ini bukan ${KIND_LABEL[kind]}. Gunakan menu "Dokumen ke Gambar" untuk memilih jenis lain (${KIND_EXTS[kind].slice(0, 4).map((e) => "." + e).join(", ")} …).`);
      return;
    }
    setFile(f);
    load(f);
  };

  // Garis kisi Excel mengubah hasil render → muat ulang.
  const firstGrid = useRef(true);
  useEffect(() => {
    if (firstGrid.current) { firstGrid.current = false; return; }
    if (file && effKind === "excel") load(file);
  }, [gridlines]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    loadSeq.current++;
    closeSession();
    setFile(null); setSession(null); setThumbs({}); setSelected(new Set()); setError(null); setInfo(null); setLoading(false);
  };

  const fmt = FORMATS.find((f) => f.id === format)!;
  const pickedIdx = useMemo(() => Array.from(selected).sort((a, b) => a - b), [selected]);
  const base = sanitizeFileName(file ? file.name.replace(/\.[^.]+$/, "") : "dokumen") || "dokumen";

  const estimate = useMemo(() => {
    if (!session || !pickedIdx.length) return null;
    const px = dpi / 72;
    const a = session.size(pickedIdx[0]);
    return { w: Math.round(a.w * px), h: Math.round(a.h * px) };
  }, [session, pickedIdx, dpi]);

  const toggle = (i: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const run = async () => {
    if (!session || !pickedIdx.length) return;
    setInfo(null);
    setBusy({ done: 0, total: pickedIdx.length, label: "Merender halaman" });
    try {
      const q = fmt.id === "png" ? undefined : quality / 100;
      if (mode === "pages") {
        if (pickedIdx.length === 1) {
          const c = await session.render(pickedIdx[0], dpi);
          downloadBlob(await canvasToBlob(c, fmt.mime, q), `${base}-hal-${String(pickedIdx[0] + 1).padStart(2, "0")}.${fmt.ext}`);
          setInfo({ tone: "success", text: `1 halaman diunduh (${c.width}×${c.height}px).` });
        } else {
          const zip = new JSZip();
          let w0 = 0, h0 = 0;
          for (let n = 0; n < pickedIdx.length; n++) {
            const i = pickedIdx[n];
            const c = await session.render(i, dpi);
            if (!n) { w0 = c.width; h0 = c.height; }
            zip.file(`${base}-hal-${String(i + 1).padStart(2, "0")}.${fmt.ext}`, await canvasToBlob(c, fmt.mime, q));
            c.width = c.height = 1; // lepas memori bitmap
            setBusy({ done: n + 1, total: pickedIdx.length, label: "Merender halaman" });
            await yieldUi();
          }
          setBusy({ done: pickedIdx.length, total: pickedIdx.length, label: "Menyusun ZIP" });
          downloadBlob(await zip.generateAsync({ type: "blob", compression: "STORE" }), `${base}-${fmt.ext}.zip`);
          setInfo({ tone: "success", text: `${pickedIdx.length} halaman diunduh sebagai ZIP (halaman pertama ${w0}×${h0}px).` });
        }
      } else {
        // satu gambar panjang
        const px0 = dpi / 72;
        const gapPt = gap ? 10 : 0;
        const sizes = pickedIdx.map((i) => session.size(i));
        const Wpt = Math.max(...sizes.map((s) => s.w));
        const Hpt = sizes.reduce((a, s) => a + s.h, 0) + gapPt * (sizes.length - 1);
        let k = 1;
        const MAXSIDE = 30000, MAXAREA = 230e6;
        k = Math.min(1, MAXSIDE / (Hpt * px0), MAXSIDE / (Wpt * px0), Math.sqrt(MAXAREA / (Wpt * px0 * Hpt * px0)));
        const eff = Math.max(24, Math.floor(dpi * k));
        const px = eff / 72;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(Wpt * px);
        canvas.height = Math.round(Hpt * px);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas tidak tersedia di browser ini.");
        ctx.fillStyle = gap ? "#e5e7eb" : "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        let y = 0;
        for (let n = 0; n < pickedIdx.length; n++) {
          const c = await session.render(pickedIdx[n], eff);
          ctx.drawImage(c, Math.round(((Wpt - sizes[n].w) / 2) * px), Math.round(y));
          y += sizes[n].h * px + gapPt * px;
          c.width = c.height = 1;
          setBusy({ done: n + 1, total: pickedIdx.length, label: "Menggabungkan halaman" });
          await yieldUi();
        }
        downloadBlob(await canvasToBlob(canvas, fmt.mime, q), `${base}-gabungan.${fmt.ext}`);
        setInfo({
          tone: "success",
          text: `Gambar panjang diunduh (${canvas.width}×${canvas.height}px)${eff < dpi ? ` — resolusi diturunkan otomatis ke ${eff} dpi karena batas ukuran kanvas browser` : ""}.`,
        });
      }
    } catch (err: any) {
      setInfo({ tone: "error", text: err?.message || "Gagal mengonversi dokumen." });
    } finally {
      setBusy(null);
    }
  };

  const showNotes = session && session.notes.length > 0;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <PreviewJumpFab targetId="doc2img-settings" label="Opsi & Unduh" />
      <div className="space-y-5 min-w-0">
        {!file ? (
          <Dropzone onFiles={addFiles} accept={ui.accept} multiple={false} label={ui.label} sublabel={ui.sub} icon={ui.icon} isDragging={isDragging} setIsDragging={setIsDragging} />
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 shadow-sm">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">{effKind === "ppt" ? <Presentation className="w-5 h-5" /> : effKind === "excel" ? <Sheet className="w-5 h-5" /> : effKind === "word" ? <FileType2 className="w-5 h-5" /> : <FileText className="w-5 h-5" />}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
              <p className="text-xs text-slate-400">{effKind ? KIND_LABEL[effKind] : ""} · {(file.size / 1024 / 1024).toFixed(2)} MB{session ? ` · ${session.count} halaman` : ""}</p>
            </div>
            <button type="button" onClick={reset} aria-label="Ganti file" className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}

        {error && <GamatoInlineAlert message={error} tone="error" />}
        {loading && !session && (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Membaca dokumen…</div>
        )}

        {showNotes && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-bold flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Catatan hasil render</p>
            <ul className="list-disc pl-5 space-y-0.5">{session!.notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </div>
        )}

        {session && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Pilih halaman <span className="font-normal text-slate-400">({pickedIdx.length}/{session.count} dipilih)</span></p>
              <div className="flex gap-3 text-xs font-semibold">
                <button type="button" className="text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => setSelected(new Set(Array.from({ length: session.count }, (_, i) => i)))}>Pilih semua</button>
                <button type="button" className="text-slate-500 hover:underline" onClick={() => setSelected(new Set())}>Kosongkan</button>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[560px] overflow-y-auto pr-1">
              {Array.from({ length: session.count }, (_, i) => {
                const on = selected.has(i);
                const sz = session.size(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggle(i)}
                    aria-pressed={on}
                    aria-label={`Halaman ${i + 1}`}
                    className={cn("relative rounded-lg border-2 p-1 text-left transition-all bg-slate-50 dark:bg-slate-800", on ? "border-indigo-500" : "border-transparent opacity-50 hover:opacity-80")}
                  >
                    <div className="w-full bg-white rounded overflow-hidden flex items-center justify-center" style={{ aspectRatio: `${sz.w} / ${sz.h}` }}>
                      {thumbs[i] ? <img src={thumbs[i]} alt="" className="w-full h-full object-contain" draggable={false} /> : <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />}
                    </div>
                    <span className="block text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">{i + 1}</span>
                    {on && <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
                  </button>
                );
              })}
            </div>
            {session.count > 150 && <p className="text-[11px] text-slate-400">Pratinjau dibatasi 150 halaman pertama; semua halaman terpilih tetap ikut dikonversi.</p>}
          </div>
        )}
      </div>

      <div id="doc2img-settings" className="space-y-4 lg:sticky lg:top-20 scroll-mt-20">
        <PanelCard title="Pengaturan Gambar" subtitle="Atur kualitas, format, dan bentuk hasil">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Resolusi (DPI)</p>
              <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Resolusi">
                {DPI_OPTIONS.map((o) => <Seg key={o.dpi} active={dpi === o.dpi} onClick={() => setDpi(o.dpi)} sub={o.sub}>{o.label}</Seg>)}
              </div>
              {estimate && <p className="text-[11px] text-slate-400 mt-1.5">≈ {estimate.w} × {estimate.h} px per halaman pertama</p>}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Format</p>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Format gambar">
                {FORMATS.map((f) => <Seg key={f.id} active={format === f.id} onClick={() => setFormat(f.id)} sub={f.sub}>{f.label}</Seg>)}
              </div>
            </div>
            {format !== "png" && (
              <div>
                <div className="flex justify-between mb-1"><p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Kualitas</p><span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{quality}%</span></div>
                <GamatoSlider min={50} max={100} value={quality} onChange={setQuality} aria-label="Kualitas gambar" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Bentuk Hasil</p>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Bentuk hasil">
                <Seg active={mode === "pages"} onClick={() => setMode("pages")} sub="Satu file per halaman (ZIP)"><span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" />Per Halaman</span></Seg>
                <Seg active={mode === "stitch"} onClick={() => setMode("stitch")} sub="Disambung ke bawah"><span className="inline-flex items-center gap-1"><GalleryVertical className="w-3 h-3" />Satu Gambar Panjang</span></Seg>
              </div>
              {mode === "stitch" && <div className="mt-2"><GamatoCheckbox checked={gap} onChange={setGap} label="Beri jarak abu-abu antar halaman" /></div>}
            </div>
            {effKind === "excel" && <GamatoCheckbox checked={gridlines} onChange={setGridlines} label="Tampilkan garis kisi sel" />}
          </div>
        </PanelCard>

        <Btn onClick={run} disabled={!session || !pickedIdx.length || !!busy} className="w-full py-3.5 text-base">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" />{busy.label} {busy.done}/{busy.total}…</> : <><Download className="w-4 h-4" />{mode === "stitch" ? "Unduh Gambar Panjang" : pickedIdx.length === 1 ? "Unduh Gambar" : `Unduh ${pickedIdx.length || ""} Gambar (ZIP)`}</>}
        </Btn>
        {busy && <div className="h-2 rounded-full bg-indigo-100 dark:bg-indigo-900 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${(busy.done / busy.total) * 100}%` }} /></div>}
        {info && <GamatoInlineAlert message={info.text} tone={info.tone === "error" ? "error" : "success"} />}

        <ToolInfoPanel icon={<FileImage className="w-5 h-5" />} label={ui.title} desc="Konversi dokumen jadi gambar" points={ui.points} />
      </div>
    </div>
  );
};
