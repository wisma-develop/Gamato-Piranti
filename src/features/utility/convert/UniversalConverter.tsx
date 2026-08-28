import React, { useCallback, useMemo, useState } from "react";
import {
  Upload, Download, X, ArrowRight, Loader2, FileArchive,
  ClipboardPaste, Files as FilesIcon, FolderOpen,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { sanitizeFileName } from "@/utils/sanitize";
import { downloadBlob } from "@/lib/file";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";
import { GamatoSelect } from "@/components/ui/GamatoSelect";
import { useToast } from "@/components/ui/GamatoToast";
import { Dropzone } from "@/components/ui/Dropzone";
import { FORMATS, detectFormatFromFilename, getTargetFormats, type FormatDef } from "./formatRegistry";
import { convertText, convertFile, convertFilesToZip, type ConvertOutput } from "./convertDispatch";
import { listZipEntries, extractZipFile, extractAllAsZip, type ZipEntryInfo } from "./converters/archiveConvert";
import { isVideoConvertSupported } from "./converters/videoConvert";

type TopMode = "upload" | "paste" | "bundle";

const PASTEABLE_SOURCES = ["json", "csv", "tsv", "xml", "yaml", "txt", "md", "html"];

const ModeTab: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
      active ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
    )}
  >
    {icon}
    {label}
  </button>
);

export const UniversalConverter: React.FC = () => {
  const [topMode, setTopMode] = useState<TopMode>("upload");
  const { showToast } = useToast();

  // Upload mode state
  const [file, setFile] = useState<File | null>(null);
  const [sourceFormat, setSourceFormat] = useState<FormatDef | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Paste mode state
  const [pasteSourceId, setPasteSourceId] = useState<string>("json");
  const [pasteText, setPasteText] = useState("");

  // Bundle (multi-file -> zip) mode state
  const [bundleFiles, setBundleFiles] = useState<File[]>([]);

  // ZIP-input special view
  const [zipEntries, setZipEntries] = useState<ZipEntryInfo[] | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);

  // Shared conversion state
  const [targetId, setTargetId] = useState<string | null>(null);
  const [title, setTitle] = useState("hasil-konversi");
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertOutput | null>(null);

  const resetResult = () => {
    setResult(null);
    setError(null);
    setProgress(null);
  };

  // ─── Upload mode ────────────────────────────────────────────────────
  const handleFileSelected = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      resetResult();
      setTargetId(null);
      setZipEntries(null);
      setZipFile(null);

      const detected = detectFormatFromFilename(f.name);
      if (!detected) {
        setFile(null);
        setSourceFormat(null);
        setError(`Format file ".${f.name.split(".").pop()}" belum dikenali oleh Universal Converter.`);
        return;
      }

      setFile(f);
      setSourceFormat(detected);
      setTitle(sanitizeFileName(f.name.replace(/\.[^.]+$/, "")) || "hasil-konversi");

      if (detected.id === "zip") {
        try {
          const entries = await listZipEntries(f);
          setZipEntries(entries.filter((e) => !e.isDirectory));
          setZipFile(f);
        } catch {
          setError("Gagal membaca isi file ZIP — mungkin rusak atau terenkripsi.");
        }
      }
    },
    []
  );

  const availableTargets = useMemo(() => {
    if (topMode === "paste") return getTargetFormats(pasteSourceId);
    if (sourceFormat) return getTargetFormats(sourceFormat.id);
    return [];
  }, [topMode, pasteSourceId, sourceFormat]);

  const runConvert = useCallback(async () => {
    if (!targetId) return;
    resetResult();
    setIsConverting(true);
    try {
      let output: ConvertOutput;
      if (topMode === "paste") {
        if (!pasteText.trim()) throw new Error("Tempel atau ketik teks/data terlebih dahulu.");
        output = await convertText(pasteText, pasteSourceId, targetId, { title });
      } else if (topMode === "bundle") {
        output = await convertFilesToZip(bundleFiles, title);
      } else {
        if (!file || !sourceFormat) throw new Error("Pilih file terlebih dahulu.");
        const isVideo = sourceFormat.id === "video";
        output = await convertFile(file, sourceFormat.id, targetId, {
          title,
          onProgress: isVideo ? (p) => setProgress(p) : undefined,
        });
      }
      setResult(output);
      showToast("Konversi berhasil.", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Konversi gagal — periksa kembali file/data yang dimasukkan.");
    } finally {
      setIsConverting(false);
      setProgress(null);
    }
  }, [targetId, topMode, pasteText, pasteSourceId, bundleFiles, file, sourceFormat, title, showToast]);

  const downloadResult = useCallback(() => {
    if (!result) return;
    downloadBlob(result.blob, sanitizeFileName(result.filename, result.filename));
  }, [result]);

  const switchMode = (m: TopMode) => {
    setTopMode(m);
    resetResult();
    setTargetId(null);
    setFile(null);
    setSourceFormat(null);
    setZipEntries(null);
    setZipFile(null);
  };

  return (
    <div className="space-y-5">
      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2">
        <ModeTab active={topMode === "upload"} onClick={() => switchMode("upload")} icon={<Upload className="w-4 h-4" />} label="Unggah File" />
        <ModeTab active={topMode === "paste"} onClick={() => switchMode("paste")} icon={<ClipboardPaste className="w-4 h-4" />} label="Tempel Teks / Data" />
        <ModeTab active={topMode === "bundle"} onClick={() => switchMode("bundle")} icon={<FilesIcon className="w-4 h-4" />} label="Gabung ke ZIP" />
      </div>

      {/* ── Upload mode ── */}
      {topMode === "upload" && !zipEntries && (
        <div className="space-y-4">
          {!file ? (
            <Dropzone
              onFiles={handleFileSelected}
              multiple={false}
              label="Drop file apa saja di sini"
              sublabel="Gambar, dokumen, spreadsheet, data, audio, video — format terdeteksi otomatis"
              icon={<Upload className="w-8 h-8" />}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              {sourceFormat && <sourceFormat.icon className="w-8 h-8 text-indigo-500 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">
                  {sourceFormat?.label} · {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setSourceFormat(null);
                  resetResult();
                  setTargetId(null);
                }}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                aria-label="Ganti file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ZIP special view ── */}
      {zipEntries && zipFile && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <FileArchive className="w-4 h-4" /> {zipEntries.length} file di dalam {zipFile.name}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const blob = await extractAllAsZip(zipFile);
                  downloadBlob(blob, sanitizeFileName(zipFile.name));
                  showToast("ZIP diunduh.", "success");
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Unduh semua
              </button>
              <button
                type="button"
                onClick={() => {
                  setZipEntries(null);
                  setZipFile(null);
                  setFile(null);
                  setSourceFormat(null);
                }}
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {zipEntries.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                <span className="text-sm text-slate-600 dark:text-slate-300 truncate font-mono">{entry.name}</span>
                <button
                  type="button"
                  onClick={async () => {
                    const blob = await extractZipFile(zipFile, entry.name);
                    downloadBlob(blob, sanitizeFileName(entry.name.split("/").pop() || entry.name));
                  }}
                  className="shrink-0 ml-3 p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-colors"
                  aria-label={`Unduh ${entry.name}`}
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Paste mode ── */}
      {topMode === "paste" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Format Sumber</label>
              <GamatoSelect
                value={pasteSourceId}
                onChange={(e) => {
                  setPasteSourceId(e.target.value);
                  setTargetId(null);
                  resetResult();
                }}
              >
                {PASTEABLE_SOURCES.map((id) => (
                  <option key={id} value={id}>
                    {FORMATS[id].label}
                  </option>
                ))}
              </GamatoSelect>
            </div>
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={10}
            placeholder={`Tempel atau ketik ${FORMATS[pasteSourceId].label} di sini…`}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-mono focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
          />
        </div>
      )}

      {/* ── Bundle mode ── */}
      {topMode === "bundle" && (
        <div className="space-y-4">
          <Dropzone
            onFiles={(files) => setBundleFiles((prev) => [...prev, ...files])}
            multiple
            label="Drop beberapa file di sini"
            sublabel="Semua file akan digabung jadi satu .zip"
            icon={<FolderOpen className="w-8 h-8" />}
          />
          {bundleFiles.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{bundleFiles.length} file dipilih</p>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {bundleFiles.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-sm text-slate-600 dark:text-slate-300 truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setBundleFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors shrink-0 ml-3"
                      aria-label={`Hapus ${f.name}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Target picker + convert (shared across modes, hidden for ZIP special view) ── */}
      {!zipEntries && ((topMode === "upload" && sourceFormat) || topMode === "paste" || (topMode === "bundle" && bundleFiles.length > 0)) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Nama File Hasil</label>
            <input
              value={title}
              onChange={(e) => setTitle(sanitizeFileName(e.target.value) || "hasil-konversi")}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>

          {topMode === "bundle" ? (
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <FileArchive className="w-5 h-5 text-indigo-500" />
              <span>
                {bundleFiles.length} file <ArrowRight className="w-3.5 h-3.5 inline mx-1" /> satu file <strong>.zip</strong>
              </span>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Konversi ke</label>
              {availableTargets.length === 0 ? (
                <p className="text-sm text-slate-400">Tidak ada format tujuan yang tersedia untuk format ini.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableTargets.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTargetId(t.id);
                        resetResult();
                      }}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all",
                        targetId === t.id
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                      )}
                    >
                      <t.icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
              {sourceFormat?.id === "video" && !isVideoConvertSupported() && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Browser ini tidak mendukung konversi video (perlu MediaRecorder). Coba Chrome atau Edge terbaru.</p>
              )}
            </div>
          )}

          {error && <GamatoInlineAlert message={error} tone="error" />}

          {progress !== null && (
            <div className="space-y-1.5">
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-150" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="text-xs text-slate-400 text-center">Memproses… {Math.round(progress * 100)}%</p>
            </div>
          )}

          {!result ? (
            <button
              type="button"
              onClick={runConvert}
              disabled={isConverting || (topMode !== "bundle" && !targetId)}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Mengonversi…
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" /> Konversi Sekarang
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={downloadResult}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" /> Unduh {result.filename}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
