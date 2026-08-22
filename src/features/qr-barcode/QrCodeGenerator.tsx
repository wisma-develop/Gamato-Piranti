import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Link2, Type, Wifi, Mail, Phone, Upload, Download, Sparkles, AlertTriangle, RefreshCw,
} from "lucide-react";
import QRCodeStyling from "qr-code-styling";
import { cn } from "@/utils/cn";
import { sanitizeText, sanitizeUrl } from "@/utils/sanitize";
import { fileToDataUrl } from "@/lib/file";
import { buildFramedLogoDataUrl } from "@/lib/qrLogo";
import { Label, Input, Select, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoTooltip } from "@/components/ui/GamatoTooltip";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";

type QrTemplate = "url" | "text" | "wifi" | "email" | "phone";
type DotType = "square" | "dots" | "rounded" | "classy" | "classy-rounded" | "extra-rounded";
type CornerSquareType = "square" | "dot" | "extra-rounded";
type CornerDotType = "square" | "dot";

const QR_TEMPLATES: { id: QrTemplate; label: string; icon: React.ReactNode }[] = [
  { id: "url",   label: "URL",     icon: <Link2  className="w-4 h-4" /> },
  { id: "text",  label: "Teks",    icon: <Type   className="w-4 h-4" /> },
  { id: "wifi",  label: "WiFi",    icon: <Wifi   className="w-4 h-4" /> },
  { id: "email", label: "Email",   icon: <Mail   className="w-4 h-4" /> },
  { id: "phone", label: "Telepon", icon: <Phone  className="w-4 h-4" /> },
];

const DOT_STYLES: { id: DotType; label: string }[] = [
  { id: "square", label: "Kotak" },
  { id: "dots", label: "Bulat" },
  { id: "rounded", label: "Membulat" },
  { id: "classy", label: "Classy" },
  { id: "classy-rounded", label: "Classy+" },
  { id: "extra-rounded", label: "Ekstra Bulat" },
];

const CORNER_SQUARE_STYLES: { id: CornerSquareType; label: string }[] = [
  { id: "square", label: "Kotak" },
  { id: "dot", label: "Bulat" },
  { id: "extra-rounded", label: "Membulat" },
];

const CORNER_DOT_STYLES: { id: CornerDotType; label: string }[] = [
  { id: "square", label: "Kotak" },
  { id: "dot", label: "Bulat" },
];

type Preset = {
  name: string;
  dotsType: DotType;
  cornersSquareType: CornerSquareType;
  cornersDotType: CornerDotType;
  dotsColor: string;
  cornersColor: string;
  bgColor: string;
};

const PRESETS: Preset[] = [
  { name: "Klasik",      dotsType: "square",         cornersSquareType: "square",        cornersDotType: "square", dotsColor: "#0f172a", cornersColor: "#0f172a", bgColor: "#ffffff" },
  { name: "Elegan",      dotsType: "rounded",        cornersSquareType: "extra-rounded",  cornersDotType: "dot",    dotsColor: "#4f46e5", cornersColor: "#4f46e5", bgColor: "#ffffff" },
  { name: "Playful",     dotsType: "dots",           cornersSquareType: "dot",            cornersDotType: "dot",    dotsColor: "#0d9488", cornersColor: "#0d9488", bgColor: "#ffffff" },
  { name: "Classy Gold", dotsType: "classy-rounded", cornersSquareType: "extra-rounded",  cornersDotType: "square", dotsColor: "#b45309", cornersColor: "#78350f", bgColor: "#fffbeb" },
  { name: "Neon Rose",   dotsType: "extra-rounded",  cornersSquareType: "dot",            cornersDotType: "dot",    dotsColor: "#e11d48", cornersColor: "#9f1239", bgColor: "#ffffff" },
  { name: "Midnight",    dotsType: "classy",         cornersSquareType: "square",         cornersDotType: "dot",    dotsColor: "#e2e8f0", cornersColor: "#e2e8f0", bgColor: "#1e293b" },
];

function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  if (c.length !== 6) return 1;
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1) + 0.05;
  const l2 = relativeLuminance(hex2) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

type QrConfig = {
  qrTemplate: QrTemplate;
  qrUrl: string;
  qrText: string;
  qrWifiSsid: string;
  qrWifiPass: string;
  qrWifiEnc: "WPA" | "WEP" | "nopass";
  qrWifiHidden: boolean;
  qrEmailTo: string;
  qrEmailSubject: string;
  qrEmailBody: string;
  qrPhone: string;
  size: number;
  dotsType: DotType;
  cornersSquareType: CornerSquareType;
  cornersDotType: CornerDotType;
  dotsColor: string;
  cornersColor: string;
  bgColor: string;
};

const DEFAULT_QR_CONFIG: QrConfig = {
  qrTemplate: "url",
  qrUrl: "https://gamato-piranti.local",
  qrText: "",
  qrWifiSsid: "",
  qrWifiPass: "",
  qrWifiEnc: "WPA",
  qrWifiHidden: false,
  qrEmailTo: "",
  qrEmailSubject: "",
  qrEmailBody: "",
  qrPhone: "",
  size: 320,
  dotsType: "rounded",
  cornersSquareType: "extra-rounded",
  cornersDotType: "dot",
  dotsColor: "#4f46e5",
  cornersColor: "#4f46e5",
  bgColor: "#ffffff",
};

export function QrCodeGenerator() {
  // Seluruh pengaturan QR (isi, gaya titik/sudut, warna, ukuran) punya
  // riwayat Undo/Redo, digabung jadi satu langkah setelah jeda singkat.
  // Nama variabel & setter di bawah sengaja dipertahankan sama persis
  // (qrUrl/setQrUrl, dotsColor/setDotsColor, dst.) supaya seluruh JSX di
  // bawahnya tetap jalan tanpa perlu diubah satu per satu.
  const qrHistory = useHistoryState<QrConfig>(() => DEFAULT_QR_CONFIG);
  const qrConfig = qrHistory.state;
  const { schedule: scheduleQrCommit } = useDebouncedCommit(qrHistory.commit, 600);
  function setQrField<K extends keyof QrConfig>(key: K, value: QrConfig[K]) {
    qrHistory.set((prev) => ({ ...prev, [key]: value }), { commit: false });
    scheduleQrCommit();
  }
  const { qrTemplate, qrUrl, qrText, qrWifiSsid, qrWifiPass, qrWifiEnc, qrWifiHidden, qrEmailTo, qrEmailSubject, qrEmailBody, qrPhone, size, dotsType, cornersSquareType, cornersDotType, dotsColor, cornersColor, bgColor } = qrConfig;
  const setQrTemplate = (v: QrTemplate) => setQrField("qrTemplate", v);
  const setQrUrl = (v: string) => setQrField("qrUrl", v);
  const setQrText = (v: string) => setQrField("qrText", v);
  const setQrWifiSsid = (v: string) => setQrField("qrWifiSsid", v);
  const setQrWifiPass = (v: string) => setQrField("qrWifiPass", v);
  const setQrWifiEnc = (v: "WPA" | "WEP" | "nopass") => setQrField("qrWifiEnc", v);
  const setQrWifiHidden = (v: boolean) => setQrField("qrWifiHidden", v);
  const setQrEmailTo = (v: string) => setQrField("qrEmailTo", v);
  const setQrEmailSubject = (v: string) => setQrField("qrEmailSubject", v);
  const setQrEmailBody = (v: string) => setQrField("qrEmailBody", v);
  const setQrPhone = (v: string) => setQrField("qrPhone", v);
  const setSize = (v: number) => setQrField("size", v);
  const setDotsType = (v: DotType) => setQrField("dotsType", v);
  const setCornersSquareType = (v: CornerSquareType) => setQrField("cornersSquareType", v);
  const setCornersDotType = (v: CornerDotType) => setQrField("cornersDotType", v);
  const setDotsColor = (v: string) => setQrField("dotsColor", v);
  const setCornersColor = (v: string) => setQrField("cornersColor", v);
  const setBgColor = (v: string) => setQrField("bgColor", v);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);

  const buildQrPayload = (): string => {
    switch (qrTemplate) {
      case "url": return sanitizeUrl(qrUrl);
      case "text": return sanitizeText(qrText);
      case "wifi": {
        const ssid = sanitizeText(qrWifiSsid);
        if (!ssid) return "";
        const pass = sanitizeText(qrWifiPass);
        const passPart = qrWifiEnc === "nopass" ? "" : `P:${pass};`;
        return `WIFI:T:${qrWifiEnc};S:${ssid};${passPart}H:${qrWifiHidden ? "true" : "false"};;`;
      }
      case "email": {
        const to = sanitizeText(qrEmailTo).replace(/\s+/g, "");
        if (!to) return "";
        const params: string[] = [];
        const subj = sanitizeText(qrEmailSubject);
        const body = sanitizeText(qrEmailBody);
        if (subj) params.push(`subject=${encodeURIComponent(subj)}`);
        if (body) params.push(`body=${encodeURIComponent(body)}`);
        return `mailto:${to}${params.length ? `?${params.join("&")}` : ""}`;
      }
      case "phone": {
        const phone = qrPhone.replace(/[^\d+]/g, "").replace(/(?!^)[+]/g, "");
        return phone ? `tel:${phone}` : "";
      }
      default: return "";
    }
  };

  const payload = useMemo(
    buildQrPayload,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qrTemplate, qrUrl, qrText, qrWifiSsid, qrWifiPass, qrWifiEnc, qrWifiHidden, qrEmailTo, qrEmailSubject, qrEmailBody, qrPhone]
  );

  // Load the uploaded logo, then run it through buildFramedLogoDataUrl so it
  // always comes out as a clean rounded-square "app icon" style badge —
  // regardless of whether the source PNG is transparent, has its own
  // background, or an odd aspect ratio.
  useEffect(() => {
    if (!logoFile) { setLogoDataUrl(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const rawUrl = await fileToDataUrl(logoFile);
        const framed = await buildFramedLogoDataUrl(rawUrl);
        if (!cancelled) setLogoDataUrl(framed);
      } catch {
        if (!cancelled) setLogoDataUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [logoFile]);

  const currentOptions = () => ({
    width: size,
    height: size,
    type: "canvas" as const,
    data: payload.trim() || " ",
    margin: 8,
    qrOptions: { errorCorrectionLevel: (logoDataUrl ? "H" : "Q") as "H" | "Q" },
    dotsOptions: { type: dotsType, color: dotsColor },
    backgroundOptions: { color: bgColor },
    cornersSquareOptions: { type: cornersSquareType, color: cornersColor },
    cornersDotOptions: { type: cornersDotType, color: cornersColor },
    image: logoDataUrl || undefined,
    imageOptions: { hideBackgroundDots: true, imageSize: 0.35, margin: 6, crossOrigin: "anonymous" as const },
  });

  // Create the QR instance once and mount it into the DOM.
  useEffect(() => {
    const instance = new QRCodeStyling(currentOptions());
    qrInstanceRef.current = instance;
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      instance.append(containerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push every style/content change into the live instance (no re-mount needed).
  useEffect(() => {
    qrInstanceRef.current?.update(currentOptions());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, size, dotsType, cornersSquareType, cornersDotType, dotsColor, cornersColor, bgColor, logoDataUrl]);

  const applyPreset = (p: Preset) => {
    setDotsType(p.dotsType);
    setCornersSquareType(p.cornersSquareType);
    setCornersDotType(p.cornersDotType);
    setDotsColor(p.dotsColor);
    setCornersColor(p.cornersColor);
    setBgColor(p.bgColor);
  };

  const download = (extension: "png" | "jpeg" | "webp" | "svg") => {
    qrInstanceRef.current?.download({ name: "gamato-qr", extension });
  };

  // Manual, always-works fallback: fully clears and re-mounts the QR
  // instance into the preview container. Exposed as a small "Buat Preview"
  // button so the user has a one-click fix if the live preview ever looks
  // stale or blank for any reason.
  const refreshPreview = () => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";
    const instance = new QRCodeStyling(currentOptions());
    qrInstanceRef.current = instance;
    instance.append(containerRef.current);
  };

  const contrast = useMemo(() => contrastRatio(dotsColor, bgColor), [dotsColor, bgColor]);
  const lowContrast = contrast < 2.2;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        {/* LEFT: Controls */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Editor QR Code</p>
            <UndoRedoBar canUndo={qrHistory.canUndo} canRedo={qrHistory.canRedo} onUndo={qrHistory.undo} onRedo={qrHistory.redo} />
          </div>

          {/* Template selector */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Isi QR</p>
            <div className="flex flex-wrap gap-2">
              {QR_TEMPLATES.map(t => (
                <button key={t.id} type="button" onClick={() => setQrTemplate(t.id)}
                  className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all",
                    qrTemplate === t.id ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10")}>
                  {t.icon}<span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Template form */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            {qrTemplate === "url" && <Input label="URL / Link" value={qrUrl} onChange={e => setQrUrl(sanitizeText(e.target.value))} placeholder="https://example.com" type="text" />}
            {qrTemplate === "text" && <Textarea label="Teks Bebas" rows={5} value={qrText} onChange={e => setQrText(sanitizeText(e.target.value))} placeholder="Ketik pesan, catatan, atau instruksi…" />}
            {qrTemplate === "wifi" && (
              <div className="space-y-3">
                <Input label="Nama Jaringan (SSID)" value={qrWifiSsid} onChange={e => setQrWifiSsid(sanitizeText(e.target.value))} placeholder="Nama WiFi" />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Enkripsi" value={qrWifiEnc} onChange={e => setQrWifiEnc(e.target.value as any)}>
                    <option value="WPA">WPA / WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Tanpa password</option>
                  </Select>
                  <Input label="Password" type="password" disabled={qrWifiEnc === "nopass"} value={qrWifiPass} onChange={e => setQrWifiPass(sanitizeText(e.target.value))} placeholder={qrWifiEnc === "nopass" ? "—" : "Password WiFi"} />
                </div>
                <GamatoCheckbox checked={qrWifiHidden} onChange={setQrWifiHidden} label="Jaringan tersembunyi (hidden SSID)" />
              </div>
            )}
            {qrTemplate === "email" && (
              <div className="space-y-3">
                <Input label="Kepada (email)" type="email" value={qrEmailTo} onChange={e => setQrEmailTo(sanitizeText(e.target.value))} placeholder="nama@domain.com" />
                <Input label="Subjek" value={qrEmailSubject} onChange={e => setQrEmailSubject(sanitizeText(e.target.value))} placeholder="Subjek email" />
                <Textarea label="Isi Pesan" rows={3} value={qrEmailBody} onChange={e => setQrEmailBody(sanitizeText(e.target.value))} placeholder="Isi email otomatis…" />
              </div>
            )}
            {qrTemplate === "phone" && (
              <Input label="Nomor Telepon" value={qrPhone} onChange={e => setQrPhone(sanitizeText(e.target.value))} placeholder="+62812xxxxxxx" />
            )}
          </div>

          {/* Style presets */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Gaya Instan</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map(p => (
                <button key={p.name} type="button" onClick={() => applyPreset(p)}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-500/10 transition-all">
                  <span className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600" style={{ backgroundColor: p.bgColor }}>
                    <span className="block w-full h-full rounded-lg" style={{ background: `linear-gradient(135deg, ${p.dotsColor} 35%, transparent 35%)` }} />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Manual style controls */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Kustomisasi Manual</p>

            <div>
              <Label>Bentuk Titik (Dots)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {DOT_STYLES.map(s => (
                  <button key={s.id} type="button" onClick={() => setDotsType(s.id)}
                    className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                      dotsType === s.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bentuk Sudut Luar</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {CORNER_SQUARE_STYLES.map(s => (
                    <button key={s.id} type="button" onClick={() => setCornersSquareType(s.id)}
                      className={cn("px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                        cornersSquareType === s.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300")}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Bentuk Sudut Dalam</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {CORNER_DOT_STYLES.map(s => (
                    <button key={s.id} type="button" onClick={() => setCornersDotType(s.id)}
                      className={cn("px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                        cornersDotType === s.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300")}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <GamatoColorPicker label="Warna Titik" value={dotsColor} onChange={setDotsColor} />
              <GamatoColorPicker label="Warna Sudut" value={cornersColor} onChange={setCornersColor} />
              <GamatoColorPicker label="Warna Latar" value={bgColor} onChange={setBgColor} />
            </div>

            {lowContrast && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Kontras warna titik &amp; latar cukup rendah — bisa mempersulit pemindaian. Coba warna yang lebih kontras untuk hasil paling aman.</span>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>Ukuran</Label>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{size}px</span>
              </div>
              <GamatoSlider min={200} max={600} step={10} value={size} onChange={setSize} aria-label="Ukuran QR" />
            </div>

            <div>
              <Label>Logo Tengah (Opsional)</Label>
              <label className="mt-1 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all group">
                {logoDataUrl ? (
                  <div className="flex items-center gap-4 w-full">
                    <img src={logoDataUrl} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm" />
                    <span className="flex-1 text-sm text-slate-600 dark:text-slate-300 font-medium">Logo terpasang</span>
                    <button type="button" onClick={e => { e.preventDefault(); setLogoFile(null); }} className="text-sm text-red-500 font-semibold hover:text-red-700">Hapus</button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="flex justify-center mb-2 text-slate-400 dark:text-slate-500"><Upload className="w-7 h-7" /></div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Upload Logo <span className="text-indigo-600 dark:text-indigo-400">PNG/JPG</span></p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Akan tampil di tengah QR code</p>
                  </div>
                )}
                <input type="file" className="hidden" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div className="sticky top-24 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Preview Real-time</p>
          <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center justify-center min-h-[380px] shadow-sm">
            <GamatoTooltip label="Muat ulang preview bila tidak muncul" side="bottom">
              <button
                type="button"
                onClick={refreshPreview}
                className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-white dark:hover:bg-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                Buat Preview
              </button>
            </GamatoTooltip>

            {/* The QR container div is ALWAYS mounted (never conditionally
                removed) — qr-code-styling's canvas is appended into it once
                and only ever `.update()`d afterwards. If this div were
                conditionally unmounted whenever the payload is briefly
                empty (e.g. switching to an empty template field) and later
                remounted, the library would have no way to re-attach its
                canvas to the new DOM node, leaving the preview blank even
                though content exists. Visibility is toggled with CSS
                instead of JSX so the DOM node — and the library's handle
                to it — never disappears. */}
            <div className={cn("bg-white p-5 rounded-2xl shadow-2xl shadow-slate-200/80 dark:shadow-black/40", !payload.trim() && "absolute opacity-0 pointer-events-none")}>
              <div
                ref={containerRef}
                className="[&>canvas]:max-w-full [&>canvas]:h-auto [&>svg]:max-w-full [&>svg]:h-auto"
              />
            </div>
            {!payload.trim() && (
              <div className="w-56 h-56 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center px-6">Isi form di kiri untuk melihat preview QR</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Btn onClick={() => download("png")} disabled={!payload.trim()} className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-lg shadow-indigo-600/20">
              <Download className="w-4 h-4" />PNG
            </Btn>
            <Btn onClick={() => download("svg")} disabled={!payload.trim()} variant="secondary" className="py-3">
              <Download className="w-4 h-4" />SVG
            </Btn>
            <Btn onClick={() => download("jpeg")} disabled={!payload.trim()} variant="secondary" className="py-3 text-sm">
              JPEG
            </Btn>
            <Btn onClick={() => download("webp")} disabled={!payload.trim()} variant="secondary" className="py-3 text-sm">
              WEBP
            </Btn>
          </div>

          <div className="text-center"><SectionBadge>Diproses langsung di perangkatmu</SectionBadge></div>
        </div>
      </div>
    </div>
  );
}
