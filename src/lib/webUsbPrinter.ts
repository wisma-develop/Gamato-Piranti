// Experimental direct-to-USB-printer transport using the WebUSB API.
//
// Honesty first: WebUSB only works in Chromium browsers (Chrome/Edge/Opera),
// requires the user to explicitly pick the USB device from a browser prompt,
// and will fail if the OS has already claimed the printer with a driver
// (very common — many thermal printers install as a normal system printer).
// When that happens, callers should fall back to window.print() instead,
// which works with ANY printer already installed on the OS (USB or
// Bluetooth-paired) since it goes through the regular print pipeline.

export function isWebUsbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

export class WebUsbPrintError extends Error {}

/** Opens a user-picked USB device, sends the raw bytes to its first bulk OUT endpoint, then closes it. */
export async function printViaWebUsb(data: Uint8Array): Promise<void> {
  if (!isWebUsbSupported()) {
    throw new WebUsbPrintError("WebUSB tidak didukung di browser ini. Gunakan Chrome atau Edge di desktop.");
  }
  const usb = (navigator as any).usb;

  let device: any;
  try {
    device = await usb.requestDevice({ filters: [] });
  } catch {
    throw new WebUsbPrintError("Tidak ada printer yang dipilih.");
  }

  try {
    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Find the first interface that exposes a bulk OUT endpoint (standard for USB printers).
    let interfaceNumber: number | null = null;
    let endpointNumber: number | null = null;
    for (const cfg of device.configurations ?? [device.configuration]) {
      for (const iface of cfg.interfaces ?? []) {
        const alt = iface.alternates?.[0];
        const outEndpoint = alt?.endpoints?.find((e: any) => e.direction === "out" && e.type === "bulk");
        if (outEndpoint) {
          interfaceNumber = iface.interfaceNumber;
          endpointNumber = outEndpoint.endpointNumber;
          break;
        }
      }
      if (interfaceNumber !== null) break;
    }

    if (interfaceNumber === null || endpointNumber === null) {
      throw new WebUsbPrintError("Tidak menemukan endpoint printer yang cocok pada perangkat ini.");
    }

    await device.claimInterface(interfaceNumber);
    const result = await device.transferOut(endpointNumber, data);
    if (result.status !== "ok") {
      throw new WebUsbPrintError(`Transfer data gagal (status: ${result.status}).`);
    }
    await device.releaseInterface(interfaceNumber);
  } catch (err: any) {
    if (err instanceof WebUsbPrintError) throw err;
    const msg = String(err?.message || err);
    if (/claim/i.test(msg)) {
      throw new WebUsbPrintError(
        "Gagal mengakses printer — kemungkinan printer sudah terpasang sebagai printer sistem (driver OS memegang koneksi). Gunakan tombol 'Cetak (Dialog Browser)' sebagai gantinya."
      );
    }
    throw new WebUsbPrintError(`Gagal mencetak via USB: ${msg}`);
  } finally {
    try {
      await device?.close();
    } catch {
      // Ignore close errors — best effort cleanup only.
    }
  }
}
