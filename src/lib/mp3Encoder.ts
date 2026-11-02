// Encoder MP3 (LAME via lamejs — JavaScript murni, tanpa server, tanpa WASM). Dipakai SEMUA alat Audio agar
// ekspor .mp3 (format paling universal) selalu tersedia di browser apa pun.
//
// Catatan teknis:
// - MP3 hanya mendukung laju sampel 8–48 kHz tertentu; sumber di luar daftar (mis. 96 kHz) di-resample ke 44,1 kHz.
// - Sumber >2 kanal diturunkan ke stereo (kanal 1 & 2); 1 kanal tetap mono.
// - Pengodean berjalan per blok dan menyerahkan kendali ke UI secara berkala → halaman tidak membeku.

import { Mp3Encoder } from "@breezystack/lamejs";
import { resamplePcm, yieldUi, type PCM } from "@/lib/audioEditEngine";

export const MP3_BITRATES = [96, 128, 160, 192, 256, 320] as const;
export type Mp3Kbps = (typeof MP3_BITRATES)[number];

const MPEG1_KBPS = [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_KBPS = [8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

const toInt16 = (f: Float32Array): Int16Array => {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
};

export interface Mp3Options {
  kbps?: number;
  /** detik */
  start?: number;
  end?: number;
  /** paksa mono (file lebih kecil) */
  mono?: boolean;
  onProgress?: (p: number) => void;
}

export async function encodeMp3(pcm: PCM, opts: Mp3Options = {}): Promise<Blob> {
  if (!pcm.channels.length || !pcm.channels[0].length) throw new Error("Audio kosong — tidak ada yang bisa diekspor.");
  let kbps = opts.kbps ?? 192;

  let src: PCM = pcm;
  if (!MP3_RATES.includes(src.sampleRate)) src = resamplePcm(src, 44100);
  // Bitrate rendah (<32 kbps) hanya sah pada MPEG-2 (laju sampel ≤24 kHz) → turunkan laju sampel otomatis.
  if (kbps < 32 && src.sampleRate > 24000) src = resamplePcm(src, 22050);
  // LAME hanya menerima bitrate baku; ambil nilai baku terdekat sesuai versi MPEG.
  const table = src.sampleRate >= 32000 ? MPEG1_KBPS : MPEG2_KBPS;
  kbps = table.reduce((best, k) => (Math.abs(k - kbps) < Math.abs(best - kbps) ? k : best), table[0]);

  const total = src.channels[0].length;
  const a = Math.max(0, Math.min(total, Math.floor((opts.start ?? 0) * src.sampleRate)));
  const b = Math.max(a, Math.min(total, opts.end !== undefined ? Math.ceil(opts.end * src.sampleRate) : total));
  if (b - a < 1) throw new Error("Rentang audio kosong.");

  const wantMono = opts.mono || src.channels.length === 1;
  const left = src.channels[0].subarray(a, b);
  const right = wantMono ? null : (src.channels[1] ?? src.channels[0]).subarray(a, b);

  const encoder = new Mp3Encoder(wantMono ? 1 : 2, src.sampleRate, kbps);
  const parts: Uint8Array[] = [];
  const BLOCK = 1152 * 16;
  const n = left.length;
  let sinceYield = 0;
  for (let i = 0; i < n; i += BLOCK) {
    const l = toInt16(left.subarray(i, Math.min(n, i + BLOCK)));
    const chunk = wantMono || !right ? encoder.encodeBuffer(l) : encoder.encodeBuffer(l, toInt16(right.subarray(i, Math.min(n, i + BLOCK))));
    if (chunk.length) parts.push(new Uint8Array(chunk));
    if (++sinceYield >= 12) {
      sinceYield = 0;
      opts.onProgress?.(Math.min(0.99, i / n));
      await yieldUi();
    }
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(new Uint8Array(tail));
  opts.onProgress?.(1);
  return new Blob(parts as BlobPart[], { type: "audio/mpeg" });
}

/** Mengubah AudioBuffer (hasil decodeAudioData) menjadi PCM. */
export function audioBufferToPcm(buf: AudioBuffer): PCM {
  return { sampleRate: buf.sampleRate, channels: Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c)) };
}

/**
 * Mengambil audio dari berkas video/audio apa pun yang bisa didekode browser lalu meng-encode ke MP3.
 * Bukan real-time (berbeda dengan perekaman MediaRecorder), sehingga ekstraksi video panjang pun cepat.
 */
export async function extractAudioToMp3(
  file: File,
  opts: { kbps: number; start?: number; end?: number; onProgress?: (p: number) => void }
): Promise<Blob> {
  const { decodeFileToPcm } = await import("@/lib/audioDecode");
  opts.onProgress?.(0.05);
  const pcm = await decodeFileToPcm(file);
  opts.onProgress?.(0.25);
  return encodeMp3(pcm, { kbps: opts.kbps, start: opts.start, end: opts.end, onProgress: (p) => opts.onProgress?.(0.25 + p * 0.75) });
}
