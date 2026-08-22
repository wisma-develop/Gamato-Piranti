import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info as InfoIcon, AlertTriangle, X, Zap } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * GamatoToast — engine notifikasi toast global bermerek Gamato Piranti.
 * Melayang di pojok layar, auto-dismiss, dengan animasi masuk/keluar sendiri —
 * bukan `window.alert()` atau notifikasi bawaan browser.
 */
type ToastTone = "success" | "error" | "info" | "warning";
type ToastItem = { id: number; message: string; tone: ToastTone };

const TONE_META: Record<ToastTone, { icon: React.ReactNode; bar: string }> = {
  success: { icon: <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />, bar: "bg-green-500" },
  error: { icon: <XCircle className="w-5 h-5 text-red-500 shrink-0" />, bar: "bg-red-500" },
  warning: { icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />, bar: "bg-amber-500" },
  info: { icon: <InfoIcon className="w-5 h-5 text-indigo-500 shrink-0" />, bar: "bg-indigo-500" },
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fail safe di luar provider — tetap tidak crash, hanya no-op.
    return { showToast: () => {} };
  }
  return ctx;
}

export function GamatoToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setLeaving((s) => new Set(s).add(id));
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      setLeaving((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }, 180);
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, message, tone }].slice(-4));
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto relative overflow-hidden flex items-start gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl px-4 py-3.5",
              leaving.has(t.id) ? "animate-[gamatoToastOut_0.18s_ease-in_forwards]" : "animate-[gamatoToastIn_0.22s_ease-out]"
            )}
          >
            <span className={cn("absolute left-0 top-0 bottom-0 w-1", TONE_META[t.tone].bar)} />
            {TONE_META[t.tone].icon}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-1 mb-0.5">
                <Zap className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Gamato Piranti</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 break-words">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
