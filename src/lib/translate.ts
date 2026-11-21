import { tr } from "@/i18n";
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
  { code: "id", label: tr("Indonesia") },
  { code: "en", label: tr("Inggris") },
  { code: "ar", label: tr("Arab") },
  { code: "zh-CN", label: tr("Mandarin (Sederhana)") },
  { code: "ja", label: tr("Jepang") },
  { code: "ko", label: tr("Korea") },
  { code: "es", label: tr("Spanyol") },
  { code: "fr", label: tr("Prancis") },
  { code: "de", label: tr("Jerman") },
  { code: "it", label: tr("Italia") },
  { code: "pt", label: tr("Portugis") },
  { code: "ru", label: tr("Rusia") },
  { code: "nl", label: tr("Belanda") },
  { code: "th", label: tr("Thailand") },
  { code: "vi", label: tr("Vietnam") },
  { code: "hi", label: tr("Hindi") },
  { code: "tr", label: tr("Turki") },
  { code: "ms", label: tr("Melayu") },
  { code: "tl", label: tr("Tagalog") },
  { code: "bn", label: tr("Bengali") },
  { code: "pl", label: tr("Polandia") },
  { code: "uk", label: tr("Ukraina") },
  { code: "el", label: tr("Yunani") },
  { code: "sv", label: tr("Swedia") },
  { code: "fa", label: tr("Persia") },
  { code: "he", label: tr("Ibrani") },
  { code: "ur", label: tr("Urdu") },
  { code: "ta", label: tr("Tamil") },
  { code: "jv", label: tr("Jawa") },
  { code: "su", label: tr("Sunda") },
];

export class TranslateError extends Error {}

export async function translateText(text: string, from: LangCode, to: LangCode, signal?: AbortSignal): Promise<string> {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  if (trimmed.length > MAX_TRANSLATE_CHARS) {
    throw new TranslateError(tr("Maksimal {0} karakter per permintaan (batas layanan gratis).", MAX_TRANSLATE_CHARS));
  }

  const url = tr("https://api.mymemory.translated.net/get?q={0}&langpair={1}|{2}", encodeURIComponent(trimmed), encodeURIComponent(from), encodeURIComponent(to));

  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch {
    throw new TranslateError(tr("Gagal terhubung ke layanan terjemahan. Periksa koneksi internetmu."));
  }

  if (!res.ok) throw new TranslateError(tr("Layanan terjemahan merespons error ({0}).", res.status));

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new TranslateError(tr("Respons layanan terjemahan tidak valid."));
  }

  const translated = data?.responseData?.translatedText;
  if (!translated || (typeof data?.responseStatus === "number" && data.responseStatus >= 400)) {
    throw new TranslateError(tr("Tidak bisa menerjemahkan teks ini. Coba pasangan bahasa lain."));
  }

  return String(translated);
}
