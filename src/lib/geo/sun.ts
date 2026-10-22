// Matahari terbit/terbenam & transit (algoritma NOAA, akurasi ± 1 menit untuk lintang < 72°).

import { deg, rad, type LatLng } from "./coords";

export interface SunTimes { sunrise: Date | null; sunset: Date | null; solarNoon: Date; dayLengthMin: number | null; polar: "day" | "night" | null }

const toDays = (d: Date) => d.getTime() / 86400000 - 10957.5; // hari sejak J2000 (UTC)

/** `date` = tanggal (hanya Y/M/D UTC yang dipakai sebagai hari lokal pengguna). */
export function sunTimes(date: Date, p: LatLng): SunTimes {
  const dayStartUTC = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const est = new Date(dayStartUTC + (12 - p.lng / 15) * 3600000);
  // Rumus kanonik NOAA/Meeus (Julian cycle)
  const n0 = Math.round(toDays(est) - 0.0009 + p.lng / 360);
  const Jstar = n0 + 0.0009 - p.lng / 360;
  const M = rad((357.5291 + 0.98560028 * Jstar) % 360);
  const C = 1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M);
  const lam = rad((deg(M) + C + 180 + 102.9372) % 360);
  const Jtransit = 2451545 + Jstar + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * lam);
  const decl = Math.asin(Math.sin(lam) * Math.sin(rad(23.4397)));
  const cosH = (Math.sin(rad(-0.833)) - Math.sin(rad(p.lat)) * Math.sin(decl)) / (Math.cos(rad(p.lat)) * Math.cos(decl));
  const jToDate = (j: number) => new Date((j - 2440587.5) * 86400000);
  const noon = jToDate(Jtransit);
  if (cosH > 1) return { sunrise: null, sunset: null, solarNoon: noon, dayLengthMin: null, polar: "night" };
  if (cosH < -1) return { sunrise: null, sunset: null, solarNoon: noon, dayLengthMin: null, polar: "day" };
  const w0 = deg(Math.acos(cosH));
  const Jset = Jtransit + w0 / 360;
  const Jrise = Jtransit - w0 / 360;
  return { sunrise: jToDate(Jrise), sunset: jToDate(Jset), solarNoon: noon, dayLengthMin: (2 * w0 * 4), polar: null };
}
