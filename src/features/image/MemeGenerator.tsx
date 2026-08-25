import React, { useState } from "react";
import { Smile, Image as ImageIcon, Plus, Trash2, Loader2, Download } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { loadImageFromUrl, canvasToBlob, makeCanvas } from "@/lib/canvas";
import { Btn, Label, Textarea } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";

interface MemeLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number;
  color: string;
  stroke: string;
  strokeWidth: number;
  uppercase: boolean;
}

const makeId = () => Math.random().toString(36).slice(2, 9);

const defaultLayers = (): MemeLayer[] => [
  { id: makeId(), text: "TOP TEXT", x: 0.5, y: 0.1, size: 9, color: "#ffffff", stroke: "#000000", strokeWidth: 14, uppercase: true },
  { id: makeId(), text: "BOTTOM TEXT", x: 0.5, y: 0.9, size: 9, color: "#ffffff", stroke: "#000000", strokeWidth: 14, uppercase: true },
];

export const MemeGenerator: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  // Lapisan teks meme punya riwayat Undo/Redo. Mengetik/menyeret digabung
  // jadi satu langkah setelah jeda; tambah/hapus lapisan langsung commit.
  const layersHistory = useHistoryState<MemeLayer[]>([]);
  const layers = layersHistory.state;
  const setLayers = layersHistory.set;
  const { schedule: scheduleLayersCommit, flushNow: flushLayersCommit } = useDebouncedCommit(layersHistory.commit, 600);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = layers.find((l) => l.id === selectedId) || null;
  const updateSelected = (patch: Partial<MemeLayer>, opts?: { continuous?: boolean }) => {
    if (!selectedId) return;
    setLayers((prev) => prev.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)), { commit: !opts?.continuous });
    if (opts?.continuous) scheduleLayersCommit();
  };

  const addFiles = async (incoming: File[]) => {
    const f = incoming.find((x) => x.type.startsWith("image/"));
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    const img = await loadImageFromUrl(url);
    setFile(f);
    setPreviewUrl(url);
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    const initial = defaultLayers();
    layersHistory.reset(initial); // gambar baru = mulai riwayat baru
    setSelectedId(initial[0].id);
    setInfo(null);
  };

  const addLayer = () => {
    const layer: MemeLayer = { id: makeId(), text: "Teks baru", x: 0.5, y: 0.5, size: 7, color: "#ffffff", stroke: "#000000", strokeWidth: 12, uppercase: false };
    setLayers((prev) => [...prev, layer]);
    setSelectedId(layer.id);
  };

  const removeLayer = (id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    const rect = containerRef.current?.getBoundingClientRect();
    const layer = layers.find((l) => l.id === id);
    if (!rect || !layer) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { x: layer.x, y: layer.y };
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      const x = Math.min(1, Math.max(0, startPos.x + dx));
      const y = Math.min(1, Math.max(0, startPos.y + dy));
      setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, x, y } : l)), { commit: false });
      scheduleLayersCommit();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      flushLayersCommit(); // seret selesai → satu langkah Undo
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleExport = async () => {
    if (!previewUrl || !naturalSize) return;
    setIsWorking(true);
    setInfo(null);
    try {
      const img = await loadImageFromUrl(previewUrl);
      const { canvas, ctx } = makeCanvas(naturalSize.w, naturalSize.h);
      ctx.drawImage(img, 0, 0);
      layers.forEach((l) => {
        const size = (l.size / 100) * canvas.width;
        ctx.font = `900 ${size}px Impact, 'Arial Black', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        const lines = (l.uppercase ? l.text.toUpperCase() : l.text).split("\n");
        const lineHeight = size * 1.15;
        const startY = l.y * canvas.height - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, i) => {
          const yy = startY + i * lineHeight;
          const lw = (l.strokeWidth / 100) * size;
          if (lw > 0) {
            ctx.lineWidth = lw;
            ctx.strokeStyle = l.stroke;
            ctx.strokeText(line, l.x * canvas.width, yy);
          }
          ctx.fillStyle = l.color;
          ctx.fillText(line, l.x * canvas.width, yy);
        });
      });
      const blob = await canvasToBlob(canvas, "image/png");
      const base = (file?.name || "meme").replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}-meme.png`);
      setInfo("Meme berhasil dibuat!");
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal membuat meme."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-5">
        {!previewUrl ? (
          <Dropzone
            onFiles={addFiles}
            accept="image/*"
            multiple={false}
            label="Drop gambar dasar meme di sini"
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
                  layersHistory.reset([]);
                  setSelectedId(null);
                  setInfo(null);
                }}
                className="text-sm text-red-500 font-semibold hover:text-red-700 shrink-0"
              >
                Ganti File
              </button>
            </div>
            <div className="p-4 flex justify-center bg-slate-100 dark:bg-slate-950">
              <div ref={containerRef} className="relative select-none max-w-full" style={{ width: "min(100%, 560px)", aspectRatio: naturalSize ? `${naturalSize.w} / ${naturalSize.h}` : undefined }}>
                <img src={previewUrl} alt="" className="absolute inset-0 w-full h-full object-cover rounded-lg pointer-events-none" draggable={false} />
                {layers.map((l) => (
                  <div
                    key={l.id}
                    onPointerDown={startDrag(l.id)}
                    className={cn("absolute -translate-x-1/2 -translate-y-1/2 px-1 cursor-move touch-none whitespace-pre text-center font-black", selectedId === l.id && "outline outline-2 outline-indigo-400 outline-dashed")}
                    style={{
                      left: `${l.x * 100}%`,
                      top: `${l.y * 100}%`,
                      fontSize: `${l.size}cqw`,
                      color: l.color,
                      WebkitTextStroke: `${Math.max(0.5, l.strokeWidth / 14)}px ${l.stroke}`,
                      fontFamily: "Impact, 'Arial Black', sans-serif",
                      containerType: "inline-size",
                    }}
                  >
                    {l.uppercase ? l.text.toUpperCase() : l.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={handleExport} disabled={isWorking || !previewUrl || !layers.length} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Buat &amp; Unduh Meme
            </>
          )}
        </Btn>
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Lapisan Teks</p>
            <div className="flex items-center gap-2">
              <UndoRedoBar canUndo={layersHistory.canUndo} canRedo={layersHistory.canRedo} onUndo={layersHistory.undo} onRedo={layersHistory.redo} hideLabel />
              <button type="button" onClick={addLayer} disabled={!previewUrl} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-40 shrink-0">
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {layers.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedId(l.id)}
                className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left", selectedId === l.id ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300")}
              >
                <span className="truncate flex-1">{l.text || "(kosong)"}</span>
                <Trash2
                  className="w-3.5 h-3.5 text-slate-400 hover:text-red-500 shrink-0 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLayer(l.id);
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Edit Teks Terpilih</p>
            <Textarea label="Isi Teks" rows={2} value={selected.text} onChange={(e) => updateSelected({ text: e.target.value }, { continuous: true })} />
            <GamatoCheckbox checked={selected.uppercase} onChange={(v) => updateSelected({ uppercase: v })} label="HURUF BESAR otomatis" />
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label>Ukuran</Label>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{selected.size}%</span>
              </div>
              <GamatoSlider min={2} max={20} value={selected.size} onChange={(v) => updateSelected({ size: v }, { continuous: true })} aria-label="Ukuran teks" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label>Ketebalan Outline</Label>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{selected.strokeWidth}%</span>
              </div>
              <GamatoSlider min={0} max={30} value={selected.strokeWidth} onChange={(v) => updateSelected({ strokeWidth: v }, { continuous: true })} aria-label="Ketebalan outline" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Warna Teks</Label>
                <GamatoColorPicker value={selected.color} onChange={(hex) => updateSelected({ color: hex }, { continuous: true })} className="mt-1.5" />
              </div>
              <div>
                <Label>Warna Outline</Label>
                <GamatoColorPicker value={selected.stroke} onChange={(hex) => updateSelected({ stroke: hex }, { continuous: true })} className="mt-1.5" />
              </div>
            </div>
          </div>
        )}

        <ToolInfoPanel
          icon={<Smile className="w-5 h-5" />}
          label="Meme Generator"
          desc="Teks bebas geser"
          points={["Tarik teks langsung di atas gambar untuk mengatur posisi.", "Tambah lapisan teks sebanyak yang kamu mau."]}
        />
      </div>
    </div>
  );
};
