import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  MessageCircle, Copy, Sparkles, ShoppingBag, Wallet, Truck, BellRing,
  HeartHandshake, Briefcase, PartyPopper, Check,
} from "lucide-react";
import { sanitizeText, sanitizePhone } from "@/utils/sanitize";
import { Label, Input, Textarea, Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";
import { useDialog, type DialogField } from "@/hooks/useDialog";
import { cn } from "@/utils/cn";
import { GamatoInlineAlert } from "@/components/ui/GamatoInlineAlert";

// ─── Template definitions ─────────────────────────────────────────────────
// Each template opens a custom Gamato Piranti form dialog (instead of the
// browser's native prompt()) asking only for the fields it actually needs,
// then composes the WhatsApp message text from the sanitized answers.

interface WaTemplate {
  id: string;
  label: string;
  fields: DialogField[];
  build: (v: Record<string, string>) => string;
}

interface WaTemplateGroup {
  id: string;
  label: string;
  icon: ReactNode;
  templates: WaTemplate[];
}

const clean = (v: string | undefined) => sanitizeText(v ?? "").trim();

const TEMPLATE_GROUPS: WaTemplateGroup[] = [
  {
    id: "perkenalan",
    label: "Perkenalan",
    icon: <Sparkles className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "salam",
        label: "Salam Pembuka",
        fields: [{ key: "nama", label: "Nama Penerima", placeholder: "mis. Budi (opsional)" }],
        build: (v) => {
          const nama = clean(v.nama);
          return (nama ? `Halo ${nama}, ` : "Halo, ") + "apa kabar? Saya ingin menghubungi terkait sesuatu.";
        },
      },
      {
        id: "perkenalan-bisnis",
        label: "Perkenalan Bisnis",
        fields: [
          { key: "nama", label: "Nama Penerima", placeholder: "mis. Budi (opsional)" },
          { key: "namaBisnis", label: "Nama Usaha/Bisnis", placeholder: "mis. Gamato Store", required: true },
          { key: "layanan", label: "Produk/Layanan Utama", placeholder: "mis. jasa desain grafis", required: true },
        ],
        build: (v) => {
          const nama = clean(v.nama);
          return `${nama ? `Halo ${nama}, ` : "Halo, "}perkenalkan saya dari ${clean(v.namaBisnis)}. Kami menyediakan ${clean(v.layanan)}. Semoga bisa membantu kebutuhan Anda.`;
        },
      },
    ],
  },
  {
    id: "penjualan",
    label: "Penjualan",
    icon: <ShoppingBag className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "follow-up",
        label: "Follow-up Order",
        fields: [
          { key: "invoice", label: "Nomor Invoice/Order", placeholder: "mis. INV-0012", required: true },
          { key: "jumlah", label: "Jumlah Tagihan", placeholder: "mis. Rp250.000 (opsional)" },
        ],
        build: (v) => {
          const amt = clean(v.jumlah);
          return `Halo, ini tindak lanjut terkait invoice ${clean(v.invoice)}. ${amt ? `Total ${amt}. ` : ""}Mohon konfirmasi penerimaan atau bila ada pertanyaan.`;
        },
      },
      {
        id: "penawaran",
        label: "Penawaran Produk",
        fields: [
          { key: "nama", label: "Nama Penerima", placeholder: "mis. Budi (opsional)" },
          { key: "produk", label: "Nama Produk/Jasa", placeholder: "mis. Paket Desain Logo", required: true },
          { key: "harga", label: "Harga Penawaran", placeholder: "mis. Rp150.000", required: true },
        ],
        build: (v) => {
          const nama = clean(v.nama);
          return `${nama ? `Halo ${nama}, ` : "Halo, "}kami ingin menawarkan ${clean(v.produk)} dengan harga spesial ${clean(v.harga)}. Tertarik untuk info lebih lanjut?`;
        },
      },
      {
        id: "cart-reminder",
        label: "Pengingat Keranjang",
        fields: [
          { key: "nama", label: "Nama Penerima", placeholder: "mis. Budi (opsional)" },
          { key: "produk", label: "Produk yang Diminati", placeholder: "mis. Sepatu Lari X1", required: true },
        ],
        build: (v) => {
          const nama = clean(v.nama);
          return `${nama ? `Halo ${nama}, ` : "Halo, "}kami lihat Anda sempat tertarik dengan ${clean(v.produk)}. Masih berminat? Kami bantu proses pemesanannya ya.`;
        },
      },
    ],
  },
  {
    id: "pembayaran",
    label: "Pembayaran",
    icon: <Wallet className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "konfirmasi-bayar",
        label: "Konfirmasi Bayar",
        fields: [{ key: "invoice", label: "Nomor Invoice/Kode", placeholder: "mis. INV-0012", required: true }],
        build: (v) => `Halo, pembayaran untuk ${clean(v.invoice)} telah kami terima. Terima kasih! Jika ada yang perlu dibantu lagi, kabari ya.`,
      },
      {
        id: "jatuh-tempo",
        label: "Invoice Jatuh Tempo",
        fields: [
          { key: "invoice", label: "Nomor Invoice", placeholder: "mis. INV-0012", required: true },
          { key: "tanggal", label: "Tanggal Jatuh Tempo", placeholder: "mis. 20 Maret 2026", required: true },
          { key: "jumlah", label: "Jumlah Tagihan", placeholder: "mis. Rp500.000 (opsional)" },
        ],
        build: (v) => {
          const amt = clean(v.jumlah);
          return `Halo, invoice ${clean(v.invoice)} akan jatuh tempo pada ${clean(v.tanggal)}. ${amt ? `Jumlah tagihan ${amt}. ` : ""}Mohon segera diselesaikan sebelum tanggal tersebut. Terima kasih.`;
        },
      },
      {
        id: "pengingat-bayar",
        label: "Pengingat Belum Bayar",
        fields: [
          { key: "invoice", label: "Nomor Invoice", placeholder: "mis. INV-0012", required: true },
          { key: "batas", label: "Batas Waktu Baru", placeholder: "mis. 25 Maret 2026 (opsional)" },
        ],
        build: (v) => {
          const batas = clean(v.batas);
          return `Halo, kami belum menerima pembayaran untuk invoice ${clean(v.invoice)}. ${batas ? `Mohon diselesaikan sebelum ${batas}. ` : ""}Terima kasih atas perhatiannya.`;
        },
      },
    ],
  },
  {
    id: "pengiriman",
    label: "Pengiriman",
    icon: <Truck className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "kirim-alamat",
        label: "Kirim Alamat",
        fields: [
          { key: "alamat", label: "Alamat/Tautan Lokasi", placeholder: "mis. Jl. Merdeka No. 10, Denpasar", required: true },
          { key: "waktu", label: "Estimasi Waktu Tempuh", placeholder: "mis. 15 menit (opsional)" },
        ],
        build: (v) => {
          const time = clean(v.waktu);
          return `Halo, berikut alamat/lokasi tujuan: ${clean(v.alamat)}. ${time ? `Estimasi waktu: ${time}. ` : ""}Terima kasih.`;
        },
      },
      {
        id: "info-resi",
        label: "Info Resi Pengiriman",
        fields: [
          { key: "kurir", label: "Nama Kurir/Ekspedisi", placeholder: "mis. JNE / SiCepat", required: true },
          { key: "resi", label: "Nomor Resi", placeholder: "mis. JX123456789ID", required: true },
          { key: "estimasi", label: "Estimasi Tiba", placeholder: "mis. 2-3 hari kerja (opsional)" },
        ],
        build: (v) => {
          const est = clean(v.estimasi);
          return `Halo, pesanan Anda sudah dikirim via ${clean(v.kurir)} dengan nomor resi ${clean(v.resi)}. ${est ? `Estimasi tiba: ${est}. ` : ""}Terima kasih telah berbelanja.`;
        },
      },
    ],
  },
  {
    id: "reminder",
    label: "Reminder",
    icon: <BellRing className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "reminder-janji",
        label: "Reminder Janji Temu",
        fields: [
          { key: "tanggal", label: "Tanggal", placeholder: "mis. 12/03/2026", required: true },
          { key: "jam", label: "Jam", placeholder: "mis. 14:00 (opsional)" },
          { key: "topik", label: "Topik/Agenda", placeholder: "mis. diskusi kontrak (opsional)" },
        ],
        build: (v) => {
          const jam = clean(v.jam), topik = clean(v.topik);
          return `Halo, mengingatkan jadwal pada ${clean(v.tanggal)}${jam ? ` pukul ${jam}` : ""}${topik ? ` untuk ${topik}` : ""}. Terima kasih.`;
        },
      },
      {
        id: "reminder-meeting",
        label: "Reminder Meeting Online",
        fields: [
          { key: "tanggal", label: "Tanggal", placeholder: "mis. 12/03/2026", required: true },
          { key: "jam", label: "Jam", placeholder: "mis. 09:30", required: true },
          { key: "link", label: "Link Meeting", placeholder: "mis. https://meet.google.com/xxx (opsional)" },
        ],
        build: (v) => {
          const link = clean(v.link);
          return `Halo, mengingatkan meeting online pada ${clean(v.tanggal)} pukul ${clean(v.jam)}. ${link ? `Link: ${link}. ` : ""}Sampai jumpa di sana!`;
        },
      },
      {
        id: "reminder-deadline",
        label: "Reminder Deadline",
        fields: [
          { key: "tugas", label: "Nama Tugas/Proyek", placeholder: "mis. Revisi Desain Banner", required: true },
          { key: "tenggat", label: "Batas Waktu", placeholder: "mis. besok pukul 17.00", required: true },
        ],
        build: (v) => `Halo, mengingatkan tenggat waktu untuk ${clean(v.tugas)} adalah ${clean(v.tenggat)}. Mohon dikirim tepat waktu ya, terima kasih.`,
      },
    ],
  },
  {
    id: "layanan",
    label: "Layanan Pelanggan",
    icon: <HeartHandshake className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "terima-kasih",
        label: "Ucapan Terima Kasih",
        fields: [{ key: "nama", label: "Nama Penerima", placeholder: "mis. Budi (opsional)" }],
        build: (v) => {
          const nama = clean(v.nama);
          return `${nama ? `Halo ${nama}, ` : "Halo, "}terima kasih banyak atas kepercayaan dan dukungan Anda. Kami sangat menghargainya!`;
        },
      },
      {
        id: "tanggapan-komplain",
        label: "Tanggapan Komplain",
        fields: [
          { key: "nama", label: "Nama Penerima", placeholder: "mis. Budi (opsional)" },
          { key: "masalah", label: "Ringkasan Kendala", placeholder: "mis. keterlambatan pengiriman", required: true },
        ],
        build: (v) => {
          const nama = clean(v.nama);
          return `${nama ? `Halo ${nama}, ` : "Halo, "}mohon maaf atas ketidaknyamanan terkait ${clean(v.masalah)}. Tim kami akan segera menindaklanjuti dan menghubungi Anda kembali.`;
        },
      },
      {
        id: "minta-feedback",
        label: "Minta Feedback Layanan",
        fields: [{ key: "nama", label: "Nama Penerima", placeholder: "mis. Budi (opsional)" }],
        build: (v) => {
          const nama = clean(v.nama);
          return `${nama ? `Halo ${nama}, ` : "Halo, "}terima kasih sudah menggunakan layanan kami. Bagaimana pengalaman Anda? Kami sangat terbuka untuk masukan.`;
        },
      },
    ],
  },
  {
    id: "formal",
    label: "Formal & Lamaran",
    icon: <Briefcase className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "lamaran-kerja",
        label: "Lamaran Kerja",
        fields: [
          { key: "nama", label: "Nama Lengkap", placeholder: "mis. Budi Santoso", required: true },
          { key: "posisi", label: "Posisi yang Dilamar", placeholder: "mis. Staff Admin", required: true },
          { key: "perusahaan", label: "Nama Perusahaan", placeholder: "mis. PT Gamato Sejahtera", required: true },
        ],
        build: (v) => `Selamat siang, perkenalkan saya ${clean(v.nama)}. Saya bermaksud melamar posisi ${clean(v.posisi)} di ${clean(v.perusahaan)}. CV dan portofolio terlampir untuk dipertimbangkan. Terima kasih.`,
      },
      {
        id: "konfirmasi-interview",
        label: "Konfirmasi Interview",
        fields: [
          { key: "nama", label: "Nama Kandidat", placeholder: "mis. Budi Santoso", required: true },
          { key: "tanggal", label: "Tanggal Interview", placeholder: "mis. 15 Maret 2026", required: true },
          { key: "jam", label: "Jam", placeholder: "mis. 10:00", required: true },
          { key: "lokasi", label: "Lokasi/Link", placeholder: "mis. Kantor Pusat / Google Meet (opsional)" },
        ],
        build: (v) => {
          const lokasi = clean(v.lokasi);
          return `Halo ${clean(v.nama)}, kami mengundang Anda untuk interview pada ${clean(v.tanggal)} pukul ${clean(v.jam)}${lokasi ? ` di ${lokasi}` : ""}. Mohon konfirmasi kehadiran Anda. Terima kasih.`;
        },
      },
    ],
  },
  {
    id: "ucapan",
    label: "Undangan & Ucapan",
    icon: <PartyPopper className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "undangan-acara",
        label: "Undangan Acara",
        fields: [
          { key: "acara", label: "Nama Acara", placeholder: "mis. Grand Opening Toko", required: true },
          { key: "tanggal", label: "Tanggal", placeholder: "mis. 20 Maret 2026", required: true },
          { key: "lokasi", label: "Lokasi", placeholder: "mis. Jl. Merdeka No. 10 (opsional)" },
        ],
        build: (v) => {
          const lokasi = clean(v.lokasi);
          return `Halo, kami mengundang Anda untuk hadir pada acara ${clean(v.acara)} yang akan diselenggarakan pada ${clean(v.tanggal)}${lokasi ? ` di ${lokasi}` : ""}. Kehadiran Anda sangat berarti bagi kami.`;
        },
      },
      {
        id: "ucapan-selamat",
        label: "Ucapan Selamat",
        fields: [
          { key: "nama", label: "Nama Penerima", placeholder: "mis. Budi", required: true },
          { key: "momen", label: "Momen/Perayaan", placeholder: "mis. ulang tahun, kelulusan", required: true },
        ],
        build: (v) => `Selamat ${clean(v.momen)}, ${clean(v.nama)}! Semoga selalu diberikan kebahagiaan dan kesuksesan.`,
      },
    ],
  },
];

export function WaLink() {
  const dialog = useDialog();
  const [activeGroup, setActiveGroup] = useState<string>(TEMPLATE_GROUPS[0].id);
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [waLink, setWaLink] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [lastTemplateId, setLastTemplateId] = useState<string | null>(null);

  const currentGroup = useMemo(
    () => TEMPLATE_GROUPS.find((g) => g.id === activeGroup) ?? TEMPLATE_GROUPS[0],
    [activeGroup]
  );

  const runTemplate = async (tpl: WaTemplate) => {
    if (tpl.fields.length === 0) {
      setWaMessage(tpl.build({}));
      setLastTemplateId(tpl.id);
      return;
    }
    const values = await dialog.form({
      title: tpl.label,
      description: "Isi data berikut untuk menyusun pesan otomatis.",
      icon: <MessageCircle className="w-5 h-5" />,
      submitLabel: "Terapkan ke Pesan",
      fields: tpl.fields,
    });
    if (values === null) return; // dibatalkan pengguna
    setWaMessage(tpl.build(values));
    setLastTemplateId(tpl.id);
    setInfo(null);
  };

  const buildWa = async () => {
    const phone = sanitizePhone(waPhone);
    const msg = sanitizeText(waMessage);
    if (!phone) {
      setWaLink("");
      setInfo("Isi nomor telepon terlebih dahulu.");
      await dialog.alert({
        title: "Nomor belum diisi",
        message: "Masukkan nomor telepon tujuan (dengan kode negara) sebelum membuat link WhatsApp.",
        tone: "warning",
      });
      return;
    }
    setWaLink(`https://wa.me/${phone.replace(/^\+/, "")}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`);
    setInfo(null);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(waLink);
      setInfo("Link disalin!");
    } catch {
      setInfo("Gagal menyalin.");
      await dialog.alert({
        title: "Gagal menyalin",
        message: "Browser menolak akses clipboard. Salin link secara manual dari kotak di bawah.",
        tone: "danger",
      });
    }
  };

  return (
    <PanelCard title="WhatsApp Direct Link" subtitle="Buka chat WA langsung tanpa perlu menyimpan kontak">
      <div className="space-y-5">
        <Input
          label="Nomor Telepon (dengan kode negara)"
          value={waPhone}
          onChange={(e) => setWaPhone(sanitizePhone(e.target.value))}
          placeholder="+62812xxxxxxx"
        />

        {/* Template group tabs */}
        <div>
          <Label>Template Pesan Cepat</Label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {TEMPLATE_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGroup(g.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                  activeGroup === g.id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                )}
              >
                {g.icon}
                <span>{g.label}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {currentGroup.templates.map((tpl) => (
              <Btn
                key={tpl.id}
                type="button"
                onClick={() => runTemplate(tpl)}
                variant="secondary"
                className="text-xs py-1.5 gap-1.5"
              >
                {lastTemplateId === tpl.id && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                {tpl.label}
              </Btn>
            ))}
          </div>
        </div>

        <Textarea
          label="Pesan (opsional)"
          rows={4}
          value={waMessage}
          onChange={(e) => setWaMessage(sanitizeText(e.target.value))}
          placeholder="Tulis pesan Anda di sini, atau gunakan template di atas…"
        />
        <div className="flex gap-3">
          <Btn onClick={buildWa} className="flex-1 gap-2">
            <MessageCircle className="w-4 h-4" />Buat Link WA
          </Btn>
          {waLink && (
            <Btn onClick={copyLink} variant="secondary" className="flex-1 gap-2">
              <Copy className="w-4 h-4" />Salin Link
            </Btn>
          )}
        </div>
        {info && <GamatoInlineAlert message={info} tone={info.startsWith("Isi") || info.startsWith("Gagal") ? "warning" : "success"} />}
        {waLink && (
          <div className="space-y-2">
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200 break-all">
              {waLink}
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl py-3 font-semibold hover:bg-green-600 transition-colors"
            >
              <MessageCircle className="w-4 h-4" /> Buka di WhatsApp
            </a>
          </div>
        )}
      </div>
    </PanelCard>
  );
}
