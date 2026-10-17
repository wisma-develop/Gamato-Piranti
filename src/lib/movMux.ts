// Penulis berkas QuickTime (.mov) buatan sendiri — tanpa dependensi.
//
// Video : kodek `png ` (setiap frame = berkas PNG RGBA lurus, transparan penuh), ATAU
//         `rle ` (Apple Animation 32-bit ARGB, lossless, kompatibel luas di editor video), ATAU
//         `jpeg` (Photo-JPEG, tanpa alpha — untuk latar penuh, ukuran jauh lebih kecil).
// Audio : PCM 16-bit little-endian (`sowt`) — didukung native QuickTime/Premiere/FCP/DaVinci.
// Tata letak: [ftyp][wide|mdat 16 byte][data frame + audio berselang-seling tiap 1 detik][moov].
// Header mdat selalu 16 byte (`wide`+`mdat` atau mdat 64-bit) sehingga berkas >4 GB tetap sah.

export type MovVideoCodec = "png" | "rle" | "jpeg";

export interface MovOptions {
  width: number;
  height: number;
  /** Bilangan bulat (24, 25, 30, 50, 60, …). */
  fps: number;
  codec: MovVideoCodec;
  /** true = mode grafis QuickTime ‘dither copy + alpha’ pada vmhd (latar transparan); false = salin biasa. */
  hasAlpha: boolean;
  audio?: { sampleRate: number; channels: number; /** interleaved Int16 */ pcm: Int16Array };
}

class Bytes {
  private chunks: Uint8Array[] = [];
  private len = 0;
  u8(v: number) { const a = new Uint8Array(1); a[0] = v & 255; return this.push(a); }
  u16(v: number) { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, v >>> 0 & 0xffff); return this.push(a); }
  i16(v: number) { const a = new Uint8Array(2); new DataView(a.buffer).setInt16(0, v); return this.push(a); }
  u32(v: number) { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, v >>> 0); return this.push(a); }
  u64(v: number) { const a = new Uint8Array(8); const dv = new DataView(a.buffer); dv.setUint32(0, Math.floor(v / 4294967296)); dv.setUint32(4, v >>> 0); return this.push(a); }
  fourcc(s: string) { const a = new Uint8Array(4); for (let i = 0; i < 4; i++) a[i] = s.charCodeAt(i) & 255; return this.push(a); }
  zeros(n: number) { return this.push(new Uint8Array(n)); }
  raw(a: Uint8Array) { return this.push(a); }
  fixed16(v: number) { return this.u32(Math.round(v * 65536)); }
  private push(a: Uint8Array) { this.chunks.push(a); this.len += a.length; return this; }
  get length() { return this.len; }
  done(): Uint8Array {
    const out = new Uint8Array(this.len);
    let o = 0;
    for (const c of this.chunks) { out.set(c, o); o += c.length; }
    return out;
  }
}

function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  let size = 8;
  for (const p of payload) size += p.length;
  const b = new Bytes().u32(size).fourcc(type);
  for (const p of payload) b.raw(p);
  return b.done();
}
const fullbox = (type: string, version: number, flags: number, ...payload: Uint8Array[]) =>
  box(type, new Bytes().u8(version).u8((flags >> 16) & 255).u8((flags >> 8) & 255).u8(flags & 255).done(), ...payload);

const MATRIX = new Bytes()
  .u32(0x00010000).u32(0).u32(0)
  .u32(0).u32(0x00010000).u32(0)
  .u32(0).u32(0).u32(0x40000000)
  .done();

const MAC_EPOCH_OFFSET = 2082844800; // 1904 → 1970

export class MovWriter {
  private parts: BlobPart[] = [];
  private pos: number; // posisi absolut berikutnya di berkas
  private o: MovOptions;
  private ftyp: Uint8Array;
  private videoSizes: number[] = [];
  private videoChunks: number[] = []; // offset
  private videoChunkSamples: number[] = [];
  private pendingVideo = 0;
  private pendingVideoStart = -1;
  private audioChunks: number[] = [];
  private audioChunkSamples: number[] = [];
  private audioFramesWritten = 0;
  private audioTotalFrames: number;
  private mdatBytes = 0;
  private finished = false;

  constructor(o: MovOptions) {
    if (!Number.isInteger(o.fps) || o.fps < 1 || o.fps > 240) throw new Error("FPS harus bilangan bulat 1–240.");
    if (o.audio && (o.audio.sampleRate < 8000 || o.audio.sampleRate > 65535)) throw new Error("Sample rate audio di luar rentang MOV.");
    this.o = o;
    this.ftyp = box("ftyp", new Bytes().fourcc("qt  ").u32(0x20050300).fourcc("qt  ").done());
    this.parts.push(this.ftyp as BlobPart);
    this.parts.push(new Uint8Array(16) as BlobPart); // placeholder header mdat — diisi saat finish()
    this.pos = this.ftyp.length + 16;
    this.audioTotalFrames = o.audio ? Math.floor(o.audio.pcm.length / o.audio.channels) : 0;
  }

  get frameCount() { return this.videoSizes.length; }
  get bytesWritten() { return this.mdatBytes; }

  private write(data: Blob | Uint8Array) {
    const size = data instanceof Blob ? data.size : data.length;
    this.parts.push(data as BlobPart);
    this.pos += size;
    this.mdatBytes += size;
    return size;
  }

  /** Tambahkan satu frame video (sampel PNG utuh, atau data RLE). */
  addVideoFrame(sample: Blob | Uint8Array) {
    if (this.finished) throw new Error("Berkas sudah selesai ditulis.");
    if (this.pendingVideo === 0) this.pendingVideoStart = this.pos;
    const size = this.write(sample);
    this.videoSizes.push(size);
    this.pendingVideo++;
    if (this.pendingVideo === this.o.fps) {
      this.closeVideoChunk();
      this.writeAudioSecond();
    }
  }

  private closeVideoChunk() {
    if (this.pendingVideo > 0) {
      this.videoChunks.push(this.pendingVideoStart);
      this.videoChunkSamples.push(this.pendingVideo);
      this.pendingVideo = 0;
    }
  }

  private writeAudioSecond(final = false) {
    const a = this.o.audio;
    if (!a) return;
    const remaining = this.audioTotalFrames - this.audioFramesWritten;
    if (remaining <= 0) return;
    const n = final ? remaining : Math.min(a.sampleRate, remaining);
    const start = this.audioFramesWritten * a.channels;
    const slice = a.pcm.subarray(start, start + n * a.channels);
    this.audioChunks.push(this.pos);
    this.audioChunkSamples.push(n);
    this.write(new Uint8Array(slice.buffer, slice.byteOffset, slice.byteLength));
    this.audioFramesWritten += n;
  }

  finish(): Blob {
    if (this.finished) throw new Error("Sudah selesai.");
    this.finished = true;
    this.closeVideoChunk();
    this.writeAudioSecond(true);
    const frames = this.videoSizes.length;
    if (frames === 0) throw new Error("Tidak ada frame yang ditulis.");

    // Header mdat 16 byte
    const hdr = new Bytes();
    const total = this.mdatBytes + 8; // ukuran atom mdat standar = 8 + data
    if (total < 0xffffffff) hdr.u32(8).fourcc("wide").u32(total).fourcc("mdat");
    else hdr.u32(1).fourcc("mdat").u64(this.mdatBytes + 16);
    this.parts[1] = hdr.done() as BlobPart;

    const moov = this.buildMoov();
    this.parts.push(moov as BlobPart);
    return new Blob(this.parts, { type: "video/quicktime" });
  }

  private buildMoov(): Uint8Array {
    const o = this.o;
    const frames = this.videoSizes.length;
    const MOVIE_TS = 1000;
    const durationMs = Math.round((frames / o.fps) * MOVIE_TS);
    const now = Math.floor(Date.now() / 1000) + MAC_EPOCH_OFFSET;
    const hasAudio = !!o.audio;
    const mvhd = fullbox("mvhd", 0, 0, new Bytes()
      .u32(now).u32(now).u32(MOVIE_TS).u32(durationMs)
      .u32(0x00010000).u16(0x0100).zeros(10).raw(MATRIX)
      .zeros(24).u32(hasAudio ? 3 : 2).done());

    const traks = [this.buildVideoTrak(1, durationMs, now)];
    if (hasAudio) traks.push(this.buildAudioTrak(2, durationMs, now));
    return box("moov", mvhd, ...traks);
  }

  private tkhd(id: number, durationMs: number, now: number, w: number, h: number, volume: number): Uint8Array {
    return fullbox("tkhd", 0, 0x0f, new Bytes()
      .u32(now).u32(now).u32(id).u32(0).u32(durationMs)
      .zeros(8).u16(0).u16(0).u16(volume).u16(0).raw(MATRIX)
      .fixed16(w).fixed16(h).done());
  }

  private mdhd(timescale: number, duration: number, now: number): Uint8Array {
    return fullbox("mdhd", 0, 0, new Bytes().u32(now).u32(now).u32(timescale).u32(duration).u16(0x55c4).u16(0).done());
  }

  private hdlr(kind: "vide" | "soun", name: string): Uint8Array {
    const nm = new TextEncoder().encode(name);
    return fullbox("hdlr", 0, 0, new Bytes().fourcc("mhlr").fourcc(kind).u32(0).u32(0).u32(0).u8(nm.length).raw(nm).done());
  }

  private dinf(): Uint8Array {
    return box("dinf", fullbox("dref", 0, 0, new Bytes().u32(1).raw(fullbox("url ", 0, 1)).done()));
  }

  private stsc(counts: number[]): Uint8Array {
    // Ringkas: entri baru hanya saat jumlah sampel per chunk berubah.
    const entries: [number, number][] = [];
    counts.forEach((c, i) => { if (!entries.length || entries[entries.length - 1][1] !== c) entries.push([i + 1, c]); });
    const b = new Bytes().u32(entries.length);
    for (const [first, n] of entries) b.u32(first).u32(n).u32(1);
    return fullbox("stsc", 0, 0, b.done());
  }

  private stco(offsets: number[]): Uint8Array {
    const big = offsets.some((x) => x > 0xffffffff);
    const b = new Bytes().u32(offsets.length);
    for (const x of offsets) big ? b.u64(x) : b.u32(x);
    return fullbox(big ? "co64" : "stco", 0, 0, b.done());
  }

  private buildVideoTrak(id: number, durationMs: number, now: number): Uint8Array {
    const o = this.o;
    const frames = this.videoSizes.length;
    const FRAME_UNITS = 100;
    const ts = o.fps * FRAME_UNITS;
    const fourcc = o.codec === "png" ? "png " : o.codec === "rle" ? "rle " : "jpeg";
    const name = o.codec === "png" ? "PNG" : o.codec === "rle" ? "Animation" : "Photo - JPEG";
    const cn = new TextEncoder().encode(name);
    const comp = new Uint8Array(32);
    comp[0] = cn.length;
    comp.set(cn, 1);
    const entry = new Bytes()
      .zeros(6).u16(1)
      .u16(0).u16(0).u32(0).u32(0).u32(0x200)
      .u16(o.width).u16(o.height).u32(0x00480000).u32(0x00480000).u32(0).u16(1)
      .raw(comp).u16(o.codec === "jpeg" ? 24 : 32).i16(-1).done(); // PNG/RLE kita RGBA/ARGB (32 bit); JPEG tanpa alpha (24 bit)
    const stsd = fullbox("stsd", 0, 0, new Bytes().u32(1).raw(box(fourcc, entry)).done());
    const stts = fullbox("stts", 0, 0, new Bytes().u32(1).u32(frames).u32(FRAME_UNITS).done());
    const stsc = this.stsc(this.videoChunkSamples);
    const sz = new Bytes().u32(0).u32(frames);
    for (const s of this.videoSizes) sz.u32(s);
    const stsz = fullbox("stsz", 0, 0, sz.done());
    const stco = this.stco(this.videoChunks);
    const stbl = box("stbl", stsd, stts, stsc, stsz, stco);
    const vmhd = fullbox("vmhd", 0, 1, new Bytes().u16(o.hasAlpha ? 0x0040 : 0).u16(0).u16(0).u16(0).done());
    const minf = box("minf", vmhd, this.dinf(), stbl);
    const mdia = box("mdia", this.mdhd(ts, frames * FRAME_UNITS, now), this.hdlr("vide", "Gamato Video"), minf);
    return box("trak", this.tkhd(id, durationMs, now, o.width, o.height, 0), mdia);
  }

  private buildAudioTrak(id: number, durationMs: number, now: number): Uint8Array {
    const a = this.o.audio!;
    const total = this.audioTotalFrames;
    const entry = new Bytes()
      .zeros(6).u16(1)
      .u16(0).u16(0).u32(0)
      .u16(a.channels).u16(16).u16(0).u16(0).u32(a.sampleRate << 16).done();
    const stsd = fullbox("stsd", 0, 0, new Bytes().u32(1).raw(box("sowt", entry)).done());
    const stts = fullbox("stts", 0, 0, new Bytes().u32(1).u32(total).u32(1).done());
    const stsc = this.stsc(this.audioChunkSamples);
    const stsz = fullbox("stsz", 0, 0, new Bytes().u32(a.channels * 2).u32(total).done());
    const stco = this.stco(this.audioChunks);
    const stbl = box("stbl", stsd, stts, stsc, stsz, stco);
    const smhd = fullbox("smhd", 0, 0, new Bytes().u16(0).u16(0).done());
    const minf = box("minf", smhd, this.dinf(), stbl);
    const mdia = box("mdia", this.mdhd(a.sampleRate, total, now), this.hdlr("soun", "Gamato Audio"), minf);
    return box("trak", this.tkhd(id, durationMs, now, 0, 0, 0x0100), mdia);
  }
}

// ── Pengodean frame ──────────────────────────────────────────────────────

/**
 * Apple Animation (QuickTime RLE) 32-bit ARGB, frame penuh (keyframe).
 * Format baris: [skip=1] lalu kode: n>0 → salin n piksel literal; n<0 → ulang piksel -n kali; 0xFF (-1) → akhir baris.
 */
export function encodeQtRle32(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Uint8Array {
  // Perkiraan terburuk: tiap baris = 1 skip + (1 kode per 127 piksel + 4 byte/piksel) + 1 akhir
  const worst = 6 + height * (2 + Math.ceil(width / 127) + width * 4 + 1);
  const out = new Uint8Array(worst);
  let o = 4; // 4 byte ukuran chunk diisi nanti
  out[o++] = 0; out[o++] = 0; // header 0x0000 = frame penuh
  const px = (i: number) => i * 4;
  for (let y = 0; y < height; y++) {
    out[o++] = 1; // mulai di piksel 0
    const row = y * width;
    let x = 0;
    while (x < width) {
      // Hitung panjang ulangan piksel yang sama
      const p = px(row + x);
      let run = 1;
      while (x + run < width && run < 127) {
        const q = px(row + x + run);
        if (rgba[q] !== rgba[p] || rgba[q + 1] !== rgba[p + 1] || rgba[q + 2] !== rgba[p + 2] || rgba[q + 3] !== rgba[p + 3]) break;
        run++;
      }
      if (run >= 3) {
        out[o++] = (256 - run) & 255; // -run
        out[o++] = rgba[p + 3]; out[o++] = rgba[p]; out[o++] = rgba[p + 1]; out[o++] = rgba[p + 2];
        x += run;
      } else {
        // literal: kumpulkan sampai ketemu ulangan ≥3 atau 127 piksel
        let n = 0;
        const start = x;
        while (x < width && n < 127) {
          if (x + 2 < width) {
            const a = px(row + x), b = px(row + x + 1), c = px(row + x + 2);
            const same = rgba[a] === rgba[b] && rgba[a + 1] === rgba[b + 1] && rgba[a + 2] === rgba[b + 2] && rgba[a + 3] === rgba[b + 3] &&
              rgba[b] === rgba[c] && rgba[b + 1] === rgba[c + 1] && rgba[b + 2] === rgba[c + 2] && rgba[b + 3] === rgba[c + 3];
            if (same) break; // ≥3 sama: serahkan ke cabang ulangan (n===0 tak mungkin: run<3 di awal)
          }
          x++; n++;
        }
        if (n === 0) { n = 1; x = start + 1; }
        out[o++] = n;
        for (let k = 0; k < n; k++) {
          const q = px(row + start + k);
          out[o++] = rgba[q + 3]; out[o++] = rgba[q]; out[o++] = rgba[q + 1]; out[o++] = rgba[q + 2];
        }
      }
    }
    out[o++] = 0xff; // akhir baris
  }
  // Perataan ke 2 byte (spesifikasi) — tambahkan 2 byte nol bila ganjil
  if (o & 1) out[o++] = 0;
  new DataView(out.buffer).setUint32(0, o);
  return out.slice(0, o);
}
