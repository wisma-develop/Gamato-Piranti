// ─── Conversion dispatch table ──────────────────────────────────────────────
// Maps every (source, target) format pair the registry declares to the
// actual converter function that performs it. Kept separate from the UI
// component so the dispatch logic itself is easy to scan and verify against
// `formatRegistry.ts`.
import { convertDataFormat, type DataFormat } from "./converters/dataFormats";
import {
  txtToDocx, txtToPdf, markdownToDocx, markdownToPdf, markdownToHtmlBlob,
  htmlToPlainText, htmlToPng, htmlToPdf, docxToTxt, docxToPdf, rtfToTxt,
  rtfToDocx, pdfToTxt, pdfToImagesZip, markdownToPlainLines,
} from "./converters/documentConvert";
import { convertImage, type ImageOutputFormat } from "./converters/imageConvert";
import { csvToXlsx, xlsxToCsv, xlsxToPdf } from "./converters/sheetConvert";
import { audioFileToWav } from "./converters/audioConvert";
import { convertVideoFile, extractAudioFromVideoFile, getVideoOutputExt } from "./converters/videoConvert";
import { filesToZip } from "./converters/archiveConvert";

export interface ConvertOutput {
  blob: Blob;
  filename: string;
}

export interface ConvertContext {
  title: string;
  onProgress?: (pct: number) => void;
}

const DATA_FORMATS = new Set<DataFormat>(["json", "csv", "tsv", "xml", "yaml"]);
const IMAGE_FORMATS = new Set(["png", "jpg", "webp", "bmp", "gif", "svg", "ico"]);
const IMAGE_TARGETS = new Set<ImageOutputFormat>(["png", "jpg", "webp", "bmp", "ico", "pdf"]);

function withExt(base: string, ext: string): string {
  return `${base}.${ext}`;
}

/** Text-based conversion: input and output are both plain text/blob-of-text. Used for the "paste text" mode. */
export async function convertText(text: string, source: string, target: string, ctx: ConvertContext): Promise<ConvertOutput> {
  const { title } = ctx;

  if (DATA_FORMATS.has(source as DataFormat) && DATA_FORMATS.has(target as DataFormat)) {
    const out = convertDataFormat(text, source as DataFormat, target as DataFormat);
    const mime = target === "json" ? "application/json" : target === "xml" ? "application/xml" : target === "yaml" ? "application/x-yaml" : "text/plain";
    return { blob: new Blob([out], { type: `${mime};charset=utf-8` }), filename: withExt(title, target) };
  }

  if (source === "txt" && target === "md") return { blob: new Blob([text], { type: "text/markdown;charset=utf-8" }), filename: withExt(title, "md") };
  if (source === "txt" && target === "html") {
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><pre style="font-family:inherit;white-space:pre-wrap;">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre></body></html>`;
    return { blob: new Blob([html], { type: "text/html;charset=utf-8" }), filename: withExt(title, "html") };
  }
  if (source === "txt" && target === "docx") return { blob: await txtToDocx(text, title), filename: withExt(title, "docx") };
  if (source === "txt" && target === "pdf") return { blob: await txtToPdf(text, title), filename: withExt(title, "pdf") };

  if (source === "md" && target === "txt") return { blob: new Blob([markdownToPlainLines(text).join("\n")], { type: "text/plain;charset=utf-8" }), filename: withExt(title, "txt") };
  if (source === "md" && target === "html") return { blob: await markdownToHtmlBlob(text), filename: withExt(title, "html") };
  if (source === "md" && target === "docx") return { blob: await markdownToDocx(text, title), filename: withExt(title, "docx") };
  if (source === "md" && target === "pdf") return { blob: await markdownToPdf(text, title), filename: withExt(title, "pdf") };

  if (source === "html" && target === "txt") return { blob: new Blob([await htmlToPlainText(text)], { type: "text/plain;charset=utf-8" }), filename: withExt(title, "txt") };
  if (source === "html" && target === "pdf") return { blob: await htmlToPdf(text, title), filename: withExt(title, "pdf") };
  if (source === "html" && target === "png") return { blob: await htmlToPng(text), filename: withExt(title, "png") };

  if (source === "csv" && target === "xlsx") return { blob: await csvToXlsx(text), filename: withExt(title, "xlsx") };

  throw new Error(`Kombinasi ${source} → ${target} belum didukung dalam mode teks.`);
}

/** File-based conversion: input is an uploaded File. */
export async function convertFile(file: File, source: string, target: string, ctx: ConvertContext): Promise<ConvertOutput> {
  const { title, onProgress } = ctx;

  if (IMAGE_FORMATS.has(source) && IMAGE_TARGETS.has(target as ImageOutputFormat)) {
    const blob = await convertImage(file, target as ImageOutputFormat);
    return { blob, filename: withExt(title, target === "jpg" ? "jpg" : target) };
  }

  if (source === "docx" && target === "txt") return { blob: new Blob([await docxToTxt(file)], { type: "text/plain;charset=utf-8" }), filename: withExt(title, "txt") };
  if (source === "docx" && target === "pdf") return { blob: await docxToPdf(file, title), filename: withExt(title, "pdf") };

  if (source === "rtf" && target === "txt") return { blob: new Blob([await rtfToTxt(file)], { type: "text/plain;charset=utf-8" }), filename: withExt(title, "txt") };
  if (source === "rtf" && target === "docx") return { blob: await rtfToDocx(file, title), filename: withExt(title, "docx") };

  if (source === "pdf" && target === "txt") return { blob: new Blob([await pdfToTxt(file)], { type: "text/plain;charset=utf-8" }), filename: withExt(title, "txt") };
  if (source === "pdf" && target === "png") return { blob: await pdfToImagesZip(file, title), filename: withExt(title, "zip") };

  if (source === "xlsx" && target === "csv") return { blob: new Blob([await xlsxToCsv(file)], { type: "text/csv;charset=utf-8" }), filename: withExt(title, "csv") };
  if (source === "xlsx" && target === "pdf") return { blob: await xlsxToPdf(file, title), filename: withExt(title, "pdf") };

  if (source === "audio" && target === "wav") return { blob: await audioFileToWav(file), filename: withExt(title, "wav") };

  if (source === "video" && target === "videoOut") {
    const blob = await convertVideoFile(file, onProgress);
    return { blob, filename: withExt(title, getVideoOutputExt()) };
  }
  if (source === "video" && target === "audio") {
    const blob = await extractAudioFromVideoFile(file, onProgress);
    return { blob, filename: withExt(title, blob.type.includes("ogg") ? "ogg" : "webm") };
  }

  throw new Error(`Kombinasi ${source} → ${target} belum didukung.`);
}

export async function convertFilesToZip(files: File[], title: string): Promise<ConvertOutput> {
  return { blob: await filesToZip(files), filename: withExt(title, "zip") };
}
