import QRCodeStyling from "qr-code-styling";
import { qrUtf8Data } from "@/lib/qrUtf8";
export { qrUtf8Data };
import { composeFramedQrCanvas, canvasToBlob, type QrFrameOptions } from "@/lib/qrFrame";

export type QrExt = "png" | "jpeg" | "webp" | "svg";
export type QrStylingOptions = ConstructorParameters<typeof QRCodeStyling>[0];

const MIME: Record<Exclude<QrExt, "svg">, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas 2D unavailable");
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  return c;
}

/**
 * Render satu QR menjadi Blob pada opsi/ukuran yang diberikan — tanpa menyentuh preview di layar.
 * Dipakai oleh unduhan tunggal DAN ekspor massal, sehingga keduanya selalu identik dengan preview.
 *
 *  - SVG: vektor asli dari pustaka (tanpa bingkai — bingkai hanya untuk raster).
 *  - PNG/WEBP: langsung dari pustaka bila tanpa bingkai; dengan bingkai, di-komposit dulu.
 *  - JPEG: JPEG tidak punya alpha → latar transparan HARUS diratakan ke warna solid, kalau tidak hasilnya hitam.
 */
export async function renderQrBlob(opts: QrStylingOptions, ext: QrExt, frame?: QrFrameOptions | null, flattenColor = "#ffffff"): Promise<Blob> {
  const inst = new QRCodeStyling(opts);
  if (ext === "svg") {
    const raw = await inst.getRawData("svg");
    if (!raw) throw new Error("empty svg");
    return raw instanceof Blob ? raw : new Blob([raw as BlobPart], { type: "image/svg+xml" });
  }

  const pngRaw = await inst.getRawData("png");
  if (!pngRaw) throw new Error("empty png");
  const pngBlob = pngRaw instanceof Blob ? pngRaw : new Blob([pngRaw as BlobPart], { type: "image/png" });
  if (!frame && ext === "png") return pngBlob;
  if (!frame && ext === "webp") {
    const w = await inst.getRawData("webp");
    if (w) return w instanceof Blob ? w : new Blob([w as BlobPart], { type: "image/webp" });
  }

  let canvas = await blobToCanvas(pngBlob);
  if (frame) canvas = await composeFramedQrCanvas(canvas, frame);
  if (ext === "jpeg") {
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    const fctx = flat.getContext("2d");
    if (!fctx) throw new Error("canvas 2D unavailable");
    fctx.fillStyle = flattenColor;
    fctx.fillRect(0, 0, flat.width, flat.height);
    fctx.drawImage(canvas, 0, 0);
    canvas = flat;
  }
  const out = await canvasToBlob(canvas, MIME[ext], ext === "png" ? undefined : 0.95);
  if (!out) throw new Error("encode failed");
  return out;
}

export type QrVerifyResult = { status: "ok" } | { status: "mismatch"; decoded: string } | { status: "unreadable" };

let verifyWorker: Worker | null = null;
let verifySeq = 0;
const verifyPending = new Map<number, (text: string | null) => void>();

function getVerifyWorker(): Worker | null {
  if (verifyWorker) return verifyWorker;
  try {
    const w = new Worker(new URL("./qrVerify.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<{ id: number; text: string | null }>) => {
      verifyPending.get(e.data.id)?.(e.data.text);
      verifyPending.delete(e.data.id);
    };
    w.onerror = () => {
      // Worker gagal (mis. lingkungan yang memblokirnya): lepaskan semua yang menunggu agar jatuh ke jalur main-thread.
      verifyPending.forEach((resolve) => resolve(null));
      verifyPending.clear();
      verifyWorker = null;
    };
    verifyWorker = w;
    return w;
  } catch {
    return null;
  }
}

async function decodeInWorker(img: ImageData): Promise<string | null | undefined> {
  const w = getVerifyWorker();
  if (!w) return undefined; // tidak tersedia → pemanggil memakai jalur main-thread
  const id = ++verifySeq;
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => { verifyPending.delete(id); resolve(undefined); }, 8000);
    verifyPending.set(id, (text) => { window.clearTimeout(timer); resolve(text); });
    const copy = img.data.buffer.slice(0);
    w.postMessage({ id, buffer: copy, w: img.width, h: img.height }, [copy]);
  });
}

/**
 * Verifikasi nyata (bukan tebakan): hasil render QR di-decode ulang dengan jsQR dan dibandingkan dengan isi yang dimaksud.
 * Decode berjalan di Web Worker (tidak memblokir UI); canvas diperkecil dulu agar cepat.
 */
export async function verifyQrCanvas(canvas: HTMLCanvasElement, expected: string): Promise<QrVerifyResult> {
  // Semakin panjang isi, semakin banyak modul → probe harus lebih besar agar tiap modul tetap ≥ ±6 px.
  const MAX = expected.length > 300 ? 1200 : expected.length > 120 ? 800 : 560;
  const scale = Math.min(1, MAX / Math.max(canvas.width, canvas.height));
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const probe = document.createElement("canvas");
  probe.width = w;
  probe.height = h;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { status: "unreadable" };
  // Latar transparan → putih, supaya hasil decode meniru kertas/layar yang dipindai sungguhan.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(canvas, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);

  let text = await decodeInWorker(img);
  if (text === undefined) {
    const { default: jsQR } = await import("jsqr");
    const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" }) ?? jsQR(img.data, w, h, { inversionAttempts: "onlyInvert" });
    text = code ? code.data : null;
  }
  if (text === null) return { status: "unreadable" };
  return text === expected ? { status: "ok" } : { status: "mismatch", decoded: text };
}
