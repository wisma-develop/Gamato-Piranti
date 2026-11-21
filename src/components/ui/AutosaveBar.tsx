import React from "react";
import { CloudCheck, RotateCcw, Save, X, TriangleAlert } from "lucide-react";
import type { AutosaveApi } from "@/hooks/useAutosave";
import { useDialog } from "@/hooks/useDialog";
import { cn } from "@/utils/cn";
import { LOCALE, tr } from "@/i18n";

const fmt = (t: number) => new Date(t).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });

/**
 * Bilah status auto-save untuk alat penyunting: (1) banner "draf dipulihkan" setelah membuka ulang,
 * (2) penanda "Tersimpan otomatis · jam" dengan tombol "Mulai baru" yang menghapus draf lalu menyegarkan halaman.
 */
export const AutosaveBar: React.FC<{ autosave: AutosaveApi; className?: string; what?: string }> = ({ autosave, className, what = "pekerjaan" }) => {
  const dialog = useDialog();
  const { status, savedAt, restored, lean, dismissRestored, discard } = autosave;

  const startOver = async () => {
    const ok = await dialog.confirm({ title: tr("Mulai baru?"), message: tr("Draf {0} yang tersimpan di perangkat ini akan dihapus dan alat kembali ke pengaturan awal.", what), confirmLabel: tr("Hapus draf & mulai baru"), danger: true });
    if (!ok) return;
    discard();
    window.location.reload();
  };

  if (!restored && status === "idle") return null;

  return (
    <div className={cn("space-y-2", className)} data-testid="autosave-bar">
      {restored && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
          <span className="flex items-start gap-2"><Save className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{tr("Draf terakhir Anda dipulihkan otomatis. Perubahan tersimpan di perangkat ini.")}</span>
          <span className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={startOver} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20"><RotateCcw className="h-3 w-3" aria-hidden="true" />{tr("Mulai baru")}</button>
            <button type="button" onClick={dismissRestored} aria-label={tr("Tutup")} className="rounded-md p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/20"><X className="h-4 w-4" /></button>
          </span>
        </div>
      )}
      {status === "saved" && savedAt && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400" data-testid="autosave-status">
          <span className="inline-flex items-center gap-1.5 font-medium"><CloudCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />{tr("Tersimpan otomatis · {0}", fmt(savedAt))}{lean ? tr(" (tanpa gambar besar)") : ""}</span>
          <button type="button" onClick={startOver} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"><RotateCcw className="h-3 w-3" aria-hidden="true" />{tr("Mulai baru")}</button>
        </div>
      )}
      {(status === "too-big" || status === "unavailable") && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {status === "too-big" ? tr("Draf terlalu besar untuk disimpan otomatis (biasanya karena gambar besar). Unduh hasil kerja Anda secara berkala.") : tr("Penyimpanan otomatis tidak tersedia di browser ini (mode privat?). Unduh hasil kerja Anda secara berkala.")}
        </div>
      )}
    </div>
  );
};
