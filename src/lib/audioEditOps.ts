// Operation dispatcher for the audio editor. Keeps the UI thin: the UI only
// collects parameters and calls runOperation(); everything below is pure.

import {
  PCM, pcmFrames, slicePcm, replaceRange, transformRegion, applyGain, normalizePeak, normalizeRms, fadeRegion, reversePcm, invertPcm,
  silenceRegion, removeDc, changeSpeed, timeStretch, pitchShift, applyEq, applyCompressor, applyLimiter, applyNoiseGate, applyEcho, applyReverb,
  removeSilences, toMono, toStereo, swapChannels, panPcm, keepChannel, resamplePcm, repeatRange, insertPcm, makeSilence,
  type FadeCurve,
} from "@/lib/audioEditEngine";

export type OpKind =
  | "gain" | "normalize" | "fadeIn" | "fadeOut" | "silence" | "reverse" | "invert" | "dc"
  | "speed" | "tempo" | "pitch"
  | "eq" | "compress" | "limit" | "echo" | "reverb" | "gate"
  | "removeSilence" | "trimSilence"
  | "mono" | "stereo" | "swap" | "pan" | "keepL" | "keepR"
  | "resample" | "repeat" | "insertSilence";

export interface OpParams {
  gainDb: number;
  normMode: "peak" | "rms";
  normPeakDb: number;
  normRmsDb: number;
  fadeCurve: FadeCurve;
  speed: number;
  tempo: number;
  pitch: number;
  eqBands: number[];
  eqHp: number;
  eqLp: number;
  compThr: number;
  compRatio: number;
  compAtk: number;
  compRel: number;
  compMakeup: number;
  limitCeil: number;
  limitRel: number;
  echoDelay: number;
  echoFb: number;
  echoMix: number;
  echoTail: number;
  revRoom: number;
  revDamp: number;
  revWet: number;
  revPre: number;
  revWidth: number;
  revTail: number;
  extendTail: boolean;
  gateThr: number;
  gateRed: number;
  gateAtk: number;
  gateRel: number;
  silThr: number;
  silMin: number;
  silKeep: number;
  pan: number;
  sampleRate: number;
  repeatTimes: number;
  insertSilenceSec: number;
}

export const DEFAULT_PARAMS: OpParams = {
  gainDb: 3, normMode: "peak", normPeakDb: -1, normRmsDb: -16, fadeCurve: "linear",
  speed: 1.25, tempo: 1.25, pitch: 2,
  eqBands: [0, 0, 0, 0, 0], eqHp: 0, eqLp: 0,
  compThr: -20, compRatio: 3, compAtk: 10, compRel: 150, compMakeup: 3,
  limitCeil: -1, limitRel: 80,
  echoDelay: 350, echoFb: 0.4, echoMix: 0.5, echoTail: 1.5,
  revRoom: 0.6, revDamp: 0.4, revWet: 0.3, revPre: 15, revWidth: 1, revTail: 2, extendTail: true,
  gateThr: -45, gateRed: 50, gateAtk: 3, gateRel: 120,
  silThr: -45, silMin: 500, silKeep: 250,
  pan: 0, sampleRate: 22050, repeatTimes: 1, insertSilenceSec: 1,
};

export interface OpResult {
  pcm: PCM;
  /** New selection (frames) after the op, if it should change. */
  sel?: [number, number];
  label: string;
  /** Positions after which markers must be shifted: [at, delta]. Omitted = unchanged. */
  lengthDelta?: { at: number; end: number; newEnd: number };
}

/** Ops that must always act on the whole file (they change channel layout / rate). */
export const WHOLE_FILE_OPS: OpKind[] = ["mono", "stereo", "swap", "pan", "keepL", "keepR", "resample"];

export const OP_LABELS: Record<OpKind, string> = {
  gain: "Volume", normalize: "Normalisasi", fadeIn: "Fade in", fadeOut: "Fade out", silence: "Bisukan", reverse: "Balik", invert: "Balik fase", dc: "Hapus DC offset",
  speed: "Kecepatan", tempo: "Tempo", pitch: "Pitch", eq: "Equalizer", compress: "Kompresor", limit: "Limiter", echo: "Echo", reverb: "Reverb", gate: "Noise gate",
  removeSilence: "Hapus hening", trimSilence: "Pangkas hening tepi", mono: "Jadikan mono", stereo: "Jadikan stereo", swap: "Tukar kanal L/R", pan: "Pan",
  keepL: "Pakai kanal kiri", keepR: "Pakai kanal kanan", resample: "Ubah sample rate", repeat: "Ulangi seleksi", insertSilence: "Sisipkan hening",
};

export async function runOperation(
  kind: OpKind,
  pcm: PCM,
  s0: number,
  e0: number,
  P: OpParams,
  onProgress: (f: number) => void = () => {},
  preview = false
): Promise<OpResult> {
  const n = pcmFrames(pcm);
  const whole = WHOLE_FILE_OPS.includes(kind);
  let s = whole ? 0 : Math.max(0, Math.min(n, s0));
  let e = whole ? n : Math.max(s, Math.min(n, e0));
  const label = OP_LABELS[kind];
  const sr = pcm.sampleRate;

  // length-preserving region effect with a boundary crossfade
  const same = (fn: (r: PCM) => PCM): OpResult => ({ pcm: transformRegion(pcm, s, e, fn, { crossfade: true }), label });
  // region effect whose result may be longer/shorter → selection follows the new region
  const resize = (out: PCM): OpResult => {
    const next = replaceRange(pcm, s, e, out);
    return { pcm: next, sel: [s, s + pcmFrames(out)], label, lengthDelta: { at: s, end: e, newEnd: s + pcmFrames(out) } };
  };
  // tail-producing effects: extend only when the region reaches the end of the file
  const withTail = (fn: (r: PCM) => PCM, tail: boolean): OpResult => {
    const region = slicePcm(pcm, s, e);
    const out = fn(region);
    const keepLen = pcmFrames(region);
    if (tail && (e >= n || preview)) return resize(out);
    const cut = { sampleRate: out.sampleRate, channels: out.channels.map((c) => c.slice(0, keepLen)) };
    return { pcm: transformRegion(pcm, s, e, () => cut, { crossfade: true }), label };
  };

  switch (kind) {
    case "gain": return same((r) => applyGain(r, P.gainDb));
    case "normalize": return same((r) => (P.normMode === "peak" ? normalizePeak(r, P.normPeakDb) : normalizeRms(r, P.normRmsDb)));
    case "fadeIn": return { pcm: transformRegion(pcm, s, e, (r) => fadeRegion(r, "in", P.fadeCurve)), label };
    case "fadeOut": return { pcm: transformRegion(pcm, s, e, (r) => fadeRegion(r, "out", P.fadeCurve)), label };
    case "silence": return { pcm: transformRegion(pcm, s, e, silenceRegion), label };
    case "reverse": return { pcm: transformRegion(pcm, s, e, reversePcm), label };
    case "invert": return same(invertPcm);
    case "dc": return same(removeDc);
    case "speed": return resize(changeSpeed(slicePcm(pcm, s, e), P.speed));
    case "tempo": return resize(await timeStretch(slicePcm(pcm, s, e), P.tempo, onProgress));
    case "pitch": {
      const out = await pitchShift(slicePcm(pcm, s, e), P.pitch, onProgress);
      return resize(out);
    }
    case "eq": return same((r) => applyEq(r, { bands: P.eqBands, highpassHz: P.eqHp, lowpassHz: P.eqLp }));
    case "compress": return same((r) => applyCompressor(r, { thresholdDb: P.compThr, ratio: P.compRatio, attackMs: P.compAtk, releaseMs: P.compRel, makeupDb: P.compMakeup }));
    case "limit": return same((r) => applyLimiter(r, P.limitCeil, P.limitRel));
    case "gate": return same((r) => applyNoiseGate(r, { thresholdDb: P.gateThr, reductionDb: P.gateRed, attackMs: P.gateAtk, releaseMs: P.gateRel }));
    case "echo": return withTail((r) => applyEcho(r, { delayMs: P.echoDelay, feedback: P.echoFb, mix: P.echoMix, tailSec: P.extendTail ? P.echoTail : 0 }), P.extendTail);
    case "reverb": return withTail((r) => applyReverb(r, { room: P.revRoom, damping: P.revDamp, wet: P.revWet, predelayMs: P.revPre, width: P.revWidth, tailSec: P.extendTail ? P.revTail : 0 }), P.extendTail);
    case "removeSilence": {
      const out = removeSilences(slicePcm(pcm, s, e), P.silThr, P.silMin, P.silKeep, false);
      return resize(out);
    }
    case "trimSilence": {
      const out = removeSilences(slicePcm(pcm, s, e), P.silThr, 50, P.silKeep, true);
      return resize(out);
    }
    case "mono": return { pcm: toMono(pcm), label };
    case "stereo": return { pcm: toStereo(pcm), label };
    case "swap": return { pcm: swapChannels(pcm), label };
    case "pan": return { pcm: panPcm(pcm, P.pan), label };
    case "keepL": return { pcm: keepChannel(pcm, "left"), label };
    case "keepR": return { pcm: keepChannel(pcm, "right"), label };
    case "resample": return { pcm: resamplePcm(pcm, P.sampleRate), label };
    case "repeat": {
      if (e <= s) return { pcm, label };
      const next = repeatRange(pcm, s, e, Math.max(1, Math.round(P.repeatTimes)));
      return { pcm: next, sel: [s, e + (e - s) * Math.max(1, Math.round(P.repeatTimes))], label, lengthDelta: { at: e, end: e, newEnd: e + (e - s) * Math.max(1, Math.round(P.repeatTimes)) } };
    }
    case "insertSilence": {
      const len = Math.round(P.insertSilenceSec * sr);
      const at = s; // caller passes the cursor as s
      const next = insertPcm(pcm, at, makeSilence(sr, pcm.channels.length, len));
      return { pcm: next, sel: [at, at + len], label, lengthDelta: { at, end: at, newEnd: at + len } };
    }
  }
}
