import React from "react";
import { CheckCircle2, XCircle, Info as InfoIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/utils/cn";

type AlertTone = "success" | "error" | "info" | "warning";

const TONE_STYLES: Record<AlertTone, { wrap: string; icon: React.ReactNode }> = {
  success: {
    wrap: "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30",
    icon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
  },
  error: {
    wrap: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30",
    icon: <XCircle className="w-4 h-4 shrink-0" />,
  },
  warning: {
    wrap: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
    icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
  },
  info: {
    wrap: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30",
    icon: <InfoIcon className="w-4 h-4 shrink-0" />,
  },
};

/** Heuristik penentuan tone dari isi pesan, untuk kompatibilitas dengan kode lama yang hanya kirim string biasa. */
function inferTone(message: string): AlertTone {
  const m = message.toLowerCase();
  if (m.includes("gagal") || m.includes("error") || m.includes("tidak valid") || m.includes("tidak ditemukan")) return "error";
  if (m.includes("peringatan") || m.includes("hati-hati")) return "warning";
  return "success";
}

/**
 * GamatoInlineAlert — engine banner status kustom bermerek Gamato Piranti.
 * Pengganti drop-in untuk `<div>` status hasil proses (berhasil/gagal) yang generik —
 * kini dengan ikon, animasi masuk, dan branding konsisten di seluruh suite.
 */
export function GamatoInlineAlert({
  message,
  tone,
  className,
}: {
  message: React.ReactNode;
  tone?: AlertTone;
  className?: string;
}) {
  const resolvedTone = tone ?? (typeof message === "string" ? inferTone(message) : "info");
  const style = TONE_STYLES[resolvedTone];

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 text-sm rounded-xl px-4 py-3 border font-medium animate-[gamatoFadeIn_0.2s_ease-out]",
        style.wrap,
        className
      )}
    >
      {style.icon}
      <span className="flex-1 min-w-0">{message}</span>
    </div>
  );
}
