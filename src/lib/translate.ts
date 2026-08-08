// Kamus Dunia (World Dictionary) helper.
//
// This is the ONE utility tool in Gamato Piranti that needs an internet
// connection: a true offline "world dictionary" would require bundling huge
// per-language datasets. Instead we call MyMemory's free, keyless,
// CORS-enabled translation API directly from the browser — Gamato Piranti's
// own servers (it has none) never see the text, only the browser and
// MyMemory do. This keeps the "no backend of our own" principle intact
// while still delivering the feature.

export const MAX_TRANSLATE_CHARS = 480;

export type LangCode = string;

export const WORLD_LANGUAGES: { code: LangCode; label: string }[] = [
  { code: "id", label: "Indonesia" },
  { code: "en", label: "Inggris" },
  { code: "ar", label: "Arab" },
  { code: "zh-CN", label: "Mandarin (Sederhana)" },
  { code: "ja", label: "Jepang" },
  { code: "ko", label: "Korea" },
  { code: "es", label: "Spanyol" },
  { code: "fr", label: "Prancis" },
  { code: "de", label: "Jerman" },
  { code: "it", label: "Italia" },
  { code: "pt", label: "Portugis" },
  { code: "ru", label: "Rusia" },
  { code: "nl", label: "Belanda" },
  { code: "th", label: "Thailand" },
  { code: "vi", label: "Vietnam" },
  { code: "hi", label: "Hindi" },
  { code: "tr", label: "Turki" },
  { code: "ms", label: "Melayu" },
  { code: "tl", label: "Tagalog" },
  { code: "bn", label: "Bengali" },
  { code: "pl", label: "Polandia" },
  { code: "uk", label: "Ukraina" },
  { code: "el", label: "Yunani" },
  { code: "sv", label: "Swedia" },
  { code: "fa", label: "Persia" },
  { code: "he", label: "Ibrani" },
  { code: "ur", label: "Urdu" },
  { code: "ta", label: "Tamil" },
  { code: "jv", label: "Jawa" },
  { code: "su", label: "Sunda" },
];

export class TranslateError extends Error {}

export async function translateText(text: string, from: LangCode, to: LangCode, signal?: AbortSignal): Promise<string> {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  if (trimmed.length > MAX_TRANSLATE_CHARS) {
    throw new TranslateError(`Maksimal ${MAX_TRANSLATE_CHARS} karakter per permintaan (batas layanan gratis).`);
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${encodeURIComponent(from)}|${encodeURIComponent(to)}`;

  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch {
    throw new TranslateError("Gagal terhubung ke layanan terjemahan. Periksa koneksi internetmu.");
  }

  if (!res.ok) throw new TranslateError(`Layanan terjemahan merespons error (${res.status}).`);

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new TranslateError("Respons layanan terjemahan tidak valid.");
  }

  const translated = data?.responseData?.translatedText;
  if (!translated || (typeof data?.responseStatus === "number" && data.responseStatus >= 400)) {
    throw new TranslateError("Tidak bisa menerjemahkan teks ini. Coba pasangan bahasa lain.");
  }

  return String(translated);
}
