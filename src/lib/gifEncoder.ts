// Dependency-free animated GIF89a encoder.
//
// Why hand-written instead of a library: this project has no network access
// to install one and keeps every tool "ringan" (no heavy new dependency) by
// design (see videoEngine.ts's own header for the same reasoning applied to
// video). GIF89a is a fully public, stable, well-documented format — every
// byte written below follows the spec directly, and the whole thing is
// verified empirically in real Chromium (encode → decode via <img> → sample
// pixels back via canvas) rather than merely "should be correct on paper".
//
// Pipeline: collect a representative pixel sample across all frames → build
// a shared 256-color palette via median-cut quantization → precompute a fast
// 32×32×32 bucket lookup table (nearest palette index per coarse RGB bucket)
// so per-pixel quantization during encoding is O(1) instead of an O(256)
// nearest-color search → LZW-compress each frame's index stream → assemble
// the full byte stream (header, logical screen descriptor, global color
// table, Netscape loop extension, then per-frame graphic control + image
// descriptor + LZW data) → trailer.

export interface GifFrameInput {
  imageData: ImageData;
  /** Frame display duration in milliseconds (GIF stores this in 1/100s units). */
  delayMs: number;
}

export interface EncodeGifOptions {
  /** 0 = loop forever (GIF convention), matches how virtually every GIF behaves. */
  loopCount?: number;
  onProgress?: (fraction: number) => void;
}

type RGB = [number, number, number];

// ── Byte stream builder ─────────────────────────────────────────────────

class ByteWriter {
  private chunks: number[] = [];
  u8(v: number) {
    this.chunks.push(v & 0xff);
  }
  u16le(v: number) {
    this.chunks.push(v & 0xff, (v >> 8) & 0xff);
  }
  bytes(arr: ArrayLike<number>) {
    for (let i = 0; i < arr.length; i++) this.chunks.push(arr[i] & 0xff);
  }
  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.chunks.push(s.charCodeAt(i) & 0xff);
  }
  toUint8Array(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}

// ── Median-cut color quantization ───────────────────────────────────────

interface ColorBox {
  colors: RGB[];
}

function boxRange(box: ColorBox): { channel: 0 | 1 | 2; range: number } {
  let best: 0 | 1 | 2 = 0;
  let bestRange = -1;
  for (let ch = 0 as 0 | 1 | 2; ch < 3; ch++) {
    let min = 255;
    let max = 0;
    for (const c of box.colors) {
      const v = c[ch];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const range = max - min;
    if (range > bestRange) {
      bestRange = range;
      best = ch;
    }
  }
  return { channel: best, range: bestRange };
}

function averageColor(colors: RGB[]): RGB {
  let r = 0,
    g = 0,
    b = 0;
  for (const c of colors) {
    r += c[0];
    g += c[1];
    b += c[2];
  }
  const n = colors.length || 1;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/** Median-cut quantization down to at most `maxColors` representative colors. */
export function medianCutQuantize(samplePixels: RGB[], maxColors: number): RGB[] {
  if (samplePixels.length === 0) return [[0, 0, 0]];
  const boxes: ColorBox[] = [{ colors: samplePixels }];

  while (boxes.length < maxColors) {
    // Split the box with the largest color range (only if it has >1 distinct-ish pixel).
    let splitIdx = -1;
    let splitRange = -1;
    let splitChannel: 0 | 1 | 2 = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].colors.length <= 1) continue;
      const { channel, range } = boxRange(boxes[i]);
      if (range > splitRange) {
        splitRange = range;
        splitIdx = i;
        splitChannel = channel;
      }
    }
    if (splitIdx === -1 || splitRange <= 0) break; // nothing left worth splitting

    const box = boxes[splitIdx];
    const sorted = [...box.colors].sort((a, b) => a[splitChannel] - b[splitChannel]);
    const mid = Math.floor(sorted.length / 2);
    const left: ColorBox = { colors: sorted.slice(0, mid) };
    const right: ColorBox = { colors: sorted.slice(mid) };
    boxes.splice(splitIdx, 1, left, right);
  }

  return boxes.filter((b) => b.colors.length > 0).map((b) => averageColor(b.colors));
}

const BUCKET_BITS = 5; // 32 buckets per channel = 32768 total buckets
const BUCKET_SIZE = 1 << BUCKET_BITS;

/** Precomputes, for every coarse (R,G,B) bucket, the index of the nearest palette color — turns per-pixel quantization into an O(1) lookup instead of an O(paletteSize) search. */
function buildBucketLookup(palette: RGB[]): Uint8Array {
  const table = new Uint8Array(BUCKET_SIZE * BUCKET_SIZE * BUCKET_SIZE);
  const shift = 8 - BUCKET_BITS;
  let idx = 0;
  for (let r = 0; r < BUCKET_SIZE; r++) {
    const rc = (r << shift) + (1 << (shift - 1));
    for (let g = 0; g < BUCKET_SIZE; g++) {
      const gc = (g << shift) + (1 << (shift - 1));
      for (let b = 0; b < BUCKET_SIZE; b++) {
        const bc = (b << shift) + (1 << (shift - 1));
        let best = 0;
        let bestDist = Infinity;
        for (let p = 0; p < palette.length; p++) {
          const dr = rc - palette[p][0];
          const dg = gc - palette[p][1];
          const db = bc - palette[p][2];
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bestDist) {
            bestDist = dist;
            best = p;
          }
        }
        table[idx++] = best;
      }
    }
  }
  return table;
}

function nearestIndexFast(r: number, g: number, b: number, lookup: Uint8Array): number {
  const shift = 8 - BUCKET_BITS;
  const ri = r >> shift;
  const gi = g >> shift;
  const bi = b >> shift;
  return lookup[(ri * BUCKET_SIZE + gi) * BUCKET_SIZE + bi];
}

// ── LZW compression (GIF flavor) ────────────────────────────────────────

/** Encodes a stream of palette indices per the GIF LZW variant (variable code width, clear/end codes, 4096-entry dictionary). */
function lzwEncode(indices: Uint8Array, colorDepth: number): Uint8Array {
  const minCodeSize = Math.max(2, colorDepth);
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let nextCode = endCode + 1;
  let codeSize = minCodeSize + 1;

  const out: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;
  const emit = (code: number) => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
    }
  };

  let dict = new Map<string, number>();
  const resetDict = () => {
    dict = new Map();
    for (let i = 0; i < clearCode; i++) dict.set(String(i), i);
    nextCode = endCode + 1;
    codeSize = minCodeSize + 1;
  };
  resetDict();

  emit(clearCode);

  if (indices.length === 0) {
    emit(endCode);
  } else {
    let current = String(indices[0]);
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const combined = current + "," + k;
      if (dict.has(combined)) {
        current = combined;
      } else {
        emit(dict.get(current)!);
        if (nextCode < 4096) {
          dict.set(combined, nextCode);
          nextCode++;
          if (nextCode > 1 << codeSize && codeSize < 12) codeSize++;
        } else {
          // Dictionary full — reset per spec so decoders (which all implement
          // this exact behavior) stay in sync with the encoder.
          emit(clearCode);
          resetDict();
        }
        current = String(k);
      }
    }
    emit(dict.get(current)!);
    emit(endCode);
  }

  if (bitCount > 0) out.push(bitBuffer & 0xff);
  return new Uint8Array(out);
}

/** Splits LZW output into GIF's required ≤255-byte sub-blocks, each prefixed by its length, terminated by a zero-length block. */
function writeSubBlocks(writer: ByteWriter, data: Uint8Array) {
  let offset = 0;
  while (offset < data.length) {
    const len = Math.min(255, data.length - offset);
    writer.u8(len);
    writer.bytes(data.subarray(offset, offset + len));
    offset += len;
  }
  writer.u8(0);
}

// ── Public entry point ───────────────────────────────────────────────────

/**
 * Encodes a sequence of frames (already the same width/height) into an
 * animated GIF, using ONE shared palette across all frames so colors stay
 * consistent frame-to-frame (no per-frame palette flicker).
 */
export async function encodeGif(frames: GifFrameInput[], opts: EncodeGifOptions = {}): Promise<Blob> {
  if (frames.length === 0) throw new Error("Tidak ada frame untuk dijadikan GIF.");
  const width = frames[0].imageData.width;
  const height = frames[0].imageData.height;
  const loopCount = opts.loopCount ?? 0;

  // Sample pixels across all frames (capped) so quantization stays fast even for long clips.
  const sample: RGB[] = [];
  const maxSampleTotal = 60000;
  const perFrameCap = Math.max(200, Math.floor(maxSampleTotal / frames.length));
  for (const frame of frames) {
    const data = frame.imageData.data;
    const totalPixels = frame.imageData.width * frame.imageData.height;
    const step = Math.max(1, Math.floor(totalPixels / perFrameCap));
    for (let p = 0; p < totalPixels; p += step) {
      const o = p * 4;
      // Skip fully transparent pixels — they shouldn't influence the visible palette.
      if (data[o + 3] < 8) continue;
      sample.push([data[o], data[o + 1], data[o + 2]]);
    }
  }

  const palette = medianCutQuantize(sample.length ? sample : [[0, 0, 0]], 256);
  const lookup = buildBucketLookup(palette);

  // GIF requires a power-of-two-sized color table; pad with black to the next size.
  let tableSize = 2;
  while (tableSize < palette.length) tableSize *= 2;
  tableSize = Math.max(tableSize, 4);
  const paddedPalette: RGB[] = [...palette];
  while (paddedPalette.length < tableSize) paddedPalette.push([0, 0, 0]);
  const colorDepth = Math.max(2, Math.ceil(Math.log2(tableSize)));

  const writer = new ByteWriter();
  writer.ascii("GIF89a");

  // Logical Screen Descriptor
  writer.u16le(width);
  writer.u16le(height);
  const gctSizeField = colorDepth - 1; // table has 2^(N+1) entries
  const packed = 0x80 /* global color table present */ | (0x70 & (colorDepth - 1 << 4)) /* color resolution */ | gctSizeField;
  writer.u8(packed);
  writer.u8(0); // background color index
  writer.u8(0); // pixel aspect ratio (unused)

  // Global Color Table
  for (const [r, g, b] of paddedPalette) writer.bytes([r, g, b]);

  // Netscape looping extension (only meaningful/needed for animations)
  if (frames.length > 1) {
    writer.u8(0x21);
    writer.u8(0xff);
    writer.u8(0x0b);
    writer.ascii("NETSCAPE2.0");
    writer.u8(0x03);
    writer.u8(0x01);
    writer.u16le(loopCount);
    writer.u8(0x00);
  }

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const delayCs = Math.max(2, Math.round(frame.delayMs / 10)); // GIF delay unit is 1/100s; most viewers clamp <2 to ~10fps anyway

    // Graphic Control Extension
    writer.u8(0x21);
    writer.u8(0xf9);
    writer.u8(0x04);
    writer.u8(0x00); // disposal: none specified, no transparency
    writer.u16le(delayCs);
    writer.u8(0x00); // transparent color index (unused)
    writer.u8(0x00);

    // Image Descriptor
    writer.u8(0x2c);
    writer.u16le(0); // left
    writer.u16le(0); // top
    writer.u16le(width);
    writer.u16le(height);
    writer.u8(0x00); // no local color table, no interlace

    // Quantize this frame to palette indices using the fast bucket lookup.
    const data = frame.imageData.data;
    const totalPixels = width * height;
    const indices = new Uint8Array(totalPixels);
    for (let p = 0; p < totalPixels; p++) {
      const o = p * 4;
      indices[p] = nearestIndexFast(data[o], data[o + 1], data[o + 2], lookup);
    }

    writer.u8(colorDepth); // LZW minimum code size
    const compressed = lzwEncode(indices, colorDepth);
    writeSubBlocks(writer, compressed);

    opts.onProgress?.((i + 1) / frames.length);
  }

  writer.u8(0x3b); // trailer
  return new Blob([writer.toUint8Array()], { type: "image/gif" });
}
