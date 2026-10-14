import { Mic, Volume2, Gauge, AudioLines, RefreshCw, AudioWaveform, ScrollText, Shrink } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function AudioCategory() {
  return (
    <PageShell
      badge="Audio"
      title="Audio Studio"
      subtitle="Semua kebutuhan audio dalam satu tempat — ubah suara jadi teks, teks jadi suara, ukur kekuatan suara, hingga ekstrak audio dari video. Semua diproses langsung di browser."
    >
      <CategoryGrid
        groups={[
          {
            items: [
              { name: "Konversi Audio", desc: "Ubah audio ke WAV (kualitas penuh) atau format terkompresi (Opus).", path: "/audio/konversi", icon: <RefreshCw className="w-6 h-6" /> },
              { name: "Kompres Audio", desc: "Perkecil ukuran audio dengan Opus — preset, bitrate kustom, atau target ukuran file. Bisa banyak file sekaligus.", path: "/audio/kompres", icon: <Shrink className="w-6 h-6" />, badge: "Baru" },
              { name: "Edit Audio", desc: "Editor waveform lengkap — pangkas, fade, tempo, pitch, equalizer, kompresor, reverb, marker, ekspor WAV/Opus.", path: "/audio/edit-audio", icon: <AudioWaveform className="w-6 h-6" />, badge: "Baru" },
              { name: "Transkrip Audio", desc: "Ubah file audio/video jadi transkrip berformat: waktu, pembicara, paragraf, ringkasan — ekspor DOCX, PDF, SRT, VTT, dll.", path: "/audio/transkrip-audio", icon: <ScrollText className="w-6 h-6" />, badge: "Baru" },
              { name: "Speech to Text", desc: "Ubah ucapan jadi teks secara langsung lewat mikrofon.", path: "/audio/suara-ke-teks", icon: <Mic className="w-6 h-6" /> },
              { name: "Text to Speech", desc: "Bacakan teks apa pun dengan suara pilihan langsung dari browser.", path: "/audio/teks-ke-suara", icon: <Volume2 className="w-6 h-6" /> },
              { name: "Pengukur Kekuatan Suara", desc: "Meteran level suara real-time langsung dari mikrofon browser.", path: "/audio/pengukur-suara", icon: <Gauge className="w-6 h-6" /> },
              { name: "Ekstrak Audio dari Video", desc: "Ambil track audio dari file video sebagai file terpisah — bisa dipangkas dulu.", path: "/audio/ekstrak-audio-video", icon: <AudioLines className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
