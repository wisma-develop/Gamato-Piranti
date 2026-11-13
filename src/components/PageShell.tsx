import React, { cloneElement, isValidElement, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, Sparkles } from "lucide-react";
import { menuGroups } from "@/components/layout/Header";
import { themeForPath } from "@/lib/categoryTheme";
import { cn } from "@/utils/cn";

/**
 * Lebar halaman alat.
 *  - "wide"   (bawaan): penuh 7xl — editor/pratinjau dua kolom.
 *  - "medium": 4xl, diratakan tengah — kalkulator/hub bertab.
 *  - "narrow": 2xl, diratakan tengah — formulir pendek (pajak, bunga, statistik, alias email …).
 * Banner & isi memakai lebar yang sama sehingga seluruh halaman satu poros di tengah, bukan menempel kiri.
 */
export type PageWidth = "wide" | "medium" | "narrow";

const WIDTH_CLASS: Record<PageWidth, string> = {
  wide: "max-w-7xl",
  medium: "max-w-4xl",
  narrow: "max-w-2xl",
};

/** Ganti kelas ikon menu (w-4 h-4 + warna kategori) dengan ukuran/warna yang kita mau. */
function restyleIcon(node: React.ReactNode, className: string): React.ReactNode {
  return isValidElement<{ className?: string }>(node) ? cloneElement(node, { className }) : node;
}

export const PageShell: React.FC<{
  badge: string;
  title: string;
  subtitle: string;
  width?: PageWidth;
  children: React.ReactNode;
}> = ({ badge, title, subtitle, width = "wide", children }) => {
  const { pathname } = useLocation();
  const theme = themeForPath(pathname);
  const group = useMemo(() => (theme ? menuGroups.find((g) => g.id === theme) : undefined), [theme]);
  const isCategoryIndex = !!group && pathname.replace(/\/+$/, "") === group.rootPath;
  const current = group?.items.find((i) => i.path === pathname);
  const bannerIcon = restyleIcon(current?.icon ?? group?.icon, "w-7 h-7 sm:w-8 sm:h-8");

  // Pengalih alat: hanya di halaman alat (bukan indeks kategori) dan bila kategori punya >1 alat.
  const showSwitcher = !!group && !isCategoryIndex && group.items.length > 1;
  const stripRef = useRef<HTMLDivElement>(null);

  // Gulirkan chip aktif ke tengah deretan — hanya menggeser deretan itu, TIDAK menggulir halaman.
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !active) return;
    const target = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: "auto" });
  }, [pathname, showSwitcher]);

  return (
    <div className={cn("mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6", WIDTH_CLASS[width])}>
      <section
        data-testid="page-banner"
        className="gp-spot gp-noise relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/75 dark:bg-slate-900/60 shadow-[0_1px_0_rgba(255,255,255,.6)_inset,0_18px_40px_-28px_color-mix(in_oklab,var(--color-indigo-600)_55%,transparent)]"
      >
        {/* Latar: orb gradien + grid halus yang memudar — mengikuti warna tema kategori */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="gp-orb absolute -top-28 -left-12 h-72 w-72 rounded-full bg-indigo-500/20 dark:bg-indigo-500/25 gp-soft" />
          <div className="gp-orb absolute -bottom-32 right-[-4rem] h-72 w-96 rounded-full bg-violet-500/20 dark:bg-violet-500/20 gp-soft [animation-delay:-6s]" />
          <div className="absolute inset-0 opacity-[0.5] dark:opacity-[0.16] bg-[linear-gradient(to_right,color-mix(in_oklab,var(--color-indigo-300)_55%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklab,var(--color-indigo-300)_55%,transparent)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_80%_120%_at_85%_0%,#000_20%,transparent_70%)]" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
        </div>

        <div className="relative flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
          {bannerIcon && (
            <div className="gp-bob shrink-0 [animation-duration:7s]">
              <div
                aria-hidden="true"
                data-tilt="22"
                className="grid h-14 w-14 sm:h-[4.25rem] sm:w-[4.25rem] place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 ring-4 ring-white/70 dark:ring-white/5"
              >
                <span data-depth style={{ ["--z" as string]: "18px" }} className="text-white [&_svg]:text-white">{bannerIcon}</span>
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1.5">
            {isCategoryIndex || !group ? (
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-200/70 dark:ring-indigo-500/20 px-3 py-1 rounded-full">{badge}</span>
            ) : (
              <Link
                to={group.rootPath}
                className="inline-block text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 ring-1 ring-indigo-200/70 dark:ring-indigo-500/20 px-3 py-1 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
              >
                {badge}
              </Link>
            )}
            <h1 className="text-2xl sm:text-3xl lg:text-[2.1rem] font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white">{title}</h1>
            <p className="max-w-2xl text-sm sm:text-[0.95rem] leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>

          <ul className={cn("hidden shrink-0 flex-col items-end gap-2 text-xs font-semibold", width === "wide" && "lg:flex")} aria-label="Keunggulan">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-slate-800/70 ring-1 ring-slate-200 dark:ring-slate-700 px-3 py-1.5 text-slate-600 dark:text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />Diproses di perangkatmu
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-slate-800/70 ring-1 ring-slate-200 dark:ring-slate-700 px-3 py-1.5 text-slate-600 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />Gratis · tanpa akun
            </li>
          </ul>
        </div>
      </section>

      {showSwitcher && group && (
        <nav aria-label={`Alat lain di ${group.title}`} data-testid="tool-switcher" className="-mx-4 sm:mx-0">
          <div ref={stripRef} className="gp-chip-scroll flex gap-2 overflow-x-auto px-4 sm:px-0 py-1.5">
            {group.items.map((item) => {
              const active = item.path === pathname;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold ring-1 transition-all",
                    active
                      ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white ring-transparent shadow-md shadow-indigo-500/25"
                      : "bg-white/80 dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 ring-slate-200 dark:ring-slate-700 hover:ring-indigo-300 dark:hover:ring-indigo-500/50 hover:text-indigo-700 dark:hover:text-indigo-300 hover:-translate-y-0.5",
                  )}
                >
                  {restyleIcon(item.icon, cn("h-3.5 w-3.5 shrink-0", active ? "text-white" : "text-indigo-500"))}
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {children}
    </div>
  );
};
