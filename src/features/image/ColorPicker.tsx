import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pipette, Upload, Copy, Check } from "lucide-react";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { useImageFromFile } from "@/hooks/useImageFromFile";
import { copyToClipboard } from "@/lib/utilityHelpers";
import { rgbToHsl, extractPalette, type PaletteColor } from "@/lib/color";

type Picked = { hex: string; r: number; g: number; b: number };

const MAX_DISPLAY_WIDTH = 720;

export function ColorPicker() {
  const [file, setFile] = useState<File | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [palette, setPalette] = useState<PaletteColor[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const img = useImageFromFile(file);

  const handleFiles = (files: File[]) => {
    const f = files.find((x) => x.type.startsWith("image/"));
    if (f) {
      setFile(f);
      setPicked(null);
    }
  };

  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const scale = Math.min(1, MAX_DISPLAY_WIDTH / img.naturalWidth);
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setPalette(extractPalette(imageData, 8));
  }, [img]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * canvas.height);
    const data = ctx.getImageData(Math.min(canvas.width - 1, Math.max(0, x)), Math.min(canvas.height - 1, Math.max(0, y)), 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
    setPicked({ hex, r, g, b });
  }, []);

  const copy = async (text: string, key: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
    }
  };

  const hsl = picked ? rgbToHsl(picked.r, picked.g, picked.b) : null;

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-4">
        {!file ? (
          <Dropzone
            onFiles={handleFiles}
            accept="image/*"
            multiple={false}
            label="Drop gambar di sini"
            sublabel="JPG, PNG, WEBP — klik di gambar untuk ambil warna"
            icon={<Upload className="w-8 h-8" />}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
            <canvas ref={canvasRef} onClick={handleCanvasClick} className="w-full h-auto rounded-xl cursor-crosshair block" />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">Klik di mana saja pada gambar untuk mengambil warnanya.</p>
          </div>
        )}

        {palette.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Palet Warna Dominan</p>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {palette.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setPicked({ hex: c.hex, r: c.r, g: c.g, b: c.b })}
                  className="group flex flex-col items-center gap-1.5"
                  title={c.hex}
                >
                  <span className="w-full aspect-square rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm block group-hover:scale-105 transition-transform" style={{ backgroundColor: c.hex }} />
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{c.hex}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        {picked && hsl ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <div className="w-full h-24 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner" style={{ backgroundColor: picked.hex }} />
            {[
              { key: "hex", label: "HEX", value: picked.hex },
              { key: "rgb", label: "RGB", value: `rgb(${picked.r}, ${picked.g}, ${picked.b})` },
              { key: "hsl", label: "HSL", value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
            ].map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => copy(row.value, row.key)}
                className="w-full flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="text-slate-400 dark:text-slate-500 font-semibold text-xs uppercase tracking-wide">{row.label}</span>
                <span className="flex items-center gap-2 font-mono text-slate-800 dark:text-slate-100">
                  {row.value}
                  {copiedKey === row.key ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm text-sm text-slate-400 dark:text-slate-500 text-center">
            Belum ada warna dipilih.
          </div>
        )}

        {file && (
          <button type="button" onClick={() => { setFile(null); setPicked(null); setPalette([]); }} className="w-full text-xs text-slate-400 hover:text-red-500 font-semibold">
            Ganti Gambar
          </button>
        )}

        <ToolInfoPanel
          icon={<Pipette className="w-5 h-5" />}
          label="Color Picker & Palette"
          desc="Ambil warna & palet dominan dari gambar"
          points={[
            "Klik langsung di gambar untuk membaca warna piksel manapun.",
            "Palet dominan dihitung otomatis dari seluruh gambar — klik salah satu untuk melihat detailnya.",
            "Semua nilai HEX/RGB/HSL tinggal diklik untuk disalin.",
          ]}
        />
      </div>
    </div>
  );
}
