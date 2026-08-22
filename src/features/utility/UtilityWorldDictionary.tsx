import React, { useState } from "react";
import { Languages, ArrowLeftRight, Copy, Loader2 } from "lucide-react";
import { Label, Select, Textarea, Btn } from "@/components/ui/primitives";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoTooltip } from "@/components/ui/GamatoTooltip";
import { copyToClipboard } from "@/lib/utilityHelpers";
import { translateText, TranslateError, WORLD_LANGUAGES, MAX_TRANSLATE_CHARS } from "@/lib/translate";

export const UtilityWorldDictionary: React.FC = () => {
  const [from, setFrom] = useState("id");
  const [to, setTo] = useState("en");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charCount = input.length;
  const overLimit = charCount > MAX_TRANSLATE_CHARS;

  const runTranslate = async () => {
    if (!input.trim() || overLimit) return;
    setIsLoading(true);
    setError(null);
    setOutput("");
    try {
      const result = await translateText(input, from, to);
      if (!result) {
        setError("Tidak ada hasil untuk teks ini.");
      } else {
        setOutput(result);
      }
    } catch (err) {
      setError(err instanceof TranslateError ? err.message : "Gagal menerjemahkan. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const swap = () => {
    const newInput = output || input;
    setFrom(to);
    setTo(from);
    setInput(newInput);
    setOutput("");
    setError(null);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <Select label="Dari Bahasa" value={from} onChange={(e) => setFrom(e.target.value)}>
              {WORLD_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
            <GamatoTooltip label="Tukar bahasa">
              <button
                type="button"
                onClick={swap}
                className="mb-0.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </GamatoTooltip>
            <Select label="Ke Bahasa" value={to} onChange={(e) => setTo(e.target.value)}>
              {WORLD_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Textarea
              label="Kata / Kalimat"
              rows={5}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ketik kata atau kalimat yang ingin dicari artinya…"
            />
            <p className={`text-xs mt-1 text-right ${overLimit ? "text-red-500" : "text-slate-400 dark:text-slate-500"}`}>
              {charCount}/{MAX_TRANSLATE_CHARS} karakter
            </p>
          </div>

          <Btn onClick={runTranslate} disabled={isLoading || !input.trim() || overLimit} className="w-full gap-2">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menerjemahkan…
              </>
            ) : (
              <>
                <Languages className="w-4 h-4" />
                Cari Arti / Terjemahkan
              </>
            )}
          </Btn>
        </div>

        {output && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
            <Label>Hasil</Label>
            <p className="text-lg font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">{output}</p>
            <Btn onClick={() => copyToClipboard(output)} variant="secondary" className="gap-2 text-xs">
              <Copy className="w-3.5 h-3.5" />
              Salin Hasil
            </Btn>
          </div>
        )}
      </div>

      <ToolInfoPanel
        icon={<Languages className="w-5 h-5" />}
        label="Kamus Dunia"
        desc="Terjemahan & arti kata lintas bahasa"
        points={[
          "Mendukung puluhan bahasa dunia, dari Indonesia dan Inggris hingga Jepang, Arab, dan Jawa.",
          "Tekan tombol tukar (⇄) untuk membalik arah terjemahan dengan cepat.",
          "Satu-satunya alat di Rak Utilitas yang butuh koneksi internet — teks diproses oleh layanan terjemahan pihak ketiga, bukan disimpan Gamato Piranti.",
        ]}
        info={error}
        infoTone="error"
        badgeText="Butuh koneksi internet"
      />
    </div>
  );
};
