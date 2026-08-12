// Shared color helpers for the Color Picker & Palette Extractor tool (and any
// future tool that needs RGB/HEX/HSL conversion or dominant-color extraction).

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export type PaletteColor = { hex: string; r: number; g: number; b: number; count: number };

/** Extracts the most frequent colors from an ImageData, quantized to reduce near-duplicate shades. */
export function extractPalette(imageData: ImageData, count = 8): PaletteColor[] {
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  const data = imageData.data;
  const totalPixels = data.length / 4;
  const sampleTarget = 20000;
  const stridePixels = Math.max(1, Math.floor(totalPixels / sampleTarget));
  const step = stridePixels * 4;

  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 200) continue; // skip mostly-transparent pixels
    const qr = r >> 3;
    const qg = g >> 3;
    const qb = b >> 3;
    const key = `${qr}-${qg}-${qb}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count)
    .map((b) => {
      const r = Math.round(b.r / b.n);
      const g = Math.round(b.g / b.n);
      const bl = Math.round(b.b / b.n);
      return { hex: rgbToHex(r, g, bl), r, g, b: bl, count: b.n };
    });
}
