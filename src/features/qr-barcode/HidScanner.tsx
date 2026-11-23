import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Copy, Download, Trash2, Zap, Check, AlertTriangle, Plus, Minus, ListOrdered, Table2, Settings2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { Input, Select } from "@/components/ui/primitives";
import { copyText } from "@/lib/permissions";
import { parseScan } from "@/lib/scanParse";
import { LOCALE, tr } from "@/i18n";

type DupPolicy = "allow" | "flag" | "block";
type View = "log" | "recap";

interface ScanEntry {
  id: string;
  value: string;
  /** epoch ms */
  time: number;
  msPerChar: number;
  duplicate: boolean;
  /** Barcode GS1 (EAN/UPC) dengan digit cek yang salah. */
  badCheck: boolean;
}
interface Settings {
  dup: DupPolicy;
  beep: boolean;
  prefix: string;
  suffix: string;
  minLen: number;
  autoCommitMs: number;
  acceptTab: boolean;
  fastOnly: boolean;
}

const LOG_KEY = "gp-hid-log-v1";
const SET_KEY = "gp-hid-settings-v1";
const LOG_MAX = 2000;
const FAST_MS_PER_CHAR = 15; // di bawah ini = khas scanner
const SLOW_LIMIT_MS_PER_CHAR = 60; // di atas ini dianggap ketikan manual bila "hanya input cepat" aktif
const DEFAULTS: Settings = { dup: "flag", beep: true, prefix: "", suffix: "", minLen: 1, autoCommitMs: 0, acceptTab: true, fastOnly: false };

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...(typeof fallback === "object" && !Array.isArray(fallback) ? fallback : {}), ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
}
function loadEntries(): ScanEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((e) => e && typeof e.value === "string" && typeof e.time === "number").slice(0, LOG_MAX) : [];
  } catch { return []; }
}
function save(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* penyimpanan penuh/diblokir: log tetap jalan di memori */ } }

/** CSV aman: sel yang diawali = + - @ (atau tab/CR) diberi tanda petik di depan supaya Excel/Sheets tidak menjalankannya sebagai rumus. */
export function csvSafe(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const pad2 = (n: number) => String(n).padStart(2, "0");
const stamp = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };

export const HidScanner: React.FC = () => {
  const [value, setValue] = useState("");
  const [entries, setEntries] = useState<ScanEntry[]>(loadEntries);
  const [settings, setSettings] = useState<Settings>(() => loadJson(SET_KEY, DEFAULTS));
  const [view, setView] = useState<View>("log");
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const firstKeyTime = useRef<number | null>(null);
  const autoTimer = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const valueRef = useRef("");
  valueRef.current = value;
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => { save(LOG_KEY, entries); }, [entries]);
  useEffect(() => { save(SET_KEY, settings); }, [settings]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const setSetting = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const beepNow = useCallback((kind: "ok" | "dup" | "err") => {
    if (!settingsRef.current.beep) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      if (!audioRef.current) audioRef.current = new AC();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      const notes = kind === "ok" ? [[1040, 0, 0.09]] : kind === "dup" ? [[660, 0, 0.08], [660, 0.12, 0.08]] : [[220, 0, 0.25]];
      for (const [f, at, dur] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === "err" ? "square" : "sine";
        osc.frequency.value = f;
        const t0 = ctx.currentTime + at;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      }
    } catch { /* bunyi hanya pelengkap */ }
  }, []);
  useEffect(() => () => { void audioRef.current?.close().catch(() => undefined); }, []);

  const commit = useCallback((rawValue?: string) => {
    if (autoTimer.current) { window.clearTimeout(autoTimer.current); autoTimer.current = null; }
    const st = settingsRef.current;
    let v = (rawValue ?? valueRef.current).trim();
    if (!v) return;
    const elapsed = firstKeyTime.current ? performance.now() - firstKeyTime.current : 0;
    firstKeyTime.current = null;
    if (st.prefix && v.startsWith(st.prefix)) v = v.slice(st.prefix.length);
    if (st.suffix && v.endsWith(st.suffix)) v = v.slice(0, v.length - st.suffix.length);
    v = v.trim();
    setValue("");
    valueRef.current = "";
    inputRef.current?.focus();
    const msPerChar = v.length > 1 ? elapsed / (v.length - 1) : 0;

    if (v.length < Math.max(1, st.minLen)) { beepNow("err"); setStatus({ tone: "err", text: tr("Ditolak: terlalu pendek (minimal {0} karakter).", st.minLen) }); return; }
    if (st.fastOnly && v.length > 3 && msPerChar > SLOW_LIMIT_MS_PER_CHAR) { beepNow("err"); setStatus({ tone: "err", text: tr("Ditolak: terdeteksi ketikan manual (bukan scanner).") }); return; }

    const duplicate = entriesRef.current.some((e) => e.value === v);
    if (duplicate && st.dup === "block") { beepNow("dup"); setStatus({ tone: "warn", text: tr("Ditolak: {0} sudah pernah dipindai.", v) }); return; }

    const parsed = parseScan(v, /^\d+$/.test(v) ? "ean_13" : "");
    const badCheck = parsed.kind === "product" && parsed.checkValid === false;
    const entry: ScanEntry = { id: Math.random().toString(36).slice(2, 10), value: v, time: Date.now(), msPerChar, duplicate, badCheck };
    setEntries((prev) => [entry, ...prev].slice(0, LOG_MAX));
    beepNow(duplicate ? "dup" : "ok");
    setStatus({ tone: duplicate || badCheck ? "warn" : "ok", text: duplicate ? tr("Tercatat (duplikat): {0}", v) : badCheck ? tr("Tercatat, tapi digit cek barcode TIDAK valid: {0}", v) : tr("Tercatat: {0}", v) });
  }, [beepNow]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (firstKeyTime.current === null && e.key.length === 1) firstKeyTime.current = performance.now();
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Tab" && settings.acceptTab && value.trim()) { e.preventDefault(); commit(); }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    valueRef.current = e.target.value;
    if (!e.target.value) firstKeyTime.current = null;
    if (autoTimer.current) window.clearTimeout(autoTimer.current);
    if (settings.autoCommitMs > 0 && e.target.value.trim()) autoTimer.current = window.setTimeout(() => commit(), settings.autoCommitMs);
  };
  useEffect(() => () => { if (autoTimer.current) window.clearTimeout(autoTimer.current); }, []);

  // Fokus: kolom pindai hanya merebut kembali fokus bila fokus "jatuh ke ruang kosong" — TIDAK pernah dari tombol/kolom lain,
  // supaya pengguna keyboard bisa berpindah ke Salin/CSV/pengaturan (sebelumnya fokus dipaksa kembali tiap 150 md = jebakan fokus).
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    if (e.relatedTarget === null) window.setTimeout(() => { if (document.activeElement === document.body) inputRef.current?.focus(); }, 120);
  };
  // Klik di area kosong halaman (bukan tombol/tautan/kolom/teks yang sedang diseleksi) mengembalikan fokus ke kolom pindai.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || t.closest("button,a,input,select,textarea,summary,label,details,[role=tab],[role=option],[role=listbox],[role=slider]")) return;
      if (window.getSelection()?.toString()) return;
      inputRef.current?.focus();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  // Scanner yang mengetik saat fokus di ruang kosong halaman: arahkan ke kolom pindai.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement !== document.body) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const chronological = useMemo(() => [...entries].reverse(), [entries]);
  const recap = useMemo(() => {
    const map = new Map<string, { value: string; qty: number; last: number; badCheck: boolean }>();
    for (const e of chronological) {
      const cur = map.get(e.value);
      if (cur) { cur.qty++; cur.last = e.time; } else map.set(e.value, { value: e.value, qty: 1, last: e.time, badCheck: e.badCheck });
    }
    return [...map.values()].sort((a, b) => b.last - a.last);
  }, [chronological]);
  const dupCount = entries.filter((e) => e.duplicate).length;

  const clearAll = () => {
    if (!confirmClear) { setConfirmClear(true); window.setTimeout(() => setConfirmClear(false), 3000); return; }
    setEntries([]);
    setConfirmClear(false);
    setStatus(null);
  };
  const removeEntry = (id: string) => setEntries((p) => p.filter((e) => e.id !== id));
  const adjustQty = (v: string, delta: number) => {
    if (delta > 0) {
      setEntries((p) => [{ id: Math.random().toString(36).slice(2, 10), value: v, time: Date.now(), msPerChar: 0, duplicate: true, badCheck: false }, ...p].slice(0, LOG_MAX));
    } else {
      setEntries((p) => { const i = p.findIndex((e) => e.value === v); return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)]; });
    }
  };
  const removeValue = (v: string) => setEntries((p) => p.filter((e) => e.value !== v));

  const copyAll = async () => {
    // Urutan kronologis (yang pertama dipindai di baris pertama) — bukan terbalik.
    if (await copyText(chronological.map((e) => e.value).join("\n")).catch(() => false)) { setCopied(true); window.setTimeout(() => setCopied(false), 1400); }
  };
  const downloadCsv = () => {
    if (!entries.length) return;
    const header = tr("waktu,nilai,ms_per_karakter,duplikat");
    const rows = chronological.map((e) => [stamp(e.time), e.value, e.msPerChar.toFixed(1), e.duplicate ? "ya" : "tidak"].map(csvSafe).join(","));
    downloadBlob(new Blob(["\ufeff" + [header, ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }), "gamato-hid-scan-log.csv");
  };
  const downloadRecapCsv = () => {
    if (!recap.length) return;
    const rows = recap.map((r) => [r.value, r.qty].map(csvSafe).join(","));
    downloadBlob(new Blob(["\ufeff" + [tr("kode,jumlah"), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" }), "gamato-hid-rekap.csv");
  };
  const downloadTxt = () => { if (entries.length) downloadBlob(new Blob([chronological.map((e) => e.value).join("\n")], { type: "text/plain;charset=utf-8" }), "gamato-hid-scan-log.txt"); };
  const downloadJson = () => { if (entries.length) downloadBlob(new Blob([JSON.stringify(chronological.map((e) => ({ time: new Date(e.time).toISOString(), value: e.value, msPerChar: Math.round(e.msPerChar * 10) / 10, duplicate: e.duplicate })), null, 2)], { type: "application/json" }), "gamato-hid-scan-log.json"); };

  const linkBtn = "text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded";
  const viewBtn = (id: View, Icon: typeof ListOrdered, label: string) => (
    <button type="button" role="tab" aria-selected={view === id} data-testid={`hid-view-${id}`} onClick={() => setView(id)}
      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border", view === id ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>
      <Icon className="w-3.5 h-3.5" />{label}
    </button>
  );

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
      <div className="space-y-5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="hid-input" className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{tr("Area Pindai")}</label>
            <span data-testid="hid-focus" data-focused={focused ? "1" : "0"} className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full border", focused ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30" : "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30")}>
              {focused ? tr("● Siap memindai") : tr("Klik kolom agar scanner bisa mengetik")}
            </span>
          </div>
          <input
            id="hid-input"
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            data-testid="hid-input"
            placeholder={tr("Klik di sini lalu pindai barcode/QR dengan scanner HID kamu…")}
            className="w-full rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-500/40 bg-indigo-50/40 dark:bg-indigo-500/5 px-4 py-4 text-lg font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">{tr("Kolom ini harus tetap fokus (aktif) — scanner HID akan \"mengetik\" hasil pindaian lalu otomatis Enter.")}</p>
          <p role="status" aria-live="polite" data-testid="hid-status" data-tone={status?.tone ?? ""} className={cn("min-h-[1.25rem] text-sm font-medium break-all", status?.tone === "ok" && "text-green-600 dark:text-green-400", status?.tone === "warn" && "text-amber-600 dark:text-amber-400", status?.tone === "err" && "text-red-600 dark:text-red-400")}>
            {status?.text}
          </p>
        </div>

        <CollapsibleSection title={tr("Pengaturan Scanner")} subtitle={tr("Duplikat, bunyi, awalan/akhiran, scanner tanpa Enter")} icon={<Settings2 className="w-4 h-4" />}>
          <div className="grid sm:grid-cols-2 gap-4">
            <Select id="hid-dup" label={tr("Bila kode sudah pernah dipindai")} value={settings.dup} onChange={(e) => setSetting("dup", e.target.value as DupPolicy)}>
              <option value="allow">{tr("Catat saja")}</option>
              <option value="flag">{tr("Catat & tandai DUPLIKAT")}</option>
              <option value="block">{tr("Tolak (tidak dicatat)")}</option>
            </Select>
            <Select id="hid-auto" label={tr("Scanner tanpa Enter")} value={String(settings.autoCommitMs)} onChange={(e) => setSetting("autoCommitMs", Number(e.target.value))}>
              <option value="0">{tr("Nonaktif (tunggu Enter)")}</option>
              <option value="80">{tr("Catat otomatis setelah 80 md diam")}</option>
              <option value="150">{tr("Catat otomatis setelah 150 md diam")}</option>
              <option value="300">{tr("Catat otomatis setelah 300 md diam")}</option>
            </Select>
            <Input id="hid-prefix" label={tr("Buang awalan (prefix)")} value={settings.prefix} maxLength={12} onChange={(e) => setSetting("prefix", e.target.value)} placeholder="mis. ]C1" />
            <Input id="hid-suffix" label={tr("Buang akhiran (suffix)")} value={settings.suffix} maxLength={12} onChange={(e) => setSetting("suffix", e.target.value)} />
            <Input id="hid-minlen" label={tr("Panjang minimal (karakter)")} type="number" min={1} max={64} value={settings.minLen} onChange={(e) => setSetting("minLen", Math.min(64, Math.max(1, Number(e.target.value) || 1)))} />
          </div>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            <GamatoCheckbox checked={settings.beep} onChange={(v) => setSetting("beep", v)} label={tr("Bunyi konfirmasi (nada lain untuk duplikat/ditolak)")} testId="hid-beep" />
            <GamatoCheckbox checked={settings.acceptTab} onChange={(v) => setSetting("acceptTab", v)} label={tr("Tab juga mengakhiri pindaian")} testId="hid-tab" />
            <GamatoCheckbox checked={settings.fastOnly} onChange={(v) => setSetting("fastOnly", v)} label={tr("Hanya terima input cepat (tolak ketikan manual)")} testId="hid-fastonly" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{tr("Log & pengaturan disimpan di browser ini saja (tidak dikirim ke mana pun) dan tetap ada setelah halaman dimuat ulang.")}</p>
        </CollapsibleSection>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200" data-testid="hid-count">{tr("Riwayat Pindai ({0})", entries.length)}</p>
              <div role="tablist" aria-label={tr("Tampilan")} className="flex gap-1.5">
                {viewBtn("log", ListOrdered, tr("Log"))}
                {viewBtn("recap", Table2, tr("Rekap"))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={copyAll} disabled={!entries.length} data-testid="hid-copy" className={linkBtn}>{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? tr("Disalin!") : tr("Salin")}</button>
              <button type="button" onClick={view === "recap" ? downloadRecapCsv : downloadCsv} disabled={!entries.length} data-testid="hid-csv" className={linkBtn}><Download className="w-3.5 h-3.5" /> {tr("CSV")}</button>
              <button type="button" onClick={downloadTxt} disabled={!entries.length} data-testid="hid-txt" className={linkBtn}><Download className="w-3.5 h-3.5" /> {tr("TXT")}</button>
              <button type="button" onClick={downloadJson} disabled={!entries.length} data-testid="hid-json" className={linkBtn}><Download className="w-3.5 h-3.5" /> {tr("JSON")}</button>
              <button type="button" onClick={clearAll} disabled={!entries.length} data-testid="hid-clear" className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded">
                <Trash2 className="w-3.5 h-3.5" /> {confirmClear ? tr("Yakin hapus semua?") : tr("Hapus")}
              </button>
            </div>
          </div>

          {entries.length > 0 && (
            <p className="px-5 py-2 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800" data-testid="hid-summary">
              {tr("{0} pindaian · {1} kode unik · {2} duplikat", entries.length, recap.length, dupCount)}
            </p>
          )}

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {entries.length === 0 && <p className="px-5 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">{tr("Belum ada hasil pindaian.")}</p>}

            {view === "log" && entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-5 py-3" data-testid="hid-row">
                <Zap className={cn("w-4 h-4 shrink-0", e.msPerChar > 0 && e.msPerChar < FAST_MS_PER_CHAR ? "text-green-500" : "text-slate-300 dark:text-slate-600")} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-slate-800 dark:text-slate-100 truncate" title={e.value}>{e.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(e.time).toLocaleTimeString(LOCALE)}{e.msPerChar > 0 ? ` · ${e.msPerChar.toFixed(1)} ${tr("md/karakter")}` : ""}</p>
                </div>
                {e.badCheck && <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-full shrink-0 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{tr("CEK SALAH")}</span>}
                {e.duplicate && <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-full shrink-0" data-testid="hid-dup-badge">{tr("DUPLIKAT")}</span>}
                <button type="button" onClick={() => removeEntry(e.id)} aria-label={tr("Hapus {0}", e.value)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}

            {view === "recap" && recap.map((r) => (
              <div key={r.value} className="flex items-center gap-3 px-5 py-3" data-testid="hid-recap-row">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-slate-800 dark:text-slate-100 truncate" title={r.value}>{r.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{tr("terakhir {0}", new Date(r.last).toLocaleTimeString(LOCALE))}{r.badCheck ? ` · ${tr("digit cek salah")}` : ""}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => adjustQty(r.value, -1)} aria-label={tr("Kurangi {0}", r.value)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="w-10 text-center font-bold text-slate-800 dark:text-slate-100 tabular-nums" data-testid="hid-qty">{r.qty}</span>
                  <button type="button" onClick={() => adjustQty(r.value, 1)} aria-label={tr("Tambah {0}", r.value)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100"><Plus className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => removeValue(r.value)} aria-label={tr("Hapus {0}", r.value)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ToolInfoPanel
        icon={<Barcode className="w-5 h-5" />}
        label={tr("Scan HID")}
        desc={tr("Input scanner barcode USB/BT")}
        points={[
          tr("Scanner barcode/QR bertipe HID bekerja seperti keyboard — cukup fokus di kolom lalu pindai."),
          tr("Setiap hasil pindaian otomatis tercatat begitu scanner mengirim Enter (atau Tab / jeda, sesuai pengaturan)."),
          tr("Ikon petir hijau menandakan input super cepat (khas scanner, bukan ketikan manual)."),
          tr("Mode Rekap menjumlahkan kode yang sama — cocok untuk stok opname. Barcode EAN/UPC dengan digit cek salah langsung ditandai."),
        ]}
        badgeText={tr("Log tersimpan di browser ini")}
      />
    </div>
  );
};
