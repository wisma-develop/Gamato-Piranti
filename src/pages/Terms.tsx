import { PolicySection } from "@/components/ui/PolicySection";

export default function Terms() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-3xl mx-auto space-y-5">
          <div className="text-center space-y-3 pb-2">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Kebijakan</span>
            <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
            <p className="text-slate-400 text-sm">Gamato Piranti · Terakhir diperbarui: 2 Maret 2026</p>
          </div>
          <PolicySection num="1" title="Penerimaan Ketentuan">
            <p>Dengan mengakses situs ini, Anda menerima syarat dan ketentuan ini secara penuh. Hentikan penggunaan jika Anda tidak setuju dengan ketentuan yang berlaku.</p>
          </PolicySection>
          <PolicySection num="2" title="Lisensi Penggunaan">
            <p className="mb-3">Anda diizinkan menggunakan alat untuk keperluan pribadi maupun komersial ringan. Namun, Anda dilarang:</p>
            <ul className="space-y-1.5">
              {["Menyalin atau memodifikasi materi tanpa izin.", "Menggunakan tools untuk tujuan ilegal.", "Merusak integritas infrastruktur layanan kami."].map(item => (
                <li key={item} className="flex items-start gap-2"><span className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" /><span>{item}</span></li>
              ))}
            </ul>
          </PolicySection>
          <PolicySection num="3" title="Batasan Tanggung Jawab">
            <p>Semua alat disediakan "sebagaimana adanya". Gamato Piranti tidak bertanggung jawab atas kerugian yang timbul dari penggunaan layanan kami.</p>
          </PolicySection>
          <PolicySection num="4" title="Perubahan Layanan">
            <p>Kami berhak menambah atau menghapus fitur tanpa pemberitahuan sebelumnya demi peningkatan kualitas layanan.</p>
          </PolicySection>
        </div>
    </div>
  );
}
