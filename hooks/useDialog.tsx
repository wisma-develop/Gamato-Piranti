import React, { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, HelpCircle, Info, Loader2, X } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * Custom dialog system — replaces native window.alert / window.confirm / window.prompt
 * with an in-app modal that matches Gamato Piranti's visual language (rounded-2xl,
 * slate/indigo palette, dark mode aware, framer-motion transitions).
 *
 * Usage:
 *   const dialog = useDialog();
 *   await dialog.alert({ message: "Selesai!" });
 *   const ok = await dialog.confirm({ message: "Yakin hapus?" });
 *   const values = await dialog.form({ title: "Isi data", fields: [...] });
 */

export type DialogFieldType = "text" | "textarea" | "date" | "time" | "number" | "tel" | "email";

export interface DialogField {
  /** key used in the resulting values object */
  key: string;
  label: string;
  placeholder?: string;
  helper?: string;
  required?: boolean;
  type?: DialogFieldType;
  defaultValue?: string;
  maxLength?: number;
}

export interface AlertOptions {
  title?: string;
  message: string;
  tone?: "info" | "success" | "warning" | "danger";
  confirmLabel?: string;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface FormOptions {
  title: string;
  description?: string;
  fields: DialogField[];
  submitLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
}

type DialogRequest =
  | { kind: "alert"; options: AlertOptions; resolve: (v: void) => void }
  | { kind: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: "form"; options: FormOptions; resolve: (v: Record<string, string> | null) => void };

interface DialogContextValue {
  alert: (options: AlertOptions | string) => Promise<void>;
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  form: (options: FormOptions) => Promise<Record<string, string> | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within <DialogProvider>");
  return ctx;
}

const TONE_STYLES: Record<NonNullable<AlertOptions["tone"]>, { icon: React.ReactNode; ring: string; iconWrap: string }> = {
  info: { icon: <Info className="w-5 h-5" />, ring: "ring-indigo-100 dark:ring-indigo-500/20", iconWrap: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" },
  success: { icon: <CheckCircle2 className="w-5 h-5" />, ring: "ring-emerald-100 dark:ring-emerald-500/20", iconWrap: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
  warning: { icon: <AlertTriangle className="w-5 h-5" />, ring: "ring-amber-100 dark:ring-amber-500/20", iconWrap: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300" },
  danger: { icon: <AlertTriangle className="w-5 h-5" />, ring: "ring-red-100 dark:ring-red-500/20", iconWrap: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300" },
};

const fieldInputClass = "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-indigo-400 dark:focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10";

const Backdrop: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/50 dark:bg-slate-950/70 backdrop-blur-sm"
    onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    {children}
  </motion.div>
);

const ModalCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div
    initial={{ opacity: 0, y: 16, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 10, scale: 0.97 }}
    transition={{ duration: 0.16, ease: "easeOut" }}
    onMouseDown={(e) => e.stopPropagation()}
    className={cn(
      "w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl shadow-slate-900/20 border border-slate-100 dark:border-slate-800 overflow-hidden",
      className
    )}
  >
    {children}
  </motion.div>
);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const alert = useCallback((options: AlertOptions | string) => {
    const opts: AlertOptions = typeof options === "string" ? { message: options } : options;
    return new Promise<void>((resolve) => {
      setRequest({ kind: "alert", options: opts, resolve });
    });
  }, []);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts: ConfirmOptions = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setRequest({ kind: "confirm", options: opts, resolve });
    });
  }, []);

  const form = useCallback((options: FormOptions) => {
    const initial: Record<string, string> = {};
    options.fields.forEach((f) => { initial[f.key] = f.defaultValue ?? ""; });
    setFormValues(initial);
    setFormError(null);
    return new Promise<Record<string, string> | null>((resolve) => {
      setRequest({ kind: "form", options, resolve });
    });
  }, []);

  const closeWith = useCallback((result: any) => {
    setRequest((current) => {
      if (current) current.resolve(result);
      return null;
    });
  }, []);

  const handleFormSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!request || request.kind !== "form") return;
    const missing = request.options.fields.find((f) => f.required && !formValues[f.key]?.trim());
    if (missing) {
      setFormError(`"${missing.label}" wajib diisi.`);
      return;
    }
    setFormError(null);
    closeWith(formValues);
  }, [request, formValues, closeWith]);

  return (
    <DialogContext.Provider value={{ alert, confirm, form }}>
      {children}
      <AnimatePresence>
        {request && (
          <Backdrop onClose={() => closeWith(request.kind === "confirm" ? false : request.kind === "form" ? null : undefined)}>
            {request.kind === "alert" && (
              <ModalCard>
                <div className="p-6 space-y-4">
                  <div className="flex items-start gap-3.5">
                    <span className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ring-4", TONE_STYLES[request.options.tone ?? "info"].iconWrap, TONE_STYLES[request.options.tone ?? "info"].ring)}>
                      {TONE_STYLES[request.options.tone ?? "info"].icon}
                    </span>
                    <div className="flex-1 pt-1.5 min-w-0">
                      {request.options.title && <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">{request.options.title}</h3>}
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line break-words">{request.options.message}</p>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      autoFocus
                      onClick={() => closeWith(undefined)}
                      className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                    >
                      {request.options.confirmLabel ?? "Mengerti"}
                    </button>
                  </div>
                </div>
              </ModalCard>
            )}

            {request.kind === "confirm" && (
              <ModalCard>
                <div className="p-6 space-y-4">
                  <div className="flex items-start gap-3.5">
                    <span className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ring-4", request.options.danger ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 ring-red-100 dark:ring-red-500/20" : "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-indigo-100 dark:ring-indigo-500/20")}>
                      <HelpCircle className="w-5 h-5" />
                    </span>
                    <div className="flex-1 pt-1.5 min-w-0">
                      {request.options.title && <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">{request.options.title}</h3>}
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line break-words">{request.options.message}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2.5 pt-1">
                    <button
                      onClick={() => closeWith(false)}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                      {request.options.cancelLabel ?? "Batal"}
                    </button>
                    <button
                      autoFocus
                      onClick={() => closeWith(true)}
                      className={cn(
                        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all focus-visible:outline-none focus-visible:ring-2",
                        request.options.danger ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/40" : "bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 focus-visible:ring-indigo-500/40"
                      )}
                    >
                      {request.options.confirmLabel ?? "Ya, lanjutkan"}
                    </button>
                  </div>
                </div>
              </ModalCard>
            )}

            {request.kind === "form" && (
              <ModalCard>
                <form onSubmit={handleFormSubmit}>
                  <div className="flex items-start justify-between gap-3 px-6 pt-6">
                    <div className="flex items-start gap-3 min-w-0">
                      {request.options.icon && (
                        <span className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-4 ring-indigo-100 dark:ring-indigo-500/20">
                          {request.options.icon}
                        </span>
                      )}
                      <div className="min-w-0 pt-1">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">{request.options.title}</h3>
                        {request.options.description && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{request.options.description}</p>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => closeWith(null)}
                      className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      aria-label="Tutup"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
                    {request.options.fields.map((field, idx) => (
                      <div key={field.key}>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        {field.type === "textarea" ? (
                          <textarea
                            autoFocus={idx === 0}
                            rows={3}
                            className={cn(fieldInputClass, "resize-none")}
                            placeholder={field.placeholder}
                            maxLength={field.maxLength}
                            value={formValues[field.key] ?? ""}
                            onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          />
                        ) : (
                          <input
                            autoFocus={idx === 0}
                            type={field.type ?? "text"}
                            className={fieldInputClass}
                            placeholder={field.placeholder}
                            maxLength={field.maxLength}
                            value={formValues[field.key] ?? ""}
                            onChange={(e) => setFormValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          />
                        )}
                        {field.helper && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{field.helper}</p>}
                      </div>
                    ))}
                    {formError && (
                      <div className="flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {formError}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2.5 px-6 pb-6 pt-1">
                    <button
                      type="button"
                      onClick={() => closeWith(null)}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                      {request.options.cancelLabel ?? "Batal"}
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                    >
                      {request.options.submitLabel ?? "Terapkan"}
                    </button>
                  </div>
                </form>
              </ModalCard>
            )}
          </Backdrop>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
};

// Re-export a tiny loading spinner icon for consumers that want a busy state
// inside dialogs without importing lucide-react directly.
export const DialogSpinner: React.FC<{ className?: string }> = ({ className }) => (
  <Loader2 className={cn("w-4 h-4 animate-spin", className)} />
);
