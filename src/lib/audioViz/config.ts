// Konfigurasi Audio Visualizer — satu objek datar yang dipakai pratinjau DAN ekspor,
// jadi apa yang terlihat di layar sama persis dengan yang masuk ke berkas .mov.

export type VizStyle =
  | "bars"
  | "bars-mirror"
  | "blocks"
  | "dots"
  | "line"
  | "area"
  | "wave"
  | "lissajous"
  | "circle-bars"
  | "circle-dots"
  | "circle-wave"
  | "circle-blob"
  | "pulse";

export type FreqScale = "log" | "linear" | "sqrt";
export type ColorMode = "solid" | "gradient" | "rainbow" | "level";
export type BgMode = "transparent" | "solid" | "gradient" | "image";
export type TextAlign = "left" | "center" | "right";
export type LogoShape = "circle" | "rounded" | "square";

export interface VizConfig {
  // Kanvas & waktu
  width: number;
  height: number;
  fps: number;

  // Gaya
  style: VizStyle;

  // Analisis
  fftSize: 1024 | 2048 | 4096 | 8192;
  bars: number;
  freqMin: number;
  freqMax: number;
  freqScale: FreqScale;
  gainDb: number;
  floorDb: number;
  tilt: number;
  attack: number; // ms
  release: number; // ms
  spatialSmooth: number; // 0–4 lintasan
  peakFall: number; // satuan per detik

  // Tata letak
  posX: number;
  posY: number;
  areaW: number;
  areaH: number;
  rotation: number;
  mirrorX: boolean;
  flipY: boolean;

  // Bentuk
  barWidth: number; // rasio isi slot 0.05–1
  barRadius: number; // 0–1
  minBar: number; // px (skala 1080p)
  lineWidth: number; // px (skala 1080p)
  dotSize: number; // px (skala 1080p)
  segments: number; // blocks/dots
  segGap: number; // 0–0.8
  radius: number; // lingkaran: radius dalam, 0.05–0.95
  startAngle: number; // derajat
  spin: number; // derajat/detik
  circleSymmetric: boolean;
  peaks: boolean;

  // Warna
  colorMode: ColorMode;
  color1: string;
  color2: string;
  color3: string;
  useColor3: boolean;
  gradAngle: number;
  opacity: number;
  hueShift: number; // derajat/detik untuk rainbow

  // Efek
  glow: number; // px (skala 1080p)
  glowColor: string; // "" = otomatis dari warna 1
  outline: number; // px
  outlineColor: string;
  reflection: number; // 0–1 (kepekatan)
  reflectionLen: number; // 0.1–1 (tinggi relatif)

  // Latar
  bgMode: BgMode;
  bgColor1: string;
  bgColor2: string;
  bgAngle: number;
  bgDim: number; // 0–0.9
  bgBlur: number; // px
  bgBeat: number; // 0–1 zoom mengikuti bass

  // Logo / gambar tengah
  logoOn: boolean;
  logoShape: LogoShape;
  logoX: number;
  logoY: number;
  logoSize: number; // fraksi sisi terpendek
  logoBeat: number; // 0–1
  logoBorder: number; // px
  logoBorderColor: string;

  // Teks
  title: string;
  subtitle: string;
  textFont: string;
  textSize: number; // px skala 1080p
  textColor: string;
  textX: number;
  textY: number;
  textAlign: TextAlign;
  textShadow: boolean;

  // Progres
  progress: boolean;
  progressPos: "top" | "bottom";
  progressColor: string;
  progressH: number;
}

export const DEFAULT_CONFIG: VizConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  style: "bars",
  fftSize: 4096,
  bars: 64,
  freqMin: 40,
  freqMax: 14000,
  freqScale: "log",
  gainDb: 16,
  floorDb: -78,
  tilt: 3,
  attack: 25,
  release: 220,
  spatialSmooth: 1,
  peakFall: 0.5,
  posX: 0.5,
  posY: 0.5,
  areaW: 0.8,
  areaH: 0.45,
  rotation: 0,
  mirrorX: false,
  flipY: false,
  barWidth: 0.7,
  barRadius: 0.5,
  minBar: 3,
  lineWidth: 4,
  dotSize: 6,
  segments: 16,
  segGap: 0.25,
  radius: 0.4,
  startAngle: -90,
  spin: 0,
  circleSymmetric: true,
  peaks: false,
  colorMode: "gradient",
  color1: "#22d3ee",
  color2: "#a855f7",
  color3: "#ec4899",
  useColor3: true,
  gradAngle: 90,
  opacity: 1,
  hueShift: 30,
  glow: 0,
  glowColor: "",
  outline: 0,
  outlineColor: "#ffffff",
  reflection: 0,
  reflectionLen: 0.45,
  bgMode: "transparent",
  bgColor1: "#0f172a",
  bgColor2: "#312e81",
  bgAngle: 135,
  bgDim: 0.35,
  bgBlur: 0,
  bgBeat: 0,
  logoOn: false,
  logoShape: "circle",
  logoX: 0.5,
  logoY: 0.5,
  logoSize: 0.22,
  logoBeat: 0.12,
  logoBorder: 4,
  logoBorderColor: "#ffffff",
  title: "",
  subtitle: "",
  textFont: "Alan Sans",
  textSize: 54,
  textColor: "#ffffff",
  textX: 0.5,
  textY: 0.86,
  textAlign: "center",
  textShadow: true,
  progress: false,
  progressPos: "bottom",
  progressColor: "#22d3ee",
  progressH: 6,
};

export interface VizPreset {
  id: string;
  label: string;
  desc: string;
  patch: Partial<VizConfig>;
}

export const VIZ_PRESETS: VizPreset[] = [
  { id: "klasik", label: "Klasik", desc: "Batang tegak gradien cyan → ungu", patch: { style: "bars", bars: 64, colorMode: "gradient", color1: "#22d3ee", color2: "#a855f7", useColor3: false, barRadius: 0.5, glow: 0, reflection: 0, peaks: false, areaW: 0.8, areaH: 0.45, posY: 0.55 } },
  { id: "neon", label: "Neon Cermin", desc: "Batang simetris dengan cahaya neon", patch: { style: "bars-mirror", bars: 48, colorMode: "gradient", color1: "#22d3ee", color2: "#ec4899", useColor3: false, gradAngle: 0, barRadius: 1, glow: 18, areaW: 0.82, areaH: 0.5, posY: 0.5, reflection: 0 } },
  { id: "cincin", label: "Cincin Pelangi", desc: "Spoke melingkar warna pelangi berputar", patch: { style: "circle-bars", bars: 56, colorMode: "rainbow", hueShift: 40, radius: 0.42, barWidth: 0.6, barRadius: 1, spin: 8, glow: 8, areaW: 0.6, areaH: 0.9, posY: 0.5, circleSymmetric: true } },
  { id: "gelombang", label: "Gelombang", desc: "Gelombang suara real-time (garis bercahaya)", patch: { style: "wave", colorMode: "gradient", color1: "#38bdf8", color2: "#f472b6", useColor3: false, gradAngle: 0, lineWidth: 5, glow: 14, areaW: 0.86, areaH: 0.4, posY: 0.5 } },
  { id: "blob", label: "Blob Organik", desc: "Bentuk cair mengikuti spektrum", patch: { style: "circle-blob", bars: 40, colorMode: "gradient", color1: "#f97316", color2: "#ec4899", useColor3: false, gradAngle: 45, radius: 0.5, lineWidth: 3, glow: 10, areaW: 0.6, areaH: 0.9, opacity: 0.92, circleSymmetric: true } },
  { id: "led", label: "Titik LED", desc: "Matriks titik LED level", patch: { style: "dots", bars: 32, segments: 14, colorMode: "level", color1: "#22c55e", color2: "#eab308", color3: "#ef4444", useColor3: true, dotSize: 8, segGap: 0.2, areaW: 0.7, areaH: 0.5, glow: 6 } },
  { id: "pulsa", label: "Pulsa Logo", desc: "Cakram berdenyut + cincin gema mengikuti bass", patch: { style: "pulse", colorMode: "gradient", color1: "#6366f1", color2: "#ec4899", useColor3: false, radius: 0.5, lineWidth: 4, glow: 16, areaW: 0.7, areaH: 0.9, logoOn: false } },
  { id: "area", label: "Gunung Spektrum", desc: "Area terisi halus dengan pantulan", patch: { style: "area", bars: 80, colorMode: "gradient", color1: "#34d399", color2: "#3b82f6", useColor3: false, gradAngle: 90, lineWidth: 3, reflection: 0.35, reflectionLen: 0.5, areaW: 0.9, areaH: 0.35, posY: 0.45, opacity: 0.95 } },
  { id: "lissajous", label: "Osiloskop XY", desc: "Goniometer stereo (kiri vs kanan)", patch: { style: "lissajous", colorMode: "solid", color1: "#4ade80", lineWidth: 2, glow: 12, areaW: 0.5, areaH: 0.8, gainDb: 12 } },
];

export const CANVAS_PRESETS: { id: string; label: string; w: number; h: number }[] = [
  { id: "hd", label: "Full HD 1920×1080 (16:9)", w: 1920, h: 1080 },
  { id: "720", label: "HD 1280×720 (16:9)", w: 1280, h: 720 },
  { id: "4k", label: "4K 3840×2160 (16:9) — berat", w: 3840, h: 2160 },
  { id: "sq", label: "Persegi 1080×1080 (1:1)", w: 1080, h: 1080 },
  { id: "story", label: "Vertikal 1080×1920 (9:16)", w: 1080, h: 1920 },
  { id: "port", label: "Potret 1080×1350 (4:5)", w: 1080, h: 1350 },
  { id: "wide", label: "Ultra lebar 2560×1080 (21:9)", w: 2560, h: 1080 },
  { id: "banner", label: "Banner 1920×400", w: 1920, h: 400 },
];

export const STYLE_LIST: { id: VizStyle; label: string }[] = [
  { id: "bars", label: "Batang" },
  { id: "bars-mirror", label: "Batang Simetris" },
  { id: "blocks", label: "Blok LED" },
  { id: "dots", label: "Titik LED" },
  { id: "line", label: "Garis Spektrum" },
  { id: "area", label: "Area Spektrum" },
  { id: "wave", label: "Gelombang" },
  { id: "lissajous", label: "Osiloskop XY" },
  { id: "circle-bars", label: "Lingkaran Batang" },
  { id: "circle-dots", label: "Lingkaran Titik" },
  { id: "circle-wave", label: "Lingkaran Gelombang" },
  { id: "circle-blob", label: "Blob Melingkar" },
  { id: "pulse", label: "Pulsa" },
];

export const isCircleStyle = (s: VizStyle) => s.startsWith("circle-") || s === "pulse";
export const isReflectable = (s: VizStyle) => ["bars", "blocks", "dots", "line", "area", "wave"].includes(s);
export const usesSpectrum = (s: VizStyle) => !["wave", "lissajous", "circle-wave"].includes(s);

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

/** Menggabungkan konfigurasi tersimpan (mungkin versi lama / sebagian) dengan nilai bawaan, dengan batas aman. */
export function sanitizeConfig(input: unknown): VizConfig {
  const base = { ...DEFAULT_CONFIG };
  if (!input || typeof input !== "object") return base;
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(base) as (keyof VizConfig)[]) {
    const dv = base[k];
    const v = src[k as string];
    if (v === undefined) continue;
    if (typeof dv === "number" && typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof dv === "string" && typeof v === "string") out[k] = v;
    else if (typeof dv === "boolean" && typeof v === "boolean") out[k] = v;
  }
  const c = out as unknown as VizConfig;
  c.width = Math.round(clamp(c.width, 160, 7680));
  c.height = Math.round(clamp(c.height, 160, 4320));
  c.fps = Math.round(clamp(c.fps, 1, 120));
  c.bars = Math.round(clamp(c.bars, 4, 256));
  c.fftSize = ([1024, 2048, 4096, 8192] as number[]).includes(c.fftSize) ? c.fftSize : 4096;
  c.freqMin = clamp(c.freqMin, 20, 2000);
  c.freqMax = clamp(c.freqMax, c.freqMin + 100, 22000);
  if (!STYLE_LIST.some((s) => s.id === c.style)) c.style = "bars";
  return c;
}
