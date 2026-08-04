import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Award, MessageCircle } from "lucide-react";
import { cn } from "@/utils/cn";
import { CertificateGenerator } from "./CertificateGenerator";
import { WaLink } from "./WaLink";

type SpecialTab = "sertifikat" | "wa-link";

const SPECIAL_TABS: { id: SpecialTab; label: string; icon: ReactNode; desc: string }[] = [
  { id: "sertifikat", label: "Sertifikat & Piagam", icon: <Award className="w-4 h-4" />, desc: "Generator massal, full custom" },
  { id: "wa-link", label: "WA Link", icon: <MessageCircle className="w-4 h-4" />, desc: "Chat langsung tanpa simpan kontak" },
];

export function SpecialHub() {
  const { mode } = useParams<{ mode: string }>();
  const tab: SpecialTab = mode === "wa-link" ? "wa-link" : "sertifikat";

  return (
    <div className="space-y-6">
      {/* Submenu — sama seperti kategori lain, tiap fitur punya URL sendiri */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        {SPECIAL_TABS.map(t => (
          <Link
            key={t.id}
            to={`/special/${t.id}`}
            className={cn(
              "flex items-center gap-3 p-4 rounded-2xl border-2 transition-all",
              tab === t.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600"
            )}
          >
            <span className={cn("shrink-0", tab === t.id ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400 dark:text-slate-500")}>{t.icon}</span>
            <div className="min-w-0">
              <div className={cn("font-bold text-sm truncate", tab === t.id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-900 dark:text-white")}>{t.label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{t.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {tab === "sertifikat" && <CertificateGenerator />}
      {tab === "wa-link" && <WaLink />}
    </div>
  );
}
