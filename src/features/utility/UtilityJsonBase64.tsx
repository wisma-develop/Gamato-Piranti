import React, { useState } from "react";
import { ArrowLeftRight, Copy } from "lucide-react";
import { sanitizeText } from "@/utils/sanitize";
import { Textarea, Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";
import { copyToClipboard } from "@/lib/utilityHelpers";

export const UtilityJsonBase64: React.FC = () => {
  const [textInput, setTextInput] = useState("");
  const [jsonPretty, setJsonPretty] = useState("");
  const [base64, setBase64] = useState("");

  const toJsonPretty = () => {
    try {
      setJsonPretty(JSON.stringify(JSON.parse(textInput), null, 2));
    } catch {
      setJsonPretty("Bukan JSON yang valid.");
    }
  };
  const toBase64 = () => setBase64(btoa(unescape(encodeURIComponent(sanitizeText(textInput)))));
  const fromBase64 = () => {
    try {
      setTextInput(sanitizeText(decodeURIComponent(escape(atob(base64)))));
    } catch {
      // ignore invalid base64 input
    }
  };

  return (
    <PanelCard title="JSON Formatter & Base64 Encoder" subtitle="Format JSON, encode/decode Base64">
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="space-y-3">
          <Textarea label="Input Teks / JSON" rows={8} value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Tempel JSON atau teks di sini…" />
          <div className="flex gap-2">
            <Btn onClick={toJsonPretty} variant="secondary" className="flex-1 text-xs">Format JSON</Btn>
            <Btn onClick={toBase64} variant="secondary" className="flex-1 text-xs gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" />Ke Base64
            </Btn>
          </div>
        </div>
        <div className="space-y-3">
          <Textarea label="JSON Terformat" rows={8} value={jsonPretty} onChange={(e) => setJsonPretty(e.target.value)} placeholder="Hasil JSON rapi…" />
          <Btn onClick={() => copyToClipboard(jsonPretty)} variant="secondary" className="w-full text-xs gap-1.5">
            <Copy className="w-3.5 h-3.5" />Salin JSON
          </Btn>
        </div>
        <div className="space-y-3">
          <Textarea label="Base64" rows={5} value={base64} onChange={(e) => setBase64(e.target.value)} placeholder="Base64 encode/decode…" />
          <div className="flex gap-2">
            <Btn onClick={fromBase64} variant="secondary" className="flex-1 text-xs gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" />Dari Base64
            </Btn>
            <Btn onClick={() => copyToClipboard(base64)} variant="secondary" className="flex-1 text-xs gap-1.5">
              <Copy className="w-3.5 h-3.5" />Salin
            </Btn>
          </div>
        </div>
      </div>
    </PanelCard>
  );
};
