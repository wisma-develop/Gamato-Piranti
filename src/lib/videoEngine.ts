// Lightweight, dependency-free browser video editing engine.
//
// Deliberate architecture choice: this uses native <video> + <canvas> +
// MediaRecorder instead of a WASM encoder (e.g. ffmpeg.wasm). That keeps the
// entire Video menu at ~0KB of extra dependencies (vs. ffmpeg.wasm's 25-30MB
// download), matching the "ringan" (lightweight) requirement. The trade-off,
// stated honestly rather than hidden: export runs in real time — exporting a
// 1-minute clip takes roughly a minute, since we are literally playing the
// source and re-encoding it live via the browser's own built-in encoder.
// WebM is the most reliable output format across browsers; MP4 is offered
// automatically when the browser's MediaRecorder supports it.

export type VideoMeta = { url: string; duration: number; width: number; height: number; file: File };

export function loadVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      resolve({ url, duration: v.duration || 0, width: v.videoWidth, height: v.videoHeight, file });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca file video. Pastikan formatnya didukung (MP4, WebM, atau MOV)."));
    };
    v.src = url;
  });
}

export function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec - Math.floor(sec)) * 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export type ExportFormat = { mimeType: string; ext: string; label: string };

const CANDIDATE_FORMATS: ExportFormat[] = [
  { mimeType: "video/mp4;codecs=h264", ext: "mp4", label: "MP4" },
  { mimeType: "video/webm;codecs=vp9,opus", ext: "webm", label: "WebM (VP9)" },
  { mimeType: "video/webm;codecs=vp8,opus", ext: "webm", label: "WebM (VP8)" },
  { mimeType: "video/webm", ext: "webm", label: "WebM" },
];

export function getSupportedExportFormats(): ExportFormat[] {
  if (typeof MediaRecorder === "undefined") return [];
  return CANDIDATE_FORMATS.filter((f) => {
    try {
      return MediaRecorder.isTypeSupported(f.mimeType);
    } catch {
      return false;
    }
  });
}

export function getBestExportFormat(): ExportFormat | null {
  return getSupportedExportFormats()[0] ?? null;
}

export function isVideoExportSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
}

/** Creates a detached (not appended to the DOM) <video> element — works fine for canvas drawing + playback. */
export function createOffscreenVideo(src: string): HTMLVideoElement {
  const v = document.createElement("video");
  v.src = src;
  v.playsInline = true;
  v.crossOrigin = "anonymous";
  return v;
}

/** Routes a <video>'s audio track through Web Audio so it can be merged into a MediaRecorder stream. */
export function createAudioStreamFromVideo(videoEl: HTMLVideoElement, audioCtx: AudioContext): MediaStream {
  const source = audioCtx.createMediaElementSource(videoEl);
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);
  source.connect(audioCtx.destination); // keep it audible so progress is easy to sanity-check while exporting
  return dest.stream;
}

function newAudioContext(): AudioContext {
  const Ctor: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  return new Ctor();
}

type RecordingHandle = { stop: () => void; result: Promise<Blob> };

function startRecording(canvas: HTMLCanvasElement, audioStream: MediaStream | null, format: ExportFormat, fps: number): RecordingHandle {
  const canvasStream = (canvas as any).captureStream(fps) as MediaStream;
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  if (audioStream) tracks.push(...audioStream.getAudioTracks());
  const combined = new MediaStream(tracks);

  const recorder = new MediaRecorder(combined, { mimeType: format.mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const result = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: format.mimeType.split(";")[0] }));
    recorder.onerror = (e: any) => reject(new Error(e?.error?.message || "Perekaman video gagal."));
  });

  recorder.start(250);

  return {
    stop: () => {
      if (recorder.state !== "inactive") recorder.stop();
    },
    result,
  };
}

/** Drives a draw loop via requestAnimationFrame until `shouldContinue()` returns false. */
function runRenderLoop(opts: { shouldContinue: () => boolean; onFrame: () => void; onDone: () => void }) {
  let cancelled = false;
  const loop = () => {
    if (cancelled) return;
    if (!opts.shouldContinue()) {
      opts.onDone();
      return;
    }
    opts.onFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => {
    cancelled = true;
  };
}

/** Computes a "contain"-fit rectangle so a video draws without distortion (letterboxed) inside a target box. */
export function computeContainRect(sourceW: number, sourceH: number, targetW: number, targetH: number) {
  const scale = Math.min(targetW / (sourceW || 1), targetH / (sourceH || 1));
  const w = sourceW * scale;
  const h = sourceH * scale;
  return { x: (targetW - w) / 2, y: (targetH - h) / 2, w, h };
}

async function waitSeeked(video: HTMLVideoElement, time: number): Promise<void> {
  video.currentTime = Math.max(0, time);
  await new Promise<void>((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
  });
}

export type ExportProgressCallback = (progress: number) => void;

/**
 * Exports one or more "keep" segments of a single source video, played back to back into one
 * continuous recording. A simple trim is just one segment; a multi-cut edit (remove unwanted
 * parts) is several segments — both share this exact same export path.
 */
export async function exportSegmentedVideo(opts: {
  sourceUrl: string;
  segments: { start: number; end: number }[];
  outputWidth: number;
  outputHeight: number;
  fps?: number;
  drawFrame: (ctx: CanvasRenderingContext2D, video: HTMLVideoElement, canvas: HTMLCanvasElement) => void;
  includeAudio?: boolean;
  onProgress?: ExportProgressCallback;
}): Promise<Blob> {
  const { sourceUrl, segments, outputWidth, outputHeight, fps = 30, drawFrame, includeAudio = true, onProgress } = opts;
  if (!segments.length) throw new Error("Tidak ada bagian video yang dipilih.");
  if (!isVideoExportSupported()) {
    throw new Error("Browser ini tidak mendukung perekaman video (MediaRecorder/captureStream). Coba Chrome, Edge, atau Firefox versi terbaru.");
  }
  const format = getBestExportFormat();
  if (!format) throw new Error("Browser ini tidak mendukung format ekspor video apa pun.");

  const video = createOffscreenVideo(sourceUrl);
  video.muted = !includeAudio;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Gagal memuat video untuk diekspor."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak didukung di browser ini.");

  let audioCtx: AudioContext | null = null;
  let audioStream: MediaStream | null = null;
  if (includeAudio) {
    try {
      audioCtx = newAudioContext();
      if (audioCtx.state === "suspended") await audioCtx.resume();
      audioStream = createAudioStreamFromVideo(video, audioCtx);
    } catch {
      audioStream = null;
    }
  }

  const totalDuration = segments.reduce((s, seg) => s + Math.max(0, seg.end - seg.start), 0);
  const handle = startRecording(canvas, audioStream, format, fps);
  let elapsedBefore = 0;

  try {
    for (const seg of segments) {
      await waitSeeked(video, seg.start);
      await video.play();
      const segStart = seg.start;
      const segEnd = seg.end;
      const before = elapsedBefore;
      await new Promise<void>((resolve) => {
        runRenderLoop({
          shouldContinue: () => !video.ended && video.currentTime < segEnd,
          onFrame: () => {
            drawFrame(ctx, video, canvas);
            onProgress?.(Math.min(1, (before + (video.currentTime - segStart)) / Math.max(0.001, totalDuration)));
          },
          onDone: () => {
            video.pause();
            resolve();
          },
        });
      });
      elapsedBefore += segEnd - segStart;
    }
    onProgress?.(1);
  } finally {
    handle.stop();
  }

  const blob = await handle.result;
  audioCtx?.close().catch(() => {});
  return blob;
}

const AUDIO_CANDIDATE_FORMATS: ExportFormat[] = [
  { mimeType: "audio/webm;codecs=opus", ext: "webm", label: "WebM Audio (Opus)" },
  { mimeType: "audio/ogg;codecs=opus", ext: "ogg", label: "OGG Audio (Opus)" },
  { mimeType: "audio/webm", ext: "webm", label: "WebM Audio" },
];

export function getSupportedAudioFormats(): ExportFormat[] {
  if (typeof MediaRecorder === "undefined") return [];
  return AUDIO_CANDIDATE_FORMATS.filter((f) => {
    try {
      return MediaRecorder.isTypeSupported(f.mimeType);
    } catch {
      return false;
    }
  });
}

export function getBestAudioFormat(): ExportFormat | null {
  return getSupportedAudioFormats()[0] ?? null;
}

/** Extracts just the audio track of a video segment as a standalone audio file. */
export async function extractAudioFromVideo(opts: {
  sourceUrl: string;
  start: number;
  end: number;
  onProgress?: ExportProgressCallback;
}): Promise<Blob> {
  const { sourceUrl, start, end, onProgress } = opts;
  const format = getBestAudioFormat();
  if (!format) throw new Error("Browser ini tidak mendukung ekstraksi audio (MediaRecorder). Coba Chrome, Edge, atau Firefox terbaru.");

  const video = createOffscreenVideo(sourceUrl);
  video.muted = false;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Gagal memuat video untuk diekstrak audionya."));
  });

  const audioCtx = newAudioContext();
  if (audioCtx.state === "suspended") await audioCtx.resume();
  const audioStream = createAudioStreamFromVideo(video, audioCtx);

  const recorder = new MediaRecorder(audioStream, { mimeType: format.mimeType });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const resultPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: format.mimeType.split(";")[0] }));
    recorder.onerror = (e: any) => reject(new Error(e?.error?.message || "Ekstraksi audio gagal."));
  });

  recorder.start(250);
  await waitSeeked(video, start);
  await video.play();

  await new Promise<void>((resolve) => {
    runRenderLoop({
      shouldContinue: () => !video.ended && video.currentTime < end,
      onFrame: () => onProgress?.(Math.min(1, (video.currentTime - start) / Math.max(0.001, end - start))),
      onDone: () => {
        video.pause();
        resolve();
      },
    });
  });

  recorder.stop();
  const blob = await resultPromise;
  audioCtx.close().catch(() => {});
  onProgress?.(1);
  return blob;
}

/** Grabs a single frame from a video at a given time as a PNG image. */
export async function captureVideoFrame(sourceUrl: string, atTime: number): Promise<Blob> {
  const video = createOffscreenVideo(sourceUrl);
  video.muted = true;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Gagal memuat video untuk mengambil thumbnail."));
  });
  await waitSeeked(video, atTime);

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak didukung di browser ini.");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Gagal membuat gambar dari video."));
    }, "image/png");
  });
}

export type MergeClip = { sourceUrl: string; start: number; end: number };
export type TransitionType = "cut" | "fade";

/** Exports multiple different source clips back to back, with an optional crossfade at each boundary. */
export async function exportMergedVideo(opts: {
  clips: MergeClip[];
  transition: TransitionType;
  transitionDuration: number;
  outputWidth: number;
  outputHeight: number;
  fps?: number;
  includeAudio?: boolean;
  onProgress?: ExportProgressCallback;
}): Promise<Blob> {
  const { clips, transition, outputWidth, outputHeight, fps = 30, includeAudio = true, onProgress } = opts;
  const transitionDuration = Math.max(0.05, opts.transitionDuration);
  if (!clips.length) throw new Error("Tidak ada klip untuk digabung.");
  if (!isVideoExportSupported()) {
    throw new Error("Browser ini tidak mendukung perekaman video (MediaRecorder/captureStream). Coba Chrome, Edge, atau Firefox versi terbaru.");
  }
  const format = getBestExportFormat();
  if (!format) throw new Error("Browser ini tidak mendukung format ekspor video apa pun.");

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak didukung di browser ini.");

  let audioCtx: AudioContext | null = null;
  let sharedDest: MediaStreamAudioDestinationNode | null = null;
  if (includeAudio) {
    try {
      audioCtx = newAudioContext();
      if (audioCtx.state === "suspended") await audioCtx.resume();
      sharedDest = audioCtx.createMediaStreamDestination();
    } catch {
      audioCtx = null;
      sharedDest = null;
    }
  }

  const prepared: HTMLVideoElement[] = [];
  for (const clip of clips) {
    const v = createOffscreenVideo(clip.sourceUrl);
    v.muted = !includeAudio;
    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve();
      v.onerror = () => reject(new Error("Gagal memuat salah satu klip."));
    });
    if (includeAudio && audioCtx && sharedDest) {
      try {
        const source = audioCtx.createMediaElementSource(v);
        source.connect(sharedDest);
        source.connect(audioCtx.destination);
      } catch {
        // Continue silently for this clip if it can't be routed into the audio graph.
      }
    }
    prepared.push(v);
  }

  const totalDuration = clips.reduce((sum, c, i) => {
    const dur = Math.max(0, c.end - c.start);
    const overlap = transition === "fade" && i < clips.length - 1 ? Math.min(transitionDuration, dur) : 0;
    return sum + dur - overlap;
  }, 0);

  const handle = startRecording(canvas, sharedDest?.stream ?? null, format, fps);
  let elapsed = 0;
  let carryOver: HTMLVideoElement | null = null;

  try {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const video = prepared[i];
      const isLast = i === clips.length - 1;
      const nextVideo = isLast ? null : prepared[i + 1];
      const nextClip = isLast ? null : clips[i + 1];
      const hasFade = transition === "fade" && !isLast && Math.max(0, clip.end - clip.start) > transitionDuration;
      const mainEnd = hasFade ? clip.end - transitionDuration : clip.end;

      if (carryOver !== video) {
        await waitSeeked(video, clip.start);
        await video.play();
      }
      carryOver = null;

      const mainStartRef = video.currentTime;
      await new Promise<void>((resolve) => {
        runRenderLoop({
          shouldContinue: () => !video.ended && video.currentTime < mainEnd,
          onFrame: () => {
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const r = computeContainRect(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
            ctx.drawImage(video, r.x, r.y, r.w, r.h);
            onProgress?.(Math.min(1, (elapsed + (video.currentTime - mainStartRef)) / Math.max(0.001, totalDuration)));
          },
          onDone: () => resolve(),
        });
      });
      elapsed += Math.max(0, mainEnd - clip.start);

      if (hasFade && nextVideo && nextClip) {
        await waitSeeked(nextVideo, nextClip.start);
        await nextVideo.play();

        const fadeStart = performance.now();
        await new Promise<void>((resolve) => {
          runRenderLoop({
            shouldContinue: () => (performance.now() - fadeStart) / 1000 < transitionDuration,
            onFrame: () => {
              const t = Math.min(1, (performance.now() - fadeStart) / 1000 / transitionDuration);
              ctx.fillStyle = "#000000";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              const rA = computeContainRect(video.videoWidth, video.videoHeight, canvas.width, canvas.height);
              const rB = computeContainRect(nextVideo.videoWidth, nextVideo.videoHeight, canvas.width, canvas.height);
              ctx.globalAlpha = 1 - t;
              ctx.drawImage(video, rA.x, rA.y, rA.w, rA.h);
              ctx.globalAlpha = t;
              ctx.drawImage(nextVideo, rB.x, rB.y, rB.w, rB.h);
              ctx.globalAlpha = 1;
              onProgress?.(Math.min(1, (elapsed + t * transitionDuration) / Math.max(0.001, totalDuration)));
            },
            onDone: () => resolve(),
          });
        });
        video.pause();
        elapsed += transitionDuration;
        carryOver = nextVideo;
      } else {
        video.pause();
      }
    }
    onProgress?.(1);
  } finally {
    handle.stop();
  }

  const blob = await handle.result;
  audioCtx?.close().catch(() => {});
  return blob;
}
