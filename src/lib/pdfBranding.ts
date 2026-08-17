import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";

// ─── Gamato Piranti PDF identity stamp ─────────────────────────────────────
// Adds a small, unobtrusive logo + label to the corner of every page of a
// generated PDF, in addition to the download filename already carrying the
// "gamato-" prefix. Used by every tool that *creates* a new PDF (merge,
// split, organize, extract, images→pdf, teks→pdf, watermark, page numbers,
// certificate/CV/invoice/kwitansi/struk/business-card exports, doc studio
// export, html→pdf, scan→pdf, edit).
//
// Intentionally NOT used on tools whose whole job is to preserve a document
// byte-for-byte / as-is (Protect, Unlock, Redact, Sign, Compress) — stamping
// those would work against the tool's actual purpose.

let cachedLogoBytesPromise: Promise<Uint8Array | null> | null = null;

async function getLogoBytes(): Promise<Uint8Array | null> {
  if (!cachedLogoBytesPromise) {
    cachedLogoBytesPromise = fetch("/gamato-piranti.png")
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error("logo not found"))))
      .then((buf) => new Uint8Array(buf))
      .catch(() => null);
  }
  return cachedLogoBytesPromise;
}

export interface StampBrandingOptions {
  /** Main label text. Default: "Dibuat dengan Gamato Piranti" */
  label?: string;
  /** Secondary/tagline text under the label. Default: "WisDev · gamato-piranti.vercel.app" */
  sub?: string;
  /** Skip pages smaller than this (points) on either side — avoids cluttering tiny labels/receipts. Default 70. */
  minPageSizePt?: number;
  /** Only stamp the first page instead of every page (useful for single-image exports repeated per page). Default false. */
  firstPageOnly?: boolean;
}

/**
 * Stamps the Gamato Piranti identity (logo + text) into the bottom-left
 * corner of each page, and sets PDF metadata (Producer/Creator). Never
 * throws — if anything goes wrong (logo missing, font issue), it fails
 * silently so branding never breaks the actual export.
 */
export async function stampGamatoBranding(pdfDoc: PDFDocument, opts: StampBrandingOptions = {}): Promise<void> {
  try {
    const label = opts.label ?? "Dibuat dengan Gamato Piranti";
    const sub = opts.sub ?? "WisDev · gamato-piranti.vercel.app";
    const minPageSizePt = opts.minPageSizePt ?? 70;

    try {
      pdfDoc.setProducer("Gamato Piranti — WisDev");
      pdfDoc.setCreator("Gamato Piranti (gamato-piranti.vercel.app)");
    } catch {
      /* metadata is best-effort */
    }

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const logoBytes = await getLogoBytes();
    let logoImg: PDFImage | null = null;
    if (logoBytes) {
      try {
        logoImg = await pdfDoc.embedPng(logoBytes);
      } catch {
        logoImg = null;
      }
    }

    const pages = opts.firstPageOnly ? pdfDoc.getPages().slice(0, 1) : pdfDoc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const minDim = Math.min(width, height);
      if (minDim < minPageSizePt) continue; // too small to stamp cleanly (e.g. label/sticker sized pages)

      const compact = minDim < 260; // business card / receipt / small certificate crops
      const logoSize = compact ? Math.max(7, minDim * 0.075) : 13;
      const fontSize = compact ? Math.max(4, minDim * 0.028) : 6.5;
      const subFontSize = fontSize * 0.85;
      const marginX = compact ? Math.max(3, width * 0.025) : 9;
      const marginY = compact ? Math.max(3, height * 0.018) : 9;
      const gap = compact ? 3 : 5;

      let textX = marginX;
      if (logoImg) {
        const ratio = logoImg.height / logoImg.width || 1;
        const w = logoSize;
        const h = w * ratio;
        page.drawImage(logoImg, { x: marginX, y: marginY, width: w, height: h, opacity: 0.92 });
        textX = marginX + w + gap;
      }

      page.drawText(label, {
        x: textX,
        y: marginY + (compact ? logoSize * 0.34 : 5),
        size: fontSize,
        font,
        color: rgb(0.4, 0.44, 0.5),
      });
      if (!compact) {
        page.drawText(sub, {
          x: textX,
          y: marginY - subFontSize - 1,
          size: subFontSize,
          font,
          color: rgb(0.62, 0.65, 0.69),
        });
      }
    }
  } catch {
    // Branding is a nice-to-have — never let it break an actual export.
  }
}
