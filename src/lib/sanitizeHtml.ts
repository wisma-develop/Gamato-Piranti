import { tr } from "@/i18n";
/**
 * Sanitasi HTML untuk isi editor yang dipulihkan dari draf (atau diimpor). Memakai DOMParser — dokumen hasilnya
 * inert (skrip tidak dieksekusi, gambar tidak diunduh) — lalu membuang elemen & atribut yang bisa menjalankan kode.
 * Formatting editor (p, h1–h6, b/i/u, list, tabel, img data:, style inline) dipertahankan.
 */
const BLOCKED_TAGS = ["script", "style", "iframe", "frame", "frameset", "object", "embed", "link", "meta", "base", "form", "template", "noscript"];
const URL_ATTRS = ["href", "src", "xlink:href", "action", "formaction", "poster", "srcset"];

export function sanitizeEditorHtml(html: string): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(tr("<!doctype html><body>{0}", html), "text/html");
  doc.querySelectorAll(BLOCKED_TAGS.join(",")).forEach((el) => el.remove());
  doc.body.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase().replace(/[\u0000-\u0020]+/g, "");
      if (name.startsWith("on")) { el.removeAttribute(attr.name); continue; }
      if (URL_ATTRS.includes(name) && (value.startsWith("javascript:") || value.startsWith("vbscript:") || (value.startsWith("data:") && !value.startsWith("data:image/")))) el.removeAttribute(attr.name);
      if (name === "style" && /expression\s*\(|javascript:|url\s*\(\s*['"]?\s*(?:javascript|vbscript):/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  });
  return doc.body.innerHTML;
}
