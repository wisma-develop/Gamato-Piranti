import React from "react";

export const PolicySection: React.FC<{ num: string; title: string; children: React.ReactNode }> = ({ num, title, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
    <div className="flex items-center gap-3">
      <span className="flex-shrink-0 w-8 h-8 rounded-xl bg-slate-900 text-white text-sm font-bold flex items-center justify-center">{num}</span>
      <h3 className="font-bold text-slate-900 text-base">{title}</h3>
    </div>
    <div className="text-sm leading-relaxed text-slate-600 pl-11">{children}</div>
  </div>
);
