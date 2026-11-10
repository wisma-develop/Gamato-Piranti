import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * GamatoDatePicker — engine pemilih tanggal kustom bermerek Gamato Piranti.
 * Menggantikan `<input type="date">` bawaan browser/OS (yang tampilannya berbeda-beda di tiap
 * perangkat dan sering tidak berbahasa Indonesia) dengan kalender buatan sendiri.
 *
 * - Nilai selalu string ISO lokal `YYYY-MM-DD` (sama persis dengan `<input type="date">`), tanpa konversi UTC
 *   sehingga tanggal tidak pernah bergeser sehari di zona WIB/WITA/WIT.
 * - `onChange` menerima bentuk event palsu `{ target: { value } }` → drop-in untuk semua pemanggil lama.
 * - Papan ketik: ← → ↑ ↓ pindah hari, PageUp/PageDown ganti bulan, Home/End awal/akhir minggu, Enter pilih, Esc tutup.
 */

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]; // Senin → Minggu

const pad = (n: number) => String(n).padStart(2, "0");
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseISODate(v: string | undefined | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last));
};
const fmtLong = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export function GamatoDatePicker({
  value,
  onChange,
  label,
  id,
  min,
  max,
  disabled,
  required,
  className,
  placeholder = "Pilih tanggal",
  ...rest
}: {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  id?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
} & Record<string, unknown>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const selected = useMemo(() => parseISODate(value), [value]);
  const minD = useMemo(() => parseISODate(min), [min]);
  const maxD = useMemo(() => parseISODate(max), [max]);
  const [open, setOpen] = useState(false);
  const [focusDay, setFocusDay] = useState<Date>(() => selected ?? new Date());
  const [alignRight, setAlignRight] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Bulan/hari fokus ditetapkan SAAT dibuka (bukan di effect) — supaya render pertama langsung benar, tanpa kedip bulan lama.
  const toggleOpen = () => {
    if (!open) setFocusDay(selected ?? new Date());
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setAlignRight(r.left + 288 > window.innerWidth - 8 && r.right - 288 >= 8);
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) gridRef.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }, [open, focusDay]);

  const isDisabledDay = (d: Date) => (minD ? d < minD : false) || (maxD ? d > maxD : false);

  const commit = (v: string) => {
    onChange?.({ target: { value: v }, currentTarget: { value: v } } as unknown as React.ChangeEvent<HTMLInputElement>);
  };
  const pick = (d: Date) => { if (isDisabledDay(d)) return; commit(toISODate(d)); setOpen(false); };

  const weeks = useMemo(() => {
    const first = new Date(focusDay.getFullYear(), focusDay.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Senin = 0
    const start = addDays(first, -offset);
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
  }, [focusDay]);

  const onKey = (e: React.KeyboardEvent) => {
    let next: Date | null = null;
    if (e.key === "ArrowLeft") next = addDays(focusDay, -1);
    else if (e.key === "ArrowRight") next = addDays(focusDay, 1);
    else if (e.key === "ArrowUp") next = addDays(focusDay, -7);
    else if (e.key === "ArrowDown") next = addDays(focusDay, 7);
    else if (e.key === "PageUp") next = addMonths(focusDay, e.shiftKey ? -12 : -1);
    else if (e.key === "PageDown") next = addMonths(focusDay, e.shiftKey ? 12 : 1);
    else if (e.key === "Home") next = addDays(focusDay, -((focusDay.getDay() + 6) % 7));
    else if (e.key === "End") next = addDays(focusDay, 6 - ((focusDay.getDay() + 6) % 7));
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); (wrapRef.current?.querySelector("button") as HTMLButtonElement | null)?.focus(); return; }
    if (next) { e.preventDefault(); setFocusDay(next); }
  };

  const today = new Date();
  const navBtn = "p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors";

  return (
    <div ref={wrapRef} className="relative">
      {label && <label htmlFor={fieldId} className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
      <button
        id={fieldId}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-value={value ?? ""}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-400 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
          open && "border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/10",
          className
        )}
        {...(rest as Record<string, unknown>)}
      >
        <span className={cn("truncate text-left", !selected && "text-slate-400 dark:text-slate-500")}>{selected ? fmtLong(selected) : placeholder}</span>
        <CalendarIcon className="w-4 h-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pilih tanggal"
          onKeyDown={onKey}
          className={cn(
            "absolute z-50 mt-1.5 w-72 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-3 animate-[gamatoFadeIn_0.15s_ease-out]",
            alignRight ? "right-0" : "left-0"
          )}
        >
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="flex">
              <button type="button" className={navBtn} aria-label="Tahun sebelumnya" onClick={() => setFocusDay(addMonths(focusDay, -12))}><ChevronsLeft className="w-4 h-4" /></button>
              <button type="button" className={navBtn} aria-label="Bulan sebelumnya" onClick={() => setFocusDay(addMonths(focusDay, -1))}><ChevronLeft className="w-4 h-4" /></button>
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums" aria-live="polite">{MONTHS[focusDay.getMonth()]} {focusDay.getFullYear()}</p>
            <div className="flex">
              <button type="button" className={navBtn} aria-label="Bulan berikutnya" onClick={() => setFocusDay(addMonths(focusDay, 1))}><ChevronRight className="w-4 h-4" /></button>
              <button type="button" className={navBtn} aria-label="Tahun berikutnya" onClick={() => setFocusDay(addMonths(focusDay, 12))}><ChevronsRight className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d, i) => <span key={d} className={cn("text-center text-[10px] font-bold uppercase tracking-wide py-1", i === 6 ? "text-red-400" : "text-slate-400 dark:text-slate-500")}>{d}</span>)}
          </div>

          <div ref={gridRef} role="grid" className="grid grid-cols-7 gap-0.5">
            {weeks.flat().map((d) => {
              const inMonth = d.getMonth() === focusDay.getMonth();
              const isSel = !!selected && sameDay(d, selected);
              const isToday = sameDay(d, today);
              const off = isDisabledDay(d);
              return (
                <button
                  key={toISODate(d)}
                  type="button"
                  role="gridcell"
                  tabIndex={sameDay(d, focusDay) ? 0 : -1}
                  aria-selected={isSel}
                  aria-label={fmtLong(d)}
                  data-date={toISODate(d)}
                  disabled={off}
                  onClick={() => pick(d)}
                  className={cn(
                    "h-9 rounded-lg text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50",
                    isSel ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : off ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                      : inMonth ? "text-slate-800 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-indigo-500/15"
                      : "text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/40",
                    isToday && !isSel && "ring-1 ring-indigo-400 font-bold text-indigo-600 dark:text-indigo-300"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={() => pick(new Date())} disabled={isDisabledDay(new Date())} className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline disabled:opacity-40">Hari ini</button>
            {!required && selected && (
              <button type="button" onClick={() => { commit(""); setOpen(false); }} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-500"><X className="w-3 h-3" />Hapus</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
