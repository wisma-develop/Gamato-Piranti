// Data model for the Business Card Studio (Special > Kartu Nama).
// Kept separate from the render engine (businessCardEngine.ts) so the UI
// layer can import types/factories without pulling in canvas drawing code —
// mirrors the cvTypes.ts / cvEngine.ts split already used by the CV Maker.

import { DEFAULT_FONT_FAMILY } from "@/lib/fontPresets";

// ── Size ─────────────────────────────────────────────────────────────────

export type CardSizeId = "std-id" | "us" | "eu" | "square" | "mini" | "custom";

export interface CardSizePreset {
  id: CardSizeId;
  label: string;
  wMM: number;
  hMM: number;
}

export const CARD_SIZES: CardSizePreset[] = [
  { id: "std-id", label: "Standar Indonesia (90 × 55 mm)", wMM: 90, hMM: 55 },
  { id: "us", label: "US Standard (89 × 51 mm)", wMM: 89, hMM: 51 },
  { id: "eu", label: "Eropa (85 × 55 mm)", wMM: 85, hMM: 55 },
  { id: "square", label: "Persegi (65 × 65 mm)", wMM: 65, hMM: 65 },
  { id: "mini", label: "Mini / Mungil (70 × 40 mm)", wMM: 70, hMM: 40 },
  { id: "custom", label: "Ukuran Kustom…", wMM: 90, hMM: 55 },
];

/** Rendering resolution: pixels per physical millimetre. 12 px/mm keeps the
 *  canvas crisp for both screen preview and print/PDF export without being
 *  unnecessarily heavy (90mm × 55mm → 1080×660px). */
export const PX_PER_MM = 12;

export function resolveCardSizeMM(design: Pick<CardDesign, "sizeId" | "customWMM" | "customHMM">): { wMM: number; hMM: number } {
  if (design.sizeId === "custom") {
    return {
      wMM: Math.min(200, Math.max(30, design.customWMM || 90)),
      hMM: Math.min(200, Math.max(20, design.customHMM || 55)),
    };
  }
  const preset = CARD_SIZES.find((s) => s.id === design.sizeId) ?? CARD_SIZES[0];
  return { wMM: preset.wMM, hMM: preset.hMM };
}

// ── Contact data (shared across sides/templates) ────────────────────────

export type ContactField = "name" | "title" | "company" | "phone" | "email" | "website" | "address" | "tagline";

export interface ContactData {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  tagline: string;
}

export const CONTACT_FIELD_LABEL: Record<ContactField, string> = {
  name: "Nama",
  title: "Jabatan",
  company: "Perusahaan",
  phone: "Telepon",
  email: "Email",
  website: "Website",
  address: "Alamat",
  tagline: "Tagline",
};

export const CONTACT_FIELD_KEYS: ContactField[] = ["name", "title", "company", "phone", "email", "website", "address", "tagline"];

export function defaultContactData(): ContactData {
  return {
    name: "Nama Anda",
    title: "Jabatan / Profesi",
    company: "Nama Perusahaan",
    phone: "+62 812-3456-7890",
    email: "nama@email.com",
    website: "www.website.com",
    address: "Kota, Indonesia",
    tagline: "Tagline singkat perusahaan Anda",
  };
}

// ── Elements ─────────────────────────────────────────────────────────────

export interface CardElementBase {
  id: string;
  /** Center position as a percentage of card width/height (0-100). */
  xPct: number;
  yPct: number;
  rotation: number; // degrees
  opacity: number; // 0-1
}

export interface CardTextElement extends CardElementBase {
  kind: "text";
  /** When set, the rendered text is sourced live from ContactData[bind],
   *  falling back to `text` only when that field is empty. This lets
   *  templates stay in sync with the central "Data Kontak" panel while
   *  still allowing fully free-standing text elements (bind = null). */
  bind: ContactField | null;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  align: "left" | "center" | "right";
  letterSpacing: number;
  /** Bounding-box width (percentage of card width) used for text alignment. */
  widthPct: number;
}

export interface CardShapeElement extends CardElementBase {
  kind: "shape";
  shape: "rect" | "circle" | "line";
  widthPct: number;
  heightPct: number;
  hasFill: boolean;
  fill: string;
  hasStroke: boolean;
  stroke: string;
  strokeWidth: number;
  /** Corner radius in px at render resolution — only used for shape "rect". */
  radius: number;
}

export interface CardImageElement extends CardElementBase {
  kind: "image";
  src: string; // data URL
  widthPct: number;
  heightPct: number;
  rounded: boolean;
  circle: boolean;
}

export type CardElement = CardTextElement | CardShapeElement | CardImageElement;

let elCounter = 0;
export function newElementId(prefix: string): string {
  elCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${elCounter}`;
}

export function makeTextElement(overrides: Partial<CardTextElement> = {}): CardTextElement {
  return {
    id: newElementId("text"),
    kind: "text",
    bind: null,
    text: "Teks baru",
    xPct: 50,
    yPct: 50,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: 14,
    color: "#0f172a",
    bold: false,
    italic: false,
    uppercase: false,
    align: "left",
    letterSpacing: 0,
    widthPct: 60,
    rotation: 0,
    opacity: 1,
    ...overrides,
  };
}

export function makeShapeElement(overrides: Partial<CardShapeElement> = {}): CardShapeElement {
  return {
    id: newElementId("shape"),
    kind: "shape",
    shape: "rect",
    xPct: 50,
    yPct: 50,
    widthPct: 30,
    heightPct: 10,
    hasFill: true,
    fill: "#4f46e5",
    hasStroke: false,
    stroke: "#0f172a",
    strokeWidth: 2,
    radius: 0,
    rotation: 0,
    opacity: 1,
    ...overrides,
  };
}

export function makeImageElement(overrides: Partial<CardImageElement> = {}): CardImageElement {
  return {
    id: newElementId("image"),
    kind: "image",
    src: "",
    xPct: 50,
    yPct: 50,
    widthPct: 20,
    heightPct: 20,
    rounded: false,
    circle: false,
    rotation: 0,
    opacity: 1,
    ...overrides,
  };
}

// ── Background ───────────────────────────────────────────────────────────

export type CardBackground =
  | { type: "solid"; color: string }
  | { type: "gradient"; angle: number; from: string; to: string }
  | { type: "image"; src: string; fit: "cover" | "contain"; overlayColor: string; overlayOpacity: number };

export function defaultBackground(): CardBackground {
  return { type: "solid", color: "#ffffff" };
}

// ── Side & full design ───────────────────────────────────────────────────

export interface CardSide {
  background: CardBackground;
  elements: CardElement[];
}

export function emptySide(): CardSide {
  return { background: defaultBackground(), elements: [] };
}

export interface CardDesign {
  sizeId: CardSizeId;
  customWMM: number;
  customHMM: number;
  front: CardSide;
  back: CardSide;
}

export function blankDesign(): CardDesign {
  return {
    sizeId: "std-id",
    customWMM: 90,
    customHMM: 55,
    front: emptySide(),
    back: emptySide(),
  };
}

// ── Ready-made templates ───────────────────────────────────────────────

export interface CardTemplateDef {
  id: string;
  name: string;
  desc: string;
  build: () => CardDesign;
}

function contactText(field: ContactField, overrides: Partial<CardTextElement>): CardTextElement {
  return makeTextElement({ bind: field, ...overrides });
}

const TEMPLATE_BUILDERS: Omit<CardTemplateDef, "build">[] = [
  { id: "minimal", name: "Minimalis Putih", desc: "Bersih, banyak ruang kosong, aksen garis tipis." },
  { id: "gradient", name: "Gradasi Modern", desc: "Latar gradasi diagonal dengan teks putih." },
  { id: "corporate", name: "Korporat Navy", desc: "Latar gelap formal dengan aksen emas." },
  { id: "elegant", name: "Elegan Emas", desc: "Krem lembut, garis tepi emas, nama bergaya kaligrafi." },
  { id: "creative", name: "Kreatif Splash", desc: "Bentuk lingkaran warna-warni yang playful." },
  { id: "dark-tech", name: "Dark Tech", desc: "Latar hitam pekat dengan aksen neon." },
  { id: "pastel", name: "Pastel Lembut", desc: "Warna pastel lembut, cocok untuk bisnis kreatif/kecantikan." },
];

function buildMinimal(): CardDesign {
  const d = blankDesign();
  d.front = {
    background: { type: "solid", color: "#ffffff" },
    elements: [
      makeShapeElement({ shape: "rect", xPct: 8, yPct: 50, widthPct: 1.2, heightPct: 70, fill: "#4f46e5", hasFill: true }),
      contactText("name", { text: "Nama Anda", xPct: 40, yPct: 32, widthPct: 65, fontSize: 20, bold: true, align: "left", color: "#0f172a" }),
      contactText("title", { text: "Jabatan / Profesi", xPct: 40, yPct: 44, widthPct: 65, fontSize: 12, align: "left", color: "#4f46e5" }),
      contactText("phone", { text: "+62 812-3456-7890", xPct: 40, yPct: 68, widthPct: 55, fontSize: 10.5, align: "left", color: "#475569" }),
      contactText("email", { text: "nama@email.com", xPct: 40, yPct: 78, widthPct: 55, fontSize: 10.5, align: "left", color: "#475569" }),
      contactText("website", { text: "www.website.com", xPct: 40, yPct: 88, widthPct: 55, fontSize: 10.5, align: "left", color: "#475569" }),
      contactText("company", { text: "NAMA PERUSAHAAN", xPct: 92, yPct: 15, widthPct: 60, fontSize: 10, align: "right", uppercase: true, letterSpacing: 1.5, color: "#94a3b8" }),
    ],
  };
  d.back = {
    background: { type: "solid", color: "#0f172a" },
    elements: [
      contactText("company", { text: "NAMA PERUSAHAAN", xPct: 50, yPct: 48, widthPct: 80, fontSize: 16, align: "center", uppercase: true, letterSpacing: 2, color: "#ffffff", bold: true }),
      contactText("tagline", { text: "Tagline singkat perusahaan Anda", xPct: 50, yPct: 60, widthPct: 80, fontSize: 9.5, align: "center", color: "#94a3b8" }),
    ],
  };
  return d;
}

function buildGradient(): CardDesign {
  const d = blankDesign();
  d.front = {
    background: { type: "gradient", angle: 135, from: "#4f46e5", to: "#7c3aed" },
    elements: [
      contactText("name", { text: "Nama Anda", xPct: 8, yPct: 62, widthPct: 84, fontSize: 21, bold: true, align: "left", color: "#ffffff" }),
      contactText("title", { text: "Jabatan / Profesi", xPct: 8, yPct: 74, widthPct: 84, fontSize: 11.5, align: "left", color: "#e0e7ff" }),
      makeShapeElement({ shape: "line", xPct: 8, yPct: 82, widthPct: 20, heightPct: 0.6, fill: "#ffffff", hasFill: true, strokeWidth: 2 }),
      contactText("phone", { text: "+62 812-3456-7890", xPct: 8, yPct: 90, widthPct: 45, fontSize: 9.5, align: "left", color: "#f1f5f9" }),
      contactText("company", { text: "PERUSAHAAN", xPct: 92, yPct: 15, widthPct: 55, fontSize: 11, align: "right", uppercase: true, letterSpacing: 1.5, color: "#ffffff", bold: true }),
    ],
  };
  d.back = {
    background: { type: "gradient", angle: 135, from: "#7c3aed", to: "#4f46e5" },
    elements: [
      contactText("website", { text: "www.website.com", xPct: 50, yPct: 45, widthPct: 80, fontSize: 12, align: "center", color: "#ffffff", bold: true }),
      contactText("email", { text: "nama@email.com", xPct: 50, yPct: 56, widthPct: 80, fontSize: 10.5, align: "center", color: "#e0e7ff" }),
      contactText("address", { text: "Kota, Indonesia", xPct: 50, yPct: 66, widthPct: 80, fontSize: 10, align: "center", color: "#e0e7ff" }),
    ],
  };
  return d;
}

function buildCorporate(): CardDesign {
  const d = blankDesign();
  d.front = {
    background: { type: "solid", color: "#0b1220" },
    elements: [
      makeShapeElement({ shape: "rect", xPct: 50, yPct: 96, widthPct: 100, heightPct: 6, fill: "#c9a227", hasFill: true }),
      contactText("name", { text: "Nama Anda", xPct: 8, yPct: 30, widthPct: 84, fontSize: 19, bold: true, align: "left", color: "#ffffff" }),
      contactText("title", { text: "Jabatan / Profesi", xPct: 8, yPct: 41, widthPct: 84, fontSize: 11, align: "left", color: "#c9a227" }),
      contactText("company", { text: "NAMA PERUSAHAAN", xPct: 8, yPct: 62, widthPct: 84, fontSize: 12.5, align: "left", uppercase: true, letterSpacing: 1.5, color: "#ffffff", bold: true }),
      contactText("phone", { text: "+62 812-3456-7890", xPct: 8, yPct: 75, widthPct: 84, fontSize: 9.5, align: "left", color: "#94a3b8" }),
      contactText("email", { text: "nama@email.com", xPct: 8, yPct: 84, widthPct: 84, fontSize: 9.5, align: "left", color: "#94a3b8" }),
    ],
  };
  d.back = {
    background: { type: "solid", color: "#0b1220" },
    elements: [
      makeShapeElement({ shape: "rect", xPct: 50, yPct: 4, widthPct: 100, heightPct: 6, fill: "#c9a227", hasFill: true }),
      contactText("company", { text: "NAMA PERUSAHAAN", xPct: 50, yPct: 50, widthPct: 84, fontSize: 15, align: "center", uppercase: true, letterSpacing: 2, color: "#ffffff", bold: true }),
      contactText("website", { text: "www.website.com", xPct: 50, yPct: 62, widthPct: 84, fontSize: 10, align: "center", color: "#c9a227" }),
    ],
  };
  return d;
}

function buildElegant(): CardDesign {
  const d = blankDesign();
  const frameEls: CardElement[] = [
    makeShapeElement({ shape: "rect", xPct: 50, yPct: 50, widthPct: 92, heightPct: 84, hasFill: false, hasStroke: true, stroke: "#c9a227", strokeWidth: 1.5 }),
  ];
  d.front = {
    background: { type: "solid", color: "#faf6ec" },
    elements: [
      ...frameEls,
      contactText("name", { text: "Nama Anda", xPct: 50, yPct: 42, widthPct: 80, fontSize: 24, align: "center", color: "#3f3421", fontFamily: "Great Vibes" }),
      contactText("title", { text: "Jabatan / Profesi", xPct: 50, yPct: 55, widthPct: 80, fontSize: 10, align: "center", uppercase: true, letterSpacing: 2, color: "#8a7a4f" }),
      contactText("phone", { text: "+62 812-3456-7890 · nama@email.com", xPct: 50, yPct: 78, widthPct: 84, fontSize: 8.5, align: "center", color: "#5c5238" }),
    ],
  };
  d.back = {
    background: { type: "solid", color: "#faf6ec" },
    elements: [
      ...frameEls.map((e) => ({ ...e, id: newElementId("shape") })),
      contactText("company", { text: "Nama Perusahaan", xPct: 50, yPct: 50, widthPct: 80, fontSize: 17, align: "center", color: "#3f3421", fontFamily: "Playfair Display" }),
    ],
  };
  return d;
}

function buildCreative(): CardDesign {
  const d = blankDesign();
  d.front = {
    background: { type: "solid", color: "#fff7ed" },
    elements: [
      makeShapeElement({ shape: "circle", xPct: 90, yPct: 8, widthPct: 34, heightPct: 34, fill: "#fb7185", hasFill: true, opacity: 0.85 }),
      makeShapeElement({ shape: "circle", xPct: 98, yPct: 30, widthPct: 20, heightPct: 20, fill: "#facc15", hasFill: true, opacity: 0.85 }),
      contactText("name", { text: "Nama Anda", xPct: 8, yPct: 55, widthPct: 80, fontSize: 20, bold: true, align: "left", color: "#1c1917" }),
      contactText("title", { text: "Jabatan / Profesi", xPct: 8, yPct: 66, widthPct: 80, fontSize: 11, align: "left", color: "#ea580c" }),
      contactText("phone", { text: "+62 812-3456-7890", xPct: 8, yPct: 84, widthPct: 60, fontSize: 9.5, align: "left", color: "#57534e" }),
      contactText("email", { text: "nama@email.com", xPct: 8, yPct: 92, widthPct: 60, fontSize: 9.5, align: "left", color: "#57534e" }),
    ],
  };
  d.back = {
    background: { type: "solid", color: "#fb7185" },
    elements: [
      makeShapeElement({ shape: "circle", xPct: 10, yPct: 90, widthPct: 30, heightPct: 30, fill: "#facc15", hasFill: true, opacity: 0.85 }),
      contactText("company", { text: "Nama Perusahaan", xPct: 50, yPct: 45, widthPct: 84, fontSize: 16, align: "center", color: "#ffffff", bold: true }),
      contactText("website", { text: "www.website.com", xPct: 50, yPct: 58, widthPct: 84, fontSize: 10, align: "center", color: "#fff1f2" }),
    ],
  };
  return d;
}

function buildDarkTech(): CardDesign {
  const d = blankDesign();
  d.front = {
    background: { type: "solid", color: "#020617" },
    elements: [
      makeShapeElement({ shape: "line", xPct: 8, yPct: 20, widthPct: 24, heightPct: 0.5, fill: "#22d3ee", hasFill: true }),
      contactText("name", { text: "Nama Anda", xPct: 8, yPct: 40, widthPct: 84, fontSize: 19, bold: true, align: "left", color: "#f8fafc" }),
      contactText("title", { text: "Jabatan / Profesi", xPct: 8, yPct: 51, widthPct: 84, fontSize: 10.5, align: "left", color: "#22d3ee", uppercase: true, letterSpacing: 1 }),
      contactText("phone", { text: "+62 812-3456-7890", xPct: 8, yPct: 74, widthPct: 84, fontSize: 9, align: "left", color: "#94a3b8" }),
      contactText("email", { text: "nama@email.com", xPct: 8, yPct: 82, widthPct: 84, fontSize: 9, align: "left", color: "#94a3b8" }),
      contactText("website", { text: "www.website.com", xPct: 8, yPct: 90, widthPct: 84, fontSize: 9, align: "left", color: "#94a3b8" }),
    ],
  };
  d.back = {
    background: { type: "solid", color: "#020617" },
    elements: [
      contactText("company", { text: "NAMA PERUSAHAAN", xPct: 50, yPct: 50, widthPct: 84, fontSize: 15, align: "center", uppercase: true, letterSpacing: 3, color: "#22d3ee", bold: true }),
    ],
  };
  return d;
}

function buildPastel(): CardDesign {
  const d = blankDesign();
  d.front = {
    background: { type: "gradient", angle: 160, from: "#fbcfe8", to: "#ddd6fe" },
    elements: [
      makeShapeElement({ shape: "circle", xPct: 50, yPct: 32, widthPct: 26, heightPct: 26, fill: "#ffffff", hasFill: true, opacity: 0.9 }),
      contactText("name", { text: "Nama Anda", xPct: 50, yPct: 62, widthPct: 84, fontSize: 18, bold: true, align: "center", color: "#4c1d95" }),
      contactText("title", { text: "Jabatan / Profesi", xPct: 50, yPct: 72, widthPct: 84, fontSize: 10.5, align: "center", color: "#6d28d9" }),
      contactText("phone", { text: "+62 812-3456-7890", xPct: 50, yPct: 88, widthPct: 84, fontSize: 9, align: "center", color: "#5b21b6" }),
    ],
  };
  d.back = {
    background: { type: "gradient", angle: 160, from: "#ddd6fe", to: "#fbcfe8" },
    elements: [
      contactText("company", { text: "Nama Perusahaan", xPct: 50, yPct: 45, widthPct: 84, fontSize: 15, align: "center", color: "#4c1d95", bold: true }),
      contactText("website", { text: "www.website.com", xPct: 50, yPct: 58, widthPct: 84, fontSize: 9.5, align: "center", color: "#6d28d9" }),
    ],
  };
  return d;
}

const BUILDERS: Record<string, () => CardDesign> = {
  minimal: buildMinimal,
  gradient: buildGradient,
  corporate: buildCorporate,
  elegant: buildElegant,
  creative: buildCreative,
  "dark-tech": buildDarkTech,
  pastel: buildPastel,
};

export const CARD_TEMPLATES: CardTemplateDef[] = TEMPLATE_BUILDERS.map((t) => ({
  ...t,
  build: BUILDERS[t.id],
}));

export function getCardTemplate(id: string): CardDesign {
  const builder = BUILDERS[id] ?? buildMinimal;
  return builder();
}
