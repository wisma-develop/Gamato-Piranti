// Shared helpers for the Rak Utilitas tools (password/token generator, currency, clipboard)
export function cryptoRandomInt(max: number): number {
  const buf = new Uint32Array(1);
  let rand = 0;
  do {
    window.crypto.getRandomValues(buf);
    rand = buf[0] / 2 ** 32;
  } while (rand === 1);
  return Math.floor(rand * max);
}

export function formatIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(n);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
