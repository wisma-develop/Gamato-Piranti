import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  QrCode, Barcode, Link2, Type, Wifi, Mail, Phone,
  Upload, Loader2, Download, ShieldCheck,
} from "lucide-react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { cn } from "@/utils/cn";
import { sanitizeText, sanitizeUrl } from "@/utils/sanitize";
import { downloadBlob, fileToDataUrl } from "@/lib/file";
import { Label, Input, Select, Textarea, Btn, SectionBadge } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";

const QR_TEMPLATES: { id: QrTemplate; label: string; icon: React.ReactNode }[] = [
  { id: "url",   label: "URL",     icon: <Link2  className="w-4 h-4" /> },
  { id: "text",  label: "Teks",    icon: <Type   className="w-4 h-4" /> },
  { id: "wifi",  label: "WiFi",    icon: <Wifi   className="w-4 h-4" /> },
  { id: "email", label: "Email",   icon: <Mail   className="w-4 h-4" /> },
  { id: "phone", label: "Telepon", icon: <Phone  className="w-4 h-4" /> },
];

// ─── QR & Barcode Studio ──────────────────────────────────────────────────────

type QrTemplate = "url" | "text" | "wifi" | "email" | "phone";

export const QRBarcodeStudio: React.FC = () => {
  const [mode, setMode] = useState<"qr" | "barcode">("qr");
  const [qrTemplate, setQrTemplate] = useState<QrTemplate>("url");
  const [qrUrl, setQrUrl] = useState("https://gamato-piranti.local");
  const [qrText, setQrText] = useState("");
  const [qrWifiSsid, setQrWifiSsid] = useState("");
  const [qrWifiPass, setQrWifiPass] = useState("");
  const [qrWifiEnc, setQrWifiEnc] = useState<"WPA" | "WEP" | "nopass">("WPA");
  const [qrWifiHidden, setQrWifiHidden] = useState(false);
  const [qrEmailTo, setQrEmailTo] = useState("");
  const [qrEmailSubject, setQrEmailSubject] = useState("");
  const [qrEmailBody, setQrEmailBody] = useState("");
  const [qrPhone, setQrPhone] = useState("");
  const [barcodeContent, setBarcodeContent] = useState("123456789012");
  const [barcodeFormat, setBarcodeFormat] = useState<string>("CODE128");
  const [barcodeHeight, setBarcodeHeight] = useState(80);
  const [size, setSize] = useState(280);
  const [fgColor, setFgColor] = useState("#020617");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [qrUrlImage, setQrUrlImage] = useState<string | null>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logoPreview = useMemo(() => logoFile ? URL.createObjectURL(logoFile) : null, [logoFile]);

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

  const generate = async () => {
    setError(null);
    setIsGenerating(true);
    try {
      if (mode === "qr") {
        const payload = buildQrPayload();
        if (!payload.trim()) { setError("Isi QR belum lengkap."); return; }
        const baseCanvas = document.createElement("canvas");
        await QRCode.toCanvas(baseCanvas, payload, { margin: 2, width: size, color: { dark: fgColor, light: bgColor } });
        if (!logoFile) {
          setQrUrlImage(baseCanvas.toDataURL("image/png"));
        } else {
          const ctx = baseCanvas.getContext("2d")!;
          const logoUrl = await fileToDataUrl(logoFile);
          const img = new Image();
          img.src = logoUrl;
          await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(); });
          const ls = size * 0.25, x = (size - ls) / 2, y = (size - ls) / 2, r = ls * 0.22;
          ctx.save(); ctx.beginPath();
          ctx.moveTo(x + r, y); ctx.lineTo(x + ls - r, y); ctx.quadraticCurveTo(x + ls, y, x + ls, y + r);
          ctx.lineTo(x + ls, y + ls - r); ctx.quadraticCurveTo(x + ls, y + ls, x + ls - r, y + ls);
          ctx.lineTo(x + r, y + ls); ctx.quadraticCurveTo(x, y + ls, x, y + ls - r);
          ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
          ctx.fillStyle = "rgba(255,255,255,0.98)"; ctx.fill(); ctx.clip();
          ctx.drawImage(img, x, y, ls, ls); ctx.restore();
          setQrUrlImage(baseCanvas.toDataURL("image/png"));
        }
      } else {
        const canvas = barcodeCanvasRef.current;
        if (!canvas) return;
        let value = barcodeContent.trim();
        if (!value) { setError("Isi barcode belum diisi."); return; }
        const numericFormats = ["EAN13", "EAN8", "UPC", "ITF14"];
        if (numericFormats.includes(barcodeFormat)) {
          const digits = value.replace(/\D/g, "");
          if (!digits) { setError("Format ini hanya mendukung angka."); return; }
          const len = digits.length;
          if (barcodeFormat === "EAN13" && len !== 12 && len !== 13) { setError("EAN-13: butuh 12 atau 13 digit."); return; }
          if (barcodeFormat === "EAN8" && len !== 7 && len !== 8) { setError("EAN-8: butuh 7 atau 8 digit."); return; }
          if (barcodeFormat === "UPC" && len !== 11 && len !== 12) { setError("UPC: butuh 11 atau 12 digit."); return; }
          if (barcodeFormat === "ITF14" && len !== 13 && len !== 14) { setError("ITF-14: butuh 13 atau 14 digit."); return; }
          value = digits;
        }
        JsBarcode(canvas, value, { format: barcodeFormat as any, lineColor: fgColor, background: bgColor, width: 2, height: barcodeHeight, displayValue: true, margin: 10 });
      }
    } catch (err: any) {
      setError(err?.message || "Gagal membuat kode");
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate QR on change
  useEffect(() => {
    if (mode !== "qr") return;
    const payload = buildQrPayload();
    if (!payload.trim()) return;
    const timer = setTimeout(() => generate(), 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, qrTemplate, qrUrl, qrText, qrWifiSsid, qrWifiPass, qrWifiEnc, qrWifiHidden, qrEmailTo, qrEmailSubject, qrEmailBody, qrPhone, size, fgColor, bgColor, logoFile]);

  const downloadQR = () => {
    if (!qrUrlImage) return;
    fetch(qrUrlImage).then(r => r.blob()).then(b => downloadBlob(b, "gamato-qr.png"));
  };
  const downloadBarcode = () => {
    const canvas = barcodeCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob(b => { if (b) downloadBlob(b, "gamato-barcode.png"); });
  };

  // QR_TEMPLATES defined at module level

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-3">
        {[{ id: "qr", icon: <QrCode className="w-5 h-5" />, label: "QR Code", sub: "5 template • logo • warna" }, { id: "barcode", icon: <Barcode className="w-5 h-5" />, label: "Barcode", sub: "6 format • validasi otomatis" }].map(m => (
          <button key={m.id} type="button" onClick={() => setMode(m.id as "qr" | "barcode")}
            className={cn("rounded-2xl border-2 p-4 text-left transition-all flex items-center gap-3", mode === m.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300")}>
            <span className={cn("shrink-0", mode === m.id ? "text-blue-600" : "text-slate-400")}>{m.icon}</span>
            <div>
              <div className={cn("font-bold text-base", mode === m.id ? "text-blue-700" : "text-slate-900")}>{m.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{m.sub}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        {/* LEFT: Controls */}
        <div className="space-y-5">
          {mode === "qr" && (
            <>
              {/* Template selector */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Template QR</p>
                <div className="flex flex-wrap gap-2">
                  {QR_TEMPLATES.map(t => (
                    <button key={t.id} type="button" onClick={() => setQrTemplate(t.id)}
                      className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all",
                        qrTemplate === t.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50")}>
                      {t.icon}<span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Template form */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                {qrTemplate === "url" && <Input label="URL / Link" value={qrUrl} onChange={e => setQrUrl(sanitizeUrl(e.target.value))} placeholder="https://example.com" type="url" />}
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
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={qrWifiHidden} onChange={e => setQrWifiHidden(e.target.checked)} className="rounded border-slate-300 accent-blue-600" />
                      Jaringan tersembunyi (hidden SSID)
                    </label>
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
            </>
          )}

          {mode === "barcode" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <Textarea label="Konten Barcode" rows={4} value={barcodeContent} onChange={e => setBarcodeContent(sanitizeText(e.target.value))} placeholder="Kode produk, SKU, atau angka…" />
              <div className="grid grid-cols-2 gap-4">
                <Select label="Format" value={barcodeFormat} onChange={e => setBarcodeFormat(e.target.value)}>
                  <option value="CODE128">CODE 128 (umum)</option>
                  <option value="EAN13">EAN-13</option>
                  <option value="EAN8">EAN-8</option>
                  <option value="UPC">UPC</option>
                  <option value="CODE39">CODE 39</option>
                  <option value="ITF14">ITF-14</option>
                </Select>
                <Input label="Tinggi (px)" type="number" min={40} max={200} value={barcodeHeight} onChange={e => setBarcodeHeight(Number(e.target.value) || 80)} />
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Format EAN/UPC/ITF hanya mendukung angka dengan panjang tertentu.</p>
            </div>
          )}

          {/* Customization */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Kustomisasi</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Warna Utama</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={fgColor} onChange={e => setFgColor(e.target.value)} className="h-11 w-11 rounded-xl border border-slate-200 cursor-pointer p-0.5 shadow-sm" />
                  <span className="text-sm font-mono text-slate-500">{fgColor}</span>
                </div>
              </div>
              <div>
                <Label>Warna Latar</Label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="h-11 w-11 rounded-xl border border-slate-200 cursor-pointer p-0.5 shadow-sm" />
                  <span className="text-sm font-mono text-slate-500">{bgColor}</span>
                </div>
              </div>
            </div>

            {mode === "qr" && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Ukuran QR</Label>
                    <span className="text-sm font-bold text-blue-600">{size}px</span>
                  </div>
                  <input type="range" min={128} max={512} value={size} onChange={e => setSize(Number(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600 bg-slate-200" />
                </div>

                <div>
                  <Label>Logo Tengah (Opsional)</Label>
                  <label className="mt-1 flex items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-all group">
                    {logoPreview ? (
                      <div className="flex items-center gap-4 w-full">
                        <img src={logoPreview} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm" />
                        <span className="flex-1 text-sm text-slate-600 font-medium">Logo terpasang </span>
                        <button type="button" onClick={e => { e.preventDefault(); setLogoFile(null); }} className="text-sm text-red-500 font-semibold hover:text-red-700">Hapus</button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="flex justify-center mb-2 text-slate-400"><Upload className="w-7 h-7" /></div>
                        <p className="text-sm font-semibold text-slate-600">Upload Logo <span className="text-blue-600">PNG/JPG</span></p>
                        <p className="text-xs text-slate-400 mt-1">Akan tampil di tengah QR code</p>
                      </div>
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </>
            )}
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex gap-2"><span></span>{error}</div>}

          <Btn onClick={generate} disabled={isGenerating || !(mode === "qr" ? !!buildQrPayload().trim() : !!barcodeContent.trim())} className="w-full py-4 text-base">
            {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses…</> : mode === "qr" ? <><QrCode className="w-4 h-4" />Generate QR Code</> : <><Barcode className="w-4 h-4" />Generate Barcode</>}
          </Btn>
        </div>

        {/* RIGHT: Preview */}
        <div className="sticky top-24 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 text-center">Preview Real-time</p>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[380px] shadow-sm">
            {mode === "qr" ? (
              qrUrlImage ? (
                <div className="bg-white p-5 rounded-2xl shadow-2xl shadow-slate-200/80">
                  <img src={qrUrlImage} alt="QR Code" className="rounded-xl" style={{ width: Math.min(size, 260), height: Math.min(size, 260) }} />
                </div>
              ) : (
                <div className="w-56 h-56 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center">
                  <p className="text-sm text-slate-400 text-center px-6">Isi form di kiri untuk melihat preview QR</p>
                </div>
              )
            ) : (
              <div className="bg-white p-5 rounded-2xl shadow-xl w-full">
                <canvas ref={barcodeCanvasRef} className="max-w-full" />
                {!barcodeContent.trim() && <div className="h-28 flex items-center justify-center"><p className="text-sm text-slate-400">Isi konten barcode</p></div>}
              </div>
            )}
          </div>

          {mode === "qr" ? (
            <Btn onClick={downloadQR} disabled={!qrUrlImage} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white border-0 text-base shadow-lg shadow-blue-600/20">
              <><Download className="w-4 h-4" />Unduh QR · PNG</>
            </Btn>
          ) : (
            <Btn onClick={downloadBarcode} disabled={!barcodeContent.trim()} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white border-0 text-base shadow-lg shadow-blue-600/20">
              <><Download className="w-4 h-4" />Unduh Barcode · PNG</>
            </Btn>
          )}

          <div className="text-center"><SectionBadge>Diproses langsung di perangkatmu</SectionBadge></div>
        </div>
      </div>
    </div>
  );
};
