// Konversi angka ke kata dalam Bahasa Indonesia ("terbilang") — dipakai pada Kwitansi
// untuk baris "Uang sejumlah: ...". Ditulis manual (bukan library eksternal) supaya
// tetap ringan dan 100% berjalan di browser tanpa dependency tambahan.

const ONES = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function twoDigits(n: number): string {
  if (n < 12) return ONES[n];
  if (n < 20) return `${ONES[n - 10]} belas`;
  const tens = Math.floor(n / 10);
  const rest = n % 10;
  return `${ONES[tens]} puluh${rest ? " " + ONES[rest] : ""}`;
}

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (hundreds === 1) out += "seratus";
  else if (hundreds > 1) out += `${ONES[hundreds]} ratus`;
  if (rest) out += (out ? " " : "") + twoDigits(rest);
  return out;
}

const SCALES: { value: number; label: string }[] = [
  { value: 1_000_000_000_000, label: "triliun" },
  { value: 1_000_000_000, label: "miliar" },
  { value: 1_000_000, label: "juta" },
  { value: 1_000, label: "ribu" },
];

/** Converts an integer amount into Indonesian words, e.g. 125000 -> "seratus dua puluh lima ribu". */
export function terbilang(num: number): string {
  if (!isFinite(num)) return "";
  const n = Math.round(Math.abs(num));
  if (n === 0) return "nol";

  let remaining = n;
  const parts: string[] = [];
  for (const { value, label } of SCALES) {
    const count = Math.floor(remaining / value);
    if (count > 0) {
      if (value === 1000 && count === 1) parts.push("seribu");
      else parts.push(`${threeDigits(count)} ${label}`);
      remaining %= value;
    }
  }
  if (remaining > 0) parts.push(threeDigits(remaining));

  const words = parts.join(" ").replace(/\s+/g, " ").trim();
  return (num < 0 ? "minus " : "") + words;
}

/** Same as terbilang() but capitalised and suffixed with "rupiah", ready to print on a receipt. */
export function terbilangRupiah(num: number): string {
  const words = terbilang(num);
  if (!words) return "";
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupiah`;
}
