import { useState } from "react";
import { ShieldAlert, RefreshCw, ChevronDown, X } from "lucide-react";
import { cn } from "@/utils/cn";
import type { PermFailure } from "@/lib/permissions";

/**
 * GamatoPermissionNotice — banner galat izin bermerek Gamato Piranti.
 * Menampilkan penyebab (ditolak / perangkat tidak ada / sedang dipakai / HTTPS) + langkah
 * memulihkan izin sesuai browser, dan tombol "Coba lagi" bila masuk akal.
 */
export function GamatoPermissionNotice({
  failure,
  onRetry,
  onDismiss,
  className,
  variant = "surface",
}: {
  failure: PermFailure | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  /** "dark" untuk panel yang selalu gelap. */
  variant?: "surface" | "dark";
}) {
  const [showSteps, setShowSteps] = useState(false);
  if (!failure) return null;
  const dark = variant === "dark";
  return (
    <div
      role="alert"
      data-testid="gamato-permission-notice"
      data-code={failure.code}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm animate-[gamatoFadeIn_0.2s_ease-out]",
        dark
          ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
          : "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30",
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-bold leading-snug">{failure.title}</p>
          <p className="leading-relaxed opacity-90">{failure.message}</p>
          {failure.howTo.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowSteps((v) => !v)}
                aria-expanded={showSteps}
                className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 mt-1"
              >
                Cara mengaktifkan izin
                <ChevronDown className={cn("w-3 h-3 transition-transform", showSteps && "rotate-180")} />
              </button>
              {showSteps && (
                <ol className="mt-2 space-y-1 list-decimal pl-5 text-xs leading-relaxed opacity-95">
                  {failure.howTo.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              )}
            </div>
          )}
          {failure.retryable && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                "mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors",
                dark ? "border-amber-500/40 hover:bg-amber-500/15" : "border-amber-300 dark:border-amber-500/40 hover:bg-amber-100 dark:hover:bg-amber-500/15"
              )}
            >
              <RefreshCw className="w-3 h-3" /> Coba lagi
            </button>
          )}
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Tutup" className="p-1 rounded-md opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
