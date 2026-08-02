import { PolicySection } from "@/components/ui/PolicySection";

export default function Privacy() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-3xl mx-auto space-y-5">
          <div className="text-center space-y-3 pb-2">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Kebijakan</span>
            <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
            <p className="text-slate-400 text-sm">Gamato Piranti · Terakhir diperbarui: 2 Maret 2026</p>
          </div>
          <PolicySection num="1" title="Informasi yang Kami Kumpulkan">
            <p>Sebagai Digital Tool Studio, sebagian besar alat kami bekerja di sisi klien (browser). Kami tidak mengumpulkan data pribadi sensitif kecuali Anda memberikannya secara sukarela.</p>
          </PolicySection>
          <PolicySection num="2" title="Log Files & Analytics">
            <p>Kami menggunakan log standar untuk analisis performa web yang mencakup alamat IP, jenis browser, ISP, dan stempel waktu akses.</p>
          </PolicySection>
          <PolicySection num="3" title="Keamanan Data (WUG Secure Standard)">
            <p>Kami menerapkan sistem WUG Secure System untuk memastikan setiap input data diproses dengan enkripsi standar dan tidak disalahgunakan pihak ketiga.</p>
          </PolicySection>
          <PolicySection num="4" title="Kebijakan Pihak Ketiga">
            <p>Kebijakan Privasi ini tidak berlaku untuk situs atau layanan pihak ketiga. Kami menyarankan Anda membaca kebijakan masing-masing layanan yang Anda gunakan.</p>
          </PolicySection>
        </div>
    </div>
  );
}
