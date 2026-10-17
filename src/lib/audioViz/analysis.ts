// Mesin analisis spektrum Audio Visualizer — FFT radix-2 murni TypeScript.
// Dipakai identik oleh pratinjau (real-time) dan ekspor offline (frame demi frame),
// sehingga hasil .mov persis sama dengan yang terlihat di layar.

import type { VizConfig } from "./config";

// ── FFT ──────────────────────────────────────────────────────────────────

const fftCache = new Map<number, { cos: Float32Array; sin: Float32Array; rev: Uint32Array; win: Float32Array }>();

function plan(n: number) {
  let p = fftCache.get(n);
  if (p) return p;
  const cos = new Float32Array(n / 2);
  const sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = -Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  const win = new Float32Array(n);
  for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); // Hann
  p = { cos, sin, rev, win };
  fftCache.set(n, p);
  return p;
}

/** Magnitudo spektrum ternormalisasi: sinus skala penuh → 1.0. Panjang keluaran n/2. */
export function magnitudeSpectrum(samples: Float32Array, n: number, out?: Float32Array): Float32Array {
  const { cos, sin, rev, win } = plan(n);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) re[rev[i]] = (samples[i] || 0) * win[i];
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = i + j;
        const b = a + half;
        const tr = re[b] * cos[k] - im[b] * sin[k];
        const ti = re[b] * sin[k] + im[b] * cos[k];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  const m = out && out.length === n / 2 ? out : new Float32Array(n / 2);
  const norm = 4 / n; // sinus amplitudo A dengan jendela Hann → |X| = A·n/4
  for (let i = 0; i < n / 2; i++) m[i] = Math.hypot(re[i], im[i]) * norm;
  return m;
}

// ── Sumber audio ─────────────────────────────────────────────────────────

export interface AudioWindows {
  mono: Float32Array; // panjang fftSize
  left: Float32Array; // panjang WAVE_LEN
  right: Float32Array;
}

export const WAVE_LEN = 1024;

export interface FeedSource {
  sampleRate: number;
  getWindows(timeSec: number, fftSize: number): AudioWindows;
}

/** Sumber dari audio yang sudah di-decode (file) — akses acak berdasarkan waktu. */
export class BufferSource implements FeedSource {
  readonly sampleRate: number;
  readonly duration: number;
  private ch: Float32Array[];
  constructor(channels: Float32Array[], sampleRate: number) {
    this.ch = channels.length ? channels : [new Float32Array(0)];
    this.sampleRate = sampleRate;
    this.duration = this.ch[0].length / sampleRate;
  }
  get channels() {
    return this.ch;
  }
  getWindows(t: number, fftSize: number): AudioWindows {
    const c = Math.round(t * this.sampleRate);
    const L = this.ch[0];
    const R = this.ch[1] ?? this.ch[0];
    const mono = new Float32Array(fftSize);
    const start = c - (fftSize >> 1);
    const k = this.ch.length;
    for (let i = 0; i < fftSize; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= L.length) continue;
      mono[i] = k > 1 ? (L[idx] + R[idx]) * 0.5 : L[idx];
    }
    const left = new Float32Array(WAVE_LEN);
    const right = new Float32Array(WAVE_LEN);
    const ws = c - (WAVE_LEN >> 1);
    for (let i = 0; i < WAVE_LEN; i++) {
      const idx = ws + i;
      if (idx < 0 || idx >= L.length) continue;
      left[i] = L[idx];
      right[i] = R[idx];
    }
    return { mono, left, right };
  }
}

/** Sumber mikrofon langsung (hanya pratinjau). */
export class AnalyserSource implements FeedSource {
  readonly sampleRate: number;
  private an: AnalyserNode;
  private buf: Float32Array<ArrayBuffer>;
  constructor(an: AnalyserNode, sampleRate: number) {
    this.an = an;
    this.sampleRate = sampleRate;
    this.buf = new Float32Array(an.fftSize);
  }
  getWindows(_t: number, fftSize: number): AudioWindows {
    this.an.getFloatTimeDomainData(this.buf);
    const total = this.buf.length;
    const mono = new Float32Array(fftSize);
    const off = total - fftSize;
    for (let i = 0; i < fftSize; i++) mono[i] = this.buf[off + i] ?? 0;
    const left = new Float32Array(WAVE_LEN);
    const o2 = total - WAVE_LEN;
    for (let i = 0; i < WAVE_LEN; i++) left[i] = this.buf[o2 + i] ?? 0;
    return { mono, left, right: left };
  }
}

// ── Analyzer ─────────────────────────────────────────────────────────────

export interface VizFrame {
  bars: Float32Array; // 0..1 (sudah dihaluskan)
  peaks: Float32Array;
  wave: Float32Array; // mono, -1..1 (sudah diberi gain)
  waveL: Float32Array;
  waveR: Float32Array;
  level: number; // 0..1
  bass: number; // 0..1
}

type AnalysisCfg = Pick<VizConfig, "fftSize" | "bars" | "freqMin" | "freqMax" | "freqScale" | "gainDb" | "floorDb" | "tilt" | "attack" | "release" | "spatialSmooth" | "peakFall">;

export function bandEdges(cfg: Pick<VizConfig, "bars" | "freqMin" | "freqMax" | "freqScale">, nyquist: number): Float64Array {
  const n = cfg.bars;
  const fmin = Math.min(cfg.freqMin, nyquist * 0.9);
  const fmax = Math.min(cfg.freqMax, nyquist);
  const e = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (cfg.freqScale === "log") e[i] = fmin * Math.pow(fmax / fmin, t);
    else if (cfg.freqScale === "sqrt") {
      const a = Math.sqrt(fmin), b = Math.sqrt(fmax);
      e[i] = Math.pow(a + (b - a) * t, 2);
    } else e[i] = fmin + (fmax - fmin) * t;
  }
  return e;
}

export class VizAnalyzer {
  private cfg: AnalysisCfg;
  private sr: number;
  private edges: Float64Array;
  private smooth: Float32Array;
  private peak: Float32Array;
  private tmp: Float32Array;
  private lvl = 0;
  private bassEnv = 0;
  private mag: Float32Array | null = null;
  private first = true;

  constructor(cfg: AnalysisCfg, sampleRate: number) {
    this.cfg = cfg;
    this.sr = sampleRate;
    this.edges = bandEdges(cfg, sampleRate / 2);
    this.smooth = new Float32Array(cfg.bars);
    this.peak = new Float32Array(cfg.bars);
    this.tmp = new Float32Array(cfg.bars);
  }

  reset() {
    this.smooth.fill(0);
    this.peak.fill(0);
    this.lvl = 0;
    this.bassEnv = 0;
    this.first = true;
  }

  private dbToUnit(db: number): number {
    const { floorDb } = this.cfg;
    const v = (db - floorDb) / (0 - floorDb);
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  /** dt dalam detik. `snap` = lompat langsung ke target (dipakai saat jeda / seek). */
  analyze(w: AudioWindows, dt: number, snap = false): VizFrame {
    const c = this.cfg;
    const n = c.fftSize;
    const mag = (this.mag = magnitudeSpectrum(w.mono, n, this.mag ?? undefined));
    const binHz = this.sr / n;
    const bars = c.bars;
    const target = this.tmp;
    for (let i = 0; i < bars; i++) {
      const f0 = this.edges[i];
      const f1 = this.edges[i + 1];
      const lo = f0 / binHz;
      const hi = f1 / binHz;
      let m = 0;
      if (hi - lo < 1) {
        const x = (lo + hi) / 2;
        const i0 = Math.floor(x);
        const fr = x - i0;
        m = (mag[i0] ?? 0) * (1 - fr) + (mag[i0 + 1] ?? 0) * fr;
      } else {
        const a = Math.ceil(lo), b = Math.min(n / 2 - 1, Math.floor(hi));
        for (let k = a; k <= b; k++) if (mag[k] > m) m = mag[k];
      }
      const fc = Math.sqrt(f0 * f1);
      const db = 20 * Math.log10(m + 1e-9) + c.gainDb + c.tilt * Math.log2(Math.max(20, fc) / 250);
      target[i] = this.dbToUnit(db);
    }
    // haluskan antar tetangga
    for (let p = 0; p < c.spatialSmooth; p++) {
      let prev = target[0];
      for (let i = 0; i < bars; i++) {
        const cur = target[i];
        const next = i + 1 < bars ? target[i + 1] : cur;
        target[i] = (prev + 2 * cur + next) / 4;
        prev = cur;
      }
    }
    // waktu: attack/release bebas frame-rate
    const kA = snap || this.first ? 1 : 1 - Math.exp(-dt / Math.max(0.001, c.attack / 1000));
    const kR = snap || this.first ? 1 : 1 - Math.exp(-dt / Math.max(0.001, c.release / 1000));
    for (let i = 0; i < bars; i++) {
      const t = target[i];
      const s = this.smooth[i];
      this.smooth[i] = s + (t - s) * (t > s ? kA : kR);
      const pk = this.peak[i];
      this.peak[i] = snap || this.first ? this.smooth[i] : Math.max(this.smooth[i], pk - c.peakFall * dt);
    }

    // level & bass
    let sum = 0;
    for (let i = 0; i < w.mono.length; i++) sum += w.mono[i] * w.mono[i];
    const rms = Math.sqrt(sum / w.mono.length);
    const lvlT = this.dbToUnit(20 * Math.log10(rms + 1e-9) + 28 + c.gainDb * 0.4);
    let bassT = 0;
    const b0 = Math.max(1, Math.floor(40 / binHz));
    const b1 = Math.max(b0 + 1, Math.ceil(160 / binHz));
    for (let k = b0; k <= b1 && k < mag.length; k++) if (mag[k] > bassT) bassT = mag[k];
    bassT = this.dbToUnit(20 * Math.log10(bassT + 1e-9) + c.gainDb * 0.6 + 8);
    const kl = snap || this.first ? 1 : 1 - Math.exp(-dt / 0.08);
    this.lvl += (lvlT - this.lvl) * kl;
    const kb = this.first || snap ? 1 : bassT > this.bassEnv ? 1 - Math.exp(-dt / 0.03) : 1 - Math.exp(-dt / 0.22);
    this.bassEnv += (bassT - this.bassEnv) * kb;
    this.first = false;

    // gelombang (soft clip dengan gain)
    const wg = Math.pow(10, (c.gainDb - 6) / 20);
    const L = new Float32Array(WAVE_LEN);
    const R = new Float32Array(WAVE_LEN);
    const M = new Float32Array(WAVE_LEN);
    for (let i = 0; i < WAVE_LEN; i++) {
      L[i] = Math.tanh(w.left[i] * wg);
      R[i] = Math.tanh(w.right[i] * wg);
      M[i] = (L[i] + R[i]) * 0.5;
    }
    return { bars: this.smooth, peaks: this.peak, wave: M, waveL: L, waveR: R, level: this.lvl, bass: this.bassEnv };
  }
}

/** Frame kosong (senyap) — dipakai sebelum audio dimuat. */
export function silentFrame(bars: number): VizFrame {
  const z = () => new Float32Array(WAVE_LEN);
  return { bars: new Float32Array(bars), peaks: new Float32Array(bars), wave: z(), waveL: z(), waveR: z(), level: 0, bass: 0 };
}
