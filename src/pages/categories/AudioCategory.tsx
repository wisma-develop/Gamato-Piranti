import { Mic, Volume2, Gauge, AudioLines, RefreshCw, AudioWaveform, ScrollText, Shrink } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";
import { tr } from "@/i18n";

export default function AudioCategory() {
  return (
    <PageShell
      badge={tr("Audio")}
      title={tr("Audio Studio")}
      subtitle={tr("Semua kebutuhan audio dalam satu tempat — ubah suara jadi teks, teks jadi suara, ukur kekuatan suara, hingga ekstrak audio dari video. Semua diproses langsung di browser.")}
    >
      <CategoryGrid
        groups={[
          {
            items: [
              { name: tr("Konversi Audio"), desc: tr("Ubah audio ke WAV (kualitas penuh) atau format terkompresi (Opus)."), path: "/audio/konversi", icon: <RefreshCw className="w-6 h-6" /> },
              { name: tr("Kompres Audio"), desc: tr("Perkecil ukuran audio dengan Opus — preset, bitrate kustom, atau target ukuran file. Bisa banyak file sekaligus."), path: "/audio/kompres", icon: <Shrink className="w-6 h-6" />, badge: tr("Baru") },
              { name: tr("Edit Audio"), desc: tr("Editor waveform lengkap — pangkas, fade, tempo, pitch, equalizer, kompresor, reverb, marker, ekspor WAV/Opus."), path: "/audio/edit-audio", icon: <AudioWaveform className="w-6 h-6" />, badge: tr("Baru") },
              { name: tr("Audio Visualizer"), desc: tr("Ubah lagu jadi visual bergerak (13 gaya, kustom penuh) lalu ekspor .mov dengan latar transparan otomatis — atau beri latar sendiri."), path: "/audio/visualizer", icon: <AudioLines className="w-6 h-6" />, badge: tr("Baru") },
              { name: tr("Transkrip Audio"), desc: tr("Ubah file audio/video jadi transkrip berformat: waktu, pembicara, paragraf, ringkasan — ekspor DOCX, PDF, SRT, VTT, dll."), path: "/audio/transkrip-audio", icon: <ScrollText className="w-6 h-6" />, badge: tr("Baru") },
              { name: tr("Speech to Text"), desc: tr("Ubah ucapan jadi teks secara langsung lewat mikrofon."), path: "/audio/suara-ke-teks", icon: <Mic className="w-6 h-6" /> },
              { name: tr("Text to Speech"), desc: tr("Bacakan teks apa pun dengan suara pilihan langsung dari browser."), path: "/audio/teks-ke-suara", icon: <Volume2 className="w-6 h-6" /> },
              { name: tr("Pengukur Kekuatan Suara"), desc: tr("Meteran level suara real-time langsung dari mikrofon browser."), path: "/audio/pengukur-suara", icon: <Gauge className="w-6 h-6" /> },
              { name: tr("Ekstrak Audio dari Video"), desc: tr("Ambil track audio dari file video sebagai file terpisah — bisa dipangkas dulu."), path: "/audio/ekstrak-audio-video", icon: <AudioLines className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
