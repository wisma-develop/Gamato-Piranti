import { QrCode, Barcode, Radio, ScanLine } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";
import { tr } from "@/i18n";

export default function KodeCategory() {
  return (
    <PageShell
      badge={tr("Kode")}
      title={tr("Kode")}
      subtitle={tr("Buat QR code full custom, barcode multi-format, terima input scanner HID, atau konversi ke/dari kode Morse — pilih alat yang kamu butuhkan di bawah ini.")}
    >
      <CategoryGrid
        groups={[
          {
            items: [
              {
                name: tr("QR Code"),
                desc: tr("QR code full custom — bentuk titik & sudut, warna, hingga logo bebas diatur."),
                path: "/qr/qr-code",
                icon: <QrCode className="w-6 h-6" />,
              },
              {
                name: tr("Barcode"),
                desc: tr("6 format barcode (CODE128, EAN, UPC, dll) dengan cetak massal langsung ke PDF."),
                path: "/qr/barcode",
                icon: <Barcode className="w-6 h-6" />,
              },
              {
                name: tr("Scan HID"),
                desc: tr("Terima hasil pindaian dari scanner barcode/QR bertipe HID (USB/Bluetooth)."),
                path: "/qr/scan-hid",
                icon: <Barcode className="w-6 h-6" />,
              },
              {
                name: tr("Kode Morse"),
                desc: tr("Konversi teks ke Morse (dan sebaliknya), lengkap audio beep yang bisa diunduh."),
                path: "/qr/kode-morse",
                icon: <Radio className="w-6 h-6" />,
              },
              {
                name: tr("QR & Barcode Scanner"),
                desc: tr("Baca QR code dan barcode dari gambar yang diunggah atau langsung dari kamera."),
                path: "/qr/scan-qr",
                icon: <ScanLine className="w-6 h-6" />,
              },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
