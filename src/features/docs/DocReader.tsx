import React, { useState } from "react";
import { BookOpen, FileText, Trash2, Play, Pause, Square, Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/utils/cn";
import { readDocxBlocks, readRtfText } from "@/lib/officeReaders";
import { blocksToPlainText } from "@/features/docs/richtext/parseEditor";
import { useTextToSpeech } from "@/lib/useTextToSpeech";
import { Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const DocReader: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [fontSize, setFontSize] = useState(17);
  const [isLoading, setIsLoading] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { supported, isSpeaking, isPaused, speak, pause, resume, stop } = useTextToSpeech();

  const addFiles = async (incoming: File[]) => {
    const f = incoming.find((x) => /\.(txt|docx|rtf)$/i.test(x.name));
    if (!f) {
      setInfo("Format belum didukung. Gunakan .txt, .docx, atau .rtf.");
      return;
    }
    setInfo(null);
    setIsLoading(true);
    stop();
    try {
      let text = "";
      if (/\.docx$/i.test(f.name)) {
        const blocks = await readDocxBlocks(f);
        text = blocksToPlainText(blocks);
      } else if (/\.rtf$/i.test(f.name)) {
        text = await readRtfText(f);
      } else {
        text = await f.text();
      }
      setFile(f);
      setContent(text);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal membaca file."));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
      <div className="space-y-5">
        {!file ? (
          <Dropzone
            onFiles={addFiles}
            accept=".txt,.docx,.rtf"
            multiple={false}
            label="Drop dokumen di sini"
            sublabel=".txt, .docx, atau .rtf"
            icon={<FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => setFontSize((s) => Math.max(13, s - 1))} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-400 dark:text-slate-500 w-8 text-center">{fontSize}px</span>
                <button type="button" onClick={() => setFontSize((s) => Math.min(28, s + 1))} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg">
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stop();
                    setFile(null);
                    setContent("");
                    setInfo(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg ml-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[65vh] overflow-y-auto px-6 py-6 sm:px-10 sm:py-8 bg-white dark:bg-slate-900">
              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Membaca dokumen…
                </div>
              ) : (
                <div className="whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-200 font-serif" style={{ fontSize }}>
                  {content || "(Dokumen kosong)"}
                </div>
              )}
            </div>
          </div>
        )}

        {supported && content && (
          <div className="flex gap-3">
            {!isSpeaking ? (
              <Btn onClick={() => speak(content, { rate: 1 })} className="flex-1 py-3.5 gap-2">
                <Play className="w-4 h-4" /> Dengarkan Dokumen
              </Btn>
            ) : (
              <Btn onClick={isPaused ? resume : pause} className="flex-1 py-3.5 gap-2">
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
            <Btn onClick={stop} disabled={!isSpeaking} variant="secondary" className="gap-2">
              <Square className="w-4 h-4" /> Stop
            </Btn>
          </div>
        )}

        {info && (
          <div className={cn("text-sm rounded-xl px-4 py-3 border font-medium", "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30")}>
            {info}
          </div>
        )}
      </div>

      <ToolInfoPanel
        icon={<BookOpen className="w-5 h-5" />}
        label="Doc Reader"
        desc="Baca .txt, .docx, .rtf"
        points={["Tampilan baca nyaman dengan ukuran font yang bisa diatur.", "Bisa didengarkan langsung lewat Text-to-Speech bawaan browser."]}
      />
    </div>
  );
};
