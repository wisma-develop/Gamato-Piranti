// Client for the Whisper worker. Exposes a tiny session API and a test hook:
// set `window.__GP_ASR_MOCK__ = true` before load to use a deterministic fake
// engine (used by the automated UI tests; no model download needed).

export interface AsrModelDef {
  id: string;
  label: string;
  size: string;
  note: string;
}

export const ASR_MODELS: AsrModelDef[] = [
  { id: "Xenova/whisper-tiny", label: "Tiny", size: "≈ 40 MB", note: "Paling cepat, akurasi dasar — cocok untuk draf cepat." },
  { id: "Xenova/whisper-base", label: "Base", size: "≈ 80 MB", note: "Seimbang antara kecepatan dan akurasi." },
  { id: "Xenova/whisper-small", label: "Small", size: "≈ 250 MB", note: "Paling akurat (lebih lambat) — disarankan untuk bahasa Indonesia." },
];

export const ASR_LANGUAGES: { id: string; label: string }[] = [
  { id: "auto", label: "Deteksi otomatis" },
  { id: "id", label: "Indonesia" },
  { id: "en", label: "Inggris" },
  { id: "ms", label: "Melayu" },
  { id: "jw", label: "Jawa" },
  { id: "su", label: "Sunda" },
  { id: "ar", label: "Arab" },
  { id: "zh", label: "Mandarin" },
  { id: "ja", label: "Jepang" },
  { id: "ko", label: "Korea" },
  { id: "hi", label: "Hindi" },
  { id: "es", label: "Spanyol" },
  { id: "fr", label: "Prancis" },
  { id: "de", label: "Jerman" },
  { id: "nl", label: "Belanda" },
  { id: "pt", label: "Portugis" },
  { id: "ru", label: "Rusia" },
  { id: "tr", label: "Turki" },
  { id: "th", label: "Thai" },
  { id: "vi", label: "Vietnam" },
];

export interface AsrChunkResult {
  segments: { start: number; end: number; text: string }[];
}

export interface AsrSession {
  transcribe(audio: Float32Array, language: string, task: "transcribe" | "translate"): Promise<AsrChunkResult>;
  terminate(): void;
}

export type AsrStatus = { stage: "download"; pct: number; file: string } | { stage: "loading" } | { stage: "ready" };

const MOCK_LINES = [
  "eh selamat pagi semuanya terima kasih sudah hadir pada rapat hari ini",
  "baik ehm kita mulai dengan laporan penjualan kuartal ketiga",
  "penjualan naik dua belas persen dibanding kuartal sebelumnya",
  "hmm tim pemasaran berhasil menambah pelanggan baru lewat kampanye digital",
  "selanjutnya kita bahas rencana anggaran untuk kuartal keempat",
  "anggaran pemasaran akan dinaikkan karena kampanye digital terbukti efektif",
  "ada pertanyaan sebelum kita lanjut ke agenda berikutnya",
  "tidak ada ya baik terima kasih semuanya",
];

function createMockSession(onStatus: (s: AsrStatus) => void): AsrSession {
  let k = 0;
  setTimeout(() => onStatus({ stage: "download", pct: 50, file: "mock.onnx" }), 10);
  return {
    async transcribe(audio) {
      await new Promise((r) => setTimeout(r, 120));
      const dur = audio.length / 16000;
      const segs: { start: number; end: number; text: string }[] = [];
      const n = Math.max(1, Math.min(3, Math.round(dur / 8)));
      for (let i = 0; i < n; i++) {
        segs.push({ start: (dur / n) * i, end: (dur / n) * (i + 1) - 0.2, text: MOCK_LINES[k++ % MOCK_LINES.length] });
      }
      return { segments: segs };
    },
    terminate() {},
  };
}

export async function createAsrSession(model: string, onStatus: (s: AsrStatus) => void): Promise<AsrSession> {
  if (typeof window !== "undefined" && (window as any).__GP_ASR_MOCK__) {
    const s = createMockSession(onStatus);
    await new Promise((r) => setTimeout(r, 60));
    onStatus({ stage: "ready" });
    return s;
  }
  const worker = new Worker(new URL("./asr.worker.ts", import.meta.url), { type: "module" });
  let nextId = 1;
  const pending = new Map<number, { resolve: (r: AsrChunkResult) => void; reject: (e: Error) => void }>();
  const files = new Map<string, { loaded: number; total: number }>();

  await new Promise<void>((resolve, reject) => {
    worker.onerror = (ev) => reject(new Error(ev.message || "Worker gagal dimulai."));
    worker.onmessage = (ev: MessageEvent) => {
      const m = ev.data;
      if (m.type === "download") {
        const p = m.p ?? {};
        if (p.status === "progress" && p.total) {
          files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
          let loaded = 0;
          let total = 0;
          files.forEach((v) => { loaded += v.loaded; total += v.total; });
          onStatus({ stage: "download", pct: total ? (loaded / total) * 100 : 0, file: String(p.file ?? "") });
        }
      } else if (m.type === "status") onStatus({ stage: "loading" });
      else if (m.type === "ready") resolve();
      else if (m.type === "error") reject(new Error(m.message));
    };
    worker.postMessage({ type: "init", model });
  });

  // after init: route results
  worker.onerror = (ev) => {
    pending.forEach((p) => p.reject(new Error(ev.message || "Worker error")));
    pending.clear();
  };
  worker.onmessage = (ev: MessageEvent) => {
    const m = ev.data;
    if (m.type === "result") pending.get(m.id)?.resolve({ segments: m.segments });
    else if (m.type === "error" && m.id != null) pending.get(m.id)?.reject(new Error(m.message));
    if ((m.type === "result" || m.type === "error") && m.id != null) pending.delete(m.id);
  };
  onStatus({ stage: "ready" });

  return {
    transcribe(audio, language, task) {
      return new Promise<AsrChunkResult>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        worker.postMessage({ type: "chunk", id, audio, language, task }, [audio.buffer]);
      });
    },
    terminate() {
      pending.forEach((p) => p.reject(new Error("Dibatalkan.")));
      pending.clear();
      worker.terminate();
    },
  };
}
