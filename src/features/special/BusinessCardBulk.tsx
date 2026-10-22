import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Package, Plus, Printer, Trash2, Upload, Users, X } from "lucide-react";
import { Btn, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { PanelCard } from "@/components/ui/PanelCard";
import { cn } from "@/utils/cn";
import { downloadBlob } from "@/lib/file";
import { readXlsxGrid } from "@/lib/officeReaders";
import { CONTACT_FIELD_KEYS, CONTACT_FIELD_LABEL, type CardDesign, type ContactData, type ContactField } from "@/lib/businessCardTypes";
import { cardPixelSize } from "@/lib/businessCardEngine";
import {
  BulkCancelled, MAX_BULK_ROWS, SAMPLE_TABLE, autoMap, buildRecords, csvTemplate, exportBulkPdf, exportBulkSheet, exportBulkZip, parseTable, sheetLayout, toVcf,
  type ColumnMap, type SheetPaper,
} from "@/lib/businessCardBulk";

type Mode = "zip" | "pdf" | "sheet";

interface Props {
  design: CardDesign;
  contact: ContactData;
  cache: Map<string, HTMLImageElement>;
  onPreview: (rec: ContactData | null) => void;
}

const colLabel = (headers: string[], i: number) => `${i + 1}. ${headers[i] || `Kolom ${i + 1}`}`;

export const BusinessCardBulk: React.FC<Props> = ({ design, contact, cache, onPreview }) => {
  const [text, setText] = useState("");
  const [grid, setGrid] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [map, setMap] = useState<ColumnMap | null>(null);
  const [edits, setEdits] = useState<Record<number, Partial<ContactData>>>({});
  const [sel, setSel] = useState(0);
  const [showInput, setShowInput] = useState(true);
  const [sides, setSides] = useState<"front" | "both">("front");
  const [mode, setMode] = useState<Mode>("zip");
  const [paper, setPaper] = useState<SheetPaper>("a4");
  const [landscape, setLandscape] = useState(false);
  const [margin, setMargin] = useState(8);
  const [gap, setGap] = useState(4);
  const [marks, setMarks] = useState(true);
  const [mirror, setMirror] = useState(true);
  const [busy, setBusy] = useState<null | { done: number; total: number; msg?: string }>(null);
  const [info, setInfo] = useState<{ type: "success" | "error" | "warning" | "info"; text: string } | null>(null);
  const cancelRef = useRef({ cancelled: false });
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = useMemo(() => (grid.length ? (hasHeader ? grid[0] : grid[0].map((_, i) => `Kolom ${i + 1}`)) : []), [grid, hasHeader]);
  const dataRows = useMemo(() => (hasHeader ? grid.slice(1) : grid), [grid, hasHeader]);

  // pemetaan otomatis saat data/header berubah
  useEffect(() => {
    if (headers.length) setMap(autoMap(headers));
    else setMap(null);
  }, [headers.join("\u0001")]); // eslint-disable-line react-hooks/exhaustive-deps

  const records = useMemo(() => {
    if (!map) return [] as ContactData[];
    return buildRecords(dataRows, map, contact).map((r, i) => ({ ...r, ...(edits[i] ?? {}) }));
  }, [dataRows, map, contact, edits]);

  const cur = Math.min(sel, Math.max(0, records.length - 1));
  useEffect(() => { onPreview(records.length ? records[cur] : null); }, [records, cur]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onPreview(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyText = (t: string) => {
    const g = parseTable(t);
    if (!g.length) { setInfo({ type: "warning", text: "Tidak ada data yang bisa dibaca." }); return false; }
    const w = Math.max(...g.map((r) => r.length));
    const norm = g.map((r) => Array.from({ length: w }, (_, i) => r[i] ?? ""));
    const rows = hasHeader ? norm.length - 1 : norm.length;
    if (rows < 1) { setInfo({ type: "warning", text: "Hanya ada baris header — tambahkan baris data." }); return false; }
    setGrid(norm);
    setEdits({});
    setSel(0);
    setShowInput(false);
    setInfo(rows > MAX_BULK_ROWS ? { type: "warning", text: `Data ${rows} baris — hanya ${MAX_BULK_ROWS} baris pertama yang diproses.` } : { type: "success", text: `${Math.min(rows, MAX_BULK_ROWS)} baris data dimuat.` });
    return true;
  };

  const onFile = async (f: File | undefined | null) => {
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) {
        const g = await readXlsxGrid(f);
        const t = g.map((r) => r.map((c) => (/[\t\n"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join("\t")).join("\n");
        setText(t);
        applyText(t);
      } else {
        const t = await f.text();
        setText(t);
        applyText(t);
      }
    } catch {
      setInfo({ type: "error", text: "Berkas tidak bisa dibaca. Gunakan CSV, TSV, TXT, atau XLSX." });
    }
  };

  const setCol = (f: ContactField, v: string) => setMap((m) => (m ? { ...m, [f]: v === "default" || v === "blank" ? v : Number(v) } : m));

  const patchRecord = (i: number, p: Partial<ContactData>) => setEdits((e) => ({ ...e, [i]: { ...(e[i] ?? {}), ...p } }));
  const addRow = () => {
    setGrid((g) => [...g, Array.from({ length: Math.max(1, g[0]?.length ?? 1) }, () => "")]);
    setSel(records.length);
  };
  const delRow = (i: number) => {
    const gi = hasHeader ? i + 1 : i;
    setGrid((g) => g.filter((_, k) => k !== gi));
    setEdits((e) => {
      const n: Record<number, Partial<ContactData>> = {};
      for (const [k, v] of Object.entries(e)) { const kk = Number(k); if (kk < i) n[kk] = v; else if (kk > i) n[kk - 1] = v; }
      return n;
    });
    setSel((s) => Math.max(0, Math.min(s, records.length - 2)));
  };

  const { wMM, hMM } = cardPixelSize(design);
  const layout = useMemo(() => sheetLayout(wMM, hMM, paper, landscape, margin, gap), [wMM, hMM, paper, landscape, margin, gap]);
  const pagesEst = layout.perPage ? Math.ceil(records.length / layout.perPage) * (sides === "both" ? 2 : 1) : 0;

  const run = async () => {
    if (!records.length) return;
    cancelRef.current = { cancelled: false };
    setBusy({ done: 0, total: records.length * (sides === "both" ? 2 : 1) });
    setInfo(null);
    const common = { design, records, sides, cache, signal: cancelRef.current, onProgress: (p: { done: number; total: number }) => setBusy({ done: p.done, total: p.total }) };
    try {
      if (mode === "zip") {
        downloadBlob(await exportBulkZip(common), "kartu-nama-massal.zip");
        setInfo({ type: "success", text: `${records.length} kartu${sides === "both" ? " (depan & belakang)" : ""} diekspor sebagai ZIP PNG.` });
      } else if (mode === "pdf") {
        downloadBlob(await exportBulkPdf(common), "kartu-nama-massal.pdf");
        setInfo({ type: "success", text: `PDF ${records.length * (sides === "both" ? 2 : 1)} halaman (ukuran kartu) diunduh.` });
      } else {
        const r = await exportBulkSheet({ ...common, sheet: { paper, landscape, marginMm: margin, gapMm: gap, cropMarks: marks, duplexMirror: mirror } });
        downloadBlob(r.blob, "kartu-nama-lembar-cetak.pdf");
        setInfo({ type: "success", text: `Lembar cetak ${r.pages} halaman (${r.perPage} kartu/halaman) diunduh.` });
      }
    } catch (e: any) {
      if (e instanceof BulkCancelled) setInfo({ type: "info", text: "Dibatalkan." });
      else setInfo({ type: "error", text: e?.message || "Ekspor gagal." });
    } finally {
      setBusy(null);
    }
  };

  const tableReady = !!map && records.length > 0;

  return (
    <div className="space-y-4" data-testid="bulk-panel">
      <PanelCard title="Data Massal" subtitle="Tempel dari Excel/Google Sheets, atau unggah CSV / TSV / XLSX — satu baris = satu kartu">
        {showInput || !grid.length ? (
          <div className="space-y-3">
            <Textarea label="Tempel tabel di sini" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Nama\tJabatan\tPerusahaan\tTelepon\tEmail\nBudi\tDirektur\tPT Maju\t0812…\tbudi@maju.co.id"} className="font-mono text-xs" data-testid="bulk-textarea" />
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => applyText(text)} disabled={!text.trim()} data-testid="bulk-apply"><Users className="w-4 h-4" />Terapkan data</Btn>
              <Btn variant="secondary" onClick={() => { setText(SAMPLE_TABLE); applyText(SAMPLE_TABLE); }} data-testid="bulk-sample">Contoh data</Btn>
              <Btn variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" />Unggah berkas</Btn>
              <Btn variant="ghost" onClick={() => downloadBlob(new Blob(["\uFEFF" + csvTemplate()], { type: "text/csv;charset=utf-8" }), "template-kartu-nama.csv")}><FileSpreadsheet className="w-4 h-4" />Template CSV</Btn>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,text/plain" className="hidden" data-testid="bulk-file" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            {grid.length > 0 && <button type="button" className="text-xs text-slate-500 underline" onClick={() => setShowInput(false)}>Batal ganti data</button>}
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200" data-testid="bulk-count">{records.length} kartu · {headers.length} kolom</span>
            <Btn variant="secondary" className="!py-1.5" onClick={() => setShowInput(true)}>Ganti data</Btn>
            <Btn variant="ghost" className="!py-1.5" onClick={() => { setGrid([]); setText(""); setEdits({}); setShowInput(true); }}><Trash2 className="w-4 h-4" />Kosongkan</Btn>
          </div>
        )}
        <GamatoCheckbox checked={hasHeader} onChange={setHasHeader} testId="bulk-header" label={<span className="text-sm text-slate-600 dark:text-slate-300">Baris pertama adalah header (judul kolom)</span>} />
        {info && <GamatoInlineAlert message={info.text} tone={info.type} />}
      </PanelCard>

      {tableReady && map && (
        <PanelCard title="Pemetaan Kolom" subtitle="Cocokkan kolom data dengan isian kartu. “Pakai Data Kontak” = nilai tetap dari tab Data Kontak untuk semua kartu.">
          <div className="grid sm:grid-cols-2 gap-3">
            {CONTACT_FIELD_KEYS.map((f) => (
              <Select key={f} label={CONTACT_FIELD_LABEL[f]} value={String(map[f])} onChange={(e) => setCol(f, e.target.value)} data-testid={`bulk-map-${f}`}>
                <option value="default">— Pakai Data Kontak (tetap) —</option>
                <option value="blank">— Kosongkan —</option>
                {headers.map((_, i) => <option key={i} value={i}>{colLabel(headers, i)}</option>)}
              </Select>
            ))}
          </div>
        </PanelCard>
      )}

      {tableReady && (
        <PanelCard title={`Daftar Kartu (${records.length})`} subtitle="Klik baris untuk pratinjau di kartu — pratinjau di atas mengikuti baris terpilih">
          <div className="flex items-center gap-2">
            <Btn variant="secondary" className="!px-3" onClick={() => setSel(Math.max(0, cur - 1))} disabled={cur <= 0} data-testid="bulk-prev"><ChevronLeft className="w-4 h-4" /></Btn>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1 text-center" data-testid="bulk-pos">{cur + 1} / {records.length}</span>
            <Btn variant="secondary" className="!px-3" onClick={() => setSel(Math.min(records.length - 1, cur + 1))} disabled={cur >= records.length - 1} data-testid="bulk-next"><ChevronRight className="w-4 h-4" /></Btn>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((r, i) => (
              <div key={i} data-testid="bulk-row" onClick={() => setSel(i)} className={cn("flex items-center gap-2 px-3 py-2 cursor-pointer text-sm", i === cur ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/60")}>
                <span className="w-7 text-xs text-slate-400 shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 truncate"><b className="text-slate-800 dark:text-slate-100">{r.name || "(tanpa nama)"}</b><span className="text-slate-400"> · {r.title || r.company}</span></span>
                <button type="button" aria-label="Hapus baris" onClick={(e) => { e.stopPropagation(); delRow(i); }} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <Btn variant="secondary" onClick={addRow} disabled={records.length >= MAX_BULK_ROWS} data-testid="bulk-add"><Plus className="w-4 h-4" />Tambah baris</Btn>
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
            <Label>Edit baris {cur + 1}</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              {CONTACT_FIELD_KEYS.map((f) => (
                <Input key={f} label={CONTACT_FIELD_LABEL[f]} value={records[cur]?.[f] ?? ""} onChange={(e) => patchRecord(cur, { [f]: e.target.value })} data-testid={`bulk-edit-${f}`} />
              ))}
            </div>
          </div>
        </PanelCard>
      )}

      {tableReady && (
        <PanelCard title="Hasil & Ekspor" subtitle="Desain yang sedang Anda edit di editor dipakai untuk semua kartu">
          <div className="grid grid-cols-2 gap-2">
            {([["front", "Depan saja"], ["both", "Depan + belakang"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setSides(v)} data-testid={`bulk-sides-${v}`} className={cn("py-2.5 rounded-xl text-xs font-semibold border-2", sides === v ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300")}>{l}</button>
            ))}
          </div>
          <div className="grid gap-2">
            {([["zip", "ZIP gambar PNG", "Satu PNG per kartu (resolusi cetak), nama berkas otomatis", <Package key="z" className="w-4 h-4" />], ["pdf", "PDF per kartu", "Satu halaman per sisi, ukuran halaman = ukuran kartu", <FileText key="p" className="w-4 h-4" />], ["sheet", "PDF lembar cetak", "Banyak kartu per lembar + crop marks + susunan bolak-balik", <Printer key="s" className="w-4 h-4" />]] as const).map(([v, l, d, ic]) => (
              <button key={v} type="button" data-testid={`bulk-mode-${v}`} onClick={() => setMode(v)} className={cn("flex items-start gap-3 text-left p-3 rounded-xl border-2 transition-all", mode === v ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700 hover:border-slate-300")}>
                <span className={cn("mt-0.5", mode === v ? "text-indigo-600" : "text-slate-400")}>{ic}</span>
                <span><span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{l}</span><span className="block text-[11px] text-slate-400">{d}</span></span>
              </button>
            ))}
          </div>
          {mode === "sheet" && (
            <div className="space-y-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3" data-testid="bulk-sheet-opts">
              <div className="grid grid-cols-2 gap-3">
                <Select label="Kertas" value={paper} onChange={(e) => setPaper(e.target.value as SheetPaper)} data-testid="bulk-paper"><option value="a4">A4</option><option value="letter">Letter</option><option value="a3">A3</option></Select>
                <Select label="Orientasi" value={landscape ? "l" : "p"} onChange={(e) => setLandscape(e.target.value === "l")}><option value="p">Potret</option><option value="l">Lanskap</option></Select>
              </div>
              <div><div className="flex justify-between mb-1.5"><Label>Margin</Label><span className="text-sm font-bold text-indigo-600">{margin} mm</span></div><GamatoSlider min={0} max={25} step={1} value={margin} onChange={setMargin} aria-label="Margin" /></div>
              <div><div className="flex justify-between mb-1.5"><Label>Jarak antar kartu</Label><span className="text-sm font-bold text-indigo-600">{gap} mm</span></div><GamatoSlider min={0} max={15} step={1} value={gap} onChange={setGap} aria-label="Jarak" /></div>
              <GamatoCheckbox checked={marks} onChange={setMarks} label={<span className="text-sm text-slate-600 dark:text-slate-300">Tanda potong (crop marks){gap < 3 ? " — jarak ≥ 3 mm disarankan" : ""}</span>} />
              {sides === "both" && <GamatoCheckbox checked={mirror} onChange={setMirror} label={<span className="text-sm text-slate-600 dark:text-slate-300">Susun belakang bolak-balik (flip sisi panjang)</span>} />}
              <p className="text-xs text-slate-500" data-testid="bulk-layout-info">{layout.perPage > 0 ? `${layout.cols} × ${layout.rows} = ${layout.perPage} kartu/halaman → ±${pagesEst} halaman` : "Kartu tidak muat — kecilkan margin atau pilih kertas lebih besar."}</p>
            </div>
          )}
          {busy && (
            <div className="space-y-1.5" data-testid="bulk-progress">
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.round((busy.done / Math.max(1, busy.total)) * 100)}%` }} /></div>
              <p className="text-xs text-slate-500">{busy.done}/{busy.total} gambar dirender…</p>
            </div>
          )}
          <div className="flex gap-2">
            <Btn onClick={run} disabled={!!busy || (mode === "sheet" && layout.perPage < 1)} className="flex-1 py-3.5" data-testid="bulk-run">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses…</> : <><Download className="w-4 h-4" />Buat {records.length} Kartu</>}
            </Btn>
            {busy && <Btn variant="danger" onClick={() => { cancelRef.current.cancelled = true; }} data-testid="bulk-cancel"><X className="w-4 h-4" />Batal</Btn>}
          </div>
          <Btn variant="secondary" className="w-full" onClick={() => downloadBlob(new Blob([toVcf(records)], { type: "text/vcard;charset=utf-8" }), "kontak-kartu-nama.vcf")} data-testid="bulk-vcf"><Users className="w-4 h-4" />Ekspor kontak (.vcf)</Btn>
        </PanelCard>
      )}
    </div>
  );
};
