import { Link } from 'react-router-dom';
import { Heart, ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center space-x-2.5">
              <div className="rounded-lg overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700">
                <img src="/gamato-piranti.png" alt="Gamato Piranti" className="w-8 h-8 object-cover" />
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-white">Gamato Piranti</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs">
              Suite alat digital modern. QR code, PDF, gambar, dokumen — semuanya diproses langsung di perangkatmu. Aman, cepat, gratis.
            </p>
            <div className="inline-flex items-center space-x-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full text-xs font-semibold border border-indigo-100 dark:border-indigo-500/20">
              <ShieldCheck className="w-3 h-3" />
              <span>Privasi Terjaga · Gratis</span>
            </div>
          </div>

          {/* Tools */}
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">Alat</h3>
            <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
              <li><Link to="/qr/qr-code" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">QR & Barcode Studio</Link></li>
              <li><Link to="/pdf/gabung" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">PDF Lab – Suite</Link></li>
              <li><Link to="/docs" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Doc Studio</Link></li>
              <li><Link to="/image/kompres" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Image Lab</Link></li>
              <li><Link to="/utility/json-base64" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Rak Utilitas</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">Informasi</h3>
            <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
              <li><Link to="/about" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Tentang Kami</Link></li>
              <li><Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Kebijakan Privasi</Link></li>
              <li><Link to="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Ketentuan Layanan</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-100 dark:border-slate-800 mt-10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400 dark:text-slate-500">
          <p>© {new Date().getFullYear()} Gamato Piranti. Dibuat dengan <Heart className="w-3 h-3 inline text-red-400" /> untuk produktivitas.</p>
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
            <span>Dikembangkan oleh</span>
            <span className="text-slate-600 dark:text-slate-300 font-bold">WisDev</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Kebijakan Privasi</Link>
            <span className="text-slate-200 dark:text-slate-700">•</span>
            <Link to="/terms" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Ketentuan Layanan</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
