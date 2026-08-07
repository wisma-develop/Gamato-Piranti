import { loadImageFromUrl, canvasToBlob, makeCanvas } from "@/lib/canvas";

/**
 * Renders an arbitrary HTML/CSS snippet to a canvas using the SVG
 * `<foreignObject>` trick (no external rendering library needed). Works
 * best for self-contained HTML using inline styles — external images/fonts
 * may be blocked by browser canvas security rules.
 */
export async function renderHtmlToCanvas(html: string, width: number, height: number, bg: string): Promise<HTMLCanvasElement> {
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden;">${html}</div></foreignObject></svg>`;
  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImageFromUrl(url);
    const { canvas, ctx } = makeCanvas(width, height);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function renderHtmlToPngBlob(html: string, width: number, height: number, bg: string) {
  const canvas = await renderHtmlToCanvas(html, width, height, bg);
  return canvasToBlob(canvas, "image/png");
}
