import React, { useEffect, useRef, useState } from "react";
import { AppWindow, Download, ExternalLink, RotateCcw, Smartphone, Tablet, Monitor } from "lucide-react";
import { cn } from "@/utils/cn";
import { Btn } from "@/components/ui/primitives";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { downloadBlob } from "@/lib/file";

const STARTER = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: sans-serif; padding: 24px; color: #0f172a; background: #f8fafc; }
  h1 { color: #4f46e5; }
  .card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  button { margin-top: 12px; padding: 8px 16px; border-radius: 8px; border: none; background: #4f46e5; color: #fff; cursor: pointer; }
</style>
</head>
<body>
  <div class="card">
    <h1>Halo dari Gamato Piranti! 👋</h1>
    <p>Tulis HTML, CSS, dan JavaScript di sini — hasilnya langsung tampil di panel preview.</p>
    <button onclick="alert('Script juga jalan di sini!')">Coba klik aku</button>
  </div>
</body>
</html>`;

type Device = "mobile" | "tablet" | "desktop";
const DEVICE_WIDTH: Record<Device, string> = { mobile: "375px", tablet: "768px", desktop: "100%" };
const DEVICE_ICONS: { id: Device; icon: typeof Smartphone }[] = [
  { id: "mobile", icon: Smartphone },
  { id: "tablet", icon: Tablet },
  { id: "desktop", icon: Monitor },
];

export const UtilityHtmlPreview: React.FC = () => {
  const [code, setCode] = useState(STARTER);
  const [previewCode, setPreviewCode] = useState(STARTER);
  const [device, setDevice] = useState<Device>("desktop");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPreviewCode(code), 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code]);

  const openInNewTab = () => {
    const blob = new Blob([code], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const download = () => {
    downloadBlob(new Blob([code], { type: "text/html" }), "gamato-preview.html");
  };

  const reset = () => {
    setCode(STARTER);
    setPreviewCode(STARTER);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Kode HTML / CSS / JS</p>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset ke Template
          </button>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          className="w-full h-[420px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-900 text-slate-100 font-mono text-xs leading-relaxed p-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
        />
        <div className="flex flex-wrap gap-2">
          <Btn onClick={openInNewTab} variant="secondary" className="gap-2 text-xs">
            <ExternalLink className="w-3.5 h-3.5" />
            Buka di Tab Baru
          </Btn>
          <Btn onClick={download} variant="secondary" className="gap-2 text-xs">
            <Download className="w-3.5 h-3.5" />
            Unduh .html
          </Btn>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Preview</p>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            {DEVICE_ICONS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDevice(id)}
                title={id}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  device === id
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-3 overflow-x-auto">
          <div className="mx-auto transition-all" style={{ width: DEVICE_WIDTH[device] }}>
            <iframe
              title="Gamato HTML Preview"
              srcDoc={previewCode}
              sandbox="allow-scripts allow-modals allow-forms allow-popups"
              className="w-full h-[420px] bg-white rounded-xl border border-slate-300 dark:border-slate-600 shadow-sm"
            />
          </div>
        </div>
        <ToolInfoPanel
          icon={<AppWindow className="w-5 h-5" />}
          label="HTML Preview"
          desc="Live preview HTML, CSS & JavaScript"
          points={[
            "Preview berjalan di iframe sandbox — script tetap bisa jalan, tapi terisolasi dari halaman utama Gamato Piranti.",
            "Preview otomatis diperbarui setelah kamu berhenti mengetik selama sesaat.",
            "Kode tidak pernah dikirim ke server mana pun — semuanya diproses di browser.",
          ]}
        />
      </div>
    </div>
  );
};
