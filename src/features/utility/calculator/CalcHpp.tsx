import React, { useState } from "react";
import { Boxes } from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeNumberString } from "@/utils/sanitize";
import { Label, Input, Btn } from "@/components/ui/primitives";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { formatIDR } from "@/lib/utilityHelpers";
import { tr } from "@/i18n";

type HppMode = "dagang" | "manufaktur";

export const CalcHpp: React.FC = () => {
  const [mode, setMode] = useState<HppMode>("dagang");

  const [persAwal, setPersAwal] = useState("");
  const [pembelian, setPembelian] = useState("");
  const [persAkhir, setPersAkhir] = useState("");

  const [bahanBaku, setBahanBaku] = useState("");
  const [tenagaKerja, setTenagaKerja] = useState("");
  const [overhead, setOverhead] = useState("");
  const [bdpAwal, setBdpAwal] = useState("");
  const [bdpAkhir, setBdpAkhir] = useState("");

  const [output, setOutput] = useState("");

  const [hppUnit, setHppUnit] = useState("");
  const [marginPct, setMarginPct] = useState("30");
  const [hargaJualOutput, setHargaJualOutput] = useState("");

  const n = (v: string) => parseFloat(sanitizeNumberString(v || "0")) || 0;

  const runDagang = () => {
    const awal = n(persAwal);
    const beli = n(pembelian);
    const akhir = n(persAkhir);
    const hpp = awal + beli - akhir;
    setOutput(
      tr("Persediaan Awal: {0}\n+ Pembelian Bersih: {1}\n− Persediaan Akhir: {2}\n= HPP (COGS): {3}", formatIDR(awal), formatIDR(beli), formatIDR(akhir), formatIDR(hpp))
    );
  };

  const runManufaktur = () => {
    const bb = n(bahanBaku);
    const tk = n(tenagaKerja);
    const oh = n(overhead);
    const bdpA = n(bdpAwal);
    const bdpZ = n(bdpAkhir);
    const totalProduksi = bb + tk + oh;
    const hppProduksi = totalProduksi + bdpA - bdpZ;
    setOutput(
      tr("Bahan Baku: {0}\n+ Tenaga Kerja Langsung: {1}\n+ Overhead Pabrik: {2}\n= Total Biaya Produksi: {3}\n+ Barang Dalam Proses Awal: {4}\n− Barang Dalam Proses Akhir: {5}\n= HPP (Harga Pokok Produksi): {6}", formatIDR(bb), formatIDR(tk), formatIDR(oh), formatIDR(totalProduksi), formatIDR(bdpA), formatIDR(bdpZ), formatIDR(hppProduksi))
    );
  };

  const runMargin = () => {
    const hpp = n(hppUnit);
    const margin = n(marginPct);
    if (hpp <= 0) {
      setHargaJualOutput(tr("Isi HPP per unit terlebih dahulu."));
      return;
    }
    if (margin >= 100) {
      setHargaJualOutput(tr("Margin harus di bawah 100%."));
      return;
    }
    const hargaJual = hpp / (1 - margin / 100);
    const labaPerUnit = hargaJual - hpp;
    setHargaJualOutput(tr("Harga Jual Disarankan: {0}\nLaba per Unit: {1}\nMargin: {2}% dari harga jual", formatIDR(hargaJual), formatIDR(labaPerUnit), margin));
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto w-full">
      <div>
        <Label>{tr("Jenis Usaha")}</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {(
            [
              ["dagang", tr("Dagang / Retail")],
              ["manufaktur", tr("Manufaktur / Produksi")],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setMode(v);
                setOutput("");
              }}
              className={cn(
                "py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                mode === v
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {mode === "dagang" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <MoneyInput label={tr("Persediaan Awal (Rp)")} value={persAwal} onChange={setPersAwal} placeholder="0" prefix={tr("Rp")} />
            <MoneyInput label={tr("Pembelian Bersih (Rp)")} value={pembelian} onChange={setPembelian} placeholder="0" prefix={tr("Rp")} />
            <MoneyInput label={tr("Persediaan Akhir (Rp)")} value={persAkhir} onChange={setPersAkhir} placeholder="0" prefix={tr("Rp")} />
          </div>
          <Btn onClick={runDagang} className="w-full gap-2">
            <Boxes className="w-4 h-4" />
            {tr("Hitung HPP")}
          </Btn>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <MoneyInput label={tr("Bahan Baku (Rp)")} value={bahanBaku} onChange={setBahanBaku} placeholder="0" prefix={tr("Rp")} />
            <MoneyInput label={tr("Tenaga Kerja (Rp)")} value={tenagaKerja} onChange={setTenagaKerja} placeholder="0" prefix={tr("Rp")} />
            <MoneyInput label={tr("Overhead (Rp)")} value={overhead} onChange={setOverhead} placeholder="0" prefix={tr("Rp")} />
            <MoneyInput label={tr("BDP Awal (Rp)")} value={bdpAwal} onChange={setBdpAwal} placeholder="0" prefix={tr("Rp")} />
            <MoneyInput label={tr("BDP Akhir (Rp)")} value={bdpAkhir} onChange={setBdpAkhir} placeholder="0" prefix={tr("Rp")} />
          </div>
          <Btn onClick={runManufaktur} className="w-full gap-2">
            <Boxes className="w-4 h-4" />
            {tr("Hitung HPP Produksi")}
          </Btn>
        </div>
      )}

      {output && (
        <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
          {output}
        </pre>
      )}

      <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{tr("Bonus: Harga Jual dari Margin")}</p>
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput label={tr("HPP per Unit (Rp)")} value={hppUnit} onChange={setHppUnit} placeholder="10000" prefix={tr("Rp")} />
          <Input label={tr("Target Margin (%)")} value={marginPct} onChange={(e) => setMarginPct(e.target.value)} placeholder="30" />
        </div>
        <Btn onClick={runMargin} variant="secondary" className="w-full gap-2">
          {tr("Hitung Harga Jual")}
        </Btn>
        {hargaJualOutput && (
          <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
            {hargaJualOutput}
          </pre>
        )}
      </div>
    </div>
  );
};
