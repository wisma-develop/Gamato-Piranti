/// <reference lib="webworker" />
import jsQR from "jsqr";

// Decode QR di thread terpisah supaya verifikasi tidak pernah memblokir antarmuka (TBT / jank saat mengetik).
self.onmessage = (e: MessageEvent<{ id: number; buffer: ArrayBuffer; w: number; h: number }>) => {
  const { id, buffer, w, h } = e.data;
  const data = new Uint8ClampedArray(buffer);
  // Kasus umum (gelap di atas terang) dicoba dulu tanpa inversi — jauh lebih murah; inversi hanya bila gagal.
  const code = jsQR(data, w, h, { inversionAttempts: "dontInvert" }) ?? jsQR(data, w, h, { inversionAttempts: "onlyInvert" });
  (self as unknown as Worker).postMessage({ id, text: code ? code.data : null });
};
