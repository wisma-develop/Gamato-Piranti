import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Search, MapPin, Crosshair, Locate, Copy, Check, Trash2, Plus, Upload, Download, ChevronUp, ChevronDown, Ruler, Shuffle, Layers, Navigation, Globe2, Mountain, Sunrise, ExternalLink, Maximize2, Loader2, Compass,
} from "lucide-react";
import { Btn, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { SettingsTabBar } from "@/components/ui/SettingsTabs";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import {
  fmtDD, fmtDDM, fmtDMS, fmtUTM, normLng, parseCoordinate, toGeohash, toMaidenhead, toMGRS, toPlusCode, toWebMercator, tileXY, clamp,
  type LatLng, type ParsedKind,
} from "@/lib/geo/coords";
import {
  DIST_UNITS, MAX_GENERATED, bboxOf, centroid, circlePoints, compass, destination, fmtArea, fmtDistance, fromUnit, gridPoints, gridPointsMeters, haversine, inverse, linePoints,
  midpoint, pathLength, polygonArea, randomInBBox, randomInCircle, seededRng, toUnit, type BBox, type DistUnit,
} from "@/lib/geo/geodesy";
import {
  countryAt, countryNames, loadCountries, parseAnyPoints, pointId, randomInCountry, toCSV, toGeoJSON, toGPX, toKML, toPlainText, type GeoPoint,
} from "@/lib/geo/geoio";
import { sunTimes } from "@/lib/geo/sun";

type TabId = "koordinat" | "daftar" | "ukur" | "generate" | "peta";
type BaseId = "offline" | "osm" | "topo" | "sat" | "dark";

const card = "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4";
const cap = "text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500";

const BASES: { id: BaseId; label: string; url?: string; attr?: string; max: number; sub?: string[] }[] = [
  { id: "offline", label: "Peta dunia offline (vektor)", max: 18 },
  { id: "osm", label: "OpenStreetMap", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attr: "© OpenStreetMap contributors", max: 19 },
  { id: "topo", label: "Topografi (OpenTopoMap)", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attr: "© OpenStreetMap, SRTM | © OpenTopoMap (CC-BY-SA)", max: 17, sub: ["a", "b", "c"] },
  { id: "sat", label: "Citra satelit (Esri)", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attr: "Tiles © Esri — Esri, Maxar, Earthstar Geographics", max: 18 },
  { id: "dark", label: "Gelap (CARTO)", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", attr: "© OpenStreetMap contributors © CARTO", max: 19, sub: ["a", "b", "c", "d"] },
];

const pinIcon = (color: string) =>
  L.divIcon({
    className: "gp-pin",
    html: `<svg width="32" height="42" viewBox="0 0 30 40" style="max-width:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))"><path d="M15 39C15 39 2 24 2 14a13 13 0 0 1 26 0c0 10-13 25-13 25z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="15" cy="14" r="5" fill="#fff"/></svg>`,
    iconSize: [32, 42],
    iconAnchor: [16, 41],
  });
const numIcon = (n: number) =>
  L.divIcon({
    className: "gp-num",
    html: `<div style="width:24px;height:24px;border-radius:50%;background:#4f46e5;color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font:700 11px/1 system-ui;box-shadow:0 1px 4px rgba(0,0,0,.45)">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const landStyle = (dark: boolean): L.PathOptions => (dark ? { color: "#3b5170", weight: 0.6, fillColor: "#1b2b44", fillOpacity: 1 } : { color: "#94a3b8", weight: 0.6, fillColor: "#e2e8f0", fillOpacity: 1 });

const fmtLocalOffset = () => -new Date().getTimezoneOffset() / 60;
const OFFSETS = Array.from({ length: 53 }, (_, i) => -12 + i * 0.5).filter((o) => o !== -11.5 && o !== -10.5 && o !== -9 + 0.0001).filter((o) => Number.isInteger(o * 2));
const fmtOffset = (o: number) => `UTC${o >= 0 ? "+" : "−"}${String(Math.floor(Math.abs(o))).padStart(2, "0")}:${Math.abs(o) % 1 === 0.5 ? "30" : Math.abs(o) % 1 === 0.75 ? "45" : "00"}`;
const timeAt = (d: Date | null, off: number) => {
  if (!d) return "—";
  const t = new Date(d.getTime() + off * 3600000);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* abaikan */ }
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
  }, []);
  return { copied, copy };
}

export const CoordinateTool: React.FC = () => {
  const mapEl = useRef<HTMLDivElement>(null);
  const wrapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const pointMarkerRef = useRef<L.Marker | null>(null);
  const savedGroupRef = useRef<L.LayerGroup | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const gratGroupRef = useRef<L.LayerGroup | null>(null);
  const crossRef = useRef<HTMLDivElement>(null);
  const tileErrRef = useRef(0);
  const offlineLayerRef = useRef<L.GeoJSON | null>(null);

  const [tab, setTab] = useState<TabId>("koordinat");
  const [base, setBase] = useState<BaseId>("osm");
  const [point, setPoint] = useState<LatLng | null>(null);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [shape, setShape] = useState<"none" | "line" | "polygon">("none");
  const [graticule, setGraticule] = useState(true);
  const [clickMode, setClickMode] = useState<"select" | "add">("select");
  const [crosshair, setCrosshair] = useState(false);
  const [circleR, setCircleR] = useState(0);
  const [circleUnit, setCircleUnit] = useState<DistUnit>("km");
  const [autoReverse, setAutoReverse] = useState(false);
  const [cursor, setCursor] = useState<LatLng | null>(null);
  const [view, setView] = useState<{ z: number; c: LatLng }>({ z: 4, c: { lat: -2.5, lng: 118 } });
  const [info, setInfo] = useState<{ tone: "success" | "error" | "warning" | "info"; msg: string } | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const [tileWarn, setTileWarn] = useState(false);
  const { copied, copy } = useCopy();

  // pencarian & input
  const [query, setQuery] = useState("");
  const [hint, setHint] = useState<ParsedKind | "auto">("auto");
  const [results, setResults] = useState<{ name: string; lat: number; lng: number; type?: string }[]>([]);
  const [searching, setSearching] = useState(false);

  // info titik
  const [country, setCountry] = useState<string | null | undefined>(undefined);
  const [address, setAddress] = useState<string | null>(null);
  const [elev, setElev] = useState<string | null>(null);
  const [busyNet, setBusyNet] = useState<string | null>(null);
  const [sunDate, setSunDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sunOff, setSunOff] = useState(() => fmtLocalOffset());
  const [pointName, setPointName] = useState("");

  // ukur
  const [aSel, setASel] = useState("cur");
  const [bSel, setBSel] = useState("p1");
  const [unit, setUnit] = useState<DistUnit>("km");
  const [dBearing, setDBearing] = useState(90);
  const [dDist, setDDist] = useState(10);
  const [dUnit, setDUnit] = useState<DistUnit>("km");

  // generate
  const [gMode, setGMode] = useState<"rand-view" | "rand-country" | "rand-radius" | "grid" | "circle" | "line">("rand-view");
  const [gCount, setGCount] = useState(20);
  const [gRadius, setGRadius] = useState(5);
  const [gRUnit, setGRUnit] = useState<DistUnit>("km");
  const [gStep, setGStep] = useState(1);
  const [gStepUnit, setGStepUnit] = useState<"deg" | "km">("deg");
  const [gStart, setGStart] = useState(0);
  const [gCountry, setGCountry] = useState("Indonesia");
  const [countryList, setCountryList] = useState<string[]>([]);
  const [gSeed, setGSeed] = useState("");
  const [gPrefix, setGPrefix] = useState("Titik");
  const [gBusy, setGBusy] = useState(false);

  const importRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState("");

  const setNote = (tone: "success" | "error" | "warning" | "info", msg: string) => setInfo({ tone, msg });

  // ── peta: inisialisasi ──
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { center: [view.c.lat, view.c.lng], zoom: view.z, minZoom: 1, maxZoom: 19, maxBounds: [[-90, -180], [90, 180]], maxBoundsViscosity: 1, zoomControl: true, preferCanvas: true, attributionControl: true });
    mapRef.current = map;
    L.control.scale({ imperial: true, metric: true, position: "bottomleft" }).addTo(map);
    savedGroupRef.current = L.layerGroup().addTo(map);
    overlayGroupRef.current = L.layerGroup().addTo(map);
    gratGroupRef.current = L.layerGroup().addTo(map);
    map.attributionControl.addAttribution("Batas negara: Natural Earth");
    const syncView = () => { const c = map.getCenter(); setView({ z: map.getZoom(), c: { lat: c.lat, lng: normLng(c.lng) } }); };
    map.on("moveend zoomend", syncView);
    let raf = 0;
    map.on("mousemove", (e: L.LeafletMouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCursor({ lat: e.latlng.lat, lng: normLng(e.latlng.lng) }));
    });
    map.on("mouseout", () => setCursor(null));
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapEl.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // klik peta (mode bergantung state terkini)
  const clickModeRef = useRef(clickMode);
  clickModeRef.current = clickMode;
  const autoRevRef = useRef(autoReverse);
  autoRevRef.current = autoReverse;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const onClick = (e: L.LeafletMouseEvent) => {
      const p = { lat: clamp(e.latlng.lat, -90, 90), lng: normLng(e.latlng.lng) };
      if (clickModeRef.current === "add") addPoints([{ id: pointId(), name: "", ...p }]);
      setPoint(p);
      setCountry(undefined); setAddress(null); setElev(null);
      if (autoRevRef.current) void reverse(p);
    };
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── lapisan dasar offline (poligon negara) ──
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { geojson } = await loadCountries();
        const map = mapRef.current;
        if (dead || !map) return;
        map.createPane("offline");
        map.getPane("offline")!.style.zIndex = "150";
        const dark = document.documentElement.classList.contains("dark");
        const layer = L.geoJSON(geojson as any, { pane: "offline", renderer: L.canvas({ pane: "offline" }), interactive: false, style: landStyle(dark) } as any).addTo(map);
        offlineLayerRef.current = layer;
        setOfflineReady(true);
      } catch { /* abaikan */ }
    })();
    return () => { dead = true; };
  }, []);

  // warna laut mengikuti mode gelap
  useEffect(() => {
    const apply = () => {
      const dark = document.documentElement.classList.contains("dark");
      if (mapEl.current) mapEl.current.style.background = dark ? "#0b2038" : "#bfdbfe";
      offlineLayerRef.current?.setStyle(landStyle(dark));
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, [offlineReady]);

  // ── lapisan tile online ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseLayerRef.current) { map.removeLayer(baseLayerRef.current); baseLayerRef.current = null; }
    tileErrRef.current = 0;
    setTileWarn(false);
    const b = BASES.find((x) => x.id === base)!;
    if (!b.url) return;
    const layer = L.tileLayer(b.url, { attribution: b.attr, maxZoom: b.max, subdomains: b.sub ?? "abc", crossOrigin: false, noWrap: true });
    layer.on("tileerror", () => { tileErrRef.current += 1; if (tileErrRef.current >= 4) setTileWarn(true); });
    layer.on("tileload", () => { if (tileErrRef.current < 4) setTileWarn(false); });
    layer.addTo(map);
    layer.setZIndex(200);
    baseLayerRef.current = layer;
  }, [base]);

  // ── marker titik terpilih ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!point) { pointMarkerRef.current?.remove(); pointMarkerRef.current = null; return; }
    if (!pointMarkerRef.current) {
      const m = L.marker([point.lat, point.lng], { draggable: true, icon: pinIcon("#ef4444"), zIndexOffset: 1000, keyboard: false }).addTo(map);
      m.on("dragend", () => {
        const ll = m.getLatLng();
        const p = { lat: clamp(ll.lat, -90, 90), lng: normLng(ll.lng) };
        setPoint(p); setCountry(undefined); setAddress(null); setElev(null);
        if (autoRevRef.current) void reverse(p);
      });
      pointMarkerRef.current = m;
    } else pointMarkerRef.current.setLatLng([point.lat, point.lng]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point]);

  // negara (offline) untuk titik terpilih
  useEffect(() => {
    if (!point) { setCountry(undefined); return; }
    let dead = false;
    countryAt(point).then((c) => { if (!dead) setCountry(c); }).catch(() => { if (!dead) setCountry(null); });
    return () => { dead = true; };
  }, [point]);

  // ── titik tersimpan, garis/poligon ──
  useEffect(() => {
    const g = savedGroupRef.current;
    if (!g) return;
    g.clearLayers();
    points.forEach((p, i) => {
      const m = L.marker([p.lat, p.lng], { icon: numIcon(i + 1), keyboard: false, title: p.name || `Titik ${i + 1}` });
      m.on("click", (e) => { L.DomEvent.stopPropagation(e); setPoint({ lat: p.lat, lng: p.lng }); });
      g.addLayer(m);
    });
    const ll = points.map((p) => [p.lat, p.lng] as [number, number]);
    if (shape === "line" && ll.length > 1) g.addLayer(L.polyline(ll, { color: "#4f46e5", weight: 3, interactive: false }));
    if (shape === "polygon" && ll.length > 2) g.addLayer(L.polygon(ll, { color: "#4f46e5", weight: 2, fillOpacity: 0.15, interactive: false }));
  }, [points, shape]);

  // lingkaran radius di sekitar titik
  useEffect(() => {
    const g = overlayGroupRef.current;
    if (!g) return;
    g.clearLayers();
    if (point && circleR > 0) g.addLayer(L.circle([point.lat, point.lng], { radius: fromUnit(circleR, circleUnit), color: "#ef4444", weight: 2, fillOpacity: 0.08, interactive: false }));
  }, [point, circleR, circleUnit]);

  // grid lintang/bujur
  useEffect(() => {
    const map = mapRef.current, g = gratGroupRef.current;
    if (!map || !g) return;
    const draw = () => {
      g.clearLayers();
      if (!graticule) return;
      const z = map.getZoom();
      const step = z < 3 ? 30 : z < 5 ? 10 : z < 7 ? 5 : z < 9 ? 1 : z < 11 ? 0.5 : z < 13 ? 0.1 : 0.02;
      const b = map.getBounds();
      const s = Math.max(-90, Math.floor(b.getSouth() / step) * step), n = Math.min(90, Math.ceil(b.getNorth() / step) * step);
      const w = Math.max(-180, Math.floor(b.getWest() / step) * step), e = Math.min(180, Math.ceil(b.getEast() / step) * step);
      const style = { color: "#64748b", weight: 0.7, opacity: 0.55, dashArray: "4 4", interactive: false } as L.PolylineOptions;
      let count = 0;
      for (let la = s; la <= n + 1e-9 && count < 120; la += step, count++) g.addLayer(L.polyline([[la, w], [la, e]], style));
      for (let lo = w; lo <= e + 1e-9 && count < 240; lo += step, count++) g.addLayer(L.polyline([[s, lo], [n, lo]], style));
    };
    draw();
    map.on("moveend", draw);
    return () => { map.off("moveend", draw); };
  }, [graticule]);

  // titik awal tampilan crosshair
  const flyTo = useCallback((p: LatLng, z?: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([p.lat, p.lng], z ?? Math.max(map.getZoom(), 12), { animate: false });
  }, []);

  const selectPoint = useCallback((p: LatLng, opts: { fly?: boolean; zoom?: number } = { fly: true }) => {
    const q = { lat: clamp(p.lat, -90, 90), lng: normLng(p.lng) };
    setPoint(q);
    setAddress(null); setElev(null);
    if (opts.fly !== false) flyTo(q, opts.zoom);
  }, [flyTo]);

  // ── jaringan: cari, balik, ketinggian ──
  async function reverse(p: LatLng) {
    setBusyNet("Mencari alamat…");
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${p.lat}&lon=${p.lng}&zoom=18&addressdetails=0&accept-language=id`);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      setAddress(j.display_name || "Alamat tidak ditemukan di titik ini.");
    } catch {
      setAddress(null);
      setNote("error", "Gagal mengambil alamat — perlu koneksi internet (layanan OpenStreetMap Nominatim).");
    } finally { setBusyNet(null); }
  }
  const getElevation = async () => {
    if (!point) return;
    setBusyNet("Mengambil ketinggian…");
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${point.lat.toFixed(5)}&longitude=${point.lng.toFixed(5)}`);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const v = j?.elevation?.[0];
      setElev(typeof v === "number" ? `${v.toFixed(0)} m dpl (model SRTM/Copernicus)` : "Tidak tersedia");
    } catch {
      setNote("error", "Gagal mengambil ketinggian — perlu koneksi internet (Open-Meteo).");
    } finally { setBusyNet(null); }
  };

  const doSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setResults([]);
    const parsed = parseCoordinate(q, { hint, ref: view.c });
    if (parsed) {
      selectPoint(parsed, { fly: true, zoom: 14 });
      setNote("success", `Koordinat dikenali (${parsed.kind.toUpperCase()}): ${fmtDD(parsed, 6)}`);
      setTab("koordinat");
      return;
    }
    if (hint !== "auto") { setNote("warning", "Format koordinat tidak dikenali untuk pilihan format ini."); return; }
    setSearching(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=id&q=${encodeURIComponent(q)}`);
      if (!r.ok) throw new Error(String(r.status));
      const j: any[] = await r.json();
      const list = j.map((x) => ({ name: x.display_name as string, lat: parseFloat(x.lat), lng: parseFloat(x.lon), type: x.type as string }));
      setResults(list);
      if (!list.length) setNote("warning", "Tempat tidak ditemukan. Coba kata kunci lain, atau tempel koordinat langsung.");
      else setInfo(null);
    } catch {
      setNote("error", "Pencarian tempat butuh internet (OpenStreetMap Nominatim) dan gagal dimuat. Koordinat/kode yang Anda ketik tetap bisa dikenali offline.");
    } finally { setSearching(false); }
  };

  const locate = () => {
    if (!navigator.geolocation) { setNote("error", "Browser tidak mendukung geolokasi."); return; }
    setBusyNet("Mencari lokasi Anda…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        selectPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { fly: true, zoom: 16 });
        setNote("success", `Lokasi Anda: ${fmtDD({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 6)} (akurasi ±${Math.round(pos.coords.accuracy)} m)`);
        setBusyNet(null);
      },
      (err) => { setBusyNet(null); setNote("error", err.code === 1 ? "Izin lokasi ditolak." : "Lokasi tidak tersedia."); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // ── daftar titik ──
  const addPoints = (pts: GeoPoint[], replace = false) => {
    setPoints((cur) => {
      const base = replace ? [] : cur;
      const merged = [...base, ...pts].slice(0, 5000);
      return merged.map((p, i) => ({ ...p, name: p.name || `Titik ${i + 1}` }));
    });
  };
  const addCurrent = () => {
    if (!point) return;
    addPoints([{ id: pointId(), name: pointName.trim(), lat: point.lat, lng: point.lng }]);
    setPointName("");
    setNote("success", "Titik ditambahkan ke daftar.");
  };
  const patchPoint = (id: string, p: Partial<GeoPoint>) => setPoints((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const movePoint = (i: number, d: -1 | 1) => setPoints((s) => { const j = i + d; if (j < 0 || j >= s.length) return s; const n = s.slice(); [n[i], n[j]] = [n[j], n[i]]; return n; });
  const fitAll = () => {
    const b = bboxOf(points);
    const map = mapRef.current;
    if (!b || !map) return;
    map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [40, 40], maxZoom: 16, animate: false });
  };

  const importText = (t: string, name = "") => {
    try {
      const pts = parseAnyPoints(t, name);
      if (!pts.length) { setNote("warning", "Tidak ada titik yang bisa dibaca. Format yang didukung: CSV (lintang,bujur), GeoJSON, KML, GPX, atau teks koordinat per baris."); return; }
      addPoints(pts);
      setNote("success", `${pts.length} titik diimpor.`);
      setTimeout(fitAll, 50);
    } catch (e: any) {
      setNote("error", e?.message || "Berkas tidak valid.");
    }
  };

  const exportAs = (kind: "csv" | "csvx" | "geojson" | "kml" | "gpx" | "txt") => {
    if (!points.length) return;
    const m: Record<string, [string, string, string]> = {
      csv: [toCSV(points), "text/csv;charset=utf-8", "titik.csv"],
      csvx: [toCSV(points, true), "text/csv;charset=utf-8", "titik-lengkap.csv"],
      geojson: [toGeoJSON(points, shape === "none" ? "points" : shape), "application/geo+json", "titik.geojson"],
      kml: [toKML(points), "application/vnd.google-earth.kml+xml", "titik.kml"],
      gpx: [toGPX(points, shape === "line"), "application/gpx+xml", "titik.gpx"],
      txt: [toPlainText(points), "text/plain;charset=utf-8", "titik.txt"],
    };
    const [data, mime, fname] = m[kind];
    downloadBlob(new Blob([data], { type: mime }), fname);
  };

  // ── turunan: format untuk titik terpilih ──
  const formats = useMemo(() => {
    if (!point) return [] as { key: string; label: string; value: string }[];
    const p = point;
    const rows: { key: string; label: string; value: string }[] = [
      { key: "dd", label: "Desimal (DD)", value: fmtDD(p, 6) },
      { key: "ddr", label: "Bujur, Lintang (GeoJSON)", value: `${p.lng.toFixed(6)}, ${p.lat.toFixed(6)}` },
      { key: "dms", label: "Derajat-Menit-Detik (DMS)", value: fmtDMS(p, 2) },
      { key: "ddm", label: "Derajat-Menit Desimal (DDM)", value: fmtDDM(p, 4) },
    ];
    try { rows.push({ key: "utm", label: "UTM (WGS84)", value: fmtUTM(p, 0) }); } catch { rows.push({ key: "utm", label: "UTM (WGS84)", value: "— (di luar −80°…84°)" }); }
    try { rows.push({ key: "mgrs", label: "MGRS (1 m)", value: toMGRS(p, 5) }); } catch { rows.push({ key: "mgrs", label: "MGRS", value: "— (di luar −80°…84°)" }); }
    rows.push(
      { key: "olc", label: "Plus Code (10)", value: toPlusCode(p, 10) },
      { key: "olc11", label: "Plus Code (11, ≈3 m)", value: toPlusCode(p, 11) },
      { key: "gh", label: "Geohash (9)", value: toGeohash(p, 9) },
      { key: "mh", label: "Maidenhead (6)", value: toMaidenhead(p, 3) },
    );
    const wm = toWebMercator(p);
    rows.push({ key: "wm", label: "Web Mercator EPSG:3857 (m)", value: `${wm.x.toFixed(2)}, ${wm.y.toFixed(2)}` });
    const t = tileXY(p, clamp(Math.round(view.z), 0, 19));
    rows.push({ key: "tile", label: `Ubin XYZ (zoom ${Math.round(view.z)})`, value: `${Math.round(view.z)}/${t.x}/${t.y}` });
    return rows;
  }, [point, view.z]);

  const links = useMemo(() => {
    if (!point) return [];
    const { lat, lng } = point;
    return [
      { label: "Google Maps", url: `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}` },
      { label: "OpenStreetMap", url: `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=16/${lat.toFixed(6)}/${lng.toFixed(6)}` },
      { label: "Apple Maps", url: `https://maps.apple.com/?ll=${lat.toFixed(6)},${lng.toFixed(6)}&q=Titik` },
      { label: "Waze", url: `https://waze.com/ul?ll=${lat.toFixed(6)},${lng.toFixed(6)}&navigate=yes` },
      { label: "Bing Maps", url: `https://www.bing.com/maps?cp=${lat.toFixed(6)}~${lng.toFixed(6)}&lvl=16` },
      { label: "geo: URI", url: `geo:${lat.toFixed(6)},${lng.toFixed(6)}` },
    ];
  }, [point]);

  const sun = useMemo(() => {
    if (!point) return null;
    const d = new Date(sunDate + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) return null;
    return sunTimes(d, point);
  }, [point, sunDate]);

  // ── ukur ──
  const refOptions = useMemo(() => [{ id: "cur", label: "Titik saat ini", p: point }, ...points.map((p, i) => ({ id: p.id, label: `${i + 1}. ${p.name || "Titik"}`, p }))], [point, points]);
  const A = refOptions.find((o) => o.id === aSel)?.p ?? null;
  const Bp = refOptions.find((o) => o.id === bSel)?.p ?? null;
  const inv = A && Bp ? inverse(A, Bp) : null;
  const stats = useMemo(() => {
    if (!points.length) return null;
    return { len: pathLength(points), lenClosed: pathLength(points, true), area: polygonArea(points), cen: centroid(points), bbox: bboxOf(points) };
  }, [points]);
  const destPt = A ? destination(A, dBearing, fromUnit(dDist, dUnit)) : null;

  // ── generate ──
  useEffect(() => { if (tab === "generate" && !countryList.length) countryNames().then(setCountryList).catch(() => {}); }, [tab, countryList.length]);

  const viewBBox = (): BBox | null => {
    const map = mapRef.current;
    if (!map) return null;
    const b = map.getBounds();
    return { south: clamp(b.getSouth(), -90, 90), north: clamp(b.getNorth(), -90, 90), west: normLng(b.getWest()), east: normLng(b.getEast()) };
  };

  const runGenerate = async (replace: boolean) => {
    setGBusy(true);
    try {
      const rng = gSeed.trim() ? seededRng(parseInt(gSeed, 10) || 1) : Math.random;
      const n = clamp(Math.round(gCount), 1, MAX_GENERATED);
      let pts: LatLng[] = [];
      const origin = point ?? A;
      switch (gMode) {
        case "rand-view": { const b = viewBBox(); if (b) pts = randomInBBox(n, b, rng); break; }
        case "rand-country": pts = await randomInCountry(gCountry, n, rng); if (!pts.length) { setNote("warning", "Negara tidak ditemukan pada data offline."); return; } break;
        case "rand-radius": if (!origin) { setNote("warning", "Pilih titik di peta dulu sebagai pusat."); return; } pts = randomInCircle(n, origin, fromUnit(gRadius, gRUnit), rng); break;
        case "circle": if (!origin) { setNote("warning", "Pilih titik di peta dulu sebagai pusat lingkaran."); return; } pts = circlePoints(n, origin, fromUnit(gRadius, gRUnit), gStart); break;
        case "grid": {
          const b = viewBBox();
          if (!b) return;
          pts = gStepUnit === "deg" ? gridPoints(b, gStep) : gridPointsMeters(b, gStep * 1000);
          if (pts.length > MAX_GENERATED) { setNote("warning", `Grid menghasilkan lebih dari ${MAX_GENERATED} titik — perbesar langkah atau perkecil area peta.`); return; }
          break;
        }
        case "line": if (!A || !Bp) { setNote("warning", "Pilih titik A dan B (tab Ukur) atau tambahkan minimal 2 titik ke daftar."); return; } pts = linePoints(A, Bp, Math.max(2, n)); break;
      }
      if (!pts.length) { setNote("warning", "Tidak ada titik yang dihasilkan."); return; }
      const named = pts.map((p, i) => ({ id: pointId(), name: `${gPrefix} ${i + 1}`, lat: p.lat, lng: p.lng }));
      addPoints(named, replace);
      setNote("success", `${named.length} titik dibuat dan ${replace ? "menggantikan" : "ditambahkan ke"} daftar.`);
      setTab("daftar");
      setTimeout(fitAll, 50);
    } finally { setGBusy(false); }
  };

  const toggleFullscreen = () => {
    const el = wrapEl.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
    setTimeout(() => mapRef.current?.invalidateSize(), 300);
  };

  const tabs = [
    { id: "koordinat" as const, label: "Koordinat", icon: <MapPin className="w-3.5 h-3.5" /> },
    { id: "daftar" as const, label: `Daftar (${points.length})`, icon: <Layers className="w-3.5 h-3.5" /> },
    { id: "ukur" as const, label: "Ukur", icon: <Ruler className="w-3.5 h-3.5" /> },
    { id: "generate" as const, label: "Generate", icon: <Shuffle className="w-3.5 h-3.5" /> },
    { id: "peta" as const, label: "Peta", icon: <Globe2 className="w-3.5 h-3.5" /> },
  ];

  const CopyBtn: React.FC<{ k: string; text: string }> = ({ k, text }) => (
    <button type="button" onClick={() => copy(k, text)} aria-label={`Salin ${k}`} data-testid={`copy-${k}`} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 shrink-0">
      {copied === k ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  const unitSelect = (value: DistUnit, onChange: (u: DistUnit) => void, label = "Satuan", testId?: string) => (
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value as DistUnit)} data-testid={testId}>
      {DIST_UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
    </Select>
  );

  return (
    <div className="space-y-4">
      <GamatoDesktopRecommended toolName="Alat Koordinat" />
      {/* Bilah pencarian */}
      <div className={cn(card, "!p-4 space-y-3")} data-testid="co-searchbar">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }} placeholder="Cari tempat (mis. Monas Jakarta) atau tempel koordinat / Plus Code / UTM / MGRS / tautan Google Maps" data-testid="co-query" />
          </div>
          <div className="md:w-48">
            <Select value={hint} onChange={(e) => setHint(e.target.value as ParsedKind | "auto")} data-testid="co-hint">
              <option value="auto">Format: otomatis</option>
              <option value="dd">Desimal / DMS / DDM</option>
              <option value="utm">UTM</option>
              <option value="mgrs">MGRS</option>
              <option value="pluscode">Plus Code</option>
              <option value="geohash">Geohash</option>
              <option value="maidenhead">Maidenhead</option>
              <option value="url">Tautan peta</option>
            </Select>
          </div>
          <Btn onClick={doSearch} disabled={searching || !query.trim()} data-testid="co-go" className="md:w-32">{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}Cari</Btn>
          <Btn variant="secondary" onClick={locate} data-testid="co-locate" title="Lokasi saya"><Locate className="w-4 h-4" /><span className="md:hidden lg:inline">Lokasi saya</span></Btn>
        </div>
        {results.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto" data-testid="co-results">
            {results.map((r, i) => (
              <button key={i} type="button" data-testid="co-result" onClick={() => { selectPoint({ lat: r.lat, lng: r.lng }, { fly: true, zoom: 15 }); setPointName(r.name.split(",")[0]); setResults([]); setTab("koordinat"); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm">
                <span className="block font-semibold text-slate-800 dark:text-slate-100 truncate">{r.name}</span>
                <span className="block text-[11px] text-slate-400">{r.lat.toFixed(5)}, {r.lng.toFixed(5)}{r.type ? ` · ${r.type}` : ""}</span>
              </button>
            ))}
          </div>
        )}
        {info && <GamatoInlineAlert message={info.msg} tone={info.tone} />}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_430px] gap-6 items-start">
        {/* KIRI: peta */}
        <div className="space-y-3 min-w-0 xl:sticky xl:top-24">
          <div ref={wrapEl} className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-900" data-testid="co-mapwrap">
            <div ref={mapEl} data-testid="co-map" style={{ height: "min(62vh, 560px)", minHeight: 360, width: "100%" }} />
            {crosshair && <div ref={crossRef} className="pointer-events-none absolute inset-0 flex items-center justify-center" data-testid="co-crosshair"><Crosshair className="w-8 h-8 text-red-500 drop-shadow" /></div>}
            <div className="absolute top-3 right-3 z-[500] flex flex-col gap-2">
              <button type="button" onClick={toggleFullscreen} title="Layar penuh" aria-label="Layar penuh" className="w-9 h-9 rounded-xl bg-white/95 dark:bg-slate-800/95 shadow border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-200"><Maximize2 className="w-4 h-4" /></button>
              <button type="button" onClick={() => { setCrosshair((v) => !v); }} title="Bidik tengah peta" aria-label="Bidik tengah peta" data-testid="co-cross-btn" className={cn("w-9 h-9 rounded-xl shadow border flex items-center justify-center", crosshair ? "bg-red-500 text-white border-red-500" : "bg-white/95 dark:bg-slate-800/95 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-600")}><Crosshair className="w-4 h-4" /></button>
              {crosshair && <button type="button" onClick={() => selectPoint(view.c, { fly: false })} title="Jadikan pusat peta sebagai titik" data-testid="co-use-center" className="w-9 h-9 rounded-xl bg-indigo-600 text-white shadow flex items-center justify-center"><Navigation className="w-4 h-4" /></button>}
            </div>
            {tileWarn && base !== "offline" && (
              <div className="absolute bottom-10 left-3 right-3 z-[500] text-[11px] rounded-lg bg-amber-50/95 text-amber-800 border border-amber-200 px-3 py-1.5" data-testid="co-tilewarn">Ubin peta online tidak bisa dimuat (offline/diblokir) — tampil peta dunia vektor offline. Semua konversi koordinat tetap berfungsi.</div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400" data-testid="co-statusbar">
            <span data-testid="co-cursor">Kursor: {cursor ? fmtDD(cursor, 5) : "—"}</span>
            <span data-testid="co-view">Pusat: {fmtDD(view.c, 4)} · Zoom {view.z.toFixed(0)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {BASES.map((b) => (
              <button key={b.id} type="button" data-testid={`co-base-${b.id}`} onClick={() => setBase(b.id)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all", base === b.id ? "bg-slate-900 dark:bg-indigo-600 text-white border-slate-900 dark:border-indigo-600" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300")}>{b.label}</button>
            ))}
          </div>
          {!offlineReady && <p className="text-[11px] text-slate-400"><Loader2 className="inline w-3 h-3 animate-spin mr-1" />Memuat peta dunia offline…</p>}
        </div>

        {/* KANAN: panel */}
        <div className="space-y-4 min-w-0">
          <SettingsTabBar tabs={tabs} active={tab} onChange={(t) => setTab(t)} />

          {tab === "koordinat" && (
            <div className={card} data-testid="co-tab-koordinat">
              {!point ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Klik peta, cari tempat, atau tempel koordinat di kolom atas untuk memilih titik. Titik merah bisa diseret.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className={cap}>Titik Terpilih</p>
                    <button type="button" className="text-xs font-semibold text-indigo-600 hover:underline" onClick={() => copy("all", formats.map((f) => `${f.label}: ${f.value}`).join("\n"))} data-testid="co-copy-all">{copied === "all" ? "Disalin ✓" : "Salin semua format"}</button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700" data-testid="co-formats">
                    {formats.map((f) => (
                      <div key={f.key} className="flex items-center gap-2 px-3 py-2" data-testid={`co-fmt-${f.key}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-400">{f.label}</p>
                          <p className="text-sm font-mono text-slate-800 dark:text-slate-100 break-all" data-testid={`co-val-${f.key}`}>{f.value}</p>
                        </div>
                        <CopyBtn k={f.key} text={f.value} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><p className="text-[11px] text-slate-400">Negara (offline)</p><p className="font-semibold text-slate-800 dark:text-slate-100" data-testid="co-country">{country === undefined ? "…" : country ?? "Di luar daratan / perairan"}</p></div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><p className="text-[11px] text-slate-400">Ketinggian</p><p className="font-semibold text-slate-800 dark:text-slate-100 text-xs" data-testid="co-elev">{elev ?? "—"}</p></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="secondary" onClick={() => reverse(point)} disabled={!!busyNet} data-testid="co-reverse"><Search className="w-4 h-4" />Cari alamat</Btn>
                    <Btn variant="secondary" onClick={getElevation} disabled={!!busyNet} data-testid="co-elev-btn"><Mountain className="w-4 h-4" />Ketinggian</Btn>
                    <Btn variant="secondary" onClick={() => flyTo(point, 16)}><Navigation className="w-4 h-4" />Pusatkan</Btn>
                  </div>
                  {busyNet && <p className="text-xs text-slate-400"><Loader2 className="inline w-3 h-3 animate-spin mr-1" />{busyNet}</p>}
                  {address && <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 p-3 text-sm text-indigo-900 dark:text-indigo-100" data-testid="co-address">{address}</div>}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                    <div className="flex items-center gap-2"><Sunrise className="w-4 h-4 text-amber-500" /><p className="text-sm font-bold text-slate-700 dark:text-slate-200">Matahari</p></div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Tanggal" type="date" value={sunDate} onChange={(e) => setSunDate(e.target.value)} />
                      <Select label="Zona waktu" value={String(sunOff)} onChange={(e) => setSunOff(parseFloat(e.target.value))}>
                        {Array.from(new Set([sunOff, ...OFFSETS])).sort((a, b) => a - b).map((o) => <option key={o} value={o}>{fmtOffset(o)}</option>)}
                      </Select>
                    </div>
                    {sun && (
                      <div className="grid grid-cols-3 gap-2 text-center text-sm" data-testid="co-sun">
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-2"><p className="text-[11px] text-slate-400">Terbit</p><p className="font-bold" data-testid="co-sunrise">{sun.polar ? (sun.polar === "day" ? "Siang terus" : "Malam terus") : timeAt(sun.sunrise, sunOff)}</p></div>
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2"><p className="text-[11px] text-slate-400">Tengah hari</p><p className="font-bold">{timeAt(sun.solarNoon, sunOff)}</p></div>
                        <div className="rounded-xl bg-orange-50 dark:bg-orange-500/10 p-2"><p className="text-[11px] text-slate-400">Terbenam</p><p className="font-bold" data-testid="co-sunset">{sun.polar ? "—" : timeAt(sun.sunset, sunOff)}</p></div>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Buka di aplikasi peta</p>
                    <div className="flex flex-wrap gap-2">
                      {links.map((l) => (
                        <a key={l.label} href={l.url} target={l.url.startsWith("geo:") ? undefined : "_blank"} rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600"><ExternalLink className="w-3 h-3" />{l.label}</a>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex gap-2 items-end">
                    <div className="flex-1"><Input label="Nama titik (opsional)" value={pointName} onChange={(e) => setPointName(e.target.value)} placeholder="mis. Kantor" data-testid="co-name" /></div>
                    <Btn onClick={addCurrent} data-testid="co-add"><Plus className="w-4 h-4" />Simpan ke daftar</Btn>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "daftar" && (
            <div className={card} data-testid="co-tab-daftar">
              <div className="flex flex-wrap gap-2">
                <Btn variant="secondary" onClick={() => importRef.current?.click()} data-testid="co-import-btn"><Upload className="w-4 h-4" />Impor berkas</Btn>
                <input ref={importRef} type="file" accept=".csv,.txt,.json,.geojson,.kml,.gpx,text/*,application/json" className="hidden" data-testid="co-import" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importText(await f.text(), f.name); e.target.value = ""; }} />
                <Btn variant="secondary" onClick={fitAll} disabled={!points.length}>Tampilkan semua</Btn>
                <Btn variant="ghost" onClick={() => { setPoints([]); }} disabled={!points.length} data-testid="co-clear"><Trash2 className="w-4 h-4" />Kosongkan</Btn>
              </div>
              <Textarea label="Tempel daftar koordinat (satu per baris, atau CSV/GeoJSON/KML/GPX)" rows={3} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder={"-6.2088, 106.8456\nBandung\t-6.9175, 107.6191"} className="font-mono text-xs" data-testid="co-paste" />
              <Btn variant="secondary" onClick={() => { importText(pasteText); setPasteText(""); }} disabled={!pasteText.trim()} data-testid="co-paste-go">Tambahkan dari teks</Btn>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Hubungkan titik" value={shape} onChange={(e) => setShape(e.target.value as "none" | "line" | "polygon")} data-testid="co-shape"><option value="none">Hanya titik</option><option value="line">Garis (rute)</option><option value="polygon">Poligon (area)</option></Select>
                <Select label="Klik peta" value={clickMode} onChange={(e) => setClickMode(e.target.value as "select" | "add")} data-testid="co-clickmode"><option value="select">Pilih titik</option><option value="add">Tambah ke daftar</option></Select>
              </div>
              {points.length === 0 ? <p className="text-xs text-slate-400">Daftar kosong. Tambahkan dari tab Koordinat, impor berkas, atau buat lewat tab Generate.</p> : (
                <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1" data-testid="co-list">
                  {points.map((p, i) => (
                    <div key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 space-y-2" data-testid="co-item">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { setPoint({ lat: p.lat, lng: p.lng }); flyTo(p, 15); }} className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold shrink-0" aria-label="Lihat di peta">{i + 1}</button>
                        <input value={p.name} onChange={(e) => patchPoint(p.id, { name: e.target.value })} className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm text-slate-800 dark:text-slate-100" aria-label="Nama" />
                        <button type="button" disabled={i === 0} onClick={() => movePoint(i, -1)} className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20" aria-label="Naik"><ChevronUp className="w-4 h-4" /></button>
                        <button type="button" disabled={i === points.length - 1} onClick={() => movePoint(i, 1)} className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-20" aria-label="Turun"><ChevronDown className="w-4 h-4" /></button>
                        <button type="button" onClick={() => setPoints((s) => s.filter((x) => x.id !== p.id))} className="p-1 text-slate-400 hover:text-red-500" aria-label="Hapus" data-testid="co-del"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={String(p.lat)} onChange={(e) => { const v = parseFloat(e.target.value.replace(",", ".")); if (Number.isFinite(v) && Math.abs(v) <= 90) patchPoint(p.id, { lat: v }); }} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono text-slate-700 dark:text-slate-200" aria-label="Lintang" />
                        <input value={String(p.lng)} onChange={(e) => { const v = parseFloat(e.target.value.replace(",", ".")); if (Number.isFinite(v) && Math.abs(v) <= 180) patchPoint(p.id, { lng: v }); }} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono text-slate-700 dark:text-slate-200" aria-label="Bujur" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {points.length > 0 && (
                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <p className={cap}>Ekspor ({points.length} titik)</p>
                  <div className="flex flex-wrap gap-2" data-testid="co-exports">
                    {([["csv", "CSV"], ["csvx", "CSV + UTM/MGRS/Plus Code"], ["geojson", "GeoJSON"], ["kml", "KML"], ["gpx", "GPX"], ["txt", "Teks"]] as const).map(([k, l]) => (
                      <Btn key={k} variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => exportAs(k)} data-testid={`co-export-${k}`}><Download className="w-3.5 h-3.5" />{l}</Btn>
                    ))}
                    <Btn variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => copy("list", toPlainText(points))}><Copy className="w-3.5 h-3.5" />{copied === "list" ? "Disalin ✓" : "Salin teks"}</Btn>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "ukur" && (
            <div className={card} data-testid="co-tab-ukur">
              <p className={cap}>Jarak & Arah Dua Titik</p>
              <div className="grid grid-cols-2 gap-3">
                <Select label="Titik A" value={aSel} onChange={(e) => setASel(e.target.value)} data-testid="co-a">{refOptions.map((o) => <option key={o.id} value={o.id} disabled={!o.p}>{o.label}{o.p ? "" : " (belum ada)"}</option>)}</Select>
                <Select label="Titik B" value={bSel} onChange={(e) => setBSel(e.target.value)} data-testid="co-b">{refOptions.map((o) => <option key={o.id} value={o.id} disabled={!o.p}>{o.label}{o.p ? "" : " (belum ada)"}</option>)}</Select>
              </div>
              {unitSelect(unit, setUnit, "Satuan jarak", "co-unit")}
              {inv && A && Bp ? (
                <div className="space-y-2 text-sm" data-testid="co-measure">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 p-3"><p className="text-[11px] text-slate-400">Jarak ({inv.method === "vincenty" ? "elipsoid WGS-84" : "haversine"})</p><p className="text-lg font-bold text-indigo-700 dark:text-indigo-200" data-testid="co-dist">{toUnit(inv.distance, unit).toLocaleString("id-ID", { maximumFractionDigits: 3 })} {unit}</p></div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><p className="text-[11px] text-slate-400">Jarak bola (haversine)</p><p className="font-bold" data-testid="co-dist-hav">{toUnit(haversine(A, Bp), unit).toLocaleString("id-ID", { maximumFractionDigits: 3 })} {unit}</p></div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><p className="text-[11px] text-slate-400">Arah awal A→B</p><p className="font-bold" data-testid="co-bearing">{inv.initial.toFixed(2)}° ({compass(inv.initial)})</p></div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><p className="text-[11px] text-slate-400">Arah akhir (tiba)</p><p className="font-bold">{inv.final.toFixed(2)}° ({compass(inv.final)})</p></div>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0"><p className="text-[11px] text-slate-400">Titik tengah (great-circle)</p><p className="font-mono text-xs" data-testid="co-mid">{fmtDD(midpoint(A, Bp), 6)}</p></div>
                    <Btn variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => { const m = midpoint(A, Bp); addPoints([{ id: pointId(), name: "Titik tengah", ...m }]); selectPoint(m, { fly: false }); }}>Tambah</Btn>
                  </div>
                </div>
              ) : <p className="text-xs text-slate-400">Pilih dua titik berbeda (titik saat ini dan/atau daftar).</p>}

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                <p className={cap}>Titik Tujuan (dari Titik A)</p>
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Arah (°)" type="number" min={0} max={360} value={dBearing} onChange={(e) => setDBearing(parseFloat(e.target.value) || 0)} data-testid="co-dbearing" />
                  <Input label="Jarak" type="number" min={0} value={dDist} onChange={(e) => setDDist(parseFloat(e.target.value) || 0)} data-testid="co-ddist" />
                  {unitSelect(dUnit, setDUnit, "Satuan")}
                </div>
                {destPt && (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0"><p className="text-[11px] text-slate-400">Tujuan</p><p className="font-mono text-xs" data-testid="co-dest">{fmtDD(destPt, 6)}</p></div>
                    <Btn variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => selectPoint(destPt, { fly: true })} data-testid="co-dest-go">Pilih</Btn>
                    <Btn variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => addPoints([{ id: pointId(), name: "Tujuan", ...destPt }])}>Tambah</Btn>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                <p className={cap}>Statistik Daftar Titik</p>
                {stats ? (
                  <div className="grid grid-cols-2 gap-2 text-sm" data-testid="co-stats">
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><p className="text-[11px] text-slate-400">Panjang jalur</p><p className="font-bold" data-testid="co-pathlen">{fmtDistance(stats.len)}</p></div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3"><p className="text-[11px] text-slate-400">Keliling (tertutup)</p><p className="font-bold">{fmtDistance(stats.lenClosed)}</p></div>
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 col-span-2"><p className="text-[11px] text-slate-400">Luas poligon (≥3 titik, perkiraan bola)</p><p className="font-bold" data-testid="co-area">{points.length >= 3 ? fmtArea(stats.area) : "—"}</p></div>
                    {stats.cen && <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 col-span-2 flex items-center gap-2"><div className="flex-1 min-w-0"><p className="text-[11px] text-slate-400">Titik pusat (centroid)</p><p className="font-mono text-xs">{fmtDD(stats.cen, 6)}</p></div><Btn variant="secondary" className="!px-3 !py-2 text-xs" onClick={() => selectPoint(stats.cen!, { fly: true, zoom: 10 })}>Pilih</Btn></div>}
                    {stats.bbox && <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 col-span-2"><p className="text-[11px] text-slate-400">Bounding box (S, W, N, E)</p><p className="font-mono text-xs break-all">{stats.bbox.south.toFixed(5)}, {stats.bbox.west.toFixed(5)}, {stats.bbox.north.toFixed(5)}, {stats.bbox.east.toFixed(5)}</p></div>}
                  </div>
                ) : <p className="text-xs text-slate-400">Tambahkan titik ke daftar untuk melihat panjang jalur, luas, dan pusat.</p>}
              </div>
            </div>
          )}

          {tab === "generate" && (
            <div className={card} data-testid="co-tab-generate">
              <Select label="Jenis" value={gMode} onChange={(e) => setGMode(e.target.value as typeof gMode)} data-testid="co-gmode">
                <option value="rand-view">Acak di area peta yang terlihat</option>
                <option value="rand-country">Acak di dalam negara</option>
                <option value="rand-radius">Acak dalam radius dari titik terpilih</option>
                <option value="grid">Grid (kisi) di area peta yang terlihat</option>
                <option value="circle">Titik melingkar di sekitar titik terpilih</option>
                <option value="line">Titik sepanjang garis A → B (tab Ukur)</option>
              </Select>
              {gMode === "rand-country" && (
                <Select label="Negara" value={gCountry} onChange={(e) => setGCountry(e.target.value)} data-testid="co-gcountry">
                  {(countryList.length ? countryList : [gCountry]).map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              )}
              {gMode !== "grid" && (
                <div><div className="flex justify-between mb-1.5"><Label>Jumlah titik</Label><span className="text-sm font-bold text-indigo-600" data-testid="co-gcount-val">{gCount}</span></div><GamatoSlider min={1} max={500} step={1} value={gCount} onChange={setGCount} aria-label="Jumlah" /></div>
              )}
              {(gMode === "rand-radius" || gMode === "circle") && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Radius" type="number" min={0} value={gRadius} onChange={(e) => setGRadius(parseFloat(e.target.value) || 0)} data-testid="co-gradius" />
                  {unitSelect(gRUnit, setGRUnit)}
                </div>
              )}
              {gMode === "circle" && <div><div className="flex justify-between mb-1.5"><Label>Arah titik pertama</Label><span className="text-sm font-bold text-indigo-600">{gStart}°</span></div><GamatoSlider min={0} max={359} step={1} value={gStart} onChange={setGStart} aria-label="Arah" /></div>}
              {gMode === "grid" && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Jarak antar titik" type="number" min={0.0001} step="any" value={gStep} onChange={(e) => setGStep(parseFloat(e.target.value) || 1)} data-testid="co-gstep" />
                  <Select label="Satuan" value={gStepUnit} onChange={(e) => setGStepUnit(e.target.value as "deg" | "km")}><option value="deg">derajat</option><option value="km">kilometer</option></Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Input label="Awalan nama" value={gPrefix} onChange={(e) => setGPrefix(e.target.value)} />
                {["rand-view", "rand-country", "rand-radius"].includes(gMode) && <Input label="Seed (opsional)" value={gSeed} onChange={(e) => setGSeed(e.target.value.replace(/[^0-9]/g, ""))} placeholder="hasil bisa diulang" data-testid="co-gseed" />}
              </div>
              <p className="text-[11px] text-slate-400">Maksimum {MAX_GENERATED} titik. Titik dibuat merata di permukaan bumi (bukan menumpuk di kutub).</p>
              <div className="flex gap-2">
                <Btn onClick={() => runGenerate(false)} disabled={gBusy} className="flex-1" data-testid="co-generate">{gBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}Buat & tambahkan</Btn>
                <Btn variant="secondary" onClick={() => runGenerate(true)} disabled={gBusy} data-testid="co-generate-replace">Ganti daftar</Btn>
              </div>
            </div>
          )}

          {tab === "peta" && (
            <div className={card} data-testid="co-tab-peta">
              <p className={cap}>Tampilan Peta</p>
              <GamatoCheckbox checked={graticule} onChange={setGraticule} testId="co-grat" label={<span className="text-sm text-slate-600 dark:text-slate-300">Garis lintang/bujur (graticule) — jarak menyesuaikan zoom</span>} />
              <GamatoCheckbox checked={autoReverse} onChange={setAutoReverse} testId="co-autorev" label={<span className="text-sm text-slate-600 dark:text-slate-300">Cari alamat otomatis tiap klik <span className="text-slate-400">(mengirim koordinat ke OpenStreetMap)</span></span>} />
              <div className="grid grid-cols-2 gap-3 items-end">
                <Input label="Lingkaran radius di titik" type="number" min={0} value={circleR} onChange={(e) => setCircleR(Math.max(0, parseFloat(e.target.value) || 0))} data-testid="co-circle" />
                {unitSelect(circleUnit, setCircleUnit)}
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p><b>Privasi:</b> konversi, parsing, jarak, daftar titik, ekspor, dan deteksi negara berjalan <b>sepenuhnya offline</b> di perangkat.</p>
                <p>Hanya ubin peta (OpenStreetMap/OpenTopoMap/Esri/CARTO), pencarian tempat/alamat (Nominatim), dan ketinggian (Open-Meteo) memakai internet — dan baru dipanggil bila Anda memakainya. Pilih “Peta dunia offline” untuk tanpa jaringan.</p>
              </div>
            </div>
          )}

          <ToolInfoPanel
            icon={<Compass className="w-5 h-5" />}
            label="Koordinat"
            desc="Cari · pratinjau · konversi · generate"
            points={[
              "Klik peta, seret penanda, cari tempat, atau tempel koordinat dalam format apa pun (DD, DMS, DDM, UTM, MGRS, Plus Code, Geohash, tautan peta).",
              "Semua format sekaligus: DD, DMS, DDM, UTM, MGRS, Plus Code, Geohash, Maidenhead, Web Mercator, ubin XYZ.",
              "Ukur jarak (elipsoid WGS-84), arah, titik tengah, titik tujuan; panjang jalur & luas dari daftar titik.",
              "Generate titik acak (area/negara/radius), grid, lingkaran, garis; impor/ekspor CSV, GeoJSON, KML, GPX.",
              "Peta dunia offline bawaan; ubin & pencarian online hanya bila dipakai.",
            ]}
          />
        </div>
      </div>
    </div>
  );
};
