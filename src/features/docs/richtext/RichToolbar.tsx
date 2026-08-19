import React, { useRef, useState } from "react";
import { Bold, Italic, ListOrdered, Link2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Type, Rows3, Square, Circle, Minus, ArrowRight, Shapes } from "lucide-react";
import { cn } from "@/utils/cn";
import { fileToDataUrl } from "@/lib/file";
import { useDialog } from "@/hooks/useDialog";
import {
  cmdBold, cmdItalic, cmdUnderline, cmdStrikethrough, cmdSubscript, cmdSuperscript,
  cmdUndo, cmdRedo, cmdOrderedList, cmdUnorderedList, cmdAlign, cmdForeColor, cmdHighlight,
  cmdFontName, cmdFontSize, cmdUppercaseSelection, cmdInsertLink, cmdInsertImage, cmdRemoveFormat,
  cmdSetLineHeight, cmdSetSpaceAfter, cmdInsertShape, type ShapeKind,
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
}> = ({ editorRef, onAfterCommand }) => {
  const dialog = useDialog();
  const [fontSize, setFontSize] = useState(16);
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false);
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

  const withFocus = (fn: () => void) => {
    editorRef.current?.focus();
    restoreSelection();
    fn();
    onAfterCommand();
  };

  const handleInsertLink = async () => {
    const values = await dialog.form({
      title: "Sisipkan Tautan",
      description: "Masukkan alamat URL yang ingin ditautkan ke teks terpilih.",
      icon: <Link2 className="w-5 h-5" />,
      submitLabel: "Sisipkan",
      fields: [
        { key: "url", label: "URL Tautan", placeholder: "https://example.com", required: true, type: "text" },
      ],
    });
    const url = values?.url?.trim();
    if (!url) return;
    withFocus(() => cmdInsertLink(url));
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
    editorRef.current?.focus();
    restoreSelection();
    await cmdInsertShape(kind);
    onAfterCommand();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Undo / redo */}
      <ToolBtn title="Urungkan (Ctrl+Z)" onClick={() => withFocus(cmdUndo)}>↺</ToolBtn>
      <ToolBtn title="Ulangi (Ctrl+Y)" onClick={() => withFocus(cmdRedo)}>↻</ToolBtn>

      <Sep />

      {/* Font family */}
      <select
        title="Jenis font"
        onMouseDown={(e) => { e.stopPropagation(); saveSelection(); }}
        onFocus={saveSelection}
        onChange={(e) => withFocus(() => cmdFontName(e.target.value))}
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
            if (editorRef.current) withFocus(() => cmdFontSize(px, editorRef.current!));
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

      <ToolBtn title="Tebal (Bold)" onClick={() => withFocus(cmdBold)}>
        <Bold className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Miring (Italic)" onClick={() => withFocus(cmdItalic)}>
        <Italic className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Garis bawah (Underline)" onClick={() => withFocus(cmdUnderline)} className="underline">
        U
      </ToolBtn>
      <ToolBtn title="Coret (Strikethrough)" onClick={() => withFocus(cmdStrikethrough)} className="line-through">
        S
      </ToolBtn>
      <ToolBtn title="HURUF BESAR (dari teks terpilih)" onClick={() => withFocus(cmdUppercaseSelection)}>
        AA
      </ToolBtn>

      <Sep />

      {/* Text color */}
      <label title="Warna teks" className="relative h-8 w-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer text-slate-600 dark:text-slate-300 font-bold text-sm">
        A
        <input
          type="color"
          defaultValue="#0f172a"
          onMouseDown={(e) => { e.stopPropagation(); saveSelection(); }}
          onChange={(e) => withFocus(() => cmdForeColor(e.target.value))}
          className="absolute inset-x-0 bottom-0 h-1.5 w-full cursor-pointer opacity-0"
          style={{ colorScheme: "light" }}
        />
      </label>

      {/* Highlight color */}
      <label title="Sorot teks (highlight)" className="relative h-8 w-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer bg-yellow-100 text-slate-700 font-bold text-sm">
        H
        <input
          type="color"
          defaultValue="#fef08a"
          onMouseDown={(e) => { e.stopPropagation(); saveSelection(); }}
          onChange={(e) => withFocus(() => cmdHighlight(e.target.value))}
          className="absolute inset-x-0 bottom-0 h-1.5 w-full cursor-pointer opacity-0"
        />
      </label>

      <Sep />

      <ToolBtn title="Rata kiri" onClick={() => withFocus(() => cmdAlign("left"))}>
        <AlignLeft className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Rata tengah" onClick={() => withFocus(() => cmdAlign("center"))}>
        <AlignCenter className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Rata kanan" onClick={() => withFocus(() => cmdAlign("right"))}>
        <AlignRight className="w-4 h-4" />
      </ToolBtn>
      <ToolBtn title="Rata kiri-kanan (justify)" onClick={() => withFocus(() => cmdAlign("justify"))}>
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
            if (editorRef.current) withFocus(() => cmdSetLineHeight(v, editorRef.current!));
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
          if (editorRef.current) withFocus(() => cmdSetSpaceAfter(v, editorRef.current!));
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

      <ToolBtn title="Daftar bullet" onClick={() => withFocus(cmdUnorderedList)}>
        •≡
      </ToolBtn>
      <ToolBtn title="Daftar bernomor" onClick={() => withFocus(cmdOrderedList)}>
        <ListOrdered className="w-4 h-4" />
      </ToolBtn>

      <Sep />

      <ToolBtn title="Subscript (mis. H₂O)" onClick={() => withFocus(cmdSubscript)}>
        <span>
          X<sub>2</sub>
        </span>
      </ToolBtn>
      <ToolBtn title="Superscript (mis. x²)" onClick={() => withFocus(cmdSuperscript)}>
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
            <div className="fixed inset-0 z-10" onClick={() => setShapeMenuOpen(false)} />
            <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5 flex gap-1 min-w-max">
              {SHAPE_OPTIONS.map((s) => (
                <button
                  key={s.kind}
                  type="button"
                  title={s.label}
                  onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
                  onClick={() => handleInsertShape(s.kind)}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  {s.icon}
                </button>
              ))}
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
