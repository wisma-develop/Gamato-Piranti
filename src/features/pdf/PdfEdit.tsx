import React, { useRef, useState } from "react";
import { PenSquare, FileText, Type, Square, Trash2, Loader2, Zap } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { cn } from "@/utils/cn";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { stampGamatoBranding } from "@/lib/pdfBranding";
import { Input, Textarea, Btn, Label } from "@/components/ui/primitives";
import { GamatoPdfPage } from "@/components/ui/GamatoPdfPage";
import { GamatoSlider } from "@/components/ui/GamatoSlider";
import { GamatoColorPicker } from "@/components/ui/GamatoColorPicker";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { UndoRedoBar } from "@/components/ui/UndoRedoBar";

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const makeId = () => Math.random().toString(36).slice(2, 9);

interface EditElement {
  id: string;
  type: "text" | "box";
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
}

export const PdfEdit: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageSizes, setPageSizes] = useState<{ w: number; h: number }[]>([]);
  const [activePage, setActivePage] = useState(1);
  // Elemen anotasi (teks/kotak) punya riwayat Undo/Redo penuh. Menyeret &
  // mengetik digabung jadi satu langkah setelah jeda; tambah/hapus elemen
  // langsung commit.
  const elementsHistory = useHistoryState<EditElement[]>([]);
  const elements = elementsHistory.state;
  const setElements = elementsHistory.set;
  const { schedule: scheduleElementsCommit, flushNow: flushElementsCommit } = useDebouncedCommit(elementsHistory.commit, 600);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  const selected = elements.find((e) => e.id === selectedId) || null;
  const updateSelected = (patch: Partial<EditElement>, opts?: { continuous?: boolean }) => {
    if (!selectedId) return;
    setElements((prev) => prev.map((e) => (e.id === selectedId ? { ...e, ...patch } : e)), { commit: !opts?.continuous });
    if (opts?.continuous) scheduleElementsCommit();
  };

  const addFiles = async (incoming: File[]) => {
    const f = incoming.find((x) => x.type === "application/pdf");
    if (!f) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const url = URL.createObjectURL(f);
    const pdfDoc = await PDFDocument.load(await fileToArrayBuffer(f), { ignoreEncryption: true });
    setFile(f);
    setObjectUrl(url);
    setPageCount(pdfDoc.getPageCount());
    setPageSizes(pdfDoc.getPages().map((p) => ({ w: p.getSize().width, h: p.getSize().height })));
    setActivePage(1);
    elementsHistory.reset([]); // file baru = mulai riwayat baru
    setSelectedId(null);
    setInfo(null);
  };

  const addElement = (type: "text" | "box") => {
    const el: EditElement = {
      id: makeId(),
      type,
      page: activePage,
      x: 0.3,
      y: 0.4,
      w: type === "text" ? 0.3 : 0.25,
      h: type === "text" ? 0.06 : 0.1,
      text: type === "text" ? "Teks baru" : "",
      fontSize: 16,
      color: type === "text" ? "#0f172a" : "#fde047",
      opacity: type === "text" ? 100 : 55,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  };

  const removeElement = (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const startDrag = (id: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    const rect = placeholderRef.current?.getBoundingClientRect();
    const el = elements.find((x) => x.id === id);
    if (!rect || !el) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: el.x, y: el.y };
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      setElements((prev) => prev.map((it) => (it.id === id ? { ...it, x: clamp(start.x + dx, 0, 1 - it.w), y: clamp(start.y + dy, 0, 1 - it.h) } : it)), { commit: false });
      scheduleElementsCommit();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      flushElementsCommit(); // seret selesai → satu langkah Undo
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const visibleElements = elements.filter((e) => e.page === activePage);
  const pageAspect = pageSizes[activePage - 1] ? `${pageSizes[activePage - 1].w} / ${pageSizes[activePage - 1].h}` : "1 / 1.414";

  const handleApply = async () => {
    if (!file || !elements.length) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const pdfDoc = await PDFDocument.load(await fileToArrayBuffer(file), { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();

      elements.forEach((el) => {
        const page = pages[clamp(el.page - 1, 0, pages.length - 1)];
        const { width, height } = page.getSize();
        const h = el.color.replace("#", "");
        const color = rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
        const x = el.x * width;
        const yTop = (1 - el.y) * height;

        if (el.type === "box") {
          const w = el.w * width;
          const boxH = el.h * height;
          page.drawRectangle({ x, y: yTop - boxH, width: w, height: boxH, color, opacity: el.opacity / 100 });
        } else {
          page.drawText(el.text, { x, y: yTop - el.fontSize, size: el.fontSize, font, color, opacity: el.opacity / 100, maxWidth: el.w * width });
        }
      });

      await stampGamatoBranding(pdfDoc);
      downloadBlob(new Blob([await pdfDoc.save()], { type: "application/pdf" }), "gamato-edited.pdf");
      setInfo(`${elements.length} elemen berhasil ditambahkan ke PDF.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal menerapkan perubahan."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <GamatoDesktopRecommended toolName="Edit PDF" />
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
      <div className="space-y-5">
        {!file ? (
          <Dropzone
            onFiles={addFiles}
            accept="application/pdf"
            multiple={false}
            label="Drop file PDF di sini"
            sublabel="atau klik untuk browse"
            icon={<FileText className="w-8 h-8 text-slate-400 dark:text-slate-500" />}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
          />
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
              <div className="flex items-center gap-2">
                <Input value={activePage} onChange={(e) => setActivePage(clamp(parseInt(e.target.value.replace(/\D/g, "")) || 1, 1, pageCount))} className="w-16 py-1.5 text-center" />
                <span className="text-xs text-slate-400 dark:text-slate-500">/ {pageCount}</span>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-0">
              <GamatoPdfPage src={objectUrl} page={activePage} height={440} />
              <div className="p-4 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                <div ref={placeholderRef} className="relative bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded shadow max-w-full" style={{ width: "min(100%, 300px)", aspectRatio: pageAspect }}>
                  {visibleElements.map((el) => (
                    <div
                      key={el.id}
                      onPointerDown={startDrag(el.id)}
                      onClick={() => setSelectedId(el.id)}
                      className={cn(
                        "absolute cursor-move touch-none flex items-center overflow-hidden text-[9px] px-0.5",
                        el.type === "box" ? "" : "border border-dashed",
                        selectedId === el.id && "outline outline-2 outline-indigo-500"
                      )}
                      style={{
                        left: `${el.x * 100}%`,
                        top: `${el.y * 100}%`,
                        width: `${el.w * 100}%`,
                        height: `${el.h * 100}%`,
                        backgroundColor: el.type === "box" ? el.color : "transparent",
                        opacity: el.type === "box" ? el.opacity / 100 : 1,
                        borderColor: el.color,
                        color: el.color,
                      }}
                    >
                      {el.type === "text" ? el.text : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 px-5 py-2 border-t border-slate-100 dark:border-slate-800">
              Kiri: pratinjau halaman asli. Kanan: geser elemen untuk mengatur posisi.
            </p>
          </div>
        )}

        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Gagal") ? "error" : "success"} />}

        <Btn onClick={handleApply} disabled={isWorking || !file || !elements.length} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Terapkan &amp; Unduh
            </>
          )}
        </Btn>
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Elemen</p>
            <div className="flex items-center gap-2">
              <UndoRedoBar canUndo={elementsHistory.canUndo} canRedo={elementsHistory.canRedo} onUndo={elementsHistory.undo} onRedo={elementsHistory.redo} hideLabel />
              <div className="flex gap-1.5">
              <button type="button" onClick={() => addElement("text")} disabled={!file} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-40">
                <Type className="w-3.5 h-3.5" /> Teks
              </button>
              <button type="button" onClick={() => addElement("box")} disabled={!file} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 disabled:opacity-40">
                <Square className="w-3.5 h-3.5" /> Kotak
              </button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {elements.map((el) => (
              <button
                key={el.id}
                type="button"
                onClick={() => {
                  setSelectedId(el.id);
                  setActivePage(el.page);
                }}
                className={cn("w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left", selectedId === el.id ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300")}
              >
                <span className="truncate flex-1">
                  Hal.{el.page} — {el.type === "text" ? el.text || "(teks)" : "Kotak"}
                </span>
                <Trash2
                  className="w-3.5 h-3.5 text-slate-400 hover:text-red-500 shrink-0 ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeElement(el.id);
                  }}
                />
              </button>
            ))}
            {!elements.length && <p className="text-xs text-slate-400 dark:text-slate-500">Belum ada elemen. Tambah Teks atau Kotak di atas.</p>}
          </div>
        </div>

        {selected && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Edit Elemen</p>
            {selected.type === "text" && (
              <>
                <Textarea label="Isi Teks" rows={2} value={selected.text} onChange={(e) => updateSelected({ text: e.target.value }, { continuous: true })} />
                <Input label="Ukuran Font (pt)" type="number" min={6} max={72} value={selected.fontSize} onChange={(e) => updateSelected({ fontSize: parseInt(e.target.value) || 16 }, { continuous: true })} />
              </>
            )}
            <GamatoColorPicker label="Warna" value={selected.color} onChange={(hex) => updateSelected({ color: hex }, { continuous: true })} />
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label>Opacity</Label>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{selected.opacity}%</span>
              </div>
              <GamatoSlider min={5} max={100} value={selected.opacity} onChange={(v) => updateSelected({ opacity: v }, { continuous: true })} aria-label="Opacity" />
            </div>
            {selected.type === "box" && (
              <>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <Label>Lebar</Label>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(selected.w * 100)}%</span>
                  </div>
                  <GamatoSlider min={5} max={90} value={Math.round(selected.w * 100)} onChange={(v) => updateSelected({ w: v / 100 }, { continuous: true })} aria-label="Lebar" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <Label>Tinggi</Label>
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{Math.round(selected.h * 100)}%</span>
                  </div>
                  <GamatoSlider min={2} max={90} value={Math.round(selected.h * 100)} onChange={(v) => updateSelected({ h: v / 100 }, { continuous: true })} aria-label="Tinggi" />
                </div>
              </>
            )}
          </div>
        )}

        <ToolInfoPanel
          icon={<PenSquare className="w-5 h-5" />}
          label="Edit PDF"
          desc="Tambah teks & kotak"
          points={["Tambahkan teks bebas atau kotak warna (untuk menandai/menutup area) ke halaman manapun.", "Geser langsung di area pratinjau untuk mengatur posisi."]}
        />
      </div>
    </div>
    </div>
  );
};
