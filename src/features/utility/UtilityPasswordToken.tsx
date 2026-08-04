import React, { useState } from "react";
import { KeyRound, Copy } from "lucide-react";
import { Label, Input, Select, Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";
import { cryptoRandomInt, bytesToBase64, copyToClipboard } from "@/lib/utilityHelpers";

export const UtilityPasswordToken: React.FC = () => {
  const [pwLength, setPwLength] = useState(16);
  const [pwUpper, setPwUpper] = useState(true);
  const [pwLower, setPwLower] = useState(true);
  const [pwNumber, setPwNumber] = useState(true);
  const [pwSymbol, setPwSymbol] = useState(false);
  const [pwOutput, setPwOutput] = useState("");
  const [tokenBytes, setTokenBytes] = useState(32);
  const [tokenFormat, setTokenFormat] = useState<"hex" | "base64" | "urlsafe">("hex");
  const [tokenOutput, setTokenOutput] = useState("");

  const generatePassword = () => {
    const length = Math.min(Math.max(pwLength, 6), 128);
    const U = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const L = "abcdefghijkmnopqrstuvwxyz";
    const N = "23456789";
    const S = "!@#$%^&*()-_=+[]{};:,.?";
    let pool = "";
    const must: string[] = [];
    if (pwUpper) {
      pool += U;
      must.push(U[cryptoRandomInt(U.length)]);
    }
    if (pwLower) {
      pool += L;
      must.push(L[cryptoRandomInt(L.length)]);
    }
    if (pwNumber) {
      pool += N;
      must.push(N[cryptoRandomInt(N.length)]);
    }
    if (pwSymbol) {
      pool += S;
      must.push(S[cryptoRandomInt(S.length)]);
    }
    if (!pool) {
      setPwOutput("");
      return;
    }
    const out = [...must];
    while (out.length < length) out.push(pool[cryptoRandomInt(pool.length)]);
    for (let i = out.length - 1; i > 0; i--) {
      const j = cryptoRandomInt(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    setPwOutput(out.join(""));
  };

  const generateToken = () => {
    const n = Math.min(Math.max(tokenBytes, 4), 128);
    const bytes = new Uint8Array(n);
    window.crypto.getRandomValues(bytes);
    if (tokenFormat === "hex") setTokenOutput(Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""));
    else if (tokenFormat === "base64") setTokenOutput(bytesToBase64(bytes));
    else setTokenOutput(bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  };

  return (
    <PanelCard title="Password & Token Generator" subtitle="Berbasis Web Crypto API — aman dan acak">
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Password Generator</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Panjang Password" type="number" min={6} max={128} value={pwLength} onChange={(e) => setPwLength(parseInt(e.target.value) || 16)} />
            <div>
              <Label>Karakter</Label>
              <div className="mt-2 space-y-1.5">
                {([
                  ["Huruf Besar", pwUpper, setPwUpper],
                  ["Huruf Kecil", pwLower, setPwLower],
                  ["Angka", pwNumber, setPwNumber],
                  ["Simbol", pwSymbol, setPwSymbol],
                ] as const).map(([l, v, setter], i) => (
                  <label key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={v} onChange={(e) => setter(e.target.checked)} className="rounded accent-indigo-600" />
                    {l}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <Btn onClick={generatePassword} className="w-full gap-2">
            <KeyRound className="w-4 h-4" />Buat Password
          </Btn>
          {pwOutput && (
            <div className="space-y-2">
              <div className="bg-slate-900 text-green-400 font-mono text-sm rounded-xl px-4 py-3 break-all">{pwOutput}</div>
              <Btn onClick={() => copyToClipboard(pwOutput)} variant="secondary" className="w-full gap-2">
                <Copy className="w-4 h-4" />Salin Password
              </Btn>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Token Generator</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Panjang (byte)" type="number" min={4} max={128} value={tokenBytes} onChange={(e) => setTokenBytes(parseInt(e.target.value) || 32)} />
            <Select label="Format" value={tokenFormat} onChange={(e) => setTokenFormat(e.target.value as any)}>
              <option value="hex">Hex</option>
              <option value="base64">Base64</option>
              <option value="urlsafe">URL-safe Base64</option>
            </Select>
          </div>
          <Btn onClick={generateToken} className="w-full gap-2">
            <KeyRound className="w-4 h-4" />Buat Token
          </Btn>
          {tokenOutput && (
            <div className="space-y-2">
              <div className="bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl px-4 py-3 break-all">{tokenOutput}</div>
              <Btn onClick={() => copyToClipboard(tokenOutput)} variant="secondary" className="w-full gap-2">
                <Copy className="w-4 h-4" />Salin Token
              </Btn>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-4">
        Gamato Piranti tidak mengirim password/token ke server mana pun. Simpan dengan aman di password manager.
      </p>
    </PanelCard>
  );
};
