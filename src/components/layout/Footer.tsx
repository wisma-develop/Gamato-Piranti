import { SITE_HOST, SITE_URL } from "@/lib/site";
import { Link } from 'react-router-dom';
import { Heart, ShieldCheck } from 'lucide-react';
import { tr } from "@/i18n";

export default function Footer() {
  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">

          {/* Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center space-x-2.5">
              <div className="rounded-lg overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700">
                <img src="/gamato-piranti-128.webp" width={32} height={32} loading="lazy" alt={tr("Gamato Piranti")} className="w-8 h-8 object-cover" />
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-white">{tr("Gamato Piranti")}</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs">
              {tr("Suite alat digital modern. QR code, PDF, gambar, dokumen — semuanya diproses langsung di perangkatmu. Aman, cepat, gratis.")}
            </p>
            <div className="inline-flex items-center space-x-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full text-xs font-semibold border border-indigo-100 dark:border-indigo-500/20">
              <ShieldCheck className="w-3 h-3" />
              <span>{tr("Privasi Terjaga · Gratis")}</span>
            </div>
          </div>

          {/* Tools */}
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">{tr("Alat")}</h2>
            <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
              <li><Link to="/qr" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("QR & Barcode Studio")}</Link></li>
              <li><Link to="/pdf" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("PDF Lab – Suite")}</Link></li>
              <li><Link to="/office" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("Office Tools")}</Link></li>
              <li><Link to="/image" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("Image Lab")}</Link></li>
              <li><Link to="/video" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("Video Studio")}</Link></li>
              <li><Link to="/audio" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("Audio Studio")}</Link></li>
              <li><Link to="/utility" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("Rak Utilitas")}</Link></li>
              <li><Link to="/special" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("Spesial")}</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">{tr("Informasi")}</h2>
            <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
              <li><Link to="/about" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("Tentang Kami")}</Link></li>
              <li><Link to="/faq" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("FAQ")}</Link></li>
              <li><Link to="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("Kebijakan Privasi")}</Link></li>
              <li><Link to="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{tr("Ketentuan Layanan")}</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-100 dark:border-slate-800 mt-10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400 dark:text-slate-500">
          <p>© {new Date().getFullYear()} {tr("Gamato Piranti. Dibuat dengan")} <Heart className="w-3 h-3 inline text-red-400" /> {tr("untuk produktivitas.")}</p>
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
            <span>{tr("Dikembangkan oleh")}</span>
            <span className="text-slate-600 dark:text-slate-300 font-bold">{tr("WisDev")}</span>
            <span className="text-slate-200 dark:text-slate-700">•</span>
            <a href={SITE_URL} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" data-testid="footer-domain">{SITE_HOST}</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">{tr("Kebijakan Privasi")}</Link>
            <span className="text-slate-200 dark:text-slate-700">•</span>
            <Link to="/terms" className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">{tr("Ketentuan Layanan")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
