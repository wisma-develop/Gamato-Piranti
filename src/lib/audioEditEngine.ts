// Audio edit engine — pure TypeScript DSP on raw PCM (Float32 per channel).
//
// Everything here is deterministic, dependency-free and does NOT need Web
// Audio (so it can be verified in Node as well as in the browser). Only
// decoding (decodeAudioData) and compressed export live outside this file.
//
// PCM objects are treated as IMMUTABLE: every operation returns a new PCM
// (unchanged channels may be shared by reference), which makes undo/redo a
// simple stack of references.

export interface PCM {
  sampleRate: number;
  channels: Float32Array[];
}

export const pcmFrames = (p: PCM): number => (p.channels[0] ? p.channels[0].length : 0);
export const pcmDuration = (p: PCM): number => pcmFrames(p) / p.sampleRate;
export const pcmBytes = (p: PCM): number => pcmFrames(p) * p.channels.length * 4;

export const dbToGain = (db: number): number => Math.pow(10, db / 20);
export const gainToDb = (g: number): number => (g <= 1e-9 ? -180 : 20 * Math.log10(g));

const clampInt = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v)));

/** Yields to the event loop so long ops keep the UI responsive. */
export const yieldUi = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

export function makeSilence(sampleRate: number, numChannels: number, frames: number): PCM {
  return { sampleRate, channels: Array.from({ length: numChannels }, () => new Float32Array(Math.max(0, frames))) };
}

/* ─────────────────────────── structural edits ─────────────────────────── */

export function slicePcm(p: PCM, s: number, e: number): PCM {
  const n = pcmFrames(p);
  const a = clampInt(s, 0, n);
  const b = clampInt(e, a, n);
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => c.slice(a, b)) };
}

/** Matches channel count of `x` to `n` (mono→stereo duplicate, stereo→mono average, else truncate/dup last). */
export function matchChannels(x: PCM, n: number): PCM {
  const cur = x.channels.length;
  if (cur === n) return x;
  if (n === 1) {
    const len = pcmFrames(x);
    const out = new Float32Array(len);
    for (const c of x.channels) for (let i = 0; i < len; i++) out[i] += c[i] / cur;
    return { sampleRate: x.sampleRate, channels: [out] };
  }
  const channels: Float32Array[] = [];
  for (let k = 0; k < n; k++) channels.push(x.channels[Math.min(k, cur - 1)]);
  return { sampleRate: x.sampleRate, channels };
}

export function concatPcm(parts: PCM[]): PCM {
  const first = parts[0];
  const nCh = first.channels.length;
  const prepared = parts.map((p) => matchChannels(p, nCh));
  const total = prepared.reduce((a, p) => a + pcmFrames(p), 0);
  const channels = Array.from({ length: nCh }, () => new Float32Array(total));
  let off = 0;
  for (const p of prepared) {
    for (let c = 0; c < nCh; c++) channels[c].set(p.channels[c], off);
    off += pcmFrames(p);
  }
  return { sampleRate: first.sampleRate, channels };
}

export function insertPcm(p: PCM, at: number, ins: PCM): PCM {
  const n = pcmFrames(p);
  const pos = clampInt(at, 0, n);
  const prepared = matchChannels(ins, p.channels.length);
  const resampled = prepared.sampleRate === p.sampleRate ? prepared : resamplePcm(prepared, p.sampleRate);
  return concatPcm([slicePcm(p, 0, pos), resampled, slicePcm(p, pos, n)]);
}

export function deleteRange(p: PCM, s: number, e: number): PCM {
  const n = pcmFrames(p);
  const a = clampInt(s, 0, n);
  const b = clampInt(e, a, n);
  if (a === b) return p;
  if (a === 0 && b === n) return makeSilence(p.sampleRate, p.channels.length, 0);
  return concatPcm([slicePcm(p, 0, a), slicePcm(p, b, n)]);
}

export function replaceRange(p: PCM, s: number, e: number, rep: PCM): PCM {
  const n = pcmFrames(p);
  const a = clampInt(s, 0, n);
  const b = clampInt(e, a, n);
  const prepared = matchChannels(rep, p.channels.length);
  const resampled = prepared.sampleRate === p.sampleRate ? prepared : resamplePcm(prepared, p.sampleRate);
  return concatPcm([slicePcm(p, 0, a), resampled, slicePcm(p, b, n)]);
}

export function trimToRange(p: PCM, s: number, e: number): PCM {
  return slicePcm(p, s, e);
}

/** Overlay-mixes `src` (scaled by gain) into `p` starting at `at`; extends length if needed. */
export function mixInto(p: PCM, at: number, src: PCM, gain = 1): PCM {
  const prepared0 = matchChannels(src, p.channels.length);
  const prepared = prepared0.sampleRate === p.sampleRate ? prepared0 : resamplePcm(prepared0, p.sampleRate);
  const start = clampInt(at, 0, pcmFrames(p));
  const total = Math.max(pcmFrames(p), start + pcmFrames(prepared));
  const channels = p.channels.map((c, k) => {
    const out = new Float32Array(total);
    out.set(c);
    const s = prepared.channels[k];
    for (let i = 0; i < s.length; i++) out[start + i] += s[i] * gain;
    return out;
  });
  return { sampleRate: p.sampleRate, channels };
}

export function repeatRange(p: PCM, s: number, e: number, times: number): PCM {
  const n = pcmFrames(p);
  const a = clampInt(s, 0, n);
  const b = clampInt(e, a, n);
  if (b <= a || times < 1) return p;
  const seg = slicePcm(p, a, b);
  const parts: PCM[] = [slicePcm(p, 0, b)];
  for (let i = 0; i < times; i++) parts.push(seg);
  parts.push(slicePcm(p, b, n));
  return concatPcm(parts);
}

/* ─────────────────────────── region helper ─────────────────────────── */

/**
 * Applies `fn` to the region [s,e) of each channel-set and splices the result
 * back. For length-preserving transforms the interior edges get a short
 * crossfade so processing a selection never clicks at its boundaries.
 */
export function transformRegion(p: PCM, s: number, e: number, fn: (region: PCM) => PCM, opts: { crossfade?: boolean } = {}): PCM {
  const n = pcmFrames(p);
  const a = clampInt(s, 0, n);
  const b = clampInt(e, a, n);
  const region = slicePcm(p, a, b);
  const out = fn(region);
  const same = pcmFrames(out) === b - a;
  if (!opts.crossfade || !same || (a === 0 && b === n)) return replaceRange(p, a, b, out);
  const xf = Math.min(Math.round(p.sampleRate * 0.004), Math.floor((b - a) / 3));
  const channels = p.channels.map((c, k) => {
    const o = new Float32Array(n);
    o.set(c);
    const src = out.channels[k];
    for (let i = 0; i < b - a; i++) {
      let w = 1;
      if (a > 0 && i < xf) w = i / xf;
      if (b < n && i >= b - a - xf) w = Math.min(w, (b - a - 1 - i) / xf);
      o[a + i] = c[a + i] * (1 - w) + src[i] * w;
    }
    return o;
  });
  return { sampleRate: p.sampleRate, channels };
}

/* ─────────────────────────── amplitude ops ─────────────────────────── */

export function applyGain(p: PCM, db: number): PCM {
  const g = dbToGain(db);
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => c.map((v) => v * g)) };
}

export function peakOf(p: PCM): number {
  let m = 0;
  for (const c of p.channels) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > m) m = v; }
  return m;
}

export function rmsOf(p: PCM): number {
  let sum = 0;
  let cnt = 0;
  for (const c of p.channels) { for (let i = 0; i < c.length; i++) sum += c[i] * c[i]; cnt += c.length; }
  return cnt ? Math.sqrt(sum / cnt) : 0;
}

export function countClipped(p: PCM): number {
  let n = 0;
  for (const c of p.channels) for (let i = 0; i < c.length; i++) if (Math.abs(c[i]) >= 0.9999) n++;
  return n;
}

export interface AudioStats {
  peakDb: number;
  rmsDb: number;
  clipped: number;
  dcOffset: number;
}

export function analyzePcm(p: PCM): AudioStats {
  let dc = 0;
  let cnt = 0;
  for (const c of p.channels) { for (let i = 0; i < c.length; i++) dc += c[i]; cnt += c.length; }
  return { peakDb: gainToDb(peakOf(p)), rmsDb: gainToDb(rmsOf(p)), clipped: countClipped(p), dcOffset: cnt ? dc / cnt : 0 };
}

export function normalizePeak(p: PCM, targetDb: number): PCM {
  const pk = peakOf(p);
  if (pk < 1e-7) return p;
  return applyGain(p, targetDb - gainToDb(pk));
}

export function normalizeRms(p: PCM, targetRmsDb: number, ceilingDb = -0.1): PCM {
  const r = rmsOf(p);
  if (r < 1e-7) return p;
  let g = targetRmsDb - gainToDb(r);
  const pk = gainToDb(peakOf(p)) + g;
  if (pk > ceilingDb) g -= pk - ceilingDb; // never push into clipping
  return applyGain(p, g);
}

export type FadeCurve = "linear" | "exp" | "log" | "scurve";

function fadeShape(t: number, curve: FadeCurve): number {
  switch (curve) {
    case "exp": return t * t;
    case "log": return Math.sqrt(t);
    case "scurve": return 0.5 - 0.5 * Math.cos(Math.PI * t);
    default: return t;
  }
}

export function fadeRegion(p: PCM, direction: "in" | "out", curve: FadeCurve): PCM {
  const n = pcmFrames(p);
  return {
    sampleRate: p.sampleRate,
    channels: p.channels.map((c) => {
      const o = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const t = n <= 1 ? 1 : i / (n - 1);
        o[i] = c[i] * fadeShape(direction === "in" ? t : 1 - t, curve);
      }
      return o;
    }),
  };
}

export function reversePcm(p: PCM): PCM {
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => Float32Array.from(c).reverse()) };
}

export function invertPcm(p: PCM): PCM {
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => c.map((v) => -v)) };
}

export function silenceRegion(p: PCM): PCM {
  return makeSilence(p.sampleRate, p.channels.length, pcmFrames(p));
}

export function removeDc(p: PCM): PCM {
  return {
    sampleRate: p.sampleRate,
    channels: p.channels.map((c) => {
      let m = 0;
      for (let i = 0; i < c.length; i++) m += c[i];
      m /= Math.max(1, c.length);
      return c.map((v) => v - m);
    }),
  };
}

/* ─────────────────────────── channel ops ─────────────────────────── */

export function toMono(p: PCM): PCM {
  return matchChannels(p, 1);
}

export function toStereo(p: PCM): PCM {
  return p.channels.length >= 2 ? p : matchChannels(p, 2);
}

export function swapChannels(p: PCM): PCM {
  if (p.channels.length < 2) return p;
  return { sampleRate: p.sampleRate, channels: [p.channels[1], p.channels[0], ...p.channels.slice(2)] };
}

/** pan −1 (left) … +1 (right), constant-power; promotes mono to stereo. */
export function panPcm(p: PCM, pan: number): PCM {
  const st = toStereo(p);
  const ang = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  const gl = Math.cos(ang) * Math.SQRT2;
  const gr = Math.sin(ang) * Math.SQRT2;
  return { sampleRate: st.sampleRate, channels: [st.channels[0].map((v) => v * gl), st.channels[1].map((v) => v * gr), ...st.channels.slice(2)] };
}

export function keepChannel(p: PCM, which: "left" | "right"): PCM {
  const c = p.channels[which === "left" ? 0 : Math.min(1, p.channels.length - 1)];
  return { sampleRate: p.sampleRate, channels: [c, c] };
}

/* ─────────────────────────── biquad filters ─────────────────────────── */

export type FilterType = "lowpass" | "highpass" | "bandpass" | "notch" | "lowshelf" | "highshelf" | "peaking";

interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

function biquadCoeffs(type: FilterType, fs: number, f0: number, q: number, gainDb: number): Biquad {
  const f = Math.max(10, Math.min(f0, fs / 2 - 100));
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f) / fs;
  const cosw = Math.cos(w0);
  const sinw = Math.sin(w0);
  const alpha = sinw / (2 * Math.max(0.05, q));
  let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
  switch (type) {
    case "lowpass": b0 = (1 - cosw) / 2; b1 = 1 - cosw; b2 = (1 - cosw) / 2; a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha; break;
    case "highpass": b0 = (1 + cosw) / 2; b1 = -(1 + cosw); b2 = (1 + cosw) / 2; a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha; break;
    case "bandpass": b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha; break;
    case "notch": b0 = 1; b1 = -2 * cosw; b2 = 1; a0 = 1 + alpha; a1 = -2 * cosw; a2 = 1 - alpha; break;
    case "peaking": b0 = 1 + alpha * A; b1 = -2 * cosw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cosw; a2 = 1 - alpha / A; break;
    case "lowshelf": {
      const t = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cosw + t); b1 = 2 * A * ((A - 1) - (A + 1) * cosw); b2 = A * ((A + 1) - (A - 1) * cosw - t);
      a0 = (A + 1) + (A - 1) * cosw + t; a1 = -2 * ((A - 1) + (A + 1) * cosw); a2 = (A + 1) + (A - 1) * cosw - t; break;
    }
    case "highshelf": {
      const t = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cosw + t); b1 = -2 * A * ((A - 1) + (A + 1) * cosw); b2 = A * ((A + 1) + (A - 1) * cosw - t);
      a0 = (A + 1) - (A - 1) * cosw + t; a1 = 2 * ((A - 1) - (A + 1) * cosw); a2 = (A + 1) - (A - 1) * cosw - t; break;
    }
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function runBiquads(input: Float32Array, stages: Biquad[]): Float32Array {
  let cur = input;
  for (const q of stages) {
    const out = new Float32Array(cur.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < cur.length; i++) {
      const x = cur[i];
      const y = q.b0 * x + q.b1 * x1 + q.b2 * x2 - q.a1 * y1 - q.a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      out[i] = y;
    }
    cur = out;
  }
  return cur;
}

export interface FilterSpec { type: FilterType; freq: number; q?: number; gainDb?: number }

export function applyFilters(p: PCM, specs: FilterSpec[]): PCM {
  const stages = specs.map((s) => biquadCoeffs(s.type, p.sampleRate, s.freq, s.q ?? 0.707, s.gainDb ?? 0));
  if (!stages.length) return p;
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => runBiquads(c, stages)) };
}

export interface EqParams {
  bands: number[]; // gain dB for [60, 230, 910, 3600, 14000]
  highpassHz: number; // 0 = off
  lowpassHz: number; // 0 = off
}
export const EQ_FREQS = [60, 230, 910, 3600, 14000];

export function applyEq(p: PCM, eq: EqParams): PCM {
  const specs: FilterSpec[] = [];
  if (eq.highpassHz > 0) specs.push({ type: "highpass", freq: eq.highpassHz, q: 0.707 });
  if (eq.lowpassHz > 0) specs.push({ type: "lowpass", freq: eq.lowpassHz, q: 0.707 });
  eq.bands.forEach((g, i) => {
    if (Math.abs(g) < 0.05) return;
    specs.push({ type: i === 0 ? "lowshelf" : i === EQ_FREQS.length - 1 ? "highshelf" : "peaking", freq: EQ_FREQS[i], q: 1.0, gainDb: g });
  });
  return applyFilters(p, specs);
}

/* ─────────────────────────── dynamics ─────────────────────────── */

export interface CompressorParams { thresholdDb: number; ratio: number; attackMs: number; releaseMs: number; makeupDb: number }

export function applyCompressor(p: PCM, c: CompressorParams): PCM {
  const n = pcmFrames(p);
  const sr = p.sampleRate;
  const atk = Math.exp(-1 / (Math.max(0.1, c.attackMs) * 0.001 * sr));
  const rel = Math.exp(-1 / (Math.max(1, c.releaseMs) * 0.001 * sr));
  const makeup = dbToGain(c.makeupDb);
  const slope = 1 - 1 / Math.max(1, c.ratio);
  const gains = new Float32Array(n);
  let env = -120;
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const ch of p.channels) { const v = Math.abs(ch[i]); if (v > m) m = v; }
    const lvl = gainToDb(m);
    env = lvl > env ? atk * env + (1 - atk) * lvl : rel * env + (1 - rel) * lvl;
    const over = env - c.thresholdDb;
    gains[i] = over > 0 ? dbToGain(-over * slope) * makeup : makeup;
  }
  return { sampleRate: sr, channels: p.channels.map((ch) => ch.map((v, i) => v * gains[i])) };
}

/** Look-ahead peak limiter: output never exceeds the ceiling (within float error). */
export function applyLimiter(p: PCM, ceilingDb: number, releaseMs = 80, lookaheadMs = 5): PCM {
  const n = pcmFrames(p);
  const sr = p.sampleRate;
  const ceil = dbToGain(ceilingDb);
  const L = Math.max(1, Math.round((lookaheadMs / 1000) * sr));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const ch of p.channels) { const v = Math.abs(ch[i]); if (v > m) m = v; }
    need[i] = m > ceil ? ceil / m : 1;
  }
  // sliding minimum over [i-L, i+L] (so the reduction ramps in before the peak and out after)
  const minGain = new Float32Array(n);
  const dq: number[] = [];
  let head = 0;
  let nextAdd = 0;
  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + L);
    while (nextAdd <= hi) {
      while (dq.length > head && need[dq[dq.length - 1]] >= need[nextAdd]) dq.pop();
      dq.push(nextAdd++);
    }
    while (dq[head] < i - L) head++;
    minGain[i] = need[dq[head]];
  }
  // Moving average of the sliding-minimum: every sample inside the window of a peak has
  // minGain <= need[peak], so the average (and therefore the output) never exceeds the ceiling.
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + minGain[i];
  const smooth = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - L);
    const hi = Math.min(n - 1, i + L);
    smooth[i] = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
  }
  // Release: after a reduction, recover toward unity slowly — never above `smooth`.
  const rel = Math.exp(-1 / (Math.max(1, releaseMs) * 0.001 * sr));
  const outGain = new Float32Array(n);
  let g = 1;
  for (let i = 0; i < n; i++) {
    g = Math.min(smooth[i], rel * g + (1 - rel));
    outGain[i] = g;
  }
  return { sampleRate: sr, channels: p.channels.map((ch) => ch.map((v, i) => v * outGain[i])) };
}

export interface GateParams { thresholdDb: number; reductionDb: number; attackMs: number; releaseMs: number }

export function applyNoiseGate(p: PCM, g: GateParams): PCM {
  const n = pcmFrames(p);
  const sr = p.sampleRate;
  const thr = dbToGain(g.thresholdDb);
  const floor = dbToGain(-Math.abs(g.reductionDb));
  const atk = Math.exp(-1 / (Math.max(0.1, g.attackMs) * 0.001 * sr));
  const rel = Math.exp(-1 / (Math.max(1, g.releaseMs) * 0.001 * sr));
  const hold = Math.round(0.02 * sr);
  let env = 0;
  let gain = floor;
  let holdLeft = 0;
  const gains = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const ch of p.channels) { const v = Math.abs(ch[i]); if (v > m) m = v; }
    env = m > env ? m : env * 0.9995 + m * 0.0005;
    if (env > thr) holdLeft = hold;
    else if (holdLeft > 0) holdLeft--;
    const target = env > thr || holdLeft > 0 ? 1 : floor;
    gain = target > gain ? atk * gain + (1 - atk) * target : rel * gain + (1 - rel) * target;
    gains[i] = gain;
  }
  return { sampleRate: sr, channels: p.channels.map((ch) => ch.map((v, i) => v * gains[i])) };
}

/* ─────────────────────────── time-based effects ─────────────────────────── */

export interface EchoParams { delayMs: number; feedback: number; mix: number; tailSec: number }

export function applyEcho(p: PCM, e: EchoParams): PCM {
  const n = pcmFrames(p);
  const d = Math.max(1, Math.round((e.delayMs / 1000) * p.sampleRate));
  const total = n + Math.round(e.tailSec * p.sampleRate);
  const fb = Math.max(0, Math.min(0.95, e.feedback));
  return {
    sampleRate: p.sampleRate,
    channels: p.channels.map((ch) => {
      const out = new Float32Array(total);
      const wet = new Float32Array(total);
      for (let i = 0; i < total; i++) {
        const dry = i < n ? ch[i] : 0;
        const delayed = i >= d ? wet[i - d] : 0;
        wet[i] = dry + delayed * fb;
        out[i] = dry * (1 - e.mix * 0.5) + (i >= d ? wet[i - d] : 0) * e.mix;
      }
      return out;
    }),
  };
}

export interface ReverbParams { room: number; damping: number; wet: number; predelayMs: number; width: number; tailSec: number }

const COMB_TUNING = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASS_TUNING = [556, 441, 341, 225];

function reverbChannel(input: Float32Array, total: number, sr: number, room: number, damping: number, spread: number, predelay: number): Float32Array {
  const scale = sr / 44100;
  const feedback = 0.7 + Math.max(0, Math.min(1, room)) * 0.28;
  const damp = Math.max(0, Math.min(1, damping)) * 0.4;
  const combs = COMB_TUNING.map((t) => ({ buf: new Float32Array(Math.max(8, Math.round((t + spread) * scale))), idx: 0, store: 0 }));
  const aps = ALLPASS_TUNING.map((t) => ({ buf: new Float32Array(Math.max(8, Math.round((t + spread) * scale))), idx: 0 }));
  const out = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const x = (i - predelay >= 0 && i - predelay < input.length ? input[i - predelay] : 0) * 0.015;
    let sum = 0;
    for (const c of combs) {
      const y = c.buf[c.idx];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.idx] = x + c.store * feedback;
      if (++c.idx >= c.buf.length) c.idx = 0;
      sum += y;
    }
    for (const a of aps) {
      const bufOut = a.buf[a.idx];
      const y = -sum + bufOut;
      a.buf[a.idx] = sum + bufOut * 0.5;
      if (++a.idx >= a.buf.length) a.idx = 0;
      sum = y;
    }
    out[i] = sum;
  }
  return out;
}

export function applyReverb(p: PCM, r: ReverbParams): PCM {
  const n = pcmFrames(p);
  const total = n + Math.round(r.tailSec * p.sampleRate);
  const pre = Math.round((r.predelayMs / 1000) * p.sampleRate);
  const wetGain = r.wet;
  const dryGain = 1 - r.wet * 0.5;
  const wets = p.channels.map((ch, k) => reverbChannel(ch, total, p.sampleRate, r.room, r.damping, k % 2 === 1 ? 23 : 0, pre));
  // stereo width: blend each wet channel with the other
  const w = Math.max(0, Math.min(1, r.width));
  const mixed = wets.length >= 2 ? wets.map((c, k) => c.map((v, i) => v * (0.5 + 0.5 * w) + wets[1 - (k % 2)][i] * (0.5 - 0.5 * w))) : wets;
  return {
    sampleRate: p.sampleRate,
    channels: p.channels.map((ch, k) => {
      const o = new Float32Array(total);
      for (let i = 0; i < total; i++) o[i] = (i < n ? ch[i] * dryGain : 0) + mixed[k][i] * wetGain * 3;
      return o;
    }),
  };
}

/* ─────────────────────────── resampling / speed / pitch ─────────────────────────── */

function cubic(y0: number, y1: number, y2: number, y3: number, t: number): number {
  const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
  const b = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c = -0.5 * y0 + 0.5 * y2;
  return ((a * t + b) * t + c) * t + y1;
}

/** Reads `ratio` input frames per output frame (ratio>1 = shorter/faster/higher). */
function resampleChannel(src: Float32Array, ratio: number, sampleRate: number): Float32Array {
  let input = src;
  if (ratio > 1.001) {
    const fc = (0.45 * sampleRate) / ratio;
    const q = biquadCoeffs("lowpass", sampleRate, fc, 0.707, 0);
    input = runBiquads(runBiquads(src, [q]), [q]);
  }
  const outLen = Math.max(0, Math.floor((input.length - 1) / ratio) + 1);
  const out = new Float32Array(outLen);
  const last = input.length - 1;
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i1 = Math.floor(pos);
    const t = pos - i1;
    const i0 = i1 > 0 ? i1 - 1 : 0;
    const i2 = Math.min(last, i1 + 1);
    const i3 = Math.min(last, i1 + 2);
    out[i] = cubic(input[i0], input[Math.min(last, i1)], input[i2], input[i3], t);
  }
  return out;
}

/** Real sample-rate conversion: duration is preserved, `sampleRate` changes. */
export function resamplePcm(p: PCM, newRate: number): PCM {
  if (Math.round(newRate) === p.sampleRate) return p;
  const ratio = p.sampleRate / newRate;
  return { sampleRate: Math.round(newRate), channels: p.channels.map((c) => resampleChannel(c, ratio, p.sampleRate)) };
}

/** Plays `factor`× faster by resampling (pitch changes with speed, like tape). */
export function changeSpeed(p: PCM, factor: number): PCM {
  const f = Math.max(0.1, Math.min(10, factor));
  return { sampleRate: p.sampleRate, channels: p.channels.map((c) => resampleChannel(c, f, p.sampleRate)) };
}

/** WSOLA time-stretch (pitch preserved). rate>1 = faster/shorter. */
export async function timeStretch(p: PCM, rate: number, onProgress?: (f: number) => void): Promise<PCM> {
  const r = Math.max(0.25, Math.min(4, rate));
  if (Math.abs(r - 1) < 1e-3) return p;
  const sr = p.sampleRate;
  const inLen = pcmFrames(p);
  let N = 1;
  while (N < sr * 0.04) N <<= 1; // ≈ 40 ms, power of two
  const hopS = N >> 1;
  const hopA = hopS * r;
  const tol = Math.round(sr * 0.012);
  const outLen = Math.max(1, Math.round(inLen / r));
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);

  const ref = new Float32Array(inLen);
  for (const c of p.channels) for (let i = 0; i < inLen; i++) ref[i] += c[i] / p.channels.length;

  const outs = p.channels.map(() => new Float32Array(outLen + N * 2));
  let prevPos = 0;
  let lastYield = performance.now();
  const frames = Math.ceil(outLen / hopS) + 1;
  const DEC = 8;

  const score = (cand: number, tmplStart: number, step: number): number => {
    let dot = 0;
    let en = 1e-9;
    for (let i = 0; i < N; i += step) {
      const a = cand + i;
      const b = tmplStart + i;
      const x = a >= 0 && a < inLen ? ref[a] : 0;
      const y = b >= 0 && b < inLen ? ref[b] : 0;
      dot += x * y;
      en += x * x;
    }
    return dot / Math.sqrt(en);
  };

  for (let k = 0; k < frames; k++) {
    const outPos = k * hopS;
    if (outPos >= outLen) break;
    let pos = Math.round(k * hopA);
    if (k > 0) {
      const tmpl = prevPos + hopS;
      let best = pos;
      let bestScore = -Infinity;
      for (let d = -tol; d <= tol; d += 4) {
        const s = score(pos + d, tmpl, DEC);
        if (s > bestScore) { bestScore = s; best = pos + d; }
      }
      let fine = best;
      let fineScore = -Infinity;
      for (let d = -4; d <= 4; d++) {
        const s = score(best + d, tmpl, 2);
        if (s > fineScore) { fineScore = s; fine = best + d; }
      }
      pos = fine;
    }
    prevPos = pos;
    for (let c = 0; c < p.channels.length; c++) {
      const src = p.channels[c];
      const dst = outs[c];
      for (let i = 0; i < N; i++) {
        const si = pos + i;
        if (si < 0 || si >= inLen) continue;
        let w = win[i];
        if (k === 0 && i < hopS) w = 1; // keep the very first samples at full level
        dst[outPos + i] += src[si] * w;
      }
    }
    if (performance.now() - lastYield > 40) {
      onProgress?.(k / frames);
      await yieldUi();
      lastYield = performance.now();
    }
  }
  onProgress?.(1);
  return { sampleRate: sr, channels: outs.map((o) => o.slice(0, outLen)) };
}

export async function pitchShift(p: PCM, semitones: number, onProgress?: (f: number) => void): Promise<PCM> {
  const ratio = Math.pow(2, semitones / 12);
  if (Math.abs(ratio - 1) < 1e-4) return p;
  const resampled = changeSpeed(p, ratio); // pitch ×ratio, duration ÷ratio
  return timeStretch(resampled, 1 / ratio, onProgress); // restore the original duration
}

/* ─────────────────────────── silence handling ─────────────────────────── */

export interface Span { start: number; end: number }

/** Finds silent runs (frames) longer than `minMs` below `thresholdDb`. */
export function findSilences(p: PCM, thresholdDb: number, minMs: number): Span[] {
  const n = pcmFrames(p);
  const win = Math.max(1, Math.round(p.sampleRate * 0.01));
  const thr = dbToGain(thresholdDb);
  const spans: Span[] = [];
  let runStart = -1;
  for (let i = 0; i < n; i += win) {
    const end = Math.min(n, i + win);
    let peak = 0;
    for (const c of p.channels) for (let j = i; j < end; j++) { const v = Math.abs(c[j]); if (v > peak) peak = v; }
    if (peak < thr) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      if (((i - runStart) / p.sampleRate) * 1000 >= minMs) spans.push({ start: runStart, end: i });
      runStart = -1;
    }
  }
  if (runStart >= 0 && ((n - runStart) / p.sampleRate) * 1000 >= minMs) spans.push({ start: runStart, end: n });
  return spans;
}

/** Shortens every long silence to `keepMs` (joins are tiny-crossfaded); `edgesOnly` trims just the ends. */
export function removeSilences(p: PCM, thresholdDb: number, minMs: number, keepMs: number, edgesOnly: boolean): PCM {
  const n = pcmFrames(p);
  const spans = findSilences(p, thresholdDb, minMs);
  if (!spans.length) return p;
  const keep = Math.round((keepMs / 1000) * p.sampleRate);
  const parts: PCM[] = [];
  let cursor = 0;
  for (const sp of spans) {
    const atStart = sp.start === 0;
    const atEnd = sp.end >= n;
    if (edgesOnly && !atStart && !atEnd) continue;
    const silenceLen = sp.end - sp.start;
    if (silenceLen <= keep) continue;
    // keep a bit of the silence on the side(s) that touch audio
    let cutStart: number;
    let cutEnd: number;
    if (atStart) { cutStart = sp.start; cutEnd = sp.end - keep; }
    else if (atEnd) { cutStart = sp.start + keep; cutEnd = sp.end; }
    else { cutStart = sp.start + Math.floor(keep / 2); cutEnd = sp.end - Math.ceil(keep / 2); }
    if (cutEnd <= cutStart) continue;
    parts.push(slicePcm(p, cursor, cutStart));
    cursor = cutEnd;
  }
  parts.push(slicePcm(p, cursor, n));
  const joined = concatPcm(parts.filter((x) => pcmFrames(x) > 0));
  return pcmFrames(joined) === 0 ? makeSilence(p.sampleRate, p.channels.length, 0) : joined;
}

/* ─────────────────────────── peaks (waveform) ─────────────────────────── */

export interface PeakLevel { block: number; min: Float32Array[]; max: Float32Array[] }
export interface PeakPyramid { frames: number; levels: PeakLevel[] }
export const PEAK_BASE = 256;

export function buildPeaks(p: PCM): PeakPyramid {
  const n = pcmFrames(p);
  const nCh = p.channels.length;
  const nb = Math.ceil(n / PEAK_BASE);
  const base: PeakLevel = { block: PEAK_BASE, min: [], max: [] };
  for (let c = 0; c < nCh; c++) {
    const mn = new Float32Array(nb);
    const mx = new Float32Array(nb);
    const src = p.channels[c];
    for (let b = 0; b < nb; b++) {
      let lo = 1, hi = -1;
      const end = Math.min(n, (b + 1) * PEAK_BASE);
      for (let i = b * PEAK_BASE; i < end; i++) { const v = src[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
      mn[b] = lo > hi ? 0 : lo;
      mx[b] = hi < lo ? 0 : hi;
    }
    base.min.push(mn);
    base.max.push(mx);
  }
  const levels = [base];
  while (levels[levels.length - 1].min[0].length > 64) {
    const prev = levels[levels.length - 1];
    const len = Math.ceil(prev.min[0].length / 2);
    const lvl: PeakLevel = { block: prev.block * 2, min: [], max: [] };
    for (let c = 0; c < nCh; c++) {
      const mn = new Float32Array(len);
      const mx = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const a = i * 2;
        const b = Math.min(prev.min[c].length - 1, a + 1);
        mn[i] = Math.min(prev.min[c][a], prev.min[c][b]);
        mx[i] = Math.max(prev.max[c][a], prev.max[c][b]);
      }
      lvl.min.push(mn);
      lvl.max.push(mx);
    }
    levels.push(lvl);
  }
  return { frames: n, levels };
}

/** Min/max per output pixel for frames [start, start+span). */
export function getPeaks(p: PCM, pyr: PeakPyramid, start: number, span: number, pixels: number): { min: Float32Array[]; max: Float32Array[] } {
  const nCh = p.channels.length;
  const fpp = span / pixels;
  const min = Array.from({ length: nCh }, () => new Float32Array(pixels));
  const max = Array.from({ length: nCh }, () => new Float32Array(pixels));
  if (fpp <= PEAK_BASE) {
    for (let c = 0; c < nCh; c++) {
      const src = p.channels[c];
      for (let x = 0; x < pixels; x++) {
        const a = Math.floor(start + x * fpp);
        const b = Math.max(a + 1, Math.floor(start + (x + 1) * fpp));
        let lo = 1, hi = -1;
        for (let i = Math.max(0, a); i < Math.min(src.length, b); i++) { const v = src[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
        if (lo <= hi) { min[c][x] = lo; max[c][x] = hi; }
      }
    }
    return { min, max };
  }
  let lvl = pyr.levels[0];
  for (const l of pyr.levels) if (l.block <= fpp) lvl = l;
  for (let c = 0; c < nCh; c++) {
    for (let x = 0; x < pixels; x++) {
      const a = Math.floor((start + x * fpp) / lvl.block);
      const b = Math.max(a + 1, Math.ceil((start + (x + 1) * fpp) / lvl.block));
      let lo = 1, hi = -1;
      for (let i = Math.max(0, a); i < Math.min(lvl.min[c].length, b); i++) {
        if (lvl.min[c][i] < lo) lo = lvl.min[c][i];
        if (lvl.max[c][i] > hi) hi = lvl.max[c][i];
      }
      if (lo <= hi) { min[c][x] = lo; max[c][x] = hi; }
    }
  }
  return { min, max };
}

/* ─────────────────────────── WAV encoder ─────────────────────────── */

export type WavDepth = 16 | 24 | 32;

/** Hand-written RIFF/WAVE writer: 16/24-bit PCM (TPDF dither optional) or 32-bit float. */
export function encodeWavPcm(p: PCM, depth: WavDepth, dither = true): Blob {
  const nCh = p.channels.length;
  const n = pcmFrames(p);
  const bytesPer = depth / 8;
  const dataSize = n * nCh * bytesPer;
  const isFloat = depth === 32;
  const headerSize = isFloat ? 56 : 44; // float adds a 'fact' chunk
  const buf = new ArrayBuffer(headerSize + dataSize);
  const v = new DataView(buf);
  const wr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, "RIFF");
  v.setUint32(4, headerSize - 8 + dataSize, true);
  wr(8, "WAVE");
  wr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, isFloat ? 3 : 1, true);
  v.setUint16(22, nCh, true);
  v.setUint32(24, p.sampleRate, true);
  v.setUint32(28, p.sampleRate * nCh * bytesPer, true);
  v.setUint16(32, nCh * bytesPer, true);
  v.setUint16(34, depth, true);
  let o = 36;
  if (isFloat) {
    wr(o, "fact"); v.setUint32(o + 4, 4, true); v.setUint32(o + 8, n, true); o += 12;
  }
  wr(o, "data");
  v.setUint32(o + 4, dataSize, true);
  o += 8;
  const scale16 = 32767;
  const scale24 = 8388607;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nCh; c++) {
      let x = p.channels[c][i];
      if (isFloat) { v.setFloat32(o, x, true); o += 4; continue; }
      x = Math.max(-1, Math.min(1, x));
      if (depth === 16) {
        const d = dither ? (Math.random() - Math.random()) / 32768 : 0;
        const s = Math.max(-32768, Math.min(32767, Math.round((x + d) * scale16)));
        v.setInt16(o, s, true); o += 2;
      } else {
        const d = dither ? (Math.random() - Math.random()) / 8388608 : 0;
        const s = Math.max(-8388608, Math.min(8388607, Math.round((x + d) * scale24)));
        v.setUint8(o, s & 0xff); v.setUint8(o + 1, (s >> 8) & 0xff); v.setUint8(o + 2, (s >> 16) & 0xff); o += 3;
      }
    }
  }
  return new Blob([buf], { type: "audio/wav" });
}

/** Reads the sample rate of a WAV header, or null for other formats. */
export function peekWavSampleRate(buf: ArrayBuffer): number | null {
  if (buf.byteLength < 28) return null;
  const v = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let o = 12;
  while (o + 8 <= buf.byteLength) {
    const id = tag(o);
    const size = v.getUint32(o + 4, true);
    if (id === "fmt ") return v.getUint32(o + 12, true);
    o += 8 + size + (size & 1);
  }
  return null;
}

/* ─────────────────────────── time formatting ─────────────────────────── */

export function formatClock(sec: number, withMs = true): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const sStr = withMs ? s.toFixed(3).padStart(6, "0") : String(Math.floor(s)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sStr}` : `${String(m).padStart(2, "0")}:${sStr}`;
}

/** Parses "1:23.5", "83.5", "00:01:23.500" → seconds, or null. */
export function parseClock(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length > 3 || parts.some((x) => x === "" || isNaN(Number(x)))) return null;
  let sec = 0;
  for (const x of parts) sec = sec * 60 + Number(x);
  return sec >= 0 ? sec : null;
}
