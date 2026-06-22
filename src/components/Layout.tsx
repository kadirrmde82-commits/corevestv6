import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import LanguageSelector from './LanguageSelector';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="page-bg min-h-screen pb-24">
      {/* Topbar */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 py-3 mb-4"
        style={{
          background: 'rgba(5, 11, 20, 0.82)',
          backdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(248,251,255,0.06)',
        }}
      >
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate('/home')}
        >
          <img src="/logo-icon.png" alt="Corevest" className="w-9 h-9 rounded-lg" />
          <span className="text-base font-extrabold tracking-wide">
            <span className="text-white">CORE</span>
            <span style={{ color: '#FFD700' }}>VEST</span>
          </span>
        </div>
        <LanguageSelector />
      </div>

      {/* Content */}
      <div className="px-4" style={{ width: 'min(100%, 1180px)', margin: '0 auto' }}>
        {children}
      </div>

      <BottomNav />
    </div>
  );
}
