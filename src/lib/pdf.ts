// Shared page-range parsing for PDF tools (extract, delete, organize, rotate)
export function parsePageSpec(input: string, totalPages: number): number[] {
  const parts = input.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const pages = new Set<number>();
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) [start, end] = [end, start];
      for (let p = start; p <= end; p++) if (p >= 1 && p <= totalPages) pages.add(p - 1);
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= totalPages) pages.add(num - 1);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}
