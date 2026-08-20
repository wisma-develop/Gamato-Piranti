// Rich text editor commands built directly on top of the browser's native
// contentEditable + Selection/Range APIs (document.execCommand). No external
// rich-text library is used, so this works fully offline with zero extra
// dependencies — same "browser-native" philosophy as the rest of Gamato Piranti.

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export const cmdBold = () => exec("bold");
export const cmdItalic = () => exec("italic");
export const cmdUnderline = () => exec("underline");
export const cmdStrikethrough = () => exec("strikeThrough");
export const cmdSubscript = () => exec("subscript");
export const cmdSuperscript = () => exec("superscript");
export const cmdUndo = () => exec("undo");
export const cmdRedo = () => exec("redo");
export const cmdIndent = () => exec("indent");
export const cmdOutdent = () => exec("outdent");
export const cmdRemoveFormat = () => exec("removeFormat");

export const cmdAlign = (align: "left" | "center" | "right" | "justify") =>
  exec(
    align === "left" ? "justifyLeft" : align === "center" ? "justifyCenter" : align === "right" ? "justifyRight" : "justifyFull"
  );

export const cmdForeColor = (color: string) => exec("foreColor", color);

export function cmdHighlight(color: string) {
  try {
    document.execCommand("hiliteColor", false, color);
  } catch {
    exec("backColor", color);
  }
}

export const cmdFontName = (font: string) => exec("fontName", font);

/**
 * execCommand('fontSize', ...) only supports the 7 legacy HTML sizes and
 * produces <font size="N"> tags. We use size "7" purely as a marker, then
 * upgrade every marked <font> element inside the editor into a <span> with
 * an arbitrary `font-size: Npx`, giving pixel-accurate sizing.
 */
export function cmdFontSize(px: number, editorRoot: HTMLElement) {
  exec("fontSize", "7");
  editorRoot.querySelectorAll('font[size="7"]').forEach((el) => {
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
    span.innerHTML = (el as HTMLElement).innerHTML;
    el.replaceWith(span);
  });
}

/** Uppercases only the selected text, preserving surrounding formatting. */
export function cmdUppercaseSelection() {
  cmdChangeCaseSelection("upper");
}

export type CaseMode = "upper" | "lower" | "sentence" | "title";

/** Changes the case of only the selected text, preserving surrounding formatting. */
export function cmdChangeCaseSelection(mode: CaseMode) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  // If the selection lies entirely inside one text node (extremely common —
  // e.g. selecting a couple of words in a plain paragraph), that text node
  // itself IS range.commonAncestorContainer. A TreeWalker never returns its
  // own root via nextNode() — only descendants — so walking from the text
  // node directly finds zero nodes and silently does nothing. Rooting the
  // walker at an actual element (the text node's parent when needed) fixes
  // this for every selection shape.
  const rawRoot = range.commonAncestorContainer;
  const walkerRoot: Node = rawRoot.nodeType === Node.TEXT_NODE ? rawRoot.parentNode || rawRoot : rawRoot;
  const walker = document.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (range.intersectsNode(node)) nodes.push(node as Text);
    node = walker.nextNode();
  }
  // "Sentence case" needs to know whether we're at the start of a new
  // sentence across node boundaries, so track it as we go.
  let atSentenceStart = true;
  nodes.forEach((textNode) => {
    const full = textNode.textContent || "";
    const start = textNode === range.startContainer ? range.startOffset : 0;
    const end = textNode === range.endContainer ? range.endOffset : full.length;
    if (start >= end) return;
    const before = full.slice(0, start);
    const middle = full.slice(start, end);
    const after = full.slice(end);

    let transformed: string;
    if (mode === "upper") {
      transformed = middle.toUpperCase();
    } else if (mode === "lower") {
      transformed = middle.toLowerCase();
    } else if (mode === "title") {
      transformed = middle.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    } else {
      // sentence case: lowercase everything, then capitalize the first
      // letter after start-of-text or after . ! ?
      let out = "";
      for (let i = 0; i < middle.length; i++) {
        const ch = middle[i];
        if (/[a-zA-Z]/.test(ch)) {
          out += atSentenceStart ? ch.toUpperCase() : ch.toLowerCase();
          atSentenceStart = false;
        } else {
          out += ch;
          if (/[.!?]/.test(ch)) atSentenceStart = true;
          else if (!/\s/.test(ch)) atSentenceStart = false;
        }
      }
      transformed = out;
    }
    textNode.textContent = before + transformed + after;
  });
}

// ─── Lists ──────────────────────────────────────────────────────────────────
// execCommand('insertOrderedList'/'insertUnorderedList') is notoriously
// inconsistent about the exact markup it produces (it can leave the list
// nested unexpectedly, or represent it via CSS instead of real <ul>/<ol>
// depending on browser/selection state) — that inconsistency is exactly why
// bullet/numbered lists sometimes weren't recognized on export. This
// implementation builds the <ul>/<ol><li> structure directly, so the
// output is 100% predictable and always matches what parseEditor.ts (and
// therefore the .docx/.pdf exporters) expect.

function findListContext(editorRoot: HTMLElement): { li: HTMLElement | null; topBlock: HTMLElement | null } {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { li: null, topBlock: null };
  let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
  let li: HTMLElement | null = null;
  let topBlock: HTMLElement | null = null;
  while (node && node !== editorRoot) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "LI" && !li) li = el;
      if (el.parentElement === editorRoot) topBlock = el;
    }
    node = node.parentNode;
  }
  return { li, topBlock };
}

/** Removes `li` from `list`, splitting the list in two around it if it was in the middle, and inserts `replacement` in its place. */
function splitListAndReplace(list: HTMLElement, li: HTMLElement, replacement: HTMLElement) {
  const parent = list.parentElement;
  if (!parent) return;
  const items = Array.from(list.children);
  const idx = items.indexOf(li);
  if (idx === -1) return;
  const before = items.slice(0, idx);
  const after = items.slice(idx + 1);

  if (before.length) {
    const beforeList = document.createElement(list.tagName.toLowerCase());
    before.forEach((item) => beforeList.appendChild(item));
    parent.insertBefore(beforeList, list);
  }
  parent.insertBefore(replacement, list);
  if (after.length) {
    const afterList = document.createElement(list.tagName.toLowerCase());
    after.forEach((item) => afterList.appendChild(item));
    parent.insertBefore(afterList, list);
  }
  parent.removeChild(list);
}

function placeCaretAtEnd(el: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Toggles the current paragraph/list-item between a plain paragraph and a bullet/numbered list item. */
export function cmdToggleList(kind: "bullet" | "number", editorRoot: HTMLElement) {
  const tagWanted = kind === "bullet" ? "UL" : "OL";
  const { li, topBlock } = findListContext(editorRoot);

  if (li) {
    const list = li.parentElement as HTMLElement | null;
    if (!list) return;
    if (list.tagName === tagWanted) {
      // Already this list type → un-list just this item.
      const p = document.createElement("p");
      p.innerHTML = li.innerHTML || "<br>";
      splitListAndReplace(list, li, p);
      placeCaretAtEnd(p);
    } else {
      // A list item of the other kind → convert just this item to the new kind.
      const newLi = document.createElement("li");
      newLi.innerHTML = li.innerHTML || "<br>";
      const wrapper = document.createElement(tagWanted.toLowerCase());
      wrapper.appendChild(newLi);
      splitListAndReplace(list, li, wrapper);
      placeCaretAtEnd(newLi);
    }
    return;
  }

  if (topBlock) {
    const list = document.createElement(tagWanted.toLowerCase());
    const newLi = document.createElement("li");
    newLi.innerHTML = topBlock.innerHTML || "<br>";
    list.appendChild(newLi);
    topBlock.replaceWith(list);
    placeCaretAtEnd(newLi);
  }
}


export function cmdInsertLink(url: string) {
  if (!url.trim()) return;
  const safeUrl = /^https?:\/\//i.test(url) || url.startsWith("mailto:") ? url : `https://${url}`;
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    exec("createLink", safeUrl);
  } else {
    document.execCommand("insertHTML", false, `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a>&nbsp;`);
    return;
  }
  // Force target=_blank + rel on whatever link(s) were just created.
  const container = sel?.anchorNode?.parentElement?.closest("[contenteditable=true]");
  container?.querySelectorAll(`a[href="${safeUrl}"]`).forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
}

export function cmdInsertImage(dataUrl: string, displaySize?: { width: number; height: number }) {
  const sizeStyle = displaySize ? `width:${Math.round(displaySize.width)}px;height:${Math.round(displaySize.height)}px;` : "";
  document.execCommand("insertHTML", false, `<img src="${dataUrl}" data-align="center" data-rotate="0" style="max-width:100%;border-radius:8px;margin:8px auto;display:block;${sizeStyle}" />`);
}

// ─── Paragraph spacing ──────────────────────────────────────────────────────
// execCommand has no native "line spacing" / "space after paragraph" command,
// so these work directly on whichever top-level editor blocks (or list
// items) the current selection touches.

function getSelectedFormatTargets(editorRoot: HTMLElement): HTMLElement[] {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return [];
  const range = sel.getRangeAt(0);
  const targets: HTMLElement[] = [];
  Array.from(editorRoot.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;
    if (!range.intersectsNode(child)) return;
    if (child.tagName === "UL" || child.tagName === "OL") {
      Array.from(child.children).forEach((li) => {
        if (li instanceof HTMLElement && li.tagName === "LI" && range.intersectsNode(li)) targets.push(li);
      });
    } else {
      targets.push(child);
    }
  });
  return targets;
}

/** Sets line spacing (as a CSS multiplier, e.g. 1 / 1.15 / 1.5 / 2) on the selected paragraph(s). */
export function cmdSetLineHeight(multiplier: number, editorRoot: HTMLElement) {
  const targets = getSelectedFormatTargets(editorRoot);
  targets.forEach((el) => {
    el.style.lineHeight = String(multiplier);
  });
}

/** Sets the space *after* the selected paragraph(s), in pixels. */
export function cmdSetSpaceAfter(px: number, editorRoot: HTMLElement) {
  const targets = getSelectedFormatTargets(editorRoot);
  targets.forEach((el) => {
    el.style.marginBottom = `${px}px`;
  });
}

// ─── Shapes ─────────────────────────────────────────────────────────────────
// Shapes are drawn as SVG, then rasterized to a PNG and inserted through the
// exact same path as an uploaded image — this guarantees a shape looks
// 100% identical in the editor, the PDF export, and the DOCX export, since
// by the time it's exported it *is* just an image.

export type ShapeKind = "rectangle" | "circle" | "line" | "arrow";

function shapeSvgMarkup(kind: ShapeKind, w: number, h: number, stroke: string, fill: string): string {
  const strokeW = 4;
  switch (kind) {
    case "rectangle":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="${strokeW}" y="${strokeW}" width="${w - strokeW * 2}" height="${h - strokeW * 2}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/></svg>`;
    case "circle":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2 - strokeW}" ry="${h / 2 - strokeW}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/></svg>`;
    case "line":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line x1="${strokeW}" y1="${h / 2}" x2="${w - strokeW}" y2="${h / 2}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linecap="round"/></svg>`;
    case "arrow":
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><marker id="gp-arrowhead" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${stroke}"/></marker></defs><line x1="${strokeW}" y1="${h / 2}" x2="${w - 16}" y2="${h / 2}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linecap="round" marker-end="url(#gp-arrowhead)"/></svg>`;
  }
}

async function rasterizeSvg(svgMarkup: string, w: number, h: number): Promise<string> {
  const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgMarkup)))}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Gagal membuat bentuk."));
    el.src = svgDataUrl;
  });
  const dpr = 2; // render at 2x so shape edges stay crisp when resized later
  const canvas = document.createElement("canvas");
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context tidak tersedia.");
  ctx.scale(dpr, dpr);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

/** Draws the given shape and inserts it at the cursor, same as inserting an uploaded image. */
export async function cmdInsertShape(kind: ShapeKind, options?: { stroke?: string; fill?: string }): Promise<void> {
  const stroke = options?.stroke ?? "#4f46e5";
  const fill = options?.fill ?? "transparent";
  const w = kind === "circle" ? 200 : 260;
  const h = kind === "line" || kind === "arrow" ? 50 : kind === "circle" ? 200 : 150;
  const svg = shapeSvgMarkup(kind, w, h, stroke, fill);
  const dataUrl = await rasterizeSvg(svg, w, h);
  // rasterizeSvg renders at 2x pixel density for crisp edges — pass the
  // *intended* CSS display size explicitly so the shape doesn't show up
  // (and export) twice as large as designed.
  cmdInsertImage(dataUrl, { width: w, height: h });
}

// ─── Image alignment / positioning ─────────────────────────────────────────

export type ImageAlignValue = "left" | "center" | "right" | "float-left" | "float-right";

/** Applies an alignment/position to a specific inserted <img>, matching what parseEditor.ts reads back on export. */
export function cmdSetImageAlign(img: HTMLImageElement, align: ImageAlignValue) {
  img.setAttribute("data-align", align);
  img.style.float = "";
  img.style.display = "";
  img.style.marginLeft = "";
  img.style.marginRight = "";
  img.style.margin = "";
  switch (align) {
    case "center":
      img.style.display = "block";
      img.style.marginLeft = "auto";
      img.style.marginRight = "auto";
      break;
    case "left":
      img.style.display = "block";
      img.style.marginRight = "auto";
      break;
    case "right":
      img.style.display = "block";
      img.style.marginLeft = "auto";
      break;
    case "float-left":
      img.style.float = "left";
      img.style.margin = "4px 16px 8px 0";
      break;
    case "float-right":
      img.style.float = "right";
      img.style.margin = "4px 0 8px 16px";
      break;
  }
}

/** Removes an image node from the editor entirely. */
export function cmdDeleteImage(img: HTMLImageElement) {
  img.remove();
}

/** Sets rotation (in degrees) on an image/shape, both for live preview and for parseEditor.ts to bake into the export. */
export function cmdSetImageRotation(img: HTMLImageElement, degrees: number) {
  const normalized = ((degrees % 360) + 360) % 360;
  img.setAttribute("data-rotate", String(normalized));
  img.style.transform = normalized ? `rotate(${normalized}deg)` : "";
}
