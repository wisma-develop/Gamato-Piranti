// ─── Video converter — thin wrapper around the existing video engine ───────
// True arbitrary-codec video transcoding needs ffmpeg (or similar), which
// isn't available offline. What's genuinely achievable — and already proven
// in this codebase by VideoTrim/VideoMerge/VideoCrop — is playing the source
// through a <video> element and re-capturing it via MediaRecorder into
// whichever container/codec the *browser itself* best supports (typically
// WebM/VP9 in Chrome). This reuses that exact, already-working pipeline
// rather than reimplementing it — deliberately NOT modified, since it's
// shared production code for several existing tools.
import {
  computeContainRect,
  exportSegmentedVideo,
  extractAudioFromVideo,
  getBestExportFormat,
  loadVideoMeta,
  sampleVideoFrames,
  type ExportProgressCallback,
} from "@/lib/videoEngine";
import { encodeGif } from "@/lib/gifEncoder";

/** Keeps exported GIFs a sane size/time — same spirit as the dedicated Video-to-GIF tool's own sensible defaults. Longer clips are simply cut to this length rather than silently failing or producing a huge file. */
export const VIDEO_GIF_MAX_SECONDS = 15;

export function isVideoConvertSupported(): boolean {
  return getBestExportFormat() !== null;
}

export function getVideoOutputExt(): string {
  return getBestExportFormat()?.ext ?? "webm";
}

/** Re-encodes the whole source video, unchanged in content, through the browser's best available MediaRecorder format — a straightforward "convert this video" pass. */
export async function convertVideoFile(file: File, onProgress?: ExportProgressCallback): Promise<Blob> {
  const format = getBestExportFormat();
  if (!format) throw new Error("Browser ini tidak mendukung konversi video (MediaRecorder). Coba Chrome atau Edge terbaru.");
  const meta = await loadVideoMeta(file);
  try {
    // `exportSegmentedVideo` creates and drives its own internal <video>
    // element (seeking/playing it through each segment) and hands it to
    // `drawFrame` on every captured frame — we must draw FROM that same
    // element, not a separately-created one, or the output would be blank
    // or frozen since our own element would never be played/seeked.
    const rect = computeContainRect(meta.width, meta.height, meta.width, meta.height);
    return await exportSegmentedVideo({
      sourceUrl: meta.url,
      segments: [{ start: 0, end: meta.duration }],
      outputWidth: meta.width,
      outputHeight: meta.height,
      drawFrame: (ctx, video) => ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h),
      onProgress,
    });
  } finally {
    URL.revokeObjectURL(meta.url);
  }
}

export async function extractAudioFromVideoFile(file: File, onProgress?: ExportProgressCallback): Promise<Blob> {
  const meta = await loadVideoMeta(file);
  try {
    return await extractAudioFromVideo({ sourceUrl: meta.url, start: 0, end: meta.duration, onProgress });
  } finally {
    URL.revokeObjectURL(meta.url);
  }
}

/** Converts (the first `VIDEO_GIF_MAX_SECONDS` of) a video into an animated GIF, reusing the exact frame-sampling + GIF-encoding pipeline already proven in the dedicated Video Convert Hub. */
export async function videoToGifFile(file: File, onProgress?: ExportProgressCallback): Promise<Blob> {
  const meta = await loadVideoMeta(file);
  try {
    const end = Math.min(meta.duration, VIDEO_GIF_MAX_SECONDS);
    const frames = await sampleVideoFrames({
      sourceUrl: meta.url,
      start: 0,
      end,
      fps: 10,
      maxWidth: 480,
      onProgress: (f) => onProgress?.(f * 0.9),
    });
    const blob = await encodeGif(frames, { onProgress: (f) => onProgress?.(0.9 + f * 0.1) });
    onProgress?.(1);
    return blob;
  } finally {
    URL.revokeObjectURL(meta.url);
  }
}
