import { useState } from "react";
import { MessageCircle, Copy } from "lucide-react";
import { sanitizeText, sanitizePhone } from "@/utils/sanitize";
import { Label, Input, Textarea, Btn } from "@/components/ui/primitives";
import { PanelCard } from "@/components/ui/PanelCard";

const QUICK_TEMPLATES = [
  { label: "Salam", fn: (setMsg: (v: string) => void) => { const name = prompt("Nama penerima (opsional):") || ""; const safe = sanitizeText(name); setMsg((safe ? `Halo ${safe}, ` : "Halo, ") + "apa kabar? Saya ingin menghubungi terkait sesuatu."); } },
  { label: "Follow-up", fn: (setMsg: (v: string) => void) => { const inv = sanitizeText(prompt("Nomor invoice:") || ""); const amt = sanitizeText(prompt("Jumlah (opsional):") || ""); setMsg(`Halo, ini tindak lanjut terkait invoice ${inv}. ${amt ? `Total ${amt}. ` : ""}Mohon konfirmasi penerimaan atau bila ada pertanyaan.`); } },
  { label: "Konfirmasi Bayar", fn: (setMsg: (v: string) => void) => { const inv = sanitizeText(prompt("Nomor invoice/kode:") || ""); setMsg(`Halo, pembayaran untuk ${inv} telah kami terima. Terima kasih! Jika ada yang perlu dibantu lagi, kabari ya.`); } },
  { label: "Kirim Alamat", fn: (setMsg: (v: string) => void) => { const addr = sanitizeText(prompt("Alamat/tautan lokasi:") || ""); const time = sanitizeText(prompt("Estimasi waktu (opsional):") || ""); setMsg(`Halo, berikut alamat/lokasi tujuan: ${addr}. ${time ? `Estimasi waktu: ${time}. ` : ""}Terima kasih.`); } },
  { label: "Reminder", fn: (setMsg: (v: string) => void) => { const date = sanitizeText(prompt("Tanggal (mis. 12/03/2026):") || ""); const hour = sanitizeText(prompt("Jam (opsional):") || ""); const topic = sanitizeText(prompt("Topik/agenda (opsional):") || ""); setMsg(`Halo, mengingatkan jadwal pada ${date}${hour ? ` pukul ${hour}` : ""}${topic ? ` untuk ${topic}` : ""}. Terima kasih.`); } },
];

export function WaLink() {
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [waLink, setWaLink] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  const buildWa = () => {
    const phone = sanitizePhone(waPhone), msg = sanitizeText(waMessage);
    if (!phone) { setWaLink(""); setInfo("Isi nomor telepon terlebih dahulu."); return; }
    setWaLink(`https://wa.me/${phone.replace(/^\+/, "")}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`);
    setInfo(null);
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(waLink); setInfo("Link disalin!"); }
    catch { setInfo("Gagal menyalin."); }
  };

  return (
    <PanelCard title="WhatsApp Direct Link" subtitle="Buka chat WA langsung tanpa perlu menyimpan kontak">
      <div className="space-y-5">
        <div className="grid md:grid-cols-2 gap-5">
          <Input label="Nomor Telepon (dengan kode negara)" value={waPhone} onChange={e => setWaPhone(sanitizePhone(e.target.value))} placeholder="+62812xxxxxxx" />
          <div>
            <Label>Template Pesan Cepat</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {QUICK_TEMPLATES.map(t => (
                <Btn key={t.label} onClick={() => t.fn(setWaMessage)} variant="secondary" className="text-xs py-1.5">{t.label}</Btn>
              ))}
            </div>
          </div>
        </div>
        <Textarea label="Pesan (opsional)" rows={4} value={waMessage} onChange={e => setWaMessage(sanitizeText(e.target.value))} placeholder="Tulis pesan Anda di sini, atau gunakan template di atas…" />
        <div className="flex gap-3">
          <Btn onClick={buildWa} className="flex-1 gap-2"><MessageCircle className="w-4 h-4" />Buat Link WA</Btn>
          {waLink && <Btn onClick={copyLink} variant="secondary" className="flex-1 gap-2"><Copy className="w-4 h-4" />Salin Link</Btn>}
        </div>
        {info && <p className="text-xs text-slate-500 dark:text-slate-400">{info}</p>}
        {waLink && (
          <div className="space-y-2">
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200 break-all">{waLink}</div>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl py-3 font-semibold hover:bg-green-600 transition-colors">
              <MessageCircle className="w-4 h-4" /> Buka di WhatsApp
            </a>
          </div>
        )}
      </div>
    </PanelCard>
  );
}
