import React, { useMemo, useState } from "react";
import { FileText, Download, Copy } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { cn } from "@/utils/cn";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { Input, Btn, SectionBadge } from "@/components/ui/primitives";

export const DocTools: React.FC = () => {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("Gamato Piranti Dokumen");
  const [docInfo, setDocInfo] = useState<string | null>(null);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState<string | null>(null);

  const stats = useMemo(() => ({
    chars: text.length,
    words: (text.match(/\S+/g) || []).length,
    lines: text.split(/\r?\n/).length,
  }), [text]);

  const outline = useMemo(() => {
    return text.split(/\r?\n/).reduce<{ line: string; index: number }[]>((acc, line, idx) => {
      const t = line.trim();
      if (!t) return acc;
      if (t.startsWith("#") || (t.length <= 80 && t === t.toUpperCase() && /[A-ZÀ-ÖØ-Ý]/.test(t)))
        acc.push({ line: t.replace(/^#+\s*/, ""), index: idx });
      return acc;
    }, []);
  }, [text]);

  const exportDocx = async () => {
    if (!text.trim()) return;
    const doc = new Document({ sections: [{ properties: {}, children: text.split("\n").map(line => new Paragraph({ children: [new TextRun({ text: line || " ", size: 22 })] })) }] });
    downloadBlob(await Packer.toBlob(doc), `${sanitizeFileName(fileName || "gamato-dokumen")}.docx`);
    setDocInfo("Dokumen .docx berhasil disiapkan.");
  };

  const exportPdf = async () => {
    if (!text.trim()) return;
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = 12, lineHeight = fontSize + 4, margin = 50;
      const maxChars = Math.floor((595.28 - margin * 2) / (fontSize * 0.55));
      const allLines: string[] = [];
      for (const raw of text.split(/\r?\n/)) {
        if (!raw) { allLines.push(""); continue; }
        for (let s = 0; s < raw.length; s += maxChars) allLines.push(raw.slice(s, s + maxChars));
      }
      let page = pdfDoc.addPage(), { height } = page.getSize(), y = height - margin;
      const addPage = () => { page = pdfDoc.addPage(); ({ height } = page.getSize()); y = height - margin; };
      for (const line of allLines) {
        if (y < margin + lineHeight) addPage();
        if (line) page.drawText(line, { x: margin, y: y - lineHeight, size: fontSize, font, color: rgb(0, 0, 0) });
        y -= lineHeight;
      }
      downloadBlob(new Blob([await pdfDoc.save()], { type: "application/pdf" }), `${sanitizeFileName(fileName || "gamato-dokumen")}.pdf`);
      setDocInfo("Disimpan sebagai PDF.");
    } catch { setDocInfo("Gagal menyusun PDF."); }
  };

  const downloadTxt = () => {
    if (!text) return;
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${sanitizeFileName(fileName || "gamato-dokumen")}.txt`);
    setDocInfo("Diekspor sebagai .txt.");
  };

  const importTxt = (files: FileList | null) => {
    if (!files?.[0]) return;
    const r = new FileReader();
    r.onload = () => { setText((r.result as string) || ""); setDocInfo("File .txt berhasil diimpor."); };
    r.readAsText(files[0]);
  };

  const generateTemplate = (kind: "notulen" | "surat" | "catatan") => {
    if (kind === "notulen") { setText("NOTULEN RAPAT\nGamato Piranti\n\nAgenda:\n- \n\nPeserta:\n- \n\nRingkasan:\n- \n\nKeputusan:\n- \n\nTindak Lanjut:\n- "); setFileName("Notulen Gamato"); }
    else if (kind === "surat") { setText("Surabaya, .................................... 20..\n\nKepada Yth.\n...........................................\nDi Tempat\n\nPerihal: ...........................................\n\nDengan hormat,\n\n...\n\nHormat kami,\nGamato Piranti\n"); setFileName("Surat Gamato"); }
    else { setText("Catatan kerja Gamato Piranti\n\n- "); setFileName("Catatan Gamato"); }
    setDocInfo("Template dimuat.");
  };

  const quickClean = (kind: "trim" | "noBlank") => {
    if (!text) return;
    if (kind === "trim") { setText(text.replace(/[ \t]+/g, " ")); setDocInfo("Spasi ganda dirapikan."); }
    else { setText(text.split(/\r?\n/).filter(l => l.trim() !== "").join("\n")); setDocInfo("Baris kosong dihapus."); }
  };

  const runFindReplace = () => {
    if (!findText || !text.includes(findText)) { setDocInfo("Teks tidak ditemukan."); return; }
    setText(text.split(findText).join(replaceText));
    setDocInfo("Cari & ganti selesai.");
  };

  const changeCase = (kind: "upper" | "lower" | "title") => {
    if (!text) return;
    if (kind === "upper") setText(text.toUpperCase());
    else if (kind === "lower") setText(text.toLowerCase());
    else setText(text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));
    setDocInfo("Huruf diubah.");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
      {/* Editor */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <Input value={fileName} onChange={e => setFileName(sanitizeFileName(e.target.value))} className="border-0 bg-transparent p-0 font-bold text-slate-800 text-base focus:ring-0 shadow-none" placeholder="Nama dokumen" />
            </div>
            <label className="text-sm text-blue-600 font-semibold cursor-pointer hover:text-blue-700">
              Import .txt <input type="file" accept="text/plain" className="hidden" onChange={e => importTxt(e.target.files)} />
            </label>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-100 bg-white">
            <span className="text-xs font-bold text-slate-400 self-center mr-1">Template:</span>
            {[["notulen", "Notulen"], ["surat", "Surat Resmi"], ["catatan", "Catatan Kerja"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => generateTemplate(k as any)} className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">{l}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-100 bg-white">
            <span className="text-xs font-bold text-slate-400 self-center mr-1">Ubah:</span>
            {[["trim", "Rapikan spasi"], ["noBlank", "Hapus baris kosong"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => quickClean(k as any)} className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg">{l}</button>
            ))}
            {[["upper", "AA"], ["lower", "aa"], ["title", "Aa"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => changeCase(k as any)} className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg">{l}</button>
            ))}
          </div>

          {/* Find & Replace */}
          <div className="flex gap-3 px-5 py-3 border-b border-slate-100 bg-white items-end">
            <div className="flex-1">
              <Input label="Cari" value={findText} onChange={e => setFindText(e.target.value)} placeholder="Teks yang dicari…" className="py-2" />
            </div>
            <div className="flex-1">
              <Input label="Ganti dengan" value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="Teks pengganti…" className="py-2" />
            </div>
            <Btn onClick={runFindReplace} disabled={!findText} variant="secondary" className="py-2 shrink-0">Ganti</Btn>
            <button type="button" onClick={() => { setFindText(""); setReplaceText(""); }} className="text-xs text-slate-400 hover:text-slate-600 shrink-0 pb-0.5">Reset</button>
          </div>

          {/* Text area */}
          <textarea
            className="w-full h-80 px-5 py-4 text-sm text-slate-800 leading-relaxed font-mono focus:outline-none resize-none"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Mulai menulis di sini, atau gunakan template di atas…"
          />
        </div>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-3">
          <Btn onClick={exportDocx} disabled={!text.trim()} className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-md shadow-blue-600/20">
            Unduh .docx
          </Btn>
          <Btn onClick={exportPdf} disabled={!text.trim()} variant="secondary" className="gap-2"><Download className="w-4 h-4" />Unduh .pdf</Btn>
          <Btn onClick={downloadTxt} disabled={!text} variant="secondary" className="gap-2"><Download className="w-4 h-4" />Unduh .txt</Btn>
          <Btn onClick={() => { setSnapshot(text); setSnapshotLabel(fileName); setDocInfo("Snapshot disimpan."); }} disabled={!text} variant="ghost" className="gap-2"><Copy className="w-4 h-4" />Snapshot</Btn>
          <Btn onClick={() => { if (snapshot) { setText(snapshot); setDocInfo("Snapshot dipulihkan."); } }} disabled={!snapshot} variant="ghost">Pulihkan{snapshotLabel ? ` "${snapshotLabel}"` : ""}</Btn>
        </div>

        {docInfo && <div className={cn("text-sm rounded-xl px-4 py-2.5 border font-medium", docInfo.startsWith("Gagal") || docInfo.startsWith("Teks tidak") ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200")}>{docInfo}</div>}
      </div>

      {/* Stats sidebar */}
      <div className="space-y-4 sticky top-24">
        <div className="bg-slate-900 rounded-2xl p-5 text-white space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Statistik</p>
          <div className="grid grid-cols-3 gap-3">
            {[["Kata", stats.words], ["Karakter", stats.chars], ["Baris", stats.lines]].map(([l, v]) => (
              <div key={l as string} className="text-center bg-slate-800 rounded-xl p-3">
                <div className="text-2xl font-bold text-white">{v}</div>
                <div className="text-xs text-slate-400 mt-0.5">{l}</div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Preview</p>
            <div className="bg-slate-800 rounded-xl p-3 max-h-40 overflow-hidden text-xs text-slate-300 leading-relaxed font-mono">
              {text ? text.split("\n").slice(0, 10).map((l, i) => <p key={i} className="truncate">{l || "​"}</p>) : <p className="text-slate-500">Mulai menulis…</p>}
            </div>
          </div>

          {/* Outline */}
          {outline.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Outline</p>
              <ul className="space-y-1">
                {outline.slice(0, 8).map(item => (
                  <li key={item.index} className="text-xs text-slate-300 truncate flex gap-1.5">
                    <span className="text-slate-500">›</span>{item.line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SectionBadge>Native — data tidak dikirim</SectionBadge>
        </div>
      </div>
    </div>
  );
};
