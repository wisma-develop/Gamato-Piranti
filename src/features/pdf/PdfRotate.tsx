import React, { useState } from "react";
import { RotateCw, FileText, Trash2, Loader2, Zap } from "lucide-react";
import { PDFDocument, degrees } from "pdf-lib";
import { downloadBlob, fileToArrayBuffer } from "@/lib/file";
import { parsePageSpec } from "@/lib/pdf";
import { Input, Select, Btn } from "@/components/ui/primitives";
import { Dropzone } from "@/components/ui/Dropzone";
import { ToolInfoPanel } from "@/components/ui/ToolInfoPanel";

export const PdfRotate: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [rotateSpec, setRotateSpec] = useState("semua");
  const [pageSpec, setPageSpec] = useState("1-3");
  const [rotateDegrees, setRotateDegrees] = useState(90);
  const [isWorking, setIsWorking] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const addFiles = (incoming: File[]) => {
    const pdf = incoming.find((f) => f.type === "application/pdf");
    if (pdf) setFile(pdf);
    setInfo(null);
  };

  const handleRun = async () => {
    if (!file) return;
    setInfo(null);
    setIsWorking(true);
    try {
      const src = await PDFDocument.load(await fileToArrayBuffer(file));
      const total = src.getPageCount();
      const target = rotateSpec === "semua" ? Array.from({ length: total }, (_, i) => i) : parsePageSpec(pageSpec, total);
      target.forEach((idx) => src.getPage(idx).setRotation(degrees(rotateDegrees)));
      downloadBlob(new Blob([await src.save()], { type: "application/pdf" }), "gamato-rotated.pdf");
      setInfo(`${target.length} halaman diputar ${rotateDegrees}°.`);
    } catch (err: any) {
      setInfo("" + (err?.message || "Gagal memproses PDF."));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-5">
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

        {file && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3">
              <FileText className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button type="button" onClick={() => setFile(null)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Target Halaman" value={rotateSpec} onChange={(e) => setRotateSpec(e.target.value)}>
              <option value="semua">Semua halaman</option>
              <option value="pilih">Halaman tertentu</option>
            </Select>
            <Select label="Derajat Putar" value={rotateDegrees} onChange={(e) => setRotateDegrees(parseInt(e.target.value))}>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </Select>
          </div>
          {rotateSpec === "pilih" && (
            <Input label="Rentang Halaman" value={pageSpec} onChange={(e) => setPageSpec(e.target.value)} placeholder="contoh: 1-3,5" />
          )}
        </div>

        <Btn onClick={handleRun} disabled={isWorking || !file} className="w-full py-4 text-base">
          {isWorking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Putar Halaman
            </>
          )}
        </Btn>
      </div>

      <ToolInfoPanel
        icon={<RotateCw className="w-5 h-5" />}
        label="Putar Halaman"
        desc="Rotasi halaman"
        points={["Putar halaman yang miring.", "Bisa semua atau halaman tertentu."]}
        info={info}
        infoTone={info?.includes("diputar") ? "success" : "error"}
      />
    </div>
  );
};
