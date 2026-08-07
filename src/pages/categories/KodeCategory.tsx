import { QrCode, Barcode, Radio } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function KodeCategory() {
  return (
    <PageShell
      badge="Kode"
      title="Kode"
      subtitle="Buat QR code full custom, barcode multi-format, terima input scanner HID, atau konversi ke/dari kode Morse — pilih alat yang kamu butuhkan di bawah ini."
    >
      <CategoryGrid
        groups={[
          {
            items: [
              {
                name: "QR Code",
                desc: "QR code full custom — bentuk titik & sudut, warna, hingga logo bebas diatur.",
                path: "/qr/qr-code",
                icon: <QrCode className="w-6 h-6" />,
              },
              {
                name: "Barcode",
                desc: "6 format barcode (CODE128, EAN, UPC, dll) dengan cetak massal langsung ke PDF.",
                path: "/qr/barcode",
                icon: <Barcode className="w-6 h-6" />,
              },
              {
                name: "Scan HID",
                desc: "Terima hasil pindaian dari scanner barcode/QR bertipe HID (USB/Bluetooth).",
                path: "/qr/scan-hid",
                icon: <Barcode className="w-6 h-6" />,
              },
              {
                name: "Kode Morse",
                desc: "Konversi teks ke Morse (dan sebaliknya), lengkap audio beep yang bisa diunduh.",
                path: "/qr/kode-morse",
                icon: <Radio className="w-6 h-6" />,
              },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
