import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IdCard, User, AlignLeft, Sparkles, Languages, Briefcase, GraduationCap, Award, Trophy, Plus, Trash2,
  Download, Printer, Loader2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RotateCcw, Image as ImageIcon,
  CheckCircle2, Palette, Type, ListOrdered, FolderGit2, Shapes, FileDown, Eye, EyeOff, Copy, FileText, Upload,
  Save, Maximize2, X, Eraser, Users,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { printCanvasPages } from "@/lib/printCanvas";
import { renderCvDocument } from "@/lib/cvEngine";
import { cvPagesToPdfBlob } from "@/lib/cvPdf";
import { buildCvDocxBlob } from "@/lib/cvDocx";
import {
  CV_TEMPLATES, ACCENT_PRESETS, SECTION_TITLES_EN, SECTION_TITLES_ID, defaultCvData,
  normalizeCvData, emptySkill, emptyLang, emptyExp, emptyEdu, emptyCert, emptyAch, emptyProject, emptyReference,
  type CvData, type CvTemplateId, type SectionKey, type HeadingStyle, type SkillStyle, type PhotoShape,
} from "@/lib/cvTypes";
import { Label, Input, Select, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { FontPicker } from "@/components/ui/FontPicker";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { PanelCard } from "@/components/ui/PanelCard";
import { useDialog } from "@/hooks/useDialog";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { SettingsTabBar, NextTabHint, type SettingsTabDef } from "@/components/ui/SettingsTabs";
import { ExportQuality, type ExportScale } from "@/components/ui/ExportQuality";
import { PreviewJumpFab } from "@/components/ui/PreviewJumpFab";
import { fileToDataUrl } from "@/lib/file";
import JSZip from "jszip";
import { tr } from "@/i18n";

type TabId =
  | "template" | "tampilan" | "susunan" | "profil" | "ringkasan" | "keahlian" | "bahasa" | "pengalaman"
  | "pendidikan" | "proyek" | "sertifikasi" | "organisasi" | "lainnya" | "ekspor";

const ic = "w-3.5 h-3.5";
const TABS: SettingsTabDef<TabId>[] = [
  { id: "template", label: tr("Template"), icon: <Shapes className={ic} /> },
  { id: "tampilan", label: tr("Tampilan"), icon: <Palette className={ic} /> },
  { id: "susunan", label: tr("Susunan"), icon: <ListOrdered className={ic} /> },
  { id: "profil", label: tr("Profil & Foto"), icon: <User className={ic} /> },
  { id: "ringkasan", label: tr("Ringkasan"), icon: <AlignLeft className={ic} /> },
  { id: "keahlian", label: tr("Keahlian"), icon: <Sparkles className={ic} /> },
  { id: "bahasa", label: tr("Bahasa"), icon: <Languages className={ic} /> },
  { id: "pengalaman", label: tr("Pengalaman"), icon: <Briefcase className={ic} /> },
  { id: "pendidikan", label: tr("Pendidikan"), icon: <GraduationCap className={ic} /> },
  { id: "proyek", label: tr("Proyek"), icon: <FolderGit2 className={ic} /> },
  { id: "sertifikasi", label: tr("Sertifikasi"), icon: <Award className={ic} /> },
  { id: "organisasi", label: tr("Organisasi"), icon: <Trophy className={ic} /> },
  { id: "lainnya", label: tr("Lainnya"), icon: <Users className={ic} /> },
  { id: "ekspor", label: tr("Ekspor & Draf"), icon: <FileDown className={ic} /> },
];

const DRAFT_KEY = "gamato.cv.draft.v2";
const ASIDE_TEMPLATES: CvTemplateId[] = ["sidebar", "accent", "band", "split"];

type ListKey = "skills" | "languages" | "experience" | "education" | "certifications" | "achievements" | "projects" | "references";

// Fabrik CRUD generik untuk field berdaftar (tambah / hapus / ubah / pindah / duplikat).
function useListField<T extends { id: string }>(setData: React.Dispatch<React.SetStateAction<CvData>>, key: ListKey, factory: () => T) {
  const mutate = (fn: (list: T[]) => T[]) => setData((prev) => ({ ...prev, [key]: fn(prev[key] as unknown as T[]) } as CvData));
  return {
    add: () => mutate((l) => [...l, factory()]),
    remove: (id: string) => mutate((l) => l.filter((i) => i.id !== id)),
    update: (id: string, patch: Partial<T>) => mutate((l) => l.map((i) => (i.id === id ? { ...i, ...patch } : i))),
    move: (id: string, dir: -1 | 1) =>
      mutate((l) => {
        const i = l.findIndex((x) => x.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= l.length) return l;
        const n = [...l];
        [n[i], n[j]] = [n[j], n[i]];
        return n;
      }),
    duplicate: (id: string) =>
      mutate((l) => {
        const i = l.findIndex((x) => x.id === id);
        if (i < 0) return l;
        const copy = { ...l[i], id: `${key}-${Math.random().toString(36).slice(2, 9)}` };
        return [...l.slice(0, i + 1), copy, ...l.slice(i + 1)];
      }),
  };
}

const IconBtn: React.FC<{ onClick: () => void; label: string; disabled?: boolean; danger?: boolean; children: React.ReactNode }> = ({ onClick, label, disabled, danger, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={cn(
      "p-1.5 rounded-lg shrink-0 transition-colors disabled:opacity-25 disabled:pointer-events-none",
      danger ? "text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
    )}
  >
    {children}
  </button>
);

/** Alat per-item: naik, turun, gandakan, hapus. */
function ItemTools({ ops, id, index, count, noun }: { ops: ReturnType<typeof useListField<any>>; id: string; index: number; count: number; noun: string }) {
  return (
    <div className="flex items-center">
      <IconBtn onClick={() => ops.move(id, -1)} label={tr("Naikkan {0}", noun)} disabled={index === 0}><ChevronUp className="w-4 h-4" /></IconBtn>
      <IconBtn onClick={() => ops.move(id, 1)} label={tr("Turunkan {0}", noun)} disabled={index === count - 1}><ChevronDown className="w-4 h-4" /></IconBtn>
      <IconBtn onClick={() => ops.duplicate(id)} label={tr("Gandakan {0}", noun)}><Copy className="w-4 h-4" /></IconBtn>
      <IconBtn onClick={() => ops.remove(id)} label={`Hapus ${noun}`} danger><Trash2 className="w-4 h-4" /></IconBtn>
    </div>
  );
}

const EmptyHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">{children}</p>
);

const Segmented = <T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) => (
  <div>
    <Label>{label}</Label>
    <div className="grid gap-1.5 mt-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "py-2 px-1 rounded-xl text-xs font-semibold border-2 transition-all",
            value === o.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const SliderRow: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string; hint?: string }> = ({ label, value, min, max, step, onChange, format, hint }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <Label>{label}</Label>
      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{format ? format(value) : value}</span>
    </div>
    <GamatoSlider min={min} max={max} step={step} value={value} onChange={onChange} aria-label={label} />
    {hint && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{hint}</p>}
  </div>
);

/** Perkecil foto unggahan (maks 900px) agar draf tersimpan ringan & render cepat. */
async function downscalePhoto(file: File): Promise<string> {
  const raw = await fileToDataUrl(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(tr("Foto tidak dapat dibaca.")));
    i.src = raw;
  });
  const k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
  if (k >= 1 && file.size < 600_000) return raw;
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

function loadDraft(): { data: CvData; photo: string | null } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { data: normalizeCvData(parsed.data), photo: typeof parsed.photo === "string" ? parsed.photo : null };
  } catch {
    return null;
  }
}

export const CvMaker: React.FC = () => {
  const dialog = useDialog();
  const initialDraft = useMemo(() => loadDraft(), []);
  const cvHistory = useHistoryState<CvData>(() => initialDraft?.data ?? defaultCvData());
  const data = cvHistory.state;
  const { schedule: scheduleCvCommit } = useDebouncedCommit(cvHistory.commit, 700);
  const setData: React.Dispatch<React.SetStateAction<CvData>> = (updater) => {
    cvHistory.set(updater, { commit: false });
    scheduleCvCommit();
  };
  const [photoData, setPhotoData] = useState<string | null>(initialDraft?.photo ?? null);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [tab, setTab] = useState<TabId>("template");
  const { customFonts, isFontLoading, fontError, addCustomFont, removeCustomFont } = useCustomFonts();
  const handleRemoveCustomFont = (id: string) => removeCustomFont(id, (fallback) => { if (data.fontFamily === id) setData((p) => ({ ...p, fontFamily: fallback })); });

  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [fitInfo, setFitInfo] = useState<{ used: number; failed: boolean }>({ used: 1, failed: false });
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [exportScale, setExportScale] = useState<ExportScale>(2);
  const [info, setInfo] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [draftNote, setDraftNote] = useState<string | null>(initialDraft ? tr("Draf terakhir Anda dipulihkan otomatis.") : null);
  const renderSeq = useRef(0);
  const jsonInput = useRef<HTMLInputElement>(null);

  const skillOps = useListField(setData, "skills", emptySkill);
  const langOps = useListField(setData, "languages", emptyLang);
  const expOps = useListField(setData, "experience", emptyExp);
  const eduOps = useListField(setData, "education", emptyEdu);
  const certOps = useListField(setData, "certifications", emptyCert);
  const achOps = useListField(setData, "achievements", emptyAch);
  const projOps = useListField(setData, "projects", emptyProject);
  const refOps = useListField(setData, "references", emptyReference);

  const activeTemplate = useMemo(() => CV_TEMPLATES.find((t) => t.id === data.templateId) ?? CV_TEMPLATES[0], [data.templateId]);
  const isAside = ASIDE_TEMPLATES.includes(data.templateId);
  const patch = (fields: Partial<CvData>) => setData((prev) => ({ ...prev, ...fields }));

  // Muat foto (data URL) menjadi elemen gambar untuk kanvas.
  useEffect(() => {
    if (!photoData) { setPhotoImg(null); return; }
    let cancelled = false;
    const i = new Image();
    i.onload = () => { if (!cancelled) setPhotoImg(i); };
    i.src = photoData;
    return () => { cancelled = true; };
  }, [photoData]);

  // Simpan draf otomatis (jeda singkat). Bila kuota penyimpanan penuh, simpan tanpa foto.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, photo: photoData }));
      } catch {
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, photo: null })); } catch { /* penyimpanan tidak tersedia */ }
      }
    }, 700);
    return () => clearTimeout(t);
  }, [data, photoData]);

  // Render pratinjau (debounce). URL gambar dibuat SEKALI per hasil render, bukan di setiap render React.
  useEffect(() => {
    const seq = ++renderSeq.current;
    setIsRendering(true);
    const timer = setTimeout(async () => {
      try {
        const result = await renderCvDocument(data, photoImg, { scale: 1 });
        if (renderSeq.current !== seq) return;
        setPageUrls(result.pages.map((p) => p.toDataURL("image/png")));
        setPageCount(result.pages.length);
        setFitInfo({ used: result.usedTextScale, failed: result.fitFailed });
        setPreviewIndex((prev) => Math.min(prev, result.pages.length - 1));
      } catch (err: any) {
        if (renderSeq.current !== seq) return;
        setInfo({ type: "error", text: err?.message || tr("Gagal membuat pratinjau CV. Coba periksa kembali data yang diisi.") });
      } finally {
        if (renderSeq.current === seq) setIsRendering(false);
      }
    }, 240);
    return () => clearTimeout(timer);
  }, [data, photoImg]);

  const selectTemplate = (id: CvTemplateId) => {
    const tpl = CV_TEMPLATES.find((t) => t.id === id);
    setData((prev) => ({
      ...prev,
      templateId: id,
      accentColor: tpl?.accentDefault ?? prev.accentColor,
      headingStyle: id === "elegant" ? "centered" : prev.headingStyle === "centered" ? "bar" : prev.headingStyle,
    }));
  };

  const baseFileName = () => sanitizeFileName(data.fullName ? `CV - ${data.fullName}` : tr("CV Gamato Piranti")) || "cv";

  const handleReset = async () => {
    const ok = await dialog.confirm({
      title: tr("Reset ke Data Contoh?"),
      message: tr("Semua isian CV Anda saat ini akan diganti dengan data contoh. Tindakan ini tidak bisa dibatalkan."),
      confirmLabel: tr("Ya, Reset"), cancelLabel: tr("Batal"), danger: true,
    });
    if (!ok) return;
    cvHistory.reset(defaultCvData());
    setPhotoData(null);
    setDraftNote(null);
    setInfo({ type: "success", text: tr("CV dikembalikan ke data contoh.") });
  };

  const handleBlank = async () => {
    const ok = await dialog.confirm({
      title: tr("Kosongkan Semua Isian?"),
      message: tr("Semua isi CV (profil, pengalaman, pendidikan, dll.) dihapus sehingga Anda mulai dari lembar kosong. Pengaturan template & tampilan tetap dipertahankan."),
      confirmLabel: tr("Ya, Kosongkan"), cancelLabel: tr("Batal"), danger: true,
    });
    if (!ok) return;
    cvHistory.reset({
      ...data,
      fullName: "", jobTitle: "", email: "", phone: "", address: "", website: "", summary: "",
      skills: [], languages: [], experience: [], education: [], certifications: [], achievements: [],
      projects: [], references: [], extraInfo: "", interests: "", customTitle: "", customBody: "",
    });
    setPhotoData(null);
    setInfo({ type: "success", text: tr("Semua isian dikosongkan. Silakan mulai mengisi dari tab Profil.") });
    setTab("profil");
  };

  const saveJson = () => {
    const blob = new Blob([JSON.stringify({ app: "gamato-piranti-cv", version: 2, data, photo: photoData }, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${baseFileName()}.json`);
    setInfo({ type: "success", text: tr("Draf CV disimpan sebagai file .json — bisa dibuka lagi kapan saja.") });
  };

  const openJson = async (file: File | null) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const src = parsed?.data ?? parsed;
      cvHistory.reset(normalizeCvData(src));
      setPhotoData(typeof parsed?.photo === "string" ? parsed.photo : null);
      setInfo({ type: "success", text: tr("Draf \"{0}\" berhasil dibuka.", file.name) });
    } catch {
      setInfo({ type: "error", text: tr("File draf tidak valid. Pastikan file .json berasal dari Pembuat CV Gamato Piranti.") });
    }
  };

  /** Render ulang beresolusi tinggi khusus ekspor. */
  const renderForExport = useCallback(
    (recordText: boolean) => renderCvDocument(data, photoImg, { scale: exportScale, recordText }),
    [data, photoImg, exportScale]
  );

  const runExport = async (label: string, fn: () => Promise<string>) => {
    setInfo(null);
    setIsExporting(true);
    try {
      const msg = await fn();
      setInfo({ type: "success", text: msg });
    } catch (err: any) {
      setInfo({ type: "error", text: err?.message || tr("Gagal membuat {0}.", label) });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadPdf = () =>
    runExport("PDF", async () => {
      const { pages } = await renderForExport(true);
      const { blob, textRuns } = await cvPagesToPdfBlob(pages, data.fullName || "CV", data.fullName || "");
      downloadBlob(blob, `${baseFileName()}.pdf`);
      return tr("CV diunduh sebagai PDF ({0} halaman, {1}×{2}px/halaman, {3} teks bisa dipilih & dibaca ATS).", pages.length, pages[0].width, pages[0].height, textRuns);
    });

  const downloadPng = () =>
    runExport("PNG", async () => {
      const { pages } = await renderForExport(false);
      const base = baseFileName();
      if (pages.length === 1) downloadBlob(await canvasToBlob(pages[0]), `${base}.png`);
      else {
        const zip = new JSZip();
        for (let i = 0; i < pages.length; i++) zip.file(`${base}-hal-${String(i + 1).padStart(2, "0")}.png`, await canvasToBlob(pages[i]));
        downloadBlob(await zip.generateAsync({ type: "blob" }), `${base}-png.zip`);
      }
      return tr("CV diunduh sebagai PNG ({0} halaman, {1}×{2}px).", pages.length, pages[0].width, pages[0].height);
    });

  const downloadDocx = () =>
    runExport("DOCX", async () => {
      downloadBlob(await buildCvDocxBlob(data), `${baseFileName()}.docx`);
      return tr("CV diunduh sebagai .docx — bisa diedit di Word / Google Docs (teks murni, paling ramah ATS).");
    });

  const printNow = async () => {
    setInfo(null);
    try {
      const { pages } = await renderForExport(false);
      printCanvasPages(pages, { title: tr("CV — {0}", data.fullName || tr("Gamato Piranti")) });
    } catch (err: any) {
      await dialog.alert({ title: tr("Gagal Mencetak"), message: err?.message || tr("Gagal membuka dialog cetak."), tone: "danger" });
    }
  };

  // ── Susunan bagian ──
  const moveSection = (key: SectionKey, dir: -1 | 1) =>
    setData((prev) => {
      const i = prev.sectionOrder.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.sectionOrder.length) return prev;
      const o = [...prev.sectionOrder];
      [o[i], o[j]] = [o[j], o[i]];
      return { ...prev, sectionOrder: o };
    });
  const toggleSection = (key: SectionKey) =>
    setData((prev) => ({ ...prev, hiddenSections: prev.hiddenSections.includes(key) ? prev.hiddenSections.filter((k) => k !== key) : [...prev.hiddenSections, key] }));
  const setTitle = (key: SectionKey, value: string) => setData((prev) => ({ ...prev, sectionTitles: { ...prev.sectionTitles, [key]: value } }));
  const applyTitlePreset = (lang: "id" | "en") =>
    setData((prev) => ({ ...prev, sectionTitles: lang === "en" ? { ...SECTION_TITLES_EN } : {} }));

  const sectionCount: Record<SectionKey, number> = {
    summary: data.summary.trim() ? 1 : 0,
    skills: data.skills.filter((s) => s.name.trim()).length,
    languages: data.languages.filter((s) => s.name.trim()).length,
    experience: data.experience.filter((e) => e.role.trim() || e.company.trim()).length,
    education: data.education.filter((e) => e.degree.trim() || e.school.trim()).length,
    projects: data.projects.filter((p) => p.name.trim()).length,
    certifications: data.certifications.filter((c) => c.name.trim()).length,
    achievements: data.achievements.filter((a) => a.title.trim()).length,
    interests: data.interests.trim() ? 1 : 0,
    references: data.references.filter((r) => r.name.trim()).length,
    custom: data.customBody.trim() ? 1 : 0,
  };

  const next = <NextTabHint tabs={TABS} active={tab} onChange={setTab} />;

  return (
    <div className="space-y-6">
      <GamatoDesktopRecommended toolName="Pembuat CV" />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        {/* ───────── KIRI: pengaturan ───────── */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Editor CV")}</span>
            <UndoRedoBar canUndo={cvHistory.canUndo} canRedo={cvHistory.canRedo} onUndo={cvHistory.undo} onRedo={cvHistory.redo} />
          </div>

          {draftNote && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <span className="flex items-center gap-2"><Save className="w-3.5 h-3.5 shrink-0" />{tr("{0} Perubahan tersimpan otomatis di perangkat ini.", draftNote)}</span>
              <button type="button" onClick={() => setDraftNote(null)} aria-label={tr("Tutup")} className="shrink-0 hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          <SettingsTabBar tabs={TABS} active={tab} onChange={setTab} />

          {/* TEMPLATE */}
          {tab === "template" && (
            <PanelCard title={tr("Pilih Template")} subtitle={tr("Semua template otomatis berlanjut ke halaman berikutnya bila isi CV panjang")}>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {CV_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => selectTemplate(tpl.id)}
                    aria-pressed={data.templateId === tpl.id}
                    className={cn(
                      "text-left rounded-xl border-2 p-3.5 transition-all relative",
                      data.templateId === tpl.id ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    )}
                  >
                    {data.templateId === tpl.id && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 absolute top-3 right-3" />}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tpl.accentDefault }} />
                      <p className="font-bold text-[13px] text-slate-900 dark:text-white pr-5">{tpl.name}</p>
                    </div>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-3">{tpl.desc}</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {tpl.atsFriendly && <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">{tr("Ramah ATS")}</span>}
                      {tpl.usesPhoto && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{tr("Foto")}</span>}
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <Label>{tr("Warna Aksen")}</Label>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {ACCENT_PRESETS.map((c) => (
                    <button key={c} type="button" onClick={() => patch({ accentColor: c })} style={{ backgroundColor: c }} aria-label={tr("Warna {0}", c)}
                      className={cn("w-8 h-8 rounded-lg border-2 transition-transform", data.accentColor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent")} title={c} />
                  ))}
                  <GamatoColorPicker value={data.accentColor} onChange={(hex) => patch({ accentColor: hex })} />
                </div>
              </div>
              {next}
            </PanelCard>
          )}

          {/* TAMPILAN */}
          {tab === "tampilan" && (
            <PanelCard title={tr("Tampilan & Tipografi")} subtitle={tr("Atur ukuran teks, jarak, margin, dan gaya judul — pratinjau berubah langsung")}>
              <FontPicker value={data.fontFamily} onChange={(family) => patch({ fontFamily: family })} customFonts={customFonts} isFontLoading={isFontLoading} fontError={fontError} onUpload={addCustomFont} onRemoveCustomFont={handleRemoveCustomFont} />
              <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
                <SliderRow label={tr("Ukuran Teks")} value={data.textScale} min={0.8} max={1.7} step={0.05} onChange={(v) => patch({ textScale: v })} format={(v) => `${Math.round(v * 100)}%`} hint={tr("Memperbesar/memperkecil seluruh isi halaman.")} />
                <SliderRow label={tr("Margin Halaman")} value={data.marginMm} min={6} max={25} step={1} onChange={(v) => patch({ marginMm: v })} format={(v) => `${v} mm`} />
                <SliderRow label={tr("Jarak Antar Baris")} value={data.lineSpacing} min={0.85} max={1.5} step={0.05} onChange={(v) => patch({ lineSpacing: v })} format={(v) => `${v.toFixed(2)}×`} />
                <SliderRow label={tr("Jarak Antar Bagian")} value={data.sectionSpacing} min={0.6} max={1.8} step={0.05} onChange={(v) => patch({ sectionSpacing: v })} format={(v) => `${v.toFixed(2)}×`} />
              </div>
              <GamatoCheckbox checked={data.autoFit} onChange={(v) => patch({ autoFit: v })} label={tr("Muat 1 halaman otomatis (teks diperkecil seperlunya)")} />
              {data.autoFit && pageCount === 1 && fitInfo.used < data.textScale - 0.001 && (
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 -mt-2">{tr("Teks diperkecil otomatis ke {0}% agar muat 1 halaman.", Math.round(fitInfo.used * 100))}</p>
              )}
              {data.autoFit && fitInfo.failed && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 -mt-2">{tr("Isi terlalu panjang untuk 1 halaman bahkan pada ukuran terkecil (70%). Ringkas isian atau matikan opsi ini.")}</p>
              )}
              <Segmented<HeadingStyle> label={tr("Gaya Judul Bagian")} value={data.headingStyle} onChange={(v) => patch({ headingStyle: v })}
                options={[{ id: "bar", label: tr("Garis Samping") }, { id: "underline", label: tr("Garis Bawah") }, { id: "plain", label: tr("Polos") }, { id: "centered", label: tr("Terpusat") }]} />
              <Segmented<SkillStyle> label={tr("Tampilan Keahlian")} value={data.skillStyle} onChange={(v) => patch({ skillStyle: v })}
                options={[{ id: "bars", label: isAside ? tr("Bar Level") : tr("Standar") }, { id: "dots", label: tr("Titik Level") }, { id: "text", label: tr("Teks Saja") }]} />
              <div>
                <Label>{tr("Warna Teks Isi")}</Label>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {["#334155", "#1e293b", "#000000", "#475569"].map((c) => (
                    <button key={c} type="button" onClick={() => patch({ textColor: c })} style={{ backgroundColor: c }} aria-label={tr("Warna teks {0}", c)}
                      className={cn("w-7 h-7 rounded-lg border-2", data.textColor === c ? "border-indigo-500 scale-110" : "border-transparent")} />
                  ))}
                  <GamatoColorPicker value={data.textColor} onChange={(hex) => patch({ textColor: hex })} />
                </div>
              </div>
              {next}
            </PanelCard>
          )}

          {/* SUSUNAN */}
          {tab === "susunan" && (
            <PanelCard title={tr("Susunan & Judul Bagian")} subtitle={tr("Atur urutan, tampilkan/sembunyikan, dan ganti nama judul tiap bagian CV")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">{tr("Bahasa judul:")}</span>
                <Btn onClick={() => applyTitlePreset("id")} variant="secondary" className="text-xs py-1.5">{tr("Indonesia")}</Btn>
                <Btn onClick={() => applyTitlePreset("en")} variant="secondary" className="text-xs py-1.5">{tr("English")}</Btn>
              </div>
              {isAside && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-3 py-2">{tr("Template \"{0}\" menaruh", activeTemplate.name)}{" "}<b>{tr("Keahlian")}</b> & <b>{tr("Bahasa")}</b> {tr("di kolom samping (posisi tetap). Urutan lain tetap berlaku pada kolom utama.")}
                </p>
              )}
              <ul className="space-y-2">
                {data.sectionOrder.map((key, i) => {
                  const hidden = data.hiddenSections.includes(key);
                  const empty = sectionCount[key] === 0;
                  return (
                    <li key={key} className={cn("flex items-center gap-2 rounded-xl border p-2 bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700", hidden && "opacity-55")}>
                      <div className="flex flex-col">
                        <IconBtn onClick={() => moveSection(key, -1)} label={tr("Naikkan {0}", SECTION_TITLES_ID[key])} disabled={i === 0}><ChevronUp className="w-4 h-4" /></IconBtn>
                        <IconBtn onClick={() => moveSection(key, 1)} label={tr("Turunkan {0}", SECTION_TITLES_ID[key])} disabled={i === data.sectionOrder.length - 1}><ChevronDown className="w-4 h-4" /></IconBtn>
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          aria-label={tr("Judul untuk {0}", SECTION_TITLES_ID[key])}
                          value={data.sectionTitles[key] ?? ""}
                          onChange={(e) => setTitle(key, e.target.value)}
                          placeholder={SECTION_TITLES_ID[key]}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
                        />
                        <p className="text-[10.5px] text-slate-400 mt-0.5">{empty ? tr("Belum ada isi — tidak ditampilkan di CV") : tr("{0} item terisi", sectionCount[key])}</p>
                      </div>
                      <IconBtn onClick={() => toggleSection(key)} label={hidden ? tr("Tampilkan {0}", SECTION_TITLES_ID[key]) : tr("Sembunyikan {0}", SECTION_TITLES_ID[key])}>
                        {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </IconBtn>
                    </li>
                  );
                })}
              </ul>
              <Btn onClick={() => patch({ sectionOrder: [...defaultCvData().sectionOrder], hiddenSections: [], sectionTitles: {} })} variant="ghost" className="text-xs gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> {tr("Kembalikan susunan bawaan")}
              </Btn>
              {next}
            </PanelCard>
          )}

          {/* PROFIL & FOTO */}
          {tab === "profil" && (
            <PanelCard title={tr("Profil, Kontak & Foto")} subtitle={tr("Informasi utama yang tampil di bagian atas CV")}>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label={tr("Nama Lengkap")} value={data.fullName} onChange={(e) => patch({ fullName: e.target.value })} />
                <Input label={tr("Posisi / Profesi yang Dituju")} value={data.jobTitle} onChange={(e) => patch({ jobTitle: e.target.value })} />
                <Input label={tr("Email")} type="email" value={data.email} onChange={(e) => patch({ email: e.target.value })} />
                <Input label={tr("Telepon")} value={data.phone} onChange={(e) => patch({ phone: e.target.value })} />
                <Input label={tr("Alamat / Kota")} value={data.address} onChange={(e) => patch({ address: e.target.value })} />
                <Input label={tr("Website / LinkedIn")} value={data.website} onChange={(e) => patch({ website: e.target.value })} />
              </div>
              <Textarea label={tr("Info Tambahan (opsional) — satu baris = satu info")} rows={3} value={data.extraInfo} onChange={(e) => patch({ extraInfo: e.target.value })} placeholder={tr("GitHub: github.com/nama\nTempat/Tgl Lahir: Bali, 1 Januari 1999")} />

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-indigo-500" /> {tr("Foto Profil")}</p>
                {!activeTemplate.usesPhoto && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2">{tr("Template \"{0}\" tidak menampilkan foto (didesain ramah ATS). Pilih template bersidebar/banner untuk memakai foto.", activeTemplate.name)}</p>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                    {photoData ? <img src={photoData} alt={tr("Foto profil")} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-slate-400" />}
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Upload className="w-4 h-4" /> {photoData ? tr("Ganti Foto") : tr("Unggah Foto")}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const f = e.target.files?.[0]; e.target.value = "";
                      if (!f) return;
                      try { setPhotoData(await downscalePhoto(f)); } catch (err: any) { setInfo({ type: "error", text: err?.message || tr("Foto gagal dimuat.") }); }
                    }} />
                  </label>
                  {photoData && <Btn onClick={() => setPhotoData(null)} variant="ghost" className="text-xs text-red-500"><Trash2 className="w-3.5 h-3.5" /> {tr("Hapus")}</Btn>}
                </div>
                {photoData && activeTemplate.usesPhoto && (
                  <div className="space-y-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                    <GamatoCheckbox checked={data.showPhoto} onChange={(v) => patch({ showPhoto: v })} label={tr("Tampilkan foto di CV")} />
                    <Segmented<PhotoShape> label={tr("Bentuk Foto")} value={data.photoShape} onChange={(v) => patch({ photoShape: v })} options={[{ id: "circle", label: tr("Lingkaran") }, { id: "rounded", label: tr("Sudut Bulat") }, { id: "square", label: tr("Persegi") }]} />
                    <SliderRow label={tr("Zoom")} value={data.photoZoom} min={1} max={3} step={0.05} onChange={(v) => patch({ photoZoom: v })} format={(v) => `${v.toFixed(2)}×`} />
                    <div className="grid grid-cols-2 gap-4">
                      <SliderRow label={tr("Geser Kiri–Kanan")} value={data.photoX} min={-1} max={1} step={0.05} onChange={(v) => patch({ photoX: v })} format={(v) => v.toFixed(2)} />
                      <SliderRow label={tr("Geser Atas–Bawah")} value={data.photoY} min={-1} max={1} step={0.05} onChange={(v) => patch({ photoY: v })} format={(v) => v.toFixed(2)} />
                    </div>
                    <Btn onClick={() => patch({ photoZoom: 1, photoX: 0, photoY: 0 })} variant="ghost" className="text-xs">{tr("Reset posisi foto")}</Btn>
                  </div>
                )}
              </div>
              {next}
            </PanelCard>
          )}

          {/* RINGKASAN */}
          {tab === "ringkasan" && (
            <PanelCard title={tr("Ringkasan Profil")} subtitle={tr("2–4 kalimat yang menonjolkan nilai jual Anda ke perekrut")}>
              <Textarea rows={7} value={data.summary} onChange={(e) => patch({ summary: e.target.value })} placeholder={tr("Tulis ringkasan singkat tentang diri Anda…")} />
              <p className="text-[11px] text-slate-400">{data.summary.trim().split(/\s+/).filter(Boolean).length} {tr("kata · ideal 40–80 kata")}</p>
              {next}
            </PanelCard>
          )}

          {/* KEAHLIAN */}
          {tab === "keahlian" && (
            <PanelCard title={tr("Keahlian")} subtitle={tr("Tingkat kemahiran tampil sesuai pilihan di tab Tampilan (bar / titik / teks saja)")}>
              <div className="space-y-3">
                {data.skills.length === 0 && <EmptyHint>{tr("Belum ada keahlian. Tambahkan minimal satu.")}</EmptyHint>}
                {data.skills.map((s, i) => (
                  <div key={s.id} className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                    <div className="flex-1 space-y-2 min-w-0">
                      <Input value={s.name} onChange={(e) => skillOps.update(s.id, { name: e.target.value })} placeholder={tr("Nama keahlian, mis. Manajemen Proyek")} className="py-2" />
                      <div className="flex items-center gap-3">
                        <GamatoSlider min={10} max={100} step={5} value={s.level} onChange={(v) => skillOps.update(s.id, { level: v })} className="flex-1" aria-label={tr("Level keahlian")} />
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 w-10 text-right">{s.level}%</span>
                      </div>
                    </div>
                    <ItemTools ops={skillOps} id={s.id} index={i} count={data.skills.length} noun="keahlian" />
                  </div>
                ))}
                <Btn onClick={skillOps.add} variant="secondary" className="w-full gap-2 text-sm"><Plus className="w-4 h-4" /> {tr("Tambah Keahlian")}</Btn>
              </div>
              {next}
            </PanelCard>
          )}

          {/* BAHASA */}
          {tab === "bahasa" && (
            <PanelCard title={tr("Bahasa")} subtitle={tr("Bahasa yang Anda kuasai beserta tingkat kemahirannya")}>
              <div className="space-y-3">
                {data.languages.length === 0 && <EmptyHint>{tr("Belum ada bahasa. Tambahkan minimal satu.")}</EmptyHint>}
                {data.languages.map((l, i) => (
                  <div key={l.id} className="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                    <Input value={l.name} onChange={(e) => langOps.update(l.id, { name: e.target.value })} placeholder={tr("Bahasa Indonesia")} className="flex-1 min-w-[140px] py-2" />
                    <Select value={l.level} onChange={(e) => langOps.update(l.id, { level: e.target.value })} className="w-36 py-2">
                      {[tr("Dasar"), tr("Menengah"), tr("Mahir"), tr("Native")].map((lv) => <option key={lv} value={lv}>{lv}</option>)}
                    </Select>
                    <ItemTools ops={langOps} id={l.id} index={i} count={data.languages.length} noun="bahasa" />
                  </div>
                ))}
                <Btn onClick={langOps.add} variant="secondary" className="w-full gap-2 text-sm"><Plus className="w-4 h-4" /> {tr("Tambah Bahasa")}</Btn>
              </div>
              {next}
            </PanelCard>
          )}

          {/* PENGALAMAN */}
          {tab === "pengalaman" && (
            <PanelCard title={tr("Pengalaman Kerja")} subtitle={tr("Urutkan dari yang paling baru. Satu baris deskripsi = satu poin bullet")}>
              <div className="space-y-4">
                {data.experience.length === 0 && <EmptyHint>{tr("Belum ada pengalaman kerja.")}</EmptyHint>}
                {data.experience.map((exp, i) => (
                  <div key={exp.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{tr("Pengalaman #{0}", i + 1)}</p>
                      <ItemTools ops={expOps} id={exp.id} index={i} count={data.experience.length} noun="pengalaman" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input label={tr("Jabatan")} value={exp.role} onChange={(e) => expOps.update(exp.id, { role: e.target.value })} />
                      <Input label={tr("Perusahaan")} value={exp.company} onChange={(e) => expOps.update(exp.id, { company: e.target.value })} />
                      <Input label={tr("Lokasi")} value={exp.location} onChange={(e) => expOps.update(exp.id, { location: e.target.value })} placeholder={tr("Kota (opsional)")} />
                      <Input label={tr("Periode")} value={exp.period} onChange={(e) => expOps.update(exp.id, { period: e.target.value })} placeholder={tr("Jan 2022 — Sekarang")} />
                    </div>
                    <Textarea label={tr("Deskripsi / Pencapaian (satu baris = satu bullet)")} rows={4} value={exp.description} onChange={(e) => expOps.update(exp.id, { description: e.target.value })} placeholder={tr("Memimpin tim beranggotakan 5 orang…\nMeningkatkan efisiensi proses sebesar 20%…")} />
                  </div>
                ))}
                <Btn onClick={expOps.add} variant="secondary" className="w-full gap-2 text-sm"><Plus className="w-4 h-4" /> {tr("Tambah Pengalaman")}</Btn>
              </div>
              {next}
            </PanelCard>
          )}

          {/* PENDIDIKAN */}
          {tab === "pendidikan" && (
            <PanelCard title={tr("Pendidikan")} subtitle={tr("Riwayat pendidikan formal Anda")}>
              <div className="space-y-4">
                {data.education.length === 0 && <EmptyHint>{tr("Belum ada riwayat pendidikan.")}</EmptyHint>}
                {data.education.map((edu, i) => (
                  <div key={edu.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{tr("Pendidikan #{0}", i + 1)}</p>
                      <ItemTools ops={eduOps} id={edu.id} index={i} count={data.education.length} noun="pendidikan" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input label={tr("Jenjang & Jurusan")} value={edu.degree} onChange={(e) => eduOps.update(edu.id, { degree: e.target.value })} placeholder={tr("S1 Teknik Informatika")} />
                      <Input label={tr("Institusi")} value={edu.school} onChange={(e) => eduOps.update(edu.id, { school: e.target.value })} />
                      <Input label={tr("Periode")} value={edu.period} onChange={(e) => eduOps.update(edu.id, { period: e.target.value })} placeholder="2018 — 2022" />
                    </div>
                    <Textarea label={tr("Keterangan (opsional)")} rows={2} value={edu.description} onChange={(e) => eduOps.update(edu.id, { description: e.target.value })} placeholder={tr("IPK, prestasi akademik, organisasi kampus, dsb.")} />
                  </div>
                ))}
                <Btn onClick={eduOps.add} variant="secondary" className="w-full gap-2 text-sm"><Plus className="w-4 h-4" /> {tr("Tambah Pendidikan")}</Btn>
              </div>
              {next}
            </PanelCard>
          )}

          {/* PROYEK */}
          {tab === "proyek" && (
            <PanelCard title={tr("Proyek")} subtitle={tr("Proyek pribadi/kerja yang menonjolkan kemampuan Anda (opsional)")}>
              <div className="space-y-4">
                {data.projects.length === 0 && <EmptyHint>{tr("Belum ada proyek. Bagian ini opsional.")}</EmptyHint>}
                {data.projects.map((p, i) => (
                  <div key={p.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{tr("Proyek #{0}", i + 1)}</p>
                      <ItemTools ops={projOps} id={p.id} index={i} count={data.projects.length} noun="proyek" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input label={tr("Nama Proyek")} value={p.name} onChange={(e) => projOps.update(p.id, { name: e.target.value })} />
                      <Input label={tr("Periode")} value={p.period} onChange={(e) => projOps.update(p.id, { period: e.target.value })} placeholder="2023" />
                      <Input label={tr("Peran / Teknologi")} value={p.role} onChange={(e) => projOps.update(p.id, { role: e.target.value })} placeholder={tr("Ketua tim · React, Node.js")} />
                      <Input label={tr("Tautan (opsional)")} value={p.link} onChange={(e) => projOps.update(p.id, { link: e.target.value })} placeholder="github.com/nama/proyek" />
                    </div>
                    <Textarea label={tr("Deskripsi (satu baris = satu bullet)")} rows={3} value={p.description} onChange={(e) => projOps.update(p.id, { description: e.target.value })} />
                  </div>
                ))}
                <Btn onClick={projOps.add} variant="secondary" className="w-full gap-2 text-sm"><Plus className="w-4 h-4" /> {tr("Tambah Proyek")}</Btn>
              </div>
              {next}
            </PanelCard>
          )}

          {/* SERTIFIKASI */}
          {tab === "sertifikasi" && (
            <PanelCard title={tr("Sertifikasi")} subtitle={tr("Sertifikat profesional atau pelatihan yang relevan")}>
              <div className="space-y-3">
                {data.certifications.length === 0 && <EmptyHint>{tr("Belum ada sertifikasi. Bagian ini opsional.")}</EmptyHint>}
                {data.certifications.map((c, i) => (
                  <div key={c.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 space-y-2">
                    <div className="grid sm:grid-cols-[1fr_1fr_100px] gap-2">
                      <Input label={tr("Nama Sertifikat")} value={c.name} onChange={(e) => certOps.update(c.id, { name: e.target.value })} className="py-2" />
                      <Input label={tr("Penerbit")} value={c.issuer} onChange={(e) => certOps.update(c.id, { issuer: e.target.value })} className="py-2" />
                      <Input label={tr("Tahun")} value={c.year} onChange={(e) => certOps.update(c.id, { year: e.target.value })} placeholder="2024" className="py-2" />
                    </div>
                    <div className="flex justify-end"><ItemTools ops={certOps} id={c.id} index={i} count={data.certifications.length} noun="sertifikasi" /></div>
                  </div>
                ))}
                <Btn onClick={certOps.add} variant="secondary" className="w-full gap-2 text-sm"><Plus className="w-4 h-4" /> {tr("Tambah Sertifikasi")}</Btn>
              </div>
              {next}
            </PanelCard>
          )}

          {/* ORGANISASI */}
          {tab === "organisasi" && (
            <PanelCard title={tr("Organisasi & Penghargaan")} subtitle={tr("Pengalaman organisasi, kepanitiaan, atau penghargaan yang relevan")}>
              <div className="space-y-4">
                {data.achievements.length === 0 && <EmptyHint>{tr("Belum ada organisasi/penghargaan. Bagian ini opsional.")}</EmptyHint>}
                {data.achievements.map((a, i) => (
                  <div key={a.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{tr("Item #{0}", i + 1)}</p>
                      <ItemTools ops={achOps} id={a.id} index={i} count={data.achievements.length} noun="item" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <Input label={tr("Judul / Peran")} value={a.title} onChange={(e) => achOps.update(a.id, { title: e.target.value })} />
                      <Input label={tr("Organisasi")} value={a.org} onChange={(e) => achOps.update(a.id, { org: e.target.value })} />
                      <Input label={tr("Periode")} value={a.period} onChange={(e) => achOps.update(a.id, { period: e.target.value })} placeholder="2021 — 2022" className="sm:col-span-2" />
                    </div>
                    <Textarea label={tr("Deskripsi (opsional)")} rows={2} value={a.description} onChange={(e) => achOps.update(a.id, { description: e.target.value })} />
                  </div>
                ))}
                <Btn onClick={achOps.add} variant="secondary" className="w-full gap-2 text-sm"><Plus className="w-4 h-4" /> {tr("Tambah Organisasi/Penghargaan")}</Btn>
              </div>
              {next}
            </PanelCard>
          )}

          {/* LAINNYA */}
          {tab === "lainnya" && (
            <div className="space-y-4">
              <PanelCard title={tr("Minat & Hobi")} subtitle={tr("Pisahkan dengan koma atau baris baru")}>
                <Textarea rows={3} value={data.interests} onChange={(e) => patch({ interests: e.target.value })} placeholder={tr("Fotografi, Mendaki gunung, Menulis blog")} />
              </PanelCard>
              <PanelCard title={tr("Referensi")} subtitle={tr("Orang yang bisa dihubungi perekrut (opsional)")}>
                <div className="space-y-3">
                  {data.references.length === 0 && <EmptyHint>{tr("Belum ada referensi.")}</EmptyHint>}
                  {data.references.map((r, i) => (
                    <div key={r.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 space-y-2">
                      <div className="grid sm:grid-cols-3 gap-2">
                        <Input label={tr("Nama")} value={r.name} onChange={(e) => refOps.update(r.id, { name: e.target.value })} className="py-2" />
                        <Input label={tr("Jabatan & Perusahaan")} value={r.position} onChange={(e) => refOps.update(r.id, { position: e.target.value })} className="py-2" />
                        <Input label={tr("Kontak")} value={r.contact} onChange={(e) => refOps.update(r.id, { contact: e.target.value })} className="py-2" />
                      </div>
                      <div className="flex justify-end"><ItemTools ops={refOps} id={r.id} index={i} count={data.references.length} noun="referensi" /></div>
                    </div>
                  ))}
                  <Btn onClick={refOps.add} variant="secondary" className="w-full gap-2 text-sm"><Plus className="w-4 h-4" /> {tr("Tambah Referensi")}</Btn>
                </div>
              </PanelCard>
              <PanelCard title={tr("Bagian Kustom")} subtitle={tr("Bagian bebas dengan judul sendiri (mis. Publikasi, Kegiatan Sosial)")}>
                <Input label={tr("Judul Bagian")} value={data.customTitle} onChange={(e) => patch({ customTitle: e.target.value })} placeholder={tr("Publikasi")} />
                <Textarea label={tr("Isi (satu baris = satu bullet)")} rows={4} value={data.customBody} onChange={(e) => patch({ customBody: e.target.value })} />
              </PanelCard>
              {next}
            </div>
          )}

          {/* EKSPOR & DRAF */}
          {tab === "ekspor" && (
            <PanelCard title={tr("Ekspor & Draf")} subtitle={tr("Kualitas hasil unduhan, simpan/buka draf, dan reset")}>
              <ExportQuality value={exportScale} onChange={setExportScale} baseWidth={1240} baseHeight={1754} />
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs px-3.5 py-2.5 leading-relaxed">
                {tr("PDF memuat")} <b>{tr("lapisan teks tak terlihat")}</b>{tr(": tampilannya identik dengan pratinjau, tetapi teksnya bisa dipilih, disalin, dicari, dan terbaca sistem ATS. Untuk CV yang bisa diedit, unduh")} <b>{tr(".docx")}</b>.
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <Btn onClick={saveJson} variant="secondary" className="gap-2 text-sm"><Save className="w-4 h-4" /> {tr("Simpan Draf (.json)")}</Btn>
                <Btn onClick={() => jsonInput.current?.click()} variant="secondary" className="gap-2 text-sm"><Upload className="w-4 h-4" /> {tr("Buka Draf (.json)")}</Btn>
                <input ref={jsonInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { openJson(e.target.files?.[0] ?? null); e.target.value = ""; }} />
                <Btn onClick={handleBlank} variant="secondary" className="gap-2 text-sm"><Eraser className="w-4 h-4" /> {tr("Mulai dari Kosong")}</Btn>
                <Btn onClick={handleReset} variant="secondary" className="gap-2 text-sm"><RotateCcw className="w-4 h-4" /> {tr("Reset ke Data Contoh")}</Btn>
              </div>
              <p className="text-[11px] text-slate-400"><Type className="w-3 h-3 inline mr-1" />{tr("Draf juga tersimpan otomatis di perangkat ini (localStorage) dan dipulihkan saat Anda membuka halaman lagi.")}</p>
              {next}
            </PanelCard>
          )}
        </div>

        {/* ───────── KANAN: pratinjau + ekspor ───────── */}
        <div id="cv-preview" className="space-y-3 lg:sticky lg:top-20 scroll-mt-20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Pratinjau Langsung")}</p>
            {pageUrls[previewIndex] && (
              <button type="button" onClick={() => setLightbox(true)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
                <Maximize2 className="w-3.5 h-3.5" /> {tr("Perbesar")}
              </button>
            )}
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white flex justify-center">
            {isRendering && (
              <div className="absolute top-2 right-2 z-10 bg-slate-900/80 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> {tr("Memperbarui…")}
              </div>
            )}
            {pageUrls[previewIndex] ? (
              <img src={pageUrls[previewIndex]} alt={tr("Pratinjau CV halaman {0}", previewIndex + 1)} className="block w-auto max-w-full h-auto cursor-zoom-in" style={{ maxHeight: "calc(100dvh - 19rem)", minHeight: 220 }} onClick={() => setLightbox(true)} />
            ) : (
              <div className="aspect-[1240/1754] w-full flex items-center justify-center text-slate-300 dark:text-slate-600"><IdCard className="w-16 h-16" /></div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 min-h-[2.25rem]">
            {pageCount > 1 ? (
              <div className="flex items-center gap-2 mx-auto">
                <button type="button" onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))} disabled={previewIndex === 0} aria-label={tr("Halaman sebelumnya")} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{tr("Halaman {0} / {1}", previewIndex + 1, pageCount)}</span>
                <button type="button" onClick={() => setPreviewIndex((i) => Math.min(pageCount - 1, i + 1))} disabled={previewIndex === pageCount - 1} aria-label={tr("Halaman berikutnya")} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"><ChevronRight className="w-4 h-4" /></button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mx-auto">{pageCount === 1 ? tr("1 halaman · A4") : ""}</p>
            )}
          </div>

          {info && <GamatoInlineAlert message={info.text} tone={info.type === "error" ? "error" : "success"} />}

          <div className="grid grid-cols-2 gap-2.5">
            <Btn onClick={downloadPdf} disabled={isExporting || !pageCount} className="gap-2">
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <IdCard className="w-4 h-4" />} {tr("PDF")}
            </Btn>
            <Btn onClick={downloadDocx} disabled={isExporting || !pageCount} variant="secondary" className="gap-2"><FileText className="w-4 h-4" /> {tr("DOCX")}</Btn>
            <Btn onClick={downloadPng} disabled={isExporting || !pageCount} variant="secondary" className="gap-2"><Download className="w-4 h-4" /> {tr("PNG")}</Btn>
            <Btn onClick={printNow} disabled={isExporting || !pageCount} variant="secondary" className="gap-2"><Printer className="w-4 h-4" /> {tr("Cetak")}</Btn>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">{tr("Kualitas ekspor: {0}× ({1}×{2}px/halaman) — ubah di tab Ekspor & Draf", exportScale, 1240 * exportScale, 1754 * exportScale)}</p>
          <div className="text-center"><SectionBadge>{tr("Diproses langsung di perangkatmu")}</SectionBadge></div>
        </div>
      </div>

      <PreviewJumpFab targetId="cv-preview" />

      {lightbox && pageUrls[previewIndex] && (
        <div className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm overflow-auto p-4 sm:p-8" onClick={() => setLightbox(false)} role="dialog" aria-label={tr("Pratinjau CV diperbesar")}>
          <button type="button" aria-label={tr("Tutup pratinjau")} className="fixed top-4 right-4 z-10 p-2.5 rounded-full bg-white text-slate-700 shadow-lg" onClick={() => setLightbox(false)}><X className="w-5 h-5" /></button>
          <img src={pageUrls[previewIndex]} alt={tr("CV halaman {0}", previewIndex + 1)} className="mx-auto block w-full max-w-[900px] h-auto rounded-lg shadow-2xl bg-white" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};
