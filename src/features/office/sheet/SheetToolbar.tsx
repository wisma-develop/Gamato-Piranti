import React from "react";
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, Rows3, Columns3, Trash2, Download, Upload,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoSelect } from "@/components/ui/GamatoSelect";
import { GamatoTooltip } from "@/components/ui/GamatoTooltip";
import type { CellFormat, NumberFormat } from "./sheetModel";

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

export const SheetToolbar: React.FC<{
  format: CellFormat;
  onFormat: (patch: CellFormat) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onInsertRow: () => void;
  onInsertCol: () => void;
  onDeleteRow: () => void;
  onDeleteCol: () => void;
  onImportCsv: (file: File) => void;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onExportPdf: () => void;
}> = ({ format, onFormat, canUndo, canRedo, onUndo, onRedo, onInsertRow, onInsertCol, onDeleteRow, onDeleteCol, onImportCsv, onExportCsv, onExportXlsx, onExportPdf }) => {
  const importRef = React.useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = React.useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);

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
      <ToolBtn title="Tebal" active={!!format.bold} onClick={() => onFormat({ bold: !format.bold })}>
        <Bold className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Miring" active={!!format.italic} onClick={() => onFormat({ italic: !format.italic })}>
        <Italic className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Garis Bawah" active={!!format.underline} onClick={() => onFormat({ underline: !format.underline })}>
        <Underline className="w-4 h-4" />
      </ToolBtn>
      <Sep />
      <ToolBtn title="Rata Kiri" active={(format.align ?? "left") === "left"} onClick={() => onFormat({ align: "left" })}>
        <AlignLeft className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Rata Tengah" active={format.align === "center"} onClick={() => onFormat({ align: "center" })}>
        <AlignCenter className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Rata Kanan" active={format.align === "right"} onClick={() => onFormat({ align: "right" })}>
        <AlignRight className="w-4 h-4" />
      </ToolBtn>
      <Sep />
      <div className="w-36">
        <GamatoSelect
          value={format.numberFormat ?? "general"}
          onChange={(e) => onFormat({ numberFormat: e.target.value as NumberFormat })}
          className="h-8 text-xs"
        >
          <option value="general">Umum</option>
          <option value="number">Angka (0.00)</option>
          <option value="integer">Bulat</option>
          <option value="percent">Persen (%)</option>
          <option value="currency">Mata Uang (Rp)</option>
        </GamatoSelect>
      </div>
      <Sep />
      <GamatoColorPicker label="" value={format.bg ?? "#ffffff"} onChange={(hex) => onFormat({ bg: hex })} className="w-8" />
      <GamatoColorPicker label="" value={format.color ?? "#0f172a"} onChange={(hex) => onFormat({ color: hex })} className="w-8" />
      <Sep />
      <ToolBtn title="Sisipkan Baris di Bawah" onClick={onInsertRow}>
        <Rows3 className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Sisipkan Kolom di Kanan" onClick={onInsertCol}>
        <Columns3 className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Hapus Baris Terpilih" onClick={onDeleteRow}>
        <Trash2 className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Hapus Kolom Terpilih" onClick={onDeleteCol}>
        <Columns3 className="w-4 h-4 opacity-50" />
      </ToolBtn>
      <Sep />
      <ToolBtn title="Impor CSV / Excel" onClick={() => importRef.current?.click()}>
        <Upload className="w-4 h-4" />
      </ToolBtn>
      <input
        ref={importRef}
        type="file"
        accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportCsv(f);
          e.target.value = "";
        }}
      />
      <div className="relative ml-auto" ref={exportRef}>
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
              { label: "Excel (.xlsx)", fn: onExportXlsx },
              { label: "CSV (.csv)", fn: onExportCsv },
              { label: "PDF (.pdf)", fn: onExportPdf },
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
  );
};
