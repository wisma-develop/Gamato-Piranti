// ─── Universal Converter — conversion dispatcher ────────────────────────────
import { FORMATS } from "./formatRegistry";
import { convertDataFormat, type DataFormat } from "./converters/dataFormats";
import { convertImage, type ImageOutputFormat } from "./converters/imageConvert";
import {
  markdownToDocx, markdownToPdf, markdownToHtmlBlob, markdownToHtmlString,
  htmlToPlainText, htmlToPng, htmlToPdf, htmlToDocx, htmlToMarkdown,
  txtToDocx, txtToPdf,
  docxToTxt, docxToPdf, docxToHtmlBlob, docxToMarkdown,
  rtfToTxt, rtfToDocx, rtfToPdf,
  pdfToTxt, pdfToDocx, pdfToMarkdown, pdfToImagesZip,
} from "./converters/documentConvert";
import { xlsxToCsv, xlsxToPdf, xlsxToJson, xlsxToTsv, dataTextToXlsx, dataTextToPdfTable, pdfToXlsx } from "./converters/sheetConvert";
import { audioFileToWav, audioFileToCompressed } from "./converters/audioConvert";
import { convertVideoFile, extractAudioFromVideoFile, videoToGifFile, getVideoOutputExt } from "./converters/videoConvert";
import { filesToZip } from "./converters/archiveConvert";

const DATA_FORMATS = new Set(["json", "csv", "tsv", "xml", "yaml"]);
const IMAGE_FORMATS = new Set(["png", "jpg", "webp", "bmp", "gif", "svg", "ico"]);

export interface ConvertOutput {
  blob: Blob;
  filename: string;
}

function withExt(base: string, ext: string): string {
  const clean = (base || "hasil-konversi").replace(/\.[^.]+$/, "");
  return `${clean}.${ext}`;
}

function textBlob(text: string, mime = "text/plain"): Blob {
  return new Blob([text], { type: `${mime};charset=utf-8` });
}

async function fileToText(file: File): Promise<string> {
  return file.text();
}

async function convertFromDataFormatText(text: string, source: DataFormat, target: string, title: string): Promise<ConvertOutput> {
  if (DATA_FORMATS.has(target)) {
    const out = convertDataFormat(text, source, target as DataFormat);
    return { blob: textBlob(out, FORMATS[target]?.mime), filename: withExt(title, target) };
  }
  if (target === "xlsx") return { blob: await dataTextToXlsx(text, source), filename: withExt(title, "xlsx") };
  if (target === "pdf") return { blob: await dataTextToPdfTable(text, source, title), filename: withExt(title, "pdf") };
  throw new Error(`Kombinasi ${source} → ${target} belum didukung.`);
}

export async function convertText(text: string, source: string, target: string, opts: { title?: string } = {}): Promise<ConvertOutput> {
  const title = opts.title || "hasil-konversi";

  if (DATA_FORMATS.has(source)) {
    return convertFromDataFormatText(text, source as DataFormat, target, title);
  }

  if (source === "md") {
    if (target === "html") return { blob: await markdownToHtmlBlob(text), filename: withExt(title, "html") };
    if (target === "docx") return { blob: await markdownToDocx(text, title), filename: withExt(title, "docx") };
    if (target === "pdf") return { blob: await markdownToPdf(text, title), filename: withExt(title, "pdf") };
    if (target === "txt") return { blob: textBlob(await htmlToPlainText(markdownToHtmlString(text))), filename: withExt(title, "txt") };
  }

  if (source === "html") {
    if (target === "txt") return { blob: textBlob(await htmlToPlainText(text)), filename: withExt(title, "txt") };
    if (target === "pdf") return { blob: await htmlToPdf(text, title), filename: withExt(title, "pdf") };
    if (target === "png") return { blob: await htmlToPng(text), filename: withExt(title, "png") };
    if (target === "docx") return { blob: await htmlToDocx(text, title), filename: withExt(title, "docx") };
    if (target === "md") return { blob: textBlob(await htmlToMarkdown(text), "text/markdown"), filename: withExt(title, "md") };
  }

  if (source === "txt") {
    if (target === "md") return { blob: textBlob(text, "text/markdown"), filename: withExt(title, "md") };
    if (target === "docx") return { blob: await txtToDocx(text, title), filename: withExt(title, "docx") };
    if (target === "pdf") return { blob: await txtToPdf(text, title), filename: withExt(title, "pdf") };
    if (target === "html") return { blob: await markdownToHtmlBlob(text), filename: withExt(title, "html") };
  }

  throw new Error(`Kombinasi ${source} → ${target} belum didukung dalam mode teks.`);
}

export async function convertFile(
  file: File,
  source: string,
  target: string,
  opts: { title?: string; onProgress?: (pct: number) => void } = {}
): Promise<ConvertOutput> {
  const title = opts.title || "hasil-konversi";

  if (DATA_FORMATS.has(source)) {
    const text = await fileToText(file);
    return convertFromDataFormatText(text, source as DataFormat, target, title);
  }

  if (IMAGE_FORMATS.has(source)) {
    const blob = await convertImage(file, target as ImageOutputFormat);
    return { blob, filename: withExt(title, target) };
  }

  if (source === "xlsx") {
    if (target === "csv") return { blob: textBlob(await xlsxToCsv(file), "text/csv"), filename: withExt(title, "csv") };
    if (target === "tsv") return { blob: textBlob(await xlsxToTsv(file), "text/tab-separated-values"), filename: withExt(title, "tsv") };
    if (target === "json") return { blob: textBlob(await xlsxToJson(file), "application/json"), filename: withExt(title, "json") };
    if (target === "pdf") return { blob: await xlsxToPdf(file, title), filename: withExt(title, "pdf") };
  }

  if (source === "txt") {
    const text = await fileToText(file);
    if (target === "md") return { blob: textBlob(text, "text/markdown"), filename: withExt(title, "md") };
    if (target === "docx") return { blob: await txtToDocx(text, title), filename: withExt(title, "docx") };
    if (target === "pdf") return { blob: await txtToPdf(text, title), filename: withExt(title, "pdf") };
    if (target === "html") return { blob: await markdownToHtmlBlob(text), filename: withExt(title, "html") };
  }
  if (source === "md") {
    const text = await fileToText(file);
    if (target === "html") return { blob: await markdownToHtmlBlob(text), filename: withExt(title, "html") };
    if (target === "docx") return { blob: await markdownToDocx(text, title), filename: withExt(title, "docx") };
    if (target === "pdf") return { blob: await markdownToPdf(text, title), filename: withExt(title, "pdf") };
    if (target === "txt") return { blob: textBlob(await htmlToPlainText(markdownToHtmlString(text))), filename: withExt(title, "txt") };
  }
  if (source === "html") {
    const text = await fileToText(file);
    if (target === "txt") return { blob: textBlob(await htmlToPlainText(text)), filename: withExt(title, "txt") };
    if (target === "pdf") return { blob: await htmlToPdf(text, title), filename: withExt(title, "pdf") };
    if (target === "png") return { blob: await htmlToPng(text), filename: withExt(title, "png") };
    if (target === "docx") return { blob: await htmlToDocx(text, title), filename: withExt(title, "docx") };
    if (target === "md") return { blob: textBlob(await htmlToMarkdown(text), "text/markdown"), filename: withExt(title, "md") };
  }
  if (source === "docx") {
    if (target === "txt") return { blob: textBlob(await docxToTxt(file)), filename: withExt(title, "txt") };
    if (target === "pdf") return { blob: await docxToPdf(file, title), filename: withExt(title, "pdf") };
    if (target === "html") return { blob: await docxToHtmlBlob(file), filename: withExt(title, "html") };
    if (target === "md") return { blob: textBlob(await docxToMarkdown(file), "text/markdown"), filename: withExt(title, "md") };
  }
  if (source === "rtf") {
    if (target === "txt") return { blob: textBlob(await rtfToTxt(file)), filename: withExt(title, "txt") };
    if (target === "docx") return { blob: await rtfToDocx(file, title), filename: withExt(title, "docx") };
    if (target === "pdf") return { blob: await rtfToPdf(file, title), filename: withExt(title, "pdf") };
  }
  if (source === "pdf") {
    if (target === "txt") return { blob: textBlob(await pdfToTxt(file)), filename: withExt(title, "txt") };
    if (target === "md") return { blob: textBlob(await pdfToMarkdown(file), "text/markdown"), filename: withExt(title, "md") };
    if (target === "docx") return { blob: await pdfToDocx(file, title), filename: withExt(title, "docx") };
    if (target === "xlsx") return { blob: await pdfToXlsx(file), filename: withExt(title, "xlsx") };
    if (target === "png") return { blob: await pdfToImagesZip(file, title, "png"), filename: withExt(title, "zip") };
    if (target === "jpg") return { blob: await pdfToImagesZip(file, title, "jpeg"), filename: withExt(title, "zip") };
  }

  if (source === "audio" || source === "wav") {
    if (target === "wav") return { blob: await audioFileToWav(file), filename: withExt(title, "wav") };
    if (target === "audioOut") {
      const blob = await audioFileToCompressed(file, opts.onProgress);
      const ext = blob.type.includes("ogg") ? "ogg" : "webm";
      return { blob, filename: withExt(title, ext) };
    }
  }

  if (source === "video") {
    if (target === "videoOut") {
      const blob = await convertVideoFile(file, opts.onProgress);
      return { blob, filename: withExt(title, getVideoOutputExt()) };
    }
    if (target === "audio") {
      const blob = await extractAudioFromVideoFile(file, opts.onProgress);
      const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") || blob.type.includes("m4a") ? "m4a" : "webm";
      return { blob, filename: withExt(title, ext) };
    }
    if (target === "videoGif") {
      const blob = await videoToGifFile(file, opts.onProgress);
      return { blob, filename: withExt(title, "gif") };
    }
  }

  throw new Error(`Kombinasi ${source} → ${target} belum didukung.`);
}

export async function convertFilesToZip(files: File[], title: string): Promise<ConvertOutput> {
  if (!files.length) throw new Error("Pilih setidaknya satu file untuk digabung ke ZIP.");
  const blob = await filesToZip(files);
  return { blob, filename: withExt(title || "berkas-gamato-piranti", "zip") };
}
