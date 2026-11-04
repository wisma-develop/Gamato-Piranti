import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
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
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, tabs.length]);

  // Tab aktif selalu digulirkan ke area terlihat.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  const nudge = (dir: -1 | 1) => scroller.current?.scrollBy({ left: dir * 220, behavior: "smooth" });

  // Mode tampilan menyesuaikan jumlah tab supaya SEMUA tab selalu terlihat bila memungkinkan:
  //   ≤4 tab  → grid 2 kolom (tombol lebar, label penuh)
  //   5–8 tab → pil yang membungkus ke baris berikutnya
  //   >8 tab  → satu baris yang bisa digeser + menempel di atas (mis. Pembuat CV)
  const mode: "grid" | "wrap" | "scroll" = tabs.length <= 4 ? "grid" : tabs.length <= 8 ? "wrap" : "scroll";

  const tabBtn = (t: SettingsTabDef<T>, fill: boolean) => (
    <button
      key={t.id}
      type="button"
      role="tab"
      aria-selected={active === t.id}
      onClick={() => onChange(t.id)}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all",
        fill ? "justify-center text-center leading-tight" : "shrink-0 whitespace-nowrap",
        active === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      )}
    >
      {t.icon}
      <span>{t.label}</span>
    </button>
  );

  const shell = "relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur shadow-sm";

  if (mode !== "scroll") {
    return (
      <div className={shell}>
        <div role="tablist" className={cn("p-1.5 gap-1.5", mode === "grid" ? "grid grid-cols-2" : "flex flex-wrap")}>
          {tabs.map((t) => tabBtn(t, mode === "grid"))}
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-[4.25rem] z-20">
      <div className={shell}>
        {canLeft && (
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Geser tab ke kiri"
            className="absolute left-0 top-0 bottom-0 z-10 w-9 flex items-center justify-start pl-1.5 rounded-l-2xl bg-gradient-to-r from-white via-white/95 to-transparent dark:from-slate-900 dark:via-slate-900/95 text-slate-500 hover:text-indigo-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        <div
          ref={scroller}
          onScroll={measure}
          role="tablist"
          className="flex gap-1.5 overflow-x-auto p-1.5 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((t) => tabBtn(t, false))}
        </div>
        {canRight && (
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Geser tab ke kanan"
            className="absolute right-0 top-0 bottom-0 z-10 w-9 flex items-center justify-end pr-1.5 rounded-r-2xl bg-gradient-to-l from-white via-white/95 to-transparent dark:from-slate-900 dark:via-slate-900/95 text-slate-500 hover:text-indigo-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
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
