import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Copy, Download, RefreshCw } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { Select, Textarea, Btn } from "@/components/ui/primitives";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

const LANGUAGES = [
  { id: "id-ID", label: "Bahasa Indonesia" },
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "ja-JP", label: "日本語" },
  { id: "ko-KR", label: "한국어" },
  { id: "zh-CN", label: "中文 (简体)" },
];

export const SpeechToText: React.FC = () => {
  const [lang, setLang] = useState("id-ID");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionCtor = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const supported = !!SpeechRecognitionCtor;

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
    };
  }, []);

  const start = () => {
    if (!SpeechRecognitionCtor) return;
    setInfo(null);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalChunk += res[0].transcript;
        else interimChunk += res[0].transcript;
      }
      if (finalChunk) setTranscript((prev) => (prev ? `${prev} ${finalChunk.trim()}` : finalChunk.trim()));
      setInterim(interimChunk);
    };
    recognition.onerror = (e: any) => {
      setInfo(`Terjadi kendala: ${e?.error || "tidak diketahui"}. Coba lagi.`);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterim("");
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setInfo("Teks disalin ke clipboard.");
    } catch {
      setInfo("Gagal menyalin teks.");
    }
  };

  const downloadTxt = () => {
    if (!transcript) return;
    downloadBlob(new Blob([transcript], { type: "text/plain;charset=utf-8" }), "gamato-speech-to-text.txt");
  };

  if (!supported) {
    return (
      <div className="max-w-xl mx-auto bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-6 text-center space-y-2">
        <MicOff className="w-8 h-8 mx-auto text-amber-500" />
        <p className="font-bold text-amber-700 dark:text-amber-400">Browser ini belum mendukung Speech to Text</p>
        <p className="text-sm text-amber-600 dark:text-amber-400">Fitur ini menggunakan Web Speech API bawaan browser. Coba buka dengan Google Chrome atau Microsoft Edge terbaru.</p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={isListening ? stop : start}
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg",
              isListening ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {isListening ? <MicOff className="w-9 h-9 text-white" /> : <Mic className="w-9 h-9 text-white" />}
          </button>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{isListening ? "Mendengarkan… klik untuk berhenti" : "Klik mikrofon untuk mulai bicara"}</p>
          <div className="w-full max-w-xs">
            <Select label="Bahasa" value={lang} onChange={(e) => setLang(e.target.value)} disabled={isListening}>
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Hasil Transkrip</p>
            <button type="button" onClick={() => setTranscript("")} className="text-xs text-red-500 font-semibold flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" /> Bersihkan
            </button>
          </div>
          <Textarea rows={10} value={transcript + (interim ? (transcript ? " " : "") + interim : "")} onChange={(e) => setTranscript(e.target.value)} placeholder="Teks hasil ucapan akan muncul di sini…" />
          <div className="flex gap-2">
            <Btn onClick={copyText} disabled={!transcript} variant="secondary" className="flex-1 gap-2 text-sm">
              <Copy className="w-4 h-4" /> Salin
            </Btn>
            <Btn onClick={downloadTxt} disabled={!transcript} variant="secondary" className="flex-1 gap-2 text-sm">
              <Download className="w-4 h-4" /> Unduh .txt
            </Btn>
          </div>
        </div>

        {info && <GamatoInlineAlert message={info} tone="warning" />}
      </div>

      <ToolInfoPanel
        icon={<Mic className="w-5 h-5" />}
        label="Speech to Text"
        desc="Ucapan menjadi teks"
        points={["Butuh izin mikrofon dari browser saat pertama kali dipakai.", "Bekerja paling baik di ruangan yang tidak berisik.", "Teks hasil transkrip bisa langsung diedit sebelum disalin/diunduh."]}
      />
    </div>
  );
};
