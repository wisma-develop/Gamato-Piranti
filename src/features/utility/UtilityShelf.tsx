import React, { useState } from "react";
import {
  Code2, ListOrdered, Radio, Mail, Calculator, TrendingUp, BarChart3,
  MessageCircle, KeyRound, Eraser, Info, ArrowLeftRight, Copy,
  Image as ImageIcon, Zap,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeText, sanitizeUrl, sanitizeFileName, sanitizeNumberString, sanitizePhone } from "@/utils/sanitize";
import { fileToDataUrl, downloadBlob } from "@/lib/file";
import { Label, Input, Select, Textarea, Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";

const UTILITY_TABS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "json",     label: "JSON & Base64",  icon: <Code2         className="w-3.5 h-3.5" /> },
  { id: "bulk",     label: "Bulk Teks",      icon: <ListOrdered   className="w-3.5 h-3.5" /> },
  { id: "media",    label: "Link Media",     icon: <Radio         className="w-3.5 h-3.5" /> },
  { id: "alias",    label: "Alias Email",    icon: <Mail          className="w-3.5 h-3.5" /> },
  { id: "tax",      label: "Kalk. Pajak",    icon: <Calculator    className="w-3.5 h-3.5" /> },
  { id: "interest", label: "Kalk. Bunga",    icon: <TrendingUp    className="w-3.5 h-3.5" /> },
  { id: "stats",    label: "Statistik",      icon: <BarChart3     className="w-3.5 h-3.5" /> },
  { id: "wa",       label: "WA Link",        icon: <MessageCircle className="w-3.5 h-3.5" /> },
  { id: "pass",     label: "Password & Token", icon: <KeyRound    className="w-3.5 h-3.5" /> },
  { id: "meta",     label: "Hapus Metadata", icon: <Eraser        className="w-3.5 h-3.5" /> },
];

// ─── Utility Shelf helpers ────────────────────────────────────────────────────

export const PanelCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
    <div>
      <h3 className="font-bold text-slate-900 text-base">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

// ─── Utility Shelf ────────────────────────────────────────────────────────────

export const UtilityShelf: React.FC = () => {
  type Tab = "json" | "bulk" | "media" | "alias" | "tax" | "interest" | "stats" | "wa" | "pass" | "meta";
  const [tab, setTab] = useState<Tab>("json");
  const [textInput, setTextInput] = useState("");
  const [jsonPretty, setJsonPretty] = useState("");
  const [base64, setBase64] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [bulkOutput, setBulkOutput] = useState("");
  const [bulkInfo, setBulkInfo] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaInfo, setMediaInfo] = useState<string | null>(null);
  const [directDownload, setDirectDownload] = useState<string | null>(null);
  const [baseEmail, setBaseEmail] = useState("");
  const [aliasDomain, setAliasDomain] = useState("example.com");
  const [aliasEmail, setAliasEmail] = useState<string | null>(null);
  const [aliasInfo, setAliasInfo] = useState<string | null>(null);
  const [taxBase, setTaxBase] = useState("");
  const [taxRate, setTaxRate] = useState("11");
  const [taxMode, setTaxMode] = useState<"exclusive" | "inclusive">("exclusive");
  const [taxOutput, setTaxOutput] = useState("");
  const [princ, setPrinc] = useState("");
  const [rate, setRate] = useState("10");
  const [years, setYears] = useState("1");
  const [compoundPerYear, setCompoundPerYear] = useState(12);
  const [interestOutput, setInterestOutput] = useState("");
  const [statsInput, setStatsInput] = useState("");
  const [statsOutput, setStatsOutput] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [waLink, setWaLink] = useState("");
  const [pwLength, setPwLength] = useState(16);
  const [pwUpper, setPwUpper] = useState(true);
  const [pwLower, setPwLower] = useState(true);
  const [pwNumber, setPwNumber] = useState(true);
  const [pwSymbol, setPwSymbol] = useState(false);
  const [pwOutput, setPwOutput] = useState("");
  const [tokenBytes, setTokenBytes] = useState(32);
  const [tokenFormat, setTokenFormat] = useState<"hex" | "base64" | "urlsafe">("hex");
  const [tokenOutput, setTokenOutput] = useState("");
  const [metaFiles, setMetaFiles] = useState<File[]>([]);
  const [metaInfo, setMetaInfo] = useState<string | null>(null);

  const cryptoRandom = (max: number) => {
    const buf = new Uint32Array(1);
    let rand = 0;
    do { window.crypto.getRandomValues(buf); rand = buf[0] / 2 ** 32; } while (rand === 1);
    return Math.floor(rand * max);
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(n);

  const toJsonPretty = () => {
    try { setJsonPretty(JSON.stringify(JSON.parse(textInput), null, 2)); }
    catch { setJsonPretty("Bukan JSON yang valid."); }
  };
  const toBase64 = () => setBase64(btoa(unescape(encodeURIComponent(sanitizeText(textInput)))));
  const fromBase64 = () => { try { setTextInput(sanitizeText(decodeURIComponent(escape(atob(base64))))); } catch {} };

  const runBulkOp = (kind: "unique" | "sortAsc" | "sortDesc" | "shuffle" | "number" | "prefix" | "suffix") => {
    if (!bulkInput.trim()) return;
    let lines = bulkInput.split(/\r?\n/), result = [...lines], info = "";
    if (kind === "unique") { const s = new Set<string>(); result = []; lines.forEach(l => { if (!s.has(l)) { s.add(l); result.push(l); } }); info = "Duplikat dihapus."; }
    else if (kind === "sortAsc") { result = [...lines].sort((a, b) => a.localeCompare(b)); info = "Diurutkan A→Z."; }
    else if (kind === "sortDesc") { result = [...lines].sort((a, b) => b.localeCompare(a)); info = "Diurutkan Z→A."; }
    else if (kind === "shuffle") { for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } info = "Urutan diacak."; }
    else if (kind === "number") { result = lines.map((l, i) => `${i + 1}. ${l}`); info = "Baris dinomori."; }
    else if (kind === "prefix") { result = lines.map(l => `[x] ${l}`); info = "Prefix ditambahkan."; }
    else if (kind === "suffix") { result = lines.map(l => `${l} #`); info = "Suffix ditambahkan."; }
    setBulkOutput(result.join("\n")); setBulkInfo(info);
  };

  const analyzeMedia = () => {
    setMediaInfo(null); setDirectDownload(null);
    const safe = sanitizeUrl(mediaUrl);
    if (!safe) { setMediaInfo("URL tidak valid."); return; }
    try {
      const u = new URL(safe);
      if (/\.(mp4|webm|mov|m4a|mp3|wav)$/i.test(u.pathname)) { setDirectDownload(safe); setMediaInfo("Terlihat seperti berkas langsung. Klik unduh."); return; }
      const host = u.hostname.replace(/^www\./, "");
      if (["youtube.com", "youtu.be", "tiktok.com", "instagram.com", "twitter.com", "x.com"].includes(host))
        setMediaInfo("Platform streaming besar tidak bisa diunduh langsung. Gunakan yt-dlp di terminal.");
      else setMediaInfo("Link ini bukan berkas video langsung.");
    } catch { setMediaInfo("URL tidak valid."); }
  };

  const generateAlias = () => {
    const now = new Date(), pad = (n: number) => n.toString().padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const trimmed = baseEmail.trim();
    if (trimmed && trimmed.includes("@")) {
      const [local, domain] = trimmed.split("@");
      setAliasEmail(`${local}+gp-${stamp}@${domain}`); setAliasInfo("Plus-address dari email utama.");
    } else {
      const rand = Math.random().toString(36).slice(2, 8);
      setAliasEmail(`gp-${rand}-${stamp}@${aliasDomain}`); setAliasInfo("Alamat acak disiapkan.");
    }
  };

  const runTaxCalc = () => {
    const base = parseFloat(sanitizeNumberString(taxBase || "")), r = parseFloat(sanitizeNumberString(taxRate || ""));
    if (isNaN(base) || isNaN(r)) { setTaxOutput("Masukkan nilai yang valid."); return; }
    const rp = r / 100;
    if (taxMode === "exclusive") {
      const pajak = base * rp, total = base + pajak;
      setTaxOutput(`Dasar: ${formatCurrency(base)}\nPajak (${r}%): ${formatCurrency(pajak)}\nTotal: ${formatCurrency(total)}`);
    } else {
      const pajak = base - base / (1 + rp), dasar = base - pajak;
      setTaxOutput(`Total (inklusif): ${formatCurrency(base)}\nTermasuk Pajak (${r}%): ${formatCurrency(pajak)}\nDasar sebelum pajak: ${formatCurrency(dasar)}`);
    }
  };

  const runInterestCalc = () => {
    const P = parseFloat(sanitizeNumberString(princ || "")), r = parseFloat(sanitizeNumberString(rate || "")) / 100, t = parseFloat(sanitizeNumberString(years || ""));
    if (isNaN(P) || isNaN(r) || isNaN(t)) { setInterestOutput("Isi semua field dengan benar."); return; }
    const simple = P * r * t, n = compoundPerYear > 0 ? compoundPerYear : 1;
    const comp = P * Math.pow(1 + r / n, n * t) - P;
    setInterestOutput(`Bunga sederhana: ${formatCurrency(simple)} | Akhir: ${formatCurrency(P + simple)}\nBunga majemuk (${n}x/tahun): ${formatCurrency(comp)} | Akhir: ${formatCurrency(P + comp)}`);
  };

  const runStats = () => {
    const nums = (statsInput || "").split(/[^0-9.+\-eE]+/).map(s => s.trim()).filter(s => s !== "").map(s => Number(s)).filter(n => Number.isFinite(n));
    if (!nums.length) { setStatsOutput("Tidak ada angka valid."); return; }
    const sorted = [...nums].sort((a, b) => a - b), count = nums.length, sum = nums.reduce((a, b) => a + b, 0), mean = sum / count;
    const median = count % 2 === 1 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
    const stdev = Math.sqrt(nums.reduce((a, x) => a + Math.pow(x - mean, 2), 0) / count);
    setStatsOutput(`n = ${count}\nΣ = ${sum}\nMean = ${mean}\nMedian = ${median}\nMin = ${sorted[0]}\nMax = ${sorted[sorted.length - 1]}\nStdev = ${stdev.toFixed(4)}`);
  };

  const buildWa = () => {
    const phone = sanitizePhone(waPhone), msg = sanitizeText(waMessage);
    if (!phone) { setWaLink(""); return; }
    setWaLink(`https://wa.me/${phone.replace(/^\+/, "")}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`);
  };

  const generatePassword = () => {
    const length = Math.min(Math.max(pwLength, 6), 128);
    const U = "ABCDEFGHJKLMNPQRSTUVWXYZ", L = "abcdefghijkmnopqrstuvwxyz", N = "23456789", S = "!@#$%^&*()-_=+[]{};:,.?";
    let pool = "", must: string[] = [];
    if (pwUpper) { pool += U; must.push(U[cryptoRandom(U.length)]); }
    if (pwLower) { pool += L; must.push(L[cryptoRandom(L.length)]); }
    if (pwNumber) { pool += N; must.push(N[cryptoRandom(N.length)]); }
    if (pwSymbol) { pool += S; must.push(S[cryptoRandom(S.length)]); }
    if (!pool) { setPwOutput(""); return; }
    const out = [...must];
    while (out.length < length) out.push(pool[cryptoRandom(pool.length)]);
    for (let i = out.length - 1; i > 0; i--) { const j = cryptoRandom(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
    setPwOutput(out.join(""));
  };

  const bytesToBase64 = (bytes: Uint8Array) => { let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); };
  const generateToken = () => {
    const n = Math.min(Math.max(tokenBytes, 4), 128), bytes = new Uint8Array(n);
    window.crypto.getRandomValues(bytes);
    if (tokenFormat === "hex") setTokenOutput(Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join(""));
    else if (tokenFormat === "base64") setTokenOutput(bytesToBase64(bytes));
    else setTokenOutput(bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  };

  const copyToClipboard = async (text: string, setCb?: (m: string) => void) => {
    try { await navigator.clipboard.writeText(text); setCb?.("Disalin!"); }
    catch { setCb?.("Gagal menyalin."); }
  };

  const runMetaClean = async () => {
    if (!metaFiles.length) return;
    setMetaInfo(null);
    try {
      for (const file of metaFiles) {
        const dataUrl = await fileToDataUrl(file);
        const img = new Image(); img.src = dataUrl;
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); });
        const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        let mime = file.type?.startsWith("image/") ? file.type : "image/png";
        if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) mime = "image/png";
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(b => resolve(b), mime, mime === "image/jpeg" ? 0.92 : undefined));
        if (!blob) continue;
        const base = sanitizeFileName(file.name.replace(/\.[^.]+$/, "")) || "image";
        const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
        downloadBlob(blob, `${base}-clean.${ext}`);
      }
      setMetaInfo(`${metaFiles.length} gambar dibersihkan dari metadata.`);
    } catch (err: any) { setMetaInfo("" + (err?.message || "Gagal.")); }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "json",     label: "JSON & Base64",    icon: <Code2 className="w-3.5 h-3.5" /> },
    { id: "bulk",     label: "Bulk Teks",         icon: <ListOrdered className="w-3.5 h-3.5" /> },
    { id: "media",    label: "Link Media",         icon: <Radio className="w-3.5 h-3.5" /> },
    { id: "alias",    label: "Alias Email",        icon: <Mail className="w-3.5 h-3.5" /> },
    { id: "tax",      label: "Kalk. Pajak",        icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: "interest", label: "Kalk. Bunga",        icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "stats",    label: "Statistik",          icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: "wa",       label: "WA Link",            icon: <MessageCircle className="w-3.5 h-3.5" /> },
    { id: "pass",     label: "Password & Token",   icon: <KeyRound className="w-3.5 h-3.5" /> },
    { id: "meta",     label: "Hapus Metadata",     icon: <Eraser className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Tab selector */}
      <div className="flex flex-wrap gap-2">
        {UTILITY_TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id as Tab)}
            className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
              tab === t.id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")}>
            {t.icon}<span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* JSON & Base64 */}
      {tab === "json" && (
        <PanelCard title="JSON Formatter & Base64 Encoder" subtitle="Format JSON, encode/decode Base64">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="space-y-3">
              <Textarea label="Input Teks / JSON" rows={8} value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Tempel JSON atau teks di sini…" />
              <div className="flex gap-2">
                <Btn onClick={toJsonPretty} variant="secondary" className="flex-1 text-xs">Format JSON</Btn>
                <Btn onClick={toBase64} variant="secondary" className="flex-1 text-xs gap-1.5"><ArrowLeftRight className="w-3.5 h-3.5" />Ke Base64</Btn>
              </div>
            </div>
            <div className="space-y-3">
              <Textarea label="JSON Terformat" rows={8} value={jsonPretty} onChange={e => setJsonPretty(e.target.value)} placeholder="Hasil JSON rapi…" />
              <Btn onClick={() => copyToClipboard(jsonPretty)} variant="secondary" className="w-full text-xs gap-1.5"><Copy className="w-3.5 h-3.5" />Salin JSON</Btn>
            </div>
            <div className="space-y-3">
              <Textarea label="Base64" rows={5} value={base64} onChange={e => setBase64(e.target.value)} placeholder="Base64 encode/decode…" />
              <div className="flex gap-2">
                <Btn onClick={fromBase64} variant="secondary" className="flex-1 text-xs gap-1.5"><ArrowLeftRight className="w-3.5 h-3.5" />Dari Base64</Btn>
                <Btn onClick={() => copyToClipboard(base64)} variant="secondary" className="flex-1 text-xs gap-1.5"><Copy className="w-3.5 h-3.5" />Salin</Btn>
              </div>
            </div>
          </div>
        </PanelCard>
      )}

      {/* Bulk */}
      {tab === "bulk" && (
        <PanelCard title="Bulk Teks & Data Lab" subtitle="Manipulasi daftar teks — email, ID, nama, dll.">
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="space-y-3">
              <Textarea label="Input (satu item per baris)" rows={10} value={bulkInput} onChange={e => setBulkInput(e.target.value)} placeholder="item1&#10;item2&#10;item3" />
              <div className="flex flex-wrap gap-2">
                {[["unique", "Hapus Duplikat"], ["sortAsc", "Sort A→Z"], ["sortDesc", "Sort Z→A"], ["shuffle", "Acak"], ["number", "Nomori"], ["prefix", "Tambah Prefix"], ["suffix", "Tambah Suffix"]].map(([k, l]) => (
                  <Btn key={k} onClick={() => runBulkOp(k as any)} variant="secondary" className="text-xs py-1.5">{l}</Btn>
                ))}
              </div>
              {bulkInfo && <p className="text-xs text-green-600 font-medium">{bulkInfo}</p>}
            </div>
            <div className="space-y-3">
              <Textarea label="Hasil" rows={10} value={bulkOutput} onChange={e => setBulkOutput(e.target.value)} placeholder="Hasil akan tampil di sini…" />
              <Btn onClick={() => copyToClipboard(bulkOutput)} variant="secondary" className="w-full text-xs gap-2"><Copy className="w-3.5 h-3.5" />Salin Hasil</Btn>
            </div>
          </div>
        </PanelCard>
      )}

      {/* Media */}
      {tab === "media" && (
        <PanelCard title="Helper Link & Media" subtitle="Analisis link video/file untuk unduhan langsung">
          <div className="space-y-4 max-w-xl">
            <Input label="URL Video / File" type="url" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://example.com/video.mp4" />
            <Btn onClick={analyzeMedia} variant="secondary" className="gap-2"><Info className="w-4 h-4" />Analisis Link</Btn>
            {mediaInfo && <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700">{mediaInfo}</div>}
            {directDownload && (
              <a href={directDownload} download className="flex items-center justify-between gap-3 bg-slate-900 text-white rounded-xl px-5 py-3 font-semibold hover:bg-slate-800 transition-colors">
                <span>Unduh Langsung</span>
                <span className="text-xs text-slate-400">Buka tab baru jika gagal</span>
              </a>
            )}
            <p className="text-xs text-slate-400 bg-slate-50 rounded-xl p-3">Untuk YouTube/TikTok/Instagram, gunakan: <code className="bg-slate-200 rounded px-1">yt-dlp "URL"</code> di terminal.</p>
          </div>
        </PanelCard>
      )}

      {/* Alias */}
      {tab === "alias" && (
        <PanelCard title="Alias & Temp Email Planner" subtitle="Buat alamat email alternatif untuk pendaftaran">
          <div className="space-y-4 max-w-lg">
            <Input label="Email Utama (opsional — untuk plus-address)" type="email" value={baseEmail} onChange={e => setBaseEmail(sanitizeText(e.target.value))} placeholder="nama@gmail.com" />
            <Input label="Domain Alternatif" value={aliasDomain} onChange={e => setAliasDomain(sanitizeText(e.target.value))} placeholder="tempmail.com" />
            <div className="flex gap-3">
              <Btn onClick={generateAlias} className="flex-1 gap-2"><Zap className="w-4 h-4" />Buat Alamat</Btn>
              <Btn onClick={() => copyToClipboard(aliasEmail || "", setAliasInfo)} disabled={!aliasEmail} variant="secondary" className="flex-1 gap-2"><Copy className="w-4 h-4" />Salin</Btn>
            </div>
            {aliasEmail && <div className="bg-slate-900 rounded-xl px-4 py-3 font-mono text-sm text-emerald-400 break-all">{aliasEmail}</div>}
            {aliasInfo && <p className="text-xs text-slate-500">{aliasInfo}</p>}
            <p className="text-xs text-slate-400">Gamato Piranti tidak membuat inbox. Gunakan bersama layanan temp-mail atau forwarder pilihan Anda.</p>
          </div>
        </PanelCard>
      )}

      {/* Tax */}
      {tab === "tax" && (
        <PanelCard title="Kalkulator Pajak" subtitle="Hitung PPN eksklusif atau inklusif">
          <div className="space-y-4 max-w-xl">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nilai Dasar (Rp)" value={taxBase} onChange={e => setTaxBase(e.target.value)} placeholder="1000000" />
              <Input label="Tarif Pajak (%)" value={taxRate} onChange={e => setTaxRate(e.target.value)} placeholder="11" />
            </div>
            <div>
              <Label>Mode Perhitungan</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[["exclusive", "Eksklusif (belum termasuk pajak)"], ["inclusive", "Inklusif (sudah termasuk pajak)"]].map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setTaxMode(v as any)}
                    className={cn("py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                      taxMode === v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300")}>{l}</button>
                ))}
              </div>
            </div>
            <Btn onClick={runTaxCalc} className="w-full gap-2"><Calculator className="w-4 h-4" />Hitung Pajak</Btn>
            {taxOutput && <pre className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">{taxOutput}</pre>}
          </div>
        </PanelCard>
      )}

      {/* Interest */}
      {tab === "interest" && (
        <PanelCard title="Kalkulator Bunga" subtitle="Hitung bunga sederhana & majemuk">
          <div className="space-y-4 max-w-xl">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Pokok (Rp)" value={princ} onChange={e => setPrinc(e.target.value)} placeholder="5000000" />
              <Input label="Bunga Tahunan (%)" value={rate} onChange={e => setRate(e.target.value)} placeholder="10" />
              <Input label="Durasi (tahun)" value={years} onChange={e => setYears(e.target.value)} placeholder="3" />
              <Select label="Frekuensi Majemuk" value={compoundPerYear} onChange={e => setCompoundPerYear(parseInt(e.target.value))}>
                <option value={1}>Tahunan (1x)</option>
                <option value={2}>Semesteran (2x)</option>
                <option value={4}>Kuartalan (4x)</option>
                <option value={12}>Bulanan (12x)</option>
              </Select>
            </div>
            <Btn onClick={runInterestCalc} className="w-full gap-2"><TrendingUp className="w-4 h-4" />Hitung Bunga</Btn>
            {interestOutput && <pre className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap">{interestOutput}</pre>}
          </div>
        </PanelCard>
      )}

      {/* Stats */}
      {tab === "stats" && (
        <PanelCard title="Statistik Sederhana" subtitle="Mean, median, min, max, standar deviasi">
          <div className="space-y-4 max-w-lg">
            <Textarea label="Angka (pisahkan dengan spasi, koma, atau baris baru)" rows={5} value={statsInput} onChange={e => setStatsInput(e.target.value)} placeholder="10 20 30 40 50&#10;atau&#10;1, 2, 3, 4, 5" />
            <Btn onClick={runStats} className="w-full gap-2"><BarChart3 className="w-4 h-4" />Analisis</Btn>
            {statsOutput && <pre className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap font-mono">{statsOutput}</pre>}
          </div>
        </PanelCard>
      )}

      {/* WA */}
      {tab === "wa" && (
        <PanelCard title="WhatsApp Direct Link" subtitle="Buka chat WA langsung tanpa perlu menyimpan kontak">
          <div className="space-y-5">
            <div className="grid md:grid-cols-2 gap-5">
              <Input label="Nomor Telepon (dengan kode negara)" value={waPhone} onChange={e => setWaPhone(sanitizePhone(e.target.value))} placeholder="+62812xxxxxxx" />
              <div>
                <Label>Template Pesan Cepat</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { label: "Salam", fn: () => { const name = prompt("Nama penerima (opsional):") || ""; const safe = sanitizeText(name); setWaMessage((safe ? `Halo ${safe}, ` : "Halo, ") + "apa kabar? Saya ingin menghubungi terkait sesuatu."); } },
                    { label: "Follow-up", fn: () => { const inv = sanitizeText(prompt("Nomor invoice:") || ""); const amt = sanitizeText(prompt("Jumlah (opsional):") || ""); setWaMessage(`Halo, ini tindak lanjut terkait invoice ${inv}. ${amt ? `Total ${amt}. ` : ""}Mohon konfirmasi penerimaan atau bila ada pertanyaan.`); } },
                    { label: "Konfirmasi Bayar", fn: () => { const inv = sanitizeText(prompt("Nomor invoice/kode:") || ""); setWaMessage(`Halo, pembayaran untuk ${inv} telah kami terima. Terima kasih! Jika ada yang perlu dibantu lagi, kabari ya.`); } },
                    { label: "Kirim Alamat", fn: () => { const addr = sanitizeText(prompt("Alamat/tautan lokasi:") || ""); const time = sanitizeText(prompt("Estimasi waktu (opsional):") || ""); setWaMessage(`Halo, berikut alamat/lokasi tujuan: ${addr}. ${time ? `Estimasi waktu: ${time}. ` : ""}Terima kasih.`); } },
                    { label: "Reminder", fn: () => { const date = sanitizeText(prompt("Tanggal (mis. 12/03/2026):") || ""); const hour = sanitizeText(prompt("Jam (opsional):") || ""); const topic = sanitizeText(prompt("Topik/agenda (opsional):") || ""); setWaMessage(`Halo, mengingatkan jadwal pada ${date}${hour ? ` pukul ${hour}` : ""}${topic ? ` untuk ${topic}` : ""}. Terima kasih.`); } },
                  ].map(t => (
                    <Btn key={t.label} onClick={t.fn} variant="secondary" className="text-xs py-1.5">{t.label}</Btn>
                  ))}
                </div>
              </div>
            </div>
            <Textarea label="Pesan (opsional)" rows={4} value={waMessage} onChange={e => setWaMessage(sanitizeText(e.target.value))} placeholder="Tulis pesan Anda di sini, atau gunakan template di atas…" />
            <div className="flex gap-3">
              <Btn onClick={buildWa} className="flex-1 gap-2"><MessageCircle className="w-4 h-4" />Buat Link WA</Btn>
              {waLink && <Btn onClick={() => copyToClipboard(waLink, setAliasInfo)} variant="secondary" className="flex-1 gap-2"><Copy className="w-4 h-4" />Salin Link</Btn>}
            </div>
            {waLink && (
              <div className="space-y-2">
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono text-xs text-slate-700 break-all">{waLink}</div>
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl py-3 font-semibold hover:bg-green-600 transition-colors">
                  <MessageCircle className="w-4 h-4" /> Buka di WhatsApp
                </a>
              </div>
            )}
          </div>
        </PanelCard>
      )}

      {/* Password & Token */}
      {tab === "pass" && (
        <PanelCard title="Password & Token Generator" subtitle="Berbasis Web Crypto API — aman dan acak">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-sm font-bold text-slate-700">Password Generator</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Panjang Password" type="number" min={6} max={128} value={pwLength} onChange={e => setPwLength(parseInt(e.target.value) || 16)} />
                <div>
                  <Label>Karakter</Label>
                  <div className="mt-2 space-y-1.5">
                    {[["pwUpper", "Huruf Besar", pwUpper, setPwUpper], ["pwLower", "Huruf Kecil", pwLower, setPwLower], ["pwNumber", "Angka", pwNumber, setPwNumber], ["pwSymbol", "Simbol", pwSymbol, setPwSymbol]].map(([id, l, v, s]: any) => (
                      <label key={id} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={v} onChange={e => s(e.target.checked)} className="rounded accent-blue-600" />{l}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <Btn onClick={generatePassword} className="w-full gap-2"><KeyRound className="w-4 h-4" />Buat Password</Btn>
              {pwOutput && (
                <div className="space-y-2">
                  <div className="bg-slate-900 text-green-400 font-mono text-sm rounded-xl px-4 py-3 break-all">{pwOutput}</div>
                  <Btn onClick={() => copyToClipboard(pwOutput)} variant="secondary" className="w-full gap-2"><Copy className="w-4 h-4" />Salin Password</Btn>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <p className="text-sm font-bold text-slate-700">Token Generator</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Panjang (byte)" type="number" min={4} max={128} value={tokenBytes} onChange={e => setTokenBytes(parseInt(e.target.value) || 32)} />
                <Select label="Format" value={tokenFormat} onChange={e => setTokenFormat(e.target.value as any)}>
                  <option value="hex">Hex</option>
                  <option value="base64">Base64</option>
                  <option value="urlsafe">URL-safe Base64</option>
                </Select>
              </div>
              <Btn onClick={generateToken} className="w-full gap-2"><KeyRound className="w-4 h-4" />Buat Token</Btn>
              {tokenOutput && (
                <div className="space-y-2">
                  <div className="bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl px-4 py-3 break-all">{tokenOutput}</div>
                  <Btn onClick={() => copyToClipboard(tokenOutput)} variant="secondary" className="w-full gap-2"><Copy className="w-4 h-4" />Salin Token</Btn>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 border-t border-slate-100 pt-4">Gamato Piranti tidak mengirim password/token ke server mana pun. Simpan dengan aman di password manager.</p>
        </PanelCard>
      )}

      {/* Meta */}
      {tab === "meta" && (
        <PanelCard title="Hapus Metadata Gambar" subtitle="EXIF, GPS, dan data sensitif lainnya dihapus via re-encode canvas">
          <div className="space-y-4 max-w-lg">
            <Dropzone onFiles={f => setMetaFiles(f.filter(f2 => f2.type.startsWith("image/")))} accept="image/*" label="Drop gambar di sini" sublabel="Bisa pilih beberapa sekaligus" icon={<ImageIcon className="w-8 h-8" />} />
            {metaFiles.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-slate-700">{metaFiles.length} gambar dipilih</p>
                <ul className="mt-2 space-y-1">
                  {metaFiles.map((f, i) => <li key={i} className="text-xs text-slate-500 truncate">• {f.name} ({(f.size / 1024).toFixed(0)} KB)</li>)}
                </ul>
              </div>
            )}
            <Btn onClick={runMetaClean} disabled={!metaFiles.length} className="w-full gap-2"><Eraser className="w-4 h-4" />Bersihkan Metadata</Btn>
            {metaInfo && <div className={cn("text-sm rounded-xl px-4 py-3 border", metaInfo.startsWith("Gagal") ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200")}>{metaInfo}</div>}
            <p className="text-xs text-slate-400">File diunduh ulang — tanpa metadata EXIF. Tidak ada yang dikirim ke server.</p>
          </div>
        </PanelCard>
      )}
    </div>
  );
};
