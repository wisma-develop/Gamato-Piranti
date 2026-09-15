import type { PhotoAdjustmentValues } from "@/lib/photoEditorEngine";

/**
 * Curated one-tap presets for the Photo Editor. Each one is a full recipe
 * across the whole pipeline (color filters + temperature/tint + split-tone
 * + vignette + grain + fade) — not a single hue-rotate knob renamed — so
 * "Cinematic" actually looks cinematic and "Wedding" actually looks airy
 * and romantic instead of every preset just being a saturation slider in
 * disguise. Values are target numbers (not deltas) and get blended from
 * PHOTO_ADJUSTMENT_DEFAULTS by the Preset Intensity slider before being
 * applied (see scalePresetValues in photoEditorEngine.ts).
 */
export type PhotoPresetValues = Partial<PhotoAdjustmentValues>;

export interface PhotoPreset {
  id: string;
  name: string;
  category: string;
  desc: string;
  values: PhotoPresetValues;
}

export const PHOTO_PRESET_CATEGORIES = [
  "Sinematik",
  "Pernikahan",
  "Potret",
  "Vintage",
  "Hitam Putih",
  "Vibrant",
  "Kuliner",
  "Alam",
  "Moody",
  "Pastel",
] as const;

export type PhotoPresetCategory = (typeof PHOTO_PRESET_CATEGORIES)[number];

export const PHOTO_PRESETS: PhotoPreset[] = [
  // ── Sinematik ─────────────────────────────────────────────────────────
  {
    id: "cine-teal-orange",
    name: "Teal & Orange",
    category: "Sinematik",
    desc: "Look film Hollywood klasik — bayangan kebiruan, kulit tetap hangat",
    values: { contrast: 112, saturation: 92, temperature: 8, tint: -2, vignette: 35, grain: 18, fade: 12, splitTone: 55, shadowTint: "#0f5c66", highlightTint: "#e08a3c" },
  },
  {
    id: "cine-noir",
    name: "Noir Klasik",
    category: "Sinematik",
    desc: "Hitam-putih kontras tinggi ala film detektif",
    values: { grayscale: 85, contrast: 122, brightness: 96, vignette: 45, grain: 30, temperature: -4 },
  },
  {
    id: "cine-blockbuster",
    name: "Blockbuster Dingin",
    category: "Sinematik",
    desc: "Nuansa biru-dingin dramatis khas trailer aksi",
    values: { contrast: 115, saturation: 88, temperature: -18, tint: 4, vignette: 30, grain: 10, splitTone: 35, shadowTint: "#123a5e", highlightTint: "#9fd8ff" },
  },
  {
    id: "cine-sunset-drama",
    name: "Drama Senja",
    category: "Sinematik",
    desc: "Highlight jingga hangat, bayangan gelap pekat",
    values: { contrast: 118, saturation: 104, temperature: 16, vignette: 32, grain: 14, splitTone: 40, shadowTint: "#241333", highlightTint: "#ff8a3d" },
  },

  // ── Pernikahan ────────────────────────────────────────────────────────
  {
    id: "wed-airy-light",
    name: "Airy & Cerah",
    category: "Pernikahan",
    desc: "Terang lembut, warna dicuci tipis — favorit foto outdoor",
    values: { brightness: 108, contrast: 92, saturation: 96, temperature: 10, fade: 22, vignette: 10, grain: 4 },
  },
  {
    id: "wed-romantic-glow",
    name: "Romantic Glow",
    category: "Pernikahan",
    desc: "Hangat keemasan dengan pancaran lembut di highlight",
    values: { brightness: 105, contrast: 96, saturation: 90, temperature: 14, tint: 4, splitTone: 30, shadowTint: "#7a4b3a", highlightTint: "#ffd9b0", vignette: 15 },
  },
  {
    id: "wed-classic-film",
    name: "Klasik Film",
    category: "Pernikahan",
    desc: "Sedikit sephia, butiran halus — kesan timeless",
    values: { sepia: 12, contrast: 104, saturation: 92, temperature: 8, grain: 14, fade: 15, vignette: 12 },
  },
  {
    id: "wed-garden-soft",
    name: "Garden Soft",
    category: "Pernikahan",
    desc: "Hijau taman tenang, kulit tetap natural",
    values: { brightness: 104, contrast: 94, saturation: 98, temperature: 4, tint: -3, fade: 14, vignette: 8 },
  },

  // ── Potret ────────────────────────────────────────────────────────────
  {
    id: "portrait-studio-clean",
    name: "Studio Bersih",
    category: "Potret",
    desc: "Kontras & warna seimbang untuk foto studio/produk wajah",
    values: { brightness: 104, contrast: 108, saturation: 98, temperature: 3 },
  },
  {
    id: "portrait-warm-skin",
    name: "Kulit Hangat",
    category: "Potret",
    desc: "Tone kulit lebih hangat dan sehat tanpa oversaturasi",
    values: { brightness: 103, contrast: 104, saturation: 94, temperature: 12, tint: -2, splitTone: 20, shadowTint: "#5c3a2e", highlightTint: "#ffdfc2" },
  },
  {
    id: "portrait-editorial",
    name: "Editorial",
    category: "Potret",
    desc: "Kontras tegas & sedikit vignette gaya majalah fashion",
    values: { contrast: 120, saturation: 90, temperature: -5, vignette: 25, grain: 8 },
  },
  {
    id: "portrait-soft-glam",
    name: "Soft Glam",
    category: "Potret",
    desc: "Highlight lembut berpendar, cocok untuk potret indoor",
    values: { brightness: 106, contrast: 96, saturation: 100, temperature: 6, fade: 12, vignette: 14 },
  },

  // ── Vintage ───────────────────────────────────────────────────────────
  {
    id: "vintage-faded-film",
    name: "Faded Film",
    category: "Vintage",
    desc: "Warna pudar khas roll film lawas, hitam terangkat",
    values: { sepia: 22, contrast: 88, saturation: 80, fade: 30, grain: 26, vignette: 20, temperature: 10 },
  },
  {
    id: "vintage-90s",
    name: "Retro 90-an",
    category: "Vintage",
    desc: "Warna jenuh hangat dengan butiran khas foto analog",
    values: { sepia: 15, contrast: 96, saturation: 108, hue: 6, temperature: 14, grain: 20, vignette: 15 },
  },
  {
    id: "vintage-kodachrome",
    name: "Kodachrome Warm",
    category: "Vintage",
    desc: "Merah-jingga pekat ala slide film legendaris",
    values: { saturation: 118, contrast: 110, temperature: 16, tint: 3, grain: 12, vignette: 10 },
  },
  {
    id: "vintage-polaroid",
    name: "Polaroid Pudar",
    category: "Vintage",
    desc: "Kontras rendah, tint kehijauan lembut ala instan lawas",
    values: { contrast: 84, saturation: 88, tint: -8, fade: 26, grain: 22, vignette: 18 },
  },

  // ── Hitam Putih ───────────────────────────────────────────────────────
  {
    id: "bw-classic",
    name: "Klasik Monokrom",
    category: "Hitam Putih",
    desc: "Hitam-putih seimbang, cocok untuk hampir semua foto",
    values: { grayscale: 100, contrast: 112, brightness: 102 },
  },
  {
    id: "bw-dramatic",
    name: "Kontras Dramatis",
    category: "Hitam Putih",
    desc: "Hitam pekat & putih tajam, vignette gelap di tepi",
    values: { grayscale: 100, contrast: 132, brightness: 98, vignette: 30, grain: 15 },
  },
  {
    id: "bw-soft-silver",
    name: "Silver Lembut",
    category: "Hitam Putih",
    desc: "Abu-abu lembut, hitam tidak terlalu pekat — gaya editorial",
    values: { grayscale: 92, contrast: 96, brightness: 106, fade: 10, grain: 20 },
  },

  // ── Vibrant ───────────────────────────────────────────────────────────
  {
    id: "vibrant-travel",
    name: "Travel Vivid",
    category: "Vibrant",
    desc: "Warna meledak cerah, favorit konten traveling",
    values: { saturation: 132, contrast: 112, brightness: 104, temperature: 6 },
  },
  {
    id: "vibrant-tropical",
    name: "Tropical Pop",
    category: "Vibrant",
    desc: "Biru laut & hijau daun jadi lebih hidup",
    values: { saturation: 140, contrast: 108, hue: -4, temperature: 10, vignette: 8 },
  },
  {
    id: "vibrant-urban",
    name: "Urban Explorer",
    category: "Vibrant",
    desc: "Kontras kota, sedikit dingin dan berbutir",
    values: { saturation: 118, contrast: 118, temperature: -6, vignette: 20, grain: 10 },
  },

  // ── Kuliner ───────────────────────────────────────────────────────────
  {
    id: "food-warm-delicious",
    name: "Hangat Menggugah",
    category: "Kuliner",
    desc: "Warna makanan lebih menggugah selera & hangat",
    values: { brightness: 106, contrast: 110, saturation: 118, temperature: 14 },
  },
  {
    id: "food-cafe-aesthetic",
    name: "Cafe Aesthetic",
    category: "Kuliner",
    desc: "Nuansa kalem ala foto kafe untuk feed Instagram",
    values: { brightness: 104, contrast: 100, saturation: 96, temperature: 8, fade: 18 },
  },
  {
    id: "food-fresh-bright",
    name: "Fresh & Bright",
    category: "Kuliner",
    desc: "Terang bersih, cocok untuk foto produk/menu",
    values: { brightness: 112, contrast: 106, saturation: 112, temperature: -2 },
  },

  // ── Alam ──────────────────────────────────────────────────────────────
  {
    id: "nature-golden-hour",
    name: "Golden Hour",
    category: "Alam",
    desc: "Cahaya emas matahari terbenam yang hangat",
    values: { brightness: 106, contrast: 108, saturation: 116, temperature: 22, tint: -3, vignette: 12 },
  },
  {
    id: "nature-deep-forest",
    name: "Hutan Dalam",
    category: "Alam",
    desc: "Hijau lebih pekat & sejuk, cocok untuk lanskap hutan",
    values: { saturation: 110, contrast: 114, hue: -6, temperature: -4, vignette: 20 },
  },
  {
    id: "nature-dramatic-sky",
    name: "Langit Dramatis",
    category: "Alam",
    desc: "Awan & langit lebih tegas dengan vignette kuat",
    values: { contrast: 126, saturation: 108, temperature: -8, vignette: 30, grain: 8 },
  },

  // ── Moody ─────────────────────────────────────────────────────────────
  {
    id: "moody-shadow",
    name: "Moody Shadow",
    category: "Moody",
    desc: "Gelap misterius dengan sentuhan biru di bayangan",
    values: { brightness: 92, contrast: 120, saturation: 88, temperature: -10, splitTone: 40, shadowTint: "#1b2a4a", highlightTint: "#d8c39a", vignette: 35, grain: 15 },
  },
  {
    id: "moody-dark-academia",
    name: "Dark Academia",
    category: "Moody",
    desc: "Cokelat tua & kontras tinggi, suasana klasik-suram",
    values: { sepia: 18, contrast: 116, brightness: 90, saturation: 84, vignette: 30, grain: 20, fade: 8 },
  },
  {
    id: "moody-midnight-blue",
    name: "Midnight Blue",
    category: "Moody",
    desc: "Dominan biru gelap, dramatis untuk foto malam",
    values: { temperature: -22, contrast: 112, brightness: 94, saturation: 90, splitTone: 30, shadowTint: "#0b1f3a", highlightTint: "#93b7d6", vignette: 25 },
  },

  // ── Pastel ────────────────────────────────────────────────────────────
  {
    id: "pastel-dreamy",
    name: "Dreamy Pastel",
    category: "Pastel",
    desc: "Lembut mengambang, warna dicuci tipis merata",
    values: { brightness: 110, contrast: 88, saturation: 90, fade: 28, temperature: 6 },
  },
  {
    id: "pastel-soft-peach",
    name: "Soft Peach",
    category: "Pastel",
    desc: "Rona persik hangat yang menenangkan",
    values: { brightness: 107, contrast: 92, saturation: 94, temperature: 12, tint: 3, fade: 16 },
  },
  {
    id: "pastel-mint-cloud",
    name: "Mint Cloud",
    category: "Pastel",
    desc: "Sejuk kehijauan, ringan seperti awan",
    values: { brightness: 108, contrast: 90, saturation: 92, temperature: -6, tint: -4, fade: 20 },
  },
];

export function getPresetById(id: string): PhotoPreset | undefined {
  return PHOTO_PRESETS.find((p) => p.id === id);
}
