import { useEffect, useState, type RefObject } from "react";
import { Speaker, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { canSelectAudioOutput, listMediaDevices, pickAudioOutput, setMediaSink, type MediaDeviceOption } from "@/lib/permissions";

/**
 * GamatoSpeakerButton — pilih speaker/headset keluaran untuk pemutar (Chrome/Edge: setSinkId).
 * Tidak tampil di browser yang tidak mendukungnya (Safari/Firefox), jadi tidak pernah menjadi tombol mati.
 * Chrome 110+ memakai dialog pemilih bawaan yang sekaligus memberi izin; sebelum itu memakai daftar perangkat.
 */
export function GamatoSpeakerButton({
  mediaRef,
  className,
  tone = "light",
}: {
  mediaRef: RefObject<HTMLMediaElement | null>;
  className?: string;
  tone?: "light" | "dark";
}) {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceOption[]>([]);
  const [active, setActive] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const supported = canSelectAudioOutput();

  useEffect(() => {
    if (!open) return;
    void listMediaDevices("audiooutput").then(setDevices);
  }, [open]);

  if (!supported) return null;

  const choose = async (deviceId: string) => {
    const ok = await setMediaSink(mediaRef.current, deviceId);
    if (ok) { setActive(deviceId); setNote(null); setOpen(false); }
    else setNote("Speaker tidak bisa dipilih. Izinkan akses dan coba lagi.");
  };

  const onClick = async () => {
    // Dialog bawaan Chrome (memberi izin per perangkat).
    const picked = await pickAudioOutput();
    if (picked) {
      if (picked.deviceId) await choose(picked.deviceId);
      return; // dibatalkan → tidak mengubah apa pun
    }
    setOpen((v) => !v);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-label="Pilih speaker"
        aria-haspopup="listbox"
        data-testid="speaker-picker"
        className={cn("p-1.5 rounded-lg transition-colors", tone === "dark" ? "text-white/70 hover:text-white hover:bg-white/15" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}
      >
        <Speaker className="w-4 h-4" />
      </button>
      {open && (
        <div role="listbox" className="absolute bottom-full right-0 mb-2 z-30 min-w-[190px] max-w-[260px] bg-slate-900/95 backdrop-blur rounded-xl border border-white/10 py-1 shadow-xl">
          <button type="button" role="option" aria-selected={active === ""} onClick={() => choose("")} className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 text-left">
            <span className="truncate">Speaker bawaan</span>{active === "" && <Check className="w-3 h-3 text-indigo-300" />}
          </button>
          {devices.filter((d) => d.deviceId !== "default").map((d) => (
            <button key={d.deviceId} type="button" role="option" aria-selected={active === d.deviceId} onClick={() => choose(d.deviceId)} className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/10 text-left">
              <span className="truncate">{d.label}</span>{active === d.deviceId && <Check className="w-3 h-3 text-indigo-300" />}
            </button>
          ))}
          {note && <p className="px-3 py-1.5 text-[11px] text-amber-300">{note}</p>}
        </div>
      )}
    </div>
  );
}
