import { QrCode, Barcode } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";

export default function KodeCategory() {
  return (
    <PageShell
      badge="Kode"
      title="Kode"
      subtitle="Buat QR code full custom atau barcode multi-format — pilih alat yang kamu butuhkan di bawah ini."
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
            ],
          },
        ]}
      />
    </PageShell>
  );
}
