import { DEFAULT_FONT_FAMILY } from "@/lib/fontPresets";

// Shared data model, item factories, and template registry for the CV Maker
// (Special > Pembuat CV). Kept separate from cvEngine.ts so the UI layer can
// import lightweight types/factories without pulling in the canvas renderer.

export type CvTemplateId = "sidebar" | "accent" | "band" | "minimal" | "timeline" | "elegant" | "split" | "banner";

export interface CvTemplateDef {
  id: CvTemplateId;
  name: string;
  desc: string;
  accentDefault: string;
  usesPhoto: boolean;
  atsFriendly: boolean;
}

export const CV_TEMPLATES: CvTemplateDef[] = [
  {
    id: "minimal",
    name: "Minimalis Klasik",
    desc: "Satu kolom, hitam-putih, paling ramah sistem ATS. Tanpa foto.",
    accentDefault: "#0f172a",
    usesPhoto: false,
    atsFriendly: true,
  },
  {
    id: "sidebar",
    name: "Modern Sidebar",
    desc: "Panel kiri berwarna untuk foto, kontak, dan keahlian.",
    accentDefault: "#4f46e5",
    usesPhoto: true,
    atsFriendly: false,
  },
  {
    id: "accent",
    name: "Aksen Kreatif",
    desc: "Panel kanan berwarna dengan foto dan aksen bulat.",
    accentDefault: "#be123c",
    usesPhoto: true,
    atsFriendly: false,
  },
  {
    id: "band",
    name: "Profesional Dua-Kolom",
    desc: "Pita header berwarna di atas, konten dua kolom di bawahnya.",
    accentDefault: "#0f766e",
    usesPhoto: true,
    atsFriendly: false,
  },
  {
    id: "timeline",
    name: "Linimasa Ringkas",
    desc: "Satu kolom padat dengan penanda linimasa berwarna.",
    accentDefault: "#b45309",
    usesPhoto: false,
    atsFriendly: true,
  },
  {
    id: "elegant",
    name: "Elegan Terpusat",
    desc: "Nama di tengah dengan garis tipis, judul bagian terpusat. Satu kolom, rapi untuk profesional.",
    accentDefault: "#1e3a5f",
    usesPhoto: false,
    atsFriendly: true,
  },
  {
    id: "split",
    name: "Dua Kolom Bersih",
    desc: "Kolom kiri sempit (kontak, keahlian, bahasa) di atas putih, kolom kanan untuk pengalaman. Tanpa blok warna besar.",
    accentDefault: "#0369a1",
    usesPhoto: true,
    atsFriendly: false,
  },
  {
    id: "banner",
    name: "Banner Penuh",
    desc: "Banner berwarna selebar halaman berisi nama & kontak, isi satu kolom di bawahnya.",
    accentDefault: "#7c2d12",
    usesPhoto: true,
    atsFriendly: true,
  },
];

export const ACCENT_PRESETS = ["#4f46e5", "#0f766e", "#be123c", "#b45309", "#334155", "#7c3aed", "#0f172a", "#0891b2"];

export interface SkillItem {
  id: string;
  name: string;
  level: number; // 0-100
}

export interface LangItem {
  id: string;
  name: string;
  level: string; // free label, e.g. "Mahir"
}

export interface ExpItem {
  id: string;
  role: string;
  company: string;
  location: string;
  period: string;
  description: string; // one bullet per line
}

export interface EduItem {
  id: string;
  degree: string;
  school: string;
  period: string;
  description: string;
}

export interface CertItem {
  id: string;
  name: string;
  issuer: string;
  year: string;
}

export interface AchItem {
  id: string;
  title: string;
  org: string;
  period: string;
  description: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  role: string; // peran / teknologi
  period: string;
  description: string; // satu baris = satu bullet
  link: string;
}

export interface ReferenceItem {
  id: string;
  name: string;
  position: string; // jabatan & perusahaan
  contact: string;
}

export type SectionKey =
  | "summary"
  | "skills"
  | "languages"
  | "experience"
  | "education"
  | "projects"
  | "certifications"
  | "achievements"
  | "interests"
  | "references"
  | "custom";

export const ALL_SECTION_KEYS: SectionKey[] = [
  "summary", "skills", "languages", "experience", "education", "projects",
  "certifications", "achievements", "interests", "references", "custom",
];

export const SECTION_TITLES_ID: Record<SectionKey, string> = {
  summary: "Ringkasan",
  skills: "Keahlian",
  languages: "Bahasa",
  experience: "Pengalaman Kerja",
  education: "Pendidikan",
  projects: "Proyek",
  certifications: "Sertifikasi",
  achievements: "Organisasi & Penghargaan",
  interests: "Minat",
  references: "Referensi",
  custom: "Bagian Tambahan",
};

export const SECTION_TITLES_EN: Record<SectionKey, string> = {
  summary: "Summary",
  skills: "Skills",
  languages: "Languages",
  experience: "Work Experience",
  education: "Education",
  projects: "Projects",
  certifications: "Certifications",
  achievements: "Organizations & Awards",
  interests: "Interests",
  references: "References",
  custom: "Additional",
};

export type HeadingStyle = "bar" | "underline" | "plain" | "centered";
export type SkillStyle = "bars" | "dots" | "text";
export type PhotoShape = "circle" | "rounded" | "square";

export interface CvData {
  templateId: CvTemplateId;
  accentColor: string;
  fontFamily: string;
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  summary: string;
  skills: SkillItem[];
  languages: LangItem[];
  experience: ExpItem[];
  education: EduItem[];
  certifications: CertItem[];
  achievements: AchItem[];
  // ── Pengembangan v2.7 ──
  extraInfo: string; // info pribadi tambahan, satu baris = satu info (mis. "Tempat/Tgl Lahir: ...")
  projects: ProjectItem[];
  references: ReferenceItem[];
  interests: string; // dipisah koma / baris baru
  customTitle: string;
  customBody: string; // satu baris = satu bullet
  sectionOrder: SectionKey[];
  hiddenSections: SectionKey[];
  sectionTitles: Partial<Record<SectionKey, string>>;
  textScale: number; // 0.8–1.7 — ukuran teks relatif (zoom isi halaman)
  autoFit: boolean; // otomatis perkecil teks agar muat 1 halaman
  marginMm: number; // 6–25 mm
  lineSpacing: number; // 0.85–1.5
  sectionSpacing: number; // 0.6–1.8
  headingStyle: HeadingStyle;
  skillStyle: SkillStyle;
  textColor: string;
  showPhoto: boolean;
  photoShape: PhotoShape;
  photoZoom: number; // 1–3
  photoX: number; // -1..1 geser horizontal
  photoY: number; // -1..1 geser vertikal
}

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function emptySkill(): SkillItem {
  return { id: newId("skill"), name: "", level: 75 };
}
export function emptyLang(): LangItem {
  return { id: newId("lang"), name: "", level: "Mahir" };
}
export function emptyExp(): ExpItem {
  return { id: newId("exp"), role: "", company: "", location: "", period: "", description: "" };
}
export function emptyEdu(): EduItem {
  return { id: newId("edu"), degree: "", school: "", period: "", description: "" };
}
export function emptyCert(): CertItem {
  return { id: newId("cert"), name: "", issuer: "", year: "" };
}
export function emptyAch(): AchItem {
  return { id: newId("ach"), title: "", org: "", period: "", description: "" };
}

export function emptyProject(): ProjectItem {
  return { id: newId("proj"), name: "", role: "", period: "", description: "", link: "" };
}
export function emptyReference(): ReferenceItem {
  return { id: newId("ref"), name: "", position: "", contact: "" };
}

/** Nilai bawaan untuk semua pengaturan tampilan baru. */
export function defaultCvStyle(): Pick<
  CvData,
  | "extraInfo" | "projects" | "references" | "interests" | "customTitle" | "customBody"
  | "sectionOrder" | "hiddenSections" | "sectionTitles" | "textScale" | "autoFit" | "marginMm"
  | "lineSpacing" | "sectionSpacing" | "headingStyle" | "skillStyle" | "textColor" | "showPhoto"
  | "photoShape" | "photoZoom" | "photoX" | "photoY"
> {
  return {
    extraInfo: "",
    projects: [],
    references: [],
    interests: "",
    customTitle: "",
    customBody: "",
    sectionOrder: ["summary", "skills", "languages", "experience", "education", "projects", "certifications", "achievements", "interests", "references", "custom"],
    hiddenSections: [],
    sectionTitles: {},
    textScale: 1.25,
    autoFit: false,
    marginMm: 11,
    lineSpacing: 1,
    sectionSpacing: 1,
    headingStyle: "bar",
    skillStyle: "bars",
    textColor: "#334155",
    showPhoto: true,
    photoShape: "circle",
    photoZoom: 1,
    photoX: 0,
    photoY: 0,
  };
}

/**
 * Menggabungkan data mentah (mis. dari file .json atau draf tersimpan, yang bisa
 * berasal dari versi lama) dengan nilai bawaan, sehingga field baru selalu terisi
 * dan tidak ada yang `undefined`. Urutan bagian dilengkapi bila ada kunci yang hilang.
 */
export function normalizeCvData(raw: any): CvData {
  const base = { ...defaultCvData(), ...defaultCvStyle() } as CvData;
  if (!raw || typeof raw !== "object") return base;
  const merged: any = { ...base, ...raw };
  const arr = (v: any) => (Array.isArray(v) ? v : []);
  for (const k of ["skills", "languages", "experience", "education", "certifications", "achievements", "projects", "references"]) {
    merged[k] = arr(raw[k] ?? (base as any)[k]).map((it: any) => ({ ...it, id: it?.id || newId(k) }));
  }
  const order: SectionKey[] = arr(raw.sectionOrder).filter((k: any) => ALL_SECTION_KEYS.includes(k));
  for (const k of ALL_SECTION_KEYS) if (!order.includes(k)) order.push(k);
  merged.sectionOrder = order;
  merged.hiddenSections = arr(raw.hiddenSections).filter((k: any) => ALL_SECTION_KEYS.includes(k));
  merged.sectionTitles = raw.sectionTitles && typeof raw.sectionTitles === "object" ? raw.sectionTitles : {};
  const clamp = (v: any, lo: number, hi: number, d: number) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  merged.textScale = clamp(raw.textScale, 0.8, 1.7, base.textScale);
  merged.marginMm = clamp(raw.marginMm, 6, 25, base.marginMm);
  merged.lineSpacing = clamp(raw.lineSpacing, 0.85, 1.5, 1);
  merged.sectionSpacing = clamp(raw.sectionSpacing, 0.6, 1.8, 1);
  merged.photoZoom = clamp(raw.photoZoom, 1, 3, 1);
  merged.photoX = clamp(raw.photoX, -1, 1, 0);
  merged.photoY = clamp(raw.photoY, -1, 1, 0);
  if (!CV_TEMPLATES.some((t) => t.id === merged.templateId)) merged.templateId = "minimal";
  if (!["bar", "underline", "plain", "centered"].includes(merged.headingStyle)) merged.headingStyle = "bar";
  if (!["bars", "dots", "text"].includes(merged.skillStyle)) merged.skillStyle = "bars";
  if (!["circle", "rounded", "square"].includes(merged.photoShape)) merged.photoShape = "circle";
  return merged as CvData;
}

export function defaultCvData(): CvData {
  return {
    templateId: "minimal",
    accentColor: CV_TEMPLATES[0].accentDefault,
    fontFamily: DEFAULT_FONT_FAMILY,
    fullName: "Nama Lengkap Anda",
    jobTitle: "Posisi / Profesi yang Dituju",
    email: "nama@email.com",
    phone: "0812-3456-7890",
    address: "Kota, Provinsi",
    website: "linkedin.com/in/namaanda",
    summary:
      "Ringkasan singkat mengenai pengalaman, keahlian utama, dan tujuan karier Anda. Tulis 2-4 kalimat yang langsung menonjolkan nilai jual Anda ke perekrut.",
    skills: [
      { id: newId("skill"), name: "Manajemen Proyek", level: 85 },
      { id: newId("skill"), name: "Microsoft Excel", level: 90 },
      { id: newId("skill"), name: "Komunikasi", level: 80 },
    ],
    languages: [
      { id: newId("lang"), name: "Bahasa Indonesia", level: "Native" },
      { id: newId("lang"), name: "Bahasa Inggris", level: "Mahir" },
    ],
    experience: [
      {
        id: newId("exp"),
        role: "Jabatan / Posisi",
        company: "Nama Perusahaan",
        location: "Kota",
        period: "Jan 2022 — Sekarang",
        description:
          "Jelaskan tanggung jawab dan pencapaian utama Anda di sini.\nGunakan satu baris untuk satu poin agar tampil sebagai bullet point.",
      },
    ],
    education: [
      {
        id: newId("edu"),
        degree: "Jenjang & Jurusan",
        school: "Nama Institusi Pendidikan",
        period: "2018 — 2022",
        description: "IPK / prestasi akademik singkat (opsional).",
      },
    ],
    certifications: [],
    achievements: [],
    ...defaultCvStyle(),
  };
}
