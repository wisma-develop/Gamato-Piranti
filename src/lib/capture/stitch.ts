// Penjahit tangkapan panjang (scroll-stitch).
//
// Menerima urutan frame dari video tangkapan layar saat pengguna men-scroll halaman, mencari
// pergeseran vertikal (dy) antar-frame lewat pencocokan baris dua tingkat (kasar → halus),
// lalu menambahkan hanya baris baru ke kanvas hasil. Posisi absolut `pos` dilacak sehingga
// scroll naik-turun tidak menggandakan konten. Header/footer tetap (sticky) bisa diabaikan.

export interface StitchOptions {
  /** Tinggi header tetap (px frame) yang tidak ikut dijahit setelah frame pertama. */
  fixedTop: number;
  /** Tinggi footer tetap (px frame) yang baru ditambahkan di akhir. */
  fixedBottom: number;
  /** Batas tinggi hasil (px) — browser punya batas ukuran kanvas. */
  maxHeight: number;
}

export type StitchStatus =
  | { kind: "first"; height: number }
  | { kind: "appended"; dy: number; height: number }
  | { kind: "same" } // tidak bergerak
  | { kind: "revisit"; dy: number } // scroll ke area yang sudah ada
  | { kind: "lost"; reason: "fast" | "flat" | "nomatch" }
  | { kind: "full" }; // mencapai batas tinggi

function toGray(src: CanvasImageSource, w: number, h: number, sw: number, sh: number, scratch: HTMLCanvasElement): Uint8Array {
  scratch.width = sw;
  scratch.height = sh;
  const c = scratch.getContext("2d", { willReadFrequently: true })!;
  c.imageSmoothingEnabled = true;
  c.drawImage(src, 0, 0, w, h, 0, 0, sw, sh);
  const d = c.getImageData(0, 0, sw, sh).data;
  const g = new Uint8Array(sw * sh);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (d[i] * 77 + d[i + 1] * 151 + d[i + 2] * 28) >> 8;
  return g;
}

/**
 * Galat rata-rata |a[y] - b[y+dy]|. Baris dibatasi pada pita [y0,y1) di KEDUA frame (a: y, b: y+dy), sehingga
 * header/footer tetap tidak ikut dibandingkan. null bila tumpang-tindih terlalu kecil.
 */
function matchError(a: Uint8Array, b: Uint8Array, w: number, h: number, dy: number, y0: number, y1: number, colStep: number): number | null {
  const lo = Math.max(y0, y0 - dy, 0);
  const hi = Math.min(y1, y1 - dy, h);
  if (hi - lo < Math.max(8, (y1 - y0) * 0.2)) return null;
  let sum = 0;
  let n = 0;
  for (let y = lo; y < hi; y++) {
    const ra = y * w;
    const rb = (y + dy) * w;
    for (let x = 0; x < w; x += colStep) {
      const d = a[ra + x] - b[rb + x];
      sum += d < 0 ? -d : d;
      n++;
    }
  }
  return n ? sum / n : null;
}

function bandVariance(g: Uint8Array, w: number, y0: number, y1: number): number {
  let sum = 0, sq = 0, n = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = 0; x < w; x += 3) {
      const v = g[y * w + x];
      sum += v;
      sq += v * v;
      n++;
    }
  }
  if (!n) return 0;
  const m = sum / n;
  return sq / n - m * m;
}

export class LongStitcher {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private opts: StitchOptions;
  private W = 0;
  private H = 0;
  private accH = 0;
  private pos = 0; // posisi atas frame terakhir di koordinat hasil
  private prevCoarse: Uint8Array | null = null;
  private prevFine: Uint8Array | null = null;
  private scratch = document.createElement("canvas");
  private lastFrame: HTMLCanvasElement | null = null;
  private fbPending = false;
  frames = 0;
  lost = 0;
  full = false;

  constructor(opts: StitchOptions) {
    this.opts = opts;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d")!;
  }

  get height() {
    return this.accH;
  }
  get width() {
    return this.W;
  }

  private grow(newH: number) {
    // Mengubah ukuran kanvas menghapus isinya — salin dulu.
    if (newH <= this.canvas.height) return;
    const cap = Math.min(this.opts.maxHeight, Math.max(newH, Math.ceil(this.canvas.height * 1.5), 2000));
    const tmp = document.createElement("canvas");
    tmp.width = this.W;
    tmp.height = this.accH;
    tmp.getContext("2d")!.drawImage(this.canvas, 0, 0);
    this.canvas.width = this.W;
    this.canvas.height = cap;
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.drawImage(tmp, 0, 0);
  }

  /** Memproses satu frame. `frame` harus berukuran sama untuk seluruh sesi. */
  addFrame(frame: HTMLCanvasElement): StitchStatus {
    const w = frame.width, h = frame.height;
    this.frames++;
    // Sampel kasar (lebar ≤ 240) dan halus (lebar ≤ 1600)
    const s1 = Math.min(1, 240 / w);
    const s2 = Math.min(1, 1600 / w);
    const cw = Math.max(16, Math.round(w * s1)), ch = Math.max(16, Math.round(h * s1));
    const fw = Math.max(16, Math.round(w * s2)), fh = Math.max(16, Math.round(h * s2));
    const coarse = toGray(frame, w, h, cw, ch, this.scratch);
    const fine = toGray(frame, w, h, fw, fh, this.scratch);

    if (!this.prevCoarse) {
      this.W = w;
      this.H = h;
      this.canvas.width = w;
      this.canvas.height = Math.min(this.opts.maxHeight, Math.max(h * 3, 2000));
      this.ctx = this.canvas.getContext("2d")!;
      const take = Math.max(1, h - this.opts.fixedBottom);
      this.ctx.drawImage(frame, 0, 0, w, take, 0, 0, w, take);
      this.accH = take;
      this.pos = 0;
      this.fbPending = this.opts.fixedBottom > 0;
      this.prevCoarse = coarse;
      this.prevFine = fine;
      this.keepLast(frame);
      return { kind: "first", height: this.accH };
    }
    if (w !== this.W || h !== this.H) return { kind: "lost", reason: "nomatch" };

    const prevC = this.prevCoarse;
    const prevF = this.prevFine!;
    const topC = Math.round(this.opts.fixedTop * s1);
    const botC = Math.round(this.opts.fixedBottom * s1);
    const margin = Math.max(2, Math.round(ch * 0.04));
    const y0 = Math.min(ch - 12, topC + margin);
    const y1 = Math.max(y0 + 8, ch - botC - margin);
    const topF = Math.round(this.opts.fixedTop * s2), botF = Math.round(this.opts.fixedBottom * s2);
    const m2 = Math.max(2, Math.round(fh * 0.04));
    const fy0 = Math.min(fh - 12, topF + m2), fy1 = Math.max(fy0 + 8, fh - botF - m2);

    // Tidak bergerak? (dikonfirmasi di resolusi halus)
    const sameC = matchError(coarse, prevC, cw, ch, 0, y0, y1, 2);
    if (sameC !== null && sameC < 0.7) {
      const sameF = matchError(fine, prevF, fw, fh, 0, fy0, fy1, 2);
      if (sameF !== null && sameF < 1.2) {
        this.keepLast(frame);
        return { kind: "same" };
      }
    }
    if (bandVariance(coarse, cw, y0, y1) < 6) return this.mark("flat");

    // Tingkat kasar: kumpulkan kandidat dy terbaik (F[y] ≈ prev[y+dy])
    const maxShift = Math.floor(ch * 0.85);
    const errs: number[] = [];
    for (let dy = -maxShift; dy <= maxShift; dy++) {
      const e = matchError(coarse, prevC, cw, ch, dy, y0, y1, 1);
      errs.push(e === null ? Infinity : e);
    }
    const cands: number[] = [];
    const used = new Uint8Array(errs.length);
    for (let n = 0; n < 4; n++) {
      let bi = -1, be = Infinity;
      for (let i = 0; i < errs.length; i++) if (!used[i] && errs[i] < be) { be = errs[i]; bi = i; }
      if (bi < 0 || be > 40) break;
      cands.push(bi - maxShift);
      for (let j = Math.max(0, bi - 3); j <= Math.min(errs.length - 1, bi + 3); j++) used[j] = 1;
    }
    if (!cands.length) return this.mark("fast");

    // Tingkat halus: sempurnakan tiap kandidat di resolusi tinggi lalu pilih yang paling cocok
    const ratio = s2 / s1;
    const rad = Math.ceil(ratio) + 2;
    let fbest = Infinity, fdy = 0, fsecond = Infinity, fsecondDy = 0;
    for (const cdy of cands) {
      const center = Math.round(cdy * ratio);
      let cb = Infinity, cd = center;
      for (let dy = center - rad; dy <= center + rad; dy++) {
        const e = matchError(fine, prevF, fw, fh, dy, fy0, fy1, 1);
        if (e !== null && e < cb) { cb = e; cd = dy; }
      }
      if (cb < fbest) { fsecond = fbest; fsecondDy = fdy; fbest = cb; fdy = cd; }
      else if (cb < fsecond) { fsecond = cb; fsecondDy = cd; }
    }
    if (!isFinite(fbest) || fbest > 7) return this.mark(Math.abs(fdy) > fh * 0.6 ? "fast" : "nomatch");
    if (isFinite(fsecond) && Math.abs(fsecondDy - fdy) > 3 && fsecond - fbest < 0.4 && fbest > 1.5) return this.mark("nomatch"); // ambigu (pola berulang)

    this.prevCoarse = coarse;
    this.prevFine = fine;
    this.keepLast(frame);
    const dyFull = Math.round(fdy / s2);
    if (dyFull === 0) return { kind: "same" };

    // Frame ini berada di posisi baru: pos += dy (dy>0 = scroll turun)
    this.pos += dyFull;
    if (this.pos < 0) this.pos = 0; // tidak mungkin di atas awal
    const bottomLimit = this.pos + this.H - this.opts.fixedBottom;
    if (bottomLimit > this.accH) {
      const startInFrame = Math.max(this.opts.fixedTop, this.accH - this.pos);
      const endInFrame = this.H - this.opts.fixedBottom;
      const rows = endInFrame - startInFrame;
      if (rows > 0) {
        if (this.accH + rows > this.opts.maxHeight) {
          this.full = true;
          return { kind: "full" };
        }
        this.grow(this.accH + rows);
        this.ctx.drawImage(frame, 0, startInFrame, this.W, rows, 0, this.accH, this.W, rows);
        this.accH += rows;
        this.fbPending = this.opts.fixedBottom > 0;
        return { kind: "appended", dy: dyFull, height: this.accH };
      }
    }
    return { kind: "revisit", dy: dyFull };
  }

  private mark(reason: "fast" | "flat" | "nomatch"): StitchStatus {
    this.lost++;
    return { kind: "lost", reason };
  }

  private keepLast(frame: HTMLCanvasElement) {
    if (!this.lastFrame) this.lastFrame = document.createElement("canvas");
    this.lastFrame.width = frame.width;
    this.lastFrame.height = frame.height;
    this.lastFrame.getContext("2d")!.drawImage(frame, 0, 0);
  }

  /** Menambahkan footer tetap dari frame terakhir lalu mengembalikan kanvas final (dipotong sesuai tinggi). */
  finish(): HTMLCanvasElement {
    if (this.fbPending && this.lastFrame && this.opts.fixedBottom > 0) {
      const fb = this.opts.fixedBottom;
      const atPos = this.pos + this.H - fb;
      if (atPos === this.accH && this.accH + fb <= this.opts.maxHeight) {
        this.grow(this.accH + fb);
        this.ctx.drawImage(this.lastFrame, 0, this.H - fb, this.W, fb, 0, this.accH, this.W, fb);
        this.accH += fb;
      }
      this.fbPending = false;
    }
    const out = document.createElement("canvas");
    out.width = Math.max(1, this.W);
    out.height = Math.max(1, this.accH);
    out.getContext("2d")!.drawImage(this.canvas, 0, 0, this.W, this.accH, 0, 0, this.W, this.accH);
    return out;
  }
}
