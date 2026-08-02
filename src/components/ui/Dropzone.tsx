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
        "relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 group",
        isDragging ? "border-blue-500 bg-blue-50 scale-[1.01]" : "border-slate-300 hover:border-blue-400 hover:bg-blue-50/40"
      )}
    >
      <input ref={inputRef} type="file" className="hidden" accept={accept} multiple={multiple} onChange={(e) => { if (e.target.files) onFiles(Array.from(e.target.files)); }} />
      <div className="flex flex-col items-center gap-3">
        <div className={cn("p-4 rounded-2xl transition-all", isDragging ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500")}>
          {icon ?? <Upload className="w-8 h-8" />}
        </div>
        <div>
          <p className="text-base font-semibold text-slate-800">{label}</p>
          <p className="text-sm text-slate-400 mt-0.5">{sublabel}</p>
        </div>
      </div>
    </div>
  );
};
