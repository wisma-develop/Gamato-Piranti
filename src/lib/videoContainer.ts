// Pengemasan hasil video ke MP4 / MOV / WebM — SELALU tersedia di semua alat Video.
//
// Latar belakang: alat Video merekam hasil lewat MediaRecorder, yang hanya bisa menghasilkan MP4 bila browser
// mendukungnya (Chrome ≥126, Safari) — di Firefox/Chrome Linux biasanya hanya WebM. Agar MP4 & MOV (format
// universal) selalu tersedia, hasil rekaman dikemas ulang di langkah akhir memakai `mediabunny` (WebCodecs,
// BUKAN real-time — beberapa kali lebih cepat dari durasi video) dan dimuat secara lazy (tidak menambah
// ukuran awal halaman).
//
// Urutan pemilihan kodek (paling universal dulu), disesuaikan dengan kemampuan browser pengguna:
//   MP4/MOV : video H.264 → (cadangan) VP9 → AV1   ·   audio AAC → (cadangan) Opus
//   WebM    : video VP9 → VP8 → AV1                 ·   audio Opus
// Bila browser tidak punya encoder H.264, berkas tetap berekstensi .mp4/.mov tetapi berisi VP9 — kami
// menyampaikannya apa adanya kepada pengguna (catatan di UI), bukan menyembunyikannya.

import type { ExportFormat } from "@/lib/videoEngine";

export type VideoContainer = "mp4" | "mov" | "webm";
export type VideoContainerChoice = VideoContainer | "asli";

export const CONTAINER_META: Record<VideoContainer, { label: string; ext: string; mime: string; title: string; hint: string }> = {
  mp4: { label: "MP4", ext: "mp4", mime: "video/mp4", title: "MP4 (universal)", hint: "Diputar di hampir semua perangkat, WhatsApp, YouTube, Instagram, TV." },
  mov: { label: "MOV", ext: "mov", mime: "video/quicktime", title: "MOV (QuickTime)", hint: "Format Apple — ideal untuk iPhone/Mac dan editor video (Final Cut, Premiere)." },
  webm: { label: "WebM", ext: "webm", mime: "video/webm", title: "WebM", hint: "Ringan untuk web/Chrome/Firefox. Tidak didukung semua perangkat Apple lama." },
};

const STORE_KEY = "gamato.video.container";

export function getStoredContainer(): VideoContainerChoice {
  try {
    const v = localStorage.getItem(STORE_KEY);
    if (v === "mp4" || v === "mov" || v === "webm" || v === "asli") return v;
  } catch {
    /* penyimpanan tidak tersedia */
  }
  return "mp4";
}

export function storeContainer(v: VideoContainerChoice) {
  try {
    localStorage.setItem(STORE_KEY, v);
  } catch {
    /* abaikan */
  }
}

export interface ContainerResult {
  blob: Blob;
  fmt: ExportFormat;
  /** Catatan untuk pengguna (mis. kodek cadangan dipakai, atau konversi gagal sehingga format asli dipertahankan). */
  note?: string;
  /** true bila hasil benar-benar dikemas/diubah ke container yang diminta. */
  converted: boolean;
}

export interface ConvertOptions {
  onProgress?: (p: number) => void;
  trim?: { start?: number; end?: number };
  /** Skala/ubah ukuran (px). Rasio dijaga memakai fit "contain". */
  width?: number;
  height?: number;
  /** Bitrate video (bps) — kosongkan untuk kualitas tinggi otomatis. */
  videoBitrate?: number;
  frameRate?: number;
}

const VIDEO_PREF: Record<VideoContainer, string[]> = {
  mp4: ["avc", "vp9", "av1"],
  mov: ["avc", "vp9", "av1"],
  webm: ["vp9", "vp8", "av1"],
};
const AUDIO_PREF: Record<VideoContainer, string[]> = {
  mp4: ["aac", "opus"],
  mov: ["aac", "opus"],
  webm: ["opus", "vorbis"],
};

let aacRegistered = false;
async function ensureAacEncoder(mb: typeof import("mediabunny")): Promise<boolean> {
  if (await mb.canEncodeAudio("aac")) return true;
  try {
    if (!aacRegistered) {
      const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
      registerAacEncoder();
      aacRegistered = true;
    }
    return await mb.canEncodeAudio("aac");
  } catch {
    return false;
  }
}

export interface ContainerCapability {
  video: string | null; // kodek video yang akan dipakai (mis. "avc")
  audio: string | null;
  universal: boolean; // true bila H.264 + AAC
  summary: string;
}

/** Memeriksa (cepat) kodek apa yang akan dipakai browser ini untuk container tertentu. */
export async function probeContainer(target: VideoContainer, width = 1280, height = 720): Promise<ContainerCapability> {
  const mb = await import("mediabunny");
  const video = await mb.getFirstEncodableVideoCodec(VIDEO_PREF[target] as any, { width, height });
  let audio: string | null = null;
  if (target === "webm") audio = await mb.getFirstEncodableAudioCodec(AUDIO_PREF[target] as any);
  else audio = (await ensureAacEncoder(mb)) ? "aac" : await mb.getFirstEncodableAudioCodec(["opus"] as any);
  const universal = video === "avc" && audio === "aac";
  const names: Record<string, string> = { avc: "H.264", vp9: "VP9", vp8: "VP8", av1: "AV1", aac: "AAC", opus: "Opus", vorbis: "Vorbis" };
  const summary = !video
    ? "Browser ini tidak punya encoder video yang bisa dipakai."
    : `${names[video] ?? video}${audio ? ` + ${names[audio] ?? audio}` : ""}${universal ? " — universal" : ""}`;
  return { video, audio, universal, summary };
}

function describeFallback(target: VideoContainer, cap: { video: string | null; audio: string | null }): string | undefined {
  if (target === "webm") return undefined;
  const parts: string[] = [];
  if (cap.video && cap.video !== "avc") {
    parts.push(
      `Browser ini tidak punya encoder H.264, jadi ${CONTAINER_META[target].label} berisi video ${cap.video.toUpperCase()}. Aman diputar di Chrome, Edge, Firefox, Android, VLC, dan Safari/Mac terbaru; pemutar lama (mis. Windows Media Player lama) mungkin tidak bisa. Untuk H.264 penuh, ekspor dari Chrome/Edge/Safari versi desktop.`
    );
  }
  if (cap.audio && cap.audio !== "aac") parts.push(`Audio memakai ${cap.audio === "opus" ? "Opus" : cap.audio.toUpperCase()}.`);
  return parts.length ? parts.join(" ") : undefined;
}

/**
 * Mengemas/mentranskode `source` ke container target. Bukan real-time. Melempar Error bila tidak bisa.
 */
export async function convertVideoBlob(source: Blob, target: VideoContainer, opts: ConvertOptions = {}): Promise<ContainerResult> {
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.BlobSource(source), formats: mb.ALL_FORMATS });
  try {
    const vt = await input.getPrimaryVideoTrack();
    const w = opts.width || vt?.displayWidth || 1280;
    const h = opts.height || vt?.displayHeight || 720;

    const videoCodec = await mb.getFirstEncodableVideoCodec(VIDEO_PREF[target] as any, { width: w, height: h });
    if (vt && !videoCodec) throw new Error("Browser ini tidak memiliki encoder video yang dibutuhkan (H.264/VP9). Coba Chrome, Edge, atau Safari terbaru di desktop.");

    let audioCodec: string | null;
    if (target === "webm") audioCodec = await mb.getFirstEncodableAudioCodec(AUDIO_PREF[target] as any);
    else audioCodec = (await ensureAacEncoder(mb)) ? "aac" : await mb.getFirstEncodableAudioCodec(["opus"] as any);

    const format =
      target === "mp4" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : target === "mov" ? new mb.MovOutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat();
    const output = new mb.Output({ format, target: new mb.BufferTarget() });

    // Rekaman MediaRecorder punya laju bingkai tak tetap (VFR, kadang dua bingkai berstempel waktu sama) → pemutar ketat
    // bisa tersendat. Ratakan ke laju konstan sesuai rata-rata sumber supaya hasil MP4/MOV mulus.
    let frameRate = opts.frameRate;
    if (vt && !frameRate) {
      try {
        const st = await vt.computePacketStats(400);
        if (st.averagePacketRate > 0) frameRate = Math.min(60, Math.max(12, Math.round(st.averagePacketRate)));
      } catch {
        /* biarkan laju bingkai asli */
      }
    }

    // Tanpa bitrate eksplisit, pertahankan ukuran file ≈ sumber (H.264 butuh ± 1,3× bitrate VP8/VP9 untuk mutu setara);
    // tanpa ini kualitas "tinggi" bawaan bisa membuat file hasil jauh lebih besar dari rekaman.
    let videoBitrate = opts.videoBitrate;
    if (vt && !videoBitrate) {
      try {
        const dur = await input.computeDuration();
        if (dur > 0.2) {
          const srcBps = (source.size * 8) / dur;
          const factor = videoCodec === "avc" ? 1.3 : 1.05;
          videoBitrate = Math.round(Math.min(60e6, Math.max(600e3, (srcBps - 128e3) * factor)));
        }
      } catch {
        /* biarkan mediabunny memakai bitrate bawaan */
      }
    }

    const conversion = await mb.Conversion.init({
      input,
      output,
      trim: opts.trim && (opts.trim.start !== undefined || opts.trim.end !== undefined) ? opts.trim : undefined,
      video: vt
        ? {
            codec: videoCodec as any,
            width: opts.width,
            height: opts.height,
            fit: opts.width && opts.height ? "contain" : undefined,
            frameRate,
            bitrate: videoBitrate,
          }
        : undefined,
      audio: audioCodec ? { codec: audioCodec as any } : { discard: true },
    });
    if (!conversion.isValid) {
      const why = conversion.discardedTracks.map((t) => t.reason).join(", ");
      throw new Error(`Konversi tidak dapat dilakukan (${why || "track tidak didukung"}).`);
    }
    if (opts.onProgress) conversion.onProgress = (p: number) => opts.onProgress!(Math.min(1, Math.max(0, p)));
    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer || !buffer.byteLength) throw new Error("Hasil konversi kosong.");
    const meta = CONTAINER_META[target];
    return {
      blob: new Blob([buffer], { type: meta.mime }),
      fmt: { mimeType: meta.mime, ext: meta.ext, label: meta.label },
      note: describeFallback(target, { video: videoCodec, audio: audioCodec }),
      converted: true,
    };
  } finally {
    try {
      input.dispose();
    } catch {
      /* abaikan */
    }
  }
}

/**
 * Langkah akhir semua alat Video: terima hasil rekaman (`blob`, format `recorded`) lalu keluarkan sesuai pilihan
 * pengguna. TIDAK pernah melempar — bila konversi gagal, hasil asli dikembalikan beserta catatan jujur.
 */
export async function finalizeVideoExport(
  blob: Blob,
  recorded: ExportFormat,
  choice: VideoContainerChoice,
  onProgress?: (p: number) => void,
  extra: Omit<ConvertOptions, "onProgress"> = {}
): Promise<ContainerResult> {
  if (choice === "asli") return { blob, fmt: recorded, converted: false };
  try {
    return await convertVideoBlob(blob, choice, { ...extra, onProgress });
  } catch (err: any) {
    const reason = err?.message || "kesalahan tidak diketahui";
    return {
      blob,
      fmt: recorded,
      converted: false,
      note: `Pengemasan ke ${CONTAINER_META[choice].label} gagal di browser ini (${reason}). Hasil disimpan dalam format .${recorded.ext} (isinya tetap benar dan bisa diputar di Chrome/Firefox/VLC).`,
    };
  }
}
