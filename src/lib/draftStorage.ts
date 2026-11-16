/**
 * Penyimpanan draf otomatis (localStorage) untuk alat penyunting — pola yang sama dengan CV Maker, dijadikan
 * infrastruktur bersama. Semua fungsi aman dipanggil saat penyimpanan tidak tersedia (mode privat, kuota penuh).
 *
 * Amplop draf: { v, savedAt, data, extra }.
 *  - `data`  : state utama alat (JSON murni).
 *  - `extra` : bagian besar opsional (mis. logo/template dalam data URL). Bila kuota penuh, `extra` dibuang
 *              lebih dulu agar teks/pengaturan tetap tersimpan.
 */
export interface DraftEnvelope<T, X = unknown> {
  v: number;
  savedAt: number;
  data: T;
  extra?: X;
}

export type DraftSaveResult = "full" | "lean" | "too-big" | "unavailable";

export const DRAFT_PREFIX = "gamato.draft.";

export function loadDraft<T, X = unknown>(key: string, version = 1): DraftEnvelope<T, X> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope<T, X>>;
    if (!parsed || typeof parsed !== "object" || parsed.v !== version || parsed.data === undefined) return null;
    return { v: parsed.v, savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(), data: parsed.data as T, extra: parsed.extra };
  } catch {
    return null;
  }
}

export function saveDraft<T, X = unknown>(key: string, data: T, extra?: X, version = 1): DraftSaveResult {
  const base = { v: version, savedAt: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify({ ...base, data, extra }));
    return "full";
  } catch {
    /* kuota penuh / tidak tersedia → coba tanpa bagian besar */
  }
  try {
    localStorage.setItem(key, JSON.stringify({ ...base, data }));
    return extra === undefined || extra === null ? "full" : "lean";
  } catch (e) {
    const name = (e as { name?: string } | null)?.name ?? "";
    return /quota/i.test(name) ? "too-big" : "unavailable";
  }
}

export function clearDraft(key: string): void {
  try { localStorage.removeItem(key); } catch { /* abaikan */ }
}

/** Gambar yang ikut disimpan dalam draf (logo, template…). Dibatasi ukuran agar kuota 5 MB tidak cepat habis. */
export interface DraftImage { name: string; type: string; dataUrl: string }

const MAX_DRAFT_IMAGE_BYTES = 900_000;

export function fileToDraftImage(file: File | null | undefined): Promise<DraftImage | null> {
  if (!file || file.size > MAX_DRAFT_IMAGE_BYTES) return Promise.resolve(null);
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? { name: file.name, type: file.type || "image/png", dataUrl: r.result } : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}

export async function draftImageToFile(img: DraftImage | null | undefined): Promise<File | null> {
  if (!img || typeof img.dataUrl !== "string" || !img.dataUrl.startsWith("data:")) return null;
  try {
    const blob = await (await fetch(img.dataUrl)).blob();
    return new File([blob], img.name || "gambar", { type: img.type || blob.type });
  } catch {
    return null;
  }
}

/** Gabungkan draf ke nilai bawaan (dangkal) — field baru di versi aplikasi berikutnya tetap punya nilai awal. */
export function mergeDraft<T extends object>(base: T, draft: Partial<T> | null | undefined): T {
  return draft && typeof draft === "object" ? { ...base, ...draft } : base;
}
