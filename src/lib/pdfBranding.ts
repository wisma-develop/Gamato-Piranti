import { PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { GAMATO_NAME, GAMATO_SITE, loadGamatoIconPng } from "@/lib/gamatoIcon";

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

export interface StampBrandingOptions {
  /** Main label text. Default: "Dibuat dengan Gamato Piranti" */
  label?: string;
  /** Secondary/tagline text under the label. Default: "WisDev · gamatopiranti.zone.id" */
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
    const label = opts.label ?? `Dibuat dengan ${GAMATO_NAME}`;
    const sub = opts.sub ?? `WisDev · ${GAMATO_SITE}`;
    const minPageSizePt = opts.minPageSizePt ?? 70;

    try {
      pdfDoc.setProducer(`${GAMATO_NAME} — WisDev`);
      pdfDoc.setCreator(`${GAMATO_NAME} (${GAMATO_SITE})`);
    } catch {
      /* metadata is best-effort */
    }

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    // Ikon asli yang sudah dipangkas dari ruang transparan → ukuran & posisi sesuai yang terlihat.
    const logoBytes = await loadGamatoIconPng();
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
      const iconH = compact ? Math.max(7, minDim * 0.075) : 14;
      const fontSize = compact ? Math.max(4, minDim * 0.028) : 6.8;
      const subFontSize = fontSize * 0.84;
      const marginX = compact ? Math.max(3, width * 0.025) : 9;
      const marginY = compact ? Math.max(3, height * 0.018) : 9;
      const gap = compact ? 3 : 4.5;
      const iconCenterY = marginY + iconH / 2;

      let textX = marginX;
      if (logoImg) {
        const ratio = logoImg.width / logoImg.height || 1;
        const w = iconH * ratio;
        page.drawImage(logoImg, { x: marginX, y: marginY, width: w, height: iconH, opacity: 0.95 });
        textX = marginX + w + gap;
      }

      if (compact) {
        // satu baris, sejajar tengah ikon
        page.drawText(label, { x: textX, y: iconCenterY - fontSize * 0.34, size: fontSize, font, color: rgb(0.4, 0.44, 0.5) });
      } else {
        // dua baris dirapatkan (jarak baseline ≈ 1.2× ukuran huruf), blok teks diratakan ke tengah ikon
        const lead = fontSize * 1.2;
        const blockMid = (0.72 * fontSize - lead - 0.2 * subFontSize) / 2; // tengah blok relatif baseline label
        const labelY = iconCenterY - blockMid;
        page.drawText(label, { x: textX, y: labelY, size: fontSize, font, color: rgb(0.4, 0.44, 0.5) });
        page.drawText(sub, { x: textX, y: labelY - lead, size: subFontSize, font, color: rgb(0.58, 0.61, 0.66) });
      }
    }
  } catch {
    // Branding is a nice-to-have — never let it break an actual export.
  }
}
