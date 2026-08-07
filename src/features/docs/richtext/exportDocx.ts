import { Document, Packer, Paragraph, TextRun, ExternalHyperlink, AlignmentType, UnderlineType } from "docx";
import type { BlockModel, RunModel, Align } from "./parseEditor";

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
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: "[Gambar — pratinjau visual tersedia di ekspor PDF]", italics: true, color: "94A3B8" })],
        })
      );
      continue;
    }

    if (block.listType !== "number") numberCounter = 0;
    const alignment = ALIGN_MAP[block.align];
    const children = buildParagraphChildren(block.runs);

    if (block.listType === "bullet") {
      paragraphs.push(new Paragraph({ children, alignment, bullet: { level: 0 } }));
    } else if (block.listType === "number") {
      numberCounter += 1;
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: `${numberCounter}. ` }), ...children], alignment }));
    } else {
      paragraphs.push(new Paragraph({ children, alignment }));
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
