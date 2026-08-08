import React, { useState } from "react";
import { Boxes } from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeNumberString } from "@/utils/sanitize";
import { Label, Input, Btn } from "@/components/ui/primitives";
import { formatIDR } from "@/lib/utilityHelpers";

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
      `Persediaan Awal: ${formatIDR(awal)}\n+ Pembelian Bersih: ${formatIDR(beli)}\n− Persediaan Akhir: ${formatIDR(akhir)}\n= HPP (COGS): ${formatIDR(hpp)}`
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
      `Bahan Baku: ${formatIDR(bb)}\n+ Tenaga Kerja Langsung: ${formatIDR(tk)}\n+ Overhead Pabrik: ${formatIDR(oh)}\n= Total Biaya Produksi: ${formatIDR(totalProduksi)}\n+ Barang Dalam Proses Awal: ${formatIDR(bdpA)}\n− Barang Dalam Proses Akhir: ${formatIDR(bdpZ)}\n= HPP (Harga Pokok Produksi): ${formatIDR(hppProduksi)}`
    );
  };

  const runMargin = () => {
    const hpp = n(hppUnit);
    const margin = n(marginPct);
    if (hpp <= 0) {
      setHargaJualOutput("Isi HPP per unit terlebih dahulu.");
      return;
    }
    if (margin >= 100) {
      setHargaJualOutput("Margin harus di bawah 100%.");
      return;
    }
    const hargaJual = hpp / (1 - margin / 100);
    const labaPerUnit = hargaJual - hpp;
    setHargaJualOutput(`Harga Jual Disarankan: ${formatIDR(hargaJual)}\nLaba per Unit: ${formatIDR(labaPerUnit)}\nMargin: ${margin}% dari harga jual`);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <Label>Jenis Usaha</Label>
        <div className="grid grid-cols-2 gap-3 mt-2">
          {(
            [
              ["dagang", "Dagang / Retail"],
              ["manufaktur", "Manufaktur / Produksi"],
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
            <Input label="Persediaan Awal (Rp)" value={persAwal} onChange={(e) => setPersAwal(e.target.value)} placeholder="0" />
            <Input label="Pembelian Bersih (Rp)" value={pembelian} onChange={(e) => setPembelian(e.target.value)} placeholder="0" />
            <Input label="Persediaan Akhir (Rp)" value={persAkhir} onChange={(e) => setPersAkhir(e.target.value)} placeholder="0" />
          </div>
          <Btn onClick={runDagang} className="w-full gap-2">
            <Boxes className="w-4 h-4" />
            Hitung HPP
          </Btn>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Input label="Bahan Baku (Rp)" value={bahanBaku} onChange={(e) => setBahanBaku(e.target.value)} placeholder="0" />
            <Input label="Tenaga Kerja (Rp)" value={tenagaKerja} onChange={(e) => setTenagaKerja(e.target.value)} placeholder="0" />
            <Input label="Overhead (Rp)" value={overhead} onChange={(e) => setOverhead(e.target.value)} placeholder="0" />
            <Input label="BDP Awal (Rp)" value={bdpAwal} onChange={(e) => setBdpAwal(e.target.value)} placeholder="0" />
            <Input label="BDP Akhir (Rp)" value={bdpAkhir} onChange={(e) => setBdpAkhir(e.target.value)} placeholder="0" />
          </div>
          <Btn onClick={runManufaktur} className="w-full gap-2">
            <Boxes className="w-4 h-4" />
            Hitung HPP Produksi
          </Btn>
        </div>
      )}

      {output && (
        <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
          {output}
        </pre>
      )}

      <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Bonus: Harga Jual dari Margin</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="HPP per Unit (Rp)" value={hppUnit} onChange={(e) => setHppUnit(e.target.value)} placeholder="10000" />
          <Input label="Target Margin (%)" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} placeholder="30" />
        </div>
        <Btn onClick={runMargin} variant="secondary" className="w-full gap-2">
          Hitung Harga Jual
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
