import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Pencil, Table2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { readXlsxGrid } from "@/lib/officeReaders";
import { useHistoryState } from "@/hooks/useHistoryState";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { useToast } from "@/components/ui/GamatoToast";
import { colIndexToLabel, isErrorValue, type CellAddr } from "./sheet/formulaEngine";
import {
  cellKey,
  computeSheet,
  createEmptySheet,
  formatCellValue,
  parseCsv,
  sheetToCsv,
  type CellFormat,
  type SheetData,
} from "./sheet/sheetModel";
import { sheetToXlsxBlob } from "./sheet/exportXlsx";
import { sheetToPdfBlob } from "./sheet/exportPdf";
import { SheetToolbar } from "./sheet/SheetToolbar";

const ROW_HEADER_WIDTH = 44;
const DEFAULT_COL_WIDTH = 96;
const ROW_HEIGHT = 28;

interface Selection {
  anchor: CellAddr;
  focus: CellAddr;
}

function normalizeRange(sel: Selection) {
  return {
    r1: Math.min(sel.anchor.row, sel.focus.row),
    r2: Math.max(sel.anchor.row, sel.focus.row),
    c1: Math.min(sel.anchor.col, sel.focus.col),
    c2: Math.max(sel.anchor.col, sel.focus.col),
  };
}

function isInSelection(sel: Selection | null, addr: CellAddr): boolean {
  if (!sel) return false;
  const { r1, r2, c1, c2 } = normalizeRange(sel);
  return addr.row >= r1 && addr.row <= r2 && addr.col >= c1 && addr.col <= c2;
}

function clampAddr(addr: CellAddr, sheet: SheetData): CellAddr {
  return {
    row: Math.max(0, Math.min(sheet.rowCount - 1, addr.row)),
    col: Math.max(0, Math.min(sheet.colCount - 1, addr.col)),
  };
}

export const SheetStudio: React.FC = () => {
  const history = useHistoryState<SheetData[]>(() => [createEmptySheet("Sheet1")]);
  const sheets = history.state;
  const [activeIdx, setActiveIdx] = useState(0);
  const activeSheet = sheets[Math.min(activeIdx, sheets.length - 1)];

  const [selection, setSelection] = useState<Selection>({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } });
  const [editingCell, setEditingCell] = useState<CellAddr | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);
  const [renamingSheet, setRenamingSheet] = useState<number | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const gridWrapRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const formulaBarRef = useRef<HTMLInputElement>(null);
  // Escape must cancel WITHOUT saving, and Enter/Tab must not double-commit —
  // but React fires a real `blur` whenever the edit <input> loses focus or is
  // unmounted, including right after a keydown handler already resolved the
  // edit itself. Without this guard, that trailing blur would race the
  // keydown handler: re-saving a value Escape just discarded, or re-running
  // commitEdit a second time after Enter/Tab already committed it. Every
  // handler that explicitly resolves an edit (commit or cancel) flips this to
  // true right before it moves focus; the blur handler checks it first and,
  // if set, skips its own logic and resets it — so a genuine "unhandled" blur
  // (e.g. clicking the toolbar mid-edit) still falls through to commit.
  const editResolvedRef = useRef(false);
  const { showToast } = useToast();

  const values = useMemo(() => computeSheet(activeSheet), [activeSheet.cells, activeSheet.rowCount, activeSheet.colCount]);

  const activeAddr = selection.focus;
  const activeCellData = activeSheet.cells[cellKey(activeAddr)];
  const activeFormat: CellFormat = activeCellData?.format ?? {};

  useEffect(() => {
    if (editingCell && editInputRef.current) editInputRef.current.focus();
  }, [editingCell]);

  // ─── Mutation helpers ────────────────────────────────────────────────
  const mutateActiveSheet = useCallback(
    (fn: (sheet: SheetData) => SheetData, opts?: { commit?: boolean }) => {
      history.set((prev) => prev.map((s, i) => (i === activeIdx ? fn(s) : s)), opts);
    },
    [activeIdx, history]
  );

  const beginEdit = useCallback(
    (addr: CellAddr, initialValue?: string) => {
      const key = cellKey(addr);
      const raw = initialValue ?? activeSheet.cells[key]?.raw ?? "";
      setEditingCell(addr);
      setEditValue(raw);
    },
    [activeSheet]
  );

  const commitEdit = useCallback(
    (addr: CellAddr, raw: string) => {
      // Centralized here (not in each caller) so every commit path — Enter/Tab
      // in either editing surface, or clicking straight from one cell to
      // another — consistently suppresses the input's own trailing blur.
      editResolvedRef.current = true;
      mutateActiveSheet((sheet: SheetData) => {
        const key = cellKey(addr);
        const existing = sheet.cells[key];
        const nextCells = { ...sheet.cells };
        if (raw === "") {
          if (existing?.format) nextCells[key] = { raw: "", format: existing.format };
          else delete nextCells[key];
        } else {
          nextCells[key] = { raw, format: existing?.format };
        }
        return { ...sheet, cells: nextCells };
      });
      setEditingCell(null);
    },
    [mutateActiveSheet]
  );

  const applyFormat = useCallback(
    (patch: CellFormat) => {
      const { r1, r2, c1, c2 } = normalizeRange(selection);
      mutateActiveSheet((sheet: SheetData) => {
        const nextCells = { ...sheet.cells };
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            const key = cellKey({ row: r, col: c });
            const existing = nextCells[key];
            nextCells[key] = { raw: existing?.raw ?? "", format: { ...existing?.format, ...patch } };
          }
        }
        return { ...sheet, cells: nextCells };
      });
    },
    [selection, mutateActiveSheet]
  );

  const clearSelection = useCallback(() => {
    const { r1, r2, c1, c2 } = normalizeRange(selection);
    mutateActiveSheet((sheet: SheetData) => {
      const nextCells = { ...sheet.cells };
      for (let r = r1; r <= r2; r++) {
        for (let c = c1; c <= c2; c++) {
          const key = cellKey({ row: r, col: c });
          const existing = nextCells[key];
          if (existing?.format) nextCells[key] = { raw: "", format: existing.format };
          else delete nextCells[key];
        }
      }
      return { ...sheet, cells: nextCells };
    });
  }, [selection, mutateActiveSheet]);

  // ─── Row / column structural edits ──────────────────────────────────
  const insertRow = useCallback(() => {
    const at = normalizeRange(selection).r2 + 1;
    mutateActiveSheet((sheet: SheetData) => {
      const nextCells: SheetData["cells"] = {};
      for (const [key, cell] of Object.entries(sheet.cells)) {
        const m = /^([A-Za-z]+)(\d+)$/.exec(key)!;
        const parsed = { col: colIndexFromLabel(m[1]), row: parseInt(m[2], 10) - 1 };
        const newRow = parsed.row >= at ? parsed.row + 1 : parsed.row;
        nextCells[cellKey({ col: parsed.col, row: newRow })] = cell;
      }
      return { ...sheet, rowCount: sheet.rowCount + 1, cells: nextCells };
    });
    setInfo("Baris baru ditambahkan. Referensi rumus lintas-baris tidak otomatis disesuaikan.");
  }, [selection, mutateActiveSheet]);

  const insertCol = useCallback(() => {
    const at = normalizeRange(selection).c2 + 1;
    mutateActiveSheet((sheet: SheetData) => {
      const nextCells: SheetData["cells"] = {};
      for (const [key, cell] of Object.entries(sheet.cells)) {
        const m = /^([A-Za-z]+)(\d+)$/.exec(key)!;
        const parsed = { col: colIndexFromLabel(m[1]), row: parseInt(m[2], 10) - 1 };
        const newCol = parsed.col >= at ? parsed.col + 1 : parsed.col;
        nextCells[cellKey({ col: newCol, row: parsed.row })] = cell;
      }
      return { ...sheet, colCount: sheet.colCount + 1, cells: nextCells };
    });
    setInfo("Kolom baru ditambahkan. Referensi rumus lintas-kolom tidak otomatis disesuaikan.");
  }, [selection, mutateActiveSheet]);

  const deleteRow = useCallback(() => {
    const { r1, r2 } = normalizeRange(selection);
    mutateActiveSheet((sheet: SheetData) => {
      if (sheet.rowCount - (r2 - r1 + 1) < 1) return sheet;
      const nextCells: SheetData["cells"] = {};
      for (const [key, cell] of Object.entries(sheet.cells)) {
        const m = /^([A-Za-z]+)(\d+)$/.exec(key)!;
        const parsed = { col: colIndexFromLabel(m[1]), row: parseInt(m[2], 10) - 1 };
        if (parsed.row >= r1 && parsed.row <= r2) continue;
        const newRow = parsed.row > r2 ? parsed.row - (r2 - r1 + 1) : parsed.row;
        nextCells[cellKey({ col: parsed.col, row: newRow })] = cell;
      }
      return { ...sheet, rowCount: sheet.rowCount - (r2 - r1 + 1), cells: nextCells };
    });
    setSelection({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } });
  }, [selection, mutateActiveSheet]);

  const deleteCol = useCallback(() => {
    const { c1, c2 } = normalizeRange(selection);
    mutateActiveSheet((sheet: SheetData) => {
      if (sheet.colCount - (c2 - c1 + 1) < 1) return sheet;
      const nextCells: SheetData["cells"] = {};
      for (const [key, cell] of Object.entries(sheet.cells)) {
        const m = /^([A-Za-z]+)(\d+)$/.exec(key)!;
        const parsed = { col: colIndexFromLabel(m[1]), row: parseInt(m[2], 10) - 1 };
        if (parsed.col >= c1 && parsed.col <= c2) continue;
        const newCol = parsed.col > c2 ? parsed.col - (c2 - c1 + 1) : parsed.col;
        nextCells[cellKey({ col: newCol, row: parsed.row })] = cell;
      }
      return { ...sheet, colCount: sheet.colCount - (c2 - c1 + 1), cells: nextCells };
    });
    setSelection({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } });
  }, [selection, mutateActiveSheet]);

  // ─── Sheet tabs ──────────────────────────────────────────────────────
  const addSheet = useCallback(() => {
    history.set((prev) => [...prev, createEmptySheet(`Sheet${prev.length + 1}`)]);
    setActiveIdx(sheets.length);
    setSelection({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } });
  }, [history, sheets.length]);

  const removeSheet = useCallback(
    (idx: number) => {
      if (sheets.length <= 1) return;
      history.set((prev) => prev.filter((_, i) => i !== idx));
      setActiveIdx((cur) => Math.max(0, cur >= idx ? cur - 1 : cur));
    },
    [sheets.length, history]
  );

  const renameSheet = useCallback(
    (idx: number, name: string) => {
      const clean = name.trim() || `Sheet${idx + 1}`;
      history.set((prev) => prev.map((s, i) => (i === idx ? { ...s, name: clean } : s)));
    },
    [history]
  );

  // ─── CSV / XLSX import ───────────────────────────────────────────────
  const importCsv = useCallback(
    async (file: File) => {
      let rows: string[][];
      try {
        if (/\.xlsx$/i.test(file.name)) {
          rows = await readXlsxGrid(file);
        } else {
          const buf = await fileToArrayBuffer(file);
          const text = new TextDecoder("utf-8").decode(buf);
          rows = parseCsv(text);
        }
      } catch (err: unknown) {
        setInfo(`Gagal membaca file: ${err instanceof Error ? err.message : "format tidak dikenali"}.`);
        return;
      }
      if (!rows.length) {
        setInfo("File kosong atau tidak terbaca.");
        return;
      }
      const rowCount = Math.max(rows.length, 20);
      const colCount = Math.max(...rows.map((r) => r.length), 10);
      const cells: SheetData["cells"] = {};
      rows.forEach((row, r) => {
        row.forEach((val, c) => {
          if (val !== "") cells[cellKey({ col: c, row: r })] = { raw: val };
        });
      });
      history.set((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, rowCount, colCount, cells } : s)));
      setInfo(`File berhasil diimpor: ${rows.length} baris.`);
    },
    [activeIdx, history]
  );

  // ─── Export ──────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    const csv = sheetToCsv(activeSheet);
    downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), `${sanitizeFileName(activeSheet.name || "sheet")}.csv`);
    showToast("CSV berhasil diunduh.", "success");
  }, [activeSheet, showToast]);

  const exportXlsx = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await sheetToXlsxBlob(activeSheet);
      downloadBlob(blob, `${sanitizeFileName(activeSheet.name || "sheet")}.xlsx`);
      showToast("Excel (.xlsx) berhasil diunduh.", "success");
    } catch {
      showToast("Gagal membuat file Excel.", "error");
    } finally {
      setIsExporting(false);
    }
  }, [activeSheet, showToast]);

  const exportPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await sheetToPdfBlob(activeSheet);
      downloadBlob(blob, `${sanitizeFileName(activeSheet.name || "sheet")}.pdf`);
      showToast("PDF berhasil diunduh.", "success");
    } catch {
      showToast("Gagal membuat PDF.", "error");
    } finally {
      setIsExporting(false);
    }
  }, [activeSheet, showToast]);

  // ─── Copy / paste (tab-separated, matches Excel/Sheets clipboard format) ──
  const copySelection = useCallback(async () => {
    const { r1, r2, c1, c2 } = normalizeRange(selection);
    const lines: string[] = [];
    for (let r = r1; r <= r2; r++) {
      const row: string[] = [];
      for (let c = c1; c <= c2; c++) {
        row.push(formatCellValue(values[cellKey({ col: c, row: r })] ?? null));
      }
      lines.push(row.join("\t"));
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      // Clipboard API may be unavailable (permissions/non-HTTPS) — fail silently, nothing else to do.
    }
  }, [selection, values]);

  const pasteAtSelection = useCallback(async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setInfo("Tidak bisa mengakses clipboard. Izinkan akses clipboard di browser, atau ketik manual.");
      return;
    }
    if (!text) return;
    const rows = text.replace(/\r/g, "").split("\n").map((r) => r.split("\t"));
    const start = selection.focus;
    mutateActiveSheet((sheet: SheetData) => {
      const nextCells = { ...sheet.cells };
      let maxRow = sheet.rowCount;
      let maxCol = sheet.colCount;
      rows.forEach((row, ri) => {
        row.forEach((val, ci) => {
          const addr = { row: start.row + ri, col: start.col + ci };
          maxRow = Math.max(maxRow, addr.row + 1);
          maxCol = Math.max(maxCol, addr.col + 1);
          const key = cellKey(addr);
          const existing = nextCells[key];
          if (val === "") {
            if (existing?.format) nextCells[key] = { raw: "", format: existing.format };
            else delete nextCells[key];
          } else {
            nextCells[key] = { raw: val, format: existing?.format };
          }
        });
      });
      return { ...sheet, cells: nextCells, rowCount: maxRow, colCount: maxCol };
    });
  }, [selection, mutateActiveSheet]);

  // ─── Keyboard navigation ─────────────────────────────────────────────
  const onGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (editingCell) {
        if (e.key === "Enter") {
          e.preventDefault();
          editResolvedRef.current = true;
          commitEdit(editingCell, editValue);
          const next = clampAddr({ row: editingCell.row + 1, col: editingCell.col }, activeSheet);
          setSelection({ anchor: next, focus: next });
        } else if (e.key === "Tab") {
          e.preventDefault();
          editResolvedRef.current = true;
          commitEdit(editingCell, editValue);
          const next = clampAddr({ row: editingCell.row, col: editingCell.col + (e.shiftKey ? -1 : 1) }, activeSheet);
          setSelection({ anchor: next, focus: next });
        } else if (e.key === "Escape") {
          e.preventDefault();
          editResolvedRef.current = true;
          setEditingCell(null);
        }
        return;
      }

      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        history.undo();
        return;
      }
      if (meta && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        history.redo();
        return;
      }
      if (meta && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void copySelection();
        return;
      }
      if (meta && e.key.toLowerCase() === "v") {
        e.preventDefault();
        void pasteAtSelection();
        return;
      }
      if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        applyFormat({ bold: !activeFormat.bold });
        return;
      }

      const move = (dr: number, dc: number, extend: boolean) => {
        e.preventDefault();
        setSelection((prev) => {
          const nextFocus = clampAddr({ row: prev.focus.row + dr, col: prev.focus.col + dc }, activeSheet);
          return { anchor: extend ? prev.anchor : nextFocus, focus: nextFocus };
        });
      };

      switch (e.key) {
        case "ArrowDown":
          move(1, 0, e.shiftKey);
          return;
        case "ArrowUp":
          move(-1, 0, e.shiftKey);
          return;
        case "ArrowLeft":
          move(0, -1, e.shiftKey);
          return;
        case "ArrowRight":
          move(0, 1, e.shiftKey);
          return;
        case "Tab":
          move(0, e.shiftKey ? -1 : 1, false);
          return;
        case "Enter":
          e.preventDefault();
          beginEdit(activeAddr);
          return;
        case "F2":
          e.preventDefault();
          beginEdit(activeAddr);
          return;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          clearSelection();
          return;
        default:
          if (e.key.length === 1 && !meta && !e.altKey) {
            beginEdit(activeAddr, "");
            setEditValue(e.key);
          }
      }
    },
    [editingCell, editValue, activeSheet, activeAddr, activeFormat, commitEdit, beginEdit, clearSelection, applyFormat, history, copySelection, pasteAtSelection]
  );

  // ─── Render ──────────────────────────────────────────────────────────
  const colHeaders = useMemo(() => Array.from({ length: activeSheet.colCount }, (_, i) => i), [activeSheet.colCount]);
  const rowIndices = useMemo(() => Array.from({ length: activeSheet.rowCount }, (_, i) => i), [activeSheet.rowCount]);

  const activeRawText = editingCell ? editValue : activeCellData?.raw ?? "";

  return (
    <div className="space-y-4">
      <GamatoDesktopRecommended toolName="Sheet Studio" />

      <SheetToolbar
        format={activeFormat}
        onFormat={applyFormat}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={() => history.undo()}
        onRedo={() => history.redo()}
        onInsertRow={insertRow}
        onInsertCol={insertCol}
        onDeleteRow={deleteRow}
        onDeleteCol={deleteCol}
        onImportCsv={importCsv}
        onExportCsv={exportCsv}
        onExportXlsx={exportXlsx}
        onExportPdf={exportPdf}
      />

      {/* Formula bar */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-sm">
        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 w-14 shrink-0 text-center">
          {colIndexToLabel(activeAddr.col)}
          {activeAddr.row + 1}
        </span>
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0" />
        <input
          ref={formulaBarRef}
          value={activeRawText}
          onChange={(e) => {
            if (!editingCell) setEditingCell(activeAddr);
            setEditValue(e.target.value);
          }}
          onFocus={() => {
            if (!editingCell) beginEdit(activeAddr);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              editResolvedRef.current = true;
              commitEdit(activeAddr, editValue);
              const next = clampAddr({ row: activeAddr.row + 1, col: activeAddr.col }, activeSheet);
              setSelection({ anchor: next, focus: next });
              gridWrapRef.current?.focus();
            } else if (e.key === "Tab") {
              e.preventDefault();
              editResolvedRef.current = true;
              commitEdit(activeAddr, editValue);
              const next = clampAddr({ row: activeAddr.row, col: activeAddr.col + (e.shiftKey ? -1 : 1) }, activeSheet);
              setSelection({ anchor: next, focus: next });
              gridWrapRef.current?.focus();
            } else if (e.key === "Escape") {
              e.preventDefault();
              editResolvedRef.current = true;
              setEditingCell(null);
              gridWrapRef.current?.focus();
            }
          }}
          onBlur={() => {
            if (editResolvedRef.current) {
              editResolvedRef.current = false;
              return;
            }
            if (editingCell) commitEdit(activeAddr, editValue);
          }}
          placeholder="Ketik nilai atau rumus, mis. =SUM(A1:A5)"
          className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 focus:outline-none font-mono"
        />
      </div>

      {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") || info.startsWith("Tidak") ? "error" : "info"} />}

      {/* Grid */}
      <div
        ref={gridWrapRef}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
        onMouseUp={() => setIsSelecting(false)}
        onMouseLeave={() => setIsSelecting(false)}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-auto max-h-[65vh] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      >
        <table className="border-collapse select-none" style={{ width: "max-content" }}>
          <thead>
            <tr>
              <th
                className="sticky top-0 left-0 z-30 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                style={{ width: ROW_HEADER_WIDTH, height: ROW_HEIGHT, minWidth: ROW_HEADER_WIDTH }}
              />
              {colHeaders.map((c) => (
                <th
                  key={c}
                  className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400"
                  style={{ width: activeSheet.colWidths?.[c] ?? DEFAULT_COL_WIDTH, minWidth: 40, height: ROW_HEIGHT }}
                >
                  {colIndexToLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowIndices.map((r) => (
              <tr key={r}>
                <td
                  className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 text-center"
                  style={{ width: ROW_HEADER_WIDTH, height: ROW_HEIGHT }}
                  onClick={() => setSelection({ anchor: { row: r, col: 0 }, focus: { row: r, col: activeSheet.colCount - 1 } })}
                >
                  {r + 1}
                </td>
                {colHeaders.map((c) => {
                  const addr = { row: r, col: c };
                  const key = cellKey(addr);
                  const cellData = activeSheet.cells[key];
                  const val = values[key] ?? null;
                  const isActive = activeAddr.row === r && activeAddr.col === c;
                  const inSel = isInSelection(selection, addr);
                  const isEditing = editingCell && editingCell.row === r && editingCell.col === c;
                  const fmt = cellData?.format;
                  const err = isErrorValue(val);
                  return (
                    <td
                      key={c}
                      onMouseDown={() => {
                        setIsSelecting(true);
                        setSelection({ anchor: addr, focus: addr });
                        if (editingCell && (editingCell.row !== r || editingCell.col !== c)) commitEdit(editingCell, editValue);
                      }}
                      onMouseEnter={() => {
                        if (isSelecting) setSelection((prev) => ({ anchor: prev.anchor, focus: addr }));
                      }}
                      onDoubleClick={() => beginEdit(addr)}
                      className={cn(
                        "border relative p-0",
                        inSel ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30" : "border-slate-200 dark:border-slate-700",
                        isActive && "outline outline-2 outline-indigo-500 z-[1]"
                      )}
                      style={{
                        width: activeSheet.colWidths?.[c] ?? DEFAULT_COL_WIDTH,
                        height: ROW_HEIGHT,
                        backgroundColor: !inSel ? fmt?.bg : undefined,
                      }}
                    >
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => {
                            if (editResolvedRef.current) {
                              editResolvedRef.current = false;
                              return;
                            }
                            commitEdit(addr, editValue);
                          }}
                          className="absolute inset-0 w-full h-full px-1.5 text-sm bg-white dark:bg-slate-900 outline-none ring-2 ring-indigo-500 font-mono"
                        />
                      ) : (
                        <div
                          className={cn(
                            "px-1.5 h-full flex items-center text-sm truncate",
                            fmt?.bold && "font-bold",
                            fmt?.italic && "italic",
                            fmt?.underline && "underline",
                            fmt?.align === "center" && "justify-center",
                            fmt?.align === "right" && "justify-end",
                            err && "text-red-600 dark:text-red-400 font-semibold"
                          )}
                          style={{ color: !err ? fmt?.color : undefined }}
                        >
                          {formatCellValue(val, fmt)}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {sheets.map((s, i) => (
          <div
            key={i}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer",
              i === activeIdx
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            )}
            onClick={() => {
              setActiveIdx(i);
              setSelection({ anchor: { row: 0, col: 0 }, focus: { row: 0, col: 0 } });
            }}
          >
            <Table2 className="w-3.5 h-3.5" />
            {renamingSheet === i ? (
              <input
                autoFocus
                defaultValue={s.name}
                onBlur={(e) => {
                  renameSheet(i, e.target.value);
                  setRenamingSheet(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setRenamingSheet(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white/20 rounded px-1 w-20 text-inherit outline-none"
              />
            ) : (
              <span onDoubleClick={(e) => { e.stopPropagation(); setRenamingSheet(i); }}>{s.name}</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingSheet(i);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Ganti nama ${s.name}`}
            >
              <Pencil className="w-3 h-3" />
            </button>
            {sheets.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSheet(i);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Hapus ${s.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addSheet}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Sheet
        </button>
      </div>

      {isExporting && <p className="text-xs text-slate-400 dark:text-slate-500">Menyiapkan file untuk diunduh…</p>}
    </div>
  );
};

function colIndexFromLabel(label: string): number {
  let n = 0;
  for (let i = 0; i < label.length; i++) n = n * 26 + (label.toUpperCase().charCodeAt(i) - 64);
  return n - 1;
}
