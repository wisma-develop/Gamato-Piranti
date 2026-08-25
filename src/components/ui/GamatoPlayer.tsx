import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, RotateCcw, Gauge, Zap } from "lucide-react";
import { cn } from "@/utils/cn";
import { GamatoSlider } from "@/components/ui/GamatoSlider";

/**
 * GamatoPlayer — engine pemutar video kustom bermerek Gamato Piranti.
 * Tidak menggunakan atribut `controls` bawaan browser sama sekali —
 * seluruh UI (play/pause, seek, volume, kecepatan, fullscreen) dibangun native oleh Gamato Piranti.
 */

export type GamatoPlayerHandle = HTMLVideoElement;

type GamatoPlayerProps = {
  src: string;
  className?: string;
  autoLoop?: boolean;
  onTimeUpdate?: (t: number) => void;
  onLoadedMetadata?: (video: HTMLVideoElement) => void;
  compact?: boolean; // hasil kecil vs preview sumber
  label?: string;
  videoStyle?: React.CSSProperties;
  forceMuted?: boolean;
};

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const GamatoPlayer = forwardRef<GamatoPlayerHandle, GamatoPlayerProps>(function GamatoPlayer(
  { src, className, autoLoop = false, onTimeUpdate, onLoadedMetadata, compact = false, label, videoStyle, forceMuted },
  forwardedRef
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => videoRef.current as HTMLVideoElement);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [hideChrome, setHideChrome] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
  }, [src]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement && document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Math.max(0, Math.min(duration, t));
    setCurrent(v.currentTime);
  };

  const handleBarPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const changeSpeed = (s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setShowSpeed(false);
  };

  const toggleFullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  const restart = () => seekTo(0);

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHideChrome(true), 2200);
  };
  const wake = () => {
    setHideChrome(false);
    scheduleHide();
  };

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const progressPct = duration ? (current / duration) * 100 : 0;

  return (
    <div
      ref={wrapRef}
      onMouseMove={wake}
      onMouseLeave={() => !scrubbing && playing && setHideChrome(true)}
      className={cn(
        "group relative bg-black rounded-2xl overflow-hidden shadow-sm select-none",
        isFullscreen && "rounded-none",
        className
      )}
    >
      {label && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
          <Zap className="w-3 h-3 text-indigo-300" />
          Gamato Piranti
        </div>
      )}

      <video
        ref={videoRef}
        src={src}
        loop={autoLoop}
        playsInline
        muted={forceMuted || muted}
        style={videoStyle}
        className={cn("w-full h-auto block", compact ? "max-h-[360px]" : "max-h-[480px]")}
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrent(t);
          onTimeUpdate?.(t);
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          onLoadedMetadata?.(e.currentTarget);
        }}
      />

      {/* Center play/pause overlay */}
      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Putar"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
        >
          <span className="w-16 h-16 rounded-full bg-white/95 shadow-xl flex items-center justify-center text-slate-900 group-hover:scale-105 transition-transform">
            <Play className="w-7 h-7 ml-1" fill="currentColor" />
          </span>
        </button>
      )}

      {/* Bottom control bar — 100% custom, tanpa browser default */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pt-8 pb-2.5 transition-opacity duration-200",
          hideChrome && !scrubbing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {/* Seek bar */}
        <div
          className="relative h-1.5 rounded-full bg-white/25 cursor-pointer mb-2.5 group/bar"
          onPointerDown={(e) => { setScrubbing(true); handleBarPointer(e); }}
          onPointerMove={(e) => { if (e.buttons === 1) handleBarPointer(e); }}
          onPointerUp={() => setScrubbing(false)}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-400" style={{ width: `${progressPct}%` }} />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow ring-2 ring-indigo-400 opacity-0 group-hover/bar:opacity-100 transition-opacity"
            style={{ left: `calc(${progressPct}% - 6px)` }}
          />
        </div>

        <div className="flex items-center gap-2 text-white">
          <button type="button" onClick={togglePlay} className="p-1.5 hover:bg-white/15 rounded-lg transition-colors" aria-label={playing ? "Jeda" : "Putar"}>
            {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
          </button>
          <button type="button" onClick={restart} className="p-1.5 hover:bg-white/15 rounded-lg transition-colors" aria-label="Ulang dari awal">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="flex items-center gap-1.5 gp-vol-group">
            <button type="button" onClick={toggleMute} className="p-1.5 hover:bg-white/15 rounded-lg transition-colors" aria-label="Volume">
              <VolIcon className="w-4 h-4" />
            </button>
            <GamatoSlider
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={changeVolume}
              aria-label="Volume"
              className="gp-volume-track transition-all duration-200 h-1 bg-white/25"
            />
          </div>

          <span className="text-[11px] font-mono text-white/85 ml-0.5 tabular-nums">
            {fmt(current)} / {fmt(duration)}
          </span>

          <div className="flex-1" />

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSpeed((v) => !v)}
              className="flex items-center gap-1 px-2 py-1 hover:bg-white/15 rounded-lg transition-colors text-[11px] font-bold"
              aria-label="Kecepatan putar"
            >
              <Gauge className="w-3.5 h-3.5" />
              {speed}×
            </button>
            {showSpeed && (
              <div className="absolute bottom-full right-0 mb-2 bg-slate-900/95 backdrop-blur rounded-xl border border-white/10 py-1 shadow-xl min-w-[64px]">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeSpeed(s)}
                    className={cn("w-full text-center px-3 py-1.5 text-xs font-semibold hover:bg-white/10", s === speed ? "text-indigo-300" : "text-white/80")}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={toggleFullscreen} className="p-1.5 hover:bg-white/15 rounded-lg transition-colors" aria-label="Layar penuh">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
});
