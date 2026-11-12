import { cloneElement, isValidElement, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { menuGroups } from "@/components/layout/Header";

type Chip = { name: string; path: string; icon: ReactNode };

const ALL: Chip[] = menuGroups.flatMap((g) => g.items.map((i) => ({ name: i.name, path: i.path, icon: i.icon })));

function Row({ items, reverse }: { items: Chip[]; reverse?: boolean }) {
  // Daftar digandakan agar putaran mulus; salinan kedua disembunyikan dari pembaca layar & fokus keyboard.
  return (
    <div className="gp-marquee-wrap overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      <div className={`gp-marquee ${reverse ? "gp-marquee-rev" : ""}`}>
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={copy === 1 ? true : undefined}>
            {items.map((c) => (
              <li key={`${copy}-${c.path}`}>
                <Link
                  to={c.path}
                  tabIndex={copy === 1 ? -1 : undefined}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:text-indigo-700 dark:hover:text-indigo-300 hover:shadow-md"
                >
                  {isValidElement<{ className?: string }>(c.icon) ? cloneElement(c.icon, { className: "h-4 w-4 shrink-0 text-indigo-500" }) : c.icon}
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/** Dua baris nama alat yang bergulir berlawanan arah — jeda saat di-hover. */
export function ToolMarquee() {
  const half = Math.ceil(ALL.length / 2);
  return (
    <div className="space-y-3" data-testid="home-marquee" aria-label="Daftar alat">
      <Row items={ALL.slice(0, half)} />
      <Row items={ALL.slice(half)} reverse />
    </div>
  );
}
