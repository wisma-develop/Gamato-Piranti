import React, { useLayoutEffect, useRef } from "react";
import { cn } from "@/utils/cn";
import { Label } from "@/components/ui/primitives";
import { extractDigits, formatThousands } from "@/lib/numberFormat";

interface MoneyInputProps {
  label?: string;
  /** Raw digits only (e.g. "1000000") — this is what gets passed back via onChange. */
  value: string;
  onChange: (rawDigits: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  /** Optional short prefix shown inside the field, e.g. "Rp". */
  prefix?: string;
  disabled?: boolean;
}

/**
 * A text input for large whole numbers (Rupiah amounts, quantities, etc.)
 * that auto-inserts "." as a thousands separator while the user types —
 * e.g. typing "1000000" renders as "1.000.000" — while keeping the cursor
 * exactly where the user expects it (the tricky part of any "format as you
 * type" input: naively re-rendering the formatted string resets the cursor
 * to the end, which makes editing the middle of a number infuriating).
 *
 * Only digits are ever accepted; decimals aren't supported here on purpose
 * — this component is for whole-number amounts (Rupiah, item quantities).
 * Fields that need decimals (percentages, unit-conversion values) should
 * keep using the plain <Input> component instead.
 */
export const MoneyInput: React.FC<MoneyInputProps> = ({ label, value, onChange, placeholder, id, className, prefix, disabled }) => {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);

  const displayValue = formatThousands(value);

  useLayoutEffect(() => {
    if (pendingCursor.current !== null && ref.current) {
      const pos = pendingCursor.current;
      ref.current.setSelectionRange(pos, pos);
      pendingCursor.current = null;
    }
  }, [displayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawInput = input.value;
    const cursorPos = input.selectionStart ?? rawInput.length;

    // How many digits sit before the cursor in what the user is currently
    // seeing — this count is what we preserve across reformatting.
    const digitsBeforeCursor = extractDigits(rawInput.slice(0, cursorPos)).length;

    const newDigits = extractDigits(rawInput);
    const newFormatted = formatThousands(newDigits);

    let newCursorPos = newFormatted.length;
    if (digitsBeforeCursor === 0) {
      newCursorPos = 0;
    } else {
      let seen = 0;
      for (let i = 0; i < newFormatted.length; i++) {
        if (/\d/.test(newFormatted[i])) {
          seen++;
          if (seen === digitsBeforeCursor) {
            newCursorPos = i + 1;
            break;
          }
        }
      }
    }

    pendingCursor.current = newCursorPos;
    onChange(newDigits);
  };

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500 pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-400 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-400",
            prefix && "pl-10",
            className
          )}
        />
      </div>
    </div>
  );
};
