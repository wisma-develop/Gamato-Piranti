import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob, fileToDataUrl } from "@/lib/file";
import { readPptxSlides } from "@/lib/officeReaders";
import { useHistoryState, useDebouncedCommit } from "@/hooks/useHistoryState";
import { GamatoDesktopRecommended } from "@/components/ui/GamatoDesktopRecommended";
import { useToast } from "@/components/ui/GamatoToast";
import {
  createEmptyDeck,
  createEmptySlide,
  createTitleSlide,
  newId,
  type Deck,
  type Slide,
  type SlideElement,
  type ShapeKind,
  type TextAlign,
} from "./slide/slideModel";
import { deckToImagesZipBlob, deckToPdfBlob } from "./slide/exportPdf";
import { SlideToolbar } from "./slide/SlideToolbar";
import { SlideCanvas } from "./slide/SlideCanvas";

export const SlideStudio: React.FC = () => {
  const history = useHistoryState<Deck>(() => createEmptyDeck());
  const deck = history.state;
  const [activeIdx, setActiveIdx] = useState(0);
  const activeSlide = deck.slides[Math.min(activeIdx, deck.slides.length - 1)];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [presentIdx, setPresentIdx] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();
  const debounced = useDebouncedCommit(() => history.commit(), 400);

  const selectedElement: SlideElement | null = useMemo(
    () => activeSlide?.elements.find((e) => e.id === selectedId) ?? null,
    [activeSlide, selectedId]
  );

  const mutateActiveSlide = useCallback(
    (fn: (slide: Slide) => Slide, opts?: { commit?: boolean }) => {
      history.set((prev) => ({ ...prev, slides: prev.slides.map((s, i) => (i === activeIdx ? fn(s) : s)) }), opts);
    },
    [activeIdx, history]
  );

  // ─── Slide list actions ──────────────────────────────────────────────
  const addSlide = useCallback(() => {
    history.set((prev) => {
      const next = [...prev.slides];
      next.splice(activeIdx + 1, 0, createEmptySlide());
      return { ...prev, slides: next };
    });
    setActiveIdx((i) => i + 1);
    setSelectedId(null);
  }, [activeIdx, history]);

  const duplicateSlide = useCallback(() => {
    history.set((prev) => {
      const src = prev.slides[activeIdx];
      const clone: Slide = { ...src, id: newId("slide"), elements: src.elements.map((el) => ({ ...el, id: newId("el") })) };
      const next = [...prev.slides];
      next.splice(activeIdx + 1, 0, clone);
      return { ...prev, slides: next };
    });
    setActiveIdx((i) => i + 1);
  }, [activeIdx, history]);

  const removeSlide = useCallback(
    (idx: number) => {
      if (deck.slides.length <= 1) return;
      history.set((prev) => ({ ...prev, slides: prev.slides.filter((_, i) => i !== idx) }));
      setActiveIdx((cur) => Math.max(0, cur >= idx ? cur - 1 : cur));
      setSelectedId(null);
    },
    [deck.slides.length, history]
  );

  const reorderSlide = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      history.set((prev) => {
        const next = [...prev.slides];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return { ...prev, slides: next };
      });
      setActiveIdx(to);
    },
    [history]
  );

  // ─── Element actions ─────────────────────────────────────────────────
  const addText = useCallback(() => {
    const id = newId("el");
    mutateActiveSlide((slide) => ({
      ...slide,
      elements: [...slide.elements, { id, kind: "text", x: 260, y: 220, width: 440, height: 100, text: "Teks baru", fontSize: 28, color: "#0f172a" }],
    }));
    setSelectedId(id);
  }, [mutateActiveSlide]);

  const addShape = useCallback(
    (shape: ShapeKind) => {
      const id = newId("el");
      mutateActiveSlide((slide) => ({
        ...slide,
        elements: [
          ...slide.elements,
          {
            id,
            kind: "shape",
            shape,
            x: 340,
            y: 200,
            width: shape === "line" ? 200 : 180,
            height: shape === "line" ? 0 : 180,
            fill: "#6366f1",
            strokeWidth: shape === "line" ? 4 : 0,
          },
        ],
      }));
      setSelectedId(id);
    },
    [mutateActiveSlide]
  );

  const addImage = useCallback(
    async (file: File) => {
      const dataUrl = await fileToDataUrl(file);
      const img = new Image();
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = dataUrl;
      });
      const maxW = 480;
      const ratio = img.width && img.height ? img.height / img.width : 0.6;
      const width = Math.min(maxW, img.width || maxW);
      const height = width * (ratio || 0.6);
      const id = newId("el");
      mutateActiveSlide((slide) => ({
        ...slide,
        elements: [...slide.elements, { id, kind: "image", x: (960 - width) / 2, y: (540 - height) / 2, width, height, src: dataUrl }],
      }));
      setSelectedId(id);
    },
    [mutateActiveSlide]
  );

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    mutateActiveSlide((slide) => ({ ...slide, elements: slide.elements.filter((e) => e.id !== selectedId) }));
    setSelectedId(null);
  }, [selectedId, mutateActiveSlide]);

  const bringToFront = useCallback(() => {
    if (!selectedId) return;
    mutateActiveSlide((slide) => {
      const el = slide.elements.find((e) => e.id === selectedId);
      if (!el) return slide;
      return { ...slide, elements: [...slide.elements.filter((e) => e.id !== selectedId), el] };
    });
  }, [selectedId, mutateActiveSlide]);

  const sendToBack = useCallback(() => {
    if (!selectedId) return;
    mutateActiveSlide((slide) => {
      const el = slide.elements.find((e) => e.id === selectedId);
      if (!el) return slide;
      return { ...slide, elements: [el, ...slide.elements.filter((e) => e.id !== selectedId)] };
    });
  }, [selectedId, mutateActiveSlide]);

  const changeElement = useCallback(
    (id: string, patch: Partial<SlideElement>, opts?: { commit?: boolean }) => {
      mutateActiveSlide(
        (slide) => ({ ...slide, elements: slide.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as SlideElement) : e)) }),
        opts
      );
      if (opts?.commit === false) debounced.schedule();
    },
    [mutateActiveSlide, debounced]
  );

  const commitDrag = useCallback(() => {
    debounced.flushNow();
  }, [debounced]);

  const updateTextFormat = useCallback(
    (patch: Partial<{ bold: boolean; italic: boolean; align: TextAlign; color: string; fontSize: number }>) => {
      if (!selectedId) return;
      changeElement(selectedId, patch as Partial<SlideElement>);
    },
    [selectedId, changeElement]
  );

  const changeText = useCallback(
    (id: string, text: string) => {
      changeElement(id, { text } as Partial<SlideElement>, { commit: false });
    },
    [changeElement]
  );

  const setBackground = useCallback(
    (hex: string) => {
      mutateActiveSlide((slide) => ({ ...slide, background: hex }));
    },
    [mutateActiveSlide]
  );

  // ─── Import .pptx ────────────────────────────────────────────────────
  const importPptx = useCallback(
    async (file: File) => {
      try {
        const parsed = await readPptxSlides(file);
        const slides: Slide[] = parsed.map((s) => {
          const slide = createTitleSlide(s.title);
          if (s.bullets.length) {
            slide.elements.push({
              id: newId("el"),
              kind: "text",
              x: 100,
              y: 220,
              width: 760,
              height: 280,
              text: s.bullets.map((b) => `•  ${b}`).join("\n"),
              fontSize: 20,
              align: "left",
              color: "#334155",
            });
          }
          return slide;
        });
        history.set((prev) => ({ ...prev, slides: slides.length ? slides : prev.slides }));
        setActiveIdx(0);
        setSelectedId(null);
        showToast(`${slides.length} slide berhasil diimpor dari .pptx.`, "success");
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Gagal membaca file .pptx.", "error");
      }
    },
    [history, showToast]
  );

  // ─── Export ──────────────────────────────────────────────────────────
  const exportPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await deckToPdfBlob(deck);
      downloadBlob(blob, `${sanitizeFileName(deck.title || "presentasi")}.pdf`);
      showToast("PDF berhasil diunduh.", "success");
    } catch {
      showToast("Gagal membuat PDF.", "error");
    } finally {
      setIsExporting(false);
    }
  }, [deck, showToast]);

  const exportImages = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await deckToImagesZipBlob(deck);
      downloadBlob(blob, `${sanitizeFileName(deck.title || "presentasi")}-gambar.zip`);
      showToast("Gambar (.zip) berhasil diunduh.", "success");
    } catch {
      showToast("Gagal membuat gambar.", "error");
    } finally {
      setIsExporting(false);
    }
  }, [deck, showToast]);

  // ─── Keyboard shortcuts (undo/redo, delete, escape) ────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (presenting) {
        if (e.key === "Escape") setPresenting(false);
        else if (e.key === "ArrowRight" || e.key === " ") setPresentIdx((i) => Math.min(deck.slides.length - 1, i + 1));
        else if (e.key === "ArrowLeft") setPresentIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (isTyping) return;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        history.undo();
      } else if (meta && e.key.toLowerCase() === "y") {
        e.preventDefault();
        history.redo();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [presenting, deck.slides.length, selectedId, deleteSelected, history]);

  const presentRef = useRef<HTMLDivElement>(null);
  const startPresent = useCallback(() => {
    setPresentIdx(activeIdx);
    setPresenting(true);
    // Best-effort real fullscreen — harmless no-op if blocked (permissions/embedded context).
    presentRef.current?.requestFullscreen?.().catch(() => {});
  }, [activeIdx]);

  if (!activeSlide) return null;

  return (
    <div className="space-y-4">
      <GamatoDesktopRecommended toolName="Slide Studio" />

      <SlideToolbar
        selected={selectedElement}
        background={activeSlide.background}
        onSetBackground={setBackground}
        onAddText={addText}
        onAddShape={addShape}
        onAddImage={addImage}
        onDeleteSelected={deleteSelected}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
        onUpdateText={updateTextFormat}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={() => history.undo()}
        onRedo={() => history.redo()}
        onPresent={startPresent}
        onImportPptx={importPptx}
        onExportPdf={exportPdf}
        onExportImages={exportImages}
      />

      <div className="grid lg:grid-cols-[200px_1fr] gap-4 items-start">
        {/* Slide list sidebar */}
        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible lg:max-h-[70vh] lg:overflow-y-auto pb-2 lg:pb-0">
          {deck.slides.map((s, i) => (
            <div
              key={s.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (!Number.isNaN(from)) reorderSlide(from, i);
              }}
              onClick={() => {
                setActiveIdx(i);
                setSelectedId(null);
              }}
              className={cn(
                "group relative shrink-0 w-32 lg:w-full rounded-lg border-2 cursor-pointer overflow-hidden transition-colors",
                i === activeIdx ? "border-indigo-500" : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
              )}
            >
              <div className="w-full" style={{ aspectRatio: "960 / 540", background: s.background }}>
                <SlideCanvas
                  slide={s}
                  selectedId={null}
                  editingTextId={null}
                  onSelect={() => {}}
                  onChangeElement={() => {}}
                  onCommitChange={() => {}}
                  onStartEditText={() => {}}
                  onChangeText={() => {}}
                  onStopEditText={() => {}}
                  readOnly
                />
              </div>
              <span className="absolute bottom-1 left-1.5 text-[10px] font-bold text-white bg-black/50 rounded px-1.5 py-0.5">{i + 1}</span>
              {deck.slides.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSlide(i);
                  }}
                  aria-label={`Hapus slide ${i + 1}`}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-2 lg:flex-col shrink-0">
            <button
              type="button"
              onClick={addSlide}
              className="flex-1 lg:w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Slide
            </button>
            <button
              type="button"
              onClick={duplicateSlide}
              className="flex-1 lg:w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Duplikat
            </button>
          </div>
        </div>

        {/* Main editing canvas */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <SlideCanvas
            slide={activeSlide}
            selectedId={selectedId}
            editingTextId={editingTextId}
            onSelect={setSelectedId}
            onChangeElement={changeElement}
            onCommitChange={commitDrag}
            onStartEditText={setEditingTextId}
            onChangeText={changeText}
            onStopEditText={() => {
              commitDrag();
              setEditingTextId(null);
            }}
          />
        </div>
      </div>

      {isExporting && <p className="text-xs text-slate-400 dark:text-slate-500">Menyiapkan file untuk diunduh…</p>}

      {/* Present mode overlay */}
      {presenting && (
        <div ref={presentRef} className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          <div className="w-full max-w-[95vw]">
            <SlideCanvas
              slide={deck.slides[presentIdx]}
              selectedId={null}
              editingTextId={null}
              onSelect={() => {}}
              onChangeElement={() => {}}
              onCommitChange={() => {}}
              onStartEditText={() => {}}
              onChangeText={() => {}}
              onStopEditText={() => {}}
              readOnly
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              setPresenting(false);
            }}
            aria-label="Tutup mode tampilkan"
            className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setPresentIdx((i) => Math.max(0, i - 1))}
            disabled={presentIdx === 0}
            aria-label="Slide sebelumnya"
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={() => setPresentIdx((i) => Math.min(deck.slides.length - 1, i + 1))}
            disabled={presentIdx === deck.slides.length - 1}
            aria-label="Slide berikutnya"
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs font-mono">
            {presentIdx + 1} / {deck.slides.length}
          </span>
        </div>
      )}
    </div>
  );
};
