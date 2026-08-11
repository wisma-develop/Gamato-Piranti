import React from "react";
import { Upload, Image as ImageIcon } from "lucide-react";

export const LogoUpload: React.FC<{
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
}> = ({ file, onChange, label = "Logo Perusahaan", hint = "PNG/JPG, latar transparan lebih rapi" }) => (
  <div>
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}</p>
    {file ? (
      <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
        <ImageIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
        <span className="text-sm text-slate-600 dark:text-slate-300 truncate flex-1">{file.name}</span>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold text-red-500 hover:text-red-700 shrink-0">
          Hapus
        </button>
      </div>
    ) : (
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-all text-sm font-semibold text-slate-500 dark:text-slate-400">
        <Upload className="w-4 h-4" />
        Unggah Logo
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
    )}
    {hint && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{hint}</p>}
  </div>
);
