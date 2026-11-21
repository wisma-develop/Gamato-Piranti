/**
 * Gamato Piranti — mesin dua bahasa (ID/EN) yang ringan dan tanpa dependensi.
 *
 * Prinsip:
 *  - Sumber teks = Bahasa Indonesia. `tr("teks Indonesia")` mengembalikan teks itu apa adanya di mode ID,
 *    dan terjemahan Inggrisnya (kamus `./en.ts`) di mode EN. Teks yang belum ada di kamus jatuh ke teks asli
 *    (tidak pernah kosong / tidak pernah error).
 *  - Bahasa dipilih SEBELUM aplikasi dirender: urutan prioritas `?lang=` → localStorage (`gp-lang`) → "id".
 *    Mengganti bahasa memuat ulang halaman, sehingga semua nilai tingkat-modul (menu, template, label) ikut berganti
 *    dan tidak ada sisa bahasa lama di layar.
 *  - Kamus EN dimuat dinamis (top-level await) HANYA saat bahasa = EN → pengguna ID tidak membayar sebesar apa pun.
 *  - Placeholder `{0}`, `{1}` diisi argumen. Bentuk jamak: tulis "tunggal¦jamak" di kamus; yang dipakai ditentukan
 *    oleh argumen pertama (1 → tunggal, selain itu → jamak).
 */

export type Lang = "id" | "en";
export const LANG_KEY = "gp-lang";
export const LANGS: readonly Lang[] = ["id", "en"] as const;

function detect(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get("lang");
    if (q === "en" || q === "id") {
      try { localStorage.setItem(LANG_KEY, q); } catch { /* penyimpanan diblokir */ }
      return q;
    }
    const s = localStorage.getItem(LANG_KEY);
    if (s === "en" || s === "id") return s;
  } catch { /* SSR / penyimpanan diblokir */ }
  return "id";
}

export const lang: Lang = detect();
export const isEn = lang === "en";
/** Locale Intl/`toLocale*` yang sesuai bahasa aktif. */
export const LOCALE = isEn ? "en-US" : "id-ID";

let dict: Record<string, string> = {};
if (isEn) dict = (await import("./en")).EN;

type MissSink = Set<string> | undefined;
const missSink = (): MissSink => (typeof window !== "undefined" ? (window as unknown as { __gpMiss?: Set<string> }).__gpMiss : undefined);

const WS = /^(\s*)([\s\S]*?)(\s*)$/;

function lookup(key: string): string {
  const hit = dict[key];
  if (hit !== undefined) return hit;
  const m = WS.exec(key);
  if (m && (m[1] || m[3]) && m[2]) {
    const core = dict[m[2]];
    if (core !== undefined) return m[1] + core + m[3];
  }
  missSink()?.add(key);
  return key;
}

/** Terjemahkan. `tr("{0} file dipilih", n)` → "3 file dipilih" / "3 files selected". */
export function tr(key: string, ...args: ReadonlyArray<string | number>): string {
  let s = isEn ? lookup(key) : key;
  if (args.length === 0) return s;
  if (s.includes("¦")) {
    const parts = s.split("¦");
    s = (Number(args[0]) === 1 ? parts[0] : parts[1]) ?? parts[0];
  }
  return s.replace(/\{(\d+)\}/g, (_, i: string) => String(args[Number(i)] ?? ""));
}

/** Pilih satu dari dua varian berdasarkan bahasa — untuk potongan yang tidak cocok jadi satu kunci kamus. */
export function pick<T>(id: T, en: T): T {
  return isEn ? en : id;
}

/** Simpan pilihan & muat ulang agar seluruh aplikasi (termasuk nilai tingkat-modul) memakai bahasa baru. */
export function setLang(next: Lang): void {
  if (next === lang) return;
  try { localStorage.setItem(LANG_KEY, next); } catch { /* ignore */ }
  const url = new URL(window.location.href);
  url.searchParams.delete("lang");
  window.location.replace(url.toString());
}

/**
 * Pengendus awal pesan status ("Gagal…", "Isi…", "Tidak ada…") yang bahasa-netral:
 * mengenali awalan Indonesia maupun padanan Inggrisnya, sehingga warna/ikon notifikasi
 * (error / peringatan) tetap benar di kedua bahasa.
 */
const PREFIX_RE: Record<string, RegExp> = {
  Gagal: /^(gagal|failed|failure|unable|can['’]t|cannot|couldn['’]t|could not|error)/i,
  Isi: /^(isi\b|fill|enter|type )/i,
  Tidak: /^(tidak|no |not |nothing|there (is|are) no|cannot|can['’]t|unable)/i,
  Pilih: /^(pilih|choose|select|pick)/i,
  Gambar: /^(gambar|draw|image)/i,
  "Teks tidak": /^(teks tidak|text not|no text)/i,
};
export function msgStarts(msg: string | null | undefined, prefix: keyof typeof PREFIX_RE | string): boolean {
  if (!msg) return false;
  return (PREFIX_RE[prefix] ?? new RegExp("^" + prefix, "i")).test(msg);
}
/** Pesan sukses (berhasil / successfully). */
export function msgOk(msg: string | null | undefined): boolean {
  return !!msg && /berhasil|successfully/i.test(msg);
}
