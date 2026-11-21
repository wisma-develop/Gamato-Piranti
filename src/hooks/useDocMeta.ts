import { useEffect } from "react";
import { isEn, lang } from "@/i18n";

const BRAND = "Gamato Piranti";

export const DEFAULT_TITLE = isEn ? `${BRAND} — Digital Tool Suite` : `${BRAND} — Suite Alat Digital`;
export const DEFAULT_DESC = isEn
  ? "Gamato Piranti — a modern digital tool suite: QR codes, PDF, document editors, image, video & audio tools, and daily utilities. Free, fast, and processed right on your device."
  : "Gamato Piranti — Suite alat digital modern: QR code, PDF, editor dokumen, olah gambar, dan utilitas harian. Gratis, cepat, dan diproses langsung di perangkatmu.";

function setMeta(sel: string, attr: "content", value: string) {
  const el = document.head.querySelector<HTMLMetaElement>(sel);
  if (el) el[attr] = value;
}

/** Terapkan judul + deskripsi halaman (document.title, description, Open Graph, Twitter). */
export function applyMeta(title: string | null, description?: string | null) {
  const full = title ? `${title} — ${BRAND}` : DEFAULT_TITLE;
  const desc = description?.trim() || DEFAULT_DESC;
  document.title = full;
  setMeta('meta[name="description"]', "content", desc);
  setMeta('meta[property="og:title"]', "content", full);
  setMeta('meta[property="og:description"]', "content", desc);
  setMeta('meta[name="twitter:title"]', "content", full);
  setMeta('meta[name="twitter:description"]', "content", desc);
}

/** Atur metadata halaman saat komponen tampil; kembali ke bawaan saat dilepas. */
export function useDocMeta(title: string, description?: string) {
  useEffect(() => {
    applyMeta(title, description);
    return () => applyMeta(null);
  }, [title, description]);
}

/** Bahasa dokumen + og:locale mengikuti pilihan pengguna. */
export function applyLangAttrs() {
  document.documentElement.lang = lang;
  setMeta('meta[property="og:locale"]', "content", isEn ? "en_US" : "id_ID");
}
