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
import { copyText } from "@/lib/permissions";
import { msgStarts, tr } from "@/i18n";

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
    label: tr("Perkenalan"),
    icon: <Sparkles className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "salam",
        label: tr("Salam Pembuka"),
        fields: [{ key: "nama", label: tr("Nama Penerima"), placeholder: tr("mis. Budi (opsional)") }],
        build: (v) => {
          const nama = clean(v.nama);
          return (nama ? `Halo ${nama}, ` : tr("Halo, ")) + tr("apa kabar? Saya ingin menghubungi terkait sesuatu.");
        },
      },
      {
        id: "perkenalan-bisnis",
        label: tr("Perkenalan Bisnis"),
        fields: [
          { key: "nama", label: tr("Nama Penerima"), placeholder: tr("mis. Budi (opsional)") },
          { key: "namaBisnis", label: tr("Nama Usaha/Bisnis"), placeholder: tr("mis. Gamato Store"), required: true },
          { key: "layanan", label: tr("Produk/Layanan Utama"), placeholder: tr("mis. jasa desain grafis"), required: true },
        ],
        build: (v) => {
          const nama = clean(v.nama);
          return tr("{0}perkenalkan saya dari {1}. Kami menyediakan {2}. Semoga bisa membantu kebutuhan Anda.", nama ? `Halo ${nama}, ` : tr("Halo, "), clean(v.namaBisnis), clean(v.layanan));
        },
      },
    ],
  },
  {
    id: "penjualan",
    label: tr("Penjualan"),
    icon: <ShoppingBag className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "follow-up",
        label: tr("Follow-up Order"),
        fields: [
          { key: "invoice", label: tr("Nomor Invoice/Order"), placeholder: tr("mis. INV-0012"), required: true },
          { key: "jumlah", label: tr("Jumlah Tagihan"), placeholder: tr("mis. Rp250.000 (opsional)") },
        ],
        build: (v) => {
          const amt = clean(v.jumlah);
          return tr("Halo, ini tindak lanjut terkait invoice {0}. {1}Mohon konfirmasi penerimaan atau bila ada pertanyaan.", clean(v.invoice), amt ? tr("Total {0}. ", amt) : "");
        },
      },
      {
        id: "penawaran",
        label: tr("Penawaran Produk"),
        fields: [
          { key: "nama", label: tr("Nama Penerima"), placeholder: tr("mis. Budi (opsional)") },
          { key: "produk", label: tr("Nama Produk/Jasa"), placeholder: tr("mis. Paket Desain Logo"), required: true },
          { key: "harga", label: tr("Harga Penawaran"), placeholder: tr("mis. Rp150.000"), required: true },
        ],
        build: (v) => {
          const nama = clean(v.nama);
          return tr("{0}kami ingin menawarkan {1} dengan harga spesial {2}. Tertarik untuk info lebih lanjut?", nama ? `Halo ${nama}, ` : tr("Halo, "), clean(v.produk), clean(v.harga));
        },
      },
      {
        id: "cart-reminder",
        label: tr("Pengingat Keranjang"),
        fields: [
          { key: "nama", label: tr("Nama Penerima"), placeholder: tr("mis. Budi (opsional)") },
          { key: "produk", label: tr("Produk yang Diminati"), placeholder: tr("mis. Sepatu Lari X1"), required: true },
        ],
        build: (v) => {
          const nama = clean(v.nama);
          return tr("{0}kami lihat Anda sempat tertarik dengan {1}. Masih berminat? Kami bantu proses pemesanannya ya.", nama ? `Halo ${nama}, ` : tr("Halo, "), clean(v.produk));
        },
      },
    ],
  },
  {
    id: "pembayaran",
    label: tr("Pembayaran"),
    icon: <Wallet className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "konfirmasi-bayar",
        label: tr("Konfirmasi Bayar"),
        fields: [{ key: "invoice", label: tr("Nomor Invoice/Kode"), placeholder: tr("mis. INV-0012"), required: true }],
        build: (v) => tr("Halo, pembayaran untuk {0} telah kami terima. Terima kasih! Jika ada yang perlu dibantu lagi, kabari ya.", clean(v.invoice)),
      },
      {
        id: "jatuh-tempo",
        label: tr("Invoice Jatuh Tempo"),
        fields: [
          { key: "invoice", label: tr("Nomor Invoice"), placeholder: tr("mis. INV-0012"), required: true },
          { key: "tanggal", label: tr("Tanggal Jatuh Tempo"), placeholder: tr("mis. 20 Maret 2026"), required: true },
          { key: "jumlah", label: tr("Jumlah Tagihan"), placeholder: tr("mis. Rp500.000 (opsional)") },
        ],
        build: (v) => {
          const amt = clean(v.jumlah);
          return tr("Halo, invoice {0} akan jatuh tempo pada {1}. {2}Mohon segera diselesaikan sebelum tanggal tersebut. Terima kasih.", clean(v.invoice), clean(v.tanggal), amt ? tr("Jumlah tagihan {0}. ", amt) : "");
        },
      },
      {
        id: "pengingat-bayar",
        label: tr("Pengingat Belum Bayar"),
        fields: [
          { key: "invoice", label: tr("Nomor Invoice"), placeholder: tr("mis. INV-0012"), required: true },
          { key: "batas", label: tr("Batas Waktu Baru"), placeholder: tr("mis. 25 Maret 2026 (opsional)") },
        ],
        build: (v) => {
          const batas = clean(v.batas);
          return tr("Halo, kami belum menerima pembayaran untuk invoice {0}. {1}Terima kasih atas perhatiannya.", clean(v.invoice), batas ? tr("Mohon diselesaikan sebelum {0}. ", batas) : "");
        },
      },
    ],
  },
  {
    id: "pengiriman",
    label: tr("Pengiriman"),
    icon: <Truck className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "kirim-alamat",
        label: tr("Kirim Alamat"),
        fields: [
          { key: "alamat", label: tr("Alamat/Tautan Lokasi"), placeholder: tr("mis. Jl. Merdeka No. 10, Denpasar"), required: true },
          { key: "waktu", label: tr("Estimasi Waktu Tempuh"), placeholder: tr("mis. 15 menit (opsional)") },
        ],
        build: (v) => {
          const time = clean(v.waktu);
          return tr("Halo, berikut alamat/lokasi tujuan: {0}. {1}Terima kasih.", clean(v.alamat), time ? tr("Estimasi waktu: {0}. ", time) : "");
        },
      },
      {
        id: "info-resi",
        label: tr("Info Resi Pengiriman"),
        fields: [
          { key: "kurir", label: tr("Nama Kurir/Ekspedisi"), placeholder: tr("mis. JNE / SiCepat"), required: true },
          { key: "resi", label: tr("Nomor Resi"), placeholder: tr("mis. JX123456789ID"), required: true },
          { key: "estimasi", label: tr("Estimasi Tiba"), placeholder: tr("mis. 2-3 hari kerja (opsional)") },
        ],
        build: (v) => {
          const est = clean(v.estimasi);
          return tr("Halo, pesanan Anda sudah dikirim via {0} dengan nomor resi {1}. {2}Terima kasih telah berbelanja.", clean(v.kurir), clean(v.resi), est ? tr("Estimasi tiba: {0}. ", est) : "");
        },
      },
    ],
  },
  {
    id: "reminder",
    label: tr("Reminder"),
    icon: <BellRing className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "reminder-janji",
        label: tr("Reminder Janji Temu"),
        fields: [
          { key: "tanggal", label: tr("Tanggal"), placeholder: tr("mis. 12/03/2026"), required: true },
          { key: "jam", label: tr("Jam"), placeholder: tr("mis. 14:00 (opsional)") },
          { key: "topik", label: tr("Topik/Agenda"), placeholder: tr("mis. diskusi kontrak (opsional)") },
        ],
        build: (v) => {
          const jam = clean(v.jam), topik = clean(v.topik);
          return tr("Halo, mengingatkan jadwal pada {0}{1}{2}. Terima kasih.", clean(v.tanggal), jam ? ` pukul ${jam}` : "", topik ? ` untuk ${topik}` : "");
        },
      },
      {
        id: "reminder-meeting",
        label: tr("Reminder Meeting Online"),
        fields: [
          { key: "tanggal", label: tr("Tanggal"), placeholder: tr("mis. 12/03/2026"), required: true },
          { key: "jam", label: tr("Jam"), placeholder: tr("mis. 09:30"), required: true },
          { key: "link", label: tr("Link Meeting"), placeholder: tr("mis. https://meet.google.com/xxx (opsional)") },
        ],
        build: (v) => {
          const link = clean(v.link);
          return tr("Halo, mengingatkan meeting online pada {0} pukul {1}. {2}Sampai jumpa di sana!", clean(v.tanggal), clean(v.jam), link ? tr("Link: {0}. ", link) : "");
        },
      },
      {
        id: "reminder-deadline",
        label: tr("Reminder Deadline"),
        fields: [
          { key: "tugas", label: tr("Nama Tugas/Proyek"), placeholder: tr("mis. Revisi Desain Banner"), required: true },
          { key: "tenggat", label: tr("Batas Waktu"), placeholder: tr("mis. besok pukul 17.00"), required: true },
        ],
        build: (v) => tr("Halo, mengingatkan tenggat waktu untuk {0} adalah {1}. Mohon dikirim tepat waktu ya, terima kasih.", clean(v.tugas), clean(v.tenggat)),
      },
    ],
  },
  {
    id: "layanan",
    label: tr("Layanan Pelanggan"),
    icon: <HeartHandshake className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "terima-kasih",
        label: tr("Ucapan Terima Kasih"),
        fields: [{ key: "nama", label: tr("Nama Penerima"), placeholder: tr("mis. Budi (opsional)") }],
        build: (v) => {
          const nama = clean(v.nama);
          return tr("{0}terima kasih banyak atas kepercayaan dan dukungan Anda. Kami sangat menghargainya!", nama ? `Halo ${nama}, ` : tr("Halo, "));
        },
      },
      {
        id: "tanggapan-komplain",
        label: tr("Tanggapan Komplain"),
        fields: [
          { key: "nama", label: tr("Nama Penerima"), placeholder: tr("mis. Budi (opsional)") },
          { key: "masalah", label: tr("Ringkasan Kendala"), placeholder: tr("mis. keterlambatan pengiriman"), required: true },
        ],
        build: (v) => {
          const nama = clean(v.nama);
          return tr("{0}mohon maaf atas ketidaknyamanan terkait {1}. Tim kami akan segera menindaklanjuti dan menghubungi Anda kembali.", nama ? `Halo ${nama}, ` : tr("Halo, "), clean(v.masalah));
        },
      },
      {
        id: "minta-feedback",
        label: tr("Minta Feedback Layanan"),
        fields: [{ key: "nama", label: tr("Nama Penerima"), placeholder: tr("mis. Budi (opsional)") }],
        build: (v) => {
          const nama = clean(v.nama);
          return tr("{0}terima kasih sudah menggunakan layanan kami. Bagaimana pengalaman Anda? Kami sangat terbuka untuk masukan.", nama ? `Halo ${nama}, ` : tr("Halo, "));
        },
      },
    ],
  },
  {
    id: "formal",
    label: tr("Formal & Lamaran"),
    icon: <Briefcase className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "lamaran-kerja",
        label: tr("Lamaran Kerja"),
        fields: [
          { key: "nama", label: tr("Nama Lengkap"), placeholder: tr("mis. Budi Santoso"), required: true },
          { key: "posisi", label: tr("Posisi yang Dilamar"), placeholder: tr("mis. Staff Admin"), required: true },
          { key: "perusahaan", label: tr("Nama Perusahaan"), placeholder: tr("mis. PT Gamato Sejahtera"), required: true },
        ],
        build: (v) => tr("Selamat siang, perkenalkan saya {0}. Saya bermaksud melamar posisi {1} di {2}. CV dan portofolio terlampir untuk dipertimbangkan. Terima kasih.", clean(v.nama), clean(v.posisi), clean(v.perusahaan)),
      },
      {
        id: "konfirmasi-interview",
        label: tr("Konfirmasi Interview"),
        fields: [
          { key: "nama", label: tr("Nama Kandidat"), placeholder: tr("mis. Budi Santoso"), required: true },
          { key: "tanggal", label: tr("Tanggal Interview"), placeholder: tr("mis. 15 Maret 2026"), required: true },
          { key: "jam", label: tr("Jam"), placeholder: tr("mis. 10:00"), required: true },
          { key: "lokasi", label: tr("Lokasi/Link"), placeholder: tr("mis. Kantor Pusat / Google Meet (opsional)") },
        ],
        build: (v) => {
          const lokasi = clean(v.lokasi);
          return tr("Halo {0}, kami mengundang Anda untuk interview pada {1} pukul {2}{3}. Mohon konfirmasi kehadiran Anda. Terima kasih.", clean(v.nama), clean(v.tanggal), clean(v.jam), lokasi ? ` di ${lokasi}` : "");
        },
      },
    ],
  },
  {
    id: "ucapan",
    label: tr("Undangan & Ucapan"),
    icon: <PartyPopper className="w-3.5 h-3.5" />,
    templates: [
      {
        id: "undangan-acara",
        label: tr("Undangan Acara"),
        fields: [
          { key: "acara", label: tr("Nama Acara"), placeholder: tr("mis. Grand Opening Toko"), required: true },
          { key: "tanggal", label: tr("Tanggal"), placeholder: tr("mis. 20 Maret 2026"), required: true },
          { key: "lokasi", label: tr("Lokasi"), placeholder: tr("mis. Jl. Merdeka No. 10 (opsional)") },
        ],
        build: (v) => {
          const lokasi = clean(v.lokasi);
          return tr("Halo, kami mengundang Anda untuk hadir pada acara {0} yang akan diselenggarakan pada {1}{2}. Kehadiran Anda sangat berarti bagi kami.", clean(v.acara), clean(v.tanggal), lokasi ? ` di ${lokasi}` : "");
        },
      },
      {
        id: "ucapan-selamat",
        label: tr("Ucapan Selamat"),
        fields: [
          { key: "nama", label: tr("Nama Penerima"), placeholder: tr("mis. Budi"), required: true },
          { key: "momen", label: tr("Momen/Perayaan"), placeholder: tr("mis. ulang tahun, kelulusan"), required: true },
        ],
        build: (v) => tr("Selamat {0}, {1}! Semoga selalu diberikan kebahagiaan dan kesuksesan.", clean(v.momen), clean(v.nama)),
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
      description: tr("Isi data berikut untuk menyusun pesan otomatis."),
      icon: <MessageCircle className="w-5 h-5" />,
      submitLabel: tr("Terapkan ke Pesan"),
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
      setInfo(tr("Isi nomor telepon terlebih dahulu."));
      await dialog.alert({
        title: tr("Nomor belum diisi"),
        message: tr("Masukkan nomor telepon tujuan (dengan kode negara) sebelum membuat link WhatsApp."),
        tone: "warning",
      });
      return;
    }
    setWaLink(`https://wa.me/${phone.replace(/^\+/, "")}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`);
    setInfo(null);
  };

  const copyLink = async () => {
    try {
      if (!(await copyText(waLink))) throw new Error("clipboard");
      setInfo(tr("Link disalin!"));
    } catch {
      setInfo(tr("Gagal menyalin."));
      await dialog.alert({
        title: tr("Gagal menyalin"),
        message: tr("Browser menolak akses clipboard. Salin link secara manual dari kotak di bawah."),
        tone: "danger",
      });
    }
  };

  return (
    <PanelCard title={tr("WhatsApp Direct Link")} subtitle={tr("Buka chat WA langsung tanpa perlu menyimpan kontak")}>
      <div className="space-y-5">
        <Input
          label={tr("Nomor Telepon (dengan kode negara)")}
          value={waPhone}
          onChange={(e) => setWaPhone(sanitizePhone(e.target.value))}
          placeholder="+62812xxxxxxx"
        />

        {/* Template group tabs */}
        <div>
          <Label>{tr("Template Pesan Cepat")}</Label>
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
          label={tr("Pesan (opsional)")}
          rows={4}
          value={waMessage}
          onChange={(e) => setWaMessage(sanitizeText(e.target.value))}
          placeholder={tr("Tulis pesan Anda di sini, atau gunakan template di atas…")}
        />
        <div className="flex gap-3">
          <Btn onClick={buildWa} className="flex-1 gap-2">
            <MessageCircle className="w-4 h-4" />{tr("Buat Link WA")}
          </Btn>
          {waLink && (
            <Btn onClick={copyLink} variant="secondary" className="flex-1 gap-2">
              <Copy className="w-4 h-4" />{tr("Salin Link")}
            </Btn>
          )}
        </div>
        {info && <GamatoInlineAlert message={info} tone={msgStarts(info, "Isi") || msgStarts(info, "Gagal") ? "warning" : "success"} />}
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
              <MessageCircle className="w-4 h-4" /> {tr("Buka di WhatsApp")}
            </a>
          </div>
        )}
      </div>
    </PanelCard>
  );
}
