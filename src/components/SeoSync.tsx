import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { siteUrl } from "@/lib/site";

/**
 * Menjaga <link rel="canonical"> dan og:url selalu menunjuk ke URL halaman aktif di domain resmi
 * (https://gamatopiranti.zone.id/…) — walau situs dibuka lewat alamat lain (preview, www, dll.).
 * Query string & hash sengaja dibuang agar mesin pencari hanya melihat satu alamat per halaman.
 */
export default function SeoSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
    const url = siteUrl(clean);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = url;
    const og = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (og) og.content = url;
  }, [pathname]);
  return null;
}
