import React, { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Textarea, Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";

export const UtilityStatistics: React.FC = () => {
  const [statsInput, setStatsInput] = useState("");
  const [statsOutput, setStatsOutput] = useState("");

  const runStats = () => {
    const nums = (statsInput || "")
      .split(/[^0-9.+\-eE]+/)
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    if (!nums.length) {
      setStatsOutput("Tidak ada angka valid.");
      return;
    }
    const sorted = [...nums].sort((a, b) => a - b);
    const count = nums.length;
    const sum = nums.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    const median = count % 2 === 1 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
    const stdev = Math.sqrt(nums.reduce((a, x) => a + Math.pow(x - mean, 2), 0) / count);
    setStatsOutput(
      `n = ${count}\nΣ = ${sum}\nMean = ${mean}\nMedian = ${median}\nMin = ${sorted[0]}\nMax = ${sorted[sorted.length - 1]}\nStdev = ${stdev.toFixed(4)}`
    );
  };

  return (
    <PanelCard title="Statistik Sederhana" subtitle="Mean, median, min, max, standar deviasi">
      <div className="space-y-4 max-w-lg">
        <Textarea label="Angka (pisahkan dengan spasi, koma, atau baris baru)" rows={5} value={statsInput} onChange={(e) => setStatsInput(e.target.value)} placeholder={"10 20 30 40 50\natau\n1, 2, 3, 4, 5"} />
        <Btn onClick={runStats} className="w-full gap-2">
          <BarChart3 className="w-4 h-4" />Analisis
        </Btn>
        {statsOutput && (
          <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap font-mono">{statsOutput}</pre>
        )}
      </div>
    </PanelCard>
  );
};
