import React from "react";

export const PanelCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-5">
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400 opacity-80" />
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-1.5 h-5 w-1 shrink-0 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
      <div className="min-w-0">
        <h3 className="font-bold text-slate-900 dark:text-white text-base">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {children}
  </div>
);
