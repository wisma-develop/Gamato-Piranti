import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Gauge } from "lucide-react";
import { cn } from "@/utils/cn";
import { Btn } from "@/components/ui/primitives";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

function levelInfo(pct: number): { label: string; tone: string } {
  if (pct < 15) return { label: "Hening", tone: "text-emerald-500 dark:text-emerald-400" };
  if (pct < 40) return { label: "Tenang", tone: "text-emerald-500 dark:text-emerald-400" };
  if (pct < 65) return { label: "Normal", tone: "text-amber-500 dark:text-amber-400" };
  if (pct < 85) return { label: "Ramai", tone: "text-orange-500 dark:text-orange-400" };
  return { label: "Sangat Keras", tone: "text-red-500 dark:text-red-400" };
}

export const UtilitySoundMeter: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [dbfs, setDbfs] = useState<number>(-Infinity);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const peakDecayRef = useRef(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    peakDecayRef.current = 0;
    setIsActive(false);
    setLevel(0);
    setPeak(0);
    setDbfs(-Infinity);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      setIsActive(true);

      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        const db = rms > 0 ? 20 * Math.log10(rms) : -100;
        const clamped = Math.max(-60, Math.min(0, db));
        const pct = Math.round(((clamped + 60) / 60) * 100);

        setDbfs(db);
        setLevel(pct);
        peakDecayRef.current = Math.max(pct, peakDecayRef.current - 1.5);
        setPeak(Math.round(peakDecayRef.current));

        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err: any) {
      setIsActive(false);
      setError(
        err?.name === "NotAllowedError"
          ? "Izin mikrofon ditolak. Aktifkan akses mikrofon di pengaturan browser untuk memakai alat ini."
          : "Gagal mengakses mikrofon. Pastikan perangkatmu punya mikrofon yang aktif."
      );
    }
  }, []);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { label, tone } = levelInfo(level);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
          <div className="flex flex-col items-center gap-6">
            <div className="relative w-full max-w-sm">
              <div className="h-8 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
                <div
                  className={cn(
                    "h-full transition-all duration-100 rounded-full",
                    level < 40 ? "bg-emerald-500" : level < 65 ? "bg-amber-500" : level < 85 ? "bg-orange-500" : "bg-red-500"
                  )}
                  style={{ width: `${level}%` }}
                />
              </div>
              <div className="absolute top-0 h-8 w-0.5 bg-slate-900/60 dark:bg-white/70" style={{ left: `${peak}%` }} />
            </div>

            <div className="text-center">
              <p className={cn("text-4xl font-bold tabular-nums", tone)}>{isActive ? level : 0}%</p>
              <p className={cn("text-sm font-semibold mt-1", tone)}>{isActive ? label : "Belum aktif"}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {isActive ? `${dbfs === -Infinity ? "-∞" : dbfs.toFixed(1)} dBFS relatif` : "Tekan mulai untuk mengaktifkan mikrofon"}
              </p>
            </div>

            <Btn onClick={isActive ? stop : start} className="gap-2" variant={isActive ? "danger" : "primary"}>
              {isActive ? (
                <>
                  <MicOff className="w-4 h-4" />
                  Berhenti
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Mulai Mengukur
                </>
              )}
            </Btn>

            {error && <p className="text-sm text-red-600 dark:text-red-400 text-center max-w-sm">{error}</p>}
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl px-5 py-4 text-sm text-amber-800 dark:text-amber-300">
          Pengukuran ini bersifat <strong>relatif</strong>, mengikuti sensitivitas mikrofon perangkatmu — bukan pengukuran desibel (dB SPL) terkalibrasi seperti alat sound level meter profesional. Gunakan sebagai indikator kasar, bukan acuan resmi.
        </div>
      </div>

      <ToolInfoPanel
        icon={<Gauge className="w-5 h-5" />}
        label="Pengukur Kekuatan Suara"
        desc="Meter level suara real-time"
        points={[
          "Memakai Web Audio API langsung dari mikrofon browser — tanpa server.",
          "Audio tidak direkam maupun disimpan, hanya level volumenya yang dianalisis secara langsung.",
          "Tekan Berhenti kapan saja untuk melepas akses mikrofon.",
        ]}
        badgeText="Native — audio tidak direkam/dikirim"
      />
    </div>
  );
};
