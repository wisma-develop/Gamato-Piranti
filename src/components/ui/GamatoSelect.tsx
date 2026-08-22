import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * GamatoSelect — engine dropdown kustom bermerek Gamato Piranti.
 * Menggantikan `<select>` bawaan browser (yang daftar pilihannya dirender OS,
 * tidak bisa di-style) dengan panel dropdown yang di-render sendiri.
 *
 * Drop-in compatible dengan API `<Select>` lama: masih menerima `<option value="...">Label</option>`
 * sebagai children, `value`/`onChange(e)` dengan bentuk event palsu `{ target: { value } }`,
 * jadi seluruh pemanggil lama tidak perlu diubah satu per satu.
 */
type OptionInfo = { value: string; label: React.ReactNode; disabled?: boolean };

function extractOptions(children: React.ReactNode): OptionInfo[] {
  const out: OptionInfo[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === "option") {
      const props = child.props as { value?: string | number; children?: React.ReactNode; disabled?: boolean };
      out.push({
        value: props.value !== undefined ? String(props.value) : "",
        label: props.children,
        disabled: props.disabled,
      });
    } else if (child.props?.children) {
      out.push(...extractOptions(child.props.children));
    }
  });
  return out;
}

export const GamatoSelect: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }
> = ({ label, className, id, children, value, defaultValue, onChange, disabled, ...rest }) => {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => (defaultValue !== undefined ? String(defaultValue) : ""));
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => extractOptions(children), [children]);
  const currentValue = isControlled ? String(value) : internalValue;
  const selected = options.find((o) => o.value === currentValue);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === currentValue);
      setHighlight(idx >= 0 ? idx : 0);
    }
  }, [open, currentValue, options]);

  const commit = (opt: OptionInfo) => {
    if (opt.disabled) return;
    if (!isControlled) setInternalValue(opt.value);
    onChange?.({ target: { value: opt.value } } as unknown as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (options[highlight]) commit(options[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      {label && <label htmlFor={id} className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-400 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
          open && "border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-500/10",
          className
        )}
        {...(rest as Record<string, unknown>)}
      >
        <span className={cn("truncate text-left", !selected && "text-slate-400 dark:text-slate-500")}>
          {selected ? selected.label : "Pilih..."}
        </span>
        <ChevronDown className={cn("w-4 h-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1.5"
        >
          {options.map((opt, i) => (
            <button
              key={opt.value + i}
              type="button"
              role="option"
              aria-selected={opt.value === currentValue}
              disabled={opt.disabled}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => commit(opt)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-3.5 py-2 text-sm text-left transition-colors",
                opt.disabled
                  ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                  : i === highlight
                  ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              )}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === currentValue && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
