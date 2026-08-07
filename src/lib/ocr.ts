// Optical character recognition powered by Tesseract.js (WASM, runs fully
// in the browser). The worker + trained language data are fetched by
// Tesseract.js itself the first time OCR runs, so an internet connection
// is needed at that moment (same as any other web app dependency fetch) —
// no server round-trip of the actual document is involved either way.
import { createWorker } from "tesseract.js";

export async function runOcr(source: HTMLCanvasElement | string, lang: string): Promise<string> {
  const worker = await createWorker(lang);
  try {
    const { data } = await worker.recognize(source as any);
    return data.text || "";
  } finally {
    await worker.terminate();
  }
}
