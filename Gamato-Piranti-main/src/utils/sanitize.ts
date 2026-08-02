// Basic input sanitization helpers for WUG Secure System compliance
// These utilities avoid dangerous characters and ensure only safe URLs and filenames are used

export function sanitizeText(input: string): string {
  if (!input) return "";
  // Remove control chars except \n, \r, \t; strip angle brackets; collapse spaces
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/[\r\n\t]+/g, (m) => (m.includes("\n") ? "\n" : " "))
    .trim();
}

export function sanitizeUrl(input: string): string {
  if (!input) return "";
  try {
    const u = new URL(input.trim());
    if (u.protocol === "http:" || u.protocol === "https:") {
      return u.toString();
    }
    return ""; // disallow javascript:, data:, file:, etc.
  } catch {
    return "";
  }
}

export function sanitizeFileName(input: string, fallback = "file"): string {
  const norm = (input || "").normalize("NFKC");
  const cleaned = norm
    .replace(/[\\/:*?"<>|]+/g, "_") // reserved filename chars
    .replace(/[\u0000-\u001F\u007F]/g, " ") // control chars
    .replace(/\s+/g, " ")
    .trim();
  const base = cleaned || fallback;
  return base.slice(0, 100);
}

// Numeric-only sanitizer (keeps digits and optional decimal dot and minus)
export function sanitizeNumberString(input: string): string {
  if (!input) return "";
  return input.replace(/[^0-9.\-]/g, "");
}

// Phone sanitizer: keep digits and a single leading +
export function sanitizePhone(input: string): string {
  if (!input) return "";
  return input.replace(/[^\d+]/g, "").replace(/(?!^)[+]/g, "");
}
