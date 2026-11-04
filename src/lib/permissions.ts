/**
 * Gamato Permission Engine — satu pintu untuk semua izin web (kamera, mikrofon, lokasi,
 * papan klip, tangkap layar, speaker, perangkat USB).
 *
 * Tujuan:
 *  - Semua alat memakai logika yang sama (tidak ada lagi `err.name === "NotAllowedError"` tersebar).
 *  - Pesan galat jelas berbahasa Indonesia + langkah memulihkan izin sesuai browser.
 *  - Permintaan izin selalu dipicu gestur pengguna (klik tombol), tidak pernah otomatis saat halaman dibuka.
 *  - Fallback otomatis (constraint terlalu ketat → coba lagi lebih longgar, clipboard modern → execCommand,
 *    geolokasi akurat → perkiraan kasar).
 *
 * Tidak ada data izin yang dikirim ke mana pun; semua terjadi di browser.
 */

export type PermKind =
  | "camera"
  | "microphone"
  | "geolocation"
  | "clipboard-read"
  | "clipboard-write"
  | "display-capture"
  | "usb"
  | "speaker-selection";

export type PermState = "granted" | "denied" | "prompt" | "unsupported" | "unknown";

export type PermFailure = {
  /** Kode ringkas untuk logika UI. */
  code: "denied" | "dismissed" | "no-device" | "busy" | "insecure" | "unsupported" | "blocked-policy" | "timeout" | "unavailable" | "aborted" | "unknown";
  title: string;
  message: string;
  /** Langkah memulihkan izin (kosong bila tidak relevan). */
  howTo: string[];
  /** Apakah masuk akal menawarkan tombol "Coba lagi". */
  retryable: boolean;
};

export const PERM_LABEL: Record<PermKind, string> = {
  camera: "kamera",
  microphone: "mikrofon",
  geolocation: "lokasi",
  "clipboard-read": "papan klip (baca)",
  "clipboard-write": "papan klip (tulis)",
  "display-capture": "tangkap layar",
  usb: "perangkat USB",
  "speaker-selection": "pemilihan speaker",
};

/* ───────────────────────── Deteksi lingkungan ───────────────────────── */

/** Izin web hanya tersedia di HTTPS atau localhost. */
export function isSecureEnv(): boolean {
  if (typeof window === "undefined") return true;
  return window.isSecureContext === true;
}

type BrowserFamily = "chrome" | "edge" | "firefox" | "safari" | "other";
export type Platform = "android" | "ios" | "desktop";

export function detectBrowser(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): BrowserFamily {
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua) || /FxiOS\//.test(ua)) return "firefox";
  if (/CriOS\//.test(ua) || /Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

export function detectPlatform(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): Platform {
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ menyamar sebagai Mac
  if (typeof navigator !== "undefined" && /Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1) return "ios";
  return "desktop";
}

/** Langkah membuka kembali izin yang sudah ditolak, disesuaikan dengan browser & perangkat. */
export function unblockSteps(kind: PermKind): string[] {
  const label = PERM_LABEL[kind];
  const b = detectBrowser();
  const p = detectPlatform();
  if (p === "ios") {
    return [
      `Buka Pengaturan iPhone/iPad → Safari (atau browser yang dipakai) → ${kind === "geolocation" ? "Lokasi" : kind === "camera" ? "Kamera" : "Mikrofon"}.`,
      "Pilih \"Tanya\" atau \"Izinkan\" untuk situs ini.",
      "Kembali ke halaman ini lalu muat ulang (tarik ke bawah) dan coba lagi.",
    ];
  }
  if (b === "firefox") {
    return [
      "Klik ikon izin (gembok/kamera) di sebelah kiri alamat situs.",
      `Hapus status \"Diblokir\" pada ${label}.`,
      "Muat ulang halaman (F5) lalu klik tombolnya lagi dan pilih \"Izinkan\".",
    ];
  }
  if (b === "safari") {
    return [
      "Menu Safari → Pengaturan → Situs Web.",
      `Pilih ${kind === "geolocation" ? "Lokasi" : kind === "camera" ? "Kamera" : "Mikrofon"} lalu ubah situs ini menjadi \"Izinkan\" atau \"Tanya\".`,
      "Muat ulang halaman lalu coba lagi.",
    ];
  }
  // Chrome / Edge / lainnya (Android & desktop)
  return [
    "Klik ikon setelan di sebelah kiri alamat situs (gembok atau ikon penyetel).",
    `Buka \"Izin\" / \"Setelan situs\" lalu ubah ${label} menjadi \"Izinkan\" (atau \"Tanya\").`,
    "Muat ulang halaman lalu klik tombolnya lagi.",
  ];
}

/* ───────────────────────── Permissions API ───────────────────────── */

/** Nama izin yang dikenal Permissions API (tidak semua browser mengenal semuanya). */
const API_NAME: Partial<Record<PermKind, string>> = {
  camera: "camera",
  microphone: "microphone",
  geolocation: "geolocation",
  "clipboard-read": "clipboard-read",
  "clipboard-write": "clipboard-write",
  "speaker-selection": "speaker-selection",
};

/**
 * Cek status izin TANPA memunculkan prompt. Mengembalikan "unknown" bila browser tidak
 * mendukung Permissions API untuk izin tersebut (mis. Safari lama / Firefox untuk kamera).
 */
export async function queryPermission(kind: PermKind): Promise<PermState> {
  if (typeof navigator === "undefined") return "unknown";
  const name = API_NAME[kind];
  if (!name || !(navigator as any).permissions?.query) return "unknown";
  try {
    const status: PermissionStatus = await (navigator as any).permissions.query({ name });
    return status.state as PermState;
  } catch {
    return "unknown";
  }
}

/** Pantau perubahan status izin (mis. pengguna mengubah di setelan situs). Mengembalikan fungsi berhenti. */
export function watchPermission(kind: PermKind, cb: (s: PermState) => void): () => void {
  let dead = false;
  let status: PermissionStatus | null = null;
  const name = API_NAME[kind];
  if (!name || typeof navigator === "undefined" || !(navigator as any).permissions?.query) {
    cb("unknown");
    return () => {};
  }
  const onChange = () => { if (!dead && status) cb(status.state as PermState); };
  (navigator as any).permissions
    .query({ name })
    .then((s: PermissionStatus) => {
      if (dead) return;
      status = s;
      cb(s.state as PermState);
      s.addEventListener?.("change", onChange);
    })
    .catch(() => cb("unknown"));
  return () => {
    dead = true;
    status?.removeEventListener?.("change", onChange);
  };
}

/* ───────────────────────── Klasifikasi galat ───────────────────────── */

function failure(
  kind: PermKind,
  code: PermFailure["code"],
  title: string,
  message: string,
  opts: { howTo?: boolean; retryable?: boolean } = {}
): PermFailure {
  return {
    code,
    title,
    message,
    howTo: opts.howTo ? unblockSteps(kind) : [],
    retryable: opts.retryable ?? true,
  };
}

/**
 * Ubah galat mentah (DOMException / GeolocationPositionError / dll.) menjadi pesan ramah pengguna.
 * @param prior status izin SEBELUM permintaan — membedakan "ditolak permanen" dari "prompt ditutup".
 */
export function describePermissionError(kind: PermKind, err: unknown, prior: PermState = "unknown"): PermFailure {
  const label = PERM_LABEL[kind];
  const e: any = err ?? {};
  const name: string = e.name || "";
  const msg: string = String(e.message || "");

  if (!isSecureEnv()) {
    return failure(kind, "insecure", `Akses ${label} butuh koneksi aman`,
      `Browser hanya mengizinkan ${label} di halaman HTTPS (atau localhost). Buka situs lewat alamat https://gamatopiranti.zone.id.`,
      { retryable: false });
  }

  // Geolocation: GeolocationPositionError { code 1|2|3 }
  if (kind === "geolocation" && typeof e.code === "number" && typeof e.PERMISSION_DENIED === "number") {
    if (e.code === e.PERMISSION_DENIED) {
      return failure(kind, prior === "denied" ? "denied" : "dismissed",
        "Izin lokasi ditolak",
        prior === "denied"
          ? "Akses lokasi diblokir untuk situs ini, jadi browser tidak menampilkan permintaan lagi."
          : "Permintaan izin lokasi ditutup atau ditolak.",
        { howTo: true });
    }
    if (e.code === e.POSITION_UNAVAILABLE) {
      return failure(kind, "unavailable", "Lokasi tidak tersedia",
        "Perangkat belum bisa menentukan posisi. Nyalakan GPS/layanan lokasi di perangkat, lalu coba lagi (lebih baik di dekat jendela atau di luar ruangan).");
    }
    if (e.code === e.TIMEOUT) {
      return failure(kind, "timeout", "Pencarian lokasi kehabisan waktu",
        "Sinyal lokasi terlalu lemah. Coba lagi di tempat dengan sinyal GPS/Wi-Fi lebih baik.");
    }
  }

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    // Kebijakan Permissions-Policy / iframe tanpa izin juga mengirim NotAllowedError.
    if (/permissions? policy|feature policy|disallowed by/i.test(msg)) {
      return failure(kind, "blocked-policy", `Akses ${label} diblokir kebijakan halaman`,
        `Halaman ini tidak diizinkan memakai ${label} (kebijakan keamanan situs atau bingkai tertanam). Buka Gamato Piranti langsung di tab sendiri.`,
        { retryable: false });
    }
    if (kind === "display-capture") {
      return failure(kind, "dismissed", "Tangkap layar dibatalkan",
        "Anda menutup jendela pemilihan layar/tab. Klik tombolnya lagi lalu pilih layar atau tab yang ingin dibagikan.");
    }
    if (prior === "denied") {
      return failure(kind, "denied", `Izin ${label} diblokir`,
        `Akses ${label} sudah ditolak sebelumnya, sehingga browser tidak akan menampilkan permintaan lagi. Aktifkan manual di setelan situs.`,
        { howTo: true });
    }
    return failure(kind, "dismissed", `Izin ${label} belum diberikan`,
      `Pilih \"Izinkan\" pada permintaan browser agar alat ini bisa memakai ${label}. Jika permintaan tidak muncul lagi, aktifkan manual di setelan situs.`,
      { howTo: true });
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
    return failure(kind, "no-device", `${cap(label)} tidak ditemukan`,
      kind === "camera"
        ? "Tidak ada kamera yang terdeteksi. Sambungkan kamera atau coba perangkat lain."
        : kind === "microphone"
        ? "Tidak ada mikrofon yang terdeteksi. Sambungkan mikrofon/headset, lalu coba lagi."
        : `Perangkat ${label} tidak ditemukan.`);
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return failure(kind, name === "AbortError" ? "aborted" : "busy",
      `${cap(label)} sedang dipakai aplikasi lain`,
      `Tutup aplikasi atau tab lain yang sedang memakai ${label} (mis. Zoom, Meet, kamera bawaan), lalu coba lagi.`);
  }
  if (name === "SecurityError") {
    return failure(kind, "blocked-policy", `Akses ${label} diblokir keamanan browser`,
      `Browser menolak akses ${label} karena alasan keamanan. Pastikan situs dibuka lewat HTTPS dan bukan di dalam bingkai (iframe).`,
      { retryable: false });
  }
  if (name === "NotSupportedError" || name === "TypeError" && /not a function|undefined/i.test(msg)) {
    return failure(kind, "unsupported", `Browser tidak mendukung ${label}`,
      "Gunakan Chrome, Edge, Firefox, atau Safari versi terbaru.", { retryable: false });
  }
  return failure(kind, "unknown", `Gagal mengakses ${label}`, msg || "Terjadi kesalahan tak terduga. Coba lagi.");
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ───────────────────────── Media (kamera & mikrofon) ───────────────────────── */

export class PermissionError extends Error {
  failure: PermFailure;
  kind: PermKind;
  constructor(kind: PermKind, failure: PermFailure) {
    super(failure.message);
    this.name = "PermissionError";
    this.failure = failure;
    this.kind = kind;
  }
}

/** Hentikan semua track sebuah stream (aman dipanggil dengan null). */
export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => { try { t.stop(); } catch { /* abaikan */ } });
}

function mediaSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Minta kamera. Mencoba constraint yang diminta dulu; bila ditolak karena constraint
 * (OverconstrainedError/NotFound pada `facingMode`) otomatis mencoba lagi dengan `video: true`
 * — sehingga laptop tanpa kamera belakang tetap bisa memakai kamera depan.
 * Melempar PermissionError (berisi pesan siap tampil).
 */
export async function requestCamera(constraints: MediaTrackConstraints | boolean = true): Promise<MediaStream> {
  if (!isSecureEnv() || !mediaSupported()) {
    throw new PermissionError("camera", describePermissionError("camera", !isSecureEnv() ? null : { name: "NotSupportedError" }));
  }
  const prior = await queryPermission("camera");
  try {
    return await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
  } catch (err: any) {
    if (constraints !== true && (err?.name === "OverconstrainedError" || err?.name === "NotFoundError")) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (err2) {
        throw new PermissionError("camera", describePermissionError("camera", err2, prior));
      }
    }
    throw new PermissionError("camera", describePermissionError("camera", err, prior));
  }
}

/** Minta mikrofon. `audio` boleh `true` atau constraint (mis. `{ deviceId, echoCancellation:false }`). */
export async function requestMicrophone(audio: MediaTrackConstraints | boolean = true): Promise<MediaStream> {
  if (!isSecureEnv() || !mediaSupported()) {
    throw new PermissionError("microphone", describePermissionError("microphone", !isSecureEnv() ? null : { name: "NotSupportedError" }));
  }
  const prior = await queryPermission("microphone");
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video: false });
  } catch (err: any) {
    // deviceId yang tersimpan sudah tidak ada (headset dicabut) → pakai mikrofon bawaan.
    if (typeof audio === "object" && (err?.name === "OverconstrainedError" || err?.name === "NotFoundError")) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err2) {
        throw new PermissionError("microphone", describePermissionError("microphone", err2, prior));
      }
    }
    throw new PermissionError("microphone", describePermissionError("microphone", err, prior));
  }
}

/** Tangkap layar/tab (harus dipanggil langsung dari klik). */
export async function requestDisplay(opts: DisplayMediaStreamOptions = { video: true, audio: false }): Promise<MediaStream> {
  if (!isSecureEnv() || !navigator.mediaDevices?.getDisplayMedia) {
    throw new PermissionError("display-capture", describePermissionError("display-capture", !isSecureEnv() ? null : { name: "NotSupportedError" }));
  }
  try {
    return await navigator.mediaDevices.getDisplayMedia(opts);
  } catch (err) {
    throw new PermissionError("display-capture", describePermissionError("display-capture", err));
  }
}

export type MediaDeviceOption = { deviceId: string; label: string };

/**
 * Daftar perangkat. Label baru terisi SETELAH izin diberikan — panggil ulang sesudah
 * `requestCamera/requestMicrophone` berhasil. Perangkat tanpa label diberi nama bernomor.
 */
export async function listMediaDevices(kind: "videoinput" | "audioinput" | "audiooutput"): Promise<MediaDeviceOption[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    const base = kind === "videoinput" ? "Kamera" : kind === "audioinput" ? "Mikrofon" : "Speaker";
    return all
      .filter((d) => d.kind === kind && d.deviceId !== "")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${base} ${i + 1}` }));
  } catch {
    return [];
  }
}

/** Subscribe perubahan perangkat (colok/cabut headset). Mengembalikan fungsi berhenti. */
export function onDeviceChange(cb: () => void): () => void {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) return () => {};
  navigator.mediaDevices.addEventListener("devicechange", cb);
  return () => navigator.mediaDevices.removeEventListener("devicechange", cb);
}

/* ───────────────────────── Lokasi ───────────────────────── */

export type GeoFix = { lat: number; lng: number; accuracy: number; altitude: number | null; approximate: boolean };

/**
 * Ambil posisi. Mencoba GPS akurat dulu; bila timeout/tidak tersedia, mencoba lagi
 * dengan akurasi rendah (Wi-Fi/seluler) dan menandai hasilnya `approximate`.
 * Melempar PermissionError.
 */
export async function requestPosition(opts: { highAccuracyTimeout?: number; lowAccuracyTimeout?: number } = {}): Promise<GeoFix> {
  if (!isSecureEnv() || typeof navigator === "undefined" || !navigator.geolocation) {
    throw new PermissionError("geolocation", describePermissionError("geolocation", !isSecureEnv() ? null : { name: "NotSupportedError" }));
  }
  const prior = await queryPermission("geolocation");
  const once = (o: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, o));
  const toFix = (p: GeolocationPosition, approximate: boolean): GeoFix => ({
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    accuracy: p.coords.accuracy,
    altitude: p.coords.altitude,
    approximate,
  });
  try {
    return toFix(await once({ enableHighAccuracy: true, timeout: opts.highAccuracyTimeout ?? 12000, maximumAge: 10000 }), false);
  } catch (err: any) {
    const denied = typeof err?.code === "number" && err.code === err.PERMISSION_DENIED;
    if (denied) throw new PermissionError("geolocation", describePermissionError("geolocation", err, prior));
    try {
      return toFix(await once({ enableHighAccuracy: false, timeout: opts.lowAccuracyTimeout ?? 15000, maximumAge: 60000 }), true);
    } catch (err2) {
      throw new PermissionError("geolocation", describePermissionError("geolocation", err2, prior));
    }
  }
}

/* ───────────────────────── Papan klip ───────────────────────── */

/**
 * Salin teks. Memakai Clipboard API bila ada izin, lalu jatuh ke `execCommand("copy")`
 * (berfungsi di HTTP/iframe/Safari lama selama dipanggil dari gestur pengguna).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText && isSecureEnv()) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* lanjut ke fallback */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    const prevFocus = document.activeElement as HTMLElement | null;
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    prevFocus?.focus?.();
    return ok;
  } catch {
    return false;
  }
}

/** Baca teks dari papan klip. Mengembalikan null bila izin tidak diberikan / tidak didukung. */
export async function readClipboardText(): Promise<{ text: string | null; failure?: PermFailure }> {
  if (!navigator.clipboard?.readText || !isSecureEnv()) {
    return { text: null, failure: failure("clipboard-read", "unsupported", "Browser tidak mendukung tempel otomatis",
      "Tempel manual dengan Ctrl+V (⌘+V di Mac) atau tekan-tahan lalu pilih Tempel.", { retryable: false }) };
  }
  const prior = await queryPermission("clipboard-read");
  try {
    return { text: await navigator.clipboard.readText() };
  } catch (err) {
    const f = describePermissionError("clipboard-read", err, prior);
    return { text: null, failure: { ...f, message: `${f.message} Sebagai gantinya tempel manual dengan Ctrl+V (⌘+V di Mac).` } };
  }
}

/** Salin gambar (Blob PNG) ke papan klip. */
export async function copyImageBlob(blob: Blob): Promise<boolean> {
  try {
    const CI = (window as any).ClipboardItem;
    if (!CI || !navigator.clipboard?.write || !isSecureEnv()) return false;
    await navigator.clipboard.write([new CI({ [blob.type || "image/png"]: blob })]);
    return true;
  } catch {
    return false;
  }
}

/* ───────────────────────── Audio output (speaker) ───────────────────────── */

/**
 * Browser menahan AudioContext sampai ada gestur pengguna. Panggil ini dari handler klik
 * (atau sebelum memutar) agar suara dari tombol Putar tidak diam.
 */
export async function ensureAudioRunning(ctx: AudioContext | null | undefined): Promise<boolean> {
  if (!ctx) return false;
  if (ctx.state === "running") return true;
  try {
    await ctx.resume();
  } catch { /* abaikan */ }
  return (ctx.state as AudioContextState) === "running";
}

export function canSelectAudioOutput(): boolean {
  if (typeof HTMLMediaElement === "undefined") return false;
  return typeof (HTMLMediaElement.prototype as any).setSinkId === "function";
}

/**
 * Arahkan sebuah elemen audio/video ke speaker tertentu (Chrome/Edge). Mengembalikan false bila
 * tidak didukung atau izin ditolak — pemanggil tinggal membiarkan output default.
 */
export async function setMediaSink(el: HTMLMediaElement | null, deviceId: string): Promise<boolean> {
  if (!el || !canSelectAudioOutput()) return false;
  try {
    await (el as any).setSinkId(deviceId || "");
    return true;
  } catch {
    return false;
  }
}

/**
 * Minta pengguna memilih speaker (Chrome 110+: dialog bawaan browser yang sekaligus memberi izin).
 * Mengembalikan deviceId terpilih, "" bila dibatalkan, atau null bila tidak didukung.
 */
export async function pickAudioOutput(): Promise<{ deviceId: string; label: string } | null> {
  const md: any = typeof navigator !== "undefined" ? navigator.mediaDevices : null;
  if (!md?.selectAudioOutput) return null;
  try {
    const d = await md.selectAudioOutput();
    return { deviceId: d.deviceId, label: d.label || "Speaker" };
  } catch {
    return { deviceId: "", label: "" };
  }
}

/* ───────────────────────── Wake lock ───────────────────────── */

/** Cegah layar mati selama proses panjang (render video, rekam audio). Mengembalikan fungsi pelepas. */
export async function keepAwake(): Promise<() => void> {
  const wl: any = typeof navigator !== "undefined" ? (navigator as any).wakeLock : null;
  if (!wl?.request) return () => {};
  let sentinel: any = null;
  let released = false;
  const acquire = async () => {
    try { sentinel = await wl.request("screen"); } catch { sentinel = null; }
  };
  const onVis = () => { if (!released && document.visibilityState === "visible") void acquire(); };
  await acquire();
  document.addEventListener("visibilitychange", onVis);
  return () => {
    released = true;
    document.removeEventListener("visibilitychange", onVis);
    try { sentinel?.release?.(); } catch { /* abaikan */ }
  };
}
