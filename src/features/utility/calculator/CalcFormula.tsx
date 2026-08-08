import React, { useMemo, useState } from "react";
import { Sigma } from "lucide-react";
import { Input, Textarea, Btn } from "@/components/ui/primitives";
import { evaluateFormula, extractVariables } from "@/lib/formulaEvaluator";

const EXAMPLES = [
  { label: "Luas Persegi Panjang", code: "p * l" },
  { label: "Keliling Lingkaran", code: "2 * pi * r" },
  { label: "Kecepatan", code: "jarak / waktu" },
  { label: "Bunga Majemuk", code: "modal * (1 + bunga)^tahun" },
  { label: "Konversi Suhu C→F", code: "(celsius * 9/5) + 32" },
];

export const CalcFormula: React.FC = () => {
  const [formula, setFormula] = useState(EXAMPLES[0].code);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const variables = useMemo(() => {
    try {
      return extractVariables(formula);
    } catch {
      return [];
    }
  }, [formula]);

  const run = () => {
    setError(null);
    setResult(null);
    try {
      const vars: Record<string, number> = {};
      for (const v of variables) {
        const raw = values[v];
        const num = parseFloat(raw ?? "");
        if (raw === undefined || raw === "" || isNaN(num)) throw new Error(`Isi nilai untuk variabel "${v}".`);
        vars[v] = num;
      }
      const res = evaluateFormula(formula, vars);
      setResult(String(res));
    } catch (err: any) {
      setError(err?.message || "Rumus tidak valid.");
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <Textarea
        label="Rumus"
        rows={2}
        value={formula}
        onChange={(e) => {
          setFormula(e.target.value);
          setResult(null);
          setError(null);
        }}
        placeholder="contoh: p * l atau 2 * pi * r"
        className="font-mono text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => {
              setFormula(ex.code);
              setValues({});
              setResult(null);
              setError(null);
            }}
            className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {variables.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {variables.map((v) => (
            <Input
              key={v}
              label={`Nilai ${v}`}
              value={values[v] ?? ""}
              onChange={(e) => setValues((s) => ({ ...s, [v]: e.target.value }))}
              placeholder="0"
            />
          ))}
        </div>
      )}

      <Btn onClick={run} className="w-full gap-2">
        <Sigma className="w-4 h-4" />
        Hitung
      </Btn>

      {result !== null && (
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100">
          Hasil: <span className="font-bold">{result}</span>
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Operator yang didukung: + − * / ^ % dan kurung (). Fungsi: sqrt, abs, sin, cos, tan, log, ln, round, floor, ceil, min, max, pow. Konstanta: pi, e.
      </p>
    </div>
  );
};
