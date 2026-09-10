import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

export function CollapsibleSection({
  title,
  subtitle,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-indigo-500 dark:text-indigo-400 shrink-0">{icon}</span>}
          <div className="min-w-0">
            <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{title}</p>
            {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge && <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-full">{badge}</span>}
          <ChevronDown className={cn("w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>
      {open && <div className="px-5 pb-5 pt-1 space-y-5 border-t border-slate-100 dark:border-slate-800">{children}</div>}
    </div>
  );
}
