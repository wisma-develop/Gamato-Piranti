import React from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/utils/cn";

export const Label: React.FC<{ children: React.ReactNode; htmlFor?: string }> = ({ children, htmlFor }) => (
  <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700 mb-1.5">{children}</label>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className, id, ...props }) => (
  <div>
    {label && <Label htmlFor={id}>{label}</Label>}
    <input id={id} {...props} className={cn("w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-400", className)} />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, className, id, children, ...props }) => (
  <div>
    {label && <Label htmlFor={id}>{label}</Label>}
    <select id={id} {...props} className={cn("w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10", className)}>
      {children}
    </select>
  </div>
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }> = ({ label, className, id, ...props }) => (
  <div>
    {label && <Label htmlFor={id}>{label}</Label>}
    <textarea id={id} {...props} className={cn("w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10 resize-none", className)} />
  </div>
);

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }> = ({ variant = "primary", className, children, ...props }) => (
  <button {...props} className={cn(
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none",
    variant === "primary" && "bg-slate-900 text-white shadow-sm hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400",
    variant === "secondary" && "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:text-slate-300",
    variant === "danger" && "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100",
    variant === "ghost" && "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
    className
  )}>{children}</button>
);

export const SectionBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
    <ShieldCheck className="w-3 h-3" />
    {children}
  </span>
);
