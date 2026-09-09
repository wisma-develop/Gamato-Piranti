import type { ColorState } from "@/components/ui/ColorModeControl";

export type DotType = "square" | "dots" | "rounded" | "classy" | "classy-rounded" | "extra-rounded";
export type CornerSquareType = "square" | "dot" | "extra-rounded";
export type CornerDotType = "square" | "dot";
export type QrShape = "square" | "circle";

export interface QrStylePreset {
  name: string;
  dotsType: DotType;
  cornersSquareType: CornerSquareType;
  cornersDotType: CornerDotType;
  dots: ColorState;
  cornersSquare: ColorState;
  cornersDot: ColorState;
  background: ColorState;
  bgTransparent: boolean;
  bgRound: number;
  shape: QrShape;
  /** Swatch preview colors — kept separate from the real color states so the preset grid can render instantly without constructing full gradient CSS per swatch. */
  swatchFrom: string;
  swatchTo: string;
  swatchBg: string;
}

function solid(color: string): ColorState {
  return { mode: "solid", color, color2: color, gradientType: "linear", rotation: 0 };
}

function gradient(color: string, color2: string, gradientType: "linear" | "radial" = "linear", rotation = 135): ColorState {
  return { mode: "gradient", color, color2, gradientType, rotation };
}

export const QR_STYLE_PRESETS: QrStylePreset[] = [
  {
    name: "Klasik",
    dotsType: "square", cornersSquareType: "square", cornersDotType: "square",
    dots: solid("#0f172a"), cornersSquare: solid("#0f172a"), cornersDot: solid("#0f172a"),
    background: solid("#ffffff"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#0f172a", swatchTo: "#0f172a", swatchBg: "#ffffff",
  },
  {
    name: "Elegan",
    dotsType: "rounded", cornersSquareType: "extra-rounded", cornersDotType: "dot",
    dots: solid("#4f46e5"), cornersSquare: solid("#4f46e5"), cornersDot: solid("#4f46e5"),
    background: solid("#ffffff"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#4f46e5", swatchTo: "#4f46e5", swatchBg: "#ffffff",
  },
  {
    name: "Playful",
    dotsType: "dots", cornersSquareType: "dot", cornersDotType: "dot",
    dots: solid("#0d9488"), cornersSquare: solid("#0d9488"), cornersDot: solid("#0d9488"),
    background: solid("#ffffff"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#0d9488", swatchTo: "#0d9488", swatchBg: "#ffffff",
  },
  {
    name: "Classy Gold",
    dotsType: "classy-rounded", cornersSquareType: "extra-rounded", cornersDotType: "square",
    dots: solid("#b45309"), cornersSquare: solid("#78350f"), cornersDot: solid("#78350f"),
    background: solid("#fffbeb"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#b45309", swatchTo: "#78350f", swatchBg: "#fffbeb",
  },
  {
    name: "Neon Rose",
    dotsType: "extra-rounded", cornersSquareType: "dot", cornersDotType: "dot",
    dots: solid("#e11d48"), cornersSquare: solid("#9f1239"), cornersDot: solid("#9f1239"),
    background: solid("#ffffff"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#e11d48", swatchTo: "#9f1239", swatchBg: "#ffffff",
  },
  {
    name: "Midnight",
    dotsType: "classy", cornersSquareType: "square", cornersDotType: "dot",
    dots: solid("#e2e8f0"), cornersSquare: solid("#e2e8f0"), cornersDot: solid("#e2e8f0"),
    background: solid("#1e293b"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#e2e8f0", swatchTo: "#e2e8f0", swatchBg: "#1e293b",
  },
  {
    name: "Ocean",
    dotsType: "rounded", cornersSquareType: "extra-rounded", cornersDotType: "dot",
    dots: gradient("#0ea5e9", "#22d3ee", "linear", 135), cornersSquare: gradient("#0369a1", "#0ea5e9", "linear", 135), cornersDot: solid("#0369a1"),
    background: solid("#ffffff"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#0ea5e9", swatchTo: "#22d3ee", swatchBg: "#ffffff",
  },
  {
    name: "Sunset",
    dotsType: "extra-rounded", cornersSquareType: "extra-rounded", cornersDotType: "dot",
    dots: gradient("#f97316", "#ec4899", "radial"), cornersSquare: gradient("#ea580c", "#db2777", "radial"), cornersDot: solid("#db2777"),
    background: solid("#fff7ed"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#f97316", swatchTo: "#ec4899", swatchBg: "#fff7ed",
  },
  {
    name: "Forest",
    dotsType: "dots", cornersSquareType: "dot", cornersDotType: "dot",
    dots: gradient("#16a34a", "#65a30d", "linear", 90), cornersSquare: solid("#166534"), cornersDot: solid("#166534"),
    background: solid("#f0fdf4"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#16a34a", swatchTo: "#65a30d", swatchBg: "#f0fdf4",
  },
  {
    name: "Royal Purple",
    dotsType: "classy-rounded", cornersSquareType: "extra-rounded", cornersDotType: "dot",
    dots: gradient("#7c3aed", "#c026d3", "linear", 135), cornersSquare: gradient("#6d28d9", "#a21caf", "linear", 135), cornersDot: solid("#6d28d9"),
    background: solid("#ffffff"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#7c3aed", swatchTo: "#c026d3", swatchBg: "#ffffff",
  },
  {
    name: "Cyberpunk",
    dotsType: "square", cornersSquareType: "square", cornersDotType: "square",
    dots: gradient("#22d3ee", "#e11d48", "linear", 45), cornersSquare: solid("#22d3ee"), cornersDot: solid("#e11d48"),
    background: solid("#0b0f19"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#22d3ee", swatchTo: "#e11d48", swatchBg: "#0b0f19",
  },
  {
    name: "Pastel Mint",
    dotsType: "rounded", cornersSquareType: "dot", cornersDotType: "dot",
    dots: solid("#10b981"), cornersSquare: solid("#059669"), cornersDot: solid("#059669"),
    background: solid("#ecfdf5"), bgTransparent: false, bgRound: 0.3, shape: "square",
    swatchFrom: "#10b981", swatchTo: "#059669", swatchBg: "#ecfdf5",
  },
  {
    name: "Monokrom",
    dotsType: "square", cornersSquareType: "square", cornersDotType: "square",
    dots: solid("#334155"), cornersSquare: solid("#334155"), cornersDot: solid("#334155"),
    background: solid("#f8fafc"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#334155", swatchTo: "#334155", swatchBg: "#f8fafc",
  },
  {
    name: "Rose Gold",
    dotsType: "classy", cornersSquareType: "extra-rounded", cornersDotType: "dot",
    dots: gradient("#fb7185", "#fbbf24", "linear", 135), cornersSquare: solid("#be123c"), cornersDot: solid("#be123c"),
    background: solid("#fff1f2"), bgTransparent: false, bgRound: 0, shape: "square",
    swatchFrom: "#fb7185", swatchTo: "#fbbf24", swatchBg: "#fff1f2",
  },
  {
    name: "Electric Circle",
    dotsType: "dots", cornersSquareType: "dot", cornersDotType: "dot",
    dots: gradient("#3b82f6", "#8b5cf6", "linear", 135), cornersSquare: solid("#4338ca"), cornersDot: solid("#4338ca"),
    background: solid("#ffffff"), bgTransparent: false, bgRound: 1, shape: "circle",
    swatchFrom: "#3b82f6", swatchTo: "#8b5cf6", swatchBg: "#ffffff",
  },
  {
    name: "Transparan",
    dotsType: "rounded", cornersSquareType: "extra-rounded", cornersDotType: "dot",
    dots: solid("#0f172a"), cornersSquare: solid("#0f172a"), cornersDot: solid("#0f172a"),
    background: solid("#ffffff"), bgTransparent: true, bgRound: 0, shape: "square",
    swatchFrom: "#0f172a", swatchTo: "#0f172a", swatchBg: "transparent",
  },
];
