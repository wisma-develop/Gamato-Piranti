import { Outlet, useLocation, Link } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { ChevronRight, Home } from 'lucide-react';

const PAGE_LABELS: Record<string, string> = {
  '/qr':      'QR & Barcode Studio',
  '/pdf':     'PDF Lab – Suite',
  '/docs':    'Doc Studio',
  '/image':   'Image Lab',
  '/utility': 'Rak Utilitas',
  '/about':   'About Us',
  '/privacy': 'Privacy Policy',
  '/terms':   'Terms of Service',
};

export default function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const label = PAGE_LABELS[pathname];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 flex flex-col">
      <Header />
      <main className="flex-1">
        {/* Breadcrumb — only on non-home pages */}
        {!isHome && label && (
          <div className="border-b border-slate-100 bg-white/70">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
              <nav className="flex items-center gap-1.5 text-xs text-slate-400">
                <Link to="/" className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                  <Home className="w-3 h-3" />
                  <span>Beranda</span>
                </Link>
                <ChevronRight className="w-3 h-3 shrink-0" />
                <span className="text-slate-600 font-semibold">{label}</span>
              </nav>
            </div>
          </div>
        )}
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
