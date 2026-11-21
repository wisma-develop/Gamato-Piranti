import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, ImagePlus, Loader2, Package, Plus, Trash2, Upload, Users, X, UserPlus } from "lucide-react";
import { Btn, Input, Label, Textarea } from "@/components/ui/primitives";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoSelect } from "@/components/ui/GamatoSelect";
import { PanelCard } from "@/components/ui/PanelCard";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { readXlsxGrid } from "@/lib/officeReaders";
import { NT_FIELD_KEYS, NT_FIELD_LABEL, roleColor, type NametagDesign, type NtField, type NtRecord } from "@/lib/nametagTypes";
import {
  BulkCancelled, MAX_BULK_ROWS, NT_MAP_KEYS, SAMPLE_TABLE, autoMap, buildRecords, csvTemplate, defaultAutoId, exportNtPdf, exportNtSheet, exportNtZip,
  ingestPhoto, ntSheetLayout, parseTable, photoKey, recordsToCsv, roleSummary, sortIndices,
  type NtAutoId, type NtColumnMap, type NtMapKey, type NtSortKey, type SheetPaper, NO_ROLE } from "@/lib/nametagBulk";
import { tr } from "@/i18n";

type Mode = "zip" | "pdf" | "sheet";

interface Props {
  design: NametagDesign;
  base: NtRecord;
  cache: Map<string, HTMLImageElement>;
  onPreview: (rec: NtRecord | null) => void;
  onAddRole: (role: string) => void;
}

const colLabel = (headers: string[], i: number) => `${i + 1}. ${headers[i] || tr("Kolom {0}", i + 1)}`;
const MAP_LABEL: Record<NtMapKey, string> = { ...NT_FIELD_LABEL, photo: tr("Foto (nama berkas)") };

export const NametagBulk: React.FC<Props> = ({ design, base, cache, onPreview, onAddRole }) => {
  const [text, setText] = useState("");
  const [grid, setGrid] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [map, setMap] = useState<NtColumnMap | null>(null);
  const [auto, setAuto] = useState<NtAutoId>(defaultAutoId());
  const [edits, setEdits] = useState<Record<number, Partial<NtRecord>>>({});
  const [photos, setPhotos] = useState<Map<string, string>>(new Map());
  const [photoBusy, setPhotoBusy] = useState(false);
  const [sortBy, setSortBy] = useState<NtSortKey>("asli");
  const [sel, setSel] = useState(0);
  const [showInput, setShowInput] = useState(true);
  const [sides, setSides] = useState<"front" | "both">("front");
  const [dpi, setDpi] = useState<12 | 24>(12);
  const [mode, setMode] = useState<Mode>("sheet");
  const [paper, setPaper] = useState<SheetPaper>("a4");
  const [landscape, setLandscape] = useState(false);
  const [margin, setMargin] = useState(8);
  const [gap, setGap] = useState(4);
  const [marks, setMarks] = useState(true);
  const [mirror, setMirror] = useState(true);
  const [tent, setTent] = useState(false);
  const [busy, setBusy] = useState<null | { done: number; total: number }>(null);
  const [info, setInfo] = useState<{ type: "success" | "error" | "warning" | "info"; text: string } | null>(null);
  const cancelRef = useRef({ cancelled: false });
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const photoUrlsRef = useRef<string[]>([]);

  useEffect(() => () => { photoUrlsRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  const headers = useMemo(() => (grid.length ? (hasHeader ? grid[0] : grid[0].map((_, i) => tr("Kolom {0}", i + 1))) : []), [grid, hasHeader]);
  const dataRows = useMemo(() => (hasHeader ? grid.slice(1) : grid), [grid, hasHeader]);

  useEffect(() => {
    if (headers.length) setMap(autoMap(headers));
    else setMap(null);
  }, [headers.join("\u0001")]); // eslint-disable-line react-hooks/exhaustive-deps

  const built = useMemo(() => {
    if (!map) return [] as NtRecord[];
    return buildRecords(dataRows, map, base, auto, photos).map((r, i) => ({ ...r, ...(edits[i] ?? {}) }));
  }, [dataRows, map, base, auto, photos, edits]);

  const order = useMemo(() => sortIndices(built, sortBy, design), [built, sortBy, design]);
  const view = useMemo(() => order.map((i) => ({ r: built[i], i })), [order, built]);
  const records = useMemo(() => view.map((v) => v.r), [view]);

  const cur = Math.min(sel, Math.max(0, records.length - 1));
  useEffect(() => { onPreview(records.length ? records[cur] : null); }, [records, cur]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPreview(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => roleSummary(records, design), [records, design]);
  const unknownRoles = summary.filter((s) => !s.known && s.role !== NO_ROLE);
  const noName = records.filter((r) => !r.name.trim()).length;
  const dupIds = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of records) { const k = r.id.trim(); if (k) seen.set(k, (seen.get(k) ?? 0) + 1); }
    return [...seen.values()].filter((n) => n > 1).length;
  }, [records]);
  const withPhoto = records.filter((r) => !!r.photo).length;

  const applyText = (t: string) => {
    const g = parseTable(t);
    if (!g.length) { setInfo({ type: "warning", text: tr("Tidak ada data yang bisa dibaca.") }); return false; }
    const w = Math.max(...g.map((r) => r.length));
    const normed = g.map((r) => Array.from({ length: w }, (_, i) => r[i] ?? ""));
    const rows = hasHeader ? normed.length - 1 : normed.length;
    if (rows < 1) { setInfo({ type: "warning", text: tr("Hanya ada baris header — tambahkan baris data.") }); return false; }
    setGrid(normed); setEdits({}); setSel(0); setShowInput(false);
    setInfo(rows > MAX_BULK_ROWS ? { type: "warning", text: tr("Data {0} baris — hanya {1} baris pertama yang diproses.", rows, MAX_BULK_ROWS) } : { type: "success", text: tr("{0} baris data dimuat.", Math.min(rows, MAX_BULK_ROWS)) });
    return true;
  };

  const onFile = async (f: File | undefined | null) => {
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) {
        const g = await readXlsxGrid(f);
        const t = g.map((r) => r.map((c) => (/[\t\n"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join("\t")).join("\n");
        setText(t); applyText(t);
      } else {
        const t = await f.text();
        setText(t); applyText(t);
      }
    } catch {
      setInfo({ type: "error", text: tr("Berkas tidak bisa dibaca. Gunakan CSV, TSV, TXT, atau XLSX.") });
    }
  };

  const addPhotos = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setPhotoBusy(true);
    try {
      const next = new Map(photos);
      for (const f of list) {
        const key = photoKey(f.name);
        if (!key) continue;
        const old = next.get(key);
        if (old) { URL.revokeObjectURL(old); cache.delete(old); }
        const url = await ingestPhoto(f);
        photoUrlsRef.current.push(url);
        next.set(key, url);
      }
      setPhotos(next);
      setInfo({ type: "success", text: tr("{0} foto dimuat (total {1}). Foto dicocokkan lewat kolom Foto atau Nama.", list.length, next.size) });
    } catch {
      setInfo({ type: "error", text: tr("Sebagian foto tidak bisa dibaca.") });
    } finally { setPhotoBusy(false); }
  };
  const clearPhotos = () => {
    photos.forEach((u) => { URL.revokeObjectURL(u); cache.delete(u); });
    photoUrlsRef.current = [];
    setPhotos(new Map());
  };

  const setCol = (f: NtMapKey, v: string) => setMap((m) => (m ? { ...m, [f]: v === "default" || v === "blank" || v === "auto" ? v : Number(v) } : m));
  const patchRecord = (i: number, p: Partial<NtRecord>) => setEdits((e) => ({ ...e, [i]: { ...(e[i] ?? {}), ...p } }));
  const addRow = () => { setGrid((g) => [...g, Array.from({ length: Math.max(1, g[0]?.length ?? 1) }, () => "")]); setSel(records.length); };
  const delRow = (i: number) => {
    const gi = hasHeader ? i + 1 : i;
    setGrid((g) => g.filter((_, k) => k !== gi));
    setEdits((e) => {
      const n: Record<number, Partial<NtRecord>> = {};
      for (const [k, v] of Object.entries(e)) { const kk = Number(k); if (kk < i) n[kk] = v; else if (kk > i) n[kk - 1] = v; }
      return n;
    });
    setSel((s) => Math.max(0, Math.min(s, records.length - 2)));
  };

  const sheet = useMemo(() => ({ paper, landscape, marginMm: margin, gapMm: gap, cropMarks: marks, duplexMirror: mirror, tentFold: tent }), [paper, landscape, margin, gap, marks, mirror, tent]);
  const layout = useMemo(() => ntSheetLayout(design, sheet), [design, sheet]);
  const perSides = tent ? 1 : sides === "both" ? 2 : 1;
  const pagesEst = layout.perPage ? Math.ceil(records.length / layout.perPage) * perSides : 0;

  const run = async () => {
    if (!records.length) return;
    cancelRef.current = { cancelled: false };
    setBusy({ done: 0, total: records.length * (sides === "both" ? 2 : 1) });
    setInfo(null);
    const common = { design, records, sides, cache, ppm: dpi, signal: cancelRef.current, onProgress: (p: { done: number; total: number }) => setBusy({ done: p.done, total: p.total }) };
    try {
      if (mode === "zip") {
        downloadBlob(await exportNtZip(common), "name-tag-massal.zip");
        setInfo({ type: "success", text: tr("{0} name tag{1} diekspor sebagai ZIP PNG.", records.length, sides === "both" ? tr(" (depan & belakang)") : "") });
      } else if (mode === "pdf") {
        downloadBlob(await exportNtPdf(common), "name-tag-massal.pdf");
        setInfo({ type: "success", text: tr("PDF {0} halaman (ukuran name tag) diunduh.", records.length * (sides === "both" ? 2 : 1)) });
      } else {
        const r = await exportNtSheet({ ...common, sheet });
        downloadBlob(r.blob, tent ? "name-tag-meja-lipat.pdf" : "name-tag-lembar-cetak.pdf");
        setInfo({ type: "success", text: tr("Lembar cetak {0} halaman ({1} {2}/halaman) diunduh.", r.pages, r.perPage, tent ? tr("meja nama") : tr("name tag")) });
      }
    } catch (e: any) {
      if (e instanceof BulkCancelled) setInfo({ type: "info", text: tr("Dibatalkan.") });
      else setInfo({ type: "error", text: e?.message || tr("Ekspor gagal.") });
    } finally { setBusy(null); }
  };

  const tableReady = !!map && records.length > 0;

  return (
    <div className="space-y-4" data-testid="ntb-panel">
      <PanelCard title={tr("Data Massal")} subtitle={tr("Tempel dari Excel/Google Sheets, atau unggah CSV / TSV / XLSX — satu baris = satu name tag")}>
        {showInput || !grid.length ? (
          <div className="space-y-3">
            <Textarea label={tr("Tempel tabel di sini")} rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("Nama\tPeran\tInstansi\tID\nBudi\tPeserta\tPT Maju\tA-001")} className="font-mono text-xs" />
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => applyText(text)} disabled={!text.trim()} data-testid="ntb-apply"><Users className="w-4 h-4" />{tr("Terapkan data")}</Btn>
              <Btn variant="secondary" onClick={() => { setText(SAMPLE_TABLE); applyText(SAMPLE_TABLE); }} data-testid="ntb-sample">{tr("Contoh data")}</Btn>
              <Btn variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" />{tr("Unggah berkas")}</Btn>
              <Btn variant="ghost" onClick={() => downloadBlob(new Blob(["\uFEFF" + csvTemplate()], { type: "text/csv;charset=utf-8" }), "template-name-tag.csv")}><FileSpreadsheet className="w-4 h-4" />{tr("Template CSV")}</Btn>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,text/plain" className="hidden" data-testid="ntb-file" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            {grid.length > 0 && <button type="button" className="text-xs text-slate-500 underline" onClick={() => setShowInput(false)}>{tr("Batal ganti data")}</button>}
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200" data-testid="ntb-count">{tr("{0} name tag · {1} kolom", records.length, headers.length)}</span>
            <Btn variant="secondary" className="!py-1.5" onClick={() => setShowInput(true)}>{tr("Ganti data")}</Btn>
            <Btn variant="ghost" className="!py-1.5" onClick={() => { setGrid([]); setText(""); setEdits({}); setShowInput(true); }}><Trash2 className="w-4 h-4" />{tr("Kosongkan")}</Btn>
          </div>
        )}
        <GamatoCheckbox checked={hasHeader} onChange={setHasHeader} testId="ntb-header" label={<span className="text-sm text-slate-600 dark:text-slate-300">{tr("Baris pertama adalah header (judul kolom)")}</span>} />
        {info && <GamatoInlineAlert message={info.text} tone={info.type} />}
      </PanelCard>

      <PanelCard title={tr("Foto Peserta (opsional)")} subtitle={tr("Unggah banyak foto sekaligus — dicocokkan lewat nama berkas di kolom Foto, atau lewat Nama")}>
        <div className="flex flex-wrap items-center gap-2">
          <Btn variant="secondary" onClick={() => photoRef.current?.click()} disabled={photoBusy} data-testid="ntb-photos-btn">
            {photoBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}{tr("Unggah foto (banyak)")}
          </Btn>
          {photos.size > 0 && <Btn variant="ghost" onClick={clearPhotos}><Trash2 className="w-4 h-4" />{tr("Hapus {0} foto", photos.size)}</Btn>}
          <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" data-testid="ntb-photos" onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="ntb-photo-stat">{photos.size ? tr("{0} foto dimuat · {1} dari {2} name tag mendapat foto.", photos.size, withPhoto, records.length) : tr("Belum ada foto. Foto otomatis diperkecil agar hemat memori; tanpa foto, elemen Foto menampilkan siluet.")}</p>
      </PanelCard>

      {tableReady && map && (
        <PanelCard title={tr("Pemetaan Kolom")} subtitle={tr("Cocokkan kolom data dengan isian name tag. “Pakai data tetap” = nilai dari tab Data Peserta untuk semua name tag.")}>
          <div className="grid sm:grid-cols-2 gap-3">
            {NT_MAP_KEYS.map((f) => (
              <GamatoSelect key={f} label={MAP_LABEL[f]} value={String(map[f])} onChange={(e) => setCol(f, e.target.value)} data-testid={`ntb-map-${f}`}>
                <option value="default">{tr("— Pakai data tetap —")}</option>
                <option value="blank">{tr("— Kosongkan —")}</option>
                {f === "id" && <option value="auto">{tr("— Nomor otomatis —")}</option>}
                {headers.map((_, i) => <option key={i} value={String(i)}>{colLabel(headers, i)}</option>)}
              </GamatoSelect>
            ))}
          </div>
          {map.id === "auto" && (
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3" data-testid="ntb-auto-id">
              <Input label={tr("Awalan")} value={auto.prefix} onChange={(e) => setAuto({ ...auto, prefix: e.target.value })} />
              <Input label={tr("Mulai dari")} type="number" min={0} value={auto.start} onChange={(e) => setAuto({ ...auto, start: Math.max(0, Number(e.target.value) || 0) })} />
              <Input label={tr("Jumlah digit")} type="number" min={1} max={8} value={auto.digits} onChange={(e) => setAuto({ ...auto, digits: Math.min(8, Math.max(1, Number(e.target.value) || 1)) })} />
              <p className="col-span-3 text-xs text-slate-500">{tr("Contoh: {0}{1}, {2}{3}, …", auto.prefix, String(auto.start).padStart(auto.digits, "0"), auto.prefix, String(auto.start + 1).padStart(auto.digits, "0"))}</p>
            </div>
          )}
        </PanelCard>
      )}

      {tableReady && (
        <PanelCard title={tr("Daftar Name Tag ({0})", records.length)} subtitle={tr("Klik baris untuk pratinjau di name tag — pratinjau di atas mengikuti baris terpilih")}>
          {(noName > 0 || dupIds > 0 || unknownRoles.length > 0) && (
            <div className="space-y-2" data-testid="ntb-warnings">
              {noName > 0 && <GamatoInlineAlert tone="warning" message={tr("{0} baris belum punya nama.", noName)} />}
              {dupIds > 0 && <GamatoInlineAlert tone="warning" message={tr("{0} ID dipakai lebih dari satu orang — periksa kolom ID.", dupIds)} />}
              {unknownRoles.map((u) => (
                <div key={u.role} className="flex items-center gap-2 text-xs rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 px-3 py-2">
                  <span className="flex-1">{tr("Peran “{0}” ({1}) belum punya warna — memakai warna cadangan.", u.role, u.count)}</span>
                  <button type="button" onClick={() => onAddRole(u.role)} data-testid="ntb-add-role" className="inline-flex items-center gap-1 font-semibold underline"><UserPlus className="w-3 h-3" />{tr("Tambahkan")}</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5" data-testid="ntb-roles">
            {summary.map((s) => (
              <span key={s.role} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />{s.role} · {s.count}
              </span>
            ))}
          </div>
          <GamatoSelect label={tr("Urutkan")} value={sortBy} onChange={(e) => { setSortBy(e.target.value as NtSortKey); setSel(0); }} data-testid="ntb-sort">
            <option value="asli">{tr("Urutan data asli")}</option>
            <option value="nama">{tr("Nama (A → Z)")}</option>
            <option value="peran">{tr("Peran (sesuai tabel peran)")}</option>
            <option value="grup">{tr("Grup / Meja / Kelas")}</option>
          </GamatoSelect>
          <div className="flex items-center gap-2">
            <Btn variant="secondary" className="!px-3" onClick={() => setSel(Math.max(0, cur - 1))} disabled={cur <= 0} data-testid="ntb-prev"><ChevronLeft className="w-4 h-4" /></Btn>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1 text-center" data-testid="ntb-pos">{cur + 1} / {records.length}</span>
            <Btn variant="secondary" className="!px-3" onClick={() => setSel(Math.min(records.length - 1, cur + 1))} disabled={cur >= records.length - 1} data-testid="ntb-next"><ChevronRight className="w-4 h-4" /></Btn>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {view.map((v, k) => (
              <div key={v.i} data-testid="ntb-row" onClick={() => setSel(k)} className={cn("flex items-center gap-2 px-3 py-2 cursor-pointer text-sm", k === cur ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/60")}>
                <span className="w-7 text-xs text-slate-400 shrink-0">{k + 1}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: roleColor(design, v.r.role) }} />
                <span className="flex-1 min-w-0 truncate"><b className="text-slate-800 dark:text-slate-100">{v.r.name || tr("(tanpa nama)")}</b><span className="text-slate-400"> · {v.r.role || v.r.org}</span></span>
                {v.r.photo && <ImagePlus className="w-3 h-3 text-emerald-500 shrink-0" aria-label={tr("Ada foto")} />}
                <button type="button" aria-label={tr("Hapus baris")} onClick={(e) => { e.stopPropagation(); delRow(v.i); }} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <Btn variant="secondary" onClick={addRow} disabled={records.length >= MAX_BULK_ROWS} data-testid="ntb-add"><Plus className="w-4 h-4" />{tr("Tambah baris")}</Btn>
          {view[cur] && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
              <Label>{tr("Edit baris {0}", cur + 1)}</Label>
              <div className="grid sm:grid-cols-2 gap-3">
                {NT_FIELD_KEYS.map((f: NtField) => (
                  <Input key={f} label={NT_FIELD_LABEL[f]} value={view[cur].r[f] ?? ""} onChange={(e) => patchRecord(view[cur].i, { [f]: e.target.value })} data-testid={`ntb-edit-${f}`} />
                ))}
              </div>
            </div>
          )}
        </PanelCard>
      )}

      {tableReady && (
        <PanelCard title={tr("Hasil & Ekspor")} subtitle={tr("Desain yang sedang Anda edit di editor dipakai untuk semua name tag")}>
          <div className="grid grid-cols-2 gap-2">
            {([["front", tr("Depan saja")], ["both", tr("Depan + belakang")]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setSides(v)} data-testid={`ntb-sides-${v}`} className={cn("py-2.5 rounded-xl text-xs font-semibold border-2", sides === v ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>{l}</button>
            ))}
          </div>
          <GamatoSelect label={tr("Kualitas gambar")} value={String(dpi)} onChange={(e) => setDpi(Number(e.target.value) as 12 | 24)} data-testid="ntb-dpi">
            <option value="12">{tr("Standar — 300 dpi (cepat)")}</option>
            <option value="24">{tr("Tinggi — 600 dpi (lebih tajam, lebih besar)")}</option>
          </GamatoSelect>
          <div className="grid gap-2">
            {([["sheet", tr("PDF lembar cetak"), tr("Banyak name tag per halaman + tanda potong — langsung cetak & gunting"), <FileText key="s" className="w-4 h-4" />], ["zip", tr("ZIP gambar PNG"), tr("Satu PNG per orang, nama berkas otomatis"), <Package key="z" className="w-4 h-4" />], ["pdf", tr("PDF per name tag"), tr("Satu halaman per sisi, ukuran halaman = ukuran name tag"), <FileText key="p" className="w-4 h-4" />]] as const).map(([v, l, d, ic]) => (
              <button key={v} type="button" data-testid={`ntb-mode-${v}`} onClick={() => setMode(v)} className={cn("flex items-start gap-3 text-left p-3 rounded-xl border-2 transition-all", mode === v ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                <span className={cn("mt-0.5", mode === v ? "text-indigo-600" : "text-slate-400")}>{ic}</span>
                <span><span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{l}</span><span className="block text-[11px] text-slate-400">{d}</span></span>
              </button>
            ))}
          </div>
          {mode === "sheet" && (
            <div className="space-y-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3" data-testid="ntb-sheet-opts">
              <div className="grid grid-cols-2 gap-3">
                <GamatoSelect label="Kertas" value={paper} onChange={(e) => setPaper(e.target.value as SheetPaper)} data-testid="ntb-paper"><option value="a4">{tr("A4")}</option><option value="letter">{tr("Letter")}</option><option value="a3">{tr("A3")}</option></GamatoSelect>
                <GamatoSelect label={tr("Orientasi")} value={landscape ? "l" : "p"} onChange={(e) => setLandscape(e.target.value === "l")}><option value="p">{tr("Potret")}</option><option value="l">{tr("Lanskap")}</option></GamatoSelect>
              </div>
              <div><div className="flex justify-between mb-1.5"><Label>{tr("Margin")}</Label><span className="text-sm font-bold text-indigo-600">{tr("{0} mm", margin)}</span></div><GamatoSlider min={0} max={25} step={1} value={margin} onChange={setMargin} aria-label={tr("Margin")} /></div>
              <div><div className="flex justify-between mb-1.5"><Label>{tr("Jarak antar name tag")}</Label><span className="text-sm font-bold text-indigo-600">{tr("{0} mm", gap)}</span></div><GamatoSlider min={0} max={15} step={1} value={gap} onChange={setGap} aria-label={tr("Jarak")} /></div>
              <GamatoCheckbox checked={marks} onChange={setMarks} testId="ntb-marks" label={<span className="text-sm text-slate-600 dark:text-slate-300">{tr("Tanda potong (crop marks)")}{gap < 3 ? tr(" — jarak ≥ 3 mm disarankan") : ""}</span>} />
              <GamatoCheckbox checked={tent} onChange={setTent} testId="ntb-tent" label={<span className="text-sm text-slate-600 dark:text-slate-300">{tr("Mode meja nama lipat (tent card): tiap name tag dicetak 2× (atas terbalik) + garis lipat")}</span>} />
              {!tent && sides === "both" && <GamatoCheckbox checked={mirror} onChange={setMirror} label={<span className="text-sm text-slate-600 dark:text-slate-300">{tr("Susun belakang bolak-balik (flip sisi panjang)")}</span>} />}
              <p className="text-xs text-slate-500" data-testid="ntb-layout-info">{layout.perPage > 0 ? tr("{0} × {1} = {2} {3}/halaman → ±{4} halaman", layout.cols, layout.rows, layout.perPage, tent ? tr("meja nama") : tr("name tag"), pagesEst) : tr("Name tag tidak muat — kecilkan margin atau pilih kertas lebih besar.")}</p>
            </div>
          )}
          {busy && (
            <div className="space-y-1.5" data-testid="ntb-progress">
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round((busy.done / Math.max(1, busy.total)) * 100)}%` }} /></div>
              <p className="text-xs text-slate-500">{tr("{0}/{1} gambar dirender…", busy.done, busy.total)}</p>
            </div>
          )}
          <div className="flex gap-2">
            <Btn onClick={run} disabled={!!busy || (mode === "sheet" && layout.perPage < 1)} className="flex-1 py-3.5" data-testid="ntb-run">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" />{tr("Memproses…")}</> : <><Download className="w-4 h-4" />{tr("Buat {0} Name Tag", records.length)}</>}
            </Btn>
            {busy && <Btn variant="danger" onClick={() => { cancelRef.current.cancelled = true; }} data-testid="ntb-cancel"><X className="w-4 h-4" />{tr("Batal")}</Btn>}
          </div>
          <Btn variant="secondary" className="w-full" onClick={() => downloadBlob(new Blob(["\uFEFF" + recordsToCsv(records)], { type: "text/csv;charset=utf-8" }), "daftar-name-tag.csv")} data-testid="ntb-csv"><FileSpreadsheet className="w-4 h-4" />{tr("Unduh daftar akhir (CSV, termasuk ID otomatis)")}</Btn>
        </PanelCard>
      )}
    </div>
  );
};
