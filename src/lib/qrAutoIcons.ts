import type { QrFieldValues } from "@/lib/qrContentTemplates";

// ─── Original Gamato Piranti icon set ───────────────────────────────────────
// Every glyph here is an original, simplified pictogram Gamato Piranti draws
// itself (chat bubble, camera-frame, play triangle, briefcase, paper plane,
// etc.) representing the general CONCEPT of a content type or platform —
// never a reproduction of any company's actual trademarked logo mark. Colors
// are drawn from the same gradient palette already used across the app's own
// style presets, not copied from any brand's specific brand guidelines.

export interface AutoIconDef {
  id: string;
  label: string;
  from: string;
  to: string;
  /** Inner SVG markup (paths/shapes only) drawn in a 200x200 viewBox, white stroke/fill. */
  glyph: string;
}

const G = 200; // viewBox size, shared by every glyph below
const STROKE = `fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"`;

export const AUTO_ICONS: AutoIconDef[] = [
  { id: "url", label: "Tautan", from: "#4f46e5", to: "#6366f1", glyph: `<g transform="rotate(45 100 100)" ${STROKE}><rect x="55" y="80" width="50" height="40" rx="20"/><rect x="95" y="80" width="50" height="40" rx="20"/></g>` },
  { id: "text", label: "Teks", from: "#475569", to: "#64748b", glyph: `<g ${STROKE}><line x1="62" y1="78" x2="138" y2="78"/><line x1="62" y1="100" x2="138" y2="100"/><line x1="62" y1="122" x2="112" y2="122"/></g>` },
  { id: "wifi", label: "WiFi", from: "#0284c7", to: "#22d3ee", glyph: `<g ${STROKE}><path d="M65,118 A50,50 0 0,1 135,118"/><path d="M80,130 A30,30 0 0,1 120,130"/><path d="M93,142 A15,15 0 0,1 107,142"/></g><circle cx="100" cy="150" r="5" fill="#ffffff"/>` },
  { id: "email", label: "Email", from: "#2563eb", to: "#4f46e5", glyph: `<g ${STROKE}><rect x="55" y="68" width="90" height="64" rx="8"/><path d="M58,76 L100,110 L142,76"/></g>` },
  { id: "phone", label: "Telepon", from: "#059669", to: "#14b8a6", glyph: `<g ${STROKE}><rect x="73" y="52" width="54" height="96" rx="12"/><line x1="88" y1="64" x2="112" y2="64"/></g><circle cx="100" cy="135" r="4" fill="#ffffff"/>` },
  { id: "sms", label: "SMS", from: "#0d9488", to: "#22d3ee", glyph: `<path ${STROKE} d="M58,68 h84 a10,10 0 0 1 10,10 v42 a10,10 0 0 1 -10,10 h-52 l-18,18 v-18 h-14 a10,10 0 0 1 -10,-10 v-42 a10,10 0 0 1 10,-10 z"/><circle cx="82" cy="99" r="3.5" fill="#ffffff"/><circle cx="100" cy="99" r="3.5" fill="#ffffff"/><circle cx="118" cy="99" r="3.5" fill="#ffffff"/>` },
  { id: "whatsapp", label: "WhatsApp", from: "#16a34a", to: "#4ade80", glyph: `<path ${STROKE} d="M58,68 h84 a10,10 0 0 1 10,10 v42 a10,10 0 0 1 -10,10 h-52 l-18,18 v-18 h-14 a10,10 0 0 1 -10,-10 v-42 a10,10 0 0 1 10,-10 z"/><path ${STROKE} d="M80,99 l12,12 l28,-28"/>` },
  { id: "vcard", label: "Kontak", from: "#7c3aed", to: "#a855f7", glyph: `<g ${STROKE}><circle cx="100" cy="78" r="20"/><path d="M60,146 Q60,104 100,104 Q140,104 140,146"/></g>` },
  { id: "location", label: "Lokasi", from: "#e11d48", to: "#fb7185", glyph: `<g ${STROKE}><path d="M100,142 C100,142 64,104 64,79 A36,36 0 0,1 136,79 C136,104 100,142 100,142 Z"/><circle cx="100" cy="79" r="13"/></g>` },
  { id: "calendar", label: "Kalender", from: "#d97706", to: "#fbbf24", glyph: `<g ${STROKE}><rect x="54" y="62" width="92" height="82" rx="10"/><line x1="54" y1="88" x2="146" y2="88"/><line x1="80" y1="50" x2="80" y2="72"/><line x1="120" y1="50" x2="120" y2="72"/></g><circle cx="80" cy="112" r="4.5" fill="#ffffff"/><circle cx="100" cy="112" r="4.5" fill="#ffffff"/><circle cx="120" cy="112" r="4.5" fill="#ffffff"/>` },
  { id: "zoom", label: "Zoom", from: "#2563eb", to: "#38bdf8", glyph: `<rect x="54" y="74" width="62" height="52" rx="9" ${STROKE}/><path d="M116,90 L146,74 L146,126 L116,110 Z" fill="#ffffff" stroke="none"/>` },
  { id: "facetime", label: "FaceTime", from: "#334155", to: "#64748b", glyph: `<g ${STROKE}><rect x="54" y="58" width="92" height="82" rx="14"/><circle cx="100" cy="90" r="14"/><path d="M74,126 Q74,105 100,105 Q126,105 126,126"/></g>` },
  { id: "paypal", label: "Bayar", from: "#1d4ed8", to: "#3b82f6", glyph: `<g ${STROKE}><rect x="54" y="74" width="92" height="66" rx="10"/><path d="M54,90 h92"/><rect x="104" y="100" width="32" height="22" rx="4"/></g><circle cx="115" cy="111" r="2.5" fill="#ffffff"/>` },
  { id: "crypto-bitcoin", label: "Bitcoin", from: "#d97706", to: "#fbbf24", glyph: `<path ${STROKE} d="M74,68 Q126,68 126,90 Q126,100 100,100 Q126,100 126,122 Q126,144 74,144"/><line x1="90" y1="54" x2="90" y2="158" ${STROKE}/><line x1="112" y1="54" x2="112" y2="158" ${STROKE}/>` },
  { id: "crypto-ethereum", label: "Ethereum", from: "#4338ca", to: "#818cf8", glyph: `<path d="M100,52 L136,104 L100,126 L64,104 Z" ${STROKE}/><path d="M100,138 L136,112 L100,152 L64,112 Z" fill="#ffffff" stroke="none"/>` },
  { id: "social-instagram", label: "Instagram", from: "#ea580c", to: "#f472b6", glyph: `<rect x="54" y="58" width="92" height="82" rx="12" ${STROKE}/><circle cx="80" cy="84" r="8" fill="#ffffff" stroke="none"/><path d="M58,132 L90,100 L110,118 L132,94 L146,132" ${STROKE}/>` },
  { id: "social-tiktok", label: "TikTok", from: "#334155", to: "#ec4899", glyph: `<path d="M95,56 v58 a18,18 0 1 1 -11,-16.6" ${STROKE}/><path d="M95,56 q22,0 22,22 h-9 q0,-13 -13,-13 z" fill="#ffffff" stroke="none"/>` },
  { id: "social-x", label: "X", from: "#1e293b", to: "#475569", glyph: `<g ${STROKE}><line x1="68" y1="68" x2="132" y2="132"/><line x1="132" y1="68" x2="68" y2="132"/></g>` },
  { id: "social-facebook", label: "Facebook", from: "#2563eb", to: "#4f46e5", glyph: `<g ${STROKE}><circle cx="83" cy="96" r="23"/><circle cx="117" cy="96" r="23"/></g>` },
  { id: "social-youtube", label: "YouTube", from: "#dc2626", to: "#fb7185", glyph: `<rect x="54" y="70" width="92" height="60" rx="14" ${STROKE}/><path d="M90,90 L118,100 L90,110 Z" fill="#ffffff" stroke="none"/>` },
  { id: "social-linkedin", label: "LinkedIn", from: "#0369a1", to: "#38bdf8", glyph: `<g ${STROKE}><rect x="58" y="86" width="84" height="56" rx="8"/><path d="M84,86 v-13 a8,8 0 0 1 8,-8 h16 a8,8 0 0 1 8,8 v13"/><line x1="58" y1="112" x2="142" y2="112"/></g>` },
  { id: "social-telegram", label: "Telegram", from: "#0284c7", to: "#38bdf8", glyph: `<path d="M58,102 L142,64 L116,140 L95,106 L58,102 Z" fill="#ffffff" stroke="none"/><path d="M95,106 L142,64" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>` },
  { id: "social-threads", label: "Threads", from: "#475569", to: "#a855f7", glyph: `<g ${STROKE}><circle cx="86" cy="86" r="23"/><circle cx="114" cy="114" r="23"/></g>` },
];

const ICON_BY_ID: Record<string, AutoIconDef> = Object.fromEntries(AUTO_ICONS.map((i) => [i.id, i]));

export function getAutoIcon(id: string): AutoIconDef | undefined {
  return ICON_BY_ID[id];
}

/** Which built-in icon (if any) naturally matches a template + its current field data — e.g. the "social" template's icon follows whichever platform is currently selected. */
export function resolveAutoIconId(templateId: string, data: QrFieldValues): string | null {
  if (templateId === "social") {
    const platform = String(data.platform ?? "instagram");
    return ICON_BY_ID[`social-${platform}`] ? `social-${platform}` : "social-instagram";
  }
  if (templateId === "crypto") {
    const coin = String(data.coin ?? "bitcoin");
    return ICON_BY_ID[`crypto-${coin}`] ? `crypto-${coin}` : "crypto-bitcoin";
  }
  return ICON_BY_ID[templateId] ? templateId : null;
}

export function buildIconSvg(iconId: string): string | null {
  const icon = ICON_BY_ID[iconId];
  if (!icon) return null;
  const gradId = `g-${icon.id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${G}" height="${G}" viewBox="0 0 ${G} ${G}"><defs><linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${icon.from}"/><stop offset="1" stop-color="${icon.to}"/></linearGradient></defs><circle cx="100" cy="100" r="100" fill="url(#${gradId})"/>${icon.glyph}</svg>`;
}

export function iconSvgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function buildAutoIconDataUrl(iconId: string): string | null {
  const svg = buildIconSvg(iconId);
  return svg ? iconSvgToDataUrl(svg) : null;
}
