// Transcript engine — pure functions (no DOM): formatting, paragraphing,
// statistics, keyword/summary extraction, SRT/VTT parsing and text exporters.

export interface Segment {
  id: string;
  start: number; // seconds
  end: number;
  text: string;
  speaker: number | null; // index into speakers[]
}

export interface TranscriptMeta {
  title: string;
  sourceName: string;
  duration: number;
  language: string;
  model: string;
  speakers: string[];
  date: string; // ISO
}

export interface Paragraph {
  start: number;
  end: number;
  speaker: number | null;
  text: string;
  segmentIds: string[];
}

export interface FormatOptions {
  removeFillers: boolean;
  capitalize: boolean;
  punctuate: boolean;
  paragraphGap: number; // seconds of silence that starts a new paragraph
  paragraphMax: number; // soft max characters per paragraph
}

export const DEFAULT_FORMAT: FormatOptions = { removeFillers: true, capitalize: true, punctuate: true, paragraphGap: 1.6, paragraphMax: 650 };

let idCounter = 0;
export const newSegId = (): string => `s${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/* ─────────────────────────── time formatting ─────────────────────────── */

export function fmtTime(sec: number, opts: { ms?: boolean; sep?: "," | "."; forceHours?: boolean } = {}): string {
  const s = Math.max(0, sec);
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const ms = Math.min(999, Math.round((s - total) * 1000));
  const core = h > 0 || opts.forceHours ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return opts.ms ? `${core}${opts.sep ?? "."}${String(ms).padStart(3, "0")}` : core;
}

/* ─────────────────────────── text cleanup ─────────────────────────── */

const FILLER_RE = /(^|[\s,.;!?])(?:e+h+m*|e+m+|h+m+|m{2,}|u+h+m*|u+m+|e{2,}|e+rr+)(?=[\s,.;!?]|$)[,.]?/gi;

export function removeFillers(text: string): string {
  let out = text.replace(FILLER_RE, "$1");
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.;!?])/g, "$1").replace(/^[,.;\s]+/, "").trim();
  return out;
}

export function capitalizeSentences(text: string): string {
  return text.replace(/(^\s*|[.!?…]\s+|\n\s*)([a-zà-öø-ÿ])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
}

export function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").replace(/([,.;:!?])(?=[A-Za-zÀ-ÿ])/g, "$1 ").trim();
}

export function ensureTerminalPunctuation(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return /[.!?…"')\]]$/.test(t) ? t : `${t}.`;
}

/** Cleans one segment's text according to the options (no terminal punctuation here — see paragraphs). */
export function cleanSegmentText(text: string, o: Pick<FormatOptions, "removeFillers" | "capitalize">): string {
  let t = normalizeSpaces(text);
  if (o.removeFillers) t = removeFillers(t);
  if (o.capitalize) t = capitalizeSentences(t);
  return t;
}

/**
 * Applies cleanup to the stored segments. A segment is only capitalised when it begins a sentence
 * (first segment, or the previous one ended with . ! ? …) so mid-sentence segments stay lower-case.
 */
export function cleanSegments(segs: Segment[], o: Pick<FormatOptions, "removeFillers" | "capitalize">): Segment[] {
  let prevEnded = true;
  const out: Segment[] = [];
  for (const s of segs) {
    let t = cleanSegmentText(s.text, { removeFillers: o.removeFillers, capitalize: false });
    if (!t) continue; // a segment that only held fillers disappears
    if (o.capitalize) {
      t = t.replace(/([.!?…]\s+)([a-zà-öø-ÿ])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
      if (prevEnded) t = t.charAt(0).toUpperCase() + t.slice(1);
    }
    prevEnded = /[.!?…]["')\]]*$/.test(t);
    out.push({ ...s, text: t });
  }
  return out;
}

/* ─────────────────────────── post-processing ASR output ─────────────────────────── */

/** Drops empty segments and collapses runaway repetition (a typical Whisper failure on noise). */
export function postProcessAsr(segs: Segment[]): Segment[] {
  const out: Segment[] = [];
  let repeat = 0;
  for (const s of segs) {
    const text = normalizeSpaces(s.text);
    if (!text || /^[\s.,!?…\-–—♪♫\[\]()]+$/.test(text)) continue;
    const prev = out[out.length - 1];
    if (prev && prev.text.toLowerCase() === text.toLowerCase()) {
      repeat++;
      if (repeat >= 2) {
        prev.end = Math.max(prev.end, s.end); // keep a single copy, extend its time
        continue;
      }
    } else repeat = 0;
    out.push({ ...s, text });
  }
  return out;
}

/** Merges neighbouring very short segments of the same speaker (nicer subtitles/reading). */
export function mergeShortSegments(segs: Segment[], minChars = 25, maxGap = 0.8, maxChars = 220): Segment[] {
  const out: Segment[] = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (prev && prev.speaker === s.speaker && (prev.text.length < minChars || s.text.length < minChars) && s.start - prev.end <= maxGap && prev.text.length + s.text.length < maxChars) {
      prev.text = `${prev.text} ${s.text}`.trim();
      prev.end = s.end;
    } else out.push({ ...s });
  }
  return out;
}

/* ─────────────────────────── paragraphs ─────────────────────────── */

export function buildParagraphs(segs: Segment[], o: FormatOptions): Paragraph[] {
  const paras: Paragraph[] = [];
  let cur: Paragraph | null = null;
  let lastEnd = 0;
  for (const s of segs) {
    const txt = cleanSegmentText(s.text, { removeFillers: o.removeFillers, capitalize: false });
    if (!txt) continue;
    const endsSentence = cur ? /[.!?…]$/.test(cur.text) : true;
    const newPara =
      !cur || cur.speaker !== s.speaker || s.start - lastEnd >= o.paragraphGap || (cur.text.length >= o.paragraphMax && endsSentence);
    if (newPara) {
      if (cur) paras.push(cur);
      cur = { start: s.start, end: s.end, speaker: s.speaker, text: txt, segmentIds: [s.id] };
    } else if (cur) {
      cur.text = `${cur.text} ${txt}`;
      cur.end = s.end;
      cur.segmentIds.push(s.id);
    }
    lastEnd = s.end;
  }
  if (cur) paras.push(cur);
  return paras.map((p) => {
    let t = p.text;
    if (o.capitalize) t = capitalizeSentences(t);
    if (o.punctuate) t = ensureTerminalPunctuation(t);
    return { ...p, text: t };
  });
}

/* ─────────────────────────── analysis ─────────────────────────── */

const STOP = new Set(
  ("yang dan di ke dari ini itu untuk dengan pada adalah dalam tidak akan juga atau saya kami kita kamu anda dia mereka sudah belum bisa dapat ada lebih sangat seperti karena jadi kalau tapi tetapi namun oleh agar supaya sebagai para bahwa hal itu nya lah kah pun saja hanya masih sedang telah harus mau ya iya gak enggak nggak dong sih deh kan lagi aja gitu begitu bagaimana apa siapa kapan dimana mengapa kenapa bukan setelah sebelum saat ketika antara sampai hingga lalu kemudian terus yaitu yakni dll dsb sini situ sana mungkin sekali banyak semua setiap beberapa " +
    "the a an and or but if then of to in on at for with from by as is are was were be been being it its this that these those i you he she we they them his her our your their not no yes do does did done have has had will would can could should may might must so than too very just about into over after before also there here what which who whom when where why how all any some more most other such only own same").split(" ")
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-zà-öø-ÿ0-9]+(?:['’-][a-zà-öø-ÿ0-9]+)*/g) ?? []) as string[];
}

export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

export function topKeywords(text: string, n = 10): { word: string; count: number }[] {
  const freq = new Map<string, number>();
  for (const w of tokenize(text)) {
    if (w.length < 4 || STOP.has(w) || /^\d+$/.test(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, c]) => c >= 2 || freq.size < 30)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([word, count]) => ({ word, count }));
}

export function splitSentences(text: string): string[] {
  return (text.replace(/\s+/g, " ").match(/[^.!?…]+[.!?…]+(?:["')\]]+)?|[^.!?…]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

/** Extractive summary: highest keyword-scoring sentences, shown in original order. */
export function extractiveSummary(text: string, count = 5): string[] {
  const sentences = splitSentences(text).filter((s) => countWords(s) >= 5);
  if (sentences.length <= count) return sentences;
  const freq = new Map<string, number>();
  for (const w of tokenize(text)) if (w.length >= 4 && !STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
  const scored = sentences.map((s, i) => {
    const toks = tokenize(s).filter((w) => w.length >= 4 && !STOP.has(w));
    const score = toks.reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.sqrt(Math.max(6, toks.length + 4));
    return { s, i, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

export interface TranscriptStats {
  words: number;
  chars: number;
  segments: number;
  duration: number;
  wpm: number;
  perSpeaker: { speaker: number | null; seconds: number; words: number }[];
}

export function computeStats(segs: Segment[], duration: number): TranscriptStats {
  let words = 0;
  let chars = 0;
  let spoken = 0;
  const per = new Map<number | null, { seconds: number; words: number }>();
  for (const s of segs) {
    const w = countWords(s.text);
    words += w;
    chars += s.text.length;
    const secs = Math.max(0, s.end - s.start);
    spoken += secs;
    const e = per.get(s.speaker) ?? { seconds: 0, words: 0 };
    e.seconds += secs;
    e.words += w;
    per.set(s.speaker, e);
  }
  const base = spoken > 0 ? spoken : duration;
  return {
    words,
    chars,
    segments: segs.length,
    duration,
    wpm: base > 0 ? Math.round((words / base) * 60) : 0,
    perSpeaker: [...per.entries()].map(([speaker, v]) => ({ speaker, ...v })).sort((a, b) => b.seconds - a.seconds),
  };
}

/** Heuristic turn guess: alternate speaker 0/1 after every long pause. Clearly labelled as an estimate in the UI. */
export function guessSpeakersByPauses(segs: Segment[], gap: number): Segment[] {
  let cur = 0;
  return segs.map((s, i) => {
    if (i > 0 && s.start - segs[i - 1].end >= gap) cur = cur === 0 ? 1 : 0;
    return { ...s, speaker: cur };
  });
}

/* ─────────────────────────── search / replace ─────────────────────────── */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countMatches(segs: Segment[], find: string, matchCase: boolean): number {
  if (!find) return 0;
  const re = new RegExp(escapeRegExp(find), matchCase ? "g" : "gi");
  return segs.reduce((a, s) => a + (s.text.match(re)?.length ?? 0), 0);
}

export function replaceAll(segs: Segment[], find: string, rep: string, matchCase: boolean): Segment[] {
  if (!find) return segs;
  const re = new RegExp(escapeRegExp(find), matchCase ? "g" : "gi");
  return segs.map((s) => ({ ...s, text: s.text.replace(re, () => rep) }));
}

/* ─────────────────────────── parsers (import) ─────────────────────────── */

function parseTimestamp(t: string): number | null {
  const m = t.trim().replace(",", ".").match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const frac = m[4] ? parseInt(m[4].padEnd(3, "0"), 10) / 1000 : 0;
  return h * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + frac;
}

/** Parses SRT / WebVTT; returns [] if no cue is found. */
export function parseSubtitles(text: string): Segment[] {
  const blocks = text.replace(/\r/g, "").replace(/^\uFEFF/, "").split(/\n{2,}/);
  const out: Segment[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    const ti = lines.findIndex((l) => l.includes("-->"));
    if (ti < 0) continue;
    const [a, bRaw] = lines[ti].split("-->");
    const start = parseTimestamp(a);
    const end = parseTimestamp(bRaw.trim().split(/\s+/)[0]);
    if (start == null || end == null) continue;
    const body = lines.slice(ti + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (body) out.push({ id: newSegId(), start, end, text: body, speaker: null });
  }
  return out;
}

/** Parses lines like "[00:01:23] Speaker: text" or "00:01 text"; falls back to paragraph-per-segment without time. */
export function parsePlainTranscript(text: string): Segment[] {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  const out: Segment[] = [];
  let timed = 0;
  for (const l of lines) {
    const m = l.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?)\]?\s*[-–]?\s*(.*)$/);
    if (m && parseTimestamp(m[1].length <= 5 ? `00:${m[1]}` : m[1]) != null) {
      const start = parseTimestamp(m[1].length <= 5 ? `00:${m[1]}` : m[1])!;
      out.push({ id: newSegId(), start, end: start, text: m[2], speaker: null });
      timed++;
    } else out.push({ id: newSegId(), start: 0, end: 0, text: l, speaker: null });
  }
  if (timed > 0) {
    for (let i = 0; i < out.length; i++) {
      const next = out.slice(i + 1).find((x) => x.start > out[i].start);
      out[i].end = next ? next.start : out[i].start + 4;
    }
  }
  return out;
}

export function parseAnyTranscript(text: string): Segment[] {
  const subs = parseSubtitles(text);
  return subs.length ? subs : parsePlainTranscript(text);
}

/* ─────────────────────────── exporters (text based) ─────────────────────────── */

export interface ExportOptions {
  timestamps: boolean;
  speakers: boolean;
  summary: string[] | null;
  keywords: string[] | null;
}

const spName = (meta: TranscriptMeta, i: number | null): string => (i == null ? "" : meta.speakers[i] ?? `Pembicara ${i + 1}`);

export function exportTxt(meta: TranscriptMeta, paras: Paragraph[], o: ExportOptions): string {
  const lines: string[] = [];
  lines.push(meta.title.toUpperCase());
  lines.push("=".repeat(Math.min(72, Math.max(10, meta.title.length))));
  lines.push(`Sumber   : ${meta.sourceName}`);
  lines.push(`Durasi   : ${fmtTime(meta.duration)}`);
  lines.push(`Bahasa   : ${meta.language}`);
  lines.push(`Tanggal  : ${new Date(meta.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`);
  lines.push("");
  if (o.summary?.length) {
    lines.push("RINGKASAN", "---------");
    o.summary.forEach((s) => lines.push(`• ${s}`));
    lines.push("");
  }
  if (o.keywords?.length) lines.push(`Kata kunci: ${o.keywords.join(", ")}`, "");
  lines.push("TRANSKRIP", "---------");
  for (const p of paras) {
    const head = [o.timestamps ? `[${fmtTime(p.start)}]` : "", o.speakers && p.speaker != null ? `${spName(meta, p.speaker)}:` : ""].filter(Boolean).join(" ");
    lines.push(head ? `${head} ${p.text}` : p.text, "");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function exportMarkdown(meta: TranscriptMeta, paras: Paragraph[], o: ExportOptions): string {
  const L: string[] = [];
  L.push(`# ${meta.title}`, "");
  L.push(`- **Sumber:** ${meta.sourceName}`, `- **Durasi:** ${fmtTime(meta.duration)}`, `- **Bahasa:** ${meta.language}`);
  L.push(`- **Tanggal:** ${new Date(meta.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`);
  if (meta.speakers.length) L.push(`- **Pembicara:** ${meta.speakers.join(", ")}`);
  L.push("");
  if (o.summary?.length) {
    L.push("## Ringkasan", "");
    o.summary.forEach((s) => L.push(`- ${s}`));
    L.push("");
  }
  if (o.keywords?.length) L.push("## Kata Kunci", "", o.keywords.map((k) => `\`${k}\``).join(" · "), "");
  L.push("## Transkrip", "");
  for (const p of paras) {
    const parts: string[] = [];
    if (o.timestamps) parts.push(`\`${fmtTime(p.start)}\``);
    if (o.speakers && p.speaker != null) parts.push(`**${spName(meta, p.speaker)}:**`);
    L.push(parts.length ? `${parts.join(" ")} ${p.text}` : p.text, "");
  }
  return L.join("\n").trimEnd() + "\n";
}

/** Splits long segments into subtitle-sized cues (≤ 2 lines × 42 chars, ≤ 7 s). */
export function toCues(segs: Segment[], maxChars = 84, maxDur = 7): { start: number; end: number; text: string }[] {
  const cues: { start: number; end: number; text: string }[] = [];
  for (const s of segs) {
    const text = normalizeSpaces(s.text);
    if (!text) continue;
    const dur = Math.max(0.5, s.end - s.start);
    const pieces = Math.max(1, Math.ceil(text.length / maxChars), Math.ceil(dur / maxDur));
    if (pieces === 1) {
      cues.push({ start: s.start, end: Math.max(s.end, s.start + 0.5), text });
      continue;
    }
    // split on word boundaries near equal character counts
    const words = text.split(" ");
    const target = Math.ceil(text.length / pieces);
    const chunks: string[] = [];
    let cur = "";
    for (const w of words) {
      if (cur && (cur + " " + w).length > target && chunks.length < pieces - 1) { chunks.push(cur); cur = w; }
      else cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) chunks.push(cur);
    const totalLen = chunks.reduce((a, c) => a + c.length, 0);
    let t = s.start;
    for (const c of chunks) {
      const d = (c.length / totalLen) * dur;
      cues.push({ start: t, end: t + d, text: c });
      t += d;
    }
  }
  return cues;
}

function wrapCue(text: string, width = 42): string {
  if (text.length <= width) return text;
  const words = text.split(" ");
  const half = text.length / 2;
  let a = "";
  for (const w of words) {
    if (a && (a + " " + w).length > half) break;
    a = a ? `${a} ${w}` : w;
  }
  const b = text.slice(a.length).trim();
  return b ? `${a}\n${b}` : a;
}

export function exportSrt(segs: Segment[]): string {
  const cues = toCues(segs);
  return cues.map((c, i) => `${i + 1}\n${fmtTime(c.start, { ms: true, sep: ",", forceHours: true })} --> ${fmtTime(c.end, { ms: true, sep: ",", forceHours: true })}\n${wrapCue(c.text)}`).join("\n\n") + "\n";
}

export function exportVtt(segs: Segment[]): string {
  const cues = toCues(segs);
  return "WEBVTT\n\n" + cues.map((c, i) => `${i + 1}\n${fmtTime(c.start, { ms: true, sep: ".", forceHours: true })} --> ${fmtTime(c.end, { ms: true, sep: ".", forceHours: true })}\n${wrapCue(c.text)}`).join("\n\n") + "\n";
}

export function exportJson(meta: TranscriptMeta, segs: Segment[], paras: Paragraph[]): string {
  return JSON.stringify(
    {
      meta,
      segments: segs.map((s) => ({ start: round3(s.start), end: round3(s.end), speaker: s.speaker == null ? null : spName(meta, s.speaker), text: s.text })),
      paragraphs: paras.map((p) => ({ start: round3(p.start), end: round3(p.end), speaker: p.speaker == null ? null : spName(meta, p.speaker), text: p.text })),
    },
    null,
    2
  );
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function exportCsv(meta: TranscriptMeta, segs: Segment[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = ["No,Mulai,Selesai,Pembicara,Teks", ...segs.map((s, i) => [i + 1, fmtTime(s.start, { ms: true }), fmtTime(s.end, { ms: true }), esc(spName(meta, s.speaker)), esc(s.text)].join(","))];
  return "\uFEFF" + rows.join("\r\n") + "\r\n";
}

/** Plain text for copying to clipboard (respecting timestamp/speaker toggles). */
export function exportClipboardText(meta: TranscriptMeta, paras: Paragraph[], o: Pick<ExportOptions, "timestamps" | "speakers">): string {
  return paras
    .map((p) => {
      const head = [o.timestamps ? `[${fmtTime(p.start)}]` : "", o.speakers && p.speaker != null ? `${spName(meta, p.speaker)}:` : ""].filter(Boolean).join(" ");
      return head ? `${head} ${p.text}` : p.text;
    })
    .join("\n\n");
}

/* ─────────────────────────── audio windowing for ASR ─────────────────────────── */

export interface Win { start: number; end: number } // sample indices

/**
 * Plans ≤ `maxSec` windows over 16 kHz audio, preferring to cut at the quietest
 * 100 ms inside the last `searchSec` of each window so words are rarely split.
 */
export function planWindows(audio: Float32Array, sr: number, maxSec = 28, searchSec = 5): Win[] {
  const n = audio.length;
  const wins: Win[] = [];
  const maxLen = Math.round(maxSec * sr);
  const search = Math.round(searchSec * sr);
  const frame = Math.round(0.1 * sr);
  let pos = 0;
  while (pos < n) {
    if (n - pos <= maxLen) { wins.push({ start: pos, end: n }); break; }
    const lo = pos + maxLen - search;
    const hi = pos + maxLen;
    let bestCut = hi;
    let bestE = Infinity;
    for (let f = lo; f + frame <= hi; f += frame) {
      let e = 0;
      for (let i = f; i < f + frame; i++) e += audio[i] * audio[i];
      if (e < bestE) { bestE = e; bestCut = f + (frame >> 1); }
    }
    wins.push({ start: pos, end: bestCut });
    pos = bestCut;
  }
  return wins;
}

/** True if the window is practically silent (skip it — Whisper hallucinates on silence). */
export function isSilentWindow(audio: Float32Array, start: number, end: number, sr: number, rmsThreshold = 0.0035): boolean {
  const frame = sr; // 1 s frames
  let maxRms = 0;
  for (let f = start; f < end; f += frame) {
    const e = Math.min(end, f + frame);
    let s = 0;
    for (let i = f; i < e; i++) s += audio[i] * audio[i];
    maxRms = Math.max(maxRms, Math.sqrt(s / Math.max(1, e - f)));
    if (maxRms >= rmsThreshold) return false;
  }
  return true;
}
