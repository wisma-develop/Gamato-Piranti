import type { LucideIcon } from "lucide-react";
import {
  Link2, Type, Wifi, Mail, Phone, MessageSquareText, MessageCircle, UserCircle2,
  MapPin, CalendarClock, Share2, Video, Coins, Wallet, Apple,
} from "lucide-react";
import { sanitizeText, sanitizeUrl, sanitizeNumberString, sanitizePhone } from "@/utils/sanitize";

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
  icon: LucideIcon;
  fields: QrFieldDef[];
  defaultData: QrFieldValues;
  buildPayload: (d: QrFieldValues) => string;
  note?: string;
}

const str = (d: QrFieldValues, key: string) => sanitizeText(String(d[key] ?? "")).trim();
const raw = (d: QrFieldValues, key: string) => String(d[key] ?? "");

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
  instagram: { label: "Instagram", build: (u) => `https://instagram.com/${u}` },
  tiktok: { label: "TikTok", build: (u) => `https://tiktok.com/@${u}` },
  x: { label: "X (Twitter)", build: (u) => `https://x.com/${u}` },
  facebook: { label: "Facebook", build: (u) => `https://facebook.com/${u}` },
  youtube: { label: "YouTube", build: (u) => `https://youtube.com/@${u}` },
  linkedin: { label: "LinkedIn", build: (u) => `https://linkedin.com/in/${u}` },
  telegram: { label: "Telegram", build: (u) => `https://t.me/${u}` },
  threads: { label: "Threads", build: (u) => `https://threads.net/@${u}` },
};

// ─── Template definitions ───────────────────────────────────────────────────

export const QR_TEMPLATES: QrTemplateDef[] = [
  {
    id: "url",
    label: "URL",
    icon: Link2,
    fields: [{ key: "url", label: "URL / Link", type: "url", placeholder: "https://example.com" }],
    defaultData: { url: "https://gamato-piranti.local" },
    buildPayload: (d) => sanitizeUrl(raw(d, "url")),
  },
  {
    id: "text",
    label: "Teks",
    icon: Type,
    fields: [{ key: "text", label: "Teks Bebas", type: "textarea", rows: 5, placeholder: "Ketik pesan, catatan, atau instruksi…" }],
    defaultData: { text: "" },
    buildPayload: (d) => str(d, "text"),
  },
  {
    id: "wifi",
    label: "WiFi",
    icon: Wifi,
    fields: [
      { key: "ssid", label: "Nama Jaringan (SSID)", type: "text", placeholder: "Nama WiFi" },
      { key: "enc", label: "Enkripsi", type: "select", half: true, options: [{ value: "WPA", label: "WPA / WPA2" }, { value: "WEP", label: "WEP" }, { value: "nopass", label: "Tanpa password" }] },
      { key: "password", label: "Password", type: "password", half: true, placeholder: "Password WiFi", showWhen: { key: "enc", notEquals: "nopass" } },
      { key: "hidden", label: "Jaringan tersembunyi (hidden SSID)", type: "checkbox" },
    ],
    defaultData: { ssid: "", enc: "WPA", password: "", hidden: false },
    buildPayload: (d) => {
      const ssid = str(d, "ssid");
      if (!ssid) return "";
      const enc = raw(d, "enc") || "WPA";
      const pass = str(d, "password");
      const passPart = enc === "nopass" ? "" : `P:${pass};`;
      return `WIFI:T:${enc};S:${ssid};${passPart}H:${d.hidden ? "true" : "false"};;`;
    },
  },
  {
    id: "email",
    label: "Email",
    icon: Mail,
    fields: [
      { key: "to", label: "Kepada (email)", type: "email", placeholder: "nama@domain.com" },
      { key: "subject", label: "Subjek", type: "text", placeholder: "Subjek email" },
      { key: "body", label: "Isi Pesan", type: "textarea", rows: 3, placeholder: "Isi email otomatis…" },
    ],
    defaultData: { to: "", subject: "", body: "" },
    buildPayload: (d) => {
      const to = str(d, "to").replace(/\s+/g, "");
      if (!to) return "";
      const params: string[] = [];
      const subj = str(d, "subject");
      const body = str(d, "body");
      if (subj) params.push(`subject=${encodeURIComponent(subj)}`);
      if (body) params.push(`body=${encodeURIComponent(body)}`);
      return `mailto:${to}${params.length ? `?${params.join("&")}` : ""}`;
    },
  },
  {
    id: "phone",
    label: "Telepon",
    icon: Phone,
    fields: [{ key: "phone", label: "Nomor Telepon", type: "tel", placeholder: "+62812xxxxxxx" }],
    defaultData: { phone: "" },
    buildPayload: (d) => {
      const phone = sanitizePhone(raw(d, "phone"));
      return phone ? `tel:${phone}` : "";
    },
  },
  {
    id: "sms",
    label: "SMS",
    icon: MessageSquareText,
    fields: [
      { key: "phone", label: "Nomor Telepon", type: "tel", placeholder: "+62812xxxxxxx" },
      { key: "message", label: "Isi Pesan (opsional)", type: "textarea", rows: 3, placeholder: "Pesan yang akan terisi otomatis…" },
    ],
    defaultData: { phone: "", message: "" },
    buildPayload: (d) => {
      const phone = sanitizePhone(raw(d, "phone"));
      if (!phone) return "";
      const message = str(d, "message");
      return `SMSTO:${phone}:${message}`;
    },
    note: "Format SMSTO: dikenali luas oleh aplikasi kamera & pemindai bawaan HP.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    fields: [
      { key: "phone", label: "Nomor WhatsApp (kode negara, tanpa +)", type: "tel", placeholder: "62812xxxxxxx" },
      { key: "message", label: "Pesan Otomatis (opsional)", type: "textarea", rows: 3, placeholder: "Halo, saya ingin bertanya…" },
    ],
    defaultData: { phone: "", message: "" },
    buildPayload: (d) => {
      const phone = sanitizePhone(raw(d, "phone")).replace(/^\+/, "").replace(/\D/g, "");
      if (!phone) return "";
      const message = str(d, "message");
      return `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
    },
  },
  {
    id: "vcard",
    label: "Kontak",
    icon: UserCircle2,
    fields: [
      { key: "firstName", label: "Nama Depan", type: "text", half: true, placeholder: "Budi" },
      { key: "lastName", label: "Nama Belakang", type: "text", half: true, placeholder: "Santoso" },
      { key: "org", label: "Perusahaan", type: "text", half: true, placeholder: "PT Gamato Digital" },
      { key: "title", label: "Jabatan", type: "text", half: true, placeholder: "Manajer Pemasaran" },
      { key: "phoneMobile", label: "Telepon (HP)", type: "tel", half: true, placeholder: "+62812xxxxxxx" },
      { key: "phoneWork", label: "Telepon (Kantor)", type: "tel", half: true, placeholder: "+6221xxxxxxx" },
      { key: "email", label: "Email", type: "email", half: true, placeholder: "nama@domain.com" },
      { key: "website", label: "Website", type: "url", half: true, placeholder: "https://domain.com" },
      { key: "address", label: "Alamat", type: "text", placeholder: "Jl. Contoh No. 1, Jakarta" },
      { key: "note", label: "Catatan (opsional)", type: "textarea", rows: 2, placeholder: "Catatan tambahan…" },
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
    note: "Dipindai langsung tersimpan sebagai kontak baru di HP (format vCard 3.0).",
  },
  {
    id: "location",
    label: "Lokasi",
    icon: MapPin,
    fields: [
      { key: "lat", label: "Latitude", type: "text", half: true, placeholder: "-6.200000" },
      { key: "lng", label: "Longitude", type: "text", half: true, placeholder: "106.816666" },
      { key: "label", label: "Nama Lokasi (opsional)", type: "text", placeholder: "Monas, Jakarta" },
    ],
    defaultData: { lat: "", lng: "", label: "" },
    buildPayload: (d) => {
      const lat = sanitizeNumberString(raw(d, "lat"));
      const lng = sanitizeNumberString(raw(d, "lng"));
      if (!lat || !lng || isNaN(Number(lat)) || isNaN(Number(lng))) return "";
      const label = str(d, "label");
      return label ? `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})` : `geo:${lat},${lng}`;
    },
    note: "Dipindai langsung membuka aplikasi peta bawaan pada koordinat ini.",
  },
  {
    id: "calendar",
    label: "Event Kalender",
    icon: CalendarClock,
    fields: [
      { key: "title", label: "Judul Acara", type: "text", placeholder: "Rapat Tim Marketing" },
      { key: "startDate", label: "Tanggal Mulai", type: "date", half: true },
      { key: "startTime", label: "Jam Mulai", type: "time", half: true },
      { key: "endDate", label: "Tanggal Selesai", type: "date", half: true },
      { key: "endTime", label: "Jam Selesai", type: "time", half: true },
      { key: "location", label: "Lokasi (opsional)", type: "text", placeholder: "Ruang Rapat Lt. 3" },
      { key: "description", label: "Deskripsi (opsional)", type: "textarea", rows: 3, placeholder: "Detail acara…" },
    ],
    defaultData: { title: "", startDate: "", startTime: "09:00", endDate: "", endTime: "10:00", location: "", description: "" },
    buildPayload: (d) => {
      const title = str(d, "title");
      const dtStart = toIcalDateTime(raw(d, "startDate"), raw(d, "startTime"));
      if (!title || !dtStart) return "";
      const dtEnd = toIcalDateTime(raw(d, "endDate") || raw(d, "startDate"), raw(d, "endTime")) || dtStart;
      const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gamato Piranti//ID", "BEGIN:VEVENT"];
      lines.push(`SUMMARY:${icalEscape(title)}`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      if (str(d, "location")) lines.push(`LOCATION:${icalEscape(str(d, "location"))}`);
      if (str(d, "description")) lines.push(`DESCRIPTION:${icalEscape(str(d, "description"))}`);
      lines.push("END:VEVENT", "END:VCALENDAR");
      return lines.join("\n");
    },
    note: "Dipindai memunculkan opsi \"Tambah ke Kalender\" di HP.",
  },
  {
    id: "social",
    label: "Media Sosial",
    icon: Share2,
    fields: [
      {
        key: "platform", label: "Platform", type: "select",
        options: Object.entries(SOCIAL_PLATFORMS).map(([value, p]) => ({ value, label: p.label })),
      },
      { key: "username", label: "Username", type: "text", placeholder: "namamu (tanpa @)" },
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
    label: "Zoom Meeting",
    icon: Video,
    fields: [
      { key: "meetingId", label: "Meeting ID", type: "text", placeholder: "123 4567 8901" },
      { key: "passcode", label: "Passcode (opsional)", type: "text", placeholder: "abc123" },
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
    label: "FaceTime",
    icon: Apple,
    fields: [{ key: "target", label: "Nomor Telepon atau Email", type: "text", placeholder: "+62812xxxxxxx atau nama@icloud.com" }],
    defaultData: { target: "" },
    buildPayload: (d) => {
      const raw0 = str(d, "target");
      if (!raw0) return "";
      const target = raw0.includes("@") ? raw0 : sanitizePhone(raw0);
      return target ? `facetime:${target}` : "";
    },
    note: "Hanya berfungsi di perangkat Apple (iPhone/iPad/Mac).",
  },
  {
    id: "crypto",
    label: "Pembayaran Kripto",
    icon: Coins,
    fields: [
      { key: "coin", label: "Koin", type: "select", half: true, options: [{ value: "bitcoin", label: "Bitcoin (BTC)" }, { value: "ethereum", label: "Ethereum (ETH)" }] },
      { key: "amount", label: "Jumlah (opsional)", type: "text", half: true, placeholder: "0.001" },
      { key: "address", label: "Alamat Wallet", type: "text", placeholder: "Alamat wallet tujuan" },
    ],
    defaultData: { coin: "bitcoin", amount: "", address: "" },
    buildPayload: (d) => {
      const address = str(d, "address").replace(/\s+/g, "");
      if (!address) return "";
      const amount = sanitizeNumberString(raw(d, "amount"));
      const coin = raw(d, "coin") || "bitcoin";
      if (coin === "ethereum") {
        const wei = amount ? toSmallestUnit(amount, 18) : "";
        return `ethereum:${address}${wei ? `?value=${wei}` : ""}`;
      }
      return `bitcoin:${address}${amount ? `?amount=${amount}` : ""}`;
    },
    note: "Format BIP21 (Bitcoin) / ERC-681 (Ethereum) — dikenali dompet kripto populer.",
  },
  {
    id: "paypal",
    label: "PayPal.me",
    icon: Wallet,
    fields: [
      { key: "username", label: "Username PayPal.me", type: "text", half: true, placeholder: "namamu" },
      { key: "amount", label: "Jumlah (opsional)", type: "text", half: true, placeholder: "20" },
      { key: "currency", label: "Kode Mata Uang (opsional)", type: "text", placeholder: "USD" },
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

export function getQrTemplate(id: string): QrTemplateDef {
  return QR_TEMPLATES.find((t) => t.id === id) || QR_TEMPLATES[0];
}
