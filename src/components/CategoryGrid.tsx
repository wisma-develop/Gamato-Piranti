import type { FC, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

export type CategoryItem = {
  name: string;
  desc: string;
  path: string;
  icon: ReactNode;
  badge?: string;
};

export type CategoryGroup = {
  section?: string;
  items: CategoryItem[];
};

/**
 * Landing/index grid for a main-menu category (Kode, Dokumen, Gambar,
 * Utilitas, Spesial). Every card links straight to one dedicated,
 * single-purpose tool page — this grid itself is the only place all the
 * sibling tools are listed together.
 *
 * Tata letak: flex-wrap + `justify-center` (lihat `.gp-cat-grid` di index.css) → baris terakhir yang tidak
 * penuh berada DI TENGAH, tidak lagi menempel kiri dengan ruang kosong di kanannya.
 */
export const CategoryGrid: FC<{ groups: CategoryGroup[] }> = ({ groups }) => (
  <div className="space-y-10">
    {groups.map((group, gi) => (
      <div key={group.section ?? gi} className="space-y-5">
        {group.section && (
          <div className="flex items-center gap-4" role="presentation">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-indigo-300/70 dark:to-indigo-500/30" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
              {group.section}
            </h2>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-indigo-300/70 dark:to-indigo-500/30" aria-hidden="true" />
          </div>
        )}
        <div className="gp-cat-grid">
          {group.items.map((item, i) => (
            <Link
              key={item.path}
              to={item.path}
              className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
            >
              <SpotlightCard
                spot="color-mix(in oklab, var(--color-indigo-500) 16%, transparent)"
                className="relative h-full overflow-hidden flex items-start gap-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-indigo-300 dark:group-hover:border-indigo-500/50 group-hover:shadow-xl group-hover:shadow-indigo-500/15 dark:group-hover:shadow-black/40"
              >
                <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 opacity-[0.07] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.22]" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400 transition-transform duration-300 group-hover:scale-x-100" />
                <div className="relative shrink-0 inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-100 dark:ring-indigo-500/20 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-indigo-500 group-hover:to-violet-600 group-hover:text-white group-hover:ring-transparent group-hover:shadow-lg group-hover:shadow-indigo-500/30 group-hover:scale-105 group-hover:-rotate-3">
                  {item.icon}
                </div>
                <div className="relative min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug transition-colors group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{item.name}</h3>
                    <ArrowUpRight className="w-4 h-4 mt-1 shrink-0 text-slate-300 dark:text-slate-600 transition-all group-hover:text-indigo-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                  </div>
                  <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  {item.badge && (
                    <span className="mt-2.5 inline-block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-100 dark:border-slate-700">{item.badge}</span>
                  )}
                </div>
                <span className="sr-only">{i + 1}</span>
              </SpotlightCard>
            </Link>
          ))}
        </div>
      </div>
    ))}
  </div>
);
