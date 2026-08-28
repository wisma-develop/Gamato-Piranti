// ─── Universal Converter — format registry ─────────────────────────────────
// Single source of truth for every format the converter understands: its
// display label, category, file extension/MIME, and which OTHER formats it
// can legitimately convert to. The UI is entirely driven by this table so
// it never offers a conversion pair that isn't real.
import type { LucideIcon } from "lucide-react";
import {
  FileJson, FileSpreadsheet, FileCode2, FileText, Image as ImageIcon,
  FileArchive, FileAudio, FileType, Braces, File as FileIcon,
} from "lucide-react";

export type FormatCategory = "data" | "image" | "document" | "spreadsheet" | "audio" | "archive";

export interface FormatDef {
  id: string;
  label: string;
  category: FormatCategory;
  extensions: string[];
  mime?: string;
  icon: LucideIcon;
  /** Format ids this one can be converted TO. */
  targets: string[];
}

export const FORMATS: Record<string, FormatDef> = {
  // ── Data / text-structured formats ──
  json: { id: "json", label: "JSON", category: "data", extensions: ["json"], mime: "application/json", icon: FileJson, targets: ["csv", "tsv", "xml", "yaml"] },
  csv: { id: "csv", label: "CSV", category: "data", extensions: ["csv"], mime: "text/csv", icon: FileSpreadsheet, targets: ["json", "tsv", "xml", "yaml", "xlsx"] },
  tsv: { id: "tsv", label: "TSV", category: "data", extensions: ["tsv"], mime: "text/tab-separated-values", icon: FileSpreadsheet, targets: ["json", "csv", "xml", "yaml"] },
  xml: { id: "xml", label: "XML", category: "data", extensions: ["xml"], mime: "application/xml", icon: FileCode2, targets: ["json", "csv", "tsv", "yaml"] },
  yaml: { id: "yaml", label: "YAML", category: "data", extensions: ["yaml", "yml"], mime: "application/x-yaml", icon: Braces, targets: ["json", "csv", "tsv", "xml"] },

  // ── Spreadsheet ──
  xlsx: { id: "xlsx", label: "Excel (.xlsx)", category: "spreadsheet", extensions: ["xlsx"], mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: FileSpreadsheet, targets: ["csv", "pdf"] },

  // ── Documents ──
  txt: { id: "txt", label: "Teks (.txt)", category: "document", extensions: ["txt"], mime: "text/plain", icon: FileText, targets: ["md", "docx", "pdf", "html"] },
  md: { id: "md", label: "Markdown (.md)", category: "document", extensions: ["md", "markdown"], mime: "text/markdown", icon: FileText, targets: ["txt", "html", "docx", "pdf"] },
  html: { id: "html", label: "HTML", category: "document", extensions: ["html", "htm"], mime: "text/html", icon: FileCode2, targets: ["txt", "pdf", "png"] },
  docx: { id: "docx", label: "Word (.docx)", category: "document", extensions: ["docx"], mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", icon: FileType, targets: ["txt", "pdf"] },
  rtf: { id: "rtf", label: "RTF", category: "document", extensions: ["rtf"], mime: "application/rtf", icon: FileType, targets: ["txt", "docx"] },
  pdf: { id: "pdf", label: "PDF", category: "document", extensions: ["pdf"], mime: "application/pdf", icon: FileText, targets: ["txt", "png"] },

  // ── Images ──
  png: { id: "png", label: "PNG", category: "image", extensions: ["png"], mime: "image/png", icon: ImageIcon, targets: ["jpg", "webp", "bmp", "pdf"] },
  jpg: { id: "jpg", label: "JPG", category: "image", extensions: ["jpg", "jpeg"], mime: "image/jpeg", icon: ImageIcon, targets: ["png", "webp", "bmp", "pdf"] },
  webp: { id: "webp", label: "WEBP", category: "image", extensions: ["webp"], mime: "image/webp", icon: ImageIcon, targets: ["png", "jpg", "bmp", "pdf"] },
  bmp: { id: "bmp", label: "BMP", category: "image", extensions: ["bmp"], mime: "image/bmp", icon: ImageIcon, targets: ["png", "jpg", "webp", "pdf"] },
  gif: { id: "gif", label: "GIF (frame pertama)", category: "image", extensions: ["gif"], mime: "image/gif", icon: ImageIcon, targets: ["png", "jpg", "webp", "pdf"] },
  svg: { id: "svg", label: "SVG", category: "image", extensions: ["svg"], mime: "image/svg+xml", icon: ImageIcon, targets: ["png", "jpg", "webp", "pdf"] },
  ico: { id: "ico", label: "ICO", category: "image", extensions: ["ico"], mime: "image/x-icon", icon: ImageIcon, targets: ["png", "jpg", "webp"] },

  // ── Audio ──
  audio: { id: "audio", label: "Audio (MP3/OGG/M4A/FLAC/dll)", category: "audio", extensions: ["mp3", "ogg", "m4a", "flac", "aac", "wav", "weba", "opus"], mime: "audio/*", icon: FileAudio, targets: ["wav"] },
  wav: { id: "wav", label: "WAV", category: "audio", extensions: ["wav"], mime: "audio/wav", icon: FileAudio, targets: [] },

  // ── Video (reuses the existing MediaRecorder-based video engine; output
  //    format is whatever the browser itself best supports — see videoConvert.ts) ──
  video: { id: "video", label: "Video (MP4/WebM/MOV/dll)", category: "audio", extensions: ["mp4", "webm", "mov", "mkv", "avi", "m4v"], mime: "video/*", icon: FileAudio, targets: ["videoOut", "audio"] },
  videoOut: { id: "videoOut", label: "Video (format terbaik browser)", category: "audio", extensions: [], icon: FileAudio, targets: [] },

  // ── Archive ──
  files: { id: "files", label: "Beberapa File", category: "archive", extensions: [], icon: FileIcon, targets: ["zip"] },
  zip: { id: "zip", label: "ZIP", category: "archive", extensions: ["zip"], mime: "application/zip", icon: FileArchive, targets: [] },
};

const EXTENSION_TO_FORMAT: Record<string, string> = {};
for (const fmt of Object.values(FORMATS)) {
  for (const ext of fmt.extensions) {
    // First declared owner of an extension wins; `wav` is intentionally
    // distinct from the generic `audio` bucket (handled by detectFormat).
    if (!(ext in EXTENSION_TO_FORMAT)) EXTENSION_TO_FORMAT[ext] = fmt.id;
  }
}

const AUDIO_EXTENSIONS = new Set(["mp3", "ogg", "m4a", "flac", "aac", "weba", "opus", "wma"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "avi", "m4v"]);

export function detectFormatFromFilename(filename: string): FormatDef | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "wav") return FORMATS.wav;
  if (AUDIO_EXTENSIONS.has(ext)) return FORMATS.audio;
  if (VIDEO_EXTENSIONS.has(ext)) return FORMATS.video;
  const id = EXTENSION_TO_FORMAT[ext];
  return id ? FORMATS[id] : null;
}

export function getTargetFormats(sourceId: string): FormatDef[] {
  const src = FORMATS[sourceId];
  if (!src) return [];
  return src.targets.map((id) => FORMATS[id]).filter(Boolean);
}
