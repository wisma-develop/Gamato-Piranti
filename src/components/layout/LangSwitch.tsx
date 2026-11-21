import { lang, setLang, tr, type Lang } from "@/i18n";

const OPTIONS: ReadonlyArray<{ code: Lang; label: string; full: string }> = [
  { code: "id", label: "ID", full: "ID, Bahasa Indonesia" },
  { code: "en", label: "EN", full: "EN, English" },
];

/**
 * Pemilih bahasa ID / EN (segmented control). Mengganti bahasa memuat ulang halaman
 * supaya seluruh teks — termasuk menu & template — memakai bahasa yang dipilih.
 */
export default function LangSwitch({ className = "" }: { className?: string }) {
  return (
    <div
      role="group"
      aria-label={tr("Pilih bahasa")}
      data-testid="lang-switch"
      className={`inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800 ${className}`}
    >
      {OPTIONS.map((o) => {
        const active = o.code === lang;
        return (
          <button
            key={o.code}
            type="button"
            lang={o.code}
            aria-pressed={active}
            aria-label={o.full}
            title={o.full}
            data-testid={`lang-${o.code}`}
            onClick={() => setLang(o.code)}
            className={`h-7 min-w-8 rounded-full px-2 text-[11px] font-bold tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 ${
              active
                ? "bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
