// Tangkapan halaman penuh dari HTML (tempel kode / berkas .html) — deterministik, tanpa izin layar.
// Cara kerja: HTML dimuat di iframe tersembunyi bersandbox (tanpa skrip) lebar perangkat pilihan,
// tinggi dokumen diukur, stylesheet & gambar eksternal di-inline bila CORS mengizinkan, lalu dokumen
// diserialisasi ke SVG <foreignObject> dan digambar ke kanvas (dipotong per segmen bila sangat tinggi).

export interface HtmlCaptureOptions {
  /** Lebar viewport CSS (px). */
  width: number;
  /** Skala piksel (1 = normal, 2 = tajam/retina). */
  scale: number;
  /** Warna dasar bila dokumen tidak punya latar. */
  bg: string;
  /** Tinggi segmen CSS px; 0 = otomatis (satu gambar utuh bila muat). */
  segmentHeight: number;
  /** Tinggi viewport untuk satuan vh (px). */
  viewportHeight?: number;
  signal?: { cancelled: boolean };
}

export interface HtmlCaptureResult {
  canvases: HTMLCanvasElement[];
  pageHeight: number;
  notes: string[];
}

const MAX_OUT = 16000; // piksel keluaran per sisi (aman untuk semua browser modern)

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchDataUrl(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctl.signal, mode: "cors" });
    clearTimeout(t);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function fetchText(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctl.signal, mode: "cors" });
    clearTimeout(t);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

export async function loadHtmlFrame(html: string, width: number, viewportHeight: number): Promise<HTMLIFrameElement> {
  const f = document.createElement("iframe");
  f.setAttribute("sandbox", "allow-same-origin");
  f.setAttribute("aria-hidden", "true");
  f.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:${viewportHeight}px;border:0;visibility:hidden;`;
  f.srcdoc = html;
  document.body.appendChild(f);
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    f.addEventListener("load", done, { once: true });
    setTimeout(done, 8000);
  });
  try {
    await (f.contentDocument as any)?.fonts?.ready;
  } catch { /* abaikan */ }
  await wait(60);
  return f;
}

export function measureFrameHeight(f: HTMLIFrameElement): number {
  const d = f.contentDocument;
  if (!d) return 0;
  return Math.ceil(Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0, 1));
}

async function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  // Data URL (bukan Blob URL): Chromium menandai kanvas “tainted” bila SVG foreignObject dimuat dari blob:,
  // sehingga toBlob/toDataURL gagal. Data URL aman untuk diekspor.
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Browser gagal merender HTML ini ke gambar (mungkin ada markup yang tidak valid)."));
    img.src = url;
  });
}

export async function captureHtml(html: string, o: HtmlCaptureOptions): Promise<HtmlCaptureResult> {
  const notes: string[] = [];
  const width = Math.max(240, Math.min(3840, Math.round(o.width)));
  const scale = Math.max(0.5, Math.min(4, o.scale));
  const frame = await loadHtmlFrame(html, width, o.viewportHeight ?? 900);
  try {
    if (o.signal?.cancelled) throw new Error("Dibatalkan.");
    const doc = frame.contentDocument;
    if (!doc || !doc.documentElement) throw new Error("Dokumen HTML tidak bisa dibaca.");
    const pageH = measureFrameHeight(frame);
    // Tinggi frame disamakan dengan tinggi dokumen agar satuan % / flex mengikuti tampilan penuh
    frame.style.height = `${pageH}px`;
    await wait(40);
    const H = Math.max(pageH, measureFrameHeight(frame));

    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("script,noscript,iframe,object,embed").forEach((n) => n.remove());

    // Inline stylesheet eksternal
    let cssFail = 0, imgFail = 0, cssOk = 0, imgOk = 0;
    const links = Array.from(clone.querySelectorAll('link[rel~="stylesheet"][href]'));
    for (const l of links) {
      const href = l.getAttribute("href") || "";
      if (!/^https?:/i.test(href)) { l.remove(); cssFail++; continue; }
      const css = await fetchText(href);
      if (css) {
        const st = doc.createElement("style");
        st.textContent = css;
        l.replaceWith(st);
        cssOk++;
      } else {
        l.remove();
        cssFail++;
      }
      if (o.signal?.cancelled) throw new Error("Dibatalkan.");
    }
    // Inline gambar eksternal
    const imgs = Array.from(clone.querySelectorAll("img[src]"));
    for (const im of imgs) {
      const src = im.getAttribute("src") || "";
      if (src.startsWith("data:")) continue;
      if (!/^(https?:|blob:)/i.test(src)) { imgFail++; continue; }
      const du = await fetchDataUrl(src);
      if (du) { im.setAttribute("src", du); im.removeAttribute("srcset"); imgOk++; }
      else imgFail++;
      if (o.signal?.cancelled) throw new Error("Dibatalkan.");
    }
    if (cssFail) notes.push(`${cssFail} stylesheet eksternal tidak bisa dimuat (CORS/URL relatif) — tampilan bisa berbeda dari pratinjau.`);
    if (imgFail) notes.push(`${imgFail} gambar eksternal tidak bisa dimuat (CORS) — tampil kosong. Tempel gambar sebagai data URL / unggah berkas lengkap agar ikut tertangkap.`);
    void cssOk; void imgOk;

    // Latar: ambil dari body/html bila ada
    const cs = (n: Element | null) => (n ? getComputedStyle(n).backgroundColor : "");
    const isTransparent = (c: string) => !c || c === "transparent" || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);
    const docBg = !isTransparent(cs(doc.body)) ? cs(doc.body) : !isTransparent(cs(doc.documentElement)) ? cs(doc.documentElement) : o.bg;

    clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    const xhtml = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}"><foreignObject x="0" y="0" width="${width}" height="${H}">${xhtml}</foreignObject></svg>`;
    const img = await loadSvgImage(svg);

    // Segmentasi
    let segH = o.segmentHeight > 0 ? Math.round(o.segmentHeight) : 0;
    if (!segH && H * scale > MAX_OUT) segH = Math.floor(MAX_OUT / scale / 2); // otomatis, ~separuh batas
    if (!segH) segH = H;
    const canvases: HTMLCanvasElement[] = [];
    for (let y = 0; y < H; y += segH) {
      if (o.signal?.cancelled) throw new Error("Dibatalkan.");
      const hh = Math.min(segH, H - y);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(width * scale));
      c.height = Math.max(1, Math.round(hh * scale));
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = docBg;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, y, width, hh, 0, 0, c.width, c.height);
      canvases.push(c);
      await wait(0);
    }
    if (canvases.length > 1) notes.push(`Halaman sangat tinggi (${H}px) — dipotong menjadi ${canvases.length} bagian agar aman untuk browser.`);
    return { canvases, pageHeight: H, notes };
  } finally {
    frame.remove();
  }
}
