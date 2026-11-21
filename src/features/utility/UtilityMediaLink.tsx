import React, { useState } from "react";
import { Info } from "lucide-react";
import { sanitizeUrl } from "@/utils/sanitize";
import { Input, Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";
import { tr } from "@/i18n";

export const UtilityMediaLink: React.FC = () => {
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaInfo, setMediaInfo] = useState<string | null>(null);
  const [directDownload, setDirectDownload] = useState<string | null>(null);

  const analyzeMedia = () => {
    setMediaInfo(null);
    setDirectDownload(null);
    const safe = sanitizeUrl(mediaUrl);
    if (!safe) {
      setMediaInfo(tr("URL tidak valid."));
      return;
    }
    try {
      const u = new URL(safe);
      if (/\.(mp4|webm|mov|m4a|mp3|wav)$/i.test(u.pathname)) {
        setDirectDownload(safe);
        setMediaInfo(tr("Terlihat seperti berkas langsung. Klik unduh."));
        return;
      }
      const host = u.hostname.replace(/^www\./, "");
      if (["youtube.com", "youtu.be", "tiktok.com", "instagram.com", "twitter.com", "x.com"].includes(host))
        setMediaInfo(tr("Platform streaming besar tidak bisa diunduh langsung. Gunakan yt-dlp di terminal."));
      else setMediaInfo(tr("Link ini bukan berkas video langsung."));
    } catch {
      setMediaInfo(tr("URL tidak valid."));
    }
  };

  return (
    <PanelCard title={tr("Helper Link & Media")} subtitle={tr("Analisis link video/file untuk unduhan langsung")}>
      <div className="space-y-4 max-w-xl mx-auto w-full">
        <Input label={tr("URL Video / File")} type="url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://example.com/video.mp4" />
        <Btn onClick={analyzeMedia} variant="secondary" className="gap-2">
          <Info className="w-4 h-4" />{tr("Analisis Link")}
        </Btn>
        {mediaInfo && <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{mediaInfo}</div>}
        {directDownload && (
          <a href={directDownload} download className="flex items-center justify-between gap-3 bg-slate-900 text-white rounded-xl px-5 py-3 font-semibold hover:bg-slate-800 transition-colors">
            <span>{tr("Unduh Langsung")}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{tr("Buka tab baru jika gagal")}</span>
          </a>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
          {tr("Untuk YouTube/TikTok/Instagram, gunakan:")} <code className="bg-slate-200 dark:bg-slate-700 rounded px-1">{tr("yt-dlp \"URL\"")}</code> {tr("di terminal.")}
        </p>
      </div>
    </PanelCard>
  );
};
