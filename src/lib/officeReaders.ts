// Lightweight, dependency-free readers for Office Open XML formats
// (.docx / .xlsx / .pptx). All three formats are just ZIP archives full of
// XML, so we unzip with JSZip (already a project dependency) and parse the
// XML with the browser's native DOMParser — no extra libraries needed.

import JSZip from "jszip";
import type { Align, BlockModel, RunModel } from "@/features/docs/richtext/parseEditor";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const SS_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";

function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "application/xml");
}

function nsAttr(el: Element, ns: string, name: string): string | null {
  return el.getAttributeNS(ns, name) || el.getAttribute(`w:${name}`) || el.getAttribute(name);
}

/** Reads a .docx file into the same Block/Run model used by Doc Studio's rich text editor. */
export async function readDocxBlocks(file: File): Promise<BlockModel[]> {
  const zip = await JSZip.loadAsync(file);
  const xml = await zip.file("word/document.xml")?.async("text");
  if (!xml) throw new Error("Bukan file .docx yang valid.");
  const doc = parseXml(xml);
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W_NS, "p"));
  const blocks: BlockModel[] = [];

  for (const p of paragraphs) {
    const runs: RunModel[] = [];
    const runEls = Array.from(p.getElementsByTagNameNS(W_NS, "r"));
    for (const r of runEls) {
      const textEls = Array.from(r.getElementsByTagNameNS(W_NS, "t"));
      const text = textEls.map((t) => t.textContent || "").join("");
      const hasBreak = r.getElementsByTagNameNS(W_NS, "br").length > 0;
      if (!text && !hasBreak) continue;
      const rPr = r.getElementsByTagNameNS(W_NS, "rPr")[0];
      const bold = !!rPr?.getElementsByTagNameNS(W_NS, "b")[0];
      const italic = !!rPr?.getElementsByTagNameNS(W_NS, "i")[0];
      const underline = !!rPr?.getElementsByTagNameNS(W_NS, "u")[0];
      if (text) runs.push({ text, bold, italic, underline });
      if (hasBreak) runs.push({ text: "\n" });
    }
    const pPr = p.getElementsByTagNameNS(W_NS, "pPr")[0];
    const jcEl = pPr?.getElementsByTagNameNS(W_NS, "jc")[0];
    const jc = jcEl ? nsAttr(jcEl, W_NS, "val") : null;
    let align: Align = "left";
    if (jc === "center") align = "center";
    else if (jc === "right") align = "right";
    else if (jc === "both") align = "justify";
    blocks.push({ kind: "text", align, runs: runs.length ? runs : [{ text: "" }] });
  }
  return blocks.length ? blocks : [{ kind: "text", align: "left", runs: [{ text: "" }] }];
}

function colLettersToIndex(letters: string): number {
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

/** Reads the first worksheet of a .xlsx file into a simple string grid. */
export async function readXlsxGrid(file: File): Promise<string[][]> {
  const zip = await JSZip.loadAsync(file);

  const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("text");
  const sharedStrings: string[] = [];
  if (sharedStringsXml) {
    const ssDoc = parseXml(sharedStringsXml);
    Array.from(ssDoc.getElementsByTagNameNS(SS_NS, "si")).forEach((si) => {
      const text = Array.from(si.getElementsByTagNameNS(SS_NS, "t"))
        .map((t) => t.textContent || "")
        .join("");
      sharedStrings.push(text);
    });
  }

  let sheetFile = zip.file("xl/worksheets/sheet1.xml");
  if (!sheetFile) {
    const candidates = Object.keys(zip.files)
      .filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f))
      .sort();
    if (candidates.length) sheetFile = zip.file(candidates[0]);
  }
  if (!sheetFile) throw new Error("Bukan file .xlsx yang valid atau sheet tidak ditemukan.");

  const sheetXml = await sheetFile.async("text");
  const sheetDoc = parseXml(sheetXml);
  const rowEls = Array.from(sheetDoc.getElementsByTagNameNS(SS_NS, "row"));
  const grid: string[][] = [];

  for (const row of rowEls) {
    const rowData: string[] = [];
    let colIndex = 0;
    Array.from(row.getElementsByTagNameNS(SS_NS, "c")).forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const colLetters = ref.match(/^[A-Z]+/)?.[0] || "";
      const targetIndex = colLetters ? colLettersToIndex(colLetters) : colIndex;
      while (colIndex < targetIndex) {
        rowData.push("");
        colIndex++;
      }
      const type = cell.getAttribute("t");
      let value = cell.getElementsByTagNameNS(SS_NS, "v")[0]?.textContent || "";
      if (type === "s") {
        value = sharedStrings[parseInt(value, 10)] ?? "";
      } else if (type === "inlineStr") {
        value = cell.getElementsByTagNameNS(SS_NS, "is")[0]?.textContent || "";
      }
      rowData.push(value);
      colIndex++;
    });
    grid.push(rowData);
  }
  return grid.length ? grid : [[""]];
}

export interface SlideContent {
  title: string;
  bullets: string[];
}

/** Reads every slide of a .pptx file, extracting the visible text per slide. */
export async function readPptxSlides(file: File): Promise<SlideContent[]> {
  const zip = await JSZip.loadAsync(file);
  const slidePaths = Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
      return na - nb;
    });
  if (!slidePaths.length) throw new Error("Bukan file .pptx yang valid atau tidak ada slide.");

  const slides: SlideContent[] = [];
  for (const path of slidePaths) {
    const xml = await zip.file(path)!.async("text");
    const doc = parseXml(xml);
    const paragraphs = Array.from(doc.getElementsByTagNameNS(A_NS, "p"));
    const lines: string[] = [];
    for (const p of paragraphs) {
      const text = Array.from(p.getElementsByTagNameNS(A_NS, "t"))
        .map((t) => t.textContent || "")
        .join("");
      if (text.trim()) lines.push(text);
    }
    slides.push({ title: lines[0] || `Slide ${slides.length + 1}`, bullets: lines.slice(1) });
  }
  return slides;
}

/**
 * Very small best-effort RTF → plain text extractor: strips RTF control
 * words/groups and unescapes common character codes. Good enough to read
 * the visible text of simple RTF documents (no complex formatting support).
 */
export async function readRtfText(file: File): Promise<string> {
  const raw = await file.text();
  let text = raw;
  // Drop font/color/style tables and other non-content control groups.
  text = text.replace(/\{\\(fonttbl|colortbl|stylesheet|\*[^}]*)\{[^{}]*\}\}/g, "");
  // Convert paragraph/line breaks to newlines before stripping control words.
  text = text.replace(/\\par[d]?\b/g, "\n").replace(/\\line\b/g, "\n");
  // Unescape hex-encoded characters like \'e9
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Remove remaining control words (e.g. \b, \i0, \fs24) and groups braces.
  text = text.replace(/\\[a-zA-Z]+-?\d*\s?/g, "");
  text = text.replace(/[{}]/g, "");
  // Collapse excessive blank lines/spaces.
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
