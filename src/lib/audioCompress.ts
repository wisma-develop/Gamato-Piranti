// Audio compression engine.
//
// Fast path: WebCodecs AudioEncoder (Opus) → hand-written Ogg muxer (RFC 3533 /
// RFC 7845). Runs far faster than real time and honours the requested bitrate
// exactly, unlike MediaRecorder. Fallbacks (MediaRecorder / WAV) live in the UI.

import { PCM, pcmFrames, resamplePcm, toMono, yieldUi } from "@/lib/audioEditEngine";

export async function isOpusEncoderSupported(): Promise<boolean> {
  try {
    const AE = (globalThis as any).AudioEncoder;
    if (!AE || typeof AE.isConfigSupported !== "function") return false;
    const r = await AE.isConfigSupported({ codec: "opus", sampleRate: 48000, numberOfChannels: 2, bitrate: 64000 });
    return !!r?.supported;
  } catch {
    return false;
  }
}

/* ───────────────────────────── Ogg muxer ───────────────────────────── */

let crcTable: Uint32Array | null = null;
function oggCrc(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let r = i << 24;
      for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
      crcTable[i] = r >>> 0;
    }
  }
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) crc = ((crc << 8) ^ crcTable[((crc >>> 24) ^ bytes[i]) & 0xff]) >>> 0;
  return crc >>> 0;
}

function makePage(packets: Uint8Array[], headerType: number, granule: number, serial: number, seq: number, continued = false): Uint8Array {
  const lacing: number[] = [];
  for (const p of packets) {
    let n = p.length;
    while (n >= 255) { lacing.push(255); n -= 255; }
    lacing.push(n);
  }
  if (lacing.length > 255) throw new Error("Halaman Ogg terlalu besar.");
  const bodyLen = packets.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(27 + lacing.length + bodyLen);
  const v = new DataView(out.buffer);
  out.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS"
  out[4] = 0;
  out[5] = headerType | (continued ? 1 : 0);
  // 64-bit granule position (little endian); values stay < 2^53
  v.setUint32(6, granule >>> 0, true);
  v.setUint32(10, Math.floor(granule / 4294967296) >>> 0, true);
  v.setUint32(14, serial, true);
  v.setUint32(18, seq, true);
  v.setUint32(22, 0, true);
  out[26] = lacing.length;
  out.set(lacing, 27);
  let o = 27 + lacing.length;
  for (const p of packets) { out.set(p, o); o += p.length; }
  v.setUint32(22, oggCrc(out), true);
  return out;
}

function opusHead(channels: number, inputRate: number, preSkip: number): Uint8Array {
  const b = new Uint8Array(19);
  const v = new DataView(b.buffer);
  b.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // OpusHead
  b[8] = 1;
  b[9] = channels;
  v.setUint16(10, preSkip, true);
  v.setUint32(12, inputRate, true);
  v.setInt16(16, 0, true);
  b[18] = 0; // channel mapping family 0 (mono/stereo)
  return b;
}

function opusTags(): Uint8Array {
  const vendor = new TextEncoder().encode("Gamato Piranti");
  const b = new Uint8Array(8 + 4 + vendor.length + 4);
  const v = new DataView(b.buffer);
  b.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 0); // OpusTags
  v.setUint32(8, vendor.length, true);
  b.set(vendor, 12);
  v.setUint32(12 + vendor.length, 0, true);
  return b;
}

/** Packs encoded Opus packets into an Ogg Opus stream. */
export function muxOggOpus(packets: { data: Uint8Array; samples: number }[], channels: number, inputRate: number, preSkip: number, totalInputFrames: number): Blob {
  const serial = (Math.random() * 0xffffffff) >>> 0;
  const parts: Uint8Array[] = [];
  let seq = 0;
  parts.push(makePage([opusHead(channels, inputRate, preSkip)], 0x02, 0, serial, seq++));
  parts.push(makePage([opusTags()], 0, 0, serial, seq++));
  let granule = preSkip;
  const finalGranule = preSkip + totalInputFrames;
  let batch: Uint8Array[] = [];
  let segs = 0;
  const flush = (last: boolean) => {
    if (!batch.length) return;
    parts.push(makePage(batch, last ? 0x04 : 0, last ? Math.min(granule, finalGranule) : granule, serial, seq++));
    batch = [];
    segs = 0;
  };
  for (let i = 0; i < packets.length; i++) {
    const p = packets[i];
    const need = Math.floor(p.data.length / 255) + 1;
    if (segs + need > 255 || batch.length >= 50) flush(false);
    batch.push(p.data);
    segs += need;
    granule += p.samples;
  }
  // The last page's granule position marks the real end of the audio, so decoders trim the encoder's padding.
  flush(true);
  return new Blob(parts as BlobPart[], { type: "audio/ogg" });
}

/* ───────────────────────────── encoder ───────────────────────────── */

export interface OpusOptions {
  bitrate: number; // bits per second (total)
  mono: boolean;
  application: "audio" | "voip";
  onProgress?: (f: number) => void;
  signal?: { cancelled: boolean };
}

export async function encodeOpusOgg(source: PCM, o: OpusOptions): Promise<Blob> {
  const AE = (globalThis as any).AudioEncoder;
  const AD = (globalThis as any).AudioData;
  if (!AE || !AD) throw new Error("Browser ini belum mendukung WebCodecs AudioEncoder.");

  let pcm = source.channels.length > 2 ? { sampleRate: source.sampleRate, channels: source.channels.slice(0, 2) } : source;
  if (o.mono && pcm.channels.length > 1) pcm = toMono(pcm);
  if (pcm.sampleRate !== 48000) pcm = resamplePcm(pcm, 48000);
  const nCh = pcm.channels.length;
  const total = pcmFrames(pcm);
  if (total === 0) throw new Error("Audio kosong.");

  const bitrate = Math.max(6000, Math.min(510000 * nCh, Math.round(o.bitrate)));
  const packets: { data: Uint8Array; samples: number }[] = [];
  let preSkip = 312;
  let encError: Error | null = null;

  const encoder = new AE({
    output: (chunk: any, meta: any) => {
      const d = new Uint8Array(chunk.byteLength);
      chunk.copyTo(d);
      const desc = meta?.decoderConfig?.description;
      if (desc && !packets.length) {
        const dv = new Uint8Array(desc instanceof ArrayBuffer ? desc : (desc as ArrayBufferView).buffer);
        if (dv.length >= 12 && dv[0] === 0x4f && dv[1] === 0x70) preSkip = dv[10] | (dv[11] << 8);
      }
      const samples = Math.round(((chunk.duration || 20000) * 48000) / 1_000_000);
      packets.push({ data: d, samples });
    },
    error: (e: Error) => { encError = e; },
  });
  encoder.configure({
    codec: "opus",
    sampleRate: 48000,
    numberOfChannels: nCh,
    bitrate,
    opus: { application: o.application, frameDuration: 20000, complexity: 10, signal: o.application === "voip" ? "voice" : "auto", useinbandfec: false, usedtx: false },
  });

  const CH = 48000; // feed one second at a time
  for (let off = 0; off < total; off += CH) {
    if (o.signal?.cancelled) { try { encoder.close(); } catch { /* noop */ } throw new Error("Dibatalkan."); }
    if (encError) throw encError;
    const n = Math.min(CH, total - off);
    const planar = new Float32Array(n * nCh);
    for (let c = 0; c < nCh; c++) planar.set(pcm.channels[c].subarray(off, off + n), c * n);
    const data = new AD({ format: "f32-planar", sampleRate: 48000, numberOfFrames: n, numberOfChannels: nCh, timestamp: Math.round((off / 48000) * 1_000_000), data: planar });
    encoder.encode(data);
    data.close();
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 2));
    o.onProgress?.(Math.min(0.97, (off + n) / total));
    await yieldUi();
  }
  await encoder.flush();
  encoder.close();
  if (encError) throw encError;
  if (!packets.length) throw new Error("Encoder tidak menghasilkan data.");
  o.onProgress?.(1);
  return muxOggOpus(packets, nCh, source.sampleRate, preSkip, total);
}

/* ───────────────────────────── presets ───────────────────────────── */

export interface CompressPreset {
  id: string;
  label: string;
  desc: string;
  kbps: number;
  mono: boolean;
  application: "audio" | "voip";
}

export const COMPRESS_PRESETS: CompressPreset[] = [
  { id: "vn", label: "Sangat kecil", desc: "Voice note / chat — 16 kbps mono", kbps: 16, mono: true, application: "voip" },
  { id: "voice", label: "Suara & rapat", desc: "Rekaman bicara — 24 kbps mono", kbps: 24, mono: true, application: "voip" },
  { id: "podcast", label: "Podcast", desc: "Bicara jernih — 48 kbps mono", kbps: 48, mono: true, application: "audio" },
  { id: "music", label: "Musik hemat", desc: "Stereo — 96 kbps", kbps: 96, mono: false, application: "audio" },
  { id: "hq", label: "Musik kualitas tinggi", desc: "Stereo — 160 kbps", kbps: 160, mono: false, application: "audio" },
];

export const fmtBytes = (n: number): string => (n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);
