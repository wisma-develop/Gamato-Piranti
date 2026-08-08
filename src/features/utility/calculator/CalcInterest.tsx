import React, { useState } from "react";
import { TrendingUp } from "lucide-react";
import { sanitizeNumberString } from "@/utils/sanitize";
import { Input, Select, Btn } from "@/components/ui/primitives";
import { formatIDR } from "@/lib/utilityHelpers";

export const CalcInterest: React.FC = () => {
  const [princ, setPrinc] = useState("");
  const [rate, setRate] = useState("10");
  const [years, setYears] = useState("1");
  const [compoundPerYear, setCompoundPerYear] = useState(12);
  const [output, setOutput] = useState("");

  const run = () => {
    const P = parseFloat(sanitizeNumberString(princ || ""));
    const r = parseFloat(sanitizeNumberString(rate || "")) / 100;
    const t = parseFloat(sanitizeNumberString(years || ""));
    if (isNaN(P) || isNaN(r) || isNaN(t)) {
      setOutput("Isi semua field dengan benar.");
      return;
    }
    const simple = P * r * t;
    const n = compoundPerYear > 0 ? compoundPerYear : 1;
    const comp = P * Math.pow(1 + r / n, n * t) - P;
    setOutput(
      `Bunga sederhana: ${formatIDR(simple)} | Akhir: ${formatIDR(P + simple)}\nBunga majemuk (${n}x/tahun): ${formatIDR(comp)} | Akhir: ${formatIDR(P + comp)}`
    );
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Pokok (Rp)" value={princ} onChange={(e) => setPrinc(e.target.value)} placeholder="5000000" />
        <Input label="Bunga Tahunan (%)" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="10" />
        <Input label="Durasi (tahun)" value={years} onChange={(e) => setYears(e.target.value)} placeholder="3" />
        <Select label="Frekuensi Majemuk" value={compoundPerYear} onChange={(e) => setCompoundPerYear(parseInt(e.target.value))}>
          <option value={1}>Tahunan (1x)</option>
          <option value={2}>Semesteran (2x)</option>
          <option value={4}>Kuartalan (4x)</option>
          <option value={12}>Bulanan (12x)</option>
        </Select>
      </div>
      <Btn onClick={run} className="w-full gap-2">
        <TrendingUp className="w-4 h-4" />
        Hitung Bunga
      </Btn>
      {output && (
        <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </div>
  );
};
