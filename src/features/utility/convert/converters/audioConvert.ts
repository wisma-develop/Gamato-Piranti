// ─── Audio converter — any browser-decodable audio -> WAV ──────────────────
// True codec transcoding (e.g. anything -> MP3/AAC/OGG) needs a real encoder
// library (ffmpeg.wasm or similar); none is available among this project's
// dependencies and none can be installed offline. What IS fully achievable
// natively: decode whatever the browser's Web Audio API can decode (MP3,
// WAV, OGG Vorbis, AAC/M4A and FLAC all decode in current Chrome/Edge; Ogg
// support varies slightly by browser) into raw PCM, then re-encode that PCM
// losslessly as a standard WAV file — a real, useful, honestly-scoped
// conversion, not a stub.
export async function audioFileToWav(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    throw new Error("Browser tidak bisa membaca format audio ini. Coba file MP3, WAV, OGG, atau M4A.");
  } finally {
    ctx.close().catch(() => {});
  }
  return encodeAudioBufferToWav(audioBuffer);
}

/** Encodes a Web Audio AudioBuffer (any channel count) as a standard 16-bit PCM WAV file. */
export function encodeAudioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buffer.getChannelData(ch));

  let offset = headerSize;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

// ─── Compressed audio (real-time playback re-capture) ──────────────────────
const AUDIO_COMPRESS_CANDIDATES = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"];

function bestCompressedAudioMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return AUDIO_COMPRESS_CANDIDATES.find((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  }) ?? null;
}

export function isAudioCompressionSupported(): boolean {
  return bestCompressedAudioMime() !== null;
}

export async function audioFileToCompressed(file: File, onProgress?: (pct: number) => void): Promise<Blob> {
  const mimeType = bestCompressedAudioMime();
  if (!mimeType) {
    throw new Error("Browser ini tidak mendukung encoder audio terkompresi (Opus). Coba Chrome, Edge, atau Firefox versi terbaru.");
  }

  const url = URL.createObjectURL(file);
  const audio = new Audio();
  audio.src = url;
  audio.muted = false;

  try {
    await new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject(new Error("Gagal memuat audio — file mungkin rusak atau formatnya tidak didukung browser."));
    });

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx: AudioContext = new AudioCtx();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const source = audioCtx.createMediaElementSource(audio);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(audioCtx.destination);

    const recorder = new MediaRecorder(dest.stream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    const resultPromise = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(";")[0] }));
      recorder.onerror = (e: any) => reject(new Error(e?.error?.message || "Kompresi audio gagal."));
    });

    recorder.start(250);
    const duration = Math.max(0.001, audio.duration || 0);
    let rafId = 0;
    const tick = () => {
      onProgress?.(Math.min(1, audio.currentTime / duration));
      if (!audio.ended) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    await audio.play();
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
    });

    cancelAnimationFrame(rafId);
    recorder.stop();
    const blob = await resultPromise;
    audioCtx.close().catch(() => {});
    onProgress?.(1);
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
