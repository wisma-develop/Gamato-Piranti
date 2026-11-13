import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePresence";
import { AudioLines, Check, Clapperboard, FileText, Gauge, Image as ImageIcon, Play, QrCode, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/utils/cn";

/* ───────────────────────── Data QR dekoratif (deterministik, bukan QR sungguhan) ───────────────────────── */
const QR_N = 25;
const QR_PATH = (() => {
  let s = 20260311;
  const rand = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const grid: boolean[][] = Array.from({ length: QR_N }, () => Array.from({ length: QR_N }, () => rand() > 0.52));
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
      const gx = ox + x, gy = oy + y;
      if (gx < 0 || gy < 0 || gx >= QR_N || gy >= QR_N) continue;
      const ring = x === 0 || x === 6 || y === 0 || y === 6;
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
      grid[gy][gx] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (ring || core);
    }
  };
  finder(0, 0); finder(QR_N - 7, 0); finder(0, QR_N - 7);
  let d = "";
  for (let y = 0; y < QR_N; y++) for (let x = 0; x < QR_N; x++) if (grid[y][x]) d += `M${x} ${y}h1v1h-1z`;
  return d;
})();

type SceneId = "qr" | "pdf" | "gambar" | "audio" | "video";

const SCENES: { id: SceneId; label: string; icon: ReactNode; path: string; caption: string }[] = [
  { id: "qr", label: "QR Code", icon: <QrCode className="h-4 w-4" />, path: "/qr/qr-code", caption: "QR code dengan warna & logo kustom" },
  { id: "pdf", label: "PDF", icon: <FileText className="h-4 w-4" />, path: "/pdf/gabung", caption: "Gabung 3 file PDF jadi satu" },
  { id: "gambar", label: "Gambar", icon: <ImageIcon className="h-4 w-4" />, path: "/image/kompres", caption: "Kompres foto tanpa kehilangan kualitas" },
  { id: "audio", label: "Audio", icon: <AudioLines className="h-4 w-4" />, path: "/audio/edit-audio", caption: "Edit & ubah format audio" },
  { id: "video", label: "Video", icon: <Clapperboard className="h-4 w-4" />, path: "/video/potong", caption: "Potong video presisi di browser" },
];

/* ───────────────────────────────────────────── Adegan ───────────────────────────────────────────── */
function SceneQr() {
  return (
    <div className="flex h-full items-center justify-center gap-6 px-5">
      <div className="relative rounded-2xl bg-white p-3 shadow-xl shadow-indigo-500/20 ring-1 ring-slate-200" style={{ ["--scan-h" as string]: "136px" } as CSSProperties}>
        <div className="h-[148px] w-[148px]">
          <svg viewBox={`0 0 ${QR_N} ${QR_N}`} className="w-full" shapeRendering="crispEdges" aria-hidden="true">
            <defs>
              <linearGradient id="gp-hero-qr" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#4f46e5" />
                <stop offset="1" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
            <path d={QR_PATH} fill="url(#gp-hero-qr)" />
          </svg>
        </div>
        <span aria-hidden="true" className="absolute left-2 right-2 top-3 h-0.5 rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_14px_3px_rgba(52,211,153,.55)] gp-scan" />
        <span aria-hidden="true" className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl bg-white shadow-md ring-1 ring-slate-200">
          <img src="/gamato-piranti-128.webp" width={28} height={28} alt="" className="h-7 w-7 rounded-lg object-cover" />
        </span>
      </div>
      <div className="hidden space-y-2.5 sm:block">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Kustomisasi</p>
        <div className="flex gap-1.5" aria-hidden="true">
          {["#4f46e5", "#0d9488", "#e11d48", "#0f172a"].map((c) => <span key={c} className="h-5 w-5 rounded-full ring-2 ring-white dark:ring-slate-800 shadow" style={{ background: c }} />)}
        </div>
        <div className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <p className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" />Logo di tengah</p>
          <p className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" />Bentuk titik</p>
          <p className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" />PNG · SVG · JPEG</p>
        </div>
      </div>
    </div>
  );
}

function ScenePdf() {
  return (
    <div className="relative flex h-full items-center justify-center">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute h-[9.5rem] w-28 space-y-1.5 rounded-lg bg-white p-3 shadow-lg ring-1 ring-slate-200"
          style={{
            zIndex: i,
            ["--x0" as string]: `${(i - 1) * 96}px`, ["--r0" as string]: `${(i - 1) * 9}deg`,
            ["--x1" as string]: `${(i - 1) * 12}px`, ["--r1" as string]: `${(i - 1) * 4}deg`, ["--y1" as string]: `${i * -5}px`,
            animation: `gpPdfCard .8s ${0.15 + i * 0.12}s cubic-bezier(.34,1.45,.64,1) both`,
          } as CSSProperties}
        >
          <span className="inline-block rounded bg-rose-500 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white">PDF</span>
          <div className="h-1.5 w-full rounded bg-slate-200" /><div className="h-1.5 w-4/5 rounded bg-slate-200" />
          <div className="h-1.5 w-full rounded bg-slate-200" /><div className="h-1.5 w-3/5 rounded bg-slate-200" />
          <div className="mt-2 h-8 w-full rounded bg-gradient-to-br from-indigo-100 to-violet-100" />
        </div>
      ))}
      <span
        className="absolute bottom-4 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-lg dark:bg-white dark:text-slate-900"
        style={{ animation: "gpRiseFade .5s .9s ease-out both" }}
      >
        <Check className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-600" />3 file → 1 PDF
      </span>
    </div>
  );
}

function SceneImage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
      <div className="relative h-[8.5rem] w-56 overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-300 via-rose-400 to-indigo-500" />
        <div className="absolute right-7 top-5 h-9 w-9 rounded-full bg-white/80 blur-[1px]" />
        <svg viewBox="0 0 200 60" className="absolute bottom-0 w-full" aria-hidden="true"><path d="M0 60V38L40 12l35 28 35-20 40 26 50-22v38Z" fill="rgba(15,23,42,.55)" /></svg>
      </div>
      <div className="w-full max-w-xs space-y-1.5">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-slate-500 dark:text-slate-400 line-through decoration-slate-400/60">4,2 MB</span>
          <span className="text-emerald-700 dark:text-emerald-400">890 KB · −79%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ animation: "gpShrink 1.1s .45s ease-in-out both" }} />
        </div>
      </div>
    </div>
  );
}

function SceneAudio() {
  const bars = useMemo(() => Array.from({ length: 38 }, (_, i) => ({ h: 28 + ((i * 37) % 66), delay: -((i * 0.17) % 1.2), dur: 0.9 + ((i * 13) % 7) / 10 })), []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
      <div className="flex h-24 w-full max-w-sm items-center justify-between gap-[3px]" aria-hidden="true">
        {bars.map((b, i) => (
          <span key={i} className="gp-bar block w-[5px] flex-1 rounded-full bg-gradient-to-t from-indigo-500 to-sky-400" style={{ height: `${b.h}%`, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s` }} />
        ))}
      </div>
      <div className="flex w-full max-w-sm items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900"><Play className="h-4 w-4 translate-x-px" fill="currentColor" /></span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full w-full origin-left rounded-full bg-indigo-500" style={{ animation: "gpGrow 3.2s linear both" }} /></div>
        <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">02:08 / 03:15</span>
      </div>
    </div>
  );
}

function SceneVideo() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
      <div className="relative grid h-28 w-full max-w-xs place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 to-indigo-900 shadow-lg ring-1 ring-black/10">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-slate-900"><Play className="h-5 w-5 translate-x-px" fill="currentColor" /></span>
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">00:36</span>
      </div>
      <div className="w-full max-w-sm space-y-1.5">
        <div className="relative flex h-12 overflow-hidden rounded-lg">
          {Array.from({ length: 12 }, (_, i) => <span key={i} className="flex-1" style={{ background: `linear-gradient(135deg,hsl(${205 + i * 11} 70% 62%),hsl(${235 + i * 11} 65% 46%))` }} />)}
          <span className="absolute inset-y-0 rounded-md border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,.55)]" style={{ animation: "gpTrim 1.2s .4s ease-in-out both" }} />
        </div>
        <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">Potong 00:12 – 00:48</p>
      </div>
    </div>
  );
}

const SCENE_VIEW: Record<SceneId, ReactNode> = { qr: <SceneQr />, pdf: <ScenePdf />, gambar: <SceneImage />, audio: <SceneAudio />, video: <SceneVideo /> };

/* ──────────────────────────────────────────── Showcase ──────────────────────────────────────────── */
/** Kartu kaca melayang. Luar = parallax kursor (CSS var, kelas `gp-hero-far|near`); dalam = mengambang (CSS) —
 *  dipisah supaya dua animasi `transform` tidak saling menimpa. */
const GlassChip = ({ icon, title, text, className, bobDelay }: { icon: ReactNode; title: string; text: string; className?: string; bobDelay?: string }) => (
  <div className={className}>
    <div className="gp-bob flex items-center gap-3 gp-glass rounded-2xl border border-white/60 dark:border-slate-700/70 px-3.5 py-2.5 shadow-xl shadow-slate-900/10 dark:shadow-black/40" style={bobDelay ? { animationDelay: bobDelay } : undefined}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">{icon}</span>
      <span className="leading-tight">
        <span className="block text-sm font-bold text-slate-900 dark:text-white">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">{text}</span>
      </span>
    </div>
  </div>
);

export function HeroShowcase({ totalTools }: { totalTools: number }) {
  const reduce = usePrefersReducedMotion();
  const [idx, setIdx] = useState(0);
  const [pausedUntil, setPausedUntil] = useState(0);
  const scene = SCENES[idx];

  // Putar adegan otomatis; berhenti sementara setelah pengguna memilih tab sendiri.
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => { if (Date.now() > pausedUntil) setIdx((i) => (i + 1) % SCENES.length); }, 4200);
    return () => window.clearInterval(t);
  }, [reduce, pausedUntil]);

  // Parallax kursor: hanya mouse (bukan sentuh) & hanya bila gerakan diizinkan. Menulis --px/--py langsung ke DOM
  // (rAF) — tidak ada re-render React saat kursor bergerak.
  const wrapRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);
  const onMove = (e: React.PointerEvent) => {
    const el = wrapRef.current;
    if (reduce || e.pointerType !== "mouse" || !el) return;
    const { clientX, clientY } = e;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--px", ((clientX - r.left) / r.width - 0.5).toFixed(3));
      el.style.setProperty("--py", ((clientY - r.top) / r.height - 0.5).toFixed(3));
    });
  };
  const onLeave = () => { const el = wrapRef.current; if (el) { el.style.setProperty("--px", "0"); el.style.setProperty("--py", "0"); } };
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  return (
    <div ref={wrapRef} onPointerMove={onMove} onPointerLeave={onLeave} className="relative mx-auto w-full max-w-[34rem] lg:max-w-none" data-testid="hero-showcase">
      {/* Halo di belakang jendela */}
      <div aria-hidden="true" className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-gradient-to-tr from-indigo-500/25 via-violet-500/20 to-sky-400/25 gp-soft" />

      {/* Kartu kaca melayang (hanya ≥ lg): dua menjepit sudut jendela, satu gelembung ikon di tepi kiri.
          Posisinya sengaja di area kosong jendela (sudut kanan-atas bilah judul, sudut kanan-bawah bilah status). */}
      <GlassChip icon={<Search className="h-5 w-5" />} title={`${totalTools}+ alat`} text="Cari cepat · Ctrl K" className="gp-hero-near absolute -right-5 -top-7 z-20 hidden lg:block" bobDelay="-2s" />
      <GlassChip icon={<ShieldCheck className="h-5 w-5" />} title="Privasi penuh" text="0 byte diunggah" className="gp-hero-far absolute -bottom-8 -right-5 z-20 hidden lg:block" />
      <div aria-hidden="true" className="gp-hero-far absolute -left-6 top-[46%] z-20 hidden lg:block">
        <div className="gp-bob gp-glass grid h-12 w-12 place-items-center rounded-2xl border border-white/60 dark:border-slate-700/70 shadow-xl shadow-slate-900/10 dark:shadow-black/40" style={{ animationDelay: "-4s" }}>
          <Gauge className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
        </div>
      </div>

      <div className="gp-hero-win gp-noise relative overflow-hidden rounded-3xl border border-slate-200/90 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/85 shadow-2xl shadow-indigo-500/20 dark:shadow-black/50 backdrop-blur">
        {/* Bilah judul jendela */}
        <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true"><i className="h-2.5 w-2.5 rounded-full bg-rose-400" /><i className="h-2.5 w-2.5 rounded-full bg-amber-400" /><i className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></span>
          <span className="mx-auto flex min-w-0 max-w-full items-center gap-1.5 truncate rounded-full bg-white dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700">
            <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" aria-hidden="true" />
            <span className="truncate">gamatopiranti.zone.id{scene.path}</span>
          </span>
          <span className="w-11 shrink-0" aria-hidden="true" />
        </div>

        {/* Tab adegan */}
        <div role="tablist" aria-label="Contoh alat" className="flex gap-1 overflow-x-auto border-b border-slate-200/80 dark:border-slate-800 px-3 py-2 [scrollbar-width:none]">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`hero-tab-${s.id}`}
              aria-selected={i === idx}
              aria-controls="hero-stage"
              data-testid={`hero-tab-${s.id}`}
              onClick={() => { setIdx(i); setPausedUntil(Date.now() + 9000); }}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                i === idx ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              {s.icon}{s.label}
            </button>
          ))}
        </div>

        {/* Panggung */}
        <div id="hero-stage" role="tabpanel" aria-labelledby={`hero-tab-${scene.id}`} className="relative h-[17.5rem] sm:h-[20rem] bg-[radial-gradient(ellipse_70%_90%_at_50%_0%,color-mix(in_oklab,var(--color-indigo-500)_9%,transparent),transparent)]">
          <div key={scene.id} className="gp-scene-in absolute inset-0">
            {SCENE_VIEW[scene.id]}
          </div>
        </div>

        {/* Bilah status */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 px-4 py-2.5 text-xs">
          <span className="min-w-0 truncate font-semibold text-slate-600 dark:text-slate-300" aria-live="polite">{scene.caption}</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 lg:invisible">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            Di perangkatmu
          </span>
        </div>
      </div>

      {/* Versi ringkas kartu kaca untuk layar < lg */}
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 lg:hidden" aria-label="Keunggulan">
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-slate-900/70 px-3 py-1.5 ring-1 ring-slate-200 dark:ring-slate-700"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />0 byte diunggah</li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-slate-900/70 px-3 py-1.5 ring-1 ring-slate-200 dark:ring-slate-700"><Search className="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />{totalTools}+ alat</li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-slate-900/70 px-3 py-1.5 ring-1 ring-slate-200 dark:ring-slate-700"><Gauge className="h-3.5 w-3.5 text-sky-500" aria-hidden="true" />Instan</li>
      </ul>
    </div>
  );
}
