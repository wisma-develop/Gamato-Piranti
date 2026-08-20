import React, { useEffect, useRef, useState } from "react";
import { Bold, Italic, ListOrdered, Link2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Type, Rows3, Square, Circle, Minus, ArrowRight, Shapes, Palette, Highlighter } from "lucide-react";
import { cn } from "@/utils/cn";
import { fileToDataUrl } from "@/lib/file";
import { useDialog } from "@/hooks/useDialog";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import { cmdBold, cmdItalic, cmdUnderline, cmdStrikethrough, cmdSubscript, cmdSuperscript,
  cmdToggleList, cmdAlign, cmdForeColor, cmdHighlight,
  cmdFontName, cmdFontSize, cmdChangeCaseSelection, cmdInsertLink, cmdInsertImage, cmdRemoveFormat,
  cmdSetLineHeight, cmdSetSpaceAfter, cmdInsertShape, type ShapeKind, type CaseMode,
} from "./commands";

const FONT_FAMILIES = [
  { id: "Alan Sans, sans-serif", label: "Alan Sans" },
  { id: "Arial, sans-serif", label: "Arial" },
  { id: "Georgia, serif", label: "Georgia" },
  { id: "'Times New Roman', serif", label: "Times New Roman" },
  { id: "'Courier New', monospace", label: "Courier New" },
  { id: "'Playfair Display', serif", label: "Playfair Display" },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48];

const TEXT_COLOR_PRESETS = ["#0f172a", "#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb", "#4f46e5", "#a21caf", "#db2777", "#64748b", "#ffffff"];
const HIGHLIGHT_COLOR_PRESETS = ["#fef08a", "#fde68a", "#bbf7d0", "#a7f3d0", "#bfdbfe", "#c7d2fe", "#fbcfe8", "#fecaca"];
const SHAPE_COLOR_PRESETS = ["#4f46e5", "#0f172a", "#dc2626", "#ea580c", "#16a34a", "#0891b2", "#a21caf", "#64748b"];

/** Small pill/square button used throughout the toolbar. */
const ToolBtn: React.FC<{
  onClick: () => void;
  title: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ onClick, title, active, className, children }) => (
  <button
    type="button"
    title={title}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={cn(
      "h-8 min-w-[2rem] px-2 inline-flex items-center justify-center rounded-lg text-sm font-semibold transition-colors",
      active
        ? "bg-indigo-600 text-white"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
      className
    )}
  >
    {children}
  </button>
);

const Sep: React.FC = () => <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />;

export const RichToolbar: React.FC<{
  editorRef: React.RefObject<HTMLDivElement>;
  onAfterCommand: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}> = ({ editorRef, onAfterCommand, onUndo, onRedo, canUndo, canRedo }) => {
  const dialog = useDialog();
  const [fontSize, setFontSize] = useState(16);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [shapeStroke, setShapeStroke] = useState("#4f46e5");
  const [shapeFill, setShapeFill] = useState("transparent");
  const [shapeColorOpen, setShapeColorOpen] = useState<"stroke" | "fill" | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Native <input type="color"> and <select> steal window focus the instant
  // their picker/dropdown opens, which collapses whatever text selection the
  // user had made in the editor. Regular ToolBtn buttons dodge this with
  // onMouseDown={preventDefault} (focus never leaves the editor at all), but
  // that trick can't be used on a color input or select — doing so stops
  // their native picker from opening. Instead we explicitly snapshot the
  // Selection Range the moment the user starts interacting with one of these
  // controls, then restore that exact Range right before running the
  // formatting command — regardless of whatever focus juggling happened in
  // between. This is what was silently breaking Highlight, Text Color, Font
  // Family and Font Size on any selected text.
  const savedRangeRef = useRef<Range | null>(null);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (!savedRangeRef.current) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
  };

  /**
   * For plain toolbar buttons (Bold, Italic, lists, align, ...): these never
   * lose focus/selection in the first place (ToolBtn's onMouseDown already
   * prevents that), so this must NOT touch the selection at all — doing so
   * previously clobbered a perfectly fresh selection with a stale one saved
   * from an earlier, unrelated color/font pick.
   */
  const withFocus = (fn: () => void) => {
    editorRef.current?.focus();
    fn();
    onAfterCommand();
  };

  /**
   * For controls that DO lose the selection (native color inputs, <select>
   * dropdowns, and anything that opens an async modal like the link
   * dialog): restores the Range captured by saveSelection() right before
   * running the command, then immediately discards it so it can never leak
   * into a later, unrelated action.
   */
  const withRestoredSelection = (fn: () => void) => {
    editorRef.current?.focus();
    restoreSelection();
    savedRangeRef.current = null;
    fn();
    onAfterCommand();
  };

  // ─── Active-state indicators (bold/italic/align/list/etc. light up when
  // the current selection already has that formatting, like every other
  // word processor) ───────────────────────────────────────────────────────
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const update = () => {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return;
      try {
        setActiveStates({
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strikethrough: document.queryCommandState("strikeThrough"),
          subscript: document.queryCommandState("subscript"),
          superscript: document.queryCommandState("superscript"),
          insertUnorderedList: document.queryCommandState("insertUnorderedList"),
          insertOrderedList: document.queryCommandState("insertOrderedList"),
          justifyLeft: document.queryCommandState("justifyLeft"),
          justifyCenter: document.queryCommandState("justifyCenter"),
          justifyRight: document.queryCommandState("justifyRight"),
          justifyFull: document.queryCommandState("justifyFull"),
        });
      } catch {
        // queryCommandState can throw on an empty/detached selection — safe to ignore.
      }
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInsertLink = async () => {
    // Snapshot the selection right now, BEFORE the async modal dialog opens
    // and steals focus — otherwise cmdInsertLink sees no selection at all
    // and falls back to inserting the raw URL as new text instead of
    // turning the user's selected words into a hyperlink.
    saveSelection();
    const values = await dialog.form({
      title: "Sisipkan Tautan",
      description: "Masukkan alamat URL. Jika ada teks yang sedang diblok, teks itu akan otomatis menjadi hyperlink ke alamat ini — persis seperti di Word.",
      icon: <Link2 className="w-5 h-5" />,
      submitLabel: "Sisipkan",
      fields: [
        { key: "url", label: "URL Tautan", placeholder: "https://example.com", required: true, type: "text" },
      ],
    });
    const url = values?.url?.trim();
    if (!url) return;
    withRestoredSelection(() => cmdInsertLink(url));
  };

  const handleInsertImage = () => imageInputRef.current?.click();

  const handleImageFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    withFocus(() => cmdInsertImage(dataUrl));
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const SHAPE_OPTIONS: { kind: ShapeKind; label: string; icon: React.ReactNode }[] = [
    { kind: "rectangle", label: "Kotak", icon: <Square className="w-4 h-4" /> },
    { kind: "circle", label: "Lingkaran", icon: <Circle className="w-4 h-4" /> },
    { kind: "line", label: "Garis", icon: <Minus className="w-4 h-4" /> },
    { kind: "arrow", label: "Panah", icon: <ArrowRight className="w-4 h-4" /> },
  ];

  const handleInsertShape = async (kind: ShapeKind) => {
    setShapeMenuOpen(false);
    setShapeColorOpen(null);
    editorRef.current?.focus();
    restoreSelection();
    savedRangeRef.current = null;
    await cmdInsertShape(kind, { stroke: shapeStroke, fill: shapeFill });
    onAfterCommand();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Undo / redo — covers every edit (formatting, images, shapes, spacing, ...), not just typing */}
      <ToolBtn title="Urungkan (Ctrl+Z)" onClick={onUndo} className={!canUndo ? "opacity-30 pointer-events-none" : undefined}>↺</ToolBtn>
      <ToolBtn title="Ulangi (Ctrl+Y)" onClick={onRedo} className={!canRedo ? "opacity-30 pointer-events-none" : undefined}>↻</ToolBtn>

      <Sep />

      {/* Font family */}
      <select
        title="Jenis font"
        onMouseDown={(e) => { e.stopPropagation(); saveSelection(); }}
        onFocus={saveSelection}
        onChange={(e) => withRestoredSelection(() => cmdFontName(e.target.value))}
        defaultValue=""
        className="h-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 px-2 max-w-[8.5rem]"
      >
        <option value="" disabled>
          Font
        </option>
        {FONT_FAMILIES.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Font size */}
      <div className="flex items-center gap-1">
        <Type className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        <select
          title="Ukuran font"
          value={fontSize}
          onMouseDown={(e) => { e.stopPropagation(); saveSelection(); }}
          onFocus={saveSelection}
          onChange={(e) => {
            const px = parseInt(e.target.value);
            setFontSize(px);
            if (editorRef.current) withRestoredSelection(() => cmdFontSize(px, editorRef.current!));
          }}
          className="h-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 px-2 w-16"
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}px
            </option>
          ))}
        </select>
      </div>

      <Sep />

      <ToolBtn title="Tebal (Bold)" onClick={() => withFocus(cmdBold)} active={activeStates.bold}>
        <Bold className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Miring (Italic)" onClick={() => withFocus(cmdItalic)} active={activeStates.italic}>
        <Italic className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Garis bawah (Underline)" onClick={() => withFocus(cmdUnderline)} active={activeStates.underline} className="underline">
        U
      </ToolBtn>
      <ToolBtn title="Coret (Strikethrough)" onClick={() => withFocus(cmdStrikethrough)} active={activeStates.strikethrough} className="line-through">
        S
      </ToolBtn>

      <Sep />

      {/* Case conversion — all operate on the currently selected/blocked text */}
      <ToolBtn title="HURUF BESAR SEMUA (dari teks terpilih)" onClick={() => withFocus(() => cmdChangeCaseSelection("upper"))}>
        AA
      </ToolBtn>
      <ToolBtn title="Huruf Besar Per Kata (dari teks terpilih)" onClick={() => withFocus(() => cmdChangeCaseSelection("title"))}>
        Aa
      </ToolBtn>
      <ToolBtn title="Kalimat Awal Kapital (dari teks terpilih)" onClick={() => withFocus(() => cmdChangeCaseSelection("sentence"))}>
        A.a
      </ToolBtn>
      <ToolBtn title="huruf kecil semua (dari teks terpilih)" onClick={() => withFocus(() => cmdChangeCaseSelection("lower"))}>
        aa
      </ToolBtn>

      <Sep />

      {/* Text color */}
      <div className="relative">
        <ToolBtn title="Warna teks" onClick={() => { saveSelection(); setTextColorOpen((v) => !v); }} active={textColorOpen}>
          <Palette className="w-4 h-4" />
        </ToolBtn>
        {textColorOpen && (
          <ColorSwatchPicker
            presets={TEXT_COLOR_PRESETS}
            onCustomPickerOpen={saveSelection}
            onClose={() => setTextColorOpen(false)}
            onPick={(color) => withRestoredSelection(() => cmdForeColor(color))}
          />
        )}
      </div>

      {/* Highlight color */}
      <div className="relative">
        <ToolBtn title="Sorot teks (highlight)" onClick={() => { saveSelection(); setHighlightOpen((v) => !v); }} active={highlightOpen}>
          <Highlighter className="w-4 h-4" />
        </ToolBtn>
        {highlightOpen && (
          <ColorSwatchPicker
            presets={HIGHLIGHT_COLOR_PRESETS}
            allowNone
            noneLabel="Hapus sorotan"
            onCustomPickerOpen={saveSelection}
            onClose={() => setHighlightOpen(false)}
            onPick={(color) => withRestoredSelection(() => cmdHighlight(color))}
          />
        )}
      </div>

      <Sep />

      <ToolBtn title="Rata kiri" onClick={() => withFocus(() => cmdAlign("left"))} active={activeStates.justifyLeft}>
        <AlignLeft className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Rata tengah" onClick={() => withFocus(() => cmdAlign("center"))} active={activeStates.justifyCenter}>
        <AlignCenter className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Rata kanan" onClick={() => withFocus(() => cmdAlign("right"))} active={activeStates.justifyRight}>
        <AlignRight className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Rata kiri-kanan (justify)" onClick={() => withFocus(() => cmdAlign("justify"))} active={activeStates.justifyFull}>
        ≣
      </ToolBtn>

      <Sep />

      {/* Line spacing */}
      <div className="flex items-center gap-1">
        <Rows3 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        <select
          title="Spasi antar baris"
          defaultValue=""
          onMouseDown={(e) => { e.stopPropagation(); saveSelection(); }}
          onFocus={saveSelection}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (editorRef.current) withRestoredSelection(() => cmdSetLineHeight(v, editorRef.current!));
          }}
          className="h-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 px-2 w-[4.5rem]"
        >
          <option value="" disabled>
            Baris
          </option>
          <option value="1">1.0</option>
          <option value="1.15">1.15</option>
          <option value="1.5">1.5</option>
          <option value="2">2.0</option>
        </select>
      </div>

      {/* Space after paragraph */}
      <select
        title="Spasi setelah paragraf"
        defaultValue=""
        onMouseDown={(e) => { e.stopPropagation(); saveSelection(); }}
        onFocus={saveSelection}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (editorRef.current) withRestoredSelection(() => cmdSetSpaceAfter(v, editorRef.current!));
        }}
        className="h-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 px-2 w-[6.5rem]"
      >
        <option value="" disabled>
          Sp. Paragraf
        </option>
        <option value="0">Tanpa spasi</option>
        <option value="8">Kecil</option>
        <option value="16">Sedang</option>
        <option value="28">Besar</option>
      </select>

      <Sep />

      <ToolBtn
        title="Daftar bullet"
        onClick={() => { if (editorRef.current) withFocus(() => cmdToggleList("bullet", editorRef.current!)); }}
        active={activeStates.insertUnorderedList}
      >
        •≡
      </ToolBtn>
      <ToolBtn
        title="Daftar bernomor"
        onClick={() => { if (editorRef.current) withFocus(() => cmdToggleList("number", editorRef.current!)); }}
        active={activeStates.insertOrderedList}
      >
        <ListOrdered className="w-4 h-4" />
      </ToolBtn>

      <Sep />

      <ToolBtn title="Subscript (mis. H₂O)" onClick={() => withFocus(cmdSubscript)} active={activeStates.subscript}>
        <span>
          X<sub>2</sub>
        </span>
      </ToolBtn>
      <ToolBtn title="Superscript (mis. x²)" onClick={() => withFocus(cmdSuperscript)} active={activeStates.superscript}>
        <span>
          X<sup>2</sup>
        </span>
      </ToolBtn>

      <Sep />

      <ToolBtn title="Sisipkan tautan" onClick={handleInsertLink}>
        <Link2 className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Sisipkan gambar" onClick={handleInsertImage}>
        <ImageIcon className="w-4 h-4" />
      </ToolBtn>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFile(e.target.files)} />

      {/* Shapes */}
      <div className="relative">
        <ToolBtn title="Sisipkan bentuk" onClick={() => setShapeMenuOpen((v) => !v)} active={shapeMenuOpen}>
          <Shapes className="w-4 h-4" />
        </ToolBtn>
        {shapeMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => { setShapeMenuOpen(false); setShapeColorOpen(null); }} />
            <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2.5 w-64">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">Warna bentuk</p>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShapeColorOpen(shapeColorOpen === "stroke" ? null : "stroke")}
                    className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 px-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    <span className="w-4 h-4 rounded-full border-2 shrink-0" style={{ borderColor: shapeStroke }} />
                    Garis (stroke)
                  </button>
                  {shapeColorOpen === "stroke" && (
                    <ColorSwatchPicker presets={SHAPE_COLOR_PRESETS} onClose={() => setShapeColorOpen(null)} onPick={setShapeStroke} />
                  )}
                </div>
                <div className="relative flex-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShapeColorOpen(shapeColorOpen === "fill" ? null : "fill")}
                    className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-2 px-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
                  >
                    <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" style={{ backgroundColor: shapeFill === "transparent" ? undefined : shapeFill }} />
                    Isi (fill)
                  </button>
                  {shapeColorOpen === "fill" && (
                    <ColorSwatchPicker presets={SHAPE_COLOR_PRESETS} allowNone noneLabel="Tanpa isi" onClose={() => setShapeColorOpen(null)} onPick={setShapeFill} />
                  )}
                </div>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">Pilih bentuk</p>
              <div className="flex gap-1">
                {SHAPE_OPTIONS.map((s) => (
                  <button
                    key={s.kind}
                    type="button"
                    title={s.label}
                    onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                    onClick={() => handleInsertShape(s.kind)}
                    className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    {s.icon}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <Sep />

      <ToolBtn title="Hapus semua format" onClick={() => withFocus(cmdRemoveFormat)}>
        Tx
      </ToolBtn>
    </div>
  );
};
