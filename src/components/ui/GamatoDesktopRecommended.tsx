import React, { useState } from "react";
import { Monitor, X } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/utils/cn";

/**
 * GamatoDesktopRecommended — banner peringatan bermerek Gamato Piranti untuk fitur yang
 * secara pengalaman jauh lebih nyaman/optimal dikerjakan di layar besar (desktop/laptop).
 * Tidak memblokir penggunaan di HP — hanya memberi info, dan bisa ditutup oleh pengguna.
 */
export function GamatoDesktopRecommended({ toolName, className }: { toolName?: string; className?: string }) {
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState(false);

  if (!isMobile || dismissed) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3.5",
        className
      )}
    >
      <span className="shrink-0 w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
        <Monitor className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Lebih nyaman dibuka di desktop</p>
        <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-0.5 leading-relaxed">
          {toolName ? `${toolName} punya` : "Fitur ini punya"} kontrol & area kerja yang cukup detail — pengalaman terbaik ada di layar laptop/komputer. Tetap bisa dipakai di HP, tapi mungkin terasa sempit.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Tutup peringatan"
        className="shrink-0 p-1 rounded-lg text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
