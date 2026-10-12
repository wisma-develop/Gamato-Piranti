// Shared audio decoding helpers (used by the audio editor and the transcriber).

import type { PCM } from "@/lib/audioEditEngine";
import { peekWavSampleRate } from "@/lib/audioEditEngine";

/** Reads the sample rate of an MP3 (skips ID3v2, finds first frame header) or null. */
export function peekMp3SampleRate(buf: ArrayBuffer): number | null {
  const v = new Uint8Array(buf);
  let o = 0;
  if (v.length > 10 && v[0] === 0x49 && v[1] === 0x44 && v[2] === 0x33) o = 10 + (((v[6] & 0x7f) << 21) | ((v[7] & 0x7f) << 14) | ((v[8] & 0x7f) << 7) | (v[9] & 0x7f));
  for (let i = o; i < Math.min(v.length - 4, o + 8192); i++) {
    if (v[i] === 0xff && (v[i + 1] & 0xe0) === 0xe0) {
      const ver = (v[i + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
      const idx = (v[i + 2] >> 2) & 3;
      if (ver === 1 || idx === 3) continue;
      const base = [44100, 48000, 32000][idx];
      return ver === 3 ? base : ver === 2 ? base / 2 : base / 4;
    }
  }
  return null;
}

export async function decodeFileToPcm(file: File): Promise<PCM> {
  const ab = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const hint = peekWavSampleRate(ab) ?? peekMp3SampleRate(ab);
  let ctx: AudioContext;
  try {
    ctx = hint && hint >= 8000 && hint <= 96000 ? new AudioCtx({ sampleRate: hint }) : new AudioCtx();
  } catch {
    ctx = new AudioCtx();
  }
  try {
    const buf = await ctx.decodeAudioData(ab.slice(0));
    return { sampleRate: buf.sampleRate, channels: Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c).slice()) };
  } catch {
    throw new Error(`"${file.name}" tidak bisa dibaca. Coba MP3, WAV, OGG, M4A, FLAC, atau video yang berisi audio.`);
  } finally {
    ctx.close().catch(() => {});
  }
}

