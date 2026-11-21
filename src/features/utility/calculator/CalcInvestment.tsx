import React, { useState } from "react";
import { PiggyBank } from "lucide-react";
import { sanitizeNumberString } from "@/utils/sanitize";
import { Input, Btn } from "@/components/ui/primitives";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatIDR } from "@/lib/utilityHelpers";
import { tr } from "@/i18n";

export const CalcInvestment: React.FC = () => {
  const [initial, setInitial] = useState("");
  const [monthly, setMonthly] = useState("");
  const [rate, setRate] = useState("8");
  const [years, setYears] = useState("5");
  const [output, setOutput] = useState("");

  const run = () => {
    const P0 = parseFloat(sanitizeNumberString(initial || "0")) || 0;
    const C = parseFloat(sanitizeNumberString(monthly || "0")) || 0;
    const r = parseFloat(sanitizeNumberString(rate || "")) / 100;
    const t = parseFloat(sanitizeNumberString(years || ""));
    if (isNaN(r) || isNaN(t) || t <= 0) {
      setOutput(tr("Isi tingkat imbal hasil dan durasi dengan benar."));
      return;
    }
    const n = Math.round(t * 12);
    const i = r / 12;
    const fvPrincipal = P0 * Math.pow(1 + i, n);
    const fvContrib = i > 0 ? C * ((Math.pow(1 + i, n) - 1) / i) : C * n;
    const fvTotal = fvPrincipal + fvContrib;
    const totalDeposited = P0 + C * n;
    const profit = fvTotal - totalDeposited;
    setOutput(
      tr("Total setoran: {0}\nEstimasi nilai akhir: {1}\nEstimasi keuntungan: {2}\n(Asumsi imbal hasil {3}%/tahun, majemuk bulanan, selama {4} tahun)", formatIDR(totalDeposited), formatIDR(fvTotal), formatIDR(profit), (r * 100).toFixed(2), t)
    );
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto w-full">
      <div className="grid grid-cols-2 gap-4">
        <MoneyInput label={tr("Modal Awal (Rp)")} value={initial} onChange={setInitial} placeholder="5000000" prefix={tr("Rp")} />
        <MoneyInput label={tr("Setoran Rutin / Bulan (Rp)")} value={monthly} onChange={setMonthly} placeholder="500000" prefix={tr("Rp")} />
        <Input label={tr("Estimasi Imbal Hasil / Tahun (%)")} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="8" />
        <Input label={tr("Durasi (tahun)")} value={years} onChange={(e) => setYears(e.target.value)} placeholder="5" />
      </div>
      <Btn onClick={run} className="w-full gap-2">
        <PiggyBank className="w-4 h-4" />
        {tr("Hitung Proyeksi")}
      </Btn>
      {output && (
        <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
          {output}
        </pre>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {tr("Perkiraan matematis, bukan jaminan hasil investasi — imbal hasil aktual bisa naik-turun sesuai kondisi pasar. Bukan nasihat keuangan.")}
      </p>
    </div>
  );
};
