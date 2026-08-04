import type { FC, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { QrCode, Barcode } from "lucide-react";
import { cn } from "@/utils/cn";
import { QrCodeGenerator } from "./QrCodeGenerator";
import { BarcodeGenerator } from "./BarcodeGenerator";

type QrBarcodeMode = "qr-code" | "barcode";

const MODES: { id: QrBarcodeMode; icon: ReactNode; label: string; sub: string }[] = [
  { id: "qr-code", icon: <QrCode className="w-5 h-5" />, label: "QR Code", sub: "Full custom — bentuk, warna, logo" },
  { id: "barcode", icon: <Barcode className="w-5 h-5" />, label: "Barcode", sub: "6 format • cetak massal ke PDF" },
];

export const QRBarcodeStudio: FC = () => {
  const { mode: modeParam } = useParams<{ mode: string }>();
  const mode: QrBarcodeMode = modeParam === "barcode" ? "barcode" : "qr-code";

  return (
    <div className="space-y-6">
      {/* Mode toggle — submenu with its own URL per mode */}
      <div className="grid grid-cols-2 gap-3">
        {MODES.map(m => (
          <Link key={m.id} to={`/qr/${m.id}`}
            className={cn("rounded-2xl border-2 p-4 text-left transition-all flex items-center gap-3", mode === m.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600")}>
            <span className={cn("shrink-0", mode === m.id ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400 dark:text-slate-500")}>{m.icon}</span>
            <div>
              <div className={cn("font-bold text-base", mode === m.id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-900 dark:text-white")}>{m.label}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{m.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {mode === "qr-code" ? <QrCodeGenerator /> : <BarcodeGenerator />}
    </div>
  );
};
