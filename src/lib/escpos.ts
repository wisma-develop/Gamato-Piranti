// Minimal ESC/POS command builder for thermal receipt printers.
//
// We print via the GS v 0 RASTER BITMAP command instead of ESC/POS text
// commands. Rationale: text commands depend on each printer's font/codepage
// support (which varies a lot between clone thermal printers and breaks on
// Indonesian text), while raster bitmap printing sends the exact pixels of
// our canvas — what you see in the preview is what gets printed, on
// virtually any generic ESC/POS thermal printer.

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Initializes the printer (ESC @) — resets any leftover state from a previous job. */
export function escposInit(): Uint8Array {
  return new Uint8Array([0x1b, 0x40]);
}

/** Feeds n blank lines. */
export function escposFeed(lines = 3): Uint8Array {
  return new Uint8Array([0x1b, 0x64, Math.max(0, Math.min(255, lines))]);
}

/** Full or partial paper cut (GS V). Falls back gracefully on printers without a cutter (no-op cut command is simply ignored). */
export function escposCut(): Uint8Array {
  return new Uint8Array([0x1d, 0x56, 0x00]);
}

/**
 * Converts a 1-bit monochrome bitmap (packed 1 byte = 8 pixels, MSB first, 1 = black) into
 * a GS v 0 raster bitmap command that virtually all ESC/POS thermal printers understand.
 */
export function escposRasterImage(packedBits: Uint8Array, widthPx: number, heightPx: number): Uint8Array {
  const widthBytes = Math.ceil(widthPx / 8);
  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = heightPx & 0xff;
  const yH = (heightPx >> 8) & 0xff;
  const header = new Uint8Array([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
  return concatBytes([header, packedBits]);
}

/**
 * Converts a canvas into a packed 1-bit bitmap ready for escposRasterImage().
 * Uses simple luminance thresholding (no dithering) — crisp enough for text/line receipts.
 */
export function canvasToMonochromeBits(canvas: HTMLCanvasElement, threshold = 200): { bits: Uint8Array; width: number; height: number } {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak didukung di browser ini.");
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const widthBytes = Math.ceil(width / 8);
  const bits = new Uint8Array(widthBytes * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = imageData.data[idx];
      const g = imageData.data[idx + 1];
      const b = imageData.data[idx + 2];
      const a = imageData.data[idx + 3];
      const luminance = a === 0 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
      const isBlack = luminance < threshold;
      if (isBlack) {
        const byteIndex = y * widthBytes + (x >> 3);
        const bitIndex = 7 - (x % 8);
        bits[byteIndex] |= 1 << bitIndex;
      }
    }
  }
  return { bits, width, height };
}

/** Builds a complete print job (init -> raster image -> feed -> cut) from a receipt canvas. */
export function buildReceiptPrintJob(canvas: HTMLCanvasElement): Uint8Array {
  const { bits, width, height } = canvasToMonochromeBits(canvas);
  return concatBytes([escposInit(), escposRasterImage(bits, width, height), escposFeed(4), escposCut()]);
}
