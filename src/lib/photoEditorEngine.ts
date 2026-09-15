// Rendering engine for the Photo Editor (Image Lab). Kept separate from the
// React component so the same pipeline can drive both the fast, downscaled
// live preview and the full-resolution export — and so it's testable on its
// own (see /mnt/skills usage patterns: cvEngine.ts, businessCardEngine.ts).
//
// Pipeline order (mirrors how real editing apps layer adjustments):
//   1. Base image, drawn through the canvas CSS `filter` chain (brightness,
//      contrast, saturation, blur, grayscale, sepia, invert, hue-rotate).
//   2. Temperature / Tint — a soft "overlay" blend wash that nudges the
//      white balance warmer/cooler and toward green/magenta.
//   3. Split-tone — shadows tinted via "multiply", highlights via "screen",
//      the classic two-color film-grade look used by cinematic/wedding
//      presets (not just a single hue-rotate knob).
//   4. Fade/Matte — a "lighten" wash that lifts crushed blacks for that
//      faded-film look, without touching the highlights.
//   5. Vignette — radial darkening toward the corners.
//   6. Grain — a tileable noise texture blended with "overlay" for a
//      realistic film-grain feel instead of a flat static overlay.
//
// All blend modes used (overlay/multiply/screen/lighten) are part of the
// standard canvas 2D Compositing spec and are supported by every modern
// browser — no WebGL / getImageData per-pixel work needed, so this stays
// fast enough to recompute on every slider drag tick.

export const PHOTO_ADJUSTMENT_DEFAULTS = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
  hue: 0,
  temperature: 0, // -100 (cool/blue) .. 100 (warm/orange)
  tint: 0, // -100 (green) .. 100 (magenta)
  vignette: 0, // 0 .. 100
  grain: 0, // 0 .. 100
  fade: 0, // 0 .. 100 (lifted-blacks / matte amount)
  splitTone: 0, // 0 .. 100 — master strength for shadow/highlight tint pair
  shadowTint: "#1d4ed8",
  highlightTint: "#f59e0b",
} as const;

export type PhotoAdjustmentValues = {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
  invert: number;
  hue: number;
  temperature: number;
  tint: number;
  vignette: number;
  grain: number;
  fade: number;
  splitTone: number;
  shadowTint: string;
  highlightTint: string;
};

export type PhotoTransform = { rotateDeg: number; flipH: boolean; flipV: boolean };

/** The 8 "classic" filters as a canvas 2D `ctx.filter` CSS string — also reused to render cheap live thumbnails via a plain `<img style={{filter}}>`. */
export function buildCssFilter(v: Pick<PhotoAdjustmentValues, "brightness" | "contrast" | "saturation" | "blur" | "grayscale" | "sepia" | "invert" | "hue">): string {
  return `brightness(${v.brightness}%) contrast(${v.contrast}%) saturate(${v.saturation}%) blur(${v.blur}px) grayscale(${v.grayscale}%) sepia(${v.sepia}%) invert(${v.invert}%) hue-rotate(${v.hue}deg)`;
}

/** One-time reusable grayscale noise tile for the grain effect. Regenerating per-frame would be wasteful; a single ~220px tile repeated via a canvas pattern looks just as good and costs nothing to reuse. */
export function createGrainTile(size = 220): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext("2d");
  if (!ctx) return tile;
  const imageData = ctx.createImageData(size, size);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return tile;
}

/**
 * Renders `img` onto `canvas` with the full adjustment pipeline applied.
 * Pass `maxDimension` to cap the output size for a fast live preview —
 * omit it (or pass undefined) for full-resolution export.
 */
export function drawPhotoAdjustments(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  v: PhotoAdjustmentValues,
  transform: PhotoTransform,
  grainTile: HTMLCanvasElement | null,
  maxDimension?: number
) {
  const { rotateDeg, flipH, flipV } = transform;
  const rotated90 = rotateDeg === 90 || rotateDeg === 270;
  const natW = img.naturalWidth || img.width || 1;
  const natH = img.naturalHeight || img.height || 1;
  const boxW = rotated90 ? natH : natW;
  const boxH = rotated90 ? natW : natH;

  let scale = 1;
  if (maxDimension && Math.max(boxW, boxH) > maxDimension) {
    scale = maxDimension / Math.max(boxW, boxH);
  }
  const outW = Math.max(1, Math.round(boxW * scale));
  const outH = Math.max(1, Math.round(boxH * scale));
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, outW, outH);

  // 1) Base image through the CSS filter chain, honoring rotate/flip/scale.
  ctx.save();
  ctx.filter = buildCssFilter(v);
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rotateDeg * Math.PI) / 180);
  ctx.scale((flipH ? -1 : 1) * scale, (flipV ? -1 : 1) * scale);
  ctx.drawImage(img, -natW / 2, -natH / 2);
  ctx.restore(); // also resets ctx.filter back to "none"

  // 2) Temperature / Tint wash (soft white-balance nudge).
  const tempAlpha = (Math.abs(v.temperature) / 100) * 0.32;
  if (tempAlpha > 0.003) {
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = tempAlpha;
    ctx.fillStyle = v.temperature > 0 ? "#ff9640" : "#3f8cff";
    ctx.fillRect(0, 0, outW, outH);
  }
  const tintAlpha = (Math.abs(v.tint) / 100) * 0.28;
  if (tintAlpha > 0.003) {
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = tintAlpha;
    ctx.fillStyle = v.tint > 0 ? "#ff4fd8" : "#35d488";
    ctx.fillRect(0, 0, outW, outH);
  }

  // 3) Split-tone: shadows via multiply, highlights via screen.
  if (v.splitTone > 0) {
    const s = v.splitTone / 100;
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = s * 0.45;
    ctx.fillStyle = v.shadowTint;
    ctx.fillRect(0, 0, outW, outH);
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = s * 0.3;
    ctx.fillStyle = v.highlightTint;
    ctx.fillRect(0, 0, outW, outH);
  }

  // 4) Fade / matte (lifted blacks) — "lighten" only raises darker pixels.
  if (v.fade > 0) {
    ctx.globalCompositeOperation = "lighten";
    ctx.globalAlpha = (v.fade / 100) * 0.5;
    ctx.fillStyle = "#3c3630";
    ctx.fillRect(0, 0, outW, outH);
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // 5) Vignette.
  if (v.vignette > 0) {
    const cx = outW / 2;
    const cy = outH / 2;
    const innerR = Math.min(outW, outH) * 0.32;
    const outerR = Math.hypot(cx, cy) * 1.05;
    const grad = ctx.createRadialGradient(cx, cy, Math.max(0, innerR), cx, cy, Math.max(innerR + 1, outerR));
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${(v.vignette / 100) * 0.85})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, outW, outH);
  }

  // 6) Grain.
  if (v.grain > 0 && grainTile) {
    const pattern = ctx.createPattern(grainTile, "repeat");
    if (pattern) {
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = (v.grain / 100) * 0.5;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, outW, outH);
    }
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/** Linear-interpolates every numeric field between the neutral defaults and a preset's target values — powers the "Preset Intensity" slider (0% = original, 100% = full preset look, up to 150% for an exaggerated push). */
export function scalePresetValues(preset: Partial<PhotoAdjustmentValues>, intensityPct: number): Partial<PhotoAdjustmentValues> {
  const t = intensityPct / 100;
  const out: Partial<PhotoAdjustmentValues> = {};
  const base = PHOTO_ADJUSTMENT_DEFAULTS;
  (Object.keys(preset) as (keyof PhotoAdjustmentValues)[]).forEach((key) => {
    const target = preset[key];
    if (target === undefined) return;
    if (key === "shadowTint" || key === "highlightTint") {
      (out as any)[key] = target; // colors aren't numeric — applied at full value whenever split-tone strength > 0
      return;
    }
    const from = base[key] as number;
    const to = target as number;
    (out as any)[key] = from + (to - from) * t;
  });
  return out;
}
