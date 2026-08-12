import React, { useMemo, useState } from "react";
import { ArrowLeftRight, Ruler } from "lucide-react";
import { Select, Input } from "@/components/ui/primitives";

type UnitDef = { id: string; label: string; toBase: number }; // toBase: multiply value by this to get base unit
type UnitCategory = { id: string; label: string; baseLabel: string; units: UnitDef[]; offset?: boolean };

const CATEGORIES: UnitCategory[] = [
  {
    id: "panjang",
    label: "Panjang",
    baseLabel: "meter",
    units: [
      { id: "mm", label: "Milimeter (mm)", toBase: 0.001 },
      { id: "cm", label: "Sentimeter (cm)", toBase: 0.01 },
      { id: "m", label: "Meter (m)", toBase: 1 },
      { id: "km", label: "Kilometer (km)", toBase: 1000 },
      { id: "in", label: "Inci (in)", toBase: 0.0254 },
      { id: "ft", label: "Kaki (ft)", toBase: 0.3048 },
      { id: "yd", label: "Yard (yd)", toBase: 0.9144 },
      { id: "mi", label: "Mil (mi)", toBase: 1609.344 },
    ],
  },
  {
    id: "berat",
    label: "Berat",
    baseLabel: "gram",
    units: [
      { id: "mg", label: "Miligram (mg)", toBase: 0.001 },
      { id: "g", label: "Gram (g)", toBase: 1 },
      { id: "kg", label: "Kilogram (kg)", toBase: 1000 },
      { id: "ton", label: "Ton", toBase: 1_000_000 },
      { id: "oz", label: "Ons/Ounce (oz)", toBase: 28.3495 },
      { id: "lb", label: "Pon (lb)", toBase: 453.592 },
    ],
  },
  {
    id: "suhu",
    label: "Suhu",
    baseLabel: "celsius",
    offset: true,
    units: [
      { id: "c", label: "Celsius (°C)", toBase: 1 },
      { id: "f", label: "Fahrenheit (°F)", toBase: 1 },
      { id: "k", label: "Kelvin (K)", toBase: 1 },
    ],
  },
  {
    id: "volume",
    label: "Volume",
    baseLabel: "liter",
    units: [
      { id: "ml", label: "Mililiter (ml)", toBase: 0.001 },
      { id: "l", label: "Liter (l)", toBase: 1 },
      { id: "m3", label: "Meter Kubik (m³)", toBase: 1000 },
      { id: "galus", label: "Galon US", toBase: 3.78541 },
      { id: "cup", label: "Cup (AS)", toBase: 0.24 },
    ],
  },
  {
    id: "luas",
    label: "Luas",
    baseLabel: "m²",
    units: [
      { id: "m2", label: "Meter Persegi (m²)", toBase: 1 },
      { id: "km2", label: "Kilometer Persegi (km²)", toBase: 1_000_000 },
      { id: "ha", label: "Hektar (ha)", toBase: 10_000 },
      { id: "are", label: "Are", toBase: 100 },
      { id: "ft2", label: "Kaki Persegi (ft²)", toBase: 0.092903 },
      { id: "acre", label: "Acre", toBase: 4046.86 },
    ],
  },
  {
    id: "kecepatan",
    label: "Kecepatan",
    baseLabel: "m/s",
    units: [
      { id: "ms", label: "Meter/detik (m/s)", toBase: 1 },
      { id: "kmh", label: "Kilometer/jam (km/j)", toBase: 0.277778 },
      { id: "mph", label: "Mil/jam (mph)", toBase: 0.44704 },
      { id: "knot", label: "Knot", toBase: 0.514444 },
    ],
  },
  {
    id: "data",
    label: "Data Digital",
    baseLabel: "byte",
    units: [
      { id: "bit", label: "Bit", toBase: 0.125 },
      { id: "byte", label: "Byte (B)", toBase: 1 },
      { id: "kb", label: "Kilobyte (KB)", toBase: 1024 },
      { id: "mb", label: "Megabyte (MB)", toBase: 1024 ** 2 },
      { id: "gb", label: "Gigabyte (GB)", toBase: 1024 ** 3 },
      { id: "tb", label: "Terabyte (TB)", toBase: 1024 ** 4 },
    ],
  },
];

function celsiusToUnit(c: number, unit: string): number {
  if (unit === "c") return c;
  if (unit === "f") return (c * 9) / 5 + 32;
  return c + 273.15; // kelvin
}
function unitToCelsius(v: number, unit: string): number {
  if (unit === "c") return v;
  if (unit === "f") return ((v - 32) * 5) / 9;
  return v - 273.15; // kelvin
}

function formatResult(n: number): string {
  if (!isFinite(n)) return "-";
  if (Math.abs(n) >= 1e9 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(4);
  const rounded = Math.round(n * 1e6) / 1e6;
  return rounded.toString();
}

export const CalcUnit: React.FC = () => {
  const [categoryId, setCategoryId] = useState("panjang");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("km");
  const [value, setValue] = useState("1");

  const category = useMemo(() => CATEGORIES.find((c) => c.id === categoryId) ?? CATEGORIES[0], [categoryId]);

  const changeCategory = (id: string) => {
    const cat = CATEGORIES.find((c) => c.id === id);
    if (!cat) return;
    setCategoryId(id);
    setFromUnit(cat.units[0].id);
    setToUnit(cat.units[1]?.id ?? cat.units[0].id);
  };

  const result = useMemo(() => {
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    if (category.offset) {
      const celsius = unitToCelsius(num, fromUnit);
      return celsiusToUnit(celsius, toUnit);
    }
    const from = category.units.find((u) => u.id === fromUnit);
    const to = category.units.find((u) => u.id === toUnit);
    if (!from || !to) return null;
    const base = num * from.toBase;
    return base / to.toBase;
  }, [value, fromUnit, toUnit, category]);

  const swap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => changeCategory(c.id)}
            className={
              "px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all " +
              (categoryId === c.id
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300")
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <Input label="Nilai" value={value} onChange={(e) => setValue(e.target.value)} placeholder="1" />

      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
        <Select label="Dari" value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}>
          {category.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={swap}
          title="Tukar satuan"
          className="mb-0.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
        <Select label="Ke" value={toUnit} onChange={(e) => setToUnit(e.target.value)}>
          {category.units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 flex items-center gap-3">
        <Ruler className="w-5 h-5 text-indigo-500 shrink-0" />
        <div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Hasil</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 font-mono">{result === null ? "-" : formatResult(result)}</p>
        </div>
      </div>
    </div>
  );
};
