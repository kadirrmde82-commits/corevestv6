import type { ReactNode } from 'react';
import LanguageSelector from './LanguageSelector';

interface AuthCardProps {
  children: ReactNode;
}

export default function AuthCard({ children }: AuthCardProps) {

  return (
    <div className="page-bg flex items-center justify-center px-4 py-8 min-h-screen">
      <div
        className="w-full max-w-[420px] animate-fade-in"
        style={{
          background: 'rgba(3, 8, 16, 0.65)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(248, 251, 255, 0.1)',
          borderRadius: '22px',
          padding: '28px',
          boxShadow: '0 16px 42px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img
              src="/logo-icon.png"
              alt="Corevest"
              className="w-10 h-10 rounded-lg"
            />
            <span className="text-lg font-extrabold tracking-wide">
              <span className="text-white">CORE</span>
              <span style={{ color: '#FFD700' }}>VEST</span>
            </span>
          </div>
          <LanguageSelector />
        </div>

        {children}
      </div>
    </div>
  );
}
