import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, MousePointerClick, Users, UserCircle, HelpCircle } from 'lucide-react';

export default function BottomNav({ onTabPress }: { onTabPress?: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const tabs = [
    { key: 'home', label: t('nav.home'), icon: Home, path: '/home' },
    { key: 'quantify', label: t('nav.quantify'), icon: MousePointerClick, path: '/quantify' },
    { key: 'referral', label: t('nav.referral'), icon: Users, path: '/referral' },
    { key: 'faq', label: 'SSS', icon: HelpCircle, path: '/faq' },
    { key: 'account', label: t('nav.account'), icon: UserCircle, path: '/account' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around gap-1 px-2 py-2"
      style={{
        background: 'rgba(5, 11, 20, 0.92)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(248,251,255,0.08)',
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => {
              onTabPress?.();
              navigate(tab.path);
            }}
            className="flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all min-w-[64px]"
            style={{
              background: isActive ? 'rgba(255,215,0,0.12)' : 'transparent',
              color: isActive ? '#FFD700' : '#5a6a7a',
            }}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
