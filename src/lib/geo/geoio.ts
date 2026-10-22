// Impor/ekspor daftar titik: CSV, GeoJSON, KML, GPX — plus pencarian negara offline (poligon Natural Earth 1:50m).

import { fmtDD, normLng, parseCoordinate, toGeohash, toMGRS, toPlusCode, toUTM, type LatLng } from "./coords";

export interface GeoPoint extends LatLng { id: string; name: string; note?: string }

let seq = 0;
export const pointId = () => `p${Date.now().toString(36)}${(seq++).toString(36)}`;

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
const csvCell = (s: string) => (/[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

export function toCSV(pts: GeoPoint[], extended = false): string {
  const head = extended ? "nama,lintang,bujur,catatan,utm,mgrs,pluscode,geohash" : "nama,lintang,bujur,catatan";
  const rows = pts.map((p) => {
    const base = [csvCell(p.name), p.lat.toFixed(7), p.lng.toFixed(7), csvCell(p.note ?? "")];
    if (extended) {
      let utm = "";
      try { const u = toUTM(p); utm = `${u.zone}${u.band} ${Math.round(u.easting)} ${Math.round(u.northing)}`; } catch { /* kutub */ }
      let mg = "";
      try { mg = toMGRS(p); } catch { /* kutub */ }
      base.push(csvCell(utm), csvCell(mg), toPlusCode(p), toGeohash(p));
    }
    return base.join(",");
  });
  return "\uFEFF" + [head, ...rows].join("\r\n") + "\r\n";
}

export function toGeoJSON(pts: GeoPoint[], shape: "points" | "line" | "polygon" = "points"): string {
  const point = (p: GeoPoint) => ({ type: "Feature", properties: { name: p.name, note: p.note ?? "" }, geometry: { type: "Point", coordinates: [+p.lng.toFixed(8), +p.lat.toFixed(8)] } });
  const coords = pts.map((p) => [+p.lng.toFixed(8), +p.lat.toFixed(8)]);
  const features: unknown[] = pts.map(point);
  if (shape === "line" && pts.length > 1) features.push({ type: "Feature", properties: { name: "Garis" }, geometry: { type: "LineString", coordinates: coords } });
  if (shape === "polygon" && pts.length > 2) features.push({ type: "Feature", properties: { name: "Poligon" }, geometry: { type: "Polygon", coordinates: [[...coords, coords[0]]] } });
  return JSON.stringify({ type: "FeatureCollection", features }, null, 2);
}

export function toKML(pts: GeoPoint[], docName = "Titik Gamato Piranti"): string {
  const pm = pts.map((p) => `    <Placemark>\n      <name>${xml(p.name)}</name>${p.note ? `\n      <description>${xml(p.note)}</description>` : ""}\n      <Point><coordinates>${p.lng.toFixed(8)},${p.lat.toFixed(8)},0</coordinates></Point>\n    </Placemark>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>${xml(docName)}</name>\n${pm}\n  </Document>\n</kml>\n`;
}

export function toGPX(pts: GeoPoint[], asRoute = false): string {
  const wpt = pts.map((p) => `  <wpt lat="${p.lat.toFixed(8)}" lon="${p.lng.toFixed(8)}">\n    <name>${xml(p.name)}</name>${p.note ? `\n    <desc>${xml(p.note)}</desc>` : ""}\n  </wpt>`).join("\n");
  const rte = asRoute && pts.length > 1 ? `\n  <rte>\n    <name>Rute</name>\n${pts.map((p) => `    <rtept lat="${p.lat.toFixed(8)}" lon="${p.lng.toFixed(8)}"><name>${xml(p.name)}</name></rtept>`).join("\n")}\n  </rte>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Gamato Piranti" xmlns="http://www.topografix.com/GPX/1/1">\n${wpt}${rte}\n</gpx>\n`;
}

export function toPlainText(pts: GeoPoint[], dec = 6): string {
  return pts.map((p, i) => `${p.name || `Titik ${i + 1}`}\t${fmtDD(p, dec)}`).join("\n");
}

// ── Impor ────────────────────────────────────────────────────────────────

function splitCsvLine(line: string, d: string): string[] {
  const out: string[] = [];
  let f = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"' && f === "") q = true;
    else if (c === d) { out.push(f); f = ""; }
    else f += c;
  }
  out.push(f);
  return out.map((x) => x.trim());
}

/** CSV/teks: tiap baris “[nama] lat,lng” atau kolom bernama (lat/lintang, lng/lon/bujur, nama/name). */
export function parseCsvPoints(text: string): GeoPoint[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const first = lines[0];
  const delim = [",", ";", "\t", "|"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const head = splitCsvLine(first, delim).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const idx = (names: string[]) => head.findIndex((h) => names.includes(h));
  const iLat = idx(["lat", "latitude", "lintang", "y"]);
  const iLng = idx(["lng", "lon", "long", "longitude", "bujur", "x"]);
  const iName = idx(["nama", "name", "label", "judul", "title"]);
  const iNote = idx(["catatan", "note", "notes", "deskripsi", "description", "desc", "keterangan"]);
  const out: GeoPoint[] = [];
  if (iLat >= 0 && iLng >= 0) {
    for (const l of lines.slice(1)) {
      const c = splitCsvLine(l, delim);
      const lat = parseFloat((c[iLat] ?? "").replace(",", ".")), lng = parseFloat((c[iLng] ?? "").replace(",", "."));
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
        out.push({ id: pointId(), lat, lng, name: (iName >= 0 ? c[iName] : "") || `Titik ${out.length + 1}`, note: iNote >= 0 ? c[iNote] : undefined });
    }
    return out;
  }
  // tanpa header: coba tiap baris sebagai koordinat (dengan nama opsional di depan, dipisah tab/titik koma)
  for (const l of lines) {
    let name = "", coord = l;
    const t = l.split(/\t|;/);
    if (t.length === 2 && !/^[-+\d]/.test(t[0].trim())) { name = t[0].trim(); coord = t[1]; }
    const p = parseCoordinate(coord);
    if (p) out.push({ id: pointId(), lat: p.lat, lng: p.lng, name: name || `Titik ${out.length + 1}` });
  }
  return out;
}

export function parseGeoJSONPoints(text: string): GeoPoint[] {
  const j = JSON.parse(text);
  const out: GeoPoint[] = [];
  const add = (coords: unknown, props: Record<string, unknown> | null | undefined) => {
    if (!Array.isArray(coords) || typeof coords[0] !== "number" || typeof coords[1] !== "number") return;
    const lng = coords[0] as number, lat = coords[1] as number;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    const nm = props && (props.name ?? props.title ?? props.label);
    out.push({ id: pointId(), lat, lng, name: typeof nm === "string" && nm ? nm : `Titik ${out.length + 1}`, note: props && typeof props.note === "string" ? props.note : undefined });
  };
  const verts: { c: unknown; props: Record<string, unknown> | null | undefined }[] = [];
  const visit = (g: any, props?: Record<string, unknown> | null) => {
    if (!g) return;
    if (g.type === "FeatureCollection") g.features?.forEach((f: any) => visit(f));
    else if (g.type === "Feature") visit(g.geometry, g.properties);
    else if (g.type === "Point") add(g.coordinates, props);
    else if (g.type === "MultiPoint") g.coordinates?.forEach((c: unknown) => add(c, props));
    else if (g.type === "LineString") g.coordinates?.forEach((c: unknown) => verts.push({ c, props }));
    else if (g.type === "Polygon") g.coordinates?.[0]?.slice(0, -1).forEach((c: unknown) => verts.push({ c, props }));
    else if (g.type === "MultiLineString") g.coordinates?.forEach((l: unknown[]) => l.forEach((c) => verts.push({ c, props })));
    else if (g.type === "MultiPolygon") g.coordinates?.forEach((pg: unknown[][]) => pg[0]?.slice(0, -1).forEach((c) => verts.push({ c, props })));
    else if (g.type === "GeometryCollection") g.geometries?.forEach((x: any) => visit(x, props));
  };
  visit(j);
  // Berkas hasil ekspor memuat titik + garis/poligon: jangan gandakan. Vertex dipakai hanya bila tak ada titik.
  if (!out.length) verts.forEach((v) => add(v.c, v.props));
  return out;
}

export function parseKmlPoints(text: string): GeoPoint[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("KML tidak valid.");
  const out: GeoPoint[] = [];
  doc.querySelectorAll("Placemark").forEach((pm) => {
    const name = pm.querySelector("name")?.textContent?.trim() || "";
    const note = pm.querySelector("description")?.textContent?.trim() || undefined;
    const coords = pm.querySelectorAll("Point > coordinates, LineString > coordinates, Polygon coordinates");
    coords.forEach((c) => {
      (c.textContent || "").trim().split(/\s+/).forEach((tok) => {
        const [lng, lat] = tok.split(",").map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) out.push({ id: pointId(), lat, lng, name: name || `Titik ${out.length + 1}`, note });
      });
    });
  });
  return out;
}

export function parseGpxPoints(text: string): GeoPoint[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("GPX tidak valid.");
  const out: GeoPoint[] = [];
  doc.querySelectorAll("wpt, rtept, trkpt").forEach((w) => {
    const lat = parseFloat(w.getAttribute("lat") || ""), lng = parseFloat(w.getAttribute("lon") || "");
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ id: pointId(), lat, lng, name: w.querySelector("name")?.textContent?.trim() || `Titik ${out.length + 1}`, note: w.querySelector("desc")?.textContent?.trim() || undefined });
  });
  return out;
}

/** Memilih parser berdasarkan ekstensi/isi. */
export function parseAnyPoints(text: string, fileName = ""): GeoPoint[] {
  const t = text.trim();
  if (/\.(geo)?json$/i.test(fileName) || t.startsWith("{")) return parseGeoJSONPoints(t);
  if (/\.kml$/i.test(fileName) || /<kml[\s>]/i.test(t.slice(0, 500))) return parseKmlPoints(t);
  if (/\.gpx$/i.test(fileName) || /<gpx[\s>]/i.test(t.slice(0, 500))) return parseGpxPoints(t);
  return parseCsvPoints(t);
}

// ── Negara (offline) ─────────────────────────────────────────────────────

type Ring = number[][];
interface CountryFeat { name: string; id: string; bbox: [number, number, number, number]; polys: Ring[][] }
let countriesCache: CountryFeat[] | null = null;
let geoJsonCache: unknown | null = null;

/** Membuka lilitan bujur (±360°) sepanjang cincin; mengembalikan null bila cincin mengelilingi kutub (tidak menutup). */
function unwrapRing(ring: Ring): Ring | null {
  const out: Ring = [[ring[0][0], ring[0][1]]];
  let off = 0;
  for (let i = 1; i < ring.length; i++) {
    const dx = ring[i][0] - ring[i - 1][0];
    if (dx > 180) off -= 360; else if (dx < -180) off += 360;
    out.push([ring[i][0] + off, ring[i][1]]);
  }
  return Math.abs(out[out.length - 1][0] - out[0][0]) > 1e-6 ? null : out;
}

function clipX(ring: Ring, edge: number, keepGreater: boolean): Ring {
  const out: Ring = [];
  const inside = (x: number) => (keepGreater ? x >= edge : x <= edge);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ai = inside(a[0]), bi = inside(b[0]);
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = (edge - a[0]) / (b[0] - a[0]);
      out.push([edge, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

/** Memotong poligon yang melintasi garis tanggal menjadi bagian-bagian di dalam −180…180 (cocok untuk peta datar). */
function planarizePolygon(pg: Ring[]): Ring[][] {
  const un = unwrapRing(pg[0]);
  if (!un) return [pg]; // mengelilingi kutub (Antarktika): biarkan
  let min = Infinity, max = -Infinity;
  for (const [x] of un) { if (x < min) min = x; if (x > max) max = x; }
  if (min >= -180 && max <= 180) return [pg.map((r) => unwrapRing(r) ?? r)];
  const res: Ring[][] = [];
  for (const k of [-1, 0, 1]) {
    const shifted = un.slice(0, -1).map(([x, y]) => [x + 360 * k, y]);
    let r = clipX(shifted, -180, true);
    if (r.length >= 3) r = clipX(r, 180, false);
    if (r.length >= 3) res.push([[...r, r[0]]]);
  }
  return res;
}

export async function loadCountries(): Promise<{ list: CountryFeat[]; geojson: unknown }> {
  if (countriesCache && geoJsonCache) return { list: countriesCache, geojson: geoJsonCache };
  const [{ feature }, topo] = await Promise.all([import("topojson-client"), import("world-atlas/countries-50m.json")]);
  const fc: any = feature(topo.default as any, (topo.default as any).objects.countries);
  const feats = fc.features.map((f: any) => {
    const raw: Ring[][] = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    const polys: Ring[][] = raw.flatMap((pg) => planarizePolygon(pg));
    let w = 180, s = 90, e = -180, n = -90;
    for (const pg of polys) for (const [x, y] of pg[0]) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    return { name: f.properties?.name ?? "?", id: String(f.id ?? ""), bbox: [w, s, e, n] as [number, number, number, number], polys };
  });
  countriesCache = feats;
  geoJsonCache = { type: "FeatureCollection", features: feats.map((c: CountryFeat) => ({ type: "Feature", properties: { name: c.name }, geometry: { type: "MultiPolygon", coordinates: c.polys } })) };
  return { list: countriesCache!, geojson: geoJsonCache };
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
export function pointInPolys(p: LatLng, polys: Ring[][]): boolean {
  const x = normLng(p.lng), y = p.lat;
  for (const pg of polys) {
    if (!inRing(x, y, pg[0])) continue;
    let hole = false;
    for (let h = 1; h < pg.length; h++) if (inRing(x, y, pg[h])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
}

function distToRingDeg(x: number, y: number, ring: Ring): number {
  const k = Math.cos((y * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0] * k, ay = ring[j][1], bx = ring[i][0] * k, by = ring[i][1];
    const px = x * k, dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (y - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(px - (ax + t * dx), y - (ay + t * dy));
    if (d < best) best = d;
  }
  return best;
}

/** Nama negara di titik (offline). Bila titik jatuh di “air” pada data 1:50m tetapi < ±28 km dari garis pantai, dikembalikan “Nama (dekat garis pantai)”. */
export async function countryAt(p: LatLng): Promise<string | null> {
  const { list } = await loadCountries();
  const x = normLng(p.lng);
  for (const c of list) {
    if (x < c.bbox[0] || x > c.bbox[2] || p.lat < c.bbox[1] || p.lat > c.bbox[3]) continue;
    if (pointInPolys(p, c.polys)) return c.name;
  }
  const NEAR = 0.25;
  let best: { name: string; d: number } | null = null;
  for (const c of list) {
    if (x < c.bbox[0] - NEAR || x > c.bbox[2] + NEAR || p.lat < c.bbox[1] - NEAR || p.lat > c.bbox[3] + NEAR) continue;
    for (const pg of c.polys) {
      const d = distToRingDeg(x, p.lat, pg[0]);
      if (d < NEAR && (!best || d < best.d)) best = { name: c.name, d };
    }
  }
  if (best) return `${best.name} (dekat garis pantai)`;
  // Antarktika: cincin kutubnya di data 1:50m tidak cocok untuk uji titik-dalam-poligon datar
  if (p.lat < -60) return "Antarctica (wilayah Perjanjian Antarktika)";
  return null;
}

/** Titik acak di dalam sebuah negara (rejection sampling di bbox). */
export async function randomInCountry(name: string, n: number, rng: () => number = Math.random): Promise<LatLng[]> {
  const { list } = await loadCountries();
  const c = list.find((x) => x.name === name);
  if (!c) return [];
  const out: LatLng[] = [];
  const [w, s, e, nn] = c.bbox;
  const sMin = Math.sin((s * Math.PI) / 180), sMax = Math.sin((nn * Math.PI) / 180);
  let guard = 0;
  while (out.length < n && guard++ < n * 4000) {
    const p = { lat: (Math.asin(sMin + rng() * (sMax - sMin)) * 180) / Math.PI, lng: w + rng() * (e - w) };
    if (pointInPolys(p, c.polys)) out.push(p);
  }
  return out;
}

export async function countryNames(): Promise<string[]> {
  const { list } = await loadCountries();
  return list.map((c) => c.name).sort((a, b) => a.localeCompare(b));
}
