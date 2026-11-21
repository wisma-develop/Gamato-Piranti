import React from "react";
import { ArrowUp, ArrowDown, Copy, Trash2, Plus, Heading1, Pilcrow, ListOrdered, List, Table2, Rows3, MoveVertical, SeparatorHorizontal } from "lucide-react";
import { cn } from "@/utils/cn";
import { Label, Input, Select, Textarea, Btn } from "@/components/ui/primitives";
import { GamatoCheckbox } from "@/components/ui/GamatoCheckbox";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { blk, dataRow, newId, type BlockType, type LetterBlock, type NumStyle } from "@/lib/letterTypes";
import { tr } from "@/i18n";

const TYPE_META: Record<BlockType, { label: string; icon: React.ReactNode }> = {
  heading: { label: tr("Judul"), icon: <Heading1 className="w-3.5 h-3.5" /> },
  paragraph: { label: tr("Paragraf"), icon: <Pilcrow className="w-3.5 h-3.5" /> },
  numbered: { label: tr("Daftar bernomor"), icon: <ListOrdered className="w-3.5 h-3.5" /> },
  bullets: { label: tr("Daftar poin"), icon: <List className="w-3.5 h-3.5" /> },
  data: { label: tr("Data (label : isi)"), icon: <Rows3 className="w-3.5 h-3.5" /> },
  table: { label: tr("Tabel"), icon: <Table2 className="w-3.5 h-3.5" /> },
  spacer: { label: tr("Spasi kosong"), icon: <MoveVertical className="w-3.5 h-3.5" /> },
  pagebreak: { label: tr("Halaman baru"), icon: <SeparatorHorizontal className="w-3.5 h-3.5" /> },
};

const ADD_ORDER: BlockType[] = ["paragraph", "heading", "data", "numbered", "bullets", "table", "spacer", "pagebreak"];

const inputCls = "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-400";

const AlignSeg: React.FC<{ value: string; options: [string, string][]; onChange: (v: string) => void }> = ({ value, options, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map(([id, label]) => (
      <button key={id} type="button" onClick={() => onChange(id)}
        className={cn("px-2.5 py-1 rounded-lg text-[11px] font-semibold border", value === id ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700")}>
        {label}
      </button>
    ))}
  </div>
);

const Chk: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <GamatoCheckbox checked={checked} onChange={onChange} label={<span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>} />
);

export const LetterBlocksEditor: React.FC<{
  blocks: LetterBlock[];
  onChange: (fn: (b: LetterBlock[]) => LetterBlock[], opts?: { continuous?: boolean }) => void;
}> = ({ blocks, onChange }) => {
  const patch = (id: string, p: Partial<LetterBlock>, continuous = true) =>
    onChange((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b)), { continuous });
  const move = (i: number, dir: -1 | 1) => onChange((bs) => {
    const a = [...bs]; const j = i + dir;
    if (j < 0 || j >= a.length) return bs;
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  });
  const dup = (i: number) => onChange((bs) => {
    const a = [...bs]; const src = bs[i];
    a.splice(i + 1, 0, { ...src, id: newId(), rows: src.rows?.map((r) => ({ ...r, id: newId("d") })) });
    return a;
  });
  const del = (id: string) => onChange((bs) => bs.filter((b) => b.id !== id));
  const add = (t: BlockType) => onChange((bs) => {
    const base: LetterBlock =
      t === "heading" ? blk("heading", "JUDUL SURAT", { underline: true })
      : t === "paragraph" ? blk("paragraph", "", { indent: true })
      : t === "numbered" ? blk("numbered", tr("Butir pertama\nButir kedua"), { numStyle: "1." })
      : t === "bullets" ? blk("bullets", tr("Poin pertama\nPoin kedua"))
      : t === "data" ? blk("data", "", { labelWidth: 32, rows: [dataRow(tr("Nama"), ""), dataRow(tr("Alamat"), "")] })
      : t === "table" ? blk("table", tr("Kolom A | Kolom B | Kolom C\nisi 1 | isi 2 | isi 3"), { header: true })
      : t === "spacer" ? blk("spacer", "", { height: 8 })
      : blk("pagebreak", "");
    return [...bs, base];
  });

  return (
    <div className="space-y-3" data-testid="blocks-editor">
      {blocks.map((b, i) => (
        <div key={b.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 p-3 space-y-3" data-testid={`block-${i}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">{TYPE_META[b.type].icon}{TYPE_META[b.type].label}<span className="text-slate-400 font-normal">#{i + 1}</span></span>
            <div className="flex items-center">
              <button type="button" aria-label={tr("Naikkan blok")} onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" aria-label={tr("Turunkan blok")} onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
              <button type="button" aria-label={tr("Gandakan blok")} onClick={() => dup(i)} className="p-1.5 text-slate-400 hover:text-indigo-600"><Copy className="w-4 h-4" /></button>
              <button type="button" aria-label={tr("Hapus blok")} onClick={() => del(b.id)} className="p-1.5 text-slate-400 hover:text-red-500" data-testid={`block-del-${i}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>

          {b.type === "heading" && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label={tr("Judul")} value={b.text} onChange={(e) => patch(b.id, { text: e.target.value })} />
                <Input label={tr("Baris kecil di bawah judul")} value={b.sub ?? ""} onChange={(e) => patch(b.id, { sub: e.target.value })} placeholder={tr("Nomor: {{nomor}}")} />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <AlignSeg value={b.align ?? "auto"} options={[["auto", tr("Tengah (bawaan)")], ["left", tr("Kiri")], ["center", tr("Tengah")], ["right", tr("Kanan")]]} onChange={(v) => patch(b.id, { align: v as LetterBlock["align"] }, false)} />
                <Chk checked={!!b.underline} onChange={(v) => patch(b.id, { underline: v }, false)} label={tr("Garis bawah")} />
              </div>
            </div>
          )}

          {b.type === "paragraph" && (
            <div className="space-y-3">
              <Textarea label={tr("Isi paragraf")} rows={4} value={b.text} onChange={(e) => patch(b.id, { text: e.target.value })} data-testid={`block-text-${i}`} />
              <div className="flex flex-wrap items-center gap-4">
                <AlignSeg value={b.align ?? "auto"} options={[["auto", tr("Ikut dokumen")], ["left", tr("Kiri")], ["justify", tr("Rata kiri-kanan")], ["center", tr("Tengah")], ["right", tr("Kanan")]]} onChange={(v) => patch(b.id, { align: v as LetterBlock["align"] }, false)} />
                <Chk checked={!!b.indent} onChange={(v) => patch(b.id, { indent: v }, false)} label={tr("Menjorok baris pertama")} />
                <Chk checked={!!b.bold} onChange={(v) => patch(b.id, { bold: v }, false)} label={tr("Cetak tebal")} />
              </div>
            </div>
          )}

          {(b.type === "numbered" || b.type === "bullets") && (
            <div className="space-y-3">
              <Textarea label={tr("Butir (satu baris = satu butir)")} rows={4} value={b.text} onChange={(e) => patch(b.id, { text: e.target.value })} />
              {b.type === "numbered" && (
                <Select label={tr("Gaya nomor")} value={b.numStyle ?? "1."} onChange={(e) => patch(b.id, { numStyle: e.target.value as NumStyle }, false)}>
                  <option value="1.">1. 2. 3.</option><option value="1)">1) 2) 3)</option><option value="(1)">(1) (2) (3)</option><option value="a.">{tr("a. b. c.")}</option><option value="i.">{tr("i. ii. iii.")}</option>
                </Select>
              )}
            </div>
          )}

          {b.type === "data" && (
            <div className="space-y-2">
              {(b.rows ?? []).map((r, ri) => (
                <div key={r.id} className="flex items-center gap-2">
                  <input aria-label={tr("Label baris {0}", ri + 1)} className={cn(inputCls, "w-[34%]")} value={r.label} onChange={(e) => patch(b.id, { rows: (b.rows ?? []).map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)) })} placeholder={tr("Label")} />
                  <span className="text-slate-400">:</span>
                  <input aria-label={tr("Isi baris {0}", ri + 1)} className={cn(inputCls, "flex-1")} value={r.value} onChange={(e) => patch(b.id, { rows: (b.rows ?? []).map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)) })} placeholder={tr("Isi / {{variabel}}")} />
                  <button type="button" aria-label={tr("Hapus baris")} onClick={() => patch(b.id, { rows: (b.rows ?? []).filter((x) => x.id !== r.id) }, false)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="flex items-center gap-3 flex-wrap">
                <Btn variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => patch(b.id, { rows: [...(b.rows ?? []), dataRow("", "")] }, false)}><Plus className="w-3.5 h-3.5" />{tr("Tambah baris")}</Btn>
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <Label>{tr("Lebar label")}</Label>
                  <div className="flex-1 min-w-[120px]"><GamatoSlider min={14} max={70} value={b.labelWidth ?? 32} onChange={(v) => patch(b.id, { labelWidth: v })} aria-label={tr("Lebar label")} /></div>
                  <span className="text-xs font-bold text-indigo-600 tabular-nums w-12 text-right">{b.labelWidth ?? 32} {tr("mm")}</span>
                </div>
              </div>
            </div>
          )}

          {b.type === "table" && (
            <div className="space-y-3">
              <Textarea label={tr("Isi tabel (pisahkan kolom dengan |, satu baris = satu baris tabel)")} rows={5} className="font-mono text-xs" value={b.text} onChange={(e) => patch(b.id, { text: e.target.value })} />
              <Chk checked={!!b.header} onChange={(v) => patch(b.id, { header: v }, false)} label={tr("Baris pertama sebagai judul kolom")} />
            </div>
          )}

          {b.type === "spacer" && (
            <div className="flex items-center gap-3">
              <Label>{tr("Tinggi")}</Label>
              <div className="flex-1 min-w-[120px]"><GamatoSlider min={2} max={80} value={b.height ?? 8} onChange={(v) => patch(b.id, { height: v })} aria-label={tr("Tinggi spasi")} /></div>
              <span className="text-xs font-bold text-indigo-600 tabular-nums w-12 text-right">{b.height ?? 8} {tr("mm")}</span>
            </div>
          )}
          {b.type === "pagebreak" && <p className="text-xs text-slate-500">{tr("Konten setelah blok ini dimulai di halaman baru.")}</p>}
        </div>
      ))}
      {!blocks.length && <p className="text-sm text-slate-400 text-center py-6">{tr("Belum ada blok. Tambahkan paragraf pertama di bawah.")}</p>}
      <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">{tr("Tambah blok")}</p>
        <div className="flex flex-wrap gap-2">
          {ADD_ORDER.map((t) => (
            <button key={t} type="button" onClick={() => add(t)} data-testid={`add-${t}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-400">
              {TYPE_META[t].icon}{TYPE_META[t].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
