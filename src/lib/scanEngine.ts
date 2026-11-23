type JsQR = typeof import("jsqr").default;
let jsQR: JsQR | null = null;
async function ensureJsQR(): Promise<void> {
  if (!jsQR) jsQR = (await import("jsqr")).default; // ±130 KB: hanya dimuat saat pemindaian pertama
}

export interface ScanPoint { x: number; y: number }
export interface ScanHit {
  text: string;
  /** Nama format ala BarcodeDetector: qr_code, ean_13, code_128, … */
  format: string;
  /** Sudut kode dalam koordinat canvas ASLI yang dipindai (untuk overlay). */
  points?: ScanPoint[];
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue?: string; format?: string; cornerPoints?: ScanPoint[]; boundingBox?: DOMRectReadOnly }[]> } | null;

const MAX_SIDE = 2400;

function scaled(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  if (factor === 1) return src;
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(src.width * factor));
  c.height = Math.max(1, Math.round(src.height * factor));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, c.width, c.height);
  }
  return c;
}

/** jsQR hanya mengembalikan satu kode per panggilan. Untuk banyak kode: setelah satu ketemu, area-nya dikosongkan lalu dicari lagi. */
function jsqrAll(canvas: HTMLCanvasElement, maxHits: number): ScanHit[] {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const out: ScanHit[] = [];
  for (let i = 0; i < maxHits; i++) {
    const code = jsQR!(img.data, w, h, { inversionAttempts: "attemptBoth" });
    if (!code?.data && !code?.binaryData?.length) break;
    const l = code.location;
    const pts = [l.topLeftCorner, l.topRightCorner, l.bottomRightCorner, l.bottomLeftCorner];
    out.push({ text: code.data, format: "qr_code", points: pts.map((p) => ({ x: p.x, y: p.y })) });
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const padX = (Math.max(...xs) - Math.min(...xs)) * 0.08, padY = (Math.max(...ys) - Math.min(...ys)) * 0.08;
    const x0 = Math.max(0, Math.floor(Math.min(...xs) - padX)), x1 = Math.min(w, Math.ceil(Math.max(...xs) + padX));
    const y0 = Math.max(0, Math.floor(Math.min(...ys) - padY)), y1 = Math.min(h, Math.ceil(Math.max(...ys) + padY));
    for (let y = y0; y < y1; y++) {
      const row = y * w * 4;
      for (let x = x0; x < x1; x++) { const o = row + x * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = 255; }
    }
  }
  return out;
}

async function detectorAll(canvas: HTMLCanvasElement, detector: Detector): Promise<ScanHit[]> {
  if (!detector) return [];
  try {
    const found = await detector.detect(canvas);
    return found
      .filter((f) => f.rawValue)
      .map((f) => {
        const b = f.boundingBox;
        const pts = f.cornerPoints?.length ? f.cornerPoints.map((p) => ({ x: p.x, y: p.y }))
          : b ? [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y }, { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height }] : undefined;
        return { text: f.rawValue as string, format: f.format || "qr_code", points: pts };
      });
  } catch {
    return [];
  }
}

function mergeUnique(into: ScanHit[], more: ScanHit[]) {
  for (const h of more) if (!into.some((x) => x.text === h.text && x.format === h.format)) into.push(h);
}

/**
 * jsQR sering gagal bila beberapa QR berdekatan dalam satu gambar (pola sudutnya salah dikelompokkan), dan QR kecil di foto besar
 * mudah terlewat. Memindai potongan (petak) yang saling tumpang tindih menyelesaikan keduanya.
 */
const TILE_GRIDS: [number, number][] = [[2, 1], [1, 2], [2, 2], [3, 1], [3, 2], [3, 3], [4, 3]];
function tileScan(src: HTMLCanvasElement): ScanHit[] {
  if (Math.min(src.width, src.height) < 240) return [];
  const out: ScanHit[] = [];
  for (const [nx, ny] of TILE_GRIDS) {
    const tw = src.width / (nx - (nx - 1) * 0.3 + 0), th = src.height / (ny - (ny - 1) * 0.3);
    const stepX = nx > 1 ? (src.width - tw) / (nx - 1) : 0, stepY = ny > 1 ? (src.height - th) / (ny - 1) : 0;
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        const x0 = Math.round(ix * stepX), y0 = Math.round(iy * stepY);
        const w = Math.round(tw), h = Math.round(th);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) continue;
        ctx.drawImage(src, x0, y0, w, h, 0, 0, w, h);
        for (const hit of jsqrAll(c, 2)) {
          mergeUnique(out, [{ ...hit, points: hit.points?.map((pt) => ({ x: pt.x + x0, y: pt.y + y0 })) }]);
        }
      }
    }
  }
  return out;
}

/**
 * Pindai satu canvas.
 *  - "fast": satu lintasan (untuk frame kamera real-time).
 *  - "thorough": beberapa skala (gambar foto beresolusi tinggi sering terbaca lebih baik setelah diperkecil, QR kecil setelah diperbesar).
 * Mengembalikan SEMUA kode yang ditemukan pada lintasan pertama yang berhasil.
 */
export async function scanCanvas(src: HTMLCanvasElement, detector: Detector, mode: "fast" | "thorough" = "thorough"): Promise<ScanHit[]> {
  await ensureJsQR();
  const f0 = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
  const factors = mode === "fast" ? [f0] : [f0, f0 * 0.5, f0 * 0.3, Math.min(2, f0 * 1.6)];
  for (const f of factors) {
    const c = scaled(src, f);
    const hits: ScanHit[] = [];
    mergeUnique(hits, await detectorAll(c, detector));
    mergeUnique(hits, jsqrAll(c, mode === "fast" ? 1 : 8));
    if (mode === "thorough") mergeUnique(hits, tileScan(c));
    if (hits.length) {
      // Kembalikan titik ke koordinat canvas asli.
      return hits.map((h) => ({ ...h, points: h.points?.map((p) => ({ x: p.x / f, y: p.y / f })) }));
    }
  }
  return [];
}

/** Gambar kotak + nomor pada setiap kode yang ditemukan. */
export function drawHits(ctx: CanvasRenderingContext2D, hits: ScanHit[], activeIndex = -1, scale = 1) {
  const lw = Math.max(3, Math.round(Math.max(ctx.canvas.width, ctx.canvas.height) / 220)) * scale;
  hits.forEach((h, i) => {
    if (!h.points || h.points.length < 3) return;
    const active = i === activeIndex;
    ctx.save();
    ctx.lineWidth = active ? lw * 1.4 : lw;
    ctx.strokeStyle = active ? "#22c55e" : "#6366f1";
    ctx.fillStyle = active ? "rgba(34,197,94,0.18)" : "rgba(99,102,241,0.14)";
    ctx.beginPath();
    h.points.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const p0 = h.points[0];
    const fs = lw * 6;
    ctx.font = `700 ${fs}px sans-serif`;
    const label = String(i + 1);
    const tw = ctx.measureText(label).width + fs * 0.7;
    ctx.fillStyle = active ? "#16a34a" : "#4f46e5";
    ctx.fillRect(p0.x, Math.max(0, p0.y - fs * 1.4), tw, fs * 1.4);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, p0.x + fs * 0.35, Math.max(0, p0.y - fs * 1.4) + fs * 0.7);
    ctx.restore();
  });
}
