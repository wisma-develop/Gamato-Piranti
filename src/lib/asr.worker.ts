/// <reference lib="webworker" />
// Whisper speech-recognition worker (transformers.js, ONNX Runtime WASM).
// Runs off the main thread so the page stays responsive; the model is downloaded
// once from the Hugging Face hub and cached by the browser.

import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.useBrowserCache = true;

type InMsg =
  | { type: "init"; model: string }
  | { type: "chunk"; id: number; audio: Float32Array; language: string; task: "transcribe" | "translate" };

let asr: any = null;
let loadedModel = "";

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<InMsg>) => {
  const m = e.data;
  try {
    if (m.type === "init") {
      if (!asr || loadedModel !== m.model) {
        post({ type: "status", stage: "loading" });
        asr = await pipeline("automatic-speech-recognition", m.model, {
          device: "wasm",
          dtype: "q8",
          progress_callback: (p: any) => post({ type: "download", p }),
        } as any);
        loadedModel = m.model;
      }
      post({ type: "ready" });
    } else if (m.type === "chunk") {
      if (!asr) throw new Error("Model belum dimuat.");
      const opts: Record<string, unknown> = { task: m.task, return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 };
      if (m.language && m.language !== "auto") opts.language = m.language;
      const out: any = await asr(m.audio, opts);
      const dur = m.audio.length / 16000;
      const chunks: { text: string; timestamp: [number, number | null] }[] = out?.chunks ?? [];
      const segments = chunks.length
        ? chunks.map((c) => ({ start: c.timestamp?.[0] ?? 0, end: c.timestamp?.[1] ?? dur, text: String(c.text ?? "").trim() }))
        : [{ start: 0, end: dur, text: String(out?.text ?? "").trim() }];
      post({ type: "result", id: m.id, segments });
    }
  } catch (err: any) {
    post({ type: "error", id: (m as any).id, message: String(err?.message ?? err) });
  }
};
