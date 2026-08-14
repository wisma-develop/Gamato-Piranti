import React, { useState } from "react";
import { Landmark } from "lucide-react";
import { sanitizeNumberString } from "@/utils/sanitize";
import { Input, Btn } from "@/components/ui/primitives";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatIDR } from "@/lib/utilityHelpers";

export const CalcLoan: React.FC = () => {
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("6");
  const [months, setMonths] = useState("12");
  const [output, setOutput] = useState("");

  const run = () => {
    const P = parseFloat(sanitizeNumberString(principal || ""));
    const r = parseFloat(sanitizeNumberString(rate || "")) / 100;
    const n = parseInt(sanitizeNumberString(months || ""), 10);
    if (isNaN(P) || P <= 0 || isNaN(r) || !n || n <= 0) {
      setOutput("Isi jumlah pinjaman, bunga, dan tenor dengan benar.");
      return;
    }
    const i = r / 12;
    const monthlyPayment = i > 0 ? (P * i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1) : P / n;
    const totalPayment = monthlyPayment * n;
    const totalInterest = totalPayment - P;
    setOutput(
      `Cicilan per bulan: ${formatIDR(monthlyPayment)}\nTotal seluruh pembayaran: ${formatIDR(totalPayment)}\nTotal bunga: ${formatIDR(totalInterest)}\n(Tenor ${n} bulan, bunga ${(r * 100).toFixed(2)}%/tahun, sistem anuitas)`
    );
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <MoneyInput label="Jumlah Pinjaman (Rp)" value={principal} onChange={setPrincipal} placeholder="20000000" prefix="Rp" />
        <Input label="Bunga per Tahun (%)" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="6" />
        <Input label="Tenor (bulan)" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="12" />
      </div>
      <Btn onClick={run} className="w-full gap-2">
        <Landmark className="w-4 h-4" />
        Hitung Cicilan
      </Btn>
      {output && (
        <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
          {output}
        </pre>
      )}
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Perhitungan anuitas standar sebagai gambaran umum — bank/lembaga pembiayaan bisa memakai skema bunga atau biaya tambahan lain.
      </p>
    </div>
  );
};
