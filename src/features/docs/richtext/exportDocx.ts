import { Document, Packer, Paragraph, TextRun, ImageRun, ExternalHyperlink, AlignmentType, UnderlineType } from "docx";
import type { BlockModel, RunModel, Align, ImageAlign } from "./parseEditor";

const IMAGE_ALIGN_MAP: Partial<Record<ImageAlign, any>> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  "float-left": AlignmentType.LEFT,
  "float-right": AlignmentType.RIGHT,
};

const DOCX_MAX_IMAGE_WIDTH_PX = 600; // roughly matches a A4 page's usable content width

/** Converts a data: URL into raw bytes + a type docx's ImageRun understands. */
async function prepareImageForDocx(dataUrl: string): Promise<{ bytes: Uint8Array; type: "png" | "jpg" | "gif" | "bmp" }> {
  const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  const mime = mimeMatch?.[1] || "";
  const directType: "png" | "jpg" | "gif" | "bmp" | null =
    mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/gif" ? "gif" : mime === "image/bmp" ? "bmp" : null;

  if (directType) {
    const base64 = dataUrl.split(",")[1] || "";
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, type: directType };
  }

  // Unsupported format for docx's ImageRun (e.g. webp) — re-encode to PNG via
  // canvas so the image still shows up correctly instead of being dropped.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Gagal memuat gambar untuk konversi."));
    el.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context tidak tersedia.");
  ctx.drawImage(img, 0, 0);
  const pngDataUrl = canvas.toDataURL("image/png");
  const base64 = pngDataUrl.split(",")[1] || "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, type: "png" };
}

/** CSS line-height multiplier (e.g. 1.5) -> docx's "twentieths of a point" line spacing unit. */
function lineHeightToDocxLine(multiplier?: number): number | undefined {
  if (!multiplier || multiplier <= 0) return undefined;
  return Math.round(multiplier * 240);
}

/** CSS pixels -> docx's "twentieths of a point" (twips), assuming 96dpi. */
function pxToTwips(px?: number): number | undefined {
  if (px === undefined || px < 0) return undefined;
  return Math.round(px * 15);
}

const ALIGN_MAP: Record<Align, any> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

// docx's TextRun `highlight` prop only accepts a fixed palette of named
// colors (not arbitrary hex), so we snap the picked highlight color to the
// closest one in that palette.
const HIGHLIGHT_PALETTE: [string, string][] = [
  ["yellow", "#FFFF00"],
  ["green", "#00FF00"],
  ["cyan", "#00FFFF"],
  ["magenta", "#FF00FF"],
  ["blue", "#0000FF"],
  ["red", "#FF0000"],
  ["darkBlue", "#000080"],
  ["darkRed", "#800000"],
  ["darkGreen", "#008000"],
  ["darkYellow", "#808000"],
  ["darkGray", "#808080"],
  ["lightGray", "#C0C0C0"],
  ["black", "#000000"],
  ["white", "#FFFFFF"],
];

function hexDistance(a: string, b: string): number {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return Math.sqrt(pa.reduce((sum, v, i) => sum + (v - pb[i]) ** 2, 0));
}

function nearestHighlightName(hex?: string): string | undefined {
  if (!hex) return undefined;
  let best = HIGHLIGHT_PALETTE[0][0];
  let bestDist = Infinity;
  for (const [name, value] of HIGHLIGHT_PALETTE) {
    const d = hexDistance(hex, value);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

function buildRun(run: RunModel): TextRun {
  return new TextRun({
    text: run.text,
    bold: run.bold,
    italics: run.italic,
    strike: run.strike,
    subScript: run.sub,
    superScript: run.sup,
    underline: run.underline ? { type: UnderlineType.SINGLE } : undefined,
    color: run.color ? run.color.replace("#", "") : undefined,
    highlight: nearestHighlightName(run.highlight) as any,
    size: run.fontSizePx ? Math.round(run.fontSizePx * 1.5) : undefined,
  });
}

function buildParagraphChildren(runs: RunModel[]): (TextRun | ExternalHyperlink)[] {
  const children: (TextRun | ExternalHyperlink)[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    if (run.link) {
      children.push(
        new ExternalHyperlink({
          link: run.link,
          children: [
            new TextRun({
              text: run.text,
              bold: run.bold,
              italics: run.italic,
              color: "0563C1",
              underline: { type: UnderlineType.SINGLE },
            }),
          ],
        })
      );
    } else {
      children.push(buildRun(run));
    }
  }
  return children.length ? children : [new TextRun({ text: "" })];
}

/** Builds a .docx Blob from the parsed block model of the Doc Studio editor. */
export async function exportDocxFromBlocks(blocks: BlockModel[], title: string): Promise<Blob> {
  const paragraphs: Paragraph[] = [];
  let numberCounter = 0;

  for (const block of blocks) {
    if (block.kind === "image") {
      try {
        const { bytes, type } = await prepareImageForDocx(block.dataUrl);
        const scale = Math.min(1, DOCX_MAX_IMAGE_WIDTH_PX / (block.width || DOCX_MAX_IMAGE_WIDTH_PX));
        const width = Math.max(1, Math.round(block.width * scale));
        const height = Math.max(1, Math.round(block.height * scale));
        paragraphs.push(
          new Paragraph({
            alignment: IMAGE_ALIGN_MAP[block.align ?? "left"] ?? AlignmentType.LEFT,
            children: [new ImageRun({ data: bytes, type, transformation: { width, height } })],
          })
        );
      } catch {
        // If a specific image genuinely can't be embedded (corrupt data,
        // unsupported codec even after PNG re-encode), fall back to a
        // clearly-labelled placeholder instead of silently dropping it.
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: "[Gambar tidak dapat disisipkan]", italics: true, color: "94A3B8" })],
          })
        );
      }
      continue;
    }

    if (block.listType !== "number") numberCounter = 0;
    const alignment = ALIGN_MAP[block.align];
    const children = buildParagraphChildren(block.runs);
    const spacing = {
      line: lineHeightToDocxLine(block.lineHeight),
      lineRule: block.lineHeight ? ("auto" as const) : undefined,
      after: pxToTwips(block.spaceAfterPx),
    };
    const hasSpacing = spacing.line !== undefined || spacing.after !== undefined;

    if (block.listType === "bullet") {
      paragraphs.push(new Paragraph({ children, alignment, bullet: { level: 0 }, spacing: hasSpacing ? spacing : undefined }));
    } else if (block.listType === "number") {
      numberCounter += 1;
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `${numberCounter}. ` }), ...children], alignment, spacing: hasSpacing ? spacing : undefined }));
    } else {
      paragraphs.push(new Paragraph({ children, alignment, spacing: hasSpacing ? spacing : undefined }));
    }
  }

  const doc = new Document({
    title,
    sections: [
      {
        properties: {},
        children: paragraphs.length ? paragraphs : [new Paragraph({ children: [new TextRun({ text: "" })] })],
      },
    ],
  });

  return Packer.toBlob(doc);
}
