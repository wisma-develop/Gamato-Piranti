import React, { useState } from "react";
import { TrendingUp } from "lucide-react";
import { sanitizeNumberString } from "@/utils/sanitize";
import { Input, Select, Btn } from "@/components/ui/primitives";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PanelCard } from "@/components/ui/PanelCard";
import { formatIDR } from "@/lib/utilityHelpers";
import { tr } from "@/i18n";

export const UtilityInterestCalculator: React.FC = () => {
  const [princ, setPrinc] = useState("");
  const [rate, setRate] = useState("10");
  const [years, setYears] = useState("1");
  const [compoundPerYear, setCompoundPerYear] = useState(12);
  const [interestOutput, setInterestOutput] = useState("");

  const runInterestCalc = () => {
    const P = parseFloat(sanitizeNumberString(princ || ""));
    const r = parseFloat(sanitizeNumberString(rate || "")) / 100;
    const t = parseFloat(sanitizeNumberString(years || ""));
    if (isNaN(P) || isNaN(r) || isNaN(t)) {
      setInterestOutput(tr("Isi semua field dengan benar."));
      return;
    }
    const simple = P * r * t;
    const n = compoundPerYear > 0 ? compoundPerYear : 1;
    const comp = P * Math.pow(1 + r / n, n * t) - P;
    setInterestOutput(
      tr("Bunga sederhana: {0} | Akhir: {1}\nBunga majemuk ({2}x/tahun): {3} | Akhir: {4}", formatIDR(simple), formatIDR(P + simple), n, formatIDR(comp), formatIDR(P + comp))
    );
  };

  return (
    <PanelCard title={tr("Kalkulator Bunga")} subtitle={tr("Hitung bunga sederhana & majemuk")}>
      <div className="space-y-4 max-w-xl mx-auto w-full">
        <div className="grid grid-cols-2 gap-4">
          <MoneyInput label={tr("Pokok (Rp)")} value={princ} onChange={setPrinc} placeholder="5000000" prefix={tr("Rp")} />
          <Input label={tr("Bunga Tahunan (%)")} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="10" />
          <Input label={tr("Durasi (tahun)")} value={years} onChange={(e) => setYears(e.target.value)} placeholder="3" />
          <Select label={tr("Frekuensi Majemuk")} value={compoundPerYear} onChange={(e) => setCompoundPerYear(parseInt(e.target.value))}>
            <option value={1}>{tr("Tahunan (1x)")}</option>
            <option value={2}>{tr("Semesteran (2x)")}</option>
            <option value={4}>{tr("Kuartalan (4x)")}</option>
            <option value={12}>{tr("Bulanan (12x)")}</option>
          </Select>
        </div>
        <Btn onClick={runInterestCalc} className="w-full gap-2">
          <TrendingUp className="w-4 h-4" />{tr("Hitung Bunga")}
        </Btn>
        {interestOutput && (
          <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{interestOutput}</pre>
        )}
      </div>
    </PanelCard>
  );
};
