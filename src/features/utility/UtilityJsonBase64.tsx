import React from "react";
import { ArrowLeftRight, Copy } from "lucide-react";
import { sanitizeText } from "@/utils/sanitize";
import { Textarea, Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";
import { copyToClipboard } from "@/lib/utilityHelpers";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";
import { tr } from "@/i18n";

type JsonB64State = { textInput: string; jsonPretty: string; base64: string };

export const UtilityJsonBase64: React.FC = () => {
  // Ketiga kotak teks punya riwayat Undo/Redo, digabung jadi satu langkah
  // setelah jeda; tombol Format/Encode/Decode langsung commit.
  const history = useHistoryState<JsonB64State>({ textInput: "", jsonPretty: "", base64: "" });
  const { textInput, jsonPretty, base64 } = history.state;
  const { schedule: scheduleCommit } = useDebouncedCommit(history.commit, 600);
  const setTextInput = (v: string) => {
    history.set((prev) => ({ ...prev, textInput: v }), { commit: false });
    scheduleCommit();
  };
  const setJsonPretty = (v: string) => {
    history.set((prev) => ({ ...prev, jsonPretty: v }), { commit: false });
    scheduleCommit();
  };
  const setBase64 = (v: string) => {
    history.set((prev) => ({ ...prev, base64: v }), { commit: false });
    scheduleCommit();
  };

  const toJsonPretty = () => {
    try {
      history.set((prev) => ({ ...prev, jsonPretty: JSON.stringify(JSON.parse(prev.textInput), null, 2) }));
    } catch {
      history.set((prev) => ({ ...prev, jsonPretty: tr("Bukan JSON yang valid.") }));
    }
  };
  const toBase64 = () => history.set((prev) => ({ ...prev, base64: btoa(unescape(encodeURIComponent(sanitizeText(prev.textInput)))) }));
  const fromBase64 = () => {
    try {
      history.set((prev) => ({ ...prev, textInput: sanitizeText(decodeURIComponent(escape(atob(prev.base64)))) }));
    } catch {
      // ignore invalid base64 input
    }
  };

  return (
    <PanelCard title={tr("JSON Formatter & Base64 Encoder")} subtitle={tr("Format JSON, encode/decode Base64")}>
      <div className="flex justify-end -mt-2 mb-1">
        <UndoRedoBar canUndo={history.canUndo} canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-3">
          <Textarea label={tr("Input Teks / JSON")} rows={8} value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder={tr("Tempel JSON atau teks di sini…")} />
          <div className="flex gap-2">
            <Btn onClick={toJsonPretty} variant="secondary" className="flex-1 text-xs">{tr("Format JSON")}</Btn>
            <Btn onClick={toBase64} variant="secondary" className="flex-1 text-xs gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" />{tr("Ke Base64")}
            </Btn>
          </div>
        </div>
        <div className="space-y-3">
          <Textarea label={tr("JSON Terformat")} rows={8} value={jsonPretty} onChange={(e) => setJsonPretty(e.target.value)} placeholder={tr("Hasil JSON rapi…")} />
          <Btn onClick={() => copyToClipboard(jsonPretty)} variant="secondary" className="w-full text-xs gap-1.5">
            <Copy className="w-3.5 h-3.5" />{tr("Salin JSON")}
          </Btn>
        </div>
        <div className="space-y-3">
          <Textarea label={tr("Base64")} rows={5} value={base64} onChange={(e) => setBase64(e.target.value)} placeholder={tr("Base64 encode/decode…")} />
          <div className="flex gap-2">
            <Btn onClick={fromBase64} variant="secondary" className="flex-1 text-xs gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" />{tr("Dari Base64")}
            </Btn>
            <Btn onClick={() => copyToClipboard(base64)} variant="secondary" className="flex-1 text-xs gap-1.5">
              <Copy className="w-3.5 h-3.5" />{tr("Salin")}
            </Btn>
          </div>
        </div>
      </div>
    </PanelCard>
  );
};
