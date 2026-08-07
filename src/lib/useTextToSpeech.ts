import { useEffect, useRef, useState } from "react";

export interface SpeakOptions {
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

/**
 * Thin React wrapper around the browser's native SpeechSynthesis API.
 * Note: this can only *play* speech through the device speakers — the Web
 * Speech API does not expose the synthesized audio as a capturable stream,
 * so there's no reliable way to export it as a downloadable audio file.
 */
export function useTextToSpeech() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!supported) return;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  const speak = (text: string, opts: SpeakOptions = {}) => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = voices.find((v) => v.voiceURI === opts.voiceURI);
    if (voice) utter.voice = voice;
    utter.rate = opts.rate ?? 1;
    utter.pitch = opts.pitch ?? 1;
    utter.volume = opts.volume ?? 1;
    utter.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    utter.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utter.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  };

  const pause = () => {
    if (!supported) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  };
  const resume = () => {
    if (!supported) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  };
  const stop = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  return { supported, voices, isSpeaking, isPaused, speak, pause, resume, stop };
}
