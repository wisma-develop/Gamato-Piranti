import { PDFDocument, PDFName, PDFRawStream, PDFNumber } from "pdf-lib";
import { loadImageFromUrl } from "@/lib/canvas";

export type CompressLevel = "low" | "medium" | "high";

const LEVEL_SETTINGS: Record<CompressLevel, { quality: number; maxDim: number }> = {
  low: { quality: 0.85, maxDim: 2200 },
  medium: { quality: 0.68, maxDim: 1600 },
  high: { quality: 0.5, maxDim: 1100 },
};

export interface CompressResult {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  imagesProcessed: number;
}

/**
 * Real PDF compression: finds every JPEG (DCTDecode) image embedded in the
 * PDF, decodes it in the browser, downsamples it if it's larger than the
 * target resolution, and re-encodes it at a lower JPEG quality — then
 * swaps the smaller bytes back into the same PDF object so every page that
 * references it benefits. Falls back to pdf-lib's own stream/object
 * compaction (`useObjectStreams`) for everything else (fonts, text,
 * non-JPEG images are left untouched to avoid corrupting them).
 */
export async function compressPdf(bytes: ArrayBuffer, level: CompressLevel): Promise<CompressResult> {
  const originalSize = bytes.byteLength;
  const { quality, maxDim } = LEVEL_SETTINGS[level];
  const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });

  let imagesProcessed = 0;

  try {
    const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
    for (const [ref, obj] of indirectObjects) {
      if (!(obj instanceof PDFRawStream)) continue;
      const dict = obj.dict;

      const subtype = dict.get(PDFName.of("Subtype"));
      if (!subtype || subtype.toString() !== "/Image") continue;

      const filterEntry = dict.get(PDFName.of("Filter"));
      const filterStr = filterEntry ? filterEntry.toString() : "";
      if (!filterStr.includes("DCTDecode")) continue; // only re-encode already-JPEG images, safest path

      try {
        const rawBytes = obj.getContents();
        if (!rawBytes || rawBytes.length < 8) continue;

        const blob = new Blob([rawBytes], { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);
        let img;
        try {
          img = await loadImageFromUrl(url);
        } finally {
          URL.revokeObjectURL(url);
        }

        let targetW = img.naturalWidth;
        let targetH = img.naturalHeight;
        if (Math.max(targetW, targetH) > maxDim) {
          const scale = maxDim / Math.max(targetW, targetH);
          targetW = Math.max(1, Math.round(targetW * scale));
          targetH = Math.max(1, Math.round(targetH * scale));
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const newBlob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
        if (!newBlob) continue;
        const newBytes = new Uint8Array(await newBlob.arrayBuffer());

        if (newBytes.length >= rawBytes.length) continue; // never make it bigger

        dict.set(PDFName.of("Width"), PDFNumber.of(targetW));
        dict.set(PDFName.of("Height"), PDFNumber.of(targetH));
        dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
        dict.delete(PDFName.of("DecodeParms"));
        dict.delete(PDFName.of("Decode"));

        const newStream = PDFRawStream.of(dict, newBytes);
        pdfDoc.context.assign(ref, newStream);
        imagesProcessed++;
      } catch {
        // Any failure on a single image (unsupported colorspace, corrupt
        // stream, canvas taint, etc.) — skip it and keep the original.
        continue;
      }
    }
  } catch {
    // If low-level object traversal isn't available for some reason, we
    // still fall back to the safe structural compaction below.
  }

  const savedBytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes: savedBytes,
    originalSize,
    compressedSize: savedBytes.length,
    imagesProcessed,
  };
}
