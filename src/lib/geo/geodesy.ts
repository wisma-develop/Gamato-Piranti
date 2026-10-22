// Geodesi & pembangkit titik. Jarak/bearing memakai Vincenty (elipsoid WGS-84) dengan cadangan haversine;
// luas poligon & titik acak memakai model bola (cukup untuk keperluan umum).

import { clamp, deg, normLng, rad, type LatLng } from "./coords";

const A = 6378137, F = 1 / 298.257223563, B = (1 - F) * A;
export const R_MEAN = 6371008.8;

export interface Inverse { distance: number; initial: number; final: number; method: "vincenty" | "haversine" }

const norm360 = (d: number) => ((d % 360) + 360) % 360;

export function haversine(p: LatLng, q: LatLng): number {
  const dLat = rad(q.lat - p.lat), dLng = rad(q.lng - p.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(p.lat)) * Math.cos(rad(q.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MEAN * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function initialBearingSphere(p: LatLng, q: LatLng): number {
  const f1 = rad(p.lat), f2 = rad(q.lat), dl = rad(q.lng - p.lng);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return norm360(deg(Math.atan2(y, x)));
}

/** Masalah geodesi invers (Vincenty). */
export function inverse(p: LatLng, q: LatLng): Inverse {
  if (p.lat === q.lat && p.lng === q.lng) return { distance: 0, initial: 0, final: 0, method: "vincenty" };
  const L = rad(normLng(q.lng - p.lng));
  const U1 = Math.atan((1 - F) * Math.tan(rad(p.lat))), U2 = Math.atan((1 - F) * Math.tan(rad(q.lat)));
  const sU1 = Math.sin(U1), cU1 = Math.cos(U1), sU2 = Math.sin(U2), cU2 = Math.cos(U2);
  let lam = L, lamP = 0, it = 0;
  let sinSig = 0, cosSig = 0, sig = 0, cosSqAlpha = 0, cos2SigM = 0;
  do {
    const sl = Math.sin(lam), cl = Math.cos(lam);
    sinSig = Math.sqrt((cU2 * sl) ** 2 + (cU1 * sU2 - sU1 * cU2 * cl) ** 2);
    if (sinSig === 0) return { distance: 0, initial: 0, final: 0, method: "vincenty" };
    cosSig = sU1 * sU2 + cU1 * cU2 * cl;
    sig = Math.atan2(sinSig, cosSig);
    const sinAlpha = (cU1 * cU2 * sl) / sinSig;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigM = cosSqAlpha !== 0 ? cosSig - (2 * sU1 * sU2) / cosSqAlpha : 0;
    const C = (F / 16) * cosSqAlpha * (4 + F * (4 - 3 * cosSqAlpha));
    lamP = lam;
    lam = L + (1 - C) * F * sinAlpha * (sig + C * sinSig * (cos2SigM + C * cosSig * (-1 + 2 * cos2SigM * cos2SigM)));
    if (Math.abs(lam) > Math.PI) break;
  } while (Math.abs(lam - lamP) > 1e-12 && ++it < 200);
  if (it >= 200 || Math.abs(lam) > Math.PI || Number.isNaN(lam)) {
    return { distance: haversine(p, q), initial: initialBearingSphere(p, q), final: norm360(initialBearingSphere(q, p) + 180), method: "haversine" };
  }
  const uSq = (cosSqAlpha * (A * A - B * B)) / (B * B);
  const Aa = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const Bb = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const dSig = Bb * sinSig * (cos2SigM + (Bb / 4) * (cosSig * (-1 + 2 * cos2SigM ** 2) - (Bb / 6) * cos2SigM * (-3 + 4 * sinSig ** 2) * (-3 + 4 * cos2SigM ** 2)));
  const s = B * Aa * (sig - dSig);
  const sl = Math.sin(lam), cl = Math.cos(lam);
  const a1 = Math.atan2(cU2 * sl, cU1 * sU2 - sU1 * cU2 * cl);
  const a2 = Math.atan2(cU1 * sl, -sU1 * cU2 + cU1 * sU2 * cl);
  return { distance: s, initial: norm360(deg(a1)), final: norm360(deg(a2)), method: "vincenty" };
}

/** Masalah geodesi langsung (Vincenty): titik tujuan dari titik awal, bearing (°), jarak (m). */
export function destination(p: LatLng, bearingDeg: number, distM: number): LatLng {
  const a1 = rad(bearingDeg);
  const sA1 = Math.sin(a1), cA1 = Math.cos(a1);
  const tU1 = (1 - F) * Math.tan(rad(p.lat));
  const cU1 = 1 / Math.sqrt(1 + tU1 * tU1), sU1 = tU1 * cU1;
  const sig1 = Math.atan2(tU1, cA1);
  const sinAlpha = cU1 * sA1;
  const cosSqAlpha = 1 - sinAlpha * sinAlpha;
  const uSq = (cosSqAlpha * (A * A - B * B)) / (B * B);
  const Aa = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const Bb = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  let sig = distM / (B * Aa), sigP = 0, it = 0;
  let cos2SigM = 0, sinSig = 0, cosSig = 0;
  do {
    cos2SigM = Math.cos(2 * sig1 + sig);
    sinSig = Math.sin(sig);
    cosSig = Math.cos(sig);
    const dSig = Bb * sinSig * (cos2SigM + (Bb / 4) * (cosSig * (-1 + 2 * cos2SigM ** 2) - (Bb / 6) * cos2SigM * (-3 + 4 * sinSig ** 2) * (-3 + 4 * cos2SigM ** 2)));
    sigP = sig;
    sig = distM / (B * Aa) + dSig;
  } while (Math.abs(sig - sigP) > 1e-12 && ++it < 100);
  const x = sU1 * sinSig - cU1 * cosSig * cA1;
  const lat2 = Math.atan2(sU1 * cosSig + cU1 * sinSig * cA1, (1 - F) * Math.sqrt(sinAlpha ** 2 + x * x));
  const lam = Math.atan2(sinSig * sA1, cU1 * cosSig - sU1 * sinSig * cA1);
  const C = (F / 16) * cosSqAlpha * (4 + F * (4 - 3 * cosSqAlpha));
  const L = lam - (1 - C) * F * sinAlpha * (sig + C * sinSig * (cos2SigM + C * cosSig * (-1 + 2 * cos2SigM ** 2)));
  return { lat: deg(lat2), lng: normLng(p.lng + deg(L)) };
}

export function midpoint(p: LatLng, q: LatLng): LatLng {
  const f1 = rad(p.lat), l1 = rad(p.lng), f2 = rad(q.lat), dl = rad(q.lng - p.lng);
  const bx = Math.cos(f2) * Math.cos(dl), by = Math.cos(f2) * Math.sin(dl);
  const f3 = Math.atan2(Math.sin(f1) + Math.sin(f2), Math.sqrt((Math.cos(f1) + bx) ** 2 + by * by));
  return { lat: deg(f3), lng: normLng(deg(l1 + Math.atan2(by, Math.cos(f1) + bx))) };
}

/** Titik di sepanjang great-circle antara p dan q (fraksi 0..1). */
export function interpolate(p: LatLng, q: LatLng, t: number): LatLng {
  const f1 = rad(p.lat), l1 = rad(p.lng), f2 = rad(q.lat), l2 = rad(q.lng);
  const d = haversine(p, q) / R_MEAN;
  if (d < 1e-12) return { ...p };
  const a = Math.sin((1 - t) * d) / Math.sin(d), b = Math.sin(t * d) / Math.sin(d);
  const x = a * Math.cos(f1) * Math.cos(l1) + b * Math.cos(f2) * Math.cos(l2);
  const y = a * Math.cos(f1) * Math.sin(l1) + b * Math.cos(f2) * Math.sin(l2);
  const z = a * Math.sin(f1) + b * Math.sin(f2);
  return { lat: deg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: normLng(deg(Math.atan2(y, x))) };
}

export function pathLength(pts: LatLng[], closed = false): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += inverse(pts[i - 1], pts[i]).distance;
  if (closed && pts.length > 2) s += inverse(pts[pts.length - 1], pts[0]).distance;
  return s;
}

/** Luas poligon pada bola (m²), rumus Chamberlain–Duquette. */
export function polygonArea(pts: LatLng[]): number {
  if (pts.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    s += rad(normLng(q.lng - p.lng)) * (2 + Math.sin(rad(p.lat)) + Math.sin(rad(q.lat)));
  }
  return Math.abs((s * R_MEAN * R_MEAN) / 2);
}

export function centroid(pts: LatLng[]): LatLng | null {
  if (!pts.length) return null;
  let x = 0, y = 0, z = 0;
  for (const p of pts) {
    const f = rad(p.lat), l = rad(p.lng);
    x += Math.cos(f) * Math.cos(l); y += Math.cos(f) * Math.sin(l); z += Math.sin(f);
  }
  const n = pts.length;
  x /= n; y /= n; z /= n;
  return { lat: deg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: normLng(deg(Math.atan2(y, x))) };
}

export interface BBox { south: number; west: number; north: number; east: number }
export function bboxOf(pts: LatLng[]): BBox | null {
  if (!pts.length) return null;
  let s = 90, n = -90, w = 180, e = -180;
  for (const p of pts) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lng); e = Math.max(e, p.lng); }
  return { south: s, west: w, north: n, east: e };
}

// ── Satuan ───────────────────────────────────────────────────────────────

export type DistUnit = "m" | "km" | "mi" | "nmi" | "ft";
export const DIST_UNITS: { id: DistUnit; label: string; perM: number }[] = [
  { id: "m", label: "meter", perM: 1 }, { id: "km", label: "kilometer", perM: 1e-3 }, { id: "mi", label: "mil", perM: 1 / 1609.344 }, { id: "nmi", label: "mil laut", perM: 1 / 1852 }, { id: "ft", label: "kaki", perM: 1 / 0.3048 },
];
export const toUnit = (m: number, u: DistUnit) => m * DIST_UNITS.find((x) => x.id === u)!.perM;
export const fromUnit = (v: number, u: DistUnit) => v / DIST_UNITS.find((x) => x.id === u)!.perM;

export function fmtDistance(m: number): string {
  if (m < 1000) return `${m.toFixed(m < 10 ? 2 : 1)} m`;
  if (m < 100000) return `${(m / 1000).toFixed(3)} km`;
  return `${(m / 1000).toFixed(1)} km`;
}
export function fmtArea(m2: number): string {
  if (m2 < 1e4) return `${m2.toFixed(1)} m²`;
  if (m2 < 1e6) return `${(m2 / 1e4).toFixed(3)} ha`;
  return `${(m2 / 1e6).toFixed(3)} km²  (${(m2 / 1e4).toFixed(1)} ha)`;
}
const CARD = ["U", "TL", "T", "TG", "S", "BD", "B", "BL"];
export const compass = (b: number) => CARD[Math.round(norm360(b) / 45) % 8];

// ── Pembangkit ───────────────────────────────────────────────────────────

export type Rng = () => number;
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function randomInBBox(n: number, b: BBox, rng: Rng = Math.random): LatLng[] {
  const s = Math.sin(rad(b.south)), nn = Math.sin(rad(b.north));
  const out: LatLng[] = [];
  const west = b.west, span = b.east >= b.west ? b.east - b.west : b.east + 360 - b.west;
  for (let i = 0; i < n; i++) out.push({ lat: deg(Math.asin(s + rng() * (nn - s))), lng: normLng(west + rng() * span) });
  return out;
}

export function randomInCircle(n: number, c: LatLng, radiusM: number, rng: Rng = Math.random): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < n; i++) out.push(destination(c, rng() * 360, radiusM * Math.sqrt(rng())));
  return out;
}

export function circlePoints(n: number, c: LatLng, radiusM: number, startBearing = 0): LatLng[] {
  return Array.from({ length: n }, (_, i) => destination(c, startBearing + (360 * i) / n, radiusM));
}

export function linePoints(p: LatLng, q: LatLng, n: number): LatLng[] {
  return Array.from({ length: n }, (_, i) => interpolate(p, q, n === 1 ? 0 : i / (n - 1)));
}

export const MAX_GENERATED = 5000;

/** Grid dalam bbox: langkah dalam derajat. */
export function gridPoints(b: BBox, stepDeg: number): LatLng[] {
  const out: LatLng[] = [];
  const step = Math.max(1e-6, stepDeg);
  for (let lat = b.south; lat <= b.north + 1e-9; lat += step) {
    for (let lng = b.west; lng <= b.east + 1e-9; lng += step) {
      out.push({ lat: clamp(lat, -90, 90), lng: normLng(lng) });
      if (out.length > MAX_GENERATED) return out;
    }
  }
  return out;
}

/** Grid berjarak tetap (meter) di sekitar bbox: langkah lintang tetap, langkah bujur disesuaikan terhadap lintang. */
export function gridPointsMeters(b: BBox, stepM: number): LatLng[] {
  const out: LatLng[] = [];
  const dLat = deg(stepM / R_MEAN);
  for (let lat = b.south; lat <= b.north + 1e-9; lat += dLat) {
    const dLng = deg(stepM / (R_MEAN * Math.max(0.01, Math.cos(rad(lat)))));
    for (let lng = b.west; lng <= b.east + 1e-9; lng += dLng) {
      out.push({ lat, lng: normLng(lng) });
      if (out.length > MAX_GENERATED) return out;
    }
  }
  return out;
}
