// ─── Archive converters ─────────────────────────────────────────────────────
import JSZip from "jszip";

export async function filesToZip(files: File[]): Promise<Blob> {
  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const file of files) {
    let name = file.name || "file";
    let i = 2;
    while (usedNames.has(name)) {
      const dot = file.name.lastIndexOf(".");
      name = dot > 0 ? `${file.name.slice(0, dot)} (${i})${file.name.slice(dot)}` : `${file.name} (${i})`;
      i++;
    }
    usedNames.add(name);
    zip.file(name, file);
  }
  return zip.generateAsync({ type: "blob" });
}

export interface ZipEntryInfo {
  name: string;
  size: number;
  isDirectory: boolean;
}

export async function listZipEntries(file: File): Promise<ZipEntryInfo[]> {
  const zip = await JSZip.loadAsync(file);
  const entries: ZipEntryInfo[] = [];
  zip.forEach((relativePath, entry) => {
    entries.push({ name: relativePath, size: (entry as any)._data?.uncompressedSize ?? 0, isDirectory: entry.dir });
  });
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function extractZipFile(file: File, entryName: string): Promise<Blob> {
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file(entryName);
  if (!entry) throw new Error(`"${entryName}" tidak ditemukan di dalam ZIP.`);
  return entry.async("blob");
}

/** Extracts every file in the ZIP and re-bundles them flat (no subfolder structure) into a new ZIP — useful as a quick "download all" after inspecting contents. */
export async function extractAllAsZip(file: File): Promise<Blob> {
  const zip = await JSZip.loadAsync(file);
  return zip.generateAsync({ type: "blob" });
}
