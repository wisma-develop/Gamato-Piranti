import React from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Select, Label } from "@/components/ui/primitives";
import { FONT_PRESETS } from "@/lib/fontPresets";
import type { CustomFontEntry } from "@/lib/customFont";

export interface FontPickerProps {
  /** Currently selected font-family name (a preset id or a custom font's family). */
  value: string;
  onChange: (family: string) => void;
  customFonts: CustomFontEntry[];
  isFontLoading: boolean;
  fontError: string | null;
  onUpload: (file: File | null) => void;
  onRemoveCustomFont: (id: string) => void;
  label?: string;
  /** Shows just the dropdown without the "Upload Font Kustom" affordance below it. */
  hideUpload?: boolean;
  /** Shows just the "Upload Font Kustom" affordance without the dropdown — handy when the
   *  dropdown needs to sit in a different spot in the layout (e.g. side-by-side with another
   *  field) while the upload widget/chip list sits below on its own line. */
  hideSelect?: boolean;
}

/**
 * Reusable "pick a font" control: a dropdown of curated presets (grouped by
 * style — sans/serif/script/display/mono — via a plain flat list since our
 * shared `<Select>` doesn't render `<optgroup>` labels) plus any fonts the
 * user has uploaded themselves, and the upload affordance itself.
 *
 * Used identically by Certificate, Business Card Studio, Invoice, Kwitansi,
 * Struk, and CV Maker so font selection behaves and looks the same
 * everywhere in Gamato Piranti.
 */
export const FontPicker: React.FC<FontPickerProps> = ({
  value,
  onChange,
  customFonts,
  isFontLoading,
  fontError,
  onUpload,
  onRemoveCustomFont,
  label = "Font",
  hideUpload,
  hideSelect,
}) => {
  return (
    <div className="space-y-2">
      {!hideSelect && (
        <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
          {FONT_PRESETS.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
          {customFonts.length > 0 && (
            <>
              {customFonts.map((f) => (
                <option key={f.id} value={f.family}>{`${f.fileName} (Kustom)`}</option>
              ))}
            </>
          )}
        </Select>
      )}

      {!hideUpload && (
        <div>
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:text-indigo-700 dark:hover:text-indigo-300">
            {isFontLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload Font Kustom (.ttf / .otf / .woff)
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              className="hidden"
              disabled={isFontLoading}
              onChange={(e) => { onUpload(e.target.files?.[0] ?? null); e.target.value = ""; }}
            />
          </label>
          {fontError && <p className="text-xs text-red-500 mt-1">{fontError}</p>}
          {customFonts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {customFonts.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-lg">
                  {f.fileName}
                  <button type="button" onClick={() => onRemoveCustomFont(f.id)} className="hover:text-red-500 transition-colors" aria-label={`Hapus font ${f.fileName}`}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Re-exported so callers that only need the label helper (e.g. a compact
// inline layout) don't have to import `primitives` directly just for this.
export { Label as FontPickerLabel };
