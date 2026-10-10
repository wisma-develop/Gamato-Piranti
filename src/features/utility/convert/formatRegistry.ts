// ─── Universal Converter — format registry ─────────────────────────────────
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
  targets: string[];
}

export const FORMATS: Record<string, FormatDef> = {
  json: { id: "json", label: "JSON", category: "data", extensions: ["json"], mime: "application/json", icon: FileJson, targets: ["csv", "tsv", "xml", "yaml", "xlsx", "pdf"] },
  csv: { id: "csv", label: "CSV", category: "data", extensions: ["csv"], mime: "text/csv", icon: FileSpreadsheet, targets: ["json", "tsv", "xml", "yaml", "xlsx", "pdf"] },
  tsv: { id: "tsv", label: "TSV", category: "data", extensions: ["tsv"], mime: "text/tab-separated-values", icon: FileSpreadsheet, targets: ["json", "csv", "xml", "yaml", "xlsx", "pdf"] },
  xml: { id: "xml", label: "XML", category: "data", extensions: ["xml"], mime: "application/xml", icon: FileCode2, targets: ["json", "csv", "tsv", "yaml", "xlsx", "pdf"] },
  yaml: { id: "yaml", label: "YAML", category: "data", extensions: ["yaml", "yml"], mime: "application/x-yaml", icon: Braces, targets: ["json", "csv", "tsv", "xml", "xlsx", "pdf"] },

  xlsx: { id: "xlsx", label: "Excel (.xlsx)", category: "spreadsheet", extensions: ["xlsx"], mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", icon: FileSpreadsheet, targets: ["csv", "tsv", "json", "pdf"] },

  txt: { id: "txt", label: "Teks (.txt)", category: "document", extensions: ["txt"], mime: "text/plain", icon: FileText, targets: ["md", "docx", "pdf", "html"] },
  md: { id: "md", label: "Markdown (.md)", category: "document", extensions: ["md", "markdown"], mime: "text/markdown", icon: FileText, targets: ["txt", "html", "docx", "pdf"] },
  html: { id: "html", label: "HTML", category: "document", extensions: ["html", "htm"], mime: "text/html", icon: FileCode2, targets: ["txt", "pdf", "png", "docx", "md"] },
  docx: { id: "docx", label: "Word (.docx)", category: "document", extensions: ["docx"], mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", icon: FileType, targets: ["txt", "pdf", "html", "md"] },
  rtf: { id: "rtf", label: "RTF", category: "document", extensions: ["rtf"], mime: "application/rtf", icon: FileType, targets: ["txt", "docx", "pdf"] },
  pdf: { id: "pdf", label: "PDF", category: "document", extensions: ["pdf"], mime: "application/pdf", icon: FileText, targets: ["txt", "png", "jpg", "docx", "md", "xlsx"] },

  png: { id: "png", label: "PNG", category: "image", extensions: ["png"], mime: "image/png", icon: ImageIcon, targets: ["jpg", "webp", "bmp", "ico", "gif", "pdf"] },
  jpg: { id: "jpg", label: "JPG", category: "image", extensions: ["jpg", "jpeg"], mime: "image/jpeg", icon: ImageIcon, targets: ["png", "webp", "bmp", "ico", "gif", "pdf"] },
  webp: { id: "webp", label: "WEBP", category: "image", extensions: ["webp"], mime: "image/webp", icon: ImageIcon, targets: ["png", "jpg", "bmp", "ico", "gif", "pdf"] },
  bmp: { id: "bmp", label: "BMP", category: "image", extensions: ["bmp"], mime: "image/bmp", icon: ImageIcon, targets: ["png", "jpg", "webp", "ico", "gif", "pdf"] },
  gif: { id: "gif", label: "GIF", category: "image", extensions: ["gif"], mime: "image/gif", icon: ImageIcon, targets: ["png", "jpg", "webp", "bmp", "ico", "pdf"] },
  svg: { id: "svg", label: "SVG", category: "image", extensions: ["svg"], mime: "image/svg+xml", icon: ImageIcon, targets: ["png", "jpg", "webp", "bmp", "ico", "gif", "pdf"] },
  ico: { id: "ico", label: "ICO", category: "image", extensions: ["ico"], mime: "image/x-icon", icon: ImageIcon, targets: ["png", "jpg", "webp", "gif"] },

  audio: { id: "audio", label: "Audio (MP3/OGG/M4A/FLAC/dll)", category: "audio", extensions: ["mp3", "ogg", "m4a", "flac", "aac", "weba", "opus"], mime: "audio/*", icon: FileAudio, targets: ["wav", "audioOut"] },
  wav: { id: "wav", label: "WAV", category: "audio", extensions: ["wav"], mime: "audio/wav", icon: FileAudio, targets: ["audioOut"] },
  audioOut: { id: "audioOut", label: "Audio Terkompresi (OGG/WebM)", category: "audio", extensions: [], icon: FileAudio, targets: [] },

  video: { id: "video", label: "Video (MP4/WebM/MOV/dll)", category: "audio", extensions: ["mp4", "webm", "mov", "mkv", "avi", "m4v"], mime: "video/*", icon: FileAudio, targets: ["videoOut", "audio", "videoGif"] },
  videoOut: { id: "videoOut", label: "Video (format terbaik browser)", category: "audio", extensions: [], icon: FileAudio, targets: [] },
  videoGif: { id: "videoGif", label: "GIF (15 detik pertama)", category: "audio", extensions: [], icon: ImageIcon, targets: [] },

  files: { id: "files", label: "Beberapa File", category: "archive", extensions: [], icon: FileIcon, targets: ["zip"] },
  zip: { id: "zip", label: "ZIP", category: "archive", extensions: ["zip"], mime: "application/zip", icon: FileArchive, targets: [] },
};

const EXTENSION_TO_FORMAT: Record<string, string> = {};
for (const fmt of Object.values(FORMATS)) {
  for (const ext of fmt.extensions) {
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
