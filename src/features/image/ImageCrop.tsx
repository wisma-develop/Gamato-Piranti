import React, { useState } from "react";
import { Crop as CropIcon, Image as ImageIcon, Loader2, Download } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { loadImageFromUrl, canvasToBlob, makeCanvas } from "@/lib/canvas";
import { Btn, Select } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";

type DragMode = "move" | "nw" | "ne" | "sw" | "se";
interface Sel {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const PRESETS: { label: string; ratio: number | null }[] = [
  { label: "Bebas", ratio: null },
  { label: "1:1", ratio: 1 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "3:4", ratio: 3 / 4 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "9:16", ratio: 9 / 16 },
];

export const ImageCrop: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  // Kotak seleksi crop punya riwayat Undo/Redo. Menyeret digabung jadi satu
  // langkah setelah dilepas; pilih preset rasio langsung commit.
  const selHistory = useHistoryState<Sel>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
  const sel = selHistory.state;
  const setSel = selHistory.set;
  const { schedule: scheduleSelCommit, flushNow: flushSelCommit } = useDebouncedCommit(selHistory.commit, 400);
  const [activePreset, setActivePreset] = useState("Bebas");
  const [outputFormat, setOutputFormat] = useState<"png" | "jpeg">("png");
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const addFiles = async (incoming: File[]) => {
    const f = incoming.find((x) => x.type.startsWith("image/"));
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    const img = await loadImageFromUrl(url);
    setFile(f);
    setPreviewUrl(url);
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    selHistory.reset({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }); // gambar baru = mulai riwayat baru
    setActivePreset("Bebas");
    setInfo(null);
  };

  const applyPreset = (label: string, ratio: number | null) => {
    setActivePreset(label);
    if (ratio === null || !naturalSize) return;
    let fw = 0.86;
    let fh = (fw * naturalSize.w) / (ratio * naturalSize.h);
    if (fh > 0.9) {
      fh = 0.9;
      fw = (fh * ratio * naturalSize.h) / naturalSize.w;
    }
    fw = clamp(fw, 0.05, 1);
    fh = clamp(fh, 0.05, 1);
    setSel({ x: (1 - fw) / 2, y: (1 - fh) / 2, w: fw, h: fh });
  };

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startSel = { ...sel };
    setActivePreset("Bebas");

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      if (mode === "move") {
        const x = clamp(startSel.x + dx, 0, 1 - startSel.w);
        const y = clamp(startSel.y + dy, 0, 1 - startSel.h);
        setSel({ ...startSel, x, y }, { commit: false });
        scheduleSelCommit();
        return;
      }
      let left = startSel.x;
      let top = startSel.y;
      let right = startSel.x + startSel.w;
      let bottom = startSel.y + startSel.h;
      if (mode.includes("e")) right = clamp(right + dx, left + 0.04, 1);
      if (mode.includes("w")) left = clamp(left + dx, 0, right - 0.04);
      if (mode.includes("s")) bottom = clamp(bottom + dy, top + 0.04, 1);
      if (mode.includes("n")) top = clamp(top + dy, 0, bottom - 0.04);
      setSel({ x: left, y: top, w: right - left, h: bottom - top }, { commit: false });
      scheduleSelCommit();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      flushSelCommit(); // seret selesai → satu langkah Undo
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleCrop = async () => {
    if (!file || !previewUrl || !naturalSize) return;
    setIsWorking(true);
    setInfo(null);
    try {
      const img = await loadImageFromUrl(previewUrl);
      const sx = sel.x * naturalSize.w;
      const sy = sel.y * naturalSize.h;
      const sw = sel.w * naturalSize.w;
      const sh = sel.h * naturalSize.h;
      const { canvas, ctx } = makeCanvas(sw, sh);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const mime = outputFormat === "png" ? "image/png" : "image/jpeg";
      const blob = await canvasToBlob(canvas, mime, mime === "image/jpeg" ? 0.92 : undefined);
      const base = file.name.replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}-crop.${outputFormat === "png" ? "png" : "jpg"}`);
      setInfo("Gambar berhasil dipotong.");
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal memotong gambar."));
    } finally {
      setIsWorking(false);
    }
  };

  const handleTag = "absolute w-4 h-4 rounded-full bg-white border-2 border-indigo-600 shadow -m-2 touch-none";

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        {!previewUrl ? (
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
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file?.name}</p>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setFile(null);
                  setPreviewUrl(null);
                  setNaturalSize(null);
                  setInfo(null);
                }}
                className="text-sm text-red-500 font-semibold hover:text-red-700 shrink-0"
              >
                Ganti File
              </button>
            </div>
            <div className="p-4 flex justify-center bg-slate-100 dark:bg-slate-950">
              <div
                ref={containerRef}
                className="relative select-none max-w-full"
                style={{ width: "min(100%, 560px)", aspectRatio: naturalSize ? `${naturalSize.w} / ${naturalSize.h}` : undefined }}
              >
                <img src={previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover rounded-lg pointer-events-none" draggable={false} />
                <div
                  onPointerDown={startDrag("move")}
                  className="absolute border-2 border-indigo-500 cursor-move touch-none"
                  style={{
                    left: `${sel.x * 100}%`,
                    top: `${sel.y * 100}%`,
                    width: `${sel.w * 100}%`,
                    height: `${sel.h * 100}%`,
                    boxShadow: "0 0 0 9999px rgba(15,23,42,0.55)",
                  }}
                >
                  <div onPointerDown={startDrag("nw")} className={cn(handleTag, "top-0 left-0 cursor-nwse-resize")} />
                  <div onPointerDown={startDrag("ne")} className={cn(handleTag, "top-0 right-0 cursor-nesw-resize")} />
                  <div onPointerDown={startDrag("sw")} className={cn(handleTag, "bottom-0 left-0 cursor-nesw-resize")} />
                  <div onPointerDown={startDrag("se")} className={cn(handleTag, "bottom-0 right-0 cursor-nwse-resize")} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Rasio Crop</p>
            <UndoRedoBar canUndo={selHistory.canUndo} canRedo={selHistory.canRedo} onUndo={selHistory.undo} onRedo={selHistory.redo} hideLabel />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.label, p.ratio)}
                disabled={!previewUrl}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all disabled:opacity-40",
                  activePreset === p.label
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Select label="Format Output" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as any)}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </Select>
        </div>

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={handleCrop} disabled={isWorking || !previewUrl} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Potong &amp; Unduh
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<CropIcon className="w-5 h-5" />}
        label="Crop Gambar"
        desc="Potong area tertentu"
        points={[
          "Geser kotak untuk memilih area, tarik titik di sudut untuk mengubah ukuran.",
          "Pakai preset rasio untuk hasil pas 1:1, 4:3, 16:9, dan lainnya.",
        ]}
      />
    </div>
  );
};
