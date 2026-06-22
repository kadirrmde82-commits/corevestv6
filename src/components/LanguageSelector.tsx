import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check } from 'lucide-react';

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'tr', label: t('language.tr'), flag: '🇹🇷' },
    { code: 'en', label: t('language.en'), flag: '🇺🇸' },
  ];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(248,251,255,0.1)',
          color: '#c8d6e5',
        }}
      >
        <Globe size={16} color="#FFD700" />
        <span className="hidden sm:inline">{languages.find(l => l.code === i18n.language)?.label || 'Türkçe'}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-50 min-w-[160px]"
          style={{
            background: 'rgba(5, 9, 20, 0.95)',
            border: '1px solid rgba(248,251,255,0.1)',
            boxShadow: '0 16px 42px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => {
                i18n.changeLanguage(lang.code);
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-white/5"
              style={{ color: i18n.language === lang.code ? '#FFD700' : '#c8d6e5' }}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
              {i18n.language === lang.code && <Check size={14} className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
