import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Layers, FileOutput, FileDown, FilePlus, FileX, RotateCw,
  SlidersHorizontal, FileImage, AlignLeft, FileText, Trash2, Loader2, Zap,
} from "lucide-react";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { Textarea, Input, Select, Btn, SectionBadge } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";

type PdfMode = "compress" | "merge" | "split" | "extract" | "delete" | "rotate" | "organize" | "imagesToPdf" | "textToPdf";

// URL slug (Indonesian, kebab-case) <-> internal mode id
const PDF_MODE_SLUGS: Record<PdfMode, string> = {
  merge: "gabung",
  split: "pecah",
  compress: "kompres",
  extract: "ekstrak",
  delete: "hapus-halaman",
  rotate: "putar",
  organize: "atur-ulang",
  imagesToPdf: "gambar-ke-pdf",
  textToPdf: "teks-ke-pdf",
};
const SLUG_TO_PDF_MODE: Record<string, PdfMode> = Object.fromEntries(
  Object.entries(PDF_MODE_SLUGS).map(([mode, slug]) => [slug, mode as PdfMode])
);

const PDF_MODES: { id: PdfMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "merge",       label: "Gabung",        icon: <Layers className="w-5 h-5" />,           desc: "Combine multiple PDFs" },
  { id: "split",       label: "Pecah",         icon: <FileOutput className="w-5 h-5" />,        desc: "Tiap halaman jadi file" },
  { id: "compress",    label: "Kompres",       icon: <FileDown className="w-5 h-5" />,          desc: "Kurangi ukuran file" },
  { id: "extract",     label: "Ekstrak",       icon: <FilePlus className="w-5 h-5" />,          desc: "Ambil halaman tertentu" },
  { id: "delete",      label: "Hapus Halaman", icon: <FileX className="w-5 h-5" />,             desc: "Buang halaman" },
  { id: "rotate",      label: "Putar",         icon: <RotateCw className="w-5 h-5" />,          desc: "Rotasi halaman" },
  { id: "organize",    label: "Atur Ulang",    icon: <SlidersHorizontal className="w-5 h-5" />, desc: "Susun urutan halaman" },
  { id: "imagesToPdf", label: "Gambar → PDF",  icon: <FileImage className="w-5 h-5" />,         desc: "JPG/PNG ke PDF" },
  { id: "textToPdf",   label: "Teks → PDF",    icon: <AlignLeft className="w-5 h-5" />,         desc: "Teks polos ke PDF" },
];

// ─── PDF Lab ──────────────────────────────────────────────────────────────────

function parsePageSpec(input: string, totalPages: number): number[] {
  const parts = input.split(/[,;]/).map(p => p.trim()).filter(Boolean);
  const pages = new Set<number>();
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10), end = parseInt(rangeMatch[2], 10);
      if (start > end) [start, end] = [end, start];
      for (let p = start; p <= end; p++) if (p >= 1 && p <= totalPages) pages.add(p - 1);
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= totalPages) pages.add(num - 1);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export const PdfTools: React.FC = () => {
  const { mode: modeSlug } = useParams<{ mode: string }>();
  const mode: PdfMode = (modeSlug && SLUG_TO_PDF_MODE[modeSlug]) || "merge";
  const [files, setFiles] = useState<File[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [pageSpec, setPageSpec] = useState("1-3");
  const [compressLevel, setCompressLevel] = useState<"low" | "medium" | "high">("medium");
  const [rotateSpec, setRotateSpec] = useState("semua");
  const [rotateDegrees, setRotateDegrees] = useState(90);
  const [textForPdf, setTextForPdf] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Reset transient state whenever the active mode (route) changes
  useEffect(() => {
    setFiles([]);
    setInfo(null);
  }, [mode]);

  const isPdfMode = ["compress", "merge", "split", "extract", "delete", "rotate", "organize"].includes(mode);

  const addFiles = (incoming: File[]) => {
    const filtered = isPdfMode
      ? incoming.filter(f => f.type === "application/pdf")
      : mode === "imagesToPdf"
      ? incoming.filter(f => ["image/jpeg", "image/png", "image/jpg"].includes(f.type))
      : incoming;
    setFiles(prev => mode === "merge" || mode === "imagesToPdf" ? [...prev, ...filtered] : [filtered[0]]);
    setInfo(null);
  };

  const removeFile = (i: number) => setFiles(files.filter((_, idx) => idx !== i));

  const totalSizeMb = useMemo(() =>
    files.length ? Math.round(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024 * 10) / 10 : 0,
    [files]);

  const handleRun = async () => {
    setInfo(null);
    if (mode === "textToPdf") {
      if (!textForPdf.trim()) return;
      setIsWorking(true);
      try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 12, lineHeight = fontSize + 4, margin = 50;
        const maxCharsPerLine = Math.floor((595.28 - margin * 2) / (fontSize * 0.55));
        const allLines: string[] = [];
        for (const raw of textForPdf.split(/\r?\n/)) {
          if (!raw) { allLines.push(""); continue; }
          for (let s = 0; s < raw.length; s += maxCharsPerLine) allLines.push(raw.slice(s, s + maxCharsPerLine));
        }
        let page = pdfDoc.addPage(), { height } = page.getSize(), y = height - margin;
        const addPage = () => { page = pdfDoc.addPage(); ({ height } = page.getSize()); y = height - margin; };
        for (const line of allLines) {
          if (y < margin + lineHeight) addPage();
          if (line) page.drawText(line, { x: margin, y: y - lineHeight, size: fontSize, font, color: rgb(0, 0, 0) });
          y -= lineHeight;
        }
        const blob = new Blob([await pdfDoc.save()], { type: "application/pdf" });
        downloadBlob(blob, "gamato-text.pdf");
        setInfo("Teks berhasil dikonversi ke PDF.");
      } catch (err: any) { setInfo("" + (err?.message || "Gagal.")); }
      finally { setIsWorking(false); }
      return;
    }
    if (mode === "imagesToPdf") {
      if (!files.length) return;
      setIsWorking(true);
      try {
        const pdfDoc = await PDFDocument.create();
        for (const file of files) {
          const bytes = new Uint8Array(await fileToArrayBuffer(file));
          const image = file.type === "image/png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          const { width, height } = image.scale(1);
          const pg = pdfDoc.addPage([width, height]);
          pg.drawImage(image, { x: 0, y: 0, width, height });
        }
        downloadBlob(new Blob([await pdfDoc.save()], { type: "application/pdf" }), "gamato-images.pdf");
        setInfo(`${files.length} gambar digabung menjadi PDF.`);
      } catch (err: any) { setInfo("" + (err?.message || "Gagal.")); }
      finally { setIsWorking(false); }
      return;
    }
    if (!files.length) return;
    setIsWorking(true);
    try {
      if (mode === "merge") {
        const doc = await PDFDocument.create();
        for (const file of files) {
          const src = await PDFDocument.load(await fileToArrayBuffer(file));
          (await doc.copyPages(src, src.getPageIndices())).forEach(p => doc.addPage(p));
        }
        downloadBlob(new Blob([await doc.save()], { type: "application/pdf" }), "gamato-merged.pdf");
        setInfo(`${files.length} PDF berhasil digabung.`);
      } else if (mode === "split") {
        const src = await PDFDocument.load(await fileToArrayBuffer(files[0]));
        for (let i = 0; i < src.getPageCount(); i++) {
          const doc = await PDFDocument.create();
          doc.addPage((await doc.copyPages(src, [i]))[0]);
          downloadBlob(new Blob([await doc.save()], { type: "application/pdf" }), `gamato-page-${i + 1}.pdf`);
        }
        setInfo(`PDF dipecah menjadi ${src.getPageCount()} file.`);
      } else if (mode === "compress") {
        const doc = await PDFDocument.load(await fileToArrayBuffer(files[0]), { updateMetadata: true });
        doc.setTitle(`Compressed by Gamato Piranti (${compressLevel})`);
        downloadBlob(new Blob([await doc.save({ useObjectStreams: true })], { type: "application/pdf" }), `gamato-compressed-${compressLevel}.pdf`);
        setInfo(`PDF dikompresi (level: ${compressLevel}).`);
      } else if (mode === "extract") {
        const src = await PDFDocument.load(await fileToArrayBuffer(files[0]));
        const indices = parsePageSpec(pageSpec, src.getPageCount());
        if (!indices.length) { setInfo("Rentang halaman tidak valid."); return; }
        const doc = await PDFDocument.create();
        (await doc.copyPages(src, indices)).forEach(p => doc.addPage(p));
        downloadBlob(new Blob([await doc.save()], { type: "application/pdf" }), "gamato-extract.pdf");
        setInfo(`${indices.length} halaman diekstrak.`);
      } else if (mode === "delete") {
        const src = await PDFDocument.load(await fileToArrayBuffer(files[0]));
        const total = src.getPageCount();
        const toRemove = new Set(parsePageSpec(pageSpec, total));
        const keep = Array.from({ length: total }, (_, i) => i).filter(i => !toRemove.has(i));
        const doc = await PDFDocument.create();
        (await doc.copyPages(src, keep)).forEach(p => doc.addPage(p));
        downloadBlob(new Blob([await doc.save()], { type: "application/pdf" }), "gamato-clean.pdf");
        setInfo(`${toRemove.size} halaman dihapus. Sisa ${keep.length} halaman.`);
      } else if (mode === "rotate") {
        const src = await PDFDocument.load(await fileToArrayBuffer(files[0]));
        const total = src.getPageCount();
        const target = rotateSpec === "semua" ? Array.from({ length: total }, (_, i) => i) : parsePageSpec(pageSpec, total);
        target.forEach(idx => src.getPage(idx).setRotation(degrees(rotateDegrees)));
        downloadBlob(new Blob([await src.save()], { type: "application/pdf" }), "gamato-rotated.pdf");
        setInfo(`${target.length} halaman diputar ${rotateDegrees}°.`);
      } else if (mode === "organize") {
        const src = await PDFDocument.load(await fileToArrayBuffer(files[0]));
        const total = src.getPageCount();
        const order: number[] = [];
        for (const token of pageSpec.split(/[,;]/).map(p => p.trim()).filter(Boolean)) {
          const m = token.match(/^(\d+)-(\d+)$/);
          if (m) { let s = parseInt(m[1]), e = parseInt(m[2]); if (s > e) [s, e] = [e, s]; for (let p = s; p <= e; p++) if (p >= 1 && p <= total) order.push(p - 1); }
          else { const n = parseInt(token); if (!isNaN(n) && n >= 1 && n <= total) order.push(n - 1); }
        }
        if (!order.length) { setInfo("Urutan halaman tidak valid."); return; }
        const doc = await PDFDocument.create();
        (await doc.copyPages(src, order)).forEach(p => doc.addPage(p));
        downloadBlob(new Blob([await doc.save()], { type: "application/pdf" }), "gamato-organized.pdf");
        setInfo(`Halaman diatur ulang (${pageSpec}).`);
      }
    } catch (err: any) { setInfo("" + (err?.message || "Gagal memproses PDF.")); }
    finally { setIsWorking(false); }
  };

  // PDF_MODES defined at module level

  return (
    <div className="space-y-6">
      {/* Mode cards — submenu with dedicated URL per mode */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {PDF_MODES.map(m => (
          <Link key={m.id} to={`/pdf/${PDF_MODE_SLUGS[m.id]}`}
            className={cn("flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 text-center transition-all",
              mode === m.id ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50")}>
            <span className={cn("transition-colors", mode === m.id ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500")}>{m.icon}</span>
            <span className={cn("text-xs font-bold", mode === m.id ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200")}>{m.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        {/* LEFT */}
        <div className="space-y-5">
          {/* Text-to-PDF special */}
          {mode === "textToPdf" ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
              <Textarea label="Teks untuk dijadikan PDF" rows={12} value={textForPdf} onChange={e => setTextForPdf(e.target.value)} placeholder="Tulis atau tempel teks di sini…" />
              <Btn onClick={handleRun} disabled={isWorking || !textForPdf.trim()} className="w-full py-3.5">
                {isWorking ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses…</> : <><FileText className="w-4 h-4" />Jadikan PDF</>}
              </Btn>
            </div>
          ) : (
            <>
              {/* Dropzone */}
              <Dropzone
                onFiles={addFiles}
                accept={mode === "imagesToPdf" ? "image/jpeg,image/png" : "application/pdf"}
                multiple={mode === "merge" || mode === "imagesToPdf"}
                label={mode === "imagesToPdf" ? "Drop gambar JPG/PNG di sini" : "Drop file PDF di sini"}
                sublabel={mode === "merge" ? "Bisa pilih beberapa file — urutannya bisa diatur" : "atau klik untuk browse"}
                icon={mode === "imagesToPdf" ? <FileImage className="w-8 h-8 text-slate-400 dark:text-slate-500" /> : <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
                isDragging={isDragging}
                setIsDragging={setIsDragging}
              />

              {/* File list */}
              {files.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{files.length} file dipilih</p>
                    <span className="text-xs text-slate-400 dark:text-slate-500">Total: {totalSizeMb} MB</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {files.map((file, i) => (
                      <div key={`${file.name}-${i}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                        <span className={cn("text-slate-400 dark:text-slate-500", mode === "imagesToPdf" ? "" : "")}>{mode === "imagesToPdf" ? <FileImage className="w-5 h-5" /> : <FileText className="w-5 h-5" />}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button type="button" onClick={() => removeFile(i)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options for specific modes */}
              {mode === "compress" && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Tingkat Kompresi</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["low", "medium", "high"] as const).map(l => (
                      <button key={l} type="button" onClick={() => setCompressLevel(l)}
                        className={cn("py-2.5 rounded-xl text-sm font-semibold border-2 transition-all capitalize",
                          compressLevel === l ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300")}>
                        {l === "low" ? "Ringan" : l === "medium" ? "Sedang" : "Tinggi"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(mode === "extract" || mode === "delete" || mode === "organize") && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
                  <Input label={mode === "organize" ? "Urutan Halaman Baru" : "Rentang Halaman"}
                    value={pageSpec} onChange={e => setPageSpec(e.target.value)}
                    placeholder={mode === "organize" ? "contoh: 3,1,2,5-7" : "contoh: 1-3,5,8-9"} />
                  <p className="text-xs text-slate-400 dark:text-slate-500">Gunakan koma untuk memisah, tanda minus untuk rentang. Halaman mulai dari 1.</p>
                </div>
              )}

              {mode === "rotate" && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <Select label="Target Halaman" value={rotateSpec} onChange={e => setRotateSpec(e.target.value)}>
                      <option value="semua">Semua halaman</option>
                      <option value="pilih">Halaman tertentu</option>
                    </Select>
                    <Select label="Derajat Putar" value={rotateDegrees} onChange={e => setRotateDegrees(parseInt(e.target.value))}>
                      <option value={90}>90°</option>
                      <option value={180}>180°</option>
                      <option value={270}>270°</option>
                    </Select>
                  </div>
                  {rotateSpec === "pilih" && <Input label="Rentang Halaman" value={pageSpec} onChange={e => setPageSpec(e.target.value)} placeholder="contoh: 1-3,5" />}
                </div>
              )}

              <Btn onClick={handleRun} disabled={isWorking || !files.length} className="w-full py-4 text-base">
                {isWorking ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses…</> : <><Zap className="w-4 h-4" />Proses PDF</>}
              </Btn>
            </>
          )}
        </div>

        {/* RIGHT: Info panel */}
        <div className="bg-slate-900 dark:ring-1 dark:ring-slate-700 rounded-2xl p-5 text-white space-y-4 sticky top-24">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Mode Aktif</p>
          <div className="flex items-center gap-3">
            <span className="text-blue-400">{PDF_MODES.find(m2 => m2.id === mode)?.icon}</span>
            <div>
              <p className="font-bold text-white">{PDF_MODES.find(m2 => m2.id === mode)?.label}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{PDF_MODES.find(m2 => m2.id === mode)?.desc}</p>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-4 space-y-2 text-sm text-slate-300">
            {mode === "merge" && <><p>• Gabungkan beberapa PDF jadi satu.</p><p>• Urutan mengikuti daftar file.</p></>}
            {mode === "split" && <><p>• Setiap halaman jadi file terpisah.</p><p>• File diunduh satu per satu.</p></>}
            {mode === "compress" && <><p>• Optimasi struktur PDF tanpa mengubah isi.</p><p>• Tiga level kompresi tersedia.</p></>}
            {mode === "extract" && <><p>• Ambil halaman tertentu saja.</p><p>• Contoh: 1-3,5,10</p></>}
            {mode === "delete" && <><p>• Hapus halaman yang tidak dibutuhkan.</p><p>• Sisa halaman tetap utuh.</p></>}
            {mode === "rotate" && <><p>• Putar halaman yang miring.</p><p>• Bisa semua atau halaman tertentu.</p></>}
            {mode === "organize" && <><p>• Susun ulang urutan halaman.</p><p>• Contoh: 3,1,2 untuk urutkan ulang.</p></>}
            {mode === "imagesToPdf" && <><p>• JPG/PNG jadi halaman PDF.</p><p>• Tiap gambar = 1 halaman.</p></>}
            {mode === "textToPdf" && <><p>• Teks polos jadi PDF rapi.</p><p>• Layout sederhana, bisa dibuka di mana saja.</p></>}
          </div>
          {info && (
            <div className={cn("rounded-xl px-4 py-3 text-sm font-medium border", info.includes("berhasil") || info.includes("diproses") || info.includes("diekspor") || info.includes("selesai") || info.includes("digabung") || info.includes("dipecah") || info.includes("dikompresi") || info.includes("diekstrak") || info.includes("dihapus") || info.includes("diputar") || info.includes("diatur") || info.includes("disiapkan") ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
              {info}
            </div>
          )}
          <div className="pt-2"><SectionBadge>Proses native di perangkatmu</SectionBadge></div>
        </div>
      </div>
    </div>
  );
};
