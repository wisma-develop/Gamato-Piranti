import React, { useState } from "react";
import { Calculator, Receipt, TrendingUp, PiggyBank, Landmark, Sigma, Boxes, Ruler } from "lucide-react";
import { cn } from "@/utils/cn";
import { PanelCard } from "@/components/ui/PanelCard";
import { CalcStandard } from "./CalcStandard";
import { CalcTax } from "./CalcTax";
import { CalcInterest } from "./CalcInterest";
import { CalcInvestment } from "./CalcInvestment";
import { CalcLoan } from "./CalcLoan";
import { CalcFormula } from "./CalcFormula";
import { CalcHpp } from "./CalcHpp";
import { CalcUnit } from "./CalcUnit";
import { tr } from "@/i18n";

type CalcId = "standar" | "pajak" | "bunga" | "investasi" | "cicilan" | "rumus" | "hpp" | "satuan";

const CALCULATORS: { id: CalcId; label: string; icon: React.ReactNode; title: string; subtitle: string }[] = [
  { id: "standar", label: tr("Standar"), icon: <Calculator className="w-4 h-4" />, title: tr("Kalkulator Standar"), subtitle: tr("Kalkulator harian — tambah, kurang, kali, bagi.") },
  { id: "pajak", label: tr("Pajak"), icon: <Receipt className="w-4 h-4" />, title: tr("Kalkulator Pajak"), subtitle: tr("Hitung PPN eksklusif atau inklusif.") },
  { id: "bunga", label: tr("Bunga"), icon: <TrendingUp className="w-4 h-4" />, title: tr("Kalkulator Bunga"), subtitle: tr("Bunga sederhana & majemuk.") },
  { id: "investasi", label: tr("Investasi"), icon: <PiggyBank className="w-4 h-4" />, title: tr("Kalkulator Investasi"), subtitle: tr("Proyeksi nilai investasi dengan setoran rutin bulanan.") },
  { id: "cicilan", label: tr("Cicilan / Hutang"), icon: <Landmark className="w-4 h-4" />, title: tr("Kalkulator Cicilan & Hutang"), subtitle: tr("Cicilan bulanan pinjaman sistem anuitas.") },
  { id: "rumus", label: tr("Rumus"), icon: <Sigma className="w-4 h-4" />, title: tr("Kalkulator Rumus"), subtitle: tr("Hitung rumus custom dengan variabel bebas.") },
  { id: "hpp", label: tr("HPP / COGS"), icon: <Boxes className="w-4 h-4" />, title: tr("Kalkulator HPP / COGS"), subtitle: tr("Harga Pokok Penjualan — usaha dagang & manufaktur.") },
  { id: "satuan", label: tr("Konversi Satuan"), icon: <Ruler className="w-4 h-4" />, title: tr("Konversi Satuan"), subtitle: tr("Panjang, berat, suhu, volume, luas, kecepatan, data digital.") },
];

export const CalculatorHub: React.FC = () => {
  const [active, setActive] = useState<CalcId>("standar");
  const current = CALCULATORS.find((c) => c.id === active) ?? CALCULATORS[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-center gap-2">
        {CALCULATORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
              active === c.id
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            {c.icon}
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <PanelCard title={current.title} subtitle={current.subtitle}>
        {active === "standar" && <CalcStandard />}
        {active === "pajak" && <CalcTax />}
        {active === "bunga" && <CalcInterest />}
        {active === "investasi" && <CalcInvestment />}
        {active === "cicilan" && <CalcLoan />}
        {active === "rumus" && <CalcFormula />}
        {active === "hpp" && <CalcHpp />}
        {active === "satuan" && <CalcUnit />}
      </PanelCard>
    </div>
  );
};
