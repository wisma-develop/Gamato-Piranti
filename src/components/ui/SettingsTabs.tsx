import React from "react";
import { ChevronRight, Lightbulb } from "lucide-react";
import { cn } from "@/utils/cn";

export interface SettingsTabDef<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

/**
 * SettingsTabBar — baris tombol sub-kartu pengaturan, mengikuti pola yang
 * sudah dipakai di Pembuat CV. Dipakai di Invoice, Kwitansi, Struk,
 * Sertifikat & Piagam, dan Kartu Nama supaya panel pengaturan kiri tidak
 * jadi satu tumpukan panjang yang harus di-scroll — tiap kelompok
 * pengaturan jadi satu tab tersendiri.
 */
export function SettingsTabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: SettingsTabDef<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
              active === t.id
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 px-0.5">
        <Lightbulb className="w-3 h-3 shrink-0" />
        Klik salah satu tombol di atas untuk berpindah bagian pengaturan — semua isian tersimpan otomatis.
      </p>
    </div>
  );
}

/**
 * NextTabHint — kartu ajakan di bagian bawah tiap panel yang menunjuk ke
 * tab pengaturan berikutnya, supaya alur pengisian tetap jelas walau tiap
 * bagian kini terpisah per tab (bukan satu tumpukan panjang).
 */
export function NextTabHint<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: SettingsTabDef<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  if (tabs.length <= 1) return null;
  const idx = tabs.findIndex((t) => t.id === active);
  if (idx === -1) return null;
  const next = tabs[(idx + 1) % tabs.length];
  const isLast = idx === tabs.length - 1;

  return (
    <button
      type="button"
      onClick={() => onChange(next.id)}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-500/5 px-4 py-3 text-left transition-colors hover:bg-indigo-100/70 dark:hover:bg-indigo-500/10"
    >
      <span className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
        <Lightbulb className="w-3.5 h-3.5 shrink-0" />
        <span>
          {isLast ? "Kembali ke bagian" : "Pengaturan selanjutnya:"}{" "}
          <span className="font-bold text-slate-800 dark:text-slate-100">{next.label}</span> — tersedia di tombol tab
          di atas.
        </span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-indigo-500" />
    </button>
  );
}
