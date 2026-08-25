import type { FC, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

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
 */
export const CategoryGrid: FC<{ groups: CategoryGroup[] }> = ({ groups }) => (
  <div className="space-y-10">
    {groups.map((group, gi) => (
      <div key={group.section ?? gi} className="space-y-4">
        {group.section && (
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            {group.section}
          </h2>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {group.items.map((item) => (
            <Link key={item.path} to={item.path} className="group block h-full">
              <div className="h-full bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/60 dark:hover:shadow-black/40 transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-start justify-between mb-4">
                  <div className="inline-flex p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                    {item.icon}
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-slate-100 dark:border-slate-700">
                      {item.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {item.name}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                <div className="mt-3 flex items-center text-indigo-600 dark:text-indigo-400 text-xs font-semibold gp-hover-reveal transition-opacity">
                  <span>Buka alat</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    ))}
  </div>
);
