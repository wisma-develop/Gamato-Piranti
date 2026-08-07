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
export const cmdOrderedList = () => exec("insertOrderedList");
export const cmdUnorderedList = () => exec("insertUnorderedList");
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
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (range.intersectsNode(node)) nodes.push(node as Text);
    node = walker.nextNode();
  }
  nodes.forEach((textNode) => {
    const full = textNode.textContent || "";
    const start = textNode === range.startContainer ? range.startOffset : 0;
    const end = textNode === range.endContainer ? range.endOffset : full.length;
    if (start >= end) return;
    textNode.textContent = full.slice(0, start) + full.slice(start, end).toUpperCase() + full.slice(end);
  });
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

export function cmdInsertImage(dataUrl: string) {
  document.execCommand("insertHTML", false, `<img src="${dataUrl}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`);
}
