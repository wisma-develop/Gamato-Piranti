import { useRef, useState } from "react";
import { Volume2, Play, Pause, Square, VolumeX, Download, Loader2, Circle } from "lucide-react";
import { Select, Label, Textarea, Btn } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { useTextToSpeech } from "@/lib/useTextToSpeech";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { encodeAudioBufferToWav } from "@/lib/audioEngine";
import { downloadBlob } from "@/lib/file";
import { sanitizeFileName } from "@/utils/sanitize";
import { cn } from "@/utils/cn";

// The Web Speech API only ever plays audio through the device speakers — it
// never exposes the synthesized speech as a capturable MediaStream, so there
// is no direct "give me the audio buffer" path. What genuinely works without
// a server or a heavy TTS-engine dependency is capturing this *tab's own
// audio output* while the utterance plays (getDisplayMedia + MediaRecorder),
// then re-encoding that recording to .wav with the project's existing
// encoder. This only works in Chromium-based browsers (Chrome/Edge/Opera)
// that support tab-audio sharing, and requires the user to keep the "share
// audio" checkbox ticked in the picker — both real, honest constraints of
// the approach, surfaced in the UI below rather than hidden.
function isRecordingSupported() {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== "undefined";
}

export const AudioTextToSpeech: React.FC = () => {
  const { supported, voices, isSpeaking, isPaused, speak, pause, resume, stop } = useTextToSpeech();
  const [text, setText] = useState("Halo! Ini contoh teks yang akan dibacakan oleh Gamato Piranti.");
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordStage, setRecordStage] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordDone, setRecordDone] = useState<string | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);

  const recordingSupported = isRecordingSupported();
  const effectiveVoiceURI = voiceURI || voices.find((v) => v.lang?.startsWith("id"))?.voiceURI || voices[0]?.voiceURI || "";

  const cleanupDisplayStream = () => {
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = null;
  };

  const recordAndDownload = async () => {
    if (!text.trim() || isRecording || isSpeaking) return;
    setRecordError(null);
    setRecordDone(null);

    if (!recordingSupported) {
      setRecordError("Rekam & unduh audio butuh dukungan berbagi audio tab, yang saat ini hanya tersedia di browser berbasis Chromium (Chrome/Edge/Opera) versi terbaru.");
      return;
    }

    setIsRecording(true);
    setRecordStage("Menunggu izin berbagi tab…");
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
        // Chrome-only hints so the picker defaults to "share this tab" with
        // audio pre-selected — ignored harmlessly by browsers that don't
        // recognize them.
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        systemAudio: "include",
      } as MediaStreamConstraints);
      displayStreamRef.current = displayStream;

      const audioTracks = displayStream.getAudioTracks();
      displayStream.getVideoTracks().forEach((t) => t.stop());
      if (!audioTracks.length) {
        throw new Error('Tidak ada audio yang dibagikan. Saat muncul pilihan tab, pastikan centang "Bagikan audio tab ini" sebelum menekan tombol Bagikan.');
      }

      const audioOnlyStream = new MediaStream(audioTracks);
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(audioOnlyStream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const recorded = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = (e) => reject(e);
      });

      setRecordStage("Merekam…");
      recorder.start();
      await new Promise<void>((resolve, reject) => {
        speak(text, {
          voiceURI: effectiveVoiceURI,
          rate,
          pitch,
          volume,
          onEnd: resolve,
          onError: () => reject(new Error("Pembacaan teks terhenti sebelum selesai.")),
        });
      });
      // Give the tail end of the audio a moment to flush through before cutting the recording.
      await new Promise((r) => setTimeout(r, 400));
      recorder.stop();
      const rawBlob = await recorded;
      cleanupDisplayStream();

      if (rawBlob.size < 400) {
        throw new Error('Tidak ada audio yang terekam. Pastikan Volume di atas 0% dan tab tidak di-mute saat berbagi audio, lalu coba lagi.');
      }

      setRecordStage("Menyusun file .wav…");
      const arrayBuffer = await rawBlob.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const decodeCtx = new AudioCtx();
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
      } finally {
        decodeCtx.close().catch(() => {});
      }
      const wavBlob = encodeAudioBufferToWav(audioBuffer);
      const base = sanitizeFileName(text.slice(0, 40).trim() || "gamato-tts") || "gamato-tts";
      downloadBlob(wavBlob, `${base}.wav`);
      setRecordDone("Audio berhasil direkam dan diunduh sebagai .wav.");
    } catch (err: any) {
      stop();
      if (err?.name === "NotAllowedError") {
        setRecordError('Berbagi tab dibatalkan atau ditolak. Coba lagi, pilih "Tab ini", dan pastikan "Bagikan audio tab ini" dicentang.');
      } else {
        setRecordError(err?.message || "Gagal merekam audio.");
      }
    } finally {
      cleanupDisplayStream();
      setIsRecording(false);
      setRecordStage(null);
    }
  };

  if (!supported) {
    return (
      <div className="max-w-xl mx-auto bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-6 text-center space-y-2">
        <VolumeX className="w-8 h-8 mx-auto text-amber-500" />
        <p className="font-bold text-amber-700 dark:text-amber-400">Browser ini belum mendukung Text to Speech</p>
        <p className="text-sm text-amber-600 dark:text-amber-400">Coba buka dengan browser modern seperti Chrome, Edge, Firefox, atau Safari terbaru.</p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <Textarea label="Teks yang akan dibacakan" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tulis atau tempel teks di sini…" />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <Select label="Suara" value={effectiveVoiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </Select>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Kecepatan</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{rate.toFixed(1)}x</span>
            </div>
            <GamatoSlider min={0.5} max={2} step={0.1} value={rate} onChange={setRate} aria-label="Kecepatan bicara" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Nada (Pitch)</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{pitch.toFixed(1)}</span>
            </div>
            <GamatoSlider min={0} max={2} step={0.1} value={pitch} onChange={setPitch} aria-label="Nada suara" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <Label>Volume</Label>
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(volume * 100)}%</span>
            </div>
            <GamatoSlider min={0} max={1} step={0.05} value={volume} onChange={setVolume} aria-label="Volume" />
          </div>
        </div>

        <div className="flex gap-3">
          {!isSpeaking ? (
            <Btn onClick={() => speak(text, { voiceURI: effectiveVoiceURI, rate, pitch, volume })} disabled={!text.trim() || isRecording} className="flex-1 py-4 gap-2">
              <Play className="w-4 h-4" /> Putar
            </Btn>
          ) : (
            <Btn onClick={isPaused ? resume : pause} disabled={isRecording} className="flex-1 py-4 gap-2">
              {isPaused ? (
                <>
                  <Play className="w-4 h-4" /> Lanjutkan
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" /> Jeda
                </>
              )}
            </Btn>
          )}
          <Btn onClick={stop} disabled={!isSpeaking || isRecording} variant="secondary" className="gap-2">
            <Square className="w-4 h-4" /> Stop
          </Btn>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
          <Btn
            onClick={recordAndDownload}
            disabled={!text.trim() || isRecording || isSpeaking}
            variant="secondary"
            className={cn("w-full py-3.5 gap-2", isRecording && "border-red-300 text-red-600 dark:border-red-500/40 dark:text-red-400")}
          >
            {isRecording ? (
              <>
                <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" />
                {recordStage || "Merekam…"}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> Rekam &amp; Unduh Audio (.wav)
              </>
            )}
          </Btn>
          {recordStage === "Menyusun file .wav…" && (
            <p className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyusun file .wav…
            </p>
          )}
          {recordError && <p className="text-xs text-red-600 dark:text-red-400">{recordError}</p>}
          {recordDone && !recordError && <p className="text-xs text-emerald-600 dark:text-emerald-400">{recordDone}</p>}
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {recordingSupported
              ? 'Browser akan meminta izin berbagi tab — pilih "Tab ini" dan pastikan opsi "Bagikan audio tab ini" dicentang. Rekaman diproses sepenuhnya di perangkatmu, lalu diunduh sebagai .wav.'
              : "Fitur ini butuh browser berbasis Chromium (Chrome/Edge/Opera) versi terbaru yang mendukung berbagi audio tab."}
          </p>
        </div>
      </div>

      <ToolInfoPanel
        icon={<Volume2 className="w-5 h-5" />}
        label="Text to Speech"
        desc="Teks dibacakan otomatis"
        points={[
          "Pilih suara sesuai bahasa teksmu untuk hasil pelafalan terbaik.",
          "Atur kecepatan, nada, dan volume sesuai kebutuhan.",
          "Rekam & Unduh mengubah hasil bacaan menjadi file .wav yang bisa disimpan atau dibagikan.",
        ]}
      />
    </div>
  );
};
