// Prints a canvas via the browser's native print dialog. This is the reliable,
// universally-compatible printing path: it works with ANY printer already
// installed on the operating system — wired USB or Bluetooth-paired — because
// it goes through the regular OS print pipeline instead of talking to the
// printer hardware directly (see webUsbPrinter.ts for the experimental
// direct-USB alternative, which only works for a subset of printers).

export function printCanvasImage(canvas: HTMLCanvasElement, opts: { widthMm?: number; title?: string } = {}): void {
  const dataUrl = canvas.toDataURL("image/png");
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) {
    throw new Error("Popup diblokir browser. Izinkan popup untuk domain ini agar bisa mencetak.");
  }
  const pageSize = opts.widthMm ? `${opts.widthMm}mm auto` : "auto";
  const imgWidth = opts.widthMm ? `${opts.widthMm}mm` : "100%";
  const title = opts.title ?? "Cetak — Gamato Piranti";

  win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>
  @page { size: ${pageSize}; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  img { width: ${imgWidth}; display: block; }
</style>
</head>
<body>
  <img src="${dataUrl}" alt="${title}" />
  <script>
    window.onload = function () { window.focus(); window.print(); };
    window.onafterprint = function () { window.close(); };
  </script>
</body>
</html>`);
  win.document.close();
}
