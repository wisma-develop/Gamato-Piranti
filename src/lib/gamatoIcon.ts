// Ikon asli Gamato Piranti (/gamato-piranti.png) untuk semua watermark & identitas ekspor.
//
// Berkas aslinya berupa heksagon dengan ruang transparan lebar di sekelilingnya (isi hanya ±70% kanvas),
// sehingga bila dipakai apa adanya ukuran & posisinya meleset dari yang diatur. Modul ini memuat berkas
// asli SATU kali, memangkas bagian transparan, lalu men-cache hasilnya — satu sumber kebenaran: bila
// berkas ikon diganti di /public, semua watermark ikut berubah tanpa mengubah kode.

export const GAMATO_ICON_URL = "/gamato-piranti.png";
export const GAMATO_SITE = "gamatopiranti.zone.id";
export const GAMATO_NAME = "Gamato Piranti";

export interface GamatoIcon {
  /** Kanvas ikon yang sudah dipangkas (siap untuk drawImage). */
  canvas: HTMLCanvasElement;
  /** Lebar ÷ tinggi ikon yang terlihat. */
  ratio: number;
}

let iconPromise: Promise<GamatoIcon | null> | null = null;
let pngPromise: Promise<Uint8Array | null> | null = null;
let cached: GamatoIcon | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Ikon Gamato Piranti tidak ditemukan."));
    img.src = url;
  });
}

/** Memuat ikon (sekali) dan memangkas tepi transparan. Mengembalikan null bila gagal — tidak pernah melempar. */
export function loadGamatoIcon(): Promise<GamatoIcon | null> {
  if (!iconPromise) {
    iconPromise = (async () => {
      try {
        const img = await loadImage(GAMATO_ICON_URL);
        const w = img.naturalWidth, h = img.naturalHeight;
        const src = document.createElement("canvas");
        src.width = w; src.height = h;
        const sctx = src.getContext("2d", { willReadFrequently: true })!;
        sctx.drawImage(img, 0, 0);
        const data = sctx.getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 12) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        if (x1 < x0 || y1 < y0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        const out = document.createElement("canvas");
        out.width = cw; out.height = ch;
        out.getContext("2d")!.drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);
        cached = { canvas: out, ratio: cw / ch };
        return cached;
      } catch {
        return null;
      }
    })();
  }
  return iconPromise;
}

/** Versi sinkron — hanya terisi setelah loadGamatoIcon() selesai. */
export function gamatoIconIfReady(): GamatoIcon | null {
  return cached;
}

/** Ikon terpangkas sebagai bytes PNG (untuk pdf-lib embedPng). */
export function loadGamatoIconPng(): Promise<Uint8Array | null> {
  if (!pngPromise) {
    pngPromise = (async () => {
      const icon = await loadGamatoIcon();
      if (!icon) return null;
      const blob: Blob | null = await new Promise((r) => icon.canvas.toBlob(r, "image/png"));
      return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
    })();
  }
  return pngPromise;
}

/** Menggambar ikon berpusat di (cx, cy) dengan lebar `w` (tinggi mengikuti rasio). Kualitas penskalaan tinggi. */
export function drawGamatoIcon(ctx: CanvasRenderingContext2D, icon: GamatoIcon, cx: number, cy: number, w: number) {
  const h = w / icon.ratio;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(icon.canvas, cx - w / 2, cy - h / 2, w, h);
  ctx.restore();
}
