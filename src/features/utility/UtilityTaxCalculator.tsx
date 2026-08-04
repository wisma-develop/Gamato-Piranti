import React, { useState } from "react";
import { Calculator } from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeNumberString } from "@/utils/sanitize";
import { Label, Input, Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";
import { formatIDR } from "@/lib/utilityHelpers";

export const UtilityTaxCalculator: React.FC = () => {
  const [taxBase, setTaxBase] = useState("");
  const [taxRate, setTaxRate] = useState("11");
  const [taxMode, setTaxMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [taxOutput, setTaxOutput] = useState("");

  const runTaxCalc = () => {
    const base = parseFloat(sanitizeNumberString(taxBase || ""));
    const r = parseFloat(sanitizeNumberString(taxRate || ""));
    if (isNaN(base) || isNaN(r)) {
      setTaxOutput("Masukkan nilai yang valid.");
      return;
    }
    const rp = r / 100;
    if (taxMode === "exclusive") {
      const pajak = base * rp;
      const total = base + pajak;
      setTaxOutput(`Dasar: ${formatIDR(base)}\nPajak (${r}%): ${formatIDR(pajak)}\nTotal: ${formatIDR(total)}`);
    } else {
      const pajak = base - base / (1 + rp);
      const dasar = base - pajak;
      setTaxOutput(`Total (inklusif): ${formatIDR(base)}\nTermasuk Pajak (${r}%): ${formatIDR(pajak)}\nDasar sebelum pajak: ${formatIDR(dasar)}`);
    }
  };

  return (
    <PanelCard title="Kalkulator Pajak" subtitle="Hitung PPN eksklusif atau inklusif">
      <div className="space-y-4 max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nilai Dasar (Rp)" value={taxBase} onChange={(e) => setTaxBase(e.target.value)} placeholder="1000000" />
          <Input label="Tarif Pajak (%)" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="11" />
        </div>
        <div>
          <Label>Mode Perhitungan</Label>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {([
              ["exclusive", "Eksklusif (belum termasuk pajak)"],
              ["inclusive", "Inklusif (sudah termasuk pajak)"],
            ] as const).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTaxMode(v)}
                className={cn(
                  "py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                  taxMode === v
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <Btn onClick={runTaxCalc} className="w-full gap-2">
          <Calculator className="w-4 h-4" />Hitung Pajak
        </Btn>
        {taxOutput && (
          <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{taxOutput}</pre>
        )}
      </div>
    </PanelCard>
  );
};
