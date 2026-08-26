import React from "react";
import {
  Type, Square, Circle, Minus, ImagePlus, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Trash2,
  BringToFront, SendToBack, Play, Download, Upload, ChevronDown,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoTooltip } from "@/components/ui/GamatoTooltip";
import type { SlideElement, TextAlign } from "./slideModel";

const ToolBtn: React.FC<{ active?: boolean; onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean }> = ({
  active,
  onClick,
  title,
  children,
  disabled,
}) => (
  <GamatoTooltip label={title}>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      className={cn(
        "h-8 min-w-8 px-1.5 flex items-center justify-center rounded-lg border transition-colors text-sm",
        active
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      {children}
    </button>
  </GamatoTooltip>
);

const Sep: React.FC = () => <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />;

export const SlideToolbar: React.FC<{
  selected: SlideElement | null;
  background: string;
  onSetBackground: (hex: string) => void;
  onAddText: () => void;
  onAddShape: (shape: "rect" | "ellipse" | "line") => void;
  onAddImage: (file: File) => void;
  onDeleteSelected: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onUpdateText: (patch: Partial<{ bold: boolean; italic: boolean; align: TextAlign; color: string; fontSize: number }>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPresent: () => void;
  onImportPptx: (file: File) => void;
  onExportPdf: () => void;
  onExportImages: () => void;
}> = ({
  selected,
  background,
  onSetBackground,
  onAddText,
  onAddShape,
  onAddImage,
  onDeleteSelected,
  onBringToFront,
  onSendToBack,
  onUpdateText,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPresent,
  onImportPptx,
  onExportPdf,
  onExportImages,
}) => {
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const pptxInputRef = React.useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);
  const textEl = selected?.kind === "text" ? selected : null;

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-sm">
      <ToolBtn title="Urungkan (Ctrl+Z)" onClick={onUndo} disabled={!canUndo}>
        <Undo2 className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Ulangi (Ctrl+Y)" onClick={onRedo} disabled={!canRedo}>
        <Redo2 className="w-4 h-4" />
      </ToolBtn>
      <Sep />
      <ToolBtn title="Tambah Kotak Teks" onClick={onAddText}>
        <Type className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Tambah Persegi" onClick={() => onAddShape("rect")}>
        <Square className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Tambah Lingkaran" onClick={() => onAddShape("ellipse")}>
        <Circle className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Tambah Garis" onClick={() => onAddShape("line")}>
        <Minus className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Tambah Gambar" onClick={() => imageInputRef.current?.click()}>
        <ImagePlus className="w-4 h-4" />
      </ToolBtn>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAddImage(f);
          e.target.value = "";
        }}
      />
      <Sep />
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 hidden sm:inline">Latar</span>
        <GamatoColorPicker label="" value={background} onChange={onSetBackground} className="w-8" />
      </div>

      {textEl && (
        <>
          <Sep />
          <ToolBtn title="Tebal" active={!!textEl.bold} onClick={() => onUpdateText({ bold: !textEl.bold })}>
            <Bold className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Miring" active={!!textEl.italic} onClick={() => onUpdateText({ italic: !textEl.italic })}>
            <Italic className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Rata Kiri" active={(textEl.align ?? "left") === "left"} onClick={() => onUpdateText({ align: "left" })}>
            <AlignLeft className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Rata Tengah" active={textEl.align === "center"} onClick={() => onUpdateText({ align: "center" })}>
            <AlignCenter className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Rata Kanan" active={textEl.align === "right"} onClick={() => onUpdateText({ align: "right" })}>
            <AlignRight className="w-4 h-4" />
          </ToolBtn>
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 rounded-lg px-1.5 h-8">
            <button type="button" onClick={() => onUpdateText({ fontSize: Math.max(8, textEl.fontSize - 2) })} className="text-slate-500 dark:text-slate-400 w-5 text-sm font-bold">
              −
            </button>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-300 w-6 text-center">{textEl.fontSize}</span>
            <button type="button" onClick={() => onUpdateText({ fontSize: Math.min(200, textEl.fontSize + 2) })} className="text-slate-500 dark:text-slate-400 w-5 text-sm font-bold">
              +
            </button>
          </div>
          <GamatoColorPicker label="" value={textEl.color} onChange={(hex) => onUpdateText({ color: hex })} className="w-8" />
        </>
      )}

      {selected && (
        <>
          <Sep />
          <ToolBtn title="Ke Depan" onClick={onBringToFront}>
            <BringToFront className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Ke Belakang" onClick={onSendToBack}>
            <SendToBack className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Hapus Elemen" onClick={onDeleteSelected}>
            <Trash2 className="w-4 h-4" />
          </ToolBtn>
        </>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <ToolBtn title="Impor .pptx" onClick={() => pptxInputRef.current?.click()}>
          <Upload className="w-4 h-4" />
        </ToolBtn>
        <input
          ref={pptxInputRef}
          type="file"
          accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportPptx(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={onPresent}
          className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white text-xs font-semibold transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Tampilkan
        </button>
        <div className="relative" ref={exportRef}>
          <button
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor
            <ChevronDown className={cn("w-3 h-3 transition-transform", exportOpen && "rotate-180")} />
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden z-20">
              {[
                { label: "PDF (.pdf)", fn: onExportPdf },
                { label: "Gambar (.zip)", fn: onExportImages },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    opt.fn();
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
