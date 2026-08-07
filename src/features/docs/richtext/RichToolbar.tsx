import React, { useRef, useState } from "react";
import { Bold, Italic, ListOrdered, Link2, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Type } from "lucide-react";
import { cn } from "@/utils/cn";
import { fileToDataUrl } from "@/lib/file";
import {
  cmdBold, cmdItalic, cmdUnderline, cmdStrikethrough, cmdSubscript, cmdSuperscript,
  cmdUndo, cmdRedo, cmdOrderedList, cmdUnorderedList, cmdAlign, cmdForeColor, cmdHighlight,
  cmdFontName, cmdFontSize, cmdUppercaseSelection, cmdInsertLink, cmdInsertImage, cmdRemoveFormat,
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
  const [fontSize, setFontSize] = useState(16);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const withFocus = (fn: () => void) => {
    editorRef.current?.focus();
    fn();
    onAfterCommand();
  };

  const handleInsertLink = () => {
    const url = window.prompt("Masukkan URL tautan (https://...)");
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

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
      {/* Undo / redo */}
      <ToolBtn title="Urungkan (Ctrl+Z)" onClick={() => withFocus(cmdUndo)}>↺</ToolBtn>
      <ToolBtn title="Ulangi (Ctrl+Y)" onClick={() => withFocus(cmdRedo)}>↻</ToolBtn>

      <Sep />

      {/* Font family */}
      <select
        title="Jenis font"
        onMouseDown={(e) => e.stopPropagation()}
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
          onMouseDown={(e) => e.stopPropagation()}
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
          onMouseDown={(e) => e.stopPropagation()}
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
          onMouseDown={(e) => e.stopPropagation()}
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

      <Sep />

      <ToolBtn title="Hapus semua format" onClick={() => withFocus(cmdRemoveFormat)}>
        Tx
      </ToolBtn>
    </div>
  );
};
