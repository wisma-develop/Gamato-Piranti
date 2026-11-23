/**
 * Pustaka QR meng-encode tiap karakter hanya dengan byte rendahnya (ISO-8859-1), sehingga "—", kutip melengkung,
 * huruf non-Latin, dan emoji RUSAK (mis. "—" menjadi karakter kontrol). Solusinya: isi non-ASCII diubah dulu menjadi
 * "string byte" UTF-8 (satu karakter = satu byte), yang oleh pustaka ditulis apa adanya → pemindai membaca UTF-8 yang benar.
 * Isi ASCII murni dikembalikan tanpa perubahan (jalur lama tetap identik).
 */
export function qrUtf8Data(text: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\u0000-\u007F]*$/.test(text)) return text;
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return out;
}
