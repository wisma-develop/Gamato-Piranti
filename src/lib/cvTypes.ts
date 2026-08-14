// Shared data model, item factories, and template registry for the CV Maker
// (Special > Pembuat CV). Kept separate from cvEngine.ts so the UI layer can
// import lightweight types/factories without pulling in the canvas renderer.

export type CvTemplateId = "sidebar" | "accent" | "band" | "minimal" | "timeline";

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

export interface CvData {
  templateId: CvTemplateId;
  accentColor: string;
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

export function defaultCvData(): CvData {
  return {
    templateId: "minimal",
    accentColor: CV_TEMPLATES[0].accentDefault,
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
  };
}
