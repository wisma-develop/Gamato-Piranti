import React, { useRef } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/utils/cn";

export const Dropzone: React.FC<{
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  sublabel?: string;
  icon?: React.ReactNode;
  isDragging?: boolean;
  setIsDragging?: (v: boolean) => void;
}> = ({ onFiles, accept, multiple = true, label = "Drop files here", sublabel = "atau klik untuk browse", icon, isDragging, setIsDragging }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging?.(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  };
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging?.(true); }}
      onDragLeave={() => setIsDragging?.(false)}
      onDrop={handleDrop}
      className={cn(
        "gp-spot [--spot:color-mix(in_oklab,var(--color-indigo-500)_10%,transparent)] relative overflow-hidden border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 group bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,color-mix(in_oklab,var(--color-indigo-500)_7%,transparent),transparent)]",
        isDragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 scale-[1.01] shadow-lg shadow-indigo-500/10" : "border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 hover:shadow-md hover:shadow-indigo-500/5"
      )}
    >
      <input ref={inputRef} type="file" className="hidden" accept={accept} multiple={multiple} onChange={(e) => { if (e.target.files) onFiles(Array.from(e.target.files)); }} />
      <div className="flex flex-col items-center gap-3">
        <div className={cn("p-4 rounded-2xl transition-all duration-300 group-hover:scale-105", !isDragging && "gp-bob [animation-duration:5s]", isDragging ? "scale-110 " +  "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 group-hover:text-indigo-500 dark:group-hover:text-indigo-300")}>
          {icon ?? <Upload className="w-8 h-8" />}
        </div>
        <div>
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">{label}</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">{sublabel}</p>
        </div>
      </div>
    </div>
  );
};
