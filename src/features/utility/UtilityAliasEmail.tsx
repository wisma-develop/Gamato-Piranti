import React, { useState } from "react";
import { Zap, Copy } from "lucide-react";
import { sanitizeText } from "@/utils/sanitize";
import { Input, Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";
import { copyToClipboard } from "@/lib/utilityHelpers";
import { tr } from "@/i18n";

export const UtilityAliasEmail: React.FC = () => {
  const [baseEmail, setBaseEmail] = useState("");
  const [aliasDomain, setAliasDomain] = useState("example.com");
  const [aliasEmail, setAliasEmail] = useState<string | null>(null);
  const [aliasInfo, setAliasInfo] = useState<string | null>(null);

  const generateAlias = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const trimmed = baseEmail.trim();
    if (trimmed && trimmed.includes("@")) {
      const [local, domain] = trimmed.split("@");
      setAliasEmail(`${local}+gp-${stamp}@${domain}`);
      setAliasInfo(tr("Plus-address dari email utama."));
    } else {
      const rand = Math.random().toString(36).slice(2, 8);
      setAliasEmail(`gp-${rand}-${stamp}@${aliasDomain}`);
      setAliasInfo(tr("Alamat acak disiapkan."));
    }
  };

  const copyAlias = async () => {
    const ok = await copyToClipboard(aliasEmail || "");
    setAliasInfo(ok ? tr("Disalin!") : tr("Gagal menyalin."));
  };

  return (
    <PanelCard title={tr("Alias & Temp Email Planner")} subtitle={tr("Buat alamat email alternatif untuk pendaftaran")}>
      <div className="space-y-4 max-w-lg mx-auto w-full">
        <Input label={tr("Email Utama (opsional — untuk plus-address)")} type="email" value={baseEmail} onChange={(e) => setBaseEmail(sanitizeText(e.target.value))} placeholder={tr("nama@gmail.com")} />
        <Input label={tr("Domain Alternatif")} value={aliasDomain} onChange={(e) => setAliasDomain(sanitizeText(e.target.value))} placeholder="tempmail.com" />
        <div className="flex gap-3">
          <Btn onClick={generateAlias} className="flex-1 gap-2">
            <Zap className="w-4 h-4" />{tr("Buat Alamat")}
          </Btn>
          <Btn onClick={copyAlias} disabled={!aliasEmail} variant="secondary" className="flex-1 gap-2">
            <Copy className="w-4 h-4" />{tr("Salin")}
          </Btn>
        </div>
        {aliasEmail && <div className="bg-slate-900 rounded-xl px-4 py-3 font-mono text-sm text-emerald-400 break-all">{aliasEmail}</div>}
        {aliasInfo && <p className="text-xs text-slate-500 dark:text-slate-400">{aliasInfo}</p>}
        <p className="text-xs text-slate-400 dark:text-slate-500">{tr("Gamato Piranti tidak membuat inbox. Gunakan bersama layanan temp-mail atau forwarder pilihan Anda.")}</p>
      </div>
    </PanelCard>
  );
};
