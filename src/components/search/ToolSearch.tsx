import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CornerDownLeft, History, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { POPULAR_PATHS, getToolIndex, highlightRanges, searchTools, type ToolEntry } from "@/lib/toolIndex";

/**
 * ToolSearch — palet pencarian alat bermerek Gamato Piranti (Ctrl/⌘ + K, atau tombol "/").
 * Satu-satunya cara tercepat menemukan 100+ alat: ketik "kompres", "peta", "badge", "compress pdf"…
 * Sinonim Indonesia ⇄ Inggris, navigasi papan ketik penuh, riwayat alat terakhir, dan bekerja di layar sentuh.
 */

interface Ctx { open: () => void; close: () => void; isOpen: boolean }
const SearchCtx = createContext<Ctx>({ open: () => {}, close: () => {}, isOpen: false });
export const useToolSearch = () => useContext(SearchCtx);

const RECENT_KEY = "gp-recent-tools";
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").filter((x: unknown) => typeof x === "string").slice(0, 5); } catch { return []; } };
const pushRecent = (path: string) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([path, ...readRecent().filter((p) => p !== path)].slice(0, 5))); } catch { /* abaikan */ } };

export function ToolSearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); return; }
      if (e.key === "/" && !mod && !e.altKey) {
        const t = e.target as HTMLElement | null;
        const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
        if (!typing) { e.preventDefault(); setOpen(true); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);
  return (
    <SearchCtx.Provider value={value}>
      {children}
      {isOpen && <Palette onClose={close} />}
    </SearchCtx.Provider>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const r = highlightRanges(text, query);
  if (!r.length) return <>{text}</>;
  const parts: ReactNode[] = [];
  let last = 0;
  r.forEach(([a, b], i) => {
    if (a > last) parts.push(text.slice(last, a));
    parts.push(<mark key={i} className="bg-transparent text-indigo-600 dark:text-indigo-300 font-bold">{text.slice(a, b)}</mark>);
    last = b;
  });
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const uid = useId();

  const index = useMemo(() => getToolIndex(), []);
  const byPath = useMemo(() => new Map(index.map((e) => [e.path, e])), [index]);

  const results = useMemo(() => searchTools(q).map((r) => r.entry), [q]);
  const recent = useMemo(() => readRecent().map((p) => byPath.get(p)).filter(Boolean) as ToolEntry[], [byPath]);
  const popular = useMemo(() => POPULAR_PATHS.map((p) => byPath.get(p)).filter(Boolean).filter((e) => !recent.includes(e!)) as ToolEntry[], [byPath, recent]);

  type Row = { e: ToolEntry; label?: string };
  const rows: Row[] = useMemo(() => {
    if (q.trim()) return results.map((e) => ({ e }));
    return [...recent.map((e, i) => ({ e, label: i === 0 ? "Terakhir dipakai" : undefined })), ...popular.map((e, i) => ({ e, label: i === 0 ? "Populer" : undefined }))];
  }, [q, results, recent, popular]);

  useEffect(() => { setActive(0); }, [q]);

  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { html.style.overflow = prev; prevFocus.current?.focus?.(); };
  }, []);

  useEffect(() => { (listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const go = (e: ToolEntry) => { pushRecent(e.path); onClose(); navigate(e.path); };

  const onKeyDown = (ev: React.KeyboardEvent) => {
    if (ev.key === "Escape") { ev.preventDefault(); onClose(); }
    else if (ev.key === "ArrowDown") { ev.preventDefault(); setActive((a) => Math.min(rows.length - 1, a + 1)); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (ev.key === "Home") { ev.preventDefault(); setActive(0); }
    else if (ev.key === "End") { ev.preventDefault(); setActive(Math.max(0, rows.length - 1)); }
    else if (ev.key === "Enter") { ev.preventDefault(); const r = rows[active]; if (r) go(r.e); }
    else if (ev.key === "Tab") { ev.preventDefault(); inputRef.current?.focus(); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-start justify-center px-3 pt-[9vh] sm:pt-[12vh]" role="presentation" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm animate-[gamatoFadeIn_0.15s_ease-out]" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cari alat"
        data-testid="tool-search"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/30 animate-[gamatoSearchIn_0.18s_cubic-bezier(.2,.9,.3,1.2)]"
      >
        <div className="flex items-center gap-3 px-4 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-indigo-500 shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari alat… mis. “kompres pdf”, “peta”, “badge”"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${uid}-list`}
            aria-activedescendant={rows[active] ? `${uid}-opt-${active}` : undefined}
            aria-label="Cari alat"
            autoComplete="off"
            spellCheck={false}
            data-testid="tool-search-input"
            className="flex-1 min-w-0 bg-transparent py-4 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {q && <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label="Hapus pencarian" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>}
          <kbd className="hidden sm:inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">Esc</kbd>
        </div>

        <div ref={listRef} id={`${uid}-list`} role="listbox" aria-label="Hasil pencarian" className="max-h-[min(56vh,420px)] overflow-y-auto overscroll-contain p-2">
          {rows.length === 0 && q.trim() && (
            <div className="px-4 py-10 text-center" data-testid="tool-search-empty">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tidak ada alat untuk “{q}”</p>
              <p className="text-xs text-slate-400 mt-1">Coba kata lain, misalnya “pdf”, “gambar”, “audio”, atau “surat”.</p>
            </div>
          )}
          {rows.map((r, i) => (
            <div key={r.e.path}>
              {r.label && (
                <p className="flex items-center gap-1.5 px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {r.label === "Populer" ? <Sparkles className="w-3 h-3" /> : <History className="w-3 h-3" />}{r.label}
                </p>
              )}
              <button
                type="button"
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                data-idx={i}
                data-testid="tool-search-item"
                onMouseMove={() => i !== active && setActive(i)}
                onClick={() => go(r.e)}
                className={cn("w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors", i === active ? "bg-indigo-50 dark:bg-indigo-500/15" : "hover:bg-slate-50 dark:hover:bg-slate-800/60")}
              >
                <span className={cn("shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border", i === active ? "bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-500/30" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700")}>{r.e.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate"><Highlight text={r.e.name} query={q} /></span>
                  <span className="block text-xs text-slate-400 dark:text-slate-500 truncate">{r.e.kind === "category" ? "Semua alat kategori ini" : `${r.e.group}${r.e.section ? ` · ${r.e.section}` : ""}`}</span>
                </span>
                {i === active ? <CornerDownLeft className="w-4 h-4 text-indigo-400 shrink-0" /> : <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 px-4 py-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-3"><span><kbd className="font-sans font-semibold">↑↓</kbd> pilih</span><span><kbd className="font-sans font-semibold">↵</kbd> buka</span></span>
          <span data-testid="tool-search-count">{q.trim() ? `${rows.length} hasil` : `${index.filter((e) => e.kind === "tool").length} alat`}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Tombol pemicu kecil untuk header. */
export function SearchTrigger({ className, compact }: { className?: string; compact?: boolean }) {
  const { open } = useToolSearch();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Cari alat"
      aria-keyshortcuts="Control+K Meta+K"
      data-testid="search-trigger"
      className={cn("inline-flex items-center gap-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors", compact ? "p-2" : "px-3 py-2", className)}
    >
      <Search className={compact ? "w-5 h-5" : "w-4 h-4"} />
      {!compact && <kbd className="hidden 2xl:inline text-[10px] font-semibold text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">{isMac ? "⌘K" : "Ctrl K"}</kbd>}
    </button>
  );
}
