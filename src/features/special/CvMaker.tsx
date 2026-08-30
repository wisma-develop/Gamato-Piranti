import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IdCard,
  User,
  AlignLeft,
  Sparkles,
  Languages,
  Briefcase,
  GraduationCap,
  Award,
  Trophy,
  Plus,
  Trash2,
  Download,
  Printer,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { canvasToBlob } from "@/lib/canvas";
import { canvasesToA4PdfBlob } from "@/lib/pdfFromCanvases";
import { printCanvasPages } from "@/lib/printCanvas";
import { renderCvPages } from "@/lib/cvEngine";
import {
  CV_TEMPLATES,
  ACCENT_PRESETS,
  defaultCvData,
  emptySkill,
  emptyLang,
  emptyExp,
  emptyEdu,
  emptyCert,
  emptyAch,
  type CvData,
  type CvTemplateId,
} from "@/lib/cvTypes";
import { Label, Input, Select, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { FontPicker } from "@/components/ui/FontPicker";
import { useCustomFonts } from "@/hooks/useCustomFonts";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { PanelCard } from "@/components/ui/PanelCard";
import { LogoUpload } from "@/components/ui/LogoUpload";
import { useImageFromFile } from "@/hooks/useImageFromFile";
import { useDialog } from "@/hooks/useDialog";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import JSZip from "jszip";

type TabId = "profil" | "ringkasan" | "keahlian" | "bahasa" | "pengalaman" | "pendidikan" | "sertifikasi" | "organisasi";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "profil", label: "Profil & Kontak", icon: <User className="w-3.5 h-3.5" /> },
  { id: "ringkasan", label: "Ringkasan", icon: <AlignLeft className="w-3.5 h-3.5" /> },
  { id: "keahlian", label: "Keahlian", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: "bahasa", label: "Bahasa", icon: <Languages className="w-3.5 h-3.5" /> },
  { id: "pengalaman", label: "Pengalaman", icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: "pendidikan", label: "Pendidikan", icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { id: "sertifikasi", label: "Sertifikasi", icon: <Award className="w-3.5 h-3.5" /> },
  { id: "organisasi", label: "Organisasi", icon: <Trophy className="w-3.5 h-3.5" /> },
];

// Generic CRUD factory for the repeatable list fields (skills, languages,
// experience, education, certifications, achievements). Kept generic so we
// don't hand-roll the same add/remove/update triplet six times.
function useListField<T extends { id: string }>(
  setData: React.Dispatch<React.SetStateAction<CvData>>,
  key: "skills" | "languages" | "experience" | "education" | "certifications" | "achievements",
  factory: () => T
) {
  const add = () =>
    setData((prev) => ({ ...prev, [key]: [...(prev[key] as unknown as T[]), factory()] } as CvData));
  const remove = (id: string) =>
    setData((prev) => ({ ...prev, [key]: (prev[key] as unknown as T[]).filter((item) => item.id !== id) } as CvData));
  const update = (id: string, patch: Partial<T>) =>
    setData(
      (prev) =>
        ({
          ...prev,
          [key]: (prev[key] as unknown as T[]).map((item) => (item.id === id ? { ...item, ...patch } : item)),
        } as CvData)
    );
  return { add, remove, update };
}

const RemoveBtn: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0 transition-colors"
  >
    <Trash2 className="w-4 h-4" />
  </button>
);

const EmptyHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
    {children}
  </p>
);

export const CvMaker: React.FC = () => {
  const dialog = useDialog();
  // Seluruh data CV (profil, ringkasan, keahlian, bahasa, pengalaman,
  // pendidikan, sertifikasi, organisasi, template & warna) punya riwayat
  // Undo/Redo. Setiap perubahan digabung jadi satu langkah setelah jeda
  // singkat, supaya mengetik tidak menghasilkan ratusan langkah undo.
  const cvHistory = useHistoryState<CvData>(() => defaultCvData());
  const data = cvHistory.state;
  const { schedule: scheduleCvCommit } = useDebouncedCommit(cvHistory.commit, 700);
  const setData: React.Dispatch<React.SetStateAction<CvData>> = (updater) => {
    cvHistory.set(updater, { commit: false });
    scheduleCvCommit();
  };
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photoImg = useImageFromFile(photoFile);
  const [tab, setTab] = useState<TabId>("profil");
  const { customFonts, isFontLoading, fontError, addCustomFont, removeCustomFont } = useCustomFonts();
  const handleRemoveCustomFont = (id: string) => {
    removeCustomFont(id, (fallback) => {
      if (data.fontFamily === id) setData((prev) => ({ ...prev, fontFamily: fallback }));
    });
  };

  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [info, setInfo] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const renderSeq = useRef(0);

  const skillOps = useListField(setData, "skills", emptySkill);
  const langOps = useListField(setData, "languages", emptyLang);
  const expOps = useListField(setData, "experience", emptyExp);
  const eduOps = useListField(setData, "education", emptyEdu);
  const certOps = useListField(setData, "certifications", emptyCert);
  const achOps = useListField(setData, "achievements", emptyAch);

  const activeTemplate = useMemo(() => CV_TEMPLATES.find((t) => t.id === data.templateId) ?? CV_TEMPLATES[0], [data.templateId]);

  // Debounced multi-page render — a full CV can span several A4 canvases,
  // so we avoid re-rendering on every single keystroke.
  useEffect(() => {
    const seq = ++renderSeq.current;
    setIsRendering(true);
    const timer = setTimeout(async () => {
      try {
        const result = await renderCvPages(data, photoImg);
        if (renderSeq.current !== seq) return; // a newer render started; discard this one
        setPages(result);
        setPreviewIndex((prev) => Math.min(prev, result.length - 1));
      } catch (err: any) {
        if (renderSeq.current !== seq) return;
        setInfo({ type: "error", text: err?.message || "Gagal membuat pratinjau CV. Coba periksa kembali data yang diisi." });
      } finally {
        if (renderSeq.current === seq) setIsRendering(false);
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [data, photoImg]);

  const selectTemplate = (id: CvTemplateId) => {
    const tpl = CV_TEMPLATES.find((t) => t.id === id);
    setData((prev) => ({ ...prev, templateId: id, accentColor: tpl?.accentDefault ?? prev.accentColor }));
  };

  const patch = (fields: Partial<CvData>) => setData((prev) => ({ ...prev, ...fields }));

  const handleReset = async () => {
    const ok = await dialog.confirm({
      title: "Reset ke Data Contoh?",
      message: "Semua isian CV Anda saat ini (profil, pengalaman, pendidikan, dan lainnya) akan diganti dengan data contoh. Tindakan ini tidak bisa dibatalkan.",
      confirmLabel: "Ya, Reset",
      cancelLabel: "Batal",
      danger: true,
    });
    if (!ok) return;
    cvHistory.reset(defaultCvData());
    setPhotoFile(null);
    setInfo({ type: "success", text: "CV dikembalikan ke data contoh." });
  };

  const baseFileName = () => sanitizeFileName(data.fullName ? `CV - ${data.fullName}` : "CV Gamato Piranti") || "cv";

  const downloadPdf = async () => {
    if (!pages.length) return;
    setInfo(null);
    setIsExporting(true);
    try {
      const blob = await canvasesToA4PdfBlob(pages, data.fullName || "CV");
      downloadBlob(blob, `${baseFileName()}.pdf`);
      setInfo({ type: "success", text: `CV berhasil diunduh sebagai PDF (${pages.length} halaman).` });
    } catch (err: any) {
      setInfo({ type: "error", text: err?.message || "Gagal membuat PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const downloadPng = async () => {
    if (!pages.length) return;
    setInfo(null);
    setIsExporting(true);
    try {
      const base = baseFileName();
      if (pages.length === 1) {
        const blob = await canvasToBlob(pages[0]);
        downloadBlob(blob, `${base}.png`);
      } else {
        const zip = new JSZip();
        for (let i = 0; i < pages.length; i++) {
          const blob = await canvasToBlob(pages[i]);
          zip.file(`${base}-hal-${String(i + 1).padStart(2, "0")}.png`, blob);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${base}-png.zip`);
      }
      setInfo({ type: "success", text: `CV berhasil diunduh sebagai PNG (${pages.length} halaman).` });
    } catch (err: any) {
      setInfo({ type: "error", text: err?.message || "Gagal membuat PNG." });
    } finally {
      setIsExporting(false);
    }
  };

  const printNow = async () => {
    if (!pages.length) return;
    setInfo(null);
    try {
      printCanvasPages(pages, { title: `CV — ${data.fullName || "Gamato Piranti"}` });
    } catch (err: any) {
      await dialog.alert({ title: "Gagal Mencetak", message: err?.message || "Gagal membuka dialog cetak.", tone: "danger" });
    }
  };

  return (
    <div className="space-y-6">
      <GamatoDesktopRecommended toolName="Pembuat CV" />
      <div className="grid lg:grid-cols-[1fr_420px] gap-6 items-start">
      {/* LEFT: form */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor CV</span>
          <UndoRedoBar canUndo={cvHistory.canUndo} canRedo={cvHistory.canRedo} onUndo={cvHistory.undo} onRedo={cvHistory.redo} />
        </div>

        {/* Template picker */}
        <PanelCard title="Pilih Template" subtitle="Semua template mendukung banyak halaman otomatis jika isi CV Anda panjang">
          <div className="grid sm:grid-cols-2 gap-3">
            {CV_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => selectTemplate(tpl.id)}
                className={cn(
                  "text-left rounded-xl border-2 p-4 transition-all relative overflow-hidden",
                  data.templateId === tpl.id
                    ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                {data.templateId === tpl.id && (
                  <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 absolute top-3 right-3" />
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: tpl.accentDefault }} />
                  <p className="font-bold text-sm text-slate-900 dark:text-white pr-6">{tpl.name}</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pr-4">{tpl.desc}</p>
                {tpl.atsFriendly && (
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    Ramah ATS
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="pt-1">
            <Label>Warna Aksen</Label>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => patch({ accentColor: c })}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "w-8 h-8 rounded-lg border-2 transition-transform",
                    data.accentColor === c ? "border-slate-900 dark:border-white scale-110" : "border-transparent"
                  )}
                  title={c}
                />
              ))}
              <GamatoColorPicker value={data.accentColor} onChange={(hex) => patch({ accentColor: hex })} />
            </div>
          </div>

          {activeTemplate.usesPhoto ? (
            <LogoUpload file={photoFile} onChange={setPhotoFile} label="Foto Profil (opsional)" hint="Foto persegi menghasilkan potongan lingkaran paling rapi" />
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
              Template "{activeTemplate.name}" tidak menampilkan foto (didesain ramah sistem ATS).
            </p>
          )}
        </PanelCard>

        {/* Section tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
                tab === t.id
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Profil & Kontak */}
        {tab === "profil" && (
          <PanelCard title="Profil & Kontak" subtitle="Informasi utama yang tampil di bagian atas CV">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Nama Lengkap" value={data.fullName} onChange={(e) => patch({ fullName: e.target.value })} />
              <Input label="Posisi / Profesi yang Dituju" value={data.jobTitle} onChange={(e) => patch({ jobTitle: e.target.value })} />
              <Input label="Email" type="email" value={data.email} onChange={(e) => patch({ email: e.target.value })} />
              <Input label="Telepon" value={data.phone} onChange={(e) => patch({ phone: e.target.value })} />
              <Input label="Alamat / Kota" value={data.address} onChange={(e) => patch({ address: e.target.value })} />
              <Input label="Website / LinkedIn" value={data.website} onChange={(e) => patch({ website: e.target.value })} />
            </div>
            <div className="mt-4">
              <FontPicker
                value={data.fontFamily}
                onChange={(family) => patch({ fontFamily: family })}
                customFonts={customFonts}
                isFontLoading={isFontLoading}
                fontError={fontError}
                onUpload={addCustomFont}
                onRemoveCustomFont={handleRemoveCustomFont}
              />
            </div>
          </PanelCard>
        )}

        {/* Ringkasan */}
        {tab === "ringkasan" && (
          <PanelCard title="Ringkasan Profil" subtitle="2-4 kalimat yang menonjolkan nilai jual Anda ke perekrut">
            <Textarea rows={6} value={data.summary} onChange={(e) => patch({ summary: e.target.value })} placeholder="Tulis ringkasan singkat tentang diri Anda…" />
          </PanelCard>
        )}

        {/* Keahlian */}
        {tab === "keahlian" && (
          <PanelCard title="Keahlian" subtitle="Tingkat kemahiran hanya tampil pada template bersidebar; template lain menampilkannya sebagai daftar">
            <div className="space-y-3">
              {data.skills.length === 0 && <EmptyHint>Belum ada keahlian. Tambahkan minimal satu.</EmptyHint>}
              {data.skills.map((s) => (
                <div key={s.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  <div className="flex-1 space-y-2">
                    <Input value={s.name} onChange={(e) => skillOps.update(s.id, { name: e.target.value })} placeholder="Nama keahlian, mis. Manajemen Proyek" className="py-2" />
                    <div className="flex items-center gap-3">
                      <GamatoSlider
                        min={10}
                        max={100}
                        step={5}
                        value={s.level}
                        onChange={(v) => skillOps.update(s.id, { level: v })}
                        className="flex-1"
                        aria-label="Level keahlian"
                      />
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 w-10 text-right">{s.level}%</span>
                    </div>
                  </div>
                  <RemoveBtn onClick={() => skillOps.remove(s.id)} label="Hapus keahlian" />
                </div>
              ))}
              <Btn onClick={skillOps.add} variant="secondary" className="w-full gap-2 text-sm">
                <Plus className="w-4 h-4" /> Tambah Keahlian
              </Btn>
            </div>
          </PanelCard>
        )}

        {/* Bahasa */}
        {tab === "bahasa" && (
          <PanelCard title="Bahasa" subtitle="Bahasa yang Anda kuasai beserta tingkat kemahirannya">
            <div className="space-y-3">
              {data.languages.length === 0 && <EmptyHint>Belum ada bahasa. Tambahkan minimal satu.</EmptyHint>}
              {data.languages.map((l) => (
                <div key={l.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  <Input value={l.name} onChange={(e) => langOps.update(l.id, { name: e.target.value })} placeholder="Bahasa Indonesia" className="flex-1 py-2" />
                  <Select
                    value={l.level}
                    onChange={(e) => langOps.update(l.id, { level: e.target.value })}
                    className="w-40 py-2"
                  >
                    {["Dasar", "Menengah", "Mahir", "Native"].map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </Select>
                  <RemoveBtn onClick={() => langOps.remove(l.id)} label="Hapus bahasa" />
                </div>
              ))}
              <Btn onClick={langOps.add} variant="secondary" className="w-full gap-2 text-sm">
                <Plus className="w-4 h-4" /> Tambah Bahasa
              </Btn>
            </div>
          </PanelCard>
        )}

        {/* Pengalaman */}
        {tab === "pengalaman" && (
          <PanelCard title="Pengalaman Kerja" subtitle="Urutkan dari yang paling baru. Satu baris deskripsi = satu poin bullet">
            <div className="space-y-4">
              {data.experience.length === 0 && <EmptyHint>Belum ada pengalaman kerja.</EmptyHint>}
              {data.experience.map((exp, idx) => (
                <div key={exp.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Pengalaman #{idx + 1}</p>
                    <RemoveBtn onClick={() => expOps.remove(exp.id)} label="Hapus pengalaman" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input label="Jabatan" value={exp.role} onChange={(e) => expOps.update(exp.id, { role: e.target.value })} />
                    <Input label="Perusahaan" value={exp.company} onChange={(e) => expOps.update(exp.id, { company: e.target.value })} />
                    <Input label="Lokasi" value={exp.location} onChange={(e) => expOps.update(exp.id, { location: e.target.value })} placeholder="Kota (opsional)" />
                    <Input label="Periode" value={exp.period} onChange={(e) => expOps.update(exp.id, { period: e.target.value })} placeholder="Jan 2022 — Sekarang" />
                  </div>
                  <Textarea
                    label="Deskripsi / Pencapaian (satu baris = satu bullet)"
                    rows={4}
                    value={exp.description}
                    onChange={(e) => expOps.update(exp.id, { description: e.target.value })}
                    placeholder={"Memimpin tim beranggotakan 5 orang…\nMeningkatkan efisiensi proses sebesar 20%…"}
                  />
                </div>
              ))}
              <Btn onClick={expOps.add} variant="secondary" className="w-full gap-2 text-sm">
                <Plus className="w-4 h-4" /> Tambah Pengalaman
              </Btn>
            </div>
          </PanelCard>
        )}

        {/* Pendidikan */}
        {tab === "pendidikan" && (
          <PanelCard title="Pendidikan" subtitle="Riwayat pendidikan formal Anda">
            <div className="space-y-4">
              {data.education.length === 0 && <EmptyHint>Belum ada riwayat pendidikan.</EmptyHint>}
              {data.education.map((edu, idx) => (
                <div key={edu.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Pendidikan #{idx + 1}</p>
                    <RemoveBtn onClick={() => eduOps.remove(edu.id)} label="Hapus pendidikan" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input label="Jenjang & Jurusan" value={edu.degree} onChange={(e) => eduOps.update(edu.id, { degree: e.target.value })} placeholder="S1 Teknik Informatika" />
                    <Input label="Institusi" value={edu.school} onChange={(e) => eduOps.update(edu.id, { school: e.target.value })} />
                    <Input label="Periode" value={edu.period} onChange={(e) => eduOps.update(edu.id, { period: e.target.value })} placeholder="2018 — 2022" />
                  </div>
                  <Textarea
                    label="Keterangan (opsional)"
                    rows={2}
                    value={edu.description}
                    onChange={(e) => eduOps.update(edu.id, { description: e.target.value })}
                    placeholder="IPK, prestasi akademik, organisasi kampus, dsb."
                  />
                </div>
              ))}
              <Btn onClick={eduOps.add} variant="secondary" className="w-full gap-2 text-sm">
                <Plus className="w-4 h-4" /> Tambah Pendidikan
              </Btn>
            </div>
          </PanelCard>
        )}

        {/* Sertifikasi */}
        {tab === "sertifikasi" && (
          <PanelCard title="Sertifikasi" subtitle="Sertifikat profesional atau pelatihan yang relevan">
            <div className="space-y-3">
              {data.certifications.length === 0 && <EmptyHint>Belum ada sertifikasi. Bagian ini opsional.</EmptyHint>}
              {data.certifications.map((c) => (
                <div key={c.id} className="grid sm:grid-cols-[1fr_1fr_110px_auto] gap-2 items-end bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                  <Input label="Nama Sertifikat" value={c.name} onChange={(e) => certOps.update(c.id, { name: e.target.value })} className="py-2" />
                  <Input label="Penerbit" value={c.issuer} onChange={(e) => certOps.update(c.id, { issuer: e.target.value })} className="py-2" />
                  <Input label="Tahun" value={c.year} onChange={(e) => certOps.update(c.id, { year: e.target.value })} placeholder="2024" className="py-2" />
                  <RemoveBtn onClick={() => certOps.remove(c.id)} label="Hapus sertifikasi" />
                </div>
              ))}
              <Btn onClick={certOps.add} variant="secondary" className="w-full gap-2 text-sm">
                <Plus className="w-4 h-4" /> Tambah Sertifikasi
              </Btn>
            </div>
          </PanelCard>
        )}

        {/* Organisasi & Penghargaan */}
        {tab === "organisasi" && (
          <PanelCard title="Organisasi & Penghargaan" subtitle="Pengalaman organisasi, kepanitiaan, atau penghargaan yang relevan">
            <div className="space-y-4">
              {data.achievements.length === 0 && <EmptyHint>Belum ada organisasi/penghargaan. Bagian ini opsional.</EmptyHint>}
              {data.achievements.map((a, idx) => (
                <div key={a.id} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Item #{idx + 1}</p>
                    <RemoveBtn onClick={() => achOps.remove(a.id)} label="Hapus item" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input label="Judul / Peran" value={a.title} onChange={(e) => achOps.update(a.id, { title: e.target.value })} />
                    <Input label="Organisasi" value={a.org} onChange={(e) => achOps.update(a.id, { org: e.target.value })} />
                    <Input label="Periode" value={a.period} onChange={(e) => achOps.update(a.id, { period: e.target.value })} placeholder="2021 — 2022" className="sm:col-span-2" />
                  </div>
                  <Textarea
                    label="Deskripsi (opsional)"
                    rows={2}
                    value={a.description}
                    onChange={(e) => achOps.update(a.id, { description: e.target.value })}
                  />
                </div>
              ))}
              <Btn onClick={achOps.add} variant="secondary" className="w-full gap-2 text-sm">
                <Plus className="w-4 h-4" /> Tambah Organisasi/Penghargaan
              </Btn>
            </div>
          </PanelCard>
        )}

        <Btn onClick={handleReset} variant="ghost" className="gap-2 text-sm">
          <RotateCcw className="w-4 h-4" /> Reset ke Data Contoh
        </Btn>
      </div>

      {/* RIGHT: live preview + export */}
      <div className="space-y-4 lg:sticky lg:top-24">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Pratinjau Langsung</p>

        <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white">
          {isRendering && (
            <div className="absolute top-2 right-2 z-10 bg-slate-900/80 text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Memperbarui…
            </div>
          )}
          {pages[previewIndex] ? (
            <img src={pages[previewIndex].toDataURL("image/png")} alt={`Pratinjau CV halaman ${previewIndex + 1}`} className="w-full h-auto block" />
          ) : (
            <div className="aspect-[1240/1754] flex items-center justify-center text-slate-300 dark:text-slate-600">
              <IdCard className="w-16 h-16" />
            </div>
          )}
        </div>

        {pages.length > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
              disabled={previewIndex === 0}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Halaman {previewIndex + 1} / {pages.length}
            </span>
            <button
              type="button"
              onClick={() => setPreviewIndex((i) => Math.min(pages.length - 1, i + 1))}
              disabled={previewIndex === pages.length - 1}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {info && <GamatoInlineAlert message={info.text} tone={info.type === "error" ? "error" : "success"} />}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Btn onClick={downloadPng} disabled={isExporting || !pages.length} variant="secondary" className="gap-2">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            PNG
          </Btn>
          <Btn onClick={downloadPdf} disabled={isExporting || !pages.length} className="gap-2">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <IdCard className="w-4 h-4" />}
            PDF
          </Btn>
          <Btn onClick={printNow} disabled={!pages.length} variant="secondary" className="gap-2">
            <Printer className="w-4 h-4" />
            Cetak
          </Btn>
        </div>

        <div className="text-center">
          <SectionBadge>Diproses langsung di perangkatmu</SectionBadge>
        </div>
      </div>
    </div>
    </div>
  );
};
