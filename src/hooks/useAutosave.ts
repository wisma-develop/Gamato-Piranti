import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearDraft, draftImageToFile, fileToDraftImage, loadDraft, saveDraft, type DraftEnvelope, type DraftImage, type DraftSaveResult } from "@/lib/draftStorage";

export type AutosaveStatus = "idle" | "saved" | "too-big" | "unavailable";

export interface AutosaveApi {
  status: AutosaveStatus;
  /** Epoch ms penyimpanan terakhir (null bila belum ada). */
  savedAt: number | null;
  /** True bila draf dari sesi sebelumnya dipulihkan saat alat dibuka. */
  restored: boolean;
  /** True bila bagian besar (gambar) tidak muat dan hanya teks/pengaturan yang tersimpan. */
  lean: boolean;
  dismissRestored: () => void;
  /** Hapus draf tersimpan. Pemanggil menyegarkan halaman agar alat kembali ke bawaan. */
  discard: () => void;
}

/**
 * Muat draf SEKALI saat mount (gunakan hasilnya sebagai nilai awal state), lalu simpan otomatis tiap perubahan
 * dengan jeda singkat. Tidak menulis apa pun sebelum pengguna benar-benar mengubah sesuatu (state masih sama
 * dengan nilai awal), sehingga membuka alat tanpa mengedit tidak meninggalkan draf.
 */
export function useDraft<T, X = unknown>(key: string, version = 1): DraftEnvelope<T, X> | null {
  return useMemo(() => loadDraft<T, X>(key, version), [key, version]);
}

export function useAutosave<T, X = unknown>(opts: {
  key: string;
  value: T;
  /** Bagian besar opsional (mis. gambar). Berubah → ikut disimpan. */
  extra?: X;
  version?: number;
  delay?: number;
  restored?: boolean;
}): AutosaveApi {
  const { key, value, extra, version = 1, delay = 800, restored: wasRestored = false } = opts;
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [lean, setLean] = useState(false);
  const [restored, setRestored] = useState(wasRestored);
  const initialValue = useRef(value);
  const initialExtra = useRef(extra);
  const stopped = useRef(false);

  useEffect(() => {
    if (stopped.current) return;
    // belum ada perubahan dari nilai awal → jangan tulis apa pun
    if (value === initialValue.current && extra === initialExtra.current) return;
    const t = window.setTimeout(() => {
      if (stopped.current) return;
      const r: DraftSaveResult = saveDraft(key, value, extra, version);
      if (r === "full" || r === "lean") { setStatus("saved"); setSavedAt(Date.now()); setLean(r === "lean"); }
      else setStatus(r);
    }, delay);
    return () => window.clearTimeout(t);
  }, [key, value, extra, version, delay]);

  const dismissRestored = useCallback(() => setRestored(false), []);
  const discard = useCallback(() => { stopped.current = true; clearDraft(key); setStatus("idle"); setSavedAt(null); setRestored(false); }, [key]);

  return { status, savedAt, restored, lean, dismissRestored, discard };
}


/**
 * State `File` (logo, template…) yang ikut tersimpan di draf. Mengembalikan [file, setFile, draftImage]:
 * `draftImage` (data URL) dimasukkan ke `extra` pada useAutosave; saat mount, gambar dari draf dipulihkan menjadi File.
 */
export function useDraftFile(initial: DraftImage | null | undefined) {
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<DraftImage | null>(initial ?? null);
  const pending = useRef(!!initial);

  useEffect(() => {
    if (!initial) return;
    let off = false;
    draftImageToFile(initial).then((f) => { if (!off) { pending.current = false; if (f) setFile(f); } });
    return () => { off = true; };
    // sengaja hanya saat mount: `initial` berasal dari draf yang dimuat sekali
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pending.current && !file) return; // pemulihan masih berjalan → jangan timpa dengan null
    let off = false;
    fileToDraftImage(file).then((i) => { if (!off) setImage(i); });
    return () => { off = true; };
  }, [file]);

  return [file, setFile, image] as const;
}
