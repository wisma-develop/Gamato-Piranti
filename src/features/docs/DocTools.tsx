import React, { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Download, Copy } from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeFileName, sanitizeText } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { Input, Btn, SectionBadge } from "@/components/ui/primitives";
import { RichToolbar } from "./richtext/RichToolbar";
import { ImageInspector } from "./richtext/ImageInspector";
import { parseEditor } from "./richtext/parseEditor";
import { exportDocxFromBlocks } from "./richtext/exportDocx";
import { exportPdfFromBlocks } from "./richtext/exportPdf";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textToHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`)
    .join("");
}

const TEMPLATES: Record<"notulen" | "surat" | "catatan", { name: string; text: string }> = {
  notulen: {
    name: "Notulen Gamato",
    text: "NOTULEN RAPAT\nGamato Piranti\n\nAgenda:\n- \n\nPeserta:\n- \n\nRingkasan:\n- \n\nKeputusan:\n- \n\nTindak Lanjut:\n- ",
  },
  surat: {
    name: "Surat Gamato",
    text: "Surabaya, .................................... 20..\n\nKepada Yth.\n...........................................\nDi Tempat\n\nPerihal: ...........................................\n\nDengan hormat,\n\n...\n\nHormat kami,\nGamato Piranti\n",
  },
  catatan: {
    name: "Catatan Gamato",
    text: "Catatan kerja Gamato Piranti\n\n- ",
  },
};

export const DocTools: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const initialHtmlRef = useRef<string>("<p><br></p>");

  const [fileName, setFileName] = useState("Gamato Piranti Dokumen");
  const [docInfo, setDocInfo] = useState<string | null>(null);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState<string | null>(null);
  const [plainText, setPlainText] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // Older browsers may not support this — the editor still works fine.
    }
  }, []);

  // ─── Undo/Redo covering EVERY kind of edit, not just typing ─────────────
  // document.execCommand("undo") only reliably tracks the browser's own
  // native typing history — it has no idea about formatting commands,
  // image resize/rotate/crop/align, shapes, paragraph spacing, or any of
  // the other DOM surgery this editor does directly. So instead of relying
  // on it, the editor's entire innerHTML is snapshotted: once immediately
  // after every discrete action (a toolbar click, an image edit, find &
  // replace, a template load, ...), and — while the user is simply typing —
  // debounced so a whole burst of keystrokes becomes one undo step instead
  // of one per character.
  const contentHistory = useHistoryState<string>("<p><br></p>");
  const { schedule: scheduleContentCommit, flushNow: flushContentCommit } = useDebouncedCommit(contentHistory.commit, 800);
  const commitHistory = (opts?: { continuous?: boolean }) => {
    const el = editorRef.current;
    if (!el) return;
    contentHistory.set(el.innerHTML, { commit: !opts?.continuous });
    if (opts?.continuous) scheduleContentCommit();
  };
  const applyRestoredHtml = (html: string | undefined) => {
    if (html === undefined) return;
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = html;
    setSelectedImg(null); // any selected <img> reference may no longer exist in the new DOM
    syncFromDom();
  };
  const handleUndo = () => applyRestoredHtml(contentHistory.undo());
  const handleRedo = () => applyRestoredHtml(contentHistory.redo());

  // Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z inside the editor go through the custom
  // history above — and we explicitly stop the browser's own native undo
  // from *also* firing, since the two would operate on separate, now
  // out-of-sync histories and produce confusing, inconsistent results.
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const meta = e.ctrlKey || e.metaKey;
    if (!meta) return;
    const key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    } else if (key === "y" || (key === "z" && e.shiftKey)) {
      e.preventDefault();
      handleRedo();
    }
  };

  // Editor kontenEditable diinisialisasi SEKALI secara imperatif (bukan lewat
  // dangerouslySetInnerHTML di JSX). Ini sengaja dipisah total dari siklus
  // render React: sejak baris ini jalan, isi editor 100% dikuasai oleh DOM
  // asli / ketikan pengguna — React tidak pernah lagi menyentuh innerHTML-nya
  // sampai kita panggil setEditorHtml() secara eksplisit (template/import/
  // snapshot). Ini menghilangkan segala kemungkinan ambigu reconciliation
  // yang bisa mereset kursor/ketikan di tengah jalan.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = initialHtmlRef.current;
    setPlainText(el.innerText || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [hasImages, setHasImages] = useState(false);
  const syncFromDom = () => {
    const el = editorRef.current;
    if (!el) return;
    setPlainText(el.innerText || "");
    setHasImages(!!el.querySelector("img"));
  };

  /** For every discrete edit (toolbar command, image edit, find & replace, template load, ...): sync stats AND record an undo step immediately. */
  const afterEdit = () => {
    syncFromDom();
    commitHistory();
  };

  // Deselect the currently-selected image when the user clicks anywhere
  // outside it and outside its floating inspector toolbar/handles.
  useEffect(() => {
    if (!selectedImg) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target === selectedImg) return;
      if (target.closest("[data-image-inspector]")) return;
      setSelectedImg(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [selectedImg]);

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      setSelectedImg(target as HTMLImageElement);
    } else if (selectedImg) {
      setSelectedImg(null);
    }
  };

  const setEditorHtml = (html: string) => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = html;
    afterEdit();
  };

  const stats = useMemo(
    () => ({
      chars: plainText.length,
      words: (plainText.match(/\S+/g) || []).length,
      lines: plainText ? plainText.split(/\r?\n/).length : 0,
    }),
    [plainText]
  );

  // A document containing only an image (no typed text) should still be
  // exportable — don't gate the export buttons on plainText alone.
  const hasContent = plainText.trim().length > 0 || hasImages;

  const outline = useMemo(() => {
    return plainText.split(/\r?\n/).reduce<{ line: string; index: number }[]>((acc, line, idx) => {
      const t = line.trim();
      if (!t) return acc;
      if (t.length <= 80 && t === t.toUpperCase() && /[A-ZÀ-ÖØ-Ý]/.test(t)) acc.push({ line: t, index: idx });
      return acc;
    }, []);
  }, [plainText]);

  const generateTemplate = (kind: keyof typeof TEMPLATES) => {
    const tpl = TEMPLATES[kind];
    setEditorHtml(textToHtml(tpl.text));
    setFileName(tpl.name);
    setDocInfo("Template dimuat.");
  };

  const quickClean = (kind: "trim" | "noBlank") => {
    const el = editorRef.current;
    if (!el) return;
    if (kind === "trim") {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        node.textContent = (node.textContent || "").replace(/[ \t]+/g, " ");
        node = walker.nextNode();
      }
      setDocInfo("Spasi ganda dirapikan.");
    } else {
      Array.from(el.children).forEach((child) => {
        const empty = !(child.textContent || "").trim() && !child.querySelector("img");
        if (empty && (child.tagName === "P" || child.tagName === "DIV")) child.remove();
      });
      setDocInfo("Baris kosong dihapus.");
    }
    afterEdit();
  };

  const runFindReplace = () => {
    const el = editorRef.current;
    if (!el || !findText) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    let count = 0;
    while (node) {
      const t = node.textContent || "";
      if (t.includes(findText)) {
        count += t.split(findText).length - 1;
        node.textContent = t.split(findText).join(replaceText);
      }
      node = walker.nextNode();
    }
    setDocInfo(count === 0 ? "Teks tidak ditemukan." : `${count} kemunculan diganti.`);
    afterEdit();
  };

  const changeCase = (kind: "upper" | "lower" | "title") => {
    const el = editorRef.current;
    if (!el) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const t = node.textContent || "";
      node.textContent =
        kind === "upper" ? t.toUpperCase() : kind === "lower" ? t.toLowerCase() : t.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      node = walker.nextNode();
    }
    setDocInfo("Huruf diubah.");
    afterEdit();
  };

  const importTxt = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      setEditorHtml(textToHtml((r.result as string) || ""));
      setDocInfo("File .txt berhasil diimpor.");
    };
    r.readAsText(file);
  };

  const saveSnapshot = () => {
    if (!editorRef.current) return;
    setSnapshot(editorRef.current.innerHTML);
    setSnapshotLabel(fileName);
    setDocInfo("Snapshot disimpan.");
  };

  const restoreSnapshot = () => {
    if (!snapshot) return;
    setEditorHtml(snapshot);
    setDocInfo("Snapshot dipulihkan.");
  };

  const exportDocx = async () => {
    const el = editorRef.current;
    if (!el || !hasContent) return;
    setIsExporting(true);
    try {
      const blocks = parseEditor(el);
      const blob = await exportDocxFromBlocks(blocks, fileName || "Gamato Piranti Dokumen");
      downloadBlob(blob, `${sanitizeFileName(fileName || "gamato-dokumen")}.docx`);
      setDocInfo("Dokumen .docx berhasil disiapkan.");
    } catch {
      setDocInfo("Gagal menyusun .docx.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportPdf = async () => {
    const el = editorRef.current;
    if (!el || !hasContent) return;
    setIsExporting(true);
    try {
      const blocks = parseEditor(el);
      const blob = await exportPdfFromBlocks(blocks, fileName || "Gamato Piranti Dokumen");
      downloadBlob(blob, `${sanitizeFileName(fileName || "gamato-dokumen")}.pdf`);
      setDocInfo("Disimpan sebagai PDF.");
    } catch {
      setDocInfo("Gagal menyusun PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTxt = () => {
    if (!plainText) return;
    downloadBlob(new Blob([plainText], { type: "text/plain;charset=utf-8" }), `${sanitizeFileName(fileName || "gamato-dokumen")}.txt`);
    setDocInfo("Diekspor sebagai .txt.");
  };

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-6 items-start">
      {/* Editor */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <Input
                value={fileName}
                onChange={(e) => setFileName(sanitizeText(e.target.value))}
                className="border-0 bg-transparent p-0 font-bold text-slate-800 dark:text-slate-100 text-base focus:ring-0 shadow-none"
                placeholder="Nama dokumen"
              />
            </div>
            <label className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer hover:text-indigo-700 shrink-0">
              Import .txt
              <input type="file" accept="text/plain" className="hidden" onChange={(e) => importTxt(e.target.files)} />
            </label>
          </div>

          {/* Template & quick-clean row */}
          <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 self-center mr-1">Template:</span>
            {(["notulen", "surat", "catatan"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => generateTemplate(k)}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                {TEMPLATES[k].name.replace(" Gamato", "")}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 self-center mr-1">Ubah:</span>
            {([
              ["trim", "Rapikan spasi"],
              ["noBlank", "Hapus baris kosong"],
            ] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => quickClean(k)} className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-3 py-1.5 rounded-lg">
                {l}
              </button>
            ))}
            {([
              ["upper", "AA"],
              ["lower", "aa"],
              ["title", "Aa"],
            ] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => changeCase(k)} className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-3 py-1.5 rounded-lg">
                {l}
              </button>
            ))}
          </div>

          {/* Find & Replace */}
          <div className="flex gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 items-end flex-wrap">
            <div className="flex-1 min-w-[9rem]">
              <Input label="Cari" value={findText} onChange={(e) => setFindText(e.target.value)} placeholder="Teks yang dicari…" className="py-2" />
            </div>
            <div className="flex-1 min-w-[9rem]">
              <Input label="Ganti dengan" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Teks pengganti…" className="py-2" />
            </div>
            <Btn onClick={runFindReplace} disabled={!findText} variant="secondary" className="py-2 shrink-0">
              Ganti
            </Btn>
            <button
              type="button"
              onClick={() => {
                setFindText("");
                setReplaceText("");
              }}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 shrink-0 pb-0.5"
            >
              Reset
            </button>
          </div>

          {/* Rich text formatting toolbar */}
          <RichToolbar editorRef={editorRef} onAfterCommand={afterEdit} onUndo={handleUndo} onRedo={handleRedo} canUndo={contentHistory.canUndo} canRedo={contentHistory.canRedo} />

          {/* Editable canvas */}
          <div ref={editorWrapRef} className="relative">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => {
                syncFromDom();
                commitHistory({ continuous: true });
              }}
              onBlur={() => {
                syncFromDom();
                flushContentCommit();
              }}
              onKeyDown={handleEditorKeyDown}
              onClick={handleEditorClick}
              data-placeholder="Mulai menulis di sini, atau gunakan template di atas…"
              className={cn(
                "w-full min-h-[24rem] px-5 py-4 text-sm text-slate-800 dark:text-slate-100 leading-relaxed focus:outline-none",
                "empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 dark:empty:before:text-slate-500",
                "[&_p]:min-h-[1.4em] [&_p]:my-1",
                "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-1",
                "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-1",
                "[&_a]:text-indigo-600 dark:[&_a]:text-indigo-400 [&_a]:underline",
                "[&_img]:rounded-lg [&_img]:cursor-pointer [&_img]:max-w-full [&_img]:my-2"
              )}
            />
            {selectedImg && editorWrapRef.current && (
              <div data-image-inspector>
                <ImageInspector
                  containerRef={editorWrapRef}
                  img={selectedImg}
                  onChanged={afterEdit}
                  onDeselect={() => setSelectedImg(null)}
                />
              </div>
            )}
          </div>

        </div>

        {/* Export buttons */}
        <div className="flex flex-wrap gap-3">
          <Btn onClick={exportDocx} disabled={isExporting || !hasContent} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-md shadow-indigo-600/20">
            Unduh .docx
          </Btn>
          <Btn onClick={exportPdf} disabled={isExporting || !hasContent} variant="secondary" className="gap-2">
            <Download className="w-4 h-4" />
            Unduh .pdf
          </Btn>
          <Btn onClick={downloadTxt} disabled={!plainText.trim()} variant="secondary" className="gap-2">
            <Download className="w-4 h-4" />
            Unduh .txt
          </Btn>
          <Btn onClick={saveSnapshot} disabled={!hasContent} variant="ghost" className="gap-2">
            <Copy className="w-4 h-4" />
            Snapshot
          </Btn>
          <Btn onClick={restoreSnapshot} disabled={!snapshot} variant="ghost">
            Pulihkan{snapshotLabel ? ` "${snapshotLabel}"` : ""}
          </Btn>
        </div>

        {docInfo && (
          <div
            className={cn(
              "text-sm rounded-xl px-4 py-2.5 border font-medium",
              docInfo.startsWith("Gagal") || docInfo.startsWith("Teks tidak")
                ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
                : "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30"
            )}
          >
            {docInfo}
          </div>
        )}

        <p className="text-xs text-slate-400 dark:text-slate-500 px-1">
          Gambar yang disisipkan (termasuk hasil crop, ukuran, dan posisinya) ikut tersimpan utuh baik di ekspor <b>.pdf</b> maupun <b>.docx</b> — sama seperti yang tampil di editor.
        </p>
      </div>

      {/* Stats sidebar */}
      <div className="space-y-4 sticky top-24">
        <div className="bg-slate-900 dark:ring-1 dark:ring-slate-700 rounded-2xl p-5 text-white space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Statistik</p>
          <div className="grid grid-cols-3 gap-3">
            {([
              ["Kata", stats.words],
              ["Karakter", stats.chars],
              ["Baris", stats.lines],
            ] as const).map(([l, v]) => (
              <div key={l} className="text-center bg-slate-800 rounded-xl p-3">
                <div className="text-2xl font-bold text-white">{v}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{l}</div>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Preview</p>
            <div className="bg-slate-800 rounded-xl p-3 max-h-40 overflow-hidden text-xs text-slate-300 leading-relaxed font-mono">
              {plainText ? (
                plainText
                  .split("\n")
                  .slice(0, 10)
                  .map((l, i) => (
                    <p key={i} className="truncate">
                      {l || "​"}
                    </p>
                  ))
              ) : (
                <p className="text-slate-500 dark:text-slate-400">Mulai menulis…</p>
              )}
            </div>
          </div>

          {outline.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Outline</p>
              <ul className="space-y-1">
                {outline.slice(0, 8).map((item) => (
                  <li key={item.index} className="text-xs text-slate-300 truncate flex gap-1.5">
                    <span className="text-slate-500 dark:text-slate-400">›</span>
                    {item.line}
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
