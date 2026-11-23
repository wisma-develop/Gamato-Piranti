import type { LucideIcon } from "lucide-react";
import {
  Link2, Type, Wifi, Mail, Phone, MessageSquareText, MessageCircle, UserCircle2,
  MapPin, CalendarClock, Share2, Video, Coins, Wallet, Apple,
} from "lucide-react";
import { sanitizeText, sanitizeUrl, sanitizeNumberString, sanitizePhone } from "@/utils/sanitize";
import { SITE_URL } from "@/lib/site";
import { tr } from "@/i18n";

// ─── Field schema types ─────────────────────────────────────────────────────
// The whole "isi QR" panel is data-driven off QR_TEMPLATES below instead of
// one hand-written JSX block per content type. This keeps adding a 15th (or
// 25th) template a matter of adding one object to this array, rather than
// touching the form JSX, the payload switch, and the default-state object in
// three different places every time — the exact kind of drift that causes
// bugs when a project's template count grows this large.

export type QrFieldType = "text" | "textarea" | "email" | "tel" | "url" | "password" | "select" | "checkbox" | "date" | "time";

export interface QrFieldOption {
  value: string;
  label: string;
}

export interface QrFieldDef {
  key: string;
  label: string;
  type: QrFieldType;
  placeholder?: string;
  options?: QrFieldOption[];
  rows?: number;
  /** Render this field side-by-side with the next one (2-col grid row). */
  half?: boolean;
  /** Only show this field when another field currently holds/doesn't hold a given value. */
  showWhen?: { key: string; equals?: string; notEquals?: string };
}

export type QrFieldValues = Record<string, string | boolean>;

export interface QrTemplateDef {
  id: string;
  label: string;
  category: string;
  icon: LucideIcon;
  fields: QrFieldDef[];
  defaultData: QrFieldValues;
  buildPayload: (d: QrFieldValues) => string;
  /**
   * Pesan validasi untuk isian yang SUDAH diisi tapi tidak valid (mis. URL rusak, koordinat di luar rentang).
   * `null` = tidak ada masalah. Dipakai UI untuk memberi tahu kenapa QR belum muncul, bukan sekadar kotak kosong.
   */
  validate?: (d: QrFieldValues) => string | null;
  note?: string;
}

const str = (d: QrFieldValues, key: string) => sanitizeText(String(d[key] ?? "")).trim();
const raw = (d: QrFieldValues, key: string) => String(d[key] ?? "");

/**
 * Teks untuk ISI QR. Beda dengan `sanitizeText` (yang membuang `<` `>` demi keamanan HTML): isi QR digambar sebagai
 * modul, bukan disisipkan ke HTML, jadi karakter itu HARUS dipertahankan — kalau tidak, password WiFi / teks bebas
 * yang mengandung `<` atau `>` diam-diam berubah dan QR berisi data yang berbeda dari yang diketik.
 * Hanya karakter kontrol yang dibuang.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const payloadText = (v: string) => v.replace(CONTROL_CHARS, " ").replace(/\r\n?/g, "\n");
const pstr = (d: QrFieldValues, key: string) => payloadText(String(d[key] ?? "")).trim();

/** Escape nilai bidang WIFI: sesuai format ZXing — `\ ; , " :` di-escape; nilai yang tampak seperti hex dibungkus tanda kutip. */
export function wifiEscape(v: string): string {
  const esc = v.replace(/([\\;,":])/g, "\\$1");
  return /^[0-9A-Fa-f]+$/.test(v) ? `"${esc}"` : esc;
}

/** Normalisasi isian URL: tambahkan https:// bila pengguna hanya mengetik domain (mis. "contoh.com/menu"). */
export function normalizeWebUrl(input: string): string {
  const v = (input || "").trim();
  if (!v) return "";
  // Skema eksplisit (http:, javascript:, mailto: …). Titik dua yang langsung diikuti angka = port ("localhost:3000"), bukan skema.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(v)) return sanitizeUrl(v);
  if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?([/?#].*)?$/i.test(v)) return sanitizeUrl("https://" + v);
  return "";
}

const BTC_AMOUNT = /^\d+(\.\d{1,8})?$/;

// ─── Helpers for structured payload formats ─────────────────────────────────

function vcardEscape(v: string): string {
  // vCard 3.0 escaping: backslash, comma, semicolon, and literal newlines.
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icalEscape(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** "YYYY-MM-DD" + "HH:MM" (from <input type=date/time>) -> iCal local "YYYYMMDDTHHMMSS". */
function toIcalDateTime(date: string, time: string): string {
  const d = (date || "").replace(/-/g, "");
  const t = (time || "00:00").replace(":", "") + "00";
  if (d.length !== 8) return "";
  return `${d}T${t.padStart(6, "0")}`;
}

/** Decimal-string amount -> integer string in the smallest unit (e.g. ETH -> wei), via pure string math so large/precise amounts never lose precision to floating point. */
function toSmallestUnit(amount: string, decimals: number): string {
  const trimmed = (amount || "").trim();
  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) return "";
  const [whole, frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const combined = (whole + fracPadded).replace(/^0+(?=\d)/, "");
  return combined || "0";
}

const SOCIAL_PLATFORMS: Record<string, { label: string; build: (u: string) => string }> = {
  instagram: { label: tr("Instagram"), build: (u) => `https://instagram.com/${u}` },
  tiktok: { label: tr("TikTok"), build: (u) => `https://tiktok.com/@${u}` },
  x: { label: tr("X (Twitter)"), build: (u) => `https://x.com/${u}` },
  facebook: { label: tr("Facebook"), build: (u) => `https://facebook.com/${u}` },
  youtube: { label: tr("YouTube"), build: (u) => `https://youtube.com/@${u}` },
  linkedin: { label: tr("LinkedIn"), build: (u) => `https://linkedin.com/in/${u}` },
  telegram: { label: tr("Telegram"), build: (u) => `https://t.me/${u}` },
  threads: { label: tr("Threads"), build: (u) => `https://threads.net/@${u}` },
};

// ─── Template definitions ───────────────────────────────────────────────────

export const QR_TEMPLATES: QrTemplateDef[] = [
  {
    id: "url",
    category: "Umum",
    label: tr("URL"),
    icon: Link2,
    fields: [{ key: "url", label: tr("URL / Link"), type: "url", placeholder: "https://example.com" }],
    defaultData: { url: SITE_URL },
    buildPayload: (d) => normalizeWebUrl(raw(d, "url")),
    validate: (d) => (raw(d, "url").trim() && !normalizeWebUrl(raw(d, "url")) ? tr("URL belum valid. Contoh: https://contoh.com atau contoh.com/menu") : null),
  },
  {
    id: "text",
    category: "Umum",
    label: tr("Teks"),
    icon: Type,
    fields: [{ key: "text", label: tr("Teks Bebas"), type: "textarea", rows: 5, placeholder: tr("Ketik pesan, catatan, atau instruksi…") }],
    defaultData: { text: "" },
    buildPayload: (d) => pstr(d, "text"),
  },
  {
    id: "wifi",
    category: "Jaringan & Lokasi",
    label: tr("WiFi"),
    icon: Wifi,
    fields: [
      { key: "ssid", label: tr("Nama Jaringan (SSID)"), type: "text", placeholder: tr("Nama WiFi") },
      { key: "enc", label: tr("Enkripsi"), type: "select", half: true, options: [{ value: "WPA", label: tr("WPA / WPA2") }, { value: "WEP", label: tr("WEP") }, { value: "nopass", label: tr("Tanpa password") }] },
      { key: "password", label: tr("Password"), type: "password", half: true, placeholder: tr("Password WiFi"), showWhen: { key: "enc", notEquals: "nopass" } },
      { key: "hidden", label: tr("Jaringan tersembunyi (hidden SSID)"), type: "checkbox" },
    ],
    defaultData: { ssid: "", enc: "WPA", password: "", hidden: false },
    buildPayload: (d) => {
      const ssid = pstr(d, "ssid");
      if (!ssid) return "";
      const enc = raw(d, "enc") || "WPA";
      // Password tidak di-trim: spasi di ujung bisa jadi bagian sah dari password.
      const pass = payloadText(String(d.password ?? ""));
      const passPart = enc === "nopass" || !pass ? "" : `P:${wifiEscape(pass)};`;
      return `WIFI:T:${enc};S:${wifiEscape(ssid)};${passPart}H:${d.hidden ? "true" : "false"};;`;
    },
    validate: (d) => {
      const enc = raw(d, "enc") || "WPA";
      const pass = String(d.password ?? "");
      if (str(d, "ssid") && enc === "WPA" && pass && pass.length < 8) return tr("Password WPA/WPA2 minimal 8 karakter — QR tetap dibuat, tapi jaringan yang password-nya lebih pendek biasanya menolak.");
      return null;
    },
  },
  {
    id: "email",
    category: "Kontak & Komunikasi",
    label: tr("Email"),
    icon: Mail,
    fields: [
      { key: "to", label: tr("Kepada (email)"), type: "email", placeholder: tr("nama@domain.com") },
      { key: "subject", label: tr("Subjek"), type: "text", placeholder: tr("Subjek email") },
      { key: "body", label: tr("Isi Pesan"), type: "textarea", rows: 3, placeholder: tr("Isi email otomatis…") },
    ],
    defaultData: { to: "", subject: "", body: "" },
    buildPayload: (d) => {
      const to = str(d, "to").replace(/\s+/g, "");
      if (!to) return "";
      const params: string[] = [];
      const subj = pstr(d, "subject");
      const body = pstr(d, "body");
      if (subj) params.push(`subject=${encodeURIComponent(subj)}`);
      if (body) params.push(`body=${encodeURIComponent(body)}`);
      return `mailto:${to}${params.length ? `?${params.join("&")}` : ""}`;
    },
    validate: (d) => {
      const to = str(d, "to").replace(/\s+/g, "");
      return to && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) ? tr("Alamat email belum valid (contoh: nama@domain.com).") : null;
    },
  },
  {
    id: "phone",
    category: "Kontak & Komunikasi",
    label: tr("Telepon"),
    icon: Phone,
    fields: [{ key: "phone", label: tr("Nomor Telepon"), type: "tel", placeholder: tr("+62812xxxxxxx") }],
    defaultData: { phone: "" },
    buildPayload: (d) => {
      const phone = sanitizePhone(raw(d, "phone"));
      return phone ? `tel:${phone}` : "";
    },
  },
  {
    id: "sms",
    category: "Kontak & Komunikasi",
    label: tr("SMS"),
    icon: MessageSquareText,
    fields: [
      { key: "phone", label: tr("Nomor Telepon"), type: "tel", placeholder: tr("+62812xxxxxxx") },
      { key: "message", label: tr("Isi Pesan (opsional)"), type: "textarea", rows: 3, placeholder: tr("Pesan yang akan terisi otomatis…") },
    ],
    defaultData: { phone: "", message: "" },
    buildPayload: (d) => {
      const phone = sanitizePhone(raw(d, "phone"));
      if (!phone) return "";
      const message = pstr(d, "message");
      return `SMSTO:${phone}:${message}`;
    },
    note: tr("Format SMSTO: dikenali luas oleh aplikasi kamera & pemindai bawaan HP."),
  },
  {
    id: "whatsapp",
    category: "Kontak & Komunikasi",
    label: tr("WhatsApp"),
    icon: MessageCircle,
    fields: [
      { key: "phone", label: tr("Nomor WhatsApp (kode negara, tanpa +)"), type: "tel", placeholder: "62812xxxxxxx" },
      { key: "message", label: tr("Pesan Otomatis (opsional)"), type: "textarea", rows: 3, placeholder: tr("Halo, saya ingin bertanya…") },
    ],
    defaultData: { phone: "", message: "" },
    buildPayload: (d) => {
      const phone = sanitizePhone(raw(d, "phone")).replace(/^\+/, "").replace(/\D/g, "");
      if (!phone) return "";
      const message = pstr(d, "message");
      return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
    },
  },
  {
    id: "vcard",
    category: "Kontak & Komunikasi",
    label: tr("Kontak"),
    icon: UserCircle2,
    fields: [
      { key: "firstName", label: tr("Nama Depan"), type: "text", half: true, placeholder: tr("Budi") },
      { key: "lastName", label: tr("Nama Belakang"), type: "text", half: true, placeholder: tr("Santoso") },
      { key: "org", label: tr("Perusahaan"), type: "text", half: true, placeholder: tr("PT Gamato Digital") },
      { key: "title", label: tr("Jabatan"), type: "text", half: true, placeholder: tr("Manajer Pemasaran") },
      { key: "phoneMobile", label: tr("Telepon (HP)"), type: "tel", half: true, placeholder: tr("+62812xxxxxxx") },
      { key: "phoneWork", label: tr("Telepon (Kantor)"), type: "tel", half: true, placeholder: tr("+6221xxxxxxx") },
      { key: "email", label: tr("Email"), type: "email", half: true, placeholder: tr("nama@domain.com") },
      { key: "website", label: tr("Website"), type: "url", half: true, placeholder: "https://domain.com" },
      { key: "address", label: tr("Alamat"), type: "text", placeholder: tr("Jl. Contoh No. 1, Jakarta") },
      { key: "note", label: tr("Catatan (opsional)"), type: "textarea", rows: 2, placeholder: tr("Catatan tambahan…") },
    ],
    defaultData: { firstName: "", lastName: "", org: "", title: "", phoneMobile: "", phoneWork: "", email: "", website: "", address: "", note: "" },
    buildPayload: (d) => {
      const firstName = str(d, "firstName");
      const lastName = str(d, "lastName");
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      if (!fullName && !str(d, "org")) return "";
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      lines.push(`N:${vcardEscape(lastName)};${vcardEscape(firstName)};;;`);
      lines.push(`FN:${vcardEscape(fullName || str(d, "org"))}`);
      if (str(d, "org")) lines.push(`ORG:${vcardEscape(str(d, "org"))}`);
      if (str(d, "title")) lines.push(`TITLE:${vcardEscape(str(d, "title"))}`);
      const mobile = sanitizePhone(raw(d, "phoneMobile"));
      if (mobile) lines.push(`TEL;TYPE=CELL:${mobile}`);
      const work = sanitizePhone(raw(d, "phoneWork"));
      if (work) lines.push(`TEL;TYPE=WORK:${work}`);
      if (str(d, "email")) lines.push(`EMAIL:${vcardEscape(str(d, "email"))}`);
      const site = sanitizeUrl(raw(d, "website"));
      if (site) lines.push(`URL:${site}`);
      if (str(d, "address")) lines.push(`ADR;TYPE=WORK:;;${vcardEscape(str(d, "address"))};;;;`);
      if (str(d, "note")) lines.push(`NOTE:${vcardEscape(str(d, "note"))}`);
      lines.push("END:VCARD");
      return lines.join("\n");
    },
    note: tr("Dipindai langsung tersimpan sebagai kontak baru di HP (format vCard 3.0)."),
  },
  {
    id: "location",
    category: "Jaringan & Lokasi",
    label: tr("Lokasi"),
    icon: MapPin,
    fields: [
      { key: "lat", label: tr("Latitude"), type: "text", half: true, placeholder: "-6.200000" },
      { key: "lng", label: tr("Longitude"), type: "text", half: true, placeholder: "106.816666" },
      { key: "label", label: tr("Nama Lokasi (opsional)"), type: "text", placeholder: tr("Monas, Jakarta") },
    ],
    defaultData: { lat: "", lng: "", label: "" },
    buildPayload: (d) => {
      const lat = sanitizeNumberString(raw(d, "lat"));
      const lng = sanitizeNumberString(raw(d, "lng"));
      if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) return "";
      if (Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) return "";
      const label = str(d, "label");
      return label ? `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})` : `geo:${lat},${lng}`;
    },
    validate: (d) => {
      const lat = sanitizeNumberString(raw(d, "lat"));
      const lng = sanitizeNumberString(raw(d, "lng"));
      if (!lat && !lng) return null;
      if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) return tr("Isi latitude DAN longitude dengan angka desimal, mis. -6.2 dan 106.8.");
      if (Math.abs(Number(lat)) > 90) return tr("Latitude harus di antara -90 dan 90.");
      if (Math.abs(Number(lng)) > 180) return tr("Longitude harus di antara -180 dan 180.");
      return null;
    },
    note: tr("Dipindai langsung membuka aplikasi peta bawaan pada koordinat ini."),
  },
  {
    id: "calendar",
    category: "Jaringan & Lokasi",
    label: tr("Event Kalender"),
    icon: CalendarClock,
    fields: [
      { key: "title", label: tr("Judul Acara"), type: "text", placeholder: tr("Rapat Tim Marketing") },
      { key: "startDate", label: tr("Tanggal Mulai"), type: "date", half: true },
      { key: "startTime", label: tr("Jam Mulai"), type: "time", half: true },
      { key: "endDate", label: tr("Tanggal Selesai"), type: "date", half: true },
      { key: "endTime", label: tr("Jam Selesai"), type: "time", half: true },
      { key: "location", label: tr("Lokasi (opsional)"), type: "text", placeholder: tr("Ruang Rapat Lt. 3") },
      { key: "description", label: tr("Deskripsi (opsional)"), type: "textarea", rows: 3, placeholder: tr("Detail acara…") },
    ],
    defaultData: { title: "", startDate: "", startTime: "09:00", endDate: "", endTime: "10:00", location: "", description: "" },
    buildPayload: (d) => {
      const title = str(d, "title");
      const dtStart = toIcalDateTime(raw(d, "startDate"), raw(d, "startTime"));
      if (!title || !dtStart) return "";
      const dtEnd = toIcalDateTime(raw(d, "endDate") || raw(d, "startDate"), raw(d, "endTime")) || dtStart;
      const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", tr("PRODID:-//Gamato Piranti//ID"), "BEGIN:VEVENT"];
      lines.push(`SUMMARY:${icalEscape(title)}`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      if (str(d, "location")) lines.push(`LOCATION:${icalEscape(str(d, "location"))}`);
      if (str(d, "description")) lines.push(`DESCRIPTION:${icalEscape(str(d, "description"))}`);
      lines.push("END:VEVENT", "END:VCALENDAR");
      return lines.join("\n");
    },
    validate: (d) => {
      const s0 = toIcalDateTime(raw(d, "startDate"), raw(d, "startTime"));
      const e0 = toIcalDateTime(raw(d, "endDate") || raw(d, "startDate"), raw(d, "endTime"));
      return s0 && e0 && e0 < s0 ? tr("Waktu selesai lebih awal dari waktu mulai.") : null;
    },
    note: tr("Dipindai memunculkan opsi \"Tambah ke Kalender\" di HP."),
  },
  {
    id: "social",
    category: "Sosial & Meeting",
    label: tr("Media Sosial"),
    icon: Share2,
    fields: [
      {
        key: "platform", label: tr("Platform"), type: "select",
        options: Object.entries(SOCIAL_PLATFORMS).map(([value, p]) => ({ value, label: p.label })),
      },
      { key: "username", label: tr("Username"), type: "text", placeholder: tr("namamu (tanpa @)") },
    ],
    defaultData: { platform: "instagram", username: "" },
    buildPayload: (d) => {
      const username = str(d, "username").replace(/^@+/, "").replace(/\s+/g, "");
      if (!username) return "";
      const platform = SOCIAL_PLATFORMS[raw(d, "platform")] || SOCIAL_PLATFORMS.instagram;
      return platform.build(encodeURIComponent(username));
    },
  },
  {
    id: "zoom",
    category: "Sosial & Meeting",
    label: tr("Zoom Meeting"),
    icon: Video,
    fields: [
      { key: "meetingId", label: tr("Meeting ID"), type: "text", placeholder: "123 4567 8901" },
      { key: "passcode", label: tr("Passcode (opsional)"), type: "text", placeholder: "abc123" },
    ],
    defaultData: { meetingId: "", passcode: "" },
    buildPayload: (d) => {
      const id = raw(d, "meetingId").replace(/\D/g, "");
      if (!id) return "";
      const pass = str(d, "passcode").replace(/\s+/g, "");
      return `https://zoom.us/j/${id}${pass ? `?pwd=${encodeURIComponent(pass)}` : ""}`;
    },
  },
  {
    id: "facetime",
    category: "Sosial & Meeting",
    label: tr("FaceTime"),
    icon: Apple,
    fields: [{ key: "target", label: tr("Nomor Telepon atau Email"), type: "text", placeholder: tr("+62812xxxxxxx atau nama@icloud.com") }],
    defaultData: { target: "" },
    buildPayload: (d) => {
      const raw0 = str(d, "target");
      if (!raw0) return "";
      const target = raw0.includes("@") ? raw0 : sanitizePhone(raw0);
      return target ? `facetime:${target}` : "";
    },
    note: tr("Hanya berfungsi di perangkat Apple (iPhone/iPad/Mac)."),
  },
  {
    id: "crypto",
    category: "Pembayaran",
    label: tr("Pembayaran Kripto"),
    icon: Coins,
    fields: [
      { key: "coin", label: tr("Koin"), type: "select", half: true, options: [{ value: "bitcoin", label: tr("Bitcoin (BTC)") }, { value: "ethereum", label: tr("Ethereum (ETH)") }] },
      { key: "amount", label: tr("Jumlah (opsional)"), type: "text", half: true, placeholder: "0.001" },
      { key: "address", label: tr("Alamat Wallet"), type: "text", placeholder: tr("Alamat wallet tujuan") },
    ],
    defaultData: { coin: "bitcoin", amount: "", address: "" },
    buildPayload: (d) => {
      const address = str(d, "address").replace(/\s+/g, "");
      if (!address) return "";
      const amount = sanitizeNumberString(raw(d, "amount"));
      const coin = raw(d, "coin") || "bitcoin";
      if (amount && !BTC_AMOUNT.test(amount) && coin !== "ethereum") return "";
      if (coin === "ethereum") {
        const wei = amount ? toSmallestUnit(amount, 18) : "";
        return `ethereum:${address}${wei ? `?value=${wei}` : ""}`;
      }
      return `bitcoin:${address}${amount ? `?amount=${amount}` : ""}`;
    },
    validate: (d) => {
      const amount = sanitizeNumberString(raw(d, "amount"));
      if (!amount) return null;
      return /^\d+(\.\d+)?$/.test(amount) && (raw(d, "coin") === "ethereum" || BTC_AMOUNT.test(amount))
        ? null
        : tr("Jumlah tidak valid. Pakai angka desimal positif (Bitcoin maksimal 8 angka di belakang koma).");
    },
    note: tr("Format BIP21 (Bitcoin) / ERC-681 (Ethereum) — dikenali dompet kripto populer."),
  },
  {
    id: "paypal",
    category: "Pembayaran",
    label: tr("PayPal.me"),
    icon: Wallet,
    fields: [
      { key: "username", label: tr("Username PayPal.me"), type: "text", half: true, placeholder: "namamu" },
      { key: "amount", label: tr("Jumlah (opsional)"), type: "text", half: true, placeholder: "20" },
      { key: "currency", label: tr("Kode Mata Uang (opsional)"), type: "text", placeholder: tr("USD") },
    ],
    defaultData: { username: "", amount: "", currency: "" },
    buildPayload: (d) => {
      const username = str(d, "username").replace(/^@+/, "").replace(/\s+/g, "");
      if (!username) return "";
      const amount = sanitizeNumberString(raw(d, "amount"));
      const currency = str(d, "currency").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
      const base = `https://paypal.me/${encodeURIComponent(username)}`;
      return amount ? `${base}/${amount}${currency || ""}` : base;
    },
  },
];

export const QR_TEMPLATE_CATEGORIES = [tr("Umum"), tr("Kontak & Komunikasi"), tr("Jaringan & Lokasi"), tr("Sosial & Meeting"), tr("Pembayaran")] as const;

export function getQrTemplate(id: string): QrTemplateDef {
  return QR_TEMPLATES.find((t) => t.id === id) || QR_TEMPLATES[0];
}
