import { encodeWav } from "@/lib/wavEncoder";

export const MORSE_MAP: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
  "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
  ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-",
  '"': ".-..-.", "$": "...-..-", "@": ".--.-.",
};

/** Prosign (tanda prosedural) ditulis dalam kurung sudut, mis. <AR>, <SK>, <SOS>. */
export const PROSIGNS: Record<string, string> = {
  AR: ".-.-.", AS: ".-...", BK: "-...-.-", BT: "-...-", CT: "-.-.-", HH: "........", KN: "-.--.", SK: "...-.-", SOS: "...---...", VE: "...-.",
};

/** Kode yang HANYA bermakna sebagai prosign (tidak bentrok dengan tanda baca) → ditampilkan sebagai <NAMA> saat decode. */
const PROSIGN_ONLY: Record<string, string> = { "...---...": "SOS", "...-.-": "SK", "........": "HH", "-...-.-": "BK", "...-.": "VE", "-.-.-": "CT" };

const REVERSE_MORSE_MAP: Record<string, string> = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));

/** Huruf beraksen → huruf dasar (é→E, ñ→N), beberapa ligatur umum, tanda kutip/strip tipografis → padanan ASCII. */
function foldChar(ch: string): string {
  const special: Record<string, string> = { "ß": "SS", "æ": "AE", "Æ": "AE", "ø": "O", "Ø": "O", "œ": "OE", "Œ": "OE", "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..." };
  if (special[ch]) return special[ch];
  return ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export interface MorseEncodeResult { morse: string; /** Karakter unik yang tidak punya padanan Morse dan dilewati. */ skipped: string[] }

/** Teks → Morse, sekaligus melaporkan karakter yang dilewati (tidak lagi dibuang diam-diam). */
export function encodeMorse(text: string): MorseEncodeResult {
  const skipped = new Set<string>();
  const words = text.split(/\s+/).filter(Boolean).map((word) => {
    const codes: string[] = [];
    for (let i = 0; i < word.length; ) {
      const pro = word.slice(i).match(/^<([A-Za-z]{2,3})>/);
      if (pro && PROSIGNS[pro[1].toUpperCase()]) { codes.push(PROSIGNS[pro[1].toUpperCase()]); i += pro[0].length; continue; }
      const cp = String.fromCodePoint(word.codePointAt(i)!);
      i += cp.length;
      for (const ch of foldChar(cp).toUpperCase()) {
        if (MORSE_MAP[ch]) codes.push(MORSE_MAP[ch]);
        else skipped.add(cp);
      }
    }
    return codes.join(" ");
  }).filter(Boolean);
  return { morse: words.join(" / "), skipped: [...skipped] };
}

export interface MorseDecodeResult { text: string; /** Kode yang tidak dikenali (ditulis "?" pada hasil). */ unknown: string[] }

/** Samakan variasi simbol yang lazim di hasil tempel: • · ∙ → titik, — – − _ → strip. */
export function normalizeMorseSymbols(morse: string): string {
  return morse.replace(/[•·∙●・]/g, ".").replace(/[—–−‒―_]/g, "-");
}

/**
 * Morse → teks. Pemisah kata: "/", "|", baris baru, atau 3+ spasi; pemisah huruf: spasi.
 * Kode tak dikenal menjadi "?" dan dilaporkan.
 */
export function decodeMorse(morse: string): MorseDecodeResult {
  const unknown = new Set<string>();
  const text = normalizeMorseSymbols(morse)
    .trim()
    .split(/\s*[\/|]\s*|\r?\n+|\s{3,}/)
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((code) => {
          if (PROSIGN_ONLY[code]) return `<${PROSIGN_ONLY[code]}>`;
          const ch = REVERSE_MORSE_MAP[code];
          if (ch) return ch;
          unknown.add(code);
          return "?";
        })
        .join("")
    )
    .filter((w) => w !== "")
    .join(" ");
  return { text, unknown: [...unknown] };
}

/** Kompatibel dengan versi lama. */
export function textToMorse(text: string): string {
  return encodeMorse(text).morse;
}
export function morseToText(morse: string): string {
  return decodeMorse(morse).text;
}

// ─── Penjadwalan sinyal (dipakai audio WAV, kedip cahaya, dan estimasi durasi) ───
export interface MorseTimingOptions {
  /** Kecepatan karakter (WPM, standar PARIS). */
  wpm: number;
  /** Kecepatan efektif Farnsworth ≤ wpm: jeda antar huruf/kata diregangkan, karakter tetap cepat. Kosong = sama dengan wpm. */
  farnsworth?: number;
}
export interface MorseSegment { on: boolean; duration: number }

export function morseSegments(morse: string, opts: MorseTimingOptions): MorseSegment[] {
  const c = Math.max(1, opts.wpm);
  const s = Math.min(c, Math.max(1, opts.farnsworth ?? c));
  const unit = 1.2 / c;
  const spaceUnit = s >= c ? unit : (60 / s - 37.2 / c) / 19; // regangkan 19 unit spasi per kata "PARIS"
  const segments: MorseSegment[] = [];
  const gap = (units: number, u: number) => segments.push({ on: false, duration: u * units });
  const tone = (units: number) => { segments.push({ on: true, duration: unit * units }); gap(1, unit); };

  const words = normalizeMorseSymbols(morse).trim().split("/").map((w) => w.trim()).filter(Boolean);
  words.forEach((word, wi) => {
    const letters = word.split(/\s+/).filter(Boolean);
    letters.forEach((letter, li) => {
      for (const sym of letter) { if (sym === ".") tone(1); else if (sym === "-") tone(3); }
      if (segments.length && !segments[segments.length - 1].on) segments.pop(); // buang jeda 1-unit terakhir di dalam huruf
      if (li < letters.length - 1) gap(3, spaceUnit);
    });
    if (wi < words.length - 1) gap(7, spaceUnit);
  });
  return segments;
}

export function morseDurationSeconds(morse: string, opts: MorseTimingOptions): number {
  return morseSegments(morse, opts).reduce((sum, seg) => sum + seg.duration, 0);
}

export interface MorseAudioOptions extends MorseTimingOptions {
  freq: number;
  sampleRate?: number;
  /** 0–1, default 0.6 */
  volume?: number;
}

/** Render string Morse ("... --- ... / ...") menjadi WAV yang bisa diputar/diunduh. */
export function morseToWavBlob(morse: string, opts: MorseAudioOptions): Blob {
  const sampleRate = opts.sampleRate || 44100;
  const volume = Math.min(1, Math.max(0.05, opts.volume ?? 0.6));
  const segments = morseSegments(morse, opts);
  if (!segments.length) segments.push({ on: false, duration: 0.3 });

  const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0) + 0.2;
  const totalSamples = Math.max(1, Math.ceil(totalDuration * sampleRate));
  const samples = new Float32Array(totalSamples);

  let sampleIdx = 0;
  for (const seg of segments) {
    const segSamples = Math.round(seg.duration * sampleRate);
    for (let i = 0; i < segSamples && sampleIdx < totalSamples; i++, sampleIdx++) {
      if (seg.on) {
        const t = i / sampleRate;
        const attackRelease = sampleRate * 0.005;
        const envelope = Math.min(1, i / attackRelease) * Math.min(1, (segSamples - i) / attackRelease);
        samples[sampleIdx] = Math.sin(2 * Math.PI * opts.freq * t) * volume * envelope;
      }
    }
  }
  return encodeWav(samples, sampleRate);
}

/** Tabel referensi untuk UI: huruf, angka, tanda baca, prosign. */
export function morseReference(): { group: string; items: [string, string][] }[] {
  const letters = Object.entries(MORSE_MAP).filter(([k]) => /[A-Z]/.test(k));
  const digits = Object.entries(MORSE_MAP).filter(([k]) => /[0-9]/.test(k));
  const punct = Object.entries(MORSE_MAP).filter(([k]) => !/[A-Z0-9]/.test(k));
  return [
    { group: "A–Z", items: letters },
    { group: "0–9", items: digits },
    { group: "Tanda baca", items: punct },
    { group: "Prosign", items: Object.entries(PROSIGNS).map(([k, v]) => [`<${k}>`, v] as [string, string]) },
  ];
}
