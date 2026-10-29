// Jaminan "jernih" untuk SEMUA kanvas 2D di aplikasi: setiap konteks 2D baru
// otomatis memakai smoothing kualitas TINGGI. Tanpa ini, browser memakai
// kualitas "low" saat memperkecil gambar (logo, foto, tanda tangan, tangkapan
// layar) sehingga hasilnya bergerigi/pecah. Alat yang sengaja mematikan
// smoothing (mis. pixelate) tetap bisa mengaturnya sendiri sesudahnya.

type GetContext = HTMLCanvasElement["getContext"];

export function installHighQualityCanvasDefaults() {
  if (typeof HTMLCanvasElement === "undefined") return;
  const proto = HTMLCanvasElement.prototype as any;
  if (proto.__gpHighQuality) return;
  const original: GetContext = proto.getContext;
  proto.getContext = function patchedGetContext(this: HTMLCanvasElement, type: string, ...rest: any[]) {
    const fresh = type === "2d" && !(this as any).__gpCtxInit;
    const ctx = (original as any).call(this, type, ...rest);
    if (fresh && ctx) {
      (this as any).__gpCtxInit = true;
      (this as any).__gpCtx = ctx;
      try {
        (ctx as CanvasRenderingContext2D).imageSmoothingEnabled = true;
        (ctx as CanvasRenderingContext2D).imageSmoothingQuality = "high";
      } catch {
        /* konteks khusus (mis. bitmaprenderer) — abaikan */
      }
    }
    return ctx;
  };

  // Mengubah width/height kanvas me-reset state konteks (smoothing kembali ke "low").
  // Terapkan ulang otomatis supaya jaminan kualitas tidak hilang setelah resize.
  for (const key of ["width", "height"] as const) {
    const desc = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, key);
    if (!desc || !desc.set || !desc.get) continue;
    Object.defineProperty(HTMLCanvasElement.prototype, key, {
      configurable: true,
      enumerable: desc.enumerable,
      get: desc.get,
      set(this: HTMLCanvasElement, v: number) {
        desc.set!.call(this, v);
        const ctx = (this as any).__gpCtx as CanvasRenderingContext2D | undefined;
        if (ctx) {
          try {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
          } catch {
            /* abaikan */
          }
        }
      },
    });
  }

  // JPEG tidak mendukung transparansi: browser mengisi area transparan dengan HITAM, sehingga PNG/WebP/logo
  // transparan yang diekspor ke JPEG tampil dengan latar hitam. Ratakan di atas PUTIH lebih dulu — berlaku
  // untuk semua alat (kompres, resize, crop, watermark, kolase, editor foto, dst.) agar hasil unduhan
  // sama dengan yang terlihat di pratinjau.
  const flattenOnWhite = (src: HTMLCanvasElement): HTMLCanvasElement | null => {
    try {
      if (!src.width || !src.height) return null;
      const tmp = document.createElement("canvas");
      tmp.width = src.width;
      tmp.height = src.height;
      const c = tmp.getContext("2d");
      if (!c) return null;
      c.fillStyle = "#ffffff";
      c.fillRect(0, 0, tmp.width, tmp.height);
      c.drawImage(src, 0, 0);
      return tmp;
    } catch {
      return null;
    }
  };
  const isJpeg = (t?: string) => typeof t === "string" && /^image\/jpe?g$/i.test(t);

  const origToBlob = proto.toBlob as HTMLCanvasElement["toBlob"];
  proto.toBlob = function patchedToBlob(this: HTMLCanvasElement, cb: BlobCallback, type?: string, quality?: any) {
    const src = isJpeg(type) ? flattenOnWhite(this) ?? this : this;
    return origToBlob.call(src, cb, type, quality);
  };
  const origToDataURL = proto.toDataURL as HTMLCanvasElement["toDataURL"];
  proto.toDataURL = function patchedToDataURL(this: HTMLCanvasElement, type?: string, quality?: any) {
    const src = isJpeg(type) ? flattenOnWhite(this) ?? this : this;
    return origToDataURL.call(src, type, quality);
  };
  proto.__gpHighQuality = true;
}
