import React, { useEffect } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { cn } from "@/utils/cn";

export interface UndoRedoBarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  className?: string;
  /** Set false to skip the global Ctrl+Z / Ctrl+Y keyboard shortcuts (rarely needed). */
  keyboardShortcuts?: boolean;
  /** Hide the small text label on wider screens. */
  hideLabel?: boolean;
}

/**
 * Small Undo/Redo button pair, used throughout every editing tool
 * (Certificate/CV/Invoice/Kwitansi/Struk/Business Card generators, QR &
 * Barcode Studio, Image editors, PDF page tools, etc). Pair this with a
 * `useHistoryState` instance:
 *
 *   const h = useHistoryState(initial);
 *   <UndoRedoBar canUndo={h.canUndo} canRedo={h.canRedo} onUndo={h.undo} onRedo={h.redo} />
 */
export const UndoRedoBar: React.FC<UndoRedoBarProps> = ({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  className,
  keyboardShortcuts = true,
  hideLabel,
}) => {
  useEffect(() => {
    if (!keyboardShortcuts) return;
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        onRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [keyboardShortcuts, onUndo, onRedo]);

  return (
    <div className={cn("inline-flex items-center gap-1.5 shrink-0", className)}>
      {!hideLabel && (
        <span className="hidden sm:inline text-[11px] font-semibold text-slate-400 dark:text-slate-500 mr-0.5 shrink-0">
          Riwayat
        </span>
      )}
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Urungkan (Ctrl+Z)"
        aria-label="Urungkan perubahan"
        className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <Undo2 className="w-4 h-4 shrink-0" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Ulangi (Ctrl+Y / Ctrl+Shift+Z)"
        aria-label="Ulangi perubahan"
        className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <Redo2 className="w-4 h-4 shrink-0" strokeWidth={2.25} />
      </button>
    </div>
  );
};
