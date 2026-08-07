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

const REVERSE_MORSE_MAP: Record<string, string> = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));

export function textToMorse(text: string): string {
  return text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word
        .split("")
        .map((ch) => MORSE_MAP[ch] || "")
        .filter(Boolean)
        .join(" ")
    )
    .filter(Boolean)
    .join(" / ");
}

export function morseToText(morse: string): string {
  return morse
    .trim()
    .split("/")
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((code) => REVERSE_MORSE_MAP[code] || "")
        .join("")
    )
    .join(" ");
}

export interface MorseAudioOptions {
  wpm: number;
  freq: number;
  sampleRate?: number;
}

/** Renders a Morse string ("... --- ... / ..." format) into a downloadable/playable WAV blob. */
export function morseToWavBlob(morse: string, opts: MorseAudioOptions): Blob {
  const sampleRate = opts.sampleRate || 44100;
  const unit = 1.2 / opts.wpm; // seconds per "dit" (standard PARIS timing formula)
  const segments: { on: boolean; duration: number }[] = [];

  const addGap = (units: number) => segments.push({ on: false, duration: unit * units });
  const addTone = (units: number) => {
    segments.push({ on: true, duration: unit * units });
    segments.push({ on: false, duration: unit }); // gap between symbols within a letter
  };

  const words = morse
    .trim()
    .split("/")
    .map((w) => w.trim())
    .filter(Boolean);

  words.forEach((word, wi) => {
    const letters = word.split(/\s+/).filter(Boolean);
    letters.forEach((letter, li) => {
      for (const symbol of letter) {
        if (symbol === ".") addTone(1);
        else if (symbol === "-") addTone(3);
      }
      segments.pop(); // drop the trailing 1-unit intra-letter gap just added
      if (li < letters.length - 1) addGap(3); // inter-letter gap
    });
    if (wi < words.length - 1) addGap(7); // inter-word gap
  });

  if (!segments.length) segments.push({ on: false, duration: 0.3 });

  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0) + 0.2;
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
        samples[sampleIdx] = Math.sin(2 * Math.PI * opts.freq * t) * 0.6 * envelope;
      }
    }
  }

  return encodeWav(samples, sampleRate);
}
