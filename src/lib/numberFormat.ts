// Formatting helpers for large integer amounts (Rupiah, quantities, etc.)
// using the Indonesian convention of "." as the thousands separator.
// Kept dependency-free (no Intl calls) so formatting stays perfectly in sync
// with the digit-by-digit cursor math in <MoneyInput>.

/** Strips everything except digits — the canonical "raw" value we store in state. */
export function extractDigits(raw: string): string {
  return (raw || "").replace(/[^\d]/g, "");
}

/** "1000000" -> "1.000.000". Leaves short numbers (<1000) untouched. */
export function formatThousands(digits: string): string {
  const clean = extractDigits(digits);
  if (!clean) return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Parses a raw digit-only string into a JS number (0 for empty/invalid). */
export function parseDigits(digits: string): number {
  const n = parseInt(extractDigits(digits), 10);
  return Number.isFinite(n) ? n : 0;
}
