import React, { useEffect, useMemo, useRef, useState } from "react";
import { SlidersHorizontal, Image as ImageIcon, RotateCw, Loader2, Download, RefreshCw, Sparkles, Palette, Film, Check, Eye } from "lucide-react";
import { downloadBlob } from "@/lib/file";
import { loadImageFromUrl, canvasToBlob } from "@/lib/canvas";
import { Btn, Label, Select } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { Dropzone } from "@/components/ui/Dropzone";
import { PanelCard } from "@/components/ui/PanelCard";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { SettingsTabBar, NextTabHint, type SettingsTabDef } from "@/components/ui/SettingsTabs";
import { cn } from "@/utils/cn";
import {
  PHOTO_ADJUSTMENT_DEFAULTS,
  buildCssFilter,
  createGrainTile,
  drawPhotoAdjustments,
  scalePresetValues,
  type PhotoAdjustmentValues,
} from "@/lib/photoEditorEngine";
import { PHOTO_PRESETS, PHOTO_PRESET_CATEGORIES, getPresetById, type PhotoPreset } from "@/lib/photoPresets";

type PhotoAdjustments = PhotoAdjustmentValues & { rotateDeg: number; flipH: boolean; flipV: boolean; outputFormat: "png" | "jpeg" };

const DEFAULT_ADJUSTMENTS: PhotoAdjustments = { ...PHOTO_ADJUSTMENT_DEFAULTS, rotateDeg: 0, flipH: false, flipV: false, outputFormat: "png" };

// Live preview is rendered at a capped resolution so slider drags & preset
// taps stay snappy ("satset") even on huge photos — export always re-renders
// the full pipeline at the original resolution, so quality is never reduced.
const PREVIEW_MAX_DIM = 1400;
const THUMB_WIDTH = 240;

type TabId = "preset" | "dasar" | "warna" | "efek" | "putar";

const TABS: SettingsTabDef<TabId>[] = [
  { id: "preset", label: "Preset Look", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: "dasar", label: "Penyesuaian Dasar", icon: <SlidersHorizontal className="w-3.5 h-3.5" /> },
  { id: "warna", label: "Warna & Mood", icon: <Palette className="w-3.5 h-3.5" /> },
  { id: "efek", label: "Efek Gaya", icon: <Film className="w-3.5 h-3.5" /> },
  { id: "putar", label: "Putar & Ekspor", icon: <RotateCw className="w-3.5 h-3.5" /> },
];

export const PhotoEditor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const grainTileRef = useRef<HTMLCanvasElement | null>(null);
  if (!grainTileRef.current) grainTileRef.current = createGrainTile();

  // Semua slider penyesuaian, preset, rotasi/flip, dan format output punya
  // riwayat Undo/Redo (digabung jadi satu langkah setelah jeda singkat).
  const adjHistory = useHistoryState<PhotoAdjustments>(() => DEFAULT_ADJUSTMENTS);
  const adjustments = adjHistory.state;
  const { schedule: scheduleAdjCommit } = useDebouncedCommit(adjHistory.commit, 500);

  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetIntensity, setPresetIntensity] = useState(100);
  const [presetCategory, setPresetCategory] = useState<string>("Semua");
  const [tab, setTab] = useState<TabId>("preset");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  /** Sets one grading field directly (used by manual sliders/color pickers). Any manual tweak breaks the "pure preset" link, so the preset highlight/intensity slider clears — same behavior real editing apps use once you touch a slider after applying a preset. */
  function setGradeField<K extends keyof PhotoAdjustmentValues>(key: K, value: PhotoAdjustmentValues[K]) {
    adjHistory.set((prev) => ({ ...prev, [key]: value }), { commit: false });
    scheduleAdjCommit();
    setActivePresetId(null);
  }
  /** Rotate/flip/output-format aren't part of the "look" — changing them keeps whichever preset is active. */
  function setMetaField<K extends "rotateDeg" | "flipH" | "flipV" | "outputFormat">(key: K, value: PhotoAdjustments[K]) {
    adjHistory.set((prev) => ({ ...prev, [key]: value }), { commit: false });
    scheduleAdjCommit();
  }

  const { rotateDeg, flipH, flipV, outputFormat } = adjustments;
  const setRotateDeg = (updater: number | ((prev: number) => number)) =>
    setMetaField("rotateDeg", typeof updater === "function" ? (updater as (p: number) => number)(rotateDeg) : updater);
  const setFlipH = (updater: boolean | ((prev: boolean) => boolean)) =>
    setMetaField("flipH", typeof updater === "function" ? (updater as (p: boolean) => boolean)(flipH) : updater);
  const setFlipV = (updater: boolean | ((prev: boolean) => boolean)) =>
    setMetaField("flipV", typeof updater === "function" ? (updater as (p: boolean) => boolean)(flipV) : updater);
  const setOutputFormat = (v: "png" | "jpeg") => setMetaField("outputFormat", v);

  const addFiles = async (incoming: File[]) => {
    const f = incoming.find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = URL.createObjectURL(f);
    const image = await loadImageFromUrl(url);
    URL.revokeObjectURL(url);
    setFile(f);
    setImg(image);
    adjHistory.reset(DEFAULT_ADJUSTMENTS); // gambar baru = mulai riwayat baru
    setActivePresetId(null);
    setPresetIntensity(100);
    setTab("preset");
    setInfo(null);

    // Thumbnail ringan untuk preview preset — dibuat sekali per gambar, jauh
    // lebih murah daripada me-render ulang seluruh pipeline untuk tiap kartu preset.
    const tc = document.createElement("canvas");
    const scale = THUMB_WIDTH / image.naturalWidth;
    tc.width = THUMB_WIDTH;
    tc.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const tctx = tc.getContext("2d");
    if (tctx) {
      tctx.drawImage(image, 0, 0, tc.width, tc.height);
      setThumbUrl(tc.toDataURL("image/jpeg", 0.72));
    }
  };

  const resetAdjustments = () => {
    adjHistory.set((prev) => ({ ...DEFAULT_ADJUSTMENTS, rotateDeg: prev.rotateDeg, outputFormat: prev.outputFormat }));
    setActivePresetId(null);
    setPresetIntensity(100);
  };

  const applyPreset = (preset: PhotoPreset) => {
    const scaled = scalePresetValues(preset.values, 100);
    adjHistory.set((prev) => ({ ...prev, ...PHOTO_ADJUSTMENT_DEFAULTS, ...scaled }));
    setActivePresetId(preset.id);
    setPresetIntensity(100);
    setInfo(null);
  };

  const changeIntensity = (pct: number) => {
    setPresetIntensity(pct);
    const preset = activePresetId ? getPresetById(activePresetId) : undefined;
    if (!preset) return;
    const scaled = scalePresetValues(preset.values, pct);
    adjHistory.set((prev) => ({ ...prev, ...PHOTO_ADJUSTMENT_DEFAULTS, ...scaled }), { commit: false });
    scheduleAdjCommit();
  };

  const clearPreset = () => {
    adjHistory.set((prev) => ({ ...prev, ...PHOTO_ADJUSTMENT_DEFAULTS }));
    setActivePresetId(null);
    setPresetIntensity(100);
  };

  const filteredPresets = useMemo(
    () => (presetCategory === "Semua" ? PHOTO_PRESETS : PHOTO_PRESETS.filter((p) => p.category === presetCategory)),
    [presetCategory]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    drawPhotoAdjustments(canvas, img, adjustments, { rotateDeg: adjustments.rotateDeg, flipH: adjustments.flipH, flipV: adjustments.flipV }, grainTileRef.current, PREVIEW_MAX_DIM);
  }, [img, adjustments]);

  // "Tahan: Lihat Asli" — reuses the same engine with neutral adjustment
  // values (same rotate/flip so the crop/orientation still matches) instead
  // of pointing an <img> at the original blob URL, which gets revoked right
  // after the initial decode and would otherwise render blank.
  useEffect(() => {
    if (!showOriginal) return;
    const canvas = originalCanvasRef.current;
    if (!canvas || !img) return;
    drawPhotoAdjustments(
      canvas,
      img,
      PHOTO_ADJUSTMENT_DEFAULTS as PhotoAdjustmentValues,
      { rotateDeg: adjustments.rotateDeg, flipH: adjustments.flipH, flipV: adjustments.flipV },
      null,
      PREVIEW_MAX_DIM
    );
  }, [img, showOriginal, adjustments.rotateDeg, adjustments.flipH, adjustments.flipV]);

  const handleDownload = async () => {
    if (!img) return;
    setIsWorking(true);
    try {
      const offscreen = document.createElement("canvas");
      drawPhotoAdjustments(offscreen, img, adjustments, { rotateDeg: adjustments.rotateDeg, flipH: adjustments.flipH, flipV: adjustments.flipV }, grainTileRef.current);
      const mime = outputFormat === "png" ? "image/png" : "image/jpeg";
      const blob = await canvasToBlob(offscreen, mime, mime === "image/jpeg" ? 0.92 : undefined);
      const base = (file?.name || "gambar").replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}-edited.${outputFormat === "png" ? "png" : "jpg"}`);
      setInfo("Gambar hasil edit berhasil diunduh (resolusi penuh).");
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal memproses gambar."));
    } finally {
      setIsWorking(false);
    }
  };

  const basicSliders: { label: string; value: number; setValue: (v: number) => void; min: number; max: number; unit: string }[] = [
    { label: "Kecerahan (Brightness)", value: adjustments.brightness, setValue: (v) => setGradeField("brightness", v), min: 0, max: 200, unit: "%" },
    { label: "Kontras (Contrast)", value: adjustments.contrast, setValue: (v) => setGradeField("contrast", v), min: 0, max: 200, unit: "%" },
    { label: "Saturasi (Saturation)", value: adjustments.saturation, setValue: (v) => setGradeField("saturation", v), min: 0, max: 200, unit: "%" },
    { label: "Hue Rotate", value: adjustments.hue, setValue: (v) => setGradeField("hue", v), min: 0, max: 360, unit: "°" },
    { label: "Blur", value: adjustments.blur, setValue: (v) => setGradeField("blur", v), min: 0, max: 20, unit: "px" },
  ];

  const styleSliders: { label: string; value: number; setValue: (v: number) => void; min: number; max: number; unit: string }[] = [
    { label: "Vignette", value: adjustments.vignette, setValue: (v) => setGradeField("vignette", v), min: 0, max: 100, unit: "%" },
    { label: "Butiran Film (Grain)", value: adjustments.grain, setValue: (v) => setGradeField("grain", v), min: 0, max: 100, unit: "%" },
    { label: "Fade / Matte", value: adjustments.fade, setValue: (v) => setGradeField("fade", v), min: 0, max: 100, unit: "%" },
    { label: "Hitam-Putih (Grayscale)", value: adjustments.grayscale, setValue: (v) => setGradeField("grayscale", v), min: 0, max: 100, unit: "%" },
    { label: "Sephia", value: adjustments.sepia, setValue: (v) => setGradeField("sepia", v), min: 0, max: 100, unit: "%" },
    { label: "Invert Warna", value: adjustments.invert, setValue: (v) => setGradeField("invert", v), min: 0, max: 100, unit: "%" },
  ];

  const SliderRow: React.FC<{ label: string; value: number; setValue: (v: number) => void; min: number; max: number; unit: string }> = ({ label, value, setValue, min, max, unit }) => (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <Label>{label}</Label>
        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
          {Math.round(value)}
          {unit}
        </span>
      </div>
      <GamatoSlider min={min} max={max} value={value} disabled={!img} onChange={setValue} aria-label={label} />
    </div>
  );

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
      {/* LEFT: upload + tabbed settings */}
      <div className="space-y-5">
        {!img && (
          <Dropzone
            onFiles={addFiles}
            accept="image/*"
            multiple={false}
            label="Drop gambar di sini"
            sublabel="JPG, PNG, WEBP"
            icon={<ImageIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        )}

        {img && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor Foto</span>
              <div className="flex items-center gap-2">
                <UndoRedoBar
                  canUndo={adjHistory.canUndo}
                  canRedo={adjHistory.canRedo}
                  onUndo={() => {
                    adjHistory.undo();
                    setActivePresetId(null);
                  }}
                  onRedo={() => {
                    adjHistory.redo();
                    setActivePresetId(null);
                  }}
                  hideLabel
                />
                <button type="button" onClick={resetAdjustments} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" /> Reset
                </button>
              </div>
            </div>

            <SettingsTabBar tabs={TABS} active={tab} onChange={setTab} />

            {tab === "preset" && (
              <PanelCard title="Preset Look" subtitle="Satu klik, langsung dapat mood foto yang pas — bisa disetel ulang di bawah">
                <div className="flex flex-wrap gap-1.5">
                  {["Semua", ...PHOTO_PRESET_CATEGORIES].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPresetCategory(cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                        presetCategory === cat
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {filteredPresets.map((preset) => {
                    const merged = { ...PHOTO_ADJUSTMENT_DEFAULTS, ...preset.values };
                    const isActive = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        title={preset.desc}
                        className={cn(
                          "relative rounded-xl overflow-hidden border-2 text-left transition-all",
                          isActive ? "border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-500/30" : "border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50"
                        )}
                      >
                        <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
                          {thumbUrl && (
                            <img
                              src={thumbUrl}
                              alt={preset.name}
                              className="w-full h-full object-cover"
                              style={{ filter: buildCssFilter(merged) }}
                              draggable={false}
                            />
                          )}
                          {(merged.vignette ?? 0) > 0 && (
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={{ boxShadow: `inset 0 0 ${Math.round(((merged.vignette ?? 0) / 100) * 34)}px rgba(0,0,0,0.65)` }}
                            />
                          )}
                          {(preset.values.splitTone ?? 0) > 0 && (
                            <div className="absolute bottom-1 right-1 flex gap-0.5">
                              <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/70" style={{ backgroundColor: preset.values.shadowTint }} />
                              <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/70" style={{ backgroundColor: preset.values.highlightTint }} />
                            </div>
                          )}
                          {isActive && (
                            <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">{preset.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{preset.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {activePresetId && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Intensitas Preset</Label>
                      <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{presetIntensity}%</span>
                    </div>
                    <GamatoSlider min={0} max={150} value={presetIntensity} onChange={changeIntensity} aria-label="Intensitas Preset" />
                    <button type="button" onClick={clearPreset} className="text-xs font-semibold text-red-500 hover:text-red-700">
                      Hapus Preset (kembali netral)
                    </button>
                  </div>
                )}
                <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
              </PanelCard>
            )}

            {tab === "dasar" && (
              <PanelCard title="Penyesuaian Dasar" subtitle="Kontrol inti seperti di aplikasi edit foto profesional">
                <div className="space-y-4">
                  {basicSliders.map((s) => (
                    <SliderRow key={s.label} {...s} />
                  ))}
                </div>
                <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
              </PanelCard>
            )}

            {tab === "warna" && (
              <PanelCard title="Warna & Mood" subtitle="Suhu warna, tint, dan split-tone dua warna ala color grading film">
                <div className="space-y-4">
                  <SliderRow label="Suhu Warna (Temperature)" value={adjustments.temperature} setValue={(v) => setGradeField("temperature", v)} min={-100} max={100} unit="" />
                  <SliderRow label="Tint (Hijau ↔ Magenta)" value={adjustments.tint} setValue={(v) => setGradeField("tint", v)} min={-100} max={100} unit="" />
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <SliderRow label="Kekuatan Split-Tone" value={adjustments.splitTone} setValue={(v) => setGradeField("splitTone", v)} min={0} max={100} unit="%" />
                    <div className="grid grid-cols-2 gap-3">
                      <GamatoColorPicker label="Warna Bayangan" value={adjustments.shadowTint} onChange={(hex) => setGradeField("shadowTint", hex)} />
                      <GamatoColorPicker label="Warna Highlight" value={adjustments.highlightTint} onChange={(hex) => setGradeField("highlightTint", hex)} />
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">Naikkan "Kekuatan Split-Tone" dulu supaya kedua warna ini terlihat efeknya.</p>
                  </div>
                </div>
                <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
              </PanelCard>
            )}

            {tab === "efek" && (
              <PanelCard title="Efek Gaya" subtitle="Vignette, butiran film, fade, dan filter klasik">
                <div className="space-y-4">
                  {styleSliders.map((s) => (
                    <SliderRow key={s.label} {...s} />
                  ))}
                </div>
                <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
              </PanelCard>
            )}

            {tab === "putar" && (
              <PanelCard title="Putar, Balik & Ekspor" subtitle="Orientasi gambar dan format file hasil unduhan">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Btn onClick={() => setRotateDeg((d) => (d + 90) % 360)} variant="secondary" className="text-xs gap-1.5">
                      <RotateCw className="w-3.5 h-3.5" /> Putar 90°
                    </Btn>
                    <Btn onClick={() => setFlipH((v) => !v)} variant={flipH ? "primary" : "secondary"} className="text-xs">
                      Balik Horizontal
                    </Btn>
                    <Btn onClick={() => setFlipV((v) => !v)} variant={flipV ? "primary" : "secondary"} className="text-xs">
                      Balik Vertikal
                    </Btn>
                  </div>
                  <Select label="Format Output" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as any)}>
                    <option value="png">PNG</option>
                    <option value="jpeg">JPEG</option>
                  </Select>
                </div>
                <NextTabHint tabs={TABS} active={tab} onChange={setTab} />
              </PanelCard>
            )}
          </>
        )}
      </div>

      {/* RIGHT: live preview + export (sticky, always visible while adjusting) */}
      <div className="space-y-4 lg:sticky lg:top-24">
        {img ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file?.name}</p>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setImg(null);
                  setThumbUrl(null);
                  setActivePresetId(null);
                  setInfo(null);
                }}
                className="text-sm text-red-500 font-semibold hover:text-red-700 shrink-0"
              >
                Ganti File
              </button>
            </div>
            <div className="p-4 flex justify-center bg-slate-100 dark:bg-slate-950 relative">
              <canvas ref={canvasRef} style={showOriginal ? { display: "none" } : undefined} className="max-w-full max-h-[460px] rounded-lg shadow" />
              <canvas ref={originalCanvasRef} style={!showOriginal ? { display: "none" } : undefined} className="max-w-full max-h-[460px] rounded-lg shadow" />
              <button
                type="button"
                onPointerDown={() => setShowOriginal(true)}
                onPointerUp={() => setShowOriginal(false)}
                onPointerLeave={() => setShowOriginal(false)}
                className="absolute bottom-7 right-7 flex items-center gap-1.5 bg-slate-900/80 text-white text-xs font-semibold px-3 py-2 rounded-full backdrop-blur hover:bg-slate-900 select-none"
                title="Tahan untuk lihat foto asli"
              >
                <Eye className="w-3.5 h-3.5" /> Tahan: Lihat Asli
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex items-center justify-center h-64 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-400 dark:text-slate-500 text-center px-6">
            Pratinjau akan tampil di sini setelah kamu mengunggah foto
          </div>
        )}

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={handleDownload} disabled={isWorking || !img} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Unduh Hasil Edit
            </>
          )}
        </Btn>

        <ToolInfoPanel
          icon={<SlidersHorizontal className="w-5 h-5" />}
          label="Photo Editor"
          desc="30+ preset siap pakai + color grading manual"
          points={[
            "Preset Look mengatur warna, suhu, split-tone, vignette, grain & fade sekaligus — bukan cuma satu filter, jadi hasilnya benar-benar terasa beda tiap gaya.",
            "Setelah pilih preset, tarik 'Intensitas Preset' untuk melemahkan/menguatkan efeknya, atau sesuaikan slider di tab lain — perubahan manual otomatis melepas ikatan preset.",
            "Tahan tombol mata di pratinjau untuk membandingkan cepat dengan foto asli.",
            "Pratinjau dirender di resolusi ringkas biar gesit; unduhan hasil akhir tetap resolusi penuh.",
          ]}
        />
      </div>
    </div>
  );
};
