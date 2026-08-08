import React, { useState } from "react";
import { cn } from "@/utils/cn";

type Op = "+" | "-" | "×" | "÷";
type KeyVariant = "num" | "op" | "action" | "equals";

function compute(a: number, b: number, op: Op): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? NaN : a / b;
  }
}

function formatDisplay(n: number): string {
  if (!isFinite(n)) return "Error";
  if (Number.isInteger(n)) return n.toString();
  return parseFloat(n.toFixed(10)).toString();
}

export const CalcStandard: React.FC = () => {
  const [display, setDisplay] = useState("0");
  const [expr, setExpr] = useState("");
  const [stored, setStored] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Op | null>(null);
  const [waitingNext, setWaitingNext] = useState(false);

  const inputDigit = (d: string) => {
    if (waitingNext || display === "0") {
      setDisplay(d === "." ? "0." : d);
      setWaitingNext(false);
      return;
    }
    if (d === "." && display.includes(".")) return;
    if (display.replace("-", "").replace(".", "").length >= 15) return;
    setDisplay(display + d);
  };

  const clearAll = () => {
    setDisplay("0");
    setExpr("");
    setStored(null);
    setPendingOp(null);
    setWaitingNext(false);
  };

  const backspace = () => {
    if (waitingNext) return;
    setDisplay((d) => {
      if (d.length <= 1 || (d.length === 2 && d.startsWith("-"))) return "0";
      return d.slice(0, -1);
    });
  };

  const toggleSign = () => setDisplay((d) => (d === "0" ? d : d.startsWith("-") ? d.slice(1) : `-${d}`));

  const percent = () => setDisplay((d) => formatDisplay(parseFloat(d) / 100));

  const applyOp = (op: Op) => {
    const current = parseFloat(display);
    if (pendingOp && !waitingNext && stored !== null) {
      const result = compute(stored, current, pendingOp);
      setStored(result);
      setDisplay(formatDisplay(result));
      setExpr(`${formatDisplay(result)} ${op}`);
    } else {
      setStored(current);
      setExpr(`${formatDisplay(current)} ${op}`);
    }
    setPendingOp(op);
    setWaitingNext(true);
  };

  const equals = () => {
    if (pendingOp === null || stored === null) return;
    const current = parseFloat(display);
    const result = compute(stored, current, pendingOp);
    setExpr(`${formatDisplay(stored)} ${pendingOp} ${formatDisplay(current)} =`);
    setDisplay(formatDisplay(result));
    setStored(null);
    setPendingOp(null);
    setWaitingNext(true);
  };

  const KEYS: { label: string; onClick: () => void; variant: KeyVariant }[] = [
    { label: "C", onClick: clearAll, variant: "action" },
    { label: "±", onClick: toggleSign, variant: "action" },
    { label: "%", onClick: percent, variant: "action" },
    { label: "÷", onClick: () => applyOp("÷"), variant: "op" },
    { label: "7", onClick: () => inputDigit("7"), variant: "num" },
    { label: "8", onClick: () => inputDigit("8"), variant: "num" },
    { label: "9", onClick: () => inputDigit("9"), variant: "num" },
    { label: "×", onClick: () => applyOp("×"), variant: "op" },
    { label: "4", onClick: () => inputDigit("4"), variant: "num" },
    { label: "5", onClick: () => inputDigit("5"), variant: "num" },
    { label: "6", onClick: () => inputDigit("6"), variant: "num" },
    { label: "−", onClick: () => applyOp("-"), variant: "op" },
    { label: "1", onClick: () => inputDigit("1"), variant: "num" },
    { label: "2", onClick: () => inputDigit("2"), variant: "num" },
    { label: "3", onClick: () => inputDigit("3"), variant: "num" },
    { label: "+", onClick: () => applyOp("+"), variant: "op" },
    { label: "0", onClick: () => inputDigit("0"), variant: "num" },
    { label: ".", onClick: () => inputDigit("."), variant: "num" },
    { label: "⌫", onClick: backspace, variant: "action" },
    { label: "=", onClick: equals, variant: "equals" },
  ];

  return (
    <div className="max-w-xs mx-auto space-y-3">
      <div className="bg-slate-900 rounded-2xl px-5 py-4 text-right space-y-1">
        <p className="text-xs text-slate-500 h-4 truncate">{expr || "\u00A0"}</p>
        <p className="text-3xl font-bold text-white truncate tabular-nums">{display}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {KEYS.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={k.onClick}
            className={cn(
              "h-14 rounded-xl text-lg font-semibold transition-all active:scale-95",
              k.variant === "num" &&
                "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700",
              k.variant === "op" &&
                "bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-500/25",
              k.variant === "action" &&
                "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600",
              k.variant === "equals" && "bg-indigo-600 text-white hover:bg-indigo-700"
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
};
