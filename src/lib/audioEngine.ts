// Browser-native audio processing shared library — mirrors the same honest,
// "no ffmpeg.wasm, no server" scope already established by videoEngine.ts.
//
// True arbitrary codec transcoding (anything -> MP3/AAC) needs a real
// encoder library that isn't among this project's dependencies and can't be
// installed offline. What IS fully, honestly achievable in-browser:
//   1) decode whatever Web Audio's decodeAudioData supports (MP3, WAV, OGG
//      Vorbis, M4A/AAC, FLAC in current Chrome/Edge/Firefox) into raw PCM,
//      then re-encode losslessly as WAV (see converters/audioConvert.ts,
//      re-exported below for a single import point).
//   2) play that same decoded PCM back out through a real-time
//      MediaStreamDestination + MediaRecorder to produce a genuinely
//      different, *compressed* output (WebM/OGG Opus) — a real second
//      format option, not just a relabeled WAV.

import { audioFileToWav, encodeAudioBufferToWav } from "@/features/utility/convert/converters/audioConvert";

export { audioFileToWav, encodeAudioBufferToWav };

export interface AudioMeta {
  url: string;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  buffer: AudioBuffer;
  file: File;
}

/** Decodes an audio file once into an AudioBuffer, reused by every conversion mode so the file is never re-decoded per action. */
export async function loadAudioMeta(file: File): Promise<AudioMeta> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  let buffer: AudioBuffer;
  try {
    buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    throw new Error("Browser tidak bisa membaca format audio ini. Coba file MP3, WAV, OGG, atau M4A.");
  } finally {
    ctx.close().catch(() => {});
  }
  return {
    url: URL.createObjectURL(file),
    duration: buffer.duration,
    sampleRate: buffer.sampleRate,
    numberOfChannels: buffer.numberOfChannels,
    buffer,
    file,
  };
}

export interface CompressedAudioFormat {
  mimeType: string;
  ext: string;
  label: string;
}

const COMPRESSED_CANDIDATE_FORMATS: CompressedAudioFormat[] = [
  { mimeType: "audio/webm;codecs=opus", ext: "webm", label: "WebM Audio (Opus)" },
  { mimeType: "audio/ogg;codecs=opus", ext: "ogg", label: "OGG Audio (Opus)" },
  { mimeType: "audio/webm", ext: "webm", label: "WebM Audio" },
];

export function getSupportedCompressedAudioFormats(): CompressedAudioFormat[] {
  if (typeof MediaRecorder === "undefined") return [];
  return COMPRESSED_CANDIDATE_FORMATS.filter((f) => {
    try {
      return MediaRecorder.isTypeSupported(f.mimeType);
    } catch {
      return false;
    }
  });
}

export function getBestCompressedAudioFormat(): CompressedAudioFormat | null {
  return getSupportedCompressedAudioFormats()[0] ?? null;
}

/**
 * Re-encodes a (possibly trimmed) slice of an already-decoded AudioBuffer
 * into a compressed format via a real-time MediaRecorder pass — plays the
 * slice through a MediaStreamDestination while recording it, same
 * real-time-bound approach already used by videoEngine's audio export, so a
 * 30-second clip takes ~30 seconds to convert.
 */
export async function encodeAudioBufferCompressed(opts: {
  buffer: AudioBuffer;
  start: number;
  end: number;
  format: CompressedAudioFormat;
  onProgress?: (fraction: number) => void;
}): Promise<Blob> {
  const { buffer, start, end, format, onProgress } = opts;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx: AudioContext = new AudioCtx();
  // Chrome suspends new AudioContexts until a user gesture unlocks audio;
  // the "Konversi" button click that triggers this function already IS that
  // gesture, but resuming explicitly (rather than relying on it happening
  // implicitly) keeps this correct even if a future caller invokes it from
  // a context without a fresh click in the call stack.
  await ctx.resume().catch(() => {});

  const clampedStart = Math.max(0, Math.min(start, buffer.duration));
  const clampedEnd = Math.max(clampedStart, Math.min(end, buffer.duration));
  const duration = Math.max(0.05, clampedEnd - clampedStart);

  try {
    const destination = ctx.createMediaStreamDestination();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);

    const recorder = new MediaRecorder(destination.stream, { mimeType: format.mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: format.mimeType }));
    });

    const startedAt = performance.now();
    const progressTimer = onProgress
      ? window.setInterval(() => {
          const elapsedSec = (performance.now() - startedAt) / 1000;
          onProgress(Math.min(0.98, elapsedSec / duration));
        }, 120)
      : null;

    recorder.start();
    source.start(0, clampedStart, duration);

    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
    });
    recorder.stop();

    const blob = await stopped;
    if (progressTimer) window.clearInterval(progressTimer);
    onProgress?.(1);
    return blob;
  } finally {
    ctx.close().catch(() => {});
  }
}
