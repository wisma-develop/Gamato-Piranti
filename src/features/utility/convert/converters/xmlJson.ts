// ─── JSON <-> XML converter ─────────────────────────────────────────────────
// Uses the browser's built-in DOMParser/XMLSerializer/Document APIs — no XML
// library needed (and none of this project's dependencies ship one at the
// top level; `xml-js` only exists as a transitive dependency *inside* the
// `docx` package, which isn't safe to import directly).
//
// Mapping convention (matches what most JSON<->XML converters use):
//   <person name="Budi"><age>30</age><city>Jakarta</city></person>
//   -> { "person": { "@name": "Budi", "age": "30", "city": "Jakarta" } }
// - Attributes become "@attrName" keys.
// - A leaf element with only text content becomes a plain string value.
// - An element with only text AND attributes keeps the text under "#text".
// - Repeated sibling elements with the same tag become a JSON array.
// - Numbers/booleans are NOT auto-coerced from XML (XML has no native
//   types) — every XML-derived value is a string, exactly like real XML.

export type XmlJson = string | { [key: string]: XmlJson | XmlJson[] };

function elementToJson(el: Element): XmlJson {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) attrs[`@${attr.name}`] = attr.value;

  const childElements = Array.from(el.children);
  const hasElementChildren = childElements.length > 0;

  if (!hasElementChildren) {
    const text = el.textContent ?? "";
    if (Object.keys(attrs).length === 0) return text;
    return { ...attrs, "#text": text };
  }

  const result: Record<string, XmlJson | XmlJson[]> = { ...attrs };
  for (const child of childElements) {
    const childValue = elementToJson(child);
    const tag = child.tagName;
    if (tag in result) {
      const existing = result[tag];
      if (Array.isArray(existing)) existing.push(childValue);
      else result[tag] = [existing as XmlJson, childValue];
    } else {
      result[tag] = childValue;
    }
  }
  return result;
}

export function xmlToJson(xmlText: string): unknown {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode) {
    throw new Error("XML tidak valid: " + (errorNode.textContent || "format tidak bisa dibaca.").split("\n")[0]);
  }
  const root = doc.documentElement;
  if (!root) throw new Error("XML tidak valid: elemen root tidak ditemukan.");
  return { [root.tagName]: elementToJson(root) };
}

function escapeXmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeXmlAttr(s: string): string {
  return escapeXmlText(s).replace(/"/g, "&quot;");
}

function isValidTagName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name);
}

function valueToXmlChildren(tag: string, value: unknown, indent: string): string {
  if (Array.isArray(value)) {
    return value.map((item) => valueToXmlChildren(tag, item, indent)).join("");
  }
  const safeTag = isValidTagName(tag) ? tag : "item";
  if (value === null || value === undefined) return `${indent}<${safeTag} />\n`;
  if (typeof value !== "object") return `${indent}<${safeTag}>${escapeXmlText(String(value))}</${safeTag}>\n`;

  const obj = value as Record<string, unknown>;
  const attrParts: string[] = [];
  const childKeys: string[] = [];
  let text: string | null = null;
  for (const key of Object.keys(obj)) {
    if (key === "#text") text = String(obj[key]);
    else if (key.startsWith("@")) attrParts.push(` ${key.slice(1)}="${escapeXmlAttr(String(obj[key]))}"`);
    else childKeys.push(key);
  }

  const attrStr = attrParts.join("");
  if (!childKeys.length && text !== null) {
    return `${indent}<${safeTag}${attrStr}>${escapeXmlText(text)}</${safeTag}>\n`;
  }
  if (!childKeys.length && !attrParts.length) {
    return `${indent}<${safeTag} />\n`;
  }
  if (!childKeys.length) {
    return `${indent}<${safeTag}${attrStr} />\n`;
  }
  let inner = "";
  for (const key of childKeys) inner += valueToXmlChildren(key, obj[key], indent + "  ");
  return `${indent}<${safeTag}${attrStr}>\n${inner}${indent}</${safeTag}>\n`;
}

export function jsonToXml(value: unknown, rootName = "root"): string {
  let root = rootName;
  let payload = value;
  // If the JSON is a single-key object, use that key as the root tag name —
  // mirrors the shape xmlToJson() produces, so JSON->XML->JSON round-trips.
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 1 && isValidTagName(keys[0])) {
      root = keys[0];
      payload = (value as Record<string, unknown>)[keys[0]];
    }
  }
  const body = valueToXmlChildren(root, payload, "");
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}
