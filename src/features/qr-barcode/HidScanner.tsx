import React, { useEffect, useRef, useState } from "react";
import { Barcode, Copy, Download, Trash2, Zap } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

interface ScanEntry {
  id: string;
  value: string;
  time: Date;
  msPerChar: number;
  duplicate: boolean;
}

export const HidScanner: React.FC = () => {
  const [value, setValue] = useState("");
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstKeyTime = useRef<number | null>(null);
  const lastValue = useRef<string>("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (firstKeyTime.current === null && e.key.length === 1) firstKeyTime.current = performance.now();
    if (e.key === "Enter") {
      e.preventDefault();
      commitScan();
    }
  };

  const commitScan = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const elapsed = firstKeyTime.current ? performance.now() - firstKeyTime.current : 0;
    const msPerChar = trimmed.length > 1 ? elapsed / (trimmed.length - 1) : 0;
    const duplicate = trimmed === lastValue.current;
    lastValue.current = trimmed;
    setEntries((prev) => [{ id: Math.random().toString(36).slice(2, 9), value: trimmed, time: new Date(), msPerChar, duplicate }, ...prev]);
    setValue("");
    firstKeyTime.current = null;
    inputRef.current?.focus();
  };

  const clearHistory = () => {
    setEntries([]);
    lastValue.current = "";
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(entries.map((e) => e.value).join("\n"));
    } catch {
      // clipboard unavailable — ignore silently
    }
  };

  const downloadCsv = () => {
    if (!entries.length) return;
    const header = "waktu,nilai,ms_per_karakter\n";
    const rows = entries.map((e) => `${e.time.toISOString()},"${e.value.replace(/"/g, '""')}",${e.msPerChar.toFixed(1)}`).join("\n");
    downloadBlob(new Blob([header + rows], { type: "text/csv;charset=utf-8" }), "gamato-hid-scan-log.csv");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Area Pindai</p>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => inputRef.current?.focus(), 150)}
            placeholder="Klik di sini lalu pindai barcode/QR dengan scanner HID kamu…"
            className="w-full rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/40 dark:bg-indigo-500/5 px-4 py-4 text-lg font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">Kolom ini harus tetap fokus (aktif) — scanner HID akan "mengetik" hasil pindaian lalu otomatis Enter.</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Riwayat Pindai ({entries.length})</p>
            <div className="flex gap-2">
              <button type="button" onClick={copyAll} disabled={!entries.length} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-40">
                <Copy className="w-3.5 h-3.5" /> Salin
              </button>
              <button type="button" onClick={downloadCsv} disabled={!entries.length} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-40">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button type="button" onClick={clearHistory} disabled={!entries.length} className="text-xs font-semibold text-red-500 flex items-center gap-1 disabled:opacity-40">
                <Trash2 className="w-3.5 h-3.5" /> Hapus
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {entries.length === 0 && <p className="px-5 py-6 text-sm text-slate-400 dark:text-slate-500 text-center">Belum ada hasil pindaian.</p>}
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                <Zap className={cn("w-4 h-4 shrink-0", e.msPerChar > 0 && e.msPerChar < 15 ? "text-green-500" : "text-slate-300 dark:text-slate-600")} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-slate-800 dark:text-slate-100 truncate">{e.value}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{e.time.toLocaleTimeString("id-ID")}</p>
                </div>
                {e.duplicate && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full shrink-0">DUPLIKAT</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <ToolInfoPanel
        icon={<Barcode className="w-5 h-5" />}
        label="Scan HID"
        desc="Input scanner barcode USB/BT"
        points={[
          "Scanner barcode/QR bertipe HID bekerja seperti keyboard — cukup fokus di kolom lalu pindai.",
          "Setiap hasil pindaian otomatis tercatat begitu scanner mengirim Enter.",
          "Ikon petir hijau menandakan input super cepat (khas scanner, bukan ketikan manual).",
        ]}
      />
    </div>
  );
};
