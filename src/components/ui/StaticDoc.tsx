import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Info, ListTree, ShieldAlert, Sparkles } from "lucide-react";
import { cn } from "@/utils/cn";
import { pick } from "@/i18n";

import { useDocMeta } from "@/hooks/useDocMeta";
/* ── Hero ─────────────────────────────────────────────────────────────────── */
export function DocHero({ badge, title, lead, meta, icon }: { badge: string; title: string; lead: string; meta?: string; icon?: ReactNode }) {
  const reduce = useReducedMotion();
  useDocMeta(title, lead);
  return (
    <motion.header
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-indigo-50/60 to-violet-50/70 px-6 py-10 text-center shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900 sm:px-10 sm:py-14"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-indigo-400/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-violet-400/15 blur-3xl" />
      <div className="relative space-y-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-indigo-700 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20">
          {icon ?? <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          {badge}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">{title}</h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">{lead}</p>
        {meta && <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{meta}</p>}
      </div>
    </motion.header>
  );
}

/* ── TOC + scrollspy ──────────────────────────────────────────────────────── */
export interface TocItem { id: string; label: string }

function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        if (visible.size) setActive([...visible.entries()].sort((a, b) => a[1] - b[1])[0][0]);
      },
      { rootMargin: "-88px 0px -60% 0px", threshold: [0, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return active;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  try { history.replaceState(null, "", `#${id}`); } catch { /* ignore */ }
  el.focus({ preventScroll: true });
}

export function DocLayout({ toc, tocTitle, children }: { toc: TocItem[]; tocTitle?: string; children: ReactNode }) {
  const active = useScrollSpy(toc.map((t) => t.id));
  const title = tocTitle ?? pick("Daftar isi", "On this page");
  const mobileRef = useRef<HTMLDetailsElement>(null);

  // Gulir ke hash bila halaman dibuka dengan #bagian
  useEffect(() => {
    const h = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (h) setTimeout(() => scrollToId(h), 80);
  }, []);

  const list = (
    <ol className="space-y-0.5">
      {toc.map((t, i) => (
        <li key={t.id}>
          <a
            href={`#${t.id}`}
            onClick={(e) => { e.preventDefault(); scrollToId(t.id); if (mobileRef.current) mobileRef.current.open = false; }}
            aria-current={active === t.id ? "true" : undefined}
            className={cn(
              "flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500",
              active === t.id
                ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
            )}
          >
            <span className="mt-px w-5 shrink-0 text-right text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-400">{i + 1}</span>
            <span>{t.label}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside aria-label={title} className="lg:sticky lg:top-24 lg:self-start">
        <details ref={mobileRef} className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <ListTree className="h-4 w-4 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
            {title}
          </summary>
          <nav className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800" aria-label={title}>{list}</nav>
        </details>
        <nav aria-label={title} className="hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
          <p className="mb-2 flex items-center gap-2 px-2.5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
            {title}
          </p>
          {list}
        </nav>
      </aside>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}

/* ── Seksi & callout ──────────────────────────────────────────────────────── */
export function DocSection({ id, num, title, children }: { id: string; num: number; title: string; children: ReactNode }) {
  return (
    <section
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-h`}
      className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm outline-none dark:border-slate-800 dark:bg-slate-900 sm:p-7"
    >
      <h2 id={`${id}-h`} className="mb-3 flex items-center gap-3 text-lg font-bold text-slate-900 dark:text-white">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white dark:bg-white dark:text-slate-900">{num}</span>
        <span>{title}</span>
      </h2>
      <div className="doc-prose space-y-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  );
}

const TONES = {
  info: { box: "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100", icon: <Info className="h-4 w-4" aria-hidden="true" /> },
  warn: { box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100", icon: <ShieldAlert className="h-4 w-4" aria-hidden="true" /> },
} as const;

export function Callout({ tone = "info", title, children }: { tone?: keyof typeof TONES; title?: string; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <div role="note" className={cn("flex gap-3 rounded-xl border p-4 text-sm leading-relaxed", t.box)}>
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="space-y-1">
        {title && <p className="font-bold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function DocFooterNav({ links }: { links: { to: string; label: string }[] }) {
  return (
    <nav aria-label={pick("Halaman terkait", "Related pages")} className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
      {links.map((l) => (
        <Link key={l.to} to={l.to} className="rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-indigo-300">
          {l.label}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
        {pick("Ke atas", "Back to top")}
      </button>
    </nav>
  );
}
