import React, { useEffect, useRef, useState } from "react";
import { Loader2, FileWarning } from "lucide-react";
import { cn } from "@/utils/cn";
import { loadPdfDocument, renderPageToCanvas } from "@/lib/pdfRender";

/**
 * GamatoPdfPage — engine pratinjau halaman PDF kustom bermerek Gamato Piranti.
 * Merender halaman PDF ke <canvas> lewat pdf.js secara native oleh Gamato Piranti —
 * tidak memakai `<iframe>`/plugin viewer PDF bawaan browser sama sekali.
 */
export function GamatoPdfPage({
  src,
  page,
  height = 440,
  className,
}: {
  src: string | null;
  page: number;
  height?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<any>(null);
  const loadedSrcRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setStatus("idle");
      docRef.current = null;
      loadedSrcRef.current = null;
      return;
    }

    async function renderPage() {
      try {
        if (loadedSrcRef.current !== src) {
          setStatus("loading");
          const res = await fetch(src as string);
          const buf = await res.arrayBuffer();
          if (cancelled) return;
          docRef.current = await loadPdfDocument(buf);
          loadedSrcRef.current = src;
        }
        const pdf = docRef.current;
        if (!pdf) return;
        const clampedPage = Math.min(Math.max(1, page), pdf.numPages || 1);
        const container = containerRef.current;
        if (!container) return;
        // Render pada scale rendah dulu untuk cek rasio, lalu render final proporsional dengan tinggi target.
        const baseCanvas = await renderPageToCanvas(pdf, clampedPage, 1);
        const scale = height / baseCanvas.height;
        const canvas = scale === 1 ? baseCanvas : await renderPageToCanvas(pdf, clampedPage, scale);
        if (cancelled) return;
        canvas.className = "max-w-full h-auto block mx-auto rounded shadow-sm";
        container.innerHTML = "";
        container.appendChild(canvas);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    renderPage();
    return () => {
      cancelled = true;
    };
  }, [src, page, height]);

  return (
    <div
      className={cn("relative w-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden", className)}
      style={{ height }}
    >
      <div ref={containerRef} className="contents" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-950/80">
          <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-slate-400 text-xs">
          <FileWarning className="w-5 h-5" />
          Gagal merender halaman
        </div>
      )}
      {status === "idle" && <div className="text-xs text-slate-300 dark:text-slate-600">Belum ada file</div>}
    </div>
  );
}
