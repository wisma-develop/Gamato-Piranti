// Pustaka koordinat murni (tanpa dependensi): format DD/DMS/DDM, UTM, MGRS, Plus Code (OLC),
// Geohash, Maidenhead, Web Mercator & ubin XYZ — plus parser fleksibel untuk semua format itu.
// Semua dihitung offline di browser dan diverifikasi terhadap pustaka referensi (pyproj, openlocationcode, …).

export interface LatLng { lat: number; lng: number }

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const normLng = (l: number) => ((((l + 180) % 360) + 360) % 360) - 180;
export const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;

// ── Format teks ──────────────────────────────────────────────────────────

export function fmtDD(p: LatLng, dec = 6): string {
  return `${p.lat.toFixed(dec)}, ${p.lng.toFixed(dec)}`;
}

function split(v: number) {
  const a = Math.abs(v);
  const d = Math.floor(a);
  const mFull = (a - d) * 60;
  const m = Math.floor(mFull);
  const s = (mFull - m) * 60;
  return { d, m, s, mFull };
}

export function fmtDMSOne(v: number, isLat: boolean, dec = 2): string {
  const { d, m, s } = split(v);
  let ss = s.toFixed(dec), mm = m, dd = d;
  if (parseFloat(ss) >= 60) { ss = (0).toFixed(dec); mm += 1; }
  if (mm >= 60) { mm = 0; dd += 1; }
  const h = isLat ? (v < 0 ? "S" : "N") : v < 0 ? "W" : "E";
  return `${dd}°${String(mm).padStart(2, "0")}'${ss.padStart(dec ? dec + 3 : 2, "0")}"${h}`;
}
export const fmtDMS = (p: LatLng, dec = 2) => `${fmtDMSOne(p.lat, true, dec)} ${fmtDMSOne(p.lng, false, dec)}`;

export function fmtDDMOne(v: number, isLat: boolean, dec = 4): string {
  const { d, mFull } = split(v);
  let mm = mFull.toFixed(dec), dd = d;
  if (parseFloat(mm) >= 60) { mm = (0).toFixed(dec); dd += 1; }
  const h = isLat ? (v < 0 ? "S" : "N") : v < 0 ? "W" : "E";
  return `${dd}°${mm.padStart(dec ? dec + 3 : 2, "0")}'${h}`;
}
export const fmtDDM = (p: LatLng, dec = 4) => `${fmtDDMOne(p.lat, true, dec)} ${fmtDDMOne(p.lng, false, dec)}`;

// ── Web Mercator & ubin ──────────────────────────────────────────────────

const R_MERC = 6378137;
export function toWebMercator(p: LatLng): { x: number; y: number } {
  const lat = clamp(p.lat, -85.0511287798, 85.0511287798);
  return { x: R_MERC * rad(p.lng), y: R_MERC * Math.log(Math.tan(Math.PI / 4 + rad(lat) / 2)) };
}
export function fromWebMercator(x: number, y: number): LatLng {
  return { lat: deg(2 * Math.atan(Math.exp(y / R_MERC)) - Math.PI / 2), lng: deg(x / R_MERC) };
}
export function tileXY(p: LatLng, z: number): { x: number; y: number } {
  const lat = clamp(p.lat, -85.0511287798, 85.0511287798);
  const n = 2 ** z;
  const x = Math.floor(((p.lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad(lat)) + 1 / Math.cos(rad(lat))) / Math.PI) / 2) * n);
  return { x: clamp(x, 0, n - 1), y: clamp(y, 0, n - 1) };
}

// ── UTM (deret Krüger, akurasi sub-milimeter) ────────────────────────────

const WGS = { a: 6378137, f: 1 / 298.257223563 };
const BANDS = "CDEFGHJKLMNPQRSTUVWX";

export interface UTM { zone: number; band: string; hemisphere: "N" | "S"; easting: number; northing: number }

export function utmZoneOf(lat: number, lng: number): number {
  let zone = Math.floor((normLng(lng) + 180) / 6) + 1;
  if (lat >= 56 && lat < 64 && lng >= 3 && lng < 12) zone = 32; // Norwegia
  if (lat >= 72 && lat < 84) {
    if (lng >= 0 && lng < 9) zone = 31;
    else if (lng >= 9 && lng < 21) zone = 33;
    else if (lng >= 21 && lng < 33) zone = 35;
    else if (lng >= 33 && lng < 42) zone = 37;
  }
  return zone;
}

export function toUTM(p: LatLng, forceZone?: number): UTM {
  if (p.lat < -80 || p.lat > 84) throw new Error("UTM hanya berlaku untuk lintang −80° s/d 84° (gunakan UPS di kutub).");
  const zone = forceZone ?? utmZoneOf(p.lat, p.lng);
  const lam0 = rad((zone - 1) * 6 - 180 + 3);
  const phi = rad(p.lat);
  const lam = rad(normLng(p.lng)) - lam0;
  const { a, f } = WGS;
  const k0 = 0.9996;
  const e = Math.sqrt(f * (2 - f));
  const n = f / (2 - f);
  const n2 = n * n, n3 = n * n2, n4 = n * n3, n5 = n * n4, n6 = n * n5;
  const cosl = Math.cos(lam), sinl = Math.sin(lam);
  const tau = Math.tan(phi);
  const sigma = Math.sinh(e * Math.atanh((e * tau) / Math.sqrt(1 + tau * tau)));
  const taup = tau * Math.sqrt(1 + sigma * sigma) - sigma * Math.sqrt(1 + tau * tau);
  const xip = Math.atan2(taup, cosl);
  const etap = Math.asinh(sinl / Math.sqrt(taup * taup + cosl * cosl));
  const A = (a / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
  const alpha = [0, n / 2 - (2 * n2) / 3 + (5 * n3) / 16 + (41 * n4) / 180 - (127 * n5) / 288 + (7891 * n6) / 37800,
    (13 * n2) / 48 - (3 * n3) / 5 + (557 * n4) / 1440 + (281 * n5) / 630 - (1983433 * n6) / 1935360,
    (61 * n3) / 240 - (103 * n4) / 140 + (15061 * n5) / 26880 + (167603 * n6) / 181440,
    (49561 * n4) / 161280 - (179 * n5) / 168 + (6601661 * n6) / 7257600,
    (34729 * n5) / 80640 - (3418889 * n6) / 1995840,
    (212378941 * n6) / 319334400];
  let xi = xip, eta = etap;
  for (let j = 1; j <= 6; j++) {
    xi += alpha[j] * Math.sin(2 * j * xip) * Math.cosh(2 * j * etap);
    eta += alpha[j] * Math.cos(2 * j * xip) * Math.sinh(2 * j * etap);
  }
  let x = k0 * A * eta + 500e3;
  let y = k0 * A * xi;
  if (y < 0) y += 10000e3;
  const band = BANDS.charAt(Math.min(19, Math.floor(clamp(p.lat, -80, 84) / 8 + 10)));
  return { zone, band, hemisphere: p.lat >= 0 ? "N" : "S", easting: x, northing: y };
}

export function fromUTM(u: { zone: number; hemisphere: "N" | "S"; easting: number; northing: number }): LatLng {
  const { zone, hemisphere } = u;
  const x = u.easting - 500e3;
  const y = hemisphere === "S" ? u.northing - 10000e3 : u.northing;
  const { a, f } = WGS;
  const k0 = 0.9996;
  const e = Math.sqrt(f * (2 - f));
  const n = f / (2 - f);
  const n2 = n * n, n3 = n * n2, n4 = n * n3, n5 = n * n4, n6 = n * n5;
  const A = (a / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
  const eta = x / (k0 * A), xi = y / (k0 * A);
  const beta = [0, n / 2 - (2 * n2) / 3 + (37 * n3) / 96 - n4 / 360 - (81 * n5) / 512 + (96199 * n6) / 604800,
    n2 / 48 + n3 / 15 - (437 * n4) / 1440 + (46 * n5) / 105 - (1118711 * n6) / 3870720,
    (17 * n3) / 480 - (37 * n4) / 840 - (209 * n5) / 4480 + (5569 * n6) / 90720,
    (4397 * n4) / 161280 - (11 * n5) / 504 - (830251 * n6) / 7257600,
    (4583 * n5) / 161280 - (108847 * n6) / 3991680,
    (20648693 * n6) / 638668800];
  let xip = xi, etap = eta;
  for (let j = 1; j <= 6; j++) {
    xip -= beta[j] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etap -= beta[j] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const sinhe = Math.sinh(etap), cosxi = Math.cos(xip), sinxi = Math.sin(xip);
  const taup = sinxi / Math.sqrt(sinhe * sinhe + cosxi * cosxi);
  let tau = taup, d = 0, it = 0;
  do {
    const sigma = Math.sinh(e * Math.atanh((e * tau) / Math.sqrt(1 + tau * tau)));
    const taupi = tau * Math.sqrt(1 + sigma * sigma) - sigma * Math.sqrt(1 + tau * tau);
    d = ((taup - taupi) / Math.sqrt(1 + taupi * taupi)) * ((1 + (1 - e * e) * tau * tau) / ((1 - e * e) * Math.sqrt(1 + tau * tau)));
    tau += d;
  } while (Math.abs(d) > 1e-12 && ++it < 20);
  const phi = Math.atan(tau);
  const lam = Math.atan2(sinhe, cosxi) + rad((zone - 1) * 6 - 180 + 3);
  return { lat: deg(phi), lng: normLng(deg(lam)) };
}

export function fmtUTM(p: LatLng, dec = 0): string {
  const u = toUTM(p);
  return `${u.zone}${u.band} ${u.easting.toFixed(dec)} ${u.northing.toFixed(dec)}`;
}

// ── MGRS ─────────────────────────────────────────────────────────────────

const E100K = ["ABCDEFGH", "JKLMNPQR", "STUVWXYZ"];
const N100K = ["ABCDEFGHJKLMNPQRSTUV", "FGHJKLMNPQRSTUVABCDE"];

export function toMGRS(p: LatLng, digits = 5): string {
  const u = toUTM(p);
  const col = Math.floor(u.easting / 100e3);
  const row = Math.floor(u.northing / 100e3) % 20;
  const e100 = E100K[(u.zone - 1) % 3].charAt(col - 1);
  const n100 = N100K[(u.zone - 1) % 2].charAt(row);
  const f = 10 ** (5 - digits);
  const e = String(Math.floor((u.easting % 100e3) / f)).padStart(digits, "0");
  const n = String(Math.floor((u.northing % 100e3) / f)).padStart(digits, "0");
  return `${u.zone}${u.band}${e100}${n100}${digits ? " " + e + " " + n : ""}`.trim();
}

export function fromMGRS(str: string): LatLng | null {
  const s = str.replace(/\s+/g, "").toUpperCase();
  const m = /^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])(\d*)$/.exec(s);
  if (!m || m[5].length % 2 === 1 || m[5].length > 10) return null;
  const zone = parseInt(m[1], 10);
  if (zone < 1 || zone > 60) return null;
  const band = m[2];
  const colIdx = E100K[(zone - 1) % 3].indexOf(m[3]);
  const rowIdx = N100K[(zone - 1) % 2].indexOf(m[4]);
  if (colIdx < 0 || rowIdx < 0) return null;
  const half = m[5].length / 2;
  const f = 10 ** (5 - half);
  const ePart = half ? parseInt(m[5].slice(0, half), 10) * f : 0;
  const nPart = half ? parseInt(m[5].slice(half), 10) * f : 0;
  const easting = (colIdx + 1) * 100e3 + ePart + (half ? f / 2 : 0);
  const hemisphere: "N" | "S" = BANDS.indexOf(band) >= 10 ? "N" : "S";
  // lintang tengah pita → perkiraan northing untuk memilih siklus 2000 km yang benar
  const bi = BANDS.indexOf(band);
  const midLat = bi === 19 ? 78 : -80 + bi * 8 + 4;
  const n0 = toUTM({ lat: midLat, lng: (zone - 1) * 6 - 180 + 3 }, zone).northing;
  const base = rowIdx * 100e3 + nPart + (half ? f / 2 : 0);
  let best = base, bd = Infinity;
  for (let k = 0; k < 6; k++) {
    const cand = base + k * 2000e3;
    if (Math.abs(cand - n0) < bd) { bd = Math.abs(cand - n0); best = cand; }
  }
  return fromUTM({ zone, hemisphere, easting, northing: best });
}

// ── Plus Code (Open Location Code) ───────────────────────────────────────

const OLC_ALPHA = "23456789CFGHJMPQRVWX";
const OLC_SEP = "+";
const PAIR_PREC = 8000, GRID_ROWS = 5, GRID_COLS = 4;
const FINAL_LAT = PAIR_PREC * GRID_ROWS ** 5; // 25.000.000
const FINAL_LNG = PAIR_PREC * GRID_COLS ** 5; // 8.192.000

export function toPlusCode(p: LatLng, length = 10): string {
  length = Math.max(2, Math.min(15, length));
  if (length < 10 && length % 2 === 1) length -= 1;
  let lat = clamp(p.lat, -90, 90);
  const lng = normLng(p.lng);
  const latPrecision = length <= 10 ? 20 ** (2 - length / 2) : 1 / (PAIR_PREC * GRID_ROWS ** (length - 10));
  if (lat === 90) lat -= latPrecision / 2;
  let latVal = Math.floor(Math.round((lat + 90) * FINAL_LAT * 1e6) / 1e6);
  let lngVal = Math.floor(Math.round((lng + 180) * FINAL_LNG * 1e6) / 1e6);
  let code = "";
  if (length > 10) {
    for (let i = 0; i < 5; i++) {
      const ld = latVal % GRID_ROWS, gd = lngVal % GRID_COLS;
      code = OLC_ALPHA.charAt(ld * GRID_COLS + gd) + code;
      latVal = Math.floor(latVal / GRID_ROWS);
      lngVal = Math.floor(lngVal / GRID_COLS);
    }
  } else {
    latVal = Math.floor(latVal / GRID_ROWS ** 5);
    lngVal = Math.floor(lngVal / GRID_COLS ** 5);
  }
  for (let i = 0; i < 5; i++) {
    code = OLC_ALPHA.charAt(lngVal % 20) + code;
    code = OLC_ALPHA.charAt(latVal % 20) + code;
    latVal = Math.floor(latVal / 20);
    lngVal = Math.floor(lngVal / 20);
  }
  const full = code.slice(0, 8) + OLC_SEP + code.slice(8);
  if (length >= 10) return full.slice(0, length + 1);
  return full.slice(0, length) + "0".repeat(8 - length) + OLC_SEP;
}

export function isPlusCode(s: string): boolean {
  const c = s.trim().toUpperCase();
  const i = c.indexOf(OLC_SEP);
  if (i < 0 || i !== c.lastIndexOf(OLC_SEP) || i > 8 || i % 2 === 1) return false;
  return /^[0-9A-Z]+\+[0-9A-Z]*$/.test(c) && [...c.replace(OLC_SEP, "").replace(/0+$/, "")].every((ch) => OLC_ALPHA.includes(ch));
}

/** Dekode Plus Code lengkap; kode pendek (mis. "VP3+PR") butuh `ref` (pusat peta). */
export function fromPlusCode(code: string, ref?: LatLng): (LatLng & { latLo: number; latHi: number; lngLo: number; lngHi: number }) | null {
  let c = code.trim().toUpperCase();
  if (!isPlusCode(c)) return null;
  const sepIdx = c.indexOf(OLC_SEP);
  if (sepIdx < 8) {
    // kode pendek: pulihkan awalan dari titik acuan
    if (!ref) return null;
    const padLen = 8 - sepIdx;
    const resolution = 20 ** (2 - padLen / 2);
    const prefix = toPlusCode(ref, 8).slice(0, padLen);
    c = prefix + c;
    const area = decodeFull(c);
    if (!area) return null;
    const half = resolution / 2;
    let lat = area.lat, lng = area.lng;
    if (lat + half < ref.lat && lat + resolution <= 90) lat += resolution;
    else if (lat - half > ref.lat && lat - resolution >= -90) lat -= resolution;
    if (lng + half < ref.lng) lng += resolution;
    else if (lng - half > ref.lng) lng -= resolution;
    return { ...area, lat, lng, latLo: area.latLo + (lat - area.lat), latHi: area.latHi + (lat - area.lat), lngLo: area.lngLo + (lng - area.lng), lngHi: area.lngHi + (lng - area.lng) };
  }
  return decodeFull(c);
}

function decodeFull(c: string) {
  const s = c.replace(OLC_SEP, "").replace(/0+$/, "");
  if (s.length < 2) return null;
  const s15 = s.slice(0, 15);
  let latLo = 0, lngLo = 0;
  let latRes = 400, lngRes = 400;
  const pair = Math.min(s15.length, 10);
  for (let i = 0; i < pair; i += 2) {
    latRes /= 20; lngRes /= 20;
    latLo += OLC_ALPHA.indexOf(s15[i]) * latRes;
    lngLo += OLC_ALPHA.indexOf(s15[i + 1] ?? "2") * lngRes;
  }
  latLo -= 90; lngLo -= 180;
  let latH = latRes, lngH = lngRes;
  if (s15.length > 10) {
    let la = 0, ln = 0;
    let lr = 1 / PAIR_PREC, gr = 1 / PAIR_PREC;
    for (let i = 10; i < s15.length; i++) {
      lr /= GRID_ROWS; gr /= GRID_COLS;
      const idx = OLC_ALPHA.indexOf(s15[i]);
      la += Math.floor(idx / GRID_COLS) * lr;
      ln += (idx % GRID_COLS) * gr;
    }
    latLo += la; lngLo += ln;
    latH = lr; lngH = gr;
  }
  const latHi = latLo + latH, lngHi = lngLo + lngH;
  return { lat: (latLo + latHi) / 2, lng: (lngLo + lngHi) / 2, latLo, latHi, lngLo, lngHi };
}

// ── Geohash ──────────────────────────────────────────────────────────────

const GH = "0123456789bcdefghjkmnpqrstuvwxyz";
export function toGeohash(p: LatLng, precision = 9): string {
  let latR: [number, number] = [-90, 90], lngR: [number, number] = [-180, 180];
  let bits = 0, ch = 0, even = true, out = "";
  const lng = normLng(p.lng), lat = clamp(p.lat, -90, 90);
  while (out.length < precision) {
    const r = even ? lngR : latR;
    const v = even ? lng : lat;
    const mid = (r[0] + r[1]) / 2;
    if (v >= mid) { ch = (ch << 1) | 1; r[0] = mid; } else { ch <<= 1; r[1] = mid; }
    even = !even;
    if (++bits === 5) { out += GH[ch]; bits = 0; ch = 0; }
  }
  return out;
}
export function fromGeohash(h: string): (LatLng & { latLo: number; latHi: number; lngLo: number; lngHi: number }) | null {
  const s = h.trim().toLowerCase();
  if (!s || [...s].some((c) => !GH.includes(c))) return null;
  let latR: [number, number] = [-90, 90], lngR: [number, number] = [-180, 180], even = true;
  for (const c of s) {
    const v = GH.indexOf(c);
    for (let b = 4; b >= 0; b--) {
      const r = even ? lngR : latR;
      const mid = (r[0] + r[1]) / 2;
      if ((v >> b) & 1) r[0] = mid; else r[1] = mid;
      even = !even;
    }
  }
  return { lat: (latR[0] + latR[1]) / 2, lng: (lngR[0] + lngR[1]) / 2, latLo: latR[0], latHi: latR[1], lngLo: lngR[0], lngHi: lngR[1] };
}

// ── Maidenhead ───────────────────────────────────────────────────────────

export function toMaidenhead(p: LatLng, pairs = 3): string {
  let lng = normLng(p.lng) + 180, lat = clamp(p.lat, -90, 89.999999) + 90;
  let out = "";
  const A = "ABCDEFGHIJKLMNOPQRSTUVWX";
  const a = "abcdefghijklmnopqrstuvwx";
  out += A[Math.floor(lng / 20)] + A[Math.floor(lat / 10)];
  lng %= 20; lat %= 10;
  if (pairs >= 2) { out += Math.floor(lng / 2) + "" + Math.floor(lat / 1); lng %= 2; lat %= 1; }
  if (pairs >= 3) { out += a[Math.floor(lng / (2 / 24))] + a[Math.floor(lat / (1 / 24))]; lng %= 2 / 24; lat %= 1 / 24; }
  if (pairs >= 4) { out += Math.floor(lng / (2 / 240)) + "" + Math.floor(lat / (1 / 240)); }
  return out;
}
export function fromMaidenhead(s: string): LatLng | null {
  const c = s.trim();
  if (!/^[A-Ra-r]{2}(\d{2}([A-Xa-x]{2}(\d{2})?)?)?$/.test(c)) return null;
  const U = c.toUpperCase();
  let lng = (U.charCodeAt(0) - 65) * 20 - 180;
  let lat = (U.charCodeAt(1) - 65) * 10 - 90;
  let w = 20, h = 10;
  if (U.length >= 4) { lng += +U[2] * 2; lat += +U[3]; w = 2; h = 1; }
  if (U.length >= 6) { lng += (U.charCodeAt(4) - 65) * (2 / 24); lat += (U.charCodeAt(5) - 65) * (1 / 24); w = 2 / 24; h = 1 / 24; }
  if (U.length >= 8) { lng += +U[6] * (2 / 240); lat += +U[7] * (1 / 240); w = 2 / 240; h = 1 / 240; }
  return { lat: lat + h / 2, lng: lng + w / 2 };
}

// ── Parser fleksibel ─────────────────────────────────────────────────────

export type ParsedKind = "dd" | "dms" | "ddm" | "utm" | "mgrs" | "pluscode" | "geohash" | "maidenhead" | "url" | "geo";
export interface Parsed extends LatLng { kind: ParsedKind }

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

function parseUrl(s: string): Parsed | null {
  const t = decodeURIComponent(s.replace(/\+/g, " "));
  const pats: RegExp[] = [/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, /[?&](?:q|ll|query|center|destination|daddr|sll)=(-?\d+(?:\.\d+)?)[, ]\s*(-?\d+(?:\.\d+)?)/, /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/, /[?&]mlat=(-?\d+(?:\.\d+)?)&mlon=(-?\d+(?:\.\d+)?)/, /[?&]lat=(-?\d+(?:\.\d+)?)&lon=(-?\d+(?:\.\d+)?)/];
  for (const re of pats) {
    const m = re.exec(t);
    if (m && valid(+m[1], +m[2])) return { lat: +m[1], lng: +m[2], kind: "url" };
  }
  return null;
}

/** Satu komponen (lintang atau bujur): derajat, menit, detik opsional + huruf mata angin. */
function parseComponent(raw: string): { value: number; hemi: "lat" | "lng" | null; parts: number; hasMinSec: boolean } | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/[º˚]/g, "°").replace(/[′’‘`´]/g, "'").replace(/[″”“]/g, '"').replace(/''/g, '"');
  let hemi: "lat" | "lng" | null = null;
  let neg = false;
  // huruf mata angin (depan/belakang), termasuk istilah Indonesia LS/LU/BT/BB
  const re = /(^|[^A-Za-z])(LS|LU|BT|BB|N|S|E|W|U|T|B)(?![A-Za-z])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const h = m[2].toUpperCase();
    if (h === "S" || h === "LS") { hemi = "lat"; neg = true; }
    else if (h === "N" || h === "LU" || h === "U") { hemi = "lat"; }
    else if (h === "W" || h === "BB" || h === "B") { hemi = "lng"; neg = true; }
    else if (h === "E" || h === "BT" || h === "T") { hemi = "lng"; }
  }
  s = s.replace(re, "$1 ");
  const nums = s.match(/-?\d+(?:[.,]\d+)?/g);
  if (!nums || nums.length > 3) return null;
  const vals = nums.map((n) => parseFloat(n.replace(",", ".")));
  if (s.replace(/-?\d+(?:[.,]\d+)?|[°'" \t]/g, "").trim() !== "") return null; // karakter asing
  const signNeg = nums[0].startsWith("-");
  let v = Math.abs(vals[0]);
  const hasMinSec = vals.length > 1;
  if (vals[1] !== undefined) { if (vals[1] < 0 || vals[1] >= 60) return null; v += vals[1] / 60; }
  if (vals[2] !== undefined) { if (vals[2] < 0 || vals[2] >= 60) return null; v += vals[2] / 3600; }
  return { value: signNeg || neg ? -v : v, hemi, parts: vals.length, hasMinSec };
}

function parseLatLngPair(input: string): Parsed | null {
  let s = input.trim().replace(/[\u00A0]/g, " ").replace(/[()[\]{}]/g, " ").replace(/\b(?:latitude|longitude|lat|lng|lon|long)\b\s*[:=]?/gi, " ").replace(/\s+/g, " ").trim();
  // pisahkan: ';' → '/' → huruf mata angin → koma → spasi
  let parts: string[] | null = null;
  if (/;/.test(s)) parts = s.split(/;/);
  else if (/\|/.test(s)) parts = s.split(/\|/);
  else {
    const lead = /^\s*([NSEWnsew])\b(?=[^A-Za-z]*\d)(.*?)\s+([NSEWnsew])\b(?=[^A-Za-z]*\d)(.*)$/.exec(s);
    const hm = lead ? [s, `${lead[1]}${lead[2]}`, `${lead[3]}${lead[4]}`] : /^(.*?[NSns]|.*?\bL[SU]\b)[\s,]+(.*)$/i.exec(s);
    if (hm && /[EWew]|\bB[TB]\b/i.test(hm[2]) && /\d/.test(hm[1]) && /\d/.test(hm[2])) parts = [hm[1], hm[2]];
    else if ((s.match(/,/g) || []).length === 1 && /\d\s*,\s*[-+]?\s*[NSEWnsew]?\s*\d|\d\s*[NSEWnsew]?\s*,\s*[-+]?\s*\d/.test(s) && !/^\s*-?\d+,\d+\s+-?\d+,\d+\s*$/.test(s)) parts = s.split(",");
    else if ((s.match(/,/g) || []).length >= 3) { const c = s.split(","); if (c.length % 2 === 0) parts = [c.slice(0, c.length / 2).join(","), c.slice(c.length / 2).join(",")]; }
    if (!parts) {
      // dua token numerik berpemisah spasi (DD), mis. "-6.2088 106.8456" atau "-6,2088 106,8456"
      const t = s.split(/\s+/).filter(Boolean);
      if (t.length === 2) parts = t;
    }
  }
  if (!parts || parts.length !== 2) return null;
  const a = parseComponent(parts[0]), b = parseComponent(parts[1]);
  if (!a || !b) return null;
  let lat = a, lng = b;
  if (a.hemi === "lng" || b.hemi === "lat") { lat = b; lng = a; }
  else if (a.hemi === null && b.hemi === null && Math.abs(a.value) > 90 && Math.abs(b.value) <= 90) { lat = b; lng = a; }
  if (lat.hemi === "lng" || lng.hemi === "lat") return null;
  if (!valid(lat.value, lng.value)) return null;
  const kind: ParsedKind = lat.parts === 3 || lng.parts === 3 ? "dms" : lat.parts === 2 || lng.parts === 2 ? "ddm" : "dd";
  return { lat: lat.value, lng: lng.value, kind };
}

function parseUTMString(input: string): Parsed | null {
  const m = /^\s*(\d{1,2})\s*([C-HJ-NP-X]|[NS])?\s+(\d+(?:\.\d+)?)\s*(?:m?\s*E)?[\s,;]+(\d+(?:\.\d+)?)\s*(?:m?\s*N)?\s*$/i.exec(input);
  if (!m) return null;
  const zone = parseInt(m[1], 10);
  if (zone < 1 || zone > 60) return null;
  const L = (m[2] || "N").toUpperCase();
  const hemisphere: "N" | "S" = L === "S" ? "S" : L === "N" ? "N" : BANDS.indexOf(L) >= 10 ? "N" : "S";
  const easting = +m[3], northing = +m[4];
  if (easting < 100000 || easting > 900000 || northing < 0 || northing > 10000000) return null;
  const p = fromUTM({ zone, hemisphere, easting, northing });
  return valid(p.lat, p.lng) ? { ...p, kind: "utm" } : null;
}

/** Mengenali koordinat dari berbagai format. `hint` memaksa satu format (mis. geohash). */
export function parseCoordinate(input: string, opts: { hint?: ParsedKind | "auto"; ref?: LatLng } = {}): Parsed | null {
  const s = input.trim();
  if (!s) return null;
  const hint = opts.hint ?? "auto";
  const tryUrl = () => (/^(geo:|https?:|www\.|maps\.|goo\.gl)/i.test(s) || /[?&@#]/.test(s) ? (/^geo:/i.test(s) ? ((m) => (m && valid(+m[1], +m[2]) ? ({ lat: +m[1], lng: +m[2], kind: "geo" } as Parsed) : null))(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i.exec(s)) : parseUrl(s)) : null);
  const tryPlus = () => { if (!isPlusCode(s.split(/\s+/)[0])) return null; const c = fromPlusCode(s.split(/\s+/)[0], opts.ref); return c ? { lat: c.lat, lng: c.lng, kind: "pluscode" as const } : null; };
  const tryMgrs = () => { const p = fromMGRS(s); return p && /^\d{1,2}[C-HJ-NP-X][A-HJ-NP-Z]{2}/i.test(s.replace(/\s+/g, "")) ? { ...p, kind: "mgrs" as const } : null; };
  const tryGh = () => { const g = fromGeohash(s.replace(/^(geohash|gh)\s*[:=]?\s*/i, "")); return g ? { lat: g.lat, lng: g.lng, kind: "geohash" as const } : null; };
  const tryMh = () => { const g = fromMaidenhead(s); return g ? { ...g, kind: "maidenhead" as const } : null; };
  switch (hint) {
    case "pluscode": return tryPlus();
    case "mgrs": return tryMgrs();
    case "utm": return parseUTMString(s);
    case "geohash": return tryGh();
    case "maidenhead": return tryMh();
    case "dd": case "dms": case "ddm": return parseLatLngPair(s);
    case "url": case "geo": return tryUrl();
  }
  // otomatis (urutan penting, geohash/maidenhead hanya dengan awalan eksplisit)
  const u = tryUrl(); if (u) return u;
  const pc = tryPlus(); if (pc) return pc;
  const ut = parseUTMString(s); if (ut) return ut;
  const mg = tryMgrs(); if (mg) return mg;
  if (/^(geohash|gh)\s*[:=]/i.test(s)) return tryGh();
  return parseLatLngPair(s);
}
