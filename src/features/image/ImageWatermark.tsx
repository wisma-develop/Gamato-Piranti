import React, { useEffect, useRef, useState } from "react";
import { Layers, Image as ImageIcon, Loader2, Download, Type } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { loadImageFromUrl, canvasToBlob } from "@/lib/canvas";
import { Btn, Select, Label, Textarea } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

type Position = "top-left" | "top-center" | "top-right" | "middle-left" | "center" | "middle-right" | "bottom-left" | "bottom-center" | "bottom-right" | "tile";

const POSITIONS: { id: Position; label: string }[] = [
  { id: "top-left", label: "↖" },
  { id: "top-center", label: "↑" },
  { id: "top-right", label: "↗" },
  { id: "middle-left", label: "←" },
  { id: "center", label: "•" },
  { id: "middle-right", label: "→" },
  { id: "bottom-left", label: "↙" },
  { id: "bottom-center", label: "↓" },
  { id: "bottom-right", label: "↘" },
  { id: "tile", label: "▦" },
];

const FONT_FAMILIES = ["Alan Sans, sans-serif", "Arial, sans-serif", "Georgia, serif", "'Times New Roman', serif", "'Courier New', monospace"];

function anchorCenter(pos: Position, cw: number, ch: number, boxW: number, boxH: number): [number, number] {
  const mx = 0.04 * cw;
  const my = 0.04 * ch;
  let x = cw / 2;
  let y = ch / 2;
  if (pos.includes("left")) x = mx + boxW / 2;
  else if (pos.includes("right")) x = cw - mx - boxW / 2;
  if (pos.includes("top")) y = my + boxH / 2;
  else if (pos.includes("bottom")) y = ch - my - boxH / 2;
  return [x, y];
}

export const ImageWatermark: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [baseImg, setBaseImg] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<"text" | "logo">("text");
  const [text, setText] = useState("Gamato Piranti");
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0]);
  const [sizePercent, setSizePercent] = useState(6);
  const [color, setColor] = useState("#ffffff");
  const [opacity, setOpacity] = useState(55);
  const [rotation, setRotation] = useState(-25);
  const [position, setPosition] = useState<Position>("center");
  const [spacing, setSpacing] = useState(14);
  const [outputFormat, setOutputFormat] = useState<"png" | "jpeg">("png");

  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = async (incoming: File[]) => {
    const f = incoming.find((x) => x.type.startsWith("image/"));
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = await loadImageFromUrl(url);
    URL.revokeObjectURL(url);
    setFile(f);
    setBaseImg(img);
    setInfo(null);
  };

  const addLogo = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = await loadImageFromUrl(url);
    URL.revokeObjectURL(url);
    setLogoImg(img);
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImg) return;
    canvas.width = baseImg.naturalWidth;
    canvas.height = baseImg.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImg, 0, 0);
    ctx.globalAlpha = opacity / 100;
    ctx.fillStyle = color;

    if (mode === "text" && text.trim()) {
      const size = (sizePercent / 100) * canvas.width;
      ctx.font = `bold ${size}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const boxW = ctx.measureText(text).width;
      const boxH = size;
      if (position === "tile") {
        const stepX = boxW + (spacing / 100) * canvas.width;
        const stepY = boxH * 2.2 + (spacing / 100) * canvas.width;
        for (let y = -stepY; y < canvas.height + stepY; y += stepY) {
          for (let x = -stepX; x < canvas.width + stepX; x += stepX) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.fillText(text, 0, 0);
            ctx.restore();
          }
        }
      } else {
        const [ax, ay] = anchorCenter(position, canvas.width, canvas.height, boxW, boxH);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
    } else if (mode === "logo" && logoImg) {
      const boxW = (sizePercent / 100) * canvas.width * 2.5;
      const boxH = logoImg.naturalHeight * (boxW / logoImg.naturalWidth);
      const draw = (cx: number, cy: number) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(logoImg, -boxW / 2, -boxH / 2, boxW, boxH);
        ctx.restore();
      };
      if (position === "tile") {
        const stepX = boxW + (spacing / 100) * canvas.width;
        const stepY = boxH + (spacing / 100) * canvas.width;
        for (let y = -stepY; y < canvas.height + stepY; y += stepY) {
          for (let x = -stepX; x < canvas.width + stepX; x += stepX) draw(x, y);
        }
      } else {
        const [ax, ay] = anchorCenter(position, canvas.width, canvas.height, boxW, boxH);
        draw(ax, ay);
      }
    }
    ctx.globalAlpha = 1;
  };

  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseImg, logoImg, mode, text, fontFamily, sizePercent, color, opacity, rotation, position, spacing]);

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    setIsWorking(true);
    try {
      const mime = outputFormat === "png" ? "image/png" : "image/jpeg";
      const blob = await canvasToBlob(canvasRef.current, mime, mime === "image/jpeg" ? 0.92 : undefined);
      const base = (file?.name || "gambar").replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}-watermark.${outputFormat === "png" ? "png" : "jpg"}`);
      setInfo("Watermark berhasil ditambahkan.");
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal memproses gambar."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-5">
        {!baseImg ? (
          <Dropzone
            onFiles={addFiles}
            accept="image/*"
            multiple={false}
            label="Drop gambar di sini"
            sublabel="JPG, PNG, WEBP"
            icon={<ImageIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file?.name}</p>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setBaseImg(null);
                  setInfo(null);
                }}
                className="text-sm text-red-500 font-semibold hover:text-red-700 shrink-0"
              >
                Ganti File
              </button>
            </div>
            <div className="p-4 flex justify-center bg-slate-100 dark:bg-slate-950">
              <canvas ref={canvasRef} className="max-w-full max-h-[460px] rounded-lg shadow" />
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([
              ["text", "Teks", <Type key="t" className="w-4 h-4" />],
              ["logo", "Logo/Gambar", <ImageIcon key="i" className="w-4 h-4" />],
            ] as const).map(([id, label, icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                  mode === id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {mode === "text" ? (
            <>
              <Textarea label="Teks Watermark" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Contoh: © Namamu 2026" />
              <Select label="Font" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>
                    {f.split(",")[0].replace(/'/g, "")}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-3">
                <Label>Warna</Label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer" />
              </div>
            </>
          ) : (
            <div>
              <Label>Upload Logo (PNG transparan disarankan)</Label>
              <input type="file" accept="image/*" onChange={(e) => addLogo(e.target.files)} className="mt-1.5 text-sm text-slate-600 dark:text-slate-300" />
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Ukuran</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{sizePercent}%</span>
            </div>
            <input type="range" min={2} max={30} value={sizePercent} onChange={(e) => setSizePercent(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Opacity</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{opacity}%</span>
            </div>
            <input type="range" min={5} max={100} value={opacity} onChange={(e) => setOpacity(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Rotasi</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{rotation}°</span>
            </div>
            <input type="range" min={-45} max={45} value={rotation} onChange={(e) => setRotation(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
          </div>

          <div>
            <Label>Posisi</Label>
            <div className="grid grid-cols-5 gap-1.5 mt-1.5">
              {POSITIONS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPosition(p.id)}
                  title={p.id}
                  className={cn(
                    "h-9 rounded-lg text-base font-bold border-2 transition-all",
                    position === p.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {position === "tile" && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label>Jarak antar pola</Label>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{spacing}%</span>
              </div>
              <input type="range" min={2} max={40} value={spacing} onChange={(e) => setSpacing(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-600 bg-slate-200 dark:bg-slate-700" />
            </div>
          )}

          <Select label="Format Output" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as any)}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </Select>
        </div>

        {info && (
          <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", info.startsWith("Gagal") ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30" : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30")}>
            {info}
          </div>
        )}

        <Btn onClick={handleDownload} disabled={isWorking || !baseImg} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Unduh Gambar
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<Layers className="w-5 h-5" />}
        label="Watermark Gambar"
        desc="Teks atau logo"
        points={[
          "Watermark teks atau logo, bisa sekali tempel atau diulang (tile) ke seluruh gambar.",
          "Atur ukuran, warna, opacity, rotasi, dan posisi secara real-time di preview.",
        ]}
      />
    </div>
  );
};
