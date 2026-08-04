import React from "react";
import { cn } from "@/utils/cn";
import { SectionBadge } from "./primitives";

/**
 * Sticky side panel used by single-purpose tool pages (one PDF mode, one
 * Image mode, etc). Shows the active tool's icon/label/desc, a few bullet
 * tips, and the last run's result message — no sibling-mode switcher here,
 * each tool page is self-contained on purpose.
 */
export const ToolInfoPanel: React.FC<{
  icon: React.ReactNode;
  label: string;
  desc: string;
  points: string[];
  info?: string | null;
  infoTone?: "success" | "error";
  badgeText?: string;
}> = ({ icon, label, desc, points, info, infoTone = "success", badgeText = "Proses native di perangkatmu" }) => (
  <div className="bg-slate-900 dark:ring-1 dark:ring-slate-700 rounded-2xl p-5 text-white space-y-4 sticky top-24">
    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Tentang Alat Ini</p>
    <div className="flex items-center gap-3">
      <span className="text-indigo-400">{icon}</span>
      <div>
        <p className="font-bold text-white">{label}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{desc}</p>
      </div>
    </div>
    <div className="border-t border-slate-800 pt-4 space-y-2 text-sm text-slate-300">
      {points.map((p, i) => (
        <p key={i}>• {p}</p>
      ))}
    </div>
    {info && (
      <div
        className={cn(
          "rounded-xl px-4 py-3 text-sm font-medium border",
          infoTone === "success"
            ? "bg-green-500/10 text-green-400 border-green-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        )}
      >
        {info}
      </div>
    )}
    <div className="pt-2">
      <SectionBadge>{badgeText}</SectionBadge>
    </div>
  </div>
);
