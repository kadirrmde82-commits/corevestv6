import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, TrendingDown, MousePointerClick,
  DollarSign, Wallet, Crown, ChevronRight
} from 'lucide-react';
import Layout from '../components/Layout';
import { getUser, getVipLevel, VIP_TABLE } from '../store';

const COINS = [
  { symbol: 'BTC', name: 'Bitcoin', basePrice: 84732.45, change: 2.34, color: '#FFD700' },
  { symbol: 'ETH', name: 'Ethereum', basePrice: 4521.18, change: -1.12, color: '#8C8C8C' },
  { symbol: 'SOL', name: 'Solana', basePrice: 198.76, change: 5.67, color: '#00D4AA' },
  { symbol: 'DOGE', name: 'Dogecoin', basePrice: 0.3421, change: -3.45, color: '#C2A633' },
  { symbol: 'LTC', name: 'Litecoin', basePrice: 98.54, change: 1.23, color: '#345D9D' },
];

export default function Home() {
  const { t } = useTranslation();
  const [user, setUser] = useState(getUser());
  const [animatedPrices, setAnimatedPrices] = useState(COINS.map(c => c.basePrice));

  // Refresh user data on mount
  useEffect(() => {
    setUser(getUser());
  }, []);

  // Also refresh when window gains focus
  useEffect(() => {
    const handler = () => setUser(getUser());
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  const currentVip = useMemo(() => getVipLevel(user?.investment || 0), [user?.investment]);
  const nextVip = useMemo(() => {
    return VIP_TABLE.find(v => v.level === (currentVip || 0) + 1);
  }, [currentVip]);

  // Simulate live prices
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimatedPrices(prev =>
        prev.map((p) => {
          const change = (Math.random() - 0.5) * p * 0.002;
          return Math.max(0, p + change);
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  return (
    <Layout>
      <div className="grid gap-3">
        {/* Welcome Banner */}
        <div
          className="relative overflow-hidden animate-fade-in"
          style={{
            border: '1px solid rgba(248,251,255,0.11)',
            borderRadius: '18px',
            padding: '22px',
            background: 'radial-gradient(circle at 76% 22%, rgba(255,215,0,0.15), transparent 26%), radial-gradient(circle at 92% 84%, rgba(255,165,0,0.1), transparent 28%), linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))',
            boxShadow: '0 22px 60px rgba(0,0,0,0.32)',
          }}
        >
          <div className="relative z-10">
            <div className="status-badge mb-3">
              <Crown size={14} />
              {currentVip === 0 ? 'VIP 0' : `VIP ${currentVip}`} - {t('home.vipStatus')}
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{t('home.welcome')}</h1>
            <p className="text-sm max-w-md" style={{ color: '#a9bccf' }}>
              {currentVip === 0 ? t('home.upgradeVip') : t('home.welcomeText')}
            </p>
            {nextVip && (
              <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: '#8fa5b8' }}>
                <ChevronRight size={14} style={{ color: '#FFD700' }} />
                {t('home.nextVip')}: ${nextVip.min} ({t(`vipLevels.vip${nextVip.level}`)})
              </div>
            )}
          </div>
          <div className="absolute right-[-20px] bottom-[-40px] rounded-full" style={{ width: '130px', height: '130px', border: '1px solid rgba(255,215,0,0.15)', transform: 'rotate(-18deg)' }}>
            <span className="absolute rounded-full" style={{ top: '22px', left: '34px', width: '8px', height: '8px', background: '#FFD700', boxShadow: '0 0 14px rgba(255,215,0,0.7)' }} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}>
                <MousePointerClick size={18} />
              </div>
            </div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('home.totalClicks')}</span>
            <strong className="block text-xl text-white mt-1">{user.totalClicks}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}>
                <DollarSign size={18} />
              </div>
            </div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('home.totalEarnings')}</span>
            <strong className="block text-xl mt-1" style={{ color: '#FFD700' }}>${user.totalEarned.toFixed(2)}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}>
                <Wallet size={18} />
              </div>
            </div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('home.currentInvestment')}</span>
            <strong className="block text-xl text-white mt-1">${user.investment.toLocaleString()}</strong>
          </div>
          <div className="glass-card">
            <div className="flex items-center gap-2 mb-2">
              <div className="grid place-items-center rounded-xl" style={{ width: '38px', height: '38px', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}>
                <Crown size={18} />
              </div>
            </div>
            <span className="text-xs font-medium" style={{ color: '#8fa5b8' }}>{t('home.currentLevel')}</span>
            <strong className="block text-xl mt-1" style={{ color: '#FFD700' }}>{`VIP ${currentVip}`}</strong>
          </div>
        </div>

        {/* Market Prices */}
        <div className="glass-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">{t('home.marketPrices')}</h2>
              <p className="text-xs" style={{ color: '#8fa5b8' }}>{t('home.marketSubtitle')}</p>
            </div>
            <div className="status-badge text-[10px]">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </div>
          </div>
          <div className="grid gap-2">
            {COINS.map((coin, i) => {
              const isUp = coin.change >= 0;
              const livePrice = animatedPrices[i];
              return (
                <div key={coin.symbol} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(248,251,255,0.05)' }}>
                  <div className="grid place-items-center rounded-lg font-extrabold text-xs shrink-0" style={{ width: '40px', height: '40px', background: `${coin.color}18`, color: coin.color }}>{coin.symbol.slice(0, 2)}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-white block">{coin.name}</span>
                    <span className="text-xs" style={{ color: '#8fa5b8' }}>{coin.symbol}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-white block">${livePrice < 1 ? livePrice.toFixed(4) : livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-xs font-semibold flex items-center justify-end gap-1" style={{ color: isUp ? '#10b981' : '#ef4444' }}>{isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{isUp ? '+' : ''}{coin.change}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
