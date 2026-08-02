import React from "react";

export const PageShell: React.FC<{ badge: string; title: string; subtitle: string; children: React.ReactNode }> = ({ badge, title, subtitle, children }) => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
    <div className="space-y-1.5">
      <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">{badge}</span>
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-2xl">{subtitle}</p>
    </div>
    {children}
  </div>
);
