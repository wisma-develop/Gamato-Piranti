import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, HelpCircle, Search, SearchX, X } from "lucide-react";
import { Callout, DocFooterNav, DocHero } from "@/components/ui/StaticDoc";
import { FAQ_CATS, buildFaq, type FaqCat } from "@/pages/content/faq";
import { cn } from "@/utils/cn";
import { lang, pick } from "@/i18n";

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

export default function Faq() {
  const items = useMemo(buildFaq, []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"semua" | FaqCat>("semua");
  const [openAll, setOpenAll] = useState<boolean | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchId = useId();

  const shown = useMemo(() => {
    const nq = norm(q.trim());
    return items.filter((it) => (cat === "semua" || it.cat === cat) && (!nq || norm(it.q + " " + it.a).includes(nq)));
  }, [items, q, cat]);

  // Data terstruktur FAQPage (SEO) — mengikuti bahasa aktif
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = "faq-jsonld";
    el.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: lang,
      mainEntity: items.map((it) => ({ "@type": "Question", name: it.q, acceptedAnswer: { "@type": "Answer", text: it.a } })),
    });
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, [items]);

  // Buka pertanyaan yang ditunjuk oleh #hash (mis. #faq-diunggah atau #diunggah)
  useEffect(() => {
    const openFromHash = () => {
      const raw = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (!raw) return;
      const id = raw.replace(/^faq-/, "");
      setCat("semua");
      setQ("");
      setTimeout(() => {
        const d = document.getElementById(`faq-${id}`) as HTMLDetailsElement | null;
        if (d) { d.open = true; d.scrollIntoView({ block: "start" }); }
      }, 80);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  // Ekspansi/ciutkan semua
  useEffect(() => {
    if (openAll === null) return;
    listRef.current?.querySelectorAll("details").forEach((d) => { d.open = openAll; });
  }, [openAll, shown]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { semua: items.length };
    for (const it of items) c[it.cat] = (c[it.cat] ?? 0) + 1;
    return c;
  }, [items]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 sm:py-14">
      <DocHero
        badge="FAQ"
        title={pick("Pertanyaan yang sering diajukan", "Frequently asked questions")}
        lead={pick("Jawaban singkat tentang privasi, cara pakai, dan pemecahan masalah. Tidak ketemu? Cari dengan kolom di bawah.", "Quick answers about privacy, how things work, and troubleshooting. Can't find it? Use the search box below.")}
        meta={pick(`${items.length} pertanyaan`, `${items.length} questions`)}
        icon={<HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />}
      />

      <div className="mt-8 space-y-4">
        <div role="search" className="relative">
          <label htmlFor={searchId} className="sr-only">{pick("Cari pertanyaan", "Search questions")}</label>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={pick("Cari… mis. “unggah”, “kamera”, “bahasa”", "Search… e.g. “upload”, “camera”, “language”")}
            autoComplete="off"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label={pick("Hapus pencarian", "Clear search")} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div role="group" aria-label={pick("Kategori", "Categories")} className="flex flex-wrap gap-2">
          {FAQ_CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={cat === c.id}
              onClick={() => setCat(c.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
                cat === c.id
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-indigo-300",
              )}
            >
              {c.label} <span className={cat === c.id ? "text-slate-300 dark:text-slate-600" : "text-slate-600 dark:text-slate-400"}>{counts[c.id] ?? 0}</span>
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1 text-sm">
            <button type="button" onClick={() => setOpenAll(true)} className="rounded-lg px-2 py-1 font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10">{pick("Buka semua", "Expand all")}</button>
            <span aria-hidden="true" className="text-slate-300">|</span>
            <button type="button" onClick={() => setOpenAll(false)} className="rounded-lg px-2 py-1 font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10">{pick("Tutup semua", "Collapse all")}</button>
          </span>
        </div>

        <p className="sr-only" role="status" aria-live="polite">{pick(`${shown.length} hasil`, `${shown.length} results`)}</p>

        <div ref={listRef} className="space-y-2.5">
          {shown.map((it) => (
            <details key={it.id} id={`faq-${it.id}`} className="group rounded-2xl border border-slate-200 bg-white shadow-sm open:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-2xl px-5 py-4 text-left font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-white [&::-webkit-details-marker]:hidden">
                <span>{it.q}</span>
                <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-slate-100 px-5 pb-5 pt-3 text-[15px] leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-300">
                <p>{it.a}</p>
                <a href={`#faq-${it.id}`} className="mt-3 inline-block text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-indigo-700 dark:text-slate-400 dark:hover:text-indigo-300">{pick("Tautan ke pertanyaan ini", "Link to this question")}</a>
              </div>
            </details>
          ))}
          {shown.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <SearchX className="mx-auto mb-3 h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="font-semibold text-slate-800 dark:text-slate-100">{pick("Tidak ada pertanyaan yang cocok", "No matching questions")}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{pick("Coba kata kunci lain, atau pilih kategori “Semua”.", "Try another keyword, or choose the “All” category.")}</p>
              <button type="button" onClick={() => { setQ(""); setCat("semua"); }} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900">{pick("Atur ulang", "Reset filters")}</button>
            </div>
          )}
        </div>

        <Callout title={pick("Masih butuh bantuan?", "Still need help?")}>
          {pick("Buka ", "Open an issue on ")}
          <a className="font-semibold underline underline-offset-2" href="https://github.com/wisma-develop/Gamato-Piranti/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>
          {pick(" dan ceritakan kendalamu. Baca juga ", " and tell us what went wrong. You may also read the ")}
          <Link className="font-semibold underline underline-offset-2" to="/privacy">{pick("Kebijakan Privasi", "Privacy Policy")}</Link>.
        </Callout>
      </div>
      <DocFooterNav links={[{ to: "/about", label: pick("Tentang kami", "About us") }, { to: "/privacy", label: pick("Kebijakan Privasi", "Privacy Policy") }, { to: "/terms", label: pick("Ketentuan Layanan", "Terms of Service") }]} />
    </div>
  );
}
