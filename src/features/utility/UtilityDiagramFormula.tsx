import React, { useCallback, useEffect, useRef, useState } from "react";
import "katex/dist/katex.min.css";
import { Workflow, Sigma, Download, Image as ImageIcon, Copy, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Textarea, Btn } from "@/components/ui/primitives";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { useDarkMode } from "@/hooks/useDarkMode";
import { downloadBlob } from "@/lib/file";
import { loadImageFromUrl, makeCanvas, canvasToBlob } from "@/lib/canvas";
import { copyToClipboard } from "@/lib/utilityHelpers";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";

type Mode = "diagram" | "formula";

const DIAGRAM_TEMPLATES = [
  {
    id: "flowchart",
    label: "Flowchart",
    code: `flowchart TD\n    A[Mulai] --> B{Sudah Login?}\n    B -- Ya --> C[Tampilkan Dashboard]\n    B -- Tidak --> D[Halaman Login]\n    D --> B\n    C --> E[Selesai]`,
  },
  {
    id: "sequence",
    label: "Sequence",
    code: `sequenceDiagram\n    participant U as User\n    participant A as Aplikasi\n    participant S as Server\n    U->>A: Buka halaman\n    A->>S: Minta data\n    S-->>A: Kirim data\n    A-->>U: Tampilkan hasil`,
  },
  {
    id: "struktur",
    label: "Struktur Organisasi",
    code: `flowchart TD\n    CEO[Direktur Utama] --> CTO[Kepala Teknologi]\n    CEO --> CFO[Kepala Keuangan]\n    CTO --> DEV[Tim Developer]\n    CTO --> QA[Tim QA]\n    CFO --> ACC[Tim Akuntansi]`,
  },
  {
    id: "pie",
    label: "Pie Chart",
    code: `pie title Sumber Trafik\n    "Organik" : 45\n    "Sosial Media" : 30\n    "Iklan" : 15\n    "Lainnya" : 10`,
  },
  {
    id: "mindmap",
    label: "Mindmap",
    code: `mindmap\n  root((Ide Bisnis))\n    Produk\n      Kualitas\n      Kemasan\n    Pemasaran\n      Sosial Media\n      Promosi\n    Keuangan\n      Modal\n      Untung`,
  },
] as const;

const FORMULA_TEMPLATES = [
  { id: "pythagoras", label: "Pythagoras", code: "a^2 + b^2 = c^2" },
  { id: "kuadratik", label: "Rumus ABC", code: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
  { id: "lingkaran", label: "Luas Lingkaran", code: "A = \\pi r^2" },
  { id: "sigma", label: "Sigma", code: "\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}" },
  { id: "integral", label: "Integral", code: "\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)" },
  { id: "matrix", label: "Matriks", code: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" },
] as const;

function ensureSvgDimensions(svg: string): string {
  if (/<svg[^>]*\swidth=/.test(svg) && /<svg[^>]*\sheight=/.test(svg)) return svg;
  const match = svg.match(/viewBox="[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)"/);
  if (!match) return svg;
  const w = Math.ceil(parseFloat(match[1]));
  const h = Math.ceil(parseFloat(match[2]));
  if (!w || !h) return svg;
  return svg.replace("<svg", `<svg width="${w}" height="${h}"`);
}

export const UtilityDiagramFormula: React.FC = () => {
  const { isDark } = useDarkMode();
  const [mode, setMode] = useState<Mode>("diagram");

  // Kode diagram (Mermaid) dan kode rumus (LaTeX) masing-masing punya
  // riwayat Undo/Redo sendiri (digabung jadi satu langkah setelah jeda).
  const diagramHistory = useHistoryState<string>(DIAGRAM_TEMPLATES[0].code);
  const diagramCode = diagramHistory.state;
  const { schedule: scheduleDiagramCommit } = useDebouncedCommit(diagramHistory.commit, 600);
  const setDiagramCode = (v: string) => {
    diagramHistory.set(v, { commit: false });
    scheduleDiagramCommit();
  };
  const [diagramSvg, setDiagramSvg] = useState("");
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Kode rumus (LaTeX) punya riwayat Undo/Redo sendiri (digabung jadi satu
  // langkah setelah jeda).
  const formulaHistory = useHistoryState<string>(FORMULA_TEMPLATES[0].code);
  const formulaCode = formulaHistory.state;
  const { schedule: scheduleFormulaCommit } = useDebouncedCommit(formulaHistory.commit, 600);
  const setFormulaCode = (v: string) => {
    formulaHistory.set(v, { commit: false });
    scheduleFormulaCommit();
  };
  const formulaRef = useRef<HTMLDivElement>(null);
  const [formulaError, setFormulaError] = useState<string | null>(null);

  const idCounter = useRef(0);

  const renderDiagram = useCallback(async (code: string) => {
    if (!code.trim()) {
      setDiagramSvg("");
      return;
    }
    setIsRendering(true);
    setDiagramError(null);
    try {
      const mod = await import("mermaid");
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: isDark ? "dark" : "default",
        fontFamily: "inherit",
      });
      idCounter.current += 1;
      const id = `gp-mermaid-${Date.now()}-${idCounter.current}`;
      const { svg } = await mermaid.render(id, code);
      setDiagramSvg(ensureSvgDimensions(svg));
    } catch (err: any) {
      setDiagramSvg("");
      const msg = err?.message ? String(err.message).split("\n")[0] : "Sintaks diagram tidak valid.";
      setDiagramError(msg);
    } finally {
      setIsRendering(false);
    }
  }, [isDark]);

  const renderFormula = useCallback(async (code: string) => {
    setFormulaError(null);
    if (!formulaRef.current) return;
    if (!code.trim()) {
      formulaRef.current.innerHTML = "";
      return;
    }
    try {
      const mod = await import("katex");
      const katex = mod.default;
      katex.render(code, formulaRef.current, { throwOnError: false, displayMode: true, strict: false });
    } catch (err: any) {
      setFormulaError(err?.message || "Rumus tidak valid.");
    }
  }, []);

  useEffect(() => {
    if (mode !== "diagram") return;
    const t = setTimeout(() => {
      renderDiagram(diagramCode);
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagramCode, mode, isDark]);

  useEffect(() => {
    if (mode !== "formula") return;
    const t = setTimeout(() => {
      renderFormula(formulaCode);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulaCode, mode]);

  const downloadSvg = () => {
    if (!diagramSvg) return;
    downloadBlob(new Blob([diagramSvg], { type: "image/svg+xml" }), "gamato-diagram.svg");
  };

  const downloadPng = async () => {
    if (!diagramSvg) return;
    try {
      const svgBlob = new Blob([diagramSvg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = await loadImageFromUrl(url);
      const scale = 2;
      const w = (img.naturalWidth || img.width || 800) * scale;
      const h = (img.naturalHeight || img.height || 600) * scale;
      const { canvas, ctx } = makeCanvas(w, h);
      ctx.fillStyle = isDark ? "#0f172a" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const blob = await canvasToBlob(canvas, "image/png");
      downloadBlob(blob, "gamato-diagram.png");
    } catch {
      setDiagramError("Gagal mengekspor PNG.");
    }
  };

  return (
    <div className="space-y-6">
      <GamatoDesktopRecommended toolName="Diagram & Rumus Studio" />
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("diagram")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl border-2 p-4 text-sm font-bold transition-all",
              mode === "diagram"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
            )}
          >
            <Workflow className="w-4 h-4" />
            Diagram / Struktur / Chart
          </button>
          <button
            type="button"
            onClick={() => setMode("formula")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-2xl border-2 p-4 text-sm font-bold transition-all",
              mode === "formula"
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
            )}
          >
            <Sigma className="w-4 h-4" />
            Rumus (LaTeX)
          </button>
        </div>

        {mode === "diagram" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex flex-wrap gap-2">
                {DIAGRAM_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDiagramCode(t.code)}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <UndoRedoBar canUndo={diagramHistory.canUndo} canRedo={diagramHistory.canRedo} onUndo={diagramHistory.undo} onRedo={diagramHistory.redo} hideLabel />
            </div>
            <Textarea
              label="Sintaks Diagram (Mermaid)"
              rows={10}
              value={diagramCode}
              onChange={(e) => setDiagramCode(e.target.value)}
              className="font-mono text-xs"
            />
            {diagramError && <p className="text-sm text-red-600 dark:text-red-400">{diagramError}</p>}

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm min-h-[220px] flex items-center justify-center overflow-auto">
              {isRendering ? (
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              ) : diagramSvg ? (
                <div className="max-w-full [&_svg]:max-w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: diagramSvg }} />
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">Preview diagram akan tampil di sini.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Btn onClick={downloadSvg} disabled={!diagramSvg} variant="secondary" className="gap-2 text-xs">
                <Download className="w-3.5 h-3.5" />
                Unduh SVG
              </Btn>
              <Btn onClick={downloadPng} disabled={!diagramSvg} variant="secondary" className="gap-2 text-xs">
                <ImageIcon className="w-3.5 h-3.5" />
                Unduh PNG
              </Btn>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex flex-wrap gap-2">
                {FORMULA_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFormulaCode(t.code)}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <UndoRedoBar canUndo={formulaHistory.canUndo} canRedo={formulaHistory.canRedo} onUndo={formulaHistory.undo} onRedo={formulaHistory.redo} hideLabel />
            </div>
            <Textarea
              label="Kode Rumus (LaTeX)"
              rows={4}
              value={formulaCode}
              onChange={(e) => setFormulaCode(e.target.value)}
              className="font-mono text-xs"
            />
            {formulaError && <p className="text-sm text-red-600 dark:text-red-400">{formulaError}</p>}

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm min-h-[180px] flex items-center justify-center overflow-auto">
              <div ref={formulaRef} className="text-slate-900 dark:text-slate-100 text-lg" />
            </div>

            <Btn onClick={() => copyToClipboard(formulaCode)} variant="secondary" className="gap-2 text-xs">
              <Copy className="w-3.5 h-3.5" />
              Salin Kode LaTeX
            </Btn>
          </div>
        )}
      </div>

      <ToolInfoPanel
        icon={<Workflow className="w-5 h-5" />}
        label="Diagram & Rumus Studio"
        desc="Maker + preview diagram, struktur, chart, dan rumus"
        points={[
          "Diagram pakai sintaks Mermaid — flowchart, sequence, struktur organisasi, pie chart, hingga mindmap.",
          "Rumus ditulis dalam format LaTeX dan langsung dirender sebagai notasi matematika yang rapi.",
          "Semua dirender di browser, hasil diagram bisa diunduh sebagai SVG/PNG — tidak ada data yang dikirim ke server.",
        ]}
      />
    </div>
    </div>
  );
};
