// Ekspor Audio Visualizer — render offline frame demi frame (lebih cepat/lambat dari real-time
// tergantung beban, tapi SELALU sinkron sempurna dengan audio).
//   • .mov (PNG)  : alpha lurus, ukuran kecil — direkomendasikan.
//   • .mov (RLE)  : Apple Animation 32-bit, lossless, kompatibel luas (DaVinci Resolve dkk).
//   • .mov (JPEG) : Photo-JPEG tanpa alpha — untuk latar penuh, berkas jauh lebih kecil.
//   • ZIP urutan PNG (+ audio.wav) : cadangan untuk editor mana pun.

import { MovWriter, encodeQtRle32 } from "@/lib/movMux";
import { encodeWavPcm, resamplePcm, type PCM } from "@/lib/audioEditEngine";
import { BufferSource, VizAnalyzer } from "./analysis";
import { renderViz, type VizAssets } from "./renderer";
import type { VizConfig } from "./config";

export type ExportFormat = "mov-png" | "mov-rle" | "mov-jpeg" | "png-zip";

export interface ExportOptions {
  src: BufferSource;
  cfg: VizConfig;
  assets: VizAssets;
  start: number;
  end: number;
  format: ExportFormat;
  includeAudio: boolean;
  /** Kualitas JPEG 0–1 (format mov-jpeg). */
  jpegQuality?: number;
  fileBase?: string;
  signal?: { cancelled: boolean };
  onProgress?: (fraction: number, info: { frame: number; total: number; bytes: number; etaSec: number; message?: string }) => void;
}

export interface ExportResult {
  blob: Blob;
  name: string;
  frames: number;
  bytes: number;
  seconds: number;
  hasAlpha: boolean;
}

export class ExportCancelled extends Error {
  constructor() {
    super("Ekspor dibatalkan.");
  }
}

const canvasBlob = (c: HTMLCanvasElement, mime = "image/png", q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Gagal membuat frame."))), mime, q));

export function frameCountFor(start: number, end: number, fps: number) {
  return Math.max(1, Math.floor((end - start) * fps + 1e-6));
}

function sliceAudio(src: BufferSource, start: number, end: number, frames: number, fps: number): { sampleRate: number; channels: number; pcm: Int16Array } {
  const sr = src.sampleRate;
  const s0 = Math.max(0, Math.round(start * sr));
  const s1 = Math.min(src.channels[0].length, Math.round(end * sr));
  const nch = Math.min(2, src.channels.length) || 1;
  const chans: Float32Array[] = [];
  for (let c = 0; c < nch; c++) chans.push(src.channels[c].slice(s0, s1));
  let pcm: PCM = { sampleRate: sr, channels: chans };
  if (sr > 48000) pcm = resamplePcm(pcm, 48000);
  const rate = pcm.sampleRate;
  const total = Math.round((frames / fps) * rate);
  const out = new Int16Array(total * nch);
  for (let c = 0; c < nch; c++) {
    const ch = pcm.channels[c];
    const n = Math.min(total, ch.length);
    for (let i = 0; i < n; i++) {
      const v = ch[i];
      const q = Math.round(v * 32768); // kebalikan persis dari decodeAudioData (÷32768) → WAV 16-bit lolos tanpa kehilangan
      out[i * nch + c] = q > 32767 ? 32767 : q < -32768 ? -32768 : q;
    }
  }
  return { sampleRate: rate, channels: nch, pcm: out };
}

function makeCanvas(cfg: VizConfig, readback: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = cfg.width;
  canvas.height = cfg.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: readback, alpha: true });
  if (!ctx) throw new Error("Canvas 2D tidak didukung di browser ini.");
  return { canvas, ctx };
}

function toArgbSample(ctx: CanvasRenderingContext2D, w: number, h: number): Uint8Array {
  return encodeQtRle32(ctx.getImageData(0, 0, w, h).data, w, h);
}

export async function exportViz(o: ExportOptions): Promise<ExportResult> {
  const { src, cfg, assets, format } = o;
  const fps = cfg.fps;
  const start = Math.max(0, o.start);
  const end = Math.min(src.duration, o.end);
  if (!(end > start)) throw new Error("Rentang waktu tidak valid.");
  const frames = frameCountFor(start, end, fps);
  const hasAlpha = cfg.bgMode === "transparent" && format !== "mov-jpeg";
  if (format === "mov-jpeg" && cfg.bgMode === "transparent") throw new Error("Format JPEG tidak mendukung transparansi — aktifkan latar (Warna/Gradien/Gambar) atau pilih format PNG/RLE.");
  const jq = Math.min(1, Math.max(0.3, o.jpegQuality ?? 0.9));
  const { canvas, ctx } = makeCanvas(cfg, format === "mov-rle");
  const analyzer = new VizAnalyzer(cfg, src.sampleRate);
  const t0 = performance.now();

  const audio = o.includeAudio ? sliceAudio(src, start, end, frames, fps) : undefined;
  const mov = format === "png-zip" ? null : new MovWriter({ width: cfg.width, height: cfg.height, fps, codec: format === "mov-rle" ? "rle" : format === "mov-jpeg" ? "jpeg" : "png", hasAlpha, audio });
  let zip: import("jszip") | null = null;
  if (format === "png-zip") {
    const { default: JSZip } = await import("jszip");
    zip = new JSZip();
  }

  let bytes = 0;
  const dt = 1 / fps;
  for (let i = 0; i < frames; i++) {
    if (o.signal?.cancelled) throw new ExportCancelled();
    const t = start + i * dt;
    const w = src.getWindows(t, cfg.fftSize);
    const frame = analyzer.analyze(w, dt, i === 0);
    renderViz(ctx, cfg, frame, assets, t, src.duration, 1);
    if (format === "mov-rle") {
      const sample = toArgbSample(ctx, cfg.width, cfg.height);
      mov!.addVideoFrame(sample);
      bytes += sample.length;
    } else {
      const blob = format === "mov-jpeg" ? await canvasBlob(canvas, "image/jpeg", jq) : await canvasBlob(canvas);
      bytes += blob.size;
      if (mov) mov.addVideoFrame(blob);
      else zip!.file(`frame_${String(i + 1).padStart(5, "0")}.png`, blob, { compression: "STORE" });
    }
    if (i % 2 === 1 || format !== "mov-rle") {
      const elapsed = (performance.now() - t0) / 1000;
      const per = elapsed / (i + 1);
      o.onProgress?.((i + 1) / frames, { frame: i + 1, total: frames, bytes, etaSec: per * (frames - i - 1) });
      if (format === "mov-rle") await new Promise((r) => setTimeout(r, 0));
    }
  }

  o.onProgress?.(1, { frame: frames, total: frames, bytes, etaSec: 0, message: "Menyusun berkas…" });
  await new Promise((r) => setTimeout(r, 0));
  const base = (o.fileBase || "gamato-visualizer").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80) || "gamato-visualizer";
  let blob: Blob;
  let name: string;
  if (mov) {
    blob = mov.finish();
    name = `${base}${hasAlpha ? "-alpha" : ""}.mov`;
  } else {
    if (audio) {
      const chans: Float32Array[] = [];
      for (let c = 0; c < audio.channels; c++) {
        const ch = new Float32Array(audio.pcm.length / audio.channels);
        for (let i = 0; i < ch.length; i++) ch[i] = audio.pcm[i * audio.channels + c] / 32768;
        chans.push(ch);
      }
      zip!.file("audio.wav", encodeWavPcm({ sampleRate: audio.sampleRate, channels: chans }, 16, false), { compression: "STORE" });
    }
    zip!.file("README.txt", `Urutan PNG Audio Visualizer\nResolusi: ${cfg.width}x${cfg.height}\nFPS: ${fps}\nFrame: ${frames}\nTransparan: ${hasAlpha ? "ya" : "tidak"}\nImpor sebagai "Image Sequence" di editor video pada ${fps} fps${audio ? ", lalu tambahkan audio.wav." : "."}\n`);
    blob = await zip!.generateAsync({ type: "blob", compression: "STORE" });
    name = `${base}-png-seq.zip`;
  }
  return { blob, name, frames, bytes: blob.size, seconds: (performance.now() - t0) / 1000, hasAlpha };
}

/** Perkiraan ukuran berkas & waktu render dari beberapa frame contoh. */
export async function estimateExport(o: Pick<ExportOptions, "src" | "cfg" | "assets" | "start" | "end" | "format" | "includeAudio" | "jpegQuality">): Promise<{ bytes: number; renderSeconds: number; frames: number }> {
  const { src, cfg, assets, format } = o;
  const fps = cfg.fps;
  const start = Math.max(0, o.start);
  const end = Math.min(src.duration, o.end);
  const frames = frameCountFor(start, end, fps);
  const { canvas, ctx } = makeCanvas(cfg, format === "mov-rle");
  const analyzer = new VizAnalyzer(cfg, src.sampleRate);
  const probes = Math.min(8, frames);
  let total = 0;
  const t0 = performance.now();
  for (let k = 0; k < probes; k++) {
    const t = start + ((end - start) * (k + 0.5)) / probes;
    const frame = analyzer.analyze(src.getWindows(t, cfg.fftSize), 1 / fps, true);
    renderViz(ctx, cfg, frame, assets, t, src.duration, 1);
    total += format === "mov-rle" ? toArgbSample(ctx, cfg.width, cfg.height).length : format === "mov-jpeg" ? (await canvasBlob(canvas, "image/jpeg", Math.min(1, Math.max(0.3, o.jpegQuality ?? 0.9)))).size : (await canvasBlob(canvas)).size;
  }
  const per = (performance.now() - t0) / 1000 / probes;
  const audioBytes = o.includeAudio ? Math.round((end - start) * Math.min(src.sampleRate, 48000) * 2 * Math.min(2, src.channels.length)) : 0;
  return { bytes: Math.round((total / probes) * frames) + audioBytes, renderSeconds: per * frames, frames };
}
