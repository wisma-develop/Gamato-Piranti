// Turns any supported file into a list of printable pages (PrintPageSource).
// Documents (DOCX/XLSX/PPTX/CSV/TXT…) are first converted to PDF with the app's
// own converters (without the Gamato branding stamp — this is YOUR document)
// and then rendered with pdf.js, so every non-image source is handled uniformly.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { loadPdfDocument } from "@/lib/pdfRender";
import { readDocxBlocks, readXlsxGrid, readPptxSlides, readRtfText } from "@/lib/officeReaders";
import { exportPdfFromBlocks } from "@/features/docs/richtext/exportPdf";
import { gridToPdfBlob } from "@/lib/pdfTable";
import { slidesToPdfBlob } from "@/lib/pdfSlides";
import { parseCsv } from "@/lib/csv";
import { toWinAnsi } from "@/lib/transcriptDocs";
import type { PrintPageSource } from "@/lib/printEngine";

export interface TextOptions {
  family: "mono" | "sans" | "serif";
  size: number; // pt
  lineHeight: number; // multiplier
  lineNumbers: boolean;
  margin: number; // mm
}

export const DEFAULT_TEXT_OPTIONS: TextOptions = { family: "mono", size: 10, lineHeight: 1.3, lineNumbers: false, margin: 18 };

export interface LoadedSource {
  id: string;
  name: string;
  kind: "pdf" | "image" | "text" | "docx" | "xlsx" | "pptx" | "csv";
  pages: PrintPageSource[];
  note?: string;
  text?: string; // raw text (text-like sources) so the layout can be rebuilt
  dispose(): void;
}

const PT_TO_MM = 25.4 / 72;
let seq = 0;
const nid = () => `src${Date.now().toString(36)}${(seq++).toString(36)}`;

const ext = (n: string) => (n.split(".").pop() || "").toLowerCase();

export const TEXT_EXTS = ["txt", "md", "markdown", "log", "json", "xml", "yml", "yaml", "ini", "cfg", "conf", "js", "jsx", "ts", "tsx", "py", "java", "c", "h", "cpp", "cs", "php", "rb", "go", "rs", "sh", "sql", "css", "html", "htm", "tex", "srt", "vtt"];
export const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg", "avif", "ico"];
export const ACCEPT = ".pdf,.docx,.xlsx,.pptx,.csv,.rtf,image/*," + TEXT_EXTS.map((e) => "." + e).join(",");

/* ───────────────────────────── PDF ───────────────────────────── */

async function sourceFromPdfBytes(bytes: ArrayBuffer, name: string, kind: LoadedSource["kind"], extra: Partial<LoadedSource> = {}): Promise<LoadedSource> {
  let pdf: any;
  try {
    pdf = await loadPdfDocument(bytes.slice(0));
  } catch (e: any) {
    if (e?.name === "PasswordException") throw new Error(`"${name}" dilindungi kata sandi. Buka kuncinya dulu (mis. lewat tool PDF Lab) lalu coba lagi.`);
    throw new Error(`"${name}" bukan PDF yang valid atau rusak.`);
  }
  const pages: PrintPageSource[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const cache = new Map<number, HTMLCanvasElement>();
    pages.push({
      ref: { id: `${name}#${i}`, wMm: vp.width * PT_TO_MM, hMm: vp.height * PT_TO_MM, label: `${name} · hal. ${i}` },
      async render(widthPx: number) {
        const w = Math.max(8, Math.round(widthPx));
        const hit = cache.get(w);
        if (hit) return hit;
        const scale = w / vp.width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cache.size > 6) cache.delete(cache.keys().next().value as number);
        cache.set(w, canvas);
        return canvas;
      },
    });
  }
  return { id: nid(), name, kind, pages, dispose: () => { try { pdf.destroy(); } catch { /* noop */ } }, ...extra };
}

/* ───────────────────────────── images ───────────────────────────── */

async function sourceFromImage(file: File): Promise<LoadedSource> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`"${file.name}" bukan gambar yang bisa dibaca browser.`);
  }
  let nw = img.naturalWidth || 800;
  let nh = img.naturalHeight || 600;
  if (!img.naturalWidth) { nw = 800; nh = 600; }
  const mmPerPx = 25.4 / 96;
  const cache = new Map<number, HTMLCanvasElement>();
  const page: PrintPageSource = {
    ref: { id: file.name, wMm: nw * mmPerPx, hMm: nh * mmPerPx, label: file.name },
    async render(widthPx: number) {
      const w = Math.max(8, Math.min(Math.round(widthPx), 6000));
      const hit = cache.get(w);
      if (hit) return hit;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = Math.max(1, Math.round((w * nh) / nw));
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff"; // transparent PNG/SVG print on white paper
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (cache.size > 4) cache.delete(cache.keys().next().value as number);
      cache.set(w, canvas);
      return canvas;
    },
  };
  return { id: nid(), name: file.name, kind: "image", pages: [page], dispose: () => URL.revokeObjectURL(url) };
}

/* ───────────────────────────── text → PDF ───────────────────────────── */

export async function textToPdfBytes(text: string, title: string, o: TextOptions): Promise<{ bytes: ArrayBuffer; lossy: boolean }> {
  const { text: safe, lossy } = toWinAnsi(text.replace(/\r\n?/g, "\n").replace(/\t/g, "    "));
  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(title).text);
  const font = await pdf.embedFont(o.family === "mono" ? StandardFonts.Courier : o.family === "serif" ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const PW = 595.28;
  const PH = 841.89;
  const M = o.margin / PT_TO_MM;
  const size = o.size;
  const lh = size * o.lineHeight;
  const numW = o.lineNumbers ? font.widthOfTextAtSize("0000 ", size) : 0;
  const maxW = PW - M * 2 - numW;
  let page = pdf.addPage([PW, PH]);
  let y = PH - M;
  const newPage = () => { page = pdf.addPage([PW, PH]); y = PH - M; };
  let lineNo = 0;
  for (const raw of safe.split("\n")) {
    lineNo++;
    // wrap
    const rows: string[] = [];
    if (!raw) rows.push("");
    else {
      let cur = "";
      for (const word of raw.split(/(\s+)/)) {
        if (font.widthOfTextAtSize(cur + word, size) <= maxW) cur += word;
        else if (!cur) {
          // single token wider than the line → hard break
          let chunk = "";
          for (const ch of word) { if (font.widthOfTextAtSize(chunk + ch, size) > maxW) { rows.push(chunk); chunk = ch; } else chunk += ch; }
          cur = chunk;
        } else { rows.push(cur.replace(/\s+$/, "")); cur = word.replace(/^\s+/, ""); }
      }
      rows.push(cur);
    }
    rows.forEach((r, i) => {
      if (y - lh < M) newPage();
      if (o.lineNumbers && i === 0) page.drawText(String(lineNo).padStart(4, " "), { x: M, y: y - size, size, font, color: rgb(0.55, 0.6, 0.68) });
      if (r) page.drawText(r, { x: M + numW, y: y - size, size, font, color: rgb(0.05, 0.07, 0.12) });
      y -= lh;
    });
  }
  const out = await pdf.save();
  return { bytes: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer, lossy };
}

export async function buildTextSource(name: string, text: string, o: TextOptions, kind: LoadedSource["kind"] = "text"): Promise<LoadedSource> {
  const { bytes, lossy } = await textToPdfBytes(text, name, o);
  return sourceFromPdfBytes(bytes, name, kind, {
    text,
    note: lossy ? "Sebagian karakter non-Latin diganti “?” (font cetak standar hanya mendukung aksara Latin)." : undefined,
  });
}

/* ───────────────────────────── dispatcher ───────────────────────────── */

export async function loadPrintSource(file: File, textOpts: TextOptions): Promise<LoadedSource> {
  const e = ext(file.name);
  const title = file.name.replace(/\.[^.]+$/, "");
  if (e === "pdf" || file.type === "application/pdf") return sourceFromPdfBytes(await file.arrayBuffer(), file.name, "pdf");
  if (file.type.startsWith("image/") || IMAGE_EXTS.includes(e)) return sourceFromImage(file);
  if (e === "docx") {
    const blocks = await readDocxBlocks(file);
    const blob = await exportPdfFromBlocks(blocks, title, { branding: false });
    return sourceFromPdfBytes(await blob.arrayBuffer(), file.name, "docx", { note: "DOCX dirender sederhana (teks, tebal/miring, rata). Gambar & tabel di dalam DOCX tidak ikut — untuk tata letak persis, simpan dokumen sebagai PDF dari Word lalu cetak PDF-nya." });
  }
  if (e === "xlsx") {
    const grid = await readXlsxGrid(file);
    const blob = await gridToPdfBlob(grid, title, { branding: false });
    return sourceFromPdfBytes(await blob.arrayBuffer(), file.name, "xlsx", { note: "Hanya lembar pertama yang dicetak, sebagai tabel (nilai sel, tanpa format/warna Excel)." });
  }
  if (e === "pptx") {
    const slides = await readPptxSlides(file);
    const blob = await slidesToPdfBlob(slides, title, { branding: false });
    return sourceFromPdfBytes(await blob.arrayBuffer(), file.name, "pptx", { note: "Slide dicetak sebagai teks judul + poin (tanpa gambar/desain). Untuk tampilan asli, ekspor PPTX ke PDF dari PowerPoint." });
  }
  if (e === "csv") {
    const grid = parseCsv(await file.text());
    const blob = await gridToPdfBlob(grid, title, { branding: false });
    return sourceFromPdfBytes(await blob.arrayBuffer(), file.name, "csv");
  }
  if (e === "rtf") return buildTextSource(file.name, await readRtfText(file), { ...textOpts, family: "sans" }, "text");
  if (TEXT_EXTS.includes(e) || file.type.startsWith("text/")) return buildTextSource(file.name, await file.text(), textOpts);
  throw new Error(`Format "${e || file.type || "?"}" belum didukung. Didukung: PDF, gambar, DOCX, XLSX, PPTX, CSV, RTF, TXT/MD & berkas kode.`);
}
