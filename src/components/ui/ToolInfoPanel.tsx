import React from "react";
import { SectionBadge } from "./primitives";
import { GamatoInlineAlert } from "./GamatoInlineAlert";

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
  <div className="gp-spot [--spot:rgba(129,140,248,.14)] gp-noise relative overflow-hidden bg-slate-900 ring-1 ring-slate-800 dark:ring-slate-700 rounded-2xl p-5 text-white space-y-4 lg:sticky lg:top-24">
    <span aria-hidden="true" className="gp-orb pointer-events-none absolute -top-16 -right-16 h-44 w-44 rounded-full bg-indigo-500/25 gp-soft" />
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent" />
    <p className="relative text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Tentang Alat Ini</p>
    <div className="relative flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/30 text-indigo-300">{icon}</span>
      <div>
        <p className="font-bold text-white">{label}</p>
        <p className="text-xs text-slate-400 dark:text-slate-500">{desc}</p>
      </div>
    </div>
    <div className="relative border-t border-slate-800 pt-4 space-y-2 text-sm text-slate-300">
      {points.map((p, i) => (
        <p key={i}>• {p}</p>
      ))}
    </div>
    {info && <GamatoInlineAlert message={info} tone={infoTone} variant="dark" />}
    <div className="relative pt-2">
      <SectionBadge>{badgeText}</SectionBadge>
    </div>
  </div>
);
