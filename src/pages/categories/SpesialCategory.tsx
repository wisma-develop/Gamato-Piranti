import { Award, MessageCircle, Receipt, FileSpreadsheet, ShoppingBag, IdCard, FileText, TicketPercent, MailOpen, Tag } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { CategoryGrid } from "@/components/CategoryGrid";
import { tr } from "@/i18n";

export default function SpesialCategory() {
  return (
    <PageShell
      badge={tr("Spesial")}
      title={tr("Spesial")}
      subtitle={tr("Fitur andalan Gamato Piranti — dokumen bisnis profesional, generator sertifikat massal, pembuat CV, dan WA link.")}
    >
      <CategoryGrid
        groups={[
          {
            section: tr("Dokumen Bisnis"),
            items: [
              { name: tr("Kwitansi"), desc: tr("Kwitansi pembayaran profesional dengan logo custom — export PNG & PDF, siap cetak."), path: "/special/kwitansi", icon: <Receipt className="w-6 h-6" /> },
              { name: tr("Invoice"), desc: tr("Invoice profesional dengan item dinamis, logo custom, diskon & pajak — export PNG & PDF."), path: "/special/invoice", icon: <FileSpreadsheet className="w-6 h-6" /> },
              { name: tr("Struk / Nota"), desc: tr("Struk kasir custom dengan logo — export PNG & PDF, cetak langsung ke printer USB/Bluetooth."), path: "/special/struk", icon: <ShoppingBag className="w-6 h-6" /> },
              { name: tr("Kartu Nama"), desc: tr("Studio desain full custom: template siap pakai, latar & elemen bebas, ukuran & sisi depan-belakang — export PNG & PDF, siap cetak."), path: "/special/kartu-nama", icon: <IdCard className="w-6 h-6" /> },
              { name: tr("Name Tag"), desc: tr("Name tag, badge acara & ID card full custom: warna otomatis per peran, foto, QR/barcode, lubang tali, meja nama lipat — massal dari CSV/XLSX, ZIP & lembar cetak."), path: "/special/name-tag", icon: <Tag className="w-6 h-6" /> },
              { name: tr("Kupon, Voucher & Tiket"), desc: tr("Generator kupon, voucher, tiket event & gift card — kode unik, QR/barcode, tepi sobek, massal hingga 1.000 lembar, ZIP & lembar cetak."), path: "/special/kupon", icon: <TicketPercent className="w-6 h-6" /> },
              { name: tr("Pembuat Surat"), desc: tr("17 template surat (dinas, bisnis, lamaran, kuasa, perjanjian…), kop kustom, nomor otomatis, tanda tangan & materai, surat massal, ekspor PDF & Word."), path: "/special/surat", icon: <MailOpen className="w-6 h-6" /> },
            ],
          },
          {
            section: tr("Lainnya"),
            items: [
              { name: tr("Pembuat CV"), desc: tr("Buat CV/resume profesional dengan 8 template, susunan & judul bagian yang bisa diatur, foto, auto-muat 1 halaman — ekspor PDF (teks bisa dipilih/ATS), DOCX, dan PNG tajam."), path: "/special/pembuat-cv", icon: <FileText className="w-6 h-6" /> },
              { name: tr("Sertifikat & Piagam"), desc: tr("Generator massal, full custom — template, font, dan posisi bebas."), path: "/special/sertifikat", icon: <Award className="w-6 h-6" /> },
              { name: tr("WA Link"), desc: tr("Buka chat WhatsApp langsung tanpa perlu menyimpan kontak."), path: "/special/wa-link", icon: <MessageCircle className="w-6 h-6" /> },
            ],
          },
        ]}
      />
    </PageShell>
  );
}
