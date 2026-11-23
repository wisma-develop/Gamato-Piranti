import { tr } from "@/i18n";
import { sanitizeUrl } from "@/utils/sanitize";
import { gs1CheckDigit } from "@/lib/barcodeEngine";

export type ScanKind = "url" | "wifi" | "contact" | "calendar" | "email" | "phone" | "sms" | "geo" | "crypto" | "product" | "text";

export interface ParsedField { label: string; value: string; /** Disembunyikan sampai pengguna menekan "Tampilkan" (mis. password WiFi). */ secret?: boolean }
export interface ParsedAction {
  id: string;
  label: string;
  /** Tautan yang dibuka (hanya skema aman: http/https/mailto/tel/sms). */
  href?: string;
  /** Berkas yang diunduh dari isi pindaian (mis. .vcf / .ics). */
  file?: { name: string; mime: string; content: string };
}
export interface ParsedScan {
  kind: ScanKind;
  title: string;
  fields: ParsedField[];
  actions: ParsedAction[];
  warnings: string[];
  /** Hanya untuk kind "product": apakah digit cek GS1 valid (penanda mesin, bebas dari bahasa tampilan). */
  checkValid?: boolean;
}

const KIND_TITLE: Record<ScanKind, () => string> = {
  url: () => tr("Tautan Web"),
  wifi: () => tr("Jaringan WiFi"),
  contact: () => tr("Kontak"),
  calendar: () => tr("Acara Kalender"),
  email: () => tr("Email"),
  phone: () => tr("Nomor Telepon"),
  sms: () => tr("Pesan SMS"),
  geo: () => tr("Lokasi"),
  crypto: () => tr("Alamat Kripto"),
  product: () => tr("Kode Produk"),
  text: () => tr("Teks"),
};

const make = (kind: ScanKind, fields: ParsedField[] = [], actions: ParsedAction[] = [], warnings: string[] = []): ParsedScan =>
  ({ kind, title: KIND_TITLE[kind](), fields: fields.filter((f) => f.value !== ""), actions, warnings });

/** Pecah "a;b\;c;d" menjadi ["a","b;c","d"], menghormati escape backslash. */
function splitEscaped(s: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && i + 1 < s.length) { cur += s[++i]; continue; }
    if (ch === sep) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Baca isi QR WiFi (format ZXing): WIFI:T:WPA;S:ssid;P:pass;H:false;; — dengan unescape penuh. */
export function parseWifi(text: string): { ssid: string; password: string; enc: string; hidden: boolean } | null {
  if (!/^WIFI:/i.test(text)) return null;
  const parts = splitEscaped(text.slice(5), ";");
  const map: Record<string, string> = {};
  for (const p of parts) {
    const i = p.indexOf(":");
    if (i < 0) continue;
    map[p.slice(0, i).toUpperCase()] = p.slice(i + 1);
  }
  // Nilai yang tampak hex dibungkus tanda kutip oleh generator — buang pembungkusnya.
  const unq = (v = "") => (/^".*"$/.test(v) ? v.slice(1, -1) : v);
  const ssid = unq(map.S);
  if (!ssid) return null;
  return { ssid, password: unq(map.P), enc: (map.T || "nopass").toUpperCase(), hidden: /^true$/i.test(map.H || "") };
}

function unfold(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function vProps(lines: string[]): { name: string; params: string; value: string }[] {
  const out: { name: string; params: string; value: string }[] = [];
  for (const l of lines) {
    const colon = l.indexOf(":");
    if (colon < 0) continue;
    const head = l.slice(0, colon);
    const semi = head.indexOf(";");
    out.push({ name: (semi < 0 ? head : head.slice(0, semi)).toUpperCase(), params: semi < 0 ? "" : head.slice(semi + 1), value: l.slice(colon + 1) });
  }
  return out;
}
const vUnescape = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

/** 20260315T093000Z → "15 Mar 2026, 09.30 (UTC)" — tanpa ketergantungan zona waktu perangkat untuk nilai floating. */
export function formatIcalDate(v: string): string {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return v;
  const [, y, mo, d, h, mi, , z] = m;
  const date = `${d}/${mo}/${y}`;
  return h ? `${date} ${h}:${mi}${z ? " UTC" : ""}` : date;
}

const OSM = (lat: string, lng: string) => `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lng)}#map=17/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`;

function urlWarnings(u: URL): string[] {
  const w: string[] = [];
  if (u.protocol === "http:") w.push(tr("Tautan ini memakai http (tidak terenkripsi). Jangan masukkan password atau data pribadi."));
  if (/(^|\.)xn--/i.test(u.hostname)) w.push(tr("Domain memakai karakter internasional yang bisa menyerupai situs lain (homograf). Periksa alamatnya dengan teliti."));
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) w.push(tr("Tautan mengarah ke alamat IP, bukan nama domain — hati-hati."));
  if (u.username || u.password) w.push(tr("Tautan memuat nama pengguna/password di alamatnya — pola yang sering dipakai untuk penipuan."));
  if (/^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly|rebrand\.ly|s\.id)$/i.test(u.hostname)) w.push(tr("Ini tautan pendek; tujuan akhirnya tidak terlihat sebelum dibuka."));
  return w;
}

/** Terjemahkan teks hasil pindaian menjadi kartu informasi + aksi yang aman. */
export function parseScan(raw: string, format = ""): ParsedScan {
  const text = raw.trim();

  // WiFi
  const wifi = parseWifi(text);
  if (wifi) {
    return make("wifi", [
      { label: tr("Nama Jaringan (SSID)"), value: wifi.ssid },
      { label: tr("Keamanan"), value: wifi.enc === "NOPASS" ? tr("Terbuka (tanpa password)") : wifi.enc },
      { label: tr("Password"), value: wifi.password, secret: true },
      { label: tr("Jaringan tersembunyi"), value: wifi.hidden ? tr("Ya") : "" },
    ]);
  }

  // vCard / MeCard
  if (/^BEGIN:VCARD/i.test(text)) {
    const p = vProps(unfold(text));
    const first = (n: string) => p.find((x) => x.name === n)?.value;
    const all = (n: string) => p.filter((x) => x.name === n).map((x) => vUnescape(x.value));
    const name = vUnescape(first("FN") || (first("N") || "").split(";").filter(Boolean).reverse().join(" "));
    const adr = (first("ADR") || "").split(";").filter(Boolean).join(", ");
    return make("contact", [
      { label: tr("Nama"), value: name },
      { label: tr("Organisasi"), value: vUnescape(first("ORG") || "").replace(/;/g, ", ") },
      { label: tr("Jabatan"), value: vUnescape(first("TITLE") || "") },
      ...all("TEL").map((v) => ({ label: tr("Telepon"), value: v })),
      ...all("EMAIL").map((v) => ({ label: tr("Email"), value: v })),
      { label: tr("Situs"), value: vUnescape(first("URL") || "") },
      { label: tr("Alamat"), value: adr },
      { label: tr("Catatan"), value: vUnescape(first("NOTE") || "") },
    ], [{ id: "vcf", label: tr("Simpan Kontak (.vcf)"), file: { name: `${(name || "kontak").replace(/[^\w.-]+/g, "_")}.vcf`, mime: "text/vcard", content: text } }]);
  }
  if (/^MECARD:/i.test(text)) {
    const map: Record<string, string[]> = {};
    for (const part of splitEscaped(text.slice(7), ";")) {
      const i = part.indexOf(":");
      if (i > 0) (map[part.slice(0, i).toUpperCase()] ||= []).push(part.slice(i + 1));
    }
    const name = (map.N?.[0] || "").split(",").reverse().join(" ").trim();
    const vcf = ["BEGIN:VCARD", "VERSION:3.0", `FN:${name}`, ...(map.TEL || []).map((t) => `TEL:${t}`), ...(map.EMAIL || []).map((t) => `EMAIL:${t}`), "END:VCARD"].join("\r\n");
    return make("contact", [
      { label: tr("Nama"), value: name },
      ...(map.TEL || []).map((v) => ({ label: tr("Telepon"), value: v })),
      ...(map.EMAIL || []).map((v) => ({ label: tr("Email"), value: v })),
      { label: tr("Alamat"), value: map.ADR?.[0] || "" },
    ], [{ id: "vcf", label: tr("Simpan Kontak (.vcf)"), file: { name: `${(name || "kontak").replace(/[^\w.-]+/g, "_")}.vcf`, mime: "text/vcard", content: vcf } }]);
  }

  // Kalender
  if (/^BEGIN:VCALENDAR/i.test(text) || /^BEGIN:VEVENT/i.test(text)) {
    const p = vProps(unfold(text));
    const first = (n: string) => p.find((x) => x.name === n)?.value;
    const ics = /^BEGIN:VCALENDAR/i.test(text) ? text : ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gamato Piranti//ID", text, "END:VCALENDAR"].join("\r\n");
    return make("calendar", [
      { label: tr("Judul"), value: vUnescape(first("SUMMARY") || "") },
      { label: tr("Mulai"), value: formatIcalDate(first("DTSTART") || "") },
      { label: tr("Selesai"), value: formatIcalDate(first("DTEND") || "") },
      { label: tr("Lokasi"), value: vUnescape(first("LOCATION") || "") },
      { label: tr("Deskripsi"), value: vUnescape(first("DESCRIPTION") || "") },
    ], [{ id: "ics", label: tr("Tambah ke Kalender (.ics)"), file: { name: "acara.ics", mime: "text/calendar", content: ics } }]);
  }

  // mailto
  if (/^mailto:/i.test(text)) {
    const [addr, query = ""] = text.slice(7).split("?");
    const q = new URLSearchParams(query);
    const to = decodeURIComponent(addr || "");
    return make("email", [
      { label: tr("Kepada"), value: to },
      { label: tr("Subjek"), value: q.get("subject") || "" },
      { label: tr("Isi"), value: q.get("body") || "" },
    ], [{ id: "mail", label: tr("Tulis Email"), href: `mailto:${encodeURI(to)}${query ? `?${query}` : ""}` }]);
  }

  // tel
  if (/^tel:/i.test(text)) {
    const num = text.slice(4).trim();
    return make("phone", [{ label: tr("Nomor"), value: num }], [{ id: "call", label: tr("Telepon"), href: `tel:${num.replace(/[^\d+*#,;]/g, "")}` }]);
  }

  // SMS
  const sms = text.match(/^(?:smsto|sms|mmsto|mms):([^:?]*)[:?](.*)$/is) || text.match(/^(?:smsto|sms|mmsto|mms):([^:?]*)$/i);
  if (sms) {
    const num = (sms[1] || "").trim();
    const body = (sms[2] || "").replace(/^body=/i, "");
    return make("sms", [{ label: tr("Nomor"), value: num }, { label: tr("Pesan"), value: body }],
      [{ id: "sms", label: tr("Kirim SMS"), href: `sms:${num.replace(/[^\d+]/g, "")}${body ? `?body=${encodeURIComponent(body)}` : ""}` }]);
  }

  // geo
  const geo = text.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[?;].*)?$/i);
  if (geo) {
    const lat = geo[1], lng = geo[2];
    const label = decodeURIComponent((text.match(/\(([^)]*)\)/) || [])[1] || "");
    return make("geo", [{ label: tr("Latitude"), value: lat }, { label: tr("Longitude"), value: lng }, { label: tr("Label"), value: label }],
      [{ id: "map", label: tr("Buka di Peta"), href: OSM(lat, lng) }]);
  }

  // Kripto
  const crypto = text.match(/^(bitcoin|ethereum|litecoin|dogecoin|bitcoincash):([^?]+)(?:\?(.*))?$/i);
  if (crypto) {
    const q = new URLSearchParams(crypto[3] || "");
    return make("crypto", [
      { label: tr("Koin"), value: crypto[1] },
      { label: tr("Alamat"), value: crypto[2] },
      { label: tr("Jumlah"), value: q.get("amount") || q.get("value") || "" },
      { label: tr("Label"), value: q.get("label") || q.get("message") || "" },
    ], [], [tr("Periksa ulang alamat dompet sebelum mengirim — transaksi kripto tidak bisa dibatalkan.")]);
  }

  // URL
  if (!/\s/.test(text)) {
    const safe = sanitizeUrl(text);
    if (safe) {
      const u = new URL(safe);
      return make("url", [
        { label: tr("Domain"), value: u.hostname },
        { label: tr("Alamat Lengkap"), value: text },
      ], [{ id: "open", label: tr("Buka Link"), href: safe }], urlWarnings(u));
    }
  }

  // Kode produk (angka) — validasi digit cek GS1
  if (/^\d+$/.test(text) && [8, 12, 13, 14].includes(text.length) && /ean|upc|itf/i.test(format || "")) {
    const kind = text.length === 8 ? "EAN-8" : text.length === 12 ? "UPC-A" : text.length === 13 ? "EAN-13" : "GTIN-14";
    const valid = gs1CheckDigit(text.slice(0, -1)) === Number(text[text.length - 1]);
    const product = make("product", [
      { label: tr("Jenis"), value: kind },
      { label: tr("Kode"), value: text },
      { label: tr("Digit cek"), value: valid ? tr("Valid ✓") : tr("TIDAK valid — kode kemungkinan salah baca atau palsu") },
    ]);
    product.checkValid = valid;
    return product;
  }

  return make("text", [{ label: tr("Isi"), value: text }]);
}
